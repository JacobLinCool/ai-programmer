import debug from "debug";
import fs from "node:fs";
import path from "node:path";
import { Octokit } from "octokit";
import OpenAI from "openai";
import type { FunctionDefinition, Piece, Reference } from "./types";

export interface ProgrammerConfig {
	octokit: Octokit;
	openai: OpenAI;
	language?: string;
	debug?: string;
}

export class Programmer {
	private readonly octokit: Octokit;
	private readonly openai: OpenAI;
	private readonly language: string;
	private readonly debug?: string;

	private readonly called = new Map<string, number>();

	constructor({ octokit, openai, language = "c", debug }: ProgrammerConfig) {
		this.octokit = octokit;
		this.openai = openai;
		this.language = language;
		this.debug = debug;
	}

	private dump<F extends (...args: never[]) => unknown>(fn: F): F {
		if (!fn.name) {
			throw new Error("Function name is required");
		}

		if (!this.debug) {
			return fn;
		}

		const dir = this.debug;
		fs.mkdirSync(path.resolve(dir, fn.name), { recursive: true });

		return ((...args: never[]) => {
			const result = fn(...args);
			const i = this.called.get(fn.name) || 0;
			this.called.set(fn.name, i + 1);
			if (result instanceof Promise) {
				result.then((result) =>
					fs.writeFileSync(
						path.resolve(dir, fn.name, `${i}.json`),
						JSON.stringify({ args, result }, null, 2),
					),
				);
			} else {
				fs.writeFileSync(
					path.resolve(dir, fn.name, `${i}.json`),
					JSON.stringify({ args, result }, null, 2),
				);
			}
			return result;
		}) as F;
	}

	/**
	 * Based on the given specification, returns a list of functions that can be used to complete the specification.
	 */
	async plan(specification: string): Promise<{
		functions: FunctionDefinition[];
	}> {
		const log = debug("plan");

		const res = await this.openai.chat.completions.create({
			model: "gpt-4-turbo-preview",
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content:
						`As a programmer, to complete the given task. Please provide a list of necessary functions with their name, interface (in ${this.language}), description (with input and output sample), and 1 to 3 related keywords for search.\n` +
						"Response in JSON format with the following structure: { functions: { name: string, interface: string; description: string, keywords: string[] }[] }",
				},
				{
					role: "user",
					content: specification,
				},
			],
			seed: 20030317,
			temperature: 0.3,
			max_tokens: 2000,
		});
		log(res);

		if (!res.choices[0].message.content) {
			throw new Error("No content in response");
		}

		return JSON.parse(res.choices[0].message.content);
	}

	async retrieve(func: FunctionDefinition): Promise<{ references: Reference[] }> {
		const log = debug("retrieve");

		const { data } = await this.octokit.request("GET /search/code", {
			q: `${func.name} language:${this.language}`,
			per_page: 50,
		});
		log(data.items);

		const references = await Promise.all(
			data.items
				.filter((item) => item.repository.fork === false)
				.slice(0, 3)
				.map(async (item) => {
					const ref = item.url.match(/\?ref=(.*)$/)?.[1];
					const url = `https://raw.githubusercontent.com/${item.repository.full_name}/${ref}/${item.path}`;
					const code = await fetch(url).then((res) => res.text());
					return {
						code: code.trim(),
						url: item.html_url,
						author: item.repository.owner.login,
						license: item.repository.license?.spdx_id ?? "",
					};
				}),
		);

		// each token is approximately 4 bytes in average
		while (references.reduce((acc, ref) => acc + new Blob([ref.code]).size, 0) > 200_000) {
			references.pop();
		}

		return { references };
	}

	async generate(func: FunctionDefinition, references: Reference[]): Promise<{ code: string }> {
		const log = debug("generate");

		const refs = references
			.map((ref) => `// Source: ${ref.url}\n// Author: ${ref.author}\n${ref.code}`)
			.join("\n\n");

		const res = await this.openai.chat.completions.create({
			model: "gpt-4-turbo-preview",
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: `Code References from GitHub:\n${refs}`,
				},
				{
					role: "user",
					content: `Based on the following function definition and the code references above, generate the implementation of the function in ${this.language}:

Function Definition:
Name: ${func.name}
Interface: ${func.interface}
Description: ${func.description}

Response in JSON format with the following structure: { code: string }`,
				},
			],
			temperature: 0.3,
			max_tokens: 2000,
		});
		log(res);

		if (!res.choices[0].message.content) {
			throw new Error("No content in response");
		}

		return JSON.parse(res.choices[0].message.content);
	}

	async assemble(specification: string, pieces: Piece[]): Promise<{ program: string }> {
		const log = debug("assemble");

		const refs = pieces
			.map(
				(piece) =>
					`// Function: ${piece.func.name}\n// ${piece.func.description}\n${piece.code}`,
			)
			.join("\n\n");

		const res = await this.openai.chat.completions.create({
			model: "gpt-4-turbo-preview",
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: `Code References:\n${refs}`,
				},
				{
					role: "user",
					content: `Based on the given code references above, generate the program that completes the given instruction in ${this.language}:

${specification}

Response in JSON format with the following structure: { code: string }`,
				},
			],
			temperature: 0.3,
			max_tokens: 4000,
		});
		log(res);

		if (!res.choices[0].message.content) {
			throw new Error("No content in response");
		}

		return {
			program: JSON.parse(res.choices[0].message.content).code,
		};
	}

	async develop(specification: string): Promise<string> {
		const log = debug("main");

		log("Planning ...");
		const { functions } = await this.dump(this.plan.bind(this))(specification);
		log("I think there are %d functions should be implemented", functions.length);

		const pieces: Piece[] = [];
		for (const func of functions) {
			log("Finding references for %s ...", func.name);
			const { references } = await this.dump(this.retrieve.bind(this))(func);

			log("Generating code for %s ...", func.name);
			const { code } = await this.dump(this.generate.bind(this))(func, references);
			log("Generated code: \n%s", code);

			pieces.push({ func, code });
		}

		const { program } = await this.dump(this.assemble.bind(this))(specification, pieces);
		log("Assembled program: \n%s", program);

		return program;
	}

	implement(specification: string) {
		return this.develop(specification);
	}
}

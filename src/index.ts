#!/usr/bin/env node
import debug from "debug";
import fs from "node:fs";
import path from "node:path";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { octokit, openai } from "./api";
import { CACHE_DIR, TARGET_LANGUAGE } from "./config";
import { Programmer } from "./programmer";

let argv = yargs(hideBin(process.argv))
	.usage("Usage: $0 [options]")
	.option("input", {
		alias: "i",
		describe: "Input file path",
		type: "string",
		default: "specification.md",
		normalize: true,
	})
	.option("output", {
		alias: "o",
		describe: "Output file path",
		type: "string",
		default: `program.${TARGET_LANGUAGE}`,
		normalize: true,
	})
	.option("language", {
		alias: "l",
		describe: "Target programming language",
		type: "string",
		default: TARGET_LANGUAGE,
	})
	.option("debug", {
		alias: "d",
		describe: "Directory to dump debug data",
		type: "string",
		default: CACHE_DIR,
		normalize: true,
	})
	.help("h")
	.alias("h", "help").argv;

main();

async function main() {
	argv = await argv;
	const input = path.resolve(argv.input);
	const specification = fs.readFileSync(input, "utf-8");

	if (argv.debug) {
		debug.enable("*");
	}

	const programmer = new Programmer({
		openai: openai,
		octokit: octokit,
		language: argv.language,
		debug: argv.debug,
	});

	const program = await programmer.implement(specification);

	const output = path.resolve(argv.output);
	fs.writeFileSync(output, program);
}

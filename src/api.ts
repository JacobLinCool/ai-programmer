import { Octokit } from "octokit";
import { OpenAI } from "openai";
import { GITHUB_TOKEN, OPENAI_API_KEY, OPENAI_API_URL } from "./config";

export const octokit: Octokit = new Octokit({ auth: GITHUB_TOKEN });
export const openai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_API_URL });

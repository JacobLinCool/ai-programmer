import { config } from "dotenv";

config();

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
if (!GITHUB_TOKEN) {
	throw new Error("GITHUB_TOKEN not set");
}

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
if (!OPENAI_API_KEY) {
	throw new Error("OPENAI_API_KEY not set");
}

export const OPENAI_API_URL = process.env.OPENAI_API_URL;

export const TARGET_LANGUAGE = process.env.TARGET_LANGUAGE || "c";

export const CACHE_DIR = process.env.CACHE_DIR || ".cache";

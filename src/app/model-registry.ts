import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import type { ModelWithApiKey } from "../lib/types.js";

// These are limits verified for May's configured model endpoint, not upstream
// catalog capabilities. Keep them explicit so a catalog refresh cannot
// silently delay compaction past the endpoint's context window.
const ENDPOINT_CONTEXT_WINDOWS = {
  "claude-opus-4-6": 72_000,
  "gpt-5.4": 400_000,
  "gpt-5.5": 400_000,
  "gpt-5.6-sol": 400_000,
  "claude-opus-4.7": 200_000,
  "claude-opus-5": 200_000,
  "gemini-3.1-pro-preview": 200_000,
} as const;

export type ModelRegistry = Record<string, ModelWithApiKey>;

export function createModelRegistry(env: NodeJS.ProcessEnv = process.env): ModelRegistry {
  const baseUrl = env.MODEL_BASE_URL || "http://localhost:4000";
  const apiKey = env.MODEL_API_KEY || "not-needed";

  return {
    "claude-opus-4-6": {
      ...getBuiltinModel("anthropic", "claude-opus-4-6"),
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["claude-opus-4-6"],
      baseUrl,
      apiKey,
    },
    "gpt-5.4": {
      ...getBuiltinModel("github-copilot", "gpt-5.4"),
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["gpt-5.4"],
      baseUrl,
      apiKey,
    },
    "gpt-5.5": {
      ...getBuiltinModel("github-copilot", "gpt-5.5"),
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["gpt-5.5"],
      baseUrl,
      apiKey,
    },
    "gpt-5.6-sol": {
      ...getBuiltinModel("github-copilot", "gpt-5.6-sol"),
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["gpt-5.6-sol"],
      baseUrl,
      apiKey,
    },
    "claude-opus-4.7": {
      ...getBuiltinModel("github-copilot", "claude-opus-4.7"),
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["claude-opus-4.7"],
      baseUrl,
      apiKey,
    },
    "claude-opus-5": {
      ...getBuiltinModel("anthropic", "claude-opus-4-6"),
      id: "claude-opus-5",
      name: "Claude Opus 5",
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["claude-opus-5"],
      baseUrl,
      apiKey,
    },
    "gemini-3.1-pro-preview": {
      ...getBuiltinModel("github-copilot", "gemini-3.1-pro-preview"),
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["gemini-3.1-pro-preview"],
      baseUrl,
      apiKey,
    },
  };
}

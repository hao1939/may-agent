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

export type ModelWithFallback = ModelWithApiKey & {
  /** Independent model route used when the primary provider credential is unavailable. */
  fallbackModel?: ModelWithApiKey;
};

export type ModelRegistry = Record<string, ModelWithFallback>;

export function createModelRegistry(env: NodeJS.ProcessEnv = process.env): ModelRegistry {
  const baseUrl = env.MODEL_BASE_URL || "http://localhost:4000";
  const apiKey = env.MODEL_API_KEY || "not-needed";
  const claudeOpus5: ModelWithApiKey = {
    ...getBuiltinModel("anthropic", "claude-opus-4-6"),
    id: "claude-opus-5",
    name: "Claude Opus 5",
    contextWindow: ENDPOINT_CONTEXT_WINDOWS["claude-opus-5"],
    baseUrl,
    apiKey,
  };

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
      fallbackModel: claudeOpus5,
    },
    "claude-opus-4.7": {
      ...getBuiltinModel("github-copilot", "claude-opus-4.7"),
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["claude-opus-4.7"],
      baseUrl,
      apiKey,
    },
    "claude-opus-5": claudeOpus5,
    "gemini-3.1-pro-preview": {
      // This endpoint route is independent of Pi's current public catalog.
      // Preserve its 0.81.1 metadata; do not silently select a different model
      // when an upstream catalog entry is retired.
      id: "gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro Preview",
      api: "openai-completions",
      provider: "github-copilot",
      reasoning: true,
      input: ["text", "image"],
      maxTokens: 64_000,
      cost: {
        input: 2,
        output: 12,
        cacheRead: 0.2,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 200_000, input: 4, output: 18, cacheRead: 0.4, cacheWrite: 0 }],
      },
      headers: {
        "User-Agent": "GitHubCopilotChat/0.35.0",
        "Editor-Version": "vscode/1.107.0",
        "Editor-Plugin-Version": "copilot-chat/0.35.0",
        "Copilot-Integration-Id": "vscode-chat",
      },
      compat: { supportsStore: false, supportsDeveloperRole: false, supportsReasoningEffort: false },
      contextWindow: ENDPOINT_CONTEXT_WINDOWS["gemini-3.1-pro-preview"],
      baseUrl,
      apiKey,
    },
  };
}

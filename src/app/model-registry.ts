import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import type { ModelWithApiKey } from "../lib/types.js";

// These are limits verified for May's configured model endpoint, not upstream
// catalog capabilities. Keep them explicit so a catalog refresh cannot
// silently delay compaction past the endpoint's context window.
const ENDPOINT_CONTEXT_WINDOWS = {
  "claude-opus-4-6": 72_000,
  "gpt-5.2": 400_000,
  "gpt-5.4": 400_000,
  "gpt-5.5": 400_000,
  "claude-opus-4.7": 200_000,
  "gemini-3.1-pro-preview": 200_000,
} as const;

export interface ModelRegistry {
  models: Record<string, ModelWithApiKey>;
  baseUrl: string;
  apiKey: string;
  anthropicDirect: boolean;
}

export function createModelRegistry(env: NodeJS.ProcessEnv = process.env): ModelRegistry {
  const baseUrl = env.MODEL_BASE_URL || "http://localhost:4000";
  // LITELLM_API_KEY remains a compatibility fallback for existing deployments.
  const apiKey = env.MODEL_API_KEY || env.LITELLM_API_KEY || env.ANTHROPIC_API_KEY || "not-needed";
  const anthropicDirect = Boolean(env.ANTHROPIC_API_KEY);
  const anthropicRoute = anthropicDirect
    ? { baseUrl: "https://api.anthropic.com", apiKey: env.ANTHROPIC_API_KEY! }
    : { baseUrl, apiKey };

  return {
    baseUrl,
    apiKey,
    anthropicDirect,
    models: {
      "claude-opus-4-6": anthropicDirect
        ? {
            ...getBuiltinModel("anthropic", "claude-opus-4-6"),
            contextWindow: 200_000,
            baseUrl: anthropicRoute.baseUrl,
            apiKey: anthropicRoute.apiKey,
          }
        : {
            ...getBuiltinModel("anthropic", "claude-opus-4-6"),
            contextWindow: ENDPOINT_CONTEXT_WINDOWS["claude-opus-4-6"],
            baseUrl,
            apiKey,
          },
      "gpt-5.2": {
        ...getBuiltinModel("openai", "gpt-5.2"),
        contextWindow: ENDPOINT_CONTEXT_WINDOWS["gpt-5.2"],
        baseUrl,
        apiKey,
      },
      "gpt-5.4": {
        ...getBuiltinModel("github-copilot", "gpt-5.4"),
        contextWindow: ENDPOINT_CONTEXT_WINDOWS["gpt-5.4"],
        baseUrl,
        apiKey,
      },
      "kimi-k2.5": {
        ...getBuiltinModel("openai", "gpt-4o"),
        api: "openai-completions" as const,
        id: "kimi-k2.5",
        contextWindow: 262_144,
        baseUrl: env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
        apiKey: env.KIMI_API_KEY || "",
      },
      "gpt-5.5": {
        ...getBuiltinModel("github-copilot", "gpt-5.5"),
        contextWindow: ENDPOINT_CONTEXT_WINDOWS["gpt-5.5"],
        baseUrl,
        apiKey,
      },
      "claude-opus-4.7": {
        ...getBuiltinModel("github-copilot", "claude-opus-4.7"),
        contextWindow: ENDPOINT_CONTEXT_WINDOWS["claude-opus-4.7"],
        baseUrl,
        apiKey,
      },
      "gemini-3.1-pro-preview": {
        ...getBuiltinModel("github-copilot", "gemini-3.1-pro-preview"),
        contextWindow: ENDPOINT_CONTEXT_WINDOWS["gemini-3.1-pro-preview"],
        baseUrl,
        apiKey,
      },
    },
  };
}

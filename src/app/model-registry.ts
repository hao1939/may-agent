import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import type { ModelWithApiKey } from "../lib/types.js";

// These are routing limits verified for May's proxy, not upstream catalog
// capabilities. Keep them explicit so a catalog refresh cannot silently delay
// compaction past the gateway's configured context window.
const PROXY_CONTEXT_WINDOWS = {
  opus: 72_000,
  gpt52: 400_000,
  "gpt-5.4": 400_000,
  "gpt-5.5": 400_000,
  "opus-4.7": 200_000,
  "gemini-3.1-pro": 200_000,
} as const;

export interface ModelRegistry {
  models: Record<string, ModelWithApiKey>;
  modelBaseUrl: string;
  apiKey: string;
  anthropicDirect: boolean;
}

export function createModelRegistry(env: NodeJS.ProcessEnv = process.env): ModelRegistry {
  const modelBaseUrl = env.MODEL_BASE_URL || "http://localhost:4000";
  const apiKey = env.LITELLM_API_KEY || env.ANTHROPIC_API_KEY || "not-needed";
  const anthropicDirect = Boolean(env.ANTHROPIC_API_KEY);
  const anthropicRoute = anthropicDirect
    ? { baseUrl: "https://api.anthropic.com", apiKey: env.ANTHROPIC_API_KEY! }
    : { baseUrl: modelBaseUrl, apiKey };

  return {
    modelBaseUrl,
    apiKey,
    anthropicDirect,
    models: {
      opus: anthropicDirect
        ? {
            ...getBuiltinModel("anthropic", "claude-opus-4-6"),
            contextWindow: 200_000,
            baseUrl: anthropicRoute.baseUrl,
            apiKey: anthropicRoute.apiKey,
          }
        : {
            ...getBuiltinModel("anthropic", "claude-opus-4-6"),
            contextWindow: PROXY_CONTEXT_WINDOWS.opus,
            baseUrl: modelBaseUrl,
            apiKey,
          },
      gpt52: {
        ...getBuiltinModel("openai", "gpt-5.2"),
        contextWindow: PROXY_CONTEXT_WINDOWS.gpt52,
        baseUrl: modelBaseUrl,
        apiKey,
      },
      "gpt-5.4": {
        ...getBuiltinModel("github-copilot", "gpt-5.4"),
        contextWindow: PROXY_CONTEXT_WINDOWS["gpt-5.4"],
        baseUrl: modelBaseUrl,
        apiKey,
      },
      kimi: {
        ...getBuiltinModel("openai", "gpt-4o"),
        api: "openai-completions" as const,
        id: "kimi-k2.5",
        contextWindow: 262_144,
        baseUrl: env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
        apiKey: env.KIMI_API_KEY || "",
      },
      "gpt-5.5": {
        ...getBuiltinModel("github-copilot", "gpt-5.5"),
        contextWindow: PROXY_CONTEXT_WINDOWS["gpt-5.5"],
        baseUrl: modelBaseUrl,
        apiKey,
      },
      "opus-4.7": {
        ...getBuiltinModel("github-copilot", "claude-opus-4.7"),
        contextWindow: PROXY_CONTEXT_WINDOWS["opus-4.7"],
        baseUrl: modelBaseUrl,
        apiKey,
      },
      "gemini-3.1-pro": {
        ...getBuiltinModel("github-copilot", "gemini-3.1-pro-preview"),
        contextWindow: PROXY_CONTEXT_WINDOWS["gemini-3.1-pro"],
        baseUrl: modelBaseUrl,
        apiKey,
      },
    },
  };
}

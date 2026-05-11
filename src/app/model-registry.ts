import { getModel } from "@mariozechner/pi-ai";
import type { ModelWithApiKey } from "../lib/types.js";

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
            ...getModel("anthropic", "claude-sonnet-4-20250514"),
            id: "claude-opus-4.6",
            contextWindow: 200000,
            baseUrl: anthropicRoute.baseUrl,
            apiKey: anthropicRoute.apiKey,
          }
        : {
            ...getModel("anthropic", "claude-sonnet-4-20250514"),
            id: "claude-opus-4.6",
            contextWindow: 72000,
            baseUrl: modelBaseUrl,
            apiKey,
          },
      gpt52: {
        ...getModel("openai", "gpt-5.2"),
        baseUrl: modelBaseUrl,
        apiKey,
      },
      "gpt-5.4": {
        ...getModel("github-copilot", "gpt-5.4"),
        baseUrl: modelBaseUrl,
        apiKey,
      },
      kimi: {
        ...getModel("openai", "gpt-4o"),
        api: "openai-completions" as const,
        id: "kimi-k2.5",
        contextWindow: 262144,
        baseUrl: env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
        apiKey: env.KIMI_API_KEY || "",
      },
      "gpt-5.5": {
        ...getModel("github-copilot", "gpt-5.5"),
        baseUrl: modelBaseUrl,
        apiKey,
      },
      "opus-4.7": {
        ...getModel("github-copilot", "claude-opus-4.7"),
        baseUrl: modelBaseUrl,
        apiKey,
      },
      "gemini-3.1-pro": {
        ...getModel("github-copilot", "gemini-3.1-pro-preview"),
        baseUrl: modelBaseUrl,
        apiKey,
      },
    },
  };
}

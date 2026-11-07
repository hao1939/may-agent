import type { Api, Model } from "@earendil-works/pi-ai";

// Endpoint routes retained from Pi 0.87.1 after their upstream catalog removal.
// A catalog refresh must not silently change the model served by these IDs.
export const LEGACY_ENDPOINT_MODELS = {
  "gpt-5.4": {
    id: "gpt-5.4",
    name: "GPT-5.4",
    api: "openai-responses",
    provider: "github-copilot",
    reasoning: true,
    input: ["text", "image"],
    cost: {
      input: 2.5,
      output: 15,
      cacheRead: 0.25,
      cacheWrite: 0,
      tiers: [
        {
          inputTokensAbove: 272000,
          input: 5,
          output: 22.5,
          cacheRead: 0.5,
          cacheWrite: 0,
        },
      ],
    },
    maxTokens: 128000,
    headers: {
      "User-Agent": "GitHubCopilotChat/0.35.0",
      "Editor-Version": "vscode/1.107.0",
      "Editor-Plugin-Version": "copilot-chat/0.35.0",
      "Copilot-Integration-Id": "vscode-chat",
    },
    thinkingLevelMap: {
      off: null,
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: null,
    },
    compat: {
      supportsOpenAIGrammarTools: true,
      supportsMidConvoSystemMessages: true,
      supportsAdditionalTools: true,
      supportsStrictMode: true,
    },
    inputLimits: {
      images: {
        resize: {
          maxWidth: 2000,
          maxHeight: 2000,
          maxBytes: 4718592,
          jpegQuality: 80,
        },
      },
    },
    baseUrl: "http://localhost:4000",
  },
  "gpt-5.5": {
    id: "gpt-5.5",
    name: "GPT-5.5",
    api: "openai-responses",
    provider: "github-copilot",
    reasoning: true,
    input: ["text", "image"],
    cost: {
      input: 5,
      output: 30,
      cacheRead: 0.5,
      cacheWrite: 0,
      tiers: [
        {
          inputTokensAbove: 272000,
          input: 10,
          output: 45,
          cacheRead: 1,
          cacheWrite: 0,
        },
      ],
    },
    maxTokens: 128000,
    headers: {
      "User-Agent": "GitHubCopilotChat/0.35.0",
      "Editor-Version": "vscode/1.107.0",
      "Editor-Plugin-Version": "copilot-chat/0.35.0",
      "Copilot-Integration-Id": "vscode-chat",
    },
    thinkingLevelMap: {
      off: null,
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: null,
    },
    compat: {
      supportsOpenAIGrammarTools: true,
      supportsMidConvoSystemMessages: true,
      supportsAdditionalTools: true,
      supportsStrictMode: true,
    },
    inputLimits: {
      images: {
        resize: {
          maxWidth: 2000,
          maxHeight: 2000,
          maxBytes: 4718592,
          jpegQuality: 80,
        },
      },
    },
    baseUrl: "http://localhost:4000",
  },
  "claude-opus-4.7": {
    id: "claude-opus-4.7",
    name: "Claude Opus 4.7",
    api: "anthropic-messages",
    provider: "github-copilot",
    reasoning: true,
    input: ["text", "image"],
    cost: {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite: 6.25,
    },
    maxTokens: 32000,
    headers: {
      "User-Agent": "GitHubCopilotChat/0.35.0",
      "Editor-Version": "vscode/1.107.0",
      "Editor-Plugin-Version": "copilot-chat/0.35.0",
      "Copilot-Integration-Id": "vscode-chat",
    },
    thinkingLevelMap: {
      xhigh: "xhigh",
      max: "max",
      minimal: "low",
    },
    compat: {
      forceAdaptiveThinking: true,
      supportsTemperature: false,
    },
    inputLimits: {
      images: {
        resize: {
          maxWidth: 2000,
          maxHeight: 2000,
          maxBytes: 4718592,
          jpegQuality: 80,
        },
      },
    },
    baseUrl: "http://localhost:4000",
  },
} satisfies Record<string, Omit<Model<Api>, "contextWindow">>;

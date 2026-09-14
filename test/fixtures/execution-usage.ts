import type { AssistantMessage } from "@earendil-works/pi-ai";
import { createExecutionUsage, type PreparationMeasurement } from "../../src/lib/execution-usage.js";

export const preparationFixture: PreparationMeasurement = {
  preparer: "full",
  entryHash: null,
  durationMs: 1,
  taskBytes: 200,
  promptBytes: 200,
  systemBytes: 100,
  failed: false,
};

export function usageReply(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: "openai-responses",
    provider: "fixture",
    model: "model-a",
    stopReason: "stop",
    timestamp: 1,
    usage: {
      input: 10,
      cacheRead: 100,
      cacheWrite: 20,
      output: 5,
      totalTokens: 135,
      cost: { input: 0.01, output: 0.01, cacheRead: 0.01, cacheWrite: 0.01, total: 0.04 },
    },
    ...overrides,
  };
}

export function observeReply(collector: ReturnType<typeof createExecutionUsage>, message: AssistantMessage) {
  collector.observe({ type: "message_end", message }, {} as never);
}

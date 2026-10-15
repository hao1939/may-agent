import { isContextOverflow, type AssistantMessage } from "@earendil-works/pi-ai";

const EMPTY_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/** Provider identity is required for ambiguous errors such as a bodyless 400. */
export function isOverflowError(error: string, provider = "unknown"): boolean {
  return isContextOverflow({
    role: "assistant",
    content: [],
    api: "unknown",
    provider,
    model: "unknown",
    usage: EMPTY_USAGE,
    stopReason: "error",
    errorMessage: error,
    timestamp: Date.now(),
  } as AssistantMessage);
}

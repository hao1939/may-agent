import { describe, expect, it } from "bun:test";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { isRetryableEmptyAssistantFailure, trimTerminalEmptyAssistantTurn } from "./manager-utils.js";

describe("empty assistant recovery", () => {
  it("recognizes only empty assistant failures as retryable", () => {
    expect(isRetryableEmptyAssistantFailure("Agent ended on an empty tool-use assistant turn")).toBe(true);
    expect(isRetryableEmptyAssistantFailure("Agent ended with an empty assistant turn")).toBe(true);
    expect(isRetryableEmptyAssistantFailure("Agent ended while waiting for tool results")).toBe(false);
    expect(isRetryableEmptyAssistantFailure(undefined)).toBe(false);
  });

  it("removes only a terminal assistant turn with no text or tool call", () => {
    const messages = [
      { role: "user", content: "Continue", timestamp: 1 },
      { role: "assistant", content: [], stopReason: "stop", timestamp: 2 },
    ] as AgentMessage[];

    expect(trimTerminalEmptyAssistantTurn(messages)).toBe(true);
    expect(messages).toHaveLength(1);

    for (const content of [
      [{ type: "text", text: "Done" }],
      [{ type: "toolCall", id: "finish-1", name: "finish", arguments: {} }],
    ]) {
      const nonEmpty = [{ role: "assistant", content, stopReason: "stop", timestamp: 3 }] as AgentMessage[];
      expect(trimTerminalEmptyAssistantTurn(nonEmpty)).toBe(false);
      expect(nonEmpty).toHaveLength(1);
    }
  });
});

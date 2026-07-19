import { describe, it, expect } from "bun:test";
import { prepareAgentExecution } from "./agent-execution.js";

describe("System Prompt Caching", () => {
  it("should place stable context before volatile session IDs", () => {
    const mockDef = {
      name: "test-agent",
      description: "test",
      domain: "test",
      model: { id: "test", provider: "test" },
      tools: [],
      projectRoot: "/app",
      workspace: "/app/workspace",
    };

    const prepare = (sessionId: string, persistentChat: boolean) => prepareAgentExecution({
      definition: mockDef,
      projectRoot: "/app",
      sessionId,
      task: "hello",
      persistentChat,
      promptTimestamp: "2026-07-20T00:00:00.000Z",
      chatContext: persistentChat ? `Session ID: ${sessionId}` : undefined,
    }).systemPrompt;

    const prompt1 = prepare("session_123", true);
    const prompt2 = prepare("session_456", true);

    // Find where they diverge
    let diffIndex = 0;
    const len = Math.min(prompt1.length, prompt2.length);
    while (diffIndex < len && prompt1[diffIndex] === prompt2[diffIndex]) {
      diffIndex++;
    }

    const stablePrefix = prompt1.slice(0, diffIndex);

    // The stable prefix should contain the heavy context (Runtime Environment)
    // The volatile part (Session ID) should come AFTER.
    expect(stablePrefix).toContain("Runtime Environment");

    // The stable prefix should be long — session IDs are appended at the tail.
    if (stablePrefix.length < 100) {
      throw new Error(
        `Stable prefix is too short (${diffIndex} chars). Session ID appears too early, breaking cache for all subsequent content.`,
      );
    }

    // Non-chat callers add no session context, so the complete prompt is reusable.
    const basePrompt = prepare("session_789", false);
    expect(basePrompt).not.toContain("session_");
    expect(basePrompt).toContain("Runtime Environment");
  });
});

import { describe, it, expect } from "bun:test";
import { SubagentManager } from "./manager.js";

describe("System Prompt Caching", () => {
  it("should place stable context before volatile session IDs", () => {
    // We create a manager instance but we'll call the private method directly via prototype
    // to avoid filesystem dependencies in the test.
    const manager = new SubagentManager({ persistDir: "/tmp/test" });

    // After refactoring, resolveSystemPrompt(def, toolsOverride?) no longer
    // includes session IDs — they moved to resolveSessionSystemPrompt which
    // appends session-specific context at the END. This is exactly what we want
    // for API cache prefixes: the stable prefix is long and only the tail varies.
    //
    // Test that resolveSessionSystemPrompt puts session-varying content at the end.
    // @ts-expect-error Accessing private method for testing
    const resolveSessionSystemPrompt = manager.resolveSessionSystemPrompt.bind(manager);

    const mockDef = {
      name: "test-agent",
      description: "test",
      domain: "test",
      model: { id: "test", provider: "test" },
      tools: [],
      projectRoot: "/app",
      workspace: "/app/workspace",
    };

    const prompt1 = resolveSessionSystemPrompt(mockDef, {
      kind: "persistent-chat",
      autoClose: "never",
      sessionId: "session_123",
      task: "hello",
    });
    const prompt2 = resolveSessionSystemPrompt(mockDef, {
      kind: "persistent-chat",
      autoClose: "never",
      sessionId: "session_456",
      task: "hello",
    });

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

    // For non-persistent sessions, the prompt has NO session ID at all,
    // meaning the entire prompt is cacheable across sessions.
    // @ts-expect-error Accessing private method for testing
    const resolveSystemPrompt = manager.resolveSystemPrompt.bind(manager);
    const basePrompt = resolveSystemPrompt(mockDef);
    expect(basePrompt).not.toContain("session_");
    expect(basePrompt).toContain("Runtime Environment");
  });
});

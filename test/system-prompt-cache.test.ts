import { describe, it, expect } from "vitest";
import { SubagentManager } from "../src/lib/manager.js";

describe("System Prompt Caching", () => {
  it("should place stable context before volatile session IDs", () => {
    // We create a manager instance but we'll call the private method directly via prototype
    // to avoid filesystem dependencies in the test.
    const manager = new SubagentManager({ persistDir: "/tmp/test" , infraRetryMax: 0 });

    // Mock the private method by binding it
    // @ts-expect-error Accessing private method for testing
    const resolveSystemPrompt = manager.resolveSystemPrompt.bind(manager);

    const mockDef = {
      name: "test-agent",
      description: "test",
      domain: "test",
      model: { id: "test", provider: "test" },
      tools: [],
      projectRoot: "/app",
      workspace: "/app/workspace",
      // No files, just static def
    };

    const prompt1 = resolveSystemPrompt(mockDef, "test-agent", "session_123", "/tmp/persist");
    const prompt2 = resolveSystemPrompt(mockDef, "test-agent", "session_456", "/tmp/persist");

    // Find where they diverge
    let diffIndex = 0;
    const len = Math.min(prompt1.length, prompt2.length);
    while (diffIndex < len && prompt1[diffIndex] === prompt2[diffIndex]) {
      diffIndex++;
    }

    const stablePrefix = prompt1.slice(0, diffIndex);
    console.log("Stable prefix length:", diffIndex);
    console.log("Divergence starts at:", prompt1.slice(diffIndex, diffIndex + 20));

    // The stable prefix should contain the heavy context (Project Structure)
    // The volatile part (Session ID) should come AFTER.

    // Current implementation puts Session ID at the very top:
    // "Runtime Environment... Session ID: session_123"
    // Then Project Structure comes later.
    // This breaks caching because the prefix changes immediately.

    const hasSessionIdInPrefix = stablePrefix.includes("session_123");
    const hasStructureInPrefix = stablePrefix.includes("Project Structure");

    // Expectation: The stable prefix should be LONG (contain structure) and NOT contain the session ID.
    // If this fails, it proves the cache-busting behavior.

    if (stablePrefix.length < 100) {
      throw new Error(
        `Stable prefix is too short (${diffIndex} chars). Session ID appears too early, breaking cache for all subsequent content.`,
      );
    }
  });
});

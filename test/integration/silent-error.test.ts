/**
 * Test that agent errors are surfaced, not silently swallowed.
 *
 * Background: When the LLM stream function throws before yielding any events
 * (e.g., missing API key, connection refused), the error goes through
 * terminateStreamOnError() which only emits agent_end — no message_end,
 * no turn_end. This means agent.state.errorMessage is not set by the agent-core.
 *
 * The manager's handleCompletion() detects this case: if the agent completed
 * but the last message is still a user message (no assistant reply), it
 * treats this as an error.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SubagentManager } from "../../src/lib/manager.js";
import type { SubagentDefinition } from "../../src/lib/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

function brokenModel(): Model<any> {
  return {
    id: "broken-model",
    name: "Broken Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://127.0.0.1:1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

function baseDef(overrides: Partial<SubagentDefinition> = {}): SubagentDefinition {
  return {
    name: "bot",
    description: "test",
    domain: "test",
    systemPrompt: "You are a test bot.",
    model: brokenModel(),
    tools: [],
    apiKey: "dummy-key-for-test",
    ...overrides,
  };
}

describe("silent error detection", () => {
  let dir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "silent-error-test-"));
    manager = new SubagentManager({ persistDir: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("task session surfaces error when LLM stream fails", async () => {
    manager.register(baseDef());
    const sid = manager.run("bot", "hello");
    const result = await manager.waitFor(sid);

    expect(result.error).toBeTruthy();
    // Error message varies by runtime: Node gives "without producing a response",
    // Bun may give "No API provider registered for api: anthropic".
    // Both are valid — the key assertion is that the error is surfaced, not swallowed.
    expect(typeof result.error).toBe("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });
});

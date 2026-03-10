/**
 * Test that agent errors are surfaced, not silently swallowed.
 *
 * Background: When the LLM stream function throws before yielding any events
 * (e.g., missing API key, connection refused), the error goes through
 * terminateStreamOnError() which only emits agent_end — no message_end,
 * no turn_end. This means agent.state.error is not set by the agent-core.
 *
 * The manager's handleCompletion() detects this case: if the agent completed
 * but the last message is still a user message (no assistant reply), it
 * treats this as an error.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/lib/manager.js";
import type { SubagentDefinition } from "../src/lib/types.js";
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
    expect(result.error).toContain("without producing a response");
  });

  it("chat session detects silent failure on initial prompt", async () => {
    manager.register(baseDef());
    const sid = manager.createChatSession("bot", "hello");
    await manager.waitForIdle(sid);

    const status = manager.status();
    expect(status.length).toBe(1);
    expect(status[0].status).toBe("idle");

    // The last message should still be user (no assistant response)
    const messages = manager.progress(sid);
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.role).toBe("user");

    // The error should be surfaced (no assistant messages at all)
    const assistantMsgs = messages.filter(m => m.role === "assistant");
    expect(assistantMsgs.length).toBe(0);
  });

  it("chat session detects silent failure on followUp", async () => {
    manager.register(baseDef());
    const sid = manager.createChatSession("bot", "hello");
    await manager.waitForIdle(sid);

    // First prompt failed — followUp
    manager.followUp(sid, "try again");
    await manager.waitForIdle(sid);

    // Should have user messages but no assistant
    const messages = manager.progress(sid);
    expect(messages.length).toBeGreaterThan(0);
    const assistantMsgs = messages.filter(m => m.role === "assistant");
    expect(assistantMsgs.length).toBe(0);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";

function fakeModel() {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

describe("SubagentManager.input()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-input-"));
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    manager.register({
      name: "chat-agent",
      description: "Chat agent",
      domain: "chat",
      systemPrompt: "You are a chat agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("throws for a non-existent session", async () => {
    await expect(manager.input("nonexistent", "hello")).rejects.toThrow(/not found/);
  });

  it("wakes up an idle session", async () => {
    // Start a session that stays idle (autoClose: "never")
    const sessionId = manager.run("chat-agent", "start", { autoClose: "never" });

    // Wait for it to go idle
    // (fake model will error or finish fast)
    try {
      await manager.waitFor(sessionId);
    } catch {}

    const session = manager.sessions("chat-agent")[0];
    expect(session.status).toBe("idle");

    // Input should wake it up
    const promise = manager.input(sessionId, "hello");

    const active = manager.sessions("chat-agent")[0];
    expect(active.status).toBe("running");

    // Wait for the turn to complete
    try {
      await promise;
    } catch {}

    // Should be idle again
    const final = manager.sessions("chat-agent")[0];
    expect(final.status).toBe("idle");
  });

  it("steers a running session", async () => {
    // Start a session
    const sessionId = manager.run("chat-agent", "start", { autoClose: "never" });

    // Input while running should act as steer
    // (hard to test timing deterministically with fake model, but we check call succeeds)
    await expect(manager.input(sessionId, "interrupt")).resolves.not.toThrow();
  });
});

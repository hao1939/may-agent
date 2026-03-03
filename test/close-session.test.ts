import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/manager.js";
import type { SubagentDefinition } from "../src/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";

function fakeModel(): Model<any> {
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

function baseDef(overrides: Partial<SubagentDefinition> = {}): SubagentDefinition {
  return {
    name: "bot",
    description: "test",
    domain: "test",
    systemPrompt: "You are a test bot.",
    model: fakeModel(),
    tools: [],
    persistent: true,
    ...overrides,
  };
}

describe("close persistent session (cancel → no resume)", () => {
  let dir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "close-session-test-"));
    manager = new SubagentManager({ persistDir: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("cancel on idle persistent session archives it to history", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");

    // Close = cancel the persistent session
    manager.cancel(sid);

    // Session removed from active
    expect(manager.getSessionCount()).toBe(0);

    // Session archived to history
    const historyPath = join(dir, "sessions", "history", sid, "session.jsonl");
    expect(existsSync(historyPath)).toBe(true);
  });

  it("cancel on idle persistent session sets registry status to interrupted", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.cancel(sid);

    const registry = JSON.parse(readFileSync(join(dir, "registry.json"), "utf-8"));
    expect(registry.sessions[sid].status).toBe("interrupted");
  });

  it("resumeAgent throws after cancel (no session to resume)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    // Close the session
    manager.cancel(sid);

    // Simulate restart: new manager with same persistDir
    const manager2 = new SubagentManager({ persistDir: dir });
    manager2.register(baseDef());

    expect(() => manager2.resumeAgent("bot")).toThrow(
      'No running/idle session for "bot" in registry'
    );
  });

  it("resumeAgent finds idle session when NOT cancelled (normal exit)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    // Do NOT cancel — simulate normal exit (session stays idle in registry)

    // Simulate restart: new manager with same persistDir
    const manager2 = new SubagentManager({ persistDir: dir });
    manager2.register(baseDef());

    const result = manager2.resumeAgent("bot");
    expect(result).not.toBeNull();
    expect(result!.resumed).not.toBeNull();
    expect(result!.resumed!.sessionId).toBe(sid);

    // Clean up the resumed session
    await manager2.waitFor(sid);
  });

  it("send throws after cancel (session is gone)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.cancel(sid);

    await expect(manager.send(sid, "more")).rejects.toThrow();
  });

  it("cancel is idempotent on already-cancelled session", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.cancel(sid);
    // Second cancel should be a no-op (session already gone)
    manager.cancel(sid);

    expect(manager.getSessionCount()).toBe(0);
  });

  it("multiple persistent sessions: cancel one, other still resumes", async () => {
    manager.register(baseDef({ name: "bot-a" }));
    manager.register(baseDef({ name: "bot-b" }));

    const sidA = manager.run("bot-a", "task A");
    await manager.waitForIdle(sidA);

    const sidB = manager.run("bot-b", "task B");
    await manager.waitForIdle(sidB);

    // Close only bot-a
    manager.cancel(sidA);

    // Simulate restart
    const manager2 = new SubagentManager({ persistDir: dir });
    manager2.register(baseDef({ name: "bot-a" }));
    manager2.register(baseDef({ name: "bot-b" }));

    // bot-a should not resume (throws)
    expect(() => manager2.resumeAgent("bot-a")).toThrow(
      'No running/idle session for "bot-a"'
    );

    // bot-b should still resume
    const resultB = manager2.resumeAgent("bot-b");
    expect(resultB.resumed.sessionId).toBe(sidB);
    await manager2.waitFor(sidB);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/manager.js";
import type { SubagentDefinition } from "../src/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { readSessionMeta, writeSessionMeta } from "../src/persistence.js";

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

describe("persistent sessions", () => {
  let dir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "persistent-test-"));
    manager = new SubagentManager({ persistDir: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("transitions to idle after run() completes (even on error)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    const sessions = manager.status();
    expect(sessions.length).toBe(1);
    expect(sessions[0].status).toBe("idle");
  });

  it("stays in activeSessions after going idle", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    expect(manager.getSessionCount()).toBe(1);
    const sessions = manager.status();
    expect(sessions[0].sessionId).toBe(sid);
  });

  it("does not archive persistent session on completion", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    const historyPath = join(dir, "sessions", "history", sid);
    expect(existsSync(historyPath)).toBe(false);
  });

  it("registry shows idle status", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    const meta = readSessionMeta(dir, sid);
    expect(meta!.status).toBe("idle");
  });

  it("send() wakes an idle session and returns to idle", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "first");
    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");

    // Send another message — should wake, process, return to idle
    await manager.send(sid, "second");
    expect(manager.status()[0].status).toBe("idle");
  });

  it("send() throws on non-persistent session", async () => {
    manager.register(baseDef({ persistent: false }));

    const sid = manager.run("bot", "hello");
    // Wait for the non-persistent session to complete and be archived
    try { await manager.waitFor(sid); } catch { /* error expected */ }

    // Session is gone from activeSessions
    await expect(manager.send(sid, "more")).rejects.toThrow("not found");
  });

  it("send() throws on missing session", async () => {
    manager.register(baseDef());
    await expect(manager.send("nonexistent", "hi")).rejects.toThrow("not found");
  });

  it("cancel() works on idle persistent session", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.cancel(sid);

    // Session should be removed from active
    expect(manager.getSessionCount()).toBe(0);
  });

  it("cancel() on idle session marks as interrupted in registry", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.cancel(sid);

    const meta = readSessionMeta(dir, sid);
    expect(meta!.status).toBe("interrupted");
  });

  it("send() throws after cancel", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.cancel(sid);

    await expect(manager.send(sid, "more")).rejects.toThrow("not found");
  });

  it("waitForIdle() resolves immediately if already idle", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    // Second call should resolve immediately
    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");
  });

  it("waitForIdle() throws on missing session", async () => {
    manager.register(baseDef());
    await expect(manager.waitForIdle("nonexistent")).rejects.toThrow("not found");
  });

  it("cleanupStaleSessions marks idle sessions as interrupted", () => {
    manager.register(baseDef());

    // Write a stale idle session directly as meta.json
    writeSessionMeta(dir, "stale_idle_1", {
      agent: "bot",
      task: "old task",
      status: "idle",
      startedAt: Date.now() - 60000,
    });

    // Re-create manager to pick up the stale session
    const manager2 = new SubagentManager({ persistDir: dir });
    manager2.register(baseDef());

    const cleaned = manager2.cleanupStaleSessions();
    expect(cleaned.length).toBe(1);
    expect(cleaned[0].sessionId).toBe("stale_idle_1");
    expect(cleaned[0].status).toBe("interrupted");
  });

  it("resumeAgent picks up idle sessions", () => {
    manager.register(baseDef());

    // Write a stale idle session as meta.json
    writeSessionMeta(dir, "idle_session_1", {
      agent: "bot",
      task: "previous task",
      status: "idle",
      startedAt: Date.now() - 60000,
    });

    // Re-create manager
    const manager2 = new SubagentManager({ persistDir: dir });
    manager2.register(baseDef());

    const result = manager2.resumeAgent("bot");
    expect(result.resumed).not.toBeNull();
    expect(result.resumed.sessionId).toBe("idle_session_1");
  });

  it("multiple send() calls accumulate context", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "first");
    await manager.waitForIdle(sid);

    await manager.send(sid, "second");
    await manager.send(sid, "third");

    // Session should still be idle and in active list
    expect(manager.status()[0].status).toBe("idle");
    expect(manager.getSessionCount()).toBe(1);
  });

  it("non-persistent session is removed after completion", async () => {
    manager.register(baseDef({ name: "ephemeral", persistent: false }));

    const sid = manager.run("ephemeral", "hello");
    try { await manager.waitFor(sid); } catch { /* error expected */ }

    // Should be archived and removed
    expect(manager.getSessionCount()).toBe(0);
  });
});

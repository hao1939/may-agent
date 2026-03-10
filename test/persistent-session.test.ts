import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/lib/manager.js";
import type { SubagentDefinition } from "../src/lib/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { readSessionMeta, writeSessionMeta } from "../src/lib/persistence.js";

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

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    const sessions = manager.status();
    expect(sessions.length).toBe(1);
    expect(sessions[0].status).toBe("idle");
  });

  it("stays in activeSessions after going idle", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    expect(manager.getSessionCount()).toBe(1);
    const sessions = manager.status();
    expect(sessions[0].sessionId).toBe(sid);
  });

  it("does not archive persistent session on completion", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    const historyPath = join(dir, "sessions", "history", sid);
    expect(existsSync(historyPath)).toBe(false);
  });

  it("registry shows idle status", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    const meta = readSessionMeta(dir, sid);
    expect(meta!.status).toBe("idle");
  });

  it("followUp() wakes an idle session and returns to idle", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "first", { autoClose: "never" });
    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");

    // followUp another message — should wake, process, return to idle
    manager.followUp(sid, "second");
    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");
  });

  it("followUp() throws on missing session", async () => {
    manager.register(baseDef());
    expect(() => manager.followUp("nonexistent", "hi")).toThrow("not found");
  });

  it("cancel() on idle persistent session keeps it alive (goes back to idle)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    manager.cancel(sid);

    // Session should still be in active sessions
    expect(manager.getSessionCount()).toBe(1);
    expect(manager.status()[0].status).toBe("idle");
  });

  it("cancel() on idle persistent session preserves idle status in registry", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    manager.cancel(sid);

    const meta = readSessionMeta(dir, sid);
    expect(meta!.status).toBe("idle");
  });

  it("followUp() works after cancel on persistent session (session still alive)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    manager.cancel(sid);

    // Session is still alive — followUp should work
    manager.followUp(sid, "more");
    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");
  });

  it("close() removes persistent session from active", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    manager.close(sid);

    expect(manager.getSessionCount()).toBe(0);
  });

  it("close() marks persistent session as interrupted in registry", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    manager.close(sid);

    const meta = readSessionMeta(dir, sid);
    expect(meta!.status).toBe("interrupted");
  });

  it("followUp() throws after close (session is gone)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
    await manager.waitForIdle(sid);

    manager.close(sid);

    expect(() => manager.followUp(sid, "more")).toThrow("not found");
  });

  it("waitForIdle() resolves immediately if already idle", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello", { autoClose: "never" });
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

    const result = manager2.resumeAgent("bot", { autoClose: "never" });
    expect(result.resumed).not.toBeNull();
    expect(result.resumed.sessionId).toBe("idle_session_1");
  });

  it("multiple followUp() calls accumulate context", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "first", { autoClose: "never" });
    await manager.waitForIdle(sid);

    manager.followUp(sid, "second");
    await manager.waitForIdle(sid);

    manager.followUp(sid, "third");
    await manager.waitForIdle(sid);

    // Session should still be idle and in active list
    expect(manager.status()[0].status).toBe("idle");
    expect(manager.getSessionCount()).toBe(1);
  });

  it("non-persistent session is removed after completion", async () => {
    manager.register(baseDef({ name: "ephemeral" }));

    const sid = manager.run("ephemeral", "hello");
    try { await manager.waitFor(sid); } catch { /* error expected */ }

    // Should be archived and removed
    expect(manager.getSessionCount()).toBe(0);
  });
});

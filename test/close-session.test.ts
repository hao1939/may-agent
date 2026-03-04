import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/manager.js";
import type { SubagentDefinition } from "../src/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { readSessionMeta } from "../src/persistence.js";

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

describe("close persistent session (close → no resume)", () => {
  let dir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "close-session-test-"));
    manager = new SubagentManager({ persistDir: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("close on idle persistent session archives it to history", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");

    manager.close(sid);

    // Session removed from active
    expect(manager.getSessionCount()).toBe(0);

    // Session archived to history
    const historyPath = join(dir, "sessions", "history", sid, "session.jsonl");
    expect(existsSync(historyPath)).toBe(true);
  });

  it("close on idle persistent session sets registry status to interrupted", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.close(sid);

    const meta = readSessionMeta(dir, sid);
    expect(meta!.status).toBe("interrupted");
  });

  it("resumeAgent throws after close (no session to resume)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.close(sid);

    // Simulate restart: new manager with same persistDir
    const manager2 = new SubagentManager({ persistDir: dir });
    manager2.register(baseDef());

    expect(() => manager2.resumeAgent("bot")).toThrow(
      'No running/idle session for "bot" in registry'
    );
  });

  it("resumeAgent finds idle session when NOT closed (normal exit)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    // Do NOT close — simulate normal exit (session stays idle in registry)

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

  it("followUp throws after close (session is gone)", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.close(sid);

    expect(() => manager.followUp(sid, "more")).toThrow("not found");
  });

  it("close is idempotent on already-closed session", async () => {
    manager.register(baseDef());

    const sid = manager.run("bot", "hello");
    await manager.waitForIdle(sid);

    manager.close(sid);
    // Second close should be a no-op (session already gone)
    manager.close(sid);

    expect(manager.getSessionCount()).toBe(0);
  });

  it("multiple persistent sessions: close one, other still resumes", async () => {
    manager.register(baseDef({ name: "bot-a" }));
    manager.register(baseDef({ name: "bot-b" }));

    const sidA = manager.run("bot-a", "task A");
    await manager.waitForIdle(sidA);

    const sidB = manager.run("bot-b", "task B");
    await manager.waitForIdle(sidB);

    // Close only bot-a
    manager.close(sidA);

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

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import { sessionDir, historyDir } from "../../src/lib/persistence.js";
import type { Model } from "@earendil-works/pi-ai";

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

describe("session archival on completion", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-archive-"));
    manager = new SubagentManager({ persistDir });

    manager.register({
      name: "echo-agent",
      description: "Test agent",
      domain: "test",
      systemPrompt: "You are a test agent.",
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

  it("removes session from activeSessions on completion and persists data", async () => {
    const sessionId = manager.run("echo-agent", "task");
    await manager.waitFor(sessionId);

    // Session data is archived to sessions/history/<id>/ after completion
    const sessDir = sessionDir(persistDir, sessionId);
    expect(existsSync(sessDir)).toBe(false); // no longer in active dir

    const archivedDir = join(historyDir(persistDir), sessionId);
    expect(existsSync(archivedDir)).toBe(true); // moved to history

    // Not in activeSessions (getSessionCount reflects only running sessions)
    expect(manager.getSessionCount()).toBe(0);
  });

  it("result() works for archived sessions via persistence", async () => {
    const sessionId = manager.run("echo-agent", "task");
    await manager.waitFor(sessionId);

    // result() reads from archive
    const result = manager.result(sessionId);
    expect(result.sessionId).toBe(sessionId);
    expect(["done", "error"]).toContain(result.status); // fake model may succeed or fail
  });

  it("progress() works for archived sessions via persistence", async () => {
    const sessionId = manager.run("echo-agent", "task");
    await manager.waitFor(sessionId);

    // progress() reads from archived JSONL
    const messages = manager.progress(sessionId);
    expect(messages.length).toBeGreaterThan(0);
  });

  it("waitFor() returns result for already-completed sessions via persistence", async () => {
    const sessionId = manager.run("echo-agent", "task");
    const result1 = await manager.waitFor(sessionId);

    // Call waitFor again — session is already archived
    const result2 = await manager.waitFor(sessionId);
    expect(result2.sessionId).toBe(result1.sessionId);
    expect(result2.status).toBe(result1.status);
  });
});

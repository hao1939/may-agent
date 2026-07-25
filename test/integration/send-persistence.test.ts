import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import { sessionDir } from "../../src/lib/persistence.js";
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

describe("terminal session persistence", () => {
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

    const sessDir = sessionDir(persistDir, sessionId);
    expect(existsSync(sessDir)).toBe(true);
    expect(existsSync(join(sessDir, "[ACTIVE]"))).toBe(false);

    // Not in activeSessions (getSessionCount reflects only running sessions)
    expect(manager.getSessionCount()).toBe(0);
    expect((manager as any).results.size).toBe(0);
  });

  it("result() works for terminal sessions via persistence", async () => {
    const sessionId = manager.run("echo-agent", "task");
    await manager.waitFor(sessionId);

    // result() reads from the permanent session directory.
    const result = manager.result(sessionId);
    expect(result.sessionId).toBe(sessionId);
    expect(["done", "error"]).toContain(result.status); // fake model may succeed or fail
  });

  it("progress() works for terminal sessions via persistence", async () => {
    const sessionId = manager.run("echo-agent", "task");
    await manager.waitFor(sessionId);

    // progress() reads from the permanent JSONL.
    const messages = manager.progress(sessionId);
    expect(messages.length).toBeGreaterThan(0);
  });

  it("waitFor() returns result for already-completed sessions via persistence", async () => {
    const sessionId = manager.run("echo-agent", "task");
    const result1 = await manager.waitFor(sessionId);

    // Call waitFor again after the session is terminal.
    const result2 = await manager.waitFor(sessionId);
    expect(result2.sessionId).toBe(result1.sessionId);
    expect(result2.status).toBe(result1.status);
  });

  it("bounds completed message histories retained in memory", () => {
    for (let index = 0; index < 20; index++) {
      (manager as any).rememberCompletedResult({
        sessionId: `completed-${index}`,
        status: "done",
        lastAssistantText: "done",
        messages: [],
        duration: "1s",
        outputDir: persistDir,
      });
    }

    expect((manager as any).completedResults.size).toBe(16);
    expect((manager as any).completedResults.has("completed-0")).toBe(false);
    expect((manager as any).completedResults.has("completed-19")).toBe(true);
  });
});

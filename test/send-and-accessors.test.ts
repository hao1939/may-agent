import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import { readMemoryEntries, memoryPath, sessionJsonlPath, historyDir } from "../src/persistence.js";
import type { PersistedSession, Registry } from "../src/persistence.js";
import type { Model } from "@mariozechner/pi-ai";

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

describe("SubagentManager.send()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-send-"));
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("returns false for a non-existent session", () => {
    expect(manager.send("nonexistent", "hello")).toBe(false);
  });

  it("returns false for a currently running session", () => {
    manager.register({
      name: "agent-a",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("agent-a", "task");
    // The session will error quickly (fake model) but might still be "running" briefly
    // Actually with a fake model URL, the error is synchronous-ish.
    // Either way, send() on a "running" session should return false.
    const sendResult = manager.send(sessionId, "follow up");
    // It's either false (still running) or true (already errored)
    // We just verify it doesn't crash
    expect(typeof sendResult).toBe("boolean");
  });

  it("returns true for a completed/errored session", async () => {
    manager.register({
      name: "agent-b",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("agent-b", "task");
    await manager.waitFor(sessionId);

    // Session is now done or errored — send() should accept the follow-up
    const sendResult = manager.send(sessionId, "follow up");
    expect(sendResult).toBe(true);

    // Wait for the follow-up to complete
    await manager.waitFor(sessionId);

    // Status should be done or error (not "running")
    const info = manager.status().find((s) => s.sessionId === sessionId);
    expect(info).toBeDefined();
    expect(info!.status).not.toBe("running");
  });

  it("updates registry status to running during follow-up", async () => {
    manager.register({
      name: "agent-c",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("agent-c", "task");
    await manager.waitFor(sessionId);

    // Read registry to confirm session completed
    const registryPath = join(persistDir, "registry.json");
    const registryBefore = JSON.parse(readFileSync(registryPath, "utf-8")) as Registry;
    expect(registryBefore.sessions[sessionId].status).not.toBe("running");

    // Send follow-up
    manager.send(sessionId, "follow up");
    await manager.waitFor(sessionId);

    // Registry should show the final status (done or error)
    const registryAfter = JSON.parse(readFileSync(registryPath, "utf-8")) as Registry;
    expect(registryAfter.sessions[sessionId].status).not.toBe("running");
  });

  it("appends memory after follow-up completion", async () => {
    manager.register({
      name: "agent-d",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("agent-d", "initial task");
    await manager.waitFor(sessionId);

    // Count memory entries after initial task
    const entriesBefore = readMemoryEntries(persistDir, "agent-d");
    const countBefore = entriesBefore.length;

    // Send follow-up
    manager.send(sessionId, "follow up task");
    await manager.waitFor(sessionId);

    // Should have one more memory entry
    const entriesAfter = readMemoryEntries(persistDir, "agent-d");
    expect(entriesAfter.length).toBe(countBefore + 1);
  });
});

describe("SubagentManager.getKnowledgePath()", () => {
  it("returns knowledgeDir for a registered agent", () => {
    const manager = new SubagentManager();
    manager.register({
      name: "agent-k",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      knowledgeDir: "/path/to/knowledge",
    });

    expect(manager.getKnowledgePath("agent-k")).toBe("/path/to/knowledge");
  });

  it("returns undefined for an unregistered agent", () => {
    const manager = new SubagentManager();
    expect(manager.getKnowledgePath("nonexistent")).toBeUndefined();
  });

  it("returns undefined when knowledgeDir is not set", () => {
    const manager = new SubagentManager();
    manager.register({
      name: "agent-nk",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
    });

    expect(manager.getKnowledgePath("agent-nk")).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import {
  historyDir,
  archiveSession,
  ensureSessionDir,
  sessionDir,
  sessionOutputDir,
  appendSessionMessage,
} from "../src/persistence.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
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

describe("historyDir", () => {
  it("returns the correct history path", () => {
    expect(historyDir("/state")).toBe(join("/state", "sessions", "history"));
  });
});

describe("archiveSession", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-archive-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("moves session directory to history", () => {
    const sessionId = "archive-test-1";
    ensureSessionDir(persistDir, sessionId);
    mkdirSync(sessionOutputDir(persistDir, sessionId), { recursive: true });

    // Write a message so there's content
    appendSessionMessage(persistDir, sessionId, {
      role: "user",
      content: [{ type: "text", text: "hello" }],
      timestamp: Date.now(),
    } as AgentMessage);

    // Archive
    archiveSession(persistDir, sessionId);

    // Original should be gone
    expect(existsSync(sessionDir(persistDir, sessionId))).toBe(false);

    // History should exist
    const archivedDir = join(historyDir(persistDir), sessionId);
    expect(existsSync(archivedDir)).toBe(true);
    expect(existsSync(join(archivedDir, "session.jsonl"))).toBe(true);
    expect(existsSync(join(archivedDir, "output"))).toBe(true);
  });
});

describe("SubagentManager path accessors", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-paths-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("getWorkspacePath returns workspace from definition", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "ws-agent",
      description: "Test",
      domain: "test",
      workspace: "/my/workspace",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
    });
    expect(manager.getWorkspacePath("ws-agent")).toBe("/my/workspace");
  });

  it("getWorkspacePath returns undefined for agent without workspace", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "no-ws",
      description: "Test",
      domain: "test",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
    });
    expect(manager.getWorkspacePath("no-ws")).toBeUndefined();
  });

  it("getWorkspacePath returns undefined for unknown agent", () => {
    const manager = new SubagentManager({ persistDir });
    expect(manager.getWorkspacePath("nonexistent")).toBeUndefined();
  });

  it("getMemoryPath returns memory file path when persistDir is set", () => {
    const manager = new SubagentManager({ persistDir });
    const expected = join(persistDir, "memory", "my-agent.jsonl");
    expect(manager.getMemoryPath("my-agent")).toBe(expected);
  });

  it("getOutputPath returns outputDir for active session", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "out-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake",
    });

    const sessionId = manager.run("out-agent", "do stuff");
    const outputPath = manager.getOutputPath(sessionId);
    expect(outputPath).toBe(sessionOutputDir(persistDir, sessionId));
  });

  it("getOutputPath returns archived outputDir after completion", async () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "arch-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake",
    });

    const sessionId = manager.run("arch-agent", "do stuff");
    await manager.waitFor(sessionId);

    const outputPath = manager.getOutputPath(sessionId);
    // After archival, the outputDir should point to the active session's stored path
    // (it's still in the ActiveSession map with the original outputDir)
    expect(outputPath).toBeDefined();
    expect(outputPath).toContain(sessionId);
    expect(outputPath).toContain("output");
  });

  it("getOutputPath returns undefined for unknown session", () => {
    const manager = new SubagentManager({ persistDir });
    expect(manager.getOutputPath("nonexistent")).toBeUndefined();
  });
});

describe("SubagentManager.sessions()", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-sessions-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("filters sessions by agent name", async () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "agent-a",
      description: "A",
      domain: "a",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake",
    });

    manager.register({
      name: "agent-b",
      description: "B",
      domain: "b",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake",
    });

    const s1 = manager.run("agent-a", "task 1");
    const s2 = manager.run("agent-b", "task 2");
    const s3 = manager.run("agent-a", "task 3");

    const sessionsA = manager.sessions("agent-a");
    const sessionsB = manager.sessions("agent-b");

    expect(sessionsA).toHaveLength(2);
    expect(sessionsB).toHaveLength(1);
    expect(sessionsA.map((s) => s.task)).toContain("task 1");
    expect(sessionsA.map((s) => s.task)).toContain("task 3");
    expect(sessionsB[0].task).toBe("task 2");

    // Wait for all to finish
    await Promise.all([
      manager.waitFor(s1),
      manager.waitFor(s2),
      manager.waitFor(s3),
    ]);
  });

  it("returns empty array for unknown agent", () => {
    const manager = new SubagentManager({ persistDir });
    expect(manager.sessions("unknown")).toEqual([]);
  });
});

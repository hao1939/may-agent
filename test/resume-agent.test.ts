import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import {
  ensureSessionDir,
  appendSessionMessage,
  sessionOutputDir,
  archiveSession,
  writeSessionMeta,
  readSessionMeta,
} from "../src/persistence.js";
import type { PersistedSession } from "../src/persistence.js";
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

function userMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function assistantMessage(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

/** Write per-session meta.json files to simulate a previous process's state. */
function writeRegistryState(persistDir: string, sessions: Record<string, PersistedSession>): void {
  mkdirSync(persistDir, { recursive: true });
  for (const [sid, meta] of Object.entries(sessions)) {
    writeSessionMeta(persistDir, sid, meta);
  }
}

/** Helper to set up a session directory with optional messages. */
function setupSession(persistDir: string, sessionId: string, messages?: AgentMessage[]): void {
  ensureSessionDir(persistDir, sessionId);
  mkdirSync(sessionOutputDir(persistDir, sessionId), { recursive: true });
  if (messages) {
    for (const msg of messages) {
      appendSessionMessage(persistDir, sessionId, msg);
    }
  }
}

// ── resumeAgent() ──────────────────────────────────────────────────────

describe("SubagentManager.resumeAgent()", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-resume-agent-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("resumes only the named agent and interrupts all other running sessions", async () => {
    const startedAtA = Date.now() - 30000;
    const startedAtB = Date.now() - 20000;
    const startedAtC = Date.now() - 10000;
    const startedAtDone = Date.now() - 60000;
    const startedAtError = Date.now() - 50000;

    writeRegistryState(persistDir, {
      "session-a": {
        agent: "agent-a",
        task: "task A",
        status: "running",
        startedAt: startedAtA,
      },
      "session-b": {
        agent: "agent-b",
        task: "task B",
        status: "running",
        startedAt: startedAtB,
      },
      "session-c": {
        agent: "agent-c",
        task: "task C",
        status: "running",
        startedAt: startedAtC,
      },
      "session-done": {
        agent: "agent-a",
        task: "done task",
        status: "done",
        startedAt: startedAtDone,
        endedAt: startedAtDone + 5000,
      },
      "session-error": {
        agent: "agent-b",
        task: "error task",
        status: "error",
        startedAt: startedAtError,
        endedAt: startedAtError + 3000,
        error: "some error",
      },
    });

    // Set up session dirs for running sessions
    setupSession(persistDir, "session-a", [
      userMessage("task A"),
      assistantMessage("Working on A..."),
    ]);
    setupSession(persistDir, "session-b");
    setupSession(persistDir, "session-c");

    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "agent-a",
      description: "Agent A",
      domain: "test",
      systemPrompt: "You are agent A.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
    manager.register({
      name: "agent-b",
      description: "Agent B",
      domain: "test",
      systemPrompt: "You are agent B.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
    manager.register({
      name: "agent-c",
      description: "Agent C",
      domain: "test",
      systemPrompt: "You are agent C.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const result = manager.resumeAgent("agent-a");

    // Should have a result
    expect(result).not.toBeNull();

    // Verify resumed session — full shape validation
    const { resumed, interrupted } = result!;
    expect(resumed).not.toBeNull();
    expect(resumed!.sessionId).toBe("session-a");
    expect(resumed!.agent).toBe("agent-a");
    expect(resumed!.task).toBe("task A");
    expect(resumed!.status).toBe("running");
    expect(resumed!.startedAt).toBe(startedAtA);
    expect(resumed!.outputDir).toBe(sessionOutputDir(persistDir, "session-a"));
    expect(resumed!.runtime).toMatch(/^\d+s$|^\d+m\d+s$/);
    expect(resumed!.error).toBeUndefined(); // running session should have no error

    // Verify interrupted sessions — should contain only the other running sessions
    expect(interrupted).toHaveLength(2);
    const interruptedIds = interrupted.map((s) => s.sessionId).sort();
    expect(interruptedIds).toEqual(["session-b", "session-c"]);

    for (const info of interrupted) {
      expect(info.status).toBe("interrupted");
      expect(info.error).toBe("Process restarted");
      expect(info.outputDir).toBe(sessionOutputDir(persistDir, info.sessionId));
      expect(info.runtime).toMatch(/^\d+s$|^\d+m\d+s$/);
      expect(info.endedAt).toBeDefined();
    }

    // Verify done/error sessions are NOT in interrupted
    const interruptedAgentTasks = interrupted.map((s) => s.task);
    expect(interruptedAgentTasks).not.toContain("done task");
    expect(interruptedAgentTasks).not.toContain("error task");

    // Verify on disk: other running sessions are marked interrupted
    const metaB = readSessionMeta(persistDir, "session-b");
    expect(metaB!.status).toBe("interrupted");
    expect(metaB!.error).toBe("Process restarted");
    const metaC = readSessionMeta(persistDir, "session-c");
    expect(metaC!.status).toBe("interrupted");
    expect(metaC!.error).toBe("Process restarted");
    // done/error sessions should be untouched
    const metaDone = readSessionMeta(persistDir, "session-done");
    expect(metaDone!.status).toBe("done");
    const metaError = readSessionMeta(persistDir, "session-error");
    expect(metaError!.status).toBe("error");
    expect(metaError!.error).toBe("some error");

    // Wait for resumed session to complete (will error because fake model)
    await manager.waitFor("session-a");
  });

  it("throws when target not found but other running sessions exist (and interrupts them)", () => {
    writeRegistryState(persistDir, {
      "session-b": {
        agent: "agent-b",
        task: "task B",
        status: "running",
        startedAt: Date.now() - 10000,
      },
    });
    setupSession(persistDir, "session-b");

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "agent-b",
      description: "Agent B",
      domain: "test",
      systemPrompt: "You are agent B.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    expect(() => manager.resumeAgent("nonexistent-agent")).toThrow(
      'No running/idle session for "nonexistent-agent" in registry'
    );

    // Other sessions should NOT be interrupted (resumeAgent failed before reaching that point)
    const metaB = readSessionMeta(persistDir, "session-b");
    expect(metaB!.status).toBe("running");
  });

  it("throws when no running sessions at all for any agent", () => {
    writeRegistryState(persistDir, {
      "session-done": {
        agent: "agent-a",
        task: "done task",
        status: "done",
        startedAt: Date.now() - 60000,
        endedAt: Date.now() - 55000,
      },
    });

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "agent-a",
      description: "Agent A",
      domain: "test",
      systemPrompt: "You are agent A.",
      model: fakeModel(),
      tools: [],
    });

    expect(() => manager.resumeAgent("agent-a")).toThrow(
      'No running/idle session for "agent-a" in registry'
    );
  });

  it("throws when agent has no running sessions", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    expect(() => manager.resumeAgent("x")).toThrow(
      'No running/idle session for "x" in registry'
    );
  });

  it("throws and marks session interrupted when agent is not registered", () => {
    writeRegistryState(persistDir, {
      "session-x": {
        agent: "agent-x",
        task: "task X",
        status: "running",
        startedAt: Date.now() - 10000,
      },
    });
    setupSession(persistDir, "session-x");

    const manager = new SubagentManager({ persistDir });
    // Do NOT register agent-x

    expect(() => manager.resumeAgent("agent-x")).toThrow(
      'Agent "agent-x" has session "session-x" in registry but is not registered in this process'
    );

    // Verify session marked interrupted with "Agent not registered" error
    const metaX = readSessionMeta(persistDir, "session-x");
    expect(metaX!.status).toBe("interrupted");
    expect(metaX!.error).toBe("Agent not registered");
  });

  it("resumed session has correct outputDir matching sessionOutputDir()", async () => {
    writeRegistryState(persistDir, {
      "session-out": {
        agent: "output-agent",
        task: "check output",
        status: "running",
        startedAt: Date.now() - 5000,
      },
    });
    setupSession(persistDir, "session-out");

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "output-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const result = manager.resumeAgent("output-agent");
    expect(result).not.toBeNull();
    expect(result!.resumed).not.toBeNull();
    expect(result!.resumed!.outputDir).toBe(sessionOutputDir(persistDir, "session-out"));

    await manager.waitFor("session-out");
  });

  it("resumed session runtime is a properly formatted duration string", async () => {
    writeRegistryState(persistDir, {
      "session-runtime": {
        agent: "runtime-agent",
        task: "check runtime",
        status: "running",
        startedAt: Date.now() - 90000, // 1m30s ago
      },
    });
    setupSession(persistDir, "session-runtime");

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "runtime-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const result = manager.resumeAgent("runtime-agent");
    expect(result).not.toBeNull();
    expect(result!.resumed).not.toBeNull();
    // Started 90 seconds ago, should be "1m30s"
    expect(result!.resumed!.runtime).toMatch(/^\d+m\d+s$/);

    await manager.waitFor("session-runtime");
  });
  it("restores messages from history archive when active JSONL is missing", async () => {
    writeRegistryState(persistDir, {
      "session-archived": {
        agent: "bot",
        task: "archived task",
        status: "idle",
        startedAt: Date.now() - 60000,
      },
    });

    // Set up session with messages, then archive it (simulating previous process)
    setupSession(persistDir, "session-archived", [
      userMessage("original task"),
      assistantMessage("I completed the task."),
    ]);
    archiveSession(persistDir, "session-archived");

    // Verify active dir is gone
    const { existsSync } = await import("node:fs");
    const { sessionDir } = await import("../src/persistence.js");
    expect(existsSync(sessionDir(persistDir, "session-archived"))).toBe(false);

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "bot",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a bot.",
      model: fakeModel(),
      tools: [],
      persistent: true,
      apiKey: "fake-key",
    });

    const result = manager.resumeAgent("bot", { autoClose: "never" });
    expect(result.resumed.sessionId).toBe("session-archived");

    // Verify the active session dir was recreated with the restored JSONL
    expect(existsSync(sessionDir(persistDir, "session-archived"))).toBe(true);

    // Session is idle (nothing to reconcile) — no waitFor needed
  });

});

// ── cleanupStaleSessions() ─────────────────────────────────────────────

describe("SubagentManager.cleanupStaleSessions()", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-cleanup-stale-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("marks all running sessions as interrupted and returns them", () => {
    const startedAtR1 = Date.now() - 30000;
    const startedAtR2 = Date.now() - 15000;
    const startedAtDone = Date.now() - 60000;
    const startedAtError = Date.now() - 50000;

    writeRegistryState(persistDir, {
      "session-r1": {
        agent: "agent-a",
        task: "running task 1",
        status: "running",
        startedAt: startedAtR1,
      },
      "session-r2": {
        agent: "agent-b",
        task: "running task 2",
        status: "running",
        startedAt: startedAtR2,
      },
      "session-done": {
        agent: "agent-a",
        task: "done task",
        status: "done",
        startedAt: startedAtDone,
        endedAt: startedAtDone + 5000,
      },
      "session-error": {
        agent: "agent-b",
        task: "error task",
        status: "error",
        startedAt: startedAtError,
        endedAt: startedAtError + 3000,
        error: "some error",
      },
    });

    const manager = new SubagentManager({ persistDir });
    const cleaned = manager.cleanupStaleSessions();

    // Should return only the previously-running sessions
    expect(cleaned).toHaveLength(2);
    const cleanedIds = cleaned.map((s) => s.sessionId).sort();
    expect(cleanedIds).toEqual(["session-r1", "session-r2"]);

    // Each should have correct fields
    for (const info of cleaned) {
      expect(info.status).toBe("interrupted");
      expect(info.error).toBe("Process restarted");
      expect(info.outputDir).toBe(sessionOutputDir(persistDir, info.sessionId));
      expect(info.runtime).toMatch(/^\d+s$|^\d+m\d+s$/);
      expect(info.endedAt).toBeDefined();
    }

    // Verify specific session fields
    const r1 = cleaned.find((s) => s.sessionId === "session-r1")!;
    expect(r1.agent).toBe("agent-a");
    expect(r1.task).toBe("running task 1");
    expect(r1.startedAt).toBe(startedAtR1);

    const r2 = cleaned.find((s) => s.sessionId === "session-r2")!;
    expect(r2.agent).toBe("agent-b");
    expect(r2.task).toBe("running task 2");
    expect(r2.startedAt).toBe(startedAtR2);

    // Verify on disk: running sessions now interrupted
    const metaR1 = readSessionMeta(persistDir, "session-r1");
    expect(metaR1!.status).toBe("interrupted");
    expect(metaR1!.error).toBe("Process restarted");
    const metaR2 = readSessionMeta(persistDir, "session-r2");
    expect(metaR2!.status).toBe("interrupted");
    expect(metaR2!.error).toBe("Process restarted");

    // Done/error sessions should be untouched
    const metaDone = readSessionMeta(persistDir, "session-done");
    expect(metaDone!.status).toBe("done");
    const metaError = readSessionMeta(persistDir, "session-error");
    expect(metaError!.status).toBe("error");
    expect(metaError!.error).toBe("some error");
  });

  it("returns empty array when no running sessions exist", () => {
    writeRegistryState(persistDir, {
      "session-done": {
        agent: "agent-a",
        task: "done task",
        status: "done",
        startedAt: Date.now() - 60000,
        endedAt: Date.now() - 55000,
      },
      "session-error": {
        agent: "agent-a",
        task: "error task",
        status: "error",
        startedAt: Date.now() - 50000,
        endedAt: Date.now() - 45000,
        error: "something broke",
      },
      "session-interrupted": {
        agent: "agent-a",
        task: "already interrupted",
        status: "interrupted",
        startedAt: Date.now() - 40000,
        endedAt: Date.now() - 35000,
      },
    });

    const manager = new SubagentManager({ persistDir });
    const cleaned = manager.cleanupStaleSessions();
    expect(cleaned).toEqual([]);
  });

  it("returns empty array when no stale sessions exist", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    const cleaned = manager.cleanupStaleSessions();
    expect(cleaned).toEqual([]);
  });

  it("returns empty array when registry has no sessions at all", () => {
    // Empty persistDir — no sessions
    const manager = new SubagentManager({ persistDir });
    const cleaned = manager.cleanupStaleSessions();
    expect(cleaned).toEqual([]);
  });

  it("runtime for sessions started seconds ago is formatted as Xs", () => {
    writeRegistryState(persistDir, {
      "session-short": {
        agent: "agent-a",
        task: "short task",
        status: "running",
        startedAt: Date.now() - 5000, // 5 seconds ago
      },
    });

    const manager = new SubagentManager({ persistDir });
    const cleaned = manager.cleanupStaleSessions();

    expect(cleaned).toHaveLength(1);
    // 5 seconds → "5s" (no minutes component)
    expect(cleaned[0].runtime).toMatch(/^\d+s$/);
  });

  it("runtime for sessions started minutes ago is formatted as XmXs", () => {
    writeRegistryState(persistDir, {
      "session-long": {
        agent: "agent-a",
        task: "long task",
        status: "running",
        startedAt: Date.now() - 125000, // 2m5s ago
      },
    });

    const manager = new SubagentManager({ persistDir });
    const cleaned = manager.cleanupStaleSessions();

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].runtime).toMatch(/^\d+m\d+s$/);
  });
});

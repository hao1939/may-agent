import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import {
  ensureSessionDir,
  appendSessionMessage,
  sessionOutputDir,
} from "../src/persistence.js";
import type { Registry } from "../src/persistence.js";
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

/** Write a registry.json directly to simulate a previous process's state. */
function writeRegistry(persistDir: string, registry: Registry): void {
  mkdirSync(persistDir, { recursive: true });
  writeFileSync(join(persistDir, "registry.json"), JSON.stringify(registry, null, 2), "utf-8");
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

    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Agent A",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
        "agent-b": {
          name: "agent-b",
          description: "Agent B",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
        "agent-c": {
          name: "agent-c",
          description: "Agent C",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
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
      },
    };
    writeRegistry(persistDir, registry);

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

    // Verify registry on disk: other running sessions are marked interrupted
    const updatedRegistry: Registry = JSON.parse(
      readFileSync(join(persistDir, "registry.json"), "utf-8"),
    );
    expect(updatedRegistry.sessions["session-b"].status).toBe("interrupted");
    expect(updatedRegistry.sessions["session-b"].error).toBe("Process restarted");
    expect(updatedRegistry.sessions["session-c"].status).toBe("interrupted");
    expect(updatedRegistry.sessions["session-c"].error).toBe("Process restarted");
    // done/error sessions should be untouched
    expect(updatedRegistry.sessions["session-done"].status).toBe("done");
    expect(updatedRegistry.sessions["session-error"].status).toBe("error");
    expect(updatedRegistry.sessions["session-error"].error).toBe("some error");

    // Wait for resumed session to complete (will error because fake model)
    await manager.waitFor("session-a");
  });

  it("returns object with resumed: null and interrupted list when no running session for the named agent but others exist", () => {
    const registry: Registry = {
      agents: {
        "agent-b": {
          name: "agent-b",
          description: "Agent B",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-b": {
          agent: "agent-b",
          task: "task B",
          status: "running",
          startedAt: Date.now() - 10000,
        },
      },
    };
    writeRegistry(persistDir, registry);
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

    const result = manager.resumeAgent("nonexistent-agent");

    // Returns { resumed: null, interrupted } when target not found but others exist
    expect(result).not.toBeNull();
    expect(result!.resumed).toBeNull();
    expect(result!.interrupted).toHaveLength(1);
    expect(result!.interrupted[0].sessionId).toBe("session-b");
    expect(result!.interrupted[0].status).toBe("interrupted");
    expect(result!.interrupted[0].error).toBe("Process restarted");
    expect(result!.interrupted[0].outputDir).toBe(sessionOutputDir(persistDir, "session-b"));

    // Verify the registry marks session-b as interrupted
    const updatedRegistry: Registry = JSON.parse(
      readFileSync(join(persistDir, "registry.json"), "utf-8"),
    );
    expect(updatedRegistry.sessions["session-b"].status).toBe("interrupted");
  });

  it("returns null when no running sessions at all for any agent", () => {
    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Agent A",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-done": {
          agent: "agent-a",
          task: "done task",
          status: "done",
          startedAt: Date.now() - 60000,
          endedAt: Date.now() - 55000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "agent-a",
      description: "Agent A",
      domain: "test",
      systemPrompt: "You are agent A.",
      model: fakeModel(),
      tools: [],
    });

    const result = manager.resumeAgent("agent-a");
    expect(result).toBeNull();
  });

  it("returns null when agent has no running sessions", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    const result = manager.resumeAgent("x");
    expect(result).toBeNull();
  });

  it("returns null and marks session interrupted when agent is not registered", () => {
    const registry: Registry = {
      agents: {
        "agent-x": {
          name: "agent-x",
          description: "Agent X",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-x": {
          agent: "agent-x",
          task: "task X",
          status: "running",
          startedAt: Date.now() - 10000,
        },
      },
    };
    writeRegistry(persistDir, registry);
    setupSession(persistDir, "session-x");

    const manager = new SubagentManager({ persistDir });
    // Do NOT register agent-x

    const result = manager.resumeAgent("agent-x");
    expect(result).toBeNull();

    // Verify session marked interrupted in registry with "Agent not registered" error
    const updatedRegistry: Registry = JSON.parse(
      readFileSync(join(persistDir, "registry.json"), "utf-8"),
    );
    expect(updatedRegistry.sessions["session-x"].status).toBe("interrupted");
    expect(updatedRegistry.sessions["session-x"].error).toBe("Agent not registered");
  });

  it("resumed session has correct outputDir matching sessionOutputDir()", async () => {
    const registry: Registry = {
      agents: {
        "output-agent": {
          name: "output-agent",
          description: "Test",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-out": {
          agent: "output-agent",
          task: "check output",
          status: "running",
          startedAt: Date.now() - 5000,
        },
      },
    };
    writeRegistry(persistDir, registry);
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
    const registry: Registry = {
      agents: {
        "runtime-agent": {
          name: "runtime-agent",
          description: "Test",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-runtime": {
          agent: "runtime-agent",
          task: "check runtime",
          status: "running",
          startedAt: Date.now() - 90000, // 1m30s ago
        },
      },
    };
    writeRegistry(persistDir, registry);
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

    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Agent A",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
        "agent-b": {
          name: "agent-b",
          description: "Agent B",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
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
      },
    };
    writeRegistry(persistDir, registry);

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

    // Verify registry on disk: running sessions now interrupted
    const updatedRegistry: Registry = JSON.parse(
      readFileSync(join(persistDir, "registry.json"), "utf-8"),
    );
    expect(updatedRegistry.sessions["session-r1"].status).toBe("interrupted");
    expect(updatedRegistry.sessions["session-r1"].error).toBe("Process restarted");
    expect(updatedRegistry.sessions["session-r2"].status).toBe("interrupted");
    expect(updatedRegistry.sessions["session-r2"].error).toBe("Process restarted");

    // Done/error sessions should be untouched
    expect(updatedRegistry.sessions["session-done"].status).toBe("done");
    expect(updatedRegistry.sessions["session-error"].status).toBe("error");
    expect(updatedRegistry.sessions["session-error"].error).toBe("some error");
  });

  it("returns empty array when no running sessions exist", () => {
    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Agent A",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
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
      },
    };
    writeRegistry(persistDir, registry);

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
    const registry: Registry = {
      agents: {},
      sessions: {},
    };
    writeRegistry(persistDir, registry);

    const manager = new SubagentManager({ persistDir });
    const cleaned = manager.cleanupStaleSessions();
    expect(cleaned).toEqual([]);
  });

  it("runtime for sessions started seconds ago is formatted as Xs", () => {
    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Agent A",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-short": {
          agent: "agent-a",
          task: "short task",
          status: "running",
          startedAt: Date.now() - 5000, // 5 seconds ago
        },
      },
    };
    writeRegistry(persistDir, registry);

    const manager = new SubagentManager({ persistDir });
    const cleaned = manager.cleanupStaleSessions();

    expect(cleaned).toHaveLength(1);
    // 5 seconds → "5s" (no minutes component)
    expect(cleaned[0].runtime).toMatch(/^\d+s$/);
  });

  it("runtime for sessions started minutes ago is formatted as XmXs", () => {
    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Agent A",
          domain: "test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-long": {
          agent: "agent-a",
          task: "long task",
          status: "running",
          startedAt: Date.now() - 125000, // 2m5s ago
        },
      },
    };
    writeRegistry(persistDir, registry);

    const manager = new SubagentManager({ persistDir });
    const cleaned = manager.cleanupStaleSessions();

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].runtime).toMatch(/^\d+m\d+s$/);
  });
});

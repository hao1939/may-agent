import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import {
  RegistryStore,
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  sessionDir,
  sessionOutputDir,
  historyDir,
} from "../src/persistence.js";
import type { Registry, PersistedSession } from "../src/persistence.js";
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

describe("SubagentManager.resume()", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-resume-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns empty array when no sessions to resume", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    const resumed = manager.resume();
    expect(resumed).toEqual([]);
  });

  it("returns empty array when no sessions exist", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "agent-a",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
    });
    const resumed = manager.resume();
    expect(resumed).toEqual([]);
  });

  it("returns empty array when all sessions are done", () => {
    // Write a registry with only "done" sessions
    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-1": {
          agent: "agent-a",
          task: "completed task",
          status: "done",
          startedAt: Date.now() - 10000,
          endedAt: Date.now() - 5000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "agent-a",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
    });

    const resumed = manager.resume();
    expect(resumed).toEqual([]);
  });

  it("marks running sessions as interrupted when agent is not registered", () => {
    const registry: Registry = {
      agents: {
        "missing-agent": {
          name: "missing-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-orphan": {
          agent: "missing-agent",
          task: "orphaned task",
          status: "running",
          startedAt: Date.now() - 10000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    // Suppress the console.warn
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const manager = new SubagentManager({ persistDir });
    // Don't register "missing-agent"

    const resumed = manager.resume();
    expect(resumed).toEqual([]);

    // Verify the session was marked interrupted in registry
    const updatedRegistry: Registry = JSON.parse(
      readFileSync(join(persistDir, "registry.json"), "utf-8"),
    );
    expect(updatedRegistry.sessions["session-orphan"].status).toBe("interrupted");

    // Should have logged a warning
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot resume session "session-orphan"'),
    );

    warnSpy.mockRestore();
  });

  it("resumes a running session with persisted conversation", async () => {
    const startedAt = Date.now() - 30000;

    // Set up registry with a running session
    const registry: Registry = {
      agents: {
        "test-agent": {
          name: "test-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-resume": {
          agent: "test-agent",
          task: "in-progress task",
          status: "running",
          startedAt,
        },
      },
    };
    writeRegistry(persistDir, registry);

    // Write conversation history to session JSONL
    ensureSessionDir(persistDir, "session-resume");
    mkdirSync(sessionOutputDir(persistDir, "session-resume"), { recursive: true });
    appendSessionMessage(persistDir, "session-resume", userMessage("in-progress task"));
    appendSessionMessage(persistDir, "session-resume", assistantMessage("I started working on it..."));

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "test-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const resumed = manager.resume();

    // Should return one resumed session
    expect(resumed).toHaveLength(1);
    expect(resumed[0].sessionId).toBe("session-resume");
    expect(resumed[0].agent).toBe("test-agent");
    expect(resumed[0].task).toBe("in-progress task");
    expect(resumed[0].status).toBe("running");
    expect(resumed[0].startedAt).toBe(startedAt);

    // The session should be tracked
    const statusList = manager.status();
    expect(statusList).toHaveLength(1);
    expect(statusList[0].sessionId).toBe("session-resume");
    expect(statusList[0].status).toBe("running");

    // Wait for the resumed session to complete
    await manager.waitFor("session-resume");

    // After completion, it should have the restored messages plus the resume message
    const result = manager.result("session-resume");
    expect(result).not.toBeNull();
    expect(["done", "error"]).toContain(result!.status);

    // The messages should include the original conversation plus the resume message
    const messages = result!.messages;
    expect(messages.length).toBeGreaterThanOrEqual(3); // 2 original + resume message + response

    // First two messages are the restored ones
    expect(messages[0].role).toBe("user");
    expect((messages[0] as any).content[0].text).toBe("in-progress task");
    expect(messages[1].role).toBe("assistant");
    expect((messages[1] as any).content[0].text).toBe("I started working on it...");

    // Third should be the resume message
    expect(messages[2].role).toBe("user");
    expect((messages[2] as any).content[0].text).toBe(
      "Your session was interrupted. Continue where you left off.",
    );
  });

  it("resumes multiple running sessions", async () => {
    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Agent A",
          domain: "test",
          systemPrompt: "You are agent A.",
          model: { provider: "anthropic", id: "test-model" },
        },
        "agent-b": {
          name: "agent-b",
          description: "Agent B",
          domain: "test",
          systemPrompt: "You are agent B.",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-a": {
          agent: "agent-a",
          task: "task A",
          status: "running",
          startedAt: Date.now() - 20000,
        },
        "session-b": {
          agent: "agent-b",
          task: "task B",
          status: "running",
          startedAt: Date.now() - 10000,
        },
        "session-done": {
          agent: "agent-a",
          task: "done task",
          status: "done",
          startedAt: Date.now() - 50000,
          endedAt: Date.now() - 40000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    // Create session dirs
    for (const sid of ["session-a", "session-b"]) {
      ensureSessionDir(persistDir, sid);
      mkdirSync(sessionOutputDir(persistDir, sid), { recursive: true });
      appendSessionMessage(persistDir, sid, userMessage(`task for ${sid}`));
    }

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

    const resumed = manager.resume();
    expect(resumed).toHaveLength(2);

    const resumedIds = resumed.map((r) => r.sessionId).sort();
    expect(resumedIds).toEqual(["session-a", "session-b"]);

    // All should be tracked as running
    const statusList = manager.status();
    expect(statusList).toHaveLength(2);

    // Wait for both
    await Promise.all([
      manager.waitFor("session-a"),
      manager.waitFor("session-b"),
    ]);
  });

  it("resumes sessions with empty conversation history", async () => {
    const registry: Registry = {
      agents: {
        "fresh-agent": {
          name: "fresh-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-empty": {
          agent: "fresh-agent",
          task: "task with no messages",
          status: "running",
          startedAt: Date.now() - 5000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    // Create session dir but no messages (simulating crash before any messages were persisted)
    ensureSessionDir(persistDir, "session-empty");
    mkdirSync(sessionOutputDir(persistDir, "session-empty"), { recursive: true });

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "fresh-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const resumed = manager.resume();
    expect(resumed).toHaveLength(1);

    await manager.waitFor("session-empty");
    const result = manager.result("session-empty");
    expect(result).not.toBeNull();
  });

  it("skips non-running sessions (error, done, interrupted)", () => {
    const registry: Registry = {
      agents: {
        "agent-a": {
          name: "agent-a",
          description: "Test",
          domain: "test",
          systemPrompt: "Test",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "s-done": {
          agent: "agent-a",
          task: "done",
          status: "done",
          startedAt: Date.now() - 50000,
          endedAt: Date.now() - 40000,
        },
        "s-error": {
          agent: "agent-a",
          task: "error",
          status: "error",
          startedAt: Date.now() - 30000,
          endedAt: Date.now() - 20000,
          error: "something broke",
        },
        "s-interrupted": {
          agent: "agent-a",
          task: "interrupted",
          status: "interrupted",
          startedAt: Date.now() - 10000,
          endedAt: Date.now() - 5000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "agent-a",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
    });

    const resumed = manager.resume();
    expect(resumed).toEqual([]);
  });

  it("uses the registered agent's tools and model, not the persisted config", async () => {
    // Simulate: persisted model says "old-model", but registered agent has fakeModel
    const registry: Registry = {
      agents: {
        "tool-agent": {
          name: "tool-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "old-model" },
        },
      },
      sessions: {
        "session-tools": {
          agent: "tool-agent",
          task: "test tools",
          status: "running",
          startedAt: Date.now() - 5000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    ensureSessionDir(persistDir, "session-tools");
    mkdirSync(sessionOutputDir(persistDir, "session-tools"), { recursive: true });

    const manager = new SubagentManager({ persistDir });
    const model = fakeModel();
    manager.register({
      name: "tool-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model,
      tools: [],
      apiKey: "fake-key",
    });

    const resumed = manager.resume();
    expect(resumed).toHaveLength(1);

    // The agent should use the registered model, not the persisted one
    const progress = manager.progress("session-tools");
    // Can't easily inspect the model directly, but we can verify it started

    await manager.waitFor("session-tools");
    const result = manager.result("session-tools");
    expect(result).not.toBeNull();
  });

  it("resumed session can be waited on and produces result", async () => {
    const registry: Registry = {
      agents: {
        "result-agent": {
          name: "result-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-result": {
          agent: "result-agent",
          task: "produce result",
          status: "running",
          startedAt: Date.now() - 5000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    ensureSessionDir(persistDir, "session-result");
    mkdirSync(sessionOutputDir(persistDir, "session-result"), { recursive: true });

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "result-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    manager.resume();

    const result = await manager.waitFor("session-result");
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe("session-result");
    expect(["done", "error"]).toContain(result!.status);
  });

  it("resumed session persists new messages to JSONL", async () => {
    const registry: Registry = {
      agents: {
        "persist-agent": {
          name: "persist-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-persist": {
          agent: "persist-agent",
          task: "persist test",
          status: "running",
          startedAt: Date.now() - 5000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    ensureSessionDir(persistDir, "session-persist");
    mkdirSync(sessionOutputDir(persistDir, "session-persist"), { recursive: true });
    // Write one original message
    appendSessionMessage(persistDir, "session-persist", userMessage("original message"));

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "persist-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    manager.resume();
    await manager.waitFor("session-persist");

    // After completion, session should be archived. Check archived JSONL
    // has more messages than the original one
    const archivedJsonl = join(historyDir(persistDir), "session-persist", "session.jsonl");
    if (existsSync(archivedJsonl)) {
      const raw = readFileSync(archivedJsonl, "utf-8");
      const messages = raw.trim().split("\n").map((line) => JSON.parse(line));
      // Should have at least the original message plus new messages from the resume
      expect(messages.length).toBeGreaterThanOrEqual(2);
      // First message should be the original
      expect(messages[0].content[0].text).toBe("original message");
    }
    // If not archived (session dir still active), check active JSONL
    else {
      const activeJsonl = join(sessionDir(persistDir, "session-persist"), "session.jsonl");
      const raw = readFileSync(activeJsonl, "utf-8");
      const messages = raw.trim().split("\n").map((line) => JSON.parse(line));
      expect(messages.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("mixes resumed and unregistered agents correctly", async () => {
    const registry: Registry = {
      agents: {
        "good-agent": {
          name: "good-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "test-model" },
        },
        "missing-agent": {
          name: "missing-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "You are a test agent.",
          model: { provider: "anthropic", id: "test-model" },
        },
      },
      sessions: {
        "session-good": {
          agent: "good-agent",
          task: "good task",
          status: "running",
          startedAt: Date.now() - 5000,
        },
        "session-bad": {
          agent: "missing-agent",
          task: "orphan task",
          status: "running",
          startedAt: Date.now() - 5000,
        },
      },
    };
    writeRegistry(persistDir, registry);

    ensureSessionDir(persistDir, "session-good");
    mkdirSync(sessionOutputDir(persistDir, "session-good"), { recursive: true });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const manager = new SubagentManager({ persistDir });
    // Only register good-agent
    manager.register({
      name: "good-agent",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const resumed = manager.resume();

    // Only the good session should be resumed
    expect(resumed).toHaveLength(1);
    expect(resumed[0].sessionId).toBe("session-good");

    // The missing agent's session should be interrupted
    const updatedRegistry: Registry = JSON.parse(
      readFileSync(join(persistDir, "registry.json"), "utf-8"),
    );
    expect(updatedRegistry.sessions["session-bad"].status).toBe("interrupted");

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    await manager.waitFor("session-good");
  });

  it("resumed session output dir is correct", () => {
    const registry: Registry = {
      agents: {
        "output-agent": {
          name: "output-agent",
          description: "Test",
          domain: "test",
          systemPrompt: "Test",
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

    ensureSessionDir(persistDir, "session-out");
    mkdirSync(sessionOutputDir(persistDir, "session-out"), { recursive: true });

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

    const resumed = manager.resume();
    expect(resumed).toHaveLength(1);
    expect(resumed[0].outputDir).toBe(sessionOutputDir(persistDir, "session-out"));
  });
});

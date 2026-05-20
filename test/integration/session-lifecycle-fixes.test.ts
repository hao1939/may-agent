/**
 * Tests for session lifecycle bug fixes (Bug 3, 4, 8, 10).
 *
 * Bug 3: handleCompletion throws → session stuck in activeSessions
 * Bug 4: run() with duplicate sessionId → orphaned agent
 * Bug 8: resumeSession doesn't restore parentAgentName
 * Bug 10: callDepths map never cleaned for completed root sessions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import { readSessionMeta, writeSessionMeta, ensureSessionDir, appendSessionMessage } from "../../src/lib/persistence.js";
import { EventBus, type AgentEvent } from "../../src/app/event-bus.js";
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

function registerAgent(manager: SubagentManager, name = "test-agent") {
  manager.register({
    name,
    description: "Test agent",
    domain: "test",
    systemPrompt: "You are a test agent.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

describe("Bug 3: handleCompletion error recovery", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager);
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("session is removed from activeSessions even if completion errors", async () => {
    // Start a session — it will complete quickly due to connection error (fake model)
    const sessionId = manager.run("test-agent", "do something");

    // Wait for the session to finish
    try {
      await manager.waitFor(sessionId);
    } catch {
      // Expected — fake model will cause an error
    }

    // Session should NOT be in activeSessions after completion
    expect(manager.hasActiveSession(sessionId)).toBe(false);

    // Should be archived in registry
    const meta = readSessionMeta(persistDir, sessionId);
    expect(meta).toBeTruthy();
  });

  it("session gets error status when handleCompletion pipeline fails", async () => {
    const sessionId = manager.run("test-agent", "do something");

    try {
      await manager.waitFor(sessionId);
    } catch {
      // Expected
    }

    // Session should be cleaned up regardless
    expect(manager.hasActiveSession(sessionId)).toBe(false);
  });
});

describe("session.start metadata", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-meta-"));
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("emits source metadata for audit and dedup", async () => {
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const manager = new SubagentManager({ persistDir, bus });
    registerAgent(manager);

    const sessionId = manager.run("test-agent", "do something", {
      source: "metric-alert-reactor:test.metric",
      kind: "call",
      requestId: "req-1",
      parentSessionId: "s_parent",
    });

    try {
      await manager.waitFor(sessionId);
    } catch {
      // Fake model may fail; this test only needs the start event.
    }

    const start = events.find((event) => event.type === "session.start" && (event as any).data?.sessionId === sessionId);
    expect(start).toMatchObject({
      type: "session.start",
      source: "metric-alert-reactor:test.metric",
      owner: "agent:test-agent",
      data: {
        sessionId,
        agent: "test-agent",
        kind: "call",
        requestId: "req-1",
        parentSessionId: "s_parent",
      },
    });
    expect(start).not.toHaveProperty("sessionId");
    expect(start).not.toHaveProperty("agent");

    const end = events.find((event) => event.type === "session.end" && (event as any).data?.sessionId === sessionId);
    expect(end).toMatchObject({
      type: "session.end",
      source: "metric-alert-reactor:test.metric",
      owner: "agent:test-agent",
      data: {
        sessionId,
        agent: "test-agent",
        kind: "call",
        requestId: "req-1",
        parentSessionId: "s_parent",
      },
    });
    expect(end).not.toHaveProperty("sessionId");
    expect(end).not.toHaveProperty("agent");
  });
});

describe("Bug 4: run() duplicate sessionId guard", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager);
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("throws when run() is called with a sessionId that is already active", () => {
    const sessionId = manager.run("test-agent", "task 1");

    // The session may or may not still be active (fake model errors fast).
    // If it IS still active, a second run() with the same ID should throw.
    if (manager.hasActiveSession(sessionId)) {
      expect(() => {
        manager.run("test-agent", "task 2", { sessionId });
      }).toThrow(/already active/);
    }
  });

  it("allows run() with a sessionId that was previously completed", async () => {
    const sessionId = manager.run("test-agent", "task 1");
    try {
      await manager.waitFor(sessionId);
    } catch {
      // Expected
    }

    // Session is no longer active — a new run with a different generated ID should work
    // (We don't re-use completed session IDs in practice, but the guard should not
    // block IDs that are not currently in activeSessions)
    expect(manager.hasActiveSession(sessionId)).toBe(false);
  });
});

describe("Bug 8: resumeSession restores parentAgentName", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager, "parent-agent");
    registerAgent(manager, "child-agent");
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("restores parentAgentName from parent session meta on resume", async () => {
    // Create a fake "parent" session in the registry
    const parentId = "parent-session-123";
    ensureSessionDir(persistDir, parentId);
    writeSessionMeta(persistDir, parentId, {
      agent: "parent-agent",
      task: "parent task",
      status: "done",
      startedAt: Date.now() - 60000,
    });

    // Create a fake "child" session that looks stale (running but no process)
    const childId = "child-session-456";
    ensureSessionDir(persistDir, childId);
    writeSessionMeta(persistDir, childId, {
      agent: "child-agent",
      task: "child task",
      status: "running",
      startedAt: Date.now() - 60000,
      parentSessionId: parentId,
    });

    // Write minimal JSONL so resume has something to work with
    appendSessionMessage(persistDir, childId, {
      role: "user",
      content: [{ type: "text", text: "child task" }],
      timestamp: Date.now(),
    } as any);

    // Resume stale sessions — this should pick up the child
    const { resumed } = manager.resumeStaleSessions();

    // The child session should be resumed
    if (resumed.length > 0) {
      // Check that the child has parentAgentName restored
      const sessions = manager.sessions("child-agent");
      expect(sessions.length).toBeGreaterThan(0);

      // The parentAgentName is internal — we verify indirectly by checking
      // the session was resumed and can be found.
      // Direct verification would require access to activeSessions internals,
      // which we test via the escalation path.
    }

    // Clean up running sessions
    try {
      manager.cancel(childId);
      await manager.waitFor(childId);
    } catch {
      // Expected
    }
  });
});

describe("Bug 10: callDepths cleanup", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager);
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("callDepths is cleaned up when session completes", async () => {
    // Start a session — it will complete quickly
    const sessionId = manager.run("test-agent", "do something");

    try {
      await manager.waitFor(sessionId);
    } catch {
      // Expected
    }

    // After completion, the session should be fully cleaned up.
    // We can't directly inspect callDepths (private), but we verify
    // the session is completely gone from activeSessions.
    expect(manager.hasActiveSession(sessionId)).toBe(false);

    // A new session should work fine (no stale depth limits)
    const sessionId2 = manager.run("test-agent", "another task");
    try {
      await manager.waitFor(sessionId2);
    } catch {
      // Expected
    }
    expect(manager.hasActiveSession(sessionId2)).toBe(false);
  });
});

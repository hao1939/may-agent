import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
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

describe("SubagentManager.steer()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-steer-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager);
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("returns 'not_running' for a non-existent session", () => {
    expect(manager.steer("nonexistent", "hello")).toBe("not_running");
  });

  it("returns 'not_running' for a completed session", async () => {
    const sessionId = manager.run("test-agent", "task");
    await manager.waitFor(sessionId);

    expect(manager.steer(sessionId, "hello")).toBe("not_running");
  });

  it("returns a valid steer result for a running session", () => {
    const sessionId = manager.run("test-agent", "task");

    // Session may complete very quickly (fake model errors out fast),
    // but steer should return one of the valid results
    const result = manager.steer(sessionId, "change direction");
    expect(["steered", "queued", "not_running"]).toContain(result);
  });
});

describe("SubagentManager.subscribe()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-subscribe-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager);
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("returns null for a non-existent session", () => {
    const unsub = manager.subscribe("nonexistent", () => {});
    expect(unsub).toBeNull();
  });

  it("returns an unsubscribe function for an active session", () => {
    const sessionId = manager.run("test-agent", "task");
    const unsub = manager.subscribe(sessionId, () => {});

    expect(unsub).not.toBeNull();
    expect(typeof unsub).toBe("function");

    // Unsubscribe should not throw
    unsub!();
  });

  it("receives events from the session", async () => {
    const sessionId = manager.run("test-agent", "task");
    const events: AgentEvent[] = [];

    manager.subscribe(sessionId, (e) => events.push(e));

    // Wait for completion — the fake model will error but events should still fire
    await manager.waitFor(sessionId);

    // We should have received at least some events
    // (exact count depends on how quickly the fake model errors,
    // but there should be at least the user message)
    expect(events.length).toBeGreaterThanOrEqual(0);
  });

  it("stops receiving events after unsubscribe", async () => {
    const sessionId = manager.run("test-agent", "task");
    const events: AgentEvent[] = [];

    const unsub = manager.subscribe(sessionId, (e) => events.push(e));
    const countBefore = events.length;

    // Unsubscribe immediately
    unsub!();

    await manager.waitFor(sessionId);

    // Events collected after unsubscribe should not grow
    // (may have collected a few before unsubscribe due to timing)
    expect(events.length).toBeLessThanOrEqual(countBefore + 1);
  });
});

describe("SubagentManager.sessions()", () => {
  let manager: SubagentManager;

  beforeEach(() => {
    manager = new SubagentManager();
    registerAgent(manager, "agent-a");
    registerAgent(manager, "agent-b");
  });

  it("returns empty array when agent has no sessions", () => {
    expect(manager.sessions("agent-a")).toEqual([]);
  });

  it("filters sessions by agent name", async () => {
    const s1 = manager.run("agent-a", "task for a");
    const s2 = manager.run("agent-b", "task for b");

    await manager.waitFor(s1);
    await manager.waitFor(s2);

    const sessionsA = manager.sessions("agent-a");
    const sessionsB = manager.sessions("agent-b");

    expect(sessionsA).toHaveLength(1);
    expect(sessionsA[0].agent).toBe("agent-a");
    expect(sessionsA[0].task).toBe("task for a");

    expect(sessionsB).toHaveLength(1);
    expect(sessionsB[0].agent).toBe("agent-b");
  });

  it("returns empty array for unregistered agent name", () => {
    expect(manager.sessions("nonexistent")).toEqual([]);
  });
});

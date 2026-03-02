import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import type { SubagentDefinition } from "../src/types.js";
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

function baseDef(overrides: Partial<SubagentDefinition> = {}): SubagentDefinition {
  return {
    name: "test-agent",
    description: "Test agent",
    domain: "test",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
    ...overrides,
  };
}

// ── Group 1: maxTurns in SubagentDefinition ────────────────────────────

describe("maxTurns in SubagentDefinition", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-maxturns-def-"));
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("maxTurns is stored on ActiveSession when set", async () => {
    manager.register(baseDef({ name: "agent-mt", maxTurns: 10 }));

    const sessionId = manager.run("agent-mt", "do work");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
    expect(result!.maxTurns).toBe(10);
  });

  it("maxTurns is undefined when not set", async () => {
    manager.register(baseDef({ name: "agent-no-mt" }));

    const sessionId = manager.run("agent-no-mt", "do work");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
    expect(result!.maxTurns).toBeUndefined();
  });

  it("maxTurns of 0 is treated as no limit", async () => {
    manager.register(baseDef({ name: "agent-zero-mt", maxTurns: 0 }));

    const sessionId = manager.run("agent-zero-mt", "do work");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
    // maxTurns: 0 is stored but subscribeForTurnLimit early-returns
    // The important thing is that it doesn't cause a turn-limit error
    expect(result!.error ?? "").not.toContain("Turn limit reached");
  });
});

// ── Group 2: Turn Budget in system prompt ──────────────────────────────

describe("Turn Budget in system prompt", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-maxturns-prompt-"));
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("system prompt includes Turn Budget section when maxTurns > 0", () => {
    const def = baseDef({ name: "agent-budget", maxTurns: 15 });
    manager.register(def);

    // Call the private resolveSystemPrompt directly for a clean unit test
    const prompt = (manager as any).resolveSystemPrompt(def, "agent-budget", "s1", persistDir);

    expect(prompt).toContain("# Turn Budget");
    expect(prompt).toContain("maximum of 15 turns");
  });

  it("system prompt does NOT include Turn Budget when maxTurns is not set", () => {
    const def = baseDef({ name: "agent-no-budget" });
    manager.register(def);

    const prompt = (manager as any).resolveSystemPrompt(def, "agent-no-budget", "s1", persistDir);

    expect(prompt).not.toContain("# Turn Budget");
  });

  it("system prompt does NOT include Turn Budget when maxTurns is 0", () => {
    const def = baseDef({ name: "agent-zero-budget", maxTurns: 0 });
    manager.register(def);

    const prompt = (manager as any).resolveSystemPrompt(def, "agent-zero-budget", "s1", persistDir);

    expect(prompt).not.toContain("# Turn Budget");
  });
});

// ── Group 3: turnsUsed/maxTurns in TaskResult ──────────────────────────

describe("turnsUsed/maxTurns in TaskResult", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-maxturns-result-"));
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("result() includes turnsUsed: 0 and maxTurns when session errors immediately", async () => {
    manager.register(baseDef({ name: "agent-r1", maxTurns: 5 }));

    const sessionId = manager.run("agent-r1", "do work");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
    expect(result!.turnsUsed).toBe(0);
    expect(result!.maxTurns).toBe(5);
  });

  it("result() includes turnsUsed: 0 and maxTurns: undefined when no limit configured", async () => {
    manager.register(baseDef({ name: "agent-r2" }));

    const sessionId = manager.run("agent-r2", "do work");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
    expect(result!.turnsUsed).toBe(0);
    expect(result!.maxTurns).toBeUndefined();
  });

  it("waitFor() also returns turnsUsed and maxTurns", async () => {
    manager.register(baseDef({ name: "agent-r3", maxTurns: 8 }));

    const sessionId = manager.run("agent-r3", "do work");
    const result = await manager.waitFor(sessionId);

    expect(result).not.toBeNull();
    expect(result!.turnsUsed).toBe(0);
    expect(result!.maxTurns).toBe(8);
  });
});

// ── Group 4: Subscription cleanup ──────────────────────────────────────

describe("Turn limit subscription cleanup", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-maxturns-cleanup-"));
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("send() works after a session with maxTurns completes (proves cleanup happened)", async () => {
    manager.register(baseDef({ name: "agent-c1", maxTurns: 10 }));

    const sessionId = manager.run("agent-c1", "initial task");
    await manager.waitFor(sessionId);

    // If handleCompletion didn't clean up the subscription,
    // send() would fail or behave incorrectly
    const sendResult = manager.send(sessionId, "follow up");
    expect(sendResult).toBe(true);

    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
    // turnsUsed carries over (cumulative), still 0 because fake model errors instantly
    expect(result!.turnsUsed).toBe(0);
    expect(result!.maxTurns).toBe(10);
  });

  it("send() cleans up old turn limit subscription before re-subscribing", async () => {
    manager.register(baseDef({ name: "agent-c2", maxTurns: 20 }));

    const sessionId = manager.run("agent-c2", "task 1");
    await manager.waitFor(sessionId);

    // First follow-up
    manager.send(sessionId, "task 2");
    await manager.waitFor(sessionId);

    // Second follow-up — if old subscriptions leaked, turnCount could be wrong
    manager.send(sessionId, "task 3");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
    // turnsUsed should remain 0 (fake model never completes a turn)
    expect(result!.turnsUsed).toBe(0);
    expect(result!.maxTurns).toBe(20);
  });

  it("turn limit subscription is set up even without persistence", async () => {
    // No persistDir — SubagentManager with no persistence
    const noPersistManager = new SubagentManager();
    noPersistManager.register(baseDef({ name: "agent-c3", maxTurns: 7 }));

    const sessionId = noPersistManager.run("agent-c3", "do work");
    await noPersistManager.waitFor(sessionId);

    const result = noPersistManager.result(sessionId);
    expect(result).not.toBeNull();
    expect(result!.maxTurns).toBe(7);
    expect(result!.turnsUsed).toBe(0);
  });
});

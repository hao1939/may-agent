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
    // waitFor() captures the result from the session before cleanup
    const result = await manager.waitFor(sessionId);
    expect(result.maxTurns).toBe(10);
  });

  it("maxTurns is undefined when not set", async () => {
    manager.register(baseDef({ name: "agent-no-mt" }));

    const sessionId = manager.run("agent-no-mt", "do work");
    const result = await manager.waitFor(sessionId);
    expect(result.maxTurns).toBeUndefined();
  });

  it("maxTurns of 0 is treated as no limit", async () => {
    manager.register(baseDef({ name: "agent-zero-mt", maxTurns: 0 }));

    const sessionId = manager.run("agent-zero-mt", "do work");
    const result = await manager.waitFor(sessionId);
    // maxTurns: 0 is stored but subscribeForTurnLimit early-returns
    // The important thing is that it doesn't cause a turn-limit error
    expect(result.error ?? "").not.toContain("Turn limit reached");
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
    // Use waitFor() which captures result from the live session before cleanup
    const result = await manager.waitFor(sessionId);
    expect(result.turnsUsed).toBe(0);
    expect(result.maxTurns).toBe(5);
  });

  it("result() includes turnsUsed: 0 and maxTurns: undefined when no limit configured", async () => {
    manager.register(baseDef({ name: "agent-r2" }));

    const sessionId = manager.run("agent-r2", "do work");
    const result = await manager.waitFor(sessionId);
    expect(result.turnsUsed).toBe(0);
    expect(result.maxTurns).toBeUndefined();
  });

  it("waitFor() also returns turnsUsed and maxTurns", async () => {
    manager.register(baseDef({ name: "agent-r3", maxTurns: 8 }));

    const sessionId = manager.run("agent-r3", "do work");
    const result = await manager.waitFor(sessionId);

    expect(result.turnsUsed).toBe(0);
    expect(result.maxTurns).toBe(8);
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

  it("turn limit subscription is cleaned up on completion", async () => {
    manager.register(baseDef({ name: "agent-c2", maxTurns: 20 }));

    const sessionId = manager.run("agent-c2", "task 1");
    const result = await manager.waitFor(sessionId);

    // turnsUsed should be 0 (fake model never completes a turn)
    expect(result.turnsUsed).toBe(0);
    expect(result.maxTurns).toBe(20);
    // Session should be cleaned up from activeSessions
    expect(manager.getSessionCount()).toBe(0);
  });

  it("turn limit subscription works with a fresh manager", async () => {
    const mgr = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    mgr.register(baseDef({ name: "agent-c3", maxTurns: 7 }));

    const sessionId = mgr.run("agent-c3", "do work");
    const result = await mgr.waitFor(sessionId);

    expect(result.maxTurns).toBe(7);
    expect(result.turnsUsed).toBe(0);
  });
});

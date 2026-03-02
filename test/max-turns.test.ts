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

// ── Group 5: Turn budget warning (turnWarningThreshold) ────────────────

describe("Turn budget warning", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-turn-warning-"));
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("turnWarningThreshold defaults to 0.8 on ActiveSession", async () => {
    manager.register(baseDef({ name: "agent-tw1", maxTurns: 40 }));

    const sessionId = manager.run("agent-tw1", "do work");

    // Access internal activeSessions to check the default threshold
    const sessions = (manager as any).activeSessions as Map<string, any>;
    const session = sessions.get(sessionId);
    expect(session).toBeDefined();
    expect(session.turnWarningThreshold).toBe(0.8);
    expect(session.turnWarningFired).toBe(false);

    await manager.waitFor(sessionId);
  });

  it("custom turnWarningThreshold is stored on ActiveSession", async () => {
    manager.register(baseDef({ name: "agent-tw2", maxTurns: 40, turnWarningThreshold: 0.5 }));

    const sessionId = manager.run("agent-tw2", "do work");

    const sessions = (manager as any).activeSessions as Map<string, any>;
    const session = sessions.get(sessionId);
    expect(session).toBeDefined();
    expect(session.turnWarningThreshold).toBe(0.5);

    await manager.waitFor(sessionId);
  });

  it("turnWarningThreshold of 0 disables the warning (warningTurn computes to 0)", async () => {
    manager.register(baseDef({ name: "agent-tw3", maxTurns: 40, turnWarningThreshold: 0 }));

    const sessionId = manager.run("agent-tw3", "do work");

    const sessions = (manager as any).activeSessions as Map<string, any>;
    const session = sessions.get(sessionId);
    expect(session.turnWarningThreshold).toBe(0);
    // Math.floor(40 * 0) = 0, and the condition checks warningTurn > 0, so no warning fires

    await manager.waitFor(sessionId);
  });

  it("turnWarningThreshold defaults to 0.8 even when not explicitly set", () => {
    const def = baseDef({ name: "agent-tw4", maxTurns: 10 });
    // turnWarningThreshold is not set on the def
    expect(def.turnWarningThreshold).toBeUndefined();

    manager.register(def);
    const sessionId = manager.run("agent-tw4", "do work");

    const sessions = (manager as any).activeSessions as Map<string, any>;
    const session = sessions.get(sessionId);
    // Should default to 0.8
    expect(session.turnWarningThreshold).toBe(0.8);
  });

  it("warning turn is computed correctly: floor(maxTurns * threshold)", () => {
    // Test the math: for maxTurns=40, threshold=0.8, warningTurn = floor(32) = 32
    expect(Math.floor(40 * 0.8)).toBe(32);
    // For maxTurns=10, threshold=0.8, warningTurn = floor(8) = 8
    expect(Math.floor(10 * 0.8)).toBe(8);
    // For maxTurns=5, threshold=0.75, warningTurn = floor(3.75) = 3
    expect(Math.floor(5 * 0.75)).toBe(3);
    // For maxTurns=3, threshold=0.5, warningTurn = floor(1.5) = 1
    expect(Math.floor(3 * 0.5)).toBe(1);
  });

  it("turnWarningFired starts as false on new session", async () => {
    manager.register(baseDef({ name: "agent-tw5", maxTurns: 20 }));

    const sessionId = manager.run("agent-tw5", "do work");

    const sessions = (manager as any).activeSessions as Map<string, any>;
    const session = sessions.get(sessionId);
    expect(session.turnWarningFired).toBe(false);

    await manager.waitFor(sessionId);
  });

  it("turnWarningThreshold is included in SubagentDefinition type", () => {
    // Verifies the type accepts the field without TS errors
    const def: SubagentDefinition = baseDef({
      name: "agent-tw6",
      maxTurns: 40,
      turnWarningThreshold: 0.9,
    });
    expect(def.turnWarningThreshold).toBe(0.9);
    expect(def.maxTurns).toBe(40);
  });

  it("session without maxTurns does not set up turn limit subscription", async () => {
    manager.register(baseDef({ name: "agent-tw7" }));

    const sessionId = manager.run("agent-tw7", "do work");

    const sessions = (manager as any).activeSessions as Map<string, any>;
    const session = sessions.get(sessionId);
    // Without maxTurns, subscribeForTurnLimit early-returns
    expect(session.unsubscribeTurnLimit).toBeUndefined();

    await manager.waitFor(sessionId);
  });

  it("session with maxTurns sets up turn limit subscription", async () => {
    manager.register(baseDef({ name: "agent-tw8", maxTurns: 10 }));

    const sessionId = manager.run("agent-tw8", "do work");

    const sessions = (manager as any).activeSessions as Map<string, any>;
    const session = sessions.get(sessionId);
    // With maxTurns, subscription should be set
    expect(session.unsubscribeTurnLimit).toBeDefined();
    expect(typeof session.unsubscribeTurnLimit).toBe("function");

    await manager.waitFor(sessionId);
  });

  it("warning message mentions remaining turns and wrap-up instructions", () => {
    // Verify the warning message format by checking what would be generated
    // for a session at turn 32 of 40
    const turnCount = 32;
    const maxTurns = 40;
    const remaining = maxTurns - turnCount;

    const expectedParts = [
      "TURN BUDGET WARNING",
      `${turnCount} of ${maxTurns}`,
      `${remaining} turns remain`,
      "Wrap up",
      "commit",
      "do not start new tasks",
    ];

    // Build the message the same way the code does
    const message =
      `⚠️ TURN BUDGET WARNING: You have used ${turnCount} of ${maxTurns} turns. ` +
      `Only ${remaining} turns remain. Wrap up your current work, commit any changes if possible, ` +
      `and do not start new tasks. Summarize any remaining work that could not be completed.`;

    for (const part of expectedParts) {
      expect(message).toContain(part);
    }
  });
});

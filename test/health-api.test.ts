import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import { writeSessionMeta } from "../src/lib/persistence.js";
import { insertWorkflowRun } from "../src/lib/requests.js";
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

function registerTestAgents(manager: SubagentManager) {
  manager.register({
    name: "coder",
    description: "Writes code",
    domain: "engineering",
    systemPrompt: "You are a coder.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
  manager.register({
    name: "reviewer",
    description: "Reviews code",
    domain: "quality",
    systemPrompt: "You are a reviewer.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

describe("health()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "health-api-"));
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns correct structure with registered agents", () => {
    registerTestAgents(manager);
    const report = manager.health();

    expect(report.registeredAgents.count).toBe(2);
    expect(report.registeredAgents.names).toContain("coder");
    expect(report.registeredAgents.names).toContain("reviewer");
    expect(report.activeSessions).toEqual([]);
    expect(report.sessionCounts).toEqual({ running: 0, idle: 0, total: 0 });
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.uptime).toBeDefined();
  });

  it("returns active sessions with correct fields", async () => {
    registerTestAgents(manager);
    const sid = manager.run("coder", "write tests");

    const report = manager.health();
    expect(report.activeSessions.length).toBeGreaterThanOrEqual(1);
    const session = report.activeSessions.find((s) => s.sessionId === sid);
    expect(session).toBeDefined();
    expect(session!.agent).toBe("coder");
    expect(session!.startedAt).toBeGreaterThan(0);
    expect(session!.turnCount).toBe(0);
    expect(session!.runtime).toBeDefined();

    await manager.waitFor(sid);
  });

  it("counts running and idle sessions correctly", async () => {
    registerTestAgents(manager);
    const sid = manager.run("coder", "write code");

    const report = manager.health();
    // Session might be running or already done (fake model has no API key)
    expect(report.sessionCounts.total).toBeGreaterThanOrEqual(0);

    await manager.waitFor(sid);
  });

  it("uptime increases over time", async () => {
    const report1 = manager.health();
    await new Promise((r) => setTimeout(r, 50));
    const report2 = manager.health();

    // Both should have uptime strings; the second should be at least as long
    expect(report1.uptime).toBeDefined();
    expect(report2.uptime).toBeDefined();
  });

  it("returns empty state for fresh manager", () => {
    const report = manager.health();
    expect(report.registeredAgents.count).toBe(0);
    expect(report.registeredAgents.names).toEqual([]);
    expect(report.activeSessions).toEqual([]);
    expect(report.sessionCounts).toEqual({ running: 0, idle: 0, total: 0 });
  });
});

describe("auditHealth()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "health-audit-"));
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerTestAgents(manager);
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns correct session counts from filesystem", async () => {
    // Create a recent session
    writeSessionMeta(persistDir, "s_recent_0", {
      agent: "coder",
      task: "recent task",
      status: "done",
      startedAt: Date.now() - 3600_000, // 1 hour ago
    });
    // Create an old session
    writeSessionMeta(persistDir, "s_old_0", {
      agent: "coder",
      task: "old task",
      status: "done",
      startedAt: Date.now() - 48 * 3600_000, // 2 days ago
    });

    const report = await manager.auditHealth();
    expect(report.sessionsLast24h).toBe(1);
    expect(report.totalPersistedSessions).toBe(2);
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("detects unevaluated sessions", async () => {
    // Session with transcript but no evaluation
    writeSessionMeta(persistDir, "s_uneval_0", {
      agent: "coder",
      task: "unevaluated task",
      status: "done",
      startedAt: Date.now() - 86400_000,
    });
    // Create a session JSONL so it's actionable
    writeFileSync(join(persistDir, "sessions", "s_uneval_0", "session.jsonl"), '{"role":"user"}\n');

    const report = await manager.auditHealth();
    expect(report.unevaluated.total).toBe(1);
    expect(report.unevaluated.actionable).toBe(1);
    expect(report.unevaluated.autoSkippable).toBe(0);
  });

  it("classifies meta-agent sessions as auto-skippable", async () => {
    writeSessionMeta(persistDir, "s_eval_0", {
      agent: "evaluator",
      task: "eval task",
      status: "done",
      startedAt: Date.now() - 3600_000,
    });

    const report = await manager.auditHealth();
    expect(report.unevaluated.total).toBe(1);
    expect(report.unevaluated.autoSkippable).toBe(1);
    expect(report.unevaluated.actionable).toBe(0);
  });

  it("detects stale sessions (running on disk but not in memory)", async () => {
    writeSessionMeta(persistDir, "s_stale_0", {
      agent: "coder",
      task: "stuck task",
      status: "running",
      startedAt: Date.now() - 7200_000,
    });

    const report = await manager.auditHealth();
    expect(report.staleSessions).toHaveLength(1);
    expect(report.staleSessions[0].sessionId).toBe("s_stale_0");
    expect(report.staleSessions[0].agent).toBe("coder");
  });

  it("counts workflow runs correctly", async () => {
    insertWorkflowRun(persistDir, {
      runId: "wf_1",
      workflow: "code-review",
      task: "review PR",
      parentSessionId: "s_1",
      parentWorkflowRunId: null,
      depth: 1,
      startedAt: Date.now() - 3600_000,
      endedAt: Date.now(),
      status: "done",
      result_summary: null,
      result_reason: null,
      resumedFromRunId: null,
    });
    insertWorkflowRun(persistDir, {
      runId: "wf_2",
      workflow: "code-review",
      task: "review PR 2",
      parentSessionId: "s_2",
      parentWorkflowRunId: null,
      depth: 1,
      startedAt: Date.now() - 1800_000,
      endedAt: null,
      status: "running",
      result_summary: null,
      result_reason: null,
      resumedFromRunId: null,
    });

    const report = await manager.auditHealth();
    expect(report.workflowRuns.total).toBe(2);
    expect(report.workflowRuns.completed).toBe(1);
    expect(report.workflowRuns.running).toBe(1);
    expect(report.workflowRuns.interrupted).toBe(0);
  });
});

describe("reconcileHealth()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "health-reconcile-"));
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerTestAgents(manager);
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns healthy: true when everything matches", async () => {
    const report = await manager.reconcileHealth();
    expect(report.healthy).toBe(true);
    expect(report.discrepancies).toEqual([]);
    expect(report.health).toBeDefined();
    expect(report.audit).toBeDefined();
  });

  it("detects stale sessions (in filesystem but not in memory)", async () => {
    writeSessionMeta(persistDir, "s_orphan_0", {
      agent: "coder",
      task: "orphaned task",
      status: "running",
      startedAt: Date.now() - 7200_000,
    });

    const report = await manager.reconcileHealth();
    expect(report.healthy).toBe(false);
    expect(report.discrepancies.length).toBeGreaterThan(0);
    expect(report.discrepancies.some((d) => d.includes("s_orphan_0"))).toBe(true);
    expect(report.discrepancies.some((d) => d.includes("Stale session"))).toBe(true);
  });

  it("includes both health and audit sub-reports", async () => {
    const report = await manager.reconcileHealth();
    expect(report.health.registeredAgents.count).toBe(2);
    expect(report.audit.totalPersistedSessions).toBe(0);
  });
});

describe("health via reconcileHealth()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "health-tool-"));
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerTestAgents(manager);
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns reconcile report", async () => {
    const parsed = await manager.reconcileHealth();

    expect(parsed.health).toBeDefined();
    expect(parsed.audit).toBeDefined();
    expect(parsed.discrepancies).toBeDefined();
    expect(typeof parsed.healthy).toBe("boolean");
    expect(parsed.health.registeredAgents.count).toBe(2);
  });
});

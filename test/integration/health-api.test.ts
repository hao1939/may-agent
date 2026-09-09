import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager, type SessionInfo } from "../../src/lib/manager.js";
import { writeSessionMeta, type PersistedSession } from "../../src/lib/persistence.js";
import { closeDb, insertWorkflowRun, upsertSession } from "../../src/lib/requests.js";
import type { Model } from "@earendil-works/pi-ai";

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

function writeAuditSession(persistDir: string, sessionId: string, meta: PersistedSession): void {
  writeSessionMeta(persistDir, sessionId, meta);
  upsertSession(persistDir, { sessionId, ...meta });
}

let persistDir: string;
let manager: SubagentManager;

beforeEach(() => {
  persistDir = mkdtempSync(join(tmpdir(), "health-api-"));
  manager = new SubagentManager({ persistDir });
});

afterEach(() => {
  closeDb(persistDir);
  rmSync(persistDir, { recursive: true, force: true });
});

describe("health()", () => {
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

  it("counts each running and idle session from the current status snapshot", () => {
    const sessions: SessionInfo[] = (["running", "running", "idle"] as const).map((status, index) => ({
      sessionId: `session-${index}`,
      agent: "coder",
      task: "inspect health",
      status,
      startedAt: 1,
      runtime: "1s",
      outputDir: join(persistDir, `session-${index}`),
    }));
    const status = spyOn(manager, "status").mockReturnValue(sessions);
    try {
      expect(manager.health()).toMatchObject({
        activeSessions: sessions,
        sessionCounts: { running: 2, idle: 1, total: 3 },
      });
      status.mockReturnValue([]);
      expect(manager.health().sessionCounts).toEqual({ running: 0, idle: 0, total: 0 });
    } finally {
      status.mockRestore();
    }
  });

  it("reports elapsed uptime without waiting for wall-clock time", () => {
    const start = Date.now();
    const clock = spyOn(Date, "now").mockReturnValue(start);
    try {
      const timed = new SubagentManager({ persistDir });
      expect(timed.health().uptime).toBe("0s");
      clock.mockReturnValue(start + 61_000);
      expect(timed.health().uptime).toBe("1m1s");
    } finally {
      clock.mockRestore();
    }
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
  beforeEach(() => {
    registerTestAgents(manager);
  });

  it("returns correct session counts from the indexed session table", async () => {
    // Create a recent session
    writeAuditSession(persistDir, "s_recent_0", {
      agent: "coder",
      task: "recent task",
      status: "done",
      startedAt: Date.now() - 3600_000, // 1 hour ago
    });
    // Create an old session
    writeAuditSession(persistDir, "s_old_0", {
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
    writeAuditSession(persistDir, "s_uneval_0", {
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
    writeAuditSession(persistDir, "s_eval_0", {
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
    writeAuditSession(persistDir, "s_stale_0", {
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

  it("uses indexed runtime tables without loading the retained session registry", async () => {
    writeAuditSession(persistDir, "s_indexed_0", {
      agent: "coder",
      task: "indexed audit",
      status: "done",
      startedAt: Date.now(),
    });
    manager.registryStore.getRegistry = () => {
      throw new Error("auditHealth must not parse all session metadata");
    };

    const report = await manager.auditHealth();

    expect(report.totalPersistedSessions).toBe(1);
    expect(report.sessionsLast24h).toBe(1);
  });
});

describe("reconcileHealth()", () => {
  beforeEach(() => {
    registerTestAgents(manager);
  });

  it("returns healthy: true when everything matches", async () => {
    const report = await manager.reconcileHealth();
    expect(report.healthy).toBe(true);
    expect(report.discrepancies).toEqual([]);
    expect(report.health.registeredAgents.count).toBe(2);
    expect(report.audit.totalPersistedSessions).toBe(0);
  });

  it("detects stale sessions (in filesystem but not in memory)", async () => {
    writeAuditSession(persistDir, "s_orphan_0", {
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
});

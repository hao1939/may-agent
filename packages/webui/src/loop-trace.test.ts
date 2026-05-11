import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildLoopTrace } from "./loop-trace.js";
import { openDatabase, type SqliteDb } from "../../../src/lib/db.js";

describe("buildLoopTrace", () => {
  const roots: string[] = [];
  const dbs: SqliteDb[] = [];

  afterEach(() => {
    for (const db of dbs.splice(0)) db.close();
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function makeDb(): SqliteDb {
    const root = mkdtempSync(join(tmpdir(), "loop-trace-"));
    roots.push(root);
    const db = openDatabase(join(root, "may.db"));
    dbs.push(db);
    db.exec(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT,
        source TEXT,
        owner TEXT,
        data TEXT,
        timestamp INTEGER,
        urgency TEXT
      );
      CREATE TABLE metrics (
        id TEXT PRIMARY KEY,
        name TEXT,
        owner TEXT,
        project TEXT,
        current REAL,
        target REAL,
        threshold REAL,
        priority TEXT,
        alert_op TEXT
      );
      CREATE TABLE metric_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_id TEXT,
        alert_type TEXT,
        message TEXT,
        created_at INTEGER,
        resolved_at INTEGER
      );
      CREATE TABLE metric_snapshots (
        metric_id TEXT,
        value REAL,
        sample_size INTEGER,
        measured_at INTEGER,
        measured_by TEXT,
        note TEXT
      );
      CREATE TABLE workflow_runs (
        runId TEXT PRIMARY KEY,
        workflow TEXT,
        task TEXT,
        parentSessionId TEXT,
        parentWorkflowRunId TEXT,
        projectId TEXT,
        depth INTEGER,
        status TEXT,
        startedAt INTEGER,
        endedAt INTEGER,
        result_summary TEXT,
        result_reason TEXT,
        resumedFromRunId TEXT
      );
      CREATE TABLE sessions (
        sessionId TEXT PRIMARY KEY,
        agent TEXT,
        task TEXT,
        status TEXT,
        kind TEXT,
        source TEXT,
        parentSessionId TEXT,
        workflowRunId TEXT,
        projectId TEXT,
        startedAt INTEGER,
        endedAt INTEGER,
        outcome TEXT,
        error TEXT,
        opCount INTEGER
      );
    `);
    return db;
  }

  it("connects an alert to metric events, workflow, sessions, and guard signals", () => {
    const db = makeDb();
    const now = Date.now();
    db.prepare("INSERT INTO metrics (id, name, owner, project, current, target, threshold, priority, alert_op) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("session.first-turn-error-count-1h", "First turn errors", "may", "v2-spec-coverage-buildout", 2, 0, 1, "P1", ">");
    db.prepare("INSERT INTO metric_alerts (id, metric_id, alert_type, message, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(7, "session.first-turn-error-count-1h", "threshold", "first turn errors breached", now - 10_000, null);
    db.prepare("INSERT INTO events (id, event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(11, "metric.breach", "metrics", "may", JSON.stringify({ alertId: 7, metricId: "session.first-turn-error-count-1h", owner: "may" }), now - 9_000, "normal");
    db.prepare("INSERT INTO workflow_runs (runId, workflow, task, parentSessionId, parentWorkflowRunId, projectId, depth, status, startedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("wr_triage", "metric-alert-triage", "triage session.first-turn-error-count-1h", null, null, "v2-spec-coverage-buildout", 1, "done", now - 8_000);
    db.prepare("INSERT INTO sessions (sessionId, agent, task, status, source, workflowRunId, projectId, startedAt, endedAt, outcome, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("s_triage", "may", "triage session.first-turn-error-count-1h", "done", "workflow:metric-alert-triage", "wr_triage", "v2-spec-coverage-buildout", now - 7_000, now - 6_000, "judged", 4);
    db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?)")
      .run("guard.triggered", "workflow", "may", JSON.stringify({ workflowRunId: "wr_triage", sessionId: "s_triage", guard: "verify-after-write", demandType: "warn" }), now - 5_000, "normal");
    db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?)")
      .run("metric.alert_judged", "workflow", "may", JSON.stringify({ alertId: 7, metricId: "session.first-turn-error-count-1h", verdict: "needs_fix" }), now - 4_000, "normal");
    db.prepare("INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?, ?, ?, ?, ?, ?)")
      .run("session.first-turn-error-count-1h", 2, 10, now - 3_000, "metrics-snapshot", null);

    const trace = buildLoopTrace(db, { alertId: 7 });

    expect(trace).toMatchObject({
      target: { kind: "alert", id: 7 },
      owner: "may",
      projectId: "v2-spec-coverage-buildout",
      metricId: "session.first-turn-error-count-1h",
      alertId: 7,
      evidence: {
        workflowCount: 1,
        sessionCount: 1,
        guardSignalCount: 1,
        metricEventCount: 2,
      },
    });
    expect(trace.workflows[0]).toMatchObject({ runId: "wr_triage", workflow: "metric-alert-triage" });
    expect(trace.sessions[0]).toMatchObject({ sessionId: "s_triage", agent: "may" });
    expect(trace.guardSignals).toHaveLength(1);
    expect(trace.executions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wr_triage", kind: "workflow", status: "done", traceId: "wr_triage" }),
      expect.objectContaining({ id: "s_triage", kind: "session", status: "done", traceId: "wr_triage", owner: "may" }),
    ]));
    expect(trace.guardSignals[0]).toMatchObject({ event_type: "guard.triggered" });
    expect(trace.metricSnapshots[0]).toMatchObject({ metric_id: "session.first-turn-error-count-1h", value: 2 });
  });

  it("shows resume failover events for a workflow", () => {
    const db = makeDb();
    const now = Date.now();
    db.prepare("INSERT INTO workflow_runs (runId, workflow, task, projectId, depth, status, startedAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("wr_missing", "deleted-workflow", "resume me", "closed-loop-reliability", 1, "running", now - 10_000);
    db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?)")
      .run("workflow.resume_failed", "workflow-tool", "may", JSON.stringify({ workflowRunId: "wr_missing", workflow: "deleted-workflow", projectId: "closed-loop-reliability", category: "workflow_definition_missing", recoverable: true, nextAction: "recover" }), now - 5_000, "normal");

    const trace = buildLoopTrace(db, { workflowRunId: "wr_missing" });

    expect(trace.target).toEqual({ kind: "workflow", id: "wr_missing" });
    expect(trace.owner).toBe("may");
    expect(trace.projectId).toBe("closed-loop-reliability");
    expect(trace.failoverEvents).toHaveLength(1);
    expect(trace.failoverEvents[0]).toMatchObject({ event_type: "workflow.resume_failed" });
    expect(trace.executions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "wr_missing",
        kind: "workflow",
        status: "interrupted",
        owner: "may",
        summary: "workflow_definition_missing",
        evidence: expect.objectContaining({ nextAction: "recover" }),
      }),
    ]));
    expect(trace.evidence.failoverCount).toBe(1);
  });

  it("keeps terminal workflow resume skips terminal in execution view", () => {
    const db = makeDb();
    const now = Date.now();
    db.prepare("INSERT INTO workflow_runs (runId, workflow, task, projectId, depth, status, startedAt, endedAt, result_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("wr_done", "goal-driver", "already finished", "p1", 1, "done", now - 20_000, now - 10_000, "finished");
    db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?)")
      .run("workflow.resume_skipped", "workflow-tool", "may", JSON.stringify({ workflowRunId: "wr_done", workflow: "goal-driver", projectId: "p1", status: "done", reason: "workflow already reached terminal status", nextAction: "none" }), now - 5_000, "normal");

    const trace = buildLoopTrace(db, { workflowRunId: "wr_done" });

    expect(trace.failoverEvents[0]).toMatchObject({ event_type: "workflow.resume_skipped", owner: "may" });
    expect(trace.executions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "wr_done",
        kind: "workflow",
        status: "done",
        owner: "may",
        summary: "workflow already reached terminal status",
        evidence: expect.objectContaining({ nextAction: "none" }),
      }),
    ]));
  });

  it("shows resume failover events for a session", () => {
    const db = makeDb();
    const now = Date.now();
    db.prepare("INSERT INTO sessions (sessionId, agent, task, status, source, workflowRunId, projectId, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("s_unreg", "missing-agent", "continue work", "interrupted", "resumeStaleSessions", "wr_parent", "closed-loop-reliability", now - 10_000, now - 9_000, "agent not registered");
    db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?)")
      .run("session.resume_failed", "manager", "missing-agent", JSON.stringify({ sessionId: "s_unreg", agent: "missing-agent", workflowRunId: "wr_parent", projectId: "closed-loop-reliability", category: "agent_not_registered", recoverable: false, reason: "Process restarted (agent not registered)" }), now - 8_000, "normal");

    const trace = buildLoopTrace(db, { sessionId: "s_unreg" });

    expect(trace).toMatchObject({
      target: { kind: "session", id: "s_unreg" },
      owner: "missing-agent",
      projectId: "closed-loop-reliability",
      evidence: { failoverCount: 1 },
    });
    expect(trace.failoverEvents[0]).toMatchObject({ event_type: "session.resume_failed", owner: "missing-agent" });
    expect(trace.executions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "s_unreg",
        kind: "session",
        status: "error",
        owner: "missing-agent",
        summary: "Process restarted (agent not registered)",
      }),
    ]));
  });

  it("treats a failure event target as failover evidence", () => {
    const db = makeDb();
    const now = Date.now();
    db.prepare("INSERT INTO events (id, event_type, source, owner, data, timestamp, urgency) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(31, "message.delivery_failed", "evaluator", "may", JSON.stringify({ owner: "may", from: "evaluator", to: "hao", reason: "Unknown message target" }), now - 1_000, "high");

    const trace = buildLoopTrace(db, { eventId: 31 });

    expect(trace).toMatchObject({
      target: { kind: "event", id: 31 },
      owner: "may",
      handler: { reason: "Unknown message target" },
      evidence: { failoverCount: 1 },
    });
    expect(trace.failoverEvents[0]).toMatchObject({ event_type: "message.delivery_failed", owner: "may" });
  });
});

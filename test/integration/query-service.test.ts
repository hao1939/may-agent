import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { createQueryService } from "../../src/lib/query-service.js";

describe("QueryService", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function harness() {
    const root = mkdtempSync(join(tmpdir(), "query-service-"));
    roots.push(root);
    const db = getDb(root);
    const query = createQueryService({ getDb: () => db, defaultLimit: 2, maxLimit: 3 });
    return { db, query };
  }

  it("queries core runtime tables with bounded filters", () => {
    const { db, query } = harness();
    const now = 10_000;

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s1", "may", "older", "done", "p1", now - 100],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s2", "may", "newer", "error", "p1", now],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s3", "scout", "other", "done", "p2", now + 100],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["wr1", "project", "project: p1", "running", "p1", now + 200],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["wr2", "project", "project: p2", "done", "p2", now + 300],
    );

    expect(query.sessions({ agent: "may" }).rows.map((row) => row.sessionId)).toEqual(["s2", "s1"]);
    expect(query.sessions({ projectId: "p1", status: "done" }).rows).toMatchObject([
      { sessionId: "s1", agent: "may", status: "done" },
    ]);
    expect(query.workflowRuns({ status: "running" }).rows).toMatchObject([
      { runId: "wr1", workflow: "project", projectId: "p1" },
    ]);
  });

  it("keeps arbitrary SQL read-only and bounded", () => {
    const { db, query } = harness();

    for (let i = 0; i < 4; i++) {
      db.run(
        "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
        ["example", "test", "may", JSON.stringify({ i }), i],
      );
    }

    const result = query.sql("SELECT id, event_type FROM events ORDER BY id ASC", [], { limit: 3 });
    expect(result.rowCount).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.rows.map((row) => row.event_type)).toEqual(["example", "example", "example"]);
  });

  it("matches event owners by exact owner value", () => {
    const { db, query } = harness();

    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["project.nudge", "test", "agent:may", JSON.stringify({ canonical: true }), 2],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["project.nudge", "test", "may", JSON.stringify({ legacy: true }), 1],
    );

    expect(query.events({ owner: "agent:may" }).rows.map((row) => row.owner)).toEqual(["agent:may"]);
    expect(query.events({ owner: "may" }).rows.map((row) => row.owner)).toEqual(["may"]);
  });

  it("rejects writes and multi-statement SQL", () => {
    const { query } = harness();

    expect(() => query.sql("UPDATE sessions SET status = 'done'")).toThrow(/read-only|only allows/);
    expect(() => query.sql("SELECT 1; SELECT 2")).toThrow(/one statement/);
  });

  it("allows bounded schema inspection pragmas", () => {
    const { query } = harness();

    expect(query.sql("PRAGMA table_info(sessions)").rows.some((row) => row.name === "sessionId")).toBe(true);
    expect(() => query.sql("PRAGMA user_version = 1")).toThrow(/not allowed/);
  });

  it("loads metric alert context behind one schema-aware helper", () => {
    const { db, query } = harness();
    const now = 20_000;

    db.run(
      "INSERT INTO projects (id, path, name, owner, updated_at) VALUES (?, ?, ?, ?, ?)",
      ["p1", "shared/projects/p1", "Project One", "arc", now],
    );
    db.run(
      `INSERT INTO metrics
        (id, name, owner, current, threshold, target, priority, project, status, updated_at, alert_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["session.failed-triage-rate-3h", "Failed triage rate", "may", 0.4, 0.8, 1, "P1", "p1", "active", now, "<"],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["session.failed-triage-rate-3h", "threshold", "below target", now - 100],
    );
    db.run(
      "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?, ?, ?, ?, ?, ?)",
      ["session.failed-triage-rate-3h", 0.4, 9, now, "may", "latest"],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["evaluation.reviewed", "evaluator", "may", JSON.stringify({ ok: true }), now],
    );

    const context = query.metricAlertContext({
      metricId: "session.failed-triage-rate-3h",
      relatedEventTypes: ["evaluation.reviewed"],
      snapshotLimit: 1,
      eventLimit: 1,
    });

    expect(context.metric).toMatchObject({
      id: "session.failed-triage-rate-3h",
      explicitOwner: "may",
      projectOwner: "arc",
      alertOp: "<",
    });
    expect(context.alert).toMatchObject({ metric_id: "session.failed-triage-rate-3h", message: "below target" });
    expect(context.snapshots).toMatchObject([{ value: 0.4, sample_size: 9, measured_by: "may" }]);
    expect(context.relatedEvents).toMatchObject([{ event_type: "evaluation.reviewed", owner: "may" }]);
  });

  it("loads metric alert reactor preflight state behind one schema-aware helper", () => {
    const { db, query } = harness();
    const now = 50_000;

    db.run(
      "INSERT INTO projects (id, path, name, owner, updated_at) VALUES (?, ?, ?, ?, ?)",
      ["p1", "shared/projects/p1", "Project One", "arc", now],
    );
    db.run(
      `INSERT INTO metrics
        (id, name, owner, current, threshold, target, priority, project, status, updated_at, alert_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["handler.failed-count", "Handler failures", "may", 5, 3, 0, "P1", "p1", "active", now, ">"],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["handler.failed-count", "threshold", "above threshold", now - 1_000],
    );
    const alert = db.prepare("SELECT id FROM metric_alerts WHERE metric_id = ?").get("handler.failed-count") as { id: number };
    db.run(
      "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?, ?, ?, ?, ?, ?)",
      ["handler.failed-count", 5, 12, now, "may", "latest"],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["wr_triage", "metric-alert-triage", `Run metric alert triage for handler.failed-count\n{"alertId": ${alert.id}}`, "done", now - 500],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s_owner", "arc", "handle alert", "done", "metric-alert-reactor:handler.failed-count", now - 400],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, metric_id, alert_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["metric.alert_judged", "arc", "may", JSON.stringify({ metricId: "handler.failed-count", alertId: alert.id }), "handler.failed-count", String(alert.id), now - 300],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, metric_id, alert_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "metric.feedback.routed",
        "project-app-loader",
        "agent:arc",
        JSON.stringify({ metricId: "handler.failed-count", alertId: alert.id, route: "owner-app" }),
        "handler.failed-count",
        String(alert.id),
        now - 350,
      ],
    );

    const state = query.metricAlertReactorState({
      metricId: "handler.failed-count",
      owner: "arc",
      since: now - 2_000,
    });

    expect(state.metric).toMatchObject({
      id: "handler.failed-count",
      explicitOwner: "may",
      projectOwner: "arc",
      alertOp: ">",
    });
    expect(state.alert).toMatchObject({ id: alert.id, metric_id: "handler.failed-count" });
    expect(state.latestSnapshot).toMatchObject({ value: 5, sample_size: 12 });
    expect(state.latestJudgment).toMatchObject({ id: expect.any(Number) });
    expect(state.recentFeedbackRouted).toMatchObject({ id: expect.any(Number), owner: "agent:arc" });
    expect(state.recentTriageRun).toMatchObject({ runId: "wr_triage", status: "done" });
    expect(state.recentTriageJudgment).toMatchObject({ id: expect.any(Number) });
    expect(state.recentOwnerSession).toMatchObject({ sessionId: "s_owner", status: "done" });
    expect(state.recentOwnerSessionJudgment).toMatchObject({ id: expect.any(Number) });
  });

  it("scopes metric alert judgments to the current alert id", () => {
    const { db, query } = harness();
    const now = 90_000;

    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, status, updated_at, alert_op) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["session.failed-triage-rate-3h", "Failed triage", "evaluator", 0, 0.8, 1, "P1", "active", now, "<"],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at, resolved_at) VALUES (?, ?, ?, ?, ?)",
      ["session.failed-triage-rate-3h", "threshold", "old alert", now - 10_000, now - 5_000],
    );
    const oldAlert = db.prepare("SELECT id FROM metric_alerts WHERE message = ?").get("old alert") as { id: number };
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["session.failed-triage-rate-3h", "threshold", "new alert", now - 1_000],
    );
    const newAlert = db.prepare("SELECT id FROM metric_alerts WHERE message = ?").get("new alert") as { id: number };
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["wr_old", "metric-alert-triage", `Run metric alert triage for session.failed-triage-rate-3h\n{\"alertId\": ${oldAlert.id}}`, "done", now - 4_500],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s_old", "evaluator", "old triage", "done", "metric-alert-reactor:session.failed-triage-rate-3h", now - 4_400],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, metric_id, alert_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "metric.alert_judged",
        "evaluator",
        "agent:evaluator",
        JSON.stringify({ metricId: "session.failed-triage-rate-3h", alertId: oldAlert.id, operation: "waiting_with_evidence" }),
        "session.failed-triage-rate-3h",
        String(oldAlert.id),
        now - 4_000,
      ],
    );

    const state = query.metricAlertReactorState({
      metricId: "session.failed-triage-rate-3h",
      alertId: newAlert.id,
      owner: "evaluator",
      since: now - 20_000,
    });

    expect(state.alert).toMatchObject({ id: newAlert.id, message: "new alert" });
    expect(state.latestJudgment).toBeNull();
    expect(state.recentTriageRun).toBeNull();
    expect(state.recentTriageJudgment).toBeNull();
    expect(state.recentOwnerSessionJudgment).toBeNull();
  });

  it("loads closed-loop steward context as bounded live evidence", () => {
    const { db, query } = harness();
    const now = 80_000;

    db.run(
      "INSERT INTO projects (id, path, name, owner, updated_at) VALUES (?, ?, ?, ?, ?)",
      ["p1", "shared/projects/p1", "Project One", "arc", now],
    );
    db.run(
      `INSERT INTO metrics
        (id, name, owner, current, threshold, target, priority, project, status, updated_at, alert_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["handler.failed-count", "Handler failures", "may", 5, 3, 0, "P1", "p1", "active", now, ">"],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["handler.failed-count", "threshold", "above threshold", now - 2_000],
    );
    const alert = db.prepare("SELECT id FROM metric_alerts WHERE metric_id = ?").get("handler.failed-count") as { id: number };
    db.run(
      "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?, ?, ?, ?, ?, ?)",
      ["handler.failed-count", 5, 4, now - 100, "may", "latest"],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, metric_id, alert_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["metric.alert_judged", "may", "may", JSON.stringify({ metricId: "handler.failed-count", alertId: alert.id }), "handler.failed-count", String(alert.id), now - 500],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["message.delivery_failed", "telegram", "may", JSON.stringify({ reason: "send failed" }), now - 300],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["wr_triage", "metric-alert-triage", "Run metric alert triage for handler.failed-count", "running", now - 250],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["wr_steward", "closed-loop-steward", "audit", "done", now - 200],
    );

    const context = query.closedLoopStewardContext({
      now,
      lookbackMs: 1_000,
      alertLimit: 1,
      deliveryFailureLimit: 1,
    });

    expect(context.schemaBrief.some((line) => line.startsWith("- sessions:"))).toBe(true);
    expect(context.runningStewardRun).toBeNull();
    expect(context.alerts).toHaveLength(1);
    expect(context.alerts[0].alert).toMatchObject({
      metric_id: "handler.failed-count",
      explicitOwner: "may",
      projectOwner: "arc",
      alertOp: ">",
    });
    expect(context.alerts[0].latestJudgment).toMatchObject({ id: expect.any(Number) });
    expect(context.alerts[0].latestSnapshot).toMatchObject({ value: 5 });
    expect(context.alerts[0].activeTriageRun).toMatchObject({ runId: "wr_triage", status: "running" });
    expect(context.deliveryFailures).toMatchObject([{ source: "telegram", owner: "may" }]);
    expect(context.recentStewardRuns).toMatchObject([{ runId: "wr_steward", status: "done" }]);
  });

  it("loads heartbeat context behind one schema-aware helper", () => {
    const { db, query } = harness();
    const now = 90_000;

    db.run(
      "INSERT INTO projects (id, path, name, owner, updated_at) VALUES (?, ?, ?, ?, ?)",
      ["p1", "shared/projects/p1", "Project One", "arc", now],
    );
    db.run(
      `INSERT INTO metrics
        (id, name, owner, current, threshold, target, priority, project, status, updated_at, alert_op, source_command)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["arc.quality", "Quality", null, 0.5, 0.8, 1, "P1", "p1", "active", now, "<", "echo quality"],
    );
    db.run(
      `INSERT INTO metrics
        (id, name, owner, current, threshold, target, priority, status, updated_at, alert_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["may.health", "Health", "may", 1, 0.8, 1, "P2", "active", now, "<"],
    );
    db.run(
      "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?, ?, ?, ?, ?, ?)",
      ["arc.quality", 0.5, 7, now - 10, "may", "latest"],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.quality", "threshold", "quality below target", now - 100],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp, urgency, ttl_ms, delivery_status, delivery_route) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["project.nudge", "test", "agent:arc", JSON.stringify({ summary: "resume project" }), now - 100, "immediate", 10_000, "accepted", "owner_inbox"],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp, urgency, ttl_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["project.nudge", "test", "arc", JSON.stringify({ summary: "legacy bare owner" }), now - 50, "immediate", 10_000],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp, urgency, ttl_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["stale", "test", "arc", JSON.stringify({ summary: "expired" }), now - 20_000, "normal", 1],
    );

    const context = query.heartbeatContext({
      agent: "arc",
      now,
      metricLimit: 3,
      metricSnapshotLimit: 1,
      alertLimit: 3,
      inboxLimit: 3,
    });

    expect(context.now).toBe(now);
    expect(context.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "arc.quality",
          explicitOwner: null,
          projectOwner: "arc",
          alertOp: "<",
          sourceCommand: "echo quality",
          snapshots: [expect.objectContaining({ value: 0.5, sampleSize: 7, measuredBy: "may" })],
        }),
      ]),
    );
    expect(context.alerts).toMatchObject([
      { metricId: "arc.quality", message: "quality below target", explicitOwner: null, projectOwner: "arc" },
    ]);
    expect(context.inbox).toMatchObject([
      { eventType: "project.nudge", urgency: "immediate" },
    ]);
    expect(context.inbox).toHaveLength(1);
  });

  it("loads evaluator deep-eval scan context behind one schema-aware helper", () => {
    const { db, query } = harness();
    const now = 120_000;

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt, endedAt, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["s_low", "dev", "fix a bug", "done", "workflow:dev-heartbeat", now - 20_000, now - 10_000, 4],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt, endedAt, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["s_good", "scout", "research", "done", "workflow:project", now - 30_000, now - 20_000, 8],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt, endedAt, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["s_deep_done", "arc", "already deep evaluated", "done", "workflow:project", now - 40_000, now - 30_000, 99],
    );
    db.run(
      `INSERT INTO evaluations
        (sessionId, agent, quality, efficiency, productiveCalls, wastedCalls, verdict, issues, overall,
         evaluatedByHeuristic, skippedByJs, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_good", "scout", 0.9, 0.8, 8, 0, "good", "[]", "{}", 1, 0, now - 19_000],
    );
    db.run(
      `INSERT INTO evaluations
        (sessionId, agent, quality, efficiency, productiveCalls, wastedCalls, verdict, issues, overall,
         evaluatedByHeuristic, skippedByJs, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_deep_done", "arc", 0.9, 0.8, 8, 0, "good", "[]", "{}", 0, 0, now - 29_000],
    );

    const context = query.evaluatorDeepEvalScan({
      now,
      backfillHours: 1,
      fallbackDelayMs: 0,
      activeWindowMs: 1,
    });

    expect(context.activeDeepEval).toBe(false);
    expect(context.candidate).toMatchObject({
      sessionId: "s_good",
      agent: "scout",
      heuristicVerdict: "good",
      opCount: 8,
    });

    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["wr_deep", "evaluator-deep-eval", "deep eval", "running", now - 1],
    );

    expect(query.evaluatorDeepEvalScan({ now, activeWindowMs: 60_000 }).activeDeepEval).toBe(true);
  });

  it("loads evaluator aftermath session context behind one schema-aware helper", () => {
    const { db, query } = harness();
    const now = 140_000;

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt, endedAt, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["s_after", "dev", "fix bug", "done", "workflow:dev-heartbeat", now - 2_000, now - 1_000, 5],
    );
    db.run(
      `INSERT INTO evaluations
        (sessionId, agent, quality, efficiency, productiveCalls, wastedCalls, verdict, issues, overall,
         evaluatedByHeuristic, skippedByJs, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_after", "dev", 0.85, 0.8, 5, 0, "good", "[]", JSON.stringify({ heuristicVersion: 4 }), 1, 0, now],
    );

    const context = query.evaluatorAftermathContext({ sessionId: "s_after" });

    expect(context).toMatchObject({
      sessionId: "s_after",
      session: { sessionId: "s_after", agent: "dev", status: "done", opCount: 5 },
      evaluation: { sessionId: "s_after", verdict: "good", createdAt: now },
    });
  });
});

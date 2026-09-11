import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { createMetricService } from "../../../lib/metrics.js";
import { healthWindow, readWorkflowHealth, workflowHealthQuery, HEALTH_GROUP_LIMIT } from "./workflow-health.js";
import { readMetricHistory, readMetricObservations, METRIC_HISTORY_LIMIT } from "./metric-observations.js";

describe("SQLite health observations", () => {
  let db: SqliteDb;
  const now = 2_000_000_000_000;
  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
  });
  afterEach(() => db.close());
  const query = (params = "") =>
    workflowHealthQuery(new URLSearchParams(`start=${now - 1000}&end=${now}&${params}`), now);
  function run(
    id: string,
    status: string,
    endedAt: number | null = now - 1,
    parent: string | null = null,
    startedAt = now - 500,
    source = "agents/worker/workflows/report.ts",
  ) {
    db.prepare(
      `INSERT INTO workflow_runs(runId, workflow, task, status, startedAt, endedAt, parentWorkflowRunId, sourcePath)
      VALUES (?, 'report', 'Synthetic report', ?, ?, ?, ?, ?)`,
    ).run(id, status, startedAt, endedAt, parent, source);
  }

  test("one finished cohort preserves four outcomes, retries and separate nested/running work", () => {
    ["done", "done", "done", "done", "done", "done", "error", "error", "blocked", "interrupted"].forEach((status, i) =>
      run(`run_${i}`, status),
    );
    run("nested", "error", now - 1, "run_6");
    run("active", "running", null);
    run("old", "done", now - 1001);
    run("edge", "done", now);
    const report = readWorkflowHealth(db, query("runs=true&outcome=error"), now);
    expect(report.totals).toMatchObject({
      finished: 10,
      done: 6,
      error: 2,
      blocked: 1,
      interrupted: 1,
      successRate: 0.6,
      durationCount: 10,
    });
    expect(report.running).toBe(1);
    expect(report.matchingRuns).toBe(2);
    expect(report.runs.map((r) => r.runId)).toEqual(["run_7", "run_6"]);
    expect(readWorkflowHealth(db, query("scope=all"), now).totals.error).toBe(3);
    expect(readWorkflowHealth(db, query("sourcePath=other"), now).totals.successRate).toBeNull();
  });

  test("invalid duration and unplaceable finished evidence are visible, not fabricated zeros", () => {
    run("bad-time", "done", now - 10, null, now - 1);
    run("missing-end", "error", null);
    run("bad-outcome", "unexpected");
    const report = readWorkflowHealth(db, query(), now);
    expect(report.totals).toMatchObject({
      finished: 1,
      durationCount: 0,
      meanDurationMs: null,
      maxDurationMs: null,
      unknownOutcomes: 1,
    });
    expect(report.coverage.undatedFinishedStartedInWindow).toBe(1);
    expect(readWorkflowHealth(db, query("workflow=unknown"), now).totals).toMatchObject({
      finished: 0,
      successRate: null,
    });
  });

  test("exact source groups and keyset paging do not drop equal-time runs or truncate totals", () => {
    for (let i = 0; i < HEALTH_GROUP_LIMIT + 5; i++)
      run(`run_${String(i).padStart(3, "0")}`, "done", now - 1, null, now - 10, `source-${i}`);
    const first = readWorkflowHealth(db, query("runs=true"), now);
    expect(first.groups).toHaveLength(HEALTH_GROUP_LIMIT);
    expect(first.groupsTruncated).toBeTrue();
    expect(first.totals.finished).toBe(105);
    const ids = first.runs.map((r) => r.runId);
    let next = first.next;
    while (next) {
      const page = readWorkflowHealth(
        db,
        query("runs=true&" + new URLSearchParams({ before: String(next.before), beforeId: next.beforeId })),
        now,
      );
      ids.push(...page.runs.map((r) => r.runId));
      next = page.next;
    }
    expect(new Set(ids).size).toBe(105);
    expect(ids).toHaveLength(105);
    expect(readWorkflowHealth(db, query("sourcePath=source-1"), now).totals.finished).toBe(1);
  });

  test("latest observation wins over cache edits, late arrivals and timestamp ties; errors remain separate", () => {
    const metrics = createMetricService({ getDb: () => db, now: () => now });
    metrics.define({ id: "sample", type: "gauge", measureInterval: 100, threshold: 3, alertOp: ">" });
    metrics.record("sample", 5, { measuredAt: now - 300, sampleSize: 10, note: "original" });
    metrics.record("sample", 6, { measuredAt: now - 300, sampleSize: 11, note: "tie wins" });
    metrics.record("sample", 999, { measuredAt: now - 400 });
    metrics.define({ id: "sample", type: "gauge", measureInterval: 100, threshold: 3, alertOp: ">" });
    db.prepare(
      `INSERT INTO events(event_type, metric_id, timestamp, data) VALUES ('metric.measurement.failed', 'sample', ?, ?)`,
    ).run(now - 100, JSON.stringify({ reason: "source unavailable" }));
    let observed = readMetricObservations(db, now).metrics[0]!;
    expect(observed).toMatchObject({
      current: 6,
      freshness: "stale",
      thresholdBreached: true,
      observation: { measuredAt: now - 300, sampleSize: 11, note: "tie wins" },
      collectionFailure: { afterLastSample: true, reason: "source unavailable" },
    });
    metrics.record("sample", 2, { measuredAt: now - 1 });
    observed = readMetricObservations(db, now).metrics[0]!;
    expect(observed).toMatchObject({ freshness: "fresh", current: 2, collectionFailure: { afterLastSample: false } });
    db.exec("DELETE FROM metric_snapshots");
    expect(readMetricObservations(db, now).metrics[0]).toMatchObject({
      current: null,
      observation: null,
      freshness: "missing",
    });
  });

  test("no cadence/future samples do not claim freshness, and P3 does not disable alert policy", () => {
    const metrics = createMetricService({ getDb: () => db });
    metrics.define({ id: "sample", priority: "P3", threshold: 1, alertOp: ">" });
    metrics.record("sample", 4, { measuredAt: now - 1 });
    expect(readMetricObservations(db, now).metrics[0]).toMatchObject({
      freshness: "unknown",
      thresholdBreached: true,
      alertsDisabled: false,
    });
    metrics.define({ id: "sample", measureInterval: 100, config: { alert: { disabled: true } } });
    metrics.record("sample", 4, { measuredAt: now + 1 });
    expect(readMetricObservations(db, now).metrics[0]).toMatchObject({ freshness: "unknown", alertsDisabled: true });
  });

  test("history is time-bounded, ordered deterministically and explicitly limited", () => {
    const insert = db.prepare("INSERT INTO metric_snapshots(metric_id, value, measured_at) VALUES (?, ?, ?)");
    for (let i = 0; i < METRIC_HISTORY_LIMIT + 2; i++) insert.run("sample", i, now - 10);
    insert.run("sample", -1, now);
    const history = readMetricHistory(db, "sample", { start: now - 1000, end: now });
    expect(history.truncated).toBeTrue();
    expect(history.snapshots).toHaveLength(METRIC_HISTORY_LIMIT);
    expect(history.snapshots[0]).toMatchObject({ value: 2 });
    expect(history.snapshots.at(-1)).toMatchObject({ value: METRIC_HISTORY_LIMIT + 1 });
    for (const params of [
      "days=0",
      "days=-1",
      "days=91",
      "start=NaN",
      `end=${now + 1}`,
      "scope=bogus",
      "outcome=oops",
      "before=2",
    ]) {
      expect(() => workflowHealthQuery(new URLSearchParams(params), now)).toThrow();
    }
    expect(healthWindow(new URLSearchParams("days=7"), now)).toEqual({ start: now - 7 * 86400000, end: now });
  });

  test("both top-level and all-run time windows use indexed range reads", () => {
    for (const predicate of ["", "parentWorkflowRunId IS NULL AND "]) {
      const plan = db
        .prepare(`EXPLAIN QUERY PLAN SELECT COUNT(*) FROM workflow_runs WHERE ${predicate}endedAt >= ? AND endedAt < ?`)
        .all(now - 1000, now) as Array<{ detail: string }>;
      expect(
        plan.some((row) => /SEARCH workflow_runs USING.*idx_wfr_(parent_ended|ended)/.test(row.detail)),
      ).toBeTrue();
    }
  });

  test("open-alert ordering uses partial indexes globally and for an exact metric", () => {
    // Schema access-path contract; HTTP tests exercise the actual joined readers.
    // Many resolved alerts must not require a table scan or a temporary sort.
    db.exec(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i + 1 FROM n WHERE i < 10000)
      INSERT INTO metric_alerts(metric_id, created_at, resolved_at)
      SELECT 'sample', i, i FROM n`);
    db.exec("INSERT INTO metric_alerts(metric_id, created_at) VALUES ('sample', 1), ('other', 2)");
    // Simulate an existing store upgrading, then opening again; rows stay intact.
    db.exec("DROP INDEX IF EXISTS idx_ma_open_created; DROP INDEX IF EXISTS idx_ma_open_metric_created");
    applyDbSchema(db);
    applyDbSchema(db);
    expect(db.prepare("SELECT COUNT(*) AS count FROM metric_alerts").get()).toEqual({ count: 10002 });
    for (const [filter, args, index] of [
      ["", [], "idx_ma_open_created"],
      ["AND metric_id = ?", ["sample"], "idx_ma_open_metric_created"],
    ] as const) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT id, metric_id, message, created_at
        FROM metric_alerts WHERE resolved_at IS NULL ${filter}
        ORDER BY created_at DESC, id DESC LIMIT ?`).all(...args, 21) as Array<{ detail: string }>;
      expect(plan.some((row) => row.detail.includes(index))).toBeTrue();
      expect(plan.some((row) => /TEMP B-TREE|SCAN metric_alerts$/.test(row.detail))).toBeFalse();
    }
  });
});

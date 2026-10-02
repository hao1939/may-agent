import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { openDatabase, type SqliteDb } from "../may-agent/src/lib/db.js";
import { applyDbSchema } from "../may-agent/src/lib/db/schema.js";
import { closeDb, getDb } from "../may-agent/src/lib/db/connection.js";
import { EventBus } from "../may-agent/src/app/core/events/bus.js";
import { createAppReporting } from "../may-agent/src/app/composition/reporting.js";
import { measureSourceMetrics } from "../may-agent/src/app/metric-source-measurement.js";
import { createAppScheduleProducer } from "../may-agent/src/app/adapters/producers/app-schedules.js";
import {
  createAppInboxItem,
  recordAppInboxRecoveryFailure,
  resolveAppInboxRecovery,
} from "../may-agent/src/app/core/state/app-inbox-store.js";
import {
  EVALUATION_OPERATION_METRIC,
  reliabilityMetrics,
  REVIEW_LAG_METRIC,
  SQL_LATENCY_METRIC,
  SQL_TIME_METRIC,
} from "./reliability-metrics.js";
import {
  SQL_DIAGNOSTIC_MAX_AGE_MS,
  SQL_DIAGNOSTIC_NOTE_MAX_CHARS,
  sqlLatencySample,
} from "./scripts/daemon-sql-latency.js";
import app, { evaluationOperationAlertInput } from "./app.js";

let db: SqliteDb;
beforeEach(() => {
  db = openDatabase(":memory:");
  applyDbSchema(db);
});
afterEach(() => db.close());
function sample(id: string) {
  return db
    .prepare(
      reliabilityMetrics.find((metric) => metric.id === id)!.sourceQuery!,
    )
    .get() as any;
}

function sqlHeartbeat(
  store: SqliteDb,
  at: number,
  pid: number,
  since: number,
  totalMs: number,
) {
  store
    .prepare(
      "INSERT INTO events(event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      "runtime.daemon.heartbeat",
      "daemon",
      "agent:may",
      JSON.stringify({
        pid,
        sql: { since, totalMs, calls: totalMs, errors: 0, untrackedCalls: 0 },
      }),
      at,
    );
}

test("SQL cost uses recent counter deltas, separates restarts and keeps absent or stale coverage unknown", () => {
  const now = Date.now();
  expect(sample(SQL_TIME_METRIC)).toBeNull();
  sqlHeartbeat(db, now - 400_000, 10, 1, 200_000);
  sqlHeartbeat(db, now - 300_000, 10, 1, 250_000);
  expect(sample(SQL_TIME_METRIC)).toBeNull(); // old samples cannot report current health
  sqlHeartbeat(db, now - 200_000, 11, 2, 1_000);
  sqlHeartbeat(db, now - 100_000, 11, 2, 26_000);
  // 75 seconds of SQL in 200 seconds of observed time, without bridging a restart.
  expect(sample(SQL_TIME_METRIC)).toMatchObject({ value: 37.5, sampleSize: 4 });
  const note = JSON.parse(sample(SQL_TIME_METRIC).note);
  expect(note).toMatchObject({ elapsedMs: 200_000, sqlMs: 75_000 });
  expect(note.nextRead).toContain("diagnostics.sql");
  const plan = db
    .prepare(
      `EXPLAIN QUERY PLAN ${reliabilityMetrics.find((metric) => metric.id === SQL_TIME_METRIC)!.sourceQuery}`,
    )
    .all();
  expect(
    plan.some((step) =>
      String(step.detail).includes(
        "idx_events_type (event_type=? AND timestamp>? AND timestamp<?)",
      ),
    ),
  ).toBe(true);
});

test("recent SQL call latency retains a slow call under low aggregate load with bounded masked evidence", () => {
  const now = Date.now();
  sqlHeartbeat(db, now - 120_000, 22, now - 300_000, 1_000);
  sqlHeartbeat(db, now - 60_000, 22, now - 300_000, 1_100);
  expect(sample(SQL_TIME_METRIC).value).toBeCloseTo((100 / 60_000) * 100);

  const slow = {
    id: "all:6ea5fa410384c38f",
    operation: "all",
    sql: "SELECT * FROM report_links WHERE task_id = ? AND secret = ?",
    calls: 1,
    totalMs: 13_127.34,
    averageMs: 13_127.34,
    maxMs: 13_127.34,
  };
  const status = {
    type: "status",
    command: "status",
    diagnostics: {
      pid: 22,
      sql: {
        since: now - 300_000,
        measuredAt: now,
        maxMs: 99_999, // process-lifetime maximum is deliberately ignored
        queryLimit: 512,
        untracked: { calls: 0 },
        queries: {
          since: now - 300_000,
          until: now,
          trackedQueries: 2,
          topByTotalTime: [slow],
          topByWorstTime: [slow],
        },
      },
    },
  };
  const observed = sqlLatencySample(status, now);
  expect(observed).toMatchObject({
    value: 13_127.34,
    sampleSize: 1,
    measuredAt: now,
  });
  expect(observed.note.length).toBeLessThanOrEqual(
    SQL_DIAGNOSTIC_NOTE_MAX_CHARS,
  );
  expect(JSON.parse(observed.note)).toMatchObject({
    pid: 22,
    sqlSince: now - 300_000,
    coverage: {
      lifetimeUntrackedCalls: 0,
      selectedRowsTruncated: false,
      shapeTextTruncated: false,
    },
    queries: [
      {
        fingerprint: "all:6ea5fa410384c38f",
        operation: "all",
        shape: slow.sql,
        count: 1,
        totalMs: 13_127.34,
        averageMs: 13_127.34,
        worstMs: 13_127.34,
        window: { since: now - 300_000, until: now },
      },
    ],
  });
});

test("recent SQL call latency rejects missing or expired rankings and bounds ranked evidence", () => {
  const now = Date.now();
  expect(() => sqlLatencySample({ diagnostics: {} }, now)).toThrow(
    "identity is unavailable",
  );
  const row = (index: number) => ({
    id: `all:${String(index).padStart(16, "0")}`,
    operation: "all",
    sql: `SELECT ${"masked_shape ".repeat(80)}?`,
    calls: index + 1,
    totalMs: 20_000 - index,
    averageMs: 100,
    maxMs: 2_000 - index,
  });
  const status = {
    diagnostics: {
      pid: 9,
      sql: {
        since: now - 600_000,
        measuredAt: now,
        queryLimit: 512,
        untracked: { calls: 7 },
        queries: {
          since: now - 300_000,
          until: now,
          trackedQueries: 10,
          topByTotalTime: Array.from({ length: 10 }, (_, index) => row(index)),
          topByWorstTime: Array.from({ length: 10 }, (_, index) => row(index)),
        },
      },
    },
  };
  const observed = sqlLatencySample(status, now);
  const note = JSON.parse(observed.note);
  expect(observed.note.length).toBeLessThanOrEqual(
    SQL_DIAGNOSTIC_NOTE_MAX_CHARS,
  );
  expect(note.coverage).toMatchObject({
    lifetimeUntrackedCalls: 7,
    rankedUniqueQueries: 10,
    retainedQueries: 6,
    selectedRowsTruncated: true,
    shapeTextTruncated: true,
    windows: [{ trackedQueries: 10, rankedCoverageTruncated: false }],
  });
  expect(note.queries).toHaveLength(6);
  expect(() =>
    sqlLatencySample(
      {
        ...status,
        diagnostics: {
          ...status.diagnostics,
          sql: {
            ...status.diagnostics.sql,
            measuredAt: now - SQL_DIAGNOSTIC_MAX_AGE_MS - 1,
          },
        },
      },
      now,
    ),
  ).toThrow("stale");
});

test("SQL latency evidence preserves the worst-call witness across windows and note trimming", () => {
  const now = Date.now();
  const fast = Array.from({ length: 8 }, (_, index) => ({
    id: `fast:${index}`,
    operation: "all",
    sql: `SELECT ${"wide_shape ".repeat(80)}?`,
    calls: 1_000,
    totalMs: 100_000 - index,
    averageMs: 10,
    maxMs: 10,
  }));
  const slow = { id: "slow:witness", operation: "get", sql: "SELECT slow ?", calls: 1, totalMs: 2_001, averageMs: 2_001, maxMs: 2_001 };
  const observed = sqlLatencySample({ diagnostics: { pid: 7, sql: {
    since: now - 600_000, measuredAt: now, queryLimit: 8, untracked: { calls: 3 },
    queries: { since: now - 300_000, until: now, trackedQueries: 20, topByTotalTime: fast, topByWorstTime: fast },
    previousQueries: { since: now - 600_000, until: now - 300_000, trackedQueries: 1, topByTotalTime: [slow], topByWorstTime: [slow] },
  } } }, now);
  const note = JSON.parse(observed.note);
  expect(observed.value).toBe(2_001);
  expect(observed.note.length).toBeLessThanOrEqual(SQL_DIAGNOSTIC_NOTE_MAX_CHARS);
  expect(note.queries[0].fingerprint).toBe("slow:witness");
  expect(note.queries.slice(1).every((row: any) => row.fingerprint.startsWith("fast:"))).toBe(true);
  expect(note.coverage).toMatchObject({
    lifetimeUntrackedCalls: 3,
    selectedRowsTruncated: true,
    shapeTextTruncated: true,
    windows: [
      { name: "current", trackedQueries: 20, rankedCoverageTruncated: true },
      { name: "previous", trackedQueries: 1, rankedCoverageTruncated: false },
    ],
  });
});

test("SQL latency rejects coercible and non-finite identity or timing fields", () => {
  const now = Date.now();
  const valid = { diagnostics: { pid: 7, sql: { since: now - 1, measuredAt: now,
    queries: { since: now - 1, until: now, trackedQueries: 1, topByTotalTime: [{ id: "x", operation: "get", sql: "SELECT ?", calls: 1, totalMs: 1, averageMs: 1, maxMs: 1 }], topByWorstTime: [] },
  } } };
  for (const bad of [null, true, "", Infinity]) {
    const identity = structuredClone(valid) as any;
    identity.diagnostics.pid = bad;
    expect(() => sqlLatencySample(identity, now)).toThrow();
    const timing = structuredClone(valid) as any;
    timing.diagnostics.sql.queries.topByTotalTime[0].maxMs = bad;
    expect(() => sqlLatencySample(timing, now)).toThrow("malformed");
  }
  const emptyIdentity = structuredClone(valid) as any;
  emptyIdentity.diagnostics.sql.queries.topByTotalTime[0].id = "";
  expect(() => sqlLatencySample(emptyIdentity, now)).toThrow("malformed");
});

test("SQL latency source command is pinned to the loaded App release rather than collector cwd", () => {
  const metric = reliabilityMetrics.find(
    (item) => item.id === SQL_LATENCY_METRIC,
  )!;
  expect(metric).toMatchObject({
    measureInterval: 300_000,
    threshold: 1_000,
    alertOp: ">",
    unit: "milliseconds",
  });
  const command = metric.sourceCommand!;
  expect(command.startsWith("bun ")).toBe(true);
  const script = JSON.parse(command.slice(4));
  expect(script).toBe(join(import.meta.dir, "scripts/daemon-sql-latency.ts"));
  expect(existsSync(script)).toBe(true);
});

test("Host source collection retains diagnostic evidence and opens one metric breach episode", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-sql-latency-source-"));
  const socketPath = join(root, "diagnostics.sock");
  const previousSocket = process.env.MAY_CONTROL_SOCKET;
  const now = Date.now();
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.on("data", () => {
      socket.end(
        `${JSON.stringify({
          type: "status",
          command: "status",
          diagnostics: {
            pid: 41,
            sql: {
              since: now - 300_000,
              measuredAt: now,
              queryLimit: 512,
              untracked: { calls: 0 },
              queries: {
                since: now - 300_000,
                until: now,
                trackedQueries: 1,
                topByTotalTime: [
                  {
                    id: "get:slowfingerprint",
                    operation: "get",
                    sql: "SELECT value FROM retained WHERE id = ?",
                    calls: 1,
                    totalMs: 1_500,
                    averageMs: 1_500,
                    maxMs: 1_500,
                  },
                ],
                topByWorstTime: [],
              },
            },
          },
        })}\n`,
      );
    });
  });
  try {
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    process.env.MAY_CONTROL_SOCKET = socketPath;
    const store = getDb(root);
    const reporting = createAppReporting(() => store);
    reporting.syncDefinitions([{ definition: app }]);
    const bus = new EventBus();
    const breaches: any[] = [];
    bus.subscribe((event) => {
      if (event.type === "metric.breach") breaches.push(event);
    });
    const result = await measureSourceMetrics({
      bus,
      persistDir: root,
      isDue: (metric) => metric.id === SQL_LATENCY_METRIC,
    });
    expect(result).toEqual({
      measured: [SQL_LATENCY_METRIC],
      skipped: [],
      failures: [],
    });
    const retained = await reporting.readMetric(SQL_LATENCY_METRIC);
    expect(retained).toMatchObject({ value: 1_500, sampleSize: 1 });
    expect(JSON.parse(retained!.note!)).toMatchObject({
      pid: 41,
      queries: [{ fingerprint: "get:slowfingerprint", worstMs: 1_500 }],
    });
    expect(breaches).toHaveLength(1);
    expect(breaches[0].data).toMatchObject({
      metricId: SQL_LATENCY_METRIC,
      current: 1_500,
      alertId: expect.any(Number),
    });
  } finally {
    if (previousSocket === undefined) delete process.env.MAY_CONTROL_SOCKET;
    else process.env.MAY_CONTROL_SOCKET = previousSocket;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("May schedules one normal collection opportunity every five minutes without a Task input", () => {
  let now = 0;
  const bus = new EventBus();
  const observed: unknown[] = [];
  bus.subscribe((event) => {
    if (event.type === "trigger.metrics-snapshot") observed.push(event);
  });
  const producer = createAppScheduleProducer({ bus, now: () => now });
  try {
    producer.replace([{ appDir: "/fixture/may.app", definition: app }]);
    producer.scanNow();
    expect(observed).toEqual([]);
    now = 300_000;
    producer.scanNow();
    producer.scanNow();
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      type: "trigger.metrics-snapshot",
      source: "app:may:schedule:metric-source-collection",
      data: { idempotencyKey: "schedule:may:metric-source-collection:1" },
    });
    now = 600_000;
    producer.scanNow();
    expect(observed).toHaveLength(2);
  } finally {
    producer.close();
  }
});

test("declared reliability metrics collect through the Host and retain a real breach and recovery", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-reliability-collection-"));
  try {
    const store = getDb(root);
    const reporting = createAppReporting(() => store);
    reporting.syncDefinitions([{ definition: app }]);
    const now = Date.now();
    sqlHeartbeat(store, now - 120_000, 1, now - 200_000, 10);
    sqlHeartbeat(store, now - 60_000, 1, now - 200_000, 20);
    const old = Date.now() - 2 * 86400000;
    createAppInboxItem(store, {
      id: "unadmitted",
      appId: "sample",
      source: { kind: "system", id: "fixture" },
      input: { kind: "request", data: {} },
      now: old,
    });
    recordAppInboxRecoveryFailure(
      store,
      "unadmitted",
      "input-admission",
      "mapping unavailable",
      old,
    );
    const bus = new EventBus();
    const collected = await measureSourceMetrics({ bus, persistDir: root });
    // This isolated collector has no daemon diagnostic socket. The new metric
    // must fail visibly rather than recording a healthy zero.
    expect(collected.failures).toEqual([
      { id: SQL_LATENCY_METRIC, reason: expect.stringContaining("ENOENT") },
    ]);
    expect(collected.skipped).toEqual([SQL_LATENCY_METRIC]);
    expect(collected.measured.sort()).toEqual(
      reliabilityMetrics
        .filter((metric) => metric.id !== SQL_LATENCY_METRIC)
        .map((metric) => metric.id)
        .sort(),
    );
    expect(
      await reporting.readMetric("may.unresolved-input-recovery-count"),
    ).toMatchObject({ value: 1, sampleSize: 1 });
    const alert = store
      .prepare("SELECT id, resolved_at FROM metric_alerts WHERE metric_id = ?")
      .get("may.oldest-input-recovery-age-seconds") as {
      id: number;
      resolved_at: number | null;
    };
    const alertId = alert.id;
    expect(alertId).toBeGreaterThan(0);
    expect(alert.resolved_at).toBeNull();
    resolveAppInboxRecovery(store, "unadmitted", "input-admission", Date.now());
    expect(
      (await measureSourceMetrics({ bus, persistDir: root })).failures,
    ).toEqual([
      { id: SQL_LATENCY_METRIC, reason: expect.stringContaining("ENOENT") },
    ]);
    expect(
      await reporting.readMetric("may.unresolved-input-recovery-count"),
    ).toMatchObject({ value: 0, sampleSize: 0 });
    expect(
      store
        .prepare("SELECT resolved_at FROM metric_alerts WHERE id = ?")
        .get(alertId),
    ).toMatchObject({ resolved_at: expect.any(Number) });
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("real Host collection maps one May review input per Evaluation breach episode", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-evaluation-episode-"));
  try {
    const store = getDb(root);
    createAppReporting(() => store).syncDefinitions([{ definition: app }]);
    const now = Date.now();
    const insert = store.prepare(
      `INSERT INTO app_task_attempts(app_id, task_id, attempt_id, task_generation, state, started_at, attempt_json)
       VALUES ('evaluation', 'runtime/compat/owner-review', ?, 4, 'failed', ?, ?)`,
    );
    const addFailure = (index: number) =>
      insert.run(
        `failed-${index}`,
        now - 10_000,
        JSON.stringify({
          startedAt: new Date(now - 10_000).toISOString(),
          finishedAt: new Date(now - 5_000).toISOString(),
          failureReason: "HandlerResultInvalid",
        }),
      );

    const bus = new EventBus();
    const breachEvents: any[] = [];
    bus.subscribe((event) => {
      if (
        event.type === "metric.breach" &&
        event.data.metricId === EVALUATION_OPERATION_METRIC
      ) {
        breachEvents.push(event);
      }
    });
    const collect = () =>
      measureSourceMetrics({
        bus,
        persistDir: root,
        isDue: (metric) => metric.id === EVALUATION_OPERATION_METRIC,
      });
    const reviewInputs = () =>
      breachEvents
        .map((event) =>
          evaluationOperationAlertInput(JSON.parse(JSON.stringify(event))),
        )
        .filter(Boolean);

    addFailure(1);
    await collect();
    addFailure(2);
    await collect();
    expect(breachEvents).toEqual([]);
    addFailure(3);
    await collect();
    expect(breachEvents).toHaveLength(1);
    expect(breachEvents[0]!.data).toMatchObject({
      metricId: EVALUATION_OPERATION_METRIC,
      alertId: expect.any(Number),
      current: 3,
    });
    expect(reviewInputs()).toHaveLength(1);

    addFailure(4);
    await collect();
    expect(breachEvents).toHaveLength(2);
    expect(breachEvents[1]!.data).toMatchObject({
      alertId: breachEvents[0]!.data.alertId,
      repeat: true,
      current: 4,
    });
    expect(reviewInputs()).toHaveLength(1);
    expect(
      store
        .prepare(
          "SELECT COUNT(*) AS count FROM metric_alerts WHERE metric_id = ?",
        )
        .get(EVALUATION_OPERATION_METRIC),
    ).toEqual({ count: 1 });

    store
      .prepare(
        "UPDATE app_task_attempts SET started_at = ? WHERE app_id = 'evaluation'",
      )
      .run(now - 7 * 60 * 60 * 1000);
    await collect();
    expect(
      store
        .prepare(
          "SELECT resolved_at FROM metric_alerts WHERE metric_id = ? ORDER BY id DESC LIMIT 1",
        )
        .get(EVALUATION_OPERATION_METRIC),
    ).toMatchObject({ resolved_at: expect.any(Number) });

    store
      .prepare(
        "UPDATE app_task_attempts SET started_at = ? WHERE app_id = 'evaluation'",
      )
      .run(now - 10_000);
    await collect();
    expect(breachEvents).toHaveLength(3);
    expect(breachEvents[2]!.data.alertId).not.toBe(
      breachEvents[0]!.data.alertId,
    );
    expect(reviewInputs()).toHaveLength(2);
    expect(
      store
        .prepare(
          "SELECT COUNT(*) AS count FROM metric_alerts WHERE metric_id = ?",
        )
        .get(EVALUATION_OPERATION_METRIC),
    ).toEqual({ count: 2 });
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("input metrics include old unadmitted work after feedback and exclude recovered operations", () => {
  const old = Date.now() - 5 * 86400000;
  createAppInboxItem(db, {
    id: "input",
    appId: "sample",
    source: { kind: "system", id: "fixture" },
    input: { kind: "request", data: {} },
    now: old,
  });
  recordAppInboxRecoveryFailure(
    db,
    "input",
    "input-admission",
    "mapping unavailable",
    old,
  );
  expect(sample("may.unresolved-input-recovery-count").value).toBe(1);
  expect(sample("may.oldest-input-recovery-age-seconds").value).toBeGreaterThan(
    4 * 86400,
  );
  const note = JSON.parse(sample("may.unresolved-input-recovery-count").note);
  expect(note.examples[0]).toMatchObject({
    appId: "sample",
    inputId: "input",
    stage: "input-admission",
    failures: 1,
  });
  resolveAppInboxRecovery(db, "input", "input-admission", Date.now());
  expect(sample("may.unresolved-input-recovery-count").value).toBe(0);
});

test("retains failed attempts after later success and calculates the rate from the same terminal cohort", () => {
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO app_task_attempts(app_id, task_id, attempt_id, task_generation, state, started_at, attempt_json) VALUES (?, ?, ?, 1, ?, ?, ?)`,
  );
  for (const [id, state] of [
    ["failed", "failed"],
    ["recovered", "completed"],
    ["interrupted", "interrupted"],
    ["running", "running"],
  ]) {
    insert.run(
      "sample",
      "same-task",
      id,
      state,
      now - 10000,
      JSON.stringify({
        startedAt: new Date(now - 10000).toISOString(),
        finishedAt:
          state === "running" ? null : new Date(now - 5000).toISOString(),
      }),
    );
  }
  const observed = sample("may.failed-task-attempts-24h");
  expect(observed.value).toBe(1);
  expect(observed.sampleSize).toBe(3);
  expect(JSON.parse(observed.note)).toMatchObject({
    failurePercent: 33.333,
    examples: [{ appId: "sample", taskId: "same-task", attemptId: "failed" }],
  });
});

test("Evaluation oversight groups all supported unsuccessful kinds by Task generation", () => {
  expect(sample(EVALUATION_OPERATION_METRIC)).toMatchObject({
    value: 0,
    sampleSize: 0,
  });
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO app_task_attempts(app_id, task_id, attempt_id, task_generation, state, started_at, attempt_json) VALUES ('evaluation', ?, ?, ?, ?, ?, ?)`,
  );
  const add = (
    taskId: string,
    attemptId: string,
    generation: number,
    state: string,
    extra: Record<string, unknown> = {},
  ) =>
    insert.run(
      taskId,
      attemptId,
      generation,
      state,
      now - 10_000,
      JSON.stringify({
        startedAt: new Date(now - 10_000).toISOString(),
        finishedAt: new Date(now - 5_000).toISOString(),
        ...extra,
      }),
    );
  add("runtime/compat/owner-review", "failed", 7, "failed", {
    failureReason: "HandlerResultInvalid",
  });
  add("runtime/compat/owner-review", "incomplete", 7, "completed", {
    acceptedResult: { state: "incomplete" },
  });
  add("runtime/compat/owner-review", "stale", 7, "interrupted", {
    failureReason: "stale-reconciliation-result",
  });
  add("runtime/compat/owner-review", "cancelled", 7, "interrupted", {
    failureReason: "owner-stopped",
  });
  add("another", "other-generation", 2, "failed");

  const observed = sample(EVALUATION_OPERATION_METRIC);
  expect(observed).toMatchObject({ value: 3, sampleSize: 5 });
  expect(JSON.parse(observed.note)).toMatchObject({
    denominator: expect.stringContaining("terminal Evaluation attempts"),
    coverage: expect.stringContaining("accepted incomplete"),
    groups: [
      {
        taskId: "runtime/compat/owner-review",
        generation: 7,
        terminal: 4,
        unsuccessful: 3,
        failedOrRejected: 1,
        acceptedIncomplete: 1,
        staleInterrupted: 1,
      },
      {
        taskId: "another",
        generation: 2,
        unsuccessful: 1,
        failedOrRejected: 1,
        acceptedIncomplete: 0,
        staleInterrupted: 0,
      },
    ],
  });
});

test("overdue reviews route to May once per alert, while an empty population remains explicitly limited", () => {
  const empty = sample("may.failed-task-attempts-24h");
  expect(empty.value).toBe(0);
  expect(empty.sampleSize).toBe(0);
  expect(JSON.parse(empty.note).failurePercent).toBeNull();
  createAppInboxItem(db, {
    id: "review",
    appId: "evaluation",
    source: { kind: "system", id: "fixture" },
    input: { kind: "review-metric", data: {} },
    now: Date.now() - 3 * 86400000,
  });
  expect(sample(REVIEW_LAG_METRIC).value).toBeGreaterThan(2 * 86400);
  const route = app.subscriptions!.find(
    (subscription) => subscription.id === "evaluation-review-lag",
  )!;
  expect(
    route.toInput({
      type: "metric.breach",
      data: { metricId: REVIEW_LAG_METRIC },
    } as any),
  ).toMatchObject({ kind: "message" });
  expect(
    route.toInput({
      type: "metric.breach",
      data: { metricId: REVIEW_LAG_METRIC, repeat: true },
    } as any),
  ).toBeNull();
});

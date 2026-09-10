import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDbSchema } from "../lib/db/schema.js";
import { getDb } from "../lib/requests.js";
import { attachEventPersistence } from "./daemon-events.js";
import { EventBus, EVENT_ROW_ID } from "./core/events/bus.js";
import { WORKFLOW_OUTCOME_METRICS } from "./adapters/reporting/workflow-metrics.js";
import {
  attachMetricSourceMeasurement,
  measureSourceMetrics,
  batchableProjectMetricCommand,
  type MetricSourceMeasurementRuntime,
  INTENTIONAL_OBSERVATION_EVENT_TYPES,
  STALE_ACTIVE_SOURCE_QUERY,
  SUBSCRIBER_FAILED_COUNT_METRIC_ID,
  SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY,
  UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID,
  UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY,
} from "./metric-source-measurement.js";

describe("source-command metric batching", () => {
  it("groups both project and focused metric samplers by their accepted script", () => {
    expect(
      batchableProjectMetricCommand("bun /app/projects/example.app/scripts/project-metrics.ts example.total --json"),
    ).toEqual({
      scriptPath: "/app/projects/example.app/scripts/project-metrics.ts",
      metricId: "example.total",
    });
    expect(
      batchableProjectMetricCommand("bun /app/projects/example.app/scripts/focus-metric-sample.ts example.live --json"),
    ).toEqual({
      scriptPath: "/app/projects/example.app/scripts/focus-metric-sample.ts",
      metricId: "example.live",
    });
    expect(
      batchableProjectMetricCommand("bun /app/projects/example.app/scripts/arbitrary.ts example.live --json"),
    ).toBeNull();
  });
});

describe("source-query metric measurement", () => {
  let persistDir: string;
  let bus: EventBus;
  let measurement: MetricSourceMeasurementRuntime;
  const originalAppRoot = process.env.APP_ROOT;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-metric-source-test-"));
    process.env.APP_ROOT = persistDir;
    bus = new EventBus();
    applyDbSchema(getDb(persistDir));
    attachEventPersistence({ bus, persistDir });
    measurement = attachMetricSourceMeasurement({ bus, persistDir });
  });

  afterEach(() => {
    if (originalAppRoot === undefined) delete process.env.APP_ROOT;
    else process.env.APP_ROOT = originalAppRoot;
  });

  it("preserves live alert calibration while restoring the subscriber failure source", () => {
    const db = getDb(persistDir);
    db.run(
      `UPDATE metrics
       SET owner = 'tech-lead', threshold = 7, priority = 'P1',
           config = '{"alert":{"mode":"consecutive_failures","count":4}}'
       WHERE id = ?`,
      [SUBSCRIBER_FAILED_COUNT_METRIC_ID],
    );

    attachMetricSourceMeasurement({ bus, persistDir });

    expect(
      db
        .prepare("SELECT owner, threshold, priority, config, source_query, measure_interval FROM metrics WHERE id = ?")
        .get(SUBSCRIBER_FAILED_COUNT_METRIC_ID),
    ).toEqual({
      owner: "tech-lead",
      threshold: 7,
      priority: "P1",
      config: '{"alert":{"mode":"consecutive_failures","count":4}}',
      source_query: SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY,
      measure_interval: 300_000,
    });
  });

  it("restores the canonical unexpected-unhandled source while preserving alert calibration", () => {
    const db = getDb(persistDir);
    db.run(
      `UPDATE metrics
       SET owner = 'tech-lead', threshold = 9, priority = 'P2',
           source_query = 'SELECT 999 AS value'
       WHERE id = ?`,
      [UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID],
    );

    attachMetricSourceMeasurement({ bus, persistDir });

    expect(
      db
        .prepare("SELECT owner, threshold, priority, source_query, measure_interval FROM metrics WHERE id = ?")
        .get(UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID),
    ).toEqual({
      owner: "tech-lead",
      threshold: 9,
      priority: "P2",
      source_query: UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY,
      measure_interval: 300_000,
    });
  });

  it("excludes declared Host lifecycle observations but counts unconsumed actionable signals", () => {
    const db = getDb(persistDir);
    const insert = db.prepare(
      `INSERT INTO events
         (event_type, source, owner, data, timestamp, delivery_status)
       VALUES (?, 'fixture', 'agent:may', '{}', ?, 'unhandled')`,
    );
    for (const type of INTENTIONAL_OBSERVATION_EVENT_TYPES) insert.run(type, Date.now());
    insert.run("message.created", Date.now());
    insert.run("session.recovery.requested", Date.now());
    insert.run("project.task.reconciled", Date.now() - 3_600_001);

    expect(db.prepare(UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY).get()).toEqual({ value: 2 });
  });

  it("registers source measurement as passive observation, not synchronous acceptance", () => {
    const isolatedBus = new EventBus();
    let synchronousRegistrations = 0;
    const subscribe = isolatedBus.subscribe.bind(isolatedBus);
    isolatedBus.subscribe = ((...args: Parameters<EventBus["subscribe"]>) => {
      synchronousRegistrations += 1;
      return subscribe(...args);
    }) as EventBus["subscribe"];

    attachMetricSourceMeasurement({ bus: isolatedBus, persistDir });

    expect(synchronousRegistrations).toBe(0);
    expect(isolatedBus.listenerCount).toBe(1);
  });

  it("persists, measures, and alerts on the rolling subscriber failure source without hiding malformed targets", async () => {
    const db = getDb(persistDir);
    expect(
      db.prepare("SELECT owner, source_query FROM metrics WHERE id = ?").get(SUBSCRIBER_FAILED_COUNT_METRIC_ID),
    ).toEqual({
      owner: "may",
      source_query: SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY,
    });

    db.run(
      `INSERT INTO events (event_type, source, owner, data, timestamp)
       VALUES ('subscriber.failed', 'event-bus', 'agent:may', ?, ?)`,
      [JSON.stringify({ originalEventType: "task.wake", error: "aged out" }), Date.now() - 3_610_000],
    );
    bus.emit({
      type: "subscriber.failed",
      source: "event-bus",
      owner: "agent:may",
      data: {
        originalEventType: "task.wake",
        error: "Malformed exact task target",
        target: { project: "may-agent" },
      },
    });
    bus.emit({
      type: "subscriber.failed",
      source: "event-bus",
      owner: "agent:may",
      data: {
        originalEventType: "task.wake",
        error: "Unroutable exact task target",
        target: { project: "may-agent", taskId: "missing" },
      },
    });
    for (const error of ["genuine handler failure", "genuine delivery failure"]) {
      bus.emit({
        type: "subscriber.failed",
        source: "event-bus",
        owner: "agent:may",
        data: { originalEventType: "app.input.requested", error },
      });
    }
    bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: { correlation: "subscriber-failed-source-golden-trace-1", forced: true },
    });
    await measurement.idle();
    const trigger = bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: { correlation: "subscriber-failed-source-golden-trace-2", forced: true },
    });
    const triggerEventId = trigger[EVENT_ROW_ID]!;
    await measurement.idle();

    expect(db.prepare("SELECT current FROM metrics WHERE id = ?").get(SUBSCRIBER_FAILED_COUNT_METRIC_ID)).toEqual({
      current: 4,
    });
    expect(
      db
        .prepare("SELECT value, measured_by, note FROM metric_snapshots WHERE metric_id = ? ORDER BY id DESC LIMIT 1")
        .get(SUBSCRIBER_FAILED_COUNT_METRIC_ID),
    ).toEqual({
      value: 4,
      measured_by: "runtime:metric-source-query",
      note: `source-query; trigger-event:${triggerEventId}`,
    });
    expect(
      db
        .prepare("SELECT alert_type, resolved_at FROM metric_alerts WHERE metric_id = ? ORDER BY id DESC LIMIT 1")
        .get(SUBSCRIBER_FAILED_COUNT_METRIC_ID),
    ).toEqual({ alert_type: "consecutive_failures", resolved_at: null });
  });

  it("turns a measurement trigger into a correlated stored sample and alert recovery", async () => {
    const db = getDb(persistDir);
    db.run(
      `UPDATE metrics
       SET current = 47,
           source_query = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        `SELECT count(*) AS value FROM events
         WHERE delivery_status = 'unhandled'
           AND event_type != 'channel.delivery.completed'`,
        Date.now() - 60_000,
        UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID,
      ],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, 'threshold', 'open', ?)",
      ["event.unhandled-signal-count-1h", Date.now() - 60_000],
    );

    bus.emit({
      type: "channel.delivery.completed",
      source: "test",
      owner: "agent:may",
      data: { channel: "test" },
    });
    const trigger = bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: {
        reason: "golden-trace",
        taskId: "reconcile-stale-active-metric-contract-20260818",
      },
    });
    const triggerEventId = trigger[EVENT_ROW_ID]!;
    await measurement.idle();

    const metric = db
      .prepare("SELECT current, updated_at FROM metrics WHERE id = ?")
      .get("event.unhandled-signal-count-1h") as {
      current: number;
      updated_at: number;
    };
    expect(metric.current).toBe(0);
    expect(metric.updated_at).toBeGreaterThan(Date.now() - 5_000);
    expect(
      db
        .prepare("SELECT value, measured_by, note FROM metric_snapshots WHERE metric_id = ? ORDER BY id DESC LIMIT 1")
        .get("event.unhandled-signal-count-1h"),
    ).toEqual({
      value: 0,
      measured_by: "runtime:metric-source-query",
      note: `source-query; trigger-event:${triggerEventId}`,
    });
    expect(
      db.prepare("SELECT resolved_at FROM metric_alerts WHERE metric_id = ?").get("event.unhandled-signal-count-1h"),
    ).toMatchObject({ resolved_at: expect.any(Number) });
    expect(db.prepare("SELECT accepted_by, delivery_route FROM events WHERE id = ?").get(triggerEventId)).toEqual({
      accepted_by: null,
      delivery_route: null,
    });
  });

  it("preserves evidence columns returned by a source query", async () => {
    const db = getDb(persistDir);
    db.run(
      `INSERT INTO metrics
         (id, name, type, owner, threshold, priority, status, source_query, measure_interval, updated_at, alert_op)
       VALUES ('query.evidence', 'Query evidence', 'gauge', 'evaluator', 0.2, 'P3', 'active',
               ?, 300000, 0, '<')`,
      [
        `SELECT 0.75 AS value,
                8 AS sampleSize,
                123456 AS measuredAt,
                json_object('eligible', 8, 'evaluated', 6) AS note`,
      ],
    );

    bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: {},
    });
    await measurement.idle();

    expect(
      db
        .prepare(
          "SELECT value, sample_size, measured_at, measured_by, note FROM metric_snapshots WHERE metric_id = 'query.evidence' ORDER BY id DESC LIMIT 1",
        )
        .get(),
    ).toEqual({
      value: 0.75,
      sample_size: 8,
      measured_at: 123456,
      measured_by: "runtime:metric-source-query",
      note: '{"eligible":8,"evaluated":6}',
    });
  });

  it("skips stored mutation statements instead of executing them", async () => {
    const db = getDb(persistDir);
    db.run(
      `INSERT INTO metrics
         (id, name, type, owner, threshold, priority, status, source_query, updated_at, alert_op)
       VALUES ('unsafe.metric', 'Unsafe', 'gauge', 'may', 1, 'P1', 'active',
               'DELETE FROM metric_alerts', 0, '>')`,
    );

    bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: {},
    });
    await measurement.idle();

    expect(db.prepare("SELECT current FROM metrics WHERE id = 'unsafe.metric'").get()).toEqual({
      current: null,
    });
  });

  it("records real source-command output without blocking the daemon event loop", async () => {
    const db = getDb(persistDir);
    const sampler = join(persistDir, "sample.ts");
    writeFileSync(
      sampler,
      `await Bun.sleep(150); console.log(JSON.stringify({ value: 7, sampleSize: 3, measuredAt: Date.now(), note: { cwd: process.cwd() } }));\n`,
    );
    db.run(
      `INSERT INTO metrics
         (id, name, type, owner, current, threshold, priority, status, source_command, measure_interval, updated_at, alert_op)
       VALUES ('command.metric', 'Command', 'gauge', 'may', 0, 5, 'P1', 'active', ?, 300000, 0, '>')`,
      // Exercise relative command paths in the configured App root. A login
      // shell need not retain the PATH entry installed by setup-bun in CI.
      [`'${process.execPath.replaceAll("'", "'\\''")}' sample.ts`],
    );

    let timerFired = false;
    setTimeout(() => {
      timerFired = true;
    }, 10);
    bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: { reason: "source-command-golden-trace" },
    });
    await Bun.sleep(30);
    expect(timerFired).toBe(true);
    await measurement.idle();

    expect(db.prepare("SELECT current FROM metrics WHERE id = 'command.metric'").get()).toEqual({
      current: 7,
    });
    expect(
      db
        .prepare(
          "SELECT value, sample_size, measured_by, note FROM metric_snapshots WHERE metric_id = 'command.metric' ORDER BY id DESC LIMIT 1",
        )
        .get(),
    ).toEqual({
      value: 7,
      sample_size: 3,
      measured_by: "runtime:metric-source-command",
      note: JSON.stringify({ cwd: persistDir }),
    });
  });

  it("runs batched source commands in the configured App root", async () => {
    const db = getDb(persistDir);
    const sampler = join(persistDir, "project-metrics.ts");
    writeFileSync(sampler, `
      if (process.argv[2] !== "--batch-json") throw new Error("Expected one batch");
      console.log(JSON.stringify(Object.fromEntries(process.argv.slice(3).map(
        id => [id, { value: 9, note: process.cwd() }],
      ))));
    `);
    for (const id of ["batch.first", "batch.second"]) {
      db.run(
        `INSERT INTO metrics
           (id, name, type, owner, threshold, priority, status, source_command, updated_at, alert_op)
         VALUES (?, ?, 'gauge', 'may', 10, 'P1', 'active', ?, 0, '>')`,
        [id, id, `bun ${sampler} ${id} --json`],
      );
    }
    bus.emit({ type: "trigger.metrics-snapshot", source: "control-socket", owner: "agent:may", data: {} });
    await measurement.idle();

    expect(db.prepare(
      "SELECT metric_id, value, note FROM metric_snapshots WHERE metric_id LIKE 'batch.%' ORDER BY metric_id",
    ).all()).toEqual([
      { metric_id: "batch.first", value: 9, note: persistDir },
      { metric_id: "batch.second", value: 9, note: persistDir },
    ]);

    writeFileSync(sampler, `throw new Error("synthetic batch failure");`);
    const failed = await measureSourceMetrics({ bus, persistDir });
    expect(failed.failures).toEqual([
      { id: "batch.first", reason: expect.stringContaining("synthetic batch failure") },
      { id: "batch.second", reason: expect.stringContaining("synthetic batch failure") },
    ]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM metric_snapshots WHERE metric_id LIKE 'batch.%'").get()).toEqual({ n: 2 });
  });

  it("uses measureInterval as a lightweight minimum cadence and allows an explicit forced sample", async () => {
    const db = getDb(persistDir);
    db.run(
      `INSERT INTO metrics
         (id, name, type, owner, threshold, priority, status, source_query, measure_interval, updated_at, alert_op)
       VALUES ('slow.metric', 'Slow metric', 'gauge', 'scout', 0, 'P3', 'active',
               'SELECT 4 AS value', 21600000, 0, '>')`,
    );
    const emit = (forced = false) =>
      bus.emit({
        type: "trigger.metrics-snapshot",
        source: "control-socket",
        owner: "agent:may",
        data: { forced },
      });

    emit();
    await measurement.idle();
    emit();
    await measurement.idle();
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM metric_snapshots WHERE metric_id = 'slow.metric'").get(),
    ).toEqual({ count: 1 });

    emit(true);
    await measurement.idle();
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM metric_snapshots WHERE metric_id = 'slow.metric'").get(),
    ).toEqual({ count: 2 });
  });

  it("does not begin source discovery on the event publication stack", async () => {
    const db = getDb(persistDir);
    const originalPrepare = db.prepare.bind(db);
    let publicationReturned = false;
    let sourceDiscoveryRanInline = false;
    db.prepare = ((sql: string) => {
      if (sql.includes("FROM metrics") && sql.includes("source_command") && !publicationReturned) {
        sourceDiscoveryRanInline = true;
      }
      return originalPrepare(sql);
    }) as typeof db.prepare;

    bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: { reason: "publication-boundary" },
    });
    publicationReturned = true;

    expect(sourceDiscoveryRanInline).toBe(false);
    await measurement.idle();
  });

  it("yields control traffic between synchronously persisted metric observations", async () => {
    const db = getDb(persistDir);
    for (const id of ["yield.metric.1", "yield.metric.2"]) {
      db.run(
        `INSERT INTO metrics
           (id, name, type, owner, current, threshold, priority, status, source_query, updated_at, alert_op)
         VALUES (?, ?, 'gauge', 'may', 0, 0, 'P1', 'active', 'SELECT 1 AS value', 0, '>')`,
        [id, id],
      );
    }

    let breachCount = 0;
    let controlTurnRan = false;
    let secondBreachSawControlTurn = false;
    bus.subscribe((event) => {
      if (event.type !== "metric.breach") return;
      breachCount++;
      if (breachCount === 1) {
        setImmediate(() => {
          controlTurnRan = true;
        });
      } else if (breachCount === 2) {
        secondBreachSawControlTurn = controlTurnRan;
      }
    });

    bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: { reason: "yield-between-observations" },
    });
    await measurement.idle();

    expect(breachCount).toBe(2);
    expect(secondBreachSawControlTurn).toBe(true);
  });

  it("counts only cadence-bound metrics after their freshness allowance", () => {
    const db = getDb(persistDir);
    const now = Date.now();
    const insertMetric = db.prepare(
      `INSERT INTO metrics
         (id, name, type, owner, status, source_query, source_command, measure_interval, updated_at)
       VALUES (?, ?, 'gauge', 'may', ?, ?, ?, ?, 0)`,
    );
    const insertSnapshot = db.prepare(
      "INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, 1, ?, 'fixture')",
    );

    insertSnapshot.run(SUBSCRIBER_FAILED_COUNT_METRIC_ID, now - 60_000);
    insertSnapshot.run(UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID, now - 60_000);
    for (const metric of WORKFLOW_OUTCOME_METRICS) insertSnapshot.run(metric.id, now - 60_000);
    insertMetric.run("query.fresh", "query fresh", "active", "SELECT 1 AS value", null, 300_000);
    insertSnapshot.run("query.fresh", now - 60_000);
    insertMetric.run("command.stale", "command stale", "active", null, "echo 1", 300_000);
    insertSnapshot.run("command.stale", now - 16 * 60_000);
    insertMetric.run("push.long-fresh", "long fresh", "active", null, null, 3_600_000);
    insertSnapshot.run("push.long-fresh", now - 30 * 60_000);
    insertMetric.run("push.long-stale", "long stale", "active", null, null, 3_600_000);
    insertSnapshot.run("push.long-stale", now - 121 * 60_000);
    insertMetric.run("legacy.no-cadence", "legacy", "active", null, null, null);
    insertSnapshot.run("legacy.no-cadence", now - 24 * 60 * 60_000);
    insertMetric.run("retired.stale", "retired", "retired", null, null, 300_000);
    insertSnapshot.run("retired.stale", now - 24 * 60 * 60_000);

    expect(db.prepare(STALE_ACTIVE_SOURCE_QUERY).get()).toEqual({ value: 2 });
  });
});

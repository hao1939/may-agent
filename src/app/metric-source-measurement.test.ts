import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDbSchema } from "../lib/db/schema.js";
import { getDb } from "../lib/requests.js";
import { attachEventPersistence } from "./daemon-events.js";
import { EventBus, EVENT_ROW_ID } from "./event-bus.js";
import {
  attachMetricSourceMeasurement,
  batchableProjectMetricCommand,
  type MetricSourceMeasurementRuntime,
  STALE_ACTIVE_SOURCE_QUERY,
  SUBSCRIBER_FAILED_COUNT_METRIC_ID,
  SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY,
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

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-metric-source-test-"));
    bus = new EventBus();
    applyDbSchema(getDb(persistDir));
    attachEventPersistence({ bus, persistDir });
    measurement = attachMetricSourceMeasurement({ bus, persistDir });
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
      data: { correlation: "subscriber-failed-source-golden-trace-1" },
    });
    await measurement.idle();
    const trigger = bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: { correlation: "subscriber-failed-source-golden-trace-2" },
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
      `INSERT INTO metrics
         (id, name, type, owner, current, threshold, priority, status, source_query, updated_at, alert_op)
       VALUES (?, ?, 'gauge', 'may', 47, 5, 'P1', 'active', ?, ?, '>')`,
      [
        "event.unhandled-signal-count-1h",
        "Unexpected unhandled signal events (1h)",
        `SELECT count(*) AS value FROM events
         WHERE delivery_status = 'unhandled'
           AND event_type != 'channel.delivery.completed'`,
        Date.now() - 60_000,
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
      `await Bun.sleep(150); console.log(JSON.stringify({ value: 7, sampleSize: 3, measuredAt: Date.now(), note: { source: "fixture" } }));\n`,
    );
    db.run(
      `INSERT INTO metrics
         (id, name, type, owner, current, threshold, priority, status, source_command, measure_interval, updated_at, alert_op)
       VALUES ('command.metric', 'Command', 'gauge', 'may', 0, 5, 'P1', 'active', ?, 300000, 0, '>')`,
      [`bun ${sampler}`],
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
      note: JSON.stringify({ source: "fixture" }),
    });
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

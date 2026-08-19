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
  STALE_ACTIVE_SOURCE_QUERY,
} from "./metric-source-measurement.js";

describe("source-query metric measurement", () => {
  let persistDir: string;
  let bus: EventBus;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-metric-source-test-"));
    bus = new EventBus();
    applyDbSchema(getDb(persistDir));
    attachEventPersistence({ bus, persistDir });
    attachMetricSourceMeasurement({ bus, persistDir });
  });

  it("turns a measurement trigger into a correlated stored sample and alert recovery", () => {
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
        .prepare(
          "SELECT value, measured_by, note FROM metric_snapshots WHERE metric_id = ? ORDER BY id DESC LIMIT 1",
        )
        .get("event.unhandled-signal-count-1h"),
    ).toEqual({
      value: 0,
      measured_by: "runtime:metric-source-query",
      note: `source-query; trigger-event:${triggerEventId}`,
    });
    expect(
      db.prepare("SELECT resolved_at FROM metric_alerts WHERE metric_id = ?").get(
        "event.unhandled-signal-count-1h",
      ),
    ).toMatchObject({ resolved_at: expect.any(Number) });
    expect(
      db.prepare("SELECT accepted_by, delivery_route FROM events WHERE id = ?").get(
        triggerEventId,
      ),
    ).toEqual({
      accepted_by: "runtime:metric-source-measurement",
      delivery_route: "direct",
    });
  });

  it("skips stored mutation statements instead of executing them", () => {
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

    expect(db.prepare("SELECT current FROM metrics WHERE id = 'unsafe.metric'").get()).toEqual({
      current: null,
    });
  });

  it("records real source-command output and preserves its evidence", () => {
    const db = getDb(persistDir);
    const sampler = join(persistDir, "sample.ts");
    writeFileSync(
      sampler,
      `console.log(JSON.stringify({ value: 7, sampleSize: 3, measuredAt: Date.now(), note: { source: "fixture" } }));\n`,
    );
    db.run(
      `INSERT INTO metrics
         (id, name, type, owner, current, threshold, priority, status, source_command, measure_interval, updated_at, alert_op)
       VALUES ('command.metric', 'Command', 'gauge', 'may', 0, 5, 'P1', 'active', ?, 300000, 0, '>')`,
      [`bun ${sampler}`],
    );

    bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      data: { reason: "source-command-golden-trace" },
    });

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

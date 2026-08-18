import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDbSchema } from "../lib/db/schema.js";
import { getDb } from "../lib/requests.js";
import { attachEventPersistence } from "./daemon-events.js";
import { EventBus, EVENT_ROW_ID } from "./event-bus.js";
import { attachMetricSourceMeasurement } from "./metric-source-measurement.js";

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
      data: { reason: "golden-trace" },
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
      accepted_by: "runtime:metric-source-query",
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
});

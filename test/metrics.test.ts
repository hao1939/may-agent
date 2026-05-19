import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../src/lib/requests.js";
import { createMetricService } from "../src/lib/metrics.js";

describe("MetricService", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function harness() {
    const root = mkdtempSync(join(tmpdir(), "metric-service-"));
    roots.push(root);
    const db = getDb(root);
    const emitted: Array<{ type: string; data?: Record<string, unknown>; envelope?: Record<string, unknown> }> = [];
    const service = createMetricService({
      getDb: () => db,
      emit: (type, data, envelope) => emitted.push({ type, data, envelope }),
      measuredBy: "test",
      now: () => 10_000,
    });
    return { db, service, emitted };
  }

  it("defines, records, opens, and recovers threshold alerts", () => {
    const { db, service, emitted } = harness();

    service.define({
      id: "scout.idea-yield-24h",
      name: "Scout useful ideas",
      type: "gauge",
      target: 3,
      threshold: 1,
      unit: "count",
      alertOp: "<",
      priority: "P2",
    });

    service.record("scout.idea-yield-24h", 0, { sampleSize: 1, note: "none" });
    expect(service.evaluate("scout.idea-yield-24h")).toMatchObject([
      { metricId: "scout.idea-yield-24h", status: "breached" },
    ]);

    const alert = db.prepare("SELECT metric_id, resolved_at FROM metric_alerts WHERE metric_id = ?").get("scout.idea-yield-24h") as any;
    expect(alert).toMatchObject({ metric_id: "scout.idea-yield-24h", resolved_at: null });
    expect(emitted[0]).toMatchObject({
      type: "metric.breach",
      envelope: { owner: "agent:scout", source: "test", urgency: "normal" },
      data: { metricId: "scout.idea-yield-24h", priority: "P2" },
    });
    expect(emitted[0].data).not.toHaveProperty("owner");

    service.record("scout.idea-yield-24h", 4);
    expect(service.evaluate("scout.idea-yield-24h")).toMatchObject([
      { metricId: "scout.idea-yield-24h", status: "recovered" },
    ]);
    expect(emitted[1]).toMatchObject({
      type: "metric.recovered",
      data: { metricId: "scout.idea-yield-24h" },
    });
  });

  it("opens health alerts only after the configured consecutive failures", () => {
    const { db, service, emitted } = harness();

    service.define({
      id: "guard.blocked-count-15m",
      name: "Guard blocks (15m)",
      owner: "may",
      type: "health",
      target: 0,
      threshold: 2,
      unit: "count",
      alertOp: ">",
      priority: "P1",
      config: { alert: { mode: "consecutive_failures", count: 2 } },
    });

    service.record("guard.blocked-count-15m", 2, { measuredAt: 1_000 });
    expect(service.evaluate("guard.blocked-count-15m")).toMatchObject([
      { metricId: "guard.blocked-count-15m", status: "ok" },
    ]);

    service.record("guard.blocked-count-15m", 3, { measuredAt: 2_000 });
    expect(service.evaluate("guard.blocked-count-15m")).toMatchObject([
      { metricId: "guard.blocked-count-15m", status: "ok" },
    ]);

    service.record("guard.blocked-count-15m", 3, { measuredAt: 3_000 });
    expect(service.evaluate("guard.blocked-count-15m")).toMatchObject([
      { metricId: "guard.blocked-count-15m", status: "breached" },
    ]);

    const alert = db.prepare("SELECT metric_id, resolved_at FROM metric_alerts WHERE metric_id = ?").get("guard.blocked-count-15m") as any;
    expect(alert).toMatchObject({ metric_id: "guard.blocked-count-15m", resolved_at: null });
    expect(emitted.at(-1)).toMatchObject({
      type: "metric.breach",
      envelope: { owner: "agent:may", source: "test", urgency: "high" },
      data: { metricId: "guard.blocked-count-15m", priority: "P1" },
    });
    expect(emitted.at(-1)?.data).not.toHaveProperty("owner");

    service.record("guard.blocked-count-15m", 0, { measuredAt: 4_000 });
    expect(service.evaluate("guard.blocked-count-15m")).toMatchObject([
      { metricId: "guard.blocked-count-15m", status: "recovered" },
    ]);
  });

  it("supports source-defined metrics and manual alerts", () => {
    const { db, service, emitted } = harness();

    service.define({
      id: "custom.queue-depth",
      owner: "may",
      threshold: 10,
      target: 0,
      unit: "count",
      alertOp: ">",
      sourceQuery: "SELECT 12 AS value",
      sourceCommand: undefined,
    });
    service.alert("custom.queue-depth", "Queue depth needs attention", { priority: "P1", evidence: "manual test" });

    const metric = db.prepare("SELECT owner, source_query FROM metrics WHERE id = ?").get("custom.queue-depth") as any;
    expect(metric).toMatchObject({ owner: "may", source_query: "SELECT 12 AS value" });
    expect(emitted[0]).toMatchObject({
      type: "metric.breach",
      envelope: { owner: "agent:may", source: "test", urgency: "high" },
      data: {
        metricId: "custom.queue-depth",
        priority: "P1",
      },
    });
    expect(emitted[0].data).not.toHaveProperty("owner");
  });
});

import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { createMetricService } from "../../src/lib/metrics.js";

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

  it("re-emits breach when an open alert changes", () => {
    const { service, emitted } = harness();
    service.define({
      id: "process.unowned-work-count",
      name: "Unowned work",
      type: "gauge",
      target: 0,
      threshold: 0,
      alertOp: ">",
      priority: "P0",
      status: "active",
    });

    service.record("process.unowned-work-count", 2);
    service.evaluate("process.unowned-work-count");
    service.record("process.unowned-work-count", 15);
    service.evaluate("process.unowned-work-count");

    const breaches = emitted.filter((event) => event.type === "metric.breach");
    expect(breaches).toHaveLength(2);
    expect(breaches[1].data).toMatchObject({
      metricId: "process.unowned-work-count",
      current: 15,
      repeat: true,
      reason: "open-alert-updated",
    });

  });

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

    const alert = db
      .prepare("SELECT metric_id, alert_type, resolved_at FROM metric_alerts WHERE metric_id = ?")
      .get("scout.idea-yield-24h") as any;
    expect(alert).toMatchObject({ metric_id: "scout.idea-yield-24h", alert_type: "threshold", resolved_at: null });
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

  it("defaults project metric ownership to the project owner and emits routing context", () => {
    const { db, service, emitted } = harness();
    db.prepare("INSERT INTO projects (id, path, name, owner, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "sample-project",
      "/app/projects/sample-project.app",
      "sample-project",
      "sample-owner",
      "active",
      10_000,
    );

    service.define({
      id: "sample-project.task.no-work",
      name: "Sample project no work",
      type: "health",
      project: "sample-project",
      target: 0,
      threshold: 0,
      unit: "boolean",
      alertOp: ">",
      priority: "P1",
    });

    service.record("sample-project.task.no-work", 1, { measuredAt: 10_000 });
    expect(service.evaluate("sample-project.task.no-work")).toMatchObject([
      { metricId: "sample-project.task.no-work", status: "breached" },
    ]);

    expect(emitted[0]).toMatchObject({
      type: "metric.breach",
      envelope: { owner: "project:sample-project", source: "test", target: { project: "sample-project" }, urgency: "high" },
      data: {
        metricId: "sample-project.task.no-work",
        metricName: "Sample project no work",
        project: "sample-project",
        alertId: 1,
        alertType: "threshold",
        current: 1,
        threshold: 0,
        target: 0,
        alertOp: ">",
        measuredAt: 10_000,
        priority: "P1",
      },
    });
    expect(emitted[0].data?.trend).toEqual([{ value: 1, measuredAt: 10_000 }]);
    expect(emitted[0].data).not.toHaveProperty("owner");
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

    const alert = db
      .prepare("SELECT metric_id, alert_type, resolved_at FROM metric_alerts WHERE metric_id = ?")
      .get("guard.blocked-count-15m") as any;
    expect(alert).toMatchObject({
      metric_id: "guard.blocked-count-15m",
      alert_type: "consecutive_failures",
      resolved_at: null,
    });
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
    service.alert("custom.queue-depth", "Queue depth needs attention", { priority: "P1", facts: "manual test" });

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

  it("suppresses alert lifecycle for metrics with disabled alert config", () => {
    const { db, service, emitted } = harness();

    service.define({
      id: "alias.queue-depth",
      name: "Alias queue depth",
      owner: "may",
      type: "gauge",
      target: 0,
      threshold: 0,
      unit: "count",
      alertOp: ">",
      priority: "P0",
      config: { alert: { mode: "disabled", disabled: true } },
    });

    service.record("alias.queue-depth", 5, { measuredAt: 1_000 });
    expect(service.evaluate("alias.queue-depth")).toMatchObject([
      { metricId: "alias.queue-depth", status: "ok" },
    ]);
    expect(
      db
        .prepare("SELECT COUNT(*) AS c FROM metric_alerts WHERE metric_id = ?")
        .get("alias.queue-depth"),
    ).toMatchObject({ c: 0 });
    expect(emitted).toHaveLength(0);

    db.prepare(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
    ).run("alias.queue-depth", "threshold", "stale alias alert", 500);

    service.record("alias.queue-depth", 0, { measuredAt: 2_000 });
    expect(service.evaluate("alias.queue-depth")).toMatchObject([
      { metricId: "alias.queue-depth", status: "ok" },
    ]);
    expect(
      db
        .prepare("SELECT resolved_at FROM metric_alerts WHERE metric_id = ? ORDER BY id DESC LIMIT 1")
        .get("alias.queue-depth"),
    ).toMatchObject({ resolved_at: 10_000 });
    expect(emitted).toHaveLength(0);
  });

  it("keeps canonical metric alerting while a disabled compatibility alias stays measurement-only", () => {
    const { db, service, emitted } = harness();

    service.define({
      id: "alpha-project.process.blocked.overdue-unworked-count",
      name: "Canonical overdue blocked waits",
      owner: "app-ops",
      project: "alpha-project",
      type: "gauge",
      target: 0,
      threshold: 0,
      unit: "count",
      alertOp: ">",
      priority: "P0",
      config: { alert: { mode: "consecutive_failures", count: 1 } },
    });
    service.define({
      id: "alpha-project.process.blocked.overdue-nonhuman-unworked-count",
      name: "Compatibility alias overdue blocked waits",
      owner: "app-ops",
      project: "alpha-project",
      type: "gauge",
      target: 0,
      threshold: 0,
      unit: "count",
      alertOp: ">",
      priority: "P0",
      config: {
        alert: {
          mode: "disabled",
          disabled: true,
        },
      },
    });

    service.record("alpha-project.process.blocked.overdue-unworked-count", 2, {
      measuredAt: 1_000,
      sampleSize: 2,
      note: '{"offenderTaskIds":["wait-1","wait-2"]}',
    });
    service.record(
      "alpha-project.process.blocked.overdue-nonhuman-unworked-count",
      2,
      {
        measuredAt: 1_000,
        sampleSize: 2,
        note: '{"offenderTaskIds":["wait-1","wait-2"],"compatibilityAliasFor":"alpha-project.process.blocked.overdue-unworked-count"}',
      },
    );

    expect(service.evaluate()).toMatchObject([
      {
        metricId: "alpha-project.process.blocked.overdue-unworked-count",
        status: "breached",
      },
      {
        metricId: "alpha-project.process.blocked.overdue-nonhuman-unworked-count",
        status: "ok",
      },
    ]);
    expect(
      db
        .prepare(
          "SELECT metric_id, resolved_at FROM metric_alerts WHERE metric_id IN (?, ?) ORDER BY metric_id",
        )
        .all(
          "alpha-project.process.blocked.overdue-nonhuman-unworked-count",
          "alpha-project.process.blocked.overdue-unworked-count",
        ),
    ).toEqual([
      {
        metric_id: "alpha-project.process.blocked.overdue-unworked-count",
        resolved_at: null,
      },
    ]);
    expect(emitted.filter((event) => event.type === "metric.breach")).toMatchObject([
      {
        data: {
          metricId: "alpha-project.process.blocked.overdue-unworked-count",
        },
      },
    ]);

    service.record("alpha-project.process.blocked.overdue-unworked-count", 0, {
      measuredAt: 2_000,
      sampleSize: 0,
      note: '{"offenderTaskIds":[]}',
    });
    service.record(
      "alpha-project.process.blocked.overdue-nonhuman-unworked-count",
      0,
      {
        measuredAt: 2_000,
        sampleSize: 0,
        note: '{"offenderTaskIds":[],"compatibilityAliasFor":"alpha-project.process.blocked.overdue-unworked-count"}',
      },
    );

    expect(service.evaluate()).toMatchObject([
      {
        metricId: "alpha-project.process.blocked.overdue-unworked-count",
        status: "recovered",
      },
      {
        metricId: "alpha-project.process.blocked.overdue-nonhuman-unworked-count",
        status: "ok",
      },
    ]);
    expect(
      db
        .prepare(
          "SELECT metric_id, resolved_at FROM metric_alerts WHERE metric_id IN (?, ?) ORDER BY metric_id",
        )
        .all(
          "alpha-project.process.blocked.overdue-nonhuman-unworked-count",
          "alpha-project.process.blocked.overdue-unworked-count",
        ),
    ).toEqual([
      {
        metric_id: "alpha-project.process.blocked.overdue-unworked-count",
        resolved_at: 10_000,
      },
    ]);
    expect(emitted.filter((event) => event.type === "metric.recovered")).toMatchObject([
      {
        data: {
          metricId: "alpha-project.process.blocked.overdue-unworked-count",
        },
      },
    ]);
  });
});

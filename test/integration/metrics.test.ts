import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { createMetricService } from "../../src/lib/metrics.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { openDatabase } from "../../src/lib/db.js";
import { EventBus, type AgentEvent } from "../../src/app/core/events/bus.js";
import { applyDbSchema } from "../../src/lib/db/schema.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";

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
    return { root, db, service, emitted };
  }

  it("does not infer metric ownership from its label", () => {
    const { service } = harness();
    service.define({ id: "reviewer.queue" });
    expect(service.get("reviewer.queue")?.owner).toBe("system:host");
    service.define({ id: "arbitrary.label", owner: "reviewer" });
    expect(service.get("arbitrary.label")?.owner).toBe("reviewer");
  });

  it("retires definitions and open alerts atomically without claiming recovery or deleting observations", () => {
    const { db, service, emitted } = harness();
    const definition = { id: "sample.old-check", threshold: 0, alertOp: ">" as const };
    service.define(definition);
    service.record(definition.id, 4);
    service.evaluate();
    emitted.length = 0;
    db.exec(`CREATE TEMP TRIGGER reject_retirement BEFORE UPDATE ON metric_alerts
      BEGIN SELECT RAISE(ABORT, 'cannot close alert'); END`);
    expect(() => service.define({ ...definition, status: "retired" })).toThrow("cannot close alert");
    expect(service.get(definition.id)?.status).toBe("active");
    db.exec("DROP TRIGGER reject_retirement");
    service.define({ ...definition, status: "retired" });
    const retained = db.prepare("SELECT * FROM metric_alerts").all();
    service.define({ ...definition, status: "retired" });
    expect(db.prepare("SELECT * FROM metric_alerts").all()).toEqual(retained);
    expect(retained[0].resolved_at).toBe(10_000);
    expect(service.get(definition.id)?.observation?.value).toBe(4);
    expect(service.evaluate()).toEqual([]);
    expect(emitted).toEqual([]);
  });

  it("upgrades duplicate open alerts once, retaining the first episode and its historical references", () => {
    const { db, service, emitted } = harness();
    const id = "sample.queue-depth";
    service.define({ id, threshold: 0, alertOp: ">" });
    service.record(id, 1);
    // Reproduce the pre-upgrade shape, including a misleading earlier timestamp
    // on the second insertion. Episode identity follows insertion order.
    db.exec("DROP INDEX IF EXISTS idx_ma_one_open_metric");
    const insert = db.prepare("INSERT INTO metric_alerts (metric_id, message, created_at, resolved_at) VALUES (?, ?, ?, ?)");
    insert.run(id, "previous episode", 500, 600);
    const firstId = Number(insert.run(id, "first opening", 2000, null).lastInsertRowid);
    const duplicateId = Number(insert.run(id, "duplicate opening", 1000, null).lastInsertRowid);
    for (const alertId of [firstId, duplicateId]) {
      db.run("INSERT INTO events (event_type, metric_id, alert_id, data, timestamp) VALUES ('metric.breach', ?, ?, ?, ?)",
        [id, String(alertId), JSON.stringify({ metricId: id, alertId }), 2000]);
    }
    const history = db.prepare("SELECT * FROM events ORDER BY id").all();
    applyDbSchema(db);
    const upgraded = db.prepare("SELECT * FROM metric_alerts ORDER BY id").all();
    expect(upgraded).toHaveLength(3);
    expect(upgraded[0]).toMatchObject({ message: "previous episode", resolved_at: 600 });
    expect(upgraded[1]).toMatchObject({ id: firstId, message: "first opening", resolved_at: null });
    expect(upgraded[2]).toMatchObject({ id: duplicateId, resolved_at: expect.any(Number) });
    expect(upgraded[2].message).toContain("duplicate opening");
    expect(upgraded[2].message).toContain(`alert ${firstId}`);
    applyDbSchema(db);
    service.resolveAlert(duplicateId); // Repeated administrative closure preserves its first timestamp.
    expect(db.prepare("SELECT * FROM metric_alerts ORDER BY id").all()).toEqual(upgraded);
    expect(db.prepare("SELECT * FROM events ORDER BY id").all()).toEqual(history);
    expect(() => insert.run(id, "another duplicate", 3000, null)).toThrow("UNIQUE constraint failed");

    service.alert(id, "manual evidence");
    expect(service.evaluate(id)[0]).toMatchObject({ status: "breached", alertId: firstId });
    expect(emitted).toEqual([]);
    service.record(id, 0);
    expect(service.evaluate(id)[0]).toMatchObject({ status: "recovered", alertId: firstId });
    expect(service.evaluate(id)[0]?.status).toBe("ok");
    service.record(id, 2);
    const next = service.evaluate(id)[0]!.alertId;
    expect(next).toBeGreaterThan(duplicateId);
    expect(emitted.map(({ type, data }) => [type, data!.alertId])).toEqual([
      ["metric.recovered", firstId], ["metric.breach", next],
    ]);
  });

  it("keeps the current value and sample atomic when saving evidence fails", () => {
    const { db, service } = harness();
    service.define({ id: "sample.queue-depth", threshold: 0, alertOp: ">" });
    service.record("sample.queue-depth", 0, { measuredAt: 1000 });
    db.exec(`CREATE TEMP TRIGGER reject_sample BEFORE INSERT ON metric_snapshots
      BEGIN SELECT RAISE(ABORT, 'fixture sample failure'); END`);
    expect(() => service.record("sample.queue-depth", 1)).toThrow("fixture sample failure");
    expect(service.get("sample.queue-depth")).toMatchObject({
      current: 0, observation: { value: 0, measuredAt: 1000 },
    });
    expect(service.evaluate("sample.queue-depth")[0]?.status).toBe("ok");
  });

  it("uses insertion order to break equal sample timestamps in both evidence and decisions", () => {
    const { service, emitted } = harness();
    const id = "sample.health";
    service.define({ id, type: "health", threshold: 0, alertOp: ">",
      config: { alert: { mode: "consecutive_failures", count: 2 } } });
    for (const value of [0, 1, 2]) service.record(id, value);
    expect(service.get(id)?.observation?.value).toBe(2);
    expect(service.evaluate(id)[0]?.status).toBe("breached");
    expect(emitted[0]?.data?.trend).toEqual([2, 1, 0].map((value) => ({ value, measuredAt: 10_000 })));
  });

  it("retains a late sample without replacing newer evidence or opening a stale breach", () => {
    const { db, service, emitted } = harness();
    const id = "sample.queue-depth";
    service.define({ id, threshold: 0, alertOp: ">" });
    service.record(id, 0, { measuredAt: 2000 });
    service.record(id, 5, { measuredAt: 1000 });
    expect(service.get(id)).toMatchObject({ current: 0, observation: { value: 0, measuredAt: 2000 } });
    expect(service.evaluate(id)[0]?.status).toBe("ok");
    expect(emitted).toEqual([]);
    expect(db.prepare("SELECT value FROM metric_snapshots ORDER BY id").all()).toEqual([{ value: 0 }, { value: 5 }]);
  });

  it.each(["automatic breach", "manual breach", "recovery"] as const)(
    "delivers %s only after the outer commit and discards delivery on rollback",
    (transition) => {
      const { root, db } = harness();
      const reader = openDatabase(join(root, "may.db"));
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      const observed: unknown[] = [];
      bus.subscribe((event) => {
        observed.push({ type: event.type, alerts: reader.prepare("SELECT id, resolved_at FROM metric_alerts").all() });
      });
      const metrics = createMetricService({ getDb: () => db, now: () => 10_000,
        emit: (type, data, envelope) => bus.emit({ type, data, ...envelope } as AgentEvent) });
      const id = "sample.queue-depth";
      metrics.define({ id, threshold: 0, alertOp: ">" });
      metrics.record(id, 1);
      if (transition === "recovery") { metrics.evaluate(id); metrics.record(id, 0); }
      observed.length = 0;
      const attempt = () => transition === "manual breach" ? metrics.alert(id, "Queue needs attention") : metrics.evaluate(id);
      const before = db.prepare("SELECT * FROM metric_alerts").all();
      const eventsBefore = db.prepare("SELECT * FROM events").all();
      const exec = db.exec.bind(db);
      try {
        db.exec = (sql) => {
          if (sql === "COMMIT") throw new Error("fixture commit failure");
          exec(sql);
        };
        expect(attempt).toThrow("fixture commit failure");
        expect(observed).toEqual([]);
        expect(db.prepare("SELECT * FROM metric_alerts").all()).toEqual(before);
        expect(db.prepare("SELECT * FROM events").all()).toEqual(eventsBefore);
        db.exec = exec;
        // A successful inner operation still waits for the caller's commit.
        stateTransaction(db, () => {
          attempt();
          expect(observed).toEqual([]);
        });
        attempt();
        const alerts = reader.prepare("SELECT id, resolved_at FROM metric_alerts").all();
        expect(observed).toEqual([{ type: transition === "recovery" ? "metric.recovered" : "metric.breach", alerts }]);
        expect(alerts).toEqual([{ id: expect.any(Number), resolved_at: transition === "recovery" ? 10_000 : null }]);
      } finally { db.exec = exec; reader.close(); }
    },
  );

  it("emits only breach and recovery transitions while retaining every sample", () => {
    const { root, db, service, emitted } = harness();
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

    const id = "process.unowned-work-count";
    for (const value of [0, 1, 2, 3, 3]) {
      const before = emitted.length;
      service.record(id, value);
      expect(emitted).toHaveLength(before); // Recording evidence alone never emits a breach.
      expect(service.evaluate(id)[0]?.status).toBe(value === 0 ? "ok" : "breached");
    }
    expect(emitted).toHaveLength(1);
    const firstAlertId = emitted[0].data!.alertId;
    expect(db.prepare("SELECT id, message, resolved_at FROM metric_alerts").all()).toEqual([
      { id: firstAlertId, message: expect.stringContaining("current=3"), resolved_at: null },
    ]);

    // Recreate both the service and database connection: suppression comes from stored state.
    closeDb(root);
    const restarted = createMetricService({
      getDb: () => getDb(root),
      emit: (type, data) => emitted.push({ type, data }),
      now: () => 10_000,
    });
    expect(restarted.evaluate(id)[0]).toMatchObject({ status: "breached", alertId: firstAlertId });
    expect(emitted).toHaveLength(1);
    restarted.record(id, 0);
    expect(restarted.evaluate(id)[0]).toMatchObject({ status: "recovered", alertId: firstAlertId });
    expect(restarted.evaluate(id)[0]?.status).toBe("ok");
    restarted.record(id, 4);
    const nextAlertId = restarted.evaluate(id)[0]!.alertId;
    expect(nextAlertId).toBeDefined();
    expect(nextAlertId).not.toBe(firstAlertId);
    expect(emitted.map(({ type, data }) => [type, data!.alertId, data!.current])).toEqual([
      ["metric.breach", firstAlertId, 1],
      ["metric.recovered", firstAlertId, 0],
      ["metric.breach", nextAlertId, 4],
    ]);
    expect(getDb(root).prepare("SELECT value FROM metric_snapshots ORDER BY id").all()).toEqual(
      [0, 1, 2, 3, 3, 0, 4].map((value) => ({ value })),
    );
    expect(restarted.get(id)?.current).toBe(4);
    expect(getDb(root).prepare("SELECT id, resolved_at FROM metric_alerts ORDER BY id").all()).toEqual([
      { id: firstAlertId, resolved_at: 10_000 },
      { id: nextAlertId, resolved_at: null },
    ]);
  });

  it("defines, records, opens, and recovers threshold alerts", () => {
    const { db, service, emitted } = harness();

    service.define({
      id: "scout.idea-yield-24h", owner: "scout",
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

  it.each(["automatic breach", "manual breach", "recovery"] as const)(
    "retries %s after required event persistence fails without losing or repeating the transition",
    (transition) => {
      const { root, db } = harness();
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      const delivered: string[] = [];
      bus.subscribe((event) => {
        delivered.push(event.type);
      });
      const metrics = createMetricService({
        getDb: () => db,
        now: () => 10_000,
        emit: (type, data, envelope) => bus.emit({ type, data, ...envelope } as AgentEvent),
      });
      const id = "sample.queue-depth";
      metrics.define({ id, owner: "sample", threshold: 0, alertOp: ">" });
      metrics.record(id, 1);
      if (transition === "recovery") {
        metrics.evaluate(id);
        metrics.record(id, 0);
      }
      const attempt = () =>
        transition === "manual breach" ? metrics.alert(id, "Queue needs attention") : metrics.evaluate(id);
      const beforeAlerts = db.prepare("SELECT * FROM metric_alerts").all();
      const beforeEvents = db.prepare("SELECT event_type, alert_id FROM events ORDER BY id").all();
      const beforeDelivered = [...delivered];
      // Fail the real writer at its durable event insert, not a mocked emitter.
      db.exec(`CREATE TEMP TRIGGER reject_metric_event BEFORE INSERT ON events
        WHEN NEW.event_type IN ('metric.breach', 'metric.recovered')
        BEGIN SELECT RAISE(ABORT, 'fixture event persistence failure'); END`);
      expect(attempt).toThrow("fixture event persistence failure");
      expect(db.prepare("SELECT * FROM metric_alerts").all()).toEqual(beforeAlerts);
      expect(db.prepare("SELECT event_type, alert_id FROM events ORDER BY id").all()).toEqual(beforeEvents);
      expect(delivered).toEqual(beforeDelivered);
      expect(metrics.get(id)?.current).toBe(transition === "recovery" ? 0 : 1);

      db.exec("DROP TRIGGER reject_metric_event");
      attempt();
      attempt();
      const alert = db.prepare("SELECT id, resolved_at FROM metric_alerts").get()!;
      const expectedTypes = transition === "recovery" ? ["metric.breach", "metric.recovered"] : ["metric.breach"];
      expect(db.prepare("SELECT event_type, alert_id FROM events ORDER BY id").all()).toEqual(
        expectedTypes.map((event_type) => ({ event_type, alert_id: String(alert.id) })),
      );
      expect(delivered).toEqual(expectedTypes);
      expect(alert.resolved_at).toBe(transition === "recovery" ? 10_000 : null);
    },
  );

  it.each(["automatic breach", "manual breach", "recovery", "new sample"] as const)(
    "uses current state when another connection commits %s before the write lock",
    (transition) => {
      const { root, db, service, emitted } = harness();
      const id = "sample.queue-depth";
      service.define({ id, owner: "sample", threshold: 0, alertOp: ">" });
      service.record(id, 1);
      if (transition === "recovery") {
        service.evaluate(id);
        service.record(id, 0);
      }
      const otherDb = openDatabase(join(root, "may.db"));
      const other = createMetricService({
        getDb: () => otherDb,
        now: () => 10_000,
        emit: (type, data) => emitted.push({ type, data }),
      });
      const attempt = (metrics: typeof service) =>
        transition === "manual breach" ? metrics.alert(id, "Queue needs attention") : metrics.evaluate(id);
      const exec = db.exec.bind(db);
      let interleaved = false;
      // Deterministically let a second connection commit just before this caller
      // acquires its write lock. No threads, sleeps, or mocked query results.
      db.exec = (sql) => {
        if (sql === "BEGIN IMMEDIATE" && !interleaved) {
          interleaved = true;
          if (transition === "new sample") other.record(id, 0);
          attempt(other);
        }
        exec(sql);
      };
      try {
        attempt(service);
        expect(interleaved).toBe(true);
        attempt(service);
        const alerts = db.prepare("SELECT id, resolved_at FROM metric_alerts").all();
        if (transition === "new sample") {
          expect(service.get(id)?.current).toBe(0);
          expect(alerts).toEqual([]);
          expect(emitted).toEqual([]);
        } else {
          expect(alerts).toHaveLength(1);
          expect(alerts[0].resolved_at).toBe(transition === "recovery" ? 10_000 : null);
          expect(emitted.map(({ type, data }) => [type, data!.alertId])).toEqual(
            (transition === "recovery" ? ["metric.breach", "metric.recovered"] : ["metric.breach"])
              .map((type) => [type, alerts[0].id]),
          );
        }
      } finally {
        db.exec = exec;
        otherDb.close();
      }
    },
  );

  it.each(["automatic breach", "manual breach", "recovery"] as const)(
    "dates %s after acquiring the write lock, separately from sample time",
    (transition) => {
      const { root, db, service, emitted } = harness();
      const id = "sample.queue-depth";
      service.define({ id, threshold: 0, alertOp: ">" });
      let clock = 10_000;
      const otherDb = openDatabase(join(root, "may.db"));
      const metrics = (connection: typeof db) => createMetricService({
        getDb: () => connection,
        now: () => clock,
        emit: (type, data) => emitted.push({ type, data }),
      });
      const waiting = metrics(db);
      const other = metrics(otherDb);
      const exec = db.exec.bind(db);
      let interleaved = false;
      db.exec = (sql) => {
        if (sql === "BEGIN IMMEDIATE" && !interleaved) {
          interleaved = true;
          clock = 20_000;
          other.record(id, 1);
          if (transition !== "automatic breach") {
            other.evaluate(id);
            clock = 25_000;
            other.record(id, 0);
            if (transition === "manual breach") other.evaluate(id);
          }
          clock = 30_000;
        }
        exec(sql);
      };
      try {
        if (transition === "manual breach") waiting.alert(id, "New incident");
        else waiting.evaluate(id);
        expect(interleaved).toBe(true);
        const alerts = db.prepare("SELECT created_at, resolved_at FROM metric_alerts ORDER BY id").all();
        expect(alerts).toEqual(transition === "recovery"
          ? [{ created_at: 20_000, resolved_at: 30_000 }]
          : [
              ...(transition === "manual breach" ? [{ created_at: 20_000, resolved_at: 25_000 }] : []),
              { created_at: 30_000, resolved_at: null },
            ]);
        expect(emitted.at(-1)).toMatchObject({
          type: transition === "recovery" ? "metric.recovered" : "metric.breach",
          data: { measuredAt: 30_000 },
        });
        expect(waiting.get(id)?.observation?.measuredAt).toBe(
          transition === "automatic breach" ? 20_000 : 25_000,
        );
      } finally {
        db.exec = exec;
        otherDb.close();
      }
    },
  );

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

  it("shares one alert episode across manual reports and source measurements", () => {
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

    const firstAlertId = emitted[0].data!.alertId as number;
    service.alert("custom.queue-depth", "Queue depth needs attention", { priority: "P1", facts: "manual test" });
    service.alert("custom.queue-depth", "Queue is still growing", { facts: "updated evidence" });
    expect(emitted).toHaveLength(1);
    expect(db.prepare("SELECT id, message, resolved_at FROM metric_alerts").all()).toEqual([
      { id: firstAlertId, message: "Queue is still growing\n\nFacts: updated evidence", resolved_at: null },
    ]);

    service.record("custom.queue-depth", 12);
    expect(service.evaluate("custom.queue-depth")[0]).toMatchObject({ status: "breached", alertId: firstAlertId });
    service.alert("custom.queue-depth", "Confirmed by owner", { facts: "source and manual evidence agree" });
    expect(emitted).toHaveLength(1);
    expect(db.prepare("SELECT id, message FROM metric_alerts").all()).toEqual([
      { id: firstAlertId, message: "Confirmed by owner\n\nFacts: source and manual evidence agree" },
    ]);

    service.resolveAlert(firstAlertId);
    service.alert("custom.queue-depth", "A new incident");
    expect(emitted).toHaveLength(2);
    expect(emitted[1].type).toBe("metric.breach");
    expect(emitted[1].data!.alertId).not.toBe(firstAlertId);
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

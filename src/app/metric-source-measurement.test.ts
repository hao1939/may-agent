import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../lib/db-writer.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { closeDb, getDb } from "../lib/requests.js";
import { createMetricService } from "../lib/metrics.js";
import { attachEventPersistence } from "./daemon-events.js";
import { EventBus, EVENT_ROW_ID, EVENT_RECORD_ONLY } from "./core/events/bus.js";
import { WORKFLOW_OUTCOME_METRICS } from "./adapters/reporting/workflow-metrics.js";
import { TASK_FAILOVER_METRIC } from "./adapters/reporting/task-failover-metrics.js";
import { TASK_SKIPPED_CHECK_METRIC } from "./adapters/reporting/task-check-metrics.js";
import { readTaskChecks, recordTaskCheck } from "./core/tasks/task-check-observations.js";
import {
  attachMetricSourceMeasurement,
  measureSourceMetrics,
  evaluateMetrics,
  type MetricPassRuntime,
  INTENTIONAL_OBSERVATION_EVENT_TYPES,
  STALE_ACTIVE_METRIC_ID,
  STALE_ACTIVE_SOURCE_QUERY,
  SUBSCRIBER_FAILED_COUNT_METRIC_ID,
  SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY,
  UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID,
  UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY,
} from "./metric-source-measurement.js";

describe("source-query metric measurement", () => {
  let persistDir: string;
  let bus: EventBus;
  let measurement: MetricPassRuntime;
  const originalAppRoot = process.env.APP_ROOT;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-metric-source-test-"));
    process.env.APP_ROOT = persistDir;
    bus = new EventBus();
    applyDbSchema(getDb(persistDir));
    attachEventPersistence({ bus, persistDir });
    measurement = attachMetricSourceMeasurement({ bus, persistDir });
  });

  afterEach(async () => {
    await measurement.idle();
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
    if (originalAppRoot === undefined) delete process.env.APP_ROOT;
    else process.env.APP_ROOT = originalAppRoot;
  });

  it("samples skipped checks quietly and leaves breach/recovery to metric evaluation", async () => {
    const db = getDb(persistDir);
    const metrics = createMetricService({ getDb: () => db });
    const id = TASK_SKIPPED_CHECK_METRIC.id;
    const observed: string[] = [];
    bus.subscribe((event) => observed.push(event.type));
    for (let n = 0; n < 1_000; n++) recordTaskCheck(bus, "waiting");
    recordTaskCheck(bus, "busy");
    recordTaskCheck(bus, "claimed");
    expect(observed).toEqual([]);
    expect(metrics.get(id)!.observation).toBeNull();

    const sample = () => measureSourceMetrics({ bus, persistDir, isDue: (row) => row.id === id });
    expect((await sample()).measured).toEqual([id]);
    expect(metrics.get(id)!.observation).toMatchObject({ value: 1_001, sampleSize: 1_002 });
    expect(JSON.parse(metrics.get(id)!.observation!.note!)).toMatchObject({
      since: expect.any(Number), until: expect.any(Number),
      counts: { waiting: 1_000, busy: 1, claimed: 1, attention: 0, completed: 0 },
    });
    expect(db.prepare("SELECT COUNT(*) AS n FROM metric_snapshots WHERE metric_id = ?").get(id)).toEqual({ n: 1 });
    await evaluateMetrics({ bus, persistDir });
    expect(observed).toEqual([]); // Observation defaults do not impose an alert policy.

    db.run("UPDATE metrics SET threshold = 100, alert_op = '>' WHERE id = ?", [id]);
    await evaluateMetrics({ bus, persistDir });
    await evaluateMetrics({ bus, persistDir });
    expect(observed).toEqual(["metric.breach"]);
    await sample(); // An idle interval is a real zero sample, not missing evidence.
    expect(metrics.get(id)!.observation).toMatchObject({ value: 0, sampleSize: 0 });
    expect(observed).toEqual(["metric.breach"]);
    await evaluateMetrics({ bus, persistDir });
    expect(observed).toEqual(["metric.breach", "metric.recovered"]);
  });

  it("retains check counts after a failed sample and honors sampling cadence and retirement", async () => {
    const db = getDb(persistDir);
    const id = TASK_SKIPPED_CHECK_METRIC.id;
    recordTaskCheck(bus, "waiting");
    const before = readTaskChecks(bus);
    const run = db.run.bind(db);
    const write = spyOn(db, "run").mockImplementation((sql, params) => {
      if (sql.startsWith("INSERT INTO metric_snapshots")) throw new Error("fixture sample unavailable");
      return run(sql, params);
    });
    try {
      const result = await measureSourceMetrics({ bus, persistDir, isDue: (row) => row.id === id });
      expect(result.failures).toHaveLength(1);
      expect(readTaskChecks(bus)).toEqual(before);
    } finally {
      write.mockRestore();
    }
    bus.emit({ type: "trigger.metrics-snapshot" });
    await measurement.idle();
    expect(createMetricService({ getDb: () => db }).get(id)!.observation?.value).toBe(1);
    recordTaskCheck(bus, "completed");
    bus.emit({ type: "trigger.metrics-snapshot" });
    await measurement.idle();
    expect(readTaskChecks(bus).counts.completed).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM metric_snapshots WHERE metric_id = ?").get(id)).toEqual({ n: 1 });
    db.run("UPDATE metrics SET status = 'retired' WHERE id = ?", [id]);
    await measureSourceMetrics({ bus, persistDir, isDue: (row) => row.id === id });
    expect(readTaskChecks(bus).counts.completed).toBe(1);
  });

  it("registers metrics after a short competing startup writer without losing samples or calibration", async () => {
    const db = getDb(persistDir);
    db.run("UPDATE metrics SET threshold = 7 WHERE id = ?", [SUBSCRIBER_FAILED_COUNT_METRIC_ID]);
    createMetricService({ getDb: () => db }).record(SUBSCRIBER_FAILED_COUNT_METRIC_ID, 2);
    const writer = Bun.spawn(
      [
        process.execPath,
        "-e",
        `import { Database } from "bun:sqlite";
       const db = new Database(process.argv[1]);
       db.exec("BEGIN IMMEDIATE");
       console.log("locked");
       await Bun.stdin.text();
       db.exec("COMMIT");
       db.close();`,
        join(persistDir, "may.db"),
      ],
      { stdin: "pipe", stdout: "pipe", stderr: "pipe", timeout: 5_000 },
    );
    const exec = db.exec.bind(db);
    let busyErrors = 0;
    const runSpy = spyOn(db, "exec").mockImplementation((sql) => {
      try {
        return exec(sql);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "SQLITE_BUSY") {
          // Release only after a real registration write encountered the lock.
          // Rethrow unchanged so production retry must recover the operation.
          if (++busyErrors === 1) writer.stdin.end();
        }
        throw error;
      }
    });
    try {
      const reader = writer.stdout.getReader();
      try {
        const decoder = new TextDecoder();
        let signal = "";
        while (!signal.includes("locked\n")) {
          const { value, done } = await reader.read();
          if (done) throw new Error("Lock holder exited before its readiness marker");
          signal += decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
      // The lock holder is a separate process: it can release its transaction
      // while the synchronous startup write follows the existing busy policy.
      const runtime = attachMetricSourceMeasurement({ bus: new EventBus(), persistDir });
      await runtime.idle();
      expect(busyErrors).toBeGreaterThan(0);
      expect(await writer.exited).toBe(0);
      expect(db.prepare("SELECT threshold FROM metrics WHERE id = ?").get(SUBSCRIBER_FAILED_COUNT_METRIC_ID)).toEqual({
        threshold: 7,
      });
      expect(
        db
          .prepare("SELECT COUNT(*) AS count FROM metric_snapshots WHERE metric_id = ?")
          .get(SUBSCRIBER_FAILED_COUNT_METRIC_ID),
      ).toEqual({ count: 1 });
      expect(
        db.prepare("SELECT COUNT(*) AS count FROM metrics WHERE id = ?").get(WORKFLOW_OUTCOME_METRICS[0]!.id),
      ).toEqual({ count: 1 });
    } finally {
      runSpy.mockRestore();
      writer.kill();
      await writer.exited;
    }
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

  it("counts the lost publication once while retaining its subscriber-failure diagnostic", async () => {
    const db = getDb(persistDir);
    const writer = new DbWriter(persistDir);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const reported = Promise.withResolvers<void>();
    const stop = bus.subscribe((event) => {
      if (event.type === "sample.report.published") throw new Error("consumer unavailable");
      if (event.type === "subscriber.failed") reported.resolve();
    });
    try {
      bus.emit({ type: "sample.report.published", source: "fixture", owner: "app:sample", data: { result: "retained" } });
      await reported.promise;
      writer.runHousekeeping(Date.now() + 3_600_000);
      expect(db.prepare(UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY).get()).toEqual({ value: 1 });
      expect(db.prepare(SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY).get()).toEqual({ value: 1 });
      expect(db.prepare("SELECT event_type, delivery_status FROM events ORDER BY id").all()).toEqual([
        { event_type: "sample.report.published", delivery_status: "unhandled" },
        { event_type: "subscriber.failed", delivery_status: "accepted" },
      ]);
    } finally { stop(); }
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

  it("records optional observations as accepted facts while preserving real subscriber acceptance", () => {
    const db = getDb(persistDir);
    for (const type of ["runtime.daemon.heartbeat", "handler.workflow_dispatched", "skill.loaded"]) {
      bus.emit({ type, [EVENT_RECORD_ONLY]: true, source: "fixture", owner: "agent:may", data: {} } as any);
    }
    bus.subscribe((event) =>
      event.type === "skill.loaded" ? { accepted: true, by: "fixture-consumer", route: "direct" } : undefined,
    );
    bus.emit({
      type: "skill.loaded",
      [EVENT_RECORD_ONLY]: true,
      source: "fixture",
      owner: "agent:may",
      data: {
        name: "example", agent: "may", sessionId: "example", activation: "explicit",
        scope: "shared", filePath: "example/SKILL.md", contentHash: "example",
      },
    });
    const rows = db.prepare(`SELECT delivery_status, delivery_route, accepted_by FROM events
      WHERE event_type IN ('runtime.daemon.heartbeat', 'handler.workflow_dispatched', 'skill.loaded') ORDER BY id`).all();
    expect(rows).toHaveLength(4);
    expect(rows.slice(0, 3).every((row) => row.delivery_status === "accepted" && row.delivery_route === "noop")).toBe(true);
    expect(rows[3]).toMatchObject({ delivery_status: "accepted", accepted_by: "fixture-consumer", delivery_route: "direct" });
    expect(db.prepare(UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY).get()).toEqual({ value: 0 });
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
      owner: "system:host",
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
    await evaluateMetrics({ bus, persistDir });


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
    await evaluateMetrics({ bus, persistDir });


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

  it("preserves facts columns returned by a source query", async () => {
    const db = getDb(persistDir);
    db.run(
      `INSERT INTO metrics
         (id, name, type, owner, threshold, priority, status, source_query, measure_interval, updated_at, alert_op)
       VALUES ('query.evidence', 'Query facts', 'gauge', 'evaluator', 0.2, 'P3', 'active',
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

  it("uses producer then caller then completion time without changing late or rate semantics", async () => {
    const db = getDb(persistDir);
    const metrics = createMetricService({ getDb: () => db });
    metrics.define({ id: "time.producer", sourceQuery: "SELECT 1 AS value, 111 AS measuredAt" });
    metrics.define({ id: "time.caller", sourceQuery: "SELECT 2 AS value" });

    await measureSourceMetrics({
      bus,
      persistDir,
      measuredAt: 222,
      isDue: ({ id }) => id === "time.producer" || id === "time.caller",
    });
    expect(db.prepare("SELECT metric_id, measured_at FROM metric_snapshots WHERE metric_id LIKE 'time.%' ORDER BY metric_id").all())
      .toEqual([
        { metric_id: "time.caller", measured_at: 222 },
        { metric_id: "time.producer", measured_at: 111 },
      ]);

    const sampler = join(persistDir, "completion.ts");
    writeFileSync(sampler, `await Bun.sleep(50); console.log(JSON.stringify({ samples: { "completion.a": 3, "completion.b": 4 } }));`);
    const command = `'${process.execPath.replaceAll("'", "'\\''")}' completion.ts`;
    for (const id of ["completion.a", "completion.b"]) metrics.define({ id, sourceCommand: command });
    const requestedAt = Date.now();
    await measureSourceMetrics({ bus, persistDir, isDue: ({ id }) => id.startsWith("completion.") });
    const completions = db.prepare(
      "SELECT measured_at FROM metric_snapshots WHERE metric_id LIKE 'completion.%' ORDER BY metric_id",
    ).all() as Array<{ measured_at: number }>;
    expect(completions).toEqual([{ measured_at: completions[0]!.measured_at }, { measured_at: completions[0]!.measured_at }]);
    expect(completions[0]!.measured_at).toBeGreaterThan(requestedAt);

    metrics.define({ id: "ordering.late", sourceQuery: "SELECT 1 AS value" });
    metrics.record("ordering.late", 9, { measuredAt: 2_000 });
    await measureSourceMetrics({ bus, persistDir, measuredAt: 1_000, isDue: ({ id }) => id === "ordering.late" });
    expect(metrics.get("ordering.late")!.observation).toMatchObject({ value: 9, measuredAt: 2_000 });

    metrics.define({
      id: "ordering.rate", type: "counter", threshold: 999_999, alertOp: ">",
      sourceQuery: "SELECT 2 AS value", config: { alert: { mode: "rate", max_rate: 2_000, per: "hour" } },
    });
    metrics.record("ordering.rate", 1, { measuredAt: 1_000 });
    await measureSourceMetrics({ bus, persistDir, measuredAt: 2_000, isDue: ({ id }) => id === "ordering.rate" });
    expect(metrics.evaluate("ordering.rate")[0]).toMatchObject({ status: "breached", calculation: { value: 2 } });
  });

  it("enforces read-only queries while preserving SQLite first-statement behavior and writer continuity", async () => {
    const db = getDb(persistDir);
    db.exec("CREATE TABLE proof_marker(value INTEGER NOT NULL); INSERT INTO proof_marker VALUES (1)");
    const metrics = createMetricService({ getDb: () => db });
    const definitions = [
      {
        id: "boundary.cte-write",
        sourceQuery: "WITH fixture AS (SELECT 1) UPDATE proof_marker SET value = 2 RETURNING value",
      },
      { id: "boundary.quoted-semicolon", sourceQuery: "SELECT 3 AS value, 'first; second' AS note" },
      { id: "boundary.healthy", sourceQuery: "SELECT value FROM proof_marker" },
      { id: "boundary.trailing-tail", sourceQuery: "SELECT 5 AS value; UPDATE proof_marker SET value = 99" },
      {
        id: "boundary.observes-writer",
        sourceQuery: "SELECT COUNT(*) AS value FROM metric_snapshots WHERE metric_id = 'boundary.healthy'",
      },
    ];
    for (const definition of definitions) {
      metrics.define({
        ...definition,
        name: definition.id,
        type: "gauge",
        owner: "fixture",
        threshold: 0,
        alertOp: ">",
      });
    }

    const result = await measureSourceMetrics({
      bus,
      persistDir,
      isDue: ({ id }) => id.startsWith("boundary."),
    });

    expect(result).toEqual({
      measured: [
        "boundary.healthy",
        "boundary.observes-writer",
        "boundary.quoted-semicolon",
        "boundary.trailing-tail",
      ],
      skipped: ["boundary.cte-write"],
      failures: [{ id: "boundary.cte-write", reason: expect.stringContaining("readonly") }],
    });
    expect(db.prepare("SELECT value FROM proof_marker").get()).toEqual({ value: 1 });
    expect(metrics.get("boundary.quoted-semicolon")!.observation).toMatchObject({
      value: 3,
      note: "first; second",
    });
    expect(metrics.get("boundary.observes-writer")!.observation?.value).toBe(1);

    await evaluateMetrics({ bus, persistDir });
    expect(
      db.prepare("SELECT metric_id FROM metric_alerts WHERE metric_id LIKE 'boundary.%' ORDER BY metric_id").all(),
    ).toEqual([
      { metric_id: "boundary.healthy" },
      { metric_id: "boundary.observes-writer" },
      { metric_id: "boundary.quoted-semicolon" },
      { metric_id: "boundary.trailing-tail" },
    ]);
  });

  it("isolates a rejected BEGIN from a later source read after an intervening writer update", async () => {
    const db = getDb(persistDir);
    db.exec("CREATE TABLE transaction_marker(value INTEGER NOT NULL); INSERT INTO transaction_marker VALUES (7)");
    const metrics = createMetricService({ getDb: () => db });
    for (const definition of [
      { id: "transaction.begin", sourceQuery: "BEGIN" },
      { id: "transaction.healthy", sourceQuery: "SELECT value FROM transaction_marker" },
      {
        id: "transaction.observes-writer",
        sourceQuery: "SELECT COUNT(*) AS value FROM metric_snapshots WHERE metric_id = 'transaction.healthy'",
      },
    ]) {
      metrics.define({
        ...definition,
        name: definition.id,
        type: "gauge",
        owner: "fixture",
        threshold: 0,
        alertOp: ">",
      });
    }

    const result = await measureSourceMetrics({
      bus,
      persistDir,
      isDue: ({ id }) => id.startsWith("transaction."),
    });

    expect(result).toEqual({
      measured: ["transaction.healthy", "transaction.observes-writer"],
      skipped: ["transaction.begin"],
      failures: [{ id: "transaction.begin", reason: "Source returned no finite numeric sample" }],
    });
    expect(metrics.get("transaction.observes-writer")!.observation?.value).toBe(1);
    expect(
      db
        .prepare(
          `SELECT json_extract(data, '$.reason') AS reason
           FROM events
           WHERE event_type = 'metric.measurement.failed'
             AND json_extract(data, '$.metricId') = 'transaction.begin'`,
        )
        .get(),
    ).toEqual({ reason: "Source returned no finite numeric sample" });
  });

  it("keeps the writer usable when a failed source reader closes and a later reader reopens", async () => {
    const db = getDb(persistDir);
    db.exec("CREATE TABLE recovery_marker(value INTEGER NOT NULL); INSERT INTO recovery_marker VALUES (1)");
    const metrics = createMetricService({ getDb: () => db });
    metrics.define({
      id: "reader.failure",
      name: "Failed reader",
      type: "gauge",
      owner: "fixture",
      sourceQuery: "SELECT value FROM missing_reader_fixture",
      threshold: 0,
      alertOp: ">",
    });
    metrics.define({
      id: "reader.reopened",
      name: "Reopened reader",
      type: "gauge",
      owner: "fixture",
      sourceQuery: "SELECT value FROM recovery_marker",
      threshold: 0,
      alertOp: ">",
    });

    const failed = await measureSourceMetrics({ bus, persistDir, isDue: ({ id }) => id === "reader.failure" });
    expect(failed).toEqual({
      measured: [],
      skipped: ["reader.failure"],
      failures: [{ id: "reader.failure", reason: expect.stringContaining("missing_reader_fixture") }],
    });

    db.run("UPDATE recovery_marker SET value = 7");
    const recovered = await measureSourceMetrics({ bus, persistDir, isDue: ({ id }) => id === "reader.reopened" });
    expect(recovered).toEqual({ measured: ["reader.reopened"], skipped: [], failures: [] });
    expect(metrics.get("reader.reopened")!.observation?.value).toBe(7);

    await evaluateMetrics({ bus, persistDir });
    expect(db.prepare("SELECT metric_id FROM metric_alerts WHERE metric_id = 'reader.reopened'").get()).toEqual({
      metric_id: "reader.reopened",
    });
  });

  it("retains scheduled source failures after reopening storage without changing the last observation", async () => {
    const db = getDb(persistDir);
    const metrics = createMetricService({ getDb: () => db });
    metrics.define({
      id: "broken.query",
      name: "Broken query",
      type: "gauge",
      owner: "fixture",
      sourceQuery: "SELECT value FROM missing_fixture_table",
    });
    metrics.define({
      id: "broken.command",
      name: "Broken command",
      type: "gauge",
      owner: "fixture",
      sourceCommand: "echo 'token=synthetic-private-value " + "x".repeat(3_000) + "' >&2; exit 1",
    });
    metrics.define({
      id: "healthy.query",
      name: "Healthy query",
      type: "gauge",
      owner: "fixture",
      sourceQuery: "SELECT 9 AS value",
    });
    metrics.record("broken.query", 7, { measuredAt: 123, sampleSize: 4, note: "last real sample" });
    const previous = metrics.get("broken.query")!.observation;
    const trigger = bus.emit({
      type: "trigger.metrics-snapshot",
      source: "cron",
      owner: "agent:may",
      data: {},
    });
    await measurement.idle();

    closeDb(persistDir);
    const reopened = getDb(persistDir);
    const failures = reopened
      .prepare("SELECT source, owner, data, delivery_status FROM events WHERE event_type = 'metric.measurement.failed' ORDER BY id")
      .all() as Array<{ source: string; owner: string; data: string; delivery_status: string }>;
    expect(failures).toHaveLength(2);
    expect(failures.map((row) => row.delivery_status)).toEqual(["accepted", "accepted"]);
    expect(
      failures.every((row) => row.source === "runtime:metric-source-measurement" && row.owner === "system:host"),
    ).toBe(true);
    const [command, query] = failures.map((row) => JSON.parse(row.data));
    expect(query).toEqual({
      metricId: "broken.query",
      triggerEventId: trigger[EVENT_ROW_ID],
      reason: expect.stringContaining("missing_fixture_table"),
    });
    expect(command).toMatchObject({ metricId: "broken.command", triggerEventId: trigger[EVENT_ROW_ID] });
    expect(command.reason).toContain("[REDACTED]");
    expect(command.reason).not.toContain("synthetic-private-value");
    expect(command.reason.length).toBeLessThanOrEqual(2_000);
    const retained = createMetricService({ getDb: () => reopened });
    expect(retained.get("broken.query")!.observation).toEqual(previous);
    expect(retained.get("broken.command")!.observation).toBeNull();
    expect(retained.get("healthy.query")!.observation?.value).toBe(9);
    expect(
      reopened.prepare("SELECT COUNT(*) AS n FROM metric_snapshots WHERE metric_id LIKE 'broken.%'").get(),
    ).toEqual({ n: 1 });
    expect(reopened.prepare("SELECT COUNT(*) AS n FROM metric_alerts WHERE metric_id LIKE 'broken.%'").get()).toEqual({
      n: 0,
    });
  });

  it("continues measuring when persisting the failure diagnostic fails", async () => {
    const db = getDb(persistDir);
    const metrics = createMetricService({ getDb: () => db });
    metrics.define({
      id: "broken.query",
      name: "Broken query",
      type: "gauge",
      owner: "fixture",
      sourceQuery: "SELECT value FROM missing_fixture_table",
    });
    metrics.define({
      id: "healthy.query",
      name: "Healthy query",
      type: "gauge",
      owner: "fixture",
      sourceQuery: "SELECT 9 AS value",
    });
    let attempts = 0;
    bus.setPersistenceSubscriber((event) => {
      if (event.type === "metric.measurement.failed") {
        attempts++;
        throw new Error("Synthetic diagnostic storage failure");
      }
    });
    const result = await measureSourceMetrics({ bus, persistDir });
    expect(attempts).toBe(1);
    expect(result.failures).toEqual([{ id: "broken.query", reason: expect.stringContaining("missing_fixture_table") }]);
    expect(result.measured).toContain("healthy.query");
    expect(metrics.get("healthy.query")!.observation?.value).toBe(9);
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

  it("shares an arbitrary declared producer, preserves exact samples, and retries only on the next pass", async () => {
    const db = getDb(persistDir);
    const sampler = join(persistDir, "observations.ts");
    const countPath = join(persistDir, "invocations");
    const countInvocation = `
      import { appendFileSync } from "node:fs";
      appendFileSync("invocations", "called\\n");
    `;
    writeFileSync(sampler, `
      ${countInvocation}
      if (process.argv.slice(2).join(" ") !== "--report exact") throw new Error("Command was rewritten");
      console.log(JSON.stringify({ samples: {
        "batch.first": { value: 9, sampleSize: 3, measuredAt: 1234, note: process.cwd() },
        "batch.second": 0,
        "batch.invalid": { value: "not a number" },
        "batch.undeclared": 99,
      } }));
    `);
    const ids = ["batch.first", "batch.second", "batch.missing", "batch.invalid"];
    for (const id of ids) {
      db.run(
        `INSERT INTO metrics
           (id, name, type, owner, threshold, priority, status, source_command, updated_at, alert_op)
         VALUES (?, ?, 'gauge', 'may', 10, 'P1', 'active', ?, 0, '>')`,
        [id, id, `'${process.execPath.replaceAll("'", "'\\''")}' observations.ts --report exact`],
      );
    }
    bus.emit({ type: "trigger.metrics-snapshot", source: "control-socket", owner: "agent:may", data: {} });
    await measurement.idle();

    expect(db.prepare(
      "SELECT metric_id, value, sample_size, note FROM metric_snapshots WHERE metric_id LIKE 'batch.%' ORDER BY metric_id",
    ).all()).toEqual([
      { metric_id: "batch.first", value: 9, sample_size: 3, note: persistDir },
      { metric_id: "batch.second", value: 0, sample_size: null, note: expect.stringContaining("source-command") },
    ]);
    expect(readFileSync(countPath, "utf8")).toBe("called\n");
    expect(db.prepare("SELECT measured_at FROM metric_snapshots WHERE metric_id = 'batch.first'").get())
      .toEqual({ measured_at: 1234 });
    expect(db.prepare(
      "SELECT COUNT(*) AS n FROM events WHERE event_type = 'metric.measurement.failed' AND json_extract(data, '$.metricId') LIKE 'batch.%'",
    ).get()).toEqual({ n: 2 });

    writeFileSync(sampler, `${countInvocation} throw new Error("synthetic producer failure");`);
    const failed = await measureSourceMetrics({ bus, persistDir });
    expect(failed.failures).toEqual([...ids].sort().map(id => ({
      id, reason: expect.stringContaining("synthetic producer failure"),
    })));
    expect(readFileSync(countPath, "utf8")).toBe("called\ncalled\n");
    expect(db.prepare("SELECT COUNT(*) AS n FROM metric_snapshots WHERE metric_id LIKE 'batch.%'").get()).toEqual({ n: 2 });

    // The same map contract works when only one metric is due, after failure.
    writeFileSync(sampler, `${countInvocation} console.log(JSON.stringify({ samples: { "batch.second": 7 } }));`);
    const recovered = await measureSourceMetrics({ bus, persistDir, isDue: row => row.id === "batch.second" });
    expect(recovered).toEqual({ measured: ["batch.second"], skipped: [], failures: [] });
    expect(readFileSync(countPath, "utf8")).toBe("called\ncalled\ncalled\n");
    expect(db.prepare("SELECT value FROM metric_snapshots WHERE metric_id = 'batch.second' ORDER BY id DESC LIMIT 1").get())
      .toEqual({ value: 7 });
  });

  it("does not execute commands for query-backed or not-due metrics", async () => {
    const db = getDb(persistDir);
    const metrics = createMetricService({ getDb: () => db });
    const marker = join(persistDir, "unexpected-command");
    for (const id of ["query.first", "query.second", "not-due"]) {
      metrics.define({
        id, name: id, type: "gauge", owner: "fixture",
        sourceQuery: id.startsWith("query.") ? "SELECT 3 AS value" : undefined,
        sourceCommand: "touch unexpected-command; echo 9",
      });
    }
    const result = await measureSourceMetrics({ bus, persistDir, isDue: row => row.id.startsWith("query.") });
    expect(result).toEqual({ measured: ["query.first", "query.second"], skipped: [], failures: [] });
    expect(existsSync(marker)).toBe(false);
  });

  it("preserves legacy sample values even when an extra field is named samples", async () => {
    const metrics = createMetricService({ getDb: () => getDb(persistDir) });
    const ids = ["legacy.extra-number", "legacy.extra-map"];
    for (const [index, id] of ids.entries()) {
      const sample = { value: 7, samples: index === 0 ? 10 : { [id]: 99 } };
      metrics.define({
        id, name: id, type: "gauge", owner: "fixture",
        sourceCommand: `printf '%s' '${JSON.stringify(sample)}'`,
      });
    }
    const result = await measureSourceMetrics({ bus, persistDir, isDue: row => ids.includes(row.id) });
    expect(result.failures).toEqual([]);
    expect(result.measured).toHaveLength(2);
    for (const id of ids) expect(metrics.get(id)?.observation?.value).toBe(7);
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

  it("yields control traffic between independently evaluated metrics", async () => {
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
    expect(breachCount).toBe(0);
    await evaluateMetrics({ bus, persistDir });

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
    insertSnapshot.run(TASK_FAILOVER_METRIC.id, now - 60_000);
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

    expect(db.prepare(STALE_ACTIVE_SOURCE_QUERY).get()).toMatchObject({ value: 2 });
    const note = JSON.parse(String(db.prepare(STALE_ACTIVE_SOURCE_QUERY).get()!.note));
    expect(note.examples.map((row: any) => row.metricId).sort()).toEqual(["command.stale", "push.long-stale"]);
  });

  it("gives new collectors a grace period and alerts when even one established collector goes stale", () => {
    const db = getDb(persistDir);
    const metrics = createMetricService({ getDb: () => db });
    metrics.define({ id: "sample.collector", measureInterval: 300_000 });
    expect(db.prepare(STALE_ACTIVE_SOURCE_QUERY).get()).toMatchObject({ value: 0 });
    db.run("UPDATE metrics SET created_at = ? WHERE id = 'sample.collector'", [Date.now() - 16 * 60_000]);
    // A future-dated observation cannot hide missing current evidence.
    metrics.record("sample.collector", 0, { measuredAt: Date.now() + 60_000 });
    const sample = db.prepare(STALE_ACTIVE_SOURCE_QUERY).get()!;
    expect(sample).toMatchObject({ value: 1 });
    // Migrated definitions may have no creation time. record() also writes the
    // future measurement time into updated_at; neither is current evidence.
    db.run("UPDATE metrics SET created_at = NULL WHERE id = 'sample.collector'");
    expect(db.prepare(STALE_ACTIVE_SOURCE_QUERY).get()).toMatchObject({ value: 1 });
    metrics.record(STALE_ACTIVE_METRIC_ID, Number(sample.value));
    expect(metrics.evaluate(STALE_ACTIVE_METRIC_ID)[0]?.status).toBe("breached");
    metrics.record("sample.collector", 0, { measuredAt: Date.now() - 1_000 });
    metrics.record(STALE_ACTIVE_METRIC_ID, Number(db.prepare(STALE_ACTIVE_SOURCE_QUERY).get()!.value));
    expect(metrics.evaluate(STALE_ACTIVE_METRIC_ID)[0]?.status).toBe("recovered");
  });
});

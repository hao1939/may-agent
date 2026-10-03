import { afterEach, describe, expect, it } from "bun:test";
import { defineApp, Type } from "@may-agent/sdk";
import { createAppScheduleProducer } from "./adapters/producers/app-schedules.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDb, closeDb } from "../lib/requests.js";
import { createMetricService } from "../lib/metrics.js";
import { EventBus } from "./core/events/bus.js";
import { attachEventPersistence } from "./daemon-events.js";
import { attachMetricEvaluation, attachMetricSourceMeasurement, evaluateMetrics } from "./metric-source-measurement.js";

describe("independent metric passes", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
  function fixture() {
    const persistDir = mkdtempSync(join(tmpdir(), "metric-passes-"));
    roots.push(persistDir);
    const db = getDb(persistDir);
    const bus = new EventBus();
    attachEventPersistence({ persistDir, bus });
    return { persistDir, db, bus, metrics: createMetricService({ getDb: () => db }) };
  }

  it("evaluates retained samples while collection waits, then observes recovery only on the next evaluation", async () => {
    const { persistDir, db, bus, metrics } = fixture();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      async fetch() {
        entered.resolve();
        await release.promise;
        return new Response("0");
      },
    });
    const script = join(persistDir, "sample.mjs");
    writeFileSync(script, `console.log(await (await fetch("http://127.0.0.1:${server.port}")).text());`);
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const id = "fixture.queue";
    metrics.define({ id, threshold: 0, alertOp: ">", sourceCommand: `${quote(process.execPath)} ${quote(script)}` });
    metrics.record(id, 5);
    const collector = attachMetricSourceMeasurement({ bus, persistDir });
    const evaluator = attachMetricEvaluation({ bus, persistDir });
    const events: string[] = [];
    bus.subscribe((event) => {
      if ((event.type === "metric.breach" || event.type === "metric.recovered") && event.data.metricId === id)
        events.push(event.type);
    });
    let clock = 0;
    const schedule = createAppScheduleProducer({ bus, now: () => clock });
    schedule.replace([
      {
        appDir: persistDir,
        definition: defineApp({
          id: "fixture",
          agent: "fixture",
          version: 1,
          inputSchema: Type.Object({}),
          schedules: [
            { id: "collect", intervalMs: 300_000, event: { type: "trigger.metrics-snapshot", data: {} } },
            { id: "evaluate", intervalMs: 60_000, event: { type: "trigger.metrics-evaluate", data: {} } },
          ],
        }),
      },
    ]);
    const scanAt = (now: number) => {
      clock = now;
      schedule.scanNow();
    };
    try {
      scanAt(300_000);
      await entered.promise;
      await evaluator.idle();
      expect(events).toEqual(["metric.breach"]);
      expect(metrics.get(id)?.observation?.value).toBe(5);

      // Another evaluation is an ordinary retry, not another sample or episode.
      scanAt(360_000);
      await evaluator.idle();
      expect(events).toEqual(["metric.breach"]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM metric_snapshots WHERE metric_id = ?").get(id)).toEqual({
        count: 1,
      });
      release.resolve();
      await collector.idle();
      expect(metrics.get(id)?.observation?.value).toBe(0);
      expect(events).toEqual(["metric.breach"]);
      scanAt(420_000);
      await evaluator.idle();
      expect(events).toEqual(["metric.breach", "metric.recovered"]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'app.input.requested'").get()).toEqual(
        { count: 0 },
      );
    } finally {
      schedule.close();
      release.resolve();
      await collector.idle();
      await evaluator.idle();
      server.stop(true);
    }
  });

  it("retains calculation failure evidence and evaluates other metrics on the same pass", async () => {
    const { persistDir, db, bus, metrics } = fixture();
    for (const id of ["a.broken", "b.healthy"]) {
      metrics.define({ id, threshold: 0, alertOp: ">" });
      metrics.record(id, 1);
    }
    db.run("UPDATE metrics SET config = ? WHERE id = 'a.broken'", ['{"calculation":{"method":"unknown"}}']);
    const results = await evaluateMetrics({ bus, persistDir });
    expect(results).toMatchObject([{ metricId: "b.healthy", status: "breached" }]);
    expect(db.prepare("SELECT metric_id FROM events WHERE event_type = 'metric.evaluation.failed'").all()).toEqual([
      { metric_id: "a.broken" },
    ]);
    metrics.define({ id: "a.broken", threshold: 0, alertOp: ">" });
    expect(await evaluateMetrics({ bus, persistDir })).toMatchObject([
      { metricId: "a.broken", status: "breached" },
      { metricId: "b.healthy", status: "breached" },
    ]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'metric.breach'").get()).toEqual({
      count: 2,
    });
  });
});

import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { createMetricService } from "../../src/lib/metrics.js";
import { readMetricView } from "../../src/app/adapters/reporting/metric-read.js";

describe("sample calculations and alert transitions", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
  function fixture() {
    const root = mkdtempSync(join(tmpdir(), "metric-calculation-"));
    roots.push(root);
    let time = 0;
    const events: Array<{ type: string; data?: Record<string, unknown> }> = [];
    const service = () =>
      createMetricService({
        getDb: () => getDb(root),
        now: () => time,
        emit: (type, data) => events.push({ type, data }),
      });
    return {
      root,
      service,
      events,
      at: (now: number) => {
        time = now;
      },
    };
  }

  it("smooths a spike, survives restart, preserves an open breach on stale evidence, and recovers once", () => {
    const { root, service, events, at } = fixture();
    let metrics = service();
    const id = "fixture.queue";
    metrics.define({
      id,
      threshold: 50,
      alertOp: ">",
      measureInterval: 1_000,
      config: { calculation: { method: "mean", windowMs: 6_000, minSamples: 3 } },
    });
    for (const [time, value] of [
      [1_000, 0],
      [2_000, 0],
      [3_000, 90],
    ]) {
      at(time);
      metrics.record(id, value);
    }
    expect(events).toEqual([]);
    expect(metrics.evaluate(id)[0]).toMatchObject({ status: "ok", calculation: { value: 30, sampleCount: 3 } });
    expect(readMetricView(metrics, id)).toMatchObject({ value: 90, calculation: { value: 30 } });
    for (const time of [4_000, 5_000, 6_000]) {
      at(time);
      metrics.record(id, 120);
    }
    expect(metrics.evaluate(id)[0]).toMatchObject({ status: "breached", calculation: { value: 75 } });
    const opening = events[0];
    closeDb(root);
    metrics = service();
    metrics.record(id, 1000, { measuredAt: 10_000 }); // Future evidence is not current evidence.
    metrics.record(id, 1000, { measuredAt: 0 }); // The window has a strict lower bound.
    expect(metrics.evaluate(id)[0]).toMatchObject({ status: "breached", calculation: { value: 75 } });
    at(13_001);
    expect(metrics.evaluate(id)[0]).toMatchObject({ status: "unknown", calculation: { value: null } });
    expect(events).toEqual([opening]);
    expect(getDb(root).prepare("SELECT resolved_at FROM metric_alerts").get()).toEqual({ resolved_at: null });
    for (const time of [14_000, 15_000, 16_000]) {
      at(time);
      metrics.record(id, 0);
    }
    expect(metrics.evaluate(id)[0]).toMatchObject({ status: "recovered", calculation: { value: 0, sampleCount: 3 } });
    metrics.evaluate(id);
    expect(events.map(({ type }) => type)).toEqual(["metric.breach", "metric.recovered"]);
    expect(events[1].data?.alertId).toBe(opening.data?.alertId);
    expect(events[0].data?.calculation).toMatchObject({ value: 75, sampleCount: 6 });
  });

  it("recalculates a moving window without collecting and never counts evaluations as samples", () => {
    const { service, events, at } = fixture();
    const metrics = service();
    metrics.define({
      id: "mean",
      threshold: 50,
      alertOp: ">",
      config: { calculation: { method: "mean", windowMs: 5_000, maxAgeMs: 10_000 } },
    });
    for (const [time, value] of [
      [1_000, 0],
      [2_000, 80],
      [3_000, 80],
    ]) {
      at(time);
      metrics.record("mean", value);
    }
    expect(metrics.evaluate("mean")[0]).toMatchObject({ status: "breached" });
    at(7_000); // Only one sample remains; do not mistake incomplete evidence for recovery.
    expect(metrics.evaluate("mean")[0]).toMatchObject({ status: "unknown", calculation: { sampleCount: 1 } });
    expect(events).toHaveLength(1);

    metrics.define({
      id: "consecutive",
      type: "health",
      threshold: 0,
      alertOp: ">",
      config: { alert: { mode: "consecutive_failures", count: 3 } },
    });
    metrics.record("consecutive", 1);
    for (let n = 0; n < 5; n++) expect(metrics.evaluate("consecutive")[0]?.status).toBe("unknown");
    expect(events).toHaveLength(1);
    at(8_000);
    metrics.record("consecutive", 1);
    at(9_000);
    metrics.record("consecutive", 1);
    expect(metrics.evaluate("consecutive")[0]?.status).toBe("breached");
  });

  it("keeps repeated isolated spikes as samples instead of opening and closing work each time", () => {
    const { service, events, at } = fixture();
    const metrics = service();
    metrics.define({
      id: "spikes",
      threshold: 50,
      alertOp: ">",
      config: { calculation: { method: "mean", windowMs: 6_000 } },
    });
    for (const [index, value] of [0, 90, 0, 90, 0, 90, 0].entries()) {
      at((index + 1) * 1_000);
      metrics.record("spikes", value);
      metrics.evaluate("spikes");
    }
    expect(events).toEqual([]);
    expect(metrics.get("spikes")?.calculation).toMatchObject({ value: 45, sampleCount: 6 });
  });

  it("routes a stall through one breach episode and does not interpret a counter reset as recovery", () => {
    const { service, events, at } = fixture();
    const metrics = service();
    const id = "counter";
    metrics.define({
      id,
      type: "counter",
      threshold: 1000,
      alertOp: ">",
      config: { alert: { mode: "rate", min_rate: 1, stall_after_ms: 2_000 } },
    });
    at(1_000);
    metrics.record(id, 10);
    at(2_000);
    metrics.record(id, 10);
    metrics.evaluate(id);
    at(4_000);
    metrics.record(id, 10);
    metrics.evaluate(id);
    metrics.evaluate(id);
    expect(events.map(({ type }) => type)).toEqual(["metric.breach"]);
    at(5_000);
    metrics.record(id, 0);
    expect(metrics.evaluate(id)[0]?.status).toBe("unknown");
    expect(events).toHaveLength(1);
    at(6_000);
    metrics.record(id, 20);
    expect(metrics.evaluate(id)[0]?.status).toBe("recovered");
    expect(events.map(({ type }) => type)).toEqual(["metric.breach", "metric.recovered"]);
  });

  it("rejects invalid calculation policies before changing a definition", () => {
    const { service } = fixture();
    const metrics = service();
    for (const calculation of [
      { method: "mean" },
      { method: "mean", windowMs: -1 },
      { method: "mean", windowMs: 1000, minSamples: 0 },
      { method: "arbitrary-code" },
    ]) {
      expect(() => metrics.define({ id: "invalid", config: { calculation: calculation as never } })).toThrow(
        "calculation",
      );
    }
    expect(metrics.get("invalid")).toBeNull();
  });
});

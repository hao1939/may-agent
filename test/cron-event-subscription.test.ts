import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Cron } from "../src/app/cron.js";
import { EventBus, type SystemEvent } from "../src/app/event-bus.js";

describe("Cron event subscriptions", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("does not re-emit events observed from the bus", async () => {
    const dir = join(tmpdir(), `cron-sub-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "metric-reactor",
        intervalMs: 60_000,
        message: "react",
        enabled: true,
        handler: "metric-reactor",
        on: ["metric.breach"],
      },
    ]));

    const bus = new EventBus();
    const emitted: SystemEvent[] = [];
    let handled = 0;
    const cron = new Cron(configPath, {} as any, () => "session", undefined, dir, undefined, (event) => {
      emitted.push(event);
    });
    cron.load();
    cron.registerHandler("metric-reactor", async () => {
      handled++;
    });
    cron.subscribeToBus(bus);

    bus.emit({
      type: "metric.breach",
      owner: "may",
      metricId: "test.metric",
      metricName: "Test metric",
      current: 1,
      threshold: 2,
      message: "breached",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(handled).toBe(1);
    expect(emitted.some((event) => event.type === "metric.breach")).toBe(false);
    expect(emitted.some((event) => event.type === "handler.started")).toBe(true);
  });

  it("accepts handler-only entries as event subscribers", async () => {
    const dir = join(tmpdir(), `cron-handler-only-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "metric-alert-reactor",
        intervalMs: 60_000,
        enabled: true,
        handler: "metric-alert-reactor",
        on: ["metric.breach"],
      },
    ]));

    const bus = new EventBus();
    let handled = 0;
    const cron = new Cron(configPath, {} as any, () => "session", undefined, dir);
    const entries = cron.load();
    cron.registerHandler("metric-alert-reactor", async () => {
      handled++;
    });
    cron.subscribeToBus(bus);

    bus.emit({
      type: "metric.breach",
      owner: "arc",
      metricId: "v2.spec-coverage-rate",
      metricName: "v2 spec measurement coverage",
      current: 0.1,
      threshold: 0.8,
      message: "breached",
      priority: "P1",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(entries.map((entry) => entry.name)).toContain("metric-alert-reactor");
    expect(handled).toBe(1);
  });

  it("accepts event-only handler entries without interval timers", async () => {
    const dir = join(tmpdir(), `cron-event-only-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "evaluator-aftermath",
        enabled: true,
        handler: "run-workflow",
        on: ["session.completed"],
      },
    ]));

    const bus = new EventBus();
    let handled = 0;
    const cron = new Cron(configPath, {} as any, () => "session", undefined, dir);
    const entries = cron.load();
    cron.registerHandler("evaluator-aftermath", async () => {
      handled++;
    });
    cron.start();
    cron.subscribeToBus(bus);

    bus.emit({
      type: "session.completed",
      sessionId: "s_done",
      agent: "dev",
      parentSessionId: "s_parent",
    } as any);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(entries.map((entry) => entry.name)).toContain("evaluator-aftermath");
    expect(handled).toBe(1);
    cron.stop();
  });
});

import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Cron } from "../../src/app/cron.js";
import { EventBus, type SystemEvent } from "../../src/app/event-bus.js";

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
      source: "metrics-snapshot",
      owner: "agent:may",
      data: {
        metricId: "test.metric",
        metricName: "Test metric",
        current: 1,
        threshold: 2,
        message: "breached",
      },
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
      source: "metrics-snapshot",
      owner: "agent:arc",
      urgency: "high",
      data: {
        metricId: "v2.spec-coverage-rate",
        metricName: "v2 spec measurement coverage",
        current: 0.1,
        threshold: 0.8,
        message: "breached",
        priority: "P1",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(entries.map((entry) => entry.name)).toContain("metric-alert-reactor");
    expect(handled).toBe(1);
  });

  it("does not dispatch flat dot-named events to subscribers", async () => {
    const dir = join(tmpdir(), `cron-flat-event-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
    cron.load();
    cron.registerHandler("metric-alert-reactor", async () => {
      handled++;
    });
    cron.subscribeToBus(bus);

    bus.emit({
      type: "metric.breach",
      metricId: "v2.spec-coverage-rate",
      message: "flat payload should not wake handlers",
    } as any);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(handled).toBe(0);
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
        handler: {
          workflow: "evaluator-aftermath",
          agent: "evaluator",
          task: "Review completed session.",
          includeEvent: true,
        },
        on: ["session.completed"],
      },
    ]));

    const bus = new EventBus();
    let handled = 0;
    let handledEvent: any;
    const cron = new Cron(configPath, {} as any, () => "session", undefined, dir);
    const entries = cron.load();
    cron.registerHandler("evaluator-aftermath", async (event) => {
      handled++;
      handledEvent = event;
    });
    cron.start();
    cron.subscribeToBus(bus);

    const completedEvent = {
      type: "session.completed",
      source: "runtime",
      owner: "agent:dev",
      data: {
        sessionId: "s_done",
        agent: "dev",
        parentSessionId: "s_parent",
      },
    };
    bus.emit(completedEvent as any);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(entries.map((entry) => entry.name)).toContain("evaluator-aftermath");
    expect(handled).toBe(1);
    expect(handledEvent).toEqual(completedEvent);
    expect(handledEvent).not.toHaveProperty("sessionId");
    expect(handledEvent.data.sessionId).toBe("s_done");
    cron.stop();
  });

  it("delivers canonical event envelopes to handlers unchanged", async () => {
    const dir = join(tmpdir(), `cron-canonical-event-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "canonical-session-handler",
        enabled: true,
        handler: "canonical-session-handler",
        on: ["session.completed"],
      },
    ]));

    const bus = new EventBus();
    let handledEvent: any;
    const cron = new Cron(configPath, {} as any, () => "session", undefined, dir);
    cron.load();
    cron.registerHandler("canonical-session-handler", async (event) => {
      handledEvent = event;
    });
    cron.subscribeToBus(bus);

    const canonicalEvent = {
      type: "session.completed",
      source: "runtime",
      owner: "agent:may",
      data: {
        sessionId: "s_done",
        agent: "dev",
        status: "done",
      },
    };
    bus.emit(canonicalEvent as any);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(handledEvent).toEqual(canonicalEvent);
    expect(handledEvent).not.toHaveProperty("sessionId");
    expect(handledEvent.data.sessionId).toBe("s_done");
  });

  it("dispatchEvent synthesizes one canonical envelope for emit and handler delivery", async () => {
    const dir = join(tmpdir(), `cron-dispatch-envelope-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "metric-reactor",
        enabled: true,
        handler: "metric-reactor",
        on: ["metric.breach"],
      },
    ]));

    const emitted: SystemEvent[] = [];
    let handledEvent: any;
    const cron = new Cron(configPath, {} as any, () => "session", undefined, dir, undefined, (event) => {
      emitted.push(event);
    });
    cron.load();
    cron.registerHandler("metric-reactor", async (event) => {
      handledEvent = event;
    });

    const triggered = cron.dispatchEvent("metric.breach", {
      metricId: "system.health",
      message: "breached",
      current: 1,
      threshold: 2,
    });

    expect(triggered).toBe(1);
    expect(emitted[0]).toEqual({
      type: "metric.breach",
      source: "cron",
      owner: "agent:may",
      timestamp: expect.any(Number),
      data: {
        metricId: "system.health",
        message: "breached",
        current: 1,
        threshold: 2,
      },
    });
    expect(emitted[0]).not.toHaveProperty("metricId");
    expect(handledEvent).toEqual(emitted[0]);
  });

  it("routes heartbeat.trigger only to the requested agent heartbeat", async () => {
    const dir = join(tmpdir(), `cron-heartbeat-route-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "heartbeat-alpha",
        enabled: true,
        handler: { agent: "alpha", workflow: "alpha-heartbeat", task: "[heartbeat]" },
        on: ["heartbeat.trigger"],
      },
      {
        name: "heartbeat-beta",
        enabled: true,
        handler: { agent: "beta", workflow: "beta-heartbeat", task: "[heartbeat]" },
        on: ["heartbeat.trigger"],
      },
    ]));

    const bus = new EventBus();
    let alphaHandled = 0;
    let betaHandled = 0;
    let alphaEvent: any;
    const cron = new Cron(configPath, {} as any, () => "session", undefined, dir);
    cron.load();
    cron.registerHandler("heartbeat-alpha", async (event) => {
      alphaHandled++;
      alphaEvent = event;
    });
    cron.registerHandler("heartbeat-beta", async () => {
      betaHandled++;
    });
    cron.subscribeToBus(bus);

    bus.emit({
      type: "heartbeat.trigger",
      source: "web-ui",
      owner: "agent:alpha",
      data: { agent: "alpha" },
    } as any);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(alphaHandled).toBe(1);
    expect(betaHandled).toBe(0);
    expect(alphaEvent).toMatchObject({
      type: "heartbeat.trigger",
      source: "web-ui",
      owner: "agent:alpha",
      data: { agent: "alpha" },
    });
  });
});

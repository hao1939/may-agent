import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HostMaintenance } from "../../src/app/adapters/maintenance/runtime.js";
import { EventBus, type SystemEvent } from "../../src/app/core/events/bus.js";

describe("HostMaintenance event subscriptions", () => {
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
        enabled: true,
        handler: "metric-reactor",
        on: ["metric.breach"],
      },
    ]));

    const bus = new EventBus();
    const emitted: SystemEvent[] = [];
    let handled = 0;
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: dir, emitEvent: (event) => {
      emitted.push(event);
    } });
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
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: dir });
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
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: dir });
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
        handler: "session-recovery",
        on: ["session.end"],
      },
    ]));

    const bus = new EventBus();
    let handled = 0;
    let handledEvent: any;
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: dir });
    const entries = cron.load();
    cron.registerHandler("evaluator-aftermath", async (event) => {
      handled++;
      handledEvent = event;
    });
    cron.start();
    cron.subscribeToBus(bus);

    const completedEvent = {
      type: "session.end",
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
        on: ["session.end"],
      },
    ]));

    const bus = new EventBus();
    let handledEvent: any;
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: dir });
    cron.load();
    cron.registerHandler("canonical-session-handler", async (event) => {
      handledEvent = event;
    });
    cron.subscribeToBus(bus);

    const canonicalEvent = {
      type: "session.end",
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

  it("queues event subscribers by default until the running handler completes", async () => {
    const dir = join(tmpdir(), `cron-single-flight-events-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "single-task-executor",
        enabled: true,
        handler: "single-task-executor",
        on: ["project.task.execution.requested"],
      },
    ]));

    const bus = new EventBus();
    const started: string[] = [];
    const resolvers: Array<() => void> = [];
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: dir });
    cron.load();
    cron.registerHandler("single-task-executor", async (event) => {
      started.push(String(event?.data.taskId));
      await new Promise<void>((resolve) => resolvers.push(resolve));
    });
    cron.subscribeToBus(bus);

    for (const taskId of ["a", "b"]) {
      bus.emit({
        type: "project.task.execution.requested",
        source: "test",
        owner: "agent:test",
        data: { taskId },
      } as any);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toEqual(["a"]);

    resolvers.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toEqual(["a", "b"]);

    for (const resolve of resolvers.splice(0)) resolve();
  });

  it("uses default maxQueueDepth of 3 when not configured", async () => {
    const dir = join(tmpdir(), `cron-queue-default-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "default-queue-handler",
        enabled: true,
        handler: "default-queue-handler",
        on: ["project.owner.requested"],
        // no maxQueueDepth — should default to 3
      },
    ]));

    const bus = new EventBus();
    const started: string[] = [];
    const resolvers: Array<() => void> = [];
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: dir });
    cron.load();
    cron.registerHandler("default-queue-handler", async (event) => {
      started.push(String(event?.data.reason));
      await new Promise<void>((resolve) => resolvers.push(resolve));
    });
    cron.subscribeToBus(bus);

    // Emit 1 (runs) + 6 more (5 should be queued but limited to 3).
    for (const reason of ["a", "b", "c", "d", "e", "f", "g"]) {
      bus.emit({ type: "project.owner.requested", source: "test", owner: "agent:may", data: { reason } } as any);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toEqual(["a"]);

    // Drain all: a runs, then e, f, g (newest 3 kept from 6 queued).
    for (let i = 0; i < 4; i++) {
      resolvers.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    // "a" started first, then queue kept latest 3: "e", "f", "g"
    expect(started).toEqual(["a", "e", "f", "g"]);

    for (const resolve of resolvers.splice(0)) resolve();
  });

  it("applies exponential backoff on queue drain after handler errors", async () => {
    const dir = join(tmpdir(), `cron-error-backoff-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const configPath = join(dir, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "error-backoff-handler",
        enabled: true,
        handler: "error-backoff-handler",
        on: ["test.event"],
      },
    ]));

    const bus = new EventBus();
    const errors: string[] = [];
    let callCount = 0;
    const cron = new HostMaintenance({ configPath: configPath, projectRoot: dir, notify: (msg) => errors.push(msg) });
    cron.load();
    cron.registerHandler("error-backoff-handler", async () => {
      callCount++;
      throw new Error("instant failure");
    });
    cron.subscribeToBus(bus);

    // Emit 6 events — first fires immediately, 5 queue
    for (let i = 0; i < 6; i++) {
      bus.emit({ type: "test.event", source: "test", owner: "agent:may", data: { i } } as any);
    }

    // Wait a brief period — without backoff the tight loop would drain all 5 queued events
    // in <100ms. With backoff (5s minimum), only the initial trigger should have fired.
    await new Promise((resolve) => setTimeout(resolve, 200));

    // The initial event fires and errors. The first queued event should wait 5s backoff.
    // After 5 consecutive errors, the queue should be dropped.
    // In 200ms, we expect at most 1-2 runs (the initial + maybe one that squeaked through),
    // NOT all 6 cascading instantly.
    expect(callCount).toBeLessThanOrEqual(2);

    // This proves bounded retry rate, not eventual queue dropping: the 5s
    // backoff has not elapsed in this 200ms observation window.
  });
});

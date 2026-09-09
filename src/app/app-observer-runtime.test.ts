import { describe, expect, it } from "bun:test";
import type { AppDefinition } from "@may-agent/sdk";
import { EventBus } from "./core/events/bus.js";
import { createAppObserverRuntime } from "./app-observer-runtime.js";

function entry(definition: AppDefinition) {
  return { appDir: `/apps/${definition.id}.app`, definition };
}

describe("canonical App observers", () => {
  it("survives failed fact and error publication, then recollects the next observation", async () => {
    let locked = true,
      currentTime = 1,
      observations = 0;
    const bus = new EventBus();
    bus.setPersistenceSubscriber(() => {
      if (locked) throw new Error("database is locked");
    });
    const events: string[] = [];
    bus.subscribe((event) => events.push(event.type));
    const runtime = createAppObserverRuntime({
      bus,
      now: () => currentTime,
      context: () => ({ read: {} as never, log: {} as never, workspace: { appRoot: "/app", projectRoot: "/project" } }),
    });
    runtime.replace([
      entry({
        id: "evaluation",
        version: 1,
        owner: "evaluator",
        inputSchema: { type: "object" },
        observers: [
          {
            id: "provider",
            intervalMs: 100,
            async run() {
              observations++;
              return [{ type: "sample.observed", data: { observations } }];
            },
          },
        ],
      }),
    ]);
    try {
      runtime.scanNow();
      await Bun.sleep(5);
      expect(events).toHaveLength(0);
      locked = false;
      currentTime = 101;
      runtime.scanNow();
      await Bun.sleep(5);
      expect(events).toEqual(["sample.observed"]);
      expect(observations).toBe(2);
    } finally {
      runtime.close();
    }
  });

  it("publishes successful facts once per slot and reports bounded failures", async () => {
    let currentTime = 1;
    let shouldFail = false;
    const events: Array<Record<string, unknown>> = [];
    const bus = new EventBus();
    bus.subscribe((event) => events.push(event as unknown as Record<string, unknown>));
    const runtime = createAppObserverRuntime({
      bus,
      context: () => ({
        read: {} as never,
        log: {} as never,
        workspace: { appRoot: "/apps/evaluation.app", projectRoot: "/projects/evaluation" },
      }),
      now: () => currentTime,
    });
    runtime.replace([
      entry({
        id: "evaluation",
        version: 1,
        owner: "evaluator",
        inputSchema: { type: "object" },
        observers: [
          {
            id: "pipeline",
            intervalMs: 100,
            async run() {
              if (shouldFail) throw new Error("provider unavailable");
              return [{ type: "evaluation.pipeline.observed", data: { healthy: true } }];
            },
          },
        ],
      }),
    ]);

    runtime.scanNow();
    await Bun.sleep(5);
    runtime.scanNow();
    await Bun.sleep(5);
    expect(events.filter((event) => event.type === "evaluation.pipeline.observed")).toHaveLength(1);

    shouldFail = true;
    currentTime = 101;
    runtime.scanNow();
    await Bun.sleep(5);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "app.observer.failed",
        data: expect.objectContaining({ appId: "evaluation", observerId: "pipeline", error: "provider unavailable" }),
      }),
    );
    runtime.close();
  });

  it("drops a late result from a replaced generation", async () => {
    let release!: (facts: Array<{ type: string; data: unknown }>) => void;
    const pending = new Promise<Array<{ type: string; data: unknown }>>((resolve) => {
      release = resolve;
    });
    const events: string[] = [];
    const bus = new EventBus();
    bus.subscribe((event) => events.push(event.type));
    const runtime = createAppObserverRuntime({
      bus,
      context: () => ({
        read: {} as never,
        log: {} as never,
        workspace: { appRoot: "/apps/evaluation.app", projectRoot: "/projects/evaluation" },
      }),
      now: () => 1,
    });
    runtime.replace([
      entry({
        id: "evaluation",
        version: 1,
        owner: "evaluator",
        inputSchema: { type: "object" },
        observers: [{ id: "pipeline", intervalMs: 100, run: () => pending }],
      }),
    ]);
    runtime.scanNow();
    runtime.replace([
      entry({
        id: "evaluation",
        version: 1,
        owner: "evaluator",
        inputSchema: { type: "object" },
        observers: [
          {
            id: "pipeline",
            intervalMs: 100,
            async run() {
              return [{ type: "fresh.fact", data: {} }];
            },
          },
        ],
      }),
    ]);
    runtime.scanNow();
    release([{ type: "stale.fact", data: {} }]);
    await Bun.sleep(5);

    expect(events).not.toContain("stale.fact");
    expect(events).toContain("fresh.fact");
    runtime.close();
  });
});

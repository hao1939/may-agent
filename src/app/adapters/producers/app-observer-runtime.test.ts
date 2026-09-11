import { describe, expect, it } from "bun:test";
import {
  MAX_OBSERVER_SNAPSHOT_BYTES,
  type AppDefinition,
  type AppObserver,
  type AppObserverResult,
  type ObserverSnapshot,
} from "@may-agent/sdk";
import { EventBus } from "../../core/events/bus.js";
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

describe("publication-coupled observation memory", () => {
  function fixture(run: AppObserver["run"]) {
    let now = 1;
    const bus = new EventBus();
    const definition: AppDefinition = {
      id: "sample",
      version: 1,
      agent: "worker",
      inputSchema: { type: "object" },
      observers: [{ id: "provider", intervalMs: 100, run }],
    };
    const runtime = createAppObserverRuntime({
      bus,
      now: () => now,
      context: () => ({
        read: {} as never,
        log: {} as never,
        workspace: { appRoot: "/apps/sample.app", projectRoot: "/projects/sample" },
      }),
    });
    runtime.replace([entry(definition)]);
    return {
      bus,
      runtime,
      definition,
      async scan() {
        runtime.scanNow();
        // The fixtures return already resolved promises: this continuation is
        // queued after the runtime's publication, not an elapsed-time guess.
        await Promise.resolve();
        now += 100;
      },
    };
  }

  it("retries a failed transition, stays quiet after publication, and reports recurrence", async () => {
    let state = "ready",
      fail = false;
    const seen: ObserverSnapshot[] = [];
    const f = fixture(async ({ previousObservation }) => ({
      events: state === "ready" || previousObservation !== state ? [{ type: "sample.state", data: { state } }] : [],
      nextObservation: state,
    }));
    f.bus.setPersistenceSubscriber((event) => {
      if (event.type === "sample.state") {
        if (fail) throw new Error("publication unavailable");
        seen.push((event.data as { state: string }).state);
      }
    });
    try {
      await f.scan();
      state = "unavailable";
      fail = true;
      await f.scan();
      fail = false;
      await f.scan();
      await f.scan();
      state = "ready";
      await f.scan();
      await f.scan();
      state = "unavailable";
      await f.scan();
      expect(seen).toEqual(["ready", "unavailable", "ready", "ready", "unavailable"]);
    } finally {
      f.runtime.close();
    }
  });

  it("retains the prior snapshot after a partial batch and detaches both input and output", async () => {
    const previous: (ObserverSnapshot | undefined)[] = [];
    const next = { revision: 1 };
    let fail = false;
    const f = fixture(async (ctx) => {
      previous.push(structuredClone(ctx.previousObservation));
      if (ctx.previousObservation) (ctx.previousObservation as { revision: number }).revision = 999;
      return {
        events: [
          { type: "first.fact", data: {} },
          { type: "second.fact", data: {} },
        ],
        nextObservation: next,
      };
    });
    const published: string[] = [];
    f.bus.setPersistenceSubscriber((event) => {
      if (event.type === "second.fact" && fail) throw new Error("second append failed");
      if (event.type.endsWith(".fact")) published.push(event.type);
    });
    try {
      await f.scan();
      next.revision = 2;
      fail = true;
      await f.scan();
      fail = false;
      await f.scan();
      await f.scan();
      expect(previous).toEqual([undefined, { revision: 1 }, { revision: 1 }, { revision: 2 }]);
      expect(published).toEqual([
        "first.fact",
        "second.fact",
        "first.fact",
        "first.fact",
        "second.fact",
        "first.fact",
        "second.fact",
      ]);
    } finally {
      f.runtime.close();
    }
  });

  it("rejects a whole invalid result before publishing any fact or changing memory", async () => {
    let snapshot: unknown = "valid";
    let badEvent = false;
    const seen: (ObserverSnapshot | undefined)[] = [];
    const f = fixture(async (ctx) => {
      seen.push(ctx.previousObservation);
      return {
        events: [{ type: "sample.fact", data: {} }, ...(badEvent ? [{}] : [])],
        nextObservation: snapshot,
      } as AppObserverResult;
    });
    const published: string[] = [];
    f.bus.subscribe((event) => published.push(event.type));
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    try {
      await f.scan();
      for (snapshot of [
        undefined,
        NaN,
        new Date(),
        { bad: undefined },
        cycle,
        "界".repeat(MAX_OBSERVER_SNAPSHOT_BYTES),
      ]) {
        await f.scan();
      }
      snapshot = "would-hide-invalid-batch";
      badEvent = true;
      await f.scan();
      badEvent = false;
      snapshot = null;
      await f.scan();
      expect(seen.slice(1)).toEqual(Array(8).fill("valid"));
      expect(published.filter((type) => type === "sample.fact")).toHaveLength(2);
      expect(published.filter((type) => type === "app.observer.failed")).toHaveLength(7);
    } finally {
      f.runtime.close();
    }
  });

  it("forgets replaced memory and fences a late snapshot and facts on replace or close", async () => {
    const seen: (ObserverSnapshot | undefined)[] = [];
    const pending = Promise.withResolvers<AppObserverResult>();
    let blocked = false;
    const f = fixture((ctx) => {
      seen.push(ctx.previousObservation);
      return blocked ? pending.promise : Promise.resolve({ events: [], nextObservation: "published" });
    });
    const facts: string[] = [];
    f.bus.subscribe((event) => facts.push(event.type));
    await f.scan();
    blocked = true;
    await f.scan();
    f.runtime.replace([entry(f.definition)]);
    blocked = false;
    await f.scan();
    pending.resolve({ events: [{ type: "stale.fact", data: {} }], nextObservation: "stale" });
    await Promise.resolve();
    await f.scan();
    expect(seen).toEqual([undefined, "published", undefined, "published"]);
    expect(facts).toEqual([]);
    const closing = Promise.withResolvers<AppObserverResult>();
    f.definition.observers![0]!.run = () => closing.promise;
    f.runtime.replace([entry(f.definition)]);
    f.runtime.scanNow();
    f.runtime.close();
    closing.resolve({ events: [{ type: "closed.fact", data: {} }], nextObservation: "closed" });
    await Promise.resolve();
    expect(facts).toEqual([]);
  });
});

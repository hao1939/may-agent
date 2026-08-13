/**
 * EventBus subscriber priority — v2 invariant.
 *
 * Persistence MUST run before side-effect handlers, so that any work
 * triggered by an event is backed by a durable event record on disk.
 */

import { describe, it, expect } from "bun:test";
import { EVENT_DEDUPLICATED, EVENT_REDELIVERY_REQUIRED, EVENT_ROW_ID, EventBus } from "./event-bus.js";

describe("EventBus subscriber priority", () => {
  it("reruns only explicit durable routes during pending-event redelivery", () => {
    const bus = new EventBus();
    const calls: string[] = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_DEDUPLICATED, { value: true });
      Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true });
    });
    bus.subscribeDurableRoute(() => {
      calls.push("durable");
      return { accepted: true, by: "durable" };
    });
    bus.subscribe(() => calls.push("ordinary"));

    bus.emit({ type: "info", message: "retry" });

    expect(calls).toEqual(["durable"]);
  });

  it("runs 'first' subscribers before 'normal' subscribers", () => {
    const bus = new EventBus();
    const order: string[] = [];

    bus.subscribe(() => order.push("normal-1"));
    bus.subscribe(() => order.push("first-1"), { priority: "first" });
    bus.subscribe(() => order.push("normal-2"));
    bus.subscribe(() => order.push("first-2"), { priority: "first" });

    bus.emit({ type: "info", message: "test" });

    expect(order).toEqual(["first-1", "first-2", "normal-1", "normal-2"]);
  });

  it("preserves registration order within each priority bucket", () => {
    const bus = new EventBus();
    const order: string[] = [];

    bus.subscribe(() => order.push("a"), { priority: "first" });
    bus.subscribe(() => order.push("b"), { priority: "first" });
    bus.subscribe(() => order.push("c"), { priority: "first" });
    bus.subscribe(() => order.push("d"));

    bus.emit({ type: "info", message: "x" });

    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("a throwing 'first' subscriber does not prevent others from running", () => {
    const bus = new EventBus();
    const order: string[] = [];

    bus.subscribe(
      (event) => {
        if (event.type === "info") throw new Error("boom");
      },
      { priority: "first" },
    );
    bus.subscribe(
      (event) => {
        if (event.type === "info") order.push("first-after-throw");
      },
      { priority: "first" },
    );
    bus.subscribe((event) => {
      if (event.type === "info") order.push("normal");
    });

    bus.emit({ type: "info", message: "y" });

    expect(order).toEqual(["first-after-throw", "normal"]);
  });

  it("does not run side-effect subscribers when required persistence fails", () => {
    const bus = new EventBus();
    const order: string[] = [];

    bus.setPersistenceSubscriber(() => {
      order.push("persist");
      throw new Error("disk unavailable");
    });
    bus.subscribe(() => order.push("first"), { priority: "first" });
    bus.subscribe(() => order.push("normal"));

    expect(() => bus.emit({ type: "info", message: "must be durable" })).toThrow("disk unavailable");
    expect(order).toEqual(["persist"]);
  });

  it("routes an extensible persisted envelope when producer input is frozen", () => {
    const bus = new EventBus();
    const observed: any[] = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 73, configurable: true });
    });
    bus.subscribe((event) => observed.push(event));

    const input = Object.freeze({ type: "info", message: "frozen" }) as any;
    const emitted = bus.emit(input);

    expect(emitted).not.toBe(input);
    expect((emitted as any)[EVENT_ROW_ID]).toBe(73);
    expect(observed[0]).toBe(emitted);
  });

  it("emits a durable subscriber.failed signal after subscriber exceptions", () => {
    const bus = new EventBus();
    const events: any[] = [];

    bus.subscribe((event) => events.push(event), { priority: "first" });
    bus.subscribe((event) => {
      if (event.type === "info") throw new Error("boom");
    });

    bus.emit({ type: "info", message: "z" });

    expect(events.map((event) => event.type)).toEqual(["info", "subscriber.failed"]);
    expect(events[1]).toMatchObject({
      type: "subscriber.failed",
      source: "event-bus",
      owner: "agent:may",
      data: {
        originalEventType: "info",
        subscriberPriority: "normal",
        error: "boom",
      },
    });
  });

  it("unsubscribe works for both priorities", () => {
    const bus = new EventBus();
    const order: string[] = [];

    const unsubFirst = bus.subscribe(() => order.push("first"), { priority: "first" });
    const unsubNormal = bus.subscribe(() => order.push("normal"));

    bus.emit({ type: "info", message: "1" });
    expect(order).toEqual(["first", "normal"]);

    unsubFirst();
    order.length = 0;
    bus.emit({ type: "info", message: "2" });
    expect(order).toEqual(["normal"]);

    unsubNormal();
    order.length = 0;
    bus.emit({ type: "info", message: "3" });
    expect(order).toEqual([]);
  });

  it("listenerCount counts both priority buckets", () => {
    const bus = new EventBus();
    expect(bus.listenerCount).toBe(0);

    bus.subscribe(() => {}, { priority: "first" });
    bus.subscribe(() => {});
    bus.subscribe(() => {}, { priority: "first" });

    expect(bus.listenerCount).toBe(3);
  });

  it("inherits trace context for events emitted by a handler", () => {
    const bus = new EventBus();
    const events: any[] = [];
    let nextId = 40;

    bus.subscribe(
      (event) => {
        Object.defineProperty(event, EVENT_ROW_ID, { value: ++nextId, configurable: true });
        events.push(event);
      },
      { priority: "first" },
    );
    bus.subscribe((event) => {
      if (event.type !== "info") return;
      bus.emit({
        type: "subscriber.failed",
        source: "test",
        owner: "agent:may",
        timestamp: Date.now(),
        data: { originalEventType: event.type, subscriberPriority: "normal", error: "test" },
      });
    });

    bus.emit({ type: "info", message: "parent" });

    expect(events[1].trace).toEqual({ traceId: "event:41", parentEventId: 41 });
  });

  it("keeps trace context across asynchronous handler continuations", async () => {
    const bus = new EventBus();
    const events: any[] = [];
    let nextId = 90;
    let resolveChild!: () => void;
    const childEmitted = new Promise<void>((resolve) => {
      resolveChild = resolve;
    });

    bus.subscribe(
      (event) => {
        Object.defineProperty(event, EVENT_ROW_ID, { value: ++nextId, configurable: true });
        events.push(event);
      },
      { priority: "first" },
    );
    bus.subscribe((event) => {
      if (event.type !== "info") return;
      void Promise.resolve().then(() => {
        bus.emit({
          type: "subscriber.failed",
          source: "test",
          owner: "agent:may",
          timestamp: Date.now(),
          data: { originalEventType: event.type, subscriberPriority: "normal", error: "async test" },
        });
        resolveChild();
      });
    });

    bus.emit({ type: "info", message: "parent" });
    await childEmitted;

    expect(events[1].trace).toEqual({ traceId: "event:91", parentEventId: 91 });
  });
});

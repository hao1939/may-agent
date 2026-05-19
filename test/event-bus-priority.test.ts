/**
 * EventBus subscriber priority — v2 invariant.
 *
 * Persistence MUST run before side-effect handlers, so that any work
 * triggered by an event is backed by a durable event record on disk.
 */

import { describe, it, expect } from "bun:test";
import { EventBus } from "../src/app/event-bus.js";

describe("EventBus subscriber priority", () => {
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

    bus.subscribe((event) => { if (event.type === "info") throw new Error("boom"); }, { priority: "first" });
    bus.subscribe((event) => { if (event.type === "info") order.push("first-after-throw"); }, { priority: "first" });
    bus.subscribe((event) => { if (event.type === "info") order.push("normal"); });

    bus.emit({ type: "info", message: "y" });

    expect(order).toEqual(["first-after-throw", "normal"]);
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
});

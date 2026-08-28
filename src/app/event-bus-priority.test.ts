/**
 * EventBus subscriber priority — v2 invariant.
 *
 * Persistence MUST run before side-effect handlers, so that any work
 * triggered by an event is backed by a durable event record on disk.
 */

import { describe, it, expect } from "bun:test";
import {
  EVENT_DEDUPLICATED,
  EVENT_DELIVERY_RESULT,
  EVENT_REDELIVERY_REQUIRED,
  EVENT_ROW_ID,
  EventBus,
} from "./event-bus.js";

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
    bus.listen(() => calls.push("listener"));

    bus.emit({ type: "info", message: "retry" });

    expect(calls).toEqual(["durable"]);
  });

  it("redelivers an existing journal row without appending or replaying side effects", () => {
    const bus = new EventBus();
    const calls: string[] = [];
    bus.setPersistenceSubscriber(() => calls.push("persist"));
    bus.subscribeDurableRoute(() => {
      calls.push("durable");
      return { accepted: true, by: "durable-recovery" };
    });
    bus.subscribe(() => calls.push("ordinary"));
    bus.listen(() => calls.push("listener"));
    bus.setDeliveryRecorder((event) => calls.push(`receipt:${event[EVENT_ROW_ID]}`));

    const recovered = bus.redeliverPersisted({ type: "info", message: "recover" }, 91);

    expect(calls).toEqual(["durable", "receipt:91"]);
    expect(recovered[EVENT_ROW_ID]).toBe(91);
    expect(recovered[EVENT_DELIVERY_RESULT]).toMatchObject({ accepted: true, by: "durable-recovery" });
  });

  it("fans out a worker-persisted event without appending it twice", async () => {
    const bus = new EventBus();
    const calls: string[] = [];
    bus.setPersistenceSubscriber(() => calls.push("persist"));
    bus.subscribeDurableRoute(() => {
      calls.push("durable");
      return { accepted: true, by: "worker-route" };
    });
    bus.subscribe(() => calls.push("ordinary"));
    bus.listen(() => calls.push("listener"));
    bus.setDeliveryRecorder((event) => calls.push(`receipt:${event[EVENT_ROW_ID]}`));

    const forwarded = bus.fanoutPersisted({ type: "info", message: "from worker" }, 92);

    expect(calls).toEqual(["durable", "ordinary", "receipt:92"]);
    expect(forwarded[EVENT_ROW_ID]).toBe(92);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(calls).toEqual(["durable", "ordinary", "receipt:92", "listener"]);
  });

  it("runs listeners later in FIFO order without extending emit", async () => {
    const bus = new EventBus();
    const calls: string[] = [];
    bus.subscribe((event) => calls.push(`route:${event.type}`));
    bus.listen(async (event) => {
      await Promise.resolve();
      calls.push(`observe:${event.type}`);
    });

    bus.emit({ type: "info", message: "one" });
    bus.emit({ type: "heartbeat", agent: "may" });

    expect(calls).toEqual(["route:info", "route:heartbeat"]);
    for (let turn = 0; turn < 2; turn++) await new Promise<void>((resolve) => setImmediate(resolve));
    expect(calls).toEqual(["route:info", "route:heartbeat", "observe:info", "observe:heartbeat"]);
  });

  it("yields to timers between listener notifications", async () => {
    const bus = new EventBus();
    let observed = 0;
    let resolveAfterFirst!: (count: number) => void;
    const afterFirst = new Promise<number>((resolve) => {
      resolveAfterFirst = resolve;
    });
    bus.listen(() => {
      observed += 1;
      if (observed === 1) setTimeout(() => resolveAfterFirst(observed), 0);
      const until = Date.now() + 4;
      while (Date.now() < until) {}
    });
    for (let index = 0; index < 64; index += 1) bus.emit({ type: "info", message: String(index) });

    expect(await afterFirst).toBe(1);
    while (observed < 64) await new Promise<void>((resolve) => setImmediate(resolve));
  });

  it("keeps each listener independent and filters before queueing", async () => {
    const bus = new EventBus();
    const calls: string[] = [];
    let releaseSlow!: () => void;
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    bus.listen(
      async () => {
        calls.push("slow:start");
        await slow;
        calls.push("slow:end");
      },
      { types: ["info"] },
    );
    bus.listen((event) => calls.push(`fast:${event.type}`), { types: ["info"] });

    bus.emit({ type: "info", message: "one" });
    bus.emit({ type: "heartbeat", agent: "may" });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(calls).toEqual(["slow:start", "fast:info"]);
    releaseSlow();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(calls).toEqual(["slow:start", "fast:info", "slow:end"]);
  });

  it("bounds a stalled listener backlog and retains the newest notifications", async () => {
    const bus = new EventBus();
    const observed: string[] = [];
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    bus.listen(async (event) => {
      const message = String((event as { message?: unknown }).message ?? "");
      observed.push(message);
      if (message === "blocked") await first;
    });

    bus.emit({ type: "info", message: "blocked" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    for (let index = 1; index <= 300; index++) bus.emit({ type: "info", message: String(index) });
    releaseFirst();
    for (let turn = 0; turn < 300 && observed.at(-1) !== "300"; turn++) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    expect(observed).toHaveLength(257);
    expect(observed[0]).toBe("blocked");
    expect(observed[1]).toBe("45");
    expect(observed.at(-1)).toBe("300");
  });

  it("reports listener failures as later durable events", async () => {
    const bus = new EventBus();
    const persisted: string[] = [];
    bus.setPersistenceSubscriber((event) => persisted.push(event.type));
    bus.listen((event) => {
      if (event.type === "info") throw new Error("listener boom");
    });

    bus.emit({ type: "info", message: "test" });
    expect(persisted).toEqual(["info"]);
    for (let turn = 0; turn < 2; turn++) await new Promise<void>((resolve) => setImmediate(resolve));
    expect(persisted).toEqual(["info", "subscriber.failed"]);
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

  it("keeps an event pending when durable admission fails even if an ordinary route accepts it", () => {
    const bus = new EventBus();
    const recorded: string[] = [];
    let ordinaryCalls = 0;
    bus.subscribeDurableRoute((event) => {
      if (event.type === "info") throw new Error("durable admission failed");
    });
    bus.subscribe((event) => {
      if (event.type !== "info") return;
      ordinaryCalls += 1;
      return { accepted: true, by: "ordinary" };
    });
    bus.setDeliveryRecorder((event) => recorded.push(event.type));

    bus.emit({ type: "info", message: "must remain pending" });

    expect(ordinaryCalls).toBe(1);
    expect(recorded).not.toContain("info");
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

  it("does not let passive failure reporting change an accepted event when storage is full", async () => {
    const bus = new EventBus();
    const persisted: string[] = [];
    bus.setPersistenceSubscriber((event) => {
      persisted.push(event.type);
      if (event.type === "subscriber.failed") throw new Error("database or disk is full");
    });
    bus.subscribe((event) => {
      if (event.type === "info") throw new Error("observer failed");
    });

    expect(() => bus.emit({ type: "info", message: "durable first" })).not.toThrow();
    expect(persisted).toEqual(["info"]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(persisted).toEqual(["info", "subscriber.failed"]);
  });

  it("contains a listener diagnostic that cannot be persisted", async () => {
    const bus = new EventBus();
    const persisted: string[] = [];
    bus.setPersistenceSubscriber((event) => {
      persisted.push(event.type);
      if (event.type === "subscriber.failed") throw new Error("database or disk is full");
    });
    bus.listen((event) => {
      if (event.type === "info") throw new Error("listener failed");
    });

    bus.emit({ type: "info", message: "accepted before observation" });
    for (let turn = 0; turn < 2; turn++) await new Promise<void>((resolve) => setImmediate(resolve));

    expect(persisted).toEqual(["info", "subscriber.failed"]);
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

  it("emits a durable subscriber.failed signal after subscriber exceptions", async () => {
    const bus = new EventBus();
    const events: any[] = [];

    bus.subscribe((event) => events.push(event), { priority: "first" });
    bus.subscribe((event) => {
      if (event.type === "info") throw new Error("boom");
    });

    bus.emit({ type: "info", message: "z" });
    expect(events.map((event) => event.type)).toEqual(["info"]);
    await new Promise<void>((resolve) => setImmediate(resolve));

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

  it("listenerCount counts routes and listeners", () => {
    const bus = new EventBus();
    expect(bus.listenerCount).toBe(0);

    bus.subscribe(() => {}, { priority: "first" });
    bus.subscribe(() => {});
    bus.subscribe(() => {}, { priority: "first" });
    bus.listen(() => {});

    expect(bus.listenerCount).toBe(4);
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

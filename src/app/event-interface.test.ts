import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../lib/db-writer.js";
import { closeDb, getDb } from "../lib/requests.js";
import { createAppInboxItem } from "./app-inbox-store.js";
import { EVENT_ROW_ID, eventData, EventBus } from "./event-bus.js";
import { createEventInterface } from "./event-interface.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-event-interface-"));
  roots.push(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const db = getDb(root);
  const events = createEventInterface({
    bus,
    db,
    acceptsAppInput: (appId, input) => appId === "sample" && input.kind === "message",
    hasApp: (appId) => appId === "sample",
    hasAgent: (agent) => agent === "may",
    hasSession: (sessionId) => sessionId === "s_known",
  });
  return { bus, db, events };
}

describe("simple event interface", () => {
  it("derives trusted envelope fields and exposes one bounded event view", () => {
    const { events } = fixture();
    const receipt = events.publish(
      {
        type: "project.owner.requested",
        target: { appId: "sample", taskId: "review/one" },
        data: { reason: "review" },
        idempotencyKey: "review-one",
      },
      { source: "control-socket" },
    );

    expect(receipt).toMatchObject({
      eventType: "project.owner.requested",
      delivery: "recorded",
    });
    expect(receipt.links).toBeUndefined();
    expect(events.get(receipt.eventId)).toMatchObject({
      event: {
        id: receipt.eventId,
        type: "project.owner.requested",
        source: "control-socket",
        owner: "app:sample",
        target: { appId: "sample", taskId: "review/one" },
        data: { appId: "sample", taskId: "review/one", reason: "review", idempotencyKey: "review-one" },
      },
      delivery: { state: "recorded" },
    });
  });

  it("accepts App input only after its durable request exists and returns the link", () => {
    const { bus, db, events } = fixture();
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "app.input.requested") return;
      const data = eventData(event);
      const created = createAppInboxItem(db, {
        appId: String(data.appId),
        source: data.source as { kind: "human"; id: string },
        input: data.input as { kind: string; data: unknown },
        originEventId: Number(event[EVENT_ROW_ID]),
        idempotencyKey: String(data.idempotencyKey),
      });
      return { accepted: true, by: `app-inbox:${created.item.id}`, route: "direct" };
    });

    const input = {
      type: "app.input.requested",
      target: { appId: "sample" },
      data: { input: { kind: "message", data: { message: "hello" } } },
      idempotencyKey: "human-turn-1",
    } as const;
    const first = events.publish(input, {
      source: "control-socket",
      inputSource: { kind: "human", id: "browser" },
    });
    const retry = events.publish(input, {
      source: "control-socket",
      inputSource: { kind: "human", id: "browser" },
    });

    expect(first).toMatchObject({
      eventType: "app.input.requested",
      delivery: "accepted",
      links: [{ kind: "request", state: "pending" }],
    });
    expect(retry).toEqual(first);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
  });

  it("keeps an unaccepted required event recoverable instead of claiming acceptance", () => {
    const { bus, events } = fixture();
    const input = {
      type: "runtime.reload.requested",
      data: { reason: "test" },
      idempotencyKey: "reload-one",
    } as const;
    const receipt = events.publish(input, { source: "control-socket" });
    expect(receipt.delivery).toBe("recorded");
    expect(events.get(receipt.eventId)?.delivery.state).toBe("recorded");

    bus.subscribeDurableRoute((event) =>
      event.type === "runtime.reload.requested"
        ? { accepted: true, by: "command-router:runtime-reload", route: "direct" }
        : undefined,
    );
    const recovered = events.publish(input, { source: "control-socket" });
    expect(recovered).toMatchObject({ eventId: receipt.eventId, delivery: "accepted" });
    expect(events.get(receipt.eventId)?.delivery).toMatchObject({
      state: "accepted",
      acceptedBy: "command-router:runtime-reload",
    });
  });

  it("keeps record-only delivery recorded even when a declared route reacts", () => {
    const { bus, events } = fixture();
    bus.subscribeDurableRoute((event) =>
      event.type === "project.owner.requested"
        ? { accepted: true, by: "app-runtime:events:sample", route: "direct" }
        : undefined,
    );
    const receipt = events.publish(
      {
        type: "project.owner.requested",
        target: { appId: "sample" },
        data: { reason: "observe" },
      },
      { source: "control-socket" },
    );
    expect(receipt.delivery).toBe("recorded");
    expect(events.get(receipt.eventId)?.delivery.state).toBe("recorded");
    expect(events.get(receipt.eventId)?.delivery.acceptedBy).toBeUndefined();
  });

  it("deduplicates one semantic input across trusted adapters", () => {
    const { db, events } = fixture();
    const input = {
      type: "project.owner.requested",
      target: { appId: "sample" },
      data: { reason: "review" },
      idempotencyKey: "cross-adapter-review",
    } as const;
    const http = events.publish(input, { source: "http" });
    const socket = events.publish(input, { source: "control-socket" });

    expect(socket.eventId).toBe(http.eventId);
    expect(events.get(http.eventId)?.event.source).toBe("http");
    expect(db.prepare("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 1 });
  });

  it("projects copied public events instead of exposing the live bus envelope", () => {
    const { events } = fixture();
    const observed: Array<Record<string, unknown>> = [];
    const unsubscribe = events.subscribe({ types: ["project.owner.requested"] }, (event) => {
      observed.push(event);
      event.data.reason = "mutated by listener";
      (event.data.nested as Record<string, unknown>).value = "mutated by listener";
    });
    const receipt = events.publish(
      {
        type: "project.owner.requested",
        target: { appId: "sample" },
        data: { reason: "original", nested: { value: "original" } },
      },
      { source: "control-socket" },
    );
    unsubscribe();

    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      id: receipt.eventId,
      type: "project.owner.requested",
      source: "control-socket",
      target: { appId: "sample" },
      data: { reason: "mutated by listener", nested: { value: "mutated by listener" } },
    });
    expect(Object.keys(observed[0]!).sort()).toEqual(["data", "id", "owner", "source", "target", "type"]);
    expect(events.get(receipt.eventId)?.event.data.reason).toBe("original");
    expect(events.get(receipt.eventId)?.event.data.nested).toEqual({ value: "original" });
  });

  it("rejects invalid targets and unregistered public types before persistence", () => {
    const { db, events } = fixture();
    expect(() =>
      events.publish(
        { type: "session.cancel.requested", target: { sessionId: "s_missing" }, data: {} },
        { source: "control-socket" },
      ),
    ).toThrow("Session s_missing does not exist");
    expect(() => events.publish({ type: "custom.unknown", data: {} }, { source: "control-socket" })).toThrow(
      "not admitted",
    );
    expect(() =>
      events.publish({ type: "project.approval.submitted", data: {} }, { source: "control-socket" }),
    ).toThrow("data.decision");
    expect(() =>
      events.publish(
        {
          type: "project.owner.requested",
          target: { appId: "sample", owner: "agent:forged" } as never,
          data: { reason: "test" },
        },
        { source: "control-socket" },
      ),
    ).toThrow("unsupported field 'owner'");
    expect(() =>
      events.publish(
        {
          type: "project.owner.requested",
          target: { appId: "sample" },
          data: { reason: "test" },
          source: "caller-forged",
        } as never,
        { source: "control-socket" },
      ),
    ).toThrow("Host-owned or unsupported field 'source'");
    expect(db.prepare("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 });
  });
});

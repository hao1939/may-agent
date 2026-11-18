import { afterEach, describe, expect, test } from "bun:test";
import type { EventInput, EventReceipt, PublicEvent } from "@may-agent/control/events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { EventBus } from "../core/events/bus.js";
import { createEventInterface, type EventInterface, type EventPublisherContext } from "../core/events/interface.js";
import { startWebUI, type DaemonHttpServices } from "./server.js";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function eventFixture() {
  const published: Array<{ event: EventInput; context: EventPublisherContext }> = [];
  const listeners = new Set<(event: PublicEvent) => void | Promise<void>>();
  const events: EventInterface = {
    publish(event, context) {
      published.push({ event, context });
      return {
        eventId: published.length,
        eventType: event.type,
        delivery: "accepted",
        links: [],
      } as EventReceipt;
    },
    get() {
      return undefined;
    },
    subscribe(_filter, listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { events, published, listeners };
}

function servicesFixture(events: EventInterface): DaemonHttpServices {
  return {
    events,
    getStatus: () => ({ status: "running" }),
    getAppConversation: (appId, conversationId, options) =>
      ({ id: conversationId, owner: appId, version: 4, messages: [], limit: options?.limit } as never),
    listApps: (appId) => [{ appId: appId ?? "sample", running: 1 }],
    listTasks: (options) =>
      ({ items: [{ appId: options?.appId ?? "sample", taskId: "work/1", generation: 2 }], nextCursor: null } as never),
    getTask: (input) =>
      ({ appId: input.appId ?? "sample", taskId: input.taskId ?? "work/1", generation: 2, resourceVersion: 7, status: "running", terminal: false } as never),
  };
}

function startFixture() {
  const root = mkdtempSync(join(tmpdir(), "may-http-direct-"));
  const eventState = eventFixture();
  const server = startWebUI({
    stateDir: root,
    hostname: "127.0.0.1",
    port: 0,
    services: servicesFixture(eventState.events),
  });
  cleanups.push(() => server.stop(true), () => rmSync(root, { recursive: true, force: true }));
  return { ...eventState, endpoint: `http://127.0.0.1:${server.port}` };
}

function startRealOwnerFixture() {
  const root = mkdtempSync(join(tmpdir(), "may-http-owner-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const task = {
    appId: "sample",
    taskId: "work/1",
    generation: 2,
    resourceVersion: 7,
    status: "running",
    terminal: false,
  };
  let admissions = 0;
  const unsubscribe = bus.subscribeDurableRoute((event) => {
    if (event.type === "app.input.requested") admissions++;
    return { accepted: true, by: "fixture-owner", route: "direct" };
  });
  const events = createEventInterface({
    bus,
    db: getDb(root),
    validateAppInput: (appId, input) => {
      if (appId !== "sample" || input.kind !== "message") throw new Error("invalid App input");
    },
    hasApp: (appId) => appId === "sample",
    hasAgent: () => false,
    hasSession: () => false,
  });
  const services = servicesFixture(events);
  services.getTask = () => ({ ...task } as never);
  services.getAppConversation = (appId, conversationId, options) =>
    ({
      id: conversationId,
      owner: appId,
      version: 1,
      messages: Array.from({ length: 2_000 }, (_, index) => ({ id: `history-${index}`, text: "x".repeat(1_024) })),
      limit: options?.limit,
    }) as never;
  const server = startWebUI({ stateDir: root, hostname: "127.0.0.1", port: 0, services });
  cleanups.push(
    () => server.stop(true),
    unsubscribe,
    () => closeDb(root),
    () => rmSync(root, { recursive: true, force: true }),
  );
  return {
    endpoint: `http://127.0.0.1:${server.port}`,
    task,
    admissions: () => admissions,
  };
}

function taskInput(endpoint: string, input: { message: string; key: string; generation?: number }) {
  return fetch(`${endpoint}/api/task/input`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      appId: "sample",
      taskId: "work/1",
      expectedGeneration: input.generation ?? 2,
      message: input.message,
      idempotencyKey: input.key,
    }),
  });
}

describe("daemon-owned HTTP services", () => {
  test("serve bounded reads and readiness without a compatibility socket or dashboard process", async () => {
    const fixture = startFixture();
    const [readiness, conversation, apps, tasks, task] = await Promise.all([
      fetch(`${fixture.endpoint}/api/readiness`).then((response) => response.json()),
      fetch(`${fixture.endpoint}/api/conversation?appId=may&conversationId=may%3Aprimary&limit=999`).then((response) => response.json()),
      fetch(`${fixture.endpoint}/api/apps?appId=sample`).then((response) => response.json()),
      fetch(`${fixture.endpoint}/api/tasks?appId=sample&limit=5`).then((response) => response.json()),
      fetch(`${fixture.endpoint}/api/task?appId=sample&taskId=work%2F1`).then((response) => response.json()),
    ]);

    expect(readiness).toMatchObject({ ready: true, transport: "in-process" });
    expect(conversation).toMatchObject({ id: "may:primary", owner: "may", limit: 30 });
    expect(apps).toEqual([{ appId: "sample", running: 1 }]);
    expect(tasks.items[0]).toMatchObject({ appId: "sample", taskId: "work/1" });
    expect(task).toMatchObject({ appId: "sample", taskId: "work/1", generation: 2 });
  });

  test("preserves real owner admission replay and rejects conflicts, stale generations, and closed Tasks", async () => {
    const fixture = startRealOwnerFixture();

    const accepted = await taskInput(fixture.endpoint, { message: "Review this", key: "feedback-1" });
    expect(accepted.status).toBe(202);
    const receipt = await accepted.json();
    expect(receipt).toMatchObject({ accepted: true, generation: 2 });
    expect(receipt.replayed).toBeUndefined();
    expect(fixture.admissions()).toBe(1);

    const conflict = await taskInput(fixture.endpoint, { message: "Different work", key: "feedback-1" });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ delivery: "rejected" });
    expect(fixture.admissions()).toBe(1);

    const stale = await taskInput(fixture.endpoint, { message: "Stale", key: "feedback-stale", generation: 1 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ generation: 2 });

    fixture.task.generation = 3;
    fixture.task.resourceVersion = 8;
    fixture.task.status = "closed";
    fixture.task.terminal = true;
    const replay = await taskInput(fixture.endpoint, { message: "Review this", key: "feedback-1" });
    expect(replay.status).toBe(202);
    expect(await replay.json()).toEqual({
      accepted: true,
      appId: "sample",
      taskId: "work/1",
      generation: 2,
      eventId: receipt.eventId,
      replayed: true,
    });
    expect(fixture.admissions()).toBe(1);

    const closed = await taskInput(fixture.endpoint, { message: "New work", key: "feedback-closed", generation: 3 });
    expect(closed.status).toBe(409);
    expect(await closed.json()).toMatchObject({ error: "Task is closed; input cannot reopen it" });
  });

  test("a slow history client does not serialize Stop or unrelated durable admission", async () => {
    const fixture = startRealOwnerFixture();
    const history = await fetch(`${fixture.endpoint}/api/conversation?appId=may&conversationId=may%3Aprimary&limit=30`);
    expect(history.status).toBe(200);
    // Deliberately leave the multi-megabyte response body unread while controls
    // and unrelated inputs use the same daemon listener.
    const [stop, input] = await Promise.all([
      fetch(`${fixture.endpoint}/api/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "conversation.turn.stop.requested",
          target: { appId: "sample" },
          idempotencyKey: "stop-while-history-is-slow",
          data: { conversationId: "may:primary", turnId: "turn-1", expectedRevision: 1 },
        }),
      }),
      taskInput(fixture.endpoint, { message: "Independent input", key: "feedback-independent" }),
    ]);
    expect(stop.status).toBe(201);
    expect(await stop.json()).toMatchObject({ ok: true, delivery: "accepted" });
    expect(input.status).toBe(202);
    expect(await input.json()).toMatchObject({ accepted: true });
    expect(fixture.admissions()).toBe(1);
    await history.body?.cancel();
  });

  test("admits ordinary HTTP events through EventInterface with trusted adapter provenance", async () => {
    const fixture = startFixture();
    const response = await fetch(`${fixture.endpoint}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "conversation.message.created",
        target: { appId: "may" },
        idempotencyKey: "console-message-1",
        operatorId: "operator",
        authorizationReference: "proposal-1",
        authorizationEvidence: { channel: "may-console", decisionText: "approve" },
        data: {
          conversationId: "may:primary",
          author: { kind: "human", id: "message-1" },
          text: "approve",
          metadata: { channel: "may-console" },
          approvalReply: { target: { appId: "sample", taskId: "release" }, proposal: { revision: 3 } },
        },
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, eventId: 1, delivery: "accepted" });
    expect(fixture.published).toHaveLength(1);
    expect(fixture.published[0].context).toEqual({
      source: "web-ui",
      inputSource: { kind: "human", id: "web-ui" },
      approvalAuthorization: {
        actor: { kind: "operator", id: "operator" },
        reference: "proposal-1",
        evidence: { channel: "may-console", decisionText: "approve" },
      },
    });
    expect(fixture.published[0].event).toMatchObject({
      type: "conversation.message.created",
      target: { appId: "may" },
      idempotencyKey: "console-message-1",
      data: {
        conversationId: "may:primary",
        approvalReply: { target: { appId: "sample", taskId: "release" }, proposal: { revision: 3 } },
      },
    });
  });
});

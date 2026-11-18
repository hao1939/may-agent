import { afterEach, describe, expect, test } from "bun:test";
import type { EventInput, EventReceipt, PublicEvent } from "@may-agent/control/events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EventInterface } from "../core/events/interface.js";
import { startWebUI, type DaemonHttpServices } from "../http/server.js";
import { createDaemonWebSocketTransport, type DaemonWebSocketPeer } from "./websocket.js";
import { closeDb } from "../../lib/db/connection.js";
import { upsertSession } from "../../lib/db/sessions.js";
import { markSessionActive, markSessionInactive } from "../../lib/persistence.js";
import { readExecutionStatus } from "../core/reads/execution-status.js";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function eventFixture() {
  const listeners = new Set<(event: PublicEvent) => void | Promise<void>>();
  const events: EventInterface = {
    publish(event: EventInput) {
      return { eventId: 1, eventType: event.type, delivery: "accepted", links: [] } as EventReceipt;
    },
    get() {
      return undefined;
    },
    subscribe(_filter, listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const emit = async (event: PublicEvent) => {
    for (const listener of [...listeners]) await listener(event);
  };
  return { events, listeners, emit };
}

function publicEvent(type: string, input: { appId?: string; taskId?: string; conversationId?: string }): PublicEvent {
  return {
    id: 1,
    type,
    target: input.appId ? { appId: input.appId, ...(input.taskId ? { taskId: input.taskId } : {}) } : undefined,
    data: input.conversationId ? { conversationId: input.conversationId } : {},
    timestamp: Date.now(),
  } as PublicEvent;
}

function servicesFixture(events: EventInterface): DaemonHttpServices {
  return {
    events,
    getStatus: () => ({ sessions: [], activeWork: false }),
    getAppConversation: () => ({ messages: [] } as never),
    listApps: () => [],
    listTasks: () => ({ items: [] } as never),
    getTask: () => null,
  };
}

async function waitForMessage(messages: Record<string, unknown>[], type: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const found = messages.find((message) => message.type === type);
    if (found) return found;
    await Bun.sleep(10);
  }
  throw new Error(`Timed out waiting for WebSocket message ${type}: ${JSON.stringify(messages)}`);
}

describe("daemon WebSocket wakes", () => {
  test("discovers current sessions on connect and status through the direct runtime owner", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-ws-status-"));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }), () => closeDb(root));
    upsertSession(root, { sessionId: "s_chat", agent: "helper", status: "idle", kind: "chat", task: "Current chat", startedAt: 1 });
    markSessionActive(root, "s_chat");
    upsertSession(root, { sessionId: "s_stale", agent: "helper", status: "running", task: "Stale session", startedAt: 2 });
    const services = servicesFixture(eventFixture().events);
    services.getStatus = () => readExecutionStatus(root);
    const server = startWebUI({ stateDir: root, hostname: "127.0.0.1", port: 0, services });
    cleanups.push(() => server.stop(true));
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
    cleanups.push(() => socket.close());
    const messages: Record<string, unknown>[] = [];
    socket.addEventListener("message", (event) => messages.push(JSON.parse(String(event.data))));
    expect(await waitForMessage(messages, "connected")).toMatchObject({
      activeAgents: [{ sessionId: "s_chat", agent: "helper", status: "idle", kind: "chat", task: "Current chat" }],
      activeWork: false,
    });
    markSessionInactive(root, "s_chat");
    socket.send(JSON.stringify({ type: "status" }));
    expect(await waitForMessage(messages, "status")).toMatchObject({ activeAgents: [], activeWork: false });
    socket.send(JSON.stringify({ type: "publish", event: { type: "runtime.reload.requested" } }));
    expect(await waitForMessage(messages, "error")).toMatchObject({ message: "Only subscribe and status frames are accepted on /ws" });
  });

  test("bounds session discovery and keeps subscriptions usable when status is unavailable", async () => {
    const fixture = eventFixture();
    const sent: Record<string, any>[] = [];
    const peer = { send: (data: string) => sent.push(JSON.parse(data)) };
    let unavailable = false;
    const transport = createDaemonWebSocketTransport({
      events: fixture.events, agent: "host", instance: "fixture",
      getStatus: () => {
        if (unavailable) throw new Error("storage unavailable");
        return { sessions: Array.from({ length: 150 }, (_, i) => ({
          sessionId: `s_${i}`, agent: "helper", status: "running", kind: "job", task: "x".repeat(200),
        })), activeWork: true };
      },
    });
    transport.open(peer);
    expect(sent[0].activeAgents).toHaveLength(100);
    expect(sent[0].activeAgents[0].task).toHaveLength(100);
    unavailable = true;
    transport.message(peer, '{"type":"status"}');
    expect(sent.at(-1)).toMatchObject({ type: "error", command: "status" });
    transport.message(peer, "null");
    expect(sent.at(-1)).toMatchObject({ type: "error" });
    transport.message(peer, '{"type":"subscribe","conversations":["chat"]}');
    await fixture.emit(publicEvent("conversation.updated", { conversationId: "chat" }));
    expect(sent.at(-1)).toMatchObject({ type: "conversation.updated" });
    transport.close(peer);
    expect(fixture.listeners.size).toBe(0);
  });

  test("bind /ws directly to EventInterface, acknowledge filters before wakes, and unsubscribe on disconnect", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-ws-direct-"));
    const fixture = eventFixture();
    const server = startWebUI({
      stateDir: root,
      hostname: "127.0.0.1",
      port: 0,
      services: servicesFixture(fixture.events),
    });
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
    const messages: Record<string, unknown>[] = [];
    socket.addEventListener("message", (event) => messages.push(JSON.parse(String(event.data))));
    cleanups.push(
      () => socket.close(),
      () => server.stop(true),
      () => rmSync(root, { recursive: true, force: true }),
    );

    await waitForMessage(messages, "connected");
    socket.send(
      JSON.stringify({
        type: "subscribe",
        conversations: ["may:primary"],
        taskApps: ["alex.app"],
        task: { appId: "gym", taskId: "run/1" },
      }),
    );
    await waitForMessage(messages, "subscribed");

    await fixture.emit(publicEvent("conversation.updated", { conversationId: "other" }));
    await fixture.emit(publicEvent("conversation.updated", { conversationId: "may:primary" }));
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/1" }));
    await fixture.emit(publicEvent("app.task.updated", { appId: "gym", taskId: "run/1" }));
    const wakeDeadline = Date.now() + 2_000;
    while (
      messages.filter((message) => message.type === "conversation.updated" || message.type === "app.task.updated").length < 3 &&
      Date.now() < wakeDeadline
    ) {
      await Bun.sleep(10);
    }
    const wakes = messages.filter((message) => message.type === "conversation.updated" || message.type === "app.task.updated");
    expect(wakes).toHaveLength(3);

    socket.close();
    const deadline = Date.now() + 2_000;
    while (fixture.listeners.size && Date.now() < deadline) await Bun.sleep(10);
    expect(fixture.listeners.size).toBe(0);
  });

  test("forwards correlated reload results and derives Task wakes for ordinary Console filters", async () => {
    const fixture = eventFixture();
    const sent: Record<string, unknown>[] = [];
    const peer: DaemonWebSocketPeer = {
      getBufferedAmount: () => 0,
      send(data) {
        sent.push(JSON.parse(data));
      },
    };
    const transport = createDaemonWebSocketTransport({ events: fixture.events, getStatus: () => ({ sessions: [], activeWork: false }), agent: "may", instance: "fixture" });
    transport.open(peer);
    transport.message(peer, JSON.stringify({
      type: "subscribe",
      sessions: [],
      conversations: ["may:primary"],
      taskApps: ["alex"],
      task: { appId: "gym", taskId: "run/1" },
    }));

    await fixture.emit({
      id: 2,
      type: "runtime.reload.finished",
      data: { requestId: "reload-1", summary: "Reloaded" },
      timestamp: Date.now(),
    } as PublicEvent);
    await fixture.emit({
      id: 3,
      type: "project.task.executor.progress",
      target: { appId: "gym", taskId: "run/1" },
      data: { message: "Working" },
      timestamp: Date.now(),
    } as PublicEvent);
    await fixture.emit({
      id: 4,
      type: "project.task.reconciled",
      target: { appId: "alex", taskId: "work/1" },
      data: {},
      timestamp: Date.now(),
    } as PublicEvent);

    expect(sent.filter((message) => message.type === "runtime.reload.finished")).toHaveLength(1);
    expect(sent.filter((message) => message.type === "project.task.executor.progress")).toHaveLength(0);
    expect(sent.filter((message) => message.type === "project.task.reconciled")).toHaveLength(0);
    expect(sent.filter((message) => message.type === "app.task.updated")).toEqual([
      { type: "app.task.updated", data: { appId: "gym", taskId: "run/1" } },
      { type: "app.task.updated", data: { appId: "alex", taskId: "work/1" } },
    ]);

    transport.close(peer);
    expect(fixture.listeners.size).toBe(0);
  });

  test("retains raw owner events for diagnostic wildcard subscriptions", async () => {
    const fixture = eventFixture();
    const sent: Record<string, unknown>[] = [];
    const peer: DaemonWebSocketPeer = {
      getBufferedAmount: () => 0,
      send(data) {
        sent.push(JSON.parse(data));
      },
    };
    const transport = createDaemonWebSocketTransport({ events: fixture.events, getStatus: () => ({ sessions: [], activeWork: false }), agent: "may", instance: "fixture" });
    transport.open(peer);
    transport.message(peer, JSON.stringify({ type: "subscribe", sessions: ["*"] }));
    await fixture.emit({
      id: 5,
      type: "project.task.reconciled",
      target: { appId: "alex", taskId: "work/1" },
      data: {},
      timestamp: Date.now(),
    } as PublicEvent);

    expect(sent.filter((message) => message.type === "project.task.reconciled")).toHaveLength(1);
    transport.close(peer);
  });

  test("reports one overflow hint per congestion interval and resumes filtered wakes after reread", async () => {
    const fixture = eventFixture();
    const sent: Record<string, unknown>[] = [];
    let bufferedAmount = 0;
    const peer: DaemonWebSocketPeer = {
      getBufferedAmount: () => bufferedAmount,
      send(data) {
        sent.push(JSON.parse(data));
      },
    };
    const transport = createDaemonWebSocketTransport({
      events: fixture.events,
      getStatus: () => ({ sessions: [], activeWork: false }),
      agent: "may",
      instance: "fixture",
      maxBufferedBytes: 10,
    });
    transport.open(peer);
    transport.message(peer, JSON.stringify({ type: "subscribe", taskApps: ["alex"] }));

    bufferedAmount = 11;
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/1" }));
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/2" }));
    expect(sent.filter((message) => message.type === "overflow")).toEqual([{ type: "overflow", action: "reread" }]);

    bufferedAmount = 0;
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/3" }));
    bufferedAmount = 11;
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/4" }));
    expect(sent.filter((message) => message.type === "overflow")).toHaveLength(2);
    expect(sent.some((message) => message.type === "app.task.updated")).toBe(true);

    transport.close(peer);
    expect(fixture.listeners.size).toBe(0);
  });
});

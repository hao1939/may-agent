import { afterEach, describe, expect, test } from "bun:test";
import type { EventInput, EventReceipt, PublicEvent } from "@may-agent/control/events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EventInterface } from "../core/events/interface.js";
import { startWebUI, type DaemonHttpServices } from "../http/server.js";
import { createDaemonWebSocketTransport, type DaemonWebSocketPeer } from "./websocket.js";

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
    getStatus: () => ({ status: "running" }),
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

  test("reports one overflow hint per congestion interval and resumes filtered wakes after reread", async () => {
    const fixture = eventFixture();
    const sent: Record<string, unknown>[] = [];
    const peer: DaemonWebSocketPeer = {
      bufferedAmount: 0,
      send(data) {
        sent.push(JSON.parse(data));
      },
    };
    const transport = createDaemonWebSocketTransport({
      events: fixture.events,
      agent: "may",
      instance: "fixture",
      maxBufferedBytes: 10,
    });
    transport.open(peer);
    transport.message(peer, JSON.stringify({ type: "subscribe", taskApps: ["alex"] }));

    peer.bufferedAmount = 11;
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/1" }));
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/2" }));
    expect(sent.filter((message) => message.type === "overflow")).toEqual([{ type: "overflow", action: "reread" }]);

    peer.bufferedAmount = 0;
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/3" }));
    peer.bufferedAmount = 11;
    await fixture.emit(publicEvent("app.task.updated", { appId: "alex", taskId: "work/4" }));
    expect(sent.filter((message) => message.type === "overflow")).toHaveLength(2);
    expect(sent.some((message) => message.type === "app.task.updated")).toBe(true);

    transport.close(peer);
    expect(fixture.listeners.size).toBe(0);
  });
});

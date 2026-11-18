import { afterEach, describe, expect, test } from "bun:test";
import type { EventInput, EventReceipt, PublicEvent } from "@may-agent/control/events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EventInterface, EventPublisherContext } from "../core/events/interface.js";
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

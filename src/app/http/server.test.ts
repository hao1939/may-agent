import { afterEach, describe, expect, test } from "bun:test";
import type { EventInput, EventReceipt, PublicEvent } from "@may-agent/control/events";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnFixtureProcess } from "../../../test/fixtures/owned-process.js";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { EventBus } from "../core/events/bus.js";
import { createEventInterface, deliverConversationApproval, type EventInterface, type EventPublisherContext } from "../core/events/interface.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
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
    getStatus: () => ({ sessions: [], activeWork: false }),
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
  const stateDir = join(root, ".state");
  const projectDir = join(root, "projects", "sample.app");
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, "project.md"), "---\nproject: sample\n---\n# Sample\n");
  const eventState = eventFixture();
  const previousProjectRoot = process.env.PROJECT_ROOT;
  const previousProjectsRoot = process.env.PROJECTS_ROOT;
  process.env.PROJECT_ROOT = root;
  process.env.PROJECTS_ROOT = join(root, "projects");
  const server = startWebUI({
    stateDir,
    hostname: "127.0.0.1",
    port: 0,
    services: servicesFixture(eventState.events),
  });
  if (previousProjectRoot === undefined) delete process.env.PROJECT_ROOT;
  else process.env.PROJECT_ROOT = previousProjectRoot;
  if (previousProjectsRoot === undefined) delete process.env.PROJECTS_ROOT;
  else process.env.PROJECTS_ROOT = previousProjectsRoot;
  cleanups.push(() => rmSync(root, { recursive: true, force: true }), () => server.stop(true));
  return { ...eventState, endpoint: `http://127.0.0.1:${server.port}` };
}

function startRealOwnerFixture() {
  const root = mkdtempSync(join(tmpdir(), "may-http-owner-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const db = getDb(root);
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
    if (event.type === "conversation.message.created") deliverConversationApproval(event, db, bus);
    return { accepted: true, by: "fixture-owner", route: "direct" };
  });
  const events = createEventInterface({
    bus,
    db,
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
  let server = startWebUI({ stateDir: root, hostname: "127.0.0.1", port: 0, services });
  cleanups.push(
    () => rmSync(root, { recursive: true, force: true }),
    () => closeDb(root),
    unsubscribe,
    () => server.stop(true),
  );
  return {
    get endpoint() {
      return `http://127.0.0.1:${server.port}`;
    },
    restart() {
      server.stop(true);
      server = startWebUI({ stateDir: root, hostname: "127.0.0.1", port: 0, services });
    },
    task,
    db,
    events,
    admissions: () => admissions,
  };
}

function approvalFixture() {
  const fixture = startRealOwnerFixture();
  const proposal = {
    taskGeneration: 1, conditionId: "review", conditionGeneration: 1,
    subject: "candidate:release", requestedAction: "Apply reviewed candidate",
    expected: { allowedDecisions: ["approve", "reject", "defer"] },
  };
  AppTaskResourceStore.fromDb(fixture.db, "sample").bootstrapSnapshot({
    project: "sample", project_lifecycle: "active", version: 1, root_task_id: "root",
    groups: { root: { id: "root", parent_id: null } },
    resources: {
      release: {
        metadata: { id: "release", generation: 1, resourceVersion: 1 },
        spec: { outcome: "Deliver candidate", acceptance: ["Reviewed"], parentId: "root" },
        status: { phase: "waiting", observedGeneration: 0, conditionIds: ["review"], updatedAt: new Date().toISOString() },
      },
    },
    conditions: {
      review: {
        metadata: { id: "review", generation: 1, resourceVersion: 1 },
        spec: { type: "project.approval.submitted", owner: "human", subject: proposal.subject,
          requestedAction: proposal.requestedAction, expected: proposal.expected },
        status: { state: "unknown", observedGeneration: 0 },
      },
    },
  } as never, "fixture");
  return { ...fixture, proposal };
}

function postEvent(endpoint: string, body: Record<string, unknown>) {
  return fetch(`${endpoint}/api/events`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
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
  test("rejects cross-origin and non-JSON event ingress before trusted approval publication", async () => {
    const fixture = startFixture();
    const body = JSON.stringify({
      type: "project.approval.submitted",
      target: { appId: "sample", taskId: "release" },
      idempotencyKey: "forged-browser-approval",
      operatorId: "forged-operator",
      data: { decision: "approve" },
    });
    const crossOrigin = await fetch(`${fixture.endpoint}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body,
    });
    expect(crossOrigin.status).toBe(403);
    const simpleForm = await fetch(`${fixture.endpoint}/api/events`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body,
    });
    expect(simpleForm.status).toBe(415);
    expect(fixture.published).toHaveLength(0);

    const sameOrigin = await fetch(`${fixture.endpoint}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", origin: fixture.endpoint },
      body,
    });
    expect(sameOrigin.status).toBe(201);
    expect(fixture.published).toHaveLength(1);
  });

  test("requires a real operator identity before journaling a formal web-ui approval", async () => {
    const fixture = approvalFixture();
    const input = {
      type: "project.approval.submitted", target: { appId: "sample", taskId: "release" },
      idempotencyKey: "web-approval-1",
      authorizationReference: "displayed-proposal-1", authorizationEvidence: { decisionText: "approve" },
      data: { decision: "approve", proposal: fixture.proposal },
    };
    for (const operatorId of [undefined, null, "", "  ", 7, {}]) {
      const response = await postEvent(fixture.endpoint, { ...input, operatorId });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ ok: false, error: "operatorId must be a non-empty string" });
    }
    expect(fixture.db.prepare("SELECT count(*) AS n FROM events").get()).toEqual({ n: 0 });
    const accepted = await postEvent(fixture.endpoint, { ...input, operatorId: " operator " });
    expect(accepted.status).toBe(201);
    const receipt = await accepted.json();
    expect(receipt).toMatchObject({ ok: true, eventType: input.type });
    expect(fixture.events.get(receipt.eventId)?.event.data.hostApproval).toMatchObject({
      ingressSource: "web-ui", actor: { kind: "operator", id: "operator" },
      authorization: { reference: input.authorizationReference, evidence: input.authorizationEvidence },
    });
    const replay = await postEvent(fixture.endpoint, { ...input, operatorId: "operator" });
    expect(replay.status).toBe(201);
    expect((await replay.json()).eventId).toBe(receipt.eventId);
  });

  test("preserves successful and declined approval outcomes in HTTP Conversation receipts", async () => {
    const fixture = approvalFixture();
    const reply = {
      type: "conversation.message.created", target: { appId: "sample" }, idempotencyKey: "proposal-reply-1",
      operatorId: "operator", authorizationReference: "displayed-proposal-1",
      authorizationEvidence: { decisionText: "approve" },
      data: { conversationId: "sample:primary", author: { kind: "human", id: "message-1" },
        text: "approve", replyTo: "displayed-proposal-1",
        approvalReply: { target: { appId: "sample", taskId: "release" }, proposal: fixture.proposal } },
    };
    const response = await postEvent(fixture.endpoint, reply);
    expect(response.status).toBe(201);
    const receipt = await response.json();
    expect(receipt.delivery).toBe("accepted");
    expect(receipt.approval.decision).toBe("approve");
    expect(Number.isSafeInteger(receipt.approval.eventId)).toBe(true);
    expect(fixture.events.get(receipt.approval.eventId)?.event).toMatchObject({
      type: "project.approval.submitted", data: { decision: "approve", inputEventId: receipt.eventId },
    });
    const replay = await postEvent(fixture.endpoint, reply);
    expect(replay.status).toBe(201);
    expect((await replay.json()).approval).toEqual(receipt.approval);

    const unauthorized = await postEvent(fixture.endpoint, { ...reply, operatorId: undefined, idempotencyKey: "unattributed-reply" });
    expect(unauthorized.status).toBe(201);
    const ordinary = await unauthorized.json();
    expect(ordinary).toMatchObject({ delivery: "accepted", approval: { reason: expect.any(String) } });
    expect(ordinary.approval.decision).toBeUndefined();
    expect(fixture.db.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'project.approval.submitted'").get()).toEqual({ n: 1 });
  });

  test("starts a headless HTTP owner in a parent-owned process without a compatibility socket", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-http-headless-process-"));
    const script = join(root, "headless.mjs");
    writeFileSync(
      script,
      `import { startWebUI } from ${JSON.stringify(new URL("./server.ts", import.meta.url).href)};
const events = { publish(event) { return { eventId: 1, eventType: event.type, delivery: "accepted", links: [] }; }, get() {}, subscribe() { return () => {}; } };
const server = startWebUI({ stateDir: process.env.STATE_DIR, hostname: "127.0.0.1", port: 0, services: { events, getStatus: () => ({ sessions: [], activeWork: false }), getAppConversation: () => ({ messages: [] }), listApps: () => [], listTasks: () => ({ items: [] }), getTask: () => null } });
console.log(JSON.stringify({ port: server.port }));
process.stdin.resume();
process.stdin.on("end", () => { server.stop(true); process.exit(0); });
`,
    );
    const child = spawnFixtureProcess([script], { env: { ...process.env, STATE_DIR: join(root, ".state") } });
    cleanups.push(() => rmSync(root, { recursive: true, force: true }), () => child.kill("SIGKILL"));
    const startup = await new Promise<{ port: number }>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
        const line = stdout.split("\n")[0];
        if (line) resolve(JSON.parse(line));
      });
      child.once("exit", (code) => reject(new Error(`headless fixture exited ${code}: ${stderr}`)));
    });

    expect(await fetch(`http://127.0.0.1:${startup.port}/api/readiness`).then((response) => response.json())).toMatchObject({
      ready: true,
      transport: "in-process",
    });
    expect(existsSync(join(root, ".state", "instances"))).toBe(false);
    child.stdin.end();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  });

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

  test("replays a lost HTTP acknowledgement after the daemon listener restarts", async () => {
    const fixture = startRealOwnerFixture();
    const first = await taskInput(fixture.endpoint, { message: "Retain this", key: "feedback-lost-ack" });
    expect(first.status).toBe(202);
    // Treat the response body as lost, then restart the transport around the
    // same durable owner and retry the exact input identity.
    await first.body?.cancel();
    fixture.restart();

    const replay = await taskInput(fixture.endpoint, { message: "Retain this", key: "feedback-lost-ack" });
    expect(replay.status).toBe(202);
    expect(await replay.json()).toMatchObject({ accepted: true, generation: 2, replayed: true });
    expect(fixture.admissions()).toBe(1);
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

  test("binds project comments to the same in-process App admission owner", async () => {
    const fixture = startFixture();
    const response = await fetch(`${fixture.endpoint}/api/projects/comment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: "projects/sample.app",
        comment: "Review the direct binding.",
        idempotencyKey: "project-comment-direct-1",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true, eventType: "app.input.requested", projectId: "sample" });
    expect(fixture.published).toHaveLength(1);
    expect(fixture.published[0]).toMatchObject({
      context: { source: "web-ui", inputSource: { kind: "human", id: "web-ui:project-comment-direct-1" } },
      event: {
        type: "app.input.requested",
        target: { appId: "sample" },
        idempotencyKey: "project-comment-direct-1",
        data: { input: { kind: "message", data: { message: "Review the direct binding." } } },
      },
    });
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

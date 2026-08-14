import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { closeDb, getDb } from "../lib/requests.js";
import { DbWriter } from "../lib/db-writer.js";
import {
  associateAppInboxClaimSession,
  claimAppInboxItem,
  createAppInboxItem,
  waitAppInboxClaim,
} from "./app-inbox-store.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import {
  EVENT_DEDUPLICATED,
  EVENT_REDELIVERY_REQUIRED,
  EVENT_ROW_ID,
  EventBus,
  type AgentEvent,
} from "./event-bus.js";
import type { AppOwnerManager } from "./app-owner-manager-adapter.js";

describe("App inbox runtime", () => {
  let root: string;
  let db: SqliteDb;
  let runtime: AppInboxRuntime | null;

  beforeEach(() => {
    root = join(tmpdir(), `app-inbox-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const appDir = join(root, "evaluation.app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(appDir, "inbox.js"),
      `export default {
        id: "evaluation-canary",
        version: 1,
        owner: "evaluator",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "data"],
          properties: {
            kind: { const: "probe" },
            data: {
              type: "object",
              additionalProperties: false,
              required: ["value"],
              properties: { value: { type: "string" } }
            }
          }
        }
      };\n`,
    );
    db = openDatabase(":memory:");
    applyDbSchema(db);
    runtime = null;
  });

  afterEach(() => {
    runtime?.close();
    closeDb(join(root, "state"));
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  function manager(calls: string[]): AppOwnerManager {
    return {
      hasAgent: () => true,
      run(_agent, prompt) {
        calls.push(prompt);
        const requestId = JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "[]")[0].id;
        return `session:${requestId}`;
      },
      async waitFor(sessionId) {
        return {
          status: "done",
          structuredResult: {
            dispositions: [
              {
                requestId: sessionId.replace(/^session:/, ""),
                disposition: { type: "complete", summary: "canary passed" },
              },
            ],
          },
        };
      },
      cancel() {},
    };
  }

  async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await Bun.sleep(5);
    }
    throw new Error("Timed out waiting for App inbox runtime");
  }

  it("admits an explicit App input event exactly once and drives it to completion", async () => {
    const calls: string[] = [];
    const bus = new EventBus();
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
    });
    expect(runtime).not.toBeNull();

    const event = {
      type: "app.input.requested" as const,
      source: "test",
      owner: "agent:evaluator",
      data: {
        appId: "evaluation-canary",
        input: { kind: "probe", data: { value: "first" } },
        source: { kind: "system" as const, id: "canary" },
        idempotencyKey: "canary:1",
      },
    };
    bus.setPersistenceSubscriber((retried) => {
      Object.defineProperty(retried, EVENT_DEDUPLICATED, { value: true, configurable: true });
      Object.defineProperty(retried, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
    });
    bus.emit(event);
    await waitUntil(() => runtime?.host.get("missing") === null && calls.length === 1);
    const row = db.prepare("SELECT id FROM app_inbox_items WHERE app_id = ?").get("evaluation-canary") as {
      id: string;
    };
    await waitUntil(() => runtime?.host.get(row.id)?.status === "done");

    bus.emit(event);
    await Bun.sleep(20);
    expect(calls).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
    expect(runtime?.host.get(row.id)).toMatchObject({
      status: "done",
      result: { summary: "canary passed" },
      sessionId: `session:${row.id}`,
    });
  });

  it("admits one uniquely addressed agent message and durably returns its result", async () => {
    const mayDir = join(root, "may.app");
    mkdirSync(mayDir, { recursive: true });
    writeFileSync(
      join(mayDir, "inbox.js"),
      `export default {
        id: "may",
        version: 1,
        owner: "may",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "data"],
          properties: {
            kind: { const: "message" },
            data: {
              type: "object",
              additionalProperties: false,
              required: ["message"],
              properties: {
                message: { type: "string", minLength: 1 },
                context: { type: "object" }
              }
            }
          }
        }
      };\n`,
    );
    const persistDir = join(root, "state");
    const persistedDb = getDb(persistDir);
    const writer = new DbWriter(persistDir);
    const bus = new EventBus();
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const calls: string[] = [];
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db: persistedDb,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
    });
    runtime?.enableDelivery();

    const original = bus.emit({
      type: "message.created",
      source: "agent:evaluator",
      owner: "agent:may",
      data: {
        from: "evaluator",
        to: "agent:may",
        content: "Review the canary result.",
        intent: "review-request",
        artifact: "/tmp/canary.json",
        priority: "P1",
        sourceSessionId: "session:evaluator",
        idempotencyKey: "agent-message:canary",
      },
    });
    const sourceEventId = Number(original[EVENT_ROW_ID]);
    await waitUntil(() => calls.length === 1);
    const inboxRow = persistedDb.prepare("SELECT id, input_data FROM app_inbox_items WHERE app_id = 'may'").get() as {
      id: string;
      input_data: string;
    };
    await waitUntil(() => runtime?.host.get(inboxRow.id)?.status === "done");

    expect(JSON.parse(inboxRow.input_data)).toEqual({
      message: "Review the canary result.",
      context: {
        from: "evaluator",
        intent: "review-request",
        artifact: "/tmp/canary.json",
        priority: "P1",
        sourceSessionId: "session:evaluator",
        sourceEventId,
      },
    });
    expect(
      persistedDb
        .prepare("SELECT delivery_status, accepted_by, delivery_route FROM events WHERE id = ?")
        .get(sourceEventId),
    ).toEqual({
      delivery_status: "accepted",
      accepted_by: "app-inbox:may:message",
      delivery_route: "direct",
    });
    expect(
      persistedDb
        .prepare("SELECT COUNT(*) AS count FROM event_pair_runs WHERE pair_name = 'owner_inbox' AND open_event_id = ?")
        .get(sourceEventId),
    ).toEqual({ count: 0 });
    expect(
      persistedDb
        .prepare(
          `SELECT source, owner, data
           FROM events
           WHERE event_type = 'message.created'
             AND json_extract(data, '$.idempotencyKey') LIKE 'app-delivery:%'`,
        )
        .get(),
    ).toMatchObject({
      source: "app:may",
      owner: "agent:evaluator",
      data: expect.stringContaining('"content":"canary passed"'),
    });

    bus.emit({
      type: "message.created",
      source: "agent:evaluator",
      owner: "agent:may",
      data: {
        from: "evaluator",
        to: "agent:may",
        content: "Review the canary result.",
        intent: "review-request",
        artifact: "/tmp/canary.json",
        priority: "P1",
        sourceSessionId: "session:evaluator",
        idempotencyKey: "agent-message:canary",
      },
    });
    await Bun.sleep(20);
    expect(calls).toHaveLength(1);
    expect(persistedDb.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE app_id = 'may'").get()).toEqual({
      count: 1,
    });

    runtime?.close();
    runtime = null;
  });

  it("leaves incompatible and ambiguous agent messages on the legacy route", async () => {
    for (const id of ["may-one", "may-two"]) {
      const appDir = join(root, `${id}.app`);
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "inbox.js"),
        `export default {
          id: "${id}", version: 1, owner: "may",
          inputSchema: {
            type: "object", required: ["kind", "data"],
            properties: {
              kind: { const: "message" },
              data: { type: "object", required: ["message"], properties: { message: { type: "string", minLength: 1 } } }
            }
          }
        };\n`,
      );
    }
    const deliveries: Array<{ event: AgentEvent; result: unknown }> = [];
    const bus = new EventBus();
    let rowId = 100;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: rowId++, configurable: true });
    });
    bus.setDeliveryRecorder((event, result) => deliveries.push({ event, result }));
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
    });

    const ambiguous = bus.emit({
      type: "message.created",
      source: "agent:evaluator",
      owner: "agent:may",
      data: { from: "evaluator", to: "may", content: "ambiguous" },
    });
    const incompatible = bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "agent:evaluator",
      data: { from: "may", to: "evaluator", content: "not a probe" },
    });

    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
    expect(deliveries.map(({ result }) => result)).toEqual([
      expect.objectContaining({ by: "owner-inbox:agent:may", route: "owner_inbox" }),
      expect.objectContaining({ by: "owner-inbox:agent:evaluator", route: "owner_inbox" }),
    ]);
  });

  it("preserves human channel metadata through admission and owner dispatch", async () => {
    const calls: Array<Parameters<AppOwnerManager["run"]>[2]> = [];
    const managerWithMetadata: AppOwnerManager = {
      hasAgent: () => true,
      run(_agent, _prompt, options) {
        calls.push(options);
        return "session:human-metadata";
      },
      async waitFor() {
        const row = db.prepare("SELECT id FROM app_inbox_items WHERE app_id = ?").get("evaluation-canary") as {
          id: string;
        };
        return {
          status: "done",
          structuredResult: {
            dispositions: [
              {
                requestId: row.id,
                disposition: { type: "complete", summary: "human request handled" },
              },
            ],
          },
        };
      },
      cancel() {},
    };
    const bus = new EventBus();
    const deliveryRequests: Array<Extract<AgentEvent, { type: "app.response.delivery.requested" }>> = [];
    bus.subscribe((event) => {
      if (event.type === "app.response.delivery.requested") deliveryRequests.push(event);
    });
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: managerWithMetadata,
      bus,
      scanIntervalMs: 10_000,
    });
    runtime?.enableDelivery();

    bus.emit({
      type: "app.input.requested",
      source: "telegram",
      data: {
        appId: "evaluation-canary",
        input: { kind: "probe", data: { value: "human" } },
        source: { kind: "human", id: "event:42" },
        conversationId: "telegram:123",
        conversationSequence: 42,
        channel: "telegram",
        channelThreadId: "topic:7",
        channelMessageId: 99,
        idempotencyKey: "telegram-update:42",
      },
    });

    await waitUntil(() => calls.length === 1);
    const item = db.prepare("SELECT id FROM app_inbox_items WHERE app_id = ?").get("evaluation-canary") as {
      id: string;
    };
    await waitUntil(() => deliveryRequests.length === 1);
    expect(runtime?.host.get(item.id)).toMatchObject({
      status: "handling",
      source: { kind: "human", id: "event:42" },
      conversationId: "telegram:123",
      conversationSequence: 42,
      channel: "telegram",
      channelThreadId: "topic:7",
      channelMessageId: 99,
      result: { summary: "human request handled" },
      delivery: { status: "sending" },
    });
    expect(calls[0]).toMatchObject({
      source: "telegram",
      kind: "job",
      requestId: `app-inbox-human:${item.id}`,
      conversationId: "telegram:123",
      channelMessageId: 99,
      toolPolicy: "deputy",
    });
    const request = deliveryRequests[0].data;
    bus.emit({
      type: "channel.delivery.completed",
      source: "telegram",
      owner: "agent:may",
      target: { human: true },
      data: {
        channel: request.channel,
        sessionId: request.sessionId,
        operationId: request.operationId,
        appInboxItemId: request.appInboxItemId,
        appInboxRequestId: request.appInboxRequestId,
        externalMessageId: 700,
      },
    });
    await waitUntil(() => runtime?.host.get(item.id)?.status === "done");
  });

  it("dispatches a restart-pending delivery once and never blindly redispatches an attempted send", async () => {
    const calls: string[] = [];
    const firstBus = new EventBus();
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus: firstBus,
      scanIntervalMs: 10_000,
    });
    firstBus.emit({
      type: "app.input.requested",
      source: "telegram",
      owner: "app:evaluation-canary",
      data: {
        appId: "evaluation-canary",
        input: { kind: "probe", data: { value: "restart-delivery" } },
        source: { kind: "human", id: "event:restart-delivery" },
        channel: "telegram",
        idempotencyKey: "restart-delivery",
      },
    });
    await waitUntil(() => {
      const row = db.prepare("SELECT item_id FROM app_inbox_deliveries WHERE status = 'pending'").get() as
        { item_id?: string } | undefined;
      return Boolean(row);
    });
    runtime?.close();

    const secondBus = new EventBus();
    const requested: unknown[] = [];
    secondBus.subscribe((event) => {
      if (event.type === "app.response.delivery.requested") requested.push(event);
    });
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus: secondBus,
      scanIntervalMs: 10_000,
    });
    runtime?.enableDelivery();
    await waitUntil(() => requested.length === 1);
    expect(calls).toHaveLength(1);
    expect(db.prepare("SELECT status FROM app_inbox_deliveries").get()).toEqual({ status: "sending" });
    runtime?.close();

    const thirdBus = new EventBus();
    const repeated: unknown[] = [];
    thirdBus.subscribe((event) => {
      if (event.type === "app.response.delivery.requested") repeated.push(event);
    });
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus: thirdBus,
      scanIntervalMs: 10_000,
    });
    runtime?.enableDelivery();
    await Bun.sleep(20);

    expect(repeated).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(db.prepare("SELECT status FROM app_inbox_deliveries").get()).toMatchObject({ status: "uncertain" });
  });

  it("rescans durable unfinished items when the runtime starts", async () => {
    const calls: string[] = [];
    const oldNow = Date.now() - 100;
    createAppInboxItem(db, {
      id: "restart-probe",
      appId: "evaluation-canary",
      source: { kind: "system", id: "before-restart" },
      input: { kind: "probe", data: { value: "resume" } },
      now: oldNow,
    });
    const oldClaim = claimAppInboxItem(db, "restart-probe", "old-host", 1, oldNow)!;
    associateAppInboxClaimSession(db, oldClaim, "old-session");

    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus: new EventBus(),
      scanIntervalMs: 10_000,
    });

    await waitUntil(() => runtime?.host.get("restart-probe")?.status === "done");
    expect(calls).toHaveLength(1);
  });

  it("converts a previous owner claim to an exact session wait and wakes only on its terminal event", async () => {
    const calls: string[] = [];
    let sessionStatus: "running" | "done" = "running";
    createAppInboxItem(db, {
      id: "session-owned-probe",
      appId: "evaluation-canary",
      source: { kind: "system", id: "before-restart" },
      input: { kind: "probe", data: { value: "session-owned" } },
      now: 100,
    });
    const oldClaim = claimAppInboxItem(db, "session-owned-probe", "old-runtime", 60_000, 100)!;
    associateAppInboxClaimSession(db, oldClaim, "session-linked", 101);
    const bus = new EventBus();

    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: sessionStatus,
        summary: sessionStatus === "done" ? "Linked session completed" : "Linked session is running",
      }),
    });

    expect(runtime?.host.get("session-owned-probe")).toMatchObject({
      waitingOn: { kind: "session", id: "session-linked" },
      availableAt: undefined,
      lease: undefined,
    });
    expect(calls).toHaveLength(0);

    bus.emit({
      type: "session.end",
      source: "manager",
      owner: "agent:evaluator",
      data: {
        sessionId: "session-unrelated",
        agent: "evaluator",
        outcome: "done",
        summary: "Unrelated",
        durationMs: 1,
        status: "done",
      },
    });
    await Bun.sleep(20);
    expect(calls).toHaveLength(0);

    sessionStatus = "done";
    const terminal = {
      type: "session.end" as const,
      source: "manager",
      owner: "agent:evaluator",
      data: {
        sessionId: "session-linked",
        agent: "evaluator",
        outcome: "done",
        summary: "Linked session completed",
        durationMs: 1,
        status: "done",
      },
    };
    bus.emit(terminal);
    bus.emit(terminal);

    await waitUntil(() => runtime?.host.get("session-owned-probe")?.status === "done");
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0]!.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "[]")[0]).toMatchObject({
      id: "session-owned-probe",
      dependency: {
        kind: "session",
        id: "session-linked",
        status: "done",
        summary: "Linked session completed",
      },
    });
  });

  it("recovers a stored session wait completed while the runtime was offline", async () => {
    const calls: string[] = [];
    createAppInboxItem(db, {
      id: "offline-session-probe",
      appId: "evaluation-canary",
      source: { kind: "system", id: "before-restart" },
      input: { kind: "probe", data: { value: "offline-session" } },
      now: 100,
    });
    const oldClaim = claimAppInboxItem(db, "offline-session-probe", "old-runtime", 60_000, 100)!;
    expect(waitAppInboxClaim(db, oldClaim, { kind: "session", id: "session-offline" }, { now: 101 })).toBe(true);

    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus: new EventBus(),
      scanIntervalMs: 10_000,
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: "done",
        summary: "Completed while offline",
      }),
    });

    await waitUntil(() => runtime?.host.get("offline-session-probe")?.status === "done");
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0]!.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "[]")[0]).toMatchObject({
      dependency: {
        kind: "session",
        id: "session-offline",
        status: "done",
        summary: "Completed while offline",
      },
    });
  });

  it("waits for the shared owner capacity before dispatching", async () => {
    const calls: string[] = [];
    let releaseCapacity: (() => void) | undefined;
    const capacity = new Promise<void>((resolve) => {
      releaseCapacity = resolve;
    });
    const bus = new EventBus();
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
      runOwner: async (work) => {
        await capacity;
        return work();
      },
    });

    bus.emit({
      type: "app.input.requested",
      data: {
        appId: "evaluation-canary",
        input: { kind: "probe", data: { value: "capacity" } },
        source: { kind: "system", id: "test" },
      },
    });
    await Bun.sleep(20);
    expect(calls).toHaveLength(0);

    releaseCapacity!();
    await waitUntil(() => calls.length === 1);
  });

  it("round-robins Apps instead of draining one App before the next", async () => {
    const workerDir = join(root, "worker.app");
    mkdirSync(workerDir, { recursive: true });
    writeFileSync(
      join(workerDir, "inbox.js"),
      `export default {
        id: "worker-canary",
        version: 1,
        owner: "evaluator",
        inputSchema: {
          type: "object",
          required: ["kind", "data"],
          properties: { kind: { const: "probe" }, data: { type: "object" } }
        }
      };\n`,
    );
    const calls: string[] = [];
    const bus = new EventBus();
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
      maxConcurrentApps: 1,
    });
    await Bun.sleep(20);
    const emit = (appId: string, value: string) =>
      bus.emit({
        type: "app.input.requested",
        data: {
          appId,
          input: { kind: "probe", data: { value } },
          source: { kind: "system", id: "test" },
        },
      });

    emit("evaluation-canary", "first");
    emit("evaluation-canary", "second");
    emit("worker-canary", "worker");
    await waitUntil(() => calls.length === 3);

    const requestIds = calls.map((prompt) => JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "[]")[0].id);
    const rows = requestIds.map((id) => db.prepare("SELECT app_id FROM app_inbox_items WHERE id = ?").get(id));
    expect(rows).toEqual([
      { app_id: "evaluation-canary" },
      { app_id: "worker-canary" },
      { app_id: "evaluation-canary" },
    ]);
    await waitUntil(() => requestIds.every((id) => runtime?.host.get(id)?.status === "done"));
  });
});

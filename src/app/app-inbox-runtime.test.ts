import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { associateAppInboxClaimSession, claimAppInboxItem, createAppInboxItem } from "./app-inbox-store.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import { EVENT_DEDUPLICATED, EVENT_REDELIVERY_REQUIRED, EventBus, type AgentEvent } from "./event-bus.js";
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

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  readAppConversationResource,
  waitAppInboxClaim,
} from "./app-inbox-store.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import { EVENT_DEDUPLICATED, EVENT_REDELIVERY_REQUIRED, EVENT_ROW_ID, EventBus, type AgentEvent } from "./event-bus.js";
import type { AppOwnerManager } from "./app-owner-manager-adapter.js";
import { AppRegistry } from "./app-registry.js";
import { telegramMayInputEvent } from "./transport/telegram.js";

async function loadedRegistry(projectsRoot: string): Promise<AppRegistry> {
  const registry = new AppRegistry(projectsRoot);
  await registry.reload();
  return registry;
}

describe("App inbox runtime", () => {
  let root: string;
  let db: SqliteDb;
  let runtime: AppInboxRuntime | null;

  beforeEach(() => {
    root = join(tmpdir(), `app-inbox-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const appDir = join(root, "evaluation.app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(appDir, "app.js"),
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
        },
        subscriptions: [{
          id: "provider-change",
          event: { type: "provider.changed", project: "evaluation" },
          toInput(event) { return { kind: "probe", data: { value: event.data.value } }; }
        }],
        observations: ["project.task.reconciled"]
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
      registry: await loadedRegistry(root),
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

  it("creates work only for durable human conversation messages and deduplicates retries", async () => {
    const mayDir = join(root, "may.app");
    mkdirSync(mayDir, { recursive: true });
    writeFileSync(
      join(mayDir, "app.js"),
      `export default {
        id: "may", version: 1, owner: "may",
        inputSchema: {
          type: "object", required: ["kind", "data"],
          properties: {
            kind: { const: "message" },
            data: {
              type: "object", required: ["message"],
              properties: { message: { type: "string" } }
            }
          }
        },
        inbox: { batch: "single" }
      };\n`,
    );
    const calls: string[] = [];
    const bus = new EventBus();
    let nextEventId = 42;
    const persistedIds = new Map<string, number>();
    bus.setPersistenceSubscriber((event) => {
      const data = event.data as { idempotencyKey?: string; author?: { id?: string } };
      const identity = data.idempotencyKey ?? `${event.type}:${data.author?.id ?? nextEventId}`;
      const prior = persistedIds.get(identity);
      const eventId = prior ?? nextEventId++;
      persistedIds.set(identity, eventId);
      Object.defineProperty(event, EVENT_ROW_ID, { value: eventId, configurable: true });
      if (prior !== undefined) {
        Object.defineProperty(event, EVENT_DEDUPLICATED, { value: true, configurable: true });
        Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
      }
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
    });

    const humanMessage = () => ({
      type: "conversation.message.created" as const,
      source: "may-console",
      owner: "app:may",
      data: {
        appId: "may",
        conversationId: "may:primary",
        author: { kind: "human" as const, id: "may-console:message:1" },
        text: "Review the design",
        metadata: { channel: "may-console" },
        idempotencyKey: "may-console:message:1",
      },
    });
    bus.emit(humanMessage());
    bus.emit(humanMessage());
    await waitUntil(() => calls.length === 1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE app_id = 'may'").get()).toEqual({
      count: 1,
    });

    for (const [kind, transient] of [
      ["command", false],
      ["tool", true],
    ] as const) {
      bus.emit({
        type: "conversation.message.created",
        source: "test",
        owner: "app:may",
        data: {
          appId: "may",
          conversationId: "may:primary",
          author: { kind, id: `test:${kind}` },
          text: kind === "command" ? "Active work: 1 item" : "50%",
          ...(transient ? { transient: true } : {}),
        },
      });
    }
    await Bun.sleep(20);
    expect(calls).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE app_id = 'may'").get()).toEqual({
      count: 1,
    });
  });

  it("carries one natural Telegram request through progress, restart, analysis review, and a shared result", async () => {
    const mayDir = join(root, "may.app");
    mkdirSync(mayDir, { recursive: true });
    writeFileSync(
      join(mayDir, "app.js"),
      `export default {
        id: "may",
        version: 1,
        owner: "may",
        inputSchema: {
          type: "object",
          required: ["kind", "data"],
          properties: {
            kind: { const: "message" },
            data: {
              type: "object",
              required: ["message"],
              properties: { message: { type: "string" }, context: { type: "object" } }
            }
          }
        },
        inbox: { batch: "single" }
      };\n`,
    );
    let terminal = false;
    let ownerAttempts = 0;
    const owner: AppOwnerManager = {
      hasAgent: () => true,
      run(_agent, prompt) {
        ownerAttempts += 1;
        const request = JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "[]")[0];
        writeFileSync(join(root, `owner-request-${ownerAttempts}.json`), JSON.stringify(request));
        return `session:natural:${ownerAttempts}:${request.id}`;
      },
      async waitFor(sessionId) {
        const requestId = sessionId.split(":").slice(3).join(":");
        return {
          status: "done",
          structuredResult: {
            dispositions: [
              {
                requestId,
                disposition:
                  ownerAttempts === 1
                    ? {
                        type: "analyze",
                        analysis: { tool: "codex", question: "Review the evidence", timeoutMs: 10_000 },
                        acknowledgement: "I’ll inspect this and return with the evidence.",
                      }
                    : {
                        type: "complete",
                        summary: "The evidence is sound.",
                        response: "I reviewed it. The evidence is sound.",
                      },
              },
            ],
          },
        };
      },
      cancel() {},
    };
    const bus = new EventBus();
    const conversationUpdates: Array<{ appId?: string; conversationId?: string }> = [];
    const delivered: Array<{
      kind?: string;
      text?: string;
      channelTargetId?: string;
      channelThreadId?: string;
      channelMessageId?: number;
    }> = [];
    bus.subscribe((event) => {
      if (event.type === "conversation.updated") {
        conversationUpdates.push(event.data);
        return;
      }
      if (event.type !== "app.response.delivery.requested") return;
      delivered.push({
        kind: event.data.deliveryKind,
        text: event.data.text,
        channelTargetId: event.data.channelTargetId,
        channelThreadId: event.data.channelThreadId,
        channelMessageId: event.data.channelMessageId,
      });
      bus.emit({
        type: "channel.delivery.completed",
        source: "telegram",
        owner: "agent:may",
        target: { human: true },
        data: {
          channel: event.data.channel,
          sessionId: event.data.sessionId,
          operationId: event.data.operationId,
          appInboxItemId: event.data.appInboxItemId,
          appInboxRequestId: event.data.appInboxRequestId,
          externalMessageId: `${delivered.length}`,
        },
      });
    });
    const start = async () =>
      startAppInboxRuntime({
        registry: await loadedRegistry(root),
        db,
        manager: owner,
        bus,
        attachAnalysis: async () => ({ analysisId: "analysis-natural" }),
        readDependency: async ({ dependency }) => ({
          ...dependency,
          status: terminal ? "done" : "running",
          summary: terminal ? "Reviewed repository evidence" : "Analysis is running",
          evidence: terminal ? ["result.md"] : undefined,
        }),
        scanIntervalMs: 10_000,
      });

    runtime = await start();
    runtime.enableDelivery();
    bus.emit(
      telegramMayInputEvent({
        message: "Please review this design",
        chatId: "123",
        messageId: 42,
        topicId: 7,
        conversationId: "may:primary",
      }),
    );
    await waitUntil(() => delivered.length === 1);
    expect(delivered).toEqual([
      {
        kind: "progress",
        text: "I’ll inspect this and return with the evidence.",
        channelTargetId: "123",
        channelThreadId: "7",
        channelMessageId: 42,
      },
    ]);
    const itemId = (db.prepare("SELECT id FROM app_inbox_items WHERE app_id = 'may'").get() as { id: string }).id;
    expect(runtime.host.get(itemId)).toMatchObject({
      status: "handling",
      waitingOn: { kind: "analysis", id: "analysis-natural" },
      channelTargetId: "123",
      channelThreadId: "7",
      channelMessageId: 42,
      replyToSourceId: undefined,
    });

    runtime.close();
    runtime = null;
    terminal = true;
    runtime = await start();
    runtime.enableDelivery();
    await waitUntil(() => runtime?.host.get(itemId)?.status === "done");
    expect(delivered).toHaveLength(1);
    expect(readAppConversationResource(db, "may", "may:primary").messages).toContainEqual(
      expect.objectContaining({
        author: { kind: "agent", id: "may" },
        text: "I reviewed it. The evidence is sound.",
      }),
    );
    expect(conversationUpdates).toEqual([
      { appId: "may", conversationId: "may:primary" },
      { appId: "may", conversationId: "may:primary" },
      { appId: "may", conversationId: "may:primary" },
    ]);
    expect(ownerAttempts).toBe(2);
    expect(JSON.parse(readFileSync(join(root, "owner-request-2.json"), "utf8"))).toMatchObject({
      dependency: {
        kind: "analysis",
        id: "analysis-natural",
        status: "done",
        evidence: ["result.md"],
      },
    });
  });

  it("translates a subscribed fact into one idempotent durable App input", async () => {
    const calls: string[] = [];
    const bus = new EventBus();
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 42, configurable: true });
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
    });

    const fact = () => ({
      type: "provider.changed",
      source: "provider-observer",
      owner: "app:evaluation-canary",
      data: { project: "evaluation", value: "current" },
    });
    bus.emit(fact());
    await waitUntil(() => calls.length === 1);
    const row = db.prepare("SELECT id, source_id, input_data FROM app_inbox_items").get() as {
      id: string;
      source_id: string;
      input_data: string;
    };
    await waitUntil(() => runtime?.host.get(row.id)?.status === "done");
    expect(row.source_id).toBe("event:42");
    expect(JSON.parse(row.input_data)).toEqual({ value: "current" });

    bus.emit(fact());
    await Bun.sleep(20);
    expect(calls).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
  });

  it("publishes and links a delegated child through the configured event boundary", async () => {
    const bus = new EventBus();
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
    });
    const child = runtime.host.admit({
      appId: "evaluation-canary",
      parentId: "parent-request",
      source: { kind: "app", id: "parent-app" },
      input: { kind: "probe", data: { value: "delegated" } },
      idempotencyKey: "delegate:parent-request:1",
    }).item;
    const published: unknown[] = [];

    runtime.setEventPublisher((input, source) => {
      published.push({ input, source });
      runtime!.host.admit({
        appId: String(input.target?.appId),
        parentId: String(input.data.parentId),
        source,
        input: input.data.input as never,
        originEventId: 91,
        idempotencyKey: input.idempotencyKey,
      });
      return { eventId: 91, eventType: input.type, delivery: "accepted" };
    });

    expect(published).toEqual([
      {
        input: {
          type: "app.input.requested",
          target: { appId: "evaluation-canary" },
          data: {
            input: { kind: "probe", data: { value: "delegated" } },
            parentId: "parent-request",
          },
          idempotencyKey: "delegate:parent-request:1",
        },
        source: { kind: "app", id: "parent-app" },
      },
    ]);
    expect(runtime.host.get(child.id)?.originEventId).toBe(91);
    expect(runtime.host.pendingDelegations()).toEqual([]);
  });

  it("replays deterministic task admission through the durable canonical route", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "task-app", version: 1, owner: "evaluator",
        inputSchema: { type: "object", required: ["kind"], properties: { kind: { const: "probe" } } },
        tasks: {
          subscriptions: ["task.requested"],
          resolve(event) {
            return {
              id: "work/" + event.data.itemId, parentId: "project",
              outcome: "Handle " + event.data.itemId, acceptance: ["handled"], mode: "achieve"
            };
          }
        }
      };\n`,
    );
    const bus = new EventBus();
    const deliveries: Array<{ event: AgentEvent; result: { by?: string } }> = [];
    const admissions: Array<{ appId: string; taskId: string; eventId: number }> = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 77, configurable: true });
      Object.defineProperty(event, EVENT_DEDUPLICATED, { value: true, configurable: true });
      Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
    });
    bus.setDeliveryRecorder((event, result) => deliveries.push({ event, result }));
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent(input) {
        admissions.push({
          appId: input.appId,
          taskId: input.intent?.id ?? "",
          eventId: Number(input.event[EVENT_ROW_ID]),
        });
        return { accepted: true, by: `task:${input.intent?.id}`, route: "direct" };
      },
    });

    bus.emit({
      type: "task.requested",
      source: "test",
      data: { itemId: "one" },
    } as AgentEvent);

    expect(admissions).toEqual([{ appId: "task-app", taskId: "work/one", eventId: 77 }]);
    expect(deliveries.find(({ event }) => event.type === "task.requested")?.result.by).toBe(
      "app-runtime:events:task:task-app/work/one",
    );
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
  });

  it("treats an explicit null task resolution as observation-only", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "task-app", version: 1, owner: "evaluator",
        inputSchema: { type: "object", properties: {} },
        tasks: {
          subscriptions: ["evaluation.owner_reviewed"],
          resolve() { return null; }
        },
        observations: ["evaluation.owner_reviewed"]
      };\n`,
    );
    const bus = new EventBus();
    const delivered: Array<{ type: string; by?: string }> = [];
    let taskAdmissions = 0;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 79, configurable: true });
    });
    bus.setDeliveryRecorder((event, result) => delivered.push({ type: event.type, by: result.by }));
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent() {
        taskAdmissions += 1;
        return { accepted: true, by: "unexpected", route: "direct" };
      },
    });

    bus.emit({ type: "evaluation.owner_reviewed", source: "test", data: {} } as AgentEvent);

    expect(taskAdmissions).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
    expect(delivered).toContainEqual({
      type: "evaluation.owner_reviewed",
      by: "app-runtime:observations:task-app",
    });
  });

  it("does not globally acknowledge a null task resolution for an unaudited event type", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "task-app", version: 1, owner: "evaluator",
        inputSchema: { type: "object", properties: {} },
        tasks: {
          subscriptions: ["evaluation.new_actionable_fact"],
          resolve() { return null; }
        }
      };\n`,
    );
    const bus = new EventBus();
    const delivered: string[] = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 81, configurable: true });
    });
    bus.setDeliveryRecorder((event) => delivered.push(event.type));
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent: () => ({ accepted: true, by: "unexpected", route: "direct" }),
    });

    bus.emit({ type: "evaluation.new_actionable_fact", source: "test", data: {} } as AgentEvent);

    expect(delivered).not.toContain("evaluation.new_actionable_fact");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
  });

  it("keeps a resolver failure pending instead of treating it as null resolution", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "task-app", version: 1, owner: "evaluator",
        inputSchema: { type: "object", properties: {} },
        tasks: {
          subscriptions: ["broken.fact"],
          resolve() { throw new Error("resolver rejected malformed input"); }
        }
      };\n`,
    );
    const bus = new EventBus();
    const delivered: string[] = [];
    const failed: AgentEvent[] = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 80, configurable: true });
    });
    bus.setDeliveryRecorder((event) => delivered.push(event.type));
    bus.subscribe((event) => {
      if (event.type === "broken.fact") return { accepted: true, by: "ordinary" };
      if (event.type === "subscriber.failed") failed.push(event);
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent: () => ({ accepted: true, by: "unexpected", route: "direct" }),
    });

    bus.emit({ type: "broken.fact", source: "test", data: {} } as AgentEvent);

    expect(delivered).not.toContain("broken.fact");
    expect(failed.some((event) => JSON.stringify(event).includes("resolver rejected malformed input"))).toBe(true);
  });

  it("durably admits task Condition matches without a manifest subscription", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "condition-app", version: 1, owner: "evaluator",
        inputSchema: { type: "object", required: ["kind"], properties: { kind: { const: "probe" } } },
        tasks: { attach: true }
      };\n`,
    );
    const bus = new EventBus();
    const admissions: string[][] = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 78, configurable: true });
      Object.defineProperty(event, EVENT_DEDUPLICATED, { value: true, configurable: true });
      Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      previewTaskEvent: () => ["work/waiting"],
      admitTaskEvent(input) {
        admissions.push(input.conditionTaskIds ?? []);
        return { accepted: true, by: "condition", route: "direct" };
      },
    });

    bus.emit({ type: "provider.state", source: "test", data: { state: "ready" } } as AgentEvent);

    expect(admissions).toEqual([["work/waiting"]]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
  });

  it("admits additive Condition wakes with an independently addressed inbox obligation", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "condition-app", version: 1, owner: "evaluator",
        inputSchema: {
          type: "object", required: ["kind", "data"],
          properties: { kind: { const: "probe" }, data: { type: "object" } }
        },
        subscriptions: [{
          id: "provider-review", event: "provider.state",
          toInput(event) { return { kind: "probe", data: event.data }; }
        }],
        tasks: { attach: true }
      };\n`,
    );
    const bus = new EventBus();
    const admissions: string[][] = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 79, configurable: true });
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      previewTaskEvent: () => ["work/waiting"],
      admitTaskEvent(input) {
        admissions.push(input.conditionTaskIds ?? []);
        expect(input.intent).toBeNull();
        return { accepted: true, by: "condition", route: "direct" };
      },
    });

    bus.emit({ type: "provider.state", source: "test", data: { state: "ready" } } as AgentEvent);

    expect(admissions).toEqual([["work/waiting"]]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
    expect(
      db
        .prepare(
          `SELECT route_kind, payload_version, status
         FROM app_event_admission_commands WHERE event_id = 79`,
        )
        .get(),
    ).toEqual({ route_kind: "inbox", payload_version: 2, status: "admitted" });
  });

  it("rejects one App claiming the same fact through inbox and task routes", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "ambiguous-app", version: 1, owner: "evaluator",
        inputSchema: {
          type: "object", required: ["kind", "data"],
          properties: { kind: { const: "probe" }, data: { type: "object" } }
        },
        subscriptions: [{
          id: "ambiguous-inbox", event: "ambiguous.fact",
          toInput() { return { kind: "probe", data: {} }; }
        }],
        tasks: {
          subscriptions: ["ambiguous.fact"],
          resolve() {
            return {
              id: "work/ambiguous", parentId: "project", outcome: "Handle ambiguity",
              acceptance: ["handled"], mode: "achieve"
            };
          }
        }
      };\n`,
    );
    const bus = new EventBus();
    const failed: AgentEvent[] = [];
    const deliveries: Array<{ event: AgentEvent }> = [];
    let taskAdmissions = 0;
    let rowId = 90;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: rowId++, configurable: true });
    });
    bus.setDeliveryRecorder((event) => deliveries.push({ event }));
    bus.subscribe((event) => {
      if (event.type === "subscriber.failed") failed.push(event);
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent() {
        taskAdmissions += 1;
        return { accepted: true, by: "unexpected", route: "direct" };
      },
    });

    bus.emit({ type: "ambiguous.fact", source: "test", data: {} } as AgentEvent);

    expect(taskAdmissions).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
    expect(deliveries.some(({ event }) => event.type === "ambiguous.fact")).toBe(false);
    expect(failed.some((event) => JSON.stringify(event).includes("both inbox and task-intent routes"))).toBe(true);
  });

  it("lets an exact task target bypass broad and inbox routing", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "target-app", version: 1, owner: "evaluator",
        inputSchema: {
          type: "object", required: ["kind", "data"],
          properties: { kind: { const: "probe" }, data: { type: "object" } }
        },
        subscriptions: [{
          id: "broad-inbox", event: "target.fact",
          toInput() { return { kind: "probe", data: {} }; }
        }],
        tasks: {
          subscriptions: ["target.fact"],
          resolve() {
            throw new Error("broad resolver must not run for an exact task address");
          }
        }
      };\n`,
    );
    const bus = new EventBus();
    const admissions: Array<{ targetedTaskId?: string; intentId?: string }> = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 101, configurable: true });
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent(input) {
        admissions.push({ targetedTaskId: input.targetedTaskId, intentId: input.intent?.id });
        return { accepted: true, by: "exact", route: "direct" };
      },
    });

    bus.emit({
      type: "target.fact",
      source: "test",
      target: { project: "target-app", taskId: "work/exact" },
      data: {},
    } as AgentEvent);

    expect(admissions).toEqual([{ targetedTaskId: "work/exact", intentId: undefined }]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
  });

  it("keeps a missing exact target pending even when an ordinary subscriber accepts the fact", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "target-app", version: 1, owner: "evaluator",
        inputSchema: { type: "object", properties: {} },
        tasks: { attach: true }
      };\n`,
    );
    const bus = new EventBus();
    const delivered: string[] = [];
    const failed: AgentEvent[] = [];
    let ordinaryCalls = 0;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 102, configurable: true });
    });
    bus.setDeliveryRecorder((event) => delivered.push(event.type));
    bus.subscribe((event) => {
      if (event.type === "target.fact") {
        ordinaryCalls += 1;
        return { accepted: true, by: "ordinary" };
      }
      if (event.type === "subscriber.failed") failed.push(event);
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent: () => undefined,
    });

    bus.emit({
      type: "target.fact",
      source: "test",
      target: { appId: "target-app", taskId: "work/missing" },
      data: {},
    } as AgentEvent);

    expect(ordinaryCalls).toBe(1);
    expect(delivered).not.toContain("target.fact");
    expect(failed.some((event) => JSON.stringify(event).includes("did not durably admit frozen work/missing"))).toBe(
      true,
    );
  });

  it("rejects an exact task target without canonical App identity instead of falling through", async () => {
    const bus = new EventBus();
    const delivered: string[] = [];
    const failed: AgentEvent[] = [];
    let taskAdmissions = 0;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 104, configurable: true });
    });
    bus.setDeliveryRecorder((event) => delivered.push(event.type));
    bus.subscribe((event) => {
      if (event.type === "subscriber.failed") failed.push(event);
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent() {
        taskAdmissions += 1;
        return { accepted: true, by: "unexpected" };
      },
    });

    bus.emit({
      type: "target.fact",
      source: "test",
      target: { taskId: "work/malformed" },
      data: {},
    } as AgentEvent);

    expect(taskAdmissions).toBe(0);
    expect(delivered).not.toContain("target.fact");
    expect(failed.some((event) => JSON.stringify(event).includes("has no canonical App identity"))).toBe(true);
  });

  it("keeps a lifecycle subject identity in event data instead of treating it as a wake address", async () => {
    const bus = new EventBus();
    const delivered: Array<{ type: string; by?: string }> = [];
    let taskAdmissions = 0;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 105, configurable: true });
    });
    bus.setDeliveryRecorder((event, result) => delivered.push({ type: event.type, by: result.by }));
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent() {
        taskAdmissions += 1;
        return { accepted: true, by: "unexpected" };
      },
    });

    bus.emit({
      type: "project.task.reconciled",
      source: "task-reconciler",
      target: { appId: "evaluation-canary" },
      data: { taskId: "work/described", disposition: "converged" },
    } as AgentEvent);

    expect(taskAdmissions).toBe(0);
    expect(delivered).toContainEqual({
      type: "project.task.reconciled",
      by: "app-runtime:observations:evaluation-canary",
    });
  });

  it("attempts every selected App route and acknowledges only after all durable admissions succeed", async () => {
    for (const appId of ["a-task", "z-task"]) {
      const appDir = join(root, `${appId}.app`);
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "app.js"),
        `export default {
          id: "${appId}", version: 1, owner: "evaluator",
          inputSchema: { type: "object", properties: {} },
          tasks: {
            subscriptions: [{ type: "provider.changed", actions: ["refresh"] }],
            resolve() {
              return {
                id: "work/${appId}", parentId: "project", outcome: "Handle ${appId}",
                acceptance: ["handled"], mode: "achieve"
              };
            }
          }
        };\n`,
      );
    }
    const bus = new EventBus();
    const delivered: string[] = [];
    const attempts: string[] = [];
    let failA = true;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: 103, configurable: true });
    });
    bus.setDeliveryRecorder((event) => delivered.push(event.type));
    bus.subscribe((event) => {
      if (event.type === "provider.changed") return { accepted: true, by: "ordinary" };
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent(input) {
        attempts.push(input.appId);
        if (input.appId === "a-task" && failA) throw new Error("a-task storage unavailable");
        return { accepted: true, by: `task:${input.appId}`, route: "direct" };
      },
    });
    const fact = () =>
      ({
        type: "provider.changed",
        source: "test",
        action: "refresh",
        data: { project: "evaluation", value: "current" },
      }) as AgentEvent;

    bus.emit(fact());

    expect(new Set(attempts)).toEqual(new Set(["a-task", "z-task"]));
    expect(delivered).not.toContain("provider.changed");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });

    failA = false;
    attempts.length = 0;
    bus.emit(fact());

    expect(attempts).toEqual(["a-task"]);
    expect(delivered).toContain("provider.changed");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
    expect(
      db.prepare(`SELECT status, registry_generation FROM app_event_admission_plans WHERE event_id = 103`).get(),
    ).toEqual({ status: "completed", registry_generation: 1 });
  });

  it("replays the frozen route kind after partial admission and registry reload", async () => {
    const inboxAppPath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      inboxAppPath,
      `export default {
        id: "a-inbox", version: 1, owner: "evaluator",
        inputSchema: {
          type: "object", required: ["kind", "data"],
          properties: {
            kind: { const: "review" },
            data: { type: "object" }
          }
        },
        subscriptions: [{
          id: "review-provider", event: "provider.changed",
          toInput(event) { return { kind: "review", data: event.data }; }
        }]
      };\n`,
    );
    const taskAppDir = join(root, "z-task.app");
    mkdirSync(taskAppDir, { recursive: true });
    writeFileSync(
      join(taskAppDir, "app.js"),
      `export default {
        id: "z-task", version: 1, owner: "evaluator",
        inputSchema: { type: "object", properties: {} },
        tasks: {
          subscriptions: ["provider.changed"],
          resolve() {
            return {
              id: "work/provider", outcome: "Refresh provider state",
              acceptance: ["Provider state is current."], mode: "achieve"
            };
          }
        }
      };\n`,
    );
    const registry = await loadedRegistry(root);
    const selectedSnapshotId = registry.snapshot().id;
    const selectedGeneration = registry.snapshot().generation;
    const bus = new EventBus();
    const deliveries: Array<{ type: string; note?: string }> = [];
    const attempts: string[] = [];
    let failTask = true;
    let diagnosticEventId = 1_060;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, {
        value: event.type === "provider.changed" ? 106 : diagnosticEventId++,
        configurable: true,
      });
    });
    bus.setDeliveryRecorder((event, result) => deliveries.push({ type: event.type, note: result.note }));
    runtime = await startAppInboxRuntime({
      registry,
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      admitTaskEvent(input) {
        attempts.push(input.appId);
        if (failTask) throw new Error("task store unavailable");
        return { accepted: true, by: `task:${input.appId}`, route: "direct" };
      },
    });
    const fact = () =>
      ({
        type: "provider.changed",
        source: "provider",
        data: { value: "current" },
      }) as AgentEvent;

    bus.emit(fact());
    expect(attempts).toEqual(["z-task"]);
    expect(deliveries).not.toContainEqual(expect.objectContaining({ type: "provider.changed" }));
    expect(
      db
        .prepare(
          `SELECT app_id, route_kind, route_id, status
           FROM app_event_admission_commands
           WHERE event_id = 106
           ORDER BY app_id`,
        )
        .all(),
    ).toEqual([
      {
        app_id: "a-inbox",
        route_kind: "inbox",
        route_id: "review-provider",
        status: "admitted",
      },
      {
        app_id: "z-task",
        route_kind: "task",
        route_id: "work/provider",
        status: "pending",
      },
    ]);

    writeFileSync(
      inboxAppPath,
      `export default {
        id: "a-inbox", version: 1, owner: "evaluator",
        inputSchema: {
          type: "object", required: ["kind", "data"],
          properties: {
            kind: { const: "review" },
            data: { type: "object" }
          }
        },
        tasks: {
          subscriptions: ["provider.changed"],
          resolve() { throw new Error("new policy must not reclassify the pending event"); }
        }
      };\n`,
    );
    await runtime.reload();
    expect(registry.snapshot().generation).toBe(selectedGeneration + 1);

    failTask = false;
    attempts.length = 0;
    bus.emit(fact());

    expect(attempts).toEqual(["z-task"]);
    expect(deliveries.at(-1)).toMatchObject({
      type: "provider.changed",
      note: `registry-snapshot:${selectedSnapshotId}; generation:${selectedGeneration}; 2 frozen App admission command(s) admitted durably`,
    });
    expect(
      db
        .prepare(
          `SELECT status, registry_snapshot_id, registry_generation
           FROM app_event_admission_plans WHERE event_id = 106`,
        )
        .get(),
    ).toEqual({
      status: "completed",
      registry_snapshot_id: selectedSnapshotId,
      registry_generation: selectedGeneration,
    });
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM app_inbox_items
           WHERE app_id = 'a-inbox' AND idempotency_key = 'subscription:a-inbox:review-provider:event:106'`,
        )
        .get(),
    ).toEqual({ count: 1 });
  });

  it("replays a frozen admission after process-style restart without reusing the numeric generation", async () => {
    const appPath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      appPath,
      `export default {
        id: "task-app", version: 1, owner: "evaluator",
        inputSchema: { type: "object", properties: {} },
        tasks: {
          subscriptions: ["provider.changed"],
          resolve() {
            return {
              id: "work/original", outcome: "Apply the original frozen policy",
              acceptance: ["Original work is admitted."], mode: "achieve"
            };
          }
        }
      };\n`,
    );
    const originalRegistry = await loadedRegistry(root);
    const originalSnapshot = originalRegistry.snapshot();
    const firstBus = new EventBus();
    let diagnosticEventId = 1_070;
    firstBus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, {
        value: event.type === "provider.changed" ? 107 : diagnosticEventId++,
        configurable: true,
      });
    });
    runtime = await startAppInboxRuntime({
      registry: originalRegistry,
      db,
      manager: manager([]),
      bus: firstBus,
      scanIntervalMs: 10_000,
      admitTaskEvent() {
        throw new Error("task store unavailable before restart");
      },
    });
    const fact = () => ({ type: "provider.changed", source: "provider", data: {} }) as AgentEvent;

    firstBus.emit(fact());
    expect(
      db
        .prepare(
          `SELECT registry_snapshot_id, registry_generation, status
         FROM app_event_admission_plans WHERE event_id = 107`,
        )
        .get(),
    ).toEqual({
      registry_snapshot_id: originalSnapshot.id,
      registry_generation: 1,
      status: "pending",
    });
    runtime.close();
    runtime = null;

    writeFileSync(
      appPath,
      `export default {
        id: "task-app", version: 1, owner: "evaluator",
        inputSchema: { type: "object", properties: {} },
        tasks: {
          subscriptions: ["provider.changed"],
          resolve() { throw new Error("replacement policy must not classify retained delivery"); }
        }
      };\n`,
    );
    const restartedRegistry = await loadedRegistry(root);
    expect(restartedRegistry.snapshot().generation).toBe(1);
    expect(restartedRegistry.snapshot().id).not.toBe(originalSnapshot.id);
    const restartedBus = new EventBus();
    const deliveries: Array<{ type: string; note?: string }> = [];
    restartedBus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, {
        value: event.type === "provider.changed" ? 107 : diagnosticEventId++,
        configurable: true,
      });
    });
    restartedBus.setDeliveryRecorder((event, result) => deliveries.push({ type: event.type, note: result.note }));
    const admittedIntentIds: Array<string | undefined> = [];
    runtime = await startAppInboxRuntime({
      registry: restartedRegistry,
      db,
      manager: manager([]),
      bus: restartedBus,
      scanIntervalMs: 10_000,
      admitTaskEvent(input) {
        admittedIntentIds.push(input.intent?.id);
        return { accepted: true, by: "task-store", route: "direct" };
      },
    });

    restartedBus.emit(fact());

    expect(admittedIntentIds).toEqual(["work/original"]);
    expect(deliveries.at(-1)).toMatchObject({
      type: "provider.changed",
      note: `registry-snapshot:${originalSnapshot.id}; generation:1; 1 frozen App admission command(s) admitted durably`,
    });
  });

  it("admits one durable input per schedule slot without replaying pre-start slots", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "scheduled",
        version: 1,
        owner: "evaluator",
        inputSchema: {
          type: "object", required: ["kind", "data"],
          properties: { kind: { const: "probe" }, data: { type: "object" } }
        },
        schedules: [{
          id: "review", intervalMs: 60000, catchUp: "none",
          input: { kind: "probe", data: { value: "scheduled" } }
        }]
      };\n`,
    );
    let currentTime = 1;
    const calls: string[] = [];
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager(calls),
      bus: new EventBus(),
      scanIntervalMs: 10_000,
      now: () => currentTime,
    });
    await Bun.sleep(20);
    expect(calls).toHaveLength(0);

    currentTime = 60_001;
    runtime.scanNow();
    await waitUntil(() => calls.length === 1);
    runtime.scanNow();
    await Bun.sleep(20);
    expect(calls).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE app_id = 'scheduled'").get()).toEqual({
      count: 1,
    });
  });

  it("publishes event schedules once per future slot without replaying the current slot at startup", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "scheduled",
        version: 1,
        owner: "evaluator",
        inputSchema: { type: "object", properties: {} },
        schedules: [{
          id: "pulse", intervalMs: 60000,
          event: {
            type: "project.tick",
            data: { project: "scheduled", reason: "scheduled-pulse" },
            target: { appId: "scheduled", project: "scheduled" }
          }
        }],
        observations: ["project.tick"]
      };\n`,
    );
    let currentTime = 1;
    let eventId = 1;
    const events: AgentEvent[] = [];
    const bus = new EventBus();
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: eventId++, configurable: true });
    });
    bus.subscribe((event) => events.push(event));
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
      now: () => currentTime,
    });

    expect(events.filter((event) => event.type === "project.tick")).toHaveLength(0);
    currentTime = 60_001;
    runtime.scanNow();
    runtime.scanNow();

    const pulses = events.filter((event) => event.type === "project.tick");
    expect(pulses).toHaveLength(1);
    expect(pulses[0]).toMatchObject({
      source: "app:scheduled:schedule:pulse",
      owner: "app:scheduled",
      data: {
        project: "scheduled",
        reason: "scheduled-pulse",
        idempotencyKey: "schedule:scheduled:pulse:1",
      },
    });
  });

  it("starts without registered Apps and adopts definitions on reload", async () => {
    rmSync(join(root, "evaluation.app", "app.js"));
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: manager([]),
      bus: new EventBus(),
      scanIntervalMs: 10_000,
    });
    expect(runtime.host.appIds()).toEqual([]);

    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "reloaded",
        version: 1,
        owner: "evaluator",
        inputSchema: { type: "object", required: ["kind"], properties: { kind: { const: "probe" } } }
      };\n`,
    );

    expect(await runtime.reload()).toEqual(["reloaded"]);
    expect(runtime.host.acceptsInput("reloaded", { kind: "probe", data: null })).toBe(true);
  });

  it("publishes one prepared generation only after every consumer commits", async () => {
    const registry = await loadedRegistry(root);
    runtime = await startAppInboxRuntime({
      registry,
      db,
      manager: manager([]),
      bus: new EventBus(),
      scanIntervalMs: 10_000,
    });
    const previousGeneration = registry.snapshot().generation;

    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "replacement", version: 1, owner: "evaluator",
        inputSchema: { type: "object", required: ["kind"], properties: { kind: { const: "probe" } } }
      };\n`,
    );

    await expect(
      runtime.reload(async ({ snapshot, commit }) => {
        expect(snapshot.generation).toBe(previousGeneration + 1);
        expect(snapshot.entries.map((entry) => entry.definition.id)).toEqual(["replacement"]);
        expect(registry.snapshot().generation).toBe(previousGeneration);
        expect(runtime?.host.appIds()).toEqual(["evaluation-canary"]);
        commit();
        expect(runtime?.host.appIds()).toEqual(["replacement"]);
        throw new Error("compatibility consumer rejected generation");
      }),
    ).rejects.toThrow("compatibility consumer rejected generation");

    expect(registry.snapshot().generation).toBe(previousGeneration);
    expect(runtime.host.appIds()).toEqual(["evaluation-canary"]);

    expect(
      await runtime.reload(async ({ snapshot, commit }) => {
        expect(registry.snapshot().generation).toBe(previousGeneration);
        expect(snapshot.generation).toBe(previousGeneration + 1);
        commit();
      }),
    ).toEqual(["replacement"]);
    expect(registry.snapshot().generation).toBe(previousGeneration + 1);
  });

  it("records the installed registry snapshot that selected each durable event route", async () => {
    const registry = await loadedRegistry(root);
    const bus = new EventBus();
    const deliveries: Array<{ type: string; note?: string }> = [];
    let eventId = 200;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: eventId++, configurable: true });
    });
    bus.setDeliveryRecorder((event, result) => deliveries.push({ type: event.type, note: result.note }));
    runtime = await startAppInboxRuntime({
      registry,
      db,
      manager: manager([]),
      bus,
      scanIntervalMs: 10_000,
    });
    const processScopedListenerCount = bus.listenerCount;

    const providerFact = (value: string) =>
      ({
        type: "provider.changed",
        source: "provider",
        data: { project: "evaluation", value },
      }) as AgentEvent;
    bus.emit(providerFact("before-reload"));
    const beforeReload = registry.snapshot();
    expect(deliveries.at(-1)).toMatchObject({
      type: "provider.changed",
      note: `registry-snapshot:${beforeReload.id}; generation:${beforeReload.generation}; 1 frozen App admission command(s) admitted durably`,
    });

    const previousGeneration = registry.snapshot().generation;
    await runtime.reload();
    expect(registry.snapshot().generation).toBe(previousGeneration + 1);
    expect(bus.listenerCount).toBe(processScopedListenerCount);
    bus.emit(providerFact("after-reload"));
    const afterReload = registry.snapshot();
    expect(deliveries.at(-1)).toMatchObject({
      type: "provider.changed",
      note: `registry-snapshot:${afterReload.id}; generation:${previousGeneration + 1}; 1 frozen App admission command(s) admitted durably`,
    });

    await expect(
      runtime.reload(() => {
        throw new Error("candidate rejected");
      }),
    ).rejects.toThrow("candidate rejected");
    expect(bus.listenerCount).toBe(processScopedListenerCount);
    expect(registry.snapshot()).toBe(afterReload);
  });

  it("admits one uniquely addressed agent message and durably returns its result", async () => {
    const mayDir = join(root, "may.app");
    mkdirSync(mayDir, { recursive: true });
    writeFileSync(
      join(mayDir, "app.js"),
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
      registry: await loadedRegistry(root),
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

  it("leaves incompatible and ambiguous agent messages explicitly unaccepted", async () => {
    for (const id of ["may-one", "may-two"]) {
      const appDir = join(root, `${id}.app`);
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "app.js"),
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
    const persistedEvents: AgentEvent[] = [];
    const bus = new EventBus();
    let rowId = 100;
    bus.setPersistenceSubscriber((event) => {
      persistedEvents.push(event);
      Object.defineProperty(event, EVENT_ROW_ID, { value: rowId++, configurable: true });
    });
    bus.setDeliveryRecorder((event, result) => deliveries.push({ event, result }));
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
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
    const humanNotification = bus.emit({
      type: "message.created",
      source: "agent:tech-lead",
      owner: "human:operator",
      data: { from: "tech-lead", to: "human", content: "Daily ops digest." },
    });

    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
    expect(deliveries).toEqual([]);
    expect(ambiguous[EVENT_ROW_ID]).toBeDefined();
    expect(incompatible[EVENT_ROW_ID]).toBeDefined();
    expect(humanNotification[EVENT_ROW_ID]).toBeDefined();
    expect(persistedEvents.filter((event) => event.type === "subscriber.failed")).toHaveLength(2);
  });

  it("preserves human channel metadata through admission and owner dispatch", async () => {
    const calls: Array<Parameters<AppOwnerManager["run"]>[2]> = [];
    const ownerContexts: Array<{ appId: string; humanOrigin: boolean }> = [];
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
    const conversationUpdates: Array<{ appId?: string; conversationId?: string }> = [];
    bus.subscribe((event) => {
      if (event.type === "conversation.updated") conversationUpdates.push(event.data);
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: managerWithMetadata,
      bus,
      scanIntervalMs: 10_000,
      runOwner: (work, context) => {
        ownerContexts.push(context);
        return work();
      },
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
    await waitUntil(() => runtime?.host.get(item.id)?.status === "done");
    expect(runtime?.host.get(item.id)).toMatchObject({
      status: "done",
      source: { kind: "human", id: "event:42" },
      conversationId: "telegram:123",
      conversationSequence: 42,
      channel: "telegram",
      channelThreadId: "topic:7",
      channelMessageId: 99,
      result: { summary: "human request handled" },
    });
    expect(calls[0]).toMatchObject({
      source: "telegram",
      kind: "job",
      requestId: `app-inbox-human:${item.id}`,
      conversationId: "telegram:123",
      channelMessageId: 99,
      recoveryOwner: "app-inbox",
      toolPolicy: "app-owner-deputy",
    });
    expect(ownerContexts).toEqual([{ appId: "evaluation-canary", humanOrigin: true }]);
    expect(conversationUpdates).toContainEqual({ appId: "evaluation-canary", conversationId: "telegram:123" });
    expect(readAppConversationResource(db, "evaluation-canary", "telegram:123").messages).toContainEqual(
      expect.objectContaining({
        author: { kind: "agent", id: "evaluation-canary" },
        text: "human request handled",
      }),
    );
  });

  it("dispatches a restart-pending delivery once and never blindly redispatches an attempted send", async () => {
    const calls: string[] = [];
    const firstBus = new EventBus();
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
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
      registry: await loadedRegistry(root),
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
      registry: await loadedRegistry(root),
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
      registry: await loadedRegistry(root),
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
      registry: await loadedRegistry(root),
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
      registry: await loadedRegistry(root),
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
      registry: await loadedRegistry(root),
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
      join(workerDir, "app.js"),
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
      registry: await loadedRegistry(root),
      db,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
      maxConcurrentRequests: 1,
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

  it("runs independent requests up to the App inbox concurrency limit", async () => {
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "evaluation-canary",
        version: 1,
        owner: "evaluator",
        inputSchema: {
          type: "object",
          required: ["kind", "data"],
          properties: { kind: { const: "probe" }, data: { type: "object" } }
        },
        inbox: { batch: "single", maxConcurrent: 2 }
      };\n`,
    );
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const blockingManager: AppOwnerManager = {
      hasAgent: () => true,
      run(_agent, prompt) {
        const requestId = JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "[]")[0].id;
        started.push(requestId);
        return `session:${requestId}`;
      },
      waitFor(sessionId) {
        return new Promise((resolve) => {
          releases.push(() =>
            resolve({
              status: "done",
              structuredResult: {
                dispositions: [
                  {
                    requestId: sessionId.replace(/^session:/, ""),
                    disposition: { type: "complete", summary: "done" },
                  },
                ],
              },
            }),
          );
        });
      },
      cancel() {},
    };
    const bus = new EventBus();
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      manager: blockingManager,
      bus,
      scanIntervalMs: 10_000,
      maxConcurrentRequests: 4,
    });
    const emit = (value: string) =>
      bus.emit({
        type: "app.input.requested",
        data: {
          appId: "evaluation-canary",
          input: { kind: "probe", data: { value } },
          source: { kind: "system", id: "test" },
        },
      });
    emit("one");
    emit("two");
    emit("three");

    await waitUntil(() => started.length === 2);
    await Bun.sleep(20);
    expect(started).toHaveLength(2);

    releases.shift()!();
    await waitUntil(() => started.length === 3);
    for (const release of releases.splice(0)) release();
    await waitUntil(() => started.every((id) => runtime?.host.get(id)?.status === "done"));
  });
});

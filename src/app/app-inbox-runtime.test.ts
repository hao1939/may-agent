import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppDependencyObservation } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import { EVENT_DEDUPLICATED, EVENT_REDELIVERY_REQUIRED, EVENT_ROW_ID, EventBus } from "./event-bus.js";
import { AppRegistry } from "./app-registry.js";

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
    mkdirSync(join(root, "evaluation.app"), { recursive: true });
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "evaluation",
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
        task(input) {
          return {
            kind: "desired",
            intent: {
              id: "probe/" + input.id,
              parentId: "evaluation",
              outcome: "Evaluate " + input.input.data.value,
              acceptance: ["Evaluation completed"],
              mode: "achieve"
            }
          };
        },
        tasks: {},
        subscriptions: [{
          id: "provider-change",
          event: { type: "provider.changed", project: "evaluation" },
          toInput(event) { return { kind: "probe", data: { value: event.data.value } }; }
        }]
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

  async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await Bun.sleep(5);
    }
    throw new Error("Timed out waiting for App inbox runtime");
  }

  function persistentBus(): EventBus {
    const bus = new EventBus();
    let nextId = 1;
    const identities = new Map<string, number>();
    bus.setPersistenceSubscriber((event) => {
      const data = event.data as { idempotencyKey?: string } | undefined;
      const identity = data?.idempotencyKey;
      const prior = identity ? identities.get(identity) : undefined;
      const id = prior ?? nextId++;
      if (identity) identities.set(identity, id);
      Object.defineProperty(event, EVENT_ROW_ID, { value: id, configurable: true });
      if (prior !== undefined) {
        Object.defineProperty(event, EVENT_DEDUPLICATED, { value: true, configurable: true });
        Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
      }
    });
    return bus;
  }

  function capabilities(bus: EventBus) {
    const observations = new Map<string, AppDependencyObservation>();
    const attached: string[] = [];
    return {
      observations,
      attached,
      options: {
        attachTask: async (input: any) => {
          const taskId = input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id;
          attached.push(taskId);
          return { taskId };
        },
        readDependency: async (input: any) => observations.get(input.dependency.id) ?? null,
        admitTaskEvent: () => ({ accepted: true, by: "test-task", route: "direct" }),
        previewTaskEvent: () => [],
      },
      complete(taskId: string, result: Omit<AppDependencyObservation, "kind" | "id" | "status">) {
        observations.set(taskId, { kind: "task", id: taskId, status: "done", ...result });
        bus.emit({
          type: "app.dependency.completed",
          source: "test-task",
          owner: "app:evaluation",
          data: { kind: "task", id: taskId, status: "done", ...result },
        });
      },
    };
  }

  it("maps one durable App input to one Task and projects its result", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      scanIntervalMs: 10_000,
    });

    const input = {
      type: "app.input.requested" as const,
      source: "test",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        requestId: "request-1",
        input: { kind: "probe", data: { value: "first" } },
        source: { kind: "system" as const, id: "test" },
        idempotencyKey: "input:1",
      },
    };
    bus.emit(input);
    bus.emit(input);
    await waitUntil(() => task.attached.length === 1);
    expect(runtime.host.get("request-1")?.waitingOn).toEqual({ kind: "task", id: "probe/request-1" });

    task.complete("probe/request-1", {
      summary: "Evaluation passed",
      response: "The provider is healthy.",
      evidence: ["probe:ok"],
    });
    await waitUntil(() => runtime?.host.get("request-1")?.status === "done");

    expect(task.attached).toEqual(["probe/request-1"]);
    expect(runtime.host.get("request-1")?.result).toEqual({
      summary: "Evaluation passed",
      response: "The provider is healthy.",
      evidence: ["probe:ok"],
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
  });

  it("recovers an exact Task wait after restart", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    const registry = await loadedRegistry(root);
    runtime = await startAppInboxRuntime({ registry, db, bus, ...task.options, scanIntervalMs: 10_000 });
    bus.emit({
      type: "app.input.requested",
      source: "test",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        requestId: "restart-request",
        input: { kind: "probe", data: { value: "restart" } },
        source: { kind: "system", id: "test" },
        idempotencyKey: "restart:1",
      },
    });
    await waitUntil(() => runtime?.host.get("restart-request")?.waitingOn?.kind === "task");
    runtime.close();
    runtime = null;

    task.observations.set("probe/restart-request", {
      kind: "task",
      id: "probe/restart-request",
      status: "done",
      summary: "Recovered result",
    });
    runtime = await startAppInboxRuntime({ registry, db, bus, ...task.options, scanIntervalMs: 10_000 });
    await waitUntil(() => runtime?.host.get("restart-request")?.status === "done");

    expect(runtime.host.get("restart-request")?.result?.summary).toBe("Recovered result");
  });

  it("translates a subscribed Event into the same Task path", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "provider.changed",
      source: "provider",
      owner: "app:evaluation",
      target: { project: "evaluation" },
      data: { project: "evaluation", value: "changed", idempotencyKey: "provider:1" },
    });
    await waitUntil(() => task.attached.length === 1);

    const row = db.prepare("SELECT id FROM app_inbox_items WHERE app_id = 'evaluation'").get() as { id: string };
    expect(runtime.host.get(row.id)?.input).toEqual({ kind: "probe", data: { value: "changed" } });
    expect(task.attached).toEqual([`probe/${row.id}`]);
  });

  it("keeps an explicit malformed exact-task target visible as subscriber failure", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    const failures: Array<Record<string, unknown>> = [];
    bus.subscribe((event) => {
      if (event.type === "subscriber.failed") failures.push(event.data as Record<string, unknown>);
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "trigger.metrics-snapshot",
      source: "control-socket",
      owner: "agent:may",
      target: { taskId: "missing-app-target" },
      data: { appId: "correlation-only" },
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      originalEventType: "trigger.metrics-snapshot",
      error: expect.stringContaining("has no canonical App identity"),
    });
    expect(task.attached).toEqual([]);
  });

  it("emits one Conversation update when human work changes", async () => {
    const mayDir = join(root, "may.app");
    mkdirSync(mayDir, { recursive: true });
    writeFileSync(
      join(mayDir, "app.js"),
      `export default {
        id: "may", version: 1, owner: "may",
        inputSchema: { type: "object", required: ["kind", "data"], properties: {
          kind: { const: "probe" }, data: { type: "object", required: ["value"], properties: { value: { type: "string" } } }
        } },
        task(input) { return { kind: "desired", intent: {
          id: "conversation/" + input.id, parentId: "may", outcome: "Answer", acceptance: ["Answered"], mode: "achieve"
        } }; },
        tasks: {}
      };\n`,
    );
    const bus = persistentBus();
    const task = capabilities(bus);
    let updates = 0;
    bus.subscribe((event) => {
      if (event.type !== "conversation.updated") return;
      updates += 1;
      return { accepted: true, by: "test-view" };
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "app.input.requested",
      source: "console",
      owner: "app:may",
      data: {
        appId: "may",
        requestId: "turn-1",
        conversationId: "may:primary",
        input: { kind: "probe", data: { value: "hello" } },
        source: { kind: "human", id: "message-1" },
        idempotencyKey: "turn:1",
      },
    });
    await waitUntil(() => runtime?.host.get("turn-1")?.waitingOn?.kind === "task");

    expect(updates).toBeGreaterThan(0);
    expect(runtime.host.get("turn-1")?.conversationId).toBe("may:primary");
  });
});

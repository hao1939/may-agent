import { fakeTaskAttacher } from "../../../test/fixtures/task-attachment.js";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppDependencyObservation } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../../lib/db.js";
import { applyDbSchema } from "../../lib/db/schema.js";
import { createAppEventAdmissionPlan, getAppEventAdmissionPlan } from "../core/state/app-event-admission-store.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import {
  EVENT_DEDUPLICATED,
  EVENT_DELIVERY_RESULT,
  EVENT_RECORD_ONLY,
  EVENT_REDELIVERY_REQUIRED,
  EVENT_ROW_ID,
  EventBus,
} from "../core/events/bus.js";
import { AppRegistry, type AppDefinitionSource } from "../core/apps/registry.js";
import { discoverAppDefinitions } from "../adapters/discovery/app-definitions.js";
import { conversationTaskId } from "../core/state/conversation-task-turns.js";
import { createAppInboxItem } from "../core/state/app-inbox-store.js";
import { claimNextAppInboxItem, waitAppInboxClaim } from "../../../test/fixtures/legacy-inbox.js";
import {
  createConversationTopic,
  linkConversationTopicTask,
  readConversationTopic,
} from "../core/state/conversations.js";

async function loadedRegistry(projectsRoot: string): Promise<AppRegistry> {
  const registry = new AppRegistry(discoverAppDefinitions(projectsRoot));
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
              properties: {
                value: { type: "string" },
                outcome: { type: "string" }
              }
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
        attachTask: fakeTaskAttacher(db, (input: any) => {
          const taskId = input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id;
          attached.push(taskId);
          return { taskId };
        }),
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

  it("routes typed follow-up input to one exact existing Task", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    task.observations.set("probe/current", {
      kind: "task",
      id: "probe/current",
      status: "waiting",
      summary: "Waiting for a human correction",
    });
    const attachments: Array<Record<string, unknown>> = [];
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      attachTask: fakeTaskAttacher(db, (input: any) => {
        attachments.push(input.attachment);
        return { taskId: input.attachment.taskId };
      }),
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "app.input.requested",
      source: "app-task:may",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        requestId: "feedback-1",
        targetTaskId: "probe/current",
        input: { kind: "probe", data: { value: "human correction" } },
        source: { kind: "app", id: "may" },
        idempotencyKey: "feedback:1",
      },
    });

    await waitUntil(() => attachments.length === 1);
    expect(attachments).toEqual([{ kind: "existing", taskId: "probe/current" }]);
    expect(runtime.host.get("feedback-1")).toMatchObject({
      targetTaskId: "probe/current",
      waitingOn: { kind: "task", id: "probe/current" },
    });
  });

  it("cannot publish a legacy worker result as a Conversation reply", async () => {
    mkdirSync(join(root, "may.app"), { recursive: true });
    writeFileSync(
      join(root, "may.app", "app.js"),
      `export default {
        id: "may", version: 1, agent: "may",
        inputSchema: { type: "object", required: ["kind", "data"], properties: {
          kind: { const: "message" }, data: { type: "object" }
        } },
        requests: { mode: "agent", conversationId: "may:primary" }
      };\n`,
    );
    createConversationTopic(db, {
      id: "topic-review",
      appId: "may",
      conversationId: "may:primary",
      title: "Review the design",
      openedBy: "human",
      originMessageId: "message-review",
      now: 1,
    });
    createAppInboxItem(db, {
      id: "turn-review",
      appId: "evaluation",
      source: { kind: "app", id: "may" },
      input: {
        kind: "probe",
        data: {
          value: "Review the design",
          conversationContext: {
            conversationId: "may:primary",
            topicId: "topic-review",
            followUpId: "human-turn-review",
          },
        },
      },
      idempotencyKey: "turn-review",
      now: 2,
    });
    const bus = persistentBus();
    const task = capabilities(bus);
    const messages: Array<Record<string, any>> = [];
    bus.subscribe((event) => {
      if (event.type === "conversation.message.created" && event.source === "app-task-follow-up") {
        messages.push(event as unknown as Record<string, any>);
      }
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      resolveRequest: async () => ({ summary: "unused", response: "unused", topic: { kind: "none" } }),
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "project.task.reconciled",
      source: "app-task:may:task-reconciler",
      owner: "agent:may",
      data: {
        project: "may",
        taskId: "conversation/follow-up",
        generation: 3,
        disposition: "waiting",
        summary: "The design review is running.",
        result: {
          conversation: {
            conversationId: "invented-conversation",
            topicId: "invented-topic",
            followUpId: "turn-review",
            text: "The design review is running in Evaluation Task 1234abcd.",
            taskRefs: [{ appId: "evaluation", taskId: "review/design" }],
          },
        },
      },
    });

    expect(messages).toEqual([]);
    expect(readConversationTopic(db, "may", "may:primary", "topic-review")?.taskRefs).toEqual([]);
  });

  it("continues an exact focused Task when a human replies to it", async () => {
    mkdirSync(join(root, "may.app"), { recursive: true });
    writeFileSync(
      join(root, "may.app", "app.js"),
      `export default {
        id: "may", version: 1, owner: "may",
        inputSchema: { type: "object", required: ["kind", "data"], properties: {
          kind: { const: "message" }, data: { type: "object", required: ["message"], properties: {
            message: { type: "string" }, context: { type: "object" }
          } }
        } },
        task(input) { return { kind: "desired", intent: {
          id: "conversation/" + input.id, parentId: "may", outcome: "Answer", acceptance: ["Answered"], mode: "achieve"
        } }; },
        tasks: {}
      };\n`,
    );
    const bus = persistentBus();
    const task = capabilities(bus);
    task.observations.set("decision/deploy", {
      kind: "task",
      id: "decision/deploy",
      status: "waiting",
      summary: "Waiting for a deployment decision",
    });
    const attachments: Array<Record<string, unknown>> = [];
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      attachTask: fakeTaskAttacher(db, (input: any) => {
        attachments.push(input.attachment);
        return { taskId: input.attachment.taskId };
      }),
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "conversation.message.created",
      source: "may-console",
      owner: "app:may",
      target: { appId: "may" },
      data: {
        appId: "may",
        conversationId: "may:primary",
        author: { kind: "human", id: "human-reply-1" },
        text: "approve it",
        context: { focusedTask: { appId: "may", taskId: "decision/deploy" } },
        metadata: { channel: "may-console" },
      },
    });

    await waitUntil(() => attachments.length === 1);
    expect(attachments).toEqual([{ kind: "existing", taskId: "decision/deploy" }]);
    const row = db.prepare("SELECT target_task_id FROM app_inbox_items WHERE source_id = 'human-reply-1'").get();
    expect(row).toEqual({ target_task_id: "decision/deploy" });
  });

  it("admits exact owner work without reviving retired wrapper announcements", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    const assignments: Array<Record<string, any>> = [];
    bus.subscribe((event) => {
      if (event.type === "conversation.message.created" && (event.data as any)?.metadata?.followTask) {
        assignments.push(event as unknown as Record<string, any>);
      }
    });

    createAppInboxItem(db, {
      id: "human-turn",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "may-console",
      source: { kind: "human", id: "human-message" },
      input: { kind: "message", data: { message: "Review the docs" } },
      now: 1,
    });
    const humanClaim = claimNextAppInboxItem(db, "may", "test", 10_000, 2)!;
    expect(waitAppInboxClaim(db, humanClaim, { kind: "task", id: "conversation/human-turn" }, { now: 3 })).toBe(true);
    createAppInboxItem(db, {
      id: "human-follow-up",
      appId: "may",
      targetTaskId: "conversation/human-turn",
      conversationId: "may:primary",
      conversationSequence: 2,
      channel: "may-console",
      source: { kind: "human", id: "human-message-2" },
      input: { kind: "message", data: { message: "Why is this still waiting?" } },
      now: 4,
    });
    const followUpClaim = claimNextAppInboxItem(db, "may", "test", 10_000, 5)!;
    expect(waitAppInboxClaim(db, followUpClaim, { kind: "task", id: "conversation/human-turn" }, { now: 6 })).toBe(
      true,
    );
    db.prepare(
      `INSERT INTO app_tasks(
         app_id, task_id, generation, resource_version, observed_generation, phase,
         lane, changed, ready, updated_at, resource_json
       ) VALUES ('may', 'conversation/human-turn', 1, 1, 1, 'waiting', 'human', 0, 0, 3, '{}')`,
    ).run();
    const condition = {
      metadata: { id: "app-request:owner-request", generation: 1, resourceVersion: 1 },
      spec: {
        type: "app.dependency.completed",
        subject: "id:owner-request",
        expected: { field: "status", equals: "done" },
      },
      status: { state: "unknown", observedGeneration: 0 },
    };
    db.prepare(
      `INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json)
       VALUES ('may', 'app-request:owner-request', 'unknown', ?)`,
    ).run(JSON.stringify(condition));
    db.prepare(
      `INSERT INTO app_task_condition_routes(app_id, condition_id, task_id)
       VALUES ('may', 'app-request:owner-request', 'conversation/human-turn')`,
    ).run();

    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      scanIntervalMs: 10_000,
    });
    bus.emit({
      type: "app.input.requested",
      source: "app-task:may",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        requestId: "owner-request",
        input: {
          kind: "probe",
          data: {
            value: "docs",
            outcome: "Review the approved documentation scope and return verified results.",
          },
        },
        source: { kind: "app", id: "may" },
        idempotencyKey: "owner-request",
      },
    });

    await waitUntil(() => runtime?.host.get("owner-request")?.waitingOn?.kind === "task");
    expect(task.attached).toEqual(["probe/owner-request"]);
    expect(assignments).toEqual([]);
  });

  it("returns from durable publication with the exact Task already admitted", async () => {
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
      type: "app.input.requested",
      source: "test",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        requestId: "deferred-request",
        input: { kind: "probe", data: { value: "deferred" } },
        source: { kind: "system", id: "test" },
      },
    });

    expect(runtime.host.get("deferred-request")).toMatchObject({ status: "handling" });
    expect(runtime.host.get("deferred-request")?.lease).toBeUndefined();
    expect(task.attached).toEqual(["probe/deferred-request"]);
    expect(runtime.host.get("deferred-request")?.waitingOn).toEqual({
      kind: "task",
      id: "probe/deferred-request",
    });
  });

  it("admits live input directly while deferring recovery until explicitly started", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    createAppInboxItem(db, {
      id: "recovered-request",
      appId: "evaluation",
      source: { kind: "system", id: "previous-runtime" },
      input: { kind: "probe", data: { value: "recovered" } },
      now: 1,
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      scanIntervalMs: 10_000,
      deferStart: true,
    });

    bus.emit({
      type: "app.input.requested",
      source: "test",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        requestId: "live-request",
        input: { kind: "probe", data: { value: "live" } },
        source: { kind: "system", id: "test" },
      },
    });
    await Bun.sleep(20);
    expect(task.attached).toEqual(["probe/live-request"]);
    expect(runtime.host.get("recovered-request")?.status).toBe("pending");
    expect(runtime.host.get("live-request")?.status).toBe("handling");

    await runtime.start();
    await waitUntil(() => task.attached.length === 2);
    expect(task.attached.sort()).toEqual(["probe/live-request", "probe/recovered-request"]);
  });

  it("admits a burst of inputs synchronously to their exact Tasks", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      scanIntervalMs: 10_000,
    });
    for (const requestId of ["one", "two", "three"]) {
      bus.emit({
        type: "app.input.requested",
        source: "test",
        owner: "app:evaluation",
        data: {
          appId: "evaluation",
          requestId,
          source: { kind: "system", id: "test" },
          input: { kind: "probe", data: { value: requestId } },
        },
      });
    }
    expect(task.attached).toEqual(["probe/one", "probe/two", "probe/three"]);
    for (const id of ["one", "two", "three"]) {
      expect(runtime.host.get(id)?.waitingOn).toEqual({ kind: "task", id: `probe/${id}` });
      expect(runtime.host.get(id)?.lease).toBeUndefined();
    }
  });

  it("routes exact linked Task changes without turning notification text into a reply", async () => {
    const bus = persistentBus();
    const task = capabilities(bus);
    const messages: unknown[] = [];
    const admitted: unknown[] = [];
    const changes: unknown[] = [];
    bus.subscribe((event) => {
      if (event.type === "conversation.message.created") messages.push(event.data);
      if (event.type === "conversation.task.changed") changes.push(event.data);
    });
    createConversationTopic(db, {
      id: "topic",
      appId: "evaluation",
      conversationId: "chat",
      title: "Review",
      openedBy: "human",
      originMessageId: "original",
    });
    linkConversationTopicTask(db, "topic", "evaluation", "probe/current");
    const executionTaskId = conversationTaskId("evaluation", "chat");
    linkConversationTopicTask(db, "topic", "evaluation", executionTaskId);
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      deferStart: true,
      admitConversationChange(input) {
        admitted.push(input);
        return { taskId: executionTaskId, created: true };
      },
    });
    const publish = (taskId: string, attemptId?: string) =>
      bus.emit({
        type: "project.task.reconciled",
        source: "fixture",
        data: {
          project: "evaluation",
          taskId,
          generation: 1,
          disposition: "waiting",
          attemptId,
          summary: "Untrusted notification text",
        },
      });
    // A waiting/progress notification without an outcome cannot launch a review.
    publish("probe/current");
    expect(admitted).toEqual([]);
    publish("probe/current", "accepted-attempt");
    expect(admitted).toEqual([
      {
        appId: "evaluation",
        conversationId: "chat",
        topicId: "topic",
        taskAppId: "evaluation",
        taskId: "probe/current",
        attemptId: "accepted-attempt",
      },
    ]);
    expect(changes).toEqual([
      {
        appId: "evaluation",
        conversationId: "chat",
        topicId: "topic",
        taskRef: { appId: "evaluation", taskId: "probe/current" },
        attemptId: "accepted-attempt",
      },
    ]);
    publish(executionTaskId, "own-attempt");
    expect(admitted).toHaveLength(1);
    bus.emit({
      type: "app.task.cancelled",
      source: "fixture",
      data: { appId: "evaluation", taskId: "probe/current", generation: 1 },
    });
    expect(admitted.at(-1)).toEqual({
      appId: "evaluation",
      conversationId: "chat",
      topicId: "topic",
      taskAppId: "evaluation",
      taskId: "probe/current",
      closedGeneration: 1,
    });
    // Presentation and judgment happen only when the real Task accepts a reply.
    expect(messages).toEqual([]);
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

  it("wakes only the App waiting on an exact dependency", async () => {
    mkdirSync(join(root, "other.app"), { recursive: true });
    writeFileSync(
      join(root, "other.app", "app.js"),
      `export default {
        id: "other", version: 1, owner: "other",
        inputSchema: {
          type: "object", additionalProperties: false, required: ["kind", "data"],
          properties: {
            kind: { const: "probe" },
            data: { type: "object", additionalProperties: false, required: ["value"], properties: { value: { type: "string" } } }
          }
        },
        task() { return { kind: "desired", intent: {
          id: "probe/waiting-request", parentId: "other", outcome: "Other work", acceptance: ["Done"], mode: "achieve"
        } }; },
        tasks: {}
      };\n`,
    );
    const bus = persistentBus();
    const task = capabilities(bus);
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      readDependency: async ({ appId, dependency }) => appId === "other" ? { ...dependency, status: "pending" } : task.observations.get(dependency.id) ?? null,
      scanIntervalMs: 10_000,
    });
    bus.emit({
      type: "app.input.requested",
      source: "test",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        requestId: "waiting-request",
        input: { kind: "probe", data: { value: "waiting" } },
        source: { kind: "system", id: "test" },
        idempotencyKey: "waiting:1",
      },
    });
    await waitUntil(() => runtime?.host.get("waiting-request")?.waitingOn?.kind === "task");
    runtime.host.admit({
      id: "unrelated-request",
      appId: "other",
      source: { kind: "system", id: "test" },
      input: { kind: "probe", data: { value: "unrelated" } },
    });

    expect(runtime.host.get("unrelated-request")?.waitingOn).toEqual({
      kind: "task",
      id: "probe/waiting-request",
    });
    // The real reader scopes equal Task IDs by App directory.
    task.observations.set("probe/waiting-request", {
      kind: "task",
      id: "probe/waiting-request",
      status: "done",
      summary: "Dependency done",
    });

    bus.emit({
      type: "app.dependency.updated",
      source: "test-task",
      owner: "app:evaluation",
      data: { kind: "task", id: "probe/waiting-request", appId: "evaluation" },
    });
    await waitUntil(() => runtime?.host.get("waiting-request")?.status === "done");
    await Bun.sleep(25);

    expect(runtime.host.get("unrelated-request")?.status).toBe("handling");
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

  it("keeps unrelated event storms independent of the number of loaded Task Apps", async () => {
    for (let index = 0; index < 64; index += 1) {
      const appId = `route-${index}`;
      mkdirSync(join(root, `${appId}.app`), { recursive: true });
      writeFileSync(
        join(root, `${appId}.app`, "app.js"),
        `export default {
          id: ${JSON.stringify(appId)}, version: 1, owner: ${JSON.stringify(appId)},
          inputSchema: { type: "object" },
          tasks: {
            subscriptions: [${JSON.stringify(`route.event.${index}`)}],
            resolve(event) { return { id: ${JSON.stringify(`${appId}/task`)}, parentId: ${JSON.stringify(appId)}, outcome: event.type, acceptance: ["done"], mode: "achieve" }; }
          }
        };\n`,
      );
    }
    const bus = persistentBus();
    let exactPreviews = 0;
    let bulkPreviews = 0;
    let admissions = 0;
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      previewTaskEvent: () => {
        exactPreviews += 1;
        return [];
      },
      previewTaskEventRoutes: () => {
        bulkPreviews += 1;
        return [];
      },
      admitTaskEvent: () => {
        admissions += 1;
        return { accepted: true, by: "test-task", route: "direct" };
      },
      scanIntervalMs: 10_000,
    });

    const startedAt = performance.now();
    for (let index = 0; index < 2_000; index += 1) {
      bus.emit({ type: "tool_result", source: "storm", data: { index } });
    }
    const elapsedMs = performance.now() - startedAt;

    expect(exactPreviews).toBe(0);
    expect(bulkPreviews).toBe(2_000);
    expect(admissions).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_event_admission_plans").get()).toEqual({ count: 0 });
    expect(elapsedMs).toBeLessThan(1_500);
  });

  it("runs only the Task resolver indexed for an event type", async () => {
    for (const [appId, eventType, throws] of [
      ["matching", "route.matched", false],
      ["irrelevant", "route.other", true],
    ] as const) {
      mkdirSync(join(root, `${appId}.app`), { recursive: true });
      writeFileSync(
        join(root, `${appId}.app`, "app.js"),
        `export default {
          id: ${JSON.stringify(appId)}, version: 1, owner: ${JSON.stringify(appId)},
          inputSchema: { type: "object" },
          tasks: {
            subscriptions: [${JSON.stringify(eventType)}],
            resolve(event) {
              ${throws ? 'throw new Error("irrelevant resolver ran")' : ""};
              return { id: ${JSON.stringify(`${appId}/task`)}, parentId: ${JSON.stringify(appId)}, outcome: event.type, acceptance: ["done"], mode: "achieve" };
            }
          }
        };\n`,
      );
    }
    const bus = persistentBus();
    const admitted: string[] = [];
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      previewTaskEventRoutes: () => [],
      admitTaskEvent: ({ appId }) => {
        admitted.push(appId);
        return { accepted: true, by: "test-task", route: "direct" };
      },
      scanIntervalMs: 10_000,
    });

    bus.emit({ type: "route.matched", source: "test", data: {} });
    await waitUntil(() => admitted.length === 1);
    expect(admitted).toEqual(["matching"]);
  });

  it("publishes replacement Task route indexes with the registry generation", async () => {
    const appDir = join(root, "routing.app");
    mkdirSync(appDir, { recursive: true });
    const writeRoute = (eventType: string) =>
      writeFileSync(
        join(appDir, "app.js"),
        `export default {
          id: "routing", version: 1, owner: "routing",
          inputSchema: { type: "object" },
          tasks: {
            subscriptions: [${JSON.stringify(eventType)}],
            resolve(event) { return { id: "routing/task", parentId: "routing", outcome: event.type, acceptance: ["done"], mode: "achieve" }; }
          }
        };\n`,
      );
    writeRoute("route.old");
    const bus = persistentBus();
    const admitted: string[] = [];
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      previewTaskEventRoutes: () => [],
      admitTaskEvent: ({ event }) => {
        admitted.push(event.type);
        return { accepted: true, by: "test-task", route: "direct" };
      },
      scanIntervalMs: 10_000,
    });
    bus.emit({ type: "route.old", source: "test", data: {} });
    await waitUntil(() => admitted.length === 1);

    writeRoute("route.new");
    await runtime.reload();
    bus.emit({ type: "route.old", source: "test", data: {} });
    bus.emit({ type: "route.new", source: "test", data: {} });
    await waitUntil(() => admitted.length === 2);
    expect(admitted).toEqual(["route.old", "route.new"]);
  });

  it.each(["changed", "removed"])("restores a %s schedule across a due slot", async (scheduleChange) => {
    const source =
      (name: string): AppDefinitionSource =>
      async () => [
        {
          appDir: join(root, "routing.app"),
          definition: {
            id: "routing",
            version: 1,
            agent: "routing",
            inputSchema: { type: "object" },
            tasks: {
              subscriptions: [`route.${name}`],
              resolve: () => ({ id: "routing/task", outcome: name, acceptance: ["done"] }),
            },
            schedules:
              name === "rejected" && scheduleChange === "removed"
                ? []
                : [{ id: "tick", intervalMs: 1000, event: { type: `tick.${name}`, data: {} } }],
          },
        },
      ];
    const registry = new AppRegistry(source("initial"));
    await registry.reload();
    const bus = persistentBus();
    const admitted: string[] = [];
    const ticks: string[] = [];
    bus.subscribe((event) => {
      if (event.type.startsWith("tick.")) ticks.push(event.type);
    });
    let currentTime = 1_000;
    runtime = await startAppInboxRuntime({
      registry,
      db,
      bus,
      previewTaskEventRoutes: () => [],
      admitTaskEvent: ({ event }) => {
        admitted.push(event.type);
        return { accepted: true, by: "test-task", route: "direct" };
      },
      scanIntervalMs: 60_000,
      now: () => currentTime,
    });
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const first = runtime.reload(async ({ commit }) => {
      started.resolve();
      await release.promise;
      commit();
    }, source("accepted"));
    await started.promise;
    const second = runtime.reload(async ({ commit }) => {
      currentTime = 2_000;
      commit();
      throw new Error("publication failed");
    }, source("rejected"));
    const rejected = second.catch((error: unknown) => error);
    release.resolve();
    await first;
    expect(await rejected).toEqual(new Error("publication failed"));
    expect(registry.snapshot().generation).toBe(2);

    // Invalid discovery must not alter the retained consumers either.
    await expect(
      runtime.reload(undefined, async () => [
        {
          appDir: join(root, "routing.app"),
          definition: { id: "broken" },
        },
      ]),
    ).rejects.toThrow("version 1");
    for (const name of ["initial", "accepted", "rejected"]) {
      bus.emit({ type: `route.${name}`, source: "test", data: {} });
    }
    await waitUntil(() => admitted.length > 0);
    expect(admitted).toEqual(["route.accepted"]);
    runtime.scanNow();
    runtime.scanNow();
    expect(ticks).toEqual(["tick.accepted"]);
  });

  it("records broad App routing before running Task admission asynchronously", async () => {
    const bus = persistentBus();
    let admitted = 0;
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      admitTaskEvent: () => {
        admitted += 1;
        return { accepted: true, by: "test-task", route: "direct" };
      },
      previewTaskEventRoutes: ({ event }) =>
        event.type === "provider.changed" ? [{ appId: "evaluation", taskIds: ["waiting-task"] }] : [],
      scanIntervalMs: 10_000,
    });

    const emitted = bus.emit({
      type: "provider.changed",
      source: "provider",
      owner: "app:evaluation",
      data: { project: "evaluation", value: "changed" },
    });

    expect(admitted).toBe(0);
    expect(emitted[EVENT_DELIVERY_RESULT]).toMatchObject({ accepted: true, route: "direct" });
    expect(db.prepare("SELECT status FROM app_event_admission_plans WHERE event_id = 1").get()).toEqual({
      status: "pending",
    });
    await waitUntil(() => admitted === 1);
    expect(db.prepare("SELECT status FROM app_event_admission_plans WHERE event_id = 1").get()).toEqual({
      status: "completed",
    });
  });

  it("admits an exact Task wake directly even when an admission worker is configured", async () => {
    const bus = persistentBus();
    let localAdmissions = 0;
    const workerAdmissions: string[] = [];
    const wakes: string[] = [];
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      admitTaskEvent: () => {
        localAdmissions += 1;
        return { accepted: true, by: "unexpected-local-task", route: "direct" };
      },
      createTaskAdmissionWorker: () => ({
        async dispatch(command) {
          workerAdmissions.push(command.routeId);
          return { taskIds: [command.routeId], supersededSessionIds: [] };
        },
        close() {},
      }),
      wakeAdmittedTasks: ({ appId, taskIds }) => wakes.push(`${appId}:${taskIds.join(",")}`),
      previewTaskEventRoutes: () => [],
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "project.task.tick",
      source: "provider",
      owner: "app:evaluation",
      target: { appId: "evaluation", taskId: "existing-task" },
      data: { project: "evaluation" },
    });

    expect(localAdmissions).toBe(1);
    expect(workerAdmissions).toEqual([]);
    expect(wakes).toEqual([]);
    expect(getAppEventAdmissionPlan(db, 1)?.status).toBe("completed");
  });

  it("admits an exact wake while unrelated broad admission is unanswered", async () => {
    const bus = persistentBus();
    let workerCalls = 0;
    const exactWakes: string[] = [];
    let release = () => {};
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      admitTaskEvent: ({ targetedTaskId }) => {
        if (targetedTaskId) exactWakes.push(targetedTaskId);
        return { accepted: true, by: "test-task", route: "direct" };
      },
      previewTaskEventRoutes: ({ event }) =>
        event.type === "sample.changed" ? [{ appId: "evaluation", taskIds: ["child"] }] : [],
      createTaskAdmissionWorker: () => ({
        dispatch: () => {
          workerCalls += 1;
          return new Promise((resolve) => {
            release = () => resolve({ taskIds: ["child"], supersededSessionIds: [] });
          });
        },
        close: () => release(),
      }),
      scanIntervalMs: 10_000,
    });
    bus.emit({ type: "sample.changed", source: "test", data: {} });
    await waitUntil(() => workerCalls === 1);
    bus.emit({
      type: "project.task.tick",
      source: "test",
      target: { appId: "evaluation", taskId: "parent" },
      data: {},
    });
    expect(exactWakes).toEqual(["parent"]);
    expect(getAppEventAdmissionPlan(db, 2)?.status).toBe("completed");
    release();
    await waitUntil(() => getAppEventAdmissionPlan(db, 1)?.status === "completed");
  });

  it("keeps failed asynchronous admission durable and retries it through bounded recovery", async () => {
    const bus = persistentBus();
    let attempts = 0;
    let available = false;
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      admitTaskEvent: () => {
        attempts += 1;
        if (!available) throw new Error("temporary admission failure");
        return { accepted: true, by: "test-task", route: "direct" };
      },
      previewTaskEventRoutes: ({ event }) =>
        event.type === "provider.changed" ? [{ appId: "evaluation", taskIds: ["waiting-task"] }] : [],
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "provider.changed",
      source: "provider",
      owner: "app:evaluation",
      data: { project: "evaluation", value: "changed" },
    });
    db.prepare(
      `INSERT INTO events (id, event_type, source, owner, project_id, data, timestamp, delivery_status)
       VALUES (1, 'provider.changed', 'provider', 'app:evaluation', 'evaluation', ?, ?, 'accepted')`,
    ).run(JSON.stringify({ project: "evaluation", value: "changed" }), Date.now());

    await waitUntil(() => Boolean(getAppEventAdmissionPlan(db, 1)?.commands[0]?.lastError));
    expect(attempts).toBe(1);
    expect(getAppEventAdmissionPlan(db, 1)).toMatchObject({
      status: "pending",
      commands: [expect.objectContaining({ status: "pending", lastError: "temporary admission failure" })],
    });
    await Bun.sleep(20);
    expect(attempts).toBe(1);

    available = true;
    await runtime.reload();
    await waitUntil(() => getAppEventAdmissionPlan(db, 1)?.status === "completed");
    expect(attempts).toBe(2);
  });

  it("stops scheduled asynchronous admission when the runtime closes", async () => {
    const bus = persistentBus();
    let admitted = 0;
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      admitTaskEvent: () => {
        admitted += 1;
        return { accepted: true, by: "test-task", route: "direct" };
      },
      previewTaskEventRoutes: ({ event }) =>
        event.type === "provider.changed" ? [{ appId: "evaluation", taskIds: ["waiting-task"] }] : [],
      scanIntervalMs: 10_000,
    });

    bus.emit({
      type: "provider.changed",
      source: "provider",
      owner: "app:evaluation",
      data: { project: "evaluation", value: "changed" },
    });
    runtime.close();
    await Bun.sleep(20);

    expect(admitted).toBe(0);
    expect(getAppEventAdmissionPlan(db, 1)?.status).toBe("pending");
  });

  it("resumes a frozen plan after restart and does not admit it twice", async () => {
    const eventId = Number(
      db
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp, delivery_status)
           VALUES ('provider.changed', 'provider', 'app:evaluation', ?, ?, 'accepted')`,
        )
        .run(JSON.stringify({ project: "evaluation", value: "restart" }), Date.now()).lastInsertRowid,
    );
    const registry = await loadedRegistry(root);
    const snapshot = registry.snapshot();
    createAppEventAdmissionPlan(db, {
      eventId,
      registrySnapshotId: snapshot.id,
      registryGeneration: snapshot.generation,
      routes: [
        {
          appId: "evaluation",
          kind: "task",
          routeId: "restart-task",
          intent: null,
          conditionTaskIds: ["restart-task"],
        },
      ],
    });
    let admitted = 0;
    const options = {
      registry,
      db,
      admitTaskEvent: ({ event }: any) => {
        admitted += 1;
        expect(Number(event[EVENT_ROW_ID])).toBe(eventId);
        expect(event.data).toMatchObject({ project: "evaluation", value: "restart" });
        return { accepted: true as const, by: "test-task", route: "direct" as const };
      },
      previewTaskEvent: () => [],
      scanIntervalMs: 10_000,
    };

    const receipts: number[] = [];
    const firstBus = persistentBus();
    firstBus.setDeliveryRecorder((event) => {
      const id = Number(event[EVENT_ROW_ID]);
      if (Number.isSafeInteger(id)) receipts.push(id);
    });
    runtime = await startAppInboxRuntime({ ...options, bus: firstBus });
    await waitUntil(() => getAppEventAdmissionPlan(db, eventId)?.status === "completed");
    expect(admitted).toBe(1);
    expect(receipts).toEqual([eventId]);
    runtime.close();
    const secondBus = persistentBus();
    secondBus.setDeliveryRecorder((event) => {
      const id = Number(event[EVENT_ROW_ID]);
      if (Number.isSafeInteger(id)) receipts.push(id);
    });
    runtime = await startAppInboxRuntime({ ...options, bus: secondBus });
    await Bun.sleep(20);
    expect(admitted).toBe(1);
    expect(receipts).toEqual([eventId]);
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

    await Bun.sleep(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      originalEventType: "trigger.metrics-snapshot",
      error: expect.stringContaining("has no canonical App identity"),
    });
    expect(task.attached).toEqual([]);
  });

  it("keeps an event unaccepted when its exact Task link is unavailable", async () => {
    const bus = persistentBus();
    const failures: Array<Record<string, unknown>> = [];
    let admissionAttempts = 0;
    bus.subscribe((event) => {
      if (event.type === "subscriber.failed") failures.push(event.data as Record<string, unknown>);
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      admitTaskEvent: () => {
        admissionAttempts += 1;
        return undefined;
      },
      previewTaskEvent: () => [],
      scanIntervalMs: 5,
    });

    const emitted = bus.emit({
      type: "project.task.tick",
      source: "test",
      owner: "app:evaluation",
      target: { appId: "evaluation", taskId: "missing-task" },
      data: {},
    });

    expect(emitted[EVENT_DELIVERY_RESULT]).toBeUndefined();
    await Bun.sleep(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      originalEventType: "project.task.tick",
      error: expect.stringContaining("did not durably admit frozen missing-task"),
    });
    expect(getAppEventAdmissionPlan(db, 1)).toMatchObject({
      status: "pending",
      commands: [
        expect.objectContaining({
          appId: "evaluation",
          targetedTaskId: "missing-task",
          status: "pending",
        }),
      ],
    });
    expect(admissionAttempts).toBe(1);
    await Bun.sleep(30);
    expect(admissionAttempts).toBe(1);
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
    const statuses: AgentEvent[] = [];
    bus.subscribe((event) => {
      if (
        event.type === "conversation.message.created" &&
        (event.data as Record<string, any>)?.author?.kind === "agent"
      ) {
        statuses.push(event);
      }
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
    createAppInboxItem(db, {
      id: "turn-2",
      appId: "may",
      targetTaskId: "conversation/turn-1",
      conversationId: "may:primary",
      conversationSequence: 2,
      channel: "may-console",
      source: { kind: "human", id: "message-2" },
      input: { kind: "probe", data: { value: "why is it waiting?" } },
      now: 2,
    });
    const followUpClaim = claimNextAppInboxItem(db, "may", "test", 10_000, 3)!;
    expect(waitAppInboxClaim(db, followUpClaim, { kind: "task", id: "conversation/turn-1" }, { now: 4 })).toBe(true);

    bus.emit({
      type: "project.task.reconciled",
      source: "app-task:may",
      owner: "agent:may",
      target: { appId: "may" },
      data: {
        project: "may",
        taskId: "conversation/turn-1",
        generation: 1,
        attemptId: "attempt-1",
        disposition: "waiting",
        summary: "Gym is checking the reported behavior.",
      },
    });
    await waitUntil(() => updates > 0);
    bus.emit({
      type: "project.task.reconciled",
      source: "app-task:may",
      owner: "agent:may",
      target: { appId: "may" },
      data: {
        project: "may",
        taskId: "conversation/turn-1",
        generation: 1,
        attemptId: "attempt-2",
        disposition: "waiting",
        summary: "Gym is checking the reported behavior.",
      },
    });
    await Bun.sleep(20);

    expect(updates).toBeGreaterThan(0);
    expect(runtime.host.get("turn-1")?.conversationId).toBe("may:primary");
    expect(statuses).toEqual([]);
  });

  it("disables only schedule publication, retaining event admission and observers across reload", async () => {
    const appPath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      appPath,
      readFileSync(appPath, "utf8").replace(
        "subscriptions: [{",
        `
      schedules: [
        { id: "fact", intervalMs: 1000, event: { type: "sample.scheduled", data: {} } },
        { id: "input", intervalMs: 1000, input: { kind: "probe", data: { value: "scheduled" } } }
      ],
      observers: [{
        id: "observer", intervalMs: 1000,
        async run() { return [{ type: "sample.observed", data: {} }]; }
      }],
      subscriptions: [{`,
      ),
    );
    const bus = persistentBus();
    const task = capabilities(bus);
    const observed: string[] = [];
    bus.subscribe((event) => {
      observed.push(event.type);
    });
    let currentTime = 1000;
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      schedulesEnabled: false,
      scanIntervalMs: 60_000,
      now: () => currentTime,
      observerContext: () => ({}) as never,
    });
    for (let cycle = 0; cycle < 2; cycle++) {
      if (cycle) await runtime.reload();
      currentTime += 1000;
      runtime.scanNow();
      bus.emit({
        type: "provider.changed",
        source: "test",
        owner: "app:evaluation",
        target: { project: "evaluation" },
        data: { project: "evaluation", value: "external-" + cycle },
      } as any);
      await waitUntil(() => task.attached.length === cycle + 1);
    }
    expect(observed).toContain("sample.observed");
    expect(observed).not.toContain("sample.scheduled");
    expect(observed).not.toContain("app.input.requested");
  });

  it("keeps schedule and observer cadence alive when request recovery reads fail", async () => {
    const appPath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      appPath,
      readFileSync(appPath, "utf8").replace(
        "subscriptions: [{",
        `
      schedules: Array.from({ length: 32 }, (_, i) => ({
        id: "fact-" + i, intervalMs: 1000,
        event: { type: "sample.scheduled", data: { index: i } }
      })),
      observers: [{ id: "observer", intervalMs: 1000,
        async run() { return [{ type: "sample.observed", data: {} }]; }
      }], subscriptions: [{`,
      ),
    );
    const bus = persistentBus();
    const task = capabilities(bus);
    const observed: string[] = [];
    const failures: AgentEvent[] = [];
    bus.subscribe((event) => {
      observed.push(event.type);
      if (event.type === "handler.failed") failures.push(event);
    });
    let now = 1000;
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      now: () => now,
      scanIntervalMs: 5,
      deferStart: true,
      observerContext: () => ({}) as never,
    });
    const readiness = spyOn(runtime.host, "recoverAdmissions").mockImplementation(async () => {
      throw new Error("fixture readiness read unavailable");
    });
    try {
      now = 2000;
      await runtime.start();
      await waitUntil(
        () =>
          failures.length > 0 &&
          observed.includes("sample.observed") &&
          observed.filter((type) => type === "sample.scheduled").length === 32,
      );
      // Subsequent scans at the same slot cannot multiply publications.
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({
        type: "handler.failed",
        source: "app-inbox",
        data: { stage: "dependency-recovery", error: "fixture readiness read unavailable", disposition: "recovery-pending" },
      });
      expect(observed.filter((type) => type === "sample.scheduled")).toHaveLength(32);
      expect(observed.filter((type) => type === "sample.observed")).toHaveLength(1);
      runtime.close();
      const count = observed.length;
      now = 3000;
      await Bun.sleep(20);
      expect(observed).toHaveLength(count);
    } finally {
      readiness.mockRestore();
    }
  });

  it("publishes event schedules as record-only facts", async () => {
    const appPath = join(root, "evaluation.app", "app.js");
    const source = readFileSync(appPath, "utf8");
    writeFileSync(
      appPath,
      source.replace(
        "subscriptions: [{",
        `schedules: [{
          id: "sample-fact",
          intervalMs: 1000,
          event: { type: "sample.observed", data: { value: 1 } }
        }],
        subscriptions: [{`,
      ),
    );
    let currentTime = 1_000;
    const bus = persistentBus();
    const observed: Array<{ type: string; recordOnly: boolean }> = [];
    bus.subscribe((event) => {
      if (event.type !== "sample.observed") return;
      observed.push({
        type: event.type,
        recordOnly: (event as AgentEvent & { [EVENT_RECORD_ONLY]?: boolean })[EVENT_RECORD_ONLY] === true,
      });
    });
    const task = capabilities(bus);
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...task.options,
      now: () => currentTime,
      scanIntervalMs: 10_000,
    });

    currentTime = 2_000;
    runtime.scanNow();

    expect(observed).toEqual([{ type: "sample.observed", recordOnly: true }]);
  });

  it("contains schedule persistence failure and publishes only the latest slot after recovery", async () => {
    const appPath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      appPath,
      readFileSync(appPath, "utf8").replace(
        "subscriptions: [{",
        `schedules: [
      { id: "contended", intervalMs: 1000, event: { type: "sample.contended", data: {} } },
      { id: "healthy", intervalMs: 1000, event: { type: "sample.healthy", data: {} } }
    ], subscriptions: [{`,
      ),
    );
    let currentTime = 1_000,
      locked = true,
      nextId = 1;
    const bus = new EventBus();
    const observed: Array<{ type: string; key: string }> = [];
    bus.setPersistenceSubscriber((event) => {
      if (event.type === "sample.contended" && locked) throw new Error("database is locked");
      Object.defineProperty(event, EVENT_ROW_ID, { value: nextId++, configurable: true });
    });
    bus.subscribe((event) => {
      if (event.type.startsWith("sample."))
        observed.push({ type: event.type, key: (event.data as any).idempotencyKey });
    });
    runtime = await startAppInboxRuntime({
      registry: await loadedRegistry(root),
      db,
      bus,
      ...capabilities(bus).options,
      now: () => currentTime,
      scanIntervalMs: 10_000,
    });
    currentTime = 2_000;
    expect(() => runtime!.scanNow()).not.toThrow();
    expect(observed.map((event) => event.type)).toEqual(["sample.healthy"]);
    locked = false;
    currentTime = 5_000;
    runtime.scanNow();
    runtime.scanNow();
    expect(observed.filter((event) => event.type === "sample.contended")).toEqual([
      { type: "sample.contended", key: "schedule:evaluation:contended:5" },
    ]);
    expect(observed.filter((event) => event.type === "sample.healthy")).toHaveLength(2);
  });
});

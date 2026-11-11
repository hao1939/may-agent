import { Type, defineApp } from "@may-agent/sdk";
import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../lib/db-writer.js";
import { stateTransaction } from "../../lib/db/transaction.js";
import { closeDb, getDb } from "../../lib/requests.js";
import { EVENT_ROW_ID, EventBus } from "../core/events/bus.js";
import { createAppEventAdmissionPlan, getAppEventAdmissionPlan } from "../core/state/app-event-admission-store.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { applyConversationRequestUpdates, linkConversationRequestInputs } from "../core/state/conversation-requests.js";
import { admitConversationTaskInput } from "../core/state/conversation-task-turns.js";
import { appTaskContext, claimObservedAppTask, completeAppTask, failAppTaskAttempt } from "../core/tasks/app-task-reconciler.js";
import { prepareAppTaskRuntimeDescriptors } from "../core/tasks/runtime-definition.js";
import { convertStoppedTaskContracts } from "./task-contract-conversion.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { force: true, recursive: true });
  }
});
function fixture(value = "original") {
  const root = mkdtempSync(join(tmpdir(), "may-task-contract-conversion-"));
  roots.push(root);
  const db = getDb(root);
  const app = defineApp({
    id: "sample",
    agent: "worker",
    version: 1,
    conversation: { mode: "task" },
    tasks: {},
    inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ text: Type.String() }) }),
    subscriptions: [
      { id: "scan", event: { type: "sample.scan", project: "sample" },
        toInput: (event) => ({ kind: "message", data: { text: String(event.data.value) } }) },
    ],
  });
  const store = AppTaskResourceStore.fromDb(db, app.id);
  store.bootstrapSnapshot(
    { project: app.id, root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
    "seed",
  );
  const config = appTaskContext({ appDir: root, projectDir: root, agent: app.agent, resourceStore: store });
  const item = admitConversationTaskInput(config, {
    appId: app.id,
    id: "ask",
    conversationId: "discussion",
    source: { kind: "human", id: "original" },
    input: { kind: "message", data: { text: "Keep the full promise" } },
    intent: {
      executor: "agent",
      parentId: "root",
      outcome: "Answer the human",
      acceptance: ["Preserve the accepted scope"],
    },
  });
  // Retained state was authored by the previous Host; current admission must
  // reject the retired executor name instead of being used to create it here.
  db.prepare(`UPDATE app_tasks SET resource_json = json_set(resource_json, '$.spec.executor', 'conversation')
    WHERE app_id = ? AND task_id = ?`).run(app.id, item.taskId);
  applyConversationRequestUpdates(db, {
    appId: app.id,
    conversationId: "discussion",
    updateKey: "fixture",
    now: 1,
    updates: [{ id: "promise", expectedRevision: 0, scope: "Keep both requirements", disposition: "open" }],
  });
  linkConversationRequestInputs(db, app.id, "discussion", "promise", [item.item.id]);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  const event = bus.emit({ type: "sample.scan", source: "fixture", owner: "app:sample",
    data: { project: app.id, value } });
  const eventId = event[EVENT_ROW_ID]!;
  createAppEventAdmissionPlan(db, {
    eventId,
    registrySnapshotId: "previous",
    registryGeneration: 1,
    routes: [
      {
        kind: "unresolved",
        appId: app.id,
        routeId: "sample.scan",
        resolveTask: true,
        subscriptionIds: [],
        conditionTaskIds: [item.taskId],
      },
    ],
  });
  const convert = (apps = [app]) => convertStoppedTaskContracts({ db, persistDir: root, apps });
  const snapshot = () =>
    Object.fromEntries(
      [
        "app_tasks",
        "app_task_attempts",
        "app_task_admissions",
        "app_inbox_items",
        "conversation_requests",
        "conversation_request_inputs",
        "app_event_admission_commands",
      ].map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all()]),
    );
  return { root, db, app, store, config, item, eventId, convert, snapshot };
}

test("offline conversion changes execution format once, retaining exact obligations, input, Request and accepted history", () => {
  const f = fixture();
  const claim = claimObservedAppTask(f.config, {
    taskId: f.item.taskId,
    appAgent: f.app.agent,
    handler: "executor:conversation",
  });
  if (claim.kind !== "claimed") throw new Error("Expected claim");
  completeAppTask(f.config, claim, {
    summary: "Prior accepted evidence",
    response: "Historical reply",
    facts: ["original fact"],
  });
  const before = f.snapshot();
  const task = f.store.readTask(f.item.taskId)!;
  expect(f.convert()).toEqual({ tasks: 1, routes: 1 });
  expect(f.store.readTask(f.item.taskId)).toEqual({
    ...task,
    metadata: { ...task.metadata, resourceVersion: task.metadata.resourceVersion + 1 },
    spec: { ...task.spec, executor: "agent" },
  });
  const after = f.snapshot();
  for (const table of [
    "app_task_attempts",
    "app_task_admissions",
    "app_inbox_items",
    "conversation_requests",
    "conversation_request_inputs",
  ])
    expect(after[table]).toEqual(before[table]);
  expect(getAppEventAdmissionPlan(f.db, f.eventId)?.commands[0]).toMatchObject({
    kind: "inbox",
    routeId: "scan",
    status: "pending",
    input: { kind: "message", data: { text: "original" } },
    conditionTaskIds: [f.item.taskId],
  });
  closeDb(f.root);
  const reopened = getDb(f.root);
  expect(convertStoppedTaskContracts({ db: reopened, persistDir: f.root, apps: [f.app] })).toEqual({
    tasks: 0,
    routes: 0,
  });
});

test("dry run and any unmappable or ambiguous route roll back the entire format conversion", () => {
  const f = fixture();
  const before = f.snapshot();
  const rollback = Symbol("dry run");
  expect(() =>
    stateTransaction(f.db, () => {
      f.convert();
      throw rollback;
    }),
  ).toThrow();
  expect(f.snapshot()).toEqual(before);
  expect(() => f.convert([{ ...f.app, subscriptions: [] }])).toThrow("No current subscription maps");
  expect(f.snapshot()).toEqual(before);
  expect(() =>
    f.convert([
      { ...f.app, subscriptions: [f.app.subscriptions![0]!, { ...f.app.subscriptions![0]!, id: "duplicate" }] },
    ]),
  ).toThrow("Ambiguous converted route");
  expect(f.snapshot()).toEqual(before);
});

test("conversion refuses running attempts and incomplete execution markers without changing state", () => {
  const f = fixture();
  const claim = claimObservedAppTask(f.config, {
    taskId: f.item.taskId,
    appAgent: f.app.agent,
    handler: "executor:conversation",
  });
  if (claim.kind !== "claimed") throw new Error("Expected claim");
  const before = f.snapshot();
  expect(() => f.convert()).toThrow("running attempts");
  expect(f.snapshot()).toEqual(before);
  completeAppTask(f.config, claim, { summary: "Stopped old runtime" });
  const stopped = f.snapshot();
  mkdirSync(join(f.root, "sessions/old"), { recursive: true });
  writeFileSync(join(f.root, "sessions/old/[STARTED]"), "owner evidence");
  expect(() => f.convert()).toThrow("confirmed cleanup");
  expect(f.snapshot()).toEqual(stopped);
});

test("runtime refuses old execution contracts before opening another attempt", async () => {
  const f = fixture();
  const prepare = () =>
    prepareAppTaskRuntimeDescriptors({
      persistDir: f.root,
      projectsRoot: f.root,
      appRegistrySnapshot: { id: "current", generation: 1, entries: [{ appDir: f.root, definition: f.app }] },
    });
  const before = f.snapshot();
  await expect(prepare()).rejects.toThrow("requires stopped-runtime Task contract conversion");
  expect(f.snapshot()).toEqual(before);
  f.convert();
  expect(await prepare()).toHaveLength(1);
});

test("startup and conversion refuse nested retained Conversation settlement proposals without changing state", async () => {
  const f = fixture();
  f.convert();
  const prepare = () => prepareAppTaskRuntimeDescriptors({
    persistDir: f.root, projectsRoot: f.root,
    appRegistrySnapshot: { id: "current", generation: 1, entries: [{ appDir: f.root, definition: f.app }] },
  });
  expect(await prepare()).toHaveLength(1);
  const claim = claimObservedAppTask(f.config, {
    taskId: f.item.taskId, appAgent: f.app.agent, handler: "executor:agent",
  });
  if (claim.kind !== "claimed") throw new Error("Expected claim");
  failAppTaskAttempt(f.config, claim, "Previous Host confirmed execution cleanup");
  // The retired executor stored the proposal inside report. Reproduce its
  // persisted shape after cleanup, with no legacy executor or route to mask it.
  const checkpoint = {
    claim,
    report: {
      runId: null,
      handlerResult: { state: "converged", summary: "Prepared answer", facts: [], actions: [] },
      conversation: { decision: { summary: "Prepared answer", response: "Retained reply", topic: { kind: "none" } } },
    },
    acceptanceBasis: { method: "agent-judgment", facts: [] },
  };
  f.db.prepare(`UPDATE app_task_attempts SET attempt_json = json_set(attempt_json, '$.pendingSettlement', json(?))
    WHERE app_id = ? AND attempt_id = ?`).run(JSON.stringify(checkpoint), f.app.id, claim.attemptId);
  const before = f.snapshot();
  await expect(prepare()).rejects.toThrow("requires stopped-runtime Task contract conversion");
  expect(f.snapshot()).toEqual(before);
  f.db.prepare(`UPDATE app_tasks SET resource_json = json_set(resource_json, '$.spec.executor', 'conversation')
    WHERE app_id = ? AND task_id = ?`).run(f.app.id, f.item.taskId);
  const beforeConversion = f.snapshot();
  expect(() => f.convert()).toThrow("Settle retained Conversation proposals with the previous Host");
  expect(f.snapshot()).toEqual(beforeConversion);

  // Current common Task checkpoints remain supported.
  f.db.prepare(`UPDATE app_task_attempts SET attempt_json = json_remove(attempt_json, '$.pendingSettlement.report.conversation')
    WHERE app_id = ? AND attempt_id = ?`).run(f.app.id, claim.attemptId);
  expect(f.convert()).toEqual({ tasks: 1, routes: 0 });
  expect(await prepare()).toHaveLength(1);
});

test("conversion refuses orphan execution or frozen old settlement without partial changes", () => {
  const f = fixture();
  f.db.prepare("UPDATE app_inbox_items SET execution_task_id = NULL WHERE id = ?").run(f.item.item.id);
  const orphan = f.snapshot();
  expect(() => f.convert()).toThrow("has no saved input context");
  expect(f.snapshot()).toEqual(orphan);
  f.db.prepare("UPDATE app_inbox_items SET execution_task_id = ? WHERE id = ?").run(f.item.taskId, f.item.item.id);
  const bus = new EventBus();
  bus.setPersistenceSubscriber(new DbWriter(f.root).handler);
  const frozenEvent = bus.emit({ type: "sample.frozen", source: "fixture", owner: "app:sample", data: {} });
  createAppEventAdmissionPlan(f.db, {
    eventId: frozenEvent[EVENT_ROW_ID]!,
    registrySnapshotId: "previous",
    registryGeneration: 1,
    routes: [
      {
        kind: "task",
        appId: f.app.id,
        routeId: "frozen",
        conditionTaskIds: [],
        intent: {
          id: "frozen",
          parentId: "root",
          executor: "conversation",
          outcome: "Retain ask",
          acceptance: ["Answer"],
        },
      },
    ],
  });
  const frozen = f.snapshot();
  expect(() => f.convert()).toThrow("Settle frozen Conversation admission commands");
  expect(f.snapshot()).toEqual(frozen);
});

test.each(["inline", "artifact", "pre-envelope"])(
  "conversion restores the exact %s event payload for object selectors and input mapping",
  (format) => {
    const value = format === "artifact" ? "Complete saved scope. ".repeat(600) : "Saved project-specific scope";
    const f = fixture(value);
    if (format === "pre-envelope") f.db.prepare("UPDATE events SET envelope_json = NULL WHERE id = ?").run(f.eventId);
    if (format === "artifact")
      expect(f.db.prepare("SELECT body_ref FROM events WHERE id = ?").get(f.eventId)?.body_ref).toBeString();
    expect(f.convert()).toEqual({ tasks: 1, routes: 1 });
    expect(getAppEventAdmissionPlan(f.db, f.eventId)?.commands[0]).toMatchObject({
      kind: "inbox", input: { kind: "message", data: { text: value } },
      conditionTaskIds: [f.item.taskId],
    });
  },
);

test("conversion rejects corrupt source payloads and mixed old routes atomically", () => {
  const corrupt = fixture();
  corrupt.db.prepare("UPDATE events SET body_sha256 = 'invalid' WHERE id = ?").run(corrupt.eventId);
  const before = corrupt.snapshot();
  expect(() => corrupt.convert()).toThrow("Missing or invalid original event");
  expect(corrupt.snapshot()).toEqual(before);

  const mixed = fixture();
  mixed.db.prepare(`UPDATE app_event_admission_commands
    SET payload = json_set(payload, '$.subscriptionIds', json('["saved-subscription"]'))
    WHERE event_id = ?`).run(mixed.eventId);
  const mixedBefore = mixed.snapshot();
  expect(() => mixed.convert()).toThrow("Settle mixed subscription/Task admission");
  expect(mixed.snapshot()).toEqual(mixedBefore);
});

test("retired executor names reject both new admission and custom registration before state mutation", async () => {
  const f = fixture();
  const before = f.snapshot();
  const { observeAppTaskIntent } = await import("../core/tasks/app-task-reconciler.js");
  expect(() => observeAppTaskIntent(f.config, {
    appAgent: f.app.agent,
    intent: { id: "custom", parentId: "root", executor: "conversation", outcome: "Custom work", acceptance: ["Verified"] },
  })).toThrow('Executor name "conversation" is retired and reserved');
  expect(f.snapshot()).toEqual(before);
  await expect(prepareAppTaskRuntimeDescriptors({
    persistDir: f.root, projectsRoot: f.root,
    executors: { conversation: async () => ({ state: "converged", summary: "Custom", facts: [] }) },
    appRegistrySnapshot: { id: "reserved", generation: 1, entries: [{ appDir: f.root, definition: f.app }] },
  })).rejects.toThrow('Executor name "conversation" is retired and reserved');
  expect(f.snapshot()).toEqual(before);
});

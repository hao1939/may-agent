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
import { appTaskContext, claimObservedAppTask, completeAppTask } from "../core/tasks/app-task-reconciler.js";
import { prepareAppTaskRuntimeDescriptors } from "../core/tasks/runtime-definition.js";
import { convertStoppedTaskContracts } from "./task-contract-conversion.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { force: true, recursive: true });
  }
});
function fixture() {
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
      { id: "scan", event: "sample.scan", toInput: () => ({ kind: "message", data: { text: "Scan saved evidence" } }) },
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
      executor: "conversation",
      parentId: "root",
      outcome: "Answer the human",
      acceptance: ["Preserve the accepted scope"],
    },
  });
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
  const event = bus.emit({ type: "sample.scan", source: "fixture", owner: "app:sample", data: { value: "original" } });
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
    input: { kind: "message", data: { text: "Scan saved evidence" } },
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

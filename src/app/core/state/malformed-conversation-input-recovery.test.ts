import { afterEach, expect, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDb, closeDb } from "../../../lib/requests.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { admitTaskInput } from "./inbox.js";
import {
  admitConversationTaskInput,
  completeConversationTaskTurn,
  conversationTaskId,
  readConversationTaskInputs,
} from "./conversation-task-turns.js";
import { appTaskContext, claimObservedAppTask, failAppTaskAttempt } from "../tasks/app-task-reconciler.js";
import {
  recoverMalformedConversationInput,
  type MalformedConversationInputRecoveryPlan,
} from "./malformed-conversation-input-recovery.js";

const roots: string[] = [];
afterEach(() => {
  setSystemTime();
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-malformed-conversation-recovery-"));
  roots.push(root);
  const db = getDb(root);
  const store = AppTaskResourceStore.fromDb(db, "may");
  store.bootstrapSnapshot(
    {
      project: "may",
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
    "recovery-test",
  );
  const context = appTaskContext({
    appDir: root,
    projectDir: root,
    agent: "may",
    maxConcurrent: 1,
    resourceStore: store,
  });
  const intent = {
    parentId: "root",
    outcome: "Continue the primary conversation",
    acceptance: ["Respond to retained input"],
    executor: "conversation" as const,
  };
  const seed = admitConversationTaskInput(context, {
    id: "seed",
    appId: "may",
    conversationId: "may:primary",
    source: { kind: "system", id: "seed" },
    input: { kind: "message", data: { message: "seed" } },
    idempotencyKey: "seed-v1",
    intent,
    now: 1,
  });
  const seedClaim = claimObservedAppTask(context, {
    taskId: seed.taskId,
    appAgent: "may",
    handler: "executor:conversation",
    now: 2,
  });
  if (seedClaim.kind !== "claimed") throw new Error(`Seed claim failed: ${seedClaim.kind}`);
  completeConversationTaskTurn(
    context,
    seedClaim,
    { summary: "Seed consumed", facts: [], topic: { kind: "none" } },
    {
      now: 3,
      acceptanceBasis: { method: "deterministic", evidence: ["fixture:seed"] },
    },
  );

  const source = { kind: "system" as const, id: "codex-supervisor:fixture" };
  const input = { kind: "message", data: { message: "retained exact feedback" } };
  const malformed = createAppInboxItem(db, {
    id: "bad-input",
    appId: "may",
    targetTaskId: seed.taskId,
    source,
    input,
    originEventId: 77,
    idempotencyKey: "bad-admission-v1",
    now: 4,
  }).item;
  admitTaskInput(context, {
    appId: "may",
    attachment: { kind: "existing", taskId: seed.taskId },
    idempotencyKey: `task:${malformed.id}`,
    inputContext: { id: malformed.id, source, input },
    inboxInputId: malformed.id,
    now: 4,
  });
  const failedClaim = claimObservedAppTask(context, {
    taskId: seed.taskId,
    appAgent: "may",
    handler: "executor:conversation",
    now: 5,
  });
  if (failedClaim.kind !== "claimed") throw new Error(`Malformed claim failed: ${failedClaim.kind}`);
  failAppTaskAttempt(context, failedClaim, "Conversation input does not belong to this Task attempt");
  const before = store.readTask(seed.taskId)!;
  const plan: MalformedConversationInputRecoveryPlan = {
    quiesced: true,
    malformed: {
      appId: "may",
      inputId: malformed.id,
      taskId: seed.taskId,
      originEventId: 77,
      idempotencyKey: "bad-admission-v1",
      taskAdmissionKey: `task:${malformed.id}`,
      source,
      input,
    },
    taskFence: {
      resourceVersion: before.metadata.resourceVersion,
      generation: before.metadata.generation,
      currentAttemptId: null,
    },
    recovery: { conversationId: "may:primary", idempotencyKey: "bad-admission-recovery-v1" },
  };
  return {
    root,
    context,
    store,
    db,
    plan,
    taskId: conversationTaskId("may", "may:primary"),
    failedAttemptId: failedClaim.attemptId,
  };
}

test("atomically rejects one malformed row and admits its retained message through Conversation", () => {
  const f = fixture();
  const unrelated = createAppInboxItem(f.db, {
    id: "unrelated",
    appId: "may",
    source: { kind: "system", id: "other" },
    input: { kind: "message", data: { message: "other" } },
    idempotencyKey: "other-v1",
    now: 6,
  }).item;
  admitTaskInput(f.context, {
    appId: "may",
    attachment: {
      kind: "desired",
      intent: {
        id: "unrelated-task",
        parentId: "root",
        outcome: "Preserve unrelated work",
        acceptance: ["Remain unchanged"],
      },
    },
    idempotencyKey: "unrelated-admission",
    inputContext: {
      id: "unrelated-input",
      source: { kind: "system", id: "other" },
      input: { kind: "message", data: { message: "other" } },
    },
    now: 6,
  });
  const unrelatedBefore = f.store.readTaskContext({
    taskIds: ["unrelated-task"],
    admissionIds: ["unrelated-admission"],
  });
  const failedAttempt = f.store.readAttempt(f.failedAttemptId);
  const taskBefore = f.store.readTask(f.taskId)!;
  const result = recoverMalformedConversationInput(f.context, f.plan, { now: 10 });
  expect(result).toMatchObject({ status: "repaired", taskId: f.taskId });
  expect(getAppInboxItem(f.db, "bad-input")).toMatchObject({
    status: "done",
    handling: { phase: "failed" },
    result: undefined,
    targetTaskId: f.taskId,
    originEventId: 77,
  });
  expect(getAppInboxItem(f.db, unrelated.id)).toEqual(unrelated);
  expect(f.store.readTaskContext({ taskIds: ["unrelated-task"], admissionIds: ["unrelated-admission"] })).toEqual(
    unrelatedBefore,
  );
  expect(f.store.readAttempt(f.failedAttemptId)).toEqual(failedAttempt);
  expect(f.store.readTask(f.taskId)?.status).toMatchObject({
    executionFailures: taskBefore.status.executionFailures,
    executionRetryAt: taskBefore.status.executionRetryAt,
    summary: taskBefore.status.summary,
    observedAttemptId: taskBefore.status.observedAttemptId,
    result: taskBefore.status.result,
  });
  const tree = f.store.readTaskContext({ taskIds: [f.taskId], admissionIds: ["task:bad-input"] });
  expect(tree.appTaskAdmissions?.["task:bad-input"]).toBeUndefined();
  expect(tree.resources?.[f.taskId]?.status.inputWaits?.["task:bad-input"]).toBeUndefined();

  const corrected = getAppInboxItem(f.db, result.recoveredInputId!)!;
  expect(corrected).toMatchObject({
    conversationId: "may:primary",
    targetTaskId: undefined,
    executionTaskId: f.taskId,
    originEventId: 77,
    source: f.plan.malformed.source,
    input: f.plan.malformed.input,
  });
  setSystemTime(taskBefore.status.executionRetryAt! + 1);
  const claim = claimObservedAppTask(f.context, {
    taskId: f.taskId,
    appAgent: "may",
    handler: "executor:conversation",
  });
  if (claim.kind !== "claimed") throw new Error(`Corrected claim failed: ${claim.kind}`);
  expect(readConversationTaskInputs(f.context, claim).map((item) => item.id)).toEqual([corrected.id]);
  completeConversationTaskTurn(
    f.context,
    claim,
    {
      summary: "Corrected feedback consumed",
      facts: ["fixture:consumed"],
      topic: { kind: "none" },
    },
    {
      now: taskBefore.status.executionRetryAt! + 2,
      acceptanceBasis: { method: "deterministic", evidence: ["fixture:consumed"] },
    },
  );
  expect(getAppInboxItem(f.db, corrected.id)).toMatchObject({ status: "done" });

  closeDb(f.root);
  const reopenedDb = getDb(f.root);
  const reopenedStore = AppTaskResourceStore.fromDb(reopenedDb, "may");
  const reopenedContext = appTaskContext({
    appDir: f.root,
    projectDir: f.root,
    agent: "may",
    maxConcurrent: 1,
    resourceStore: reopenedStore,
  });
  expect(recoverMalformedConversationInput(reopenedContext, f.plan)).toEqual({
    status: "already-repaired",
    malformedInputId: "bad-input",
    recoveredInputId: corrected.id,
    taskId: f.taskId,
  });
  const changedIncident = structuredClone(f.plan);
  changedIncident.malformed.originEventId += 1;
  expect(() => recoverMalformedConversationInput(reopenedContext, changedIncident)).toThrow(
    "idempotency key is already used",
  );
});

test("dry-run is unchanged and a tuple or Task-fence mismatch rolls back every resource", () => {
  const f = fixture();
  const beforeTask = f.store.readTask(f.taskId);
  const beforeTrigger = f.store.readTrigger(f.taskId);
  const beforeInbox = getAppInboxItem(f.db, "bad-input");
  expect(recoverMalformedConversationInput(f.context, f.plan, { dryRun: true })).toMatchObject({
    status: "would-repair",
  });
  expect(f.store.readTask(f.taskId)).toEqual(beforeTask);
  expect(f.store.readTrigger(f.taskId)).toEqual(beforeTrigger);
  expect(getAppInboxItem(f.db, "bad-input")).toEqual(beforeInbox);

  const stale = structuredClone(f.plan);
  stale.taskFence.resourceVersion += 1;
  expect(() => recoverMalformedConversationInput(f.context, stale)).toThrow("Task fence is stale");
  expect(f.store.readTask(f.taskId)).toEqual(beforeTask);
  expect(f.store.readTrigger(f.taskId)).toEqual(beforeTrigger);
  expect(getAppInboxItem(f.db, "bad-input")).toEqual(beforeInbox);
  expect(listRecoveryRows(f.db)).toEqual([]);

  const wrongTuple = structuredClone(f.plan);
  wrongTuple.malformed.originEventId += 1;
  expect(() => recoverMalformedConversationInput(f.context, wrongTuple)).toThrow("inbox tuple is stale");
  expect(listRecoveryRows(f.db)).toEqual([]);

  const wrongConversation = structuredClone(f.plan);
  wrongConversation.recovery.conversationId = "may:other";
  expect(() => recoverMalformedConversationInput(f.context, wrongConversation, { dryRun: true })).toThrow(
    "current Conversation Task lineage",
  );
  expect(() => recoverMalformedConversationInput(f.context, wrongConversation)).toThrow(
    "current Conversation Task lineage",
  );
  expect(f.store.readTask(f.taskId)).toEqual(beforeTask);
  expect(f.store.readTrigger(f.taskId)).toEqual(beforeTrigger);
  expect(getAppInboxItem(f.db, "bad-input")).toEqual(beforeInbox);
  expect(listRecoveryRows(f.db)).toEqual([]);
  expect(f.store.readTask(conversationTaskId("may", "may:other"))).toBeNull();
});

test("active attempt and preaccepted malformed admission both fail without writes", () => {
  const active = fixture();
  const activeTask = active.store.readTask(active.taskId)!;
  setSystemTime(activeTask.status.executionRetryAt! + 1);
  const claim = claimObservedAppTask(active.context, {
    taskId: active.taskId,
    appAgent: "may",
    handler: "executor:conversation",
  });
  if (claim.kind !== "claimed") throw new Error(`Active claim failed: ${claim.kind}`);
  const activeSnapshot = stateSnapshot(active);
  expect(() => recoverMalformedConversationInput(active.context, active.plan)).toThrow("attempt is current");
  expect(stateSnapshot(active)).toEqual(activeSnapshot);

  const accepted = fixture();
  const admission = accepted.store.readTaskContext({
    taskIds: [],
    admissionIds: [accepted.plan.malformed.taskAdmissionKey],
  }).appTaskAdmissions![accepted.plan.malformed.taskAdmissionKey]!;
  const acceptedAdmission = {
    ...admission,
    resultAttemptId: accepted.store.readTask(accepted.taskId)!.status.observedAttemptId,
  };
  accepted.db
    .prepare("UPDATE app_task_admissions SET admission_json = ? WHERE app_id = ? AND task_id = ?")
    .run(JSON.stringify(acceptedAdmission), "may", accepted.plan.malformed.taskAdmissionKey);
  const acceptedSnapshot = stateSnapshot(accepted);
  expect(() => recoverMalformedConversationInput(accepted.context, accepted.plan, { dryRun: true })).toThrow(
    "already accepted",
  );
  expect(stateSnapshot(accepted)).toEqual(acceptedSnapshot);
});

test("an existing recovery key collision is rejected without writes", () => {
  const f = fixture();
  admitConversationTaskInput(f.context, {
    id: "different-corrected-input",
    appId: "may",
    conversationId: "may:primary",
    source: structuredClone(f.plan.malformed.source),
    input: structuredClone(f.plan.malformed.input),
    originEventId: 88,
    idempotencyKey: f.plan.recovery.idempotencyKey,
    intent: f.store.readTask(f.taskId)!.spec,
    now: 9,
  });
  f.plan.taskFence.resourceVersion = f.store.readTask(f.taskId)!.metadata.resourceVersion;
  const before = stateSnapshot(f);
  expect(() => recoverMalformedConversationInput(f.context, f.plan, { dryRun: true })).toThrow(
    "idempotency key is already used",
  );
  expect(stateSnapshot(f)).toEqual(before);
  expect(() => recoverMalformedConversationInput(f.context, f.plan)).toThrow("idempotency key is already used");
  expect(stateSnapshot(f)).toEqual(before);
});

function stateSnapshot(f: ReturnType<typeof fixture>) {
  return {
    task: f.store.readTask(f.taskId),
    trigger: f.store.readTrigger(f.taskId),
    malformed: getAppInboxItem(f.db, f.plan.malformed.inputId),
    recoveryRows: listRecoveryRows(f.db),
    admission: f.store.readTaskContext({
      taskIds: [],
      admissionIds: [f.plan.malformed.taskAdmissionKey],
    }).appTaskAdmissions?.[f.plan.malformed.taskAdmissionKey],
  };
}

function listRecoveryRows(db: ReturnType<typeof getDb>) {
  return db
    .prepare("SELECT id, origin_event_id FROM app_inbox_items WHERE idempotency_key = ? ORDER BY id")
    .all("bad-admission-recovery-v1");
}

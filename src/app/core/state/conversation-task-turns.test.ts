import { Type, defineApp, type ConversationTurnResult } from "@may-agent/sdk";
import { afterEach, expect, setSystemTime, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completeCommunicationTask, readCommunicationInputs } from "../../../../test/fixtures/communication.js";
import { claimAppInboxItem } from "../../../../test/fixtures/legacy-inbox.js";
import { closeDb, getDb } from "../../../lib/requests.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  closeAppTask,
  completeAppTask,
  deferAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
} from "../tasks/app-task-reconciler.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { readConversationRequest } from "./conversation-requests.js";
import { listConversationTaskLinks } from "./conversation-task-links.js";
import {
  admitConversationTaskChange,
  admitConversationTaskInput,
  conversationTaskId,
  listPendingConversationTaskChanges,
  stopConversationTaskTurn,
} from "./conversation-task-turns.js";
import { createConversationTopic, linkConversationTopicTask, readAppConversationResource } from "./conversations.js";
import { admitTaskInput } from "./inbox.js";
import { TaskBudgetAdmissionStore } from "./task-budget-admission.js";

const roots: string[] = [];
afterEach(() => {
  setSystemTime();
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
});
const app = defineApp({
  id: "sample",
  version: 1,
  agent: "sample",
  conversation: { mode: "task" },
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ text: Type.String() }) }),
});
const decision: ConversationTurnResult = {
  summary: "Compared options",
  response: "Option A costs less; option B is faster.",
  topic: { kind: "new", title: "Compare options" },
  requestUpdates: [
    {
      id: "comparison",
      expectedRevision: 0,
      scope: "Compare A and B",
      disposition: "fulfilled",
      reason: "Compared cost and speed",
    },
  ],
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-conversation-task-"));
  roots.push(root);
  let db = getDb(root);
  let store = AppTaskResourceStore.fromDb(db, app.id);
  store.bootstrapSnapshot(
    {
      project: app.id,
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
    "conversation-fixture",
  );
  const context = () =>
    appTaskContext({ appDir: root, projectDir: root, agent: app.id, maxConcurrent: 1, resourceStore: store });
  const input = (id = "first", sequence = 1, text = "Compare A and B") => ({
    id,
    appId: app.id,
    conversationId: "chat",
    conversationSequence: sequence,
    source: { kind: "human" as const, id },
    input: { kind: "message", data: { text } },
    intent: {
      parentId: "root",
      outcome: "Discuss with the human",
      acceptance: ["Explain supported conclusions"],
      executor: "agent",
    },
  });
  const admit = (id?: string, sequence?: number, text?: string) =>
    admitConversationTaskInput(context(), input(id, sequence, text));
  const claim = (taskId: string) => {
    const claimed = claimObservedAppTask(context(), { taskId, appAgent: app.id, handler: "agent:sample" });
    if (claimed.kind !== "claimed") throw new Error(`Expected claim, got ${claimed.kind}`);
    return claimed;
  };
  return {
    get db() {
      return db;
    },
    get store() {
      return store;
    },
    context,
    input,
    admit,
    claim,
    reopen() {
      closeDb(root);
      db = getDb(root);
      store = AppTaskResourceStore.fromDb(db, app.id);
    },
  };
}

for (const topic of ["new", "none"] as const) {
  test(`Host replays settled Conversation input with ${topic} Topic without changing its identity`, () => {
    const f = fixture();
    let admissions = 0;
    const createHost = () =>
      new AppInboxHost({
        db: f.db,
        apps: [app],
        admitConversation: (input) => {
          admissions++;
          return admitConversationTaskInput(f.context(), { ...input, intent: f.input().intent });
        },
      });
    const host = createHost();
    const request = { ...f.input(), idempotencyKey: "original-request" };
    const first = host.admit(request);
    completeCommunicationTask(f.context(), f.claim(first.item.executionTaskId!), {
      ...decision,
      topic: topic === "new" ? decision.topic : { kind: "none" },
    });
    const saved = getAppInboxItem(f.db, first.item.id)!;
    expect(saved.status).toBe("done");
    if (topic === "new") expect(saved.topicId).toBeString();
    else expect(saved.topicId).toBeUndefined();
    const before = f.store.readTaskContext({ taskIds: [first.item.executionTaskId!] });
    host.close();
    f.reopen();
    const recovered = createHost();
    // Replaying a receipt must not depend on today's installed input contract.
    recovered.replaceApps([{ ...app, inputSchema: Type.Never() }]);

    expect(recovered.admit(request)).toEqual({ item: saved, created: false });
    expect(recovered.admit({ ...request, id: "key-alias" })).toEqual({ item: saved, created: false });
    expect(recovered.admit({ ...request, idempotencyKey: undefined })).toEqual({ item: saved, created: false });
    for (const conflict of [
      { conversationId: "another-chat" },
      { conversationSequence: 2 },
      { topicId: "another-topic" },
    ]) {
      expect(() => recovered.admit({ ...request, ...conflict, originEventId: 7 })).toThrow("reused");
      expect(() => createAppInboxItem(f.db, { ...request, ...conflict, originEventId: 7 })).toThrow("reused");
      expect(() => admitConversationTaskInput(f.context(), { ...request, ...conflict, originEventId: 7 })).toThrow(
        "reused",
      );
    }
    expect(recovered.admit({ ...request, conversationSequence: undefined })).toEqual({ item: saved, created: false });
    expect(recovered.admit({ ...request, conversationId: undefined, conversationSequence: undefined })).toEqual({
      item: saved,
      created: false,
    });
    expect(admitConversationTaskInput(f.context(), request).item).toEqual(saved);
    for (const replay of [request, { ...request, conversationSequence: undefined }]) {
      expect(createAppInboxItem(f.db, replay)).toEqual({ item: saved, created: false });
      expect(createAppInboxItem(f.db, { ...replay, id: "key-alias" })).toEqual({ item: saved, created: false });
      expect(createAppInboxItem(f.db, { ...replay, idempotencyKey: undefined })).toEqual({
        item: saved,
        created: false,
      });
    }
    expect(getAppInboxItem(f.db, saved.id)).toEqual(saved);
    expect(f.store.readTaskContext({ taskIds: [first.item.executionTaskId!] })).toEqual(before);
    expect(admissions).toBe(1);
    recovered.close();
  });
}

test.each(["new", "existing"] as const)(
  "failed reply persistence rolls back %s Topic, Request and Task acceptance across reopen",
  (kind) => {
    const f = fixture();
    if (kind === "existing")
      createConversationTopic(f.db, {
        id: "existing",
        appId: app.id,
        conversationId: "chat",
        title: "Existing work",
        openedBy: "human",
        originMessageId: "earlier",
      });
    const input = f.admit();
    const claim = f.claim(input.taskId);
    const proposed: ConversationTurnResult = {
      ...decision,
      topic: kind === "new" ? decision.topic : { kind: "existing", id: "existing" },
    };
    const beforeTopics = readAppConversationResource(f.db, app.id, "chat").topics;
    f.db.exec(`CREATE TRIGGER fail_reply BEFORE INSERT ON events
    WHEN NEW.event_type = 'conversation.message.created' BEGIN SELECT RAISE(ABORT, 'reply write failed'); END`);
    expect(() => completeCommunicationTask(f.context(), claim, proposed)).toThrow("reply write failed");
    f.reopen();
    expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
    expect(readAppConversationResource(f.db, app.id, "chat").topics).toEqual(beforeTopics);
    expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
    expect(f.store.readTask(input.taskId)?.status.currentAttemptId).toBe(claim.attemptId);
    expect(readAppTaskAdmissionOutcome(f.context(), input.taskId, input.item.taskAdmissionKey!)).toBeNull();
    expect(getAppInboxItem(f.db, input.item.id)?.result).toBeUndefined();
    f.db.exec("DROP TRIGGER fail_reply");
    expect(completeCommunicationTask(f.context(), claim, proposed).status).toBe("applied");
    expect(readAppConversationResource(f.db, app.id, "chat").topics).toHaveLength(1);
    expect(f.store.readAttempt(claim.attemptId)?.acceptedResult?.response).toBe(proposed.response);
  },
);

test("late output after owner closure cannot publish a reply or close a Request", () => {
  const f = fixture();
  const input = f.admit();
  const claim = f.claim(input.taskId);
  const task = f.store.readTask(input.taskId)!;
  cancelAppTask(f.context(), {
    appId: app.id,
    taskId: input.taskId,
    expectedGeneration: task.metadata.generation,
    expectedResourceVersion: task.metadata.resourceVersion,
    decision: "app-policy", reason: "End this Conversation",
  });
  expect(() => completeCommunicationTask(f.context(), claim, decision)).toThrow("stale");
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
  expect(getAppInboxItem(f.db, input.item.id)?.result).toBeUndefined();
  expect(f.store.isCancelled(input.taskId)).toBe(true);
});

test("Conversation accepts its considered answer while later input remains pending", () => {
  const f = fixture();
  const input = f.admit();
  const claim = f.claim(input.taskId);
  f.admit("correction", 2);
  expect(completeCommunicationTask(f.context(), claim, decision).taskContinues).toBe(true);
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toMatchObject({
    response: decision.response, inputKeys: [input.item.taskAdmissionKey!],
  });
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")?.status).toBe("closed");
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult?.response).toBe(decision.response);
  expect(getAppInboxItem(f.db, "correction")?.status).not.toBe("done");

});

test("Stop responds to the latest considered human input after a mixed-input retry", () => {
  const f = fixture();
  const first = f.admit();
  const obsolete = f.claim(first.taskId);
  const correction = f.admit("correction", 2);
  admitConversationTaskInput(f.context(), {
    ...f.input("review", 3, "A linked Task returned facts"),
    source: { kind: "system", id: "review" },
  });
  deferAppTask(f.context(), obsolete, { disposition: "waiting", continue: true,
    summary: "Draft prepared; comparison still needs verification", facts: ["draft:saved"] });
  const claim = f.claim(first.taskId);
  expect(claim.continuedInputKeys).toContain(first.item.taskAdmissionKey!);
  const newer = f.admit("newer", 4);
  stopConversationTaskTurn(f.context(), {
    appId: app.id,
    conversationId: "chat",
    turnId: claim.attemptId,
    expectedRevision: claim.generation,
  });
  expect(getAppInboxItem(f.db, correction.item.id)?.result?.response).toContain("Stopped this turn");
  expect(getAppInboxItem(f.db, first.item.id)?.result).toBeUndefined();
  expect(getAppInboxItem(f.db, "review")?.result).toBeUndefined();
  expect(getAppInboxItem(f.db, newer.item.id)?.status).not.toBe("done");
});

test("cutover refuses unhandled legacy input even with an expired lease", () => {
  const f = fixture();
  createAppInboxItem(f.db, f.input("old", 1));
  expect(claimAppInboxItem(f.db, "old", "legacy", 1, Date.now())).not.toBeNull();
  f.db.run("UPDATE app_inbox_items SET lease_expires_at = 1 WHERE id = 'old'");
  expect(() =>
    admitConversationTaskInput(f.context(), {
      ...f.input("new", 2),
      conversationInputKinds: ["message"],
    }),
  ).toThrow("drain before cutover");
  expect(getAppInboxItem(f.db, "new")).toBeNull();
  expect(f.db.prepare("SELECT COUNT(*) AS count FROM app_tasks").get()).toEqual({ count: 0 });
});

test("cutover ignores an ordinary focused input already admitted to an existing Task", () => {
  const f = fixture();
  observeAppTaskIntent(f.context(), {
    appAgent: app.id,
    intent: { id: "worker", parentId: "root", outcome: "Deliver release", acceptance: ["Delivered"] },
  });
  const focused = {
    ...f.input("focused", 1, "Continue release"),
    targetTaskId: "worker",
  };
  createAppInboxItem(f.db, focused);
  admitTaskInput(f.context(), {
    appId: app.id,
    attachment: { kind: "existing", taskId: "worker" },
    idempotencyKey: "task:focused",
    inputContext: { id: focused.id, source: focused.source, input: focused.input },
    inboxInputId: focused.id,
  });

  expect(() => f.admit("new", 2, "Review another issue")).not.toThrow();
  expect(getAppInboxItem(f.db, focused.id)).toMatchObject({
    status: "handling",
    waitingOn: { kind: "task", id: "worker" },
    taskAdmissionKey: "task:focused",
  });
});

test("old inbox cannot execute Task-owned Conversation input or later unconverted input", async () => {
  const f = fixture();
  const input = f.admit();
  createAppInboxItem(f.db, f.input("old-route", 2));
  let executions = 0;
  const host = new AppInboxHost({
    db: f.db,
    apps: [app],
    resolveConversationInput: async () => {
      executions++;
      return decision;
    },
  });
  expect(claimAppInboxItem(f.db, input.item.id, "legacy", 1_000)).toBeNull();
  expect(claimAppInboxItem(f.db, "old-route", "legacy", 1_000)).toBeNull();

  await host.recoverAdmissions();
  expect(executions).toBe(0);
  expect(getAppInboxItem(f.db, "old-route")?.status).toBe("pending");
});

test("a substituted input identity cannot settle another Conversation", () => {
  const f = fixture();
  const first = f.admit();
  const other = admitConversationTaskInput(f.context(), { ...f.input("other", 1), conversationId: "other-chat" });
  const claim = f.claim(first.taskId);
  const forged = structuredClone(claim);
  (forged.events[0]!.event.data as { request: { id: string } }).request.id = other.item.id;
  expect(() => completeCommunicationTask(f.context(), forged, decision)).toThrow("does not belong");
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(readConversationRequest(f.db, app.id, "other-chat", "comparison")).toBeNull();
});

test("Turn Stop rolls back as one transaction and its input stays stopped across restart", () => {
  const f = fixture();
  const input = f.admit();
  const claim = f.claim(input.taskId);
  const target = { appId: app.id, conversationId: "chat", turnId: claim.attemptId, expectedRevision: claim.generation };
  f.db.exec(`CREATE TRIGGER refuse_stop BEFORE UPDATE OF handling ON app_inbox_items
    BEGIN SELECT RAISE(ABORT, 'cannot record Stop'); END`);
  expect(() => stopConversationTaskTurn(f.context(), target)).toThrow("cannot record Stop");
  expect(f.store.readTask(input.taskId)?.status.currentAttemptId).toBe(claim.attemptId);
  expect(f.store.readAttempt(claim.attemptId)?.state).toBe("running");
  expect(getAppInboxItem(f.db, input.item.id)?.status).not.toBe("done");
  f.db.exec("DROP TRIGGER refuse_stop");
  expect(() => stopConversationTaskTurn(f.context(), { ...target, conversationId: "another" })).toThrow();
  expect(() => stopConversationTaskTurn(f.context(), { ...target, expectedRevision: claim.generation + 1 })).toThrow();
  expect(stopConversationTaskTurn(f.context(), target).changed).toBe(true);
  expect(() => completeCommunicationTask(f.context(), claim, decision)).toThrow();
  f.reopen();
  expect(stopConversationTaskTurn(f.context(), target).changed).toBe(false);
  expect(f.store.isCancelled(input.taskId)).toBe(false);
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(readAppTaskAdmissionOutcome(f.context(), input.taskId, input.item.taskAdmissionKey!)).toBeNull();
  expect(f.admit().created).toBe(false);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  const later = f.admit("later", 2);
  const next = f.claim(later.taskId);
  completeCommunicationTask(f.context(), next, decision);
  expect(getAppInboxItem(f.db, input.item.id)?.handling?.phase).toBe("stopped");
  expect(getAppInboxItem(f.db, later.item.id)?.status).toBe("done");
});

test("pending human input leads a bounded mixed batch inside a paused App", () => {
  const f = fixture();
  f.store.setProjectLifecycle("paused");
  for (let index = 0; index < 35; index++) {
    admitConversationTaskInput(f.context(), {
      ...f.input(`review-${index}`, index + 1, `System fact ${index}`),
      source: { kind: "system", id: `review-${index}` },
    });
  }
  const human = f.admit("human", 100, "Discuss these facts with me");
  const claim = f.claim(human.taskId);
  expect(claim.events.map(({ event }) => (event.data as { request: { id: string } }).request.id)).toEqual([
    ...Array.from({ length: 31 }, (_, index) => `review-${index}`),
    "human",
  ]);
  const batch = readCommunicationInputs(f.context(), claim);
  expect(batch).toHaveLength(32);
  expect(batch.at(-1)?.source).toEqual({ kind: "human", id: "human" });
  expect(batch.slice(0, -1).map((item) => item.source.id)).toEqual(
    Array.from({ length: 31 }, (_, index) => `review-${index}`),
  );
  expect(
    f.store
      .readTrigger(human.taskId)
      ?.events?.map((entry) => (entry.event.data as { request: { id: string } }).request.id),
  ).toEqual(["review-31", "review-32", "review-33", "review-34"]);
  expect(f.store.projectLifecycle()).toBe("paused");
  stopConversationTaskTurn(f.context(), {
    appId: app.id,
    conversationId: "chat",
    turnId: claim.attemptId,
    expectedRevision: claim.generation,
  });
  expect(getAppInboxItem(f.db, human.item.id)?.result?.response).toContain("Stopped this turn");
  expect(getAppInboxItem(f.db, "review-30")?.result).toBeUndefined();
  expect(getAppInboxItem(f.db, "review-31")?.status).not.toBe("done");
  expect(f.store.allowsTaskExecution(human.taskId)).toBe(false);
});

test("bounded change discovery advances across Conversations, retains Stop and finds late links", () => {
  const f = fixture();
  const first = f.admit();
  const firstClaim = f.claim(first.taskId);
  completeCommunicationTask(f.context(), firstClaim, decision);
  const topic = readAppConversationResource(f.db, app.id, "chat").topics[0]!;
  const other = admitConversationTaskInput(f.context(), { ...f.input("other"), conversationId: "other-chat" });
  completeCommunicationTask(f.context(), f.claim(other.taskId), decision);
  const otherTopic = readAppConversationResource(f.db, app.id, "other-chat").topics[0]!;
  for (let index = 0; index < 3; index++) {
    const taskId = `sample-${index}`;
    observeAppTaskIntent(f.context(), {
      appAgent: app.id,
      intent: {
        id: taskId,
        parentId: "root",
        outcome: "Measure sample",
        acceptance: ["Observed value"],
      },
    });
    completeAppTask(f.context(), f.claim(taskId), { summary: `Value ${index}`, facts: [`measurement:${index}`] });
    if (index < 2) linkConversationTopicTask(f.db, topic.id, app.id, taskId);
  }
  linkConversationTopicTask(f.db, otherTopic.id, app.id, "sample-0");
  const finished = f.store.readTask("sample-1")!;
  closeAppTask(f.context(), {
    appId: app.id,
    taskId: "sample-1",
    afterResult: finished.status.observedAttemptId!,
    expectedGeneration: finished.metadata.generation,
    expectedResourceVersion: finished.metadata.resourceVersion,
    reason: "Owner closed completed work",
  });
  // A self-link must not turn every Conversation reply into another model call.
  linkConversationTopicTask(f.db, topic.id, app.id, first.taskId);
  expect(() =>
    admitConversationTaskChange(f.context(), f.context(), {
      conversationId: "chat",
      topicId: topic.id,
      taskId: first.taskId,
      attemptId: firstClaim.attemptId,
    }),
  ).toThrow("own outcome");
  const handled: string[] = [];
  for (let index = 0; index < 4; index++) {
    const page = listPendingConversationTaskChanges(f.db, app.id, 1);
    expect(page).toHaveLength(1);
    const ref = page[0]!;
    const admitted = admitConversationTaskChange(f.context(), f.context(), ref);
    handled.push(admitted.item.id);
    const claim = f.claim(admitted.taskId);
    if (index === 0) {
      stopConversationTaskTurn(f.context(), {
        appId: app.id,
        conversationId: ref.conversationId,
        turnId: claim.attemptId,
        expectedRevision: claim.generation,
      });
    } else
      completeCommunicationTask(f.context(), claim, {
        summary: "Reviewed",
        topic: { kind: "existing", id: ref.topicId },
      });
    f.reopen();
  }
  expect(new Set(handled).size).toBe(4);
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
  expect(getAppInboxItem(f.db, handled[0]!)?.handling?.phase).toBe("stopped");
  // Adding the link after acceptance must still return that exact stored outcome.
  linkConversationTopicTask(f.db, topic.id, app.id, "sample-2");
  expect(listPendingConversationTaskChanges(f.db, app.id).map((item) => item.taskId)).toEqual(["sample-2"]);
  const current = f.store.readTask(first.taskId)!;
  cancelAppTask(f.context(), {
    appId: app.id,
    taskId: first.taskId,
    expectedGeneration: current.metadata.generation,
    expectedResourceVersion: current.metadata.resourceVersion,
    decision: "app-policy", reason: "Owner ended the Conversation",
  });
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);

  const successor = f.admit("continue-after-close", 2, "Continue with the returned measurement");
  expect(successor.taskId).toBe(`${first.taskId}_successor_2`);
  const pendingForSuccessor = listPendingConversationTaskChanges(f.db, app.id);
  expect(pendingForSuccessor.map((item) => item.taskId)).toEqual(["sample-2"]);
  const admittedToSuccessor = admitConversationTaskChange(f.context(), f.context(), pendingForSuccessor[0]!);
  expect(admittedToSuccessor.taskId).toBe(successor.taskId);
  expect(admittedToSuccessor.item.executionTaskId).toBe(successor.taskId);
});

test("closure input validates the exact source and rolls admission back without losing owner closure", () => {
  const f = fixture();
  const input = f.admit();
  completeCommunicationTask(f.context(), f.claim(input.taskId), decision);
  const topic = readAppConversationResource(f.db, app.id, "chat").topics[0]!;
  const source = AppTaskResourceStore.fromDb(f.db, "measurement");
  source.bootstrapSnapshot(
    {
      project: "measurement",
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
    "closure-fixture",
  );
  const worker = appTaskContext({ ...f.context(), resourceStore: source });
  admitTaskInput(worker, {
    appId: source.appId,
    idempotencyKey: "measurement-input",
    inputContext: { id: input.item.id, source: input.item.source, input: { kind: "measure", data: {} } },
    topicId: topic.id,
    attachment: { kind: "desired", intent: {
      id: "sample",
      parentId: "root",
      outcome: "Measure sample",
      acceptance: ["Observed value"],
    } },
  });
  const failed = claimObservedAppTask(worker, {
    taskId: "sample",
    appAgent: "measurement",
    handler: "executor:fixture",
  });
  if (failed.kind !== "claimed") throw new Error("Expected measurement claim");
  failAppTaskAttempt(worker, failed, "Source unavailable");
  expect(listPendingConversationTaskChanges(f.db, app.id).map((change) => change.attemptId)).toEqual([
    failed.attemptId,
  ]);
  const task = source.readTask("sample")!;
  const closed = cancelAppTask(worker, {
    appId: source.appId,
    taskId: "sample",
    expectedGeneration: task.metadata.generation,
    expectedResourceVersion: task.metadata.resourceVersion,
    decision: "app-policy", reason: "The owner withdrew the assignment",
  });
  const ref = {
    conversationId: "chat",
    topicId: topic.id,
    taskId: "sample",
    closedGeneration: closed.cancellation.generation,
  };
  expect(
    admitConversationTaskChange(f.context(), worker, {
      conversationId: "chat",
      topicId: topic.id,
      taskId: "sample",
      attemptId: failed.attemptId,
    }).created,
  ).toBe(false);
  expect(listPendingConversationTaskChanges(f.db, app.id).map((change) => change.closedGeneration)).toEqual([
    closed.cancellation.generation,
  ]);
  expect(() =>
    admitConversationTaskChange(f.context(), worker, { ...ref, closedGeneration: ref.closedGeneration + 1 }),
  ).toThrow("closed generation");
  expect(() => admitConversationTaskChange(f.context(), worker, { ...ref, topicId: "unrelated" })).toThrow("no link");
  f.db.exec(`CREATE TRIGGER reject_closure_input BEFORE INSERT ON app_inbox_items
    WHEN NEW.input_kind = 'task-closed' BEGIN SELECT RAISE(ABORT, 'closure input unavailable'); END`);
  expect(() => admitConversationTaskChange(f.context(), worker, ref)).toThrow("closure input unavailable");
  expect(f.store.readTrigger(input.taskId)).toBeNull();
  expect(source.readCancellation("sample")).toEqual(closed.cancellation);
  expect(listPendingConversationTaskChanges(f.db, app.id)).toHaveLength(1);
  f.db.exec("DROP TRIGGER reject_closure_input");
  const admitted = admitConversationTaskChange(f.context(), worker, ref);
  expect(admitted.item.input).toEqual({
    kind: "task-closed",
    data: { appId: source.appId, taskId: "sample", generation: closed.cancellation.generation, closure: closed.cancellation, topicIds: [topic.id] },
  });
  expect(admitConversationTaskChange(f.context(), worker, ref).created).toBe(false);
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
});

test("recovery scopes report lookups to linked Tasks without changing legacy JSON identity comparisons", () => {
  const f = fixture();
  const input = f.admit();
  completeCommunicationTask(f.context(), f.claim(input.taskId), decision);
  const topic = readAppConversationResource(f.db, app.id, "chat").topics[0]!;
  // Historical self-subscriptions must be excluded before their attempt bodies
  // are materialized, not just discarded after interpreting all their history.
  linkConversationTopicTask(f.db, topic.id, app.id, input.taskId);
  // This worker has history and a real link, but its only Conversation is closed.
  const closedInput = admitConversationTaskInput(f.context(), {
    ...f.input("closed-input"), conversationId: "closed-chat",
  });
  completeCommunicationTask(f.context(), f.claim(closedInput.taskId), decision);
  const closedTopic = readAppConversationResource(f.db, app.id, "closed-chat").topics[0]!;
  observeAppTaskIntent(f.context(), {
    appAgent: app.id,
    intent: { id: "closed-only", parentId: "root", outcome: "Historical measurement", acceptance: ["Measured"] },
  });
  completeAppTask(f.context(), f.claim("closed-only"), { summary: "Measured", result: { value: 17 } });
  linkConversationTopicTask(f.db, closedTopic.id, app.id, "closed-only");
  const closedOwner = f.store.readTask(closedInput.taskId)!;
  cancelAppTask(f.context(), {
    appId: app.id,
    taskId: closedInput.taskId,
    expectedGeneration: closedOwner.metadata.generation,
    expectedResourceVersion: closedOwner.metadata.resourceVersion,
    decision: "app-policy",
    reason: "Conversation retired",
  });
  expect(listConversationTaskLinks(f.db, app.id, "closed-only")).toHaveLength(1);
  admitTaskInput(f.context(), {
    appId: app.id,
    idempotencyKey: "measurement",
    inputContext: { id: input.item.id, source: input.item.source, input: { kind: "measure", data: {} } },
    topicId: topic.id,
    attachment: { kind: "desired", intent: {
      id: "7", parentId: "root", outcome: "Measure sample", acceptance: ["Observed value"],
    } },
  });
  const claim = f.claim("7");
  failAppTaskAttempt(f.context(), claim, "Source unavailable");
  const ref = { appId: app.id, conversationId: "chat", topicId: topic.id,
    taskAppId: app.id, taskId: "7", attemptId: claim.attemptId };
  const admission = f.db.prepare("SELECT task_id, admission_json FROM app_task_admissions WHERE app_id = ?")
    .all(app.id).find((row) => JSON.parse(String(row.admission_json)).taskId === "7")!;
  const saved = JSON.parse(String(admission.admission_json));
  // Upgrade a populated database. Retained payloads are not normalized or rewritten.
  f.db.exec(`DROP INDEX idx_app_task_admissions_target_text;
    CREATE INDEX idx_app_task_admissions_target ON app_task_admissions(
      app_id, json_extract(admission_json, '$.taskId'), json_extract(admission_json, '$.taskGeneration'))`);
  f.reopen();
  expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name = 'idx_app_task_admissions_target'").get()).toBeNull();
  expect(f.db.prepare("SELECT admission_json FROM app_task_admissions WHERE app_id = ? AND task_id = ?")
    .get(app.id, admission.task_id)?.admission_json).toBe(admission.admission_json);
  f.db.exec("BEGIN");
  for (let i = 0; i < 500; i++) {
    f.db.prepare("INSERT INTO app_task_admissions VALUES (?, ?, ?)").run(app.id, `unrelated-${i}`,
      JSON.stringify({ ...saved, taskId: `unrelated-${i}`, reportAttemptId: claim.attemptId }));
    f.db.prepare("INSERT INTO app_task_admissions VALUES (?, ?, ?)").run(`unrelated-app-${i}`, "report",
      JSON.stringify({ ...saved, reportAttemptId: claim.attemptId }));
    createAppInboxItem(f.db, {
      id: `historical-result-${i}`, appId: app.id, conversationId: "chat",
      source: { kind: "system", id: `historical-result-${i}` },
      input: { kind: "task-outcome", data: {
        appId: app.id, taskId: "7", attemptId: `old-attempt-${i}`, topicIds: [topic.id],
      } },
    });
  }
  f.db.prepare("UPDATE app_inbox_items SET status = 'done' WHERE id LIKE 'historical-result-%'").run();
  f.db.exec("COMMIT");
  f.db.exec("ANALYZE");
  const prepare = f.db.prepare.bind(f.db);
  let recoverySql = "";
  let recoveryArgs: unknown[] = [];
  let linkSql = "";
  let linkArgs: unknown[] = [];
  const capture = spyOn(f.db, "prepare").mockImplementation((sql) => {
    const statement = prepare(sql);
    if (sql.includes("ORDER BY linked_at, link_id")) {
      linkSql = sql;
      return { ...statement, all(...args: unknown[]) {
        linkArgs = args;
        return statement.all(...args);
      } };
    }
    if (!sql.includes("live_conversations AS MATERIALIZED")) return statement;
    recoverySql = sql;
    return { ...statement, all(...args: unknown[]) {
      recoveryArgs = args;
      return statement.all(...args);
    } };
  });
  try {
    for (const [taskId, taskGeneration, matches] of [
      ["7", 1, true], [7, "1", true], ["7", "01", true], ["7", "1e0", true],
      ["7", true, true], ["07", 1, false], ["7", "1x", false],
      ["7", 1.5, false], ["7", null, false], [null, 1, false],
    ] as const) {
      f.db.prepare("UPDATE app_task_admissions SET admission_json = ? WHERE app_id = ? AND task_id = ?")
        .run(JSON.stringify({ ...saved, taskId, taskGeneration }), app.id, admission.task_id);
      expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual(matches ? [ref] : []);
      if (!matches) expect(admitConversationTaskChange(f.context(), f.context(), ref).created).toBe(false);
    }
    const plan = prepare(`EXPLAIN QUERY PLAN ${recoverySql}`).all(...recoveryArgs);
    const admissionLookups = plan.map((step) => String(step.detail)).filter((detail) => detail.startsWith("SEARCH admission "));
    expect(admissionLookups).toEqual(expect.arrayContaining([
      expect.stringContaining("idx_app_task_admissions_target_text (app_id=? AND <expr>=?)"),
      expect.stringContaining("idx_app_task_admissions_target_text (app_id=? AND <expr>=?)"),
    ]));
    expect(plan.some((step) => String(step.detail).startsWith("SCAN admission"))).toBe(false);
    expect(admissionLookups.some((detail) => detail.includes("idx_app_task_admissions_input"))).toBe(true);
    listConversationTaskLinks(f.db, app.id, "7");
    const linkPlan = prepare(`EXPLAIN QUERY PLAN ${linkSql}`).all(...linkArgs).map((step) => String(step.detail));
    expect(linkPlan.some((detail) => detail.startsWith("SCAN admission") || detail.startsWith("SCAN origin"))).toBe(false);
    expect(linkPlan.some((detail) => detail.includes("idx_app_task_admissions_target_text (app_id=? AND <expr>=?)"))).toBe(true);
    const receiptLookups = plan.map((step) => String(step.detail)).filter((detail) => detail.startsWith("SEARCH grouped "));
    expect(receiptLookups.length).toBeGreaterThan(0);
    for (const lookup of receiptLookups) {
      expect(lookup).toContain("idx_app_inbox_conversation_change (app_id=? AND conversation_id=? AND source_kind=? AND input_kind=? AND <expr>=? AND <expr>=? AND <expr>=?)");
    }
    expect(plan.filter((step) => String(step.detail).includes("MATERIALIZE linked_tasks"))).toHaveLength(1);
    expect(plan.filter((step) => String(step.detail).includes("MATERIALIZE linked_attempts"))).toHaveLength(1);
    expect(plan.filter((step) => String(step.detail).includes("MATERIALIZE selected_reports"))).toHaveLength(1);
    expect(plan.filter((step) => String(step.detail).includes("MATERIALIZE live_conversations"))).toHaveLength(1);
    const ctes = recoverySql.slice(0, recoverySql.lastIndexOf("    SELECT appId, conversationId, topicId"));
    expect(prepare(`${ctes} SELECT app_id, task_id FROM linked_tasks`).all(...recoveryArgs.slice(0, -1))).toEqual([
      { app_id: app.id, task_id: "7" },
    ]);
    f.db.prepare("UPDATE app_task_admissions SET admission_json = ? WHERE app_id = ? AND task_id = ?")
      .run(admission.admission_json, app.id, admission.task_id);
    expect(admitConversationTaskChange(f.context(), f.context(), ref).created).toBe(true);
    expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
  } finally {
    capture.mockRestore();
  }
});

test.each(["link", "conversation"] as const)("one result reaches all linked Topics once (%s), preserving late links and Requests", (scope) => {
  const f = fixture();
  const first = f.admit();
  completeCommunicationTask(f.context(), f.claim(first.taskId), {
    summary: "Accepted two asks",
    response: "I'll compare both measurements.",
    topic: { kind: "new", title: "Measurements" },
    requestUpdates: [
      {
        id: "ask-a",
        scope: "Explain measurement A",
        expectedRevision: 0,
        disposition: "open",
        reason: "Awaiting evidence",
      },
      {
        id: "ask-b",
        scope: "Explain measurement B",
        expectedRevision: 0,
        disposition: "open",
        reason: "Awaiting evidence",
      },
    ],
  });
  observeAppTaskIntent(f.context(), {
    appAgent: app.id,
    intent: { id: "measurement", parentId: "root", outcome: "Collect evidence", acceptance: ["Measured"] },
  });
  const claim = f.claim("measurement");
  completeAppTask(f.context(), claim, { summary: "Measured", result: { value: 17 } });
  const topicIds = Array.from({ length: 15 }, (_, i) => `measurement-topic-${String(i).padStart(2, "0")}`);
  for (const id of topicIds) {
    createConversationTopic(f.db, {
      id,
      appId: app.id,
      conversationId: "chat",
      title: id,
      openedBy: "system",
      originMessageId: id,
    });
    linkConversationTopicTask(f.db, id, app.id, "measurement");
  }
  const ref = { conversationId: "chat", ...(scope === "link" ? { topicId: topicIds[7]! } : {}),
    taskId: "measurement", attemptId: claim.attemptId };
  expect(() => admitConversationTaskChange(f.context(), f.context(), { ...ref, conversationId: "unrelated" })).toThrow("no link");
  const saved = admitConversationTaskChange(f.context(), f.context(), ref);
  expect(saved.created).toBe(true);
  expect(saved.item.input.data).toMatchObject({ topicIds, outcome: { result: { value: 17 } } });
  for (const topicId of topicIds) {
    const replay = admitConversationTaskChange(f.context(), f.context(), { ...ref, topicId });
    expect(replay.created).toBe(false);
    expect(replay.item.id).toBe(saved.item.id);
  }
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
  const inputs = readCommunicationInputs(f.context(), f.claim(first.taskId));
  expect(inputs).toHaveLength(1);
  expect(readConversationRequest(f.db, app.id, "chat", "ask-a")?.status).toBe("open");
  expect(readConversationRequest(f.db, app.id, "chat", "ask-b")?.status).toBe("open");
  f.reopen();
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
  const late = "late-topic";
  createConversationTopic(f.db, {
    id: late,
    appId: app.id,
    conversationId: "chat",
    title: late,
    openedBy: "system",
    originMessageId: late,
  });
  linkConversationTopicTask(f.db, late, app.id, "measurement");
  expect(listPendingConversationTaskChanges(f.db, app.id)).toMatchObject([
    { topicId: late, attemptId: claim.attemptId },
  ]);
  const later = admitConversationTaskChange(f.context(), f.context(), { ...ref, ...(scope === "link" ? { topicId: late } : {}) });
  expect(later.created).toBe(true);
  expect(later.item.input.data).toMatchObject({ topicIds: [late] });
  expect(later.item.id).not.toBe(saved.item.id);
});

test("legacy per-Topic delivery receipts remain valid alongside new grouped receipts", () => {
  const f = fixture();
  const first = f.admit();
  completeCommunicationTask(f.context(), f.claim(first.taskId), decision);
  observeAppTaskIntent(f.context(), {
    appAgent: app.id,
    intent: {
      id: "measurement",
      parentId: "root",
      outcome: "Collect evidence",
      acceptance: ["Measured"],
    },
  });
  const claim = f.claim("measurement");
  completeAppTask(f.context(), claim, { summary: "Measured", result: { value: 17 } });
  for (const id of ["legacy-topic", "new-topic"]) {
    createConversationTopic(f.db, {
      id,
      appId: app.id,
      conversationId: "chat",
      title: id,
      openedBy: "system",
      originMessageId: id,
    });
    linkConversationTopicTask(f.db, id, app.id, "measurement");
  }
  const legacyId = `conversation-result:${app.id}:chat:legacy-topic:${app.id}:${claim.attemptId}`;
  // Seed the old wire format through the existing inbox admission path.
  const legacy = admitConversationTaskInput(f.context(), {
    id: legacyId,
    idempotencyKey: legacyId,
    appId: app.id,
    conversationId: "chat",
    topicId: "legacy-topic",
    source: { kind: "system", id: legacyId },
    input: {
      kind: "task-outcome",
      data: {
        appId: app.id,
        taskId: "measurement",
        generation: claim.generation,
        attemptId: claim.attemptId,
        outcome: f.store.readAttempt(claim.attemptId)!.acceptedResult,
      },
    },
    intent: f.store.readTask(first.taskId)!.spec,
  });
  f.reopen();
  const pending = listPendingConversationTaskChanges(f.db, app.id);
  expect(pending).toHaveLength(1);
  expect(pending[0]!.topicId).toBe("new-topic");
  const replay = admitConversationTaskChange(f.context(), f.context(), {
    conversationId: "chat",
    topicId: "legacy-topic",
    taskId: "measurement",
    attemptId: claim.attemptId,
  });
  expect(replay.created).toBe(false);
  expect(replay.item.id).toBe(legacy.item.id);
  const grouped = admitConversationTaskChange(f.context(), f.context(), pending[0]!);
  expect(grouped.created).toBe(true);
  expect(grouped.item.input.data.topicIds).toEqual(["new-topic"]);
  expect(getAppInboxItem(f.db, legacyId)?.input.data).not.toHaveProperty("topicIds");
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
});

test.each(["link", "conversation"] as const)("grouped delivery (%s) leaves overflow recoverable after restart", (scope) => {
  const f = fixture();
  const first = f.admit();
  completeCommunicationTask(f.context(), f.claim(first.taskId), decision);
  observeAppTaskIntent(f.context(), {
    appAgent: app.id,
    intent: {
      id: "measurement",
      parentId: "root",
      outcome: "Collect evidence",
      acceptance: ["Measured"],
    },
  });
  const claim = f.claim("measurement");
  completeAppTask(f.context(), claim, { summary: "Measured" });
  const topics = Array.from({ length: 105 }, (_, i) => `topic-${String(i).padStart(3, "0")}`);
  for (const id of topics) {
    createConversationTopic(f.db, {
      id,
      appId: app.id,
      conversationId: "chat",
      title: id,
      openedBy: "system",
      originMessageId: id,
    });
    linkConversationTopicTask(f.db, id, app.id, "measurement");
  }
  // A direct notification for a link outside the first sorted page must be included.
  const ref = { conversationId: "chat", ...(scope === "link" ? { topicId: topics[104]! } : {}),
    taskId: "measurement", attemptId: claim.attemptId };
  const initial = admitConversationTaskChange(f.context(), f.context(), ref);
  const initialTopics = initial.item.input.data.topicIds as string[];
  expect(initialTopics).toHaveLength(100);
  if (scope === "link") expect(initialTopics).toContain(ref.topicId);
  f.reopen();
  const remaining = listPendingConversationTaskChanges(f.db, app.id);
  expect(remaining.map((entry) => entry.topicId).sort()).toEqual(topics.filter((id) => !initialTopics.includes(id)));
  const recovered = admitConversationTaskChange(f.context(), f.context(), scope === "link" ? remaining[0]! : ref);
  const recoveredTopics = recovered.item.input.data.topicIds as string[];
  expect(recoveredTopics).toHaveLength(5);
  expect([...initialTopics, ...recoveredTopics].sort()).toEqual(topics);
  for (const topicId of topics) {
    const replay = admitConversationTaskChange(f.context(), f.context(), { ...ref, topicId });
    expect(replay.created).toBe(false);
    expect(replay.item.id).toBe(initialTopics.includes(topicId) ? initial.item.id : recovered.item.id);
  }
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
});


test("unfunded first Conversation input survives replay and storage reopen, then admits once at the next grant", async () => {
  setSystemTime(new Date("2026-11-09T12:00:00Z"));
  const f = fixture();
  const accounting = new TaskBudgetAdmissionStore(f.db);
  accounting.install({ appId: app.id, sponsor: { appId: app.id, agent: app.id }, dailyCredits: 1, rootCredits: 5 });
  observeAppTaskIntent(f.context(), { appAgent: app.id, intent: {
    id: "earlier-work", parentId: "root", outcome: "Earlier work", acceptance: ["Done"],
  } });
  const hostFor = () => new AppInboxHost({
    db: f.db, apps: [app],
    admitConversation: (input) => admitConversationTaskInput(f.context(), { ...input, intent: f.input().intent }),
  });
  let host = hostFor();
  try {
    const { intent: _intent, ...input } = f.input();
    const denied = host.admit(input);
    expect(denied.created).toBe(true);
    expect(denied.item).toMatchObject({
      id: input.id, source: input.source, input: input.input, conversationSequence: 1, status: "pending",
      handling: { phase: "deferred", funding: { reason: "sponsor-credit" } },
    });
    expect(denied.item.executionTaskId).toBeUndefined();
    expect(denied.item.taskAdmissionKey).toBe(`conversation-input:${input.id}`);
    expect(denied.item.recovery).toBeUndefined();
    expect(f.store.readTask(conversationTaskId(app.id, "chat"))).toBeNull();
    expect(host.admit(input)).toMatchObject({ created: false, item: denied.item });
    host.close();
    f.reopen();
    host = hostFor();
    await host.recoverAdmissions();
    expect(host.get(input.id)).toEqual(denied.item);
    if (denied.item.handling?.phase !== "deferred" || denied.item.handling.funding.retryAt === null)
      throw new Error("Expected UTC funding deadline");
    setSystemTime(denied.item.handling.funding.retryAt);
    await host.recoverAdmissions();
    const admitted = host.get(input.id)!;
    expect(admitted).toMatchObject({ input: input.input, source: input.source,
      executionTaskId: conversationTaskId(app.id, "chat"), taskAdmissionKey: `conversation-input:${input.id}` });
    expect(admitted.handling).toBeUndefined();
    const budget = new TaskBudgetAdmissionStore(f.db).budget;
    expect(budget.view({ appId: app.id, taskId: admitted.executionTaskId! }, Date.now())?.rootCharged).toBe(1);
    await host.recoverAdmissions();
    host.admit(input);
    expect(budget.view({ appId: app.id, taskId: admitted.executionTaskId! }, Date.now())?.rootCharged).toBe(1);
  } finally { host.close(); }
});

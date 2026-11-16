import { Type, defineApp } from "@may-agent/sdk/app";
import { afterEach, expect, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completeCommunicationTask, readCommunicationInputs } from "../../../../test/fixtures/communication.js";
import { claimAppInboxItem } from "../../../../test/fixtures/legacy-inbox.js";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  closeAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
  reopenAppTask,
} from "../tasks/app-task-reconciler.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { readConversationRequest } from "./conversation-requests.js";
import {
  admitConversationTaskInput,
  stopConversationTaskTurn,
} from "./conversation-task-turns.js";
import { createConversationTopic, readAppConversationResource } from "./conversations.js";
import { admitTaskInput } from "./inbox.js";
import { readTaskInputs } from "../tasks/app-task-inputs.js";

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
const decision: Parameters<typeof completeCommunicationTask>[2] = {
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
    const proposed: Parameters<typeof completeCommunicationTask>[2] = {
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

test.each([false, true])("mixed-batch Stop retains ordinary input and its return link across restart (continued: %s)", (continued) => {
  const f = fixture();
  const chat = f.admit();
  const evidence = createAppInboxItem(f.db, {
    id: "evidence", appId: app.id, source: { kind: "app", id: "reviewer" },
    targetTaskId: chat.taskId, input: { kind: "evidence", data: { finding: "Verified" } },
    channel: "agent:reviewer", idempotencyKey: "review-result",
  }).item;
  admitTaskInput(f.context(), {
    appId: app.id, attachment: { kind: "existing", taskId: chat.taskId },
    idempotencyKey: "task:evidence", inboxInputId: evidence.id,
    inputContext: { id: evidence.id, source: evidence.source, input: evidence.input },
  });
  let claim = f.claim(chat.taskId);
  if (continued) {
    deferAppTask(f.context(), claim, { disposition: "waiting", continue: true, summary: "Continue verification" });
    claim = f.claim(chat.taskId);
    expect(claim.continuedInputKeys).toContain("task:evidence");
  }
  const newer = f.admit("newer", 2);
  const before = getAppInboxItem(f.db, evidence.id);
  const target = { appId: app.id, conversationId: "chat", turnId: claim.attemptId, expectedRevision: claim.generation };
  const taskBefore = f.store.readTask(chat.taskId);
  f.db.exec(`CREATE TRIGGER refuse_mixed_stop BEFORE UPDATE OF handling ON app_inbox_items
    BEGIN SELECT RAISE(ABORT, 'cannot record mixed Stop'); END`);
  expect(() => stopConversationTaskTurn(f.context(), target)).toThrow("cannot record mixed Stop");
  expect(f.store.readTask(chat.taskId)).toEqual(taskBefore);
  expect(f.store.readAttempt(claim.attemptId)?.state).toBe("running");
  expect(getAppInboxItem(f.db, evidence.id)).toEqual(before);
  f.db.exec("DROP TRIGGER refuse_mixed_stop");
  expect(stopConversationTaskTurn(f.context(), target).changed).toBe(true);
  expect(f.store.readAttempt(claim.attemptId)).toMatchObject({ state: "interrupted", failureReason: "owner-stopped" });
  expect(getAppInboxItem(f.db, chat.item.id)?.handling?.phase).toBe("stopped");
  expect(getAppInboxItem(f.db, chat.item.id)?.result?.response).toContain("Stopped this turn");
  expect(getAppInboxItem(f.db, evidence.id)).toEqual(before);
  expect(getAppInboxItem(f.db, newer.item.id)?.status).not.toBe("done");
  expect(readAppTaskAdmissionOutcome(f.context(), chat.taskId, "task:evidence")).toBeNull();
  f.reopen();
  expect(stopConversationTaskTurn(f.context(), target).changed).toBe(false);
  expect(getAppInboxItem(f.db, evidence.id)).toEqual(before);
  const next = f.claim(chat.taskId);
  expect(readTaskInputs(f.context(), next).map(({ key }) => key).sort()).toEqual([
    "conversation-input:newer", "task:evidence",
  ]);
  completeAppTask(f.context(), next, { summary: "Evidence accepted", inputKeys: ["task:evidence"] });
  expect(readAppTaskAdmissionOutcome(f.context(), chat.taskId, "task:evidence")).toMatchObject({
    state: "converged", summary: "Evidence accepted",
  });
  expect(getAppInboxItem(f.db, chat.item.id)?.handling?.phase).toBe("stopped");
  expect(getAppInboxItem(f.db, newer.item.id)?.status).not.toBe("done");
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
  const host = new AppInboxHost({
    db: f.db,
    apps: [app],
  });
  expect(claimAppInboxItem(f.db, input.item.id, "legacy", 1_000)).toBeNull();
  expect(claimAppInboxItem(f.db, "old-route", "legacy", 1_000)).toBeNull();

  await host.recoverAdmissions();
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

test.each(["cancelled", "closed"] as const)(
  "an agent-backed %s Conversation retains immutable lineage and requires a successor across restart",
  (ending) => {
    const f = fixture();
    const admitted = f.admit();
    const claim = f.claim(admitted.taskId);
    completeAppTask(f.context(), claim, { summary: "Discussion result retained" });
    const current = f.store.readTask(admitted.taskId)!;
    expect(current.spec.executor).toBe("agent");
    const control = {
      appId: app.id, taskId: admitted.taskId,
      expectedGeneration: current.metadata.generation,
      expectedResourceVersion: current.metadata.resourceVersion,
      decision: "app-policy" as const, reason: "Owner ended the discussion",
    };
    if (ending === "cancelled") cancelAppTask(f.context(), control);
    else closeAppTask(f.context(), { ...control, afterResult: claim.attemptId });
    const ended = f.store.readTask(admitted.taskId);
    const closure = f.store.readCancellation(admitted.taskId);
    const reopen = () => reopenAppTask(f.context(), {
      ...control,
      expectedGeneration: ended!.metadata.generation,
      expectedResourceVersion: ended!.metadata.resourceVersion,
      controlKey: "explicit-continuation", reason: "Human requested another discussion",
    });
    expect(reopen).toThrow("Conversation input must use its linked successor");
    f.reopen();
    expect(reopen).toThrow("Conversation input must use its linked successor");
    expect(f.store.readTask(admitted.taskId)).toEqual(ended);
    expect(f.store.readCancellation(admitted.taskId)).toEqual(closure);
    const successor = f.admit("next-discussion", 2);
    expect(successor.taskId).toBe(`${admitted.taskId}_successor_2`);
    expect(f.store.readTask(admitted.taskId)).toEqual(ended);
  },
);

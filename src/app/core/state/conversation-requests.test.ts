import { afterEach, expect, test, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp, type ConversationTurnResult, type AppConversationRequestUpdate } from "@may-agent/sdk";
import { getDb, closeDb } from "../../../lib/requests.js";
import { APP_REQUEST_CONVERSATION_MAX_BYTES, boundedAppRequestConversation } from "../../conversations/context.js";
import type { AppInputResolver } from "../../conversations/turn-agent.js";
import { prepareConversationTaskTurn } from "../../composition/conversation-task-turn.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  failAppTaskAttempt,
  reportAppTaskFailure,
} from "../tasks/app-task-reconciler.js";
import {
  createConversationTopic,
  linkConversationTopicTask,
  readAppConversationResource,
  readConversationTopic,
} from "./conversations.js";
import { readConversationRequest, applyConversationRequestUpdates } from "./conversation-requests.js";
import {
  admitConversationTaskInput,
  admitConversationTaskChange,
  completeConversationTaskTurn,
  conversationTaskId,
  conversationTaskIntent,
  listPendingConversationTaskChanges,
  stopConversationTaskTurn,
} from "./conversation-task-turns.js";
import { getAppInboxItem } from "./app-inbox-store.js";

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
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ text: Type.String() }) }),
  conversation: { mode: "agent" },
});
const owner = defineApp({
  id: "owner",
  version: 1,
  agent: "owner",
  inputSchema: Type.Object({}),
  tasks: {},
  task: () => ({
    kind: "desired",
    intent: { id: "work", parentId: "project", outcome: "Find facts", acceptance: ["Verified"] },
  }),
});
const answer: ConversationTurnResult = {
  summary: "Answer",
  response: "Here is the comparison.",
  topic: { kind: "none" },
};
const ask: AppConversationRequestUpdate = {
  id: "comparison",
  expectedRevision: 0,
  scope: "Compare two options",
  disposition: "open",
};
const handoff: ConversationTurnResult = {
  ...answer,
  topic: { kind: "new", title: "Comparison" },
  followUp: {
    requestId: ask.id,
    appId: owner.id,
    outcome: "Find facts",
    acceptance: ["Verified"],
    input: { kind: "work", data: {} },
  },
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-accepted-asks-"));
  roots.push(root);
  let db = getDb(root);
  const context = (appId = app.id) =>
    appTaskContext({
      appDir: root,
      projectDir: root,
      agent: appId,
      resourceStore: AppTaskResourceStore.fromDb(db, appId),
    });
  for (const definition of [app, owner])
    context(definition.id).resourceStore.bootstrapSnapshot(
      {
        project: definition.id,
        project_lifecycle: "active",
        root_task_id: "project",
        groups: { project: { id: "project", parent_id: null } },
      },
      "request-fixture",
    );
  let sequence = 0;
  const taskId = conversationTaskId(app.id, "chat");
  const prepare = async (decision: ConversationTurnResult | AppInputResolver, admit = true) => {
    if (admit) {
      const id = `turn-${++sequence}`;
      admitConversationTaskInput(context(), {
        id,
        appId: app.id,
        conversationId: "chat",
        conversationSequence: sequence,
        source: { kind: "human", id },
        input: { kind: "message", data: { text: "Review" } },
        intent: conversationTaskIntent(context()),
      });
    }
    const claim = claimObservedAppTask(context(), { taskId, appAgent: app.id, handler: "executor:conversation" });
    if (claim.kind !== "claimed") throw new Error(`Expected Conversation claim, got ${claim.kind}`);
    const proposal = await prepareConversationTaskTurn({
      config: context(),
      claim,
      app,
      resolveConversationInput: typeof decision === "function" ? decision : async () => decision,
      getTaskApp: (appId) => ({ app: owner, config: context(appId) }),
      signal: new AbortController().signal,
    });
    return {
      claim,
      proposal,
      settle: () => completeConversationTaskTurn(context(), claim, proposal.decision, proposal),
      stop: () =>
        stopConversationTaskTurn(context(), {
          appId: app.id,
          conversationId: "chat",
          turnId: claim.attemptId,
          expectedRevision: claim.generation,
        }),
    };
  };
  return {
    root,
    get db() {
      return db;
    },
    context,
    taskId,
    prepare,
    async turn(decision: ConversationTurnResult | AppInputResolver) {
      const turn = await prepare(decision);
      return turn.settle();
    },
    reopen() {
      closeDb(root);
      db = getDb(root);
    },
  };
}

test("a discussion-only ask closes with its answer through one stable execution Task", async () => {
  const f = fixture();
  await f.turn({ ...answer, requestUpdates: [{ ...ask, disposition: "fulfilled", reason: "Both options compared" }] });
  const request = readConversationRequest(f.db, app.id, "chat", ask.id)!;
  expect(request).toMatchObject({
    status: "closed",
    scope: ask.scope,
    closure: { disposition: "fulfilled", messageId: "result:turn-1" },
  });
  expect(f.db.prepare("SELECT task_id FROM app_tasks WHERE app_id = ?").all(app.id)).toEqual([{ task_id: f.taskId }]);
  expect(f.context(owner.id).resourceStore.readTask("work")).toBeNull();
  expect(
    readAppConversationResource(f.db, app.id, "chat").messages.some(
      (message) => message.id === request.closure!.messageId && message.text === answer.response,
    ),
  ).toBe(true);
  expect(f.context().resourceStore.isCancelled(f.taskId)).toBe(false);
});

test("corrections retain identity; stale closure and silent scope narrowing are rejected", async () => {
  const f = fixture();
  await f.turn({ ...answer, requestUpdates: [ask] });
  const correction = { ...ask, expectedRevision: 1, scope: "Compare both options including costs" };
  await f.turn({ ...answer, requestUpdates: [correction] });
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
    revision: 2,
    scope: correction.scope,
    status: "open",
  });
  for (const expectedRevision of [1, 2]) {
    const stale = await f.prepare({
      ...answer,
      requestUpdates: [{ ...ask, expectedRevision, disposition: "fulfilled", reason: "Old review" }],
    });
    expect(stale.settle).toThrow();
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
      revision: 2,
      scope: correction.scope,
      status: "open",
    });
    // The human stops each rejected test turn before making another correction.
    stale.stop();
  }
  await f.turn({
    ...answer,
    response: "Withdrawn; no background work was started.",
    requestUpdates: [
      { ...correction, expectedRevision: 2, disposition: "withdrawn", reason: "Human withdrew the ask" },
    ],
  });
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.closure?.disposition).toBe("withdrawn");
});

test("failed reply rolls back Request closure; restart redoes the retained input through its Task", async () => {
  const f = fixture();
  await f.turn({ ...answer, requestUpdates: [ask] });
  let calls = 0;
  const decide: AppInputResolver = async () => {
    calls++;
    return {
      ...answer,
      requestUpdates: [{ ...ask, expectedRevision: 1, disposition: "fulfilled", reason: "Compared" }],
    };
  };
  const turn = await f.prepare(decide);
  f.db.exec(`CREATE TRIGGER reject_result BEFORE UPDATE ON app_inbox_items WHEN NEW.result IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'fixture write failure'); END;`);
  expect(turn.settle).toThrow("fixture write failure");
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.status).toBe("open");
  expect(failAppTaskAttempt(f.context(), turn.claim, "fixture write failure").status).toBe("retrying");
  const due = f.context().resourceStore.readTask(f.taskId)!.status.executionRetryAt!;
  f.db.exec("DROP TRIGGER reject_result");
  f.reopen();
  setSystemTime(new Date(due + 1));
  const retry = await f.prepare(decide, false);
  expect(retry.settle().status).toBe("applied");
  expect(calls).toBe(2);
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.closure?.messageId).toBe("result:turn-2");
  expect(getAppInboxItem(f.db, "turn-2")?.status).toBe("done");
});

test("Task links accumulate without duplicates; overflow and unknown links roll back the update batch", () => {
  const { db } = fixture();
  createConversationTopic(db, {
    id: "topic",
    appId: app.id,
    conversationId: "chat",
    title: "Work",
    openedBy: "human",
    originMessageId: "first",
  });
  const refs = Array.from({ length: 33 }, (_, i) => ({ appId: owner.id, taskId: `work-${i}` }));
  for (const ref of refs) linkConversationTopicTask(db, "topic", ref.appId, ref.taskId);
  const update = (updates: AppConversationRequestUpdate[], updateKey: string) =>
    applyConversationRequestUpdates(db, {
      appId: app.id,
      conversationId: "chat",
      topicId: "topic",
      updates,
      updateKey,
      now: 1,
    });
  update([{ ...ask, taskRefs: refs.slice(0, 31) }], "accept");
  const addition = { ...ask, expectedRevision: 1, taskRefs: [refs[30]!, refs[31]!, refs[31]!] };
  update([addition], "add");
  update([addition], "add");
  expect(readConversationRequest(db, app.id, "chat", ask.id)).toMatchObject({
    revision: 2,
    taskRefs: refs.slice(0, 32),
  });
  expect(() =>
    update(
      [
        { ...ask, id: "rollback" },
        { ...ask, expectedRevision: 2, taskRefs: [refs[32]!] },
      ],
      "overflow",
    ),
  ).toThrow("Task link limit reached");
  expect(readConversationRequest(db, app.id, "chat", "rollback")).toBeNull();
  expect(readConversationRequest(db, app.id, "chat", ask.id)?.revision).toBe(2);
  expect(() =>
    update(
      [
        { ...ask, id: "rollback" },
        { ...ask, id: "unknown", taskRefs: [{ appId: "elsewhere", taskId: "private" }] },
      ],
      "unknown",
    ),
  ).toThrow("outside this Conversation");
  expect(readConversationRequest(db, app.id, "chat", "rollback")).toBeNull();
  expect(readConversationRequest(db, app.id, "chat", "unknown")).toBeNull();
});

test.each([
  ["preserve", "done"],
  ["add", "done"],
  ["preserve", "retrying"],
  ["preserve", "human-cancel"],
  ["preserve", "app-failure"],
] as const)("handoff and Request closure stay atomic (%s Task links, %s outcome)", async (links, taskOutcome) => {
  const f = fixture();
  await f.turn({ ...answer, topic: { kind: "new", title: "Original discussion" }, requestUpdates: [ask] });
  const original = readConversationRequest(f.db, app.id, "chat", ask.id)!;
  await f.turn(handoff);
  const accepted = readConversationRequest(f.db, app.id, "chat", ask.id)!;
  expect(accepted.taskRefs).toEqual([{ appId: owner.id, taskId: "work" }]);
  expect(accepted.status).toBe("open");
  expect(accepted.topicId).toBe(original.topicId);
  const handoffTopic = getAppInboxItem(f.db, "turn-2")!.topicId!;
  expect(handoffTopic).not.toBe(accepted.topicId);
  let config = f.context(owner.id);
  let claim = claimObservedAppTask(config, { taskId: "work", appAgent: owner.id, handler: "agent:owner" });
  if (claim.kind !== "claimed") throw new Error("fixture claim");
  const firstAttemptId = claim.attemptId;
  if (taskOutcome === "done") completeAppTask(config, claim, { summary: "Facts collected" });
  else if (taskOutcome === "retrying") {
    for (let i = 0; i < 6; i++) {
      if (claim.kind !== "claimed") throw new Error("fixture retry claim");
      expect(failAppTaskAttempt(config, claim, "Facts source unavailable").status).toBe("retrying");
      if (i < 5) {
        setSystemTime(new Date(config.resourceStore.readTask("work")!.status.executionRetryAt! + 1));
        claim = claimObservedAppTask(config, { taskId: "work", appAgent: owner.id, handler: "agent:owner" });
      }
    }
  } else if (taskOutcome === "human-cancel") {
    const task = config.resourceStore.readTask("work")!;
    expect(
      cancelAppTask(config, {
        appId: owner.id,
        taskId: "work",
        expectedGeneration: task.metadata.generation,
        expectedResourceVersion: task.metadata.resourceVersion,
        reason: "Human cancelled facts collection",
      }).applied,
    ).toBe(true);
  } else
    expect(
      reportAppTaskFailure(config, claim, { summary: "Facts source unavailable", facts: ["fixture:source"] }).status,
    ).toBe("applied");
  const settledTask = config.resourceStore.readTaskContext({ taskIds: ["work"] });
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toEqual(accepted);
  expect(config.resourceStore.isCancelled("work")).toBe(taskOutcome === "human-cancel");
  // Reopen and return only stored outcomes/closure. Repeated execution failures
  // supply one factual report, never an accepted answer or Request closure.
  f.reopen();
  config = f.context(owner.id);
  expect(config.resourceStore.readTaskContext({ taskIds: ["work"] })).toEqual(settledTask);
  const pending = listPendingConversationTaskChanges(f.db, app.id);
  const change = pending.find((change) => change.taskId === "work" && change.topicId === handoffTopic)!;
  expect(change).toBeDefined();
  const returned = admitConversationTaskChange(f.context(), config, change);
  if (taskOutcome === "retrying") {
    expect(pending).toHaveLength(1);
    expect(change.attemptId).toBe(firstAttemptId);
    expect(config.resourceStore.readAttempt(firstAttemptId)?.acceptedResult).toBeUndefined();
    expect(returned.item?.input.data).toMatchObject({
      outcome: { state: "error", facts: [`task-attempt:${firstAttemptId}`] },
    });
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toEqual(accepted);
  }
  const extraRef = { appId: owner.id, taskId: "additional-facts" };
  if (links === "add") linkConversationTopicTask(f.db, accepted.topicId!, extraRef.appId, extraRef.taskId);
  const addedRefs = links === "add" ? [extraRef] : [];
  const resultRefs = [...accepted.taskRefs, ...addedRefs];
  const closureText =
    taskOutcome === "done"
      ? "Both options compared with costs."
      : "I cannot provide the comparison with the available facts. Background work retains its own controls.";
  const update: AppConversationRequestUpdate = {
    ...ask,
    expectedRevision: accepted.revision,
    disposition: taskOutcome === "done" ? "fulfilled" : "unfulfilled",
    reason: closureText,
    taskRefs: addedRefs,
  };
  const turn = await f.prepare(
    { ...answer, response: closureText, topic: { kind: "existing", id: accepted.topicId! }, requestUpdates: [update] },
    taskOutcome === "retrying",
  );
  const before = readConversationRequest(f.db, app.id, "chat", ask.id);
  f.db.exec(`CREATE TRIGGER reject_reply BEFORE UPDATE ON app_inbox_items WHEN NEW.result IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'fixture reply failure'); END;`);
  expect(turn.settle).toThrow("fixture reply failure");
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toEqual(before);
  f.db.exec("DROP TRIGGER reject_reply");
  applyConversationRequestUpdates(f.db, {
    appId: app.id,
    conversationId: "chat",
    updates: [{ ...ask, expectedRevision: accepted.revision, scope: "Compare options including costs" }],
    updateKey: "correction",
    now: Date.now(),
  });
  expect(turn.settle).toThrow();
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
    status: "open",
    revision: accepted.revision + 1,
  });
  update.expectedRevision++;
  update.scope = "Compare options including costs";
  expect(turn.settle().status).toBe("applied");
  const closed = readConversationRequest(f.db, app.id, "chat", ask.id)!;
  expect(closed.closure?.disposition).toBe(update.disposition);
  expect(closed.taskRefs).toEqual(resultRefs);
  expect(() => turn.settle()).toThrow();
  expect(
    readAppConversationResource(f.db, app.id, "chat")
      .messages.filter((message) => message.id === closed.closure?.messageId)
      .map((message) => message.text),
  ).toEqual([closureText]);
  expect(readConversationTopic(f.db, app.id, "chat", accepted.topicId!)?.taskRefs).toEqual(
    expect.arrayContaining(addedRefs.map((ref) => expect.objectContaining(ref))),
  );
  expect(config.resourceStore.readTaskContext({ taskIds: ["work"] })).toEqual(settledTask);
});

test("open asks fit bounded context; an omitted ask can still be read and handed off by exact identity", async () => {
  const f = fixture();
  createConversationTopic(f.db, {
    id: "topic",
    appId: app.id,
    conversationId: "chat",
    title: "Research",
    openedBy: "human",
    originMessageId: "human",
  });
  for (let i = 0; i < 20; i++)
    applyConversationRequestUpdates(f.db, {
      appId: app.id,
      conversationId: "chat",
      topicId: "topic",
      updates: [{ ...ask, id: `ask-${i}`, scope: "界".repeat(2000) }],
      updateKey: `accept-${i}`,
      now: i,
    });
  const bounded = boundedAppRequestConversation(readAppConversationResource(f.db, app.id, "chat"), "new");
  expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThanOrEqual(APP_REQUEST_CONVERSATION_MAX_BYTES);
  expect(bounded.requests!.length).toBeGreaterThan(0);
  expect(bounded.requests!.every((item) => item.scope.length === 2000)).toBe(true);
  await f.turn(async ({ request }) => {
    expect(request.conversation?.requests?.some((item) => item.id === "ask-0")).toBe(false);
    expect(readConversationRequest(f.db, app.id, "chat", "ask-0")).toMatchObject({
      status: "open",
      scope: "界".repeat(2000),
    });
    return {
      ...handoff,
      topic: { kind: "existing", id: "topic" },
      followUp: { ...handoff.followUp!, requestId: "ask-0" },
    };
  });
  expect(readConversationRequest(f.db, app.id, "chat", "ask-0")).toMatchObject({
    status: "open",
    taskRefs: [{ appId: owner.id, taskId: "work" }],
  });
  expect(f.context(owner.id).resourceStore.readTask("work")).not.toBeNull();
});

test.each(["closed", "foreign"])("a %s ask cannot be handed off through the scoped store fallback", async (state) => {
  const f = fixture();
  applyConversationRequestUpdates(f.db, {
    appId: app.id,
    conversationId: state === "foreign" ? "other" : "chat",
    updates: [
      { ...ask, ...(state === "closed" ? { disposition: "fulfilled" as const, reason: "Already answered" } : {}) },
    ],
    updateKey: "accept",
    messageId: "answer",
    now: 1,
  });
  const turn = await f.prepare(handoff);
  expect(turn.settle).toThrow("open accepted Request");
  expect(f.context(owner.id).resourceStore.readTask("work")).toBeNull();
  expect(getAppInboxItem(f.db, "turn-1")?.result).toBeUndefined();
  expect(f.db.prepare("SELECT count(*) AS count FROM conversation_topics").get()!.count).toBe(0);
});

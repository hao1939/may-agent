import { afterEach, expect, test, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Check } from "typebox/value";
import { Type, defineApp, type ConversationTurnResult, type AppConversationRequestUpdate } from "@may-agent/sdk";
import { getDb, closeDb } from "../../../lib/requests.js";
import { APP_REQUEST_CONVERSATION_MAX_BYTES, boundedAppRequestConversation } from "../../conversations/context.js";
import type { AppInputResolver } from "../tasks/execution.js";
import { prepareConversationTaskTurn } from "../../composition/conversation-task-turn.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
  reportAppTaskFailure,
} from "../tasks/app-task-reconciler.js";
import {
  createConversationTopic,
  listConversationTopicLinksForTask,
  readAppConversationResource,
  readConversationTopic,
} from "./conversations.js";
import { readConversationRequest, applyConversationRequestUpdates, listConversationInputRequests } from "./conversation-requests.js";
import { listConversationTaskLinks } from "./conversation-task-links.js";
import { reviseAppTask } from "../tasks/task-revision.js";
import {
  admitConversationTaskInput,
  admitConversationTaskChange,
  completeConversationTaskTurn,
  conversationTaskId,
  conversationTaskIntent,
  listPendingConversationTaskChanges,
  stopConversationTaskTurn,
  updateConversationTaskRequest,
  readConversationTaskInputs,
  conversationTaskResultSchema,
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
  task: ({ input }) => {
    const source = (input.data as { source?: string }).source;
    return {
      kind: "desired",
      intent: {
        id: "work",
        parentId: "project",
        outcome: source ? `Find facts using source ${source}` : "Find facts",
        acceptance: source ? [`Verify facts from ${source}`] : ["Verified"],
        ...(source ? { input: { source } } : {}),
      },
    };
  },
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
  reason: "Waiting for both measurements before comparing the options",
};
const handoff: ConversationTurnResult = {
  ...answer,
  topic: { kind: "new", title: "Comparison" },
  followUp: {
    requestId: ask.id,
    appId: owner.id,
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
    const getTaskApp = (appId: string) => ({ app: owner, config: context(appId) });
    const proposal = await prepareConversationTaskTurn({
      config: context(),
      claim,
      app,
      resolveConversationInput: typeof decision === "function" ? decision : async () => decision,
      getTaskApp,
      signal: new AbortController().signal,
    });
    return {
      claim,
      proposal,
      settle: () => completeConversationTaskTurn(context(), claim, proposal.decision, { ...proposal, getTaskApp }),
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

test("missed worker feedback uses ordinary recovery, creator correction and the same worker reconciliation", async () => {
  const f = fixture();
  await f.turn({ ...handoff, topic: undefined, requestUpdates: [ask] });
  const originalRequest = readConversationRequest(f.db, app.id, "chat", ask.id)!;
  const worker = f.context(owner.id);
  const claim = claimObservedAppTask(worker, { taskId: "work", appAgent: owner.id, handler: "agent:owner" });
  if (claim.kind !== "claimed") throw new Error("Expected worker claim");
  reportAppTaskFailure(worker, claim, { summary: "Source alpha is unavailable; use the authorized source beta",
    result: { proposedCorrection: "Use source beta" }, facts: ["source:alpha-unavailable"] });
  // No notification delivery. Existing discovery reads the saved ordinary result after restart.
  f.reopen();
  const changes = listPendingConversationTaskChanges(f.db, app.id);
  const change = changes.find((item) => item.taskId === "work")!;
  expect(change.attemptId).toBe(claim.attemptId);
  const feedback = admitConversationTaskChange(f.context(), f.context(owner.id), change);
  expect(feedback.item?.source.kind).toBe("system");
  const review = await f.prepare(async ({ inputContext, execution }) => {
    expect(inputContext.input).toMatchObject({
      kind: "task-outcome",
      data: { outcome: { result: { proposedCorrection: "Use source beta" } } },
    });
    reviseAppTask({
      source: f.context(),
      target: f.context(owner.id),
      app: owner,
      actor: execution.taskBinding,
      change: {
        appId: owner.id,
        taskId: "work",
        expectedGeneration: 1,
        input: { kind: "work", data: { source: "beta" } },
      },
    });
    return {
      summary: "Use the authorized alternative",
      response: "I switched the measurement to source beta.",
      requestUpdates: [{ id: ask.id, expectedRevision: originalRequest.revision, disposition: "open", reason: "Waiting for corrected measurements" }],
    };
  }, false);
  expect(f.context(owner.id).resourceStore.readTask("work")?.spec.input).toEqual({ source: "beta" });
  review.settle();
  const revisedRequest = readConversationRequest(f.db, app.id, "chat", ask.id)!;
  expect(revisedRequest).toMatchObject({ scope: originalRequest.scope, status: "open", revision: originalRequest.revision + 1 });
  f.reopen();
  setSystemTime(f.context(owner.id).resourceStore.readTask("work")!.status.executionRetryAt! + 1);
  const next = claimObservedAppTask(f.context(owner.id), { taskId: "work", appAgent: owner.id, handler: "agent:owner" });
  if (next.kind !== "claimed") throw new Error("Expected revised worker claim");
  expect(next).toMatchObject({ taskId: claim.taskId, generation: 2,
    intent: { outcome: "Find facts using source beta", acceptance: ["Verify facts from beta"] } });
  expect(completeAppTask(f.context(owner.id), claim, { summary: "Late old result" }).status).toBe("stale");
  completeAppTask(f.context(owner.id), next, { summary: "Verified beta facts", facts: ["source:beta"] });
  const returned = listPendingConversationTaskChanges(f.db, app.id).find((item) => item.attemptId === next.attemptId)!;
  expect(returned).toBeDefined();
  admitConversationTaskChange(f.context(), f.context(owner.id), returned);
  const acceptance = await f.prepare({ ...answer,
    requestUpdates: [{ id: ask.id, expectedRevision: revisedRequest.revision, disposition: "fulfilled", reason: "Verified beta facts satisfy the comparison" }] }, false);
  acceptance.settle();
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.status).toBe("closed");
  expect(f.context(owner.id).resourceStore.readTask("work")?.metadata.creator).toEqual({ appId: app.id, taskId: f.taskId });
});

test("Request spec and fulfillment share a stable creator, with stale and foreign decisions rejected", async () => {
  const f = fixture();
  await f.turn({ ...answer, requestUpdates: [ask] });
  const creator = { appId: app.id, taskId: f.taskId };
  const before = readConversationRequest(f.db, app.id, "chat", ask.id)!;
  expect(before).toMatchObject({ revision: 1, scope: ask.scope, status: "open" });
  const update = { appId: app.id, conversationId: "chat", now: Date.now(), updateKey: "foreign",
    updates: [{ ...ask, expectedRevision: 1, scope: "Discard part of the ask" }] };
  expect(() => applyConversationRequestUpdates(f.db, { ...update, actor: { appId: app.id, taskId: "sibling" } }))
    .toThrow("Conversation Request actor does not own this Conversation");
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toEqual(before);
  await f.turn({ ...answer, requestUpdates: [{ ...ask, expectedRevision: 1, scope: "Compare three options" }] });
  f.reopen();
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
    revision: 2,
    scope: "Compare three options",
    status: "open",
  });
  expect(() =>
    applyConversationRequestUpdates(f.db, {
      ...update,
      messageId: "old-answer",
      actor: creator,
      updates: [{ id: ask.id, expectedRevision: 1, disposition: "fulfilled", reason: "Old requirements met" }],
    }),
  ).toThrow("revision changed");
  await f.turn({ ...answer, requestUpdates: [{ id: ask.id, expectedRevision: 2, disposition: "fulfilled", reason: "All three compared" }] });
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
    scope: "Compare three options",
    status: "closed",
  });
});

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

test("an immediate correction survives failed reply and reopen; closure still commits with its answer", async () => {
  const f = fixture();
  await f.turn({ ...answer, requestUpdates: [{ ...ask, disposition: "unfulfilled", reason: "Source unavailable" }] });
  const decision: ConversationTurnResult = {
    ...answer,
    response: "You corrected the source; I compared the corrected options including costs.",
    requestUpdates: [
      {
        id: ask.id,
        expectedRevision: 2,
        disposition: "fulfilled",
        reason: "Comparison verified",
      },
    ],
  };
  const turn = await f.prepare(async ({ execution }) => {
    const change = { id: ask.id, expectedRevision: 1, scope: "Compare corrected options including costs" };
    const saved = execution.updateRequest!(change, "correct-source");
    expect(saved).toMatchObject({ revision: 2, scope: change.scope, status: "open" });
    expect(saved.closure).toBeUndefined();
    expect(execution.updateRequest!(change, "correct-source")).toEqual(saved);
    expect(() => execution.updateRequest!({ ...change, scope: "Stale" }, "other-call")).toThrow("revision changed");
    return decision;
  });
  f.db.exec(`CREATE TRIGGER reject_correction BEFORE UPDATE ON app_inbox_items WHEN NEW.result IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'fixture reply failure'); END;`);
  expect(turn.settle).toThrow("fixture reply failure");
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
    revision: 2,
    scope: "Compare corrected options including costs",
    status: "open",
  });
  f.db.exec("DROP TRIGGER reject_correction");
  f.reopen();
  expect(turn.settle().status).toBe("applied");
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
    revision: 3,
    scope: "Compare corrected options including costs",
    closure: { disposition: "fulfilled" },
  });
  expect(readAppConversationResource(f.db, app.id, "chat").messages.at(-1)?.text).toBe(decision.response);
});

test("closure omits scope; new asks require scope and correction cannot bypass revision", async () => {
  const f = fixture();
  await f.turn({ ...answer, requestUpdates: [ask] });
  await f.turn({
    ...answer,
    requestUpdates: [{ id: ask.id, expectedRevision: 1, disposition: "fulfilled", reason: "Compared" }],
  });
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
    revision: 2,
    scope: ask.scope,
    status: "closed",
  });
  expect(readAppConversationResource(f.db, app.id, "chat").requests).toEqual([
    expect.objectContaining({ id: ask.id, revision: 2, status: "closed" }),
  ]);
  const apply = (updates: AppConversationRequestUpdate[], updateKey = "test") =>
    applyConversationRequestUpdates(f.db, {
      appId: app.id,
      conversationId: "chat",
      messageId: "test-response",
      now: Date.now(),
      updates,
      updateKey,
    });
  expect(() => apply([{ id: "missing", expectedRevision: 0, disposition: "open" }])).toThrow("requires a scope");
  expect(() =>
    apply([
      {
        ...ask,
        expectedRevision: 1,
        scope: "Changed",
        disposition: "fulfilled",
        reason: "Done",
      },
    ]),
  ).toThrow("revision changed");
  expect(() =>
    apply([
      {
        ...ask,
        expectedRevision: 2,
        scope: "Narrower",
        disposition: "fulfilled",
        reason: "Done",
      },
    ]),
  ).toThrow("closure changes scope");
  const correction: AppConversationRequestUpdate = {
    ...ask,
    expectedRevision: 2,
    scope: "Corrected",
    disposition: "open",
  };
  apply([correction], "correct");
  apply([correction], "correct");
  const close: AppConversationRequestUpdate = {
    id: ask.id,
    expectedRevision: 3,
    disposition: "fulfilled",
    reason: "Same outcome",
  };
  apply([close], "close-without-scope");
  apply([close], "close-without-scope");
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({ revision: 4, scope: "Corrected" });
});

test.each(["stop", "failure", "completion"] as const)(
  "saved requirements survive %s; the old executor cannot update them",
  async (end) => {
    const f = fixture();
    let update!: NonNullable<Parameters<AppInputResolver>[0]["execution"]["updateRequest"]>;
    const turn = await f.prepare(async ({ execution }) => {
      update = execution.updateRequest!;
      update({ id: ask.id, expectedRevision: 0, scope: ask.scope! }, "accept");
      return { ...answer, requestUpdates: [{ id: ask.id, expectedRevision: 1, disposition: "open",
        reason: "Waiting for the requested measurements" }] };
    });
    if (end === "stop") turn.stop();
    else if (end === "failure") failAppTaskAttempt(f.context(), turn.claim, "Helper failed");
    else turn.settle();
    expect(() => update({ id: ask.id, expectedRevision: 1, scope: "Late change" }, "late")).toThrow();
    f.reopen();
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({
      revision: end === "completion" ? 2 : 1,
      scope: ask.scope,
      status: "open",
    });
  },
);

test("requirement saves accept considered scope and leave later corrections for the next turn", async () => {
  const f = fixture();
  await f.turn({ ...answer, requestUpdates: [ask] });
  const turn = await f.prepare(async ({ execution }) => {
    admitConversationTaskInput(f.context(), {
      id: "newer-correction",
      appId: app.id,
      conversationId: "chat",
      conversationSequence: 3,
      source: { kind: "human", id: "newer-correction" },
      input: { kind: "message", data: { text: "Include costs as well" } },
      intent: conversationTaskIntent(f.context()),
    });
    expect(execution.updateRequest!({ id: ask.id, expectedRevision: 1, scope: "Old interpretation" }, "old"))
      .toMatchObject({ revision: 2, scope: "Old interpretation" });
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toMatchObject({ revision: 2, scope: "Old interpretation" });
    return { ...answer, requestUpdates: [{ id: ask.id, expectedRevision: 2, disposition: "open", reason: "Measurements remain" }] };
  });
  turn.settle();
  f.reopen();
  const next = await f.prepare(async ({ inputContext, execution }) => {
    expect(inputContext.inputs?.some(({ id }) => id === "newer-correction")).toBe(true);
    expect(execution.updateRequest!({ id: ask.id, expectedRevision: 3, scope: "Compare both options including costs",
      inputIds: inputContext.inputs!.map(({ id }) => id) }, "reviewed"))
      .toMatchObject({ revision: 4, scope: "Compare both options including costs" });
    return { ...answer, requestUpdates: [{ id: ask.id, expectedRevision: 4, disposition: "fulfilled", reason: "Compared both including costs" }] };
  }, false);
  expect(next.claim.taskId).toBe(turn.claim.taskId);
  expect(next.settle().status).toBe("applied");
});

test("the immediate update is scoped to the claimed Conversation and a failed write leaves its revision intact", async () => {
  const f = fixture();
  applyConversationRequestUpdates(f.db, {
    appId: app.id,
    conversationId: "other",
    updates: [ask],
    updateKey: "foreign",
    now: Date.now(),
  });
  const foreign = readConversationRequest(f.db, app.id, "other", ask.id);
  const turn = await f.prepare(async ({ execution }) => {
    expect(() =>
      execution.updateRequest!({ id: ask.id, expectedRevision: 1, scope: "Cross-Conversation change" }, "foreign"),
    ).toThrow("revision changed");
    f.db.exec(`CREATE TRIGGER reject_request BEFORE INSERT ON conversation_requests
      BEGIN SELECT RAISE(ABORT, 'fixture request write failure'); END;`);
    expect(() => execution.updateRequest!({ id: ask.id, expectedRevision: 0, scope: ask.scope! }, "accept")).toThrow(
      "fixture request write failure",
    );
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)).toBeNull();
    f.db.exec("DROP TRIGGER reject_request");
    expect(execution.updateRequest!({ id: ask.id, expectedRevision: 0, scope: ask.scope! }, "accept").revision).toBe(1);
    return { ...answer, requestUpdates: [{ id: ask.id, expectedRevision: 1, disposition: "open", reason: "Measurements are still needed" }] };
  });
  turn.settle();
  expect(readConversationRequest(f.db, app.id, "other", ask.id)).toEqual(foreign);
});

test.each([["none"], ["new"]] as const)(
  "Request references preserve unrelated work without subscribing (Topic: %s)",
  async (topicKind) => {
    const f = fixture();
    const worker = f.context(owner.id);
    const ref = { appId: owner.id, taskId: "independent-research" };
    observeAppTaskIntent(worker, {
      appAgent: owner.id,
      intent: { id: ref.taskId, parentId: "project", outcome: "Compare options", acceptance: ["Verified comparison"] },
    });
    const claim = claimObservedAppTask(worker, { taskId: ref.taskId, appAgent: owner.id, handler: "agent:owner" });
    if (claim.kind !== "claimed") throw new Error("Expected independent worker claim");
    completeAppTask(worker, claim, { summary: "Independent comparison available" });
    const before = worker.resourceStore.readTaskContext({ taskIds: [ref.taskId] });
    const topic: ConversationTurnResult["topic"] =
      topicKind === "new" ? { kind: "new", title: "Comparison" } : { kind: "none" };

    const result = await f.turn({ ...answer, topic, requestUpdates: [{ ...ask, taskRefs: [ref] }] });
    expect(result.status).toBe("applied");
    expect(result.admittedTasks).toEqual([]);
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.taskRefs).toEqual([ref]);
    expect(listConversationTopicLinksForTask(f.db, ref.appId, ref.taskId)).toEqual([]);
    expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
    expect(worker.resourceStore.readTaskContext({ taskIds: [ref.taskId] })).toEqual(before);

    f.reopen();
    await f.turn({
      ...answer,
      requestUpdates: [{ id: ask.id, expectedRevision: 1, disposition: "fulfilled", reason: "Comparison explained" }],
    });
    const closed = readConversationRequest(f.db, app.id, "chat", ask.id)!;
    expect(closed).toMatchObject({ status: "closed", taskRefs: [ref] });
    expect(
      readAppConversationResource(f.db, app.id, "chat").messages.some(
        (message) => message.id === closed.closure?.messageId && message.text === answer.response,
      ),
    ).toBe(true);
    expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
    expect(f.context(owner.id).resourceStore.readTaskContext({ taskIds: [ref.taskId] })).toEqual(before);
  },
);

test("Task references accumulate without duplicates; overflow rolls back the update batch", () => {
  const { db } = fixture();
  // References remain useful metadata even when the named work is unavailable.
  const refs = Array.from({ length: 33 }, (_, i) => ({ appId: owner.id, taskId: `work-${i}` }));
  const update = (updates: AppConversationRequestUpdate[], updateKey: string) =>
    applyConversationRequestUpdates(db, {
      appId: app.id,
      conversationId: "chat",
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
});

test("a reference can accompany the handoff that creates its Task", async () => {
  const f = fixture();
  const ref = { appId: owner.id, taskId: "work" };
  expect(f.context(owner.id).resourceStore.readTask(ref.taskId)).toBeNull();
  const result = await f.turn({ ...handoff, requestUpdates: [{ ...ask, taskRefs: [ref] }] });
  expect(result.admittedTasks).toEqual([ref]);
  const request = readConversationRequest(f.db, app.id, "chat", ask.id)!;
  expect(request.taskRefs).toEqual([ref]);
  expect(listConversationTopicLinksForTask(f.db, ref.appId, ref.taskId)).toEqual([]);
  expect(listConversationTaskLinks(f.db, ref.appId, ref.taskId)).toEqual([
    { appId: app.id, conversationId: "chat", topicId: request.topicId!, originInputId: "turn-1" },
  ]);
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
    async ({ inputContext }) => {
      update.inputIds = inputContext.inputs!.map(({ id }) => id);
      return { ...answer, response: closureText, topic: { kind: "existing", id: accepted.topicId! }, requestUpdates: [update] };
    },
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
  expect(readConversationTopic(f.db, app.id, "chat", accepted.topicId!)?.taskRefs).toEqual([]);
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
  await f.turn(async ({ inputContext: request }) => {
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

test.each(["closure", "handoff"] as const)(
  "a deferred Request %s remains assigned beside unrelated input across reopen",
  async (outcome) => {
    const f = fixture();
    const initial = await f.prepare(async ({ execution }) => {
      execution.updateRequest!({ id: ask.id, expectedRevision: 0, scope: ask.scope! }, "accept");
      return outcome === "handoff"
        ? {
            ...handoff,
            requestUpdates: [
              { id: ask.id, expectedRevision: 1, disposition: "open", reason: "Admit the measurement work" },
            ],
          }
        : {
            ...answer,
            requestUpdates: [
              { id: ask.id, expectedRevision: 1, disposition: "fulfilled", reason: "Both options compared" },
            ],
          };
    });
    const [original] = readConversationTaskInputs(f.context(), initial.claim);
    admitConversationTaskInput(f.context(), {
      id: "news",
      appId: app.id,
      conversationId: "chat",
      conversationSequence: 2,
      source: { kind: "system", id: "news" },
      input: { kind: "message", data: { text: "An unrelated finding arrived" } },
      intent: conversationTaskIntent(f.context()),
    });
    expect(initial.settle().taskContinues).toBe(true);
    expect(f.context().resourceStore.readAttempt(initial.claim.attemptId)?.acceptedResult).toBeUndefined();
    expect(f.context(owner.id).resourceStore.readTask("work")).toBeNull();
    f.reopen();
    const next = await f.prepare(async ({ inputContext }) => {
      expect(inputContext.assignedRequests).toEqual([
        {
          id: ask.id,
          revision: 1,
          scope: ask.scope,
          status: "open",
          inputIds: [original!.id],
        },
      ]);
      expect(inputContext.previousAttempt?.unacceptedResult?.result?.conversation).toEqual(initial.proposal.decision);
      expect(inputContext.previousAttempt?.unacceptedResult?.settlementError).toContain("not accepted");
      return { summary: "News handled", response: "Here is the new finding.", topic: { kind: "none" } };
    }, false);
    expect(next.settle).toThrow(`Request ${ask.id} was not addressed`);
    for (const id of [original!.id, "news"]) expect(getAppInboxItem(f.db, id)?.status).not.toBe("done");
    expect(f.context().resourceStore.readAttempt(next.claim.attemptId)?.acceptedResult).toBeUndefined();
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.revision).toBe(1);
    const applied = completeConversationTaskTurn(
      f.context(),
      next.claim,
      {
        ...initial.proposal.decision,
        response: `${initial.proposal.decision.response} The unrelated finding is also noted.`,
      },
      {
        getTaskApp: (appId) => ({ app: owner, config: f.context(appId) }),
      },
    );
    for (const id of [original!.id, "news"]) expect(getAppInboxItem(f.db, id)?.status).toBe("done");
    const request = readConversationRequest(f.db, app.id, "chat", ask.id)!;
    expect(request).toMatchObject({ revision: 2, scope: ask.scope, status: outcome === "closure" ? "closed" : "open" });
    if (outcome === "handoff") {
      expect(applied.admittedTasks).toEqual([{ appId: owner.id, taskId: "work" }]);
      expect(request.taskRefs).toEqual([{ appId: owner.id, taskId: "work" }]);
      expect(f.context(owner.id).resourceStore.readTask("work")).not.toBeNull();
    } else {
      expect(request.closure?.messageId).toBe(`result:${original!.id}`);
    }
    expect(listConversationInputRequests(f.db, app.id, "chat", ["news"])).toEqual([]);
  },
);

test("related inputs refine one Request and one answer must use its latest requirements", async () => {
  const f = fixture();
  const initial = await f.prepare(async ({ execution }) => {
    execution.updateRequest!({ id: "laptops", expectedRevision: 0, scope: "Compare two laptops" }, "accept");
    return {
      ...answer,
      requestUpdates: [{ id: "laptops", expectedRevision: 1, disposition: "fulfilled", reason: "Compared" }],
    };
  });
  const [original] = readConversationTaskInputs(f.context(), initial.claim);
  admitConversationTaskInput(f.context(), {
    id: "budget",
    appId: app.id,
    conversationId: "chat",
    conversationSequence: 2,
    source: { kind: "human", id: "budget" },
    input: { kind: "message", data: { text: "Battery life matters most; stay below 1500" } },
    intent: conversationTaskIntent(f.context()),
  });
  initial.settle();
  f.reopen();
  const scope = "Compare two laptops below 1500, prioritizing battery life";
  const revised = await f.prepare(async ({ inputContext, execution }) => {
    expect(inputContext.assignedRequests?.map(({ id }) => id)).toEqual(["laptops"]);
    const inputIds = inputContext.inputs!.map(({ id }) => id);
    execution.updateRequest!({ id: "laptops", expectedRevision: 1, scope, inputIds }, "refine");
    return {
      ...answer,
      response: "Both are below 1500; A has the longer verified battery life.",
      requestUpdates: [
        {
          id: "laptops",
          expectedRevision: 2,
          disposition: "fulfilled",
          reason: "Compared budget and battery life together",
        },
      ],
    };
  }, false);
  // A proposal about the older requirements cannot close the corrected intention.
  expect(() => completeConversationTaskTurn(f.context(), revised.claim, initial.proposal.decision)).toThrow(
    "revision changed",
  );
  f.db.exec(`CREATE TRIGGER reject_reply BEFORE UPDATE ON app_inbox_items WHEN NEW.result IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'fixture reply failure'); END;`);
  expect(revised.settle).toThrow("fixture reply failure");
  expect(readConversationRequest(f.db, app.id, "chat", "laptops")).toMatchObject({
    revision: 2,
    scope,
    status: "open",
  });
  f.db.exec("DROP TRIGGER reject_reply");
  revised.settle();
  f.reopen();
  expect(listConversationInputRequests(f.db, app.id, "chat", [original!.id, "budget"])).toEqual([
    expect.objectContaining({
      id: "laptops",
      revision: 3,
      scope,
      status: "closed",
      inputIds: ["budget", original!.id].sort(),
    }),
  ]);
  expect(
    readAppConversationResource(f.db, app.id, "chat").messages.filter(({ author }) => author.kind === "agent"),
  ).toHaveLength(1);
});

test("Request input associations reject foreign input and survive Stop without waking work", async () => {
  const f = fixture();
  const first = await f.prepare(answer);
  const [original] = readConversationTaskInputs(f.context(), first.claim);
  const other = admitConversationTaskInput(f.context(), {
    id: "other-chat-input",
    appId: app.id,
    conversationId: "other",
    conversationSequence: 1,
    source: { kind: "human", id: "other" },
    input: { kind: "message", data: { text: "Foreign ask" } },
    intent: conversationTaskIntent(f.context()),
  });
  expect(() =>
    updateConversationTaskRequest(
      f.context(),
      first.claim,
      {
        id: ask.id,
        expectedRevision: 0,
        scope: ask.scope!,
        inputIds: [other.item.id],
      },
      "foreign",
    ),
  ).toThrow("inputs in this turn");
  updateConversationTaskRequest(
    f.context(),
    first.claim,
    { id: ask.id, expectedRevision: 0, scope: ask.scope! },
    "accept",
  );
  first.stop();
  f.reopen();
  expect(listConversationInputRequests(f.db, app.id, "chat", [original!.id])).toHaveLength(1);
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
  const next = await f.prepare(async ({ inputContext }) => {
    expect(inputContext.assignedRequests).toEqual([]); // Stopped input is not assigned to unrelated new work.
    return answer;
  });
  next.settle();
  expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.status).toBe("open");
});

test("several intentions can share a turn while input association remains an explicit agent judgment", async () => {
  const f = fixture();
  const first = await f.prepare(answer);
  const [original] = readConversationTaskInputs(f.context(), first.claim);
  admitConversationTaskInput(f.context(), {
    id: "contract",
    appId: app.id,
    conversationId: "chat",
    conversationSequence: 2,
    source: { kind: "human", id: "contract" },
    input: { kind: "message", data: { text: "Also review this contract" } },
    intent: conversationTaskIntent(f.context()),
  });
  first.settle();
  const next = await f.prepare(async ({ execution }) => {
    const compare = { id: "compare", expectedRevision: 0, scope: "Compare two laptops" };
    expect(() => execution.updateRequest!(compare, "ambiguous")).toThrow("requires inputIds");
    expect(() => execution.updateRequest!({ ...compare, inputIds: ["not-in-claim"] }, "unclaimed")).toThrow(
      "inputs in this turn",
    );
    expect(readConversationRequest(f.db, app.id, "chat", compare.id)).toBeNull();
    execution.updateRequest!({ ...compare, inputIds: [original!.id] }, "compare");
    execution.updateRequest!(
      { id: "contract-review", expectedRevision: 0, scope: "Review the contract", inputIds: ["contract"] },
      "review",
    );
    return {
      ...answer,
      response: "Here is the laptop comparison and the contract review.",
      requestUpdates: [
        { id: "compare", expectedRevision: 1, disposition: "fulfilled", reason: "Compared both laptops" },
        { id: "contract-review", expectedRevision: 1, disposition: "fulfilled", reason: "Reviewed the contract" },
      ],
    };
  }, false);
  const partial = { ...next.proposal.decision, requestUpdates: next.proposal.decision.requestUpdates!.slice(0, 1) };
  expect(() => completeConversationTaskTurn(f.context(), next.claim, partial)).toThrow(
    "Request contract-review was not addressed",
  );
  next.settle();
  const requests = listConversationInputRequests(f.db, app.id, "chat", [original!.id, "contract"]);
  expect(requests.map(({ id, status, inputIds }) => ({ id, status, inputIds }))).toEqual([
    { id: "compare", status: "closed", inputIds: [original!.id] },
    { id: "contract-review", status: "closed", inputIds: ["contract"] },
  ]);
});

test.each(["saved", "final-only"] as const)(
  "a %s open Request needs its own explanation even when another ask is answered",
  async (mode) => {
    const f = fixture();
    const turn = await f.prepare(async ({ execution }) => {
      if (mode === "saved") execution.updateRequest!({ id: ask.id, expectedRevision: 0, scope: ask.scope! }, "accept");
      return {
        ...answer,
        response: "The meeting starts at noon.",
        requestUpdates: [{ ...ask, expectedRevision: mode === "saved" ? 1 : 0 }],
      };
    });
    const missing = {
      ...turn.proposal.decision,
      requestUpdates: [{ ...turn.proposal.decision.requestUpdates![0]!, reason: undefined }],
    };
    const schema = conversationTaskResultSchema(readConversationTaskInputs(f.context(), turn.claim));
    expect(Check(schema, missing)).toBe(false); // The model's finish tool can reject this before ending execution.
    expect(() => completeConversationTaskTurn(f.context(), turn.claim, missing)).toThrow("result schema");
    expect(Check(schema, { ...missing, requestUpdates: [{ ...missing.requestUpdates[0]!, reason: "   " }] })).toBe(
      false,
    );
    expect(getAppInboxItem(f.db, "turn-1")?.status).not.toBe("done");
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.revision).toBe(mode === "saved" ? 1 : undefined);
    expect(
      readAppConversationResource(f.db, app.id, "chat").messages.filter(({ author }) => author.kind === "agent"),
    ).toEqual([]);
    completeConversationTaskTurn(f.context(), turn.claim, {
      ...turn.proposal.decision,
      requestUpdates: [
        {
          ...turn.proposal.decision.requestUpdates![0]!,
          reason: "Waiting for the user's second option before comparing",
        },
      ],
    });
    expect(readConversationRequest(f.db, app.id, "chat", ask.id)?.status).toBe("open");
    expect(getAppInboxItem(f.db, "turn-1")?.status).toBe("done");
  },
);

test("a new input can continue the same Request without copying scope, and interruption retains that assignment", async () => {
  const f = fixture();
  await f.turn({ ...answer, requestUpdates: [ask] });
  const continuing = await f.prepare(async ({ execution }) => {
    expect(() => execution.updateRequest!({ id: "missing", expectedRevision: 0 }, "invalid")).toThrow(
      "requires a scope",
    );
    const saved = execution.updateRequest!({ id: ask.id, expectedRevision: 1 }, "continue");
    expect(saved).toMatchObject({ id: ask.id, scope: ask.scope, revision: 2, status: "open" });
    return {
      ...answer,
      requestUpdates: [
        { id: ask.id, expectedRevision: 2, disposition: "fulfilled", reason: "Both measurements compared" },
      ],
    };
  });
  admitConversationTaskInput(f.context(), {
    id: "news",
    appId: app.id,
    conversationId: "chat",
    conversationSequence: 3,
    source: { kind: "human", id: "news" },
    input: { kind: "message", data: { text: "Also note the meeting time" } },
    intent: conversationTaskIntent(f.context()),
  });
  continuing.settle();
  // Push the accepted ask out of the ordinary recent-Request window.
  for (let i = 0; i < 13; i++)
    applyConversationRequestUpdates(f.db, {
      appId: app.id,
      conversationId: "chat",
      updateKey: `unrelated-${i}`,
      now: Date.now() + i + 1,
      updates: [{ id: `unrelated-${i}`, expectedRevision: 0, scope: `Unrelated ask ${i}`, disposition: "open" }],
    });
  f.reopen();
  const next = await f.prepare(async ({ inputContext }) => {
    expect(inputContext.assignedRequests).toEqual([
      { id: ask.id, revision: 2, scope: ask.scope, status: "open", inputIds: ["turn-2"] },
    ]);
    return {
      ...continuing.proposal.decision,
      response: "Both measurements are compared, and the meeting time is noted.",
    };
  }, false);
  next.settle();
  expect(listConversationInputRequests(f.db, app.id, "chat", ["turn-1", "turn-2", "news"])).toEqual([
    expect.objectContaining({
      id: ask.id,
      revision: 3,
      status: "closed",
      scope: ask.scope,
      inputIds: ["turn-1", "turn-2"],
    }),
  ]);
  expect(getAppInboxItem(f.db, "news")?.status).toBe("done");
});

test("the Request limit rejects only the extra save and leaves all accepted intentions settleable", async () => {
  const f = fixture();
  const turn = await f.prepare(async ({ execution }) => {
    const requestUpdates: AppConversationRequestUpdate[] = [];
    for (let i = 0; i < 8; i++) {
      const saved = execution.updateRequest!(
        { id: `ask-${i}`, expectedRevision: 0, scope: `Review option ${i}` },
        `accept-${i}`,
      );
      requestUpdates.push({
        id: saved.id,
        expectedRevision: saved.revision,
        disposition: "fulfilled",
        reason: `Option ${i} reviewed`,
      });
    }
    expect(() =>
      execution.updateRequest!({ id: "overflow", expectedRevision: 0, scope: "Review another option" }, "overflow"),
    ).toThrow("at most 8");
    expect(readConversationRequest(f.db, app.id, "chat", "overflow")).toBeNull();
    expect(listConversationInputRequests(f.db, app.id, "chat", ["turn-1"])).toHaveLength(8);
    return { ...answer, response: "Here are all eight option reviews.", requestUpdates };
  });
  turn.settle();
  f.reopen();
  expect(listConversationInputRequests(f.db, app.id, "chat", ["turn-1"]).map(({ status }) => status)).toEqual(
    Array(8).fill("closed"),
  );
});

import { afterEach, expect, setSystemTime, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp, type ConversationTurnResult } from "@may-agent/sdk";
import { Check } from "typebox/value";
import { getDb, closeDb } from "../../../lib/requests.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import {
  appTaskContext,
  claimObservedAppTask,
  cancelAppTask,
  closeAppTask,
  completeAppTask,
  deferAppTask,
  failAppTaskAttempt,
  recordAppTaskTrigger,
  readAppTaskAdmissionOutcome,
  observeAppTaskIntent,
} from "../tasks/app-task-reconciler.js";
import { AppTaskController } from "../tasks/controller.js";
import { trackAppTaskConditionEventForTasks } from "../tasks/app-task-condition-tracker.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { prepareConversationTaskTurn } from "../../composition/conversation-task-turn.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { claimAppInboxItem } from "../../../../test/fixtures/legacy-inbox.js";
import { readAppConversationResource, linkConversationTopicTask, createConversationTopic } from "./conversations.js";
import { readConversationRequest } from "./conversation-requests.js";
import { admitTaskInput } from "./inbox.js";
import {
  admitConversationTaskInput,
  admitConversationTaskChange,
  completeConversationTaskTurn,
  conversationTaskId,
  stopConversationTaskTurn,
  readConversationTaskInputs,
  listPendingConversationTaskChanges,
} from "./conversation-task-turns.js";

const roots: string[] = [];
// State fixtures supply the claim. Installed-runtime tests exercise its owner.
async function executeConversationTaskTurn(input: Parameters<typeof prepareConversationTaskTurn>[0]) {
  const proposal = await prepareConversationTaskTurn(input);
  return completeConversationTaskTurn(input.config, input.claim, proposal.decision, {
    ...proposal,
    getTaskApp: input.getTaskApp,
  });
}
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
  conversation: { mode: "agent" },
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
      executor: "conversation",
    },
  });
  const admit = (id?: string, sequence?: number, text?: string) =>
    admitConversationTaskInput(context(), input(id, sequence, text));
  const claim = (taskId: string) => {
    const claimed = claimObservedAppTask(context(), { taskId, appAgent: app.id, handler: "executor:conversation" });
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

test("one Task executes real Conversation input and retains replies and Requests across reopen", async () => {
  const f = fixture();
  const first = f.admit();
  let judgments = 0;
  const turn = async (taskId: string, answer: ConversationTurnResult) => {
    let settle!: () => void;
    let reject!: (error: unknown) => void;
    const completed = new Promise<void>((yes, no) => {
      settle = yes;
      reject = no;
    });
    const controller = new AppTaskController({
      maxConcurrent: 1,
      onError: (_id, error) => reject(error),
      async reconcile(id) {
        const claim = f.claim(id);
        const result = await executeConversationTaskTurn({
          config: f.context(),
          claim,
          app,
          signal: new AbortController().signal,
          resolveConversationInput: async ({ inputContext: request, execution }) => {
            expect(request.conversation?.id).toBe("chat");
            expect(execution?.taskBinding).toEqual({
              appId: app.id,
              taskId,
              generation: claim.generation,
              attemptId: claim.attemptId,
            });
            const quiet = { summary: "Observed", topic: { kind: "none" as const } };
            expect(Check(execution.outputSchema, quiet)).toBe(false);
            expect(() => completeConversationTaskTurn(f.context(), claim, quiet)).toThrow("result schema");
            expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
            judgments++;
            return answer;
          },
        });
        expect(result.status).toBe("applied");
        settle();
      },
    });
    const timeout = setTimeout(() => reject(new Error("Conversation did not settle")), 2_000);
    try {
      controller.enqueue(taskId);
      controller.enqueue(taskId);
      await completed;
    } finally {
      clearTimeout(timeout);
      controller.close();
      await controller.whenDrained();
    }
  };
  await turn(first.taskId, decision);
  const original = readAppTaskAdmissionOutcome(f.context(), first.taskId, first.item.taskAdmissionKey!);
  f.reopen();
  const replay = f.admit();
  expect(replay.created).toBe(false);
  const second = f.admit("second", 2);
  expect(second.taskId).toBe(first.taskId);
  await turn(second.taskId, {
    summary: "Answered",
    response: "Cost is one of the tradeoffs.",
    topic: { kind: "none" },
  });
  const conversation = readAppConversationResource(f.db, app.id, "chat");
  const request = readConversationRequest(f.db, app.id, "chat", "comparison")!;
  expect(request).toMatchObject({ status: "closed", revision: 1, closure: { messageId: "result:first" } });
  expect(conversation.topics).toHaveLength(1);
  expect(
    conversation.messages.filter((message) => message.author.kind === "agent").map((message) => message.text),
  ).toEqual([decision.response!, "Cost is one of the tradeoffs."]);
  expect(readAppTaskAdmissionOutcome(f.context(), first.taskId, first.item.taskAdmissionKey!)).toEqual(original);
  expect(f.store.isCancelled(first.taskId)).toBe(false);
  expect(f.db.prepare("SELECT COUNT(*) AS count FROM app_tasks").get()).toEqual({ count: 1 });
  expect(
    f.db.prepare("SELECT id FROM app_inbox_items WHERE lease_generation != 0 OR lease_owner IS NOT NULL").all(),
  ).toEqual([]);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(judgments).toBe(2);
});

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
    f.db.exec(`CREATE TRIGGER fail_reply BEFORE UPDATE OF result ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'reply write failed'); END`);
    expect(() => completeConversationTaskTurn(f.context(), claim, proposed)).toThrow("reply write failed");
    f.reopen();
    expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
    expect(readAppConversationResource(f.db, app.id, "chat").topics).toEqual(beforeTopics);
    expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
    expect(f.store.readTask(input.taskId)?.status.currentAttemptId).toBe(claim.attemptId);
    expect(readAppTaskAdmissionOutcome(f.context(), input.taskId, input.item.taskAdmissionKey!)).toBeNull();
    expect(getAppInboxItem(f.db, input.item.id)?.result).toBeUndefined();
    f.db.exec("DROP TRIGGER fail_reply");
    expect(completeConversationTaskTurn(f.context(), claim, proposed).status).toBe("applied");
    expect(readAppConversationResource(f.db, app.id, "chat").topics).toHaveLength(1);
    expect(getAppInboxItem(f.db, input.item.id)?.result?.response).toBe(proposed.response);
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
  expect(() => completeConversationTaskTurn(f.context(), claim, decision)).toThrow("stale");
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
  expect(getAppInboxItem(f.db, input.item.id)?.result).toBeUndefined();
  expect(f.store.isCancelled(input.taskId)).toBe(true);
});

test("fresh human input creates a linked successor without rebinding replay or system feedback", async () => {
  const f = fixture();
  const input = f.admit();
  completeConversationTaskTurn(f.context(), f.claim(input.taskId), decision);
  const task = f.store.readTask(input.taskId)!;
  cancelAppTask(f.context(), {
    appId: app.id,
    taskId: input.taskId,
    expectedGeneration: task.metadata.generation,
    expectedResourceVersion: task.metadata.resourceVersion,
    decision: "app-policy", reason: "Historical terminal Conversation",
  });

  expect(f.admit().taskId).toBe(input.taskId);
  expect(() =>
    admitConversationTaskInput(f.context(), {
      ...f.input("background", 2, "A background Task returned"),
      source: { kind: "system", id: "background" },
    }),
  ).toThrow("requires fresh human input");
  expect(getAppInboxItem(f.db, "background")).toBeNull();

  const successor = f.admit("fresh", 2, "Continue the discussion");
  expect(successor.taskId).toBe(`${input.taskId}_successor_2`);
  expect(f.store.readTask(successor.taskId)?.spec.input).toMatchObject({
    conversationLineage: { appId: app.id, conversationId: "chat", predecessorTaskId: input.taskId },
  });
  expect(f.store.readCancellation(input.taskId)?.reason).toBe("Historical terminal Conversation");

  const successorClaim = f.claim(successor.taskId);
  f.reopen();
  expect(readAppConversationResource(f.db, app.id, "chat").activeTurn).toEqual({
    id: successorClaim.attemptId, revision: successorClaim.generation,
  });
  let preparedBinding: { appId: string; taskId: string; generation: number; attemptId: string } | undefined;
  await executeConversationTaskTurn({
    config: f.context(),
    claim: successorClaim,
    app,
    signal: new AbortController().signal,
    resolveConversationInput: async ({ execution }) => {
      preparedBinding = execution?.taskBinding;
      return {
        ...decision,
        response: "The linked successor handled this turn.",
        requestUpdates: [
          { id: "successor", expectedRevision: 0, scope: "Continue the discussion", disposition: "open", reason: "Waiting for the next discussion point" },
        ],
      };
    },
  });
  expect(preparedBinding).toEqual({
    appId: app.id,
    taskId: successor.taskId,
    generation: successorClaim.generation,
    attemptId: successorClaim.attemptId,
  });
  expect(readAppConversationResource(f.db, app.id, "chat").activeTurn).toBeUndefined();
  expect(getAppInboxItem(f.db, "fresh")?.result?.response).toBe("The linked successor handled this turn.");
  expect(readConversationRequest(f.db, app.id, "chat", "successor")).toMatchObject({ status: "open", revision: 1 });

  const stopped = f.admit("stop-successor", 3, "Pause this turn");
  const stoppedClaim = f.claim(stopped.taskId);
  expect(readAppConversationResource(f.db, app.id, "chat").activeTurn).toEqual({
    id: stoppedClaim.attemptId, revision: stoppedClaim.generation,
  });
  expect(
    stopConversationTaskTurn(f.context(), {
      appId: app.id,
      conversationId: "chat",
      turnId: stoppedClaim.attemptId,
      expectedRevision: stoppedClaim.generation,
    }).taskId,
  ).toBe(successor.taskId);
  expect(getAppInboxItem(f.db, "stop-successor")?.handling).toMatchObject({ phase: "stopped" });
  expect(readAppConversationResource(f.db, app.id, "chat").activeTurn).toBeUndefined();

  const currentSuccessor = f.store.readTask(successor.taskId)!;
  cancelAppTask(f.context(), {
    appId: app.id,
    taskId: successor.taskId,
    expectedGeneration: currentSuccessor.metadata.generation,
    expectedResourceVersion: currentSuccessor.metadata.resourceVersion,
    decision: "app-policy", reason: "Conversation ended again",
  });
  expect(() =>
    admitConversationTaskInput(f.context(), {
      ...f.input("late-background", 4, "Late child feedback"),
      source: { kind: "system", id: "late-background" },
    }),
  ).toThrow("requires fresh human input");
  expect(getAppInboxItem(f.db, "late-background")).toBeNull();
  expect(f.admit("fresh", 2, "Continue the discussion")).toMatchObject({
    created: false,
    taskId: successor.taskId,
    item: { id: "fresh", executionTaskId: successor.taskId, status: "done" },
  });
  expect(f.store.readTask(`${input.taskId}_successor_3`)).toBeNull();
});

test("unreviewed input prevents proposed Conversation effects from escaping as an accepted answer", () => {
  const f = fixture();
  const input = f.admit();
  const claim = f.claim(input.taskId);
  f.admit("correction", 2);
  expect(completeConversationTaskTurn(f.context(), claim, decision).taskContinues).toBe(true);
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
  expect(getAppInboxItem(f.db, input.item.id)?.result).toBeUndefined();
});

test("a fresh attempt considers retained and newer input together and publishes one answer", async () => {
  const f = fixture();
  const first = f.admit();
  const obsolete = f.claim(first.taskId);
  const correction = f.admit("correction", 2);
  const system = admitConversationTaskInput(f.context(), {
    ...f.input("review", 3, "A linked Task returned facts"),
    source: { kind: "system", id: "review" },
  });
  completeConversationTaskTurn(f.context(), obsolete, decision);
  const claim = f.claim(first.taskId);
  await executeConversationTaskTurn({
    config: f.context(),
    claim,
    app,
    signal: new AbortController().signal,
    resolveConversationInput: async ({ inputContext: request, execution }) => {
      expect(request.id).toBe(correction.item.id);
      expect(request.humanRequested).toBe(true);
      expect(request.inputs?.map(({ id }) => id)).toEqual([system.item.id, first.item.id, correction.item.id]);
      const quiet = { summary: "Observed", topic: { kind: "none" as const } };
      expect(Check(execution.outputSchema, quiet)).toBe(false);
      expect(() => completeConversationTaskTurn(f.context(), claim, quiet)).toThrow("result schema");
      return { ...decision, requestUpdates: decision.requestUpdates!.map((update) => ({
        ...update, inputIds: [first.item.id, correction.item.id],
      })) };
    },
  });
  for (const admitted of [first, correction, system]) {
    expect(getAppInboxItem(f.db, admitted.item.id)?.status).toBe("done");
    expect(readAppTaskAdmissionOutcome(f.context(), first.taskId, admitted.item.taskAdmissionKey!)?.attemptId).toBe(
      claim.attemptId,
    );
  }
  expect(f.store.readAttempt(obsolete.attemptId)?.acceptedResult).toBeUndefined();
  expect(getAppInboxItem(f.db, correction.item.id)?.result?.response).toBe(decision.response);
  expect(getAppInboxItem(f.db, system.item.id)?.result).toBeUndefined();
  expect(
    readAppConversationResource(f.db, app.id, "chat").messages.filter(({ author }) => author.kind === "agent"),
  ).toHaveLength(1);
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
  completeConversationTaskTurn(f.context(), obsolete, decision);
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

test("follow-up admission rolls back with the explanation, Request and Task result", () => {
  const f = fixture();
  const first = f.admit();
  const claim = f.claim(first.taskId);
  const handoff: ConversationTurnResult = {
    ...decision,
    requestUpdates: [{ id: "comparison", scope: "Compare A and B", expectedRevision: 0, disposition: "open", reason: "Delegating collection of the comparison facts" }],
    followUp: {
      requestId: "comparison",
      appId: app.id,
      input: { kind: "message", data: { text: "Get facts" } },
    },
  };
  const getTaskApp = () => ({
    app: defineApp({
      ...app,
      tasks: {},
      task: () => ({
        kind: "desired",
        intent: {
          id: "measurement",
          parentId: "root",
          outcome: "Get facts",
          acceptance: ["Measure"],
        },
      }),
    }),
    config: f.context(),
  });
  f.db.exec(`CREATE TRIGGER fail_followup_reply BEFORE UPDATE OF result ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'reply rejected'); END`);
  expect(() =>
    completeConversationTaskTurn(f.context(), claim, handoff, {
      getTaskApp,
    }),
  ).toThrow("reply rejected");
  expect(f.store.readTask("measurement")).toBeNull();
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
  expect(readAppConversationResource(f.db, app.id, "chat").topics).toEqual([]);
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
  f.db.exec("DROP TRIGGER fail_followup_reply");
  const accepted = completeConversationTaskTurn(f.context(), claim, handoff, {
    getTaskApp,
  });
  expect(accepted).toMatchObject({ admittedTasks: [{ appId: app.id, taskId: "measurement" }] });
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toMatchObject({
    status: "open",
    taskRefs: [{ appId: app.id, taskId: "measurement" }],
  });
});

test.each([false, true])("a system turn can stay quiet without hiding facts (human parent: %s)", async (humanParent) => {
  const f = fixture();
  const first = f.admit();
  completeConversationTaskTurn(f.context(), f.claim(first.taskId), decision);
  const before = readAppConversationResource(f.db, app.id, "chat").messages;
  const signal = admitConversationTaskInput(f.context(), {
    ...f.input("tick", 2),
    source: { kind: "system", id: "tick" },
    ...(humanParent ? { parentId: first.item.id } : {}),
    input: { kind: "review", data: {} },
  });
  const claim = f.claim(signal.taskId);
  await executeConversationTaskTurn({
    config: f.context(),
    claim,
    app,
    signal: new AbortController().signal,
    resolveConversationInput: async ({ inputContext: request, execution }) => {
      expect(request.source.kind).toBe("system");
      expect(request.humanRequested).toBe(humanParent ? true : undefined);
      const quiet: ConversationTurnResult = {
        summary: "No material change", topic: { kind: "none" },
        requestUpdates: [{ id: "retained", expectedRevision: 0, scope: "Retain the pending ask", disposition: "open", reason: "The requested evidence has not arrived" }],
      };
      expect(Check(execution.outputSchema, quiet)).toBe(true);
      return quiet;
    },
  });
  expect(readAppConversationResource(f.db, app.id, "chat").messages).toEqual(before);
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult?.summary).toBe("No material change");
  expect(getAppInboxItem(f.db, "tick")?.status).toBe("done");
  expect(readConversationRequest(f.db, app.id, "chat", "retained")?.status).toBe("open");
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
});

function cancellationFixture(source: "human" | "system" = "human", createdHere = false, linked = true) {
  const f = fixture();
  const worker = defineApp({ ...app, id: "worker", tasks: {} });
  const store = AppTaskResourceStore.fromDb(f.db, worker.id);
  store.bootstrapSnapshot(
    {
      project: worker.id,
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
    "control-fixture",
  );
  const config = appTaskContext({ ...f.context(), resourceStore: store });
  const intent = { id: "job", parentId: "root", outcome: "Measure the sample", acceptance: ["Return facts"] };
  observeAppTaskIntent(config, {
    appAgent: worker.id,
    intent: { ...intent },
    ...(createdHere ? { creator: { appId: app.id, taskId: conversationTaskId(app.id, "chat") } } : {}),
  });
  createConversationTopic(f.db, {
    id: "work",
    appId: app.id,
    conversationId: "chat",
    title: "Sample",
    openedBy: "human",
    originMessageId: "first",
  });
  if (linked) linkConversationTopicTask(f.db, "work", worker.id, "job");
  const admitted = admitConversationTaskInput(f.context(), {
    ...f.input("first", 1, "Cancel the measurement task"),
    topicId: "work",
    source: { kind: source, id: "first" },
  });
  const claim = f.claim(admitted.taskId);
  const answer: ConversationTurnResult = {
    summary: "Cancelled the measurement task",
    response: "I cancelled the measurement task.",
    topic: { kind: "existing", id: "work" },
    taskControls: [{ kind: "cancel", appId: worker.id, taskId: "job", reason: "Human withdrew the assignment" }],
  };
  return {
    f,
    worker,
    store,
    config,
    intent,
    claim,
    answer,
    getTaskApp: () => ({ app: worker, config }),
    prepare: (decision = answer) =>
      prepareConversationTaskTurn({
        config: f.context(),
        claim,
        app,
        signal: new AbortController().signal,
        getTaskApp: () => ({ app: worker, config }),
        resolveConversationInput: async () => decision,
      }),
  };
}

test("human cancellation, reply and accepted Turn commit together across Apps and survive reopen", async () => {
  const c = cancellationFixture();
  const targetClaim = claimObservedAppTask(c.config, { taskId: "job", appAgent: "worker", handler: "executor:test" });
  expect(targetClaim.kind).toBe("claimed");
  const proposal = JSON.parse(JSON.stringify(await c.prepare()));
  expect(proposal.taskControls).toEqual([
    {
      appId: "worker",
      taskId: "job",
      generation: c.store.readTask("job")!.metadata.generation,
      resourceVersion: c.store.readTask("job")!.metadata.resourceVersion,
    },
  ]);
  c.f.db.exec(`CREATE TRIGGER reject_cancel_reply BEFORE UPDATE OF result ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'reply rejected'); END`);
  const settle = () =>
    completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, { ...proposal, getTaskApp: c.getTaskApp });
  expect(settle).toThrow("reply rejected");
  expect(c.store.readCancellation("job")).toBeNull();
  expect(c.store.readTask("job")?.status.currentAttemptId).toBeDefined();
  expect(c.f.store.readAttempt(c.claim.attemptId)?.acceptedResult).toBeUndefined();
  c.f.db.exec("DROP TRIGGER reject_cancel_reply");
  const result = settle();
  expect(result.cancelledTasks).toMatchObject([{ applied: true, cancellation: { appId: "worker", taskId: "job" } }]);
  expect(c.store.isCancelled("job")).toBe(true);
  expect(c.f.store.isCancelled(c.claim.taskId)).toBe(false);
  expect(getAppInboxItem(c.f.db, "first")?.result?.response).toBe(c.answer.response);
  if (targetClaim.kind !== "claimed") throw new Error("Expected running target");
  expect(completeAppTask(c.config, targetClaim, { summary: "Late answer", facts: [] }).status).toBe("stale");
  c.f.reopen();
  expect(AppTaskResourceStore.fromDb(c.f.db, "worker").readCancellation("job")?.reason).toBe(
    "Human withdrew the assignment",
  );
  expect(getAppInboxItem(c.f.db, "first")?.result?.response).toBe(c.answer.response);
});

test.each(["generation", "resource version"])(
  "a changed target %s rolls back the proposed cancellation and reply",
  async (changed) => {
    const c = cancellationFixture();
    const proposal = await c.prepare();
    if (changed === "generation")
      observeAppTaskIntent(c.config, {
        appAgent: c.worker.id,
        intent: { ...c.intent, outcome: "Measure another sample" },
      });
    else
      expect(
        claimObservedAppTask(c.config, { taskId: "job", appAgent: c.worker.id, handler: "executor:test" }).kind,
      ).toBe("claimed");
    expect(() =>
      completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, {
        ...proposal,
        getTaskApp: c.getTaskApp,
      }),
    ).toThrow(`${changed} changed`);
    expect(c.store.isCancelled("job")).toBe(false);
    expect(c.f.store.readAttempt(c.claim.attemptId)?.acceptedResult).toBeUndefined();
    expect(getAppInboxItem(c.f.db, "first")?.status).not.toBe("done");
  },
);

test("a newer human input prevents the old Turn from applying cancellation", async () => {
  const c = cancellationFixture();
  const proposal = await c.prepare();
  c.f.admit("correction", 2, "Keep it running");
  completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, { ...proposal, getTaskApp: c.getTaskApp });
  expect(c.store.isCancelled("job")).toBe(false);
  expect(c.f.store.readAttempt(c.claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(getAppInboxItem(c.f.db, "first")?.status).not.toBe("done");
});

test("a creator can cancel its Task during a system review without another human turn", async () => {
  const c = cancellationFixture("system", true);
  const proposal = await c.prepare();
  const result = completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, {
    ...proposal,
    getTaskApp: c.getTaskApp,
  });
  expect(result.cancelledTasks?.[0]?.applied).toBe(true);
  expect(c.store.readCancellation("job")?.kind).toBe("cancelled");
  expect(c.store.readCancellation("job")?.decidedBy).toEqual({ kind: "creator",
    creator: { appId: app.id, taskId: c.claim.taskId } });
});

test("final Conversation controls cannot revise requirements after execution", () => {
  const c = cancellationFixture("system", true);
  const decision = {
    ...c.answer,
    taskControls: [
      {
        kind: "update",
        appId: c.worker.id,
        taskId: "job",
        reason: "Use the alternative sample",
        outcome: "Measure sample beta",
        acceptance: ["Return verified beta facts"],
      },
    ],
  } as unknown as ConversationTurnResult;
  const before = c.store.readTask("job");
  expect(() => completeConversationTaskTurn(c.f.context(), c.claim, decision)).toThrow("Invalid Conversation decision");
  expect(c.store.readTask("job")).toEqual(before);
  expect(c.f.store.readAttempt(c.claim.attemptId)?.acceptedResult).toBeUndefined();
});

test("Conversation control requires creator or direct human authority and an exact installed target", async () => {
  const system = cancellationFixture("system");
  await expect(system.prepare()).rejects.toThrow("recorded creator");
  expect(system.store.isCancelled("job")).toBe(false);
  const human = cancellationFixture();
  await expect(
    human.prepare({ ...human.answer, taskControls: [{ ...human.answer.taskControls![0]!, taskId: "invented" }] }),
  ).rejects.toThrow("requires an exact Task");
  await expect(
    human.prepare({ ...human.answer, taskControls: [...human.answer.taskControls!, ...human.answer.taskControls!] }),
  ).rejects.toThrow("repeats a Task control");
  linkConversationTopicTask(human.f.db, "work", app.id, human.claim.taskId);
  await expect(
    human.prepare({
      ...human.answer,
      taskControls: [{ ...human.answer.taskControls![0]!, appId: app.id, taskId: human.claim.taskId }],
    }),
  ).rejects.toThrow("cannot close its own Task");
  expect(human.store.isCancelled("job")).toBe(false);
});

test.each([
  { source: "human" as const, createdHere: false, allowed: true },
  { source: "system" as const, createdHere: true, allowed: true },
  { source: "system" as const, createdHere: false, allowed: false },
])(
  "replacement context cannot change control authority or Conversation identity (%j)",
  async ({ source, createdHere, allowed }) => {
    const c = cancellationFixture(source, createdHere, false);
    const prepared = prepareConversationTaskTurn({
      config: c.f.context(),
      claim: c.claim,
      app,
      signal: new AbortController().signal,
      getTaskApp: c.getTaskApp,
      // No Task references; even the source and Conversation identity are misleading.
      prepareContext: async () => ({
        id: "unrelated",
        source: { kind: source === "human" ? "system" : "human", id: "unrelated" },
        humanRequested: true,
        input: { kind: "message", data: { text: "Presentation only" } },
        conversation: { owner: "foreign", id: "foreign", messages: [] },
      }),
      resolveConversationInput: async ({ execution, inputContext }) => {
        expect(inputContext.focusedTask).toBeUndefined();
        expect(inputContext.referencedTasks).toBeUndefined();
        expect(execution.readContext({ action: "read", topicId: "work" })).toMatchObject({
          topic: { title: "Sample", taskRefs: [] },
        });
        const quiet = { summary: "Observed", topic: { kind: "none" } };
        expect(Check(execution.outputSchema, quiet)).toBe(source !== "human");
        return c.answer;
      },
    });
    if (!allowed) {
      await expect(prepared).rejects.toThrow("recorded creator");
      expect(c.store.isCancelled("job")).toBe(false);
      expect(getAppInboxItem(c.f.db, "first")?.status).not.toBe("done");
      return;
    }
    const proposal = JSON.parse(JSON.stringify(await prepared));
    // Reopen storage and resolve fresh handles. The proposal owns no store or callback.
    c.f.reopen();
    const getTaskApp = () => ({
      app: c.worker,
      config: appTaskContext({ ...c.f.context(), resourceStore: AppTaskResourceStore.fromDb(c.f.db, c.worker.id) }),
    });
    const result = completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, { ...proposal, getTaskApp });
    expect(result.cancelledTasks?.[0]?.applied).toBe(true);
    expect(getAppInboxItem(c.f.db, "first")?.result?.response).toBe(c.answer.response);
    expect(getAppInboxItem(c.f.db, "unrelated")).toBeNull();
  },
);

test("settlement resolves the exact App again and rolls back a mismatched or missing target", async () => {
  const c = cancellationFixture();
  const proposal = await c.prepare();
  const other = fixture();
  for (const getTaskApp of [
    undefined,
    () => ({ app: { ...c.worker, id: "wrong" }, config: c.config }),
    () => ({ app: c.worker, config: c.f.context() }),
    () => ({
      app: c.worker,
      config: appTaskContext({ ...other.context(), resourceStore: AppTaskResourceStore.fromDb(other.db, c.worker.id) }),
    }),
  ]) {
    expect(() =>
      completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, { ...proposal, getTaskApp }),
    ).toThrow("installed Task App in the same Host state");
    expect(c.store.isCancelled("job")).toBe(false);
    expect(c.f.store.readAttempt(c.claim.attemptId)?.acceptedResult).toBeUndefined();
    expect(getAppInboxItem(c.f.db, "first")?.status).not.toBe("done");
  }
  expect(
    completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, { ...proposal, getTaskApp: c.getTaskApp })
      .cancelledTasks?.[0]?.applied,
  ).toBe(true);
});

test.each([
  ["existing", "human"], ["mapped", "human"],
  ["existing", "system"], ["mapped", "system"],
] as const)(
  "%s handoff from %s maps once; background delegation can stay quiet",
  async (kind, source) => {
    const f = fixture();
    const admitted = admitConversationTaskInput(f.context(), {
      ...f.input(), source: { kind: source, id: "first" },
    });
    const claim = f.claim(admitted.taskId);
    const intent = { id: "chosen", parentId: "root", outcome: "Collect facts", acceptance: ["Measure"] };
    observeAppTaskIntent(f.context(), { appAgent: app.id, intent });
    let mappings = 0;
    let selected = "before-settlement";
    const targetApp = defineApp({
      ...app,
      tasks: {},
      task: () => {
        mappings++;
        return { kind: "desired", intent: { ...intent, id: selected } };
      },
    });
    const getTaskApp = () => ({ app: targetApp, config: f.context() });
    const answer: ConversationTurnResult = {
      summary: "Continue the work",
      ...(source === "human" ? { response: "I will continue the requested work." } : {}),
      topic: { kind: "new", title: "Measurement" },
      followUp: {
        appId: app.id,
        input: { kind: "message", data: { text: "Collect the sample" } },
        ...(kind === "existing" ? { task: { appId: app.id, taskId: "chosen" } } : {}),
      },
    };
    const proposal = await prepareConversationTaskTurn({
      config: f.context(),
      claim,
      app,
      signal: new AbortController().signal,
      getTaskApp,
      resolveConversationInput: async () => answer,
    });
    expect(mappings).toBe(0);
    selected = "at-settlement";
    // A stale or forged second target is ignored; only decision.followUp defines the handoff.
    const options = {
      ...JSON.parse(JSON.stringify(proposal)),
      getTaskApp,
      followUp: { appId: app.id, attachment: { kind: "desired", intent: { ...intent, id: "unrelated" } } },
    };
    const result = completeConversationTaskTurn(f.context(), claim, proposal.decision, options);
    expect(result.admittedTasks).toEqual([{ appId: app.id, taskId: kind === "existing" ? "chosen" : "at-settlement" }]);
    expect(mappings).toBe(kind === "existing" ? 0 : 1);
    expect(f.store.readTask("before-settlement")).toBeNull();
    expect(f.store.readTask("unrelated")).toBeNull();
    expect(getAppInboxItem(f.db, "first")?.status).toBe("done");
    if (source === "system") {
      expect(readAppConversationResource(f.db, app.id, "chat").messages).toEqual([]);
      f.reopen();
      expect(readAppConversationResource(f.db, app.id, "chat").messages).toEqual([]);
      expect(f.store.readTask(kind === "existing" ? "chosen" : "at-settlement")).not.toBeNull();
    }
  },
);

test("the common controller returns a delegated answer to the real Conversation after intervening input and restart", async () => {
  const f = fixture();
  const first = f.admit("first", 1, "Get the sample measurement in the background and report it here.");
  const workerApp = defineApp({
    ...app,
    tasks: {},
    task: () => ({
      kind: "desired",
      intent: {
        id: "A",
        parentId: "root",
        outcome: "Measure the sample",
        acceptance: ["Return a measured value"],
      },
    }),
  });
  const failures: unknown[] = [];
  const judgments: string[] = [];
  let topicId = "";
  let firstResultAttemptId = "";
  const until = async (predicate: () => boolean) => {
    const until = performance.now() + 2_000;
    while (!predicate()) {
      if (failures.length) throw failures[0];
      if (performance.now() >= until) throw new Error("Conversation chain did not progress");
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  };
  const makeController = () =>
    new AppTaskController({
      maxConcurrent: 1,
      onError: (_id, error) => {
        failures.push(error);
      },
      async reconcile(taskId) {
        const claim = f.claim(taskId);
        if (taskId === first.taskId) {
          const result = await executeConversationTaskTurn({
            config: f.context(),
            claim,
            app,
            signal: new AbortController().signal,
            getTaskApp: () => ({ app: workerApp, config: f.context() }),
            resolveConversationInput: async ({ inputContext: request }) => {
              judgments.push(request.id);
              if (request.id === "first")
                return {
                  summary: "Measurement accepted",
                  response: "I'll get the measurement and return it here.",
                  topic: { kind: "new", title: "Measurement" },
                  requestUpdates: [
                    {
                      id: "measurement",
                      expectedRevision: 0,
                      scope: "Obtain the sample measurement",
                      disposition: "open",
                      reason: "Delegating the sample measurement",
                    },
                  ],
                  followUp: {
                    requestId: "measurement",
                    appId: app.id,
                    input: { kind: "message", data: { text: "Measure the sample" } },
                  },
                };
              if (request.id === "explanation")
                return {
                  summary: "Explained the threshold",
                  response: "A threshold is the minimum acceptable value.",
                  topic: { kind: "none" },
                  requestUpdates: [
                    {
                      id: "explanation",
                      expectedRevision: 0,
                      scope: "Explain threshold",
                      disposition: "fulfilled",
                      reason: "Explained the minimum",
                    },
                  ],
                };
              expect(request.source.kind).toBe("system");
              expect(request.humanRequested).toBeUndefined();
              expect(request.input).toMatchObject({
                kind: "task-outcome",
                data: {
                  taskId: "A",
                  attemptId: firstResultAttemptId,
                  outcome: { state: "converged", result: { value: 17 } },
                },
              });
              const ask = request.conversation?.requests?.find(({ id }) => id === "measurement");
              if (!ask) throw new Error("Measurement Request is missing from the Conversation");
              expect(ask.status).toBe("open");
              expect(request.conversation?.messages.map(({ text }) => text)).toContain(
                "A threshold is the minimum acceptable value.",
              );
              return {
                summary: "Measurement returned",
                response: "The measured value is 17.",
                topic: { kind: "existing", id: topicId },
                requestUpdates: [
                  {
                    id: ask.id,
                    expectedRevision: ask.revision,
                    scope: ask.scope,
                    disposition: "fulfilled",
                    reason: "Returned measured value 17",
                  },
                ],
              };
            },
          });
          if ("admittedTasks" in result) for (const task of result.admittedTasks) controller.enqueue(task.taskId);
          topicId = getAppInboxItem(f.db, "first")!.topicId!;
        } else if (taskId === "A" && !claim.trigger?.ready) {
          deferAppTask(f.context(), claim, {
            disposition: "waiting",
            summary: "Source is not ready",
            conditions: [
              {
                id: "sample",
                type: "sample.available",
                subject: "sample:one",
                expected: true,
                owner: "app:sample",
                reviewAfterMs: 60_000,
              },
            ],
          });
        } else {
          const measurement = { value: 17 };
          const result = completeAppTask(f.context(), claim, { summary: "Measured", result: measurement });
          for (const id of result.dependentTaskIds) controller.enqueue(id);
          if (taskId === "A") {
            firstResultAttemptId = claim.attemptId;
            const returned = admitConversationTaskChange(f.context(), f.context(), {
              conversationId: "chat",
              topicId,
              taskId: "A",
              attemptId: claim.attemptId,
            });
            controller.enqueue(returned.taskId);
          }
        }
      },
    });
  let controller = makeController();
  try {
    controller.enqueue(first.taskId);
    await until(() => f.store.readTask("A")?.status.phase === "waiting" && !controller.snapshot().running.length);
    f.admit("explanation", 2, "Meanwhile, what is a threshold?");
    controller.enqueue(first.taskId);
    await until(() => getAppInboxItem(f.db, "explanation")?.status === "done" && !controller.snapshot().running.length);
    expect(readConversationRequest(f.db, app.id, "chat", "measurement")?.status).toBe("open");
    controller.close();
    await controller.whenDrained();
    f.reopen();
    controller = makeController();
    expect(
      trackAppTaskConditionEventForTasks(
        f.context(),
        { type: "sample.available", sample: "one", state: true, ready: true },
        ["A"],
      ),
    ).toHaveLength(1);
    controller.enqueue("A");
    await until(
      () =>
        readConversationRequest(f.db, app.id, "chat", "measurement")?.status === "closed" &&
        !controller.snapshot().running.length,
    );
    const originalReply = getAppInboxItem(f.db, "first")?.result;
    recordAppTaskTrigger(f.context(), "A", { type: "sample.changed" });
    completeAppTask(f.context(), f.claim("A"), { summary: "Later sample", result: { value: 99 } });
    const replay = admitConversationTaskChange(f.context(), f.context(), {
      conversationId: "chat",
      topicId,
      taskId: "A",
      attemptId: firstResultAttemptId,
    });
    expect(replay.created).toBe(false);
    expect(replay.item.input.data).toMatchObject({ outcome: { result: { value: 17 } } });
    expect(getAppInboxItem(f.db, "first")?.result).toEqual(originalReply);
    expect(
      readAppConversationResource(f.db, app.id, "chat")
        .messages.filter(({ author }) => author.kind === "agent")
        .map(({ text }) => text),
    ).toEqual([
      "I'll get the measurement and return it here.",
      "A threshold is the minimum acceptable value.",
      "The measured value is 17.",
    ]);
    expect(judgments).toHaveLength(3);
    expect(f.store.isCancelled(first.taskId)).toBe(false);
    expect(f.store.isCancelled("A")).toBe(false);
    expect(
      f.db.prepare("SELECT id FROM app_inbox_items WHERE lease_owner IS NOT NULL OR lease_generation != 0").all(),
    ).toEqual([]);
  } finally {
    controller.close();
    await controller.whenDrained();
  }
});

test.each(["answer", "waiting-report", "execution-error"] as const)(
  "a returned outcome keeps its exact App, Task and attempt identity across App boundaries (%s)",
  (scenario) => {
    const f = fixture();
    const first = f.admit();
    const workers = AppTaskResourceStore.fromDb(f.db, "worker");
    workers.bootstrapSnapshot(
      {
        project: "worker",
        project_lifecycle: "active",
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
      },
      "worker-fixture",
    );
    let worker = appTaskContext({ ...f.context(), resourceStore: workers });
    const handedOff = completeConversationTaskTurn(
      f.context(),
      f.claim(first.taskId),
      {
        ...decision,
        requestUpdates: [{ id: "comparison", scope: "Compare A and B", expectedRevision: 0, disposition: "open", reason: "Delegating collection of the comparison facts" }],
        followUp: {
          appId: "worker",
          requestId: "comparison",
          input: { kind: "measure", data: {} },
        },
      },
      {
        getTaskApp: () => ({
          app: defineApp({ ...app, id: "worker", tasks: {}, inputSchema: Type.Object({}), task: () => ({
            kind: "desired", intent: { id: "measurement", parentId: "root", outcome: "Collect facts", acceptance: ["Measure"] },
          }) }),
          config: worker,
        }),
      },
    );
    expect(handedOff).toMatchObject({ admittedTasks: [{ appId: "worker", taskId: "measurement" }] });
    expect(f.store.readTask("measurement")).toBeNull();
    const claim = claimObservedAppTask(worker, {
      taskId: "measurement",
      appAgent: "worker",
      handler: "executor:fixture",
    });
    if (claim.kind !== "claimed") throw new Error("Worker was not claimed");
    const returned = {
      conversationId: "chat",
      topicId: getAppInboxItem(f.db, "first")!.topicId!,
      taskId: "measurement",
      attemptId: claim.attemptId,
    };
    const unrelatedTopics: Array<{ conversationId: string; topicId: string }> = [];
    if (scenario !== "answer") {
      const other = admitConversationTaskInput(f.context(), { ...f.input("other", 1), conversationId: "other-chat" });
      completeConversationTaskTurn(f.context(), f.claim(other.taskId), {
        summary: "Discuss unrelated work", response: "Following a different question",
        topic: { kind: "new", title: "Other discussion" },
      });
      createConversationTopic(f.db, {
        id: "other-topic", appId: app.id, conversationId: "chat", title: "Another topic in the same chat",
        openedBy: "human", originMessageId: "other-topic-message",
      });
      unrelatedTopics.push(
        { conversationId: "other-chat", topicId: getAppInboxItem(f.db, "other")!.topicId! },
        { conversationId: "chat", topicId: "other-topic" },
      );
      for (const topic of unrelatedTopics) linkConversationTopicTask(f.db, topic.topicId, "worker", "measurement");
    }
    expect(() => admitConversationTaskChange(f.context(), worker, returned)).toThrow("accepted attempt");
    if (scenario === "answer") completeAppTask(worker, claim, { summary: "Measured", result: { value: 17 } });
    else if (scenario === "execution-error") failAppTaskAttempt(worker, claim, "Synthetic source unavailable");
    else
      deferAppTask(worker, claim, {
        disposition: "waiting",
        report: true,
        summary: "Please restore source access",
        facts: ["source:denied"],
        conditions: [
          {
            id: "source-ready",
            type: "source.access",
            subject: "resource:source",
            expected: { field: "ready", equals: true },
            owner: "app:worker",
            reviewAfterMs: 300_000,
          },
        ],
      });
    expect(() => admitConversationTaskChange(f.context(), worker, { ...returned, topicId: "unrelated" })).toThrow(
      "no link",
    );
    expect(() => admitConversationTaskChange(f.context(), worker, { ...returned, attemptId: "missing" })).toThrow(
      "accepted attempt",
    );
    if (scenario !== "answer") {
      // Other Apps and unlinked Tasks may retain reports for the same origin.
      // They must not enlarge this App's report lookup or hide a cross-App result.
      const selected = f.db.prepare("SELECT admission_json FROM app_task_admissions WHERE app_id = ?")
        .all("worker").map((row) => JSON.parse(String(row.admission_json)))
        .find((row) => row.taskId === "measurement")!;
      f.db.exec("BEGIN");
      for (let i = 0; i < 100; i++) {
        f.db.prepare("INSERT INTO app_task_admissions VALUES (?, ?, ?)")
          .run(`unrelated-app-${i}`, "report", JSON.stringify(selected));
        f.db.prepare("INSERT INTO app_task_admissions VALUES (?, ?, ?)")
          .run("worker", `unlinked-${i}`, JSON.stringify({ ...selected, taskId: `unlinked-${i}` }));
      }
      f.db.exec("COMMIT");
      expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([
        { ...returned, appId: app.id, taskAppId: "worker" },
      ]);
      for (const topic of unrelatedTopics)
        expect(admitConversationTaskChange(f.context(), worker, { ...returned, ...topic }).created).toBe(false);
    }
    createAppInboxItem(f.db, { ...f.input("ordinary", 2), input: { kind: "goal", data: {} } });
    const wake = admitConversationTaskChange(f.context(), worker, returned, ["message"]);
    expect(wake.taskId).toBe(first.taskId);
    expect(wake.item.input.data).toMatchObject({
      appId: "worker",
      taskId: "measurement",
      attemptId: claim.attemptId,
      outcome:
        scenario === "answer"
          ? { state: "converged", result: { value: 17 } }
          : scenario === "waiting-report"
            ? { state: "waiting", report: true, summary: "Please restore source access" }
            : { state: "error", facts: [`task-attempt:${claim.attemptId}`] },
    });
    expect(readConversationRequest(f.db, app.id, "chat", "comparison")?.status).toBe("open");
    expect(admitConversationTaskChange(f.context(), worker, returned, ["message"]).created).toBe(false);
    if (scenario === "answer") return;

    const inputKey = `conversation-follow-up:${app.id}:${first.item.id}`;
    expect(readAppTaskAdmissionOutcome(worker, "measurement", inputKey)).toBeNull();
    if (scenario === "execution-error") expect(workers.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
    // Skip delivery of one newer report. Recovery must select the latest saved
    // report, not every historical attempt or a delayed notification's identity.
    // These explicit reviews address the original request; a pending Condition
    // no longer contributes input scope merely because its old timer elapsed.
    const reportIds: string[] = [];
    for (const summary of ["Access repaired; waiting for data", "Please confirm the data source"]) {
      setSystemTime(Date.now() + 300_001);
      recordAppTaskTrigger(worker, "measurement", { type: "fixture.review", id: summary });
      const next = claimObservedAppTask(worker, {
        taskId: "measurement",
        appAgent: "worker",
        handler: "executor:fixture",
      });
      if (next.kind !== "claimed") throw new Error(`Expected report attempt, got ${next.kind}`);
      deferAppTask(worker, next, {
        disposition: "waiting",
        inputKeys: [inputKey],
        report: true,
        summary,
        facts: ["source:review"],
        conditions: [
          {
            id: "source-ready",
            type: "source.access",
            subject: "resource:source",
            expected: { field: "ready", equals: true },
            owner: "app:worker",
            reviewAfterMs: 300_000,
          },
        ],
      });
      reportIds.push(next.attemptId);
    }
    f.reopen();
    worker = appTaskContext({ ...f.context(), resourceStore: AppTaskResourceStore.fromDb(f.db, "worker") });
    expect(listPendingConversationTaskChanges(f.db, app.id).map((change) => change.attemptId)).toEqual([reportIds[1]!]);
    for (const topic of unrelatedTopics)
      expect(admitConversationTaskChange(f.context(), worker, { ...returned, ...topic, attemptId: reportIds[1]! }).created).toBe(false);
    expect(admitConversationTaskChange(f.context(), worker, { ...returned, attemptId: reportIds[0]! }).created).toBe(
      false,
    );
    if (scenario === "waiting-report") {
      const latest = admitConversationTaskChange(f.context(), worker, { ...returned, attemptId: reportIds[1]! }, [
        "message",
      ]);
      expect(latest.item?.input.data).toMatchObject({ outcome: { summary: "Please confirm the data source" } });
      expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
    }
    setSystemTime(Date.now() + 300_001);
    recordAppTaskTrigger(worker, "measurement", { type: "fixture.repaired" });
    const finishing = claimObservedAppTask(worker, {
      taskId: "measurement",
      appAgent: "worker",
      handler: "executor:fixture",
    });
    if (finishing.kind !== "claimed") throw new Error(`Expected final attempt, got ${finishing.kind}`);
    completeAppTask(worker, finishing, { inputKeys: [inputKey], summary: "Measured", result: { value: 17 }, facts: ["source:17"] });
    expect(readAppTaskAdmissionOutcome(worker, "measurement", inputKey)).toMatchObject({
      attemptId: finishing.attemptId,
      result: { value: 17 },
    });
    // Undelivered reports must not be newly admitted after an answer. Prior
    // Conversation input remains history; accepting an answer does not erase it.
    expect(admitConversationTaskChange(f.context(), worker, { ...returned, attemptId: reportIds[1]! }).created).toBe(
      false,
    );
    // Accepted Task outcomes remain visible to linked topics; selected input
    // reports above are narrower and must only wake their originating topic.
    expect(listPendingConversationTaskChanges(f.db, app.id).filter((change) => change.topicId === returned.topicId).map((change) => change.attemptId)).toEqual([
      finishing.attemptId,
    ]);
    expect(worker.resourceStore.isCancelled("measurement")).toBe(false);
    expect(readConversationRequest(f.db, app.id, "chat", "comparison")?.status).toBe("open");
  },
);

test("Conversation ingress rejects direct executor targets and preserves untargeted caller identity", () => {
  const f = fixture();
  const first = f.admit();
  completeConversationTaskTurn(f.context(), f.claim(first.taskId), decision);
  const task = f.store.readTask(first.taskId)!;
  cancelAppTask(f.context(), {
    appId: app.id,
    taskId: first.taskId,
    expectedGeneration: task.metadata.generation,
    expectedResourceVersion: task.metadata.resourceVersion,
    decision: "app-policy", reason: "Historical terminal Conversation",
  });
  const successor = f.admit("successor", 2, "Continue");
  expect(successor.taskId).toBe(`${first.taskId}_successor_2`);
  const ingressApp = defineApp({
    ...app,
    conversation: { mode: "agent", inputKinds: ["message"] },
    tasks: {},
    task: () => {
      throw new Error("Exact Task targets must bypass App mapping");
    },
  });
  const host = new AppInboxHost({
    db: f.db,
    apps: [ingressApp],
    attachTask: (input) => admitTaskInput(f.context(), input),
    admitConversation: (input) =>
      admitConversationTaskInput(f.context(), {
        ...input,
        intent: {
          parentId: "root",
          outcome: "Discuss with the human",
          acceptance: ["Explain supported conclusions"],
          executor: "conversation",
        },
      }),
  });
  const targeted = (id: string, targetTaskId: string, conversationId?: string) => () =>
    host.admit({
      id,
      appId: app.id,
      parentId: "caller-request",
      targetTaskId,
      ...(conversationId ? { conversationId } : {}),
      source: { kind: "app", id: "caller" },
      input: { kind: "message", data: { text: "Review this feedback" } },
      idempotencyKey: `feedback:${id}`,
    });

  expect(targeted("missing-conversation", `  ${successor.taskId}\t`)).toThrow(
    "Conversation Task input must use conversationId without targetTaskId",
  );
  expect(targeted("stale-predecessor", first.taskId, "chat")).toThrow(
    "Conversation Task input must use conversationId without targetTaskId",
  );
  expect(targeted("mismatched-conversation", successor.taskId, "other-chat")).toThrow(
    "Conversation Task input must use conversationId without targetTaskId",
  );
  for (const id of ["missing-conversation", "stale-predecessor", "mismatched-conversation"]) {
    expect(getAppInboxItem(f.db, id)).toBeNull();
  }

  const admitted = host.admit({
    id: "corrected-feedback",
    appId: app.id,
    parentId: "caller-request",
    conversationId: "chat",
    source: { kind: "app", id: "caller" },
    input: { kind: "message", data: { text: "Review this feedback" } },
    idempotencyKey: "feedback:corrected",
  });
  expect(admitted.item).toMatchObject({
    id: "corrected-feedback",
    parentId: "caller-request",
    conversationId: "chat",
    executionTaskId: successor.taskId,
    source: { kind: "app", id: "caller" },
  });
  const claim = f.claim(successor.taskId);
  expect(readConversationTaskInputs(f.context(), claim).map((item) => item.id).sort()).toEqual([
    "corrected-feedback",
    "successor",
  ]);
});

test("recovery cannot attach an earlier exact target after it becomes a Conversation executor", async () => {
  const f = fixture();
  const executionTaskId = conversationTaskId(app.id, "chat");
  let now = 1_000;
  const ingressApp = defineApp({
    ...app,
    conversation: { mode: "agent", inputKinds: ["message"] },
    tasks: {},
    task: () => {
      throw new Error("Exact Task targets must bypass App mapping");
    },
  });
  const host = new AppInboxHost({
    db: f.db,
    apps: [ingressApp],
    attachTask: (input) => admitTaskInput(f.context(), input),
    admitConversation: (input) => admitConversationTaskInput(f.context(), { ...f.input(input.id), ...input }),
    now: () => now,
  });

  const input = {
    appId: app.id, targetTaskId: executionTaskId,
    source: { kind: "system" as const, id: "reviewer" },
    input: { kind: "message", data: { text: "Review this feedback" } },
  };
  // New missing targets are final rejections, even if that identity later exists.
  expect(host.admit({ ...input, id: "missing-target" }).item).toMatchObject({
    status: "done", handling: { phase: "failed", reason: expect.stringContaining("does not exist") },
  });
  // A released Host may have retained a missing-target input for retry.
  createAppInboxItem(f.db, { ...input, id: "early-feedback", now });
  const conversation = f.admit();
  expect(conversation.taskId).toBe(executionTaskId);
  now += 1_000;
  await host.recoverAdmissions();

  expect(getAppInboxItem(f.db, "early-feedback")).toMatchObject({
    status: "done",
    targetTaskId: executionTaskId,
    handling: { phase: "failed", reason: "Conversation Task input must use conversationId without targetTaskId" },
  });
  expect(getAppInboxItem(f.db, "early-feedback")?.waitingOn).toBeUndefined();
  expect(getAppInboxItem(f.db, "early-feedback")?.taskAdmissionKey).toBeUndefined();
  expect(readAppTaskAdmissionOutcome(f.context(), executionTaskId, "task:early-feedback")).toBeNull();
  expect(host.get("missing-target")?.status).toBe("done");

  const claim = f.claim(executionTaskId);
  expect(readConversationTaskInputs(f.context(), claim).map((item) => item.id)).toEqual([conversation.item.id]);
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
  expect(() => completeConversationTaskTurn(f.context(), forged, decision)).toThrow("does not belong");
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
  expect(() => completeConversationTaskTurn(f.context(), claim, decision)).toThrow();
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
  completeConversationTaskTurn(f.context(), next, decision);
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
  const batch = readConversationTaskInputs(f.context(), claim);
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
  completeConversationTaskTurn(f.context(), firstClaim, decision);
  const topic = readAppConversationResource(f.db, app.id, "chat").topics[0]!;
  const other = admitConversationTaskInput(f.context(), { ...f.input("other"), conversationId: "other-chat" });
  completeConversationTaskTurn(f.context(), f.claim(other.taskId), decision);
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
      completeConversationTaskTurn(f.context(), claim, {
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
  completeConversationTaskTurn(f.context(), f.claim(input.taskId), decision);
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
    data: { appId: source.appId, taskId: "sample", generation: closed.cancellation.generation, closure: closed.cancellation },
  });
  expect(admitConversationTaskChange(f.context(), worker, ref).created).toBe(false);
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
});

test("recovery scopes report lookups to linked Tasks without changing legacy JSON identity comparisons", () => {
  const f = fixture();
  const input = f.admit();
  completeConversationTaskTurn(f.context(), f.claim(input.taskId), decision);
  const topic = readAppConversationResource(f.db, app.id, "chat").topics[0]!;
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
  }
  f.db.exec("COMMIT");
  f.db.exec("ANALYZE");
  const prepare = f.db.prepare.bind(f.db);
  let recoverySql = "";
  let recoveryArgs: unknown[] = [];
  const capture = spyOn(f.db, "prepare").mockImplementation((sql) => {
    const statement = prepare(sql);
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
    expect(admissionLookups).toEqual([
      expect.stringContaining("idx_app_task_admissions_target_text (app_id=? AND <expr>=?)"),
      expect.stringContaining("idx_app_task_admissions_target_text (app_id=? AND <expr>=?)"),
    ]);
    expect(plan.some((step) => String(step.detail).startsWith("SCAN admission"))).toBe(false);
    expect(plan.filter((step) => String(step.detail).includes("MATERIALIZE linked_tasks"))).toHaveLength(1);
    expect(plan.filter((step) => String(step.detail).includes("MATERIALIZE selected_reports"))).toHaveLength(1);
    expect(plan.filter((step) => String(step.detail).includes("MATERIALIZE live_conversations"))).toHaveLength(1);
    f.db.prepare("UPDATE app_task_admissions SET admission_json = ? WHERE app_id = ? AND task_id = ?")
      .run(admission.admission_json, app.id, admission.task_id);
    expect(admitConversationTaskChange(f.context(), f.context(), ref).created).toBe(true);
    expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
  } finally {
    capture.mockRestore();
  }
});

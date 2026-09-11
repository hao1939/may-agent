import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp, type ConversationTurnResult } from "@may-agent/sdk";
import { getDb, closeDb } from "../../../lib/requests.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import {
  appTaskContext,
  claimObservedAppTask,
  closeAppTask,
  completeAppTask,
  deferAppTask,
  recordAppTaskTrigger,
  readAppTaskAdmissionOutcome,
  observeAppTaskIntent,
} from "../tasks/app-task-reconciler.js";
import { AppTaskController } from "../tasks/controller.js";
import { readAppTaskReconciliationEvents } from "../tasks/app-task-context.js";
import { trackAppTaskConditionEventForTasks } from "../tasks/app-task-condition-tracker.js";
import { createConversationInbox } from "../../composition/conversation-inbox.js";
import { prepareConversationTaskTurn } from "../../composition/conversation-task-turn.js";
import { createAppInboxItem, claimAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { readAppConversationResource, linkConversationTopicTask, createConversationTopic } from "./conversations.js";
import { readConversationRequest } from "./conversation-requests.js";
import {
  admitConversationTaskInput,
  admitConversationTaskChange,
  completeConversationTaskTurn,
  stopConversationTaskTurn,
  readConversationTaskInputs,
  listPendingConversationTaskChanges,
} from "./conversation-task-turns.js";

const roots: string[] = [];
// State fixtures supply the claim. Installed-runtime tests exercise its owner.
async function executeConversationTaskTurn(input: Parameters<typeof prepareConversationTaskTurn>[0]) {
  const proposal = await prepareConversationTaskTurn(input);
  return completeConversationTaskTurn(input.config, input.claim, proposal.decision, proposal);
}
afterEach(() =>
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }),
);
const app = defineApp({
  id: "sample",
  version: 1,
  agent: "sample",
  requests: { mode: "agent" },
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
      mode: "maintain" as const,
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
      maxRetries: 0,
      onError: (_id, error) => reject(error),
      async reconcile(id) {
        const claim = f.claim(id);
        const result = await executeConversationTaskTurn({
          config: f.context(),
          claim,
          app,
          signal: new AbortController().signal,
          resolveRequest: async ({ request, execution }) => {
            expect(request.conversation?.id).toBe("chat");
            expect(execution?.taskBinding).toEqual({
              appId: app.id,
              taskId,
              generation: claim.generation,
              attemptId: claim.attemptId,
            });
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

test("failed reply persistence rolls back Request, Topic and Task acceptance together", () => {
  const f = fixture();
  const input = f.admit();
  const claim = f.claim(input.taskId);
  f.db.exec(`CREATE TRIGGER fail_reply BEFORE UPDATE OF result ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'reply write failed'); END`);
  expect(() => completeConversationTaskTurn(f.context(), claim, decision)).toThrow("reply write failed");
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
  expect(readAppConversationResource(f.db, app.id, "chat").topics).toEqual([]);
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(f.store.readTask(input.taskId)?.status.currentAttemptId).toBe(claim.attemptId);
  expect(readAppTaskAdmissionOutcome(f.context(), input.taskId, input.item.taskAdmissionKey!)).toBeNull();
  f.db.exec("DROP TRIGGER fail_reply");
  expect(completeConversationTaskTurn(f.context(), claim, decision).status).toBe("applied");
});

test("late output after owner closure cannot publish a reply or close a Request", () => {
  const f = fixture();
  const input = f.admit();
  const claim = f.claim(input.taskId);
  const task = f.store.readTask(input.taskId)!;
  closeAppTask(f.context(), {
    appId: app.id,
    taskId: input.taskId,
    expectedGeneration: task.metadata.generation,
    expectedResourceVersion: task.metadata.resourceVersion,
    reason: "End this Conversation",
  });
  expect(() => completeConversationTaskTurn(f.context(), claim, decision)).toThrow("stale");
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
  expect(getAppInboxItem(f.db, input.item.id)?.result).toBeUndefined();
  expect(() => f.admit("late", 2)).toThrow();
  expect(getAppInboxItem(f.db, "late")).toBeNull();
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
    ...f.input("review", 3, "A linked Task returned evidence"),
    source: { kind: "system", id: "review" },
  });
  completeConversationTaskTurn(f.context(), obsolete, decision);
  const claim = f.claim(first.taskId);
  await executeConversationTaskTurn({
    config: f.context(),
    claim,
    app,
    signal: new AbortController().signal,
    resolveRequest: async ({ request }) => {
      expect(request.id).toBe(correction.item.id);
      expect(request.inputs?.map(({ id }) => id)).toEqual([system.item.id, first.item.id, correction.item.id]);
      return decision;
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
    ...f.input("review", 3, "A linked Task returned evidence"),
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
    requestUpdates: [{ id: "comparison", scope: "Compare A and B", expectedRevision: 0, disposition: "open" }],
    followUp: {
      requestId: "comparison",
      appId: app.id,
      outcome: "Get evidence",
      acceptance: ["Measure"],
      input: { kind: "message", data: { text: "Get evidence" } },
    },
  };
  const followUp = {
    config: f.context(),
    attachment: {
      kind: "desired" as const,
      intent: {
        id: "measurement",
        parentId: "root",
        outcome: "Get evidence",
        acceptance: ["Measure"],
        mode: "achieve" as const,
      },
    },
  };
  f.db.exec(`CREATE TRIGGER fail_followup_reply BEFORE UPDATE OF result ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'reply rejected'); END`);
  expect(() => completeConversationTaskTurn(f.context(), claim, handoff, { followUp })).toThrow("reply rejected");
  expect(f.store.readTask("measurement")).toBeNull();
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toBeNull();
  expect(readAppConversationResource(f.db, app.id, "chat").topics).toEqual([]);
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
  f.db.exec("DROP TRIGGER fail_followup_reply");
  const accepted = completeConversationTaskTurn(f.context(), claim, handoff, { followUp });
  expect(accepted).toMatchObject({ admittedTasks: [{ appId: app.id, taskId: "measurement" }] });
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")).toMatchObject({
    status: "open",
    taskRefs: [{ appId: app.id, taskId: "measurement" }],
  });
});

test("a system turn can stay quiet without hiding the accepted Task evidence", async () => {
  const f = fixture();
  const first = f.admit();
  completeConversationTaskTurn(f.context(), f.claim(first.taskId), decision);
  const before = readAppConversationResource(f.db, app.id, "chat").messages;
  const signal = admitConversationTaskInput(f.context(), {
    ...f.input("tick", 2),
    source: { kind: "system", id: "tick" },
    input: { kind: "review", data: {} },
  });
  const claim = f.claim(signal.taskId);
  await executeConversationTaskTurn({
    config: f.context(),
    claim,
    app,
    signal: new AbortController().signal,
    resolveRequest: async ({ request }) => {
      expect(request.source.kind).toBe("system");
      expect(request.humanRequested).toBeUndefined();
      return { summary: "No material change", topic: { kind: "none" } };
    },
  });
  expect(readAppConversationResource(f.db, app.id, "chat").messages).toEqual(before);
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult?.summary).toBe("No material change");
  expect(getAppInboxItem(f.db, "tick")?.status).toBe("done");
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
});

function cancellationFixture(source: "human" | "system" = "human") {
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
  const intent = { id: "job", parentId: "root", outcome: "Measure the sample", acceptance: ["Return evidence"] };
  observeAppTaskIntent(config, { appAgent: worker.id, intent: { ...intent, mode: "maintain" } });
  createConversationTopic(f.db, {
    id: "work",
    appId: app.id,
    conversationId: "chat",
    title: "Sample",
    openedBy: "human",
    originMessageId: "first",
  });
  linkConversationTopicTask(f.db, "work", worker.id, "job");
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
    prepare: (decision = answer) =>
      prepareConversationTaskTurn({
        config: f.context(),
        claim,
        app,
        signal: new AbortController().signal,
        getTaskApp: () => ({ app: worker, config }),
        resolveRequest: async () => decision,
      }),
  };
}

test("human cancellation, reply and accepted Turn commit together across Apps and survive reopen", async () => {
  const c = cancellationFixture();
  const targetClaim = claimObservedAppTask(c.config, { taskId: "job", appAgent: "worker", handler: "executor:test" });
  expect(targetClaim.kind).toBe("claimed");
  const proposal = await c.prepare();
  c.f.db.exec(`CREATE TRIGGER reject_cancel_reply BEFORE UPDATE OF result ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'reply rejected'); END`);
  const settle = () => completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, proposal);
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
  expect(completeAppTask(c.config, targetClaim, { summary: "Late answer", evidence: [] }).status).toBe("stale");
  c.f.reopen();
  expect(AppTaskResourceStore.fromDb(c.f.db, "worker").readCancellation("job")?.reason).toBe(
    "Human withdrew the assignment",
  );
  expect(getAppInboxItem(c.f.db, "first")?.result?.response).toBe(c.answer.response);
});

test("a target revision after preparation rolls back the proposed cancellation and reply", async () => {
  const c = cancellationFixture();
  const proposal = await c.prepare();
  observeAppTaskIntent(c.config, {
    appAgent: c.worker.id,
    intent: { ...c.intent, outcome: "Measure another sample", mode: "maintain" },
  });
  expect(() => completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, proposal)).toThrow(
    "generation changed",
  );
  expect(c.store.isCancelled("job")).toBe(false);
  expect(c.f.store.readAttempt(c.claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(getAppInboxItem(c.f.db, "first")?.status).not.toBe("done");
});

test("a newer human input prevents the old Turn from applying cancellation", async () => {
  const c = cancellationFixture();
  const proposal = await c.prepare();
  c.f.admit("correction", 2, "Keep it running");
  completeConversationTaskTurn(c.f.context(), c.claim, proposal.decision, proposal);
  expect(c.store.isCancelled("job")).toBe(false);
  expect(c.f.store.readAttempt(c.claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(getAppInboxItem(c.f.db, "first")?.status).not.toBe("done");
});

test("Conversation control preparation requires human authority and an exact contextual target", async () => {
  const system = cancellationFixture("system");
  await expect(system.prepare()).rejects.toThrow("direct human Turn");
  expect(system.store.isCancelled("job")).toBe(false);
  const human = cancellationFixture();
  await expect(
    human.prepare({ ...human.answer, taskControls: [{ ...human.answer.taskControls![0]!, taskId: "invented" }] }),
  ).rejects.toThrow("absent from Conversation context");
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

test("one controller returns B through A to the real Conversation after intervening input and restart", async () => {
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
        mode: "achieve",
      },
    }),
  });
  const failures: unknown[] = [];
  const judgments: string[] = [];
  let topicId = "";
  let firstResultAttemptId = "";
  const until = async (predicate: () => boolean) => {
    const until = Date.now() + 2_000;
    while (!predicate()) {
      if (failures.length) throw failures[0];
      if (Date.now() >= until) throw new Error("Conversation chain did not progress");
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  };
  const makeController = () =>
    new AppTaskController({
      maxConcurrent: 1,
      maxRetries: 0,
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
            resolveRequest: async ({ request }) => {
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
                    },
                  ],
                  followUp: {
                    requestId: "measurement",
                    appId: app.id,
                    outcome: "Measure the sample",
                    acceptance: ["Return a measured value"],
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
        } else if (taskId === "A" && !f.store.readTask("B")) {
          const result = deferAppTask(f.context(), claim, {
            disposition: "waiting",
            summary: "Get measurement from B",
            evidence: ["Measurement required"],
            actions: [
              {
                kind: "create-task",
                id: "B",
                parentId: "A",
                outcome: "Read sample",
                acceptance: ["Return measured value"],
                mode: "achieve",
                outputs: [],
              },
            ],
          });
          for (const id of result.reconcileTaskIds) controller.enqueue(id);
        } else if (taskId === "B" && !claim.trigger?.ready) {
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
          let measurement: Record<string, unknown> = { value: 17 };
          if (taskId === "A") {
            const returned = readAppTaskReconciliationEvents(f.store, claim).items.find(
              ({ event }) => event.data.childTaskId === "B",
            )?.event.data;
            expect(returned?.acceptedResult).toMatchObject({ state: "converged", result: { value: 17 } });
            measurement = (returned!.acceptedResult as { result: Record<string, unknown> }).result;
          }
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
    await until(() => f.store.readTask("B")?.status.phase === "waiting" && !controller.snapshot().running.length);
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
        ["B"],
      ),
    ).toHaveLength(1);
    controller.enqueue("B");
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
    expect(f.store.isCancelled("B")).toBe(false);
    expect(
      f.db.prepare("SELECT id FROM app_inbox_items WHERE lease_owner IS NOT NULL OR lease_generation != 0").all(),
    ).toEqual([]);
  } finally {
    controller.close();
    await controller.whenDrained();
  }
});

test("a returned outcome keeps its exact App, Task and attempt identity across App boundaries", () => {
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
  const worker = appTaskContext({ ...f.context(), resourceStore: workers });
  const handedOff = completeConversationTaskTurn(
    f.context(),
    f.claim(first.taskId),
    {
      ...decision,
      requestUpdates: [{ id: "comparison", scope: "Compare A and B", expectedRevision: 0, disposition: "open" }],
      followUp: {
        appId: "worker",
        requestId: "comparison",
        outcome: "Collect evidence",
        acceptance: ["Measure"],
        input: { kind: "measure", data: {} },
      },
    },
    {
      followUp: {
        config: worker,
        attachment: {
          kind: "desired",
          intent: {
            id: "measurement",
            parentId: "root",
            outcome: "Collect evidence",
            acceptance: ["Measure"],
            mode: "achieve",
          },
        },
      },
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
  expect(() => admitConversationTaskChange(f.context(), worker, returned)).toThrow("accepted attempt");
  completeAppTask(worker, claim, { summary: "Measured", result: { value: 17 } });
  expect(() => admitConversationTaskChange(f.context(), worker, { ...returned, topicId: "unrelated" })).toThrow(
    "no link",
  );
  expect(() => admitConversationTaskChange(f.context(), worker, { ...returned, attemptId: "missing" })).toThrow(
    "accepted attempt",
  );
  const wake = admitConversationTaskChange(f.context(), worker, returned);
  expect(wake.taskId).toBe(first.taskId);
  expect(wake.item.input.data).toMatchObject({
    appId: "worker",
    taskId: "measurement",
    attemptId: claim.attemptId,
    outcome: { result: { value: 17 } },
  });
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")?.status).toBe("open");
  expect(admitConversationTaskChange(f.context(), worker, returned).created).toBe(false);
});

test("cutover refuses unhandled legacy input even with an expired lease", () => {
  const f = fixture();
  createAppInboxItem(f.db, f.input("old", 1));
  expect(claimAppInboxItem(f.db, "old", "legacy", 1, Date.now())).not.toBeNull();
  f.db.run("UPDATE app_inbox_items SET lease_expires_at = 1 WHERE id = 'old'");
  expect(() => f.admit("new", 2)).toThrow("drain before cutover");
  expect(getAppInboxItem(f.db, "new")).toBeNull();
  expect(f.db.prepare("SELECT COUNT(*) AS count FROM app_tasks").get()).toEqual({ count: 0 });
});

test("old inbox cannot execute Task-owned Conversation input or later unconverted input", async () => {
  const f = fixture();
  const input = f.admit();
  createAppInboxItem(f.db, f.input("old-route", 2));
  let executions = 0;
  const host = createConversationInbox({
    db: f.db,
    apps: [app],
    resolveRequest: async () => {
      executions++;
      return decision;
    },
  });
  expect(claimAppInboxItem(f.db, input.item.id, "legacy", 1_000)).toBeNull();
  expect(claimAppInboxItem(f.db, "old-route", "legacy", 1_000)).toBeNull();
  expect(host.readyCount(app.id)).toBe(0);
  await host.reconcileOnce(app.id);
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
        mode: "achieve",
        outcome: "Measure sample",
        acceptance: ["Observed value"],
      },
    });
    completeAppTask(f.context(), f.claim(taskId), { summary: `Value ${index}`, evidence: [`measurement:${index}`] });
    if (index < 2) linkConversationTopicTask(f.db, topic.id, app.id, taskId);
  }
  linkConversationTopicTask(f.db, otherTopic.id, app.id, "sample-0");
  const finished = f.store.readTask("sample-1")!;
  closeAppTask(f.context(), {
    appId: app.id,
    taskId: "sample-1",
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
  closeAppTask(f.context(), {
    appId: app.id,
    taskId: first.taskId,
    expectedGeneration: current.metadata.generation,
    expectedResourceVersion: current.metadata.resourceVersion,
    reason: "Owner ended the Conversation",
  });
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
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
  observeAppTaskIntent(worker, {
    appAgent: "measurement",
    intent: {
      id: "sample",
      parentId: "root",
      mode: "achieve",
      outcome: "Measure sample",
      acceptance: ["Observed value"],
    },
  });
  linkConversationTopicTask(f.db, topic.id, source.appId, "sample");
  const task = source.readTask("sample")!;
  const closed = closeAppTask(worker, {
    appId: source.appId,
    taskId: "sample",
    expectedGeneration: task.metadata.generation,
    expectedResourceVersion: task.metadata.resourceVersion,
    reason: "The owner withdrew the assignment",
  });
  const ref = {
    conversationId: "chat",
    topicId: topic.id,
    taskId: "sample",
    closedGeneration: closed.closure.generation,
  };
  expect(() =>
    admitConversationTaskChange(f.context(), worker, { ...ref, closedGeneration: ref.closedGeneration + 1 }),
  ).toThrow("closed generation");
  expect(() => admitConversationTaskChange(f.context(), worker, { ...ref, topicId: "unrelated" })).toThrow("no link");
  f.db.exec(`CREATE TRIGGER reject_closure_input BEFORE INSERT ON app_inbox_items
    WHEN NEW.input_kind = 'task-closed' BEGIN SELECT RAISE(ABORT, 'closure input unavailable'); END`);
  expect(() => admitConversationTaskChange(f.context(), worker, ref)).toThrow("closure input unavailable");
  expect(f.store.readTrigger(input.taskId)).toBeNull();
  expect(source.readCancellation("sample")).toEqual(closed.closure);
  expect(listPendingConversationTaskChanges(f.db, app.id)).toHaveLength(1);
  f.db.exec("DROP TRIGGER reject_closure_input");
  const admitted = admitConversationTaskChange(f.context(), worker, ref);
  expect(admitted.item.input).toEqual({
    kind: "task-closed",
    data: { appId: source.appId, taskId: "sample", generation: closed.closure.generation, closure: closed.closure },
  });
  expect(admitConversationTaskChange(f.context(), worker, ref).created).toBe(false);
  expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
});

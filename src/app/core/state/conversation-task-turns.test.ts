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
} from "../tasks/app-task-reconciler.js";
import { AppTaskController } from "../tasks/controller.js";
import { readAppTaskReconciliationEvents } from "../tasks/app-task-context.js";
import { trackAppTaskConditionEventForTasks } from "../tasks/app-task-condition-tracker.js";
import { createConversationInbox } from "../../composition/conversation-inbox.js";
import { prepareConversationTaskTurn } from "../../composition/conversation-task-turn.js";
import { createAppInboxItem, claimAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { readAppConversationResource } from "./conversations.js";
import { readConversationRequest } from "./conversation-requests.js";
import {
  admitConversationTaskInput,
  admitConversationTaskOutcome,
  completeConversationTaskTurn,
  stopConversationTaskTurn,
} from "./conversation-task-turns.js";

const roots: string[] = [];
// State fixtures supply the claim. Installed-runtime tests exercise its owner.
async function executeConversationTaskTurn(input: Parameters<typeof prepareConversationTaskTurn>[0]) {
  const proposal = await prepareConversationTaskTurn(input);
  return completeConversationTaskTurn(input.config, input.claim, proposal.decision, { followUp: proposal.followUp });
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
  completeConversationTaskTurn(f.context(), obsolete, decision);
  const claim = f.claim(first.taskId);
  await executeConversationTaskTurn({
    config: f.context(),
    claim,
    app,
    signal: new AbortController().signal,
    resolveRequest: async ({ request }) => {
      expect(request.id).toBe(correction.item.id);
      expect(request.inputs?.map(({ id }) => id)).toEqual([first.item.id, correction.item.id]);
      return decision;
    },
  });
  for (const admitted of [first, correction]) {
    expect(getAppInboxItem(f.db, admitted.item.id)?.status).toBe("done");
    expect(readAppTaskAdmissionOutcome(f.context(), first.taskId, admitted.item.taskAdmissionKey!)?.attemptId).toBe(
      claim.attemptId,
    );
  }
  expect(f.store.readAttempt(obsolete.attemptId)?.acceptedResult).toBeUndefined();
  expect(
    readAppConversationResource(f.db, app.id, "chat").messages.filter(({ author }) => author.kind === "agent"),
  ).toHaveLength(1);
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
            getFollowUpApp: () => ({ app: workerApp, config: f.context() }),
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
            const returned = admitConversationTaskOutcome(f.context(), f.context(), {
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
    const replay = admitConversationTaskOutcome(f.context(), f.context(), {
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
  expect(() => admitConversationTaskOutcome(f.context(), worker, returned)).toThrow("accepted attempt");
  completeAppTask(worker, claim, { summary: "Measured", result: { value: 17 } });
  expect(() => admitConversationTaskOutcome(f.context(), worker, { ...returned, topicId: "unrelated" })).toThrow(
    "no link",
  );
  expect(() => admitConversationTaskOutcome(f.context(), worker, { ...returned, attemptId: "missing" })).toThrow(
    "accepted attempt",
  );
  const wake = admitConversationTaskOutcome(f.context(), worker, returned);
  expect(wake.taskId).toBe(first.taskId);
  expect(wake.item.input.data).toMatchObject({
    appId: "worker",
    taskId: "measurement",
    attemptId: claim.attemptId,
    outcome: { result: { value: 17 } },
  });
  expect(readConversationRequest(f.db, app.id, "chat", "comparison")?.status).toBe("open");
  expect(admitConversationTaskOutcome(f.context(), worker, returned).created).toBe(false);
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

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
  readAppTaskAdmissionOutcome,
} from "../tasks/app-task-reconciler.js";
import { AppTaskController } from "../tasks/controller.js";
import { createConversationInbox } from "../../composition/conversation-inbox.js";
import { executeConversationTaskTurn } from "../../composition/conversation-task-turn.js";
import { createAppInboxItem, claimAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { readAppConversationResource } from "./conversations.js";
import { readConversationRequest } from "./conversation-requests.js";
import { admitConversationTaskInput, completeConversationTaskTurn } from "./conversation-task-turns.js";

const roots: string[] = [];
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
  const input = (id = "first", sequence = 1) => ({
    id,
    appId: app.id,
    conversationId: "chat",
    conversationSequence: sequence,
    source: { kind: "human" as const, id },
    input: { kind: "message", data: { text: "Compare A and B" } },
    intent: {
      parentId: "root",
      mode: "maintain" as const,
      outcome: "Discuss with the human",
      acceptance: ["Explain supported conclusions"],
      executor: "conversation",
    },
  });
  const admit = (id?: string, sequence?: number) => admitConversationTaskInput(context(), input(id, sequence));
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

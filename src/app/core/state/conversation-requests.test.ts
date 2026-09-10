import { createConversationInbox } from "../../composition/conversation-inbox.js";
import { APP_REQUEST_CONVERSATION_MAX_BYTES } from "../../conversations/context.js";
import { boundedAppRequestConversation } from "../../conversations/context.js";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp, type AppRequestDecision, type AppConversationRequestUpdate } from "@may-agent/sdk";
import { getDb, closeDb } from "../../../lib/requests.js";
import { openDatabase } from "../../../lib/db.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { AppTaskResourceStore } from "../../app-task-resource-store.js";
import { appTaskContext, claimObservedAppTask, completeAppTask } from "../../app-task-reconciler.js";
import { admitTaskRequest } from "./inbox.js";
import {
  createConversationTopic,
  linkConversationTopicTask,
  listStaleConversationTopicTasks,
  readAppConversationResource,
  readConversationTopic,
} from "./conversations.js";
import { readConversationRequest, applyConversationRequestUpdates } from "./conversation-requests.js";
import { startAppInboxRuntime } from "../../app-inbox-runtime.js";
import { AppRegistry } from "../apps/registry.js";
import { EventBus, type AgentEvent } from "../events/bus.js";
import { HostCapacity } from "../../host-capacity.js";

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
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ text: Type.String() }) }),
  requests: { mode: "agent" },
});
const owner = defineApp({
  id: "owner",
  version: 1,
  agent: "owner",
  inputSchema: Type.Object({}),
  tasks: {},
  task: () => ({
    kind: "desired",
    intent: { id: "work", parentId: "project", mode: "achieve", outcome: "Find evidence", acceptance: ["Verified"] },
  }),
});
const answer: AppRequestDecision = { summary: "Answer", response: "Here is the comparison.", topic: { kind: "none" } };
const ask: AppConversationRequestUpdate = {
  id: "comparison",
  expectedRevision: 0,
  scope: "Compare two options",
  disposition: "open",
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-accepted-asks-"));
  roots.push(root);
  const db = getDb(root);
  let sequence = 0;
  const makeHost = (decision: AppRequestDecision) =>
    createConversationInbox({ db, apps: [app, owner], resolveRequest: async () => decision });
  const turn = async (decision: AppRequestDecision) => {
    const host = makeHost(decision);
    const id = `turn-${++sequence}`;
    host.admit({
      id,
      appId: app.id,
      conversationId: "chat",
      conversationSequence: sequence,
      source: { kind: "human", id },
      input: { kind: "message", data: { text: "Review" } },
    });
    return { id, host, result: await host.reconcileOnce(app.id) };
  };
  return { root, db, turn };
}

test("a discussion-only ask closes with its answer, not a proxy Task", async () => {
  const { db, turn } = fixture();
  const result = await turn({
    ...answer,
    requestUpdates: [{ ...ask, disposition: "fulfilled", reason: "Both options compared" }],
  });
  expect(result.result.errors).toEqual([]);
  const request = readConversationRequest(db, app.id, "chat", ask.id)!;
  expect(request).toMatchObject({
    status: "closed",
    scope: ask.scope,
    closure: { disposition: "fulfilled", messageId: `result:${result.id}` },
  });
  expect(db.prepare("SELECT COUNT(*) AS count FROM app_tasks").get()).toEqual({ count: 0 });
  expect(
    readAppConversationResource(db, app.id, "chat").messages.some(
      (message) => message.id === request.closure!.messageId && message.text === answer.response,
    ),
  ).toBe(true);
});

test("corrections retain identity; stale closure and silent scope narrowing are rejected", async () => {
  const { db, turn } = fixture();
  await turn({ ...answer, requestUpdates: [ask] });
  const correction = { ...ask, expectedRevision: 1, scope: "Compare both options including costs" };
  await turn({ ...answer, requestUpdates: [correction] });
  expect(readConversationRequest(db, app.id, "chat", ask.id)).toMatchObject({
    revision: 2,
    scope: correction.scope,
    status: "open",
  });
  const stale = await turn({
    ...answer,
    requestUpdates: [{ ...ask, expectedRevision: 1, disposition: "fulfilled", reason: "Old review" }],
  });
  expect(stale.result.errors.length).toBeGreaterThan(0);
  expect(stale.host.get(stale.id)?.handling?.phase).toBe("failed");
  const narrowed = await turn({
    ...answer,
    requestUpdates: [{ ...ask, expectedRevision: 2, disposition: "fulfilled", reason: "Forgot costs" }],
  });
  expect(narrowed.result.errors.length).toBeGreaterThan(0);
  expect(readConversationRequest(db, app.id, "chat", ask.id)?.scope).toBe(correction.scope);
  await turn({
    ...answer,
    response: "Withdrawn; no background work was started.",
    requestUpdates: [
      { ...correction, expectedRevision: 2, disposition: "withdrawn", reason: "Human withdrew the ask" },
    ],
  });
  expect(readConversationRequest(db, app.id, "chat", ask.id)?.closure?.disposition).toBe("withdrawn");
});

test("failed completion rolls back closure; reopen applies the saved decision without another execution", async () => {
  const { db, root } = fixture();
  let calls = 0;
  const decision = { ...answer, requestUpdates: [{ ...ask, disposition: "fulfilled" as const, reason: "Compared" }] };
  db.exec(
    `CREATE TRIGGER reject_result BEFORE UPDATE ON app_inbox_items WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fixture write failure'); END;`,
  );
  const host = createConversationInbox({
    db,
    apps: [app],
    retryAfterMs: 0,
    resolveRequest: async () => {
      calls++;
      return decision;
    },
  });
  host.admit({
    id: "one",
    appId: app.id,
    conversationId: "chat",
    conversationSequence: 1,
    source: { kind: "human", id: "human" },
    input: { kind: "message", data: { text: "Compare" } },
  });
  await host.reconcileOnce(app.id);
  expect(readConversationRequest(db, app.id, "chat", ask.id)?.status).toBe("open");
  db.exec("DROP TRIGGER reject_result");
  const reopened = openDatabase(join(root, "may.db"));
  try {
    const after = createConversationInbox({
      db: reopened,
      apps: [app],
      resolveRequest: async () => {
        calls++;
        return decision;
      },
    });
    expect((await after.reconcileOnce(app.id)).errors).toEqual([]);
    expect(calls).toBe(1);
    expect(readConversationRequest(reopened, app.id, "chat", ask.id)?.status).toBe("closed");
  } finally {
    reopened.close();
  }
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

test.each(["preserve", "add"])("handoff and closure stay atomic (%s Task links)", async (links) => {
  const { db, root } = fixture();
  createConversationTopic(db, {
    id: "origin",
    appId: app.id,
    conversationId: "chat",
    title: "Original discussion",
    openedBy: "human",
    originMessageId: "original",
  });
  applyConversationRequestUpdates(db, {
    appId: app.id,
    conversationId: "chat",
    topicId: "origin",
    updates: [ask],
    updateKey: "original",
    now: 1,
  });
  const store = AppTaskResourceStore.fromDb(db, owner.id);
  store.bootstrapSnapshot(
    {
      version: 1,
      project: owner.id,
      project_lifecycle: "active",
      root_task_id: "project",
      groups: { project: { id: "project", parent_id: null } },
      tasks: {},
    },
    "fixture",
  );
  const config = appTaskContext({
    appDir: root,
    projectDir: root,
    agent: owner.id,
    maxConcurrent: 1,
    resourceStore: store,
  });
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const registry = new AppRegistry(async () =>
    [app, owner].map((definition) => ({ appDir: join(root, definition.id), definition })),
  );
  await registry.reload();
  const runtime = await startAppInboxRuntime({
    db,
    bus,
    registry,
    hostCapacity: new HostCapacity(2),
    deferStart: true,
    resolveRequest: async () => ({
      ...answer,
      topic: { kind: "new", title: "Comparison" },
      followUp: {
        requestId: ask.id,
        outcome: "Find evidence",
        acceptance: ["Verified"],
        appId: owner.id,
        input: { kind: "work", data: {} },
      },
    }),
    attachTask: async (input) => {
      expect(readConversationRequest(db, app.id, "chat", ask.id)?.status).toBe("open");
      return { taskId: admitTaskRequest(config, input).taskId };
    },
  });
  try {
    runtime.host.admit({
      id: "one",
      appId: app.id,
      conversationId: "chat",
      conversationSequence: 1,
      source: { kind: "human", id: "human" },
      input: { kind: "message", data: { text: "Compare" } },
    });
    expect((await runtime.host.reconcileOnce(app.id)).errors).toEqual([]);
    const accepted = readConversationRequest(db, app.id, "chat", ask.id)!;
    expect(accepted.taskRefs).toEqual([{ appId: owner.id, taskId: "work" }]);
    expect(accepted.status).toBe("open");
    expect(accepted.topicId).toBe("origin");
    expect(runtime.host.get("one")?.topicId).not.toBe(accepted.topicId);
    for (let i = 0; i < 12; i++)
      applyConversationRequestUpdates(db, {
        appId: app.id,
        conversationId: "chat",
        updates: [{ ...ask, id: `unrelated-${i}` }],
        updateKey: `unrelated-${i}`,
        now: Date.now() + i,
      });
    const claim = claimObservedAppTask(config, { taskId: "work", appAgent: owner.id, handler: "agent:owner" });
    if (claim.kind !== "claimed") throw new Error("fixture claim");
    completeAppTask(config, claim, { summary: "Evidence collected" });
    // A new runtime can recover the missing review from durable state alone.
    const reopened = openDatabase(join(root, "may.db"));
    const recoveryBus = new EventBus();
    const recovered: AgentEvent[] = [];
    recoveryBus.subscribe((event) => {
      if (event.type === "conversation.task.changed") recovered.push(event);
    });
    const recovery = await startAppInboxRuntime({
      db: reopened,
      bus: recoveryBus,
      registry,
      hostCapacity: new HostCapacity(1),
      deferStart: true,
      now: () => Date.now() + 120_000,
    });
    try {
      recoveryBus.emit({
        type: "conversation.supervision.review",
        data: { project: app.id, minQuietMs: 60_000 },
      } as unknown as AgentEvent);
      expect(recovered).toHaveLength(1);
      expect((recovered[0] as unknown as { data: { requests: unknown[] } }).data.requests).toEqual([accepted]);
    } finally {
      recovery.close();
      reopened.close();
    }
    expect(listStaleConversationTopicTasks(db, app.id, { updatedBefore: Date.now() + 1, limit: 10 })).toContainEqual(
      expect.objectContaining({ taskId: "work" }),
    );
    const addedRefs = links === "add" ? [{ appId: owner.id, taskId: "additional-evidence" }] : [];
    const resultRefs = [...accepted.taskRefs, ...addedRefs];
    const priorTopicRefs = readConversationTopic(db, app.id, "chat", accepted.topicId!)!.taskRefs;
    const update = {
      ...ask,
      expectedRevision: accepted.revision,
      disposition: "fulfilled",
      reason: "The evidence supports the comparison",
      taskRefs: addedRefs,
    };
    const event = () =>
      ({
        type: "project.task.reconciled",
        source: "fixture",
        owner: "app:sample",
        data: {
          project: app.id,
          taskId: "supervision",
          disposition: "progressed",
          result: {
            conversation: {
              conversationId: "chat",
              topicId: accepted.topicId,
              followUpId: "review-one",
              text: "Both options compared with costs.",
              taskRefs: resultRefs,
              requestUpdates: [update],
            },
          },
        },
      }) as unknown as AgentEvent;
    db.exec(`CREATE TRIGGER reject_message BEFORE INSERT ON events WHEN NEW.event_type = 'conversation.message.created'
      BEGIN SELECT RAISE(ABORT, 'fixture publication failure'); END;`);
    bus.emit(event());
    expect(readConversationRequest(db, app.id, "chat", ask.id)?.status).toBe("open");
    expect(readConversationRequest(db, app.id, "chat", ask.id)?.taskRefs).toEqual(accepted.taskRefs);
    expect(readConversationTopic(db, app.id, "chat", accepted.topicId!)?.taskRefs).toEqual(priorTopicRefs);
    db.exec("DROP TRIGGER reject_message");
    // A late completed-Task review cannot erase a subsequent human correction.
    applyConversationRequestUpdates(db, {
      appId: app.id,
      conversationId: "chat",
      updates: [{ ...ask, expectedRevision: accepted.revision, scope: "Compare options including costs" }],
      updateKey: "correction",
      now: Date.now(),
    });
    bus.emit(event());
    expect(readConversationRequest(db, app.id, "chat", ask.id)).toMatchObject({
      status: "open",
      revision: accepted.revision + 1,
    });
    expect(readConversationRequest(db, app.id, "chat", ask.id)?.taskRefs).toEqual(accepted.taskRefs);
    expect(readConversationTopic(db, app.id, "chat", accepted.topicId!)?.taskRefs).toEqual(priorTopicRefs);
    update.expectedRevision++;
    update.scope = "Compare options including costs";
    bus.emit(event());
    bus.emit(event());
    expect(readConversationRequest(db, app.id, "chat", ask.id)?.closure?.messageId).toBe("result:review-one");
    expect(readConversationRequest(db, app.id, "chat", ask.id)?.taskRefs).toEqual(resultRefs);
    expect(readConversationTopic(db, app.id, "chat", accepted.topicId!)?.taskRefs).toEqual(
      expect.arrayContaining(resultRefs.map((ref) => expect.objectContaining(ref))),
    );
    expect(
      readAppConversationResource(db, app.id, "chat").messages.filter((message) => message.id === "result:review-one"),
    ).toHaveLength(1);
    expect(listStaleConversationTopicTasks(db, app.id, { updatedBefore: Date.now() + 1, limit: 10 })).toEqual([]);
  } finally {
    runtime.close();
  }
});

test("open asks fit bounded context; an omitted ask can still be read and handed off by exact identity", async () => {
  const { db } = fixture();
  createConversationTopic(db, {
    id: "topic",
    appId: app.id,
    conversationId: "chat",
    title: "Research",
    openedBy: "human",
    originMessageId: "human",
  });
  for (let i = 0; i < 20; i++)
    applyConversationRequestUpdates(db, {
      appId: app.id,
      conversationId: "chat",
      topicId: "topic",
      updates: [{ ...ask, id: `ask-${i}`, scope: "界".repeat(2000) }],
      updateKey: `accept-${i}`,
      now: i,
    });
  const bounded = boundedAppRequestConversation(readAppConversationResource(db, app.id, "chat"), "new");
  expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThanOrEqual(APP_REQUEST_CONVERSATION_MAX_BYTES);
  expect(bounded.requests!.length).toBeGreaterThan(0);
  expect(bounded.requests!.every((item) => item.scope.length === 2000)).toBe(true);
  expect(readConversationRequest(db, app.id, "chat", "ask-0")?.scope.length).toBe(2000);
  let handoffs = 0;
  const host = createConversationInbox({
    db,
    apps: [app, owner],
    resolveRequest: async ({ request }) => {
      expect(request.conversation?.requests?.some((item) => item.id === "ask-0")).toBe(false);
      // The context tool reads the same scoped store when the ask is omitted.
      expect(readConversationRequest(db, app.id, "chat", "ask-0")?.status).toBe("open");
      return {
        ...answer,
        topic: { kind: "existing", id: "topic" },
        followUp: {
          requestId: "ask-0",
          appId: owner.id,
          input: { kind: "work", data: {} },
          outcome: "Research",
          acceptance: ["Evidence"],
        },
      };
    },
    onRequestFollowUp: (item, _followUp, _topicId, authorize) => {
      authorize();
      expect(item.handling).toMatchObject({ phase: "decided", requestRevisions: { "ask-0": 1 } });
      handoffs++;
    },
  });
  host.admit({
    id: "handoff",
    appId: app.id,
    conversationId: "chat",
    conversationSequence: 1,
    source: { kind: "human", id: "human" },
    input: { kind: "message", data: { text: "Start the research" } },
  });
  expect((await host.reconcileOnce(app.id)).errors).toEqual([]);
  expect(handoffs).toBe(1);
  expect(readConversationRequest(db, app.id, "chat", "ask-0")).toMatchObject({ status: "open", revision: 1 });
});

test.each(["closed", "foreign"])("a %s ask cannot be handed off through the scoped store fallback", async (state) => {
  const { db } = fixture();
  applyConversationRequestUpdates(db, {
    appId: app.id,
    conversationId: state === "foreign" ? "other" : "chat",
    updates: [
      { ...ask, ...(state === "closed" ? { disposition: "fulfilled" as const, reason: "Already answered" } : {}) },
    ],
    updateKey: "accept",
    messageId: "answer",
    now: 1,
  });
  let handoffs = 0;
  const host = createConversationInbox({
    db,
    apps: [app, owner],
    resolveRequest: async () => ({
      ...answer,
      topic: { kind: "new", title: "Research" },
      followUp: {
        requestId: ask.id,
        appId: owner.id,
        input: { kind: "work", data: {} },
        outcome: "Research",
        acceptance: ["Evidence"],
      },
    }),
    onRequestFollowUp: () => {
      handoffs++;
    },
  });
  host.admit({
    id: "handoff",
    appId: app.id,
    conversationId: "chat",
    conversationSequence: 1,
    source: { kind: "human", id: "human" },
    input: { kind: "message", data: { text: "Start the research" } },
  });
  expect((await host.reconcileOnce(app.id)).errors).toEqual([expect.stringContaining("open accepted Request")]);
  expect(handoffs).toBe(0);
  expect(host.get("handoff")?.handling?.phase).toBe("failed");
});

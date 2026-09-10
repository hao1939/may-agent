import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp, type AppRequestDecision, type AppConversationRequestUpdate } from "@may-agent/sdk";
import { getDb, closeDb } from "../../lib/requests.js";
import { openDatabase } from "../../lib/db.js";
import { DbWriter } from "../../lib/db-writer.js";
import { AppInboxHost, boundedAppRequestConversation, APP_REQUEST_CONVERSATION_MAX_BYTES } from "../app-inbox-host.js";
import { AppTaskResourceStore } from "../app-task-resource-store.js";
import { appTaskContext, claimObservedAppTask, completeAppTask } from "../app-task-reconciler.js";
import { admitTaskRequest } from "../core/state/requests.js";
import { createConversationTopic, listStaleConversationTopicTasks, readAppConversationResource } from "./store.js";
import { readConversationRequest, applyConversationRequestUpdates } from "./requests.js";
import { startAppInboxRuntime } from "../app-inbox-runtime.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EventBus, type AgentEvent } from "../core/events/bus.js";
import { HostCapacity } from "../host-capacity.js";

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
    new AppInboxHost({ db, apps: [app, owner], resolveRequest: async () => decision });
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
  const host = new AppInboxHost({
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
    const after = new AppInboxHost({
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

test("handoff preserves the accepted ask; finished work remains reviewable and closure includes its message atomically", async () => {
  const { db, root } = fixture();
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
      requestUpdates: [ask],
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
    const claim = claimObservedAppTask(config, { taskId: "work", appAgent: owner.id, handler: "agent:owner" });
    if (claim.kind !== "claimed") throw new Error("fixture claim");
    completeAppTask(config, claim, { summary: "Evidence collected" });
    expect(listStaleConversationTopicTasks(db, app.id, { updatedBefore: Date.now() + 1, limit: 10 })).toContainEqual(
      expect.objectContaining({ taskId: "work" }),
    );
    const update = {
      ...ask,
      expectedRevision: accepted.revision,
      disposition: "fulfilled",
      reason: "The evidence supports the comparison",
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
              taskRefs: accepted.taskRefs,
              requestUpdates: [update],
            },
          },
        },
      }) as unknown as AgentEvent;
    db.exec(`CREATE TRIGGER reject_message BEFORE INSERT ON events WHEN NEW.event_type = 'conversation.message.created'
      BEGIN SELECT RAISE(ABORT, 'fixture publication failure'); END;`);
    bus.emit(event());
    expect(readConversationRequest(db, app.id, "chat", ask.id)?.status).toBe("open");
    db.exec("DROP TRIGGER reject_message");
    bus.emit(event());
    bus.emit(event());
    expect(readConversationRequest(db, app.id, "chat", ask.id)?.closure?.messageId).toBe("result:review-one");
    expect(
      readAppConversationResource(db, app.id, "chat").messages.filter((message) => message.id === "result:review-one"),
    ).toHaveLength(1);
    expect(listStaleConversationTopicTasks(db, app.id, { updatedBefore: Date.now() + 1, limit: 10 })).toEqual([]);
  } finally {
    runtime.close();
  }
});

test("open asks fit bounded context without truncating the authoritative scope", () => {
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
});

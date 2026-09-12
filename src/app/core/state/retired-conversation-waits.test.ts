import { afterEach, expect, test } from "bun:test";
import { Type, defineApp } from "@may-agent/sdk";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { appTaskContext } from "../tasks/app-task-reconciler.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { assertAppInboxClaim, claimAppInboxItem, completeAppInboxClaim, waitAppInboxClaim } from "../../../../test/fixtures/legacy-inbox.js";
import { admitTaskInput } from "./inbox.js";
import {
  createConversationTopic,
  readAppConversationResource,
  readConversationMessageTopicId,
} from "./conversations.js";
import { applyConversationRequestUpdates, readConversationRequest } from "./conversation-requests.js";
import { finishTask, testAttachment } from "../../../../test/fixtures/request-task-state.js";

const roots: string[] = [];
const connections: SqliteDb[] = [];
afterEach(() => {
  connections.splice(0).forEach((db) => db.close());
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});
function connect(path: string) {
  const db = openDatabase(path);
  connections.push(db);
  return db;
}
function input(db: SqliteDb, id: string, conversationId?: string, parentId?: string) {
  return createAppInboxItem(db, {
    id,
    appId: parentId ? "example" : "frontend",
    conversationId,
    parentId,
    ...(conversationId ? { conversationSequence: 1 } : {}),
    source: { kind: parentId ? "app" : "human", id: parentId ?? id },
    input: { kind: "message", data: { text: "Review the facts" } },
    now: 1,
  }).item;
}

test("upgrade retires a dormant conversation wait, preserves its ask and Tasks, and exposes the failure after restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-retired-waits-"));
  roots.push(root);
  const path = join(root, "host.sqlite");
  let db = connect(path);
  applyDbSchema(db);
  createConversationTopic(db, {
    id: "topic",
    appId: "frontend",
    conversationId: "chat",
    title: "Review",
    openedBy: "human",
    originMessageId: "parent",
    now: 1,
  });
  const parent = input(db, "parent", "chat");
  const parentClaim = claimAppInboxItem(db, parent.id, "old-host", 60_000)!;
  waitAppInboxClaim(db, parentClaim, { kind: "app", id: "children:parent" });
  db.run("UPDATE app_inbox_items SET topic_id = 'topic', session_id = 'old-session' WHERE id = 'parent'");
  applyConversationRequestUpdates(db, {
    appId: "frontend",
    conversationId: "chat",
    topicId: "topic",
    updateKey: "accepted",
    now: 1,
    updates: [{ id: "ask", scope: "Review the facts", disposition: "open", expectedRevision: 0 }],
  });
  const askBefore = readConversationRequest(db, "frontend", "chat", "ask");
  const store = AppTaskResourceStore.fromDb(db, "example");
  store.bootstrapSnapshot(
    {
      version: 1,
      project: "example",
      project_lifecycle: "active",
      root_task_id: "project",
      groups: { project: { id: "project", parent_id: null } },
      tasks: {},
    },
    "fixture",
  );
  let config = appTaskContext({ appDir: root, projectDir: root, agent: "example-owner", resourceStore: store });
  for (const id of ["running-child", "finished-child"]) {
    const child = input(db, id, undefined, parent.id);
    admitTaskInput(config, {
      appId: "example",
      attachment: testAttachment(id),
      idempotencyKey: `task:${id}`,
      inputContext: { id, source: child.source, input: child.input },
      inboxInputId: child.id,
      topicId: "topic",
    });
  }
  finishTask(config, "finished-child");
  const tasksBefore = db.prepare("SELECT * FROM app_tasks ORDER BY task_id").all();
  const receiptsBefore = db.prepare("SELECT * FROM app_task_receipts").all();
  const childrenBefore = db.prepare("SELECT * FROM app_inbox_items WHERE parent_id = 'parent' ORDER BY id").all();
  const linksBefore = db.prepare("SELECT * FROM conversation_topic_tasks ORDER BY task_id").all();
  const acknowledgment = {
    appId: "frontend",
    conversationId: "chat",
    messageId: "result:parent",
    author: { kind: "agent", id: "frontend" },
    text: "I will review the child results.",
    metadata: { requestId: "parent", topicId: "topic" },
  };
  db.run("INSERT INTO events (event_type, data, timestamp) VALUES ('conversation.message.created', ?, 2)", [
    JSON.stringify(acknowledgment),
  ]);
  const eventsBefore = db.prepare("SELECT * FROM events").all();
  connections.pop()!.close();

  db = connect(path);
  applyDbSchema(db);
  const retired = getAppInboxItem(db, parent.id)!;
  expect(retired).toMatchObject({
    status: "done",
    handling: { phase: "failed", reason: expect.stringContaining("no longer supported") },
    waitingOn: { kind: "app", id: "children:parent" },
    sessionId: "old-session",
    result: { response: expect.stringContaining("Your ask remains unresolved") },
  });
  expect(retired.lease).toBeUndefined();
  expect(retired.availableAt).toBeUndefined();
  expect(readConversationRequest(db, "frontend", "chat", "ask")).toEqual(askBefore);
  expect(db.prepare("SELECT * FROM app_tasks ORDER BY task_id").all()).toEqual(tasksBefore);
  expect(db.prepare("SELECT * FROM app_task_receipts").all()).toEqual(receiptsBefore);
  expect(db.prepare("SELECT * FROM app_inbox_items WHERE parent_id = 'parent' ORDER BY id").all()).toEqual(
    childrenBefore,
  );
  expect(db.prepare("SELECT * FROM conversation_topic_tasks ORDER BY task_id").all()).toEqual(linksBefore);
  expect(db.prepare("SELECT * FROM events").all()).toEqual(eventsBefore);
  expect(() => assertAppInboxClaim(db, parentClaim)).toThrow();
  const messages = readAppConversationResource(db, "frontend", "chat").messages;
  expect(messages).toContainEqual(expect.objectContaining({ id: "result:parent", text: acknowledgment.text }));
  expect(messages).toContainEqual(expect.objectContaining({ id: "failure:parent", text: retired.result!.response }));
  expect(readConversationMessageTopicId(db, "frontend", "chat", "failure:parent")).toBe("topic");
  applyDbSchema(db);
  expect(getAppInboxItem(db, parent.id)).toEqual(retired);

  const frontend = defineApp({
    id: "frontend",
    version: 1,
    agent: "frontend",
    inputSchema: Type.Object({}),
    conversation: { mode: "agent" },
  });
  const worker = defineApp({
    id: "example",
    version: 1,
    agent: "example-owner",
    inputSchema: Type.Object({}),
    tasks: {},
    task: ({ id }) => testAttachment(id),
  });
  config = appTaskContext({
    appDir: root,
    projectDir: root,
    agent: "example-owner",
    resourceStore: AppTaskResourceStore.fromDb(db, "example"),
  });
  finishTask(config, "running-child");
  let modelCalls = 0;
  const host = new AppInboxHost({
    db,
    apps: [frontend, worker],
    resolveConversationInput: async () => {
      modelCalls++;
      throw new Error("Retired parent must not invoke the agent");
    },
    readDependency: async ({ dependency }) => ({
      ...dependency,
      status: "done",
      summary: "Verified",
      facts: ["fixture:checked"],
    }),
  });
  await host.recoverTaskResults();

  expect(getAppInboxItem(db, "running-child")?.result?.evidence).toEqual(["fixture:checked"]);
  expect(getAppInboxItem(db, "finished-child")?.status).toBe("done");

  expect(modelCalls).toBe(0);
  expect(readConversationRequest(db, "frontend", "chat", "ask")).toEqual(askBefore);
});

test("upgrade retires exact, ready and saved child waits while leaving completed and ordinary Task inputs alone", () => {
  const db = connect(":memory:");
  applyDbSchema(db);
  for (const id of ["aggregate", "exact", "reclaimed", "saved", "completed", "task-input", "answer"]) {
    input(db, id, `chat:${id}`);
    const claim = claimAppInboxItem(db, id, "old-host", 60_000)!;
    if (id === "aggregate") waitAppInboxClaim(db, claim, { kind: "app", id: `children:${id}` });
    if (id === "exact") waitAppInboxClaim(db, claim, { kind: "app", id: "unknown-child" });
    if (id === "task-input") waitAppInboxClaim(db, claim, { kind: "task", id: "ordinary-task" });
    if (id === "completed") {
      input(db, "historical-child", undefined, id);
      completeAppInboxClaim(db, claim, { summary: "Already verified", facts: ["fixture:proof"] });
    }
    if (id === "reclaimed") input(db, "pending-child", undefined, id);
    if (id === "saved")
      db.run("UPDATE app_inbox_items SET handling = ? WHERE id = ?", [
        JSON.stringify({ phase: "decided", decision: { summary: "Delegate", dependencies: [{ id: "child" }] } }),
        id,
      ]);
  }
  const unchanged = ["completed", "historical-child", "pending-child", "task-input", "answer"];
  const before = unchanged.map((id) => getAppInboxItem(db, id));
  applyDbSchema(db);
  for (const id of ["aggregate", "exact", "reclaimed", "saved"]) {
    expect(getAppInboxItem(db, id)).toMatchObject({ status: "done", handling: { phase: "failed" } });
    expect(getAppInboxItem(db, id)?.lease).toBeUndefined();
  }
  // Saved decision remains audit facts even though it can no longer execute.
  const saved = db.prepare("SELECT handling FROM app_inbox_items WHERE id = 'saved'").get()!;
  expect(JSON.parse(String(saved.handling)).decision).toEqual({ summary: "Delegate", dependencies: [{ id: "child" }] });
  expect(unchanged.map((id) => getAppInboxItem(db, id))).toEqual(before);
});

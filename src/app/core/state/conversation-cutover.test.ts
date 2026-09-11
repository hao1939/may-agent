import { afterEach, expect, test } from "bun:test";
import { Type, defineApp, type ConversationTurnResult } from "@may-agent/sdk";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDb, closeDb } from "../../../lib/requests.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { appTaskContext, claimObservedAppTask } from "../tasks/app-task-reconciler.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { prepareConversationTaskTurn } from "../../composition/conversation-task-turn.js";
import {
  assertAppInboxClaim,
  claimAppInboxItem,
  claimNextAppInboxItem,
  completeAppInboxClaim,
  createAppInboxItem,
  getAppInboxItem,
  recordAppInboxHandling,
  stopAppInboxTurn,
} from "./app-inbox-store.js";
import { createConversationTopic } from "./conversations.js";
import { applyConversationRequestUpdates, readConversationRequest } from "./conversation-requests.js";
import {
  admitConversationTaskInput,
  completeConversationTaskTurn,
  conversationTaskId,
  conversationTaskIntent,
} from "./conversation-task-turns.js";
import { migrateConversationInputs } from "./conversation-cutover.js";

const roots: string[] = [];
afterEach(() =>
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }),
);
const app = defineApp({
  id: "chat",
  version: 1,
  agent: "chat",
  requests: { mode: "agent", inputKinds: ["message"] },
  inputSchema: Type.Object({ kind: Type.String(), data: Type.Object({ text: Type.String() }) }),
});
const decision: ConversationTurnResult = {
  summary: "Prepared work",
  response: "I'll check the sample.",
  topic: { kind: "none" },
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-conversation-cutover-"));
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
    "cutover-fixture",
  );
  const config = () => appTaskContext({ appDir: root, projectDir: root, agent: "chat", resourceStore: store });
  let sequence = 0;
  const now = Date.now() - 10_000;
  function seed(
    phase: "pending" | "executing" | "decided" | "failed" | "stopped" | "done",
    conversationId = "primary",
  ) {
    const at = now + ++sequence;
    const id = `${conversationId}:${phase}`;
    createAppInboxItem(db, {
      id,
      appId: app.id,
      conversationId,
      conversationSequence: sequence,
      source: { kind: "human", id },
      input: { kind: "message", data: { text: `Handle ${id}` } },
      idempotencyKey: id,
      now: at,
    });
    if (phase === "pending") return;
    // Successive old processes left interrupted turns behind. Expiry permits
    // the next historical claim, but is not migration's quiescence proof.
    db.run("UPDATE app_inbox_items SET lease_expires_at = ? WHERE lease_owner IS NOT NULL", [at - 1]);
    const claim = claimAppInboxItem(db, id, "old-host", 60_000, at + 1)!;
    if (phase === "stopped")
      stopAppInboxTurn(
        db,
        {
          appId: app.id,
          conversationId,
          turnId: id,
          expectedRevision: claim.generation,
        },
        at + 2,
      );
    else if (phase === "done")
      completeAppInboxClaim(db, claim, { summary: "Answered", response: "Original answer" }, at + 2);
    else {
      recordAppInboxHandling(
        db,
        claim,
        phase === "decided"
          ? { phase, decision }
          : phase === "failed"
            ? { phase, reason: "Provider unavailable" }
            : { phase },
        at + 2,
      );
      db.run("UPDATE app_inbox_items SET session_id = ? WHERE id = ?", [`session:${id}`, id]);
      if (phase === "failed")
        completeAppInboxClaim(db, claim, { summary: "Provider unavailable", response: "The attempt failed" }, at + 3);
    }
    return claim;
  }
  return {
    root,
    config,
    seed,
    get db() {
      return db;
    },
    get store() {
      return store;
    },
    migrate: (oldRuntimeStopped = true) =>
      migrateConversationInputs(config(), { app, conversationId: "primary", oldRuntimeStopped }),
    reopen() {
      closeDb(root);
      db = getDb(root);
      store = AppTaskResourceStore.fromDb(db, app.id);
    },
  };
}

test("offline cutover retains history, fences old claims, and redoes only unfinished inputs through one Task", async () => {
  const f = fixture();
  f.seed("pending");
  const obsolete = f.seed("executing")!;
  f.seed("decided");
  f.seed("stopped");
  f.seed("done");
  f.seed("failed");
  f.seed("pending", "other");
  const other = getAppInboxItem(f.db, "other:pending");
  const originalFailed = getAppInboxItem(f.db, "primary:failed");
  const failedGeneration = f.db
    .prepare("SELECT lease_generation FROM app_inbox_items WHERE id = ?")
    .get("primary:failed")!.lease_generation;
  const originalStopped = getAppInboxItem(f.db, "primary:stopped");
  createConversationTopic(f.db, {
    id: "sample",
    appId: app.id,
    conversationId: "primary",
    title: "Sample",
    openedBy: "human",
    originMessageId: "primary:pending",
  });
  applyConversationRequestUpdates(f.db, {
    appId: app.id,
    conversationId: "primary",
    topicId: "sample",
    updateKey: "accept",
    now: Date.now(),
    updates: [{ id: "sample", expectedRevision: 0, scope: "Check the sample", disposition: "open" }],
  });
  const ask = readConversationRequest(f.db, app.id, "primary", "sample");
  const cutover = f.migrate();
  expect(cutover).toEqual({ taskId: conversationTaskId(app.id, "primary"), migrated: 6, pending: 4 });
  expect(() => assertAppInboxClaim(f.db, obsolete)).toThrow();
  expect(readConversationRequest(f.db, app.id, "primary", "sample")).toEqual(ask);
  expect(getAppInboxItem(f.db, "other:pending")).toEqual(other);
  expect(getAppInboxItem(f.db, "primary:stopped")?.result).toEqual(originalStopped?.result);
  expect(getAppInboxItem(f.db, "primary:done")?.result?.response).toBe("Original answer");
  const imported = Object.values(f.store.readTaskContext({ taskIds: [cutover.taskId] }).attempts ?? {});
  expect(imported).toHaveLength(5);
  expect(imported.find((attempt) => attempt.sessionId === "session:primary:failed")?.metadata.id).toBe(
    `inbox:primary:failed:${failedGeneration}`,
  );
  expect(imported.every((attempt) => !attempt.acceptedResult && !attempt.lease)).toBe(true);
  expect(imported.find((attempt) => attempt.sessionId === "session:primary:failed")?.events?.[0]?.event.data).toEqual({
    input: originalFailed,
  });
  const beforeReplay = f.store.revision();
  expect(f.migrate()).toEqual({ ...cutover, migrated: 0, pending: 0 });
  expect(f.store.revision()).toBe(beforeReplay);
  f.reopen();
  const claim = claimObservedAppTask(f.config(), {
    taskId: cutover.taskId,
    appAgent: "chat",
    handler: "executor:conversation",
  });
  if (claim.kind !== "claimed") throw new Error(`Expected claim, got ${claim.kind}`);
  const proposal = await prepareConversationTaskTurn({
    config: f.config(),
    claim,
    app,
    signal: new AbortController().signal,
    resolveRequest: async ({ request }) => {
      expect(request.inputs?.map((entry) => entry.id)).toEqual([
        "primary:pending",
        "primary:executing",
        "primary:decided",
        "primary:failed",
      ]);
      expect(request.previousAttempt).toMatchObject({
        sessionId: "session:primary:failed",
        state: "failed",
        summary: "Provider unavailable",
      });
      return {
        summary: "Verified after redo",
        response: "The sample meets the minimum.",
        topic: { kind: "existing", id: "sample" },
        requestUpdates: [
          {
            id: "sample",
            expectedRevision: ask!.revision,
            scope: ask!.scope,
            disposition: "fulfilled",
            reason: "Verified current measurement",
          },
        ],
      };
    },
  });
  expect(completeConversationTaskTurn(f.config(), claim, proposal.decision).status).toBe("applied");
  expect(readConversationRequest(f.db, app.id, "primary", "sample")?.status).toBe("closed");
  expect(getAppInboxItem(f.db, "primary:failed")?.handling).toBeUndefined();
  expect(getAppInboxItem(f.db, "primary:failed")?.result?.response).toBe("The sample meets the minimum.");
  expect(
    f.store.readAttempt(imported.find((attempt) => attempt.sessionId === "session:primary:failed")!.metadata.id)
      ?.events?.[0]?.event.data,
  ).toEqual({ input: originalFailed });
  expect(f.store.isCancelled(cutover.taskId)).toBe(false);
});

test("cutover requires explicit offline operation even after legacy lease expiry", () => {
  const f = fixture();
  f.seed("executing");
  f.db.run("UPDATE app_inbox_items SET lease_expires_at = 1");
  expect(() => f.migrate(false)).toThrow("old Host and all workers to be stopped");
  expect(f.store.readTask(conversationTaskId(app.id, "primary"))).toBeNull();
  expect(getAppInboxItem(f.db, "primary:executing")?.executionTaskId).toBeUndefined();
});

test("failed evidence import rolls the whole cutover back without invalidating the old claim", () => {
  const f = fixture();
  const claim = f.seed("executing")!;
  const before = getAppInboxItem(f.db, claim.item.id);
  f.db.exec(
    `CREATE TRIGGER reject_import BEFORE INSERT ON app_task_attempts BEGIN SELECT RAISE(ABORT, 'cannot import evidence'); END`,
  );
  expect(() => f.migrate()).toThrow("cannot import evidence");
  expect(getAppInboxItem(f.db, claim.item.id)).toEqual(before);
  expect(f.store.readTask(conversationTaskId(app.id, "primary"))).toBeNull();
  expect(() => assertAppInboxClaim(f.db, claim)).not.toThrow();
});

test("quiet migrated Conversations remain quiet, preserve Stop and accept later input", () => {
  const f = fixture();
  f.seed("done");
  f.seed("stopped");
  const cutover = f.migrate();
  expect(cutover.pending).toBe(0);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(f.store.nextDueAt()).toBeNull();
  expect(claimNextAppInboxItem(f.db, app.id, "obsolete", 1_000)).toBeNull();
  const input = admitConversationTaskInput(f.config(), {
    appId: app.id,
    conversationId: "primary",
    id: "later",
    source: { kind: "human", id: "later" },
    input: { kind: "message", data: { text: "A new question" } },
    intent: conversationTaskIntent(f.config()),
  });
  expect(input.taskId).toBe(cutover.taskId);
  expect(
    claimObservedAppTask(f.config(), { taskId: input.taskId, appAgent: "chat", handler: "executor:conversation" }).kind,
  ).toBe("claimed");
  expect(getAppInboxItem(f.db, "primary:stopped")?.handling?.phase).toBe("stopped");
});

test("cutover refuses to overwrite an existing Conversation execution owner", () => {
  const f = fixture();
  const admitted = admitConversationTaskInput(f.config(), {
    appId: app.id,
    conversationId: "primary",
    id: "current",
    conversationSequence: 100,
    source: { kind: "human", id: "current" },
    input: { kind: "message", data: { text: "Current work" } },
    intent: conversationTaskIntent(f.config()),
  });
  f.seed("pending");
  const before = f.store.readTaskContext({ taskIds: [admitted.taskId] });
  expect(() => f.migrate()).toThrow("already owns this Conversation");
  expect(f.store.readTaskContext({ taskIds: [admitted.taskId] })).toEqual(before);
});

test("the inbox has no Conversation execution fallback when Task admission is unavailable", () => {
  const f = fixture();
  const host = new AppInboxHost({ db: f.db, apps: [app] });
  expect(() =>
    host.admit({
      appId: app.id,
      source: { kind: "human", id: "caller" },
      input: { kind: "message", data: { text: "Hello" } },
    }),
  ).toThrow("Conversation Task admission is not configured");
  expect(f.db.prepare("SELECT count(*) AS count FROM app_inbox_items").get()!.count).toBe(0);
});

import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp } from "@may-agent/sdk";
import { DbWriter } from "../lib/db-writer.js";
import { getDb, closeDb } from "../lib/requests.js";
import { openDatabase } from "../lib/db.js";
import { AppRegistry } from "./core/apps/registry.js";
import { EventBus } from "./core/events/bus.js";
import { createEventInterface } from "./core/events/interface.js";
import { startAppInboxRuntime } from "./app-inbox-runtime.js";
import { AppInboxHost } from "./app-inbox-host.js";
import { HostCapacity } from "./host-capacity.js";
import { readAppConversationResource } from "./core/state/conversations.js";
import { applyConversationRequestUpdates, readConversationRequest } from "./core/state/conversation-requests.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { appTaskContext, observeAppTaskIntent } from "./app-task-reconciler.js";

const app = defineApp({
  id: "sample",
  version: 1,
  agent: "sample",
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({}) }),
  requests: { mode: "agent" },
});
const answer = { summary: "Answered", response: "Answer", topic: { kind: "none" as const } };
const roots: string[] = [];
afterEach(() =>
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }),
);

test("public Stop persists before abort, rejects late output and cannot affect the next turn", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-turn-control-"));
  roots.push(root);
  const db = getDb(root);
  const tasks = AppTaskResourceStore.fromDb(db, app.id);
  tasks.bootstrapSnapshot(
    {
      version: 1,
      project: app.id,
      project_lifecycle: "active",
      root_task_id: "project",
      groups: { project: { id: "project", parent_id: null } },
      tasks: {},
    },
    "fixture",
  );
  observeAppTaskIntent(
    appTaskContext({ appDir: root, projectDir: root, agent: app.id, maxConcurrent: 1, resourceStore: tasks }),
    {
      appAgent: app.id,
      intent: {
        id: "independent",
        parentId: "project",
        mode: "achieve",
        outcome: "Independent work",
        acceptance: ["Verified"],
      },
      trigger: { type: "fixture.work", data: {} },
    },
  );
  const independent = tasks.readTask("independent");
  applyConversationRequestUpdates(db, {
    appId: app.id,
    conversationId: "chat",
    updateKey: "accepted",
    now: 1,
    updates: [{ id: "ask", expectedRevision: 0, scope: "Review the options", disposition: "open" }],
  });
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const registry = new AppRegistry(async () => [{ appDir: root, definition: app }]);
  await registry.reload();
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  let stoppedBeforeAbort = false;
  let calls = 0;
  const runtime = await startAppInboxRuntime({
    db,
    bus,
    registry,
    hostCapacity: new HostCapacity(2),
    deferStart: true,
    resolveRequest: async ({ request, execution }) => {
      calls++;
      if (request.id === "one") {
        execution!.signal.addEventListener("abort", () => {
          stoppedBeforeAbort = runtime.host.get("one")?.handling?.phase === "stopped";
        });
        entered.resolve();
        await finish.promise;
      }
      return request.id === "two"
        ? { ...answer, requestUpdates: [{ id: "ask", expectedRevision: 1, scope: "Discuss costs before implementing", disposition: "open" }] }
        : answer;
    },
  });
  const events = createEventInterface({
    bus,
    db,
    acceptsAppInput: () => true,
    hasApp: (id) => id === app.id,
    hasAgent: () => true,
    hasSession: () => true,
  });
  const admit = (id: string, sequence: number) =>
    runtime.host.admit({
      id,
      appId: app.id,
      conversationId: "chat",
      conversationSequence: sequence,
      source: { kind: "human", id },
      input: { kind: "message", data: {} },
    });
  admit("one", 1);
  const working = runtime.host.reconcileOnce(app.id);
  await entered.promise;
  const turn = readAppConversationResource(db, app.id, "chat").activeTurn!;
  const control = {
    type: "conversation.turn.stop.requested",
    target: { appId: app.id },
    data: { conversationId: "chat", turnId: turn.id, expectedRevision: turn.revision },
    idempotencyKey: "stop-one",
  };
  try {
    expect(events.publish(control, { source: "fixture-human" }).delivery).toBe("accepted");
    expect(stoppedBeforeAbort).toBe(true);
    expect(tasks.readTask("independent")).toEqual(independent);
    expect(events.publish(control, { source: "fixture-human" }).delivery).toBe("accepted");
    admit("two", 2);
    expect(runtime.host.readyCount(app.id)).toBe(0);
    finish.resolve();
    await working;
    expect(runtime.host.get("one")?.result?.response).toContain("Stopped this turn");
    await runtime.host.reconcileOnce(app.id);
    runtime.host.stopTurn({ appId: app.id, conversationId: "chat", turnId: "one", expectedRevision: turn.revision });
    expect(runtime.host.get("two")?.result?.response).toBe("Answer");
    expect(() =>
      runtime.host.stopTurn({ appId: app.id, conversationId: "wrong", turnId: "one", expectedRevision: turn.revision }),
    ).toThrow();
    const databasePath = db.prepare("PRAGMA database_list").get()!.file as string;
    const reopenedDb = openDatabase(databasePath);
    try {
      const after = new AppInboxHost({
        db: reopenedDb,
        apps: [app],
        resolveRequest: async () => {
          calls++;
          return answer;
        },
      });
      expect((await after.reconcileOnce(app.id)).claimed).toBe(0);
      expect(after.get("one")?.handling?.phase).toBe("stopped");
      expect(readConversationRequest(reopenedDb, app.id, "chat", "ask")).toMatchObject({ status: "open", revision: 2, scope: "Discuss costs before implementing" });
      expect(calls).toBe(2);
    } finally {
      reopenedDb.close();
    }
  } finally {
    finish.resolve();
    await working;
    runtime.close();
  }
});

test("failed Stop persistence does not abort; completed input and stale revisions stay unchanged", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-stop-storage-"));
  roots.push(root);
  const db = getDb(root);
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  let aborted = false;
  const host = new AppInboxHost({
    db,
    apps: [app],
    resolveRequest: async ({ execution }) => {
      execution!.signal.addEventListener("abort", () => {
        aborted = true;
      });
      entered.resolve();
      await finish.promise;
      return answer;
    },
  });
  host.admit({
    id: "one",
    appId: app.id,
    conversationId: "chat",
    conversationSequence: 1,
    source: { kind: "human", id: "human" },
    input: { kind: "message", data: {} },
  });
  const work = host.reconcileOnce(app.id);
  await entered.promise;
  const target = { appId: app.id, conversationId: "chat", turnId: "one", expectedRevision: 1 };
  try {
    db.exec(`CREATE TRIGGER no_stop BEFORE UPDATE ON app_inbox_items WHEN json_extract(NEW.handling, '$.phase') = 'stopped'
      BEGIN SELECT RAISE(ABORT, 'fixture stop persistence failure'); END;`);
    expect(() => host.stopTurn(target)).toThrow("fixture stop persistence failure");
    expect(aborted).toBe(false);
    expect(() => host.stopTurn({ ...target, expectedRevision: 2 })).toThrow("stale");
    db.exec("DROP TRIGGER no_stop");
    finish.resolve();
    await work;
    host.stopTurn(target);
    expect(host.get("one")?.result?.response).toBe("Answer");
    expect(aborted).toBe(false);
  } finally {
    finish.resolve();
    await work;
  }
});

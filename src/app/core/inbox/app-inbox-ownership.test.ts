import { afterEach, expect, spyOn, test } from "bun:test";
import { Type, defineApp } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppInboxHost } from "./app-inbox-host.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { appTaskContext } from "../tasks/app-task-reconciler.js";
import { attachRequestToTask } from "../state/inbox.js";
import { fakeTaskAttacher } from "../../../../test/fixtures/task-attachment.js";

const app = defineApp({
  id: "sample",
  version: 1,
  agent: "sample",
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({}) }),
  tasks: {},
  task: ({ id }) => ({
    kind: "desired",
    intent: {
      id: `work/${id}`,
      parentId: "root",
      mode: "achieve",
      outcome: `Handle ${id}`,
      acceptance: ["Input handled"],
    },
  }),
});
const databases: SqliteDb[] = [];
afterEach(() => databases.splice(0).forEach((db) => db.close()));
function database() {
  const db = openDatabase(":memory:");
  applyDbSchema(db);
  databases.push(db);
  return db;
}
function taskState(db: SqliteDb) {
  const resourceStore = AppTaskResourceStore.fromDb(db, app.id);
  resourceStore.bootstrapSnapshot(
    {
      project: app.id,
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
    "attachment-fixture",
  );
  return appTaskContext({ appDir: ".", projectDir: ".", agent: app.id, maxConcurrent: 1, resourceStore });
}
function admit(host: AppInboxHost, id: string, conversationId = "sample:primary") {
  host.admit({
    id,
    appId: app.id,
    conversationId,
    conversationSequence: id === "next" ? 2 : 1,
    source: { kind: "human", id },
    input: { kind: "message", data: {} },
  });
}

test("the fake attacher fences ownership before calling its admission resolver", async () => {
  const db = database();
  let effects = 0;
  const attach = fakeTaskAttacher(db, async () => {
    effects++;
    return { taskId: "work" };
  });
  await expect(
    attach({
      appId: app.id,
      attachment: { kind: "existing", taskId: "work" },
      idempotencyKey: "admission",
      request: { id: "turn", source: { kind: "human", id: "human" }, input: { kind: "message", data: {} } },
      authorize: () => {
        throw new Error("claim is stale");
      },
    }),
  ).rejects.toThrow("claim is stale");
  expect(effects).toBe(0);
});

test.each(["renewal write", "lost claim", "cleanup write"])(
  "contains %s failure until pending Task attachment settles",
  async (failure) => {
    const db = database();
    const config = taskState(db);
    const entered = Promise.withResolvers<void>();
    const lost = Promise.withResolvers<void>();
    const settled = Promise.withResolvers<void>();
    const diagnostic = spyOn(console, "error").mockImplementation((message) => {
      if (String(message).includes("ownership lost")) lost.resolve();
    });
    let calls = 0;
    let now = 1000;
    const host = new AppInboxHost({
      db,
      apps: [app],
      leaseMs: 300,
      now: () => now,
      attachTask: async (input) => {
        calls++;
        if (input.request.id === "first") {
          entered.resolve();
          await settled.promise;
        }
        return attachRequestToTask(config, { ...input, claim: input.claim! });
      },
    });
    admit(host, "first");
    const work = host.reconcileOnce(app.id);
    await entered.promise;
    now++;
    if (failure === "lost claim") db.run("UPDATE app_inbox_items SET lease_owner = 'replacement' WHERE id = 'first'");
    else
      db.exec(`CREATE TRIGGER fail_renew BEFORE UPDATE ON app_inbox_items
      WHEN OLD.id = 'first' AND ${failure === "cleanup write" ? "1" : "NEW.lease_expires_at > OLD.lease_expires_at"}
      BEGIN SELECT RAISE(ABORT, 'fixture storage failure'); END;`);
    try {
      await lost.promise;
      // The write-failure case must reject revoked local authority even while
      // the last persisted lease is still fresh. Wall-clock delay cannot hide it.
      if (failure === "renewal write") expect(host.get("first")?.lease?.expiresAt).toBeGreaterThan(now);
      admit(host, "other", "sample:other");
      expect((await host.reconcileOnce(app.id)).admitted).toBe(1);
      expect(config.resourceStore.readTask("work/other")).not.toBeNull();
      admit(host, "next");
      expect(host.readyCount(app.id)).toBe(0);
      expect((await host.reconcileOnce(app.id)).claimed).toBe(0);
      expect(calls).toBe(2);
      settled.resolve();
      const result = await work;
      expect(result.errors.length).toBeGreaterThan(0);
      expect(host.get("first")?.result).toBeUndefined();
      expect(config.resourceStore.readTask("work/first")).toBeNull();
      expect(config.resourceStore.readTask("work/next")).toBeNull();
    } finally {
      settled.resolve();
      await work;
      diagnostic.mockRestore();
    }
  },
);

test("rejects expired input ownership before creating Task work", async () => {
  const db = database();
  const config = taskState(db);
  let now = 1000;
  const host = new AppInboxHost({
    db,
    apps: [app],
    now: () => now,
    leaseMs: 300,
    attachTask: async (input) => {
      now += 301;
      return attachRequestToTask(config, { ...input, claim: input.claim!, now });
    },
  });
  admit(host, "expired");
  expect((await host.reconcileOnce(app.id)).errors).toEqual([expect.stringContaining("claim is stale")]);
  expect(config.resourceStore.readTask("work/expired")).toBeNull();
  expect(host.get("expired")?.result).toBeUndefined();
  expect(db.prepare("SELECT COUNT(*) AS count FROM conversation_topics").get()).toEqual({ count: 0 });
});

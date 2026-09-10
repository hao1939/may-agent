import { afterEach, expect, test } from "bun:test";
import { Type, defineApp } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { AppInboxHost } from "./app-inbox-host.js";

const app = defineApp({
  id: "sample",
  version: 1,
  agent: "sample",
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({}) }),
  requests: { mode: "agent" },
});
const answer = { summary: "Answered", response: "Answer", topic: { kind: "none" as const } };
const databases: SqliteDb[] = [];
afterEach(() => databases.splice(0).forEach((db) => db.close()));
function database() {
  const db = openDatabase(":memory:");
  applyDbSchema(db);
  databases.push(db);
  return db;
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

test.each(["renewal write", "lost claim", "cleanup write"])(
  "contains %s failure until the exact execution settles",
  async (failure) => {
    const db = database();
    const entered = Promise.withResolvers<void>();
    const aborted = Promise.withResolvers<void>();
    const settled = Promise.withResolvers<void>();
    let calls = 0;
    let published = 0;
    const host = new AppInboxHost({
      db,
      apps: [app],
      leaseMs: 300,
      resolveRequest: async ({ request, execution }) => {
        calls++;
        if (request.id !== "first") return answer;
        execution!.sessionStarted("session-first");
        execution!.signal.addEventListener("abort", () => aborted.resolve(), { once: true });
        entered.resolve();
        await settled.promise; // Model/tool cleanup can outlive cancellation.
        return answer;
      },
      onRequestCompleted: () => {
        published++;
      },
      onRequestMessage: () => {
        published++;
      },
    });
    admit(host, "first");
    const work = host.reconcileOnce(app.id);
    await entered.promise;
    expect(host.get("first")?.sessionId).toBe("session-first");
    if (failure === "lost claim") db.run("UPDATE app_inbox_items SET lease_owner = 'replacement' WHERE id = 'first'");
    else
      db.exec(`CREATE TRIGGER fail_renew BEFORE UPDATE ON app_inbox_items
    WHEN OLD.id = 'first' AND ${failure === "cleanup write" ? "1" : "NEW.lease_expires_at > OLD.lease_expires_at"}
    BEGIN SELECT RAISE(ABORT, 'fixture storage failure'); END;`);
    try {
      await aborted.promise;
      admit(host, "other", "sample:other");
      expect((await host.reconcileOnce(app.id)).admitted).toBe(1);
      admit(host, "next");
      expect(host.readyCount(app.id)).toBe(0);
      expect((await host.reconcileOnce(app.id)).claimed).toBe(0);
      expect(calls).toBe(2);
      expect(published).toBe(1);
    } finally {
      settled.resolve();
    }
    const result = await work;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(host.get("first")?.result).toBeUndefined();
    expect(published).toBe(1);
  },
);

test("rejects an expired execution before Topic creation, reply or handoff", async () => {
  const db = database();
  let now = 1000;
  let effects = 0;
  const host = new AppInboxHost({
    db,
    apps: [app],
    now: () => now,
    leaseMs: 300,
    resolveRequest: async () => {
      now += 301;
      return { ...answer, topic: { kind: "new", title: "Must not be created" } };
    },
    onRequestMessage: () => {
      effects++;
    },
    onRequestFollowUp: () => {
      effects++;
    },
  });
  admit(host, "expired");
  expect((await host.reconcileOnce(app.id)).errors).toEqual([expect.stringContaining("claim is stale")]);
  expect(effects).toBe(0);
  expect(db.prepare("SELECT COUNT(*) AS count FROM conversation_topics").get()).toEqual({ count: 0 });
});

import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DbWriter, findPersistedEventId } from "./db-writer.js";
import { closeDb, getDb } from "./requests.js";
import { EventBus } from "../app/core/events/bus.js";
import {
  createAppInboxItem,
  listAppInboxItems,
  listOpenAppInboxItemsByIdempotencyPrefix,
} from "../app/core/state/app-inbox-store.js";
import { findTaskEmission } from "../app/core/state/task-emissions.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("keyed Event and inbox reads use their existing partial indexes", () => {
  const root = mkdtempSync(join(tmpdir(), "may-identity-plans-"));
  roots.push(root);
  const db = getDb(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  const prepare = db.prepare.bind(db);
  const plans: string[][] = [];
  const spy = spyOn(db, "prepare").mockImplementation((sql) => {
    const statement = prepare(sql);
    if (!sql.trimStart().startsWith("SELECT") || !sql.includes("idempotency_key")) return statement;
    const explain = (args: unknown[]) => {
      plans.push(prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map((row) => String(row.detail)));
    };
    return {
      ...statement,
      get(...args: unknown[]) { explain(args); return statement.get(...args); },
      all(...args: unknown[]) { explain(args); return statement.all(...args); },
    };
  });
  try {
    const event = bus.emit({ type: "fixture.saved", source: "fixture", owner: "app:sample",
      data: { appId: "sample", idempotencyKey: "receipt" } });
    expect(findPersistedEventId(db, event)).toBeNumber();
    expect(findTaskEmission(db, { appId: "sample", taskId: "work", generation: 1 }, "fixture.saved", "key")).toBeNull();
    expect(plans).toHaveLength(3);
    for (const plan of plans.splice(0)) {
      expect(plan.some((step) => step.includes("idx_events_idempotency (event_type=? AND ingress_source=? AND idempotency_scope=? AND idempotency_key=?)"))).toBe(true);
    }
    const input = { appId: "sample", source: { kind: "app" as const, id: "caller" },
      input: { kind: "message", data: {} }, idempotencyKey: "parent:receipt" };
    const first = createAppInboxItem(db, input);
    expect(createAppInboxItem(db, input).item.id).toBe(first.item.id);
    expect(listAppInboxItems(db, { appId: "sample", idempotencyKey: input.idempotencyKey })).toHaveLength(1);
    expect(listOpenAppInboxItemsByIdempotencyPrefix(db, { appId: "sample", sourceAppId: "caller", prefix: "parent:" })).toHaveLength(1);
    expect(plans).toHaveLength(3);
    for (const plan of plans) {
      expect(plan.some((step) => step.includes("idx_app_inbox_idempotency (app_id=? AND idempotency_key"))).toBe(true);
    }
  } finally {
    spy.mockRestore();
  }
});

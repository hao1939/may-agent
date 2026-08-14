import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../lib/requests.js";
import { DbWriter } from "../../lib/db-writer.js";
import { EventBus } from "../event-bus.js";
import { registerEventPairOrphanGc } from "./register-orphan-gc.js";

function createMockCron() {
  const handlers = new Map<string, unknown>();
  const entries: Array<Record<string, unknown>> = [];
  return {
    registerHandler(name: string, handler: unknown) {
      handlers.set(name, handler);
    },
    addSyntheticEntry(entry: Record<string, unknown>) {
      entries.push(entry);
    },
    getHandler(name: string) {
      return handlers.get(name);
    },
    getEntries() {
      return entries;
    },
  };
}

describe("event-pair-orphan-gc handler", () => {
  it("registers bounded generic cleanup", () => {
    const cron = createMockCron();
    registerEventPairOrphanGc(cron as any, "/tmp/nonexistent", new EventBus());

    expect(cron.getHandler("event-pair-orphan-gc")).toBeDefined();
    expect(cron.getEntries()).toEqual([
      expect.objectContaining({
        name: "event-pair-orphan-gc",
        intervalMs: 15 * 60 * 1000,
        handler: "event-pair-orphan-gc",
        handlerConfig: {
          maxAgeMs: 24 * 60 * 60 * 1000,
          batchSize: 10_000,
        },
      }),
    ]);
  });

  it("closes stale pairs without reconstructing message semantics", async () => {
    const root = mkdtempSync(join(tmpdir(), "event-pair-orphan-gc-"));
    try {
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      const cron = createMockCron();
      registerEventPairOrphanGc(cron as any, root, bus);

      const db = getDb(root);
      const openedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const event = db
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES ('message.created', 'legacy', 'agent:dev', ?, ?)`,
        )
        .run(JSON.stringify({ from: "legacy", to: "dev", content: "historical" }), openedAt);
      const openEventId = Number(event.lastInsertRowid);
      db.prepare(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
         VALUES ('owner_inbox', ?, ?, 'agent:dev', 'orphan', ?, ?)`,
      ).run(`event:${openEventId}`, openEventId, openedAt, openedAt + 1);

      const run = cron.getHandler("event-pair-orphan-gc") as (event: unknown, signal: AbortSignal) => Promise<void>;
      await run({}, new AbortController().signal);

      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toEqual({
        status: "closed",
      });
      expect(
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM events
             WHERE event_type IN ('message.resolved', 'owner.inbox.accepted')`,
          )
          .get(),
      ).toEqual({ count: 0 });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not close a recent orphan", async () => {
    const root = mkdtempSync(join(tmpdir(), "event-pair-orphan-gc-recent-"));
    try {
      const db = getDb(root);
      const event = db
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES ('handler.started', 'test', 'agent:may', '{}', ?)`,
        )
        .run(Date.now());
      const openEventId = Number(event.lastInsertRowid);
      db.prepare(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
         VALUES ('handler', 'recent', ?, 'agent:may', 'orphan', ?, ?)`,
      ).run(openEventId, Date.now(), Date.now() - 1);

      const cron = createMockCron();
      registerEventPairOrphanGc(cron as any, root, new EventBus());
      const run = cron.getHandler("event-pair-orphan-gc") as (event: unknown, signal: AbortSignal) => Promise<void>;
      await run({}, new AbortController().signal);

      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toEqual({
        status: "orphan",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});

import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "./connection.js";
import { runDbMaintenancePass } from "./maintenance.js";
import { isApprovalNotificationResolved } from "./notifications.js";

describe("bounded DB maintenance", () => {
  it("keeps WAL checkpoint work on the maintenance path", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-checkpoint-"));
    try {
      const db = getDb(persistDir);
      expect(db.prepare("PRAGMA wal_autocheckpoint").get()).toEqual({ wal_autocheckpoint: 0 });
      db.run(
        `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
         VALUES ('checkpoint-fixture', 'dev', 'task', 'done', 1)`,
      );

      expect(runDbMaintenancePass(persistDir, { now: Date.now(), batchSize: 1 }).checkpoint).toBe("ok");
    } finally {
      closeDb(persistDir);
    }
  });

  it("deletes at most one batch and preserves active sessions", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-"));
    const now = 40 * 86_400_000;
    try {
      const db = getDb(persistDir);
      for (let index = 0; index < 5; index++) {
        db.run(
          `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
           VALUES (?, 'dev', 'task', 'done', 1)`,
          [`old_${index}`],
        );
        mkdirSync(join(persistDir, "sessions", `old_${index}`), { recursive: true });
        writeFileSync(join(persistDir, "sessions", `old_${index}`, "session.jsonl"), "history");
      }
      db.run(
        `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
         VALUES ('active', 'dev', 'task', 'running', 1)`,
      );

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 2 });
      expect(result.deleted.sessions).toBe(2);
      expect(result.deleted.sessionDirectories).toBe(2);
      expect((db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE status = 'done'").get() as any).count).toBe(3);
      expect(db.prepare("SELECT sessionId FROM sessions WHERE sessionId = 'active'").get()).toBeTruthy();
      const remainingDirectories = Array.from({ length: 5 }, (_, index) => `old_${index}`).filter((sessionId) =>
        existsSync(join(persistDir, "sessions", sessionId)),
      );
      expect(remainingDirectories).toHaveLength(3);
    } finally {
      closeDb(persistDir);
    }
  });

  it("preserves old session directories that still have an active marker", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-active-dir-"));
    const now = 40 * 86_400_000;
    try {
      const db = getDb(persistDir);
      db.run(
        `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
         VALUES ('stale-marker', 'dev', 'task', 'done', 1)`,
      );
      const dir = join(persistDir, "sessions", "stale-marker");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "[ACTIVE]"), "active");

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 2 });
      expect(result.deleted.sessions).toBe(0);
      expect(result.deleted.sessionDirectories).toBe(0);
      expect(db.prepare("SELECT sessionId FROM sessions WHERE sessionId = 'stale-marker'").get()).toBeTruthy();
      expect(existsSync(dir)).toBe(true);
    } finally {
      closeDb(persistDir);
    }
  });

  it("retires stale orphans in bounded batches", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-orphans-"));
    const now = 10 * 86_400_000;
    try {
      const db = getDb(persistDir);
      for (let index = 0; index < 5; index++) {
        db.run(
          `INSERT INTO event_pair_runs
             (pair_name, correlation_key, open_event_id, status, opened_at, expected_close_at)
           VALUES ('handler', ?, ?, 'orphan', ?, ?)`,
          [`orphan_${index}`, index + 1, now - 10_000, now - 5 * 60 * 60 * 1000],
        );
      }

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 2 });
      expect(result.deleted.retiredOrphans).toBe(2);
      expect(
        (db.prepare("SELECT COUNT(*) AS count FROM event_pair_runs WHERE closed_at IS NOT NULL").get() as any).count,
      ).toBe(2);
    } finally {
      closeDb(persistDir);
    }
  });

  it("retires old message pairs as generic stale infrastructure", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-messages-"));
    const now = 10 * 86_400_000;
    try {
      const db = getDb(persistDir);
      const event = db
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES ('message.created', 'agent:scout', 'agent:scout', ?, ?)`,
        )
        .run(JSON.stringify({ from: "scout", to: "human", content: "Unfinished request" }), now - 5 * 86_400_000);
      const openEventId = Number(event.lastInsertRowid);
      db.prepare(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
         VALUES ('owner_inbox', ?, ?, 'agent:scout', 'orphan', ?, ?)`,
      ).run(`event:${openEventId}`, openEventId, now - 5 * 86_400_000, now - 5 * 60 * 60_000);

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 100 });

      expect(result.deleted.retiredOrphans).toBe(1);
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toBeNull();
    } finally {
      closeDb(persistDir);
    }
  });

  it("retains handled approval identity after the general event window", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-approval-"));
    const now = 10 * 86_400_000;
    try {
      const db = getDb(persistDir);
      db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES ('project.approval.submitted', 'human', 'project:sample', ?, ?)`,
        [JSON.stringify({ approvalId: "approval:handled", decision: "approve" }), now - 6 * 86_400_000],
      );
      db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES ('old.detail', 'test', 'agent:may', '{}', ?)`,
        [now - 6 * 86_400_000],
      );

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 100 });

      expect(result.deleted.events).toBe(1);
      expect(db.prepare("SELECT 1 FROM events WHERE event_type = 'old.detail'").get()).toBeFalsy();
      expect(isApprovalNotificationResolved(persistDir, { approvalId: "approval:handled" })).toBe(true);
    } finally {
      closeDb(persistDir);
    }
  });
});

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "./connection.js";
import { runDbMaintenancePass } from "./maintenance.js";

describe("bounded DB maintenance", () => {
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
      }
      db.run(
        `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
         VALUES ('active', 'dev', 'task', 'running', 1)`,
      );

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 2 });
      expect(result.deleted.sessions).toBe(2);
      expect((db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE status = 'done'").get() as any).count).toBe(3);
      expect(db.prepare("SELECT sessionId FROM sessions WHERE sessionId = 'active'").get()).toBeTruthy();
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
        (
          db
            .prepare("SELECT COUNT(*) AS count FROM event_pair_runs WHERE closed_at IS NOT NULL")
            .get() as any
        ).count,
      ).toBe(2);
    } finally {
      closeDb(persistDir);
    }
  });
});

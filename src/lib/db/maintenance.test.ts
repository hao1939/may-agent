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
});

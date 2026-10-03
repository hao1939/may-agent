import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db.js";
import { closeDb, getDb } from "./connection.js";
import { applyDbSchema } from "./schema.js";

describe("database connection ownership", () => {
  it("initializes and upgrades a restored backup through the normal Host path", () => {
    const root = mkdtempSync(join(tmpdir(), "may-backup-db-"));
    const backup = openDatabase(join(root, "may.db.backup"));
    try {
      applyDbSchema(backup);
      backup.exec("DROP INDEX idx_ma_one_open_metric");
      backup.run("INSERT INTO sessions (sessionId, agent, task, startedAt) VALUES ('retained-session', 'sample', 'Inspect', 1000)");
      backup.run(`INSERT INTO metric_alerts (metric_id, message, created_at)
        VALUES ('sample.queue', 'first', 1000), ('sample.queue', 'duplicate', 2000)`);
    } finally { backup.close(); }
    try {
      const restored = getDb(root);
      expect(restored.prepare("SELECT sessionId FROM sessions").all()).toEqual([{ sessionId: "retained-session" }]);
      expect(restored.prepare("SELECT id FROM metric_alerts WHERE resolved_at IS NULL").all()).toEqual([{ id: 1 }]);
      expect(restored.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
      expect(restored.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
      expect(restored.prepare("PRAGMA wal_autocheckpoint").get()).toEqual({ wal_autocheckpoint: 0 });
      expect(() => restored.run("INSERT INTO metric_alerts (metric_id) VALUES ('sample.queue')")).toThrow("UNIQUE constraint failed");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not initialize schema from a short-lived Task worker", () => {
    const root = mkdtempSync(join(tmpdir(), "may-worker-db-"));
    try {
      expect(() => getDb(root, { existingSchemaOnly: true })).toThrow("initialized Host database");
      const db = openDatabase(join(root, "may.db"));
      try {
        expect(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'").get()).toEqual({
          count: 0,
        });
      } finally {
        db.close();
      }
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lets a Task worker reuse an initialized Host schema without changing it", () => {
    const root = mkdtempSync(join(tmpdir(), "may-worker-db-"));
    try {
      const host = getDb(root);
      const schemaBefore = host.prepare("SELECT COUNT(*) AS count FROM sqlite_master").get();
      closeDb(root);

      const worker = getDb(root, { existingSchemaOnly: true });
      expect(worker.prepare("SELECT COUNT(*) AS count FROM sqlite_master").get()).toEqual(schemaBefore);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});

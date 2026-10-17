import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnFixtureProcess } from "../../../test/fixtures/owned-process.js";
import { openDatabase } from "../db.js";
import { closeDb, getDb } from "./connection.js";
import { applyDbSchema } from "./schema.js";

describe("database connection ownership", () => {
  it("does not replace a locked database with an older backup", () => {
    const root = mkdtempSync(join(tmpdir(), "may-locked-db-"));
    const path = join(root, "may.db");
    const live = openDatabase(path);
    const backup = openDatabase(`${path}.backup`);
    try {
      for (const db of [live, backup]) applyDbSchema(db);
      live.run("INSERT INTO sessions (sessionId, agent, task, startedAt) VALUES ('current', 'sample', 'Inspect', 2000)");
      backup.run("INSERT INTO sessions (sessionId, agent, task, startedAt) VALUES ('old', 'sample', 'Inspect', 1000)");
      backup.close();
      live.exec("BEGIN EXCLUSIVE");
      const before = readFileSync(path);
      expect(() => getDb(root)).toThrow();
      expect(readFileSync(path).equals(before)).toBe(true);
      live.exec("ROLLBACK");
      expect(live.prepare("SELECT sessionId FROM sessions").all()).toEqual([{ sessionId: "current" }]);
      expect(getDb(root).prepare("SELECT sessionId FROM sessions").all()).toEqual([{ sessionId: "current" }]);
    } finally {
      closeDb(root);
      try { live.exec("ROLLBACK"); } catch { /* No active transaction. */ }
      live.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves a damaged catalog instead of replacing it with readable history", () => {
    const root = mkdtempSync(join(tmpdir(), "may-damaged-db-"));
    const path = join(root, "may.db");
    const live = openDatabase(path);
    const backup = openDatabase(`${path}.backup`);
    try {
      for (const db of [live, backup]) applyDbSchema(db);

    } finally { live.close(); backup.close(); }
    const damaged = readFileSync(path);
    // Page one starts after SQLite's 100-byte header. Invalidate its B-tree
    // page type without changing the header or deleting retained pages.
    damaged[100] = 0;
    writeFileSync(path, damaged);
    const before = readFileSync(path);
    try {
      expect(() => getDb(root)).toThrow();
      expect(readFileSync(path).equals(before)).toBe(true);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(["-wal", "-shm", "-journal"])("preserves orphaned %s recovery evidence without creating a database", (suffix) => {
    const root = mkdtempSync(join(tmpdir(), "may-sidecar-db-"));
    const path = join(root, "may.db");
    writeFileSync(path + suffix, "retained recovery evidence");
    try {
      expect(() => getDb(root)).toThrow("explicit recovery");
      expect(existsSync(path)).toBe(false);
      expect(readFileSync(path + suffix, "utf8")).toBe("retained recovery evidence");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps newer committed WAL data when an older backup exists", () => {
    const root = mkdtempSync(join(tmpdir(), "may-wal-db-"));
    const path = join(root, "may.db");
    const live = openDatabase(path);
    const backup = openDatabase(`${path}.backup`);
    try {
      applyDbSchema(backup);
      backup.close();
      live.exec("PRAGMA journal_mode = WAL");
      live.exec("PRAGMA wal_autocheckpoint = 0");
      applyDbSchema(live);
      live.run("INSERT INTO sessions (sessionId, agent, task, startedAt) VALUES ('new', 'sample', 'Inspect', 2000)");
      expect(existsSync(path + "-wal")).toBe(true);
      expect(getDb(root).prepare("SELECT sessionId FROM sessions").all()).toEqual([{ sessionId: "new" }]);
    } finally {
      closeDb(root);
      live.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not bootstrap a backup that still has a recovery journal", () => {
    const root = mkdtempSync(join(tmpdir(), "may-backup-journal-"));
    const path = join(root, "may.db");
    writeFileSync(path + ".backup", "retained backup");
    writeFileSync(path + ".backup-journal", "retained journal");
    try {
      expect(() => getDb(root)).toThrow("explicit recovery");
      expect(existsSync(path)).toBe(false);
      expect(readFileSync(path + ".backup", "utf8")).toBe("retained backup");
      expect(readFileSync(path + ".backup-journal", "utf8")).toBe("retained journal");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lets concurrent Host openers bootstrap once and keep each other's writes", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-bootstrap-db-"));
    const backup = openDatabase(join(root, "may.db.backup"));
    try {
      applyDbSchema(backup);
      backup.run("INSERT INTO sessions (sessionId, agent, task, startedAt) VALUES ('retained', 'sample', 'Inspect', 1000)");
    } finally { backup.close(); }
    const fixture = fileURLToPath(new URL("../../../test/fixtures/database-opener.ts", import.meta.url));
    const children = ["first", "second", "third"].map((id) => spawnFixtureProcess([fixture, root, id]));
    try {
      await Promise.all(children.map((child) => new Promise<void>((resolve, reject) => {
        let stderr = "";
        child.stdout.resume();
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        const timeout = setTimeout(() => { child.kill("SIGKILL"); }, 10_000);
        child.once("error", (error) => { clearTimeout(timeout); reject(error); });
        child.once("exit", (code) => {
          clearTimeout(timeout);
          if (code === 0) resolve();
          else reject(new Error(`Database opener exited ${code}: ${stderr}`));
        });
      })));
      expect(getDb(root).prepare("SELECT sessionId FROM sessions ORDER BY sessionId").all()).toEqual(
        ["first", "retained", "second", "third"].map((sessionId) => ({ sessionId })),
      );
      expect(readdirSync(root).some((name) => name.startsWith(".may-db-bootstrap-"))).toBe(false);
    } finally {
      for (const child of children) { child.stdin.end(); child.kill("SIGKILL"); }
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  }, 15_000);

  it("does not import old work into an existing empty database", () => {
    const root = mkdtempSync(join(tmpdir(), "may-empty-db-"));
    const backup = openDatabase(join(root, "may.db.backup"));
    try {
      applyDbSchema(backup);
      backup.run("INSERT INTO sessions (sessionId, agent, task, startedAt) VALUES ('old', 'sample', 'Inspect', 1000)");
    } finally { backup.close(); }
    writeFileSync(join(root, "may.db"), "");
    try {
      expect(getDb(root).prepare("SELECT sessionId FROM sessions").all()).toEqual([]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

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

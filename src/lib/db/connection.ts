import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../db.js";
import { withSqliteBusyRetry } from "./busy-retry.js";
import { applyDbSchema } from "./schema.js";

const dbCache = new Map<string, SqliteDb>();

export type DatabaseConnectionOptions = {
  /** Open the Host-owned schema without trying to create or upgrade it. */
  existingSchemaOnly?: boolean;
};

/**
 * Get or create a SQLite database for request tracking.
 * Uses WAL mode for concurrent read safety and busy_timeout for write contention.
 */
export function getDb(persistDir: string, options: DatabaseConnectionOptions = {}): SqliteDb {
  const cached = dbCache.get(persistDir);
  if (cached) return cached;

  mkdirSync(persistDir, { recursive: true });

  const dbPath = join(persistDir, "may.db");
  let db = openDatabase(dbPath);
  const existingSchemaOnly = options.existingSchemaOnly ?? process.env.MAY_TASK_ATTEMPT_CHILD === "1";

  // A Task worker is a short-lived user of the live Host database. Reapplying
  // every CREATE TABLE/INDEX statement for every attempt takes SQLite's one
  // write lock and can starve the interface even though the schema is already
  // current. The Host owns schema initialization; workers only verify it.
  if (existingSchemaOnly) {
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA wal_autocheckpoint = 0");
    const required = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('events', 'app_tasks')")
      .all() as Array<{ name?: string }>;
    if (new Set(required.map(({ name }) => name)).size !== 2) {
      db.close();
      throw new Error("Task worker requires an initialized Host database");
    }
    dbCache.set(persistDir, db);
    return db;
  }

  // Restore only when SQLite cannot read its catalog or the database is empty.
  // A full PRAGMA integrity_check walks retained history and made every daemon,
  // web, and maintenance start proportional to database size. Deep integrity
  // checking belongs to an explicit maintenance operation; normal schema
  // access still fails closed if corruption affects tables the process uses.
  try {
    const backupPath = dbPath + ".backup";
    let needsRestore = false;
    try {
      const tables = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").get() as any;
      if (tables?.c === 0) needsRestore = true;
    } catch {
      needsRestore = true;
    }
    if (needsRestore) {
      const { existsSync, copyFileSync } = require("node:fs");
      if (existsSync(backupPath)) {
        db.close();
        copyFileSync(backupPath, dbPath);
        const restored = openDatabase(dbPath);
        const check = restored.prepare("SELECT COUNT(*) as c FROM sessions").get() as any;
        if (check?.c > 0) {
          console.log(`[db] Restored from backup (${check.c} sessions)`);
          dbCache.set(persistDir, restored);
          return restored;
        }
        restored.close();
        db = openDatabase(dbPath);
      }
    }
  } catch {
    /* best-effort restore */
  }

  db.exec("PRAGMA journal_mode = WAL");
  // Task workers may wait without affecting an interface. The daemon fails a
  // contended turn quickly so commands and other sockets keep being served;
  // durable event/task identities provide the retry boundary.
  db.exec("PRAGMA busy_timeout = 50");
  db.exec("PRAGMA foreign_keys = ON");
  // Checkpointing belongs to the dedicated maintenance process. SQLite's
  // default per-connection auto-checkpoint can otherwise run a multi-page
  // checkpoint on the daemon's synchronous event-persistence commit path.
  db.exec("PRAGMA wal_autocheckpoint = 0");
  // The daemon, web, and maintenance processes start together. One may be
  // applying a legitimate schema upgrade while another reaches this point;
  // wait for that bounded writer instead of making Supervisor restart a
  // healthy process generation.
  withSqliteBusyRetry("apply database schema", () => applyDbSchema(db));

  dbCache.set(persistDir, db);
  return db;
}

/** Close and remove cached database (for testing cleanup). */
export function closeDb(persistDir: string): void {
  const cached = dbCache.get(persistDir);
  if (cached) {
    cached.close();
    dbCache.delete(persistDir);
  }
}

/** Close cached connections after a non-blocking checkpoint. Call on shutdown. */
export function closeAllDbs(): void {
  for (const [dir, db] of dbCache) {
    try { db.exec("PRAGMA wal_checkpoint(PASSIVE)"); } catch { /* best-effort */ }
    try { db.close(); } catch { /* best-effort */ }
    dbCache.delete(dir);
  }
}

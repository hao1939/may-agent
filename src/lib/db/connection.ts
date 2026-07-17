import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../db.js";
import { applyDbSchema } from "./schema.js";

const dbCache = new Map<string, SqliteDb>();

/**
 * Get or create a SQLite database for request tracking.
 * Uses WAL mode for concurrent read safety and busy_timeout for write contention.
 */
export function getDb(persistDir: string): SqliteDb {
  const cached = dbCache.get(persistDir);
  if (cached) return cached;

  mkdirSync(persistDir, { recursive: true });

  const dbPath = join(persistDir, "may.db");
  let db = openDatabase(dbPath);

  // Auto-restore from backup if DB is empty or corrupt.
  try {
    const backupPath = dbPath + ".backup";
    let needsRestore = false;
    try {
      const check = db.prepare("PRAGMA integrity_check(1)").get() as any;
      if (check?.integrity_check !== "ok") needsRestore = true;
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
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  applyDbSchema(db);

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

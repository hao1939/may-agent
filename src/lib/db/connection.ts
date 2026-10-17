import { isTaskWorkerProcess } from "../task-worker-context.js";
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDatabase, type SqliteDb } from "../db.js";
import { withSqliteInitializationRetry } from "./busy-retry.js";
import { applyDbSchema } from "./schema.js";

const dbCache = new Map<string, SqliteDb>();

export type DatabaseConnectionOptions = {
  /** Require an existing Host database; do not create its file or upgrade its schema. */
  existingSchemaOnly?: boolean;
};

/**
 * Get or create the shared Host SQLite database.
 * Uses WAL mode for concurrent read safety and busy_timeout for write contention.
 */
export function getDb(persistDir: string, options: DatabaseConnectionOptions = {}): SqliteDb {
  const cached = dbCache.get(persistDir);
  if (cached) return cached;

  mkdirSync(persistDir, { recursive: true });

  const dbPath = join(persistDir, "may.db");
  const existingSchemaOnly = options.existingSchemaOnly ?? isTaskWorkerProcess();
  if (existingSchemaOnly && !existsSync(dbPath)) {
    throw new Error("Schema-only connection requires an initialized Host database");
  }
  if (!existingSchemaOnly) bootstrapMissingDatabase(dbPath);
  const db = openDatabase(dbPath);
  try {
    // Maintenance and Task workers use the live Host database. Reapplying
    // CREATE TABLE/INDEX would compete for SQLite's one write lock even when
    // the schema is current. These consumers only verify the Host-owned schema.
    if (existingSchemaOnly) {
      db.exec("PRAGMA busy_timeout = 5000");
      db.exec("PRAGMA foreign_keys = ON");
      db.exec("PRAGMA wal_autocheckpoint = 0");
      const required = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('events', 'app_tasks')")
        .all() as Array<{ name?: string }>;
      if (new Set(required.map(({ name }) => name)).size !== 2) {
        throw new Error("Schema-only connection requires an initialized Host database");
      }
      dbCache.set(persistDir, db);
      return db;
    }

    // Serving calls fail quickly; repeatable startup uses one bounded retry
    // allowance, including WAL setup when other Host processes open together.
    db.exec("PRAGMA busy_timeout = 50");
    withSqliteInitializationRetry("initialize database", () => {
      db.exec("PRAGMA journal_mode = WAL");
      db.exec("PRAGMA foreign_keys = ON");
      // The dedicated maintenance process owns checkpointing.
      db.exec("PRAGMA wal_autocheckpoint = 0");
      applyDbSchema(db);
    });

    dbCache.set(persistDir, db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function hasSqliteSidecars(path: string): boolean {
  return ["-wal", "-shm", "-journal"].some((suffix) => existsSync(path + suffix));
}

/** Recheck after observing sidecars: another opener may have published the main file. */
function needsDatabaseBootstrap(dbPath: string): boolean {
  if (existsSync(dbPath)) return false;
  if (!hasSqliteSidecars(dbPath)) return true;
  if (existsSync(dbPath)) return false;
  throw new Error("Database is missing but SQLite recovery files remain; explicit recovery is required");
}

/** Only bootstrap an absent database; opening existing state never restores it. */
function bootstrapMissingDatabase(dbPath: string): void {
  if (!needsDatabaseBootstrap(dbPath)) return;
  const backupPath = dbPath + ".backup";
  if (!existsSync(backupPath)) return;
  if (hasSqliteSidecars(backupPath)) throw new Error("Database backup has SQLite recovery files; explicit recovery is required");

  // Publish a complete file without replacing another opener's database.
  // An exclusive copy directly to dbPath would expose partially copied bytes.
  const stage = mkdtempSync(join(dirname(dbPath), ".may-db-bootstrap-"));
  try {
    const candidate = join(stage, "may.db");
    copyFileSync(backupPath, candidate);
    if (!needsDatabaseBootstrap(dbPath)) return;
    try {
      linkSync(candidate, dbPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
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

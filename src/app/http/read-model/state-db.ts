/**
 * Small cached SQLite adapter for WebUI state access.
 *
 * The WebUI remains independent from live runtime objects, while database
 * opening and migrations stay owned by the shared storage layer.
 */

import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";

export type { RunResult, SqliteDb, Statement } from "../../../lib/db.js";

const dbCache = new Map<string, SqliteDb>();

export function openStateDb(path: string): SqliteDb {
  const cached = dbCache.get(path);
  if (cached) return cached;

  const db = openDatabase(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  applyDbSchema(db);

  const cachedDb: SqliteDb = {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    run: (sql, params) => db.run(sql, params),
    close() {
      db.close();
      dbCache.delete(path);
    },
  };
  dbCache.set(path, cachedDb);
  return cachedDb;
}

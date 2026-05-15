/**
 * Small SQLite adapter for WebUI state access.
 *
 * The WebUI package is intentionally independent from the daemon runtime. It
 * reads and updates the existing state DB directly, but it should not import
 * SubagentManager, agent loading, timers, or other live-runtime modules.
 */

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  get(...params: unknown[]): Record<string, unknown> | null;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): RunResult;
}

export interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  run(sql: string, params?: unknown[]): RunResult;
  close(): void;
}

const dbCache = new Map<string, SqliteDb>();

interface BunDatabase {
  exec(sql: string): void;
  query(sql: string): {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => unknown;
  };
  run(sql: string, params: unknown[]): RunResult;
  close(): void;
}

export function openStateDb(path: string): SqliteDb {
  const cached = dbCache.get(path);
  if (cached) return cached;
  const { Database } = require("bun:sqlite") as { Database: new (path: string) => BunDatabase };
  const db = new Database(path);
  const wrapped = {
    exec(sql: string) {
      db.exec(sql);
    },
    prepare(sql: string): Statement {
      const stmt = db.query(sql);
      return {
        get(...params: unknown[]) {
          return (stmt.get as (...args: unknown[]) => Record<string, unknown> | null)(...params);
        },
        all(...params: unknown[]) {
          return (stmt.all as (...args: unknown[]) => Record<string, unknown>[])(...params);
        },
        run(...params: unknown[]) {
          return (stmt.run as (...args: unknown[]) => RunResult)(...params);
        },
      };
    },
    run(sql: string, params?: unknown[]) {
      return db.run(sql, params ?? []);
    },
    close() {
      db.close();
      dbCache.delete(path);
    },
  };
  dbCache.set(path, wrapped);
  return wrapped;
}

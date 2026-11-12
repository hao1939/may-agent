/**
 * db.ts — Unified SQLite adapter for bun:sqlite and node:sqlite.
 *
 * Bun uses `bun:sqlite` (Database, db.query() for prepared statements).
 * Node 22+ uses `node:sqlite` (DatabaseSync, db.prepare() for prepared statements).
 * This module detects the runtime and provides a unified interface.
 */

import { profileDatabase } from "./db/query-performance.js";

// ── Unified types ──────────────────────────────────────────────────────

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  get(...params: unknown[]): Record<string, unknown> | null;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): RunResult;
  /** Release a statement explicitly on runtimes that expose this operation. */
  finalize?(): void;
}

export interface SqliteDb {
  exec(sql: string): void;
  /** One-shot diagnostic statements must opt out of the shared query cache. */
  prepare(sql: string, options?: { cache?: boolean }): Statement;
  /** Shorthand: prepare + run (for INSERT/UPDATE/DELETE with params). */
  run(sql: string, params?: unknown[]): RunResult;
  close(): void;
}

// ── Runtime detection ──────────────────────────────────────────────────

type Runtime = "bun" | "node";

function detectRuntime(): Runtime {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") return "bun";
  return "node";
}

// ── Bun adapter ────────────────────────────────────────────────────────

function openBun(
  path: string,
  mode: "readwrite-create" | "readonly" | "query-only" = "readwrite-create",
): SqliteDb {
  const { Database, constants } = require("bun:sqlite") as {
    Database: new (path: string, options?: number | { readonly?: boolean; create?: boolean }) => BunDatabase;
    constants: { SQLITE_OPEN_READONLY: number; SQLITE_OPEN_READWRITE: number; SQLITE_OPEN_URI: number };
  };
  const openOpts =
    mode === "readonly"
      ? path.startsWith("file:")
        ? constants.SQLITE_OPEN_READONLY | constants.SQLITE_OPEN_URI
        : { readonly: true, create: false }
      : mode === "query-only"
        ? constants.SQLITE_OPEN_READWRITE
        : undefined;
  const db = new Database(path, openOpts);
  if (mode === "query-only") {
    try {
      db.exec("PRAGMA query_only = ON; PRAGMA busy_timeout = 5000; PRAGMA wal_autocheckpoint = 0;");
    } catch (err) {
      db.close();
      throw err;
    }
  }
  return {
    exec(sql: string) {
      db.exec(sql);
    },
    prepare(sql: string, options?: { cache?: boolean }): Statement {
      const stmt = options?.cache === false ? db.prepare(sql) : db.query(sql);
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
        finalize() {
          stmt.finalize();
        },
      };
    },
    run(sql: string, params?: unknown[]) {
      return db.run(sql, params ?? []) as RunResult;
    },
    close() {
      db.close();
    },
  };
}

interface BunDatabase {
  exec(sql: string): void;
  prepare(sql: string): ReturnType<BunDatabase["query"]>;
  query(sql: string): {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => unknown;
    finalize(): void;
  };
  run(sql: string, params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  close(): void;
}

// ── Node adapter ───────────────────────────────────────────────────────

function openNode(
  path: string,
  mode: "readwrite-create" | "readonly" | "query-only" = "readwrite-create",
): SqliteDb {
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => NodeDatabase;
  };
  const db = new DatabaseSync(path, mode === "readonly" ? { readOnly: true } : undefined);
  if (mode === "query-only") {
    try {
      db.exec("PRAGMA query_only = ON; PRAGMA busy_timeout = 5000; PRAGMA wal_autocheckpoint = 0;");
    } catch (err) {
      db.close();
      throw err;
    }
  }
  return {
    exec(sql: string) {
      db.exec(sql);
    },
    prepare(sql: string): Statement {
      const stmt = db.prepare(sql);
      return {
        // node:sqlite returns undefined for missing rows; normalize to null
        get(...params: unknown[]) {
          return (stmt.get as (...args: unknown[]) => Record<string, unknown> | undefined)(...params) ?? null;
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
      const stmt = db.prepare(sql);
      return (stmt.run as (...args: unknown[]) => RunResult)(...(params ?? []));
    },
    close() {
      db.close();
    },
  };
}

interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => unknown;
  };
  close(): void;
}

// ── Public API ─────────────────────────────────────────────────────────

const runtime = detectRuntime();

export function openDatabase(path: string): SqliteDb {
  return profileDatabase(runtime === "bun" ? openBun(path) : openNode(path));
}

/** Open an existing database without creation or write capability. */
export function openReadOnlyDatabase(path: string): SqliteDb {
  return profileDatabase(runtime === "bun" ? openBun(path, "readonly") : openNode(path, "readonly"));
}

/**
 * Open an existing database with full SQLite WAL read-mark locking (`O_RDWR` +
 * `PRAGMA query_only = ON`) so concurrent checkpoints cannot tear pages AND
 * closing the last connection can acquire `F_WRLCK` to unlink transient `-wal`/`-shm`
 * sidecars instead of stranding them in `persistDir`.
 */
export function openQueryOnlyDatabase(path: string): SqliteDb {
  return profileDatabase(runtime === "bun" ? openBun(path, "query-only") : openNode(path, "query-only"));
}

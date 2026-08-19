/**
 * db.ts — Unified SQLite adapter for bun:sqlite and node:sqlite.
 *
 * Bun uses `bun:sqlite` (Database, db.query() for prepared statements).
 * Node 22+ uses `node:sqlite` (DatabaseSync, db.prepare() for prepared statements).
 * This module detects the runtime and provides a unified interface.
 */

// ── Unified types ──────────────────────────────────────────────────────

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

function openBun(path: string, readonly = false): SqliteDb {
  const { Database } = require("bun:sqlite") as {
    Database: new (path: string, options?: { readonly?: boolean; create?: boolean }) => BunDatabase;
  };
  const db = new Database(path, readonly ? { readonly: true, create: false } : undefined);
  return {
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
      return db.run(sql, params ?? []) as RunResult;
    },
    close() {
      db.close();
    },
  };
}

interface BunDatabase {
  exec(sql: string): void;
  query(sql: string): {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => unknown;
  };
  run(sql: string, params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  close(): void;
}

// ── Node adapter ───────────────────────────────────────────────────────

function openNode(path: string, readonly = false): SqliteDb {
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => NodeDatabase;
  };
  const db = new DatabaseSync(path, readonly ? { readOnly: true } : undefined);
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
  return runtime === "bun" ? openBun(path) : openNode(path);
}

/** Open an existing database without creation or write capability. */
export function openReadOnlyDatabase(path: string): SqliteDb {
  return runtime === "bun" ? openBun(path, true) : openNode(path, true);
}

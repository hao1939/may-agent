/**
 * Small SQLite adapter for WebUI state access.
 *
 * The WebUI package is intentionally independent from the daemon runtime. It
 * reads and updates the existing state DB directly, but it should not import
 * SubagentManager, agent loading, timers, or other live-runtime modules.
 */

import { DEFAULT_OWNER_DELIVERY_NOTE } from "../../../lib/event-delivery.js";

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

function applyReadModelMigrations(db: SqliteDb): void {
  const migrationStartedAt = Date.now();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS runtime_migrations (
        key        TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);
  } catch {
    /* best-effort compatibility migration */
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS event_pair_runs (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        pair_name          TEXT NOT NULL,
        correlation_key    TEXT NOT NULL,
        open_event_id      INTEGER NOT NULL,
        close_event_id     INTEGER,
        owner              TEXT,
        status             TEXT DEFAULT 'open',
        opened_at          INTEGER NOT NULL,
        expected_close_at  INTEGER NOT NULL,
        closed_at          INTEGER,
        note               TEXT
      );
    `);
  } catch {
    /* best-effort compatibility migration */
  }

  const eventCols = [
    "status",
    "handled_by",
    "result",
    "reason",
    "retry_count",
    "ttl_ms",
    "urgency",
    "delivery_status",
    "accepted_by",
    "accepted_at",
    "delivery_route",
    "delivery_note",
  ];
  for (const col of eventCols) {
    try {
      const defaultVal =
        col === "status" || col === "delivery_status"
          ? " DEFAULT 'pending'"
          : col === "retry_count"
            ? " DEFAULT 0"
            : col === "urgency"
              ? " DEFAULT 'normal'"
              : "";
      const colType = col === "retry_count" || col === "ttl_ms" || col === "accepted_at" ? "INTEGER" : "TEXT";
      db.exec(`ALTER TABLE events ADD COLUMN ${col} ${colType}${defaultVal}`);
    } catch {
      /* already exists or events table unavailable */
    }
  }

  try {
    db.exec("DROP INDEX IF EXISTS idx_event_pair_open_event");
    db.exec("CREATE INDEX IF NOT EXISTS idx_event_pair_open_event ON event_pair_runs(open_event_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_event_pair_status ON event_pair_runs(status, expected_close_at)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_inbox ON events(owner, status, timestamp)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_delivery ON events(delivery_status, delivery_route, timestamp)");
  } catch {
    /* best-effort compatibility migration */
  }
  try {
    const marker = db.prepare("SELECT key FROM runtime_migrations WHERE key = ?").get("event_delivery_legacy_baseline");
    if (!marker) {
      db.run(
        `UPDATE events
         SET delivery_status = 'accepted',
             accepted_by = 'legacy:event-store',
             accepted_at = timestamp,
             delivery_route = 'noop',
             delivery_note = 'pre-delivery-tracking event baseline'
         WHERE delivery_status = 'pending'
           AND accepted_by IS NULL
           AND delivery_route IS NULL
           AND delivery_note IS NULL
           AND timestamp < ?`,
        [migrationStartedAt],
      );
      db.run("INSERT INTO runtime_migrations (key, applied_at) VALUES (?, ?)", [
        "event_delivery_legacy_baseline",
        migrationStartedAt,
      ]);
    }
  } catch {
    /* best-effort legacy baseline */
  }
  try {
    const marker = db.prepare("SELECT key FROM runtime_migrations WHERE key = ?").get("event_delivery_default_owner_baseline");
    if (!marker) {
      const migrationStartedAt = Date.now();
      db.run(
        `UPDATE events
         SET delivery_status = 'accepted',
             accepted_by = 'default-owner:' || owner,
             accepted_at = timestamp,
             delivery_route = 'direct',
             delivery_note = ?
         WHERE delivery_status IN ('pending', 'unhandled')
           AND owner IS NOT NULL
           AND trim(owner) != ''
           AND timestamp < ?`,
        [DEFAULT_OWNER_DELIVERY_NOTE, migrationStartedAt],
      );
      db.run("INSERT INTO runtime_migrations (key, applied_at) VALUES (?, ?)", [
        "event_delivery_default_owner_baseline",
        migrationStartedAt,
      ]);
    }
  } catch {
    /* best-effort default owner baseline */
  }
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
  applyReadModelMigrations(wrapped);
  dbCache.set(path, wrapped);
  return wrapped;
}

/**
 * requests.ts — Unified Request Tracking (SQLite)
 *
 * Replaces 4 JSONL tracking files (orders.jsonl, delegations.jsonl,
 * session-outcomes.jsonl, recovery.jsonl) with one SQLite database.
 *
 * Design: docs/design/request-tracking.md
 * Plan: agents/tech-lead/workspace/plan-request-tracking.md
 */

import type { Database } from "bun:sqlite";
import { join } from "node:path";
import { mkdirSync, existsSync, renameSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Lazy-load bun:sqlite to avoid breaking vitest (which runs under Node.js)
let _DatabaseClass: typeof import("bun:sqlite").Database | null = null;
function getDatabaseClass(): typeof import("bun:sqlite").Database {
  if (!_DatabaseClass) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _DatabaseClass = require("bun:sqlite").Database;
  }
  return _DatabaseClass!;
}

// ── Types ──────────────────────────────────────────────────────────────

export type RequestStatus =
  | "CREATED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED";

export type RequestMethod = "chat" | "call" | "send" | "workflow";

// ErrorClass and classifyError are now in classify-error.ts (pure, no bun:sqlite deps)
export type { ErrorClass } from "./classify-error.js";
import type { ErrorClass } from "./classify-error.js";

export interface TrackRequestOpts {
  fromEntity: string;
  toAgent: string;
  task: string;
  method: RequestMethod;
  sessionId?: string;
  parentRequestId?: string;
  artifact?: string;
  context?: string;
  expectations?: string;
  notify?: string[];
}

export interface UpdateRequestOpts {
  status?: RequestStatus;
  sessionId?: string;
  summary?: string;
  error?: string;
  errorClass?: ErrorClass;
  durationMs?: number;
  completedAt?: number;
}

export interface RequestRecord {
  requestId: string;
  parentRequestId: string | null;
  fromEntity: string;
  toAgent: string;
  method: RequestMethod;
  task: string;
  status: RequestStatus;
  sessionId: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  summary: string | null;
  error: string | null;
  errorClass: ErrorClass | null;
  retryable: number | null;
  artifact: string | null;
  context: string | null;
  expectations: string | null;
  notify: string | null; // JSON array
}

// ── Schema ─────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS requests (
  requestId       TEXT PRIMARY KEY,
  parentRequestId TEXT,
  fromEntity      TEXT NOT NULL,
  toAgent         TEXT NOT NULL,
  method          TEXT NOT NULL,
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'CREATED',
  sessionId       TEXT,
  createdAt       INTEGER NOT NULL,
  updatedAt       INTEGER NOT NULL,
  completedAt     INTEGER,
  durationMs      INTEGER,
  summary         TEXT,
  error           TEXT,
  errorClass      TEXT,
  retryable       INTEGER,
  artifact        TEXT,
  context         TEXT,
  expectations    TEXT,
  notify          TEXT
);

CREATE INDEX IF NOT EXISTS idx_status    ON requests(status);
CREATE INDEX IF NOT EXISTS idx_to_agent  ON requests(toAgent);
CREATE INDEX IF NOT EXISTS idx_parent    ON requests(parentRequestId);
CREATE INDEX IF NOT EXISTS idx_created   ON requests(createdAt);

-- Convention checks (P1: mechanical compliance checker)
CREATE TABLE IF NOT EXISTS convention_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  convention TEXT NOT NULL,
  passed INTEGER NOT NULL,
  violations TEXT,
  checked_at INTEGER NOT NULL,
  UNIQUE(session_id, convention)
);

CREATE TABLE IF NOT EXISTS convention_maturity (
  convention TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'active',
  level_since INTEGER,
  last_regression INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cc_agent ON convention_checks(agent, convention, checked_at);
CREATE INDEX IF NOT EXISTS idx_cc_conv  ON convention_checks(convention, checked_at);
`;

// ── Database Management ────────────────────────────────────────────────

const dbCache = new Map<string, Database>();

/**
 * Get or create a SQLite database for request tracking.
 * Uses WAL mode for concurrent read safety and busy_timeout for write contention.
 */
export function getDb(persistDir: string): Database {
  const cached = dbCache.get(persistDir);
  if (cached) return cached;

  mkdirSync(persistDir, { recursive: true });

  // Auto-migrate: rename requests.db → may.db on first access
  const oldPath = join(persistDir, "requests.db");
  const dbPath = join(persistDir, "may.db");
  if (existsSync(oldPath) && !existsSync(dbPath)) {
    renameSync(oldPath, dbPath);
    // Also migrate WAL/SHM files if they exist
    const oldWal = oldPath + "-wal";
    const oldShm = oldPath + "-shm";
    if (existsSync(oldWal)) renameSync(oldWal, dbPath + "-wal");
    if (existsSync(oldShm)) renameSync(oldShm, dbPath + "-shm");
  }

  const db = new (getDatabaseClass())(dbPath);

  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);

  dbCache.set(persistDir, db);
  return db;
}

/**
 * Close and remove cached database (for testing cleanup).
 */
export function closeDb(persistDir: string): void {
  const cached = dbCache.get(persistDir);
  if (cached) {
    cached.close();
    dbCache.delete(persistDir);
  }
}

// ── Core Operations ────────────────────────────────────────────────────

/**
 * Track a new request. Returns the generated requestId.
 */
export function trackRequest(
  persistDir: string,
  opts: TrackRequestOpts
): string {
  const db = getDb(persistDir);
  const requestId = randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO requests (
      requestId, parentRequestId, fromEntity, toAgent, method, task,
      status, sessionId, createdAt, updatedAt,
      artifact, context, expectations, notify
    ) VALUES (?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?, ?, ?, ?, ?)`,
    [
      requestId,
      opts.parentRequestId ?? null,
      opts.fromEntity,
      opts.toAgent,
      opts.method,
      opts.task.slice(0, 500),
      opts.sessionId ?? null,
      now,
      now,
      opts.artifact ?? null,
      opts.context ?? null,
      opts.expectations ?? null,
      opts.notify ? JSON.stringify(opts.notify) : null,
    ]
  );

  return requestId;
}

/**
 * Update an existing request's status and metadata.
 */
export function updateRequest(
  persistDir: string,
  requestId: string,
  update: UpdateRequestOpts
): void {
  const db = getDb(persistDir);
  const sets: string[] = ["updatedAt = ?"];
  const values: unknown[] = [Date.now()];

  if (update.status !== undefined) {
    sets.push("status = ?");
    values.push(update.status);
  }
  if (update.sessionId !== undefined) {
    sets.push("sessionId = ?");
    values.push(update.sessionId);
  }
  if (update.summary !== undefined) {
    sets.push("summary = ?");
    values.push(update.summary);
  }
  if (update.error !== undefined) {
    sets.push("error = ?");
    values.push(update.error);
  }
  if (update.errorClass !== undefined) {
    sets.push("errorClass = ?");
    values.push(update.errorClass);
    sets.push("retryable = ?");
    values.push(update.errorClass === "infra" ? 1 : 0);
  }
  if (update.durationMs !== undefined) {
    sets.push("durationMs = ?");
    values.push(update.durationMs);
  }
  if (update.completedAt !== undefined) {
    sets.push("completedAt = ?");
    values.push(update.completedAt);
  }

  values.push(requestId);
  db.run(
    `UPDATE requests SET ${sets.join(", ")} WHERE requestId = ?`,
    values
  );
}

/**
 * Get a single request by ID.
 */
export function getRequest(
  persistDir: string,
  requestId: string
): RequestRecord | null {
  const db = getDb(persistDir);
  return (
    (db
      .query("SELECT * FROM requests WHERE requestId = ?")
      .get(requestId) as RequestRecord | null) ?? null
  );
}

/**
 * Get all active (non-terminal) requests.
 */
export function getActiveRequests(persistDir: string): RequestRecord[] {
  const db = getDb(persistDir);
  return db
    .query(
      "SELECT * FROM requests WHERE status IN ('CREATED', 'IN_PROGRESS') ORDER BY createdAt ASC"
    )
    .all() as RequestRecord[];
}

/**
 * Get all requests targeting a specific agent.
 */
export function getRequestsByAgent(
  persistDir: string,
  agent: string
): RequestRecord[] {
  const db = getDb(persistDir);
  return db
    .query("SELECT * FROM requests WHERE toAgent = ? ORDER BY createdAt DESC")
    .all(agent) as RequestRecord[];
}

/**
 * Get request tree using recursive CTE.
 * Returns the root request and all its descendants.
 */
export function getRequestTree(
  persistDir: string,
  requestId: string
): RequestRecord[] {
  const db = getDb(persistDir);
  return db
    .query(
      `WITH RECURSIVE tree AS (
        SELECT * FROM requests WHERE requestId = ?
        UNION ALL
        SELECT r.* FROM requests r
        JOIN tree t ON r.parentRequestId = t.requestId
      )
      SELECT * FROM tree ORDER BY createdAt ASC`
    )
    .all(requestId) as RequestRecord[];
}

/**
 * Find stale requests: CREATED or IN_PROGRESS older than maxAgeMs.
 */
export function getStaleRequests(
  persistDir: string,
  maxAgeMs: number
): RequestRecord[] {
  const db = getDb(persistDir);
  const cutoff = Date.now() - maxAgeMs;
  return db
    .query(
      `SELECT * FROM requests
       WHERE status IN ('CREATED', 'IN_PROGRESS')
       AND createdAt < ?
       ORDER BY createdAt ASC`
    )
    .all(cutoff) as RequestRecord[];
}

/**
 * Check if a duplicate request exists (same from, to, task hash).
 * Used by send() to prevent duplicate handoffs/sends.
 */
export function isDuplicate(
  persistDir: string,
  fromEntity: string,
  toAgent: string,
  taskHash: string
): boolean {
  const db = getDb(persistDir);
  // Check for active (non-terminal) duplicates only
  const row = db
    .query(
      `SELECT 1 FROM requests
       WHERE fromEntity = ? AND toAgent = ?
       AND task = ? AND status IN ('CREATED', 'IN_PROGRESS')
       LIMIT 1`
    )
    .get(fromEntity, toAgent, taskHash);
  return row !== null;
}

/**
 * Archive old completed/failed requests.
 * Returns the number of rows deleted.
 */
export function archiveOld(
  persistDir: string,
  maxAgeDays: number
): number {
  const db = getDb(persistDir);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const result = db.run(
    `DELETE FROM requests
     WHERE status IN ('COMPLETED', 'FAILED', 'BLOCKED')
     AND completedAt IS NOT NULL
     AND completedAt < ?`,
    [cutoff]
  );
  return result.changes;
}

// ── Error Classification ───────────────────────────────────────────────

// classifyError moved to classify-error.ts — re-export for backward compat
export { classifyError } from "./classify-error.js";

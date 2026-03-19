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

-- Evaluations (migrated from .state/evaluations/*.json files)
CREATE TABLE IF NOT EXISTS evaluations (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  quality         REAL NOT NULL DEFAULT 0,
  efficiency      REAL NOT NULL DEFAULT 0,
  productiveCalls INTEGER NOT NULL DEFAULT 0,
  wastedCalls     INTEGER NOT NULL DEFAULT 0,
  verdict         TEXT NOT NULL DEFAULT 'needs_improvement',
  issues          TEXT,           -- JSON array
  overall         TEXT,           -- JSON object
  usage           TEXT,           -- JSON object {inputTokens, outputTokens, cost, turns, ...}
  failureChains   TEXT,           -- JSON array
  evaluatedByHeuristic INTEGER NOT NULL DEFAULT 0,
  skippedByJs     INTEGER NOT NULL DEFAULT 0,
  createdAt       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cc_agent ON convention_checks(agent, convention, checked_at);
CREATE INDEX IF NOT EXISTS idx_cc_conv  ON convention_checks(convention, checked_at);
CREATE INDEX IF NOT EXISTS idx_eval_agent_ts  ON evaluations(agent, createdAt);
CREATE INDEX IF NOT EXISTS idx_eval_verdict   ON evaluations(verdict);
CREATE INDEX IF NOT EXISTS idx_eval_created   ON evaluations(createdAt);
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

// ── Evaluations ────────────────────────────────────────────────────────

export interface EvaluationRecord {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  productiveCalls: number;
  wastedCalls: number;
  verdict: string;
  issues: string[];
  overall: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  failureChains: unknown[];
  evaluatedByHeuristic: boolean;
  skippedByJs: boolean;
  createdAt: number;
}

export interface UpsertEvaluationOpts {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  productiveCalls?: number;
  wastedCalls?: number;
  verdict: string;
  issues?: string[];
  overall?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  failureChains?: unknown[];
  evaluatedByHeuristic?: boolean;
  skippedByJs?: boolean;
  createdAt: number;
}

/**
 * Insert or replace an evaluation record.
 */
export function upsertEvaluation(persistDir: string, opts: UpsertEvaluationOpts): void {
  const db = getDb(persistDir);
  db.run(
    `INSERT OR REPLACE INTO evaluations (
      sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
      verdict, issues, overall, usage, failureChains,
      evaluatedByHeuristic, skippedByJs, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      opts.sessionId,
      opts.agent,
      opts.quality,
      opts.efficiency,
      opts.productiveCalls ?? 0,
      opts.wastedCalls ?? 0,
      opts.verdict,
      JSON.stringify(opts.issues ?? []),
      opts.overall ? JSON.stringify(opts.overall) : null,
      opts.usage ? JSON.stringify(opts.usage) : null,
      JSON.stringify(opts.failureChains ?? []),
      opts.evaluatedByHeuristic ? 1 : 0,
      opts.skippedByJs ? 1 : 0,
      opts.createdAt,
    ],
  );
}

/**
 * Check if an evaluation already exists for a session.
 */
export function hasEvaluation(persistDir: string, sessionId: string): boolean {
  const db = getDb(persistDir);
  const row = db.query("SELECT 1 FROM evaluations WHERE sessionId = ?").get(sessionId);
  return row !== null;
}

/**
 * Get evaluation for a specific session. Returns null if not found.
 */
export function getEvaluation(persistDir: string, sessionId: string): EvaluationRecord | null {
  const db = getDb(persistDir);
  const row = db.query("SELECT * FROM evaluations WHERE sessionId = ?").get(sessionId) as Record<string, unknown> | null;
  if (!row) return null;
  return deserializeEvalRow(row);
}

/**
 * Get evaluations for a specific agent within a time window.
 */
export function getEvaluationsByAgent(
  persistDir: string,
  agent: string,
  sinceMs?: number,
): EvaluationRecord[] {
  const db = getDb(persistDir);
  if (sinceMs !== undefined) {
    return (db.query("SELECT * FROM evaluations WHERE agent = ? AND createdAt >= ? ORDER BY createdAt ASC")
      .all(agent, sinceMs) as Record<string, unknown>[]).map(deserializeEvalRow);
  }
  return (db.query("SELECT * FROM evaluations WHERE agent = ? ORDER BY createdAt ASC")
    .all(agent) as Record<string, unknown>[]).map(deserializeEvalRow);
}

/**
 * Get all evaluations within a time window.
 */
export function getEvaluationsSince(persistDir: string, sinceMs: number): EvaluationRecord[] {
  const db = getDb(persistDir);
  return (db.query("SELECT * FROM evaluations WHERE createdAt >= ? ORDER BY createdAt ASC")
    .all(sinceMs) as Record<string, unknown>[]).map(deserializeEvalRow);
}

/**
 * Get all evaluations (no time filter).
 */
export function getAllEvaluations(persistDir: string): EvaluationRecord[] {
  const db = getDb(persistDir);
  return (db.query("SELECT * FROM evaluations ORDER BY createdAt ASC")
    .all() as Record<string, unknown>[]).map(deserializeEvalRow);
}

/**
 * Check if an evaluation exists and has real usage data.
 * Returns { exists: boolean; hasUsage: boolean; isRecent: boolean }.
 */
export function getEvaluationStatus(persistDir: string, sessionId: string): {
  exists: boolean;
  hasUsage: boolean;
} {
  const db = getDb(persistDir);
  const row = db.query("SELECT usage FROM evaluations WHERE sessionId = ?").get(sessionId) as { usage: string | null } | null;
  if (!row) return { exists: false, hasUsage: false };
  if (!row.usage) return { exists: true, hasUsage: false };
  try {
    const u = JSON.parse(row.usage);
    return { exists: true, hasUsage: (u.totalTokens ?? 0) > 0 || (u.turns ?? 0) > 0 };
  } catch {
    return { exists: true, hasUsage: false };
  }
}

/**
 * Migrate existing .state/evaluations/*.json files into the evaluations table.
 * Skips entries that already exist in the DB. Returns count of imported rows.
 */
export function migrateEvaluationsFromFiles(persistDir: string): number {
  const { readdirSync, readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const evalsDir = join(persistDir, "evaluations");
  if (!existsSync(evalsDir)) return 0;

  let files: string[];
  try {
    files = readdirSync(evalsDir).filter((f: string) => f.endsWith(".json"));
  } catch {
    return 0;
  }

  const db = getDb(persistDir);
  let imported = 0;

  // Use a transaction for bulk insert performance
  const insertStmt = db.query(
    `INSERT OR IGNORE INTO evaluations (
      sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
      verdict, issues, overall, usage, failureChains,
      evaluatedByHeuristic, skippedByJs, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.run("BEGIN TRANSACTION");
  try {
    for (const file of files) {
      const sessionId = file.replace(".json", "");

      // Extract timestamp from session ID (broad: any 13+ digit number)
      const tsMatch = sessionId.match(/(\d{13,})/);
      const createdAt = tsMatch ? parseInt(tsMatch[1], 10) : 0;

      try {
        const raw = JSON.parse(readFileSync(join(evalsDir, file), "utf-8"));
        if (typeof raw !== "object" || raw === null) continue;

        // Handle flat format: { agent, quality, efficiency, verdict, ... }
        const agent = typeof raw.agent === "string" ? raw.agent : "unknown";
        const quality = typeof raw.quality === "number" ? raw.quality : 0;
        const efficiency = typeof raw.efficiency === "number" ? raw.efficiency : 0;
        const verdict = typeof raw.verdict === "string" ? raw.verdict : "unknown";
        const productiveCalls = typeof raw.productive_calls === "number" ? raw.productive_calls : 0;
        const wastedCalls = typeof raw.wasted_calls === "number" ? raw.wasted_calls : 0;
        const issues = Array.isArray(raw.issues) ? raw.issues : [];
        const overall = raw.overall && typeof raw.overall === "object" ? raw.overall : null;
        const usage = raw.usage && typeof raw.usage === "object" ? raw.usage : null;
        const failureChains = Array.isArray(raw.failureChains) ? raw.failureChains : [];

        insertStmt.run(
          sessionId,
          agent,
          quality,
          efficiency,
          productiveCalls,
          wastedCalls,
          verdict,
          JSON.stringify(issues),
          overall ? JSON.stringify(overall) : null,
          usage ? JSON.stringify(usage) : null,
          JSON.stringify(failureChains),
          raw.evaluatedByHeuristic ? 1 : 0,
          raw.skippedByJs ? 1 : 0,
          createdAt,
        );
        imported++;
      } catch {
        continue;
      }
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  return imported;
}

function deserializeEvalRow(row: Record<string, unknown>): EvaluationRecord {
  return {
    sessionId: row.sessionId as string,
    agent: row.agent as string,
    quality: row.quality as number,
    efficiency: row.efficiency as number,
    productiveCalls: row.productiveCalls as number,
    wastedCalls: row.wastedCalls as number,
    verdict: row.verdict as string,
    issues: parseJsonArray(row.issues as string | null) as string[],
    overall: parseJsonObject(row.overall as string | null),
    usage: parseJsonObject(row.usage as string | null),
    failureChains: parseJsonArray(row.failureChains as string | null),
    evaluatedByHeuristic: (row.evaluatedByHeuristic as number) === 1,
    skippedByJs: (row.skippedByJs as number) === 1,
    createdAt: row.createdAt as number,
  };
}

function parseJsonArray(s: string | null): unknown[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function parseJsonObject(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

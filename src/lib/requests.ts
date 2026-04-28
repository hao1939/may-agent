/**
 * requests.ts — Database schema & helpers (SQLite)
 *
 * Manages the may.db schema (sessions, events, evaluations, gym, etc.)
 * The original `requests` table has been removed — work tracking uses
 * the sessions table and events table (event-native architecture).
 */

import { openDatabase } from "./db.js";
import type { SqliteDb } from "./db.js";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────

type RequestMethod = "chat" | "call" | "message" | "notify" | "fork" | "workflow";

// ErrorClass and classifyError are now in classify-error.ts (pure, no bun:sqlite deps)
export type { ErrorClass } from "./classify-error.js";

export interface TrackRequestOpts {
  fromEntity: string;
  toAgent: string;
  task: string;
  method: RequestMethod;
  sessionId?: string;
  parentRequestId?: string;
  source?: string;
  artifact?: string;
  context?: string;
  expectations?: string;
  notify?: string[];
  source_finding?: string;
}

// ── Schema ─────────────────────────────────────────────────────────────

const SCHEMA = `
-- Sessions: queryable index of per-session meta.json files.
-- Source of truth is meta.json on disk; this table is for SQL queries and joins.
CREATE TABLE IF NOT EXISTS sessions (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',
  kind            TEXT,
  source          TEXT,
  parentSessionId TEXT,
  requestId       TEXT,
  workflowRunId   TEXT,
  projectId       TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sess_agent   ON sessions(agent);
CREATE INDEX IF NOT EXISTS idx_sess_status  ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sess_parent  ON sessions(parentSessionId);
CREATE INDEX IF NOT EXISTS idx_sess_started ON sessions(startedAt);

-- Gym benchmark runs and checks
CREATE TABLE IF NOT EXISTS gym_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  agent_name TEXT NOT NULL,
  lab_fork TEXT,
  scenario TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  score_summary TEXT,
  session_id TEXT,
  cost_usd REAL,
  total_ops INTEGER,
  total_turns INTEGER,
  method TEXT DEFAULT 'oneshot',
  run_tag TEXT,
  prompt_hash TEXT,
  framework_sha TEXT,
  model TEXT,
  batch_id TEXT,
  categories TEXT,
  tags TEXT,
  tier TEXT
);

CREATE TABLE IF NOT EXISTS gym_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  check_name TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  category TEXT,
  code TEXT,
  FOREIGN KEY(run_id) REFERENCES gym_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gym_prompts (
  prompt_hash TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  model TEXT,
  framework_sha TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  prompt_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gym_runs_scenario ON gym_runs(scenario);
CREATE INDEX IF NOT EXISTS idx_gym_runs_agent ON gym_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_gym_runs_timestamp ON gym_runs(timestamp);
CREATE INDEX IF NOT EXISTS idx_gym_checks_run ON gym_checks(run_id);

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

-- Session Digests — structured lifecycle understanding per session
CREATE TABLE IF NOT EXISTS session_digests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId      TEXT NOT NULL,
  agent          TEXT NOT NULL,
  trigger        TEXT NOT NULL,
  step           INTEGER NOT NULL,
  task           TEXT,
  what_happened  TEXT,
  outcome        TEXT,
  still_open     TEXT,
  files_modified TEXT,
  details        TEXT,
  action         TEXT,
  action_reason  TEXT,
  created_at     INTEGER NOT NULL,
  UNIQUE(sessionId, step)
);
CREATE INDEX IF NOT EXISTS idx_sd_session ON session_digests(sessionId, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_agent   ON session_digests(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_action  ON session_digests(action, created_at DESC)
  WHERE action IS NOT NULL;

-- Research System Tables (knowledge base, hypotheses, experiments)
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id              TEXT PRIMARY KEY,      -- KE-XXX
  title           TEXT,
  status          TEXT,                  -- verified, provisional, disputed, superseded, observed
  claim           TEXT,
  evidence_refs   TEXT,                  -- comma-separated EXP refs
  discovered      TEXT,                  -- date string
  last_verified   TEXT,                  -- date string
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ke_status ON knowledge_entries(status);

CREATE TABLE IF NOT EXISTS hypotheses (
  id              TEXT PRIMARY KEY,      -- H-XXX
  title           TEXT,
  status          TEXT,                  -- untested, testing, supported, refuted, inconclusive, proposed
  priority        TEXT,                  -- high, medium, low
  proposed_by     TEXT,
  hypothesis      TEXT,
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hyp_status   ON hypotheses(status);
CREATE INDEX IF NOT EXISTS idx_hyp_priority ON hypotheses(priority);

CREATE TABLE IF NOT EXISTS experiments (
  id              TEXT PRIMARY KEY,      -- EXP-XXX
  title           TEXT,
  status          TEXT,                  -- designed, in-progress, running, completed, verified, invalidated, failed
  hypothesis_ref  TEXT,                  -- H-XXX or free text
  result_summary  TEXT,
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exp_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_exp_hyp    ON experiments(hypothesis_ref);

CREATE TABLE IF NOT EXISTS file_reads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId       TEXT NOT NULL,
  agent           TEXT NOT NULL,
  filePath        TEXT NOT NULL,
  readAt          INTEGER NOT NULL,
  producerAgent   TEXT             -- agent who "owns" the file (derived from path)
);
CREATE INDEX IF NOT EXISTS idx_file_reads_agent ON file_reads(agent);
CREATE INDEX IF NOT EXISTS idx_file_reads_path  ON file_reads(filePath);

CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type      TEXT NOT NULL,
  source          TEXT,
  owner           TEXT,
  data            TEXT,
  timestamp       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type  ON events(event_type, timestamp);

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  path            TEXT NOT NULL,
  name            TEXT NOT NULL,
  owner           TEXT,
  status          TEXT DEFAULT 'active',
  type            TEXT DEFAULT 'milestone',
  workflow        TEXT DEFAULT 'project',
  iteration       INTEGER DEFAULT 0,
  priority        TEXT,
  milestones_done INTEGER DEFAULT 0,
  milestones_total INTEGER DEFAULT 0,
  updated_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner  ON projects(owner);
`;

// ── Database Management ────────────────────────────────────────────────

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
  const db = openDatabase(dbPath);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);

  // Migrations for existing databases (idempotent — ALTER ADD COLUMN fails silently if column exists)
// gym_runs columns added after initial schema
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN run_tag TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN prompt_hash TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN framework_sha TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN model TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN batch_id TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN categories TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN tags TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN tier TEXT");
  } catch {
    /* already exists */
  }
// Indexes on migrated columns (must come after ALTER TABLE)
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_gym_runs_batch ON gym_runs(batch_id)");
  } catch {
    /* already exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_gym_runs_prompt ON gym_runs(prompt_hash)");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN projectId TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_sess_project ON sessions(projectId)");
  } catch {
    /* already exists */
  }
  // Event columns for TTL and urgency (event-native: no mutable status columns)
  for (const col of ["ttl_ms INTEGER", "urgency TEXT DEFAULT 'normal'"]) {
    try { db.exec(`ALTER TABLE events ADD COLUMN ${col}`); } catch { /* already exists */ }
  }

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

/** Close all cached DB connections and checkpoint WAL. Call on shutdown. */
export function closeAllDbs(): void {
  for (const [dir, db] of dbCache) {
    try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* best-effort */ }
    try { db.close(); } catch { /* best-effort */ }
    dbCache.delete(dir);
  }
}

// ── Core Operations ────────────────────────────────────────────────────

/**
 * Track a new request. Returns the generated requestId.
 */
export function trackRequest(_persistDir: string, _req: TrackRequestOpts): string {
  // No-op: requests table removed. Return a dummy ID for callers that use it.
  return randomUUID();
}

/**
 * Update an existing request's status and metadata.
 */
export function updateRequest(_persistDir: string, _requestId: string, _fields: Record<string, unknown>): void {
  // No-op: requests table removed.
}

/**
 * Check if a duplicate request exists (same from, to, task hash).
 * No-op stub — kept for callers that use it as a guard.
 */
export function isDuplicate(_persistDir: string, _from: string, _to: string, _task: string): string | undefined {
  return undefined;
}

// ── Error Classification ───────────────────────────────────────────────

// classifyError moved to classify-error.ts — re-export for backward compat
export { classifyError } from "./classify-error.js";

// ── Evaluations ────────────────────────────────────────────────────────

interface EvaluationRecord {
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

interface UpsertEvaluationOpts {
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
  const row = db.prepare("SELECT 1 FROM evaluations WHERE sessionId = ?").get(sessionId);
  return row !== null;
}

/**
 * Check if a session has been LLM-evaluated (not just heuristic).
 * Returns false for heuristic-only evaluations, allowing LLM to "upgrade" them.
 */
export function hasLLMEvaluation(persistDir: string, sessionId: string): boolean {
  const db = getDb(persistDir);
  const row = db.prepare(
    "SELECT 1 FROM evaluations WHERE sessionId = ? AND evaluatedByHeuristic = 0 AND skippedByJs = 0"
  ).get(sessionId);
  return row !== null;
}

/**
 * Get evaluation for a specific session. Returns null if not found.
 */
export function getEvaluation(persistDir: string, sessionId: string): EvaluationRecord | null {
  const db = getDb(persistDir);
  const row = db.prepare("SELECT * FROM evaluations WHERE sessionId = ?").get(sessionId) as Record<
    string,
    unknown
  > | null;
  if (!row) return null;
  return deserializeEvalRow(row);
}

/**
 * Get all evaluations within a time window.
 */
export function getEvaluationsSince(persistDir: string, sinceMs: number): EvaluationRecord[] {
  const db = getDb(persistDir);
  return (
    db.prepare("SELECT * FROM evaluations WHERE createdAt >= ? ORDER BY createdAt ASC").all(sinceMs) as Record<
      string,
      unknown
    >[]
  ).map(deserializeEvalRow);
}

/**
 * Get all evaluations (no time filter).
 */
export function getAllEvaluations(persistDir: string): EvaluationRecord[] {
  const db = getDb(persistDir);
  return (db.prepare("SELECT * FROM evaluations ORDER BY createdAt ASC").all() as Record<string, unknown>[]).map(
    deserializeEvalRow,
  );
}

/**
 * Check if an evaluation exists and has real usage data.
 * Returns { exists: boolean; hasUsage: boolean; isRecent: boolean }.
 */
export function getEvaluationStatus(
  persistDir: string,
  sessionId: string,
): {
  exists: boolean;
  hasUsage: boolean;
} {
  const db = getDb(persistDir);
  const row = db.prepare("SELECT usage FROM evaluations WHERE sessionId = ?").get(sessionId) as {
    usage: string | null;
  } | null;
  if (!row) return { exists: false, hasUsage: false };
  if (!row.usage) return { exists: true, hasUsage: false };
  try {
    const u = JSON.parse(row.usage);
    return { exists: true, hasUsage: (u.totalTokens ?? 0) > 0 || (u.turns ?? 0) > 0 };
  } catch {
    return { exists: true, hasUsage: false };
  }
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
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

function parseJsonObject(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ── Session DB helpers ─────────────────────────────────────────────────
//
// These mirror session meta.json data into the sessions table for
// SQL queryability. Called from RegistryStore — non-blocking, best-effort.

interface SessionDbEntry {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  kind?: string;
  source?: string;
  parentSessionId?: string;
  requestId?: string;
  workflowRunId?: string;
  projectId?: string;
  startedAt: number;
  endedAt?: number;
  error?: string;
  outcome?: string;
  opCount?: number;
}

/** Insert or replace a session row. */
export function upsertSession(persistDir: string, entry: SessionDbEntry): void {
  const db = getDb(persistDir);
  db.run(
    `INSERT OR REPLACE INTO sessions
      (sessionId, agent, task, status, kind, source, parentSessionId, requestId, workflowRunId, projectId, startedAt, endedAt, error, outcome, opCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.sessionId,
      entry.agent,
      entry.task ?? "",
      entry.status,
      entry.kind ?? "job",
      entry.source ?? null,
      entry.parentSessionId ?? null,
      entry.requestId ?? null,
      entry.workflowRunId ?? null,
      entry.projectId ?? null,
      entry.startedAt,
      entry.endedAt ?? null,
      entry.error ?? null,
      entry.outcome ?? null,
      entry.opCount ?? 0,
    ],
  );
}

/** Update session status fields only (for updateSessionStatus calls). */
export function updateSessionDb(
  persistDir: string,
  sessionId: string,
  fields: {
    status: string;
    endedAt?: number;
    error?: string;
    outcome?: string;
    opCount?: number;
  },
): void {
  const db = getDb(persistDir);
  // Use COALESCE for opCount so a later update without opCount doesn't overwrite
  // a previous write that set it correctly. This prevents the race where manager
  // sets opCount=15 and then DbWriter overwrites it with 0.
  db.run(`UPDATE sessions SET status = ?, endedAt = COALESCE(?, endedAt), error = ?, outcome = COALESCE(?, outcome), opCount = CASE WHEN ? > opCount THEN ? ELSE opCount END WHERE sessionId = ?`, [
    fields.status,
    fields.endedAt ?? null,
    fields.error ?? null,
    fields.outcome ?? null,
    fields.opCount ?? 0,
    fields.opCount ?? 0,
    sessionId,
  ]);
}



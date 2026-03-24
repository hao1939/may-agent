/**
 * gym-record.ts — Record gym run results to SQLite for history tracking.
 *
 * Reads a gym result JSON (from gym-run.sh stdout) and inserts it into
 * .state/may.db. Enables regression tracking and trend analysis.
 *
 * Usage:
 *   echo '<result-json>' | bun scripts/gym-record.ts
 *   # or:
 *   bun scripts/gym-record.ts < result.json
 *   # or with explicit path:
 *   bun scripts/gym-record.ts --result /path/to/result.json
 *
 * Design: agents/bob/workspace/gym-evolution-design.md §2.2
 */

import { Database } from "bun:sqlite";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ── Schema ─────────────────────────────────────────────────────────────

// Schema is defined inline in openDb() — tables are gym_runs and gym_checks in may.db

// ── DB Location ────────────────────────────────────────────────────────

function getDbPath(): string {
  // Resolve relative to this script's location → project root
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const projectRoot = join(scriptDir, "..");
  const dbPath = join(projectRoot, ".state", "may.db");
  return dbPath;
}

function openDb(): Database {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  // Tables are created by getDb() in requests.ts schema.
  // But ensure they exist if may.db was just created.
  db.exec(`
    CREATE TABLE IF NOT EXISTS gym_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      agent_name TEXT NOT NULL, lab_fork TEXT, scenario TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER,
      score_summary TEXT, session_id TEXT, cost_usd REAL,
      total_ops INTEGER, total_turns INTEGER, method TEXT DEFAULT 'oneshot',
      run_tag TEXT, config_hash TEXT, framework_sha TEXT,
      model TEXT, batch_id TEXT, categories TEXT, tags TEXT, tier TEXT
    );
    CREATE TABLE IF NOT EXISTS gym_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL, check_name TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0, detail TEXT,
      category TEXT, code TEXT,
      FOREIGN KEY(run_id) REFERENCES gym_runs(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS gym_snapshots (
      config_hash TEXT PRIMARY KEY,
      agent_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      files TEXT NOT NULL
    );
  `);
  return db;
}

// ── Types ──────────────────────────────────────────────────────────────

interface GymResult {
  scenario: string;
  agent: string;
  lab_fork?: string | null;
  passed: boolean;
  checks?: Array<{ name: string; passed: boolean; detail?: string; category?: string; code?: string }>;
  summary?: string;
  agent_status?: string;
  duration?: string;
  session_id?: string;
  session_path?: string;
  work_dir?: string;
  gym_root?: string;
  method?: string;
  // Telemetry fields (added by gym-run.sh when transcript is available)
  cost_usd?: number;
  total_ops?: number;
  total_turns?: number;
  // Benchmark tracking fields (Phase 1 — gym-snapshots design)
  config_hash?: string;
  framework_sha?: string;
  model?: string;
  categories?: string[];
  tags?: string[];
  tier?: string;
}

interface GymResultWithSnapshot extends GymResult {
  snapshot_files?: Record<string, string>;
}

// ── Record ─────────────────────────────────────────────────────────────

export function recordRun(db: Database, result: GymResult, opts?: { batch_id?: string; run_tag?: string }): number {
  const durationMs = result.duration ? parseDuration(result.duration) : null;

  const insertRun = db.query<{ id: number }, unknown[]>(`
    INSERT INTO gym_runs (agent_name, lab_fork, scenario, passed, duration_ms,
                      score_summary, session_id, cost_usd, total_ops,
                      total_turns, method, run_tag, config_hash, framework_sha,
                      model, batch_id, categories, tags, tier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runResult = insertRun.run(
    result.agent,
    result.lab_fork || null,
    result.scenario,
    result.passed ? 1 : 0,
    durationMs,
    result.summary || null,
    result.session_id || null,
    result.cost_usd || null,
    result.total_ops || null,
    result.total_turns || null,
    result.method || "oneshot",
    opts?.run_tag || null,
    result.config_hash || null,
    result.framework_sha || null,
    result.model || null,
    opts?.batch_id || null,
    result.categories ? JSON.stringify(result.categories) : null,
    result.tags ? JSON.stringify(result.tags) : null,
    result.tier || null
  );

  const runId = Number(runResult.lastInsertRowid);

  // Insert config snapshot if new config_hash (idempotent via INSERT OR IGNORE)
  if (result.config_hash && (result as GymResultWithSnapshot).snapshot_files) {
    db.query(`INSERT OR IGNORE INTO gym_snapshots (config_hash, agent_name, files) VALUES (?, ?, ?)`)
      .run(result.config_hash, result.agent, JSON.stringify((result as GymResultWithSnapshot).snapshot_files));
  }

  // Insert individual checks
  if (result.checks && result.checks.length > 0) {
    const insertCheck = db.query(`
      INSERT INTO gym_checks (run_id, check_name, passed, detail, category, code)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const check of result.checks) {
      insertCheck.run(runId, check.name, check.passed ? 1 : 0, check.detail || null, check.category || null, check.code || null);
    }
  }

  return runId;
}

function parseDuration(dur: string): number | null {
  // Handles formats like "45s", "2m30s", "1234" (ms), "1.5m"
  if (!dur) return null;

  // Pure number = assume milliseconds
  const num = Number(dur);
  if (!isNaN(num)) return Math.round(num);

  // "Xm Ys" or "Xm" or "Ys"
  let ms = 0;
  const minMatch = dur.match(/([\d.]+)\s*m/);
  const secMatch = dur.match(/([\d.]+)\s*s/);
  if (minMatch) ms += parseFloat(minMatch[1]) * 60_000;
  if (secMatch) ms += parseFloat(secMatch[1]) * 1_000;
  return ms > 0 ? Math.round(ms) : null;
}

// ── CLI ────────────────────────────────────────────────────────────────

async function main() {
  let inputJson: string;

  // Parse CLI flags
  const resultIdx = process.argv.indexOf("--result");
  const batchIdx = process.argv.indexOf("--batch");
  const tagIdx = process.argv.indexOf("--tag");

  const batchId = batchIdx !== -1 ? process.argv[batchIdx + 1] : undefined;
  const runTag = tagIdx !== -1 ? process.argv[tagIdx + 1] : undefined;

  // Check for --result flag
  if (resultIdx !== -1 && process.argv[resultIdx + 1]) {
    const filePath = process.argv[resultIdx + 1];
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    inputJson = readFileSync(filePath, "utf-8");
  } else {
    // Read from stdin
    const chunks: string[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(new TextDecoder().decode(chunk));
    }
    inputJson = chunks.join("");
  }

  if (!inputJson.trim()) {
    console.error("No input provided. Pipe gym result JSON or use --result <file>");
    process.exit(1);
  }

  let result: GymResult;
  try {
    result = JSON.parse(inputJson);
  } catch (e) {
    console.error("Failed to parse input JSON:", (e as Error).message);
    process.exit(1);
  }

  const db = openDb();
  try {
    const runId = recordRun(db, result, { batch_id: batchId, run_tag: runTag });
    console.log(JSON.stringify({ recorded: true, runId, scenario: result.scenario, passed: result.passed }));
  } finally {
    db.close();
  }
}

main().catch((e) => {
  console.error("gym-record error:", e.message || e);
  process.exit(1);
});

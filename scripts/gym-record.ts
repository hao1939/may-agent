/**
 * gym-record.ts — Record gym run results to SQLite for history tracking.
 *
 * Reads a gym result JSON (from gym-run.sh stdout) and inserts it into
 * test/gym/stats.db. Enables regression tracking and trend analysis.
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

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
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
  method TEXT DEFAULT 'oneshot'
);

CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  check_name TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runs_scenario ON runs(scenario);
CREATE INDEX IF NOT EXISTS idx_runs_agent ON runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp);
CREATE INDEX IF NOT EXISTS idx_checks_run ON checks(run_id);
`;

// ── DB Location ────────────────────────────────────────────────────────

function getDbPath(): string {
  // Resolve relative to this script's location → project root
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const projectRoot = join(scriptDir, "..");
  const dbDir = join(projectRoot, "test", "gym");
  mkdirSync(dbDir, { recursive: true });
  return join(dbDir, "stats.db");
}

function openDb(): Database {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

// ── Types ──────────────────────────────────────────────────────────────

interface GymResult {
  scenario: string;
  agent: string;
  lab_fork?: string | null;
  passed: boolean;
  checks?: Array<{ name: string; passed: boolean; detail?: string }>;
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
}

// ── Record ─────────────────────────────────────────────────────────────

export function recordRun(db: Database, result: GymResult): number {
  const durationMs = result.duration ? parseDuration(result.duration) : null;

  const insertRun = db.query<{ id: number }, unknown[]>(`
    INSERT INTO runs (agent_name, lab_fork, scenario, passed, duration_ms,
                      score_summary, session_id, cost_usd, total_ops,
                      total_turns, method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    result.method || "oneshot"
  );

  const runId = Number(runResult.lastInsertRowid);

  // Insert individual checks
  if (result.checks && result.checks.length > 0) {
    const insertCheck = db.query(`
      INSERT INTO checks (run_id, check_name, passed, detail)
      VALUES (?, ?, ?, ?)
    `);

    for (const check of result.checks) {
      insertCheck.run(runId, check.name, check.passed ? 1 : 0, check.detail || null);
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

  // Check for --result flag
  const resultIdx = process.argv.indexOf("--result");
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
    const runId = recordRun(db, result);
    console.log(JSON.stringify({ recorded: true, runId, scenario: result.scenario, passed: result.passed }));
  } finally {
    db.close();
  }
}

main().catch((e) => {
  console.error("gym-record error:", e.message || e);
  process.exit(1);
});

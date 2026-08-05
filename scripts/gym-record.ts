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
 *   # with batch/tag:
 *   bun scripts/gym-record.ts --result /path/to/result.json --batch <id> --tag "baseline"
 *
 * Design: projects/may-agent.app/docs/2a-design/practice-learning-loop.md
 */

import { Database } from "bun:sqlite";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ── DB Location ────────────────────────────────────────────────────────

function getDbPath(): string {
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const projectRoot = join(scriptDir, "..");
  return join(projectRoot, ".state", "may.db");
}

function openDb(): Database {
  const dbPath = getDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  // Ensure tables exist (schema matches requests.ts DDL)
  db.exec(`
    CREATE TABLE IF NOT EXISTS gym_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      agent_name TEXT NOT NULL, lab_fork TEXT, scenario TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER,
      score_summary TEXT, session_id TEXT, cost_usd REAL,
      total_ops INTEGER, total_turns INTEGER, method TEXT DEFAULT 'oneshot',
      run_tag TEXT, prompt_hash TEXT, framework_sha TEXT,
      model TEXT, batch_id TEXT, categories TEXT, tags TEXT, tier TEXT
    );
    CREATE TABLE IF NOT EXISTS gym_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL, check_name TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0, detail TEXT,
      category TEXT, code TEXT,
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
  `);
  // Migrate: add columns if missing (for DBs created before this schema)
  const cols = db.prepare("PRAGMA table_info(gym_runs)").all() as any[];
  const colNames = new Set(cols.map((c: any) => c.name));
  const migrations: Array<[string, string]> = [
    ["prompt_hash", "TEXT"],
    ["framework_sha", "TEXT"],
    ["model", "TEXT"],
    ["batch_id", "TEXT"],
    ["run_tag", "TEXT"],
    ["categories", "TEXT"],
    ["tags", "TEXT"],
    ["tier", "TEXT"],
  ];
  for (const [col, type] of migrations) {
    if (!colNames.has(col)) {
      db.exec(`ALTER TABLE gym_runs ADD COLUMN ${col} ${type}`);
    }
  }
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
  duration_ms?: number;
  session_id?: string;
  session_path?: string;
  work_dir?: string;
  gym_root?: string;
  method?: string;
  cost_usd?: number;
  total_ops?: number;
  total_turns?: number;
  // Benchmark tracking fields
  prompt_hash?: string;
  prompt_text?: string;
  framework_sha?: string;
  model?: string;
  categories?: string[];
  tags?: string[];
  tier?: string;
}

// ── Record ─────────────────────────────────────────────────────────────

export function recordRun(db: Database, result: GymResult, opts?: { batch_id?: string; run_tag?: string }): number {
  const durationMs = result.duration_ms ?? (result.duration ? parseDuration(result.duration) : null);

  const insertRun = db.query<{ id: number }, unknown[]>(`
    INSERT INTO gym_runs (agent_name, lab_fork, scenario, passed, duration_ms,
                      score_summary, session_id, cost_usd, total_ops,
                      total_turns, method, run_tag, prompt_hash, framework_sha,
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
    result.prompt_hash || null,
    result.framework_sha || null,
    result.model || null,
    opts?.batch_id || null,
    result.categories ? JSON.stringify(result.categories) : null,
    result.tags ? JSON.stringify(result.tags) : null,
    result.tier || null,
  );

  const runId = Number(runResult.lastInsertRowid);

  // Insert prompt snapshot if new prompt_hash (idempotent via INSERT OR IGNORE)
  if (result.prompt_hash && result.prompt_text) {
    db.query(
      `INSERT OR IGNORE INTO gym_prompts (prompt_hash, agent_name, model, framework_sha, prompt_text) VALUES (?, ?, ?, ?, ?)`,
    ).run(result.prompt_hash, result.agent, result.model || null, result.framework_sha || null, result.prompt_text);
  }

  // Insert individual checks
  if (result.checks && result.checks.length > 0) {
    const insertCheck = db.query(`
      INSERT INTO gym_checks (run_id, check_name, passed, detail, category, code)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const check of result.checks) {
      insertCheck.run(
        runId,
        check.name,
        check.passed ? 1 : 0,
        check.detail || null,
        check.category || null,
        check.code || null,
      );
    }
  }

  return runId;
}

function parseDuration(dur: string): number | null {
  if (!dur) return null;
  const num = Number(dur);
  if (!isNaN(num)) return Math.round(num);

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

  const resultIdx = process.argv.indexOf("--result");
  const batchIdx = process.argv.indexOf("--batch");
  const tagIdx = process.argv.indexOf("--tag");

  const batchId = batchIdx !== -1 ? process.argv[batchIdx + 1] : undefined;
  const runTag = tagIdx !== -1 ? process.argv[tagIdx + 1] : undefined;

  if (resultIdx !== -1 && process.argv[resultIdx + 1]) {
    const filePath = process.argv[resultIdx + 1];
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    inputJson = readFileSync(filePath, "utf-8");
  } else {
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

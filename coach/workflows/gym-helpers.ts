/**
 * Shared gym-runner helpers for coach workflows.
 *
 * Extracted from growth-cycle.ts to allow reuse in training-sprint.ts.
 * These replace mechanical LLM sessions that just run gym scripts and
 * parse JSON output.
 */

import { execSync } from "node:child_process";
import { readdirSync, existsSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Database } from "bun:sqlite";

export const PROJECT_ROOT = resolve(join(import.meta.dirname ?? ".", "../../.."));
export const AGENTS_ROOT = resolve(process.env["AGENTS_ROOT"] || join(PROJECT_ROOT, "agents"));
export const SCENARIOS_DIR = join(PROJECT_ROOT, "agents/gym/scenarios");
export const LAB_DIR = join(AGENTS_ROOT, ".lab");

export interface GymResult {
  scenario: string;
  agent: string;
  lab_fork: string | null;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message?: string; detail?: string; category?: string; code?: string }>;
  summary: string;
  agent_status: string;
  duration: string;
  duration_ms?: number;
  gym_root: string;
  session_id?: string;
  cost_usd?: number;
  total_ops?: number;
  total_turns?: number;
  method?: string;
  prompt_hash?: string;
  prompt_text?: string;
  framework_sha?: string;
  model?: string;
  categories?: string[];
  tags?: string[];
  tier?: string;
  transcript?: string;
}

const KNOWN_AGENTS = ["coder", "tech-lead", "optimizer", "evaluator", "coach", "qa", "may", "amy-kimi"];

// ── DB Recording ───────────────────────────────────────────────────────

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

function openGymDb(): Database {
  const dbPath = join(PROJECT_ROOT, ".state", "may.db");
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  // Ensure tables exist (matches gym-record.ts schema)
  db.exec(`
    CREATE TABLE IF NOT EXISTS gym_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      agent_name TEXT NOT NULL, lab_fork TEXT, scenario TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER,
      score_summary TEXT, session_id TEXT, cost_usd REAL,
      total_ops INTEGER, total_turns INTEGER, method TEXT DEFAULT 'oneshot',
      run_tag TEXT, prompt_hash TEXT, framework_sha TEXT,
      model TEXT, batch_id TEXT, categories TEXT, tags TEXT, tier TEXT,
      transcript TEXT
    );
    CREATE TABLE IF NOT EXISTS gym_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL, check_name TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0, detail TEXT,
      category TEXT, code TEXT,
      FOREIGN KEY(run_id) REFERENCES gym_runs(id) ON DELETE CASCADE
    );
  `);
  // Migration: add transcript column if table already existed without it
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN transcript TEXT");
  } catch {
    // Column already exists — expected
  }
  return db;
}

/**
 * Record a gym result to may.db (gym_runs + gym_checks tables).
 * Matches the schema used by scripts/gym-record.ts for data consistency.
 * Returns the inserted run ID, or -1 if recording failed.
 */
export function recordGymResult(
  result: GymResult,
  opts?: { batchId?: string; runTag?: string },
): number {
  let db: Database | null = null;
  try {
    db = openGymDb();
    const durationMs = result.duration_ms ?? parseDuration(result.duration);

    const insertRun = db.query<{ id: number }, unknown[]>(`
      INSERT INTO gym_runs (agent_name, lab_fork, scenario, passed, duration_ms,
                        score_summary, session_id, cost_usd, total_ops,
                        total_turns, method, run_tag, prompt_hash, framework_sha,
                        model, batch_id, categories, tags, tier, transcript)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      opts?.runTag || null,
      result.prompt_hash || null,
      result.framework_sha || null,
      result.model || null,
      opts?.batchId || null,
      result.categories ? JSON.stringify(result.categories) : null,
      result.tags ? JSON.stringify(result.tags) : null,
      result.tier || null,
      result.transcript || null,
    );

    const runId = Number(runResult.lastInsertRowid);

    // Insert individual checks
    if (result.checks && result.checks.length > 0) {
      const insertCheck = db.query(`
        INSERT INTO gym_checks (run_id, check_name, passed, detail, category, code)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const check of result.checks) {
        // gym-helpers uses 'message', gym-record uses 'detail' — support both
        const detail = check.detail || check.message || null;
        insertCheck.run(runId, check.name, check.passed ? 1 : 0, detail, check.category || null, check.code || null);
      }
    }

    return runId;
  } catch (err: any) {
    // Never let DB recording break gym execution
    console.error(`[gym-helpers] Failed to record gym result: ${err.message || err}`);
    return -1;
  } finally {
    db?.close();
  }
}

/** Run a single gym scenario and parse the JSON result. Auto-records to DB unless skipRecord is true. */
export function runGym(scenario: string, agent: string, labFork?: string, opts?: { skipRecord?: boolean; batchId?: string; runTag?: string }): GymResult {
  const args = [scenario, "--agent", agent, "--timeout", "3"];
  if (labFork) args.push("--lab", labFork);
  const cmd = `test/gym/run-gym.sh ${args.map(a => `'${a}'`).join(" ")}`;

  let result: GymResult;
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 4 * 60 * 1000, // 4 min timeout
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    result = JSON.parse(stdout.trim());
  } catch (err: any) {
    // gym-runner.ts may exit non-zero on score failure but still produce JSON
    const stdout = (err.stdout ?? "").trim();
    try {
      result = JSON.parse(stdout);
    } catch {
      result = {
        scenario,
        agent,
        lab_fork: labFork ?? null,
        passed: false,
        checks: [],
        summary: `gym-runner error: ${(err.stderr ?? err.message ?? "unknown").toString().slice(0, 500)}`,
        agent_status: "error",
        duration: "0s",
        gym_root: "",
      };
    }
  }

  // Auto-record to DB (opt-out with skipRecord: true)
  if (!opts?.skipRecord) {
    recordGymResult(result, { batchId: opts?.batchId, runTag: opts?.runTag });
  }

  return result;
}

/**
 * Run a batch of gym scenarios via gym-batch.sh.
 * Replaces sequential runGym() loops with a single batch invocation.
 * Returns parsed GymResult[] from --json output.
 */
export function runGymBatch(
  scenarios: string[],
  agent: string,
  labFork?: string,
): GymResult[] {
  const variants = labFork ? `baseline,${labFork}` : "baseline";
  const args = scenarios.flatMap(s => ["--scenario", s]);
  args.push("--agent", agent, "--variants", variants, "--trials", "1", "--json");
  const cmd = `scripts/gym-batch.sh ${args.map(a => `'${a}'`).join(" ")}`;

  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: scenarios.length * 4 * 60 * 1000, // 4 min per scenario
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // --json outputs JSONL (one JSON object per line)
    const results: GymResult[] = [];
    for (const line of stdout.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        // Remove batch metadata fields added by gym-batch.sh
        const result: GymResult = {
          scenario: parsed._scenario ?? parsed.scenario,
          agent: parsed.agent ?? agent,
          lab_fork: parsed._variant === "baseline" ? null : (parsed._variant ?? parsed.lab_fork ?? null),
          passed: parsed.passed ?? false,
          checks: parsed.checks ?? [],
          summary: parsed.summary ?? "",
          agent_status: parsed.agent_status ?? "unknown",
          duration: parsed.duration ?? "0s",
          duration_ms: parsed.duration_ms,
          gym_root: parsed.gym_root ?? "",
          session_id: parsed.session_id,
          cost_usd: parsed.cost_usd,
          total_ops: parsed.total_ops,
        };
        results.push(result);
      } catch {
        // Skip unparseable lines
      }
    }

    // Record each result to DB
    for (const result of results) {
      recordGymResult(result);
    }

    return results;
  } catch (err: any) {
    // On batch failure, return error results for each scenario
    return scenarios.map(s => ({
      scenario: s,
      agent,
      lab_fork: labFork ?? null,
      passed: false,
      checks: [],
      summary: `gym-batch error: ${(err.stderr ?? err.message ?? "unknown").toString().slice(0, 500)}`,
      agent_status: "error",
      duration: "0s",
      gym_root: "",
    }));
  }
}

/** List known gym scenario names. */
export function listScenarios(): string[] {
  try {
    return readdirSync(SCENARIOS_DIR).filter(d =>
      existsSync(join(SCENARIOS_DIR, d, "task.md"))
    );
  } catch { return []; }
}

/** Find lab forks currently in .lab/ directory. */
export function findLabForks(): string[] {
  try {
    return readdirSync(LAB_DIR).filter(d =>
      existsSync(join(LAB_DIR, d, "agent.json")) ||
      existsSync(join(LAB_DIR, d, "SOUL.md"))
    );
  } catch { return []; }
}

/** Extract scenario names mentioned in text by matching against known scenarios. */
export function extractScenarios(text: string): string[] {
  const known = listScenarios();
  return known.filter(s => text.includes(s));
}

/** Extract agent name from fork name (e.g., "coder-sprint-1" → "coder"). */
export function agentFromFork(forkName: string): string {
  for (const agent of KNOWN_AGENTS) {
    if (forkName.startsWith(agent + "-") || forkName === agent) return agent;
  }
  // Fallback: first segment before hyphen
  return forkName.split("-")[0];
}

/** Extract an agent name mentioned in free text. */
export function extractAgentFromText(text: string): string | null {
  const lower = text.toLowerCase();
  // Check for "target agent: X" or "agent: X" patterns first
  const patterns = [
    /target\s+agent[:\s]+(\w[\w-]*)/i,
    /agent[:\s]+["']?(\w[\w-]*?)["']?[\s,.\n]/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && KNOWN_AGENTS.includes(m[1].toLowerCase())) {
      return m[1].toLowerCase();
    }
  }
  // Fallback: find any known agent name mentioned
  for (const agent of KNOWN_AGENTS) {
    if (lower.includes(agent)) return agent;
  }
  return null;
}

/** Extract FM code (e.g., "FM-3.3") from text. */
export function extractFMCode(text: string): string {
  const m = text.match(/FM-\d+\.\d+/);
  return m ? m[0] : "unknown";
}

/** Extract method name/number from text. */
export function extractMethod(text: string): string {
  // Look for "Method #N" or "method: X"
  const m = text.match(/[Mm]ethod\s*#?\s*(\d+[\w\s-]*?)[\s,.\n]/);
  if (m) return `method-${m[1].trim()}`;
  const m2 = text.match(/[Mm]ethod[:\s]+["']?(.+?)["']?[\s,.\n]/);
  if (m2) return m2[1].trim();
  return "unknown";
}

/** Format gym results into a readable summary string. */
export function formatGymResults(
  baselineResults: GymResult[],
  patchedResults: GymResult[],
  forkName: string,
): string {
  const lines: string[] = ["## Gym Test Results (automated — no LLM session)", ""];
  lines.push(`Fork: ${forkName}`);
  lines.push(`Agent: ${agentFromFork(forkName)}`);
  lines.push("");

  // Build a map of scenario → { baseline, patched }
  const byScenario = new Map<string, { baseline?: GymResult; patched?: GymResult }>();

  for (const r of baselineResults) {
    const entry = byScenario.get(r.scenario) ?? {};
    entry.baseline = r;
    byScenario.set(r.scenario, entry);
  }
  for (const r of patchedResults) {
    const entry = byScenario.get(r.scenario) ?? {};
    entry.patched = r;
    byScenario.set(r.scenario, entry);
  }

  for (const [scenario, { baseline, patched }] of byScenario) {
    const bStatus = baseline ? (baseline.passed ? "PASS" : "FAIL") : "N/A";
    const pStatus = patched ? (patched.passed ? "PASS" : "FAIL") : "N/A";
    const bChecks = baseline ? `${baseline.checks.filter(c => c.passed).length}/${baseline.checks.length}` : "-";
    const pChecks = patched ? `${patched.checks.filter(c => c.passed).length}/${patched.checks.length}` : "-";
    lines.push(`- ${scenario}: baseline=${bStatus} (${bChecks}), patched=${pStatus} (${pChecks})`);

    // Show individual check details for patched
    if (patched) {
      for (const check of patched.checks) {
        lines.push(`  - [${check.passed ? "✓" : "✗"}] ${check.name}${check.message ? ": " + check.message : ""}`);
      }
    }
  }

  lines.push("");
  lines.push("### Raw JSON Results");
  lines.push("```json");
  lines.push(JSON.stringify({ baseline: baselineResults, patched: patchedResults }, null, 2));
  lines.push("```");

  return lines.join("\n");
}

/** Append a ceiling-effect skip record to experiments.jsonl. */
export function appendSkipRecord(
  agent: string,
  scenarios: string[],
  diagnosisText: string,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    error_pattern: extractFMCode(diagnosisText),
    agent,
    method: extractMethod(diagnosisText),
    scenarios: scenarios.map(s => ({ name: s, baseline: true, patched: null })),
    decision: "skipped",
    reason: "ceiling-effect gate: all baseline scenarios pass",
  };
  appendFileSync(
    join(PROJECT_ROOT, "agents/coach/workspace/experiments.jsonl"),
    JSON.stringify(entry) + "\n",
  );
}

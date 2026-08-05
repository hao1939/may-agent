/**
 * gym-stats.ts — Query gym run history from SQLite.
 *
 * Usage:
 *   bun scripts/gym-stats.ts                     # summary of all scenarios
 *   bun scripts/gym-stats.ts --scenario <name>   # history for one scenario
 *   bun scripts/gym-stats.ts --agent <name>      # filter by agent
 *   bun scripts/gym-stats.ts --recent [n]         # last N runs (default 10)
 *   bun scripts/gym-stats.ts --regressions        # scenarios that went pass→fail
 *   bun scripts/gym-stats.ts --batches            # list batches
 *
 * Design: projects/may-agent.app/docs/2a-design/practice-learning-loop.md
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

// ── DB ─────────────────────────────────────────────────────────────────

function getDbPath(): string {
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  return join(scriptDir, "..", ".state", "may.db");
}

function openDb(): Database {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    console.error("No database found at .state/may.db. Run some gym scenarios first.");
    process.exit(1);
  }
  return new Database(dbPath, { readonly: true });
}

// ── Queries ────────────────────────────────────────────────────────────

interface SummaryRow {
  scenario: string;
  total_runs: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  avg_duration_ms: number | null;
  last_run: string;
  last_passed: number;
}

function showSummary(db: Database, agentFilter?: string): void {
  const where = agentFilter ? "WHERE r.agent_name = ?" : "";
  const params = agentFilter ? [agentFilter] : [];

  const rows = db
    .query<SummaryRow, unknown[]>(
      `SELECT
        r.scenario,
        COUNT(*) as total_runs,
        SUM(CASE WHEN r.passed = 1 THEN 1 ELSE 0 END) as pass_count,
        SUM(CASE WHEN r.passed = 0 THEN 1 ELSE 0 END) as fail_count,
        ROUND(AVG(r.passed) * 100, 1) as pass_rate,
        ROUND(AVG(r.duration_ms)) as avg_duration_ms,
        MAX(r.timestamp) as last_run,
        (SELECT r2.passed FROM gym_runs r2 WHERE r2.scenario = r.scenario 
         ${agentFilter ? "AND r2.agent_name = ?" : ""}
         ORDER BY r2.timestamp DESC LIMIT 1) as last_passed
      FROM gym_runs r
      ${where}
      GROUP BY r.scenario
      ORDER BY pass_rate ASC, r.scenario`
    )
    .all(...params, ...(agentFilter ? [agentFilter] : []));

  if (rows.length === 0) {
    console.log("No gym runs recorded yet.");
    return;
  }

  console.log("\n  Gym Scenario Summary");
  console.log("=".repeat(90));
  console.log(
    "Scenario".padEnd(40) +
      "Runs".padStart(6) +
      "Pass%".padStart(8) +
      "Last".padStart(8) +
      "AvgTime".padStart(10) +
      "Last Run".padStart(22)
  );
  console.log("-".repeat(90));

  for (const row of rows) {
    const icon = row.last_passed ? "PASS" : "FAIL";
    const duration = row.avg_duration_ms
      ? `${Math.round(row.avg_duration_ms / 1000)}s`
      : "-";
    console.log(
      row.scenario.padEnd(40) +
        String(row.total_runs).padStart(6) +
        `${row.pass_rate}%`.padStart(8) +
        ` ${icon}`.padStart(8) +
        duration.padStart(10) +
        row.last_run.padStart(22)
    );
  }
  console.log("");
}

interface RecentRow {
  id: number;
  timestamp: string;
  agent_name: string;
  scenario: string;
  passed: number;
  duration_ms: number | null;
  score_summary: string | null;
  method: string;
  prompt_hash: string | null;
  batch_id: string | null;
}

function showRecent(db: Database, limit: number, scenarioFilter?: string, agentFilter?: string): void {
  let where = "WHERE 1=1";
  const params: unknown[] = [];
  if (scenarioFilter) { where += " AND r.scenario = ?"; params.push(scenarioFilter); }
  if (agentFilter) { where += " AND r.agent_name = ?"; params.push(agentFilter); }

  const rows = db
    .query<RecentRow, unknown[]>(
      `SELECT r.id, r.timestamp, r.agent_name, r.scenario, r.passed,
              r.duration_ms, r.score_summary, r.method, r.prompt_hash, r.batch_id
       FROM gym_runs r ${where}
       ORDER BY r.timestamp DESC LIMIT ?`
    )
    .all(...params, limit);

  if (rows.length === 0) { console.log("No matching runs found."); return; }

  console.log(`\n  Recent Gym Runs (last ${rows.length})`);
  console.log("=".repeat(110));

  for (const row of rows) {
    const icon = row.passed ? "PASS" : "FAIL";
    const dur = row.duration_ms ? `${Math.round(row.duration_ms / 1000)}s` : "-";
    const prompt = row.prompt_hash ? ` prompt:${row.prompt_hash.slice(0, 8)}` : "";
    const batch = row.batch_id ? ` batch:${row.batch_id.slice(0, 12)}` : "";
    console.log(
      `  ${icon} [${row.timestamp}] ${row.scenario} (${row.agent_name}, ${row.method}${prompt}${batch}) - ${dur}`
    );
    if (row.score_summary) console.log(`     ${row.score_summary}`);
  }
  console.log("");
}

function showRegressions(db: Database): void {
  const rows = db
    .query<{ scenario: string; agent_name: string; last_timestamp: string }, []>(
      `WITH ranked AS (
        SELECT scenario, agent_name, passed, timestamp,
               ROW_NUMBER() OVER (PARTITION BY scenario, agent_name ORDER BY timestamp DESC) as rn
        FROM gym_runs
      )
      SELECT a.scenario, a.agent_name, a.timestamp as last_timestamp
      FROM ranked a
      JOIN ranked b ON a.scenario = b.scenario AND a.agent_name = b.agent_name AND b.rn = 2
      WHERE a.rn = 1 AND a.passed = 0 AND b.passed = 1
      ORDER BY a.timestamp DESC`
    )
    .all();

  if (rows.length === 0) { console.log("\n  No regressions detected!"); return; }

  console.log(`\n  Regressions Detected (${rows.length})`);
  console.log("=".repeat(80));
  for (const row of rows) {
    console.log(`  ${row.scenario} (${row.agent_name}) - was PASS, now FAIL as of ${row.last_timestamp}`);
  }
  console.log("");
}

function showBatches(db: Database, agentFilter?: string): void {
  let where = "WHERE r.batch_id IS NOT NULL";
  const params: unknown[] = [];
  if (agentFilter) { where += " AND r.agent_name = ?"; params.push(agentFilter); }

  const rows = db
    .query<{
      batch_id: string; agent_name: string; run_tag: string | null;
      prompt_hash: string | null; model: string | null; framework_sha: string | null;
      total: number; passed: number; min_ts: string;
    }, unknown[]>(
      `SELECT r.batch_id, r.agent_name, r.run_tag, r.prompt_hash, r.model, r.framework_sha,
              COUNT(*) as total, SUM(r.passed) as passed, MIN(r.timestamp) as min_ts
       FROM gym_runs r ${where}
       GROUP BY r.batch_id
       ORDER BY min_ts DESC
       LIMIT 20`
    )
    .all(...params);

  if (rows.length === 0) { console.log("No batches recorded yet."); return; }

  console.log(`\n  Gym Batches (${rows.length})`);
  console.log("=".repeat(100));

  for (const row of rows) {
    const tag = row.run_tag ? ` "${row.run_tag}"` : "";
    const prompt = row.prompt_hash ? ` prompt:${row.prompt_hash.slice(0, 8)}` : "";
    const pct = row.total > 0 ? Math.round(row.passed / row.total * 100) : 0;
    console.log(
      `  ${row.min_ts}${tag}  ${row.agent_name}  ${row.passed}/${row.total} (${pct}%)${prompt}  fw:${row.framework_sha || "?"}  model:${row.model || "?"}`
    );
  }
  console.log("");
}

// ── CLI ────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const db = openDb();

  try {
    let scenarioFilter: string | undefined;
    let agentFilter: string | undefined;
    let recentLimit = 10;
    let mode: "summary" | "recent" | "regressions" | "batches" = "summary";

    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case "--scenario": scenarioFilter = args[++i]; mode = "recent"; break;
        case "--agent": agentFilter = args[++i]; break;
        case "--recent":
          mode = "recent";
          if (args[i + 1] && !args[i + 1].startsWith("--")) recentLimit = parseInt(args[++i], 10);
          break;
        case "--regressions": mode = "regressions"; break;
        case "--batches": mode = "batches"; break;
        default:
          console.error(`Unknown flag: ${args[i]}`);
          process.exit(1);
      }
    }

    switch (mode) {
      case "summary": showSummary(db, agentFilter); break;
      case "recent": showRecent(db, recentLimit, scenarioFilter, agentFilter); break;
      case "regressions": showRegressions(db); break;
      case "batches": showBatches(db, agentFilter); break;
    }
  } finally {
    db.close();
  }
}

main();

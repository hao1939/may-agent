/**
 * System status check — pure JS replacement for the [cron:system-status] LLM call.
 *
 * Previously, the system-status cron fired a message into May's session, which
 * caused an LLM call to run ~6 shell commands, format the results, and append
 * to health-log.md. This is entirely formulaic — same steps every time, no
 * reasoning needed.
 *
 * This module does exactly the same thing in JS:
 *   1. Session count (last 24h)
 *   2. Unevaluated session backlog
 *   3. Running/stuck sessions
 *   4. Lessons.md line counts per agent
 *   5. Bob analysis freshness
 *   6. tsc --noEmit
 *
 * Cost saved: ~$0.10-0.30 per invocation × 6/day = ~$0.60-1.80/day
 */

import { readdirSync, readFileSync, existsSync, statSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { execSync } from "node:child_process";
import { loadAllSessionMetas } from "../../src/persistence.js";
import type { PersistedSession } from "../../src/persistence.js";

export interface SystemStatusResult {
  timestamp: string;
  sessionsLast24h: number;
  unevaluated: { total: number; actionable: number; autoSkippable: number };
  runningSessions: string[];
  lessonLineCounts: Record<string, number>;
  analysisAge: string | null;
  tscResult: "PASS" | string;
  testResult: string | null;
  anomalies: string[];
}

export interface SystemStatusOptions {
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  healthLogPath: string;
  /** Skip tsc/test checks (for testing). */
  skipBuildChecks?: boolean;
}

/**
 * Run the system status check and return structured results.
 * Pure JS — no LLM needed.
 */
export function runSystemStatus(opts: SystemStatusOptions): SystemStatusResult {
  const { persistDir, projectRoot, agentsRoot, healthLogPath } = opts;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const anomalies: string[] = [];

  // 1. Session count (last 24h)
  const allSessions = loadAllSessionMetas(persistDir);
  let sessionsLast24h = 0;
  for (const session of Object.values(allSessions)) {
    if (session.startedAt >= oneDayAgo) sessionsLast24h++;
  }

  // 2. Unevaluated session backlog
  const evalDir = join(persistDir, "evaluations");
  const evaluatedIds = new Set<string>();
  if (existsSync(evalDir)) {
    for (const f of readdirSync(evalDir)) {
      if (f.endsWith(".json")) evaluatedIds.add(f.replace(".json", ""));
    }
  }

  const META_AGENTS = new Set(["evaluator", "optimizer", "may"]);
  let unevalTotal = 0;
  let unevalActionable = 0;
  let unevalAutoSkippable = 0;

  for (const [sid, session] of Object.entries(allSessions)) {
    if (evaluatedIds.has(sid)) continue;
    if (session.status === "running" || session.status === "idle") continue;
    unevalTotal++;

    if (META_AGENTS.has(session.agent)) {
      unevalAutoSkippable++;
      continue;
    }

    // Check if transcript exists
    const activeJsonl = join(persistDir, "sessions", sid, "session.jsonl");
    const archivedJsonl = join(persistDir, "sessions", "history", sid, "session.jsonl");
    if (!existsSync(activeJsonl) && !existsSync(archivedJsonl)) {
      unevalAutoSkippable++;
      continue;
    }

    unevalActionable++;
  }

  // 3. Running sessions
  const runningSessions: string[] = [];
  for (const [sid, session] of Object.entries(allSessions)) {
    if (session.status === "running" || session.status === "idle") {
      runningSessions.push(`${session.agent} (${sid})`);
    }
  }

  // 4. Lessons.md line counts per agent
  const lessonLineCounts: Record<string, number> = {};
  if (existsSync(agentsRoot)) {
    for (const agentDir of readdirSync(agentsRoot, { withFileTypes: true })) {
      if (!agentDir.isDirectory()) continue;
      if (agentDir.name === "shared" || agentDir.name === ".git") continue;
      const lessonsPath = join(agentsRoot, agentDir.name, "knowledge", "lessons.md");
      if (existsSync(lessonsPath)) {
        try {
          const content = readFileSync(lessonsPath, "utf-8");
          lessonLineCounts[agentDir.name] = content.split("\n").length;
        } catch {
          // Skip if unreadable
        }
      }
    }
  }

  // 5. Bob analysis freshness
  let analysisAge: string | null = null;
  const analysisPath = join(agentsRoot, "bob", "workspace", "analysis.md");
  if (existsSync(analysisPath)) {
    try {
      const stat = statSync(analysisPath);
      const ageMs = now - stat.mtimeMs;
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
      if (ageHours < 24) {
        analysisAge = `fresh (${ageHours}h ago)`;
      } else {
        const ageDays = Math.floor(ageHours / 24);
        analysisAge = `${ageDays}d old`;
        if (ageDays > 3) {
          anomalies.push(`Bob analysis is ${ageDays} days old — may need refresh`);
        }
      }
    } catch {
      analysisAge = "unreadable";
    }
  } else {
    analysisAge = "missing";
    anomalies.push("Bob analysis file missing");
  }

  // 6. tsc --noEmit (skip if requested, e.g. in tests)
  let tscResult = "PASS";
  if (!opts.skipBuildChecks) {
    try {
      execSync("npx tsc --noEmit", { cwd: projectRoot, timeout: 60_000, stdio: "pipe" });
      tscResult = "PASS";
    } catch (err: any) {
      const output = err.stderr?.toString() || err.stdout?.toString() || "unknown error";
      tscResult = `FAIL: ${output.slice(0, 200)}`;
      anomalies.push("tsc --noEmit failed");
    }
  }

  // 7. Test count (optional — only run if tsc passes and not skipped)
  let testResult: string | null = null;
  if (!opts.skipBuildChecks && tscResult === "PASS") {
    try {
      const output = execSync("npx vitest --run 2>&1 | tail -5", {
        cwd: projectRoot,
        timeout: 120_000,
        stdio: "pipe",
      }).toString();
      // Extract test count from vitest output
      const match = output.match(/(\d+)\s+tests?\s+passed/i) || output.match(/Tests\s+(\d+)\s+passed/i);
      testResult = match ? `${match[1]} tests pass` : output.trim().slice(0, 100);
    } catch (err: any) {
      const output = err.stdout?.toString() || err.stderr?.toString() || "unknown";
      testResult = `FAIL: ${output.slice(0, 200)}`;
      anomalies.push("Test suite failed");
    }
  }

  // Check for other anomalies
  if (unevalActionable > 20) {
    anomalies.push(`${unevalActionable} actionable unevaluated sessions — evaluation may be falling behind`);
  }
  if (unevalAutoSkippable > 50) {
    anomalies.push(`${unevalAutoSkippable} auto-skippable sessions — writeSkippedEvaluations may need to run`);
  }

  const totalLessons = Object.values(lessonLineCounts).reduce((a, b) => a + b, 0);
  if (totalLessons > 500) {
    anomalies.push(`Total lesson lines (${totalLessons}) high — may need consolidation`);
  }

  const d = new Date(now);
  const timestamp = d.toISOString().slice(0, 16).replace("T", "T");

  return {
    timestamp,
    sessionsLast24h,
    unevaluated: { total: unevalTotal, actionable: unevalActionable, autoSkippable: unevalAutoSkippable },
    runningSessions,
    lessonLineCounts,
    analysisAge,
    tscResult,
    testResult,
    anomalies,
  };
}

/**
 * Format a SystemStatusResult into a health-log.md entry.
 */
export function formatStatusReport(result: SystemStatusResult): string {
  const lines: string[] = [];
  lines.push(`## ${result.timestamp} — Auto (JS cron handler)`);
  lines.push("");
  lines.push(`- Sessions (24h): ${result.sessionsLast24h}`);

  const { total, actionable, autoSkippable } = result.unevaluated;
  if (total === 0) {
    lines.push(`- Unevaluated: 0 — all caught up`);
  } else {
    lines.push(`- Unevaluated: ${total} total, ${actionable} actionable, ${autoSkippable} auto-skippable`);
  }

  if (result.runningSessions.length === 0) {
    lines.push(`- Running sessions: none`);
  } else {
    lines.push(`- Running sessions: ${result.runningSessions.join(", ")}`);
  }

  lines.push(`- tsc: ${result.tscResult}`);

  if (result.testResult) {
    lines.push(`- Tests: ${result.testResult}`);
  }

  // Lessons breakdown
  const lessonEntries = Object.entries(result.lessonLineCounts)
    .sort(([, a], [, b]) => b - a);
  if (lessonEntries.length > 0) {
    const total = lessonEntries.reduce((sum, [, v]) => sum + v, 0);
    const breakdown = lessonEntries.map(([name, count]) => `${name} ${count}`).join(", ");
    lines.push(`- Lessons: ${total} lines total (${breakdown})`);
  }

  if (result.analysisAge) {
    lines.push(`- Bob analysis: ${result.analysisAge}`);
  }

  if (result.anomalies.length > 0) {
    for (const anomaly of result.anomalies) {
      lines.push(`- ⚠️ ${anomaly}`);
    }
  } else {
    lines.push(`- No anomalies detected`);
  }

  return lines.join("\n");
}

/**
 * Run system status and append to health-log.md.
 * This is the cron handler — call directly from the cron system.
 */
export async function handleSystemStatus(opts: SystemStatusOptions): Promise<void> {
  const result = runSystemStatus(opts);
  const report = formatStatusReport(result);

  // Ensure health-log.md exists with a header
  mkdirSync(dirname(opts.healthLogPath), { recursive: true });
  let existing = "";
  if (existsSync(opts.healthLogPath)) {
    existing = readFileSync(opts.healthLogPath, "utf-8");
  }

  if (!existing.includes("# Health Log")) {
    appendFileSync(opts.healthLogPath, "# Health Log\n\n");
  }

  appendFileSync(opts.healthLogPath, report + "\n\n");
}

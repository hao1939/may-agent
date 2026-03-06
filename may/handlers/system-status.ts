/**
 * System status — agent-owned cron handler.
 *
 * Collects system metrics (sessions, evals, tsc, lessons) and appends
 * a health-log.md entry. Pure JS — no LLM needed.
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, readFileSync, existsSync, statSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { loadAllSessionMetas } from "../../../src/persistence.js";
import type { HandlerContext, HandlerModule } from "../../../run/handler-context.js";
import type { CronEntry } from "../../../src/cron-tool.js";

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
  skipBuildChecks?: boolean;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const healthLogPath = join(ctx.agentsRoot, ctx.agentName, "workspace", "health-log.md");
  return async () => {
    await handleSystemStatus({
      persistDir: ctx.persistDir,
      projectRoot: ctx.projectRoot,
      agentsRoot: ctx.agentsRoot,
      healthLogPath,
    });
    ctx.emit(`[cron:system-status] Health check completed — see health-log.md`);
  };
};

// ── Pure logic ────────────────────────────────────────────────────────

export function runSystemStatus(opts: SystemStatusOptions): SystemStatusResult {
  const { persistDir, projectRoot, agentsRoot } = opts;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const anomalies: string[] = [];

  const allSessions = loadAllSessionMetas(persistDir);
  let sessionsLast24h = 0;
  for (const session of Object.values(allSessions)) {
    if (session.startedAt >= oneDayAgo) sessionsLast24h++;
  }

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
    if (META_AGENTS.has(session.agent)) { unevalAutoSkippable++; continue; }
    const activeJsonl = join(persistDir, "sessions", sid, "session.jsonl");
    const archivedJsonl = join(persistDir, "sessions", "history", sid, "session.jsonl");
    if (!existsSync(activeJsonl) && !existsSync(archivedJsonl)) { unevalAutoSkippable++; continue; }
    unevalActionable++;
  }

  const runningSessions: string[] = [];
  for (const [sid, session] of Object.entries(allSessions)) {
    if (session.status === "running" || session.status === "idle") {
      runningSessions.push(`${session.agent} (${sid})`);
    }
  }

  const lessonLineCounts: Record<string, number> = {};
  if (existsSync(agentsRoot)) {
    for (const agentDir of readdirSync(agentsRoot, { withFileTypes: true })) {
      if (!agentDir.isDirectory() || agentDir.name === "shared" || agentDir.name === ".git") continue;
      const lessonsPath = join(agentsRoot, agentDir.name, "knowledge", "lessons.md");
      if (existsSync(lessonsPath)) {
        try { lessonLineCounts[agentDir.name] = readFileSync(lessonsPath, "utf-8").split("\n").length; } catch {}
      }
    }
  }

  let analysisAge: string | null = null;
  const analysisPath = join(agentsRoot, "bob", "workspace", "analysis.md");
  if (existsSync(analysisPath)) {
    try {
      const stat = statSync(analysisPath);
      const ageHours = Math.floor((now - stat.mtimeMs) / (1000 * 60 * 60));
      if (ageHours < 24) { analysisAge = `fresh (${ageHours}h ago)`; }
      else { const ageDays = Math.floor(ageHours / 24); analysisAge = `${ageDays}d old`; if (ageDays > 3) anomalies.push(`Bob analysis is ${ageDays} days old — may need refresh`); }
    } catch { analysisAge = "unreadable"; }
  } else { analysisAge = "missing"; anomalies.push("Bob analysis file missing"); }

  let tscResult = "PASS";
  if (!opts.skipBuildChecks) {
    try { execSync("npx tsc --noEmit", { cwd: projectRoot, timeout: 60_000, stdio: "pipe" }); }
    catch (err: any) { const output = err.stderr?.toString() || err.stdout?.toString() || "unknown error"; tscResult = `FAIL: ${output.slice(0, 200)}`; anomalies.push("tsc --noEmit failed"); }
  }

  let testResult: string | null = null;
  if (!opts.skipBuildChecks && tscResult === "PASS") {
    try {
      const output = execSync("npx vitest --run 2>&1 | tail -5", { cwd: projectRoot, timeout: 120_000, stdio: "pipe" }).toString();
      const match = output.match(/(\d+)\s+tests?\s+passed/i) || output.match(/Tests\s+(\d+)\s+passed/i);
      testResult = match ? `${match[1]} tests pass` : output.trim().slice(0, 100);
    } catch (err: any) { const output = err.stdout?.toString() || err.stderr?.toString() || "unknown"; testResult = `FAIL: ${output.slice(0, 200)}`; anomalies.push("Test suite failed"); }
  }

  if (unevalActionable > 20) anomalies.push(`${unevalActionable} actionable unevaluated sessions — evaluation may be falling behind`);
  if (unevalAutoSkippable > 50) anomalies.push(`${unevalAutoSkippable} auto-skippable sessions — writeSkippedEvaluations may need to run`);
  const totalLessons = Object.values(lessonLineCounts).reduce((a, b) => a + b, 0);
  if (totalLessons > 500) anomalies.push(`Total lesson lines (${totalLessons}) high — may need consolidation`);

  return {
    timestamp: new Date(now).toISOString().slice(0, 16),
    sessionsLast24h,
    unevaluated: { total: unevalTotal, actionable: unevalActionable, autoSkippable: unevalAutoSkippable },
    runningSessions, lessonLineCounts, analysisAge, tscResult, testResult, anomalies,
  };
}

export function formatStatusReport(result: SystemStatusResult): string {
  const lines: string[] = [];
  lines.push(`## ${result.timestamp} — Auto (JS cron handler)`);
  lines.push("");
  lines.push(`- Sessions (24h): ${result.sessionsLast24h}`);
  const { total, actionable, autoSkippable } = result.unevaluated;
  if (total === 0) lines.push(`- Unevaluated: 0 — all caught up`);
  else lines.push(`- Unevaluated: ${total} total, ${actionable} actionable, ${autoSkippable} auto-skippable`);
  if (result.runningSessions.length === 0) lines.push(`- Running sessions: none`);
  else lines.push(`- Running sessions: ${result.runningSessions.join(", ")}`);
  lines.push(`- tsc: ${result.tscResult}`);
  if (result.testResult) lines.push(`- Tests: ${result.testResult}`);
  const lessonEntries = Object.entries(result.lessonLineCounts).sort(([, a], [, b]) => b - a);
  if (lessonEntries.length > 0) {
    const total = lessonEntries.reduce((sum, [, v]) => sum + v, 0);
    lines.push(`- Lessons: ${total} lines total (${lessonEntries.map(([n, c]) => `${n} ${c}`).join(", ")})`);
  }
  if (result.analysisAge) lines.push(`- Bob analysis: ${result.analysisAge}`);
  if (result.anomalies.length > 0) result.anomalies.forEach(a => lines.push(`- ⚠️ ${a}`));
  else lines.push(`- No anomalies detected`);
  return lines.join("\n");
}

export async function handleSystemStatus(opts: SystemStatusOptions): Promise<void> {
  const result = runSystemStatus(opts);
  const report = formatStatusReport(result);
  mkdirSync(dirname(opts.healthLogPath), { recursive: true });
  if (!existsSync(opts.healthLogPath) || !readFileSync(opts.healthLogPath, "utf-8").includes("# Health Log")) {
    appendFileSync(opts.healthLogPath, "# Health Log\n\n");
  }
  appendFileSync(opts.healthLogPath, report + "\n\n");
}

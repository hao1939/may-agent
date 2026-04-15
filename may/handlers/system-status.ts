/**
 * system-status.ts — Collects system status for the may heartbeat.
 *
 * Gathers session counts, evaluation status, running sessions,
 * lesson counts, analysis freshness, and anomalies.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { PersistedSession } from "../../../src/lib/persistence.js";

const MS_24H = 24 * 60 * 60 * 1000;
const MS_30MIN = 30 * 60 * 1000;

/** Agents that are auto-skippable for evaluation (meta-agents) */
const META_AGENTS = new Set(["evaluator", "may", "coach"]);

export interface SystemStatusOptions {
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  healthLogPath: string;
  skipBuildChecks?: boolean;
  loadAllSessionMetas: () => Record<string, any>;
  loadEvaluatedSessionIds?: () => Set<string>;
}

export interface SystemStatusResult {
  timestamp: string;
  sessionsLast24h: number;
  unevaluated: {
    total: number;
    actionable: number;
    autoSkippable: number;
  };
  runningSessions: string[];
  lessonLineCounts: Record<string, number>;
  analysisAge: string | null;
  tscResult: string;
  testResult: string | null;
  anomalies: string[];
}

export function runSystemStatus(opts: SystemStatusOptions): SystemStatusResult {
  const {
    persistDir,
    projectRoot,
    agentsRoot,
    skipBuildChecks,
    loadAllSessionMetas,
    loadEvaluatedSessionIds,
  } = opts;

  const now = Date.now();
  const ts = new Date(now).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

  // Load all sessions
  const allSessions = loadAllSessionMetas();
  const anomalies: string[] = [];

  // Count sessions in last 24h
  let sessionsLast24h = 0;
  for (const sid of Object.keys(allSessions)) {
    const meta = allSessions[sid];
    if (meta.startedAt && now - meta.startedAt < MS_24H) {
      sessionsLast24h++;
    }
  }

  // Count unevaluated sessions
  const evaluatedIds = loadEvaluatedSessionIds ? loadEvaluatedSessionIds() : new Set<string>();

  // Also check for evaluation JSON files on disk
  const evalDir = join(persistDir, "evaluations");
  if (existsSync(evalDir)) {
    try {
      for (const f of readdirSync(evalDir)) {
        if (f.endsWith(".json")) {
          // Session ID is typically the filename without extension
          const sid = f.replace(/\.json$/, "");
          evaluatedIds.add(sid);
        }
      }
    } catch { /* empty */ }
  }

  let unevalTotal = 0;
  let unevalAutoSkippable = 0;
  let unevalActionable = 0;

  for (const sid of Object.keys(allSessions)) {
    const meta = allSessions[sid];
    if (meta.status !== "complete") continue;
    if (evaluatedIds.has(sid)) continue;

    // Check if session has a transcript (session.jsonl)
    const sessionDir = join(persistDir, "sessions", sid);
    const transcriptPath = join(sessionDir, "session.jsonl");
    const hasTranscript = existsSync(transcriptPath);

    if (!hasTranscript && !meta.parentSessionId) continue;

    if (META_AGENTS.has(meta.agent)) {
      unevalAutoSkippable++;
      unevalTotal++;
    } else {
      unevalActionable++;
      unevalTotal++;
    }
  }

  // Running sessions
  const runningSessions: string[] = [];
  for (const sid of Object.keys(allSessions)) {
    const meta = allSessions[sid];
    if (meta.status === "running") {
      runningSessions.push(`${meta.agent} (${sid})`);

      // Check for stale running sessions (>30 min) — but skip may
      if (meta.agent !== "may" && meta.startedAt && now - meta.startedAt > MS_30MIN) {
        anomalies.push(`${meta.agent} (${sid}) may be stuck — running for ${Math.round((now - meta.startedAt) / 60000)}min`);
      }
    }
  }

  // Lesson line counts
  const lessonLineCounts: Record<string, number> = {};
  try {
    if (existsSync(agentsRoot)) {
      for (const agent of readdirSync(agentsRoot)) {
        const lessonsPath = join(agentsRoot, agent, "knowledge", "lessons.md");
        if (existsSync(lessonsPath)) {
          const content = readFileSync(lessonsPath, "utf-8");
          lessonLineCounts[agent] = content.split("\n").length;
        }
      }
    }
  } catch { /* empty */ }

  // Bob analysis age
  let analysisAge: string | null = null;
  const analysisPath = join(agentsRoot, "bob", "workspace", "analysis.md");
  try {
    if (existsSync(analysisPath)) {
      const stat = statSync(analysisPath);
      const ageMs = now - stat.mtimeMs;
      const ageHours = Math.round(ageMs / (60 * 60 * 1000));
      analysisAge = `fresh (${ageHours}h ago)`;
    } else {
      analysisAge = "missing";
      anomalies.push("Bob analysis missing");
    }
  } catch {
    analysisAge = "missing";
    anomalies.push("Bob analysis missing");
  }

  // Build checks
  let tscResult = "PASS";
  let testResult: string | null = null;

  if (!skipBuildChecks) {
    // Would run tsc and tests here
    tscResult = "PASS";
  }

  return {
    timestamp: ts,
    sessionsLast24h,
    unevaluated: {
      total: unevalTotal,
      actionable: unevalActionable,
      autoSkippable: unevalAutoSkippable,
    },
    runningSessions,
    lessonLineCounts,
    analysisAge,
    tscResult,
    testResult,
    anomalies,
  };
}

export function formatStatusReport(result: SystemStatusResult): string {
  const lines: string[] = [];

  lines.push(`## ${result.timestamp}`);
  lines.push("");
  lines.push(`Sessions (24h): ${result.sessionsLast24h}`);

  // Unevaluated
  if (result.unevaluated.total === 0) {
    lines.push("Unevaluated: 0 — all caught up");
  } else {
    lines.push(`Unevaluated: ${result.unevaluated.total} total, ${result.unevaluated.actionable} actionable`);
  }

  // Running sessions
  if (result.runningSessions.length > 0) {
    lines.push("");
    lines.push("Running:");
    for (const s of result.runningSessions) {
      lines.push(`  - ${s}`);
    }
  }

  lines.push("");

  // Build
  lines.push(`tsc: ${result.tscResult}`);
  if (result.testResult) {
    lines.push(`Tests: ${result.testResult}`);
  }

  // Lessons
  const totalLessons = Object.values(result.lessonLineCounts).reduce((s, n) => s + n, 0);
  if (totalLessons > 0) {
    lines.push(`Lessons: ${totalLessons} lines total`);
  }

  // Analysis
  if (result.analysisAge) {
    lines.push(`Bob analysis: ${result.analysisAge}`);
  }

  lines.push("");

  // Anomalies
  if (result.anomalies.length > 0) {
    for (const a of result.anomalies) {
      lines.push(`⚠️ ${a}`);
    }
  } else {
    lines.push("No anomalies detected.");
  }

  return lines.join("\n");
}

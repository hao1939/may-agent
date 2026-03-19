/**
 * Agent performance metrics dashboard.
 * Usage: bun src/app/cli/metrics.ts [--days N]
 *
 * Reads evaluations from may.db (SQLite) with fallback to .state/evaluations/*.json.
 * Produces a summary:
 * - Per-agent average scores (efficiency, quality)
 * - Top recurring issues
 * - Session counts and cost
 *
 * Handles two evaluation schemas:
 *   Legacy (flat):  { efficiency, quality, verdict, productive_calls, wasted_calls, usage, ... }
 *   Modern (nested): { agent, scores: { efficiency, quality, verdict }, counts: { productive_calls, wasted_calls }, issues, lessons, ... }
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const STATE_DIR = resolve(PROJECT_ROOT, process.env.STATE_DIR || ".state");
const EVAL_DIR = resolve(STATE_DIR, "evaluations");

// Parse --days argument (default: 7)
const daysArg = process.argv.find((a) => a.startsWith("--days"));
const days = daysArg ? parseInt(daysArg.split("=")[1] || process.argv[process.argv.indexOf(daysArg) + 1] || "7") : 7;
const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

/** Normalised shape we work with internally. */
interface NormalisedEval {
  agent: string;
  sessionId: string;
  efficiency: number;
  quality: number;
  verdict: string;
  productiveCalls: number;
  wastedCalls: number;
  cost: number;
  turns: number;
  issues: string[];
  lessons: string[];
}

interface AgentStats {
  sessions: number;
  avgEfficiency: number;
  avgQuality: number;
  totalWasted: number;
  totalProductive: number;
  totalCost: number;
  totalTurns: number;
  verdicts: Record<string, number>;
  issues: string[];
  lessons: string[];
}

/** Extract agent name from filename when not present in data.
 *  Filename pattern: s_{timestamp}_{agentIndex}.json  */
function agentFromFilename(filename: string): string {
  const match = filename.match(/^s_\d+_(\d+)\.json$/);
  if (match) return `agent-${match[1]}`;
  return "unknown";
}

/** Normalise either schema into a common shape. */
function normalise(raw: Record<string, unknown>, filename: string): NormalisedEval {
  // Determine agent
  const agent = (raw.agent as string) || agentFromFilename(filename);

  // Determine sessionId
  const sessionId = (raw.sessionId as string) || filename.replace(/\.json$/, "");

  // Scores: nested (modern) or flat (legacy)
  const scores = raw.scores as { efficiency?: number; quality?: number; verdict?: string } | undefined;
  const efficiency = scores?.efficiency ?? (raw.efficiency as number | undefined) ?? 0;
  const quality = scores?.quality ?? (raw.quality as number | undefined) ?? 0;
  const verdict = scores?.verdict ?? (raw.verdict as string | undefined) ?? "unknown";

  // Counts: nested (modern) or flat (legacy)
  const counts = raw.counts as { productive_calls?: number; wasted_calls?: number } | undefined;
  const productiveCalls = counts?.productive_calls ?? (raw.productive_calls as number | undefined) ?? 0;
  const wastedCalls = counts?.wasted_calls ?? (raw.wasted_calls as number | undefined) ?? 0;

  // Usage
  const usage = raw.usage as { cost?: number; turns?: number } | undefined;
  const cost = usage?.cost ?? 0;
  const turns = usage?.turns ?? 0;

  // Issues & lessons
  const issues = Array.isArray(raw.issues) ? (raw.issues as string[]) : [];
  const lessons = Array.isArray(raw.lessons) ? (raw.lessons as string[]) : [];

  return {
    agent,
    sessionId,
    efficiency,
    quality,
    verdict,
    productiveCalls,
    wastedCalls,
    cost,
    turns,
    issues,
    lessons,
  };
}

try {
  // Try loading from SQLite first
  let normalisedEvals: NormalisedEval[] = [];
  let loadedFromDb = false;

  try {
    const { getEvaluationsSince } = require("../../lib/requests.js") as typeof import("../../lib/requests.js");
    const evals = getEvaluationsSince(STATE_DIR, cutoff);
    normalisedEvals = evals.map((ev) => ({
      agent: ev.agent,
      sessionId: ev.sessionId,
      efficiency: ev.efficiency,
      quality: ev.quality,
      verdict: ev.verdict,
      productiveCalls: ev.productiveCalls,
      wastedCalls: ev.wastedCalls,
      cost: (ev.usage as Record<string, number> | null)?.cost ?? 0,
      turns: (ev.usage as Record<string, number> | null)?.turns ?? 0,
      issues: ev.issues as string[],
      lessons: [],
    }));
    loadedFromDb = true;
  } catch {
    // bun:sqlite not available, fall through to file scan
  }

  if (!loadedFromDb) {
    // Fallback: read from .state/evaluations/*.json files
    const files = readdirSync(EVAL_DIR).filter((f) => f.endsWith(".json"));
    const recentFiles = files.filter((f) => {
      try {
        const stat = statSync(join(EVAL_DIR, f));
        return stat.mtimeMs >= cutoff;
      } catch {
        return false;
      }
    });

    for (const file of recentFiles) {
      try {
        const raw = JSON.parse(readFileSync(join(EVAL_DIR, file), "utf-8")) as Record<string, unknown>;
        normalisedEvals.push(normalise(raw, file));
      } catch {
        /* skip malformed */
      }
    }
  }

  if (normalisedEvals.length === 0) {
    console.log(`No evaluations found in the last ${days} day(s).`);
    process.exit(0);
  }

  // Load and aggregate
  const agentStats = new Map<string, AgentStats>();
  let totalSessions = 0;
  let totalCost = 0;

  for (const data of normalisedEvals) {
    totalSessions++;
    totalCost += data.cost;

    const agent = data.agent;
    if (!agentStats.has(agent)) {
      agentStats.set(agent, {
        sessions: 0,
        avgEfficiency: 0,
        avgQuality: 0,
        totalWasted: 0,
        totalProductive: 0,
        totalCost: 0,
        totalTurns: 0,
        verdicts: {},
        issues: [],
        lessons: [],
      });
    }
    const stats = agentStats.get(agent)!;
    stats.sessions++;
    stats.avgEfficiency += data.efficiency;
    stats.avgQuality += data.quality;
    stats.totalWasted += data.wastedCalls;
    stats.totalProductive += data.productiveCalls;
    stats.totalCost += data.cost;
    stats.totalTurns += data.turns;
    stats.verdicts[data.verdict] = (stats.verdicts[data.verdict] || 0) + 1;
    if (data.issues.length) stats.issues.push(...data.issues);
    if (data.lessons.length) stats.lessons.push(...data.lessons);
  }

  // Compute averages
  for (const stats of agentStats.values()) {
    if (stats.sessions > 0) {
      stats.avgEfficiency = Math.round((stats.avgEfficiency / stats.sessions) * 100) / 100;
      stats.avgQuality = Math.round((stats.avgQuality / stats.sessions) * 100) / 100;
    }
  }

  // ── Print report ──────────────────────────────────────────────────
  const W = 56; // box inner width
  const line = "═".repeat(W);

  console.log(`\n╔${line}╗`);
  console.log(
    `║${`Agent Performance — Last ${days} Day(s)`.padStart(Math.ceil((W + `Agent Performance — Last ${days} Day(s)`.length) / 2)).padEnd(W)}║`,
  );
  console.log(`╠${line}╣`);
  console.log(`║  ${totalSessions} sessions evaluated  |  $${totalCost.toFixed(2)} total cost`.padEnd(W) + `║`);
  console.log(`╠${line}╣`);

  // Sort by sessions (most active first)
  const sorted = [...agentStats.entries()].sort((a, b) => b[1].sessions - a[1].sessions);

  for (const [agent, stats] of sorted) {
    const effBar = "█".repeat(Math.round(stats.avgEfficiency * 10)).padEnd(10, "░");
    const qualBar = "█".repeat(Math.round(stats.avgQuality * 10)).padEnd(10, "░");
    const totalCalls = stats.totalProductive + stats.totalWasted;
    const wasteRatio = totalCalls > 0 ? Math.round((stats.totalWasted / totalCalls) * 100) : 0;

    console.log(`║`.padEnd(W + 1) + `║`);
    console.log(
      `║  ${agent.toUpperCase().padEnd(14)} (${stats.sessions} sessions, $${stats.totalCost.toFixed(2)})`.padEnd(
        W + 1,
      ) + `║`,
    );
    console.log(`║    Efficiency: ${effBar} ${stats.avgEfficiency.toFixed(2)}`.padEnd(W + 1) + `║`);
    console.log(`║    Quality:    ${qualBar} ${stats.avgQuality.toFixed(2)}`.padEnd(W + 1) + `║`);
    console.log(
      `║    Waste:      ${wasteRatio}% (${stats.totalWasted} wasted / ${totalCalls} total calls)`.padEnd(W + 1) + `║`,
    );
    console.log(`║    Turns:      ${stats.totalTurns}`.padEnd(W + 1) + `║`);

    const verdictStr = Object.entries(stats.verdicts)
      .map(([v, n]) => `${v}:${n}`)
      .join("  ");
    console.log(`║    Verdicts:   ${verdictStr}`.padEnd(W + 1) + `║`);
  }

  // ── Top issues (deduplicated, sorted by frequency) ────────────────
  const issueCounts = new Map<string, number>();
  for (const stats of agentStats.values()) {
    for (const issue of stats.issues) {
      const normalised = issue.toLowerCase().trim();
      if (normalised.length > 10) {
        // skip trivially short
        issueCounts.set(normalised, (issueCounts.get(normalised) || 0) + 1);
      }
    }
  }

  const topIssues = [...issueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (topIssues.length > 0) {
    console.log(`║`.padEnd(W + 1) + `║`);
    console.log(`╠${line}╣`);
    console.log(`║  TOP ISSUES`.padEnd(W + 1) + `║`);
    for (const [issue, count] of topIssues) {
      const maxLen = W - 8; // "║    NNx  " prefix
      const truncated = issue.length > maxLen ? issue.slice(0, maxLen - 3) + "..." : issue;
      console.log(`║    ${String(count).padStart(2)}x  ${truncated}`.padEnd(W + 1) + `║`);
    }
  }

  // ── Top lessons ───────────────────────────────────────────────────
  const lessonCounts = new Map<string, number>();
  for (const stats of agentStats.values()) {
    for (const lesson of stats.lessons) {
      const normalised = lesson.toLowerCase().trim();
      if (normalised.length > 10) {
        lessonCounts.set(normalised, (lessonCounts.get(normalised) || 0) + 1);
      }
    }
  }

  const topLessons = [...lessonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (topLessons.length > 0) {
    console.log(`║`.padEnd(W + 1) + `║`);
    console.log(`╠${line}╣`);
    console.log(`║  TOP LESSONS`.padEnd(W + 1) + `║`);
    for (const [lesson, count] of topLessons) {
      const maxLen = W - 8;
      const truncated = lesson.length > maxLen ? lesson.slice(0, maxLen - 3) + "..." : lesson;
      console.log(`║    ${String(count).padStart(2)}x  ${truncated}`.padEnd(W + 1) + `║`);
    }
  }

  console.log(`╚${line}╝\n`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error reading evaluations: ${msg}`);
  process.exit(1);
}

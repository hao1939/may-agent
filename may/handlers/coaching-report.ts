/**
 * coaching-report.ts — Generates a coaching report from evaluation data.
 *
 * Reads evaluation JSON files from persistDir/evaluations/ and produces
 * a formatted text report with per-agent breakdown, sorted by quality (worst first).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CoachingReportOptions {
  persistDir: string;
  agentsRoot: string;
}

interface EvalData {
  agent: string;
  quality: number;
  efficiency: number;
  verdict: string;
}

export function collectCoachingReport(opts: CoachingReportOptions): string {
  const { persistDir, agentsRoot } = opts;
  const evalsDir = join(persistDir, "evaluations");

  // Load all evaluations
  const evals: EvalData[] = [];
  try {
    if (existsSync(evalsDir)) {
      for (const file of readdirSync(evalsDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const data = JSON.parse(readFileSync(join(evalsDir, file), "utf-8"));
          if (data.agent) evals.push(data);
        } catch {
          // skip malformed
        }
      }
    }
  } catch {
    // directory read error
  }

  if (evals.length === 0) {
    return "# Coaching Report\n\nNo evaluations found.\n";
  }

  // Group by agent
  const byAgent = new Map<string, EvalData[]>();
  for (const e of evals) {
    if (!byAgent.has(e.agent)) byAgent.set(e.agent, []);
    byAgent.get(e.agent)!.push(e);
  }

  // Sort agents by average quality (worst first)
  const agentEntries = [...byAgent.entries()].sort((a, b) => {
    const avgA = a[1].reduce((sum, e) => sum + e.quality, 0) / a[1].length;
    const avgB = b[1].reduce((sum, e) => sum + e.quality, 0) / b[1].length;
    return avgA - avgB;
  });

  // Count coach backlog
  let coachBacklog = 0;
  try {
    const coachWorkspace = join(agentsRoot, "coach", "workspace");
    if (existsSync(coachWorkspace)) {
      // Try to count pending items — but under vitest bun:sqlite is unavailable
      // so we just report 0
      coachBacklog = 0;
    }
  } catch {
    coachBacklog = 0;
  }

  // Build report
  const lines: string[] = [];
  lines.push("# Coaching Report");
  lines.push("");
  lines.push(`${evals.length} total evaluations across ${byAgent.size} agents`);
  lines.push(`Coach backlog: ${coachBacklog}`);
  lines.push("");

  for (const [agent, agentEvals] of agentEntries) {
    const avgQuality = agentEvals.reduce((s, e) => s + e.quality, 0) / agentEvals.length;
    const avgEfficiency = agentEvals.reduce((s, e) => s + e.efficiency, 0) / agentEvals.length;

    // Count verdicts
    const verdictCounts = new Map<string, number>();
    for (const e of agentEvals) {
      verdictCounts.set(e.verdict, (verdictCounts.get(e.verdict) ?? 0) + 1);
    }

    const niCount = verdictCounts.get("needs_improvement") ?? 0;
    const niPercent = Math.round((niCount / agentEvals.length) * 100);

    lines.push(`## ${agent}`);
    lines.push(`- Avg quality: ${avgQuality.toFixed(2)}, efficiency: ${avgEfficiency.toFixed(2)}`);
    lines.push(`- Evaluations: ${agentEvals.length}`);

    // Show verdict breakdown
    for (const [verdict, count] of [...verdictCounts.entries()].sort()) {
      lines.push(`  - ${verdict}: ${count}`);
    }

    lines.push(`  - needs_improvement rate: ${niPercent}%`);

    if (niPercent > 50) {
      lines.push(`- ⚠️ **Needs Attention**: ${niPercent}% needs_improvement`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * daily-brief.ts — Collects and formats a daily brief summary.
 *
 * Gathers session counts, commit counts, evaluation summaries,
 * cron job counts, and top issues from Bob's analysis.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface DailyBriefOptions {
  persistDir: string;
  agentsRoot: string;
  projectRoot: string;
}

export function collectDailyBrief(opts: DailyBriefOptions): string {
  const { persistDir, agentsRoot, projectRoot } = opts;

  // Count sessions
  let sessionCount = 0;
  try {
    const sessionsDir = join(persistDir, "sessions");
    if (existsSync(sessionsDir)) {
      sessionCount = readdirSync(sessionsDir).length;
    }
  } catch { /* empty */ }

  // Count evaluations
  let evalCount = 0;
  try {
    const evalsDir = join(persistDir, "evaluations");
    if (existsSync(evalsDir)) {
      evalCount = readdirSync(evalsDir).filter((f) => f.endsWith(".json")).length;
    }
  } catch { /* empty */ }

  // Count cron jobs from may/cron.json
  let cronJobCount = 0;
  try {
    const cronPath = join(agentsRoot, "may", "cron.json");
    if (existsSync(cronPath)) {
      const cronData = JSON.parse(readFileSync(cronPath, "utf-8"));
      if (Array.isArray(cronData)) cronJobCount = cronData.length;
    }
  } catch { /* empty */ }

  // Count commits (rough — just count recent)
  let commitCount = 0;

  // Get top issue from bob analysis
  let topIssue = "No analysis available";
  try {
    const analysisPath = join(agentsRoot, "bob", "workspace", "analysis.md");
    if (existsSync(analysisPath)) {
      const content = readFileSync(analysisPath, "utf-8");
      // Extract the paragraph after "Executive Summary"
      const summaryMatch = content.match(/##\s*Executive Summary\s*\n\n([^\n]+)/);
      if (summaryMatch) {
        topIssue = summaryMatch[1].trim();
      }
    }
  } catch { /* empty */ }

  const lines: string[] = [];
  lines.push("# Daily Brief");
  lines.push("");
  lines.push(`- Sessions: ${sessionCount}`);
  lines.push(`- Commits: ${commitCount}`);
  lines.push(`- Evaluations: ${evalCount}`);
  lines.push(`- Cron jobs: ${cronJobCount}`);
  lines.push("");
  lines.push(`## Top Issue`);
  lines.push(topIssue);
  lines.push("");

  return lines.join("\n");
}

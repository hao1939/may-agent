/**
 * Lessons Graduation Scanner — agent-owned cron handler.
 *
 * Runs daily. Scans all agents' LESSONS.md files for:
 * 1. Oversized files (>2,000 bytes budget)
 * 2. Stale entries (>14 days old, based on date markers)
 * 3. Entries marked as GRADUATED, OBSOLETE, or ~~strikethrough~~
 * 4. Duplicate conventions already in shared/LESSONS.md
 *
 * Pure JS — no LLM needed. Writes report to workspace/graduation-report.md.
 * If issues found, triggers May heartbeat for resolution.
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

/** Max bytes per agent LESSONS.md before flagging. */
const SIZE_BUDGET_BYTES = 2000;

/** Days before an entry is considered stale. */
const STALE_THRESHOLD_DAYS = 14;

export interface GraduationResult {
  timestamp: string;
  agentReports: AgentReport[];
  sharedBytes: number;
  totalBytes: number;
  issues: string[];
}

export interface AgentReport {
  agent: string;
  bytes: number;
  overBudget: boolean;
  staleEntries: string[];
  graduatedMarkers: string[];
  strikethroughCount: number;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const reportPath = join(ctx.agentsRoot, ctx.agentName, "workspace", "graduation-report.md");

  return async () => {
    const result = runGraduationScan(ctx.agentsRoot);
    const report = formatReport(result);

    // Write report
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, report, "utf-8");
    ctx.log(`[cron:lessons-graduation] Scan complete — ${result.issues.length} issue(s) found`);

    // If issues found, trigger May heartbeat for resolution
    if (result.issues.length > 0) {
      ctx.triggerNow("heartbeat");
      ctx.log(`[lessons-graduation] ${result.issues.length} issues → triggered May heartbeat`);
    }
  };
};

// ── Pure logic ────────────────────────────────────────────────────────

export function runGraduationScan(agentsRoot: string): GraduationResult {
  const now = Date.now();
  const staleThresholdMs = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const issues: string[] = [];
  const agentReports: AgentReport[] = [];

  // Read shared/LESSONS.md for reference
  const sharedPath = join(agentsRoot, "shared", "LESSONS.md");
  let sharedBytes = 0;
  let sharedContent = "";
  if (existsSync(sharedPath)) {
    sharedContent = readFileSync(sharedPath, "utf-8");
    sharedBytes = Buffer.byteLength(sharedContent, "utf-8");
  }

  // Extract shared convention IDs (e.g., C22, C26, C40)
  const sharedConventionIds = new Set<string>();
  const conventionPattern = /\bC(\d+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = conventionPattern.exec(sharedContent)) !== null) {
    sharedConventionIds.add(`C${match[1]}`);
  }

  // Scan each agent directory
  let totalBytes = sharedBytes;
  const agentDirs = readdirSync(agentsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "shared" && d.name !== ".git" && !d.name.startsWith("."));

  for (const dir of agentDirs) {
    const lessonsPath = join(agentsRoot, dir.name, "LESSONS.md");
    if (!existsSync(lessonsPath)) continue;

    const content = readFileSync(lessonsPath, "utf-8");
    const bytes = Buffer.byteLength(content, "utf-8");
    totalBytes += bytes;

    const report: AgentReport = {
      agent: dir.name,
      bytes,
      overBudget: bytes > SIZE_BUDGET_BYTES,
      staleEntries: [],
      graduatedMarkers: [],
      strikethroughCount: 0,
    };

    // Check for oversized
    if (report.overBudget) {
      issues.push(`${dir.name}: ${bytes} bytes (budget: ${SIZE_BUDGET_BYTES})`);
    }

    // Check for strikethrough entries
    const strikethroughPattern = /~~[^~]+~~/g;
    const strikethroughs = content.match(strikethroughPattern);
    if (strikethroughs) {
      report.strikethroughCount = strikethroughs.length;
      issues.push(`${dir.name}: ${strikethroughs.length} strikethrough entries (should be removed)`);
    }

    // Check for GRADUATED/OBSOLETE markers (outside HTML comments)
    const lines = content.split("\n");
    let inComment = false;
    for (const line of lines) {
      if (line.includes("<!--")) inComment = true;
      if (line.includes("-->")) { inComment = false; continue; }
      if (inComment) continue;

      if (/\bGRADUATED\b/i.test(line) || /\bOBSOLETE\b/i.test(line)) {
        report.graduatedMarkers.push(line.trim().slice(0, 80));
        issues.push(`${dir.name}: graduated/obsolete entry still visible: "${line.trim().slice(0, 60)}"`);
      }
    }

    // Check for stale date markers (entries > 14 days old)
    // Pattern: dates like 2026-03-01, "Added: 2026-03-01", "(2026-03-01)"
    const datePattern = /\b(20\d{2}-\d{2}-\d{2})\b/g;
    let dateMatch: RegExpExecArray | null;
    inComment = false;
    const seenDates = new Set<string>();

    for (const line of lines) {
      if (line.includes("<!--")) inComment = true;
      if (line.includes("-->")) { inComment = false; continue; }
      if (inComment) continue;

      // Skip header/metadata lines
      if (line.startsWith("#") || line.startsWith("_") || line.startsWith("**Shared")) continue;

      datePattern.lastIndex = 0;
      while ((dateMatch = datePattern.exec(line)) !== null) {
        const dateStr = dateMatch[1];
        if (seenDates.has(dateStr)) continue;
        seenDates.add(dateStr);

        const entryDate = new Date(dateStr + "T00:00:00Z").getTime();
        if (!isNaN(entryDate) && now - entryDate > staleThresholdMs) {
          const ageDays = Math.round((now - entryDate) / (24 * 60 * 60 * 1000));
          report.staleEntries.push(`${dateStr} (${ageDays}d old): ${line.trim().slice(0, 60)}`);
        }
      }
    }

    if (report.staleEntries.length > 0) {
      issues.push(`${dir.name}: ${report.staleEntries.length} entry/entries older than ${STALE_THRESHOLD_DAYS} days`);
    }

    // Check for duplicated shared conventions
    let dupConventionMatch: RegExpExecArray | null;
    const agentConventionPattern = /\bC(\d+)\b/g;
    const agentConventions = new Set<string>();
    // Only check visible content (outside HTML comments)
    inComment = false;
    for (const line of lines) {
      if (line.includes("<!--")) inComment = true;
      if (line.includes("-->")) { inComment = false; continue; }
      if (inComment) continue;

      agentConventionPattern.lastIndex = 0;
      while ((dupConventionMatch = agentConventionPattern.exec(line)) !== null) {
        const cid = `C${dupConventionMatch[1]}`;
        if (sharedConventionIds.has(cid) && !agentConventions.has(cid)) {
          // Don't flag the "Shared conventions..." pointer line
          if (!line.includes("Shared conventions") && !line.includes("shared/LESSONS.md")) {
            agentConventions.add(cid);
            issues.push(`${dir.name}: convention ${cid} duplicated (already in shared/LESSONS.md)`);
          }
        }
      }
    }

    agentReports.push(report);
  }

  return {
    timestamp: new Date(now).toISOString().slice(0, 16),
    agentReports,
    sharedBytes,
    totalBytes,
    issues,
  };
}

export function formatReport(result: GraduationResult): string {
  const lines: string[] = [];
  lines.push("# Lessons Graduation Report");
  lines.push("");
  lines.push(`**Generated**: ${result.timestamp} (automated scan)`);
  lines.push(`**Total LESSONS bytes**: ${result.totalBytes} (shared: ${result.sharedBytes})`);
  lines.push("");

  if (result.issues.length === 0) {
    lines.push("✅ **No issues found** — all LESSONS.md files are healthy.");
  } else {
    lines.push(`⚠️ **${result.issues.length} issue(s) found:**`);
    lines.push("");
    for (const issue of result.issues) {
      lines.push(`- ${issue}`);
    }
  }

  lines.push("");
  lines.push("## Per-Agent Summary");
  lines.push("");
  lines.push("| Agent | Bytes | Budget | Stale | Strikethrough | Status |");
  lines.push("|-------|-------|--------|-------|---------------|--------|");

  for (const r of result.agentReports.sort((a, b) => b.bytes - a.bytes)) {
    const status = r.overBudget || r.strikethroughCount > 0 || r.staleEntries.length > 0 || r.graduatedMarkers.length > 0
      ? "⚠️"
      : "✅";
    lines.push(
      `| ${r.agent} | ${r.bytes} | ${r.overBudget ? "OVER" : "OK"} | ${r.staleEntries.length} | ${r.strikethroughCount} | ${status} |`
    );
  }

  // Detail stale entries if any
  const staleAgents = result.agentReports.filter((r) => r.staleEntries.length > 0);
  if (staleAgents.length > 0) {
    lines.push("");
    lines.push("## Stale Entries (>14 days)");
    for (const r of staleAgents) {
      lines.push("");
      lines.push(`### ${r.agent}`);
      for (const entry of r.staleEntries) {
        lines.push(`- ${entry}`);
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

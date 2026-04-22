/**
 * Memory File Trimmer — agent-owned cron handler.
 *
 * Runs daily. Trims .state/memory/{agent}.jsonl files to keep only the
 * last `retainLines` entries per agent (default: memoryLimit * 10, min 100).
 * Also removes orphaned backup/checkpoint memory files (e.g., *-c44.jsonl,
 * *.bak*) that are never read by the system.
 *
 * The runtime's readMemoryEntries() already uses efficient tail-read,
 * but the files grow unbounded. This handler prevents disk bloat.
 *
 * Pure JS — no LLM needed. Writes report to workspace/memory-trimmer-report.md.
 *
 * Exports create() conforming to HandlerModule.
 */

import {
  readdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import type {
  HandlerContext,
  HandlerModule,
} from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

// ── Config ────────────────────────────────────────────────────────────

/** Known active agent names (files matching {name}.jsonl in .state/memory/) */
const KNOWN_AGENTS = [
  "amy",
  "amy-kimi",
  "bob",
  "coach",
  "coder",
  "evaluator",
  "may",
  "optimizer",
  "qa",
  "scout",
  "tech-lead",
];

/** Minimum entries to retain per file */
const MIN_RETAIN = 100;

/** Multiplier of memoryLimit for retention (keeps generous buffer) */
const RETAIN_MULTIPLIER = 10;

/** Default memoryLimit if not set in agent.json */
const DEFAULT_MEMORY_LIMIT = 20;

// ── Types ─────────────────────────────────────────────────────────────

interface TrimResult {
  file: string;
  action: "trimmed" | "skipped" | "removed";
  reason: string;
  beforeLines?: number;
  afterLines?: number;
  beforeBytes?: number;
  afterBytes?: number;
  savedBytes?: number;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  _entry: CronEntry,
) => {
  const memoryDir = join(ctx.persistDir, "memory");
  const reportPath = join(
    ctx.agentsRoot,
    ctx.agentName,
    "workspace",
    "memory-trimmer-report.md",
  );

  return async () => {
    if (!existsSync(memoryDir)) {
      ctx.log("[memory-trimmer] No memory directory found, skipping");
      return;
    }

    const results = runTrimmer(memoryDir, ctx.agentsRoot, ctx.log);
    const report = formatReport(results);

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, report, "utf-8");

    const totalSaved = results.reduce((sum, r) => sum + (r.savedBytes ?? 0), 0);
    const trimCount = results.filter((r) => r.action === "trimmed").length;
    const removeCount = results.filter((r) => r.action === "removed").length;

    if (totalSaved > 0) {
      ctx.log(
        `[memory-trimmer] Trimmed ${trimCount} files, removed ${removeCount} orphans. ` +
          `Saved ${formatSize(totalSaved)}.`,
      );
    } else {
      ctx.log("[memory-trimmer] All memory files within limits, no action needed.");
    }
  };
};

// ── Core Logic ────────────────────────────────────────────────────────

function runTrimmer(
  memoryDir: string,
  agentsRoot: string,
  log: (msg: string) => void,
): TrimResult[] {
  const results: TrimResult[] = [];
  const files = readdirSync(memoryDir).filter((f) => f.endsWith(".jsonl"));

  // Build set of active memory file names
  const activeFiles = new Set(KNOWN_AGENTS.map((a) => `${a}.jsonl`));

  for (const file of files) {
    const filePath = join(memoryDir, file);
    const stat = statSync(filePath);

    // Is this an active agent memory file?
    if (activeFiles.has(file)) {
      // Trim to retain limit
      const agentName = file.replace(".jsonl", "");
      const retainLines = getRetainLines(agentName, agentsRoot);
      const result = trimFile(filePath, retainLines, log);
      results.push(result);
    } else {
      // Orphaned file — backup, checkpoint, or old variant
      // Remove if older than 7 days
      const ageMs = Date.now() - stat.mtimeMs;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        try {
          unlinkSync(filePath);
          results.push({
            file,
            action: "removed",
            reason: `Orphaned backup (${ageDays.toFixed(0)}d old)`,
            beforeBytes: stat.size,
            savedBytes: stat.size,
          });
        } catch (err) {
          log(`[memory-trimmer] Failed to remove ${file}: ${err}`);
          results.push({
            file,
            action: "skipped",
            reason: `Remove failed: ${err}`,
          });
        }
      } else {
        results.push({
          file,
          action: "skipped",
          reason: `Orphaned but recent (${ageDays.toFixed(1)}d old, keeping for 7d)`,
        });
      }
    }
  }

  return results;
}

function getRetainLines(agentName: string, agentsRoot: string): number {
  let memoryLimit = DEFAULT_MEMORY_LIMIT;

  try {
    const configPath = join(agentsRoot, agentName, "agent.json");
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (typeof config.memoryLimit === "number" && config.memoryLimit > 0) {
        memoryLimit = config.memoryLimit;
      }
    }
  } catch {
    // Use default
  }

  return Math.max(MIN_RETAIN, memoryLimit * RETAIN_MULTIPLIER);
}

function trimFile(
  filePath: string,
  retainLines: number,
  log: (msg: string) => void,
): TrimResult {
  const file = basename(filePath);

  try {
    const stat = statSync(filePath);
    const beforeBytes = stat.size;

    // Read all lines
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const beforeLineCount = lines.length;

    if (beforeLineCount <= retainLines) {
      return {
        file,
        action: "skipped",
        reason: `${beforeLineCount} lines ≤ retain limit ${retainLines}`,
        beforeLines: beforeLineCount,
        beforeBytes,
      };
    }

    // Keep only the last retainLines
    const kept = lines.slice(-retainLines);
    const newContent = kept.join("\n") + "\n";
    writeFileSync(filePath, newContent, "utf-8");

    const afterBytes = Buffer.byteLength(newContent, "utf-8");
    const savedBytes = beforeBytes - afterBytes;

    log(
      `[memory-trimmer] Trimmed ${file}: ${beforeLineCount} → ${retainLines} lines, ` +
        `saved ${formatSize(savedBytes)}`,
    );

    return {
      file,
      action: "trimmed",
      reason: `${beforeLineCount} → ${retainLines} lines`,
      beforeLines: beforeLineCount,
      afterLines: retainLines,
      beforeBytes,
      afterBytes,
      savedBytes,
    };
  } catch (err) {
    log(`[memory-trimmer] Failed to trim ${file}: ${err}`);
    return {
      file,
      action: "skipped",
      reason: `Error: ${err}`,
    };
  }
}

// ── Report ────────────────────────────────────────────────────────────

function formatReport(results: TrimResult[]): string {
  const now = new Date().toISOString();
  const trimmed = results.filter((r) => r.action === "trimmed");
  const removed = results.filter((r) => r.action === "removed");
  const skipped = results.filter((r) => r.action === "skipped");
  const totalSaved = results.reduce((sum, r) => sum + (r.savedBytes ?? 0), 0);

  let report = `# Memory Trimmer Report\n\nRun: ${now}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Trimmed**: ${trimmed.length} files\n`;
  report += `- **Removed**: ${removed.length} orphaned files\n`;
  report += `- **Skipped**: ${skipped.length} files (within limits)\n`;
  report += `- **Total saved**: ${formatSize(totalSaved)}\n\n`;

  if (trimmed.length > 0) {
    report += `## Trimmed Files\n\n`;
    report += `| File | Before | After | Saved |\n`;
    report += `|------|--------|-------|-------|\n`;
    for (const r of trimmed) {
      report += `| ${r.file} | ${r.beforeLines} lines (${formatSize(r.beforeBytes ?? 0)}) | ${r.afterLines} lines (${formatSize(r.afterBytes ?? 0)}) | ${formatSize(r.savedBytes ?? 0)} |\n`;
    }
    report += `\n`;
  }

  if (removed.length > 0) {
    report += `## Removed Orphans\n\n`;
    report += `| File | Size | Reason |\n`;
    report += `|------|------|--------|\n`;
    for (const r of removed) {
      report += `| ${r.file} | ${formatSize(r.beforeBytes ?? 0)} | ${r.reason} |\n`;
    }
    report += `\n`;
  }

  if (skipped.length > 0) {
    report += `## Skipped\n\n`;
    report += `| File | Reason |\n`;
    report += `|------|--------|\n`;
    for (const r of skipped) {
      report += `| ${r.file} | ${r.reason} |\n`;
    }
    report += `\n`;
  }

  return report;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

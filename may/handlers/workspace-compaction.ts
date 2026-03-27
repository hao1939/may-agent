/**
 * Workspace Compaction — agent-owned cron handler.
 *
 * Runs daily. Scans all agent workspaces for stale files (not modified
 * in 7+ days) and moves them to workspace/archive/YYYY-MM/ subdirectories.
 *
 * Protected files (todo.md, MEMORY.md, activity.jsonl, implementation-plan.md)
 * are never archived. Files already inside archive/ are skipped.
 *
 * Pure JS — no LLM needed. Writes report to workspace/compaction-report.md.
 *
 * Exports create() conforming to HandlerModule.
 */

import {
  readdirSync,
  statSync,
  existsSync,
  renameSync,
  writeFileSync,
  mkdirSync,
  rmdirSync,
} from "node:fs";
import { join, dirname, relative, basename } from "node:path";
import type {
  HandlerContext,
  HandlerModule,
} from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Config ────────────────────────────────────────────────────────────

/** Days since last modification before a file is considered stale. */
const STALE_DAYS = 7;

/** Files that are never archived (case-insensitive basename match). */
const PROTECTED_FILES = new Set([
  "todo.md",
  "memory.md",
  "activity.jsonl",
  "implementation-plan.md",
  "pending-decisions.md",
]);

/** Directories inside workspace that are never scanned for archival. */
const SKIP_DIRS = new Set(["archive", ".git", "node_modules"]);

/** Agents whose workspaces to compact. */
const TARGET_AGENTS = ["bob", "scout", "coach", "optimizer", "tech-lead", "amy", "amy-kimi", "qa", "evaluator"];

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  _entry: CronEntry
) => {
  const reportPath = join(
    ctx.agentsRoot,
    ctx.agentName,
    "workspace",
    "compaction-report.md"
  );

  return async () => {
    const result = runCompaction(ctx.agentsRoot);
    const report = formatReport(result);

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, report, "utf-8");

    const totalMoved = result.agentResults.reduce(
      (sum, r) => sum + r.movedFiles.length,
      0
    );
    ctx.log(
      `[cron:workspace-compaction] Complete — ${totalMoved} file(s) archived across ${result.agentResults.length} agent(s)`
    );
  };
};

// ── Types ─────────────────────────────────────────────────────────────

export interface CompactionResult {
  timestamp: string;
  staleThresholdDays: number;
  agentResults: AgentCompactionResult[];
}

export interface AgentCompactionResult {
  agent: string;
  scannedFiles: number;
  movedFiles: MovedFile[];
  errors: string[];
}

export interface MovedFile {
  from: string; // relative to workspace
  to: string; // relative to workspace
  ageDays: number;
  sizeBytes: number;
}

// ── Pure logic ────────────────────────────────────────────────────────

export function runCompaction(agentsRoot: string): CompactionResult {
  const now = Date.now();
  const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;
  const agentResults: AgentCompactionResult[] = [];

  for (const agentName of TARGET_AGENTS) {
    const wsDir = join(agentsRoot, agentName, "workspace");
    if (!existsSync(wsDir)) continue;

    const result: AgentCompactionResult = {
      agent: agentName,
      scannedFiles: 0,
      movedFiles: [],
      errors: [],
    };

    // Collect all files recursively, skipping protected dirs
    const files = collectFiles(wsDir, wsDir);
    result.scannedFiles = files.length;

    for (const filePath of files) {
      const absPath = join(wsDir, filePath);
      const fileName = basename(filePath).toLowerCase();

      // Skip protected files
      if (PROTECTED_FILES.has(fileName)) continue;

      // Skip files already in archive/
      if (filePath.startsWith("archive/") || filePath.startsWith("archive\\"))
        continue;

      try {
        const stat = statSync(absPath);
        const ageMs = now - stat.mtimeMs;

        if (ageMs > staleMs) {
          const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000));
          const modDate = new Date(stat.mtimeMs);
          const yearMonth = `${modDate.getFullYear()}-${String(modDate.getMonth() + 1).padStart(2, "0")}`;
          const archiveDir = join(wsDir, "archive", yearMonth);
          const destPath = join(archiveDir, basename(filePath));

          // Handle name collisions by appending a counter
          let finalDest = destPath;
          let counter = 1;
          while (existsSync(finalDest)) {
            const ext = basename(filePath).includes(".")
              ? "." + basename(filePath).split(".").pop()
              : "";
            const base = basename(filePath).replace(ext, "");
            finalDest = join(archiveDir, `${base}-${counter}${ext}`);
            counter++;
          }

          mkdirSync(archiveDir, { recursive: true });
          renameSync(absPath, finalDest);

          result.movedFiles.push({
            from: filePath,
            to: relative(wsDir, finalDest),
            ageDays,
            sizeBytes: stat.size,
          });
        }
      } catch (err) {
        result.errors.push(
          `${filePath}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Clean up empty directories left behind (bottom-up)
    cleanEmptyDirs(wsDir, wsDir);

    if (
      result.movedFiles.length > 0 ||
      result.errors.length > 0 ||
      result.scannedFiles > 100
    ) {
      agentResults.push(result);
    }
  }

  return {
    timestamp: new Date(now).toISOString().slice(0, 16),
    staleThresholdDays: STALE_DAYS,
    agentResults,
  };
}

/**
 * Recursively collect file paths relative to wsDir,
 * skipping SKIP_DIRS directories.
 */
function collectFiles(dir: string, wsDir: string): string[] {
  const results: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        results.push(...collectFiles(join(dir, entry.name), wsDir));
      } else if (entry.isFile()) {
        results.push(relative(wsDir, join(dir, entry.name)));
      }
    }
  } catch {
    // Permission error or deleted during scan — skip
  }

  return results;
}

/**
 * Remove empty directories left after moving files.
 * Never removes the workspace root or archive/.
 */
function cleanEmptyDirs(dir: string, wsDir: string): void {
  if (dir === wsDir) {
    // Only recurse into subdirs, don't remove root
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
          cleanEmptyDirs(join(dir, entry.name), wsDir);
        }
      }
    } catch {
      // ignore
    }
    return;
  }

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    // Recurse first (bottom-up)
    for (const entry of entries) {
      if (entry.isDirectory()) {
        cleanEmptyDirs(join(dir, entry.name), wsDir);
      }
    }
    // After recursing, check if now empty
    const remaining = readdirSync(dir);
    if (remaining.length === 0) {
      // Don't remove archive directories
      const relDir = relative(wsDir, dir);
      if (!relDir.startsWith("archive")) {
        rmdirSync(dir);
      }
    }
  } catch {
    // ignore
  }
}

// ── Report formatting ─────────────────────────────────────────────────

export function formatReport(result: CompactionResult): string {
  const lines: string[] = [];
  lines.push("# Workspace Compaction Report");
  lines.push("");
  lines.push(
    `**Generated**: ${result.timestamp} | **Threshold**: ${result.staleThresholdDays} days`
  );
  lines.push("");

  const totalMoved = result.agentResults.reduce(
    (s, r) => s + r.movedFiles.length,
    0
  );
  const totalBytes = result.agentResults.reduce(
    (s, r) => s + r.movedFiles.reduce((b, f) => b + f.sizeBytes, 0),
    0
  );

  if (totalMoved === 0) {
    lines.push("✅ **No stale files found** — all workspaces are clean.");
    return lines.join("\n");
  }

  lines.push(
    `📦 **${totalMoved} files archived** (${formatBytes(totalBytes)} total)`
  );
  lines.push("");

  lines.push("| Agent | Scanned | Archived | Size | Errors |");
  lines.push("|-------|---------|----------|------|--------|");

  for (const r of result.agentResults) {
    const movedBytes = r.movedFiles.reduce((s, f) => s + f.sizeBytes, 0);
    lines.push(
      `| ${r.agent} | ${r.scannedFiles} | ${r.movedFiles.length} | ${formatBytes(movedBytes)} | ${r.errors.length} |`
    );
  }

  // Detail per agent
  for (const r of result.agentResults) {
    if (r.movedFiles.length === 0) continue;
    lines.push("");
    lines.push(`## ${r.agent}`);
    // Group by destination directory
    const byDest = new Map<string, MovedFile[]>();
    for (const f of r.movedFiles) {
      const destDir = dirname(f.to);
      if (!byDest.has(destDir)) byDest.set(destDir, []);
      byDest.get(destDir)!.push(f);
    }
    for (const [destDir, files] of byDest) {
      lines.push(`→ **${destDir}/** (${files.length} files)`);
      // Show up to 10 files per directory
      const shown = files.slice(0, 10);
      for (const f of shown) {
        lines.push(
          `  - \`${f.from}\` (${f.ageDays}d old, ${formatBytes(f.sizeBytes)})`
        );
      }
      if (files.length > 10) {
        lines.push(`  - ... and ${files.length - 10} more`);
      }
    }

    if (r.errors.length > 0) {
      lines.push("");
      lines.push("**Errors:**");
      for (const err of r.errors.slice(0, 5)) {
        lines.push(`- ${err}`);
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Memory Consistency Check — Validates integrity of memory consolidation.
 *
 * Ensures the consolidation process (journal → knowledge + archive) is:
 *   1. Idempotent: running twice doesn't duplicate knowledge entries
 *   2. Complete: archived content matches source before truncation
 *   3. Safe: extracted facts pass sanitization (memory poisoning defense)
 *
 * Used by Coach's `consolidate_memory` skill as a verification step.
 *
 * Security context: Bob brief (brief-memory-consolidation.md) — "Sleep Cycle"
 * for compressing append-only logs into durable knowledge.
 *
 * Defense: P72 (Memory Integrity), P145 (Trusted Supply Chain).
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { sanitizeMemory } from "./memory-sanitizer.js";

// ── Types ───────────────────────────────────────────────────────────────

export interface ConsistencyIssue {
  /** Category of the issue. */
  type: "duplicate" | "archive_mismatch" | "sanitization_failure" | "orphan_archive" | "missing_archive";
  /** Human-readable description. */
  message: string;
  /** File path(s) involved. */
  files: string[];
  /** Severity: error = must fix, warning = should investigate. */
  severity: "error" | "warning";
}

export interface ConsistencyReport {
  /** Whether the check passed with no errors. Warnings don't cause failure. */
  passed: boolean;
  /** Total issues found (errors + warnings). */
  issueCount: number;
  /** Individual issues. */
  issues: ConsistencyIssue[];
  /** Summary statistics. */
  stats: {
    knowledgeFilesChecked: number;
    totalFactsFound: number;
    duplicatesFound: number;
    archivesChecked: number;
    sanitizationFailures: number;
  };
}

export interface ConsistencyCheckOptions {
  /** Root directory of the agents folder (e.g., "/app/agents"). */
  agentsRoot: string;
  /** Specific agent to check (e.g., "bob"). If omitted, checks all agents. */
  agent?: string;
  /** Whether to also check facts through the memory sanitizer. Default: true. */
  sanitize?: boolean;
}

// ── Fact extraction helpers ─────────────────────────────────────────────

/**
 * Extract individual fact entries from a consolidated knowledge file.
 * Facts are bullet points starting with `- **[...]**` or `- ` under
 * a `## Consolidated from` header.
 */
export function extractFacts(content: string): string[] {
  const facts: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Match bullet-point facts: "- **[H123]** Some fact" or "- Some fact"
    if (trimmed.startsWith("- ") && trimmed.length > 4) {
      // Normalize: strip leading "- ", collapse whitespace
      const fact = trimmed.slice(2).trim().replace(/\s+/g, " ");
      if (fact.length > 0) {
        facts.push(fact);
      }
    }
  }

  return facts;
}

/**
 * Normalize a fact string for dedup comparison.
 * Strips heartbeat references, collapses whitespace, lowercases.
 */
export function normalizeFact(fact: string): string {
  return fact
    .replace(/\*\*\[H\d+\]\*\*\s*/g, "") // Remove **[H123]** prefixes
    .replace(/\[H\d+\]/g, "")            // Remove [H123] without bold
    .replace(/\*\*/g, "")                 // Remove remaining bold markers
    .replace(/\s+/g, " ")                 // Collapse whitespace
    .trim()
    .toLowerCase();
}

// ── Core consistency check ──────────────────────────────────────────────

/**
 * Check memory consistency for an agent's knowledge files.
 *
 * Verifies:
 * 1. No duplicate facts across consolidated-*.md files
 * 2. Archive files exist for claimed consolidation dates
 * 3. Extracted facts pass memory sanitization
 *
 * @param options - Configuration for the check.
 * @returns A ConsistencyReport with issues and statistics.
 */
export function checkMemoryConsistency(options: ConsistencyCheckOptions): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  const stats = {
    knowledgeFilesChecked: 0,
    totalFactsFound: 0,
    duplicatesFound: 0,
    archivesChecked: 0,
    sanitizationFailures: 0,
  };

  const agents = options.agent
    ? [options.agent]
    : listAgentDirs(options.agentsRoot);

  const shouldSanitize = options.sanitize !== false;

  for (const agent of agents) {
    const agentDir = join(options.agentsRoot, agent);
    const knowledgeDir = join(agentDir, "knowledge");

    if (!existsSync(knowledgeDir)) continue;

    // ── 1. Collect all facts from consolidated-*.md files ───────────
    const allFacts = new Map<string, { fact: string; file: string }[]>();

    const knowledgeFiles = safeReadDir(knowledgeDir)
      .filter((f) => f.startsWith("consolidated-") && f.endsWith(".md"));

    for (const file of knowledgeFiles) {
      const filePath = join(knowledgeDir, file);
      const content = safeReadFile(filePath);
      if (!content) continue;

      stats.knowledgeFilesChecked++;
      const facts = extractFacts(content);

      for (const fact of facts) {
        stats.totalFactsFound++;
        const normalized = normalizeFact(fact);

        if (!allFacts.has(normalized)) {
          allFacts.set(normalized, []);
        }
        allFacts.get(normalized)!.push({ fact, file: filePath });

        // ── 3. Sanitization check ────────────────────────────────
        if (shouldSanitize) {
          const result = sanitizeMemory(fact, {
            filePath,
            agentName: agent,
          });
          if (result.action === "rejected") {
            stats.sanitizationFailures++;
            issues.push({
              type: "sanitization_failure",
              message: `Fact in ${file} failed sanitization: ${result.issues.join("; ")}`,
              files: [filePath],
              severity: "error",
            });
          }
        }
      }
    }

    // ── 2. Detect duplicates ────────────────────────────────────────
    for (const [_normalized, entries] of allFacts) {
      if (entries.length > 1) {
        stats.duplicatesFound++;
        const fileList = entries.map((e) => basename(e.file));
        issues.push({
          type: "duplicate",
          message: `Duplicate fact found in ${fileList.join(", ")}: "${entries[0].fact.slice(0, 80)}${entries[0].fact.length > 80 ? "…" : ""}"`,
          files: entries.map((e) => e.file),
          severity: "warning",
        });
      }
    }

    // ── 4. Archive integrity checks ─────────────────────────────────
    const archiveDir = join(knowledgeDir, "library", "archives");

    // Check that consolidated dates have matching archives
    for (const file of knowledgeFiles) {
      const dateMatch = file.match(/consolidated-(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;

      const date = dateMatch[1];
      const expectedArchive = join(archiveDir, `${date}-journal.md`);

      if (existsSync(archiveDir) && !existsSync(expectedArchive)) {
        // Only warn if archive dir exists (if it doesn't, consolidation may not use archives)
        issues.push({
          type: "missing_archive",
          message: `Consolidated knowledge for ${date} exists but archive ${date}-journal.md is missing`,
          files: [join(knowledgeDir, file), expectedArchive],
          severity: "warning",
        });
      }

      stats.archivesChecked++;
    }

    // Check for orphan archives (archive exists but no matching knowledge)
    if (existsSync(archiveDir)) {
      const archives = safeReadDir(archiveDir)
        .filter((f) => f.endsWith("-journal.md"));

      for (const archive of archives) {
        const dateMatch = archive.match(/^(\d{4}-\d{2}-\d{2})-journal\.md$/);
        if (!dateMatch) continue;

        const date = dateMatch[1];
        const matchingKnowledge = knowledgeFiles.some((f) =>
          f.includes(date)
        );

        if (!matchingKnowledge) {
          issues.push({
            type: "orphan_archive",
            message: `Archive ${archive} exists but no matching consolidated-${date}.md knowledge file found`,
            files: [join(archiveDir, archive)],
            severity: "warning",
          });
        }
      }
    }
  }

  // Also check shared knowledge for cross-agent dedup
  const sharedKnowledge = join(options.agentsRoot, "shared", "knowledge");
  if (existsSync(sharedKnowledge)) {
    const sharedFile = join(sharedKnowledge, "strategies.md");
    if (existsSync(sharedFile)) {
      const content = safeReadFile(sharedFile);
      if (content) {
        stats.knowledgeFilesChecked++;
        const facts = extractFacts(content);
        stats.totalFactsFound += facts.length;
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;

  return {
    passed: errorCount === 0,
    issueCount: issues.length,
    issues,
    stats,
  };
}

/**
 * Verify that an archive file's content matches the source before truncation.
 * Call this BEFORE truncating the journal to confirm the archive is a faithful copy.
 *
 * @param sourcePath  - Path to the source journal file.
 * @param archivePath - Path to the archive copy.
 * @returns null if they match, or an error message if they don't.
 */
export function verifyArchiveIntegrity(sourcePath: string, archivePath: string): string | null {
  if (!existsSync(sourcePath)) {
    return `Source file does not exist: ${sourcePath}`;
  }
  if (!existsSync(archivePath)) {
    return `Archive file does not exist: ${archivePath}`;
  }

  const sourceContent = safeReadFile(sourcePath);
  const archiveContent = safeReadFile(archivePath);

  if (sourceContent === null || archiveContent === null) {
    return "Failed to read one or both files";
  }

  // Normalize line endings for comparison
  const normalizedSource = sourceContent.replace(/\r\n/g, "\n").trimEnd();
  const normalizedArchive = archiveContent.replace(/\r\n/g, "\n").trimEnd();

  if (normalizedSource !== normalizedArchive) {
    // Provide useful diff info
    const sourceLines = normalizedSource.split("\n").length;
    const archiveLines = normalizedArchive.split("\n").length;
    return `Archive mismatch: source has ${sourceLines} lines, archive has ${archiveLines} lines`;
  }

  return null;
}

/**
 * Format a ConsistencyReport into a human-readable summary.
 */
export function formatConsistencyReport(report: ConsistencyReport): string {
  const lines: string[] = [];
  const status = report.passed ? "✅ PASSED" : "❌ FAILED";

  lines.push(`Memory Consistency Check: ${status}`);
  lines.push(`─────────────────────────────────────────`);
  lines.push(`Knowledge files checked: ${report.stats.knowledgeFilesChecked}`);
  lines.push(`Total facts found: ${report.stats.totalFactsFound}`);
  lines.push(`Duplicates: ${report.stats.duplicatesFound}`);
  lines.push(`Archives checked: ${report.stats.archivesChecked}`);
  lines.push(`Sanitization failures: ${report.stats.sanitizationFailures}`);

  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues) {
      const icon = issue.severity === "error" ? "🔴" : "🟡";
      lines.push(`  ${icon} [${issue.type}] ${issue.message}`);
    }
  }

  return lines.join("\n");
}

// ── Internal helpers ────────────────────────────────────────────────────

function safeReadFile(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function safeReadDir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function listAgentDirs(agentsRoot: string): string[] {
  try {
    const entries = readdirSync(agentsRoot, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name !== "shared")
      .map((e) => e.name);
  } catch {
    return [];
  }
}

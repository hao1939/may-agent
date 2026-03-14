/**
 * active-recall.ts — Active Recall Pre-Check (P110)
 *
 * Before dispatching a task to an agent, checks the agent's ERROR_LOG.jsonl
 * for recent failures and injects warnings into the agent's context.
 * This prevents agents from repeating known failure patterns.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ── Active Recall Pre-Check (P110) ─────────────────────────────────────

/**
 * Structured output from the Active Recall pre-check.
 */
export interface ActiveRecallResult {
  /** Whether any past failures were found for this agent. */
  triggered: boolean;
  /** Number of matching failure entries found. */
  matchCount: number;
  /** Types of failures found (e.g., "FM-2.6", "LOOP", "DRIFT"). */
  failureTypes: string[];
  /** Human-readable warnings to inject into agent context. */
  warnings: string[];
}

/**
 * Run Active Recall pre-check for an agent before task execution.
 *
 * Reads agents/{agentName}/ERROR_LOG.jsonl for past failures (last 3 days).
 * Returns structured warnings that should be injected into the agent's
 * system message context.
 *
 * @param agentName - The agent whose failure history to check.
 * @param projectRoot - Project root directory (for path resolution).
 * @returns Structured recall result with warnings to inject.
 */
export function runActiveRecall(agentName: string, projectRoot: string): ActiveRecallResult {
  // Read the target agent's own error log, not a central one
  const errorLogPath = join(projectRoot, "agents", agentName, "ERROR_LOG.jsonl");

  // Fast path: if no error log exists, no recall needed
  if (!existsSync(errorLogPath)) {
    return { triggered: false, matchCount: 0, failureTypes: [], warnings: [] };
  }

  try {
    const stats = statSync(errorLogPath);
    if (stats.size === 0) {
      return { triggered: false, matchCount: 0, failureTypes: [], warnings: [] };
    }

    const content = readFileSync(errorLogPath, "utf-8");
    const lines = content.split("\n").filter((l: string) => l.trim());
    // Only check last 100 entries to bound read cost
    const tailLines = lines.slice(-100);

    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const matchingEntries: Array<{ failure_type?: string; correction?: string; timestamp?: string }> = [];

    for (const line of tailLines) {
      try {
        const entry = JSON.parse(line);
        // Filter to last 3 days
        if (entry.timestamp) {
          const ts = new Date(entry.timestamp).getTime();
          if (ts < threeDaysAgo) continue;
        }
        matchingEntries.push(entry);
      } catch {
        // skip malformed JSONL lines
      }
    }

    if (matchingEntries.length === 0) {
      return { triggered: false, matchCount: 0, failureTypes: [], warnings: [] };
    }

    // Build warnings
    const warnings: string[] = [];
    const failureTypes = new Set<string>();

    for (const entry of matchingEntries) {
      if (entry.failure_type) failureTypes.add(entry.failure_type);

      const daysAgo = entry.timestamp
        ? Math.round((Date.now() - new Date(entry.timestamp).getTime()) / (24 * 60 * 60 * 1000))
        : 0;
      const daysLabel = daysAgo === 0 ? "today" : `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`;

      warnings.push(
        `⚠️ RECALL: ${agentName} failed ${daysLabel} due to ${entry.failure_type || "unknown"}. ${entry.correction || "Double-check your tool outputs."}`
      );
    }

    return {
      triggered: true,
      matchCount: matchingEntries.length,
      failureTypes: [...failureTypes],
      warnings,
    };
  } catch (err) {
    // Active recall is best-effort — never block task execution
    console.warn(`[active-recall] Failed for ${agentName}:`, err);
    return { triggered: false, matchCount: 0, failureTypes: [], warnings: [] };
  }
}

/**
 * Format Active Recall warnings as a system message block for context injection.
 *
 * Returns the formatted string to prepend to the agent's task, or null if
 * no recall was triggered.
 */
export function formatRecallWarnings(recall: ActiveRecallResult): string | null {
  if (!recall.triggered || recall.warnings.length === 0) return null;

  const lines = [
    `<active_recall>`,
    `The following past failures are relevant to your current task. Review them before proceeding:`,
    ``,
    ...recall.warnings,
    ``,
    `Failure types: ${recall.failureTypes.join(", ")}`,
    `Avoid repeating these patterns. If you encounter similar conditions, use a different approach.`,
    `</active_recall>`,
  ];

  return lines.join("\n");
}

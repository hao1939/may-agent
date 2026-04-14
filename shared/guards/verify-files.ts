/// <reference path="../../../src/lib/workflow-defs.d.ts" />
/**
 * verify-files guard — injects a JS verification step when files are written
 * without confirmation that they exist and have real content.
 *
 * Complements auto-test (which checks src/ changes) and build-check (which warns).
 * This guard catches:
 * - Files claimed as deliverables that don't exist on disk
 * - Empty files (0 bytes)
 * - Placeholder/stub content
 *
 * Emits a `warn` demand (not run_step) because the check is informational —
 * verification is already handled by verify-wrap and finish-guard at the
 * session level. This guard adds visibility at the workflow level.
 *
 * Cost tier: zero (pure JS, no LLM calls).
 */

import { existsSync, readFileSync, statSync } from "node:fs";

/** Patterns that indicate placeholder/stub content */
const PLACEHOLDER_PATTERNS = [
  /TODO[:\s]/i,
  /FIXME[:\s]/i,
  /XXX[:\s]/i,
  /\bplaceholder\b/i,
  /lorem ipsum/i,
  /insert .* here/i,
];

/**
 * Extract file paths from a task result by scanning for write/edit tool calls
 * and finish deliverables. Same logic as auto-test's getChangedFiles.
 */
function getWrittenFiles(result: {
  messages: any[];
  finishResult?: { deliverables?: Array<{ path: string }> };
}): string[] {
  const files = new Set<string>();

  for (const msg of result.messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (
        part.type === "toolCall" &&
        (part.name === "write" || part.name === "edit")
      ) {
        const p = part.arguments?.path;
        if (typeof p === "string") files.add(p);
      }
      if (part.type === "text" && typeof part.text === "string") {
        const m = part.text.match(/Wrote \d+ bytes to (\S+)/);
        if (m) files.add(m[1]);
        const e = part.text.match(/Edit applied to (\S+)/);
        if (e) files.add(e[1]);
      }
    }
  }

  if (result.finishResult?.deliverables) {
    for (const d of result.finishResult.deliverables) {
      if (typeof d.path === "string") files.add(d.path);
    }
  }

  return [...files];
}

interface FileIssue {
  path: string;
  issue: string;
}

/**
 * Check files for existence, non-empty, no placeholders.
 * Returns only files with problems.
 */
function checkFiles(paths: string[]): FileIssue[] {
  const issues: FileIssue[] = [];

  for (const filePath of paths) {
    // Skip non-existent files only if they look like deletions or read paths
    if (!existsSync(filePath)) {
      issues.push({ path: filePath, issue: "File does not exist" });
      continue;
    }

    try {
      const stat = statSync(filePath);
      if (stat.size === 0) {
        issues.push({ path: filePath, issue: "File is empty (0 bytes)" });
        continue;
      }

      const content = readFileSync(filePath, "utf-8");
      const trimmed = content.trim();
      if (trimmed.length < 10) {
        issues.push({
          path: filePath,
          issue: `File too short (${trimmed.length} chars after trim)`,
        });
        continue;
      }

      for (const pattern of PLACEHOLDER_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
          issues.push({
            path: filePath,
            issue: `Contains placeholder: "${match[0]}"`,
          });
          break;
        }
      }
    } catch (err: any) {
      issues.push({ path: filePath, issue: `Read error: ${err.message}` });
    }
  }

  return issues;
}

export const guard: WorkflowGuard = {
  name: "verify-files",
  events: ["step_done"],
  costTier: "zero",

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    // Only check agent steps, skip function steps and guard-injected steps
    if (event.source === "function") return [];
    if (event.step.startsWith("guard:")) return [];

    const files = getWrittenFiles(event.result);
    if (files.length === 0) return [];

    const issues = checkFiles(files);
    if (issues.length === 0) return [];

    // Separate hard failures (missing/empty) from soft warnings (placeholders)
    const hardFailures = issues.filter(
      (i) =>
        i.issue.includes("does not exist") ||
        i.issue.includes("empty") ||
        i.issue.includes("too short") ||
        i.issue.includes("Read error"),
    );
    const softWarnings = issues.filter(
      (i) => !hardFailures.includes(i),
    );

    const demands: Demand[] = [];

    // Hard failures get a block demand
    if (hardFailures.length > 0) {
      demands.push({
        type: "warn",
        reason:
          `File verification issues (${hardFailures.length} problem(s)):\n` +
          hardFailures.map((f) => `  - ${f.path}: ${f.issue}`).join("\n") +
          `\nFix these before proceeding.`,
      });
    }

    // Soft warnings are informational
    if (softWarnings.length > 0) {
      demands.push({
        type: "warn",
        reason:
          `File content notes:\n` +
          softWarnings.map((f) => `  - ${f.path}: ${f.issue}`).join("\n"),
      });
    }

    return demands;
  },
};

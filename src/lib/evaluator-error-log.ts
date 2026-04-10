/**
 * Structured error log extraction from evaluator results.
 *
 * Extracted from evaluator.ts (P5 refactoring).
 * Pure functions + I/O for writing structured error entries
 * to per-agent ERROR_LOG.jsonl files.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { TaskEvaluationResult, ChildSessionInfo } from "./evaluator.js";

// ── Error Code Extraction ──────────────────────────────────────────────

/** Extract FM-X.Y codes from an issue string. */
export function extractErrorCodes(issue: string): string[] {
  const matches = issue.match(/FM-\d+\.\d+/g);
  return matches ?? [];
}

/**
 * Parse an issue string into structured error log fields.
 *
 * Issue format: "[FM-X.Y / FC-X.Y][LABEL] Description text"
 * The text after the bracket tags is used as both trigger and critique.
 */
export function parseIssueToErrorEntry(
  issue: string,
  sessionId: string,
  date: string,
): Array<{ date: string; task_id: string; error_code: string; trigger: string; critique: string; correction: string }> {
  const codes = extractErrorCodes(issue);
  if (codes.length === 0) return [];

  // Extract the label (e.g., CONSTRAINT_MISMATCH) and the description
  const labelMatch = issue.match(/\]\s*\[([A-Z_]+)\]\s*(.*)/s);
  const label = labelMatch?.[1] ?? "";
  const description = (labelMatch?.[2] ?? issue).trim();

  // The critique is the full description; the correction is derived from it
  // The trigger is the label or first ~80 chars
  const trigger = label || description.slice(0, 80);
  const critique = description;

  // We can't auto-generate a correction from the issue text alone,
  // but we provide the critique as the directional signal
  const correction = "";

  return codes.map((code) => ({
    date,
    task_id: sessionId,
    error_code: code,
    trigger,
    critique,
    correction,
  }));
}

// ── Error Log Writing ──────────────────────────────────────────────────

/**
 * Append structured error log entries to agents/{agent}/ERROR_LOG.jsonl.
 *
 * Called after evaluation results are saved. Extracts FM-X.Y codes from
 * per-agent issues and writes them as JSONL entries per Bob's P109 brief.
 *
 * Schema (minimum): { timestamp, tool, error, critique, correction, context, state_snapshot }
 *
 * Notes:
 * - `tool` is not reliably inferable from scoring output, so we set it to "evaluator".
 * - `error` is a short human-readable summary (the issue label/trigger).
 * - `critique` / `correction` are required teaching fields.
 *
 * @see agents/bob/workspace/brief-structured-error-log.md
 */
export function appendErrorLogs(result: TaskEvaluationResult, children: ChildSessionInfo[]): void {
  const timestamp = new Date().toISOString();

  for (const child of children) {
    const agentScore = result.agents[child.sessionId];
    if (!agentScore) continue;

    const issues = agentScore.issues;
    if (!issues || issues.length === 0) continue;

    // Only log issues that contain FM codes (structured failures)
    const entries: Array<{
      timestamp: string;
      tool: string;
      error: string;
      critique: string;
      correction: string;
      context: string;
      state_snapshot: string;
    }> = [];

    for (const issue of issues) {
      // Keep existing FM-code parsing for gating (only structured failures).
      const parsed = parseIssueToErrorEntry(issue, child.sessionId, timestamp.slice(0, 10));
      if (parsed.length === 0) continue;

      // Extract label + description for critique/correction.
      const labelMatch = issue.match(/\]\s*\[([A-Z_]+)\]\s*(.*)/s);
      const label = labelMatch?.[1] ?? "";
      const description = (labelMatch?.[2] ?? issue).trim();

      // Bob's required fields
      const error = (label || description.slice(0, 120)).trim();
      const critique = description;
      const correction = ""; // evaluator model should fill; pipeline can't reliably infer

      for (const p of parsed) {
        entries.push({
          timestamp,
          tool: "evaluator",
          error: `${p.error_code}: ${error}`,
          critique,
          correction,
          context: child.sessionId,
          state_snapshot: "", // P123: optional Data-Flow context; populated by agents at call sites
        });
      }
    }

    if (entries.length === 0) continue;

    // Write to agents/{agent}/ERROR_LOG.jsonl as JSONL
    const errorLogPath = join("agents", child.agent, "ERROR_LOG.jsonl");

    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";

    try {
      mkdirSync(dirname(errorLogPath), { recursive: true });
      appendFileSync(errorLogPath, lines, "utf-8");
    } catch {
      // Non-critical — don't fail the evaluation if error log can't be written
    }
  }
}

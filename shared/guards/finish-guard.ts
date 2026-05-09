/// <reference path="../../types/workflow-defs.d.ts" />
/**
 * finish-guard — FM-3.4 Persistent-Task Enforcement.
 *
 * Blocks workflow steps that finish(success) when the task required
 * persistent-task workflow usage but the agent worked inline instead.
 *
 * Evidence: EXP-188 confirmed +100pp (0% → 100%) adoption with this guard.
 * Without it, agents read the instruction, work inline, and skip the workflow.
 *
 * Detection heuristic:
 * - Task contains "project:" pointing to a directory with project.md → required
 * - Task explicitly mentions persistent-task workflow → required
 * - Result messages contain workflow.run("persistent-task") call → satisfied
 *
 * Fail-open: only blocks finish(success). Other statuses pass through.
 */

/**
 * Check if the task text indicates persistent-task workflow is required.
 */
function isPersistentTaskRequired(taskText: string): boolean {
  if (!taskText) return false;
  const lower = taskText.toLowerCase();

  // Explicit workflow mention
  if (lower.includes('workflow.run("persistent-task"') ||
      lower.includes("workflow.run('persistent-task'") ||
      lower.includes('run the persistent-task workflow') ||
      lower.includes('use persistent-task workflow') ||
      lower.includes('must use persistent-task')) {
    return true;
  }

  // Task has a project: field pointing to a directory
  const projectMatch = taskText.match(/^project:\s*(.+)$/m);
  if (projectMatch) {
    const projectPath = projectMatch[1].trim();
    // Directory-style project references (not .md files) indicate persistent-task
    if (!projectPath.endsWith('.md') && (
      projectPath.includes('/projects/') ||
      projectPath.includes('/project.md') === false
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Check if persistent-task workflow was actually invoked during the step.
 * Scans messages for workflow.run tool calls with "persistent-task".
 */
function wasPersistentTaskRun(result: any): boolean {
  // Check messages for workflow tool calls
  for (const msg of result?.messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      // Check for workflow.run tool call
      if (part.type === "toolCall" && part.name === "workflow") {
        const args = part.arguments;
        if (args?.action === "run" && args?.name === "persistent-task") {
          return true;
        }
      }
      // Also check tool_use blocks (different message formats)
      if (part.type === "tool_use" && part.name === "workflow") {
        const input = part.input;
        if (input?.action === "run" && input?.name === "persistent-task") {
          return true;
        }
      }
    }
  }

  // Check the result text for evidence of persistent-task execution
  const text = result?.lastAssistantText ?? "";
  if (text.includes("persistent-task") && (
    text.includes("workflow.run") ||
    text.includes("workflow completed") ||
    text.includes("iterations"))) {
    return true;
  }

  return false;
}

// ── Types ──────────────────────────────────────────────────────────

export interface FinishDeliverable {
  path: string;
  description: string;
}

export interface FinishCallParams {
  status: string;
  deliverables?: FinishDeliverable[] | null;
  verification_evidence?: string[] | null;
}

export interface FinishValidationResult {
  valid: boolean;
  missing: string[];
}

export interface EvidenceValidationResult {
  valid: boolean;
  warnings: string[];
}

// ── FM-3.1: Deliverable validation ────────────────────────────────

import * as fs from "fs";
import * as path from "path";

/**
 * Return plausible on-disk locations for a declared deliverable path.
 *
 * The finish tool runs with project root `/app`, while agents often work inside
 * the `/app/agents` repository and naturally report paths such as
 * `shared/projects/x/project.md` or `arc/heartbeat.md`.  Treat those as
 * repo-relative aliases for `agents/shared/...` / `agents/arc/...` instead of
 * rejecting otherwise-real deliverables as ghosts.
 */
function deliverablePathCandidates(deliverablePath: string, rootDir: string): string[] {
  if (path.isAbsolute(deliverablePath)) return [deliverablePath];

  const normalized = deliverablePath.replace(/^\.\//, "").replace(/\/+/g, "/");
  const candidates = [path.join(rootDir, normalized)];

  if (!normalized.startsWith("agents/") && path.basename(rootDir) !== "agents") {
    const firstSegment = normalized.split("/")[0];
    if (firstSegment && fs.existsSync(path.join(rootDir, "agents", firstSegment))) {
      candidates.push(path.join(rootDir, "agents", normalized));
    }
  }

  return candidates;
}

/**
 * Validate that all declared deliverables exist on disk.
 * Returns a result object (non-throwing).
 */
export function validateFinishDeliverables(
  deliverables: FinishDeliverable[] | null | undefined,
  _status: string,
  rootDir: string,
): FinishValidationResult {
  if (!deliverables || deliverables.length === 0) {
    return { valid: true, missing: [] };
  }
  const missing: string[] = [];
  for (const d of deliverables) {
    const exists = deliverablePathCandidates(d.path, rootDir).some((candidate) => fs.existsSync(candidate));
    if (!exists) {
      missing.push(d.path);
    }
  }
  return { valid: missing.length === 0, missing };
}

/**
 * Throw if any declared deliverables don't exist (ghost deliverables).
 * Only enforced when status is "success".
 */
export function enforceFinishDeliverables(
  deliverables: FinishDeliverable[] | null | undefined,
  status: string,
  rootDir: string,
): void {
  if (status !== "success") return;
  const result = validateFinishDeliverables(deliverables, status, rootDir);
  if (!result.valid) {
    throw new Error(
      `Ghost deliverables — files declared but not found: ${result.missing.join(", ")}`,
    );
  }
}

// ── FM-3.3: Verification evidence validation ──────────────────────

/**
 * Validate that finish(success) includes verification evidence.
 * Returns a result object (non-throwing).
 */
export function validateVerificationEvidence(
  params: FinishCallParams,
): EvidenceValidationResult {
  const warnings: string[] = [];
  if (params.status === "success") {
    if (!params.verification_evidence || params.verification_evidence.length === 0) {
      warnings.push("finish(success) has no verification_evidence — add tool-output references proving deliverables work.");
    }
  }
  return { valid: warnings.length === 0, warnings };
}

/**
 * Enforce verification evidence. Returns warnings (non-throwing).
 */
export function enforceVerificationEvidence(
  params: FinishCallParams,
): string[] {
  return validateVerificationEvidence(params).warnings;
}

export const guard: WorkflowGuard = {
  name: "finish-guard",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];

    const finishResult = event.result?.finishResult;

    // Only gate finish(success) — other statuses are legitimate
    if (!finishResult || finishResult.status !== "success") return [];

    // Get the task text from the event
    const taskText = (event as any).task ?? event.step ?? "";

    // Check if persistent-task was required
    if (!isPersistentTaskRequired(taskText)) return [];

    // Check if persistent-task was actually run
    if (wasPersistentTaskRun(event.result)) return [];

    // Persistent-task was required but not run — block
    return [{
      type: "block",
      reason:
        "FM-3.4 Persistent-Task Required: This task required the persistent-task " +
        "workflow but it was never invoked. The agent must use " +
        'workflow.run("persistent-task", "project: <path>\\ngoal: <goal>") ' +
        "instead of working inline. Do NOT do the work directly — run the workflow.",
    }];
  },
};

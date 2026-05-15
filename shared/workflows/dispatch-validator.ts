/**
 * Dispatch Validator — Pre-flight checks before scheduling project workflows.
 * 
 * Addresses the workflow-reliability finding that many workflow runs errored
 * before starting because they targeted non-existent or non-dispatchable
 * projects. This module provides validation functions to check before
 * dispatching.
 */

import { existsSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { extractField } from "./project-helpers.ts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  projectDir?: string;
  status?: string;
}

/**
 * Parse project directory from a task string like "project: projects/foo"
 */
export function parseProjectDir(task: string | undefined): string | null {
  if (!task) return null;
  const match = task.match(/project:\s*(\S+)/);
  return match ? match[1] : null;
}

/**
 * Check if a project is in a dispatchable state.
 * Returns validation result with errors/warnings.
 */
export function validateDispatch(
  task: string | undefined,
  projectRoot: string
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  // 1. Parse project path from task
  const relPath = parseProjectDir(task);
  if (!relPath) {
    result.valid = false;
    result.errors.push("No project path found in task. Expected: 'project: <path>'");
    return result;
  }

  // 2. Resolve and check project directory exists
  const projectDir = resolve(projectRoot, relPath);
  result.projectDir = projectDir;

  if (!existsSync(projectDir)) {
    result.valid = false;
    result.errors.push(`Project directory does not exist: ${projectDir}`);
    return result;
  }

  // 3. Check project.md exists
  const projectFile = join(projectDir, "project.md");
  if (!existsSync(projectFile)) {
    result.valid = false;
    result.errors.push(`No project.md found at: ${projectFile}`);
    return result;
  }

  // 4. Read project.md and check status
  try {
    const content = readFileSync(projectFile, "utf-8");
    const status = (extractField(content, "Status") || "unknown").toLowerCase();
    result.status = status;

    const nonDispatchable = ["closed", "paused", "cancelled", "blocked", "waiting"];
    if (nonDispatchable.includes(status)) {
      result.valid = false;
      result.errors.push(`Project status is '${status}' — not dispatchable`);
    }

    // Check for stop reason
    const stopReason = extractField(content, "Stop Reason");
    if (stopReason) {
      result.warnings.push(`Project has stop reason: ${stopReason}`);
      // If there's a stop reason and status isn't active, don't dispatch
      if (status !== "active") {
        result.valid = false;
        result.errors.push(`Project stopped: ${stopReason}`);
      }
    }

    // Check iteration cap — hard block at 50 iterations
    const iterationValue = extractField(content, "Iteration");
    if (iterationValue) {
      const iteration = parseInt(iterationValue);
      if (iteration >= 50) {
        result.valid = false;
        result.errors.push(`Project at iteration ${iteration} — exceeded safety cap of 50. Must be manually reviewed.`);
      }
    }

    // Check for "done" and "complete" keywords with non-active-like statuses
    const nonDispatchableStatuses = ["done", "complete", "completed"];
    if (nonDispatchableStatuses.includes(status)) {
      result.valid = false;
      result.errors.push(`Project status is '${status}' — not dispatchable`);
    }
  } catch (e) {
    result.valid = false;
    result.errors.push(`Failed to read project.md: ${(e as Error).message}`);
  }

  return result;
}

/**
 * Quick check: is this task dispatchable? Returns true/false.
 */
export function isDispatchable(task: string | undefined, projectRoot: string): boolean {
  return validateDispatch(task, projectRoot).valid;
}

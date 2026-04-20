/**
 * Finish Guard — C1.5 Ghost Deliverable Enforcement (FM-3.1).
 *
 * Validates that every deliverable path in a finish() call exists on disk.
 * Throws a hard error if any are missing, forcing the agent to either
 * write the file or remove it from the deliverables list.
 *
 * Integration: Import `validateFinishDeliverables()` in the finish tool
 * handler (manager.ts) and call it before returning success.
 *
 * Uses only Node.js built-in modules — no external dependencies.
 */

import { existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";

// ── Interfaces ────────────────────────────────────────────────────────

/** A deliverable declared in a finish() call. */
export interface FinishDeliverable {
  path: string;
  description?: string;
}

/** Parameters for finish() call validation. */
export interface FinishCallParams {
  status: string;
  deliverables?: FinishDeliverable[] | null;
  verification_evidence?: string[] | null;
  summary?: string;
}

/** Result of the ghost-deliverable validation. */
export interface FinishValidationResult {
  /** `true` when all deliverables exist on disk. */
  valid: boolean;
  /** Paths that were validated and exist. */
  existingPaths: string[];
  /** Paths that were declared but don't exist on disk. */
  missingPaths: string[];
  /** Human-readable error message (present only when `valid === false`). */
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────

/** Default project root used to resolve relative paths. */
const DEFAULT_PROJECT_ROOT = "/app";

/** Statuses that require deliverable validation. */
const STATUSES_REQUIRING_VALIDATION = new Set(["success", "partial"]);

// ── Public API ────────────────────────────────────────────────────────

/**
 * Validate that all declared deliverables exist on disk.
 *
 * @param deliverables  Array of deliverable objects from the finish() call.
 * @param status        The finish status (only "success" and "partial" are validated).
 * @param projectRoot   Root directory for resolving relative paths (default: `/app`).
 * @returns A {@link FinishValidationResult} describing which paths are valid/missing.
 *
 * @example
 * ```ts
 * const result = validateFinishDeliverables(
 *   [{ path: "src/foo.ts", description: "New module" }],
 *   "success"
 * );
 * if (!result.valid) throw new Error(result.error);
 * ```
 */
export function validateFinishDeliverables(
  deliverables: FinishDeliverable[] | undefined | null,
  status: string,
  projectRoot: string = DEFAULT_PROJECT_ROOT,
): FinishValidationResult {
  // Only validate for success/partial — failure/blocked may legitimately have no files
  if (!STATUSES_REQUIRING_VALIDATION.has(status)) {
    return { valid: true, existingPaths: [], missingPaths: [] };
  }

  // No deliverables declared — nothing to validate
  if (!deliverables || deliverables.length === 0) {
    return { valid: true, existingPaths: [], missingPaths: [] };
  }

  const existingPaths: string[] = [];
  const missingPaths: string[] = [];

  for (const deliverable of deliverables) {
    const rawPath = deliverable.path;

    if (!rawPath || typeof rawPath !== "string" || rawPath.trim() === "") {
      missingPaths.push(rawPath || "(empty path)");
      continue;
    }

    // Normalize: resolve relative paths against project root
    const resolvedPath = isAbsolute(rawPath)
      ? rawPath
      : resolve(projectRoot, rawPath);

    if (existsSync(resolvedPath)) {
      existingPaths.push(rawPath);
    } else {
      missingPaths.push(rawPath);
    }
  }

  if (missingPaths.length === 0) {
    return { valid: true, existingPaths, missingPaths: [] };
  }

  const missingList = missingPaths.map((p) => `'${p}'`).join(", ");
  const error =
    `FM-3.1 Ghost Deliverable: The following file(s) do not exist on disk: ${missingList}. ` +
    `You cannot claim them as deliverables. Write the file(s) or remove them from the deliverables list.`;

  return { valid: false, existingPaths, missingPaths, error };
}

/**
 * Convenience wrapper that throws on validation failure.
 * Designed to be called directly in the finish tool handler.
 *
 * @param deliverables  Array of deliverable objects from the finish() call.
 * @param status        The finish status.
 * @param projectRoot   Root directory for resolving relative paths.
 * @throws Error with FM-3.1 message if any deliverables are missing.
 */
export function enforceFinishDeliverables(
  deliverables: FinishDeliverable[] | undefined | null,
  status: string,
  projectRoot: string = DEFAULT_PROJECT_ROOT,
): void {
  const result = validateFinishDeliverables(deliverables, status, projectRoot);
  if (!result.valid) {
    throw new Error(result.error);
  }
}

// ── FM-3.3 Verification Evidence Validation ───────────────────────────

/** Keywords that suggest fabricated evidence when not from real tool output. */
const GHOST_KEYWORDS = /\b(SYNTAX OK|TSC OK|ALL TESTS PASS(ED)?|BUILD SUCCEEDED|0 errors?|✓ all|LGTM|no issues found)\b/i;

/** Result of verification_evidence validation. */
export interface EvidenceValidationResult {
  valid: boolean;
  warnings: string[];
  error?: string;
}

/**
 * Validate that finish(success) includes verification_evidence and that
 * entries don't contain known fabrication patterns.
 *
 * Rules:
 * 1. finish(success) with deliverables MUST include at least one verification_evidence entry.
 * 2. Evidence entries must not be suspiciously short (< 15 chars).
 * 3. Evidence entries must not match known ghost-keyword patterns (FM-3.3).
 *
 * @param params  The finish() call parameters.
 * @returns An {@link EvidenceValidationResult}.
 */
export function validateVerificationEvidence(
  params: FinishCallParams,
): EvidenceValidationResult {
  const { status, deliverables, verification_evidence } = params;
  const warnings: string[] = [];

  // Only validate success status with deliverables
  if (status !== "success") {
    return { valid: true, warnings };
  }

  const hasDeliverables = deliverables && deliverables.length > 0;
  if (!hasDeliverables) {
    return { valid: true, warnings };
  }

  // Rule 1: Must have verification_evidence
  if (!verification_evidence || verification_evidence.length === 0) {
    return {
      valid: false,
      warnings,
      error:
        "FM-3.3 Missing Verification Evidence: finish(success) with deliverables " +
        "must include at least one verification_evidence entry citing a real tool " +
        "output (e.g., 'Step 12: bun test exit code 0'). Add verification_evidence " +
        "or change status to partial.",
    };
  }

  // Rule 2 & 3: Check each entry for quality
  for (const entry of verification_evidence) {
    if (typeof entry !== "string") continue;

    if (entry.trim().length < 15) {
      warnings.push(
        `Suspiciously short evidence entry: '${entry}'. ` +
        `Evidence should reference specific tool output.`,
      );
    }

    const ghostMatch = entry.match(GHOST_KEYWORDS);
    if (ghostMatch) {
      warnings.push(
        `FM-3.3 Possible fabricated evidence: '${ghostMatch[0]}' in entry '${entry}'. ` +
        `Cite the actual tool output verbatim instead of summarizing.`,
      );
    }
  }

  // Warnings are advisory, not blocking (to avoid false positives on legitimate summaries)
  return { valid: true, warnings };
}

/**
 * Convenience wrapper that throws when verification evidence is missing.
 * Warnings are returned but do not cause a throw.
 *
 * @param params  The finish() call parameters.
 * @returns Array of warning strings (may be empty).
 * @throws Error with FM-3.3 message if evidence is required but missing.
 */
export function enforceVerificationEvidence(
  params: FinishCallParams,
): string[] {
  const result = validateVerificationEvidence(params);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return result.warnings;
}

// ── FM-3.4 Persistent-Task Enforcement (Gate 3) ──────────────────────

/** Parameters for persistent-task enforcement validation. */
export interface PersistentTaskEnforcementParams {
  /** The finish() call status. */
  status: string;
  /** Whether persistent-task workflow was required for this session. */
  persistentTaskRequired: boolean;
  /** Workflow names that were actually run during this session. */
  workflowsRan?: string[];
}

/** Result of persistent-task enforcement validation. */
export interface PersistentTaskValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Gate 3: Validate that the persistent-task workflow was actually invoked
 * when it was required for the session.
 *
 * Only blocks finish(success) — other statuses pass through since the agent
 * may legitimately be reporting failure/blocked without running the workflow.
 *
 * Fail-open: if `persistentTaskRequired` is false or undefined, always passes.
 *
 * @param params  Enforcement check parameters.
 * @returns A {@link PersistentTaskValidationResult}.
 */
export function validatePersistentTaskEnforcement(
  params: PersistentTaskEnforcementParams,
): PersistentTaskValidationResult {
  const { status, persistentTaskRequired, workflowsRan } = params;

  // Only gate success — other statuses are legitimate without the workflow
  if (status !== "success") {
    return { valid: true };
  }

  // Fail-open: if not required, pass
  if (!persistentTaskRequired) {
    return { valid: true };
  }

  // Check if persistent-task was among the workflows that ran
  const ran = Array.isArray(workflowsRan) &&
    workflowsRan.includes("persistent-task");

  if (ran) {
    return { valid: true };
  }

  return {
    valid: false,
    error:
      "FM-3.4 Persistent-Task Required: This session required the persistent-task " +
      "workflow but it was never invoked. You must use " +
      'workflow.run("persistent-task", "project: <path>\\ngoal: <goal>") ' +
      "instead of working inline. Do NOT do the work directly — run the workflow.",
  };
}

/**
 * Convenience wrapper that throws on persistent-task enforcement failure.
 *
 * @param params  Enforcement check parameters.
 * @throws Error with FM-3.4 message if persistent-task was required but not used.
 */
export function enforcePersistentTask(
  params: PersistentTaskEnforcementParams,
): void {
  const result = validatePersistentTaskEnforcement(params);
  if (!result.valid) {
    throw new Error(result.error);
  }
}

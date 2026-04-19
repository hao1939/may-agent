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

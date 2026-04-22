/**
 * finish-guard.ts — FM-3.1 Ghost Deliverable & FM-3.3 Verification Evidence enforcement.
 *
 * Validates finish() calls at the tool level:
 * - FM-3.1: Deliverables listed in finish() must exist on disk
 * - FM-3.3: Success with deliverables requires verification_evidence
 *
 * These are called by the agent runtime before accepting a finish() call.
 */

import { existsSync } from "node:fs";
import { join, isAbsolute } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

export interface FinishDeliverable {
  path: string;
  description?: string;
}

export interface FinishCallParams {
  status: string;
  deliverables?: FinishDeliverable[] | null;
  verification_evidence?: string[];
}

export interface FinishValidationResult {
  valid: boolean;
  existingPaths: string[];
  missingPaths: string[];
  error?: string;
}

export interface EvidenceValidationResult {
  valid: boolean;
  warnings: string[];
  error?: string;
}

// ── Ghost keyword patterns (FM-3.3) ───────────────────────────────────
// These phrases often appear in confabulated verification evidence —
// the agent claims tests pass without actually running them.

const GHOST_KEYWORDS = [
  /TSC OK/i,
  /no type errors/i,
  /ALL TESTS PASSED/i,
  /SYNTAX OK/i,
  /BUILD SUCCESS/i,
  /COMPILATION SUCCESSFUL/i,
];

// ── FM-3.1: Deliverable Validation ────────────────────────────────────

/**
 * Validate that all listed deliverables exist on disk.
 * Only enforced for "success" and "partial" statuses.
 */
export function validateFinishDeliverables(
  deliverables: FinishDeliverable[] | null | undefined,
  status: string,
  rootDir: string,
): FinishValidationResult {
  // Skip validation for failure/blocked
  if (status === "failure" || status === "blocked") {
    return { valid: true, existingPaths: [], missingPaths: [] };
  }

  // No deliverables = nothing to validate
  if (!deliverables || deliverables.length === 0) {
    return { valid: true, existingPaths: [], missingPaths: [] };
  }

  const existingPaths: string[] = [];
  const missingPaths: string[] = [];

  for (const d of deliverables) {
    const p = d.path;
    if (!p) {
      missingPaths.push("(empty path)");
      continue;
    }

    const fullPath = isAbsolute(p) ? p : join(rootDir, p);
    if (existsSync(fullPath)) {
      existingPaths.push(p);
    } else {
      missingPaths.push(p);
    }
  }

  if (missingPaths.length > 0) {
    return {
      valid: false,
      existingPaths,
      missingPaths,
      error:
        `FM-3.1 Ghost Deliverable: ${missingPaths.length} deliverable(s) do not exist on disk: ` +
        missingPaths.join(", ") +
        ". Remove them from deliverables or create the files first.",
    };
  }

  return { valid: true, existingPaths, missingPaths: [] };
}

/**
 * Throwing version of validateFinishDeliverables.
 */
export function enforceFinishDeliverables(
  deliverables: FinishDeliverable[] | null | undefined,
  status: string,
  rootDir: string,
): void {
  const result = validateFinishDeliverables(deliverables, status, rootDir);
  if (!result.valid) {
    throw new Error(result.error);
  }
}

// ── FM-3.3: Verification Evidence Validation ──────────────────────────

/**
 * Validate verification_evidence in a finish() call.
 * - Success + deliverables requires non-empty evidence
 * - Warns on suspiciously short or ghost-keyword evidence
 */
export function validateVerificationEvidence(
  params: FinishCallParams,
): EvidenceValidationResult {
  const { status, deliverables, verification_evidence } = params;

  // Only enforce for success with deliverables
  if (status !== "success") {
    return { valid: true, warnings: [] };
  }
  if (!deliverables || deliverables.length === 0) {
    return { valid: true, warnings: [] };
  }

  // Must have evidence
  if (!verification_evidence || verification_evidence.length === 0) {
    return {
      valid: false,
      warnings: [],
      error:
        "FM-3.3 Verification Evidence Required: finish(success) with deliverables " +
        "requires verification_evidence. Cite specific tool outputs that prove your work " +
        '(e.g., "Step 12: bash(bun test) showed 15 tests pass").',
    };
  }

  // Check for suspicious patterns
  const warnings: string[] = [];

  for (const entry of verification_evidence) {
    // Suspiciously short
    if (entry.length < 20) {
      warnings.push(
        `Suspiciously short verification evidence: "${entry}". ` +
        "Include step number and specific tool output.",
      );
    }

    // Ghost keywords — phrases that sound like verification but are often confabulated
    for (const pattern of GHOST_KEYWORDS) {
      if (pattern.test(entry)) {
        warnings.push(
          `FM-3.3 Warning: Evidence "${entry.substring(0, 60)}" matches ghost keyword pattern. ` +
          "Ensure this references an actual tool output, not a summary.",
        );
        break; // One warning per entry
      }
    }
  }

  return { valid: true, warnings };
}

/**
 * Throwing version of validateVerificationEvidence.
 * Returns warnings array (may be non-empty even on success).
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

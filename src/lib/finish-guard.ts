/**
 * Finish Guard — FM-3.1 Ghost Deliverable + FM-3.3 Verification Evidence enforcement.
 *
 * Validates that finish(success) calls have real deliverables (files exist on disk)
 * and meaningful verification evidence (not ghost phrases).
 */

import { existsSync } from "node:fs";
import { join, isAbsolute } from "node:path";

// ── Types ─────────────────────────────────────────────────────────────

export interface FinishDeliverable {
  path: string;
  description?: string;
}

export interface FinishCallParams {
  status: string;
  deliverables?: FinishDeliverable[] | null;
  verification_evidence?: string[] | null;
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

// ── Ghost keyword patterns (FM-3.3) ──────────────────────────────────

const GHOST_PATTERNS = [
  /\bTSC OK\b/i,
  /\bSYNTAX OK\b/i,
  /\bALL TESTS PASSED\b/i,
  /\bNO (?:TYPE )?ERRORS?\b/i,
  /\bBUILD (?:SUCCESS|OK)\b/i,
];

// ── FM-3.1: Ghost Deliverable Validation ──────────────────────────────

/**
 * Validate that all declared deliverables exist on disk.
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

  // No deliverables declared — valid (nothing to check)
  if (!deliverables || deliverables.length === 0) {
    return { valid: true, existingPaths: [], missingPaths: [] };
  }

  const existingPaths: string[] = [];
  const missingPaths: string[] = [];

  for (const d of deliverables) {
    const p = d.path;
    if (!p || p.trim() === "") {
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
      error: `FM-3.1 Ghost Deliverable: ${missingPaths.length} file(s) declared but missing: ${missingPaths.join(", ")}`,
    };
  }

  return { valid: true, existingPaths, missingPaths: [] };
}

/**
 * Throws if deliverables are missing (for use in guards that should block).
 */
export function enforceFinishDeliverables(
  deliverables: FinishDeliverable[] | null | undefined,
  status: string,
  rootDir: string,
): void {
  const result = validateFinishDeliverables(deliverables, status, rootDir);
  if (!result.valid && result.error) {
    throw new Error(result.error);
  }
}

// ── FM-3.3: Verification Evidence Validation ──────────────────────────

/**
 * Validate that finish(success) with deliverables includes meaningful evidence.
 */
export function validateVerificationEvidence(
  params: FinishCallParams,
): EvidenceValidationResult {
  // Only enforce for success with deliverables
  if (params.status !== "success") {
    return { valid: true, warnings: [] };
  }

  if (!params.deliverables || params.deliverables.length === 0) {
    return { valid: true, warnings: [] };
  }

  // Must have evidence
  if (!params.verification_evidence || params.verification_evidence.length === 0) {
    return {
      valid: false,
      warnings: [],
      error: "FM-3.3 Missing Verification Evidence: finish(success) with deliverables requires verification_evidence[].",
    };
  }

  // Check evidence quality
  const warnings: string[] = [];
  for (const ev of params.verification_evidence) {
    // Warn on suspiciously short evidence
    if (ev.length < 20) {
      warnings.push(`FM-3.3 Suspiciously short evidence: "${ev}" — include specific tool output references.`);
    }

    // Warn on ghost keyword patterns
    for (const pattern of GHOST_PATTERNS) {
      if (pattern.test(ev)) {
        warnings.push(`FM-3.3 Ghost keyword in evidence: "${ev}" — cite specific step numbers and outputs.`);
        break;
      }
    }
  }

  return { valid: true, warnings };
}

/**
 * Throws if evidence is missing. Returns warnings for suspicious evidence.
 */
export function enforceVerificationEvidence(params: FinishCallParams): string[] {
  const result = validateVerificationEvidence(params);
  if (!result.valid && result.error) {
    throw new Error(result.error);
  }
  return result.warnings;
}

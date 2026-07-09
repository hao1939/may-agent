import type { SpecLoopSpecState } from "./spec-loop-store.ts";

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizedDisposition(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/_/g, "-")
    : "";
}

export function specLoopSpecHasStructuredSuccessor(
  spec: SpecLoopSpecState | undefined,
): boolean {
  if (!spec) return false;
  const record = spec as SpecLoopSpecState & {
    successorDisposition?: unknown;
    resumeCondition?: unknown;
  };
  if (
    typeof record.successorDisposition === "string" &&
    record.successorDisposition.trim()
  ) {
    return true;
  }
  if (
    typeof record.resumeCondition === "string" &&
    record.resumeCondition.trim()
  ) {
    return true;
  }
  return !!spec.review && typeof spec.review === "object";
}

function selfRepresentingDisposition(disposition: string): boolean {
  if (!disposition) return false;

  const exactAllow = new Set([
    "repaired-ready-residue-no-new-leaf",
    "accepted-explicit-narrowing-source-only",
    "combined-boundary-nonlive-split-required",
    "blocked-hypothesis-nonlive-hold",
    "reviewed-negative-create-stage-contract",
    "reviewed-product-behavior-mismatch",
    "source-grounded-nonlive-hold",
    "intentional-lineage-only-nonlive",
    "reviewed-source-mismatch-no-unchanged-rerun",
    "reviewed-nonlive-source-grounded-wait",
    "environment-blocker-node-subnet-http409-before-product-assertion",
    "environment-setup-blocker-node-subnet-http409-before-product-assertion",
  ]);
  if (exactAllow.has(disposition)) return true;

  const negativeFragments = [
    "-wait",
    "wait-",
    "wait",
    "blocker",
    "artifact-review",
    "review-pending",
    "pending-followup",
    "queued",
    "return",
    "rerun-candidate",
    "await-artifact-review",
  ];
  if (negativeFragments.some((fragment) => disposition.includes(fragment))) {
    return false;
  }

  const positiveFragments = [
    "no-new-leaf",
    "source-only",
    "nonlive",
    "split-required",
    "behavior-mismatch",
    "negative-create-stage-contract",
    "lineage-only",
    "source-mismatch-no-unchanged-rerun",
  ];
  return positiveFragments.some((fragment) => disposition.includes(fragment));
}

export function specStateSelfRepresentsExactFrontier(
  spec: SpecLoopSpecState | undefined,
): boolean {
  if (!spec || !specLoopSpecHasStructuredSuccessor(spec)) return false;
  const record = spec as Record<string, unknown>;
  if (record.terminalDisposition === true) return true;
  if (
    typeof record.successorRunId === "string" &&
    record.successorRunId.trim()
  ) {
    return true;
  }

  const disposition = normalizedDisposition(record.successorDisposition);
  if (selfRepresentingDisposition(disposition)) return true;

  const review = recordValue(spec.review);
  if (!review) return false;
  const acceptedStatus = normalizedDisposition(review.acceptedStatus);
  return Boolean(
    acceptedStatus === "pass" &&
    typeof review.acceptedRunId === "string" &&
    review.acceptedRunId.trim(),
  );
}

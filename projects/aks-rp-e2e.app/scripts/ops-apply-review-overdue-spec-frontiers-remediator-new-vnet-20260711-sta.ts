import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;

const specId = "spec.remediator.node-not-ready-restart";
const liveTaskId =
  "hold-spec-remediator-node-not-ready-restart-runtime-nonpass-frontier-20260707c";
const reviewEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-review-overdue-spec-frontiers-remediator-new-vnet-20260711.md";
const refreshedResumeCondition =
  "Resume only when a meaningful remediator runtime/product change, an accepted source-backed contract reclassification, or deeper same-run diagnosis from the preserved witness lineage materially changes the expected outcome.";
const reviewedAt = "2026-07-11T15:07:16.803Z";

const previous = specState.specs[specId];
if (!previous) {
  throw new Error(`Missing spec-loop row for ${specId}`);
}

const previousReview =
  previous.review && typeof previous.review === "object" && !Array.isArray(previous.review)
    ? (previous.review as Record<string, unknown>)
    : {};

updateSpecLoopSpec(specState, specId, {
  taskId: liveTaskId,
  successorEvidencePath: reviewEvidencePath,
  successorStateReason:
    "Fresh 2026-07-11 overdue blocked-frontier review revalidated the same-path remediator runtime/product nonpass lineage and confirmed the live exact holder remains hold-spec-remediator-node-not-ready-restart-runtime-nonpass-frontier-20260707c rather than the stale ...20260707b pointer.",
  resumeCondition: refreshedResumeCondition,
  review: {
    ...previousReview,
    lastAction:
      "Keep pending; preserve the exact same-path remediator runtime/product nonpass holder hold-spec-remediator-node-not-ready-restart-runtime-nonpass-frontier-20260707c and do not rerun unchanged until a meaningful remediator runtime/product/source signal changes the expected outcome.",
    reviewedAt,
    pendingReviewTaskId: liveTaskId,
  },
});

saveSpecLoopState(specStatePath, specState);

console.log(
  JSON.stringify(
    {
      specId,
      specStatePath,
      before: {
        taskId: previous.taskId ?? null,
        successorEvidencePath: previous.successorEvidencePath ?? null,
        resumeCondition: previous.resumeCondition ?? null,
        pendingReviewTaskId:
          previousReview && typeof previousReview.pendingReviewTaskId === "string"
            ? previousReview.pendingReviewTaskId
            : null,
      },
      after: {
        taskId: specState.specs[specId]?.taskId ?? null,
        successorEvidencePath: specState.specs[specId]?.successorEvidencePath ?? null,
        resumeCondition: specState.specs[specId]?.resumeCondition ?? null,
        pendingReviewTaskId:
          specState.specs[specId]?.review &&
          typeof specState.specs[specId]?.review?.pendingReviewTaskId === "string"
            ? (specState.specs[specId]?.review?.pendingReviewTaskId as string)
            : null,
      },
    },
    null,
    2,
  ),
);

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

type ReviewRecord = Record<string, unknown>;

type Repair = {
  specId: string;
  expectedTaskId: string | null;
  expectedPendingReviewTaskId?: string | null;
  targetTaskId: string;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const statePath = defaultSpecLoopStatePath(appDir);
const state = JSON.parse(readFileSync(statePath, "utf-8")) as SpecLoopState;

const repairs: Repair[] = [
  {
    specId: "spec.windows.runner-pipeline-harness-virtualmachines",
    expectedTaskId: null,
    expectedPendingReviewTaskId: null,
    targetTaskId: "wait-windows-nonlive-carriers-authoring-or-source-change-20260702",
  },
  {
    specId: "spec.private-cluster.vnet-integration-update-private",
    expectedTaskId: "verify-spec-private-cluster-vnet-integration-update-private",
    expectedPendingReviewTaskId: "verify-spec-private-cluster-vnet-integration-update-private",
    targetTaskId:
      "hold-spec-private-cluster-update-private-empty-aggregate-result-contract-frontier-20260711",
  },
  {
    specId: "spec.node-ephemeral-disk.resource-placement",
    expectedTaskId: "hold-spec-loop-pending-node-ephemeral-disk-resourcedisk-authority-20260704",
    expectedPendingReviewTaskId:
      "hold-spec-loop-pending-node-ephemeral-disk-resourcedisk-authority-20260704",
    targetTaskId: "hold-spec-loop-pending-node-ephemeral-disk-explicit-resourcedisk-contract-20260706",
  },
];

const results = repairs.map((repair) => {
  const current = state.specs[repair.specId];
  if (!current) {
    throw new Error(`Spec not found in state: ${repair.specId}`);
  }

  const review: ReviewRecord =
    current.review && typeof current.review === "object" && !Array.isArray(current.review)
      ? { ...(current.review as ReviewRecord) }
      : {};

  const before = {
    taskId: current.taskId ?? null,
    pendingReviewTaskId:
      typeof review.pendingReviewTaskId === "string"
        ? review.pendingReviewTaskId
        : null,
  };

  if (before.taskId !== repair.expectedTaskId) {
    throw new Error(
      `Unexpected current taskId for ${repair.specId}: ${before.taskId} (expected ${repair.expectedTaskId})`,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(repair, "expectedPendingReviewTaskId") &&
    before.pendingReviewTaskId !== repair.expectedPendingReviewTaskId
  ) {
    throw new Error(
      `Unexpected current review.pendingReviewTaskId for ${repair.specId}: ${before.pendingReviewTaskId} (expected ${repair.expectedPendingReviewTaskId})`,
    );
  }

  if (repair.expectedPendingReviewTaskId !== undefined) {
    if (repair.expectedPendingReviewTaskId === null) {
      delete review.pendingReviewTaskId;
    } else {
      review.pendingReviewTaskId = repair.targetTaskId;
    }
  }

  updateSpecLoopSpec(state, repair.specId, {
    taskId: repair.targetTaskId,
    review: Object.keys(review).length > 0 ? review : undefined,
  });

  const after = state.specs[repair.specId];
  return {
    specId: repair.specId,
    expectedTaskId: repair.expectedTaskId,
    expectedPendingReviewTaskId: repair.expectedPendingReviewTaskId ?? null,
    targetTaskId: repair.targetTaskId,
    before,
    after: {
      taskId: after?.taskId ?? null,
      pendingReviewTaskId:
        after?.review &&
        typeof after.review === "object" &&
        !Array.isArray(after.review) &&
        typeof (after.review as ReviewRecord).pendingReviewTaskId === "string"
          ? ((after.review as ReviewRecord).pendingReviewTaskId as string)
          : null,
      updatedAt: after?.updatedAt ?? null,
    },
  };
});

saveSpecLoopState(statePath, state);

console.log(
  JSON.stringify(
    {
      attempt:
        "a_ops-apply-review-overdue-spec-frontier-gap-families-wave-20260712_20260712190334",
      statePath,
      repairs: results,
    },
    null,
    2,
  ),
);

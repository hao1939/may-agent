import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";

type JsonRecord = Record<string, unknown>;

const attemptId =
  "a_ops-apply-reconcile-open-runtime-escalation-resume-hygiene-20260716-state-repair_20260716221741";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const specLoopTaskId = "aks-spec-verification-loop";
const specLoopMirrorPath = resolve(projectDir, ".state/spec-loop/state.json");
const memoPath =
  "evidence/archive/ops-apply-reconcile-open-runtime-escalation-resume-hygiene-20260716-state-repair.md";
const memoAbsolute = resolve(appDir, memoPath);
const duplicateSuppressionKey =
  "aks-rp-e2e.app:escalation-hygiene:current-unpublished-blank-runtime-resume";

const preflight = {
  specId: "spec.rp-cluster-lifecycle.preflight-validation",
  staleTaskId: "wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result",
  carrierTaskId: "ops/reconcile-current-preflight-validation-active-carrier-20260716",
  evidencePath:
    "/app/projects/aks-rp-e2e/evidence/archive/ops-reconcile-current-preflight-validation-active-carrier-20260716.md",
  requestedAction:
    "Apply the exact project.task.completed collapse for the false duplicate wait on already-succeeded run 172540314, or replace it with one truthful current wait only if new contrary evidence appears.",
  resumeCondition:
    "Resume only against review task ops/reconcile-current-preflight-validation-active-carrier-20260716. The older preflight carrier already returned/closed and the accepted isolated-origin/dev rerun is terminal; the only remaining open question is whether planner applies the exact collapse proposal for run 172540314.",
  watchCondition:
    "Project planner re-checks this review task on the next planning wake or immediately when its state/result changes from the current review memo.",
  fallbackCondition:
    "If this task is still in review by 2026-07-17T18:00:00Z without an applied collapse or explicit rejection, refresh one exact successor applying/reviewing that collapse rather than reopening the old preflight carrier or queuing a new run.",
  successorDisposition: "duplicate-terminal-wait-collapse-review",
  successorStateReason:
    "Accepted 2026-07-16 reconciliation shows run 172540314 was already terminal/succeeded before wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result was created, so the truthful current open lineage is the app-ops review carrier ops/reconcile-current-preflight-validation-active-carrier-20260716 until planner applies the exact collapse for that false duplicate wait.",
  pendingReviewReason:
    "current carrier review holds the exact collapse proposal for the false duplicate wait on already-succeeded run 172540314",
  reviewClassification: "duplicate_terminal_wait_collapse_review",
  reviewRootCause:
    "Controller-visible spec-loop state still pointed preflight validation at the archived/non-live wait wait-rp-cluster-lifecycle-preflight-validation-ado-run-172540314-result even though the current open process residue is only the review task ops/reconcile-current-preflight-validation-active-carrier-20260716, which proposes collapsing that false duplicate wait.",
  reviewAction:
    "Repointed spec.rp-cluster-lifecycle.preflight-validation to ops/reconcile-current-preflight-validation-active-carrier-20260716 and preserved the exact no-new-run collapse-only resume posture from the accepted reconciliation.",
};

const privateEndpoint = {
  specId: "spec.private-cluster.private-endpoint-connections-lifecycle",
  staleTaskId: "domain/review-private-cluster-private-endpoint-connections-clean-ado-run-172513872",
  carrierTaskId: "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
  evidencePath:
    "/app/projects/aks-rp-e2e/evidence/archive/fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872.md",
  requestedAction:
    "Wait for the exact same-spec Azure DevOps rerun 172544012 from commit 532bca57e10aa4673cde2167df6b19bb3af9a849, then inspect the aggregate and per-spec same-run artifacts before any closure claim.",
  resumeCondition:
    "Resume only against review task fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872. That fix-forward carrier already repaired the request-shape bug and queued exact rerun 172544012; do not reuse run 172513872 as proof and do not queue another rerun without a new diagnosis.",
  watchCondition:
    "Project planner or exact same-lineage review should re-check when run 172544012 becomes terminal or when the task state/result changes from the current fix-forward review.",
  fallbackCondition:
    "If run 172544012 is still not returned by 2026-07-17T18:00:00Z, refresh one exact same-lineage wait/review or escalate the stuck run with current evidence; do not emit a duplicate rerun or reopen broader private-cluster work.",
  successorDisposition: "exact_same_lineage_rerun_wait",
  successorStateReason:
    "Accepted 2026-07-16 fix-forward evidence repaired the private-endpoint-connections lifecycle request-shape bug and queued exact same-spec rerun 172544012 on commit 532bca57e10aa4673cde2167df6b19bb3af9a849, so the truthful current open lineage is fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872 rather than the stale clean-run review task.",
  pendingReviewReason:
    "fix-forward carrier repaired the request-shape bug and now waits for exact same-lineage rerun 172544012",
  reviewClassification: "test_code_bug_exact_same_lineage_rerun_wait",
  reviewRootCause:
    "Controller-visible spec-loop state still pointed private-endpoint-connections lifecycle at the stale clean-run review task even though the current live carrier is the fix-forward review task that repaired the request-shape bug and queued exact same-lineage rerun 172544012.",
  reviewAction:
    "Repointed spec.private-cluster.private-endpoint-connections-lifecycle to fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872 and preserved the exact rerun-only resume posture from the accepted fix-forward review.",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
});

const preflightBefore = specLoaded.state.specs[preflight.specId];
assert(preflightBefore, `Missing spec-loop row ${preflight.specId}`);
assert(
  preflightBefore.taskId === preflight.staleTaskId,
  `Expected ${preflight.specId}.taskId=${preflight.staleTaskId}; found ${preflightBefore.taskId ?? "null"}`,
);

const preflightReview = asRecord(preflightBefore.review);
preflightReview.pendingReviewTaskId = preflight.carrierTaskId;
preflightReview.pendingReviewObservedAt = appliedAt;
preflightReview.pendingReviewReason = preflight.pendingReviewReason;
preflightReview.classification = preflight.reviewClassification;
preflightReview.lastRootCause = preflight.reviewRootCause;
preflightReview.lastAction = preflight.reviewAction;
preflightReview.reviewedAt = appliedAt;

updateSpecLoopSpec(specLoaded.state, preflight.specId, {
  taskId: preflight.carrierTaskId,
  review: preflightReview,
  successorDisposition: preflight.successorDisposition,
  successorEvidencePath: preflight.evidencePath,
  successorStateReason: preflight.successorStateReason,
  resumeCondition: preflight.resumeCondition,
});

const privateBefore = specLoaded.state.specs[privateEndpoint.specId];
assert(privateBefore, `Missing spec-loop row ${privateEndpoint.specId}`);
assert(
  privateBefore.taskId === privateEndpoint.staleTaskId,
  `Expected ${privateEndpoint.specId}.taskId=${privateEndpoint.staleTaskId}; found ${privateBefore.taskId ?? "null"}`,
);

const privateReview = asRecord(privateBefore.review);
privateReview.pendingReviewTaskId = privateEndpoint.carrierTaskId;
privateReview.pendingReviewObservedAt = appliedAt;
privateReview.pendingReviewReason = privateEndpoint.pendingReviewReason;
privateReview.classification = privateEndpoint.reviewClassification;
privateReview.lastRootCause = privateEndpoint.reviewRootCause;
privateReview.lastAction = privateEndpoint.reviewAction;
privateReview.reviewedAt = appliedAt;

updateSpecLoopSpec(specLoaded.state, privateEndpoint.specId, {
  status: "pending",
  taskId: privateEndpoint.carrierTaskId,
  review: privateReview,
  successorDisposition: privateEndpoint.successorDisposition,
  successorEvidencePath: privateEndpoint.evidencePath,
  successorStateReason: privateEndpoint.successorStateReason,
  resumeCondition: privateEndpoint.resumeCondition,
});

saveSpecLoopState(
  specLoaded.path,
  specLoaded.state,
  existsSync(specLoopMirrorPath) ? [specLoopMirrorPath] : [],
);

const preflightAfter = specLoaded.state.specs[preflight.specId];
const privateAfter = specLoaded.state.specs[privateEndpoint.specId];

assert(
  preflightAfter?.taskId === preflight.carrierTaskId,
  `Expected ${preflight.specId}.taskId=${preflight.carrierTaskId} after repair`,
);
assert(
  privateAfter?.taskId === privateEndpoint.carrierTaskId,
  `Expected ${privateEndpoint.specId}.taskId=${privateEndpoint.carrierTaskId} after repair`,
);

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactFeatures = Object.values(compactLoaded.state.features ?? {});
const compactMatches = compactFeatures
  .filter((feature) => {
    const frontierTaskIds = Array.isArray(feature.frontierTaskIds)
      ? feature.frontierTaskIds
      : [];
    return (
      feature.taskId === preflight.carrierTaskId ||
      feature.taskId === privateEndpoint.carrierTaskId ||
      frontierTaskIds.includes(preflight.carrierTaskId) ||
      frontierTaskIds.includes(privateEndpoint.carrierTaskId)
    );
  })
  .map((feature) => ({
    featureKey: feature.featureKey,
    taskId: feature.taskId ?? null,
    frontierTaskIds: feature.frontierTaskIds ?? null,
  }));

const memo = `# Apply repair — reconcile open runtime escalation resume hygiene (2026-07-16)

- Task: \`ops-apply-reconcile-open-runtime-escalation-resume-hygiene-20260716-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Supported mechanism: app-local TypeScript repair script using \`loadSpecLoopState(...)\` + \`updateSpecLoopSpec(...)\` + \`saveSpecLoopState(...)\` (no hand-edited JSON, no runtime event emit)

## Repair result

Rebound the two controller-visible spec-loop rows that still left the accepted keep-open runtime escalations unowned in app state:

1. \`${preflight.specId}\`
   - before taskId: \`${preflightBefore.taskId ?? "null"}\`
   - after taskId: \`${preflightAfter?.taskId ?? "null"}\`
   - linked escalation: \`esc_1784220170027_w1axk0\`
   - linked carrier: \`${preflight.carrierTaskId}\`
2. \`${privateEndpoint.specId}\`
   - before taskId: \`${privateBefore.taskId ?? "null"}\`
   - after taskId: \`${privateAfter?.taskId ?? "null"}\`
   - linked escalation: \`esc_1784207884618_doxtgc\`
   - linked carrier: \`${privateEndpoint.carrierTaskId}\`

No feature-compact row currently points at either of these exact review carriers, so \`.state/feature-compact-loop/state.json\` required no rewrite for this bounded repair.

## Exact hydration packets represented after apply

### esc_1784220170027_w1axk0

- owner: \`app-ops\`
- requestedAction: ${JSON.stringify(preflight.requestedAction)}
- linkedTaskId: \`${preflight.carrierTaskId}\`
- resumeCondition: ${JSON.stringify(preflight.resumeCondition)}
- watchCondition: ${JSON.stringify(preflight.watchCondition)}
- fallbackCondition: ${JSON.stringify(preflight.fallbackCondition)}
- duplicateSuppressionKey: \`${duplicateSuppressionKey}\`

### esc_1784207884618_doxtgc

- owner: \`aks-explorer\`
- requestedAction: ${JSON.stringify(privateEndpoint.requestedAction)}
- linkedTaskId: \`${privateEndpoint.carrierTaskId}\`
- resumeCondition: ${JSON.stringify(privateEndpoint.resumeCondition)}
- watchCondition: ${JSON.stringify(privateEndpoint.watchCondition)}
- fallbackCondition: ${JSON.stringify(privateEndpoint.fallbackCondition)}
- duplicateSuppressionKey: \`${duplicateSuppressionKey}\`

## Spec-loop state before → after

### ${preflight.specId}

- status: \`${preflightBefore.status}\` → \`${preflightAfter?.status ?? "null"}\`
- taskId: \`${preflightBefore.taskId ?? "null"}\` → \`${preflightAfter?.taskId ?? "null"}\`
- review.pendingReviewTaskId: ${JSON.stringify(asRecord(preflightBefore.review).pendingReviewTaskId ?? null)} → ${JSON.stringify(asRecord(preflightAfter?.review).pendingReviewTaskId ?? null)}
- resumeCondition: ${JSON.stringify(preflightAfter?.resumeCondition ?? null)}

### ${privateEndpoint.specId}

- status: \`${privateBefore.status}\` → \`${privateAfter?.status ?? "null"}\`
- taskId: \`${privateBefore.taskId ?? "null"}\` → \`${privateAfter?.taskId ?? "null"}\`
- review.pendingReviewTaskId: ${JSON.stringify(asRecord(privateBefore.review).pendingReviewTaskId ?? null)} → ${JSON.stringify(asRecord(privateAfter?.review).pendingReviewTaskId ?? null)}
- resumeCondition: ${JSON.stringify(privateAfter?.resumeCondition ?? null)}

## Read-only compact verification

Compact rows referencing either exact carrier after the repair:

\`\`\`json
${JSON.stringify(compactMatches, null, 2)}
\`\`\`

Interpretation: the accepted keep-open escalation repair belongs only in spec-loop state for these two spec lineages. The current private-cluster and rp-cluster-lifecycle compact frontiers already point at other exact holders, so a compact-loop rewrite would have been unrelated drift.
`;

writeText(memoAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      memoPath,
      specLoopPath: specLoaded.path,
      mirrorPath: existsSync(specLoopMirrorPath) ? specLoopMirrorPath : null,
      repaired: [
        {
          specId: preflight.specId,
          beforeTaskId: preflightBefore.taskId ?? null,
          afterTaskId: preflightAfter?.taskId ?? null,
          resumeCondition: preflightAfter?.resumeCondition ?? null,
          pendingReviewTaskId:
            asRecord(preflightAfter?.review).pendingReviewTaskId ?? null,
        },
        {
          specId: privateEndpoint.specId,
          beforeTaskId: privateBefore.taskId ?? null,
          afterTaskId: privateAfter?.taskId ?? null,
          resumeCondition: privateAfter?.resumeCondition ?? null,
          pendingReviewTaskId:
            asRecord(privateAfter?.review).pendingReviewTaskId ?? null,
        },
      ],
      compactMatches,
    },
    null,
    2,
  ),
);

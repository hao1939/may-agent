import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "windows";
const holderTaskId = "hold-compact-windows-eligibility-frontier-20260707";
const waitTaskId =
  "ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized";
const supersededWaitTaskId =
  "ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s";
const evidencePath =
  "evidence/archive/ops-apply-recover-overdue-project-frontier-wave-app-ops-20260712-state-r.md";
const attemptId =
  "a_ops-apply-recover-overdue-project-frontier-wave-app-ops-20260712-state-r_20260712182121";
const checkedAt = new Date().toISOString();
const nextCheckAt = "2026-07-13T18:15:00Z";
const fallbackAt = "2026-07-13T18:15:00Z";
const blockedAt = "2026-07-10T17:10:43.222Z";

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );
}

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const feature = state.features[featureKey];
if (!feature) {
  throw new Error(`Compact feature not found: ${featureKey}`);
}

const priorFrontier = [...(feature.frontierTaskIds ?? [])];
const nextFrontier = [
  waitTaskId,
  ...priorFrontier.filter(
    (taskId) => taskId !== waitTaskId && taskId !== supersededWaitTaskId,
  ),
];

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: nextFrontier,
  retryReason:
    "Resume only when one exact represented blocker materially changes or a new current-head review reclassifies one of the four windows frontier members.",
  blockedAt,
  blockedReason:
    "2026-07-12 post-18:15Z app-ops repair restored the controller-visible Windows compact state pointer to hold-compact-windows-eligibility-frontier-20260707 and aligned the represented create-surface branch to ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized. Current-head compact summary/diagnostics still preserve the same four-member split frontier, the refreshed owner-normalized wait remains the exact downstream create-surface carrier, and no narrower current-head replacement holder exists, so do not queue an unchanged broad Windows compact rerun.",
  waitingFor: {
    type: "evidence.available",
    taskId: holderTaskId,
  },
  waitingCondition:
    "Resume only when one exact represented blocker materially changes or a new current-head review reclassifies one of the four windows frontier members.",
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-owner-review",
    trigger: "project.planning.requested",
  },
  observationMethod:
    "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt,
  fallbackAction:
    "If the wait is still true at the 2026-07-13 18:15Z fallback window, refresh this single authoritative holder from the latest same-lineage evidence or replace it only with a narrower exact holder rather than broad-rerunning unchanged.",
  resumeAction:
    "Reset this feature compact record to pending only after the named wait condition changes.",
  lastCheckedAt: checkedAt,
  reviewEvidencePath: evidencePath,
  evidencePaths: unique([...(feature.evidencePaths ?? []), evidencePath]),
  attemptedFixes: unique([
    ...(feature.attemptedFixes ?? []),
    `Restored controller-visible Windows compact state to authoritative holder ${holderTaskId} and replaced stale downstream wait reference ${supersededWaitTaskId} with refreshed wait ${waitTaskId} during ${attemptId}.`,
  ]),
  summary:
    "2026-07-12 overdue-project-frontier apply repair restored windows compact state to the authoritative holder hold-compact-windows-eligibility-frontier-20260707, aligned the represented create-surface branch to ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized, and moved the next review window to 2026-07-13T18:15:00Z.",
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      path,
      featureKey,
      before: {
        taskId: feature.taskId ?? null,
        frontierTaskIds: priorFrontier,
        nextCheckAt: feature.nextCheckAt ?? null,
        reviewEvidencePath: feature.reviewEvidencePath ?? null,
      },
      after: {
        taskId: state.features[featureKey]?.taskId ?? null,
        frontierTaskIds: state.features[featureKey]?.frontierTaskIds ?? null,
        nextCheckAt: state.features[featureKey]?.nextCheckAt ?? null,
        reviewEvidencePath: state.features[featureKey]?.reviewEvidencePath ?? null,
      },
    },
    null,
    2,
  ),
);

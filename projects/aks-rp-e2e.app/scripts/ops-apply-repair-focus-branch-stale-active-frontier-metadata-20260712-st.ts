import { resolve } from "node:path";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const focusTaskId =
  "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711";
const projectTaskId = "project";
const attemptId =
  "a_ops-apply-repair-focus-branch-stale-active-frontier-metadata-20260712-st_20260712214414";
const evidencePath =
  "evidence/archive/ops-apply-repair-focus-branch-stale-active-frontier-metadata-20260712-st.md";
const checkedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

const repairedProgressSummary =
  "The current focus direction is still correct and remains approval-blocked: excluding this audit repair task, the frontier has 0 runnable, 0 waiting, 0 active, and 0 review leaves, all remaining live project work is exact blocked waits, and the best next 12-24h work remains repo-local RP lifecycle source/spec/replay/model maturation plus exact wait stewardship rather than new live mutation.";
const repairedProgressEvidence0 =
  "2026-07-12 21:39Z task-tree summary/frontier reported active=[ops-apply-repair-focus-branch-stale-active-frontier-metadata-20260712-st], runnable=[], waiting=[], review=[]; excluding this audit repair task per blocked-frontier audit rules leaves a fully blocked frontier with 0 active, 0 runnable, 0 waiting, 0 review, and 134 blocked leaves.";
const repairedWhatChanged =
  "The previously cited maintenance leaves are now archived done (ops-apply-recover-overdue-compact-owner-return-and-frontier-wave-app-ops at 18:53Z and ops/diagnose-project-owner-return-refresh-debt-systemic-repair-20260712 at 18:56Z), so the current frontier is fully blocked again while the focus approval resend lineage remains 3069971 / 3069974 and RP lifecycle residue stays split between the stop-start shared artifact-recovery wait and the separate operation-status-polling three-file proof-closure or owner-reclassification wait.";
const repairedParallelWorkFilled =
  "No. Excluding this audit repair task, there are no runnable, waiting, active, or review leaves; once approval returns, the owner loop should refill bounded repo-local RP lifecycle leaves under existing lanes instead of reopening broad live reruns.";
const repairedRollupSummary =
  "2026-07-12 focus review refresh: the same no-live RP lifecycle mission remains correct, the approval refresh lineage is still 3069971/3069974, and the frontier is now fully blocked again; the owner loop should refill repo-local RP lifecycle maturation work only after direction is approved.";
const repairedProjectReason =
  "Regular focus review confirms the proposed no-live RP lifecycle direction is still current: after excluding this audit repair task, the frontier has no runnable, waiting, active, or review leaves, only exact blocked waits; live starts/succeeds remain at 0 in the last 24h, and RP lifecycle no-live maturation still has room with 70 unknown and 98 draft paths.";

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const observations = asRecord(focusContext.observations);
  const progressEvidence = asStringArray(progressReview.evidence);
  const focusTraceBefore = asRecord(focusTask.trace);

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTraceBefore = asRecord(projectTask.trace);

  const before = {
    progressSummary: progressReview.summary ?? null,
    progressEvidence0: progressEvidence[0] ?? null,
    whatChangedSinceLastReview:
      observations.what_changed_since_last_review ?? null,
    parallelWorkFilled: observations.parallel_work_filled ?? null,
    frontierActiveLeafCount: observations.frontier_active_leaf_count ?? null,
    frontierReviewLeafCount: observations.frontier_review_leaf_count ?? null,
    frontierWaitingLeafCount: observations.frontier_waiting_leaf_count ?? null,
    frontierRunnableLeafCount: observations.frontier_runnable_leaf_count ?? null,
    frontierBlockedLeafCount: observations.frontier_blocked_leaf_count ?? null,
    linkedActiveTaskIds: asStringArray(observations.linked_active_task_ids),
    focusRollupSummary: focusContext.rollup_summary ?? null,
    projectFocusReason: currentFocusProposal.reason ?? null,
    projectFocusReviewedAt: currentFocusProposal.reviewed_at ?? null,
  };

  progressReview.summary = repairedProgressSummary;
  progressReview.last_reviewed_at = checkedAt;
  progressReview.evidence = [
    repairedProgressEvidence0,
    ...progressEvidence.slice(1),
  ];
  focusContext.progress_review = progressReview;

  observations.what_changed_since_last_review = repairedWhatChanged;
  observations.parallel_work_filled = repairedParallelWorkFilled;
  observations.frontier_active_leaf_count = 0;
  observations.frontier_review_leaf_count = 0;
  observations.frontier_waiting_leaf_count = 0;
  observations.frontier_runnable_leaf_count = 0;
  observations.frontier_blocked_leaf_count = 134;
  observations.linked_active_task_ids = [];
  focusContext.observations = observations;
  focusContext.rollup_summary = repairedRollupSummary;
  focusTask.context = focusContext;
  focusTask.trace = {
    ...focusTraceBefore,
    focus_branch_stale_active_frontier_metadata_repaired_at: checkedAt,
    focus_branch_stale_active_frontier_metadata_repaired_by: "app-ops-script",
    focus_branch_stale_active_frontier_metadata_repair_attempt_id: attemptId,
    focus_branch_stale_active_frontier_metadata_repair_evidence_path:
      evidencePath,
  };

  currentFocusProposal.reason = repairedProjectReason;
  currentFocusProposal.reviewed_at = checkedAt;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_stale_active_frontier_reason_repaired_at: checkedAt,
    current_focus_proposal_stale_active_frontier_reason_repaired_by:
      "app-ops-script",
    current_focus_proposal_stale_active_frontier_reason_repair_attempt_id:
      attemptId,
    current_focus_proposal_stale_active_frontier_reason_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    focusTaskId,
    projectTaskId,
    attemptId,
    evidencePath,
    checkedAt,
    before,
    after: {
      progressSummary: progressReview.summary,
      progressEvidence0: asStringArray(progressReview.evidence)[0] ?? null,
      whatChangedSinceLastReview:
        observations.what_changed_since_last_review ?? null,
      parallelWorkFilled: observations.parallel_work_filled ?? null,
      frontierActiveLeafCount: observations.frontier_active_leaf_count ?? null,
      frontierReviewLeafCount: observations.frontier_review_leaf_count ?? null,
      frontierWaitingLeafCount: observations.frontier_waiting_leaf_count ?? null,
      frontierRunnableLeafCount: observations.frontier_runnable_leaf_count ?? null,
      frontierBlockedLeafCount: observations.frontier_blocked_leaf_count ?? null,
      linkedActiveTaskIds: asStringArray(observations.linked_active_task_ids),
      focusRollupSummary: focusContext.rollup_summary ?? null,
      projectFocusReason: currentFocusProposal.reason ?? null,
      projectFocusReviewedAt: currentFocusProposal.reviewed_at ?? null,
    },
    preservedApprovalLineage: {
      waitingFor: asRecord(asRecord(focusTask.blocker).waiting_for),
    },
  };
});

console.log(JSON.stringify(result, null, 2));

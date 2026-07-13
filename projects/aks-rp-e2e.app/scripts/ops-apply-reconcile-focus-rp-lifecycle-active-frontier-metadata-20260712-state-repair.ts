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
const activeTaskId =
  "domain/reconcile-rp-lifecycle-core-draft-metadata-slice-20260712";
const completedTaskId =
  "domain/reconcile-rp-lifecycle-exec-boundary-draft-slice-20260712";
const attemptId =
  "a_ops-apply-reconcile-focus-rp-lifecycle-active-frontier-metadata-20260712_20260712220627";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-focus-rp-lifecycle-active-frontier-metadata-20260712.md";
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
  "The current focus direction is still correct and remains approval-blocked, but the frontier is no longer fully blocked: excluding this audit task, one repo-local RP lifecycle reconciliation leaf is active (domain/reconcile-rp-lifecycle-core-draft-metadata-slice-20260712), its sibling exec-boundary reconciliation leaf just completed, and the best next 12-24h work remains no-live RP lifecycle source/spec/replay/model maturation plus exact wait stewardship rather than new live mutation.";
const repairedProgressEvidence0 =
  "2026-07-12 ~22:06Z task-tree summary/frontier reported active=[domain/reconcile-rp-lifecycle-core-draft-metadata-slice-20260712, ops-apply-reconcile-focus-rp-lifecycle-active-frontier-metadata-20260712], runnable=[], waiting=[], review=[]; excluding this audit task leaves one active repo-local RP lifecycle leaf, no runnable/waiting/review leaves, and 135 blocked leaves.";
const repairedWhatChanged =
  "The earlier fully blocked snapshot became stale after the planner seeded two repo-local RP lifecycle reconciliation leaves. The exec-boundary slice has already completed with checked-in model/view reconciliation evidence, and the core draft-metadata slice remains active, while the focus approval lineage and exact shared auth/runtime owner-return family wait remain unchanged.";
const repairedParallelWorkFilled =
  "Yes. Excluding this audit task, one repo-local RP lifecycle reconciliation leaf is active now; it represents bounded no-live forward motion under the existing focus direction without reopening live reruns.";
const repairedRollupSummary =
  "2026-07-12 focus reconcile refresh: the no-live RP lifecycle mission and exact approval/wait stewardship remain correct, and the frontier now shows bounded repo-local forward motion through the active core draft-metadata slice plus the freshly completed exec-boundary reconciliation slice rather than a fully blocked/no-active snapshot.";
const repairedProjectReason =
  "Regular focus review confirms the proposed no-live RP lifecycle direction is still current: the frontier still has no runnable or waiting leaves, but it is no longer zero-active because one bounded repo-local RP lifecycle reconciliation leaf remains active and its exec-boundary sibling just completed; live starts/succeeds remain at 0 in the last 24h, so the preferred work stays repo-local RP lifecycle maturation plus exact wait stewardship rather than new live mutation.";

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
  observations.frontier_active_leaf_count = 1;
  observations.frontier_review_leaf_count = 0;
  observations.frontier_waiting_leaf_count = 0;
  observations.frontier_runnable_leaf_count = 0;
  observations.frontier_blocked_leaf_count = 135;
  observations.linked_active_task_ids = [activeTaskId];
  observations.linked_recently_completed_task_ids = [completedTaskId];
  focusContext.observations = observations;
  focusContext.rollup_summary = repairedRollupSummary;
  focusTask.context = focusContext;
  focusTask.trace = {
    ...focusTraceBefore,
    focus_branch_rp_lifecycle_active_frontier_metadata_repaired_at: checkedAt,
    focus_branch_rp_lifecycle_active_frontier_metadata_repaired_by:
      "app-ops-script",
    focus_branch_rp_lifecycle_active_frontier_metadata_repair_attempt_id:
      attemptId,
    focus_branch_rp_lifecycle_active_frontier_metadata_repair_evidence_path:
      evidencePath,
  };

  currentFocusProposal.reason = repairedProjectReason;
  currentFocusProposal.reviewed_at = checkedAt;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_rp_lifecycle_active_frontier_reason_repaired_at:
      checkedAt,
    current_focus_proposal_rp_lifecycle_active_frontier_reason_repaired_by:
      "app-ops-script",
    current_focus_proposal_rp_lifecycle_active_frontier_reason_repair_attempt_id:
      attemptId,
    current_focus_proposal_rp_lifecycle_active_frontier_reason_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    focusTaskId,
    projectTaskId,
    activeTaskId,
    completedTaskId,
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
      linkedRecentlyCompletedTaskIds: asStringArray(
        observations.linked_recently_completed_task_ids,
      ),
      focusRollupSummary: focusContext.rollup_summary ?? null,
      projectFocusReason: currentFocusProposal.reason ?? null,
      projectFocusReviewedAt: currentFocusProposal.reviewed_at ?? null,
    },
    preservedApprovalLineage: {
      blockerCategory: asRecord(focusTask.blocker).category ?? null,
      blockerOwner: asRecord(focusTask.blocker).owner ?? null,
      waitingFor: asRecord(asRecord(focusTask.blocker).waiting_for),
    },
  };
});

console.log(JSON.stringify(result, null, 2));

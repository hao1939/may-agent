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
const archivedActiveTaskId =
  "domain/reconcile-rp-lifecycle-core-draft-metadata-slice-20260712";
const preservedSharedWaitTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized";
const preservedPollingWaitTaskId =
  "domain/wait-rp-operation-status-polling-three-file-proof-closure-or-owner-reclassification-20260712";
const attemptId =
  "a_ops-apply-reconcile-focus-frontier-metadata-post-archive-20260712-state-_20260712222208";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-focus-frontier-metadata-post-archive-20260712-state-repair.md";
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
  "The current focus direction is still correct and remains approval-blocked. After the RP lifecycle reconciliation leaves were archived, the live frontier excluding this audit task is back to 0 runnable, 0 waiting, 0 active, and 0 review leaves, so the best next 12-24h posture remains exact wait stewardship and no-live RP lifecycle maturation rather than new live mutation.";
const repairedProgressEvidence0 =
  "2026-07-12 ~22:20Z task-tree summary/frontier reported active=[ops-apply-reconcile-focus-frontier-metadata-post-archive-20260712-state-], runnable=[], waiting=[], review=[]; excluding this audit task leaves zero active/runnable/waiting/review leaves and 135 blocked leaves, and task-tree show for domain/reconcile-rp-lifecycle-core-draft-metadata-slice-20260712 now returns Task not found after archive.";
const repairedWhatChanged =
  "The earlier 22:07Z active-frontier snapshot became stale after planner task-tree maintenance archived domain/reconcile-rp-lifecycle-core-draft-metadata-slice-20260712 at 22:15Z. The focus approval lineage, shared auth/runtime family wait, and rp-operation-status-polling three-file wait all remain unchanged.";
const repairedParallelWorkFilled =
  "No. Excluding this audit task, the frontier is again fully blocked with no active, runnable, waiting, or review leaves.";
const repairedRollupSummary =
  "2026-07-12 post-archive focus reconcile refresh: the no-live RP lifecycle mission and exact approval/wait stewardship remain correct, and the live frontier excluding this audit task is again fully blocked with zero runnable, waiting, active, or review leaves.";
const repairedProjectReason =
  "Regular focus review confirms the proposed no-live RP lifecycle direction is still current. After planner archive of the RP lifecycle reconciliation leaves, the frontier excluding this audit task has 0 runnable, 0 waiting, 0 active, and 0 review leaves, with only exact blocked waits remaining; live starts/succeeds remain at 0 in the last 24h, so the preferred work stays exact wait stewardship plus repo-local maturation when a bounded leaf is explicitly reopened, not new live mutation.";

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  const preservedSharedWaitTask = tree.tasks[preservedSharedWaitTaskId];
  const preservedPollingWaitTask = tree.tasks[preservedPollingWaitTaskId];
  const archivedActiveTask = tree.tasks[archivedActiveTaskId] ?? null;

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);
  if (!preservedSharedWaitTask) {
    throw new Error(`Task not found: ${preservedSharedWaitTaskId}`);
  }
  if (!preservedPollingWaitTask) {
    throw new Error(`Task not found: ${preservedPollingWaitTaskId}`);
  }

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const observations = asRecord(focusContext.observations);
  const progressEvidence = asStringArray(progressReview.evidence);
  const linkedRecentlyCompleted = asStringArray(
    observations.linked_recently_completed_task_ids,
  );
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
    linkedRecentlyCompletedTaskIds: linkedRecentlyCompleted,
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
  observations.frontier_blocked_leaf_count = 135;
  observations.linked_active_task_ids = [];
  observations.linked_recently_completed_task_ids = linkedRecentlyCompleted;
  focusContext.observations = observations;
  focusContext.rollup_summary = repairedRollupSummary;
  focusTask.context = focusContext;
  focusTask.trace = {
    ...focusTraceBefore,
    focus_branch_post_archive_frontier_metadata_repaired_at: checkedAt,
    focus_branch_post_archive_frontier_metadata_repaired_by: "app-ops-script",
    focus_branch_post_archive_frontier_metadata_repair_attempt_id: attemptId,
    focus_branch_post_archive_frontier_metadata_repair_evidence_path:
      evidencePath,
  };

  currentFocusProposal.reason = repairedProjectReason;
  currentFocusProposal.reviewed_at = checkedAt;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_post_archive_frontier_reason_repaired_at: checkedAt,
    current_focus_proposal_post_archive_frontier_reason_repaired_by:
      "app-ops-script",
    current_focus_proposal_post_archive_frontier_reason_repair_attempt_id:
      attemptId,
    current_focus_proposal_post_archive_frontier_reason_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    focusTaskId,
    projectTaskId,
    archivedActiveTaskId,
    archivedActiveTaskPresentInLiveTree: archivedActiveTask !== null,
    preservedSharedWaitTaskId,
    preservedPollingWaitTaskId,
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
    preservedWaits: {
      sharedAuthRuntimeWaitState: preservedSharedWaitTask.state ?? null,
      sharedAuthRuntimeWaitingFor: asRecord(
        asRecord(preservedSharedWaitTask.blocker).waiting_for,
      ),
      rpOperationStatusPollingWaitState: preservedPollingWaitTask.state ?? null,
      rpOperationStatusPollingWaitingFor: asRecord(
        asRecord(preservedPollingWaitTask.blocker).waiting_for,
      ),
    },
  };
});

console.log(JSON.stringify(result, null, 2));

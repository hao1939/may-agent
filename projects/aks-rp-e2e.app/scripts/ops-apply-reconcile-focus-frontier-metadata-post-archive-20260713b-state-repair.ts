import { resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  isLeaf,
  readTaskTree,
  withTreeLock,
} from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const focusTaskId =
  "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711";
const projectTaskId = "project";
const repairTaskId =
  "ops-apply-reconcile-focus-frontier-metadata-post-archive-20260713b-state";
const primaryApprovalWaitTaskId =
  "ops/wait-project-approval-owner-return-primary-blocker-20260713";
const packetSecondHopTaskId =
  "domain/reconcile-model-private-cluster-update-private-second-hop-from-existing-frontier-20260713";
const survivingActiveTaskId =
  "ops-apply-reconcile-model-private-cluster-none-dns-zone-v3-from-existing";
const attemptId =
  "a_ops-apply-reconcile-focus-frontier-metadata-post-archive-20260713b-state_20260713122736";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-focus-frontier-metadata-post-archive-20260713b-state-repair.md";
const checkedAt = new Date().toISOString();

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

function leafState(task: Record<string, unknown>): string {
  const status = task.status;
  if (typeof status === "string" && status.trim()) return status.trim();
  const state = task.state;
  return typeof state === "string" && state.trim() ? state.trim() : "";
}

const summaryBefore = summarizeTaskTree(config);
const activeExcludingRepair = summaryBefore.frontier.active.filter(
  (taskId) => taskId !== repairTaskId,
);
const blockedLeafCount = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  return Object.values(tree.tasks).filter((task) => {
    if (!isLeaf(task)) return false;
    return leafState(task as unknown as Record<string, unknown>) === "blocked";
  }).length;
});

const missingPacketTaskFromLiveTree = !activeExcludingRepair.includes(
  packetSecondHopTaskId,
);

const progressSummary = missingPacketTaskFromLiveTree
  ? "The current focus direction is still correct, but it remains blocked on the same focus approval / owner-return lineage. Since the 2026-07-13b audit packet was produced, planner accepted the earlier private-cluster update-private-second-hop repair leaf, so the live frontier excluding this repair task now has one bounded no-live active leaf—ops-apply-reconcile-model-private-cluster-none-dns-zone-v3-from-existing—while runnable, waiting, and review remain empty. The project-level approval blocker remains ops/wait-project-approval-owner-return-primary-blocker-20260713, so the best next posture remains exact wait stewardship plus bounded repo-local/model-app-state maturation rather than new live mutation."
  : "The current focus direction is still correct, but it remains blocked on the same focus approval / owner-return lineage. The live frontier excluding this repair task now has two bounded no-live active leaves—domain/reconcile-model-private-cluster-update-private-second-hop-from-existing-frontier-20260713 and ops-apply-reconcile-model-private-cluster-none-dns-zone-v3-from-existing—while runnable, waiting, and review remain empty, so the best next posture remains exact wait stewardship plus bounded repo-local/model-app-state maturation rather than new live mutation.";

const progressEvidence0 = missingPacketTaskFromLiveTree
  ? `2026-07-13T12:28Z task-tree frontier reported active=[${summaryBefore.frontier.active.join(", ")}], runnable=[${summaryBefore.frontier.runnable.join(", ")}], waiting=[${summaryBefore.frontier.waiting.join(", ")}], review=[${summaryBefore.frontier.review.join(", ")}]; excluding this repair task leaves exactly one active no-live leaf (${survivingActiveTaskId}) and ${blockedLeafCount} blocked leaves. The earlier packet leaf ${packetSecondHopTaskId} no longer has a live node because planner accepted and archived it before this metadata apply landed.`
  : `2026-07-13T12:28Z task-tree frontier reported active=[${summaryBefore.frontier.active.join(", ")}], runnable=[${summaryBefore.frontier.runnable.join(", ")}], waiting=[${summaryBefore.frontier.waiting.join(", ")}], review=[${summaryBefore.frontier.review.join(", ")}]; excluding this repair task leaves exactly two active no-live leaves and ${blockedLeafCount} blocked leaves.`;

const whatChanged = missingPacketTaskFromLiveTree
  ? "The earlier aad-rbac/Fleet lineage-stewardship snapshot is stale: ops/refresh-aad-rbac-compact-frontier-lineage-20260713 and ops/repair-fleet-frontier-lineage-controller-bridge-20260713 are no longer live, and the 2026-07-13b audit packet itself advanced before this repair landed because planner accepted and archived the private-cluster update-private-second-hop leaf. The remaining live frontier is therefore the surviving private-cluster no-live app-state repair leaf without any change to the governing project-level approval blocker."
  : "The earlier aad-rbac/Fleet lineage-stewardship snapshot is stale: ops/refresh-aad-rbac-compact-frontier-lineage-20260713 and ops/repair-fleet-frontier-lineage-controller-bridge-20260713 are no longer live, and the frontier has shifted to the two current private-cluster no-live leaves without changing the governing project-level approval blocker.";

const parallelWorkFilled = missingPacketTaskFromLiveTree
  ? "Thin but non-empty. Excluding this repair task, the frontier has one bounded no-live active leaf and no runnable, waiting, or review leaves."
  : "Thin but non-empty. Excluding this repair task, the frontier has two bounded no-live active leaves and no runnable, waiting, or review leaves.";

const focusRollupSummary = missingPacketTaskFromLiveTree
  ? "2026-07-13 focus progress refresh: the no-live mission and exact approval/wait stewardship remain correct, and after the second-hop repair leaf was accepted the current live frontier excluding this repair task is represented by one bounded private-cluster no-live leaf rather than the earlier aad-rbac/Fleet lineage-stewardship pair."
  : "2026-07-13 focus progress refresh: the no-live mission and exact approval/wait stewardship remain correct, and the current live frontier excluding this repair task is represented by two bounded private-cluster no-live leaves rather than the earlier aad-rbac/Fleet lineage-stewardship pair.";

const projectReason = missingPacketTaskFromLiveTree
  ? "Regular focus review confirms the proposed no-live direction is still current. After the earlier aad-rbac/Fleet lineage leaves were archived, the 2026-07-13b audit packet briefly captured two private-cluster no-live active leaves, but planner accepted the update-private-second-hop leaf before this metadata apply landed. The frontier excluding this repair task now has one bounded no-live active leaf—ops-apply-reconcile-model-private-cluster-none-dns-zone-v3-from-existing—while runnable, waiting, and review remain empty. The project-level primary approval blocker still lives at ops/wait-project-approval-owner-return-primary-blocker-20260713, so the preferred posture remains exact wait stewardship plus bounded repo-local/model-app-state maturation, not new live mutation."
  : "Regular focus review confirms the proposed no-live direction is still current. After the earlier aad-rbac/Fleet lineage leaves were archived, the frontier excluding this repair task now has two bounded no-live active leaves—domain/reconcile-model-private-cluster-update-private-second-hop-from-existing-frontier-20260713 and ops-apply-reconcile-model-private-cluster-none-dns-zone-v3-from-existing—while runnable, waiting, and review remain empty. The project-level primary approval blocker still lives at ops/wait-project-approval-owner-return-primary-blocker-20260713, so the preferred posture remains exact wait stewardship plus bounded repo-local/model-app-state maturation, not new live mutation.";

const repairedObservationMethod =
  "Planner/app-ops handles a matching returned project.approval.submitted event for this exact focus approval lineage; if no decision arrives, the scheduled blocked-frontier app-ops review must re-check the family-level carrier ops/wait-project-approval-owner-return-primary-blocker-20260713 and either keep, sharpen, replace, or clear this exact focus wait with fresh same-lineage evidence.";

const repairedResumeCondition =
  "Resume when project.approval.submitted carries the exact focus approvalId or waitId with a bounded decision, or when planner/app-ops replaces this wait with a sharper same-lineage successor backed by reviewed evidence under ops/wait-project-approval-owner-return-primary-blocker-20260713.";

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  const primaryApprovalWait = tree.tasks[primaryApprovalWaitTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);
  if (!primaryApprovalWait) {
    throw new Error(`Task not found: ${primaryApprovalWaitTaskId}`);
  }

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const observations = asRecord(focusContext.observations);
  const progressEvidence = asStringArray(progressReview.evidence);
  const linkedRecentlyCompleted = new Set(
    asStringArray(observations.linked_recently_completed_task_ids),
  );
  const focusTraceBefore = asRecord(focusTask.trace);
  const blockerBefore = asRecord(focusTask.blocker);

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTraceBefore = asRecord(projectTask.trace);

  if (missingPacketTaskFromLiveTree) {
    linkedRecentlyCompleted.add(packetSecondHopTaskId);
  }

  const before = {
    focusProgressSummary: progressReview.summary ?? null,
    focusEvidence0: progressEvidence[0] ?? null,
    focusWhatChanged: observations.what_changed_since_last_review ?? null,
    focusParallelWorkFilled: observations.parallel_work_filled ?? null,
    focusFrontierActiveLeafCount: observations.frontier_active_leaf_count ?? null,
    focusLinkedActiveTaskIds: asStringArray(observations.linked_active_task_ids),
    focusLinkedRecentlyCompletedTaskIds: asStringArray(
      observations.linked_recently_completed_task_ids,
    ),
    focusRollupSummary: focusContext.rollup_summary ?? null,
    focusObservationMethod: blockerBefore.observation_method ?? null,
    focusResumeCondition: blockerBefore.resume_condition ?? null,
    projectReason: currentFocusProposal.reason ?? null,
    projectReviewedAt: currentFocusProposal.reviewed_at ?? null,
  };

  progressReview.summary = progressSummary;
  progressReview.last_reviewed_at = checkedAt;
  progressReview.evidence = [progressEvidence0, ...progressEvidence.slice(1)];
  focusContext.progress_review = progressReview;

  observations.what_changed_since_last_review = whatChanged;
  observations.parallel_work_filled = parallelWorkFilled;
  observations.frontier_active_leaf_count = activeExcludingRepair.length;
  observations.frontier_review_leaf_count = summaryBefore.frontier.review.length;
  observations.frontier_waiting_leaf_count = summaryBefore.frontier.waiting.length;
  observations.frontier_runnable_leaf_count = summaryBefore.frontier.runnable.length;
  observations.frontier_blocked_leaf_count = blockedLeafCount;
  observations.linked_active_task_ids = activeExcludingRepair;
  observations.linked_recently_completed_task_ids = [...linkedRecentlyCompleted];
  focusContext.observations = observations;
  focusContext.rollup_summary = focusRollupSummary;
  focusTask.context = focusContext;
  focusTask.blocker = {
    ...blockerBefore,
    observation_method: repairedObservationMethod,
    resume_condition: repairedResumeCondition,
  };
  focusTask.trace = {
    ...focusTraceBefore,
    focus_branch_post_archive_frontier_metadata_repaired_at: checkedAt,
    focus_branch_post_archive_frontier_metadata_repaired_by: "app-ops-script",
    focus_branch_post_archive_frontier_metadata_repair_attempt_id: attemptId,
    focus_branch_post_archive_frontier_metadata_repair_evidence_path:
      evidencePath,
  };

  currentFocusProposal.reason = projectReason;
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
    primaryApprovalWaitTaskId,
    attemptId,
    evidencePath,
    checkedAt,
    packetSecondHopTaskId,
    missingPacketTaskFromLiveTree,
    activeExcludingRepair,
    blockedLeafCount,
    before,
    after: {
      focusProgressSummary: progressReview.summary,
      focusEvidence0: asStringArray(progressReview.evidence)[0] ?? null,
      focusWhatChanged: observations.what_changed_since_last_review ?? null,
      focusParallelWorkFilled: observations.parallel_work_filled ?? null,
      focusFrontierActiveLeafCount: observations.frontier_active_leaf_count ?? null,
      focusLinkedActiveTaskIds: asStringArray(observations.linked_active_task_ids),
      focusLinkedRecentlyCompletedTaskIds: asStringArray(
        observations.linked_recently_completed_task_ids,
      ),
      focusRollupSummary: focusContext.rollup_summary ?? null,
      focusObservationMethod: asRecord(focusTask.blocker).observation_method ?? null,
      focusResumeCondition: asRecord(focusTask.blocker).resume_condition ?? null,
      projectReason: currentFocusProposal.reason ?? null,
      projectReviewedAt: currentFocusProposal.reviewed_at ?? null,
    },
    preservedApprovalLineage: {
      blockerCategory: asRecord(focusTask.blocker).category ?? null,
      blockerOwner: asRecord(focusTask.blocker).owner ?? null,
      waitingFor: asRecord(asRecord(focusTask.blocker).waiting_for),
    },
    preservedPrimaryApprovalWait: {
      state: primaryApprovalWait.state ?? primaryApprovalWait.status ?? null,
      blocker: asRecord(primaryApprovalWait.blocker),
    },
  };
});

console.log(JSON.stringify(result, null, 2));

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const repairTaskId =
  "ops-apply-reconcile-focus-branch-frontier-metadata-with-current-active-w";
const reviewedTaskId =
  "ops/reconcile-focus-branch-frontier-metadata-with-current-active-waits-20260713";
const focusTaskId =
  "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711";
const projectTaskId = "project";
const primaryApprovalWaitTaskId =
  "ops/wait-project-approval-owner-return-primary-blocker-20260713";
const sharedApprovalWaitTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized";
const nodeHttpProxyDecisionWaitTaskId =
  "wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-focus-branch-frontier-metadata-with-current-active-w-20260713.md";
const attemptId =
  "a_ops-apply-reconcile-focus-branch-frontier-metadata-with-current-active-w_20260713135521";
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

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function leafState(task: Record<string, unknown>): string {
  const status = task.status;
  if (typeof status === "string" && status.trim()) return status.trim();
  const state = task.state;
  return typeof state === "string" && state.trim() ? state.trim() : "";
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const frontierBefore = summarizeTaskTree(config).frontier;
const activeExcludingRepair = frontierBefore.active.filter(
  (taskId) => taskId !== repairTaskId,
);
const reviewExcludingRepair = frontierBefore.review.filter(
  (taskId) => taskId !== repairTaskId,
);
const waitingExcludingRepair = frontierBefore.waiting.filter(
  (taskId) => taskId !== repairTaskId,
);
const runnableExcludingRepair = frontierBefore.runnable.filter(
  (taskId) => taskId !== repairTaskId,
);

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  const primaryApprovalWait = tree.tasks[primaryApprovalWaitTaskId];
  const sharedApprovalWait = tree.tasks[sharedApprovalWaitTaskId];
  const nodeHttpProxyDecisionWait = tree.tasks[nodeHttpProxyDecisionWaitTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);
  if (!primaryApprovalWait) {
    throw new Error(`Task not found: ${primaryApprovalWaitTaskId}`);
  }
  if (!sharedApprovalWait) {
    throw new Error(`Task not found: ${sharedApprovalWaitTaskId}`);
  }
  if (!nodeHttpProxyDecisionWait) {
    throw new Error(`Task not found: ${nodeHttpProxyDecisionWaitTaskId}`);
  }

  const blockedLeafCount = Object.values(tree.tasks).filter((task) => {
    if (!isLeaf(task)) return false;
    return leafState(task as unknown as Record<string, unknown>) === "blocked";
  }).length;

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const observations = asRecord(focusContext.observations);
  const priorEvidence = asStringArray(progressReview.evidence);
  const priorOutputs = asStringArray(focusTask.outputs);
  const focusTraceBefore = asRecord(focusTask.trace);
  const blockerBefore = asRecord(focusTask.blocker);

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTraceBefore = asRecord(projectTask.trace);
  const projectOutputsBefore = asStringArray(projectTask.outputs);

  const existingBlockedIds = asStringArray(
    observations.linked_blocked_task_ids,
  );
  const refreshedBlockedIds = unique([
    focusTaskId,
    primaryApprovalWaitTaskId,
    sharedApprovalWaitTaskId,
    nodeHttpProxyDecisionWaitTaskId,
    ...existingBlockedIds,
  ]);

  const before = {
    focusProgressSummary: progressReview.summary ?? null,
    focusEvidence0: priorEvidence[0] ?? null,
    frontierActiveLeafCount: observations.frontier_active_leaf_count ?? null,
    frontierReviewLeafCount: observations.frontier_review_leaf_count ?? null,
    linkedActiveTaskIds: asStringArray(observations.linked_active_task_ids),
    linkedReviewTaskIds: asStringArray(observations.linked_review_task_ids),
    linkedBlockedTaskIds: asStringArray(observations.linked_blocked_task_ids),
    projectReason: currentFocusProposal.reason ?? null,
    projectReviewedAt: currentFocusProposal.reviewed_at ?? null,
  };

  const focusSummary = `The post-reconciliation no-live focus remains truthful and approval-blocked. Excluding this metadata repair task, the current runtime frontier now has ${activeExcludingRepair.length} active, ${reviewExcludingRepair.length} review, ${waitingExcludingRepair.length} waiting, and ${runnableExcludingRepair.length} runnable leaves. The live active frontier is ${activeExcludingRepair.length > 0 ? activeExcludingRepair.join(", ") : "empty"}, so focus metadata should keep that exact active linkage while preserving the same approval/owner-return wait lineage.`;
  const focusEvidence0 = `${checkedAt} task-tree frontier reported active=[${frontierBefore.active.join(", ")}], review=[${frontierBefore.review.join(", ")}], waiting=[${frontierBefore.waiting.join(", ")}], runnable=[${frontierBefore.runnable.join(", ")}]. Excluding ${repairTaskId}, the live frontier has active=[${activeExcludingRepair.join(", ")}], review=[${reviewExcludingRepair.join(", ")}], waiting=[${waitingExcludingRepair.join(", ")}], runnable=[${runnableExcludingRepair.join(", ")}], and ${blockedLeafCount} blocked leaf tasks. The same approval/owner-return lineage remains visible through ${primaryApprovalWaitTaskId}, ${sharedApprovalWaitTaskId}, and ${nodeHttpProxyDecisionWaitTaskId}.`;
  const projectReason = `Regular focus review confirms the proposed no-live direction is still current and still blocked on the same approval/owner-return lineage. Excluding this metadata repair task, the current live frontier has ${activeExcludingRepair.length} active leaf (${activeExcludingRepair.join(", ") || "none"}), ${reviewExcludingRepair.length} review leaves, ${waitingExcludingRepair.length} waiting leaves, and ${runnableExcludingRepair.length} runnable leaves. The truthful posture is unchanged: keep the focus approval wait explicit under ${primaryApprovalWaitTaskId}, preserve the shared auth/runtime and node-http-proxy downstream owner-return waits, and continue exact blocked-wait stewardship rather than reopening live work.`;

  progressReview.last_reviewed_at = checkedAt;
  progressReview.status = "blocked";
  progressReview.summary = focusSummary;
  progressReview.evidence = [focusEvidence0, ...priorEvidence.slice(1)];
  focusContext.progress_review = progressReview;

  observations.what_changed_since_last_review = `The prior focus metadata repair was overtaken by subsequent tree motion and excluded the older reconciliation task ${reviewedTaskId} rather than this active repair task ${repairTaskId}. The live frontier now needs to point exactly at active=[${activeExcludingRepair.join(", ") || ""}] and review=[${reviewExcludingRepair.join(", ") || ""}] while preserving the same approval/owner-return wait lineage through ${primaryApprovalWaitTaskId}, ${sharedApprovalWaitTaskId}, and ${nodeHttpProxyDecisionWaitTaskId}.`;
  observations.parallel_work_filled =
    activeExcludingRepair.length > 0 ||
    reviewExcludingRepair.length > 0 ||
    waitingExcludingRepair.length > 0 ||
    runnableExcludingRepair.length > 0
      ? `Yes, thinly. Excluding this repair task, the frontier currently shows active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}].`
      : "No. Excluding this repair task, only exact blocked waits remain visible.";
  observations.frontier_active_leaf_count = activeExcludingRepair.length;
  observations.frontier_review_leaf_count = reviewExcludingRepair.length;
  observations.frontier_waiting_leaf_count = waitingExcludingRepair.length;
  observations.frontier_runnable_leaf_count = runnableExcludingRepair.length;
  observations.frontier_blocked_leaf_count = blockedLeafCount;
  observations.linked_active_task_ids = activeExcludingRepair;
  observations.linked_review_task_ids = reviewExcludingRepair;
  observations.linked_blocked_task_ids = refreshedBlockedIds;
  observations.structural_status =
    "The next useful 12-24h mission is unchanged: keep the focus approval wait explicit, preserve exact owner-return waits, and avoid reopening live execution until a new bounded candidate actually appears in the frontier.";
  focusContext.observations = observations;
  focusContext.rollup_summary = `2026-07-13 focus metadata reconciliation: refreshed the frontier baseline excluding ${repairTaskId}, restored exact active/review linkage to the current live tree, and kept the no-live branch blocked on the same approval/owner-return wait lineage.`;
  focusTask.context = focusContext;
  focusTask.outputs = unique([...priorOutputs, evidencePath]);
  focusTask.blocker = {
    ...blockerBefore,
    condition:
      typeof blockerBefore.condition === "string"
        ? blockerBefore.condition
        : "Blocked on refreshed human approval for the updated post-reconciliation no-live exact-wait stewardship direction, with the family-level owner-return lineage still carried by the project primary blocker and its downstream exact waits.",
    observation_method:
      typeof blockerBefore.observation_method === "string"
        ? blockerBefore.observation_method
        : `Planner/app-ops should reconcile this focus wait when a matching returned project.approval.submitted decision arrives for the focus lineage or when ${primaryApprovalWaitTaskId} is replaced by a sharper same-lineage successor with reviewed evidence.`,
    resume_condition:
      typeof blockerBefore.resume_condition === "string"
        ? blockerBefore.resume_condition
        : `Resume when project.approval.submitted returns a bounded decision for this focus-plan lineage, or when planner/app-ops replaces ${primaryApprovalWaitTaskId} with a sharper same-lineage approval/owner-return carrier backed by reviewed evidence.`,
  };
  focusTask.trace = {
    ...focusTraceBefore,
    focus_branch_frontier_metadata_reconciled_at: checkedAt,
    focus_branch_frontier_metadata_reconciled_by: "app-ops-script",
    focus_branch_frontier_metadata_reconcile_attempt_id: attemptId,
    focus_branch_frontier_metadata_reconcile_evidence_path: evidencePath,
  };

  currentFocusProposal.reason = projectReason;
  currentFocusProposal.reviewed_at = checkedAt;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...projectOutputsBefore, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_frontier_metadata_reconciled_at: checkedAt,
    current_focus_proposal_frontier_metadata_reconciled_by: "app-ops-script",
    current_focus_proposal_frontier_metadata_reconcile_attempt_id: attemptId,
    current_focus_proposal_frontier_metadata_reconcile_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    checkedAt,
    attemptId,
    repairTaskId,
    reviewedTaskId,
    focusTaskId,
    projectTaskId,
    primaryApprovalWaitTaskId,
    sharedApprovalWaitTaskId,
    nodeHttpProxyDecisionWaitTaskId,
    baselineExcludingRepair: {
      active: activeExcludingRepair,
      review: reviewExcludingRepair,
      waiting: waitingExcludingRepair,
      runnable: runnableExcludingRepair,
      blockedLeafCount,
    },
    before,
    after: {
      focusProgressSummary: progressReview.summary,
      focusEvidence0: asStringArray(progressReview.evidence)[0] ?? null,
      frontierActiveLeafCount: observations.frontier_active_leaf_count ?? null,
      frontierReviewLeafCount: observations.frontier_review_leaf_count ?? null,
      linkedActiveTaskIds: asStringArray(observations.linked_active_task_ids),
      linkedReviewTaskIds: asStringArray(observations.linked_review_task_ids),
      linkedBlockedTaskIds: asStringArray(observations.linked_blocked_task_ids),
      projectReason: currentFocusProposal.reason ?? null,
      projectReviewedAt: currentFocusProposal.reviewed_at ?? null,
      focusOutputs: asStringArray(focusTask.outputs),
      projectOutputs: asStringArray(projectTask.outputs),
      focusBlocker: asRecord(focusTask.blocker),
    },
    preservedPrimaryApprovalWait: {
      state: primaryApprovalWait.state ?? primaryApprovalWait.status ?? null,
      blocker: asRecord(primaryApprovalWait.blocker),
    },
    preservedSharedApprovalWait: {
      state: sharedApprovalWait.state ?? sharedApprovalWait.status ?? null,
      blocker: asRecord(sharedApprovalWait.blocker),
    },
    preservedNodeHttpProxyDecisionWait: {
      state:
        nodeHttpProxyDecisionWait.state ??
        nodeHttpProxyDecisionWait.status ??
        null,
      blocker: asRecord(nodeHttpProxyDecisionWait.blocker),
    },
  };
});

writeMemo(`# Focus branch frontier metadata reconciliation apply — 2026-07-13

Task: \`${repairTaskId}\`
Attempt: \`${attemptId}\`
Reviewed predecessor: \`${reviewedTaskId}\`

## Result

Applied a bounded app-state repair to refresh the focus branch nested metadata and \`project.context.current_focus_proposal\` so the active/review counts and linked task ids match the **current** live frontier excluding this repair task itself.

## Baseline used

Per task rules, the baseline excludes the assigned reconciliation/apply task \`${repairTaskId}\`.

- active: ${activeExcludingRepair.length > 0 ? activeExcludingRepair.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${reviewExcludingRepair.length > 0 ? reviewExcludingRepair.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${waitingExcludingRepair.length > 0 ? waitingExcludingRepair.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${runnableExcludingRepair.length > 0 ? runnableExcludingRepair.map((taskId) => `\`${taskId}\``).join(", ") : "none"}

## What changed

- refreshed \`focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711.context.progress_review\`
- refreshed \`focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711.context.observations\`
- refreshed \`project.context.current_focus_proposal\`
- preserved the same approval/owner-return wait lineage through:
  - \`${primaryApprovalWaitTaskId}\`
  - \`${sharedApprovalWaitTaskId}\`
  - \`${nodeHttpProxyDecisionWaitTaskId}\`

## Verification snapshot

\`focus.context.observations\` now records:

- \`frontier_active_leaf_count = ${activeExcludingRepair.length}\`
- \`frontier_review_leaf_count = ${reviewExcludingRepair.length}\`
- \`linked_active_task_ids = [${activeExcludingRepair.join(", ")}]\`
- \`linked_review_task_ids = [${reviewExcludingRepair.join(", ")}]\`

\`project.context.current_focus_proposal.reason\` now reflects the same baseline and keeps the no-live approval/owner-return posture unchanged.

## Script path

- \`scripts/ops-apply-reconcile-focus-branch-frontier-metadata-with-current-active-w-20260713.ts\`

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));

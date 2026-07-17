import assert from "node:assert/strict";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type Baseline = {
  rootReadout: JsonRecord;
  currentFocusProposal: JsonRecord;
  focusTask: JsonRecord;
  runtimeCurrentState: JsonRecord;
  runtimeCurrentFocus: JsonRecord;
  runtimeFocusMission: JsonRecord;
};

type PlannedState = {
  activeTaskIds: string[];
  reviewTaskIds: string[];
  waitingTaskIds: string[];
  runnableTaskIds: string[];
  blockedTaskIds: string[];
  proposedTaskIds: string[];
  blockedLeafCount: number;
  focusGoal: string;
  focusAcceptance0: string;
  focusSuccessCriteria0: string;
  focusProgressSummary: string;
  learnedOrVerified: string[];
  parallelLeafs: string;
  focusLaneLinks: JsonRecord;
  proposalReason: string;
  proposalContextProgressReview: JsonRecord;
};

const appDir = process.cwd();
const projectDir = `${appDir}/../aks-rp-e2e`;
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const apply = process.env.APPLY === "1";
const checkedAt = new Date().toISOString();
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops_apply-current-focus-review-frontier-metadata-drift-20260716_manual";

const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const projectTaskId = "project";
const selfTaskId = "ops/apply-current-focus-review-frontier-metadata-drift-20260716";
const evidencePath =
  "evidence/archive/ops-apply-current-focus-review-frontier-metadata-drift-20260716.md";

const staleFocusTaskIds = [
  "domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-artifact-review-20260717",
  "domain/recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716e",
  "domain/reconcile-app-routing-default-domain-shared-ddc-model-paths-20260716",
  "domain/repoll-windows-node-pool-create-virtualmachines-ado-run-172546766-after-2035-20260716",
  "ops/reconcile-current-unpublished-change-family-refresh-20260716",
  "ops/repair-stale-blocked-trigger-lineage-live-done-replacements-20260716",
  "verify-rp-nodepool-rollback-approval-controller-visible-lineage-after-dispatch-20260716",
  "domain/review-net-integration-outbound-migration-natgw-to-lb-ado-run-172566609-terminal-20260716",
  "fix-rp-regional-quota-public-create-path-run-172346097",
  "ops/reconcile-open-runtime-escalation-resume-hygiene-20260716",
  "ops/repair-westus2-managed-cluster-capacity-overdue-owner-return-lineage-20260716",
  "wait-private-cluster-privatelink-create-ado-run-172500530-result",
  "domain/publish-rp-regional-quota-review-visible-20260716",
] as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asMutableRecord(value: unknown): JsonRecord {
  return asRecord(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatList(taskIds: string[]): string {
  return taskIds.length > 0 ? taskIds.join(", ") : "none";
}

function buildBaseline(): Baseline {
  const runtime = asMutableRecord(loadProjectReadModel(appDir));
  const runtimeCurrentState = asMutableRecord(runtime.currentState);
  const runtimeCurrentFocus = asMutableRecord(runtime.currentFocus);
  const runtimeFocusMission = asMutableRecord(runtimeCurrentFocus.focusMission);

  let baseline: Baseline | undefined;
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);

    const projectContext = asMutableRecord(projectTask.context);
    const rootReadout = asMutableRecord(projectContext.current_root_readout);
    const currentFocusProposal = asMutableRecord(
      projectContext.current_focus_proposal,
    );

    const activeTaskIds = asStringArray(rootReadout.active_task_ids_excluding_self);
    const reviewTaskIds = asStringArray(rootReadout.review_task_ids);
    const blockedTaskIds = asStringArray(
      asMutableRecord(currentFocusProposal.context).blocked_task_ids,
    );

    for (const taskId of unique([
      ...activeTaskIds,
      ...reviewTaskIds,
      ...blockedTaskIds,
    ])) {
      assert(tree.tasks[taskId], `Referenced task not found: ${taskId}`);
    }

    baseline = {
      rootReadout,
      currentFocusProposal,
      focusTask: asMutableRecord(focusTask),
      runtimeCurrentState,
      runtimeCurrentFocus,
      runtimeFocusMission,
    };
  });

  assert(baseline, "Failed to build baseline");
  return baseline;
}

function buildPlannedState(baseline: Baseline): PlannedState {
  const liveSummary = summarizeTaskTree(config);
  const activeTaskIds = liveSummary.frontier.active.filter(
    (taskId) => taskId !== selfTaskId,
  );
  const reviewTaskIds = [...liveSummary.frontier.review];
  const waitingTaskIds = [...liveSummary.frontier.waiting];
  const runnableTaskIds = [...liveSummary.frontier.runnable];
  const blockedTaskIds = asStringArray(
    asMutableRecord(baseline.currentFocusProposal.context).blocked_task_ids,
  );
  const blockedLeafCount = Number(liveSummary.counts.blocked ?? 0);
  const proposedTaskIds = unique([
    ...activeTaskIds,
    ...reviewTaskIds,
    ...blockedTaskIds,
  ]);

  const activeList = formatList(activeTaskIds);
  const reviewList = formatList(reviewTaskIds);
  const blockedList = formatList(blockedTaskIds);

  const focusGoal =
    "Keep one visible 12-24h focus branch aligned to the current controller-visible root frontier: preserve the single active verification carrier domain/verify-rp-available-agent-pool-versions-ready-carrier-20260716, keep the exact live review band visible across direct normalization, private-cluster fix-forward, preflight validation, compact-package follow-through, and rp-cluster-lifecycle review, and preserve exact blocked publication/wait lineage without reopening execution from bookkeeping alone.";
  const focusAcceptance0 =
    `This focus branch is the single visible 12-24h mission and truthfully represents the controller-visible current root frontier: active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none].`;
  const focusSuccessCriteria0 =
    `Focus metadata and mirrored runtime focusMission surfaces represent the current controller-visible root frontier as active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none].`;
  const focusProgressSummary =
    `The focus metadata drift is now repaired against the live controller-visible root frontier. The represented frontier is active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${blockedLeafCount}. The superseded 7-active/11-review packet and its no-longer-live lane members are removed from the visible focus branch and mirrored focus surfaces without changing AKS domain truth or reopening execution.`;
  const learnedOrVerified = [
    `Current controller-visible root frontier is ${activeTaskIds.length} active / ${reviewTaskIds.length} review / ${waitingTaskIds.length} waiting / ${runnableTaskIds.length} runnable, with active non-self leaf/leaves ${activeList}.`,
    "The prior 7-active/11-review packet was stale; several ids it named are absent from the live task map and must not remain in focus metadata.",
    `The current review band is the exact ${reviewTaskIds.length}-leaf set ${reviewList}.`,
  ];
  const parallelLeafs =
    `Parallel work is filled with concrete leaves but not runnable backlog: ${activeTaskIds.length} active, ${reviewTaskIds.length} review, ${waitingTaskIds.length} waiting, and ${runnableTaskIds.length} runnable. Owner-loop throughput should come from consuming these exact leaves, not from inventing additional dispatch.`;

  const focusLaneLinks = {
    spec_generation: [
      "domain/normalize-direct-network-cni-cilium-dataplane-20260717",
      "domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
    ],
    execution_verification: [
      "domain/verify-rp-available-agent-pool-versions-ready-carrier-20260716",
      "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
    ],
    feature_extraction: ["reconcile-compact-loop-package-partial"],
    model_feedback: [
      "ops/reconcile-current-preflight-validation-active-carrier-20260716",
      "reconcile-spec-loop-pending-rp-cluster-lifecycle",
    ],
    publication_visibility: blockedTaskIds,
  } satisfies JsonRecord;

  const proposalReason =
    `Current root-contract non-repair frontier is active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${blockedLeafCount}. ` +
    `This controller-visible scope is mirrored across the focus branch and runtime focusMission while preserving blocked lineage ${blockedList}. ` +
    "The stale 7-active/11-review packet has been removed from focus metadata without broadening risk or changing AKS domain truth.";

  const proposalContextProgressReview = {
    reviewed_at: checkedAt,
    result: "updated",
    evidence_path: evidencePath,
    answers: {
      learned_or_verified: learnedOrVerified,
      live_execution_posture:
        "Stay in artifact/result and repo-local follow-through mode. This repair only restores truthful focus visibility; it does not justify a new focus-driven cloud wave.",
      blocker_mix:
        "The dominant blockers remain exact external/environment waits in the blocked lineage, while the active/review frontier is controller-visible follow-through across verification, direct normalization, compact-package truth repair, and preflight/spec-loop review.",
      parallel_leafs: parallelLeafs,
      goal_alignment:
        "This focus still matches the project goal because it keeps the controller-visible root frontier truthful, preserves exact blocked steward lineage, and prevents stale review packet residue from distorting owner-loop judgment.",
    },
  } satisfies JsonRecord;

  return {
    activeTaskIds,
    reviewTaskIds,
    waitingTaskIds,
    runnableTaskIds,
    blockedTaskIds,
    proposedTaskIds,
    blockedLeafCount,
    focusGoal,
    focusAcceptance0,
    focusSuccessCriteria0,
    focusProgressSummary,
    learnedOrVerified,
    parallelLeafs,
    focusLaneLinks,
    proposalReason,
    proposalContextProgressReview,
  };
}

function applyPlannedState(planned: PlannedState) {
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);

    focusTask.goal = planned.focusGoal;
    focusTask.acceptance = [
      planned.focusAcceptance0,
      "The focus keeps lane connection explicit across the exact current review band, the single current active carrier, and the preserved blocked publication/wait lineage only.",
      "The risk envelope stays bounded: no new focus-driven cloud mutation, no broad package reruns, no duplicate waits, and no promotion of stale non-live ids as live work.",
    ];

    const focusContext = asMutableRecord(focusTask.context);
    const successCriteria = asStringArray(focusContext.success_criteria);
    successCriteria[0] = planned.focusSuccessCriteria0;
    focusContext.success_criteria = successCriteria;

    const progressReview = asMutableRecord(focusContext.progress_review);
    const progressAnswers = asMutableRecord(progressReview.answers);
    progressAnswers.learned_or_verified = planned.learnedOrVerified;
    progressAnswers.parallel_leafs = planned.parallelLeafs;
    progressReview.answers = progressAnswers;
    progressReview.last_reviewed_at = checkedAt;
    progressReview.status = "updated";
    progressReview.summary = planned.focusProgressSummary;
    progressReview.evidence = [
      `Attempt ${attemptId} refreshed the stale 7-active/11-review packet using the current controller-visible root frontier only.`,
      `Evidence memo: ${evidencePath}`,
    ];
    focusContext.progress_review = progressReview;

    const observations = asMutableRecord(focusContext.observations);
    observations.frontier_active_leaf_count = planned.activeTaskIds.length;
    observations.frontier_review_leaf_count = planned.reviewTaskIds.length;
    observations.frontier_waiting_leaf_count = planned.waitingTaskIds.length;
    observations.frontier_runnable_leaf_count = planned.runnableTaskIds.length;
    observations.frontier_blocked_leaf_count = planned.blockedLeafCount;
    observations.parallel_work_gap =
      "The current focus is controller-visible follow-through only: keep the single active carrier, seven-leaf review band, and preserved blocked lineage truthful without reviving stale packet residue.";
    observations.structural_status =
      "Focus metadata now mirrors the current controller-visible root frontier rather than the superseded 7-active/11-review packet.";
    focusContext.observations = observations;

    focusContext.lane_links = planned.focusLaneLinks;
    focusContext.active_task_ids = planned.activeTaskIds;
    focusContext.review_task_ids = planned.reviewTaskIds;
    focusContext.waiting_task_ids = planned.waitingTaskIds;
    focusContext.runnable_task_ids = planned.runnableTaskIds;
    focusContext.linked_blocked_task_ids = planned.blockedTaskIds;
    focusContext.live_review_frontier_task_ids = planned.reviewTaskIds;
    focusContext.excluded_review_task_ids = [];
    focusTask.context = focusContext;
    focusTask.outputs = unique([...asStringArray(focusTask.outputs), evidencePath]);
    focusTask.updated_at = checkedAt;
    focusTask.trace = {
      ...asRecord(focusTask.trace),
      current_focus_review_frontier_metadata_drift_repaired_at: checkedAt,
      current_focus_review_frontier_metadata_drift_repaired_by: "app-ops-script",
      current_focus_review_frontier_metadata_drift_repair_attempt_id: attemptId,
      current_focus_review_frontier_metadata_drift_repair_evidence_path:
        evidencePath,
    };

    const projectContext = asMutableRecord(projectTask.context);
    const currentFocusProposal = asMutableRecord(
      projectContext.current_focus_proposal,
    );
    currentFocusProposal.reviewed_at = checkedAt;
    currentFocusProposal.reason = planned.proposalReason;
    currentFocusProposal.evidence_path = evidencePath;

    const proposalContext = asMutableRecord(currentFocusProposal.context);
    const proposalSuccessCriteria = asStringArray(proposalContext.success_criteria);
    proposalSuccessCriteria[0] = planned.focusSuccessCriteria0;
    proposalContext.success_criteria = proposalSuccessCriteria;
    proposalContext.active_task_ids = planned.activeTaskIds;
    proposalContext.review_task_ids = planned.reviewTaskIds;
    proposalContext.waiting_task_ids = planned.waitingTaskIds;
    proposalContext.runnable_task_ids = planned.runnableTaskIds;
    proposalContext.blocked_task_ids = planned.blockedTaskIds;
    proposalContext.proposed_task_ids = planned.proposedTaskIds;
    proposalContext.lane_links = planned.focusLaneLinks;
    proposalContext.linked_blocked_task_ids = planned.blockedTaskIds;
    proposalContext.live_review_frontier_task_ids = planned.reviewTaskIds;
    proposalContext.excluded_review_task_ids = [];
    proposalContext.progress_review = planned.proposalContextProgressReview;
    currentFocusProposal.context = proposalContext;
    projectContext.current_focus_proposal = currentFocusProposal;
    projectContext.current_focus_proposal_progress_review_refreshed_at = checkedAt;
    projectContext.current_focus_proposal_progress_review_refreshed_by =
      "app-ops-script";
    projectContext.current_focus_proposal_progress_review_evidence_path =
      evidencePath;
    projectTask.context = projectContext;
    projectTask.outputs = unique([...asStringArray(projectTask.outputs), evidencePath]);
    projectTask.updated_at = checkedAt;
    projectTask.trace = {
      ...asRecord(projectTask.trace),
      current_focus_review_frontier_metadata_drift_repaired_at: checkedAt,
      current_focus_review_frontier_metadata_drift_repaired_by: "app-ops-script",
      current_focus_review_frontier_metadata_drift_repair_attempt_id: attemptId,
      current_focus_review_frontier_metadata_drift_repair_evidence_path:
        evidencePath,
    };

    saveTaskTreeWithKanbanSnapshot(config, tree);
  });

  syncProjectReadout(config, checkedAt);

  const runtime = asMutableRecord(loadProjectReadModel(appDir));
  const currentState = asMutableRecord(runtime.currentState);
  const currentFocus = asMutableRecord(runtime.currentFocus);
  const focusMission = asMutableRecord(currentFocus.focusMission);
  const focusReview = asMutableRecord(currentFocus.focusReview);
  const focusPlan = asMutableRecord(runtime.focusPlan);

  focusMission.successCriteria = (() => {
    const existing = asStringArray(focusMission.successCriteria);
    existing[0] = planned.focusSuccessCriteria0;
    return existing;
  })();
  focusMission.activeTaskIds = planned.activeTaskIds;
  focusMission.reviewTaskIds = planned.reviewTaskIds;
  focusMission.waitingTaskIds = planned.waitingTaskIds;
  focusMission.runnableTaskIds = planned.runnableTaskIds;
  focusMission.linkedBlockedTaskIds = planned.blockedTaskIds;
  focusMission.liveReviewFrontierTaskIds = planned.reviewTaskIds;
  focusMission.excludedReviewTaskIds = [];
  focusMission.evidencePath = evidencePath;
  currentFocus.focusMission = focusMission;

  focusReview.evidencePath = evidencePath;
  currentFocus.focusReview = focusReview;

  saveProjectRuntimeState(appDir, {
    currentState,
    currentFocus,
    focusPlan,
    updatedAt: checkedAt,
  });
}

const baseline = buildBaseline();
const planned = buildPlannedState(baseline);

if (apply) {
  applyPlannedState(planned);
}

console.log(
  JSON.stringify(
    {
      apply,
      checkedAt,
      attemptId,
      evidencePath,
      baseline: {
        rootReadout: baseline.rootReadout,
        currentFocusProposal: baseline.currentFocusProposal,
        focusTask: {
          acceptance: baseline.focusTask.acceptance ?? null,
          context: asMutableRecord(baseline.focusTask.context),
        },
        runtimeCurrentFocus: baseline.runtimeCurrentFocus,
        runtimeFocusMission: baseline.runtimeFocusMission,
      },
      planned,
      staleFocusTaskIds,
      applyCommand: `cd ${appDir} && APPLY=1 ATTEMPT_ID=${attemptId} bun run ./scripts/ops-apply-current-focus-review-frontier-metadata-drift-20260716.ts`,
    },
    null,
    2,
  ),
);

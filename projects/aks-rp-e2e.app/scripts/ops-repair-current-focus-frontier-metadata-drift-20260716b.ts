import assert from "node:assert/strict";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type Baseline = {
  blockedLeafCount: number;
  topLevelBlockedIds: string[];
  currentFocusProposal: JsonRecord;
  currentRootReadout: JsonRecord;
  focusTask: JsonRecord;
  runtimeCurrentFocus: JsonRecord;
  runtimeFocusMission: JsonRecord;
  runtimeFocusReview: JsonRecord;
  runtimeFocusPlan: JsonRecord;
};

type PlannedState = {
  blockedLeafCount: number;
  topLevelBlockedIds: string[];
  reviewTaskIds: string[];
  activeTaskIds: string[];
  waitingTaskIds: string[];
  runnableTaskIds: string[];
  blockedLineageIds: string[];
  proposedTaskIds: string[];
  proposalTitle: string;
  proposalReason: string;
  proposalSuccessCriteria: string[];
  focusGoal: string;
  focusAcceptance: string[];
  focusProgressSummary: string;
  runtimeSummary: string;
  runtimeNextAction: string;
  runtimeFocusReviewNote: string;
  focusPlanSummary: string;
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
const attemptId = process.env.ATTEMPT_ID ?? "manual-run-no-attempt-id-supplied";

const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const projectTaskId = "project";
const fixNetworkTaskId = "fix-network-acns-retina-enterprise-run-172393474";
const scenarioReviewTaskId = "domain/normalize-scenario-tests-repo-frontier-20260715";
const localdnsReviewTaskId = "fix-localdns-auto-default-run-172310406";
const rpQuotaPublicWaitId = "reconcile-spec-loop-pending-rp-regional-quota";
const rpQuotaCompactWaitId =
  "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715";
const evidencePath =
  "evidence/archive/ops-repair-current-focus-frontier-metadata-drift-20260716b.md";

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
  const runtimeCurrentFocus = asMutableRecord(runtime.currentFocus);
  const runtimeFocusMission = asMutableRecord(runtimeCurrentFocus.focusMission);
  const runtimeFocusReview = asMutableRecord(runtimeCurrentFocus.focusReview);
  const runtimeFocusPlan = asMutableRecord(runtime.focusPlan);
  const runtimeCurrentState = asMutableRecord(runtime.currentState);
  const runtimeMetrics = asMutableRecord(runtimeCurrentState.metrics);

  let baseline: Baseline | undefined;
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    const fixNetworkTask = tree.tasks[fixNetworkTaskId];
    const scenarioReviewTask = tree.tasks[scenarioReviewTaskId];
    const localdnsReviewTask = tree.tasks[localdnsReviewTaskId];
    const rpQuotaPublicWait = tree.tasks[rpQuotaPublicWaitId];
    const rpQuotaCompactWait = tree.tasks[rpQuotaCompactWaitId];

    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);
    assert(fixNetworkTask, `Task not found: ${fixNetworkTaskId}`);
    assert.equal(
      fixNetworkTask.state,
      "blocked",
      `${fixNetworkTaskId} must stay blocked for this repair`,
    );
    assert(scenarioReviewTask, `Task not found: ${scenarioReviewTaskId}`);
    assert.equal(
      scenarioReviewTask.state,
      "review",
      `${scenarioReviewTaskId} must stay review for this repair`,
    );
    assert(localdnsReviewTask, `Task not found: ${localdnsReviewTaskId}`);
    assert.equal(
      localdnsReviewTask.state,
      "review",
      `${localdnsReviewTaskId} must stay review for this repair`,
    );
    assert(rpQuotaPublicWait, `Task not found: ${rpQuotaPublicWaitId}`);
    assert.equal(
      rpQuotaPublicWait.state,
      "blocked",
      `${rpQuotaPublicWaitId} must stay blocked for this repair`,
    );
    assert(rpQuotaCompactWait, `Task not found: ${rpQuotaCompactWaitId}`);
    assert.equal(
      rpQuotaCompactWait.state,
      "blocked",
      `${rpQuotaCompactWaitId} must stay blocked for this repair`,
    );

    const projectContext = asMutableRecord(projectTask.context);
    const currentRootReadout = asMutableRecord(projectContext.current_root_readout);
    const topLevelBlockedIds = asStringArray(currentRootReadout.top_level_blocked_ids);
    const blockedLeafCount = Number(
      runtimeMetrics.blockedLeafCount ?? asMutableRecord(projectTask.progress).blocked ?? 0,
    );

    baseline = {
      blockedLeafCount,
      topLevelBlockedIds,
      currentFocusProposal: asMutableRecord(projectContext.current_focus_proposal),
      currentRootReadout,
      focusTask: asMutableRecord(focusTask),
      runtimeCurrentFocus,
      runtimeFocusMission,
      runtimeFocusReview,
      runtimeFocusPlan,
    };
  });

  assert(baseline, "Failed to build baseline");
  return baseline;
}

function buildPlannedState(baseline: Baseline): PlannedState {
  const reviewTaskIds = [scenarioReviewTaskId, localdnsReviewTaskId];
  const activeTaskIds: string[] = [];
  const waitingTaskIds: string[] = [];
  const runnableTaskIds: string[] = [];
  const blockedLineageIds = unique([
    fixNetworkTaskId,
    rpQuotaPublicWaitId,
    rpQuotaCompactWaitId,
    ...baseline.topLevelBlockedIds,
  ]);
  const proposedTaskIds = unique([...reviewTaskIds, ...blockedLineageIds]);
  const blockedLeafCount = baseline.blockedLeafCount;
  const topLevelBlockedList = formatList(baseline.topLevelBlockedIds);
  const reviewList = formatList(reviewTaskIds);

  const proposalTitle = "review-only follow-through with exact blocked carriers";
  const proposalReason =
    `Current focus/readout truth repair: active=[none], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${blockedLeafCount}. ` +
    `${fixNetworkTaskId} remains a blocked exact-wait rather than an active focus carrier. ` +
    `${rpQuotaPublicWaitId} and ${rpQuotaCompactWaitId} remain the preserved rp-regional-quota blocked lineage, and exact top-level blocked steward waits remain ${topLevelBlockedList}.`;
  const proposalSuccessCriteria = [
    "No live active task ids are represented by focus metadata; archived helper holders and earlier state-hygiene repair ids are not surfaced as active or review work.",
    `${scenarioReviewTaskId} and ${localdnsReviewTaskId} are the only live review leaves represented across the focus branch and mirrored project-state surfaces.`,
    `${fixNetworkTaskId} remains a blocked exact-wait and is not advertised as an active focus carrier.`,
    `${rpQuotaPublicWaitId} remains the exact blocked public carrier and ${rpQuotaCompactWaitId} remains the compact blocked lineage while the preserved top-level blocked steward waits stay visible.`,
    `Project current-focus metadata and mirrored runtime focus surfaces represent active=[none], review=[${reviewList}], waiting=[none], runnable=[none].`,
  ];
  const focusGoal =
    "Keep one visible 12-24h focus branch aligned to the real root frontier: preserve repo-wide scenario-test normalization and localdns review visibility, keep fix-network-acns-retina-enterprise-run-172393474 as a blocked exact-wait rather than an active focus carrier, preserve the rp-regional-quota blocked lineage, and do not revive archived helper holders.";
  const focusAcceptance = [
    `This focus branch remains the single visible 12-24h mission for the project and stays synchronized with the current live frontier: active=[none], review=[${reviewList}], runnable=[none], waiting=[none].`,
    `${fixNetworkTaskId} remains blocked rather than active, ${rpQuotaPublicWaitId} plus ${rpQuotaCompactWaitId} preserve the blocked rp-regional-quota lineage, and no archived helper holder or earlier state-hygiene repair id is revived in focus metadata.`,
  ];
  const focusProgressSummary =
    `Direction remains low-risk and is resynced to the live tree: active=[none], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${blockedLeafCount}. ` +
    `${fixNetworkTaskId} remains a blocked exact-wait rather than an active focus carrier. ` +
    `${rpQuotaPublicWaitId} and ${rpQuotaCompactWaitId} still carry the rp-regional-quota blocked lineage truthfully; archived helper holders are no longer surfaced as active or review work.`;
  const runtimeSummary =
    `Current root-frontier follow-through is active=[none], review=[${reviewList}], waiting=[none], runnable=[none]. ` +
    `${fixNetworkTaskId} remains a blocked exact-wait rather than an active focus carrier. ` +
    `${rpQuotaPublicWaitId} and ${rpQuotaCompactWaitId} preserve the blocked rp-regional-quota lineage, and exact top-level blocked steward waits remain ${topLevelBlockedList}.`;
  const runtimeNextAction =
    `Keep the root contract truthful: preserve live review leaves ${reviewList}, keep ${fixNetworkTaskId} blocked rather than active, preserve exact blocked carrier lineage ${rpQuotaPublicWaitId} and ${rpQuotaCompactWaitId} plus top-level blocked steward waits ${topLevelBlockedList}, and do not revive archived helper holders from bookkeeping alone.`;
  const runtimeFocusReviewNote =
    `Readout sync refreshed the current focus contract. Current represented frontier is active=[none], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${blockedLeafCount}. ` +
    `${fixNetworkTaskId} remains blocked rather than active, ${rpQuotaPublicWaitId} and ${rpQuotaCompactWaitId} preserve the rp-regional-quota blocked lineage, and archived helper holders are no longer surfaced as active or review work.`;
  const focusPlanSummary =
    `Focus plan now mirrors the repaired current-focus contract: active=[none], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${blockedLeafCount}. ` +
    `${fixNetworkTaskId} remains blocked rather than active, ${rpQuotaPublicWaitId} and ${rpQuotaCompactWaitId} preserve the rp-regional-quota blocked lineage, and exact top-level blocked steward waits remain ${topLevelBlockedList}.`;

  return {
    blockedLeafCount,
    topLevelBlockedIds: baseline.topLevelBlockedIds,
    reviewTaskIds,
    activeTaskIds,
    waitingTaskIds,
    runnableTaskIds,
    blockedLineageIds,
    proposedTaskIds,
    proposalTitle,
    proposalReason,
    proposalSuccessCriteria,
    focusGoal,
    focusAcceptance,
    focusProgressSummary,
    runtimeSummary,
    runtimeNextAction,
    runtimeFocusReviewNote,
    focusPlanSummary,
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
    focusTask.acceptance = planned.focusAcceptance;

    const focusContext = asMutableRecord(focusTask.context);
    focusContext.success_criteria = planned.proposalSuccessCriteria;

    const progressReview = asMutableRecord(focusContext.progress_review);
    progressReview.last_reviewed_at = checkedAt;
    progressReview.status = "updated";
    progressReview.summary = planned.focusProgressSummary;
    progressReview.evidence = [
      `Attempt ${attemptId} repaired the focus branch metadata drift using the archived 20260716 apply package only as a recipe.`,
      `Evidence memo: ${evidencePath}`,
    ];
    focusContext.progress_review = progressReview;

    const observations = asMutableRecord(focusContext.observations);
    observations.frontier_active_leaf_count = 0;
    observations.frontier_review_leaf_count = planned.reviewTaskIds.length;
    observations.frontier_waiting_leaf_count = 0;
    observations.frontier_runnable_leaf_count = 0;
    observations.frontier_blocked_leaf_count = planned.blockedLeafCount;
    observations.linked_active_task_ids = planned.activeTaskIds;
    observations.linked_review_task_ids = planned.reviewTaskIds;
    observations.linked_exact_blocked_task_ids = [
      fixNetworkTaskId,
      rpQuotaPublicWaitId,
      rpQuotaCompactWaitId,
    ];
    observations.linked_blocked_task_ids = planned.blockedLineageIds;
    observations.recent_review_signal =
      `${fixNetworkTaskId} remains blocked rather than active while ${scenarioReviewTaskId} and ${localdnsReviewTaskId} remain the only live review leaves surfaced by focus metadata.`;
    observations.parallel_work_gap =
      "The gap is truthful follow-through: keep the review-only frontier and exact blocked lineage visible without reviving archived helper holders or earlier repair carriers.";
    observations.structural_status =
      "Current focus repair removes stale archived-helper references from active/review metadata, keeps fix-network blocked instead of active, and preserves the rp-regional-quota blocked lineage plus top-level waits.";
    focusContext.observations = observations;

    focusContext.lane_links = {
      source_spec_replay: [scenarioReviewTaskId],
      execution_verification: [localdnsReviewTaskId, fixNetworkTaskId],
      model_feedback: [rpQuotaCompactWaitId],
    };
    focusTask.context = focusContext;
    focusTask.outputs = unique([...asStringArray(focusTask.outputs), evidencePath]);
    focusTask.updated_at = checkedAt;
    focusTask.trace = {
      ...asRecord(focusTask.trace),
      current_focus_frontier_metadata_drift_repaired_at: checkedAt,
      current_focus_frontier_metadata_drift_repaired_by: "app-ops-script",
      current_focus_frontier_metadata_drift_repair_attempt_id: attemptId,
      current_focus_frontier_metadata_drift_repair_evidence_path: evidencePath,
    };

    const projectContext = asMutableRecord(projectTask.context);
    projectContext.current_focus_proposal = {
      id: focusTaskId,
      title: planned.proposalTitle,
      status: "updated",
      reviewed_at: checkedAt,
      needs_approval: false,
      reason: planned.proposalReason,
      evidence_path: evidencePath,
      context: {
        horizon: "12-24h",
        success_criteria: planned.proposalSuccessCriteria,
        active_task_ids: planned.activeTaskIds,
        review_task_ids: planned.reviewTaskIds,
        waiting_task_ids: planned.waitingTaskIds,
        runnable_task_ids: planned.runnableTaskIds,
        blocked_task_ids: planned.blockedLineageIds,
        proposed_task_ids: planned.proposedTaskIds,
        lane_links: {
          source_spec_replay: [scenarioReviewTaskId],
          execution_verification: [localdnsReviewTaskId, fixNetworkTaskId],
          model_feedback: [rpQuotaCompactWaitId],
        },
        linked_blocked_task_ids: planned.blockedLineageIds,
      },
    };
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
      current_focus_frontier_metadata_drift_repaired_at: checkedAt,
      current_focus_frontier_metadata_drift_repaired_by: "app-ops-script",
      current_focus_frontier_metadata_drift_repair_attempt_id: attemptId,
      current_focus_frontier_metadata_drift_repair_evidence_path: evidencePath,
    };

    saveTaskTreeWithKanbanSnapshot(config, tree);
  });

  syncProjectReadout(config, checkedAt);

  const runtime = asMutableRecord(loadProjectReadModel(appDir));
  const currentState = asMutableRecord(runtime.currentState);
  const currentFocus = asMutableRecord(runtime.currentFocus);
  const focusReview = asMutableRecord(currentFocus.focusReview);
  const focusMission = asMutableRecord(currentFocus.focusMission);
  const focusPlan = asMutableRecord(runtime.focusPlan);

  currentFocus.summary = planned.runtimeSummary;
  currentFocus.nextAction = planned.runtimeNextAction;
  currentFocus.activeTaskIds = planned.activeTaskIds;
  currentFocus.proposedTaskIds = planned.proposedTaskIds;

  focusReview.reviewedAt = checkedAt;
  focusReview.result = "updated";
  focusReview.note = planned.runtimeFocusReviewNote;
  focusReview.evidencePath = evidencePath;
  currentFocus.focusReview = focusReview;

  focusMission.id = focusTaskId;
  focusMission.title = planned.proposalTitle;
  focusMission.horizon = "12-24h";
  focusMission.successCriteria = planned.proposalSuccessCriteria;
  focusMission.activeTaskIds = planned.activeTaskIds;
  focusMission.reviewTaskIds = planned.reviewTaskIds;
  focusMission.waitingTaskIds = planned.waitingTaskIds;
  focusMission.runnableTaskIds = planned.runnableTaskIds;
  focusMission.linkedBlockedTaskIds = planned.blockedLineageIds;
  focusMission.evidencePath = evidencePath;
  currentFocus.focusMission = focusMission;

  focusPlan.summary = planned.focusPlanSummary;
  focusPlan.currentProposalId = focusTaskId;
  focusPlan.evidencePath = evidencePath;

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
        blockedLeafCount: baseline.blockedLeafCount,
        topLevelBlockedIds: baseline.topLevelBlockedIds,
        currentFocusProposal: {
          reason: baseline.currentFocusProposal.reason ?? null,
          context: asMutableRecord(baseline.currentFocusProposal.context),
        },
        focusTask: {
          goal: baseline.focusTask.goal ?? null,
          acceptance: Array.isArray(baseline.focusTask.acceptance)
            ? baseline.focusTask.acceptance
            : [],
          context: asMutableRecord(baseline.focusTask.context),
        },
        runtimeCurrentFocus: baseline.runtimeCurrentFocus,
        runtimeFocusMission: baseline.runtimeFocusMission,
        runtimeFocusReview: baseline.runtimeFocusReview,
        runtimeFocusPlan: baseline.runtimeFocusPlan,
      },
      planned,
      applyCommand: `cd ${appDir} && APPLY=1 ATTEMPT_ID=${attemptId} bun run ./scripts/ops-repair-current-focus-frontier-metadata-drift-20260716b.ts`,
      verifyCommands: [
        `cd ${appDir} && bun run task-tree show ${focusTaskId}`,
        `cd ${appDir} && bun run task-tree show ${projectTaskId}`,
        `cd ${appDir} && python - <<'PY'\nimport json\nfrom pathlib import Path\nstate=json.loads(Path('.state/project-state.json').read_text())\nprint(json.dumps({\n  'currentFocus': state.get('currentFocus'),\n  'focusPlan': state.get('focusPlan')\n}, indent=2))\nPY`,
      ],
    },
    null,
    2,
  ),
);

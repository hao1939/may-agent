import assert from "node:assert/strict";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type PlannedState = {
  proposalReason: string;
  proposalSuccessCriteria: string[];
  proposalActiveTaskIds: string[];
  proposalReviewTaskIds: string[];
  proposalWaitingTaskIds: string[];
  proposalRunnableTaskIds: string[];
  proposalBlockedTaskIds: string[];
  proposalTaskIds: string[];
  focusAcceptance0: string;
  focusProgressSummary: string;
  focusLinkedActiveTaskIds: string[];
  focusLinkedReviewTaskIds: string[];
  focusBlockedLeafCount: number;
  focusExecutionVerification: string[];
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

const repairTaskId =
  "ops-apply-reconcile-current-focus-proposal-archived-holder-metadata-20260716-task-tree-followup";
const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-current-focus-proposal-archived-holder-metadata-20260716-task-tree-followup.md";

const activeTaskIds = ["fix-network-acns-retina-enterprise-run-172393474"];
const reviewTaskIds = [
  "domain/normalize-scenario-tests-repo-frontier-20260715",
  "fix-localdns-auto-default-run-172310406",
];
const waitingTaskIds: string[] = [];
const runnableTaskIds: string[] = [];
const blockedTaskIds = [
  "reconcile-spec-loop-pending-rp-regional-quota",
  "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
  "ops/wait-project-approval-owner-return-primary-blocker-20260713",
  "ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized",
  "wait-ccp-coredns-pdb-disruption-budget-ado-run-172408613-result",
  "wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709",
  "wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709",
  "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
  "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711",
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
  "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
];
const proposedTaskIds = [
  ...activeTaskIds,
  ...reviewTaskIds,
  ...blockedTaskIds,
];

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

function buildPlannedState(): PlannedState {
  const proposalReason =
    "Current focus/readout truth repair: active=[fix-network-acns-retina-enterprise-run-172393474], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none], blocked=124. rp-regional-quota remains represented only through reconcile-spec-loop-pending-rp-regional-quota and hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715 plus the preserved top-level blocked steward waits.";
  const proposalSuccessCriteria = [
    "fix-network-acns-retina-enterprise-run-172393474 is the single live fix-forward carrier surfaced by the focus/readout metadata; archived helper holders are not represented as active work.",
    "domain/normalize-scenario-tests-repo-frontier-20260715 and fix-localdns-auto-default-run-172310406 are the only live review leaves represented in current-focus metadata.",
    "reconcile-spec-loop-pending-rp-regional-quota remains the exact blocked public carrier and hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715 remains the compact blocked lineage; top-level blocked steward waits stay preserved.",
    "Project current-focus metadata and mirrored runtime focus surfaces represent active=[fix-network-acns-retina-enterprise-run-172393474], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none].",
  ];
  const focusAcceptance0 =
    "This focus branch remains the single visible 12-24h mission for the project and stays synchronized with the current live frontier: active=[fix-network-acns-retina-enterprise-run-172393474], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], runnable=[none], waiting=[none].";
  const focusProgressSummary =
    "Direction remains low-risk and is resynced to the live tree: active=[fix-network-acns-retina-enterprise-run-172393474], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none], blocked=124. reconcile-spec-loop-pending-rp-regional-quota and hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715 still carry the rp-regional-quota blocked lineage truthfully; archived helper holders are no longer surfaced as active or review work.";
  const runtimeSummary =
    "Current root-frontier follow-through is active=[fix-network-acns-retina-enterprise-run-172393474], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none]. rp-regional-quota remains represented only through reconcile-spec-loop-pending-rp-regional-quota and hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715 plus preserved top-level blocked waits.";
  const runtimeNextAction =
    "Keep the root contract truthful: preserve active carrier fix-network-acns-retina-enterprise-run-172393474, preserve live review leaves domain/normalize-scenario-tests-repo-frontier-20260715 and fix-localdns-auto-default-run-172310406, preserve exact blocked carrier lineage reconcile-spec-loop-pending-rp-regional-quota and hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715 plus the top-level blocked steward waits, and do not revive archived helper holders from bookkeeping alone.";
  const runtimeFocusReviewNote =
    "Readout sync refreshed the current focus contract. Current represented frontier is active=[fix-network-acns-retina-enterprise-run-172393474], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none], blocked=124. rp-regional-quota remains represented only through reconcile-spec-loop-pending-rp-regional-quota and hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715 plus preserved top-level blocked steward waits; archived helper holders are no longer surfaced as active or review work.";
  const focusPlanSummary =
    "Focus plan now mirrors the repaired current-focus contract: active=[fix-network-acns-retina-enterprise-run-172393474], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none], blocked=124. rp-regional-quota remains represented only through reconcile-spec-loop-pending-rp-regional-quota and hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715 plus preserved top-level blocked steward waits.";

  return {
    proposalReason,
    proposalSuccessCriteria,
    proposalActiveTaskIds: activeTaskIds,
    proposalReviewTaskIds: reviewTaskIds,
    proposalWaitingTaskIds: waitingTaskIds,
    proposalRunnableTaskIds: runnableTaskIds,
    proposalBlockedTaskIds: blockedTaskIds,
    proposalTaskIds: proposedTaskIds,
    focusAcceptance0,
    focusProgressSummary,
    focusLinkedActiveTaskIds: activeTaskIds,
    focusLinkedReviewTaskIds: reviewTaskIds,
    focusBlockedLeafCount: 124,
    focusExecutionVerification: [
      "fix-network-acns-retina-enterprise-run-172393474",
      "fix-localdns-auto-default-run-172310406",
    ],
    runtimeSummary,
    runtimeNextAction,
    runtimeFocusReviewNote,
    focusPlanSummary,
  };
}

function buildBaseline() {
  const runtime = asMutableRecord(loadProjectReadModel(appDir));
  const currentFocus = asMutableRecord(runtime.currentFocus);
  const focusMission = asMutableRecord(currentFocus.focusMission);
  const focusReview = asMutableRecord(currentFocus.focusReview);
  const focusPlan = asMutableRecord(runtime.focusPlan);

  const treeSnapshot = withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);
    for (const taskId of unique([...activeTaskIds, ...reviewTaskIds, ...blockedTaskIds])) {
      assert(tree.tasks[taskId], `Referenced task not found: ${taskId}`);
    }
    const projectCurrentFocusProposal = asMutableRecord(
      asMutableRecord(projectTask.context).current_focus_proposal,
    );
    return {
      projectCurrentFocusProposal,
      focusTask,
    };
  });

  return {
    projectCurrentFocusProposal: treeSnapshot.projectCurrentFocusProposal,
    focusTask: treeSnapshot.focusTask,
    runtimeCurrentFocus: currentFocus,
    runtimeFocusMission: focusMission,
    runtimeFocusReview: focusReview,
    runtimeFocusPlan: focusPlan,
  };
}

function applyPlannedState(planned: PlannedState) {
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);

    focusTask.goal =
      "Keep one visible 12-24h focus branch aligned to the real root frontier: preserve fix-network-acns-retina-enterprise-run-172393474 as the single active carrier, keep repo-wide scenario-test normalization and localdns review visible, preserve the rp-regional-quota blocked lineage, and do not revive archived helper holders.";
    focusTask.acceptance = [
      planned.focusAcceptance0,
      "The branch truthfully reflects the current frontier, keeps the exact rp-regional-quota blocked lineage visible, and does not revive archived helper holders or unrelated review residue.",
    ];

    const focusContext = asMutableRecord(focusTask.context);
    focusContext.success_criteria = planned.proposalSuccessCriteria;
    const progressReview = asMutableRecord(focusContext.progress_review);
    progressReview.last_reviewed_at = checkedAt;
    progressReview.status = "updated";
    progressReview.summary = planned.focusProgressSummary;
    progressReview.evidence = [
      `Attempt ${attemptId} prepared and applied the archived-holder focus metadata repair through supported app mechanisms.`,
      `Evidence memo: ${evidencePath}`,
    ];
    focusContext.progress_review = progressReview;

    const observations = asMutableRecord(focusContext.observations);
    observations.frontier_active_leaf_count = planned.focusLinkedActiveTaskIds.length;
    observations.frontier_review_leaf_count = planned.focusLinkedReviewTaskIds.length;
    observations.frontier_waiting_leaf_count = 0;
    observations.frontier_runnable_leaf_count = 0;
    observations.frontier_blocked_leaf_count = planned.focusBlockedLeafCount;
    observations.linked_active_task_ids = planned.focusLinkedActiveTaskIds;
    observations.linked_review_task_ids = planned.focusLinkedReviewTaskIds;
    observations.linked_blocked_task_ids = planned.proposalBlockedTaskIds;
    observations.recent_review_signal =
      "fix-network-acns-retina-enterprise-run-172393474 is the live same-spec carrier while domain/normalize-scenario-tests-repo-frontier-20260715 and fix-localdns-auto-default-run-172310406 remain the only review leaves surfaced by focus metadata.";
    observations.parallel_work_gap =
      "The gap is truthful follow-through: keep the active carrier and exact blocked lineage visible without reviving archived helper holders.";
    observations.structural_status =
      "Current focus repair removes stale archived-helper references from active/review metadata while preserving the rp-regional-quota blocked lineage and top-level waits.";
    focusContext.observations = observations;

    focusContext.lane_links = {
      source_spec_replay: ["domain/normalize-scenario-tests-repo-frontier-20260715"],
      execution_verification: planned.focusExecutionVerification,
      model_feedback: [
        "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
      ],
    };
    focusTask.context = focusContext;
    focusTask.outputs = unique([...asStringArray(focusTask.outputs), evidencePath]);
    focusTask.updated_at = checkedAt;
    focusTask.trace = {
      ...asRecord(focusTask.trace),
      archived_holder_metadata_repaired_at: checkedAt,
      archived_holder_metadata_repaired_by: "app-ops-script",
      archived_holder_metadata_repair_attempt_id: attemptId,
      archived_holder_metadata_repair_evidence_path: evidencePath,
    };

    const projectContext = asMutableRecord(projectTask.context);
    projectContext.current_focus_proposal = {
      id: focusTaskId,
      title: "rp-regional-quota exact-wait normalization hold",
      status: "updated",
      reviewed_at: checkedAt,
      needs_approval: false,
      reason: planned.proposalReason,
      evidence_path: evidencePath,
      context: {
        horizon: "12-24h",
        success_criteria: planned.proposalSuccessCriteria,
        active_task_ids: planned.proposalActiveTaskIds,
        review_task_ids: planned.proposalReviewTaskIds,
        waiting_task_ids: planned.proposalWaitingTaskIds,
        runnable_task_ids: planned.proposalRunnableTaskIds,
        blocked_task_ids: planned.proposalBlockedTaskIds,
        proposed_task_ids: planned.proposalTaskIds,
        lane_links: {
          source_spec_replay: ["domain/normalize-scenario-tests-repo-frontier-20260715"],
          execution_verification: planned.focusExecutionVerification,
          model_feedback: [
            "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
          ],
        },
        linked_blocked_task_ids: planned.proposalBlockedTaskIds,
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
      archived_holder_metadata_repaired_at: checkedAt,
      archived_holder_metadata_repaired_by: "app-ops-script",
      archived_holder_metadata_repair_attempt_id: attemptId,
      archived_holder_metadata_repair_evidence_path: evidencePath,
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
  currentFocus.activeTaskIds = planned.proposalActiveTaskIds;
  currentFocus.proposedTaskIds = planned.proposalTaskIds;
  focusReview.reviewedAt = checkedAt;
  focusReview.result = "updated";
  focusReview.note = planned.runtimeFocusReviewNote;
  focusReview.evidencePath = evidencePath;
  currentFocus.focusReview = focusReview;

  focusMission.id = focusTaskId;
  focusMission.title = "rp-regional-quota exact-wait normalization hold";
  focusMission.horizon = "12-24h";
  focusMission.successCriteria = planned.proposalSuccessCriteria;
  focusMission.activeTaskIds = planned.proposalActiveTaskIds;
  focusMission.reviewTaskIds = planned.proposalReviewTaskIds;
  focusMission.waitingTaskIds = planned.proposalWaitingTaskIds;
  focusMission.runnableTaskIds = planned.proposalRunnableTaskIds;
  focusMission.linkedBlockedTaskIds = planned.proposalBlockedTaskIds;
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

const planned = buildPlannedState();
const baseline = buildBaseline();

const report = {
  apply,
  checkedAt,
  attemptId,
  evidencePath,
  baseline: {
    projectCurrentFocusProposal: {
      reason: baseline.projectCurrentFocusProposal.reason ?? null,
      success_criteria: asStringArray(
        asMutableRecord(baseline.projectCurrentFocusProposal.context).success_criteria,
      ),
      active_task_ids: asStringArray(
        asMutableRecord(baseline.projectCurrentFocusProposal.context).active_task_ids,
      ),
      review_task_ids: asStringArray(
        asMutableRecord(baseline.projectCurrentFocusProposal.context).review_task_ids,
      ),
      proposed_task_ids: asStringArray(
        asMutableRecord(baseline.projectCurrentFocusProposal.context).proposed_task_ids,
      ),
      lane_links: asMutableRecord(
        asMutableRecord(baseline.projectCurrentFocusProposal.context).lane_links,
      ),
    },
    focusTask: {
      goal: baseline.focusTask.goal ?? null,
      acceptance0: Array.isArray(baseline.focusTask.acceptance)
        ? baseline.focusTask.acceptance[0] ?? null
        : null,
      success_criteria: asStringArray(
        asMutableRecord(baseline.focusTask.context).success_criteria,
      ),
      progress_summary:
        asMutableRecord(asMutableRecord(baseline.focusTask.context).progress_review)
          .summary ?? null,
      linked_active_task_ids: asStringArray(
        asMutableRecord(asMutableRecord(baseline.focusTask.context).observations)
          .linked_active_task_ids,
      ),
      linked_review_task_ids: asStringArray(
        asMutableRecord(asMutableRecord(baseline.focusTask.context).observations)
          .linked_review_task_ids,
      ),
      lane_links: asMutableRecord(asMutableRecord(baseline.focusTask.context).lane_links),
    },
    runtime: {
      summary: baseline.runtimeCurrentFocus.summary ?? null,
      nextAction: baseline.runtimeCurrentFocus.nextAction ?? null,
      activeTaskIds: asStringArray(baseline.runtimeCurrentFocus.activeTaskIds),
      proposedTaskIds: asStringArray(baseline.runtimeCurrentFocus.proposedTaskIds),
      focusReviewNote: baseline.runtimeFocusReview.note ?? null,
      focusMissionSuccessCriteria: asStringArray(
        baseline.runtimeFocusMission.successCriteria,
      ),
      focusMissionActiveTaskIds: asStringArray(
        baseline.runtimeFocusMission.activeTaskIds,
      ),
      focusMissionReviewTaskIds: asStringArray(
        baseline.runtimeFocusMission.reviewTaskIds,
      ),
      focusMissionLinkedBlockedTaskIds: asStringArray(
        baseline.runtimeFocusMission.linkedBlockedTaskIds,
      ),
      focusPlanSummary: baseline.runtimeFocusPlan.summary ?? null,
    },
  },
  planned,
  applyCommand: `cd ${appDir} && APPLY=1 ATTEMPT_ID=${attemptId} bun run ./scripts/ops-apply-reconcile-current-focus-proposal-archived-holder-metadata-20260716.ts`,
  verifyCommands: [
    `cd ${appDir} && bun run task-tree show ${focusTaskId}`,
    `cd ${appDir} && bun run task-tree show ${projectTaskId}`,
    `cd ${appDir} && python - <<'PY'\nimport json\nfrom pathlib import Path\nstate=json.loads(Path('.state/project-state.json').read_text())\nprint(json.dumps({\n  'currentFocus': state.get('currentFocus'),\n  'focusPlan': state.get('focusPlan')\n}, indent=2))\nPY`,
  ],
};

if (apply) {
  applyPlannedState(planned);
}

console.log(JSON.stringify(report, null, 2));

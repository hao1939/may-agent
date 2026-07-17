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

const appDir = process.cwd();
const projectDir = `${appDir}/../aks-rp-e2e`;
const checkedAt = new Date().toISOString();
const worker = process.env.WORKER ?? "aks-explorer";
const evidencePath =
  "../aks-rp-e2e/evidence/archive/focus-progress-review-ready-path-starvation-followthrough-20260717c.md";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const projectTaskId = "project";
const executionWaitCandidates = [
  "wait-cluster-autoscaler-vm-prerelease-profile-matrix-ado-run-172674993-result",
  "wait-network-cni-cilium-enterprise-addon-vm-prerelease-ado-run-172675000-result",
  "wait-net-integration-nsg-route-table-in-use-vm-prerelease-ado-run-172672040-result",
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
  "wait-spec-open-service-mesh-addon-westus2-network-ownership-throttling-return-20260704",
];
const readySubsetLeafCandidates = [
  "domain/queue-egress-lockdown-vhd-ready-subset-20260717",
  "domain/queue-managementplane-addon-addonv2-ready-subset-20260717",
  "domain/queue-network-isolated-outbound-none-ready-subset-20260717",
  "domain/queue-policy-addon-basic-pubsub-ready-subset-20260717",
];
const followthroughRepairCandidates = [
  "ops/repair-rp-master-validation-compact-holder-review-output-20260717",
];
const blockedLineageIds = [
  "domain/publish-egress-lockdown-windows-baseline-review-visible-rerun-172493879-20260716",
  "ops/wait-project-approval-owner-return-primary-blocker-20260713",
  "ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized",
  "wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709",
  "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
  "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260716",
  "wait-compact-app-routing-vm-prerelease-environment-octet-return-20260717",
];
const readyPathSummary = {
  total: 15,
  represented: 15,
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function withEvidenceOutput(existing: unknown): string[] {
  return unique([...asStringArray(existing), evidencePath]);
}

const summary = summarizeTaskTree(config);
const activeTaskIds = [...summary.frontier.active].filter((id) => id !== focusTaskId);
const reviewTaskIds = unique([
  ...summary.frontier.review.filter((id) => id !== focusTaskId),
  focusTaskId,
]);
const executionWaitIds = executionWaitCandidates.filter((id) =>
  summary.frontier.blocked.includes(id),
);
const concreteReadySubsetLeafIds = readySubsetLeafCandidates.filter((id) =>
  activeTaskIds.includes(id),
);
const concreteFollowthroughRepairIds = followthroughRepairCandidates.filter((id) =>
  activeTaskIds.includes(id),
);
const activeList = activeTaskIds.join(", ") || "none";
const reviewList = reviewTaskIds.join(", ") || "none";
const executionWaitList = executionWaitIds.join(", ") || "none";
const readySubsetList = concreteReadySubsetLeafIds.join(", ") || "none";
const followthroughRepairList = concreteFollowthroughRepairIds.join(", ") || "none";

const successCriteria = [
  `The visible focus branch truthfully represents the live frontier as active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${summary.counts.blocked}.`,
  `The focus review records that all 15 current ready paths are represented by exact active leaves or exact waits, with queued-run waits [${executionWaitList}] and active ready-subset leaves [${readySubsetList}].`,
  `The next owner-loop work stays inside the current wave only: carry exact queued-run waits, let the active ready-subset leaves queue or block exactly, and finish follow-through repair leaves [${followthroughRepairList}] without launching extra cloud work from focus maintenance alone.`,
];
const focusGoal =
  `Keep one visible 12-24h focus branch on ready-path queue/wait follow-through: represent the live frontier as active=[${activeList}], review=[${reviewList}], keep current queued-run waits [${executionWaitList}] attached to exact same-lineage handling, keep active ready-subset leaves [${readySubsetList}] bounded to their exact ready paths, carry follow-through repairs [${followthroughRepairList}], and preserve blocked lineage without launching cloud work from bookkeeping alone.`;
const focusAcceptance = [
  `This focus branch is the single visible 12-24h mission and truthfully represents the current live frontier as active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none].`,
  `The branch explicitly names the concrete queue/wait mission rather than generic parity wording: exact waits [${executionWaitList}] plus active ready-subset leaves [${readySubsetList}].`,
  `The risk envelope remains bounded to current leaves and waits only: preserve blocked lineage [${blockedLineageIds.join(", ")}] and do not launch extra live work from focus maintenance alone.`,
];
const focusProgressSummary =
  `Focus remains on track after the ready-path starvation work turned into concrete queue/wait follow-through. Live frontier is active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${summary.counts.blocked}. All 15 ready paths are represented; the next work is exact queued-run review/waits plus active ready-subset leaves and current repair follow-through.`;
const runtimeSummary =
  `Ready-path queue/wait follow-through is the current focus: active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${summary.counts.blocked}. All 15 ready paths are represented by exact leaves or waits, and the current wave is about same-lineage queue/wait handling rather than new discovery.`;
const runtimeNextAction =
  `Refresh focus metadata, carry exact waits [${executionWaitList}], keep active ready-subset leaves [${readySubsetList}] moving, and finish follow-through repairs [${followthroughRepairList}] without broadening scope.`;
const runtimeFocusReviewNote =
  `Progress review refreshed the focus from generic parity into ready-path queue/wait follow-through. Current represented frontier is active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none]; all 15 ready paths are now linked to exact live leaves or waits.`;
const focusPlanSummary =
  `Focus plan now tracks ready-path queue/wait follow-through instead of generic parity: active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${summary.counts.blocked}; all 15 ready paths are represented by exact current leaves or waits.`;

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  const focusTask = tree.tasks[focusTaskId];
  assert(projectTask, `Task not found: ${projectTaskId}`);
  assert(focusTask, `Task not found: ${focusTaskId}`);

  focusTask.goal = focusGoal;
  focusTask.acceptance = focusAcceptance;
  focusTask.outputs = withEvidenceOutput(focusTask.outputs);

  const focusContext = asRecord(focusTask.context);
  focusContext.horizon = "12-24h";
  focusContext.success_criteria = successCriteria;
  focusContext.allowed_risk =
    "Allow exact queue/wait follow-through, active ready-subset leaf execution, and metadata refresh only. Do not launch extra cloud work from focus maintenance alone.";
  focusContext.needs_approval = false;
  focusContext.active_task_ids = [...activeTaskIds];
  focusContext.review_task_ids = [...reviewTaskIds];
  focusContext.waiting_task_ids = [];
  focusContext.runnable_task_ids = [];
  focusContext.linked_blocked_task_ids = [...blockedLineageIds];
  focusContext.live_review_frontier_task_ids = [...reviewTaskIds];
  focusContext.excluded_review_task_ids = [];
  focusContext.ready_path_total = readyPathSummary.total;
  focusContext.ready_path_represented_count = readyPathSummary.represented;
  focusContext.ready_subset_active_leaf_ids = [...concreteReadySubsetLeafIds];
  focusContext.exact_wait_ready_path_ids = [...executionWaitIds];

  const progressReview = asRecord(focusContext.progress_review);
  progressReview.last_reviewed_at = checkedAt;
  progressReview.status = "updated";
  progressReview.summary = focusProgressSummary;
  progressReview.evidence = [
    `Focus progress review evidence: ${evidencePath}`,
    `Ready-path starvation follow-up evidence: ../aks-rp-e2e/evidence/archive/ops-reconcile-ready-path-starvation-20260717.md`,
  ];
  progressReview.answers = {
    learned_or_verified: [
      `Live frontier is active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${summary.counts.blocked}.`,
      `All 15 ready paths are now represented; current exact waits are [${executionWaitList}] and current active ready-subset leaves are [${readySubsetList}].`,
      "This review corrected the stale project-level focus proposal: it now uses needs_approval=false and names the current queue/wait follow-through mission.",
    ],
    live_execution_posture:
      "Use the current queued runs and waits as the useful evidence source. Do not create extra focus-driven cloud work beyond the active exact leaves already in flight.",
    blocker_mix:
      "The old representation gap is closed for ready paths; immediate blockers are queued-run waits and the bounded follow-through leaves that remain active now.",
    parallel_leafs:
      `Current visible parallel work is ${summary.counts.active} active, ${summary.counts.review} review, 0 waiting, 0 runnable. The packet is concrete and feature-scoped rather than ceremonial.`,
    goal_alignment:
      "This sharpened focus stays aligned to the project goal by turning ready-path knowledge into exact queue, wait, and blocker handling without widening risk.",
  };
  focusContext.progress_review = progressReview;

  focusContext.observations = {
    frontier_active_leaf_count: summary.counts.active,
    frontier_review_leaf_count: summary.counts.review,
    frontier_waiting_leaf_count: summary.counts.waiting ?? 0,
    frontier_runnable_leaf_count: summary.counts.runnable ?? 0,
    frontier_blocked_leaf_count: summary.counts.blocked,
    ready_path_total: readyPathSummary.total,
    ready_path_represented_count: readyPathSummary.represented,
    metrics: {
      tasks_completed_24h: 590,
      live_started_24h: 0,
      live_succeeded_24h: 0,
      spec_unverified_count: 90,
      spec_failed_count: 0,
      unknown_path_count: 60,
    },
    parallel_work_gap:
      `The visible frontier is now concrete: ${summary.counts.active} active and ${summary.counts.review} review leaves. The remaining work is exact queued-run and blocker follow-through, not missing executable leaf work.`,
    structural_status:
      "Focus metadata and proposal now name the concrete ready-path queue/wait follow-through wave instead of a stale approval/parity packet.",
  };

  focusContext.lane_links = {
    source_discovery: [],
    feature_extraction: [],
    spec_generation: [],
    replay_implementation: [...concreteReadySubsetLeafIds],
    execution_verification: unique([...executionWaitIds, ...concreteReadySubsetLeafIds]),
    model_feedback: [],
    publication_visibility: [...blockedLineageIds],
  };
  focusTask.context = focusContext;
  focusTask.updated_at = checkedAt;
  focusTask.trace = {
    ...asRecord(focusTask.trace),
    progress_review_updated_at: checkedAt,
    progress_review_updated_by: worker,
    progress_review_evidence_path: evidencePath,
    ready_path_queue_wait_followthrough_refreshed_at: checkedAt,
    ready_path_queue_wait_followthrough_refreshed_by: worker,
    ready_path_queue_wait_followthrough_evidence_path: evidencePath,
  };

  const projectContext = asRecord(projectTask.context);
  projectContext.current_focus_proposal = {
    id: focusTaskId,
    title: "ready-path queue/wait follow-through",
    status: "updated",
    reviewed_at: checkedAt,
    needs_approval: false,
    reason:
      `Current focus remains inside the existing ready-subset / exact-wait risk envelope. Live frontier is active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${summary.counts.blocked}; all 15 ready paths are represented and the current wave is exact queue/wait follow-through rather than a new direction request.`,
    evidence_path: evidencePath,
    context: {
      horizon: "12-24h",
      success_criteria: successCriteria,
      active_task_ids: [...activeTaskIds],
      review_task_ids: [...reviewTaskIds],
      waiting_task_ids: [],
      runnable_task_ids: [],
      blocked_task_ids: [...blockedLineageIds],
      proposed_task_ids: unique([
        ...activeTaskIds,
        ...reviewTaskIds,
        ...blockedLineageIds,
      ]),
      lane_links: {
        source_discovery: [],
        feature_extraction: [],
        spec_generation: [],
        replay_implementation: [...concreteReadySubsetLeafIds],
        execution_verification: unique([...executionWaitIds, ...concreteReadySubsetLeafIds]),
        model_feedback: [],
        publication_visibility: [...blockedLineageIds],
      },
      linked_blocked_task_ids: [...blockedLineageIds],
      ready_path_total: readyPathSummary.total,
      ready_path_represented_count: readyPathSummary.represented,
      progress_review: {
        reviewed_at: checkedAt,
        result: "updated",
        evidence_path: evidencePath,
        answers: {
          learned_or_verified: [
            `All 15 ready paths are now represented by exact current leaves or waits; current waits are [${executionWaitList}] and current active ready-subset leaves are [${readySubsetList}].`,
            `Current live frontier is active=[${activeList}], review=[${reviewList}], waiting=[none], runnable=[none], blocked=${summary.counts.blocked}.`,
            "The project-level focus proposal no longer needs approval and no longer uses the stale app-routing quartet id in publication visibility.",
          ],
          live_execution_posture:
            "No extra focus-created cloud work; stay on the current exact queue/wait wave.",
          blocker_mix:
            "Primary remaining issue is focus metadata/readout drift plus current queued-run/wait follow-through, not missing ready-path decomposition.",
          parallel_leafs:
            `Concrete visible packet: ${summary.counts.active} active, ${summary.counts.review} review, 0 waiting, 0 runnable.`,
          goal_alignment:
            "The focus now names the real project work: exact ready-subset queue, wait, review, and blocker handling.",
        },
      },
    },
  };
  projectContext.current_focus_proposal_progress_review_refreshed_at = checkedAt;
  projectContext.current_focus_proposal_progress_review_refreshed_by = worker;
  projectContext.current_focus_proposal_progress_review_evidence_path = evidencePath;
  projectTask.context = projectContext;
  projectTask.outputs = withEvidenceOutput(projectTask.outputs);
  projectTask.updated_at = checkedAt;
  projectTask.trace = {
    ...asRecord(projectTask.trace),
    current_focus_proposal_progress_review_refreshed_at: checkedAt,
    current_focus_proposal_progress_review_refreshed_by: worker,
    current_focus_proposal_progress_review_evidence_path: evidencePath,
    ready_path_queue_wait_followthrough_refreshed_at: checkedAt,
    ready_path_queue_wait_followthrough_refreshed_by: worker,
    ready_path_queue_wait_followthrough_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

syncProjectReadout(config, checkedAt);

const runtime = asRecord(loadProjectReadModel(appDir));
const currentState = asRecord(runtime.currentState);
const currentFocus = asRecord(runtime.currentFocus);
const focusReview = asRecord(currentFocus.focusReview);
const focusMission = asRecord(currentFocus.focusMission);
const focusPlan = asRecord(runtime.focusPlan);

currentFocus.summary = runtimeSummary;
currentFocus.nextAction = runtimeNextAction;
currentFocus.activeTaskIds = [...activeTaskIds];
currentFocus.proposedTaskIds = unique([
  ...activeTaskIds,
  ...reviewTaskIds,
  ...executionWaitIds,
]);

focusReview.reviewedAt = checkedAt;
focusReview.result = "updated";
focusReview.note = runtimeFocusReviewNote;
focusReview.evidencePath = evidencePath;
currentFocus.focusReview = focusReview;

focusMission.id = focusTaskId;
focusMission.title = "ready-path queue/wait follow-through";
focusMission.horizon = "12-24h";
focusMission.successCriteria = successCriteria;
focusMission.activeTaskIds = [...activeTaskIds];
focusMission.reviewTaskIds = [...reviewTaskIds];
focusMission.waitingTaskIds = [];
focusMission.runnableTaskIds = [];
focusMission.linkedBlockedTaskIds = [...blockedLineageIds];
focusMission.evidencePath = evidencePath;
currentFocus.focusMission = focusMission;

focusPlan.summary = focusPlanSummary;
focusPlan.currentProposalId = focusTaskId;
focusPlan.evidencePath = evidencePath;

saveProjectRuntimeState(appDir, {
  currentState,
  currentFocus,
  focusPlan,
  updatedAt: checkedAt,
});

console.log(
  JSON.stringify(
    {
      checkedAt,
      worker,
      evidencePath,
      activeTaskIds,
      reviewTaskIds,
      executionWaitIds,
      concreteReadySubsetLeafIds,
      concreteFollowthroughRepairIds,
      successCriteria,
      runtimeSummary,
    },
    null,
    2,
  ),
);

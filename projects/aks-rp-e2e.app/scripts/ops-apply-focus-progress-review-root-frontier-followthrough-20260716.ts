import { resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock, type TaskNode } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const projectTaskId = "project";
const evidencePath =
  "../aks-rp-e2e/evidence/archive/focus-progress-review-root-frontier-followthrough-20260716e.md";
const focusTitle = "root-frontier artifact review and direct-normalization follow-through";

const blockedTaskIds = [
  "domain/publish-egress-lockdown-windows-baseline-review-visible-rerun-172493879-20260716",
  "domain/publish-rp-regional-quota-review-visible-20260716",
  "reconcile-spec-loop-pending-rp-regional-quota",
  "ops/wait-project-approval-owner-return-primary-blocker-20260713",
  "ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized",
  "wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709",
  "wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709",
  "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
  "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260716",
] as const;

const metrics = {
  tasks_completed_24h: 564,
  live_started_24h: 0,
  live_succeeded_24h: 0,
  spec_unverified_count: 90,
  spec_failed_count: 0,
  unknown_path_count: 60,
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
  return [...new Set(values)];
}

function assertTask(treeTask: TaskNode | undefined, id: string): TaskNode {
  if (!treeTask) throw new Error(`Task not found: ${id}`);
  return treeTask;
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: "aks-explorer",
  maxConcurrent: 1,
});

const summary = summarizeTaskTree(config);
const activeTaskIds = [...summary.frontier.active];
const reviewTaskIds = [...summary.frontier.review];

const laneLinks = {
  source_discovery: [
    "domain/reconcile-app-routing-default-domain-shared-ddc-model-paths-20260716",
  ],
  feature_extraction: ["reconcile-compact-loop-package-partial"],
  spec_generation: [
    "domain/normalize-direct-network-cni-cilium-dataplane-20260717",
    "domain/normalize-direct-rp-new-vnet-vm-prerelease-20260717",
  ],
  replay_implementation: [
    "fix-private-cluster-private-endpoint-connections-lifecycle-run-172513872",
    "fix-rp-regional-quota-public-create-path-run-172346097",
  ],
  execution_verification: [
    "domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-artifact-review-20260717",
    "domain/recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716e",
    "domain/repoll-windows-node-pool-create-virtualmachines-ado-run-172546766-after-2035-20260716",
    "domain/review-net-integration-outbound-migration-natgw-to-lb-ado-run-172566609-terminal-20260716",
    "wait-private-cluster-privatelink-create-ado-run-172500530-result",
  ],
  model_feedback: [
    "domain/reconcile-app-routing-default-domain-shared-ddc-model-paths-20260716",
    "ops/reconcile-current-preflight-validation-active-carrier-20260716",
    "ops/reconcile-current-unpublished-change-family-refresh-20260716",
    "ops/repair-stale-blocked-trigger-lineage-live-done-replacements-20260716",
    "ops/repair-westus2-managed-cluster-capacity-overdue-owner-return-lineage-20260716",
  ],
  publication_visibility: [...blockedTaskIds],
  ops_enablers: [
    "ops/reconcile-current-preflight-validation-active-carrier-20260716",
    "ops/reconcile-current-unpublished-change-family-refresh-20260716",
    "ops/reconcile-open-runtime-escalation-resume-hygiene-20260716",
    "ops/repair-stale-blocked-trigger-lineage-live-done-replacements-20260716",
  ],
};

const successCriteria = [
  `Focus metadata and mirrored runtime focus surfaces represent the live 12-24h mission as active=[${activeTaskIds.join(", ")}], review=[${reviewTaskIds.join(", ")}], waiting=[none], runnable=[none]].`,
  "The next 12-24h stays inside the approved low-risk envelope: exact same-run artifact review, direct normalization, bounded holder/readout hygiene, and model/wait reconciliation only; no new focus-driven cloud mutation, no broad package reruns, and no duplicate waits.",
  "The active same-run review and hygiene carriers must either yield sharper successor tasks, refreshed exact waits, or bounded model/readout corrections from current evidence rather than opening a fresh live wave.",
  "Review-band work remains concrete and lane-linked: direct normalization leaves, bounded fix-forwards, compact/package-partial truth repair, current preflight/runtime-escalation hygiene, and exact private-cluster result review are the next executable owner-loop leaves after the active frontier.",
] as const;

const progressSummary =
  `The previously approved low-risk focus is still directionally valid, but the durable focus branch had drifted behind the real frontier. Live throughput remains flat at ${metrics.live_started_24h} started / ${metrics.live_succeeded_24h} succeeded in the last 24h, while the owner loop is currently carrying ${activeTaskIds.length} active leaves and ${reviewTaskIds.length} review leaves centered on exact same-run artifact review, direct-normalization follow-through, and bounded app/root-frontier hygiene. This pass refreshes the visible focus branch to that live frontier without widening risk or asking for a new live wave.`;

const proposalReason =
  `Current focus direction stays low-risk and useful, but the durable focus branch and mirrored runtime success criteria lagged the real root frontier after planner follow-through changed the live active/review mix to ${activeTaskIds.length} active / ${reviewTaskIds.length} review leaves. Refresh the focus branch to that live frontier so normal owner-loop work keeps moving inside a truthful 12-24h mission without changing the risk envelope.`;

const focusSummary =
  `Current 12-24h focus stays on zero-live-throughput follow-through: ${activeTaskIds.length} active leaves cover exact same-run artifact review plus app/root-frontier hygiene, while the review band carries direct normalization, bounded fix-forward, compact/package-partial truth repair, and private-cluster result follow-through. Preserved blocked carrier lineage remains publication-safe holders and top-level steward waits only.`;

const focusNextAction =
  "Finish the active leaves first, then consume the review band in place: direct-normalization tasks, exact fix-forward reviews, compact/package-partial truth repair, and private-cluster result follow-through. Keep blocked publication/wait carriers unchanged and do not launch new focus-driven live mutation from focus maintenance alone.";

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = assertTask(tree.tasks[projectTaskId], projectTaskId);
  const focusTask = assertTask(tree.tasks[focusTaskId], focusTaskId);

  focusTask.goal =
    "Keep one visible 12-24h focus branch aligned to the real frontier: exact same-run artifact review for the current returned ADO carriers, direct-normalization follow-through for the review-ready scenario migrations, bounded app/root-frontier hygiene, and preserved publication-safe blocked carriers while zero-live-throughput makes new focus-driven cloud work unjustified.";
  focusTask.acceptance = [
    `This focus branch is the single visible 12-24h mission and truthfully represents active=[${activeTaskIds.join(", ")}], review=[${reviewTaskIds.join(", ")}], waiting=[none], runnable=[none]].`,
    "The focus keeps lane connection explicit across source discovery, feature extraction, spec generation, replay implementation, execution/verification, model feedback, publication visibility, and bounded ops enablers.",
    "The risk envelope stays bounded: no new focus-driven cloud mutation, no broad package reruns, no duplicate waits, and no promotion of stale archived helper holders as live work.",
  ];

  const focusContext = asRecord(focusTask.context);
  focusContext.horizon = "12-24h";
  focusContext.success_criteria = [...successCriteria];
  focusContext.allowed_risk =
    "Allow only exact same-run artifact review, direct normalization, bounded holder/readout hygiene, model/wait reconciliation, and publication-safe blocker stewardship. Do not launch fresh package-level or same-input live execution from focus maintenance alone.";
  focusContext.needs_approval = false;
  focusContext.lane_links = laneLinks;
  focusContext.active_task_ids = [...activeTaskIds];
  focusContext.review_task_ids = [...reviewTaskIds];
  focusContext.waiting_task_ids = [];
  focusContext.runnable_task_ids = [];
  focusContext.linked_blocked_task_ids = [...blockedTaskIds];
  focusContext.live_review_frontier_task_ids = [...reviewTaskIds];
  focusContext.excluded_review_task_ids = [];

  const progressReview = asRecord(focusContext.progress_review);
  progressReview.last_reviewed_at = appliedAt;
  progressReview.status = "updated";
  progressReview.summary = progressSummary;
  progressReview.evidence = [
    `Metrics sample: task.completed-24h=${metrics.tasks_completed_24h}, run.live-started-24h=${metrics.live_started_24h}, run.live-succeeded-24h=${metrics.live_succeeded_24h}, spec.unverified-count=${metrics.spec_unverified_count}, spec.failed-count=${metrics.spec_failed_count}, model.unknown-path-count=${metrics.unknown_path_count}.`,
    `Evidence memo: ${evidencePath}`,
  ];
  progressReview.answers = {
    learned_or_verified: [
      `No new live evidence arrived; progress since the prior focus refresh came from frontier turnover into ${activeTaskIds.length} exact active leaves rather than from a new cloud wave.`,
      "The older Storage CSI / rp-master-validation-centered focus metadata was no longer truthful relative to the live frontier and needed explicit task-tree repair rather than another narrative-only runtime sync.",
      `The current review band remains concrete and executable at ${reviewTaskIds.length} leaves: direct normalization, same-spec fix-forward review, current preflight/runtime hygiene, compact package-partial truth repair, and exact private-cluster result review.`,
    ],
    live_execution_posture:
      "Stay in artifact/result and repo-local follow-through mode. Metrics still show run.live-started-24h=0 and run.live-succeeded-24h=0, so the best next evidence is exact same-run review, normalization, and sharper wait/model repair rather than a new focus-driven cloud wave.",
    blocker_mix:
      "The dominant blockers remain external/environment waits in the blocked frontier, while the active/review band is mostly local task decomposition: same-run artifact review, direct normalization, publication-safe holder stewardship, and app-owned lineage/readout hygiene.",
    parallel_leafs:
      `Parallel work is filled with concrete leaves but not runnable backlog: ${activeTaskIds.length} active, ${reviewTaskIds.length} review, 0 waiting, and 0 runnable. Owner-loop throughput should come from consuming these exact leaves, not from inventing additional dispatch.`,
    goal_alignment:
      "This focus still matches the project goal because it keeps the source/spec/model lanes alive through direct normalization and shared-source reconciliation, consumes exact execution evidence from current ADO lineages, and feeds sharper waits/model updates back into the knowledge map without broadening live execution risk.",
  };
  focusContext.progress_review = progressReview;

  focusContext.observations = {
    frontier_active_leaf_count: activeTaskIds.length,
    frontier_review_leaf_count: reviewTaskIds.length,
    frontier_waiting_leaf_count: 0,
    frontier_runnable_leaf_count: 0,
    frontier_blocked_leaf_count: summary.counts.blocked,
    metrics,
    parallel_work_gap:
      "There is no runnable queue; the next 12-24h depends on the live active/review frontier, with blocked stewardship staying exact rather than being turned into cosmetic dispatch.",
    structural_status:
      "The approved low-risk direction still holds, but the focus branch itself needed repair because task-tree and runtime focus surfaces no longer matched the real frontier after planner follow-through.",
  };

  focusTask.context = focusContext;
  focusTask.outputs = unique([...asStringArray(focusTask.outputs), evidencePath]);
  focusTask.updated_at = appliedAt;
  focusTask.trace = {
    ...asRecord(focusTask.trace),
    progress_review_updated_at: appliedAt,
    progress_review_updated_by: "aks-explorer",
    progress_review_evidence_path: evidencePath,
  };

  const projectContext = asRecord(projectTask.context);
  projectContext.current_focus_proposal = {
    id: focusTaskId,
    title: focusTitle,
    status: "updated",
    reviewed_at: appliedAt,
    needs_approval: false,
    reason: proposalReason,
    evidence_path: evidencePath,
    context: {
      horizon: "12-24h",
      success_criteria: [...successCriteria],
      active_task_ids: [...activeTaskIds],
      review_task_ids: [...reviewTaskIds],
      waiting_task_ids: [],
      runnable_task_ids: [],
      blocked_task_ids: [...blockedTaskIds],
      proposed_task_ids: [...activeTaskIds, ...reviewTaskIds, ...blockedTaskIds],
      lane_links: laneLinks,
      linked_blocked_task_ids: [...blockedTaskIds],
      progress_review: {
        reviewed_at: appliedAt,
        result: "updated",
        evidence_path: evidencePath,
        answers: progressReview.answers,
      },
    },
  };
  projectContext.current_focus_proposal_progress_review_refreshed_at = appliedAt;
  projectContext.current_focus_proposal_progress_review_refreshed_by =
    "aks-explorer";
  projectContext.current_focus_proposal_progress_review_evidence_path = evidencePath;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...asStringArray(projectTask.outputs), evidencePath]);
  projectTask.updated_at = appliedAt;
  projectTask.trace = {
    ...asRecord(projectTask.trace),
    current_focus_progress_review_refreshed_at: appliedAt,
    current_focus_progress_review_refreshed_by: "aks-explorer",
    current_focus_progress_review_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const runtime = loadProjectReadModel(appDir) as JsonRecord;
const currentFocus = asRecord(runtime.currentFocus);
const focusReview = asRecord(currentFocus.focusReview);
const focusMission = asRecord(currentFocus.focusMission);
const focusPlan = asRecord(runtime.focusPlan);

currentFocus.summary = focusSummary;
currentFocus.nextAction = focusNextAction;
currentFocus.activeTaskIds = [...activeTaskIds];
currentFocus.proposedTaskIds = [...activeTaskIds, ...reviewTaskIds, ...blockedTaskIds];
focusReview.reviewedAt = appliedAt;
focusReview.result = "updated";
focusReview.note = proposalReason;
focusReview.evidencePath = evidencePath;
currentFocus.focusReview = focusReview;
focusMission.id = focusTaskId;
focusMission.title = focusTitle;
focusMission.horizon = "12-24h";
focusMission.successCriteria = [...successCriteria];
focusMission.activeTaskIds = [...activeTaskIds];
focusMission.reviewTaskIds = [...reviewTaskIds];
focusMission.waitingTaskIds = [];
focusMission.runnableTaskIds = [];
focusMission.linkedBlockedTaskIds = [...blockedTaskIds];
focusMission.evidencePath = evidencePath;
focusMission.liveReviewFrontierTaskIds = [...reviewTaskIds];
focusMission.excludedReviewTaskIds = [];
currentFocus.focusMission = focusMission;
currentFocus.focusPlanId = focusTaskId;
currentFocus.focusPlanStatus = "review";

focusPlan.summary = focusSummary;
focusPlan.currentProposalId = focusTaskId;
focusPlan.evidencePath = evidencePath;

saveProjectRuntimeState(appDir, {
  ...runtime,
  currentFocus,
  focusPlan,
  updatedAt: appliedAt,
});

console.log(
  JSON.stringify(
    {
      appliedAt,
      evidencePath,
      activeTaskIds,
      reviewTaskIds,
      blockedTaskIds,
      successCriteria,
      focusTitle,
    },
    null,
    2,
  ),
);

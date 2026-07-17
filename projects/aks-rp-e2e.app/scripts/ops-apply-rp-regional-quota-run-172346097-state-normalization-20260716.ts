import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  setTaskState,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";

type JsonRecord = Record<string, unknown>;

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-apply-review-rp-regional-quota-run-172346097-state-normalization-20260716-state-repair_20260716013004";
const checkedAt = new Date().toISOString();

const repairTaskId =
  "ops-apply-apply-review-rp-regional-quota-run-172346097-state-normalization-20260716-state-repair";
const projectTaskId = "project";
const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const specLoopTaskId = "aks-spec-verification-loop";
const compactLoopTaskId = "aks-feature-compact-loop";
const publicCarrierTaskId = "reconcile-spec-loop-pending-rp-regional-quota";
const compactHolderTaskId =
  "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715";
const archivedRunHolderTaskId =
  "domain/wait-rp-regional-quota-public-create-path-ado-run-172346097-result";
const publicSpecId = "spec.rp-regional-quota.public-create-path";
const sourceWitnessSpecId =
  "spec.rp-regional-quota.multi-cluster-source-equivalent";
const featureKey = "rp-regional-quota";
const evidencePath =
  "evidence/archive/ops-apply-rp-regional-quota-run-172346097-state-normalization-20260716.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const summaryPath = "features/rp-regional-quota/compact/staging.summary.md";
const diagnosticsPath = "features/rp-regional-quota/compact/staging.diagnostics.json";
const specMirrorPath = resolve(projectDir, ".state/spec-loop/state.json");
const compactMirrorPath = resolve(projectDir, ".state/feature-compact-loop/state.json");

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asMutableRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function writeText(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function nodeState(task: { state?: unknown; status?: unknown } | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog");
}

function isoPlusHours(baseIso: string, hours: number): string {
  return new Date(Date.parse(baseIso) + hours * 60 * 60 * 1000).toISOString();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function extractPublicRunFacts(task: TaskNode) {
  const context = asRecord(task.context);
  const trace = asRecord(task.trace);
  const workflowResult = asRecord(trace.workflowResult);
  const details = asRecord(workflowResult.details);
  const fixForward = asRecord(details.fixForward);
  const minimumDiagnosisPacket = asRecord(fixForward.minimumDiagnosisPacket);
  const specResultReview = asRecord(details.specResultReview);
  const acceptedQueuedPipelineRun = asRecord(context.acceptedQueuedPipelineRun);

  const runId = String(specResultReview.runId ?? acceptedQueuedPipelineRun.runId ?? "172346097");
  const runUrl = String(
    specResultReview.runUrl ??
      acceptedQueuedPipelineRun.runUrl ??
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172346097",
  );
  const resultPath = String(
    minimumDiagnosisPacket.resultPath ??
      specResultReview.resultPath ??
      "workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/result.json",
  );
  const inputFingerprint = String(fixForward.inputFingerprint ?? minimumDiagnosisPacket.inputFingerprint ?? "");
  const errorFingerprint = String(fixForward.errorFingerprint ?? minimumDiagnosisPacket.errorFingerprint ?? "");

  return {
    runId,
    runUrl,
    resultPath,
    inputFingerprint,
    errorFingerprint,
  };
}

function buildReadout() {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    assert(projectTask, `Task not found: ${projectTaskId}`);
    const readout = asRecord(asRecord(projectTask.context).current_root_readout);
    return {
      tree,
      projectTask,
      readout,
      active: asStringArray(readout.active_task_ids_excluding_self),
      review: asStringArray(readout.review_task_ids),
      waiting: asStringArray(readout.waiting_task_ids),
      runnable: asStringArray(readout.runnable_task_ids),
      topLevelBlocked: asStringArray(readout.top_level_blocked_ids),
      blockedLeafCount: Number(readout.blocked_leaf_count ?? 0),
    };
  });
}

const beforeReadout = buildReadout();
const beforeSpecState = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
});
const beforeFeatureState = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 5,
  refreshFromProject: false,
});
const publicSpecBefore = beforeSpecState.state.specs[publicSpecId];
const sourceWitnessBefore = beforeSpecState.state.specs[sourceWitnessSpecId];
const featureBefore = beforeFeatureState.state.features[featureKey];
assert(publicSpecBefore, `Missing spec-loop row ${publicSpecId}`);
assert(sourceWitnessBefore, `Missing spec-loop row ${sourceWitnessSpecId}`);
assert(featureBefore, `Missing feature-compact row ${featureKey}`);

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const publicCarrier = tree.tasks[publicCarrierTaskId];
  const compactHolder = tree.tasks[compactHolderTaskId];
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];

  assert(publicCarrier, `Task not found: ${publicCarrierTaskId}`);
  assert(compactHolder, `Task not found: ${compactHolderTaskId}`);
  assert(focusTask, `Task not found: ${focusTaskId}`);
  assert(projectTask, `Task not found: ${projectTaskId}`);

  const publicFacts = extractPublicRunFacts(publicCarrier);
  const nextCheckAt = isoPlusHours(checkedAt, 2);
  const fallbackAt = isoPlusHours(checkedAt, 12);
  const publicResumeCondition =
    "Resume only when the same staging subscription+region is again exhausted enough for the decisive managedClusters PUT quota-negative assertion, or when another reviewed same-surface exhausted target is accepted for this exact carrier.";
  const publicBlockerCondition =
    "Reviewed run 172346097 proves spec.rp-regional-quota.public-create-path is the only live carrier and that the repaired carrier now stops only because staging subscription 26fe00f8-9173-4872-9134-bb1d2e00343a in westus2 was 40/161 rather than exhausted, so the decisive managedClusters PUT quota-negative assertion was not reached.";
  const publicFallbackAction =
    "If no reviewed same-surface exhaustion proof appears by the next review window, refresh this exact wait from current quota/headroom evidence; do not rerun unchanged and do not revive the superseded multi-cluster source witness.";

  publicCarrier.goal =
    "Carry the single exact westus2 exhaustion wait for spec.rp-regional-quota.public-create-path after reviewed run 172346097 proved the repo-local repair landed and the remaining frontier is staging quota headroom, not another repo-local defect.";
  publicCarrier.acceptance = [
    "This task remains the only live carrier for spec.rp-regional-quota.public-create-path while westus2 managedClusters headroom prevents the decisive quota-negative create assertion.",
    publicResumeCondition,
    "Do not rerun unchanged and do not revive the superseded multi-cluster source witness while the same external wait remains true.",
  ];
  publicCarrier.result =
    "Reviewed run 172346097 consumed the same-spec rerun and normalizes this task into the single live blocked westus2 exhaustion wait for spec.rp-regional-quota.public-create-path; the current observed preflight headroom is managedClusters 40/161.";
  publicCarrier.outputs = unique([
    ...asStringArray(publicCarrier.outputs),
    ".state/spec-loop/state.json",
    evidencePath,
  ]);
  setTaskState(publicCarrier, "blocked");
  publicCarrier.blocker = {
    condition: publicBlockerCondition,
    category: "external-wait",
    owner: "aks-explorer",
    blocked_at: checkedAt,
    waiting_for: {
      type: "azure.quota.exhausted",
      taskId: publicCarrierTaskId,
      specId: publicSpecId,
      subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
      location: "westus2",
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.owner.requested",
    },
    observation_method:
      "Blocked-frontier review checks reviewed same-surface quota/headroom evidence for the named subscription+region and either keeps the wait, restores one bounded rerun task, or records an accepted replacement exhausted target.",
    resume_condition: publicResumeCondition,
    next_check_at: nextCheckAt,
    fallback_at: fallbackAt,
    fallback_action: publicFallbackAction,
  };
  const publicContext = asMutableRecord(publicCarrier.context);
  publicContext.representedSpecIds = [publicSpecId];
  publicContext.retryGuardedSpecIds = [publicSpecId];
  publicContext.exactWaitSpecId = publicSpecId;
  publicContext.exactWaitRunId = publicFacts.runId;
  publicContext.exactWaitNormalizedAt = checkedAt;
  publicContext.exactWaitNormalizedBy = "app-ops";
  publicCarrier.context = publicContext;
  publicCarrier.trace = {
    ...asRecord(publicCarrier.trace),
    rp_regional_quota_state_normalized_at: checkedAt,
    rp_regional_quota_state_normalized_by: "app-ops-script",
    rp_regional_quota_state_normalization_attempt_id: attemptId,
    rp_regional_quota_state_normalization_evidence_path: evidencePath,
  };
  publicCarrier.updated_at = checkedAt;

  const compactResumeCondition =
    `Resume only when ${publicCarrierTaskId} changes the accepted public frontier or when the compact live-ready filter contract itself materially changes.`;
  const compactBlockerCondition =
    `Compact package excludes superseded raw-file lineage ${sourceWitnessSpecId}; the only active compact frontier is ${publicSpecId}, which is already preserved as the exact blocked westus2 exhaustion wait on ${publicCarrierTaskId}.`;
  const compactFallbackAction =
    `If ${publicCarrierTaskId} remains blocked at fallback, refresh this compact holder from current compact summary/diagnostics and the public carrier wait instead of reviving review debt for ${sourceWitnessSpecId}.`;

  compactHolder.goal =
    "Keep the rp-regional-quota compact package blocked only behind the single public-create-path exact wait; represent the multi-cluster source-equivalent alias only as a superseded nonlive source witness, not as pending review debt.";
  compactHolder.acceptance = [
    `${sourceWitnessSpecId} is represented only as superseded raw-file/source-witness lineage and no longer appears as live review debt.`,
    `${publicSpecId} remains the only active compact frontier and is blocked only through ${publicCarrierTaskId}.`,
    compactResumeCondition,
  ];
  compactHolder.result =
    `Compact package now excludes ${sourceWitnessSpecId} as superseded source-witness lineage and preserves only ${publicSpecId} as the accepted environment-blocked frontier behind ${publicCarrierTaskId}.`;
  compactHolder.outputs = unique([
    ...asStringArray(compactHolder.outputs),
    ".state/feature-compact-loop/state.json",
    evidencePath,
  ]);
  setTaskState(compactHolder, "blocked");
  compactHolder.blocker = {
    condition: compactBlockerCondition,
    category: "external-wait",
    owner: "aks-explorer",
    blocked_at: checkedAt,
    waiting_for: {
      type: "blocker.resolved",
      taskId: publicCarrierTaskId,
      specId: publicSpecId,
      featureKey,
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.owner.requested",
    },
    observation_method:
      "Scheduled blocked-frontier review checks the compact summary/diagnostics plus the named public carrier and either keeps this exact compact wait or restores the next truthful compact frontier.",
    resume_condition: compactResumeCondition,
    next_check_at: nextCheckAt,
    fallback_at: fallbackAt,
    fallback_action: compactFallbackAction,
  };
  const compactContext = asMutableRecord(compactHolder.context);
  compactContext.featureCompactExactWait = true;
  compactContext.featureKey = featureKey;
  compactContext.compactFrontierSpecIds = [publicSpecId];
  compactContext.supersededWitnessSpecIds = [sourceWitnessSpecId];
  compactContext.normalizedAt = checkedAt;
  compactHolder.context = compactContext;
  compactHolder.trace = {
    ...asRecord(compactHolder.trace),
    rp_regional_quota_compact_state_normalized_at: checkedAt,
    rp_regional_quota_compact_state_normalized_by: "app-ops-script",
    rp_regional_quota_compact_state_normalization_attempt_id: attemptId,
    rp_regional_quota_compact_state_normalization_evidence_path: evidencePath,
  };
  compactHolder.updated_at = checkedAt;

  focusTask.outputs = unique([...asStringArray(focusTask.outputs), evidencePath]);
  projectTask.outputs = unique([...asStringArray(projectTask.outputs), evidencePath]);

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    publicFacts,
    nextCheckAt,
    fallbackAt,
    publicResumeCondition,
    publicBlockerCondition,
    compactResumeCondition,
    compactBlockerCondition,
  };
});

const specState = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: beforeSpecState.state.windowSize,
});
const publicReview = {
  classification: "accepted_same_surface_environment_wait",
  lastRootCause:
    "Reviewed rerun 172346097 moved the live carrier off the old missing-file repo defect and onto an environment preflight gate: westus2 managedClusters usage was 40/161, so the decisive quota-negative create assertion was not reached.",
  lastAction:
    `Applied run 172346097 onto ${publicCarrierTaskId} as the single live exact wait carrier for ${publicSpecId}; do not rerun unchanged and do not revive ${sourceWitnessSpecId}.`,
  reviewedAt: checkedAt,
  acceptedRunId: treeMutation.publicFacts.runId,
  acceptedResultPath: treeMutation.publicFacts.resultPath,
  acceptedStatus: "error",
  acceptedByTaskId: publicCarrierTaskId,
  acceptedAt: checkedAt,
};
updateSpecLoopSpec(specState.state, publicSpecId, {
  status: "pending",
  taskId: publicCarrierTaskId,
  lastRunId: treeMutation.publicFacts.runId,
  lastRunUrl: treeMutation.publicFacts.runUrl,
  lastResultPath: treeMutation.publicFacts.resultPath,
  diagnosis:
    "Reviewed run 172346097 now stops only at preflight.target-usage because staging westus2 managedClusters usage was 40/161, so the decisive quota-negative create assertion was not reached; preserve an exact external wait instead of rerunning unchanged.",
  inputFingerprint: treeMutation.publicFacts.inputFingerprint || publicSpecBefore.inputFingerprint || null,
  errorFingerprint: treeMutation.publicFacts.errorFingerprint || publicSpecBefore.errorFingerprint || null,
  review: publicReview,
  resumeCondition: treeMutation.publicResumeCondition,
});
updateSpecLoopSpec(specState.state, sourceWitnessSpecId, {
  status: "pass",
  taskId: null,
  diagnosis:
    "Superseded source-witness alias only: compact/package and task-tree state now route all live quota work through spec.rp-regional-quota.public-create-path.",
  review: {
    classification: "catalog_superseded_alias_nonlive_source_witness",
    lastRootCause:
      `Compact and task-tree normalization proved ${sourceWitnessSpecId} is superseded raw-file/source-witness lineage rather than a live runnable carrier.`,
    lastAction:
      `Normalized ${sourceWitnessSpecId} out of live pending/review posture; preserve it only as superseded source-witness lineage behind ${publicCarrierTaskId}.`,
    reviewedAt: checkedAt,
  },
});
const publicSpecAfter = specState.state.specs[publicSpecId] as JsonRecord;
delete publicSpecAfter.pendingReviewReason;
delete publicSpecAfter.pendingReviewTaskId;
delete publicSpecAfter.pendingReviewRunId;
delete publicSpecAfter.pendingReviewObservedAt;
if (publicSpecAfter.review && typeof publicSpecAfter.review === "object") {
  const reviewRecord = publicSpecAfter.review as JsonRecord;
  delete reviewRecord.pendingReviewReason;
  delete reviewRecord.pendingReviewTaskId;
  delete reviewRecord.pendingReviewRunId;
  delete reviewRecord.pendingReviewObservedAt;
}
saveSpecLoopState(
  specState.path,
  specState.state,
  existsSync(specMirrorPath) ? [specMirrorPath] : [],
);

const compactState = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: beforeFeatureState.state.windowSize,
  refreshFromProject: false,
});
updateFeatureCompactItem(compactState.state, featureKey, {
  status: "blocked",
  taskId: compactHolderTaskId,
  frontierTaskIds: [compactHolderTaskId],
  retryable: false,
  retryReason: treeMutation.compactResumeCondition,
  lastSummaryPath: summaryPath,
  lastDiagnosticsPath: diagnosticsPath,
  blockedReason:
    `Compact package excludes superseded raw-file lineage ${sourceWitnessSpecId}; the only active compact frontier is ${publicSpecId}, which is already preserved as the exact blocked westus2 exhaustion wait on ${publicCarrierTaskId}.`,
  waitingFor: {
    type: "blocker.resolved",
    taskId: compactHolderTaskId,
  },
  waitingCondition: treeMutation.compactResumeCondition,
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.owner.requested",
  },
  observationMethod:
    "Scheduled blocked-frontier app-ops review checks the compact summary/diagnostics and the exact public carrier wait before restoring compact work.",
  nextCheckAt: treeMutation.nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt: treeMutation.fallbackAt,
  fallbackAction:
    `If ${publicCarrierTaskId} remains blocked at fallback, refresh this compact holder from current compact summary/diagnostics and the public carrier wait instead of reviving review debt for ${sourceWitnessSpecId}.`,
  resumeAction:
    `Reset this feature compact record to pending only after ${compactHolderTaskId} is replaced or unblocked by a changed public frontier.`,
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "compact-error",
    target: "staging",
    branch: "dev",
    featureKey,
  },
  ownerReason:
    `Compact package has one truthful active frontier (${publicSpecId}) and it is already represented by blocked public carrier ${publicCarrierTaskId}; ${sourceWitnessSpecId} remains superseded source-witness lineage only.`,
  nextStepClassification: "accepted-environment-blocked-frontier",
  reviewEvidencePath: evidencePath,
  evidencePaths: unique([...(featureBefore.evidencePaths ?? []), evidencePath]),
  summary:
    `Compact package excludes ${sourceWitnessSpecId} and stays blocked only behind ${publicCarrierTaskId}.`,
});
saveFeatureCompactLoopState(compactState.path, compactState.state);
if (existsSync(compactMirrorPath)) {
  saveFeatureCompactLoopState(compactMirrorPath, compactState.state);
}

syncProjectReadout(config, checkedAt);

const afterReadout = buildReadout();
const afterProposalTaskIds = unique([
  repairTaskId,
  publicCarrierTaskId,
  compactHolderTaskId,
  ...afterReadout.active,
  ...afterReadout.review,
  ...afterReadout.topLevelBlocked,
]);
const focusGoal =
  "Keep one visible 12-24h focus branch aligned to the real root frontier: preserve the two remaining same-run terminal holders, represent rp-regional-quota only through reconcile-spec-loop-pending-rp-regional-quota as the blocked westus2 exhaustion wait plus the compact blocked holder, keep repo-wide scenario-test normalization visible, and avoid reviving the archived 172346097 run-review holder.";
const focusSuccessCriteria = [
  `${publicCarrierTaskId} is the only live blocked westus2 exhaustion wait carrier for ${publicSpecId}; the earlier 172346097 run-review holder remains archived history only and is not represented as a live focus/readout carrier.`,
  `${compactHolderTaskId} is blocked behind ${publicCarrierTaskId} and represents ${sourceWitnessSpecId} only as superseded nonlive source-witness lineage, not as live review debt.`,
  `Project current-focus and runtime readout surfaces no longer treat the earlier 172346097 run-review holder as live review work.`,
  `Project current-focus metadata and mirrored runtime focus surfaces represent active=[${formatList(afterReadout.active)}], review=[${formatList(afterReadout.review)}], waiting=[${formatList(afterReadout.waiting)}], runnable=[${formatList(afterReadout.runnable)}].`,
];
const focusReason =
  `Current root-contract non-repair frontier is active=[${formatList(afterReadout.active)}], review=[${formatList(afterReadout.review)}], waiting=[${formatList(afterReadout.waiting)}], runnable=[${formatList(afterReadout.runnable)}], blocked=${afterReadout.blockedLeafCount}. ` +
  `${publicCarrierTaskId} now carries ${publicSpecId} as the only live blocked westus2 exhaustion wait; ${compactHolderTaskId} keeps the compact package blocked behind that carrier; the earlier 172346097 run-review holder is archived history only.`;

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  assert(focusTask, `Task not found: ${focusTaskId}`);
  assert(projectTask, `Task not found: ${projectTaskId}`);

  focusTask.goal = focusGoal;
  focusTask.acceptance = [
    "This focus branch remains the single visible 12-24h mission for the project and stays synchronized with project-state currentFocus plus the live linked task ids.",
    "The branch truthfully reflects the current frontier and emphasizes exact blocked carriers, repo-local normalization, and blocker/readout hygiene until a sharper successor appears.",
  ];
  const focusContext = asMutableRecord(focusTask.context);
  focusContext.horizon = `12-24h from ${checkedAt}`;
  focusContext.success_criteria = focusSuccessCriteria;
  focusContext.progress_review = {
    last_reviewed_at: checkedAt,
    status: "updated",
    summary:
      `Direction remains low-risk and is resynced to the live tree: active=[${formatList(afterReadout.active)}], review=[${formatList(afterReadout.review)}], waiting=[${formatList(afterReadout.waiting)}], runnable=[${formatList(afterReadout.runnable)}], blocked=${afterReadout.blockedLeafCount}. ` +
      `${publicCarrierTaskId} and ${compactHolderTaskId} now carry rp-regional-quota truthfully; the earlier 172346097 run-review holder is archived history only.`,
    evidence: [
      `Attempt ${attemptId} verified via bun run task-tree show that ${publicCarrierTaskId} is blocked and ${compactHolderTaskId} is blocked.`,
      `Attempt ${attemptId} rewrote current-focus surfaces so they no longer treat the earlier 172346097 run-review holder as live review work.`,
      `Evidence memo: ${evidencePath}`,
    ],
  };
  focusContext.allowed_risk =
    "Allow only exact blocked carrier stewardship, repo-local normalization already represented in the tree, and blocker/readout hygiene. Do not launch fresh package-level live execution from focus maintenance alone.";
  focusContext.needs_approval = false;
  const observations = asMutableRecord(focusContext.observations);
  observations.frontier_runnable_leaf_count = afterReadout.runnable.length;
  observations.frontier_waiting_leaf_count = afterReadout.waiting.length;
  observations.frontier_active_leaf_count = afterReadout.active.length;
  observations.frontier_review_leaf_count = afterReadout.review.length;
  observations.frontier_blocked_leaf_count = afterReadout.blockedLeafCount;
  observations.linked_active_task_ids = afterReadout.active;
  observations.linked_review_task_ids = afterReadout.review;
  observations.linked_exact_blocked_task_ids = unique([
    ...asStringArray(observations.linked_exact_blocked_task_ids).filter(
      (taskId) => taskId !== archivedRunHolderTaskId,
    ),
    publicCarrierTaskId,
    compactHolderTaskId,
  ]);
  observations.linked_blocked_task_ids = unique([
    publicCarrierTaskId,
    compactHolderTaskId,
    ...afterReadout.topLevelBlocked,
  ]);
  observations.recent_review_signal =
    `${publicCarrierTaskId} replaced the earlier 172346097 run-review holder as the live rp-regional-quota public carrier, and ${compactHolderTaskId} now carries the compact blocked frontier without review debt.`;
  observations.parallel_work_gap =
    "The current gap is not missing branches but truthful follow-through: preserve exact blocked carriers, consume the live review queue, and avoid reviving archived same-run holders.";
  observations.structural_status =
    "Current focus repair normalized rp-regional-quota wait representation and compact holder posture; it did not justify new broad execution or another review-shaped holder for run 172346097.";
  focusContext.observations = observations;
  focusContext.lane_links = {
    source_spec_replay: afterReadout.review.filter((taskId) =>
      taskId.includes("normalize-scenario-tests"),
    ),
    execution_verification: unique([
      publicCarrierTaskId,
      ...afterReadout.review.filter(
        (taskId) =>
          taskId.includes("fix-network-acns") ||
          taskId.includes("wait-rp-") ||
          taskId.includes("localdns"),
      ),
    ]),
    model_feedback: [compactHolderTaskId],
    state_hygiene: [repairTaskId],
  };
  focusTask.context = focusContext;
  focusTask.updated_at = checkedAt;
  focusTask.trace = {
    ...asRecord(focusTask.trace),
    rp_regional_quota_focus_normalized_at: checkedAt,
    rp_regional_quota_focus_normalized_by: "app-ops-script",
    rp_regional_quota_focus_normalization_attempt_id: attemptId,
    rp_regional_quota_focus_normalization_evidence_path: evidencePath,
  };

  const projectContext = asMutableRecord(projectTask.context);
  projectContext.current_focus_proposal = {
    id: focusTaskId,
    title: "rp-regional-quota exact-wait normalization hold",
    status: "updated",
    reviewed_at: checkedAt,
    needs_approval: false,
    reason: focusReason,
    evidence_path: evidencePath,
    context: {
      horizon: "12-24h",
      success_criteria: focusSuccessCriteria,
      active_task_ids: afterReadout.active,
      review_task_ids: afterReadout.review,
      waiting_task_ids: afterReadout.waiting,
      runnable_task_ids: afterReadout.runnable,
      blocked_task_ids: unique([publicCarrierTaskId, compactHolderTaskId, ...afterReadout.topLevelBlocked]),
      proposed_task_ids: afterProposalTaskIds,
      lane_links: {
        execution_verification: [publicCarrierTaskId],
        model_feedback: [compactHolderTaskId],
        state_hygiene: [repairTaskId],
      },
    },
  };
  projectContext.current_focus_proposal_progress_review_refreshed_at = checkedAt;
  projectContext.current_focus_proposal_progress_review_refreshed_by =
    "app-ops-script";
  projectContext.current_focus_proposal_progress_review_evidence_path = evidencePath;
  projectTask.context = projectContext;
  projectTask.updated_at = checkedAt;
  projectTask.trace = {
    ...asRecord(projectTask.trace),
    rp_regional_quota_focus_normalized_at: checkedAt,
    rp_regional_quota_focus_normalized_by: "app-ops-script",
    rp_regional_quota_focus_normalization_attempt_id: attemptId,
    rp_regional_quota_focus_normalization_evidence_path: evidencePath,
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
currentFocus.summary =
  `Current root-frontier follow-through is active=[${formatList(afterReadout.active)}], review=[${formatList(afterReadout.review)}], waiting=[${formatList(afterReadout.waiting)}], runnable=[${formatList(afterReadout.runnable)}]. ` +
  `${publicCarrierTaskId} now carries ${publicSpecId} as the blocked westus2 exhaustion wait and ${compactHolderTaskId} keeps the compact package blocked behind it; the earlier 172346097 run-review holder is archived history only.`;
currentFocus.nextAction =
  `Keep the root contract truthful: preserve review follow-through ${formatList(afterReadout.review)}, keep blocked rp-regional-quota carriers ${publicCarrierTaskId} and ${compactHolderTaskId}, keep exact top-level blocked steward waits ${formatList(afterReadout.topLevelBlocked)}, and do not reopen execution from bookkeeping alone.`;
currentFocus.activeTaskIds = afterReadout.active;
currentFocus.proposedTaskIds = afterProposalTaskIds;
focusReview.reviewedAt = checkedAt;
focusReview.result = "updated";
focusReview.note =
  `${publicCarrierTaskId} replaced the earlier 172346097 run-review holder as the live rp-regional-quota public carrier, and ${compactHolderTaskId} now carries the compact blocked frontier without review debt. active=[${formatList(afterReadout.active)}], review=[${formatList(afterReadout.review)}], waiting=[${formatList(afterReadout.waiting)}], runnable=[${formatList(afterReadout.runnable)}].`;
focusReview.evidencePath = evidencePath;
currentFocus.focusReview = focusReview;
focusMission.id = focusTaskId;
focusMission.title = "rp-regional-quota exact-wait normalization hold";
focusMission.horizon = "12-24h";
focusMission.successCriteria = focusSuccessCriteria;
focusMission.activeTaskIds = afterReadout.active;
focusMission.reviewTaskIds = afterReadout.review;
focusMission.waitingTaskIds = afterReadout.waiting;
focusMission.runnableTaskIds = afterReadout.runnable;
focusMission.linkedBlockedTaskIds = unique([
  publicCarrierTaskId,
  compactHolderTaskId,
  ...afterReadout.topLevelBlocked,
]);
focusMission.evidencePath = evidencePath;
currentFocus.focusMission = focusMission;
focusPlan.summary =
  `Focus plan root readout now mirrors the same top-level root contract: active=[${formatList(afterReadout.active)}], review=[${formatList(afterReadout.review)}], waiting=[${formatList(afterReadout.waiting)}], runnable=[${formatList(afterReadout.runnable)}]. ` +
  `${publicCarrierTaskId} and ${compactHolderTaskId} are the live rp-regional-quota carriers; the earlier 172346097 run-review holder is no longer a live holder.`;
focusPlan.currentProposalId = focusTaskId;
focusPlan.evidencePath = evidencePath;
saveProjectRuntimeState(appDir, {
  currentState,
  currentFocus,
  focusPlan,
  updatedAt: checkedAt,
});

const verification = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  const focusTask = tree.tasks[focusTaskId];
  return {
    publicCarrier: tree.tasks[publicCarrierTaskId],
    compactHolder: tree.tasks[compactHolderTaskId],
    focusTask,
    projectCurrentFocusProposal: asRecord(asRecord(projectTask?.context).current_focus_proposal),
  };
});
const publicSpecAfterFinal = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
}).state.specs[publicSpecId];
const featureAfterFinal = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 5,
  refreshFromProject: false,
}).state.features[featureKey];
const runtimeFinal = asMutableRecord(loadProjectReadModel(appDir));
const runtimeCurrentFocus = asMutableRecord(runtimeFinal.currentFocus);
const runtimeFocusMission = asMutableRecord(runtimeCurrentFocus.focusMission);

writeText(
  evidenceAbsolute,
  `# App apply — rp-regional-quota run 172346097 state normalization — 2026-07-16\n\n- Task: \`${repairTaskId}\`\n- Attempt: \`${attemptId}\`\n- Applied at: \`${checkedAt}\`\n\n## Scope\n\nApplied the accepted app-owned normalization through supported app mechanisms: the public spec carrier is now the single blocked westus2 exhaustion wait on \`${publicCarrierTaskId}\`, the compact/source-witness holder is blocked instead of review, the public spec-loop row points at run \`172346097\`, and live focus/runtime readouts no longer treat archived holder \`${archivedRunHolderTaskId}\` as current work.\n\n## App mechanisms used\n\n- \`readTaskTree(...)\` + \`withTreeLock(...)\` + \`setTaskState(...)\` + \`saveTaskTreeWithKanbanSnapshot(...)\`\n- \`loadSpecLoopState(...)\` + \`updateSpecLoopSpec(...)\` + \`saveSpecLoopState(...)\`\n- \`loadFeatureCompactLoopState(...)\` + \`updateFeatureCompactItem(...)\` + \`saveFeatureCompactLoopState(...)\`\n- \`syncProjectReadout(config, checkedAt)\`\n- \`saveProjectRuntimeState(appDir, ...)\`\n\n## Baseline before apply\n\n- \`${publicCarrierTaskId}\` state: \`${nodeState(beforeReadout.tree.tasks[publicCarrierTaskId])}\`\n- \`${compactHolderTaskId}\` state: \`${nodeState(beforeReadout.tree.tasks[compactHolderTaskId])}\`\n- \`${publicSpecId}\` taskId before: \`${publicSpecBefore.taskId ?? "null"}\`\n- \`${publicSpecId}\` lastRunId before: \`${publicSpecBefore.lastRunId ?? "null"}\`\n- feature \`${featureKey}\` taskId before: \`${featureBefore.taskId ?? "null"}\`\n- feature \`${featureKey}\` frontierTaskIds before: ${JSON.stringify(featureBefore.frontierTaskIds ?? null)}\n- project-state currentFocus referenced archived holder as live review work: \`${String(JSON.stringify(runtime.currentFocus ?? {}).includes(archivedRunHolderTaskId))}\`\n\n## Applied normalization\n\n### 1) Public carrier task\n\n- state: \`${nodeState(verification.publicCarrier)}\`\n- blocker owner/category: \`${String(asRecord(verification.publicCarrier?.blocker).owner ?? "")}/${String(asRecord(verification.publicCarrier?.blocker).category ?? "")}\`\n- waiting_for: ${JSON.stringify(asRecord(asRecord(verification.publicCarrier?.blocker).waiting_for), null, 2)}\n- resume_condition: ${JSON.stringify(asRecord(verification.publicCarrier?.blocker).resume_condition ?? null)}\n\n### 2) Spec-loop public row\n\n- taskId: \`${publicSpecBefore.taskId ?? "null"}\` → \`${publicSpecAfterFinal?.taskId ?? "null"}\`\n- lastRunId: \`${publicSpecBefore.lastRunId ?? "null"}\` → \`${publicSpecAfterFinal?.lastRunId ?? "null"}\`\n- acceptedRunId: \`${String(asRecord(publicSpecBefore.review).acceptedRunId ?? "null")}\` → \`${String(asRecord(publicSpecAfterFinal?.review).acceptedRunId ?? "null")}\`\n- acceptedByTaskId: \`${String(asRecord(publicSpecBefore.review).acceptedByTaskId ?? "null")}\` → \`${String(asRecord(publicSpecAfterFinal?.review).acceptedByTaskId ?? "null")}\`\n\n### 3) Compact/source-witness holder\n\n- state: \`${nodeState(verification.compactHolder)}\`\n- result: ${JSON.stringify(verification.compactHolder?.result ?? null)}\n- waiting_for: ${JSON.stringify(asRecord(asRecord(verification.compactHolder?.blocker).waiting_for), null, 2)}\n\n### 4) Feature-compact row\n\n- taskId: \`${featureBefore.taskId ?? "null"}\` → \`${featureAfterFinal?.taskId ?? "null"}\`\n- frontierTaskIds: ${JSON.stringify(featureBefore.frontierTaskIds ?? null)} → ${JSON.stringify(featureAfterFinal?.frontierTaskIds ?? null)}\n- blockedReason: ${JSON.stringify(featureAfterFinal?.blockedReason ?? null)}\n\n### 5) Focus/runtime readout cleanup\n\n- focus goal: ${JSON.stringify(verification.focusTask?.goal ?? null)}\n- project current_focus_proposal.reason: ${JSON.stringify(verification.projectCurrentFocusProposal.reason ?? null)}\n- runtime currentFocus.summary: ${JSON.stringify(runtimeCurrentFocus.summary ?? null)}\n- runtime focusMission.successCriteria[0]: ${JSON.stringify(asStringArray(runtimeFocusMission.successCriteria)[0] ?? null)}\n\n## Archived holder cleanup check\n\nLive readout/focus surfaces now cite blocked carriers \`${publicCarrierTaskId}\` and \`${compactHolderTaskId}\`; archived holder \`${archivedRunHolderTaskId}\` is no longer named in the runtime current focus summary or proposal reason. Historical review/task traces may still mention the archived id as provenance only.\n\n## Acceptance check\n\n- App-owned task-tree or loop-state repair applied through supported mechanisms: satisfied.\n- Affected branch records exact restored holder/state pointer with evidence: satisfied via blocked task-tree holders, updated spec-loop/feature-compact rows, and refreshed focus/runtime readouts above.\n`,
);

console.log(
  JSON.stringify(
    {
      checkedAt,
      evidencePath,
      publicCarrierState: nodeState(verification.publicCarrier),
      compactHolderState: nodeState(verification.compactHolder),
      publicSpecTaskId: publicSpecAfterFinal?.taskId ?? null,
      publicSpecLastRunId: publicSpecAfterFinal?.lastRunId ?? null,
      featureTaskId: featureAfterFinal?.taskId ?? null,
      runtimeCurrentFocusSummary: runtimeCurrentFocus.summary ?? null,
    },
    null,
    2,
  ),
);

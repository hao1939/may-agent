import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";
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

type MutableRecord = Record<string, unknown>;
type TaskNode = MutableRecord & {
  id: string;
  state?: string;
  status?: string;
  goal?: string;
  acceptance?: string[];
  outputs?: string[];
  context?: MutableRecord;
  trace?: MutableRecord;
  blocker?: MutableRecord;
  result?: string;
};

const attemptId =
  "a_ops-apply-ops-apply-apply-supported-reviewed-completion-replay-net-integration-terminal-20260715-task-tree-followup-stat_20260715034247";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const holderTaskId = "hold-compact-net-integration-package-partial-frontier";
const dualstackWaitTaskId =
  "domain/wait-net-integration-multinic-dualstack-run-172280731-result-20260715";
const mixedWaitTaskId =
  "domain/wait-net-integration-multinic-mixed-run-172281011-result-20260715";
const staleConsumerTaskId =
  "domain/consume-net-integration-multinic-live-run-172275388-return-20260715";
const staleGenericWaitTaskId =
  "wait-net-integration-multinic-dualstack-ado-run-172275388-result";
const staleFeatureTaskId =
  "ops/wait-reviewed-completion-replay-net-integration-terminal-20260715";
const compactLoopTaskId = "aks-feature-compact-loop";
const compactFeatureKey = "net-integration";
const specLoopTaskId = "aks-spec-verification-loop";
const dualstackSpecId = "spec.net-integration.multinic-dualstack";
const mixedSpecId = "spec.net-integration.multinic-mixed";
const evidencePath =
  "evidence/archive/ops-apply-ops-apply-apply-supported-reviewed-completion-replay-net-integration-terminal-20260715-task-tree-followup-stat.md";

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function deleteKey(record: MutableRecord, key: string): void {
  if (key in record) delete record[key];
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const holderBefore = treeBefore.tasks[holderTaskId] as TaskNode | undefined;
const dualstackWait = treeBefore.tasks[dualstackWaitTaskId] as TaskNode | undefined;
const mixedWait = treeBefore.tasks[mixedWaitTaskId] as TaskNode | undefined;
assert(holderBefore, `Missing ${holderTaskId}`);
assert(dualstackWait, `Missing ${dualstackWaitTaskId}`);
assert(mixedWait, `Missing ${mixedWaitTaskId}`);
assert(!treeBefore.tasks[staleGenericWaitTaskId], `${staleGenericWaitTaskId} must stay absent`);

const dualstackWaitBlocker = asRecord(dualstackWait.blocker);
const mixedWaitBlocker = asRecord(mixedWait.blocker);
const nextCheckAt =
  asString(dualstackWaitBlocker.next_check_at) ||
  asString(mixedWaitBlocker.next_check_at) ||
  appliedAt;
const fallbackAt =
  asString(dualstackWaitBlocker.fallback_at) ||
  asString(mixedWaitBlocker.fallback_at) ||
  appliedAt;

const holderGoal =
  `Hold compact feature net-integration on the exact package-partial frontier while ${dualstackWaitTaskId} and ${mixedWaitTaskId} remain the live exact MultiNIC successor waits for the dualstack/mixed pair and the remaining family waits stay blocked.`;
const holderAcceptance = [
  `The feature remains blocked only while ${dualstackWaitTaskId} and ${mixedWaitTaskId} remain the truthful exact MultiNIC successor waits for the dualstack/mixed pair or a newer exact replacement is recorded.`,
  "Run 172268432 remains consumed history only and is not reopened as the live carrier for the MultiNIC pair.",
  `Do not recreate ${staleGenericWaitTaskId} as a blocked artifact wait unless owner review explicitly rejects the later exact successor-wait evidence.`,
];
const holderCondition =
  `Current compact/spec-loop/spec evidence shows the exact remaining net-integration compact blocked frontier is still the BasicLB deprecation pair on wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702, cross-subscription VNet on wait-spec-net-integration-cross-subscription-vnet-response-20260702, the outboundType=none topology-constraint pair on wait-spec-net-integration-outbound-none-topology-constraint-20260702, spec.net-integration.outbound-udr on wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702, the run-171350866 custom-route-table/user-assigned-MSI node-readiness blocker, the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none, and the exact MultiNIC successor waits ${dualstackWaitTaskId} (run 172280731) plus ${mixedWaitTaskId} (run 172281011). Run 172268432 is consumed history only and ${staleGenericWaitTaskId} stays absent as historical lineage only.`;
const holderResumeCondition =
  `Resume only when one exact represented blocked surface materially changes (the BasicLB pair, cross-subscription pairing/access proof, outboundType=none topology constraints, the BYO UDR prerequisite contract, run 171350866 node-readiness diagnosis, accepted live-capable reclassification of multinic-standard plus natgw-v2-migration-v2-to-none, or ${dualstackWaitTaskId} / ${mixedWaitTaskId} settle into a newer exact successor).`;
const holderFallbackAction =
  `If ${dualstackWaitTaskId} or ${mixedWaitTaskId} settle or are replaced, refresh this holder to the newer exact successor state. Do not restore ${staleGenericWaitTaskId} as a blocked artifact wait.`;
const holderWaitingFor = {
  type: "domain.exact-successor-waits.active",
  taskIds: [dualstackWaitTaskId, mixedWaitTaskId],
  runIds: ["172280731", "172281011"],
  specIds: [dualstackSpecId, mixedSpecId],
  predecessorTaskId: holderTaskId,
  historicalConsumedRunId: "172268432",
  historicalGenericWaitTaskId: staleGenericWaitTaskId,
  reason:
    "the net-integration multinic pair is currently represented by exact same-spec successor waits rather than a terminal review holder or generic artifact wait",
};

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
  const dualstack = tree.tasks[dualstackWaitTaskId] as TaskNode | undefined;
  const mixed = tree.tasks[mixedWaitTaskId] as TaskNode | undefined;
  assert(holder, `Missing ${holderTaskId} during mutation`);
  assert(dualstack, `Missing ${dualstackWaitTaskId} during mutation`);
  assert(mixed, `Missing ${mixedWaitTaskId} during mutation`);
  assert(!tree.tasks[staleGenericWaitTaskId], `${staleGenericWaitTaskId} must remain absent during mutation`);

  holder.state = "blocked";
  holder.status = "blocked";
  holder.goal = holderGoal;
  holder.acceptance = [...holderAcceptance];
  holder.outputs = unique([
    ...asStringArray(holder.outputs),
    ".state/feature-compact-loop/state.json",
    ".state/spec-loop/state.json",
    evidencePath,
  ]);

  const context = asRecord(holder.context);
  deleteKey(context, "terminalPipelineWaitReview");
  deleteKey(context, "terminalGitHubWaitReview");
  deleteKey(context, "returnedArtifactConsumerTaskId");
  deleteKey(context, "returnedArtifactRunId");
  context.featureCompactExactWait = true;
  context.featureKey = compactFeatureKey;
  context.errorClass = "package-partial";
  context.target = "staging";
  context.downstreamCarrierTaskIds = [dualstackWaitTaskId, mixedWaitTaskId];
  context.exactSuccessorTaskIds = [dualstackWaitTaskId, mixedWaitTaskId];
  context.historicalConsumedRunIds = ["172268432"];
  context.historicalTerminalReviewTaskIds = [staleGenericWaitTaskId];
  context.reviewEvidencePath = evidencePath;
  context.currentRepresentation = "exact-successor-waits";
  holder.context = context;

  holder.blocker = {
    ...asRecord(holder.blocker),
    condition: holderCondition,
    category: "blocked-wait",
    owner: "aks-explorer",
    blocked_at:
      asString(asRecord(holder.blocker).blocked_at) ||
      asString(asRecord(holder.trace).created_at) ||
      appliedAt,
    waiting_for: holderWaitingFor,
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.task.reviewed",
    },
    observation_method:
      "Planner/app-ops keeps the net-integration package-partial holder exact while the dualstack and mixed same-spec successor waits remain the live MultiNIC frontier.",
    next_check_at: nextCheckAt,
    resume_condition: holderResumeCondition,
    fallback_at: fallbackAt,
    fallback_action: holderFallbackAction,
    resume_at: nextCheckAt,
  };

  const trace = asRecord(holder.trace);
  deleteKey(trace, "current_attempt_id");
  deleteKey(trace, "terminal_wait_review_attempt_created_at");
  deleteKey(trace, "terminal_wait_review_attempt_created_by");
  deleteKey(trace, "terminal_pipeline_wait_observed_at");
  deleteKey(trace, "terminal_pipeline_wait_run_id");
  deleteKey(trace, "terminal_pipeline_wait_run_status");
  deleteKey(trace, "terminal_pipeline_wait_run_conclusion");
  deleteKey(trace, "terminal_pipeline_wait_run_url");
  deleteKey(trace, "terminal_github_wait_observed_at");
  deleteKey(trace, "terminal_github_wait_run_id");
  deleteKey(trace, "terminal_github_wait_run_status");
  deleteKey(trace, "terminal_github_wait_run_conclusion");
  deleteKey(trace, "terminal_github_wait_run_url");
  deleteKey(trace, "previous_blocker_before_terminal_pipeline_wait_review");
  deleteKey(trace, "previous_blocker_before_terminal_github_wait_review");
  trace.compact_net_integration_successor_wait_repaired_at = appliedAt;
  trace.compact_net_integration_successor_wait_repaired_by = worker;
  trace.compact_net_integration_successor_wait_attempt_id = attemptId;
  trace.compact_net_integration_successor_wait_task_ids = [
    dualstackWaitTaskId,
    mixedWaitTaskId,
  ];
  holder.trace = trace;

  holder.result =
    `${attemptId}: holder now points at exact successor waits ${dualstackWaitTaskId} and ${mixedWaitTaskId}; stale review attempt lineage and stale run-172275388 consumer pointer were removed.`;

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactBefore = compactState.features[compactFeatureKey];
assert(compactBefore, `Missing feature-compact row ${compactFeatureKey}`);

updateFeatureCompactItem(compactState, compactFeatureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [dualstackWaitTaskId, mixedWaitTaskId],
  retryable: false,
  retryReason:
    `Keep ${holderTaskId} blocked while ${dualstackWaitTaskId} and ${mixedWaitTaskId} remain the live exact MultiNIC successor waits; do not recreate ${staleGenericWaitTaskId} or point back at ${staleFeatureTaskId}.`,
  ownerReason:
    `All feature-owned specs are already selected into the compact package. The remaining compact blocked frontier stays on ${holderTaskId} for the named BasicLB, cross-subscription VNet, outboundType=none, BYO UDR, custom-route-table/user-assigned-MSI, and multinic-standard/natgw-v2-migration-v2-to-none surfaces, while the MultiNIC dualstack/mixed pair is now represented by exact successor waits ${dualstackWaitTaskId} and ${mixedWaitTaskId}.`,
  nextStepClassification:
    `preserve the exact MultiNIC successor waits ${dualstackWaitTaskId} and ${mixedWaitTaskId} and keep the holder aligned to that live frontier`,
  resumeCondition: holderResumeCondition,
  blockedReason: holderCondition,
  waitingFor: holderWaitingFor,
  waitingCondition:
    `${dualstackWaitTaskId} and ${mixedWaitTaskId} are the current live exact successor waits for the MultiNIC pair; run 172268432 remains consumed history only and ${staleGenericWaitTaskId} remains absent.`,
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.task.reviewed",
  },
  observationMethod:
    "Planner/app-ops keeps the compact holder exact while the two same-spec successor waits remain live and blocked.",
  nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt,
  fallbackAction: holderFallbackAction,
  resumeAction:
    `Keep ${compactFeatureKey} blocked until ${dualstackWaitTaskId} or ${mixedWaitTaskId} settles into a sharper exact successor or another named frontier materially changes.`,
  lastCheckedAt: appliedAt,
  reviewEvidencePath: evidencePath,
  verificationBlocker:
    `Do not recreate ${staleGenericWaitTaskId} or point back at ${staleFeatureTaskId}; keep the feature represented by ${holderTaskId} plus exact successor waits ${dualstackWaitTaskId} and ${mixedWaitTaskId}.`,
  summary:
    `Net-integration now points at live frontier tasks ${dualstackWaitTaskId} and ${mixedWaitTaskId} while ${holderTaskId} remains the exact family holder.`,
  evidencePaths: unique([
    ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
    evidencePath,
  ]),
  attemptedFixes: unique([
    ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
    `${attemptId}: rebound feature state from stale non-live task ${staleFeatureTaskId} / missing consumer ${staleConsumerTaskId} to live holder ${holderTaskId} plus exact successor waits ${dualstackWaitTaskId} and ${mixedWaitTaskId}.`,
  ]),
});
saveFeatureCompactLoopState(compactStatePath, compactState);

const { state: specState, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
});

const specRepairs = [
  {
    specId: dualstackSpecId,
    waitTaskId: dualstackWaitTaskId,
    runId: "172280731",
    reviewClassification: "exact_successor_wait",
    successorDisposition: "exact-reviewable-ado-result-wait",
    successorReason:
      `${dualstackSpecId} is currently represented by exact wait ${dualstackWaitTaskId} for Azure DevOps run 172280731 instead of the missing consumer ${staleConsumerTaskId}.`,
    resumeCondition:
      `Resume when Azure DevOps run 172280731 is terminal and the exact same-spec result bundle is reviewable for ${dualstackSpecId}, or after terminal proof that no reviewable bundle was published.`,
  },
  {
    specId: mixedSpecId,
    waitTaskId: mixedWaitTaskId,
    runId: "172281011",
    reviewClassification: "exact_successor_wait",
    successorDisposition: "exact-reviewable-ado-result-wait",
    successorReason:
      `${mixedSpecId} is currently represented by exact wait ${mixedWaitTaskId} for Azure DevOps run 172281011 instead of the missing consumer ${staleConsumerTaskId}.`,
    resumeCondition:
      `Resume when Azure DevOps run 172281011 is terminal and the exact same-spec result bundle is reviewable for ${mixedSpecId}, or after terminal proof that no reviewable bundle was published.`,
  },
] as const;

for (const repair of specRepairs) {
  const before = specState.specs[repair.specId];
  assert(before, `Missing spec-loop row ${repair.specId}`);
  const review = asRecord(before.review);
  review.classification = repair.reviewClassification;
  review.lastAction =
    `Keep ${repair.specId} bound to exact wait ${repair.waitTaskId} for run ${repair.runId}; do not point back at missing consumer ${staleConsumerTaskId} or recreate generic artifact wait ${staleGenericWaitTaskId}.`;
  review.reviewedAt = appliedAt;
  review.waitTaskId = repair.waitTaskId;
  review.waitRunId = repair.runId;
  review.owner = "aks-explorer";
  review.observer = "app-ops";

  updateSpecLoopSpec(specState, repair.specId, {
    status: "pending",
    taskId: repair.waitTaskId,
    review,
    successorDisposition: repair.successorDisposition,
    successorEvidencePath: evidencePath,
    successorStateReason: repair.successorReason,
    resumeCondition: repair.resumeCondition,
    terminalDisposition: false,
  });
}

const mirrorSpecLoopPath = resolve(projectDir, ".state", "spec-loop", "state.json");
saveSpecLoopState(
  specStatePath,
  specState,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);

const treeAfter = readTaskTree(config);
const holderAfter = treeAfter.tasks[holderTaskId] as TaskNode | undefined;
const compactAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
}).state.features[compactFeatureKey];
const specAfter = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
}).state.specs;

console.log(
  JSON.stringify(
    {
      appliedAt,
      attemptId,
      holderBefore: {
        state: holderBefore.state ?? holderBefore.status ?? null,
        currentAttemptId: asRecord(holderBefore.trace).current_attempt_id ?? null,
      },
      holderAfter: {
        state: holderAfter?.state ?? holderAfter?.status ?? null,
        currentAttemptId:
          holderAfter ? asRecord(holderAfter.trace).current_attempt_id ?? null : null,
      },
      featureAfter: compactAfter
        ? {
            taskId: compactAfter.taskId ?? null,
            frontierTaskIds: compactAfter.frontierTaskIds ?? null,
            waitingFor: compactAfter.waitingFor ?? null,
            reviewEvidencePath: compactAfter.reviewEvidencePath ?? null,
          }
        : null,
      specAfter: {
        [dualstackSpecId]: {
          taskId: specAfter[dualstackSpecId]?.taskId ?? null,
          successorDisposition:
            specAfter[dualstackSpecId]?.successorDisposition ?? null,
        },
        [mixedSpecId]: {
          taskId: specAfter[mixedSpecId]?.taskId ?? null,
          successorDisposition:
            specAfter[mixedSpecId]?.successorDisposition ?? null,
        },
      },
    },
    null,
    2,
  ),
);

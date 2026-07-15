import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createTask,
  markTaskDone,
  readTask,
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
  type SpecLoopSpecState,
} from "../workflows/lib/spec-loop-store.ts";

type MutableRecord = Record<string, unknown>;
type TaskNode = MutableRecord & {
  id: string;
  parent_id?: string;
  state?: string;
  status?: string;
  goal?: string;
  acceptance?: string[];
  outputs?: string[];
  inputs?: string[];
  context?: MutableRecord;
  trace?: MutableRecord;
  blocker?: MutableRecord;
  result?: string;
};

const attemptId =
  "a_ops-apply-ops-apply-ops-apply-ops-apply-audit-compact-net-integration-return-lineage-20260715-task-tree-followup-task-tr_20260715050706";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const compactLoopTaskId = "aks-feature-compact-loop";
const specLoopTaskId = "aks-spec-verification-loop";
const featureKey = "net-integration";
const holderTaskId = "hold-compact-net-integration-package-partial-frontier";
const consumerTaskId =
  "domain/consume-net-integration-multinic-rerun-artifacts-172280731-172281011-20260715";
const dualstackWaitTaskId =
  "domain/wait-net-integration-multinic-dualstack-run-172280731-result-20260715";
const mixedWaitTaskId =
  "domain/wait-net-integration-multinic-mixed-run-172281011-result-20260715";
const historicalConsumedRunId = "172268432";
const historicalWaitTaskId =
  "wait-net-integration-multinic-dualstack-ado-run-172275388-result";
const dualstackSpecId = "spec.net-integration.multinic-dualstack";
const mixedSpecId = "spec.net-integration.multinic-mixed";

const auditMemoPath =
  "evidence/archive/ops-audit-compact-net-integration-return-lineage-20260715.md";
const applyMemoPath =
  "evidence/archive/ops-apply-ops-apply-ops-apply-ops-apply-audit-compact-net-integration-return-lineage-20260715-task-tree-followup-task-tr.md";
const domainOutputPath =
  "../aks-rp-e2e/evidence/archive/consume-net-integration-multinic-rerun-artifacts-20260715.md";
const dualstackResultPath =
  "/app/projects/aks-rp-e2e/workspace/ops-audit-compact-net-integration-return-lineage-20260715/run-172280731/runs/test-results/test_20260715030259778_0d242c_428354/artifacts/net-integration-multinic-dualstack/spec-runner/result.json";
const dualstackDiagnosisPath =
  "/app/projects/aks-rp-e2e/workspace/ops-audit-compact-net-integration-return-lineage-20260715/run-172280731/runs/test-results/test_20260715030259778_0d242c_428354/artifacts/net-integration-multinic-dualstack/spec-runner/diagnosis.json";
const mixedResultPath =
  "/app/projects/aks-rp-e2e/workspace/ops-audit-compact-net-integration-return-lineage-20260715/run-172281011/runs/test-results/test_20260715030544872_wyihyu_702058/artifacts/net-integration-multinic-mixed/spec-runner/result.json";
const mixedDiagnosisPath =
  "/app/projects/aks-rp-e2e/workspace/ops-audit-compact-net-integration-return-lineage-20260715/run-172281011/runs/test-results/test_20260715030544872_wyihyu_702058/artifacts/net-integration-multinic-mixed/spec-runner/diagnosis.json";

const consumerGoal =
  "Consume the returned same-spec rerun artifacts for spec.net-integration.multinic-dualstack (run 172280731) and spec.net-integration.multinic-mixed (run 172281011), classify the exact returned failure family from those artifacts, and update the compact/spec evidence with the smallest truthful next state instead of another passive wait.";
const consumerAcceptance = [
  "Use the exact returned artifact paths captured in ../aks-rp-e2e.app/evidence/archive/ops-audit-compact-net-integration-return-lineage-20260715.md, including each spec-runner/result.json and diagnosis.json, and record run id, spec id, status, failure summary, and correlation/request ids for both specs.",
  "Decide the next truthful classification for each same-spec rerun from the returned artifacts (for example environment prerequisite, product gap, or narrower follow-up) and update the repo-local evidence/model surface accordingly without creating another generic check-later wait.",
  "If the two existing blocked ADO result waits are no longer truthful after consuming the artifacts, name the exact replacement/supersession action needed so planner/reviewer can retire them cleanly.",
];
const consumerInputs = [
  `../aks-rp-e2e.app/${auditMemoPath}`,
  dualstackResultPath,
  dualstackDiagnosisPath,
  mixedResultPath,
  mixedDiagnosisPath,
];
const consumerConflictScope = [
  "feature-compact:net-integration",
  `spec:${dualstackSpecId}`,
  `spec:${mixedSpecId}`,
  "ado-run:172280731",
  "ado-run:172281011",
];

const holderGoal =
  `Hold compact feature net-integration on the exact package-partial frontier while ${consumerTaskId} consumes the returned MultiNIC rerun artifacts for runs 172280731 and 172281011 and returns the next truthful classification instead of another passive ADO wait.`;
const holderAcceptance = [
  `The feature remains blocked only while the still-live net-integration package-partial frontier is true and ${consumerTaskId} has not yet returned the next sharper successor for the MultiNIC pair.`,
  `Runs 172280731 and 172281011 remain represented by ${consumerTaskId}, not by passive blocked ADO waits.`,
  `Run ${historicalConsumedRunId} remains consumed history only and ${historicalWaitTaskId} stays historical lineage only.`,
];
const holderCondition =
  `Current compact/spec-loop/spec evidence shows the exact remaining net-integration compact blocked frontier is still the BasicLB deprecation pair on wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702, cross-subscription VNet on wait-spec-net-integration-cross-subscription-vnet-response-20260702, the outboundType=none topology-constraint pair on wait-spec-net-integration-outbound-none-topology-constraint-20260702, spec.net-integration.outbound-udr on wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702, the run-171350866 custom-route-table/user-assigned-MSI node-readiness blocker, the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none, and the returned MultiNIC rerun artifacts for ${dualstackSpecId} (run 172280731) plus ${mixedSpecId} (run 172281011) now represented by ${consumerTaskId}. Run ${historicalConsumedRunId} is consumed history only and ${historicalWaitTaskId} stays historical lineage only.`;
const holderResumeCondition =
  `Resume only when one exact represented blocked surface materially changes (the BasicLB pair, cross-subscription pairing/access proof, outboundType=none topology constraints, the BYO UDR prerequisite contract, run 171350866 node-readiness diagnosis, accepted live-capable reclassification of multinic-standard plus natgw-v2-migration-v2-to-none, or ${consumerTaskId} returns a sharper exact successor for runs 172280731 / 172281011).`;
const holderFallbackAction =
  `If ${consumerTaskId} finishes without a sharper successor, replace this holder with the returned domain successor or refresh the holder with new evidence. Do not restore ${dualstackWaitTaskId} or ${mixedWaitTaskId} as passive blocked waits.`;
const holderWaitingFor = {
  type: "domain.result-consumption.required",
  taskId: consumerTaskId,
  runIds: ["172280731", "172281011"],
  specIds: [dualstackSpecId, mixedSpecId],
  predecessorTaskIds: [dualstackWaitTaskId, mixedWaitTaskId],
  historicalConsumedRunId,
  reason:
    "returned same-spec artifacts already exist locally and now need grouped consumption/classification rather than another passive wait",
};

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const requiredPaths = [
  resolve(appDir, auditMemoPath),
  dualstackResultPath,
  dualstackDiagnosisPath,
  mixedResultPath,
  mixedDiagnosisPath,
];
for (const path of requiredPaths) {
  assert(existsSync(path), `Required artifact missing: ${path}`);
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const holderBefore = treeBefore.tasks[holderTaskId] as TaskNode | undefined;
const compactLoopBefore = treeBefore.tasks[compactLoopTaskId] as TaskNode | undefined;
const dualstackWaitBefore = treeBefore.tasks[dualstackWaitTaskId] as TaskNode | undefined;
const mixedWaitBefore = treeBefore.tasks[mixedWaitTaskId] as TaskNode | undefined;
const consumerBefore = readTask(config, consumerTaskId) as TaskNode | undefined;
assert(holderBefore, `Missing task ${holderTaskId}`);
assert(compactLoopBefore, `Missing task ${compactLoopTaskId}`);
assert(dualstackWaitBefore, `Missing task ${dualstackWaitTaskId}`);
assert(mixedWaitBefore, `Missing task ${mixedWaitTaskId}`);

const featureLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const featureState = featureLoaded.state;
const featureBefore = clone(featureState.features[featureKey]);
assert(featureBefore, `Missing feature-compact state for ${featureKey}`);

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
});
const specState = specLoaded.state;
const specBefore = {
  [dualstackSpecId]: clone(specState.specs[dualstackSpecId]),
  [mixedSpecId]: clone(specState.specs[mixedSpecId]),
} as Record<string, SpecLoopSpecState>;
assert(specBefore[dualstackSpecId], `Missing spec row ${dualstackSpecId}`);
assert(specBefore[mixedSpecId], `Missing spec row ${mixedSpecId}`);

const baseline = {
  liveConsumerExists: Boolean(consumerBefore),
  holderRepresentation: asRecord(holderBefore.context).currentRepresentation ?? null,
  holderDownstreamCarrierTaskIds:
    asRecord(holderBefore.context).downstreamCarrierTaskIds ?? null,
  dualstackWaitState:
    dualstackWaitBefore.state ?? dualstackWaitBefore.status ?? null,
  mixedWaitState: mixedWaitBefore.state ?? mixedWaitBefore.status ?? null,
  featureFrontierTaskIds: featureBefore.frontierTaskIds ?? null,
  featureWaitingFor: featureBefore.waitingFor ?? null,
  dualstackSpecTaskId: specBefore[dualstackSpecId].taskId ?? null,
  mixedSpecTaskId: specBefore[mixedSpecId].taskId ?? null,
};

if (!consumerBefore) {
  createTask(config, {
    id: consumerTaskId,
    parentId: compactLoopTaskId,
    state: "backlog",
    kind: "domain_leaf",
    priority: "P2",
    owner: "aks-explorer",
    goal: consumerGoal,
    inputs: consumerInputs,
    outputs: [domainOutputPath],
    acceptance: consumerAcceptance,
    conflict_scope: consumerConflictScope,
    context: {
      featureKey,
      runIds: ["172280731", "172281011"],
      predecessorTaskIds: [dualstackWaitTaskId, mixedWaitTaskId],
      predecessorEvidencePath: `../aks-rp-e2e.app/${auditMemoPath}`,
      dualstackResultPath,
      dualstackDiagnosisPath,
      mixedResultPath,
      mixedDiagnosisPath,
      groupedConsumer: true,
      nextStep: "returned-artifact-consumption-and-classification",
    },
  });
}

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
  const compactLoop = tree.tasks[compactLoopTaskId] as TaskNode | undefined;
  const consumer = tree.tasks[consumerTaskId] as TaskNode | undefined;
  assert(holder, `Missing task during mutation: ${holderTaskId}`);
  assert(compactLoop, `Missing task during mutation: ${compactLoopTaskId}`);
  assert(consumer, `Missing task during mutation: ${consumerTaskId}`);

  holder.state = "blocked";
  holder.status = "blocked";
  holder.goal = holderGoal;
  holder.acceptance = [...holderAcceptance];
  holder.outputs = unique([
    ...asStringArray(holder.outputs),
    ".state/feature-compact-loop/state.json",
    ".state/spec-loop/state.json",
    applyMemoPath,
    domainOutputPath,
  ]);
  holder.context = {
    ...asRecord(holder.context),
    featureCompactExactWait: true,
    featureKey,
    errorClass: "package-partial",
    target: "staging",
    downstreamCarrierTaskIds: [consumerTaskId],
    exactSuccessorTaskIds: [consumerTaskId],
    historicalConsumedRunIds: [historicalConsumedRunId],
    historicalTerminalReviewTaskIds: [historicalWaitTaskId],
    reviewEvidencePath: applyMemoPath,
    returnedArtifactConsumerTaskId: consumerTaskId,
    returnedArtifactRunIds: ["172280731", "172281011"],
    currentRepresentation: "grouped-returned-artifact-consumer",
  };
  const holderBlockerBefore = asRecord(holder.blocker);
  const nextCheckAt =
    asString(holderBlockerBefore.next_check_at) || "2026-07-15T15:00:00Z";
  const fallbackAt =
    asString(holderBlockerBefore.fallback_at) || "2026-07-16T03:00:00Z";
  holder.blocker = {
    ...holderBlockerBefore,
    condition: holderCondition,
    category: asString(holderBlockerBefore.category) || "blocked-wait",
    owner: asString(holderBlockerBefore.owner) || "aks-explorer",
    blocked_at: asString(holderBlockerBefore.blocked_at) || appliedAt,
    waiting_for: holderWaitingFor,
    observed_by:
      Object.keys(asRecord(holderBlockerBefore.observed_by)).length > 0
        ? asRecord(holderBlockerBefore.observed_by)
        : {
            workflow: "project-planner",
            schedule: "blocked-frontier-app-ops-review",
            trigger: "project.task.reviewed",
          },
    observation_method:
      "Planner/app-ops keeps the compact holder exact while aks-explorer consumes the returned MultiNIC rerun artifacts and returns the next sharper successor.",
    next_check_at: nextCheckAt,
    resume_condition: holderResumeCondition,
    fallback_at: fallbackAt,
    fallback_action: holderFallbackAction,
    resume_at: nextCheckAt,
  };
  holder.result =
    `${attemptId}: holder now routes the MultiNIC pair through grouped returned-artifact consumer ${consumerTaskId}; ${dualstackWaitTaskId} and ${mixedWaitTaskId} are superseded.`;
  holder.trace = {
    ...asRecord(holder.trace),
    compact_net_integration_grouped_consumer_reconciled_at: appliedAt,
    compact_net_integration_grouped_consumer_reconciled_by: worker,
    compact_net_integration_grouped_consumer_attempt_id: attemptId,
    compact_net_integration_grouped_consumer_task_id: consumerTaskId,
    compact_net_integration_grouped_consumer_run_ids: ["172280731", "172281011"],
  };

  consumer.state = consumer.state ?? consumer.status ?? "backlog";
  consumer.status = consumer.state ?? consumer.status ?? "backlog";
  consumer.goal = consumerGoal;
  consumer.inputs = [...consumerInputs];
  consumer.outputs = [domainOutputPath];
  consumer.acceptance = [...consumerAcceptance];
  consumer.context = {
    ...asRecord(consumer.context),
    featureKey,
    runIds: ["172280731", "172281011"],
    predecessorTaskIds: [dualstackWaitTaskId, mixedWaitTaskId],
    predecessorEvidencePath: `../aks-rp-e2e.app/${auditMemoPath}`,
    dualstackResultPath,
    dualstackDiagnosisPath,
    mixedResultPath,
    mixedDiagnosisPath,
    groupedConsumer: true,
    nextStep: "returned-artifact-consumption-and-classification",
  };
  consumer.trace = {
    ...asRecord(consumer.trace),
    restored_from_archived_payload_at: appliedAt,
    restored_from_archived_payload_by: worker,
    restored_from_archived_payload_attempt_id: attemptId,
  };

  compactLoop.children = unique([
    ...asStringArray(compactLoop.children),
    holderTaskId,
    consumerTaskId,
  ]);

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const dualstackRetired = markTaskDone(config, {
  taskId: dualstackWaitTaskId,
  resolution: "replaced",
  summary:
    `Run 172280731 is already terminal with reviewable same-spec result and diagnosis artifacts, so passive wait ${dualstackWaitTaskId} is replaced by grouped returned-artifact consumer ${consumerTaskId}. See ${applyMemoPath}.`,
});
const mixedRetired = markTaskDone(config, {
  taskId: mixedWaitTaskId,
  resolution: "replaced",
  summary:
    `Run 172281011 is already terminal with reviewable same-spec result and diagnosis artifacts, so passive wait ${mixedWaitTaskId} is replaced by grouped returned-artifact consumer ${consumerTaskId}. See ${applyMemoPath}.`,
});

const featureEvidencePaths = unique([
  ...(featureBefore.evidencePaths ?? []),
  auditMemoPath,
  applyMemoPath,
]);
const featureAttemptedFixes = unique([
  ...(featureBefore.attemptedFixes ?? []),
  `${attemptId}: restored grouped returned-artifact consumer ${consumerTaskId}, retired stale waits ${dualstackWaitTaskId} and ${mixedWaitTaskId}, and rewrote compact controller-visible state to the grouped consumption/classification posture.`,
]);

updateFeatureCompactItem(featureState, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [consumerTaskId],
  retryable: false,
  retryReason:
    `Keep ${holderTaskId} blocked while ${consumerTaskId} remains the exact next grouped returned-artifact consumption/classification step for the MultiNIC pair; do not restore ${dualstackWaitTaskId} or ${mixedWaitTaskId} as passive waits.`,
  ownerReason:
    `All feature-owned specs are already selected into the compact package. The remaining compact blocked frontier stays on ${holderTaskId} for the named BasicLB, cross-subscription VNet, outboundType=none, BYO UDR, custom-route-table/user-assigned-MSI, and multinic-standard/natgw-v2-migration-v2-to-none surfaces, while the MultiNIC dualstack/mixed pair is now represented by grouped returned-artifact consumer ${consumerTaskId}.`,
  nextStepClassification:
    `grouped returned-artifact consumption/classification via ${consumerTaskId} is now the exact next step for the MultiNIC dualstack/mixed pair instead of passive waits ${dualstackWaitTaskId} and ${mixedWaitTaskId}`,
  resumeCondition: holderResumeCondition,
  blockedReason: holderCondition,
  waitingFor: holderWaitingFor,
  waitingCondition:
    `${consumerTaskId} must consume the already returned same-spec result/diagnosis artifacts for runs 172280731 and 172281011; the MultiNIC pair is no longer waiting for Azure DevOps publication.`,
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.task.reviewed",
  },
  observationMethod:
    "Planner/app-ops keeps the compact holder exact while aks-explorer consumes the returned MultiNIC rerun artifacts and returns the next sharper successor.",
  nextCheckAt: "2026-07-15T15:00:00Z",
  blockerOwner: "aks-explorer",
  fallbackAt: "2026-07-16T03:00:00Z",
  fallbackAction: holderFallbackAction,
  resumeAction:
    `Keep ${featureKey} blocked until ${consumerTaskId} returns a sharper exact successor or another named frontier materially changes.`,
  lastCheckedAt: appliedAt,
  evidencePaths: featureEvidencePaths,
  reviewEvidencePath: applyMemoPath,
  verificationBlocker:
    `Do not restore ${dualstackWaitTaskId} or ${mixedWaitTaskId} as the active MultiNIC frontier; keep the pair represented by grouped returned-artifact consumer ${consumerTaskId}.`,
  summary:
    `Net-integration now represents the MultiNIC dualstack + mixed pair through grouped returned-artifact consumer ${consumerTaskId} instead of passive waits ${dualstackWaitTaskId} and ${mixedWaitTaskId}.`,
  attemptedFixes: featureAttemptedFixes,
});
saveFeatureCompactLoopState(featureLoaded.path, featureState);

const specRepairs = [
  {
    specId: dualstackSpecId,
    runId: "172280731",
  },
  {
    specId: mixedSpecId,
    runId: "172281011",
  },
] as const;

for (const repair of specRepairs) {
  const before = specState.specs[repair.specId];
  assert(before, `Missing spec-loop row ${repair.specId}`);
  const review = asRecord(before.review);
  review.classification =
    "grouped_returned_artifact_consumption_pending_classification";
  review.lastAction =
    `Represent ${repair.specId} through grouped returned-artifact consumer ${consumerTaskId} for terminal run ${repair.runId}; do not keep passive wait ${before.taskId ?? "(missing)"} active now that the exact result/diagnosis artifacts already exist.`;
  review.reviewedAt = appliedAt;
  review.runId = repair.runId;
  review.owner = "aks-explorer";
  review.observer = "app-ops";
  updateSpecLoopSpec(specState, repair.specId, {
    status: "pending",
    taskId: consumerTaskId,
    review,
    successorDisposition: "grouped-returned-artifact-consumption-pending",
    successorEvidencePath: applyMemoPath,
    successorStateReason:
      `${repair.specId} already has terminal same-spec artifacts for run ${repair.runId}, so passive wait handling is superseded by grouped consumer ${consumerTaskId}.`,
    resumeCondition:
      `Resume through ${consumerTaskId} once the grouped returned-artifact consumption/classification is completed for runs 172280731 / 172281011, or after exact proof that a sharper successor superseded that grouped consumer.`,
    terminalDisposition: false,
  });
}
const mirrorSpecLoopPath = resolve(projectDir, ".state", "spec-loop", "state.json");
saveSpecLoopState(
  specLoaded.path,
  specState,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);

const treeAfter = readTaskTree(config);
const holderAfter = treeAfter.tasks[holderTaskId] as TaskNode | undefined;
const consumerAfter = treeAfter.tasks[consumerTaskId] as TaskNode | undefined;
const dualstackAfter = readTask(config, dualstackWaitTaskId) as TaskNode | undefined;
const mixedAfter = readTask(config, mixedWaitTaskId) as TaskNode | undefined;
const featureAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
}).state.features[featureKey];
const specAfter = {
  [dualstackSpecId]: clone(specState.specs[dualstackSpecId]),
  [mixedSpecId]: clone(specState.specs[mixedSpecId]),
} as Record<string, SpecLoopSpecState>;

const memo = `# App-ops apply — compact net-integration grouped returned-artifact consumer repair

- Task: \`ops-apply-ops-apply-ops-apply-ops-apply-audit-compact-net-integration-return-lineage-20260715-task-tree-followup-task-tr\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Worker: \`${worker}\`
- Live mutation applied from this worker session: **yes**
- Script: \`scripts/ops-apply-grouped-net-integration-rerun-artifact-consumer-20260715.ts\`

## Applied mutation summary

1. Restored live grouped successor \`${consumerTaskId}\` under \`${compactLoopTaskId}\` with the audit memo plus all four exact returned artifact paths in \`inputs\`.
2. Retired stale waits \`${dualstackWaitTaskId}\` and \`${mixedWaitTaskId}\` as \`resolution=replaced\` because both runs are terminal and their exact same-spec artifacts already exist locally.
3. Rewrote \`${holderTaskId}\` so its goal, acceptance, context successor fields, blocker.waiting_for, resume condition, and fallback action now point at grouped returned-artifact consumption/classification through \`${consumerTaskId}\`.
4. Rewrote app-owned \`.state/feature-compact-loop/state.json\` for \`${featureKey}\` so the active next step is grouped returned-artifact consumption/classification instead of the two stale wait ids.
5. Rebound spec-loop rows \`${dualstackSpecId}\` and \`${mixedSpecId}\` to the grouped consumer so the branch no longer points at retired passive waits.

## Baseline before apply

- live grouped consumer existed: \`${String(baseline.liveConsumerExists)}\`
- holder currentRepresentation before apply: \`${String(baseline.holderRepresentation)}\`
- holder downstreamCarrierTaskIds before apply: \`${JSON.stringify(baseline.holderDownstreamCarrierTaskIds)}\`
- dualstack wait state before apply: \`${String(baseline.dualstackWaitState)}\`
- mixed wait state before apply: \`${String(baseline.mixedWaitState)}\`
- feature frontierTaskIds before apply: \`${JSON.stringify(baseline.featureFrontierTaskIds)}\`
- feature waitingFor before apply: \`${JSON.stringify(baseline.featureWaitingFor)}\`
- dualstack spec taskId before apply: \`${String(baseline.dualstackSpecTaskId)}\`
- mixed spec taskId before apply: \`${String(baseline.mixedSpecTaskId)}\`

## Exact grouped successor inputs

1. \`../aks-rp-e2e.app/${auditMemoPath}\`
2. \`${dualstackResultPath}\`
3. \`${dualstackDiagnosisPath}\`
4. \`${mixedResultPath}\`
5. \`${mixedDiagnosisPath}\`

## Post-apply state

- holder currentRepresentation after apply: \`${String(asRecord(holderAfter?.context).currentRepresentation ?? null)}\`
- holder exactSuccessorTaskIds after apply: \`${JSON.stringify(asRecord(holderAfter?.context).exactSuccessorTaskIds ?? null)}\`
- holder blocker.waiting_for after apply: \`${JSON.stringify(asRecord(holderAfter?.blocker).waiting_for ?? null)}\`
- feature frontierTaskIds after apply: \`${JSON.stringify(featureAfter?.frontierTaskIds ?? null)}\`
- feature waitingFor after apply: \`${JSON.stringify(featureAfter?.waitingFor ?? null)}\`
- dualstack wait after apply: state=\`${String(dualstackAfter?.state ?? dualstackAfter?.status ?? null)}\`, resolution=\`${String((dualstackAfter as MutableRecord | undefined)?.resolution ?? null)}\`
- mixed wait after apply: state=\`${String(mixedAfter?.state ?? mixedAfter?.status ?? null)}\`, resolution=\`${String((mixedAfter as MutableRecord | undefined)?.resolution ?? null)}\`
- dualstack spec taskId after apply: \`${String(specAfter[dualstackSpecId].taskId ?? null)}\`
- mixed spec taskId after apply: \`${String(specAfter[mixedSpecId].taskId ?? null)}\`

## Verification targets satisfied

- \`bun run task-tree show ${consumerTaskId}\` returns a live nonterminal task with the audit memo and all four exact artifact paths in \`inputs\`.
- \`bun run task-tree show ${dualstackWaitTaskId}\` no longer shows a live blocked passive ADO wait.
- \`bun run task-tree show ${mixedWaitTaskId}\` no longer shows a live blocked passive ADO wait.
- \`bun run task-tree show ${holderTaskId}\` now points at \`${consumerTaskId}\` instead of the stale wait pair.
- \`.state/feature-compact-loop/state.json\` now records grouped returned-artifact consumption/classification as the next exact MultiNIC step.
`;
writeText(resolve(appDir, applyMemoPath), memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      script: "scripts/ops-apply-grouped-net-integration-rerun-artifact-consumer-20260715.ts",
      consumerTaskId,
      dualstackRetired,
      mixedRetired,
      holderAfter: {
        currentRepresentation: asRecord(holderAfter?.context).currentRepresentation ?? null,
        exactSuccessorTaskIds:
          asRecord(holderAfter?.context).exactSuccessorTaskIds ?? null,
      },
      consumerAfter: {
        state: consumerAfter?.state ?? consumerAfter?.status ?? null,
        inputs: consumerAfter?.inputs ?? null,
      },
      featureAfter: {
        taskId: featureAfter?.taskId ?? null,
        frontierTaskIds: featureAfter?.frontierTaskIds ?? null,
        waitingFor: featureAfter?.waitingFor ?? null,
        reviewEvidencePath: featureAfter?.reviewEvidencePath ?? null,
      },
      specAfter: {
        [dualstackSpecId]: {
          taskId: specAfter[dualstackSpecId].taskId ?? null,
          successorDisposition: specAfter[dualstackSpecId].successorDisposition ?? null,
        },
        [mixedSpecId]: {
          taskId: specAfter[mixedSpecId].taskId ?? null,
          successorDisposition: specAfter[mixedSpecId].successorDisposition ?? null,
        },
      },
      memoPath: applyMemoPath,
    },
    null,
    2,
  ),
);

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createTask,
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

type MutableRecord = Record<string, unknown>;
type TaskNode = MutableRecord & {
  id: string;
  parent_id?: string;
  state?: string;
  status?: string;
  goal?: string;
  acceptance?: string[];
  outputs?: string[];
  context?: MutableRecord;
  trace?: MutableRecord;
  blocker?: MutableRecord;
  result?: string;
  resolution?: string;
  done_at?: string;
  done_by?: string;
};

const attemptId =
  "a_ops-apply-ops-apply-reconcile-compact-net-integration-after-representation-repair-20260715-task-tree-_20260715025126";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const dryRun = process.argv.includes("--dry-run");

const compactLoopTaskId = "aks-feature-compact-loop";
const holderTaskId = "hold-compact-net-integration-package-partial-frontier";
const staleRepairTaskId =
  "ops-apply-ops-apply-repair-live-wait-archive-regression-unrepresented-loop-record-20260715-task-tree-followup-state-repa";
const historicalWaitTaskId =
  "wait-net-integration-multinic-dualstack-ado-run-172275388-result";
const historicalConsumedTaskId =
  "domain/consume-net-integration-multinic-live-run-172268432-return-20260715";
const consumerTaskId =
  "domain/consume-net-integration-multinic-live-run-172275388-return-20260715";
const featureKey = "net-integration";
const runId = "172275388";
const consumedHistoryRunId = "172268432";
const specIds = [
  "spec.net-integration.multinic-dualstack",
  "spec.net-integration.multinic-mixed",
] as const;

const priorProposalMemo =
  "evidence/archive/ops-apply-reconcile-compact-net-integration-after-representation-repair-20260715-task-tree-followup.md";
const waitReviewMemo =
  "evidence/archive/ops-apply-ops-apply-ops-apply-ops-apply-wait-net-integration-multinic-dualstack-ado-run-172275388-result-task-tree-follo-20260715.md";
const applyMemoPath =
  "evidence/archive/ops-apply-reconcile-compact-net-integration-run-172275388-returned-artifacts-20260715.md";
const applyMemoAbsolute = resolve(appDir, applyMemoPath);

const aggregateResultPath =
  "../aks-rp-e2e/workspace/domain-reconcile-compact-net-integration-after-representation-repair-20260715/20260715T1930Z/download/runs/test-results/test_20260715021848642_74ijaf_801850/result.json";
const dualstackResultPath =
  "../aks-rp-e2e/workspace/domain-reconcile-compact-net-integration-after-representation-repair-20260715/20260715T1930Z/download/runs/test-results/test_20260715021848642_74ijaf_801850/artifacts/net-integration-multinic-dualstack/spec-runner/result.json";
const mixedResultPath =
  "../aks-rp-e2e/workspace/domain-reconcile-compact-net-integration-after-representation-repair-20260715/20260715T1930Z/download/runs/test-results/test_20260715021848642_74ijaf_801850/artifacts/net-integration-multinic-mixed/spec-runner/result.json";
const domainFollowupMemo =
  "../aks-rp-e2e/evidence/archive/domain-consume-net-integration-multinic-live-run-172275388-return-20260715.md";

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

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const consumerGoal =
  "Consume run 172275388 returned artifacts for spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed, record the shared HTTP 400 provisioningState=(missing) cluster-create boundary on the intended API/version/SKU settings, and return the next exact successor for the compact net-integration branch without reopening an artifact wait.";
const consumerAcceptance = [
  "Run 172275388 aggregate and per-spec returned artifacts are cited for spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed.",
  "The task records the shared HTTP 400 provisioningState=(missing) cluster-create boundary together with the intended repaired runtime settings: apiVersion 2026-05-02-preview, kubernetesVersion 1.33, and nodeVmSize Standard_D4s_v3 / Standard_D8s_v3.",
  "The result leaves run 172268432 as consumed history only and does not reopen run 172275388 as an artifact wait.",
];
const consumerConflictScope = [
  "feature-compact:net-integration",
  "feature:net-integration",
  "spec:spec.net-integration.multinic-dualstack",
  "spec:spec.net-integration.multinic-mixed",
  "ado-run:172275388",
];
const consumerInputs = [
  priorProposalMemo,
  waitReviewMemo,
  aggregateResultPath,
  dualstackResultPath,
  mixedResultPath,
];
const consumerOutputs = [domainFollowupMemo];

const holderGoal =
  `Hold compact feature net-integration on the exact package-partial frontier while ${consumerTaskId} consumes run ${runId} returned artifacts for the MultiNIC pair and returns the next truthful successor.`;
const holderAcceptance = [
  `The feature remains blocked only while the exact net-integration package-partial frontier is still true and ${consumerTaskId} has not yet returned a sharper successor for run ${runId}.`,
  `Run ${consumedHistoryRunId} remains consumed history only and is not reopened as the live carrier for the MultiNIC pair.`,
  `Do not recreate a blocked artifact wait for run ${runId} unless owner review explicitly rejects the returned-artifact evidence cited by ${consumerTaskId}.`,
];
const holderCondition =
  `Current compact/spec-loop/spec evidence shows the exact remaining net-integration compact blocked frontier is still the BasicLB deprecation pair on wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702, cross-subscription VNet on wait-spec-net-integration-cross-subscription-vnet-response-20260702, the outboundType=none topology-constraint pair on wait-spec-net-integration-outbound-none-topology-constraint-20260702, spec.net-integration.outbound-udr on wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702, the run-171350866 custom-route-table/user-assigned-MSI node-readiness blocker, the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none, and the returned terminal artifact pair for spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed now represented by ${consumerTaskId} for run ${runId}. Run ${consumedHistoryRunId} is consumed history only; preserve ${historicalWaitTaskId} as historical terminal-review lineage only and do not reopen it as a blocked artifact wait.`;
const holderResumeCondition =
  `Resume only when one exact represented blocked surface materially changes (the BasicLB pair, cross-subscription pairing/access proof, outboundType=none topology constraints, the BYO UDR prerequisite contract, run 171350866 node-readiness diagnosis, accepted live-capable reclassification of multinic-standard plus natgw-v2-migration-v2-to-none, or ${consumerTaskId} returns a sharper exact successor for run ${runId}).`;
const holderFallbackAction =
  `If ${consumerTaskId} finishes without a sharper successor, replace this holder with the exact returned domain successor or refresh the holder with new evidence. Do not restore ${historicalWaitTaskId} as a blocked artifact wait unless owner review explicitly rejects the returned-artifact evidence.`;

const featureWaitingFor = {
  type: "domain.result-consumption.required",
  taskId: consumerTaskId,
  runId,
  historicalConsumedRunId: consumedHistoryRunId,
  predecessorTaskId: historicalWaitTaskId,
  specIds: [...specIds],
  reason:
    "returned artifacts already exist; consume the MultiNIC pair and return the next exact successor without reopening an artifact wait",
};
const featureWaitingCondition =
  `Returned terminal artifacts from run ${runId} already exist and must be consumed by ${consumerTaskId}; run ${consumedHistoryRunId} remains consumed history only and must not be reopened as the live carrier.`;
const staleRepairReplacementSummary =
  `Superseded stale wait-restoration repair ${staleRepairTaskId}: returned-artifact evidence for run ${runId} now routes the MultiNIC pair through ${consumerTaskId}, so do not recreate ${historicalWaitTaskId} as a blocked artifact wait unless owner review explicitly rejects the returned-artifact evidence.`;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const holderBefore = treeBefore.tasks[holderTaskId] as TaskNode | undefined;
const compactLoopBefore =
  treeBefore.tasks[compactLoopTaskId] as TaskNode | undefined;
const consumerBefore = readTask(config, consumerTaskId) as TaskNode | undefined;
const staleRepairBefore =
  treeBefore.tasks[staleRepairTaskId] as TaskNode | undefined;
assert(holderBefore, `Missing task ${holderTaskId}`);
assert(compactLoopBefore, `Missing task ${compactLoopTaskId}`);

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

const baseline = {
  holderState: holderBefore.state ?? holderBefore.status ?? null,
  holderBlockerCondition: asRecord(holderBefore.blocker).condition ?? null,
  compactLoopChildrenHasConsumer: asStringArray(compactLoopBefore.children).includes(
    consumerTaskId,
  ),
  liveConsumerExists: Boolean(consumerBefore),
  staleRepairState: staleRepairBefore?.state ?? staleRepairBefore?.status ?? null,
  featureTaskId: featureBefore.taskId ?? null,
  featureFrontierTaskIds: Array.isArray(featureBefore.frontierTaskIds)
    ? featureBefore.frontierTaskIds
    : [],
  featureWaitingFor: featureBefore.waitingFor ?? null,
  featureWaitingCondition: featureBefore.waitingCondition ?? null,
  featureReviewEvidencePath: featureBefore.reviewEvidencePath ?? null,
};

const planned = {
  createOrUpdateConsumer: {
    id: consumerTaskId,
    parentId: compactLoopTaskId,
    state: consumerBefore?.state ?? consumerBefore?.status ?? "backlog",
    goal: consumerGoal,
    inputs: consumerInputs,
    outputs: consumerOutputs,
    acceptance: consumerAcceptance,
    conflictScope: consumerConflictScope,
  },
  rewriteHolder: {
    taskId: holderTaskId,
    state: "blocked",
    goal: holderGoal,
    acceptance: holderAcceptance,
    blocker: {
      condition: holderCondition,
      waiting_for: featureWaitingFor,
      resume_condition: holderResumeCondition,
      fallback_action: holderFallbackAction,
    },
  },
  supersedeStaleRepair: staleRepairBefore
    ? {
        taskId: staleRepairTaskId,
        action: "mark-done-replaced",
        summary: staleRepairReplacementSummary,
      }
    : null,
  updateFeatureCompactState: {
    featureKey,
    taskId: consumerTaskId,
    frontierTaskIds: [holderTaskId, consumerTaskId],
    waitingFor: featureWaitingFor,
    waitingCondition: featureWaitingCondition,
    reviewEvidencePath: applyMemoPath,
  },
};

if (!dryRun) {
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
      outputs: consumerOutputs,
      acceptance: consumerAcceptance,
      conflict_scope: consumerConflictScope,
      context: {
        featureKey,
        runId,
        historicalConsumedRunId: consumedHistoryRunId,
        predecessorTaskId: historicalWaitTaskId,
        predecessorEvidencePath: waitReviewMemo,
        aggregateResultPath,
        dualstackResultPath,
        mixedResultPath,
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
      applyMemoPath,
      domainFollowupMemo,
    ]);
    holder.context = {
      ...asRecord(holder.context),
      featureCompactExactWait: true,
      featureKey,
      errorClass: "package-partial",
      target: "staging",
      downstreamCarrierTaskIds: [consumerTaskId],
      historicalConsumedRunIds: [consumedHistoryRunId],
      historicalTerminalReviewTaskIds: [historicalWaitTaskId],
      reviewEvidencePath: applyMemoPath,
      returnedArtifactConsumerTaskId: consumerTaskId,
      returnedArtifactRunId: runId,
    };
    const holderBlockerBefore = asRecord(holder.blocker);
    holder.blocker = {
      ...holderBlockerBefore,
      condition: holderCondition,
      category: asString(holderBlockerBefore.category) || "blocked-wait",
      owner: asString(holderBlockerBefore.owner) || "aks-explorer",
      blocked_at: asString(holderBlockerBefore.blocked_at) || appliedAt,
      waiting_for: featureWaitingFor,
      observed_by:
        Object.keys(asRecord(holderBlockerBefore.observed_by)).length > 0
          ? asRecord(holderBlockerBefore.observed_by)
          : {
              workflow: "project-planner",
              schedule: "blocked-frontier-app-ops-review",
              trigger: "project.task.reviewed",
            },
      observation_method:
        asString(holderBlockerBefore.observation_method) ||
        "Planner/app-ops keeps the net-integration package-partial holder exact while aks-explorer consumes returned artifacts for run 172275388 and returns the next sharper successor.",
      next_check_at:
        asString(holderBlockerBefore.next_check_at) || addHours(appliedAt, 6),
      resume_condition: holderResumeCondition,
      fallback_at:
        asString(holderBlockerBefore.fallback_at) || addHours(appliedAt, 24),
      fallback_action: holderFallbackAction,
      resume_at:
        asString(holderBlockerBefore.resume_at) || addHours(appliedAt, 6),
    };
    holder.result =
      `${attemptId}: holder now routes the MultiNIC returned-artifact pair through ${consumerTaskId}; run ${consumedHistoryRunId} stays consumed history only and ${historicalWaitTaskId} stays historical lineage only.`;
    holder.trace = {
      ...asRecord(holder.trace),
      compact_net_integration_returned_artifact_reconciled_at: appliedAt,
      compact_net_integration_returned_artifact_reconciled_by: worker,
      compact_net_integration_returned_artifact_attempt_id: attemptId,
      compact_net_integration_returned_artifact_consumer_task_id: consumerTaskId,
      compact_net_integration_returned_artifact_run_id: runId,
      compact_net_integration_consumed_history_run_id: consumedHistoryRunId,
      compact_net_integration_historical_wait_task_id: historicalWaitTaskId,
    };

    compactLoop.children = unique([
      ...asStringArray(compactLoop.children),
      holderTaskId,
      consumerTaskId,
    ]);

    const staleRepair = tree.tasks[staleRepairTaskId] as TaskNode | undefined;
    if (staleRepair && (staleRepair.state ?? staleRepair.status) !== "done") {
      staleRepair.state = "done";
      staleRepair.status = "done";
      staleRepair.resolution = "replaced";
      staleRepair.done_at = appliedAt;
      staleRepair.done_by = worker;
      staleRepair.result = staleRepairReplacementSummary;
      staleRepair.context = {
        ...asRecord(staleRepair.context),
        replacementTaskId: consumerTaskId,
        returnedArtifactRunId: runId,
        historicalWaitTaskId: historicalWaitTaskId,
        ownerReviewGuardrail:
          `Do not recreate ${historicalWaitTaskId} as a blocked artifact wait unless owner review explicitly rejects the returned-artifact evidence now routed through ${consumerTaskId}.`,
      };
      staleRepair.trace = {
        ...asRecord(staleRepair.trace),
        superseded_at: appliedAt,
        superseded_by: worker,
        superseded_attempt_id: attemptId,
        superseded_by_task_id: consumerTaskId,
        superseded_reason:
          "returned-artifact evidence for run 172275388 replaced the stale wait-restoration path",
      };
    }

    saveTaskTreeWithKanbanSnapshot(config, tree);
  });

  const attemptedFixes = unique([
    ...(Array.isArray(featureBefore.attemptedFixes)
      ? featureBefore.attemptedFixes
      : []),
    `${attemptId}: replaced stale run-172275388 artifact-wait representation with returned-artifact consumer ${consumerTaskId}, kept run 172268432 as consumed history only, and superseded stale wait-restoration task ${staleRepairTaskId}.`,
  ]);
  const evidencePaths = unique([
    ...(Array.isArray(featureBefore.evidencePaths) ? featureBefore.evidencePaths : []),
    priorProposalMemo,
    waitReviewMemo,
    applyMemoPath,
    domainFollowupMemo,
  ]);
  const featureSummary =
    `Returned artifacts from run ${runId} are no longer represented as an artifact wait. The exact MultiNIC pair successor is ${consumerTaskId}, while run ${consumedHistoryRunId} remains consumed history only.`;
  updateFeatureCompactItem(featureState, featureKey, {
    status: "blocked",
    taskId: consumerTaskId,
    frontierTaskIds: [holderTaskId, consumerTaskId],
    retryable: false,
    retryReason:
      `Resume only when ${consumerTaskId} returns a sharper exact successor for run ${runId} or another named net-integration frontier materially changes; do not reopen run ${runId} as a blocked artifact wait or run ${consumedHistoryRunId} as the live carrier.`,
    ownerReason:
      `All feature-owned specs are already selected into the compact package. The remaining compact blocked frontier stays on ${holderTaskId} for the named BasicLB, cross-subscription VNet, outboundType=none, BYO UDR, custom-route-table/user-assigned-MSI, and multinic-standard/natgw-v2-migration-v2-to-none surfaces. The MultiNIC dualstack + mixed pair is no longer a live artifact wait: run ${runId} returned artifacts are now routed through ${consumerTaskId}, and run ${consumedHistoryRunId} remains consumed history only.`,
    attemptedFixes,
    nextStepClassification:
      `consume returned run-${runId} artifacts into one exact successor and preserve the remaining package-partial family wait without reopening stale artifact waits`,
    resumeCondition:
      holderResumeCondition,
    blockedAt: featureBefore.blockedAt ?? appliedAt,
    blockedReason: holderCondition,
    waitingFor: featureWaitingFor,
    waitingCondition: featureWaitingCondition,
    observedBy: {
      workflow: "project-planner",
      trigger: "project.task.reviewed",
      schedule: "blocked-frontier-app-ops-review",
    },
    observationMethod:
      "Planner/app-ops keeps the compact holder exact while aks-explorer consumes returned artifacts for run 172275388 and either returns a sharper successor or preserves the remaining family wait unchanged.",
    nextCheckAt: featureBefore.nextCheckAt ?? addHours(appliedAt, 6),
    blockerOwner: "aks-explorer",
    fallbackAt: featureBefore.fallbackAt ?? addHours(appliedAt, 24),
    fallbackAction:
      `If ${consumerTaskId} does not sharpen the branch, refresh the holder or replace it with the exact returned successor. Do not recreate ${historicalWaitTaskId} as a blocked artifact wait unless owner review explicitly rejects the returned-artifact evidence.`,
    resumeAction:
      `Keep the feature blocked until ${consumerTaskId} returns a represented sharper successor or another named frontier materially changes.`,
    blockedScope:
      featureBefore.blockedScope ?? {
        kind: "feature",
        ids: [featureKey],
      },
    blockedFingerprint:
      featureBefore.blockedFingerprint ?? {
        errorClass: "package-partial",
        target: "staging",
        branch: "dev",
        featureKey,
      },
    lastCheckedAt: appliedAt,
    evidencePaths,
    reviewEvidencePath: applyMemoPath,
    verificationBlocker:
      `Do not recreate ${historicalWaitTaskId} as a blocked artifact wait for run ${runId}. Returned artifacts already exist and are routed through ${consumerTaskId}; run ${consumedHistoryRunId} remains consumed history only.`,
    summary: featureSummary,
    lastSummary: featureSummary,
  });
  saveFeatureCompactLoopState(featureLoaded.path, featureState);

  const featureAfter = clone(featureState.features[featureKey]);
  const treeAfter = readTaskTree(config);
  const holderAfter = treeAfter.tasks[holderTaskId] as TaskNode | undefined;
  const consumerAfter = treeAfter.tasks[consumerTaskId] as TaskNode | undefined;
  const staleRepairAfter = treeAfter.tasks[staleRepairTaskId] as TaskNode | undefined;

  writeText(
    applyMemoAbsolute,
    `# App apply — net-integration run ${runId} returned-artifact reconciliation — 2026-07-15\n\n- Attempt: \`${attemptId}\`\n- Worker: \`${worker}\`\n- Applied at: \`${appliedAt}\`\n- Consumer task: \`${consumerTaskId}\`\n- Holder task: \`${holderTaskId}\`\n- Historical wait lineage only: \`${historicalWaitTaskId}\`\n- Historical consumed run only: \`${consumedHistoryRunId}\` via \`${historicalConsumedTaskId}\`\n\n## Baseline\n\n- holder state before apply: \`${String(baseline.holderState)}\`\n- live consumer before apply: \`${String(baseline.liveConsumerExists)}\`\n- feature taskId before apply: \`${String(baseline.featureTaskId)}\`\n- feature waitingFor before apply: \`${JSON.stringify(baseline.featureWaitingFor)}\`\n- stale repair state before apply: \`${String(baseline.staleRepairState)}\`\n\n## Applied mutations\n\n1. Created or refreshed \`${consumerTaskId}\` under \`${compactLoopTaskId}\` as the exact returned-artifact consumer for run \`${runId}\`.\n2. Rewrote \`${holderTaskId}\` from stale returned-artifact wait wording to the truthful returned-artifact-consumer story.\n3. Preserved run \`${consumedHistoryRunId}\` as consumed history only and kept \`${historicalWaitTaskId}\` as historical terminal-review lineage only.\n4. Superseded stale wait-restoration repair \`${staleRepairTaskId}\` so it cannot recreate a blocked artifact wait unless owner review explicitly rejects the returned-artifact evidence.\n5. Refreshed \`.state/feature-compact-loop/state.json\` for \`${featureKey}\` so the controller-visible row points at \`${consumerTaskId}\`.\n\n## Returned-artifact inputs routed to the consumer\n\n- aggregate result: \`${aggregateResultPath}\`\n- dualstack result: \`${dualstackResultPath}\`\n- mixed result: \`${mixedResultPath}\`\n- prior proposal memo: \`${priorProposalMemo}\`\n- terminal wait review memo: \`${waitReviewMemo}\`\n\n## Post-apply state\n\n- holder state after apply: \`${String(holderAfter?.state ?? holderAfter?.status ?? null)}\`\n- consumer exists after apply: \`${String(Boolean(consumerAfter))}\`\n- stale repair state after apply: \`${String(staleRepairAfter?.state ?? staleRepairAfter?.status ?? null)}\`\n- feature taskId after apply: \`${String(featureAfter?.taskId ?? null)}\`\n- feature frontierTaskIds after apply: \`${JSON.stringify(featureAfter?.frontierTaskIds ?? null)}\`\n- feature waitingFor after apply: \`${JSON.stringify(featureAfter?.waitingFor ?? null)}\`\n- feature reviewEvidencePath after apply: \`${JSON.stringify(featureAfter?.reviewEvidencePath ?? null)}\`\n`,
  );
}

console.log(
  JSON.stringify(
    {
      dryRun,
      appliedAt,
      attemptId,
      applyMemoPath,
      baseline,
      planned,
      note: dryRun
        ? `Dry-run only. Execute 'cd ${appDir} && bun run ./scripts/ops-apply-reconcile-compact-net-integration-run-172275388-returned-artifacts-20260715.ts' to apply the bounded task-tree and compact-state mutation.`
        : `Applied bounded task-tree and compact-state mutation; see ${applyMemoPath}.`,
    },
    null,
    2,
  ),
);

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
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
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

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

type ArchivedTaskSummary = {
  archiveFile: string;
  id: string;
  state: string | null;
  resolution: string | null;
  result?: string | null;
};

type SpecPatch = {
  specId: string;
  runId: string;
  runUrl: string;
  predecessorTaskId: string;
  resultPath: string;
  diagnosisPath: string;
  reviewClassification: string;
  lastRootCause: string;
  lastAction: string;
  successorDisposition: string;
  successorStateReason: string;
  resumeCondition: string;
};

const attemptId =
  "a_ops-apply-ops-apply-consume-net-integration-multinic-rerun-artifacts-172280731-172281011-20260715-task-tree-followup-tas_20260715051841";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const holderTaskId = "hold-compact-net-integration-package-partial-frontier";
const featureKey = "net-integration";
const subscriptionId = "26fe00f8-9173-4872-9134-bb1d2e00343a";
const featureRegistration =
  "Microsoft.ContainerService/NetworkingMultiNICPreview";
const predecessorTaskIds = [
  "domain/wait-net-integration-multinic-dualstack-run-172280731-result-20260715",
  "domain/wait-net-integration-multinic-mixed-run-172281011-result-20260715",
] as const;
const archivedConsumerTaskId =
  "domain/consume-net-integration-multinic-rerun-artifacts-172280731-172281011-20260715";
const historicalConsumedRunIds = ["172268432"] as const;
const historicalTerminalReviewTaskIds = [
  "wait-net-integration-multinic-dualstack-ado-run-172275388-result",
] as const;
const specIds = [
  "spec.net-integration.multinic-dualstack",
  "spec.net-integration.multinic-mixed",
] as const;
const runIds = ["172280731", "172281011"] as const;
const evidencePath =
  "evidence/archive/ops-apply-net-integration-multinic-registration-prerequisite-holder-20260715.md";
const domainEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/consume-net-integration-multinic-rerun-artifacts-20260715.md";
const predecessorEvidencePath =
  "evidence/archive/ops-apply-consume-net-integration-multinic-rerun-artifacts-172280731-172281011-20260715-task-tree-followup.md";
const reviewEvidencePath =
  "evidence/archive/ops-apply-ops-apply-ops-apply-ops-apply-audit-compact-net-integration-return-lineage-20260715-task-tree-followup-task-tr.md";

const dualstackResultPath =
  "/app/projects/aks-rp-e2e/workspace/ops-audit-compact-net-integration-return-lineage-20260715/run-172280731/runs/test-results/test_20260715030259778_0d242c_428354/artifacts/net-integration-multinic-dualstack/spec-runner/result.json";
const dualstackDiagnosisPath =
  "/app/projects/aks-rp-e2e/workspace/ops-audit-compact-net-integration-return-lineage-20260715/run-172280731/runs/test-results/test_20260715030259778_0d242c_428354/artifacts/net-integration-multinic-dualstack/spec-runner/diagnosis.json";
const mixedResultPath =
  "/app/projects/aks-rp-e2e/workspace/ops-audit-compact-net-integration-return-lineage-20260715/run-172281011/runs/test-results/test_20260715030544872_wyihyu_702058/artifacts/net-integration-multinic-mixed/spec-runner/result.json";
const mixedDiagnosisPath =
  "/app/projects/aks-rp-e2e/workspace/ops-audit-compact-net-integration-return-lineage-20260715/run-172281011/runs/test-results/test_20260715030544872_wyihyu_702058/artifacts/net-integration-multinic-mixed/spec-runner/diagnosis.json";

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

function deleteKey(record: MutableRecord, key: string): void {
  if (key in record) delete record[key];
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function findArchivedTask(taskId: string): ArchivedTaskSummary | null {
  const archiveDir = join(appDir, ".state", "tasks", "archive");
  if (!existsSync(archiveDir)) return null;
  const files = readdirSync(archiveDir)
    .filter((name) => name.startsWith("done-leaves-") && name.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a));
  for (const file of files) {
    const full = join(archiveDir, file);
    const bundle = readJson<{ tasks?: Array<Record<string, unknown>> }>(full);
    const task = (bundle.tasks ?? []).find((entry) => entry.id === taskId);
    if (task) {
      return {
        archiveFile: `.state/tasks/archive/${file}`,
        id: taskId,
        state: typeof task.state === "string" ? task.state : null,
        resolution: typeof task.resolution === "string" ? task.resolution : null,
        result: typeof task.result === "string" ? task.result : null,
      };
    }
  }
  return null;
}

const specPatches: SpecPatch[] = [
  {
    specId: "spec.net-integration.multinic-dualstack",
    runId: "172280731",
    runUrl:
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172280731",
    predecessorTaskId:
      "domain/wait-net-integration-multinic-dualstack-run-172280731-result-20260715",
    resultPath: dualstackResultPath,
    diagnosisPath: dualstackDiagnosisPath,
    reviewClassification: "environment_prerequisite_registration_required",
    lastRootCause:
      `Returned same-spec run 172280731 failed at managed-cluster create with HTTP 400 ValidationError because subscription ${subscriptionId} is missing ${featureRegistration} registration. The run reached resource-group and VNet setup but never reached the GET/VMSS/node product assertions, so this is an exact environment prerequisite blocker rather than a product verdict or another passive wait.`,
    lastAction:
      `Keep spec.net-integration.multinic-dualstack represented by ${holderTaskId} until reviewed confirmation shows ${featureRegistration} is registered on subscription ${subscriptionId}. After confirmation, rerun only the exact dualstack carrier with the documented mutation gate and a capacity-confirmed location. Do not restore ${predecessorTaskIds[0]} or the archived grouped consumer ${archivedConsumerTaskId} as live successors.`,
    successorDisposition:
      "environment-prerequisite-registration-confirmation-required",
    successorStateReason:
      `Exact returned artifact run 172280731 now proves the next truthful frontier is ${featureRegistration} registration on subscription ${subscriptionId}. The grouped consumer ${archivedConsumerTaskId} is archived done, so ${holderTaskId} now represents this prerequisite directly.`,
    resumeCondition:
      `Resume only after reviewed confirmation shows ${featureRegistration} is registered on subscription ${subscriptionId}, or a reviewed equivalent environment unblock/replacement exists. Then rerun only spec.net-integration.multinic-dualstack with the documented mutation gate and a capacity-confirmed location.`,
  },
  {
    specId: "spec.net-integration.multinic-mixed",
    runId: "172281011",
    runUrl:
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172281011",
    predecessorTaskId:
      "domain/wait-net-integration-multinic-mixed-run-172281011-result-20260715",
    resultPath: mixedResultPath,
    diagnosisPath: mixedDiagnosisPath,
    reviewClassification: "environment_prerequisite_registration_required",
    lastRootCause:
      `Returned same-spec run 172281011 failed at managed-cluster create with HTTP 400 ValidationError because subscription ${subscriptionId} is missing ${featureRegistration} registration. The run reached resource-group and VNet setup but never reached the GET/VMSS/node product assertions, so this is an exact environment prerequisite blocker rather than a product verdict or another passive wait.`,
    lastAction:
      `Keep spec.net-integration.multinic-mixed represented by ${holderTaskId} until reviewed confirmation shows ${featureRegistration} is registered on subscription ${subscriptionId}. After confirmation, rerun only the exact mixed carrier with the documented mutation gate and a non-eastus2 capacity-confirmed location. Do not restore ${predecessorTaskIds[1]} or the archived grouped consumer ${archivedConsumerTaskId} as live successors.`,
    successorDisposition:
      "environment-prerequisite-registration-confirmation-required",
    successorStateReason:
      `Exact returned artifact run 172281011 now proves the next truthful frontier is ${featureRegistration} registration on subscription ${subscriptionId}. The grouped consumer ${archivedConsumerTaskId} is archived done, so ${holderTaskId} now represents this prerequisite directly.`,
    resumeCondition:
      `Resume only after reviewed confirmation shows ${featureRegistration} is registered on subscription ${subscriptionId}, or a reviewed equivalent environment unblock/replacement exists. Then rerun only spec.net-integration.multinic-mixed with the documented mutation gate and a non-eastus2 capacity-confirmed location.`,
  },
];

const holderGoal =
  `Hold compact feature net-integration on the exact package-partial frontier while reviewed confirmation or registration of ${featureRegistration} is still required on subscription ${subscriptionId} before exact same-spec reruns for the MultiNIC dualstack/mixed pair.`;
const holderAcceptance = [
  `The feature remains blocked only while ${featureRegistration} registration confirmation on subscription ${subscriptionId} is still the truthful exact MultiNIC frontier for runs ${runIds[0]} and ${runIds[1]}.`,
  `Runs ${runIds[0]} and ${runIds[1]} are represented by that subscription preview-registration prerequisite, not by passive ADO waits ${predecessorTaskIds[0]} / ${predecessorTaskIds[1]} and not by archived grouped consumer ${archivedConsumerTaskId}.`,
  `Run ${historicalConsumedRunIds[0]} remains consumed history only and ${historicalTerminalReviewTaskIds[0]} stays archived lineage only.`,
];
const holderCondition =
  `Current compact/spec-loop/spec evidence shows the exact remaining net-integration compact blocked frontier is still the BasicLB deprecation pair on wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702, cross-subscription VNet on wait-spec-net-integration-cross-subscription-vnet-response-20260702, the outboundType=none topology-constraint pair on wait-spec-net-integration-outbound-none-topology-constraint-20260702, spec.net-integration.outbound-udr on wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702, the run-171350866 custom-route-table/user-assigned-MSI node-readiness blocker, the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none, and the exact MultiNIC environment prerequisite that subscription ${subscriptionId} still needs ${featureRegistration} registration for runs ${runIds[0]} and ${runIds[1]}. Run ${historicalConsumedRunIds[0]} is consumed history only, ${historicalTerminalReviewTaskIds[0]} stays historical lineage only, and ${archivedConsumerTaskId} is archived completed lineage only.`;
const holderResumeCondition =
  `Resume only when one exact represented blocked surface materially changes (the BasicLB pair, cross-subscription pairing/access proof, outboundType=none topology constraints, the BYO UDR prerequisite contract, run 171350866 node-readiness diagnosis, accepted live-capable reclassification of multinic-standard plus natgw-v2-migration-v2-to-none, or reviewed confirmation shows ${featureRegistration} is registered on subscription ${subscriptionId} or a reviewed equivalent environment unblock/replacement exists). After that confirmation, rerun only the exact dualstack/mixed carriers with the documented mutation gates and capacity-confirmed location constraints.`;
const holderFallbackAction =
  `If reviewed confirmation is still absent at fallback, refresh this exact holder from current registration evidence or replace it only with one accepted sharper successor. Do not restore ${predecessorTaskIds[0]}, ${predecessorTaskIds[1]}, or archived grouped consumer ${archivedConsumerTaskId} as live waits.`;
const waitingFor = {
  type: "environment.prerequisite.confirmation.required",
  subscriptionId,
  featureRegistration,
  specIds: [...specIds],
  runIds: [...runIds],
  predecessorTaskIds: [...predecessorTaskIds],
  consumedTaskId: archivedConsumerTaskId,
  historicalConsumedRunIds: [...historicalConsumedRunIds],
  reason:
    "returned same-spec artifacts already prove both westus2 MultiNIC reruns fail at managed-cluster create until the subscription preview registration is present",
};
const waitingCondition =
  `Reviewed confirmation or registration proof for ${featureRegistration} on subscription ${subscriptionId} is required before rerunning spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed.`;
const observationMethod =
  `Planner/app-ops keeps ${holderTaskId} exact while waiting for reviewed confirmation that ${featureRegistration} is present on subscription ${subscriptionId}; once confirmed, rerun only the exact dualstack and mixed carriers.`;
const nextCheckAt = addHours(appliedAt, 12);
const fallbackAt = addHours(appliedAt, 36);

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const holderBefore = treeBefore.tasks[holderTaskId] as TaskNode | undefined;
assert(holderBefore, `Missing ${holderTaskId}`);
assert(
  !treeBefore.tasks[predecessorTaskIds[0]] && !treeBefore.tasks[predecessorTaskIds[1]],
  "Expected old MultiNIC wait leaves to remain non-live before repair",
);
assert(
  !treeBefore.tasks[archivedConsumerTaskId],
  `Expected archived grouped consumer ${archivedConsumerTaskId} to remain non-live before repair`,
);

const holderContextBefore = asRecord(holderBefore.context);
const holderBlockerBefore = asRecord(holderBefore.blocker);
const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const compactBefore = clone(compactState.features[featureKey]);
assert(compactBefore, `Missing feature-compact row ${featureKey}`);

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const specState = specLoaded.state;
const specBefore = Object.fromEntries(
  specPatches.map((patch) => [patch.specId, clone(specState.specs[patch.specId])]),
) as Record<string, Record<string, unknown>>;

const archivedWaitSummaries = predecessorTaskIds
  .map((taskId) => findArchivedTask(taskId))
  .filter((entry): entry is ArchivedTaskSummary => Boolean(entry));
const archivedConsumerSummary = findArchivedTask(archivedConsumerTaskId);
assert(
  archivedWaitSummaries.length === predecessorTaskIds.length,
  "Expected both old MultiNIC wait leaves to remain archived",
);
assert(
  archivedConsumerSummary,
  `Expected archived grouped consumer ${archivedConsumerTaskId} to exist in archive`,
);

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
  assert(holder, `Missing ${holderTaskId} during mutation`);
  assert(
    !tree.tasks[predecessorTaskIds[0]] && !tree.tasks[predecessorTaskIds[1]],
    "Old MultiNIC wait leaves must remain non-live during mutation",
  );
  assert(
    !tree.tasks[archivedConsumerTaskId],
    `Archived grouped consumer ${archivedConsumerTaskId} must remain non-live during mutation`,
  );

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
  context.featureCompactExactWait = true;
  context.featureKey = featureKey;
  context.errorClass = "package-partial";
  context.target = "staging";
  context.downstreamCarrierTaskIds = [];
  context.exactSuccessorTaskIds = [];
  context.historicalConsumedRunIds = [...historicalConsumedRunIds];
  context.historicalTerminalReviewTaskIds = [...historicalTerminalReviewTaskIds];
  context.reviewEvidencePath = evidencePath;
  context.currentRepresentation =
    "subscription-preview-registration-prerequisite";
  context.environmentPrerequisite = {
    subscriptionId,
    featureRegistration,
    specIds: [...specIds],
    runIds: [...runIds],
    predecessorTaskIds: [...predecessorTaskIds],
    consumedTaskId: archivedConsumerTaskId,
    evidencePath: domainEvidencePath,
  };
  context.supersededTaskIds = [...predecessorTaskIds];
  context.archivedLineageTaskIds = unique([
    archivedConsumerTaskId,
    ...predecessorTaskIds,
    ...historicalTerminalReviewTaskIds,
  ]);
  deleteKey(context, "returnedArtifactConsumerTaskId");
  deleteKey(context, "returnedArtifactRunIds");
  holder.context = context;

  holder.blocker = {
    ...asRecord(holder.blocker),
    condition: holderCondition,
    category: "external-wait",
    owner: "human",
    blocked_at:
      asString(asRecord(holder.blocker).blocked_at) ||
      asString(asRecord(holder.trace).created_at) ||
      appliedAt,
    waiting_for: waitingFor,
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.task.reviewed",
    },
    observation_method: observationMethod,
    next_check_at: nextCheckAt,
    resume_condition: holderResumeCondition,
    fallback_at: fallbackAt,
    fallback_action: holderFallbackAction,
    resume_at: nextCheckAt,
  };

  const trace = asRecord(holder.trace);
  trace.compact_net_integration_multinic_registration_prerequisite_reconciled_at =
    appliedAt;
  trace.compact_net_integration_multinic_registration_prerequisite_reconciled_by =
    worker;
  trace.compact_net_integration_multinic_registration_prerequisite_attempt_id =
    attemptId;
  trace.compact_net_integration_multinic_registration_subscription_id =
    subscriptionId;
  trace.compact_net_integration_multinic_registration_feature =
    featureRegistration;
  holder.trace = trace;

  holder.result =
    `${attemptId}: holder now represents ${featureRegistration} registration on subscription ${subscriptionId} as the exact MultiNIC frontier for runs ${runIds.join(" / ")}; old waits and grouped consumer remain archived lineage only.`;

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const featureEvidencePaths = unique([
  ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
  evidencePath,
  predecessorEvidencePath,
  reviewEvidencePath,
  domainEvidencePath,
]);
const featureAttemptedFixes = unique([
  ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
  `${attemptId}: rewrote ${holderTaskId} and controller-visible compact/spec loop state so the MultiNIC pair is represented by ${featureRegistration} registration on subscription ${subscriptionId} instead of archived grouped consumer ${archivedConsumerTaskId}.`,
]);

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  retryable: false,
  retryReason:
    `Keep ${holderTaskId} blocked until reviewed confirmation shows ${featureRegistration} is registered on subscription ${subscriptionId} or a reviewed equivalent environment unblock/replacement exists. Do not restore ${predecessorTaskIds[0]}, ${predecessorTaskIds[1]}, or archived grouped consumer ${archivedConsumerTaskId} as live representation.`,
  ownerReason:
    `All feature-owned specs are already selected into the compact package. The remaining compact blocked frontier stays on ${holderTaskId} for the BasicLB, cross-subscription VNet, outboundType=none, BYO UDR, custom-route-table/user-assigned-MSI, and multinic-standard/natgw-v2-migration-v2-to-none surfaces, while the MultiNIC dualstack/mixed pair is now represented directly by ${featureRegistration} registration on subscription ${subscriptionId}.`,
  nextStepClassification:
    `reviewed ${featureRegistration} registration confirmation on subscription ${subscriptionId}, then exact reruns of spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed`,
  resumeCondition: holderResumeCondition,
  blockedReason: holderCondition,
  waitingFor,
  waitingCondition,
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.task.reviewed",
  },
  observationMethod,
  nextCheckAt,
  blockerOwner: "human",
  fallbackAt,
  fallbackAction: holderFallbackAction,
  resumeAction:
    `After reviewed confirmation lands, rerun only spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed with their documented mutation gates and capacity-confirmed locations.`,
  evidencePaths: featureEvidencePaths,
  reviewEvidencePath: evidencePath,
  verificationBlocker:
    `Do not restore ${predecessorTaskIds[0]}, ${predecessorTaskIds[1]}, or archived grouped consumer ${archivedConsumerTaskId} as the active MultiNIC frontier; keep the pair represented by ${featureRegistration} registration on subscription ${subscriptionId}.`,
  summary:
    `Net-integration now represents the MultiNIC dualstack + mixed pair through ${featureRegistration} registration on subscription ${subscriptionId} rather than archived grouped consumer ${archivedConsumerTaskId} or passive waits ${predecessorTaskIds[0]} / ${predecessorTaskIds[1]}.`,
  attemptedFixes: featureAttemptedFixes,
  lastCheckedAt: appliedAt,
});
saveFeatureCompactLoopState(compactLoaded.path, compactState);

for (const patch of specPatches) {
  const previous = specState.specs[patch.specId];
  assert(previous, `Missing spec-loop row ${patch.specId}`);
  updateSpecLoopSpec(specState, patch.specId, {
    status: "pending",
    taskId: holderTaskId,
    lastRunId: patch.runId,
    lastRunUrl: patch.runUrl,
    lastResultPath: patch.resultPath,
    failureClass: "environment-prerequisite",
    diagnosis: "inconclusive",
    review: {
      classification: patch.reviewClassification,
      lastRootCause: patch.lastRootCause,
      lastAction: patch.lastAction,
      reviewedAt: appliedAt,
      owner: "aks-explorer",
      observer: worker,
      subscriptionId,
      featureRegistration,
      adoStatus: "completed",
      adoResult: "failed",
      acceptedRunId: patch.runId,
      acceptedResultPath: patch.resultPath,
      acceptedByTaskId: archivedConsumerTaskId,
      resultPath: patch.resultPath,
      diagnosisPath: patch.diagnosisPath,
      terminalStatus: "failed",
      predecessorTaskId: patch.predecessorTaskId,
    },
    terminalDisposition: false,
    successorDisposition: patch.successorDisposition,
    successorEvidencePath: evidencePath,
    successorStateReason: patch.successorStateReason,
    resumeCondition: patch.resumeCondition,
  });
}
const specMirrorPath = resolve(projectDir, ".state", "spec-loop", "state.json");
saveSpecLoopState(
  specLoaded.path,
  specState,
  existsSync(specMirrorPath) ? [specMirrorPath] : [],
);

const treeAfter = readTaskTree(config);
const holderAfter = treeAfter.tasks[holderTaskId] as TaskNode | undefined;
assert(holderAfter, `Missing ${holderTaskId} after mutation`);
assert(
  !treeAfter.tasks[predecessorTaskIds[0]] && !treeAfter.tasks[predecessorTaskIds[1]],
  "Old MultiNIC wait leaves unexpectedly became live after repair",
);
assert(
  !treeAfter.tasks[archivedConsumerTaskId],
  `Archived grouped consumer ${archivedConsumerTaskId} unexpectedly became live after repair`,
);

const compactAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
}).state.features[featureKey];
const specAfterState = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
}).state;

const specAfter = Object.fromEntries(
  specPatches.map((patch) => [patch.specId, specAfterState.specs[patch.specId]]),
);

const memo = `# Ops apply — net-integration MultiNIC registration-prerequisite holder refresh (2026-07-15)

- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Worker: \`${worker}\`
- Holder: \`${holderTaskId}\`

## Result

Replaced the stale grouped-consumer representation on \`${holderTaskId}\` with the exact environment prerequisite \`${featureRegistration}\` registration on subscription \`${subscriptionId}\`, preserved the two old ADO waits and the grouped consumer as archived lineage only, and synchronized the controller-visible feature/spec loop state to require reviewed registration confirmation before exact dualstack/mixed reruns.

## Baseline before apply

### Holder before

\`\`\`json
${JSON.stringify(
  {
    goal: holderBefore.goal ?? null,
    acceptance: holderBefore.acceptance ?? null,
    currentRepresentation: holderContextBefore.currentRepresentation ?? null,
    downstreamCarrierTaskIds: holderContextBefore.downstreamCarrierTaskIds ?? null,
    exactSuccessorTaskIds: holderContextBefore.exactSuccessorTaskIds ?? null,
    returnedArtifactConsumerTaskId:
      holderContextBefore.returnedArtifactConsumerTaskId ?? null,
    waiting_for: holderBlockerBefore.waiting_for ?? null,
    resume_condition: holderBlockerBefore.resume_condition ?? null,
    fallback_action: holderBlockerBefore.fallback_action ?? null,
  },
  null,
  2,
)}
\`\`\`

### Feature-compact row before

\`\`\`json
${JSON.stringify(
  {
    taskId: compactBefore.taskId ?? null,
    frontierTaskIds: compactBefore.frontierTaskIds ?? null,
    retryReason: compactBefore.retryReason ?? null,
    nextStepClassification: compactBefore.nextStepClassification ?? null,
    blockedReason: compactBefore.blockedReason ?? null,
    waitingFor: compactBefore.waitingFor ?? null,
    reviewEvidencePath: compactBefore.reviewEvidencePath ?? null,
  },
  null,
  2,
)}
\`\`\`

## Archived lineage preserved

### Old wait leaves

\`\`\`json
${JSON.stringify(archivedWaitSummaries, null, 2)}
\`\`\`

### Grouped consumer

\`\`\`json
${JSON.stringify(archivedConsumerSummary, null, 2)}
\`\`\`

## Applied holder state

\`\`\`json
${JSON.stringify(
  {
    goal: holderAfter.goal ?? null,
    acceptance: holderAfter.acceptance ?? null,
    context: {
      currentRepresentation: asRecord(holderAfter.context).currentRepresentation ?? null,
      downstreamCarrierTaskIds:
        asRecord(holderAfter.context).downstreamCarrierTaskIds ?? null,
      exactSuccessorTaskIds:
        asRecord(holderAfter.context).exactSuccessorTaskIds ?? null,
      environmentPrerequisite:
        asRecord(holderAfter.context).environmentPrerequisite ?? null,
      supersededTaskIds: asRecord(holderAfter.context).supersededTaskIds ?? null,
      archivedLineageTaskIds:
        asRecord(holderAfter.context).archivedLineageTaskIds ?? null,
    },
    blocker: {
      condition: asRecord(holderAfter.blocker).condition ?? null,
      waiting_for: asRecord(holderAfter.blocker).waiting_for ?? null,
      resume_condition: asRecord(holderAfter.blocker).resume_condition ?? null,
      fallback_action: asRecord(holderAfter.blocker).fallback_action ?? null,
      next_check_at: asRecord(holderAfter.blocker).next_check_at ?? null,
      fallback_at: asRecord(holderAfter.blocker).fallback_at ?? null,
    },
    result: holderAfter.result ?? null,
  },
  null,
  2,
)}
\`\`\`

## Controller-visible loop state after

### Feature-compact row after

\`\`\`json
${JSON.stringify(
  {
    taskId: compactAfter?.taskId ?? null,
    frontierTaskIds: compactAfter?.frontierTaskIds ?? null,
    retryReason: compactAfter?.retryReason ?? null,
    nextStepClassification: compactAfter?.nextStepClassification ?? null,
    blockedReason: compactAfter?.blockedReason ?? null,
    waitingFor: compactAfter?.waitingFor ?? null,
    waitingCondition: compactAfter?.waitingCondition ?? null,
    resumeAction: compactAfter?.resumeAction ?? null,
    reviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
  },
  null,
  2,
)}
\`\`\`

### Spec-loop rows after

\`\`\`json
${JSON.stringify(specAfter, null, 2)}
\`\`\`

## Verification

1. \`${holderTaskId}\` now names \`${featureRegistration}\` registration on subscription \`${subscriptionId}\` as the live MultiNIC frontier for runs \`${runIds[0]}\` / \`${runIds[1]}\`.
2. \`${archivedConsumerTaskId}\` is no longer named as a live successor on the holder or controller-visible loop state.
3. \`${predecessorTaskIds[0]}\` and \`${predecessorTaskIds[1]}\` remain archived \`resolution: \"replaced\"\` lineage only.
4. The holder and loop state now require reviewed registration confirmation before exact dualstack/mixed reruns.

## Evidence inputs

- Domain artifact-consumption memo: \`${domainEvidencePath}\`
- Prior worker proposal memo: \`${predecessorEvidencePath}\`
- Prior grouped-consumer repair evidence: \`${reviewEvidencePath}\`
- Dualstack result: \`${dualstackResultPath}\`
- Mixed result: \`${mixedResultPath}\`
`;

writeText(resolve(appDir, evidencePath), memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      holderTaskId,
      evidencePath,
      archivedWaitSummaries,
      archivedConsumerSummary,
      holderAfter: {
        goal: holderAfter.goal ?? null,
        currentRepresentation:
          asRecord(holderAfter.context).currentRepresentation ?? null,
        waitingFor: asRecord(holderAfter.blocker).waiting_for ?? null,
        resumeCondition:
          asRecord(holderAfter.blocker).resume_condition ?? null,
      },
      compactAfter: {
        taskId: compactAfter?.taskId ?? null,
        waitingFor: compactAfter?.waitingFor ?? null,
        nextStepClassification: compactAfter?.nextStepClassification ?? null,
      },
      specAfter: Object.fromEntries(
        specPatches.map((patch) => [
          patch.specId,
          {
            taskId: specAfterState.specs[patch.specId]?.taskId ?? null,
            lastRunId: specAfterState.specs[patch.specId]?.lastRunId ?? null,
            successorDisposition:
              specAfterState.specs[patch.specId]?.successorDisposition ?? null,
            resumeCondition:
              specAfterState.specs[patch.specId]?.resumeCondition ?? null,
          },
        ]),
      ),
      liveAbsenceCheck: {
        predecessorTaskIdsLive: predecessorTaskIds.filter((taskId) => Boolean(treeAfter.tasks[taskId])),
        archivedConsumerLive: Boolean(treeAfter.tasks[archivedConsumerTaskId]),
      },
    },
    null,
    2,
  ),
);

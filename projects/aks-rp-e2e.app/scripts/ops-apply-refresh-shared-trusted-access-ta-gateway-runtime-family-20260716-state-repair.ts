import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createTask,
  readTask,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopSpecState,
} from "../workflows/lib/spec-loop-store.ts";

type MutableRecord = Record<string, unknown>;

type HolderSnapshot = {
  id: string;
  acceptance: string[];
  outputs: string[];
  blocker: MutableRecord | null;
  context: MutableRecord | null;
  result: string | null;
};

type WaitSnapshot = {
  id: string;
  state: string | null;
  owner: string | null;
  blocker: MutableRecord | null;
  context: MutableRecord | null;
};

type FeatureSnapshot = {
  taskId: string | null;
  frontierTaskIds: string[] | null;
  waitingFor: MutableRecord | null;
  ownerReason: string | null;
  blockedReason: string | null;
  nextCheckAt: string | null;
  fallbackAt: string | null;
  reviewEvidencePath: string | null;
  summary: string | null;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as MutableRecord) } as MutableRecord)
    : {};
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && Boolean(entry.trim()),
      )
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  ].sort((a, b) => a.localeCompare(b));
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function holderSnapshot(task: TaskNode | undefined): HolderSnapshot | null {
  if (!task) return null;
  return {
    id: task.id,
    acceptance: asStringArray(task.acceptance),
    outputs: asStringArray(task.outputs),
    blocker: Object.keys(asRecord(task.blocker)).length
      ? jsonClone(asRecord(task.blocker))
      : null,
    context: Object.keys(asRecord(task.context)).length
      ? jsonClone(asRecord(task.context))
      : null,
    result: asString((task as Record<string, unknown>).result),
  };
}

function waitSnapshot(task: TaskNode | undefined): WaitSnapshot | null {
  if (!task) return null;
  return {
    id: task.id,
    state: asString((task as Record<string, unknown>).state),
    owner: asString((task as Record<string, unknown>).owner),
    blocker: Object.keys(asRecord(task.blocker)).length
      ? jsonClone(asRecord(task.blocker))
      : null,
    context: Object.keys(asRecord(task.context)).length
      ? jsonClone(asRecord(task.context))
      : null,
  };
}

function featureSnapshot(
  item: FeatureCompactItemState | undefined,
): FeatureSnapshot | null {
  if (!item) return null;
  return {
    taskId: item.taskId ?? null,
    frontierTaskIds: item.frontierTaskIds ?? null,
    waitingFor: item.waitingFor ? jsonClone(item.waitingFor) : null,
    ownerReason: item.ownerReason ?? null,
    blockedReason: item.blockedReason ?? null,
    nextCheckAt: item.nextCheckAt ?? null,
    fallbackAt: item.fallbackAt ?? null,
    reviewEvidencePath: item.reviewEvidencePath ?? null,
    summary: item.summary ?? null,
  };
}

function specSnapshot(item: SpecLoopSpecState | undefined): MutableRecord | null {
  return item ? jsonClone(item) : null;
}

function writeMemo(content: string): void {
  mkdirSync(dirname(appMemoAbsolute), { recursive: true });
  writeFileSync(appMemoAbsolute, `${content}\n`, "utf-8");
}

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-refresh-shared-trusted-access-ta-gateway-runtime-family-20260716-state-repair_20260716193728";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const repairedAt = new Date().toISOString();

const repairTaskId =
  "ops-apply-refresh-shared-trusted-access-ta-gateway-runtime-family-20260716-state-repair";
const reviewTaskId =
  "domain/refresh-shared-trusted-access-ta-gateway-runtime-family-20260716";
const reviewMemoPath =
  "../aks-rp-e2e/evidence/archive/domain-refresh-shared-trusted-access-ta-gateway-runtime-family-20260716.md";
const reviewMemoProjectPath =
  "evidence/archive/domain-refresh-shared-trusted-access-ta-gateway-runtime-family-20260716.md";
const appMemoPath =
  "evidence/archive/ops-apply-refresh-shared-trusted-access-ta-gateway-runtime-family-20260716-state-repair.md";
const appMemoAbsolute = resolve(appDir, appMemoPath);

const oldWaitId =
  "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711";
const newWaitId =
  "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260716";
const holderTaskId =
  "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705";
const featureKey = "trusted-access";
const specId = "spec.trusted-access.dataplane-token-gateway-runtime";
const nextCheckAt = "2026-07-17T18:45:00Z";
const fallbackAt = "2026-07-18T18:45:00Z";
const blockerFamily = "trusted-access-ta-gateway-dns-runtime";
const boundary = "*.ta.azmk8s.io";

const newWaitGoal =
  "Carry the shared trusted-access TA gateway DNS/runtime blocker as one exact blocked runtime-family wait covering both the spec-loop dataplane-token gateway carrier and its compact-loop sibling, so the tree preserves one truthful runtime-family steward instead of archived references or duplicate passive blockers.";
const newWaitAcceptance = [
  "The wait names the exact compact holder hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705 plus the spec-loop trusted-access dataplane-token gateway carrier, and preserves TA gateway DNS/runtime reachability as the blocker rather than a product failure.",
  "The blocker records the accepted 2026-07-16 same-runtime family review, the exact same-runtime or approved alternate-surface resume condition, and the future shared review window 2026-07-17T18:45:00Z / 2026-07-18T18:45:00Z for this blocker family.",
  "This branch stays classified as trusted-access runtime-family stewardship rather than approval debt or product-failure verdicts; future refreshes must stay on the same blocker family unless reviewed evidence materially changes the *.ta.azmk8s.io reachability claim.",
];
const newWaitCondition =
  "2026-07-16 reviewed same-runtime evidence in /app/projects/aks-rp-e2e/evidence/archive/domain-refresh-shared-trusted-access-ta-gateway-runtime-family-20260716.md reconfirmed that repeated repo-visible execution still stops at *.ta.azmk8s.io DNS/runtime reachability before any trusted-access dataplane product assertion, so recreate one shared runtime-family wait and keep the compact holder only as its projection.";
const newWaitResumeCondition =
  "Resume only when accepted same-runtime evidence proves materially different *.ta.azmk8s.io reachability for the gateway-call path, when an approved alternate-surface / ADO-agent-equivalent / Microsoft-internal DNS execution lane changes that reachability contract enough to reach product behavior, or when accepted evidence reclassifies the carrier out of reviewed-exception; do not rerun the unchanged spec before then.";
const newWaitFallbackAction =
  "If still blocked at fallback, refresh the surviving trusted-access compact/shared blocker family from current runtime evidence, preserve the exact spec/compact pair, and do not restore the archived spec-local passive wait or reopen unchanged reruns.";
const newWaitSummary =
  "Recreated the shared trusted-access TA gateway runtime-family wait from the accepted 2026-07-16 same-runtime review and restored one live steward for the spec/compact pair.";

const holderAcceptance = [
  `The compact-facing holder points at ${newWaitId} as the governing family wait for ${specId}.`,
  "Resume only when the shared TA gateway DNS/runtime family returns a materially different same-runtime or approved alternate-surface signal that lets the unchanged carrier advance, or when accepted evidence reclassifies that carrier.",
  "Do not broad-rerun trusted-access unchanged and do not carry a duplicate feature-local environment wait while the shared family wait remains current.",
];
const holderCondition =
  `2026-07-16 same-runtime family repair revalidated that this compact trusted-access holder remains only the projection of ${newWaitId} for the unchanged TA gateway DNS/runtime boundary at ${boundary}. Repeated repo-visible runtime evidence still stops before any trusted-access dataplane product assertion, so keep one shared family projection wait rather than a trusted-access-only environment umbrella or unchanged rerun.`;
const holderObservationMethod =
  "Planner/app-ops refreshed this compact/shared exact pair after reviewing returned evidence; controller ticks should keep it blocked until the named shared family wait materially changes.";
const holderSummary =
  `Rebound trusted-access compact projection metadata away from archived ${oldWaitId} to live shared wait ${newWaitId} and mirrored that governing wait's watch window.`;
const holderOwnerReason =
  `The compact trusted-access holder remains only the exact sibling projection of the shared TA gateway DNS/runtime family wait ${newWaitId}, so controller-visible metadata must point to that shared runtime-family steward rather than the archived ${oldWaitId} or back to the compact holder itself.`;
const holderNextStep =
  `preserve trusted-access as the compact-facing sibling of ${newWaitId} until reviewed same-runtime evidence, an approved alternate surface, or accepted reclassification materially changes the shared runtime-family blocker`;
const holderVerificationBlocker =
  `Do not rerun unchanged. The truthful blocker remains the shared TA gateway DNS/runtime family wait ${newWaitId} until reviewed runtime evidence materially changes ${boundary} reachability.`;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const taskTreeFile = resolve(appDir, ".state/tasks/tree.json");
const specLoopFile = resolve(appDir, ".state/spec-loop/state.json");
const compactStateFile = resolve(appDir, ".state/feature-compact-loop/state.json");

const taskTreeHashBefore = fileHash(taskTreeFile);
const specLoopHashBefore = fileHash(specLoopFile);
const compactHashBefore = fileHash(compactStateFile);

const baselineTree = readTaskTree(config);
const baselineHolder = holderSnapshot(baselineTree.tasks[holderTaskId]);
const baselineOldWait = waitSnapshot(baselineTree.tasks[oldWaitId]);
const baselineNewWait = waitSnapshot(baselineTree.tasks[newWaitId]);

const specLoadedBefore = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
  refreshFromProject: false,
});
const featureLoadedBefore = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const baselineSpec = specSnapshot(specLoadedBefore.state.specs[specId]);
const baselineFeature = featureSnapshot(featureLoadedBefore.state.features[featureKey]);

assert(baselineHolder, `Missing live holder ${holderTaskId}`);
assert(baselineSpec, `Missing spec-loop state for ${specId}`);
assert(baselineFeature, `Missing feature-compact state for ${featureKey}`);
assert(
  baselineSpec.taskId === oldWaitId,
  `Expected ${specId} to point at archived ${oldWaitId} before repair`,
);
assert(
  baselineFeature.waitingFor?.taskId === oldWaitId,
  `Expected feature ${featureKey} waitingFor.taskId to point at archived ${oldWaitId} before repair`,
);
assert(
  asStringArray(baselineHolder.context?.frontierTaskIds).includes(oldWaitId) ||
    asString(baselineHolder.blocker?.waiting_for && asRecord(baselineHolder.blocker.waiting_for).taskId) === oldWaitId,
  `Expected holder ${holderTaskId} to still reference archived ${oldWaitId} before repair`,
);

if (!readTask(config, newWaitId)) {
  createTask(config, {
    id: newWaitId,
    parentId: "project",
    state: "blocked",
    kind: "domain_leaf",
    priority: "P2",
    owner: "aks-explorer",
    goal: newWaitGoal,
    outputs: [reviewMemoPath, appMemoPath],
    acceptance: newWaitAcceptance,
    conflict_scope: ["feature:trusted-access"],
    context: {
      trustedAccessSharedRuntimeFamilyWaitRefresh: {
        repairedAt,
        workerTaskId: repairTaskId,
        attemptId,
        sourceReviewedTaskId: reviewTaskId,
        reviewEvidencePath: reviewMemoProjectPath,
        appEvidencePath: appMemoPath,
        priorWaitId: oldWaitId,
        governedSpecIds: [specId],
        governedTaskIds: [holderTaskId],
        family: blockerFamily,
        boundary,
      },
    },
    blocker: {
      condition: newWaitCondition,
      category: "external-wait",
      owner: "aks-explorer",
      blocked_at: repairedAt,
      waiting_for: {
        type: "environment.available",
        taskId: newWaitId,
        family: blockerFamily,
        boundary,
        governedSpecIds: [specId],
        affectedTaskIds: [holderTaskId],
        expectedChange:
          "reviewed same-runtime evidence materially changes TA gateway DNS/runtime reachability, an approved alternate surface supplies equivalent proof, or accepted evidence reclassifies the carrier out of reviewed-exception",
      },
      observed_by: {
        workflow: "project-planner",
        trigger: "task-tree.refresh-blocked-wait",
      },
      observation_method:
        "Planner/app-ops should refresh or replace this shared runtime-family wait only when reviewed same-lineage evidence materially changes the TA gateway DNS/runtime boundary or an accepted alternate surface supplies an equivalent product-reaching verdict.",
      next_check_at: nextCheckAt,
      resume_condition: newWaitResumeCondition,
      fallback_at: fallbackAt,
      fallback_action: newWaitFallbackAction,
      resume_at: nextCheckAt,
    },
  });
}

const treeAfterTaskRepair = withTreeLock(config, () => {
  const tree = readTaskTree(config);

  const wait = tree.tasks[newWaitId];
  assert(wait, `Missing recreated wait ${newWaitId}`);
  wait.outputs = unique([...asStringArray(wait.outputs), reviewMemoPath, appMemoPath]);
  wait.result = newWaitSummary;
  wait.trace = {
    ...asRecord(wait.trace),
    trusted_access_runtime_family_recreated_at: repairedAt,
    trusted_access_runtime_family_recreated_by: worker,
    trusted_access_runtime_family_recreate_attempt_id: attemptId,
    trusted_access_runtime_family_recreate_evidence_path: appMemoPath,
  };

  const holder = tree.tasks[holderTaskId];
  assert(holder, `Missing holder ${holderTaskId}`);
  const priorBlocker = asRecord(holder.blocker);
  const blockedAt =
    asString(priorBlocker.blocked_at) ?? asString((holder as Record<string, unknown>).updated_at) ?? repairedAt;

  holder.state = "blocked";
  holder.status = "blocked";
  holder.acceptance = [...holderAcceptance];
  holder.outputs = unique([
    ...asStringArray(holder.outputs),
    ".state/feature-compact-loop/state.json",
    appMemoPath,
  ]);

  const holderContext = asRecord(holder.context);
  holderContext.featureCompactExactWait = true;
  holderContext.featureKey = featureKey;
  holderContext.errorClass = holderContext.errorClass ?? "package-partial";
  holderContext.target = holderContext.target ?? "staging";
  holderContext.reviewEvidencePath = appMemoPath;
  holderContext.frontierTaskIds = [newWaitId];
  holderContext.compactFrontierTaskIds = [newWaitId];
  holder.context = holderContext;

  holder.blocker = {
    ...priorBlocker,
    condition: holderCondition,
    category: "external-wait",
    owner: "product-owner",
    blocked_at: blockedAt,
    waiting_for: {
      type: "environment.available",
      taskId: newWaitId,
      family: blockerFamily,
      boundary,
      affectedTaskIds: [holderTaskId],
      expectedChange:
        "reviewed same-runtime evidence materially changes TA gateway DNS/runtime reachability, an approved alternate surface supplies equivalent proof, or accepted evidence reclassifies the carrier out of reviewed-exception",
    },
    observed_by: {
      workflow: "project-planner",
      trigger: "task-tree.refresh-blocked-wait",
    },
    observation_method: holderObservationMethod,
    next_check_at: nextCheckAt,
    resume_condition: newWaitResumeCondition,
    fallback_at: fallbackAt,
    fallback_action: newWaitFallbackAction,
    resume_at: nextCheckAt,
  };
  holder.result = holderSummary;
  holder.trace = {
    ...asRecord(holder.trace),
    trusted_access_runtime_family_repaired_at: repairedAt,
    trusted_access_runtime_family_repaired_by: worker,
    trusted_access_runtime_family_repair_attempt_id: attemptId,
    trusted_access_runtime_family_repair_evidence_path: appMemoPath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return readTaskTree(config);
});

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
  refreshFromProject: false,
});
updateSpecLoopSpec(specLoaded.state, specId, {
  taskId: newWaitId,
  successorEvidencePath: resolve(projectDir, reviewMemoProjectPath),
  successorStateReason:
    `Accepted trusted-access family review after the 2026-07-16 window keeps this spec on shared runtime-family wait ${newWaitId} because repeated repo-visible runtime evidence still stops at TA gateway DNS/runtime reachability before any dataplane product verdict. The app-side exact family refresh now rebinds the downstream compact/spec pair to the recreated shared steward while preserving the same no-unchanged-rerun posture.`,
  resumeCondition: newWaitResumeCondition,
  review: {
    classification: "environment_blocker",
    lastRootCause:
      "Accepted 2026-07-16 same-runtime family review keeps this spec blocked before any TA gateway HTTP or Kubernetes product verdict because repeated repo-visible execution still reaches endpoint selection and token setup but then stops at *.ta.azmk8s.io DNS/runtime reachability failure for all gateway assertions.",
    lastAction: `Keep pending under shared runtime-family wait ${newWaitId}, align the family to the recreated 2026-07-16 steward window, and do not rerun unchanged.`,
    reviewedAt: repairedAt,
  },
});
saveSpecLoopState(specLoaded.path, specLoaded.state);

const featureLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const feature = featureLoaded.state.features[featureKey];
assert(feature, `Missing feature row ${featureKey}`);

updateFeatureCompactItem(featureLoaded.state, featureKey, {
  status: "blocked",
  errorClass: feature.errorClass ?? "package-partial",
  retryable: false,
  retryReason: newWaitResumeCondition,
  taskId: holderTaskId,
  frontierTaskIds: [newWaitId],
  ownerReason: holderOwnerReason,
  attemptedFixes: unique([
    ...asStringArray(feature.attemptedFixes),
    `${attemptId}: recreated shared wait ${newWaitId}, rebound ${specId}, and refreshed trusted-access compact projection metadata away from archived ${oldWaitId}.`,
  ]),
  nextStepClassification: holderNextStep,
  resumeCondition: newWaitResumeCondition,
  blockedAt:
    asString(asRecord(treeAfterTaskRepair.tasks[holderTaskId]?.blocker).blocked_at) ??
    feature.blockedAt ??
    repairedAt,
  blockedReason: holderCondition,
  waitingFor: {
    type: "environment.available",
    taskId: newWaitId,
    family: blockerFamily,
    boundary,
    affectedTaskIds: [holderTaskId],
    expectedChange:
      "reviewed same-runtime evidence materially changes TA gateway DNS/runtime reachability, an approved alternate surface supplies equivalent proof, or accepted evidence reclassifies the carrier out of reviewed-exception",
  },
  waitingCondition: newWaitResumeCondition,
  observedBy: {
    workflow: "project-planner",
    trigger: "task-tree.refresh-blocked-wait",
  },
  observationMethod: holderObservationMethod,
  nextCheckAt,
  blockerOwner: "product-owner",
  fallbackAt,
  fallbackAction: newWaitFallbackAction,
  resumeAction:
    "Reset this feature compact record to pending only after the named shared wait condition changes.",
  blockedScope:
    feature.blockedScope ?? {
      kind: "feature",
      ids: [featureKey],
    },
  blockedFingerprint:
    feature.blockedFingerprint ?? {
      errorClass: feature.errorClass ?? "package-partial",
      target: "staging",
      branch: "dev",
      featureKey,
    },
  lastCheckedAt: repairedAt,
  evidencePaths: unique([
    ...asStringArray(feature.evidencePaths),
    appMemoPath,
    reviewMemoProjectPath,
  ]),
  reviewEvidencePath: appMemoPath,
  verificationBlocker: holderVerificationBlocker,
  summary: holderSummary,
  lastSummary: holderSummary,
});
saveFeatureCompactLoopState(featureLoaded.path, featureLoaded.state);

const taskTreeHashAfter = fileHash(taskTreeFile);
const specLoopHashAfter = fileHash(specLoopFile);
const compactHashAfter = fileHash(compactStateFile);

assert(taskTreeHashBefore !== taskTreeHashAfter, "Expected task tree to change");
assert(specLoopHashBefore !== specLoopHashAfter, "Expected spec-loop state to change");
assert(compactHashBefore !== compactHashAfter, "Expected compact-loop state to change");

const finalTree = readTaskTree(config);
const finalWait = waitSnapshot(finalTree.tasks[newWaitId]);
const finalHolder = holderSnapshot(finalTree.tasks[holderTaskId]);
assert(finalWait, `Missing final wait ${newWaitId}`);
assert(finalHolder, `Missing final holder ${holderTaskId}`);
assert(!finalTree.tasks[oldWaitId], `Archived wait ${oldWaitId} should not be live`);

const finalSpecLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
  refreshFromProject: false,
});
const finalFeatureLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const finalSpec = specSnapshot(finalSpecLoaded.state.specs[specId]);
const finalFeature = featureSnapshot(finalFeatureLoaded.state.features[featureKey]);
assert(finalSpec?.taskId === newWaitId, `Expected ${specId} to point at ${newWaitId}`);
assert(
  JSON.stringify(finalFeature?.frontierTaskIds ?? []) === JSON.stringify([newWaitId]),
  `Expected feature ${featureKey} frontierTaskIds to equal [${newWaitId}]`,
);
assert(
  finalFeature?.waitingFor?.taskId === newWaitId,
  `Expected feature ${featureKey} waitingFor.taskId to equal ${newWaitId}`,
);
assert(
  asStringArray(finalHolder.context?.frontierTaskIds)[0] === newWaitId,
  `Expected holder ${holderTaskId} context.frontierTaskIds to point at ${newWaitId}`,
);
assert(
  asString(asRecord(finalHolder.blocker?.waiting_for).taskId) === newWaitId,
  `Expected holder ${holderTaskId} blocker.waiting_for.taskId to point at ${newWaitId}`,
);

const liveTrustedAccessRuntimeFamilyTasks = Object.values(finalTree.tasks)
  .filter((task) => {
    if (task.id === repairTaskId) return false;
    const text = JSON.stringify(task);
    return text.includes("trusted-access-ta-gateway") || text.includes(specId);
  })
  .map((task) => ({ id: task.id, state: asString((task as Record<string, unknown>).state) }))
  .sort((a, b) => a.id.localeCompare(b.id));

const duplicatePassiveWaits = liveTrustedAccessRuntimeFamilyTasks.filter(
  (task) =>
    task.id !== newWaitId &&
    task.id !== holderTaskId &&
    task.id !== reviewTaskId &&
    task.state === "blocked",
);
assert(
  duplicatePassiveWaits.length === 0,
  `Expected no duplicate live blocked trusted-access waits beyond ${newWaitId} and ${holderTaskId}`,
);

writeMemo(`## App apply: refresh shared trusted-access TA gateway runtime family — 2026-07-16

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${repairedAt}\`
- Reviewed task: \`${reviewTaskId}\`
- Domain review memo: \`${reviewMemoProjectPath}\`
- App evidence memo: \`${appMemoPath}\`

## Repair scope

Applied the bounded app-owned repair that recreates one live shared trusted-access TA gateway runtime-family wait and rebinds all controller-visible spec/compact pointers away from archived \`${oldWaitId}\`.

- \`.state/tasks/tree.json\` hash changed from \`${taskTreeHashBefore}\` to \`${taskTreeHashAfter}\`.
- \`.state/spec-loop/state.json\` hash changed from \`${specLoopHashBefore}\` to \`${specLoopHashAfter}\`.
- \`.state/feature-compact-loop/state.json\` hash changed from \`${compactHashBefore}\` to \`${compactHashAfter}\`.

## Baseline before apply

- Spec-loop row \`${specId}\` pointed to archived \`${oldWaitId}\`.
- Compact feature row \`${featureKey}\` kept \`waitingFor.taskId = ${oldWaitId}\` and an empty \`frontierTaskIds\` array.
- Live holder \`${holderTaskId}\` still referenced \`${oldWaitId}\` in holder metadata.
- No live \`${newWaitId}\` existed.

### Spec before

\`\`\`json
${JSON.stringify(baselineSpec, null, 2)}
\`\`\`

### Feature before

\`\`\`json
${JSON.stringify(baselineFeature, null, 2)}
\`\`\`

### Holder before

\`\`\`json
${JSON.stringify(baselineHolder, null, 2)}
\`\`\`

### Old wait live snapshot before

\`\`\`json
${JSON.stringify(baselineOldWait, null, 2)}
\`\`\`

### New wait live snapshot before

\`\`\`json
${JSON.stringify(baselineNewWait, null, 2)}
\`\`\`

## Applied changes

1. Created live shared wait \`${newWaitId}\` under \`project\` with the accepted same-runtime TA gateway DNS/runtime blocker, future \`next_check_at\`, and future \`fallback_at\`.
2. Rewrote live holder \`${holderTaskId}\` acceptance, context frontier pointers, blocker.waiting_for.taskId, and outputs to reference \`${newWaitId}\` plus this memo.
3. Rebound spec-loop row \`${specId}\` from archived \`${oldWaitId}\` to live \`${newWaitId}\` and refreshed the review/action wording.
4. Rebound feature-compact row \`${featureKey}\` so \`frontierTaskIds = [\"${newWaitId}\"]\`, \`waitingFor.taskId = ${newWaitId}\`, and the summary/evidence now cite this attempt.

## Live state after apply

### Shared wait after

\`\`\`json
${JSON.stringify(finalWait, null, 2)}
\`\`\`

### Holder after

\`\`\`json
${JSON.stringify(finalHolder, null, 2)}
\`\`\`

### Spec after

\`\`\`json
${JSON.stringify(finalSpec, null, 2)}
\`\`\`

### Feature after

\`\`\`json
${JSON.stringify(finalFeature, null, 2)}
\`\`\`

## Duplicate-wait check

Live trusted-access runtime-family tasks excluding this active repair task now reduce to:

\`\`\`json
${JSON.stringify(liveTrustedAccessRuntimeFamilyTasks, null, 2)}
\`\`\`

No duplicate passive trusted-access waits remain for the same TA gateway DNS/runtime family: the surviving live blocked pair is shared wait \`${newWaitId}\` plus compact projection holder \`${holderTaskId}\`.
`);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairedAt,
      createdWaitId: newWaitId,
      repairedHolderTaskId: holderTaskId,
      reboundSpecId: specId,
      featureKey,
      nextCheckAt,
      fallbackAt,
      taskTreeHashBefore,
      taskTreeHashAfter,
      specLoopHashBefore,
      specLoopHashAfter,
      compactHashBefore,
      compactHashAfter,
      duplicatePassiveWaits,
      memoPath: appMemoPath,
    },
    null,
    2,
  ),
);

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  refreshBlockedWait,
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
} from "../workflows/lib/feature-compact-loop-store.ts";
import { loadSpecLoopState } from "../workflows/lib/spec-loop-store.ts";

type MutableRecord = Record<string, unknown>;

type HolderSnapshot = {
  state: string | null;
  result: string | null;
  outputs: string[];
  blocker: MutableRecord | null;
  context: MutableRecord | null;
};

type FeatureSnapshot = {
  status: string | null;
  taskId: string | null;
  frontierTaskIds: string[] | null;
  nextCheckAt: string | null;
  fallbackAt: string | null;
  reviewEvidencePath: string | null;
  waitingFor: MutableRecord | null;
  blockedReason: string | null;
  summary: string | null;
  updatedAt: string | null;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as MutableRecord) } as MutableRecord)
    : {};
}

function asNullableRecord(value: unknown): MutableRecord | null {
  const record = asRecord(value);
  return Object.keys(record).length ? record : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  ].sort((left, right) => left.localeCompare(right));
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function holderSnapshot(task: TaskNode | undefined): HolderSnapshot | null {
  if (!task) return null;
  return {
    state: asString(task.state ?? task.status),
    result: asString((task as MutableRecord).result),
    outputs: asStringArray(task.outputs),
    blocker: asNullableRecord(task.blocker),
    context: asNullableRecord(task.context),
  };
}

function featureSnapshot(value: MutableRecord | undefined): FeatureSnapshot | null {
  if (!value) return null;
  return {
    status: asString(value.status),
    taskId: asString(value.taskId),
    frontierTaskIds: asStringArray(value.frontierTaskIds),
    nextCheckAt: asString(value.nextCheckAt),
    fallbackAt: asString(value.fallbackAt),
    reviewEvidencePath: asString(value.reviewEvidencePath),
    waitingFor: asNullableRecord(value.waitingFor),
    blockedReason: asString(value.blockedReason),
    summary: asString(value.summary),
    updatedAt: asString(value.updatedAt),
  };
}

function writeMemo(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf8");
}

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-reconcile-compact-secure-tls-bootstrap-package-partial-frontier-return-20260717-state-repair_20260717013844";
const repairTaskId =
  "ops-apply-reconcile-compact-secure-tls-bootstrap-package-partial-frontier-return-20260717-state-repair";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const holderTaskId =
  "hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707";
const featureKey = "secure-tls-bootstrap";
const frontierTaskIds = [
  "hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708",
  "wait-secure-tls-bootstrap-vnet-integration-surge-node-capacity-return-20260703",
] as const;
const desiredNextCheckAt = "2026-07-17T18:00:00Z";
const desiredFallbackAt = "2026-07-18T18:00:00Z";
const domainMemoRelativePath =
  "evidence/archive/reconcile-compact-secure-tls-bootstrap-package-partial-frontier-return-20260717.md";
const domainMemoAbsolutePath = resolve(projectDir, domainMemoRelativePath);
const domainMemoOutputPath = `../aks-rp-e2e/${domainMemoRelativePath}`;
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-compact-secure-tls-bootstrap-package-partial-frontier-return-20260717-state-repair.md";
const appMemoAbsolutePath = resolve(appDir, appMemoPath);

const refreshedCondition =
  "2026-07-17 accepted secure-tls-bootstrap package return reconfirmed that hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708 still carries the exact row-43 same-path image-pull-after-disable runtime/environment blocker and wait-secure-tls-bootstrap-vnet-integration-surge-node-capacity-return-20260703 still carries the exact row-44 surge-node capacity wait. Keep hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707 as the single exact compact package holder and do not reopen an unchanged broad live-workflow rerun.";
const refreshedResumeCondition =
  "Resume only when the package-level metadata split materially changes, when the accepted row-43 same-surface image-pull-after-disable frontier materially changes, when the exact row-44 surge-node capacity wait materially changes, or when stronger accepted evidence reclassifies the secure-tls-bootstrap package frontier. Until then keep this as the package-level steward over the same row-43 and row-44 member waits.";
const refreshedFallbackAction =
  "If the wait is still true at fallback time, refresh this exact secure-tls-bootstrap package holder again from current row-43 and row-44 evidence or escalate one sharper owner recovery packet; do not reopen an unchanged broad live-workflow rerun.";
const refreshSummary =
  "2026-07-17 app state repair refreshed the secure-tls-bootstrap compact package holder in place from the accepted return evidence, preserved the same exact row-43 and row-44 frontier members, and moved the package watch window back into the future.";
const attemptedFixLine =
  `${attemptId}: refreshed ${holderTaskId} from ${domainMemoRelativePath}, preserved the exact row-43/row-44 frontier member mapping, and advanced the package watch window to ${desiredNextCheckAt} / ${desiredFallbackAt}.`;
const compactSummary =
  `${attemptId}: secure-tls-bootstrap compact package holder remains ${holderTaskId} over the same exact row-43 and row-44 waits; app-owned package watch fields now point at ${desiredNextCheckAt} / ${desiredFallbackAt} and current evidence is ${appMemoPath}.`;
const ownerReason =
  `${holderTaskId} remains the single exact compact package steward for secure-tls-bootstrap partial status; controller-visible state must keep its row-43 image-pull-after-disable and row-44 surge-node capacity children without reopening a broader rerun carrier.`;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const taskTreePath = resolve(appDir, ".state/tasks/tree.json");
const featureCompactStatePath = resolve(appDir, ".state/feature-compact-loop/state.json");
const specLoopStatePath = resolve(appDir, ".state/spec-loop/state.json");

const taskTreeHashBefore = fileHash(taskTreePath);
const featureHashBefore = fileHash(featureCompactStatePath);
const specHashBefore = fileHash(specLoopStatePath);

const baselineTree = readTaskTree(config);
const baselineHolder = holderSnapshot(baselineTree.tasks[holderTaskId]);
assert(baselineHolder, `Missing holder ${holderTaskId}`);
for (const taskId of frontierTaskIds) {
  assert(baselineTree.tasks[taskId], `Missing frontier member ${taskId}`);
}

const loadedFeatureState = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const baselineFeature = featureSnapshot(
  loadedFeatureState.state.features[featureKey] as MutableRecord | undefined,
);
assert(baselineFeature, `Missing feature compact row ${featureKey}`);
assert(
  baselineFeature.taskId === holderTaskId,
  `Expected ${featureKey}.taskId=${holderTaskId}, found ${baselineFeature.taskId ?? "(null)"}`,
);
assert(
  JSON.stringify(baselineFeature.frontierTaskIds ?? []) ===
    JSON.stringify([...frontierTaskIds]),
  `Expected ${featureKey}.frontierTaskIds to remain ${frontierTaskIds.join(", ")}`,
);

const loadedSpecState = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
  refreshFromProject: false,
});
const row43Spec = jsonClone(
  loadedSpecState.state.specs["spec.secure-tls-bootstrap.network-isolated"],
);
const row44Spec = jsonClone(
  loadedSpecState.state.specs["spec.secure-tls-bootstrap.vnet-integration"],
);
assert(row43Spec, "Missing row-43 spec-loop state");
assert(row44Spec, "Missing row-44 spec-loop state");
assert(
  row43Spec.taskId === frontierTaskIds[0],
  `Expected row-43 taskId=${frontierTaskIds[0]}, found ${String(row43Spec.taskId ?? "(null)")}`,
);
assert(
  row44Spec.taskId === frontierTaskIds[1],
  `Expected row-44 taskId=${frontierTaskIds[1]}, found ${String(row44Spec.taskId ?? "(null)")}`,
);

assert(
  readFileSync(domainMemoAbsolutePath, "utf8").includes(holderTaskId),
  `Domain memo ${domainMemoRelativePath} does not mention ${holderTaskId}`,
);

const refreshedHolderFromHelper = refreshBlockedWait(config, {
  taskId: holderTaskId,
  condition: refreshedCondition,
  resumeCondition: refreshedResumeCondition,
  summary: refreshSummary,
  nextCheckAt: desiredNextCheckAt,
  fallbackAt: desiredFallbackAt,
  fallbackAction: refreshedFallbackAction,
});

const holderAfterTreeRepair = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId];
  assert(holder, `Missing holder ${holderTaskId} during post-refresh repair`);

  holder.outputs = unique([
    ...asStringArray(holder.outputs),
    domainMemoOutputPath,
    appMemoPath,
    ".state/feature-compact-loop/state.json",
  ]);

  const context = asRecord(holder.context);
  context.featureCompactExactWait = true;
  context.featureKey = featureKey;
  context.errorClass = "package-partial";
  context.target = "staging";
  context.compactFrontierTaskIds = [...frontierTaskIds];
  context.frontierTaskIds = [...frontierTaskIds];
  context.reviewEvidencePath = domainMemoOutputPath;
  context.appRepairEvidencePath = appMemoPath;
  context.ownerReason = ownerReason;
  holder.context = context;

  const blocker = asRecord(holder.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  waitingFor.type = asString(waitingFor.type) ?? "frontier.changed";
  waitingFor.taskId = holderTaskId;
  waitingFor.featureKey = featureKey;
  waitingFor.frontierTaskIds = [...frontierTaskIds];
  waitingFor.representedTaskIds = [...frontierTaskIds];
  blocker.waiting_for = waitingFor;
  holder.blocker = blocker;

  holder.trace = {
    ...asRecord(holder.trace),
    secure_tls_compact_package_repair_at: appliedAt,
    secure_tls_compact_package_repair_by: worker,
    secure_tls_compact_package_repair_attempt_id: attemptId,
    secure_tls_compact_package_domain_memo: domainMemoOutputPath,
    secure_tls_compact_package_app_memo: appMemoPath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return holderSnapshot(holder);
});
assert(holderAfterTreeRepair, "Missing holder snapshot after tree repair");

const featureStateLoadedAfterTree = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const featureState = featureStateLoadedAfterTree.state;
const featureBeforeUpdate = featureState.features[featureKey];
assert(featureBeforeUpdate, `Missing feature state for ${featureKey} after task refresh`);

updateFeatureCompactItem(featureState, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [...frontierTaskIds],
  retryable: false,
  retryReason: refreshedResumeCondition,
  ownerReason,
  blockedReason: refreshedCondition,
  waitingFor: asRecord(holderAfterTreeRepair.blocker?.waiting_for),
  waitingCondition: refreshedResumeCondition,
  resumeCondition: refreshedResumeCondition,
  observedBy: asRecord(holderAfterTreeRepair.blocker?.observed_by),
  observationMethod:
    asString(holderAfterTreeRepair.blocker?.observation_method) ??
    "Planner/app-ops refreshed this compact package wait after reviewing returned evidence; controller ticks should keep it blocked until the exact row-43 or row-44 frontier changes.",
  nextCheckAt: desiredNextCheckAt,
  blockerOwner: asString(holderAfterTreeRepair.blocker?.owner) ?? "human",
  fallbackAt: desiredFallbackAt,
  fallbackAction: refreshedFallbackAction,
  reviewEvidencePath: appMemoPath,
  lastCheckedAt: appliedAt,
  updatedAt: appliedAt,
  evidencePaths: unique([
    ...asStringArray(featureBeforeUpdate.evidencePaths),
    domainMemoRelativePath,
    appMemoPath,
  ]),
  attemptedFixes: unique([
    ...asStringArray(featureBeforeUpdate.attemptedFixes),
    attemptedFixLine,
  ]),
  nextStepClassification:
    "Preserve the exact secure-tls-bootstrap compact package split frontier: row-43 stays on the reviewed image-pull-after-disable holder, row-44 stays on the exact surge-node capacity wait, and no unchanged broad rerun is truthful.",
  summary: compactSummary,
  lastSummary: compactSummary,
  verificationBlocker:
    "Do not rerun unchanged. The compact package still truthfully remains partial over the same exact row-43 and row-44 waits until one of those exact frontiers materially changes or stronger accepted evidence reclassifies the package.",
});

saveFeatureCompactLoopState(featureStateLoadedAfterTree.path, featureState);

const taskTreeHashAfter = fileHash(taskTreePath);
const featureHashAfter = fileHash(featureCompactStatePath);
const specHashAfter = fileHash(specLoopStatePath);

assert(taskTreeHashAfter !== taskTreeHashBefore, "Task tree hash did not change");
assert(featureHashAfter !== featureHashBefore, "Feature compact state hash did not change");
assert(specHashAfter === specHashBefore, ".state/spec-loop/state.json changed unexpectedly");

const afterTree = readTaskTree(config);
const afterHolder = holderSnapshot(afterTree.tasks[holderTaskId]);
const afterFeatureLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const afterFeature = featureSnapshot(
  afterFeatureLoaded.state.features[featureKey] as MutableRecord | undefined,
);
assert(afterHolder, `Missing holder ${holderTaskId} after apply`);
assert(afterFeature, `Missing ${featureKey} row after apply`);

const memo = `# App apply — secure-tls-bootstrap compact package frontier return state repair (2026-07-17)

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Live holder: \`${holderTaskId}\`
- Domain memo: \`${domainMemoOutputPath}\`
- App memo: \`${appMemoPath}\`

## Authority used

- Supported task-tree mutation: \`refreshBlockedWait(... )\` plus \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\`
- Supported compact-loop mutation: \`loadFeatureCompactLoopState(... )\` + \`updateFeatureCompactItem(... )\` + \`saveFeatureCompactLoopState(... )\`
- Spec-loop read-only verification: \`loadSpecLoopState(... )\`

## Baseline before apply

### Holder before

\`\`\`json
${JSON.stringify(baselineHolder, null, 2)}
\`\`\`

### Compact row before

\`\`\`json
${JSON.stringify(baselineFeature, null, 2)}
\`\`\`

### Spec-loop members revalidated (read only)

Row 43:

\`\`\`json
${JSON.stringify(
  {
    taskId: row43Spec.taskId ?? null,
    resumeCondition: row43Spec.resumeCondition ?? null,
    review: row43Spec.review ?? null,
  },
  null,
  2,
)}
\`\`\`

Row 44:

\`\`\`json
${JSON.stringify(
  {
    taskId: row44Spec.taskId ?? null,
    resumeCondition: row44Spec.resumeCondition ?? null,
    review: row44Spec.review ?? null,
  },
  null,
  2,
)}
\`\`\`

## Applied repair

1. Refreshed \`${holderTaskId}\` in place from the accepted return evidence in \`${domainMemoOutputPath}\`.
2. Preserved the unchanged exact frontier member mapping:
   - row 43 → \`${frontierTaskIds[0]}\`
   - row 44 → \`${frontierTaskIds[1]}\`
3. Advanced the package holder watch window to future values \`${desiredNextCheckAt}\` / \`${desiredFallbackAt}\`.
4. Added app-owned holder context/evidence pointers so the live branch records both the reviewed domain memo and this app repair memo.
5. Rewrote the controller-visible \`${featureKey}\` compact row so task id, frontier ids, watch window, and review evidence now match the repaired holder.
6. Confirmed \`.state/spec-loop/state.json\` stayed unchanged because the row-43 and row-44 spec carriers were already correct.

## Verification after apply

### Holder after

\`\`\`json
${JSON.stringify(afterHolder, null, 2)}
\`\`\`

### Compact row after

\`\`\`json
${JSON.stringify(afterFeature, null, 2)}
\`\`\`

## File hash check

- Task tree changed: \`${taskTreeHashBefore}\` → \`${taskTreeHashAfter}\`
- Feature compact state changed: \`${featureHashBefore}\` → \`${featureHashAfter}\`
- Spec loop state unchanged: \`${specHashBefore}\` = \`${specHashAfter}\`

## Acceptance check

- App-owned task-tree or loop-state repair applied through supported app mechanisms: satisfied.
- Affected branch records the exact refreshed holder and future package watch window with evidence: satisfied via live holder \`${holderTaskId}\`, updated feature row \`${featureKey}\`, and this memo.
`;

writeMemo(appMemoAbsolutePath, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairTaskId,
      appMemoPath,
      taskTreePath,
      featureCompactStatePath,
      specLoopStatePath,
      refreshedHolderFromHelper: holderSnapshot(refreshedHolderFromHelper),
      before: {
        holder: baselineHolder,
        feature: baselineFeature,
      },
      after: {
        holder: afterHolder,
        feature: afterFeature,
      },
      hashes: {
        taskTree: { before: taskTreeHashBefore, after: taskTreeHashAfter },
        featureCompact: { before: featureHashBefore, after: featureHashAfter },
        specLoop: { before: specHashBefore, after: specHashAfter },
      },
    },
    null,
    2,
  ),
);

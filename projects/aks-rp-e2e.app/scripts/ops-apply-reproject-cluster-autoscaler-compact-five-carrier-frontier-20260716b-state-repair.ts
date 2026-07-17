import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b-state-repair_20260716151304";
const repairTaskId =
  "ops-apply-reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b-state-repair";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const featureLoopTaskId = "aks-feature-compact-loop";
const featureKey = "cluster-autoscaler";
const holderTaskId =
  "hold-compact-cluster-autoscaler-five-carrier-frontier-20260714";
const retiredTaskId =
  "ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713";
const priorEvidencePath =
  "evidence/archive/ops-apply-reconcile-cluster-autoscaler-compact-frontier-lineage-20260714.md";
const memoPath =
  "evidence/archive/reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b.md";
const memoAbsolute = resolve(appDir, memoPath);
const domainMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b.md";

const frontierTaskIds = [
  "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
  "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
  "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
  "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
  "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709",
] as const;

const desiredNextCheckAt = "2026-07-16T18:00:00Z";
const desiredFallbackAt = "2026-07-16T20:40:00Z";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && Boolean(entry.trim()),
      )
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left]) === JSON.stringify([...right]);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf8");
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const baselineTree = readTaskTree(config);
const baselineHolder = baselineTree.tasks[holderTaskId] as TaskNode | undefined;
assert(baselineHolder, `Missing holder task ${holderTaskId}`);
assert(
  !baselineTree.tasks[retiredTaskId],
  `${retiredTaskId} unexpectedly became live again`,
);
for (const frontierTaskId of frontierTaskIds) {
  assert(
    baselineTree.tasks[frontierTaskId],
    `Missing frontier carrier task ${frontierTaskId}`,
  );
}

const holderContextBefore = asRecord(baselineHolder.context);
const holderBlockerBefore = asRecord(baselineHolder.blocker);
const holderFrontierBefore = asStringArray(
  holderContextBefore.compactFrontierTaskIds ?? holderContextBefore.frontierTaskIds,
);

const carrierWindowsBefore = frontierTaskIds.map((taskId) => {
  const task = baselineTree.tasks[taskId] as TaskNode | undefined;
  const blocker = asRecord(task?.blocker);
  return {
    taskId,
    state: asString(task?.state ?? task?.status),
    next_check_at: asString(blocker.next_check_at) || null,
    fallback_at: asString(blocker.fallback_at) || null,
  };
});

const loaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: featureLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const state = loaded.state;
const featureBefore = clone(state.features[featureKey]);
assert(featureBefore, `Missing feature-compact state for ${featureKey}`);
assert(
  featureBefore.taskId === holderTaskId,
  `Expected ${featureKey}.taskId=${holderTaskId}, got ${featureBefore.taskId ?? "(null)"}`,
);
assert(
  sameList(asStringArray(featureBefore.frontierTaskIds), frontierTaskIds),
  `Expected ${featureKey}.frontierTaskIds to already preserve the exact five carriers`,
);

const refreshSummary =
  `${attemptId}: refreshed ${holderTaskId} in place so current app-owned proof points at ${memoPath} and the holder/feature watch window now matches the represented five-carrier frontier (${desiredNextCheckAt} / ${desiredFallbackAt}) without reviving ${retiredTaskId} or broadening the rerun surface.`;
const attemptedFixLine =
  `${attemptId}: refreshed the current review evidence pointer to ${memoPath} and aligned ${featureKey} compact holder watch windows to ${desiredNextCheckAt} / ${desiredFallbackAt} while preserving the exact same five frontier task ids.`;
const lastSummary =
  `Cluster-autoscaler compact remains blocked on the same exact five governed downstream carriers; app-owned holder ${holderTaskId} now points at ${memoPath} and the controller-visible watch window is refreshed to ${desiredNextCheckAt} / ${desiredFallbackAt}.`;

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
  assert(holder, `Missing holder ${holderTaskId} during apply`);
  assert(
    !tree.tasks[retiredTaskId],
    `${retiredTaskId} unexpectedly became live during apply`,
  );

  holder.state = "blocked";
  holder.status = "blocked";
  holder.outputs = unique([
    ...asStringArray(holder.outputs),
    ".state/feature-compact-loop/state.json",
    memoPath,
  ]);

  const context = asRecord(holder.context);
  context.featureCompactExactWait = true;
  context.featureKey = featureKey;
  context.errorClass = "package-partial";
  context.target = "staging";
  context.compactFrontierTaskIds = [...frontierTaskIds];
  context.frontierTaskIds = [...frontierTaskIds];
  context.retiredCompactTaskId = retiredTaskId;
  context.reviewEvidencePath = memoPath;
  holder.context = context;

  const blocker = asRecord(holder.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  waitingFor.type = asString(waitingFor.type) || "compact.frontier.changed";
  waitingFor.taskId = holderTaskId;
  waitingFor.featureKey = featureKey;
  waitingFor.target = "staging";
  waitingFor.errorClass = "package-partial";
  waitingFor.scope = "feature-compact";
  waitingFor.frontierTaskIds = [...frontierTaskIds];

  holder.blocker = {
    ...blocker,
    waiting_for: waitingFor,
    next_check_at: desiredNextCheckAt,
    resume_at: desiredNextCheckAt,
    fallback_at: desiredFallbackAt,
  };

  holder.result = refreshSummary;
  holder.trace = {
    ...asRecord(holder.trace),
    represented_frontier_task_ids: [...frontierTaskIds],
    cluster_autoscaler_compact_holder_reprojected_at: appliedAt,
    cluster_autoscaler_compact_holder_reprojected_by: worker,
    cluster_autoscaler_compact_holder_reproject_attempt_id: attemptId,
    cluster_autoscaler_compact_holder_review_evidence_path: memoPath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return clone(holder);
});

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [...frontierTaskIds],
  reviewEvidencePath: memoPath,
  evidencePaths: unique([
    ...asStringArray(featureBefore.evidencePaths),
    priorEvidencePath,
    memoPath,
    domainMemoPath,
  ]),
  attemptedFixes: unique([
    ...asStringArray(featureBefore.attemptedFixes),
    attemptedFixLine,
  ]),
  summary: refreshSummary,
  lastSummary,
  lastCheckedAt: appliedAt,
  nextCheckAt: desiredNextCheckAt,
  fallbackAt: desiredFallbackAt,
  waitingFor: asRecord(asRecord(treeMutation.blocker).waiting_for),
  waitingCondition:
    asString(asRecord(treeMutation.blocker).resume_condition) ||
    featureBefore.waitingCondition ||
    null,
  resumeCondition:
    asString(asRecord(treeMutation.blocker).resume_condition) ||
    featureBefore.resumeCondition ||
    null,
  blockedReason:
    asString(asRecord(treeMutation.blocker).condition) ||
    featureBefore.blockedReason ||
    null,
  observationMethod:
    asString(asRecord(treeMutation.blocker).observation_method) ||
    featureBefore.observationMethod ||
    null,
  observedBy:
    asRecord(asRecord(treeMutation.blocker).observed_by).workflow ||
    asRecord(asRecord(treeMutation.blocker).observed_by).schedule ||
    asRecord(asRecord(treeMutation.blocker).observed_by).trigger
      ? asRecord(asRecord(treeMutation.blocker).observed_by)
      : featureBefore.observedBy || null,
  blockerOwner:
    asString(asRecord(treeMutation.blocker).owner) ||
    featureBefore.blockerOwner ||
    null,
});
saveFeatureCompactLoopState(loaded.path, state);

const afterTree = readTaskTree(config);
const holderAfter = afterTree.tasks[holderTaskId] as TaskNode | undefined;
assert(holderAfter, `Missing holder ${holderTaskId} after apply`);
assert(!afterTree.tasks[retiredTaskId], `${retiredTaskId} unexpectedly became live after apply`);
const holderContextAfter = asRecord(holderAfter.context);
const holderBlockerAfter = asRecord(holderAfter.blocker);
const holderFrontierAfter = asStringArray(
  holderContextAfter.compactFrontierTaskIds ?? holderContextAfter.frontierTaskIds,
);

const featureAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: featureLoopTaskId,
  windowSize: 1,
  statePath: loaded.path,
  refreshFromProject: false,
}).state.features[featureKey];
assert(featureAfter, `Missing feature-compact state for ${featureKey} after apply`);

assert(
  asString(holderAfter.state ?? holderAfter.status) === "blocked",
  `Expected ${holderTaskId} to remain blocked`,
);
assert(
  sameList(holderFrontierAfter, frontierTaskIds),
  `Expected ${holderTaskId} to keep the exact five frontier ids; got ${JSON.stringify(holderFrontierAfter)}`,
);
assert(
  asString(holderContextAfter.reviewEvidencePath) === memoPath,
  `Expected ${holderTaskId}.context.reviewEvidencePath=${memoPath}, got ${JSON.stringify(holderContextAfter.reviewEvidencePath ?? null)}`,
);
assert(
  asString(holderBlockerAfter.next_check_at) === desiredNextCheckAt,
  `Expected ${holderTaskId}.blocker.next_check_at=${desiredNextCheckAt}, got ${JSON.stringify(holderBlockerAfter.next_check_at ?? null)}`,
);
assert(
  asString(holderBlockerAfter.fallback_at) === desiredFallbackAt,
  `Expected ${holderTaskId}.blocker.fallback_at=${desiredFallbackAt}, got ${JSON.stringify(holderBlockerAfter.fallback_at ?? null)}`,
);
assert(
  sameList(asStringArray(featureAfter.frontierTaskIds), frontierTaskIds),
  `Expected ${featureKey}.frontierTaskIds to preserve the exact five carrier ids`,
);
assert(
  featureAfter.reviewEvidencePath === memoPath,
  `Expected ${featureKey}.reviewEvidencePath=${memoPath}, got ${featureAfter.reviewEvidencePath ?? "(null)"}`,
);
assert(
  featureAfter.nextCheckAt === desiredNextCheckAt,
  `Expected ${featureKey}.nextCheckAt=${desiredNextCheckAt}, got ${featureAfter.nextCheckAt ?? "(null)"}`,
);
assert(
  featureAfter.fallbackAt === desiredFallbackAt,
  `Expected ${featureKey}.fallbackAt=${desiredFallbackAt}, got ${featureAfter.fallbackAt ?? "(null)"}`,
);

const memo = `# App apply — reproject cluster-autoscaler compact five-carrier frontier state repair (2026-07-16)\n\n- Task: \`${repairTaskId}\`\n- Attempt: \`${attemptId}\`\n- Applied at: \`${appliedAt}\`\n- App holder: \`${holderTaskId}\`\n- Feature row: \`${featureKey}\` in \`.state/feature-compact-loop/state.json\`\n\n## Authority used\n\n- Reviewed domain memo: \`${domainMemoPath}\`\n- Prior app evidence pointer: \`${priorEvidencePath}\`\n- Supported mechanisms: \`readTaskTree(... )\` + \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\`, plus \`loadFeatureCompactLoopState(... )\` + \`updateFeatureCompactItem(... )\` + \`saveFeatureCompactLoopState(... )\`\n\n## Baseline before apply\n\n- holder state: \`${asString(baselineHolder.state ?? baselineHolder.status)}\`\n- holder context.reviewEvidencePath before: ${JSON.stringify(holderContextBefore.reviewEvidencePath ?? null)}\n- holder blocker.next_check_at before: ${JSON.stringify(holderBlockerBefore.next_check_at ?? null)}\n- holder blocker.fallback_at before: ${JSON.stringify(holderBlockerBefore.fallback_at ?? null)}\n- feature reviewEvidencePath before: ${JSON.stringify(featureBefore.reviewEvidencePath ?? null)}\n- feature nextCheckAt before: ${JSON.stringify(featureBefore.nextCheckAt ?? null)}\n- feature fallbackAt before: ${JSON.stringify(featureBefore.fallbackAt ?? null)}\n- retired review leaf live before apply: \`${String(Boolean(baselineTree.tasks[retiredTaskId]))}\`\n\n## Exact preserved frontier\n\n${frontierTaskIds.map((taskId) => `- \`${taskId}\``).join("\n")}\n\nCarrier watch windows consulted from live task-tree before apply:\n\n\`\`\`json\n${JSON.stringify(carrierWindowsBefore, null, 2)}\n\`\`\`\n\n## Applied repair\n\n1. Preserved \`${holderTaskId}\` as the same blocked compact-facing holder over the same exact five represented carrier ids.\n2. Updated \`${holderTaskId}.context.reviewEvidencePath\` to \`${memoPath}\` without reviving \`${retiredTaskId}\`.\n3. Refreshed \`${holderTaskId}.blocker.next_check_at\` to \`${desiredNextCheckAt}\` and \`${holderTaskId}.blocker.fallback_at\` to \`${desiredFallbackAt}\`, matching the memo-derived carrier windows.\n4. Rewrote the app-owned \`${featureKey}\` compact row so \`reviewEvidencePath\`, \`nextCheckAt\`, and \`fallbackAt\` now match the live holder.\n\n## Verification after apply\n\n### Holder after\n\n\`\`\`json\n${JSON.stringify(
  {
    state: holderAfter.state ?? holderAfter.status ?? null,
    context: {
      reviewEvidencePath: holderContextAfter.reviewEvidencePath ?? null,
      compactFrontierTaskIds:
        holderContextAfter.compactFrontierTaskIds ??
        holderContextAfter.frontierTaskIds ??
        null,
    },
    blocker: {
      next_check_at: holderBlockerAfter.next_check_at ?? null,
      fallback_at: holderBlockerAfter.fallback_at ?? null,
      waiting_for: holderBlockerAfter.waiting_for ?? null,
    },
    result: holderAfter.result ?? null,
  },
  null,
  2,
)}\n\`\`\`\n\n### Feature row after\n\n\`\`\`json\n${JSON.stringify(
  {
    taskId: featureAfter.taskId ?? null,
    frontierTaskIds: featureAfter.frontierTaskIds ?? null,
    reviewEvidencePath: featureAfter.reviewEvidencePath ?? null,
    nextCheckAt: featureAfter.nextCheckAt ?? null,
    fallbackAt: featureAfter.fallbackAt ?? null,
    lastCheckedAt: featureAfter.lastCheckedAt ?? null,
  },
  null,
  2,
)}\n\`\`\`\n\n## Acceptance check\n\n- App-owned task-tree or loop-state repair applied through supported app mechanisms: satisfied.\n- Affected branch records the exact restored holder/state pointer/refreshed wait with evidence: satisfied via the live holder readback, the updated cluster-autoscaler compact row, and this memo at \`${memoPath}\`.\n`;

writeText(memoAbsolute, memo);

console.log(
  JSON.stringify(
    {
      taskId: repairTaskId,
      attemptId,
      appliedAt,
      memoPath,
      verification: {
        retiredLeafAbsent: !afterTree.tasks[retiredTaskId],
        holderState: holderAfter.state ?? holderAfter.status ?? null,
        holderReviewEvidencePath: holderContextAfter.reviewEvidencePath ?? null,
        holderNextCheckAt: holderBlockerAfter.next_check_at ?? null,
        holderFallbackAt: holderBlockerAfter.fallback_at ?? null,
        holderFrontierTaskIds: holderFrontierAfter,
        featureTaskId: featureAfter.taskId ?? null,
        featureReviewEvidencePath: featureAfter.reviewEvidencePath ?? null,
        featureNextCheckAt: featureAfter.nextCheckAt ?? null,
        featureFallbackAt: featureAfter.fallbackAt ?? null,
        featureFrontierTaskIds: featureAfter.frontierTaskIds ?? null,
      },
    },
    null,
    2,
  ),
);

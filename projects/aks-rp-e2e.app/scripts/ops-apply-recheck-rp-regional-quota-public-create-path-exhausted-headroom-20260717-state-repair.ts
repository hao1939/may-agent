import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  refreshBlockedWait,
  taskTreeConfig,
  updateTaskText,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, type TaskNode } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717-state-repair_20260717100132";
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const holderTaskId =
  "hold-spec-rp-regional-quota-public-create-path-exhausted-target-frontier-20260717";
const featureKey = "rp-regional-quota";
const nextCheckAt = "2026-07-18T10:00:00Z";
const resumeAt = nextCheckAt;
const fallbackAt = "2026-07-18T18:00:00Z";
const domainEvidenceRefs = [
  "evidence/archive/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717.md",
  "evidence/archive/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717/arm-usages-20260717T095737Z.json",
  "evidence/archive/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717/westus2-managedclusters-20260717T095737Z.json",
] as const;
const domainEvidencePaths = domainEvidenceRefs.map(
  (ref) => `../aks-rp-e2e/${ref}`,
);
const appEvidenceRelative =
  "evidence/archive/ops-apply-recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717-state-repair.md";
const appEvidencePath = resolve(appDir, appEvidenceRelative);

const blockerCondition =
  "Fresh same-subscription/same-region recheck at 2026-07-17T09:57:37Z still shows westus2 ManagedClusters=40/161 (121 free) for subscription 26fe00f8-9173-4872-9134-bb1d2e00343a, so the decisive managedClusters PUT quota-negative assertion is still not reachable on this exact staging target. Evidence: evidence/archive/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717.md plus evidence/archive/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717/arm-usages-20260717T095737Z.json and evidence/archive/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717/westus2-managedclusters-20260717T095737Z.json. Keep only this exact holder unless a reviewed same-surface exhausted target or sharper same-surface replacement carrier appears.";
const resumeCondition =
  "Resume only when the same staging subscription+region is exhausted enough for the decisive managedClusters PUT quota-negative assertion, or when a future reviewed same-surface exhausted target truthfully replaces this exact carrier.";
const fallbackAction =
  "If the 2026-07-17T09:57:37Z same-surface recheck still represents the truth at the next review window, keep only this exact exhausted-target holder with refreshed evidence; do not rerun unchanged, do not reopen repo-local source-witness cleanup as a second blocker, and do not claim the completed recheck task is still active.";
const refreshSummary =
  "Refreshed this exact exhausted-target holder from the completed 2026-07-17T09:57:37Z same-subscription/same-region recheck (westus2 ManagedClusters 40/161) and moved the next review window to 2026-07-18.";
const compactSummary =
  "Fresh 2026-07-17T09:57:37Z same-surface recheck kept the rp-regional-quota exhausted-target frontier blocked at westus2 ManagedClusters 40/161, so the compact representation now carries the 2026-07-18 next/fallback review window instead of the stale same-day timing.";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as JsonRecord) } as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" && entry.trim() ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry));
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function blockerOf(task: TaskNode | undefined): JsonRecord {
  return asRecord(task?.blocker);
}

function snapshotTask(task: TaskNode | undefined) {
  const blocker = blockerOf(task);
  return {
    state: asString(task?.state) ?? asString((task as JsonRecord | undefined)?.status) ?? null,
    result: asString((task as JsonRecord | undefined)?.result) ?? null,
    blocker: {
      condition: asString(blocker.condition),
      resume_condition: asString(blocker.resume_condition),
      resume_at: asString(blocker.resume_at),
      next_check_at: asString(blocker.next_check_at),
      fallback_at: asString(blocker.fallback_at),
      fallback_action: asString(blocker.fallback_action),
      blocked_at: asString(blocker.blocked_at),
      owner: asString(blocker.owner),
      category: asString(blocker.category),
    },
    trace: asRecord(task?.trace),
  };
}

function snapshotCompact(item: FeatureCompactItemState | undefined) {
  return {
    status: asString(item?.status),
    taskId: asString(item?.taskId),
    frontierTaskIds: asStringArray(item?.frontierTaskIds),
    nextCheckAt: asString(item?.nextCheckAt),
    fallbackAt: asString(item?.fallbackAt),
    fallbackAction: asString(item?.fallbackAction),
    lastCheckedAt: asString(item?.lastCheckedAt),
    evidencePaths: asStringArray(item?.evidencePaths),
    reviewEvidencePath: asString(item?.reviewEvidencePath),
    summary: asString(item?.summary),
  };
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf-8");
}

const beforeTree = readTaskTree(config);
const beforeTask = beforeTree.tasks[holderTaskId] as TaskNode | undefined;
assert(beforeTask, `Missing holder task ${holderTaskId}`);
assert((beforeTask.state ?? beforeTask.status) === "blocked", `${holderTaskId} must be blocked before refresh`);
const beforeBlocker = blockerOf(beforeTask);
assert(
  asString(beforeBlocker.condition)?.includes("active task domain/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717") ?? false,
  "Expected stale blocker text to still mention the active recheck task before repair",
);

const beforeCompactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 5,
  refreshFromProject: false,
});
const beforeCompact = beforeCompactLoaded.state.features[featureKey];
assert(beforeCompact, `Missing feature-compact row ${featureKey}`);

refreshBlockedWait(config, {
  taskId: holderTaskId,
  condition: blockerCondition,
  resumeCondition,
  summary: refreshSummary,
  category: "external-wait",
  owner: "human",
  nextCheckAt,
  fallbackAt,
  fallbackAction,
});

updateTaskText(config, {
  taskId: holderTaskId,
  resumeAt,
  nextCheckAt,
  fallbackAt,
});

const compactEvidencePaths = uniqueStrings([
  ...asStringArray(beforeCompact.evidencePaths),
  ...domainEvidencePaths,
  appEvidenceRelative,
]);

updateFeatureCompactItem(beforeCompactLoaded.state, featureKey, {
  status: "blocked",
  frontierTaskIds: uniqueStrings([
    ...asStringArray(beforeCompact.frontierTaskIds),
    holderTaskId,
  ]),
  nextCheckAt,
  fallbackAt,
  fallbackAction,
  lastCheckedAt: appliedAt,
  evidencePaths: compactEvidencePaths,
  reviewEvidencePath: appEvidenceRelative,
  summary: compactSummary,
});
saveFeatureCompactLoopState(beforeCompactLoaded.path, beforeCompactLoaded.state);

const afterTree = readTaskTree(config);
const afterTask = afterTree.tasks[holderTaskId] as TaskNode | undefined;
assert(afterTask, `Missing holder task ${holderTaskId} after refresh`);
const afterBlocker = blockerOf(afterTask);
assert(
  !(asString(afterBlocker.condition)?.includes("active task domain/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717") ?? false),
  "Refreshed blocker text still says the recheck task is active",
);
assert(
  asString(afterBlocker.condition)?.includes("ManagedClusters=40/161") ?? false,
  "Refreshed blocker text must cite ManagedClusters=40/161 evidence",
);
assert(asString(afterBlocker.resume_at) === resumeAt, `Expected resume_at=${resumeAt}`);
assert(asString(afterBlocker.next_check_at) === nextCheckAt, `Expected next_check_at=${nextCheckAt}`);
assert(asString(afterBlocker.fallback_at) === fallbackAt, `Expected fallback_at=${fallbackAt}`);
assert(
  asString(afterBlocker.fallback_action)?.includes("completed recheck task is still active") ?? false,
  "Fallback action must explicitly remove the stale active-recheck claim",
);

const afterCompactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 5,
  refreshFromProject: false,
});
const afterCompact = afterCompactLoaded.state.features[featureKey];
assert(afterCompact, `Missing feature-compact row ${featureKey} after refresh`);
assert(asString(afterCompact.nextCheckAt) === nextCheckAt, `Expected compact nextCheckAt=${nextCheckAt}`);
assert(asString(afterCompact.fallbackAt) === fallbackAt, `Expected compact fallbackAt=${fallbackAt}`);
for (const evidencePath of domainEvidencePaths) {
  assert(
    asStringArray(afterCompact.evidencePaths).includes(evidencePath),
    `Expected compact evidencePaths to include ${evidencePath}`,
  );
}

const evidence = `# App state repair — rp-regional-quota public-create-path exhausted headroom hold refresh — 2026-07-17\n\n- Attempt: \`${attemptId}\`\n- Worker: \`${worker}\`\n- Applied at: \`${appliedAt}\`\n- Holder task: \`${holderTaskId}\`\n- Feature compact row: \`${featureKey}\`\n\n## Goal\n\nRefresh the blocked holder with the completed recheck evidence, keep the same same-subscription/same-region exhausted-target wait, move the next review window to 2026-07-18, and remove stale text that still treated the completed recheck task as active.\n\n## Source evidence applied\n\n- \`${domainEvidenceRefs[0]}\`\n- \`${domainEvidenceRefs[1]}\`\n- \`${domainEvidenceRefs[2]}\`\n\n## Supported app mechanisms used\n\n1. \`refreshBlockedWait(config, ...)\` from \`workflows/lib/task-tree-tools.ts\` to rewrite the live structured blocker text and fallback timing on \`${holderTaskId}\`.\n2. \`updateTaskText(config, ...)\` from \`workflows/lib/task-tree-tools.ts\` to set \`resume_at\` on the same live holder to \`${resumeAt}\`.\n3. \`loadFeatureCompactLoopState(...)\` + \`updateFeatureCompactItem(...)\` + \`saveFeatureCompactLoopState(...)\` from \`workflows/lib/feature-compact-loop-store.ts\` to refresh the app-owned compact loop timing/evidence mirror for \`${featureKey}\`.\n\n## Before → after\n\n### Holder blocker snapshot\n\nBefore:\n\n\`\`\`json\n${JSON.stringify(snapshotTask(beforeTask), null, 2)}\n\`\`\`\n\nAfter:\n\n\`\`\`json\n${JSON.stringify(snapshotTask(afterTask), null, 2)}\n\`\`\`\n\n### Feature compact mirror snapshot\n\nBefore:\n\n\`\`\`json\n${JSON.stringify(snapshotCompact(beforeCompact), null, 2)}\n\`\`\`\n\nAfter:\n\n\`\`\`json\n${JSON.stringify(snapshotCompact(afterCompact), null, 2)}\n\`\`\`\n\n## Result\n\n- The live holder no longer says \`domain/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717\` is still active.\n- The live holder now cites the completed same-surface recheck evidence showing westus2 \`ManagedClusters=40/161\` at \`2026-07-17T09:57:37Z\`.\n- \`resume_at\` and \`next_check_at\` are both \`${resumeAt}\`.\n- \`fallback_at\` is now \`${fallbackAt}\`.\n- The app-owned feature compact mirror for \`${featureKey}\` now carries the same refreshed next/fallback window and includes the completed recheck memo/raw JSON evidence paths.\n\n## Notes\n\n- This bounded repair did **not** rewrite \`.state/spec-loop/state.json\`; the assigned goal was the blocked-holder refresh plus its compact-loop mirror timing/evidence.\n- No project/runtime event emission was performed from this session.\n`;

writeText(appEvidencePath, evidence);

console.log(
  JSON.stringify(
    {
      attemptId,
      appEvidenceRelative,
      holderBefore: snapshotTask(beforeTask),
      holderAfter: snapshotTask(afterTask),
      compactBefore: snapshotCompact(beforeCompact),
      compactAfter: snapshotCompact(afterCompact),
    },
    null,
    2,
  ),
);

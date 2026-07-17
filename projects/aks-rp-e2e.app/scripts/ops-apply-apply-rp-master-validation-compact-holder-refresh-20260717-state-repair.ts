import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { readTaskTree, type TaskNode } from "../workflows/lib/task-tree-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";

type JsonRecord = Record<string, unknown>;

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-apply-rp-master-validation-compact-holder-refresh-20260717-state-repair_20260717113736";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-feature-compact-loop";
const featureKey = "rp-master-validation";
const holderTaskId = "hold-compact-rp-master-validation-ready-spec-frontier-20260715";
const evidencePath =
  "evidence/archive/ops-apply-apply-rp-master-validation-compact-holder-refresh-20260717-state-repair.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const reviewMemoPath =
  "../aks-rp-e2e/evidence/archive/apply-rp-master-validation-compact-holder-refresh-20260717.md";
const reconcileMemoPath =
  "../aks-rp-e2e/evidence/archive/reconcile-rp-master-validation-ready-spec-frontier-20260717.md";
const reviewEvidencePaths = [
  "../aks-rp-e2e/evidence/archive/review-rp-master-validation-agentpool-delete-ignore-pdb-run-172364428-20260716.md",
  "../aks-rp-e2e/evidence/archive/review-rp-master-validation-if-match-run-172364377-20260716.md",
  "../aks-rp-e2e/evidence/archive/review-rp-master-validation-rbac-disabled-run-172364350-20260716.md",
  "../aks-rp-e2e/evidence/archive/review-rp-master-validation-spot-pool-run-172397034-20260716.md",
] as const;
const appFeatureStatePath = resolve(appDir, ".state/feature-compact-loop/state.json");
const appSpecStatePath = resolve(appDir, ".state/spec-loop/state.json");

const residualSpecIds = [
  "spec.rp-master-validation.agentpool-delete-ignore-pdb",
  "spec.rp-master-validation.if-match",
  "spec.rp-master-validation.rbac-disabled",
] as const;
const residualReviewRunIds = ["172364428", "172364377", "172364350"] as const;
const resolvedSpotPool = {
  specId: "spec.rp-master-validation.spot-pool",
  runId: "172397034",
  status: "pass",
} as const;
const nextCheckAt = "2026-07-17T18:00:00Z";
const fallbackAt = "2026-07-18T11:25:02.071Z";
const resumeAt = "2026-07-17T18:00:00Z";
const blockedAt = "2026-07-15T11:21:16.248Z";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf8");
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function itemSnapshot(item: FeatureCompactItemState | undefined) {
  return {
    status: item?.status ?? null,
    errorClass: item?.errorClass ?? null,
    taskId: item?.taskId ?? null,
    frontierTaskIds: [...(item?.frontierTaskIds ?? [])],
    retryReason: item?.retryReason ?? null,
    ownerReason: item?.ownerReason ?? null,
    nextStepClassification: item?.nextStepClassification ?? null,
    resumeCondition: item?.resumeCondition ?? null,
    blockedReason: item?.blockedReason ?? null,
    waitingFor: item?.waitingFor ?? null,
    waitingCondition: item?.waitingCondition ?? null,
    nextCheckAt: item?.nextCheckAt ?? null,
    fallbackAt: item?.fallbackAt ?? null,
    reviewEvidencePath: item?.reviewEvidencePath ?? null,
    evidencePaths: [...(item?.evidencePaths ?? [])],
    summary: item?.summary ?? null,
    updatedAt: item?.updatedAt ?? null,
  };
}

function holderSnapshot(task: TaskNode | undefined) {
  const blocker = asRecord(task?.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  return {
    id: task?.id ?? null,
    state: asString(task?.state),
    goal: asString(task?.goal),
    acceptance: asStringArray(task?.acceptance),
    blockerCondition: asString(blocker.condition),
    blockerCategory: asString(blocker.category),
    blockerOwner: asString(blocker.owner),
    waitingFor: task?.blocker ? waitingFor : null,
    waitingForSpecIds: asStringArray(waitingFor.specIds),
    nextCheckAt: asString(blocker.next_check_at),
    resumeAt: asString(blocker.resume_at),
    fallbackAt: asString(blocker.fallback_at),
  };
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});
const tree = readTaskTree(config);
const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
assert(holder, `Missing live holder ${holderTaskId}`);

const holderAfterTreeUpdate = holderSnapshot(holder);
assert(holderAfterTreeUpdate.state === "blocked", `${holderTaskId} must remain blocked`);
assert(
  JSON.stringify(holderAfterTreeUpdate.waitingForSpecIds) === JSON.stringify([...residualSpecIds]),
  `Holder ${holderTaskId} waiting_for.specIds does not match the residual triple`,
);
assert(
  !holderAfterTreeUpdate.blockerCondition?.includes("all four selected members remain quarantined"),
  `Holder ${holderTaskId} still advertises the stale four-member frontier text`,
);
assert(
  !holderAfterTreeUpdate.blockerCondition?.includes("spec.rp-master-validation.spot-pool") ||
    holderAfterTreeUpdate.blockerCondition.includes("resolved history only"),
  `Holder ${holderTaskId} blocker condition still treats spot-pool as active debt`,
);

const beforeFeatureHash = hashFile(appFeatureStatePath);
const beforeSpecHash = hashFile(appSpecStatePath);

const loaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const beforeItem = loaded.state.features[featureKey] as FeatureCompactItemState | undefined;
assert(beforeItem, `Missing feature-compact-loop item ${featureKey}`);
const beforeSnapshot = itemSnapshot(beforeItem);

updateFeatureCompactItem(loaded.state, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  retryReason:
    "Resume only when accepted evidence materially changes one of the reviewed residual triple members, or when refreshed compact artifacts restore an exact runnable successor from this same rp-master-validation surface. Do not reopen broad family reruns from unchanged inputs.",
  ownerReason:
    "Current compact outputs are stale versus accepted review/spec-loop truth: spot-pool is already an accepted pass from run 172397034, while the remaining same-surface residual is only agentpool-delete-ignore-pdb/run 172364428, if-match/run 172364377, and rbac-disabled/run 172364350. The truthful compact-visible carrier is the narrowed residual holder, not the older four-member frontier.",
  attemptedFixes: unique([
    ...(beforeItem?.attemptedFixes ?? []),
    `${attemptId}: refreshed ${holderTaskId} to the reviewed residual triple, reduced controller-visible waitingFor.specIds to the three residual specs, and preserved spot-pool/run 172397034 only as resolved accepted-pass history using ${reviewMemoPath}.`,
  ]),
  nextStepClassification:
    "Preserve one exact reviewed residual-triple compact holder until accepted evidence materially changes one reviewed surface or refreshed compact artifacts restore a truthful runnable successor; do not broad-rerun unchanged rp-master-validation.",
  resumeCondition:
    "Resume only when accepted evidence materially changes one of the reviewed residual triple members, or when refreshed compact artifacts restore an exact runnable successor from this same rp-master-validation surface. Do not reopen broad family reruns from unchanged inputs.",
  blockedAt,
  blockedReason:
    "Current compact outputs still lag review/spec-loop truth: spec.rp-master-validation.spot-pool is already an accepted pass from run 172397034 and belongs only in resolved history, while the remaining same-surface residual is limited to agentpool-delete-ignore-pdb/run 172364428, if-match/run 172364377, and rbac-disabled/run 172364350. Preserve only this narrower three-member compact wait.",
  waitingFor: {
    type: "compact.frontier.changed",
    featureKey,
    blockerKind: "review-backed-same-surface-residual-frontier",
    specIds: [...residualSpecIds],
    reviewRunIds: [...residualReviewRunIds],
    resolvedHistory: [resolvedSpotPool],
  },
  waitingCondition:
    "Keep the compact feature blocked only while the reviewed residual triple still represents the truthful same-surface compact residue; spot-pool/run 172397034 is resolved history only.",
  observedBy: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
  },
  observationMethod:
    "On each compact-loop tick, preserve this exact rp-master-validation compact holder until the frontier materially changes.",
  nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt,
  fallbackAction:
    "If the same reviewed residual triple still holds at fallback, refresh only this exact holder from current review/spec-loop evidence or replace it with a sharper same-surface wait. Do not broad-rerun rp-master-validation and do not recreate the obsolete missing-feature-packet review leaf.",
  resumeAction:
    "Reset this feature compact record to pending only after accepted evidence materially changes one reviewed residual member or refreshed compact artifacts restore a truthful runnable successor.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "package-partial",
    target: "staging",
    featureKey,
    waitTaskId: holderTaskId,
  },
  lastCheckedAt: appliedAt,
  evidencePaths: unique([
    ...(beforeItem?.evidencePaths ?? []),
    reviewMemoPath,
    reconcileMemoPath,
    evidencePath,
    ...reviewEvidencePaths,
    beforeItem?.lastSummaryPath ?? null,
    beforeItem?.lastDiagnosticsPath ?? null,
  ]),
  reviewEvidencePath: evidencePath,
  verificationBlocker:
    "Do not rerun unchanged. The truthful remaining compact blocker is only the reviewed residual triple until accepted evidence materially changes one reviewed surface or refreshed compact artifacts restore a truthful runnable successor.",
  summary:
    "2026-07-17 apply repair narrowed rp-master-validation from the stale four-member accepted-environment-blocked frontier to the reviewed residual triple and preserved spot-pool/run 172397034 only as resolved accepted-pass history.",
});

saveFeatureCompactLoopState(loaded.path, loaded.state);

const afterFeatureHash = hashFile(appFeatureStatePath);
const afterSpecHash = hashFile(appSpecStatePath);
assert(afterFeatureHash !== beforeFeatureHash, "Expected feature-compact-loop state hash to change");
assert(afterSpecHash === beforeSpecHash, "spec-loop state changed unexpectedly");

const reloaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const afterItem = reloaded.state.features[featureKey] as FeatureCompactItemState | undefined;
assert(afterItem, `Missing refreshed feature-compact-loop item ${featureKey}`);
const afterSnapshot = itemSnapshot(afterItem);
const afterWaitingFor = asRecord(afterItem.waitingFor);
const afterResolvedHistory = Array.isArray(afterWaitingFor.resolvedHistory)
  ? afterWaitingFor.resolvedHistory
  : [];

assert(afterItem.taskId === holderTaskId, `Expected ${featureKey} taskId to remain ${holderTaskId}`);
assert(
  JSON.stringify(asStringArray(afterWaitingFor.specIds)) === JSON.stringify([...residualSpecIds]),
  `Feature-compact waitingFor.specIds does not match the residual triple`,
);
assert(
  JSON.stringify(afterItem.frontierTaskIds ?? []) === JSON.stringify([holderTaskId]),
  `Feature-compact frontierTaskIds does not match ${holderTaskId}`,
);
assert(
  !String(afterItem.blockedReason ?? "").includes("all four selected rp-master-validation specs remain quarantined"),
  `Feature-compact blockedReason still advertises the stale four-member frontier`,
);
assert(
  JSON.stringify(afterResolvedHistory) === JSON.stringify([resolvedSpotPool]),
  `Feature-compact resolvedHistory does not preserve the accepted spot-pool pass`,
);

const memo = `# App apply — rp-master-validation compact holder refresh state repair (2026-07-17)

- Task: \`ops-apply-apply-rp-master-validation-compact-holder-refresh-20260717-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- App repo: \`${appDir}\`

## Scope

Applied the exact app-owned repair requested by the reviewed apply packet:

1. Re-verified the live task-tree holder \`${holderTaskId}\` after the supported \`bun run task-tree update-text\` refresh.
2. Refreshed the authoritative app feature-compact-loop record for \`${featureKey}\` through \`loadFeatureCompactLoopState(... )\` + \`updateFeatureCompactItem(... )\` + \`saveFeatureCompactLoopState(... )\`.
3. Preserved \`.state/spec-loop/state.json\` unchanged as the supporting proof surface for the reviewed residual triple and the accepted \`spot-pool\` pass.

## Baseline before feature-compact-loop writeback

- Live holder post-task-tree refresh already showed the residual triple and no stale four-member wait text.
- \`.state/feature-compact-loop/state.json\` hash before: \`${beforeFeatureHash}\`
- \`.state/spec-loop/state.json\` hash before: \`${beforeSpecHash}\`

### Holder readback used as loop-state source of truth

\`\`\`json
${JSON.stringify(holderAfterTreeUpdate, null, 2)}
\`\`\`

### rp-master-validation feature-compact item before writeback

\`\`\`json
${JSON.stringify(beforeSnapshot, null, 2)}
\`\`\`

## Applied feature-compact-loop repair

Refreshed \`features.${featureKey}\` so controller-visible compact state now:

- keeps \`taskId=${holderTaskId}\`
- sets \`frontierTaskIds=["${holderTaskId}"]\`
- narrows \`waitingFor.specIds\` to only the reviewed residual triple
- records \`reviewRunIds\` for runs \`${residualReviewRunIds.join("`, `")}\`
- preserves \`spot-pool\` run \`${resolvedSpotPool.runId}\` only under \`waitingFor.resolvedHistory\`
- replaces the stale four-member \`blockedReason\`/owner text with the reviewed residual-triple wording
- preserves the bounded watch window \`nextCheckAt=${nextCheckAt}\`, \`resumeAt=${resumeAt}\`, and \`fallbackAt=${fallbackAt}\`

## Verification after apply

- \`.state/feature-compact-loop/state.json\` hash after: \`${afterFeatureHash}\`
- \`.state/spec-loop/state.json\` hash after: \`${afterSpecHash}\` (unchanged)

### rp-master-validation feature-compact item after writeback

\`\`\`json
${JSON.stringify(afterSnapshot, null, 2)}
\`\`\`

## Acceptance check

- The app-owned task-tree or loop-state repair is applied through supported app mechanisms: satisfied via the task-tree CLI refresh plus feature-compact-loop store helper writeback.
- The affected branch records the exact restored holder / refreshed wait with evidence: satisfied via \`${holderTaskId}\`, the refreshed \`${featureKey}\` compact-loop record, and this memo at \`${evidencePath}\`.
`;

writeText(evidenceAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      beforeFeatureHash,
      afterFeatureHash,
      beforeSpecHash,
      afterSpecHash,
      holderAfterTreeUpdate,
      beforeSnapshot,
      afterSnapshot,
    },
    null,
    2,
  ),
);

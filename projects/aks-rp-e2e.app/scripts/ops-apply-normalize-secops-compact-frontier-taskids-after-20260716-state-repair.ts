import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const attemptId =
  "a_ops-normalize-secops-compact-frontier-taskids-after-20260716-state-repair_20260716145841";
const repairTaskId =
  "ops-normalize-secops-compact-frontier-taskids-after-20260716-state-repair";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const featureLoopTaskId = "aks-feature-compact-loop";
const featureKey = "secops";
const holderTaskId = "hold-compact-secops-package-partial-frontier-20260714";
const previousMemoPath =
  "evidence/archive/ops-apply-repair-secops-compact-ready-subset-followup-20260716-state-repair.md";
const memoPath =
  "evidence/archive/ops-normalize-secops-compact-frontier-taskids-after-20260716-state-repair.md";
const memoAbsolute = resolve(appDir, memoPath);
const readySubsetRunId = "172310265";

const frontierTaskIds = [
  "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
  "wait-secops-identity-sp-workflow-secret-contract-return-20260704",
  "wait-secops-identity-user-assigned-row153-runtime-return-20260709",
  "wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710",
  "hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708",
  "wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708",
  "hold-spec-shared-authenticated-artifact-result-recovery-family-20260714",
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
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

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function readRawFeatureState(path: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    features?: Record<string, unknown>;
  };
  return asRecord(parsed.features?.[featureKey]);
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
for (const frontierTaskId of frontierTaskIds) {
  assert(
    baselineTree.tasks[frontierTaskId],
    `Missing frontier carrier task ${frontierTaskId}`,
  );
}

const loaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: featureLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const state = loaded.state;
const before = clone(state.features[featureKey]);
assert(before, `Missing feature-compact state for ${featureKey}`);
assert(
  before.taskId === holderTaskId,
  `Expected ${featureKey}.taskId=${holderTaskId}, got ${before.taskId ?? "(null)"}`,
);
assert(
  typeof before.resumeCondition === "string" && before.resumeCondition.includes(readySubsetRunId),
  `Expected existing resumeCondition to preserve ADO run ${readySubsetRunId}`,
);
const rawBefore = readRawFeatureState(loaded.path);
const holderContextBefore = asRecord(baselineHolder.context);
const holderFrontierBefore = asStringArray(
  holderContextBefore.compactFrontierTaskIds ?? holderContextBefore.frontierTaskIds,
);

const attemptedFixLine =
  `${attemptId}: restored holder context.featureCompactExactWait plus explicit compactFrontierTaskIds/frontierTaskIds for ${holderTaskId}, then rewrote the app-owned secops compact row so the persisted raw state artifact again lists the exact seven represented carrier ids for run ${readySubsetRunId}.`;
const summary =
  `${attemptId}: normalized the persisted app-owned secops compact frontier by restoring holder context metadata and rewriting raw state so frontierTaskIds now lists the exact seven represented carriers while Azure DevOps run ${readySubsetRunId} remains the consumed only dependency-clear 11-spec ready subset.`;
const lastSummary =
  `Secops compact remains package-partial on the same seven represented carriers after Azure DevOps run ${readySubsetRunId} fully consumed the only 11-spec dependency-clear ready subset; controller-visible frontierTaskIds now explicitly lists those seven carrier ids because holder ${holderTaskId} again carries the exact frontier metadata in task-tree context. See ${memoPath}.`;

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
  assert(holder, `Missing holder ${holderTaskId} during apply`);

  holder.outputs = unique([...asStringArray(holder.outputs), memoPath]);
  holder.context = {
    ...asRecord(holder.context),
    featureCompactExactWait: true,
    featureKey,
    errorClass: "package-partial",
    target: "staging",
    compactFrontierTaskIds: [...frontierTaskIds],
    frontierTaskIds: [...frontierTaskIds],
    reviewEvidencePath: memoPath,
  };
  holder.trace = {
    ...asRecord(holder.trace),
    normalized_secops_frontier_taskids_at: appliedAt,
    normalized_secops_frontier_taskids_by: worker,
    represented_frontier_task_ids: [...frontierTaskIds],
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return clone(holder);
});

updateFeatureCompactItem(state, featureKey, {
  status: before.status,
  taskId: holderTaskId,
  frontierTaskIds: [...frontierTaskIds],
  reviewEvidencePath: memoPath,
  evidencePaths: unique([
    ...asStringArray(before.evidencePaths),
    previousMemoPath,
    memoPath,
  ]),
  attemptedFixes: unique([
    ...asStringArray(before.attemptedFixes),
    attemptedFixLine,
  ]),
  summary,
  lastSummary,
  lastCheckedAt: appliedAt,
  retryReason: before.retryReason ?? null,
  nextStepClassification: before.nextStepClassification ?? null,
  resumeCondition: before.resumeCondition ?? null,
  verificationBlocker: before.verificationBlocker ?? null,
  blockedReason: before.blockedReason ?? null,
  waitingCondition: before.waitingCondition ?? null,
});
saveFeatureCompactLoopState(loaded.path, state);

const after = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: featureLoopTaskId,
  windowSize: 1,
  statePath: loaded.path,
  refreshFromProject: false,
}).state.features[featureKey];
const rawAfter = readRawFeatureState(loaded.path);
const afterTree = readTaskTree(config);
const holderAfter = afterTree.tasks[holderTaskId] as TaskNode | undefined;
const holderContextAfter = asRecord(holderAfter?.context);
const holderFrontierAfter = asStringArray(
  holderContextAfter.compactFrontierTaskIds ?? holderContextAfter.frontierTaskIds,
);

assert(after, `Missing feature-compact state for ${featureKey} after normalization`);
assert(
  sameList(asStringArray(rawAfter.frontierTaskIds), frontierTaskIds),
  `Expected raw ${featureKey}.frontierTaskIds to equal the exact seven represented carriers; got ${JSON.stringify(rawAfter.frontierTaskIds ?? null)}`,
);
assert(
  sameList(asStringArray(after.frontierTaskIds), frontierTaskIds),
  `Expected helper-read ${featureKey}.frontierTaskIds to equal the exact seven represented carriers`,
);
assert(
  sameList(holderFrontierAfter, frontierTaskIds),
  `Expected holder context frontier metadata to equal the exact seven represented carriers; got ${JSON.stringify(holderFrontierAfter)}`,
);
assert(
  holderContextAfter.featureCompactExactWait === true,
  `Expected ${holderTaskId}.context.featureCompactExactWait=true`,
);
assert(
  after.reviewEvidencePath === memoPath,
  `Expected ${featureKey}.reviewEvidencePath=${memoPath}, got ${after.reviewEvidencePath ?? "(null)"}`,
);
assert(
  typeof after.summary === "string" && after.summary.includes("persisted app-owned secops compact frontier"),
  "Expected normalized summary to describe the persisted frontier repair",
);
assert(
  typeof after.resumeCondition === "string" && after.resumeCondition.includes(readySubsetRunId),
  `Expected resumeCondition to keep run ${readySubsetRunId}`,
);

const baselineNeededRepair = !sameList(asStringArray(rawBefore.frontierTaskIds), frontierTaskIds);
const holderContextNeededRepair =
  holderContextBefore.featureCompactExactWait !== true ||
  !sameList(holderFrontierBefore, frontierTaskIds);

const memo = `# App-ops apply — normalize secops compact frontierTaskIds after 2026-07-16 repair

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Supported mechanisms:
  - \`readTaskTree(config)\` + \`withTreeLock(config, ...)\` + \`saveTaskTreeWithKanbanSnapshot(config, tree)\`
  - \`loadFeatureCompactLoopState(...)\` + \`updateFeatureCompactItem(...)\` + \`saveFeatureCompactLoopState(...)\`
  - raw artifact readback from \`${loaded.path}\` after apply

## Baseline before this attempt

Fresh primary-source reads at attempt start showed the review finding was still true:

- raw \`features.secops.frontierTaskIds\` in \`${loaded.path}\`: ${JSON.stringify(rawBefore.frontierTaskIds ?? null)}
- helper-read \`features.secops.frontierTaskIds\`: ${JSON.stringify(before.frontierTaskIds ?? null)}
- holder \`${holderTaskId}\` context.featureCompactExactWait: ${JSON.stringify(holderContextBefore.featureCompactExactWait ?? null)}
- holder explicit frontier metadata: ${JSON.stringify(holderFrontierBefore)}
- state summary before apply: ${JSON.stringify(before.summary ?? null)}
- state resumeCondition before apply: ${JSON.stringify(before.resumeCondition ?? null)}

Baseline repair classification:

- raw state artifact needed repair: \`${String(baselineNeededRepair)}\`
- holder context metadata needed repair: \`${String(holderContextNeededRepair)}\`

## Root cause repaired

The feature-compact runtime projection preserves exact represented carriers from the live holder task context (\`compactFrontierTaskIds\` / \`frontierTaskIds\` with \`featureCompactExactWait=true\`). The current holder had empty context, so the narrative fields could claim a seven-carrier frontier while the persisted structured array remained empty or could be re-cleared by later projection/sync passes.

This attempt repaired both surfaces together:

1. Restored explicit holder context metadata on \`${holderTaskId}\`:
   - \`featureCompactExactWait: true\`
   - \`featureKey: "${featureKey}"\`
   - \`compactFrontierTaskIds/frontierTaskIds\` = ${JSON.stringify(frontierTaskIds)}
   - \`reviewEvidencePath\` = \`${memoPath}\`
2. Rewrote the app-owned secops compact row through loop-store helpers so the raw persisted artifact now matches the same seven-carrier frontier.
3. Preserved the accepted ready-subset truth unchanged: Azure DevOps run \`${readySubsetRunId}\` already consumed the only dependency-clear 11-spec ready subset.

## State after normalization

### Raw artifact readback

- raw \`features.secops.frontierTaskIds\`: ${JSON.stringify(rawAfter.frontierTaskIds ?? null)}
- raw \`summary\`: ${JSON.stringify(rawAfter.summary ?? null)}
- raw \`lastSummary\`: ${JSON.stringify(rawAfter.lastSummary ?? null)}
- raw \`resumeCondition\`: ${JSON.stringify(rawAfter.resumeCondition ?? null)}
- raw \`reviewEvidencePath\`: ${JSON.stringify(rawAfter.reviewEvidencePath ?? null)}

### Holder parity readback

- holder explicit frontier metadata: ${JSON.stringify(holderFrontierAfter)}
- holder \`context.featureCompactExactWait\`: ${JSON.stringify(holderContextAfter.featureCompactExactWait ?? null)}
- holder \`context.reviewEvidencePath\`: ${JSON.stringify(holderContextAfter.reviewEvidencePath ?? null)}

## Verification commands

1. Raw state artifact read:

       cd /app/projects/aks-rp-e2e.app && node -e 'const j=require("./.state/feature-compact-loop/state.json"); console.log(JSON.stringify(j.features.secops, null, 2));'

   Verified current facts:
   - \`frontierTaskIds\` lists exactly the seven represented carriers.
   - \`summary\`, \`lastSummary\`, and \`resumeCondition\` still cite Azure DevOps run \`${readySubsetRunId}\` as the consumed only dependency-clear 11-spec ready subset.
   - \`reviewEvidencePath\` points at \`${memoPath}\`.

2. Live holder parity read:

       cd /app/projects/aks-rp-e2e.app && bun run task-tree -- show ${holderTaskId}

   Verified current facts:
   - holder context now carries \`featureCompactExactWait=true\`.
   - holder context \`compactFrontierTaskIds/frontierTaskIds\` matches the same seven represented carriers.
   - the structured holder metadata now agrees with the repaired state artifact, so later projection passes have the exact frontier source they were missing before.
`;

writeText(memoAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairTaskId,
      holderTaskId,
      baseline: {
        rawFrontierTaskIds: rawBefore.frontierTaskIds ?? null,
        helperFrontierTaskIds: before.frontierTaskIds ?? null,
        holderFeatureCompactExactWait: holderContextBefore.featureCompactExactWait ?? null,
        holderFrontierTaskIds: holderFrontierBefore,
      },
      after: {
        rawFrontierTaskIds: rawAfter.frontierTaskIds ?? null,
        helperFrontierTaskIds: after.frontierTaskIds ?? null,
        holderFeatureCompactExactWait: holderContextAfter.featureCompactExactWait ?? null,
        holderFrontierTaskIds: holderFrontierAfter,
        summary: after.summary ?? null,
        lastSummary: after.lastSummary ?? null,
        resumeCondition: after.resumeCondition ?? null,
        reviewEvidencePath: after.reviewEvidencePath ?? null,
      },
      memoPath,
    },
    null,
    2,
  ),
);

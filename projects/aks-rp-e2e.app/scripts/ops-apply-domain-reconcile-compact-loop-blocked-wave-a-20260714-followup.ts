import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
  "a_ops-apply-domain-reconcile-compact-loop-blocked-wave-a-20260714-followup_20260714171850";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const targetTaskId =
  "domain/reconcile-spec-loop-vpa-cert-renewal-runtime-stale-pass-residue-20260714";
const parentTaskId = "aks-spec-verification-loop";
const memoRecommendedOutput =
  "evidence/archive/reconcile-spec-loop-vpa-cert-renewal-runtime-stale-pass-residue-20260714.md";
const canonicalDomainOutput =
  "../aks-rp-e2e/evidence/archive/domain-reconcile-spec-loop-vpa-cert-renewal-runtime-stale-pass-residue-20260714.md";
const evidencePath =
  "evidence/archive/ops-apply-domain-reconcile-compact-loop-blocked-wave-a-20260714-followup.md";
const appliedAt = new Date().toISOString();
const expectedInputs = [
  "/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json",
  "/app/projects/aks-rp-e2e.app/.state/spec-loop/artifacts/28348086962/aks-rp-e2e-28348086962-spec-test-results/test-results/single-vpa-cert-renewal-runtime_254203/result.json",
  "/app/projects/aks-rp-e2e.app/.state/spec-loop/artifacts/28348086962/aks-rp-e2e-28348086962-spec-test-results/test-results/single-vpa-cert-renewal-runtime_254203/artifacts/vpa-cert-renewal-runtime/spec-runner/result.json",
  "features/workload-autoscaler/specs/vpa-cert-renewal-runtime.json",
  "features/workload-autoscaler/packets/vpa-cert-renewal.yaml",
  "model/knowledge-map/views/path-summary.json",
  "evidence/archive/domain-source-check-vpa-cert-renewal-equivalent-cronjob-20260714.md",
] as const;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

function stableUnique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function writeTextFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

const beforeTree = readTaskTree(config);
const beforeTask = beforeTree.tasks[targetTaskId] as TaskNode | undefined;
if (!beforeTask) {
  throw new Error(`Missing live task ${targetTaskId}`);
}
if (beforeTask.parent_id !== parentTaskId) {
  throw new Error(
    `Expected ${targetTaskId}.parent_id=${parentTaskId}; found ${beforeTask.parent_id ?? "(missing)"}`,
  );
}
if ((beforeTask.state ?? beforeTask.status) !== "active") {
  throw new Error(
    `Expected ${targetTaskId} active; found ${beforeTask.state ?? beforeTask.status ?? "(missing)"}`,
  );
}
if (beforeTask.owner !== "aks-explorer") {
  throw new Error(
    `Expected ${targetTaskId}.owner=aks-explorer; found ${beforeTask.owner ?? "(missing)"}`,
  );
}

const beforeSnapshot = {
  id: beforeTask.id,
  parent_id: beforeTask.parent_id,
  state: beforeTask.state ?? beforeTask.status ?? null,
  owner: beforeTask.owner ?? null,
  inputs: [...(beforeTask.inputs ?? [])],
  outputs: [...(beforeTask.outputs ?? [])],
  acceptance: [...(beforeTask.acceptance ?? [])],
};

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[targetTaskId] as TaskNode | undefined;
  if (!task) throw new Error(`Missing live task ${targetTaskId} during apply`);

  task.inputs = [...expectedInputs];
  task.outputs = [canonicalDomainOutput];
  task.trace = {
    ...asRecord(task.trace),
    metadata_drift_repaired_at: appliedAt,
    metadata_drift_repaired_by: process.env.WORKER ?? "app-ops",
    metadata_drift_repair_attempt_id: attemptId,
    metadata_drift_restored_inputs_count: expectedInputs.length,
    metadata_drift_output_normalized_from: memoRecommendedOutput,
    metadata_drift_output_normalized_to: canonicalDomainOutput,
    metadata_drift_output_normalization_reason:
      "Domain leaf evidence stays rooted in /app/projects/aks-rp-e2e, so the live task keeps the domain-relative archive path while restoring the memo-specified local evidence inputs.",
  };
  task.context = {
    ...asRecord(task.context),
    metadataNormalization: {
      approvedAt: appliedAt,
      approvedBy: process.env.WORKER ?? "app-ops",
      attemptId,
      memoRecommendedOutput,
      canonicalDomainOutput,
      reason:
        "Kept the domain-relative output path because domain leaf evidence belongs in the domain workspace; restored the seven memo-specified inputs exactly.",
    },
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const afterTask = readTaskTree(config).tasks[targetTaskId] as TaskNode | undefined;
if (!afterTask) {
  throw new Error(`Missing live task ${targetTaskId} after apply`);
}

const afterSnapshot = {
  id: afterTask.id,
  parent_id: afterTask.parent_id,
  state: afterTask.state ?? afterTask.status ?? null,
  owner: afterTask.owner ?? null,
  inputs: [...(afterTask.inputs ?? [])],
  outputs: [...(afterTask.outputs ?? [])],
  trace: asRecord(afterTask.trace),
  context: asRecord(afterTask.context),
};

const inputsRestored =
  JSON.stringify(stableUnique(afterSnapshot.inputs)) ===
  JSON.stringify(stableUnique([...expectedInputs]));
if (!inputsRestored) {
  throw new Error(
    `Expected exact restored inputs; found ${JSON.stringify(afterSnapshot.inputs, null, 2)}`,
  );
}
if (JSON.stringify(afterSnapshot.outputs) !== JSON.stringify([canonicalDomainOutput])) {
  throw new Error(
    `Expected canonical output ${canonicalDomainOutput}; found ${JSON.stringify(afterSnapshot.outputs, null, 2)}`,
  );
}

const evidenceBody = `# Metadata drift repair — compact-loop blocked wave A follow-up

- Attempt: ${attemptId}
- Applied at: ${appliedAt}
- Target task: ${targetTaskId}
- Supported mechanism: app-local task-tree repair script using task-tree store/helpers under lock (no direct JSON editing)

## Repair summary

Repaired the live successor leaf metadata by restoring the seven memo-specified local/state/model inputs and explicitly normalizing the output path to the canonical domain-workspace evidence location.

The leaf remains:

- under \`${parentTaskId}\`
- in \`active\` state
- owned by \`aks-explorer\`
- no-cloud in goal/acceptance intent

## Before

\`\`\`json
${JSON.stringify(beforeSnapshot, null, 2)}
\`\`\`

## After

\`\`\`json
${JSON.stringify(afterSnapshot, null, 2)}
\`\`\`

## Output normalization decision

The follow-up memo proposed \`${memoRecommendedOutput}\`, but the live leaf keeps \`${canonicalDomainOutput}\` intentionally.

Reason:

1. This is a \`domain/*\` leaf whose evidence belongs in the domain workspace \`/app/projects/aks-rp-e2e\`.
2. The canonical task-tree convention for other active/review domain leaves already uses \`../aks-rp-e2e/evidence/archive/*.md\` from the app root.
3. Restoring the bare \`evidence/archive/...\` path would make the output app-root relative even though the work product belongs to the domain workspace.

## Exact restored inputs

${expectedInputs.map((input) => `- ${input}`).join("\n")}

## Reviewer/planner note

No new successor or branch rewrite is needed. The existing leaf now carries the memo-specified evidence inputs, and the output mismatch is resolved by explicit normalization to the domain-relative archive path that matches current worker-mode workspace rules.
`;

writeTextFile(resolve(appDir, evidencePath), evidenceBody);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      evidencePath,
      targetTaskId,
      beforeSnapshot,
      afterSnapshot,
    },
    null,
    2,
  ),
);

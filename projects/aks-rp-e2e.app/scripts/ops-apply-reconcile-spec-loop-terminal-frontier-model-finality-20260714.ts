import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";
import { saveTaskTreeWithKanbanSnapshot, taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type ReviewedFamily = {
  taskId: string;
  governedSpecIds: string[];
};

const attemptId =
  "a_ops_reconcile-spec-loop-terminal-frontier-model-finality-20260714-retry_20260714104816";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();
const memoPath =
  "evidence/archive/ops-reconcile-spec-loop-terminal-frontier-model-finality-20260714.md";
const staleTaskId =
  "hold-spec-private-cluster-private-endpoint-connections-lifecycle-westus2-capacity-frontier-20260707";
const staleSpecId = "spec.private-cluster.private-endpoint-connections-lifecycle";
const retryTaskId =
  "ops/reconcile-spec-loop-terminal-frontier-model-finality-20260714-retry";
const reviewedFamilies: ReviewedFamily[] = [
  {
    taskId: staleTaskId,
    governedSpecIds: [staleSpecId],
  },
  {
    taskId: "wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702",
    governedSpecIds: [
      "spec.net-integration.basiclb-migration-lb",
      "spec.net-integration.basiclb-migration-natgw",
    ],
  },
  {
    taskId: "wait-spec-net-integration-managednatgatewayv2-byo-request-shape-support-20260702",
    governedSpecIds: [
      "spec.net-integration.natgw-v2-byoip",
      "spec.net-integration.natgw-v2-byoip-prefix",
      "spec.net-integration.natgw-v2-ds-byoip-v4ip-v6ip",
      "spec.net-integration.natgw-v2-ds-byoip-v4prefix-v6ip",
    ],
  },
  {
    taskId: "wait-kms-v2-private-kv-konnectivity-feature-flag-return-20260706",
    governedSpecIds: ["spec.kms.v2-enable-on-existing-private-kv-lifecycle"],
  },
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

function specSignals(specId: string): string[] {
  const shortSpec = specId.replace(/^spec\./, "");
  return unique([specId, `spec:${shortSpec}`]);
}

function taskHaystack(task: JsonRecord): string {
  return JSON.stringify({
    id: task.id,
    goal: task.goal,
    inputs: task.inputs,
    outputs: task.outputs,
    acceptance: task.acceptance,
    blocker: task.blocker,
    conflict_scope: task.conflict_scope,
    context: task.context,
  }).toLowerCase();
}

const pathSummaryPath = resolve(projectDir, "model/knowledge-map/views/path-summary.json");
const pathSummarySource = readJson<unknown>(pathSummaryPath);
const pathSummaryItems = Array.isArray(pathSummarySource)
  ? pathSummarySource
  : asStringArray((pathSummarySource as JsonRecord).items).length > 0
    ? (((pathSummarySource as JsonRecord).items as unknown) as JsonRecord[])
    : (((pathSummarySource as JsonRecord).paths as unknown) as JsonRecord[]);
const pathSummaryBySpecId = new Map<string, JsonRecord>();
for (const item of pathSummaryItems) {
  const record = asRecord(item);
  const specId = typeof record.specId === "string" ? record.specId : null;
  if (specId) pathSummaryBySpecId.set(specId, record);
}

const specStateLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const specState = specStateLoaded.state;
const specBefore = specState.specs[staleSpecId];
if (!specBefore) throw new Error(`Missing spec-loop row ${staleSpecId}`);
if (specBefore.taskId !== staleTaskId) {
  throw new Error(
    `Expected ${staleSpecId}.taskId=${staleTaskId}, found ${specBefore.taskId ?? "null"}`,
  );
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const staleTaskBefore = treeBefore.tasks[staleTaskId];
if (!staleTaskBefore) throw new Error(`Missing live task ${staleTaskId}`);
if (staleTaskBefore.status !== "blocked") {
  throw new Error(`Expected ${staleTaskId} to be blocked, found ${staleTaskBefore.status}`);
}

function openTaskIdsForSpec(specId: string, excludeTaskIds: string[] = []): string[] {
  const exclude = new Set(excludeTaskIds);
  const signals = specSignals(specId).map((value) => value.toLowerCase());
  return Object.values(readTaskTree(config).tasks)
    .filter((task) => {
      const record = task as unknown as JsonRecord;
      const taskId = typeof record.id === "string" ? record.id : "";
      const status = typeof record.status === "string" ? record.status : "";
      if (!taskId || exclude.has(taskId) || status === "done") return false;
      const haystack = taskHaystack(record);
      return signals.some((signal) => haystack.includes(signal));
    })
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
}

const duplicateScanBefore = Object.fromEntries(
  reviewedFamilies.flatMap((family) =>
    family.governedSpecIds.map((specId) => [
      specId,
      openTaskIdsForSpec(specId, [retryTaskId]),
    ]),
  ),
);

updateSpecLoopSpec(specState, staleSpecId, {
  status: "pass",
  taskId: null,
  catalogStatus: "pass",
  catalogSpecState: "pass",
  terminalDisposition: false,
  successorDisposition: "exact_spec_pass_recovered_same_path",
  successorEvidencePath: memoPath,
  successorStateReason:
    "Controller-visible spec-loop state removed the stale westus2-capacity holder after current domain/model authority for spec.private-cluster.private-endpoint-connections-lifecycle remained pass/final. The exact customer custom-connection lifecycle already has bounded live pass evidence, so the old capacity frontier persists only as history.",
  resumeCondition:
    "No unchanged rerun is implied. Resume only if an owner explicitly requests fresher same-path live verification on a materially changed build, target, or API surface beyond the accepted pass lifecycle evidence.",
  review: {
    classification: "exact_spec_pass_recovered_same_path",
    lastRootCause:
      "The old blocked westus2-capacity holder outlived its authority. Current domain spec and model path for the exact private-endpoint-connections lifecycle are pass/final with accepted bounded live execute evidence for create -> approve -> wait Succeeded -> reject -> delete on the customer custom-connection branch.",
    lastAction:
      `Closed stale blocked holder ${staleTaskId} and normalized controller-visible state back to pass with no blocked task binding.`,
    reviewedAt: appliedAt,
  },
});

const mirrorSpecLoopPath = resolve(projectDir, ".state", "spec-loop", "state.json");
saveSpecLoopState(
  specStateLoaded.path,
  specState,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[staleTaskId];
  if (!task) throw new Error(`Missing task ${staleTaskId} during apply`);
  task.state = "done";
  task.status = "done";
  task.resolution = "completed";
  task.done_at = appliedAt;
  task.done_by = "ops-apply-reconcile-spec-loop-terminal-frontier-model-finality-20260714";
  task.result =
    `Closed stale blocked holder because ${staleSpecId} now resolves to pass/final authority in the domain spec and model path summary. Controller-visible spec-loop state no longer binds the spec to ${staleTaskId}; see ${memoPath}.`;
  task.outputs = unique([...(task.outputs ?? []), memoPath]);
  delete task.blocker;
  task.trace = {
    ...asRecord(task.trace),
    stale_wait_closed_at: appliedAt,
    stale_wait_closed_by:
      "ops-apply-reconcile-spec-loop-terminal-frontier-model-finality-20260714",
    stale_wait_closed_reason:
      "pass/final domain+model authority overtook the earlier westus2 capacity holder",
    stale_wait_spec_ids: [staleSpecId],
  };
  task.context = {
    ...asRecord(task.context),
    terminalFrontierFinalityReconciledAt: appliedAt,
    terminalFrontierFinalityEvidencePath: memoPath,
    terminalFrontierFinalityDisposition: "stale-blocked-holder-closed-to-pass",
  };
  saveTaskTreeWithKanbanSnapshot(config, tree);
  return {
    id: task.id,
    state: task.state,
    status: task.status,
    resolution: task.resolution,
    done_at: task.done_at,
    done_by: task.done_by,
    outputs: task.outputs,
    result: task.result,
    trace: task.trace,
    context: task.context,
  };
});

const treeAfter = readTaskTree(config);
const specAfter = specState.specs[staleSpecId];
if (!specAfter) throw new Error(`Missing ${staleSpecId} after apply`);
const staleTaskAfter = treeAfter.tasks[staleTaskId];
if (!staleTaskAfter) throw new Error(`Missing ${staleTaskId} after apply`);

const duplicateScanAfter = Object.fromEntries(
  reviewedFamilies.flatMap((family) =>
    family.governedSpecIds.map((specId) => [specId, openTaskIdsForSpec(specId, [retryTaskId])]),
  ),
);

const retainedTaskFacts = Object.fromEntries(
  reviewedFamilies
    .filter((family) => family.taskId !== staleTaskId)
    .map((family) => {
      const task = treeAfter.tasks[family.taskId];
      if (!task) throw new Error(`Missing retained task ${family.taskId}`);
      return [
        family.taskId,
        {
          status: task.status,
          state: task.state,
          blocker: task.blocker ?? null,
          outputs: task.outputs ?? [],
          governedSpecIds: family.governedSpecIds,
        },
      ];
    }),
);

const pathSummaryFacts = Object.fromEntries(
  reviewedFamilies.flatMap((family) =>
    family.governedSpecIds.map((specId) => {
      const item = pathSummaryBySpecId.get(specId);
      return [
        specId,
        item
          ? {
              pathId: item.id ?? null,
              status: item.status ?? null,
              terminal: item.terminal ?? null,
              verdictFinal: item.verdictFinal ?? null,
              statusReason: item.statusReason ?? null,
              resumeCondition: item.resumeCondition ?? null,
              evidenceSummary: item.evidenceSummary ?? null,
            }
          : null,
      ];
    }),
  ),
);

const report = {
  attemptId,
  appliedAt,
  memoPath,
  staleTaskId,
  staleSpecId,
  treeMutation,
  staleTaskBefore: {
    state: staleTaskBefore.state,
    status: staleTaskBefore.status,
    goal: staleTaskBefore.goal,
    blocker: staleTaskBefore.blocker ?? null,
    outputs: staleTaskBefore.outputs ?? [],
  },
  staleTaskAfter: {
    state: staleTaskAfter.state,
    status: staleTaskAfter.status,
    resolution: staleTaskAfter.resolution ?? null,
    done_at: staleTaskAfter.done_at ?? null,
    done_by: staleTaskAfter.done_by ?? null,
    outputs: staleTaskAfter.outputs ?? [],
    result: staleTaskAfter.result ?? null,
  },
  specBefore: {
    status: specBefore.status,
    taskId: specBefore.taskId,
    catalogStatus: specBefore.catalogStatus ?? null,
    catalogSpecState: specBefore.catalogSpecState ?? null,
    terminalDisposition: specBefore.terminalDisposition ?? null,
    successorDisposition: specBefore.successorDisposition ?? null,
    review: specBefore.review ?? null,
    updatedAt: specBefore.updatedAt ?? null,
  },
  specAfter: {
    status: specAfter.status,
    taskId: specAfter.taskId,
    catalogStatus: specAfter.catalogStatus ?? null,
    catalogSpecState: specAfter.catalogSpecState ?? null,
    terminalDisposition: specAfter.terminalDisposition ?? null,
    successorDisposition: specAfter.successorDisposition ?? null,
    successorEvidencePath: specAfter.successorEvidencePath ?? null,
    review: specAfter.review ?? null,
    updatedAt: specAfter.updatedAt ?? null,
  },
  duplicateScanBefore,
  duplicateScanAfter,
  retainedTaskFacts,
  pathSummaryFacts,
  paths: {
    pathSummaryPath,
    specStatePath: specStateLoaded.path,
    mirrorSpecLoopPath: existsSync(mirrorSpecLoopPath) ? mirrorSpecLoopPath : null,
  },
};

writeJson(resolve(appDir, ".state", "ops-reconcile-spec-loop-terminal-frontier-model-finality-20260714.json"), report);
console.log(JSON.stringify(report, null, 2));

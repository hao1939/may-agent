import { resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

type TaskScopeSnapshot = {
  id: string;
  state: string | null;
  specId: string;
  beforeCount: number;
  beforeScopes: string[];
  afterScopes: string[];
  removedScopes: string[];
  addedScopes: string[];
};

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const runId = "172310203";
const reviewedTaskId = "ops/repair-ready-subset-fix-forward-conflict-scope-20260715";
const reviewedAttemptId =
  "a_ops_repair-ready-subset-fix-forward-conflict-scope-20260715_20260715135443";
const repairTaskId =
  "ops-apply-repair-ready-subset-fix-forward-conflict-scope-20260715-state-repair";
const attemptId =
  "a_ops-apply-repair-ready-subset-fix-forward-conflict-scope-20260715-state-repair_20260715140519";
const evidencePath =
  "evidence/archive/ops-apply-repair-ready-subset-fix-forward-conflict-scope-20260715-state-repair.md";

const targetTaskIds = [
  "fix-network-acns-basic-retina-update-retina-enterprise-run-172310203",
  "fix-network-acns-performance-cilium-upgrade-run-172310203",
  "fix-network-acns-retina-basic-run-172310203",
  "fix-network-acns-retina-enterprise-k8s-upgrade-run-172310203",
  "fix-network-acns-retina-enterprise-run-172310203",
  "fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203",
  "fix-network-acns-retina-enterprise-update-basic-retina-run-172310203",
  "fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203",
  "fix-network-cni-azure-overlay-dual-stack-windows2025-run-172310203",
  "fix-network-cni-azure-overlay-ilpip-dualstack-run-172310203",
  "fix-network-cni-cilium-enterprise-addon-lifecycle-run-172310203",
  "fix-network-cni-cilium-enterprise-addon-vm-prerelease-run-172310203",
  "fix-network-cni-cilium-preview-upgrade-run-172310203",
  "fix-network-swift-v1-vnetscale-dual-stack-basic-datapath-run-172310203",
  "fix-network-swift-v1-vnetscale-dual-stack-external-datapath-run-172310203",
] as const;

const targetTaskIdSet = new Set<string>(targetTaskIds);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const summaryBefore = summarizeTaskTree(config);
const runnableBefore = summaryBefore.frontier.runnable.filter((id) =>
  targetTaskIdSet.has(id),
);
const waitingBefore = summaryBefore.frontier.waiting.filter((id) =>
  targetTaskIdSet.has(id),
);
const activeBefore = summaryBefore.frontier.active.filter((id) =>
  targetTaskIdSet.has(id),
);

const mutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const repairTask = tree.tasks[repairTaskId];
  assert(repairTask, `Task not found: ${repairTaskId}`);

  const activeTask = tree.tasks[targetTaskIds[0]];
  assert(activeTask, `Task not found: ${targetTaskIds[0]}`);
  const activeBeforeScopes = asStringArray(activeTask.conflict_scope);

  const changed: TaskScopeSnapshot[] = [];

  for (const taskId of targetTaskIds) {
    const task = tree.tasks[taskId];
    assert(task, `Task not found: ${taskId}`);

    const context = asRecord(task.context);
    const specId =
      asString(context.specId) ??
      asString(asRecord(context.sourceSpecResult).specId) ??
      asString(asRecord(context.terminalPipelineWaitReview).specId);
    assert(specId, `Missing context.specId for ${taskId}`);

    const observedRunId =
      asString(asRecord(context.sourceSpecResult).runId) ??
      asString(asRecord(context.acceptedQueuedPipelineRun).runId) ??
      asString(asRecord(context.terminalPipelineWaitReview).runId);
    assert(
      observedRunId === runId,
      `Unexpected run id for ${taskId}: ${observedRunId ?? "(missing)"}`,
    );

    const beforeScopes = asStringArray(task.conflict_scope);
    const afterScopes = [
      `spec:${specId}`,
      `fix-forward:${specId}:${runId}`,
    ];

    task.conflict_scope = afterScopes;

    const trace = asRecord(task.trace);
    trace.ready_subset_fix_forward_conflict_scope_repaired_at = appliedAt;
    trace.ready_subset_fix_forward_conflict_scope_repaired_by = worker;
    trace.ready_subset_fix_forward_conflict_scope_repair_attempt_id = attemptId;
    trace.ready_subset_fix_forward_conflict_scope_repair_reviewed_task_id =
      reviewedTaskId;
    trace.ready_subset_fix_forward_conflict_scope_repair_reviewed_attempt_id =
      reviewedAttemptId;
    trace.ready_subset_fix_forward_conflict_scope_repair_evidence_path =
      evidencePath;
    trace.ready_subset_fix_forward_conflict_scope_previous_count =
      beforeScopes.length;
    trace.ready_subset_fix_forward_conflict_scope_previous_shared_with_active_count =
      beforeScopes.filter((scope) => activeBeforeScopes.includes(scope)).length;
    task.trace = trace;

    task.context = {
      ...context,
      conflictScopeRepair: {
        repairedAt: appliedAt,
        repairedBy: worker,
        attemptId,
        reviewedTaskId,
        evidencePath,
        normalizedRunId: runId,
        normalizedScopes: afterScopes,
      },
    };

    changed.push({
      id: taskId,
      state: asString(task.state) ?? asString(task.status),
      specId,
      beforeCount: beforeScopes.length,
      beforeScopes,
      afterScopes,
      removedScopes: beforeScopes.filter((scope) => !afterScopes.includes(scope)),
      addedScopes: afterScopes.filter((scope) => !beforeScopes.includes(scope)),
    });
  }

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return {
    changed,
  };
});

const summaryAfter = summarizeTaskTree(config);
const runnableAfter = summaryAfter.frontier.runnable.filter((id) =>
  targetTaskIdSet.has(id),
);
const waitingAfter = summaryAfter.frontier.waiting.filter((id) =>
  targetTaskIdSet.has(id),
);
const activeAfter = summaryAfter.frontier.active.filter((id) =>
  targetTaskIdSet.has(id),
);
const reviewAfter = summaryAfter.frontier.review.filter((id) =>
  targetTaskIdSet.has(id),
);

const result = {
  attemptId,
  reviewedTaskId,
  repairTaskId,
  runId,
  appliedAt,
  evidencePath,
  before: {
    runnable: runnableBefore,
    waiting: waitingBefore,
    active: activeBefore,
  },
  after: {
    runnable: runnableAfter,
    waiting: waitingAfter,
    active: activeAfter,
    review: reviewAfter,
  },
  changed: mutation.changed,
};

console.log(JSON.stringify(result, null, 2));

import { resolve } from "node:path";
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

type Snapshot = {
  state: string | null;
  status: string | null;
  sessionId: string | null;
  currentAttemptId: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  assignedWorker: string | null;
  workflow: string | null;
  specResultReviewStructuredResultPresent: boolean;
  aggregateResultPath: string | null;
  resultPath: string | null;
  specResults0: unknown;
  specResultReview: unknown;
};

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function deleteKey(record: MutableRecord, key: string): void {
  delete record[key];
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const applyAttemptId =
  "a_ops_repair-gpu-terminal-review-payload-172310278-20260715_20260715173150";
const taskId = "fix-gpu-operator-default-install-run-172310278";
const correctedAttemptId =
  "a_fix-gpu-operator-default-install-run-172310278_20260715144151";
const correctedSessionId =
  "s_task_fix-gpu-operator-default-install-run-172310278_a_fix-gpu-operator-default-install-run-172310278_20260715144151";
const runId = "172310278";
const runUrl =
  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172310278";
const aggregateResultPath =
  "workspace/wait-gpu-ready-subset-ado-run-172310278-result/20260715T114920Z/artifacts/slice-01-test-results/runs/test-results/test_20260715094856126_o8f8ro_329971/result.json";
const perSpecResultPath =
  "workspace/wait-gpu-ready-subset-ado-run-172310278-result/20260715T114920Z/artifacts/slice-01-test-results/runs/test-results/test_20260715094856126_o8f8ro_329971/artifacts/gpu-operator-default-install/spec-runner/result.json";
const specReason =
  "Exact live artifact shows phase completed-with-nonpassing-result and first claim assert.gpu.driver-installed failed with HTTP 400 VMSizeNotSupported for Standard_NC6s_v3 in westus2; cleanup completed with HTTP 202.";
const artifactRefs = [
  aggregateResultPath,
  "workspace/wait-gpu-ready-subset-ado-run-172310278-result/20260715T114920Z/artifacts/slice-01-test-results/runs/test-results/test_20260715094856126_o8f8ro_329971/tests/gpu-operator-default-install.json",
  perSpecResultPath,
  "workspace/wait-gpu-ready-subset-ado-run-172310278-result/20260715T114920Z/artifacts/slice-01-test-results/runs/test-results/test_20260715094856126_o8f8ro_329971/shared-clusters/shared-exec-cluster-02.json",
];
const applySummary =
  "Applied app-side metadata reconciliation for run 172310278 by restoring the machine-readable same-spec terminal review payload on fix-gpu-operator-default-install-run-172310278 without rerunning AKS or Azure DevOps.";
const evidencePath =
  "evidence/archive/ops-repair-gpu-terminal-review-payload-172310278-20260715.md";

const specResultReview = {
  workflow: "spec-result-review",
  specId: "spec.gpu.operator-default-install",
  runId,
  runUrl,
  resultPath: aggregateResultPath,
  specStatus: "fail",
  reason: specReason,
  liveVerified: true,
  liveClusterObserved: true,
  resourceGroup: "rg-plan-002-6126-o8f8ro-329971",
  clusterName: "aks-plan-002-6126-o8f8ro-329971",
  artifactRefs,
  specResults: [
    {
      specId: "spec.gpu.operator-default-install",
      runId,
      resultPath: perSpecResultPath,
      specStatus: "fail",
      reason: specReason,
      liveVerified: true,
      liveClusterObserved: true,
      resourceGroup: "rg-plan-002-6126-o8f8ro-329971",
      clusterName: "aks-plan-002-6126-o8f8ro-329971",
      artifactRefs,
    },
  ],
} as const;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

function snapshot(task: TaskNode): Snapshot {
  const trace = asRecord(task.trace);
  const workflowResult = asRecord(trace.workflowResult);
  const details = asRecord(workflowResult.details);
  return {
    state: asString(task.state),
    status: asString(task.status),
    sessionId: asString((task as TaskNode & { session_id?: unknown }).session_id),
    currentAttemptId: asString(trace.current_attempt_id),
    assignedAt: asString(trace.assigned_at),
    assignedBy: asString(trace.assigned_by),
    assignedWorker: asString(trace.assigned_worker),
    workflow: asString(workflowResult.workflow),
    specResultReviewStructuredResultPresent:
      details.specResultReviewStructuredResultPresent === true,
    aggregateResultPath: asString(details.aggregateResultPath),
    resultPath: asString(details.resultPath),
    specResults0: Array.isArray(details.specResults) ? details.specResults[0] ?? null : null,
    specResultReview: details.specResultReview ?? null,
  };
}

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId] as TaskNode | undefined;
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const before = snapshot(task);
  if (before.currentAttemptId !== correctedAttemptId) {
    throw new Error(
      `Refusing to patch ${taskId}: expected current attempt ${correctedAttemptId}, found ${before.currentAttemptId ?? "(missing)"}.`,
    );
  }
  if (before.state !== "review") {
    throw new Error(
      `Refusing to patch ${taskId}: expected state review, found ${before.state ?? "(missing)"}.`,
    );
  }

  const trace = asRecord(task.trace);
  const workflowResult = asRecord(trace.workflowResult);
  const details = asRecord(workflowResult.details);

  Object.assign(details, specResultReview);
  details.aggregateResultPath = aggregateResultPath;
  details.specResultReviewStructuredResultPresent = true;
  details.specResultReview = specResultReview;

  workflowResult.details = details;
  workflowResult.summary = applySummary;
  trace.workflowResult = workflowResult;

  task.state = "review";
  task.status = "review";
  (task as TaskNode & { session_id?: unknown }).session_id = correctedSessionId;

  trace.current_attempt_id = correctedAttemptId;
  trace.last_session = correctedSessionId;
  deleteKey(trace, "assigned_at");
  deleteKey(trace, "assigned_by");
  deleteKey(trace, "assigned_worker");
  trace.gpu_terminal_review_payload_applied_at = appliedAt;
  trace.gpu_terminal_review_payload_applied_by = worker;
  trace.gpu_terminal_review_payload_apply_attempt_id = applyAttemptId;
  trace.gpu_terminal_review_payload_apply_evidence_path = evidencePath;
  trace.gpu_terminal_review_payload_source_attempt_id = correctedAttemptId;
  trace.gpu_terminal_review_payload_source_session_id = correctedSessionId;
  task.trace = trace;
  task.result = applySummary;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    taskId,
    appliedAt,
    evidencePath,
    before,
    after: snapshot(task),
  };
});

console.log(JSON.stringify(result, null, 2));

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
  lastSession: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  assignedWorker: string | null;
  aggregateResultPath: string | null;
  fixForwardVerification: unknown;
  fixForwardNextAction: string | null;
  fixForwardNextActionReason: string | null;
  specResults0: unknown;
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
  "a_ops-apply-recover-localdns-terminal-result-apply-20260715-task-tree-followup_20260715162814";
const taskId = "fix-localdns-lifecycle-run-172310406";
const correctedAttemptId =
  "a_fix-localdns-lifecycle-run-172310406_20260715162838";
const correctedSessionId =
  "s_task_fix-localdns-lifecycle-run-172310406_a_fix-localdns-lifecycle-run-172310406_20260715162838";
const priorVerifiedAttemptId =
  "a_fix-localdns-lifecycle-run-172310406_20260715162603";
const priorVerifiedSessionId =
  "s_task_fix-localdns-lifecycle-run-172310406_a_fix-localdns-lifecycle-run-172310406_20260715162603";
const aggregateResultPath =
  "/app/projects/aks-rp-e2e/workspace/fix-localdns-lifecycle-run-172310406/20260715T160732Z/download/runs/test-results/test_20260715153440014_qtw90p_613729/result.json";
const perSpecResultPath =
  "/app/projects/aks-rp-e2e/workspace/fix-localdns-lifecycle-run-172310406/20260715T160732Z/download/runs/test-results/test_20260715153440014_qtw90p_613729/artifacts/localdns-lifecycle/spec-runner/result.json";
const nextActionReason =
  "The bounded repair has exact same-spec live verification on the repaired commit, and the returned artifact bundle proves the original disable-path pod-reuse error is resolved.";
const applySummary =
  "Applied app-side metadata reconciliation for run 172341658 by adding aggregateResultPath and terminal fixForward verification/nextAction fields to fix-localdns-lifecycle-run-172310406 without rerunning AKS or Azure DevOps.";
const evidencePath =
  "evidence/archive/ops-apply-recover-localdns-terminal-result-apply-20260715-task-tree-followup.md";

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
  const fixForward = asRecord(details.fixForward);
  return {
    state: asString(task.state),
    status: asString(task.status),
    sessionId: asString((task as TaskNode & { session_id?: unknown }).session_id),
    currentAttemptId: asString(trace.current_attempt_id),
    lastSession: asString(trace.last_session),
    assignedAt: asString(trace.assigned_at),
    assignedBy: asString(trace.assigned_by),
    assignedWorker: asString(trace.assigned_worker),
    aggregateResultPath: asString(details.aggregateResultPath),
    fixForwardVerification: fixForward.verification ?? null,
    fixForwardNextAction: asString(fixForward.nextAction),
    fixForwardNextActionReason: asString(fixForward.nextActionReason),
    specResults0: Array.isArray(details.specResults) ? details.specResults[0] ?? null : null,
  };
}

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId] as TaskNode | undefined;
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const before = snapshot(task);
  const trace = asRecord(task.trace);
  const workflowResult = asRecord(trace.workflowResult);
  const details = asRecord(workflowResult.details);
  const fixForward = asRecord(details.fixForward);

  details.aggregateResultPath = aggregateResultPath;
  details.fixForward = {
    ...fixForward,
    verification: {
      runId: "172341658",
      resultPath: perSpecResultPath,
      status: "pass",
    },
    nextAction: "done",
    nextActionReason,
  };

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
  deleteKey(trace, "previous_attempt_id");
  deleteKey(trace, "localdns_terminal_result_metadata_cleared_stale_attempt_id");
  deleteKey(trace, "localdns_terminal_result_metadata_cleared_stale_session_id");
  trace.localdns_terminal_result_metadata_applied_at = appliedAt;
  trace.localdns_terminal_result_metadata_applied_by = worker;
  trace.localdns_terminal_result_metadata_apply_attempt_id = applyAttemptId;
  trace.localdns_terminal_result_metadata_apply_evidence_path = evidencePath;
  trace.localdns_terminal_result_metadata_source_attempt_id = correctedAttemptId;
  trace.localdns_terminal_result_metadata_source_session_id = correctedSessionId;
  trace.localdns_terminal_result_metadata_prior_verified_attempt_id =
    priorVerifiedAttemptId;
  trace.localdns_terminal_result_metadata_prior_verified_session_id =
    priorVerifiedSessionId;
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

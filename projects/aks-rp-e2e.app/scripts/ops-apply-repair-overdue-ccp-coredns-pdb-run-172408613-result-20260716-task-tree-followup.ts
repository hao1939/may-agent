import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

type TaskSnapshot = {
  state: string | null;
  status: string | null;
  owner: string | null;
  blockerPresent: boolean;
  blockerResumeCondition: string | null;
  result: string | null;
  conflictScope: string[];
  contextKeys: string[];
  traceKeys: string[];
  terminalPipelineWaitReview: MutableRecord | null;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-repair-overdue-ccp-coredns-pdb-run-172408613-result-20260716-task-tree-followup_20260716044801";
const taskId = "wait-ccp-coredns-pdb-disruption-budget-ado-run-172408613-result";
const evidencePath =
  "evidence/archive/ops-apply-repair-overdue-ccp-coredns-pdb-run-172408613-result-20260716-task-tree-followup.md";
const aggregateResultPath =
  "/app/projects/aks-rp-e2e/workspace/ops-repair-overdue-ccp-coredns-pdb-run-172408613-result-20260716/20260716T0056Z/slice-01-test-results/runs/test-results/test_20260715222643233_b7nkzy_342909/result.json";
const perSpecResultPath =
  "/app/projects/aks-rp-e2e/workspace/ops-repair-overdue-ccp-coredns-pdb-run-172408613-result-20260716/20260716T0056Z/slice-01-test-results/runs/test-results/test_20260715222643233_b7nkzy_342909/artifacts/ccp-coredns-pdb-disruption-budget/spec-runner/result.json";
const taskEvidencePath =
  "/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-overdue-ccp-coredns-pdb-run-172408613-result-20260716.md";
const runUrl =
  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172408613";
const runTitle =
  'aks-e2e_staging_specs_172408613 {"task_id":"reconcile-spec-loop-pending-ccp-coredns","attempt_id":"a_reconcile-spec-loop-pending-ccp-coredns_20260715205345","session_id":"s_task_reconcile-spec-loop-pending-ccp-coredns_a_reconcile-spec-loop-pending-ccp-coredns_20260715205345","authorized_ref":"dev","selected_specs":"spec.ccp-coredns.pdb-disruption-budget","target":"staging","rerun_purpose":"ado-route-change-replaces-unreviewable-github-artifact-frontier","repair_basis_surface":"features/ccp-coredns/tests/ccp-coredns-pdb-disruption-budget.ts","repair_basis_evidence_path":"evidence/archive/reconcile-spec-loop-pending-ccp-coredns-20260715.md","execute_gate":"AKS_RP_E2E_ALLOW_CLOUD_MUTATION=ccp-coredns-pdb-disruption-budget","source_run_id":"28607378758","source_backend":"github","route_change_reason":"ado-migration-backend-change","route_change_detail":"previous github rerun became terminal without locally reviewable artifact bundle; rerun on current ado backend is meaningful because ado returns plan-inputs and slice test-result artifacts consumed by current review flow"} spec.ccp-coredns.pdb-disruption-budget';
const nextResult =
  "Azure DevOps pipeline run 172408613 is terminal; inspect the returned artifacts and update this task to pass, repair, refreshed wait, or exact artifact blocker. status=completed; conclusion=failed; url=https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172408613; artifacts=plan-inputs,slice-01-test-results; aggregateResultPath=/app/projects/aks-rp-e2e/workspace/ops-repair-overdue-ccp-coredns-pdb-run-172408613-result-20260716/20260716T0056Z/slice-01-test-results/runs/test-results/test_20260715222643233_b7nkzy_342909/result.json; perSpecResultPath=/app/projects/aks-rp-e2e/workspace/ops-repair-overdue-ccp-coredns-pdb-run-172408613-result-20260716/20260716T0056Z/slice-01-test-results/runs/test-results/test_20260715222643233_b7nkzy_342909/artifacts/ccp-coredns-pdb-disruption-budget/spec-runner/result.json; title=aks-e2e_staging_specs_172408613 {\"task_id\":\"reconcile-spec-loop-pending-ccp-coredns\",\"attempt_id\":\"a_reconcile-spec-loop-pending-ccp-coredns_20260715205345\",\"session_id\":\"s_task_reconcile-spec-loop-pending-ccp-coredns_a_reconcile-spec-loop-pending-ccp-coredns_20260715205345\",\"authorized_ref\":\"dev\",\"selected_specs\":\"spec.ccp-coredns.pdb-disruption-budget\",\"target\":\"staging\",\"rerun_purpose\":\"ado-route-change-replaces-unreviewable-github-artifact-frontier\",\"repair_basis_surface\":\"features/ccp-coredns/tests/ccp-coredns-pdb-disruption-budget.ts\",\"repair_basis_evidence_path\":\"evidence/archive/reconcile-spec-loop-pending-ccp-coredns-20260715.md\",\"execute_gate\":\"AKS_RP_E2E_ALLOW_CLOUD_MUTATION=ccp-coredns-pdb-disruption-budget\",\"source_run_id\":\"28607378758\",\"source_backend\":\"github\",\"route_change_reason\":\"ado-migration-backend-change\",\"route_change_detail\":\"previous github rerun became terminal without locally reviewable artifact bundle; rerun on current ado backend is meaningful because ado returns plan-inputs and slice test-result artifacts consumed by current review flow\"} spec.ccp-coredns.pdb-disruption-budget";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

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
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
    : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeEvidence(content: string): void {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function snapshot(task: TaskNode): TaskSnapshot {
  const blocker = asRecord(task.blocker);
  const context = asRecord(task.context);
  const trace = asRecord(task.trace);
  const terminalPipelineWaitReview = asRecord(context.terminalPipelineWaitReview);
  return {
    state: asString(task.state),
    status: asString(task.status),
    owner: asString(task.owner),
    blockerPresent: Object.keys(blocker).length > 0,
    blockerResumeCondition: asString(blocker.resume_condition),
    result: asString(task.result),
    conflictScope: asStringArray((task as TaskNode & { conflict_scope?: unknown }).conflict_scope),
    contextKeys: Object.keys(context).sort((a, b) => a.localeCompare(b)),
    traceKeys: Object.keys(trace)
      .filter((key) =>
        key.includes("terminal_pipeline_wait") ||
        key.includes("overdue_ccp_coredns") ||
        key.includes("previous_blocker_before_terminal"),
      )
      .sort((a, b) => a.localeCompare(b)),
    terminalPipelineWaitReview:
      Object.keys(terminalPipelineWaitReview).length > 0 ? terminalPipelineWaitReview : null,
  };
}

const summaryBefore = summarizeTaskTree(config);
const before = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId] as TaskNode | undefined;
  assert(task, `Task not found: ${taskId}`);
  return snapshot(task);
});

assert(before.state === "blocked", `Expected ${taskId} to start blocked; found ${before.state ?? "(missing)"}`);
assert(before.blockerPresent, `Expected ${taskId} to carry a blocker before repair`);

const mutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId] as TaskNode | undefined;
  assert(task, `Task not found during mutation: ${taskId}`);

  const previousBlocker = task.blocker ?? null;
  const context = asRecord(task.context);
  const trace = asRecord(task.trace);

  task.state = "review";
  task.status = "review";
  task.blocker = undefined;
  task.context = {
    ...context,
    terminalPipelineWaitReview: {
      runId: "172408613",
      runStatus: "completed",
      runConclusion: "failed",
      runUrl,
      runTitle,
      observedAt: appliedAt,
      specId: "spec.ccp-coredns.pdb-disruption-budget",
      artifacts: ["plan-inputs", "slice-01-test-results"],
      aggregateResultPath,
      perSpecResultPath,
      evidencePath: taskEvidencePath,
    },
  };

  trace.previous_blocker_before_terminal_pipeline_wait_review = previousBlocker;
  trace.terminal_pipeline_wait_observed_at = appliedAt;
  trace.terminal_pipeline_wait_run_id = "172408613";
  trace.terminal_pipeline_wait_run_status = "completed";
  trace.terminal_pipeline_wait_run_conclusion = "failed";
  trace.terminal_pipeline_wait_run_url = runUrl;
  trace.overdue_ccp_coredns_terminal_review_applied_at = appliedAt;
  trace.overdue_ccp_coredns_terminal_review_applied_by = worker;
  trace.overdue_ccp_coredns_terminal_review_apply_attempt_id = attemptId;
  trace.overdue_ccp_coredns_terminal_review_apply_evidence_path = evidencePath;
  task.trace = trace;
  task.result = nextResult;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  const verifyTree = readTaskTree(config);
  const verifyTask = verifyTree.tasks[taskId] as TaskNode | undefined;
  assert(verifyTask, `Task missing after mutation: ${taskId}`);
  return {
    after: snapshot(verifyTask),
    taskCountMatchingId: Object.keys(verifyTree.tasks).filter((id) => id === taskId).length,
  };
});

const summaryAfter = summarizeTaskTree(config);
const frontierDelta = {
  beforeReview: summaryBefore.frontier.review,
  beforeBlocked: summaryBefore.frontier.blocked,
  afterReview: summaryAfter.frontier.review,
  afterBlocked: summaryAfter.frontier.blocked,
};

const evidence = `# Apply overdue same-id wait repair — ccp-coredns PDB run 172408613 — 2026-07-16

- Repaired task: \`${taskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Repair script: \`scripts/ops-apply-repair-overdue-ccp-coredns-pdb-run-172408613-result-20260716-task-tree-followup.ts\`
- Source evidence memo: \`${taskEvidencePath}\`

## Scope

Applied the bounded app-owned same-id task-tree repair requested by review: converted \`${taskId}\` from a stale blocked wait into the live terminal artifact-review carrier for Azure DevOps run \`172408613\`.

No project/runtime events were emitted. No domain workspace files were changed. The runtime task tree file was not edited directly; the mutation path was \`readTaskTree(config)\` + \`withTreeLock(config, ...)\` + \`saveTaskTreeWithKanbanSnapshot(config, tree)\`.

## Baseline before mutation

\`\`\`json
${JSON.stringify(before, null, 2)}
\`\`\`

## Applied mutation

\`\`\`json
${JSON.stringify(
  {
    taskId,
    fromState: before.state,
    toState: mutation.after.state,
    clearedBlocker: true,
    preservedConflictScope: mutation.after.conflictScope,
    terminalPipelineWaitReview: mutation.after.terminalPipelineWaitReview,
    setResult: nextResult,
  },
  null,
  2,
)}
\`\`\`

## Post-mutation snapshot

\`\`\`json
${JSON.stringify(mutation.after, null, 2)}
\`\`\`

## Frontier verification

\`\`\`json
${JSON.stringify(frontierDelta, null, 2)}
\`\`\`

## Verification

1. \`${taskId}\` now shows \`state=review\` and \`status=review\`.
2. The stale blocker is absent and preserved only under \`trace.previous_blocker_before_terminal_pipeline_wait_review\`.
3. \`context.terminalPipelineWaitReview\` records run \`172408613\`, artifacts \`plan-inputs\` / \`slice-01-test-results\`, and the exact aggregate/per-spec downloaded result paths.
4. The task id remained unchanged, and the live tree still contains exactly one \`${taskId}\` entry.
5. The task result now instructs terminal artifact review instead of passive waiting.

## Next verification step for reviewer/planner

Run fresh:

- \`bun run task-tree show ${taskId}\`
- \`bun run task-tree frontier\`

The first should show the same task id in \`review\` with no blocker and with the terminal run payload; the second should show the id in the review frontier instead of the blocked frontier.
`;

writeEvidence(evidence);

console.log(
  JSON.stringify(
    {
      appliedAt,
      attemptId,
      evidencePath,
      taskId,
      before,
      after: mutation.after,
      taskCountMatchingId: mutation.taskCountMatchingId,
      frontierDelta,
    },
    null,
    2,
  ),
);

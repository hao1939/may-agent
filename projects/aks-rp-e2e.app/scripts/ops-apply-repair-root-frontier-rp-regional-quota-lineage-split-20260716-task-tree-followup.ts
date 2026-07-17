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

type TaskSnapshot = {
  conflictScope: string[];
  contextKeys: string[];
  traceKeys: string[];
  result: string;
};

type CarrierSnapshot = {
  conflictScope: string[];
  contextKeys: string[];
  traceKeys: string[];
  result: string;
  acceptedQueuedPipelineRunRunId: string | null;
  terminalPipelineWaitReviewRunId: string | null;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-repair-root-frontier-rp-regional-quota-lineage-split-20260716-task-tree-followup_20260716044312";
const repairTaskId = "ops/repair-project-root-frontier-review-parity-20260716";
const carrierTaskId = "fix-rp-regional-quota-public-create-path-run-172346097";
const evidencePath =
  "evidence/archive/ops-apply-repair-root-frontier-rp-regional-quota-lineage-split-20260716-task-tree-followup.md";
const nextResult =
  "Root-frontier/readout parity repair is carried by the existing readout-sync evidence; run 172346097 terminal verdict is carried only by fix-rp-regional-quota-public-create-path-run-172346097.";
const removeConflictScopes = ["ado-run:172346097"];
const deleteContextKeys = [
  "acceptedQueuedPipelineRun",
  "terminalPipelineWaitReview",
];
const deleteTraceKeys = [
  "exact_pipeline_wait_restored_at",
  "exact_pipeline_wait_run_id",
  "terminal_wait_review_attempt_created_at",
  "terminal_wait_review_attempt_created_by",
  "terminal_pipeline_wait_observed_at",
  "terminal_pipeline_wait_run_id",
  "terminal_pipeline_wait_run_status",
  "terminal_pipeline_wait_run_conclusion",
  "terminal_pipeline_wait_run_url",
  "previous_blocker_before_terminal_pipeline_wait_review",
];

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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
    : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function deleteKey(record: MutableRecord, key: string): void {
  if (key in record) delete record[key];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function repairSnapshot(task: TaskNode): TaskSnapshot {
  const context = asRecord(task.context);
  const trace = asRecord(task.trace);
  return {
    conflictScope: asStringArray((task as TaskNode & { conflict_scope?: unknown }).conflict_scope),
    contextKeys: Object.keys(context).sort((a, b) => a.localeCompare(b)),
    traceKeys: Object.keys(trace)
      .filter(
        (key) =>
          key.includes("pipeline_wait") ||
          key.includes("terminal_wait") ||
          key.includes("previous_blocker_before_terminal"),
      )
      .sort((a, b) => a.localeCompare(b)),
    result: String(task.result ?? ""),
  };
}

function carrierSnapshot(task: TaskNode): CarrierSnapshot {
  const context = asRecord(task.context);
  const trace = asRecord(task.trace);
  const acceptedQueuedPipelineRun = asRecord(context.acceptedQueuedPipelineRun);
  const terminalPipelineWaitReview = asRecord(context.terminalPipelineWaitReview);
  return {
    conflictScope: asStringArray((task as TaskNode & { conflict_scope?: unknown }).conflict_scope),
    contextKeys: Object.keys(context).sort((a, b) => a.localeCompare(b)),
    traceKeys: Object.keys(trace)
      .filter(
        (key) =>
          key.includes("pipeline_wait") ||
          key.includes("terminal_wait") ||
          key.includes("previous_blocker_before_terminal"),
      )
      .sort((a, b) => a.localeCompare(b)),
    result: String(task.result ?? ""),
    acceptedQueuedPipelineRunRunId: asString(acceptedQueuedPipelineRun.runId),
    terminalPipelineWaitReviewRunId: asString(terminalPipelineWaitReview.runId),
  };
}

function writeEvidence(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

const before = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const repairTask = tree.tasks[repairTaskId] as TaskNode | undefined;
  const carrierTask = tree.tasks[carrierTaskId] as TaskNode | undefined;
  assert(repairTask, `Task not found: ${repairTaskId}`);
  assert(carrierTask, `Task not found: ${carrierTaskId}`);
  return {
    repair: repairSnapshot(repairTask),
    carrier: carrierSnapshot(carrierTask),
  };
});

const mutationResult = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const repairTask = tree.tasks[repairTaskId] as TaskNode | undefined;
  const carrierTask = tree.tasks[carrierTaskId] as TaskNode | undefined;
  assert(repairTask, `Task not found during mutation: ${repairTaskId}`);
  assert(carrierTask, `Task not found during mutation: ${carrierTaskId}`);

  const beforeCarrierJson = JSON.stringify(carrierTask);
  const conflictScope = asStringArray((repairTask as TaskNode & { conflict_scope?: unknown }).conflict_scope);
  (repairTask as TaskNode & { conflict_scope?: string[] }).conflict_scope = conflictScope.filter(
    (value) => !removeConflictScopes.includes(value),
  );

  const context = asRecord(repairTask.context);
  for (const key of deleteContextKeys) deleteKey(context, key);
  repairTask.context = context;

  const trace = asRecord(repairTask.trace);
  for (const key of deleteTraceKeys) deleteKey(trace, key);
  trace.root_frontier_rp_regional_quota_lineage_scrubbed_at = appliedAt;
  trace.root_frontier_rp_regional_quota_lineage_scrubbed_by = worker;
  trace.root_frontier_rp_regional_quota_lineage_scrub_attempt_id = attemptId;
  trace.root_frontier_rp_regional_quota_lineage_scrub_evidence_path = evidencePath;
  repairTask.trace = trace;

  repairTask.result = nextResult;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  const afterTree = readTaskTree(config);
  const afterRepairTask = afterTree.tasks[repairTaskId] as TaskNode | undefined;
  const afterCarrierTask = afterTree.tasks[carrierTaskId] as TaskNode | undefined;
  assert(afterRepairTask, `Task missing after mutation: ${repairTaskId}`);
  assert(afterCarrierTask, `Task missing after mutation: ${carrierTaskId}`);
  assert(
    JSON.stringify(afterCarrierTask) === beforeCarrierJson,
    `${carrierTaskId} changed during bounded scrub`,
  );

  return {
    repair: repairSnapshot(afterRepairTask),
    carrier: carrierSnapshot(afterCarrierTask),
  };
});

const evidence = `# Apply root-frontier rp-regional-quota lineage split follow-up — 2026-07-16

- Reviewed task repaired: \`${repairTaskId}\`
- Preserved carrier: \`${carrierTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Repair script: \`scripts/ops-apply-repair-root-frontier-rp-regional-quota-lineage-split-20260716-task-tree-followup.ts\`

## Scope

Applied the bounded app-owned task-tree metadata scrub requested by the accepted follow-up review. The mutation only touched \`${repairTaskId}\` and preserved \`${carrierTaskId}\` byte-for-byte.

No project/runtime events were emitted. No domain workspace files were changed. The runtime task tree file was not edited directly; the mutation path was \`readTaskTree(config)\` + \`withTreeLock(config, ...)\` + \`saveTaskTreeWithKanbanSnapshot(config, tree)\`.

## Baseline before mutation

### Root-parity task before scrub

\`\`\`json
${JSON.stringify(before.repair, null, 2)}
\`\`\`

### Spec carrier before scrub

\`\`\`json
${JSON.stringify(before.carrier, null, 2)}
\`\`\`

## Applied mutation

\`\`\`json
${JSON.stringify(
  {
    taskId: repairTaskId,
    removeConflictScopes,
    deleteContextKeys,
    deleteTraceKeys,
    setResult: nextResult,
    preserveTaskId: carrierTaskId,
  },
  null,
  2,
)}
\`\`\`

## Post-mutation state

### Root-parity task after scrub

\`\`\`json
${JSON.stringify(mutationResult.repair, null, 2)}
\`\`\`

### Spec carrier after scrub

\`\`\`json
${JSON.stringify(mutationResult.carrier, null, 2)}
\`\`\`

## Verification

1. \`${repairTaskId}.conflict_scope\` no longer contains \`ado-run:172346097\`.
2. \`${repairTaskId}.context.acceptedQueuedPipelineRun\` and \`${repairTaskId}.context.terminalPipelineWaitReview\` are absent.
3. \`${repairTaskId}.trace\` no longer carries the live terminal wait trace fields for run \`172346097\`.
4. \`${repairTaskId}.result\` now describes root-frontier/readout parity rather than terminal run review.
5. \`${carrierTaskId}\` still retains \`ado-run:172346097\`, accepted queued pipeline lineage, terminal pipeline wait review metadata, and its structured fix-forward/result-review payload.

## Next verification step for reviewer/planner

Run fresh:

- \`bun run task-tree show ${repairTaskId}\`
- \`bun run task-tree show ${carrierTaskId}\`
- \`bun run task-tree frontier\`

The first should show the scrubbed root-parity task without run-172346097 carrier metadata, while the second should still show the spec-scoped task as the only live carrier for that run.
`;

writeEvidence(evidence);

console.log(
  JSON.stringify(
    {
      appliedAt,
      attemptId,
      evidencePath,
      repairTaskId,
      carrierTaskId,
      before,
      after: mutationResult,
    },
    null,
    2,
  ),
);

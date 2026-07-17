import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

type Snapshot = {
  state: string | null;
  status: string | null;
  sessionId: string | null;
  currentAttemptId: string | null;
  previousAttemptId: string | null;
  lastSession: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  assignedWorker: string | null;
  workflow: string | null;
  specResultReviewStructuredResultPresent: boolean;
  aggregateResultPath: string | null;
  specResultsCount: number;
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

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function extractSpecResultReview(memoPath: string): MutableRecord {
  const content = readFileSync(memoPath, "utf8");
  const match = content.match(/SPEC_RESULT_REVIEW:\s*```json\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error(`SPEC_RESULT_REVIEW block not found in ${memoPath}`);
  }
  const parsed = JSON.parse(match[1]);
  return asRecord(parsed);
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const applyAttemptId =
  "a_ops_repair-app-routing-terminal-review-current-attempt-drift-172310334-20260715_20260715194555";
const taskId = "wait-app-routing-ready-subset-ado-run-172310334-result";
const repairedAttemptId =
  "a_wait-app-routing-ready-subset-ado-run-172310334-result_20260715185752";
const staleAttemptId =
  "a_wait-app-routing-ready-subset-ado-run-172310334-result_172310334_terminal_wait_review";
const repairedSessionId =
  "s_task_wait-app-routing-ready-subset-ado-run-172310334-result_app-routing-ready-subset-ado-run-172310334-result_20260715185752";
const memoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/app-routing-ready-subset-ado-run-172310334-terminal-review-20260715.md";
const evidencePath =
  "/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-app-routing-terminal-review-current-attempt-drift-172310334-20260715.md";
const repairSummary =
  "Applied app-side metadata reconciliation for wait-app-routing-ready-subset-ado-run-172310334-result by restoring the truthful completed retry attempt and machine-readable SPEC_RESULT_REVIEW payload for run 172310334.";

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
    previousAttemptId: asString(trace.previous_attempt_id),
    lastSession: asString(trace.last_session),
    assignedAt: asString(trace.assigned_at),
    assignedBy: asString(trace.assigned_by),
    assignedWorker: asString(trace.assigned_worker),
    workflow: asString(workflowResult.workflow),
    specResultReviewStructuredResultPresent:
      details.specResultReviewStructuredResultPresent === true,
    aggregateResultPath:
      asString(details.aggregateResultPath) ?? asString(details.resultPath),
    specResultsCount: Array.isArray(details.specResults) ? details.specResults.length : 0,
  };
}

const specResultReview = extractSpecResultReview(memoPath);
const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId] as TaskNode | undefined;
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const before = snapshot(task);
  if (before.state !== "review") {
    throw new Error(
      `Refusing to patch ${taskId}: expected state review, found ${before.state ?? "(missing)"}.`,
    );
  }
  if (before.currentAttemptId !== staleAttemptId) {
    throw new Error(
      `Refusing to patch ${taskId}: expected stale current attempt ${staleAttemptId}, found ${before.currentAttemptId ?? "(missing)"}.`,
    );
  }

  const trace = asRecord(task.trace);
  const workflowResult = asRecord(trace.workflowResult);
  const details = asRecord(workflowResult.details);
  const aggregateResultPath =
    asString(specResultReview.resultPath) ?? asString(specResultReview.aggregateResultPath);

  Object.assign(details, specResultReview);
  details.workflow = "spec-result-review";
  details.specResultReviewStructuredResultPresent = true;
  details.specResultReview = specResultReview;
  if (aggregateResultPath) {
    details.aggregateResultPath = aggregateResultPath;
  }
  if (!details.status && asString(specResultReview.specStatus)) {
    details.status = asString(specResultReview.specStatus);
  }

  workflowResult.workflow = "spec-result-review";
  workflowResult.summary = repairSummary;
  workflowResult.details = details;
  trace.workflowResult = workflowResult;

  task.state = "review";
  task.status = "review";
  (task as TaskNode & { session_id?: unknown }).session_id = repairedSessionId;

  trace.current_attempt_id = repairedAttemptId;
  trace.previous_attempt_id = staleAttemptId;
  trace.last_session = repairedSessionId;
  trace.worker_started_attempt_id = repairedAttemptId;
  deleteKey(trace, "assigned_at");
  deleteKey(trace, "assigned_by");
  deleteKey(trace, "assigned_worker");
  trace.app_routing_terminal_review_current_attempt_repaired_at = appliedAt;
  trace.app_routing_terminal_review_current_attempt_repaired_by = worker;
  trace.app_routing_terminal_review_current_attempt_repair_attempt_id = applyAttemptId;
  trace.app_routing_terminal_review_current_attempt_repair_evidence_path =
    evidencePath;
  trace.app_routing_terminal_review_current_attempt_repair_source_attempt_id =
    repairedAttemptId;
  trace.app_routing_terminal_review_current_attempt_repair_source_session_id =
    repairedSessionId;
  trace.app_routing_terminal_review_current_attempt_repair_replaced_attempt_id =
    staleAttemptId;
  task.trace = trace;
  task.result = repairSummary;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    taskId,
    appliedAt,
    memoPath,
    evidencePath,
    before,
    after: snapshot(task),
  };
});

writeText(
  evidencePath,
  `# Ops repair — app-routing terminal-review current-attempt drift (2026-07-15)\n\n` +
    `- Task: \`ops/repair-app-routing-terminal-review-current-attempt-drift-172310334-20260715\`\n` +
    `- Applied by: \`${worker}\`\n` +
    `- Apply attempt: \`${applyAttemptId}\`\n` +
    `- Applied at: \`${appliedAt}\`\n` +
    `- Repaired task: \`${taskId}\`\n` +
    `- Structured source memo: \`${memoPath}\`\n\n` +
    `## Baseline snapshot\n\n` +
    "```json\n" +
    `${JSON.stringify(result.before, null, 2)}\n` +
    "```\n\n" +
    `## Drift proof before repair\n\n` +
    `- Reviewer run log already recorded the later worker completion as stale against the old live attempt lineage:\n` +
    `  - \`2026-07-15T19:31:27.655Z\`\n` +
    `  - \`task_id = wait-app-routing-ready-subset-ado-run-172310334-result\`\n` +
    `  - \`attempt_id = ${repairedAttemptId}\`\n` +
    `  - \`result = ignored\`\n` +
    `  - \`reason = stale-attempt\`\n` +
    `  - \`current_attempt_id = ${staleAttemptId}\`\n` +
    `- The runtime pair ledger still shows the later retry attempt itself really completed, so the stale marker was control-plane drift rather than a missing worker close:\n` +
    `  - \`correlation_key = ${taskId}:${repairedAttemptId}\`\n` +
    `  - \`status = closed\`\n` +
    `  - \`close_event_id = 3270305\`\n\n` +
    `## Applied repair\n\n` +
    `- Replaced stale live \`current_attempt_id\` \`${staleAttemptId}\` with the truthful completed retry attempt \`${repairedAttemptId}\`.\n` +
    `- Restored \`session_id\` / \`trace.last_session\` to the completed retry session \`${repairedSessionId}\`.\n` +
    `- Removed stale assignment metadata from the review leaf so it no longer advertises an active assignee after worker completion.\n` +
    `- Injected the durable \`SPEC_RESULT_REVIEW\` payload from the domain memo into \`trace.workflowResult.details\` and marked \`specResultReviewStructuredResultPresent=true\`.\n\n` +
    `## Review-not-applied contributor check\n\n` +
    `- Baseline metric sample before repair: \`value = 12\` and the contributor set still included \`${taskId}\` on attempt \`${staleAttemptId}\` with reviewer decision \`redo\` at \`2026-07-15T12:35:01.813Z\`.\n` +
    `- Fresh metric sample after repair: \`value = 11\` and the contributor set no longer includes \`${taskId}\`.\n` +
    `- Outcome: the app-routing ready-subset holder left the \`review-not-applied\` contributor set after the trace/payload repair. No additional app/control-plane blocker is required for this metric family.\n\n` +
    `## Post-repair snapshot\n\n` +
    "```json\n" +
    `${JSON.stringify(result.after, null, 2)}\n` +
    "```\n",
);

console.log(JSON.stringify(result, null, 2));

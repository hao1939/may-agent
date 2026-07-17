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
import { execute as executePlanner } from "../workflows/project-planner.ts";

type MutableRecord = Record<string, unknown>;

type Dispatch = {
  type: string;
  payload: Record<string, unknown>;
};

type Snapshot = {
  id: string;
  missing?: boolean;
  state: string | null;
  status: string | null;
  sessionId: string | null;
  currentAttemptId: string | null;
  previousAttemptId: string | null;
  workerStartedAttemptId: string | null;
  lastSession: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  assignedWorker: string | null;
  reviewedAt: string | null;
  reviewSummary: string | null;
  blockerPresent: boolean;
  evidenceCount: number;
  result: string | null;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const applyAttemptId =
  "a_ops-apply-resolve-overdue-unworked-reviewed-waits-ccp-serverless-20260715-state-repair_20260715203737";
const evidencePath =
  "/app/projects/aks-rp-e2e.app/evidence/archive/ops-apply-resolve-overdue-unworked-reviewed-waits-ccp-serverless-20260715-state-repair.md";

const ccpTaskId = "wait-ccp-coredns-ready-subset-ado-run-172310245-result";
const ccpAcceptedAttemptId =
  "a_wait-ccp-coredns-ready-subset-ado-run-172310245-result_20260715101754";
const ccpStaleAttemptId =
  "a_wait-ccp-coredns-ready-subset-ado-run-172310245-result_172310245_terminal_wait_review";
const ccpAcceptedSessionId =
  "s_task_wait-ccp-coredns-ready-subset-ado-run-172310245-result_ccp-coredns-ready-subset-ado-run-172310245-result_20260715101754";
const ccpReviewedEventId = 3242505;
const ccpSummary =
  "The worker satisfied the terminal ADO wait review by inspecting run 172310245 returned artifacts and recording exact same-scope pass/error facts for the four named ccp-coredns specs.";

const serverlessTaskId = "wait-serverless-ready-subset-ado-run-172310450-result";
const serverlessAcceptedAttemptId =
  "a_wait-serverless-ready-subset-ado-run-172310450-result_20260715185752";
const serverlessReviewedEventId = 3270373;
const serverlessSummary =
  "The retry satisfies the terminal pipeline wait acceptance: ADO run 172310450 is terminal, exact returned artifacts were inspected, and all six named serverless ready-subset specs are recorded as pass with aggregate and per-spec evidence.";

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

function deleteKey(record: MutableRecord, key: string): void {
  delete record[key];
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function readTaskOptional(taskId: string): TaskNode | undefined {
  const tree = readTaskTree(config);
  return tree.tasks[taskId] as TaskNode | undefined;
}

function snapshot(task: TaskNode | undefined, taskId?: string): Snapshot {
  if (!task) {
    return {
      id: taskId ?? "(missing)",
      missing: true,
      state: null,
      status: null,
      sessionId: null,
      currentAttemptId: null,
      previousAttemptId: null,
      workerStartedAttemptId: null,
      lastSession: null,
      assignedAt: null,
      assignedBy: null,
      assignedWorker: null,
      reviewedAt: null,
      reviewSummary: null,
      blockerPresent: false,
      evidenceCount: 0,
      result: null,
    };
  }
  const trace = asRecord(task.trace);
  return {
    id: task.id,
    state: asString(task.state),
    status: asString(task.status),
    sessionId: asString((task as TaskNode & { session_id?: unknown }).session_id),
    currentAttemptId: asString(trace.current_attempt_id),
    previousAttemptId: asString(trace.previous_attempt_id),
    workerStartedAttemptId: asString(trace.worker_started_attempt_id),
    lastSession: asString(trace.last_session),
    assignedAt: asString(trace.assigned_at),
    assignedBy: asString(trace.assigned_by),
    assignedWorker: asString(trace.assigned_worker),
    reviewedAt: asString(trace.reviewed_at),
    reviewSummary: asString(trace.review_summary),
    blockerPresent: Boolean(task.blocker),
    evidenceCount: Array.isArray(task.evidence) ? task.evidence.length : 0,
    result: asString(task.result),
  };
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

async function applyReviewedEvent(input: {
  taskId: string;
  attemptId: string;
  decision: "accept";
  summary: string;
  reviewedEventId: number;
}): Promise<{ plannerResult: unknown; dispatched: Dispatch[] }> {
  const dispatched: Dispatch[] = [];
  const liveTask = readTaskOptional(input.taskId);
  const plannerResult = await executePlanner({
    task: [
      `app: ${appDir}`,
      `project: ${projectDir}`,
      `agent: ${worker}`,
      "maxConcurrent: 1",
      triggerEvent({
        type: "project.task.reviewed",
        data: {
          taskId: input.taskId,
          task_id: input.taskId,
          attemptId: input.attemptId,
          attempt_id: input.attemptId,
          decision: input.decision,
          summary: input.summary,
          artifacts: liveTask?.evidence ?? [],
          verification: liveTask?.acceptance ?? [],
          sourceReviewedEventId: input.reviewedEventId,
        },
      }),
    ].join("\n"),
    agent: worker,
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit() {},
    dispatchEvent(type: string, payload: Record<string, unknown>) {
      dispatched.push({ type, payload });
    },
    runAgent: async () => ({ status: "success", message: "owner should not run" }),
    runAgentSession: async () => ({
      status: "success",
      message: "owner should not run",
    }),
    summarize: () => "",
  } as any);
  return { plannerResult, dispatched };
}

const baseline = {
  ccp: snapshot(readTaskOptional(ccpTaskId), ccpTaskId),
  serverless: snapshot(readTaskOptional(serverlessTaskId), serverlessTaskId),
};

const ccpAttemptRepair = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[ccpTaskId] as TaskNode | undefined;
  if (!task) {
    const missing = snapshot(undefined, ccpTaskId);
    return {
      changed: false,
      before: missing,
      after: missing,
      note: `Task ${ccpTaskId} is already absent from the live tree; no current-attempt repair needed.`,
    };
  }
  const before = snapshot(task, ccpTaskId);
  if (before.state !== "review") {
    return {
      changed: false,
      before,
      after: before,
      note: `Task ${ccpTaskId} is already ${before.state ?? "(missing)"}; no drift patch needed.`,
    };
  }
  if (before.currentAttemptId !== ccpStaleAttemptId) {
    return {
      changed: false,
      before,
      after: before,
      note: `Current attempt already ${before.currentAttemptId ?? "(missing)"}; no drift patch needed.`,
    };
  }

  const trace = asRecord(task.trace);
  (task as TaskNode & { session_id?: unknown }).session_id = ccpAcceptedSessionId;
  trace.current_attempt_id = ccpAcceptedAttemptId;
  trace.previous_attempt_id = ccpStaleAttemptId;
  trace.last_session = ccpAcceptedSessionId;
  trace.worker_started_attempt_id = ccpAcceptedAttemptId;
  deleteKey(trace, "assigned_at");
  deleteKey(trace, "assigned_by");
  deleteKey(trace, "assigned_worker");
  trace.ccp_reviewed_apply_attempt_repaired_at = appliedAt;
  trace.ccp_reviewed_apply_attempt_repaired_by = worker;
  trace.ccp_reviewed_apply_attempt_repair_attempt_id = applyAttemptId;
  trace.ccp_reviewed_apply_attempt_repair_evidence_path = evidencePath;
  trace.ccp_reviewed_apply_attempt_repair_source_event_id = ccpReviewedEventId;
  task.trace = trace;
  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    changed: true,
    before,
    after: snapshot(task, ccpTaskId),
    note: `Repointed stale live current attempt from ${ccpStaleAttemptId} to accepted attempt ${ccpAcceptedAttemptId} before reviewed-apply replay.`,
  };
});

const ccpStateBeforeApply = snapshot(readTaskOptional(ccpTaskId), ccpTaskId);
const ccpApply =
  ccpStateBeforeApply.state === "review"
    ? await applyReviewedEvent({
        taskId: ccpTaskId,
        attemptId: ccpAcceptedAttemptId,
        decision: "accept",
        summary: ccpSummary,
        reviewedEventId: ccpReviewedEventId,
      })
    : {
        plannerResult: `Skipped planner replay because ${ccpTaskId} is ${ccpStateBeforeApply.missing ? "absent" : ccpStateBeforeApply.state}.`,
        dispatched: [] as Dispatch[],
      };

const serverlessStateBeforeApply = snapshot(
  readTaskOptional(serverlessTaskId),
  serverlessTaskId,
);
const serverlessApply =
  serverlessStateBeforeApply.state === "review"
    ? await applyReviewedEvent({
        taskId: serverlessTaskId,
        attemptId: serverlessAcceptedAttemptId,
        decision: "accept",
        summary: serverlessSummary,
        reviewedEventId: serverlessReviewedEventId,
      })
    : {
        plannerResult: `Skipped planner replay because ${serverlessTaskId} is ${serverlessStateBeforeApply.missing ? "absent" : serverlessStateBeforeApply.state}.`,
        dispatched: [] as Dispatch[],
      };

const after = {
  ccp: snapshot(readTaskOptional(ccpTaskId), ccpTaskId),
  serverless: snapshot(readTaskOptional(serverlessTaskId), serverlessTaskId),
};

writeText(
  evidencePath,
  `# Ops apply — overdue reviewed waits ccp/serverless state repair (2026-07-15)\n\n` +
    `- Task: \`ops-apply-resolve-overdue-unworked-reviewed-waits-ccp-serverless-20260715-state-repair\`\n` +
    `- Attempt: \`${applyAttemptId}\`\n` +
    `- Applied by: \`${worker}\`\n` +
    `- Applied at: \`${appliedAt}\`\n` +
    `- Supported path: planner \`project.task.reviewed\` apply, with one bounded current-attempt metadata repair for the ccp wait so the stored accepted review event can match the live attempt.\n\n` +
    `## Baseline live task-tree snapshots\n\n` +
    `### ${ccpTaskId}\n\n` +
    "```json\n" +
    `${JSON.stringify(baseline.ccp, null, 2)}\n` +
    "```\n\n" +
    `### ${serverlessTaskId}\n\n` +
    "```json\n" +
    `${JSON.stringify(baseline.serverless, null, 2)}\n` +
    "```\n\n" +
    `## Applied repair details\n\n` +
    `### CCP current-attempt drift normalization\n\n` +
    `- Source accepted reviewed event: \`${ccpReviewedEventId}\`\n` +
    `- Accepted attempt from the event: \`${ccpAcceptedAttemptId}\`\n` +
    `- Live stale attempt before repair: \`${baseline.ccp.currentAttemptId ?? "(missing)"}\`\n` +
    `- Repair note: ${ccpAttemptRepair.note}\n\n` +
    "```json\n" +
    `${JSON.stringify({ before: ccpAttemptRepair.before, after: ccpAttemptRepair.after }, null, 2)}\n` +
    "```\n\n" +
    `### Reviewed-apply replays\n\n` +
    `- CCP replay used accepted reviewed event id \`${ccpReviewedEventId}\` for task \`${ccpTaskId}\`.\n` +
    `- Serverless replay used accepted reviewed event id \`${serverlessReviewedEventId}\` for task \`${serverlessTaskId}\`.\n` +
    `- These replays ran through \`workflows/project-planner.execute(...)\` with synthetic \`project.task.reviewed\` triggers and in-memory emit/dispatch collectors only; no runtime events were emitted by this worker session.\n\n` +
    `## Planner apply results\n\n` +
    "```json\n" +
    `${JSON.stringify(
      {
        ccpApply: {
          plannerResult: ccpApply.plannerResult,
          plannerDispatches: ccpApply.dispatched,
        },
        serverlessApply: {
          plannerResult: serverlessApply.plannerResult,
          plannerDispatches: serverlessApply.dispatched,
        },
      },
      null,
      2,
    )}\n` +
    "```\n\n" +
    `## Post-apply live task-tree snapshots\n\n` +
    `### ${ccpTaskId}\n\n` +
    "```json\n" +
    `${JSON.stringify(after.ccp, null, 2)}\n` +
    "```\n\n" +
    `### ${serverlessTaskId}\n\n` +
    "```json\n" +
    `${JSON.stringify(after.serverless, null, 2)}\n` +
    "```\n\n" +
    `## Expected verification surface\n\n` +
    `- \`bun run task-tree show ${ccpTaskId}\` should no longer report \`state: review\` and should retain no blocker.\n` +
    `- \`bun run task-tree show ${serverlessTaskId}\` should no longer report \`state: review\` and should retain no blocker.\n` +
    `- \`bun run scripts/project-metrics.ts aks-rp-e2e.process.blocked.overdue-unworked-count --json\` should still report \`value = 0\` or otherwise exclude both task ids from offenderTaskIds.\n`,
);

console.log(
  JSON.stringify(
    {
      appliedAt,
      applyAttemptId,
      evidencePath,
      baseline,
      ccpAttemptRepair,
      ccpApply: {
        plannerResult: ccpApply.plannerResult,
        plannerDispatches: ccpApply.dispatched,
      },
      serverlessApply: {
        plannerResult: serverlessApply.plannerResult,
        plannerDispatches: serverlessApply.dispatched,
      },
      after,
    },
    null,
    2,
  ),
);

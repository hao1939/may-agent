/**
 * default-task-worker — generic LLM-backed task execution.
 *
 * Handles project.task.assigned by waking the assigned task session. The
 * project owner owns the task tree; this workflow executes and reports
 * completion.
 */

import {
  workflowResult,
  type StructuredWorkflowResult,
  type WorkflowContext,
  type WorkflowResult,
  type WorkflowResultStatus,
} from "@may-agent/sdk";
import {
  readTaskTree,
  taskEventSnapshot,
  withTreeLock,
  type TaskTreeConfig,
  type TaskNode,
} from "./lib/task-tree-store.ts";
import {
  appendToolJournal,
  completeTask,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
  type TaskCompletionClaim,
} from "./lib/task-tree-tools.ts";
import { syncProjectReadout } from "./lib/project-readout-sync.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  sourceDir,
  triggerString,
  type TriggerEvent,
} from "./lib/workflow-input.ts";

export const name = "default-task-worker";
export const description =
  "Execute one aks-rp-e2e task with the default assigned agent session.";

type TaskReviewRoute = {
  required: boolean;
  reason: string;
};

type TaskProblemRoute = {
  action: "none" | "request";
  category?: string;
  diagnosis?: string;
  resumeCondition?: string;
};

type SessionWorkflowContext = WorkflowContext & {
  runAgentSession?: (
    agent: string,
    prompt: string,
    sessionId: string,
  ) => Promise<unknown>;
};

function resultEvidence(result: unknown): string[] {
  const finishResult = (
    result as {
      finishResult?: { deliverables?: Array<{ path?: unknown }> };
    }
  )?.finishResult;
  const deliverables = Array.isArray(finishResult?.deliverables)
    ? finishResult.deliverables
    : [];
  return [
    ...new Set(
      deliverables
        .map((item) => (typeof item?.path === "string" ? item.path.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function taskContextString(task: TaskNode, key: string): string {
  const value = taskContext(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function completionControllerTick(
  task: TaskNode,
  input: {
    attemptId: string;
    result: TaskCompletionClaim;
    summary: string;
    completion: Record<string, unknown>;
  },
): { type: string; payload: Record<string, unknown> } | null {
  const loopTaskId = taskContextString(task, "loopTaskId");
  if (!loopTaskId) return null;

  const byWorkflow: Record<
    string,
    { type: string; action: string; reason: string }
  > = {
    "single-spec-verifier": {
      type: "project.task.tick",
      action: "spec-loop",
      reason: "spec-loop-child-completed",
    },
    "feature-reference-collector": {
      type: "project.task.tick",
      action: "feature-reference-loop",
      reason: "feature-reference-child-completed",
    },
    "feature-compact-planner": {
      type: "project.task.tick",
      action: "feature-compact-loop",
      reason: "feature-compact-child-completed",
    },
  };
  const route = byWorkflow[String(task.workflow ?? "")];
  if (!route) return null;

  return {
    type: route.type,
    payload: {
      project: "aks-rp-e2e",
      action: route.action,
      taskId: loopTaskId,
      task_id: loopTaskId,
      target: { project: "aks-rp-e2e", taskId: loopTaskId },
      reason: route.reason,
      sourceTaskId: task.id,
      source_task_id: task.id,
      attemptId: input.attemptId,
      attempt_id: input.attemptId,
      result: input.result,
      claim: input.result,
      summary: input.summary,
      params: {
        loopTaskId,
        completedTaskId: task.id,
        completedTask: input.completion,
      },
    },
  };
}

export function buildTaskTreeConfig(
  ctx: WorkflowContext,
  appDir: string,
  projectDir: string,
  configuredMaxConcurrent: number,
): TaskTreeConfig {
  return {
    ...taskTreeConfig({
      appDir,
      projectDir,
      worker:
        field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent,
      maxConcurrent: configuredMaxConcurrent,
    }),
    worker: field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent,
    maxConcurrent: configuredMaxConcurrent,
  };
}

function buildWorkerPrompt(input: {
  appDir: string;
  projectDir: string;
  sourceDir: string;
  task: unknown;
  attemptId: string;
}): string {
  return `Task Worker Mode

You are executing exactly one aks-rp-e2e task assigned by the project owner.
Do not reshape the tree, create sibling branches, roll up parents, or run
planner work from this session.
If the assigned task asks for planning work, child-task creation, branch
creation, assignment, acceptance/review decisions, rollups, or other broad tree
changes, treat that as owner-review output: write the plan/proposal/evidence in
the domain workspace and report what the project owner should add to the tree.
If the assigned task is a bounded existing-task metadata repair that explicitly
names supported task-tree commands such as \`task-tree set-outputs\` or
\`task-tree update-text\`, you may run only those exact commands against the
named existing task ids. Never edit the runtime task tree file directly, and do not
add/reassign/accept/reject tasks from this session.

Use the task as the context container. Read the relevant domain files, do the
task body, write the requested output/evidence, then finish with a structured
agent result status:

  success | partial | blocked | failure

Use blocked only for a real blocker with a concrete resume condition.
If the work is too large or wrongly decomposed, record a blocked summary that
explains the exact decomposition problem. The project owner reviews the latest task
state after worker progress and decides whether to accept, retry, repair,
replace, split, or keep the task blocked.
Your summary is review material, not routing protocol. Do not rely on special
phrases to trigger follow-up behavior; state the result, evidence, diagnosis, and
resume condition plainly.

Mounted AKS RP Go source is available at ${input.sourceDir}. Treat it as the
first source authority for e2ev3 scenario/source work. If task context says
"source-holder", "external source", "missing handwritten source", "devbox", or
"authoritative source" is blocking progress, first inspect this mounted source
tree with targeted reads/searches. Do not report source unavailable unless the
relevant files are also absent or insufficient under this source root.

App: ${input.appDir}
Domain workspace: ${input.projectDir}
Source workspace: ${input.sourceDir}
Attempt: ${input.attemptId}

Loop state paths in task inputs or outputs, such as
\`.state/spec-loop/state.json\` and
\`.state/feature-compact-loop/state.json\`, are app-owned state paths rooted at
${input.appDir}. The domain workspace may contain mirrored snapshots for
human/domain review, but controller-visible loop state must be updated through
the app path unless the task explicitly says otherwise. Domain feature/spec
files, compact packages, test code, run artifacts, and evidence notes stay
rooted at ${input.projectDir}.

Before any worker-initiated live GitHub dispatch for single specs or compact
feature reruns, run the local live dependency and admission policies against
the exact spec set from ${input.projectDir}. Use both commands:

  bun runner/check-private-source-policy.ts --specs <comma-separated-spec-ids>
  bun runner/check-live-admission.ts --specs <comma-separated-spec-ids>

If either policy fails, do not dispatch the workflow. Repair the selected
scenario tests so they are self-contained and live-admissible, or finish
partial/blocked with the exact policy output and resume condition. A GitHub run
that fails only because either local policy would have failed is not acceptable
completion evidence.

Assigned task:
\`\`\`json
${JSON.stringify(input.task, null, 2)}
\`\`\``.trim();
}

async function runTaskAgent(input: {
  ctx: WorkflowContext;
  worker: string;
  sessionId: string;
  prompt: string;
}): Promise<unknown> {
  const sessionCtx = input.ctx as SessionWorkflowContext;
  return sessionCtx.runAgentSession
    ? sessionCtx.runAgentSession(input.worker, input.prompt, input.sessionId)
    : input.ctx.runAgent(input.worker, input.prompt);
}

function workerResultFromSession(
  result: unknown,
  _text: string,
): TaskCompletionClaim {
  const typed = result as {
    status?: string;
    finishResult?: { status?: string };
  };
  const status = typed?.status;
  const finishStatus = typed?.finishResult?.status;

  // Structured finish() status is the worker's deliberate completion claim.
  if (finishStatus === "success") return "done";
  if (finishStatus === "partial") return "partial";
  if (finishStatus === "blocked" || finishStatus === "failure")
    return "blocked";

  // Generic session success without structured finish is ambiguous. Treat it
  // conservatively as partial so owner/review can judge the work.
  if (status === "success" || status === "ok" || status === "partial")
    return "partial";

  return "blocked";
}

function workflowStatusFromClaim(
  claim: TaskCompletionClaim,
): WorkflowResultStatus {
  if (claim === "done") return "done";
  if (claim === "blocked") return "blocked";
  return "partial";
}

function completionWorkflowResult(
  task: TaskNode,
  input: {
    result: TaskCompletionClaim;
    summary: string;
    evidence: string[];
    problem: TaskProblemRoute;
  },
): StructuredWorkflowResult {
  const problem =
    input.problem.action === "request" && input.problem.category
      ? {
          category: input.problem.category,
          diagnosis: input.problem.diagnosis ?? input.summary,
          resumeCondition: input.problem.resumeCondition,
        }
      : null;
  return workflowResult({
    workflow:
      typeof task.workflow === "string" && task.workflow.trim()
        ? task.workflow.trim()
        : "default-task-worker",
    subject: {
      kind: "task",
      id: task.id,
    },
    status: workflowStatusFromClaim(input.result),
    summary: input.summary,
    artifacts: input.evidence,
    problem,
    details: {
      taskClaim: input.result,
    },
  });
}

export function emitTaskCompleted(
  ctx: WorkflowContext,
  task: TaskNode,
  input: {
    attemptId: string;
    result: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
    review?: TaskReviewRoute;
    problem?: TaskProblemRoute;
    workflowResult?: StructuredWorkflowResult;
  },
): void {
  const evidence = input.evidence ?? [];
  const review = input.review ?? {
    required: true,
    reason: "worker-completion",
  };
  const problem = input.problem ?? {
    action: "none" as const,
  };
  const structuredResult =
    input.workflowResult ??
    completionWorkflowResult(task, {
      result: input.result,
      summary: input.summary,
      evidence,
      problem,
    });
  const completion = {
    taskId: task.id,
    task_id: task.id,
    attemptId: input.attemptId,
    attempt_id: input.attemptId,
    result: input.result,
    claim: input.result,
    summary: input.summary,
    evidenceRefs: evidence,
    evidence_refs: evidence,
    review,
    problem,
    workflowResult: structuredResult,
    workflow_result: structuredResult,
  };
  try {
    ctx.dispatchEvent("project.task.completed", {
      target: { project: "aks-rp-e2e", taskId: task.id },
      project: "aks-rp-e2e",
      ...taskEventSnapshot(task),
      attemptId: input.attemptId,
      attempt_id: input.attemptId,
      result: input.result,
      claim: input.result,
      summary: input.summary,
      evidenceRefs: evidence,
      evidence_refs: evidence,
      review,
      problem,
      workflowResult: structuredResult,
      workflow_result: structuredResult,
      completion,
    });
    const controllerTick = completionControllerTick(task, {
      attemptId: input.attemptId,
      result: input.result,
      summary: input.summary,
      completion,
    });
    if (controllerTick) {
      ctx.dispatchEvent(controllerTick.type, controllerTick.payload);
    }
  } catch {
    // Local test contexts may not provide a real dispatcher.
  }
}

export function taskAttemptId(task: TaskNode): string {
  const trace = task.trace;
  const value =
    trace && typeof trace === "object" && !Array.isArray(trace)
      ? trace.current_attempt_id
      : undefined;
  return typeof value === "string" ? value : "";
}

function taskStatus(task: TaskNode): string {
  return String(task.status ?? task.state ?? "");
}

export function traceValue(task: TaskNode, key: string): unknown {
  const trace = task.trace;
  return trace && typeof trace === "object" && !Array.isArray(trace)
    ? (trace as Record<string, unknown>)[key]
    : undefined;
}

export function markAttemptStartedOnce(
  config: TaskTreeConfig,
  input: {
    taskId: string;
    attemptId: string;
  },
): { ok: true; task: TaskNode } | { ok: false; reason: string } {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task)
      return {
        ok: false,
        reason: `Assigned task ${input.taskId} was not found.`,
      };
    if (taskStatus(task) !== "active")
      return {
        ok: false,
        reason: `Assigned task ${input.taskId} is ${taskStatus(task)}, not active.`,
      };
    if (taskAttemptId(task) !== input.attemptId)
      return {
        ok: false,
        reason: `Assigned task ${input.taskId} attempt ${input.attemptId} is stale.`,
      };

    if (traceValue(task, "worker_started_attempt_id") === input.attemptId) {
      return {
        ok: false,
        reason: `Assigned task ${input.taskId} attempt ${input.attemptId} is already running or already started.`,
      };
    }

    const now = new Date().toISOString();
    task.trace = {
      ...(task.trace ?? {}),
      worker_started_attempt_id: input.attemptId,
      worker_started_at: now,
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_worker_started",
      task_id: task.id,
      attempt_id: input.attemptId,
      session_id: task.session_id,
      worker: config.worker,
    });
    return { ok: true, task };
  });
}

export function completeStartedAttempt(
  config: TaskTreeConfig,
  input: {
    taskId: string;
    attemptId: string;
    claim: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
  },
): { ok: true; task: TaskNode } | { ok: false; reason: string } {
  const completionState = withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) {
      return {
        ok: false as const,
        reason: `Assigned task ${input.taskId} no longer exists; completion for attempt ${input.attemptId} is obsolete.`,
      };
    }
    if (taskAttemptId(task) !== input.attemptId) {
      return {
        ok: false as const,
        reason: `Assigned task ${input.taskId} attempt ${input.attemptId} is no longer current; completion is obsolete.`,
      };
    }
    if (taskStatus(task) !== "active") {
      return {
        ok: false as const,
        reason: `Assigned task ${input.taskId} is ${taskStatus(task)}, not active; completion for attempt ${input.attemptId} is obsolete.`,
      };
    }
    return { ok: true as const };
  });
  if (completionState.ok === false) {
    appendToolJournal(config, {
      kind: "task_worker_completion_ignored",
      task_id: input.taskId,
      attempt_id: input.attemptId,
      result: input.claim,
      reason: completionState.reason,
      summary: input.summary,
    });
    return { ok: false, reason: completionState.reason };
  }

  try {
    return {
      ok: true,
      task: completeTask(config, {
        taskId: input.taskId,
        claim: input.claim,
        summary: input.summary,
        evidence: input.evidence,
      }),
    };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : `Unable to complete task ${input.taskId}`;
    appendToolJournal(config, {
      kind: "task_worker_completion_ignored",
      task_id: input.taskId,
      attempt_id: input.attemptId,
      result: input.claim,
      reason,
      summary: input.summary,
    });
    return { ok: false, reason };
  }
}

async function runAssignedMode(
  ctx: WorkflowContext,
  appDir: string,
  projectDir: string,
  sourceRoot: string,
  config: TaskTreeConfig,
  trigger: TriggerEvent | null,
): Promise<WorkflowResult> {
  const taskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    field(ctx.task, "taskId");
  if (!taskId)
    return ctx.done(
      "Task assignment event ignored because it did not include taskId.",
    );
  const attemptId =
    triggerString(trigger, "attemptId") || triggerString(trigger, "attempt_id");
  if (!attemptId)
    return ctx.done(
      `Task assignment for ${taskId} ignored because it did not include attemptId.`,
    );

  const start = markAttemptStartedOnce(config, { taskId, attemptId });
  if (start.ok === false) return ctx.done(start.reason);
  const task = start.task;

  const result = await runTaskAgent({
    ctx,
    worker: config.worker,
    sessionId:
      task.session_id || `s_task_${task.id.replace(/[^A-Za-z0-9_-]+/g, "_")}`,
    prompt: buildWorkerPrompt({
      appDir,
      projectDir,
      sourceDir: sourceRoot,
      task,
      attemptId,
    }),
  });
  const message = resultText(result);
  const claim = workerResultFromSession(result, message);
  const evidence = resultEvidence(result);
  const completion = completeStartedAttempt(config, {
    taskId: task.id,
    attemptId,
    claim,
    summary: message || "Worker session returned without a completion summary.",
    evidence,
  });
  if (completion.ok === false) {
    return ctx.done(
      `Task worker ignored obsolete completion for ${task.id} attempt ${attemptId}; result was ${claim}. ${completion.reason}`,
    );
  }
  const completedTask = completion.task;
  try {
    syncProjectReadout(config);
  } catch {
    // Keep worker completion durable even if compact project.json readout sync
    // fails; planner/watchdog can resync on their next pulse.
  }
  emitTaskCompleted(ctx, completedTask, {
    attemptId,
    result: claim,
    summary: message || "Worker session returned without a completion summary.",
    evidence,
  });
  return ctx.done(
    `Task worker handled ${task.id} attempt ${attemptId}; result is ${claim}. Agent result: ${message}`,
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const sourceRoot = sourceDir(ctx.task);
  const trigger = parseTriggerEvent(ctx.task);
  const configuredMaxConcurrent = maxConcurrent(ctx.task, trigger);
  const config = buildTaskTreeConfig(
    ctx,
    appDir,
    projectDir,
    configuredMaxConcurrent,
  );

  if (trigger?.type === "project.task.assigned") {
    return runAssignedMode(
      ctx,
      appDir,
      projectDir,
      sourceRoot,
      config,
      trigger,
    );
  }

  return ctx.done(
    `Task worker ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.assigned.`,
  );
}

if (import.meta.main) {
  if (process.env.MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT !== "1") {
    console.error(
      "Direct workflow entrypoint is disabled by default. Set MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT=1 to run it.",
    );
    process.exit(0);
  }
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-explorer\nmaxConcurrent: 3",
    agent: "aks-explorer",
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: () => "",
  } as unknown as WorkflowContext);
  console.log(JSON.stringify(result));
}

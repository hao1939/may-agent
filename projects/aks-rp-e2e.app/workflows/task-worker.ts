/**
 * task-worker — workflow adapter for aks-rp-e2e task execution.
 *
 * Handles project.task.assigned by waking the assigned task session. The
 * project owner owns the task tree; this workflow executes and reports
 * completion.
 */

import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  taskEventSnapshot,
  type TaskTreeConfig,
  type TaskNode,
} from "./lib/task-tree-store.ts";
import {
  completeTask,
  readTask,
  taskTreeConfig,
  type TaskCompletionClaim,
} from "./lib/task-tree-tools.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  triggerString,
  type TriggerEvent,
} from "./lib/workflow-input.ts";

export const name = "task-worker";
export const description =
  "Execute one aks-rp-e2e task from a planner assignment event.";

type SessionWorkflowContext = WorkflowContext & {
  runAgentSession?: (
    agent: string,
    prompt: string,
    sessionId: string,
  ) => Promise<unknown>;
};

function buildTaskTreeConfig(
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
    appDir,
    projectDir,
    treePath: join(appDir, "tasks", "tree.json"),
    journalPath: join(appDir, ".state", "journal.jsonl"),
    worker: field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent,
    maxConcurrent: configuredMaxConcurrent,
  };
}

function buildWorkerPrompt(input: {
  appDir: string;
  projectDir: string;
  task: unknown;
  attemptId: string;
}): string {
  return `Task Worker Mode

You are executing exactly one aks-rp-e2e task assigned by the project owner.
Do not reshape the tree, create sibling branches, roll up parents, or run
planner work from this session.

Use the task as the context container. Read the relevant domain files, do the
task body, write the requested output/evidence, then finish your response with
one explicit line:

  RESULT: done | partial | blocked

Use RESULT: blocked only for a real blocker with a concrete resume condition.
If the work is too large or wrongly decomposed, record a blocked summary that
explains the exact decomposition problem. The project owner reviews the latest task
state after worker progress and decides whether to accept, retry, repair,
replace, split, or keep the task blocked.

App: ${input.appDir}
Domain workspace: ${input.projectDir}
Attempt: ${input.attemptId}

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
  text: string,
): TaskCompletionClaim {
  const typed = result as {
    status?: string;
    finishResult?: { status?: string };
  };
  const status = typed?.status;
  const finishStatus = typed?.finishResult?.status;

  // 1. Explicit RESULT/CLAIM line in the assistant text (legacy protocol)
  if (/(?:RESULT|CLAIM):\s*done/i.test(text)) return "done";
  if (/(?:RESULT|CLAIM):\s*partial/i.test(text)) return "partial";
  if (/(?:RESULT|CLAIM):\s*blocked/i.test(text)) return "blocked";

  // 2. Structured finish() status from the agent's explicit completion signal.
  //    finish(success) is the agent's deliberate claim of task completion.
  if (finishStatus === "success") return "done";
  if (finishStatus === "partial") return "partial";
  if (finishStatus === "blocked" || finishStatus === "failure")
    return "blocked";

  // 3. Generic session success without a structured finish or explicit RESULT
  //    line is ambiguous — the agent ran without error but did not explicitly
  //    claim task completion. Treat conservatively as partial.
  if (status === "success" || status === "ok" || status === "partial")
    return "partial";

  return "blocked";
}

function emitTaskCompleted(
  ctx: WorkflowContext,
  task: TaskNode,
  input: {
    attemptId: string;
    result: TaskCompletionClaim;
    summary: string;
  },
): void {
  try {
    ctx.dispatchEvent("project.task.completed", {
      project: "aks-rp-e2e",
      ...taskEventSnapshot(task),
      attemptId: input.attemptId,
      attempt_id: input.attemptId,
      result: input.result,
      claim: input.result,
      summary: input.summary,
    });
  } catch {
    // Local test contexts may not provide a real dispatcher.
  }
}

function taskAttemptId(task: TaskNode): string {
  const trace = task.trace;
  const value =
    trace && typeof trace === "object" && !Array.isArray(trace)
      ? trace.current_attempt_id
      : undefined;
  return typeof value === "string" ? value : "";
}

async function runAssignedMode(
  ctx: WorkflowContext,
  appDir: string,
  projectDir: string,
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

  const task = readTask(config, taskId);
  if (!task) return ctx.done(`Assigned task ${taskId} was not found.`);
  if (task.status !== "active")
    return ctx.done(`Assigned task ${taskId} is ${task.status}, not active.`);
  if (taskAttemptId(task) !== attemptId)
    return ctx.done(`Assigned task ${taskId} attempt ${attemptId} is stale.`);

  const result = await runTaskAgent({
    ctx,
    worker: config.worker,
    sessionId:
      task.session_id || `s_task_${task.id.replace(/[^A-Za-z0-9_-]+/g, "_")}`,
    prompt: buildWorkerPrompt({ appDir, projectDir, task, attemptId }),
  });
  const message = resultText(result);
  const claim = workerResultFromSession(result, message);
  const completedTask = completeTask(config, {
    taskId: task.id,
    claim,
    summary: message || "Worker session returned without a completion summary.",
  });
  emitTaskCompleted(ctx, completedTask, {
    attemptId,
    result: claim,
    summary: message || "Worker session returned without a completion summary.",
  });
  return ctx.done(
    `Task worker handled ${task.id} attempt ${attemptId}; result is ${claim}. Agent result: ${message}`,
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);
  const configuredMaxConcurrent = maxConcurrent(ctx.task, trigger);
  const config = buildTaskTreeConfig(
    ctx,
    appDir,
    projectDir,
    configuredMaxConcurrent,
  );

  if (trigger?.type === "project.task.assigned") {
    return runAssignedMode(ctx, appDir, projectDir, config, trigger);
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

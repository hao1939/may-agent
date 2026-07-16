/**
 * task-worker — workflow router for aks-rp-e2e task execution.
 *
 * Handles project.task.assigned by loading the assigned task and routing it to
 * task.workflow when present. Tasks without a specialized app workflow use the
 * default LLM-backed task worker.
 */

import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  readTaskTree,
  taskRevision,
  type TaskNode,
} from "./lib/task-tree-store.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  sourceDir,
  triggerString,
  triggerValue,
} from "./lib/workflow-input.ts";
import {
  buildTaskTreeConfig,
  execute as executeDefaultTaskWorker,
} from "./default-task-worker.ts";

export const name = "task-worker";
export const description =
  "Route one assigned aks-rp-e2e task to its declared workflow or the default task worker.";

type InlineWorkflowModule = {
  execute: (ctx: WorkflowContext) => Promise<WorkflowResult>;
};

const DEFAULT_WORKFLOWS = new Set([
  "",
  "task-worker",
  "default-task-worker",
  // Existing domain spec-runner tasks use this as domain intent metadata. Until
  // the domain spec runner is exposed as an app workflow, preserve the current
  // generic worker behavior for those tasks.
  "spec-runner",
]);

function taskWorkflow(task: TaskNode): string {
  const workflow =
    typeof task.workflow === "string" ? task.workflow.trim() : "";
  return DEFAULT_WORKFLOWS.has(workflow) ? "default-task-worker" : workflow;
}

function workflowTaskPayload(input: {
  originalTask: string;
  appDir: string;
  projectDir: string;
  sourceRoot: string;
  workflow: string;
  assignedTaskId: string;
  assignedTaskRevision: number;
  assignedAttemptId: string;
  assignedSessionId: string;
}): string {
  return [
    input.originalTask,
    "",
    `## Task Workflow Route`,
    `workflow: ${input.workflow}`,
    `taskId: ${input.assignedTaskId}`,
    `taskRevision: ${input.assignedTaskRevision}`,
    `attemptId: ${input.assignedAttemptId}`,
    `sessionId: ${input.assignedSessionId}`,
    `app: ${input.appDir}`,
    `project: ${input.projectDir}`,
    `source: ${input.sourceRoot}`,
  ].join("\n");
}

async function runWorkflowInline(
  workflow: string,
  ctx: WorkflowContext,
): Promise<WorkflowResult> {
  const module = (await import(`./${workflow}.ts`)) as InlineWorkflowModule;
  if (!module || typeof module.execute !== "function") {
    return ctx.blocked(
      `Task workflow ${workflow} is missing an execute(ctx) export.`,
    );
  }
  return module.execute(ctx);
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
    trigger,
  );

  if (trigger?.type !== "project.task.assigned") {
    return ctx.done(
      `Task worker ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.assigned.`,
    );
  }

  const taskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    field(ctx.task, "taskId");
  if (!taskId) {
    return ctx.done(
      "Task assignment event ignored because it did not include taskId.",
    );
  }
  const attemptId =
    triggerString(trigger, "attemptId") ||
    triggerString(trigger, "attempt_id") ||
    "";
  const revisionValue =
    triggerValue(trigger, "taskRevision") ??
    triggerValue(trigger, "task_revision");
  const assignedTaskRevision =
    typeof revisionValue === "number" &&
    Number.isInteger(revisionValue) &&
    revisionValue >= 0
      ? revisionValue
      : 0;

  const task = readTaskTree(config).tasks[taskId];
  if (!task) return ctx.done(`Assigned task ${taskId} was not found.`);
  if (taskRevision(task) !== assignedTaskRevision) {
    return ctx.done(
      `Assigned task ${taskId} revision ${assignedTaskRevision} is stale; current revision is ${taskRevision(task)}.`,
    );
  }

  const workflow = taskWorkflow(task);
  if (workflow === "default-task-worker") {
    return executeDefaultTaskWorker(ctx);
  }

  const taskSessionId =
    typeof task.session_id === "string" && task.session_id.trim()
      ? task.session_id.trim()
      : `s_task_${task.id.replace(/[^A-Za-z0-9_-]+/g, "_")}`;
  const routedTask = workflowTaskPayload({
    originalTask: ctx.task,
    appDir,
    projectDir,
    sourceRoot,
    workflow,
    assignedTaskId: task.id,
    assignedTaskRevision,
    assignedAttemptId: attemptId,
    assignedSessionId: taskSessionId,
  });

  const result = await runWorkflowInline(workflow, {
    ...ctx,
    task: routedTask,
  });
  return ctx.done(
    `Task ${task.id} routed inline to workflow ${workflow} under session ${taskSessionId}. Result: ${resultText(result)}`,
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
    runWorkflow: async () => ({ status: "error", message: "unavailable" }),
    summarize: () => "",
  } as unknown as WorkflowContext);
  console.log(JSON.stringify(result));
}

/**
 * task-worker — workflow adapter for aks-rp-e2e task pickup/execution.
 *
 * Handles project.task.execution.requested by claiming exactly one ready leaf
 * under the task-tree lock, then executing that claimed task.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { execute as executeEngine } from "./project-execution-engine.ts";
import {
  abandonedActiveTaskIds,
  maxConcurrent,
  parseTriggerEvent,
  tryClaimReadyTask,
  type PickupConfig,
} from "./lib/task-pickup.ts";

export const name = "task-worker";
export const description =
  "Claim and execute one aks-rp-e2e ready leaf from a task execution event.";

function field(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

function resolveAppDir(projectDir: string, explicitAppDir?: string): string {
  if (explicitAppDir) return explicitAppDir;
  const embeddedProjectPath = join(projectDir, ".app", "project.json");
  const legacyRootTaskDir = join(projectDir, "tasks");
  if (existsSync(embeddedProjectPath) && existsSync(legacyRootTaskDir))
    return projectDir;
  if (existsSync(embeddedProjectPath)) return join(projectDir, ".app");
  return new URL("..", import.meta.url).pathname;
}

function pickupConfig(
  ctx: WorkflowContext,
  appDir: string,
  projectDir: string,
  configuredMaxConcurrent: number,
  trigger: ReturnType<typeof parseTriggerEvent>,
): PickupConfig {
  return {
    appDir,
    projectDir,
    treePath: join(appDir, "tasks", "tree.json"),
    journalPath: join(appDir, ".state", "journal.jsonl"),
    worker: field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent,
    maxConcurrent: configuredMaxConcurrent,
    requestedReadyTaskIds: [],
    abandonedActiveTaskIds: abandonedActiveTaskIds(ctx.task, trigger),
  };
}

function triggerValue(
  trigger: ReturnType<typeof parseTriggerEvent>,
  key: string,
): string {
  const value =
    trigger?.data && typeof trigger.data === "object" && key in trigger.data
      ? trigger.data[key]
      : trigger?.params &&
          typeof trigger.params === "object" &&
          key in trigger.params
        ? trigger.params[key]
        : trigger?.[key];
  return typeof value === "string" ? value : "";
}

async function runExecutionMode(
  ctx: WorkflowContext,
  appDir: string,
  projectDir: string,
  configuredMaxConcurrent: number,
  config: PickupConfig,
  trigger: ReturnType<typeof parseTriggerEvent>,
): Promise<WorkflowResult> {
  const taskId =
    triggerValue(trigger, "taskId") ||
    triggerValue(trigger, "task_id") ||
    field(ctx.task, "taskId");
  if (!taskId)
    return ctx.done(
      "Task execution event ignored because it did not include taskId.",
    );

  const claim = tryClaimReadyTask(ctx, config, taskId);
  if (claim.claimed === false)
    return ctx.done(`Task execution event ignored because ${claim.reason}.`);

  const taskLines = [
    `app: ${appDir}`,
    `project: ${projectDir}`,
    `agent: ${field(ctx.task, "agent") ?? ctx.agent}`,
    `owner: ${field(ctx.task, "owner") ?? field(ctx.task, "agent") ?? ctx.agent}`,
    `worker: ${field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent}`,
    "maxAttempts: 1",
    `maxConcurrent: ${configuredMaxConcurrent}`,
    "role: task-worker",
  ];
  const triggerBlock = ctx.task.match(/## Trigger Event[\s\S]*$/)?.[0] ?? "";

  const result = await executeEngine({
    ...ctx,
    task: `${taskLines.join("\n")}\n\n${triggerBlock}`,
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
  } as unknown as WorkflowContext);

  const message =
    (result as { message?: string; summary?: string }).message ??
    (result as { message?: string; summary?: string }).summary ??
    JSON.stringify(result);
  return ctx.done(`Task worker loop advanced: ${message}`);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);
  const configuredMaxConcurrent = maxConcurrent(ctx.task, trigger);
  const config = pickupConfig(
    ctx,
    appDir,
    projectDir,
    configuredMaxConcurrent,
    trigger,
  );

  if (trigger?.type === "project.task.execution.requested") {
    return runExecutionMode(
      ctx,
      appDir,
      projectDir,
      configuredMaxConcurrent,
      config,
      trigger,
    );
  }

  return ctx.done(
    `Task worker ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.execution.requested.`,
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

/**
 * task-worker — workflow adapter for aks-rp-e2e task pickup/execution.
 *
 * Handles two events:
 * - project.tasks.ready: lease ready leaves and dispatch execution events.
 * - project.task.execution.requested: execute exactly one leased leaf.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { execute as executeEngine } from "./project-execution-engine.ts";
import {
  abandonedActiveTaskIds,
  emitTaskExecutionEvents,
  maxConcurrent,
  parseTriggerEvent,
  pickupReadyTasks,
  triggerStringArray,
  type PickupConfig,
} from "./lib/task-pickup.ts";

export const name = "task-worker";
export const description =
  "Pick ready aks-rp-e2e leaves or execute one leased task event.";

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
    requestedReadyTaskIds: triggerStringArray(trigger, "readyTaskIds"),
    abandonedActiveTaskIds: abandonedActiveTaskIds(ctx.task, trigger),
  };
}

async function runPickupMode(
  ctx: WorkflowContext,
  config: PickupConfig,
): Promise<WorkflowResult> {
  const leased = pickupReadyTasks(ctx, config);
  emitTaskExecutionEvents(ctx, config, leased);
  return ctx.done(
    leased.length > 0
      ? `Dispatched ${leased.length} task execution event(s): ${leased.map((task) => task.id).join(", ")}.`
      : "No dispatchable ready task found; worker pickup left the task tree unchanged except stale lease recovery.",
  );
}

async function runExecutionMode(
  ctx: WorkflowContext,
  appDir: string,
  projectDir: string,
  configuredMaxConcurrent: number,
): Promise<WorkflowResult> {
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

  if (trigger?.type === "project.task.execution.requested") {
    return runExecutionMode(ctx, appDir, projectDir, configuredMaxConcurrent);
  }

  return runPickupMode(
    ctx,
    pickupConfig(ctx, appDir, projectDir, configuredMaxConcurrent, trigger),
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

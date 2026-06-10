/**
 * project-planner — refill/review loop for aks-rp-e2e.
 *
 * The planner does planner work only: run the execution engine in planner mode
 * and emit per-task execution request events for dispatchable ready leaves.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { execute as executeEngine } from "./project-execution-engine.ts";
import {
  maxConcurrent,
  readDispatchableReadyTaskIds,
  type PickupConfig,
} from "./lib/task-pickup.ts";

export const name = "project-planner";
export const description =
  "Review/refill aks-rp-e2e.app/tasks/tree.json, then emit project.task.execution.requested for executable leaves.";

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
): PickupConfig {
  return {
    appDir,
    projectDir,
    treePath: join(appDir, "tasks", "tree.json"),
    journalPath: join(appDir, ".state", "journal.jsonl"),
    worker: field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent,
    maxConcurrent: configuredMaxConcurrent,
    requestedReadyTaskIds: [],
    abandonedActiveTaskIds: new Set(),
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const configuredMaxConcurrent = maxConcurrent(ctx.task, null);
  const triggerBlock = ctx.task.match(/## Trigger Event[\s\S]*$/)?.[0] ?? "";
  const plannerTask = [
    `app: ${appDir}`,
    `project: ${projectDir}`,
    `agent: ${field(ctx.task, "agent") ?? ctx.agent}`,
    `owner: ${field(ctx.task, "owner") ?? field(ctx.task, "agent") ?? ctx.agent}`,
    `worker: ${field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent}`,
    "maxAttempts: 0",
    `maxConcurrent: ${configuredMaxConcurrent}`,
    "role: planner",
    "",
    triggerBlock,
  ].join("\n");

  const result = await executeEngine({
    ...ctx,
    task: plannerTask,
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
  } as unknown as WorkflowContext);

  const readyLeafIds = readDispatchableReadyTaskIds(
    pickupConfig(ctx, appDir, projectDir, configuredMaxConcurrent),
  );
  if (readyLeafIds.length > 0) {
    for (const taskId of readyLeafIds) {
      try {
        ctx.dispatchEvent("project.task.execution.requested", {
          project: "aks-rp-e2e",
          taskId,
          worker:
            field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent,
          maxConcurrent: configuredMaxConcurrent,
          requested_by: "project-planner",
        });
      } catch {
        // Local tests may not provide a dispatcher.
      }
    }
  }

  const message =
    (result as { message?: string; summary?: string }).message ??
    (result as { message?: string; summary?: string }).summary ??
    JSON.stringify(result);
  const plannerMessage = readyLeafIds.length
    ? `Planner updated task tree and requested execution for ${readyLeafIds.length} dispatchable ready task(s): ${readyLeafIds.slice(0, 8).join(", ")}. Engine result: ${message}`
    : `Planner updated task tree; no dispatchable ready leaves to request. Engine result: ${message}`;
  if ((result as { status?: string }).status === "escalated")
    return ctx.escalate(plannerMessage);
  return ctx.done(plannerMessage);
}

if (import.meta.main) {
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-explorer",
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

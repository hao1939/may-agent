/**
 * project-planner — refill/review loop for aks-rp-e2e.
 *
 * This is the simple control loop: normalize/review the task tree, create or
 * promote next tasks, then signal the worker loop when ready leaves exist.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { execute as executeEngine } from "./project-execution-engine.ts";

export const name = "project-planner";
export const description = "Review/refill aks-rp-e2e.app/tasks/tree.json, then emit project.tasks.ready when executable leaves exist.";

type TaskNode = {
  id: string;
  status: string;
  children?: string[];
  gates?: string[];
  gate_status?: string;
};

type TaskTree = {
  tasks?: Record<string, TaskNode>;
};

function field(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

function readReadyLeafIds(appDir: string): string[] {
  const treePath = join(appDir, "tasks", "tree.json");
  if (!existsSync(treePath)) return [];
  const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;
  return Object.values(tree.tasks ?? {})
    .filter(task => task.status === "ready" && (task.children ?? []).length === 0 && !hasClosedGate(task))
    .map(task => task.id)
    .sort();
}

function hasClosedGate(task: TaskNode): boolean {
  return (task.gates ?? []).some(isBlockingGate) && task.gate_status !== "satisfied";
}

function isNonBlockingSafetyGate(gate: string): boolean {
  const text = gate.trim();
  return /^no\s+(?:cloud|live)\s+mutation\b/i.test(text)
    || /^no\s+kubectl\b/i.test(text)
    || /^--check\s+only\b/i.test(text)
    || /^local\s+(?:check|preflight)\s+only\b/i.test(text)
    || /^do not run (?:cloud|live|staging|kubectl)\b/i.test(text);
}

function isBlockingGate(gate: string): boolean {
  return Boolean(gate.trim()) && !isNonBlockingSafetyGate(gate);
}

function maxConcurrent(raw: string): number {
  return Math.max(1, Number.parseInt(field(raw, "maxConcurrent") ?? "3", 10) || 3);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = field(ctx.task, "app") ?? new URL("..", import.meta.url).pathname;
  const plannerTask = [
    `app: ${appDir}`,
    `project: ${projectDir}`,
    `agent: ${field(ctx.task, "agent") ?? ctx.agent}`,
    `owner: ${field(ctx.task, "owner") ?? field(ctx.task, "agent") ?? ctx.agent}`,
    `worker: ${field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent}`,
    "maxAttempts: 0",
    `maxConcurrent: ${maxConcurrent(ctx.task)}`,
    "role: planner",
  ].join("\n");

  const result = await executeEngine({
    ...ctx,
    task: plannerTask,
    done: (message: string) => ({ status: "done", message }) as WorkflowResult,
    escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
  } as WorkflowContext);

  const readyLeafIds = readReadyLeafIds(appDir);
  if (readyLeafIds.length > 0) {
    try {
      ctx.dispatchEvent("project.tasks.ready", {
        project: "aks-rp-e2e",
        readyTaskIds: readyLeafIds,
        maxConcurrent: maxConcurrent(ctx.task),
        requested_by: "project-planner",
      });
    } catch {
      // Local tests may not provide a real dispatcher.
    }
  }

  const message = (result as { message?: string; summary?: string }).message
    ?? (result as { message?: string; summary?: string }).summary
    ?? JSON.stringify(result);
  return ctx.done(readyLeafIds.length
    ? `Planner updated task tree and signaled ${readyLeafIds.length} ready task(s): ${readyLeafIds.slice(0, 8).join(", ")}. Engine result: ${message}`
    : `Planner updated task tree; no ready leaves to signal. Engine result: ${message}`);
}

if (import.meta.main) {
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-explorer\nmaxConcurrent: 3",
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }) as WorkflowResult,
    escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: () => "",
  } as WorkflowContext);
  console.log(JSON.stringify(result));
}

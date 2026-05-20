/**
 * E2E fixture handler: task-driven project loop, no LLM.
 *
 * Mirrors the production project handler's task-layer behavior with workflow
 * stubs instead of agent sessions so E3a can run in live-stack mode without
 * provider access:
 *   - parse ## Tasks
 *   - dispatch ready tasks
 *   - unblock downstream tasks only after result: succeeded
 *   - route repeated attempts to owner judgment
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseProjectMeta,
  parseProjectTasks,
  planProjectTasks,
  updateProjectTaskFields,
  type CronEntry,
  type HandlerContext,
  type HandlerModule,
  type EventEnvelope,
} from "@may-agent/sdk";

function projectIdFor(owner: string, projectName: string): string {
  return `${owner}/${projectName}`;
}

function maxTaskAttempts(content: string): number {
  const meta = parseProjectMeta(content);
  const parsed = Number.parseInt(meta.max_task_attempts ?? "2", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

function maxConcurrent(content: string): number {
  const meta = parseProjectMeta(content);
  const parsed = Number.parseInt(meta.max_concurrent ?? "3", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function updateTask(projectFile: string, taskId: string, patch: Parameters<typeof updateProjectTaskFields>[2]): void {
  const latest = readFileSync(projectFile, "utf-8");
  writeFileSync(projectFile, updateProjectTaskFields(latest, taskId, patch), "utf-8");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: EventEnvelope) => {
    const projectsRoot = ctx.sdk.paths.projects;
    if (!existsSync(projectsRoot)) return;

    for (const projectName of readdirSync(projectsRoot)) {
      const dir = join(projectsRoot, projectName);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }

      const projectFile = join(dir, "project.md");
      if (!existsSync(projectFile)) continue;

      const content = readFileSync(projectFile, "utf-8");
      const meta = parseProjectMeta(content);
      if ((meta.status ?? "active") !== "active") continue;

      const owner = meta.owner ?? "agent:may";
      const projectId = projectIdFor(owner, projectName);
      const parsed = parseProjectTasks(content);
      if (parsed.tasks.length === 0) continue;
      if (parsed.errors.length > 0) {
        ctx.sdk.emit("e2e.project_tasks.error", { projectId, projectName, errors: parsed.errors });
        continue;
      }

      const plan = planProjectTasks(parsed.tasks, { maxConcurrent: maxConcurrent(content) });
      const repeated = plan.dispatchable.find((task) => task.attempts >= maxTaskAttempts(content));
      if (repeated) {
        ctx.sdk.emit("e2e.owner_judgment.dispatch", { projectId, projectName, taskId: repeated.id });
        await ctx.sdk.runWorkflow("e2e-owner-judgment-stub", `judge projectId=${projectId} task=${repeated.id}`, {
          source: owner,
          projectId,
        });
        continue;
      }

      for (const task of plan.dispatchable) {
        updateTask(projectFile, task.id, { status: "running", attempts: task.attempts + 1 });
        ctx.sdk.emit("project.task.dispatched", {
          projectId,
          projectPath: `projects/${projectName}`,
          taskId: task.id,
          assignee: task.assignee,
        });

        const result = await ctx.sdk.runWorkflow("e2e-task-worker-stub", `work projectId=${projectId} task=${task.id}`, {
          source: task.assignee,
          projectId,
        });

        if (result.status === "done") {
          updateTask(projectFile, task.id, { status: "done", result: "succeeded" });
        } else {
          updateTask(projectFile, task.id, { status: "ready", result: null });
        }

        ctx.sdk.emit("project.task.finished", {
          projectId,
          projectPath: `projects/${projectName}`,
          taskId: task.id,
          assignee: task.assignee,
          status: result.status,
          finishStatus: result.status === "done" ? "success" : "escalated",
          workflowRunId: result.runId ?? null,
        });
      }
    }
  };
};

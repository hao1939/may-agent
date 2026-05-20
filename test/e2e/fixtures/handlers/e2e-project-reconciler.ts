/**
 * E2E fixture handler: event-driven project reconciler, no LLM.
 *
 * Models the project reconciler contract without production model calls:
 *   - every project event is a reconcile chance
 *   - handlers may be slow; cron must queue subscribed events serially
 *   - task completion unblocks downstream ready work
 *   - all-done projects launch one owner loop while an owner loop is live
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseProjectMeta,
  parseProjectTasks,
  planProjectTasks,
  updateProjectTaskFields,
  type CronEntry,
  type EventEnvelope,
  type HandlerContext,
  type HandlerModule,
} from "@may-agent/sdk";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function projectNameFromPath(projectPath: unknown): string | null {
  if (typeof projectPath !== "string" || !projectPath.trim()) return null;
  const normalized = projectPath.trim().replace(/^projects\//, "").replace(/\/project\.md$/, "").replace(/\/$/, "");
  return normalized ? normalized.split("/").pop() ?? normalized : null;
}

function projectIdFor(owner: string, projectName: string): string {
  return `${owner}/${projectName}`;
}

function updateTask(projectFile: string, taskId: string, patch: Parameters<typeof updateProjectTaskFields>[2]): void {
  const latest = readFileSync(projectFile, "utf-8");
  writeFileSync(projectFile, updateProjectTaskFields(latest, taskId, patch), "utf-8");
}

function ownerRunning(ctx: HandlerContext, projectId: string): boolean {
  const workflowRows = ctx.sdk.query.workflowRuns({ projectId, status: "running", limit: 20 }).rows as Array<{ workflow?: unknown }>;
  if (workflowRows.some((row) => row.workflow === "e2e-owner-slow-stub")) return true;

  const sessionRows = ctx.sdk.query.sessions({ projectId, status: "running", limit: 20 }).rows as Array<{ source?: unknown }>;
  return sessionRows.some((row) => row.source === "project-owner");
}

function activeTaskIds(ctx: HandlerContext, projectId: string): string[] {
  const rows = ctx.sdk.query.sessions({ projectId, status: "running", limit: 100 }).rows as Array<{ source?: unknown }>;
  return rows
    .map((row) => (typeof row.source === "string" ? row.source.match(/^project-task:(.+)$/)?.[1] : null))
    .filter((value): value is string => !!value);
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const delayMs = Number((entry.handlerConfig as { delayMs?: unknown } | undefined)?.delayMs ?? 0);

  return async (event?: EventEnvelope) => {
    const projectsRoot = ctx.sdk.paths.projects;
    if (!existsSync(projectsRoot)) return;

    const targetName = projectNameFromPath(event?.data?.projectPath);
    const projectNames = targetName
      ? [targetName]
      : readdirSync(projectsRoot).filter((name) => {
          try {
            return statSync(join(projectsRoot, name)).isDirectory();
          } catch {
            return false;
          }
        });

    for (const projectName of projectNames) {
      const projectFile = join(projectsRoot, projectName, "project.md");
      if (!existsSync(projectFile)) continue;

      const startedAt = Date.now();
      const content = readFileSync(projectFile, "utf-8");
      const meta = parseProjectMeta(content);
      const owner = meta.owner ?? "may";
      const projectId = projectIdFor(owner, projectName);
      ctx.sdk.emit("e2e.project_reconcile.started", {
        projectId,
        projectPath: `projects/${projectName}`,
        triggerType: event?.type ?? "timer.tick",
        startedAt,
      });

      if (delayMs > 0) await sleep(delayMs);

      if ((meta.status ?? "active") !== "active") {
        ctx.sdk.emit("e2e.project_reconcile.completed", {
          projectId,
          projectPath: `projects/${projectName}`,
          action: "skip",
          startedAt,
        });
        continue;
      }

      const parsed = parseProjectTasks(content);
      if (parsed.errors.length > 0) {
        ctx.sdk.emit("e2e.project_reconcile.completed", {
          projectId,
          projectPath: `projects/${projectName}`,
          action: "invalid-tasks",
          startedAt,
          errors: parsed.errors,
        });
        continue;
      }

      const plan = planProjectTasks(parsed.tasks, {
        activeTaskIds: activeTaskIds(ctx, projectId),
        maxConcurrent: 2,
      });
      const next = plan.dispatchable[0];
      if (next) {
        updateTask(projectFile, next.id, { status: "running", attempts: next.attempts + 1 });
        ctx.sdk.emit("project.task.dispatched", {
          projectId,
          projectPath: `projects/${projectName}`,
          taskId: next.id,
          assignee: next.assignee,
        });
        const result = await ctx.sdk.runWorkflow("e2e-task-worker-stub", `work projectId=${projectId} task=${next.id}`, {
          source: next.assignee,
          projectId,
        });
        updateTask(projectFile, next.id, {
          status: result.status === "done" ? "done" : "ready",
          result: result.status === "done" ? "succeeded" : null,
        });
        ctx.sdk.emit("project.task.finished", {
          projectId,
          projectPath: `projects/${projectName}`,
          taskId: next.id,
          assignee: next.assignee,
          status: result.status,
          finishStatus: result.status === "done" ? "success" : "escalated",
          workflowRunId: result.runId ?? null,
        });
        ctx.sdk.emit("e2e.project_reconcile.completed", {
          projectId,
          projectPath: `projects/${projectName}`,
          action: "task-dispatched",
          taskId: next.id,
          startedAt,
        });
        return;
      }

      if (plan.allDone || parsed.tasks.length === 0) {
        if (ownerRunning(ctx, projectId)) {
          ctx.sdk.emit("e2e.project_reconcile.completed", {
            projectId,
            projectPath: `projects/${projectName}`,
            action: "owner-already-running",
            startedAt,
          });
          continue;
        }

        ctx.sdk.emit("e2e.owner_judgment.dispatch", {
          projectId,
          projectName,
          reason: plan.allDone ? "all tasks done" : "project nudge",
        });
        void ctx.sdk.runWorkflow("e2e-owner-slow-stub", `owner projectId=${projectId} reason=${plan.allDone ? "all tasks done" : "project nudge"}`, {
          source: owner,
          projectId,
        });
        ctx.sdk.emit("e2e.project_reconcile.completed", {
          projectId,
          projectPath: `projects/${projectName}`,
          action: "owner-dispatched",
          startedAt,
        });
        continue;
      }

      ctx.sdk.emit("e2e.project_reconcile.completed", {
        projectId,
        projectPath: `projects/${projectName}`,
        action: "no-ready-tasks",
        startedAt,
      });
    }
  };
};

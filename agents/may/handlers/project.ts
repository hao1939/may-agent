/**
 * project — Project Health Monitor (thin handler)
 *
 * Core logic lives in shared/lib/project-health.ts.
 * This handler scans projects, diagnoses health, and executes actions:
 *   - launch-workflow for active projects
 *   - reactivate/add-comment for blocked projects
 *   - escalate persistent blockers
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../../shared/agent-sdk.ts";
import type { CronEntry } from "../../../shared/agent-sdk.ts";
import {
  parseProjectTasks,
  planProjectTasks,
  updateProjectTaskFields,
  type PlannedProjectTask,
} from "../../../shared/agent-sdk.ts";
import type { ProjectInfo, HealthAction } from "../../../shared/lib/project-health.ts";

async function loadProjectHealth() {
  return await import(`../../../shared/lib/project-health.ts?t=${Date.now()}`) as typeof import("../../../shared/lib/project-health.ts");
}

function normalizeProjectPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .trim()
    .replace(/^agents\//, "")
    .replace(/\/project\.md$/, "")
    .replace(/\/$/, "");
}

function matchesProjectTarget(project: ProjectInfo, target: string | null): boolean {
  if (!target) return true;
  return project.relPath === target || project.projectFile.endsWith(`/${target}/project.md`);
}

function projectIdFor(project: ProjectInfo): string {
  return `${project.owner}/${project.relPath.split("/").pop()}`;
}

function taskSource(taskId: string): string {
  return `project-task:${taskId}`;
}

function taskIdFromSource(source: unknown): string | null {
  if (typeof source !== "string") return null;
  const match = source.match(/^project-task:([^:\s]+)$/);
  return match ? match[1] : null;
}

function projectMaxConcurrent(content: string): number {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const raw = match?.[1].match(/^max_concurrent:\s*(\d+)\s*$/m)?.[1];
  const parsed = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function buildProjectTaskPrompt(project: ProjectInfo, task: PlannedProjectTask): string {
  const deps = task.depends_on.length ? task.depends_on.join(", ") : "none";
  return [
    "## Project Task",
    `Project: ${project.relPath}`,
    `Task ID: ${task.id}`,
    `Assignee: ${task.assignee}`,
    `Dependencies: ${deps}`,
    `Attempt: ${task.attempts + 1}`,
    "",
    "## Goal",
    task.goal,
    "",
    "## Project Context",
    `Read ${project.relPath}/project.md and any files the task explicitly requires.`,
    "Focus on this task only. Do not replan the whole project unless this task cannot proceed.",
    "",
    "## Finish Contract",
    "Use finish({ status: 'success', summary: '...' }) only when this task goal is met.",
    "Use partial when more work on the same task is useful.",
    "Use blocked or failure when owner judgment is needed.",
  ].join("\n");
}

function finishStatus(result: unknown): string {
  const finish = (result as { finishResult?: { status?: unknown } } | null)?.finishResult;
  return typeof finish?.status === "string" ? finish.status : "";
}

function updateTaskFile(projectFile: string, taskId: string, patch: Parameters<typeof updateProjectTaskFields>[2]): void {
  const latest = readFileSync(projectFile, "utf-8");
  writeFileSync(projectFile, updateProjectTaskFields(latest, taskId, patch), "utf-8");
}

function activeProjectTaskIds(ctx: HandlerContext, projectId: string): string[] {
  const ids = new Set<string>();
  for (const status of ["running", "idle"]) {
    const rows = ctx.sdk.query.sessions({ projectId, status, limit: 100 }).rows as Array<{ source?: unknown }>;
    for (const row of rows) {
      const taskId = taskIdFromSource(row.source);
      if (taskId) ids.add(taskId);
    }
  }
  return [...ids];
}

function dispatchReadyProjectTasks(
  ctx: HandlerContext,
  project: ProjectInfo,
  projectId: string,
  remainingLaunches: number,
): { handled: boolean; launched: number; reason: string } {
  const parsed = parseProjectTasks(project.content);
  if (parsed.tasks.length === 0) return { handled: false, launched: 0, reason: "no tasks" };
  if (parsed.errors.length > 0) {
    emitSkip(ctx, `Skip ${project.relPath} — invalid task section: ${parsed.errors.join("; ")}`, {
      projectId,
      projectPath: project.relPath,
    });
    return { handled: true, launched: 0, reason: "invalid tasks" };
  }

  const plan = planProjectTasks(parsed.tasks, {
    activeTaskIds: activeProjectTaskIds(ctx, projectId),
    maxConcurrent: projectMaxConcurrent(project.content),
  });
  if (plan.running.length > 0 && plan.dispatchable.length === 0) {
    return { handled: true, launched: 0, reason: "task session running" };
  }
  if (plan.dispatchable.length === 0) {
    return { handled: false, launched: 0, reason: plan.allDone ? "all tasks done" : "no ready tasks" };
  }

  let launched = 0;
  for (const task of plan.dispatchable.slice(0, remainingLaunches)) {
    const attempts = task.attempts + 1;
    updateTaskFile(project.projectFile, task.id, { status: "running", attempts });
    const source = taskSource(task.id);
    const prompt = buildProjectTaskPrompt(project, task);
    ctx.sdk.log("info", `[project] Dispatching task ${project.relPath}#${task.id} to ${task.assignee}`);
    ctx.sdk.emit("project.task.dispatched", {
      projectId,
      projectPath: project.relPath,
      taskId: task.id,
      assignee: task.assignee,
    });

    ctx.sdk.runAgent(task.assignee, prompt, { source, projectId })
      .then((result: any) => {
        const status = finishStatus(result);
        if (result?.status === "done" && status === "success") {
          updateTaskFile(project.projectFile, task.id, { status: "done", result: "succeeded" });
        } else {
          updateTaskFile(project.projectFile, task.id, { status: "ready", result: null });
        }
        ctx.sdk.emit("project.task.finished", {
          projectId,
          projectPath: project.relPath,
          taskId: task.id,
          assignee: task.assignee,
          sessionId: result?.sessionId ?? null,
          status: result?.status ?? "unknown",
          finishStatus: status || null,
        });
      })
      .catch((e: any) => {
        updateTaskFile(project.projectFile, task.id, { status: "ready", result: null });
        ctx.sdk.emit("project.task.finished", {
          projectId,
          projectPath: project.relPath,
          taskId: task.id,
          assignee: task.assignee,
          status: "error",
          error: e?.message?.slice(0, 200) ?? String(e).slice(0, 200),
        });
      });
    launched++;
  }

  return { handled: true, launched, reason: `launched ${launched} task(s)` };
}

export function resolveWorkflowName(project: ProjectInfo): string | null {
  const configured = project.workflow || "project";
  if (configured !== "project") return configured;

  const slug = project.relPath.split("/").pop();
  if (!slug) return null;

  const projectWorkflow = resolve(dirname(project.projectFile), "workflows", `${slug}-iteration.ts`);
  return existsSync(projectWorkflow) ? `${slug}-iteration` : null;
}

function emitSkip(ctx: HandlerContext, reason: string, data: Record<string, unknown> = {}): void {
  ctx.sdk.log("info", `[project] ${reason}`);
  try {
    ctx.sdk.emit("handler.skipped", {
      handler: "project",
      reason,
      ...data,
    });
  } catch { /* best-effort */ }
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const projectsRoot = ctx.sdk.paths.projects ?? resolve(ctx.sdk.paths.root, "projects");
  const stateFile = resolve(ctx.sdk.paths.root, ".state/project-health-state.json");

  return async (event?: TriggerEvent) => {
    const ph = await loadProjectHealth();
    const now = Date.now();
    const healthState = ph.readHealthState(stateFile);

    const projects = ph.scanAllProjects({ projectsRoot });
    if (projects.length === 0) {
      emitSkip(ctx, "No projects found.", { eventType: event?.type ?? "timer.tick" });
      return;
    }

    const invalidProjects = projects.filter(p => p.formatErrors?.length);
    if (invalidProjects.length > 0) {
      ctx.sdk.log("info", `[project] ${invalidProjects.length} invalid project file(s): ${invalidProjects.map(p => `${p.relPath} (${p.formatErrors!.join("; ")})`).join(", ")}`);
    }

    // Smart preflight: skip if all projects are blocked/waiting/closed and none have changed
    const hasActionable = projects.some(p => p.status === "active");
    if (!hasActionable && event?.type !== "project.nudge" && event?.type !== "trigger.project") {
      const lastScan = healthState.lastFullScan || 0;
      const hasChanges = projects.some(p => {
        try {
          const fs = require("node:fs");
          const projectChanged = fs.statSync(p.projectFile).mtimeMs > lastScan;
          const discussionFile = resolve(dirname(p.projectFile), "discussion.md");
          const discussionChanged = fs.existsSync(discussionFile) && fs.statSync(discussionFile).mtimeMs > lastScan;
          return projectChanged || discussionChanged;
        }
        catch { return false; }
      });
      if (!hasChanges) {
        emitSkip(ctx, "Preflight skip: 0 actionable, no file changes since last scan", { eventType: event?.type ?? "timer.tick" });
        return;
      }
    }

    // Sync projects to DB cache
    try {
      const db = ctx.sdk.getDb();
      for (const p of projects) ph.upsertProject(db, p);
    } catch { /* best-effort */ }

    // Gather system context
    let breachedMetrics = new Set<string>();
    let runningProjects = new Set<string>();
    let liveProjectSessions = new Map<string, string>();
    try {
      for (const a of ctx.sdk.query.alerts({ resolved: false, limit: 500 }).rows)
        if (typeof a.metric_id === "string") breachedMetrics.add(a.metric_id);
      const runningRuns = ctx.sdk.query.workflowRuns({ status: "running", limit: 500 }).rows as Array<{ task?: string | null; workflow?: string | null }>;
      for (const project of projects) {
        const projectDir = dirname(project.projectFile);
        const projectId = projectIdFor(project);
        if (runningRuns.some(run => {
          if (!run.workflow) return false;
          const task = run.task ?? "";
          return task.includes(`project: ${projectDir}`) || task.includes(`project: ${project.relPath}`);
        })) {
          runningProjects.add(projectId);
        }
        const runningSession = (ctx.sdk.query.sessions({ projectId, status: "running", limit: 1 }).rows[0]
          ?? ctx.sdk.query.sessions({ projectId, status: "idle", limit: 1 }).rows[0]) as { sessionId?: string } | undefined;
        if (runningSession?.sessionId) {
          runningProjects.add(projectId);
          liveProjectSessions.set(projectId, runningSession.sessionId);
        }
      }
    } catch { /* skip */ }

    // Track blocker changes
    for (const project of projects) {
      if (!healthState.projects[project.relPath]) {
        healthState.projects[project.relPath] = ph.newProjectHealthEntry();
      }
      const pState = healthState.projects[project.relPath];
      const currentStatus = project.status;
      if (currentStatus === "blocked" || currentStatus === "waiting") {
        const blockerHash = ph.simpleHash(project.blockerReason);
        if (pState.blockerHash && blockerHash && pState.blockerHash !== blockerHash) {
          pState.lastStatusChange = now;
          pState.lastEscalation = 0;
        } else if (pState.lastStatusChange === 0) {
          pState.lastStatusChange = now;
        }
        pState.blockerHash = blockerHash;
      } else if (currentStatus === "active" && pState.lastStatusChange !== 0) {
        pState.lastStatusChange = 0;
        pState.blockerHash = "";
        pState.lastEscalation = 0;
      }
    }

    // Diagnose each project
    const actions: Array<{ project: ProjectInfo; action: HealthAction }> = [];
    const targetProject = normalizeProjectPath(event?.data?.projectPath);
    const commentNudge = event?.type === "project.nudge" && event?.data?.comment === true && !!targetProject;
    for (const project of projects) {
      if (targetProject && !matchesProjectTarget(project, targetProject)) continue;
      const forceLaunch = event?.type === "trigger.project" || commentNudge;
      actions.push({ project, action: ph.diagnoseProject(project, healthState, breachedMetrics, runningProjects, now, projects, forceLaunch) });
    }
    if (targetProject && actions.length === 0) {
      emitSkip(ctx, `Target project not found: ${targetProject}`, { eventType: event?.type ?? "timer.tick", projectPath: targetProject });
    }

    // Log non-trivial actions
    const counts: Record<string, number> = {};
    for (const { action } of actions) counts[action.type] = (counts[action.type] ?? 0) + 1;
    if (Object.keys(counts).some(k => k !== "skip")) {
      ctx.sdk.log("info", `[project] ${projects.length} projects — ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(", ")}`);
    }

    // Execute actions
    let launched = 0;
    for (const { project, action } of actions) {
      const pState = healthState.projects[project.relPath];
      const projectId = projectIdFor(project);

      if (project.status === "active" && !project.formatErrors?.length && launched < ph.MAX_LAUNCHES_PER_TICK) {
        const taskDispatch = dispatchReadyProjectTasks(ctx, project, projectId, ph.MAX_LAUNCHES_PER_TICK - launched);
        if (taskDispatch.handled) {
          if (taskDispatch.launched > 0) {
            pState.lastLaunch = now;
            if (!pState.launchTimestamps) pState.launchTimestamps = [];
            pState.launchTimestamps = pState.launchTimestamps.filter((t: number) => now - t < 7200_000);
            pState.launchTimestamps.push(now);
            pState.consecutiveSkips = 0;
            launched += taskDispatch.launched;
          }
          continue;
        }
      }

      if (action.type === "skip") {
        const liveSessionId = liveProjectSessions.get(projectId);
        if (commentNudge && liveSessionId) {
          const comment = typeof event?.data?.commentText === "string" ? event.data.commentText : "A new project comment was added.";
          ctx.sdk.log("info", `[project] Steering live project session ${liveSessionId} for ${project.relPath}: ${action.reason}`);
          ctx.sdk.emit("steer", {
            sessionId: liveSessionId,
            source: "project-comment",
            message:
              `[project comment]\n${comment}\n\n` +
              `This comment is now part of ${project.relPath}/discussion.md. Treat it as current human direction. ` +
              `If it changes the goal, scope, or next step, adjust your work now and finish promptly so the project reviewer can update project.md.`,
          });
          pState.consecutiveSkips = 0;
          continue;
        }
        if (project.status !== "closed") pState.consecutiveSkips++;
        continue;
      }

      if (action.type === "reactivate") {
        ctx.sdk.log("info", `[project] Reactivating ${project.relPath}: ${action.reason}`);
        const content = ph.updateField(project.content, "Status", "active");
        writeFileSync(project.projectFile, content, "utf-8");
        ph.appendDiscussionComment(dirname(project.projectFile), action.reason, "project-handler");
        pState.reactivationAttempts++;
        pState.blockerHash = "";
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "add-comment") {
        ctx.sdk.log("info", `[project] Comment on ${project.relPath}: ${action.reason}`);
        const content = ph.updateField(project.content, "Status", "active");
        writeFileSync(project.projectFile, content, "utf-8");
        ph.appendDiscussionComment(dirname(project.projectFile), action.comment, "project-handler");
        pState.reactivationAttempts++;
        pState.blockerHash = ph.simpleHash(project.blockerReason);
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "escalate") {
        ctx.sdk.log("info", `[project] Escalating ${project.relPath}: ${action.reason}`);
        pState.lastEscalation = now;
        try { ctx.sdk.message("human", `🚨 Project needs attention: ${project.relPath}\nStatus: ${project.status}\nReason: ${action.reason}\nBlocker: ${project.blockerReason.slice(0, 200)}`); } catch { /* skip */ }
        continue;
      }

      // launch-workflow
      if (launched >= ph.MAX_LAUNCHES_PER_TICK) {
        emitSkip(ctx, `Skip ${project.relPath} — cap reached`, {
          eventType: event?.type ?? "timer.tick",
          projectId: projectIdFor(project),
          projectPath: project.relPath,
        });
        continue;
      }

      const workflowName = resolveWorkflowName(project);
      if (!workflowName) {
        emitSkip(ctx, `Skip ${project.relPath} — workflow: project has no ${project.relPath.split("/").pop()}-iteration.ts implementation`, {
          eventType: event?.type ?? "timer.tick",
          projectId,
          projectPath: project.relPath,
        });
        continue;
      }
      const projectDir = dirname(project.projectFile);
      const task = `project: ${projectDir}\nagent: ${project.owner}\ngoal: see project file`;

      ctx.sdk.log("info", `[project] Launching ${project.relPath} (workflow: ${workflowName}): ${action.reason}`);

      if (project.status !== "active") {
        let content = ph.updateField(project.content, "Status", "active");
        content = ph.updateField(content, "Stop Reason", "");
        content = ph.updateField(content, "Resume Condition", "");
        content = ph.updateField(content, "Resume After", "");
        writeFileSync(project.projectFile, content, "utf-8");
      }

      ctx.sdk.runWorkflow(workflowName, task, { source: project.owner, projectId })
        .then((r) => {
          ctx.sdk.log("info", `[project] ${project.relPath} → ${r.status}${r.runId ? ` (${r.runId})` : ""}`);
          ctx.sdk.emit("handler.workflow_dispatched", {
            handler: "project",
            workflow: workflowName,
            source: project.owner,
            projectId,
            projectPath: project.relPath,
            workflowRunId: r.runId ?? null,
            status: r.status,
            reason: action.reason,
          });
        })
        .catch((e: any) => {
          const message = e.message?.slice(0, 200) ?? String(e).slice(0, 200);
          ctx.sdk.log("info", `[project] ${project.relPath} ERROR: ${message}`);
          ctx.sdk.emit("handler.failed", {
            handler: "project",
            agent: ctx.agentName,
            projectId,
            projectPath: project.relPath,
            workflow: workflowName,
            error: message,
            durationMs: 0,
          });
        });

      pState.lastLaunch = now;
      if (!pState.launchTimestamps) pState.launchTimestamps = [];
      pState.launchTimestamps = pState.launchTimestamps.filter((t: number) => now - t < 7200_000);
      pState.launchTimestamps.push(now);
      pState.consecutiveSkips = 0;
      launched++;
      try { ctx.sdk.emit("project.iteration", { projectId }); } catch {}
    }

    healthState.lastFullScan = now;
    ph.writeHealthState(stateFile, healthState);

    if (launched > 0) {
      const source = event?.source ?? "timer";
      ctx.sdk.emit("metric", { name: source === "timer" ? "handler.project.timer-catches" : "handler.project.event-triggers", value: launched });
      ctx.sdk.log("info", `[project] Launched ${launched} workflow(s) [trigger: ${event?.type ?? "timer.tick"}]`);
    }
  };
};

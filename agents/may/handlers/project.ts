/**
 * project — Project Health Monitor (thin handler)
 *
 * Core logic lives in shared/lib/project-health.ts.
 * This handler scans projects, diagnoses health, and executes actions:
 *   - dispatch project tasks for active projects
 *   - launch the owner agent when the project itself needs judgment
 *   - reactivate/add-comment for blocked projects
 *   - escalate persistent blockers
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";
import {
  parseProjectTasks,
  planProjectTasks,
  updateProjectTaskFields,
  type PlannedProjectTask,
} from "@may-agent/sdk";
import type { ProjectInfo, HealthAction } from "../../../shared/lib/project-health.ts";

async function loadProjectHealth(root: string) {
  const hotLoadPath = resolve(root, "shared/lib/project-health.ts");
  if (!existsSync(hotLoadPath)) {
    return await import("../../../shared/lib/project-health.ts") as typeof import("../../../shared/lib/project-health.ts");
  }

  const moduleUrl = pathToFileURL(hotLoadPath);
  moduleUrl.searchParams.set("t", String(Date.now()));
  return await import(moduleUrl.href) as typeof import("../../../shared/lib/project-health.ts");
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

const OWNER_SOURCE = "project-owner";

function taskIdFromSource(source: unknown): string | null {
  if (typeof source !== "string") return null;
  const match = source.match(/^project-task:([^:\s]+)$/);
  return match ? match[1] : null;
}

function taskIdFromProjectTaskPrompt(task: unknown): string | null {
  if (typeof task !== "string") return null;
  const match = task.match(/^Task ID:\s*([^\s]+)\s*$/m);
  return match ? match[1] : null;
}

function projectMaxConcurrent(content: string): number {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const raw = match?.[1].match(/^max_concurrent:\s*(\d+)\s*$/m)?.[1];
  const parsed = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function projectMaxTaskAttempts(content: string): number {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const raw = match?.[1].match(/^max_task_attempts:\s*(\d+)\s*$/m)?.[1];
  const parsed = raw ? Number.parseInt(raw, 10) : 2;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

function buildProjectTaskPrompt(project: ProjectInfo, task: PlannedProjectTask): string {
  const deps = task.depends_on.length ? task.depends_on.join(", ") : "none";
  const runner = task.run ?? "agent";
  return [
    "## Project Task",
    `Project: ${project.relPath}`,
    `Task ID: ${task.id}`,
    `Assignee: ${task.assignee}`,
    `Runner: ${runner}`,
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

function buildProjectOwnerPrompt(project: ProjectInfo, reason: string): string {
  return [
    "## Project Owner Loop",
    `Project: ${project.relPath}`,
    `Owner: ${project.owner}`,
    `Reason: ${reason}`,
    "",
    "## Context",
    `Read ${project.relPath}/project.md and related project files before changing state.`,
    "You own the project loop: assess current state, update tasks, replan, close, wait, or escalate.",
    "Do not run the legacy project iteration workflow. Work through project.md tasks and normal agent/tool actions.",
    "",
    "## Finish Contract",
    "Use finish({ status: 'success', summary: '...' }) after project.md reflects the next correct state.",
  ].join("\n");
}

function finishStatus(result: unknown): string {
  const finish = (result as { finishResult?: { status?: unknown } } | null)?.finishResult;
  return typeof finish?.status === "string" ? finish.status : "";
}

function workflowNameForTask(task: PlannedProjectTask): string | null {
  const run = task.run ?? "agent";
  if (!run.startsWith("workflow:")) return null;
  const workflow = run.slice("workflow:".length).trim();
  return workflow || null;
}

function taskCompletedSuccessfully(task: PlannedProjectTask, result: any): boolean {
  if (result?.status !== "done") return false;
  const status = finishStatus(result);
  return workflowNameForTask(task) ? status !== "failure" && status !== "blocked" : status === "success";
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
  const workflowRows = ctx.sdk.query.workflowRuns({ projectId, status: "running", limit: 100 }).rows as Array<{ task?: unknown }>;
  for (const row of workflowRows) {
    const taskId = taskIdFromProjectTaskPrompt(row.task);
    if (taskId) ids.add(taskId);
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

  const maxTaskAttempts = projectMaxTaskAttempts(project.content);
  const needsOwnerJudgment = plan.dispatchable.find(task => task.attempts >= maxTaskAttempts);
  if (needsOwnerJudgment) {
    return {
      handled: false,
      launched: 0,
      reason: `task ${needsOwnerJudgment.id} reached ${needsOwnerJudgment.attempts}/${maxTaskAttempts} attempts`,
    };
  }

  let launched = 0;
  for (const task of plan.dispatchable.slice(0, remainingLaunches)) {
    const attempts = task.attempts + 1;
    updateTaskFile(project.projectFile, task.id, { status: "running", attempts });
    const source = taskSource(task.id);
    const prompt = buildProjectTaskPrompt(project, task);
    const workflowName = workflowNameForTask(task);
    ctx.sdk.log("info", `[project] Dispatching task ${project.relPath}#${task.id} to ${task.assignee}`);
    ctx.sdk.emit("project.task.dispatched", {
      projectId,
      projectPath: project.relPath,
      taskId: task.id,
      assignee: task.assignee,
      runner: workflowName ? "workflow" : "agent",
      workflow: workflowName,
    });

    const run = workflowName
      ? ctx.sdk.runWorkflow(workflowName, prompt, { source, projectId })
      : ctx.sdk.runAgent(task.assignee, prompt, { source, projectId });

    run
      .then((result: any) => {
        const status = finishStatus(result);
        if (taskCompletedSuccessfully(task, result)) {
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
          workflowRunId: result?.runId ?? null,
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

function launchProjectOwner(
  ctx: HandlerContext,
  project: ProjectInfo,
  projectId: string,
  reason: string,
  ownerLoopsInFlight: Set<string>,
): void {
  if (ownerLoopsInFlight.has(projectId)) {
    emitSkip(ctx, `Skip ${project.relPath} — project owner already running`, {
      projectId,
      projectPath: project.relPath,
    });
    return;
  }

  const prompt = buildProjectOwnerPrompt(project, reason);
  ctx.sdk.log("info", `[project] Launching owner ${project.owner} for ${project.relPath}: ${reason}`);
  ctx.sdk.emit("project.owner.dispatched", {
    projectId,
    projectPath: project.relPath,
    owner: project.owner,
    reason,
  });

  ownerLoopsInFlight.add(projectId);
  let run: Promise<any>;
  try {
    run = ctx.sdk.runAgent(project.owner, prompt, { source: OWNER_SOURCE, projectId });
  } catch (e: any) {
    ownerLoopsInFlight.delete(projectId);
    const message = e.message?.slice(0, 200) ?? String(e).slice(0, 200);
    ctx.sdk.log("info", `[project] ${project.relPath} owner ERROR: ${message}`);
    ctx.sdk.emit("handler.failed", {
      handler: "project",
      agent: ctx.agentName,
      projectId,
      projectPath: project.relPath,
      owner: project.owner,
      error: message,
      durationMs: 0,
    });
    return;
  }

  run
    .then((result: any) => {
      ctx.sdk.emit("project.owner.finished", {
        projectId,
        projectPath: project.relPath,
        owner: project.owner,
        sessionId: result?.sessionId ?? null,
        status: result?.status ?? "unknown",
        finishStatus: finishStatus(result) || null,
      });
    })
    .catch((e: any) => {
      const message = e.message?.slice(0, 200) ?? String(e).slice(0, 200);
      ctx.sdk.log("info", `[project] ${project.relPath} owner ERROR: ${message}`);
      ctx.sdk.emit("handler.failed", {
        handler: "project",
        agent: ctx.agentName,
        projectId,
        projectPath: project.relPath,
        owner: project.owner,
        error: message,
        durationMs: 0,
      });
    })
    .finally(() => {
      ownerLoopsInFlight.delete(projectId);
    });
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const projectsRoot = ctx.sdk.paths.projects ?? resolve(ctx.sdk.paths.root, "projects");
  const stateFile = resolve(ctx.sdk.paths.root, ".state/project-health-state.json");
  const ownerLoopsInFlight = new Set<string>();

  return async (event?: EventEnvelope) => {
    const ph = await loadProjectHealth(ctx.sdk.paths.root);
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
    let ownerRunningProjects = new Set<string>();
    let liveProjectSessions = new Map<string, string>();
    try {
      for (const a of ctx.sdk.query.alerts({ resolved: false, limit: 500 }).rows)
        if (typeof a.metric_id === "string") breachedMetrics.add(a.metric_id);
      for (const project of projects) {
        const projectId = projectIdFor(project);
        if (ownerLoopsInFlight.has(projectId)) ownerRunningProjects.add(projectId);

        const projectSessions = [
          ...ctx.sdk.query.sessions({ projectId, status: "running", limit: 100 }).rows,
          ...ctx.sdk.query.sessions({ projectId, status: "idle", limit: 100 }).rows,
        ] as Array<{ sessionId?: string; source?: unknown }>;
        const liveSession = projectSessions.find(row => row.sessionId);
        if (liveSession?.sessionId) {
          liveProjectSessions.set(projectId, liveSession.sessionId);
        }
        if (projectSessions.some(row => row.source === OWNER_SOURCE)) {
          ownerRunningProjects.add(projectId);
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
    const projectNudge = event?.type === "project.nudge" && !!targetProject;
    const commentNudge = projectNudge && event?.data?.comment === true;
    const taskFinishedNudge = event?.type === "project.task.finished" && !!targetProject;
    for (const project of projects) {
      if (targetProject && !matchesProjectTarget(project, targetProject)) continue;
      const forceLaunch = event?.type === "trigger.project" || projectNudge || taskFinishedNudge;
      actions.push({ project, action: ph.diagnoseProject(project, healthState, breachedMetrics, ownerRunningProjects, now, projects, forceLaunch) });
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

      // launch owner agent
      if (launched >= ph.MAX_LAUNCHES_PER_TICK) {
        emitSkip(ctx, `Skip ${project.relPath} — cap reached`, {
          eventType: event?.type ?? "timer.tick",
          projectId: projectIdFor(project),
          projectPath: project.relPath,
        });
        continue;
      }

      if (project.status !== "active") {
        let content = ph.updateField(project.content, "Status", "active");
        content = ph.updateField(content, "Stop Reason", "");
        content = ph.updateField(content, "Resume Condition", "");
        content = ph.updateField(content, "Resume After", "");
        writeFileSync(project.projectFile, content, "utf-8");
      }

      launchProjectOwner(ctx, project, projectId, action.reason, ownerLoopsInFlight);

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
      ctx.sdk.log("info", `[project] Launched ${launched} project action(s) [trigger: ${event?.type ?? "timer.tick"}]`);
    }
  };
};

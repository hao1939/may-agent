/**
 * project — Project Health Monitor (thin handler)
 *
 * Core logic lives in shared/lib/project-health.ts.
 * This handler scans projects, diagnoses health, and executes actions:
 *   - launch-workflow for active projects
 *   - reactivate/add-comment for blocked projects
 *   - escalate persistent blockers
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../../shared/agent-sdk.ts";
import type { CronEntry } from "../../../shared/agent-sdk.ts";
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

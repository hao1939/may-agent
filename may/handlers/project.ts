/**
 * project — Project Health Monitor (thin handler)
 *
 * Core logic lives in agents/shared/lib/project-health.ts.
 * This handler scans projects, diagnoses health, and executes actions:
 *   - launch-workflow for active projects
 *   - reactivate/add-comment for blocked projects
 *   - escalate persistent blockers
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";
import type { ProjectInfo, HealthAction } from "../../shared/lib/project-health.ts";

async function loadProjectHealth() {
  return await import(`../../shared/lib/project-health.ts?t=${Date.now()}`) as typeof import("../../shared/lib/project-health.ts");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.sdk.paths.root, "agents");
  const stateFile = resolve(ctx.sdk.paths.root, ".state/project-health-state.json");

  return async (event?: TriggerEvent) => {
    const ph = await loadProjectHealth();
    const now = Date.now();
    const healthState = ph.readHealthState(stateFile);

    const projects = ph.scanAllProjects(agentsRoot);
    if (projects.length === 0) return;

    const invalidProjects = projects.filter(p => p.formatErrors?.length);
    if (invalidProjects.length > 0) {
      ctx.sdk.log("info", `[project] ${invalidProjects.length} invalid project file(s): ${invalidProjects.map(p => `${p.relPath} (${p.formatErrors!.join("; ")})`).join(", ")}`);
    }

    // Smart preflight: skip if all projects are blocked/waiting/closed and none have changed
    const hasActionable = projects.some(p => p.status === "active" || p.status === "paused");
    if (!hasActionable && event?.type !== "project.nudge" && event?.type !== "trigger.project") {
      const lastScan = healthState.lastFullScan || 0;
      const hasChanges = projects.some(p => {
        try { const stat = require("node:fs").statSync(p.projectFile); return stat.mtimeMs > lastScan; }
        catch { return false; }
      });
      if (!hasChanges) {
        ctx.sdk.log("info", `[project] Preflight skip: 0 actionable, no file changes since last scan`);
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
    try {
      const db = ctx.sdk.getDb();
      for (const a of db.prepare("SELECT metric_id FROM metric_alerts WHERE resolved_at IS NULL").all() as Array<{ metric_id: string }>)
        breachedMetrics.add(a.metric_id);
      const runningRuns = db.prepare(
        "SELECT task FROM workflow_runs WHERE status = 'running' AND workflow IS NOT NULL"
      ).all() as Array<{ task?: string | null }>;
      for (const project of projects) {
        const projectDir = dirname(project.projectFile);
        const projectId = `${project.owner}/${project.relPath.split("/").pop()}`;
        if (runningRuns.some(run => {
          const task = run.task ?? "";
          return task.includes(`project: ${projectDir}`) || task.includes(`project: ${project.relPath}`);
        })) {
          runningProjects.add(projectId);
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
    const forceLaunch = event?.type === "trigger.project";
    for (const project of projects) {
      actions.push({ project, action: ph.diagnoseProject(project, healthState, breachedMetrics, runningProjects, now, projects, forceLaunch) });
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

      if (action.type === "skip") { if (project.status !== "closed") pState.consecutiveSkips++; continue; }

      if (action.type === "reactivate") {
        ctx.sdk.log("info", `[project] Reactivating ${project.relPath}: ${action.reason}`);
        let content = ph.appendComment(ph.updateField(project.content, "Status", "active"), action.reason);
        writeFileSync(project.projectFile, content, "utf-8");
        pState.reactivationAttempts++;
        pState.blockerHash = "";
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "add-comment") {
        ctx.sdk.log("info", `[project] Comment on ${project.relPath}: ${action.reason}`);
        let content = ph.updateField(ph.appendComment(project.content, action.comment), "Status", "active");
        writeFileSync(project.projectFile, content, "utf-8");
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
      if (launched >= ph.MAX_LAUNCHES_PER_TICK) { ctx.sdk.log("info", `[project] Skip ${project.relPath} — cap reached`); continue; }

      const workflowName = project.workflow || "project";
      const projectDir = dirname(project.projectFile);
      const task = `project: ${projectDir}\nagent: ${project.owner}\ngoal: see project file`;

      ctx.sdk.log("info", `[project] Launching ${project.relPath} (workflow: ${workflowName}): ${action.reason}`);

      ctx.sdk.runWorkflow(workflowName, task, { source: project.owner })
        .then((r) => { ctx.sdk.log("info", `[project] ${project.relPath} → ${r.status}`); })
        .catch((e: any) => { ctx.sdk.log("info", `[project] ${project.relPath} ERROR: ${e.message?.slice(0, 200)}`); });

      pState.lastLaunch = now;
      if (!pState.launchTimestamps) pState.launchTimestamps = [];
      pState.launchTimestamps = pState.launchTimestamps.filter((t: number) => now - t < 7200_000);
      pState.launchTimestamps.push(now);
      pState.consecutiveSkips = 0;
      launched++;
      const projectId = `${project.owner}/${project.relPath.split("/").pop()}`;
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

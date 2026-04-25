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
import { dirname, join, resolve } from "node:path";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";
// Types only — values imported dynamically to avoid Bun's transitive cache
import type { ProjectInfo, HealthAction } from "../../shared/lib/project-health.ts";

async function loadProjectHealth() {
  return await import(`../../shared/lib/project-health.ts?t=${Date.now()}`) as typeof import("../../shared/lib/project-health.ts");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");
  const stateFile = resolve(ctx.projectRoot, ".state/project-health-state.json");
  const inflightFile = resolve(ctx.projectRoot, ".state/project-inflight");
  const workflowsDir = join(agentsRoot, "shared", "workflows");

  return async (event?: TriggerEvent) => {
    const ph = await loadProjectHealth();
    const now = Date.now();
    const healthState = ph.readHealthState(stateFile);
    const inflight = ph.readInflight(inflightFile);

    const projects = ph.scanAllProjects(agentsRoot);
    if (projects.length === 0) return;

    // Gather system context
    let breachedMetrics = new Set<string>();
    let runningProjects = new Set<string>();
    try {
      const db = ctx.getDb();
      for (const a of db.prepare("SELECT metric_id FROM metric_alerts WHERE resolved_at IS NULL").all() as Array<{ metric_id: string }>)
        breachedMetrics.add(a.metric_id);
      for (const r of db.prepare("SELECT DISTINCT projectId FROM sessions WHERE status='running' AND projectId IS NOT NULL").all() as Array<{ projectId: string }>)
        runningProjects.add(r.projectId);
    } catch { /* skip */ }

    // Diagnose each project
    const actions: Array<{ project: ProjectInfo; action: HealthAction }> = [];
    for (const project of projects) {
      actions.push({ project, action: ph.diagnoseProject(project, healthState, breachedMetrics, runningProjects, inflight, now, projects) });
    }

    // Log non-trivial actions
    const counts: Record<string, number> = {};
    for (const { action } of actions) counts[action.type] = (counts[action.type] ?? 0) + 1;
    if (Object.keys(counts).some(k => k !== "skip")) {
      ctx.log(`[project] ${projects.length} projects — ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(", ")}`);
    }

    // Execute actions
    let launched = 0;
    for (const { project, action } of actions) {
      if (!healthState.projects[project.relPath]) {
        healthState.projects[project.relPath] = ph.newProjectHealthEntry();
        healthState.projects[project.relPath].blockerHash = ph.simpleHash(project.blockerReason);
      }
      const pState = healthState.projects[project.relPath];

      if (action.type === "skip") { pState.consecutiveSkips++; continue; }

      // Track status changes for escalation timing
      const currentStatus = project.status;
      if ((currentStatus === "blocked" || currentStatus === "waiting") && pState.lastStatusChange === 0) {
        pState.lastStatusChange = now;
      } else if (currentStatus === "active" && pState.lastStatusChange !== 0) {
        pState.lastStatusChange = 0; // Reset when back to active
      }

      if (action.type === "reactivate") {
        ctx.log(`[project] Reactivating ${project.relPath}: ${action.reason}`);
        let content = ph.appendComment(ph.updateField(project.content, "Status", "active"), action.reason);
        writeFileSync(project.projectFile, content, "utf-8");
        pState.reactivationAttempts++;
        pState.blockerHash = "";
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "add-comment") {
        ctx.log(`[project] Comment on ${project.relPath}: ${action.reason}`);
        let content = ph.updateField(ph.appendComment(project.content, action.comment), "Status", "active");
        writeFileSync(project.projectFile, content, "utf-8");
        pState.reactivationAttempts++;
        pState.blockerHash = ph.simpleHash(project.blockerReason);
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "escalate") {
        ctx.log(`[project] Escalating ${project.relPath}: ${action.reason}`);
        pState.lastEscalation = now;
        try { ctx.notify(`🚨 Project needs attention: ${project.relPath}\nStatus: ${project.status}\nReason: ${action.reason}\nBlocker: ${project.blockerReason.slice(0, 200)}`); } catch { /* skip */ }
        continue;
      }

      // launch-workflow — use unified workflow engine (guards, step tracking, persistence)
      if (launched >= ph.MAX_LAUNCHES_PER_TICK) { ctx.log(`[project] Skip ${project.relPath} — cap reached`); continue; }

      const workflowName = project.workflow || "project";
      const projectDir = dirname(project.projectFile);
      const task = `project: ${projectDir}\nagent: ${project.owner}\ngoal: see project file`;

      ctx.log(`[project] Launching ${project.relPath} (workflow: ${workflowName}): ${action.reason}`);

      inflight.add(project.relPath);
      ph.writeInflight(inflightFile, inflight);

      // Lazy import to avoid circular deps at module level
      import("../../../src/lib/workflow-tool.ts").then(({ runWorkflowDirect }) => {
        runWorkflowDirect({
          workflowName,
          task,
          manager: ctx.manager,
          runtimeCtx: ctx,
          agentName: project.owner,
          persistDir: resolve(ctx.projectRoot, ".state"),
          sharedWorkflowDir: workflowsDir,
          guardsDir: join(agentsRoot, project.owner, "guards"),
          sharedGuardsDir: join(agentsRoot, "shared", "guards"),
          onEvent: (e: any) => { try { ctx.emit(e); } catch { /* skip */ } },
        })
          .then((r) => { ctx.log(`[project] ${project.relPath} → ${r.result.type}`); })
          .catch((e: any) => { ctx.log(`[project] ${project.relPath} ERROR: ${e}`); })
          .finally(() => { inflight.delete(project.relPath); ph.writeInflight(inflightFile, inflight); });
      }).catch((e: any) => {
        ctx.log(`[project] ERROR importing workflow engine: ${e}`);
        inflight.delete(project.relPath);
        ph.writeInflight(inflightFile, inflight);
      });

      pState.lastLaunch = now;
      pState.consecutiveSkips = 0;
      launched++;
    }

    healthState.lastFullScan = now;
    ph.writeHealthState(stateFile, healthState);

    if (launched > 0) {
      const source = event?.source ?? "timer";
      ctx.emit({ type: "metric", name: source === "timer" ? "handler.project.timer-catches" : "handler.project.event-triggers", value: launched });
      ctx.log(`[project] Launched ${launched} workflow(s) [trigger: ${event?.type ?? "timer.tick"}]`);
    }
  };
};

/**
 * project — Project Health Monitor (thin handler)
 *
 * Core logic lives in agents/src/lib/project-health.ts.
 * This handler scans projects, diagnoses health, and executes actions:
 *   - launch-workflow for active projects
 *   - reactivate/add-comment for blocked projects
 *   - escalate persistent blockers
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import {
  type ProjectInfo, type HealthAction, type HealthState,
  scanAllProjects, diagnoseProject, newProjectHealthEntry,
  readInflight, writeInflight, readHealthState, writeHealthState,
  saveWorkflowRunFile, generateRunId, updateField, appendComment, simpleHash,
  MAX_LAUNCHES_PER_TICK,
} from "../../../src/lib/project-health.js";

let importCounter = 0;

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");
  const stateFile = resolve(ctx.projectRoot, ".state/project-health-state.json");
  const inflightFile = resolve(ctx.projectRoot, ".state/project-inflight");
  const workflowPath = join(agentsRoot, "shared", "workflows", "project.ts");

  return async (event?: TriggerEvent) => {
    const now = Date.now();
    const healthState = readHealthState(stateFile);
    const inflight = readInflight(inflightFile);

    const projects = scanAllProjects(agentsRoot);
    if (projects.length === 0) return;

    // Gather system context
    let breachedMetrics = new Set<string>();
    let runningAgents = new Set<string>();
    try {
      const db = ctx.getDb();
      for (const a of db.prepare("SELECT metric_id FROM metric_alerts WHERE resolved_at IS NULL").all() as Array<{ metric_id: string }>)
        breachedMetrics.add(a.metric_id);
      for (const r of db.prepare("SELECT DISTINCT agent FROM sessions WHERE status='running'").all() as Array<{ agent: string }>)
        runningAgents.add(r.agent);
    } catch { /* skip */ }

    // Diagnose each project
    const actions: Array<{ project: ProjectInfo; action: HealthAction }> = [];
    for (const project of projects) {
      actions.push({ project, action: diagnoseProject(project, healthState, breachedMetrics, runningAgents, inflight, now) });
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
        healthState.projects[project.relPath] = newProjectHealthEntry();
        healthState.projects[project.relPath].blockerHash = simpleHash(project.blockerReason);
      }
      const pState = healthState.projects[project.relPath];

      if (action.type === "skip") { pState.consecutiveSkips++; continue; }

      if (action.type === "reactivate") {
        ctx.log(`[project] Reactivating ${project.relPath}: ${action.reason}`);
        let content = appendComment(updateField(project.content, "Status", "active"), action.reason);
        writeFileSync(project.projectFile, content, "utf-8");
        pState.reactivationAttempts++;
        pState.blockerHash = "";
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "add-comment") {
        ctx.log(`[project] Comment on ${project.relPath}: ${action.reason}`);
        let content = updateField(appendComment(project.content, action.comment), "Status", "active");
        writeFileSync(project.projectFile, content, "utf-8");
        pState.reactivationAttempts++;
        pState.blockerHash = simpleHash(project.blockerReason);
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "escalate") {
        ctx.log(`[project] Escalating ${project.relPath}: ${action.reason}`);
        pState.lastEscalation = now;
        try { ctx.notify(`🚨 Project needs attention: ${project.relPath}\nStatus: ${project.status}\nReason: ${action.reason}\nBlocker: ${project.blockerReason.slice(0, 200)}`); } catch { /* skip */ }
        continue;
      }

      // launch-workflow
      if (launched >= MAX_LAUNCHES_PER_TICK) { ctx.log(`[project] Skip ${project.relPath} — cap reached`); continue; }

      let wfMod: any;
      try {
        wfMod = await import(workflowPath + "?t=" + ++importCounter);
        if (typeof wfMod.execute !== "function") throw new Error("No execute()");
      } catch (err) { ctx.log(`[project] ERROR loading workflow: ${err}`); return; }

      const task = `project: ${project.relPath}\nagent: ${project.owner}\ngoal: see project file`;
      const runId = generateRunId();
      ctx.log(`[project] Launching ${project.relPath}: ${action.reason}`);

      const wfRun = { runId, workflow: "project", task, parentSessionId: null as string | null, agent: project.owner, startedAt: Date.now(), status: "running", steps: [] as Array<{ sessionId: string; agent: string; status: string }> };
      saveWorkflowRunFile(ctx.projectRoot, wfRun);

      const workflowCtx = {
        emit: (e: any) => ctx.emit(e), getDb: () => ctx.getDb(), log: (m: string) => ctx.log(m),
        notify: (m: string) => ctx.notify(m), persistDir: ctx.persistDir, projectRoot: ctx.projectRoot,
        agentsRoot: ctx.agentsRoot, task, agent: project.owner,
        runFunction: async (label: string, fn: () => Promise<string>) => {
          const start = Date.now(); let output: string; let hadError = false; let errorMsg: string | undefined;
          try { output = await Promise.race([fn(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 30_000))]); if (output.length > 50_000) output = output.slice(0, 50_000) + "\n…(truncated)";
          } catch (err: any) { hadError = true; errorMsg = err?.message ?? String(err); output = `ERROR: ${errorMsg}`; }
          return { sessionId: `fn_${label}_${Date.now()}`, status: hadError ? "error" : "done", lastAssistantText: output, messages: [], duration: `${((Date.now() - start) / 1000).toFixed(1)}s`, outputDir: "", turnsUsed: 0, ...(hadError && errorMsg ? { error: errorMsg } : {}) };
        },
        runAgent: async (agentName: string, agentTask: string) => {
          const result = await ctx.manager.callAgent(agentName, agentTask, { source: "workflow", workflowRunId: runId, projectId: `${project.owner}/${project.relPath.split("/").pop()}` });
          if (result.sessionId) { wfRun.steps.push({ sessionId: result.sessionId, agent: agentName, status: result.status ?? "done" }); saveWorkflowRunFile(ctx.projectRoot, wfRun); }
          return result;
        },
        runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported" }),
        summarize: (result: any) => { const t = result?.lastAssistantText ?? result?.summary ?? ""; return t.length > 1500 ? t.slice(0, 1500) + "…" : t; },
        done: (summary: string) => ({ type: "done" as const, summary }),
        escalate: (reason: string, context?: unknown) => ({ type: "escalate" as const, reason, context }),
      };

      inflight.add(project.relPath);
      writeInflight(inflightFile, inflight);

      wfMod.execute(workflowCtx)
        .then((r: any) => { ctx.log(`[project] ${project.relPath} → ${r.type}`); wfRun.status = "done"; wfRun.endedAt = Date.now(); saveWorkflowRunFile(ctx.projectRoot, wfRun); })
        .catch((e: any) => { ctx.log(`[project] ${project.relPath} ERROR: ${e}`); wfRun.status = "error"; wfRun.endedAt = Date.now(); saveWorkflowRunFile(ctx.projectRoot, wfRun); })
        .finally(() => { inflight.delete(project.relPath); writeInflight(inflightFile, inflight); });

      pState.lastLaunch = now;
      pState.consecutiveSkips = 0;
      launched++;
    }

    healthState.lastFullScan = now;
    writeHealthState(stateFile, healthState);

    if (launched > 0) {
      const source = event?.source ?? "timer";
      ctx.emit({ type: "metric", name: source === "timer" ? "handler.project.timer-catches" : "handler.project.event-triggers", value: launched });
      ctx.log(`[project] Launched ${launched} workflow(s) [trigger: ${event?.type ?? "timer.tick"}]`);
    }
  };
};

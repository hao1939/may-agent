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
import { shouldDispatch, recordDispatch, recordOutcome } from "../../shared/workflows/dispatch-dedup-guard.js";
import { dirname, join, resolve } from "node:path";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";
// Types only — values imported dynamically to avoid Bun's transitive cache
import type { ProjectInfo, HealthAction } from "../../shared/lib/project-health.ts";

let importCounter = 0;
async function loadProjectHealth() {
  return await import(`../../shared/lib/project-health.ts?t=${Date.now()}`) as typeof import("../../shared/lib/project-health.ts");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");
  const stateFile = resolve(ctx.projectRoot, ".state/project-health-state.json");
  const workflowsDir = join(agentsRoot, "shared", "workflows");

  return async (event?: TriggerEvent) => {
    const saveRun = (run: any) => {
      try {
        const { writeFileSync, mkdirSync } = require("node:fs");
        const { join } = require("node:path");
        const dir = join(ctx.persistDir || ".state", "workflow-runs");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, run.runId + ".json"), JSON.stringify(run), "utf-8");
      } catch {}
    };
    const ph = await loadProjectHealth();
    const now = Date.now();
    const healthState = ph.readHealthState(stateFile);

    const projects = ph.scanAllProjects(agentsRoot);
    if (projects.length === 0) return;

    // Smart preflight: skip if all projects are blocked/waiting/closed and none have changed
    // This prevents 78% no-op wakeups when nothing is actionable
    const hasActionable = projects.some(p => p.status === "active" || p.status === "paused");
    if (!hasActionable && event?.type !== "project.nudge") {
      // Check if any blocked project's file was modified since last scan
      const lastScan = healthState.lastFullScan || 0;
      const hasChanges = projects.some(p => {
        try { const stat = require("node:fs").statSync(p.projectFile); return stat.mtimeMs > lastScan; }
        catch { return false; }
      });
      if (!hasChanges) {
        ctx.log?.(`[project] Preflight skip: 0 actionable, no file changes since last scan`);
        return;
      }
    }

    // Sync projects to DB cache
    try {
      const db = ctx.getDb();
      for (const p of projects) ph.upsertProject(db, p);
    } catch { /* best-effort */ }

    // Gather system context
    let breachedMetrics = new Set<string>();
    let runningProjects = new Set<string>();
    try {
      const db = ctx.getDb();
      for (const a of db.prepare("SELECT metric_id FROM metric_alerts WHERE resolved_at IS NULL").all() as Array<{ metric_id: string }>)
        breachedMetrics.add(a.metric_id);
    } catch { /* skip */ }
    // TODO: Populate this from manager-owned live session state when exposed in HandlerContext.
    // Keep the default as a Set: diagnoseProject calls runningProjects.has(projectId).
    // A previous placeholder assigned [] here, crashing every project handler tick.

    // Diagnose each project
    const actions: Array<{ project: ProjectInfo; action: HealthAction }> = [];
    for (const project of projects) {
      actions.push({ project, action: ph.diagnoseProject(project, healthState, breachedMetrics, runningProjects, now, projects) });
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

      if (action.type === "skip") { if (project.status !== "closed") pState.consecutiveSkips++; continue; }

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


      // Load workflow file directly (no workflow-tool import — it's in the binary, not on disk)
      const wfPath = join(workflowsDir, `${workflowName}.ts`);
      let wfMod: any;
      try {
        wfMod = await import(wfPath + "?t=" + Date.now());
        if (typeof wfMod.execute !== "function") throw new Error("No execute()");
      } catch (err) {
        ctx.log(`[project] ERROR loading workflow "${workflowName}": ${err}`);
        
        continue;
      }

      const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      const wfRun = { runId, workflow: workflowName, task, parentSessionId: null as string | null, agent: project.owner, startedAt: Date.now(), status: "running", steps: [] as Array<{ sessionId: string; agent: string; status: string }> };
      try { saveRun(wfRun); } catch {}

      const workflowCtx = {
        emit: (e: any) => { try { ctx.emit(e); } catch {} },
        getDb: () => ctx.getDb(),
        log: (m: string) => ctx.log(m),
        notify: (m: string) => ctx.notify(m),
        persistDir: ctx.persistDir,
        projectRoot: ctx.projectRoot,
        agentsRoot: ctx.agentsRoot,
        saveWorkflowRun: (r: any) => saveRun(r),
        summarizeForHandoff: (r: any) => r?.lastAssistantText?.slice(0, 500) || "",
        task,
        agent: project.owner,
        runAgent: async (agentName: string, agentTask: string) => {
          const dedupCheck = shouldDispatch(agentName, agentTask);
          if (!dedupCheck.allowed) {
            ctx.log(`[project] Dispatch blocked by dedup guard: ${agentName} — ${dedupCheck.reason}`);
            try { ctx.emit({ type: "dispatch-blocked", agent: agentName, reason: dedupCheck.reason }); } catch {}
            return { sessionId: "", status: "blocked", lastAssistantText: `Blocked: ${dedupCheck.reason}`, messages: [], duration: "0s", outputDir: "", turnsUsed: 0 };
          }
          recordDispatch(agentName, agentTask);
          const result = await ctx.sdk.runAgent(agentName, agentTask, {
            source: "workflow",
            workflowRunId: runId,
            projectId: `${project.owner}/${project.relPath.split("/").pop()}`,
          });
          if (result.sessionId) {
            wfRun.steps.push({ sessionId: result.sessionId, agent: agentName, status: result.status ?? "done" });
            try { saveRun(wfRun); } catch {}
          }
          recordOutcome(agentName, agentTask, result.status === "done" ? "success" : "failure");
          return result;
        },
        runFunction: async (label: string, fn: () => Promise<string>) => {
          const start = Date.now();
          let output: string; let hadError = false; let errorMsg: string | undefined;
          try { output = await Promise.race([fn(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 30_000))]); }
          catch (err: any) { hadError = true; errorMsg = err?.message ?? String(err); output = `ERROR: ${errorMsg}`; }
          return { sessionId: `fn_${label}_${Date.now()}`, status: hadError ? "error" : "done", lastAssistantText: output, messages: [], duration: `${((Date.now() - start) / 1000).toFixed(1)}s`, outputDir: "", turnsUsed: 0 };
        },
        createSession: async (opts: { systemPrompt: string; tools: "full" | "readonly"; label?: string }) => {
          const history: Array<{ role: string; text: string }> = [];
          let lastResponse = "";
          const label = opts.label || "session";
          return {
            async prompt(message: string) {
              let fullPrompt = opts.systemPrompt + "\n\n";
              for (const h of history) { fullPrompt += `[${h.role}]: ${h.text}\n\n`; }
              fullPrompt += message;
              history.push({ role: "user", text: message });
              const result = await ctx.sdk.runAgent(project.owner, fullPrompt, {
                source: `workflow:${label}`,
                projectId: `${project.owner}/${project.relPath.split("/").pop()}`,
              });
              lastResponse = result.lastAssistantText || "";
              history.push({ role: "assistant", text: lastResponse.slice(0, 2000) });
              if (result.sessionId) { wfRun.steps.push({ sessionId: result.sessionId, agent: project.owner, status: result.status ?? "done" }); try { saveRun(wfRun); } catch {} }
            },
            lastText() { return lastResponse; },
            close() {},
          };
        },
        runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported" }),
        summarize: (r: any) => { const t = r?.lastAssistantText ?? r?.summary ?? ""; return t.length > 1500 ? t.slice(0, 1500) + "\u2026" : t; },
        done: (s: string) => ({ type: "done" as const, summary: s }),
        escalate: (r: string, c?: unknown) => ({ type: "escalate" as const, reason: r, context: c }),
        dispatchEvent: (event: string, data?: Record<string, unknown>) => { try { ctx.emit({ type: event, ...(data || {}) } as any); } catch {} },
      };

      wfMod.execute(workflowCtx)
        .then((r: any) => { ctx.log(`[project] ${project.relPath} → ${r.type}`); wfRun.status = "done"; wfRun.endedAt = Date.now(); try { saveRun(wfRun); } catch {} })
        .catch((e: any) => { ctx.log(`[project] ${project.relPath} ERROR: ${e}`); wfRun.status = "error"; wfRun.endedAt = Date.now(); try { saveRun(wfRun); } catch {} })
        .finally(() => {  });

      pState.lastLaunch = now;
      // Track launch timestamps for hourly rate limiting (prune >2h old)
      if (!pState.launchTimestamps) pState.launchTimestamps = [];
      pState.launchTimestamps = pState.launchTimestamps.filter((t: number) => now - t < 7200_000);
      pState.launchTimestamps.push(now);
      pState.consecutiveSkips = 0;
      launched++;
      const projectId = `${project.owner}/${project.relPath.split("/").pop()}`;
      try { ctx.emit({ type: "project.iteration", projectId } as any); } catch {}
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

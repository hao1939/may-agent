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
import {
  type ProjectInfo, type HealthAction, type HealthState,
  scanAllProjects, diagnoseProject, newProjectHealthEntry,
  readInflight, writeInflight, readHealthState, writeHealthState,
  saveWorkflowRunFile, generateRunId, updateField, appendComment, simpleHash,
  MAX_LAUNCHES_PER_TICK,
} from "../../shared/lib/project-health.ts";

let importCounter = 0;

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");
  const stateFile = resolve(ctx.projectRoot, ".state/project-health-state.json");
  const inflightFile = resolve(ctx.projectRoot, ".state/project-inflight");
  const workflowsDir = join(agentsRoot, "shared", "workflows");

  return async (event?: TriggerEvent) => {
    const now = Date.now();
    const healthState = readHealthState(stateFile);
    const inflight = readInflight(inflightFile);

    const projects = scanAllProjects(agentsRoot);
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
      actions.push({ project, action: diagnoseProject(project, healthState, breachedMetrics, runningProjects, inflight, now, projects) });
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

      // Track status changes for escalation timing
      const currentStatus = project.status;
      if ((currentStatus === "blocked" || currentStatus === "waiting") && pState.lastStatusChange === 0) {
        pState.lastStatusChange = now;
      } else if (currentStatus === "active" && pState.lastStatusChange !== 0) {
        pState.lastStatusChange = 0; // Reset when back to active
      }

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

      const workflowName = project.workflow || "project";
      const workflowPath = join(workflowsDir, `${workflowName}.ts`);

      let wfMod: any;
      try {
        wfMod = await import(workflowPath + "?t=" + ++importCounter);
        if (typeof wfMod.execute !== "function") throw new Error("No execute()");
      } catch (err) { ctx.log(`[project] ERROR loading workflow "${workflowName}": ${err}`); continue; }

      const projectDir = dirname(project.projectFile);
      const task = `project: ${projectDir}\nagent: ${project.owner}\ngoal: see project file`;
      const runId = generateRunId();
      ctx.log(`[project] Launching ${project.relPath} (workflow: ${workflowName}): ${action.reason}`);

      const wfRun = { runId, workflow: workflowName, task, parentSessionId: null as string | null, agent: project.owner, startedAt: Date.now(), status: "running", steps: [] as Array<{ sessionId: string; agent: string; status: string }> };
      saveWorkflowRunFile(ctx.projectRoot, wfRun);

      const workflowCtx = {
        emit: (e: any) => ctx.emit(e), getDb: () => ctx.getDb(), log: (m: string) => ctx.log(m),
        notify: (m: string) => ctx.notify(m), persistDir: ctx.persistDir, projectRoot: ctx.projectRoot,
        agentsRoot: ctx.agentsRoot, task, agent: project.owner,
        dispatchEvent: (eventType: string, data?: Record<string, unknown>) => { try { ctx.dispatchEvent?.(eventType, data); } catch { /* skip */ } },
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
        createSession: async (opts: { systemPrompt: string; tools: "full" | "readonly"; label?: string }) => {
          const { Agent } = await import("@mariozechner/pi-agent-core");
          const { getModel } = await import("@mariozechner/pi-ai");
          const { createCodingTools } = await import("../../../src/lib/tools/coding.ts");
          const { createReadTool } = await import("../../../src/lib/tools/read.ts");

          const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "http://localhost:4000";
          const LITELLM_API_KEY = process.env.LITELLM_API_KEY || process.env.ANTHROPIC_API_KEY || "not-needed";
          const model = {
            ...getModel("anthropic", "claude-sonnet-4-20250514"),
            id: "claude-opus-4.6",
            baseUrl: MODEL_BASE_URL,
            contextWindow: 200000,
          };

          const tools = opts.tools === "readonly"
            ? [createReadTool(ctx.projectRoot)]
            : createCodingTools(ctx.projectRoot, { agentName: opts.label || "worker" });

          const agentInstance = new Agent({
            initialState: { systemPrompt: opts.systemPrompt, model, tools: tools as any[] },
            getApiKey: () => LITELLM_API_KEY,
          });

          agentInstance.subscribe(async (event: any) => {
            if (event.type === "tool_execution_start") {
              ctx.log(`  [${opts.label || "session"}] 🔧 ${event.toolName}`);
            }
          });

          return {
            async prompt(message: string) { await agentInstance.prompt(message); },
            lastText() {
              const msgs = agentInstance.state.messages;
              for (let i = msgs.length - 1; i >= 0; i--) {
                const m = msgs[i] as any;
                if (m.role === "assistant") {
                  return (m.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
                }
              }
              return "";
            },
            close() { /* agent GC'd naturally */ },
          };
        },
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

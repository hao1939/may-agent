/**
 * run-workflow — cron handler that dispatches a workflow directly.
 * Loads the workflow .ts file, builds WorkflowContext, calls execute().
 * No imports from src/ — everything inline.
 */
import { existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";
import { shouldDispatch, recordDispatch, recordOutcome } from "../../shared/workflows/dispatch-dedup-guard.js";

let importCounter = 0;

function generateRunId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function findWorkflow(agentDir: string, name: string, sharedDir: string): Promise<any> {
  for (const dir of [join(agentDir, "workflows"), sharedDir]) {
    const path = join(dir, `${name}.ts`);
    if (existsSync(path)) {
      const mod = await import(path + "?t=" + Date.now());
      if (typeof mod.execute === "function") return { ...mod, _path: path };
    }
  }
  throw new Error(`Workflow "${name}" not found`);
}

async function loadGuards(agentsRoot: string, log: (msg: string) => void): Promise<any[]> {
  const guards: any[] = [];
  const guardsDir = join(agentsRoot, "shared", "guards");
  if (!existsSync(guardsDir)) return guards;
  for (const file of readdirSync(guardsDir)) {
    if (!file.endsWith(".ts") || file === "loader.ts") continue;
    try {
      const mod = await import(join(guardsDir, file) + "?t=" + ++importCounter);
      if (mod.guard) { guards.push(mod.guard); log(`[guard-loader] Loaded guard: ${file.replace(".ts", "")} (${file})`); }
    } catch {}
  }
  return guards;
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = entry.handlerConfig as { workflow: string; agent: string; task: string; timeoutMs?: number } | undefined;
  if (!config?.workflow || !config?.agent || !config?.task) {
    return async () => { ctx.log(`[run-workflow:${entry.name}] handlerConfig must include: workflow, agent, task`); };
  }

  return async () => {
    const { workflow: workflowName, agent, task } = config;
    const saveRun = (run: any) => {
      try {
        const dir = join(ctx.persistDir || ".state", "workflow-runs");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, run.runId + ".json"), JSON.stringify(run), "utf-8");
      } catch {}
    };

    ctx.log(`[run-workflow:${entry.name}] Dispatching workflow "${workflowName}" for ${agent}...`);

    const agentDir = join(ctx.agentsRoot, agent);
    const sharedDir = join(ctx.agentsRoot, "shared", "workflows");

    let wf: any;
    try {
      wf = await findWorkflow(agentDir, workflowName, sharedDir);
    } catch (err: any) {
      ctx.log(`[run-workflow:${entry.name}] ERROR: ${err.message}`);
      return;
    }

    const runId = generateRunId();
    const run: any = { runId, workflow: wf.name || workflowName, task, parentSessionId: `cron:${entry.name}`, startedAt: Date.now(), status: "running", steps: [] };
    saveRun(run);

    const guards = await loadGuards(ctx.agentsRoot, (msg) => ctx.log(msg));
    ctx.log(`[run-workflow:${entry.name}] Loaded ${guards.length} workflow guard(s)`);

    const workflowCtx: any = {
      emit: (e: any) => { try { ctx.emit(e); } catch {} },
      getDb: () => ctx.getDb(),
      log: (m: string) => ctx.log(m),
      notify: (m: string) => ctx.notify(m),
      persistDir: ctx.persistDir,
      projectRoot: ctx.projectRoot,
      agentsRoot: ctx.agentsRoot,
      saveWorkflowRun: (r: any) => saveRun(r),
      summarizeForHandoff: (result: any) => result?.lastAssistantText?.slice(0, 500) || "",
      task, agent,
      runAgent: async (agentName: string, agentTask: string) => {
        const dedupCheck = shouldDispatch(agentName, agentTask);
        if (!dedupCheck.allowed) {
          ctx.log(`[run-workflow:${entry.name}] Dispatch blocked by dedup guard: ${agentName} — ${dedupCheck.reason}`);
          return { sessionId: "", status: "blocked", lastAssistantText: `Blocked: ${dedupCheck.reason}`, messages: [], duration: "0s", outputDir: "", turnsUsed: 0 };
        }
        recordDispatch(agentName, agentTask);
        ctx.log(`[run-workflow:${entry.name}] Step: running ${agentName}...`);
        const result = await ctx.manager.callAgent(agentName, agentTask, { source: `workflow:${entry.name}`, workflowRunId: runId });
        run.steps.push({ sessionId: result.sessionId, agent: agentName, status: result.status ?? "done" });
        saveRun(run);
        ctx.log(`[run-workflow:${entry.name}] Step ${agentName} → ${result.status ?? "done"} (${result.sessionId})`);
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
      createSession: async (opts: any) => {
        const history: Array<{ role: string; text: string }> = [];
        let lastResponse = "";
        return {
          async prompt(message: string) {
            let fullPrompt = opts.systemPrompt + "\n\n";
            for (const h of history) { fullPrompt += `[${h.role}]: ${h.text}\n\n`; }
            fullPrompt += message;
            history.push({ role: "user", text: message });
            const result = await ctx.manager.callAgent(agent, fullPrompt, { source: `workflow:${opts.label || "session"}`, workflowRunId: runId });
            lastResponse = result.lastAssistantText || "";
            history.push({ role: "assistant", text: lastResponse.slice(0, 2000) });
            if (result.sessionId) { run.steps.push({ sessionId: result.sessionId, agent, status: result.status ?? "done" }); saveRun(run); }
          },
          lastText() { return lastResponse; },
          close() {},
        };
      },
      createLLMSession: async (opts: any) => workflowCtx.createSession(opts),
      runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported" }),
      summarize: (r: any) => r?.lastAssistantText?.slice(0, 1500) || "",
      done: (s: string) => ({ type: "done" as const, summary: s }),
      escalate: (r: string, c?: unknown) => ({ type: "escalate" as const, reason: r, context: c }),
      dispatchEvent: (event: string, data?: any) => { try { ctx.emit({ type: event, ...data } as any); } catch {} },
    };

    try {
      const result = await wf.execute(workflowCtx);
      run.status = "done"; run.endedAt = Date.now(); saveRun(run);
      ctx.log(`[run-workflow:${entry.name}] Workflow "${workflowName}" done in ${((Date.now() - run.startedAt) / 1000).toFixed(1)}s (${run.steps.length} steps)`);
    } catch (err: any) {
      run.status = "error"; run.endedAt = Date.now(); run.error = err.message; saveRun(run);
      ctx.log(`[run-workflow:${entry.name}] Workflow "${workflowName}" error: ${err.message?.slice(0, 200)}`);
    }
  };
};

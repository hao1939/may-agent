/**
 * run-workflow — cron handler that dispatches a workflow directly (no LLM wrapper).
 *
 * Replaces `run-agent-task` for cron jobs whose sole purpose is to call
 * `workflow.run(name, task)`. Saves 5-10 LLM ops per invocation by skipping
 * the wrapper session that would otherwise read heartbeat + call workflow.
 *
 * cron.json usage:
 *   {
 *     "name": "training-sprint",
 *     "type": "job",
 *     "handler": "run-workflow",
 *     "handlerConfig": {
 *       "workflow": "training-sprint",
 *       "agent": "coach",
 *       "task": "Automated sprint — scan ERROR_LOGs for top error patterns, ..."
 *     }
 *   }
 *
 * Config:
 *   - workflow: name of the workflow to run (must match workflow module's `name` export)
 *   - agent: which agent owns the workflow (determines workflow directory)
 *   - task: the task string passed to the workflow
 *   - timeoutMs: max time to wait (default: 60 min)
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import type {
  WorkflowContext,
  WorkflowModule,
  WorkflowResult,
  WorkflowEvent,
} from "../../../src/lib/workflow.js";
import type { TaskResult } from "../../../src/lib/types.js";
import type { WorkflowRun, WorkflowStep } from "../../../src/lib/persistence.js";

// ── Helpers ────────────────────────────────────────────────────────────

let importCounter = 0;

function generateRunId(): string {
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function loadWorkflow(filePath: string): Promise<WorkflowModule> {
  const mod = await import(filePath + "?t=" + ++importCounter);
  if (typeof mod.name !== "string") {
    throw new Error(`Workflow file ${filePath} must export a 'name' string`);
  }
  if (typeof mod.execute !== "function") {
    throw new Error(`Workflow file ${filePath} must export an 'execute' function`);
  }
  return {
    name: mod.name,
    description: mod.description ?? "(no description)",
    execute: mod.execute,
  };
}

async function findWorkflow(
  workflowDir: string,
  name: string,
  sharedDir?: string,
): Promise<WorkflowModule> {
  const files: string[] = [];

  // Agent-specific workflows
  try {
    const agentFiles = readdirSync(workflowDir)
      .filter((f) => f.endsWith(".ts") && !f.includes("-helpers") && !f.includes("-utils"))
      .sort()
      .map((f) => join(workflowDir, f));
    files.push(...agentFiles);
  } catch {
    // directory may not exist
  }

  // Shared workflows
  if (sharedDir) {
    try {
      const agentNames = new Set(files.map((f) => f.split("/").pop()));
      const sharedFiles = readdirSync(sharedDir)
        .filter((f) => f.endsWith(".ts") && !f.includes("-helpers") && !f.includes("-utils") && !agentNames.has(f))
        .sort()
        .map((f) => join(sharedDir, f));
      files.push(...sharedFiles);
    } catch {
      // directory may not exist
    }
  }

  for (const filePath of files) {
    try {
      const wf = await loadWorkflow(filePath);
      if (wf.name === name) return wf;
    } catch {
      // skip broken workflow files
    }
  }

  throw new Error(`Workflow "${name}" not found in ${workflowDir}`);
}

// ── Factory ────────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig || {}) as {
    workflow: string;
    agent: string;
    task: string;
    timeoutMs?: number;
  };

  if (!config.workflow || !config.agent || !config.task) {
    throw new Error(
      `[run-workflow:${entry.name}] handlerConfig must include: workflow, agent, task`,
    );
  }

  const timeoutMs = config.timeoutMs ?? 3_600_000; // 60 min default

  return async () => {
    const { workflow: workflowName, agent, task } = config;

    ctx.log(`[run-workflow:${entry.name}] Dispatching workflow "${workflowName}" for ${agent}...`);

    // Resolve workflow directory
    const workflowDir = ctx.manager.getWorkflowDir(agent);
    if (!workflowDir) {
      ctx.log(`[run-workflow:${entry.name}] ERROR: No workflow directory for agent "${agent}"`);
      return;
    }
    const sharedDir = join(ctx.agentsRoot, "shared", "workflows");

    // Load the workflow module
    const wf = await findWorkflow(workflowDir, workflowName, sharedDir);

    // Generate run ID and create workflow run record
    const runId = generateRunId();
    const run: WorkflowRun = {
      runId,
      workflow: wf.name,
      task,
      parentSessionId: `cron:${entry.name}`,
      depth: 1,
      startedAt: Date.now(),
      status: "running",
      steps: [],
    };
    ctx.saveWorkflowRun(run);

    // Build the WorkflowContext
    const workflowCtx: WorkflowContext = {
      task,
      agent,

      runFunction: async (label: string, fn: () => Promise<string>): Promise<TaskResult> => {
        const start = Date.now();
        ctx.log(`[run-workflow:${entry.name}] runFunction("${label}")...`);

        let output: string;
        let hadError = false;
        let errorMsg: string | undefined;
        try {
          const timeout = 30_000;
          output = await Promise.race([
            fn(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`runFunction("${label}") timed out after ${timeout}ms`)), timeout),
            ),
          ]);
          // Truncate output to 50KB
          if (output.length > 50_000) {
            output = output.slice(0, 50_000) + "\n…(truncated)";
          }
        } catch (err) {
          hadError = true;
          errorMsg = err instanceof Error ? err.message : String(err);
          output = `ERROR: ${errorMsg}`;
        }
        const duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;
        const taskResult: TaskResult = {
          sessionId: `fn_${label}_${Date.now()}`,
          status: hadError ? "error" : "done",
          lastAssistantText: output,
          messages: [],
          duration,
          outputDir: "",
          turnsUsed: 0,
          ...(hadError && errorMsg ? { error: errorMsg } : {}),
        };

        // Record step
        const wfStep: WorkflowStep = {
          sessionId: taskResult.sessionId,
          agent: `fn:${label}`,
          task: label,
          status: taskResult.status as "done" | "error" | "interrupted",
          startedAt: start,
          endedAt: Date.now(),
          lastAssistantText: output,
        };
        run.steps.push(wfStep);
        ctx.saveWorkflowRun(run);

        ctx.log(`[run-workflow:${entry.name}] runFunction("${label}") → ${taskResult.status} (${duration})`);
        return taskResult;
      },

      runAgent: async (agentName: string, agentTask: string) => {
        ctx.log(`[run-workflow:${entry.name}] Step: running ${agentName}...`);

        const taskResult = await ctx.manager.callAgent(agentName, agentTask, {
          workflowRunId: runId,
          stepLabel: agentName,
          source: "workflow",
        });

        const sid = taskResult.sessionId;

        // Record step
        const wfStep: WorkflowStep = {
          sessionId: sid,
          agent: agentName,
          task: agentTask,
          status: taskResult.status as "done" | "error" | "interrupted",
          startedAt: taskResult.messages[0]?.timestamp ?? Date.now(),
          endedAt: Date.now(),
          lastAssistantText: taskResult.lastAssistantText,
        };
        run.steps.push(wfStep);
        ctx.saveWorkflowRun(run);

        ctx.log(`[run-workflow:${entry.name}] Step ${agentName} → ${taskResult.status} (${sid})`);
        return taskResult;
      },

      runWorkflow: async (_name: string, _task: string) => {
        // Sub-workflow not supported in this handler (keep it simple)
        return { type: "escalate" as const, reason: "Sub-workflows not supported in run-workflow handler" };
      },

      emit: (event: WorkflowEvent) => {
        ctx.log(`[run-workflow:${entry.name}] event: ${event.type}`);
      },

      summarize: (result, opts?) => ctx.summarizeForHandoff(result, opts),

      done: (summary: string) => ({ type: "done" as const, summary }),
      escalate: (reason: string, context?: unknown) => ({ type: "escalate" as const, reason, context }),
    };

    // Execute with timeout
    try {
      const result = await Promise.race([
        wf.execute(workflowCtx),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`Workflow timeout after ${timeoutMs}ms`)),
            timeoutMs,
          );
          if (timer.unref) timer.unref();
        }),
      ]);

      // Finalize run record
      run.endedAt = Date.now();
      run.status = result.type === "done" ? "done" : "escalated";
      run.result = result.type === "done"
        ? { summary: result.summary }
        : { reason: result.reason };
      ctx.saveWorkflowRun(run);

      const duration = ((run.endedAt - run.startedAt) / 1000).toFixed(1);
      ctx.log(
        `[run-workflow:${entry.name}] Workflow "${workflowName}" ${result.type} in ${duration}s ` +
        `(${run.steps.length} steps)`,
      );
    } catch (err) {
      run.endedAt = Date.now();
      run.status = "error";
      run.result = { reason: err instanceof Error ? err.message : String(err) };
      ctx.saveWorkflowRun(run);

      const errMsg = err instanceof Error ? err.message : String(err);
      ctx.log(`[run-workflow:${entry.name}] ERROR: ${errMsg}`);
      throw err;
    }
  };
};

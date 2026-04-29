/**
 * run-workflow — cron handler that dispatches a workflow directly (no LLM wrapper).
 *
 * Delegates to the canonical workflow-tool infrastructure so that:
 * - Workflow runs are tracked in the `workflow_runs` SQLite table
 * - Steps are persisted as sessions with `workflowRunId`
 * - Guards, finish validation, resume all work automatically
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

import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";
import { createWorkflowTool } from "../../../src/lib/workflow-tool.ts";
import type { WorkflowToolResult } from "../../../src/lib/workflow.ts";

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

  return async () => {
    const { workflow: workflowName, agent, task } = config;

    ctx.log(`[run-workflow:${entry.name}] Dispatching workflow "${workflowName}" for ${agent}...`);

    const workflowDir = ctx.manager.getWorkflowDir(agent);
    if (!workflowDir) {
      ctx.log(`[run-workflow:${entry.name}] ERROR: No workflow directory for agent "${agent}"`);
      return;
    }
    const sharedDir = join(ctx.agentsRoot, "shared", "workflows");

    // Delegate to the canonical workflow execution infrastructure
    const tool = createWorkflowTool({
      manager: ctx.manager,
      workflowDir,
      sharedWorkflowDir: sharedDir,
      sharedGuardsDir: join(ctx.agentsRoot, "shared", "guards"),
      persistDir: ctx.persistDir,
      callerSessionId: `cron:${entry.name}`,
      agentName: agent,
      runtimeCtx: ctx as any,
      onEvent: (event) => {
        ctx.emit(event as any);
        const e = event as any;
        if (e.type === "step_done" || e.type === "step_start") {
          ctx.log(`[run-workflow:${entry.name}] ${e.type}: ${e.step ?? e.agent ?? ""}`);
        }
      },
    });

    const result = await tool.execute(`cron:${entry.name}`, {
      action: "run",
      name: workflowName,
      task,
    });

    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    if (parsed.type === "error") {
      ctx.log(`[run-workflow:${entry.name}] ERROR: ${parsed.error}`);
      throw new Error(parsed.error);
    }

    if (parsed.type === "done") {
      ctx.log(`[run-workflow:${entry.name}] Workflow "${workflowName}" done: ${parsed.summary}`);
    } else if (parsed.type === "escalate") {
      ctx.log(`[run-workflow:${entry.name}] Workflow "${workflowName}" escalated: ${(parsed as any).reason}`);
    }
  };
};

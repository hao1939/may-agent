/// <reference path="../../types/workflow-defs.d.ts" />
/**
 * Scout explore — routine discovery cron task.
 *
 * Called by cron with a source-specific task (arXiv, HN, XHS, GitHub).
 * No gates, no heartbeat context loading — just runs the agent with the task.
 */
import { checkCircuitBreaker, recordOutcome } from "../../shared/workflows/circuit-breaker.js";
import { shouldDispatch, recordDispatch, recordOutcome as dedupRecordOutcome, cleanup as dedupCleanup } from "../../shared/workflows/dispatch-dedup-guard.js";

export const name = "scout-explore";
export const description = "Routine discovery — fetch and process a specific source.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "scout";
  const agentsRoot = ctx.agentsRoot || require("path").join(process.cwd(), "agents");

  // Circuit breaker + dedup
  const circuitBlock = checkCircuitBreaker(agentsRoot, agent);
  if (circuitBlock) {
    return ctx.done(`Circuit breaker OPEN: ${circuitBlock}`);
  }
  const dedupCheck = shouldDispatch(agent, "explore");
  if (!dedupCheck.allowed) {
    return ctx.done(`Dedup blocked: ${dedupCheck.reason}`);
  }
  recordDispatch(agent, "explore");
  dedupCleanup();

  // The task comes from cron handlerConfig.task — source-specific instructions
  const task = ctx.task || "Explore sources and update shared knowledge base.";

  let result: any;
  try {
    result = await ctx.runAgent(agent, task);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordOutcome(agentsRoot, agent, true, `explore threw: ${message.slice(0, 200)}`);
    dedupRecordOutcome(agent, "explore", "error");
    throw err;
  }

  recordOutcome(agentsRoot, agent, result.status === "error",
    result.status === "error" ? "explore error" : undefined);
  dedupRecordOutcome(agent, "explore", result.status === "error" ? "error" : "success");

  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}

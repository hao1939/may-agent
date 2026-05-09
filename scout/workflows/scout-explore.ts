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
  const prompt = `${task}

## Finish Hygiene (required before finish(success))
Scout explore usually updates tracked digest, workspace, or shared knowledge files. Do this BEFORE the first finish(success), not only after a guard rejection:
1. After every write/edit/append, verify the changed file with read() (preferred) or a targeted file check for shell-written content.
2. Run \`cd /app/agents && git status --short\` and identify only your intentional deliverables.
3. Stage exact intentional paths only; never use \`git add .\`. If a Scout workspace deliverable is ignored, use \`git add -f -- '<exact path>'\`.
4. Commit intentional deliverables with a descriptive \`scout: ...\` message.
5. Re-run \`cd /app/agents && git status --short\`. Do not stage runtime files like \`scout/last-session.md\`, shared gate logs, or unrelated project files.
6. In finish(success), list deliverables and cite read-back, commit id/output, and status check evidence.`;

  let result: any;
  try {
    result = await ctx.runAgent(agent, prompt);
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

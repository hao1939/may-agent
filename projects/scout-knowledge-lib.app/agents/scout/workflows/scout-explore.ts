/**
 * Scout explore — routine discovery cron task.
 *
 * Called by cron with a source-specific task (arXiv, HN, XHS, GitHub).
 * No gates, no heartbeat context loading — just runs the agent with the task.
 */
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { checkCircuitBreaker, recordCircuitOutcome, shouldDispatch, recordDispatch, recordDedupOutcome, cleanupDispatchRecords } from "@may-agent/sdk";

export const name = "scout-explore";
export const description = "Routine discovery — fetch and process a specific source.";

export function buildExploreTask(task: string): string {
  return `${task}

Output contract:
- Durable Scout notes and findings belong under \`projects/scout-knowledge-lib/knowledge/\`.
- Source-level findings belong under \`projects/scout-knowledge-lib/knowledge/findings/\`.
- Run-level drafts may go under \`agents/scout/workspace/findings/\`.
- Append short user-facing highlights to \`agents/scout/workspace/digest/today.md\` when useful.
- Search existing Scout knowledge files first and update an existing topical file when the topic already exists.
- Never create new top-level folders under \`projects/\`. In particular, do not write paths like \`projects/explore/...\`, \`projects/research/...\`, or \`projects/docs/...\`.
- If none of the allowed output roots fit, finish with a blocker explaining the missing destination instead of inventing a folder.
`;
}

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
  cleanupDispatchRecords();

  // The task comes from the workflow-backed handler config — source-specific instructions
  const task = ctx.task || "Explore sources and update shared knowledge base.";
  const agentTask = buildExploreTask(task);

  let result: any;
  try {
    result = await ctx.runAgent(agent, agentTask);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordCircuitOutcome(agentsRoot, agent, true, `explore threw: ${message.slice(0, 200)}`);
    recordDedupOutcome(agent, "explore", "error");
    throw err;
  }

  recordCircuitOutcome(agentsRoot, agent, result.status === "error",
    result.status === "error" ? "explore error" : undefined);
  recordDedupOutcome(agent, "explore", result.status === "error" ? "error" : "success");

  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}

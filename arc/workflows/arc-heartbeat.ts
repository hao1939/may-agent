/**
 * arc-heartbeat — Heartbeat workflow for arc.
 */

export async function execute(ctx: any): Promise<any> {
  const agent = ctx.agent || "arc";
  const task = ctx.task || "[heartbeat] You are arc. Read agents/arc/heartbeat.md and do your work.";

  ctx.log(`Step: running ${agent}...`);
  const result = await ctx.runAgent(agent, task);
  ctx.log(`Step ${agent} → ${result.status} (${result.sessionId})`);

  return {
    status: result.status === "done" ? "completed" : "error",
    summary: result.lastAssistantText?.slice(0, 500) || "No output",
    iterations: 1,
  };
}

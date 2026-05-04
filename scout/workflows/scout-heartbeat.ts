/**
 * scout-heartbeat — Heartbeat workflow for scout.
 * EXP-870: Now calls runGates() for structural gate enforcement.
 */
import { runGates } from "../../shared/workflows/heartbeat-data.js";
import { join } from "node:path";

export async function execute(ctx: any): Promise<any> {
  const agent = ctx.agent || "scout";
  const agentsRoot = ctx.agentsRoot || join(process.cwd(), "agents");
  const heartbeatStartTime = Date.now();
  const task = ctx.task || "[heartbeat] You are scout. Read agents/scout/heartbeat.md and do your work.";

  ctx.log(`Step: running ${agent}...`);
  const result = await ctx.runAgent(agent, task);
  ctx.log(`Step ${agent} → ${result.status} (${result.sessionId})`);

  return runGates(ctx, agent, agentsRoot, result, heartbeatStartTime);
}

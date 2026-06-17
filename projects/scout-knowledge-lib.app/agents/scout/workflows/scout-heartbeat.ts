import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
/**
 * Scout heartbeat — creative autonomous sessions.
 *
 * Loads context (metrics, projects, inbox) but lets scout decide freely.
 */
import {
  loadMetrics,
  loadProjects,
  loadAlerts,
  loadHeartbeatMd,
  loadInbox,
  formatMetricsBlock,
  runRedMetricCommands,
} from "@may-agent/sdk";
import { checkCircuitBreaker, recordCircuitOutcome, shouldDispatch, recordDispatch, recordDedupOutcome, cleanupDispatchRecords } from "@may-agent/sdk";

export const name = "scout-heartbeat";
export const description = "Scout's creative heartbeat — synthesize, connect, discover.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "scout";
  const agentsRoot = ctx.agentsRoot || require("path").join(process.cwd(), "agents");

  // Circuit breaker + dedup (keep these — they prevent runaway errors)
  const circuitBlock = checkCircuitBreaker(agentsRoot, agent);
  if (circuitBlock) {
    ctx.emit({ type: "circuit_breaker_open", agent, reason: circuitBlock });
    return ctx.done(`Circuit breaker OPEN: ${circuitBlock}`);
  }
  const dedupCheck = shouldDispatch(agent, "heartbeat");
  if (!dedupCheck.allowed) {
    return ctx.done(`Dedup blocked: ${dedupCheck.reason}`);
  }
  recordDispatch(agent, "heartbeat");
  cleanupDispatchRecords();

  // Load context
  const metricsBlock = formatMetricsBlock(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);
  const inbox = loadInbox(ctx, agent);

  const prompt = `You are **scout** in creative heartbeat mode.
persistent-task: skip

Your cron tasks handle routine discovery (fetching arXiv, HN, XHS, GitHub).
This session is for **creative, autonomous work** — things nobody asked you to do:

- Synthesize across sources: what patterns connect recent findings?
- Find non-obvious implications for our agent system
- Make connections between disparate research areas
- Identify emerging trends before they're obvious
- Update or create shared knowledge entries (shared/knowledge/entries/KE-NNN.md)
- Append any notable insights to agents/scout/workspace/digest/today.md

${metricsBlock}

## Alerts
${alerts || "None."}

## Inbox
${inbox || "No pending events."}

## Your Projects
${projects || "No active projects."}

## Guidance
${guidance}

---

Think freely. Go deep on something interesting. The value is in connections and insights that routine fetching can't produce.`;

  ctx.emit({ type: "step_start", step: "heartbeat" });

  let result: any;
  try {
    result = await ctx.runAgent(agent, prompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordCircuitOutcome(agentsRoot, agent, true, `heartbeat threw: ${message.slice(0, 200)}`);
    recordDedupOutcome(agent, "heartbeat", "error");
    throw err;
  }

  recordCircuitOutcome(agentsRoot, agent, result.status === "error",
    result.status === "error" ? "heartbeat session error" : undefined);
  recordDedupOutcome(agent, "heartbeat", result.status === "error" ? "error" : "success");

  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}

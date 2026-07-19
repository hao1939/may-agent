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

export const name = "scout-heartbeat";
export const description =
  "Scout's creative heartbeat — synthesize, connect, discover.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "scout";

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
- Update Scout-owned knowledge notes/findings under projects/scout-knowledge-lib/knowledge/
- Append any notable insights to projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md

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

  const result = await ctx.runAgent(agent, prompt);

  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Scout heartbeat session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
    });
  }
  const summary = ctx.summarize(result, { maxLength: 500 });
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [`session:${result.sessionId}`],
    actions: [],
  });
}

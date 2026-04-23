/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { loadMetrics, formatMetricsBlock, loadProjects, loadAlerts, loadHeartbeatMd, loadInbox } from "../../shared/workflows/heartbeat-data.js";

export const name = "optimizer-heartbeat";
export const description = "optimizer's heartbeat.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "optimizer";

  const metrics = loadMetrics(ctx, agent);
  const metricsBlock = formatMetricsBlock(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);
  const inbox = loadInbox(ctx, agent);

  // ── MAIN HEARTBEAT ─────────────────────────────────────────
  

  const prompt = `You are **${agent}** waking up for your heartbeat.

${metricsBlock}
## Active Alerts
${alerts || "None — all clear."}

## Pending Events (inbox)
${inbox || "No pending events."}
For each: act, delegate, dismiss (with reason), or escalate.

## Your Projects
${projects || "No active projects."}

## Your Role & Guidance
${guidance}

---

Review your metrics, check your projects, do your job. Act on what matters. Commit and finish.`;

  ctx.emit({ type: "step_start", step: "heartbeat" });
  const result = await ctx.runAgent(agent, prompt);
  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}

/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { loadMetrics, formatMetricsBlock, loadProjects, loadAlerts, loadHeartbeatMd, loadInbox, runRedMetricCommands } from "../../shared/workflows/heartbeat-data.js";

export const name = "scout-heartbeat";
export const description = "scout's heartbeat.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "scout";

  const metrics = loadMetrics(ctx, agent);
  const metricsBlock = formatMetricsBlock(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);
  const inbox = loadInbox(ctx, agent);

  // ── RED METRIC GATE (JS — no LLM cost) ──────────────────────
  const hasRedMetrics = metrics.includes("⚠️ BELOW TARGET");
  let redMetricDiagnostics = "";

  if (hasRedMetrics) {
    ctx.emit({ type: "red_metric_gate_start", step: "metrics" });
    // Run mandatory commands in JS instead of spawning an LLM session
    redMetricDiagnostics = runRedMetricCommands(ctx, agent);
    ctx.emit({ type: "red_metric_gate_done", step: "metrics", summary: redMetricDiagnostics ? "JS diagnostics collected" : "no commands to run" });
  }

  // ── MAIN HEARTBEAT ─────────────────────────────────────────
  const redMetricContext = redMetricDiagnostics ? `
${redMetricDiagnostics}

**Review the diagnostic results above.** For each red metric, decide: fix it, escalate it, or defer with a concrete reason.
` : "";

  const prompt = `You are **${agent}** waking up for your heartbeat.

${metricsBlock}
${redMetricContext}
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

${redMetricDiagnostics ? "Red metric diagnostics are above — address each one, then proceed with normal heartbeat work." : "Review your metrics, check your projects, do your job. Act on what matters."} Commit and finish.`;

  ctx.emit({ type: "step_start", step: "heartbeat" });
  const result = await ctx.runAgent(agent, prompt);
  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}

/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { loadMetrics, formatMetricsBlock, loadProjects, loadAlerts, loadHeartbeatMd, loadInbox } from "../../shared/workflows/heartbeat-data.js";

export const name = "bob-heartbeat";
export const description = "bob's heartbeat.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "bob";

  const metrics = loadMetrics(ctx, agent);
  const metricsBlock = formatMetricsBlock(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);
  const inbox = loadInbox(ctx, agent);

  // ── RED METRIC GATE ──────────────────────────────────────────
  const hasRedMetrics = metrics.includes("⚠️ BELOW TARGET");
  let redMetricActions = "";

  if (hasRedMetrics) {
    ctx.emit({ type: "red_metric_gate_start", step: "metrics" });
    const gatePrompt = `You are **${agent}**. You have RED METRICS that must be addressed before your normal heartbeat can proceed.

## ⚠️ RED METRIC GATE — MANDATORY
${metricsBlock}
## Instructions
You CANNOT skip this step. For EACH metric marked "⚠️ BELOW TARGET" above, you must:
1. Run the "→ Quick check" command/query to get current data
2. Investigate WHY it is red (check recent sessions, code changes, etc.)
3. Take ONE of these actions:
   a. **Fix it now** — fork/dispatch work to address the root cause
   b. **Escalate** — notify the responsible agent or may with specifics
   c. **Defer with reason** — explain concretely why you cannot act now (not just "will look later")

Output a section for EACH red metric with your findings and action taken.
Do NOT do any other heartbeat work — ONLY address red metrics.`;

    const gateResult = await ctx.runAgent(agent, gatePrompt);
    redMetricActions = ctx.summarize(gateResult, { maxLength: 800 });

    const redMetricIds = [...metrics.matchAll(/📊 ([^:]+):.*⚠️ BELOW TARGET/g)].map(m => m[1].trim());
    const missedMetrics = redMetricIds.filter(id => !gateResult.includes(id));
    if (missedMetrics.length > 0) {
      const retryPrompt = `You missed addressing these red metrics: ${missedMetrics.join(", ")}\n\nYou MUST address each one now (investigate, fix, escalate, or defer with concrete reason).\n\nMetrics:\n${metrics}`;
      const retryResult = await ctx.runAgent(agent, retryPrompt);
      redMetricActions += "\n" + ctx.summarize(retryResult, { maxLength: 400 });
    }

    ctx.emit({ type: "red_metric_gate_done", step: "metrics", summary: redMetricActions, missed: missedMetrics?.length ?? 0 });
  }

  // ── MAIN HEARTBEAT ─────────────────────────────────────────
  const redMetricContext = redMetricActions ? `
## Red Metric Actions (completed in gate step)
${redMetricActions}
` : "";

  // When gate already handled red metrics, don't show G-pattern "FIRST follow breadcrumbs" (contradicts "already handled")
  const mainMetrics = redMetricActions ? `📊 Metrics summary:\n${metrics}` : metricsBlock;

  const prompt = `You are **${agent}** waking up for your heartbeat.

${mainMetrics}
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

${redMetricActions ? "Your red metrics have been addressed above. Now proceed with your normal heartbeat work." : "Review your metrics, check your projects, do your job. Act on what matters."} Commit and finish.`;

  ctx.emit({ type: "step_start", step: "heartbeat" });
  const result = await ctx.runAgent(agent, prompt);
  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}

/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { loadMetrics, formatMetricsBlock, loadProjects, loadAlerts, loadHeartbeatMd, loadInbox } from "../../shared/workflows/heartbeat-data.js";

export const name = "amy-kimi-heartbeat";
export const description = "amy-kimi's heartbeat.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "amy-kimi";

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
    // Extract MANDATORY commands for explicit instruction
    const mandatoryCmds = [...metricsBlock.matchAll(/→ MANDATORY[:\s]*`([^`]+)`/g)].map(m => m[1]);
    const cmdInstruction = mandatoryCmds.length > 0
      ? `\n\n## ⛔ STOP AND ACT — YOUR FIRST TOOL CALLS:\n${mandatoryCmds.map((c, i) => `${i + 1}. Run: \`bash\` with command: \`${c}\``).join("\n")}\nDo these IMMEDIATELY. Do NOT plan or summarize first.\n`
      : "";

    const gatePrompt = `You are **${agent}**. You have RED METRICS that must be addressed RIGHT NOW.

## ⚠️ RED METRIC GATE — MANDATORY
${metricsBlock}
${cmdInstruction}
## Instructions — READ CAREFULLY
You CANNOT skip this. Your VERY FIRST action must be a tool call (bash, read, or agents.fork).
For EACH metric marked "⚠️ BELOW TARGET":
1. **Execute the MANDATORY command NOW** — literally call the bash tool with that command
2. Read the output and investigate WHY it is red
3. Take action: fix it, escalate it, or fork work to address it

⛔ DO NOT output text first. DO NOT say "let me check". Just make the tool call.
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

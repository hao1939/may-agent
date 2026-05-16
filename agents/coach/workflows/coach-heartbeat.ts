import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { join } from "node:path";
import {
  loadMetrics,
  loadProjects,
  loadAlerts,
  loadHeartbeatMd,
  loadInbox,
  formatMetricsBlock,
  runRedMetricCommands,
} from "../../../shared/workflows/heartbeat-data.js";
import { checkCircuitBreaker, recordCircuitOutcome } from "../../../shared/agent-sdk.ts";

export const name = "coach-heartbeat";
export const description = "coach's 2-phase heartbeat: plan first, then execute.";

function getAgentsRoot(ctx: WorkflowContext): string {
  return ctx.agentsRoot || join(process.cwd(), "agents");
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "coach";
  const agentsRoot = getAgentsRoot(ctx);

  // ── CIRCUIT BREAKER ──
  const circuitBlock = checkCircuitBreaker(agentsRoot, agent);
  if (circuitBlock) {
    ctx.emit({ type: "circuit_breaker_open", agent, reason: circuitBlock });
    return ctx.done(`Circuit breaker OPEN for ${agent}: ${circuitBlock}`);
  }

  // ── LOAD DATA (pure JS) ──
  const metrics = loadMetrics(ctx, agent);
  const metricsBlock = formatMetricsBlock(ctx, agent);
  const projects = loadProjects(ctx, agent);
  const alerts = loadAlerts(ctx, agent);
  const guidance = loadHeartbeatMd(ctx, agent);
  const inbox = loadInbox(ctx, agent);

  const hasRedMetrics = metrics.includes("⚠️ BELOW TARGET");
  let redMetricDiagnostics = "";
  if (hasRedMetrics) {
    ctx.emit({ type: "red_metric_diagnostics_start", step: "metrics" });
    redMetricDiagnostics = runRedMetricCommands(ctx, agent);
    ctx.emit({ type: "red_metric_diagnostics_done", step: "metrics" });
  }

  const redMetricContext = redMetricDiagnostics
    ? `\n${redMetricDiagnostics}\n\n**Review the diagnostic results above.**\n`
    : "";

  const contextBlock = `${metricsBlock}
${redMetricContext}
## Active Alerts
${alerts || "None — all clear."}

## Pending Events (inbox)
${inbox || "No pending events."}

## Your Projects
${projects || "No active projects."}

## Your Role & Guidance
${guidance}`;

  // ── FAST PATH: No-op detection (LLM-to-JS optimization) ──────────────
  // When there's nothing actionable (no red metrics, no alerts, no inbox,
  // no active projects), skip both LLM phases entirely. This eliminates
  // ~50% of coach heartbeat LLM calls that just produce "no action needed".
  const hasAlerts = !!alerts;
  const hasInbox = !!inbox;
  const hasProjects = !!projects;
  if (!hasRedMetrics && !hasAlerts && !hasInbox && !hasProjects) {
    ctx.emit({ type: "noop_fast_path", agent });
    return ctx.done("Coach heartbeat: no action needed (fast-path — no red metrics, no alerts, no inbox, no projects).");
  }

  // ── PHASE 1: TRIAGE & PLAN (short LLM session) ──
  ctx.emit({ type: "step_start", step: "plan" });

  const planPrompt = `You are **coach** waking up for your heartbeat.

${contextBlock}

---

**YOUR TASK: Output a structured plan. Do NOT make any tool calls yet.**

Review everything above, then write EXACTLY this format:

GOAL: [one sentence — what you'll accomplish this heartbeat]
PLAN:
1. [specific action with file/command]
2. [specific action]
3. [specific action]
DONE WHEN: [how you'll verify success before calling finish()]

If there's nothing actionable (all metrics green, no projects, no inbox), write:
GOAL: No action needed
PLAN: none
DONE WHEN: finish() called

Output your plan now. No tool calls.`;

  const planResult = await ctx.runAgent(agent, planPrompt);
  const planText = planResult.lastAssistantText ?? "(no plan produced)";

  ctx.emit({ type: "step_done", step: "plan" });

  // If plan says no action needed, skip phase 2
  if (planText.toLowerCase().includes("no action needed") && !hasRedMetrics && !alerts && !inbox) {
    return ctx.done(`Coach heartbeat: no action needed.\nPlan: ${planText.slice(0, 200)}`);
  }

  // ── PHASE 2: EXECUTE THE PLAN ──
  ctx.emit({ type: "step_start", step: "execute" });

  const execPrompt = `You are **coach** executing your heartbeat plan.

## Your Plan (from Phase 1)
${planText}

## Context
${contextBlock}

---

**Execute the plan above step by step.**
- Follow your plan. Don't re-plan.
- Call finish() with verification_evidence citing specific tool outputs that prove each step completed.
- If a step fails, note it and continue with the next step.`;

  const execResult = await ctx.runAgent(agent, execPrompt);
  recordCircuitOutcome(agentsRoot, agent, execResult.status === "error",
    execResult.status === "error" ? "heartbeat session error" : undefined);

  return ctx.done(ctx.summarize(execResult, { maxLength: 500 }));
}

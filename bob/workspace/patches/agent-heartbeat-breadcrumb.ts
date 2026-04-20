/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * agent-heartbeat — Per-agent heartbeat workflow factory.
 *
 * PATCHED (2026-05-28): Applies the G-pattern (question-first-step) to the
 * check-health step, with inline metrics+breadcrumbs. This addresses the
 * context-discovery breadcrumb gap: breadcrumbs in passive context are ignored
 * (~10% action rate), but breadcrumbs in the structural first step achieve
 * ~100% action rate.
 *
 * See: DESIGN-breadcrumb-production-integration.md
 * Evidence: KE-context-discovery-chain, coach experiment results (2026-04-18)
 */

// ── Types ──────────────────────────────────────────────────────────────

interface AgentHeartbeatConfig {
  agent: string;
  role: string;
  observeInstructions: string;
  dispatchGuidance: string;
  opBudget?: string;
  extraContext?: string;
}

interface StepResult {
  step: string;
  skipped: boolean;
  summary: string;
}

const STEPS = ["check-health", "review-requests", "dispatch-work", "update-context"] as const;
type StepName = typeof STEPS[number];

// ── Metrics loading (inline, no import needed) ─────────────────────────

/**
 * Load the pre-generated heartbeat-context.md for an agent.
 * This file is written by the heartbeat-context handler before the heartbeat runs.
 * Returns the metrics section only (lines starting with "📊" through end of metrics block).
 */
function loadMetricsBlock(agent: string): string {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const contextPath = path.join(process.cwd(), "agents", agent, "workspace", "heartbeat-context.md");
    if (!fs.existsSync(contextPath)) return "";
    const content = fs.readFileSync(contextPath, "utf-8");
    
    // Extract the metrics section
    const metricsStart = content.indexOf("📊 Your Metrics:");
    if (metricsStart === -1) return "";
    
    // Find the end of metrics block (next blank line after all metric lines)
    const metricsSection = content.slice(metricsStart);
    // Take until we hit a line that doesn't start with - or → or 📊 or is blank
    const lines = metricsSection.split("\n");
    const metricsLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (metricsLines.length > 0 && trimmed === "") break;
      if (trimmed.startsWith("📊") || trimmed.startsWith("-") || trimmed.startsWith("→") || trimmed === "") {
        metricsLines.push(line);
      } else if (metricsLines.length > 0) {
        break;
      }
    }
    return metricsLines.join("\n").trim();
  } catch {
    return "";
  }
}

/**
 * Check if any metrics in the block need attention (have ⚠️ markers).
 */
function hasAttentionMetrics(metricsBlock: string): boolean {
  return metricsBlock.includes("⚠️");
}

// ── Step prompt builders ───────────────────────────────────────────────

function buildStepPrompt(
  step: StepName,
  config: AgentHeartbeatConfig,
  priorResults: StepResult[],
): string {
  const roleNote = `You are **${config.agent}** — ${config.role}`;
  const budgetNote = config.opBudget ? `\n\n⚡ ${config.opBudget}` : "";
  const extraNote = config.extraContext ? `\n\n${config.extraContext}` : "";
  const priorSummary = priorResults
    .filter((r) => !r.skipped)
    .map((r) => `- **${r.step}**: ${r.summary}`)
    .join("\n");
  const priorSection = priorSummary
    ? `\n\n## Prior steps this heartbeat\n${priorSummary}`
    : "";

  switch (step) {
    case "check-health": {
      // G-pattern: force metric evaluation as the structural first action
      const metricsBlock = loadMetricsBlock(config.agent);
      const hasAlerts = hasAttentionMetrics(metricsBlock);
      
      let metricsPrompt: string;
      if (metricsBlock && hasAlerts) {
        // G-pattern: question-first forces engagement with metrics
        metricsPrompt = 
          `**⚡ FIRST — evaluate your metrics before anything else:**\n\n` +
          `${metricsBlock}\n\n` +
          `**Question**: Which metric above is furthest from its target? ` +
          `Follow the "→ Quick check" breadcrumb for that metric NOW — run the command, ` +
          `read the file, or execute the query. Then decide: is this urgent enough to act on ` +
          `this heartbeat, or can it wait?\n\n` +
          `Only after evaluating your metrics, proceed to the steps below.\n\n---\n\n`;
      } else if (metricsBlock) {
        metricsPrompt = 
          `**Your metrics** (all healthy):\n\n${metricsBlock}\n\n` +
          `Metrics look good — proceed to regular health checks below.\n\n---\n\n`;
      } else {
        metricsPrompt = "";
      }

      return (
        `## Heartbeat: Check Health\n\n${metricsPrompt}` +
        `${roleNote}${budgetNote}${extraNote}\n\n` +
        `Read agents/${config.agent}/heartbeat.md for your full guidance.\n\n` +
        `${config.observeInstructions}\n\n` +
        `**Active metric alerts**: Check for unresolved alerts owned by you:\n` +
        `\`bun -e "import{Database}from'bun:sqlite';const d=new Database('.state/may.db');console.log(d.query(\\"SELECT metric_id,severity,message,created_at FROM metric_alerts WHERE resolved_at IS NULL AND metric_id LIKE '${config.agent}.%'\\").all())"\`\n` +
        `**MANDATORY**: If any alerts are firing, you MUST investigate and act on them before any other work. ` +
        `These are your metrics — unresolved alerts are your top priority. ` +
        `For each alert: diagnose the cause, take corrective action, and report what you did. ` +
        `Do NOT skip alerts or defer them to a later heartbeat.\n\n` +
        `If everything looks fine, just say so. Only flag issues that need attention.`
      );
    }

    case "review-requests":
      return (
        `## Heartbeat: Review Requests\n\n${roleNote}${priorSection}\n\n` +
        `Check for pending work:\n` +
        `- Query the request tracking DB for active/stale requests assigned to you\n` +
        `- Check "Injected: pending tasks" above\n` +
        `- Check notifications from other agents\n\n` +
        `List what needs doing, prioritized. If nothing pending, say so.`
      );

    case "dispatch-work":
      return (
        `## Heartbeat: Dispatch Work\n\n${roleNote}${priorSection}\n\n` +
        `${config.dispatchGuidance}\n\n` +
        `Based on the health check and request review above, ` +
        `take action on the highest-priority items:\n` +
        `- Use workflow.run("freestyle-wrap", "agent: <name>\\n<task>") to dispatch work (ensures tracking)\n` +
        `- Do small inline work directly (< 3 ops)\n` +
        `- Escalate items you can't handle\n\n` +
        `⚠️ ALWAYS use workflow.run() instead of bare agents.fork() — this is required for workflow coverage tracking.\n\n` +
        `If there's nothing actionable, skip this step. Don't create busywork.`
      );

    case "update-context":
      return (
        `## Heartbeat: Update Context\n\n${roleNote}${priorSection}\n\n` +
        `Wrap up this heartbeat:\n` +
        `- Persist any learnings or context updates (use finish() context_updates)\n` +
        `- Note any items to follow up on next heartbeat\n` +
        `- Commit any file changes you made\n\n` +
        `Keep it brief. Only update context if something actually changed.`
      );
  }
}

// ── Factory function ───────────────────────────────────────────────────

export function buildAgentHeartbeat(config: AgentHeartbeatConfig) {
  return async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
    const results: StepResult[] = [];

    for (const step of STEPS) {
      ctx.emit({ type: "step_start", step });

      const prompt = buildStepPrompt(step, config, results);
      const result = await ctx.runAgent(config.agent, prompt);

      if (result.status === "error") {
        results.push({ step, skipped: false, summary: `error: ${result.error ?? "unknown"}` });
        continue;
      }

      const summary = ctx.summarize(result, { maxLength: 300 });
      results.push({ step, skipped: false, summary });
    }

    const errors = results.filter((r) => r.summary.startsWith("error:"));
    const summaryLines = results
      .map((r) => `- **${r.step}**: ${r.summary}`)
      .join("\n");

    const status =
      errors.length === STEPS.length
        ? "All steps failed"
        : `${STEPS.length - errors.length}/${STEPS.length} steps completed`;

    return ctx.done(
      `## Heartbeat Complete (${config.agent})\n\n${status}\n\n${summaryLines}`,
    );
  };
}

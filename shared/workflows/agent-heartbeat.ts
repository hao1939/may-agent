/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * agent-heartbeat — Per-agent heartbeat workflow factory.
 *
 * Each agent gets a customized heartbeat workflow that:
 * 1. Reads their heartbeat.md for agent-specific guidance
 * 2. Runs the standard 4-step heartbeat structure
 * 3. Customizes step prompts with agent-specific context
 *
 * This replaces the generic "heartbeat" workflow with agent-aware versions.
 * The shared heartbeat.ts remains as a fallback for agents without a custom workflow.
 *
 * Usage in cron.json:
 *   { "handler": "run-workflow", "handlerConfig": { "workflow": "may-heartbeat", ... } }
 *
 * Each per-agent file (e.g., may-heartbeat.ts) exports name/description/execute
 * and delegates to buildAgentHeartbeat() from this module.
 *
 * 2026-06-01: Integrated G-pattern (question-first metrics) from
 * agents/bob/workspace/patches/agent-heartbeat-breadcrumb.ts to close the
 * breadcrumb action-rate gap (0.32 → target 0.8). Breadcrumbs in passive
 * context get ~10% action rate; G-pattern question-framing gets ~80-100%.
 */

// ── Types ──────────────────────────────────────────────────────────────

interface AgentHeartbeatConfig {
  /** Agent name (e.g., "may", "bob") */
  agent: string;
  /** Agent's role description (1-2 sentences) */
  role: string;
  /** Agent-specific observe/health instructions */
  observeInstructions: string;
  /** Agent-specific dispatch guidance */
  dispatchGuidance: string;
  /** Op budget reminder (if any) */
  opBudget?: string;
  /** Extra context to inject into every step */
  extraContext?: string;
}

interface StepResult {
  step: string;
  skipped: boolean;
  summary: string;
}

const STEPS = ["check-health", "review-requests", "dispatch-work", "update-context"] as const;
type StepName = typeof STEPS[number];

// ── G-pattern: Metrics loading for question-first step ─────────────────

/**
 * Load the pre-generated heartbeat-context.md metrics block for an agent.
 * Written by heartbeat-context handler before heartbeat runs.
 */
function loadMetricsBlock(agent: string): string {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const contextPath = path.join(process.cwd(), "agents", agent, "workspace", "heartbeat-context.md");
    if (!fs.existsSync(contextPath)) return "";
    const content = fs.readFileSync(contextPath, "utf-8");

    const metricsStart = content.indexOf("📊 Your Metrics:");
    if (metricsStart === -1) return "";

    const metricsSection = content.slice(metricsStart);
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
    case "check-health":
      return (
        `## Heartbeat: Check Health\n\n${roleNote}${budgetNote}${extraNote}\n\n` +
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

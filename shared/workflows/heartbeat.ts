/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * heartbeat — Thin wrapper for agent heartbeat sessions.
 *
 * Provides a consistent 4-step structure for periodic agent check-ins
 * while keeping each step optional/skippable. Agents retain full
 * flexibility within each step.
 *
 * Flow:
 *   1. check-health   — Verify agent state, context files, workspace health
 *   2. review-requests — Check request DB for pending/stale work
 *   3. dispatch-work   — Fork/call sub-agents or do inline work
 *   4. update-context  — Persist learnings, update context.md
 *
 * Input format (all fields optional):
 *   agent: <agent-name>         — which agent is heartbeating (default: caller)
 *   focus: <area>               — optional focus area to prioritize
 *   skipSteps: <step1,step2>    — comma-separated steps to skip
 *
 * Each step calls the agent with a step-specific prompt. The agent
 * decides what to do (including nothing). Steps that produce no
 * actionable output are fine — heartbeats are lightweight by design.
 */

export const name: string = "heartbeat";

export const description: string =
  "Lightweight heartbeat workflow: check-health → review-requests → " +
  "dispatch-work → update-context. Each step is optional/skippable. " +
  "Thin wrapper that gives heartbeat sessions consistent structure " +
  "without constraining agent flexibility.";

// ── Types ──────────────────────────────────────────────────────────────

interface HeartbeatConfig {
  agent: string;
  focus: string | null;
  skipSteps: Set<string>;
}

interface StepResult {
  step: string;
  skipped: boolean;
  summary: string;
}

const STEPS = ["check-health", "review-requests", "dispatch-work", "update-context"] as const;
type StepName = typeof STEPS[number];

// ── Input parsing ──────────────────────────────────────────────────────

function parseInput(raw: string, callingAgent: string): HeartbeatConfig {
  const field = (name: string): string | undefined => {
    const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : undefined;
  };

  const agent = field("agent") ?? callingAgent;
  const focus = field("focus") ?? null;
  const skipRaw = field("skipSteps") ?? "";
  const skipSteps = new Set(
    skipRaw.split(",").map(s => s.trim()).filter(Boolean)
  );

  return { agent, focus, skipSteps };
}

// ── Step prompt builders ───────────────────────────────────────────────

function buildStepPrompt(step: StepName, config: HeartbeatConfig, priorResults: StepResult[]): string {
  const focusNote = config.focus ? `\n\nFocus area this heartbeat: **${config.focus}**` : "";
  const priorSummary = priorResults
    .filter(r => !r.skipped)
    .map(r => `- **${r.step}**: ${r.summary}`)
    .join("\n");
  const priorSection = priorSummary
    ? `\n\n## Prior steps this heartbeat\n${priorSummary}`
    : "";

  switch (step) {
    case "check-health":
      return (
        `## Heartbeat: Check Health${focusNote}\n\n` +
        `Quick health check. Review:\n` +
        `- Your context.md for staleness or errors\n` +
        `- Your workspace for cleanup needs\n` +
        `- Any recent failures or stuck sessions\n\n` +
        `If everything looks fine, just say so. ` +
        `Only flag issues that need attention.`
      );

    case "review-requests":
      return (
        `## Heartbeat: Review Requests${focusNote}${priorSection}\n\n` +
        `Check for pending work:\n` +
        `- Query the request tracking DB for active/stale requests assigned to you\n` +
        `- Check for notifications from other agents\n` +
        `- Review any pending items in your workspace\n\n` +
        `List what needs doing, prioritized. If nothing pending, say so.`
      );

    case "dispatch-work":
      return (
        `## Heartbeat: Dispatch Work${focusNote}${priorSection}\n\n` +
        `Based on the health check and request review above, ` +
        `take action on the highest-priority items:\n` +
        `- Fork sub-agents for independent tasks\n` +
        `- Do small inline work directly\n` +
        `- Escalate items you can't handle\n\n` +
        `If there's nothing actionable, skip this step. ` +
        `Don't create busywork.`
      );

    case "update-context":
      return (
        `## Heartbeat: Update Context${focusNote}${priorSection}\n\n` +
        `Wrap up this heartbeat:\n` +
        `- Persist any learnings or context updates (use finish() context_updates)\n` +
        `- Note any items to follow up on next heartbeat\n` +
        `- Update your workspace files if needed\n\n` +
        `Keep it brief. Only update context if something actually changed.`
      );
  }
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);
  const results: StepResult[] = [];

  for (const step of STEPS) {
    // Skip if requested
    if (config.skipSteps.has(step)) {
      results.push({ step, skipped: true, summary: "skipped" });
      ctx.emit({ type: "step_start", step: `${step} (skipped)` });
      continue;
    }

    ctx.emit({ type: "step_start", step });

    const prompt = buildStepPrompt(step, config, results);
    const result = await ctx.runAgent(config.agent, prompt);

    if (result.status === "error") {
      // Heartbeat steps are non-critical — log and continue
      results.push({ step, skipped: false, summary: `error: ${result.error ?? "unknown"}` });
      continue;
    }

    const summary = ctx.summarize(result, { maxLength: 300 });
    results.push({ step, skipped: false, summary });
  }

  // Build completion summary
  const executed = results.filter(r => !r.skipped);
  const errors = results.filter(r => !r.skipped && r.summary.startsWith("error:"));
  const summaryLines = results
    .map(r => `- **${r.step}**: ${r.skipped ? "⏭ skipped" : r.summary}`)
    .join("\n");

  const status = errors.length === executed.length && executed.length > 0
    ? "All steps failed"
    : `${executed.length - errors.length}/${STEPS.length} steps completed`;

  return ctx.done(
    `## Heartbeat Complete (${config.agent})\n\n` +
    `${status}\n\n` +
    `${summaryLines}`
  );
}

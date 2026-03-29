/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Reviewed Delivery Workflow
 *
 * For design briefs and architecture proposals: runs the evidence-gate
 * check before delivering to the target agent. If the brief lacks evidence,
 * it gets rejected with feedback instead of sent.
 *
 * Composes: evidence-gate → deliver (agents.send)
 *
 * ## Task Format
 *
 * ```
 * to: tech-lead
 * priority: P1
 *
 * <brief text>
 * ```
 *
 * The `to:` line specifies the target agent (default: tech-lead).
 * The `priority:` line is optional (P0/P1/P2).
 */

export const name: string = "reviewed-delivery";

export const description: string =
  "Send a design brief to another agent, but only after it passes the " +
  "evidence-gate check. Rejects briefs that lack specific incidents, " +
  "simpler alternatives, or a validation plan.";

const TO_LINE = /^to:\s*(\S+)\s*$/im;
const PRIORITY_LINE = /^priority:\s*(P[0-3])\s*$/im;

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  let target = "tech-lead";
  let priority = "";
  let briefText = ctx.task;

  const toMatch = briefText.match(TO_LINE);
  if (toMatch) {
    target = toMatch[1];
    briefText = briefText.replace(TO_LINE, "").trim();
  }

  const prioMatch = briefText.match(PRIORITY_LINE);
  if (prioMatch) {
    priority = prioMatch[1];
    briefText = briefText.replace(PRIORITY_LINE, "").trim();
  }

  // ── Step 1: Evidence gate ────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "evidence-gate" });

  const gateResult = await ctx.runWorkflow("evidence-gate", briefText);

  if (gateResult.type === "escalate") {
    return ctx.escalate(
      `Evidence gate rejected the brief. Fix the issues before sending.\n\n${gateResult.reason}`,
    );
  }

  // Check if the gate passed or rejected
  const summary = gateResult.type === "done" ? gateResult.summary : "";
  if (summary.includes("REJECT")) {
    return ctx.escalate(
      `Evidence gate rejected the brief:\n\n${summary}\n\nAdd the missing evidence before sending.`,
    );
  }

  // ── Step 2: Deliver ──────────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "deliver" });

  const sendTask = priority
    ? `[${priority}] ${briefText}`
    : briefText;

  const deliverResult = await ctx.runAgent(target, sendTask);

  return ctx.done(
    `## Reviewed Delivery Complete\n\n` +
    `**Target**: ${target}\n` +
    `**Evidence gate**: PASSED\n` +
    `**Delivery status**: ${deliverResult.status}\n\n` +
    `${deliverResult.lastAssistantText?.slice(0, 500) ?? "(no response)"}`,
  );
}

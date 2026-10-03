import type { WorkflowContext } from "@may-agent/sdk";
import {
  metricReviewResult,
  metricReviewSchema,
} from "../../../metric-follow-through.js";

export const name = "metric-follow-through";
export const description =
  "Own an ordinary metric follow-through Task. Keep the handed-off decision as context and ask May to judge current evidence. Host Conditions and dependencies carry observation and delivery.";

export async function execute(ctx: WorkflowContext) {
  const rec = ctx.reconciliation;
  if (!rec)
    return ctx.blocked(
      "Metric follow-through requires an ordinary owning Task",
    );
  try {
    // A saved handoff is evidence and context, not a current owner judgment.
    // Always reconcile the complete current packet so an honest incomplete
    // result, a later admitted input, or a corrected wait can change the plan.
    const response = await ctx.agents.call(
      rec.agent,
      [
        "Review this metric follow-through Task against its full current outcome and acceptance.",
        "The handed-off review is context for the requested investigation, not this Task's execution decision. Choose the current work and result yourself. If previousAttempt records a rejection or failure, read that feedback and correct the plan; do not replay the rejected result or repeat already accepted effects.",
        "Read metric-response and current evidence for the relevant breach episodes before judging them. New samples update evidence; they do not trigger investigation. Reuse the existing investigation for an open breach. Select useful authorized work; requests commission independent work. Resume it for repair results, human decisions, an exact metric.recovered status change, new requirements or a deliberate checkpoint for actual outstanding work.",
        "Return {task: ordinary Task result, decisions: metric judgments}. Put current judgments in decisions; code generates their metric-disposition facts and fills linkedTask from this attempt. Perform useful authorized work now. For another bounded internal pass, return waiting with continue:true. When an external fact is needed, retain or declare its real Condition or request return. A one-time reviewAt is appropriate for deliberate reconsideration of actual outstanding work, including post-backoff verification; it is not a periodic sample-reading timer. A legitimate retained future review remains useful when omitted from the next result. A nextAction sentence, metric disposition, or request declaration alone is not a wake route. Return converged only when the addressed requirements are fulfilled, or incomplete with the concrete gap when this attempt cannot complete them. Use no-change and finish the review when only passive metric collection remains. Use investigate for actual work or waits. Do not create may.metric.state Conditions or periodic checkpoints merely to reread samples. Retire every obsolete retained may.metric.state Condition with a retire-condition action, including already satisfied sample waits. An older handed-off observe plan needs your current judgment, not replay. Preserve independent requirements, repair requests, approvals, and unchanged useful waits. Metric recovery alone never fulfills original work. Account for current assigned input rather than replaying the original plan.",
        JSON.stringify(rec),
      ].join("\n"),
      { schema: metricReviewSchema },
    );
    if (response.status !== "done" || !response.output)
      return ctx.blocked(response.summary, {
        executionId: response.id,
        facts: response.facts,
      });
    const result = metricReviewResult(rec, response.output);
    return ctx.done(result.summary, result);
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);
    return ctx.done(summary, {
      state: "incomplete",
      summary,
      facts: [
        `Metric follow-through could not accept the proposed result: ${summary}`,
      ],
    });
  }
}

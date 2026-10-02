import type { WorkflowContext } from "@may-agent/sdk";
import {
  metricReviewInput,
  metricReviewResult,
  metricReviewSchema,
  isMetricSampleCondition,
  readMetricReview,
} from "../../../metric-follow-through.js";

export const name = "metric-follow-through";
export const description =
  "Own an ordinary metric follow-through Task. Save the handed-off decision once, then ask May to judge current evidence. Host Conditions and dependencies carry observation and delivery.";

export async function execute(ctx: WorkflowContext) {
  const rec = ctx.reconciliation;
  if (!rec)
    return ctx.blocked(
      "Metric follow-through requires an ordinary owning Task",
    );
  // Only freshly assigned input can carry a new decision. Continued input and
  // the Task's original input remain context after acceptance, not replay commands.
  const events = rec.events.items;
  let selected: unknown;
  if (events.length === 1 && !rec.events.truncated) {
    const event = events[0].event;
    const request = event.data.request as { input?: unknown } | undefined;
    if (event.type === "app.task.requested")
      selected = metricReviewInput(request?.input);
  } else if (!events.length && !rec.task.acceptedAttempt) {
    selected = metricReviewInput(rec.input);
  }
  try {
    // Older saved handoffs can contain the former sample-driven plan. Let the
    // owner revise it once rather than replaying it or silently settling work.
    if (
      selected !== undefined &&
      readMetricReview(selected).task.conditions?.some(
        (condition) =>
          !("requestId" in condition) && isMetricSampleCondition(condition),
      )
    )
      selected = undefined;
    if (selected === undefined) {
      const response = await ctx.agents.call(
        rec.agent,
        [
          "Review this metric follow-through Task against its full current outcome and acceptance.",
          "Read metric-response and current evidence for the relevant breach episodes before judging them. New samples update evidence; they do not trigger investigation. Reuse the existing investigation for an open breach. Select useful authorized work; requests commission independent work. Resume it for repair results, human decisions, an exact metric.recovered status change, new requirements or a deliberate checkpoint for actual outstanding work.",
          "Return {task: ordinary Task result, decisions: metric judgments}. Put current judgments in decisions; code generates their metric-disposition facts and fills linkedTask from this attempt. Use no-change and finish the review when only passive metric collection remains. Use investigate for actual work or waits. Do not create may.metric.state Conditions or periodic checkpoints merely to reread samples. Retire every obsolete retained may.metric.state Condition with a retire-condition action, including already satisfied sample waits. An older handed-off observe plan needs your current judgment, not replay. Preserve independent requirements, repair requests and approvals; omit unchanged useful waits. Metric recovery alone never fulfills original work. Account for current assigned input rather than replaying the original plan.",
          JSON.stringify(rec),
        ].join("\n"),
        { schema: metricReviewSchema },
      );
      if (response.status !== "done" || !response.output)
        return ctx.blocked(response.summary, {
          executionId: response.id,
          facts: response.facts,
        });
      selected = response.output;
    }
    const result = metricReviewResult(rec, selected);
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

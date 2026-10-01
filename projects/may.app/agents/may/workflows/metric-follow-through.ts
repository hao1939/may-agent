import type { WorkflowContext } from "@may-agent/sdk";
import {
  metricReviewInput,
  metricReviewResult,
  metricReviewSchema,
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
    if (selected === undefined) {
      const response = await ctx.agents.call(
        rec.agent,
        [
          "Review this metric follow-through Task against its full current outcome and acceptance.",
          "Read metric-response and current evidence for the relevant episodes before judging them. Use installed observation contracts to build Conditions. Select useful authorized work; dependencies commission independent work. A match or elapsed checkpoint only invites your judgment.",
          "Return {task: ordinary Task result, decisions: metric judgments}. Put current judgments in decisions; code generates their metric-disposition facts and fills linkedTask from this attempt. Omit unchanged Conditions and dependencies; Host retains them and validates the wait at settlement. Observe needs a metric Condition; investigate uses ordinary Task work or waits, including retained approvals. Keep unrelated requirements and approvals. Account for current assigned input, including new requirements, rather than replaying the original plan.",
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

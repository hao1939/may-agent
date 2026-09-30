import {
  Type,
  admitTaskReconcileResult,
  taskAgentResultSchema,
  type Static,
  type ConversationTurnResult,
  type TaskReconcileResult,
  type TaskReconciliationContext,
} from "@may-agent/sdk";
import { Check } from "typebox/value";

const text = Type.String({ minLength: 1 });
export const metricReviewSchema = Type.Object(
  {
    task: taskAgentResultSchema,
    decisions: Type.Array(
      Type.Object(
        {
          metricId: text,
          alertId: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
          disposition: Type.Union([
            Type.Literal("observe"),
            Type.Literal("investigate"),
            Type.Literal("no-change"),
            Type.Literal("recovered"),
          ]),
          reason: text,
          evidence: Type.Array(text, { minItems: 1, maxItems: 16 }),
          nextAction: Type.Optional(text),
        },
        { additionalProperties: false },
      ),
      { maxItems: 8 },
    ),
  },
  { additionalProperties: false },
);
export type MetricReview = Static<typeof metricReviewSchema>;

export function readMetricReview(value: unknown): MetricReview {
  if (!Check(metricReviewSchema, value))
    throw new Error(
      "Metric review requires {task: ordinary Task result, decisions: metric judgments}",
    );
  return value;
}

/** App composition: identity comes from the owning attempt, never from model output. */
export function metricReviewResult(
  owner: Pick<TaskReconciliationContext, "appId" | "taskId" | "task" | "waits">,
  value: unknown,
): TaskReconcileResult {
  const review = readMetricReview(value);
  const admission = admitTaskReconcileResult(review.task, {
    allowNeedsAgent: false,
  });
  if (!admission.ok) throw new Error(admission.error);
  const result = admission.result;
  if (result.facts.some((fact) => fact.startsWith("metric-disposition:")))
    throw new Error(
      "Return metric judgments in decisions; code binds their owner and follow-through",
    );
  const seen = new Set<string>();
  const facts = review.decisions.map((decision) => {
    const key = JSON.stringify([decision.metricId, decision.alertId]);
    if (seen.has(key))
      throw new Error("Return one judgment per metric episode");
    seen.add(key);
    const unresolved = ["observe", "investigate"].includes(
      decision.disposition,
    );
    if (
      !decision.metricId.trim() ||
      !decision.reason.trim() ||
      decision.evidence.some((ref) => !ref.trim())
    )
      throw new Error(
        "Metric judgments require a reason and evidence references",
      );
    if (unresolved) {
      if (result.state !== "waiting" || !decision.nextAction?.trim())
        throw new Error(
          "An unresolved metric requires a waiting result and nextAction",
        );
      const retired = new Set(
        result.actions
          ?.filter((a) => a.kind === "retire-condition")
          .map((a) => a.conditionId),
      );
      const open = owner.task.conditions.filter(
        (c) =>
          owner.waits.open.some((wait) => wait.conditionId === c.id) &&
          !retired.has(c.id),
      );
      const observesMetric = [...open, ...(result.conditions ?? [])].some(
        (c) =>
          c.subject === `resource:${decision.metricId}` &&
          c.type === "may.metric.state" &&
          c.owner === "app:may" &&
          (c.expected as Record<string, unknown> | null)?.source ===
            "app:may:observer:metric-evidence",
      );
      const owesWork =
        !!result.dependencies?.length ||
        owner.waits.open.some(
          (wait) => wait.dependency && !retired.has(wait.conditionId),
        );
      if (decision.disposition === "observe" && !observesMetric)
        throw new Error(
          "Observe requires a saved or returned Condition for this metric",
        );
      if (
        decision.disposition === "investigate" &&
        !observesMetric &&
        !owesWork &&
        !result.continue &&
        !(result.reviewAt && result.reviewAt > Date.now())
      )
        throw new Error(
          "Investigate requires commissioned work, useful continuation, or an actual wait",
        );
    }
    const fact = `metric-disposition:${JSON.stringify({
      version: 1,
      ...decision,
      linkedTask: { appId: owner.appId, taskId: owner.taskId },
      // Current deadlines are read from this Task, never duplicated in a fact.
      ...(unresolved ? { followThrough: "task" } : {}),
    })}`;
    if (Buffer.byteLength(fact) > 4000)
      throw new Error("Metric decision exceeds 4000 bytes");
    return fact;
  });
  const composed = admitTaskReconcileResult(
    { ...result, facts: [...result.facts, ...facts] },
    { allowNeedsAgent: false },
  );
  if (!composed.ok) throw new Error(composed.error);
  return composed.result;
}

export type MetricConversation = Pick<
  ConversationTurnResult,
  "topic" | "requestUpdates"
> & {
  requestId?: string;
  task?: { appId: string; taskId: string };
};

/** Transport the selected result once; only Task acceptance records its decisions. */
export function metricReviewHandoff(
  value: unknown,
  conversation: MetricConversation,
): ConversationTurnResult {
  const review = readMetricReview(value);
  if (
    !review.decisions.length ||
    review.task.state !== "waiting" ||
    review.task.inputKeys !== undefined
  )
    throw new Error(
      "A metric handoff requires a waiting decision; input scope comes from admission",
    );
  if (conversation.task && conversation.task.appId !== "may")
    throw new Error(
      "Use the owning App's input contract for another App's investigation",
    );
  return {
    summary: review.task.summary,
    response: "I will follow this concern and review the next evidence.",
    topic: conversation.topic,
    requestUpdates: conversation.requestUpdates,
    followUp: {
      appId: "may",
      requestId: conversation.requestId,
      ...(conversation.task ? { task: conversation.task } : {}),
      input: {
        kind: "goal",
        data: {
          outcome:
            "Follow the metric concern through an evidence-based owner decision",
          acceptance: [
            "Review fresh evidence and retain the owner decision; metric recovery alone does not fulfill original work",
          ],
          context: { metricResponse: review },
        },
      },
    },
  };
}

export function metricReviewInput(input: unknown): unknown {
  const value = input as {
    kind?: string;
    data?: { context?: { metricResponse?: unknown } };
  } | null;
  return value?.kind === "goal"
    ? value.data?.context?.metricResponse
    : undefined;
}

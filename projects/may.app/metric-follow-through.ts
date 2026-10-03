import {
  Type,
  admitTaskReconcileResult,
  taskAgentResultSchema,
  type Static,
  type ConversationTurnResult,
  type TaskReconcileResult,
  type TaskReconciliationContext,
  type Condition,
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
            Type.Literal("observe", {
              description:
                "Legacy disposition. Use no-change for passive collection; sample Conditions cannot trigger investigation.",
            }),
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

/** Metric collection is evidence, not an investigation's return route. */
export function isMetricSampleCondition(condition: { type?: string }): boolean {
  return condition.type === "may.metric.state";
}

function assertInvestigationWaits(
  result: TaskReconcileResult,
  retained: readonly Condition[] = [],
): void {
  const retired = new Set(
    result.actions
      ?.filter((action) => action.kind === "retire-condition")
      .map((action) => action.conditionId),
  );
  const sampleWaits = [
    ...retained.filter((condition) => !retired.has(condition.id)),
    ...(result.conditions ?? []),
  ].filter(
    (condition) =>
      !("requestId" in condition) && isMetricSampleCondition(condition),
  );
  if (sampleWaits.length)
    throw new Error(
      "Metric investigations start on a breach, not a new sample. Retire retained may.metric.state Conditions and do not add new ones. Use no-change when only metric collection remains, or investigate with useful work, repair-result or human-decision waits; preserve independent obligations.",
    );
}

export function readMetricReview(
  value: unknown,
): MetricReview & { task: TaskReconcileResult } {
  // Saved reviews can use dependencies; reuse SDK admission to resolve that spelling.
  const input = value as { task?: unknown } | null;
  const admitted = admitTaskReconcileResult(input?.task, {
    allowNeedsAgent: false,
  });
  if (!admitted.ok) throw new Error(admitted.error);
  const review = { ...input, task: admitted.result };
  if (!Check(metricReviewSchema, review))
    throw new Error(
      "Metric review requires {task: ordinary Task result, decisions: metric judgments}",
    );
  return review;
}

/** App composition: identity comes from the owning attempt, never from model output. */
export function metricReviewResult(
  owner: Pick<TaskReconciliationContext, "appId" | "taskId" | "task" | "waits">,
  value: unknown,
): TaskReconcileResult {
  const review = readMetricReview(value);
  const result = review.task;
  assertInvestigationWaits(result, owner.task.conditions);
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
    }
    // Host settlement validates actual work/waits. The legacy "observe"
    // spelling stays readable, but cannot install a metric-sample wake.
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
  // A helper's complete output can pass through this composition again. Only
  // exact copies of the current code-bound decisions are safe to retain.
  if (
    result.facts.some(
      (fact) => fact.startsWith("metric-disposition:") && !facts.includes(fact),
    )
  )
    throw new Error(
      "Return metric judgments in decisions; code binds their owner and follow-through",
    );
  const composed = admitTaskReconcileResult(
    {
      ...result,
      facts: [
        ...result.facts.filter((fact) => !facts.includes(fact)),
        ...facts,
      ],
    },
    { allowNeedsAgent: false },
  );
  if (!composed.ok) throw new Error(composed.error);
  return composed.result;
}

export type MetricConversation = Pick<
  ConversationTurnResult,
  "topic" | "requestUpdates" | "response"
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
  assertInvestigationWaits(review.task);
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
    ...(conversation.response ? { response: conversation.response } : {}),
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
  const candidate = value?.kind === "goal"
    ? value.data?.context?.metricResponse
    : undefined;
  // Older ordinary goals used this context field for a workflow reference.
  // Only the structured review packet owned by this module selects the metric
  // workflow; malformed structured packets still fail visibly at admission.
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : undefined;
}

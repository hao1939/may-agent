import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  readMetricEvidence,
  type MetricEvidence,
  type MetricReader,
} from "../../../../evaluation.app/agents/evaluator/workflows/lib/metric-evidence.js";
import { createPublicTaskEvidenceProvider } from "../../../../evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.js";

import {
  metricReviewResult,
  metricReviewHandoff,
  readMetricReview,
  type MetricReview,
  type MetricConversation,
} from "../../../metric-follow-through.js";

export const name = "metric-response";
export const description =
  "Read exact metric handling and live Task waits with input:{metricId,alertId} (null without a breach). Compose with input:{review:{task,decisions},conversation?}. A breach episode triggers investigation; new samples only update evidence. Use investigate for useful work: waiting plus continue:true for another bounded internal pass; an exact new or retained repair-result, human-decision, request-return or metric.recovered Condition for an external fact; or a one-time reviewAt for deliberate reconsideration of actual outstanding work such as post-backoff verification. A retained future review remains useful when omitted from a later result. A nextAction, disposition or request alone is not a wake route. Use converged only when fulfilled, or incomplete with the concrete gap when this attempt cannot complete the work. Use no-change and finish the review when only passive collection remains; do not create may.metric.state Conditions or periodic sample-review timers. Retire obsolete saved sample Conditions explicitly while preserving independent work, approvals and deliberate checkpoints. The legacy observe disposition remains readable. Other dispositions are recovered and no-change. In Conversation include conversation:{topic,requestUpdates,requestId,task?,response?} using current context; task is only an existing exact May Task target. Omit response for routine automated follow-through. Return the complete output unchanged through finish().result. Code binds new Task identity. Requests commission work; caller Conditions observe results. Preparation alone accepts nothing.";

type Link = { appId: string; taskId: string };
type Decision = {
  version: 1;
  metricId: string;
  alertId: number | null;
  disposition: "investigate" | "observe" | "no-change" | "recovered";
  reason: string;
  evidence: string[];
  linkedTask?: Link;
  nextAction?: string;
  nextReviewAt?: number;
};
type Input = {
  metricId?: string;
  alertId?: number | null;
  decision?: Omit<Decision, "version" | "metricId" | "alertId">;
  review?: MetricReview;
  conversation?: MetricConversation;
};
type TaskReader = (
  appId: string,
  taskId: string,
) => Promise<Record<string, unknown>>;
export const readMetricLinkedTask: TaskReader = (appId, taskId) =>
  createPublicTaskEvidenceProvider().getTask(appId, taskId);

export function metricResponseKey(metricId: string, alertId?: number | null) {
  return JSON.stringify(["metric", metricId, alertId ?? null]);
}

export async function inspectMetricResponse(
  evidence: MetricEvidence,
  alertId: number | null,
  readTask: TaskReader = readMetricLinkedTask,
) {
  if (
    alertId !== null &&
    !(
      Array.isArray(evidence.alerts) &&
      evidence.alerts.some((alert) => alert.alertId === alertId)
    )
  )
    throw new Error(
      "The exact metric breach is unavailable; do not create replacement work",
    );
  const decisions = Array.isArray(evidence.dispositions)
    ? evidence.dispositions
    : [];
  const related = Array.isArray(evidence.relatedDispositions)
    ? evidence.relatedDispositions
    : [];
  const accountable = new Set(
    ["may", evidence.responsibility?.appId].filter(Boolean),
  );
  const prior = decisions.find(
    (row) =>
      accountable.has(row.appId) &&
      row.decision?.metricId === evidence.metricId &&
      row.decision?.alertId === alertId,
  );
  const linked = prior?.decision?.linkedTask as Link | undefined;
  const linkedTask = linked
    ? await readTask(linked.appId, linked.taskId)
    : null;
  if (
    linked &&
    (!linkedTask ||
      (linkedTask.taskId ?? linkedTask.id) !== linked.taskId ||
      linkedTask.appId !== linked.appId)
  )
    throw new Error(
      "The saved investigation is unavailable; do not create replacement work",
    );
  return {
    key: metricResponseKey(evidence.metricId, alertId),
    prior: prior ?? null,
    linkedTask,
    followThrough: linkedTask
      ? {
          source: "linked-task",
          status: linkedTask.status ?? null,
          closed: linkedTask.closed === true,
          // A v1 fact's nextReviewAt is historical, including when no wait exists.
          reviewAt: linkedTask.closed
            ? null
            : ((
                linkedTask.currentObligations as
                  | { reviewAt?: number }
                  | undefined
              )?.reviewAt ?? null),
          conditions: Array.isArray(linkedTask.conditions)
            ? linkedTask.conditions.map((condition) => ({
                id: condition.id,
                type: condition.type,
                subject: condition.subject,
                state: condition.observation?.state ?? "unknown",
                reviewAt:
                  linkedTask.closed || condition.observation?.state === "true"
                    ? null
                    : (condition.observation?.reviewAt ?? null),
              }))
            : [],
        }
      : null,
    historyTruncated: evidence.dispositionsTruncated === true,
    attributionUnresolved: decisions
      .filter((row) => !accountable.has(row.appId))
      .slice(0, 3),
    related: [
      ...related,
      ...decisions.filter((row) => row.decision?.alertId !== alertId),
    ].slice(0, 3),
    relatedTruncated: evidence.relatedDispositionsTruncated === true,
  };
}

export function metricDecisionFact(
  metricId: string,
  alertId: number | null,
  decision: Input["decision"],
): string {
  if (
    !decision ||
    !["investigate", "observe", "no-change", "recovered"].includes(
      decision.disposition,
    ) ||
    !decision.reason?.trim() ||
    !Array.isArray(decision.evidence) ||
    !decision.evidence.length ||
    decision.evidence.some((item) => typeof item !== "string" || !item.trim())
  )
    throw new Error(
      "A supported disposition requires a reason and evidence references",
    );
  if (
    ["investigate", "observe"].includes(decision.disposition) &&
    (!decision.nextAction?.trim() ||
      !Number.isSafeInteger(decision.nextReviewAt) ||
      decision.nextReviewAt! <= Date.now())
  )
    throw new Error(
      "An unresolved concern requires its next action or wait and a future review boundary",
    );
  const {
    disposition,
    reason,
    evidence,
    linkedTask,
    nextAction,
    nextReviewAt,
  } = decision;
  if (linkedTask && (!linkedTask.appId?.trim() || !linkedTask.taskId?.trim()))
    throw new Error(
      "A linked investigation requires exact App and Task identities",
    );
  const fact = `metric-disposition:${JSON.stringify({ version: 1, metricId, alertId, disposition, reason, evidence, linkedTask, nextAction, nextReviewAt })}`;
  if (Buffer.byteLength(fact) > 4000)
    throw new Error(
      "Keep the decision within 4000 bytes; retain exact evidence links",
    );
  return fact;
}

export async function respondToMetric(
  ctx: WorkflowContext<Input>,
  reader: MetricReader = readMetricEvidence,
  readTask: TaskReader = readMetricLinkedTask,
): Promise<ExecutionResult> {
  try {
    if (ctx.input.review) {
      const review = readMetricReview(ctx.input.review);
      for (const decision of review.decisions) {
        const evidence = await reader(
          decision.metricId,
          Date.now(),
          decision.alertId ?? undefined,
        );
        await inspectMetricResponse(evidence, decision.alertId, readTask);
      }
      if (ctx.input.conversation) {
        const result = metricReviewHandoff(review, ctx.input.conversation);
        return ctx.done(result.summary, result);
      }
      if (
        !ctx.reconciliation ||
        ctx.reconciliation.task.executor === "conversation"
      )
        throw new Error(
          "Supply conversation context for handoff or run inside the owning Task",
        );
      const result = metricReviewResult(ctx.reconciliation, review);
      return ctx.done(result.summary, result);
    }
    const { metricId, decision } = ctx.input;
    if (decision && ["investigate", "observe"].includes(decision.disposition))
      throw new Error(
        "A fact alone cannot retain follow-through. Supply review with the complete waiting Task result and its Condition, dependency, or useful continuation; use conversation for a handoff.",
      );
    const alertId = ctx.input.alertId ?? null;
    if (
      !metricId ||
      (alertId !== null && (!Number.isSafeInteger(alertId) || alertId <= 0))
    )
      throw new Error(
        "Supply a metric ID and its exact positive alert ID, or null for a finding without a breach",
      );
    const evidence = await reader(metricId, Date.now(), alertId ?? undefined);
    const handling = await inspectMetricResponse(evidence, alertId, readTask);
    let fact: string | undefined;
    if (decision) {
      fact = metricDecisionFact(metricId, alertId, decision);
      if (decision.linkedTask) {
        const linked = await readTask(
          decision.linkedTask.appId,
          decision.linkedTask.taskId,
        );
        if (
          (linked.taskId ?? linked.id) !== decision.linkedTask.taskId ||
          linked.appId !== decision.linkedTask.appId
        )
          throw new Error("Linked investigation identity differs");
      }
    }
    const detail = {
      handling,
      responsibility: evidence.responsibility,
      alerts: evidence.alerts,
      latest: evidence.latest,
      freshness: evidence.freshness,
    };
    const complete = Buffer.byteLength(JSON.stringify(detail)) <= 10_000;
    const summary = fact
      ? "Decision prepared; retain the returned fact in the current Task result before claiming accepted handling."
      : "Read the current breach response and linked Task waits; judge scope before reusing work. Historical nextReviewAt is not a live deadline.";
    const output: Record<string, unknown> = {
      state: "converged",
      summary,
      result: {
        complete,
        ...(complete
          ? detail
          : {
              omission:
                "Read exact metric evidence and linked Tasks before a decision",
              metricId,
              alertId,
            }),
      },
      facts: fact ? [fact] : [],
      actions: [],
    };
    if (Buffer.byteLength(JSON.stringify(output)) > 14_000)
      output.result = {
        complete: false,
        metricId,
        alertId,
        omission:
          "Read exact metric evidence and linked Tasks before a decision",
      };
    return ctx.done(summary, output);
  } catch (error) {
    const summary = String(error);
    return ctx.done(summary, {
      state: "incomplete",
      summary,
      facts: [`Metric evidence or decision unavailable: ${summary}`],
      result: { disposition: "evidence-unavailable" },
    });
  }
}

export async function execute(ctx: WorkflowContext<Input>) {
  return respondToMetric(ctx);
}

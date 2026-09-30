import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  readMetricEvidence,
  type MetricEvidence,
  type MetricReader,
} from "../../../../evaluation.app/agents/evaluator/workflows/lib/metric-evidence.js";
import { createPublicTaskEvidenceProvider } from "../../../../evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.js";

export const name = "metric-response";
export const description =
  "Read the accepted response to an exact metric breach, or prepare a decision fact to retain in the current Task's finish().facts. This workflow does not accept a decision or create repair work.";

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
  metricId: string;
  alertId?: number | null;
  decision?: Omit<Decision, "version" | "metricId" | "alertId">;
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
    const { metricId, decision } = ctx.input;
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
      : "Read the current breach response; judge scope before reusing linked work.";
    const output: Record<string, unknown> = {
      state:
        decision && ["investigate", "observe"].includes(decision.disposition)
          ? "waiting"
          : "converged",
      summary,
      ...(decision && ["investigate", "observe"].includes(decision.disposition)
        ? { reviewAt: decision.nextReviewAt }
        : {}),
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
      facts: [],
      result: { disposition: "evidence-unavailable" },
    });
  }
}

export async function execute(ctx: WorkflowContext<Input>) {
  return respondToMetric(ctx);
}

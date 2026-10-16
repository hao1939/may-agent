import { createHash } from "node:crypto";
import type { WorkflowContext } from "@may-agent/sdk";
import { hostReportUrl } from "./host-reporting.js";
import { readMetricEvidence, type MetricReader } from "./metric-evidence.js";
import type { Reviewer } from "./reviewer-profile.js";

export function metricReviewTaskId(
  metricId: string,
  reviewer: Reviewer = "evaluator",
) {
  return `runtime/metric-review/${reviewer}/${createHash("sha256").update(metricId).digest("hex").slice(0, 24)}`;
}

/** Last completed observation, not a timer requesting another assessment. */
export async function metricReviewedThrough(
  ctx: WorkflowContext<any>,
  metricId: string,
  reviewer: Reviewer = "evaluator",
): Promise<number> {
  const response = (await ctx.read.tasks.get(
    metricReviewTaskId(metricId, reviewer),
  )) as any;
  const task = response?.task ?? response;
  const accepted = task?.result?.result ?? task?.result;
  const reviewedThrough = Number(accepted?.reviewedThrough);
  return Number.isSafeInteger(reviewedThrough) && reviewedThrough > 0
    ? reviewedThrough
    : 0;
}
type Candidate = {
  metricId: string;
  end: number;
  reviewer: Reviewer;
  alertId: number;
};
export type MetricSelection = {
  candidate: Candidate | null;
  cursor: string;
  facts: string[];
};
export type MetricSelector = (
  ctx: WorkflowContext<any>,
  cursor: string,
  reviewer: Reviewer,
) => Promise<MetricSelection>;

export async function selectMetricCandidate(
  ctx: WorkflowContext<any>,
  cursor: string,
  reviewer: Reviewer,
  reader: MetricReader = readMetricEvidence,
  list?: () => Promise<any>,
  now = Date.now(),
): Promise<MetricSelection> {
  const end = now;
  const facts: string[] = [];
  try {
    const data = list
      ? await list()
      : await (async () => {
          const response = await fetch(hostReportUrl("/api/metrics"), {
            signal: AbortSignal.timeout(10_000),
            redirect: "error",
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = await response.text();
          if (Buffer.byteLength(bytes) > 1_000_000)
            throw new Error("Metric catalog exceeds the selection bound");
          return JSON.parse(bytes);
        })();
    if (!Array.isArray(data.metrics))
      throw new Error("Metric catalog is unavailable");
    if (data.truncated || data.metricsTruncated)
      facts.push("selector:metric-catalog-truncated");
    const metrics = data.metrics
      .filter(
        (metric: any) =>
          typeof metric.id === "string" &&
          metric.id.length <= 512 &&
          metric.status === "active",
      )
      .sort((a: any, b: any) => a.id.localeCompare(b.id));
    const after = metrics.findIndex((metric: any) => metric.id > cursor);
    const ordered = [
      ...metrics.slice(after < 0 ? 0 : after),
      ...metrics.slice(0, after < 0 ? 0 : after),
    ];
    for (const metric of ordered.slice(0, 3)) {
      cursor = metric.id;
      const cut = end;
      const evidence = await reader(metric.id, cut);
      if (evidence.metricId !== metric.id || evidence.end !== cut)
        throw new Error(
          "Metric selection evidence identity differs from the request",
        );
      if (evidence.responsibility?.appId === "evaluation") {
        facts.push(`selector:metric-excluded:${metric.id}:evaluation-owned`);
        continue;
      }
      if (evidence.responsibility?.status !== "resolved")
        facts.push(`selector:metric-owner-unknown:${metric.id}`);
      if (!Array.isArray(evidence.alerts))
        throw new Error("Metric alert history is unavailable");
      if (evidence.alertsTruncated)
        facts.push(`selector:metric-alert-history-truncated:${metric.id}`);
      // Repair a missed notification using the latest recorded transition.
      // Samples, changed values and the passage of time do not create work.
      const transition = evidence.alerts
        .map((alert: any) => {
          const at = alert.resolvedAt ?? alert.createdAt;
          if (
            !Number.isSafeInteger(alert.alertId) ||
            alert.alertId <= 0 ||
            !Number.isSafeInteger(at) ||
            at <= 0 ||
            at >= cut
          )
            throw new Error("Metric alert transition identity is unavailable");
          return { alertId: alert.alertId, end: at + 1 };
        })
        .sort((a, b) => b.end - a.end || b.alertId - a.alertId)[0];
      facts.push(`selector:metric-observed:${metric.id}:cut=${cut}`);
      if (
        transition &&
        transition.end > (await metricReviewedThrough(ctx, metric.id, reviewer))
      )
        return {
          candidate: { metricId: metric.id, ...transition, reviewer },
          cursor,
          facts,
        };
    }
    return { candidate: null, cursor, facts };
  } catch (error) {
    facts.push(
      `selector:metric-read-deferred:cut=${end}:${String(error).slice(0, 180)}`,
    );
    return { candidate: null, cursor, facts };
  }
}

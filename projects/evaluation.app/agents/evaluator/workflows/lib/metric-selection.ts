import { createHash } from "node:crypto";
import type { WorkflowContext } from "@may-agent/sdk";
import { hostReportUrl } from "./host-reporting.js";
import {
  readMetricEvidence,
  metricReviewCut,
  type MetricReader,
} from "./metric-evidence.js";
import type { Reviewer } from "./reviewer-profile.js";

export function metricReviewTaskId(
  metricId: string,
  reviewer: Reviewer = "evaluator",
) {
  return `runtime/metric-review/${reviewer}/${createHash("sha256").update(metricId).digest("hex").slice(0, 24)}`;
}
type Candidate = { metricId: string; end: number; reviewer: Reviewer };
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
  const end = metricReviewCut(now);
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
          typeof metric.project === "string" &&
          metric.project &&
          metric.project.replace(/\.app$/, "") !== "evaluation" &&
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
      const task = (await ctx.read.tasks.get(
        metricReviewTaskId(metric.id, reviewer),
      )) as any;
      const accepted = task?.result?.result ?? task?.result;
      if (Number(accepted?.nextReviewAt) > now) continue;
      const cut = Math.max(
        end,
        Math.min(now, Number(metric.measured_at ?? 0) + 1),
      );
      const evidence = await reader(metric.id, cut);
      const latest = evidence.latest as any;
      const comparison = evidence.comparison as any;
      const collectionFailures = evidence.collectionFailures as any[];
      const notable =
        metric.alertOpen === true ||
        ["missing", "stale"].includes(String(evidence.freshness)) ||
        (comparison?.change !== null && Number(comparison?.change) !== 0) ||
        (collectionFailures?.length &&
          Number(collectionFailures[0].at) > Number(latest?.measuredAt ?? 0));
      facts.push(`selector:metric-observed:${metric.id}:cut=${cut}`);
      if (notable)
        return {
          candidate: { metricId: metric.id, end: cut, reviewer },
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

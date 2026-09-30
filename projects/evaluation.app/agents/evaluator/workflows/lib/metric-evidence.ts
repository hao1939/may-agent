import { hostReportUrl } from "./host-reporting.js";
import { metricEvidenceHash } from "./task-report-store.js";

export type MetricEvidence = Record<string, unknown> & {
  available: true;
  metricId: string;
  end: number;
  windowMs: number;
  metric: {
    id: string;
    project: string;
    status: string;
    description?: string;
    [key: string]: unknown;
  };
};
export type MetricReader = (
  metricId: string,
  end: number,
) => Promise<MetricEvidence>;

export function metricReviewCut(now = Date.now()) {
  return Math.floor(now / 3_600_000) * 3_600_000;
}

export async function readMetricEvidence(
  metricId: string,
  end: number,
): Promise<MetricEvidence> {
  const url = hostReportUrl(
    `/api/metrics/${encodeURIComponent(metricId)}/evidence`,
  );
  url.searchParams.set("end", String(end));
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Metric evidence read failed: HTTP ${response.status}`);
  const bytes = await response.text();
  if (Buffer.byteLength(bytes) > 128_000)
    throw new Error("Metric evidence exceeds the review bound");
  const value = JSON.parse(bytes);
  if (
    value?.version !== 1 ||
    value.available !== true ||
    value.metricId !== metricId ||
    value.end !== end ||
    value.metric?.id !== metricId ||
    typeof value.metric.project !== "string" ||
    !value.metric.project ||
    value.metric.project.replace(/\.app$/, "") === "evaluation"
  ) {
    throw new Error(
      "Metric evidence does not identify an external App observation",
    );
  }
  return value;
}

export { metricEvidenceHash };

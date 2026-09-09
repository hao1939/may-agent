import type { MetricView } from "@may-agent/sdk";
import type { MetricService } from "../../../lib/metrics.js";

export function readMetricView(metrics: Pick<MetricService, "get">, id: string): MetricView | null {
  const metric = metrics.get(id);
  if (!metric) return null;
  return {
    id: metric.id,
    value: metric.current,
    status: metric.status,
    target: metric.target,
    threshold: metric.threshold,
    unit: metric.unit,
  };
}

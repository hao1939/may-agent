import { defineObserver, type ResourceObserver } from "@may-agent/sdk";
import {
  readMetricObservation,
  type MetricReader,
} from "../../evaluation.app/agents/evaluator/workflows/lib/metric-evidence.js";

/** Read retained samples. Existing metric producers own collection and aggregation. */
export function createMetricEvidenceObserver(
  reader: MetricReader = readMetricObservation,
): ResourceObserver {
  return defineObserver({
    id: "metric-evidence",
    type: "may.metric.state",
    description:
      'Read retained value, measuredAt, sampleId and freshness for an exact metric. resource is the bare metric ID, without a metric: prefix. For a newer fresh sample use expected:{field:"measuredAt",gt:BASELINE_MEASURED_AT,freshness:"fresh"}; for fresh zero use expected:{field:"value",equals:0,freshness:"fresh"}. Condition comparators are gt/gte/lt/lte, not greaterThan. Choose reviewAfterMs in milliseconds (minimum 60000). A match invites judgment; it does not accept recovery.',
    intervalMs: 60_000,
    timeoutMs: 15_000,
    async inspect(resource, { signal }) {
      signal.throwIfAborted();
      const evidence = await reader(resource, Date.now(), undefined, signal);
      signal.throwIfAborted();
      if (evidence.metricId !== resource || evidence.metric.id !== resource)
        throw new Error("Metric observation identity differs");
      const latest = evidence.latest as Record<string, unknown> | null;
      return {
        metricId: resource,
        freshness: evidence.freshness,
        value: latest?.value ?? null,
        measuredAt: latest?.measuredAt ?? null,
        sampleId: latest?.id ?? null,
      };
    },
  });
}

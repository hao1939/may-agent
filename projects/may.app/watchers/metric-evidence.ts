import { defineObserver, type ResourceObserver } from "@may-agent/sdk";
import {
  readMetricEvidence,
  type MetricReader,
} from "../../evaluation.app/agents/evaluator/workflows/lib/metric-evidence.js";

/** Read retained samples. Existing metric producers own collection and aggregation. */
export function createMetricEvidenceObserver(
  reader: MetricReader = readMetricEvidence,
): ResourceObserver {
  return defineObserver({
    id: "metric-evidence",
    type: "may.metric.state",
    description:
      "Read retained value, measuredAt, sampleId and freshness for an exact metric. Choose the expected predicate and review interval. A match invites judgment; it does not accept recovery.",
    intervalMs: 60_000,
    timeoutMs: 15_000,
    async inspect(resource, { signal }) {
      signal.throwIfAborted();
      const evidence = await reader(resource, Date.now());
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

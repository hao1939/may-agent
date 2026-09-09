import type { AppDefinition, AppRead } from "@may-agent/sdk";
import type { SqliteDb } from "../../lib/db.js";
import { createMetricService, type MetricService } from "../../lib/metrics.js";
import { syncAppMetricDefinitions } from "../adapters/reporting/metric-definitions.js";
import { readMetricView } from "../adapters/reporting/metric-read.js";
import { readTaskOutcomes } from "../adapters/reporting/task-outcomes.js";
import type { TaskOutcomeReader } from "../core/reads/reporting.js";

/** Optional shipped reports. No lifecycle, registrations, or private Task stores. */
export type AppReporting = {
  readMetric: AppRead["metric"];
  readOutcomes: TaskOutcomeReader;
  syncDefinitions(entries: readonly { definition: AppDefinition }[]): void;
};

export function createAppReporting(getDb: () => SqliteDb): AppReporting {
  let metrics: MetricService | undefined;
  const service = () => (metrics ??= createMetricService({ getDb }));
  return {
    readMetric: async (id) => readMetricView(service(), id),
    readOutcomes: readTaskOutcomes,
    syncDefinitions(entries) {
      if (entries.some(({ definition }) => definition.metrics?.length)) {
        syncAppMetricDefinitions(entries, service());
      }
    },
  };
}

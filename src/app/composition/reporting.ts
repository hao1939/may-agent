import { resolve } from "node:path";
import type { AppDefinition, AppMetricCollectContext, AppRead, MetricSampleResult } from "@may-agent/sdk/app";
import type { SqliteDb } from "../../lib/db.js";
import { createMetricService, type MetricService } from "../../lib/metrics.js";
import { syncAppMetricDefinitions } from "../adapters/reporting/metric-definitions.js";
import { readMetricView } from "../adapters/reporting/metric-read.js";

export type AppCollectorEntry = {
  definition: AppDefinition;
  dir?: string;
};

export type AppCollectorReadFactory = (appId: string, appDir: string) => AppRead;

/** Optional shipped reports. No lifecycle, registrations, or private Task stores. */
export type AppReporting = {
  readMetric: AppRead["metric"];
  syncDefinitions(
    entries: readonly AppCollectorEntry[],
    readFactory?: AppCollectorReadFactory,
  ): void;
  getCollector(
    metricId: string,
  ): ((signal: AbortSignal, now: number) => Promise<MetricSampleResult | null>) | undefined;
};

export function createAppReporting(getDb: () => SqliteDb): AppReporting {
  let metrics: MetricService | undefined;
  let collectors = new Map<string, (signal: AbortSignal, now: number) => Promise<MetricSampleResult | null>>();
  const service = () => (metrics ??= createMetricService({ getDb }));
  return {
    readMetric: async (id) => readMetricView(service(), id),
    syncDefinitions(entries, readFactory) {
      const hasDeclaredMetrics = entries.some(({ definition }) => definition.metrics?.length);
      if (hasDeclaredMetrics || metrics) {
        syncAppMetricDefinitions(entries, service(), getDb());
      }
      const nextCollectors = new Map<
        string,
        (signal: AbortSignal, now: number) => Promise<MetricSampleResult | null>
      >();
      if (readFactory) {
        for (const entry of entries) {
          const appId = entry.definition.id;
          const appRoot = entry.dir ?? process.cwd();
          const projectRoot = entry.definition.workspace?.localPath
            ? resolve(appRoot, entry.definition.workspace.localPath)
            : appRoot;
          let cachedRead: AppRead | undefined;
          const getRead = () => (cachedRead ??= readFactory(appId, appRoot));
          for (const declared of entry.definition.metrics ?? []) {
            if (typeof declared.collect !== "function") continue;
            if ((declared.status ?? "active") !== "active") continue;
            const collectFn = declared.collect;
            nextCollectors.set(declared.id, async (signal, now) => {
              const ctx: AppMetricCollectContext = {
                appId,
                appRoot,
                projectRoot,
                read: getRead(),
                signal,
                now,
              };
              return await collectFn(ctx);
            });
          }
        }
      }
      collectors = nextCollectors;
    },
    getCollector: (metricId) => collectors.get(metricId),
  };
}

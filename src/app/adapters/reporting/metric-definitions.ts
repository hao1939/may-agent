import type { AppDefinition, MetricDefinition } from "@may-agent/sdk/app";
import type { SqliteDb } from "../../../lib/db.js";
import { withSqliteInitializationRetry } from "../../../lib/db/busy-retry.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { MetricService } from "../../../lib/metrics.js";

export type AppMetricDefinitionEntry = {
  definition: AppDefinition;
  dir?: string;
};

/** Install current App-owned definitions without moving measurement ownership into the Host catalog. */
export function syncAppMetricDefinitions(
  entries: readonly AppMetricDefinitionEntry[],
  metrics: Pick<MetricService, "define">,
  db?: SqliteDb,
): void {
  const activeCollectorIds = new Set<string>();
  const loadedAppIds = new Set<string>();

  for (const { definition } of entries) {
    loadedAppIds.add(definition.id);
    const defaultOwner = definition.agent;
    for (const declared of definition.metrics ?? []) {
      const hasCollect = typeof declared.collect === "function";
      if (hasCollect && (declared.sourceQuery?.trim() || declared.sourceCommand?.trim())) {
        throw new Error(
          `App metric '${declared.id}' cannot combine collect() with sourceQuery or sourceCommand`,
        );
      }
      const { collect: _collect, ...stored } = declared;
      const metric: MetricDefinition = hasCollect
        ? {
            ...stored,
            owner: declared.owner ?? defaultOwner,
            project: declared.project ?? definition.id,
            source: declared.source ?? "app-collector",
            measureInterval: declared.measureInterval ?? 300_000,
            config: {
              ...(declared.config ?? {}),
              scope:
                typeof declared.config?.scope === "string" && declared.config.scope.trim()
                  ? declared.config.scope
                  : `app:${definition.id}`,
              domainMetric: declared.config?.domainMetric ?? true,
            },
          }
        : {
            ...stored,
            owner: declared.owner ?? defaultOwner,
            project: declared.project ?? definition.id,
          };
      if (hasCollect && (metric.status ?? "active") === "active") {
        activeCollectorIds.add(metric.id);
      }
      withSqliteInitializationRetry(`sync App metric definition '${metric.id}'`, () => metrics.define(metric));
    }
  }

  if (db && loadedAppIds.size > 0) {
    withSqliteInitializationRetry("retire removed App collector metrics", () => {
      stateTransaction(db, () => {
        const now = Date.now();
        for (const appId of loadedAppIds) {
          const rows = db
            .prepare(
              `SELECT id FROM metrics
               WHERE project = ? AND source = 'app-collector' AND status = 'active'`,
            )
            .all(appId) as Array<{ id: string }>;
          for (const row of rows) {
            if (activeCollectorIds.has(row.id)) continue;
            db.run("UPDATE metrics SET status = 'retired', updated_at = ? WHERE id = ?", [now, row.id]);
            db.run("UPDATE metric_alerts SET resolved_at = ? WHERE metric_id = ? AND resolved_at IS NULL", [
              now,
              row.id,
            ]);
          }
        }
      });
    });
  }
}

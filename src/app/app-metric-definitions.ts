import type { AppDefinition, MetricDefinition } from "@may-agent/sdk";
import type { MetricService } from "../lib/metrics.js";

export type AppMetricDefinitionEntry = {
  definition: AppDefinition;
};

/** Install current App-owned definitions without moving measurement ownership into the Host catalog. */
export function syncAppMetricDefinitions(
  entries: readonly AppMetricDefinitionEntry[],
  metrics: Pick<MetricService, "define">,
): void {
  for (const { definition } of entries) {
    const defaultOwner = definition.agent ?? definition.owner;
    for (const declared of definition.metrics ?? []) {
      const metric: MetricDefinition = {
        ...declared,
        owner: declared.owner ?? defaultOwner,
        project: declared.project ?? definition.id,
      };
      metrics.define(metric);
    }
  }
}

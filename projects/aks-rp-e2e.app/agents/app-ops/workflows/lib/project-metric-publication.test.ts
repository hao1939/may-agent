import { describe, expect, it } from "bun:test";

import { projectMetricDefinitions } from "./project-metric-publication.ts";

const appDir = "/app/projects/aks-rp-e2e.app";

describe("projectMetricDefinitions", () => {
  it("reactivates the 35 non-focus, non-retired project metrics", () => {
    const definitions = projectMetricDefinitions(appDir);
    const ids = new Set(definitions.map((definition) => definition.id));

    expect(definitions).toHaveLength(35);
    expect(ids.has("aks-rp-e2e.process.unpublished-change-count")).toBe(true);
    expect(ids.has("aks-rp-e2e.spec.total-count")).toBe(true);
    expect(ids.has("aks-rp-e2e.run.live-idle-with-runnable-work")).toBe(true);
    expect(ids.has("aks-rp-e2e.task.stale-active-count")).toBe(true);

    expect(ids.has("aks-rp-e2e.task.completed-24h")).toBe(false);
    expect(ids.has("aks-rp-e2e.task.no-work-with-gaps")).toBe(false);
    expect(ids.has("aks-rp-e2e.task.blocked-actionable-count")).toBe(false);
    expect(ids.has("aks-rp-e2e.planner.slow-count-24h")).toBe(false);
    expect(ids.has("aks-rp-e2e.spec.unverified-count")).toBe(false);
    expect(ids.has("aks-rp-e2e.run.live-started-24h")).toBe(false);
  });

  it("wires source commands under the current app layout and marks metrics active", () => {
    const definitions = projectMetricDefinitions(appDir);
    const unpublished = definitions.find(
      (definition) =>
        definition.id === "aks-rp-e2e.process.unpublished-change-count",
    );
    const specTotal = definitions.find(
      (definition) => definition.id === "aks-rp-e2e.spec.total-count",
    );

    expect(unpublished).toMatchObject({
      source: "source_command",
      sourceCommand:
        "bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json",
      status: "active",
      measureInterval: 300_000,
      owner: "app-ops",
      project: "aks-rp-e2e",
    });
    expect(specTotal).toMatchObject({
      sourceCommand:
        "bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.spec.total-count --json",
      status: "active",
    });
  });
});

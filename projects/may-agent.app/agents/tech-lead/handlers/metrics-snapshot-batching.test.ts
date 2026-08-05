import { describe, expect, test } from "bun:test";
import { batchableProjectMetricCommand } from "./metrics-snapshot.ts";

describe("metrics-snapshot project metric batching", () => {
  test("recognizes the registered project-metrics command shape", () => {
    expect(
      batchableProjectMetricCommand(
        "bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.task.active-count --json",
      ),
    ).toEqual({
      scriptPath:
        "/app/projects/aks-rp-e2e.app/scripts/project-metrics.ts",
      metricId: "aks-rp-e2e.task.active-count",
    });
  });

  test("leaves unrelated commands on the individual path", () => {
    expect(
      batchableProjectMetricCommand(
        "bun /app/projects/aks-rp-e2e.app/scripts/focus-metric-sample.ts aks-rp-e2e.spec.failed-count --json",
      ),
    ).toBeNull();
  });
});

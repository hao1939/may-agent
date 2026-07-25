import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sampleFocusMetric } from "./focus-metrics.js";

describe("focus metrics", () => {
  test("counts current live pipeline artifacts without double-counting nested probe results", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-focus-metrics-"));
    const projectDir = join(root, "aks-rp-e2e");
    const appDir = join(root, "aks-rp-e2e.app");
    const resultDir = join(
      appDir,
      ".state",
      "watchers",
      "aks-pipeline-artifacts",
      "123",
      "slice-01-test-results",
      "runs",
      "test-results",
      "test-current",
    );
    const nestedDir = join(
      resultDir,
      "artifacts",
      "spec-example",
      "spec-runner",
    );
    try {
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(
        join(resultDir, "result.json"),
        JSON.stringify({
          status: "passed",
          updatedAt: new Date().toISOString(),
          target: { surface: "live-azure-run" },
        }),
      );
      writeFileSync(
        join(nestedDir, "result.json"),
        JSON.stringify({
          status: "passed",
          completedAt: new Date().toISOString(),
          mode: "execute",
        }),
      );

      expect(
        sampleFocusMetric(projectDir, "aks-rp-e2e.run.live-started-24h", {
          appDir,
        }),
      ).toMatchObject({ value: 1, sampleSize: 1 });
      expect(
        sampleFocusMetric(projectDir, "aks-rp-e2e.run.live-succeeded-24h", {
          appDir,
        }),
      ).toMatchObject({ value: 1, sampleSize: 1 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

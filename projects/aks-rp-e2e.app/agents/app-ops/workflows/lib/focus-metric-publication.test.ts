import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  focusMetricDefinitions,
  publishFocusMetrics,
} from "./focus-metric-publication.ts";

describe("focus metric publication", () => {
  test("defines active source-command metrics and records fresh samples", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-focus-metric-publication-"));
    const appDir = join(root, "aks-rp-e2e.app");
    const projectDir = join(root, "aks-rp-e2e");
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

    const captured: {
      definitions: unknown[];
      records: Array<{
        id: string;
        value: number;
        opts: Record<string, unknown> | undefined;
      }>;
      evaluations: string[];
    } = {
      definitions: [],
      records: [],
      evaluations: [],
    };

    try {
      mkdirSync(join(projectDir, "model", "knowledge-map"), {
        recursive: true,
      });
      mkdirSync(resultDir, { recursive: true });
      writeFileSync(
        join(projectDir, "model", "knowledge-map", "model.json"),
        JSON.stringify({
          featurePaths: [{ status: "unknown" }, { status: "pass" }],
        }),
      );
      writeFileSync(
        join(resultDir, "result.json"),
        JSON.stringify({
          status: "passed",
          updatedAt: new Date().toISOString(),
          target: { surface: "live-azure-run" },
        }),
      );

      const definitions = focusMetricDefinitions(appDir);
      expect(definitions).toHaveLength(5);
      expect(
        definitions.every((definition) => definition.status === "active"),
      ).toBe(true);
      expect(
        definitions.every(
          (definition) =>
            definition.source === "source_command" &&
            definition.sourceCommand?.includes(
              `${appDir}/scripts/focus-metric-sample.ts`,
            ),
        ),
      ).toBe(true);

      const published = publishFocusMetrics({
        metrics: {
          defineMany(defs) {
            captured.definitions = defs;
          },
          record(id, value, opts) {
            captured.records.push({ id, value, opts });
          },
          evaluate(id) {
            if (id) captured.evaluations.push(id);
            return [];
          },
        },
        appDir,
        projectDir,
        measuredBy: "test:focus-metric-publication",
      });

      expect(captured.definitions).toHaveLength(5);
      expect(captured.records).toHaveLength(5);
      expect(captured.evaluations).toEqual(published.map((entry) => entry.id));

      expect(captured.records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "aks-rp-e2e.run.live-started-24h",
            value: 1,
            opts: expect.objectContaining({
              sampleSize: 1,
              measuredBy: "test:focus-metric-publication",
            }),
          }),
          expect.objectContaining({
            id: "aks-rp-e2e.run.live-succeeded-24h",
            value: 1,
          }),
          expect.objectContaining({
            id: "aks-rp-e2e.spec.unverified-count",
            value: 0,
          }),
          expect.objectContaining({
            id: "aks-rp-e2e.spec.failed-count",
            value: 0,
          }),
          expect.objectContaining({
            id: "aks-rp-e2e.model.unknown-path-count",
            value: 1,
          }),
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

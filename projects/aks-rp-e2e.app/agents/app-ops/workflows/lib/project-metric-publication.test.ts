import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  projectMetricDefinitions,
  sampleProjectMetricOutputs,
} from "./project-metric-publication.ts";

const appDir = "/app/projects/aks-rp-e2e.app";
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("projectMetricDefinitions", () => {
  it("reactivates current project metrics and closes the retired reviewer metric", () => {
    const definitions = projectMetricDefinitions(appDir);
    const ids = new Set(definitions.map((definition) => definition.id));

    expect(definitions).toHaveLength(35);
    expect(
      definitions.filter((definition) => definition.status === "active"),
    ).toHaveLength(34);
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
    expect(
      definitions.find(
        (definition) =>
          definition.id === "aks-rp-e2e.process.task.review-not-applied-count",
      ),
    ).toMatchObject({ status: "closed", priority: "P3" });
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

  it("samples through the canonical app and project paths instead of the bundled module path", () => {
    const fakeAppDir = mkdtempSync(join(tmpdir(), "aks-project-metrics-"));
    tempDirs.push(fakeAppDir);
    const fakeProjectDir = join(fakeAppDir, "domain-workspace");
    mkdirSync(join(fakeAppDir, "scripts"), { recursive: true });
    writeFileSync(
      join(fakeAppDir, "scripts", "project-metrics.ts"),
      [
        "const ids = process.argv.slice(process.argv.indexOf('--batch-json') + 1);",
        "const output = Object.fromEntries(ids.map((id) => [id, {",
        "  value: process.env.AKS_RP_E2E_APP_DIR === process.cwd() && process.env.PROJECT_DIR?.endsWith('domain-workspace') ? 1 : -1,",
        "  measuredAt: 123,",
        "  treePath: `${process.env.AKS_RP_E2E_APP_DIR}/.state/tasks/tree.json`,",
        "}]));",
        "console.log(JSON.stringify(output));",
      ].join("\n"),
    );

    expect(
      sampleProjectMetricOutputs({
        appDir: fakeAppDir,
        projectDir: fakeProjectDir,
        metricIds: ["metric.one", "metric.two"],
      }),
    ).toEqual({
      "metric.one": {
        value: 1,
        measuredAt: 123,
        treePath: `${fakeAppDir}/.state/tasks/tree.json`,
      },
      "metric.two": {
        value: 1,
        measuredAt: 123,
        treePath: `${fakeAppDir}/.state/tasks/tree.json`,
      },
    });
  });
});

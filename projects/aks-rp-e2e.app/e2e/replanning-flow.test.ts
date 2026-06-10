import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  createReplan,
  loadJsonFile,
  renderCombinedProbe,
  writeReplanArtifacts,
  type FeaturePathTestSpec,
  type PathSummary,
} from "../../aks-rp-e2e/model/tools/src/replan-feature-paths.ts";

const projectRoot = resolve(import.meta.dirname, "../../aks-rp-e2e");

function loadRunnableSpecsFromIndex(indexPath: string): FeaturePathTestSpec[] {
  const index = loadJsonFile<{ specFiles?: Array<string | { file?: string | null }> }>(indexPath);
  const baseDir = dirname(indexPath);
  return (index.specFiles ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry.file))
    .filter((file): file is string => Boolean(file))
    .map((file) => loadJsonFile<FeaturePathTestSpec>(resolve(baseDir, file)));
}

describe("replanning flow e2e", () => {
  test("learned ManagedSystem paths regenerate into one dry-run TypeScript probe", async () => {
    const pathSummary = loadJsonFile<PathSummary>(join(projectRoot, "model/knowledge-map/views/path-summary.json"));
    const specs = loadRunnableSpecsFromIndex(join(projectRoot, "specs/index.json"));
    const selectedPathIds = [
      "path.managedsystem.rest-add-existing.minimal-rest",
      "path.managedsystem.mode-immutability",
      "path.managedsystem.delete-existing",
    ];

    const plan = createReplan({ pathSummary, specs, selectedPathIds });

    expect(plan.rejectedPaths).toEqual([]);
    expect(plan.acceptedPathIds).toEqual(selectedPathIds);
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0]?.selectedPathIds).toEqual([
      "path.managedsystem.rest-add-existing.minimal-rest",
      "path.managedsystem.delete-existing",
    ]);
    expect(plan.groups[1]?.selectedPathIds).toEqual(["path.managedsystem.mode-immutability"]);
    expect(plan.metrics.selectedScenarioCount).toBe(1);
    expect(plan.metrics.behaviorAssertionCount).toBe(12);
    expect(plan.metrics.baselineClusterCrudCount).toBe(3);
    expect(plan.metrics.replannedClusterCrudCount).toBe(2);
    expect(plan.metrics.clusterCrudSaved).toBe(1);
    expect(plan.metrics.expectationDensity).toBe(6);
    expect(plan.groups[0]?.diagnosticClean).toBe(false);
    expect(plan.groups[1]?.diagnosticClean).toBe(true);

    const probe = renderCombinedProbe(plan);
    expect(probe).toContain("AKS_RP_E2E_DRY_RUN");
    expect(probe).toContain("path.managedsystem.rest-add-existing.minimal-rest");
    expect(probe).toContain("path.managedsystem.mode-immutability");
    expect(probe).toContain("path.managedsystem.delete-existing");
    expect(probe).toContain("managedSystem.rejectedField.httpStatus");
    expect(probe).toContain("agentPool.managedsystem.deleted");

    const outDir = await mkdtemp(join(tmpdir(), "aks-rp-e2e-replan-"));
    const artifacts = writeReplanArtifacts(plan, outDir);
    const writtenPlan = JSON.parse(await readFile(artifacts.planPath, "utf8"));
    expect(writtenPlan.metrics.clusterCrudSaved).toBe(1);

    const run = Bun.spawnSync({
      cmd: ["bun", artifacts.probePath],
      cwd: projectRoot,
      env: {
        ...process.env,
        AKS_RP_E2E_DRY_RUN: "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = new TextDecoder().decode(run.stdout);
    const stderr = new TextDecoder().decode(run.stderr);

    expect(run.exitCode, stderr).toBe(0);
    expect(stdout).toContain("[dry-run] PUT");
    expect(stdout).toContain("[dry-run] DELETE");
    expect(stdout).toContain("clusterCrud baseline=3 replanned=2 saved=1");
    expect(stdout).toContain("group=group.01 paths=path.managedsystem.rest-add-existing.minimal-rest,path.managedsystem.delete-existing");
    expect(stdout).toContain("group=group.02 paths=path.managedsystem.mode-immutability");
  });
});

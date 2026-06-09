import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createReplan,
  loadJsonFile,
  loadTestSpecsFromIndex,
  renderCombinedProbe,
  writeReplanArtifacts,
  type PathSummary,
} from "../../../model/tools/src/replan-feature-paths.js";

const projectRoot = resolve(import.meta.dirname, "../../..");

describe("replanning flow e2e", () => {
  test("learned ManagedSystem paths regenerate into one dry-run TypeScript probe", async () => {
    const pathSummary = loadJsonFile<PathSummary>(join(projectRoot, "model/knowledge-map/views/path-summary.json"));
    const specs = loadTestSpecsFromIndex(join(projectRoot, "specs/index.json"));
    const selectedPathIds = [
      "path.managedsystem.rest-add-existing.minimal-rest",
      "path.managedsystem.mode-immutability",
      "path.managedsystem.delete-existing",
    ];

    const plan = createReplan({ pathSummary, specs, selectedPathIds });

    expect(plan.rejectedPaths).toEqual([]);
    expect(plan.acceptedPathIds).toEqual(selectedPathIds);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.selectedPathIds).toEqual(selectedPathIds);
    expect(plan.metrics.selectedScenarioCount).toBe(1);
    expect(plan.metrics.behaviorAssertionCount).toBe(8);
    expect(plan.metrics.baselineClusterCrudCount).toBe(3);
    expect(plan.metrics.replannedClusterCrudCount).toBe(1);
    expect(plan.metrics.clusterCrudSaved).toBe(2);
    expect(plan.metrics.expectationDensity).toBe(8);
    expect(plan.groups[0]?.diagnosticClean).toBe(true);

    const probe = renderCombinedProbe(plan);
    expect(probe).toContain("AKS_RP_E2E_DRY_RUN");
    expect(probe).toContain("path.managedsystem.rest-add-existing.minimal-rest");
    expect(probe).toContain("path.managedsystem.mode-immutability");
    expect(probe).toContain("path.managedsystem.delete-existing");
    expect(probe).toContain("rp.request.accepted");
    expect(probe).toContain("agentPool.mode.changeRejected");
    expect(probe).toContain("agentPool.managedsystem.deleted");

    const outDir = await mkdtemp(join(tmpdir(), "aks-rp-e2e-replan-"));
    const artifacts = writeReplanArtifacts(plan, outDir);
    const writtenPlan = JSON.parse(await readFile(artifacts.planPath, "utf8"));
    expect(writtenPlan.metrics.clusterCrudSaved).toBe(2);

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
    expect(stdout).toContain("clusterCrud baseline=3 replanned=1 saved=2");
    expect(stdout).toContain("paths=path.managedsystem.rest-add-existing.minimal-rest,path.managedsystem.mode-immutability,path.managedsystem.delete-existing");
  });
});

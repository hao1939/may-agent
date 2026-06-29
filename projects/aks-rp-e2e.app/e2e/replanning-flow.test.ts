import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
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
  const index = loadJsonFile<{
    specFiles?: Array<string | { file?: string | null }>;
  }>(indexPath);
  const baseDir = dirname(indexPath);
  return (index.specFiles ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry.file))
    .filter((file): file is string => Boolean(file))
    .map((file) => loadJsonFile<FeaturePathTestSpec>(resolve(baseDir, file)));
}

function listFeatureOwnedSpecFiles(dir: string): string[] {
  const found: string[] = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === "specs") {
        for (const name of readdirSync(path)
          .filter((candidate) => candidate.endsWith(".json"))
          .sort((a, b) => a.localeCompare(b))) {
          found.push(join(path, name));
        }
      } else {
        found.push(...listFeatureOwnedSpecFiles(path));
      }
    }
  }
  return found;
}

function loadRunnableSpecs(projectRoot: string): FeaturePathTestSpec[] {
  const legacyIndexPath = join(projectRoot, "specs/index.json");
  if (existsSync(legacyIndexPath)) {
    return loadRunnableSpecsFromIndex(legacyIndexPath);
  }
  return listFeatureOwnedSpecFiles(join(projectRoot, "features")).map((path) =>
    loadJsonFile<FeaturePathTestSpec>(path),
  );
}

describe("replanning flow e2e", () => {
  test("learned ManagedSystem paths regenerate into one dry-run TypeScript probe", async () => {
    const pathSummary = loadJsonFile<PathSummary>(
      join(projectRoot, "model/knowledge-map/views/path-summary.json"),
    );
    const specs = loadRunnableSpecs(projectRoot);
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
    expect(plan.groups[0]?.specIds).toEqual([
      "spec.managedsystem.add-immutability-delete-combined",
    ]);
    expect(plan.groups[0]?.operations.map((operation) => operation.id)).toEqual(
      [
        "op.put-managedsystem-pool",
        "op.get-managedsystem-pool",
        "op.put-vmsize-mutation",
        "op.get-after-vmsize-rejection",
        "op.put-mode-system",
        "op.get-after-mode-rejection",
        "op.delete-managedsystem-pool",
        "op.poll-deleted",
      ],
    );
    expect(plan.metrics.selectedScenarioCount).toBe(1);
    expect(plan.metrics.behaviorAssertionCount).toBe(14);
    expect(plan.metrics.baselineClusterCrudCount).toBe(1);
    expect(plan.metrics.replannedClusterCrudCount).toBe(1);
    expect(plan.metrics.clusterCrudSaved).toBe(0);
    expect(plan.metrics.expectationDensity).toBe(14);
    expect(plan.metrics.diagnosticCleanGroupCount).toBe(1);
    expect(plan.groups[0]?.diagnosticClean).toBe(true);

    const probe = renderCombinedProbe(plan);
    expect(probe).toContain("AKS_RP_E2E_DRY_RUN");
    expect(probe).toContain(
      "path.managedsystem.rest-add-existing.minimal-rest",
    );
    expect(probe).toContain("path.managedsystem.mode-immutability");
    expect(probe).toContain("path.managedsystem.delete-existing");
    expect(probe).toContain("op.put-managedsystem-pool");
    expect(probe).toContain("op.delete-managedsystem-pool");
    expect(probe).toContain("fieldRejection.vmSize.rp.request.accepted=false");
    expect(probe).toContain("delete.agentPool.managedsystem.deleted=true");

    const outDir = await mkdtemp(join(tmpdir(), "aks-rp-e2e-replan-"));
    const artifacts = writeReplanArtifacts(plan, outDir);
    const writtenPlan = JSON.parse(await readFile(artifacts.planPath, "utf8"));
    expect(writtenPlan.metrics.clusterCrudSaved).toBe(0);

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
    expect(stdout).toContain("clusterCrud baseline=1 replanned=1 saved=0");
    expect(stdout).toContain(
      "group=group.01 paths=path.managedsystem.rest-add-existing.minimal-rest,path.managedsystem.mode-immutability,path.managedsystem.delete-existing",
    );
  });
});

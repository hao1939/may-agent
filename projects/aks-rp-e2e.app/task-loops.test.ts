import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  featureCompactLoopTaskId,
  legacyBranchReconciliationTaskId,
  learnedCompactVerificationAcceptance,
  learnedScenarioNormalizationAcceptance,
  learnedSpecVerificationAcceptance,
  loopFrontierAccounting,
  loopRefillWakeForTaskEvent,
  repositorySkillMaintenanceTaskId,
  scenarioNormalizationTaskId,
  specLoopTaskId,
  standingLoopIntent,
} from "./task-loops";

describe("AKS standing-loop convention", () => {
  test("defines one canonical actionable frontier per loop", () => {
    expect(standingLoopIntent(specLoopTaskId).input).toEqual({
      frontierLimit: 5,
    });
    expect(standingLoopIntent(featureCompactLoopTaskId).input).toEqual({
      frontierLimit: 3,
    });
    expect(standingLoopIntent(scenarioNormalizationTaskId).input).toEqual({
      frontierLimit: 5,
    });
    expect(standingLoopIntent(legacyBranchReconciliationTaskId).input).toEqual({
      frontierLimit: 1,
    });
    expect(standingLoopIntent(repositorySkillMaintenanceTaskId).input).toEqual({
      frontierLimit: 1,
      reviewIntervalMs: 86_400_000,
      safeEvaluationOnly: true,
      skillPath: "skills/aks-rp-e2e",
    });
  });

  test("keeps repository skill quality as one safe maintain task", () => {
    const definition = standingLoopIntent(repositorySkillMaintenanceTaskId);
    const acceptance = definition.acceptance.join("\n");

    expect(definition).toMatchObject({
      id: repositorySkillMaintenanceTaskId,
      parentId: "group/domain-work",
      mode: "maintain",
      owner: "aks-explorer",
      workflow: "domain-task-execution",
    });
    expect(acceptance).toContain("representative user journeys");
    expect(acceptance).toContain("realistic human requests");
    expect(acceptance).toContain("explain a real feature or spec");
    expect(acceptance).toContain("cross-check the inspector's feature path");
    expect(acceptance).toContain("existing-standalone guidance");
    expect(acceptance).toContain("real recent result or artifact");
    expect(acceptance).toContain("realistic TypeScript scenario migration");
    expect(acceptance).toContain("spec-referenced plain TypeScript carrier");
    expect(acceptance).toContain("exact mutation-gate comparison");
    expect(acceptance).toContain(
      "admission helpers would catch a broken safety gate",
    );
    expect(acceptance).toContain("write its expected outcome");
    expect(acceptance).toContain("command success alone is not acceptance");
    expect(acceptance).toContain("rather than toy fixtures");
    expect(acceptance).toContain("skill, repository UX or tooling");
    expect(acceptance).toContain("smallest durable surface");
    expect(acceptance).toContain("TypeScript or JavaScript");
    expect(acceptance).toContain("rerun the same failed user case");
    expect(acceptance).toContain("Continue until no material gap remains");
    expect(acceptance).toContain("compact case table");
    expect(acceptance).toContain("Do not queue live pipelines");
    expect(acceptance).toContain("one stable task");
  });

  test("bakes learned worker practice into standing loop acceptance", () => {
    expect(standingLoopIntent(specLoopTaskId).acceptance).toEqual(
      expect.arrayContaining(learnedSpecVerificationAcceptance),
    );
    expect(standingLoopIntent(featureCompactLoopTaskId).acceptance).toEqual(
      expect.arrayContaining(learnedCompactVerificationAcceptance),
    );
    expect(standingLoopIntent(scenarioNormalizationTaskId).acceptance).toEqual(
      expect.arrayContaining(learnedScenarioNormalizationAcceptance),
    );
    expect(
      standingLoopIntent(legacyBranchReconciliationTaskId).acceptance.join(
        "\n",
      ),
    ).toContain("reaches origin/dev");
  });

  test("spec-loop worker practice preserves live-run and carrier-normalization lessons", () => {
    const acceptance = standingLoopIntent(specLoopTaskId).acceptance.join("\n");
    expect(acceptance).toContain("nearby good and bad same-family examples");
    expect(acceptance).toContain("shared runner helpers");
    expect(acceptance).toContain("target-environment wiring");
    expect(acceptance).toContain("mounted private AKS RP source");
    expect(acceptance).toContain("branch/commit ADO will run");
    expect(acceptance).toContain("A fast no-cluster pass is inconclusive");
    expect(acceptance).toContain("terminal with no artifacts");
    expect(acceptance).toContain(
      "Reviewer acceptance of an artifact review is not the same as a passing spec",
    );
    expect(acceptance).toContain("structured state");
  });

  test("scenario normalization does not stop at a sibling wrapper", () => {
    const definition = standingLoopIntent(scenarioNormalizationTaskId);
    expect(definition.outcome).toContain("repository-only plain scenario");
    expect(definition.acceptance).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "remainingSpecReferencedPlainScenarioUnits and remainingRepoPlainScenarioFiles",
        ),
        expect.stringContaining("strict-passed true"),
      ]),
    );
  });

  test("compact-loop worker practice preserves real compaction lessons", () => {
    const acceptance = standingLoopIntent(
      featureCompactLoopTaskId,
    ).acceptance.join("\n");
    expect(acceptance).toContain("reuse known-good carriers");
    expect(acceptance).toContain(
      "Treat the selected feature as one natural ordered journey candidate",
    );
    expect(acceptance).toContain("Minimize transitions in this order");
    expect(acceptance).toContain("treat that as unfinished compact work");
    expect(acceptance).toContain("branch/commit ADO will run");
    expect(acceptance).toContain("No no-op, dry-run, or metadata-only pass");
    expect(acceptance).toContain("terminal with no artifacts");
    expect(acceptance).toContain("smallest failing branch");
  });

  test("counts only actionable phases against the frontier", () => {
    expect(
      loopFrontierAccounting(
        [
          { taskId: "running", phase: "running" },
          { taskId: "pending", phase: "pending" },
          { taskId: "wait", phase: "waiting" },
          { taskId: "attention", phase: "attention" },
          { taskId: "terminal", phase: "converged" },
        ],
        5,
      ),
    ).toEqual({
      actionableTaskIds: ["running", "pending"],
      waitingTaskIds: ["wait"],
      attentionTaskIds: ["attention"],
      terminalTaskIds: ["terminal"],
      available: 3,
    });
  });

  test("fans a reconciled loop leaf back into one controller wake", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "aks-loop-wake-"));
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        tasks: {
          "spec/verify-example": {
            input: {
              loopId: specLoopTaskId,
              workKey: "spec.example",
              workRevision: "abc123",
            },
          },
        },
      }),
    );

    expect(
      loopRefillWakeForTaskEvent(appDir, {
        type: "project.task.reconciled",
        target: { project: "aks-rp-e2e", taskId: "spec/verify-example" },
        data: { disposition: "waiting" },
      }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "spec-loop",
      target: { project: "aks-rp-e2e", taskId: specLoopTaskId },
      data: {
        sourceTaskId: "spec/verify-example",
        disposition: "waiting",
      },
    });
  });

  test("uses the reconciliation input after a completed leaf leaves the graph", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "aks-loop-complete-wake-"));
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({ tasks: {} }),
    );

    expect(
      loopRefillWakeForTaskEvent(appDir, {
        type: "project.task.reconciled",
        target: { project: "aks-rp-e2e", taskId: "compact/feature-a" },
        data: {
          disposition: "converged",
          input: {
            loopId: featureCompactLoopTaskId,
            workKey: "feature-a",
            workRevision: "rev-2",
          },
        },
      }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "feature-compact-loop",
      target: {
        project: "aks-rp-e2e",
        taskId: featureCompactLoopTaskId,
      },
    });
  });

  test("uses a completed leaf receipt when loop metadata was omitted", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "aks-loop-receipt-wake-"));
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({ tasks: {} }),
    );
    await writeFile(
      join(appDir, ".state", "tasks", "state.json"),
      JSON.stringify({
        receipts: {
          "domain/normalized-row": {
            parentId: "group/scenario-normalization",
          },
        },
      }),
    );

    expect(
      loopRefillWakeForTaskEvent(appDir, {
        type: "project.task.reconciled",
        target: {
          project: "aks-rp-e2e",
          taskId: "domain/normalized-row",
        },
        data: { disposition: "converged", input: {} },
      }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "scenario-normalization",
      target: {
        project: "aks-rp-e2e",
        taskId: scenarioNormalizationTaskId,
      },
      data: {
        sourceTaskId: "domain/normalized-row",
        disposition: "converged",
      },
    });
  });

  test("leaves executable loop child wakes to the shared runtime", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "aks-loop-parent-wake-"));
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({ tasks: {} }),
    );
    await writeFile(
      join(appDir, ".state", "tasks", "state.json"),
      JSON.stringify({
        receipts: {
          "spec/verify-example": { parentId: specLoopTaskId },
          "ops/recover-example": { parentId: "spec/verify-example" },
        },
      }),
    );

    for (const taskId of ["spec/verify-example", "ops/recover-example"]) {
      expect(
        loopRefillWakeForTaskEvent(appDir, {
          type: "project.task.reconciled",
          target: { project: "aks-rp-e2e", taskId },
          data: {
            disposition: "converged",
            input: { loopId: specLoopTaskId },
          },
        }),
      ).toBeNull();
    }
  });

  test("refills the owning loop after a nested task descendant completes", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "aks-loop-nested-wake-"));
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({ tasks: {} }),
    );
    await writeFile(
      join(appDir, ".state", "tasks", "state.json"),
      JSON.stringify({
        resources: {
          "compact/feature-a": {
            spec: { parentId: "group/feature-compact" },
          },
        },
        receipts: {
          "ops/recover-feature-a-artifacts": {
            parentId: "compact/feature-a",
          },
        },
      }),
    );

    expect(
      loopRefillWakeForTaskEvent(appDir, {
        type: "project.task.reconciled",
        target: {
          project: "aks-rp-e2e",
          taskId: "ops/recover-feature-a-artifacts",
        },
        data: { disposition: "converged", input: {} },
      }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "feature-compact-loop",
      target: {
        project: "aks-rp-e2e",
        taskId: featureCompactLoopTaskId,
      },
      data: {
        sourceTaskId: "ops/recover-feature-a-artifacts",
        disposition: "converged",
      },
    });
  });

  test("does not wake a controller for itself or unrelated work", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "aks-loop-no-wake-"));
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({ tasks: { unrelated: { input: {} } } }),
    );

    expect(
      loopRefillWakeForTaskEvent(appDir, {
        type: "project.task.reconciled",
        target: { project: "aks-rp-e2e", taskId: specLoopTaskId },
      }),
    ).toBeNull();
    expect(
      loopRefillWakeForTaskEvent(appDir, {
        type: "project.task.reconciled",
        target: { project: "aks-rp-e2e", taskId: "unrelated" },
      }),
    ).toBeNull();
  });
});

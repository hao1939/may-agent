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
    expect(acceptance).toContain("prefer one or two real clusters");
    expect(acceptance).toContain("not really compacted");
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

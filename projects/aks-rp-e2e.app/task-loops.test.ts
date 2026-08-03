import { describe, expect, test } from "bun:test";
import {
  featureCompactLoopTaskId,
  legacyBranchReconciliationTaskId,
  learnedCompactVerificationAcceptance,
  learnedScenarioNormalizationAcceptance,
  learnedSpecVerificationAcceptance,
  loopFrontierAccounting,
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
      qualityInventoryRequired: true,
      qualityInventoryFocus: [
        "official-learn-api-grounding",
        "standalone-direct-carrier-contract",
        "canonical-target-mutation-fixture-cleanup",
        "current-source-staging-live-proof",
      ],
      requiredRepositoryCheckCommand: "bun run check",
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
    const normalizationAcceptance = standingLoopIntent(
      scenarioNormalizationTaskId,
    ).acceptance.join("\n");
    expect(normalizationAcceptance).toContain(
      "source-layout normalization separate from product-contract adjudication",
    );
    expect(normalizationAcceptance).toContain(
      "execute the scenario in-process on the Vitest surface",
    );
    expect(normalizationAcceptance).toContain(
      "official Learn, Azure REST API specs, and checked-in design docs",
    );
    expect(normalizationAcceptance).toContain(
      "private/local filesystem paths cannot be required carrier inputs",
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
});

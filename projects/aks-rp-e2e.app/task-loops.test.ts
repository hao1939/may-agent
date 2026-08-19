import { describe, expect, test } from "bun:test";
import {
  featureCompactLoopTaskId,
  legacyBranchReconciliationTaskId,
  learnedCompactVerificationAcceptance,
  learnedScenarioNormalizationAcceptance,
  learnedSpecVerificationAcceptance,
  loopFrontierAccounting,
  masterValidationCompactTaskId,
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
      refillEnabled: false,
    });
    expect(standingLoopIntent(masterValidationCompactTaskId).input).toEqual({
      frontierLimit: 3,
      selectorPath: "ci/feature-sets/master-validation.txt",
      target: "staging",
      selectorCount: 82,
      orderedSelectorSha256:
        "fead61bfcfe026556a0cbba74a7480a02f977be73bfe1dbededa19fa0c66c649",
      sourceCommit: "e4ff9bf37076baf8f3fd01810a04d02f05717c60",
      generationSourceCommit: "54621f8dec0034373a79aba534876a356aef2c78",
      integratedSourceCommit: "e4ff9bf37076baf8f3fd01810a04d02f05717c60",
      planPath:
        "evidence/pipelines/master-validation-current-origin-54621f8d-feature-journey-plan-20260818.json",
      planSha256:
        "c925ca85bf17e985489d3793f3f69a765241dd5256c6d12586a173866a931cec",
      proofMatrixPath:
        "evidence/pipelines/master-validation-current-origin-54621f8d-feature-journey-proof-matrix-20260818.md",
      proofMatrixSha256:
        "1775b8744ed3cba06f22c98895edbbb1ee36fca83e976180054ecca26f9c55ce",
      physicalBaselineClusterBirths: 93,
      physicalClusterBirthsNeeded: 50,
      physicalClusterBirthsSaved: 43,
      physicalClusterBirthSavingsRate: 0.46236559139784944,
      safeguardGetCount: 45,
      runnableSpecCount: 72,
      terminalRouteCount: 10,
      physicalBoundaryCount: 49,
      materialization: "ready",
      projectedMinutes: 59.9427,
      semanticLowerBoundBirths: 22,
      semanticEdgeCount: 1247,
      historicalDisprovedAspiration: {
        maximumPhysicalClusterBirths: 16,
        minimumPhysicalClusterBirthsSaved: 64,
        minimumSavingsRate: 0.8,
      },
      maximumLiveCompactRuns: 3,
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

  test("defines selector-first master-validation compaction as the active compact goal", () => {
    const definition = standingLoopIntent(masterValidationCompactTaskId);
    const acceptance = definition.acceptance.join("\n");

    expect(definition).toMatchObject({
      id: masterValidationCompactTaskId,
      parentId: "group/feature-compact",
      mode: "maintain",
      owner: "aks-explorer",
      priority: "P0",
    });
    expect(definition.workflow).toBeUndefined();
    expect(definition.outcome).toContain("82-selector");
    expect(definition.outcome).toContain("93 baseline physical cluster births");
    expect(definition.outcome).toContain("50 planned births");
    expect(definition.outcome).toContain("saving 43 (46.236559139784944%)");
    expect(acceptance).toContain("one natural cross-feature journey");
    expect(acceptance).toContain("immutable-property conflict");
    expect(acceptance).toContain(
      "origin/dev@54621f8dec0034373a79aba534876a356aef2c78",
    );
    expect(acceptance).toContain(
      "origin/dev@e4ff9bf37076baf8f3fd01810a04d02f05717c60",
    );
    expect(acceptance).toContain("exactly 59.9427 projected minutes");
    expect(acceptance).toContain("45 safeguard GETs");
    expect(acceptance).toContain("72 runnable specs");
    expect(acceptance).toContain("ten terminal routes");
    expect(acceptance).toContain("49 physical boundaries");
    expect(acceptance).toContain("historically disproved aspiration");
    expect(acceptance).toContain("1,247 unique semantic edges");
    expect(acceptance).toContain("weighted semantic floor is 22 births");
    expect(acceptance).toContain("integrated 50-birth safe-Pareto fallback");
    expect(acceptance).toContain("authority-artifact drift");
    expect(acceptance).toContain("integrated-source drift");
    expect(acceptance).toContain("Never remove, relabel, ignore, or weaken");
    expect(acceptance).toContain("immutable-property split");
    expect(acceptance).toContain("at most three actionable direct children");
    expect(acceptance).toContain("at most three compact Azure DevOps runs");
    expect(acceptance).toContain("do not queue Azure for declaration adoption");
    expect(acceptance).toContain(
      "exact-source staging per-spec and cleanup proof",
    );
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

import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptedLiveProofSourceInstruction,
  askAgent,
  agentConditionProblem,
  authoritativeRunReference,
  inheritedAuthoritativeRunReference,
  artifactObservedClaimIds,
  artifactProvesCleanup,
  artifactProvesDeclaredClaims,
  artifactProvesSpecPass,
  artifactProvesTarget,
  artifactVitestTestCount,
  boundedWorkflowEvidence,
  checkLiveDispatchAdmission,
  compactPlanPipelineParameters,
  collectTerminalRunEvidence,
  completedPullRequestIntegration,
  currentAdoSurfaceInstruction,
  decisionCorrectionPrompt,
  directVitestCompatibilityInstruction,
  exactPassNeedsOwnerProblem,
  directIntegrationAction,
  exactStrictInventoryInstruction,
  exactLiveTargetInstruction,
  frozenCandidateContentEquivalent,
  semanticInvalidationSourceState,
  discoverTaskRuns,
  proofProtectedScenarioPaths,
  targetAdvanceProofDecisionProblem,
  relevantKnowledgeModelUnchanged,
  shouldReplayScenarioBeforeRunReview,
  shouldReplayReviewedTerminalWriteback,
  taskWorktreeRecoveryDecisionProblem,
  terminalLineageReplayDecisionProblem,
  existingRecoveryProblem,
  integrationMode,
  isNonFastForwardPushFailure,
  liveDispatchTargetRefreshRequired,
  matchingTaskGenerationRuns,
  matchingTaskRuns,
  mergeAcceptedTargetAdvanceProof,
  parseTaskPayload,
  pipelineWaitCondition,
  pipelineRunState,
  preparationDecisionProblem,
  preparationHeadProblem,
  priorIntegratedProof,
  replayScenarioNormalizationOntoTarget,
  reconcileRemoteTaskBranchHistory,
  remoteLeaseCommit,
  replayScenarioCandidateForDispatch,
  scenarioReplayForceWithLeaseArg,
  pullRequestSourceUpdateCondition,
  pullRequestWaitCondition,
  resolveIntegrationTarget,
  resolveLiveExecutionTarget,
  runMatchesPriorVerification,
  scenarioNormalizationReplayBase,
  scenarioIntegrationReplayBase,
  scenarioQualityInvariantProblem,
  novelScenarioReplayCommits,
  scenarioNormalizationReplayRequired,
  semanticClaimEvidenceInstruction,
  transientRetryDiagnosisInstruction,
  scenarioQualityRepairInstruction,
  shouldFastForwardIntegratedSource,
  shouldReviewBeforeInitialLiveDispatch,
  scenarioNormalizationWaitProblem,
  sourceChangeMayAffectSpec,
  supersededQueuedTaskRuns,
  taskContextDir,
  taskScopedAgentCondition,
  terminalDispositionDecisionProblem,
  terminalDispositionSourceRepairInstruction,
  terminalRunDecisionProblem,
  terminalRunContextDir,
  verify,
  verifySpecLiveProofFacts,
} from "./spec-live-reconciliation.js";
import {
  isRunnableScenarioNormalization,
  scenarioNormalizationSpecIds,
  specTerminalDispositionCheck,
  specTerminalTargetCheck,
} from "./lib/scenario-normalization-invariant.js";
import {
  evaluateScenarioQualityInvariant,
  type InventoryRowRecord,
} from "./lib/scenario-quality-invariant.js";

describe("spec-live-reconciliation workflow", () => {
  test("keeps cited quality issues ahead of ADO dispatch and integration", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-quality-invariant-"));
    const scenarioTestPath =
      "features/ccp-agent/tests/ccp-daily-master.test.ts";
    const specFile = "features/ccp-agent/specs/ccp-daily-master.json";
    const specId = "spec.ccp-autoupgrader.pipeline-daily-master";
    const row: InventoryRowRecord = {
      specId,
      specFile,
      featureId: "ccp-agent",
      scenarioTestPath,
      directVitestImplementation: true,
      scenarioSignals: {
        hasCheckModeGuard: true,
        hasExecuteFlag: true,
        hasMutationGateEnv: true,
        hasCleanupSignal: true,
        hasHardCodedSubscriptionDefault: false,
      },
    };
    const input = {
      normalizationScope: "quality",
      scenarioTestPath,
      specIds: [specId],
      qualityIssueCodes: [
        "migration-only-scaffolding",
        "missing-learn-api-grounding",
        "current-source-staging-live-proof",
      ],
    };
    const evaluate = () =>
      evaluateScenarioQualityInvariant(root, input, {
        report: { rows: [row] },
      });

    try {
      mkdirSync(join(root, "features/ccp-agent/specs"), { recursive: true });
      mkdirSync(join(root, "features/ccp-agent/tests"), { recursive: true });
      writeFileSync(
        join(root, specFile),
        JSON.stringify({ id: specId, cleanup: ["delete fixture"] }),
      );
      writeFileSync(
        join(root, scenarioTestPath),
        'execFile("bun", ["features/ccp-agent/tests/ccp-daily-master.ts", "--execute"]);\n',
      );

      const unresolved = evaluate();
      expect(unresolved.accepted).toBe(false);
      expect(unresolved.remainingIssueCodes).toEqual([
        "migration-only-scaffolding",
        "missing-learn-api-grounding",
      ]);

      writeFileSync(
        join(root, specFile),
        JSON.stringify({
          id: specId,
          cleanup: ["delete fixture"],
          sourceRefs: [
            "https://learn.microsoft.com/en-us/azure/aks/upgrade-cluster",
          ],
        }),
      );
      const partial = evaluate();
      expect(partial.accepted).toBe(false);
      expect(partial.remainingIssueCodes).toEqual([
        "migration-only-scaffolding",
      ]);

      writeFileSync(
        join(root, scenarioTestPath),
        'import { test } from "vitest";\ntest("direct", () => {});\n',
      );
      const repaired = evaluate();
      expect(repaired.accepted).toBe(true);
      expect(repaired.remainingIssueCodes).toEqual([]);
      expect(repaired.citedIssueCodes).not.toContain(
        "current-source-staging-live-proof",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects quality regressions introduced while clearing cited issues", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-quality-regression-"));
    const scenarioTestPath = "features/example/tests/example.test.ts";
    const specFile = "features/example/specs/example.json";
    try {
      mkdirSync(join(root, "features/example/specs"), { recursive: true });
      mkdirSync(join(root, "features/example/tests"), { recursive: true });
      writeFileSync(
        join(root, specFile),
        JSON.stringify({
          id: "spec.example",
          cleanup: ["delete fixture"],
          sourceRefs: ["https://learn.microsoft.com/en-us/azure/aks/"],
        }),
      );
      writeFileSync(join(root, scenarioTestPath), "direct carrier\n");
      const result = evaluateScenarioQualityInvariant(
        root,
        {
          normalizationScope: "quality",
          scenarioTestPath,
          specIds: ["spec.example"],
          qualityIssueCodes: ["missing-learn-api-grounding"],
        },
        {
          report: {
            rows: [
              {
                specId: "spec.example",
                specFile,
                scenarioTestPath,
                directVitestImplementation: true,
                scenarioSignals: {
                  hasCheckModeGuard: true,
                  hasExecuteFlag: false,
                  hasMutationGateEnv: true,
                  hasCleanupSignal: true,
                },
              },
            ],
          },
        },
      );
      expect(result.accepted).toBe(false);
      expect(result.remainingIssueCodes).toEqual(["missing-execute-flag"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("bounds workflow evidence while retaining terminal identifiers", () => {
    const evidence = Array.from({ length: 40 }, (_, index) =>
      index === 39 ? "pipeline-run:174841985" : `finding:${index}`,
    );
    const bounded = boundedWorkflowEvidence(evidence);
    expect(bounded).toHaveLength(32);
    expect(bounded).toContain("finding:0");
    expect(bounded).toContain("pipeline-run:174841985");
    expect(bounded).toContain("evidence-entry-count:40");
  });

  test("states that green ADO execution cannot waive cited quality defects", () => {
    expect(scenarioQualityRepairInstruction).toContain(
      "resolve every cited structural quality issue before requesting ADO",
    );
    expect(scenarioQualityRepairInstruction).toContain(
      "A green ADO run proves execution only",
    );
    expect(
      scenarioQualityInvariantProblem("/missing", {
        normalizationScope: "layout",
      }),
    ).toBeNull();
  });

  test("queues an optional validated compact plan with the exact spec filter", () => {
    expect(
      compactPlanPipelineParameters(
        "features/serverless/compact/staging.plan.json",
      ),
    ).toEqual(["plan_path=features/serverless/compact/staging.plan.json"]);
    expect(compactPlanPipelineParameters("")).toEqual([]);
    expect(() =>
      compactPlanPipelineParameters("runs/plans/untrusted.json"),
    ).toThrow("Invalid compact live plan path");
  });

  test("requires direct carriers to validate on the ADO Vitest surface", () => {
    expect(directVitestCompatibilityInstruction).toContain("through Vitest");
    expect(directVitestCompatibilityInstruction).toContain(
      "not only with `bun test`",
    );
    expect(directVitestCompatibilityInstruction).toContain("never `bun:test`");
    expect(directVitestCompatibilityInstruction).toContain(
      "without guaranteeing the Bun runtime global",
    );
    expect(directVitestCompatibilityInstruction).toContain("`Bun.spawn`");
    expect(directVitestCompatibilityInstruction).toContain(
      "portable Node APIs",
    );
    expect(directVitestCompatibilityInstruction).toContain(
      "`bun run spec <spec-id> --check`",
    );
    expect(directVitestCompatibilityInstruction).toContain(
      "Never fabricate subscription, region, API version, Kubernetes version, or VM-size placeholders",
    );
  });

  test("requires evidence before an unchanged transient retry", () => {
    expect(transientRetryDiagnosisInstruction).toContain(
      "timeout, generic ARM failure",
    );
    expect(transientRetryDiagnosisInstruction).toContain(
      "deterministic ordering, identity, authorization, configuration",
    );
    expect(transientRetryDiagnosisInstruction).toContain(
      "do not guess transient",
    );
  });

  test("judges normalization against the exact strict-inventory row", () => {
    expect(exactStrictInventoryInstruction).toContain(
      "expected to exit nonzero",
    );
    expect(exactStrictInventoryInstruction).toContain(
      "guard.remainingSpecReferencedPlainScenarioUnits",
    );
    expect(exactStrictInventoryInstruction).toContain(
      "guard.remainingRepoPlainScenarioFiles",
    );
  });

  test("uses the current ADO run to resolve execution-surface uncertainty", () => {
    expect(currentAdoSurfaceInstruction).toContain("not treat uncertainty");
    expect(currentAdoSurfaceInstruction).toContain(
      "older backend, different source commit, or different target",
    );
    expect(currentAdoSurfaceInstruction).toContain("set liveReady=true");
    expect(currentAdoSurfaceInstruction).toContain("exact current evidence");
  });

  test("keeps a newer passing run from recursively changing its tested source", () => {
    expect(acceptedLiveProofSourceInstruction).toContain(
      "return accepted-pass without editing or committing tracked source",
    );
    expect(acceptedLiveProofSourceInstruction).toContain(
      "the app projects the newly accepted proof after the task receipt is persisted",
    );
    expect(acceptedLiveProofSourceInstruction).toContain(
      "actual behavior or contract defect",
    );
    expect(acceptedLiveProofSourceInstruction).toContain(
      "changing only diagnostics, messages, metadata, or static checks is not a runnable repair",
    );
    expect(acceptedLiveProofSourceInstruction).toContain(
      "implement the missing live behavior before setting liveReady=true",
    );
  });

  test("requires semantic observations behind structurally passing claims", () => {
    expect(semanticClaimEvidenceInstruction).toContain(
      "not against its ok flag",
    );
    expect(semanticClaimEvidenceInstruction).toContain(
      "Configuration or enablement proves only configuration or enablement",
    );
    expect(semanticClaimEvidenceInstruction).toContain(
      "required observation was unavailable",
    );
    expect(semanticClaimEvidenceInstruction).toContain(
      "accepted-pass is forbidden",
    );
    expect(semanticClaimEvidenceInstruction).toContain(
      "Do not convert this judgment into a code-side prose heuristic",
    );
  });

  test("keeps the resolved live target outside agent repair judgment", () => {
    expect(exactLiveTargetInstruction("staging", "")).toContain(
      "never guess or fall back",
    );
    expect(exactLiveTargetInstruction("staging", "172955338")).toContain(
      "standalone_build_id=172955338",
    );
  });

  test("keeps terminal product-gap source repair inside the domain workflow", () => {
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "update its structured status, specState, statusReason",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "return decision=terminal-disposition",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "omit liveReady and condition entirely",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "blocked/environment-blocked",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "Do not return committed with liveReady=false",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "not that the feature is abandoned forever",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "Do not return needs-owner merely because",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "real external authority must decide it",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "Compact package status, compact-plan eligibility",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "arbitrary origin/dev advance is context, not an external prerequisite",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "actual unavailable capability or authority",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "source-layout normalization separate from product-contract adjudication",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "keep the approval or escalation as independent follow-up",
    );
    expect(terminalDispositionSourceRepairInstruction).toContain(
      "not merely how observed product behavior is judged",
    );
  });

  test("requires exact ADO, staging artifact, cleanup, and integration proof", () => {
    const root = mkdtempSync(join(tmpdir(), "spec-live-verifier-"));
    try {
      const aggregatePath = join(root, "result.json");
      const specPath = join(root, "spec.json");
      const topLevelSpecPath = join(root, "spec-top-level.json");
      const nestedRawSpecPath = join(root, "spec-nested-raw.json");
      const vitestPath = join(root, "vitest.json");
      writeFileSync(
        aggregatePath,
        JSON.stringify({
          target: {
            name: "staging",
            environment: "staging",
            subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
            location: "westus2",
          },
          specResults: [{ specId: "spec.sample.live", status: "pass" }],
        }),
      );
      writeFileSync(
        specPath,
        JSON.stringify({
          specId: "spec.sample.live",
          status: "pass",
          raw: {
            assertions: [
              {
                name: "assert.sample.behavior",
                verdictImpact: "claim",
                ok: true,
              },
              {
                name: "cleanup.resource-group-delete-requested",
                verdictImpact: "cleanup",
                ok: true,
              },
            ],
          },
        }),
      );
      writeFileSync(
        topLevelSpecPath,
        JSON.stringify({
          specId: "spec.sample.live",
          status: "pass",
          raw: {
            probeEvidence: { mode: "live" },
          },
          assertions: [
            {
              name: "cleanup.resource-group-deleted",
              verdictImpact: "cleanup",
              ok: true,
            },
          ],
        }),
      );
      writeFileSync(
        nestedRawSpecPath,
        JSON.stringify({
          specId: "spec.sample.live",
          status: "pass",
          raw: {
            raw: {
              cleanup: {
                attempted: true,
                status: "pass",
              },
            },
          },
        }),
      );
      writeFileSync(vitestPath, JSON.stringify({ numTotalTests: 1 }));
      expect(artifactVitestTestCount(vitestPath)).toBe(1);
      expect(artifactProvesSpecPass(aggregatePath, "spec.sample.live")).toBe(
        true,
      );
      expect(artifactProvesTarget(aggregatePath, "staging")).toBe(true);
      expect(
        artifactProvesDeclaredClaims(specPath, "spec.sample.live", [
          "assert.sample.behavior",
        ]),
      ).toBe(true);
      expect(
        artifactProvesDeclaredClaims(specPath, "spec.sample.live", [
          "assert.sample.behavior",
          "assert.sample.missing",
        ]),
      ).toBe(false);
      expect(artifactObservedClaimIds(specPath, "spec.sample.live")).toEqual([
        "assert.sample.behavior",
      ]);
      expect(artifactProvesCleanup(specPath, "spec.sample.live")).toBe(true);
      expect(artifactProvesCleanup(topLevelSpecPath, "spec.sample.live")).toBe(
        true,
      );
      expect(artifactProvesCleanup(nestedRawSpecPath, "spec.sample.live")).toBe(
        true,
      );

      const proof = {
        version: 1 as const,
        taskId: "domain/sample",
        generation: 2,
        specId: "spec.sample.live",
        target: "staging",
        sourceBranch: "task/domain-sample",
        sourceCommit: "abc123",
        runId: "173800001",
        runResult: "succeeded",
        verdict: "pass" as const,
        summary: "exact live pass",
        evidence: ["artifact proof"],
        reviewedAt: "2026-07-26T00:00:00Z",
        targetRef: "origin/dev",
        mergedCommit: "def456",
      };
      const run = {
        id: "173800001",
        status: "completed",
        result: "succeeded",
        sourceBranch: "refs/heads/task/domain-sample",
        sourceVersion: "abc123",
        definition: { id: 467665 },
        templateParameters: {
          specs: "spec.sample.live",
          target: "staging",
          standalone_build_id: "",
          metadata: JSON.stringify({
            taskId: "domain/sample",
            generation: 2,
            specId: "spec.sample.live",
            sourceBranch: "task/domain-sample",
            sourceCommit: "abc123",
            target: "staging",
          }),
        },
      };
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 2,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof,
          run,
          artifactPaths: [aggregatePath, specPath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.sample.behavior"],
          },
          sourceReachable: true,
          integratedCommitReachable: true,
          normalizationInvariantSatisfied: true,
          expectedVitestTestCount: 1,
        }),
      ).toMatchObject({
        accepted: false,
        summary: expect.stringContaining(
          "Vitest total test count does not match: expected=1; observed=none",
        ),
      });
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 2,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof,
          run,
          artifactPaths: [aggregatePath, specPath, vitestPath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.sample.behavior"],
          },
          sourceReachable: true,
          integratedCommitReachable: true,
          normalizationInvariantSatisfied: true,
          expectedVitestTestCount: 1,
        }),
      ).toMatchObject({ accepted: true });
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 3,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof: {
            ...proof,
            generation: 3,
            providerGeneration: 2,
          },
          run,
          artifactPaths: [aggregatePath, specPath, vitestPath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.sample.behavior"],
          },
          sourceReachable: true,
          integratedCommitReachable: true,
          normalizationInvariantSatisfied: true,
          expectedVitestTestCount: 1,
        }),
      ).toMatchObject({ accepted: true });
      writeFileSync(vitestPath, JSON.stringify({ numTotalTests: 6 }));
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 2,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof,
          run,
          artifactPaths: [aggregatePath, specPath, vitestPath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.sample.behavior"],
          },
          sourceReachable: true,
          integratedCommitReachable: true,
          normalizationInvariantSatisfied: true,
          expectedVitestTestCount: 1,
        }),
      ).toMatchObject({
        accepted: false,
        summary: expect.stringContaining(
          "Vitest total test count does not match: expected=1; observed=6",
        ),
      });
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 2,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof: {
            ...proof,
            targetRef: undefined,
            mergedCommit: undefined,
          },
          run,
          artifactPaths: [aggregatePath, specPath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.1"],
          },
          sourceReachable: false,
          integratedCommitReachable: false,
          normalizationInvariantSatisfied: true,
          requireIntegration: false,
        }),
      ).toMatchObject({
        accepted: false,
        summary: expect.stringContaining(
          "expected=assert.1; observed=assert.sample.behavior",
        ),
      });
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 2,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof: {
            ...proof,
            targetRef: undefined,
            mergedCommit: undefined,
          },
          run,
          artifactPaths: [aggregatePath, specPath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.sample.behavior"],
          },
          sourceReachable: false,
          integratedCommitReachable: false,
          normalizationInvariantSatisfied: true,
          requireIntegration: false,
        }),
      ).toMatchObject({ accepted: true });
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 2,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof: {
            ...proof,
            targetRef: undefined,
            mergedCommit: undefined,
          },
          run,
          artifactPaths: [aggregatePath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.sample.behavior"],
          },
          sourceReachable: false,
          integratedCommitReachable: false,
          normalizationInvariantSatisfied: true,
          requireIntegration: false,
        }),
      ).toMatchObject({ accepted: false });
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 3,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof,
          run,
          artifactPaths: [aggregatePath, specPath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.sample.behavior"],
          },
          sourceReachable: false,
          integratedCommitReachable: true,
          normalizationInvariantSatisfied: true,
        }),
      ).toMatchObject({ accepted: false });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("accepts an authoritative parent-lineage run when the proof contract matches", () => {
    const root = mkdtempSync(join(tmpdir(), "spec-live-authoritative-"));
    try {
      const aggregatePath = join(root, "result.json");
      const specPath = join(root, "spec.json");
      writeFileSync(
        aggregatePath,
        JSON.stringify({
          target: {
            name: "staging",
            environment: "staging",
            subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
            location: "westus2",
          },
          specResults: [
            {
              specId: "spec.image-integrity.master-validation",
              status: "pass",
            },
          ],
        }),
      );
      writeFileSync(
        specPath,
        JSON.stringify({
          specId: "spec.image-integrity.master-validation",
          status: "pass",
          raw: {
            assertions: [
              {
                name: "assert.image-integrity.live-proof",
                verdictImpact: "claim",
                ok: true,
              },
              {
                name: "cleanup.resource-group-delete-requested",
                verdictImpact: "cleanup",
                ok: true,
              },
            ],
          },
        }),
      );

      expect(
        verifySpecLiveProofFacts({
          taskId:
            "spec/verify-spec-image-integrity-master-validation-cab25239d-20260801",
          generation: 2,
          specIds: ["spec.image-integrity.master-validation"],
          target: "staging",
          standaloneBuildId: "",
          proof: {
            version: 1,
            taskId:
              "spec/verify-spec-image-integrity-master-validation-cab25239d-20260801",
            generation: 2,
            providerGeneration: 1,
            specId: "spec.image-integrity.master-validation",
            target: "staging",
            sourceBranch:
              "task/domain-reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8-0bbf416f08",
            sourceCommit: "cab25239d9c5d1994bcc303cd831b69773d42e70",
            runId: "174756648",
            runResult: "succeeded",
            verdict: "pass",
            summary: "authoritative live pass",
            evidence: ["pipeline-run:174756648"],
            reviewedAt: "2026-08-01T03:00:00Z",
          },
          run: {
            id: "174756648",
            status: "completed",
            result: "succeeded",
            sourceBranch:
              "refs/heads/task/domain-reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8-0bbf416f08",
            sourceVersion: "cab25239d9c5d1994bcc303cd831b69773d42e70",
            definition: { id: 467665 },
            templateParameters: {
              specs: "spec.image-integrity.master-validation",
              target: "staging",
              standalone_build_id: "",
              metadata: JSON.stringify({
                taskId:
                  "domain/reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8ce69cb-20260801",
                generation: 1,
                specId: "spec.image-integrity.master-validation",
                sourceBranch:
                  "task/domain-reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8-0bbf416f08",
                sourceCommit: "cab25239d9c5d1994bcc303cd831b69773d42e70",
                target: "staging",
              }),
            },
          },
          artifactPaths: [aggregatePath, specPath],
          expectedClaimIdsBySpec: {
            "spec.image-integrity.master-validation": [
              "assert.image-integrity.live-proof",
            ],
          },
          sourceReachable: false,
          integratedCommitReachable: false,
          normalizationInvariantSatisfied: true,
          requireIntegration: false,
          providerTaskIds: [
            "domain/reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8ce69cb-20260801",
          ],
        }).accepted,
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("recognizes non-fast-forward task branch push failures", () => {
    expect(
      isNonFastForwardPushFailure({
        stdout: "",
        stderr: "! [rejected] task/example -> task/example (non-fast-forward)",
      }),
    ).toBe(true);
    expect(
      isNonFastForwardPushFailure({
        stdout: "",
        stderr: "fatal: Authentication failed",
      }),
    ).toBe(false);
  });

  test("preserves divergent remote task branch history before republishing", () => {
    const root = mkdtempSync(join(tmpdir(), "task-branch-history-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const workspace = join(root, "workspace");
    const run = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

    try {
      mkdirSync(seed);
      run(root, ["init", "--bare", remote]);
      run(seed, ["init"]);
      run(seed, ["config", "user.email", "test@example.com"]);
      run(seed, ["config", "user.name", "Test"]);
      writeFileSync(join(seed, "base.txt"), "base\n");
      run(seed, ["add", "base.txt"]);
      run(seed, ["commit", "-m", "base"]);
      run(seed, ["branch", "-M", "dev"]);
      run(seed, ["remote", "add", "origin", remote]);
      run(seed, ["push", "origin", "dev"]);
      run(seed, ["checkout", "-b", "task/example"]);
      run(seed, ["push", "origin", "task/example"]);

      run(root, ["clone", remote, workspace]);
      run(workspace, ["checkout", "task/example"]);
      run(workspace, ["config", "user.email", "test@example.com"]);
      run(workspace, ["config", "user.name", "Test"]);

      writeFileSync(join(seed, "remote.txt"), "remote\n");
      run(seed, ["add", "remote.txt"]);
      run(seed, ["commit", "-m", "remote task update"]);
      run(seed, ["push", "origin", "task/example"]);

      writeFileSync(join(workspace, "local.txt"), "local\n");
      run(workspace, ["add", "local.txt"]);
      run(workspace, ["commit", "-m", "local task update"]);

      const result = reconcileRemoteTaskBranchHistory(
        workspace,
        "task/example",
      );
      expect(result.state).toBe("merged");
      expect(existsSync(join(workspace, "remote.txt"))).toBe(true);
      expect(existsSync(join(workspace, "local.txt"))).toBe(true);
      expect(
        spawnSync(
          "git",
          [
            "merge-base",
            "--is-ancestor",
            "refs/remotes/origin/task/example",
            "HEAD",
          ],
          { cwd: workspace },
        ).status,
      ).toBe(0);
      run(workspace, ["push", "origin", "HEAD:refs/heads/task/example"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reads the exact saved run receipt without listing branch history", async () => {
    const contextDir = mkdtempSync(join(tmpdir(), "run-receipt-"));
    try {
      writeFileSync(
        join(contextDir, "current-run.json"),
        JSON.stringify({ runId: "42", sourceCommit: "abc", queuedAt: "now" }),
      );
      const calls: string[] = [];

      const runs = await discoverTaskRuns(contextDir, "task/example", {
        getExactRun: async (runId) => {
          calls.push(`exact:${runId}`);
          return { id: runId, status: "inProgress" };
        },
        listBranchRuns: async (branch) => {
          calls.push(`list:${branch}`);
          return [];
        },
      });

      expect(runs).toEqual([{ id: "42", status: "inProgress" }]);
      expect(calls).toEqual(["exact:42"]);
    } finally {
      rmSync(contextDir, { recursive: true, force: true });
    }
  });

  test("lists only the task branch when no run receipt exists", async () => {
    const contextDir = mkdtempSync(join(tmpdir(), "run-history-"));
    try {
      const calls: string[] = [];
      const runs = await discoverTaskRuns(contextDir, "task/example", {
        getExactRun: async (runId) => {
          calls.push(`exact:${runId}`);
          return null;
        },
        listBranchRuns: async (branch) => {
          calls.push(`list:${branch}`);
          return [{ id: "43", sourceBranch: `refs/heads/${branch}` }];
        },
      });

      expect(runs).toEqual([
        { id: "43", sourceBranch: "refs/heads/task/example" },
      ]);
      expect(calls).toEqual(["list:task/example"]);
    } finally {
      rmSync(contextDir, { recursive: true, force: true });
    }
  });

  test("accepts a squash merge by tracking the merged target revision", () => {
    expect(
      completedPullRequestIntegration({
        mergeStatus: "succeeded",
        testedSourceCommit: "tested-pr-head",
        mergedSourceCommit: "tested-pr-head",
        mergeCommit: "squash-merge-commit",
      }),
    ).toEqual({
      status: "integrated",
      targetCommit: "squash-merge-commit",
    });
  });

  test("requires the provider to identify the exact tested PR head", () => {
    expect(
      completedPullRequestIntegration({
        mergeStatus: "succeeded",
        testedSourceCommit: "tested-pr-head",
        mergedSourceCommit: "",
        mergeCommit: "squash-merge-commit",
      }),
    ).toEqual({ status: "unproven", reason: "source-mismatch" });
  });

  test("accepts only exact later current-main recovery proof", () => {
    const recovery = {
      pipelineRunId: "124",
      sourceBranch: "refs/heads/main",
      sourceCommit: "tested-main",
      artifactPath: "/watcher/124/result.json",
    };
    expect(
      existingRecoveryProblem({
        baselineRunId: "123",
        specId: "spec.example.lifecycle",
        currentMainCommit: "current-main",
        recovery,
        providerRun: {
          id: "124",
          status: "completed",
          result: "succeeded",
          sourceBranch: "refs/heads/main",
          sourceVersion: "tested-main",
        },
        sourceIsAncestor: true,
        changedFiles: ["owners.txt"],
        artifactInWatcherRoot: true,
        artifactProvesPass: true,
      }),
    ).toBeNull();
    expect(
      existingRecoveryProblem({
        baselineRunId: "123",
        specId: "spec.example.lifecycle",
        currentMainCommit: "current-main",
        recovery,
        providerRun: {
          id: "124",
          status: "completed",
          result: "succeeded",
          sourceBranch: "refs/heads/main",
          sourceVersion: "tested-main",
        },
        sourceIsAncestor: true,
        changedFiles: ["features/example/tests/lifecycle.test.ts"],
        artifactInWatcherRoot: true,
        artifactProvesPass: true,
      }),
    ).toBe("relevant main changes invalidate the recovery observation");
    expect(
      sourceChangeMayAffectSpec("spec.example.lifecycle", [
        "features/example/tests/lifecycle.test.ts",
      ]),
    ).toBe(true);
  });

  test("reuses durable integrated proof across a workflow-only task revision", () => {
    const repoDir = mkdtempSync(join(tmpdir(), "prior-integrated-proof-"));
    try {
      const taskId = "domain/master-validation-failure/spec.example/fp";
      const priorDir = taskContextDir(repoDir, taskId, 1);
      mkdirSync(priorDir, { recursive: true });
      writeFileSync(
        join(priorDir, "proof.json"),
        JSON.stringify({
          version: 1,
          taskId,
          generation: 1,
          specId: "spec.example",
          target: "staging",
          sourceBranch: "task/example",
          sourceCommit: "tested-source",
          runId: "123",
          runResult: "succeeded",
          verdict: "pass",
          summary: "passed",
          evidence: ["artifact:result.json"],
          reviewedAt: "2026-07-25T00:00:00Z",
          pullRequestId: "456",
          targetRef: "origin/main",
          mergedCommit: "merged-target",
        }),
      );
      expect(
        priorIntegratedProof({
          repoDir,
          taskId,
          generation: 2,
          specId: "spec.example",
          target: "staging",
          standaloneBuildId: "",
        }),
      ).toMatchObject({
        proof: {
          runId: "123",
          pullRequestId: "456",
          mergedCommit: "merged-target",
        },
        path: join(priorDir, "proof.json"),
      });
      expect(
        priorIntegratedProof({
          repoDir,
          taskId,
          generation: 2,
          specId: "spec.changed",
          target: "staging",
          standaloneBuildId: "",
        }),
      ).toBeNull();
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  test("runs the pipeline's hard admission checks before live dispatch", () => {
    const calls: string[] = [];
    const result = checkLiveDispatchAdmission(
      "/task/worktree",
      "spec.example.live",
      (executable, args, cwd) => {
        calls.push(`${cwd}:${executable} ${args.join(" ")}`);
        const failed = args[0] === "runner/check-live-admission.ts";
        return {
          status: failed ? 1 : 0,
          stdout: failed ? "" : "private-source policy passed",
          stderr: failed ? "source-check-only carrier" : "",
        };
      },
    );

    expect(result.accepted).toBe(false);
    expect(calls).toEqual([
      "/task/worktree:bun runner/check-private-source-policy.ts --specs spec.example.live",
      "/task/worktree:bun runner/check-live-admission.ts --specs spec.example.live",
    ]);
    expect(result.evidence.join("\n")).toContain(
      "dispatch-check:private-source-policy:pass",
    );
    expect(result.evidence.join("\n")).toContain(
      "dispatch-check:live-admission:fail",
    );
    expect(result.evidence.join("\n")).toContain("source-check-only carrier");
  });

  test("collects terminal evidence before asking the agent to judge it", async () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-evidence-"));
    try {
      const result = await collectTerminalRunEvidence(
        root,
        root,
        "42",
        {
          id: 42,
          status: "completed",
          result: "succeeded",
        },
        {
          listArtifacts: () => [
            { name: "plan-inputs" },
            { name: "test results" },
          ],
          downloadArtifact: (name, downloadDir) => {
            writeFileSync(join(downloadDir, `${name}.txt`), "collected\n");
            return { status: 0, stdout: "", stderr: "" };
          },
        },
      );

      expect(result.errors).toEqual([]);
      expect(result.artifactPaths).toHaveLength(2);
      expect(existsSync(join(root, "ado-run-show.json"))).toBe(true);
      expect(existsSync(join(root, "ado-artifacts.json"))).toBe(true);
      expect(
        JSON.parse(readFileSync(join(root, "collection.json"), "utf8")),
      ).toMatchObject({ runId: "42", errors: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("retries an agent runtime failure inside the same workflow", async () => {
    const prompts: string[] = [];
    const decisions = [
      { status: "error" },
      {
        status: "done",
        structuredResult: {
          decision: "accepted-pass",
          summary: "exact run passed",
          evidence: ["pipeline-run:42"],
        },
      },
    ];
    const ctx = {
      agent: "aks-explorer",
      runAgent: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return decisions.shift();
      },
    };

    const result = await askAgent(
      ctx as never,
      "Review terminal run 42 from the task worktree.",
      { retryDelayMs: 0 },
    );

    expect(result?.decision).toBe("accepted-pass");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain(
      "ended before producing a structured judgment",
    );
    expect(prompts[1]).toContain("same bounded task");
  });

  test("does not synthesize owner judgment when agent runtime retries fail", async () => {
    const ctx = {
      agent: "aks-explorer",
      runAgent: async () => ({ status: "error" }),
    };

    await expect(
      askAgent(ctx as never, "Review terminal run 42.", {
        retryDelayMs: 0,
      }),
    ).rejects.toThrow("failed before structured judgment after two attempts");
  });

  test("allows one additional bounded correction for fix-forward judgment", async () => {
    const prompts: string[] = [];
    const decisions = [
      {
        status: "done",
        structuredResult: {
          decision: "committed",
          summary: "source normalized but not ready",
          evidence: ["source-commit:abc"],
          liveReady: false,
        },
      },
      {
        status: "done",
        structuredResult: {
          decision: "committed",
          summary: "wait for publication",
          evidence: ["source-commit:abc"],
          liveReady: false,
          condition: {
            id: "published",
            type: "aks.repo-ref.observed",
            subject: "project:aks-rp-e2e",
            expected: { ref: "origin/dev" },
          },
        },
      },
      {
        status: "done",
        structuredResult: {
          decision: "needs-owner",
          summary: "review the non-runnable disposition",
          evidence: ["source-commit:abc"],
        },
      },
    ];
    const ctx = {
      agent: "aks-explorer",
      runAgent: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return decisions.shift();
      },
    };

    const result = await askAgent(ctx as never, "Normalize one scenario.", {
      scenarioNormalization: true,
      continueDomainWorkOnValidation: true,
      retryDelayMs: 0,
    });

    expect(result.decision).toBe("needs-owner");
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toContain("workflow owns task-branch publication");
  });

  test("keeps an Airlock-shaped exact-pass source gap inside workflow repair instead of needs-owner", async () => {
    const prompts: string[] = [];
    const decisions = [
      {
        status: "done",
        structuredResult: {
          decision: "needs-owner",
          summary:
            "execute mode still does not implement the declared compliance/status claims",
          evidence: [
            "execute-mode-remains-nonlive-reviewed-exception",
            "No Azure resource changes were attempted.",
          ],
        },
      },
      {
        status: "done",
        structuredResult: {
          decision: "committed",
          summary:
            "implemented the missing execute-mode compliance/status claims",
          evidence: ["source-commit:def"],
          liveReady: true,
        },
      },
    ];
    const ctx = {
      agent: "aks-explorer",
      runAgent: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return decisions.shift();
      },
    };

    const result = await askAgent(
      ctx as never,
      "Repair spec.airlock.compliance-check from the current task worktree.",
      {
        scenarioNormalization: true,
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
        validateDecision: (candidate) =>
          exactPassNeedsOwnerProblem(candidate, false),
      },
    );

    expect(result.decision).toBe("committed");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("requires exact passing live proof");
    expect(prompts[1]).toContain(
      "execute mode still does not implement the declared compliance/status claims",
    );
  });

  test("isolates terminal evidence by exact pipeline run", () => {
    const contextDir = "/tmp/task-generation";
    expect(terminalRunContextDir(contextDir, "173647479")).toBe(
      "/tmp/task-generation/runs/173647479",
    );
    const unusual = terminalRunContextDir(contextDir, "run/with spaces");
    expect(unusual).toStartWith("/tmp/task-generation/runs/run-with-spaces-");
    expect(unusual).not.toContain("/with spaces");
  });

  test("selects every active spec for one runnable normalization carrier", () => {
    const input = {
      loopId: "scenario-normalization",
      specId: "spec.b",
      specIds: ["spec.a", "spec.b"],
      scenarioTestPath: "features/example/tests/carrier.ts",
    };
    expect(scenarioNormalizationSpecIds(input)).toEqual(["spec.a", "spec.b"]);
    expect(isRunnableScenarioNormalization(input)).toBe(true);
    expect(
      isRunnableScenarioNormalization({
        loopId: "scenario-normalization",
        specIds: [],
      }),
    ).toBe(false);
  });

  test("keeps full terminal context when a domain judgment needs correction", () => {
    const prompt = decisionCorrectionPrompt({
      originalPrompt:
        "Review terminal run 42 and repair the carrier when needed.",
      decision: {
        decision: "retry-transient",
        summary: "retry it",
        evidence: ["run:42"],
      },
      problem: "unchanged retry is unavailable after repeated failures",
      continueDomainWork: true,
    });
    expect(prompt).toContain("Review terminal run 42");
    expect(prompt).toContain("perform any source diagnosis, repair");
    expect(prompt).toContain("workflow still owns dispatch");
  });

  test("keeps worktree recovery phase results separate from domain disposition", () => {
    expect(
      taskWorktreeRecoveryDecisionProblem({
        decision: "committed",
        summary: "recovered source",
        evidence: ["commit:abc"],
      }),
    ).toBeNull();
    expect(
      taskWorktreeRecoveryDecisionProblem({
        decision: "test-current",
        summary: "removed obsolete residue",
        evidence: ["workspace:clean"],
      }),
    ).toBeNull();
    expect(
      taskWorktreeRecoveryDecisionProblem({
        decision: "needs-owner",
        summary: "ownership is ambiguous",
        evidence: ["workspace:dirty"],
      }),
    ).toBeNull();
    expect(
      taskWorktreeRecoveryDecisionProblem({
        decision: "terminal-disposition",
        summary: "not a recovery result",
        evidence: ["spec:example"],
      }),
    ).toContain("domain disposition is evaluated after recovery");
    expect(
      taskWorktreeRecoveryDecisionProblem({
        decision: "accepted-pass",
        summary: "not a recovery result",
        evidence: ["run:42"],
      }),
    ).toContain("task worktree recovery must return");
    expect(
      taskWorktreeRecoveryDecisionProblem({
        decision: "committed",
        summary: "recovered source",
        evidence: ["commit:abc"],
        liveReady: false,
      }),
    ).toContain(
      "omit liveReady and condition because domain readiness and dispatch are evaluated after recovery",
    );
  });

  test("keeps test-current inside terminal fix-forward instead of handing it to the owner", () => {
    expect(
      terminalRunDecisionProblem({
        decision: "test-current",
        summary: "test the current source",
        evidence: ["pipeline-run:42"],
      }),
    ).toContain("already received a terminal live run");
    expect(
      terminalRunDecisionProblem({
        decision: "committed",
        summary: "repaired the failed assertion",
        evidence: ["source-commit:def"],
        liveReady: true,
      }),
    ).toBeNull();
  });

  test("requires a green provider run before accepting runnable normalization proof", () => {
    const acceptedPass = {
      decision: "accepted-pass" as const,
      summary: "the expected negative contract was observed",
      evidence: ["pipeline-run:42"],
    };

    expect(
      terminalRunDecisionProblem(acceptedPass, {
        requireSucceededProvider: true,
        providerResult: "failed",
      }),
    ).toContain("requires an exact succeeded ADO run");
    expect(
      terminalRunDecisionProblem(acceptedPass, {
        requireSucceededProvider: true,
        providerResult: "succeeded",
      }),
    ).toBeNull();
    expect(
      terminalRunDecisionProblem(acceptedPass, {
        requireSucceededProvider: false,
        providerResult: "failed",
      }),
    ).toBeNull();
  });

  test("rejects committed preparation when repository HEAD did not move", () => {
    expect(
      preparationHeadProblem({
        decision: {
          decision: "committed",
          summary: "the existing task commit is ready",
          evidence: ["source-commit:abc"],
        },
        before: "abc",
        after: "abc",
      }),
    ).toContain("task HEAD remained abc");
    expect(
      preparationHeadProblem({
        decision: {
          decision: "test-current",
          summary: "test the existing task commit",
          evidence: ["source-commit:abc"],
        },
        before: "abc",
        after: "abc",
      }),
    ).toBeNull();
    expect(
      preparationHeadProblem({
        decision: {
          decision: "committed",
          summary: "created a newer task commit",
          evidence: ["source-commit:def"],
        },
        before: "abc",
        after: "def",
      }),
    ).toBeNull();
  });

  test("validates agent waits without replacing agent judgment", () => {
    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for recovery",
        evidence: ["run:42"],
        condition: {
          id: "recovery",
          type: "pipeline.spec.observed",
          subject: "later proof for spec.example",
          expected: { status: "pass" },
        },
      }),
    ).toContain("must be typed");

    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for recovery",
        evidence: ["run:42"],
        condition: {
          id: "recovery",
          type: "pipeline.spec.observed",
          subject: "project:aks-rp-e2e",
          expected: { pipelineRunIdGreaterThan: "42" },
        },
      }),
    ).toContain("unsupported comparison fields");

    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for recovery",
        evidence: ["run:42"],
        condition: {
          id: "recovery",
          type: "pipeline.spec.observed",
          subject: "project:aks-rp-e2e",
          expected: {
            specId: "spec.example",
            status: "pass",
            sourceBranch: "refs/heads/main",
          },
        },
      }),
    ).toBeNull();

    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for child task state",
        evidence: ["task:child"],
        condition: {
          id: "child-phase",
          type: "task-phase",
          subject: "task:child",
          expected: { field: "phase", equals: "converged" },
        },
      }),
    ).toContain("has no producer");
  });

  test("requires an explicit live-readiness judgment before dispatch", () => {
    const committed = {
      decision: "committed" as const,
      summary: "source repaired",
      evidence: ["source-commit:def"],
    };
    expect(preparationDecisionProblem(committed, false)).toContain(
      "must explicitly set liveReady",
    );
    expect(terminalRunDecisionProblem(committed)).toContain(
      "does not authorize a replacement ADO run",
    );
    expect(
      preparationDecisionProblem({ ...committed, liveReady: true }, false),
    ).toBeNull();
    expect(agentConditionProblem({ ...committed, liveReady: false })).toContain(
      "requires one exact observable Condition",
    );
    expect(
      agentConditionProblem({
        ...committed,
        liveReady: false,
        condition: {
          id: "quota-approval",
          type: "project.approval.submitted",
          subject: "project:aks-rp-e2e",
          expected: { field: "approvalId", equals: "quota-approval" },
        },
      }),
    ).toBeNull();
  });

  test("keeps terminal spec disposition as an explicit agent judgment", () => {
    const decision = {
      decision: "terminal-disposition" as const,
      summary: "The provider aliases the legacy precondition.",
      evidence: ["source-fact:legacy-alias"],
      terminalDisposition: {
        specId: "spec.sample.terminal",
        status: "product_constraint",
        specState: "reviewed-exception",
      },
    };
    expect(preparationDecisionProblem(decision, false)).toBeNull();
    expect(terminalDispositionDecisionProblem(decision)).toBeNull();
    expect(terminalDispositionDecisionProblem(decision, false)).toContain(
      "requires exact passing live proof",
    );
    expect(
      terminalDispositionDecisionProblem({ ...decision, liveReady: false }),
    ).toContain("neither live readiness nor a wait");
  });

  test("rejects needs-owner for exact-pass work unless the agent returns an exact wait instead", () => {
    const decision = {
      decision: "needs-owner" as const,
      summary:
        "execute mode still does not implement the declared compliance/status claims",
      evidence: ["execute-mode-remains-nonlive-reviewed-exception"],
    };
    expect(exactPassNeedsOwnerProblem(decision, false)).toContain(
      "requires exact passing live proof",
    );
    expect(exactPassNeedsOwnerProblem(decision, true)).toBeNull();
  });

  test("keeps terminal lineage replay source-only", () => {
    const replay = {
      decision: "committed" as const,
      summary: "replayed the reviewed terminal source onto current dev",
      evidence: ["source-commit:def"],
    };
    expect(terminalLineageReplayDecisionProblem(replay)).toBeNull();
    expect(
      terminalLineageReplayDecisionProblem({ ...replay, liveReady: false }),
    ).toContain("omit liveReady and condition");
    expect(
      terminalLineageReplayDecisionProblem({
        decision: "waiting",
        summary: "wait for another source change",
        evidence: ["source-commit:def"],
      }),
    ).toContain("must be resolved inside this same domain workflow");
  });

  test("replays a reviewed terminal writeback into a new task generation", () => {
    expect(
      shouldReplayReviewedTerminalWriteback({
        sourceProblem:
          "terminal-disposition does not match structured source fields: expected status=environment, specState=reviewed-exception; source has status=ready, specState=ready",
        reviewedWritebackCommit: "dad693f523201ba2ef7c9da9a45a296fae35d02a",
        scenarioNormalization: false,
      }),
    ).toBe(true);
    expect(
      shouldReplayReviewedTerminalWriteback({
        sourceProblem:
          "terminal-disposition source still lists plain-carrier sample.ts",
        reviewedWritebackCommit: "dad693f523201ba2ef7c9da9a45a296fae35d02a",
        scenarioNormalization: true,
      }),
    ).toBe(false);
    expect(
      shouldReplayReviewedTerminalWriteback({
        sourceProblem:
          "staging terminal-disposition validation requires a location",
        reviewedWritebackCommit: "dad693f523201ba2ef7c9da9a45a296fae35d02a",
        scenarioNormalization: false,
      }),
    ).toBe(false);
  });

  test("validates terminal judgment against structured spec fields", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-terminal-source-"));
    try {
      const specsDir = join(root, "features", "sample", "specs");
      mkdirSync(specsDir, { recursive: true });
      writeFileSync(
        join(specsDir, "terminal.json"),
        JSON.stringify({
          id: "spec.sample.terminal",
          status: "product_constraint",
          specState: "reviewed-exception",
        }),
      );
      const input = { specId: "spec.sample.terminal" };
      const accepted = specTerminalDispositionCheck(root, input, {
        specId: "spec.sample.terminal",
        status: "product_constraint",
        specState: "reviewed-exception",
      });
      expect(accepted.accepted).toBe(true);
      expect(accepted.evidence).toContain(
        "terminal-disposition-status:product_constraint",
      );
      expect(
        specTerminalDispositionCheck(root, input, {
          specId: "spec.sample.terminal",
          status: "pass",
          specState: "reviewed-exception",
        }).problem,
      ).toContain("does not match structured source fields");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("accepts a multi-spec terminal disposition when structured fields agree", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-terminal-multi-"));
    try {
      const specsDir = join(root, "features", "sample", "specs");
      mkdirSync(specsDir, { recursive: true });
      writeFileSync(
        join(specsDir, "first.json"),
        JSON.stringify({
          id: "spec.sample.first",
          status: "blocked",
          specState: "reviewed-exception",
        }),
      );
      writeFileSync(
        join(specsDir, "second.json"),
        JSON.stringify({
          id: "spec.sample.second",
          status: "blocked",
          specState: "reviewed-exception",
        }),
      );
      const input = {
        specId: "spec.sample.first,spec.sample.second",
        specIds: ["spec.sample.first", "spec.sample.second"],
      };
      const accepted = specTerminalDispositionCheck(root, input, {
        specId: "spec.sample.first,spec.sample.second",
        status: "blocked",
        specState: "reviewed-exception",
      });
      expect(accepted.accepted).toBe(true);
      expect(accepted.evidence).toContain(
        "terminal-disposition-spec:spec.sample.first,spec.sample.second",
      );
      expect(
        accepted.evidence.filter((item) =>
          item.startsWith("terminal-disposition-spec-path:"),
        ),
      ).toHaveLength(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects a terminal disposition bound to another staging region", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-terminal-target-"));
    try {
      const specsDir = join(root, "features", "sample", "specs");
      mkdirSync(specsDir, { recursive: true });
      writeFileSync(
        join(specsDir, "terminal.json"),
        JSON.stringify({
          id: "spec.sample.terminal",
          status: "blocked",
          specState: "environment-blocked",
          statusReason:
            "Wait for pathId ops-staging-eastus2-sample-owner-followup.",
          resumeCondition:
            "Resume after approvalId app:approval:ops-staging-eastus2-sample-owner-followup returns.",
        }),
      );
      const input = { specId: "spec.sample.terminal" };

      const rejected = specTerminalTargetCheck(root, input, {
        name: "staging",
        location: "westus2",
      });
      expect(rejected.accepted).toBe(false);
      expect(rejected.problem).toContain("expected staging-westus2");
      expect(
        rejected.evidence.some((item) =>
          item.startsWith(
            "terminal-disposition-target-identifier:ops-staging-eastus2-sample-owner-followup",
          ),
        ),
      ).toBe(true);

      writeFileSync(
        join(specsDir, "terminal.json"),
        JSON.stringify({
          id: "spec.sample.terminal",
          status: "blocked",
          specState: "environment-blocked",
          statusReason:
            "Wait for pathId ops-staging-westus2-sample-owner-followup.",
        }),
      );
      expect(
        specTerminalTargetCheck(root, input, {
          name: "staging",
          location: "westus2",
        }).accepted,
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("accepts a multi-spec staging terminal disposition when target markers agree", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-terminal-target-multi-"));
    try {
      const specsDir = join(root, "features", "sample", "specs");
      mkdirSync(specsDir, { recursive: true });
      writeFileSync(
        join(specsDir, "first.json"),
        JSON.stringify({
          id: "spec.sample.first",
          status: "blocked",
          specState: "reviewed-exception",
          statusReason:
            "Wait for pathId ops-staging-westus2-sample-first-followup.",
        }),
      );
      writeFileSync(
        join(specsDir, "second.json"),
        JSON.stringify({
          id: "spec.sample.second",
          status: "blocked",
          specState: "reviewed-exception",
          resumeCondition:
            "Resume after waitId ops-staging-westus2-sample-second-followup.",
        }),
      );
      const input = {
        specId: "spec.sample.first,spec.sample.second",
        specIds: ["spec.sample.first", "spec.sample.second"],
      };
      const accepted = specTerminalTargetCheck(root, input, {
        name: "staging",
        location: "westus2",
      });
      expect(accepted.accepted).toBe(true);
      expect(accepted.evidence).toContain(
        "terminal-disposition-target:staging",
      );
      expect(accepted.evidence).toContain(
        "terminal-disposition-location:westus2",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("verifies terminal scenario normalization without requiring ADO proof", async () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-terminal-verify-"));
    try {
      mkdirSync(join(root, "features", "sample", "specs"), {
        recursive: true,
      });
      mkdirSync(join(root, "scripts"), { recursive: true });
      writeFileSync(
        join(root, "features", "sample", "specs", "terminal.json"),
        JSON.stringify({
          id: "spec.sample.terminal",
          status: "product_constraint",
          specState: "reviewed-exception",
        }),
      );
      writeFileSync(
        join(root, "scripts", "check-scenario-tests.ts"),
        [
          "console.log(JSON.stringify({",
          "  report: { missingAdapterFiles: [] },",
          "  guard: {",
          "    remainingSpecReferencedPlainScenarioUnits: [],",
          "    remainingRepoPlainScenarioFiles: []",
          "  }",
          "}));",
        ].join("\n"),
      );
      execFileSync("git", ["init"], { cwd: root, encoding: "utf8" });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: root,
        encoding: "utf8",
      });
      execFileSync("git", ["config", "user.name", "Test User"], {
        cwd: root,
        encoding: "utf8",
      });
      execFileSync("git", ["add", "."], { cwd: root, encoding: "utf8" });
      execFileSync("git", ["commit", "-m", "terminal source"], {
        cwd: root,
        encoding: "utf8",
      });
      const commit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      execFileSync("git", ["update-ref", "refs/remotes/origin/dev", commit], {
        cwd: root,
        encoding: "utf8",
      });

      const verification = await verify(
        {
          projectDir: root,
          workspaceDir: root,
          taskId: "domain/sample",
          generation: 1,
          intent: {
            input: {
              loopId: "scenario-normalization",
              scenarioTestPath: "features/sample/tests/terminal.ts",
              specId: "spec.sample.terminal",
              target: "staging",
            },
          },
        } as any,
        {
          state: "converged",
          summary: "terminal disposition integrated",
          evidence: [
            "terminal-disposition-spec:spec.sample.terminal",
            "terminal-disposition-status:product_constraint",
            "terminal-disposition-spec-state:reviewed-exception",
            `source-commit:${"0".repeat(40)}`,
            `integrated-commit:${"0".repeat(40)}`,
            `source-commit:${commit}`,
            `integrated-commit:${commit}`,
            "target-ref:origin/dev",
            "terminal-disposition:no-new-ado-pass-claimed",
          ],
        } as any,
      );

      expect(verification.accepted).toBe(true);
      expect(verification.summary).toContain("without claiming a new ADO pass");
      expect(verification.evidence).toContain(
        "terminal-disposition:no-new-ado-pass-claimed",
      );
      expect(verification.evidence).toContain(
        "terminal-disposition-status:product_constraint",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("verifies a terminal disposition for ordinary spec-live work", async () => {
    const root = mkdtempSync(join(tmpdir(), "spec-terminal-verify-"));
    try {
      mkdirSync(join(root, "features", "sample", "specs"), {
        recursive: true,
      });
      writeFileSync(
        join(root, "features", "sample", "specs", "terminal.json"),
        JSON.stringify({
          id: "spec.sample.terminal",
          status: "environment",
          specState: "reviewed-exception",
          statusReason: "Exact staging-westus2 live run repeated the blocker.",
        }),
      );
      execFileSync("git", ["init"], { cwd: root, encoding: "utf8" });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: root,
        encoding: "utf8",
      });
      execFileSync("git", ["config", "user.name", "Test User"], {
        cwd: root,
        encoding: "utf8",
      });
      execFileSync("git", ["add", "."], { cwd: root, encoding: "utf8" });
      execFileSync("git", ["commit", "-m", "terminal source"], {
        cwd: root,
        encoding: "utf8",
      });
      const commit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      execFileSync("git", ["update-ref", "refs/remotes/origin/dev", commit], {
        cwd: root,
        encoding: "utf8",
      });

      const verification = await verify(
        {
          projectDir: root,
          workspaceDir: root,
          taskId: "domain/sample",
          generation: 1,
          intent: {
            input: {
              specId: "spec.sample.terminal",
              target: "staging",
            },
          },
        } as any,
        {
          state: "converged",
          summary: "terminal disposition integrated",
          evidence: [
            "terminal-disposition-spec:spec.sample.terminal",
            "terminal-disposition-status:environment",
            "terminal-disposition-spec-state:reviewed-exception",
            `source-commit:${commit}`,
            `integrated-commit:${commit}`,
            "target-ref:origin/dev",
            "terminal-disposition:no-new-ado-pass-claimed",
          ],
        } as any,
      );

      expect(verification.accepted).toBe(true);
      expect(verification.summary).toContain("terminal spec disposition");
      expect(verification.evidence).toContain(
        "terminal-disposition-status:environment",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects terminal evidence when the task requires an exact pass", async () => {
    const verification = await verify(
      {
        projectDir: "/tmp/not-used-for-forbidden-terminal-disposition",
        workspaceDir: "/tmp/not-used-for-forbidden-terminal-disposition",
        taskId: "domain/pass-required",
        generation: 1,
        intent: {
          input: {
            specId: "spec.sample.pass-required",
            target: "staging",
            allowTerminalDisposition: false,
          },
        },
      } as any,
      {
        state: "converged",
        summary: "forged terminal result",
        evidence: ["terminal-disposition:no-new-ado-pass-claimed"],
      } as any,
    );

    expect(verification.accepted).toBe(false);
    expect(verification.summary).toContain("requires exact passing live proof");
    expect(verification.evidence).toContain(
      "verification-finding:terminal-disposition-forbidden",
    );
  });

  test("accepts a same-task correction without treating it as final live proof", async () => {
    const context = {
      projectDir: "/tmp/not-used-for-self-revision",
      workspaceDir: "/tmp/not-used-for-self-revision",
      taskId: "domain/normalize-one-spec",
      generation: 2,
      intent: {
        input: {
          loopId: "scenario-normalization",
          specId: "spec.sample.one",
          target: "staging",
        },
      },
    } as any;
    const revision = {
      state: "converged",
      summary: "Bound current cleanup evidence",
      evidence: ["cleanup-proof:absent"],
      actions: [
        {
          kind: "update-task",
          taskId: context.taskId,
          expectedGeneration: 2,
          workflow: "spec-live-reconciliation",
          input: {
            loopId: "scenario-normalization",
            specId: "spec.sample.one",
            target: "staging",
            ownerCorrection: { cleanupProofPath: "proof.json" },
          },
        },
      ],
    } as any;

    const accepted = await verify(context, revision);
    expect(accepted.accepted).toBe(true);
    expect(accepted.summary).toContain(
      "final live-proof verification remains required",
    );
    expect(accepted.evidence).toContain(
      "task-revision:domain/normalize-one-spec@3",
    );

    const weakenedPolicy = structuredClone(revision);
    context.intent.input.allowTerminalDisposition = false;
    const weakenedPolicyVerification = await verify(context, weakenedPolicy);
    expect(weakenedPolicyVerification.accepted).toBe(false);
    expect(weakenedPolicyVerification.summary).toContain(
      "preserve the terminal-disposition policy",
    );
    delete context.intent.input.allowTerminalDisposition;

    const changedTarget = structuredClone(revision);
    changedTarget.actions[0].input.target = "standalone";
    const rejected = await verify(context, changedTarget);
    expect(rejected.accepted).toBe(false);
    expect(rejected.summary).toContain("preserve the exact live target");
  });

  test("rejects a wait whose event type has no app producer", () => {
    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "Wait for registration.",
        evidence: ["registration is not ready"],
        condition: {
          id: "wait-registration",
          type: "external-state",
          subject: "project:aks-rp-e2e",
          expected: {
            field: "staging.subscriptionFeatures.preview",
            equals: "Registered",
          },
        },
      }),
    ).toContain("has no producer");
  });

  test("accepts a pull-request wait observed by the app watcher", () => {
    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "Wait for the focused repair PR to change.",
        evidence: ["pull-request:123"],
        condition: pullRequestWaitCondition("123"),
      }),
    ).toBeNull();
  });

  test("rejects a future main pass as proof for task-owned scenario normalization", () => {
    const futureMainPass = {
      decision: "waiting" as const,
      summary: "wait for a later main pass",
      evidence: ["spec:spec.example"],
      condition: {
        id: "future-main-pass",
        type: "pipeline.spec.observed",
        subject: "project:aks-rp-e2e",
        expected: {
          specId: "spec.example",
          status: "pass",
          sourceBranch: "refs/heads/main",
        },
      },
    };
    expect(scenarioNormalizationWaitProblem(futureMainPass)).toContain(
      "would not verify or publish this task-owned source commit",
    );
    expect(
      scenarioNormalizationWaitProblem({
        ...futureMainPass,
        condition: {
          ...futureMainPass.condition,
          subject: "pipeline-run:42",
          type: "pipeline.run.observed",
          expected: { state: "completed" },
        },
      }),
    ).toBeNull();
  });

  test("rejects an arbitrary repo advance as scenario-normalization progress", () => {
    expect(
      scenarioNormalizationWaitProblem({
        decision: "waiting",
        summary: "wait for any later dev merge",
        evidence: ["same-spec carrier still needs repair"],
        condition: {
          id: "origin-dev-advance",
          type: "aks.repo-ref.observed",
          subject: "repo-ref:origin/dev",
          expected: {
            field: "commit",
            notEquals: "abc",
          },
        },
      }),
    ).toContain("cannot wait for an arbitrary repository advance");
  });

  test("parses the finite spec task identity and generation", () => {
    expect(
      parseTaskPayload(
        `prefix\n## Reconciliation Task\n${JSON.stringify({
          taskId: "spec/example-a1b2c3",
          generation: 2,
          input: { specId: "spec.example.lifecycle" },
        })}`,
      ),
    ).toMatchObject({
      taskId: "spec/example-a1b2c3",
      generation: 2,
      input: { specId: "spec.example.lifecycle" },
    });
  });

  test("keeps exact source proof across a task metadata revision", () => {
    const exact = {
      id: 42,
      sourceVersion: "abc",
      templateParameters: {
        specs: "spec.example.lifecycle",
        target: "staging",
        metadata: JSON.stringify({
          taskId: "spec/example-a1b2c3",
          generation: 2,
        }),
      },
    };
    const wrongGeneration = {
      ...exact,
      id: 43,
      templateParameters: {
        ...exact.templateParameters,
        metadata: JSON.stringify({
          taskId: "spec/example-a1b2c3",
          generation: 1,
        }),
      },
    };

    expect(
      matchingTaskRuns([wrongGeneration, exact], {
        taskId: "spec/example-a1b2c3",
        generation: 2,
        specId: "spec.example.lifecycle",
        sourceCommit: "abc",
      }),
    ).toEqual([wrongGeneration, exact]);
  });

  test("parses an authoritative same-source run reference from parent lineage", () => {
    expect(
      authoritativeRunReference({
        authoritativeRunId: "174756648",
        authoritativeSourceBranch:
          "refs/heads/task/domain-reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8-0bbf416f08",
        authoritativeSourceCommit: "cab25239d9c5d1994bcc303cd831b69773d42e70",
        authoritativeTaskId:
          "domain/reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8ce69cb-20260801",
      }),
    ).toEqual({
      runId: "174756648",
      sourceBranch:
        "task/domain-reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8-0bbf416f08",
      sourceCommit: "cab25239d9c5d1994bcc303cd831b69773d42e70",
      taskId:
        "domain/reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8ce69cb-20260801",
    });
    expect(authoritativeRunReference({ authoritativeRunId: "174756648" })).toBe(
      null,
    );
  });

  test("inherits an authoritative pass from the completed child receipt when payload evidence is absent", () => {
    const appDir = mkdtempSync(join(tmpdir(), "spec-live-child-proof-"));
    try {
      const proofPath = join(appDir, "proof.json");
      mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
      writeFileSync(
        proofPath,
        JSON.stringify({
          version: 1,
          taskId:
            "domain/recover-spec-traffic-api-proxy-cert-rotation-post-rotation-proxy-500-20260801",
          specId: "spec.traffic-api-proxy.cert-rotation",
          target: "staging",
          sourceBranch:
            "refs/heads/task/domain-recover-spec-traffic-api-proxy-cert-rotation-post-rotation-proxy--4af72e8065",
          sourceCommit: "138491461614979b9eaa95394ddacb2630ded2a8",
          runId: "174776400",
          verdict: "pass",
        }),
      );
      writeFileSync(
        join(appDir, ".state", "tasks", "state.json"),
        JSON.stringify({
          receipts: {
            "domain/recover-spec-traffic-api-proxy-cert-rotation-post-rotation-proxy-500-20260801":
              {
                evidence: [`proof:${proofPath}`],
              },
          },
        }),
      );

      expect(
        inheritedAuthoritativeRunReference(
          {
            children: {
              completed: [
                {
                  taskId:
                    "domain/recover-spec-traffic-api-proxy-cert-rotation-post-rotation-proxy-500-20260801",
                },
              ],
            },
          } as any,
          appDir,
          "spec.traffic-api-proxy.cert-rotation",
          "staging",
        ),
      ).toEqual({
        runId: "174776400",
        sourceBranch:
          "task/domain-recover-spec-traffic-api-proxy-cert-rotation-post-rotation-proxy--4af72e8065",
        sourceCommit: "138491461614979b9eaa95394ddacb2630ded2a8",
        taskId:
          "domain/recover-spec-traffic-api-proxy-cert-rotation-post-rotation-proxy-500-20260801",
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("finds same-task exact runs across branch lineages but preserves redispatch on material differences", () => {
    const exact = {
      id: 42,
      sourceBranch: "refs/heads/task/spec-example-a",
      sourceVersion: "cab25239d9c5d1994bcc303cd831b69773d42e70",
      templateParameters: {
        specs: "spec.image-integrity.master-validation",
        target: "staging",
        metadata: JSON.stringify({
          taskId:
            "spec/verify-spec-image-integrity-master-validation-cab25239d-20260801",
          generation: 2,
        }),
      },
    };
    const sameTaskDifferentBranch = {
      ...exact,
      id: 43,
      sourceBranch: "refs/heads/task/spec-example-b",
    };
    const differentSourceCommit = {
      ...exact,
      id: 44,
      sourceVersion: "different-source",
    };
    const differentGeneration = {
      ...exact,
      id: 45,
      templateParameters: {
        ...exact.templateParameters,
        metadata: JSON.stringify({
          taskId:
            "spec/verify-spec-image-integrity-master-validation-cab25239d-20260801",
          generation: 1,
        }),
      },
    };

    expect(
      matchingTaskGenerationRuns(
        [
          differentSourceCommit,
          differentGeneration,
          sameTaskDifferentBranch,
          exact,
        ],
        {
          taskId:
            "spec/verify-spec-image-integrity-master-validation-cab25239d-20260801",
          generation: 2,
          specId: "spec.image-integrity.master-validation",
          sourceCommit: "cab25239d9c5d1994bcc303cd831b69773d42e70",
        },
      ),
    ).toEqual([sameTaskDifferentBranch, exact]);
  });

  test("retires only superseded queued proof for the same task generation", () => {
    const run = (
      id: number,
      status: string,
      sourceVersion: string,
      generation = 2,
    ) => ({
      id,
      status,
      sourceVersion,
      templateParameters: {
        specs: "spec.example.lifecycle",
        target: "staging",
        metadata: JSON.stringify({
          taskId: "spec/example-a1b2c3",
          generation,
        }),
      },
    });

    const oldQueued = run(42, "notStarted", "old-commit");
    const olderQueued = run(41, "notStarted", "older-commit");
    expect(
      supersededQueuedTaskRuns(
        [
          oldQueued,
          run(45, "notStarted", "current-commit"),
          run(44, "inProgress", "old-commit"),
          run(43, "completed", "old-commit"),
          run(40, "notStarted", "old-generation", 1),
          olderQueued,
        ],
        {
          taskId: "spec/example-a1b2c3",
          generation: 2,
          specId: "spec.example.lifecycle",
          sourceCommit: "current-commit",
        },
      ),
    ).toEqual([olderQueued, oldQueued]);
  });

  test("preserves an exact standalone live target across recovery", () => {
    const exact = {
      id: 52,
      sourceBranch: "refs/heads/task/example",
      sourceVersion: "repair-commit",
      templateParameters: {
        specs: "spec.rp-cluster-lifecycle.nginx-large-header",
        target: "standalone-rp-ingress",
        standalone_build_id: "173469496",
        metadata: JSON.stringify({
          taskId: "domain/nginx-repair",
          generation: 3,
        }),
      },
    };
    const wrongBuild = {
      ...exact,
      id: 53,
      templateParameters: {
        ...exact.templateParameters,
        standalone_build_id: "173469497",
      },
    };

    expect(
      matchingTaskRuns([wrongBuild, exact], {
        taskId: "domain/nginx-repair",
        generation: 3,
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        sourceCommit: "repair-commit",
        target: "standalone-rp-ingress",
        standaloneBuildId: "173469496",
      }),
    ).toEqual([exact]);
    expect(
      resolveLiveExecutionTarget({
        target: "standalone-rp-ingress",
        standaloneBuildId: 173469496,
      }),
    ).toEqual({
      target: "standalone-rp-ingress",
      standaloneBuildId: "173469496",
    });
    expect(resolveLiveExecutionTarget()).toEqual({
      target: "staging",
      standaloneBuildId: "",
    });
    expect(() =>
      resolveLiveExecutionTarget({ standaloneBuildId: "latest" }),
    ).toThrow();

    expect(
      runMatchesPriorVerification(exact, {
        taskId: "domain/nginx-repair",
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        target: "standalone-rp-ingress",
        standaloneBuildId: "173469496",
        sourceBranch: "task/example",
        sourceCommit: "repair-commit",
      }),
    ).toBe(true);
    expect(
      runMatchesPriorVerification(exact, {
        taskId: "domain/another-task",
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        target: "standalone-rp-ingress",
        standaloneBuildId: "173469496",
        sourceBranch: "task/example",
        sourceCommit: "repair-commit",
      }),
    ).toBe(false);
    expect(
      runMatchesPriorVerification(exact, {
        taskId: "domain/nginx-repair",
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        target: "standalone-rp-ingress",
        standaloneBuildId: "173469496",
        sourceBranch: "task/other",
        sourceCommit: "repair-commit",
      }),
    ).toBe(false);
    expect(
      runMatchesPriorVerification(wrongBuild, {
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        target: "standalone-rp-ingress",
        standaloneBuildId: "173469496",
        sourceCommit: "repair-commit",
      }),
    ).toBe(false);
  });

  test("uses exact pipeline and PR Conditions", () => {
    expect(pipelineRunState({ state: "inProgress" })).toBe("inProgress");
    expect(pipelineRunState({ status: "completed", state: "inProgress" })).toBe(
      "completed",
    );
    expect(pipelineWaitCondition("42")).toEqual({
      id: "pipeline-run-42-completed",
      type: "pipeline-run.state",
      subject: "pipeline-run:42",
      expected: { field: "state", anyOf: ["completed"] },
    });
    expect(pullRequestWaitCondition("77")).toEqual({
      id: "pull-request-77-changed",
      type: "pull-request.state",
      subject: "pull-request:77",
      expected: {
        field: "state",
        anyOf: ["completed", "abandoned", "conflicted"],
      },
    });
    expect(pullRequestSourceUpdateCondition("77", "abc")).toEqual({
      id: "pull-request-77-source-not-abc",
      type: "pull-request.state",
      subject: "pull-request:77",
      expected: { field: "sourceCommit", notEquals: "abc" },
    });
  });

  test("gives agent-authored waits stable task-local identities", () => {
    const condition = {
      id: "approval-return:underlay",
      type: "project.approval.submitted",
      subject: "project:aks-rp-e2e",
      expected: { pathId: "path.example" },
    };

    const first = taskScopedAgentCondition("domain/example-a", 2, condition);
    expect(first).toEqual({
      ...condition,
      id: expect.stringMatching(/^approval-return:underlay:task-[a-f0-9]{12}$/),
    });
    expect(taskScopedAgentCondition("domain/example-a", 2, condition)).toEqual(
      first,
    );
    expect(
      taskScopedAgentCondition("domain/example-b", 2, condition).id,
    ).not.toBe(first.id);
  });

  test("uses dev by convention and allows the master-validation workflow to target main", () => {
    expect(resolveIntegrationTarget()).toEqual({
      targetBranch: "dev",
      targetRef: "origin/dev",
    });
    expect(resolveIntegrationTarget("main")).toEqual({
      targetBranch: "main",
      targetRef: "origin/main",
    });
    expect(integrationMode("dev")).toBe("direct");
    expect(integrationMode("main")).toBe("pull-request");
    expect(() => resolveIntegrationTarget("bad branch")).toThrow();
  });

  test("preserves an integrated source commit when an exact run already exists", () => {
    expect(
      shouldFastForwardIntegratedSource({
        existingPullRequest: false,
        sourceCommit: "tested",
        baseCommit: "base",
        sourceIsAncestorOfTarget: true,
        matchingRunCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldFastForwardIntegratedSource({
        existingPullRequest: false,
        sourceCommit: "untested",
        baseCommit: "base",
        sourceIsAncestorOfTarget: true,
        matchingRunCount: 0,
      }),
    ).toBe(true);
  });

  test("requires agent live-readiness judgment even after source changed", () => {
    expect(
      shouldReviewBeforeInitialLiveDispatch({
        hasExactRun: false,
        branchHasChange: true,
      }),
    ).toBe(true);
    expect(
      shouldReviewBeforeInitialLiveDispatch({
        hasExactRun: false,
        branchHasChange: false,
      }),
    ).toBe(true);
    expect(
      shouldReviewBeforeInitialLiveDispatch({
        hasExactRun: true,
        branchHasChange: true,
      }),
    ).toBe(false);
    expect(
      shouldReviewBeforeInitialLiveDispatch({
        hasExactRun: false,
        branchHasChange: true,
        reviewedScenarioPatch: true,
      }),
    ).toBe(false);
  });

  test("keeps an invalid preparation verdict inside structured correction", () => {
    const acceptedPass = {
      decision: "accepted-pass" as const,
      summary: "old run passed",
      evidence: ["pipeline-run:1"],
    };
    expect(preparationDecisionProblem(acceptedPass, false)).toContain(
      "return test-current",
    );
    expect(preparationDecisionProblem(acceptedPass, true)).toBeNull();
    expect(
      preparationDecisionProblem(
        {
          decision: "test-current",
          summary: "ready",
          evidence: ["source-reviewed"],
          liveReady: true,
        },
        false,
      ),
    ).toBeNull();
  });

  test("replays a stale scenario branch and any branch containing first-parent merges", () => {
    expect(
      scenarioNormalizationReplayRequired({
        sourceIsInTarget: false,
        targetIsInSource: false,
        firstParentMergeCount: 0,
      }),
    ).toBe(true);
    expect(
      scenarioNormalizationReplayRequired({
        sourceIsInTarget: false,
        targetIsInSource: true,
        firstParentMergeCount: 1,
      }),
    ).toBe(true);
    expect(
      scenarioNormalizationReplayRequired({
        sourceIsInTarget: true,
        targetIsInSource: false,
        firstParentMergeCount: 1,
      }),
    ).toBe(false);
    expect(
      scenarioNormalizationReplayRequired({
        sourceIsInTarget: false,
        targetIsInSource: true,
        firstParentMergeCount: 0,
      }),
    ).toBe(false);
  });

  test("resumes a clean interrupted replay from its inferred merge base", () => {
    expect(
      scenarioNormalizationReplayBase({
        recordedTaskBase: "recorded",
        inferredMergeBase: "latest-clean-base",
        recordedFirstParentMergeCount: 0,
      }),
    ).toBe("latest-clean-base");
    expect(
      scenarioNormalizationReplayBase({
        recordedTaskBase: "recorded",
        inferredMergeBase: "unsafe-merge-base",
        recordedFirstParentMergeCount: 1,
      }),
    ).toBe("recorded");
    expect(
      scenarioNormalizationReplayBase({
        recordedTaskBase: "recorded",
        priorReplayBase: "checkpointed-base",
        inferredMergeBase: "latest-clean-base",
        recordedFirstParentMergeCount: 0,
      }),
    ).toBe("checkpointed-base");
  });

  test("integrates a replacement task from its persisted dispatch replay base", () => {
    const calls: string[][] = [];
    const persistedBase = "1".repeat(40);
    const inferredBase = "2".repeat(40);
    const sourceCommit = "3".repeat(40);
    const result = scenarioIntegrationReplayBase(
      {
        workspaceDir: "/repo",
        recordedTaskBase: "",
        replayState: {
          version: 1,
          recordedTaskBase: "",
          replayBase: persistedBase,
          sourceCommit,
        },
        sourceCommit,
        targetRef: "origin/dev",
      },
      (_cwd, args) => {
        calls.push(args);
        if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
          return { status: 0, stdout: "", stderr: "" };
        }
        return { status: 0, stdout: inferredBase, stderr: "" };
      },
    );

    expect(result).toBe(persistedBase);
    expect(calls).toEqual([
      ["merge-base", "--is-ancestor", persistedBase, sourceCommit],
    ]);
  });

  test("recovers a missing replacement-task baseline from the Git merge base", () => {
    const inferredBase = "2".repeat(40);
    const sourceCommit = "3".repeat(40);
    const result = scenarioIntegrationReplayBase(
      {
        workspaceDir: "/repo",
        recordedTaskBase: "",
        replayState: null,
        sourceCommit,
        targetRef: "origin/dev",
      },
      (_cwd, args) => {
        if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
          return {
            status: args[2] === inferredBase ? 0 : 1,
            stdout: "",
            stderr: "",
          };
        }
        return { status: 0, stdout: inferredBase, stderr: "" };
      },
    );

    expect(result).toBe(inferredBase);
  });

  test("replays only patches not already integrated into the current target", () => {
    expect(
      novelScenarioReplayCommits(
        [
          "- 1111111111111111111111111111111111111111 already integrated",
          "+ 2222222222222222222222222222222222222222 task patch one",
          "- 3333333333333333333333333333333333333333 patch equivalent",
          "+ 4444444444444444444444444444444444444444 task patch two",
        ].join("\n"),
      ),
    ).toEqual([
      "2222222222222222222222222222222222222222",
      "4444444444444444444444444444444444444444",
    ]);
    expect(
      novelScenarioReplayCommits(
        [
          "- 1111111111111111111111111111111111111111 rebased equivalent",
          "- 3333333333333333333333333333333333333333 already integrated",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  test("ignores failed remote lease lookups for scenario replay pushes", () => {
    expect(
      remoteLeaseCommit({
        status: 0,
        stdout: "0123456789abcdef0123456789abcdef01234567\n",
      }),
    ).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(
      remoteLeaseCommit({
        status: 0,
        stdout:
          "0123456789abcdef0123456789abcdef01234567\trefs/heads/task/example\n",
      }),
    ).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(
      remoteLeaseCommit({
        status: 0,
        stdout:
          "refs/remotes/origin/task/domain-normalize-plain-scenario-carrier-net-integr-3f0ec91d4f\n",
      }),
    ).toBeNull();
    expect(
      remoteLeaseCommit({
        status: 128,
        stdout:
          "refs/remotes/origin/task/domain-normalize-plain-scenario-carrier-net-integr-3f0ec91d4f\n",
      }),
    ).toBeNull();
  });

  test("builds a creation-safe force-with-lease arg when the remote task branch is absent", () => {
    expect(
      scenarioReplayForceWithLeaseArg({
        sourceBranch:
          "task/domain-normalize-plain-scenario-carrier-net-integr-3f0ec91d4f",
        expectedRemoteCommit: "0123456789abcdef0123456789abcdef01234567",
      }),
    ).toBe(
      "--force-with-lease=refs/heads/task/domain-normalize-plain-scenario-carrier-net-integr-3f0ec91d4f:0123456789abcdef0123456789abcdef01234567",
    );
    expect(
      scenarioReplayForceWithLeaseArg({
        sourceBranch:
          "task/domain-normalize-plain-scenario-carrier-net-integr-3f0ec91d4f",
        expectedRemoteCommit: null,
      }),
    ).toBe(
      "--force-with-lease=refs/heads/task/domain-normalize-plain-scenario-carrier-net-integr-3f0ec91d4f:",
    );
  });

  test("reverifies a direct candidate whenever the target advanced after its live run", () => {
    expect(
      directIntegrationAction({
        sourceIsInTarget: true,
        targetIsInSource: false,
      }),
    ).toBe("converged");
    expect(
      directIntegrationAction({
        sourceIsInTarget: false,
        targetIsInSource: true,
      }),
    ).toBe("publish-tested-source");
    expect(
      directIntegrationAction({
        sourceIsInTarget: false,
        targetIsInSource: false,
      }),
    ).toBe("reverify-updated-source");
  });

  test("recognizes an exact bounded frozen candidate after content-equivalent replay", () => {
    const root = mkdtempSync(join(tmpdir(), "frozen-candidate-equivalent-"));
    const run = (args: string[]) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const paths = [
      "features/workload-health/specs/readiness.json",
      "features/workload-health/tests/readiness.test.ts",
    ];

    try {
      run(["init"]);
      run(["config", "user.email", "test@example.com"]);
      run(["config", "user.name", "Test"]);
      writeFileSync(join(root, "base.txt"), "base\n");
      run(["add", "base.txt"]);
      run(["commit", "-m", "base"]);
      const base = run(["rev-parse", "HEAD"]);

      for (const path of paths) {
        mkdirSync(join(root, path.split("/").slice(0, -1).join("/")), {
          recursive: true,
        });
        writeFileSync(join(root, path), `tested ${path}\n`);
      }
      run(["add", ...paths]);
      run(["commit", "-m", "tested candidate"]);
      const tested = run(["rev-parse", "HEAD"]);

      run(["checkout", "--detach", base]);
      for (const path of paths) {
        mkdirSync(join(root, path.split("/").slice(0, -1).join("/")), {
          recursive: true,
        });
        writeFileSync(join(root, path), `tested ${path}\n`);
      }
      run(["add", ...paths]);
      run(["commit", "-m", "content-equivalent replay"]);
      const replay = run(["rev-parse", "HEAD"]);

      expect(tested).not.toBe(replay);
      expect(
        frozenCandidateContentEquivalent({
          repoDir: root,
          sourceCommit: tested,
          targetCommit: replay,
          boundedSourceFiles: [...paths].reverse(),
        }),
      ).toEqual({ equivalent: true, paths: [...paths].sort() });

      writeFileSync(join(root, paths[1]), "changed after replay\n");
      run(["add", paths[1]]);
      run(["commit", "-m", "change tested carrier"]);
      expect(
        frozenCandidateContentEquivalent({
          repoDir: root,
          sourceCommit: tested,
          targetCommit: "HEAD",
          boundedSourceFiles: paths,
        }).equivalent,
      ).toBe(false);
      expect(
        frozenCandidateContentEquivalent({
          repoDir: root,
          sourceCommit: tested,
          targetCommit: replay,
          boundedSourceFiles: ["../outside"],
        }).equivalent,
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("requires a relevant source change after semantic proof invalidation", () => {
    const repoDir = mkdtempSync(join(tmpdir(), "semantic-invalidation-"));
    try {
      execFileSync("git", ["init"], { cwd: repoDir });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: repoDir,
      });
      execFileSync("git", ["config", "user.name", "Test User"], {
        cwd: repoDir,
      });
      mkdirSync(join(repoDir, "features", "feature-a", "tests"), {
        recursive: true,
      });
      const carrierPath = "features/feature-a/tests/case-a.test.ts";
      writeFileSync(
        join(repoDir, carrierPath),
        "export const proof = 'old';\n",
      );
      execFileSync("git", ["add", "."], { cwd: repoDir });
      execFileSync("git", ["commit", "-m", "invalidated source"], {
        cwd: repoDir,
      });
      const invalidatedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repoDir,
        encoding: "utf8",
      }).trim();

      writeFileSync(join(repoDir, "README.md"), "unrelated\n");
      execFileSync("git", ["add", "."], { cwd: repoDir });
      execFileSync("git", ["commit", "-m", "unrelated change"], {
        cwd: repoDir,
      });
      const unrelatedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repoDir,
        encoding: "utf8",
      }).trim();
      expect(
        semanticInvalidationSourceState({
          repoDir,
          invalidatedCommit,
          candidateCommit: unrelatedCommit,
          paths: [carrierPath],
        }),
      ).toEqual({ changed: false, paths: [carrierPath] });

      writeFileSync(
        join(repoDir, carrierPath),
        "export const proof = 'new';\n",
      );
      execFileSync("git", ["add", "."], { cwd: repoDir });
      execFileSync("git", ["commit", "-m", "repair semantic proof"], {
        cwd: repoDir,
      });
      const repairedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repoDir,
        encoding: "utf8",
      }).trim();
      expect(
        semanticInvalidationSourceState({
          repoDir,
          invalidatedCommit,
          candidateCommit: repairedCommit,
          paths: [carrierPath],
        }),
      ).toEqual({ changed: true, paths: [carrierPath] });
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  test("replays the bounded scenario patch plus shared runner support after a squash target rewrite", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-bounded-replay-"));
    const run = (args: string[]) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const carrier = "features/network-cni/tests/example.ts";
    const adapter = "features/network-cni/tests/example.test.ts";
    const featurePacket = "features/network-cni.yaml";
    const sharedRunner = "runner/plan-run.ts";

    try {
      run(["init"]);
      run(["config", "user.email", "test@example.com"]);
      run(["config", "user.name", "Test"]);
      mkdirSync(join(root, "features/network-cni/tests"), { recursive: true });
      mkdirSync(join(root, "runner"), { recursive: true });
      writeFileSync(join(root, featurePacket), "status: draft\n");
      writeFileSync(join(root, carrier), "legacy carrier\n");
      writeFileSync(join(root, adapter), "import './example';\n");
      writeFileSync(
        join(root, sharedRunner),
        "export const names = 'legacy';\n",
      );
      run(["add", "."]);
      run(["commit", "-m", "base"]);
      const baseline = run(["rev-parse", "HEAD"]);
      run(["branch", "-M", "dev"]);

      mkdirSync(join(root, "features/other"), { recursive: true });
      writeFileSync(join(root, "features/other/adopted.ts"), "adopted\n");
      run(["add", "."]);
      run(["commit", "-m", "unrelated adopted dev work"]);
      run(["checkout", "-b", "task/example"]);
      rmSync(join(root, carrier));
      writeFileSync(join(root, featurePacket), "status: grounded\n");
      writeFileSync(join(root, adapter), "test('direct', () => {});\n");
      writeFileSync(
        join(root, sharedRunner),
        "export const names = 'shared-proof';\n",
      );
      writeFileSync(
        join(root, "features/other/noise.ts"),
        "mixed task noise\n",
      );
      run(["add", "-A"]);
      run(["commit", "-m", "normalize exact carrier"]);
      const testedSource = run(["rev-parse", "HEAD"]);

      run(["checkout", "--detach", baseline]);
      mkdirSync(join(root, "features/other"), { recursive: true });
      writeFileSync(join(root, "features/other/adopted.ts"), "adopted\n");
      run(["add", "."]);
      run(["commit", "-m", "squashed dev integration"]);
      const rewrittenTarget = run(["rev-parse", "HEAD"]);
      run(["branch", "-f", "dev", rewrittenTarget]);
      run(["checkout", "task/example"]);

      const result = replayScenarioNormalizationOntoTarget({
        workspaceDir: root,
        recordedBaseCommit: baseline,
        sourceCommit: testedSource,
        targetRef: "dev",
        anchorPaths: [carrier, adapter],
        featureIds: ["network-cni"],
      });

      if (result.state !== "replayed") throw new Error(JSON.stringify(result));
      expect(result.state).toBe("replayed");
      expect(result.selectedCommits).toHaveLength(1);
      expect(result.changedPaths).toEqual(
        [carrier, adapter, featurePacket, sharedRunner].sort(),
      );
      expect(result.protectedPathsEquivalent).toBe(true);
      expect(run(["show", "HEAD:features/other/adopted.ts"])).toBe("adopted");
      expect(run(["show", `HEAD:${featurePacket}`])).toBe("status: grounded");
      expect(run(["show", `HEAD:${sharedRunner}`])).toBe(
        "export const names = 'shared-proof';",
      );
      expect(
        spawnSync("git", ["cat-file", "-e", "HEAD:features/other/noise.ts"], {
          cwd: root,
        }).status,
      ).not.toBe(0);
      expect(
        spawnSync("git", ["cat-file", "-e", `HEAD:${carrier}`], {
          cwd: root,
        }).status,
      ).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("merges a workload-health-style direct candidate after an unrelated target advance", () => {
    const root = mkdtempSync(join(tmpdir(), "direct-proof-preserve-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const workspace = join(root, "workspace");
    const run = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    const workloadPaths = [
      "features/workload-health/specs/system-components-readiness.json",
      "features/workload-health/tests/system-components-readiness.test.ts",
      "replays/workload-health-system-components-readiness.ts",
      "features/workload-health/docs/system-components-readiness.md",
    ];

    try {
      mkdirSync(seed);
      run(root, ["init", "--bare", remote]);
      run(seed, ["init"]);
      run(seed, ["config", "user.email", "test@example.com"]);
      run(seed, ["config", "user.name", "Test"]);
      writeFileSync(join(seed, "base.txt"), "base\n");
      run(seed, ["add", "base.txt"]);
      run(seed, ["commit", "-m", "base"]);
      run(seed, ["branch", "-M", "dev"]);
      run(seed, ["remote", "add", "origin", remote]);
      run(seed, ["push", "origin", "dev"]);

      run(seed, ["checkout", "-b", "task/workload-health"]);
      for (const [index, file] of workloadPaths.entries()) {
        mkdirSync(join(seed, file.split("/").slice(0, -1).join("/")), {
          recursive: true,
        });
        writeFileSync(
          join(seed, file),
          `workload-health bounded patch ${index + 1}\n`,
        );
      }
      run(seed, ["add", ...workloadPaths]);
      run(seed, ["commit", "-m", "bounded workload-health patch"]);
      const sourceCommit = run(seed, ["rev-parse", "HEAD"]);
      run(seed, ["push", "origin", "task/workload-health"]);

      run(seed, ["checkout", "dev"]);
      mkdirSync(join(seed, "docs"), { recursive: true });
      writeFileSync(join(seed, "docs", "unrelated.md"), "unrelated advance\n");
      run(seed, ["add", "docs/unrelated.md"]);
      run(seed, ["commit", "-m", "unrelated dev advance"]);
      run(seed, ["push", "origin", "dev"]);

      run(root, ["clone", remote, workspace]);
      run(workspace, ["checkout", "task/workload-health"]);
      run(workspace, ["config", "user.email", "test@example.com"]);
      run(workspace, ["config", "user.name", "Test"]);
      run(workspace, ["fetch", "origin", "dev"]);

      const result = mergeAcceptedTargetAdvanceProof({
        workspaceDir: workspace,
        sourceCommit,
        targetRef: "origin/dev",
        protectedSourcePaths: workloadPaths,
      });

      expect(result.state).toBe("merged");
      if (result.state !== "merged") throw new Error(result.reason);
      expect(
        spawnSync(
          "git",
          ["merge-base", "--is-ancestor", sourceCommit, "HEAD"],
          {
            cwd: workspace,
          },
        ).status,
      ).toBe(0);
      expect(
        spawnSync(
          "git",
          ["merge-base", "--is-ancestor", "origin/dev", "HEAD"],
          {
            cwd: workspace,
          },
        ).status,
      ).toBe(0);
      expect(
        run(workspace, ["diff", "--name-only", sourceCommit, "HEAD", "--"]),
      ).toBe("docs/unrelated.md");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("requires a fresh proof when target advance changes a protected direct path", () => {
    const root = mkdtempSync(join(tmpdir(), "direct-proof-overlap-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const workspace = join(root, "workspace");
    const run = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    const protectedPath =
      "features/workload-health/tests/system-components-readiness.test.ts";

    try {
      mkdirSync(join(seed, "features/workload-health/tests"), {
        recursive: true,
      });
      run(root, ["init", "--bare", remote]);
      run(seed, ["init"]);
      run(seed, ["config", "user.email", "test@example.com"]);
      run(seed, ["config", "user.name", "Test"]);
      writeFileSync(join(seed, protectedPath), "base\n");
      run(seed, ["add", protectedPath]);
      run(seed, ["commit", "-m", "base"]);
      run(seed, ["branch", "-M", "dev"]);
      run(seed, ["remote", "add", "origin", remote]);
      run(seed, ["push", "origin", "dev"]);

      run(seed, ["checkout", "-b", "task/workload-health"]);
      writeFileSync(join(seed, protectedPath), "task\nbase\n");
      run(seed, ["add", protectedPath]);
      run(seed, ["commit", "-m", "task patch"]);
      const sourceCommit = run(seed, ["rev-parse", "HEAD"]);
      run(seed, ["push", "origin", "task/workload-health"]);

      run(seed, ["checkout", "dev"]);
      writeFileSync(join(seed, protectedPath), "base\ndev change\n");
      run(seed, ["add", protectedPath]);
      run(seed, ["commit", "-m", "protected path advanced on dev"]);
      run(seed, ["push", "origin", "dev"]);

      run(root, ["clone", remote, workspace]);
      run(workspace, ["checkout", "task/workload-health"]);
      run(workspace, ["config", "user.email", "test@example.com"]);
      run(workspace, ["config", "user.name", "Test"]);
      run(workspace, ["fetch", "origin", "dev"]);

      expect(
        mergeAcceptedTargetAdvanceProof({
          workspaceDir: workspace,
          sourceCommit,
          targetRef: "origin/dev",
          protectedSourcePaths: [protectedPath],
        }),
      ).toEqual({ state: "reverify", reason: "protected-path-changed" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("requires a fresh proof when target advance creates a direct merge conflict", () => {
    const root = mkdtempSync(join(tmpdir(), "direct-proof-conflict-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const workspace = join(root, "workspace");
    const run = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    const protectedPath =
      "features/workload-health/tests/system-components-readiness.test.ts";

    try {
      mkdirSync(join(seed, "features/workload-health/tests"), {
        recursive: true,
      });
      run(root, ["init", "--bare", remote]);
      run(seed, ["init"]);
      run(seed, ["config", "user.email", "test@example.com"]);
      run(seed, ["config", "user.name", "Test"]);
      writeFileSync(join(seed, protectedPath), "value=base\n");
      run(seed, ["add", protectedPath]);
      run(seed, ["commit", "-m", "base"]);
      run(seed, ["branch", "-M", "dev"]);
      run(seed, ["remote", "add", "origin", remote]);
      run(seed, ["push", "origin", "dev"]);

      run(seed, ["checkout", "-b", "task/workload-health"]);
      writeFileSync(join(seed, protectedPath), "value=task\n");
      run(seed, ["add", protectedPath]);
      run(seed, ["commit", "-m", "task patch"]);
      const sourceCommit = run(seed, ["rev-parse", "HEAD"]);
      run(seed, ["push", "origin", "task/workload-health"]);

      run(seed, ["checkout", "dev"]);
      writeFileSync(join(seed, protectedPath), "value=dev\n");
      run(seed, ["add", protectedPath]);
      run(seed, ["commit", "-m", "conflicting dev change"]);
      run(seed, ["push", "origin", "dev"]);

      run(root, ["clone", remote, workspace]);
      run(workspace, ["checkout", "task/workload-health"]);
      run(workspace, ["config", "user.email", "test@example.com"]);
      run(workspace, ["config", "user.name", "Test"]);
      run(workspace, ["fetch", "origin", "dev"]);

      expect(
        mergeAcceptedTargetAdvanceProof({
          workspaceDir: workspace,
          sourceCommit,
          targetRef: "origin/dev",
          protectedSourcePaths: [protectedPath],
        }),
      ).toEqual({ state: "reverify", reason: "merge-conflict" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not recursively re-enter reconciliation on unchanged evidence", () => {
    const source = readFileSync(
      join(import.meta.dir, "spec-live-reconciliation.ts"),
      "utf8",
    );
    expect(source.match(/reconcileSpecLive\(ctx/g) ?? []).toHaveLength(1);
    expect(source).not.toContain("await reconcileSpecLive(ctx");
  });

  test("keeps target-advance proof validity as an agent judgment", () => {
    expect(
      proofProtectedScenarioPaths([
        "features/net-integration/compact/staging.plan.json",
        "features/net-integration/tests/external-acr.test.ts",
      ]),
    ).toEqual(["features/net-integration/tests/external-acr.test.ts"]);
    expect(
      targetAdvanceProofDecisionProblem({
        decision: "accepted-pass",
        summary: "intervening changes do not affect the exact proof",
        evidence: ["reviewed current diff"],
      }),
    ).toBeNull();
    expect(
      targetAdvanceProofDecisionProblem({
        decision: "test-current",
        summary: "runner change affects execution semantics",
        evidence: ["reviewed current diff"],
      }),
    ).toBeNull();
    expect(
      targetAdvanceProofDecisionProblem({
        decision: "committed",
        summary: "changed source",
        evidence: ["commit"],
      }),
    ).toContain("must return accepted-pass");
    expect(
      targetAdvanceProofDecisionProblem({
        decision: "accepted-pass",
        summary: "proof still applies",
        evidence: ["reviewed current diff"],
        liveReady: true,
      }),
    ).toBeNull();
    expect(
      targetAdvanceProofDecisionProblem({
        decision: "accepted-pass",
        summary: "proof does not apply",
        evidence: ["reviewed current diff"],
        liveReady: false,
      }),
    ).toContain("bounded judgment only");

    const source = readFileSync(
      join(import.meta.dir, "spec-live-reconciliation.ts"),
      "utf8",
    );
    expect(source).toContain(
      "The target is expected not to contain the task source changes before integration.",
    );
    expect(source).toContain(
      "Judge only changes introduced on the target after the merge base",
    );
    expect(source).toContain(
      "Checked-in compact plans and diagnostics do not affect a single-spec live proof",
    );
  });

  test("compares only the exact spec knowledge-model projection", () => {
    const sourceModel = {
      paths: [
        {
          id: "path.network-cni.cilium",
          specId: "spec.network-cni.cilium",
          behavior: [{ variable: "network.cilium", expected: "ready" }],
        },
        {
          id: "path.node-fips.create",
          specId: "spec.node-fips.create",
          behavior: [{ variable: "node.fips", expected: "enabled" }],
        },
      ],
      featurePaths: [],
    };
    const unrelatedTargetModel = structuredClone(sourceModel);
    unrelatedTargetModel.paths[1].behavior[0].expected = "verified";
    expect(
      relevantKnowledgeModelUnchanged({
        sourceModel,
        targetModel: unrelatedTargetModel,
        specId: "spec.network-cni.cilium",
      }),
    ).toBe(true);

    const changedTargetModel = structuredClone(sourceModel);
    changedTargetModel.paths[0].behavior[0].expected = "degraded";
    expect(
      relevantKnowledgeModelUnchanged({
        sourceModel,
        targetModel: changedTargetModel,
        specId: "spec.network-cni.cilium",
      }),
    ).toBe(false);
  });

  test("reviews an exact terminal run before replaying scenario source", () => {
    expect(
      shouldReplayScenarioBeforeRunReview({
        directScenarioNormalization: true,
        terminalExactRun: true,
      }),
    ).toBe(false);
    expect(
      shouldReplayScenarioBeforeRunReview({
        directScenarioNormalization: true,
        terminalExactRun: false,
      }),
    ).toBe(true);
  });

  test("refreshes a stale scenario candidate before live dispatch", () => {
    expect(
      liveDispatchTargetRefreshRequired({
        directScenarioNormalization: true,
        targetIsInSource: false,
      }),
    ).toBe(true);
    expect(
      liveDispatchTargetRefreshRequired({
        directScenarioNormalization: true,
        targetIsInSource: true,
      }),
    ).toBe(false);
    expect(
      liveDispatchTargetRefreshRequired({
        directScenarioNormalization: false,
        targetIsInSource: false,
      }),
    ).toBe(false);
  });

  test("replays a judged scenario candidate onto advanced dev without another domain judgment", () => {
    const root = mkdtempSync(join(tmpdir(), "dispatch-target-replay-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const workspace = join(root, "workspace");
    const run = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

    try {
      mkdirSync(seed);
      run(root, ["init", "--bare", remote]);
      run(seed, ["init"]);
      run(seed, ["config", "user.email", "test@example.com"]);
      run(seed, ["config", "user.name", "Test"]);
      writeFileSync(join(seed, "base.txt"), "base\n");
      run(seed, ["add", "base.txt"]);
      run(seed, ["commit", "-m", "base"]);
      run(seed, ["branch", "-M", "dev"]);
      run(seed, ["remote", "add", "origin", remote]);
      run(seed, ["push", "origin", "dev"]);

      run(seed, ["checkout", "-b", "task/scenario"]);
      writeFileSync(
        join(seed, "scenario.test.ts"),
        "export const live = true;\n",
      );
      run(seed, ["add", "scenario.test.ts"]);
      run(seed, ["commit", "-m", "normalize scenario"]);
      const judgedSource = run(seed, ["rev-parse", "HEAD"]);
      run(seed, ["push", "origin", "task/scenario"]);

      run(seed, ["checkout", "dev"]);
      writeFileSync(join(seed, "dev.txt"), "advanced\n");
      run(seed, ["add", "dev.txt"]);
      run(seed, ["commit", "-m", "advance dev"]);
      run(seed, ["push", "origin", "dev"]);

      run(root, ["clone", remote, workspace]);
      run(workspace, ["checkout", "task/scenario"]);
      run(workspace, ["config", "user.email", "test@example.com"]);
      run(workspace, ["config", "user.name", "Test"]);
      run(workspace, ["fetch", "origin", "dev"]);

      const replay = replayScenarioCandidateForDispatch({
        workspaceDir: workspace,
        sourceBranch: "task/scenario",
        candidateCommit: judgedSource,
        targetRef: "origin/dev",
      });

      expect(replay.state).toBe("ready");
      if (replay.state !== "ready") throw new Error(replay.error);
      expect(replay.replayed).toBe(true);
      expect(replay.taskCommits).toEqual([judgedSource]);
      expect(replay.sourceCommit).not.toBe(judgedSource);
      expect(existsSync(join(workspace, "scenario.test.ts"))).toBe(true);
      expect(existsSync(join(workspace, "dev.txt"))).toBe(true);
      expect(
        spawnSync(
          "git",
          [
            "merge-base",
            "--is-ancestor",
            replay.targetCommit,
            replay.sourceCommit,
          ],
          { cwd: workspace },
        ).status,
      ).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

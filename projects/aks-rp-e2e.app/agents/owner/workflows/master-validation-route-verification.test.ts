import { describe, expect, test } from "bun:test";
import {
  name,
  reconciliationOptions,
  workspace,
} from "./master-validation-route-verification.js";
import {
  exactPassNeedsOwnerProblem,
  mainPublicationAcceptanceProblem,
  matchingTaskRuns,
  priorVerificationRunDisposition,
  proofMetadataMatchesSource,
  queueRunMetadata,
} from "./spec-live-reconciliation.js";

describe("master-validation route verification workflow", () => {
  test("binds the shared spec reconciliation implementation to a main workspace", () => {
    expect(name).toBe("master-validation-route-verification");
    expect(workspace).toEqual({ kind: "task", baseBranch: "main" });
    expect(reconciliationOptions).toEqual({
      targetBranch: "main",
      allowTerminalDisposition: false,
    });
  });

  test("routes the invalidated Queuewatcher retry past stale-lineage mismatch into canonical same-source redispatch", () => {
    const parentInput = {
      retryPipelineRunId: "175620959",
      invalidatedRunId: "175621455",
      invalidatedClaimIds: [
        "assert.queuewatcher.message-removed",
        "assert.queuewatcher.operation-failed",
      ],
      sourceCommit: "ecf26332c5a29b38f212e19ca2ac09a4bffbae59",
      sourceBranch:
        "refs/heads/task/domain-master-validation-route-verification-spec.service-platform.queuew-f4db4724f5",
      specId: "spec.service-platform.queuewatcher",
      target: "staging",
      standaloneBuildId: "175600006",
    };
    const taskId =
      "domain/master-validation-route-verification/spec.service-platform.queuewatcher/672a87413d01";
    const staleRetry = {
      id: Number(parentInput.retryPipelineRunId),
      state: "completed",
      result: "succeeded",
      sourceBranch: parentInput.sourceBranch,
      sourceVersion: parentInput.sourceCommit,
      templateParameters: {
        specs: parentInput.specId,
        target: parentInput.target,
        standalone_build_id: parentInput.standaloneBuildId,
        metadata: JSON.stringify({
          taskId,
          generation: 1,
          reviewed_source_commit: "ecf26332c51b7381e4d9fb4db94ac2244c9621c5",
        }),
      },
    };
    const exactContext = {
      taskId,
      specId: parentInput.specId,
      sourceBranch: parentInput.sourceBranch,
      sourceCommit: parentInput.sourceCommit,
      target: parentInput.target,
      standaloneBuildId: parentInput.standaloneBuildId,
    };

    expect(
      priorVerificationRunDisposition(staleRetry, exactContext, {
        runId: parentInput.invalidatedRunId,
        claimIds: parentInput.invalidatedClaimIds,
        lineageInvalid: false,
      }),
    ).toBe("invalidated-lineage-context");
    expect(
      matchingTaskRuns([staleRetry], { ...exactContext, generation: 1 }),
    ).toEqual([]);

    const freshMetadata = queueRunMetadata({
      ...exactContext,
      generation: 1,
      retryOfRunId: parentInput.retryPipelineRunId,
    });
    expect(freshMetadata).toMatchObject({
      taskId,
      generation: "1",
      specId: parentInput.specId,
      sourceCommit: parentInput.sourceCommit,
      reviewed_source_commit: parentInput.sourceCommit,
      target: parentInput.target,
      standaloneBuildId: parentInput.standaloneBuildId,
      standalone_build_id: parentInput.standaloneBuildId,
      retryOfRunId: parentInput.retryPipelineRunId,
    });

    const freshExactRun = {
      ...staleRetry,
      id: 175621999,
      templateParameters: {
        ...staleRetry.templateParameters,
        metadata: JSON.stringify(freshMetadata),
      },
    };
    expect(
      matchingTaskRuns([staleRetry, freshExactRun], {
        ...exactContext,
        generation: 1,
      }),
    ).toEqual([freshExactRun]);
  });

  test("keeps the Queuewatcher exact pass nonterminal until metadata and main publication acceptance are complete", () => {
    const testedSourceCommit = "ecf26332c5a29b38f212e19ca2ac09a4bffbae59";
    const staleReviewedSourceCommit =
      "ecf26332c51b7381e4d9fb4db94ac2244c9621c5";
    const liveEvidence = [
      "pipeline-run:175620959",
      `source-commit:${testedSourceCommit}`,
      "target:staging",
      "standalone-build:175600006",
      "claim-proof:exact",
      "cleanup-proof:complete",
    ];

    expect(
      proofMetadataMatchesSource(
        { reviewed_source_commit: staleReviewedSourceCommit },
        testedSourceCommit,
      ),
    ).toBe(false);
    expect(
      mainPublicationAcceptanceProblem({
        canonicalProofMetadataValid: false,
        publicationRequired: true,
        evidence: liveEvidence,
      }),
    ).toContain("canonical live-proof metadata");

    expect(
      mainPublicationAcceptanceProblem({
        canonicalProofMetadataValid: true,
        publicationRequired: true,
        pullRequestId: "4242",
        evidence: liveEvidence,
      }),
    ).toContain("review-ready");
    expect(
      mainPublicationAcceptanceProblem({
        canonicalProofMetadataValid: true,
        publicationRequired: true,
        pullRequestId: "4242",
        evidence: [
          ...liveEvidence,
          "review-ready-pull-request:4242",
          "review-ready-handoff:sent",
          "current-main-readback:origin/main@merged-queuewatcher-repair",
        ],
      }),
    ).toBeNull();
  });

  test("allows accepted-pass to mean behavior proof when no source publication is required", () => {
    expect(
      mainPublicationAcceptanceProblem({
        canonicalProofMetadataValid: true,
        publicationRequired: false,
        evidence: [
          "pipeline-run:175620959",
          "source-commit:ecf26332c5a29b38f212e19ca2ac09a4bffbae59",
          "target:staging",
          "standalone-build:175600006",
        ],
      }),
    ).toBeNull();
  });

  test("keeps exact external capability gaps open without terminal source bookkeeping", () => {
    expect(
      exactPassNeedsOwnerProblem(
        {
          decision: "needs-owner",
          summary: "RP-proxy kubeconfig is unavailable to live execution.",
          evidence: [
            "external-capability:rp-proxy-kubeconfig",
            "external-producer:staging-hcp-environment-owner",
            "resume-condition:RP-proxy kubeconfig is mounted for ADO live execution",
            "artifact:/tmp/exact-run-result.json",
          ],
        },
        reconciliationOptions.allowTerminalDisposition,
      ),
    ).toBeNull();

    expect(
      exactPassNeedsOwnerProblem(
        {
          decision: "needs-owner",
          summary: "The carrier still needs implementation.",
          evidence: ["source-gap:execute-mode-not-implemented"],
        },
        reconciliationOptions.allowTerminalDisposition,
      ),
    ).toContain("keep internal source gaps in this workflow");
  });
});

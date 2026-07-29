import { describe, expect, test } from "bun:test";
import {
  resolveAksTask,
  verifiedCampaignFixPullRequestIds,
} from "../../../app.js";
import {
  activeMasterValidationRun,
  buildMasterValidationQueueArgs,
  campaignRecoveryDue,
  completedCycleState,
  fixVerificationTrigger,
  latestCampaignFixes,
  nextCampaignPulseCondition,
  transientMasterValidationAccessFailure,
  verifiedFixNotificationContent,
} from "./master-validation-cycle.js";

const parameters = {
  feature_set: "master-validation",
  target: "staging",
  metadata: JSON.stringify({ purpose: "scheduled-master-validation" }),
};

describe("master-validation cycle", () => {
  test("queues the exact main commit with the fixed validation shape", () => {
    const args = buildMasterValidationQueueArgs({
      taskId: "master-validation-staging-cycle",
      generation: 3,
      sourceCommit: "abc123",
      queuedAt: "2026-07-22T10:00:00.000Z",
    });
    expect(args).toContain("--branch");
    expect(args[args.indexOf("--branch") + 1]).toBe("main");
    expect(args[args.indexOf("--commit-id") + 1]).toBe("abc123");
    expect(args).toContain("feature_set=master-validation");
    expect(args).toContain("target=staging");
    expect(args).toContain("slices=12");
    expect(args).toContain("slice_max_parallel=6");
  });

  test("queues a frozen campaign commit without pretending it is main", () => {
    const args = buildMasterValidationQueueArgs({
      taskId: "master-validation-staging-cycle",
      generation: 4,
      sourceBranch: "validation/master-validation-173646937",
      sourceCommit: "candidate123",
      purpose: "master-validation-campaign",
      queuedAt: "2026-07-25T00:00:00.000Z",
      campaign: {
        schemaVersion: "1",
        baselineRunId: "173646937",
        baseCommit: "main123",
        branch: "validation/master-validation-173646937",
        currentCommit: "candidate123",
        integratedFixes: [],
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    });
    expect(args[args.indexOf("--branch") + 1]).toBe(
      "validation/master-validation-173646937",
    );
    const metadata = JSON.parse(
      args
        .find((arg) => arg.startsWith("metadata="))!
        .slice("metadata=".length),
    );
    expect(metadata).toMatchObject({
      purpose: "master-validation-campaign",
      campaignBaseCommit: "main123",
    });
  });

  test("finds an active matching cycle and ignores completed or unrelated runs", () => {
    expect(
      activeMasterValidationRun([
        {
          id: 12,
          status: "completed",
          sourceBranch: "refs/heads/main",
          templateParameters: parameters,
        },
        {
          id: 13,
          status: "inProgress",
          sourceBranch: "refs/heads/dev",
          templateParameters: parameters,
        },
        {
          id: 14,
          status: "inProgress",
          sourceBranch: "refs/heads/main",
          sourceVersion: "abc123",
          templateParameters: parameters,
        },
      ]),
    ).toMatchObject({ id: 14, sourceVersion: "abc123" });
  });

  test("treats a campaign run as the same aggregate lane", () => {
    expect(
      activeMasterValidationRun([
        {
          id: 15,
          status: "inProgress",
          sourceBranch: "refs/heads/validation/master-validation-173646937",
          templateParameters: {
            feature_set: "master-validation",
            target: "staging",
            metadata: JSON.stringify({
              purpose: "master-validation-campaign",
            }),
          },
        },
      ]),
    ).toMatchObject({ id: 15 });
  });

  test("uses the next five-minute pulse to recover a red campaign", () => {
    expect(nextCampaignPulseCondition(12_600_042)).toEqual({
      id: "master-validation-campaign-pulse-after-42-12600042",
      type: "project.task.tick",
      subject: "task:master-validation-staging-cycle",
      expected: {
        reason: "master-validation-campaign-reconcile",
        pulse: { gt: 42 },
        timestamp: { gte: 12_600_042 },
      },
    });
  });

  test("keeps only the newest active focused PR per stable task", () => {
    expect(
      latestCampaignFixes([
        {
          pullRequestId: "16572555",
          taskId:
            "domain/master-validation-failure/spec.example/85f37b9efc359c5ea74b",
          sourceBranch: "task/spec-example-old",
          sourceCommit: "older",
          title: "Older focused fix",
        },
        {
          pullRequestId: "16572663",
          taskId:
            "domain/master-validation-failure/spec.example/85f37b9efc359c5ea74b",
          sourceBranch: "task/spec-example-new",
          sourceCommit: "newer",
          title: "Replacement focused fix",
        },
        {
          pullRequestId: "16570000",
          taskId: "pull-request/16570000",
          sourceBranch: "fix/master-validation-bootstrap",
          sourceCommit: "bootstrap",
          title: "Independent bootstrap fix",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        pullRequestId: "16570000",
        sourceCommit: "bootstrap",
      }),
      expect.objectContaining({
        pullRequestId: "16572663",
        sourceCommit: "newer",
      }),
    ]);
  });

  test("publishes only fixes proven by an exact campaign spec pass", () => {
    const campaign = {
      schemaVersion: "1" as const,
      baselineRunId: "100",
      baseCommit: "base",
      branch: "validation/master-validation-100",
      currentCommit: "candidate",
      integratedFixes: [
        {
          pullRequestId: "7",
          taskId: "domain/master-validation-failure/spec.example/fp",
          sourceBranch: "task/example",
          sourceCommit: "fix",
          title: "fix example",
        },
      ],
      updatedAt: "2026-07-25T00:00:00Z",
    };
    const event = {
      type: "pipeline.spec.observed",
      data: {
        specId: "spec.example",
        status: "pass",
        pipelineRunId: "101",
        sourceBranch: "refs/heads/validation/master-validation-100",
        sourceCommit: "candidate",
      },
    };
    expect(verifiedCampaignFixPullRequestIds(campaign, event)).toEqual(["7"]);
    expect(
      verifiedCampaignFixPullRequestIds(campaign, {
        ...event,
        data: { ...event.data, sourceCommit: "older-candidate" },
      }),
    ).toEqual([]);
    expect(
      fixVerificationTrigger(`
## Trigger Event
${JSON.stringify({
  type: "project.task.tick",
  data: {
    reason: "master-validation-fix-verified",
    specId: "spec.example",
    pipelineRunId: "101",
    sourceBranch: "validation/master-validation-100",
    sourceCommit: "candidate",
    pullRequestIds: ["7"],
  },
})}
`),
    ).toEqual({
      specId: "spec.example",
      pipelineRunId: "101",
      sourceBranch: "validation/master-validation-100",
      sourceCommit: "candidate",
      pullRequestIds: ["7"],
    });
  });

  test("calls a proven non-draft fix review-ready without claiming repository approval", () => {
    const content = verifiedFixNotificationContent({
      specId: "spec.example",
      pipelineRunId: "101",
      pullRequestIds: ["7"],
    });
    expect(content).toContain("Published review-ready PR(s): 7.");
    expect(content).toContain("approvals or policies may still remain");
    expect(content).not.toContain("merge-ready");
  });

  test("retries an unchanged red campaign every six hours", () => {
    const queuedAt = "2026-07-25T00:00:00.000Z";
    expect(
      campaignRecoveryDue(queuedAt, Date.parse("2026-07-25T05:59:59.999Z")),
    ).toBe(false);
    expect(
      campaignRecoveryDue(queuedAt, Date.parse("2026-07-25T06:00:00.000Z")),
    ).toBe(true);
    expect(campaignRecoveryDue("not-a-date")).toBe(false);
  });

  test("classifies transient Azure DevOps git failures for wait-based retry", () => {
    expect(
      transientMasterValidationAccessFailure(
        "fatal: unable to access 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner/': The requested URL returned error: 503",
      ),
    ).toBe(true);
    expect(
      transientMasterValidationAccessFailure(
        "Campaign branch validation/master-validation-173646937 no longer descends from frozen base 13c01777a8a0c0e4965304e5e44c009ed5c6f9bc",
      ),
    ).toBe(false);
    expect(
      transientMasterValidationAccessFailure(
        "AADSTS9002313: Invalid request. Interactive authentication is needed. fatal: could not read Username",
      ),
    ).toBe(true);
  });

  test("converges only after a passing full validation result", () => {
    expect(completedCycleState("succeeded")).toBe("converged");
    expect(completedCycleState("failed")).toBe("waiting");
    expect(completedCycleState("canceled")).toBe("waiting");
    expect(completedCycleState("unknown")).toBe("waiting");
  });

  test("uses one stable sibling identity for the same spec failure", () => {
    const event = {
      type: "pipeline.failure.observed",
      target: { project: "aks-rp-e2e" },
      data: {
        project: "aks-rp-e2e",
        pipelineRunId: "123",
        specId: "spec.example",
        status: "fail",
        category: "implementation",
        reason: "assertion failed",
        failureFingerprint: "same-fingerprint",
        artifactPath: "/tmp/result.json",
        sourceBranch: "main",
        sourceCommit: "abc123",
      },
    };
    const first = resolveAksTask(event);
    const second = resolveAksTask({
      ...event,
      data: { ...event.data, pipelineRunId: "456" },
    });
    expect(first?.id).toBe(second?.id);
    expect(first).toMatchObject({
      parentId: "group/domain-work",
      owner: "aks-explorer",
      workflow: "master-validation-failure",
      input: {
        validationTaskId: "master-validation-staging-cycle",
        sourceBranch: "main",
      },
    });
  });

  test("routes an aggregate no-verdict failure as pipeline repair", () => {
    expect(
      resolveAksTask({
        type: "pipeline.failure.observed",
        target: { project: "aks-rp-e2e" },
        data: {
          pipelineRunId: "173694325",
          specId: "pipeline.master-validation.bootstrap",
          status: "error",
          category: "pipeline_failure",
          reason: "no spec verdict",
          failureFingerprint: "bootstrap-fingerprint",
          artifactPath: "ado://build/173694325",
          sourceBranch: "refs/heads/validation/master-validation-173646937",
          sourceCommit: "candidate123",
        },
      }),
    ).toMatchObject({
      workflow: "master-validation-failure",
      input: { failureScope: "pipeline" },
      acceptance: [
        expect.stringContaining("failed Azure pipeline step"),
        expect.stringContaining("focused PR"),
        expect.stringContaining("campaign"),
        expect.stringContaining("current main passes"),
      ],
    });
  });
});

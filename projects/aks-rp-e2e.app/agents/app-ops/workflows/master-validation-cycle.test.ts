import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveAksTask,
  verifiedCampaignFixPullRequestIds,
} from "../../../app.js";
import {
  activeMasterValidationRun,
  buildMasterValidationQueueArgs,
  campaignBaselineIsCurrent,
  campaignIntegratedFixesMerged,
  campaignPatchConflict,
  campaignPatchConflictRepairWake,
  campaignRecoveryDue,
  completedCycleState,
  currentMainCampaignSuccessorInput,
  fixVerificationTrigger,
  latestCampaignFixes,
  registerMasterValidationRun,
  resolveCurrentMain,
  transientMasterValidationAccessFailure,
  verifiedFixNotificationContent,
} from "./master-validation-cycle.js";

const parameters = {
  feature_set: "master-validation",
  target: "staging",
  metadata: JSON.stringify({ purpose: "scheduled-master-validation" }),
};

describe("master-validation cycle", () => {
  test("refreshes the remote-tracking main ref before resolving current main", () => {
    const root = mkdtempSync(join(tmpdir(), "master-validation-current-main-"));
    const remote = join(root, "remote.git");
    const publisher = join(root, "publisher");
    const consumer = join(root, "consumer");
    const git = (cwd: string, ...args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    try {
      git(root, "init", "--bare", remote);
      git(root, "init", "-b", "main", publisher);
      git(publisher, "config", "user.name", "Validation Test");
      git(publisher, "config", "user.email", "validation@example.test");
      writeFileSync(join(publisher, "proof.txt"), "first\n");
      git(publisher, "add", "proof.txt");
      git(publisher, "commit", "-m", "first");
      git(publisher, "remote", "add", "origin", remote);
      git(publisher, "push", "-u", "origin", "main");
      git(root, "clone", remote, consumer);
      git(consumer, "checkout", "main");
      const first = git(consumer, "rev-parse", "origin/main");

      writeFileSync(join(publisher, "proof.txt"), "second\n");
      git(publisher, "commit", "-am", "second");
      git(publisher, "push", "origin", "main");
      const second = git(publisher, "rev-parse", "HEAD");

      expect(first).not.toBe(second);
      expect(git(consumer, "rev-parse", "origin/main")).toBe(first);
      expect(resolveCurrentMain(consumer)).toBe(second);
      expect(git(consumer, "rev-parse", "origin/main")).toBe(second);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

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

  test("registers queued master-validation runs for watcher observation", () => {
    const appDir = mkdtempSync(join(tmpdir(), "master-validation-watch-"));
    try {
      const registration = registerMasterValidationRun(appDir, "174851380");
      expect(registration).toMatchObject({
        changed: true,
        runIds: ["174851380"],
      });
      expect(
        JSON.parse(
          readFileSync(
            join(
              appDir,
              ".state",
              "watchers",
              "aks-pipeline-registrations.json",
            ),
            "utf8",
          ),
        ),
      ).toMatchObject({ runIds: ["174851380"] });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
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

  test("publishes only a fix proven at the exact focused PR head", () => {
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
        {
          pullRequestId: "8",
          taskId: "domain/master-validation-failure/spec.example",
          sourceBranch: "task/example-stable",
          sourceCommit: "stable-fix",
          title: "stable fix example",
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
    expect(verifiedCampaignFixPullRequestIds(campaign, event)).toEqual([]);
    expect(
      verifiedCampaignFixPullRequestIds(campaign, {
        ...event,
        data: {
          ...event.data,
          sourceBranch: "refs/heads/task/example",
          sourceCommit: "fix",
        },
      }),
    ).toEqual(["7"]);
    expect(
      fixVerificationTrigger(`
## Trigger Event
${JSON.stringify({
  type: "project.task.tick",
  data: {
    reason: "master-validation-fix-verified",
    specId: "spec.example",
    pipelineRunId: "101",
    sourceBranch: "task/example",
    sourceCommit: "fix",
    pullRequestIds: ["7"],
  },
})}
`),
    ).toEqual({
      specId: "spec.example",
      pipelineRunId: "101",
      sourceBranch: "task/example",
      sourceCommit: "fix",
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

  test("moves to current main when every campaign fix already merged", () => {
    expect(
      campaignIntegratedFixesMerged([
        { state: "completed", mergeStatus: "succeeded" },
        { state: "completed", mergeStatus: "succeeded" },
      ]),
    ).toBe(true);
    expect(
      campaignIntegratedFixesMerged([
        { state: "completed", mergeStatus: "succeeded" },
        { state: "active", mergeStatus: "succeeded" },
      ]),
    ).toBe(false);
    expect(campaignIntegratedFixesMerged([])).toBe(false);
  });

  test("detects when a frozen campaign baseline is stale", () => {
    expect(
      campaignBaselineIsCurrent({ baseCommit: "frozen-main" }, "current-main"),
    ).toBe(false);
    expect(
      campaignBaselineIsCurrent({ baseCommit: "current-main" }, "current-main"),
    ).toBe(true);
  });

  test("carries isolated fixes onto a current-main successor without rediscovery", () => {
    const priorFix = {
      pullRequestId: "31",
      taskId: "domain/master-validation-failure/spec.example",
      sourceBranch: "task/spec-example",
      sourceCommit: "old-head",
      title: "Example repair",
    };
    const updatedFix = { ...priorFix, sourceCommit: "new-head" };
    const successor = currentMainCampaignSuccessorInput(
      {
        schemaVersion: "1",
        baselineRunId: "100",
        baseCommit: "old-main",
        branch: "validation/master-validation-100",
        currentCommit: "old-candidate",
        integratedFixes: [priorFix],
        updatedAt: "2026-08-08T00:00:00.000Z",
      },
      "abcdef1234567890",
      [updatedFix],
    );

    expect(successor).toEqual({
      baselineRunId: "main-abcdef123456",
      baseCommit: "abcdef1234567890",
      fixes: [updatedFix],
      preferredPullRequestIds: ["31"],
    });
  });

  test("drops a campaign fix from a current-main successor after its PR closes", () => {
    const mergedFix = {
      pullRequestId: "31",
      taskId: "domain/master-validation-failure/spec.example",
      sourceBranch: "task/spec-example",
      sourceCommit: "merged-head",
      title: "Example repair",
    };
    const successor = currentMainCampaignSuccessorInput(
      {
        schemaVersion: "1",
        baselineRunId: "100",
        baseCommit: "old-main",
        branch: "validation/master-validation-100",
        currentCommit: "old-candidate",
        integratedFixes: [mergedFix],
        updatedAt: "2026-08-08T00:00:00.000Z",
      },
      "abcdef1234567890",
      [],
    );

    expect(successor).toEqual({
      baselineRunId: "main-abcdef123456",
      baseCommit: "abcdef1234567890",
      fixes: [],
      preferredPullRequestIds: ["31"],
    });
  });

  test("routes a focused patch conflict back to its stable failure task", () => {
    const conflict = campaignPatchConflict(
      "Campaign focused-patch conflict for PR 16679314 (domain/master-validation-failure/spec.example) at b31a12c37eddb7d68efff1bbc58d6344dcff95f4: error: could not apply patch",
    );
    expect(conflict).toEqual({
      pullRequestId: "16679314",
      taskId: "domain/master-validation-failure/spec.example",
      sourceCommit: "b31a12c37eddb7d68efff1bbc58d6344dcff95f4",
      pullRequestSourceCommit: "b31a12c37eddb7d68efff1bbc58d6344dcff95f4",
      composedPredecessors: [],
    });
    expect(
      campaignPatchConflictRepairWake(
        conflict!,
        {
          schemaVersion: "1",
          baselineRunId: "175425349",
          baseCommit: "current-main",
          branch: "validation/master-validation-175425349",
          currentCommit: "campaign-head",
          integratedFixes: [],
          updatedAt: "2026-08-06T10:00:00.000Z",
        },
        "current-main",
      ),
    ).toMatchObject({
      target: {
        project: "aks-rp-e2e",
        taskId: "domain/master-validation-failure/spec.example",
      },
      reason: "repair-focused-patch-after-frozen-campaign-conflict",
      overrideWait: true,
      pullRequestId: "16679314",
      campaignSourceCommit: "campaign-head",
      currentMainCommit: "current-main",
      sourceCommit: "b31a12c37eddb7d68efff1bbc58d6344dcff95f4",
      campaignCompositionCommits: [],
      campaignCompositionBaseCommit: "campaign-head",
      campaignCompositionKind: "frozen-campaign",
    });

    expect(
      campaignPatchConflictRepairWake(
        conflict!,
        {
          schemaVersion: "1",
          baselineRunId: "175425349",
          baseCommit: "old-main",
          branch: "validation/master-validation-175425349",
          currentCommit: "frozen-candidate",
          integratedFixes: [],
          updatedAt: "2026-08-06T10:00:00.000Z",
        },
        "new-main",
      ),
    ).toMatchObject({
      campaignSourceCommit: "new-main",
      campaignCompositionBaseCommit: "new-main",
      campaignCompositionKind: "current-main-successor",
      currentMainCommit: "new-main",
    });
    expect(
      campaignPatchConflict(
        "Campaign focused-patch conflict for PR 16679314 (domain/master-validation-failure/spec.example) at b31a12c37eddb7d68efff1bbc58d6344dcff95f4 from PR head c42b23d48feec8e79f0012ccd69e7455ed00a605: error: could not apply patch",
      ),
    ).toEqual({
      pullRequestId: "16679314",
      taskId: "domain/master-validation-failure/spec.example",
      sourceCommit: "b31a12c37eddb7d68efff1bbc58d6344dcff95f4",
      pullRequestSourceCommit: "c42b23d48feec8e79f0012ccd69e7455ed00a605",
      composedPredecessors: [],
    });
    expect(
      campaignPatchConflict(
        "Campaign focused-patch conflict for PR 16679314 (domain/master-validation-failure/spec.example) at b31a12c37eddb7d68efff1bbc58d6344dcff95f4 from PR head c42b23d48feec8e79f0012ccd69e7455ed00a605 after composed predecessors a127f2da30731e9a697cc238d06d644224240215,c51bd3a26eda4dafe98ec68b57b24a414e900858: error: could not apply patch",
      ),
    ).toMatchObject({
      composedPredecessors: [
        "a127f2da30731e9a697cc238d06d644224240215",
        "c51bd3a26eda4dafe98ec68b57b24a414e900858",
      ],
    });
    expect(campaignPatchConflict("Azure DevOps returned 503")).toBeNull();
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

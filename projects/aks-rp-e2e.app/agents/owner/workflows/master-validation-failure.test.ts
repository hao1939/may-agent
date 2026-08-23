import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AppEvent,
  ExecutionResult,
  WorkflowContext,
} from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  admissionReportRequiresStandaloneVerification,
  advancedCampaignRepairPullRequest,
  alignCleanRepairWorkspace,
  alreadyRepairedTestIssueEvidence,
  alreadyRepairedTestIssueProblem,
  boundedChangedFileEvidence,
  boundedEvidence,
  canonicalTaskPullRequest,
  campaignRepairPullRequestDescription,
  campaignRepairPublicationRetryReady,
  campaignRepairReplayObservation,
  campaignRepairReady,
  changedFilesMayAffectSpec,
  currentObservationShowsNoRepairNeeded,
  currentRecoveryBaselineRunId,
  execute,
  failureInvestigationClassificationGuidance,
  generatedSharedFixtureSetupDefect,
  frozenCampaignBaseForFailure,
  hasPreparedRepair,
  inconclusiveWait,
  legacyRecoveryChildren,
  latestPassingRecoveryObservation,
  masterValidationFocusedFixWake,
  nestedWorkflowOutput,
  observationAppliesToCurrentMain,
  parseFailureInput,
  passingRecoveryObservation,
  priorProductClassification,
  preserveVerificationAfterNestedReconciliation,
  priorStandaloneVerification,
  rejectedTaskPullRequest,
  productIssueDisposition,
  productRecoveryCondition,
  publishCampaignRepairBranch,
  pullRequestReviewTrigger,
  requestedStandaloneVerification,
  requiresStandaloneVerification,
  runFailureInvestigation,
  shouldDelegateStandaloneRecovery,
  shouldReconcileTestFix,
  standaloneRecoveryChild,
  standaloneRecoveryChildAction,
  standaloneRecoveryCompletionProblem,
  startupRecoveryFreshnessReview,
  testIssueReconciliationOptions,
  unpublishedTaskRepairReady,
  workspace,
} from "./master-validation-failure.js";
import { resumedPreparationDecision } from "./spec-live-reconciliation.js";

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `git ${args.join(" ")} failed`,
    );
  }
  return result.stdout.trim();
}

type TestContextOptions = {
  task?: string;
  input?: unknown;
  taskId?: string;
  generation?: number;
  trigger?: AppEvent<Record<string, unknown>>;
  appDir?: string;
  projectDir?: string;
  workspaceDir?: string;
  runAgent?: (
    agent: string,
    prompt: string,
    options?: Record<string, unknown>,
  ) => Promise<{
    status: "success" | "done" | "blocked" | "error" | "interrupted";
    structuredResult?: unknown;
  }>;
  dispatchEvent?: (type: string, data: Record<string, unknown>) => void;
};

function taskEnvelope(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return {};
  const candidate = raw.slice(marker).split("\n").slice(1).join("\n");
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function workflowContext(options: TestContextOptions = {}): WorkflowContext {
  const envelope = taskEnvelope(options.task);
  const input = options.input ?? envelope.input ?? {};
  const children =
    envelope.children &&
    typeof envelope.children === "object" &&
    !Array.isArray(envelope.children)
      ? (envelope.children as Record<string, unknown>)
      : {};
  const runAgent = options.runAgent;
  const callAgent = runAgent
    ? ((async (agent, prompt, callOptions): Promise<ExecutionResult> => {
        const result = await runAgent(agent, prompt, callOptions);
        const status = result.status === "success" ? "done" : result.status;
        return {
          id: "s_master_validation_failure_test",
          kind: "agent",
          status,
          summary: status,
          ...(result.structuredResult !== undefined
            ? { output: result.structuredResult }
            : {}),
        };
      }) as WorkflowContext["agents"]["call"])
    : undefined;
  return createTestAppWorkflowContext({
    input,
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId:
        options.taskId ??
        (typeof envelope.taskId === "string"
          ? envelope.taskId
          : "domain/master-validation-failure/spec.example/fp"),
      generation:
        options.generation ??
        (typeof envelope.generation === "number" ? envelope.generation : 1),
      resourceVersion: 1,
      agent: "aks-explorer",
      mode: "achieve",
      outcome: "Resolve the master-validation failure.",
      acceptance: [],
      input,
      children: {
        live: Array.isArray(children.live) ? (children.live as never[]) : [],
        completed: Array.isArray(children.completed)
          ? (children.completed as never[])
          : [],
      },
      events: {
        items: options.trigger
          ? [
              {
                observedAt: "2026-08-21T00:00:00.000Z",
                event: options.trigger,
              },
            ]
          : [],
        truncated: false,
      },
    },
    ...(callAgent ? { callAgent } : {}),
    ...(options.dispatchEvent
      ? {
          emit: async (event: AppEvent) => {
            options.dispatchEvent!(
              event.type,
              event.data as Record<string, unknown>,
            );
          },
        }
      : {}),
    workspace: {
      appRoot: options.appDir ?? "/tmp/master-validation-failure-test-app",
      projectRoot: options.projectDir ?? "/app/projects/aks-rp-e2e",
      root:
        options.workspaceDir ?? "/app/worktrees/master-validation-failure-test",
      output: "/tmp/master-validation-failure-test-output",
    },
    executionId: "wf_master_validation_failure_test",
  });
}

describe("master-validation failure workflow", () => {
  test("routes s_1786458984860_47 startup recovery through the persisted freshness-only decision before investigation", () => {
    const root = mkdtempSync(
      join(tmpdir(), "master-validation-startup-resume-"),
    );
    try {
      const taskId =
        "domain/master-validation-failure/spec.traffic-azure-service-mesh.master-validation-functionality-istiocni-azurelinux";
      const sourceCommit = "f12eccd60e60ddb96e4cae6eaf01bdbdf4d806d0";
      const handoffPath = join(
        root,
        "preparation-head-correction-a132dc3688.json",
      );
      const findingsPath = join(
        root,
        "preparation-head-correction-a132dc3688.findings.json",
      );
      const currentContextPath = join(root, "current-context.json");
      writeFileSync(
        currentContextPath,
        JSON.stringify({
          taskId,
          sourceCommit,
          phase: "preparation-head-correction-a132dc3688",
          handoffPath,
        }),
      );
      writeFileSync(
        findingsPath,
        JSON.stringify({
          taskId,
          sourceCommit,
          phase: "preparation-head-correction-a132dc3688",
          review: {
            decision: "test-current",
            liveReady: true,
            liveTarget: "staging",
            condition: null,
          },
        }),
      );
      const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId,
  generation: 5,
  input: {
    specId:
      "spec.traffic-azure-service-mesh.master-validation-functionality-istiocni-azurelinux",
    pipelineRunId: "176113842",
    failureFingerprint: "8435119a137582d4630d",
    startupRecoveryResume: {
      currentContextPath,
      findingsPath,
      interruptedSessionId: "s_1786458984860_47",
      interruptedWorkflowRunId: "wr_1786457571551_v1a9",
      preparedSourceCommit: sourceCommit,
      requiredDecision: "test-current",
      requiredLiveReady: true,
      requiredTarget: "staging",
      reviewScope:
        "Freshness-only review of current-context and persisted findings; do not repeat broad research.",
    },
  },
})}
`)!;
      const review = startupRecoveryFreshnessReview(input)!;
      expect(review).toMatchObject({ sourceCommit });
      expect(review.evidence).toEqual(
        expect.arrayContaining([
          "startup-recovery-interrupted-session:s_1786458984860_47",
          "startup-recovery-interrupted-workflow-run:wr_1786457571551_v1a9",
          `startup-recovery-prepared-source:${sourceCommit}`,
          "startup-recovery-decision:test-current",
          "startup-recovery-live-ready:true",
          "startup-recovery-target:staging",
          "startup-recovery-review-scope:freshness-only",
        ]),
      );
      const options = testIssueReconciliationOptions("176113842", review);
      expect(resumedPreparationDecision(options, sourceCommit)).toMatchObject({
        decision: "test-current",
        liveReady: true,
        evidence: expect.arrayContaining(["freshness-only-resume:accepted"]),
      });
      expect(options.preparationResume).toEqual(review);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("resumes a clean task-owned repair without legacy child state", () => {
    expect(
      unpublishedTaskRepairReady({
        headCommit: "repair-head",
        repairBaseCommit: "current-main",
        workspaceClean: true,
      }),
    ).toBe(true);
    expect(
      unpublishedTaskRepairReady({
        headCommit: "repair-head",
        repairBaseCommit: "current-main",
        workspaceClean: false,
      }),
    ).toBe(false);
    expect(
      unpublishedTaskRepairReady({
        headCommit: "current-main",
        repairBaseCommit: "current-main",
        workspaceClean: true,
      }),
    ).toBe(false);
  });

  test("treats invalid generated shared-fixture requests as test issues", () => {
    expect(failureInvestigationClassificationGuidance).toContain(
      "A shared-fixture setup failure is test_issue",
    );
    expect(failureInvestigationClassificationGuidance).toContain(
      "Do not label an invalid generated setup request as a product issue",
    );
    expect(failureInvestigationClassificationGuidance).not.toContain(
      "including shared cluster setup before feature assertions",
    );
    expect(
      generatedSharedFixtureSetupDefect({
        reason:
          'Shared cluster setup failed: HTTP 400 {"code":"OnlySupportedOnUserAssignedMSICluster"}',
      }),
    ).toBe(true);
    expect(
      generatedSharedFixtureSetupDefect({
        reason: "Managed cluster update remained stuck in Updating.",
      }),
    ).toBe(false);
  });

  test("declares a main-based task worktree", () => {
    expect(workspace).toEqual({ kind: "task", baseBranch: "main" });
  });

  test("treats aggregate source identity as observation provenance during test repair", () => {
    expect(testIssueReconciliationOptions("run-123")).toEqual({
      targetBranch: "main",
      existingRecoveryAfterRunId: "run-123",
      reusePriorIntegratedProof: true,
      inputSourceIsObservation: true,
    });
  });

  test("published focused fixes explicitly wake the campaign through its open run wait", () => {
    expect(
      masterValidationFocusedFixWake(
        "16727776",
        "462f7fd259930f0ffa54c1cd5ae73728f3a763c8",
      ),
    ).toEqual({
      target: {
        project: "aks-rp-e2e",
        taskId: "master-validation-staging-cycle",
      },
      project: "aks-rp-e2e",
      taskId: "master-validation-staging-cycle",
      task_id: "master-validation-staging-cycle",
      action: "master-validation-cycle",
      reason: "master-validation-focused-fix-published",
      pullRequestId: "16727776",
      sourceCommit: "462f7fd259930f0ffa54c1cd5ae73728f3a763c8",
      overrideWait: true,
    });
  });

  test("detects targeted PR review-change wakes for the existing focused repair", () => {
    expect(
      pullRequestReviewTrigger(
        {
          type: "pull-request.state",
          data: {
            pullRequestId: "16692153",
            unresolvedReviewCount: 2,
            reviewFingerprint: "df13be91ae2f50be",
          },
        },
        "16692153",
      ),
    ).toEqual({
      pullRequestId: "16692153",
      unresolvedReviewCount: 2,
      reviewFingerprint: "df13be91ae2f50be",
    });
    expect(
      pullRequestReviewTrigger(
        {
          type: "pull-request.state",
          data: {
            pullRequestId: "16692153",
            unresolvedReviewCount: 2,
          },
        },
        "16692154",
      ),
    ).toBeNull();
  });

  test("turns a frozen-campaign conflict wake into same-lineage repair context", () => {
    expect(
      campaignRepairReplayObservation(`
## Trigger Event
${JSON.stringify({
  type: "project.task.tick",
  data: {
    reason: "repair-focused-patch-after-frozen-campaign-conflict",
    requiredAction: "Rewrite the existing focused patch for frozen replay.",
    pullRequestId: "16692093",
    campaignSourceCommit: "campaign-head",
    currentMainCommit: "main-head",
    sourceCommit: "old-pr-head",
    sourceEquivalentCommits: ["fix-a", "fix-b"],
    campaignCompositionCommits: ["prior-fix-a", "prior-fix-b"],
    conflictingPaths: ["features/example.test.ts"],
  },
})}
`),
    ).toEqual({
      reason: "Rewrite the existing focused patch for frozen replay.",
      pullRequestId: "16692093",
      campaignSourceCommit: "campaign-head",
      currentMainCommit: "main-head",
      sourceEquivalentCommits: ["fix-a", "fix-b"],
      campaignCompositionCommits: ["prior-fix-a", "prior-fix-b"],
      conflictingPaths: ["features/example.test.ts"],
      expectedRemoteCommit: "old-pr-head",
    });
  });

  test("reuses a clean task-owned repair after a guarded publication retry", () => {
    expect(
      campaignRepairPublicationRetryReady({
        headCommit: "repaired-head",
        repairBaseCommit: "current-main",
        expectedRemoteCommit: "prior-pr-head",
        workspaceClean: true,
      }),
    ).toBe(true);
    expect(
      campaignRepairPublicationRetryReady({
        headCommit: "prior-pr-head",
        repairBaseCommit: "current-main",
        expectedRemoteCommit: "prior-pr-head",
        workspaceClean: true,
      }),
    ).toBe(false);
    expect(
      campaignRepairPublicationRetryReady({
        headCommit: "repaired-head",
        repairBaseCommit: "current-main",
        expectedRemoteCommit: "prior-pr-head",
        workspaceClean: false,
      }),
    ).toBe(false);
  });

  test("hands an already-advanced canonical PR back to campaign verification", () => {
    const replay = {
      reason: "Repair the frozen-campaign conflict.",
      conflictingPaths: [],
      campaignCompositionCommits: [],
      sourceEquivalentCommits: [],
      campaignSourceCommit: "campaign-head",
      currentMainCommit: "main-head",
      pullRequestId: "16712127",
      expectedRemoteCommit: "stale-pr-head",
    };
    expect(
      advancedCampaignRepairPullRequest(replay, {
        pullRequestId: "16712127",
        status: "active",
        lastMergeSourceCommit: { commitId: "repaired-pr-head" },
      }),
    ).toEqual({
      pullRequestId: "16712127",
      sourceCommit: "repaired-pr-head",
    });
    expect(
      advancedCampaignRepairPullRequest(replay, {
        pullRequestId: "16712127",
        lastMergeSourceCommit: { commitId: "stale-pr-head" },
      }),
    ).toBeNull();
    expect(
      advancedCampaignRepairPullRequest(replay, {
        pullRequestId: "different-pr",
        lastMergeSourceCommit: { commitId: "repaired-pr-head" },
      }),
    ).toBeNull();
  });

  test("uses guarded history rewrite for an intentional replay-safe PR update", () => {
    const root = mkdtempSync(
      join(tmpdir(), "master-validation-publish-rewrite-"),
    );
    const remote = join(root, "remote.git");
    const workspace = join(root, "workspace");
    try {
      mkdirSync(remote, { recursive: true });
      git(remote, "init", "--bare");
      git(root, "init", workspace);
      git(workspace, "config", "user.name", "Repair Test");
      git(workspace, "config", "user.email", "repair@example.test");
      writeFileSync(join(workspace, "task.txt"), "old\n");
      git(workspace, "add", "task.txt");
      git(workspace, "commit", "-m", "old head");
      const oldHead = git(workspace, "rev-parse", "HEAD");
      git(workspace, "remote", "add", "origin", remote);
      git(workspace, "push", "origin", "HEAD:refs/heads/task/repair");
      git(workspace, "reset", "--hard", "HEAD~0");
      writeFileSync(join(workspace, "task.txt"), "rewritten\n");
      git(workspace, "commit", "-am", "rewritten head");
      const rewrittenHead = git(workspace, "rev-parse", "HEAD");

      const result = publishCampaignRepairBranch(
        workspace,
        "task/repair",
        undefined,
        { rewriteExpectedRemoteCommit: oldHead },
      );
      expect(result).toMatchObject({
        state: "published",
        sourceCommit: rewrittenHead,
        evidence: [
          `task-branch-replay-rewrite:task/repair:${oldHead}->${rewrittenHead}`,
        ],
      });
      expect(
        git(workspace, "ls-remote", "origin", "refs/heads/task/repair").split(
          /\s+/,
        )[0],
      ).toBe(rewrittenHead);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps a pipeline bootstrap issue on the moving campaign without waiting for merge", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "master-validation-pipeline-recovery-"),
    );
    try {
      mkdirSync(join(appDir, ".state"), { recursive: true });
      writeFileSync(
        join(appDir, ".state/master-validation-campaign.json"),
        JSON.stringify({
          baselineRunId: "100",
          branch: "validation/master-validation-100",
          currentCommit: "candidate-new",
        }),
      );
      writeFileSync(
        join(appDir, ".state/master-validation-cycle.json"),
        JSON.stringify({
          purpose: "master-validation-campaign",
          runId: "102",
        }),
      );
      const taskId =
        "domain/master-validation-failure/pipeline.master-validation.bootstrap/fp";
      const ctx = workflowContext({
        appDir,
        projectDir: "/repo",
        workspaceDir: "/workspace",
        task: `## Reconciliation Task\n${JSON.stringify({
          taskId,
          generation: 1,
          input: {
            specId: "pipeline.master-validation.bootstrap",
            pipelineRunId: "101",
            failureFingerprint: "fp",
            sourceCommit: "candidate-old",
          },
        })}`,
      });
      expect(await execute(ctx)).toMatchObject({
        status: "done",
        output: {
          state: "waiting",
          conditions: [
            {
              type: "project.task.tick",
              subject: `task:${taskId}`,
              expected: {
                reason: "master-validation-main-passed",
                campaignBaselineRunId: "100",
              },
            },
          ],
        },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("aligns a clean failure workspace to current main for a mergeable PR", () => {
    const root = mkdtempSync(join(tmpdir(), "master-validation-repair-base-"));
    try {
      git(root, "init");
      git(root, "config", "user.name", "Repair Test");
      git(root, "config", "user.email", "repair@example.test");
      git(root, "commit", "--allow-empty", "-m", "frozen base");
      const frozenBase = git(root, "rev-parse", "HEAD");
      git(root, "commit", "--allow-empty", "-m", "newer main");
      const currentMain = git(root, "rev-parse", "HEAD");
      git(root, "branch", "-M", "main");
      git(root, "update-ref", "refs/remotes/origin/main", currentMain);
      git(root, "checkout", "-b", "task/repair", frozenBase);

      expect(
        alignCleanRepairWorkspace({
          workspaceDir: root,
          targetRef: "origin/main",
          repairBaseCommit: currentMain,
        }),
      ).toBe(currentMain);
      expect(git(root, "rev-parse", "HEAD")).toBe(currentMain);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reconciles same-task branch history before publishing a focused campaign repair", () => {
    const root = mkdtempSync(
      join(tmpdir(), "master-validation-publish-merge-"),
    );
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const workspace = join(root, "workspace");
    try {
      mkdirSync(remote, { recursive: true });
      git(remote, "init", "--bare");

      mkdirSync(seed, { recursive: true });
      git(seed, "init");
      git(seed, "config", "user.name", "Repair Test");
      git(seed, "config", "user.email", "repair@example.test");
      writeFileSync(join(seed, "task.txt"), "base\n");
      git(seed, "add", "task.txt");
      git(seed, "commit", "-m", "base");
      git(seed, "remote", "add", "origin", remote);
      git(seed, "push", "origin", "HEAD:refs/heads/master");
      git(seed, "push", "origin", "HEAD:refs/heads/task/repair");

      git(seed, "checkout", "-b", "task/repair");
      writeFileSync(join(seed, "remote.txt"), "remote\n");
      git(seed, "add", "remote.txt");
      git(seed, "commit", "-m", "remote update");
      git(seed, "push", "origin", "HEAD:refs/heads/task/repair");

      git(root, "clone", remote, workspace);
      git(workspace, "config", "user.name", "Repair Test");
      git(workspace, "config", "user.email", "repair@example.test");
      git(workspace, "checkout", "-b", "task/repair", "origin/task/repair~1");
      writeFileSync(join(workspace, "local.txt"), "local\n");
      git(workspace, "add", "local.txt");
      git(workspace, "commit", "-m", "local update");

      const result = publishCampaignRepairBranch(workspace, "task/repair");
      expect(result.state).toBe("published");
      expect(
        result.evidence.some((entry) =>
          entry.startsWith("task-branch-non-fast-forward:task/repair@"),
        ),
      ).toBe(true);
      expect(
        git(
          workspace,
          "merge-base",
          "--is-ancestor",
          "origin/task/repair",
          "HEAD",
        ),
      ).toBe("");
      expect(
        git(workspace, "ls-remote", "origin", "refs/heads/task/repair").split(
          /\s+/,
        )[0],
      ).toBe(git(workspace, "rev-parse", "HEAD"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("surfaces same-task branch conflicts during focused campaign publication", () => {
    const root = mkdtempSync(
      join(tmpdir(), "master-validation-publish-conflict-"),
    );
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const workspace = join(root, "workspace");
    try {
      mkdirSync(remote, { recursive: true });
      git(remote, "init", "--bare");

      mkdirSync(seed, { recursive: true });
      git(seed, "init");
      git(seed, "config", "user.name", "Repair Test");
      git(seed, "config", "user.email", "repair@example.test");
      writeFileSync(join(seed, "task.txt"), "base\n");
      git(seed, "add", "task.txt");
      git(seed, "commit", "-m", "base");
      git(seed, "remote", "add", "origin", remote);
      git(seed, "push", "origin", "HEAD:refs/heads/master");
      git(seed, "push", "origin", "HEAD:refs/heads/task/conflict");

      git(seed, "checkout", "-b", "task/conflict");
      writeFileSync(join(seed, "task.txt"), "remote\n");
      git(seed, "commit", "-am", "remote update");
      git(seed, "push", "origin", "HEAD:refs/heads/task/conflict");

      git(root, "clone", remote, workspace);
      git(workspace, "config", "user.name", "Repair Test");
      git(workspace, "config", "user.email", "repair@example.test");
      git(
        workspace,
        "checkout",
        "-b",
        "task/conflict",
        "origin/task/conflict~1",
      );
      writeFileSync(join(workspace, "task.txt"), "local\n");
      git(workspace, "commit", "-am", "local update");

      const result = publishCampaignRepairBranch(workspace, "task/conflict");
      expect(result.state).toBe("conflicted");
      expect(result.remoteRef).toBe("refs/remotes/origin/task/conflict");
      expect(result.conflictedPaths).toContain("task.txt");
      expect(git(workspace, "status", "--porcelain=v1")).toContain(
        "UU task.txt",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("derives the repair base only for the observed campaign branch", () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "master-validation-repair-receipt-"),
    );
    try {
      mkdirSync(join(appDir, ".state"), { recursive: true });
      writeFileSync(
        join(appDir, ".state/master-validation-campaign.json"),
        JSON.stringify({
          baselineRunId: "100",
          branch: "validation/master-validation-100",
          baseCommit: "frozen123",
        }),
      );
      const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "101",
    failureFingerprint: "fp",
    sourceBranch: "refs/heads/validation/master-validation-100",
  },
})}
`)!;
      expect(frozenCampaignBaseForFailure(input, appDir)).toBe("frozen123");
      expect(
        frozenCampaignBaseForFailure(
          { ...input, sourceBranch: "refs/heads/main" },
          appDir,
        ),
      ).toBe("");
      expect(
        frozenCampaignBaseForFailure(
          {
            ...input,
            specId: "pipeline.master-validation.bootstrap",
            pipelineRunId: "100",
            sourceBranch: "refs/heads/main",
            sourceCommit: "frozen123",
          },
          appDir,
        ),
      ).toBe("frozen123");
      expect(
        frozenCampaignBaseForFailure(
          {
            ...input,
            specId: "pipeline.master-validation.bootstrap",
            pipelineRunId: "new-run",
            sourceBranch: "refs/heads/main",
            sourceCommit: "new-main",
          },
          appDir,
        ),
      ).toBe("new-main");
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("marks a focused PR for immediate frozen-campaign composition", () => {
    expect(
      campaignRepairPullRequestDescription({
        taskId: "domain/master-validation-failure/spec.example/fp",
        specId: "spec.example",
        failureRunId: "101",
        sourceCommit: "fix123",
        campaignBaseCommit: "base123",
      }),
    ).toContain("Master-Validation-Candidate: include");
    expect(
      campaignRepairPullRequestDescription({
        taskId: "domain/master-validation-failure/spec.example/fp",
        specId: "spec.example",
        failureRunId: "101",
        sourceCommit: "fix123",
        campaignBaseCommit: "base123",
      }),
    ).toContain("Do not merge the campaign branch itself");
  });

  test("reuses one active PR for a stable failure task", () => {
    const pullRequests = [
      {
        pullRequestId: 16707751,
        status: "active",
        sourceRefName: "refs/heads/task/first",
      },
      {
        pullRequestId: 16711806,
        status: "active",
        sourceRefName: "refs/heads/task/replacement",
      },
      {
        pullRequestId: 16712524,
        status: "active",
        sourceRefName: "refs/heads/task/current",
      },
    ];
    expect(
      canonicalTaskPullRequest(pullRequests, {
        preferredSourceBranch: "task/current",
      })?.pullRequestId,
    ).toBe(16712524);
    expect(
      canonicalTaskPullRequest(pullRequests, {
        preferredPullRequestId: "16707751",
        preferredSourceBranch: "task/current",
      })?.pullRequestId,
    ).toBe(16707751);
    expect(canonicalTaskPullRequest(pullRequests)?.pullRequestId).toBe(
      16712524,
    );
  });

  test("rejects completed PRs when choosing the stable task PR", () => {
    expect(
      canonicalTaskPullRequest([
        {
          pullRequestId: 9,
          status: "completed",
          sourceRefName: "refs/heads/task/completed",
        },
      ]),
    ).toBeNull();
  });

  test("preserves rejection for an unchanged focused repair commit", () => {
    expect(
      rejectedTaskPullRequest(
        [
          {
            pullRequestId: 16730680,
            status: "abandoned",
            lastMergeSourceCommit: { commitId: "obsolete-head" },
          },
          {
            pullRequestId: 16731759,
            status: "abandoned",
            lastMergeSourceCommit: { commitId: "same-obsolete-head" },
          },
        ],
        "same-obsolete-head",
      )?.pullRequestId,
    ).toBe(16731759);
    expect(
      rejectedTaskPullRequest(
        [
          {
            pullRequestId: 16731759,
            status: "abandoned",
            lastMergeSourceCommit: { commitId: "old-head" },
          },
        ],
        "meaningfully-revised-head",
      ),
    ).toBeNull();
  });

  test("accepts the s_1786668330691_4 already-repaired shared-fixture shape without changing HEAD", async () => {
    const root = mkdtempSync(
      join(tmpdir(), "master-validation-already-fixed-"),
    );
    try {
      git(root, "init");
      git(root, "config", "user.name", "Repair Test");
      git(root, "config", "user.email", "repair@example.test");
      writeFileSync(
        join(root, "fixture.ts"),
        "// AgentPoolsWithEmptySubnetError fixed\n",
      );
      git(root, "add", "fixture.ts");
      git(root, "commit", "-m", "fix shared fixture subnet request");
      const headCommit = git(root, "rev-parse", "HEAD");
      const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "1786668330691",
    failureFingerprint: "AgentPoolsWithEmptySubnetError",
    status: "pass",
    category: "none",
  },
})}
`)!;
      expect(currentObservationShowsNoRepairNeeded(input)).toBe(true);
      let attempts = 0;
      const decision = {
        classification: "test_issue" as const,
        repairNecessity: "already_repaired" as const,
        summary:
          "Historical shared-fixture AgentPoolsWithEmptySubnetError is already repaired.",
        evidence: ["historical-session:s_1786668330691_4"],
        changedFiles: [],
        fixProvenance: ["commit:fixture-fix;defect:empty-subnet-agent-pool"],
        currentEquivalentSourceEvidence: [
          "fixture.ts now omits the invalid empty-subnet agent-pool request",
        ],
        exactCurrentSourcePassingProof: {
          pipelineRunId: "1786668330691",
          sourceBranch: "refs/heads/main",
          sourceCommit: headCommit,
          status: "pass",
        },
      };
      const ctx = workflowContext({
        runAgent: async () => {
          attempts += 1;
          return { status: "success", structuredResult: decision };
        },
      });

      const outcome = await runFailureInvestigation(ctx, input, {
        workspaceDir: root,
        prompt:
          "Classify historical root cause separately from repair necessity.",
        headCommit,
      });
      expect(attempts).toBe(1);
      expect(outcome).toMatchObject({
        kind: "decision",
        nextCommit: headCommit,
        decision: { repairNecessity: "already_repaired", changedFiles: [] },
      });
      expect(alreadyRepairedTestIssueProblem(decision, headCommit)).toBeNull();
      expect(alreadyRepairedTestIssueEvidence(decision)).toEqual(
        expect.arrayContaining([
          "classification:test_issue",
          "repair-necessity:already_repaired",
          "source-change-file-count:0",
          "publication-disposition:not_applicable:already_repaired",
          `exact-current-source-pass:pipeline-run=1786668330691;sourceBranch=refs/heads/main;sourceCommit=${headCommit};status=pass`,
        ]),
      );
      expect(git(root, "rev-parse", "HEAD")).toBe(headCommit);
      expect(git(root, "status", "--porcelain=v1")).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("converges the accepted already-repaired path without publication or an empty commit", async () => {
    const root = mkdtempSync(
      join(tmpdir(), "master-validation-already-fixed-execute-"),
    );
    const remote = join(root, "remote.git");
    const repoDir = join(root, "repo");
    const workspaceDir = join(root, "workspace");
    const appDir = join(root, "app");
    try {
      git(root, "init", "--bare", remote);
      git(root, "init", repoDir);
      git(repoDir, "config", "user.name", "Repair Test");
      git(repoDir, "config", "user.email", "repair@example.test");
      writeFileSync(
        join(repoDir, "fixture.ts"),
        "// no empty subnet agent pool\n",
      );
      git(repoDir, "add", "fixture.ts");
      git(repoDir, "commit", "-m", "repair shared fixture");
      git(repoDir, "branch", "-M", "main");
      git(repoDir, "remote", "add", "origin", remote);
      git(repoDir, "push", "-u", "origin", "main");
      git(remote, "symbolic-ref", "HEAD", "refs/heads/main");
      git(root, "clone", remote, workspaceDir);
      git(workspaceDir, "checkout", "-b", "task/already-repaired");
      mkdirSync(appDir, { recursive: true });
      const headCommit = git(workspaceDir, "rev-parse", "HEAD");
      let dispatchCount = 0;
      const ctx = workflowContext({
        appDir,
        projectDir: repoDir,
        workspaceDir,
        task: `## Reconciliation Task\n${JSON.stringify({
          taskId: "domain/master-validation-failure/spec.example/fp",
          generation: 1,
          input: {
            specId: "spec.example",
            pipelineRunId: "1786668330691",
            failureFingerprint: "AgentPoolsWithEmptySubnetError",
            sourceBranch: "refs/heads/main",
            sourceCommit: headCommit,
            status: "pass",
            category: "none",
            reason:
              "Historical shared-fixture AgentPoolsWithEmptySubnetError; current exact main passes.",
          },
          children: { live: [], completed: [] },
        })}`,
        runAgent: async (_agent: unknown, prompt: string) => {
          expect(prompt).toContain(
            "Do not manufacture a duplicate source change",
          );
          expect(prompt).not.toContain("make the smallest source fix");
          return {
            status: "success",
            structuredResult: {
              classification: "test_issue",
              repairNecessity: "already_repaired",
              summary: "Historical fixture defect is already repaired.",
              evidence: ["historical-session:s_1786668330691_4"],
              changedFiles: [],
              fixProvenance: ["commit:shared-fixture-repair"],
              currentEquivalentSourceEvidence: [
                "fixture.ts omits the invalid empty-subnet agent pool",
              ],
              exactCurrentSourcePassingProof: {
                pipelineRunId: "1786668330691",
                sourceBranch: "refs/heads/main",
                sourceCommit: headCommit,
                status: "pass",
              },
            },
          };
        },
        dispatchEvent: () => {
          dispatchCount += 1;
        },
      });

      expect(await execute(ctx)).toMatchObject({
        status: "done",
        output: {
          state: "converged",
          evidence: expect.arrayContaining([
            "classification:test_issue",
            "repair-necessity:already_repaired",
            "source-change-file-count:0",
            "publication-disposition:not_applicable:already_repaired",
          ]),
          actions: [],
        },
      });
      expect(dispatchCount).toBe(0);
      expect(git(workspaceDir, "rev-parse", "HEAD")).toBe(headCommit);
      expect(git(workspaceDir, "status", "--porcelain=v1")).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects insufficient unchanged-HEAD already-repaired claims without demanding a duplicate fix", async () => {
    const root = mkdtempSync(
      join(tmpdir(), "master-validation-already-fixed-reject-"),
    );
    try {
      git(root, "init");
      git(root, "config", "user.name", "Repair Test");
      git(root, "config", "user.email", "repair@example.test");
      git(root, "commit", "--allow-empty", "-m", "current main");
      const headCommit = git(root, "rev-parse", "HEAD");
      const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "1786668330691",
    failureFingerprint: "AgentPoolsWithEmptySubnetError",
    status: "pass",
    category: "none",
  },
})}
`)!;
      const prompts: string[] = [];
      const ctx = workflowContext({
        runAgent: async (_agent: unknown, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "success",
            structuredResult: {
              classification: "test_issue",
              repairNecessity: "already_repaired",
              summary: "It passes now.",
              evidence: ["current-status:pass"],
              changedFiles: [],
              fixProvenance: [],
              currentEquivalentSourceEvidence: [],
            },
          };
        },
      });

      const outcome = await runFailureInvestigation(ctx, input, {
        workspaceDir: root,
        prompt: "Review current pass/none observation.",
        headCommit,
      });
      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toContain(
        "unchanged-HEAD already_repaired claim is insufficient",
      );
      expect(prompts[1]).toContain("Do not create a duplicate fix");
      expect(outcome).toMatchObject({
        kind: "blocked",
        result: {
          evidence: {
            evidence: expect.arrayContaining([
              "repair-necessity:already_repaired",
              "already-repaired-proof-rejected:already-repaired decision lacks fix provenance",
              `unchanged-head:${headCommit}`,
            ]),
          },
        },
      });
      expect(git(root, "rev-parse", "HEAD")).toBe(headCommit);
      expect(git(root, "status", "--porcelain=v1")).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("retries a test-issue classification once and blocks instead of falsely converging without a fix", async () => {
    const root = mkdtempSync(join(tmpdir(), "master-validation-no-fix-"));
    try {
      git(root, "init");
      git(root, "config", "user.name", "Repair Test");
      git(root, "config", "user.email", "repair@example.test");
      git(root, "commit", "--allow-empty", "-m", "base");
      const headCommit = git(root, "rev-parse", "HEAD");
      const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "101",
    failureFingerprint: "fp",
    artifactPath: "/tmp/result.json",
  },
})}
`)!;
      const prompts: string[] = [];
      const ctx = workflowContext({
        runAgent: async (_agent: unknown, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "success",
            structuredResult: {
              classification: "test_issue",
              summary: "cleanup confirmation is too eager",
              evidence: ["cleanup:HTTP 202"],
              changedFiles: [],
            },
          };
        },
      });

      const outcome = await runFailureInvestigation(ctx, input, {
        workspaceDir: root,
        prompt: "Investigate the failure.",
        headCommit,
      });
      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toContain(
        "Classification alone does not resolve a test issue",
      );
      expect(outcome).toMatchObject({
        kind: "blocked",
        result: {
          status: "blocked",
          evidence: {
            evidence: expect.arrayContaining([
              "classification:test_issue",
              "investigation-attempts:2",
              `unchanged-head:${headCommit}`,
            ]),
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("accepts a committed test fix produced by the feedback retry", async () => {
    const root = mkdtempSync(join(tmpdir(), "master-validation-retry-fix-"));
    try {
      git(root, "init");
      git(root, "config", "user.name", "Repair Test");
      git(root, "config", "user.email", "repair@example.test");
      git(root, "commit", "--allow-empty", "-m", "base");
      const headCommit = git(root, "rev-parse", "HEAD");
      const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "101",
    failureFingerprint: "fp",
  },
})}
`)!;
      let attempts = 0;
      const ctx = workflowContext({
        runAgent: async () => {
          attempts += 1;
          if (attempts === 2) {
            writeFileSync(join(root, "fix.txt"), "fixed\n");
            git(root, "add", "fix.txt");
            git(root, "commit", "-m", "fix cleanup confirmation");
          }
          return {
            status: "success",
            structuredResult: {
              classification: "test_issue",
              summary: "fixed cleanup confirmation",
              evidence: ["test:passed"],
              changedFiles: attempts === 2 ? ["fix.txt"] : [],
            },
          };
        },
      });

      const outcome = await runFailureInvestigation(ctx, input, {
        workspaceDir: root,
        prompt: "Investigate the failure.",
        headCommit,
      });
      expect(attempts).toBe(2);
      expect(outcome).toMatchObject({
        kind: "decision",
        decision: { classification: "test_issue" },
      });
      expect(
        outcome.kind === "decision" ? outcome.nextCommit : headCommit,
      ).not.toBe(headCommit);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("routes investigation session failures through runtime recovery", async () => {
    const root = mkdtempSync(join(tmpdir(), "master-validation-agent-error-"));
    try {
      git(root, "init");
      git(root, "config", "user.name", "Repair Test");
      git(root, "config", "user.email", "repair@example.test");
      git(root, "commit", "--allow-empty", "-m", "base");
      const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "101",
    failureFingerprint: "fp",
  },
})}
`)!;
      const ctx = workflowContext({
        runAgent: async () => ({ status: "interrupted" }),
      });
      expect(
        await runFailureInvestigation(ctx, input, {
          workspaceDir: root,
          prompt: "Investigate the failure.",
          headCommit: git(root, "rev-parse", "HEAD"),
        }),
      ).toMatchObject({
        kind: "blocked",
        result: {
          status: "blocked",
          evidence: {
            evidence: expect.arrayContaining(["session-status:interrupted"]),
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("routes a wrong-target aggregate failure through one exact standalone child", () => {
    {
      const completed = [
        {
          taskId: "domain/prior-standalone-proof",
          summary:
            "spec.rp-cluster-lifecycle.nginx-large-header passed exact standalone run 120 and merged into main.",
          evidence: [
            "pipeline-run:120",
            "source-commit:proof123",
            "standalone-build-id:110",
          ],
          completedAt: "2026-07-23T18:00:00Z",
        },
      ];
      const failure = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.nginx/fp",
  input: {
    specId: "spec.rp-cluster-lifecycle.nginx-large-header",
    pipelineRunId: "130",
    failureFingerprint: "fp",
    sourceCommit: "old123",
    category: "environment_blocker",
    reason:
      "Standalone RP ingress target required: the generic staging target cannot exercise this claim.",
  },
})}
`)!;
      expect(requiresStandaloneVerification(failure)).toBe(true);
      const prior = priorStandaloneVerification(completed, failure.specId)!;
      expect(prior).toMatchObject({
        taskId: "domain/prior-standalone-proof",
        pipelineRunId: "120",
        sourceCommit: "proof123",
        standaloneBuildId: "110",
      });
      const action = standaloneRecoveryChildAction({
        failure,
        currentMainCommit: "main123",
        prior,
      });
      expect(action).toMatchObject({
        kind: "create-task",
        parentId: failure.taskId,
        workflow: "master-validation-route-verification",
        input: {
          specId: failure.specId,
          standaloneBuildId: "110",
          currentMainCommit: "main123",
        },
      });
      const raw = `## Reconciliation Task\n${JSON.stringify({
        children: { live: [{ taskId: (action as { id: string }).id }] },
      })}`;
      expect(
        standaloneRecoveryChild(raw, failure, "main123", "110", "live"),
      ).toMatchObject({ taskId: (action as { id: string }).id });
      const laterAction = standaloneRecoveryChildAction({
        failure,
        currentMainCommit: "main456",
        prior,
      });
      const duplicateRaw = `## Reconciliation Task\n${JSON.stringify({
        children: {
          live: [
            {
              taskId: (action as { id: string }).id,
              generation: 1,
              phase: "waiting",
              evidence: ["pipeline-run:140", "pull-request:16730865"],
            },
            {
              taskId: (laterAction as { id: string }).id,
              generation: 1,
              phase: "pending",
              evidence: [],
            },
          ],
        },
      })}`;
      expect(
        standaloneRecoveryChild(
          duplicateRaw,
          failure,
          "main456",
          "110",
          "live",
        ),
      ).toMatchObject({ taskId: (action as { id: string }).id });
      expect(shouldDelegateStandaloneRecovery(failure)).toBe(true);
      expect(
        shouldDelegateStandaloneRecovery({
          ...failure,
          campaignRepairReplay: {
            reason: "Repair the existing focused patch.",
            conflictingPaths: [],
            campaignCompositionCommits: [],
            sourceEquivalentCommits: [],
            campaignSourceCommit: "campaign-head",
            currentMainCommit: "main456",
            pullRequestId: "16712127",
            expectedRemoteCommit: "stale-pr-head",
          },
        }),
      ).toBe(false);
      expect(
        standaloneRecoveryCompletionProblem(
          {
            taskId: (action as { id: string }).id,
            evidence: ["pipeline-run:140", "target-ref:origin/dev"],
          },
          "main123",
        ),
      ).toContain("origin/main");
      expect(
        standaloneRecoveryCompletionProblem(
          {
            taskId: (action as { id: string }).id,
            evidence: [
              "run status=completed sourceBranch=refs/heads/main sourceVersion=main123",
            ],
          },
          "main123",
        ),
      ).toBeNull();
      expect(
        standaloneRecoveryCompletionProblem(
          {
            taskId: (action as { id: string }).id,
            evidence: ["pipeline-run:140", "target-ref:origin/main"],
          },
          "main123",
        ),
      ).toBeNull();
    }
  });

  test("reuses an older standalone proof receipt written in plain language", () => {
    {
      const completed = [
        {
          taskId: "domain/prior-queuewatcher-proof",
          outcome:
            "Verify spec.service-platform.queuewatcher on standalone build 175600006.",
          acceptance: [
            "Track exact run 175634889 with standalone_build_id=175600006.",
          ],
          summary:
            "spec.service-platform.queuewatcher passed exact live verification on current origin/main.",
          evidence: [
            "pipeline-run:175634889",
            "source-commit:9c2c111b04ef2b625b05e03bf4fae203008a268b",
            "run 175634889 succeeded at target staging, standalone_build_id 175600006.",
          ],
          completedAt: "2026-08-07T17:01:45.337Z",
        },
      ];

      expect(
        priorStandaloneVerification(
          completed,
          "spec.service-platform.queuewatcher",
        ),
      ).toMatchObject({
        taskId: "domain/prior-queuewatcher-proof",
        pipelineRunId: "175634889",
        sourceCommit: "9c2c111b04ef2b625b05e03bf4fae203008a268b",
        standaloneBuildId: "175600006",
      });
    }
  });

  test("does not reinterpret an ordinary environment failure as standalone routing", () => {
    const failure = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "130",
    failureFingerprint: "fp",
    category: "environment_blocker",
    reason: "Cluster create returned HTTP 500.",
  },
})}
`)!;
    expect(requiresStandaloneVerification(failure)).toBe(false);
  });

  test("routes a first aggregate exclusion from structured standalone target requirements", () => {
    const root = mkdtempSync(join(tmpdir(), "standalone-admission-"));
    try {
      const artifactPath = join(root, "live-admission-report.json");
      writeFileSync(
        artifactPath,
        JSON.stringify({
          excluded: [
            {
              specId: "spec.service-platform.queuewatcher",
              bucket: "missing-required-target-env",
              signals: [
                "missing-target-env=AKS_RP_E2E_STANDALONE_BUILD_VERSION",
                "missing-target-env=AKS_RP_E2E_OVERLAY_RESOURCE_REGION",
                "missing-target-env=AKS_RP_E2E_OVERLAY_RESOURCE_VERSION",
              ],
            },
          ],
        }),
      );
      const failure = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.service-platform.queuewatcher",
  input: {
    specId: "spec.service-platform.queuewatcher",
    pipelineRunId: "175662110",
    failureFingerprint: "382877a960141511b056",
    artifactPath,
    category: "admission_exclusion",
    status: "excluded",
    reason: "Live target is missing required environment variables.",
  },
})}
`)!;

      expect(admissionReportRequiresStandaloneVerification(failure)).toBe(true);
      expect(requiresStandaloneVerification(failure)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("honors an explicit standalone verification route regardless of failure category", () => {
    const failure = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.service-platform.queuewatcher",
  input: {
    specId: "spec.service-platform.queuewatcher",
    pipelineRunId: "175603971",
    failureFingerprint: "47691204caef239c08f2",
    category: "test_not_implemented",
    reason: "Aggregate execution omitted required producer inputs.",
    standaloneBuildId: "174851380",
    historicalDirectPass: {
      pipelineRunId: "175414926",
      sourceCommit: "7146aac36",
    },
  },
})}
`)!;

    expect(requiresStandaloneVerification(failure)).toBe(true);
    expect(requestedStandaloneVerification(failure)).toEqual({
      taskId: failure.taskId,
      pipelineRunId: "175414926",
      sourceCommit: "7146aac36",
      standaloneBuildId: "174851380",
      evidence: [
        "standalone-build-id:174851380",
        "prior-standalone-pipeline-run:175414926",
        "prior-standalone-source-commit:7146aac36",
      ],
    });
    expect(
      standaloneRecoveryChildAction({
        failure,
        currentMainCommit: "main123",
        prior: requestedStandaloneVerification(failure)!,
      }),
    ).toMatchObject({
      kind: "create-task",
      parentId: failure.taskId,
      workflow: "master-validation-route-verification",
      input: {
        specId: failure.specId,
        standaloneBuildId: "174851380",
        currentMainCommit: "main123",
      },
    });
  });

  test("only relevant main changes defer failure repair", () => {
    expect(
      changedFilesMayAffectSpec("spec.rp-cluster-lifecycle.nginx", [
        "owners.txt",
        "features/storage-csi/tests/file-clone.test.ts",
      ]),
    ).toBe(false);
    expect(
      changedFilesMayAffectSpec("spec.rp-cluster-lifecycle.nginx", [
        "features/rp-cluster-lifecycle/tests/nginx.test.ts",
      ]),
    ).toBe(true);
    expect(
      changedFilesMayAffectSpec("spec.rp-cluster-lifecycle.nginx", [
        "runner/scenario-lib/arm-rest.ts",
      ]),
    ).toBe(true);
  });

  test("bounds changed-file evidence without hiding the total", () => {
    expect(
      boundedChangedFileEvidence(
        Array.from({ length: 40 }, (_, index) => `runner/change-${index}.ts`),
        3,
      ),
    ).toEqual([
      "relevant-main-change:runner/change-0.ts",
      "relevant-main-change:runner/change-1.ts",
      "relevant-main-change:runner/change-2.ts",
      "relevant-main-change-count:40",
      "relevant-main-change-omitted:37",
    ]);
    expect(boundedChangedFileEvidence(null)).toEqual([
      "relevant-main-change:unknown",
    ]);
  });

  test("reads the correlated progressive failure payload", () => {
    const parsed = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  generation: 2,
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
    sourceCommit: "abc",
    artifactPath: "/tmp/result.json",
    reason: "failed",
    category: "implementation",
    status: "fail",
    carrierCommit: "repair123",
  },
})}
`);
    expect(parsed).toMatchObject({
      taskId: "domain/master-validation-failure/spec.example/fp",
      generation: 2,
      specId: "spec.example",
      pipelineRunId: "123",
      failureFingerprint: "fp",
      sourceCommit: "abc",
      carrierCommit: "repair123",
    });
    expect(hasPreparedRepair(parsed!)).toBe(true);
  });

  test("reads the structured output of a nested workflow result", () => {
    expect(
      nestedWorkflowOutput({
        id: "wf_nested",
        kind: "workflow",
        status: "done",
        summary: "outer",
        output: {
          state: "converged",
          summary: "integrated",
          evidence: ["pull-request:123"],
        },
      }),
    ).toEqual({
      state: "converged",
      summary: "integrated",
      evidence: ["pull-request:123"],
    });
  });

  test("accepts a later passing observation from the same frozen campaign source", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
    sourceCommit: "abc",
  },
})}
`)!;
    const observation = JSON.stringify({
      type: "pipeline.spec.observed",
      pipelineRunId: "124",
      sourceBranch: "refs/heads/validation/master-validation-123",
      sourceCommit: "abc",
      specId: "spec.example",
      status: "pass",
      artifactPath: "/tmp/result.json",
    });
    const raw = `
## Trigger Event
${observation}
`;
    expect(passingRecoveryObservation(raw, input)).toMatchObject({
      pipelineRunId: "124",
      specId: "spec.example",
      status: "pass",
    });
    expect(
      passingRecoveryObservation(
        raw.replace('"pipelineRunId":"124"', '"pipelineRunId":"122"'),
        input,
      ),
    ).toBeNull();
    expect(
      passingRecoveryObservation(
        raw.replace('"sourceCommit":"abc"', '"sourceCommit":"other"'),
        input,
      ),
    ).toBeNull();

    const triggerObservationRaw = `
## Trigger Observation
${observation}
`;
    expect(
      passingRecoveryObservation(triggerObservationRaw, input),
    ).toMatchObject({
      pipelineRunId: "124",
      specId: "spec.example",
      status: "pass",
    });
  });

  test("does not let a frozen campaign pass satisfy a current-main product recovery wait", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
    sourceBranch: "refs/heads/validation/master-validation-123",
    sourceCommit: "abc",
    category: "product_failure",
  },
})}
`)!;
    const frozenCampaign = `
## Trigger Observation
${JSON.stringify({
  type: "pipeline.spec.observed",
  pipelineRunId: "124",
  sourceBranch: "refs/heads/validation/master-validation-123",
  sourceCommit: "abc",
  specId: "spec.example",
  status: "pass",
})}
`;
    const currentMain = `
## Trigger Observation
${JSON.stringify({
  type: "pipeline.spec.observed",
  pipelineRunId: "125",
  sourceBranch: "refs/heads/main",
  sourceCommit: "main-recovery",
  specId: "spec.example",
  status: "pass",
})}
`;

    expect(
      passingRecoveryObservation(frozenCampaign, input, {
        requireCurrentMain: true,
      }),
    ).toBeNull();
    expect(
      passingRecoveryObservation(currentMain, input, {
        requireCurrentMain: true,
      }),
    ).toMatchObject({
      pipelineRunId: "125",
      sourceBranch: "refs/heads/main",
      sourceCommit: "main-recovery",
      specId: "spec.example",
      status: "pass",
    });
  });

  test("accepts the exact later same-spec main pass carried by the condition wake", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
    sourceCommit: "abc",
  },
})}
`)!;
    const rows = [
      {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({
          pipelineRunId: "126",
          sourceBranch: "refs/heads/validation/master-validation-123",
          sourceCommit: "campaign",
          specId: "spec.example",
          status: "pass",
        }),
      },
      {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({
          pipelineRunId: "125",
          sourceBranch: "refs/heads/main",
          sourceCommit: "recovered-main",
          specId: "spec.example",
          status: "pass",
          artifactPath: "/tmp/recovered.json",
        }),
      },
      {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({
          pipelineRunId: "124",
          sourceBranch: "refs/heads/main",
          sourceCommit: "other-main",
          specId: "spec.other",
          status: "pass",
        }),
      },
      {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({
          pipelineRunId: "122",
          sourceBranch: "refs/heads/main",
          sourceCommit: "old-main",
          specId: "spec.example",
          status: "pass",
        }),
      },
    ];
    const ctx = workflowContext({
      trigger: {
        type: "pipeline.spec.observed",
        data: JSON.parse(rows[1]!.data),
      },
    });

    expect(latestPassingRecoveryObservation(ctx, input)).toMatchObject({
      pipelineRunId: "125",
      sourceBranch: "refs/heads/main",
      sourceCommit: "recovered-main",
      specId: "spec.example",
      status: "pass",
    });
  });

  test("current-main product recovery replay ignores later frozen campaign passes", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
    sourceBranch: "refs/heads/validation/master-validation-123",
    sourceCommit: "abc",
    category: "product_failure",
  },
})}
`)!;
    const rows = [
      {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({
          pipelineRunId: "126",
          sourceBranch: "refs/heads/validation/master-validation-123",
          sourceCommit: "abc",
          specId: "spec.example",
          status: "pass",
        }),
      },
      {
        event_type: "pipeline.spec.observed",
        data: JSON.stringify({
          pipelineRunId: "125",
          sourceBranch: "refs/heads/main",
          sourceCommit: "recovered-main",
          specId: "spec.example",
          status: "pass",
        }),
      },
    ];
    const ctx = workflowContext({
      trigger: {
        type: "pipeline.spec.observed",
        data: JSON.parse(rows[1]!.data),
      },
    });

    expect(
      latestPassingRecoveryObservation(ctx, input, {
        requireCurrentMain: true,
      }),
    ).toMatchObject({
      pipelineRunId: "125",
      sourceBranch: "refs/heads/main",
      sourceCommit: "recovered-main",
      specId: "spec.example",
      status: "pass",
    });
  });

  test("accepts a main observation until a later relevant change invalidates it", () => {
    expect(
      observationAppliesToCurrentMain({
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        observationCommit: "tested",
        currentMainCommit: "newer",
        observationIsAncestor: true,
        changedFiles: ["owners.txt"],
      }),
    ).toBe(true);
    expect(
      observationAppliesToCurrentMain({
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        observationCommit: "tested",
        currentMainCommit: "newer",
        observationIsAncestor: true,
        changedFiles: [
          "features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-nginx-large-header.test.ts",
        ],
      }),
    ).toBe(false);
    expect(
      observationAppliesToCurrentMain({
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        observationCommit: "other-history",
        currentMainCommit: "current",
        observationIsAncestor: false,
        changedFiles: [],
      }),
    ).toBe(false);
  });

  test("waits for an exact same-spec pass through the project observation stream", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
    sourceCommit: "abc",
  },
})}
`)!;
    expect(productRecoveryCondition(input)).toEqual({
      id: "master-validation-product-recovery-fp-after-123",
      type: "pipeline.spec.observed",
      subject: "project:aks-rp-e2e",
      expected: {
        specId: "spec.example",
        status: "pass",
        sourceCommit: "abc",
        pipelineRunId: { gt: "123" },
      },
    });
  });

  test("pins product recovery waits to current main and the recovery baseline", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
    sourceBranch: "refs/heads/validation/master-validation-123",
    sourceCommit: "abc",
    category: "product_failure",
  },
})}
`)!;
    expect(
      productRecoveryCondition(input, "456", { requireCurrentMain: true }),
    ).toEqual({
      id: "master-validation-product-recovery-fp-after-456",
      type: "pipeline.spec.observed",
      subject: "project:aks-rp-e2e",
      expected: {
        specId: "spec.example",
        status: "pass",
        sourceBranch: "refs/heads/main",
        pipelineRunId: { gt: "456" },
      },
    });
  });

  test("does not reuse a satisfied recovery condition for a later failure episode", () => {
    const earlier = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
  },
})}
`)!;
    const later = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "456",
    failureFingerprint: "fp",
  },
})}
`)!;

    expect(productRecoveryCondition(earlier).id).toBe(
      "master-validation-product-recovery-fp-after-123",
    );
    expect(productRecoveryCondition(later).id).toBe(
      "master-validation-product-recovery-fp-after-456",
    );
  });

  test("registers recovery after the latest known aggregate run", () => {
    const appDir = mkdtempSync(join(tmpdir(), "recovery-baseline-"));
    try {
      mkdirSync(join(appDir, ".state"), { recursive: true });
      writeFileSync(
        join(appDir, ".state/master-validation-cycle.json"),
        JSON.stringify({ runId: "456" }),
      );
      const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
  },
})}
`)!;
      expect(
        currentRecoveryBaselineRunId(
          {
            workspace: {
              appRoot: appDir,
              projectRoot: "/repo",
              root: "/workspace",
              output: "/output",
            },
          },
          input,
        ),
      ).toBe("456");
      expect(productRecoveryCondition(input, "456")).toMatchObject({
        id: "master-validation-product-recovery-fp-after-456",
        expected: { pipelineRunId: { gt: "456" } },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("absorbs inactive legacy recovery and publication children", () => {
    const raw = `
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: { specId: "spec.example", failureFingerprint: "fp" },
  children: {
    live: [
      {
        taskId: "domain/verify-example-product-recovery-after-100",
        generation: 2,
        phase: "waiting",
      },
      {
        taskId: "domain/verify-example-product-recovery-after-101",
        generation: 1,
        phase: "active",
      },
      {
        taskId: "domain/publish-example-fix",
        generation: 3,
        phase: "waiting",
      },
      {
        taskId: "domain/publish-current-main-staging-exclusion-example",
        generation: 4,
        phase: "waiting",
      },
    ],
  },
})}
`;
    expect(legacyRecoveryChildren(raw)).toEqual([
      {
        taskId: "domain/verify-example-product-recovery-after-100",
        generation: 2,
        phase: "waiting",
      },
      {
        taskId: "domain/publish-current-main-staging-exclusion-example",
        generation: 4,
        phase: "waiting",
      },
    ]);
  });

  test("preserves durable product classification for a repeated stable fingerprint", () => {
    const raw = `
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: { specId: "spec.example", failureFingerprint: "fp" },
  children: {
    completed: [
      {
        taskId: "domain/verify-example-product-recovery-after-100",
        outcome: "Maintain exact product recovery verification.",
        summary: "Absorbed the prior product recovery holder.",
        evidence: [
          "The same timeout signature repeated in a later run.",
          "Task state recorded classification=prod_issue.",
        ],
      },
    ],
  },
})}
`;
    expect(priorProductClassification(raw)).toEqual({
      taskId: "domain/verify-example-product-recovery-after-100",
      evidence: expect.arrayContaining([
        "prior-product-classification:domain/verify-example-product-recovery-after-100",
        "Task state recorded classification=prod_issue.",
      ]),
    });
    expect(
      priorProductClassification(
        raw
          .replace(/product recovery/g, "test repair")
          .replace("classification=prod_issue", "classification=test_issue"),
      ),
    ).toBeNull();
  });

  test("keeps an integrated nested repair waiting for main-path verification", async () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
  },
})}
`)!;
    const ctx = workflowContext();
    const result = await preserveVerificationAfterNestedReconciliation(
      ctx,
      input,
      {
        id: "wf_nested",
        kind: "workflow",
        status: "done",
        summary: "outer",
        output: {
          state: "converged",
          summary: "PR merged",
          evidence: ["source-commit:repair"],
        },
      },
    );
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "waiting",
        evidence: [
          "source-commit:repair",
          "blocking-pipeline-run:123",
          "verification-required:later-current-main-spec-pass",
        ],
        conditions: [
          {
            type: "pipeline.spec.observed",
            expected: {
              specId: "spec.example",
              status: "pass",
              sourceBranch: "refs/heads/main",
              pipelineRunId: { gt: "123" },
            },
          },
        ],
      },
    });
  });

  test("closes a replayed failure when owner review finds applicable current-main recovery", async () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
  },
})}
`)!;
    const ctx = workflowContext();
    expect(
      await preserveVerificationAfterNestedReconciliation(ctx, input, {
        id: "wf_nested",
        kind: "workflow",
        status: "done",
        summary: "outer",
        output: {
          state: "converged",
          summary: "Later current-main run 124 passed spec.example.",
          evidence: [
            "recovery-pipeline-run:124",
            "source-commit:recovered-main",
            "existing-recovery:true",
          ],
        },
      }),
    ).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        summary: "Later current-main run 124 passed spec.example.",
        evidence: [
          "recovery-pipeline-run:124",
          "source-commit:recovered-main",
          "existing-recovery:true",
        ],
      },
    });
  });

  test("caps evidence to the task-engine limit without hiding the total", () => {
    const evidence = boundedEvidence(
      Array.from({ length: 40 }, (_, index) => `evidence-${index}`),
    );
    expect(evidence).toHaveLength(32);
    expect(evidence.slice(-2)).toEqual([
      "evidence-entry-count:40",
      "evidence-entry-omitted:10",
    ]);
  });

  test("waits instead of handing inconclusive current examples to attention", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId:
    "domain/master-validation-failure/spec.network-cni.azure-overlay/49b31379f6e1c1f06d73",
  input: {
    specId: "spec.network-cni.azure-overlay",
    pipelineRunId: "173630013",
    failureFingerprint: "49b31379f6e1c1f06d73",
    sourceCommit: "b6ed0123763895f4584db2e3337145998e44b009",
  },
})}
`)!;
    const ctx = workflowContext();
    const result = inconclusiveWait(
      ctx,
      input,
      "The spec.network-cni.azure-overlay failure remains inconclusive: current example replay.",
      Array.from({ length: 40 }, (_, index) => `artifact-evidence-${index}`),
    );
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "waiting",
        conditions: [
          {
            id: "master-validation-product-recovery-49b31379f6e1c1f06d73-after-173630013",
            type: "pipeline.spec.observed",
            subject: "project:aks-rp-e2e",
            expected: {
              specId: "spec.network-cni.azure-overlay",
              status: "pass",
              sourceCommit: "b6ed0123763895f4584db2e3337145998e44b009",
            },
          },
        ],
      },
    });
    expect(
      (result as { output: { evidence: string[] } }).output.evidence,
    ).toHaveLength(32);
    expect(
      (result as { output: { evidence: string[] } }).output.evidence,
    ).toContain("classification:inconclusive");
  });

  test("waits for later artifact truth on progressive placeholders before investigation or source work", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "master-validation-progressive-"),
    );
    const repoDir = join(appDir, "repo");
    const workspaceDir = join(appDir, "workspace");
    try {
      mkdirSync(repoDir, { recursive: true });
      mkdirSync(workspaceDir, { recursive: true });
      let runAgentCalled = false;
      let dispatchCount = 0;
      const ctx = workflowContext({
        appDir,
        projectDir: repoDir,
        workspaceDir,
        task: `## Reconciliation Task\n${JSON.stringify({
          taskId:
            "domain/master-validation-failure/spec.managed-namespaces.lifecycle/c17abe6e8a69376e9e6f",
          generation: 46,
          input: {
            specId: "spec.managed-namespaces.lifecycle",
            pipelineRunId: "174826569",
            failureFingerprint: "c17abe6e8a69376e9e6f",
            sourceBranch: "refs/heads/validation/master-validation-173853081",
            sourceCommit: "3ffc651bdbaccc9ba08e47d2eb9671ede3aad2f4",
            status: "fail",
            category: "unknown",
            reason:
              "Azure timeline reported a failure before artifacts were available.",
            progressiveObservation: true,
          },
        })}`,
        runAgent: async () => {
          runAgentCalled = true;
          throw new Error(
            "progressive placeholder must not start investigation",
          );
        },
        dispatchEvent: () => {
          dispatchCount += 1;
        },
      });

      const result = await execute(ctx);
      expect(result).toMatchObject({
        status: "done",
        output: {
          state: "waiting",
          evidence: expect.arrayContaining([
            "blocking-pipeline-run:174826569",
            "source-commit:3ffc651bdbaccc9ba08e47d2eb9671ede3aad2f4",
            "progressive-placeholder-fingerprint:c17abe6e8a69376e9e6f",
            "progressive-placeholder-category:unknown",
            "progressive-observation:true",
            "artifact-observation-required:true",
          ]),
          actions: [],
          conditions: [
            {
              id: "master-validation-progressive-artifact-c17abe6e8a69376e9e6f-run-174826569",
              type: "pipeline.failure.observed",
              subject: "project:aks-rp-e2e",
              expected: {
                specId: "spec.managed-namespaces.lifecycle",
                pipelineRunId: "174826569",
                failureFingerprint: "c17abe6e8a69376e9e6f",
              },
              reviewAfterMs: 900000,
            },
          ],
        },
      });
      expect(runAgentCalled).toBe(false);
      expect(dispatchCount).toBe(0);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("returns a schema-valid product-issue wait for workflow-run wr_1786261835418_s9lm while preserving no-repair and handoff evidence", async () => {
    const root = mkdtempSync(
      join(tmpdir(), "master-validation-product-route-"),
    );
    const remote = join(root, "remote.git");
    const repoDir = join(root, "repo");
    const workspaceDir = join(root, "workspace");
    const appDir = join(root, "app");
    try {
      mkdirSync(remote, { recursive: true });
      git(remote, "init", "--bare");
      mkdirSync(repoDir, { recursive: true });
      git(repoDir, "init");
      git(repoDir, "config", "user.name", "Product Route Test");
      git(repoDir, "config", "user.email", "route@example.test");
      writeFileSync(join(repoDir, "README.md"), "base\n");
      git(repoDir, "add", "README.md");
      git(repoDir, "commit", "-m", "base");
      git(repoDir, "branch", "-M", "main");
      git(repoDir, "remote", "add", "origin", remote);
      git(repoDir, "push", "-u", "origin", "main");
      git(remote, "symbolic-ref", "HEAD", "refs/heads/main");
      git(root, "clone", remote, workspaceDir);
      git(workspaceDir, "checkout", "-b", "task/product-route");
      mkdirSync(appDir, { recursive: true });

      const sourceCommit = git(repoDir, "rev-parse", "HEAD");
      const taskId =
        "domain/master-validation-failure/spec.virtualmachines.mixed-sku-upgrade/fp";
      const dispatched: Array<{ type: string; data: Record<string, unknown> }> =
        [];
      const ctx = workflowContext({
        appDir,
        projectDir: repoDir,
        workspaceDir,
        task: `## Reconciliation Task\n${JSON.stringify({
          taskId,
          generation: 1,
          input: {
            specId: "spec.virtualmachines.mixed-sku-upgrade",
            pipelineRunId: "175759451",
            failureFingerprint: "mixed-sku-stuck-upgrading",
            artifactPath: "/evidence/run-175759451/result.json",
            sourceBranch: "refs/heads/main",
            sourceCommit,
            reason:
              "Accepted mixed-SKU upgrade remained stuck in Upgrading for 40 polls.",
            category: "prod_issue",
            status: "fail",
            requestedServiceOwner: "human:AKS/CRP VM-upgrade service owner",
          },
          children: { live: [], completed: [] },
        })}`,
        dispatchEvent: (type: string, data: Record<string, unknown>) => {
          dispatched.push({ type, data });
        },
      });

      const first = await execute(ctx);
      const second = await execute(ctx);
      expect(first).toMatchObject({
        status: "done",
        output: {
          state: "waiting",
          evidence: expect.arrayContaining([
            "source-change-disposition:not_applicable:prod_issue_requires_no_source_change",
            "source-change-resolved:true",
            "source-change-file-count:0",
            "service-owner-handoff:sent:human:AKS/CRP VM-upgrade service owner",
          ]),
          conditions: [
            {
              type: "pipeline.spec.observed",
              expected: {
                specId: "spec.virtualmachines.mixed-sku-upgrade",
                status: "pass",
                sourceBranch: "refs/heads/main",
                pipelineRunId: { gt: "175759451" },
              },
            },
          ],
        },
      });
      expect(
        Object.keys(
          (first as { output: Record<string, unknown> }).output,
        ).sort(),
      ).toEqual(["actions", "conditions", "evidence", "state", "summary"]);
      expect(second).toMatchObject({
        status: "done",
        output: {
          evidence: expect.arrayContaining([
            "source-change-disposition:not_applicable:prod_issue_requires_no_source_change",
            "source-change-resolved:true",
            "source-change-file-count:0",
            "service-owner-handoff:already_sent:human:AKS/CRP VM-upgrade service owner",
          ]),
        },
      });
      expect(
        Object.keys(
          (second as { output: Record<string, unknown> }).output,
        ).sort(),
      ).toEqual(["actions", "conditions", "evidence", "state", "summary"]);
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]).toMatchObject({
        type: "message.created",
        data: {
          to: "human:AKS/CRP VM-upgrade service owner",
          specId: "spec.virtualmachines.mixed-sku-upgrade",
          pipelineRunId: "175759451",
          serviceOwner: "human:AKS/CRP VM-upgrade service owner",
        },
      });
      expect(git(workspaceDir, "status", "--porcelain=v1")).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("builds bounded no-source-change and service-agent handoff evidence", () => {
    expect(
      productIssueDisposition({
        status: "sent",
        recipient: "human:service-owner",
        dedupeKey: "product:spec:fp:human:service-owner",
        receiptPath: "/tmp/receipt.json",
      }),
    ).toEqual([
      "source-change-disposition:not_applicable:prod_issue_requires_no_source_change",
      "source-change-resolved:true",
      "source-change-file-count:0",
      "service-owner-handoff:sent:human:service-owner",
      "service-owner-handoff-dedupe-key:product:spec:fp:human:service-owner",
      "service-owner-handoff-receipt:/tmp/receipt.json",
    ]);
  });

  test("resumes deterministic live reconciliation for a novel fix or existing PR", () => {
    expect(
      shouldReconcileTestFix({
        hasPullRequest: false,
        sourceIsInTarget: true,
      }),
    ).toBe(false);
    expect(
      shouldReconcileTestFix({
        hasPullRequest: false,
        sourceIsInTarget: false,
      }),
    ).toBe(true);
    expect(
      shouldReconcileTestFix({
        hasPullRequest: true,
        sourceIsInTarget: true,
      }),
    ).toBe(true);
  });
});

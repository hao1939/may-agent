import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { afterAll } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AppEvent,
  ExecutionResult,
  TaskReconciliationContext,
  WorkflowContext,
} from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  acceptedLiveProofSourceInstruction,
  admittedAgentCallTimeoutMs,
  askAgent,
  agentConditionProblem,
  authoritativeRunReference,
  inheritedAuthoritativeRunReference,
  artifactObservedClaimIds,
  artifactProvesPreClaimCapacityBlock,
  artifactProvesCleanup,
  artifactProvesDeclaredClaims,
  artifactProvesSpecPass,
  artifactProvesTarget,
  artifactVitestTestCount,
  boundedWorkflowEvidence,
  boundedSourceEquivalentToTarget,
  checkLiveDispatchAdmission,
  compactPlanPipelineParameters,
  collectTerminalRunEvidence,
  candidateReviewedRunProof,
  canonicalAggregateSpecId,
  proofMetadataMatchesSource,
  queueRunMetadata,
  queueRunPipelineParameters,
  completedPullRequestIntegration,
  cherryPickScenarioReplayCommits,
  currentAdoSurfaceInstruction,
  currentTaskContextPath,
  decisionCorrectionPrompt,
  directVitestCompatibilityInstruction,
  earlyCheckpointInstruction,
  exactPassNeedsOwnerProblem,
  directIntegrationAction,
  exactStrictInventoryInstruction,
  exactLiveTargetInstruction,
  frozenCandidateContentEquivalent,
  freshBaseLineageAdmission,
  semanticInvalidationSourceState,
  discoverTaskRuns,
  proofProtectedScenarioPaths,
  resolveLivePlanDispatch,
  resolveLiveSpecIdSelection,
  targetAdvanceProofDecisionProblem,
  relevantKnowledgeModelUnchanged,
  shouldReplayScenarioBeforeRunReview,
  shouldReplayReviewedTerminalWriteback,
  taskWorktreeRecoveryDecisionProblem,
  taskWorktreeRecoveryDeadlineDecision,
  terminalLineageReplayDecisionProblem,
  existingRecoveryProblem,
  integrationMode,
  historyOnlyAncestryInput,
  invalidatedRunRequiresSourceChange,
  isNonFastForwardPushFailure,
  liveDispatchTargetRefreshRequired,
  matchingTaskGenerationRuns,
  matchingTaskRuns,
  masterValidationCapacityPulseCycleSlot,
  masterValidationCapacityRetryDue,
  masterValidationCapacityPulseWaitCondition,
  materializePriorRetainedWorkspace,
  mergeAcceptedTargetAdvanceProof,
  noIntegrationDiagnosticContract,
  diagnosticArtifactProblem,
  restoreExactDiagnosticSource,
  pipelineWaitCondition,
  pipelineRunState,
  publishExactDiagnosticTaskBranch,
  registerSpecLiveTrackedRun,
  preparationDecisionProblem,
  preparationHeadProblem,
  priorIntegratedProof,
  replayScenarioNormalizationOntoTarget,
  reconcileRemoteTaskBranchHistory,
  remoteLeaseCommit,
  replayScenarioCandidateForDispatch,
  reconcilePreparedTaskSource,
  reconcileSpecLive,
  resolvePriorVerificationInput,
  scenarioReplayForceWithLeaseArg,
  pullRequestReviewCountCondition,
  pullRequestReviewFingerprintCondition,
  pullRequestReviewTriggeredForJudgment,
  pullRequestSourceUpdateCondition,
  pullRequestWaitCondition,
  pullRequestWaitConditions,
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
  specLiveAgentOperationAllowance,
  shouldFastForwardIntegratedSource,
  shouldReviewBeforeInitialLiveDispatch,
  scenarioNormalizationWaitProblem,
  sourceChangeMayAffectSpec,
  standaloneRetryTargetProblem,
  summarizeSpecPullRequestReview,
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
import { summarizePullRequestReview } from "../../../watchers/aks-pull-request.js";
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

const isolatedAgentWorkspace = mkdtempSync(
  join(tmpdir(), "spec-live-agent-dispatch-"),
);
const isolatedAgentProject = "/app/projects/aks-rp-e2e.app";

type LegacyTestAgentResult = {
  status: "done" | "blocked" | "error" | "interrupted";
  sessionId?: string;
  lastAssistantText?: string;
  structuredResult?: unknown;
};

type TestContextInput = {
  agent?: string;
  task?: string;
  input?: unknown;
  trigger?: AppEvent<Record<string, unknown>>;
  appDir?: string;
  projectDir?: string;
  workspaceDir?: string;
  runAgent?: (
    agent: string,
    prompt: string,
    options?: Record<string, unknown>,
  ) => Promise<LegacyTestAgentResult | undefined>;
};

function taskEnvelope(rawTask: string | undefined): Record<string, unknown> {
  if (!rawTask) return {};
  const fenced = rawTask.match(/```json\s*([\s\S]*?)\s*```/);
  const candidate = fenced?.[1] ?? rawTask.split("\n").slice(1).join("\n");
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function testReconciliation(
  input: TestContextInput,
): TaskReconciliationContext {
  const envelope = taskEnvelope(input.task);
  const children =
    envelope.children &&
    typeof envelope.children === "object" &&
    !Array.isArray(envelope.children)
      ? (envelope.children as Record<string, unknown>)
      : {};
  return {
    appId: "aks-rp-e2e",
    taskId: typeof envelope.taskId === "string" ? envelope.taskId : "spec/test",
    generation:
      typeof envelope.generation === "number" ? envelope.generation : 1,
    resourceVersion: 1,
    agent: input.agent ?? "aks-explorer",
    mode: "achieve",
    outcome:
      typeof envelope.outcome === "string"
        ? envelope.outcome
        : (input.task ?? "Reconcile the bounded spec."),
    acceptance: [],
    input: input.input ?? envelope.input ?? {},
    children: {
      live: Array.isArray(children.live) ? (children.live as never[]) : [],
      completed: Array.isArray(children.completed)
        ? (children.completed as never[])
        : [],
    },
    taskSnapshot: { live: [], truncated: false },
    events: {
      items: input.trigger
        ? [
            {
              observedAt: "2026-08-21T00:00:00.000Z",
              event: input.trigger,
            },
          ]
        : [],
      truncated: false,
    },
  };
}

function isolatedAgentContext(input: TestContextInput): WorkflowContext {
  const reconciliation = testReconciliation(input);
  const runAgent =
    input.runAgent ??
    (async () => ({
      status: "done" as const,
      structuredResult: {
        decision: "needs-agent",
        summary: "Default reconciliation path entered.",
        evidence: ["default-path:entered"],
      },
    }));
  const callAgent = (async (
    agent: string,
    prompt: string,
    options?: Record<string, unknown>,
  ): Promise<ExecutionResult> => {
    const result = await runAgent(agent, prompt, options);
    if (!result) throw new Error("test agent result was exhausted");
    const summary =
      result.lastAssistantText ??
      (result.structuredResult &&
      typeof result.structuredResult === "object" &&
      "summary" in result.structuredResult &&
      typeof result.structuredResult.summary === "string"
        ? result.structuredResult.summary
        : result.status);
    return {
      id: result.sessionId ?? "s_spec_live_test",
      kind: "agent",
      status: result.status,
      summary,
      ...(result.structuredResult !== undefined
        ? { output: result.structuredResult }
        : {}),
    };
  }) as WorkflowContext["agents"]["call"];
  return createTestAppWorkflowContext({
    input: reconciliation.input,
    reconciliation,
    callAgent,
    workspace: {
      appRoot: input.appDir ?? isolatedAgentProject,
      projectRoot: input.projectDir ?? isolatedAgentProject,
      root: input.workspaceDir ?? isolatedAgentWorkspace,
      output: join(input.workspaceDir ?? isolatedAgentWorkspace, ".output"),
    },
    executionId: "wf_spec_live_test",
  });
}

function retainedWorkspaceFixture(): {
  root: string;
  retainedDir: string;
  destinationDir: string;
  baselineCommit: string;
} {
  const root = mkdtempSync(
    join(tmpdir(), "retained-workspace-materialization-"),
  );
  const retainedDir = join(root, "retained");
  const destinationDir = join(root, "destination");
  mkdirSync(retainedDir, { recursive: true });
  const runGit = (cwd: string, args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  runGit(retainedDir, ["init"]);
  runGit(retainedDir, ["config", "user.email", "test@example.com"]);
  runGit(retainedDir, ["config", "user.name", "Test"]);
  writeFileSync(join(retainedDir, "changed.txt"), "before\n");
  writeFileSync(join(retainedDir, "deleted.txt"), "delete me\n");
  runGit(retainedDir, ["add", "changed.txt", "deleted.txt"]);
  runGit(retainedDir, ["commit", "-m", "baseline"]);
  const baselineCommit = runGit(retainedDir, ["rev-parse", "HEAD"]);
  runGit(root, ["clone", retainedDir, destinationDir]);
  runGit(destinationDir, ["config", "user.email", "test@example.com"]);
  runGit(destinationDir, ["config", "user.name", "Test"]);
  return { root, retainedDir, destinationDir, baselineCommit };
}

afterAll(() => {
  rmSync(isolatedAgentWorkspace, { recursive: true, force: true });
});

describe("spec-live-reconciliation workflow", () => {
  test("accepts prepared-source aliases only for the exact one-reproduction no-integration contract", () => {
    const sourceCommit = "a".repeat(40);
    const accepted = noIntegrationDiagnosticContract({
      allowIntegration: false,
      preparedSourceBranch: "refs/heads/task/diagnostic",
      preparedSourceCommit: sourceCommit,
      artifactPath: "/tmp/diagnostic.md",
      specIds: ["spec.sample.a", "spec.sample.b"],
      maxReproductions: 1,
      reproductionConsumed: 0,
    });

    expect(accepted.problem).toBeNull();
    expect(
      noIntegrationDiagnosticContract({
        allowIntegration: true,
        preparedSourceBranch: "task/diagnostic",
        preparedSourceCommit: sourceCommit,
      }),
    ).toEqual({ contract: null, problem: null });
    expect(accepted.contract).toEqual({
      artifactPath: "/tmp/diagnostic.md",
      maxReproductions: 1,
      reproductionConsumed: 0,
      sourceBranch: "task/diagnostic",
      sourceCommit,
      specIds: ["spec.sample.a", "spec.sample.b"],
    });
    expect(
      noIntegrationDiagnosticContract({
        allowIntegration: false,
        preparedSourceBranch: "task/diagnostic",
        preparedSourceCommit: sourceCommit,
        artifactPath: "/tmp/diagnostic.md",
        specIds: ["spec.sample.a", "spec.sample.b"],
        maxReproductions: 2,
        reproductionConsumed: 0,
      }).problem,
    ).toContain("exactly 1");
    expect(
      noIntegrationDiagnosticContract({
        allowIntegration: false,
        preparedSourceBranch: "task/diagnostic",
        preparedSourceCommit: sourceCommit,
        artifactPath: "/tmp/diagnostic.md",
        specIds: ["spec.sample.a", "spec.sample.b"],
        maxReproductions: 1,
        reproductionConsumed: 2,
      }).problem,
    ).toContain("between 0 and maxReproductions");
  });

  test("restores the exact prepared diagnostic commit after proving its remote branch lineage", () => {
    const sourceCommit = "b".repeat(40);
    const calls: string[][] = [];
    const restored = restoreExactDiagnosticSource(
      "/tmp/diagnostic-worktree",
      { sourceBranch: "task/diagnostic", sourceCommit },
      (_cwd, args) => {
        calls.push(args);
        if (args[0] === "rev-parse") {
          return { status: 0, stdout: sourceCommit, stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    );

    expect(restored.accepted).toBe(true);
    expect(calls).toEqual([
      [
        "fetch",
        "origin",
        "+refs/heads/task/diagnostic:refs/remotes/origin/task/diagnostic",
      ],
      [
        "merge-base",
        "--is-ancestor",
        sourceCommit,
        "refs/remotes/origin/task/diagnostic",
      ],
      ["reset", "--hard", sourceCommit],
      ["rev-parse", "HEAD"],
    ]);
    expect(restored.evidence).toContain(
      `diagnostic-source-restored-exact:${sourceCommit}`,
    );
  });

  test("restores an absent-remote diagnostic source only from an exact shared local branch", () => {
    const root = mkdtempSync(join(tmpdir(), "diagnostic-local-source-"));
    const remoteDir = join(root, "remote.git");
    const repoDir = join(root, "repo");
    const workspaceDir = join(root, "workflow-worktree");
    const sourceBranch = "task/diagnostic-local-only";
    const run = (cwd: string, args: string[]) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      return {
        status: result.status ?? 1,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      };
    };
    const mustRun = (cwd: string, args: string[]) => {
      const result = run(cwd, args);
      if (result.status !== 0) throw new Error(result.stderr || result.stdout);
      return result.stdout;
    };
    try {
      mustRun(root, ["init", "--bare", remoteDir]);
      mkdirSync(repoDir, { recursive: true });
      mustRun(repoDir, ["init"]);
      mustRun(repoDir, ["config", "user.email", "test@example.com"]);
      mustRun(repoDir, ["config", "user.name", "Test"]);
      writeFileSync(join(repoDir, "README.md"), "base\n");
      mustRun(repoDir, ["add", "README.md"]);
      mustRun(repoDir, ["commit", "-m", "base"]);
      mustRun(repoDir, ["branch", "-M", "dev"]);
      const baseCommit = mustRun(repoDir, ["rev-parse", "HEAD"]);
      mustRun(repoDir, ["remote", "add", "origin", remoteDir]);
      mustRun(repoDir, ["push", "origin", "dev"]);
      mustRun(repoDir, ["checkout", "-b", sourceBranch]);
      writeFileSync(join(repoDir, "diagnostic.txt"), "prepared\n");
      mustRun(repoDir, ["add", "diagnostic.txt"]);
      mustRun(repoDir, ["commit", "-m", "prepared diagnostic"]);
      const sourceCommit = mustRun(repoDir, ["rev-parse", "HEAD"]);
      mustRun(repoDir, ["push", "origin", sourceBranch]);
      mustRun(repoDir, ["checkout", "dev"]);
      mustRun(repoDir, [
        "worktree",
        "add",
        "--detach",
        workspaceDir,
        baseCommit,
      ]);
      mustRun(repoDir, ["push", "origin", "--delete", sourceBranch]);

      const restored = restoreExactDiagnosticSource(
        workspaceDir,
        { sourceBranch, sourceCommit },
        run,
      );
      expect(restored).toMatchObject({ accepted: true });
      expect(restored.evidence).toEqual(
        expect.arrayContaining([
          `diagnostic-source-local-ref:refs/heads/${sourceBranch}`,
          `diagnostic-source-restored-exact:${sourceCommit}`,
        ]),
      );
      expect(mustRun(workspaceDir, ["rev-parse", "HEAD"])).toBe(sourceCommit);
      expect(mustRun(workspaceDir, ["status", "--porcelain"])).toBe("");

      mustRun(repoDir, ["branch", "-f", sourceBranch, baseCommit]);
      const mismatched = restoreExactDiagnosticSource(
        workspaceDir,
        { sourceBranch, sourceCommit },
        run,
      );
      expect(mismatched.accepted).toBe(false);
      expect(mismatched.problem).toContain(
        "does not contain exact prepared commit",
      );

      mustRun(repoDir, ["branch", "-D", sourceBranch]);
      const missing = restoreExactDiagnosticSource(
        workspaceDir,
        { sourceBranch, sourceCommit },
        run,
      );
      expect(missing.accepted).toBe(false);
      expect(missing.problem).toContain(
        "is absent from the workflow-owned Git ref store",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("publishes an absent diagnostic task branch at only the exact prepared commit", () => {
    const root = mkdtempSync(join(tmpdir(), "diagnostic-publication-"));
    const remoteDir = join(root, "remote.git");
    const workspaceDir = join(root, "workspace");
    const sourceBranch = "task/diagnostic-publication";
    const runGit = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    try {
      runGit(root, ["init", "--bare", remoteDir]);
      mkdirSync(workspaceDir, { recursive: true });
      runGit(workspaceDir, ["init"]);
      runGit(workspaceDir, ["config", "user.email", "test@example.com"]);
      runGit(workspaceDir, ["config", "user.name", "Test"]);
      writeFileSync(join(workspaceDir, "README.md"), "prepared\n");
      runGit(workspaceDir, ["add", "README.md"]);
      runGit(workspaceDir, ["commit", "-m", "prepared diagnostic"]);
      const sourceCommit = runGit(workspaceDir, ["rev-parse", "HEAD"]);
      runGit(workspaceDir, ["branch", sourceBranch]);
      runGit(workspaceDir, ["remote", "add", "origin", remoteDir]);

      const published = publishExactDiagnosticTaskBranch(workspaceDir, {
        sourceBranch,
        sourceCommit,
      });

      expect(published).toMatchObject({ accepted: true });
      expect(published.evidence).toContain(
        `diagnostic-publication-created:refs/heads/${sourceBranch}@${sourceCommit}`,
      );
      expect(
        runGit(root, [
          "--git-dir",
          remoteDir,
          "rev-parse",
          `refs/heads/${sourceBranch}`,
        ]),
      ).toBe(sourceCommit);
      expect(
        spawnSync(
          "git",
          ["--git-dir", remoteDir, "show-ref", "--verify", "refs/heads/dev"],
          { encoding: "utf8" },
        ).status,
      ).not.toBe(0);
      expect(
        spawnSync(
          "git",
          ["--git-dir", remoteDir, "show-ref", "--verify", "refs/heads/main"],
          { encoding: "utf8" },
        ).status,
      ).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("accepts an exact existing diagnostic remote branch without pushing", () => {
    const sourceCommit = "a".repeat(40);
    const calls: string[][] = [];
    const result = publishExactDiagnosticTaskBranch(
      "/tmp/diagnostic-publication-existing",
      { sourceBranch: "task/diagnostic", sourceCommit },
      (_cwd, args) => {
        calls.push(args);
        if (args[0] === "rev-parse") {
          return { status: 0, stdout: sourceCommit, stderr: "" };
        }
        if (args[0] === "ls-remote") {
          return {
            status: 0,
            stdout: `${sourceCommit}\trefs/heads/task/diagnostic`,
            stderr: "",
          };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    );

    expect(result).toMatchObject({ accepted: true });
    expect(result.evidence).toContain(
      `diagnostic-publication-existing-exact:refs/heads/task/diagnostic@${sourceCommit}`,
    );
    expect(calls.some((args) => args[0] === "push")).toBe(false);
  });

  test("fails closed on conflicting, dirty, and non-task diagnostic publication", () => {
    const sourceCommit = "b".repeat(40);
    const conflictingCommit = "c".repeat(40);
    const calls: string[][] = [];
    const conflict = publishExactDiagnosticTaskBranch(
      "/tmp/diagnostic-publication-conflict",
      { sourceBranch: "task/diagnostic", sourceCommit },
      (_cwd, args) => {
        calls.push(args);
        if (args[0] === "rev-parse") {
          return { status: 0, stdout: sourceCommit, stderr: "" };
        }
        if (args[0] === "ls-remote") {
          return {
            status: 0,
            stdout: `${conflictingCommit}\trefs/heads/task/diagnostic`,
            stderr: "",
          };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    );
    expect(conflict.accepted).toBe(false);
    expect(conflict.problem).toContain("conflicts with exact prepared commit");
    expect(calls.some((args) => args[0] === "push")).toBe(false);

    const dirty = publishExactDiagnosticTaskBranch(
      "/tmp/diagnostic-publication-dirty",
      { sourceBranch: "task/diagnostic", sourceCommit },
      (_cwd, args) =>
        args[0] === "status"
          ? { status: 0, stdout: " M README.md", stderr: "" }
          : { status: 0, stdout: sourceCommit, stderr: "" },
    );
    expect(dirty.accepted).toBe(false);
    expect(dirty.problem).toContain("clean workflow-owned worktree");

    const nonTask = publishExactDiagnosticTaskBranch(
      "/tmp/diagnostic-publication-dev",
      { sourceBranch: "dev", sourceCommit },
      () => {
        throw new Error("Git must not run for a non-task branch");
      },
    );
    expect(nonTask.accepted).toBe(false);
    expect(nonTask.problem).toContain("only a dedicated task/* branch");
  });

  test("materializes the exact tracked dirty diff from a retained workspace", () => {
    const fixture = retainedWorkspaceFixture();
    try {
      writeFileSync(join(fixture.retainedDir, "changed.txt"), "after\n");
      rmSync(join(fixture.retainedDir, "deleted.txt"));
      writeFileSync(
        join(fixture.retainedDir, "untracked.txt"),
        "do not transfer\n",
      );

      const result = materializePriorRetainedWorkspace({
        workspaceDir: fixture.destinationDir,
        priorRetainedWorkspace: fixture.retainedDir,
        baselineCommit: fixture.baselineCommit,
      });

      expect(result.accepted).toBe(true);
      expect(result.changedPaths.sort()).toEqual([
        "changed.txt",
        "deleted.txt",
      ]);
      expect(
        readFileSync(join(fixture.destinationDir, "changed.txt"), "utf8"),
      ).toBe("after\n");
      expect(existsSync(join(fixture.destinationDir, "deleted.txt"))).toBe(
        false,
      );
      expect(existsSync(join(fixture.destinationDir, "untracked.txt"))).toBe(
        false,
      );
      expect(
        execFileSync("git", ["diff", "--binary", "HEAD", "--"], {
          cwd: fixture.destinationDir,
          encoding: "utf8",
        }),
      ).toBe(
        execFileSync("git", ["diff", "--binary", "HEAD", "--"], {
          cwd: fixture.retainedDir,
          encoding: "utf8",
        }),
      );
      expect(result.evidence).toContain("retained-diff-materialized:exact");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("loads a divergent prepared source before materializing its three-file retained YAML delta", () => {
    const root = mkdtempSync(join(tmpdir(), "divergent-retained-source-"));
    const remoteDir = join(root, "remote.git");
    const authorDir = join(root, "author");
    const retainedDir = join(root, "retained");
    const destinationDir = join(root, "destination");
    const mismatchedRetainedDir = join(root, "mismatched-retained");
    const yamlPaths = [
      "traffic/api-proxy.yaml",
      "traffic/api-proxy-private.yaml",
      "traffic/api-proxy-zonal.yaml",
    ];
    const runGit = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    try {
      runGit(root, ["init", "--bare", remoteDir]);
      mkdirSync(authorDir, { recursive: true });
      runGit(authorDir, ["init"]);
      runGit(authorDir, ["config", "user.email", "test@example.com"]);
      runGit(authorDir, ["config", "user.name", "Test"]);
      writeFileSync(join(authorDir, "README.md"), "base\n");
      runGit(authorDir, ["add", "README.md"]);
      runGit(authorDir, ["commit", "-m", "base"]);
      const baseCommit = runGit(authorDir, ["rev-parse", "HEAD"]);
      runGit(authorDir, ["branch", "-M", "dev"]);
      runGit(authorDir, ["remote", "add", "origin", remoteDir]);
      runGit(authorDir, ["push", "origin", "dev"]);

      writeFileSync(join(authorDir, "current-dev.txt"), "current dev\n");
      runGit(authorDir, ["add", "current-dev.txt"]);
      runGit(authorDir, ["commit", "-m", "advance dev independently"]);
      const currentDevCommit = runGit(authorDir, ["rev-parse", "HEAD"]);
      runGit(authorDir, ["push", "origin", "dev"]);

      runGit(authorDir, [
        "checkout",
        "-b",
        "task/traffic-api-proxy",
        baseCommit,
      ]);
      for (const yamlPath of yamlPaths) {
        mkdirSync(join(authorDir, yamlPath, ".."), { recursive: true });
        writeFileSync(join(authorDir, yamlPath), "portable: false\n");
      }
      runGit(authorDir, ["add", ...yamlPaths]);
      runGit(authorDir, ["commit", "-m", "prepared traffic API proxy source"]);
      const preparedSourceCommit = runGit(authorDir, ["rev-parse", "HEAD"]);
      runGit(authorDir, ["push", "origin", "task/traffic-api-proxy"]);

      runGit(root, ["clone", remoteDir, retainedDir]);
      runGit(retainedDir, ["checkout", "--detach", preparedSourceCommit]);
      for (const yamlPath of yamlPaths) {
        writeFileSync(join(retainedDir, yamlPath), "portable: true\n");
      }

      runGit(root, ["clone", remoteDir, destinationDir]);
      runGit(destinationDir, ["checkout", "-b", "task/recovery", "origin/dev"]);
      runGit(destinationDir, ["config", "user.email", "test@example.com"]);
      runGit(destinationDir, ["config", "user.name", "Test"]);
      expect(
        spawnSync(
          "git",
          [
            "merge-base",
            "--is-ancestor",
            preparedSourceCommit,
            currentDevCommit,
          ],
          { cwd: destinationDir },
        ).status,
      ).not.toBe(0);

      const prepared = reconcilePreparedTaskSource(destinationDir, {
        sourceBranch: "task/traffic-api-proxy",
        sourceCommit: preparedSourceCommit,
      });
      expect(prepared.state).toBe("merged");

      const materialized = materializePriorRetainedWorkspace({
        workspaceDir: destinationDir,
        priorRetainedWorkspace: retainedDir,
        baselineCommit: preparedSourceCommit,
      });
      expect(materialized.accepted).toBe(true);
      expect(materialized.changedPaths.sort()).toEqual([...yamlPaths].sort());
      runGit(destinationDir, [
        "commit",
        "-am",
        "retain YAML portability delta",
      ]);
      const finalCommit = runGit(destinationDir, ["rev-parse", "HEAD"]);

      expect(
        runGit(destinationDir, [
          "merge-base",
          "--is-ancestor",
          preparedSourceCommit,
          finalCommit,
        ]),
      ).toBe("");
      expect(runGit(destinationDir, ["status", "--porcelain"])).toBe("");
      for (const yamlPath of yamlPaths) {
        expect(readFileSync(join(destinationDir, yamlPath), "utf8")).toBe(
          "portable: true\n",
        );
      }

      runGit(root, ["clone", remoteDir, mismatchedRetainedDir]);
      runGit(mismatchedRetainedDir, ["checkout", "--detach", currentDevCommit]);
      writeFileSync(
        join(mismatchedRetainedDir, "current-dev.txt"),
        "mismatched retained delta\n",
      );
      const mismatched = materializePriorRetainedWorkspace({
        workspaceDir: destinationDir,
        priorRetainedWorkspace: mismatchedRetainedDir,
        baselineCommit: preparedSourceCommit,
      });
      expect(mismatched.accepted).toBe(false);
      expect(mismatched.problem).toContain(
        "priorRetainedWorkspace HEAD does not match baselineCommit",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("recovers an absent-remote prepared source only from exact local retained ownership", () => {
    const root = mkdtempSync(join(tmpdir(), "local-only-retained-source-"));
    const remoteDir = join(root, "remote.git");
    const authorDir = join(root, "author");
    const retainedDir = join(root, "retained");
    const destinationDir = join(root, "destination");
    const sourceBranch =
      "task/domain-master-validation-failure-spec.traffic-api-proxy.toggle";
    const trackedPaths = [
      "bun.lock",
      "features/traffic-api-proxy/lib/api-proxy-master-validation-live.ts",
      "package.json",
    ];
    const runGit = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    try {
      runGit(root, ["init", "--bare", remoteDir]);
      mkdirSync(authorDir, { recursive: true });
      runGit(authorDir, ["init"]);
      runGit(authorDir, ["config", "user.email", "test@example.com"]);
      runGit(authorDir, ["config", "user.name", "Test"]);
      writeFileSync(join(authorDir, "README.md"), "base\n");
      runGit(authorDir, ["add", "README.md"]);
      runGit(authorDir, ["commit", "-m", "base"]);
      runGit(authorDir, ["branch", "-M", "dev"]);
      runGit(authorDir, ["remote", "add", "origin", remoteDir]);
      runGit(authorDir, ["push", "origin", "dev"]);

      runGit(authorDir, ["checkout", "-b", sourceBranch]);
      for (const path of trackedPaths) {
        mkdirSync(join(authorDir, path, ".."), { recursive: true });
        writeFileSync(join(authorDir, path), `prepared:${path}\n`);
      }
      runGit(authorDir, ["add", ...trackedPaths]);
      runGit(authorDir, ["commit", "-m", "prepared traffic source"]);
      const sourceCommit = runGit(authorDir, ["rev-parse", "HEAD"]);
      runGit(authorDir, ["push", "origin", sourceBranch]);
      runGit(authorDir, ["checkout", "dev"]);
      runGit(authorDir, ["worktree", "add", retainedDir, sourceBranch]);
      for (const path of trackedPaths) {
        writeFileSync(join(retainedDir, path), `portable:${path}\n`);
      }
      runGit(authorDir, ["push", "origin", "--delete", sourceBranch]);
      writeFileSync(join(authorDir, "current-dev.txt"), "advanced dev\n");
      runGit(authorDir, ["add", "current-dev.txt"]);
      runGit(authorDir, ["commit", "-m", "advance dev"]);
      runGit(authorDir, ["push", "origin", "dev"]);

      runGit(root, ["clone", remoteDir, destinationDir]);
      runGit(destinationDir, ["checkout", "-b", "task/recovery", "origin/dev"]);
      runGit(destinationDir, ["config", "user.email", "test@example.com"]);
      runGit(destinationDir, ["config", "user.name", "Test"]);
      expect(
        runGit(destinationDir, [
          "ls-remote",
          "--heads",
          "origin",
          sourceBranch,
        ]),
      ).toBe("");

      const prepared = reconcilePreparedTaskSource(
        destinationDir,
        { sourceBranch, sourceCommit },
        undefined,
        { workspaceDir: retainedDir, baselineCommit: sourceCommit },
      );
      expect(prepared.state).toBe("merged");
      const materialized = materializePriorRetainedWorkspace({
        workspaceDir: destinationDir,
        priorRetainedWorkspace: retainedDir,
        baselineCommit: sourceCommit,
      });
      expect(materialized).toMatchObject({
        accepted: true,
        changedPaths: trackedPaths,
      });
      runGit(destinationDir, ["commit", "-am", "materialize retained delta"]);
      const finalCommit = runGit(destinationDir, ["rev-parse", "HEAD"]);
      expect(
        spawnSync(
          "git",
          ["merge-base", "--is-ancestor", sourceCommit, finalCommit],
          {
            cwd: destinationDir,
          },
        ).status,
      ).toBe(0);
      expect(runGit(destinationDir, ["status", "--porcelain"])).toBe("");
      for (const path of trackedPaths) {
        expect(readFileSync(join(destinationDir, path), "utf8")).toBe(
          `portable:${path}\n`,
        );
      }

      const mismatch = reconcilePreparedTaskSource(
        destinationDir,
        { sourceBranch, sourceCommit },
        undefined,
        { workspaceDir: retainedDir, baselineCommit: "f".repeat(40) },
      );
      expect(mismatch).toMatchObject({
        state: "failed",
        error:
          "local retained prepared source HEAD, sourceCommit, and baselineCommit must match exactly",
      });
      const unrelated = reconcilePreparedTaskSource(
        destinationDir,
        { sourceBranch, sourceCommit },
        undefined,
        { workspaceDir: authorDir, baselineCommit: sourceCommit },
      );
      expect(unrelated).toMatchObject({
        state: "failed",
        error:
          "local retained prepared source branch does not match sourceBranch",
      });
      const nonWorktree = reconcilePreparedTaskSource(
        destinationDir,
        { sourceBranch, sourceCommit },
        undefined,
        { workspaceDir: root, baselineCommit: sourceCommit },
      );
      expect(nonWorktree).toMatchObject({
        state: "failed",
        error: "local retained prepared source is not a Git worktree root",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects a retained workspace whose HEAD moved past the declared baseline", () => {
    const fixture = retainedWorkspaceFixture();
    try {
      writeFileSync(join(fixture.retainedDir, "changed.txt"), "new commit\n");
      execFileSync("git", ["add", "changed.txt"], { cwd: fixture.retainedDir });
      execFileSync("git", ["commit", "-m", "advance retained head"], {
        cwd: fixture.retainedDir,
      });

      const result = materializePriorRetainedWorkspace({
        workspaceDir: fixture.destinationDir,
        priorRetainedWorkspace: fixture.retainedDir,
        baselineCommit: fixture.baselineCommit,
      });

      expect(result.accepted).toBe(false);
      expect(result.problem).toContain(
        "priorRetainedWorkspace HEAD does not match baselineCommit",
      );
      expect(result.evidence).toContain(
        `baseline-commit:${fixture.baselineCommit}`,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("rejects a destination HEAD outside the retained baseline lineage", () => {
    const fixture = retainedWorkspaceFixture();
    try {
      writeFileSync(
        join(fixture.retainedDir, "changed.txt"),
        "retained change\n",
      );
      execFileSync("git", ["checkout", "--orphan", "unrelated"], {
        cwd: fixture.destinationDir,
      });
      execFileSync("git", ["rm", "-rf", "."], {
        cwd: fixture.destinationDir,
      });
      writeFileSync(
        join(fixture.destinationDir, "unrelated.txt"),
        "unrelated history\n",
      );
      execFileSync("git", ["add", "unrelated.txt"], {
        cwd: fixture.destinationDir,
      });
      execFileSync("git", ["commit", "-m", "unrelated destination"], {
        cwd: fixture.destinationDir,
      });
      const destinationHead = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: fixture.destinationDir,
        encoding: "utf8",
      }).trim();

      const result = materializePriorRetainedWorkspace({
        workspaceDir: fixture.destinationDir,
        priorRetainedWorkspace: fixture.retainedDir,
        baselineCommit: fixture.baselineCommit,
      });

      expect(result.accepted).toBe(false);
      expect(result.problem).toContain(
        "baselineCommit is not an ancestor of isolated destination HEAD",
      );
      expect(result.evidence).toContain(`destination-head:${destinationHead}`);
      expect(result.evidence).toContain(
        "retained-baseline-ancestry:not-ancestor",
      );
      expect(
        execFileSync("git", ["status", "--porcelain"], {
          cwd: fixture.destinationDir,
          encoding: "utf8",
        }),
      ).toBe("");
      expect(
        readFileSync(join(fixture.destinationDir, "unrelated.txt"), "utf8"),
      ).toBe("unrelated history\n");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("transfers a retained tracked patch onto an advanced destination HEAD", () => {
    const fixture = retainedWorkspaceFixture();
    try {
      writeFileSync(
        join(fixture.retainedDir, "changed.txt"),
        "retained change\n",
      );
      writeFileSync(
        join(fixture.destinationDir, "destination.txt"),
        "advance\n",
      );
      execFileSync("git", ["add", "destination.txt"], {
        cwd: fixture.destinationDir,
      });
      execFileSync("git", ["commit", "-m", "advance destination head"], {
        cwd: fixture.destinationDir,
      });
      const destinationHead = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: fixture.destinationDir,
        encoding: "utf8",
      }).trim();

      const result = materializePriorRetainedWorkspace({
        workspaceDir: fixture.destinationDir,
        priorRetainedWorkspace: fixture.retainedDir,
        baselineCommit: fixture.baselineCommit,
      });

      expect(result.accepted).toBe(true);
      expect(destinationHead).not.toBe(fixture.baselineCommit);
      expect(
        readFileSync(join(fixture.destinationDir, "changed.txt"), "utf8"),
      ).toBe("retained change\n");
      expect(result.evidence).toContain(
        `destination-initial-head:${destinationHead}`,
      );
      expect(result.evidence).toContain("retained-baseline-ancestry:ancestor");
      expect(result.evidence).toContain(
        "retained-diff-operation:git-apply-3way-index",
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("reproduces the LocalDNS bcbc79c retained patch transfer onto advanced 7f14b3b", () => {
    const baselineCommit = "bcbc79cbc4b41a68bf9d94d836b5abe15cd1fdf1";
    const advancedCommit = "7f14b3b558a001614ff04189cbb49a1e4119c1d7";
    const sourceRepo = "/app/projects/aks-rp-e2e";
    const trackedFile = "features/localdns/lib/localdns-os-arch-matrix.ts";
    const root = mkdtempSync(join(tmpdir(), "localdns-retained-regression-"));
    const retainedDir = join(root, "retained");
    const destinationDir = join(root, "destination");
    const runGit = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    const sourceCommonDir = runGit(sourceRepo, [
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    const initializeSparseCheckout = (directory: string, commit: string) => {
      mkdirSync(directory, { recursive: true });
      runGit(directory, ["init", "--quiet"]);
      mkdirSync(join(directory, ".git", "objects", "info"), {
        recursive: true,
      });
      mkdirSync(join(directory, ".git", "info"), { recursive: true });
      writeFileSync(
        join(directory, ".git", "objects", "info", "alternates"),
        `${join(sourceCommonDir, "objects")}\n`,
      );
      runGit(directory, ["config", "core.sparseCheckout", "true"]);
      writeFileSync(
        join(directory, ".git", "info", "sparse-checkout"),
        `${trackedFile}\n`,
      );
      runGit(directory, ["checkout", "--detach", commit]);
    };
    try {
      initializeSparseCheckout(retainedDir, baselineCommit);
      initializeSparseCheckout(destinationDir, advancedCommit);

      const filePath = join(retainedDir, trackedFile);
      let source = readFileSync(filePath, "utf8");
      const replacements: Array<[string, string]> = [
        [
          'import { expectProjectResult, recordTestResult, type ProjectTestResult } from "../../../runner/vitest-runtime/index.ts";',
          'import { resolvedTargetInputIssues, resolvedTargetInputs } from "../../../runner/scenario-lib/resolved-target.ts";\nimport { type ProjectTestResult } from "../../../runner/vitest-runtime/index.ts";',
        ],
        [
          'const subscriptionId = process.env.AKS_RP_E2E_SUBSCRIPTION_ID || "26fe00f8-9173-4872-9134-bb1d2e00343a";\nconst location = process.env.AKS_RP_E2E_LOCATION || "eastus2";\nconst apiVersion = process.env.AKS_RP_E2E_API_VERSION || "2025-04-02-preview";',
          "const resolvedTarget = resolvedTargetInputs();\nconst targetInputIssues = resolvedTargetInputIssues(resolvedTarget);\nconst subscriptionId = resolvedTarget.subscriptionId;\nconst location = resolvedTarget.location;\nconst apiVersion = resolvedTarget.apiVersion;",
        ],
        [
          "const allowedVariantNames = new Set(osArchVariants.map((variant) => variant.name));",
          'export const localDnsOsArchFipsContract = {\n  variantName: "fips",\n  specId: "spec.localdns.osarch-fips",\n  featurePathId: "path.localdns.fips",\n  poolRequirements: { osSKU: "AzureLinux", architecture: "x64", enableFIPS: true },\n  assertionIds: ["assert.fips.localdns-active", "assert.fips.dns-resolves"],\n} as const;\n\nconst allowedVariantNames = new Set(osArchVariants.map((variant) => variant.name));',
        ],
      ];
      for (const [before, after] of replacements) {
        expect(source).toContain(before);
        source = source.replace(before, after);
      }
      writeFileSync(filePath, source);

      const result = materializePriorRetainedWorkspace({
        workspaceDir: destinationDir,
        priorRetainedWorkspace: retainedDir,
        baselineCommit,
      });
      const transferred = readFileSync(
        join(destinationDir, trackedFile),
        "utf8",
      );

      expect(result.accepted).toBe(true);
      expect(result.changedPaths).toEqual([trackedFile]);
      expect(result.evidence).toContain(`retained-baseline:${baselineCommit}`);
      expect(result.evidence).toContain(
        `destination-initial-head:${advancedCommit}`,
      );
      for (const required of [
        "resolvedTargetInputs",
        "resolvedTargetInputIssues",
        "localDnsOsArchFipsContract",
        "enableFIPS: true",
        "assert.fips.localdns-active",
        "assert.fips.dns-resolves",
      ]) {
        expect(transferred).toContain(required);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails safely and restores the advanced destination when the retained patch conflicts", () => {
    const fixture = retainedWorkspaceFixture();
    try {
      writeFileSync(
        join(fixture.retainedDir, "changed.txt"),
        "retained side\n",
      );
      writeFileSync(
        join(fixture.destinationDir, "changed.txt"),
        "destination side\n",
      );
      execFileSync("git", ["add", "changed.txt"], {
        cwd: fixture.destinationDir,
      });
      execFileSync("git", ["commit", "-m", "conflicting destination advance"], {
        cwd: fixture.destinationDir,
      });
      const destinationHead = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: fixture.destinationDir,
        encoding: "utf8",
      }).trim();

      const result = materializePriorRetainedWorkspace({
        workspaceDir: fixture.destinationDir,
        priorRetainedWorkspace: fixture.retainedDir,
        baselineCommit: fixture.baselineCommit,
      });

      expect(result.accepted).toBe(false);
      expect(result.problem).toContain(
        "conflicts with advanced destination lineage",
      );
      expect(result.evidence).toContain("destination-restore:clean");
      expect(
        execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: fixture.destinationDir,
          encoding: "utf8",
        }).trim(),
      ).toBe(destinationHead);
      expect(
        execFileSync("git", ["status", "--porcelain"], {
          cwd: fixture.destinationDir,
          encoding: "utf8",
        }),
      ).toBe("");
      expect(
        readFileSync(join(fixture.destinationDir, "changed.txt"), "utf8"),
      ).toBe("destination side\n");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("rejects a dirty destination without overwriting its changes", () => {
    const fixture = retainedWorkspaceFixture();
    try {
      writeFileSync(
        join(fixture.retainedDir, "changed.txt"),
        "retained change\n",
      );
      writeFileSync(
        join(fixture.destinationDir, "changed.txt"),
        "destination change\n",
      );

      const result = materializePriorRetainedWorkspace({
        workspaceDir: fixture.destinationDir,
        priorRetainedWorkspace: fixture.retainedDir,
        baselineCommit: fixture.baselineCommit,
      });

      expect(result.accepted).toBe(false);
      expect(result.problem).toContain("isolated destination is dirty");
      expect(
        readFileSync(join(fixture.destinationDir, "changed.txt"), "utf8"),
      ).toBe("destination change\n");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("leaves the destination unchanged when no retained workspace is supplied", () => {
    const fixture = retainedWorkspaceFixture();
    try {
      const beforeStatus = execFileSync("git", ["status", "--porcelain"], {
        cwd: fixture.destinationDir,
        encoding: "utf8",
      });
      const result = materializePriorRetainedWorkspace({
        workspaceDir: fixture.destinationDir,
        priorRetainedWorkspace: undefined,
        baselineCommit: undefined,
      });

      expect(result).toEqual({
        requested: false,
        accepted: true,
        changedPaths: [],
        evidence: ["prior-retained-workspace:not-requested"],
      });
      expect(
        execFileSync("git", ["status", "--porcelain"], {
          cwd: fixture.destinationDir,
          encoding: "utf8",
        }),
      ).toBe(beforeStatus);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("prevents duplicate retained-diff materialization in the same run", () => {
    const fixture = retainedWorkspaceFixture();
    try {
      writeFileSync(
        join(fixture.retainedDir, "changed.txt"),
        "materialize once\n",
      );
      const input = {
        workspaceDir: fixture.destinationDir,
        priorRetainedWorkspace: fixture.retainedDir,
        baselineCommit: fixture.baselineCommit,
      };

      const first = materializePriorRetainedWorkspace(input);
      const diffAfterFirst = execFileSync(
        "git",
        ["diff", "--binary", "HEAD", "--"],
        { cwd: fixture.destinationDir, encoding: "utf8" },
      );
      const second = materializePriorRetainedWorkspace(input);
      const diffAfterSecond = execFileSync(
        "git",
        ["diff", "--binary", "HEAD", "--"],
        { cwd: fixture.destinationDir, encoding: "utf8" },
      );

      expect(first.accepted).toBe(true);
      expect(second.accepted).toBe(false);
      expect(second.problem).toContain("isolated destination is dirty");
      expect(diffAfterSecond).toBe(diffAfterFirst);
      expect(
        readFileSync(join(fixture.destinationDir, "changed.txt"), "utf8"),
      ).toBe("materialize once\n");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("accepts a complete non-green diagnostic artifact without requiring a passing result", () => {
    const root = mkdtempSync(join(tmpdir(), "no-integration-artifact-"));
    try {
      const artifactPath = join(root, "diagnostic.md");
      const sourceCommit = "c".repeat(40);
      const resultPaths = [join(root, "a.json"), join(root, "b.json")];
      const cleanupPath = resultPaths[1];
      writeFileSync(
        artifactPath,
        [
          `Tested commit: ${sourceCommit}`,
          "Pipeline run ID: 175125000",
          `Result path: ${resultPaths[0]}`,
          `Result path: ${resultPaths[1]}`,
          `Cleanup proof: ${cleanupPath}`,
          "Assertion mapping: aggregate request reached the expected failing assertion",
          "Lineage mapping: exact prepared source",
          `Request fingerprint: sha256:${"d".repeat(64)}`,
          "HTTP status: 400",
          "ARM code: InvalidParameter",
          "Redacted ARM body: { message: redacted product rejection }",
          "Disposition: product/API rejection",
        ].join("\n"),
      );

      expect(
        diagnosticArtifactProblem({
          artifactPath,
          sourceCommit,
          runId: "175125000",
          specIds: ["spec.sample.a", "spec.sample.b"],
          resultPaths,
          cleanupPaths: [cleanupPath],
        }),
      ).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("routes only allowIntegration=false into diagnostics and leaves the default reconciliation path unchanged", async () => {
    const root = mkdtempSync(join(tmpdir(), "no-integration-routing-"));
    try {
      const repoDir = join(root, "repo");
      const workspaceDir = join(root, "workspace");
      for (const directory of [repoDir, workspaceDir]) {
        mkdirSync(directory, { recursive: true });
        execFileSync("git", ["init"], { cwd: directory });
        execFileSync("git", ["config", "user.email", "test@example.com"], {
          cwd: directory,
        });
        execFileSync("git", ["config", "user.name", "Test"], {
          cwd: directory,
        });
        writeFileSync(join(directory, "README.md"), "base\n");
        execFileSync("git", ["add", "README.md"], { cwd: directory });
        execFileSync("git", ["commit", "-m", "base"], { cwd: directory });
        execFileSync("git", ["branch", "-M", "dev"], { cwd: directory });
        execFileSync("git", ["remote", "add", "origin", directory], {
          cwd: directory,
        });
      }
      const taskFor = (allowIntegration: boolean | undefined) =>
        [
          "## Reconciliation Task",
          JSON.stringify({
            taskId: "domain/no-integration-routing",
            generation: 1,
            input: {
              specIds: ["spec.sample.a", "spec.sample.b"],
              ...(allowIntegration === undefined ? {} : { allowIntegration }),
              preparedSourceBranch: "not-a-task-branch",
              preparedSourceCommit: "e".repeat(40),
              artifactPath: "/tmp/diagnostic.md",
              maxReproductions: 1,
              reproductionConsumed: 0,
            },
            children: { live: [], completed: [] },
          }),
        ].join("\n");
      const contextFor = (task: string) =>
        isolatedAgentContext({
          agent: "aks-explorer",
          task,
          projectDir: repoDir,
          workspaceDir,
          runAgent: async () => {
            throw new Error("runAgent should not be called");
          },
        });

      const diagnostic = await reconcileSpecLive(contextFor(taskFor(false)));
      expect(diagnostic.output?.summary).toContain(
        "Invalid no-integration diagnostic contract",
      );
      expect(diagnostic.output?.evidence).toContain(
        "integration:not-attempted",
      );

      const explicitlyIntegrating = await reconcileSpecLive(
        isolatedAgentContext({
          agent: "aks-explorer",
          task: taskFor(true),
          projectDir: repoDir,
          workspaceDir,
          runAgent: async () => ({
            status: "done" as const,
            structuredResult: {
              decision: "needs-agent" as const,
              summary: "Default reconciliation path entered.",
              evidence: ["default-path:entered"],
            },
          }),
        }),
      );
      expect(explicitlyIntegrating.output?.summary).toContain(
        "Default reconciliation path entered",
      );
      expect(explicitlyIntegrating.output?.evidence).not.toContain(
        "diagnostic-publication-branch:not-a-task-branch",
      );

      const defaultContract = noIntegrationDiagnosticContract(
        JSON.parse(taskFor(undefined).split("\n")[1]!).input,
      );
      expect(defaultContract).toEqual({ contract: null, problem: null });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 15_000);

  const runNoIntegrationLifecycle = (
    mode: "consumed" | "terminal" | "omitted" | "dirty",
  ) => {
    const childRoot = mkdtempSync(join(tmpdir(), `no-integration-${mode}-`));
    const childScript = join(childRoot, "run.mjs");
    try {
      writeFileSync(
        childScript,
        ` import { execFileSync } from "node:child_process"; import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; const mode=${JSON.stringify(mode)}; const root=mkdtempSync(join(tmpdir(),"no-integration-life-")); const remote=join(root,"remote.git"); const seed=join(root,"seed"); const repoDir=join(root,"repo"); const workspaceDir=join(root,"workspace"); const appDir=join(root,"app"); const binDir=join(root,"bin"); const azLog=join(root,"az.log"); const artifactPath=join(root,"diagnostic.md"); const run=(cwd,args)=>execFileSync("git",args,{cwd,encoding:"utf8"}).trim(); mkdirSync(seed,{recursive:true}); mkdirSync(appDir,{recursive:true}); mkdirSync(binDir,{recursive:true}); writeFileSync(azLog,""); run(root,["init","--bare",remote]); run(seed,["init"]); run(seed,["config","user.email","test@example.com"]); run(seed,["config","user.name","Test"]); writeFileSync(join(seed,"README.md"),"base\\\\n"); run(seed,["add","README.md"]); run(seed,["commit","-m","base"]); run(seed,["branch","-M","dev"]); run(seed,["remote","add","origin",remote]); run(seed,["push","origin","dev"]); run(seed,["checkout","-b","task/diagnostic"]); writeFileSync(join(seed,"diagnostic.txt"),"prepared\\\\n"); run(seed,["add","diagnostic.txt"]); run(seed,["commit","-m","prepared diagnostic"]); const sourceCommit=run(seed,["rev-parse","HEAD"]); run(seed,["push","origin","task/diagnostic"]); run(root,["clone",remote,repoDir]); run(repoDir,["checkout","dev"]); run(root,["clone",remote,workspaceDir]); run(workspaceDir,["checkout","task/diagnostic"]); run(workspaceDir,["config","user.email","test@example.com"]); run(workspaceDir,["config","user.name","Test"]); writeFileSync(join(binDir,"az"),\`#!/usr/bin/env node
const fs=require("node:fs"); const path=require("node:path"); const args=process.argv.slice(2); const mode=process.env.NO_INTEGRATION_MODE; const commit=process.env.DIAGNOSTIC_COMMIT; fs.appendFileSync(process.env.FAKE_AZ_LOG,JSON.stringify(args)+"\\\\n"); const metadata={taskId:"domain/no-integration-life",generation:1,sourceCommit:commit,reviewed_source_commit:commit}; const run={id:"175125000",state:"completed",status:"completed",result:"failed",sourceVersion:commit,templateParameters:{specs:"spec.sample.a,spec.sample.b",target:"staging",standalone_build_id:"",metadata:JSON.stringify(metadata)}}; if(mode==="terminal"&&args[0]==="pipelines"&&args[1]==="runs"&&args[2]!=="artifact"&&args.includes("list")) process.stdout.write(JSON.stringify([run])); else if(mode==="terminal"&&args[0]==="pipelines"&&args[1]==="runs"&&args.includes("artifact")&&args.includes("list")) process.stdout.write(JSON.stringify([{name:"diagnostic"}])); else if(mode==="terminal"&&args[0]==="pipelines"&&args[1]==="runs"&&args.includes("artifact")&&args.includes("download")){const out=args[args.indexOf("--path")+1]; fs.mkdirSync(out,{recursive:true}); for(const id of ["spec.sample.a","spec.sample.b"]) fs.writeFileSync(path.join(out,id+".json"),JSON.stringify({specId:id,status:"pass",cleanup:{attempted:true,status:"pass"}})); process.stdout.write("{}");} else process.stdout.write("[]"); \`,{mode:0o755}); process.env.NO_INTEGRATION_MODE=mode; process.env.DIAGNOSTIC_COMMIT=sourceCommit; process.env.FAKE_AZ_LOG=azLog; process.env.AZURE_CLI_PATH=join(binDir,"az"); const {reconcileSpecLive}=await import(${JSON.stringify(`file://${join(import.meta.dir, "spec-live-reconciliation.ts")}`)}); const input={ specIds:["spec.sample.a","spec.sample.b"], preparedSourceBranch:"task/diagnostic", preparedSourceCommit:sourceCommit,artifactPath,maxReproductions:1,reproductionConsumed:mode==="consumed"?1:0,...(mode==="omitted"?{}:{allowIntegration:false})}; const {createSpecLiveTestContext}=await import(${JSON.stringify(`file://${join(import.meta.dir, "lib/spec-live-test-context.ts")}`)}); let agentCalls=0; if(mode==="dirty") writeFileSync(join(workspaceDir,"README.md"),"dirty\\n"); const beforeHead=run(workspaceDir,["rev-parse","HEAD"]); const resultEnvelope=await reconcileSpecLive(createSpecLiveTestContext({taskId:"domain/no-integration-life",input,appRoot:appDir,projectRoot:repoDir,workspaceRoot:workspaceDir,callAgent:async(_agent,prompt)=>{agentCalls++; if(mode==="terminal"){const match=prompt.match(/Per-spec result paths: (.+)\. Structural cleanup paths: (.+)\./); const paths=match[1].split(", "); writeFileSync(artifactPath,["Tested commit: "+sourceCommit,"Pipeline run ID: 175125000",...paths.map(p=>"Result path: "+p),"Cleanup proof: "+match[2].split(", ")[0],"Assertion mapping: expected failure","Lineage mapping: exact prepared source","Request fingerprint: sha256:"+"d".repeat(64),"HTTP status: 400","ARM code: InvalidParameter","Redacted ARM body: redacted","Disposition: product/API rejection"].join(String.fromCharCode(10))); const output={decision:"accepted-pass",summary:"Published complete non-green diagnostic.",evidence:["diagnostic:complete"]}; return {id:"s_diagnostic_test",kind:"agent",status:"done",summary:output.summary,output};} const output={decision:"needs-agent",summary:"Default reconciliation path entered.",evidence:["default-path:entered"]}; return {id:"s_default_test",kind:"agent",status:"done",summary:output.summary,output};}})); const result=resultEnvelope.output; const commands=readFileSync(azLog,"utf8").trim().split(/\\n+/).filter(Boolean).map(JSON.parse); console.log(JSON.stringify({result,commands,agentCalls,beforeHead,afterHead:run(workspaceDir,["rev-parse","HEAD"])})); rmSync(root,{recursive:true,force:true}); `,
      );
      const child = spawnSync("bun", [childScript], {
        cwd: import.meta.dir,
        encoding: "utf8",
        env: { ...process.env },
      });
      if (child.status !== 0) throw new Error(child.stderr || child.stdout);
      return JSON.parse(child.stdout.trim());
    } finally {
      rmSync(childRoot, { recursive: true, force: true });
    }
  };
  test("does not queue when the no-integration reproduction budget is consumed", () => {
    const output = runNoIntegrationLifecycle("consumed");
    expect(
      output.commands.some(
        (args: string[]) => args[0] === "pipelines" && args[1] === "run",
      ),
    ).toBe(false);
    expect(output.result.evidence).toEqual(
      expect.arrayContaining([
        "pipeline-run:not-created",
        "reproduction-consumed:1",
        "max-reproductions:1",
      ]),
    );
  });
  test("rejects a dirty diagnostic worktree before source restoration or dispatch", () => {
    const output = runNoIntegrationLifecycle("dirty");
    expect(output.afterHead).toBe(output.beforeHead);
    expect(output.result.summary).toContain(
      "No-integration diagnostic refused a dirty workflow-owned worktree",
    );
    expect(
      output.commands.some(
        (args: string[]) => args[0] === "pipelines" && args[1] === "run",
      ),
    ).toBe(false);
  });
  test("accepts a complete non-green terminal diagnostic without integration", () => {
    const output = runNoIntegrationLifecycle("terminal");
    expect(output.afterHead).toBe(output.beforeHead);
    expect(output.result.evidence).toEqual(
      expect.arrayContaining([
        "integration:not-attempted",
        "pull-request:not-created",
        "target-ref-advance:not-attempted",
      ]),
    );
    expect(output.result.state).toBe("converged");
  });
  test("does not enter diagnostic reconciliation when allowIntegration is omitted", () => {
    const output = runNoIntegrationLifecycle("omitted");
    expect(output.agentCalls).toBeGreaterThan(0);
    expect(output.result.summary).toContain(
      "Default reconciliation path entered",
    );
    expect(output.result.evidence).not.toContain("pipeline-run:not-created");
  });
  test("uses the watcher review normalization and judges only the matching new fingerprint", () => {
    const payload = {
      value: [
        {
          id: 255471269,
          status: "active",
          threadContext: {
            filePath:
              "/features/node-ephemeral-os-disk/tests/node-ephemeral-disk-master-validation.test.ts",
          },
          comments: [
            {
              commentType: "text",
              author: { displayName: "GitOps (Git LowPriv)" },
              content:
                "<p>PR Assistant PR Assistant PR Assistant</p><div>Please keep the assertion tied to the exact node-pool object.</div>",
            },
          ],
        },
      ],
    };
    const watcherReview = summarizePullRequestReview(payload);
    const workflowReview = summarizeSpecPullRequestReview(payload);

    expect(workflowReview).toEqual(watcherReview);
    expect(workflowReview.threads[0]?.content).toBe(
      "Please keep the assertion tied to the exact node-pool object.",
    );

    const trigger = {
      type: "pull-request.state",
      data: {
        pullRequestId: "16706118",
        reviewFingerprint: watcherReview.fingerprint,
      },
    };
    expect(
      pullRequestReviewTriggeredForJudgment(
        trigger,
        "16706118",
        workflowReview,
      ),
    ).toBe(true);
    expect(
      pullRequestReviewTriggeredForJudgment(
        trigger,
        "16705929",
        workflowReview,
      ),
    ).toBe(false);
    expect(
      pullRequestReviewTriggeredForJudgment(
        {
          ...trigger,
          data: { ...trigger.data, reviewFingerprint: "stale-fingerprint" },
        },
        "16706118",
        workflowReview,
      ),
    ).toBe(false);
  });

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

      writeFileSync(
        join(root, scenarioTestPath),
        [
          'import { test } from "vitest";',
          'import { runScenario } from "../lib/ccp-daily-master.ts";',
          'const executeFlag = "--execute";',
          'const execFileToken = ["exec", "File("].join("");',
          "const bunChildLaunchToken = ['run(\"', 'bun\"'].join(\"\");",
          'test("direct", () => runScenario(executeFlag));',
        ].join("\n"),
      );
      const negativeAssertionTokens = evaluate();
      expect(negativeAssertionTokens.accepted).toBe(true);
      expect(negativeAssertionTokens.remainingIssueCodes).toEqual([]);
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
      "official Learn, Azure REST API specs, and checked-in design docs",
    );
    expect(scenarioQualityRepairInstruction).toContain(
      "mounted AKS RP or Go source as implementation evidence only",
    );
    expect(scenarioQualityRepairInstruction).toContain(
      "private/local filesystem path as carrier authority",
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
    expect(
      compactPlanPipelineParameters(
        "ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
      ),
    ).toEqual([
      "plan_path=ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
    ]);
    expect(compactPlanPipelineParameters("")).toEqual([]);
    expect(() =>
      compactPlanPipelineParameters("runs/plans/untrusted.json"),
    ).toThrow("Invalid compact live plan path");
  });

  test("resolves the Cross-17 required checked-in plan into queue evidence when livePlanPath is absent", () => {
    expect(
      resolveLivePlanDispatch({
        taskInput: {
          specId:
            "spec.managed-namespaces.lifecycle,spec.node-image.profile-upgrade-validation,spec.ossku-migration.ubuntu-to-azurelinux,spec.secure-tls-bootstrap.vnet-integration,spec.secure-tls-bootstrap.network-isolated,spec.network-cni.azure-overlay,spec.cloud-provider.ccm-lifecycle,spec.cloud-provider.multiple-slb,spec.storage-csi.encryption-at-host,spec.kms.v2-public-cluster-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-vnet-integration,spec.kms.v2plus-create-cmk-custom-vnet,spec.kms.v2plus-pmk-migrate-cmk-public-kv-lifecycle,spec.private-cluster.apiserver-vnet-integration-create,spec.virtualmachines.mixed-sku-upgrade,spec.deployment-safeguards.basic-enable-disable",
          postPlanPathRepairVerification: {
            requiredPlanPath:
              "ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
          },
        },
      }),
    ).toEqual({
      planPath:
        "ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
      source: "postPlanPathRepairVerification.requiredPlanPath",
      evidence: [
        "live-plan-path:ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
        "live-plan-path-source:postPlanPathRepairVerification.requiredPlanPath",
      ],
    });
  });

  test("queues the checked-in 17-selector ci plan into actual ADO template parameters", () => {
    const livePlanDispatch = resolveLivePlanDispatch({
      taskInput: {
        specId:
          "spec.managed-namespaces.lifecycle,spec.node-image.profile-upgrade-validation,spec.ossku-migration.ubuntu-to-azurelinux,spec.secure-tls-bootstrap.vnet-integration,spec.secure-tls-bootstrap.network-isolated,spec.network-cni.azure-overlay,spec.cloud-provider.ccm-lifecycle,spec.cloud-provider.multiple-slb,spec.storage-csi.encryption-at-host,spec.kms.v2-public-cluster-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-vnet-integration,spec.kms.v2plus-create-cmk-custom-vnet,spec.kms.v2plus-pmk-migrate-cmk-public-kv-lifecycle,spec.private-cluster.apiserver-vnet-integration-create,spec.virtualmachines.mixed-sku-upgrade,spec.deployment-safeguards.basic-enable-disable",
        postPlanPathRepairVerification: {
          requiredPlanPath:
            "ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
        },
      },
    });
    expect(livePlanDispatch.evidence).toContain(
      "live-plan-path:ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
    );
    expect(
      queueRunPipelineParameters({
        specId:
          "spec.managed-namespaces.lifecycle,spec.node-image.profile-upgrade-validation,spec.ossku-migration.ubuntu-to-azurelinux,spec.secure-tls-bootstrap.vnet-integration,spec.secure-tls-bootstrap.network-isolated,spec.network-cni.azure-overlay,spec.cloud-provider.ccm-lifecycle,spec.cloud-provider.multiple-slb,spec.storage-csi.encryption-at-host,spec.kms.v2-public-cluster-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-vnet-integration,spec.kms.v2plus-create-cmk-custom-vnet,spec.kms.v2plus-pmk-migrate-cmk-public-kv-lifecycle,spec.private-cluster.apiserver-vnet-integration-create,spec.virtualmachines.mixed-sku-upgrade,spec.deployment-safeguards.basic-enable-disable",
        target: "staging",
        standaloneBuildId: "",
        planPath: livePlanDispatch.planPath,
        metadata:
          '{"taskId":"domain/implement-master-validation-cross-feature-18spec-journey-20260804","generation":8}',
      }),
    ).toEqual([
      "specs=spec.managed-namespaces.lifecycle,spec.node-image.profile-upgrade-validation,spec.ossku-migration.ubuntu-to-azurelinux,spec.secure-tls-bootstrap.vnet-integration,spec.secure-tls-bootstrap.network-isolated,spec.network-cni.azure-overlay,spec.cloud-provider.ccm-lifecycle,spec.cloud-provider.multiple-slb,spec.storage-csi.encryption-at-host,spec.kms.v2-public-cluster-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-vnet-integration,spec.kms.v2plus-create-cmk-custom-vnet,spec.kms.v2plus-pmk-migrate-cmk-public-kv-lifecycle,spec.private-cluster.apiserver-vnet-integration-create,spec.virtualmachines.mixed-sku-upgrade,spec.deployment-safeguards.basic-enable-disable",
      "plan_path=ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
      "target=staging",
      "slices=1",
      "slice_max_parallel=1",
      'metadata={"taskId":"domain/implement-master-validation-cross-feature-18spec-journey-20260804","generation":8}',
    ]);
  });

  test("prefers an explicit livePlanPath over the repair-verification fallback", () => {
    expect(
      resolveLivePlanDispatch({
        taskInput: {
          livePlanPath: "features/serverless/compact/staging.plan.json",
          postPlanPathRepairVerification: {
            requiredPlanPath:
              "ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
          },
        },
      }),
    ).toEqual({
      planPath: "features/serverless/compact/staging.plan.json",
      source: "livePlanPath",
      evidence: [
        "live-plan-path:features/serverless/compact/staging.plan.json",
        "live-plan-path-source:livePlanPath",
      ],
    });
  });

  test("passes the Cross-17 repair plan through reconcileSpecLive into queued evidence and ADO parameters", () => {
    const childRoot = mkdtempSync(join(tmpdir(), "spec-live-plan-child-"));
    const childScript = join(childRoot, "run.mjs");

    try {
      writeFileSync(
        childScript,
        [
          'import { execFileSync } from "node:child_process";',
          'import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";',
          'import { tmpdir } from "node:os";',
          'import { join } from "node:path";',
          `const modulePath = ${JSON.stringify(join(import.meta.dir, "spec-live-reconciliation.ts"))};`,
          `const contextModulePath = ${JSON.stringify(join(import.meta.dir, "lib/spec-live-test-context.ts"))};`,
          'const root = mkdtempSync(join(tmpdir(), "spec-live-plan-boundary-"));',
          'const run = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();',
          'const remote = join(root, "remote.git");',
          'const seed = join(root, "seed");',
          'const repoDir = join(root, "repo");',
          'const workspaceDir = join(root, "workspace");',
          'const appDir = join(root, "app");',
          'const binDir = join(root, "bin");',
          'const azLog = join(root, "az.log");',
          'const bunLog = join(root, "bun.log");',
          "mkdirSync(seed, { recursive: true });",
          "mkdirSync(appDir, { recursive: true });",
          "mkdirSync(binDir, { recursive: true });",
          'writeFileSync(join(binDir, "bun"), "#!/usr/bin/env bash\\necho \\\"$@\\\" >> \\\"$FAKE_BUN_LOG\\\"\\nexit 0\\n", { mode: 0o755 });',
          'writeFileSync(join(binDir, "az"), `#!/usr/bin/env node\nconst fs = require("node:fs");\nconst args = process.argv.slice(2);\nfs.appendFileSync(process.env.FAKE_AZ_LOG, JSON.stringify(args) + "\\\\n");\nif (args[0] === "pipelines" && args[1] === "run") {\n  const commitIndex = args.indexOf("--commit-id");\n  const parametersIndex = args.indexOf("--parameters");\n  const parameters = {};\n  if (parametersIndex >= 0) {\n    for (const entry of args.slice(parametersIndex + 1)) {\n      const split = entry.indexOf("=");\n      if (split > 0) parameters[entry.slice(0, split)] = entry.slice(split + 1);\n    }\n  }\n  process.stdout.write(JSON.stringify({ id: "175123999", state: "inProgress", sourceVersion: commitIndex >= 0 ? args[commitIndex + 1] : "", templateParameters: parameters }));\n} else {\n  process.stdout.write("[]");\n}\n`, { mode: 0o755 });',
          "process.env.FAKE_AZ_LOG = azLog;",
          "process.env.FAKE_BUN_LOG = bunLog;",
          'process.env.PATH = `${binDir}:${process.env.PATH || ""}`;',
          'process.env.AZURE_CLI_PATH = join(binDir, "az");',
          "const { reconcileSpecLive } = await import(`file://${modulePath}`);",
          "const { createSpecLiveTestContext } = await import(`file://${contextModulePath}`);",
          'run(root, ["init", "--bare", remote]);',
          'run(seed, ["init"]);',
          'run(seed, ["config", "user.email", "test@example.com"]);',
          'run(seed, ["config", "user.name", "Test"]);',
          'writeFileSync(join(seed, "README.md"), "base\\n");',
          'run(seed, ["add", "README.md"]);',
          'run(seed, ["commit", "-m", "base"]);',
          'run(seed, ["branch", "-M", "dev"]);',
          'run(seed, ["remote", "add", "origin", remote]);',
          'run(seed, ["push", "origin", "dev"]);',
          'run(seed, ["checkout", "-b", "task/example"]);',
          'writeFileSync(join(seed, "scenario.txt"), "task branch change\\n");',
          'run(seed, ["add", "scenario.txt"]);',
          'run(seed, ["commit", "-m", "task source"]);',
          'run(seed, ["push", "origin", "task/example"]);',
          'run(root, ["clone", remote, repoDir]);',
          'run(repoDir, ["checkout", "dev"]);',
          'run(root, ["clone", remote, workspaceDir]);',
          'run(workspaceDir, ["checkout", "task/example"]);',
          'run(workspaceDir, ["config", "user.email", "test@example.com"]);',
          'run(workspaceDir, ["config", "user.name", "Test"]);',
          'const sourceCommit = run(workspaceDir, ["rev-parse", "HEAD"]);',
          'const task = ["## Reconciliation Task", JSON.stringify({ taskId: "domain/implement-master-validation-cross-feature-18spec-journey-20260804", generation: 8, input: { specId: "spec.managed-namespaces.lifecycle,spec.node-image.profile-upgrade-validation,spec.ossku-migration.ubuntu-to-azurelinux,spec.secure-tls-bootstrap.vnet-integration,spec.secure-tls-bootstrap.network-isolated,spec.network-cni.azure-overlay,spec.cloud-provider.ccm-lifecycle,spec.cloud-provider.multiple-slb,spec.storage-csi.encryption-at-host,spec.kms.v2-public-cluster-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-lifecycle,spec.kms.v2plus-create-cmk-public-kv-vnet-integration,spec.kms.v2plus-create-cmk-custom-vnet,spec.kms.v2plus-pmk-migrate-cmk-public-kv-lifecycle,spec.private-cluster.apiserver-vnet-integration-create,spec.virtualmachines.mixed-sku-upgrade,spec.deployment-safeguards.basic-enable-disable", sourceBranch: "task/example", sourceCommit, target: "staging", postPlanPathRepairVerification: { requiredPlanPath: "ci/plans/master-validation-cross-feature-17selector-staging.plan.json" } }, children: { live: [], completed: [] } }, null, 2)].join("\\n");',
          'const envelope = JSON.parse(task.split("\\n").slice(1).join("\\n"));',
          'const resultEnvelope = await reconcileSpecLive(createSpecLiveTestContext({ taskId: envelope.taskId, generation: envelope.generation, input: envelope.input, appRoot: appDir, projectRoot: repoDir, workspaceRoot: workspaceDir, callAgent: async () => { throw new Error("agent call should not be reached"); } }), { reviewedScenarioPatch: true });',
          "const result = resultEnvelope.output;",
          'const azCommands = readFileSync(azLog, "utf8").trim().split(/\\n+/).filter(Boolean).map((line) => JSON.parse(line));',
          'const bunCommands = readFileSync(bunLog, "utf8").trim().split(/\\n+/).filter(Boolean);',
          "console.log(JSON.stringify({ result, azCommands, bunCommands }));",
          "rmSync(root, { recursive: true, force: true });",
        ].join("\n"),
      );

      const child = spawnSync("bun", [childScript], {
        cwd: import.meta.dir,
        encoding: "utf8",
        env: {
          ...process.env,
        },
      });

      if (child.status !== 0) {
        throw new Error(child.stderr || child.stdout || "child process failed");
      }
      const payload = JSON.parse(child.stdout.trim());
      expect(payload.result.state).toBe("waiting");
      expect(payload.result.summary).toContain(
        "Queued exact live verification run 175123999",
      );
      expect(payload.result.evidence).toContain(
        "live-plan-path:ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
      );
      expect(payload.result.evidence).toContain(
        "live-plan-path-source:postPlanPathRepairVerification.requiredPlanPath",
      );
      expect(payload.result.conditions).toEqual([
        pipelineWaitCondition("175123999"),
      ]);
      expect(
        payload.azCommands.some(
          (args: string[]) =>
            args[0] === "pipelines" &&
            args[1] === "run" &&
            args.includes(
              "plan_path=ci/plans/master-validation-cross-feature-17selector-staging.plan.json",
            ),
        ),
      ).toBe(true);
      expect(
        payload.bunCommands.some((entry: string) =>
          entry.includes(
            "runner/check-live-admission.ts --specs spec.cloud-provider.ccm-lifecycle",
          ),
        ),
      ).toBe(true);
    } finally {
      rmSync(childRoot, { recursive: true, force: true });
    }
  });

  test("replays divergent fresh-base candidates before exact publication and ADO admission", () => {
    const childRoot = mkdtempSync(join(tmpdir(), "fresh-base-lineage-child-"));
    const childScript = join(childRoot, "run.mjs");

    try {
      writeFileSync(
        childScript,
        [
          'import { execFileSync } from "node:child_process";',
          'import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";',
          'import { tmpdir } from "node:os";',
          'import { join } from "node:path";',
          `const modulePath = ${JSON.stringify(join(import.meta.dir, "spec-live-reconciliation.ts"))};`,
          `const contextModulePath = ${JSON.stringify(join(import.meta.dir, "lib/spec-live-test-context.ts"))};`,
          "const roots = [];",
          'const run = (cwd, args, allowFailure = false) => { try { return execFileSync("git", args, { cwd, encoding: "utf8" }).trim(); } catch (error) { if (allowFailure) return ""; throw error; } };',
          'const succeeds = (cwd, args) => { try { execFileSync("git", args, { cwd, encoding: "utf8" }); return true; } catch { return false; } };',
          "const execute = async (mode) => {",
          "  const root = mkdtempSync(join(tmpdir(), `fresh-base-${mode}-`)); roots.push(root);",
          '  const remote = join(root, "remote.git"); const seed = join(root, "seed"); const repoDir = join(root, "repo"); const appDir = join(root, "app"); const binDir = join(root, "bin"); const azLog = join(root, "az.log"); const bunLog = join(root, "bun.log"); const gitLog = join(root, "git.log");',
          '  mkdirSync(seed, { recursive: true }); mkdirSync(appDir, { recursive: true }); mkdirSync(binDir, { recursive: true }); writeFileSync(azLog, ""); writeFileSync(bunLog, ""); writeFileSync(gitLog, "");',
          '  writeFileSync(join(binDir, "bun"), "#!/usr/bin/env bash\\necho \\\"$@\\\" >> \\\"$FAKE_BUN_LOG\\\"\\nexit 0\\n", { mode: 0o755 });',
          '  writeFileSync(join(binDir, "git"), "#!/usr/bin/env bash\\nif [[ \\\"$1\\\" == \\\"push\\\" ]]; then echo \\\"$@\\\" >> \\\"$FAKE_GIT_LOG\\\"; fi\\nexec /usr/bin/git \\\"$@\\\"\\n", { mode: 0o755 });',
          '  writeFileSync(join(binDir, "az"), `#!/usr/bin/env node\nconst fs=require("node:fs"); const args=process.argv.slice(2); fs.appendFileSync(process.env.FAKE_AZ_LOG, JSON.stringify(args)+"\\\\n"); if(args[0]==="pipelines"&&args[1]==="run"){ const i=args.indexOf("--commit-id"); process.stdout.write(JSON.stringify({id:"175124000",state:"inProgress",sourceVersion:args[i+1]})); } else process.stdout.write("[]");\n`, { mode: 0o755 });',
          '  process.env.FAKE_AZ_LOG=azLog; process.env.FAKE_BUN_LOG=bunLog; process.env.FAKE_GIT_LOG=gitLog; process.env.PATH=`${binDir}:${process.env.PATH||""}`; process.env.AZURE_CLI_PATH=join(binDir,"az");',
          '  run(root,["init","--bare",remote]); run(seed,["init"]); run(seed,["config","user.email","test@example.com"]); run(seed,["config","user.name","Test"]); writeFileSync(join(seed,"README.md"),"base\\n"); run(seed,["add","README.md"]); run(seed,["commit","-m","base"]); run(seed,["branch","-M","dev"]); run(seed,["remote","add","origin",remote]); run(seed,["push","origin","dev"]);',
          '  if(mode==="divergent"||mode==="bounded-no-delta"){ run(seed,["checkout","-b","task/example"]); const candidatePath=mode==="bounded-no-delta"?"unrelated.txt":"candidate.txt"; const candidateText=mode==="bounded-no-delta"?"must not replay\\n":"unsafe 7475562cc shape\\n"; writeFileSync(join(seed,candidatePath),candidateText); run(seed,["add",candidatePath]); run(seed,["commit","-m",mode==="bounded-no-delta"?"unrelated retained commit":"divergent candidate"]); var candidate=run(seed,["rev-parse","HEAD"]); run(seed,["push","origin","task/example"]); run(seed,["checkout","dev"]); writeFileSync(join(seed,"authority.txt"),"fresh authority\\n"); run(seed,["add","authority.txt"]); run(seed,["commit","-m","advance authority"]); run(seed,["push","origin","dev"]); run(seed,["checkout","task/example"]); } else if(mode==="conflict"){ run(seed,["checkout","-b","task/example"]); writeFileSync(join(seed,"README.md"),"candidate value\\n"); run(seed,["add","README.md"]); run(seed,["commit","-m","conflicting candidate"]); var candidate=run(seed,["rev-parse","HEAD"]); run(seed,["push","origin","task/example"]); run(seed,["checkout","dev"]); writeFileSync(join(seed,"README.md"),"authority value\\n"); run(seed,["add","README.md"]); run(seed,["commit","-m","conflicting authority"]); run(seed,["push","origin","dev"]); run(seed,["checkout","task/example"]); } else { writeFileSync(join(seed,"authority.txt"),"fresh authority\\n"); run(seed,["add","authority.txt"]); run(seed,["commit","-m","advance authority"]); run(seed,["push","origin","dev"]); run(seed,["checkout","-b","task/example"]); writeFileSync(join(seed,"candidate.txt"),"safe candidate\\n"); run(seed,["add","candidate.txt"]); run(seed,["commit","-m","descendant candidate"]); var candidate=run(seed,["rev-parse","HEAD"]); run(seed,["push","origin","task/example"]); }',
          '  run(root,["clone",remote,repoDir]); run(repoDir,["checkout","dev"]); writeFileSync(gitLog, "");',
          '  const { reconcileSpecLive } = await import(`file://${modulePath}`); const { createSpecLiveTestContext } = await import(`file://${contextModulePath}`); const input={specId:"spec.sample.fresh-base",sourceBranch:"task/example",sourceCommit:candidate,target:"staging",requireFreshBaseAtDispatch:true,baseRef:"origin/dev",...(mode==="bounded-no-delta"?{boundedChangedFiles:["README.md"]}:{})};',
          '  let repairCalls=0; let queuedBeforeRepair=false; let repairPrompt=""; const resultEnvelope=await reconcileSpecLive(createSpecLiveTestContext({taskId:`domain/fresh-base-${mode}`,input,appRoot:appDir,projectRoot:repoDir,workspaceRoot:seed,callAgent:async(_agent,prompt)=>{ if(mode!=="conflict") throw new Error("agent call should not be reached"); repairCalls+=1; repairPrompt=prompt; queuedBeforeRepair=readFileSync(azLog,"utf8").trim().split(/\\n+/).filter(Boolean).map(JSON.parse).some((args)=>args[0]==="pipelines"&&args[1]==="run"); writeFileSync(join(seed,"README.md"),"authority value with candidate behavior\\n"); run(seed,["add","README.md"]); run(seed,["cherry-pick","--continue"]); return {id:"s_fresh_base_test",kind:"agent",status:"done",summary:"Resolved the bounded replay conflict.",output:{decision:"committed",summary:"Resolved the bounded replay conflict.",evidence:["fresh-base-conflict:repaired"]}}; }}),{reviewedScenarioPatch:true}); const result=resultEnvelope.output;',
          '  const commands=readFileSync(azLog,"utf8").trim().split(/\\n+/).filter(Boolean).map(JSON.parse); const pushes=readFileSync(gitLog,"utf8").trim().split(/\\n+/).filter(Boolean); const remoteTask=run(seed,["ls-remote","origin","refs/heads/task/example"],true); const publishedCommit=remoteTask.split(/\\s+/)[0]||""; const authority=run(seed,["rev-parse","origin/dev"]); const replayHead=run(seed,["rev-parse","HEAD"]); const authorityIsAncestor=succeeds(seed,["merge-base","--is-ancestor",authority,replayHead]); const staleCandidateIsAncestor=succeeds(seed,["merge-base","--is-ancestor",candidate,replayHead]); const retainedCandidateChange=mode==="conflict"?readFileSync(join(seed,"README.md"),"utf8"):mode==="bounded-no-delta"?"":readFileSync(join(seed,"candidate.txt"),"utf8"); const unrelatedExists=existsSync(join(seed,"unrelated.txt")); const queuedSourceVersion=commands.find((args)=>args[0]==="pipelines"&&args[1]==="run")?.[commands.find((args)=>args[0]==="pipelines"&&args[1]==="run")?.indexOf("--commit-id")+1]||""; return {mode,result,commands,pushes,remoteTask,candidate,publishedCommit,authority,replayHead,authorityIsAncestor,staleCandidateIsAncestor,retainedCandidateChange,unrelatedExists,queuedSourceVersion,repairCalls,queuedBeforeRepair,repairPrompt};',
          "};",
          'const outputs=[await execute("divergent"),await execute("bounded-no-delta"),await execute("current"),await execute("conflict")]; console.log(JSON.stringify(outputs)); for(const root of roots) rmSync(root,{recursive:true,force:true});',
        ].join("\n"),
      );

      const child = spawnSync("bun", [childScript], {
        cwd: import.meta.dir,
        encoding: "utf8",
        env: { ...process.env },
      });
      if (child.status !== 0) {
        throw new Error(child.stderr || child.stdout || "child process failed");
      }
      const [divergent, boundedNoDelta, current, conflict] = JSON.parse(
        child.stdout.trim(),
      );
      expect(divergent.result.state).toBe("waiting");
      expect(divergent.result.summary).toContain(
        "Queued exact live verification run 175124000",
      );
      expect(divergent.authorityIsAncestor).toBe(true);
      expect(divergent.staleCandidateIsAncestor).toBe(false);
      expect(divergent.retainedCandidateChange).toBe(
        "unsafe 7475562cc shape\n",
      );
      expect(divergent.publishedCommit).toBe(divergent.replayHead);
      expect(divergent.queuedSourceVersion).toBe(divergent.replayHead);
      expect(divergent.pushes).toHaveLength(1);
      expect(divergent.pushes[0]).toContain("HEAD:refs/heads/task/example");
      expect(divergent.result.evidence).toContain(
        `dispatch-replay-from:${divergent.candidate}`,
      );
      expect(divergent.result.evidence).toContain(
        `dispatch-replay-target:origin/dev@${divergent.authority}`,
      );
      expect(divergent.result.evidence).toContain(
        `dispatch-replayed-source:${divergent.replayHead}`,
      );
      expect(divergent.result.evidence).toContain(
        `dispatch-replay-published:task/example@${divergent.replayHead}`,
      );
      expect(divergent.result.evidence).toContain(
        "fresh-base-lineage:accepted",
      );

      expect(boundedNoDelta.result.state).toBe("waiting");
      expect(boundedNoDelta.authorityIsAncestor).toBe(true);
      expect(boundedNoDelta.staleCandidateIsAncestor).toBe(false);
      expect(boundedNoDelta.replayHead).toBe(boundedNoDelta.authority);
      expect(boundedNoDelta.publishedCommit).toBe(boundedNoDelta.authority);
      expect(boundedNoDelta.remoteTask).toContain(boundedNoDelta.authority);
      expect(boundedNoDelta.unrelatedExists).toBe(false);
      expect(boundedNoDelta.queuedSourceVersion).toBe(boundedNoDelta.authority);
      expect(boundedNoDelta.pushes).toHaveLength(1);
      expect(boundedNoDelta.pushes[0]).toContain("--force-with-lease=");
      expect(boundedNoDelta.pushes[0]).toContain(
        "HEAD:refs/heads/task/example",
      );
      expect(boundedNoDelta.result.evidence).toContain(
        "dispatch-bounded-delta:none",
      );
      expect(boundedNoDelta.result.evidence).toContain(
        `dispatch-replayed-source:${boundedNoDelta.authority}`,
      );
      expect(boundedNoDelta.result.evidence).toContain(
        `dispatch-replay-published:task/example@${boundedNoDelta.authority}`,
      );

      expect(current.result.state).toBe("waiting");
      expect(current.result.summary).toContain(
        "Queued exact live verification run 175124000",
      );
      expect(current.authorityIsAncestor).toBe(true);
      expect(current.replayHead).toBe(current.candidate);
      expect(current.publishedCommit).toBe(current.candidate);
      expect(current.queuedSourceVersion).toBe(current.candidate);
      expect(current.remoteTask).toContain(current.candidate);
      expect(current.pushes).toHaveLength(1);
      expect(current.pushes[0]).toContain("refs/heads/task/example");
      expect(current.result.evidence).toContain("fresh-base-lineage:accepted");
      expect(
        current.commands.some(
          (args: string[]) => args[0] === "pipelines" && args[1] === "run",
        ),
      ).toBe(true);

      expect(conflict.repairCalls).toBe(1);
      expect(conflict.queuedBeforeRepair).toBe(false);
      expect(conflict.repairPrompt).toContain(
        "Resolve only this replay conflict, complete the cherry-pick",
      );
      expect(conflict.repairPrompt).toContain(
        "Do not weaken the fresh-base guard",
      );
      expect(conflict.result.state).toBe("waiting");
      expect(conflict.result.summary).toContain(
        "Queued exact live verification run 175124000",
      );
      expect(conflict.authorityIsAncestor).toBe(true);
      expect(conflict.staleCandidateIsAncestor).toBe(false);
      expect(conflict.retainedCandidateChange).toBe(
        "authority value with candidate behavior\n",
      );
      expect(conflict.publishedCommit).toBe(conflict.replayHead);
      expect(conflict.queuedSourceVersion).toBe(conflict.replayHead);
      expect(conflict.pushes).toHaveLength(1);
      expect(conflict.pushes[0]).toContain("HEAD:refs/heads/task/example");
      expect(conflict.result.evidence).toContain(
        "fresh-base-conflict:repaired",
      );
      expect(conflict.result.evidence).toContain(
        `dispatch-replay-from:${conflict.candidate}`,
      );
      expect(conflict.result.evidence).toContain(
        `dispatch-replay-target:origin/dev@${conflict.authority}`,
      );
      expect(conflict.result.evidence).toContain(
        `dispatch-replay-published:task/example@${conflict.replayHead}`,
      );
      expect(conflict.result.evidence).toContain("fresh-base-lineage:accepted");
    } finally {
      rmSync(childRoot, { recursive: true, force: true });
    }
  }, 15_000);

  test("reports exact merge-base and behind/ahead facts for the unsafe lineage shape", () => {
    const root = mkdtempSync(join(tmpdir(), "fresh-base-facts-"));
    try {
      execFileSync("git", ["init"], { cwd: root });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: root,
      });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
      writeFileSync(join(root, "base.txt"), "base\n");
      execFileSync("git", ["add", "base.txt"], { cwd: root });
      execFileSync("git", ["commit", "-m", "base"], { cwd: root });
      execFileSync("git", ["branch", "-M", "dev"], { cwd: root });
      execFileSync("git", ["remote", "add", "origin", root], { cwd: root });
      execFileSync("git", ["update-ref", "refs/remotes/origin/dev", "HEAD"], {
        cwd: root,
      });
      execFileSync("git", ["checkout", "-b", "candidate"], { cwd: root });
      writeFileSync(join(root, "candidate.txt"), "candidate\n");
      execFileSync("git", ["add", "candidate.txt"], { cwd: root });
      execFileSync("git", ["commit", "-m", "candidate"], { cwd: root });
      const candidate = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      execFileSync("git", ["checkout", "dev"], { cwd: root });
      writeFileSync(join(root, "authority.txt"), "authority\n");
      execFileSync("git", ["add", "authority.txt"], { cwd: root });
      execFileSync("git", ["commit", "-m", "authority"], { cwd: root });

      const admission = freshBaseLineageAdmission({
        workspaceDir: root,
        candidateCommit: candidate,
        requireFreshBaseAtDispatch: true,
        baseRef: "origin/dev",
      });
      expect(admission.accepted).toBe(false);
      expect(admission.mergeBase).not.toBe("");
      expect(admission.behind).toBe(1);
      expect(admission.ahead).toBe(1);
      expect(admission.evidence).toContain("fresh-base-behind-ahead:1/1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("requires direct carriers to validate on the ADO Vitest surface", () => {
    expect(directVitestCompatibilityInstruction).toContain("through Vitest");
    expect(directVitestCompatibilityInstruction).toContain(
      "A standalone direct carrier means no child-process wrapper",
    );
    expect(directVitestCompatibilityInstruction).toContain("`execFile`");
    expect(directVitestCompatibilityInstruction).toContain("shell out to Bun");
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
      "Do not return needs-agent merely because",
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
      const standaloneAggregatePath = join(root, "standalone-result.json");
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
        standaloneAggregatePath,
        JSON.stringify({
          target: {
            name: "standalone",
            environment: "standalone",
            subscriptionId: "feb5b150-60fe-4441-be73-8c02a524f55a",
            location: "eastus2",
          },
          specResults: [{ specId: "spec.sample.live", status: "pass" }],
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
      expect(artifactProvesTarget(standaloneAggregatePath, "staging")).toBe(
        false,
      );
      expect(
        artifactProvesTarget(standaloneAggregatePath, "staging", "174794632"),
      ).toBe(true);
      expect(
        artifactProvesTarget(standaloneAggregatePath, "dev", "174794632"),
      ).toBe(false);
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
          generation: 2,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "",
          proof: { ...proof, targetRef: "origin/main" },
          run,
          artifactPaths: [aggregatePath, specPath, vitestPath],
          expectedClaimIdsBySpec: {
            "spec.sample.live": ["assert.sample.behavior"],
          },
          sourceReachable: true,
          integratedCommitReachable: true,
          normalizationInvariantSatisfied: true,
          expectedVitestTestCount: 1,
          integrationTargetRef: "origin/main",
        }),
      ).toMatchObject({
        accepted: true,
        summary: expect.stringContaining("origin/main integration"),
      });
      expect(
        verifySpecLiveProofFacts({
          taskId: "domain/sample",
          generation: 2,
          specIds: ["spec.sample.live"],
          target: "staging",
          standaloneBuildId: "174794632",
          proof: {
            ...proof,
            standaloneBuildId: "174794632",
          },
          run: {
            ...run,
            templateParameters: {
              ...run.templateParameters,
              standalone_build_id: "174794632",
            },
          },
          artifactPaths: [standaloneAggregatePath, specPath, vitestPath],
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

  test("persists authenticated ADO timeline and failing task evidence for an artifactless terminal run", async () => {
    const root = mkdtempSync(join(tmpdir(), "artifactless-terminal-evidence-"));
    const calls: Array<{
      args: string[];
      includeProject: boolean | undefined;
    }> = [];
    const timeline = {
      records: [
        {
          id: "stage-1",
          name: "Run live specs",
          type: "Stage",
          result: "failed",
        },
        {
          id: "job-1",
          parentId: "stage-1",
          name: "Execute",
          type: "Job",
          result: "failed",
        },
        {
          id: "task-1",
          parentId: "job-1",
          name: "Run selected LocalDNS specs",
          type: "Task",
          result: "failed",
          log: { id: "987" },
        },
      ],
    };
    try {
      const result = await collectTerminalRunEvidence(
        root,
        root,
        "42",
        { id: 42, status: "completed", result: "failed" },
        {
          listArtifacts: () => [],
          authenticatedAdoJson: (args, options) => {
            calls.push({ args, includeProject: options?.includeProject });
            return args.includes("timeline")
              ? timeline
              : {
                  value: [
                    "failing command",
                    "fatal: LocalDNS assertion failed",
                  ],
                };
          },
        },
      );

      const timelinePath = join(root, "ado-timeline.json");
      const terminalFailurePath = join(root, "ado-terminal-failure.json");
      const failingTaskLogPath = join(root, "ado-failing-task-987.log");
      expect(calls).toEqual([
        {
          args: [
            "devops",
            "invoke",
            "--area",
            "build",
            "--resource",
            "timeline",
            "--route-parameters",
            "project=CloudNativeCompute",
            "buildId=42",
            "--api-version",
            "7.1",
          ],
          includeProject: false,
        },
        {
          args: [
            "devops",
            "invoke",
            "--area",
            "build",
            "--resource",
            "logs",
            "--route-parameters",
            "project=CloudNativeCompute",
            "buildId=42",
            "logId=987",
            "--api-version",
            "7.1",
          ],
          includeProject: false,
        },
      ]);
      expect(result).toMatchObject({
        artifactPaths: [],
        timelinePath,
        terminalFailurePath,
        failingTaskLogPath,
        errors: [],
      });
      expect(JSON.parse(readFileSync(timelinePath, "utf8"))).toEqual(timeline);
      expect(JSON.parse(readFileSync(terminalFailurePath, "utf8"))).toEqual({
        runId: "42",
        runResult: "failed",
        stage: {
          id: "stage-1",
          name: "Run live specs",
          type: "Stage",
          result: "failed",
        },
        task: {
          id: "task-1",
          name: "Run selected LocalDNS specs",
          type: "Task",
          result: "failed",
        },
        logId: "987",
      });
      expect(readFileSync(failingTaskLogPath, "utf8")).toBe(
        "failing command\nfatal: LocalDNS assertion failed\n",
      );
      expect(
        JSON.parse(readFileSync(join(root, "collection.json"), "utf8")),
      ).toMatchObject({
        runId: "42",
        timelinePath,
        terminalFailurePath,
        failingTaskLogPath,
        errors: [],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects canonical and symlink-equivalent workspaces before spec-live agent dispatch", async () => {
    const root = mkdtempSync(join(tmpdir(), "spec-live-write-dispatch-"));
    const projectDir = join(root, "project");
    const projectAlias = join(root, "project-alias");
    mkdirSync(projectDir);
    symlinkSync(projectDir, projectAlias);
    let agentCalls = 0;
    const contextFor = (workspaceDir: string) => ({
      agent: "aks-explorer",
      projectDir,
      workspaceDir,
      runAgent: async () => {
        agentCalls += 1;
        throw new Error("canonical checkout must never reach runAgent");
      },
    });

    try {
      await expect(
        askAgent(
          isolatedAgentContext(contextFor(projectDir)),
          "Repair bounded source.",
        ),
      ).rejects.toThrow("refused canonical workspace");
      await expect(
        askAgent(
          isolatedAgentContext(contextFor(projectAlias)),
          "Repair bounded source.",
        ),
      ).rejects.toThrow("refused canonical workspace");
      expect(agentCalls).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("gives preparation and correction calls a finite allowance above the old 25-operation guardrail while preserving deadline margin", async () => {
    const calls: Array<{
      timeoutMs: number;
      operationAllowance?: number;
    }> = [];
    let call = 0;
    const ctx = {
      agent: "aks-explorer",
      runAgent: async (
        _agent: string,
        _prompt: string,
        options: { timeoutMs: number; operationAllowance?: number },
      ) => {
        calls.push(options);
        call += 1;
        return {
          status: "done" as const,
          structuredResult:
            call === 1
              ? {
                  decision: "committed",
                  summary: "first preparation judgment needs correction",
                  evidence: ["source-commit:abc"],
                }
              : {
                  decision: "committed",
                  summary: "corrected preparation judgment",
                  evidence: ["source-commit:def"],
                  liveReady: true,
                },
        };
      },
    };

    const decision = await askAgent(
      isolatedAgentContext(ctx) as never,
      "Repair and commit the retained LocalDNS carrier.",
      {
        deadlineMs: 1_800_000,
        nowMs: (() => {
          const times = [0, 1_000];
          return () => times.shift() ?? 1_000;
        })(),
        continueDomainWorkOnValidation: true,
        validateDecision: (candidate) =>
          candidate.liveReady === undefined ? "liveReady is required" : null,
      },
    );

    expect(decision.liveReady).toBe(true);
    expect(specLiveAgentOperationAllowance).toBeGreaterThan(25);
    expect(Number.isFinite(specLiveAgentOperationAllowance)).toBe(true);
    expect(calls).toEqual([
      {
        timeoutMs: 900_000,
        operationAllowance: specLiveAgentOperationAllowance,
        schema: expect.any(Object),
      },
      {
        timeoutMs: 600_000,
        operationAllowance: specLiveAgentOperationAllowance,
        schema: expect.any(Object),
      },
    ]);
    expect(calls[1]!.timeoutMs + 300_000).toBeLessThan(1_800_000);
  });

  test("reserves workflow margin instead of launching a correction after a long first judgment", async () => {
    const calls: Array<{ timeoutMs: number }> = [];
    const times = [0, 1_450_001];
    const ctx = {
      agent: "aks-explorer",
      runAgent: async (
        _agent: string,
        _prompt: string,
        options: { timeoutMs: number },
      ) => {
        calls.push(options);
        return {
          status: "done",
          structuredResult: {
            decision: "committed",
            summary: "invalid first judgment after broad research",
            evidence: ["source-commit:abc"],
          },
        };
      },
    };

    await expect(
      askAgent(
        isolatedAgentContext(ctx) as never,
        "Repair four network-cni carriers.",
        {
          deadlineMs: 1_800_000,
          nowMs: () => times.shift() ?? 1_450_001,
          continueDomainWorkOnValidation: true,
          validateDecision: () => "liveReady is required",
        },
      ),
    ).rejects.toThrow("correction/retry was not admitted");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.timeoutMs).toBe(900_000);
    expect(
      admittedAgentCallTimeoutMs({
        deadlineMs: 1_800_000,
        nowMs: 1_450_001,
        attempt: 2,
      }),
    ).toBeNull();
  });

  test("forces worktree recovery through the null-admission callback without permitting a dirty agent handoff", async () => {
    const checkpointPath = join(isolatedAgentWorkspace, "current-context.json");
    const sourceCommit = "d".repeat(40);
    let calls = 0;
    const ctx = isolatedAgentContext({
      agent: "aks-explorer",
      runAgent: async () => {
        calls += 1;
        throw new Error("deadline admission should prevent agent dispatch");
      },
    });
    const forcedRecovery = (
      workspaceDirty: boolean,
      ownershipEstablished: boolean,
    ) => ({
      deadlineMs: 100_000,
      nowMs: () => 100_000,
      onAgentCallNotAdmitted: ({
        phase,
      }: {
        attempt: number;
        phase: "judgment" | "correction/retry";
      }) =>
        taskWorktreeRecoveryDeadlineDecision({
          phase,
          workspaceDirty,
          ownershipEstablished,
          sourceBranch: ownershipEstablished ? "task/example" : "dev",
          checkpointPath,
          sourceCommit,
          beforeRecovery: sourceCommit,
        }),
      validateDecision: (
        candidate: Parameters<typeof taskWorktreeRecoveryDecisionProblem>[0],
      ) =>
        taskWorktreeRecoveryDecisionProblem(candidate, {
          workspaceDirty,
          ownershipEstablished,
          authoritativeCheckpointPath: checkpointPath,
          sourceCommit,
        }),
    });

    await expect(
      askAgent(
        ctx as never,
        "Recover the established task worktree.",
        forcedRecovery(true, true),
      ),
    ).rejects.toThrow("task/worktree ownership is established");

    const ambiguous = await askAgent(
      ctx as never,
      "Preserve ambiguous retained source.",
      forcedRecovery(true, false),
    );
    expect(ambiguous).toMatchObject({
      decision: "needs-agent",
      evidence: [
        "completion-guard:forced",
        "workspace:dirty",
        expect.stringContaining("ownership-ambiguity:"),
        `authoritative-checkpoint:${checkpointPath}`,
        `authoritative-source-commit:${sourceCommit}`,
      ],
    });

    const clean = await askAgent(
      ctx as never,
      "Accept already-clean retained source.",
      forcedRecovery(false, true),
    );
    expect(clean).toMatchObject({
      decision: "test-current",
      evidence: [
        "completion-guard:forced",
        "workspace:clean",
        `source-commit:${sourceCommit}`,
      ],
    });
    expect(calls).toBe(0);
  });

  test("continues the s_1786385904954_217 dirty guard handoff in retained same-task context until clean commit", async () => {
    const contextDir = mkdtempSync(join(tmpdir(), "localdns-dirty-guard-"));
    const baselineCommit = "a".repeat(40);
    const dirtyEditCommit = "b".repeat(40);
    const cleanCommit = "c".repeat(40);
    const prompts: string[] = [];
    let sourceCommit = baselineCommit;
    let workspaceDirty = false;
    let call = 0;
    const checkpointPath = currentTaskContextPath(contextDir);
    const ctx = isolatedAgentContext({
      agent: "aks-explorer",
      runAgent: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        call += 1;
        if (call === 1) {
          workspaceDirty = true;
          sourceCommit = dirtyEditCommit;
          return {
            status: "done",
            structuredResult: {
              decision: "needs-agent",
              summary:
                "Completion guard interrupted the bounded LocalDNS carrier edit.",
              evidence: [
                "completion-guard:forced",
                "workspace:dirty",
                `authoritative-checkpoint:${checkpointPath}`,
                `authoritative-source-commit:${dirtyEditCommit}`,
              ],
            },
          };
        }
        expect(workspaceDirty).toBe(true);
        expect(prompt).toContain(checkpointPath);
        expect(prompt).toContain(
          "source edits remain in the retained task worktree",
        );
        workspaceDirty = false;
        sourceCommit = cleanCommit;
        return {
          status: "done",
          structuredResult: {
            decision: "committed",
            summary:
              "Completed and committed the retained LocalDNS carrier repair.",
            evidence: ["workspace:clean", `source-commit:${cleanCommit}`],
          },
        };
      },
    });

    try {
      const result = await askAgent(
        ctx as never,
        "Complete the bounded LocalDNS direct-carrier repair.",
        {
          continueDomainWorkOnValidation: true,
          durableContext: {
            contextDir,
            taskId:
              "spec/repair-live-localdns-osarch-fips-direct-carrier-recovery-20260810",
            generation: 7,
            sourceCommit: () => sourceCommit,
            phase: "preparation",
          },
          validateDecision: (candidate) => {
            if (candidate.decision === "needs-agent" && workspaceDirty) {
              return "task-owned dirty technical repair must continue in the same workflow context";
            }
            if (candidate.decision !== "committed") {
              return "retained repair must reach a clean commit checkpoint";
            }
            return workspaceDirty
              ? "committed repair must leave the retained task worktree clean"
              : null;
          },
        },
      );

      expect(result).toMatchObject({
        decision: "committed",
        evidence: ["workspace:clean", `source-commit:${cleanCommit}`],
      });
      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toContain(
        "task-owned dirty technical repair must continue in the same workflow context",
      );
      const current = JSON.parse(readFileSync(checkpointPath, "utf8"));
      expect(current.sourceCommit).toBe(dirtyEditCommit);
      expect(current.previousHandoffPath).toBeTruthy();
      const predecessor = JSON.parse(
        readFileSync(current.previousHandoffPath, "utf8"),
      );
      expect(predecessor.sourceCommit).toBe(baselineCommit);
      expect(readFileSync(predecessor.judgmentPath, "utf8")).toContain(
        "Complete the bounded LocalDNS direct-carrier repair.",
      );
      expect(readFileSync(current.judgmentPath, "utf8")).toContain(
        "task-owned dirty technical repair must continue in the same workflow context",
      );
      expect(workspaceDirty).toBe(false);
    } finally {
      rmSync(contextDir, { recursive: true, force: true });
    }
  });

  test("puts narrowed gates, durable checkpoints, and Bun-native commands before broad research", () => {
    expect(earlyCheckpointInstruction).toStartWith(
      "Before broad carrier research",
    );
    expect(earlyCheckpointInstruction).toContain("multi-spec repair");
    expect(earlyCheckpointInstruction).toContain("durable task context");
    expect(earlyCheckpointInstruction).toContain("retained task worktree");
    expect(earlyCheckpointInstruction).toContain(
      "Inspect package.json scripts",
    );
    expect(earlyCheckpointInstruction).toContain("bun test <file>");
    expect(earlyCheckpointInstruction).toContain("bun run <script>");
    expect(earlyCheckpointInstruction).toContain("when `bunx` is unavailable");
  });

  test("keeps only the successor source/run handoff authoritative while retaining the replaced source", async () => {
    const contextDir = mkdtempSync(join(tmpdir(), "source-run-handoff-"));
    const oldSource = "00601bbe8fdd9e1d1e96ec8135d91071e87d84b1";
    const successorSource = "9aa0291ee95baf951a69cd60737e85e865822fc0";
    const runId = "175768290";
    const prompts: string[] = [];
    const ctx = {
      agent: "aks-explorer",
      runAgent: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return {
          status: "done",
          structuredResult: {
            decision: "test-current",
            summary: "durable context inspected",
            evidence: ["context:inspected"],
          },
        };
      },
    };

    try {
      for (const [sourceCommit, phase] of [
        [oldSource, "preparation"],
        [successorSource, "replacement-correction"],
        [successorSource, "terminal-review"],
      ] as const) {
        await askAgent(isolatedAgentContext(ctx) as never, `Judge ${phase}.`, {
          durableContext: {
            contextDir,
            taskId: "domain/source-run-isolation",
            generation: 1,
            sourceCommit: () => sourceCommit,
            runId,
            phase,
          },
        });
      }

      const current = JSON.parse(
        readFileSync(currentTaskContextPath(contextDir), "utf8"),
      );
      const durablePart = (value: string) =>
        `${value}-${createHash("sha256").update(value).digest("hex").slice(0, 10)}`;
      const durableRunId = durablePart(runId);
      const durablePreparationPhase = durablePart("preparation");
      const durableTerminalPhase = durablePart("terminal-review");
      const oldHandoffPath = join(
        contextDir,
        "handoffs",
        "sources",
        oldSource,
        "runs",
        durableRunId,
        `${durablePreparationPhase}.json`,
      );
      const successorHandoffPath = join(
        contextDir,
        "handoffs",
        "sources",
        successorSource,
        "runs",
        durableRunId,
        `${durableTerminalPhase}.json`,
      );

      expect(current.sourceCommit).toBe(successorSource);
      expect(current.runId).toBe(runId);
      expect(current.phase).toBe(durableTerminalPhase);
      expect(current.handoffPath).toBe(successorHandoffPath);
      expect(
        JSON.parse(readFileSync(oldHandoffPath, "utf8")).sourceCommit,
      ).toBe(oldSource);
      expect(
        JSON.parse(readFileSync(successorHandoffPath, "utf8")).sourceCommit,
      ).toBe(successorSource);
      expect(prompts).toHaveLength(3);
      expect(prompts[2]).toContain(currentTaskContextPath(contextDir));
      expect(prompts[2]).toContain(successorHandoffPath);
      expect(prompts[2]).toContain("only the handoff it names as current");
      expect(prompts[2]).toContain("stale authority");
    } finally {
      rmSync(contextDir, { recursive: true, force: true });
    }
  });

  test("recovers error and interrupted first calls through source-versioned context without replaying the full prompt", async () => {
    for (const firstStatus of ["error", "interrupted"] as const) {
      const contextDir = mkdtempSync(
        join(tmpdir(), `provider-abort-${firstStatus}-`),
      );
      const beforeSource = "00601bbe8fdd9e1d1e96ec8135d91071e87d84b1";
      const recoveredSource = "9aa0291ee95baf951a69cd60737e85e865822fc0";
      const prompts: string[] = [];
      let sourceCommit = beforeSource;
      let call = 0;
      const ctx = {
        agent: "aks-explorer",
        runAgent: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          call += 1;
          if (call === 1) {
            sourceCommit = recoveredSource;
            return { status: firstStatus };
          }
          return {
            status: "done",
            structuredResult: {
              decision: "committed",
              summary: "recovered retained App Routing judgment",
              evidence: [`source-commit:${recoveredSource}`, "target:staging"],
              liveReady: true,
            },
          };
        },
      };
      const originalPrompt =
        "ORIGINAL-FULL-SESSION-SENTINEL inspect all three retained App Routing worktrees and repeat every prior command";

      try {
        const result = await askAgent(
          isolatedAgentContext(ctx) as never,
          originalPrompt,
          {
            retryDelayMs: 0,
            durableContext: {
              contextDir,
              taskId:
                "domain/reconcile-retained-app-routing-three-spec-journey-f99e7c70-20260808",
              generation: 3,
              sourceCommit: () => sourceCommit,
              runId: "175768290",
              phase: "terminal-review",
            },
          },
        );

        expect(result).toMatchObject({
          decision: "committed",
          liveReady: true,
        });
        expect(prompts).toHaveLength(2);
        expect(prompts[0]).toContain(originalPrompt);
        expect(prompts[1]).not.toContain(originalPrompt);
        expect(prompts[1]).toContain(
          "Recover the provider-aborted structured judgment from durable task context",
        );
        expect(prompts[1]).toContain("do not replay the prior full session");
        expect(prompts[1]).toContain(currentTaskContextPath(contextDir));

        const current = JSON.parse(
          readFileSync(currentTaskContextPath(contextDir), "utf8"),
        );
        expect(current.sourceCommit).toBe(recoveredSource);
        expect(current.runId).toBe("175768290");
        expect(current.previousHandoffPath).toBeTruthy();
        const predecessor = JSON.parse(
          readFileSync(current.previousHandoffPath, "utf8"),
        );
        expect(predecessor.sourceCommit).toBe(beforeSource);
        expect(readFileSync(predecessor.judgmentPath, "utf8")).toContain(
          originalPrompt,
        );
        expect(readFileSync(current.judgmentPath, "utf8")).not.toContain(
          originalPrompt,
        );
      } finally {
        rmSync(contextDir, { recursive: true, force: true });
      }
    }
  });

  test("fails after repeated terminal-stream failures while retaining the durable recovery chain", async () => {
    const contextDir = mkdtempSync(join(tmpdir(), "provider-abort-repeated-"));
    const statuses = ["error", "interrupted"] as const;
    const ctx = {
      agent: "aks-explorer",
      runAgent: async () => ({ status: statuses.shift() }),
    };

    try {
      await expect(
        askAgent(
          isolatedAgentContext(ctx) as never,
          "Judge exact staging run 175768290.",
          {
            retryDelayMs: 0,
            durableContext: {
              contextDir,
              taskId:
                "domain/reconcile-retained-app-routing-three-spec-journey-f99e7c70-20260808",
              generation: 3,
              sourceCommit: () => "913ee97e4e706711e863208f3c277025bf6bf1e3",
              runId: "175768290",
              phase: "terminal-review",
            },
          },
        ),
      ).rejects.toThrow("failed before structured judgment after two attempts");

      const current = JSON.parse(
        readFileSync(currentTaskContextPath(contextDir), "utf8"),
      );
      expect(current.previousHandoffPath).toBeTruthy();
      expect(existsSync(current.handoffPath)).toBe(true);
      expect(existsSync(current.judgmentPath)).toBe(true);
      expect(existsSync(current.previousHandoffPath)).toBe(true);
    } finally {
      rmSync(contextDir, { recursive: true, force: true });
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
      isolatedAgentContext(ctx) as never,
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
      askAgent(isolatedAgentContext(ctx) as never, "Review terminal run 42.", {
        retryDelayMs: 0,
      }),
    ).rejects.toThrow("failed before structured judgment after two attempts");
  });

  test("preserves an exact blocker correction across an interrupted correction session", async () => {
    const prompts: string[] = [];
    const decisions = [
      {
        status: "done",
        structuredResult: {
          decision: "needs-agent",
          summary: "No newer AzureLinux security image is published.",
          evidence: [
            "pipeline-run:175244417",
            "published-version:AKSAzureLinux-V3gen2-202607.29.0",
          ],
          liveReady: false,
        },
      },
      { status: "interrupted" },
      {
        status: "done",
        structuredResult: {
          decision: "waiting",
          summary: "Wait for a newer staging AzureLinux image publication.",
          evidence: ["pipeline-run:175244417", "cleanup:complete"],
          liveReady: false,
          condition: {
            id: "azurelinux-securitypatch-westus2-after-202607.29.0",
            type: "aks.node-image-publication.state",
            subject: "project:aks-rp-e2e",
            expected: {
              targetName: "staging",
              location: "westus2",
              field: "publishedVersion",
              notEquals: "AKSAzureLinux-V3gen2-202607.29.0",
            },
          },
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
      isolatedAgentContext(ctx) as never,
      "Review terminal Azure DevOps run 175244417 from current evidence.",
      {
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
        validateDecision: (candidate) =>
          exactPassNeedsOwnerProblem(candidate, false),
      },
    );

    expect(result).toMatchObject({
      decision: "waiting",
      condition: {
        type: "aks.node-image-publication.state",
        subject: "project:aks-rp-e2e",
      },
    });
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toContain(
      "No newer AzureLinux security image is published.",
    );
    expect(prompts[2]).toContain("needs-agent cannot defer an exact-pass task");
    expect(prompts[2]).toContain(
      "Preserve any hard-validation correction above",
    );
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
          decision: "needs-agent",
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

    const result = await askAgent(
      isolatedAgentContext(ctx) as never,
      "Normalize one scenario.",
      {
        scenarioNormalization: true,
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
      },
    );

    expect(result.decision).toBe("needs-agent");
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toContain("workflow owns task-branch publication");
  });

  test("keeps an Airlock-shaped exact-pass source gap inside workflow repair instead of needs-agent", async () => {
    const prompts: string[] = [];
    const decisions = [
      {
        status: "done",
        structuredResult: {
          decision: "needs-agent",
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
      isolatedAgentContext(ctx) as never,
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
    expect(prompts[1]).toContain("keep internal source gaps in this workflow");
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

  test("uses exactly four LocalDNS liveSpecIds while retaining the five-spec audit scope and one superseded spec", () => {
    const supersededSpecId = "spec.localdns.network-policy-coexistence";
    const auditSpecIds = [
      supersededSpecId,
      "spec.localdns.netpol-azure-nodesubnet",
      "spec.localdns.netpol-azure-overlay",
      "spec.localdns.netpol-calico",
      "spec.localdns.netpol-cilium",
    ];
    const liveSpecIds = [
      "spec.localdns.netpol-azure-nodesubnet",
      "spec.localdns.netpol-azure-overlay",
      "spec.localdns.netpol-calico",
      "spec.localdns.netpol-cilium",
    ];
    const selection = resolveLiveSpecIdSelection({
      specId: supersededSpecId,
      specIds: auditSpecIds,
      liveSpecIds,
    });

    expect(selection).toEqual({
      accepted: true,
      auditSpecIds,
      dispatchSpecIds: liveSpecIds,
      explicit: true,
    });
    expect(auditSpecIds).toHaveLength(5);
    expect(selection.accepted && selection.dispatchSpecIds).toHaveLength(4);
    expect(liveSpecIds).not.toContain(supersededSpecId);
  });

  test("uses one canonical sorted aggregate ID for selected queue metadata, candidate proof, and verification", () => {
    const root = mkdtempSync(join(tmpdir(), "selected-spec-aggregate-id-"));
    const auditSpecIds = [
      "spec.alpha",
      "spec.bravo",
      "spec.charlie",
      "spec.delta",
      "spec.superseded",
    ];
    const liveSpecIds = [
      "spec.delta",
      "spec.alpha",
      "spec.charlie",
      "spec.bravo",
    ];
    const canonicalAggregate = "spec.alpha,spec.bravo,spec.charlie,spec.delta";
    const taskId = "domain/selected-spec-aggregate";
    const sourceBranch = "task/domain-selected-spec-aggregate";
    const sourceCommit = "abc123";
    const runId = "178900001";
    try {
      const selection = resolveLiveSpecIdSelection({
        specIds: auditSpecIds,
        liveSpecIds,
      });
      expect(selection.accepted).toBe(true);
      if (!selection.accepted) throw new Error(selection.problem);
      const selectedAggregate = canonicalAggregateSpecId(
        selection.dispatchSpecIds,
      );

      const metadata = queueRunMetadata({
        taskId,
        generation: 4,
        specId: selectedAggregate,
        sourceBranch,
        sourceCommit,
        target: "staging",
        standaloneBuildId: "",
      });
      const proof = candidateReviewedRunProof({
        taskId,
        generation: 4,
        providerGeneration: 4,
        specIds: selection.dispatchSpecIds,
        target: "staging",
        standaloneBuildId: "",
        sourceBranch,
        sourceCommit,
        runId,
        runResult: "succeeded",
        reviewedAt: "2026-08-11T00:00:00Z",
      });
      const aggregatePath = join(root, "result.json");
      writeFileSync(
        aggregatePath,
        JSON.stringify({
          target: {
            name: "staging",
            environment: "staging",
            subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
            location: "westus2",
          },
          specResults: liveSpecIds.map((specId) => ({
            specId,
            status: "pass",
          })),
        }),
      );
      const specPaths = liveSpecIds.map((specId) => {
        const path = join(root, `${specId}.json`);
        writeFileSync(
          path,
          JSON.stringify({
            specId,
            status: "pass",
            raw: {
              assertions: [
                { name: `assert.${specId}`, verdictImpact: "claim", ok: true },
                {
                  name: "cleanup.resource-group-delete-requested",
                  verdictImpact: "cleanup",
                  ok: true,
                },
              ],
            },
          }),
        );
        return path;
      });
      const verification = verifySpecLiveProofFacts({
        taskId,
        generation: 4,
        specIds: selection.dispatchSpecIds,
        target: "staging",
        standaloneBuildId: "",
        proof,
        run: {
          id: runId,
          status: "completed",
          result: "succeeded",
          sourceBranch: `refs/heads/${sourceBranch}`,
          sourceVersion: sourceCommit,
          definition: { id: 467665 },
          templateParameters: {
            specs: liveSpecIds.join(","),
            target: "staging",
            standalone_build_id: "",
            metadata: JSON.stringify(metadata),
          },
        },
        artifactPaths: [aggregatePath, ...specPaths],
        expectedClaimIdsBySpec: Object.fromEntries(
          liveSpecIds.map((specId) => [specId, [`assert.${specId}`]]),
        ),
        sourceReachable: false,
        integratedCommitReachable: false,
        normalizationInvariantSatisfied: true,
        requireIntegration: false,
      });

      expect(selection.auditSpecIds).toEqual(auditSpecIds);
      expect(selection.dispatchSpecIds).toEqual(liveSpecIds);
      expect(selectedAggregate).toBe(canonicalAggregate);
      expect(metadata.specId).toBe(canonicalAggregate);
      expect(proof.specId).toBe(canonicalAggregate);
      expect(verification).toMatchObject({ accepted: true });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("preserves specIds and specId fallback when liveSpecIds is absent", () => {
    expect(
      resolveLiveSpecIdSelection({
        specId: "spec.b",
        specIds: ["spec.a", "spec.b"],
      }),
    ).toEqual({
      accepted: true,
      auditSpecIds: ["spec.a", "spec.b"],
      dispatchSpecIds: ["spec.a", "spec.b"],
      explicit: false,
    });
    expect(resolveLiveSpecIdSelection({ specId: "spec.only" })).toEqual({
      accepted: true,
      auditSpecIds: ["spec.only"],
      dispatchSpecIds: ["spec.only"],
      explicit: false,
    });
  });

  test("deduplicates repeated valid liveSpecIds in first-occurrence order", () => {
    expect(
      resolveLiveSpecIdSelection({
        specIds: ["spec.a", "spec.b"],
        liveSpecIds: ["spec.b", "spec.a", "spec.b", "spec.a"],
      }),
    ).toEqual({
      accepted: true,
      auditSpecIds: ["spec.a", "spec.b"],
      dispatchSpecIds: ["spec.b", "spec.a"],
      explicit: true,
    });
  });

  test("rejects malformed, empty, and out-of-scope liveSpecIds", () => {
    const specIds = ["spec.a", "spec.b"];
    const rejected = [
      { specIds, liveSpecIds: "spec.a" },
      { specIds, liveSpecIds: ["spec.a", " spec.b"] },
      { specIds, liveSpecIds: [] },
      { specIds, liveSpecIds: ["spec.a", "spec.outside"] },
    ].map((input) => resolveLiveSpecIdSelection(input));

    expect(rejected.every((result) => !result.accepted)).toBe(true);
    expect(
      rejected.map((result) => (result.accepted ? "" : result.problem)),
    ).toEqual([
      "input.liveSpecIds must be a nonempty array of exact spec ID strings",
      "input.liveSpecIds contains a malformed spec ID",
      "input.liveSpecIds must not be empty when present",
      "input.liveSpecIds contains ID outside input.specIds: spec.outside",
    ]);
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
        decision: "needs-agent",
        summary: "ownership is ambiguous",
        evidence: ["workspace:dirty"],
      }),
    ).toContain("authoritative current source/run handoff checkpoint");
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

  test("rejects dirty needs-agent recovery when task worktree ownership is established", () => {
    expect(
      taskWorktreeRecoveryDecisionProblem(
        {
          decision: "needs-agent",
          summary: "the attempted repair still fails",
          evidence: [
            "workspace:dirty",
            "technical-failure:generation-mismatch",
          ],
        },
        {
          workspaceDirty: true,
          ownershipEstablished: true,
          authoritativeCheckpointPath:
            "/app/projects/aks-rp-e2e/workspace/tasks/domain-example-1/current-context.json",
          sourceCommit: "a".repeat(40),
        },
      ),
    ).toContain("task/worktree ownership is established");
  });

  test("accepts genuine ownership ambiguity only with the authoritative source/run checkpoint", () => {
    const checkpoint =
      "/app/projects/aks-rp-e2e/workspace/tasks/domain-example-1/current-context.json";
    const sourceCommit = "b".repeat(40);
    expect(
      taskWorktreeRecoveryDecisionProblem(
        {
          decision: "needs-agent",
          summary: "two retained sessions claim the same unstaged path",
          evidence: [
            "ownership-ambiguity:path features/example/spec.json has conflicting retained-session provenance",
            `authoritative-checkpoint:${checkpoint}`,
            `authoritative-source-commit:${sourceCommit}`,
          ],
        },
        {
          workspaceDirty: true,
          ownershipEstablished: false,
          authoritativeCheckpointPath: checkpoint,
          sourceCommit,
        },
      ),
    ).toBeNull();
  });

  test("rejects forced-completion recovery while task-generated residue is dirty", () => {
    expect(
      taskWorktreeRecoveryDecisionProblem(
        {
          decision: "test-current",
          summary: "deadline reached after attempted residue removal",
          evidence: ["completion-guard:forced", "workspace:dirty"],
        },
        {
          workspaceDirty: true,
          ownershipEstablished: true,
          authoritativeCheckpointPath:
            "/app/projects/aks-rp-e2e/workspace/tasks/domain-example-1/current-context.json",
          sourceCommit: "c".repeat(40),
        },
      ),
    ).toContain("cannot complete while the task worktree remains dirty");
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

    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for the next scheduled master-validation pulse",
        evidence: ["comment:4954113"],
        condition: {
          id: "cpu-capacity-backoff-pulse",
          type: "aks.master-validation.check",
          subject: "project:aks-rp-e2e",
          expected: { field: "project", equals: "aks-rp-e2e" },
        },
      }),
    ).toContain("Wait on aks.master-validation.capacity-pulse");

    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for the next due capacity pulse",
        evidence: ["comment:4995919"],
        condition: {
          id: "cpu-capacity-backoff-pulse",
          type: "aks.master-validation.capacity-pulse",
          subject: "project:aks-rp-e2e",
          expected: { field: "project", equals: "aks-rp-e2e" },
        },
      }),
    ).toContain("baselineCycleSlot");

    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for the next due capacity pulse",
        evidence: ["comment:4995919"],
        condition: {
          id: "cpu-capacity-backoff-pulse",
          type: "aks.master-validation.capacity-pulse",
          subject: "project:aks-rp-e2e",
          expected: { field: "cycleSlot", notEquals: 82677 },
        },
      }),
    ).toBeNull();
  });

  test("recognizes only cleaned pre-claim AKS capacity artifacts", () => {
    const root = mkdtempSync(join(tmpdir(), "spec-live-capacity-block-"));
    const artifactPath = join(root, "result.json");
    const writeArtifact = (assertions: unknown[], cleanupStatus = "complete") =>
      writeFileSync(
        artifactPath,
        JSON.stringify({
          specId: "spec.sample.capacity",
          status: "error",
          assertions,
          cleanup: { attempted: true, status: cleanupStatus },
        }),
      );
    try {
      writeArtifact([
        {
          name: "setup.execution-blocked",
          ok: false,
          verdictImpact: "setup",
          detail: 'HTTP 400 body.code="AKSCapacityHeavyUsage"',
        },
      ]);
      expect(
        artifactProvesPreClaimCapacityBlock(
          artifactPath,
          "spec.sample.capacity",
        ),
      ).toBe(true);

      writeArtifact([
        {
          name: "setup.execution-blocked",
          ok: false,
          verdictImpact: "setup",
          detail: "AKSCapacityHeavyUsage",
        },
        {
          name: "assert.sample.claim",
          ok: false,
          verdictImpact: "claim",
        },
      ]);
      expect(
        artifactProvesPreClaimCapacityBlock(
          artifactPath,
          "spec.sample.capacity",
        ),
      ).toBe(false);

      writeArtifact(
        [
          {
            name: "setup.execution-blocked",
            ok: false,
            verdictImpact: "setup",
            detail: "AKSCapacityHeavyUsage",
          },
        ],
        "incomplete",
      );
      expect(
        artifactProvesPreClaimCapacityBlock(
          artifactPath,
          "spec.sample.capacity",
        ),
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

  test("rejects imprecise needs-agent for exact-pass work", () => {
    const decision = {
      decision: "needs-agent" as const,
      summary:
        "execute mode still does not implement the declared compliance/status claims",
      evidence: ["execute-mode-remains-nonlive-reviewed-exception"],
    };
    expect(exactPassNeedsOwnerProblem(decision, false)).toContain(
      "keep internal source gaps in this workflow",
    );
    expect(exactPassNeedsOwnerProblem(decision, true)).toBeNull();
  });

  test("keeps the generation-5 LocalDNS internal source gap in bounded workflow repair despite external-boundary prefixes", () => {
    const decision = {
      decision: "needs-agent" as const,
      summary:
        "Current source is not live-ready and requires the bounded same-task source repair; immediate completion was required before that repair could be made.",
      evidence: [
        "workflow-run:wr_1786342842990_6vcq",
        "session:s_1786343019890_380",
        "The direct carrier still imports execFile from node:child_process and calls Bun through runScenarioChild.",
        "The scenario library still imports execFileSync from node:child_process and selects subscription, location, and API version through hard-coded fallbacks rather than resolvedTargetInputs().",
        "external-capability:LocalDNS source repair",
        "external-producer:app-ops",
        "artifact:/app/.state/sessions/s_1786343019890_380/result.json",
        "resume-condition:workflow source guard is relaxed",
      ],
    };

    expect(exactPassNeedsOwnerProblem(decision, false)).toContain(
      "confirmed internal source gap",
    );
  });

  test("continues the exact network-CNI multi-spec partial patch after its completion guardrail", async () => {
    const retainedWorkspace = "/tmp/retained-network-cni-partial";
    const workflowRun = {
      runId: "wr_1786372163930_0n8i",
      workflow: "spec-live-reconciliation",
    };
    const sessionResult = {
      sessionId: "s_1786372198869_67",
      finishParams: {
        result: {
          decision: "needs-agent" as const,
          summary:
            "Bounded guardrail stopped preparation with the preserved axis patch applied but uncommitted; all six over-cap carriers remain unresolved.",
          evidence: ["focused checks passed"],
          liveReady: false,
        },
      },
    };
    const payload = {
      taskId:
        "repair-network-cni-cap-nine-spec-source-live-integration-20260810",
      paths: { workspaceDir: retainedWorkspace },
      input: {
        specIds: Array.from({ length: 9 }, (_, index) => `spec.${index}`),
      },
    };

    expect(workflowRun).toMatchObject({
      runId: "wr_1786372163930_0n8i",
      workflow: "spec-live-reconciliation",
    });
    expect(sessionResult.sessionId).toBe("s_1786372198869_67");
    expect(payload?.taskId).toBe(
      "repair-network-cni-cap-nine-spec-source-live-integration-20260810",
    );
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
    expect(payload?.input?.specIds).toHaveLength(9);
    expect(sessionResult.finishParams.result).toMatchObject({
      decision: "needs-agent",
      liveReady: false,
    });
    expect(
      exactPassNeedsOwnerProblem(sessionResult.finishParams.result, true),
    ).toContain("confirmed internal source gap");

    const prompts: string[] = [];
    const decisions = [
      {
        status: "done" as const,
        structuredResult: sessionResult.finishParams.result,
      },
      {
        status: "done" as const,
        structuredResult: {
          decision: "committed" as const,
          summary: "Completed and committed the remaining carrier-cap repair.",
          evidence: ["source-commit:def"],
          liveReady: true,
        },
      },
    ];
    const result = await askAgent(
      isolatedAgentContext({
        agent: "aks-explorer",
        runAgent: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return decisions.shift();
        },
      }) as never,
      "Resume the same network-CNI multi-spec task in its retained worktree.",
      {
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
        validateDecision: (candidate) =>
          exactPassNeedsOwnerProblem(candidate, true),
      },
    );

    expect(result.decision).toBe("committed");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("confirmed internal source gap");
    expect(prompts[1]).toContain("over-cap carriers");
    expect(prompts[1]).toContain(
      "perform that mutation and its narrow verification now",
    );
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
  });

  test("continues the verified dirty network-CNI repair after the post-check completion guardrail", async () => {
    const retainedWorkspace = "/tmp/retained-network-cni-verified";
    const workflowRun = {
      runId: "wr_1786643616678_8n0a",
      workflow: "spec-live-reconciliation",
    };
    const sessionResult = {
      sessionId: "s_1786643624590_80",
      finishParams: {
        result: {
          decision: "needs-agent" as const,
          summary:
            "The bounded repair is locally verified but uncommitted because the completion guardrail required an immediate finish.",
          evidence: ["154 pass, 0 fail"],
          liveReady: false,
        },
      },
    };
    const payload = {
      paths: { workspaceDir: retainedWorkspace },
      input: {
        specIds: Array.from({ length: 9 }, (_, index) => `spec.${index}`),
      },
    };

    expect(workflowRun).toMatchObject({
      runId: "wr_1786643616678_8n0a",
      workflow: "spec-live-reconciliation",
    });
    expect(sessionResult.sessionId).toBe("s_1786643624590_80");
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
    expect(payload?.input?.specIds).toHaveLength(9);
    expect(sessionResult.finishParams.result.decision).toBe("needs-agent");
    expect(
      exactPassNeedsOwnerProblem(sessionResult.finishParams.result, true),
    ).toContain("verified dirty repair");

    const prompts: string[] = [];
    const decisions = [
      {
        status: "done" as const,
        structuredResult: sessionResult.finishParams.result,
      },
      {
        status: "done" as const,
        structuredResult: {
          decision: "committed" as const,
          summary: "Committed the already-verified bounded six-file repair.",
          evidence: ["source-commit:def"],
          liveReady: true,
        },
      },
    ];
    const result = await askAgent(
      isolatedAgentContext({
        agent: "aks-explorer",
        runAgent: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return decisions.shift();
        },
      }) as never,
      "Resume the same retained network-CNI worktree at its commit checkpoint.",
      {
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
        validateDecision: (candidate) =>
          exactPassNeedsOwnerProblem(candidate, true),
      },
    );

    expect(result.decision).toBe("committed");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("verified dirty repair");
    expect(prompts[1]).toContain(
      "perform that mutation and its narrow verification now",
    );
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
  });

  test("continues the exact direct-runtime-observation repair to the workflow-owned commit checkpoint", async () => {
    const retainedWorkspace = "/tmp/retained-network-cni-runtime";
    const workflowRun = {
      runId: "wr_1786672942557_f7zk",
      workflow: "spec-live-reconciliation",
    };
    const sessionResult = {
      sessionId: "s_1786672976089_15",
      finishParams: {
        result: {
          decision: "needs-agent" as const,
          summary:
            "Bounded guardrail interrupted a verified but uncommitted internal source repair.",
          evidence: ["focused post-edit checks passed"],
          liveReady: false,
        },
      },
    };
    const payload = {
      taskId:
        "repair-network-cni-cap-nine-spec-source-live-integration-20260810",
      paths: { workspaceDir: retainedWorkspace },
      input: {
        specIds: Array.from({ length: 9 }, (_, index) => `spec.${index}`),
      },
    };

    expect(workflowRun).toMatchObject({
      runId: "wr_1786672942557_f7zk",
      workflow: "spec-live-reconciliation",
    });
    expect(sessionResult.sessionId).toBe("s_1786672976089_15");
    expect(payload?.taskId).toBe(
      "repair-network-cni-cap-nine-spec-source-live-integration-20260810",
    );
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
    expect(payload?.input?.specIds).toHaveLength(9);
    expect(sessionResult.finishParams.result).toMatchObject({
      decision: "needs-agent",
      liveReady: false,
    });
    expect(
      exactPassNeedsOwnerProblem(sessionResult.finishParams.result, true),
    ).toContain("verified dirty repair");

    const prompts: string[] = [];
    const decisions = [
      {
        status: "done" as const,
        structuredResult: sessionResult.finishParams.result,
      },
      {
        status: "done" as const,
        structuredResult: {
          decision: "committed" as const,
          summary:
            "Committed the verified six-file direct-runtime-observation repair.",
          evidence: ["source-commit:def"],
          liveReady: true,
        },
      },
    ];
    const result = await askAgent(
      isolatedAgentContext({
        agent: "aks-explorer",
        runAgent: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return decisions.shift();
        },
      }) as never,
      "Resume the retained network-CNI repair at its workflow-owned commit checkpoint.",
      {
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
        validateDecision: (candidate) =>
          exactPassNeedsOwnerProblem(candidate, true),
      },
    );

    expect(result.decision).toBe("committed");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("verified dirty repair");
    expect(prompts[1]).toContain(
      "perform that mutation and its narrow verification now",
    );
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
  });

  test("continues the exact verified one-file network-CNI repair through the commit checkpoint", async () => {
    const retainedWorkspace = "/tmp/retained-network-cni-one-file";
    const workflowRun = {
      runId: "wr_1786675154382_otgv",
      workflow: "spec-live-reconciliation",
    };
    const sessionResult = {
      sessionId: "s_1786675340203_33",
      finishParams: {
        result: {
          decision: "needs-agent" as const,
          summary:
            "Completion guardrail interrupted after a verified one-file source repair but before commit.",
          evidence: ["all staging checks passed", "no commit was made"],
          liveReady: false,
        },
      },
    };
    const payload = {
      taskId:
        "repair-network-cni-cap-nine-spec-source-live-integration-20260810",
      paths: { workspaceDir: retainedWorkspace },
      input: {
        specIds: Array.from({ length: 9 }, (_, index) => `spec.${index}`),
      },
    };

    expect(workflowRun).toMatchObject({
      runId: "wr_1786675154382_otgv",
      workflow: "spec-live-reconciliation",
    });
    expect(sessionResult.sessionId).toBe("s_1786675340203_33");
    expect(payload?.taskId).toBe(
      "repair-network-cni-cap-nine-spec-source-live-integration-20260810",
    );
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
    expect(payload?.input?.specIds).toHaveLength(9);
    expect(sessionResult.finishParams.result).toMatchObject({
      decision: "needs-agent",
      liveReady: false,
    });
    expect(
      exactPassNeedsOwnerProblem(sessionResult.finishParams.result, true),
    ).toContain("verified dirty repair");

    const prompts: string[] = [];
    const decisions = [
      {
        status: "done" as const,
        structuredResult: sessionResult.finishParams.result,
      },
      {
        status: "done" as const,
        structuredResult: {
          decision: "committed" as const,
          summary: "Committed the already-verified bounded one-file repair.",
          evidence: ["source-commit:def"],
          liveReady: true,
        },
      },
    ];
    const result = await askAgent(
      isolatedAgentContext({
        agent: "aks-explorer",
        runAgent: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return decisions.shift();
        },
      }) as never,
      "Resume the retained network-CNI repair at its workflow-owned commit checkpoint.",
      {
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
        validateDecision: (candidate) =>
          exactPassNeedsOwnerProblem(candidate, true),
      },
    );

    expect(result.decision).toBe("committed");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("verified dirty repair");
    expect(prompts[1]).toContain(
      "perform that mutation and its narrow verification now",
    );
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
  });

  test("does not force a failed dirty repair past its check boundary", () => {
    const decision = {
      decision: "needs-agent" as const,
      summary:
        "The completion guardrail stopped this dirty repair after its focused checks failed.",
      evidence: ["focused-checks:failed", "test-failure:planner.test.ts"],
    };

    expect(exactPassNeedsOwnerProblem(decision, true)).toBeNull();
  });

  test("resumes the exact generation-5 LocalDNS retained-context verdict as same-task structured correction", async () => {
    const retainedWorkspace = "/tmp/retained-localdns-generation-5";
    const authoritativePhase = "preparation-1d6f04754f";
    const workflowRun = { runId: "wr_1786378354368_vqy7" };
    const sessionResult = {
      sessionId: "s_1786378366463_66",
      finishParams: {
        result: {
          decision: "needs-agent" as const,
          summary:
            "Source is not ready for ADO and requires the identified same-task source repair; bounded completion guardrail stopped before implementation.",
          evidence: ["confirmed internal source gap"],
          liveReady: false,
        },
      },
    };
    const authoritativeContext = {
      generation: 5,
      phase: authoritativePhase,
      handoffPath: `/tmp/runs/no-run/${authoritativePhase}.json`,
      sourceCommit: "9faded15bc9fd5f80a4d233a82f561077436f892",
    };
    const payload = {
      generation: 5,
      paths: { workspaceDir: retainedWorkspace },
    };

    expect(workflowRun.runId).toBe("wr_1786378354368_vqy7");
    expect(sessionResult.sessionId).toBe("s_1786378366463_66");
    expect(payload?.generation).toBe(5);
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
    expect(authoritativeContext).toMatchObject({
      generation: 5,
      phase: authoritativePhase,
      sourceCommit: "9faded15bc9fd5f80a4d233a82f561077436f892",
    });
    expect(authoritativeContext.handoffPath).toContain(
      `/runs/no-run/${authoritativePhase}.json`,
    );

    const prompts: string[] = [];
    const decisions = [
      {
        status: "done" as const,
        structuredResult: sessionResult.finishParams.result,
      },
      {
        status: "done" as const,
        structuredResult: {
          decision: "committed" as const,
          summary: "Applied the bounded LocalDNS source repair.",
          evidence: ["source-commit:def"],
          liveReady: true,
        },
      },
    ];
    const result = await askAgent(
      isolatedAgentContext({
        agent: "aks-explorer",
        runAgent: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return decisions.shift();
        },
      }) as never,
      "Resume the same generation-5 LocalDNS task from its retained authoritative context.",
      {
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
        validateDecision: (candidate) =>
          exactPassNeedsOwnerProblem(candidate, true),
      },
    );

    expect(result.decision).toBe("committed");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain(
      "Resume the same generation-5 LocalDNS task from its retained authoritative context.",
    );
    expect(prompts[1]).toContain("confirmed internal source gap");
    expect(prompts[1]).toContain(
      "perform that mutation and its narrow verification now",
    );
    expect(prompts[1]).toContain(sessionResult.finishParams.result.summary);
    expect(payload?.paths?.workspaceDir).toBe(retainedWorkspace);
    expect(authoritativeContext.phase).toBe(authoritativePhase);
  });

  test("prioritizes the diagnosed generation-6 LocalDNS mutation before the correction operation budget", async () => {
    const prompts: string[] = [];
    const decisions = [
      {
        status: "done",
        structuredResult: {
          decision: "needs-agent",
          summary:
            "The isolated worktree still needs the already-diagnosed LocalDNS FIPS repair, but work remains.",
          evidence: [
            "current source still imports execFile and uses hard-coded target fallbacks",
            "bounded same-task source repair:features/localdns/lib/localdns-os-arch-matrix.ts",
          ],
        },
      },
      {
        status: "done",
        structuredResult: {
          decision: "committed",
          summary: "Applied and narrowly verified the LocalDNS FIPS repair.",
          evidence: ["source-commit:def"],
          liveReady: true,
        },
      },
    ];
    const result = await askAgent(
      isolatedAgentContext({
        agent: "aks-explorer",
        runAgent: async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return decisions.shift();
        },
      }) as never,
      "Repair generation 6 from the current isolated task worktree.",
      {
        continueDomainWorkOnValidation: true,
        retryDelayMs: 0,
        validateDecision: (candidate) =>
          exactPassNeedsOwnerProblem(candidate, false),
      },
    );

    expect(result.decision).toBe("committed");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Source-first completion guard");
    expect(prompts[1]).toContain(
      "perform that mutation and its narrow verification now",
    );
    expect(prompts[1]).toContain(
      "at most four read-only investigation/tool operations before the first source mutation",
    );
    expect(prompts[1]).toContain(
      "Work remaining is not by itself a needs-agent boundary",
    );
    expect(prompts[1]).toContain(
      "features/localdns/lib/localdns-os-arch-matrix.ts",
    );
  });

  test("accepts needs-agent for a genuine exact-pass external ownership boundary", () => {
    const decision = {
      decision: "needs-agent" as const,
      summary:
        "The subscription policy authority must approve the unavailable staging capability.",
      evidence: [
        "external-capability:staging subscription policy exemption",
        "external-producer:subscription policy owner",
        "artifact:/app/projects/aks-rp-e2e/runs/policy-denial.json",
        "resume-condition:policy exemption approval is published",
      ],
    };

    expect(exactPassNeedsOwnerProblem(decision, false)).toBeNull();
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

  test("validates only the reviewed Industry terminal subset while preserving ready selected specs", () => {
    const root = mkdtempSync(join(tmpdir(), "industry-terminal-subset-"));
    try {
      const specsDir = join(root, "features", "industry", "specs");
      mkdirSync(specsDir, { recursive: true });
      const readySpecIds = Array.from(
        { length: 16 },
        (_, index) =>
          `spec.industry.ready-${String(index + 1).padStart(2, "0")}`,
      );
      const terminalSpecIds = [
        "spec.industry.terminal-a",
        "spec.industry.terminal-b",
      ];
      for (const specId of readySpecIds) {
        writeFileSync(
          join(specsDir, `${specId}.json`),
          JSON.stringify({ id: specId, status: "ready", specState: "ready" }),
        );
      }
      for (const specId of terminalSpecIds) {
        writeFileSync(
          join(specsDir, `${specId}.json`),
          JSON.stringify({
            id: specId,
            status: "blocked",
            specState: "reviewed-exception",
          }),
        );
      }
      const selectedSpecIds = [...readySpecIds, ...terminalSpecIds];
      const input = {
        specIds: selectedSpecIds,
        reviewedTerminalSpecIds: terminalSpecIds,
      };
      const accepted = specTerminalDispositionCheck(root, input, {
        specId: terminalSpecIds.join(","),
        status: "blocked",
        specState: "reviewed-exception",
      });

      expect(accepted.accepted).toBe(true);
      expect(
        accepted.evidence.filter((item) =>
          item.startsWith("terminal-disposition-spec-path:"),
        ),
      ).toHaveLength(2);
      expect(accepted.evidence.join("\n")).not.toContain("ready-01");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects invalid reviewed terminal subsets and mismatched dispositions", () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-subset-rejections-"));
    try {
      const specsDir = join(root, "features", "sample", "specs");
      mkdirSync(specsDir, { recursive: true });
      for (const specId of ["spec.sample.ready", "spec.sample.terminal"]) {
        writeFileSync(
          join(specsDir, `${specId}.json`),
          JSON.stringify({
            id: specId,
            status: specId.endsWith("terminal") ? "blocked" : "ready",
            specState: specId.endsWith("terminal")
              ? "reviewed-exception"
              : "ready",
          }),
        );
      }
      const disposition = {
        specId: "spec.sample.terminal",
        status: "blocked",
        specState: "reviewed-exception",
      };
      const selected = ["spec.sample.ready", "spec.sample.terminal"];
      const problemFor = (reviewedTerminalSpecIds: unknown) =>
        specTerminalDispositionCheck(
          root,
          { specIds: selected, reviewedTerminalSpecIds },
          disposition,
        ).problem;

      expect(problemFor([])).toContain("must not be empty");
      expect(
        problemFor(["spec.sample.terminal", "spec.sample.terminal"]),
      ).toContain("duplicate");
      expect(problemFor(["spec.sample.terminal", ""])).toContain(
        "empty specIds",
      );
      expect(problemFor(["spec.sample.unknown"])).toContain(
        "outside the exact selected set",
      );
      expect(
        specTerminalDispositionCheck(
          root,
          {
            specIds: selected,
            reviewedTerminalSpecIds: ["spec.sample.terminal"],
          },
          { ...disposition, specId: selected.join(",") },
        ).problem,
      ).toContain("does not match the exact reviewed terminal subset");
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

  test("accepts a structured AzureLinux publication wait observed by the app watcher", () => {
    expect(
      agentConditionProblem({
        decision: "waiting",
        summary:
          "Wait for a newer westus2 staging AzureLinux security patch publication.",
        evidence: [
          "pipeline-run:175244417",
          "nodeImageVersion=AKSAzureLinux-V3gen2-202607.29.0",
        ],
        condition: {
          id: "azurelinux-securitypatch-westus2-after-202607.29.0",
          type: "aks.node-image-publication.state",
          subject: "project:aks-rp-e2e",
          expected: {
            targetName: "staging",
            location: "westus2",
            imageFamily: "AKSAzureLinux",
            channel: "SecurityPatch",
            field: "publishedVersion",
            notEquals: "AKSAzureLinux-V3gen2-202607.29.0",
          },
        },
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

  test("treats an accepted exact run as authoritative across task revisions", () => {
    expect(
      resolvePriorVerificationInput({
        acceptedRunId: "174996775",
        acceptedSourceCommit: "b652f7dc878f4d1dc724c22698e1bd1e7bf89325",
      }),
    ).toEqual({
      value: {
        runId: "174996775",
        authoritative: true,
        acceptedSourceCommit: "b652f7dc878f4d1dc724c22698e1bd1e7bf89325",
        kind: "accepted",
      },
      problem: null,
    });
    expect(
      resolvePriorVerificationInput({ acceptedRunId: "174996775" }).problem,
    ).toContain("must be declared together");
    expect(
      resolvePriorVerificationInput({
        acceptedRunId: "174996775",
        acceptedSourceCommit: "b652f7dc878f4d1dc724c22698e1bd1e7bf89325",
        retryPipelineRunId: "175005656",
      }).problem,
    ).toContain("conflicting prior verification run ids");
    expect(
      resolvePriorVerificationInput({
        acceptedRunId: "174996775",
        acceptedSourceCommit: "b652f7dc878f4d1dc724c22698e1bd1e7bf89325",
        priorVerificationRunId: "174996775",
      }).problem,
    ).toBeNull();
  });

  test("inherits an authoritative pass from bounded completed-child evidence", () => {
    const appDir = mkdtempSync(join(tmpdir(), "spec-live-child-proof-"));
    try {
      const proofPath = join(appDir, "proof.json");
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
      expect(
        inheritedAuthoritativeRunReference(
          {
            children: {
              completed: [
                {
                  taskId:
                    "domain/recover-spec-traffic-api-proxy-cert-rotation-post-rotation-proxy-500-20260801",
                  evidence: [`proof:${proofPath}`],
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

  test("serializes complete queue metadata as pipeline string pairs without changing spec selection", () => {
    const metadata = queueRunMetadata({
      taskId: "domain/spec-live-metadata-contract",
      generation: 1,
      specId: "spec.service-platform.queuewatcher",
      sourceBranch: "task/domain-spec-live-metadata-contract",
      sourceCommit: "ecf26332c5a29b38f212e19ca2ac09a4bffbae59",
      target: "staging",
      standaloneBuildId: "177400000",
      planPath: "ci/plans/metadata-contract.plan.json",
      retryOfRunId: "177474177",
    });
    const serialized = JSON.stringify(metadata);

    expect(serialized).toContain('"generation":"1"');
    expect(serialized).not.toContain('"generation":1');
    expect(
      Object.entries(JSON.parse(serialized)).every(
        ([key, value]) =>
          /^[A-Za-z0-9_.:-]{1,80}$/.test(key) && typeof value === "string",
      ),
    ).toBe(true);

    const parameters = queueRunPipelineParameters({
      specId: "spec.service-platform.queuewatcher",
      target: "staging",
      standaloneBuildId: "177400000",
      planPath: "ci/plans/metadata-contract.plan.json",
      metadata: serialized,
    });
    expect(parameters).toContain(`metadata=${serialized}`);
    expect(parameters).toContain("specs=spec.service-platform.queuewatcher");
    expect(
      parameters.find((value) => value.startsWith("specs=")),
    ).not.toContain("177474177");
    expect(
      parameters.find((value) => value.startsWith("specs=")),
    ).not.toContain("177477484");

    const run = {
      id: "177500000",
      sourceVersion: "ecf26332c5a29b38f212e19ca2ac09a4bffbae59",
      templateParameters: {
        specs: "spec.service-platform.queuewatcher",
        target: "staging",
        standalone_build_id: "177400000",
        metadata: serialized,
      },
    };
    const exactFilter = {
      taskId: "domain/spec-live-metadata-contract",
      generation: 1,
      specId: "spec.service-platform.queuewatcher",
      sourceCommit: "ecf26332c5a29b38f212e19ca2ac09a4bffbae59",
      target: "staging",
      standaloneBuildId: "177400000",
    };
    expect(matchingTaskGenerationRuns([run], exactFilter)).toEqual([run]);
    expect(
      matchingTaskGenerationRuns([run], { ...exactFilter, generation: 2 }),
    ).toEqual([]);
  });

  test("does not suppress a fresh Queuewatcher dispatch with stale reviewed-source lineage", () => {
    const retrySourceCommit = "ecf26332c5a29b38f212e19ca2ac09a4bffbae59";
    const staleReviewedSourceCommit =
      "ecf26332c51b7381e4d9fb4db94ac2244c9621c5";
    const taskId =
      "domain/master-validation-route-verification/spec.service-platform.queuewatcher/672a87413d01";
    const staleRun = {
      id: 175620959,
      sourceBranch:
        "refs/heads/task/domain-master-validation-route-verification-spec.service-platform.queuew-f4db4724f5",
      sourceVersion: retrySourceCommit,
      templateParameters: {
        specs: "spec.service-platform.queuewatcher",
        target: "staging",
        standalone_build_id: "175600006",
        metadata: JSON.stringify({
          taskId,
          generation: "1",
          reviewed_source_commit: staleReviewedSourceCommit,
        }),
      },
    };
    const exactFilter = {
      taskId,
      generation: 1,
      specId: "spec.service-platform.queuewatcher",
      sourceCommit: retrySourceCommit,
      target: "staging",
      standaloneBuildId: "175600006",
    };

    expect(
      proofMetadataMatchesSource(
        JSON.parse(staleRun.templateParameters.metadata),
        retrySourceCommit,
      ),
    ).toBe(false);
    expect(matchingTaskRuns([staleRun], exactFilter)).toEqual([]);
    expect(matchingTaskGenerationRuns([staleRun], exactFilter)).toEqual([]);
    expect(
      invalidatedRunRequiresSourceChange(staleRun, retrySourceCommit),
    ).toBe(false);

    const metadata = queueRunMetadata({
      ...exactFilter,
      sourceBranch:
        "task/domain-master-validation-route-verification-spec.service-platform.queuew-f4db4724f5",
      retryOfRunId: "175620959",
    });
    expect(metadata).toMatchObject({
      taskId,
      generation: "1",
      specId: "spec.service-platform.queuewatcher",
      sourceCommit: retrySourceCommit,
      reviewed_source_commit: retrySourceCommit,
      target: "staging",
      standaloneBuildId: "175600006",
      standalone_build_id: "175600006",
      retryOfRunId: "175620959",
    });

    const validRun = {
      ...staleRun,
      id: 175620960,
      templateParameters: {
        ...staleRun.templateParameters,
        metadata: JSON.stringify(metadata),
      },
    };
    expect(matchingTaskRuns([staleRun, validRun], exactFilter)).toEqual([
      validRun,
    ]);
    expect(
      matchingTaskGenerationRuns([staleRun, validRun], exactFilter),
    ).toEqual([validRun]);
    expect(
      invalidatedRunRequiresSourceChange(validRun, retrySourceCommit),
    ).toBe(true);
  });

  test("returns a pre-claim standalone failure to the owner instead of retrying an expired build", () => {
    expect(
      standaloneRetryTargetProblem({
        standaloneBuildId: "174851380",
        hasSameSpecArtifact: false,
      }),
    ).toContain("new task generation");
    expect(
      standaloneRetryTargetProblem({
        standaloneBuildId: "174851380",
        hasSameSpecArtifact: true,
      }),
    ).toBeNull();
    expect(
      standaloneRetryTargetProblem({
        standaloneBuildId: "",
        hasSameSpecArtifact: false,
      }),
    ).toBeNull();
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
    expect(pullRequestReviewCountCondition("77", 3)).toEqual({
      id: "pull-request-77-unresolved-review-count-not-3",
      type: "pull-request.state",
      subject: "pull-request:77",
      expected: { field: "unresolvedReviewCount", notEquals: 3 },
    });
    expect(
      pullRequestReviewFingerprintCondition("77", "357da4ec3208387c"),
    ).toEqual({
      id: "pull-request-77-review-fingerprint-not-357da4ec3208387c",
      type: "pull-request.state",
      subject: "pull-request:77",
      expected: {
        field: "reviewFingerprint",
        notEquals: "357da4ec3208387c",
      },
    });
  });

  test("keeps review-thread changes actionable on the existing PR wait path", () => {
    expect(
      pullRequestWaitConditions("16671253", "repair-commit", {
        available: true,
        unresolvedCount: 3,
        fingerprint: "357da4ec3208387c",
        threads: [
          {
            threadId: "255003419",
            path: "/features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-nginx-large-header.test.ts",
            author: "GitOps",
            content: "Please keep the cleanup proof attached.",
          },
        ],
      }),
    ).toEqual([
      pullRequestWaitCondition("16671253"),
      pullRequestSourceUpdateCondition("16671253", "repair-commit"),
      pullRequestReviewCountCondition("16671253", 3),
      pullRequestReviewFingerprintCondition("16671253", "357da4ec3208387c"),
    ]);
  });

  test("keeps unchanged merge-only PR state from creating duplicate review work", () => {
    expect(
      pullRequestWaitConditions("16671253", "repair-commit", {
        available: true,
        unresolvedCount: 0,
        fingerprint: "",
        threads: [],
      }),
    ).toEqual([
      pullRequestWaitCondition("16671253"),
      pullRequestSourceUpdateCondition("16671253", "repair-commit"),
    ]);
  });

  test("registers adopted spec-live runs for watcher observation", () => {
    const appDir = mkdtempSync(join(tmpdir(), "spec-live-watch-"));
    try {
      const registration = registerSpecLiveTrackedRun(appDir, "174851380");
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

  test("uses a holder-scoped future slot for capacity backoff", () => {
    expect(masterValidationCapacityPulseCycleSlot(82677 * 21_600_000)).toBe(
      82677,
    );
    const first = masterValidationCapacityPulseWaitCondition(
      "domain/example-a",
      2,
      82677,
    );
    expect(first).toMatchObject({
      id: expect.stringMatching(
        /^master-validation-capacity-after-slot-82677:task-[a-f0-9]{12}$/,
      ),
      type: "aks.master-validation.capacity-pulse",
      subject: "project:aks-rp-e2e",
      expected: { field: "cycleSlot", notEquals: 82677 },
    });
    expect(
      masterValidationCapacityPulseWaitCondition("domain/example-b", 2, 82677)
        .id,
    ).not.toBe(first.id);
  });

  test("retries a capacity-blocked run only after its terminal cycle slot", () => {
    const slot = 82681;
    const finishTime = new Date(slot * 21_600_000 + 10_000).toISOString();
    expect(
      masterValidationCapacityRetryDue(
        { finishTime },
        slot * 21_600_000 + 20_000,
      ),
    ).toBe(false);
    expect(
      masterValidationCapacityRetryDue(
        { finishTime },
        (slot + 1) * 21_600_000 + 1,
      ),
    ).toBe(true);
    expect(
      masterValidationCapacityRetryDue(
        { finishTime: "" },
        (slot + 1) * 21_600_000 + 1,
      ),
    ).toBe(false);
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

  test("requires the explicit history-only ancestry contract and routes it before Azure dispatch", () => {
    const testedSourceCommit = "c48d7c16248b2f95bc6643b7bd07f863165baafe";
    expect(
      historyOnlyAncestryInput({
        ownerJudgment: "please preserve ancestry without changing content",
        testedSourceCommit,
        sourceBranch: "refs/heads/task/network-cni",
      }),
    ).toEqual({ contract: null, problem: null });
    expect(
      historyOnlyAncestryInput({
        integrationStrategy: "ordinary-merge",
        testedSourceCommit,
        sourceBranch: "refs/heads/task/network-cni",
      }).problem,
    ).toContain("integrationStrategy must equal history-only-ancestry");
    expect(
      historyOnlyAncestryInput({
        integrationStrategy: "history-only-ancestry",
        testedSourceCommit,
        sourceBranch: "refs/heads/task/network-cni",
      }),
    ).toEqual({
      contract: {
        strategy: "history-only-ancestry",
        testedSourceCommit,
        sourceBranch: "task/network-cni",
      },
      problem: null,
    });

    const workflowSource = readFileSync(
      join(import.meta.dir, "spec-live-reconciliation.ts"),
      "utf8",
    );
    const strategyRoute = workflowSource.indexOf("if (historyOnly.contract)");
    const ordinaryProviderFlow = workflowSource.indexOf(
      "const contextDir = taskContextDir",
      strategyRoute,
    );
    expect(strategyRoute).toBeGreaterThan(0);
    expect(strategyRoute).toBeLessThan(ordinaryProviderFlow);
    expect(workflowSource.slice(strategyRoute, ordinaryProviderFlow)).toContain(
      "azure-dispatch:not-attempted",
    );
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

  test("skips a patch-equivalent historical commit and completes one clean replay lineage", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-equivalent-replay-"));
    const run = (args: string[], allowFailure = false) => {
      const result = spawnSync("git", args, {
        cwd: root,
        encoding: "utf8",
      });
      if (!allowFailure && result.status !== 0) {
        throw new Error(result.stderr || result.stdout);
      }
      return {
        status: result.status ?? 1,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      };
    };

    try {
      run(["init"]);
      run(["config", "user.email", "test@example.com"]);
      run(["config", "user.name", "Test"]);
      writeFileSync(
        join(root, "scenario.ts"),
        "export const state = 'before';\n",
      );
      run(["add", "scenario.ts"]);
      run(["commit", "-m", "base"]);
      const base = run(["rev-parse", "HEAD"]).stdout;

      run(["checkout", "-b", "first"]);
      writeFileSync(
        join(root, "scenario.ts"),
        "export const state = 'after';\n",
      );
      run(["add", "scenario.ts"]);
      run(["commit", "-m", "first copy"]);
      const first = run(["rev-parse", "HEAD"]).stdout;

      run(["checkout", "-b", "second", base]);
      writeFileSync(
        join(root, "scenario.ts"),
        "export const state = 'after';\n",
      );
      run(["add", "scenario.ts"]);
      run(["commit", "-m", "equivalent copy"]);
      const second = run(["rev-parse", "HEAD"]).stdout;

      run(["checkout", "-b", "target", base]);
      writeFileSync(join(root, "target.ts"), "export const target = true;\n");
      run(["add", "target.ts"]);
      run(["commit", "-m", "advance target"]);
      const target = run(["rev-parse", "HEAD"]).stdout;

      const replay = cherryPickScenarioReplayCommits(
        root,
        [first, second],
        (cwd, args, allowFailure) => {
          expect(cwd).toBe(root);
          return run(args, allowFailure);
        },
      );

      expect(replay.status).toBe(0);
      expect(replay.skippedCommits).toEqual([second]);
      expect(
        run(["rev-parse", "--verify", "CHERRY_PICK_HEAD"], true).status,
      ).not.toBe(0);
      expect(run(["status", "--porcelain"]).stdout).toBe("");
      expect(run(["rev-list", "--count", `${target}..HEAD`]).stdout).toBe("1");
      expect(readFileSync(join(root, "scenario.ts"), "utf8")).toBe(
        "export const state = 'after';\n",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

  test("treats the managed-namespaces replay commit as bounded-equivalent but rejects an ours-style publication head", () => {
    const root = mkdtempSync(join(tmpdir(), "frozen-candidate-ours-merge-"));
    const run = (args: string[]) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    try {
      run(["init"]);
      run(["config", "user.email", "test@example.com"]);
      run(["config", "user.name", "Test"]);
      mkdirSync(join(root, "features/managed-namespaces/lib"), {
        recursive: true,
      });
      writeFileSync(
        join(
          root,
          "features/managed-namespaces/lib/master-validation-managed-namespaces-live.ts",
        ),
        "export const staleWebhookAssertion = true;\n",
      );
      writeFileSync(join(root, "shared.txt"), "base\n");
      run(["add", "."]);
      run(["commit", "-m", "base"]);
      const base = run(["rev-parse", "HEAD"]);

      run(["checkout", "-b", "candidate/replay", base]);
      writeFileSync(
        join(
          root,
          "features/managed-namespaces/lib/master-validation-managed-namespaces-live.ts",
        ),
        "export const staleWebhookAssertion = false;\n",
      );
      run(["add", "."]);
      run(["commit", "-m", "bounded replay repair"]);
      const focusedReplay = run(["rev-parse", "HEAD"]);

      run(["checkout", "-B", "main", base]);
      writeFileSync(
        join(
          root,
          "features/managed-namespaces/lib/master-validation-managed-namespaces-live.ts",
        ),
        "export const staleWebhookAssertion = false;\n",
      );
      for (let index = 0; index < 30; index += 1) {
        const path = join(root, `bulk/file-${index}.txt`);
        mkdirSync(join(root, "bulk"), { recursive: true });
        writeFileSync(path, `main change ${index}\n`);
      }
      run(["add", "."]);
      run(["commit", "-m", "main advances independently"]);
      const currentMain = run(["rev-parse", "HEAD"]);

      run(["checkout", "candidate/replay"]);
      run([
        "merge",
        "-s",
        "ours",
        "main",
        "-m",
        "Merge origin/main into replay branch to resolve PR conflict",
      ]);
      const oursHead = run(["rev-parse", "HEAD"]);

      expect(
        boundedSourceEquivalentToTarget({
          repoDir: root,
          sourceCommit: focusedReplay,
          targetCommit: currentMain,
        }),
      ).toEqual({
        equivalent: true,
        paths: [
          "features/managed-namespaces/lib/master-validation-managed-namespaces-live.ts",
        ],
      });
      expect(
        boundedSourceEquivalentToTarget({
          repoDir: root,
          sourceCommit: oursHead,
          targetCommit: currentMain,
        }).equivalent,
      ).toBe(false);
      expect(
        spawnSync(
          "git",
          ["diff", "--name-only", `${currentMain}..${oursHead}`],
          { cwd: root, encoding: "utf8" },
        )
          .stdout.split(/\r?\n/)
          .filter(Boolean).length,
      ).toBeGreaterThan(10);
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

  test("selects a bounded scenario commit that changes only the feature-owned helper", () => {
    const root = mkdtempSync(join(tmpdir(), "scenario-helper-replay-"));
    const run = (args: string[]) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const adapter =
      "features/bootstrap-profile/tests/bootstrap-profile-byo-acr-lifecycle.test.ts";
    const helper =
      "features/bootstrap-profile/lib/bootstrap-profile-byo-acr-lifecycle.ts";

    try {
      run(["init"]);
      run(["config", "user.email", "test@example.com"]);
      run(["config", "user.name", "Test"]);
      mkdirSync(join(root, "features/bootstrap-profile/tests"), {
        recursive: true,
      });
      mkdirSync(join(root, "features/bootstrap-profile/lib"), {
        recursive: true,
      });
      writeFileSync(join(root, adapter), "test('direct', () => {});\n");
      writeFileSync(join(root, helper), "export const probe = 'before';\n");
      run(["add", "."]);
      run(["commit", "-m", "base"]);
      const baseline = run(["rev-parse", "HEAD"]);
      run(["branch", "-M", "dev"]);
      run(["checkout", "-b", "task/helper-only"]);
      writeFileSync(join(root, helper), "export const probe = 'after';\n");
      run(["add", helper]);
      run(["commit", "-m", "repair feature helper"]);
      const testedSource = run(["rev-parse", "HEAD"]);

      run(["checkout", "dev"]);
      writeFileSync(join(root, "target.txt"), "advanced\n");
      run(["add", "target.txt"]);
      run(["commit", "-m", "advance target"]);
      run(["checkout", "task/helper-only"]);

      const result = replayScenarioNormalizationOntoTarget({
        workspaceDir: root,
        recordedBaseCommit: baseline,
        sourceCommit: testedSource,
        targetRef: "dev",
        anchorPaths: [adapter],
        featureIds: ["bootstrap-profile"],
      });

      if (result.state !== "replayed") throw new Error(JSON.stringify(result));
      expect(result.selectedCommits).toHaveLength(1);
      expect(result.changedPaths).toEqual([helper]);
      expect(result.protectedPathsEquivalent).toBe(true);
      expect(run(["show", `HEAD:${helper}`])).toBe(
        "export const probe = 'after';",
      );
      expect(run(["show", "HEAD:target.txt"])).toBe("advanced");
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

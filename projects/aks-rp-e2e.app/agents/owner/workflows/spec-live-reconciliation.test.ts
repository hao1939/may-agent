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
  askAgent,
  agentConditionProblem,
  checkLiveDispatchAdmission,
  collectTerminalRunEvidence,
  completedPullRequestIntegration,
  decisionCorrectionPrompt,
  directIntegrationAction,
  discoverTaskRuns,
  proofPreservingScenarioIntegration,
  proofProtectedScenarioPaths,
  shouldReplayScenarioBeforeRunReview,
  existingRecoveryProblem,
  integrationMode,
  isNonFastForwardPushFailure,
  liveDispatchTargetRefreshRequired,
  matchingTaskRuns,
  parseTaskPayload,
  pipelineWaitCondition,
  pipelineRunState,
  preparationDecisionProblem,
  preparationHeadProblem,
  priorIntegratedProof,
  reconcileRemoteTaskBranchHistory,
  pullRequestSourceUpdateCondition,
  pullRequestWaitCondition,
  resolveIntegrationTarget,
  resolveLiveExecutionTarget,
  runMatchesPriorVerification,
  scenarioNormalizationReplayBase,
  novelScenarioReplayCommits,
  scenarioNormalizationReplayRequired,
  shouldFastForwardIntegratedSource,
  shouldReviewBeforeInitialLiveDispatch,
  scenarioNormalizationWaitProblem,
  sourceChangeMayAffectSpec,
  taskContextDir,
  taskScopedAgentCondition,
  terminalRunDecisionProblem,
  terminalRunContextDir,
} from "./spec-live-reconciliation.js";
import {
  isRunnableScenarioNormalization,
  scenarioNormalizationSpecIds,
} from "./lib/scenario-normalization-invariant.js";

describe("spec-live-reconciliation workflow", () => {
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

  test("preserves an exact standalone live target across recovery", () => {
    const exact = {
      id: 52,
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
        specId: "spec.rp-cluster-lifecycle.nginx-large-header",
        target: "standalone-rp-ingress",
        standaloneBuildId: "173469496",
        sourceCommit: "repair-commit",
      }),
    ).toBe(true);
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

  test("does not recursively re-enter reconciliation on unchanged evidence", () => {
    const source = readFileSync(
      join(import.meta.dir, "spec-live-reconciliation.ts"),
      "utf8",
    );
    expect(source).not.toContain("return reconcileSpecLive(ctx, options)");
  });

  test("preserves scenario proof only for disjoint domain-path target advances", () => {
    expect(
      proofPreservingScenarioIntegration({
        sourcePaths: [
          "features/net-integration/tests/external-acr.test.ts",
          "model/specs/net-integration/external-acr.json",
        ],
        targetPaths: [
          "features/managementplane-addon/tests/version-upgrade.test.ts",
          "model/specs/managementplane-addon/version-upgrade.json",
        ],
      }),
    ).toBe(true);
    expect(
      proofPreservingScenarioIntegration({
        sourcePaths: ["features/net-integration/tests/external-acr.test.ts"],
        targetPaths: ["features/net-integration/tests/external-acr.test.ts"],
      }),
    ).toBe(false);
    expect(
      proofPreservingScenarioIntegration({
        sourcePaths: [
          "features/net-integration/compact/staging.plan.json",
          "features/net-integration/tests/external-acr.test.ts",
        ],
        targetPaths: [
          "features/net-integration/compact/staging.plan.json",
          "features/net-integration/tests/external-keyvault.test.ts",
        ],
      }),
    ).toBe(true);
    expect(
      proofProtectedScenarioPaths([
        "features/net-integration/compact/staging.plan.json",
        "features/net-integration/tests/external-acr.test.ts",
      ]),
    ).toEqual(["features/net-integration/tests/external-acr.test.ts"]);
    expect(
      proofPreservingScenarioIntegration({
        sourcePaths: ["features/net-integration/tests/external-acr.test.ts"],
        targetPaths: ["runner/queue-ado.ts"],
      }),
    ).toBe(false);
    expect(
      proofPreservingScenarioIntegration({
        sourcePaths: [],
        targetPaths: ["design/scenario-normalization.md"],
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
});

import { describe, expect, test } from "bun:test";
import {
  existsSync,
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
  decisionCorrectionPrompt,
  integrationMode,
  matchingTaskRuns,
  parseTaskPayload,
  pipelineWaitCondition,
  pipelineRunState,
  pullRequestSourceUpdateCondition,
  pullRequestWaitCondition,
  resolveIntegrationTarget,
  resolveLiveExecutionTarget,
  runMatchesPriorVerification,
  scenarioNormalizationWaitProblem,
  terminalRunContextDir,
} from "./spec-live-reconciliation.js";
import {
  isRunnableScenarioNormalization,
  scenarioNormalizationSpecIds,
} from "./lib/scenario-normalization-invariant.js";

describe("spec-live-reconciliation workflow", () => {
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

  test("collects terminal evidence before asking the agent to judge it", () => {
    const root = mkdtempSync(join(tmpdir(), "terminal-evidence-"));
    try {
      const result = collectTerminalRunEvidence(
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
    );

    expect(result?.decision).toBe("accepted-pass");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain(
      "ended before producing a structured judgment",
    );
    expect(prompts[1]).toContain("same bounded task");
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

  test("finds only an exact task-generation, spec, target, and source run", () => {
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
    ).toEqual([exact]);
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
});

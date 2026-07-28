import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  alignCleanRepairWorkspace,
  boundedChangedFileEvidence,
  boundedEvidence,
  changedFilesMayAffectSpec,
  campaignRepairPullRequestDescription,
  currentRecoveryBaselineRunId,
  execute,
  frozenCampaignBaseForFailure,
  hasPreparedRepair,
  inconclusiveWait,
  legacyRecoveryChildren,
  latestPassingRecoveryObservation,
  nestedWorkflowOutput,
  observationAppliesToCurrentMain,
  parseFailureInput,
  passingRecoveryObservation,
  priorProductClassification,
  preserveVerificationAfterNestedReconciliation,
  priorStandaloneVerification,
  productRecoveryCondition,
  requiresStandaloneVerification,
  runFailureInvestigation,
  shouldReconcileTestFix,
  standaloneRecoveryChild,
  standaloneRecoveryChildAction,
  standaloneRecoveryCompletionProblem,
  workspace,
} from "./master-validation-failure.js";

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `git ${args.join(" ")} failed`,
    );
  }
  return result.stdout.trim();
}

describe("master-validation failure workflow", () => {
  test("declares a main-based task worktree", () => {
    expect(workspace).toEqual({ kind: "task", baseBranch: "main" });
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
      const ctx = {
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
        done: (summary: string, output: Record<string, unknown>) => ({
          type: "done",
          summary,
          output,
        }),
      } as never;
      expect(await execute(ctx)).toMatchObject({
        type: "done",
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

  test("aligns a clean failure workspace to the frozen campaign snapshot", () => {
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

      expect(
        alignCleanRepairWorkspace({
          workspaceDir: root,
          targetRef: "origin/main",
          repairBaseCommit: frozenBase,
        }),
      ).toBe(frozenBase);
      expect(git(root, "rev-parse", "HEAD")).toBe(frozenBase);
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
      const ctx = {
        agent: "aks-explorer",
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
        blocked: (summary: string, details: Record<string, unknown>) => ({
          type: "blocked",
          summary,
          details,
        }),
      } as never;

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
          type: "blocked",
          details: {
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
      const ctx = {
        agent: "aks-explorer",
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
        blocked: () => {
          throw new Error("retry with a committed fix must not block");
        },
      } as never;

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
      const ctx = {
        agent: "aks-explorer",
        runAgent: async () => ({ status: "interrupted" }),
        blocked: (summary: string, details: Record<string, unknown>) => ({
          type: "blocked",
          summary,
          details,
        }),
      } as never;
      expect(
        await runFailureInvestigation(ctx, input, {
          workspaceDir: root,
          prompt: "Investigate the failure.",
          headCommit: git(root, "rev-parse", "HEAD"),
        }),
      ).toMatchObject({
        kind: "blocked",
        result: {
          type: "blocked",
          details: {
            evidence: expect.arrayContaining(["session-status:interrupted"]),
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("routes a wrong-target aggregate failure through one exact standalone child", () => {
    const root = mkdtempSync(join(tmpdir(), "master-validation-route-proof-"));
    try {
      mkdirSync(join(root, ".state", "tasks"), { recursive: true });
      writeFileSync(
        join(root, ".state", "tasks", "state.json"),
        JSON.stringify({
          receipts: {
            "domain/prior-standalone-proof": {
              summary:
                "spec.rp-cluster-lifecycle.nginx-large-header passed exact standalone run 120 and merged into main.",
              evidence: [
                "pipeline-run:120",
                "source-commit:proof123",
                "standalone-build-id:110",
              ],
              completedAt: "2026-07-23T18:00:00Z",
            },
          },
        }),
      );
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
      const prior = priorStandaloneVerification(root, failure.specId)!;
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
    } finally {
      rmSync(root, { recursive: true, force: true });
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
    artifactPath: "/tmp/result.json",
    sourceCommit: "abc",
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
        type: "done",
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

  test("finds a later same-spec main pass from durable event history after the original wake", () => {
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
    const ctx = {
      task: `## Trigger Event\n${JSON.stringify({
        type: "project.task.tick",
        reason: "workflow-replay",
      })}`,
      query: {
        events: () => ({
          rows,
          rowCount: rows.length,
          limit: 500,
          truncated: false,
        }),
      },
    } as never;

    expect(latestPassingRecoveryObservation(ctx, input)).toMatchObject({
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
      expect(currentRecoveryBaselineRunId({ appDir }, input)).toBe("456");
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

  test("keeps an integrated nested repair waiting for main-path verification", () => {
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
    const ctx = {
      task: "",
      done: (summary: string, output: Record<string, unknown>) => ({
        type: "done",
        summary,
        output,
      }),
    } as never;
    const result = preserveVerificationAfterNestedReconciliation(ctx, input, {
      type: "done",
      summary: "outer",
      output: {
        state: "converged",
        summary: "PR merged",
        evidence: ["source-commit:repair"],
      },
    });
    expect(result).toMatchObject({
      type: "done",
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

  test("closes a replayed failure when owner review finds applicable current-main recovery", () => {
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
    const ctx = {
      task: "",
      done: (summary: string, output: Record<string, unknown>) => ({
        type: "done",
        summary,
        output,
      }),
    } as never;
    expect(
      preserveVerificationAfterNestedReconciliation(ctx, input, {
        type: "done",
        summary: "outer",
        output: {
          state: "existing-recovery",
          summary: "Later current-main run 124 passed spec.example.",
          evidence: [
            "recovery-pipeline-run:124",
            "source-commit:recovered-main",
          ],
        },
      }),
    ).toMatchObject({
      type: "done",
      output: {
        state: "converged",
        summary: "Later current-main run 124 passed spec.example.",
        evidence: ["recovery-pipeline-run:124", "source-commit:recovered-main"],
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
    const ctx = {
      done: (summary: string, output: Record<string, unknown>) => ({
        type: "done",
        summary,
        output,
      }),
    } as never;
    const result = inconclusiveWait(
      ctx,
      input,
      "The spec.network-cni.azure-overlay failure remains inconclusive: current example replay.",
      Array.from({ length: 40 }, (_, index) => `artifact-evidence-${index}`),
    );
    expect(result).toMatchObject({
      type: "done",
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

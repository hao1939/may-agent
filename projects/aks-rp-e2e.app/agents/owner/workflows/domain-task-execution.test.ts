import { afterAll, describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk/legacy";
import {
  assertIsolatedWriteDispatch,
  execute,
  reconciliationTaskId,
  verify,
} from "./domain-task-execution.js";

const contextRoot = mkdtempSync(join(tmpdir(), "domain-task-context-"));
const contextProjectDir = join(contextRoot, "project");
const contextWorkspaceDir = join(contextRoot, "workspace");
mkdirSync(contextProjectDir);
mkdirSync(contextWorkspaceDir);

afterAll(() => {
  rmSync(contextRoot, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function repositoryFixture(): {
  root: string;
  repoDir: string;
  workspaceDir: string;
} {
  const root = mkdtempSync(join(tmpdir(), "domain-task-execution-"));
  const remote = join(root, "remote.git");
  const repoDir = join(root, "repo");
  const workspaceDir = join(root, "task");
  git(root, "init", "--bare", remote);
  git(root, "init", "-b", "dev", repoDir);
  git(repoDir, "config", "user.name", "test");
  git(repoDir, "config", "user.email", "test@example.com");
  mkdirSync(join(repoDir, "runner"), { recursive: true });
  mkdirSync(join(repoDir, "scripts"), { recursive: true });
  for (const path of [
    "runner/check-runtime-data-policy.ts",
    "runner/check-private-source-policy.ts",
    "runner/schema-check.ts",
    "scripts/check-scenario-tests.ts",
  ]) {
    writeFileSync(
      join(repoDir, path),
      "// Passing repository policy fixture.\n",
    );
  }
  for (const path of [
    "runner/live-admission-classifier.test.ts",
    "runner/check-live-admission.test.ts",
  ]) {
    writeFileSync(
      join(repoDir, path),
      'import { test } from "bun:test";\ntest("policy fixture", () => {});\n',
    );
  }
  writeFileSync(join(repoDir, "base.txt"), "base\n");
  git(repoDir, "add", ".");
  git(repoDir, "commit", "-m", "base");
  git(repoDir, "remote", "add", "origin", remote);
  git(repoDir, "push", "-u", "origin", "dev");
  git(repoDir, "worktree", "add", "-b", "task/example", workspaceDir, "dev");
  git(workspaceDir, "config", "user.name", "test");
  git(workspaceDir, "config", "user.email", "test@example.com");
  writeFileSync(join(workspaceDir, "change.txt"), "change\n");
  git(workspaceDir, "add", "change.txt");
  git(workspaceDir, "commit", "-m", "change");
  return { root, repoDir, workspaceDir };
}

function replayFixtureSource(
  fixture: ReturnType<typeof repositoryFixture>,
  options: { push?: boolean; mismatchedPatch?: boolean } = {},
): { sourceCommit: string; replayCommit: string } {
  const sourceCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
  writeFileSync(join(fixture.repoDir, "dev-advance.txt"), "advance\n");
  git(fixture.repoDir, "add", "dev-advance.txt");
  git(fixture.repoDir, "commit", "-m", "advance dev");
  if (options.mismatchedPatch) {
    writeFileSync(join(fixture.repoDir, "different.txt"), "different\n");
    git(fixture.repoDir, "add", "different.txt");
    git(fixture.repoDir, "commit", "-m", "different integration patch");
  } else {
    git(fixture.repoDir, "cherry-pick", sourceCommit);
  }
  const replayCommit = git(fixture.repoDir, "rev-parse", "HEAD");
  if (options.push !== false) git(fixture.repoDir, "push", "origin", "dev");
  return { sourceCommit, replayCommit };
}

function provenanceResult(input: {
  fixture: ReturnType<typeof repositoryFixture>;
  ownedCommits: string[];
  acceptedCommit: string;
  integratedCommit?: string;
  provenance?: string;
}) {
  return {
    state: "converged" as const,
    summary: "integration replay is ready",
    evidence: [
      `task-worktree:${input.fixture.workspaceDir}`,
      `task-source-commits:${input.ownedCommits.join(",")}`,
      `source-commit:${input.acceptedCommit}`,
      ...(input.provenance
        ? [`integration-provenance:${input.provenance}`]
        : []),
      `integrated-commit:${input.integratedCommit ?? input.acceptedCommit}`,
    ],
    actions: [],
  };
}

function context(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    task: "bounded task",
    agent: "aks-explorer",
    projectDir: contextProjectDir,
    workspaceDir: contextWorkspaceDir,
    runAgent: (async () => ({
      status: "done",
      sessionId: "session-1",
      lastAssistantText: "done",
      messages: [],
      duration: "1s",
      outputDir: "/tmp",
      finishResult: { status: "success", summary: "done" },
      structuredResult: {
        state: "converged",
        summary: "done",
        evidence: ["commit:abc"],
        actions: [],
      },
    })) as WorkflowContext["runAgent"],
    done: (summary, output) => ({ type: "done", summary, output }),
    blocked: (reason, details) => ({
      type: "blocked",
      reason,
      context: details,
    }),
    ...overrides,
  } as WorkflowContext;
}

describe("domain task execution", () => {
  it("reads the current task id from the reconciliation payload", () => {
    expect(
      reconciliationTaskId(
        'prefix\n## Reconciliation Task\n```json\n{"taskId":"domain/example","input":{}}\n```',
      ),
    ).toBe("domain/example");
  });

  it("guards canonical and symlink-equivalent project paths while accepting an isolated workspace", () => {
    const root = mkdtempSync(join(tmpdir(), "write-dispatch-guard-"));
    const projectDir = join(root, "project");
    const workspaceDir = join(root, "workspace");
    const projectAlias = join(root, "project-alias");
    mkdirSync(projectDir);
    mkdirSync(workspaceDir);
    symlinkSync(projectDir, projectAlias);
    try {
      expect(() =>
        assertIsolatedWriteDispatch({
          workspaceDir: projectDir,
          projectDir,
          cwd: projectDir,
        }),
      ).toThrow("refused canonical workspace");
      expect(() =>
        assertIsolatedWriteDispatch({
          workspaceDir: projectAlias,
          projectDir,
          cwd: projectAlias,
        }),
      ).toThrow("refused canonical workspace");
      expect(() =>
        assertIsolatedWriteDispatch({
          workspaceDir,
          projectDir,
          cwd: workspaceDir,
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects the canonical project before the initial owner dispatch", async () => {
    let agentCalls = 0;
    const result = await execute(
      context({
        workspaceDir: contextProjectDir,
        runAgent: (async () => {
          agentCalls += 1;
          throw new Error("canonical checkout must never reach runAgent");
        }) as WorkflowContext["runAgent"],
      }),
    );

    expect(agentCalls).toBe(0);
    expect(result).toMatchObject({
      type: "blocked",
      reason: expect.stringContaining("prepared task worktree"),
    });
  });

  it("adopts canonical cleanRetainedWorktree plus cleanRetainedHead authority and records observed lineage", async () => {
    const fixture = repositoryFixture();
    const generatedWorkspace = join(fixture.root, "generated-retained");
    let dispatchedPrompt = "";
    try {
      git(
        fixture.repoDir,
        "worktree",
        "add",
        "-b",
        "task/generated-retained",
        generatedWorkspace,
        "dev",
      );
      const retainedHead = git(fixture.workspaceDir, "rev-parse", "HEAD");

      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: generatedWorkspace,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "domain/retained-lineage",
            input: {
              cleanRetainedWorktree: fixture.workspaceDir,
              cleanRetainedHead: retainedHead,
            },
          })}\n\`\`\``,
          runAgent: (async (_agent: string, prompt: string) => {
            dispatchedPrompt = prompt;
            return {
              status: "done",
              sessionId: "session-retained-lineage",
              lastAssistantText: "waiting",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "waiting" },
              structuredResult: {
                state: "waiting",
                summary: "retained lineage accepted for bounded continuation",
                evidence: ["owner-disposition:waiting"],
                actions: [],
                conditions: [
                  {
                    id: "pipeline-run-retained-lineage-completed",
                    type: "pipeline-run.state",
                    subject: "pipeline-run:retained-lineage",
                    expected: { field: "state", equals: "completed" },
                  },
                ],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(dispatchedPrompt).toContain(
        `Your task-owned Git worktree is ${fixture.workspaceDir}`,
      );
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "waiting",
          evidence: expect.arrayContaining([
            `recovery-owner-evidence:clean-retained-worktree:${fixture.workspaceDir}`,
            `recovery-owner-evidence:clean-retained-head:${retainedHead}`,
            "recovery-owner-evidence:clean-retained-status:clean",
            "recovery-owner-evidence:clean-retained-operation:none",
            "material-success-candidate:none",
          ]),
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects stale same-task clean-retained reuse with expected and observed lineage before dispatch", async () => {
    const fixture = repositoryFixture();
    let agentCalls = 0;
    try {
      const staleHead = git(fixture.workspaceDir, "rev-parse", "HEAD^");
      const observedHead = git(fixture.workspaceDir, "rev-parse", "HEAD");
      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "domain/retained-lineage",
            input: {
              cleanRetainedWorktree: fixture.workspaceDir,
              cleanRetainedHead: staleHead,
            },
          })}\n\`\`\``,
          runAgent: (async () => {
            agentCalls += 1;
            throw new Error("stale retained lineage must not reach the owner");
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(agentCalls).toBe(0);
      expect(result).toMatchObject({
        type: "blocked",
        reason: expect.stringContaining("lineage validation failed"),
        context: {
          taskId: "domain/retained-lineage",
          expectedWorkspace: fixture.workspaceDir,
          observedWorkspace: fixture.workspaceDir,
          expectedHead: staleHead,
          observedHead,
          observedStatus: "clean",
          observedOperation: null,
          disposition: "rejected-before-agent-dispatch",
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects a preserved active-rebase workspace mismatch before agent dispatch", async () => {
    const fixture = repositoryFixture();
    const generatedWorkspace = join(fixture.root, "generated");
    let agentCalls = 0;
    try {
      writeFileSync(join(fixture.workspaceDir, "base.txt"), "task change\n");
      git(fixture.workspaceDir, "add", "base.txt");
      git(fixture.workspaceDir, "commit", "-m", "task-side conflict");
      writeFileSync(join(fixture.repoDir, "base.txt"), "dev change\n");
      git(fixture.repoDir, "add", "base.txt");
      git(fixture.repoDir, "commit", "-m", "dev-side conflict");
      expect(
        spawnSync("git", ["rebase", "dev"], {
          cwd: fixture.workspaceDir,
          encoding: "utf8",
        }).status,
      ).not.toBe(0);
      expect(
        existsSync(
          git(fixture.workspaceDir, "rev-parse", "--git-path", "rebase-merge"),
        ),
      ).toBe(true);
      git(
        fixture.repoDir,
        "worktree",
        "add",
        "-b",
        "task/generated",
        generatedWorkspace,
        "dev",
      );

      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: generatedWorkspace,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "domain/queuewatcher-integration",
            input: {
              workspaceDir: fixture.workspaceDir,
              recoveryState: "active-rebase",
            },
          })}\n\`\`\``,
          runAgent: (async () => {
            agentCalls += 1;
            throw new Error("agent must not run with contradictory workspaces");
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(agentCalls).toBe(0);
      expect(result).toMatchObject({
        type: "blocked",
        reason: expect.stringContaining("differs from the prepared"),
        context: {
          taskId: "domain/queuewatcher-integration",
          suppliedWorkspaceDir: generatedWorkspace,
          requestedWorkspaceDir: fixture.workspaceDir,
          disposition: expect.stringContaining(
            "rejected-before-agent-dispatch",
          ),
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("adopts an explicitly declared dirty merge worktree before agent dispatch without mutating it", async () => {
    const fixture = repositoryFixture();
    const generatedWorkspace = join(fixture.root, "generated");
    let dispatchedWorkspace = "";
    try {
      writeFileSync(join(fixture.workspaceDir, "base.txt"), "task change\n");
      git(fixture.workspaceDir, "add", "base.txt");
      git(fixture.workspaceDir, "commit", "-m", "task-side conflict");
      writeFileSync(join(fixture.repoDir, "base.txt"), "dev change\n");
      git(fixture.repoDir, "add", "base.txt");
      git(fixture.repoDir, "commit", "-m", "dev-side conflict");
      expect(
        spawnSync("git", ["merge", "dev"], {
          cwd: fixture.workspaceDir,
          encoding: "utf8",
        }).status,
      ).not.toBe(0);
      git(
        fixture.repoDir,
        "worktree",
        "add",
        "-b",
        "task/generated-adoption",
        generatedWorkspace,
        "dev",
      );

      const branchBefore = git(
        fixture.workspaceDir,
        "symbolic-ref",
        "--quiet",
        "--short",
        "HEAD",
      );
      const headBefore = git(fixture.workspaceDir, "rev-parse", "HEAD");
      const mergeHeadBefore = git(
        fixture.workspaceDir,
        "rev-parse",
        "MERGE_HEAD",
      );
      const statusBefore = git(
        fixture.workspaceDir,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      );

      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: generatedWorkspace,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "domain/adopt-preserved-merge",
            input: {
              preservedWorkspaceAdoption: {
                workspaceDir: fixture.workspaceDir,
                expectedBranch: branchBefore,
                expectedHead: headBefore,
                expectedDirty: true,
                expectedOperation: "merge",
              },
            },
          })}\n\`\`\``,
          runAgent: (async (_agent: string, prompt: string) => {
            dispatchedWorkspace = prompt;
            return {
              status: "done",
              sessionId: "session-adoption",
              lastAssistantText: "waiting",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "waiting" },
              structuredResult: {
                state: "waiting",
                summary: "preserved merge remains ready for bounded recovery",
                evidence: ["preserved-operation:merge"],
                actions: [],
                conditions: [
                  {
                    id: "pipeline-run-adoption-fixture-completed",
                    type: "pipeline-run.state",
                    subject: "pipeline-run:adoption-fixture",
                    expected: { field: "state", equals: "completed" },
                  },
                ],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(dispatchedWorkspace).toContain(
        `Your task-owned Git worktree is ${fixture.workspaceDir}`,
      );
      expect(dispatchedWorkspace).not.toContain(
        `Your task-owned Git worktree is ${generatedWorkspace}`,
      );
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining(
            "preserved merge remains ready for bounded recovery",
          ),
          evidence: expect.arrayContaining([
            "recovery-owner-evidence:preserved-operation:merge",
            "material-success-candidate:none",
          ]),
        },
      });
      expect(
        git(fixture.workspaceDir, "symbolic-ref", "--quiet", "--short", "HEAD"),
      ).toBe(branchBefore);
      expect(git(fixture.workspaceDir, "rev-parse", "HEAD")).toBe(headBefore);
      expect(git(fixture.workspaceDir, "rev-parse", "MERGE_HEAD")).toBe(
        mergeHeadBefore,
      );
      expect(
        git(
          fixture.workspaceDir,
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ),
      ).toBe(statusBefore);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("adopts an explicitly declared clean operation-free worktree before dispatch without mutating it", async () => {
    const fixture = repositoryFixture();
    const generatedWorkspace = join(fixture.root, "generated-clean");
    let dispatchedPrompt = "";
    try {
      git(
        fixture.repoDir,
        "worktree",
        "add",
        "-b",
        "task/generated-clean-adoption",
        generatedWorkspace,
        "dev",
      );
      const branchBefore = git(
        fixture.workspaceDir,
        "symbolic-ref",
        "--quiet",
        "--short",
        "HEAD",
      );
      const headBefore = git(fixture.workspaceDir, "rev-parse", "HEAD");
      const statusBefore = git(
        fixture.workspaceDir,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      );

      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: generatedWorkspace,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "domain/adopt-preserved-clean",
            input: {
              preservedWorkspaceAdoption: {
                workspaceDir: fixture.workspaceDir,
                expectedBranch: branchBefore,
                expectedHead: headBefore,
                expectedDirty: false,
                expectedOperation: "none",
              },
            },
          })}\n\`\`\``,
          runAgent: (async (_agent: string, prompt: string) => {
            dispatchedPrompt = prompt;
            return {
              status: "done",
              sessionId: "session-clean-adoption",
              lastAssistantText: "waiting",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "waiting" },
              structuredResult: {
                state: "waiting",
                summary: "clean preserved workspace dispatched",
                evidence: ["preserved-operation:none"],
                actions: [],
                conditions: [
                  {
                    id: "pipeline-run-clean-adoption-fixture-completed",
                    type: "pipeline-run.state",
                    subject: "pipeline-run:clean-adoption-fixture",
                    expected: { field: "state", equals: "completed" },
                  },
                ],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(dispatchedPrompt).toContain(
        `Your task-owned Git worktree is ${fixture.workspaceDir}`,
      );
      expect(dispatchedPrompt).not.toContain(
        `Your task-owned Git worktree is ${generatedWorkspace}`,
      );
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining(
            "clean preserved workspace dispatched",
          ),
          evidence: expect.arrayContaining([
            "recovery-owner-evidence:preserved-operation:none",
            "material-success-candidate:none",
          ]),
        },
      });
      expect(
        git(fixture.workspaceDir, "symbolic-ref", "--quiet", "--short", "HEAD"),
      ).toBe(branchBefore);
      expect(git(fixture.workspaceDir, "rev-parse", "HEAD")).toBe(headBefore);
      expect(
        git(
          fixture.workspaceDir,
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ),
      ).toBe(statusBefore);
      expect(statusBefore).toBe("");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects dirty, operation, and noncanonical workspace declaration mismatches before dispatch", async () => {
    const fixture = repositoryFixture();
    const generatedWorkspace = join(fixture.root, "generated-mismatch");
    const workspaceAlias = join(fixture.root, "workspace-alias");
    let agentCalls = 0;
    try {
      git(
        fixture.repoDir,
        "worktree",
        "add",
        "-b",
        "task/generated-mismatch",
        generatedWorkspace,
        "dev",
      );
      symlinkSync(fixture.workspaceDir, workspaceAlias);
      const expectedBranch = git(
        fixture.workspaceDir,
        "symbolic-ref",
        "--quiet",
        "--short",
        "HEAD",
      );
      const expectedHead = git(fixture.workspaceDir, "rev-parse", "HEAD");
      const run = (adoption: Record<string, unknown>) =>
        execute(
          context({
            projectDir: fixture.repoDir,
            workspaceDir: generatedWorkspace,
            task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
              taskId: "domain/reject-preserved-mismatch",
              input: { preservedWorkspaceAdoption: adoption },
            })}\n\`\`\``,
            runAgent: (async () => {
              agentCalls += 1;
              throw new Error("agent must not run after adoption mismatch");
            }) as WorkflowContext["runAgent"],
          }),
        );

      const dirtyMismatch = await run({
        workspaceDir: fixture.workspaceDir,
        expectedBranch,
        expectedHead,
        expectedDirty: true,
      });
      const operationMismatch = await run({
        workspaceDir: fixture.workspaceDir,
        expectedBranch,
        expectedHead,
        expectedOperation: "merge",
      });
      const workspaceMismatch = await run({
        workspaceDir: workspaceAlias,
        expectedBranch,
        expectedHead,
        expectedDirty: false,
        expectedOperation: "none",
      });

      expect(agentCalls).toBe(0);
      expect(dirtyMismatch).toMatchObject({
        type: "blocked",
        reason: expect.stringContaining("validation failed"),
        context: { expectedDirty: true, observedDirty: false },
      });
      expect(operationMismatch).toMatchObject({
        type: "blocked",
        reason: expect.stringContaining("validation failed"),
        context: { expectedOperation: "merge", observedOperation: null },
      });
      expect(workspaceMismatch).toMatchObject({
        type: "blocked",
        reason: expect.stringContaining("validation failed"),
        context: {
          declaredWorkspaceDir: workspaceAlias,
          realWorkspaceDir: fixture.workspaceDir,
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("runs the owner capability in the supplied worktree and returns its typed result", async () => {
    const fixture = repositoryFixture();
    let prompt = "";
    try {
      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async (_agent: string, task: string) => {
            prompt = task;
            writeFileSync(
              join(fixture.workspaceDir, "turn-change.txt"),
              "turn\n",
            );
            git(fixture.workspaceDir, "add", "turn-change.txt");
            git(fixture.workspaceDir, "commit", "-m", "bounded turn change");
            return {
              status: "done",
              sessionId: "session-1",
              lastAssistantText: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              structuredResult: {
                state: "converged",
                summary: "done",
                evidence: ["commit:abc"],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(prompt).toContain(fixture.workspaceDir);
      expect(prompt).toContain("Do not create another branch or worktree");
      expect(prompt).toContain("subject project:aks-rp-e2e");
      expect(prompt).toContain('specId: "<spec id>"');
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "converged",
          summary: expect.stringContaining("directly into dev"),
          evidence: expect.arrayContaining([
            `task-worktree:${fixture.workspaceDir}`,
            "task-branch:task/example",
            "task-status:clean",
            "task-changed-files:turn-change.txt",
          ]),
        },
      });
      expect(
        git(
          fixture.repoDir,
          "merge-base",
          "--is-ancestor",
          "task/example",
          "origin/dev",
        ),
      ).toBe("");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects accepted source that exists only in a sibling worktree", async () => {
    const fixture = repositoryFixture();
    try {
      writeFileSync(join(fixture.repoDir, "sibling-only.txt"), "sibling\n");
      git(fixture.repoDir, "add", "sibling-only.txt");
      git(fixture.repoDir, "commit", "-m", "sibling-only accepted source");
      const acceptedCommit = git(fixture.repoDir, "rev-parse", "HEAD");

      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "domain/wrong-worktree-proof",
            input: { acceptedCommit },
          })}\n\`\`\``,
        }),
      );

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          summary: expect.stringContaining(
            "not reachable from final task HEAD",
          ),
          evidence: expect.arrayContaining([
            `task-worktree:${fixture.workspaceDir}`,
            "task-branch:task/example",
            "task-status:clean",
            `unreachable-accepted-source-commit:${acceptedCommit}`,
          ]),
        },
      });
      expect(git(fixture.workspaceDir, "rev-parse", "HEAD")).not.toBe(
        acceptedCommit,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("replays a named accepted pre-existing commit instead of converging unchanged", async () => {
    const fixture = repositoryFixture();
    const acceptedCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
    let agentCalls = 0;
    try {
      writeFileSync(join(fixture.repoDir, "dev-after-acceptance.txt"), "dev\n");
      git(fixture.repoDir, "add", "dev-after-acceptance.txt");
      git(fixture.repoDir, "commit", "-m", "advance dev after acceptance");
      git(fixture.repoDir, "push", "origin", "dev");
      const replayBase = git(fixture.repoDir, "rev-parse", "origin/dev");

      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "domain/replay-accepted-source",
            input: {
              acceptedCommit,
              replayRequirement:
                "Replay the accepted commit onto freshly fetched origin/dev.",
            },
          })}\n\`\`\``,
          runAgent: (async (_agent: string, prompt: string) => {
            agentCalls += 1;
            if (agentCalls === 2) {
              expect(prompt).toContain(
                `retained source ${acceptedCommit} cannot be isolated`,
              );
              expect(prompt).toContain(`origin/dev@${replayBase}`);
              git(fixture.workspaceDir, "reset", "--hard", "origin/dev");
              git(fixture.workspaceDir, "cherry-pick", acceptedCommit);
            }
            return {
              status: "done",
              sessionId: `session-${agentCalls}`,
              lastAssistantText: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              structuredResult: {
                state: "converged",
                summary:
                  agentCalls === 1
                    ? "accepted source is ready"
                    : "accepted source replayed",
                evidence: [`agent-call:${agentCalls}`],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(agentCalls).toBe(2);
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "converged",
          summary: expect.stringContaining("directly into dev"),
          evidence: expect.not.arrayContaining([
            "integration:no-task-owned-commit",
          ]),
        },
      });
      git(fixture.repoDir, "fetch", "origin", "dev");
      expect(
        spawnSync(
          "git",
          ["merge-base", "--is-ancestor", replayBase, "origin/dev"],
          { cwd: fixture.repoDir },
        ).status,
      ).toBe(0);
      expect(
        git(
          fixture.repoDir,
          "rev-list",
          "--count",
          `${replayBase}..origin/dev`,
        ),
      ).toBe("1");
      expect(
        spawnSync(
          "git",
          ["merge-base", "--is-ancestor", acceptedCommit, "origin/dev"],
          { cwd: fixture.repoDir },
        ).status,
      ).not.toBe(0);
      expect(git(fixture.repoDir, "show", "origin/dev:change.txt")).toBe(
        "change",
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("retries a transient task-branch push failure before integrating into dev", async () => {
    const fixture = repositoryFixture();
    const marker = join(fixture.root, "first-push-failed");
    const hook = join(fixture.repoDir, ".git", "hooks", "pre-push");
    try {
      writeFileSync(
        hook,
        `#!/bin/sh
if [ ! -f "${marker}" ]; then
  touch "${marker}"
  echo "transient push failure" >&2
  exit 1
fi
exit 0
`,
      );
      chmodSync(hook, 0o755);

      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async () => {
            writeFileSync(
              join(fixture.workspaceDir, "turn-change.txt"),
              "turn\n",
            );
            git(fixture.workspaceDir, "add", "turn-change.txt");
            git(fixture.workspaceDir, "commit", "-m", "bounded turn change");
            return {
              status: "done",
              sessionId: "session-1",
              lastAssistantText: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              structuredResult: {
                state: "converged",
                summary: "done",
                evidence: ["commit:turn-change"],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(existsSync(marker)).toBe(true);
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "converged",
          summary: expect.stringContaining("directly into dev"),
        },
      });
      expect(
        git(
          fixture.repoDir,
          "merge-base",
          "--is-ancestor",
          "task/example",
          "origin/dev",
        ),
      ).toBe("");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("repairs a rejected candidate in the same workflow before publishing it", async () => {
    const fixture = repositoryFixture();
    const prompts: string[] = [];
    try {
      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async (_agent: string, prompt: string) => {
            prompts.push(prompt);
            if (prompts.length === 1) {
              writeFileSync(
                join(fixture.workspaceDir, "task.txt"),
                "task change\n",
              );
              writeFileSync(
                join(fixture.workspaceDir, "runner", "schema-check.ts"),
                "process.exit(1);\n",
              );
              git(
                fixture.workspaceDir,
                "add",
                "task.txt",
                "runner/schema-check.ts",
              );
              git(
                fixture.workspaceDir,
                "commit",
                "-m",
                "candidate with failed policy",
              );
            } else {
              writeFileSync(
                join(fixture.workspaceDir, "runner", "schema-check.ts"),
                "// Repaired repository policy fixture.\n",
              );
              git(fixture.workspaceDir, "add", "runner/schema-check.ts");
              git(
                fixture.workspaceDir,
                "commit",
                "-m",
                "repair rejected candidate",
              );
            }
            return {
              status: "done",
              sessionId: `session-${prompts.length}`,
              lastAssistantText: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              structuredResult: {
                state: "converged",
                summary: "done",
                evidence: [],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toContain("repository validation rejected it");
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "converged",
          summary: expect.stringContaining("directly into dev"),
        },
      });
      expect(git(fixture.repoDir, "show", "origin/dev:task.txt")).toBe(
        "task change",
      );
      expect(
        git(fixture.repoDir, "show", "origin/dev:runner/schema-check.ts"),
      ).toContain("Repaired repository policy fixture");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("keeps a scenario-normalization task in the same workflow until the plain carrier is gone", async () => {
    const fixture = repositoryFixture();
    const scenarioTestPath = "features/feature-a/tests/case-a.ts";
    const prompts: string[] = [];
    try {
      mkdirSync(join(fixture.workspaceDir, "scripts"), { recursive: true });
      mkdirSync(join(fixture.workspaceDir, "features", "feature-a", "tests"), {
        recursive: true,
      });
      writeFileSync(
        join(fixture.workspaceDir, "scripts", "check-scenario-tests.ts"),
        [
          'import { existsSync } from "node:fs";',
          `const path = ${JSON.stringify(scenarioTestPath)};`,
          "const present = existsSync(path);",
          "console.log(JSON.stringify({ guard: {",
          "  remainingSpecReferencedPlainScenarioUnits: present ? [{ scenarioTestPath: path }] : [],",
          "  remainingRepoPlainScenarioFiles: present ? [path] : [],",
          "} }));",
          "process.exit(present ? 1 : 0);",
        ].join("\n"),
      );
      writeFileSync(
        join(fixture.workspaceDir, scenarioTestPath),
        "// plain carrier\n",
      );
      git(fixture.workspaceDir, "add", "scripts", "features");
      git(fixture.workspaceDir, "commit", "-m", "add normalization fixture");
      git(fixture.workspaceDir, "push", "origin", "HEAD:dev");

      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "domain/normalize-case-a",
            input: {
              loopId: "scenario-normalization",
              scenarioTestPath,
            },
          })}\n\`\`\``,
          runAgent: (async (_agent: string, prompt: string) => {
            prompts.push(prompt);
            return {
              status: "done",
              sessionId: "session-1",
              lastAssistantText: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              structuredResult: {
                state: "converged",
                summary: "wrapper added",
                evidence: [],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
          runAgentSession: (async (_agent: string, prompt: string) => {
            prompts.push(prompt);
            rmSync(join(fixture.workspaceDir, scenarioTestPath));
            git(fixture.workspaceDir, "add", "-A");
            git(fixture.workspaceDir, "commit", "-m", "remove plain carrier");
            return {
              status: "done",
              sessionId: "session-1",
              lastAssistantText: "normalized",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "normalized" },
              structuredResult: {
                state: "converged",
                summary: "plain carrier removed",
                evidence: ["strict-inventory:clean-for-case-a"],
                actions: [],
              },
            };
          }) as NonNullable<WorkflowContext["runAgentSession"]>,
        }),
      );

      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toContain(
        `strict inventory still lists ${scenarioTestPath}`,
      );
      expect(prompts[1]).toContain("progress, not completion");
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "converged",
          summary: expect.stringContaining("directly into dev"),
        },
      });
      expect(
        git(fixture.repoDir, "ls-tree", "-r", "--name-only", "origin/dev"),
      ).not.toContain(scenarioTestPath);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("asks the agent to correct an action targeting its own running task", async () => {
    const prompts: string[] = [];
    const result = await execute(
      context({
        task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
          taskId: "domain/example",
          input: {},
        })}\n\`\`\``,
        runAgent: (async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "done",
            sessionId: "session-1",
            lastAssistantText: "waiting",
            messages: [],
            duration: "1s",
            outputDir: "/tmp",
            finishResult: { status: "success", summary: "waiting" },
            structuredResult: {
              state: "waiting",
              summary: "waiting",
              evidence: ["pipeline:1"],
              actions: [
                {
                  kind: "update-task",
                  taskId: "domain/example",
                  expectedGeneration: 1,
                  priority: "P1",
                },
              ],
              conditions: [],
            },
          };
        }) as WorkflowContext["runAgent"],
        runAgentSession: (async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "done",
            sessionId: "session-1",
            lastAssistantText: "corrected",
            messages: [],
            duration: "1s",
            outputDir: "/tmp",
            finishResult: { status: "success", summary: "corrected" },
            structuredResult: {
              state: "waiting",
              summary: "waiting",
              evidence: ["pipeline:1"],
              actions: [],
              conditions: [
                {
                  id: "pipeline-run:1-completed",
                  type: "pipeline-run.state",
                  subject: "pipeline-run:1",
                  expected: { field: "state", equals: "completed" },
                },
              ],
            },
          };
        }) as NonNullable<WorkflowContext["runAgentSession"]>,
      }),
    );

    expect(prompts[0]).toContain("currently running task is domain/example");
    expect(prompts[1]).toContain("actions 0 target the currently running task");
    expect(result).toMatchObject({
      type: "done",
      output: { state: "waiting", actions: [] },
    });
  });

  it("preserves an exact queued pipeline wait on the same task instead of leaving a stranded waiting result", async () => {
    const result = await execute(
      context({
        task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
          taskId:
            "domain/reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8ce69cb-20260801",
          input: {
            queuedPipelineRunId: "174756648",
            queuedSourceBranch:
              "refs/heads/task/domain-reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8-0bbf416f08",
            queuedSourceCommit: "cab25239d9c5d1994bcc303cd831b69773d42e70",
          },
          children: { live: [], completed: [] },
        })}\n\`\`\``,
        runAgent: (async () => ({
          status: "done",
          sessionId: "session-1",
          lastAssistantText: "waiting",
          messages: [],
          duration: "1s",
          outputDir: "/tmp",
          finishResult: { status: "success", summary: "waiting" },
          structuredResult: {
            state: "waiting",
            summary:
              "The source repair is committed and locally verified, but the changed commit still needs one exact staging live verification pass before this reconciliation can integrate.",
            evidence: [
              "source-branch:task/domain-reconcile-image-integrity-contract-unpaired-adapter-origin-dev-c8-0bbf416f08",
              "source-commit:cab25239d9c5d1994bcc303cd831b69773d42e70",
            ],
            actions: [],
            conditions: [],
          },
        })) as WorkflowContext["runAgent"],
        runAgentSession: (async () => {
          throw new Error(
            "exact queued pipeline wait should be recovered without a correction session",
          );
        }) as NonNullable<WorkflowContext["runAgentSession"]>,
      }),
    );

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "waiting",
        actions: [],
        conditions: [
          {
            id: "pipeline-run-174756648-completed",
            type: "pipeline-run.state",
            subject: "pipeline-run:174756648",
            expected: { field: "state", anyOf: ["completed"] },
          },
        ],
        summary: expect.stringContaining("Recovery-only non-converged result"),
        evidence: expect.arrayContaining([
          "recovery-owner-evidence:pipeline-wait-recovered:174756648",
          "material-success-candidate:none",
        ]),
      },
    });
  });

  it("asks the agent to convert a repo-ref follow-through wait into direct child coverage", async () => {
    const prompts: string[] = [];
    const result = await execute(
      context({
        task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
          taskId: "compact/compact-feature-serverless",
          input: {},
        })}\n\`\`\``,
        runAgent: (async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "done",
            sessionId: "session-1",
            lastAssistantText: "waiting",
            messages: [],
            duration: "1s",
            outputDir: "/tmp",
            finishResult: { status: "success", summary: "waiting" },
            structuredResult: {
              state: "waiting",
              summary:
                "preserve one new exact wait keyed to origin/dev@a954836b",
              evidence: ["serverless frontier unchanged"],
              actions: [
                {
                  kind: "create-task",
                  id: "wait-compact-serverless-package-partial-origin-dev-advance-a954836b-20260724",
                  parentId: "project",
                  outcome:
                    "Refresh the serverless repo-ref wait after origin/dev advances again.",
                  mode: "achieve",
                  priority: "P2",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  acceptance: [
                    "Recheck the same frontier after the next origin/dev advance.",
                  ],
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "a954836be05afcbc95c0845c1ed49857526d0460",
                  },
                },
              ],
              conditions: [],
            },
          };
        }) as WorkflowContext["runAgent"],
        runAgentSession: (async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "done",
            sessionId: "session-1",
            lastAssistantText: "corrected",
            messages: [],
            duration: "1s",
            outputDir: "/tmp",
            finishResult: { status: "success", summary: "corrected" },
            structuredResult: {
              state: "waiting",
              summary:
                "preserve one new exact wait keyed to origin/dev@a954836b",
              evidence: ["serverless frontier unchanged"],
              actions: [
                {
                  kind: "create-task",
                  id: "wait-compact-serverless-package-partial-origin-dev-advance-a954836b-20260724",
                  parentId: "compact/compact-feature-serverless",
                  outcome:
                    "Refresh the serverless repo-ref wait after origin/dev advances again.",
                  mode: "achieve",
                  priority: "P2",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  acceptance: [
                    "Recheck the same frontier after the next origin/dev advance.",
                  ],
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "a954836be05afcbc95c0845c1ed49857526d0460",
                  },
                },
              ],
              conditions: [],
            },
          };
        }) as NonNullable<WorkflowContext["runAgentSession"]>,
      }),
    );

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain(
      "requires one exact Condition or a direct child task created with parentId compact/compact-feature-serverless",
    );
    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "waiting",
        actions: [
          {
            kind: "create-task",
            parentId: "compact/compact-feature-serverless",
          },
        ],
      },
    });
  });

  it("asks the agent to correct a converged parent that creates live child work", async () => {
    const prompts: string[] = [];
    const childAction = {
      kind: "create-task" as const,
      id: "domain/repair-daily-master-suite-count",
      parentId: "domain/normalize-rapid-carrier",
      outcome: "Repair the remaining daily-master suite count mismatch.",
      mode: "achieve" as const,
      priority: "P1" as const,
      owner: "aks-explorer",
      workflow: "domain-task-execution",
      acceptance: ["The suite count matches the current source."],
      input: {},
    };
    const result = await execute(
      context({
        task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
          taskId: "domain/normalize-rapid-carrier",
          input: {},
        })}\n\`\`\``,
        runAgent: (async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "done",
            sessionId: "session-1",
            lastAssistantText: "converged with follow-up",
            messages: [],
            duration: "1s",
            outputDir: "/tmp",
            finishResult: { status: "success", summary: "done" },
            structuredResult: {
              state: "converged",
              summary:
                "carrier normalized; repair the related suite count next",
              evidence: ["strict inventory row removed"],
              actions: [childAction],
            },
          };
        }) as WorkflowContext["runAgent"],
        runAgentSession: (async (_agent: string, prompt: string) => {
          prompts.push(prompt);
          return {
            status: "done",
            sessionId: "session-1",
            lastAssistantText: "waiting on child",
            messages: [],
            duration: "1s",
            outputDir: "/tmp",
            finishResult: { status: "success", summary: "corrected" },
            structuredResult: {
              state: "waiting",
              summary:
                "carrier normalized; child now carries the remaining suite repair",
              evidence: ["strict inventory row removed"],
              actions: [childAction],
              conditions: [],
            },
          };
        }) as NonNullable<WorkflowContext["runAgentSession"]>,
      }),
    );

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain(
      "cannot be applied while it has or creates a live direct child",
    );
    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "waiting",
        actions: [
          {
            kind: "create-task",
            parentId: "domain/normalize-rapid-carrier",
          },
        ],
      },
    });
  });

  it("accepts a waiting result when the reconciliation payload already has a live direct child", async () => {
    const result = await execute(
      context({
        task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
          taskId: "compact/compact-feature-serverless",
          children: {
            live: [
              "wait-compact-serverless-package-partial-origin-dev-advance-a954836b-20260724",
            ],
            completed: [],
          },
          input: {},
        })}\n\`\`\``,
        runAgent: (async () => ({
          status: "done",
          sessionId: "session-1",
          lastAssistantText: "waiting",
          messages: [],
          duration: "1s",
          outputDir: "/tmp",
          finishResult: { status: "success", summary: "waiting" },
          structuredResult: {
            state: "waiting",
            summary:
              "the existing repo-ref wait child still truthfully carries the frontier",
            evidence: ["existing holder already captures the same frontier"],
            actions: [],
            conditions: [],
          },
        })) as WorkflowContext["runAgent"],
      }),
    );

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "waiting",
        summary: expect.stringContaining("Recovery-only non-converged result"),
        evidence: expect.arrayContaining([
          "recovery-owner-evidence:existing holder already captures the same frontier",
          "material-success-candidate:none",
        ]),
        actions: [],
        conditions: [],
      },
    });
  });

  it("rejects merge-only ancestry as material success", async () => {
    const fixture = repositoryFixture();
    try {
      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async () => {
            writeFileSync(join(fixture.repoDir, "dev-only.txt"), "dev\n");
            git(fixture.repoDir, "add", "dev-only.txt");
            git(fixture.repoDir, "commit", "-m", "advance dev only");
            git(fixture.workspaceDir, "merge", "dev", "--no-edit");
            return {
              status: "done",
              sessionId: "session-merge-only",
              lastAssistantText: "converged",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "converged" },
              structuredResult: {
                state: "converged",
                summary: "merged dev ancestry",
                evidence: ["owner-claim:material-success"],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          summary: expect.stringContaining("merge-only ancestry"),
          evidence: expect.arrayContaining([
            "task-changed-files:dev-only.txt",
            "material-success-candidate:none",
          ]),
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects dirty generated artifacts as material success and preserves recovery evidence", async () => {
    const fixture = repositoryFixture();
    try {
      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async () => {
            writeFileSync(
              join(fixture.workspaceDir, "generated.tmp"),
              "dirty\n",
            );
            return {
              status: "done",
              sessionId: "session-dirty-generated",
              lastAssistantText: "converged",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "converged" },
              structuredResult: {
                state: "converged",
                summary: "generated output is ready",
                evidence: ["owner-claim:material-success"],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          summary: expect.stringContaining(
            "Recovery-only non-converged result",
          ),
          evidence: expect.arrayContaining([
            "recovery-status:dirty",
            "recovery-status-porcelain:?? generated.tmp",
            "material-success-candidate:none",
          ]),
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects zero accepted patches as material success", async () => {
    const fixture = repositoryFixture();
    try {
      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async () => ({
            status: "done",
            sessionId: "session-zero-patches",
            lastAssistantText: "converged",
            messages: [],
            duration: "1s",
            outputDir: "/tmp",
            finishResult: { status: "success", summary: "converged" },
            structuredResult: {
              state: "converged",
              summary: "no patch was necessary",
              evidence: ["owner-claim:material-success"],
              actions: [],
            },
          })) as WorkflowContext["runAgent"],
        }),
      );

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          summary: "Final task branch contains zero accepted source patches",
          evidence: expect.arrayContaining([
            "task-source-commits:none",
            "task-changed-files:none",
            "material-success-candidate:none",
          ]),
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("accepts a valid integrated clean task-owned commit in verify()", async () => {
    const fixture = repositoryFixture();
    try {
      const sourceCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      git(fixture.workspaceDir, "push", "origin", "HEAD:dev");

      const verification = await verify(
        {
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          taskId: "domain/verify-integrated-source",
          generation: 1,
          intent: { input: {} },
        } as any,
        {
          state: "converged",
          summary: "clean task-owned source integrated",
          evidence: [
            `task-worktree:${fixture.workspaceDir}`,
            `task-source-commits:${sourceCommit}`,
            `source-commit:${sourceCommit}`,
            `integrated-commit:${sourceCommit}`,
          ],
          actions: [],
        },
      );

      expect(verification).toMatchObject({
        accepted: true,
        summary: expect.stringContaining(
          `Accepted clean task-owned source ${sourceCommit}`,
        ),
        evidence: expect.arrayContaining([
          `verification-accepted-source-commit:${sourceCommit}`,
          `verification-origin-dev:${sourceCommit}`,
          "verification-status:clean",
        ]),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("accepts a workflow-created patch-equivalent replay with explicit provenance", async () => {
    const fixture = repositoryFixture();
    try {
      const { sourceCommit, replayCommit } = replayFixtureSource(fixture);
      const verification = await verify(
        {
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          taskId: "domain/valid-replay-provenance",
          generation: 1,
          intent: { input: {} },
        } as any,
        provenanceResult({
          fixture,
          ownedCommits: [sourceCommit],
          acceptedCommit: replayCommit,
          provenance: `${sourceCommit}->${replayCommit}`,
        }),
      );
      expect(verification).toMatchObject({
        accepted: true,
        evidence: expect.arrayContaining([
          `verification-provenance-source-commit:${sourceCommit}`,
          `verification-accepted-source-commit:${replayCommit}`,
        ]),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects an integration replay with missing provenance", async () => {
    const fixture = repositoryFixture();
    try {
      const { sourceCommit, replayCommit } = replayFixtureSource(fixture);
      const verification = await verify(
        {
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          taskId: "domain/missing-provenance",
          generation: 1,
          intent: { input: {} },
        } as any,
        provenanceResult({
          fixture,
          ownedCommits: [sourceCommit],
          acceptedCommit: replayCommit,
        }),
      );
      expect(verification).toMatchObject({
        accepted: false,
        evidence: expect.arrayContaining([
          "verification-finding:accepted-commit-not-task-owned",
        ]),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects mismatched stable-patch integration provenance", async () => {
    const fixture = repositoryFixture();
    try {
      const { sourceCommit, replayCommit } = replayFixtureSource(fixture, {
        mismatchedPatch: true,
      });
      const verification = await verify(
        {
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          taskId: "domain/mismatched-provenance",
          generation: 1,
          intent: { input: {} },
        } as any,
        provenanceResult({
          fixture,
          ownedCommits: [sourceCommit],
          acceptedCommit: replayCommit,
          provenance: `${sourceCommit}->${replayCommit}`,
        }),
      );
      expect(verification).toMatchObject({
        accepted: false,
        evidence: expect.arrayContaining([
          "verification-finding:integration-provenance-patch-mismatch",
        ]),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects forged provenance from a commit outside task-source-commits", async () => {
    const fixture = repositoryFixture();
    try {
      const { sourceCommit, replayCommit } = replayFixtureSource(fixture);
      const forgedSource = git(
        fixture.repoDir,
        "rev-parse",
        `${sourceCommit}^`,
      );
      const verification = await verify(
        {
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          taskId: "domain/forged-provenance",
          generation: 1,
          intent: { input: {} },
        } as any,
        provenanceResult({
          fixture,
          ownedCommits: [sourceCommit],
          acceptedCommit: replayCommit,
          provenance: `${forgedSource}->${replayCommit}`,
        }),
      );
      expect(verification).toMatchObject({
        accepted: false,
        evidence: expect.arrayContaining([
          "verification-finding:accepted-commit-not-task-owned",
        ]),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects multi-commit ownership as ambiguous without one explicit provenance edge", async () => {
    const fixture = repositoryFixture();
    try {
      const firstCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      writeFileSync(join(fixture.workspaceDir, "second.txt"), "second\n");
      git(fixture.workspaceDir, "add", "second.txt");
      git(fixture.workspaceDir, "commit", "-m", "second task patch");
      const secondCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      writeFileSync(join(fixture.repoDir, "dev-advance.txt"), "advance\n");
      git(fixture.repoDir, "add", "dev-advance.txt");
      git(fixture.repoDir, "commit", "-m", "advance dev");
      git(fixture.repoDir, "cherry-pick", firstCommit, secondCommit);
      const replayCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "origin", "dev");

      const verification = await verify(
        {
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          taskId: "domain/ambiguous-provenance",
          generation: 1,
          intent: { input: {} },
        } as any,
        provenanceResult({
          fixture,
          ownedCommits: [firstCommit, secondCommit],
          acceptedCommit: replayCommit,
        }),
      );
      expect(verification).toMatchObject({
        accepted: false,
        evidence: expect.arrayContaining([
          "verification-finding:accepted-commit-not-task-owned",
        ]),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects patch-equivalent provenance when the integration commit is not on origin/dev", async () => {
    const fixture = repositoryFixture();
    try {
      const { sourceCommit, replayCommit } = replayFixtureSource(fixture, {
        push: false,
      });
      const verification = await verify(
        {
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          taskId: "domain/nonancestor-provenance",
          generation: 1,
          intent: { input: {} },
        } as any,
        provenanceResult({
          fixture,
          ownedCommits: [sourceCommit],
          acceptedCommit: replayCommit,
          provenance: `${sourceCommit}->${replayCommit}`,
        }),
      );
      expect(verification).toMatchObject({
        accepted: false,
        evidence: expect.arrayContaining([
          "verification-finding:unintegrated-source-commit",
        ]),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects a mixed-SKU-shaped no-edit/no-commit convergence with a deterministic verifier finding", async () => {
    const evidence = [
      "mixed-sku-review:Standard_D4s_v5,Standard_D8s_v5",
      "scenario-carrier:no-edit-required",
      "integration:no-task-owned-commit",
    ];

    const verification = await verify(
      {
        projectDir: "/tmp/not-used-for-no-commit-rejection",
        workspaceDir: "/tmp/not-used-for-no-commit-rejection",
        taskId: "domain/mixed-sku-no-edit",
        generation: 1,
        intent: { input: { skuShape: "mixed" } },
      } as any,
      {
        state: "converged",
        summary: "mixed-SKU carrier already matched",
        evidence,
        actions: [],
      },
    );

    expect(verification).toEqual({
      accepted: false,
      summary:
        "Domain task convergence rejected: the result explicitly records that no task-owned commit was created",
      evidence: [...evidence, "verification-finding:no-task-owned-commit"],
    });
  });

  it("accepts waiting and needs-owner handler results unchanged by verify()", async () => {
    const dispositions = [
      {
        state: "waiting" as const,
        summary: "exact pipeline fact is pending",
        evidence: ["pipeline-run:123"],
        actions: [],
        conditions: [
          {
            id: "pipeline-run-123-completed",
            type: "pipeline-run.state",
            subject: "pipeline-run:123",
            expected: { field: "state", equals: "completed" },
          },
        ],
      },
      {
        state: "needs-owner" as const,
        summary: "bounded source judgment is required",
        evidence: ["material-success-candidate:none"],
        actions: [],
      },
    ];

    for (const disposition of dispositions) {
      const verification = await verify(
        {
          projectDir: "/tmp/not-used-for-nonconverged-disposition",
          workspaceDir: "/tmp/not-used-for-nonconverged-disposition",
          taskId: `domain/${disposition.state}`,
          generation: 1,
          intent: { input: {} },
        } as any,
        disposition,
      );

      expect(verification).toEqual({
        accepted: true,
        summary: `Domain task ${disposition.state} disposition does not claim source convergence.`,
        evidence: disposition.evidence,
      });
      expect(disposition.summary).toBe(
        disposition.state === "waiting"
          ? "exact pipeline fact is pending"
          : "bounded source judgment is required",
      );
    }
  });

  it("lets the agent converge after correcting a stale follow-through wait shape", async () => {
    const fixture = repositoryFixture();
    const prompts: string[] = [];
    try {
      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({
            taskId: "compact/compact-feature-bootstrap-profile",
            input: {},
          })}\n\`\`\``,
          runAgent: (async (_agent: string, prompt: string) => {
            prompts.push(prompt);
            return {
              status: "done",
              sessionId: "session-1",
              lastAssistantText: "waiting",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "waiting" },
              structuredResult: {
                state: "waiting",
                summary:
                  "wait on the existing exact holder after compact regeneration",
                evidence: [
                  "existing holder already captures the same frontier",
                ],
                actions: [],
                conditions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
          runAgentSession: (async (_agent: string, prompt: string) => {
            prompts.push(prompt);
            return {
              status: "done",
              sessionId: "session-1",
              lastAssistantText: "converged",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "converged" },
              structuredResult: {
                state: "converged",
                summary:
                  "the existing holder already preserves the frontier, so this compact task can converge",
                evidence: [
                  "existing holder already captures the same frontier",
                ],
                actions: [],
              },
            };
          }) as NonNullable<WorkflowContext["runAgentSession"]>,
        }),
      );

      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toContain(
        "requires one exact Condition or a direct child task created with parentId compact/compact-feature-bootstrap-profile",
      );
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          summary: "Final task branch contains zero accepted source patches",
          evidence: expect.arrayContaining([
            "task-source-commits:none",
            "task-changed-files:none",
            "material-success-candidate:none",
          ]),
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

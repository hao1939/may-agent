import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute, reconciliationTaskId } from "./domain-task-execution.js";

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
  writeFileSync(join(repoDir, "base.txt"), "base\n");
  git(repoDir, "add", "base.txt");
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

function context(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    task: "bounded task",
    agent: "aks-explorer",
    projectDir: "/repo",
    workspaceDir: "/worktrees/task-1",
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

  it("requires infrastructure to supply an isolated task worktree", async () => {
    const result = await execute(context({ workspaceDir: "/repo" }));
    expect(result).toMatchObject({
      type: "blocked",
      reason: expect.stringContaining("prepared task worktree"),
    });
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
              summary: "preserve one new exact wait keyed to origin/dev@a954836b",
              evidence: ["serverless frontier unchanged"],
              actions: [
                {
                  kind: "create-task",
                  id: "wait-compact-serverless-package-partial-origin-dev-advance-a954836b-20260724",
                  parentId: "project",
                  outcome: "Refresh the serverless repo-ref wait after origin/dev advances again.",
                  mode: "achieve",
                  priority: "P2",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  acceptance: ["Recheck the same frontier after the next origin/dev advance."],
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit: "a954836be05afcbc95c0845c1ed49857526d0460",
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
              summary: "preserve one new exact wait keyed to origin/dev@a954836b",
              evidence: ["serverless frontier unchanged"],
              actions: [
                {
                  kind: "create-task",
                  id: "wait-compact-serverless-package-partial-origin-dev-advance-a954836b-20260724",
                  parentId: "compact/compact-feature-serverless",
                  outcome: "Refresh the serverless repo-ref wait after origin/dev advances again.",
                  mode: "achieve",
                  priority: "P2",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  acceptance: ["Recheck the same frontier after the next origin/dev advance."],
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit: "a954836be05afcbc95c0845c1ed49857526d0460",
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
            summary: "the existing repo-ref wait child still truthfully carries the frontier",
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
        summary:
          "the existing repo-ref wait child still truthfully carries the frontier",
        actions: [],
        conditions: [],
      },
    });
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
                summary: "wait on the existing exact holder after compact regeneration",
                evidence: ["existing holder already captures the same frontier"],
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
                summary: "the existing holder already preserves the frontier, so this compact task can converge",
                evidence: ["existing holder already captures the same frontier"],
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
          state: "converged",
          summary: expect.stringContaining("dev remained at"),
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

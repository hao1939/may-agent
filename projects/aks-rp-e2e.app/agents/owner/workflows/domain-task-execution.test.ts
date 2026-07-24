import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
              conditions: [],
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
});

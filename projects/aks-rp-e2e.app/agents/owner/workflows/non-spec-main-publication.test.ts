import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk/legacy";
import {
  description,
  execute,
  name,
  resolveAzCli,
  workspace,
} from "./non-spec-main-publication.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function repositoryFixture(): {
  root: string;
  repoDir: string;
  workspaceDir: string;
} {
  const root = mkdtempSync(join(tmpdir(), "non-spec-main-publication-"));
  const remote = join(root, "remote.git");
  const repoDir = join(root, "repo");
  const workspaceDir = join(root, "task");
  git(root, "init", "--bare", remote);
  git(root, "init", "-b", "main", repoDir);
  git(repoDir, "config", "user.name", "test");
  git(repoDir, "config", "user.email", "test@example.com");
  writeFileSync(join(repoDir, "base.txt"), "base\n");
  writeFileSync(join(repoDir, "allowed.txt"), "before\n");
  git(repoDir, "add", "base.txt", "allowed.txt");
  git(repoDir, "commit", "-m", "base");
  git(repoDir, "remote", "add", "origin", remote);
  git(repoDir, "push", "-u", "origin", "main");
  git(repoDir, "worktree", "add", "-b", "task/example", workspaceDir, "main");
  git(workspaceDir, "config", "user.name", "test");
  git(workspaceDir, "config", "user.email", "test@example.com");
  return { root, repoDir, workspaceDir };
}

function fakeAzCli(
  root: string,
  seed: object = { nextId: 1, prs: [] },
): {
  cliPath: string;
  statePath: string;
} {
  const statePath = join(root, "az-state.json");
  const cliPath = join(root, "fake-az.js");
  writeFileSync(statePath, `${JSON.stringify(seed, null, 2)}\n`);
  writeFileSync(
    cliPath,
    `#!/usr/bin/env node
const fs = require('node:fs');
const statePath = process.env.FAKE_AZ_STATE;
const args = process.argv.slice(2);
function readState(){ return JSON.parse(fs.readFileSync(statePath, 'utf8')); }
function writeState(state){ fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\\n'); }
function take(flag){ const idx = args.indexOf(flag); if (idx < 0) return ''; const value = args[idx + 1] || ''; args.splice(idx, 2); return value; }
function drop(flag){ const idx = args.indexOf(flag); if (idx >= 0) args.splice(idx, 1); }
take('--organization');
take('--project');
take('-o');
const command = args.slice(0,3).join(' ');
const state = readState();
if (command === 'repos pr list') {
  const source = take('--source-branch');
  const target = take('--target-branch');
  const rows = (state.prs || []).filter((pr) => (!source || pr.sourceBranch === source) && (!target || pr.targetBranch === target));
  process.stdout.write(JSON.stringify(rows));
  process.exit(0);
}
if (command === 'repos pr show') {
  const id = take('--id');
  const pr = (state.prs || []).find((entry) => String(entry.pullRequestId) === String(id));
  process.stdout.write(JSON.stringify(pr || {}));
  process.exit(0);
}
if (command === 'repos pr create') {
  take('--repository');
  const sourceBranch = take('--source-branch');
  const targetBranch = take('--target-branch');
  const title = take('--title');
  const description = take('--description');
  const pr = {
    pullRequestId: Number(state.nextId || 1),
    status: 'active',
    mergeStatus: 'queued',
    sourceBranch,
    targetBranch,
    title,
    description,
    lastMergeSourceCommit: { commitId: '' },
    lastMergeCommit: { commitId: '' }
  };
  state.nextId = Number(pr.pullRequestId) + 1;
  state.prs = [...(state.prs || []), pr];
  writeState(state);
  if (state.createReturnsEmpty) {
    process.stdout.write('{}');
    process.exit(0);
  }
  process.stdout.write(JSON.stringify(pr));
  process.exit(0);
}
process.stderr.write('unsupported fake az command: ' + args.join(' ') + '\\n');
process.exit(1);
`,
  );
  chmodSync(cliPath, 0o755);
  return { cliPath, statePath };
}

function taskPrompt(
  input: Record<string, unknown> = {},
  triggerObservation?: Record<string, unknown>,
): string {
  return [
    "## Reconciliation Task",
    "```json",
    JSON.stringify(
      {
        taskId:
          "domain/publish-master-validation-origin-main-baseline-refresh-after-cpu-removal-20260804",
        generation: 1,
        outcome: "Publish the bounded master-validation refresh into main.",
        input,
      },
      null,
      2,
    ),
    "```",
    ...(triggerObservation
      ? [
          "",
          "## Trigger Event",
          "```json",
          JSON.stringify(triggerObservation, null, 2),
          "```",
        ]
      : []),
  ].join("\n");
}

function context(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    task: taskPrompt(),
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

describe("non-spec main publication workflow", () => {
  it("binds a main-based task worktree for bounded non-spec PR publication", () => {
    expect(name).toBe("non-spec-main-publication");
    expect(description).toContain("non-spec repository patch");
    expect(workspace).toEqual({ kind: "task", baseBranch: "main" });
  });

  it("resolves Azure CLI from env, then local fallback, then plain az", () => {
    const root = mkdtempSync(join(tmpdir(), "non-spec-main-publication-az-"));
    const localAz = join(root, "az");
    writeFileSync(localAz, "#!/bin/sh\nexit 0\n");
    chmodSync(localAz, 0o755);
    try {
      expect(
        resolveAzCli(
          { AZURE_CLI_PATH: "/custom/az" } as NodeJS.ProcessEnv,
          localAz,
        ),
      ).toBe("/custom/az");
      expect(resolveAzCli({} as NodeJS.ProcessEnv, localAz)).toBe(localAz);
      rmSync(localAz);
      expect(resolveAzCli({} as NodeJS.ProcessEnv, localAz)).toBe("az");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes a bounded task branch as a non-draft PR and waits on PR observation", async () => {
    const fixture = repositoryFixture();
    const az = fakeAzCli(fixture.root);
    const previousAz = process.env.AZURE_CLI_PATH;
    const previousState = process.env.FAKE_AZ_STATE;
    let prompt = "";
    try {
      process.env.AZURE_CLI_PATH = az.cliPath;
      process.env.FAKE_AZ_STATE = az.statePath;
      const result = await execute(
        context({
          task: taskPrompt({
            allowedChangedFiles: ["allowed.txt"],
            prTitle: "test: publish refresh",
          }),
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async (_agent: string, task: string) => {
            prompt = task;
            writeFileSync(join(fixture.workspaceDir, "allowed.txt"), "after\n");
            git(fixture.workspaceDir, "add", "allowed.txt");
            git(fixture.workspaceDir, "commit", "-m", "bounded refresh");
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
                summary: "bounded refresh ready",
                evidence: ["verification:bounded-refresh"],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(prompt).toContain("Do not create another branch or worktree");
      expect(prompt).toContain("origin/main@");
      expect(prompt).toContain("allowed.txt");
      expect(prompt).toContain(
        "return state=converged with exact evidence for the prepared commit",
      );
      expect(prompt).toContain(
        "Do not return waiting merely because those workflow-owned publication steps remain",
      );
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining("Published non-draft PR 1"),
          evidence: expect.arrayContaining([
            "verification:bounded-refresh",
            "pull-request:1",
            "pull-request-status:active",
            "target-ref:origin/main",
          ]),
        },
      });
      const output = (
        result as { output: { conditions: Array<{ subject: string }> } }
      ).output;
      expect(output.conditions).toHaveLength(2);
      expect(output.conditions.map((condition) => condition.subject)).toEqual([
        "pull-request:1",
        "pull-request:1",
      ]);
      expect(
        git(fixture.repoDir, "ls-remote", "--heads", "origin", "task/example"),
      ).toContain("refs/heads/task/example");
    } finally {
      process.env.AZURE_CLI_PATH = previousAz;
      process.env.FAKE_AZ_STATE = previousState;
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("recovers a prepared commit when the agent mistakenly waits for workflow-owned main publication", async () => {
    const fixture = repositoryFixture();
    const az = fakeAzCli(fixture.root);
    const previousAz = process.env.AZURE_CLI_PATH;
    const previousState = process.env.FAKE_AZ_STATE;
    try {
      process.env.AZURE_CLI_PATH = az.cliPath;
      process.env.FAKE_AZ_STATE = az.statePath;
      const result = await execute(
        context({
          task: taskPrompt({ allowedChangedFiles: ["allowed.txt"] }),
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async () => {
            writeFileSync(join(fixture.workspaceDir, "allowed.txt"), "after\n");
            git(fixture.workspaceDir, "add", "allowed.txt");
            git(fixture.workspaceDir, "commit", "-m", "bounded refresh");
            const sourceCommit = git(
              fixture.workspaceDir,
              "rev-parse",
              "HEAD",
            );
            return {
              status: "done",
              sessionId: "session-1",
              lastAssistantText: "waiting for main",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "waiting" },
              structuredResult: {
                state: "waiting",
                summary: "Prepared commit; waiting for origin/main",
                evidence: [`prepared-commit:${sourceCommit}`],
                actions: [],
                conditions: [
                  {
                    id: `await-origin-main-${sourceCommit}`,
                    type: "aks.repo-ref.observed",
                    subject: "refs/heads/main",
                    expected: { commit: sourceCommit },
                  },
                ],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining("Published non-draft PR 1"),
          evidence: expect.arrayContaining(["pull-request:1"]),
        },
      });
      const output = (
        result as { output: { conditions: Array<{ subject: string }> } }
      ).output;
      expect(output.conditions.map((condition) => condition.subject)).toEqual([
        "pull-request:1",
        "pull-request:1",
      ]);
      expect(
        git(fixture.repoDir, "ls-remote", "--heads", "origin", "task/example"),
      ).toContain("refs/heads/task/example");
    } finally {
      process.env.AZURE_CLI_PATH = previousAz;
      process.env.FAKE_AZ_STATE = previousState;
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("adopts the created PR when publication returns an ambiguous response", async () => {
    const fixture = repositoryFixture();
    const az = fakeAzCli(fixture.root, {
      nextId: 1,
      prs: [],
      createReturnsEmpty: true,
    });
    const previousAz = process.env.AZURE_CLI_PATH;
    const previousState = process.env.FAKE_AZ_STATE;
    try {
      process.env.AZURE_CLI_PATH = az.cliPath;
      process.env.FAKE_AZ_STATE = az.statePath;
      const result = await execute(
        context({
          task: taskPrompt({ allowedChangedFiles: ["allowed.txt"] }),
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async () => {
            writeFileSync(join(fixture.workspaceDir, "allowed.txt"), "after\n");
            git(fixture.workspaceDir, "add", "allowed.txt");
            git(fixture.workspaceDir, "commit", "-m", "bounded refresh");
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
                summary: "bounded refresh ready",
                evidence: ["verification:bounded-refresh"],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining("Published non-draft PR 1"),
          evidence: expect.arrayContaining(["pull-request:1"]),
        },
      });
      const state = JSON.parse(
        await Bun.file(az.statePath).text(),
      ) as { prs: unknown[] };
      expect(state.prs).toHaveLength(1);
    } finally {
      process.env.AZURE_CLI_PATH = previousAz;
      process.env.FAKE_AZ_STATE = previousState;
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("re-enters bounded judgment for a changed active PR review and reuses the same PR", async () => {
    const fixture = repositoryFixture();
    writeFileSync(join(fixture.workspaceDir, "allowed.txt"), "before review\n");
    git(fixture.workspaceDir, "add", "allowed.txt");
    git(fixture.workspaceDir, "commit", "-m", "prepare publication");
    const initialCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
    git(fixture.workspaceDir, "push", "origin", "HEAD:task/example");
    const az = fakeAzCli(fixture.root, {
      nextId: 2,
      prs: [
        {
          pullRequestId: "1",
          status: "active",
          mergeStatus: "queued",
          sourceBranch: "task/example",
          targetBranch: "main",
          lastMergeSourceCommit: { commitId: initialCommit },
          lastMergeCommit: { commitId: "" },
        },
      ],
    });
    const previousAz = process.env.AZURE_CLI_PATH;
    const previousState = process.env.FAKE_AZ_STATE;
    let prompt = "";
    try {
      process.env.AZURE_CLI_PATH = az.cliPath;
      process.env.FAKE_AZ_STATE = az.statePath;
      const result = await execute(
        context({
          task: taskPrompt(
            {
              allowedChangedFiles: ["allowed.txt"],
              reviewFingerprint: "prior-review-fingerprint",
              unresolvedReviewThreadIds: ["255301000"],
            },
            {
              reason: "pull-request-review-changed",
              pullRequestId: "1",
              unresolvedReviewCount: 1,
              reviewFingerprint: "ee3dd77a3da02bc8",
              unresolvedReviewThreads: [
                {
                  threadId: "255301000",
                  path: "/feature.test.ts",
                  author: "GitOps (Git LowPriv)",
                  content:
                    "PR Assistant PR Assistant Use the shared direct-node helper instead of duplicating cleanup logic.",
                },
              ],
            },
          ),
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async (_agent: string, task: string) => {
            prompt = task;
            writeFileSync(join(fixture.workspaceDir, "allowed.txt"), "after review\n");
            git(fixture.workspaceDir, "add", "allowed.txt");
            git(fixture.workspaceDir, "commit", "-m", "address review");
            return {
              status: "done",
              sessionId: "session-review-1",
              lastAssistantText: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              structuredResult: {
                state: "converged",
                summary: "review fix ready",
                evidence: ["verification:review-fix"],
                actions: [],
              },
            };
          }) as WorkflowContext["runAgent"],
        }),
      );

      const repairedCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      expect(prompt).toContain("Reconcile review feedback for existing PR 1");
      expect(prompt).toContain(
        "Use the shared direct-node helper instead of duplicating cleanup logic.",
      );
      expect(prompt).toContain("Do not create another branch, worktree, or PR.");
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining("Published non-draft PR 1"),
          evidence: expect.arrayContaining([
            "verification:review-fix",
            "pull-request:1",
            "pull-request-review-fingerprint:ee3dd77a3da02bc8",
            "pull-request-review-thread-ids:255301000",
            `source-commit:${repairedCommit}`,
          ]),
        },
      });
      const output = result as {
        output: { conditions: Array<{ expected: Record<string, unknown> }> };
      };
      expect(output.output.conditions).toHaveLength(4);
      expect(output.output.conditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            expected: { field: "reviewFingerprint", notEquals: "ee3dd77a3da02bc8" },
          }),
          expect.objectContaining({
            expected: { field: "unresolvedReviewCount", notEquals: 1 },
          }),
        ]),
      );
      expect(
        git(fixture.repoDir, "ls-remote", "--heads", "origin", "task/example"),
      ).toContain(repairedCommit);
      const state = JSON.parse(
        await Bun.file(az.statePath).text(),
      ) as { prs: Array<{ pullRequestId: string }> };
      expect(state.prs).toHaveLength(1);
      expect(state.prs[0]?.pullRequestId).toBe("1");
    } finally {
      process.env.AZURE_CLI_PATH = previousAz;
      process.env.FAKE_AZ_STATE = previousState;
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("coalesces a repeated identical active PR review fingerprint without rerunning owner judgment", async () => {
    const fixture = repositoryFixture();
    writeFileSync(join(fixture.workspaceDir, "allowed.txt"), "before review\n");
    git(fixture.workspaceDir, "add", "allowed.txt");
    git(fixture.workspaceDir, "commit", "-m", "prepare publication");
    const initialCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
    git(fixture.workspaceDir, "push", "origin", "HEAD:task/example");
    const az = fakeAzCli(fixture.root, {
      nextId: 2,
      prs: [
        {
          pullRequestId: "1",
          status: "active",
          mergeStatus: "queued",
          sourceBranch: "task/example",
          targetBranch: "main",
          lastMergeSourceCommit: { commitId: initialCommit },
          lastMergeCommit: { commitId: "" },
        },
      ],
    });
    const previousAz = process.env.AZURE_CLI_PATH;
    const previousState = process.env.FAKE_AZ_STATE;
    let runAgentCalls = 0;
    try {
      process.env.AZURE_CLI_PATH = az.cliPath;
      process.env.FAKE_AZ_STATE = az.statePath;
      const result = await execute(
        context({
          task: taskPrompt(
            {
              allowedChangedFiles: ["allowed.txt"],
              reviewFingerprint: "ee3dd77a3da02bc8",
              unresolvedReviewThreadIds: ["255301000"],
            },
            {
              reason: "pull-request-review-changed",
              pullRequestId: "1",
              unresolvedReviewCount: 1,
              reviewFingerprint: "ee3dd77a3da02bc8",
              unresolvedReviewThreads: [
                {
                  threadId: "255301000",
                  path: "/feature.test.ts",
                  author: "GitOps (Git LowPriv)",
                  content:
                    "Use the shared direct-node helper instead of duplicating cleanup logic.",
                },
              ],
            },
          ),
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async () => {
            runAgentCalls += 1;
            throw new Error("runAgent should not be called for identical review payloads");
          }) as WorkflowContext["runAgent"],
        }),
      );

      expect(runAgentCalls).toBe(0);
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining("repeated identical review payload was coalesced"),
          evidence: expect.arrayContaining([
            "pull-request:1",
            "pull-request-review-fingerprint:ee3dd77a3da02bc8",
            "pull-request-review-thread-ids:255301000",
            `source-commit:${initialCommit}`,
          ]),
        },
      });
      const output = result as {
        output: { conditions: Array<{ expected: Record<string, unknown> }> };
      };
      expect(output.output.conditions).toHaveLength(4);
    } finally {
      process.env.AZURE_CLI_PATH = previousAz;
      process.env.FAKE_AZ_STATE = previousState;
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("converges when Azure reports the tested source merged into origin/main", async () => {
    const fixture = repositoryFixture();
    const sourceCommit = (() => {
      writeFileSync(join(fixture.workspaceDir, "allowed.txt"), "after\n");
      git(fixture.workspaceDir, "add", "allowed.txt");
      git(fixture.workspaceDir, "commit", "-m", "bounded refresh");
      const commit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      git(fixture.workspaceDir, "push", "origin", "HEAD:task/example");
      return commit;
    })();
    const mergeCommit = (() => {
      git(fixture.repoDir, "fetch", "origin", "task/example");
      git(fixture.repoDir, "checkout", "main");
      git(
        fixture.repoDir,
        "merge",
        "--no-ff",
        "origin/task/example",
        "-m",
        "merge refresh",
      );
      git(fixture.repoDir, "push", "origin", "main");
      return git(fixture.repoDir, "rev-parse", "HEAD");
    })();
    const az = fakeAzCli(fixture.root, {
      nextId: 8,
      prs: [
        {
          pullRequestId: "7",
          status: "completed",
          mergeStatus: "succeeded",
          sourceBranch: "task/example",
          targetBranch: "main",
          lastMergeSourceCommit: { commitId: sourceCommit },
          lastMergeCommit: { commitId: mergeCommit },
        },
      ],
    });
    const previousAz = process.env.AZURE_CLI_PATH;
    const previousState = process.env.FAKE_AZ_STATE;
    try {
      process.env.AZURE_CLI_PATH = az.cliPath;
      process.env.FAKE_AZ_STATE = az.statePath;
      const result = await execute(
        context({
          projectDir: fixture.repoDir,
          workspaceDir: fixture.workspaceDir,
          runAgent: (async () => {
            throw new Error(
              "runAgent should not be called when the PR is already merged",
            );
          }) as WorkflowContext["runAgent"],
        }),
      );
      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "converged",
          summary: expect.stringContaining("PR 7 integrated"),
          evidence: expect.arrayContaining([
            "pull-request:7",
            `source-commit:${sourceCommit}`,
            `merge-commit:${mergeCommit}`,
            `integrated-commit:${mergeCommit}`,
            "target-ref:origin/main",
          ]),
        },
      });
    } finally {
      process.env.AZURE_CLI_PATH = previousAz;
      process.env.FAKE_AZ_STATE = previousState;
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

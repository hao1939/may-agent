import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppEvent, WorkflowContext } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  acceptedPublicationCommits,
  description,
  execute,
  name,
  PUBLICATION_PROVENANCE_REGRESSION,
  resolveAzCli,
  validatePublicationRange,
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
): {
  input: Record<string, unknown>;
  trigger?: AppEvent<Record<string, unknown>>;
} {
  return {
    input,
    ...(triggerObservation
      ? {
          trigger: {
            type: "pull-request.state",
            data: triggerObservation,
          },
        }
      : {}),
  };
}

type ContextOverrides = {
  task?: ReturnType<typeof taskPrompt>;
  projectDir?: string;
  workspaceDir?: string;
  runAgent?: WorkflowContext["agents"]["call"];
};

function context(overrides: ContextOverrides = {}): WorkflowContext {
  const task = overrides.task ?? taskPrompt();
  const projectDir = overrides.projectDir ?? "/repo";
  const workspaceDir = overrides.workspaceDir ?? "/worktrees/task-1";
  const runAgent =
    overrides.runAgent ??
    ((async () => ({
      id: "session-1",
      kind: "agent",
      status: "done",
      summary: "done",
      output: {
        state: "converged",
        summary: "done",
        evidence: ["commit:abc"],
        actions: [],
      },
    })) as WorkflowContext["agents"]["call"]);
  return createTestAppWorkflowContext({
    input: task.input,
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId:
        "domain/publish-master-validation-origin-main-baseline-refresh-after-cpu-removal-20260804",
      generation: 1,
      resourceVersion: 1,
      owner: "aks-explorer",
      mode: "achieve",
      outcome: "Publish the bounded master-validation refresh into main.",
      acceptance: [],
      input: task.input,
      children: { live: [], completed: [] },
      events: {
        items: task.trigger
          ? [
              {
                observedAt: "2026-08-21T00:00:00.000Z",
                event: task.trigger,
              },
            ]
          : [],
        truncated: false,
      },
    },
    callAgent: runAgent,
    workspace: {
      appRoot: "/app",
      projectRoot: projectDir,
      root: workspaceDir,
      output: "/tmp",
    },
  });
}

describe("non-spec main publication workflow", () => {
  it("binds a main-based task worktree for bounded non-spec PR publication", () => {
    expect(name).toBe("non-spec-main-publication");
    expect(description).toContain("non-spec repository patch");
    expect(workspace).toEqual({ kind: "task", baseBranch: "main" });
  });

  it("keeps only complete accepted-commit receipts", () => {
    expect(
      acceptedPublicationCommits([
        {
          commit: "a".repeat(40),
          taskReceipt: "task:ops/prior#receipt",
          verificationEvidence: ["test:prior-pass"],
        },
        {
          commit: "b".repeat(40),
          taskReceipt: "",
          verificationEvidence: ["test:missing-receipt"],
        },
        {
          commit: "c".repeat(40),
          taskReceipt: "task:ops/missing-verification",
          verificationEvidence: [],
        },
        {
          commit: "short",
          taskReceipt: "task:ops/noncanonical-commit",
          verificationEvidence: ["test:prior-pass"],
        },
      ]),
    ).toEqual([
      {
        commit: "a".repeat(40),
        taskReceipt: "task:ops/prior#receipt",
        verificationEvidence: ["test:prior-pass"],
      },
    ]);
  });

  it("accepts one verified commit produced by the current task from fetched origin/main", () => {
    const fixture = repositoryFixture();
    try {
      const baseCommit = git(fixture.repoDir, "rev-parse", "origin/main");
      const taskStartCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      writeFileSync(join(fixture.workspaceDir, "allowed.txt"), "task owned\n");
      git(fixture.workspaceDir, "add", "allowed.txt");
      git(fixture.workspaceDir, "commit", "-m", "task owned");
      const candidateCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");

      expect(
        validatePublicationRange({
          cwd: fixture.workspaceDir,
          baseCommit,
          candidateCommit,
          taskStartCommit,
          currentTaskEvidence: ["test:focused-pass"],
        }),
      ).toMatchObject({
        ok: true,
        commits: [candidateCommit],
        evidence: expect.arrayContaining([
          `publication-range:${baseCommit}..${candidateCommit}`,
          `publication-commit-authority:${candidateCommit}:current-task`,
        ]),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("accepts an explicit multi-commit range only with prior task receipt and verification evidence", () => {
    const fixture = repositoryFixture();
    try {
      const baseCommit = git(fixture.repoDir, "rev-parse", "origin/main");
      writeFileSync(
        join(fixture.workspaceDir, "prior.txt"),
        "accepted prior\n",
      );
      git(fixture.workspaceDir, "add", "prior.txt");
      git(fixture.workspaceDir, "commit", "-m", "independently accepted");
      const acceptedCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      const taskStartCommit = acceptedCommit;
      writeFileSync(
        join(fixture.workspaceDir, "allowed.txt"),
        "current task\n",
      );
      git(fixture.workspaceDir, "add", "allowed.txt");
      git(fixture.workspaceDir, "commit", "-m", "current task");
      const candidateCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");

      const result = validatePublicationRange({
        cwd: fixture.workspaceDir,
        baseCommit,
        candidateCommit,
        taskStartCommit,
        currentTaskEvidence: ["test:current-task-pass"],
        acceptedCommits: [
          {
            commit: acceptedCommit,
            taskReceipt: "task:ops/prior-publication#receipt-1",
            verificationEvidence: ["test:prior-task-pass"],
          },
        ],
      });
      expect(result).toMatchObject({
        ok: true,
        commits: [acceptedCommit, candidateCommit],
        evidence: expect.arrayContaining([
          expect.stringContaining(
            `${acceptedCommit}:receipt=task:ops/prior-publication#receipt-1:verification=test:prior-task-pass`,
          ),
          `publication-commit-authority:${candidateCommit}:current-task`,
        ]),
      });
      expect(PUBLICATION_PROVENANCE_REGRESSION).toEqual({
        dedupeKey: "aks-app-unscoped-multi-commit-publish",
        reviewedRange:
          "9214d32a877cfe50014a51c629ceaa3bf4b34b6a..b821ecd965b83e3452fe8f30857a9b39cf92e619",
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects and names an unvalidated pre-existing commit in the proposed range", () => {
    const fixture = repositoryFixture();
    try {
      const baseCommit = git(fixture.repoDir, "rev-parse", "origin/main");
      writeFileSync(
        join(fixture.workspaceDir, "prior.txt"),
        "unexpected prior\n",
      );
      git(fixture.workspaceDir, "add", "prior.txt");
      git(fixture.workspaceDir, "commit", "-m", "unexpected prior");
      const unexpectedCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      const taskStartCommit = unexpectedCommit;
      writeFileSync(
        join(fixture.workspaceDir, "allowed.txt"),
        "current task\n",
      );
      git(fixture.workspaceDir, "add", "allowed.txt");
      git(fixture.workspaceDir, "commit", "-m", "current task");
      const candidateCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");

      expect(
        validatePublicationRange({
          cwd: fixture.workspaceDir,
          baseCommit,
          candidateCommit,
          taskStartCommit,
          currentTaskEvidence: ["test:current-task-pass"],
        }),
      ).toMatchObject({
        ok: false,
        commits: [unexpectedCommit, candidateCommit],
        unexpectedCommits: [unexpectedCommit],
        reason: expect.stringContaining(unexpectedCommit),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("does not treat blank current-task evidence as publication authority", () => {
    const fixture = repositoryFixture();
    try {
      const baseCommit = git(fixture.repoDir, "rev-parse", "origin/main");
      const taskStartCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      writeFileSync(join(fixture.workspaceDir, "unverified.txt"), "unsafe\n");
      git(fixture.workspaceDir, "add", "unverified.txt");
      git(fixture.workspaceDir, "commit", "-m", "unverified task output");
      const candidateCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");

      expect(
        validatePublicationRange({
          cwd: fixture.workspaceDir,
          baseCommit,
          candidateCommit,
          taskStartCommit,
          currentTaskEvidence: ["  "],
        }),
      ).toMatchObject({
        ok: false,
        unexpectedCommits: [candidateCommit],
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
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
              id: "session-1",
              summary: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              output: {
                state: "converged",
                summary: "bounded refresh ready",
                evidence: ["verification:bounded-refresh"],
                actions: [],
              },
            };
          }) as WorkflowContext["agents"]["call"],
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
        status: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining("Published non-draft PR 1"),
          evidence: expect.arrayContaining([
            "verification:bounded-refresh",
            expect.stringMatching(/^publication-range:/),
            expect.stringMatching(
              /^publication-commit-authority:.*:current-task$/,
            ),
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
            const sourceCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
            return {
              status: "done",
              id: "session-1",
              summary: "waiting for main",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "waiting" },
              output: {
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
          }) as WorkflowContext["agents"]["call"],
        }),
      );

      expect(result).toMatchObject({
        status: "done",
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
              id: "session-1",
              summary: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              output: {
                state: "converged",
                summary: "bounded refresh ready",
                evidence: ["verification:bounded-refresh"],
                actions: [],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );

      expect(result).toMatchObject({
        status: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining("Published non-draft PR 1"),
          evidence: expect.arrayContaining(["pull-request:1"]),
        },
      });
      const state = JSON.parse(await Bun.file(az.statePath).text()) as {
        prs: unknown[];
      };
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
              acceptedPublicationCommits: [
                {
                  commit: initialCommit,
                  taskReceipt: "task:domain/publication#initial-pr",
                  verificationEvidence: ["verification:initial-publication"],
                },
              ],
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
            writeFileSync(
              join(fixture.workspaceDir, "allowed.txt"),
              "after review\n",
            );
            git(fixture.workspaceDir, "add", "allowed.txt");
            git(fixture.workspaceDir, "commit", "-m", "address review");
            return {
              status: "done",
              id: "session-review-1",
              summary: "done",
              messages: [],
              duration: "1s",
              outputDir: "/tmp",
              finishResult: { status: "success", summary: "done" },
              output: {
                state: "converged",
                summary: "review fix ready",
                evidence: ["verification:review-fix"],
                actions: [],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );

      const repairedCommit = git(fixture.workspaceDir, "rev-parse", "HEAD");
      expect(prompt).toContain("Reconcile review feedback for existing PR 1");
      expect(prompt).toContain(
        "Use the shared direct-node helper instead of duplicating cleanup logic.",
      );
      expect(prompt).toContain(
        "Do not create another branch, worktree, or PR.",
      );
      expect(result).toMatchObject({
        status: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining("Published non-draft PR 1"),
          evidence: expect.arrayContaining([
            "verification:review-fix",
            expect.stringContaining(
              `${initialCommit}:receipt=task:domain/publication#initial-pr:verification=verification:initial-publication`,
            ),
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
            expected: {
              field: "reviewFingerprint",
              notEquals: "ee3dd77a3da02bc8",
            },
          }),
          expect.objectContaining({
            expected: { field: "unresolvedReviewCount", notEquals: 1 },
          }),
        ]),
      );
      expect(
        git(fixture.repoDir, "ls-remote", "--heads", "origin", "task/example"),
      ).toContain(repairedCommit);
      const state = JSON.parse(await Bun.file(az.statePath).text()) as {
        prs: Array<{ pullRequestId: string }>;
      };
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
            throw new Error(
              "runAgent should not be called for identical review payloads",
            );
          }) as WorkflowContext["agents"]["call"],
        }),
      );

      expect(runAgentCalls).toBe(0);
      expect(result).toMatchObject({
        status: "done",
        output: {
          state: "waiting",
          summary: expect.stringContaining(
            "repeated identical review payload was coalesced",
          ),
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
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(result).toMatchObject({
        status: "done",
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

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decideRepoRefAdvanceGate,
  execute,
  parseReconciliationTaskPayload,
} from "./wait-for-repo-ref-advance.js";

function git(cwd: string, command: string): string {
  const proc = Bun.spawnSync(command.split(" "), {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(Buffer.from(proc.stderr).toString("utf8"));
  }
  return Buffer.from(proc.stdout).toString("utf8").trim();
}

describe("wait-for-repo-ref-advance workflow", () => {
  test("parses the reconciliation payload block", () => {
    const payload =
      parseReconciliationTaskPayload(`prefix\n## Reconciliation Task\n\
\
\
{\n  "taskId": "domain/example",\n  "input": { "baseRef": "origin/dev", "resumeBaselineCommit": "abc" },\n  "paths": { "projectDir": "/tmp/project" }\n}\n`);

    expect(payload).toMatchObject({
      taskId: "domain/example",
      input: {
        baseRef: "origin/dev",
        resumeBaselineCommit: "abc",
      },
      paths: { projectDir: "/tmp/project" },
    });
  });

  test("returns an exact waiting condition while the watched ref is unchanged", () => {
    const result = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
      specId: "spec.localdns.vm-prerelease.enable-disable",
      sourceCommit: "def",
      publicationBranch: "aks-explorer/example",
    });

    expect(result).toMatchObject({
      state: "waiting",
      conditions: [
        {
          type: "aks.repo-ref.observed",
          subject: "repoRef:origin/dev",
          expected: { field: "commit", notEquals: "abc" },
        },
      ],
    });
  });

  test("uses a distinct Condition for each baseline commit", () => {
    const first = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
    });
    const second = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "def",
      currentCommit: "def",
    });

    expect(first.conditions?.[0]?.id).toBeTruthy();
    expect(second.conditions?.[0]?.id).toBeTruthy();
    expect(first.conditions?.[0]?.id).not.toBe(second.conditions?.[0]?.id);
  });

  test("uses a distinct Condition for different tasks on the same baseline", () => {
    const first = decideRepoRefAdvanceGate({
      taskId: "domain/example-a",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
    });
    const second = decideRepoRefAdvanceGate({
      taskId: "domain/example-b",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
    });

    expect(first.conditions?.[0]?.id).toBeTruthy();
    expect(second.conditions?.[0]?.id).toBeTruthy();
    expect(first.conditions?.[0]?.id).not.toBe(second.conditions?.[0]?.id);
  });

  test("hands the task back to the owner after the watched ref advances", () => {
    const result = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "def",
      specId: "spec.localdns.vm-prerelease.enable-disable",
    });

    expect(result).toMatchObject({
      state: "needs-owner",
    });
    expect(result).not.toHaveProperty("actions");
    expect(result).not.toHaveProperty("conditions");
    expect(result.summary).toContain("advanced from baseline abc to def");
  });

  test("returns needs-owner when the trigger shows a stale satisfied repo-ref wake", async () => {
    const root = mkdtempSync(join(tmpdir(), "wait-for-repo-ref-stale-wake-"));
    const remote = join(root, "remote.git");
    const repo = join(root, "repo");
    try {
      git(root, `git init --bare ${remote}`);
      git(root, `git init ${repo}`);
      git(repo, "git config user.email watcher@example.com");
      git(repo, "git config user.name Repo Watcher");
      writeFileSync(join(repo, "README.md"), "one\n", "utf8");
      git(repo, "git add README.md");
      git(repo, "git commit -m first");
      git(repo, `git remote add origin ${remote}`);
      git(repo, "git branch -M dev");
      git(repo, "git push -u origin dev");
      git(repo, "git fetch origin dev");
      const baselineCommit = git(repo, "git rev-parse --verify origin/dev");

      const result = await execute({
        projectDir: repo,
        task: `## Reconciliation Task\n${JSON.stringify(
          {
            taskId: "domain/example",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: baselineCommit,
              specId: "spec.localdns.vm-prerelease.enable-disable",
            },
            paths: { projectDir: repo },
          },
          null,
          2,
        )}\n## Trigger Observation\n${JSON.stringify(
          {
            type: "aks.repo-ref.observed",
            data: { repoRef: "origin/dev", commit: "different-commit" },
          },
          null,
          2,
        )}`,
        done: (_summary: string, output: Record<string, unknown>) => ({
          type: "done",
          output,
        }),
      } as never);

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          evidence: expect.arrayContaining([
            `repo-ref:origin/dev`,
            `trigger-commit:different-commit`,
            `current-commit:${baselineCommit}`,
          ]),
        },
      });
      expect(
        (result as { output: { summary: string } }).output.summary,
      ).toContain("stale satisfied repo-ref wake");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("uses the canonical project dir and refreshes the watched ref before deciding", async () => {
    const root = mkdtempSync(join(tmpdir(), "wait-for-repo-ref-advance-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const canonical = join(root, "canonical");
    const stale = join(root, "stale");
    try {
      git(root, `git init --bare ${remote}`);
      git(root, `git init ${seed}`);
      git(seed, "git config user.email watcher@example.com");
      git(seed, "git config user.name Repo Watcher");
      writeFileSync(join(seed, "README.md"), "one\n", "utf8");
      git(seed, "git add README.md");
      git(seed, "git commit -m first");
      git(seed, `git remote add origin ${remote}`);
      git(seed, "git branch -M dev");
      git(seed, "git push -u origin dev");
      git(root, `git clone ${remote} ${canonical}`);
      git(root, `git clone ${remote} ${stale}`);
      git(canonical, "git fetch origin dev");
      git(stale, "git fetch origin dev");
      const baselineCommit = git(stale, "git rev-parse --verify origin/dev");

      writeFileSync(join(seed, "README.md"), "two\n", "utf8");
      git(seed, "git add README.md");
      git(seed, "git commit -m second");
      git(seed, "git push origin dev");

      const result = await execute({
        projectDir: stale,
        task: `## Reconciliation Task\n${JSON.stringify(
          {
            taskId: "domain/example",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: baselineCommit,
              specId: "spec.localdns.vm-prerelease.enable-disable",
            },
            paths: { projectDir: canonical },
          },
          null,
          2,
        )}`,
        done: (_summary: string, output: Record<string, unknown>) => ({
          type: "done",
          output,
        }),
      } as never);

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          evidence: expect.arrayContaining([`repo-ref:origin/dev`]),
        },
      });
      expect(
        (result as { output: { summary: string } }).output.summary,
      ).toContain(`advanced from baseline ${baselineCommit}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  campaignBranchName,
  campaignFixFromPullRequest,
  composeFrozenCampaign,
} from "./master-validation-campaign.js";

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `git ${args.join(" ")} failed`,
    );
  }
  return result.stdout.trim();
}

function campaignFixture(): {
  root: string;
  repoDir: string;
  appDir: string;
  baseCommit: string;
} {
  const root = mkdtempSync(join(tmpdir(), "master-validation-campaign-"));
  const remote = join(root, "remote.git");
  const repoDir = join(root, "repo");
  const appDir = join(root, "app");
  git(root, "init", "--bare", remote);
  git(root, "clone", remote, repoDir);
  git(repoDir, "config", "user.name", "Campaign Test");
  git(repoDir, "config", "user.email", "campaign@example.test");
  git(repoDir, "checkout", "-b", "main");
  git(repoDir, "commit", "--allow-empty", "-m", "frozen base");
  const baseCommit = git(repoDir, "rev-parse", "HEAD");
  git(repoDir, "push", "-u", "origin", "main");
  return { root, repoDir, appDir, baseCommit };
}

describe("frozen master-validation campaign", () => {
  test("uses one stable branch for the failed main snapshot", () => {
    expect(campaignBranchName("173646937")).toBe(
      "validation/master-validation-173646937",
    );
  });

  test("includes only focused master-validation repair PRs targeting main", () => {
    expect(
      campaignFixFromPullRequest({
        pullRequestId: 16560089,
        status: "active",
        title: "Fix pipeline bootstrap",
        description:
          "Task: domain/master-validation-failure/pipeline.master-validation.bootstrap/fp",
        sourceRefName: "refs/heads/fix/bootstrap",
        targetRefName: "refs/heads/main",
        lastMergeSourceCommit: { commitId: "abc123" },
      }),
    ).toMatchObject({
      pullRequestId: "16560089",
      sourceBranch: "fix/bootstrap",
      sourceCommit: "abc123",
    });
    expect(
      campaignFixFromPullRequest({
        pullRequestId: 7,
        status: "active",
        description: "Unrelated feature",
        sourceRefName: "refs/heads/feature/unrelated",
        targetRefName: "refs/heads/main",
        lastMergeSourceCommit: { commitId: "def456" },
      }),
    ).toBeNull();
    expect(
      campaignFixFromPullRequest({
        pullRequestId: 16560089,
        status: "active",
        title: "Keep master validation running past admission drift",
        description: "Focused admission repair",
        sourceRefName: "refs/heads/fix/master-validation-soft-admission",
        targetRefName: "refs/heads/main",
        lastMergeSourceCommit: { commitId: "soft123" },
      }),
    ).toMatchObject({ pullRequestId: "16560089" });
  });

  test("accepts a focused fix rooted at the frozen snapshot after main advances", () => {
    const fixture = campaignFixture();
    try {
      git(fixture.repoDir, "checkout", "-b", "fix/frozen", fixture.baseCommit);
      git(fixture.repoDir, "commit", "--allow-empty", "-m", "focused fix");
      const sourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "-u", "origin", "fix/frozen");
      git(fixture.repoDir, "checkout", "main");
      git(
        fixture.repoDir,
        "commit",
        "--allow-empty",
        "-m",
        "unrelated main advance",
      );
      git(fixture.repoDir, "push", "origin", "main");

      const result = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "100",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "1",
            taskId: "domain/master-validation-failure/spec.example/fp",
            sourceBranch: "fix/frozen",
            sourceCommit,
            title: "Focused fix",
          },
        ],
      });
      expect(result.changed).toBe(true);
      expect(result.receipt.baseCommit).toBe(fixture.baseCommit);
      expect(result.receipt.integratedFixes).toHaveLength(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("composes an appended focused PR head into the same frozen campaign", () => {
    const fixture = campaignFixture();
    try {
      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/appended",
        fixture.baseCommit,
      );
      git(fixture.repoDir, "commit", "--allow-empty", "-m", "focused fix");
      const firstSourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "-u", "origin", "fix/appended");

      const first = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "102",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "3",
            taskId: "domain/master-validation-failure/spec.example/fp",
            sourceBranch: "fix/appended",
            sourceCommit: firstSourceCommit,
            title: "Focused fix",
          },
        ],
      });

      git(
        fixture.repoDir,
        "commit",
        "--allow-empty",
        "-m",
        "correct focused fix evidence",
      );
      const appendedSourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "origin", "fix/appended");

      const updated = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "102",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "3",
            taskId: "domain/master-validation-failure/spec.example/fp",
            sourceBranch: "fix/appended",
            sourceCommit: appendedSourceCommit,
            title: "Focused fix",
          },
        ],
        prior: first.receipt,
      });

      expect(updated.changed).toBe(true);
      expect(updated.receipt.branch).toBe(first.receipt.branch);
      expect(updated.receipt.baseCommit).toBe(fixture.baseCommit);
      expect(updated.receipt.currentCommit).not.toBe(
        first.receipt.currentCommit,
      );
      expect(updated.receipt.integratedFixes).toEqual([
        expect.objectContaining({
          pullRequestId: "3",
          sourceCommit: appendedSourceCommit,
        }),
      ]);
      expect(
        git(
          fixture.repoDir,
          "ls-remote",
          "origin",
          `refs/heads/${updated.receipt.branch}`,
        ).split("\t")[0],
      ).toBe(updated.receipt.currentCommit);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("refuses a fix branch that would resync newer main into the campaign", () => {
    const fixture = campaignFixture();
    try {
      git(fixture.repoDir, "commit", "--allow-empty", "-m", "newer main");
      git(fixture.repoDir, "push", "origin", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/from-new-main");
      git(fixture.repoDir, "commit", "--allow-empty", "-m", "focused fix");
      const sourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "-u", "origin", "fix/from-new-main");

      expect(() =>
        composeFrozenCampaign({
          appDir: fixture.appDir,
          repoDir: fixture.repoDir,
          baselineRunId: "101",
          baseCommit: fixture.baseCommit,
          fixes: [
            {
              pullRequestId: "2",
              taskId: "domain/master-validation-failure/spec.example/fp",
              sourceBranch: "fix/from-new-main",
              sourceCommit,
              title: "Focused fix from newer main",
            },
          ],
        }),
      ).toThrow("forks from newer main commit");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

function commitFile(
  repoDir: string,
  path: string,
  content: string,
  message: string,
): string {
  writeFileSync(join(repoDir, path), content);
  git(repoDir, "add", path);
  git(repoDir, "commit", "-m", message);
  return git(repoDir, "rev-parse", "HEAD");
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
    ).toBeNull();
    expect(
      campaignFixFromPullRequest({
        pullRequestId: 16560091,
        status: "active",
        title: "Keep master validation running past admission drift",
        description:
          "Master-Validation-Candidate: include\n\nFocused admission repair",
        sourceRefName: "refs/heads/fix/master-validation-soft-admission",
        targetRefName: "refs/heads/main",
        lastMergeSourceCommit: { commitId: "soft123" },
      }),
    ).toMatchObject({ pullRequestId: "16560091" });
    const completed = {
      pullRequestId: 16560090,
      status: "completed",
      mergeStatus: "succeeded",
      title: "Fix master validation bootstrap",
      description:
        "Task: domain/master-validation-failure/pipeline.master-validation.bootstrap/fp",
      sourceRefName: "refs/heads/fix/bootstrap-current-main",
      targetRefName: "refs/heads/main",
      lastMergeSourceCommit: { commitId: "source123" },
      lastMergeTargetCommit: { commitId: "target123" },
    };
    expect(campaignFixFromPullRequest(completed)).toBeNull();
    expect(
      campaignFixFromPullRequest(completed, { includeCompleted: true }),
    ).toMatchObject({
      pullRequestId: "16560090",
      sourceCommit: "source123",
      targetCommit: "target123",
    });
  });

  test("accepts a focused fix rooted at the frozen snapshot after main advances", () => {
    const fixture = campaignFixture();
    try {
      git(fixture.repoDir, "checkout", "-b", "fix/frozen", fixture.baseCommit);
      const sourceCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused fix",
      );
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
      const firstSourceCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused fix",
      );
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

      const appendedSourceCommit = commitFile(
        fixture.repoDir,
        "evidence.txt",
        "corrected\n",
        "correct focused fix evidence",
      );
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

  test("takes only the focused patch from a PR based on newer main", () => {
    const fixture = campaignFixture();
    try {
      const targetCommit = commitFile(
        fixture.repoDir,
        "main-only.txt",
        "must not enter campaign\n",
        "newer main",
      );
      git(fixture.repoDir, "push", "origin", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/from-new-main");
      const sourceCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused fix",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/from-new-main");

      const result = composeFrozenCampaign({
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
            targetCommit,
            title: "Focused fix from newer main",
          },
        ],
      });
      expect(result.changed).toBe(true);
      git(fixture.repoDir, "fetch", "origin", result.receipt.branch);
      expect(
        git(
          fixture.repoDir,
          "show",
          `origin/${result.receipt.branch}:focused.txt`,
        ),
      ).toBe("repair");
      expect(
        spawnSync(
          "git",
          ["cat-file", "-e", `origin/${result.receipt.branch}:main-only.txt`],
          { cwd: fixture.repoDir },
        ).status,
      ).not.toBe(0);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("binds an equivalent current-main PR to an already tested logical repair", () => {
    const fixture = campaignFixture();
    try {
      git(fixture.repoDir, "checkout", "-b", "fix/frozen", fixture.baseCommit);
      const frozenFixCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused fix",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/frozen");
      const first = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "103",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "10",
            taskId: "domain/master-validation-failure/spec.example/fp",
            sourceBranch: "fix/frozen",
            sourceCommit: frozenFixCommit,
            title: "Frozen repair",
          },
        ],
      });

      git(fixture.repoDir, "checkout", "main");
      const targetCommit = commitFile(
        fixture.repoDir,
        "main-only.txt",
        "new main context\n",
        "new main context",
      );
      git(fixture.repoDir, "push", "origin", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/current-main");
      const currentMainFixCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused fix",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/current-main");

      const rebound = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "103",
        baseCommit: fixture.baseCommit,
        fixes: [],
        replacementFixes: [
          {
            pullRequestId: "11",
            taskId: "domain/master-validation-failure/spec.example/fp",
            sourceBranch: "fix/current-main",
            sourceCommit: currentMainFixCommit,
            targetCommit,
            title: "Current-main repair",
          },
        ],
        prior: first.receipt,
      });

      expect(rebound.changed).toBe(false);
      expect(rebound.receipt.currentCommit).toBe(first.receipt.currentCommit);
      expect(rebound.receipt.integratedFixes).toEqual([
        expect.objectContaining({
          pullRequestId: "11",
          sourceCommit: currentMainFixCommit,
          patchIds: first.receipt.integratedFixes[0].patchIds,
        }),
      ]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("applies a materially new patch for the same task and requires a rerun", () => {
    const fixture = campaignFixture();
    try {
      git(fixture.repoDir, "checkout", "-b", "fix/first", fixture.baseCommit);
      const firstCommit = commitFile(
        fixture.repoDir,
        "first.txt",
        "first repair\n",
        "first repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/first");
      const first = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "104",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "12",
            taskId: "domain/master-validation-failure/spec.example/fp",
            sourceBranch: "fix/first",
            sourceCommit: firstCommit,
            title: "First repair",
          },
        ],
      });

      git(fixture.repoDir, "checkout", "main");
      const targetCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "checkout", "-b", "fix/additional");
      const additionalCommit = commitFile(
        fixture.repoDir,
        "additional.txt",
        "additional repair\n",
        "additional repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/additional");

      const updated = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "104",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "13",
            taskId: "domain/master-validation-failure/spec.example/fp",
            sourceBranch: "fix/additional",
            sourceCommit: additionalCommit,
            targetCommit,
            title: "Additional repair",
          },
        ],
        prior: first.receipt,
      });

      expect(updated.changed).toBe(true);
      expect(updated.receipt.currentCommit).not.toBe(
        first.receipt.currentCommit,
      );
      expect(updated.receipt.integratedFixes).toHaveLength(2);
      git(fixture.repoDir, "fetch", "origin", updated.receipt.branch);
      expect(
        git(
          fixture.repoDir,
          "show",
          `origin/${updated.receipt.branch}:additional.txt`,
        ),
      ).toBe("additional repair");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

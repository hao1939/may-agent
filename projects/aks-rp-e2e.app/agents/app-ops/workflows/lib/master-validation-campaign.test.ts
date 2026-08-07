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
          "Task: domain/master-validation-failure/pipeline.master-validation.bootstrap/fp\nFrozen campaign base: base123",
        sourceRefName: "refs/heads/fix/bootstrap",
        targetRefName: "refs/heads/main",
        lastMergeSourceCommit: { commitId: "abc123" },
      }),
    ).toMatchObject({
      pullRequestId: "16560089",
      sourceBranch: "fix/bootstrap",
      sourceCommit: "abc123",
      campaignBaseCommit: "base123",
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

  test("rebinds an equivalent force-rewritten head of the same focused PR", () => {
    const fixture = campaignFixture();
    try {
      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/equivalent-rewrite",
        fixture.baseCommit,
      );
      const firstSourceCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused fix",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/equivalent-rewrite");

      const first = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "equivalent-rewrite",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "4",
            taskId: "domain/master-validation-failure/spec.example/rewrite",
            sourceBranch: "fix/equivalent-rewrite",
            sourceCommit: firstSourceCommit,
            title: "Focused fix",
          },
        ],
      });

      git(fixture.repoDir, "commit", "--amend", "-m", "equivalent focused fix");
      const rewrittenSourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      expect(rewrittenSourceCommit).not.toBe(firstSourceCommit);
      git(
        fixture.repoDir,
        "push",
        "--force",
        "origin",
        "fix/equivalent-rewrite",
      );

      const rebound = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "equivalent-rewrite",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "4",
            taskId: "domain/master-validation-failure/spec.example/rewrite",
            sourceBranch: "fix/equivalent-rewrite",
            sourceCommit: rewrittenSourceCommit,
            title: "Focused fix",
          },
        ],
        prior: first.receipt,
      });

      expect(rebound.changed).toBe(false);
      expect(rebound.receipt.currentCommit).toBe(first.receipt.currentCommit);
      expect(rebound.receipt.integratedFixes).toEqual([
        expect.objectContaining({
          pullRequestId: "4",
          sourceCommit: rewrittenSourceCommit,
          patchIds: first.receipt.integratedFixes[0]?.patchIds,
        }),
      ]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("preserves campaign history while applying a materially rewritten PR head as a delta", () => {
    const fixture = campaignFixture();
    try {
      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/material-rewrite",
        fixture.baseCommit,
      );
      const firstSourceCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused fix",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/material-rewrite");

      const first = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "material-rewrite",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "5",
            taskId:
              "domain/master-validation-failure/spec.example/material-rewrite",
            sourceBranch: "fix/material-rewrite",
            sourceCommit: firstSourceCommit,
            title: "Focused fix",
          },
        ],
      });

      git(fixture.repoDir, "reset", "--hard", fixture.baseCommit);
      writeFileSync(join(fixture.repoDir, "focused.txt"), "repair\n");
      writeFileSync(
        join(fixture.repoDir, "verification.txt"),
        "corrective proof\n",
      );
      git(fixture.repoDir, "add", "focused.txt", "verification.txt");
      git(
        fixture.repoDir,
        "commit",
        "-m",
        "rewrite focused fix with correction",
      );
      const rewrittenSourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "--force", "origin", "fix/material-rewrite");

      const updated = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "material-rewrite",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "5",
            taskId:
              "domain/master-validation-failure/spec.example/material-rewrite",
            sourceBranch: "fix/material-rewrite",
            sourceCommit: rewrittenSourceCommit,
            title: "Focused fix with correction",
          },
        ],
        prior: first.receipt,
      });

      expect(updated.changed).toBe(true);
      expect(updated.receipt.currentCommit).not.toBe(
        first.receipt.currentCommit,
      );
      expect(updated.receipt.integratedFixes).toEqual([
        expect.objectContaining({
          pullRequestId: "5",
          sourceCommit: rewrittenSourceCommit,
          patchIds: expect.arrayContaining(
            first.receipt.integratedFixes[0]?.patchIds ?? [],
          ),
        }),
      ]);
      git(
        fixture.repoDir,
        "fetch",
        "origin",
        `+refs/heads/${updated.receipt.branch}:refs/remotes/origin/${updated.receipt.branch}`,
      );
      const campaignRef = `origin/${updated.receipt.branch}`;
      expect(git(fixture.repoDir, "show", `${campaignRef}:focused.txt`)).toBe(
        "repair",
      );
      expect(
        git(fixture.repoDir, "show", `${campaignRef}:verification.txt`),
      ).toBe("corrective proof");
      expect(
        git(
          fixture.repoDir,
          "merge-base",
          "--is-ancestor",
          first.receipt.currentCommit,
          updated.receipt.currentCommit,
        ),
      ).toBe("");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("returns a conflicting rewritten test delta to its stable domain carrier", () => {
    const fixture = campaignFixture();
    try {
      writeFileSync(
        join(fixture.repoDir, "runner-conflict.test.ts"),
        "test('base', () => 'base');\n",
      );
      git(fixture.repoDir, "add", "runner-conflict.test.ts");
      git(fixture.repoDir, "commit", "--amend", "--no-edit");
      const frozenCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "--force", "origin", "main");

      git(fixture.repoDir, "checkout", "-b", "fix/test-only-rewrite");
      const firstSourceCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/test-only-rewrite");

      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/newer-campaign-test",
        frozenCommit,
      );
      const predecessorCommit = commitFile(
        fixture.repoDir,
        "runner-conflict.test.ts",
        "test('campaign', () => 'newer campaign coverage');\n",
        "newer campaign test lineage",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/newer-campaign-test");

      const prior = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "test-only-rewrite",
        baseCommit: frozenCommit,
        fixes: [
          {
            pullRequestId: "5",
            taskId:
              "domain/master-validation-failure/spec.example/test-only-rewrite",
            sourceBranch: "fix/test-only-rewrite",
            sourceCommit: firstSourceCommit,
            title: "Focused repair",
          },
          {
            pullRequestId: "6",
            taskId:
              "domain/master-validation-failure/spec.example/newer-test-lineage",
            sourceBranch: "fix/newer-campaign-test",
            sourceCommit: predecessorCommit,
            title: "Newer campaign test lineage",
          },
        ],
      });

      git(fixture.repoDir, "checkout", "fix/test-only-rewrite");
      git(fixture.repoDir, "reset", "--hard", frozenCommit);
      writeFileSync(join(fixture.repoDir, "focused.txt"), "repair\n");
      writeFileSync(
        join(fixture.repoDir, "runner-conflict.test.ts"),
        "test('rewritten', () => 'rewritten PR coverage');\n",
      );
      git(fixture.repoDir, "add", "focused.txt", "runner-conflict.test.ts");
      git(fixture.repoDir, "commit", "-m", "rewrite focused repair tests");
      const rewrittenSourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(
        fixture.repoDir,
        "push",
        "--force",
        "origin",
        "fix/test-only-rewrite",
      );

      expect(() =>
        composeFrozenCampaign({
          appDir: fixture.appDir,
          repoDir: fixture.repoDir,
          baselineRunId: "test-only-rewrite",
          baseCommit: frozenCommit,
          fixes: [
            {
              pullRequestId: "5",
              taskId:
                "domain/master-validation-failure/spec.example/test-only-rewrite",
              sourceBranch: "fix/test-only-rewrite",
              sourceCommit: rewrittenSourceCommit,
              title: "Rewritten focused repair tests",
            },
            {
              pullRequestId: "6",
              taskId:
                "domain/master-validation-failure/spec.example/newer-test-lineage",
              sourceBranch: "fix/newer-campaign-test",
              sourceCommit: predecessorCommit,
              title: "Newer campaign test lineage",
            },
          ],
          prior: prior.receipt,
        }),
      ).toThrow(
        `Campaign focused-patch conflict for PR 5 (domain/master-validation-failure/spec.example/test-only-rewrite) at ${rewrittenSourceCommit}`,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("composes a successor when a retained PR head object is unavailable", () => {
    const fixture = campaignFixture();
    try {
      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/retained",
        fixture.baseCommit,
      );
      const retainedSourceCommit = commitFile(
        fixture.repoDir,
        "retained.txt",
        "retained repair\n",
        "retained focused repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/retained");
      const first = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "missing-retained-object",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "4",
            taskId: "domain/master-validation-failure/spec.example/retained",
            sourceBranch: "fix/retained",
            sourceCommit: retainedSourceCommit,
            title: "Retained focused repair",
          },
        ],
      });

      git(fixture.repoDir, "checkout", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/successor");
      const successorSourceCommit = commitFile(
        fixture.repoDir,
        "successor.txt",
        "successor repair\n",
        "successor focused repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/successor");
      const prior = structuredClone(first.receipt);
      prior.integratedFixes[0]!.sourceCommit = "0".repeat(40);

      const successor = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "missing-retained-object",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "5",
            taskId: "domain/master-validation-failure/spec.example/successor",
            sourceBranch: "fix/successor",
            sourceCommit: successorSourceCommit,
            targetCommit: fixture.baseCommit,
            title: "Successor focused repair",
          },
        ],
        prior,
      });

      git(fixture.repoDir, "fetch", "origin", successor.receipt.branch);
      expect(
        git(
          fixture.repoDir,
          "show",
          `origin/${successor.receipt.branch}:retained.txt`,
        ),
      ).toBe("retained repair");
      expect(
        git(
          fixture.repoDir,
          "show",
          `origin/${successor.receipt.branch}:successor.txt`,
        ),
      ).toBe("successor repair");
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

  test("ignores empty bookkeeping commits when the PR has a source-bearing repair", () => {
    const fixture = campaignFixture();
    try {
      const targetCommit = commitFile(
        fixture.repoDir,
        "main-only.txt",
        "new main context\n",
        "newer main",
      );
      git(fixture.repoDir, "push", "origin", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/after-empty-bookkeeping");
      git(fixture.repoDir, "commit", "--allow-empty", "-m", "prepare replay");
      const sourceCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "focused repair",
      );
      git(
        fixture.repoDir,
        "push",
        "-u",
        "origin",
        "fix/after-empty-bookkeeping",
      );

      const result = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "empty-bookkeeping",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "21",
            taskId: "domain/master-validation-failure/spec.example/empty",
            sourceBranch: "fix/after-empty-bookkeeping",
            sourceCommit,
            targetCommit,
            title: "Focused repair after bookkeeping",
          },
        ],
      });

      git(fixture.repoDir, "fetch", "origin", result.receipt.branch);
      expect(
        git(
          fixture.repoDir,
          "show",
          `origin/${result.receipt.branch}:focused.txt`,
        ),
      ).toBe("repair");
      expect(result.receipt.integratedFixes[0]?.patchIds).toHaveLength(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("rejects a focused PR with no source-bearing commit", () => {
    const fixture = campaignFixture();
    try {
      git(fixture.repoDir, "checkout", "-b", "fix/empty-only");
      git(fixture.repoDir, "commit", "--allow-empty", "-m", "empty only");
      const sourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "-u", "origin", "fix/empty-only");

      expect(() =>
        composeFrozenCampaign({
          appDir: fixture.appDir,
          repoDir: fixture.repoDir,
          baselineRunId: "empty-only",
          baseCommit: fixture.baseCommit,
          fixes: [
            {
              pullRequestId: "22",
              taskId:
                "domain/master-validation-failure/spec.example/empty-only",
              sourceBranch: "fix/empty-only",
              sourceCommit,
              targetCommit: fixture.baseCommit,
              title: "Empty focused PR",
            },
          ],
        }),
      ).toThrow("contains no source-bearing focused commit");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("uses a self-contained replay head for a force-rewritten PR after ordered predecessors", () => {
    const fixture = campaignFixture();
    try {
      writeFileSync(join(fixture.repoDir, "carrier.txt"), "frozen\n");
      git(fixture.repoDir, "add", "carrier.txt");
      git(fixture.repoDir, "commit", "--amend", "--no-edit");
      const frozenCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "--force", "origin", "main");

      const targetCommit = commitFile(
        fixture.repoDir,
        "carrier.txt",
        "modern\n",
        "modernize carrier",
      );
      git(fixture.repoDir, "push", "origin", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/rewritten-replay");
      const firstSourceCommit = commitFile(
        fixture.repoDir,
        "focused.txt",
        "repair\n",
        "first focused repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/rewritten-replay");

      const prior = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "rewritten-replay",
        baseCommit: frozenCommit,
        fixes: [
          {
            pullRequestId: "20",
            taskId:
              "domain/master-validation-failure/spec.example/rewritten-replay",
            sourceBranch: "fix/rewritten-replay",
            sourceCommit: firstSourceCommit,
            targetCommit,
            title: "First focused repair",
          },
        ],
      });

      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/ordered-predecessor",
        frozenCommit,
      );
      writeFileSync(join(fixture.repoDir, "carrier.txt"), "campaign\n");
      writeFileSync(
        join(fixture.repoDir, "predecessor.txt"),
        "ordered predecessor\n",
      );
      git(fixture.repoDir, "add", "carrier.txt", "predecessor.txt");
      git(fixture.repoDir, "commit", "-m", "ordered predecessor");
      const predecessorCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "-u", "origin", "fix/ordered-predecessor");

      git(fixture.repoDir, "checkout", "fix/rewritten-replay");
      git(fixture.repoDir, "reset", "--hard", targetCommit);
      commitFile(
        fixture.repoDir,
        "carrier.txt",
        "campaign\n",
        "prepare campaign carrier shape",
      );
      writeFileSync(join(fixture.repoDir, "carrier.txt"), "campaign\nguard\n");
      writeFileSync(join(fixture.repoDir, "focused.txt"), "repair\n");
      git(fixture.repoDir, "add", "carrier.txt", "focused.txt");
      git(fixture.repoDir, "commit", "-m", "apply complete focused repair");
      const rewrittenSourceCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "--force", "origin", "fix/rewritten-replay");

      const result = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "rewritten-replay",
        baseCommit: frozenCommit,
        fixes: [
          {
            pullRequestId: "10",
            taskId: "domain/master-validation-failure/spec.example/predecessor",
            sourceBranch: "fix/ordered-predecessor",
            sourceCommit: predecessorCommit,
            targetCommit: frozenCommit,
            title: "Ordered predecessor",
          },
          {
            pullRequestId: "20",
            taskId:
              "domain/master-validation-failure/spec.example/rewritten-replay",
            sourceBranch: "fix/rewritten-replay",
            sourceCommit: rewrittenSourceCommit,
            targetCommit,
            title: "Replay-safe rewritten repair",
          },
        ],
        prior: prior.receipt,
      });

      git(fixture.repoDir, "fetch", "origin", result.receipt.branch);
      const campaignRef = `origin/${result.receipt.branch}`;
      expect(git(fixture.repoDir, "show", `${campaignRef}:carrier.txt`)).toBe(
        "campaign\nguard",
      );
      expect(git(fixture.repoDir, "show", `${campaignRef}:focused.txt`)).toBe(
        "repair",
      );
      expect(
        git(fixture.repoDir, "show", `${campaignRef}:predecessor.txt`),
      ).toBe("ordered predecessor");
      expect(result.receipt.integratedFixes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            pullRequestId: "20",
            sourceCommit: rewrittenSourceCommit,
          }),
        ]),
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("uses a self-contained replay head when its preparatory commit conflicts", () => {
    const fixture = campaignFixture();
    try {
      writeFileSync(join(fixture.repoDir, "carrier.txt"), "frozen\n");
      git(fixture.repoDir, "add", "carrier.txt");
      git(fixture.repoDir, "commit", "--amend", "--no-edit");
      const frozenCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "--force", "origin", "main");

      const targetCommit = commitFile(
        fixture.repoDir,
        "carrier.txt",
        "modern\n",
        "modernize carrier",
      );
      git(fixture.repoDir, "push", "origin", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/replay-safe");
      commitFile(
        fixture.repoDir,
        "carrier.txt",
        "frozen\n",
        "prepare frozen carrier shape",
      );
      const sourceCommit = commitFile(
        fixture.repoDir,
        "carrier.txt",
        "modern\nguard\n",
        "apply complete carrier repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/replay-safe");

      const result = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "replay-safe",
        baseCommit: frozenCommit,
        fixes: [
          {
            pullRequestId: "20",
            taskId: "domain/master-validation-failure/spec.example/replay-safe",
            sourceBranch: "fix/replay-safe",
            sourceCommit,
            targetCommit,
            title: "Replay-safe focused fix",
          },
        ],
      });

      git(fixture.repoDir, "fetch", "origin", result.receipt.branch);
      expect(
        git(
          fixture.repoDir,
          "show",
          `origin/${result.receipt.branch}:carrier.txt`,
        ),
      ).toBe("modern\nguard");
      expect(result.receipt.integratedFixes[0]?.patchIds).toHaveLength(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("reports the stable task id when a focused patch conflicts", () => {
    const fixture = campaignFixture();
    try {
      writeFileSync(join(fixture.repoDir, "carrier.txt"), "frozen\n");
      git(fixture.repoDir, "add", "carrier.txt");
      git(fixture.repoDir, "commit", "--amend", "--no-edit");
      const frozenCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "--force", "origin", "main");

      const targetCommit = commitFile(
        fixture.repoDir,
        "carrier.txt",
        "modern\n",
        "modernize carrier",
      );
      git(fixture.repoDir, "push", "origin", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/conflicting");
      const sourceCommit = commitFile(
        fixture.repoDir,
        "carrier.txt",
        "repair\n",
        "focused repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/conflicting");

      expect(() =>
        composeFrozenCampaign({
          appDir: fixture.appDir,
          repoDir: fixture.repoDir,
          baselineRunId: "conflicting",
          baseCommit: frozenCommit,
          fixes: [
            {
              pullRequestId: "23",
              taskId: "domain/master-validation-failure/spec.example/conflict",
              sourceBranch: "fix/conflicting",
              sourceCommit,
              targetCommit,
              title: "Conflicting focused repair",
            },
          ],
        }),
      ).toThrow(
        "Campaign focused-patch conflict for PR 23 (domain/master-validation-failure/spec.example/conflict)",
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("reports candidates composed before a later focused patch conflicts", () => {
    const fixture = campaignFixture();
    try {
      writeFileSync(join(fixture.repoDir, "carrier.txt"), "frozen\n");
      git(fixture.repoDir, "add", "carrier.txt");
      git(fixture.repoDir, "commit", "--amend", "--no-edit");
      const frozenCommit = git(fixture.repoDir, "rev-parse", "HEAD");
      git(fixture.repoDir, "push", "--force", "origin", "main");

      git(fixture.repoDir, "checkout", "-b", "fix/predecessor");
      const predecessorCommit = commitFile(
        fixture.repoDir,
        "predecessor.txt",
        "repair\n",
        "independent predecessor repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/predecessor");

      git(fixture.repoDir, "checkout", "main");
      const targetCommit = commitFile(
        fixture.repoDir,
        "carrier.txt",
        "modern\n",
        "modernize carrier",
      );
      git(fixture.repoDir, "push", "origin", "main");
      git(fixture.repoDir, "checkout", "-b", "fix/conflicting-after-one");
      const conflictingCommit = commitFile(
        fixture.repoDir,
        "carrier.txt",
        "repair\n",
        "focused conflicting repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/conflicting-after-one");

      expect(() =>
        composeFrozenCampaign({
          appDir: fixture.appDir,
          repoDir: fixture.repoDir,
          baselineRunId: "ordered-conflict",
          baseCommit: frozenCommit,
          fixes: [
            {
              pullRequestId: "22",
              taskId:
                "domain/master-validation-failure/spec.example/predecessor",
              sourceBranch: "fix/predecessor",
              sourceCommit: predecessorCommit,
              title: "Independent predecessor repair",
            },
            {
              pullRequestId: "23",
              taskId: "domain/master-validation-failure/spec.example/conflict",
              sourceBranch: "fix/conflicting-after-one",
              sourceCommit: conflictingCommit,
              targetCommit,
              title: "Conflicting focused repair",
            },
          ],
        }),
      ).toThrow(`after composed predecessors ${predecessorCommit}`);
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

  test("composes one canonical patch when different failure tasks publish equivalent repairs", () => {
    const fixture = campaignFixture();
    try {
      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/equivalent-a",
        fixture.baseCommit,
      );
      const firstCommit = commitFile(
        fixture.repoDir,
        "shared.txt",
        "shared repair\n",
        "first task repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/equivalent-a");

      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/equivalent-b",
        fixture.baseCommit,
      );
      const secondCommit = commitFile(
        fixture.repoDir,
        "shared.txt",
        "shared repair\n",
        "second task repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/equivalent-b");

      const result = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "equivalent-cross-task",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "31",
            taskId: "domain/master-validation-failure/spec.example/first",
            sourceBranch: "fix/equivalent-a",
            sourceCommit: firstCommit,
            title: "First equivalent repair",
          },
          {
            pullRequestId: "32",
            taskId: "domain/master-validation-failure/spec.example/second",
            sourceBranch: "fix/equivalent-b",
            sourceCommit: secondCommit,
            title: "Second equivalent repair",
          },
        ],
      });

      expect(result.changed).toBe(true);
      expect(result.receipt.integratedFixes).toEqual([
        expect.objectContaining({
          pullRequestId: "31",
          taskId: "domain/master-validation-failure/spec.example/first",
          sourceCommit: firstCommit,
        }),
      ]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("keeps proven campaign fixes ahead of newly discovered lower-numbered PRs", () => {
    const fixture = campaignFixture();
    try {
      git(
        fixture.repoDir,
        "checkout",
        "-b",
        "fix/new-lower",
        fixture.baseCommit,
      );
      const newLowerCommit = commitFile(
        fixture.repoDir,
        "new-lower.txt",
        "new lower-numbered repair\n",
        "new lower-numbered repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/new-lower");

      git(fixture.repoDir, "checkout", "-b", "fix/proven", fixture.baseCommit);
      const provenCommit = commitFile(
        fixture.repoDir,
        "proven.txt",
        "proven repair\n",
        "proven campaign repair",
      );
      git(fixture.repoDir, "push", "-u", "origin", "fix/proven");

      const result = composeFrozenCampaign({
        appDir: fixture.appDir,
        repoDir: fixture.repoDir,
        baselineRunId: "preferred-order",
        baseCommit: fixture.baseCommit,
        fixes: [
          {
            pullRequestId: "10",
            taskId: "domain/master-validation-failure/spec.new",
            sourceBranch: "fix/new-lower",
            sourceCommit: newLowerCommit,
            title: "New lower-numbered repair",
          },
          {
            pullRequestId: "20",
            taskId: "domain/master-validation-failure/spec.proven",
            sourceBranch: "fix/proven",
            sourceCommit: provenCommit,
            title: "Proven campaign repair",
          },
        ],
        preferredPullRequestIds: ["20"],
      });

      git(fixture.repoDir, "fetch", "origin", result.receipt.branch);
      expect(
        git(
          fixture.repoDir,
          "log",
          "--reverse",
          "--format=%s",
          `${fixture.baseCommit}..origin/${result.receipt.branch}`,
        ).split("\n"),
      ).toEqual(["proven campaign repair", "new lower-numbered repair"]);
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

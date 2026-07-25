import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalizeProjectTaskWorkspace, prepareProjectTaskWorkspace } from "./project-task-workspace.js";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

function fixture(): { root: string; repo: string; worktrees: string } {
  const root = mkdtempSync(join(tmpdir(), "may-task-workspace-"));
  roots.push(root);
  const repo = join(root, "repo");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", "README.md");
  git(repo, "commit", "-m", "base");
  return { root, repo, worktrees: join(root, "worktrees") };
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("project task workspace", () => {
  it("reuses one deterministic worktree for retries of the same task generation", () => {
    const f = fixture();
    const first = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "domain/example",
      generation: 2,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(first.metadata.path, "unfinished.txt"), "recover me\n");

    const retry = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "domain/example",
      generation: 2,
      baseBranch: "dev",
      refreshRemote: false,
      previous: first.metadata,
    });

    expect(retry.metadata.path).toBe(first.metadata.path);
    expect(retry.metadata.branch).toBe(first.metadata.branch);
    expect(finalizeProjectTaskWorkspace(retry, "failed").metadata.disposition).toBe("retained-for-recovery");
  });

  it("returns an interrupted rebase on the exact task branch to the same task", () => {
    const f = fixture();
    const prepared = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "interrupted-rebase",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    git(prepared.metadata.path, "checkout", "--detach");

    expect(() =>
      prepareProjectTaskWorkspace({
        repoDir: f.repo,
        workspaceRoot: f.worktrees,
        taskId: "interrupted-rebase",
        generation: 1,
        baseBranch: "dev",
        refreshRemote: false,
        previous: prepared.metadata,
      }),
    ).toThrow("registered to detached HEAD");

    const rebaseDir = git(prepared.metadata.path, "rev-parse", "--git-path", "rebase-merge");
    mkdirSync(rebaseDir, { recursive: true });
    writeFileSync(join(rebaseDir, "head-name"), `refs/heads/${prepared.metadata.branch}\n`);

    const recovered = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "interrupted-rebase",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
      previous: prepared.metadata,
    });
    expect(recovered.metadata).toMatchObject({
      path: prepared.metadata.path,
      branch: prepared.metadata.branch,
      disposition: "active",
    });
  });

  it("removes a clean no-change worktree and its empty task branch", () => {
    const f = fixture();
    const prepared = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "no-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });

    const finalized = finalizeProjectTaskWorkspace(prepared, "accepted");

    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "removed" } });
    expect(git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");
  });

  it("retains a clean committed branch but refuses task completion before integration", () => {
    const f = fixture();
    const prepared = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "publishable-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(prepared.metadata.path, "change.txt"), "done\n");
    git(prepared.metadata.path, "add", "change.txt");
    git(prepared.metadata.path, "commit", "-m", "change");

    const finalized = finalizeProjectTaskWorkspace(prepared, "accepted");

    expect(finalized).toMatchObject({
      ok: false,
      metadata: { disposition: "branch-retained" },
      reason: expect.stringContaining("must wait for integration"),
    });
    expect(git(f.repo, "branch", "--list", prepared.metadata.branch)).toContain(prepared.metadata.branch);
  });

  it("allows a clean committed branch to remain while the task waits for integration", () => {
    const f = fixture();
    const prepared = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "waiting-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(prepared.metadata.path, "change.txt"), "done\n");
    git(prepared.metadata.path, "add", "change.txt");
    git(prepared.metadata.path, "commit", "-m", "change");

    const finalized = finalizeProjectTaskWorkspace(prepared, "waiting");

    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "branch-retained" } });
    expect(git(f.repo, "branch", "--list", prepared.metadata.branch)).toContain(prepared.metadata.branch);
  });

  it("restores a cleaned waiting branch from origin instead of a newer base head", () => {
    const f = fixture();
    const remote = join(f.root, "remote.git");
    execFileSync("git", ["init", "--bare", remote]);
    git(f.repo, "remote", "add", "origin", remote);
    git(f.repo, "push", "-u", "origin", "dev");

    const prepared = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "waiting-live-proof",
      generation: 1,
      baseBranch: "dev",
    });
    const testedCommit = prepared.metadata.headCommit;
    git(prepared.metadata.path, "push", "-u", "origin", prepared.metadata.branch);

    const finalized = finalizeProjectTaskWorkspace(prepared, "waiting");
    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "removed" } });
    expect(git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");

    writeFileSync(join(f.repo, "advanced.txt"), "new base\n");
    git(f.repo, "add", "advanced.txt");
    git(f.repo, "commit", "-m", "advance dev");
    git(f.repo, "push", "origin", "dev");
    const advancedBase = git(f.repo, "rev-parse", "HEAD");

    const retry = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "waiting-live-proof",
      generation: 1,
      baseBranch: "dev",
      previous: finalized.metadata,
    });

    expect(retry.metadata.headCommit).toBe(testedCommit);
    expect(retry.metadata.headCommit).not.toBe(advancedBase);
  });

  it("removes the task branch after its commit reaches the base branch", () => {
    const f = fixture();
    const prepared = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "integrated-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(prepared.metadata.path, "change.txt"), "done\n");
    git(prepared.metadata.path, "add", "change.txt");
    git(prepared.metadata.path, "commit", "-m", "change");
    git(f.repo, "merge", "--ff-only", prepared.metadata.branch);

    const finalized = finalizeProjectTaskWorkspace(prepared, "accepted");

    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "removed" } });
    expect(git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");
  });

  it("refuses to close accepted work that still has uncommitted files", () => {
    const f = fixture();
    const prepared = prepareProjectTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "dirty-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(prepared.metadata.path, "dirty.txt"), "not committed\n");

    const finalized = finalizeProjectTaskWorkspace(prepared, "accepted");

    expect(finalized).toMatchObject({ ok: false, metadata: { disposition: "retained-for-recovery" } });
  });
});

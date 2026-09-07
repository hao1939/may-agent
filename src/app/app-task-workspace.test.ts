import { afterEach, describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { finalizeAppTaskWorkspace, prepareAppTaskWorkspace } from "./app-task-workspace.js";

const roots: string[] = [];
const execGit = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  // Fixture commands are local and small. Keep them bounded and leave the
  // event loop available so a stuck Git process cannot defeat Bun's timeout.
  const { stdout } = await execGit("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    timeout: 10_000,
    killSignal: "SIGKILL",
  });
  return stdout.trim();
}

async function fixture(): Promise<{ root: string; repo: string; worktrees: string }> {
  const root = mkdtempSync(join(tmpdir(), "may-task-workspace-"));
  roots.push(root);
  const repo = join(root, "repo");
  await git(root, "init", "-b", "dev", repo);
  await git(repo, "config", "user.email", "test@example.com");
  await git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  await git(repo, "add", "README.md");
  await git(repo, "commit", "-m", "base");
  return { root, repo, worktrees: join(root, "worktrees") };
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("project task workspace", () => {
  it("keeps the event loop available while Git prepares the worktree", async () => {
    const f = await fixture();
    let controlTurnObserved = false;
    setTimeout(() => {
      controlTurnObserved = true;
    }, 0);

    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "nonblocking-prepare",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });

    expect(controlTurnObserved).toBe(true);
    await finalizeAppTaskWorkspace(prepared, "failed");
  });

  it("reuses one deterministic worktree for retries of the same task generation", async () => {
    const f = await fixture();
    const first = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "domain/example",
      generation: 2,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(first.metadata.path, "unfinished.txt"), "recover me\n");

    const retry = await prepareAppTaskWorkspace({
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
    expect((await finalizeAppTaskWorkspace(retry, "failed")).metadata.disposition).toBe("retained-for-recovery");
  });

  it("returns an interrupted rebase on the exact task branch to the same task", async () => {
    const f = await fixture();
    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "interrupted-rebase",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    await git(prepared.metadata.path, "checkout", "--detach");

    await expect(
      prepareAppTaskWorkspace({
        repoDir: f.repo,
        workspaceRoot: f.worktrees,
        taskId: "interrupted-rebase",
        generation: 1,
        baseBranch: "dev",
        refreshRemote: false,
        previous: prepared.metadata,
      }),
    ).rejects.toThrow("registered to detached HEAD");

    const rebaseDir = await git(prepared.metadata.path, "rev-parse", "--git-path", "rebase-merge");
    mkdirSync(rebaseDir, { recursive: true });
    writeFileSync(join(rebaseDir, "head-name"), `refs/heads/${prepared.metadata.branch}\n`);

    const recovered = await prepareAppTaskWorkspace({
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

  it("removes a clean no-change worktree and its empty task branch", async () => {
    const f = await fixture();
    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "no-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });

    const finalized = await finalizeAppTaskWorkspace(prepared, "accepted");

    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "removed" } });
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");
  });

  it("retains a clean committed branch but refuses task completion before integration", async () => {
    const f = await fixture();
    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "publishable-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(prepared.metadata.path, "change.txt"), "done\n");
    await git(prepared.metadata.path, "add", "change.txt");
    await git(prepared.metadata.path, "commit", "-m", "change");

    const finalized = await finalizeAppTaskWorkspace(prepared, "accepted");

    expect(finalized).toMatchObject({
      ok: false,
      metadata: { disposition: "branch-retained" },
      reason: expect.stringContaining("must wait for integration"),
    });
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toContain(prepared.metadata.branch);
  });

  it("allows a clean committed branch to remain while the task waits for integration", async () => {
    const f = await fixture();
    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "waiting-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(prepared.metadata.path, "change.txt"), "done\n");
    await git(prepared.metadata.path, "add", "change.txt");
    await git(prepared.metadata.path, "commit", "-m", "change");

    const finalized = await finalizeAppTaskWorkspace(prepared, "waiting");

    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "branch-retained" } });
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toContain(prepared.metadata.branch);
  });

  it("restores a cleaned waiting branch from origin instead of a newer base head", async () => {
    const f = await fixture();
    const remote = join(f.root, "remote.git");
    await git(f.root, "init", "--bare", remote);
    await git(f.repo, "remote", "add", "origin", remote);
    await git(f.repo, "push", "-u", "origin", "dev");

    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "waiting-live-proof",
      generation: 1,
      baseBranch: "dev",
    });
    const testedCommit = prepared.metadata.headCommit;
    await git(prepared.metadata.path, "push", "-u", "origin", prepared.metadata.branch);

    const finalized = await finalizeAppTaskWorkspace(prepared, "waiting");
    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "removed" } });
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");

    writeFileSync(join(f.repo, "advanced.txt"), "new base\n");
    await git(f.repo, "add", "advanced.txt");
    await git(f.repo, "commit", "-m", "advance dev");
    await git(f.repo, "push", "origin", "dev");
    const advancedBase = await git(f.repo, "rev-parse", "HEAD");

    const retry = await prepareAppTaskWorkspace({
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

  it("removes the task branch after its commit reaches the base branch", async () => {
    const f = await fixture();
    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "integrated-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(prepared.metadata.path, "change.txt"), "done\n");
    await git(prepared.metadata.path, "add", "change.txt");
    await git(prepared.metadata.path, "commit", "-m", "change");
    await git(f.repo, "merge", "--ff-only", prepared.metadata.branch);

    const finalized = await finalizeAppTaskWorkspace(prepared, "accepted");

    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "removed" } });
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");
  });

  it("refuses to close accepted work that still has uncommitted files", async () => {
    const f = await fixture();
    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "dirty-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    writeFileSync(join(prepared.metadata.path, "dirty.txt"), "not committed\n");

    const finalized = await finalizeAppTaskWorkspace(prepared, "accepted");

    expect(finalized).toMatchObject({ ok: false, metadata: { disposition: "retained-for-recovery" } });
  });

  for (const retained of [false, true]) {
    it(`recognizes a squash-integrated branch after unrelated target changes (retained=${retained})`, async () => {
      const f = await fixture();
      const prepared = await prepareAppTaskWorkspace({
        repoDir: f.repo,
        workspaceRoot: f.worktrees,
        taskId: "squash-integrated",
        generation: 1,
        baseBranch: "dev",
        refreshRemote: false,
      });
      for (const value of ["first", "final"]) {
        writeFileSync(join(prepared.metadata.path, "change.txt"), `${value}\n`);
        await git(prepared.metadata.path, "add", "change.txt");
        await git(prepared.metadata.path, "commit", "-m", value);
      }
      if (retained) await finalizeAppTaskWorkspace(prepared, "waiting");
      await git(f.repo, "merge", "--squash", prepared.metadata.branch);
      await git(f.repo, "commit", "-m", "human squash merge");
      writeFileSync(join(f.repo, "unrelated.txt"), "later work\n");
      await git(f.repo, "add", "unrelated.txt");
      await git(f.repo, "commit", "-m", "later unrelated change");
      const target = await git(f.repo, "rev-parse", "HEAD");

      const finalized = await finalizeAppTaskWorkspace(prepared, "accepted");

      expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "removed" } });
      expect(await git(f.repo, "rev-parse", "HEAD")).toBe(target);
      expect(await git(f.repo, "status", "--porcelain")).toBe("");
      expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");
    });
  }

  it("retains conflicting branches instead of inferring squash integration", async () => {
    const f = await fixture();
    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo,
      workspaceRoot: f.worktrees,
      taskId: "conflicting-change",
      generation: 1,
      baseBranch: "dev",
      refreshRemote: false,
    });
    for (const [cwd, content] of [[prepared.metadata.path, "task"], [f.repo, "target"]]) {
      writeFileSync(join(cwd!, "README.md"), `${content}\n`);
      await git(cwd!, "add", "README.md");
      await git(cwd!, "commit", "-m", content!);
    }
    const target = await git(f.repo, "rev-parse", "HEAD");
    const finalized = await finalizeAppTaskWorkspace(prepared, "accepted");
    expect(finalized).toMatchObject({ ok: false, metadata: { disposition: "branch-retained" } });
    expect(await git(f.repo, "rev-parse", "HEAD")).toBe(target);
    expect(await git(f.repo, "status", "--porcelain")).toBe("");
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toContain(prepared.metadata.branch);
  });
});

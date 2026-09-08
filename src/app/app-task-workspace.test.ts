import { afterEach, describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
  it("fetches an exact base without competing with worker remote-tracking refs or FETCH_HEAD", async () => {
    const f = await fixture();
    const remote = join(f.root, "remote.git");
    await git(f.root, "init", "--bare", remote);
    await git(f.repo, "remote", "add", "origin", remote);
    await git(f.repo, "push", "-u", "origin", "dev");
    const original = await git(f.repo, "rev-parse", "origin/dev");
    const writer = join(f.root, "writer");
    await git(f.root, "clone", "--branch", "dev", remote, writer);
    await git(writer, "config", "user.email", "test@example.com");
    await git(writer, "config", "user.name", "Test");
    writeFileSync(join(writer, "advanced.txt"), "new remote base\n");
    await git(writer, "add", "advanced.txt");
    await git(writer, "commit", "-m", "advance remote independently");
    await git(writer, "push", "origin", "dev");
    const current = await git(writer, "rev-parse", "HEAD");

    // A separate worker owns these shared Git files. Host preparation must
    // neither wait for them nor delete/rewrite them to recover from contention.
    const trackingLock = join(f.repo, ".git/refs/remotes/origin/dev.lock");
    const fetchHead = join(f.repo, ".git/FETCH_HEAD");
    writeFileSync(trackingLock, "owned by worker\n");
    writeFileSync(fetchHead, "worker fetch result\n");
    const prepared = await prepareAppTaskWorkspace({
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "independent-fetch", generation: 1, baseBranch: "dev",
    });
    expect(prepared.metadata.baseCommit).toBe(current);
    expect(prepared.metadata.headCommit).toBe(current);
    expect(await git(f.repo, "rev-parse", prepared.metadata.baseRef)).toBe(current);
    expect(await git(f.repo, "rev-parse", "origin/dev")).toBe(original);
    expect(await git(f.repo, "rev-parse", "HEAD")).toBe(original);
    expect(readFileSync(trackingLock, "utf8")).toBe("owned by worker\n");
    expect(readFileSync(fetchHead, "utf8")).toBe("worker fetch result\n");
    expect((await finalizeAppTaskWorkspace(prepared, "accepted")).ok).toBe(true);
    expect(await git(f.repo, "for-each-ref", "--format=%(refname)", "refs/may/workspaces/")).toBe("");
    expect(readFileSync(trackingLock, "utf8")).toBe("owned by worker\n");
    expect(readFileSync(fetchHead, "utf8")).toBe("worker fetch result\n");
  });

  it("does not restore stale fetch refs when origin confirms the Task branch is absent", async () => {
    const f = await fixture();
    const remote = join(f.root, "remote.git");
    await git(f.root, "init", "--bare", remote);
    await git(f.repo, "remote", "add", "origin", remote);
    await git(f.repo, "push", "-u", "origin", "dev");
    const input = {
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "deleted-remote", generation: 1, baseBranch: "dev",
    };
    const prepared = await prepareAppTaskWorkspace(input);
    const oldHead = prepared.metadata.headCommit;
    await git(prepared.metadata.path, "push", "-u", "origin", prepared.metadata.branch);
    expect((await finalizeAppTaskWorkspace(prepared, "accepted")).ok).toBe(true);

    // Remote deletion need not prune the worker's tracking ref or an old
    // private fetch snapshot. Neither proves that the branch still exists.
    await git(remote, "update-ref", "-d", `refs/heads/${prepared.metadata.branch}`);
    const privateHead = prepared.metadata.baseRef.replace(/\/base$/, "/head");
    await git(f.repo, "update-ref", privateHead, oldHead);
    writeFileSync(join(f.repo, "advanced.txt"), "new base\n");
    await git(f.repo, "add", "advanced.txt");
    await git(f.repo, "commit", "-m", "advance dev");
    await git(f.repo, "push", "origin", "dev");
    const current = await git(f.repo, "rev-parse", "HEAD");

    const restored = await prepareAppTaskWorkspace(input);
    expect(restored.metadata.headCommit).toBe(current);
    expect(restored.metadata.headCommit).not.toBe(oldHead);
    expect(await git(f.repo, "rev-parse", `origin/${prepared.metadata.branch}`)).toBe(oldHead);
    expect(await git(f.repo, "rev-parse", privateHead)).toBe(oldHead);
  });

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

  it("isolates fetched base snapshots across Tasks and preserves unfinished work when refreshing", async () => {
    const f = await fixture();
    const remote = join(f.root, "remote.git");
    await git(f.root, "init", "--bare", remote);
    await git(f.repo, "remote", "add", "origin", remote);
    await git(f.repo, "push", "-u", "origin", "dev");
    const first = await prepareAppTaskWorkspace({
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "first-fetch", generation: 1, baseBranch: "dev",
    });
    writeFileSync(join(first.metadata.path, "unfinished.txt"), "retain this repair\n");
    writeFileSync(join(f.repo, "advanced.txt"), "new target\n");
    await git(f.repo, "add", "advanced.txt");
    await git(f.repo, "commit", "-m", "advance remote");
    await git(f.repo, "push", "origin", "dev");
    const current = await git(f.repo, "rev-parse", "HEAD");
    const second = await prepareAppTaskWorkspace({
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "second-fetch", generation: 1, baseBranch: "dev",
    });
    expect(second.metadata.baseRef).not.toBe(first.metadata.baseRef);
    expect(await git(f.repo, "rev-parse", first.metadata.baseRef)).toBe(first.metadata.baseCommit);
    expect(second.metadata.headCommit).toBe(current);
    const resumed = await prepareAppTaskWorkspace({
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "first-fetch", generation: 1, baseBranch: "dev",
      previous: first.metadata,
    });
    expect(resumed.metadata.path).toBe(first.metadata.path);
    expect(resumed.metadata.headCommit).toBe(first.metadata.headCommit);
    expect(resumed.metadata.baseCommit).toBe(first.metadata.baseCommit);
    expect(await git(f.repo, "rev-parse", resumed.metadata.baseRef)).toBe(current);
    expect(readFileSync(join(resumed.metadata.path, "unfinished.txt"), "utf8")).toBe("retain this repair\n");
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

  it("retains the checkout and ignored dependencies across repeated waits on the same generation", async () => {
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
    writeFileSync(join(prepared.metadata.path, ".gitignore"), "node_modules/\n");
    await git(prepared.metadata.path, "add", "change.txt", ".gitignore");
    await git(prepared.metadata.path, "commit", "-m", "change");
    const dependencies = join(prepared.metadata.path, "node_modules");
    mkdirSync(dependencies);
    writeFileSync(join(dependencies, "installed"), "keep the verified toolchain\n");

    const finalized = await finalizeAppTaskWorkspace(prepared, "waiting");

    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "active" } });
    expect(existsSync(prepared.metadata.path)).toBe(true);
    const resumed = await prepareAppTaskWorkspace({
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "waiting-change", generation: 1,
      baseBranch: "dev", refreshRemote: false, previous: finalized.metadata,
    });
    expect(resumed.metadata.headCommit).toBe(finalized.metadata.headCommit);
    expect(readFileSync(join(dependencies, "installed"), "utf8")).toBe("keep the verified toolchain\n");
    expect((await finalizeAppTaskWorkspace(resumed, "waiting")).ok).toBe(true);
    expect(existsSync(dependencies)).toBe(true);
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toContain(prepared.metadata.branch);
    await git(f.repo, "merge", "--ff-only", prepared.metadata.branch);
    expect((await finalizeAppTaskWorkspace(resumed, "accepted")).metadata.disposition).toBe("removed");
    expect(existsSync(prepared.metadata.path)).toBe(false);
  });

  it("restores a legacy cleaned waiting branch from origin instead of a newer base head", async () => {
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

    // Older Hosts cleaned even a waiting checkout. Preserve recovery from that
    // shape without making today's waiting finalizer delete unfinished work.
    const finalized = await finalizeAppTaskWorkspace(prepared, "accepted");
    expect(finalized).toMatchObject({ ok: true, metadata: { disposition: "removed" } });
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");

    writeFileSync(join(f.repo, "advanced.txt"), "new base\n");
    await git(f.repo, "add", "advanced.txt");
    await git(f.repo, "commit", "-m", "advance dev");
    await git(f.repo, "push", "origin", "dev");
    const advancedBase = await git(f.repo, "rev-parse", "HEAD");
    const remoteTaskRef = `refs/remotes/origin/${prepared.metadata.branch}`;
    await git(f.repo, "update-ref", "-d", remoteTaskRef);
    const remoteTaskLock = join(f.repo, `.git/refs/remotes/origin/${prepared.metadata.branch}.lock`);
    mkdirSync(dirname(remoteTaskLock), { recursive: true });
    writeFileSync(remoteTaskLock, "worker task-branch fetch\n");

    // A failed private fetch must not masquerade as an absent published branch
    // and recreate the checkout at the newer base. Only the fixture owns this lock.
    const privateHeadLock = join(f.repo, `.git/${prepared.metadata.baseRef.replace(/\/base$/, "/head")}.lock`);
    mkdirSync(dirname(privateHeadLock), { recursive: true });
    writeFileSync(privateHeadLock, "another Host fetch\n");
    await expect(prepareAppTaskWorkspace({
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "waiting-live-proof", generation: 1,
      baseBranch: "dev", previous: finalized.metadata,
    })).rejects.toThrow("cannot lock ref");
    expect(existsSync(prepared.metadata.path)).toBe(false);
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");
    expect(readFileSync(privateHeadLock, "utf8")).toBe("another Host fetch\n");
    rmSync(privateHeadLock);

    const configLock = join(f.repo, ".git/config.lock");
    writeFileSync(configLock, "another worker configuring Git\n");
    await expect(prepareAppTaskWorkspace({
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "waiting-live-proof", generation: 1,
      baseBranch: "dev", previous: finalized.metadata,
    })).rejects.toThrow("could not lock config file");
    expect(existsSync(prepared.metadata.path)).toBe(false);
    expect(await git(f.repo, "branch", "--list", prepared.metadata.branch)).toBe("");
    rmSync(configLock);

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
    expect(readFileSync(remoteTaskLock, "utf8")).toBe("worker task-branch fetch\n");
    expect(await git(f.repo, "for-each-ref", "--format=%(refname)", remoteTaskRef)).toBe("");
    expect(await git(retry.metadata.path, "config", `branch.${retry.metadata.branch}.remote`)).toBe("origin");
    expect(await git(retry.metadata.path, "config", `branch.${retry.metadata.branch}.merge`)).toBe(
      `refs/heads/${retry.metadata.branch}`,
    );
    // Only the fixture releases its own lock. Ordinary recovery commands
    // must then work without another manual upstream setup step.
    rmSync(remoteTaskLock);
    await git(retry.metadata.path, "pull", "--ff-only");
    await git(retry.metadata.path, "push", "--dry-run");
  });

  for (const retainedState of ["worktree", "branch-only", "removed"] as const) {
    it(`cleans only the finalized generation's private refs (${retainedState})`, async () => {
      const f = await fixture();
      const remote = join(f.root, "remote.git");
      await git(f.root, "init", "--bare", remote);
      await git(f.repo, "remote", "add", "origin", remote);
      await git(f.repo, "push", "-u", "origin", "dev");
      const input = {
        repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "generation-cleanup", generation: 1, baseBranch: "dev",
      };
      const first = await prepareAppTaskWorkspace(input);
      await git(first.metadata.path, "push", "-u", "origin", first.metadata.branch);
      const previous = await prepareAppTaskWorkspace({ ...input, previous: first.metadata });
      const headRef = previous.metadata.baseRef.replace(/\/base$/, "/head");
      expect(await git(f.repo, "rev-parse", headRef)).toBe(previous.metadata.headCommit);
      const current = await prepareAppTaskWorkspace({ ...input, generation: 2 });
      if (retainedState !== "worktree") await git(f.repo, "worktree", "remove", previous.metadata.path);
      if (retainedState === "removed") await git(f.repo, "branch", "-D", previous.metadata.branch);

      expect(await finalizeAppTaskWorkspace(previous, "accepted")).toMatchObject({
        ok: true, metadata: { disposition: "removed" },
      });
      expect(await git(f.repo, "for-each-ref", "--format=%(refname)", "refs/may/workspaces/")).toBe(
        current.metadata.baseRef,
      );
      expect(await git(f.repo, "rev-parse", current.metadata.baseRef)).toBe(current.metadata.baseCommit);
      expect(existsSync(current.metadata.path)).toBe(true);
      expect(await git(f.repo, "rev-parse", `origin/${previous.metadata.branch}`)).toBe(previous.metadata.headCommit);
      // Cleanup can be repeated after a crash between Git cleanup and state persistence.
      expect((await finalizeAppTaskWorkspace(previous, "accepted")).ok).toBe(true);
    });
  }

  it("retains private refs for waiting, failed and unintegrated work until explicitly removed", async () => {
    const f = await fixture();
    const remote = join(f.root, "remote.git");
    await git(f.root, "init", "--bare", remote);
    await git(f.repo, "remote", "add", "origin", remote);
    await git(f.repo, "push", "-u", "origin", "dev");
    const input = {
      repoDir: f.repo, workspaceRoot: f.worktrees, taskId: "retained-refs", generation: 1, baseBranch: "dev",
    };
    const first = await prepareAppTaskWorkspace(input);
    writeFileSync(join(first.metadata.path, "change.txt"), "unfinished change\n");
    await git(first.metadata.path, "add", "change.txt");
    await git(first.metadata.path, "commit", "-m", "unintegrated work");
    await git(first.metadata.path, "push", "-u", "origin", first.metadata.branch);
    const prepared = await prepareAppTaskWorkspace({ ...input, previous: first.metadata });
    const refs = await git(f.repo, "for-each-ref", "--format=%(refname) %(objectname)", "refs/may/workspaces/");
    expect(refs.split("\n")).toHaveLength(2);
    const dirtyFile = join(prepared.metadata.path, "dirty.txt");
    writeFileSync(dirtyFile, "preserve recovery evidence\n");
    expect(await finalizeAppTaskWorkspace(prepared, "failed")).toMatchObject({
      ok: true, metadata: { disposition: "retained-for-recovery" },
    });
    expect(await git(f.repo, "for-each-ref", "--format=%(refname) %(objectname)", "refs/may/workspaces/")).toBe(refs);
    rmSync(dirtyFile);
    for (const outcome of ["waiting", "failed", "accepted"] as const) {
      const finalized = await finalizeAppTaskWorkspace(prepared, outcome);
      expect(finalized.ok).toBe(outcome !== "accepted");
      expect(await git(f.repo, "for-each-ref", "--format=%(refname) %(objectname)", "refs/may/workspaces/")).toBe(refs);
    }
    // The rejected branch is intentionally removed by its owner, not inferred
    // to be disposable merely because a newer generation or a failure exists.
    await git(f.repo, "branch", "-D", prepared.metadata.branch);
    expect((await finalizeAppTaskWorkspace(prepared, "accepted")).ok).toBe(true);
    expect(await git(f.repo, "for-each-ref", "--format=%(refname)", "refs/may/workspaces/")).toBe("");
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

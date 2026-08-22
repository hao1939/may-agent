import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { originDevSnapshotLeaseFile } from "../agents/app-ops/workflows/lib/origin-dev-snapshot.js";
import { observeWorkspaceIntegrity } from "./workspace-integrity.js";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("workspace integrity watcher", () => {
  it("reports canonical health and unowned dirty worktrees without changing them", async () => {
    const root = mkdtempSync(join(tmpdir(), "aks-workspace-integrity-"));
    roots.push(root);
    const repoDir = join(root, "sample");
    const recovery = join(root, "recovery");
    execFileSync("git", ["init", "-b", "dev", repoDir]);
    git(repoDir, "config", "user.email", "test@example.com");
    git(repoDir, "config", "user.name", "Test");
    writeFileSync(join(repoDir, "README.md"), "base\n");
    git(repoDir, "add", "README.md");
    git(repoDir, "commit", "-m", "base");
    git(repoDir, "update-ref", "refs/remotes/origin/dev", "HEAD");
    git(repoDir, "worktree", "add", "-b", "recovery/example", recovery, "HEAD");
    writeFileSync(join(recovery, "unfinished.txt"), "recover\n");

    const observation = await observeWorkspaceIntegrity(repoDir);

    expect(observation.canonical).toMatchObject({
      branch: "dev",
      clean: true,
      healthy: true,
    });
    expect(observation.counts).toMatchObject({
      worktrees: 2,
      dirty: 1,
      unownedDirty: 1,
    });
    expect(observation.counts).not.toHaveProperty("workspaceBytes");
    expect(observation.anomalies).toContainEqual({
      path: recovery,
      kind: "unowned-dirty",
    });
  });

  it("preserves a live leased snapshot without masking unrelated dirt", async () => {
    const root = mkdtempSync(join(tmpdir(), "aks-workspace-integrity-lease-"));
    roots.push(root);
    const repoDir = join(root, "sample");
    const snapshot = join(root, "snapshot");
    const unrelated = join(root, "unrelated");
    execFileSync("git", ["init", "-b", "dev", repoDir]);
    git(repoDir, "config", "user.email", "test@example.com");
    git(repoDir, "config", "user.name", "Test");
    writeFileSync(join(repoDir, "README.md"), "base\n");
    git(repoDir, "add", "README.md");
    git(repoDir, "commit", "-m", "base");
    git(repoDir, "update-ref", "refs/remotes/origin/dev", "HEAD");
    git(repoDir, "worktree", "add", "--detach", snapshot, "HEAD");
    git(
      repoDir,
      "worktree",
      "add",
      "-b",
      "recovery/unrelated",
      unrelated,
      "HEAD",
    );
    writeFileSync(join(snapshot, "README.md"), "live evidence\n");
    writeFileSync(join(unrelated, "unfinished.txt"), "recover\n");
    const gitDir = resolve(
      snapshot,
      readFileSync(join(snapshot, ".git"), "utf8")
        .trim()
        .slice("gitdir: ".length),
    );
    writeFileSync(
      join(gitDir, originDevSnapshotLeaseFile),
      `${JSON.stringify({
        kind: "aks-origin-dev-snapshot",
        path: snapshot,
        pid: process.pid,
        createdAt: new Date().toISOString(),
      })}\n`,
    );

    const observation = await observeWorkspaceIntegrity(repoDir);

    expect(observation.counts).toMatchObject({ dirty: 2, unownedDirty: 1 });
    expect(observation.anomalies).not.toContainEqual({
      path: snapshot,
      kind: "unowned-dirty",
    });
    expect(observation.anomalies).toContainEqual({
      path: unrelated,
      kind: "unowned-dirty",
    });
  });

  it("does not classify runtime-owned task worktrees as unowned", async () => {
    const root = mkdtempSync(
      join(tmpdir(), "aks-workspace-integrity-claimed-"),
    );
    roots.push(root);
    const repoDir = join(root, "sample");
    const recovery = join(root, "recovery");
    execFileSync("git", ["init", "-b", "dev", repoDir]);
    git(repoDir, "config", "user.email", "test@example.com");
    git(repoDir, "config", "user.name", "Test");
    writeFileSync(join(repoDir, "README.md"), "base\n");
    git(repoDir, "add", "README.md");
    git(repoDir, "commit", "-m", "base");
    git(repoDir, "update-ref", "refs/remotes/origin/dev", "HEAD");
    git(repoDir, "worktree", "add", "-b", "task/example", recovery, "HEAD");
    writeFileSync(join(recovery, "unfinished.txt"), "recover\n");

    const observation = await observeWorkspaceIntegrity(repoDir);

    expect(observation.counts).toMatchObject({
      worktrees: 2,
      dirty: 1,
      taskWorktrees: 1,
      unownedDirty: 0,
    });
    expect(observation.anomalies).not.toContainEqual({
      path: recovery,
      kind: "unowned-dirty",
    });
  });
});

import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    const appDir = join(root, "sample.app");
    const repoDir = join(root, "sample");
    const recovery = join(root, "recovery");
    mkdirSync(join(appDir, ".state/tasks"), { recursive: true });
    writeFileSync(
      join(appDir, ".state/tasks/state.json"),
      JSON.stringify({ attempts: {} }),
    );
    execFileSync("git", ["init", "-b", "dev", repoDir]);
    git(repoDir, "config", "user.email", "test@example.com");
    git(repoDir, "config", "user.name", "Test");
    writeFileSync(join(repoDir, "README.md"), "base\n");
    git(repoDir, "add", "README.md");
    git(repoDir, "commit", "-m", "base");
    git(repoDir, "update-ref", "refs/remotes/origin/dev", "HEAD");
    git(repoDir, "worktree", "add", "-b", "task/example", recovery, "HEAD");
    writeFileSync(join(recovery, "unfinished.txt"), "recover\n");

    const observation = await observeWorkspaceIntegrity(appDir, repoDir);

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
    expect(observation.anomalies).toContainEqual({
      path: recovery,
      kind: "unowned-dirty",
    });
  });

  it("does not reraise dirty worktrees already claimed by live task workspacePath", async () => {
    const root = mkdtempSync(
      join(tmpdir(), "aks-workspace-integrity-claimed-"),
    );
    roots.push(root);
    const appDir = join(root, "sample.app");
    const repoDir = join(root, "sample");
    const recovery = join(root, "recovery");
    const taskId = "ops/reconcile-demo-retained-worktree";
    mkdirSync(join(appDir, ".state/tasks"), { recursive: true });
    writeFileSync(
      join(appDir, ".state/tasks/state.json"),
      JSON.stringify({ attempts: {} }),
    );
    writeFileSync(
      join(appDir, ".state/tasks/tree.json"),
      JSON.stringify(
        {
          root_task_id: "project",
          tasks: {
            project: { id: "project", children: [taskId] },
            [taskId]: {
              id: taskId,
              generation: 1,
              phase: "waiting",
              input: {
                workspacePath: recovery,
              },
            },
          },
        },
        null,
        2,
      ),
    );
    execFileSync("git", ["init", "-b", "dev", repoDir]);
    git(repoDir, "config", "user.email", "test@example.com");
    git(repoDir, "config", "user.name", "Test");
    writeFileSync(join(repoDir, "README.md"), "base\n");
    git(repoDir, "add", "README.md");
    git(repoDir, "commit", "-m", "base");
    git(repoDir, "update-ref", "refs/remotes/origin/dev", "HEAD");
    git(repoDir, "worktree", "add", "-b", "task/example", recovery, "HEAD");
    writeFileSync(join(recovery, "unfinished.txt"), "recover\n");

    const observation = await observeWorkspaceIntegrity(appDir, repoDir);

    expect(observation.counts).toMatchObject({
      worktrees: 2,
      dirty: 1,
      unownedDirty: 0,
    });
    expect(observation.anomalies).not.toContainEqual({
      path: recovery,
      kind: "unowned-dirty",
    });
  });
});

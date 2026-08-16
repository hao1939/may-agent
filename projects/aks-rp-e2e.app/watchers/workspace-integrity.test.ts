import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  observeWorkspaceIntegrity,
  observeWorkspaceIntegrityChanges,
} from "./workspace-integrity.js";

const roots: string[] = [];
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}
function fixture(branch: string) {
  const root = mkdtempSync(join(tmpdir(), "aks-workspace-integrity-"));
  roots.push(root);
  const repoDir = join(root, "sample");
  const worktree = join(root, "recovery");
  const taskProjectionPath = join(root, "task-tree.json");
  execFileSync("git", ["init", "-b", "dev", repoDir]);
  git(repoDir, "config", "user.email", "test@example.com");
  git(repoDir, "config", "user.name", "Test");
  writeFileSync(join(repoDir, "README.md"), "base\n");
  git(repoDir, "add", "README.md");
  git(repoDir, "commit", "-m", "base");
  git(repoDir, "update-ref", "refs/remotes/origin/dev", "HEAD");
  git(repoDir, "worktree", "add", "-b", branch, worktree, "HEAD");
  writeFileSync(join(worktree, "unfinished.txt"), "recover\n");
  return { repoDir, taskProjectionPath, worktree };
}
function writeProjection(
  path: string,
  phase: string,
  workspacePath: string,
  extraInput: Record<string, unknown> = {},
) {
  writeFileSync(
    path,
    JSON.stringify({
      tasks: {
        finalizer: {
          item_type: "task",
          id: "finalizer",
          phase,
          input: { workspacePath, ...extraInput },
        },
      },
    }),
  );
}
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("workspace integrity watcher", () => {
  it("reports canonical health and genuinely unclaimed dirty worktrees", async () => {
    const f = fixture("recovery/example");
    const observation = await observeWorkspaceIntegrity(f.repoDir);
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
      path: f.worktree,
      kind: "unowned-dirty",
    });
  });
  it("recognizes an exact live task input claim on a dirty non-task worktree", async () => {
    const f = fixture("recovery/example");
    writeProjection(f.taskProjectionPath, "waiting", f.worktree);
    const observation = await observeWorkspaceIntegrity(
      f.repoDir,
      f.taskProjectionPath,
    );
    expect(observation.counts).toMatchObject({
      dirty: 1,
      taskWorktrees: 1,
      unownedDirty: 0,
    });
    expect(observation.anomalies).not.toContainEqual({
      path: f.worktree,
      kind: "unowned-dirty",
    });
  });
  it("ignores completed claims and prose-only path mentions", async () => {
    const f = fixture("recovery/example");
    writeProjection(f.taskProjectionPath, "completed", f.worktree, {
      note: `old workspace was ${f.worktree}`,
    });
    const observation = await observeWorkspaceIntegrity(
      f.repoDir,
      f.taskProjectionPath,
    );
    expect(observation.counts.unownedDirty).toBe(1);
  });
  it("does not let an unrelated exact path claim hide a dirty worktree", async () => {
    const f = fixture("recovery/example");
    writeProjection(f.taskProjectionPath, "running", `${f.worktree}-other`);
    const observation = await observeWorkspaceIntegrity(
      f.repoDir,
      f.taskProjectionPath,
    );
    expect(observation.counts.unownedDirty).toBe(1);
  });
  it("preserves refs/heads/task ownership for dirty task worktrees", async () => {
    const f = fixture("task/example");
    const observation = await observeWorkspaceIntegrity(f.repoDir);
    expect(observation.counts).toMatchObject({
      worktrees: 2,
      dirty: 1,
      taskWorktrees: 1,
      unownedDirty: 0,
    });
  });
  it("uses the canonical task projection through the scheduled observer boundary", async () => {
    const f = fixture("recovery/example");
    const appDir = join(resolve(f.repoDir, ".."), "sample.app");
    const projectionPath = join(appDir, ".state/tasks/tree.json");
    mkdirSync(join(appDir, ".state/tasks"), { recursive: true });
    writeProjection(projectionPath, "pending", f.worktree);
    const emitted: Array<Record<string, unknown>> = [];

    const result = (await observeWorkspaceIntegrityChanges({
      appPath: (path) => resolve(appDir, path),
      record: (event) => emitted.push(event),
      noop: () => undefined,
    })) as { counts: { unownedDirty: number }; anomalies: unknown[] };

    expect(result.counts.unownedDirty).toBe(0);
    expect(result.anomalies).not.toContainEqual({
      path: f.worktree,
      kind: "unowned-dirty",
    });
    expect(emitted).toHaveLength(1);
    const persisted = JSON.parse(
      readFileSync(
        join(appDir, ".state/watchers/workspace-integrity.json"),
        "utf8",
      ),
    );
    expect(persisted.counts.unownedDirty).toBe(0);
  });
});

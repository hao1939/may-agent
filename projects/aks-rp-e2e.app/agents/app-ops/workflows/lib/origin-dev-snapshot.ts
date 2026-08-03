import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type OriginDevSnapshot = {
  dir: string;
  source: "origin/dev" | "project-dir";
  commit: string | null;
};

function git(projectDir: string, args: string[]) {
  return spawnSync("git", args, {
    cwd: projectDir,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

function commitAt(dir: string): string | null {
  const result = git(dir, ["rev-parse", "HEAD"]);
  const commit = result.status === 0 ? result.stdout.trim() : "";
  return commit || null;
}

export function withCurrentOriginDevSnapshot<T>(
  projectDir: string,
  fn: (snapshot: OriginDevSnapshot) => T,
): T {
  if (git(projectDir, ["rev-parse", "--verify", "origin/dev"]).status !== 0) {
    return fn({
      dir: projectDir,
      source: "project-dir",
      commit: commitAt(projectDir),
    });
  }

  const dir = mkdtempSync(join(tmpdir(), "aks-origin-dev-snapshot-"));
  const add = git(projectDir, [
    "worktree",
    "add",
    "--detach",
    dir,
    "origin/dev",
  ]);
  if (add.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    return fn({
      dir: projectDir,
      source: "project-dir",
      commit: commitAt(projectDir),
    });
  }

  try {
    return fn({ dir, source: "origin/dev", commit: commitAt(dir) });
  } finally {
    git(projectDir, ["worktree", "remove", "--force", dir]);
    rmSync(dir, { recursive: true, force: true });
  }
}

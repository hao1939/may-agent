import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type OriginDevSnapshot = {
  dir: string;
  source: "origin/dev" | "project-dir";
  commit: string | null;
};

type PreparedOriginDevSnapshot = {
  snapshot: OriginDevSnapshot;
  cleanup: () => void;
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

function prepareCurrentOriginDevSnapshot(
  projectDir: string,
): PreparedOriginDevSnapshot {
  if (git(projectDir, ["rev-parse", "--verify", "origin/dev"]).status !== 0) {
    return {
      snapshot: {
        dir: projectDir,
        source: "project-dir",
        commit: commitAt(projectDir),
      },
      cleanup: () => {},
    };
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
    return {
      snapshot: {
        dir: projectDir,
        source: "project-dir",
        commit: commitAt(projectDir),
      },
      cleanup: () => {},
    };
  }

  return {
    snapshot: { dir, source: "origin/dev", commit: commitAt(dir) },
    cleanup: () => {
      git(projectDir, ["worktree", "remove", "--force", dir]);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function withCurrentOriginDevSnapshot<T>(
  projectDir: string,
  fn: (snapshot: OriginDevSnapshot) => T,
): T {
  const prepared = prepareCurrentOriginDevSnapshot(projectDir);
  try {
    return fn(prepared.snapshot);
  } finally {
    prepared.cleanup();
  }
}

export async function withCurrentOriginDevSnapshotAsync<T>(
  projectDir: string,
  fn: (snapshot: OriginDevSnapshot) => Promise<T> | T,
): Promise<T> {
  const prepared = prepareCurrentOriginDevSnapshot(projectDir);
  try {
    return await fn(prepared.snapshot);
  } finally {
    prepared.cleanup();
  }
}

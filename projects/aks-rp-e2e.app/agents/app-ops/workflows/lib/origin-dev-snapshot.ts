import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const originDevSnapshotLeaseFile = "may-origin-dev-snapshot-lease.json";

type SnapshotLease = {
  kind: "aks-origin-dev-snapshot";
  path: string;
  pid: number;
  createdAt: string;
};

const activeCleanups = new Set<() => void>();
let exitCleanupInstalled = false;

function installExitCleanup(): void {
  if (exitCleanupInstalled) return;
  exitCleanupInstalled = true;
  process.once("exit", () => {
    for (const cleanup of [...activeCleanups]) cleanup();
  });
}

function gitDirForWorktree(dir: string): string | null {
  try {
    const pointer = readFileSync(join(dir, ".git"), "utf8").trim();
    if (!pointer.startsWith("gitdir: ")) return null;
    return resolve(dir, pointer.slice("gitdir: ".length));
  } catch {
    return null;
  }
}

function writeLease(dir: string): void {
  const gitDir = gitDirForWorktree(dir);
  if (!gitDir) return;
  const lease: SnapshotLease = {
    kind: "aks-origin-dev-snapshot",
    path: resolve(dir),
    pid: process.pid,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(
    join(gitDir, originDevSnapshotLeaseFile),
    `${JSON.stringify(lease)}\n`,
  );
}

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

function reclaimDeadOriginDevSnapshots(projectDir: string): void {
  const commonDirResult = git(projectDir, ["rev-parse", "--git-common-dir"]);
  if (commonDirResult.status !== 0) return;
  const commonDir = resolve(projectDir, commonDirResult.stdout.trim());
  let worktreeNames: string[];
  try {
    worktreeNames = readdirSync(join(commonDir, "worktrees"));
  } catch {
    return;
  }

  for (const name of worktreeNames) {
    const leasePath = join(
      commonDir,
      "worktrees",
      name,
      originDevSnapshotLeaseFile,
    );
    let lease: Partial<SnapshotLease>;
    try {
      lease = JSON.parse(
        readFileSync(leasePath, "utf8"),
      ) as Partial<SnapshotLease>;
    } catch {
      continue;
    }
    if (
      lease.kind !== "aks-origin-dev-snapshot" ||
      typeof lease.path !== "string" ||
      !Number.isInteger(lease.pid) ||
      Number(lease.pid) <= 0
    ) {
      continue;
    }
    try {
      process.kill(Number(lease.pid), 0);
      continue;
    } catch {
      // A dead snapshot owner cannot run its exit cleanup. Reclaim only its
      // explicitly leased worktree before allocating another full checkout.
    }
    git(projectDir, ["worktree", "remove", "--force", resolve(lease.path)]);
    rmSync(resolve(lease.path), { recursive: true, force: true });
  }
  git(projectDir, ["worktree", "prune"]);
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

  reclaimDeadOriginDevSnapshots(projectDir);
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

  writeLease(dir);
  installExitCleanup();
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    git(projectDir, ["worktree", "remove", "--force", dir]);
    rmSync(dir, { recursive: true, force: true });
    activeCleanups.delete(cleanup);
  };
  activeCleanups.add(cleanup);

  return {
    snapshot: { dir, source: "origin/dev", commit: commitAt(dir) },
    cleanup,
  };
}

export function isLiveOriginDevSnapshot(dir: string): boolean {
  const gitDir = gitDirForWorktree(dir);
  if (!gitDir) return false;
  try {
    const lease = JSON.parse(
      readFileSync(join(gitDir, originDevSnapshotLeaseFile), "utf8"),
    ) as Partial<SnapshotLease>;
    if (
      lease.kind !== "aks-origin-dev-snapshot" ||
      resolve(String(lease.path ?? "")) !== resolve(dir) ||
      !Number.isInteger(lease.pid) ||
      Number(lease.pid) <= 0
    ) {
      return false;
    }
    try {
      process.kill(Number(lease.pid), 0);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
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

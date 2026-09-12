import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import {
  chmod as chmodAsync,
  lstat as lstatAsync,
  mkdir as mkdirAsync,
  readFile as readFileAsync,
  readlink as readlinkAsync,
  rm as rmAsync,
  rmdir as rmdirAsync,
  symlink as symlinkAsync,
  writeFile as writeFileAsync,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { AppTaskExecutionPaths } from "../../core/tasks/app-task-output-paths.js";
import type { NormalizedTaskHandlerResult } from "../../core/tasks/result.js";
type ResidueFileSnapshot =
  | { exists: false }
  | { exists: true; kind: "file"; data: Buffer; mode: number }
  | { exists: true; kind: "symlink"; target: string };

type CanonicalUntrackedResidueGuard = {
  projectDir: string;
  indexPath: string;
  indexData: Buffer;
  indexMode: number;
  dirtyTracked: Map<string, ResidueFileSnapshot>;
  untracked: Map<string, ResidueFileSnapshot>;
};

type PlannedResidueFileRestore = {
  expected: ResidueFileSnapshot;
  restore: ResidueFileSnapshot | "index";
};

const execFileAsync = promisify(execFile);

export type CanonicalAgentResidueCleanupPlan = {
  guard: CanonicalUntrackedResidueGuard;
  expectedIndexData: Buffer;
  restoreIndex: boolean;
  files: Map<string, PlannedResidueFileRestore>;
};

async function gitPathSet(projectDir: string, args: string[]): Promise<Set<string>> {
  const { stdout } = await execFileAsync("git", ["-C", projectDir, ...args], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  return new Set(output.toString("utf8").split("\0").filter(Boolean));
}

async function canonicalUntrackedFiles(projectDir: string): Promise<Set<string>> {
  return gitPathSet(projectDir, ["ls-files", "--others", "--exclude-standard", "--full-name", "-z"]);
}

async function canonicalDirtyTrackedFiles(projectDir: string): Promise<Set<string>> {
  const [modified, staged] = await Promise.all([
    gitPathSet(projectDir, ["ls-files", "--modified", "--deleted", "-z"]),
    gitPathSet(projectDir, ["diff", "--cached", "--name-only", "-z"]),
  ]);
  return new Set([...modified, ...staged]);
}

function safeResiduePath(projectDir: string, relativePath: string): string {
  const absolutePath = resolve(projectDir, relativePath);
  const fromRoot = relative(projectDir, absolutePath);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`Refusing to access unsafe agent residue path: ${relativePath}`);
  }
  return absolutePath;
}

async function snapshotResidueFile(projectDir: string, relativePath: string): Promise<ResidueFileSnapshot> {
  const absolutePath = safeResiduePath(projectDir, relativePath);
  let stat;
  try {
    stat = await lstatAsync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false };
    throw error;
  }
  if (stat.isSymbolicLink()) return { exists: true, kind: "symlink", target: await readlinkAsync(absolutePath) };
  return { exists: true, kind: "file", data: await readFileAsync(absolutePath), mode: stat.mode };
}

async function restoreResidueFile(
  projectDir: string,
  relativePath: string,
  snapshot: ResidueFileSnapshot,
): Promise<void> {
  const absolutePath = safeResiduePath(projectDir, relativePath);
  await rmAsync(absolutePath, { recursive: true, force: true });
  if (!snapshot.exists) return;
  await mkdirAsync(dirname(absolutePath), { recursive: true });
  if (snapshot.kind === "symlink") {
    await symlinkAsync(snapshot.target, absolutePath);
    return;
  }
  await writeFileAsync(absolutePath, snapshot.data);
  await chmodAsync(absolutePath, snapshot.mode);
}

function residueSnapshotsEqual(left: ResidueFileSnapshot, right: ResidueFileSnapshot): boolean {
  if (left.exists !== right.exists) return false;
  if (!left.exists || !right.exists) return true;
  if (left.kind !== right.kind) return false;
  if (left.kind === "symlink" && right.kind === "symlink") return left.target === right.target;
  return left.kind === "file" && right.kind === "file" && left.mode === right.mode && left.data.equals(right.data);
}

/**
 * Direct agent attempts are conventionally read-only. When their default
 * workspace is the canonical Git checkout, snapshot its index and residue so
 * agent-created tracked or untracked writes can be rolled back without
 * disturbing dirt that predated the attempt. Workflow task worktrees have a
 * distinct workspaceDir and bypass this guard.
 */
export async function beginCanonicalAgentResidueGuard(
  paths: AppTaskExecutionPaths,
): Promise<CanonicalUntrackedResidueGuard | null> {
  if (paths.workspaceDir !== paths.projectDir) return null;
  try {
    const topLevelResult = await execFileAsync("git", ["-C", paths.projectDir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    });
    const topLevel = resolve(topLevelResult.stdout.trim());
    if (topLevel !== resolve(paths.projectDir)) return null;
    const indexResult = await execFileAsync("git", ["-C", paths.projectDir, "rev-parse", "--git-path", "index"], {
      encoding: "utf8",
    });
    const rawIndexPath = indexResult.stdout.trim();
    const indexPath = isAbsolute(rawIndexPath) ? rawIndexPath : resolve(paths.projectDir, rawIndexPath);
    const [dirtyTrackedPaths, untrackedPaths, indexData, indexStat] = await Promise.all([
      canonicalDirtyTrackedFiles(paths.projectDir),
      canonicalUntrackedFiles(paths.projectDir),
      readFileAsync(indexPath),
      lstatAsync(indexPath),
    ]);
    const dirtyTracked = new Map<string, ResidueFileSnapshot>();
    for (const path of dirtyTrackedPaths) {
      dirtyTracked.set(path, await snapshotResidueFile(paths.projectDir, path));
    }
    const untracked = new Map<string, ResidueFileSnapshot>();
    for (const path of untrackedPaths) {
      untracked.set(path, await snapshotResidueFile(paths.projectDir, path));
    }
    return {
      projectDir: paths.projectDir,
      indexPath,
      indexData,
      indexMode: indexStat.mode,
      dirtyTracked,
      untracked,
    };
  } catch {
    return null;
  }
}

export async function planCanonicalAgentResidueCleanup(
  guard: CanonicalUntrackedResidueGuard | null,
): Promise<CanonicalAgentResidueCleanupPlan | null> {
  if (!guard || !existsSync(guard.indexPath)) return null;

  const [expectedIndexData, dirtyTrackedPaths, untrackedPaths] = await Promise.all([
    readFileAsync(guard.indexPath),
    canonicalDirtyTrackedFiles(guard.projectDir),
    canonicalUntrackedFiles(guard.projectDir),
  ]);
  const currentPaths = new Set([
    ...guard.dirtyTracked.keys(),
    ...guard.untracked.keys(),
    ...dirtyTrackedPaths,
    ...untrackedPaths,
  ]);
  const files = new Map<string, PlannedResidueFileRestore>();
  for (const path of currentPaths) {
    const expected = await snapshotResidueFile(guard.projectDir, path);
    const baseline = guard.dirtyTracked.get(path) ?? guard.untracked.get(path);
    if (baseline) {
      if (!residueSnapshotsEqual(expected, baseline)) files.set(path, { expected, restore: baseline });
    } else if (dirtyTrackedPaths.has(path) || untrackedPaths.has(path)) {
      files.set(path, { expected, restore: untrackedPaths.has(path) ? { exists: false } : "index" });
    }
  }
  return {
    guard,
    expectedIndexData,
    restoreIndex: !expectedIndexData.equals(guard.indexData),
    files,
  };
}

async function restoreResidueFileFromBaselineIndex(
  guard: CanonicalUntrackedResidueGuard,
  relativePath: string,
): Promise<void> {
  const temporaryIndex = `${guard.indexPath}.agent-residue-${process.pid}-${Date.now()}`;
  try {
    await writeFileAsync(temporaryIndex, guard.indexData);
    await chmodAsync(temporaryIndex, guard.indexMode);
    await execFileAsync("git", ["-C", guard.projectDir, "checkout-index", "--force", "--", relativePath], {
      env: { ...process.env, GIT_INDEX_FILE: temporaryIndex },
    });
  } finally {
    await rmAsync(temporaryIndex, { force: true });
  }
}

export async function applyCanonicalAgentResidueCleanup(
  plan: CanonicalAgentResidueCleanupPlan | null,
): Promise<string[]> {
  if (!plan) return [];
  const { guard } = plan;
  const restored: string[] = [];

  for (const [relativePath, filePlan] of plan.files) {
    const current = await snapshotResidueFile(guard.projectDir, relativePath);
    if (!residueSnapshotsEqual(current, filePlan.expected)) continue;
    if (filePlan.restore === "index") {
      await restoreResidueFileFromBaselineIndex(guard, relativePath);
    } else {
      await restoreResidueFile(guard.projectDir, relativePath, filePlan.restore);
    }
    restored.push(`file:${relativePath}`);
    if (filePlan.restore === "index" || filePlan.restore.exists) continue;
    let parent = dirname(safeResiduePath(guard.projectDir, relativePath));
    while (parent !== guard.projectDir) {
      try {
        await rmdirAsync(parent);
      } catch {
        break;
      }
      parent = dirname(parent);
    }
  }

  if (
    plan.restoreIndex &&
    existsSync(guard.indexPath) &&
    (await readFileAsync(guard.indexPath)).equals(plan.expectedIndexData)
  ) {
    await writeFileAsync(guard.indexPath, guard.indexData);
    await chmodAsync(guard.indexPath, guard.indexMode);
    restored.push("index");
  }
  return restored;
}

export async function finishCanonicalAgentResidueGuard(
  guard: CanonicalUntrackedResidueGuard | null,
): Promise<string[]> {
  return applyCanonicalAgentResidueCleanup(await planCanonicalAgentResidueCleanup(guard));
}

export function rejectConvergedDirectAgentResidue(
  result: NormalizedTaskHandlerResult,
  restored: string[],
): NormalizedTaskHandlerResult {
  if (result.state !== "converged" || restored.length === 0) return result;
  return {
    state: "error",
    summary: "Direct-agent convergence was rejected because canonical workspace edits required cleanup",
    evidence: [...result.evidence, ...restored.map((entry) => `agent-residue-restored:${entry}`)],
    actions: [],
  };
}

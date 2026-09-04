import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export type OverlayPath = { path: string; status: string };
export type CleanMaterialization = {
  path: string;
  rollback: "remove" | "restore";
};
export type LocalMainOverlayPlan = {
  schema: "scout.local-main-overlay-plan/v1";
  repoRoot: string;
  baseCommit: string;
  candidateCommit: string;
  candidateParents: string[];
  preflightStatusCount: number;
  noRenameCandidatePathCount: number;
  overlapCount: number;
  unrelatedDirtyCount: number;
  expectedPostflightStatusCount: number;
  overlapBecomesClean: OverlayPath[];
  overlapRetained: OverlayPath[];
  cleanMaterialization: CleanMaterialization[];
  rollbackRestoreCount: number;
  rollbackRemoveCount: number;
};

type PathState = Buffer | null;

function git(repoRoot: string, args: string[], allowFailure = false) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd: repoRoot,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  const status = result.status ?? 1;
  if (!allowFailure && status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (${status}): ${result.stderr.toString()}`,
    );
  }
  return { status, stdout: result.stdout };
}

function nulRecords(buffer: Buffer): string[] {
  return buffer.toString().split("\0").filter(Boolean);
}

function statusMap(repoRoot: string): Map<string, string> {
  const records = nulRecords(
    git(repoRoot, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--no-renames",
    ]).stdout,
  );
  const statuses = new Map<string, string>();
  for (const record of records) {
    const status = record.slice(0, 2).trim();
    const path = record.slice(3);
    if (!path || statuses.has(path)) {
      throw new Error(`ambiguous preflight status record: ${record}`);
    }
    statuses.set(path, status);
  }
  return statuses;
}

function treeState(repoRoot: string, commit: string, path: string): PathState {
  const records = nulRecords(
    git(repoRoot, ["ls-tree", "-z", commit, "--", path]).stdout,
  );
  if (records.length === 0) return null;
  if (records.length !== 1) throw new Error(`ambiguous tree path: ${path}`);
  const tab = records[0].indexOf("\t");
  const [mode, type, object] = records[0].slice(0, tab).split(" ");
  if (tab < 0 || !mode || type !== "blob" || !object) {
    throw new Error(`unsupported candidate tree entry: ${path}`);
  }
  return git(repoRoot, ["cat-file", "blob", object]).stdout;
}

function worktreeState(repoRoot: string, path: string): PathState {
  const segments = path.split("/");
  if (
    isAbsolute(path) ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new Error(`unsafe worktree path: ${path}`);
  }
  let fullPath = repoRoot;
  let status;
  for (const [index, segment] of segments.entries()) {
    fullPath = join(fullPath, segment);
    try {
      status = lstatSync(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    if (index < segments.length - 1) {
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new Error(`unsafe worktree parent: ${path}`);
      }
    }
  }
  if (status === undefined) throw new Error(`unsafe worktree path: ${path}`);
  if (status.isSymbolicLink()) return Buffer.from(readlinkSync(fullPath));
  if (!status.isFile()) throw new Error(`unsupported worktree entry: ${path}`);
  return readFileSync(fullPath);
}

function statesEqual(left: PathState, right: PathState): boolean {
  if (left === null || right === null) return left === right;
  return left.equals(right);
}

export function inspectLocalMainOverlay(
  repoRootInput: string,
  baseRef: string,
  candidateRef: string,
): LocalMainOverlayPlan {
  const repoRoot = resolve(repoRootInput);
  const baseCommit = git(repoRoot, ["rev-parse", `${baseRef}^{commit}`])
    .stdout.toString()
    .trim();
  const candidateCommit = git(repoRoot, [
    "rev-parse",
    `${candidateRef}^{commit}`,
  ])
    .stdout.toString()
    .trim();
  const head = git(repoRoot, ["rev-parse", "HEAD"]).stdout.toString().trim();
  if (head !== baseCommit) {
    throw new Error(`preflight HEAD ${head} does not equal base ${baseCommit}`);
  }
  if (git(repoRoot, ["diff", "--cached", "--quiet"], true).status !== 0) {
    throw new Error("preflight index contains staged changes");
  }

  const statuses = statusMap(repoRoot);
  const candidatePaths = nulRecords(
    git(repoRoot, [
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      `${baseCommit}..${candidateCommit}`,
    ]).stdout,
  );
  if (new Set(candidatePaths).size !== candidatePaths.length) {
    throw new Error("candidate diff contains duplicate paths");
  }

  const candidatePathSet = new Set(candidatePaths);
  const overlapBecomesClean: OverlayPath[] = [];
  const overlapRetained: OverlayPath[] = [];
  const cleanMaterialization: CleanMaterialization[] = [];
  for (const path of candidatePaths) {
    const baseState = treeState(repoRoot, baseCommit, path);
    const candidateState = treeState(repoRoot, candidateCommit, path);
    const currentState = worktreeState(repoRoot, path);
    const status = statuses.get(path);
    if (status !== undefined) {
      const entry = { path, status };
      if (statesEqual(currentState, candidateState)) {
        overlapBecomesClean.push(entry);
      } else {
        overlapRetained.push(entry);
      }
      continue;
    }
    if (!statesEqual(currentState, baseState)) {
      throw new Error(`status omitted changed candidate path: ${path}`);
    }
    cleanMaterialization.push({
      path,
      rollback: baseState === null ? "remove" : "restore",
    });
  }

  const unrelatedDirtyCount = [...statuses.keys()].filter(
    (path) => !candidatePathSet.has(path),
  ).length;
  return {
    schema: "scout.local-main-overlay-plan/v1",
    repoRoot,
    baseCommit,
    candidateCommit,
    candidateParents: git(repoRoot, [
      "show",
      "-s",
      "--format=%P",
      candidateCommit,
    ])
      .stdout.toString()
      .trim()
      .split(/\s+/u)
      .filter(Boolean),
    preflightStatusCount: statuses.size,
    noRenameCandidatePathCount: candidatePaths.length,
    overlapCount: overlapBecomesClean.length + overlapRetained.length,
    unrelatedDirtyCount,
    expectedPostflightStatusCount: unrelatedDirtyCount + overlapRetained.length,
    overlapBecomesClean,
    overlapRetained,
    cleanMaterialization,
    rollbackRestoreCount: cleanMaterialization.filter(
      ({ rollback }) => rollback === "restore",
    ).length,
    rollbackRemoveCount: cleanMaterialization.filter(
      ({ rollback }) => rollback === "remove",
    ).length,
  };
}

if (import.meta.main) {
  const [baseRef, candidateRef, repoRoot = process.cwd()] = Bun.argv.slice(2);
  if (!baseRef || !candidateRef) {
    console.error(
      "usage: bun scripts/local-main-overlay-plan.ts <base> <candidate> [repo-root]",
    );
    process.exit(1);
  }
  try {
    console.log(
      JSON.stringify(
        inspectLocalMainOverlay(repoRoot, baseRef, candidateRef),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}

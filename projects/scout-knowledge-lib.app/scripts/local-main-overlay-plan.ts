import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export type OverlayPath = { path: string; status: string };
export type RetainedOverlayExpectation = { path: string; sha256: string };
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
  explicitRetainedCount: number;
  cleanMaterialization: CleanMaterialization[];
  rollbackRestoreCount: number;
  rollbackRemoveCount: number;
};

type PathState = Buffer | null;
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

function safeRelativePath(path: string): boolean {
  const segments = path.split("/");
  return (
    !isAbsolute(path) &&
    segments.every(
      (segment) => segment !== "" && segment !== "." && segment !== "..",
    )
  );
}

function retainedExpectationMap(
  expectations: readonly RetainedOverlayExpectation[],
): Map<string, string> {
  const result = new Map<string, string>();
  for (const { path, sha256 } of expectations) {
    if (!safeRelativePath(path)) {
      throw new Error(`unsafe retained worktree path: ${path}`);
    }
    if (!/^[0-9a-f]{64}$/u.test(sha256)) {
      throw new Error(`invalid retained worktree sha256: ${path}`);
    }
    if (result.has(path)) {
      throw new Error(`duplicate retained worktree path: ${path}`);
    }
    result.set(path, sha256);
  }
  return result;
}

function git(repoRoot: string, args: string[], allowFailure = false) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd: repoRoot,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
  });
  const status = result.status ?? 1;
  if (!allowFailure && status !== 0) {
    const detail = result.error?.message ?? result.stderr.toString();
    throw new Error(`git ${args.join(" ")} failed (${status}): ${detail}`);
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
  if (!safeRelativePath(path)) {
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
  retainedExpectations: readonly RetainedOverlayExpectation[] = [],
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
  const retained = retainedExpectationMap(retainedExpectations);
  const requireExplicitRetention = retained.size > 0;
  const consumedRetained = new Set<string>();
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
    const expectedRetainedSha256 = retained.get(path);
    const retain = (retainedStatus: string) => {
      if (currentState === null || statesEqual(currentState, candidateState)) {
        throw new Error(`retained worktree path is not divergent: ${path}`);
      }
      if (expectedRetainedSha256 === undefined) {
        if (requireExplicitRetention) {
          throw new Error(
            `divergent candidate overlap lacks explicit retention: ${path}`,
          );
        }
      } else {
        const actual = createHash("sha256").update(currentState).digest("hex");
        if (actual !== expectedRetainedSha256) {
          throw new Error(`retained worktree sha256 changed: ${path}`);
        }
        consumedRetained.add(path);
      }
      overlapRetained.push({ path, status: retainedStatus });
    };
    if (status !== undefined) {
      const entry = { path, status };
      if (statesEqual(currentState, candidateState)) {
        if (expectedRetainedSha256 !== undefined) {
          throw new Error(`retained worktree path is not divergent: ${path}`);
        }
        overlapBecomesClean.push(entry);
      } else {
        retain(status);
      }
      continue;
    }
    if (!statesEqual(currentState, baseState)) {
      if (expectedRetainedSha256 === undefined) {
        throw new Error(`status omitted changed candidate path: ${path}`);
      }
      retain("ignored-protected");
      continue;
    }
    if (expectedRetainedSha256 !== undefined) {
      throw new Error(`retained worktree path is not divergent: ${path}`);
    }
    cleanMaterialization.push({
      path,
      rollback: baseState === null ? "remove" : "restore",
    });
  }

  const unrelatedDirtyCount = [...statuses.keys()].filter(
    (path) => !candidatePathSet.has(path),
  ).length;
  for (const path of retained.keys()) {
    if (!candidatePathSet.has(path)) {
      throw new Error(`retained worktree path is not in candidate: ${path}`);
    }
    if (!consumedRetained.has(path)) {
      throw new Error(`retained worktree path was not consumed: ${path}`);
    }
  }
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
    explicitRetainedCount: consumedRetained.size,
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
  const args = Bun.argv.slice(2);
  const baseRef = args.shift();
  const candidateRef = args.shift();
  if (!baseRef || !candidateRef) {
    console.error(
      "usage: bun scripts/local-main-overlay-plan.ts <base> <candidate> [repo-root] [--retain-worktree <path>=<sha256>]...",
    );
    process.exit(1);
  }
  const repoRoot =
    args[0] && !args[0].startsWith("--") ? args.shift()! : process.cwd();
  const retainedExpectations: RetainedOverlayExpectation[] = [];
  while (args.length > 0) {
    const option = args.shift();
    if (option !== "--retain-worktree") {
      console.error(`unknown option: ${option}`);
      process.exit(1);
    }
    const value = args.shift();
    const separator = value?.lastIndexOf("=") ?? -1;
    if (!value || separator <= 0) {
      console.error("--retain-worktree requires <path>=<sha256>");
      process.exit(1);
    }
    retainedExpectations.push({
      path: value.slice(0, separator),
      sha256: value.slice(separator + 1),
    });
  }
  try {
    console.log(
      JSON.stringify(
        inspectLocalMainOverlay(
          repoRoot,
          baseRef,
          candidateRef,
          retainedExpectations,
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}

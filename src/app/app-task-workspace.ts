import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import type { AppTaskWorkspace as AppTaskWorkspace } from "./app-task-state.js";

type GitResult = { status: number; stdout: string; stderr: string };

export type PreparedTaskWorkspace = {
  repoDir: string;
  metadata: AppTaskWorkspace;
};

export type FinalizedTaskWorkspace = {
  ok: boolean;
  metadata: AppTaskWorkspace;
  reason?: string;
};

function git(repoDir: string, args: string[], allowFailure = false): Promise<GitResult> {
  return new Promise((resolveResult, reject) => {
    execFile(
      "git",
      ["-C", repoDir, ...args],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120_000 },
      (error, stdout, stderr) => {
        const status = error ? (typeof error.code === "number" ? error.code : 1) : 0;
        const output = {
          status,
          stdout: stdout.trim(),
          stderr: (stderr || error?.message || "").trim(),
        };
        if (!allowFailure && status !== 0) {
          reject(new Error(`git ${args.join(" ")} failed in ${repoDir}: ${output.stderr || output.stdout}`));
          return;
        }
        resolveResult(output);
      },
    );
  });
}

const repoOperations = new Map<string, Promise<void>>();

async function withRepoOperation<T>(repoDir: string, operation: () => Promise<T>): Promise<T> {
  const previous = repoOperations.get(repoDir) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolveCurrent) => {
    release = resolveCurrent;
  });
  repoOperations.set(repoDir, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (repoOperations.get(repoDir) === current) repoOperations.delete(repoDir);
  }
}

function safePart(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "task"
  );
}

function identity(taskId: string, generation: number): { leaf: string; branch: string } {
  const hash = createHash("sha256").update(`${taskId}@${generation}`).digest("hex").slice(0, 10);
  const leaf = `${safePart(taskId)}-${hash}`;
  return { leaf, branch: `task/${leaf}` };
}

async function worktreeEntries(repoDir: string): Promise<Array<{ path: string; branch?: string; head?: string }>> {
  const output = (await git(repoDir, ["worktree", "list", "--porcelain"])).stdout;
  if (!output) return [];
  return output.split(/\n\n+/).flatMap((block) => {
    const fields = Object.fromEntries(
      block.split("\n").flatMap((line) => {
        const offset = line.indexOf(" ");
        return offset > 0 ? [[line.slice(0, offset), line.slice(offset + 1)]] : [];
      }),
    );
    if (!fields.worktree) return [];
    return [{ path: resolve(fields.worktree), branch: fields.branch, head: fields.HEAD }];
  });
}

async function refExists(repoDir: string, ref: string): Promise<boolean> {
  return (await git(repoDir, ["show-ref", "--verify", "--quiet", ref], true)).status === 0;
}

async function remoteExists(repoDir: string, remote: string): Promise<boolean> {
  return (await git(repoDir, ["remote", "get-url", remote], true)).status === 0;
}

async function headAt(path: string): Promise<string> {
  return (await git(path, ["rev-parse", "HEAD"])).stdout;
}

async function interruptedOperationBranch(path: string): Promise<string | undefined> {
  for (const marker of ["rebase-merge/head-name", "rebase-apply/head-name"]) {
    const markerPath = resolve(path, (await git(path, ["rev-parse", "--git-path", marker])).stdout);
    if (!existsSync(markerPath)) continue;
    const branch = (await readFile(markerPath, "utf8")).trim();
    if (branch) return branch;
  }
  return undefined;
}

async function isIntegrated(repoDir: string, metadata: AppTaskWorkspace): Promise<boolean> {
  if (
    metadata.headCommit === metadata.baseCommit ||
    (await git(repoDir, ["diff", "--quiet", metadata.baseCommit, metadata.headCommit], true)).status === 0 ||
    (await git(repoDir, ["merge-base", "--is-ancestor", metadata.headCommit, metadata.baseRef], true)).status === 0
  ) return true;
  // Squash/rebase integration need not preserve commit ancestry. Prove that
  // merging the retained change adds nothing to one pinned target snapshot.
  // merge-tree changes no refs, index, or worktree. Conflict/unsupported Git is
  // unknown integration, so the branch remains available for recovery.
  const target = (await git(repoDir, ["rev-parse", metadata.baseRef])).stdout;
  const merged = await git(repoDir, ["merge-tree", "--write-tree", target, metadata.headCommit], true);
  if (merged.status !== 0) return false;
  return merged.stdout.split("\n")[0] === (await git(repoDir, ["rev-parse", `${target}^{tree}`])).stdout;
}

function unintegratedResult(metadata: AppTaskWorkspace): FinalizedTaskWorkspace {
  return {
    ok: false,
    metadata,
    reason: `Task branch ${metadata.branch} is not integrated into ${metadata.baseRef}; the task must wait for integration or explicitly remove the rejected branch`,
  };
}

export async function prepareAppTaskWorkspace(input: {
  repoDir: string;
  workspaceRoot: string;
  taskId: string;
  generation: number;
  baseBranch: string;
  refreshRemote?: boolean;
  previous?: AppTaskWorkspace;
}): Promise<PreparedTaskWorkspace> {
  const repoDir = await realpath(input.repoDir);
  return withRepoOperation(repoDir, async () => {
    if ((await git(repoDir, ["rev-parse", "--is-inside-work-tree"])).stdout !== "true") {
      throw new Error(`Task workspace requires a Git worktree: ${repoDir}`);
    }

    const { leaf, branch } = identity(input.taskId, input.generation);
    const path = resolve(join(input.workspaceRoot, leaf));
    const remote = "origin";
    const hasRemote = await remoteExists(repoDir, remote);
    if (hasRemote && input.refreshRemote !== false) {
      await git(repoDir, ["fetch", "--prune", remote, input.baseBranch]);
      await git(repoDir, ["fetch", remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`], true);
    }
    const remoteRef = `refs/remotes/${remote}/${input.baseBranch}`;
    const remoteTaskRef = `refs/remotes/${remote}/${branch}`;
    const localRef = `refs/heads/${input.baseBranch}`;
    const baseRef = (await refExists(repoDir, remoteRef))
      ? `${remote}/${input.baseBranch}`
      : (await refExists(repoDir, localRef))
        ? input.baseBranch
        : "HEAD";
    const currentBaseCommit = (await git(repoDir, ["rev-parse", baseRef])).stdout;

    let entries = await worktreeEntries(repoDir);
    let registered = entries.find((entry) => entry.path === path);
    if (registered && !existsSync(path)) {
      await git(repoDir, ["worktree", "prune"]);
      entries = await worktreeEntries(repoDir);
      registered = entries.find((entry) => entry.path === path);
    }

    const branchRef = `refs/heads/${branch}`;
    const branchExists = await refExists(repoDir, branchRef);
    const remoteTaskBranchExists = await refExists(repoDir, remoteTaskRef);
    const branchRegistration = entries.find((entry) => entry.branch === branchRef && entry.path !== path);
    if (branchRegistration) {
      throw new Error(`Task branch ${branch} is already checked out at ${branchRegistration.path}`);
    }

    if (registered) {
      const interruptedBranch = registered.branch ? undefined : await interruptedOperationBranch(path);
      if (registered.branch !== branchRef && interruptedBranch !== branchRef) {
        throw new Error(
          `Task workspace ${path} is registered to ${registered.branch ?? "detached HEAD"}, expected ${branch}`,
        );
      }
    } else {
      if (existsSync(path)) {
        throw new Error(`Task workspace path exists but is not a registered Git worktree: ${path}`);
      }
      await mkdir(dirname(path), { recursive: true });
      if (branchExists) await git(repoDir, ["worktree", "add", path, branch]);
      else {
        await git(repoDir, [
          "worktree",
          "add",
          "-b",
          branch,
          path,
          remoteTaskBranchExists ? `${remote}/${branch}` : currentBaseCommit,
        ]);
      }
    }

    const headCommit = await headAt(path);
    const baseCommit =
      input.previous?.branch === branch && input.previous.baseCommit
        ? input.previous.baseCommit
        : branchExists || remoteTaskBranchExists
          ? (await git(repoDir, ["merge-base", headCommit, currentBaseCommit])).stdout || currentBaseCommit
          : currentBaseCommit;
    return {
      repoDir,
      metadata: {
        kind: "task-worktree",
        path,
        baseRef,
        baseCommit,
        branch,
        headCommit,
        disposition: "active",
      },
    };
  });
}

export async function finalizeAppTaskWorkspace(
  prepared: PreparedTaskWorkspace,
  outcome: "accepted" | "waiting" | "failed",
): Promise<FinalizedTaskWorkspace> {
  const { repoDir } = prepared;
  return withRepoOperation(repoDir, async () => {
    const metadata = { ...prepared.metadata };
    if (!existsSync(metadata.path)) {
      const branchRef = `refs/heads/${metadata.branch}`;
      if (!(await refExists(repoDir, branchRef))) {
        metadata.disposition = "removed";
        return { ok: true, metadata };
      }
      metadata.headCommit = (await git(repoDir, ["rev-parse", branchRef])).stdout;
      if (await isIntegrated(repoDir, metadata)) {
        await git(repoDir, ["branch", "-D", metadata.branch]);
        metadata.disposition = "removed";
        return { ok: true, metadata };
      }
      metadata.disposition = "branch-retained";
      if (outcome === "accepted") return unintegratedResult(metadata);
      return { ok: true, metadata };
    }

    metadata.headCommit = await headAt(metadata.path);
    const dirty = (await git(metadata.path, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout;
    if (dirty) {
      metadata.disposition = "retained-for-recovery";
      return {
        ok: outcome === "failed",
        metadata,
        reason: `Task worktree is dirty and was retained for recovery: ${metadata.path}`,
      };
    }
    if (outcome === "failed") {
      metadata.disposition = "retained-for-recovery";
      return { ok: true, metadata };
    }

    const integrated = await isIntegrated(repoDir, metadata);
    await git(repoDir, ["worktree", "remove", metadata.path]);
    if (integrated && (await refExists(repoDir, `refs/heads/${metadata.branch}`))) {
      await git(repoDir, ["branch", "-D", metadata.branch]);
      metadata.disposition = "removed";
    } else {
      metadata.disposition = "branch-retained";
    }
    if (outcome === "accepted" && !integrated) return unintegratedResult(metadata);
    return { ok: true, metadata };
  });
}

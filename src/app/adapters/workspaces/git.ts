import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import type { AppTaskWorkspace } from "../../core/tasks/app-task-state.js";
import type { TaskWorkspaces, PreparedTaskWorkspace, FinalizedTaskWorkspace } from "../../core/tasks/workspace.js";

type GitResult = { status: number; stdout: string; stderr: string };

export const gitTaskWorkspaces: TaskWorkspaces = {
  prepare: prepareAppTaskWorkspace,
  finalize: finalizeAppTaskWorkspace,
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

async function removeWorkspaceRefs(repoDir: string, metadata: AppTaskWorkspace): Promise<void> {
  const leaf = /^task\/([^/]+)$/.exec(metadata.branch)?.[1];
  if (!leaf) return;
  // These refs follow the workspace, not the attempt. Delete only this
  // removed generation's refs; waiting/failed/unintegrated work keeps them.
  for (const name of ["base", "head"]) {
    await git(repoDir, ["update-ref", "--no-deref", "-d", `refs/may/workspaces/${leaf}/${name}`]);
  }
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

export async function prepareAppTaskWorkspace(
  input: Parameters<TaskWorkspaces["prepare"]>[0],
): Promise<PreparedTaskWorkspace> {
  const repoDir = await realpath(input.repoDir);
  return withRepoOperation(repoDir, async () => {
    if ((await git(repoDir, ["rev-parse", "--is-inside-work-tree"])).stdout !== "true") {
      throw new Error(`Task workspace requires a Git worktree: ${repoDir}`);
    }

    const { leaf, branch } = identity(input.taskId, input.generation);
    const path = resolve(join(input.workspaceRoot, leaf));
    const remote = "origin";
    const hasRemote = await remoteExists(repoDir, remote);
    const refUpdates: Array<{ ref: string; before: string; fetched: string }> = [];
    let fetchedRefs = false;
    try {
      let fetchedBaseRef: string | undefined;
      let fetchedTaskRef: string | undefined;
      if (hasRemote && input.refreshRemote !== false) {
        // Probe before writing refs and fetch the advertised commits exactly.
        // A missing Task branch is normal; a failed query or missing base is not.
        const published = await git(repoDir, [
          "ls-remote",
          "--heads",
          remote,
          `refs/heads/${input.baseBranch}`,
          `refs/heads/${branch}`,
        ]);
        const heads = new Map(
          published.stdout.split("\n").map((line) => {
            const [commit, ref] = line.split("\t");
            return [ref, commit];
          }),
        );
        const base = heads.get(`refs/heads/${input.baseBranch}`);
        if (!base) throw new Error(`Remote ${remote} has no base branch ${input.baseBranch}`);
        const taskHead = heads.get(`refs/heads/${branch}`);
        fetchedBaseRef = `refs/may/workspaces/${leaf}/base`;
        fetchedTaskRef = taskHead ? `refs/may/workspaces/${leaf}/head` : undefined;
        const fetchRefs: Array<[string, string]> = [[fetchedBaseRef, base]];
        if (fetchedTaskRef && taskHead) fetchRefs.push([fetchedTaskRef, taskHead]);
        for (const [ref, fetched] of fetchRefs) {
          const before = await git(repoDir, ["rev-parse", "--verify", "--quiet", ref], true);
          if (before.status !== 0 && before.status !== 1) {
            throw new Error(`Cannot read private workspace ref ${ref}: ${before.stderr}`);
          }
          refUpdates.push({ ref, before: before.stdout, fetched });
        }
        // Worker subprocesses share remote-tracking refs and FETCH_HEAD with
        // the Host, but not its in-process lock. Fetch into this generation's
        // private refs atomically, without implicit remote/tag/FETCH_HEAD writes.
        await git(repoDir, [
          "fetch",
          "--atomic",
          "--no-tags",
          "--no-write-fetch-head",
          "--refmap=",
          remote,
          ...refUpdates.map(({ ref, fetched }) => `+${fetched}:${ref}`),
        ]);
        fetchedRefs = true;
      }
      const remoteRef = `refs/remotes/${remote}/${input.baseBranch}`;
      const remoteTaskRef =
        hasRemote && input.refreshRemote !== false ? fetchedTaskRef : `refs/remotes/${remote}/${branch}`;
      const localRef = `refs/heads/${input.baseBranch}`;
      const baseRef =
        fetchedBaseRef ??
        ((await refExists(repoDir, remoteRef))
          ? `${remote}/${input.baseBranch}`
          : (await refExists(repoDir, localRef))
            ? input.baseBranch
            : "HEAD");
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
      const remoteTaskBranchExists = remoteTaskRef !== undefined && (await refExists(repoDir, remoteTaskRef));
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
          if (remoteTaskBranchExists) {
            // A private fetch ref cannot establish Git's ordinary upstream.
            // Configure it before branch creation so a config-lock failure
            // remains retryable, without updating the shared tracking ref.
            await git(repoDir, ["config", `branch.${branch}.remote`, remote]);
            await git(repoDir, ["config", `branch.${branch}.merge`, `refs/heads/${branch}`]);
          }
          await git(repoDir, [
            "worktree",
            "add",
            "--no-track",
            "-b",
            branch,
            path,
            remoteTaskBranchExists ? remoteTaskRef : currentBaseCommit,
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
    } catch (error) {
      // Preparation returned no metadata to finalize. Undo only our exact ref
      // writes, restoring old recovery snapshots and leaving other writers alone.
      const failures: unknown[] = [error];
      for (const { ref, before, fetched } of fetchedRefs ? refUpdates : []) {
        if (before === fetched) continue;
        try {
          const current = await git(repoDir, ["rev-parse", "--verify", "--quiet", ref], true);
          if (current.status === 1) continue;
          if (current.status !== 0) throw new Error(`Cannot read private workspace ref ${ref}: ${current.stderr}`);
          if (current.stdout !== fetched) continue;
          await git(
            repoDir,
            before
              ? ["update-ref", "--no-deref", ref, before, fetched]
              : ["update-ref", "--no-deref", "-d", ref, fetched],
          );
        } catch (cleanupError) {
          failures.push(cleanupError);
        }
      }
      if (failures.length > 1) {
        throw new AggregateError(
          failures,
          `Workspace preparation and private-ref rollback failed: ${failures.map(String).join("; ")}`,
        );
      }
      throw error;
    }
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
        await removeWorkspaceRefs(repoDir, metadata);
        metadata.disposition = "removed";
        return { ok: true, metadata };
      }
      metadata.headCommit = (await git(repoDir, ["rev-parse", branchRef])).stdout;
      if (await isIntegrated(repoDir, metadata)) {
        await git(repoDir, ["branch", "-D", metadata.branch]);
        await removeWorkspaceRefs(repoDir, metadata);
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
    if (outcome === "waiting") {
      // Waiting releases execution, not unfinished work. Recreating this
      // checkout on every wake discards ignored dependencies and local
      // evidence, turning observation into repeated setup/repair work.
      metadata.disposition = "active";
      return { ok: true, metadata };
    }

    const integrated = await isIntegrated(repoDir, metadata);
    await git(repoDir, ["worktree", "remove", metadata.path]);
    if (integrated && (await refExists(repoDir, `refs/heads/${metadata.branch}`))) {
      await git(repoDir, ["branch", "-D", metadata.branch]);
      await removeWorkspaceRefs(repoDir, metadata);
      metadata.disposition = "removed";
    } else {
      metadata.disposition = "branch-retained";
    }
    if (outcome === "accepted" && !integrated) return unintegratedResult(metadata);
    return { ok: true, metadata };
  });
}

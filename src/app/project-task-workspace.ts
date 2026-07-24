import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { ProjectAppTaskWorkspace } from "@may-agent/sdk";

type GitResult = { status: number; stdout: string; stderr: string };

export type PreparedTaskWorkspace = {
  repoDir: string;
  metadata: ProjectAppTaskWorkspace;
};

export type FinalizedTaskWorkspace = {
  ok: boolean;
  metadata: ProjectAppTaskWorkspace;
  reason?: string;
};

function git(repoDir: string, args: string[], allowFailure = false): GitResult {
  const result = spawnSync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  const status = result.status ?? 1;
  const output = {
    status,
    stdout: result.stdout?.trim() ?? "",
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
  if (!allowFailure && status !== 0) {
    throw new Error(`git ${args.join(" ")} failed in ${repoDir}: ${output.stderr || output.stdout}`);
  }
  return output;
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

function worktreeEntries(repoDir: string): Array<{ path: string; branch?: string; head?: string }> {
  const output = git(repoDir, ["worktree", "list", "--porcelain"]).stdout;
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

function refExists(repoDir: string, ref: string): boolean {
  return git(repoDir, ["show-ref", "--verify", "--quiet", ref], true).status === 0;
}

function remoteExists(repoDir: string, remote: string): boolean {
  return git(repoDir, ["remote", "get-url", remote], true).status === 0;
}

function headAt(path: string): string {
  return git(path, ["rev-parse", "HEAD"]).stdout;
}

function interruptedOperationBranch(path: string): string | undefined {
  for (const marker of ["rebase-merge/head-name", "rebase-apply/head-name"]) {
    const markerPath = resolve(path, git(path, ["rev-parse", "--git-path", marker]).stdout);
    if (!existsSync(markerPath)) continue;
    const branch = readFileSync(markerPath, "utf8").trim();
    if (branch) return branch;
  }
  return undefined;
}

function isIntegrated(repoDir: string, metadata: ProjectAppTaskWorkspace): boolean {
  return (
    metadata.headCommit === metadata.baseCommit ||
    git(repoDir, ["diff", "--quiet", metadata.baseCommit, metadata.headCommit], true).status === 0 ||
    git(repoDir, ["merge-base", "--is-ancestor", metadata.headCommit, metadata.baseRef], true).status === 0
  );
}

function unintegratedResult(metadata: ProjectAppTaskWorkspace): FinalizedTaskWorkspace {
  return {
    ok: false,
    metadata,
    reason: `Task branch ${metadata.branch} is not integrated into ${metadata.baseRef}; the task must wait for integration or explicitly remove the rejected branch`,
  };
}

export function prepareProjectTaskWorkspace(input: {
  repoDir: string;
  workspaceRoot: string;
  taskId: string;
  generation: number;
  baseBranch: string;
  refreshRemote?: boolean;
  previous?: ProjectAppTaskWorkspace;
}): PreparedTaskWorkspace {
  const repoDir = realpathSync(input.repoDir);
  if (git(repoDir, ["rev-parse", "--is-inside-work-tree"]).stdout !== "true") {
    throw new Error(`Task workspace requires a Git worktree: ${repoDir}`);
  }

  const { leaf, branch } = identity(input.taskId, input.generation);
  const path = resolve(join(input.workspaceRoot, leaf));
  const remote = "origin";
  const hasRemote = remoteExists(repoDir, remote);
  if (hasRemote && input.refreshRemote !== false) {
    git(repoDir, ["fetch", "--prune", remote, input.baseBranch]);
  }
  const remoteRef = `refs/remotes/${remote}/${input.baseBranch}`;
  const localRef = `refs/heads/${input.baseBranch}`;
  const baseRef = refExists(repoDir, remoteRef)
    ? `${remote}/${input.baseBranch}`
    : refExists(repoDir, localRef)
      ? input.baseBranch
      : "HEAD";
  const currentBaseCommit = git(repoDir, ["rev-parse", baseRef]).stdout;

  let entries = worktreeEntries(repoDir);
  let registered = entries.find((entry) => entry.path === path);
  if (registered && !existsSync(path)) {
    git(repoDir, ["worktree", "prune"]);
    entries = worktreeEntries(repoDir);
    registered = entries.find((entry) => entry.path === path);
  }

  const branchRef = `refs/heads/${branch}`;
  const branchExists = refExists(repoDir, branchRef);
  const branchRegistration = entries.find((entry) => entry.branch === branchRef && entry.path !== path);
  if (branchRegistration) {
    throw new Error(`Task branch ${branch} is already checked out at ${branchRegistration.path}`);
  }

  if (registered) {
    const interruptedBranch = registered.branch ? undefined : interruptedOperationBranch(path);
    if (registered.branch !== branchRef && interruptedBranch !== branchRef) {
      throw new Error(
        `Task workspace ${path} is registered to ${registered.branch ?? "detached HEAD"}, expected ${branch}`,
      );
    }
  } else {
    if (existsSync(path)) {
      throw new Error(`Task workspace path exists but is not a registered Git worktree: ${path}`);
    }
    mkdirSync(dirname(path), { recursive: true });
    if (branchExists) git(repoDir, ["worktree", "add", path, branch]);
    else git(repoDir, ["worktree", "add", "-b", branch, path, currentBaseCommit]);
  }

  const headCommit = headAt(path);
  const baseCommit =
    input.previous?.branch === branch && input.previous.baseCommit
      ? input.previous.baseCommit
      : branchExists
        ? git(repoDir, ["merge-base", headCommit, currentBaseCommit]).stdout || currentBaseCommit
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
}

export function finalizeProjectTaskWorkspace(
  prepared: PreparedTaskWorkspace,
  outcome: "accepted" | "waiting" | "failed",
): FinalizedTaskWorkspace {
  const { repoDir } = prepared;
  const metadata = { ...prepared.metadata };
  if (!existsSync(metadata.path)) {
    const branchRef = `refs/heads/${metadata.branch}`;
    if (!refExists(repoDir, branchRef)) {
      metadata.disposition = "removed";
      return { ok: true, metadata };
    }
    metadata.headCommit = git(repoDir, ["rev-parse", branchRef]).stdout;
    if (isIntegrated(repoDir, metadata)) {
      git(repoDir, ["branch", "-D", metadata.branch]);
      metadata.disposition = "removed";
      return { ok: true, metadata };
    }
    metadata.disposition = "branch-retained";
    if (outcome === "accepted") return unintegratedResult(metadata);
    return { ok: true, metadata };
  }

  metadata.headCommit = headAt(metadata.path);
  const dirty = git(metadata.path, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout;
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

  const integrated = isIntegrated(repoDir, metadata);
  git(repoDir, ["worktree", "remove", metadata.path]);
  if (integrated && refExists(repoDir, `refs/heads/${metadata.branch}`)) {
    git(repoDir, ["branch", "-D", metadata.branch]);
    metadata.disposition = "removed";
  } else {
    metadata.disposition = "branch-retained";
  }
  if (outcome === "accepted" && !integrated) return unintegratedResult(metadata);
  return { ok: true, metadata };
}

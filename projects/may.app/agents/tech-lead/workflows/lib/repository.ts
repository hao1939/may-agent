import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { join } from "node:path";

export function command(
  root: string,
  argv: string[],
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    execFile(
      argv[0]!,
      argv.slice(1),
      {
        cwd: root,
        signal,
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        if (error)
          reject(
            new Error(
              `${argv[0]} failed: ${error.message}\n${stdout}\n${stderr}`.slice(
                -16_000,
              ),
            ),
          );
        else resolve(stdout.trim());
      },
    );
  });
}

export type Candidate = { commit: string; base: string; dirty: boolean };

/** Worktree allocation belongs to Runtime. This workflow only validates its input. */
export async function candidate(
  root: string,
  signal: AbortSignal,
  allowDirty = false,
): Promise<Candidate> {
  const git = (...args: string[]) => command(root, ["git", ...args], signal);
  if (
    !(await lstat(join(root, ".git"))).isFile() ||
    (await realpath(await git("rev-parse", "--show-toplevel"))) !==
      (await realpath(root))
  ) {
    throw new Error(
      "Development requires the exact Task-owned Git worktree root",
    );
  }
  const dirty = Boolean(
    await git("status", "--porcelain", "--untracked-files=all"),
  );
  if (dirty && !allowDirty) {
    throw new Error(
      "Candidate has uncommitted changes; retain them for tech-lead to inspect and commit",
    );
  }
  return {
    commit: await git("rev-parse", "HEAD"),
    base: await git("merge-base", "HEAD", "main"),
    dirty,
  };
}

export function sameCandidate(a: Candidate, b: Candidate): boolean {
  return !a.dirty && !b.dirty && a.commit === b.commit && a.base === b.base;
}

export async function describeCandidate(
  root: string,
  value: Candidate,
  signal: AbortSignal,
): Promise<string> {
  const files = await command(root, ["git", "ls-files"], signal);
  const diff = await command(
    root,
    [
      "git",
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      value.base,
      value.commit,
      "--",
    ],
    signal,
  );
  return `Tracked paths (bounded):\n${files.slice(0, 12_000)}\nCandidate diff (bounded; use read for more):\n${diff.slice(0, 48_000)}`;
}

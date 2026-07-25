import { spawnSync } from "node:child_process";

export type DirectDevIntegrationResult =
  | {
      state: "integrated";
      sourceCommit: string;
      targetCommit: string;
      targetRef: string;
    }
  | {
      state: "conflict";
      sourceCommit: string;
      targetRef: string;
      error: string;
    }
  | {
      state: "failed";
      sourceCommit: string;
      targetRef: string;
      error: string;
    };

function git(
  cwd: string,
  args: string[],
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
  if (!allowFailure && output.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${output.stderr || output.stdout}`,
    );
  }
  return output;
}

export function integrateDirectlyIntoDev(input: {
  repoDir: string;
  workspaceDir: string;
  sourceBranch: string;
  sourceCommit: string;
  maxAttempts?: number;
}): DirectDevIntegrationResult {
  const targetBranch = "dev";
  const targetRef = "origin/dev";
  const maxAttempts = input.maxAttempts ?? 3;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const fetch = git(input.repoDir, ["fetch", "origin", targetBranch], true);
    if (fetch.status !== 0) {
      lastError = fetch.stderr || fetch.stdout;
      continue;
    }
    if (
      git(
        input.repoDir,
        ["merge-base", "--is-ancestor", input.sourceCommit, targetRef],
        true,
      ).status === 0
    ) {
      return {
        state: "integrated",
        sourceCommit: input.sourceCommit,
        targetCommit: git(input.repoDir, ["rev-parse", targetRef]).stdout,
        targetRef,
      };
    }

    if (
      git(
        input.workspaceDir,
        ["merge-base", "--is-ancestor", targetRef, "HEAD"],
        true,
      ).status !== 0
    ) {
      const merge = git(
        input.workspaceDir,
        ["merge", "--no-ff", "--no-edit", targetRef],
        true,
      );
      if (merge.status !== 0) {
        return {
          state: "conflict",
          sourceCommit: input.sourceCommit,
          targetRef,
          error: merge.stderr || merge.stdout,
        };
      }
    }

    const publishSource = git(
      input.workspaceDir,
      ["push", "--set-upstream", "origin", input.sourceBranch],
      true,
    );
    if (publishSource.status !== 0) {
      lastError = publishSource.stderr || publishSource.stdout;
      continue;
    }

    const push = git(
      input.workspaceDir,
      ["push", "origin", `HEAD:${targetBranch}`],
      true,
    );
    if (push.status !== 0) {
      lastError = push.stderr || push.stdout;
      continue;
    }
    git(input.repoDir, ["fetch", "origin", targetBranch]);
    if (
      git(
        input.repoDir,
        ["merge-base", "--is-ancestor", input.sourceCommit, targetRef],
        true,
      ).status === 0
    ) {
      return {
        state: "integrated",
        sourceCommit: input.sourceCommit,
        targetCommit: git(input.repoDir, ["rev-parse", targetRef]).stdout,
        targetRef,
      };
    }
  }

  return {
    state: "failed",
    sourceCommit: input.sourceCommit,
    targetRef,
    error:
      lastError ||
      `Could not update ${targetRef} after ${String(maxAttempts)} attempts`,
  };
}

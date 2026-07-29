import { spawnSync } from "node:child_process";

export type DirectDevIntegrationResult =
  | {
      state: "integrated";
      sourceCommit: string;
      targetCommit: string;
      targetRef: string;
    }
  | {
      state: "unchanged";
      sourceCommit: string;
      targetCommit: string;
      targetRef: string;
    }
  | {
      state: "conflict";
      sourceCommit: string;
      targetRef: string;
      replayBaseCommit: string;
      error: string;
    }
  | {
      state: "requires-replay";
      reason: "source-outside-attempt-baseline" | "attempt-has-merge-commits";
      sourceCommit: string;
      taskBaseCommit: string;
      targetRef: string;
      mergeCommits: string[];
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
  taskBaseCommit: string;
  maxAttempts?: number;
}): DirectDevIntegrationResult {
  const targetBranch = "dev";
  const targetRef = "origin/dev";
  const maxAttempts = input.maxAttempts ?? 3;
  let lastError = "";

  if (
    git(
      input.workspaceDir,
      ["merge-base", "--is-ancestor", input.taskBaseCommit, input.sourceCommit],
      true,
    ).status !== 0
  ) {
    return {
      state: "requires-replay",
      reason: "source-outside-attempt-baseline",
      sourceCommit: input.sourceCommit,
      taskBaseCommit: input.taskBaseCommit,
      targetRef,
      mergeCommits: [],
    };
  }

  const mergeCommits = git(input.workspaceDir, [
    "rev-list",
    "--reverse",
    "--merges",
    `${input.taskBaseCommit}..${input.sourceCommit}`,
  ])
    .stdout.split(/\r?\n/)
    .filter(Boolean);
  if (mergeCommits.length) {
    return {
      state: "requires-replay",
      reason: "attempt-has-merge-commits",
      sourceCommit: input.sourceCommit,
      taskBaseCommit: input.taskBaseCommit,
      targetRef,
      mergeCommits,
    };
  }

  const taskCommits = git(input.workspaceDir, [
    "rev-list",
    "--reverse",
    "--no-merges",
    `${input.taskBaseCommit}..${input.sourceCommit}`,
  ])
    .stdout.split(/\r?\n/)
    .filter(Boolean);

  const remoteSourceRef = `refs/remotes/origin/${input.sourceBranch}`;
  const fetchSource = git(
    input.workspaceDir,
    ["fetch", "origin", `refs/heads/${input.sourceBranch}:${remoteSourceRef}`],
    true,
  );
  let expectedRemoteCommit =
    fetchSource.status === 0
      ? git(input.workspaceDir, ["rev-parse", remoteSourceRef], true).stdout
      : "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const fetch = git(input.repoDir, ["fetch", "origin", targetBranch], true);
    if (fetch.status !== 0) {
      lastError = fetch.stderr || fetch.stdout;
      continue;
    }
    const fetchWorkspaceTarget = git(
      input.workspaceDir,
      ["fetch", "origin", targetBranch],
      true,
    );
    if (fetchWorkspaceTarget.status !== 0) {
      lastError = fetchWorkspaceTarget.stderr || fetchWorkspaceTarget.stdout;
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

    const targetCommit = git(input.repoDir, ["rev-parse", targetRef]).stdout;
    if (!taskCommits.length) {
      return {
        state: "unchanged",
        sourceCommit: input.sourceCommit,
        targetCommit,
        targetRef,
      };
    }

    git(input.workspaceDir, ["reset", "--hard", targetCommit]);
    const replay = git(
      input.workspaceDir,
      ["cherry-pick", ...taskCommits],
      true,
    );
    if (replay.status !== 0) {
      return {
        state: "conflict",
        sourceCommit: input.sourceCommit,
        targetRef,
        replayBaseCommit: targetCommit,
        error: replay.stderr || replay.stdout,
      };
    }

    const replayedSourceCommit = git(input.workspaceDir, [
      "rev-parse",
      "HEAD",
    ]).stdout;

    const publishSource = git(
      input.workspaceDir,
      [
        "push",
        `--force-with-lease=refs/heads/${input.sourceBranch}:${expectedRemoteCommit}`,
        "--set-upstream",
        "origin",
        `HEAD:refs/heads/${input.sourceBranch}`,
      ],
      true,
    );
    if (publishSource.status !== 0) {
      lastError = publishSource.stderr || publishSource.stdout;
      continue;
    }
    expectedRemoteCommit = replayedSourceCommit;

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
        ["merge-base", "--is-ancestor", replayedSourceCommit, targetRef],
        true,
      ).status === 0
    ) {
      return {
        state: "integrated",
        sourceCommit: replayedSourceCommit,
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

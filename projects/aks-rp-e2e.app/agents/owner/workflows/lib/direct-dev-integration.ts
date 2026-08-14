import { execFile } from "node:child_process";

export type DirectDevValidationCommand = {
  name: string;
  command: string;
  args: string[];
};

export const AKS_DIRECT_DEV_VALIDATION_COMMANDS: DirectDevValidationCommand[] =
  [
    {
      name: "private source policy",
      command: "bun",
      args: ["./runner/check-private-source-policy.ts"],
    },
    {
      name: "scenario migration frontier",
      command: "bun",
      args: ["./scripts/check-scenario-tests.ts", "--guard"],
    },
    {
      name: "domain schema",
      command: "bun",
      args: ["./runner/schema-check.ts"],
    },
    {
      name: "live admission tests",
      command: "bun",
      args: [
        "test",
        "./runner/live-admission-classifier.test.ts",
        "./runner/check-live-admission.test.ts",
      ],
    },
  ];

const runtimeDataPrefixes = [
  ".state/",
  "agents/",
  "outputs/",
  "reports/",
  "runs/",
  "sessions/",
  "tasks/",
  "test-results/",
  "workspace/",
  "runner/generated/",
];

const runtimeDataPatterns = [
  /(^|\/)[^/]+\.bak(?:-.+)?$/,
  /(^|\/)[^/]+\.log$/,
  /(^|\/)[^/]+\.tmp$/,
  /^model\/knowledge-map\/model\.json\.bak(?:-.+)?$/,
];

export function candidateRuntimeDataPolicyViolations(
  paths: string[],
): string[] {
  return paths.filter((path) => {
    if (runtimeDataPrefixes.some((prefix) => path.startsWith(prefix))) {
      return true;
    }
    if (
      path.startsWith("evidence/") &&
      !path.startsWith("evidence/pipelines/")
    ) {
      return true;
    }
    return runtimeDataPatterns.some((pattern) => pattern.test(path));
  });
}

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
    }
  | {
      state: "validation-failed";
      sourceCommit: string;
      targetRef: string;
      replayBaseCommit: string;
      error: string;
    };

type CommandResult = { status: number; stdout: string; stderr: string };

function runCommand(
  cwd: string,
  command: string,
  args: string[],
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          status: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          stdout: (stdout ?? "").trim(),
          stderr: (stderr || error?.message || "").trim(),
        });
      },
    );
  });
}

async function git(
  cwd: string,
  args: string[],
  allowFailure = false,
): Promise<CommandResult> {
  const output = await runCommand(cwd, "git", args);
  if (!allowFailure && output.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${output.stderr || output.stdout}`,
    );
  }
  return output;
}

export async function integrateDirectlyIntoDev(input: {
  repoDir: string;
  workspaceDir: string;
  sourceBranch: string;
  sourceCommit: string;
  taskBaseCommit: string;
  validationCommands: DirectDevValidationCommand[];
  maxAttempts?: number;
}): Promise<DirectDevIntegrationResult> {
  const targetBranch = "dev";
  const targetRef = "origin/dev";
  const maxAttempts = input.maxAttempts ?? 3;
  let lastError = "";

  if (
    (
      await git(
        input.workspaceDir,
        [
          "merge-base",
          "--is-ancestor",
          input.taskBaseCommit,
          input.sourceCommit,
        ],
        true,
      )
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

  const remoteSourceRef = `refs/remotes/origin/${input.sourceBranch}`;
  const fetchSource = await git(
    input.workspaceDir,
    ["fetch", "origin", `refs/heads/${input.sourceBranch}:${remoteSourceRef}`],
    true,
  );
  let expectedRemoteCommit =
    fetchSource.status === 0
      ? (await git(input.workspaceDir, ["rev-parse", remoteSourceRef], true))
          .stdout
      : "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const fetch = await git(
      input.repoDir,
      ["fetch", "origin", targetBranch],
      true,
    );
    if (fetch.status !== 0) {
      lastError = fetch.stderr || fetch.stdout;
      continue;
    }
    const fetchWorkspaceTarget = await git(
      input.workspaceDir,
      ["fetch", "origin", targetBranch],
      true,
    );
    if (fetchWorkspaceTarget.status !== 0) {
      lastError = fetchWorkspaceTarget.stderr || fetchWorkspaceTarget.stdout;
      continue;
    }
    if (
      (
        await git(
          input.repoDir,
          ["merge-base", "--is-ancestor", input.sourceCommit, targetRef],
          true,
        )
      ).status === 0
    ) {
      return {
        state: "integrated",
        sourceCommit: input.sourceCommit,
        targetCommit: (await git(input.repoDir, ["rev-parse", targetRef]))
          .stdout,
        targetRef,
      };
    }

    const targetCommit = (await git(input.repoDir, ["rev-parse", targetRef]))
      .stdout;
    const mergeCommits = (
      await git(input.workspaceDir, [
        "rev-list",
        "--reverse",
        "--merges",
        `${input.taskBaseCommit}..${input.sourceCommit}`,
        "--not",
        targetRef,
      ])
    ).stdout
      .split(/\r?\n/)
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

    // An agent may refresh a stale task worktree to current origin/dev before
    // committing its change. Exclude that adopted target history from replay.
    const taskCommits = (
      await git(input.workspaceDir, [
        "rev-list",
        "--reverse",
        "--no-merges",
        `${input.taskBaseCommit}..${input.sourceCommit}`,
        "--not",
        targetRef,
      ])
    ).stdout
      .split(/\r?\n/)
      .filter(Boolean);
    if (!taskCommits.length) {
      return {
        state: "unchanged",
        sourceCommit: input.sourceCommit,
        targetCommit,
        targetRef,
      };
    }

    await git(input.workspaceDir, ["reset", "--hard", targetCommit]);
    const replay = await git(
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

    const replayedSourceCommit = (
      await git(input.workspaceDir, ["rev-parse", "HEAD"])
    ).stdout;

    const newlyTrackedPaths = (
      await git(input.workspaceDir, [
        "diff",
        "--name-only",
        "--diff-filter=ACR",
        `${targetCommit}...${replayedSourceCommit}`,
      ])
    ).stdout
      .split(/\r?\n/)
      .filter(Boolean);
    const runtimeDataViolations =
      candidateRuntimeDataPolicyViolations(newlyTrackedPaths);
    if (runtimeDataViolations.length) {
      return {
        state: "validation-failed",
        sourceCommit: replayedSourceCommit,
        targetRef,
        replayBaseCommit: targetCommit,
        error: `runtime data policy failed: candidate newly tracks ${runtimeDataViolations.join(", ")}`,
      };
    }

    const whitespace = await git(
      input.workspaceDir,
      ["diff", "--check", `${targetCommit}...${replayedSourceCommit}`],
      true,
    );
    if (whitespace.status !== 0) {
      return {
        state: "validation-failed",
        sourceCommit: replayedSourceCommit,
        targetRef,
        replayBaseCommit: targetCommit,
        error: `candidate whitespace check failed: ${whitespace.stderr || whitespace.stdout}`,
      };
    }

    for (const validation of input.validationCommands) {
      const result = await runCommand(
        input.workspaceDir,
        validation.command,
        validation.args,
      );
      if (result.status !== 0) {
        return {
          state: "validation-failed",
          sourceCommit: replayedSourceCommit,
          targetRef,
          replayBaseCommit: targetCommit,
          error: `${validation.name} failed: ${result.stderr || result.stdout || "unknown error"}`,
        };
      }
    }

    const publishSource = await git(
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

    const push = await git(
      input.workspaceDir,
      ["push", "origin", `HEAD:${targetBranch}`],
      true,
    );
    if (push.status !== 0) {
      lastError = push.stderr || push.stdout;
      continue;
    }
    await git(input.repoDir, ["fetch", "origin", targetBranch]);
    if (
      (
        await git(
          input.repoDir,
          ["merge-base", "--is-ancestor", replayedSourceCommit, targetRef],
          true,
        )
      ).status === 0
    ) {
      return {
        state: "integrated",
        sourceCommit: replayedSourceCommit,
        targetCommit: (await git(input.repoDir, ["rev-parse", targetRef]))
          .stdout,
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

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

export const historyOnlyAncestryStrategy = "history-only-ancestry" as const;

export type HistoryOnlyAncestryProof = {
  integrationStrategy: typeof historyOnlyAncestryStrategy;
  integrationCommit: string;
  sourceCommit: string;
  firstParentCommit: string;
  firstParentTree: string;
  integrationTree: string;
  historyOnlyDiff: boolean;
};

export type DirectDevIntegrationResult =
  | {
      state: "integrated";
      sourceCommit: string;
      targetCommit: string;
      targetRef: string;
      historyOnlyProof?: HistoryOnlyAncestryProof;
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

export async function verifyHistoryOnlyAncestryCandidate(input: {
  workspaceDir: string;
  candidateCommit: string;
  expectedFirstParent: string;
  expectedSourceCommit: string;
}): Promise<HistoryOnlyAncestryProof | null> {
  const parents = (
    await git(input.workspaceDir, [
      "show",
      "-s",
      "--format=%P",
      input.candidateCommit,
    ])
  ).stdout
    .split(/\s+/)
    .filter(Boolean);
  if (
    parents.length !== 2 ||
    parents[0] !== input.expectedFirstParent ||
    parents[1] !== input.expectedSourceCommit
  ) {
    return null;
  }
  const firstParentTree = (
    await git(input.workspaceDir, [
      "show",
      "-s",
      "--format=%T",
      input.expectedFirstParent,
    ])
  ).stdout;
  const integrationTree = (
    await git(input.workspaceDir, [
      "show",
      "-s",
      "--format=%T",
      input.candidateCommit,
    ])
  ).stdout;
  const historyOnlyDiff =
    (
      await git(
        input.workspaceDir,
        [
          "diff-tree",
          "--exit-code",
          input.expectedFirstParent,
          input.candidateCommit,
          "--",
        ],
        true,
      )
    ).status === 0;
  if (firstParentTree !== integrationTree || !historyOnlyDiff) return null;
  return {
    integrationStrategy: historyOnlyAncestryStrategy,
    integrationCommit: input.candidateCommit,
    sourceCommit: input.expectedSourceCommit,
    firstParentCommit: input.expectedFirstParent,
    firstParentTree,
    integrationTree,
    historyOnlyDiff,
  };
}

async function integrateHistoryOnlyAncestry(input: {
  repoDir: string;
  workspaceDir: string;
  sourceBranch: string;
  sourceCommit: string;
  validationCommands: DirectDevValidationCommand[];
  maxAttempts: number;
}): Promise<DirectDevIntegrationResult> {
  const targetBranch = "dev";
  const targetRef = "origin/dev";
  let lastError = "";
  const remoteSourceRef = `refs/remotes/origin/${input.sourceBranch}`;
  const fetchSource = await git(
    input.workspaceDir,
    ["fetch", "origin", `refs/heads/${input.sourceBranch}:${remoteSourceRef}`],
    true,
  );
  if (
    fetchSource.status !== 0 &&
    (
      await git(
        input.workspaceDir,
        ["cat-file", "-e", `${input.sourceCommit}^{commit}`],
        true,
      )
    ).status !== 0
  ) {
    return {
      state: "failed",
      sourceCommit: input.sourceCommit,
      targetRef,
      error: `could not fetch or resolve exact tested source: ${fetchSource.stderr || fetchSource.stdout}`,
    };
  }

  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    const fetchRepo = await git(
      input.repoDir,
      ["fetch", "origin", targetBranch],
      true,
    );
    const fetchWorkspace = await git(
      input.workspaceDir,
      ["fetch", "origin", targetBranch],
      true,
    );
    if (fetchRepo.status !== 0 || fetchWorkspace.status !== 0) {
      lastError =
        fetchRepo.stderr ||
        fetchRepo.stdout ||
        fetchWorkspace.stderr ||
        fetchWorkspace.stdout;
      continue;
    }
    const firstParentCommit = (
      await git(input.workspaceDir, ["rev-parse", targetRef])
    ).stdout;
    if (
      (
        await git(
          input.workspaceDir,
          [
            "merge-base",
            "--is-ancestor",
            input.sourceCommit,
            firstParentCommit,
          ],
          true,
        )
      ).status === 0
    ) {
      return {
        state: "integrated",
        sourceCommit: input.sourceCommit,
        targetCommit: firstParentCommit,
        targetRef,
      };
    }

    const firstParentTree = (
      await git(input.workspaceDir, [
        "show",
        "-s",
        "--format=%T",
        firstParentCommit,
      ])
    ).stdout;
    const candidate = await git(
      input.workspaceDir,
      [
        "commit-tree",
        firstParentTree,
        "-p",
        firstParentCommit,
        "-p",
        input.sourceCommit,
        "-m",
        `Integrate tested source ancestry ${input.sourceCommit}`,
      ],
      true,
    );
    if (candidate.status !== 0 || !candidate.stdout) {
      return {
        state: "failed",
        sourceCommit: input.sourceCommit,
        targetRef,
        error: `could not construct history-only integration commit: ${candidate.stderr || candidate.stdout}`,
      };
    }
    const proof = await verifyHistoryOnlyAncestryCandidate({
      workspaceDir: input.workspaceDir,
      candidateCommit: candidate.stdout,
      expectedFirstParent: firstParentCommit,
      expectedSourceCommit: input.sourceCommit,
    });
    if (!proof) {
      return {
        state: "validation-failed",
        sourceCommit: candidate.stdout,
        targetRef,
        replayBaseCommit: firstParentCommit,
        error:
          "history-only candidate changed the fetched origin/dev tree or had unexpected parents",
      };
    }

    await git(input.workspaceDir, ["reset", "--hard", firstParentCommit]);
    for (const validation of input.validationCommands) {
      const result = await runCommand(
        input.workspaceDir,
        validation.command,
        validation.args,
      );
      if (result.status !== 0) {
        return {
          state: "validation-failed",
          sourceCommit: candidate.stdout,
          targetRef,
          replayBaseCommit: firstParentCommit,
          error: `${validation.name} failed: ${result.stderr || result.stdout || "unknown error"}`,
        };
      }
    }

    const push = await git(
      input.workspaceDir,
      ["push", "origin", `${candidate.stdout}:refs/heads/${targetBranch}`],
      true,
    );
    if (push.status !== 0) {
      lastError = push.stderr || push.stdout;
      continue;
    }
    await git(input.repoDir, ["fetch", "origin", targetBranch]);
    await git(input.workspaceDir, ["fetch", "origin", targetBranch]);
    const publishedCommit = (
      await git(input.workspaceDir, ["rev-parse", targetRef])
    ).stdout;
    const publishedTree = (
      await git(input.workspaceDir, [
        "show",
        "-s",
        "--format=%T",
        publishedCommit,
      ])
    ).stdout;
    const candidateReachable =
      (
        await git(
          input.workspaceDir,
          ["merge-base", "--is-ancestor", candidate.stdout, publishedCommit],
          true,
        )
      ).status === 0;
    const sourceReachable =
      (
        await git(
          input.workspaceDir,
          ["merge-base", "--is-ancestor", input.sourceCommit, publishedCommit],
          true,
        )
      ).status === 0;
    if (
      candidateReachable &&
      sourceReachable &&
      publishedTree === firstParentTree
    ) {
      return {
        state: "integrated",
        sourceCommit: input.sourceCommit,
        targetCommit: publishedCommit,
        targetRef,
        historyOnlyProof: proof,
      };
    }
    lastError =
      "fresh-fetch proof did not preserve candidate ancestry and the fetched first-parent tree";
  }

  return {
    state: "failed",
    sourceCommit: input.sourceCommit,
    targetRef,
    error:
      lastError ||
      `Could not update ${targetRef} after ${String(input.maxAttempts)} attempts`,
  };
}

export async function integrateDirectlyIntoDev(input: {
  repoDir: string;
  workspaceDir: string;
  sourceBranch: string;
  sourceCommit: string;
  taskBaseCommit: string;
  validationCommands: DirectDevValidationCommand[];
  integrationStrategy?: typeof historyOnlyAncestryStrategy;
  maxAttempts?: number;
}): Promise<DirectDevIntegrationResult> {
  const targetBranch = "dev";
  const targetRef = "origin/dev";
  const maxAttempts = input.maxAttempts ?? 3;
  let lastError = "";

  if (input.integrationStrategy === historyOnlyAncestryStrategy) {
    return integrateHistoryOnlyAncestry({
      repoDir: input.repoDir,
      workspaceDir: input.workspaceDir,
      sourceBranch: input.sourceBranch,
      sourceCommit: input.sourceCommit,
      validationCommands: input.validationCommands,
      maxAttempts,
    });
  }

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

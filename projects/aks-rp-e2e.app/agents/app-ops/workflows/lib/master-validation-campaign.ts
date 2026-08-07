import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export const campaignBranchPrefix = "validation/master-validation-";

export type CampaignFix = {
  pullRequestId: string;
  taskId: string;
  sourceBranch: string;
  sourceCommit: string;
  campaignBaseCommit?: string;
  targetCommit?: string;
  patchIds?: string[];
  title: string;
};

export type CampaignReceipt = {
  schemaVersion: "1";
  baselineRunId: string;
  baseCommit: string;
  branch: string;
  currentCommit: string;
  integratedFixes: CampaignFix[];
  updatedAt: string;
};

type PullRequestLike = {
  pullRequestId?: unknown;
  status?: unknown;
  title?: unknown;
  description?: unknown;
  sourceRefName?: unknown;
  targetRefName?: unknown;
  lastMergeSourceCommit?: { commitId?: unknown };
  lastMergeTargetCommit?: { commitId?: unknown };
  mergeStatus?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
}

function branchName(value: unknown): string {
  return text(value).replace(/^refs\/heads\//, "");
}

export function campaignBranchName(baselineRunId: string): string {
  const safe = baselineRunId.trim().replace(/[^A-Za-z0-9._-]+/g, "-");
  return `${campaignBranchPrefix}${safe || "unknown"}`;
}

export function campaignFixFromPullRequest(
  pullRequest: PullRequestLike,
  options: { includeCompleted?: boolean } = {},
): CampaignFix | null {
  const status = text(pullRequest.status);
  const eligible =
    status === "active" ||
    (options.includeCompleted === true &&
      status === "completed" &&
      text(pullRequest.mergeStatus) === "succeeded");
  if (!eligible) return null;
  if (branchName(pullRequest.targetRefName) !== "main") return null;
  const description = text(pullRequest.description);
  const taskId =
    description
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) =>
        line.startsWith("Task: domain/master-validation-failure/"),
      )
      ?.slice("Task: ".length) ?? "";
  const explicitlyIncluded = description
    .split(/\r?\n/)
    .some((line) => line.trim() === "Master-Validation-Candidate: include");
  const pullRequestId = text(pullRequest.pullRequestId);
  const sourceBranch = branchName(pullRequest.sourceRefName);
  const sourceCommit = text(pullRequest.lastMergeSourceCommit?.commitId);
  const targetCommit = text(pullRequest.lastMergeTargetCommit?.commitId);
  const campaignBaseCommit =
    description
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith("Frozen campaign base: "))
      ?.slice("Frozen campaign base: ".length) ?? "";
  const title = text(pullRequest.title);
  if (!taskId && !explicitlyIncluded) {
    return null;
  }
  if (!pullRequestId || !sourceBranch || !sourceCommit) return null;
  return {
    pullRequestId,
    taskId: taskId || `pull-request/${pullRequestId}`,
    sourceBranch,
    sourceCommit,
    ...(campaignBaseCommit ? { campaignBaseCommit } : {}),
    ...(targetCommit ? { targetCommit } : {}),
    title,
  };
}

export function campaignReceiptPath(appDir: string): string {
  return join(appDir, ".state", "master-validation-campaign.json");
}

export function readCampaignReceipt(appDir: string): CampaignReceipt | null {
  const path = campaignReceiptPath(appDir);
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as CampaignReceipt;
    return value?.schemaVersion === "1" &&
      value.baselineRunId &&
      value.baseCommit &&
      value.branch &&
      value.currentCommit &&
      Array.isArray(value.integratedFixes)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function saveCampaignReceipt(
  appDir: string,
  receipt: CampaignReceipt,
): void {
  const path = campaignReceiptPath(appDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

function command(
  executable: string,
  args: string[],
  cwd: string,
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });
  const output = {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
  if (!allowFailure && output.status !== 0) {
    throw new Error(output.stderr || output.stdout || `${executable} failed`);
  }
  return output;
}

function git(cwd: string, args: string[], allowFailure = false) {
  return command("git", args, cwd, allowFailure);
}

function remoteBranchExists(repoDir: string, branch: string): boolean {
  return (
    git(
      repoDir,
      ["ls-remote", "--exit-code", "--heads", "origin", branch],
      true,
    ).status === 0
  );
}

function ensureCommit(checkout: string, commit: string): void {
  if (!commit) return;
  if (
    git(checkout, ["cat-file", "-e", `${commit}^{commit}`], true).status === 0
  ) {
    return;
  }
  git(checkout, ["fetch", "origin", commit]);
}

function hasCommit(checkout: string, commit: string): boolean {
  return (
    Boolean(commit) &&
    git(checkout, ["cat-file", "-e", `${commit}^{commit}`], true).status === 0
  );
}

function patchId(checkout: string, commit: string): string {
  const patch = git(checkout, ["show", "--pretty=format:", "--binary", commit]);
  const result = spawnSync("git", ["patch-id", "--stable"], {
    cwd: checkout,
    encoding: "utf8",
    input: patch.stdout,
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      (result.stderr || result.error?.message || "git patch-id failed").trim(),
    );
  }
  return text(result.stdout).split(/\s+/)[0] ?? "";
}

function focusedCommits(
  checkout: string,
  fix: CampaignFix,
  excludedCommits: string[],
  rangeBaseCommit = "",
): string[] {
  ensureCommit(checkout, fix.sourceCommit);
  ensureCommit(checkout, fix.targetCommit ?? "");
  const inferredParent = git(checkout, [
    "rev-parse",
    `${fix.sourceCommit}^`,
  ]).stdout;
  const exclusions = [
    rangeBaseCommit || fix.targetCommit || inferredParent,
    ...excludedCommits,
  ]
    .filter(Boolean)
    // A retained campaign receipt may name an older PR head whose branch was
    // deleted and whose object was pruned from this checkout. Its patch is
    // already present on the durable campaign branch, so that unavailable
    // object is not required to compute a new PR's focused range. If it is an
    // ancestor of the fetched source head, fetching that head necessarily
    // makes the object available and it remains an exclusion here.
    .filter((commit) => hasCommit(checkout, commit));
  const commits = git(checkout, [
    "rev-list",
    "--reverse",
    "--topo-order",
    fix.sourceCommit,
    ...exclusions.map((commit) => `^${commit}`),
  ])
    .stdout.split(/\r?\n/)
    .map((commit) => commit.trim())
    .filter(Boolean);
  for (const commit of commits) {
    const parents = git(checkout, ["rev-list", "--parents", "-n", "1", commit])
      .stdout.split(/\s+/)
      .filter(Boolean);
    if (parents.length > 2) {
      throw new Error(
        `Campaign fix PR ${fix.pullRequestId} contains merge commit ${commit}; keep the focused PR linear so only its repair patch can enter the frozen campaign.`,
      );
    }
  }
  return commits;
}

function prepareFix(
  checkout: string,
  fix: CampaignFix,
  excludedCommits: string[],
  rangeBaseCommit = "",
): { fix: CampaignFix; commits: string[] } {
  git(
    checkout,
    [
      "fetch",
      "origin",
      `+refs/heads/${fix.sourceBranch}:refs/remotes/origin/${fix.sourceBranch}`,
    ],
    true,
  );
  ensureCommit(checkout, fix.sourceCommit);
  const focused = focusedCommits(
    checkout,
    fix,
    excludedCommits,
    rangeBaseCommit,
  );
  const sourceBearing = focused
    .map((commit) => ({ commit, patchId: patchId(checkout, commit) }))
    .filter((candidate) => Boolean(candidate.patchId));
  if (!sourceBearing.length) {
    throw new Error(
      `Campaign fix PR ${fix.pullRequestId} contains no source-bearing focused commit; publish a source-bearing focused repair.`,
    );
  }
  return {
    fix: {
      ...fix,
      patchIds: sourceBearing.map((candidate) => candidate.patchId),
    },
    commits: sourceBearing.map((candidate) => candidate.commit),
  };
}

function samePatchSeries(left: CampaignFix, right: CampaignFix): boolean {
  return (
    Boolean(left.patchIds?.length) &&
    left.patchIds?.join(",") === right.patchIds?.join(",")
  );
}

function applyFix(
  checkout: string,
  prepared: { fix: CampaignFix; commits: string[] },
  composedPredecessors: string[] = [],
): { fix: CampaignFix; commits: string[] } {
  const startingCommit = git(checkout, ["rev-parse", "HEAD"]).stdout;
  let failure = "";
  for (const commit of prepared.commits) {
    const applied = git(
      checkout,
      [
        "-c",
        "user.name=May Agent",
        "-c",
        "user.email=may-agent@localhost",
        "cherry-pick",
        commit,
      ],
      true,
    );
    if (applied.status !== 0) {
      failure = applied.stderr || applied.stdout;
      git(checkout, ["cherry-pick", "--abort"], true);
      git(checkout, ["reset", "--hard", startingCommit]);
      break;
    }
  }
  if (!failure) return prepared;

  const replayCommit = prepared.commits.at(-1) ?? "";
  if (
    prepared.commits.length > 1 &&
    replayCommit === prepared.fix.sourceCommit
  ) {
    const replay = git(
      checkout,
      [
        "-c",
        "user.name=May Agent",
        "-c",
        "user.email=may-agent@localhost",
        "cherry-pick",
        replayCommit,
      ],
      true,
    );
    if (
      replay.status === 0 &&
      replayedFilesMatchSource(checkout, replayCommit)
    ) {
      const retainedPatchIds = (prepared.fix.patchIds ?? []).slice(
        0,
        Math.max(
          0,
          (prepared.fix.patchIds?.length ?? 0) - prepared.commits.length,
        ),
      );
      return {
        fix: {
          ...prepared.fix,
          patchIds: [...retainedPatchIds, patchId(checkout, replayCommit)],
        },
        commits: [replayCommit],
      };
    }
    git(checkout, ["cherry-pick", "--abort"], true);
    git(checkout, ["reset", "--hard", startingCommit]);
  }

  throw new Error(
    `Campaign focused-patch conflict for PR ${prepared.fix.pullRequestId} (${prepared.fix.taskId}) at ${prepared.commits[0] ?? prepared.fix.sourceCommit} from PR head ${prepared.fix.sourceCommit}${composedPredecessors.length ? ` after composed predecessors ${composedPredecessors.join(",")}` : ""}: ${failure}`,
  );
}

function replayedFilesMatchSource(
  checkout: string,
  sourceCommit: string,
): boolean {
  const paths = git(checkout, [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    `${sourceCommit}^`,
    sourceCommit,
  ])
    .stdout.split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
  if (!paths.length) return false;
  return paths.every((path) => {
    const expected = git(
      checkout,
      ["rev-parse", `${sourceCommit}:${path}`],
      true,
    );
    const actual = git(checkout, ["rev-parse", `HEAD:${path}`], true);
    return (
      expected.status === actual.status &&
      (expected.status !== 0 || expected.stdout === actual.stdout)
    );
  });
}

export function composeFrozenCampaign(input: {
  appDir: string;
  repoDir: string;
  baselineRunId: string;
  baseCommit: string;
  fixes: CampaignFix[];
  replacementFixes?: CampaignFix[];
  prior?: CampaignReceipt | null;
}): { receipt: CampaignReceipt; changed: boolean } {
  if (
    input.prior &&
    (input.prior.baselineRunId !== input.baselineRunId ||
      input.prior.baseCommit !== input.baseCommit)
  ) {
    throw new Error(
      `Campaign receipt ${input.prior.baselineRunId}@${input.prior.baseCommit} does not match requested frozen base ${input.baselineRunId}@${input.baseCommit}`,
    );
  }
  const branch =
    input.prior?.baselineRunId === input.baselineRunId
      ? input.prior.branch
      : campaignBranchName(input.baselineRunId);
  const stateDir = join(input.appDir, ".state");
  mkdirSync(stateDir, { recursive: true });
  const checkout = mkdtempSync(join(stateDir, "master-validation-campaign-"));
  try {
    const originUrl = git(input.repoDir, [
      "remote",
      "get-url",
      "origin",
    ]).stdout;
    git(stateDir, [
      "clone",
      "--shared",
      "--no-checkout",
      input.repoDir,
      checkout,
    ]);
    git(checkout, ["remote", "set-url", "origin", originUrl]);
    const credentialHelper = git(
      input.repoDir,
      ["config", "--get", "credential.helper"],
      true,
    ).stdout;
    if (credentialHelper) {
      git(checkout, ["config", "credential.helper", credentialHelper]);
    }

    const existed = remoteBranchExists(checkout, branch);
    if (existed) {
      git(checkout, [
        "fetch",
        "origin",
        `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
      ]);
      git(checkout, ["checkout", "--detach", `refs/remotes/origin/${branch}`]);
      if (
        git(
          checkout,
          ["merge-base", "--is-ancestor", input.baseCommit, "HEAD"],
          true,
        ).status !== 0
      ) {
        throw new Error(
          `Campaign branch ${branch} no longer descends from frozen base ${input.baseCommit}`,
        );
      }
    } else {
      git(checkout, ["fetch", "origin", input.baseCommit]);
      git(checkout, ["checkout", "--detach", input.baseCommit]);
    }

    const integrated: CampaignFix[] = [];
    const composedThisRun: CampaignFix[] = [];
    let changed = false;
    const excludedCommits = [input.baseCommit];
    for (const fix of input.prior?.integratedFixes ?? []) {
      const prepared = fix.patchIds?.length
        ? { fix, commits: [] }
        : prepareFix(checkout, fix, excludedCommits);
      integrated.push(prepared.fix);
      excludedCommits.push(prepared.fix.sourceCommit);
    }

    const incorporate = (fix: CampaignFix, replacementOnly: boolean): void => {
      const exactIndex = integrated.findIndex(
        (candidate) => candidate.pullRequestId === fix.pullRequestId,
      );
      if (exactIndex >= 0) {
        const priorFix = integrated[exactIndex];
        if (priorFix.sourceCommit === fix.sourceCommit) {
          integrated[exactIndex] = { ...fix, patchIds: priorFix.patchIds };
          return;
        }
        ensureCommit(checkout, fix.sourceCommit);
        if (
          git(
            checkout,
            [
              "merge-base",
              "--is-ancestor",
              priorFix.sourceCommit,
              fix.sourceCommit,
            ],
            true,
          ).status !== 0
        ) {
          throw new Error(
            `Campaign fix PR ${fix.pullRequestId} rewrote its already integrated focused patch. Append a corrective commit or publish a new focused PR so the frozen campaign keeps auditable history.`,
          );
        }
        const delta = prepareFix(
          checkout,
          fix,
          excludedCommits.filter((commit) => commit !== priorFix.sourceCommit),
          priorFix.sourceCommit,
        );
        const updatedFix = {
          ...delta.fix,
          patchIds: [
            ...(priorFix.patchIds ?? []),
            ...(delta.fix.patchIds ?? []),
          ],
        };
        const applied = applyFix(
          checkout,
          { ...delta, fix: updatedFix },
          composedThisRun.map((candidate) => candidate.sourceCommit),
        );
        integrated[exactIndex] = applied.fix;
        composedThisRun.push(applied.fix);
        excludedCommits.push(applied.fix.sourceCommit);
        changed ||= applied.commits.length > 0;
        return;
      }

      const prepared = prepareFix(checkout, fix, excludedCommits);

      const equivalentIndex = integrated.findIndex(
        (candidate) =>
          candidate.taskId === prepared.fix.taskId &&
          samePatchSeries(candidate, prepared.fix),
      );
      if (equivalentIndex >= 0) {
        integrated[equivalentIndex] = prepared.fix;
        excludedCommits.push(prepared.fix.sourceCommit);
        return;
      }
      if (replacementOnly) return;

      const applied = applyFix(
        checkout,
        prepared,
        composedThisRun.map((candidate) => candidate.sourceCommit),
      );
      integrated.push(applied.fix);
      composedThisRun.push(applied.fix);
      excludedCommits.push(applied.fix.sourceCommit);
      changed ||= applied.commits.length > 0;
    };

    for (const fix of [...input.fixes].sort(
      (left, right) => Number(left.pullRequestId) - Number(right.pullRequestId),
    )) {
      incorporate(fix, false);
    }
    for (const fix of [...(input.replacementFixes ?? [])].sort(
      (left, right) => Number(left.pullRequestId) - Number(right.pullRequestId),
    )) {
      incorporate(fix, true);
    }
    const currentCommit = git(checkout, ["rev-parse", "HEAD"]).stdout;
    if (!existed || changed) {
      git(checkout, ["push", "origin", `HEAD:refs/heads/${branch}`]);
    }
    const receipt: CampaignReceipt = {
      schemaVersion: "1",
      baselineRunId: input.baselineRunId,
      baseCommit: input.baseCommit,
      branch,
      currentCommit,
      integratedFixes: [...integrated].sort(
        (left, right) =>
          Number(left.pullRequestId) - Number(right.pullRequestId),
      ),
      updatedAt: new Date().toISOString(),
    };
    saveCampaignReceipt(input.appDir, receipt);
    return { receipt, changed: !existed || changed };
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
}

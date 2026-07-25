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
): CampaignFix | null {
  if (text(pullRequest.status) !== "active") return null;
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
  const title = text(pullRequest.title);
  const conventionalMasterValidationFix =
    sourceBranch.includes("master-validation") &&
    /master[ -]validation/i.test(`${title}\n${description}`);
  if (!taskId && !explicitlyIncluded && !conventionalMasterValidationFix) {
    return null;
  }
  if (!pullRequestId || !sourceBranch || !sourceCommit) return null;
  return {
    pullRequestId,
    taskId: taskId || `pull-request/${pullRequestId}`,
    sourceBranch,
    sourceCommit,
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

function mergeFix(
  checkout: string,
  fix: CampaignFix,
  input: {
    baseCommit: string;
    allowedCampaignCommits: string[];
  },
): { fix: CampaignFix; merged: boolean } {
  git(checkout, [
    "fetch",
    "origin",
    `+refs/heads/${fix.sourceBranch}:refs/remotes/origin/${fix.sourceBranch}`,
  ]);
  const fetchedCommit = git(checkout, [
    "rev-parse",
    `refs/remotes/origin/${fix.sourceBranch}`,
  ]).stdout;
  const currentFix = { ...fix, sourceCommit: fetchedCommit };
  git(checkout, ["fetch", "origin", "main"]);
  const forkCommit = git(checkout, [
    "merge-base",
    fetchedCommit,
    "refs/remotes/origin/main",
  ]).stdout;
  const rootedAtFrozenBase =
    git(
      checkout,
      ["merge-base", "--is-ancestor", forkCommit, input.baseCommit],
      true,
    ).status === 0;
  const rootedAtIntegratedFix = input.allowedCampaignCommits.some(
    (commit) =>
      git(checkout, ["merge-base", "--is-ancestor", forkCommit, commit], true)
        .status === 0,
  );
  if (!rootedAtFrozenBase && !rootedAtIntegratedFix) {
    throw new Error(
      `Campaign fix PR ${fix.pullRequestId} forks from newer main commit ${forkCommit}; rebase only the focused fix onto frozen base ${input.baseCommit} or the existing campaign lineage instead of resyncing main.`,
    );
  }
  if (
    git(checkout, ["merge-base", "--is-ancestor", fetchedCommit, "HEAD"], true)
      .status === 0
  ) {
    return { fix: currentFix, merged: false };
  }
  const merged = git(
    checkout,
    [
      "-c",
      "user.name=May Agent",
      "-c",
      "user.email=may-agent@localhost",
      "merge",
      "--no-ff",
      "--no-edit",
      fetchedCommit,
    ],
    true,
  );
  if (merged.status !== 0) {
    git(checkout, ["merge", "--abort"], true);
    throw new Error(
      `Campaign fix merge conflict for PR ${fix.pullRequestId} (${fix.sourceBranch}): ${merged.stderr || merged.stdout}`,
    );
  }
  return { fix: currentFix, merged: true };
}

export function composeFrozenCampaign(input: {
  appDir: string;
  repoDir: string;
  baselineRunId: string;
  baseCommit: string;
  fixes: CampaignFix[];
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

    const integrated = new Map(
      (input.prior?.integratedFixes ?? []).map((fix) => [
        fix.pullRequestId,
        fix,
      ]),
    );
    let changed = false;
    const allowedCampaignCommits = [...integrated.values()].map(
      (fix) => fix.sourceCommit,
    );
    for (const fix of [...input.fixes].sort(
      (left, right) => Number(left.pullRequestId) - Number(right.pullRequestId),
    )) {
      const result = mergeFix(checkout, fix, {
        baseCommit: input.baseCommit,
        allowedCampaignCommits,
      });
      integrated.set(result.fix.pullRequestId, result.fix);
      allowedCampaignCommits.push(result.fix.sourceCommit);
      changed ||= result.merged;
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
      integratedFixes: [...integrated.values()].sort(
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

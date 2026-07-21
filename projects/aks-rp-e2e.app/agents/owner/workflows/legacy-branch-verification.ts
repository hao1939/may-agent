import { spawnSync } from "node:child_process";
import {
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
  workflowResultVersion,
} from "@may-agent/sdk";
import {
  captureLegacyVerificationBaseline,
  verifyLegacyBranchCandidate,
  type LegacyBranchVerification,
} from "./lib/legacy-branch-verifier.ts";

export const name = "legacy-branch-verification";
export const description =
  "Apply one unattached legacy branch to current origin/dev, rerun conventional checks, and merge/delete it on pass.";
export const workspace = "task";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "legacy-branch-verification-v1",
  input: {
    required: ["one exact source branch and head"],
    optional: [],
    description: "Verify one clean unattached legacy branch.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions"],
    description:
      "Converges only after pass+merge+ref cleanup or already-represented cleanup; conflicts and failed checks remain visible.",
  },
};

type SourceBranch = { branch: string; head: string; files?: string[] };

function matchingJsonObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return text.slice(start, index + 1);
  }
  return null;
}

function sourceBranch(raw: string): SourceBranch | null {
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const firstBrace = scoped.indexOf("{");
  if (firstBrace < 0) return null;
  const objectText = matchingJsonObject(scoped, firstBrace);
  if (!objectText) return null;
  try {
    const payload = JSON.parse(objectText) as {
      input?: { branches?: unknown };
    };
    const branches = payload.input?.branches;
    if (!Array.isArray(branches) || branches.length !== 1) return null;
    const row = branches[0] as Record<string, unknown>;
    if (typeof row.branch !== "string" || typeof row.head !== "string")
      return null;
    return {
      branch: row.branch,
      head: row.head,
      files: Array.isArray(row.files)
        ? row.files.filter((file): file is string => typeof file === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function git(
  cwd: string,
  args: string[],
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = {
    status: result.status ?? 1,
    stdout: result.stdout?.trim() ?? "",
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
  if (!allowFailure && output.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${output.stderr || output.stdout}`,
    );
  }
  return output;
}

function refHead(repoDir: string, ref: string): string | null {
  const result = git(
    repoDir,
    ["rev-parse", "--verify", `${ref}^{commit}`],
    true,
  );
  return result.status === 0 ? result.stdout : null;
}

function remoteHead(repoDir: string, branch: string): string | null {
  const result = git(
    repoDir,
    ["ls-remote", "--heads", "origin", `refs/heads/${branch}`],
    true,
  );
  if (result.status !== 0) {
    throw new Error(
      `Could not inspect remote source ${branch}: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout ? result.stdout.split(/\s+/)[0] : null;
}

function assertSource(repoDir: string, source: SourceBranch): void {
  const attached = git(repoDir, ["worktree", "list", "--porcelain"])
    .stdout.split("\n")
    .filter((line) => line.startsWith("branch refs/heads/"))
    .map((line) => line.slice("branch refs/heads/".length));
  if (attached.includes(source.branch)) {
    throw new Error(`Source branch is worktree-attached: ${source.branch}`);
  }
  const local = refHead(repoDir, source.branch);
  if (local !== source.head) {
    throw new Error(
      `Source branch ${source.branch} moved from ${source.head} to ${local ?? "missing"}`,
    );
  }
  const remote = remoteHead(repoDir, source.branch);
  if (remote && remote !== source.head) {
    throw new Error(
      `Remote source ${source.branch} moved from ${source.head} to ${remote}`,
    );
  }
}

function cleanSourceRefs(repoDir: string, source: SourceBranch): void {
  assertSource(repoDir, source);
  if (remoteHead(repoDir, source.branch)) {
    git(repoDir, ["push", "origin", "--delete", source.branch]);
  }
  git(repoDir, ["branch", "-D", "--", source.branch]);
}

function stepEvidence(verification: LegacyBranchVerification): string[] {
  return verification.steps.map(
    (step) =>
      `verify:${step.label}:${step.status === 0 ? "pass" : "fail"}:${step.command}${
        step.status === 0 || !step.output ? "" : `:${step.output.slice(-800)}`
      }`,
  );
}

export type LegacyCandidateVerifier = (
  workspaceDir: string,
  projectDir: string,
  baseCommit: string,
  baseline: ReturnType<typeof captureLegacyVerificationBaseline>,
) => LegacyBranchVerification;

export type LegacyBaselineProvider = typeof captureLegacyVerificationBaseline;

export async function executeWithVerifier(
  ctx: WorkflowContext,
  verifier: LegacyCandidateVerifier,
  baselineProvider: LegacyBaselineProvider = captureLegacyVerificationBaseline,
): Promise<WorkflowResult> {
  const repoDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const workspaceDir = ctx.workspaceDir ?? repoDir;
  const source = sourceBranch(ctx.task);
  if (workspaceDir === repoDir || !source) {
    return ctx.blocked(
      "Legacy branch verification requires a task worktree and exactly one source branch",
      { workspaceDir, repoDir, source },
    );
  }

  try {
    git(repoDir, ["fetch", "origin", "dev"]);
    assertSource(repoDir, source);
    const dirty = git(workspaceDir, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (dirty)
      throw new Error(`Task worktree is dirty before verification:\n${dirty}`);
    const baseCommit = git(repoDir, ["rev-parse", "origin/dev"]).stdout;
    git(workspaceDir, ["reset", "--hard", baseCommit]);
    const baseline = baselineProvider(workspaceDir);
    const baselineDirty = git(workspaceDir, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (baselineDirty) {
      throw new Error(
        `Baseline verification changed the task worktree:\n${baselineDirty}`,
      );
    }

    const merge = git(
      workspaceDir,
      ["merge", "--no-ff", "--no-edit", source.branch],
      true,
    );
    if (merge.status !== 0) {
      const conflicts = git(workspaceDir, [
        "diff",
        "--name-only",
        "--diff-filter=U",
      ]).stdout;
      git(workspaceDir, ["merge", "--abort"], true);
      git(workspaceDir, ["reset", "--hard", baseCommit]);
      return ctx.blocked(
        "Legacy branch merge conflict requires focused repair",
        {
          branch: source.branch,
          head: source.head,
          conflicts: conflicts.split("\n").filter(Boolean),
          error: merge.stderr || merge.stdout,
        },
      );
    }

    const candidateHead = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    if (
      git(workspaceDir, ["diff", "--quiet", baseCommit, candidateHead], true)
        .status === 0
    ) {
      git(workspaceDir, ["reset", "--hard", baseCommit]);
      cleanSourceRefs(repoDir, source);
      const summary = `Removed ${source.branch}; its tree change is already represented in origin/dev.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          `branch:${source.branch}@${source.head}:already-represented`,
          `base-commit:${baseCommit}`,
        ],
        actions: [],
      });
    }

    const verification = verifier(workspaceDir, repoDir, baseCommit, baseline);
    if (!verification.passed) {
      return ctx.blocked("Legacy branch verification failed", {
        branch: source.branch,
        head: source.head,
        baseCommit,
        candidateHead,
        changedFiles: verification.changedFiles,
        reason: verification.reason,
        steps: verification.steps,
      });
    }

    const verificationDirty = git(workspaceDir, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (verificationDirty) {
      return ctx.blocked("Legacy branch verification left uncommitted files", {
        branch: source.branch,
        head: source.head,
        changed: verificationDirty.split("\n").filter(Boolean),
      });
    }

    git(repoDir, ["fetch", "origin", "dev"]);
    const currentBase = git(repoDir, ["rev-parse", "origin/dev"]).stdout;
    if (currentBase !== baseCommit) {
      git(workspaceDir, ["reset", "--hard", currentBase]);
      return ctx.blocked(
        "Legacy branch base changed; retry verification against current origin/dev",
        { branch: source.branch, baseCommit, currentBase },
      );
    }
    assertSource(repoDir, source);
    if (
      git(
        workspaceDir,
        ["merge-base", "--is-ancestor", currentBase, candidateHead],
        true,
      ).status !== 0
    ) {
      throw new Error("Verified candidate is not a fast-forward of origin/dev");
    }
    git(workspaceDir, ["push", "origin", "HEAD:dev"]);
    git(repoDir, ["fetch", "origin", "dev"]);
    if (git(repoDir, ["rev-parse", "origin/dev"]).stdout !== candidateHead) {
      throw new Error("origin/dev did not advance to the verified candidate");
    }
    cleanSourceRefs(repoDir, source);
    const summary = `Verified and merged ${source.branch} into origin/dev at ${candidateHead}; removed its local and remote refs.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [
        `branch:${source.branch}@${source.head}:verified-merged`,
        `base-commit:${baseCommit}`,
        `result-commit:${candidateHead}`,
        `changed-files:${verification.changedFiles.join(",")}`,
        ...stepEvidence(verification),
      ],
      actions: [],
    });
  } catch (error) {
    return ctx.blocked("Legacy branch verification closeout failed safely", {
      branch: source.branch,
      head: source.head,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return executeWithVerifier(
    ctx,
    (workspaceDir, projectDir, baseCommit, baseline) =>
      verifyLegacyBranchCandidate(
        workspaceDir,
        projectDir,
        baseCommit,
        baseline,
      ),
  );
}

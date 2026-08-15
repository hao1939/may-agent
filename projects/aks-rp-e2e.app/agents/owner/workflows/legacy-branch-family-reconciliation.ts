import { spawnSync } from "node:child_process";
import {
  Type,
  type ExecutionResult,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";

export const name = "legacy-branch-family-reconciliation";
export const description =
  "Review one bounded unattached legacy branch family, integrate its valuable result into origin/dev or reject it, and close the represented refs.";
export const workspace = "task";

type SourceBranch = { branch: string; head: string; files?: string[] };
type BranchDecision = {
  branch: string;
  head: string;
  disposition: "represented" | "rejected";
  reason: string;
};
type FamilyReview = {
  decision: "integrate" | "reject" | "needs-owner";
  summary: string;
  evidence: string[];
  verification: string[];
  branchDecisions: BranchDecision[];
};

const reviewSchema = Type.Object({
  decision: Type.Union([
    Type.Literal("integrate"),
    Type.Literal("reject"),
    Type.Literal("needs-owner"),
  ]),
  summary: Type.String({ minLength: 1 }),
  evidence: Type.Array(Type.String({ minLength: 1 })),
  verification: Type.Array(Type.String({ minLength: 1 })),
  branchDecisions: Type.Array(
    Type.Object({
      branch: Type.String({ minLength: 1 }),
      head: Type.String({ minLength: 7 }),
      disposition: Type.Union([
        Type.Literal("represented"),
        Type.Literal("rejected"),
      ]),
      reason: Type.String({ minLength: 1 }),
    }),
  ),
});

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sourceBranches(value: unknown): SourceBranch[] {
  const branches = record(value).branches;
  if (!Array.isArray(branches)) return [];
  return branches.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    if (typeof row.branch !== "string" || typeof row.head !== "string")
      return [];
    return [
      {
        branch: row.branch,
        head: row.head,
        files: Array.isArray(row.files)
          ? row.files.filter((file): file is string => typeof file === "string")
          : [],
      },
    ];
  });
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
      `git ${args.join(" ")} failed in ${cwd}: ${output.stderr || output.stdout}`,
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

function attachedBranches(repoDir: string): Set<string> {
  return new Set(
    git(repoDir, ["worktree", "list", "--porcelain"])
      .stdout.split("\n")
      .filter((line) => line.startsWith("branch refs/heads/"))
      .map((line) => line.slice("branch refs/heads/".length)),
  );
}

function assertSourceRefs(repoDir: string, branches: SourceBranch[]): void {
  const attached = attachedBranches(repoDir);
  for (const source of branches) {
    if (attached.has(source.branch)) {
      throw new Error(
        `Source branch became worktree-attached: ${source.branch}`,
      );
    }
    const localHead = refHead(repoDir, source.branch);
    if (localHead !== source.head) {
      throw new Error(
        `Source branch ${source.branch} moved from ${source.head} to ${localHead ?? "missing"}`,
      );
    }
    const remoteHead = refHead(repoDir, `origin/${source.branch}`);
    if (remoteHead && remoteHead !== source.head) {
      throw new Error(
        `Remote source branch ${source.branch} moved from ${source.head} to ${remoteHead}`,
      );
    }
  }
}

function validateReview(branches: SourceBranch[], review: FamilyReview): void {
  const expected = new Map(
    branches.map((branch) => [branch.branch, branch.head]),
  );
  if (review.branchDecisions.length !== expected.size) {
    throw new Error(
      "Review must return exactly one decision for every source branch",
    );
  }
  const seen = new Set<string>();
  for (const decision of review.branchDecisions) {
    if (seen.has(decision.branch))
      throw new Error(`Duplicate branch decision: ${decision.branch}`);
    seen.add(decision.branch);
    if (expected.get(decision.branch) !== decision.head) {
      throw new Error(`Review head mismatch for ${decision.branch}`);
    }
  }
  const represented = review.branchDecisions.filter(
    (decision) => decision.disposition === "represented",
  );
  if (review.decision === "integrate" && represented.length === 0) {
    throw new Error(
      "Integrate review must represent at least one source branch",
    );
  }
  if (review.decision === "reject" && represented.length > 0) {
    throw new Error("Reject review cannot mark a source branch represented");
  }
}

function cleanSourceRefs(repoDir: string, branches: SourceBranch[]): void {
  assertSourceRefs(repoDir, branches);
  const remoteBranches = branches
    .filter((source) => refHead(repoDir, `origin/${source.branch}`))
    .map((source) => source.branch);
  if (remoteBranches.length) {
    git(repoDir, ["push", "origin", "--delete", ...remoteBranches]);
  }
  for (const source of branches)
    git(repoDir, ["branch", "-D", "--", source.branch]);
}

export async function execute(
  ctx: WorkflowContext,
): Promise<ExecutionResult<TaskReconcileResult> | ExecutionResult> {
  const repoDir = ctx.workspace?.projectRoot;
  const workspaceDir = ctx.workspace?.root;
  const branches = sourceBranches(ctx.reconciliation?.input ?? ctx.input);
  if (!repoDir || !workspaceDir) {
    throw new Error(
      "legacy-branch-family-reconciliation requires project and task workspace roots",
    );
  }
  if (workspaceDir === repoDir || branches.length === 0) {
    return ctx.blocked(
      "Legacy branch reconciliation requires a task worktree and exact source branches",
      {
        workspaceDir,
        repoDir,
        branchCount: branches.length,
      },
    );
  }

  try {
    git(repoDir, ["fetch", "origin", "dev"]);
    assertSourceRefs(repoDir, branches);
  } catch (error) {
    return ctx.blocked("Legacy branch reconciliation preflight failed", {
      error: error instanceof Error ? error.message : String(error),
      branches,
    });
  }
  const baseCommit = git(repoDir, ["rev-parse", "origin/dev"]).stdout;
  const prompt = [
    "Review one bounded family of legacy AKS task branches.",
    `Work only in the supplied task worktree: ${workspaceDir}.`,
    `Current integration authority is origin/dev at ${baseCommit}.`,
    "Do not push, delete refs, create another branch/worktree, or edit task state; the workflow performs deterministic integration and cleanup after your review.",
    "Inspect every source branch patch against current origin/dev and against its siblings. Treat redo, repair, and publish names as attempts, not separate requirements.",
    "If valuable work remains, apply the smallest coherent final result in this task worktree, run scoped verification, commit it, and leave the worktree clean. Mark source branches whose exact patches are carried as represented; mark stale, duplicate, incorrect, or superseded attempts rejected with a concrete reason.",
    "A clean task-branch commit may remain from a previous origin/dev race. Rebase, cherry-pick, or adapt that result onto the current origin/dev before returning; do not discard useful reviewed work merely because the base advanced.",
    "If no work should land, leave the task worktree unchanged and reject every source branch with evidence.",
    "Use needs-owner only when repository evidence cannot support a safe integrate-or-reject decision.",
    "Source branches:",
    JSON.stringify(branches, null, 2),
    "Task:",
    JSON.stringify(ctx.reconciliation ?? ctx.input, null, 2),
  ].join("\n\n");
  const result = await ctx.agents.call(
    ctx.reconciliation?.owner ?? "aks-explorer",
    prompt,
    {
      timeoutMs: 1_800_000,
      schema: reviewSchema,
    },
  );
  if (result.status !== "done") {
    return ctx.blocked("Legacy branch family review session failed", {
      executionId: result.id,
      status: result.status,
      summary: result.summary,
    });
  }

  const review = result.output as FamilyReview;
  try {
    validateReview(branches, review);
    const dirty = git(workspaceDir, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (dirty)
      throw new Error(`Task worktree is dirty after review:\n${dirty}`);
    git(repoDir, ["fetch", "origin", "dev"]);
    const currentBase = git(repoDir, ["rev-parse", "origin/dev"]).stdout;
    if (currentBase !== baseCommit) {
      const summary = `origin/dev moved from ${baseCommit} to ${currentBase} during legacy branch review; the branch family must be re-evaluated against the new integration base before refs are changed.`;
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence: [
          ...review.evidence,
          `base-commit:${baseCommit}`,
          `current-origin-dev:${currentBase}`,
          `review-execution:${result.id}`,
        ],
      });
    }
    assertSourceRefs(repoDir, branches);
    const headCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;

    if (review.decision === "needs-owner") {
      const summary = `${review.summary} No Git refs were changed.`;
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence: review.evidence,
      });
    }

    if (review.decision === "integrate") {
      if (headCommit === baseCommit)
        throw new Error("Integrate review produced no task commit");
      if (
        git(
          workspaceDir,
          ["merge-base", "--is-ancestor", baseCommit, headCommit],
          true,
        ).status !== 0
      ) {
        throw new Error(
          "Task result is not a fast-forward descendant of reviewed origin/dev",
        );
      }
      git(workspaceDir, ["push", "origin", "HEAD:dev"]);
      git(repoDir, ["fetch", "origin", "dev"]);
      if (git(repoDir, ["rev-parse", "origin/dev"]).stdout !== headCommit) {
        throw new Error("origin/dev did not advance to the reviewed task head");
      }
    } else {
      if (
        git(workspaceDir, ["diff", "--quiet", baseCommit, headCommit], true)
          .status !== 0
      ) {
        const summary =
          "Reject review left a net source change in the task worktree; the owner must re-evaluate whether to integrate the produced change or restore the task branch before source refs are changed.";
        return ctx.done(summary, {
          state: "needs-owner",
          summary,
          evidence: [
            ...review.evidence,
            `base-commit:${baseCommit}`,
            `result-commit:${headCommit}`,
            `review-execution:${result.id}`,
          ],
        });
      }
    }

    cleanSourceRefs(repoDir, branches);
    const summary = `${review.summary} Closed ${branches.length} source branch ref(s) by ${review.decision === "integrate" ? `integrating ${headCommit} into origin/dev` : "explicit rejection"}.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [
        ...review.evidence,
        ...review.verification.map((entry) => `verification:${entry}`),
        `base-commit:${baseCommit}`,
        `result-commit:${headCommit}`,
        ...review.branchDecisions.map(
          (decision) =>
            `branch:${decision.branch}@${decision.head}:${decision.disposition}:${decision.reason}`,
        ),
      ],
      actions: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const baseChanged = message.startsWith("origin/dev moved from ");
    return ctx.blocked(
      baseChanged
        ? "Legacy branch family base changed; retry from current origin/dev"
        : "Legacy branch family closeout failed; owner review required",
      {
        error: message,
        review,
        branches,
        executionId: result.id,
      },
    );
  }
}

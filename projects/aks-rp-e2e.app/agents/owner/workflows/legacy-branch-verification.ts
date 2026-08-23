import { spawnSync } from "node:child_process";
import {
  Type,
  type ExecutionResult,
  type TaskReconcileResult,
  type TaskVerificationContext,
  type TaskVerificationResult,
  type WorkflowContext,
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
type SourceBranch = { branch: string; head: string; files?: string[] };

export type LegacyRepairRequest = {
  cause: "merge-conflict" | "verification-failure";
  source: SourceBranch;
  workspaceDir: string;
  baseCommit: string;
  candidateHead: string;
  attempt: number;
  conflicts: string[];
  failureEvidence: string[];
  feedback: string;
};

export type LegacyRepairDecision = {
  decision: "repaired" | "retry" | "reject" | "needs-agent";
  summary: string;
  evidence: string[];
};

export type LegacyRepairAgent = (
  request: LegacyRepairRequest,
) => Promise<LegacyRepairDecision>;

const repairSchema = Type.Object({
  decision: Type.Union([
    Type.Literal("repaired"),
    Type.Literal("retry"),
    Type.Literal("reject"),
    Type.Literal("needs-agent"),
  ]),
  summary: Type.String({ minLength: 1 }),
  evidence: Type.Array(Type.String({ minLength: 1 })),
});

const maxRepairIterations = 3;
const maxWorkflowEvidence = 32;

export function boundedWorkflowEvidence(values: string[]): string[] {
  const entries = [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ];
  if (entries.length <= maxWorkflowEvidence) return entries;
  const retainedHead = entries.slice(0, maxWorkflowEvidence - 4);
  const retainedTail = entries.slice(-3);
  return [
    ...retainedHead,
    `evidence-omitted:${entries.length - retainedHead.length - retainedTail.length}`,
    ...retainedTail,
  ];
}

function sourceBranch(value: unknown): SourceBranch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const branches = (value as Record<string, unknown>).branches;
  if (!Array.isArray(branches) || branches.length !== 1) return null;
  const raw = branches[0];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.branch !== "string" || typeof row.head !== "string") {
    return null;
  }
  return {
    branch: row.branch,
    head: row.head,
    files: Array.isArray(row.files)
      ? row.files.filter((file): file is string => typeof file === "string")
      : [],
  };
}

function exactEvidenceValue(
  result: TaskReconcileResult,
  prefix: string,
): string | null {
  const values = result.evidence
    .filter((item) => item.startsWith(prefix))
    .map((item) => item.slice(prefix.length).trim())
    .filter(Boolean);
  return values.length === 1 ? values[0] : null;
}

function commitEvidenceValue(
  result: TaskReconcileResult,
  prefix: string,
  patterns: RegExp[],
  resolveCommit?: (value: string) => string | null,
): string | null {
  const values = new Set<string>();
  const add = (value: string) => {
    const normalized = value.toLowerCase();
    if (!/^[0-9a-f]{7,40}$/.test(normalized)) return;
    const resolved = resolveCommit
      ? resolveCommit(normalized)
      : normalized.length === 40
        ? normalized
        : null;
    if (resolved) values.add(resolved.toLowerCase());
  };
  const exact = exactEvidenceValue(result, prefix);
  if (exact) add(exact);
  for (const item of result.evidence) {
    for (const pattern of patterns) {
      const match = item.match(pattern);
      if (match?.[1]) add(match[1]);
    }
  }
  return values.size === 1 ? [...values][0]! : null;
}

function verificationRejected(
  result: TaskReconcileResult,
  summary: string,
  finding: string,
  evidence: string[] = [],
): TaskVerificationResult {
  return {
    accepted: false,
    summary: `Legacy branch convergence rejected: ${summary}`,
    evidence: [
      ...result.evidence,
      `verification-finding:${finding}`,
      ...evidence,
    ],
  };
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

type SourceState = {
  attached: boolean;
  local: string | null;
  remote: string | null;
};

function sourceState(repoDir: string, source: SourceBranch): SourceState {
  const attachedPath = git(
    repoDir,
    ["for-each-ref", "--format=%(worktreepath)", `refs/heads/${source.branch}`],
    true,
  ).stdout;
  return {
    attached: Boolean(attachedPath),
    local: refHead(repoDir, source.branch),
    remote: remoteHead(repoDir, source.branch),
  };
}

function sourceStateNeedsOwner(
  repoDir: string,
  source: SourceBranch,
  evidence: string[] = [],
): { summary: string; evidence: string[] } | null {
  const closeoutProof =
    "To converge, report origin/dev@<full SHA> after fetch and represented-ancestor:<full SHA> after git merge-base --is-ancestor verifies it.";
  const current = sourceState(repoDir, source);
  if (current.attached) {
    const summary = `Recorded source ${source.branch}@${source.head} is worktree-attached. The same task requires owner judgment instead of retrying clean legacy-branch verification against an independently owned workspace. ${closeoutProof}`;
    return {
      summary,
      evidence: [
        `branch:${source.branch}@${source.head}:attached-source`,
        "source-attached:true",
        `source-local:${current.local ?? "missing"}`,
        `source-remote:${current.remote ?? "missing"}`,
        `owner-closeout-proof:${closeoutProof}`,
        ...evidence,
      ],
    };
  }

  const observations: string[] = [];
  if (current.local !== source.head) {
    observations.push(`local ref is ${current.local ?? "missing"}`);
  }
  if (current.remote && current.remote !== source.head) {
    observations.push(`remote ref is ${current.remote}`);
  }
  if (!observations.length) return null;

  const summary = `Recorded source ${source.branch}@${source.head} is stale: ${observations.join(" and ")}. The same task requires owner judgment instead of retrying unchanged legacy-branch verification. ${closeoutProof}`;
  return {
    summary,
    evidence: [
      `branch:${source.branch}@${source.head}:stale-source`,
      `source-local:${current.local ?? "missing"}`,
      `source-remote:${current.remote ?? "missing"}`,
      `owner-closeout-proof:${closeoutProof}`,
      ...evidence,
    ],
  };
}

function assertSource(repoDir: string, source: SourceBranch): void {
  const current = sourceState(repoDir, source);
  if (current.attached) {
    throw new Error(`Source branch is worktree-attached: ${source.branch}`);
  }
  if (current.local !== source.head) {
    throw new Error(
      `Source branch ${source.branch} moved from ${source.head} to ${current.local ?? "missing"}`,
    );
  }
  if (current.remote && current.remote !== source.head) {
    throw new Error(
      `Remote source ${source.branch} moved from ${source.head} to ${current.remote}`,
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

function reconcileIntegratedSource(
  repoDir: string,
  workspaceDir: string,
  source: SourceBranch,
  baseCommit: string,
): boolean {
  if (
    git(repoDir, ["merge-base", "--is-ancestor", source.head, baseCommit], true)
      .status !== 0
  )
    return false;

  const worktrees = git(repoDir, ["worktree", "list", "--porcelain"])
    .stdout.split(/\n\n+/)
    .map((block) => {
      const path = block.match(/^worktree (.+)$/m)?.[1];
      const head = block.match(/^HEAD (.+)$/m)?.[1];
      const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1]?.trim();
      return { path, head, branch };
    });
  if (worktrees.some((entry) => entry.branch === source.branch)) {
    throw new Error(`Source branch is worktree-attached: ${source.branch}`);
  }
  for (const entry of worktrees) {
    if (
      !entry.path ||
      entry.path === workspaceDir ||
      entry.head !== source.head
    )
      continue;
    const dirty = git(entry.path, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (dirty) {
      throw new Error(
        `Recorded source head has a dirty recovery worktree at ${entry.path}`,
      );
    }
  }

  const local = refHead(repoDir, source.branch);
  if (local && local !== source.head) {
    throw new Error(
      `Source branch ${source.branch} moved from ${source.head} to ${local}`,
    );
  }
  const remote = remoteHead(repoDir, source.branch);
  if (remote && remote !== source.head) {
    throw new Error(
      `Remote source ${source.branch} moved from ${source.head} to ${remote}`,
    );
  }

  git(workspaceDir, ["reset", "--hard", baseCommit]);
  if (remote) git(repoDir, ["push", "origin", "--delete", source.branch]);
  if (local) git(repoDir, ["branch", "-D", "--", source.branch]);
  return true;
}

function stepEvidence(verification: LegacyBranchVerification): string[] {
  return verification.steps.map(
    (step) =>
      `verify:${step.label}:${step.status === 0 ? "pass" : "fail"}:${step.command}${
        step.status === 0 || !step.output ? "" : `:${step.output.slice(-800)}`
      }`,
  );
}

function ownerReviewEvidence(
  source: SourceBranch,
  baseCommit: string,
  candidateHead: string,
  verification: LegacyBranchVerification,
): string[] {
  return [
    `branch:${source.branch}@${source.head}:verification-failed`,
    `base-commit:${baseCommit}`,
    `candidate-commit:${candidateHead}`,
    `changed-files:${verification.changedFiles.join(",")}`,
    ...(verification.reason
      ? [`verification-reason:${verification.reason}`]
      : []),
    ...stepEvidence(verification),
  ];
}

function restoreBase(workspaceDir: string, baseCommit: string): void {
  git(workspaceDir, ["merge", "--abort"], true);
  git(workspaceDir, ["reset", "--hard", baseCommit]);
}

function recoverWorkspaceToCurrentBase(
  repoDir: string,
  workspaceDir: string,
): { baseCommit: string | null; residue: string[] } {
  git(workspaceDir, ["merge", "--abort"], true);
  const fetched = git(repoDir, ["fetch", "origin", "dev"], true);
  const baseCommit =
    fetched.status === 0
      ? git(repoDir, ["rev-parse", "origin/dev"], true)
      : null;
  if (baseCommit?.status === 0 && baseCommit.stdout) {
    git(workspaceDir, ["reset", "--hard", baseCommit.stdout], true);
  }
  const residue = git(
    workspaceDir,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    true,
  )
    .stdout.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    baseCommit: baseCommit?.status === 0 ? baseCommit.stdout : null,
    residue,
  };
}

function workspaceProblems(
  workspaceDir: string,
  baseCommit: string,
  priorHead: string,
  decision: LegacyRepairDecision["decision"],
  cause: LegacyRepairRequest["cause"],
): string[] {
  const conflicts = git(workspaceDir, [
    "diff",
    "--name-only",
    "--diff-filter=U",
  ])
    .stdout.split("\n")
    .filter(Boolean);
  const dirty = git(workspaceDir, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ])
    .stdout.split("\n")
    .filter(Boolean);
  const head = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
  const problems: string[] = [];
  if (conflicts.length)
    problems.push(`unresolved conflicts: ${conflicts.join(", ")}`);
  if (dirty.length) problems.push(`uncommitted files: ${dirty.join(", ")}`);
  if (
    git(workspaceDir, ["merge-base", "--is-ancestor", baseCommit, head], true)
      .status !== 0
  ) {
    problems.push(`candidate ${head} is not based on ${baseCommit}`);
  }
  if (decision === "repaired" && head === priorHead) {
    problems.push(
      "repair reported success without changing the candidate commit",
    );
  }
  if (decision === "retry" && cause !== "verification-failure") {
    problems.push("unchanged retry is valid only after verification failure");
  }
  return problems;
}

async function runRepairAgent(
  ctx: WorkflowContext,
  request: LegacyRepairRequest,
): Promise<LegacyRepairDecision> {
  const result = await ctx.agents.call(
    ctx.reconciliation?.agent ?? "aks-explorer",
    [
      `Continue the same legacy-branch task after ${request.cause}.`,
      `Work only in ${request.workspaceDir}. Do not create another branch or worktree, push, delete refs, or edit task state.`,
      `Current integration base: origin/dev@${request.baseCommit}`,
      `Exact source: ${request.source.branch}@${request.source.head}`,
      `Source-declared files: ${(request.source.files ?? []).join(", ") || "not recorded"}`,
      request.cause === "merge-conflict"
        ? "The worktree contains the attempted merge and its conflicts. Inspect current origin/dev and the source intent. If useful changes remain, resolve them in a new clean commit. If the source is stale, duplicated, incorrect, or superseded, abort the merge and return reject with a clean worktree."
        : "The worktree contains a clean committed candidate that failed verification. Diagnose the exact evidence, make and commit the smallest useful correction, and leave the worktree clean.",
      "Return repaired only after producing a new clean commit. Return retry only when fresh evidence justifies rerunning verification without a source change. Return reject only when current evidence proves the legacy source is stale, incorrect, duplicated, or superseded and should not land. Use needs-agent only for an exceptional ambiguity that this bounded domain process cannot safely resolve.",
      request.conflicts.length
        ? `Conflict files:\n${request.conflicts.join("\n")}`
        : "Conflict files: none",
      request.failureEvidence.length
        ? `Verification evidence:\n${request.failureEvidence.join("\n")}`
        : "Verification evidence: none",
      request.feedback ? `Prior iteration feedback:\n${request.feedback}` : "",
      "Task:",
      JSON.stringify(ctx.reconciliation ?? ctx.input, null, 2),
    ]
      .filter(Boolean)
      .join("\n\n"),
    { timeoutMs: 1_800_000, schema: repairSchema },
  );
  if (result.status !== "done") {
    throw new Error(
      `Legacy branch repair agent ${result.status}: ${result.summary || result.id}`,
    );
  }
  const decision = result.output as LegacyRepairDecision;
  return {
    ...decision,
    evidence: [...decision.evidence, `repair-execution:${result.id}`],
  };
}

type RepairOutcome =
  | { state: "candidate"; head: string; evidence: string[] }
  | { state: "reject"; summary: string; evidence: string[] }
  | { state: "needs-agent"; summary: string; evidence: string[] };

async function repairCandidate(
  ctx: WorkflowContext,
  repairAgent: LegacyRepairAgent,
  request: Omit<LegacyRepairRequest, "attempt" | "feedback">,
): Promise<RepairOutcome> {
  let feedback = "";
  const evidence: string[] = [];
  for (let attempt = 1; attempt <= maxRepairIterations; attempt += 1) {
    const priorHead = git(request.workspaceDir, ["rev-parse", "HEAD"]).stdout;
    const decision = await repairAgent({ ...request, attempt, feedback });
    evidence.push(
      `repair-iteration:${attempt}:${decision.decision}:${decision.summary}`,
      ...decision.evidence,
    );
    if (decision.decision === "reject") {
      return { state: "reject", summary: decision.summary, evidence };
    }
    if (decision.decision === "needs-agent") {
      return { state: "needs-agent", summary: decision.summary, evidence };
    }
    const problems = workspaceProblems(
      request.workspaceDir,
      request.baseCommit,
      priorHead,
      decision.decision,
      request.cause,
    );
    if (!problems.length) {
      return {
        state: "candidate",
        head: git(request.workspaceDir, ["rev-parse", "HEAD"]).stdout,
        evidence,
      };
    }
    feedback = problems.join("; ");
    evidence.push(`repair-validation-failed:${feedback}`);
  }
  return {
    state: "needs-agent",
    summary: `Legacy branch repair exhausted ${maxRepairIterations} changed iterations without a valid candidate.`,
    evidence,
  };
}

export type LegacyCandidateVerifier = (
  workspaceDir: string,
  projectDir: string,
  baseCommit: string,
  baseline: ReturnType<typeof captureLegacyVerificationBaseline>,
) => LegacyBranchVerification;

export type LegacyBaselineProvider = typeof captureLegacyVerificationBaseline;

export async function verify(
  context: TaskVerificationContext,
  result: TaskReconcileResult,
): Promise<TaskVerificationResult> {
  if (result.state !== "converged") {
    return {
      accepted: true,
      summary: `Legacy branch ${result.state} disposition does not claim closeout.`,
      evidence: [...result.evidence],
    };
  }

  const source = sourceBranch(context.intent.input);
  if (!source) {
    return verificationRejected(
      result,
      "the task no longer identifies exactly one source branch",
      "missing-source-input",
    );
  }

  const fetched = git(context.projectRoot, ["fetch", "origin", "dev"], true);
  if (fetched.status !== 0) {
    return verificationRejected(
      result,
      "current origin/dev could not be fetched",
      "origin-dev-fetch-failed",
      [fetched.stderr || fetched.stdout],
    );
  }
  const currentBase = git(context.projectRoot, ["rev-parse", "origin/dev"]);
  let currentSource: SourceState;
  try {
    currentSource = sourceState(context.projectRoot, source);
  } catch (error) {
    return verificationRejected(
      result,
      "the source refs could not be inspected",
      "source-ref-inspection-failed",
      [error instanceof Error ? error.message : String(error)],
    );
  }
  if (currentSource.local || currentSource.remote) {
    return verificationRejected(
      result,
      "the source branch still has a live ref",
      "source-ref-still-live",
      [
        `verification-source-local:${currentSource.local ?? "missing"}`,
        `verification-source-remote:${currentSource.remote ?? "missing"}`,
      ],
    );
  }

  const dispositionPrefix = `branch:${source.branch}@${source.head}:`;
  const disposition = exactEvidenceValue(result, dispositionPrefix);
  const directDispositions = new Set([
    "integrated-postcondition",
    "already-represented",
    "rejected",
    "verified-merged",
  ]);
  if (disposition && directDispositions.has(disposition)) {
    if (
      ["integrated-postcondition", "verified-merged"].includes(disposition) &&
      git(
        context.projectRoot,
        ["merge-base", "--is-ancestor", source.head, currentBase.stdout],
        true,
      ).status !== 0
    ) {
      return verificationRejected(
        result,
        "the integrated source is not reachable from current origin/dev",
        "source-not-integrated",
        [`verification-origin-dev:${currentBase.stdout}`],
      );
    }
    return {
      accepted: true,
      summary: `Accepted ${disposition} closeout with absent source refs on origin/dev@${currentBase.stdout}.`,
      evidence: [
        ...result.evidence,
        `verification-origin-dev:${currentBase.stdout}`,
        "verification-source-refs:absent",
      ],
    };
  }

  const representedAncestor = commitEvidenceValue(
    result,
    "represented-ancestor:",
    [
      /\bintegrated semantic replacement ([0-9a-f]{40}) \(ancestor of origin\/dev\)/i,
      /\bintegrated replacement ([0-9a-f]{40})\b.*\bverified ancestor of origin\/dev\b/i,
      /\bgit ancestor:\s*([0-9a-f]{40})\s+is contained in origin\/dev\b/i,
      /\breplacement:([0-9a-f]{40}):ancestor-of-origin\/dev\b/i,
      /\bgit merge-base --is-ancestor ([0-9a-f]{7,40}) origin\/dev -> yes\b/i,
    ],
    (value) => refHead(context.projectRoot, value),
  );
  const claimedBase = commitEvidenceValue(result, "origin/dev:", [
    /\borigin\/dev@([0-9a-f]{40})\b/i,
    /\bgit fetch origin dev -> origin\/dev=([0-9a-f]{40})\b/i,
  ]);
  if (!representedAncestor || claimedBase !== currentBase.stdout) {
    return verificationRejected(
      result,
      "owner judgment lacks one current represented-ancestor proof",
      "missing-current-representation-proof",
      [
        `verification-origin-dev:${currentBase.stdout}`,
        `claimed-origin-dev:${claimedBase ?? "missing"}`,
        `claimed-represented-ancestor:${representedAncestor ?? "missing"}`,
      ],
    );
  }
  if (
    git(
      context.projectRoot,
      ["merge-base", "--is-ancestor", representedAncestor, currentBase.stdout],
      true,
    ).status !== 0
  ) {
    return verificationRejected(
      result,
      "the claimed represented commit is not reachable from current origin/dev",
      "represented-commit-not-integrated",
      [
        `verification-origin-dev:${currentBase.stdout}`,
        `verification-represented-ancestor:${representedAncestor}`,
      ],
    );
  }

  return {
    accepted: true,
    summary: `Accepted owner-adjudicated stale-source closeout represented by ${representedAncestor} on origin/dev@${currentBase.stdout}.`,
    evidence: [
      ...result.evidence,
      `verification-origin-dev:${currentBase.stdout}`,
      `verification-represented-ancestor:${representedAncestor}`,
      "verification-source-refs:absent",
    ],
  };
}

export async function executeWithVerifier(
  ctx: WorkflowContext,
  verifier: LegacyCandidateVerifier,
  baselineProvider: LegacyBaselineProvider = captureLegacyVerificationBaseline,
  repairAgent: LegacyRepairAgent = (request) => runRepairAgent(ctx, request),
): Promise<ExecutionResult<TaskReconcileResult> | ExecutionResult> {
  const repoDir = ctx.workspace?.projectRoot;
  const workspaceDir = ctx.workspace?.root;
  const source = sourceBranch(ctx.reconciliation?.input ?? ctx.input);
  if (!repoDir || !workspaceDir || workspaceDir === repoDir || !source) {
    return ctx.blocked(
      "Legacy branch verification requires a task worktree and exactly one source branch",
      { workspaceDir, repoDir, source },
    );
  }

  try {
    git(repoDir, ["fetch", "origin", "dev"]);
    let baseCommit = git(repoDir, ["rev-parse", "origin/dev"]).stdout;
    const dirty = git(workspaceDir, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (dirty) {
      const recovery = recoverWorkspaceToCurrentBase(repoDir, workspaceDir);
      if (!recovery.baseCommit || recovery.residue.length) {
        throw new Error(
          [
            `Task worktree is dirty before verification:\n${dirty}`,
            `recoveryBaseCommit:${recovery.baseCommit ?? "missing"}`,
            recovery.residue.length
              ? `recoveryResidue:${recovery.residue.join(" | ")}`
              : "recoveryResidue:<clean>",
          ].join("\n"),
        );
      }
      baseCommit = recovery.baseCommit;
    }
    if (reconcileIntegratedSource(repoDir, workspaceDir, source, baseCommit)) {
      const summary = `Recorded source ${source.branch}@${source.head} is already integrated in origin/dev; reconciled its remaining refs.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          `branch:${source.branch}@${source.head}:integrated-postcondition`,
          `base-commit:${baseCommit}`,
        ],
        actions: [],
      });
    }
    const staleBeforeVerification = sourceStateNeedsOwner(repoDir, source, [
      `base-commit:${baseCommit}`,
    ]);
    if (staleBeforeVerification) {
      return ctx.done(staleBeforeVerification.summary, {
        state: "needs-agent",
        summary: staleBeforeVerification.summary,
        evidence: boundedWorkflowEvidence(staleBeforeVerification.evidence),
      });
    }
    assertSource(repoDir, source);
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
    const repairEvidence: string[] = [];
    if (merge.status !== 0) {
      const conflicts = git(workspaceDir, [
        "diff",
        "--name-only",
        "--diff-filter=U",
      ]).stdout;
      const repair = await repairCandidate(ctx, repairAgent, {
        cause: "merge-conflict",
        source,
        workspaceDir,
        baseCommit,
        candidateHead: baseCommit,
        conflicts: conflicts.split("\n").filter(Boolean),
        failureEvidence: [merge.stderr || merge.stdout].filter(Boolean),
      });
      repairEvidence.push(...repair.evidence);
      if (repair.state === "reject") {
        restoreBase(workspaceDir, baseCommit);
        const residue = git(workspaceDir, [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ]).stdout;
        if (residue) {
          throw new Error(
            `Rejected legacy repair left workspace residue:\n${residue}`,
          );
        }
        cleanSourceRefs(repoDir, source);
        const summary = `Rejected and removed ${source.branch}: ${repair.summary}`;
        return ctx.done(summary, {
          state: "converged",
          summary,
          evidence: boundedWorkflowEvidence([
            `branch:${source.branch}@${source.head}:rejected`,
            `base-commit:${baseCommit}`,
            ...repairEvidence,
          ]),
          actions: [],
        });
      }
      if (repair.state === "needs-agent") {
        restoreBase(workspaceDir, baseCommit);
        const summary = `${repair.summary} The same task requires exceptional owner judgment; no source refs were changed.`;
        return ctx.done(summary, {
          state: "needs-agent",
          summary,
          evidence: boundedWorkflowEvidence([
            `branch:${source.branch}@${source.head}:repair-exhausted`,
            `base-commit:${baseCommit}`,
            ...repairEvidence,
          ]),
        });
      }
    }

    let candidateHead = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
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

    let verification = verifier(workspaceDir, repoDir, baseCommit, baseline);
    for (
      let iteration = 1;
      !verification.passed && iteration <= maxRepairIterations;
      iteration += 1
    ) {
      const repair = await repairCandidate(ctx, repairAgent, {
        cause: "verification-failure",
        source,
        workspaceDir,
        baseCommit,
        candidateHead,
        conflicts: [],
        failureEvidence: ownerReviewEvidence(
          source,
          baseCommit,
          candidateHead,
          verification,
        ),
      });
      repairEvidence.push(...repair.evidence);
      if (repair.state === "reject") {
        restoreBase(workspaceDir, baseCommit);
        cleanSourceRefs(repoDir, source);
        const summary = `Rejected and removed ${source.branch} after verification review: ${repair.summary}`;
        return ctx.done(summary, {
          state: "converged",
          summary,
          evidence: boundedWorkflowEvidence([
            `branch:${source.branch}@${source.head}:rejected`,
            `base-commit:${baseCommit}`,
            ...repairEvidence,
          ]),
          actions: [],
        });
      }
      if (repair.state === "needs-agent") {
        const summary = `${repair.summary} The same task requires exceptional owner judgment; no source refs were changed.`;
        return ctx.done(summary, {
          state: "needs-agent",
          summary,
          evidence: boundedWorkflowEvidence([
            ...ownerReviewEvidence(
              source,
              baseCommit,
              candidateHead,
              verification,
            ),
            ...repairEvidence,
          ]),
        });
      }
      candidateHead = repair.head;
      verification = verifier(workspaceDir, repoDir, baseCommit, baseline);
    }
    if (!verification.passed) {
      const summary = `Legacy branch verification exhausted ${maxRepairIterations} repair rounds: ${verification.reason ?? "verification failed without an explicit reason"}.`;
      return ctx.done(summary, {
        state: "needs-agent",
        summary,
        evidence: boundedWorkflowEvidence([
          ...ownerReviewEvidence(
            source,
            baseCommit,
            candidateHead,
            verification,
          ),
          ...repairEvidence,
        ]),
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
    const staleAfterVerification = sourceStateNeedsOwner(repoDir, source, [
      `base-commit:${currentBase}`,
      `candidate-commit:${candidateHead}`,
      `changed-files:${verification.changedFiles.join(",")}`,
      ...repairEvidence,
      ...stepEvidence(verification),
    ]);
    if (staleAfterVerification) {
      return ctx.done(staleAfterVerification.summary, {
        state: "needs-agent",
        summary: staleAfterVerification.summary,
        evidence: boundedWorkflowEvidence(staleAfterVerification.evidence),
      });
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
      evidence: boundedWorkflowEvidence([
        `branch:${source.branch}@${source.head}:verified-merged`,
        `base-commit:${baseCommit}`,
        `result-commit:${candidateHead}`,
        `changed-files:${verification.changedFiles.join(",")}`,
        ...repairEvidence,
        ...stepEvidence(verification),
      ]),
      actions: [],
    });
  } catch (error) {
    const recovery = recoverWorkspaceToCurrentBase(repoDir, workspaceDir);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const staleDuringCloseout = sourceStateNeedsOwner(repoDir, source, [
      `error:${errorMessage}`,
      `recovery-base-commit:${recovery.baseCommit ?? "missing"}`,
      `recovery-residue:${recovery.residue.join(" | ") || "<clean>"}`,
    ]);
    if (staleDuringCloseout) {
      return ctx.done(staleDuringCloseout.summary, {
        state: "needs-agent",
        summary: staleDuringCloseout.summary,
        evidence: boundedWorkflowEvidence(staleDuringCloseout.evidence),
      });
    }
    return ctx.blocked("Legacy branch verification closeout failed safely", {
      branch: source.branch,
      head: source.head,
      error: errorMessage,
      recoveryBaseCommit: recovery.baseCommit,
      recoveryResidue: recovery.residue,
    });
  }
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
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

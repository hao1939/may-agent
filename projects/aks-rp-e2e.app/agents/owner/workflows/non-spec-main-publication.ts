import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  taskReconcileResultSchema,
  type Condition,
  type ExecutionResult,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";
import {
  completedPullRequestIntegration,
  pullRequestWaitConditions,
  resolveIntegrationTarget,
  taskScopedAgentCondition,
} from "./spec-live-reconciliation.js";

export const name = "non-spec-main-publication";
export const description =
  "Publish one bounded non-spec repository patch from a main-based task worktree through a non-draft PR and exact merge observation.";
export const workspace = { kind: "task", baseBranch: "main" } as const;

export const PUBLICATION_PROVENANCE_REGRESSION = {
  dedupeKey: "aks-app-unscoped-multi-commit-publish",
  reviewedRange:
    "9214d32a877cfe50014a51c629ceaa3bf4b34b6a..b821ecd965b83e3452fe8f30857a9b39cf92e619",
} as const;

type AcceptedPublicationCommit = {
  commit: string;
  taskReceipt: string;
  verificationEvidence: string[];
};

export type PublicationRangeValidation =
  | {
      ok: true;
      baseCommit: string;
      candidateCommit: string;
      commits: string[];
      evidence: string[];
    }
  | {
      ok: false;
      baseCommit: string;
      candidateCommit: string;
      commits: string[];
      unexpectedCommits: string[];
      reason: string;
    };

type PullRequest = {
  pullRequestId?: unknown;
  status?: unknown;
  mergeStatus?: unknown;
  sourceRefName?: unknown;
  targetRefName?: unknown;
  lastMergeSourceCommit?: { commitId?: unknown };
  lastMergeCommit?: { commitId?: unknown };
  url?: unknown;
};

function gitValue(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
  }).trim();
}

function gitExitCode(cwd: string, ...args: string[]): number {
  try {
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
      stdio: "pipe",
    });
    return 0;
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status?: unknown }).status)
        : 1;
    return Number.isFinite(status) ? status : 1;
  }
}

function optionalString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function optionalStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => optionalString(entry)).filter(Boolean)
    : [];
}

export function acceptedPublicationCommits(
  value: unknown,
): AcceptedPublicationCommit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const commit = optionalString(row.commit);
    const taskReceipt = optionalString(row.taskReceipt);
    const verificationEvidence = optionalStringArray(row.verificationEvidence);
    return /^[0-9a-f]{40}$/i.test(commit) &&
      taskReceipt &&
      verificationEvidence.length
      ? [{ commit, taskReceipt, verificationEvidence }]
      : [];
  });
}

/**
 * Validate the complete freshly fetched target..candidate range before any
 * publication. Commits made after taskStartCommit belong to this bounded task;
 * older commits require an explicit task receipt and verification evidence.
 */
export function validatePublicationRange(input: {
  cwd: string;
  baseCommit: string;
  candidateCommit: string;
  taskStartCommit: string;
  currentTaskEvidence: string[];
  acceptedCommits?: AcceptedPublicationCommit[];
}): PublicationRangeValidation {
  const commits = gitValue(
    input.cwd,
    "rev-list",
    "--reverse",
    `${input.baseCommit}..${input.candidateCommit}`,
  )
    .split(/\r?\n/)
    .map((commit) => commit.trim())
    .filter(Boolean);
  if (
    gitExitCode(
      input.cwd,
      "merge-base",
      "--is-ancestor",
      input.baseCommit,
      input.candidateCommit,
    ) !== 0
  ) {
    return {
      ok: false,
      baseCommit: input.baseCommit,
      candidateCommit: input.candidateCommit,
      commits,
      unexpectedCommits: commits.length ? commits : [input.candidateCommit],
      reason: `candidate is not based on freshly fetched target ${input.baseCommit}`,
    };
  }

  const taskOwned = new Set<string>();
  const addRange = (endCommit: string) => {
    if (
      gitExitCode(
        input.cwd,
        "merge-base",
        "--is-ancestor",
        input.taskStartCommit,
        endCommit,
      ) !== 0
    ) {
      return;
    }
    for (const commit of gitValue(
      input.cwd,
      "rev-list",
      `${input.taskStartCommit}..${endCommit}`,
    )
      .split(/\r?\n/)
      .filter(Boolean)) {
      taskOwned.add(commit);
    }
  };
  if (input.currentTaskEvidence.some((entry) => entry.trim().length > 0)) {
    addRange(input.candidateCommit);
  }

  const accepted = new Map(
    (input.acceptedCommits ?? []).map((entry) => [entry.commit, entry]),
  );
  const unexpectedCommits = commits.filter(
    (commit) => !taskOwned.has(commit) && !accepted.has(commit),
  );
  if (unexpectedCommits.length) {
    return {
      ok: false,
      baseCommit: input.baseCommit,
      candidateCommit: input.candidateCommit,
      commits,
      unexpectedCommits,
      reason: `publication range contains commits without current-task authority or an explicit accepted task receipt: ${unexpectedCommits.join(",")}`,
    };
  }

  return {
    ok: true,
    baseCommit: input.baseCommit,
    candidateCommit: input.candidateCommit,
    commits,
    evidence: [
      `publication-range:${input.baseCommit}..${input.candidateCommit}`,
      `publication-range-commits:${commits.join(",")}`,
      ...commits.map((commit) => {
        const receipt = accepted.get(commit);
        return receipt
          ? `publication-commit-authority:${commit}:receipt=${receipt.taskReceipt}:verification=${receipt.verificationEvidence.join("|")}`
          : `publication-commit-authority:${commit}:current-task`;
      }),
    ],
  };
}

type PullRequestReviewThread = {
  threadId: string;
  path: string | null;
  author: string;
  content: string;
};

type PullRequestReview = {
  available: boolean;
  unresolvedCount: number;
  fingerprint: string;
  threads: PullRequestReviewThread[];
};

function reviewThread(value: unknown): PullRequestReviewThread | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const threadId = optionalString(row.threadId);
  const content = optionalString(row.content);
  if (!threadId || !content) return null;
  return {
    threadId,
    path: optionalString(row.path) || null,
    author: optionalString(row.author) || "unknown",
    content,
  };
}

function pullRequestReviewTrigger(
  trigger: Record<string, unknown> | null,
  expectedPullRequestId = "",
): PullRequestReview | null {
  if (!trigger) return null;
  const data =
    trigger.data && typeof trigger.data === "object"
      ? (trigger.data as Record<string, unknown>)
      : {};
  const value = (key: string) => trigger[key] ?? data[key];
  const pullRequestId = optionalString(value("pullRequestId"));
  const unresolvedCount = Number(value("unresolvedReviewCount") ?? 0) || 0;
  if (
    optionalString(trigger.type) !== "pull-request.state" ||
    !pullRequestId ||
    unresolvedCount <= 0 ||
    (expectedPullRequestId && pullRequestId !== expectedPullRequestId)
  ) {
    return null;
  }
  const unresolvedThreads = value("unresolvedReviewThreads");
  const threads = Array.isArray(unresolvedThreads)
    ? unresolvedThreads
        .map((entry: unknown) => reviewThread(entry))
        .filter((entry): entry is PullRequestReviewThread => Boolean(entry))
    : [];
  return {
    available: true,
    unresolvedCount,
    fingerprint: optionalString(value("reviewFingerprint")),
    threads,
  };
}

function workspaceChanges(cwd: string): string {
  return gitValue(cwd, "status", "--porcelain=v1", "--untracked-files=all");
}

export function resolveAzCli(
  env: NodeJS.ProcessEnv = process.env,
  localPath = "/app/.state/.local/bin/az",
): string {
  return env.AZURE_CLI_PATH || (existsSync(localPath) ? localPath : "az");
}

function azJson(cwd: string, args: string[]): unknown {
  const result = execFileSync(
    resolveAzCli(),
    [
      ...args,
      "--organization",
      "https://dev.azure.com/msazure",
      "--project",
      "CloudNativeCompute",
      "-o",
      "json",
    ],
    {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
      env: process.env,
    },
  );
  return JSON.parse(result || "null");
}

const azureDevOpsOrganization = "https://dev.azure.com/msazure";
const azureDevOpsProject = "CloudNativeCompute";
const azureDevOpsRepository = "aks-e2e-spec-runner";
const azureDevOpsResource = "499b84ac-1321-427f-aa17-267ca6975798";

function branchRef(branch: string): string {
  return branch.startsWith("refs/heads/") ? branch : `refs/heads/${branch}`;
}

async function azureDevOpsRest(
  cwd: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const token = execFileSync(
    resolveAzCli(),
    [
      "account",
      "get-access-token",
      "--resource",
      azureDevOpsResource,
      "--query",
      "accessToken",
      "-o",
      "tsv",
    ],
    {
      cwd,
      encoding: "utf8",
      timeout: 30_000,
      env: process.env,
    },
  ).trim();
  const response = await fetch(
    `${azureDevOpsOrganization}/${azureDevOpsProject}/_apis/${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(30_000),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Azure DevOps REST ${response.status} ${response.statusText}: ${body.slice(0, 500)}`,
    );
  }
  return JSON.parse(body || "null");
}

function useFakeAzCli(): boolean {
  return Boolean(process.env.FAKE_AZ_STATE);
}

async function pullRequests(
  repoDir: string,
  sourceBranch: string,
  targetBranch: string,
): Promise<PullRequest[]> {
  const value = useFakeAzCli()
    ? azJson(repoDir, [
        "repos",
        "pr",
        "list",
        "--repository",
        azureDevOpsRepository,
        "--source-branch",
        sourceBranch,
        "--target-branch",
        targetBranch,
        "--status",
        "all",
        "--top",
        "20",
      ])
    : await azureDevOpsRest(
        repoDir,
        `git/repositories/${azureDevOpsRepository}/pullrequests?searchCriteria.sourceRefName=${encodeURIComponent(branchRef(sourceBranch))}&searchCriteria.targetRefName=${encodeURIComponent(branchRef(targetBranch))}&searchCriteria.status=all&$top=20&api-version=7.1`,
      );
  const rows = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as { value?: unknown }).value)
      ? (value as { value: unknown[] }).value
      : [];
  return (rows as PullRequest[]).sort(
    (left, right) =>
      Number(right.pullRequestId ?? 0) - Number(left.pullRequestId ?? 0),
  );
}

async function pullRequest(
  repoDir: string,
  pullRequestId: string,
): Promise<PullRequest> {
  const value = useFakeAzCli()
    ? azJson(repoDir, ["repos", "pr", "show", "--id", pullRequestId])
    : await azureDevOpsRest(
        repoDir,
        `git/pullrequests/${pullRequestId}?api-version=7.1`,
      );
  return (value && typeof value === "object" ? value : {}) as PullRequest;
}

async function createPullRequest(
  repoDir: string,
  input: {
    taskId: string;
    sourceBranch: string;
    sourceCommit: string;
    targetBranch: string;
    title: string;
    description: string;
  },
): Promise<PullRequest> {
  const value = useFakeAzCli()
    ? azJson(repoDir, [
        "repos",
        "pr",
        "create",
        "--repository",
        azureDevOpsRepository,
        "--source-branch",
        input.sourceBranch,
        "--target-branch",
        input.targetBranch,
        "--title",
        input.title,
        "--description",
        input.description,
        "--draft",
        "false",
      ])
    : await azureDevOpsRest(
        repoDir,
        `git/repositories/${azureDevOpsRepository}/pullrequests?api-version=7.1`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceRefName: branchRef(input.sourceBranch),
            targetRefName: branchRef(input.targetBranch),
            title: input.title,
            description: input.description,
            isDraft: false,
          }),
        },
      );
  if (
    !value ||
    typeof value !== "object" ||
    !optionalString((value as PullRequest).pullRequestId)
  ) {
    throw new Error(
      `Azure DevOps did not return a pull request id for ${input.taskId}`,
    );
  }
  return value as PullRequest;
}

function changedFiles(workspaceDir: string, targetRef: string): string[] {
  const output = gitValue(
    workspaceDir,
    "diff",
    "--name-only",
    `${targetRef}...HEAD`,
  );
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function publicationRangeRefusal(
  validation: Extract<PublicationRangeValidation, { ok: false }>,
  agentResult: TaskReconcileResult,
): TaskReconcileResult {
  return {
    state: "needs-agent",
    summary:
      "Refused publication because the exact freshly fetched target range contains unauthorized commits",
    evidence: [
      ...(agentResult.evidence ?? []),
      `publication-range:${validation.baseCommit}..${validation.candidateCommit}`,
      `publication-range-commits:${validation.commits.join(",")}`,
      `unexpected-commits:${validation.unexpectedCommits.join(",")}`,
      `publication-refusal:${validation.reason}`,
    ],
    actions: agentResult.actions ?? [],
  };
}

function waitConditions(input: {
  taskId: string;
  generation: number;
  pullRequestId: string;
  sourceCommit: string;
  review?: PullRequestReview;
}): Condition[] {
  return pullRequestWaitConditions(
    input.pullRequestId,
    input.sourceCommit,
    input.review,
  ).map((condition) =>
    taskScopedAgentCondition(input.taskId, input.generation, condition),
  );
}

function isWorkflowOwnedPublicationWait(input: {
  result: TaskReconcileResult;
  sourceCommit: string;
  targetRef: string;
}): boolean {
  if (input.result.state !== "waiting") return false;
  const conditions = input.result.conditions ?? [];
  if (!conditions.length) return false;
  const branch = input.targetRef.replace(/^origin\//, "");
  const acceptedSubjects = new Set([
    input.targetRef,
    `refs/heads/${branch}`,
    `repo-ref:${input.targetRef}`,
    `repo-ref:refs/heads/${branch}`,
  ]);
  return conditions.every((condition) => {
    if (condition.type !== "aks.repo-ref.observed") return false;
    const expected = condition.expected as Record<string, unknown>;
    return (
      acceptedSubjects.has(condition.subject) &&
      optionalString(expected.commit) === input.sourceCommit
    );
  });
}

function promptForPublication(input: {
  ctx: WorkflowContext;
  targetBranch: string;
  sourceBranch: string;
  baseCommit: string;
  allowedChangedFiles: string[];
}): string {
  const allowed = input.allowedChangedFiles.length
    ? `Keep the patch strictly bounded to these repository paths: ${input.allowedChangedFiles.join(", ")}.`
    : "Keep the patch strictly bounded to the smallest repository surface required by the task acceptance.";
  return [
    `Reconcile this bounded non-spec publication task in ${input.ctx.workspace?.root}.`,
    `The task worktree is already based on current origin/${input.targetBranch}@${input.baseCommit} and currently uses source branch ${input.sourceBranch}.`,
    allowed,
    "Do not create another branch or worktree. Do not push, open a PR, merge, edit app state, or create/retarget tasks; this workflow will handle publication and merge observation.",
    "If a truthful bounded source patch is required, make it in this worktree, run the scoped verification named by the task acceptance, commit the bounded change, and return state=converged with exact evidence for the prepared commit. Converged here means the bounded local preparation is complete; this workflow still owns push, PR creation, merge waiting, and final task convergence. Do not return waiting merely because those workflow-owned publication steps remain.",
    "If the task must wait on an exact external fact before a bounded patch can truthfully proceed, return waiting with one exact typed Condition. If the blocker is a genuine external ownership gap, return needs-agent with precise evidence.",
    "Task:",
    JSON.stringify(input.ctx.reconciliation ?? input.ctx.input, null, 2),
  ].join("\n\n");
}

function promptForExistingPullRequestReview(input: {
  ctx: WorkflowContext;
  pullRequestId: string;
  targetRef: string;
  sourceBranch: string;
  sourceCommit: string;
  allowedChangedFiles: string[];
  review: PullRequestReview;
}): string {
  const allowed = input.allowedChangedFiles.length
    ? `Keep any follow-up strictly bounded to these repository paths: ${input.allowedChangedFiles.join(", ")}.`
    : "Keep any follow-up strictly bounded to the minimal repository surface required by the task acceptance.";
  const reviewThreads = input.review.threads.length
    ? input.review.threads
        .map(
          (thread) =>
            `- thread ${thread.threadId}${thread.path ? ` (${thread.path})` : ""} by ${thread.author}: ${thread.content}`,
        )
        .join("\n")
    : "- no structured thread payload was provided";
  return [
    `Reconcile review feedback for existing PR ${input.pullRequestId} from ${input.sourceBranch}@${input.sourceCommit} into ${input.targetRef}.`,
    allowed,
    `The current active review fingerprint is ${input.review.fingerprint || "missing"} with ${input.review.unresolvedCount} unresolved thread(s).`,
    "Do not create another branch, worktree, or PR. Stay on this same task worktree and source branch; this workflow will reuse the existing PR after your bounded judgment.",
    "If the review reveals a truthful bounded source fix, implement it here, run the scoped verification named by the task acceptance, commit the fix, and return state=converged with exact evidence for the prepared follow-up commit. If no safe bounded source change is warranted, return needs-agent with exact evidence rather than silently restoring the stale wait.",
    "Review threads:",
    reviewThreads,
    "Task:",
    JSON.stringify(input.ctx.reconciliation ?? input.ctx.input, null, 2),
  ].join("\n\n");
}

function pullRequestTitle(
  taskId: string,
  input: Record<string, unknown>,
): string {
  const explicit = optionalString(input.prTitle);
  if (explicit) return explicit;
  return `test: publish ${taskId.replace(/[^A-Za-z0-9._/-]+/g, "-")}`.slice(
    0,
    200,
  );
}

function pullRequestDescription(input: {
  taskId: string;
  outcome: string;
  sourceCommit: string;
  targetBranch: string;
  allowedChangedFiles: string[];
}): string {
  return [
    `Task: ${input.taskId}`,
    input.outcome ? `Outcome: ${input.outcome}` : "",
    `Tested bounded source commit: ${input.sourceCommit}`,
    `Target: ${input.targetBranch}`,
    input.allowedChangedFiles.length
      ? `Bounded files: ${input.allowedChangedFiles.join(", ")}`
      : "Bounded files: task acceptance governs the minimal source patch.",
    `Integration proof: Azure must report this exact source commit as the completed PR head and a resulting merge commit reachable from origin/${input.targetBranch}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function pullRequestState(pr: PullRequest): string {
  return optionalString(pr.status) || "unknown";
}

function pullRequestMergeStatus(pr: PullRequest): string {
  return optionalString(pr.mergeStatus) || "unknown";
}

function verifiedIntegrationEvidence(input: {
  result: TaskReconcileResult;
  pullRequestId: string;
  sourceBranch: string;
  sourceCommit: string;
  mergeCommit: string;
  targetRef: string;
  targetCommit: string;
}): TaskReconcileResult {
  const summary = `${input.result.summary} PR ${input.pullRequestId} integrated ${input.sourceCommit} into ${input.targetRef}@${input.targetCommit}.`;
  return {
    ...input.result,
    state: "converged",
    summary,
    evidence: [
      ...(input.result.evidence ?? []),
      `pull-request:${input.pullRequestId}`,
      `source-branch:${input.sourceBranch}`,
      `source-commit:${input.sourceCommit}`,
      `merge-commit:${input.mergeCommit}`,
      `target-ref:${input.targetRef}`,
      `integrated-commit:${input.targetCommit}`,
    ],
    actions: input.result.actions ?? [],
  };
}

function reviewEvidence(review?: PullRequestReview): string[] {
  if (!review?.available || review.unresolvedCount <= 0) return [];
  return [
    `pull-request-unresolved-review-count:${review.unresolvedCount}`,
    ...(review.fingerprint
      ? [`pull-request-review-fingerprint:${review.fingerprint}`]
      : []),
    ...(review.threads.length
      ? [
          `pull-request-review-thread-ids:${review.threads
            .map((thread) => thread.threadId)
            .join(",")}`,
        ]
      : []),
  ];
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function reviewNeedsJudgment(
  review: PullRequestReview | null,
  input: Record<string, unknown>,
): boolean {
  if (!review?.available || review.unresolvedCount <= 0) return false;
  const priorFingerprint = optionalString(input.reviewFingerprint);
  const priorThreadIds = optionalStringArray(input.unresolvedReviewThreadIds)
    .slice()
    .sort();
  const currentThreadIds = review.threads
    .map((thread) => thread.threadId)
    .filter(Boolean)
    .sort();
  if (!sameStrings(priorThreadIds, currentThreadIds)) return true;
  return review.fingerprint !== priorFingerprint;
}

function waitingForPullRequest(input: {
  result: TaskReconcileResult;
  taskId: string;
  generation: number;
  pullRequestId: string;
  sourceBranch: string;
  sourceCommit: string;
  targetRef: string;
  prState: string;
  mergeStatus: string;
  review?: PullRequestReview;
  waitingReason?: string;
}): TaskReconcileResult {
  const summary = `${input.result.summary} ${input.waitingReason || `Published non-draft PR ${input.pullRequestId} from ${input.sourceBranch}@${input.sourceCommit}; keep the same task waiting for review or merge into ${input.targetRef}.`}`;
  return {
    ...input.result,
    state: "waiting",
    summary,
    evidence: [
      ...(input.result.evidence ?? []),
      `pull-request:${input.pullRequestId}`,
      `pull-request-status:${input.prState}`,
      `merge-status:${input.mergeStatus}`,
      `source-branch:${input.sourceBranch}`,
      `source-commit:${input.sourceCommit}`,
      `target-ref:${input.targetRef}`,
      ...reviewEvidence(input.review),
    ],
    actions: input.result.actions ?? [],
    conditions: waitConditions({
      taskId: input.taskId,
      generation: input.generation,
      pullRequestId: input.pullRequestId,
      sourceCommit: input.sourceCommit,
      review: input.review,
    }),
  };
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const reconciliation = ctx.reconciliation;
  const repoDir = ctx.workspace?.projectRoot;
  const workspaceDir = ctx.workspace?.root;
  if (
    !reconciliation ||
    !repoDir ||
    !workspaceDir ||
    repoDir === workspaceDir
  ) {
    return ctx.blocked(
      "Non-spec main publication requires a prepared task worktree",
      {
        hasReconciliation: Boolean(reconciliation),
        projectDir: repoDir,
        workspaceDir,
      },
    );
  }

  const taskId = reconciliation.taskId;
  const generation = reconciliation.generation;
  const input =
    reconciliation.input && typeof reconciliation.input === "object"
      ? (reconciliation.input as Record<string, unknown>)
      : {};
  const allowedChangedFiles = optionalStringArray(input.allowedChangedFiles);
  const { targetBranch, targetRef } = resolveIntegrationTarget(
    optionalString(input.targetBranch) || "main",
  );
  gitValue(repoDir, "fetch", "origin", targetBranch);
  const sourceBranch = gitValue(
    workspaceDir,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  );
  const baseCommit = gitValue(repoDir, "rev-parse", targetRef);
  const sourceCommit = gitValue(workspaceDir, "rev-parse", "HEAD");

  const existingPr = (
    await pullRequests(repoDir, sourceBranch, targetBranch)
  )[0];
  const existingPrId = optionalString(existingPr?.pullRequestId);
  if (existingPrId) {
    const currentPr = await pullRequest(repoDir, existingPrId);
    const prState = pullRequestState(currentPr);
    const mergeStatus = pullRequestMergeStatus(currentPr);
    const review = pullRequestReviewTrigger(
      (reconciliation.events.items.at(-1)?.event as
        Record<string, unknown> | undefined) ?? null,
      existingPrId,
    );
    if (prState === "completed") {
      const integration = completedPullRequestIntegration({
        mergeStatus,
        testedSourceCommit: sourceCommit,
        mergedSourceCommit: optionalString(
          currentPr.lastMergeSourceCommit?.commitId,
        ),
        mergeCommit: optionalString(currentPr.lastMergeCommit?.commitId),
      });
      if (integration.status !== "integrated") {
        return ctx.done(
          `PR ${existingPrId} completed without proving integration of ${sourceCommit}`,
          {
            state: "needs-agent",
            summary: `PR ${existingPrId} completed without proving integration of ${sourceCommit}`,
            evidence: [
              `pull-request:${existingPrId}`,
              `pull-request-status:${prState}`,
              `merge-status:${mergeStatus}`,
              `source-branch:${sourceBranch}`,
              `source-commit:${sourceCommit}`,
              `integration-proof:${integration.reason}`,
            ],
            actions: [],
          },
        );
      }
      gitValue(repoDir, "fetch", "origin", targetBranch);
      const targetCommit = gitValue(repoDir, "rev-parse", targetRef);
      if (
        gitExitCode(
          repoDir,
          "merge-base",
          "--is-ancestor",
          integration.targetCommit,
          targetRef,
        ) !== 0
      ) {
        return ctx.done(
          `PR ${existingPrId} reports merge commit ${integration.targetCommit}, but ${targetRef} does not yet contain it`,
          {
            state: "needs-agent",
            summary: `PR ${existingPrId} reports merge commit ${integration.targetCommit}, but ${targetRef} does not yet contain it`,
            evidence: [
              `pull-request:${existingPrId}`,
              `merge-commit:${integration.targetCommit}`,
              `target-ref:${targetRef}`,
              `target-commit:${targetCommit}`,
            ],
            actions: [],
          },
        );
      }
      const converged = verifiedIntegrationEvidence({
        result: {
          state: "converged",
          summary: reconciliation.outcome || `Published ${taskId}`,
          evidence: [],
          actions: [],
        },
        pullRequestId: existingPrId,
        sourceBranch,
        sourceCommit,
        mergeCommit: integration.targetCommit,
        targetRef,
        targetCommit,
      });
      return ctx.done(converged.summary, converged);
    }
    if (prState === "abandoned" || mergeStatus === "conflicts") {
      return ctx.done(
        `PR ${existingPrId} requires bounded source-owner repair`,
        {
          state: "needs-agent",
          summary: `PR ${existingPrId} requires bounded source-owner repair`,
          evidence: [
            `pull-request:${existingPrId}`,
            `pull-request-status:${prState}`,
            `merge-status:${mergeStatus}`,
            `source-branch:${sourceBranch}`,
            `source-commit:${sourceCommit}`,
          ],
          actions: [],
        },
      );
    }
    if (reviewNeedsJudgment(review, input)) {
      const session = await ctx.agents.call(
        reconciliation.agent,
        promptForExistingPullRequestReview({
          ctx,
          pullRequestId: existingPrId,
          targetRef,
          sourceBranch,
          sourceCommit,
          allowedChangedFiles,
          review,
        }),
        {
          timeoutMs: 1_800_000,
          schema: taskReconcileResultSchema,
        },
      );
      if (session.status !== "done") {
        return ctx.blocked(
          "Non-spec main publication review-repair agent session failed",
          {
            executionId: session.id,
            status: session.status,
            summary: session.summary,
            workspaceDir,
            pullRequestId: existingPrId,
            reviewFingerprint: review.fingerprint,
          },
        );
      }

      const agentResult = session.output as TaskReconcileResult;
      const committedSourceCommit = gitValue(workspaceDir, "rev-parse", "HEAD");
      const recoverWorkflowOwnedWait = isWorkflowOwnedPublicationWait({
        result: agentResult,
        sourceCommit: committedSourceCommit,
        targetRef,
      });
      if (agentResult.state !== "converged" && !recoverWorkflowOwnedWait) {
        return ctx.done(agentResult.summary, agentResult);
      }
      if (workspaceChanges(workspaceDir)) {
        return ctx.done("Publication task left uncommitted workspace changes", {
          state: "needs-agent",
          summary: "Publication task left uncommitted workspace changes",
          evidence: [`workspace:${workspaceDir}`],
          actions: [],
        });
      }

      const files = changedFiles(workspaceDir, targetRef);
      if (!files.length) {
        return ctx.done(
          "Publication task created no bounded repository diff from current main",
          {
            state: "needs-agent",
            summary:
              "Publication task created no bounded repository diff from current main",
            evidence: [
              ...(agentResult.evidence ?? []),
              `source-branch:${sourceBranch}`,
              `source-commit:${committedSourceCommit}`,
              `target-ref:${targetRef}`,
            ],
            actions: agentResult.actions ?? [],
          },
        );
      }
      if (allowedChangedFiles.length) {
        const unexpected = files.filter(
          (file) => !allowedChangedFiles.includes(file),
        );
        if (unexpected.length) {
          return ctx.done(
            "Publication task changed files outside its bounded scope",
            {
              state: "needs-agent",
              summary:
                "Publication task changed files outside its bounded scope",
              evidence: [
                ...(agentResult.evidence ?? []),
                `unexpected-files:${unexpected.join(",")}`,
                `allowed-files:${allowedChangedFiles.join(",")}`,
              ],
              actions: agentResult.actions ?? [],
            },
          );
        }
      }

      const rangeValidation = validatePublicationRange({
        cwd: workspaceDir,
        baseCommit,
        candidateCommit: committedSourceCommit,
        taskStartCommit: sourceCommit,
        currentTaskEvidence: agentResult.evidence ?? [],
        acceptedCommits: acceptedPublicationCommits(
          input.acceptedPublicationCommits,
        ),
      });
      if (rangeValidation.ok === false) {
        const refusal = publicationRangeRefusal(rangeValidation, agentResult);
        return ctx.done(refusal.summary, refusal);
      }
      agentResult.evidence = [
        ...(agentResult.evidence ?? []),
        ...rangeValidation.evidence,
      ];

      gitValue(workspaceDir, "push", "origin", `HEAD:${sourceBranch}`);
      const refreshedPr = await pullRequest(repoDir, existingPrId);
      const waiting = waitingForPullRequest({
        result: agentResult,
        taskId,
        generation,
        pullRequestId: existingPrId,
        sourceBranch,
        sourceCommit: committedSourceCommit,
        targetRef,
        prState: pullRequestState(refreshedPr),
        mergeStatus: pullRequestMergeStatus(refreshedPr),
        review,
      });
      return ctx.done(waiting.summary, waiting);
    }
    const waiting = waitingForPullRequest({
      result: {
        state: "waiting",
        summary: reconciliation.outcome || `Published ${taskId}`,
        evidence: [],
        actions: [],
      },
      taskId,
      generation,
      pullRequestId: existingPrId,
      sourceBranch,
      sourceCommit,
      targetRef,
      prState,
      mergeStatus,
      review: review ?? undefined,
      waitingReason: review
        ? `Active PR ${existingPrId} still carries unresolved review fingerprint ${review.fingerprint || "missing"}; repeated identical review payload was coalesced while waiting for merge or another source/review change into ${targetRef}.`
        : undefined,
    });
    return ctx.done(waiting.summary, waiting);
  }

  const session = await ctx.agents.call(
    reconciliation.agent,
    promptForPublication({
      ctx,
      targetBranch,
      sourceBranch,
      baseCommit,
      allowedChangedFiles,
    }),
    {
      timeoutMs: 1_800_000,
      schema: taskReconcileResultSchema,
    },
  );
  if (session.status !== "done") {
    return ctx.blocked("Non-spec main publication agent session failed", {
      executionId: session.id,
      status: session.status,
      summary: session.summary,
      workspaceDir,
    });
  }

  const agentResult = session.output as TaskReconcileResult;
  const committedSourceCommit = gitValue(workspaceDir, "rev-parse", "HEAD");
  const recoverWorkflowOwnedWait = isWorkflowOwnedPublicationWait({
    result: agentResult,
    sourceCommit: committedSourceCommit,
    targetRef,
  });
  if (agentResult.state !== "converged" && !recoverWorkflowOwnedWait) {
    return ctx.done(agentResult.summary, agentResult);
  }
  if (workspaceChanges(workspaceDir)) {
    return ctx.done("Publication task left uncommitted workspace changes", {
      state: "needs-agent",
      summary: "Publication task left uncommitted workspace changes",
      evidence: [`workspace:${workspaceDir}`],
      actions: [],
    });
  }

  const files = changedFiles(workspaceDir, targetRef);
  if (!files.length) {
    return ctx.done(
      "Publication task created no bounded repository diff from current main",
      {
        state: "needs-agent",
        summary:
          "Publication task created no bounded repository diff from current main",
        evidence: [
          ...(agentResult.evidence ?? []),
          `source-branch:${sourceBranch}`,
          `source-commit:${committedSourceCommit}`,
          `target-ref:${targetRef}`,
        ],
        actions: agentResult.actions ?? [],
      },
    );
  }
  if (allowedChangedFiles.length) {
    const unexpected = files.filter(
      (file) => !allowedChangedFiles.includes(file),
    );
    if (unexpected.length) {
      return ctx.done(
        "Publication task changed files outside its bounded scope",
        {
          state: "needs-agent",
          summary: "Publication task changed files outside its bounded scope",
          evidence: [
            ...(agentResult.evidence ?? []),
            `unexpected-files:${unexpected.join(",")}`,
            `allowed-files:${allowedChangedFiles.join(",")}`,
          ],
          actions: agentResult.actions ?? [],
        },
      );
    }
  }

  const rangeValidation = validatePublicationRange({
    cwd: workspaceDir,
    baseCommit,
    candidateCommit: committedSourceCommit,
    taskStartCommit: sourceCommit,
    currentTaskEvidence: agentResult.evidence ?? [],
    acceptedCommits: acceptedPublicationCommits(
      input.acceptedPublicationCommits,
    ),
  });
  if (rangeValidation.ok === false) {
    const refusal = publicationRangeRefusal(rangeValidation, agentResult);
    return ctx.done(refusal.summary, refusal);
  }
  agentResult.evidence = [
    ...(agentResult.evidence ?? []),
    ...rangeValidation.evidence,
  ];

  gitValue(workspaceDir, "push", "origin", `HEAD:${sourceBranch}`);
  let pr: PullRequest;
  try {
    pr = await createPullRequest(repoDir, {
      taskId,
      sourceBranch,
      sourceCommit: committedSourceCommit,
      targetBranch,
      title: pullRequestTitle(taskId, input),
      description: pullRequestDescription({
        taskId,
        outcome: reconciliation.outcome,
        sourceCommit: committedSourceCommit,
        targetBranch,
        allowedChangedFiles,
      }),
    });
  } catch (error) {
    const recovered = (
      await pullRequests(repoDir, sourceBranch, targetBranch)
    )[0];
    if (!optionalString(recovered?.pullRequestId)) throw error;
    pr = recovered;
  }
  const pullRequestId = optionalString(pr.pullRequestId);
  const waiting = waitingForPullRequest({
    result: agentResult,
    taskId,
    generation,
    pullRequestId,
    sourceBranch,
    sourceCommit: committedSourceCommit,
    targetRef,
    prState: pullRequestState(pr),
    mergeStatus: pullRequestMergeStatus(pr),
  });
  return ctx.done(waiting.summary, waiting);
}

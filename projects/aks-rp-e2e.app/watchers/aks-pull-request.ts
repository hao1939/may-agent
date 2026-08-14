import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ProjectAppContext, ProjectAppEvent } from "@may-agent/sdk/legacy";

type PullRequestWatcherState = {
  activeIds?: string[];
  checkedAt?: string;
};

type PullRequest = {
  pullRequestId?: unknown;
  status?: unknown;
  mergeStatus?: unknown;
  sourceRefName?: unknown;
  targetRefName?: unknown;
  lastMergeSourceCommit?: { commitId?: unknown };
  lastMergeTargetCommit?: { commitId?: unknown };
  lastMergeCommit?: { commitId?: unknown };
  url?: unknown;
};

type PullRequestThread = {
  id?: unknown;
  status?: unknown;
  threadContext?: { filePath?: unknown };
  comments?: Array<{
    id?: unknown;
    content?: unknown;
    commentType?: unknown;
    isDeleted?: unknown;
    author?: { displayName?: unknown };
  }>;
};

export type PullRequestReview = {
  available: boolean;
  unresolvedCount: number;
  fingerprint: string;
  threads: Array<{
    threadId: string;
    path: string | null;
    author: string;
    content: string;
  }>;
};

export type ObservedPullRequest = {
  pullRequestId: string;
  status: string;
  mergeStatus: string;
  state: "active" | "completed" | "abandoned" | "conflicted";
  sourceBranch: string;
  targetBranch: string;
  sourceCommit: string | null;
  targetCommit: string | null;
  mergeCommit: string | null;
  url: string | null;
  review: PullRequestReview;
};

const organization = "https://dev.azure.com/msazure";
const adoProject = "CloudNativeCompute";
const repository = "aks-e2e-spec-runner";
const azCli =
  process.env.AZURE_CLI_PATH ||
  (existsSync("/app/.state/.local/bin/az")
    ? "/app/.state/.local/bin/az"
    : "az");

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readState(path: string): PullRequestWatcherState {
  if (!existsSync(path)) return {};
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveState(path: string, state: PullRequestWatcherState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

function runAzJson(
  args: string[],
  options: { includeProject?: boolean } = {},
): unknown {
  const includeProject = options.includeProject !== false;
  const result = spawnSync(
    azCli,
    [
      ...args,
      "--organization",
      organization,
      ...(includeProject ? ["--project", adoProject] : []),
      "-o",
      "json",
    ],
    {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        AZURE_CONFIG_DIR: process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
      },
    },
  );
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout || "null");
  } catch {
    return null;
  }
}

function listPullRequestThreads(pullRequestId: string): unknown {
  return runAzJson(
    [
      "devops",
      "invoke",
      "--area",
      "git",
      "--resource",
      "pullRequestThreads",
      "--route-parameters",
      `project=${adoProject}`,
      `repositoryId=${repository}`,
      `pullRequestId=${pullRequestId}`,
      "--api-version",
      "7.1",
    ],
    { includeProject: false },
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function normalizedReviewComment(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  const withLineBreaks = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ");
  const normalized = decodeHtmlEntities(withLineBreaks)
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:PR Assistant(?:\s+|$)){3,}/i, "").trim())
    .filter(Boolean)
    .join("\n");
  return normalized.length > 2_000 ? normalized.slice(-2_000) : normalized;
}

export function summarizePullRequestReview(value: unknown): PullRequestReview {
  if (!value || typeof value !== "object") {
    return {
      available: false,
      unresolvedCount: 0,
      fingerprint: "",
      threads: [],
    };
  }
  const rawThreads = Array.isArray((value as { value?: unknown }).value)
    ? ((value as { value: PullRequestThread[] }).value ?? [])
    : [];
  const threads = rawThreads
    .filter((thread) => text(thread.status) === "active")
    .flatMap((thread) => {
      const comments = Array.isArray(thread.comments)
        ? thread.comments.filter(
            (comment) =>
              comment?.isDeleted !== true &&
              text(comment?.commentType) === "text" &&
              Boolean(text(comment?.content)),
          )
        : [];
      const comment = comments.at(-1);
      const threadId = text(thread.id);
      if (!threadId || !comment) return [];
      return [
        {
          threadId,
          path: text(thread.threadContext?.filePath) || null,
          author: text(comment.author?.displayName) || "unknown",
          content: normalizedReviewComment(comment.content),
        },
      ];
    })
    .sort((left, right) => left.threadId.localeCompare(right.threadId));
  return {
    available: true,
    unresolvedCount: threads.length,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(threads))
      .digest("hex")
      .slice(0, 16),
    threads,
  };
}

function listPullRequests(knownIds: string[] = []): PullRequest[] {
  if (process.env.MAY_AGENT_AKS_PR_WATCHER_ADO === "0") return [];
  const value = runAzJson([
    "repos",
    "pr",
    "list",
    "--repository",
    repository,
    "--status",
    "all",
    "--top",
    "100",
  ]);
  const listed = Array.isArray(value) ? (value as PullRequest[]) : [];
  const byId = new Map(
    listed.map((pullRequest) => [text(pullRequest.pullRequestId), pullRequest]),
  );
  for (const id of knownIds.slice(-100)) {
    if (byId.has(id)) continue;
    const exact = runAzJson(["repos", "pr", "show", "--id", id]);
    if (exact && typeof exact === "object") byId.set(id, exact as PullRequest);
  }
  return [...byId.values()];
}

function branchName(value: unknown): string {
  return text(value).replace(/^refs\/heads\//, "");
}

export function observePullRequest(
  pullRequest: PullRequest,
  review: PullRequestReview = {
    available: false,
    unresolvedCount: 0,
    fingerprint: "",
    threads: [],
  },
): ObservedPullRequest | null {
  const pullRequestId = text(pullRequest.pullRequestId);
  if (!pullRequestId) return null;
  const status = text(pullRequest.status) || "unknown";
  const mergeStatus = text(pullRequest.mergeStatus) || "unknown";
  const sourceCommit =
    text(pullRequest.lastMergeSourceCommit?.commitId) || null;
  let state: ObservedPullRequest["state"] = "active";
  if (status === "abandoned") state = "abandoned";
  else if (status === "completed" && mergeStatus === "succeeded")
    state = "completed";
  else if (mergeStatus === "conflicts") state = "conflicted";

  return {
    pullRequestId,
    status,
    mergeStatus,
    state,
    sourceBranch: branchName(pullRequest.sourceRefName),
    targetBranch: branchName(pullRequest.targetRefName),
    sourceCommit,
    targetCommit: text(pullRequest.lastMergeTargetCommit?.commitId) || null,
    mergeCommit: text(pullRequest.lastMergeCommit?.commitId) || null,
    url: text(pullRequest.url) || null,
    review,
  };
}

export function pullRequestObservationEvent(
  observed: ObservedPullRequest,
): ProjectAppEvent {
  const data = {
    project: "aks-rp-e2e",
    pullRequestId: observed.pullRequestId,
    state: observed.state,
    status: observed.status,
    mergeStatus: observed.mergeStatus,
    sourceBranch: observed.sourceBranch,
    targetBranch: observed.targetBranch,
    reviewAvailable: observed.review.available,
    unresolvedReviewCount: observed.review.unresolvedCount,
    reviewFingerprint: observed.review.fingerprint,
    unresolvedReviewThreads: observed.review.threads,
    ...(observed.sourceCommit ? { sourceCommit: observed.sourceCommit } : {}),
    ...(observed.targetCommit ? { targetCommit: observed.targetCommit } : {}),
    ...(observed.mergeCommit ? { mergeCommit: observed.mergeCommit } : {}),
    ...(observed.url ? { url: observed.url } : {}),
  };
  return {
    type: "pull-request.state",
    source: "aks-pull-request-watcher",
    target: { project: "aks-rp-e2e" },
    ...data,
    data,
  };
}

/** Observe task-owned AKS PRs as provider facts; task Conditions perform correlation. */
export async function observeAksPullRequests(
  ctx: ProjectAppContext,
): Promise<unknown> {
  const statePath = ctx.appPath(".state/watchers/aks-pull-request.json");
  const prior = readState(statePath);
  const pullRequests = listPullRequests(prior.activeIds ?? []).filter(
    (pullRequest) => branchName(pullRequest.sourceRefName).startsWith("task/"),
  );
  const observed = pullRequests.flatMap((pullRequest) => {
    const pullRequestId = text(pullRequest.pullRequestId);
    const isActive = text(pullRequest.status) === "active";
    const review = isActive
      ? summarizePullRequestReview(listPullRequestThreads(pullRequestId))
      : { available: true, unresolvedCount: 0, fingerprint: "", threads: [] };
    const value = observePullRequest(pullRequest, review);
    return value ? [value] : [];
  });
  saveState(statePath, {
    activeIds: observed
      .filter(
        (value) => value.state === "active" || value.state === "conflicted",
      )
      .map((value) => value.pullRequestId),
    checkedAt: new Date().toISOString(),
  });

  // Level observations are deliberately repeated. A Condition registered after
  // a provider transition must still see the current PR state on the next scan.
  for (const value of observed) ctx.emit(pullRequestObservationEvent(value));
  return observed.length > 0
    ? { observed: observed.length }
    : ctx.noop("No task-owned AKS pull requests were observed.");
}

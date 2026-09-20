import { createHash } from "node:crypto";
import type {
  AppEvent,
  AppObserver,
  AppObserverResult,
  Condition,
  ObserverContext,
  TaskDetail,
} from "@may-agent/sdk";

export const GITHUB_PULL_REQUEST_EVENT = "may.github.pull-request.state";
export const GITHUB_PULL_REQUEST_PREFIX = "pull-request:github:";
const ACTIVE_STATUSES = ["pending", "running", "waiting", "attention"] as const;
const GITHUB_API_ORIGIN = "https://api.github.com";
const PER_PAGE = 100;
const MAX_REVIEW_PAGES = 10;
const REQUEST_TIMEOUT_MS = 15_000;
const OBSERVER_INTERVAL_MS = 15 * 60_000;
const MAX_HTTP_REQUESTS_PER_RUN = 11;
const MAX_INTERESTS_PER_RUN = 12;
const MAX_MEMORY_ENTRIES = 128;

type FetchLike = typeof fetch;

type PullRequestInterest = {
  taskId: string;
  condition: Condition;
  repository: string;
  number: number;
  pullRequestId: string;
  baseline: string | null;
  signature: string;
};

type ReviewFact = {
  id: number;
  state: string;
  commitId: string | null;
  submittedAt: string | null;
  reviewer: string | null;
};

export type GitHubPullRequestFact = {
  provider: "github";
  repository: string;
  number: number;
  pullRequestId: string;
  state: "open" | "closed";
  draft: boolean;
  headSha: string;
  merged: boolean;
  mergedAt: string | null;
  mergeCommitSha: string | null;
  reviews: ReviewFact[];
  reviewsComplete: boolean;
  reviewError?: string;
  fingerprint: string;
  fetchedAt: string;
};

type ObserverMemory = {
  cursor?: number;
  deferUntil?: number;
  states?: Record<string, string>;
};

type RequestBudget = {
  remaining: number;
  deferUntil?: number;
  nowMs: number;
};

type PublicationState = {
  success?: string;
  pullFailure?: string;
  reviewFailure?: string;
};

class DeferredReadError extends Error {}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseLinkNext(value: string | null): string | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match?.[2].split(/\s+/).includes("next")) return match[1];
  }
  return null;
}

function validRepository(repository: string): boolean {
  const parts = repository.split("/");
  return (
    parts.length === 2 &&
    parts.every(
      (part) =>
        part.length > 0 &&
        part.length <= 100 &&
        /^[A-Za-z0-9_.-]+$/.test(part) &&
        part !== "." &&
        part !== "..",
    )
  );
}

export function parsePullRequestSubject(
  subject: string,
): { repository: string; number: number; pullRequestId: string } | null {
  if (!subject.startsWith(GITHUB_PULL_REQUEST_PREFIX)) return null;
  const identity = subject.slice(GITHUB_PULL_REQUEST_PREFIX.length);
  const match = identity.match(/^([^#]+)#([1-9][0-9]*)$/);
  if (!match || !validRepository(match[1])) return null;
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number)) return null;
  return { repository: match[1], number, pullRequestId: `github:${identity}` };
}

export function validateGitHubPullRequestCondition(
  condition: Condition,
): string | null {
  if (condition.type !== GITHUB_PULL_REQUEST_EVENT) return null;
  const parsed = parsePullRequestSubject(condition.subject);
  if (!parsed) {
    return `GitHub pull-request Conditions require ${GITHUB_PULL_REQUEST_PREFIX}<owner>/<repo>#<number>`;
  }
  const expected = record(condition.expected);
  if (
    expected.provider !== "github" ||
    expected.repository !== parsed.repository ||
    expected.field !== "fingerprint" ||
    !(
      expected.notEquals === null ||
      (typeof expected.notEquals === "string" &&
        /^[0-9a-f]{64}$/.test(expected.notEquals))
    )
  ) {
    return "GitHub pull-request Conditions require matching provider/repository and fingerprint notEquals (null initially, then the exact observed SHA-256 fingerprint)";
  }
  return null;
}

function interestFrom(
  taskId: string,
  condition: Condition,
): PullRequestInterest | null {
  if (condition.type !== GITHUB_PULL_REQUEST_EVENT) return null;
  if (validateGitHubPullRequestCondition(condition)) return null;
  const parsed = parsePullRequestSubject(condition.subject)!;
  const expected = record(condition.expected);
  const baseline =
    expected.notEquals === null ? null : String(expected.notEquals);
  return {
    taskId,
    condition,
    ...parsed,
    baseline,
    signature: createHash("sha256")
      .update(
        JSON.stringify([
          taskId,
          condition.id,
          condition.subject,
          condition.expected,
        ]),
      )
      .digest("hex"),
  };
}

export async function discoverGitHubPullRequestInterests(
  ctx: ObserverContext,
): Promise<PullRequestInterest[]> {
  const interests: PullRequestInterest[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.read.tasks.list({
      status: [...ACTIVE_STATUSES],
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const view of page.items) {
      const task = await ctx.read.tasks.get(view.id);
      if (
        !task ||
        task.closed ||
        !ACTIVE_STATUSES.includes(task.status as never)
      )
        continue;
      for (const condition of task.conditions) {
        const interest = interestFrom(task.id, condition);
        if (interest) interests.push(interest);
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
  return interests.sort(
    (a, b) =>
      a.repository.localeCompare(b.repository) ||
      a.number - b.number ||
      a.taskId.localeCompare(b.taskId) ||
      a.condition.id.localeCompare(b.condition.id),
  );
}

function pullUrl(repository: string, number: number): string {
  return `${GITHUB_API_ORIGIN}/repos/${repository}/pulls/${number}`;
}

function assertAllowedGitHubUrl(
  value: string,
  repository: string,
  number: number,
  scope: "pull-request" | "reviews",
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("GitHub pagination URL is not an absolute URL");
  }
  const expectedPath = `/repos/${repository}/pulls/${number}${
    scope === "reviews" ? "/reviews" : ""
  }`;
  if (
    url.origin !== GITHUB_API_ORIGIN ||
    url.username ||
    url.password ||
    url.pathname !== expectedPath ||
    url.hash
  ) {
    throw new Error(`refused GitHub ${scope} URL outside its fixed endpoint`);
  }
  if (scope === "pull-request") {
    if (url.search) {
      throw new Error("refused query parameters on GitHub pull-request URL");
    }
    return url;
  }
  const keys = [...url.searchParams.keys()];
  const perPage = url.searchParams.getAll("per_page");
  const pages = url.searchParams.getAll("page");
  if (
    keys.some((key) => key !== "per_page" && key !== "page") ||
    perPage.length !== 1 ||
    perPage[0] !== String(PER_PAGE) ||
    pages.length > 1 ||
    (pages.length === 1 &&
      (!/^[1-9][0-9]*$/.test(pages[0]) ||
        !Number.isSafeInteger(Number(pages[0]))))
  ) {
    throw new Error("refused unsafe GitHub review pagination query");
  }
  return url;
}

function parseDeferral(response: Response, nowMs: number): number | undefined {
  const candidates: number[] = [];
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    if (/^[0-9]+$/.test(retryAfter)) {
      candidates.push(nowMs + Number(retryAfter) * 1_000);
    } else {
      const parsed = Date.parse(retryAfter);
      if (Number.isFinite(parsed)) candidates.push(parsed);
    }
  }
  const reset = response.headers.get("x-ratelimit-reset");
  if (reset && /^[0-9]+$/.test(reset)) {
    candidates.push(Number(reset) * 1_000 + 1_000);
  }
  const remaining = response.headers.get("x-ratelimit-remaining");
  const rateLimited =
    response.status === 429 || retryAfter !== null || remaining === "0";
  if (!rateLimited) return undefined;
  return Math.max(nowMs + 1_000, ...candidates, nowMs + OBSERVER_INTERVAL_MS);
}

async function githubJson(
  url: string,
  repository: string,
  number: number,
  scope: "pull-request" | "reviews",
  fetchImpl: FetchLike,
  budget: RequestBudget,
): Promise<{ value: unknown; next: string | null }> {
  const requested = assertAllowedGitHubUrl(url, repository, number, scope);
  if (budget.deferUntil && budget.deferUntil > budget.nowMs) {
    throw new DeferredReadError(
      `GitHub rate-limit deferral remains active until ${new Date(
        budget.deferUntil,
      ).toISOString()}`,
    );
  }
  if (budget.remaining <= 0) {
    throw new DeferredReadError(
      "conservative GitHub HTTP request budget exhausted for this pass",
    );
  }
  budget.remaining--;
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "may-agent-github-pr-observer",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const deferUntil = parseDeferral(response, budget.nowMs);
  if (deferUntil)
    budget.deferUntil = Math.max(budget.deferUntil ?? 0, deferUntil);
  if (
    response.redirected ||
    (response.url && new URL(response.url).href !== requested.href)
  ) {
    throw new Error(`refused redirected GitHub ${scope} response`);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`refused GitHub ${scope} HTTP redirect ${response.status}`);
  }
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");
    throw new Error(
      `GitHub read failed HTTP ${response.status}${
        remaining ? `; rate-limit-remaining=${remaining}` : ""
      }${reset ? `; rate-limit-reset=${reset}` : ""}`,
    );
  }
  return {
    value: await response.json(),
    next: parseLinkNext(response.headers.get("link")),
  };
}

function requiredBoolean(
  value: Record<string, unknown>,
  field: string,
): boolean {
  if (typeof value[field] !== "boolean") {
    throw new Error(`GitHub pull request is missing boolean ${field}`);
  }
  return value[field];
}

function requiredNullableText(
  value: Record<string, unknown>,
  field: string,
): string | null {
  const item = value[field];
  if (item === null) return null;
  if (typeof item !== "string" || !item.trim()) {
    throw new Error(`GitHub pull request has malformed ${field}`);
  }
  return item.trim();
}

export async function readGitHubPullRequest(
  repository: string,
  number: number,
  fetchImpl: FetchLike = fetch,
  now: () => Date = () => new Date(),
  suppliedBudget?: RequestBudget,
): Promise<GitHubPullRequestFact> {
  if (
    !validRepository(repository) ||
    !Number.isSafeInteger(number) ||
    number < 1
  ) {
    throw new Error("invalid GitHub pull-request identity");
  }
  const observedAt = now();
  if (!Number.isFinite(observedAt.getTime()))
    throw new Error("invalid observation time");
  const budget = suppliedBudget ?? {
    remaining: MAX_REVIEW_PAGES + 1,
    nowMs: observedAt.getTime(),
  };
  const base = pullUrl(repository, number);
  const pullResponse = await githubJson(
    base,
    repository,
    number,
    "pull-request",
    fetchImpl,
    budget,
  );
  const pull = record(pullResponse.value);
  if (typeof pull.number !== "number" || pull.number !== number) {
    throw new Error(
      "GitHub response identity does not match requested pull request",
    );
  }
  const baseRepo = record(record(pull.base).repo).full_name;
  if (
    typeof baseRepo !== "string" ||
    baseRepo.toLowerCase() !== repository.toLowerCase()
  ) {
    throw new Error(
      "GitHub response identity does not match requested pull request",
    );
  }
  if (pull.state !== "open" && pull.state !== "closed") {
    throw new Error("GitHub pull request has unknown or missing state");
  }
  const state = pull.state === "open" ? ("open" as const) : ("closed" as const);
  const draft = requiredBoolean(pull, "draft");
  const merged = requiredBoolean(pull, "merged");
  const headSha = text(record(pull.head).sha);
  if (!headSha) throw new Error("GitHub pull request is missing head SHA");
  const mergedAt = requiredNullableText(pull, "merged_at");
  const mergeCommitSha = requiredNullableText(pull, "merge_commit_sha");
  const reviews: ReviewFact[] = [];
  let reviewError: string | undefined;
  try {
    let next: string | null = `${base}/reviews?per_page=${PER_PAGE}`;
    let pages = 0;
    const visited = new Set<string>();
    while (next) {
      const normalized = assertAllowedGitHubUrl(
        next,
        repository,
        number,
        "reviews",
      ).href;
      if (visited.has(normalized)) {
        throw new Error("GitHub review pagination repeated a page");
      }
      visited.add(normalized);
      if (++pages > MAX_REVIEW_PAGES) {
        throw new Error(
          `GitHub review pagination exceeded ${MAX_REVIEW_PAGES} pages`,
        );
      }
      const page = await githubJson(
        next,
        repository,
        number,
        "reviews",
        fetchImpl,
        budget,
      );
      if (!Array.isArray(page.value))
        throw new Error("GitHub reviews response is not an array");
      for (const item of page.value) {
        const review = record(item);
        if (
          typeof review.id !== "number" ||
          !Number.isSafeInteger(review.id) ||
          review.id < 1
        ) {
          throw new Error("GitHub review is missing a positive integer id");
        }
        const state = text(review.state);
        if (!state) throw new Error("GitHub review is missing state");
        reviews.push({
          id: review.id,
          state: state.toLowerCase(),
          commitId: text(review.commit_id) || null,
          submittedAt: text(review.submitted_at) || null,
          reviewer: text(record(review.user).login) || null,
        });
      }
      next = page.next;
    }
  } catch (error) {
    reviewError = error instanceof Error ? error.message : String(error);
  }
  reviews.sort((a, b) => a.id - b.id);
  const meaningful = {
    provider: "github" as const,
    repository,
    number,
    pullRequestId: `github:${repository}#${number}`,
    state,
    draft,
    headSha,
    merged,
    mergedAt,
    mergeCommitSha,
    reviews,
    reviewsComplete: reviewError === undefined,
  };
  return {
    ...meaningful,
    ...(reviewError ? { reviewError } : {}),
    fingerprint: createHash("sha256")
      .update(JSON.stringify(meaningful))
      .digest("hex"),
    fetchedAt: observedAt.toISOString(),
  };
}

function sameCondition(
  task: TaskDetail | null,
  interest: PullRequestInterest,
): boolean {
  if (!task || task.closed) return false;
  return task.conditions.some(
    (condition) =>
      interestFrom(task.id, condition)?.signature === interest.signature,
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function parsePublicationState(value: unknown): PublicationState {
  const candidate = record(value);
  return {
    ...(isDigest(candidate.success) ? { success: candidate.success } : {}),
    ...(isDigest(candidate.pullFailure)
      ? { pullFailure: candidate.pullFailure }
      : {}),
    ...(isDigest(candidate.reviewFailure)
      ? { reviewFailure: candidate.reviewFailure }
      : {}),
  };
}

function boundedStates(
  previous: unknown,
  liveKeys: ReadonlySet<string>,
): Record<string, PublicationState> {
  const states: Record<string, PublicationState> = {};
  for (const [key, value] of Object.entries(record(previous))) {
    const parsed = parsePublicationState(value);
    if (liveKeys.has(key) && isDigest(key) && Object.keys(parsed).length > 0) {
      states[key] = parsed;
    }
  }
  while (Object.keys(states).length > MAX_MEMORY_ENTRIES) {
    delete states[Object.keys(states)[0]];
  }
  return states;
}

function setPublicationState(
  states: Record<string, PublicationState>,
  key: string,
  value: PublicationState,
): void {
  delete states[key];
  states[key] = value;
  while (Object.keys(states).length > MAX_MEMORY_ENTRIES) {
    delete states[Object.keys(states)[0]];
  }
}

function publicationMarker(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedCursor(value: unknown, length: number): number {
  return length > 0 && Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value) % length
    : 0;
}

export async function observeGitHubPullRequests(
  ctx: ObserverContext,
  fetchImpl: FetchLike = fetch,
  now: () => Date = () => new Date(),
): Promise<AppObserverResult> {
  const all = await discoverGitHubPullRequestInterests(ctx);
  const previous = record(ctx.previousObservation) as ObserverMemory;
  const start = normalizedCursor(previous.cursor, all.length);
  const liveKeys = new Set(all.map((interest) => interest.signature));
  const states = boundedStates(previous.states, liveKeys);
  const observedAt = now();
  if (!Number.isFinite(observedAt.getTime()))
    throw new Error("invalid observation time");
  const priorDeferral =
    typeof previous.deferUntil === "number" &&
    Number.isSafeInteger(previous.deferUntil) &&
    previous.deferUntil > observedAt.getTime()
      ? previous.deferUntil
      : undefined;
  if (priorDeferral) {
    ctx.log.info(
      `GitHub pull-request observer deferred provider reads until ${new Date(
        priorDeferral,
      ).toISOString()}`,
    );
    return {
      events: [],
      nextObservation: { cursor: start, deferUntil: priorDeferral, states },
    };
  }

  const events: AppEvent<Record<string, unknown>>[] = [];
  const budget: RequestBudget = {
    remaining: MAX_HTTP_REQUESTS_PER_RUN,
    nowMs: observedAt.getTime(),
  };
  const outcomes = new Map<
    string,
    { fact: GitHubPullRequestFact } | { error: string }
  >();
  let advanced = 0;
  let stopNewReads = false;
  const attemptCount = Math.min(MAX_INTERESTS_PER_RUN, all.length);

  for (let offset = 0; offset < attemptCount; offset++) {
    const interest = all[(start + offset) % all.length];
    let outcome = outcomes.get(interest.pullRequestId);
    if (!outcome) {
      if (stopNewReads || budget.remaining < 2) break;
      try {
        outcome = {
          fact: await readGitHubPullRequest(
            interest.repository,
            interest.number,
            fetchImpl,
            () => observedAt,
            budget,
          ),
        };
      } catch (error) {
        outcome = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
      outcomes.set(interest.pullRequestId, outcome);
      if (budget.deferUntil || budget.remaining < 2) stopNewReads = true;
    }

    // A provider result or error acquired for a replaced wait must neither
    // satisfy nor wake its former Task owner.
    if (!sameCondition(await ctx.read.tasks.get(interest.taskId), interest)) {
      advanced++;
      continue;
    }

    const memoryKey = interest.signature;
    const priorState = parsePublicationState(states[memoryKey]);
    if ("error" in outcome) {
      const failureMarker = publicationMarker(outcome.error);
      ctx.log.warn(
        `GitHub pull-request observation failed for ${interest.pullRequestId}: ${outcome.error}`,
      );
      if (priorState.pullFailure !== failureMarker) {
        events.push({
          type: "may.github.pull-request.read-failed",
          target: { appId: "may", project: "may", taskId: interest.taskId },
          data: {
            provider: "github",
            repository: interest.repository,
            number: interest.number,
            pullRequestId: interest.pullRequestId,
            scope: "pull-request",
            error: outcome.error,
            observedAt: observedAt.toISOString(),
          },
        });
      }
      setPublicationState(states, memoryKey, { pullFailure: failureMarker });
      advanced++;
      continue;
    }

    const fact = outcome.fact;
    const successMarker = publicationMarker(fact.fingerprint);
    let reviewFailure: string | undefined;
    if (fact.reviewError) {
      reviewFailure = publicationMarker(fact.reviewError);
      ctx.log.warn(
        `GitHub review observation failed for ${interest.pullRequestId}: ${fact.reviewError}`,
      );
      if (priorState.reviewFailure !== reviewFailure) {
        events.push({
          type: "may.github.pull-request.read-failed",
          target: { appId: "may", project: "may", taskId: interest.taskId },
          data: {
            provider: "github",
            repository: interest.repository,
            number: interest.number,
            pullRequestId: interest.pullRequestId,
            scope: "reviews",
            error: fact.reviewError,
            observedAt: observedAt.toISOString(),
          },
        });
      }
    }
    if (
      fact.fingerprint !== interest.baseline &&
      priorState.success !== successMarker
    ) {
      events.push({
        type: GITHUB_PULL_REQUEST_EVENT,
        target: { appId: "may", project: "may", taskId: interest.taskId },
        data: fact,
      });
    }
    setPublicationState(states, memoryKey, {
      success: successMarker,
      ...(reviewFailure ? { reviewFailure } : {}),
    });
    advanced++;
  }

  if (all.length > advanced) {
    ctx.log.info(
      `GitHub pull-request observer deferred ${all.length - advanced} interests to later fair bounded passes`,
    );
  }
  return {
    events,
    nextObservation: {
      cursor: all.length === 0 ? 0 : (start + advanced) % all.length,
      ...(budget.deferUntil && budget.deferUntil > observedAt.getTime()
        ? { deferUntil: budget.deferUntil }
        : {}),
      states,
    },
  };
}

export const githubPullRequestObserver: AppObserver = {
  id: "github-pull-request",
  intervalMs: OBSERVER_INTERVAL_MS,
  run: observeGitHubPullRequests,
};

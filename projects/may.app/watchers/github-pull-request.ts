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
const GITHUB_API_ORIGIN = "https://api.github.com";
const PER_PAGE = 50;
const MAX_REVIEW_PAGES = 4;
const MAX_DISCOVERY_PAGES_PER_STATE = 2;
const REQUEST_TIMEOUT_MS = 15_000;
const OBSERVER_INTERVAL_MS = 15 * 60_000;
const MAX_HTTP_REQUESTS_PER_RUN = 11;
const MAX_RESOURCES = 64;
// Reserve half of the candidate set for open PRs retained from earlier passes.
// This bounds memory while preventing a full newest-first discovery window from
// starving resources that have since fallen out of that window.
const MAX_REMEMBERED_RESOURCES = MAX_RESOURCES / 2;

export type GitHubPullRequestScope = {
  repository: string;
  author: string;
  appId: string;
  project: string;
};

type FetchLike = typeof fetch;
type RequestBudget = { remaining: number; deferUntil?: number; nowMs: number };
type Owner = { appId: string; taskId: string };
type Resource = { repository: string; number: number };
type RememberedResource = Resource & { open: boolean };
type PublicationState = { success?: string; reviewFailure?: string };
type ObserverMemory = {
  // cursor retains the legacy positional checkpoint. nextResource is the stable
  // identity checkpoint used when candidate recency changes their order.
  cursor?: number;
  nextResource?: number;
  deferUntil?: number;
  resources?: RememberedResource[];
  states?: Record<string, PublicationState>;
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

type OwnedFact = {
  owner: Owner | null;
  fact: GitHubPullRequestFact;
  author: string;
};
class DeferredReadError extends Error {}
class OwnershipError extends Error {}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
  const match = subject
    .slice(GITHUB_PULL_REQUEST_PREFIX.length)
    .match(/^([^#]+)#([1-9][0-9]*)$/);
  if (!match || !validRepository(match[1])) return null;
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number)) return null;
  return {
    repository: match[1],
    number,
    pullRequestId: `github:${match[1]}#${number}`,
  };
}

export function validateGitHubPullRequestCondition(
  condition: Condition,
): string | null {
  if (condition.type !== GITHUB_PULL_REQUEST_EVENT) return null;
  const parsed = parsePullRequestSubject(condition.subject);
  if (!parsed)
    return `GitHub pull-request Conditions require ${GITHUB_PULL_REQUEST_PREFIX}<owner>/<repo>#<number>`;
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

/** Parse the one public ownership block. Ambiguity is rejection, never first-match. */
export function parseMayTaskOwner(body: unknown): Owner | null {
  if (typeof body !== "string" || body.length > 100_000) return null;
  const visible: string[] = [];
  let fence: { marker: "`" | "~"; length: number } | null = null;
  for (const line of body.split(/\r?\n/)) {
    const opening = line.match(/^\s*(`{3,}|~{3,})/);
    if (opening) {
      const marker = opening[1][0] as "`" | "~";
      if (!fence) fence = { marker, length: opening[1].length };
      else if (fence.marker === marker && opening[1].length >= fence.length)
        fence = null;
      continue;
    }
    if (!fence) visible.push(line);
  }
  if (fence) return null;
  const source = visible.join("\n");
  const headings = [...source.matchAll(/^## May Task\s*$/gm)];
  if (headings.length !== 1) return null;
  const start = headings[0].index! + headings[0][0].length;
  const tail = source.slice(start);
  const end = tail.search(/^#{1,2}\s/m);
  const block = end < 0 ? tail : tail.slice(0, end);
  const appFields = [...block.matchAll(/^- App ID:/gm)];
  const taskFields = [...block.matchAll(/^- Task ID:/gm)];
  if (appFields.length !== 1 || taskFields.length !== 1) return null;
  const apps = [...block.matchAll(/^- App ID:\s*(\S+)\s*$/gm)];
  const tasks = [...block.matchAll(/^- Task ID:\s*(\S+)\s*$/gm)];
  if (apps.length !== 1 || tasks.length !== 1) return null;
  const appId = apps[0][1];
  const taskId = tasks[0][1];
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(appId)) return null;
  if (
    taskId.length < 1 ||
    taskId.length > 256 ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(taskId) ||
    taskId.includes("..")
  )
    return null;
  return { appId, taskId };
}

function parseLinkNext(value: string | null): string | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match?.[2].split(/\s+/).includes("next")) return match[1];
  }
  return null;
}

function pullUrl(repository: string, number: number): string {
  return `${GITHUB_API_ORIGIN}/repos/${repository}/pulls/${number}`;
}
function listUrl(repository: string, state: "open" | "closed"): string {
  return `${GITHUB_API_ORIGIN}/repos/${repository}/pulls?state=${state}&sort=updated&direction=desc&per_page=${PER_PAGE}`;
}

function isPositiveSafeInteger(value: string): boolean {
  if (!/^[1-9][0-9]*$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

function assertAllowedUrl(
  value: string,
  repository: string,
  kind: "list" | "pull" | "reviews",
  number?: number,
): URL {
  const url = new URL(value);
  if (
    url.origin !== GITHUB_API_ORIGIN ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("refused GitHub URL outside fixed API origin");
  const expectedPath =
    kind === "list"
      ? `/repos/${repository}/pulls`
      : `/repos/${repository}/pulls/${number}${kind === "reviews" ? "/reviews" : ""}`;
  if (url.pathname !== expectedPath)
    throw new Error("refused GitHub URL outside fixed endpoint");
  if (kind === "pull" && url.search)
    throw new Error("refused query parameters on GitHub pull-request URL");
  if (kind === "list") {
    const allowed = ["state", "sort", "direction", "per_page", "page"];
    const pages = url.searchParams.getAll("page");
    if (
      !["open", "closed"].includes(url.searchParams.get("state") ?? "") ||
      url.searchParams.getAll("state").length !== 1 ||
      url.searchParams.get("sort") !== "updated" ||
      url.searchParams.getAll("sort").length !== 1 ||
      url.searchParams.get("direction") !== "desc" ||
      url.searchParams.getAll("direction").length !== 1 ||
      url.searchParams.get("per_page") !== String(PER_PAGE) ||
      url.searchParams.getAll("per_page").length !== 1 ||
      pages.length > 1 ||
      (pages.length === 1 && !isPositiveSafeInteger(pages[0])) ||
      [...url.searchParams.keys()].some((key) => !allowed.includes(key))
    )
      throw new Error("refused unsafe GitHub discovery query");
  }
  if (kind === "reviews") {
    const keys = [...url.searchParams.keys()];
    const perPage = url.searchParams.getAll("per_page");
    const pages = url.searchParams.getAll("page");
    if (
      keys.some((key) => key !== "per_page" && key !== "page") ||
      perPage.length !== 1 ||
      perPage[0] !== String(PER_PAGE) ||
      pages.length > 1 ||
      (pages.length === 1 && !isPositiveSafeInteger(pages[0]))
    )
      throw new Error("refused unsafe GitHub review pagination query");
  }
  return url;
}

function parseDeferral(response: Response, nowMs: number): number | undefined {
  const candidates: number[] = [];
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    if (/^\d+$/.test(retryAfter))
      candidates.push(nowMs + Number(retryAfter) * 1000);
    else {
      const date = Date.parse(retryAfter);
      if (Number.isFinite(date)) candidates.push(date);
    }
  }
  const reset = response.headers.get("x-ratelimit-reset");
  if (reset && /^\d+$/.test(reset))
    candidates.push(Number(reset) * 1000 + 1000);
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (response.status !== 429 && retryAfter === null && remaining !== "0")
    return undefined;
  return Math.max(nowMs + OBSERVER_INTERVAL_MS, ...candidates);
}

async function githubJson(
  url: string,
  scope: GitHubPullRequestScope,
  kind: "list" | "pull" | "reviews",
  budget: RequestBudget,
  fetchImpl: FetchLike,
  number?: number,
): Promise<{ value: unknown; next: string | null }> {
  const requested = assertAllowedUrl(url, scope.repository, kind, number);
  if (budget.deferUntil && budget.deferUntil > budget.nowMs)
    throw new DeferredReadError("GitHub rate-limit deferral remains active");
  if (budget.remaining <= 0)
    throw new DeferredReadError("conservative GitHub request budget exhausted");
  budget.remaining--;
  const response = await fetchImpl(requested, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "may-agent-github-pr-observer",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const deferred = parseDeferral(response, budget.nowMs);
  if (deferred) budget.deferUntil = deferred;
  if (response.redirected || (response.url && response.url !== requested.href))
    throw new Error("refused redirected GitHub response");
  if (!response.ok)
    throw new Error(`GitHub read failed HTTP ${response.status}`);
  return {
    value: await response.json(),
    next: parseLinkNext(response.headers.get("link")),
  };
}

function requiredBoolean(
  value: Record<string, unknown>,
  field: string,
): boolean {
  if (typeof value[field] !== "boolean")
    throw new Error(`GitHub pull request is missing boolean ${field}`);
  return value[field];
}
function requiredNullableText(
  value: Record<string, unknown>,
  field: string,
): string | null {
  if (value[field] === null) return null;
  if (typeof value[field] !== "string" || !value[field])
    throw new Error(`GitHub pull request has malformed ${field}`);
  return value[field];
}

async function readOwnedGitHubPullRequest(
  scope: GitHubPullRequestScope,
  number: number,
  fetchImpl: FetchLike,
  observedAt: Date,
  budget: RequestBudget,
  requireOwner = true,
): Promise<OwnedFact> {
  const base = pullUrl(scope.repository, number);
  const pullResponse = await githubJson(
    base,
    scope,
    "pull",
    budget,
    fetchImpl,
    number,
  );
  const pull = record(pullResponse.value);
  const baseRepo = text(record(record(pull.base).repo).full_name);
  if (
    pull.number !== number ||
    baseRepo.toLowerCase() !== scope.repository.toLowerCase()
  )
    throw new Error(
      "GitHub response identity does not match requested pull request",
    );
  const author = text(record(pull.user).login);
  const owner = parseMayTaskOwner(pull.body);
  if (
    requireOwner &&
    (author.toLowerCase() !== scope.author.toLowerCase() ||
      !owner ||
      owner.appId !== scope.appId)
  )
    throw new OwnershipError(
      "GitHub pull request has no unambiguous owner in the configured trust scope",
    );
  if (pull.state !== "open" && pull.state !== "closed")
    throw new Error("GitHub pull request has unknown or missing state");
  const reviews: ReviewFact[] = [];
  let reviewError: string | undefined;
  try {
    let next: string | null = `${base}/reviews?per_page=${PER_PAGE}`;
    const visited = new Set<string>();
    for (let pages = 0; next; pages++) {
      if (pages >= MAX_REVIEW_PAGES)
        throw new Error("GitHub review pagination limit reached");
      const normalized = assertAllowedUrl(
        next,
        scope.repository,
        "reviews",
        number,
      ).href;
      if (visited.has(normalized))
        throw new Error("GitHub review pagination repeated a page");
      visited.add(normalized);
      const page = await githubJson(
        next,
        scope,
        "reviews",
        budget,
        fetchImpl,
        number,
      );
      if (!Array.isArray(page.value))
        throw new Error("GitHub reviews response is not an array");
      for (const item of page.value) {
        const review = record(item);
        if (!Number.isSafeInteger(review.id) || Number(review.id) < 1)
          throw new Error("GitHub review is missing a positive integer id");
        const state = text(review.state);
        if (!state) throw new Error("GitHub review is missing state");
        reviews.push({
          id: Number(review.id),
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
  const state = pull.state as "open" | "closed";
  const meaningful = {
    provider: "github" as const,
    repository: scope.repository,
    number,
    pullRequestId: `github:${scope.repository}#${number}`,
    state,
    draft: requiredBoolean(pull, "draft"),
    headSha: text(record(pull.head).sha),
    merged: requiredBoolean(pull, "merged"),
    mergedAt: requiredNullableText(pull, "merged_at"),
    mergeCommitSha: requiredNullableText(pull, "merge_commit_sha"),
    reviews,
    reviewsComplete: reviewError === undefined,
  };
  if (!meaningful.headSha)
    throw new Error("GitHub pull request is missing head SHA");
  return {
    owner,
    author,
    fact: {
      ...meaningful,
      ...(reviewError ? { reviewError } : {}),
      fingerprint: createHash("sha256")
        .update(JSON.stringify(meaningful))
        .digest("hex"),
      fetchedAt: observedAt.toISOString(),
    },
  };
}

/** Public direct reader retained for read-only connectivity and parser checks. */
export async function readGitHubPullRequest(
  repository: string,
  number: number,
  fetchImpl: FetchLike = fetch,
  now: () => Date = () => new Date(),
): Promise<GitHubPullRequestFact> {
  const owned = await readOwnedGitHubPullRequest(
    { repository, author: "hao1939", appId: "may", project: "may" },
    number,
    fetchImpl,
    now(),
    { remaining: MAX_REVIEW_PAGES + 1, nowMs: now().getTime() },
    false,
  );
  return owned.fact;
}

async function discoverResources(
  scope: GitHubPullRequestScope,
  fetchImpl: FetchLike,
  budget: RequestBudget,
): Promise<{
  resources: Resource[];
  truncated: boolean;
  failures: string[];
  successfulPages: number;
  deferred: boolean;
}> {
  const found = new Map<number, Resource>();
  const failures: string[] = [];
  let truncated = false;
  let successfulPages = 0;
  let deferred = false;
  for (const state of ["open", "closed"] as const) {
    let next: string | null = listUrl(scope.repository, state);
    const visited = new Set<string>();
    try {
      for (
        let pageNumber = 0;
        next && pageNumber < MAX_DISCOVERY_PAGES_PER_STATE;
        pageNumber++
      ) {
        const normalized = assertAllowedUrl(
          next,
          scope.repository,
          "list",
        ).href;
        if (visited.has(normalized))
          throw new Error("GitHub discovery pagination repeated a page");
        visited.add(normalized);
        const page = await githubJson(
          normalized,
          scope,
          "list",
          budget,
          fetchImpl,
        );
        if (!Array.isArray(page.value))
          throw new Error("GitHub discovery response is not an array");
        successfulPages++;
        for (const item of page.value) {
          const pr = record(item);
          const number = pr.number;
          const author = text(record(pr.user).login);
          const baseRepo = text(record(record(pr.base).repo).full_name);
          const owner = parseMayTaskOwner(pr.body);
          if (
            Number.isSafeInteger(number) &&
            Number(number) > 0 &&
            author.toLowerCase() === scope.author.toLowerCase() &&
            baseRepo.toLowerCase() === scope.repository.toLowerCase() &&
            owner?.appId === scope.appId
          )
            found.set(Number(number), {
              repository: scope.repository,
              number: Number(number),
            });
        }
        next = page.next;
      }
      if (next) truncated = true;
    } catch (error) {
      failures.push(
        `${state}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof DeferredReadError) {
        deferred = true;
        break;
      }
    }
  }
  return {
    resources: [...found.values()],
    truncated,
    failures,
    successfulPages,
    deferred,
  };
}

function ownerIsCurrent(task: TaskDetail | null, owner: Owner): boolean {
  return !!task && !task.closed && task.id === owner.taskId;
}
function marker(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function observeGitHubPullRequests(
  ctx: ObserverContext,
  scope: GitHubPullRequestScope,
  fetchImpl: FetchLike = fetch,
  now: () => Date = () => new Date(),
): Promise<AppObserverResult> {
  if (!validRepository(scope.repository) || scope.appId !== "may")
    throw new Error("invalid GitHub pull-request observer scope");
  const observedAt = now();
  const previous = record(ctx.previousObservation) as ObserverMemory;
  const priorStates = record(previous.states) as Record<
    string,
    PublicationState
  >;
  const budget: RequestBudget = {
    remaining: MAX_HTTP_REQUESTS_PER_RUN,
    nowMs: observedAt.getTime(),
  };
  if (previous.deferUntil && previous.deferUntil > budget.nowMs)
    return { events: [], nextObservation: previous };

  const discovery = await discoverResources(scope, fetchImpl, budget);
  if (
    discovery.failures.length > 0 &&
    discovery.successfulPages === 0 &&
    !discovery.deferred
  ) {
    throw new Error(
      `GitHub pull-request discovery unavailable: ${discovery.failures.join("; ")}`,
    );
  }
  const discovered = discovery.resources;
  for (const failure of discovery.failures)
    ctx.log.warn(
      `GitHub pull-request discovery coverage incomplete: ${failure}`,
    );
  if (discovery.truncated)
    ctx.log.warn(
      `GitHub pull-request discovery exceeded the bounded ${MAX_DISCOVERY_PAGES_PER_STATE}-page-per-state window`,
    );

  // Admit remembered open resources first, up to their explicit reservation.
  // Newest provider discoveries fill the remaining capacity. This makes every
  // retained resource part of the round-robin set instead of slicing it away
  // behind a perpetually full newest-first discovery window.
  const priorRemembered = (
    Array.isArray(previous.resources) ? previous.resources : []
  ).filter(
    (item): item is RememberedResource =>
      item.open === true &&
      item.repository === scope.repository &&
      Number.isSafeInteger(item.number) &&
      item.number > 0,
  );
  const admittedRemembered = priorRemembered.slice(-MAX_REMEMBERED_RESOURCES);
  if (priorRemembered.length > admittedRemembered.length)
    ctx.log.warn(
      `GitHub pull-request memory evicted ${priorRemembered.length - admittedRemembered.length} open resources beyond the ${MAX_REMEMBERED_RESOURCES}-resource reservation`,
    );
  const combined = new Map<number, Resource>();
  for (const item of admittedRemembered)
    combined.set(item.number, {
      repository: item.repository,
      number: item.number,
    });
  for (const item of discovered) {
    if (combined.size >= MAX_RESOURCES && !combined.has(item.number)) break;
    combined.set(item.number, item);
  }
  if (discovered.some((item) => !combined.has(item.number)))
    ctx.log.warn(
      `GitHub pull-request candidate coverage exceeded the ${MAX_RESOURCES}-resource pass capacity`,
    );
  // Traversal order is identity-stable and deliberately independent from the
  // insertion order used above for recency-based memory retention. Otherwise
  // refreshing a resource moves it in memory and can keep the cursor cycling
  // over only the most recently serviced suffix. Resolve a legacy positional
  // cursor against its original insertion order once, then persist an identity.
  const insertionOrderedResources = [...combined.values()];
  const resources = [...insertionOrderedResources].sort(
    (left, right) => left.number - right.number,
  );
  const legacyStart = insertionOrderedResources.length
    ? insertionOrderedResources[
        (Number(previous.cursor) || 0) % insertionOrderedResources.length
      ]?.number
    : undefined;
  const nextResource = Number.isSafeInteger(previous.nextResource)
    ? previous.nextResource
    : legacyStart;
  const stableStart = resources.findIndex(
    (item) => item.number === nextResource,
  );
  const start = resources.length && stableStart >= 0 ? stableStart : 0;
  const events: AppEvent<Record<string, unknown>>[] = [];
  const states: Record<string, PublicationState> = { ...priorStates };
  const remembered = new Map<number, RememberedResource>();
  for (const item of admittedRemembered) remembered.set(item.number, item);
  let advanced = 0;

  for (
    let offset = 0;
    offset < resources.length && budget.remaining >= 2;
    offset++
  ) {
    const resource = resources[(start + offset) % resources.length];
    try {
      const owned = await readOwnedGitHubPullRequest(
        scope,
        resource.number,
        fetchImpl,
        observedAt,
        budget,
      );
      if (!owned.owner)
        throw new OwnershipError("missing owner after scoped read");
      const task = await ctx.read.tasks.get(owned.owner.taskId);
      if (!ownerIsCurrent(task, owned.owner)) {
        remembered.delete(resource.number);
        advanced++;
        continue;
      }
      const key = marker(
        `${owned.owner.appId}\0${owned.owner.taskId}\0${owned.fact.pullRequestId}`,
      );
      const success = marker(owned.fact.fingerprint);
      const prior = record(priorStates[key]) as PublicationState;
      if (prior.success !== success) {
        events.push({
          type: GITHUB_PULL_REQUEST_EVENT,
          target: {
            appId: scope.appId,
            project: scope.project,
            taskId: owned.owner.taskId,
          },
          data: owned.fact,
        });
      }
      if (
        owned.fact.reviewError &&
        prior.reviewFailure !== marker(owned.fact.reviewError)
      ) {
        events.push({
          type: "may.github.pull-request.read-failed",
          target: {
            appId: scope.appId,
            project: scope.project,
            taskId: owned.owner.taskId,
          },
          data: {
            provider: "github",
            repository: scope.repository,
            number: resource.number,
            pullRequestId: owned.fact.pullRequestId,
            scope: "reviews",
            error: owned.fact.reviewError,
            observedAt: observedAt.toISOString(),
          },
        });
      }
      states[key] = {
        success,
        ...(owned.fact.reviewError
          ? { reviewFailure: marker(owned.fact.reviewError) }
          : {}),
      };
      if (owned.fact.state === "open") {
        // Reinsert so bounded eviction retains the most recently refreshed PRs.
        remembered.delete(resource.number);
        remembered.set(resource.number, { ...resource, open: true });
      } else remembered.delete(resource.number);
    } catch (error) {
      if (error instanceof OwnershipError) remembered.delete(resource.number);
      ctx.log.warn(
        `GitHub pull-request observation failed for #${resource.number}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    advanced++;
  }
  if (resources.length > advanced)
    ctx.log.info(
      `GitHub pull-request observer deferred ${resources.length - advanced} resources`,
    );
  const rememberedValues = [...remembered.values()];
  const retainedResources = rememberedValues.slice(-MAX_REMEMBERED_RESOURCES);
  if (rememberedValues.length > retainedResources.length)
    ctx.log.warn(
      `GitHub pull-request memory evicted ${rememberedValues.length - retainedResources.length} open resources beyond the ${MAX_REMEMBERED_RESOURCES}-resource reservation`,
    );
  const nextIndex = resources.length
    ? (start + advanced) % resources.length
    : 0;
  return {
    events,
    nextObservation: {
      cursor: nextIndex,
      ...(resources.length
        ? { nextResource: resources[nextIndex].number }
        : {}),
      ...(budget.deferUntil ? { deferUntil: budget.deferUntil } : {}),
      resources: retainedResources,
      states: Object.fromEntries(
        Object.entries(states).slice(-MAX_RESOURCES * 2),
      ),
    },
  };
}

export function createGitHubPullRequestObserver(
  scope: GitHubPullRequestScope,
): AppObserver {
  return {
    id: "github-pull-request",
    intervalMs: OBSERVER_INTERVAL_MS,
    run: (ctx) => observeGitHubPullRequests(ctx, scope),
  };
}

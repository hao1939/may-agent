import { createHash } from "node:crypto";

export const FEEDBACK_PER_PAGE = 25;
export const MAX_FEEDBACK_PAGES = 2;
export const FEEDBACK_HTTP_REQUESTS = 4 * MAX_FEEDBACK_PAGES + 1;

export type GitHubCommentFact = {
  id: number;
  author: string | null;
  bodyDigest: string;
  bodyPreview: string;
  bodyTruncated: boolean;
  createdAt: string;
  updatedAt: string;
  url: string | null;
  commitId?: string | null;
  originalCommitId?: string | null;
  path?: string | null;
  line?: number | null;
  inReplyToId?: number | null;
};

export type GitHubPullRequestFeedback = {
  headSha: string;
  checks: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    headSha: string;
    detailsUrl: string | null;
    completedAt: string | null;
  }>;
  checksComplete: boolean;
  statuses: Array<{
    id: number;
    context: string;
    state: string;
    description: string | null;
    targetUrl: string | null;
    updatedAt: string;
  }>;
  statusesComplete: boolean;
  comments: GitHubCommentFact[];
  commentsComplete: boolean;
  reviewComments: GitHubCommentFact[];
  reviewCommentsComplete: boolean;
  errors: Record<string, string>;
};

type Page = { value: unknown; next: string | null };
type ReadPage = (url: string, endpoint: string) => Promise<Page>;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("GitHub feedback item is not an object");
  return value as Record<string, unknown>;
};
const nullableText = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== "string")
    throw new Error("GitHub feedback has malformed text");
  return value;
};
const requiredText = (value: unknown): string => {
  const result = nullableText(value);
  if (!result) throw new Error("GitHub feedback is missing required text");
  return result;
};
const id = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new Error("GitHub feedback is missing a positive integer id");
  return Number(value);
};
const revision = (value: unknown): string => {
  const result = requiredText(value);
  if (!Number.isFinite(Date.parse(result)))
    throw new Error("GitHub feedback has malformed revision");
  return result;
};
const member = (value: unknown, allowed: string[]): string => {
  const result = requiredText(value);
  if (!allowed.includes(result))
    throw new Error("GitHub feedback has unknown state");
  return result;
};

/** Bounded previews are source data, never instructions. Digests detect edits
 * outside the preview; read the exact provider item when its full text matters. */
export function bodyFact(body: unknown, maxPreview = 512) {
  if (typeof body !== "string")
    throw new Error("GitHub feedback has malformed body");
  return {
    bodyDigest: createHash("sha256").update(body).digest("hex"),
    bodyPreview: body.slice(0, maxPreview),
    bodyTruncated: body.length > maxPreview,
  };
}

function comment(value: unknown, review: boolean): GitHubCommentFact {
  const item = object(value);
  const author =
    item.user === null ? null : nullableText(object(item.user).login);
  const line = item.line ?? null;
  if (
    review &&
    line !== null &&
    (!Number.isSafeInteger(line) || Number(line) < 1)
  )
    throw new Error("GitHub review comment has malformed line");
  return {
    id: id(item.id),
    author,
    ...bodyFact(item.body),
    createdAt: revision(item.created_at),
    updatedAt: revision(item.updated_at),
    url: nullableText(item.html_url),
    ...(review
      ? {
          commitId: nullableText(item.commit_id),
          originalCommitId: nullableText(item.original_commit_id),
          path: nullableText(item.path),
          line: line === null ? null : Number(line),
          inReplyToId:
            item.in_reply_to_id == null ? null : id(item.in_reply_to_id),
        }
      : {}),
  };
}

/** Four independently useful evidence sets, pinned to the read PR head.
 * Failures and truncation stay explicit. No CI-passed/approval/closure judgment. */
export async function readGitHubPullRequestFeedback(
  repository: string,
  number: number,
  headSha: string,
  readPage: ReadPage,
  signal?: AbortSignal,
): Promise<GitHubPullRequestFeedback> {
  if (!/^[0-9a-f]{40}$/i.test(headSha))
    throw new Error("GitHub feedback requires an exact commit SHA");
  const base = `https://api.github.com/repos/${repository}`;
  const errors: Record<string, string> = {};
  async function collect<T extends { id: number }>(
    name: string,
    endpoint: string,
    decodePage: (value: unknown) => unknown[],
    decodeItem: (value: unknown) => T,
  ): Promise<{ items: T[]; complete: boolean }> {
    const found = new Map<number, T>();
    const visited = new Set<string>();
    let next: string | null =
      `${base}/${endpoint}?per_page=${FEEDBACK_PER_PAGE}`;
    try {
      for (let page = 0; next; page++) {
        signal?.throwIfAborted();
        if (page >= MAX_FEEDBACK_PAGES)
          throw new Error("GitHub feedback pagination limit reached");
        if (visited.has(next))
          throw new Error("GitHub feedback pagination repeated a page");
        visited.add(next);
        const response = await readPage(next, endpoint);
        const values = decodePage(response.value);
        if (values.length > FEEDBACK_PER_PAGE)
          throw new Error("GitHub feedback page exceeds requested bound");
        for (const value of values) {
          const parsed = decodeItem(value);
          if (found.has(parsed.id))
            throw new Error("GitHub feedback pagination repeated an item");
          found.set(parsed.id, parsed);
        }
        next = response.next;
        const total =
          typeof response.value === "object" && response.value !== null
            ? (response.value as Record<string, unknown>).total_count
            : undefined;
        if (
          total !== undefined &&
          (!Number.isSafeInteger(total) ||
            Number(total) < found.size ||
            (!next && Number(total) !== found.size))
        )
          throw new Error(
            "GitHub feedback count does not match pagination coverage",
          );
      }
      return {
        items: [...found.values()].sort((a, b) => a.id - b.id),
        complete: true,
      };
    } catch (error) {
      signal?.throwIfAborted();
      errors[name] = error instanceof Error ? error.message : String(error);
      // Partial items are evidence, not a complete negative result.
      return {
        items: [...found.values()].sort((a, b) => a.id - b.id),
        complete: false,
      };
    }
  }
  const array = (value: unknown): unknown[] => {
    if (!Array.isArray(value))
      throw new Error("GitHub feedback response is not an array");
    return value;
  };
  const checks = await collect(
    "checks",
    `commits/${headSha}/check-runs`,
    (value) => {
      const response = object(value);
      if (
        !Number.isSafeInteger(response.total_count) ||
        Number(response.total_count) < 0
      )
        throw new Error("GitHub check runs have malformed total_count");
      return array(response.check_runs);
    },
    (value) => {
      const run = object(value);
      if (run.head_sha !== headSha)
        throw new Error("GitHub check belongs to a different head");
      return {
        id: id(run.id),
        name: requiredText(run.name),
        status: member(run.status, [
          "queued",
          "in_progress",
          "completed",
          "waiting",
          "requested",
          "pending",
        ]),
        conclusion:
          run.conclusion === null
            ? null
            : member(run.conclusion, [
                "success",
                "failure",
                "neutral",
                "cancelled",
                "skipped",
                "timed_out",
                "action_required",
                "stale",
                "startup_failure",
              ]),
        headSha,
        detailsUrl: nullableText(run.details_url),
        completedAt: nullableText(run.completed_at),
      };
    },
  );
  const statuses = await collect(
    "statuses",
    `commits/${headSha}/status`,
    (value) => {
      const response = object(value);
      if (response.sha !== headSha)
        throw new Error("GitHub statuses belong to a different head");
      if (
        !Number.isSafeInteger(response.total_count) ||
        Number(response.total_count) < 0
      )
        throw new Error("GitHub statuses have malformed total_count");
      return array(response.statuses);
    },
    (value) => {
      const status = object(value);
      return {
        id: id(status.id),
        context: requiredText(status.context),
        state: member(status.state, ["pending", "success", "failure", "error"]),
        description: nullableText(status.description),
        targetUrl: nullableText(status.target_url),
        updatedAt: revision(status.updated_at),
      };
    },
  );
  const comments = await collect(
    "comments",
    `issues/${number}/comments`,
    array,
    (value) => comment(value, false),
  );
  const reviewComments = await collect(
    "reviewComments",
    `pulls/${number}/comments`,
    array,
    (value) => comment(value, true),
  );
  let previewRemaining = 8_192;
  for (const item of [...comments.items, ...reviewComments.items]) {
    const preview = item.bodyPreview.slice(0, previewRemaining);
    item.bodyTruncated ||= preview.length < item.bodyPreview.length;
    item.bodyPreview = preview;
    previewRemaining -= preview.length;
  }
  return {
    headSha,
    checks: checks.items,
    checksComplete: checks.complete,
    statuses: statuses.items,
    statusesComplete: statuses.complete,
    comments: comments.items,
    commentsComplete: comments.complete,
    reviewComments: reviewComments.items,
    reviewCommentsComplete: reviewComments.complete,
    errors,
  };
}

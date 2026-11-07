import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  createPublicTaskEvidenceProvider,
  sendPublicReadCommand,
  type PublicTaskEvidenceProvider,
} from "../../evaluator/workflows/lib/public-task-evidence.js";

export const name = "task-disposition-review";
export const description =
  "Read at most ten existing Tasks for owner disposition, without model calls or mutations. Input {appId, cursor?, limit?}, or {appId, taskIds} to retry exact records. Returns bounded previews, current result/version references, evidence gaps and the next cursor. Owner judgment and fresh guarded closure remain separate.";

type Input = {
  appId: string;
  cursor?: string;
  limit?: number;
  taskIds?: string[];
};
type Route =
  | "owner-review"
  | "retain-standing"
  | "retain-work"
  | "ended-history"
  | "needs-evidence";
type RecordValue = Record<string, unknown>;
const MAX_BATCH = 10;
const MAX_RESULT_BYTES = 30_000;
const object = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const preview = (value: unknown, limit: number): string => {
  const content = text(value);
  return content.length > limit ? `${content.slice(0, limit)}…` : content;
};
const normalized = (status: unknown): string =>
  status === "up-to-date" ? "idle" : text(status);

export type DispositionReview = {
  taskId: string;
  route: Route;
  reason: string;
  status?: string;
  generation?: number;
  resourceVersion?: number;
  acceptedAttemptId?: string;
  authorityRoute?: "creating-task" | "app-or-operator";
  outcomePreview?: string;
  acceptancePreview?: string[];
  summaryPreview?: string;
  previewsOnly?: true;
};

async function reviewOne(
  provider: PublicTaskEvidenceProvider,
  appId: string,
  listed: RecordValue,
): Promise<DispositionReview> {
  const taskId = text(listed.id ?? listed.taskId);
  if (!taskId)
    throw new Error("Task page contains a record without an identity");
  // `done` alone is ambiguous on older Hosts: it can mean an open idle Task.
  if (
    listed.closed === true ||
    ["closed", "cancelled"].includes(text(listed.status))
  )
    return {
      taskId,
      status: text(listed.status),
      route: "ended-history",
      reason: "Retain the terminal decision and its evidence.",
    };
  const task = await provider.getAppTask(appId, taskId);
  const human = await provider.getTask(appId, taskId);
  const status =
    task.status === "done" && human.terminal === false && task.closed !== true
      ? "idle"
      : normalized(task.status);
  const base: DispositionReview = {
    taskId,
    status,
    route: "needs-evidence",
    reason: "Read the exact evidence before deciding disposition.",
    ...(Number.isSafeInteger(task.generation)
      ? { generation: task.generation as number }
      : {}),
    ...(Number.isSafeInteger(task.resourceVersion)
      ? { resourceVersion: task.resourceVersion as number }
      : {}),
    ...(text(object(task.acceptedAttempt).id)
      ? { acceptedAttemptId: text(object(task.acceptedAttempt).id) }
      : {}),
    authorityRoute: text(object(task.creator).taskId)
      ? "creating-task"
      : "app-or-operator",
    outcomePreview: preview(task.outcome, 500),
    acceptancePreview: Array.isArray(task.acceptance)
      ? task.acceptance.slice(0, 3).map((item) => preview(item, 180))
      : [],
    summaryPreview: preview(task.summary, 500),
    previewsOnly: true,
  };
  if (
    normalized(human.status) !== status ||
    task.generation !== human.generation ||
    task.resourceVersion !== human.resourceVersion ||
    (listed.generation !== undefined &&
      listed.generation !== task.generation) ||
    (listed.resourceVersion !== undefined &&
      listed.resourceVersion !== task.resourceVersion)
  )
    return {
      ...base,
      reason:
        "Task changed between reads or projections disagree; retry this exact identity.",
    };
  if (
    human.terminal === true ||
    task.closed === true ||
    ["closed", "cancelled", "done"].includes(status)
  )
    return {
      ...base,
      route: "ended-history",
      reason: "Retain the terminal decision and its evidence.",
    };
  if (human.recurring === true)
    return {
      ...base,
      route: "retain-standing",
      reason:
        "A configured recurring assignment remains; inspect its next schedule only when needed.",
    };
  if (["pending", "running", "waiting", "attention"].includes(status))
    return {
      ...base,
      route: "retain-work",
      reason:
        "Current work or a wait remains; resolve the exact obligation on the existing Task.",
    };
  if (status !== "idle" || human.recurring !== false)
    return {
      ...base,
      reason:
        "Idle state or recurrence coverage is unavailable; establish the continuing assignment.",
    };
  const obligations = object(task.currentObligations);
  const waits = object(obligations.inputWaits);
  const events = object(task.pendingEvents);
  if (
    obligations.available !== true ||
    waits.truncated !== false ||
    !Array.isArray(waits.items) ||
    events.truncated !== false ||
    !Array.isArray(events.items) ||
    !Array.isArray(task.conditions)
  )
    return {
      ...base,
      reason:
        "Current input, event or Condition coverage is missing or truncated; read exact obligations.",
    };
  if (
    waits.items.length ||
    events.items.length ||
    task.conditions.length ||
    obligations.reviewAt !== undefined
  )
    return {
      ...base,
      route: "retain-work",
      reason:
        "Retained input, event, Condition or reconsideration work needs owner reconciliation.",
    };
  if (
    !base.acceptedAttemptId ||
    !base.generation ||
    !base.resourceVersion ||
    object(task.acceptedAttempt).generation !== task.generation
  )
    return {
      ...base,
      reason:
        "The exact accepted result or current revision is unavailable; establish evidence before closure.",
    };
  return {
    ...base,
    route: "owner-review",
    reason:
      "No recorded runnable obligation. Review original asks, accepted scope, caller promises and any standing input route; record why responsibility should end or remain.",
  };
}

/** Navigation and evidence only: routes never authorize closure or assert fulfillment. */
export async function reviewTaskDispositionBatch(
  provider: PublicTaskEvidenceProvider,
  input: Input,
  signal?: AbortSignal,
) {
  if (!input || !text(input.appId).trim()) throw new Error("appId is required");
  const limit = input.limit ?? MAX_BATCH;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH)
    throw new Error(`limit must be an integer between 1 and ${MAX_BATCH}`);
  if (
    input.cursor !== undefined &&
    (typeof input.cursor !== "string" || !input.cursor.trim())
  )
    throw new Error("cursor must be a non-empty continuation from this review");
  if (
    input.taskIds !== undefined &&
    (input.cursor !== undefined ||
      !Array.isArray(input.taskIds) ||
      !input.taskIds.length ||
      input.taskIds.length > MAX_BATCH ||
      input.taskIds.some((id) => !text(id).trim()) ||
      new Set(input.taskIds).size !== input.taskIds.length)
  )
    throw new Error(
      "taskIds requires one to ten unique exact identities and cannot be combined with cursor",
    );
  signal?.throwIfAborted();
  const appId = input.appId.trim();
  const page: { items: RecordValue[]; nextCursor: string } = input.taskIds
    ? { items: input.taskIds.map((id) => ({ id })), nextCursor: "" }
    : await provider.listTaskPage(appId, limit, input.cursor);
  if (
    page.items.length > (input.taskIds?.length ?? limit) ||
    (page.nextCursor && page.nextCursor === input.cursor)
  )
    throw new Error(
      "Task reader exceeded the batch bound or repeated its cursor",
    );
  const identities = page.items.map((item) => text(item.id ?? item.taskId));
  if (
    identities.some((id) => !id) ||
    new Set(identities).size !== identities.length
  )
    throw new Error("Task page contains missing or duplicate identities");
  const items: DispositionReview[] = [];
  for (const item of page.items) {
    signal?.throwIfAborted();
    try {
      items.push(await reviewOne(provider, appId, item));
    } catch (error) {
      const taskId = text(item.id ?? item.taskId);
      if (!taskId) throw error;
      items.push({
        taskId,
        route: "needs-evidence",
        reason: `Exact read failed: ${preview(error instanceof Error ? error.message : String(error), 240)}`,
      });
    }
  }
  signal?.throwIfAborted();
  const retryTaskIds = items
    .filter((item) => item.route === "needs-evidence")
    .map(({ taskId }) => taskId);
  const result = {
    appId,
    items,
    nextCursor: page.nextCursor || null,
    retryTaskIds,
    pageReadComplete: retryTaskIds.length === 0,
    note: "Live bounded previews, not an atomic population snapshot or owner approval. Save this page and its cursor; resolve explicit retry identities separately. Fresh guarded controls must revalidate every reviewed disposition.",
  };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_RESULT_BYTES)
    throw new Error(
      "Review page exceeds the output bound; retry the same cursor with a smaller limit",
    );
  return result;
}

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  try {
    const result = await reviewTaskDispositionBatch(
      createPublicTaskEvidenceProvider((command) =>
        sendPublicReadCommand(command, { signal: ctx.signal }),
      ),
      ctx.input,
      ctx.signal,
    );
    const summary = `Read ${result.items.length} existing Tasks; ${result.items.filter(({ route }) => route === "owner-review").length} need owner disposition, ${result.retryTaskIds.length} need more evidence.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      result,
      facts: [`task-disposition-review:${result.appId}:${result.items.length}`],
      actions: [],
    });
  } catch (error) {
    return ctx.blocked(
      `Task disposition review could not complete: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

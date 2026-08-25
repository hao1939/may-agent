import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type {
  AppConversationMessage,
  AppConversationResource,
  AppConversationTopic,
  AppConversationTopicPage,
  AppInput,
  AppInputSource,
  AppResult,
} from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";
import { displayTaskReferences } from "./task-reference-index.js";

export type AppInboxStatus = "pending" | "handling" | "done";
export type AppInboxWaitKind = "app" | "task" | "session" | "analysis";
export type AppInboxDeliveryStatus = "pending" | "sending" | "delivered" | "failed" | "uncertain";

export type AppInboxTaskDependencyKey = { appId: string; taskId: string };

export type AppInboxTaskDependencyPage = {
  items: AppInboxTaskDependencyKey[];
  nextCursor?: AppInboxTaskDependencyKey;
};

export type AppInboxDelivery = {
  itemId: string;
  operationId: string;
  kind: "progress" | "final";
  text?: string;
  sessionId: string;
  requestId: string;
  channel: string;
  status: AppInboxDeliveryStatus;
  externalMessageId?: string;
  failureReason?: string;
  receiptEventId?: number;
  createdAt: number;
  updatedAt: number;
  attemptedAt?: number;
  completedAt?: number;
};

export type AppInboxItem = {
  id: string;
  appId: string;
  parentId?: string;
  /** Exact existing Task that this typed input continues. */
  targetTaskId?: string;
  topicId?: string;
  /** Human feedback linked to an existing root request, not separate work. */
  continuesRequestId?: string;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
  channelTargetId?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  replyToSourceId?: string;
  source: AppInputSource;
  input: AppInput;
  status: AppInboxStatus;
  sessionId?: string;
  waitingOn?: { kind: AppInboxWaitKind; id: string };
  result?: AppResult;
  delivery?: AppInboxDelivery;
  availableAt?: number;
  reviewAt?: number;
  lease?: { generation: number; owner: string; expiresAt: number };
  originEventId?: number;
  idempotencyKey?: string;
  createdAt: number;
  startedAt?: number;
  changedAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type CreateAppInboxItem = {
  id?: string;
  appId: string;
  parentId?: string;
  targetTaskId?: string;
  topicId?: string;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
  channelTargetId?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  replyToSourceId?: string;
  source: AppInputSource;
  input: AppInput;
  originEventId?: number;
  idempotencyKey?: string;
  now?: number;
};

export type AppInboxClaim = {
  item: AppInboxItem;
  generation: number;
  owner: string;
};

/** A claim durably associated with the exact agent session that was executing it. */
export type AppInboxSessionClaim = {
  claim: AppInboxClaim;
  sessionId: string;
};

export type AppInboxQuery = {
  appId?: string;
  status?: AppInboxStatus;
  idempotencyKey?: string;
  limit?: number;
};

export type CreateConversationTopic = {
  id: string;
  appId: string;
  conversationId: string;
  title: string;
  openedBy: string;
  originMessageId: string;
  now?: number;
};

export type AppInboxHealth = {
  appId: string;
  total: number;
  pending: number;
  handling: number;
  done: number;
  ready: number;
  waitingOnDependency: number;
  waitingOnDelivery: number;
  activeLeases: number;
  expiredLeases: number;
  oldestPendingAgeMs?: number;
  oldestHandlingItemAgeMs?: number;
};

type ConversationEventRow = {
  id: number;
  data: string;
  timestamp: number;
};

type InboxRow = Record<string, unknown>;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid App inbox ${field}`);
  return value;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function parseJson<T>(value: unknown, field: string): T {
  if (typeof value !== "string") throw new Error(`Invalid App inbox ${field}`);
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Invalid App inbox ${field} JSON`);
  }
}

function rowToItem(row: InboxRow): AppInboxItem {
  const waitingKind = optionalText(row.waiting_on_kind) as AppInboxWaitKind | undefined;
  const waitingId = optionalText(row.waiting_on_id);
  const leaseOwner = optionalText(row.lease_owner);
  const leaseExpiresAt = optionalNumber(row.lease_expires_at);
  const generation = Number(row.lease_generation);
  const result = optionalText(row.result);

  return {
    id: requiredText(row.id, "id"),
    appId: requiredText(row.app_id, "app_id"),
    parentId: optionalText(row.parent_id),
    targetTaskId: optionalText(row.target_task_id),
    topicId: optionalText(row.topic_id),
    continuesRequestId: optionalText(row.continues_request_id),
    conversationId: optionalText(row.conversation_id),
    conversationSequence: optionalNumber(row.conversation_seq),
    channel: optionalText(row.channel),
    channelTargetId: optionalText(row.channel_target_id),
    channelThreadId: optionalText(row.channel_thread_id),
    channelMessageId: optionalNumber(row.channel_message_id),
    replyToSourceId: optionalText(row.reply_to_source_id),
    source: {
      kind: requiredText(row.source_kind, "source_kind") as AppInputSource["kind"],
      id: requiredText(row.source_id, "source_id"),
    },
    input: {
      kind: requiredText(row.input_kind, "input_kind"),
      data: parseJson(row.input_data, "input_data"),
    },
    status: requiredText(row.status, "status") as AppInboxStatus,
    sessionId: optionalText(row.session_id),
    waitingOn: waitingKind && waitingId ? { kind: waitingKind, id: waitingId } : undefined,
    result: result ? parseJson<AppResult>(result, "result") : undefined,
    availableAt: optionalNumber(row.available_at),
    reviewAt: optionalNumber(row.review_at),
    lease:
      leaseOwner && leaseExpiresAt !== undefined
        ? { generation, owner: leaseOwner, expiresAt: leaseExpiresAt }
        : undefined,
    originEventId: optionalNumber(row.origin_event_id),
    idempotencyKey: optionalText(row.idempotency_key),
    createdAt: Number(row.created_at),
    startedAt: optionalNumber(row.started_at),
    changedAt: optionalNumber(row.changed_at) ?? Number(row.created_at),
    updatedAt: Number(row.updated_at),
    completedAt: optionalNumber(row.completed_at),
  };
}

function rowToDelivery(row: InboxRow): AppInboxDelivery {
  return {
    itemId: requiredText(row.item_id, "delivery.item_id"),
    operationId: requiredText(row.operation_id, "delivery.operation_id"),
    kind: requiredText(row.kind, "delivery.kind") as AppInboxDelivery["kind"],
    text: optionalText(row.text),
    sessionId: requiredText(row.session_id, "delivery.session_id"),
    requestId: requiredText(row.request_id, "delivery.request_id"),
    channel: requiredText(row.channel, "delivery.channel"),
    status: requiredText(row.status, "delivery.status") as AppInboxDeliveryStatus,
    externalMessageId: optionalText(row.external_message_id),
    failureReason: optionalText(row.failure_reason),
    receiptEventId: optionalNumber(row.receipt_event_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    attemptedAt: optionalNumber(row.attempted_at),
    completedAt: optionalNumber(row.completed_at),
  };
}

function validateCreate(input: CreateAppInboxItem): void {
  requiredText(input.appId, "appId");
  requiredText(input.source.id, "source.id");
  requiredText(input.input.kind, "input.kind");
  if (input.targetTaskId !== undefined) requiredText(input.targetTaskId, "targetTaskId");
  if (input.topicId !== undefined) requiredText(input.topicId, "topicId");
  if (!(["human", "app", "system"] as const).includes(input.source.kind)) {
    throw new Error(`Invalid App inbox source kind: ${input.source.kind}`);
  }
  const hasConversation = input.conversationId !== undefined;
  const hasSequence = input.conversationSequence !== undefined;
  if (hasConversation !== hasSequence) {
    throw new Error("App inbox conversationId and conversationSequence must be provided together");
  }
  if (
    input.conversationSequence !== undefined &&
    (!Number.isSafeInteger(input.conversationSequence) || input.conversationSequence < 0)
  ) {
    throw new Error("App inbox conversationSequence must be a non-negative safe integer");
  }
  if (
    input.channelMessageId !== undefined &&
    (!Number.isSafeInteger(input.channelMessageId) || input.channelMessageId <= 0)
  ) {
    throw new Error("App inbox channelMessageId must be a positive safe integer");
  }
  if (input.originEventId !== undefined && (!Number.isSafeInteger(input.originEventId) || input.originEventId <= 0)) {
    throw new Error("App inbox originEventId must be a positive safe integer");
  }
}

export function getAppInboxItem(db: SqliteDb, id: string): AppInboxItem | null {
  const row = db.prepare("SELECT * FROM app_inbox_items WHERE id = ?").get(id);
  if (!row) return null;
  const item = rowToItem(row);
  const delivery = getAppInboxDelivery(db, item.id);
  return delivery ? { ...item, delivery } : item;
}

/** Unfinished requests created by one exact parent Task generation. */
export function listOpenAppInboxItemsByIdempotencyPrefix(
  db: SqliteDb,
  input: { appId: string; sourceAppId: string; prefix: string; limit?: number },
): AppInboxItem[] {
  const appId = requiredText(input.appId, "appId");
  const sourceAppId = requiredText(input.sourceAppId, "sourceAppId");
  const prefix = requiredText(input.prefix, "prefix");
  const limit = input.limit ?? 64;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
    throw new Error("App inbox lineage query limit must be an integer from 1 to 256");
  }
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ?
         AND status != 'done'
         AND source_kind = 'app'
         AND source_id = ?
         AND idempotency_key >= ?
         AND idempotency_key < ?
       ORDER BY idempotency_key, id
       LIMIT ?`,
    )
    .all(appId, sourceAppId, prefix, `${prefix}\uffff`, limit)
    .map(rowToItem);
}

export function getAppInboxDelivery(db: SqliteDb, itemId: string): AppInboxDelivery | null {
  const row = db
    .prepare(
      `SELECT * FROM app_inbox_deliveries
       WHERE item_id = ? AND kind = 'final'
       ORDER BY created_at DESC, operation_id DESC
       LIMIT 1`,
    )
    .get(itemId);
  return row ? rowToDelivery(row) : null;
}

export function listAppInboxDeliveries(db: SqliteDb, itemId: string): AppInboxDelivery[] {
  return db
    .prepare("SELECT * FROM app_inbox_deliveries WHERE item_id = ? ORDER BY created_at, operation_id")
    .all(requiredText(itemId, "itemId"))
    .map(rowToDelivery);
}

export function listAppInboxItems(db: SqliteDb, query: AppInboxQuery = {}): AppInboxItem[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (query.appId !== undefined) {
    conditions.push("app_id = ?");
    params.push(requiredText(query.appId, "appId"));
  }
  if (query.status !== undefined) {
    if (query.status !== "pending" && query.status !== "handling" && query.status !== "done") {
      throw new Error(`Invalid App inbox status: ${String(query.status)}`);
    }
    conditions.push("status = ?");
    params.push(query.status);
  }
  if (query.idempotencyKey !== undefined) {
    conditions.push("idempotency_key = ?");
    params.push(requiredText(query.idempotencyKey, "idempotencyKey"));
  }
  const limit = query.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 500) {
    throw new Error("App inbox query limit must be an integer from 1 to 500");
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(...params, limit)
    .map((row) => {
      const item = rowToItem(row);
      const delivery = getAppInboxDelivery(db, item.id);
      return delivery ? { ...item, delivery } : item;
    });
}

/** Human conversations currently awaiting one exact App Task. */
export function listHumanAppInboxItemsWaitingOnTask(db: SqliteDb, appId: string, taskId: string): AppInboxItem[] {
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ?
         AND source_kind = 'human'
         AND conversation_id IS NOT NULL
         AND status = 'handling'
         AND waiting_on_kind = 'task'
         AND waiting_on_id = ?
       ORDER BY created_at, id`,
    )
    .all(requiredText(appId, "appId"), requiredText(taskId, "taskId"))
    .map(rowToItem);
}

/** Human Conversation requests whose current Task is waiting on one exact App request. */
export function listHumanAppInboxItemsWaitingOnAppRequest(db: SqliteDb, requestId: string): AppInboxItem[] {
  const normalizedRequestId = requiredText(requestId, "requestId");
  return db
    .prepare(
      `SELECT DISTINCT inbox.*
       FROM app_task_conditions condition
       JOIN app_task_condition_routes route
         ON route.app_id = condition.app_id AND route.condition_id = condition.condition_id
       JOIN app_inbox_items inbox
         ON inbox.app_id = route.app_id
        AND inbox.waiting_on_kind = 'task'
        AND inbox.waiting_on_id = route.task_id
       WHERE condition.condition_id = ?
         AND json_extract(condition.condition_json, '$.spec.type') = 'app.dependency.completed'
         AND json_extract(condition.condition_json, '$.spec.subject') = ?
         AND inbox.source_kind = 'human'
         AND inbox.conversation_id IS NOT NULL
         AND inbox.status = 'handling'
       ORDER BY inbox.created_at, inbox.id`,
    )
    .all(`app-request:${normalizedRequestId}`, `id:${normalizedRequestId}`)
    .map(rowToItem);
}

function conversationText(input: AppInput): string | undefined {
  const data = input.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const record = data as Record<string, unknown>;
  for (const field of ["message", "text"]) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function boundedConversationText(value: string, limit = 8_000): string {
  const text = value.trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

function conversationTaskIdentity(value: unknown): { appId: string; taskId: string } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const identity = value as Record<string, unknown>;
  if (typeof identity.appId !== "string" || typeof identity.taskId !== "string") return undefined;
  const appId = identity.appId.trim();
  const taskId = identity.taskId.trim();
  return appId && taskId ? { appId, taskId } : undefined;
}

function conversationEventMessage(row: ConversationEventRow): AppConversationMessage | undefined {
  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(row.data) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    data = parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
  if (data.transient === true || typeof data.text !== "string" || !data.text.trim()) return undefined;
  const author = data.author;
  if (!author || typeof author !== "object" || Array.isArray(author)) return undefined;
  const authorRecord = author as Record<string, unknown>;
  const kind = authorRecord.kind;
  const id = authorRecord.id;
  if (!(["human", "agent", "tool", "command"] as const).includes(kind as never)) return undefined;
  // Human messages are projected from their durably admitted inbox child so
  // the Conversation never shows an unaccepted request or duplicates it.
  if (kind === "human") return undefined;
  if (typeof id !== "string" || !id.trim()) return undefined;
  const rawMetadata = data.metadata;
  const metadata =
    rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
      ? (rawMetadata as Record<string, unknown>)
      : undefined;
  const followTask = conversationTaskIdentity(metadata?.followTask);
  return {
    id: `event:${row.id}`,
    sequence: row.id,
    author: { kind: kind as AppConversationMessage["author"]["kind"], id: id.trim() },
    text: boundedConversationText(data.text),
    ...(typeof data.replyTo === "string" && data.replyTo.trim() ? { replyTo: data.replyTo.trim() } : {}),
    ...(metadata
      ? {
          metadata: {
            ...(typeof metadata.channel === "string" && metadata.channel.trim()
              ? { channel: metadata.channel.trim() }
              : {}),
            ...(typeof metadata.channelTargetId === "string" && metadata.channelTargetId.trim()
              ? { channelTargetId: metadata.channelTargetId.trim() }
              : {}),
            ...(typeof metadata.channelThreadId === "string" && metadata.channelThreadId.trim()
              ? { channelThreadId: metadata.channelThreadId.trim() }
              : {}),
            ...(typeof metadata.channelMessageId === "number" && Number.isSafeInteger(metadata.channelMessageId)
              ? { channelMessageId: metadata.channelMessageId }
              : {}),
            ...(typeof metadata.requestId === "string" && metadata.requestId.trim()
              ? { requestId: metadata.requestId.trim() }
              : {}),
            ...(typeof metadata.command === "string" && metadata.command.trim()
              ? { command: metadata.command.trim() }
              : {}),
            ...(typeof metadata.topicId === "string" && metadata.topicId.trim()
              ? { topicId: metadata.topicId.trim() }
              : {}),
            ...(followTask ? { followTask } : {}),
            ...(Array.isArray(metadata.taskRefs)
              ? {
                  taskRefs: metadata.taskRefs.flatMap((value) => conversationTaskIdentity(value) ?? []).slice(0, 100),
                }
              : {}),
          },
        }
      : {}),
    createdAt: row.timestamp,
  };
}

/**
 * One bounded cross-channel conversation projection over existing durable
 * inbox results and event-journal evidence. Transient message events are
 * deliberately excluded from App context and reconnect replay.
 */
export function listAppConversationMessages(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  limit = 50,
  topicId?: string,
): AppConversationMessage[] {
  requiredText(appId, "appId");
  requiredText(conversationId, "conversationId");
  const exactTopicId = topicId === undefined ? undefined : requiredText(topicId, "topicId");
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 200) {
    throw new Error("Conversation message limit must be an integer from 1 to 200");
  }

  const messages: AppConversationMessage[] = [];
  const conversationRows = db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ? AND conversation_id = ?${exactTopicId ? " AND topic_id = ?" : ""}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(appId, conversationId, ...(exactTopicId ? [exactTopicId] : []), limit)
    .map(rowToItem);
  const targetedTaskIds = new Set(conversationRows.flatMap((item) => (item.targetTaskId ? [item.targetTaskId] : [])));
  const projectedTaskResults = new Set<string>();
  for (const item of conversationRows) {
    const text = conversationText(item.input);
    const sequence = item.originEventId ?? item.conversationSequence ?? item.createdAt;
    if (item.source.kind === "human" && text) {
      messages.push({
        id: item.source.id,
        sequence,
        author: { kind: "human", id: item.source.id },
        text: boundedConversationText(text),
        ...(item.replyToSourceId ? { replyTo: item.replyToSourceId } : {}),
        metadata: {
          ...(item.channel ? { channel: item.channel } : {}),
          ...(item.channelTargetId ? { channelTargetId: item.channelTargetId } : {}),
          ...(item.channelThreadId ? { channelThreadId: item.channelThreadId } : {}),
          ...(item.channelMessageId ? { channelMessageId: item.channelMessageId } : {}),
          requestId: item.id,
          ...(item.topicId ? { topicId: item.topicId } : {}),
        },
        createdAt: item.createdAt,
      });
    }
    const resultText = item.continuesRequestId
      ? item.result?.response?.trim()
      : item.result?.response?.trim() || item.result?.summary?.trim();
    if (!resultText) continue;
    const inferredCreatedTaskId = [...targetedTaskIds].find(
      (taskId) => taskId === item.id || taskId.endsWith(`/${item.id}`),
    );
    const resultTaskId =
      item.waitingOn?.kind === "task" ? item.waitingOn.id : (item.targetTaskId ?? inferredCreatedTaskId);
    const resultIdentity = resultTaskId ? `${resultTaskId}\0${resultText}` : `request:${item.id}`;
    // Several human turns may feed one Task, but its accepted result has one
    // public owner in the Conversation. Rows are newest-first, so the result
    // stays beside the feedback that most recently shaped that Task.
    if (projectedTaskResults.has(resultIdentity)) continue;
    projectedTaskResults.add(resultIdentity);
    messages.push({
      id: `result:${item.id}`,
      sequence,
      author: { kind: "agent", id: appId },
      text: boundedConversationText(resultText),
      metadata: {
        ...(item.channel ? { channel: item.channel } : {}),
        ...(item.channelTargetId ? { channelTargetId: item.channelTargetId } : {}),
        ...(item.channelThreadId ? { channelThreadId: item.channelThreadId } : {}),
        ...(item.channelMessageId ? { channelMessageId: item.channelMessageId } : {}),
        requestId: item.id,
        ...(item.topicId ? { topicId: item.topicId } : {}),
      },
      createdAt: item.completedAt ?? item.updatedAt,
    });
  }

  // Command views remain in the event journal, but only the newest view for
  // each adapter surface belongs in the current Conversation projection.
  // Otherwise repeated `/tasks` renders evict the actual human/May dialogue
  // from this bounded view.
  const eventRows = db
    .prepare(
      `SELECT id, data, timestamp FROM events
       WHERE event_type = 'conversation.message.created'
         AND json_extract(data, '$.appId') = ?
         AND json_extract(data, '$.conversationId') = ?
         AND json_extract(data, '$.author.kind') IN ('agent', 'tool')
         ${exactTopicId ? "AND json_extract(data, '$.metadata.topicId') = ?" : ""}
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(appId, conversationId, ...(exactTopicId ? [exactTopicId] : []), limit) as ConversationEventRow[];
  const commandRows = db
    .prepare(
      `SELECT id, data, timestamp FROM (
         SELECT id, data, timestamp,
           ROW_NUMBER() OVER (
             PARTITION BY
               COALESCE(json_extract(data, '$.metadata.channel'), ''),
               COALESCE(json_extract(data, '$.metadata.channelTargetId'), ''),
               COALESCE(json_extract(data, '$.metadata.channelThreadId'), '')
             ORDER BY id DESC
           ) AS surface_rank
         FROM events
         WHERE event_type = 'conversation.message.created'
           AND json_extract(data, '$.appId') = ?
           AND json_extract(data, '$.conversationId') = ?
           AND json_extract(data, '$.author.kind') = 'command'
           ${exactTopicId ? "AND json_extract(data, '$.metadata.topicId') = ?" : ""}
       )
       WHERE surface_rank = 1
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(appId, conversationId, ...(exactTopicId ? [exactTopicId] : []), limit) as ConversationEventRow[];
  eventRows.push(...commandRows);
  for (const row of eventRows) {
    const message = conversationEventMessage(row);
    if (message) messages.push(message);
  }

  const bounded = messages
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.sequence - right.sequence || left.id.localeCompare(right.id),
    )
    .slice(-limit);
  const taskIdentities = bounded.flatMap((message) => [
    ...(message.metadata?.taskRefs ?? []),
    ...(message.metadata?.followTask ? [message.metadata.followTask] : []),
  ]);
  const taskRefs = displayTaskReferences(db, taskIdentities);
  return bounded.map((message) =>
    message.metadata?.taskRefs?.length || message.metadata?.followTask
      ? {
          ...message,
          metadata: {
            ...message.metadata,
            ...(message.metadata.taskRefs?.length
              ? {
                  taskRefs: message.metadata.taskRefs.map((task) => ({
                    ...task,
                    ref: taskRefs.get(`${task.appId}\0${task.taskId}`) ?? task.ref,
                  })),
                }
              : {}),
            ...(message.metadata.followTask
              ? {
                  followTask: {
                    ...message.metadata.followTask,
                    ref:
                      taskRefs.get(`${message.metadata.followTask.appId}\0${message.metadata.followTask.taskId}`) ??
                      message.metadata.followTask.ref,
                  },
                }
              : {}),
          },
        }
      : message,
  );
}

/** Stable May/App-owned conversation resource derived without another store. */
export function readAppConversationResource(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  options: { limit?: number; topicId?: string; topicLimit?: number; topicCursor?: string } = {},
): AppConversationResource {
  const limit = options.limit ?? 50;
  const page = listConversationTopicPage(db, appId, conversationId, {
    limit: options.topicLimit ?? 12,
    ...(options.topicCursor ? { cursor: options.topicCursor } : {}),
  });
  const exactTopic = options.topicId ? readConversationTopic(db, appId, conversationId, options.topicId) : null;
  const topics = exactTopic && !page.items.some((topic) => topic.id === exactTopic.id) ? [exactTopic, ...page.items] : page.items;
  const recentMessages = listAppConversationMessages(db, appId, conversationId, limit);
  const messages = exactTopic
    ? [...new Map(
        [...recentMessages, ...listAppConversationMessages(db, appId, conversationId, Math.min(limit, 40), exactTopic.id)]
          .map((message) => [message.id, message]),
      ).values()].sort(
        (left, right) =>
          left.createdAt - right.createdAt || left.sequence - right.sequence || left.id.localeCompare(right.id),
      )
    : recentMessages;
  return {
    id: conversationId,
    owner: appId,
    version: messages.reduce((latest, message) => Math.max(latest, message.sequence), 0),
    topics,
    ...(page.nextCursor ? { nextTopicCursor: page.nextCursor } : {}),
    messages,
  };
}

export function listConversationTopics(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  limit = 12,
): AppConversationTopic[] {
  return listConversationTopicPage(db, appId, conversationId, { limit }).items;
}

type ConversationTopicRow = {
  id: string;
  title: string;
  opened_by: string;
  origin_message_id: string;
  created_at: number;
};

function encodeConversationTopicCursor(row: Pick<ConversationTopicRow, "created_at" | "id">): string {
  return Buffer.from(JSON.stringify([row.created_at, row.id]), "utf8").toString("base64url");
}

function decodeConversationTopicCursor(cursor: string): [number, string] {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      !Number.isSafeInteger(parsed[0]) ||
      typeof parsed[1] !== "string" ||
      !parsed[1]
    ) {
      throw new Error("invalid cursor");
    }
    return [parsed[0], parsed[1]];
  } catch {
    throw new Error("Invalid Conversation Topic cursor");
  }
}

function hydrateConversationTopics(db: SqliteDb, rows: ConversationTopicRow[]): AppConversationTopic[] {
  const taskRows = rows.length
    ? (db
        .prepare(
          `SELECT topic_id, app_id, task_id
           FROM conversation_topic_tasks
           WHERE topic_id IN (${rows.map(() => "?").join(",")})
           ORDER BY linked_at, app_id, task_id`,
        )
        .all(...rows.map((row) => requiredText(row.id, "topic id"))) as Array<Record<string, unknown>>)
    : [];
  const identities = taskRows.map((row) => ({
    appId: requiredText(row.app_id, "topic task app id"),
    taskId: requiredText(row.task_id, "topic task id"),
  }));
  const refs = displayTaskReferences(db, identities);
  return rows.map((row) => ({
    id: requiredText(row.id, "topic id"),
    title: requiredText(row.title, "topic title"),
    openedBy: requiredText(row.opened_by, "topic opened_by"),
    originMessageId: requiredText(row.origin_message_id, "topic origin_message_id"),
    taskRefs: taskRows
      .filter((task) => task.topic_id === row.id)
      .map((task) => {
        const taskAppId = requiredText(task.app_id, "topic task app id");
        const taskId = requiredText(task.task_id, "topic task id");
        return {
          appId: taskAppId,
          taskId,
          ref: refs.get(`${taskAppId}\0${taskId}`),
        };
      }),
  }));
}

export function listConversationTopicPage(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  options: { limit?: number; cursor?: string } = {},
): AppConversationTopicPage {
  requiredText(appId, "topic appId");
  requiredText(conversationId, "topic conversationId");
  const limit = options.limit ?? 12;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Conversation topic limit must be an integer from 1 to 100");
  }
  const cursor = options.cursor ? decodeConversationTopicCursor(options.cursor) : null;
  const rows = db
    .prepare(
      `SELECT id, title, opened_by, origin_message_id, created_at
       FROM conversation_topics
       WHERE app_id = ? AND conversation_id = ?
         ${cursor ? "AND (created_at < ? OR (created_at = ? AND id < ?))" : ""}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(
      appId,
      conversationId,
      ...(cursor ? [cursor[0], cursor[0], cursor[1]] : []),
      limit + 1,
    ) as ConversationTopicRow[];
  const pageRows = rows.slice(0, limit);
  return {
    items: hydrateConversationTopics(db, pageRows),
    ...(rows.length > limit && pageRows.length > 0
      ? { nextCursor: encodeConversationTopicCursor(pageRows[pageRows.length - 1]!) }
      : {}),
  };
}

/** Resolve one exact Topic or unique stable short reference without scanning recent history. */
export function readConversationTopic(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  idOrRef: string,
): AppConversationTopic | null {
  const normalized = requiredText(idOrRef, "topic id or ref").toLowerCase();
  const exact = db
    .prepare(
      `SELECT id, title, opened_by, origin_message_id, created_at
       FROM conversation_topics
       WHERE app_id = ? AND conversation_id = ? AND lower(id) IN (?, ?)
       LIMIT 1`,
    )
    .get(appId, conversationId, normalized, `topic_${normalized}`) as ConversationTopicRow | undefined;
  if (exact) return hydrateConversationTopics(db, [exact])[0] ?? null;
  const matches = db
    .prepare(
      `SELECT id, title, opened_by, origin_message_id, created_at
       FROM conversation_topics
       WHERE app_id = ? AND conversation_id = ?
         AND substr(lower(CASE WHEN id LIKE 'topic_%' THEN substr(id, 7) ELSE id END), 1, 8) = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 2`,
    )
    .all(appId, conversationId, normalized) as ConversationTopicRow[];
  if (matches.length > 1) throw new Error(`Conversation Topic ref ${idOrRef} is ambiguous`);
  return matches.length === 1 ? (hydrateConversationTopics(db, matches)[0] ?? null) : null;
}

/**
 * Bounded read-only retrieval for an LLM-chosen historical Topic query.
 * Matching only returns candidates; it never selects a Topic or changes work.
 */
export function findConversationTopics(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  query: string,
  limit = 8,
): AppConversationTopic[] {
  const text = requiredText(query, "Conversation Topic query").slice(0, 200).toLowerCase();
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Conversation Topic search limit must be an integer from 1 to 20");
  }
  const terms = [...new Set(text.split(/\s+/).filter(Boolean))].slice(0, 6);
  const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
  const clauses = terms.map(
    () => `(
      lower(t.title) LIKE ? ESCAPE '\\'
      OR EXISTS (
        SELECT 1 FROM app_inbox_items i
        WHERE i.app_id = t.app_id AND i.conversation_id = t.conversation_id AND i.topic_id = t.id
          AND lower(i.input_data) LIKE ? ESCAPE '\\'
      )
      OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.event_type = 'conversation.message.created'
          AND json_extract(e.data, '$.appId') = t.app_id
          AND json_extract(e.data, '$.conversationId') = t.conversation_id
          AND json_extract(e.data, '$.metadata.topicId') = t.id
          AND lower(json_extract(e.data, '$.text')) LIKE ? ESCAPE '\\'
      )
    )`,
  );
  const params = terms.flatMap((term) => {
    const pattern = `%${escapeLike(term)}%`;
    return [pattern, pattern, pattern];
  });
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.opened_by, t.origin_message_id, t.created_at
       FROM conversation_topics t
       WHERE t.app_id = ? AND t.conversation_id = ? AND ${clauses.join(" AND ")}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ?`,
    )
    .all(appId, conversationId, ...params, limit) as ConversationTopicRow[];
  return hydrateConversationTopics(db, rows);
}

/** Resolve the Topic attached to an exact durable Conversation message. */
export function readConversationMessageTopicId(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  messageId: string,
): string | null {
  const id = requiredText(messageId, "conversation message id");
  const inbox = db
    .prepare(
      `SELECT topic_id FROM app_inbox_items
       WHERE app_id = ? AND conversation_id = ? AND (source_id = ? OR 'result:' || id = ?)
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(appId, conversationId, id, id) as { topic_id?: unknown } | undefined;
  if (typeof inbox?.topic_id === "string" && inbox.topic_id.trim()) return inbox.topic_id.trim();
  const eventId = id.startsWith("event:") ? Number(id.slice("event:".length)) : NaN;
  if (!Number.isSafeInteger(eventId)) return null;
  const event = db.prepare("SELECT data FROM events WHERE id = ?").get(eventId) as { data?: unknown } | undefined;
  if (typeof event?.data !== "string") return null;
  try {
    const data = JSON.parse(event.data) as { appId?: unknown; conversationId?: unknown; metadata?: { topicId?: unknown } };
    return data.appId === appId && data.conversationId === conversationId && typeof data.metadata?.topicId === "string"
      ? data.metadata.topicId.trim() || null
      : null;
  } catch {
    return null;
  }
}

export function createConversationTopic(db: SqliteDb, input: CreateConversationTopic): AppConversationTopic {
  const id = requiredText(input.id, "topic id");
  const appId = requiredText(input.appId, "topic appId");
  const conversationId = requiredText(input.conversationId, "topic conversationId");
  const title = requiredText(input.title, "topic title");
  const openedBy = requiredText(input.openedBy, "topic openedBy");
  const originMessageId = requiredText(input.originMessageId, "topic originMessageId");
  db.run(
    `INSERT OR IGNORE INTO conversation_topics
       (id, app_id, conversation_id, title, opened_by, origin_message_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, appId, conversationId, title, openedBy, originMessageId, input.now ?? Date.now()],
  );
  const row = db.prepare("SELECT * FROM conversation_topics WHERE id = ?").get(id);
  if (
    !row ||
    row.app_id !== appId ||
    row.conversation_id !== conversationId ||
    row.title !== title ||
    row.opened_by !== openedBy ||
    row.origin_message_id !== originMessageId
  ) {
    throw new Error(`Conversation topic ${id} conflicts with an existing topic`);
  }
  return { id, title, openedBy, originMessageId, taskRefs: [] };
}

export function associateAppInboxClaimTopic(
  db: SqliteDb,
  claim: AppInboxClaim,
  topicId: string,
  now = Date.now(),
): boolean {
  const id = requiredText(topicId, "topic id");
  return (
    db.run(
      `UPDATE app_inbox_items
       SET topic_id = ?, changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?
         AND (topic_id IS NULL OR topic_id = ?)`,
      [id, now, now, claim.item.id, claim.generation, claim.owner, id],
    ).changes === 1
  );
}

export function linkConversationTopicTask(
  db: SqliteDb,
  topicId: string,
  appId: string,
  taskId: string,
  now = Date.now(),
): void {
  db.run(
    `INSERT OR IGNORE INTO conversation_topic_tasks (topic_id, app_id, task_id, linked_at)
     VALUES (?, ?, ?, ?)`,
    [
      requiredText(topicId, "topic id"),
      requiredText(appId, "topic task appId"),
      requiredText(taskId, "topic taskId"),
      now,
    ],
  );
}

export function listAppInboxChildren(db: SqliteDb, parentId: string): AppInboxItem[] {
  return db
    .prepare("SELECT * FROM app_inbox_items WHERE parent_id = ? ORDER BY created_at, id")
    .all(requiredText(parentId, "parent request id"))
    .map(rowToItem);
}

/** Unfinished human requests already associated with the visible Conversation Topics. */
export function listOpenConversationTopicRequests(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  topicIds: string[],
  excludeRequestId: string,
  limit = 8,
): AppInboxItem[] {
  const topics = [...new Set(topicIds.map((topicId) => requiredText(topicId, "topic id")))];
  if (topics.length === 0) return [];
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 32) {
    throw new Error("Open Conversation request limit must be an integer from 1 to 32");
  }
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ? AND conversation_id = ?
         AND source_kind = 'human' AND status != 'done'
         AND continues_request_id IS NULL AND id != ?
         AND topic_id IN (${topics.map(() => "?").join(", ")})
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(
      requiredText(appId, "appId"),
      requiredText(conversationId, "conversationId"),
      requiredText(excludeRequestId, "excludeRequestId"),
      ...topics,
      limit,
    )
    .map(rowToItem);
}

/**
 * Previous-runtime claims that reached owner-session admission before the
 * process stopped. The generation, owner, and session together are the fence
 * used when converting one of these claims into an explicit session wait.
 */
export function listAppInboxAssociatedSessionClaims(db: SqliteDb): AppInboxSessionClaim[] {
  const rows = db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE status = 'handling'
         AND session_id IS NOT NULL
         AND lease_owner IS NOT NULL
         AND lease_expires_at IS NOT NULL
       ORDER BY created_at, id`,
    )
    .all();

  return rows.map((row) => {
    const item = rowToItem(row);
    if (!item.sessionId || !item.lease) throw new Error(`Invalid associated session claim ${item.id}`);
    return {
      claim: { item, generation: item.lease.generation, owner: item.lease.owner },
      sessionId: item.sessionId,
    };
  });
}

/** Session waits are runtime recovery state, not an App authoring capability. */
export function listAppInboxSessionWaits(db: SqliteDb): AppInboxItem[] {
  return listAppInboxDependencyWaits(db, "session");
}

/** Durable waits that must be re-observed after events may have been missed offline. */
export function listAppInboxDependencyWaits(db: SqliteDb, kind: AppInboxWaitKind): AppInboxItem[] {
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE status = 'handling'
         AND lease_owner IS NULL
         AND waiting_on_kind = ?
         AND waiting_on_id IS NOT NULL
       ORDER BY created_at, id`,
    )
    .all(kind)
    .map(rowToItem);
}

/** One bounded page of distinct canonical Task dependencies awaiting review. */
export function listAppInboxTaskDependencyKeys(
  db: SqliteDb,
  options: { after?: AppInboxTaskDependencyKey; limit?: number } = {},
): AppInboxTaskDependencyPage {
  const limit = options.limit ?? 256;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error("App inbox task dependency limit must be an integer from 1 to 1000");
  }
  const after = options.after;
  const rows = db
    .prepare(
      `SELECT app_id, waiting_on_id
       FROM app_inbox_items INDEXED BY idx_app_inbox_task_wait_recovery
       WHERE status = 'handling'
         AND lease_owner IS NULL
         AND waiting_on_kind = 'task'
         AND waiting_on_id IS NOT NULL
         ${after ? "AND (app_id, waiting_on_id) > (?, ?)" : ""}
       GROUP BY app_id, waiting_on_id
       ORDER BY app_id, waiting_on_id
       LIMIT ?`,
    )
    .all(
      ...(after ? [requiredText(after.appId, "after.appId"), requiredText(after.taskId, "after.taskId")] : []),
      limit + 1,
    )
    .map((row) => ({
      appId: requiredText(row.app_id, "app_id"),
      taskId: requiredText(row.waiting_on_id, "waiting_on_id"),
    }));
  const items = rows.slice(0, limit);
  return {
    items,
    ...(rows.length > limit && items.length > 0 ? { nextCursor: items[items.length - 1] } : {}),
  };
}

/** True when the App inbox is the explicit unfinished owner of this dependency. */
export function hasAppInboxWait(db: SqliteDb, waitingOn: { kind: AppInboxWaitKind; id: string }): boolean {
  const id = requiredText(waitingOn.id, "waitingOn.id");
  const row = db
    .prepare(
      `SELECT 1 AS found
       FROM app_inbox_items
       WHERE status != 'done'
         AND waiting_on_kind = ?
         AND waiting_on_id = ?
       LIMIT 1`,
    )
    .get(waitingOn.kind, id) as { found?: unknown } | undefined;
  return row?.found === 1;
}

/** Current lifecycle health derived directly from the inbox authority, never event reconstruction. */
export function listAppInboxHealth(db: SqliteDb, query: { appId?: string; now?: number } = {}): AppInboxHealth[] {
  const now = query.now ?? Date.now();
  if (!Number.isFinite(now)) throw new Error("App inbox health now must be finite");
  const appId = query.appId === undefined ? undefined : requiredText(query.appId, "appId");
  const rows = db
    .prepare(
      `SELECT app_id,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'handling' THEN 1 ELSE 0 END) AS handling,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN status != 'done'
                            AND ((lease_owner IS NULL AND available_at IS NOT NULL AND available_at <= ?)
                              OR (lease_expires_at IS NOT NULL AND lease_expires_at <= ?))
                       THEN 1 ELSE 0 END) AS ready,
              SUM(CASE WHEN status = 'handling' AND lease_owner IS NULL
                            AND waiting_on_kind IS NOT NULL AND waiting_on_id IS NOT NULL
                       THEN 1 ELSE 0 END) AS waiting_on_dependency,
              SUM(CASE WHEN status = 'handling' AND result IS NOT NULL
                            AND EXISTS (
                              SELECT 1 FROM app_inbox_deliveries delivery
                              WHERE delivery.item_id = app_inbox_items.id
                                AND delivery.kind = 'final'
                                AND delivery.status != 'delivered'
                            )
                       THEN 1 ELSE 0 END) AS waiting_on_delivery,
              SUM(CASE WHEN status = 'handling' AND lease_owner IS NOT NULL
                            AND lease_expires_at > ?
                       THEN 1 ELSE 0 END) AS active_leases,
              SUM(CASE WHEN status = 'handling' AND lease_owner IS NOT NULL
                            AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
                       THEN 1 ELSE 0 END) AS expired_leases,
              MIN(CASE WHEN status = 'pending' THEN created_at END) AS oldest_pending_at,
              MIN(CASE WHEN status = 'handling' THEN created_at END) AS oldest_handling_at
       FROM app_inbox_items
       WHERE (? IS NULL OR app_id = ?)
       GROUP BY app_id
       ORDER BY app_id`,
    )
    .all(now, now, now, now, appId ?? null, appId ?? null) as Array<Record<string, unknown>>;

  const age = (value: unknown): number | undefined =>
    typeof value === "number" ? Math.max(0, now - value) : undefined;
  return rows.map((row) => ({
    appId: requiredText(row.app_id, "app_id"),
    total: Number(row.total),
    pending: Number(row.pending),
    handling: Number(row.handling),
    done: Number(row.done),
    ready: Number(row.ready),
    waitingOnDependency: Number(row.waiting_on_dependency),
    waitingOnDelivery: Number(row.waiting_on_delivery),
    activeLeases: Number(row.active_leases),
    expiredLeases: Number(row.expired_leases),
    oldestPendingAgeMs: age(row.oldest_pending_at),
    oldestHandlingItemAgeMs: age(row.oldest_handling_at),
  }));
}

export function createAppInboxItem(db: SqliteDb, input: CreateAppInboxItem): { item: AppInboxItem; created: boolean } {
  validateCreate(input);
  const now = input.now ?? Date.now();
  const id = input.id ?? `app_${randomUUID()}`;
  const result = db.run(
    `INSERT OR IGNORE INTO app_inbox_items (
       id, app_id, parent_id, target_task_id, topic_id, conversation_id, conversation_seq,
       channel, channel_target_id, channel_thread_id, channel_message_id, reply_to_source_id,
       source_kind, source_id, input_kind, input_data, status,
       available_at, origin_event_id, idempotency_key, created_at, changed_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.appId,
      input.parentId ?? null,
      input.targetTaskId ?? null,
      input.topicId ?? null,
      input.conversationId ?? null,
      input.conversationSequence ?? null,
      input.channel ?? null,
      input.channelTargetId ?? null,
      input.channelThreadId ?? null,
      input.channelMessageId ?? null,
      input.replyToSourceId ?? null,
      input.source.kind,
      input.source.id,
      input.input.kind,
      JSON.stringify(input.input.data),
      now,
      input.originEventId ?? null,
      input.idempotencyKey ?? null,
      now,
      now,
      now,
    ],
  );

  if (result.changes === 1) {
    const item = getAppInboxItem(db, id);
    if (!item) throw new Error(`Created App inbox item ${id} is missing`);
    return { item, created: true };
  }

  const existing = input.idempotencyKey
    ? db
        .prepare("SELECT * FROM app_inbox_items WHERE app_id = ? AND idempotency_key = ?")
        .get(input.appId, input.idempotencyKey)
    : db.prepare("SELECT * FROM app_inbox_items WHERE id = ?").get(id);
  if (!existing) throw new Error(`App inbox item ${id} conflicted with an unknown row`);
  let item = rowToItem(existing);
  if (item.appId !== input.appId) {
    throw new Error(`App inbox item ${id} already belongs to App ${item.appId}`);
  }
  if (
    item.parentId !== input.parentId ||
    item.targetTaskId !== input.targetTaskId ||
    item.topicId !== input.topicId ||
    item.source.kind !== input.source.kind ||
    item.source.id !== input.source.id ||
    !isDeepStrictEqual(item.input, input.input)
  ) {
    throw new Error(`App inbox idempotency key ${input.idempotencyKey ?? id} was reused with different input`);
  }
  if (input.originEventId !== undefined) {
    if (item.originEventId !== undefined && item.originEventId !== input.originEventId) {
      throw new Error(`App inbox item ${item.id} already belongs to event ${item.originEventId}`);
    }
    if (item.originEventId === undefined) {
      db.run(
        `UPDATE app_inbox_items
         SET origin_event_id = ?, updated_at = ?
         WHERE id = ? AND origin_event_id IS NULL`,
        [input.originEventId, now, item.id],
      );
      const linked = getAppInboxItem(db, item.id);
      if (!linked) throw new Error(`Linked App inbox item ${item.id} is missing`);
      item = linked;
    }
  }
  return { item, created: false };
}

export function listUnlinkedAppDelegations(db: SqliteDb, limit = 100): AppInboxItem[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("Delegation query limit must be positive");
  return (
    db
      .prepare(
        `SELECT * FROM app_inbox_items
         WHERE parent_id IS NOT NULL
           AND source_kind = 'app'
           AND origin_event_id IS NULL
           AND idempotency_key LIKE 'delegate:%'
         ORDER BY created_at, id
         LIMIT ?`,
      )
      .all(limit) as InboxRow[]
  ).map(rowToItem);
}

const CLAIMABLE_SQL = `
  status != 'done'
  AND (
    (lease_owner IS NULL AND available_at IS NOT NULL AND available_at <= ?)
    OR (lease_expires_at IS NOT NULL AND lease_expires_at <= ?)
  )
`;

function claimedRow(
  db: SqliteDb,
  whereSql: string,
  whereParams: unknown[],
  owner: string,
  leaseMs: number,
  now: number,
): AppInboxClaim | null {
  requiredText(owner, "lease owner");
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("App inbox leaseMs must be positive");
  const row = db
    .prepare(
      `UPDATE app_inbox_items
       SET status = 'handling',
           available_at = NULL,
           session_id = NULL,
           started_at = COALESCE(started_at, ?),
           changed_at = ?,
           lease_generation = lease_generation + 1,
           lease_owner = ?,
           lease_expires_at = ?,
           updated_at = ?
       WHERE ${whereSql}
       RETURNING *`,
    )
    .get(now, now, owner, now + leaseMs, now, ...whereParams);
  if (!row) return null;
  const item = rowToItem(row);
  return { item, generation: item.lease!.generation, owner };
}

export function claimAppInboxItem(
  db: SqliteDb,
  id: string,
  owner: string,
  leaseMs: number,
  now = Date.now(),
): AppInboxClaim | null {
  return claimedRow(
    db,
    `id = ? AND ${CLAIMABLE_SQL}
     AND (
       conversation_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM app_inbox_items active
         WHERE active.app_id = app_inbox_items.app_id
           AND active.conversation_id = app_inbox_items.conversation_id
           AND active.id != app_inbox_items.id
           AND active.lease_owner IS NOT NULL
           AND active.lease_expires_at > ?
       )
     )`,
    [id, now, now, now],
    owner,
    leaseMs,
    now,
  );
}

export function claimNextAppInboxItem(
  db: SqliteDb,
  appId: string,
  owner: string,
  leaseMs: number,
  now = Date.now(),
): AppInboxClaim | null {
  requiredText(appId, "appId");
  requiredText(owner, "lease owner");
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("App inbox leaseMs must be positive");

  const row = db
    .prepare(
      `UPDATE app_inbox_items
       SET status = 'handling',
           available_at = NULL,
           session_id = NULL,
           started_at = COALESCE(started_at, ?),
           changed_at = ?,
           lease_generation = lease_generation + 1,
           lease_owner = ?,
           lease_expires_at = ?,
           updated_at = ?
       WHERE id = (
         SELECT candidate.id
         FROM app_inbox_items candidate
         WHERE candidate.app_id = ?
           AND candidate.status != 'done'
           AND (
             (candidate.lease_owner IS NULL
               AND candidate.available_at IS NOT NULL
               AND candidate.available_at <= ?)
             OR (candidate.lease_expires_at IS NOT NULL
               AND candidate.lease_expires_at <= ?)
           )
           AND (
             candidate.conversation_id IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM app_inbox_items active
               WHERE active.app_id = candidate.app_id
                 AND active.conversation_id = candidate.conversation_id
                 AND active.id != candidate.id
                 AND active.lease_owner IS NOT NULL
                 AND active.lease_expires_at > ?
             )
           )
         ORDER BY candidate.created_at, candidate.conversation_seq, candidate.id
         LIMIT 1
       )
       RETURNING *`,
    )
    .get(now, now, owner, now + leaseMs, now, appId, now, now, now);
  if (!row) return null;
  const item = rowToItem(row);
  return { item, generation: item.lease!.generation, owner };
}

/**
 * Fence one represented unfinished human request so the current May owner turn
 * can replace its mechanism without scheduling May a second time.
 */
export function claimReferencedAppInboxWork(
  db: SqliteDb,
  current: AppInboxClaim,
  requestId: string,
  leaseMs: number,
  now = Date.now(),
): AppInboxClaim | null {
  const targetId = requiredText(requestId, "continued request id");
  const conversationId = requiredText(current.item.conversationId, "current conversation id");
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("App inbox leaseMs must be positive");
  if (targetId === current.item.id) return null;
  const row = db
    .prepare(
      `UPDATE app_inbox_items
       SET status = 'handling', available_at = NULL, review_at = NULL,
           conversation_id = COALESCE(conversation_id, ?),
           session_id = (SELECT active.session_id FROM app_inbox_items active WHERE active.id = ?),
           started_at = COALESCE(started_at, ?), changed_at = ?,
           lease_generation = lease_generation + 1,
           lease_owner = ?, lease_expires_at = ?, updated_at = ?
       WHERE id = ?
         AND app_id = ? AND (conversation_id = ? OR conversation_id IS NULL) AND source_kind = 'human'
         AND continues_request_id IS NULL AND status != 'done'
         AND (lease_owner IS NULL OR lease_expires_at <= ?)
         AND EXISTS (
           SELECT 1 FROM app_inbox_items active
           WHERE active.id = ? AND active.status = 'handling'
             AND active.lease_generation = ? AND active.lease_owner = ?
         )
       RETURNING *`,
    )
    .get(
      conversationId,
      current.item.id,
      now,
      now,
      current.owner,
      now + leaseMs,
      now,
      targetId,
      current.item.appId,
      conversationId,
      now,
      current.item.id,
      current.generation,
      current.owner,
    );
  if (!row) return null;
  const item = rowToItem(row);
  return { item, generation: item.lease!.generation, owner: current.owner };
}

export function renewAppInboxClaim(db: SqliteDb, claim: AppInboxClaim, leaseMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("App inbox leaseMs must be positive");
  return (
    db.run(
      `UPDATE app_inbox_items
       SET lease_expires_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [now + leaseMs, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

export function associateAppInboxClaimSession(
  db: SqliteDb,
  claim: AppInboxClaim,
  sessionId: string,
  now = Date.now(),
): boolean {
  requiredText(sessionId, "sessionId");
  return (
    db.run(
      `UPDATE app_inbox_items
       SET session_id = ?, changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [sessionId, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

export function waitAppInboxClaim(
  db: SqliteDb,
  claim: AppInboxClaim,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  options: { reviewAfterMs?: number; now?: number } = {},
): boolean {
  requiredText(waitingOn.id, "waitingOn.id");
  const now = options.now ?? Date.now();
  const reviewAt = options.reviewAfterMs === undefined ? null : now + options.reviewAfterMs;
  if (options.reviewAfterMs !== undefined && (!Number.isFinite(options.reviewAfterMs) || options.reviewAfterMs < 0)) {
    throw new Error("App inbox reviewAfterMs must be finite and non-negative");
  }
  return (
    db.run(
      `UPDATE app_inbox_items
       SET waiting_on_kind = ?, waiting_on_id = ?, review_at = ?, available_at = ?,
           session_id = NULL, lease_owner = NULL, lease_expires_at = NULL, changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [waitingOn.kind, waitingOn.id, reviewAt, reviewAt, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

export function wakeAppInboxItem(db: SqliteDb, id: string, now = Date.now()): boolean {
  return (
    db.run(
      `UPDATE app_inbox_items
       SET available_at = CASE
             WHEN available_at IS NULL OR available_at > ? THEN ?
             ELSE available_at
           END,
           review_at = NULL,
           updated_at = ?
       WHERE id = ? AND status = 'handling' AND lease_owner IS NULL`,
      [now, now, now, id],
    ).changes === 1
  );
}

/** Wake every unfinished item explicitly waiting on a completed dependency. */
export function wakeAppInboxItemsWaitingOn(
  db: SqliteDb,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  now = Date.now(),
): number {
  return wakeAppInboxItemsWaitingOnScope(db, waitingOn, now);
}

/** Wake one dependency only inside its canonical App scope. */
export function wakeAppInboxItemsWaitingOnApp(
  db: SqliteDb,
  appId: string,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  now = Date.now(),
): number {
  return wakeAppInboxItemsWaitingOnScope(db, waitingOn, now, requiredText(appId, "appId"));
}

function wakeAppInboxItemsWaitingOnScope(
  db: SqliteDb,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  now: number,
  appId?: string,
): number {
  requiredText(waitingOn.id, "waitingOn.id");
  const result = db.run(
    `UPDATE app_inbox_items
     SET available_at = CASE
           WHEN available_at IS NULL OR available_at > ? THEN ?
           ELSE available_at
         END,
         review_at = NULL,
         updated_at = ?
     WHERE status = 'handling'
       AND lease_owner IS NULL
       AND waiting_on_kind = ?
       AND waiting_on_id = ?
       ${appId ? "AND app_id = ?" : ""}
       AND (available_at IS NULL OR available_at > ? OR review_at IS NOT NULL)`,
    [now, now, now, waitingOn.kind, waitingOn.id, ...(appId ? [appId] : []), now],
  );
  return result.changes;
}

export function completeAppInboxClaim(
  db: SqliteDb,
  claim: AppInboxClaim,
  result: AppResult,
  now = Date.now(),
): boolean {
  requiredText(result.summary, "result.summary");
  return (
    db.run(
      `UPDATE app_inbox_items
       SET status = 'done', result = ?, completed_at = ?, changed_at = ?, updated_at = ?,
           waiting_on_kind = NULL, waiting_on_id = NULL,
           review_at = NULL, available_at = NULL,
           lease_owner = NULL, lease_expires_at = NULL
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [JSON.stringify(result), now, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

/** Complete a human feedback turn as context linked to existing work. */
export function completeAppInboxContinuation(
  db: SqliteDb,
  claim: AppInboxClaim,
  requestId: string,
  response: string | undefined,
  now = Date.now(),
): boolean {
  const targetId = requiredText(requestId, "continued request id");
  const normalizedResponse = response?.trim();
  const result: AppResult = {
    summary: `Continued request ${targetId}`,
    ...(normalizedResponse ? { response: normalizedResponse } : {}),
  };
  return (
    db.run(
      `UPDATE app_inbox_items
       SET status = 'done', continues_request_id = ?, result = ?, completed_at = ?, changed_at = ?, updated_at = ?,
           waiting_on_kind = NULL, waiting_on_id = NULL,
           review_at = NULL, available_at = NULL,
           lease_owner = NULL, lease_expires_at = NULL
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [targetId, JSON.stringify(result), now, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

export function releaseAppInboxClaim(
  db: SqliteDb,
  claim: AppInboxClaim,
  options: { retryAfterMs?: number; now?: number } = {},
): boolean {
  const now = options.now ?? Date.now();
  const retryAfterMs = options.retryAfterMs ?? 0;
  if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
    throw new Error("App inbox retryAfterMs must be finite and non-negative");
  }
  const retryAt = now + retryAfterMs;
  return (
    db.run(
      `UPDATE app_inbox_items
       SET status = CASE WHEN waiting_on_kind IS NULL THEN 'pending' ELSE 'handling' END,
           available_at = CASE WHEN waiting_on_kind IS NULL THEN ? ELSE NULL END,
           review_at = CASE WHEN waiting_on_kind IS NULL THEN review_at ELSE NULL END,
           session_id = NULL,
           lease_owner = NULL, lease_expires_at = NULL, changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [retryAt, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

import type {
  AppConversationMessage,
  AppConversationResource,
  AppConversationTopic,
  AppConversationTopicPage,
  AppInput,
} from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { listAppInboxConversationItems, readActiveAppTurn } from "./app-inbox-store.js";
import { displayTaskReferences } from "./task-reference-index.js";
import { listConversationRequests } from "./conversation-requests.js";

export type CreateConversationTopic = {
  id: string;
  appId: string;
  conversationId: string;
  title: string;
  openedBy: string;
  originMessageId: string;
  now?: number;
};

type ConversationEventRow = {
  id: number;
  data: string;
  timestamp: number;
};

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid App inbox ${field}`);
  return value;
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
  const messageId =
    typeof data.messageId === "string" && data.messageId.trim() ? data.messageId.trim() : `event:${row.id}`;
  return {
    id: messageId,
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
  const eventMessagesById = new Map<string, AppConversationMessage>();
  for (const row of eventRows) {
    const message = conversationEventMessage(row);
    // Rows are newest-first. A later explicit revision is the canonical
    // representation when a stable message identity was published again.
    if (message && !eventMessagesById.has(message.id)) eventMessagesById.set(message.id, message);
  }
  const conversationRows = listAppInboxConversationItems(db, appId, conversationId, limit, exactTopicId);
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
    const resultText = item.continuesRequestId || item.executionTaskId
      ? item.result?.response?.trim()
      : item.result?.response?.trim() || item.result?.summary?.trim();
    if (!resultText) continue;
    const inferredCreatedTaskId = [...targetedTaskIds].find(
      (taskId) => taskId === item.id || taskId.endsWith(`/${item.id}`),
    );
    const resultTaskId =
      item.waitingOn?.kind === "task" ? item.waitingOn.id : (item.targetTaskId ?? inferredCreatedTaskId);
    const resultIdentity = resultTaskId ?? `request:${item.id}`;
    // Several human turns may feed one Task, but its accepted result has one
    // public owner in the Conversation. Rows are newest-first, so the result
    // stays beside the feedback that most recently shaped that Task.
    if (projectedTaskResults.has(resultIdentity)) continue;
    projectedTaskResults.add(resultIdentity);
    // A failed old wait may already have published an acknowledgment as result:<id>.
    // Preserve that history and give the failure its own stable visible identity.
    const resultMessageId = `${item.handling?.phase === "failed" ? "failure" : "result"}:${item.id}`;
    // Explicit and compatibility projections share one semantic identity.
    // Prefer the explicit Event when both happen to be inside this read.
    if (eventMessagesById.has(resultMessageId)) continue;
    messages.push({
      id: resultMessageId,
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
  messages.push(...eventMessagesById.values());
  for (const row of commandRows) {
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
  const topics =
    exactTopic && !page.items.some((topic) => topic.id === exactTopic.id) ? [exactTopic, ...page.items] : page.items;
  const recentMessages = listAppConversationMessages(db, appId, conversationId, limit);
  const messages = exactTopic
    ? [
        ...new Map(
          [
            ...recentMessages,
            ...listAppConversationMessages(db, appId, conversationId, Math.min(limit, 40), exactTopic.id),
          ].map((message) => [message.id, message]),
        ).values(),
      ].sort(
        (left, right) =>
          left.createdAt - right.createdAt || left.sequence - right.sequence || left.id.localeCompare(right.id),
      )
    : recentMessages;
  return {
    id: conversationId,
    owner: appId,
    version: messages.reduce((latest, message) => Math.max(latest, message.sequence), 0),
    activeTurn: readActiveAppTurn(db, appId, conversationId),
    requests: listConversationRequests(db, appId, conversationId, options.topicId),
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
       WHERE app_id = ? AND conversation_id = ? AND (source_id = ? OR 'result:' || id = ? OR 'failure:' || id = ?)
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(appId, conversationId, id, id, id) as { topic_id?: unknown } | undefined;
  if (typeof inbox?.topic_id === "string" && inbox.topic_id.trim()) return inbox.topic_id.trim();
  const eventId = id.startsWith("event:") ? Number(id.slice("event:".length)) : NaN;
  if (!Number.isSafeInteger(eventId)) return null;
  const event = db.prepare("SELECT data FROM events WHERE id = ?").get(eventId) as { data?: unknown } | undefined;
  if (typeof event?.data !== "string") return null;
  try {
    const data = JSON.parse(event.data) as {
      appId?: unknown;
      conversationId?: unknown;
      metadata?: { topicId?: unknown };
    };
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

export function listConversationTopicLinksForTask(
  db: SqliteDb,
  appId: string,
  taskId: string,
): Array<{ appId: string; conversationId: string; topicId: string }> {
  return (
    db
      .prepare(
        `SELECT topic.app_id, topic.conversation_id, topic.id AS topic_id
       FROM conversation_topic_tasks linked
       JOIN conversation_topics topic ON topic.id = linked.topic_id
       WHERE linked.app_id = ? AND linked.task_id = ?
       ORDER BY topic.created_at, topic.id`,
      )
      .all(requiredText(appId, "topic task appId"), requiredText(taskId, "topic taskId")) as Array<{
      app_id?: string;
      conversation_id?: string;
      topic_id?: string;
    }>
  ).flatMap((row) =>
    row.app_id && row.conversation_id && row.topic_id
      ? [{ appId: row.app_id, conversationId: row.conversation_id, topicId: row.topic_id }]
      : [],
  );
}

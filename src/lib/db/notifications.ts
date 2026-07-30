import { getDb } from "./connection.js";

export interface NotificationMessageRecord {
  telegram_msg_id: number;
  event_type: string | null;
  agent: string | null;
  session_id: string | null;
  project_id: string | null;
  data: string | null;
  sent_at: number;
}

export type TelegramConversationMessage = {
  telegramMsgId: number;
  direction: "inbound" | "outbound";
  agent?: string;
  text: string;
  traceId?: string;
  taskId?: string;
  sentAt: number;
};

export type TelegramFocusedEvent = {
  eventId: number;
  type: string;
  timestamp: number;
  owner?: string;
  taskId?: string;
  projectId?: string;
  status?: string;
  summary?: string;
};

export type TelegramConversationView = {
  conversationId: string;
  focus: {
    traceId?: string;
    taskId?: string;
    projectId?: string;
    owner?: string;
    status?: string;
    events: TelegramFocusedEvent[];
  } | null;
  recentMessages: TelegramConversationMessage[];
};

export function storeNotificationMessage(
  persistDir: string,
  record: Omit<NotificationMessageRecord, "sent_at"> & { sent_at?: number },
): void {
  const db = getDb(persistDir);
  db.run(
    "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      record.telegram_msg_id,
      record.event_type,
      record.agent,
      record.session_id,
      record.project_id,
      record.data,
      record.sent_at ?? Date.now(),
    ],
  );
}

export function getNotificationMessage(persistDir: string, telegramMsgId: number): NotificationMessageRecord | null {
  const db = getDb(persistDir);
  return db
    .prepare("SELECT * FROM notification_messages WHERE telegram_msg_id = ?")
    .get(telegramMsgId) as NotificationMessageRecord | null;
}

/**
 * Recover the newest human Telegram message attached to a request trace.
 *
 * Inbound and outbound Telegram messages share the existing transport index;
 * direction and trace links live in its JSON data so no second conversation
 * store is required.
 */
export function getLatestInboundNotificationMessage(
  persistDir: string,
  traceId: string,
): NotificationMessageRecord | null {
  const normalizedTraceId = traceId.trim();
  if (!normalizedTraceId) return null;
  try {
    const db = getDb(persistDir);
    return db
      .prepare(
        `SELECT *
         FROM notification_messages
         WHERE event_type = 'human.input.received'
           AND json_valid(data) = 1
           AND json_extract(data, '$.direction') = 'inbound'
           AND json_extract(data, '$.traceId') = ?
         ORDER BY sent_at DESC, telegram_msg_id DESC
         LIMIT 1`,
      )
      .get(normalizedTraceId) as NotificationMessageRecord | null;
  } catch {
    return null;
  }
}

/** Read a small, ordered conversation window for a fresh bounded May turn. */
export function getRecentTelegramConversationMessages(
  persistDir: string,
  conversationId: string,
  limit = 8,
): TelegramConversationMessage[] {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId) return [];
  const boundedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  try {
    const db = getDb(persistDir);
    const rows = db
      .prepare(
        `SELECT telegram_msg_id, agent, data, sent_at
         FROM notification_messages
         WHERE json_valid(data) = 1
           AND json_extract(data, '$.conversationId') = ?
           AND json_extract(data, '$.direction') IN ('inbound', 'outbound')
         ORDER BY sent_at DESC, telegram_msg_id DESC
         LIMIT ?`,
      )
      .all(normalizedConversationId, boundedLimit) as Array<{
      telegram_msg_id: number;
      agent: string | null;
      data: string;
      sent_at: number;
    }>;
    return rows.reverse().flatMap((row) => {
      try {
        const data = JSON.parse(row.data) as Record<string, unknown>;
        const direction = data.direction === "inbound" ? "inbound" : "outbound";
        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (!text) return [];
        return [
          {
            telegramMsgId: row.telegram_msg_id,
            direction,
            ...(row.agent ? { agent: row.agent } : {}),
            text,
            ...(typeof data.traceId === "string" ? { traceId: data.traceId } : {}),
            ...(typeof data.taskId === "string" ? { taskId: data.taskId } : {}),
            sentAt: row.sent_at,
          },
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function eventSummary(data: Record<string, unknown>): string | undefined {
  for (const key of ["summary", "outcome", "reason", "message", "content", "requestedAction"]) {
    const value = nonEmpty(data[key]);
    if (value) return value.slice(0, 600);
  }
  return undefined;
}

/**
 * Assemble a compact read-only view for one Telegram turn from existing truth.
 *
 * The caller resolves the reply anchor first and supplies its trace/task links.
 * This function adds recent channel messages and the latest durable facts on
 * that exact request. It does not create conversation or request state.
 */
export function getTelegramConversationView(
  persistDir: string,
  input: {
    conversationId: string;
    traceId?: string;
    taskId?: string;
    projectId?: string;
    messageLimit?: number;
    eventLimit?: number;
  },
): TelegramConversationView {
  const conversationId = input.conversationId.trim();
  const traceId = nonEmpty(input.traceId);
  const taskId = nonEmpty(input.taskId);
  const projectId = nonEmpty(input.projectId);
  const recentMessages = conversationId
    ? getRecentTelegramConversationMessages(persistDir, conversationId, input.messageLimit ?? 8)
    : [];
  if (!traceId && !taskId) return { conversationId, focus: null, recentMessages };

  const eventLimit = Math.max(1, Math.min(20, Math.floor(input.eventLimit ?? 10)));
  try {
    const db = getDb(persistDir);
    const rows = traceId
      ? db
          .prepare(
            `SELECT e.id, e.event_type, e.timestamp, e.owner, e.task_id,
                    e.project_id, e.subject_status, e.data
               FROM events e
               JOIN event_traces trace ON trace.event_id = e.id
              WHERE trace.trace_id = ?
              ORDER BY e.id DESC
              LIMIT ?`,
          )
          .all(traceId, eventLimit)
      : db
          .prepare(
            `SELECT e.id, e.event_type, e.timestamp, e.owner, e.task_id,
                    e.project_id, e.subject_status, e.data
               FROM events e
              WHERE e.task_id = ?
              ORDER BY e.id DESC
              LIMIT ?`,
          )
          .all(taskId!, eventLimit);
    const events = (rows as Array<Record<string, unknown>>).reverse().map((row) => {
      let data: Record<string, unknown> = {};
      try {
        data = typeof row.data === "string" ? JSON.parse(row.data) : {};
      } catch {
        data = {};
      }
      return {
        eventId: Number(row.id),
        type: String(row.event_type),
        timestamp: Number(row.timestamp),
        ...(nonEmpty(row.owner) ? { owner: nonEmpty(row.owner) } : {}),
        ...(nonEmpty(row.task_id) ? { taskId: nonEmpty(row.task_id) } : {}),
        ...(nonEmpty(row.project_id) ? { projectId: nonEmpty(row.project_id) } : {}),
        ...(nonEmpty(data.status) || nonEmpty(row.subject_status)
          ? { status: nonEmpty(data.status) ?? nonEmpty(row.subject_status) }
          : {}),
        ...(eventSummary(data) ? { summary: eventSummary(data) } : {}),
      } satisfies TelegramFocusedEvent;
    });
    const latest = events.at(-1);
    return {
      conversationId,
      focus: {
        ...(traceId ? { traceId } : {}),
        ...(taskId ?? latest?.taskId ? { taskId: taskId ?? latest?.taskId } : {}),
        ...(projectId ?? latest?.projectId ? { projectId: projectId ?? latest?.projectId } : {}),
        ...(latest?.owner ? { owner: latest.owner } : {}),
        ...(latest?.status ? { status: latest.status } : {}),
        events,
      },
      recentMessages,
    };
  } catch {
    return {
      conversationId,
      focus: { ...(traceId ? { traceId } : {}), ...(taskId ? { taskId } : {}), ...(projectId ? { projectId } : {}), events: [] },
      recentMessages,
    };
  }
}

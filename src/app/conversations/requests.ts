import {
  conversationRequestUpdatesSchema,
  type AppConversationRequest,
  type AppConversationRequestUpdate,
} from "@may-agent/sdk";
import { Check } from "typebox/value";
import type { SqliteDb } from "../../lib/db.js";
import { stateTransaction } from "../../lib/db/transaction.js";

export class ConversationRequestConflict extends Error {}
type Row = {
  id: string;
  revision: number;
  scope: string;
  status: "open" | "closed";
  topic_id: string | null;
  task_refs: string;
  closure: string | null;
  update_key: string;
};
function view(row: Row): AppConversationRequest {
  return {
    id: row.id,
    revision: row.revision,
    scope: row.scope,
    status: row.status,
    ...(row.topic_id ? { topicId: row.topic_id } : {}),
    taskRefs: JSON.parse(row.task_refs),
    ...(row.closure ? { closure: JSON.parse(row.closure) } : {}),
  };
}
export function readConversationRequest(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  id: string,
): AppConversationRequest | null {
  const row = db
    .prepare("SELECT * FROM conversation_requests WHERE app_id = ? AND conversation_id = ? AND id = ?")
    .get(appId, conversationId, id) as Row | undefined;
  return row ? view(row) : null;
}
export function listConversationRequests(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  topicId?: string,
  taskRef?: { appId: string; taskId: string },
): AppConversationRequest[] {
  return (
    db
      .prepare(
        `SELECT * FROM conversation_requests WHERE app_id = ? AND conversation_id = ?
    AND (status = 'open' ${topicId ? "OR topic_id = ?" : ""})
    ${taskRef ? "AND EXISTS (SELECT 1 FROM json_each(task_refs) ref WHERE json_extract(ref.value, '$.appId') = ? AND json_extract(ref.value, '$.taskId') = ?)" : ""}
    ORDER BY (status = 'open') DESC, ${topicId ? "(topic_id = ?) DESC," : ""} updated_at DESC, id LIMIT 12`,
      )
      .all(
        appId,
        conversationId,
        ...(topicId ? [topicId] : []),
        ...(taskRef ? [taskRef.appId, taskRef.taskId] : []),
        ...(topicId ? [topicId] : []),
      ) as Row[]
  ).map(view);
}

/** The caller includes the explanation/result write in this same transaction. */
export function applyConversationRequestUpdates(
  db: SqliteDb,
  input: {
    appId: string;
    conversationId: string;
    topicId?: string;
    updates: AppConversationRequestUpdate[];
    updateKey: string;
    messageId?: string;
    now: number;
  },
): void {
  if (!Check(conversationRequestUpdatesSchema, input.updates)) throw new Error("Invalid accepted Request updates");
  const ids = new Set<string>();
  stateTransaction(db, () => {
    for (const update of input.updates) {
      if (ids.has(update.id)) throw new Error("Repeated accepted Request update");
      ids.add(update.id);
      const row = db
        .prepare("SELECT * FROM conversation_requests WHERE app_id = ? AND conversation_id = ? AND id = ?")
        .get(input.appId, input.conversationId, update.id) as Row | undefined;
      const current = row ? view(row) : null;
      const closed = update.disposition !== "open";
      if (closed && (!update.reason?.trim() || !input.messageId))
        throw new Error("Request closure requires a reason and Conversation explanation");
      const closure = closed
        ? { disposition: update.disposition, reason: update.reason!, messageId: input.messageId! }
        : undefined;
      const refs = update.taskRefs ?? current?.taskRefs ?? [];
      if (
        row?.update_key === input.updateKey &&
        current?.revision === update.expectedRevision + 1 &&
        current.scope === update.scope &&
        JSON.stringify(current.closure) === JSON.stringify(closure) &&
        JSON.stringify(current.taskRefs) === JSON.stringify(refs)
      )
        continue;
      if ((current?.revision ?? 0) !== update.expectedRevision || (closed && current && current.scope !== update.scope))
        throw new ConversationRequestConflict(
          `Accepted Request ${update.id} changed; review its current scope and revision`,
        );
      for (const ref of refs) {
        const known = db
          .prepare(
            `SELECT 1 FROM conversation_topic_tasks link JOIN conversation_topics topic ON topic.id = link.topic_id
          WHERE topic.app_id = ? AND topic.conversation_id = ? AND link.app_id = ? AND link.task_id = ? LIMIT 1`,
          )
          .get(input.appId, input.conversationId, ref.appId, ref.taskId);
        if (!known) throw new Error(`Request ${update.id} names a Task outside this Conversation`);
      }
      db.run(
        `INSERT INTO conversation_requests (app_id, conversation_id, id, revision, scope, status, topic_id, task_refs, closure, update_key, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(app_id, conversation_id, id) DO UPDATE SET revision=excluded.revision, scope=excluded.scope,
          status=excluded.status, topic_id=excluded.topic_id, task_refs=excluded.task_refs, closure=excluded.closure,
          update_key=excluded.update_key, updated_at=excluded.updated_at`,
        [
          input.appId,
          input.conversationId,
          update.id,
          update.expectedRevision + 1,
          update.scope,
          closed ? "closed" : "open",
          input.topicId ?? current?.topicId ?? null,
          JSON.stringify(refs),
          closure ? JSON.stringify(closure) : null,
          input.updateKey,
          input.now,
        ],
      );
    }
  });
}

/** Link admitted work without copying its execution state or changing the accepted scope revision. */
export function linkConversationRequestTask(
  db: SqliteDb,
  input: {
    appId: string;
    conversationId: string;
    id: string;
    revision: number;
    taskRef: { appId: string; taskId: string };
  },
): void {
  const current = readConversationRequest(db, input.appId, input.conversationId, input.id);
  if (!current || current.revision !== input.revision || current.status !== "open")
    throw new ConversationRequestConflict("Accepted Request changed before Task admission");
  if (current.taskRefs.some((ref) => ref.appId === input.taskRef.appId && ref.taskId === input.taskRef.taskId)) return;
  if (current.taskRefs.length >= 32) throw new Error("Accepted Request Task link limit reached");
  db.run("UPDATE conversation_requests SET task_refs = ? WHERE app_id = ? AND conversation_id = ? AND id = ?", [
    JSON.stringify([...current.taskRefs, input.taskRef]),
    input.appId,
    input.conversationId,
    input.id,
  ]);
}

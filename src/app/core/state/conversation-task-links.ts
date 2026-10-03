import type { SqliteDb } from "../../../lib/db.js";

/**
 * Conversation return relationships already retained by admission. A worker
 * sees only its assigned input. Older explicit Topic subscriptions remain
 * readable for compatibility, including later results.
 */
export function conversationTaskLinksSql(from: "caller" | "task" = "caller"): string {
  // Recovery starts with one caller App; a live notification starts with one
  // source Task. Keep both lookups indexed instead of scanning every inbox row.
  const handoffs = from === "task"
    ? "app_task_admissions admission INDEXED BY idx_app_task_admissions_target_text CROSS JOIN app_inbox_items origin"
    : "app_inbox_items origin CROSS JOIN app_task_admissions admission";
  return `
  SELECT topic.app_id, topic.conversation_id, topic.id AS topic_id,
    linked.app_id AS task_app_id, linked.task_id,
    'topic:' || topic.id AS link_id, NULL AS origin_input_id,
    NULL AS task_generation, NULL AS result_attempt_id, NULL AS report_attempt_id,
    linked.linked_at
  FROM conversation_topics topic
  JOIN conversation_topic_tasks linked ON linked.topic_id = topic.id
  UNION ALL
  SELECT origin.app_id, origin.conversation_id, origin.topic_id,
    admission.app_id, CAST(json_extract(admission.admission_json, '$.taskId') AS TEXT),
    'input:' || origin.id, origin.id,
    json_extract(admission.admission_json, '$.taskGeneration'),
    json_extract(admission.admission_json, '$.resultAttemptId'),
    json_extract(admission.admission_json, '$.reportAttemptId'),
    CAST(unixepoch(json_extract(admission.admission_json, '$.admittedAt')) * 1000 AS INTEGER)
  FROM ${handoffs}
    ON CAST(json_extract(admission.admission_json, '$.inputEvent.data.request.id') AS TEXT) = origin.id
    AND admission.task_id = 'conversation-follow-up:' || origin.app_id || ':' || origin.id
  WHERE origin.conversation_id IS NOT NULL AND origin.execution_task_id IS NOT NULL
`;
}

export type ConversationTaskLink = {
  appId: string;
  conversationId: string;
  /** Optional grouping, never the identity of a new handoff's return relationship. */
  topicId?: string;
  originInputId?: string;
};

export function listConversationTaskLinks(db: SqliteDb, taskAppId: string, taskId: string): ConversationTaskLink[] {
  return db
    .prepare(
      `SELECT * FROM (${conversationTaskLinksSql("task")})
    WHERE task_app_id = ? AND task_id = ? ORDER BY linked_at, link_id`,
    )
    .all(taskAppId, taskId)
    .map((row) => ({
      appId: String(row.app_id),
      conversationId: String(row.conversation_id),
      ...(typeof row.topic_id === "string" ? { topicId: row.topic_id } : {}),
      ...(typeof row.origin_input_id === "string" ? { originInputId: row.origin_input_id } : {}),
    }));
}

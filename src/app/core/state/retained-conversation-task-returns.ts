import { createHash } from "node:crypto";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { appTaskAttemptReport, readAppTaskIntent } from "../tasks/app-task-reconciler.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import { getAppInboxItem } from "./app-inbox-store.js";
import { admissionReportIdsSql, conversationTaskLinksSql, listConversationTaskLinks } from "./conversation-task-links.js";
import { admitConversationTaskInput, conversationTaskExecutionId } from "./conversation-task-turns.js";

/**
 * Compatibility delivery for retained Topic subscriptions and legacy handoffs.
 * These records are not exact inbox waits. Keep their saved result/closure
 * receipts until they have an equivalent return relationship after migration.
 * New worker input continues through ordinary Task admission.
 */
type ConversationTaskChange =
  { attemptId: string; closedGeneration?: never } | { closedGeneration: number; attemptId?: never };
export type ConversationTaskChangeRef = {
  appId: string;
  conversationId: string;
  topicId?: string;
  originInputId?: string;
  taskAppId: string;
  taskId: string;
} & ConversationTaskChange;

const returnedWithoutSelectionSql = `(
  attempt.accepted_result_state = 'converged'
  OR (attempt.accepted_result_state IN ('incomplete', 'stopped')
    AND NOT EXISTS (SELECT 1 FROM app_task_admissions admission
      WHERE admission.app_id = attempt.app_id
        AND CAST(json_extract(admission.admission_json, '$.taskId') AS TEXT) = attempt.task_id
        AND json_extract(admission.admission_json, '$.taskGeneration') <= attempt.task_generation
        AND (json_extract(admission.admission_json, '$.taskGeneration') = attempt.task_generation
          OR json_extract(admission.admission_json, '$.resultAttemptId') IS NULL)
        AND NOT EXISTS (SELECT 1 FROM app_task_control_receipts reopened
          WHERE reopened.app_id = attempt.app_id AND reopened.task_id = attempt.task_id
            AND reopened.action = 'reopen'
            AND reopened.expected_generation >= json_extract(admission.admission_json, '$.taskGeneration')
            AND reopened.expected_generation < attempt.task_generation)))
  )`;

function returnedAttemptSql(selectedReportSql: string, returnedSql = returnedWithoutSelectionSql): string {
  return `(${returnedSql}
  OR (NOT EXISTS (SELECT 1 FROM app_task_cancellations closed
      WHERE closed.app_id = attempt.app_id AND closed.task_id = attempt.task_id)
    AND EXISTS (${selectedReportSql})
  )
)`;
}

const directSelectedReportSql = `SELECT 1 FROM app_task_admissions admission
  JOIN app_inbox_items origin_input
    ON origin_input.id = json_extract(admission.admission_json, '$.inputEvent.data.request.id')
  WHERE admission.app_id = attempt.app_id
    AND CAST(json_extract(admission.admission_json, '$.taskId') AS TEXT) = attempt.task_id
    AND json_extract(admission.admission_json, '$.taskGeneration') <= attempt.task_generation
    AND NOT EXISTS (SELECT 1 FROM app_task_control_receipts reopened
      WHERE reopened.app_id = attempt.app_id AND reopened.task_id = attempt.task_id
        AND reopened.action = 'reopen'
        AND reopened.expected_generation >= json_extract(admission.admission_json, '$.taskGeneration'))
    AND json_extract(admission.admission_json, '$.resultAttemptId') IS NULL
    AND attempt.attempt_id IN (SELECT value FROM json_each(${admissionReportIdsSql}))
    AND origin_input.app_id = link.app_id
    AND origin_input.conversation_id = link.conversation_id
    AND origin_input.topic_id = link.topic_id`;

const materializedSelectedReportSql = `SELECT 1 FROM selected_reports report
  WHERE report.app_id = attempt.app_id
    AND report.task_id = attempt.task_id
    AND report.task_generation <= attempt.task_generation
    AND NOT EXISTS (SELECT 1 FROM app_task_control_receipts reopened
      WHERE reopened.app_id = attempt.app_id AND reopened.task_id = attempt.task_id
        AND reopened.action = 'reopen' AND reopened.expected_generation >= report.task_generation)
    AND report.attempt_id = attempt.attempt_id
    AND report.origin_app_id = link.app_id
    AND report.origin_conversation_id = link.conversation_id
    AND report.origin_topic_id = link.topic_id`;

// Reopening starts fresh work. Creator corrections can continue outstanding
// input, but input from a cancelled generation must not resume delivering facts.
const continuedCallerSql = `NOT EXISTS (SELECT 1 FROM app_task_control_receipts reopened
  WHERE reopened.app_id = link.task_app_id AND reopened.task_id = link.task_id
    AND reopened.action = 'reopen' AND reopened.expected_generation >= link.task_generation)`;

/** Return only the selected answer/report. An outstanding input can survive a creator revision. */
function returnedLinkAttemptSql(selectedReportSql: string, returnedSql = returnedWithoutSelectionSql): string {
  return `((link.origin_input_id IS NULL AND ${returnedAttemptSql(selectedReportSql, returnedSql)})
    OR (link.origin_input_id IS NOT NULL AND ${continuedCallerSql}
      AND link.task_generation <= attempt.task_generation
      AND (link.result_attempt_id = attempt.attempt_id
        OR (link.result_attempt_id IS NULL AND attempt.attempt_id IN (SELECT value FROM json_each(link.report_attempt_ids))
          AND NOT EXISTS (SELECT 1 FROM app_task_cancellations closed
            WHERE closed.app_id = attempt.app_id AND closed.task_id = attempt.task_id)))))`;
}

// Inbox receipts cover exact caller inputs. Old Topic receipts remain valid for
// results already returned before this change; grouping never becomes a new ask.
const groupedChangeReceiptSql = `SELECT grouped.id FROM app_inbox_items grouped
  WHERE grouped.app_id = changes.appId AND grouped.conversation_id = changes.conversationId
    AND grouped.source_kind = 'system'
    AND grouped.input_kind = CASE WHEN changes.attemptId IS NOT NULL THEN 'task-outcome' ELSE 'task-closed' END
    AND CAST(json_extract(grouped.input_data, '$.appId') AS TEXT) = changes.taskAppId
    AND CAST(json_extract(grouped.input_data, '$.taskId') AS TEXT) = changes.taskId
    AND CAST(COALESCE(json_extract(grouped.input_data, '$.attemptId'),
      json_extract(grouped.input_data, '$.generation')) AS TEXT) =
      CAST(COALESCE(changes.attemptId, changes.closedGeneration) AS TEXT)
    AND (
      (changes.originInputId IS NOT NULL AND EXISTS (
        SELECT 1 FROM json_each(grouped.input_data, '$.originInputIds') linked
        WHERE linked.value = changes.originInputId))
      OR ((changes.originInputId IS NULL OR json_type(grouped.input_data, '$.originInputIds') IS NULL)
        AND (EXISTS (SELECT 1 FROM json_each(grouped.input_data, '$.topicIds') linked
          WHERE linked.value = changes.topicId)
          OR (json_type(grouped.input_data, '$.topicIds') IS NULL AND grouped.topic_id = changes.topicId)))
    )`;
const undeliveredChangeSql = `NOT EXISTS (SELECT 1 FROM app_inbox_items handled WHERE handled.id = changes.inputId)
  AND NOT EXISTS (${groupedChangeReceiptSql})`;

function conversationChangesSql(selectedReportSql: string, materializedAttempts = false): string {
  return `SELECT link.app_id AS appId, link.conversation_id AS conversationId, link.topic_id AS topicId,
    link.origin_input_id AS originInputId, link.link_id AS linkId,
    link.task_app_id AS taskAppId, link.task_id AS taskId, attempt.attempt_id AS attemptId,
    NULL AS closedGeneration, attempt.started_at AS changedAt,
    CASE WHEN link.origin_input_id IS NULL THEN
      'conversation-result:' || link.app_id || ':' || link.conversation_id || ':' || link.topic_id || ':' || link.task_app_id || ':' || attempt.attempt_id
    ELSE 'conversation-input-result:' || link.origin_input_id || ':' || link.task_app_id || ':' || attempt.attempt_id END AS inputId
  FROM links link
  JOIN ${materializedAttempts ? "linked_attempts" : "app_task_attempts"} attempt
    ON attempt.app_id = link.task_app_id AND attempt.task_id = link.task_id
      AND (link.origin_input_id IS NULL
        OR attempt.attempt_id = link.result_attempt_id
        OR (link.result_attempt_id IS NULL AND attempt.attempt_id IN (SELECT value FROM json_each(link.report_attempt_ids))))
  WHERE ${returnedLinkAttemptSql(selectedReportSql, materializedAttempts ? "attempt.returnable" : returnedWithoutSelectionSql)}
  UNION ALL
  SELECT link.app_id, link.conversation_id, link.topic_id, link.origin_input_id, link.link_id,
    link.task_app_id, link.task_id, NULL,
    json_extract(closed.cancellation_json, '$.generation'), closed.requested_at,
    CASE WHEN link.origin_input_id IS NULL THEN
      'conversation-closure:' || link.app_id || ':' || link.conversation_id || ':' || link.topic_id || ':' || link.task_app_id || ':' || link.task_id || ':' || json_extract(closed.cancellation_json, '$.generation')
    ELSE 'conversation-input-closure:' || link.origin_input_id || ':' || link.task_app_id || ':' || link.task_id || ':' || json_extract(closed.cancellation_json, '$.generation') END
  FROM links link
  JOIN app_task_cancellations closed ON closed.app_id = link.task_app_id AND closed.task_id = link.task_id
  WHERE link.origin_input_id IS NULL OR (link.result_attempt_id IS NULL AND ${continuedCallerSql}
    AND link.task_generation <= json_extract(closed.cancellation_json, '$.generation'))`;
}

export type ConversationTaskChangeCursor = {
  changedAt: string | number;
  taskAppId: string;
  taskId: string;
  inputId: string;
};

export function listPendingConversationTaskChanges(
  db: SqliteDb,
  appId: string,
  limit = 100,
): ConversationTaskChangeRef[] {
  return readPendingConversationTaskChangePage(db, appId, limit).changes;
}

/** Advance past attempted links even when admission fails; retry them on the next cycle. */
export function readPendingConversationTaskChangePage(
  db: SqliteDb,
  appId: string,
  limit = 100,
  after?: ConversationTaskChangeCursor,
): { changes: ConversationTaskChangeRef[]; nextCursor?: ConversationTaskChangeCursor } {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Conversation change limit must be an integer from 1 to 100");
  // Exclude closed conversations and self-returns before reading attempt bodies.
  // Many caller/Topic links can refer to one Task; interpret each eligible
  // Task's retained attempts once. Exact admission reads stay direct.
  const rows = db
    .prepare(
      `
    WITH live_conversations AS MATERIALIZED (
      SELECT DISTINCT input.app_id, input.conversation_id
      FROM app_inbox_items input
      JOIN app_tasks owner ON owner.app_id = input.app_id AND owner.task_id = input.execution_task_id
      WHERE input.app_id = ? AND input.conversation_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM app_task_cancellations closed
          WHERE closed.app_id = owner.app_id AND closed.task_id = owner.task_id)
    ), links AS MATERIALIZED (
      SELECT candidate.* FROM (${conversationTaskLinksSql()}) candidate
      WHERE candidate.app_id = ?
        AND EXISTS (SELECT 1 FROM live_conversations live
          WHERE live.app_id = candidate.app_id AND live.conversation_id = candidate.conversation_id)
        AND NOT EXISTS (SELECT 1 FROM app_inbox_items conversation_execution
          WHERE conversation_execution.app_id = candidate.app_id
            AND conversation_execution.conversation_id = candidate.conversation_id
            AND candidate.task_app_id = conversation_execution.app_id
            AND candidate.task_id = conversation_execution.execution_task_id)
    ),
    linked_tasks AS MATERIALIZED (
      SELECT DISTINCT task_app_id AS app_id, task_id FROM links
    ), linked_attempts AS MATERIALIZED (
      SELECT attempt.app_id, attempt.task_id, attempt.attempt_id, attempt.task_generation, attempt.started_at,
        ${returnedWithoutSelectionSql} AS returnable
      FROM linked_tasks linked
      JOIN app_task_attempts attempt ON attempt.app_id = linked.app_id AND attempt.task_id = linked.task_id
    ), selected_reports AS MATERIALIZED (
      SELECT admission.app_id,
        CAST(json_extract(admission.admission_json, '$.taskId') AS TEXT) AS task_id,
        json_extract(admission.admission_json, '$.taskGeneration') AS task_generation,
        report.value AS attempt_id,
        origin_input.app_id AS origin_app_id,
        origin_input.conversation_id AS origin_conversation_id,
        origin_input.topic_id AS origin_topic_id
      FROM linked_tasks linked
      CROSS JOIN app_task_admissions admission
        ON admission.app_id = linked.app_id
          AND CAST(json_extract(admission.admission_json, '$.taskId') AS TEXT) = linked.task_id
      JOIN app_inbox_items origin_input
        ON origin_input.id = json_extract(admission.admission_json, '$.inputEvent.data.request.id')
      JOIN json_each(${admissionReportIdsSql}) report
      WHERE json_extract(admission.admission_json, '$.resultAttemptId') IS NULL
        AND report.value IS NOT NULL
    ), changes AS (${conversationChangesSql(materializedSelectedReportSql, true)})
    SELECT appId, conversationId, topicId, originInputId, taskAppId, taskId, attemptId, closedGeneration,
      changedAt, inputId
    FROM changes
    WHERE ${undeliveredChangeSql}
      ${after ? "AND (changedAt, taskAppId, taskId, inputId) > (?, ?, ?, ?)" : ""}
    ORDER BY changedAt, taskAppId, taskId, inputId LIMIT ?
  `,
    )
    .all(appId, appId, ...(after ? [after.changedAt, after.taskAppId, after.taskId, after.inputId] : []), limit);
  const last = rows.at(-1);
  return {
    ...(last && rows.length === limit ? { nextCursor: {
      changedAt: typeof last.changedAt === "number" ? last.changedAt : String(last.changedAt),
      taskAppId: String(last.taskAppId), taskId: String(last.taskId), inputId: String(last.inputId),
    } } : {}),
    changes: rows.map((row) => {
      const ref = {
        appId: String(row.appId),
        conversationId: String(row.conversationId),
        ...(typeof row.topicId === "string" ? { topicId: row.topicId } : {}),
        ...(typeof row.originInputId === "string" ? { originInputId: row.originInputId } : {}),
        taskAppId: String(row.taskAppId),
        taskId: String(row.taskId),
      };
      return typeof row.attemptId === "string"
        ? { ...ref, attemptId: row.attemptId }
        : { ...ref, closedGeneration: Number(row.closedGeneration) };
    }),
  };
}

export function admitConversationTaskChange(
  target: AppTaskContext,
  source: Pick<AppTaskContext, "resourceStore">,
  input: { conversationId: string; topicId?: string; originInputId?: string; taskId: string } & ConversationTaskChange,
  conversationInputKinds?: readonly string[],
) {
  const db = target.resourceStore.db;
  if (source.resourceStore.db !== db) throw new Error("Conversation result belongs to another Host state");
  return stateTransaction(db, () => {
    const appId = target.resourceStore.appId;
    if (
      !listConversationTaskLinks(db, source.resourceStore.appId, input.taskId).some(
        (link) =>
          link.appId === appId &&
          link.conversationId === input.conversationId &&
          (input.originInputId
            ? link.originInputId === input.originInputId
            : !input.topicId || (!link.originInputId && link.topicId === input.topicId)),
      )
    )
      throw new Error("Task result has no link to this Conversation");
    const task = target.resourceStore.readTask(conversationTaskExecutionId(target, appId, input.conversationId));
    if (!task) throw new Error("Conversation has no execution Task");
    if (source.resourceStore.appId === appId && input.taskId === task.metadata.id)
      throw new Error("A Conversation cannot consume its own outcome as new input");
    let fact: { kind: string; data: Record<string, unknown> };
    if (input.attemptId !== undefined) {
      const attempt = source.resourceStore.readAttempt(input.attemptId);
      if (attempt?.taskId !== input.taskId || (!attempt.acceptedResult && attempt.state !== "failed"))
        throw new Error("Task result must name an accepted attempt or saved failure of the linked Task");
      const outcome =
        attempt.acceptedResult?.state === "converged" ? attempt.acceptedResult : appTaskAttemptReport(attempt);
      if (!outcome) return { taskId: task.metadata.id, created: false };
      fact = {
        kind: "task-outcome",
        data: {
          appId: source.resourceStore.appId,
          taskId: input.taskId,
          generation: attempt.taskGeneration,
          attemptId: input.attemptId,
          outcome,
        },
      };
    } else {
      const closure = source.resourceStore.readCancellation(input.taskId);
      if (!closure || closure.generation !== input.closedGeneration)
        throw new Error("Task closure must name the closed generation of the linked Task");
      fact = {
        kind: "task-closed",
        data: {
          appId: source.resourceStore.appId,
          taskId: input.taskId,
          generation: closure.generation,
          closure,
        },
      };
    }
    const linkId = input.originInputId ? `input:${input.originInputId}` : input.topicId ? `topic:${input.topicId}` : null;
    const changesSql = `WITH links AS MATERIALIZED (
      SELECT * FROM (${conversationTaskLinksSql("task")})
      WHERE app_id = ? AND conversation_id = ? AND task_app_id = ? AND task_id = ?
    ), changes AS (${conversationChangesSql(directSelectedReportSql)})`;
    const args = [
      appId,
      input.conversationId,
      source.resourceStore.appId,
      input.taskId,
      input.attemptId ?? null,
      input.closedGeneration ?? null,
    ];
    const changeFilter = `attemptId IS ? AND closedGeneration IS ?`;
    // Older per-link notifications retain their exact receipt. Conversation-level
    // notifications collect any eligible links still missing that saved outcome.
    if (linkId) {
      const receipt = db
        .prepare(
          `${changesSql}
      SELECT COALESCE((SELECT id FROM app_inbox_items WHERE id = changes.inputId),
        (${groupedChangeReceiptSql} LIMIT 1)) AS receiptId
      FROM changes WHERE ${changeFilter} AND linkId = ?`,
        )
        .get(...args, linkId);
      if (!receipt) return { taskId: task.metadata.id, created: false };
      if (typeof receipt.receiptId === "string")
        return { item: getAppInboxItem(db, receipt.receiptId)!, taskId: task.metadata.id, created: false };
    }
    // One result wakes a Conversation once for all currently eligible callers.
    const links = db
      .prepare(
        `${changesSql}
      SELECT linkId, topicId, originInputId FROM changes
      WHERE ${changeFilter} AND ${undeliveredChangeSql}
      ORDER BY CASE WHEN linkId = ? THEN 0 ELSE 1 END, linkId LIMIT 100`,
      )
      .all(...args, linkId);
    if (!links.length) return { taskId: task.metadata.id, created: false };
    const linkIds = links.map((link) => String(link.linkId)).sort();
    const topicIds = [
      ...new Set(links.flatMap((link) => (typeof link.topicId === "string" ? [link.topicId] : []))),
    ].sort();
    const originInputIds = links
      .flatMap((link) => (typeof link.originInputId === "string" ? [link.originInputId] : []))
      .sort();
    const id = `conversation-change:${createHash("sha256")
      .update(
        JSON.stringify([
          appId,
          input.conversationId,
          source.resourceStore.appId,
          input.taskId,
          input.attemptId ?? null,
          input.closedGeneration ?? null,
          linkIds,
        ]),
      )
      .digest("hex")}`;
    fact = { ...fact, data: { ...fact.data, topicIds, ...(originInputIds.length ? { originInputIds } : {}) } };
    return admitConversationTaskInput(target, {
      id,
      idempotencyKey: id,
      appId,
      conversationId: input.conversationId,
      // Multiple Topics remain context; do not force the whole result into one.
      ...(topicIds.length === 1 ? { topicId: topicIds[0] } : {}),
      source: { kind: "system", id },
      input: fact,
      intent: readAppTaskIntent(target, task.metadata.id)!,
      conversationInputKinds,
    });
  });
}

import type { TaskCreatedOptions, TaskCreatedPage } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { taskViewPhaseSql } from "../state/task-view-phase.js";
import { taskStatusFromPhase } from "./task-status.js";

/** Read the immutable creator record, not grouping, funding or unresolved Conditions.
 * One bounded SQL observation includes open idle results even after their caller wait ended. */
export function readCreatedTasks(
  db: SqliteDb,
  creator: TaskCreatedPage["creator"],
  options: TaskCreatedOptions = {},
): TaskCreatedPage {
  const limit = options.limit ?? 8;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Created Task limit must be an integer between 1 and 100");
  if (!creator.appId?.trim() || !creator.taskId?.trim())
    throw new Error("Created Task read requires a current Task creator");
  let after = ["", ""];
  if (options.cursor !== undefined) {
    try {
      if (typeof options.cursor !== "string") throw new Error();
      const decoded = Buffer.from(options.cursor, "base64url").toString("utf8");
      if (Buffer.from(decoded).toString("base64url") !== options.cursor) throw new Error();
      const cursor = JSON.parse(decoded);
      if (
        !Array.isArray(cursor) ||
        cursor.length !== 5 ||
        cursor[0] !== "created-v1" ||
        cursor[1] !== creator.appId ||
        cursor[2] !== creator.taskId ||
        cursor.slice(3).some((value) => typeof value !== "string" || !value)
      )
        throw new Error();
      after = cursor.slice(3);
    } catch {
      throw new Error("Invalid created Task cursor for this creator");
    }
  }
  const observedAt = new Date().toISOString();
  const rows = db
    .prepare(
      `
    SELECT t.app_id AS appId, t.task_id AS taskId, t.generation,
      t.resource_version AS resourceVersion, (${taskViewPhaseSql("t")}) AS phase,
      substr(json_extract(t.resource_json, '$.spec.outcome'), 1, 240) AS outcomePreview,
      substr(json_extract(t.resource_json, '$.status.summary'), 1, 240) AS summaryPreview,
      a.attempt_id AS acceptedId, a.task_generation AS acceptedGeneration
    FROM app_tasks t
    LEFT JOIN app_task_attempts a ON a.app_id = t.app_id AND a.task_id = t.task_id
      AND a.attempt_id = json_extract(t.resource_json, '$.status.observedAttemptId')
      AND json_type(a.attempt_json, '$.acceptedResult') = 'object'
    WHERE json_valid(t.resource_json)
      AND json_extract(t.resource_json, '$.metadata.creator.appId') = ?
      AND json_extract(t.resource_json, '$.metadata.creator.taskId') = ?
      AND NOT (t.app_id = ? AND t.task_id = ?)
      AND (t.app_id, t.task_id) > (?, ?)
      AND NOT EXISTS (SELECT 1 FROM app_task_cancellations c
        WHERE c.app_id = t.app_id AND c.task_id = t.task_id)
      AND NOT EXISTS (SELECT 1 FROM app_task_receipts r
        WHERE r.app_id = t.app_id AND r.receipt_id = t.task_id
          AND json_extract(r.receipt_json, '$.metadata.generation') >= t.generation)
    ORDER BY t.app_id, t.task_id LIMIT ?
  `,
    )
    .all(creator.appId, creator.taskId, creator.appId, creator.taskId, ...after, limit + 1) as Array<{
    appId: string;
    taskId: string;
    generation: number;
    resourceVersion: number;
    phase: string;
    outcomePreview: string;
    summaryPreview: string | null;
    acceptedId: string | null;
    acceptedGeneration: number | null;
  }>;
  const selected = rows.slice(0, limit);
  const last = selected.at(-1);
  return {
    creator: { appId: creator.appId, taskId: creator.taskId },
    observedAt,
    items: selected.map(({ phase, summaryPreview, acceptedId, acceptedGeneration, ...task }) => ({
      ...task,
      status: taskStatusFromPhase(phase),
      ...(summaryPreview !== null ? { summaryPreview } : {}),
      ...(acceptedId && acceptedGeneration !== null
        ? { acceptedAttempt: { id: acceptedId, generation: acceptedGeneration } }
        : {}),
    })),
    ...(rows.length > limit && last
      ? {
          nextCursor: Buffer.from(
            JSON.stringify(["created-v1", creator.appId, creator.taskId, last.appId, last.taskId]),
          ).toString("base64url"),
        }
      : {}),
  };
}

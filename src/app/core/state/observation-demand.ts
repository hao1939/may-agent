import type { SqliteDb } from "../../../lib/db.js";

export type ObservationDemand = { subject: string; identity: string };
export type ReadObservationDemand = (type: string, source: string, after: string, limit: number) => ObservationDemand[];

/** Indexed projection of existing Conditions. No separate registrations. */
export function observationDemandReader(db: SqliteDb): ReadObservationDemand {
  return (type, source, after, limit) =>
    db
      .prepare(
        `
    SELECT json_extract(c.condition_json, '$.spec.subject') AS subject,
      group_concat(json_array(c.app_id, c.condition_id,
        json_extract(c.condition_json, '$.metadata.generation'), r.task_id)
        ORDER BY c.app_id, c.condition_id, r.task_id) AS identity
    FROM app_task_conditions c INDEXED BY idx_app_task_conditions_type_app
    JOIN app_task_condition_routes r ON r.app_id=c.app_id AND r.condition_id=c.condition_id
    JOIN app_tasks t ON t.app_id=r.app_id AND t.task_id=r.task_id
    WHERE json_extract(c.condition_json, '$.spec.type')=?
      AND json_extract(c.condition_json, '$.spec.expected.source')=?
      AND json_extract(c.condition_json, '$.spec.subject')>?
      AND c.state<>'true' AND t.phase IN ('waiting','running','pending')
      AND NOT EXISTS (SELECT 1 FROM app_task_cancellations x WHERE x.app_id=t.app_id AND x.task_id=t.task_id)
    GROUP BY subject ORDER BY subject LIMIT ?
  `,
      )
      .all(type, source, after, limit) as ObservationDemand[];
}

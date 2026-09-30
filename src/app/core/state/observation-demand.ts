import type { SqliteDb } from "../../../lib/db.js";

export type ObservationDemand = { subject: string };
export type ObservationInterestRoute = ObservationDemand & { source: string; type: string };
export type ReadObservationDemand = (
  type: string,
  source: string,
  after: string,
  limit: number,
  subjects?: readonly string[],
) => ObservationDemand[];

const openDemand = `
  FROM app_task_conditions c
  JOIN app_task_condition_routes r ON r.app_id=c.app_id AND r.condition_id=c.condition_id
  JOIN app_tasks t ON t.app_id=r.app_id AND t.task_id=r.task_id
  WHERE c.state<>'true' AND t.phase IN ('waiting','running','pending')
    AND NOT EXISTS (SELECT 1 FROM app_task_cancellations x WHERE x.app_id=t.app_id AND x.task_id=t.task_id)`;

/** Indexed projection of existing Conditions. No separate registrations or cached wait identities. */
export function observationDemandReader(db: SqliteDb): ReadObservationDemand {
  return (type, source, after, limit, subjects) => {
    if (subjects?.length === 0) return [];
    return db
      .prepare(
        `
      SELECT DISTINCT json_extract(c.condition_json, '$.spec.subject') AS subject
      ${openDemand}
        AND json_extract(c.condition_json, '$.spec.type')=?
        AND json_extract(c.condition_json, '$.spec.expected.source')=?
        AND json_extract(c.condition_json, '$.spec.subject')>?
        ${subjects ? `AND json_extract(c.condition_json, '$.spec.subject') IN (${subjects.map(() => "?").join(",")})` : ""}
      ORDER BY subject LIMIT ?
    `,
      )
      .all(type, source, after, ...(subjects ?? []), limit) as ObservationDemand[];
  };
}

/** A committed Task notification accelerates a bounded slice; normal scans cover the rest or a lost wake. */
export function readTaskObservationInterests(db: SqliteDb, appId: string, taskId: string): ObservationInterestRoute[] {
  return db
    .prepare(
      `
    SELECT DISTINCT json_extract(c.condition_json, '$.spec.subject') AS subject,
      json_extract(c.condition_json, '$.spec.type') AS type,
      json_extract(c.condition_json, '$.spec.expected.source') AS source
    ${openDemand}
      AND r.app_id=? AND r.task_id=?
      AND json_type(c.condition_json, '$.spec.expected.source')='text'
    ORDER BY source, type, subject LIMIT 64
  `,
    )
    .all(appId, taskId) as ObservationInterestRoute[];
}

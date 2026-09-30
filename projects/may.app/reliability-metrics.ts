import type { AppDefinition } from "@may-agent/sdk";

const clock = `CAST(strftime('%s','now') AS INTEGER) * 1000`;
const recoveries = `WITH clock AS (SELECT ${clock} AS cut), recoveries AS (
  SELECT i.id, i.app_id, r.key AS stage,
    json_extract(r.value, '$.firstFailedAt') AS firstFailedAt,
    json_extract(r.value, '$.lastFailedAt') AS lastFailedAt,
    json_extract(r.value, '$.failures') AS failures,
    substr(json_extract(r.value, '$.error'), 1, 400) AS error
  FROM app_inbox_items i, json_each(COALESCE(i.recovery_json, '{}')) r
  WHERE i.app_id != 'evaluation' AND json_extract(r.value, '$.recoveredAt') IS NULL
    AND json_extract(r.value, '$.failures') > 0
    AND ((r.key = 'input-admission' AND i.status != 'done' AND i.execution_task_id IS NULL)
      OR (r.key = 'input-result' AND i.status != 'done')
      OR (r.key = 'input-feedback' AND json_extract(i.recovery_json, '$."input-admission".reportedAt') IS NULL))
)
SELECT VALUE AS value, COUNT(*) AS sampleSize, (SELECT cut FROM clock) AS measuredAt,
  json_object('scope', 'Current unresolved input recovery boundaries, including old unfinished work and excluding Evaluation itself',
    'examples', json((SELECT json_group_array(json_object('appId', app_id, 'inputId', id, 'stage', stage,
      'firstFailedAt', firstFailedAt, 'lastFailedAt', lastFailedAt, 'failures', failures, 'error', error))
      FROM (SELECT * FROM recoveries ORDER BY firstFailedAt, id LIMIT 3)))) AS note
FROM recoveries`;

export const REVIEW_LAG_METRIC = "may.evaluation-unfinished-review-age-seconds";
// App attention policy; Host samples existing facts and never stops retries from these rules.
export const reliabilityMetrics: NonNullable<AppDefinition["metrics"]> = [
  {
    id: "may.unresolved-input-recovery-count",
    name: "Unresolved input recovery boundaries",
    owner: "may",
    project: "may",
    type: "gauge",
    unit: "boundaries",
    measureInterval: 300_000,
    threshold: 0,
    alertOp: ">",
    config: { alert: { mode: "sustained", consecutive: 3 } },
    description:
      "Current unresolved admission, result or feedback recovery. Alert requests inspection; it does not stop retries.",
    sourceQuery: recoveries.replace("VALUE", "COUNT(*)"),
  },
  {
    id: "may.oldest-input-recovery-age-seconds",
    name: "Oldest unresolved input recovery age",
    owner: "may",
    project: "may",
    type: "gauge",
    unit: "seconds",
    measureInterval: 300_000,
    threshold: 3600,
    alertOp: ">",
    description:
      "Age of the oldest current unresolved recovery boundary, including work that predates recent attempt windows.",
    sourceQuery: recoveries.replace(
      "VALUE",
      "COALESCE(MAX(MAX(0, ((SELECT cut FROM clock) - firstFailedAt) / 1000.0)), 0)",
    ),
  },
  {
    id: "may.failed-task-attempts-24h",
    name: "Failed Task attempts in a rolling day",
    owner: "may",
    project: "may",
    type: "gauge",
    unit: "attempts",
    measureInterval: 300_000,
    threshold: 3,
    alertOp: ">",
    description:
      "Failures among retained external App attempts started in the last day and terminal before the sample cut. Sample size is completed + failed + interrupted; inspect rate and examples before judging.",
    sourceQuery: `WITH clock AS (SELECT ${clock} AS cut), cohort AS (
      SELECT app_id, task_id, attempt_id, state, started_at FROM app_task_attempts, clock
      WHERE app_id != 'evaluation' AND started_at >= cut - 86400000 AND started_at < cut
        AND state IN ('completed', 'failed', 'interrupted')
        AND CAST(strftime('%s', json_extract(attempt_json, '$.finishedAt')) AS INTEGER) * 1000 < cut
    ) SELECT COALESCE(SUM(state = 'failed'), 0) AS value, COUNT(*) AS sampleSize,
      (SELECT cut FROM clock) AS measuredAt,
      json_object('start', (SELECT cut - 86400000 FROM clock), 'end', (SELECT cut FROM clock),
        'denominator', 'completed + failed + interrupted in the same started-at cohort',
        'failurePercent', CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(state = 'failed') / COUNT(*), 3) ELSE NULL END,
        'examples', json((SELECT json_group_array(json_object('appId', app_id, 'taskId', task_id, 'attemptId', attempt_id))
          FROM (SELECT * FROM cohort WHERE state = 'failed' ORDER BY started_at DESC, attempt_id LIMIT 3))),
        'limits', 'Retained history only. Later success does not prove recovery of the same input. Cause and quality unassessed.') AS note
    FROM cohort`,
  },
  {
    id: REVIEW_LAG_METRIC,
    name: "Oldest unfinished Evaluation review",
    owner: "may",
    project: "evaluation",
    type: "gauge",
    unit: "seconds",
    measureInterval: 300_000,
    threshold: 2 * 86400,
    alertOp: ">",
    description:
      "Age of the oldest unfinished admitted Evaluation review input. May judges overdue review; Evaluation does not assess itself. Zero means no retained unfinished review input, not complete coverage.",
    sourceQuery: `WITH pending AS (SELECT id, execution_task_id, created_at FROM app_inbox_items
      WHERE app_id = 'evaluation' AND status != 'done' AND input_kind IN ('review-metric', 'review-task-outcome', 'automatic-review'))
      SELECT COALESCE(MAX(MAX(0, (${clock} - created_at) / 1000.0)), 0) AS value, COUNT(*) AS sampleSize,
      ${clock} AS measuredAt,
      json_object('scope', 'Current unfinished review inputs, including budget waits. Admission age is not a promised deadline.',
        'examples', json((SELECT json_group_array(json_object('appId', 'evaluation', 'inputId', id, 'taskId', execution_task_id, 'createdAt', created_at))
          FROM (SELECT * FROM pending ORDER BY created_at, id LIMIT 3)))) AS note FROM pending`,
  },
];

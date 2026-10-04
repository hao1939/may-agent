import type { MetricDefinition } from "../../../lib/metrics.js";

/** Claim-time facts survive failed startup and later recovery; no execution-side counter. */
export const TASK_FAILOVER_METRIC: MetricDefinition = {
  id: "task.failover-count-24h",
  name: "Procedure-to-agent failovers (24h)",
  owner: "may-agent",
  type: "gauge",
  unit: "failovers",
  measureInterval: 300_000,
  source: "Retained first agent claims after procedure failure, [now-24h, now)",
  description:
    "Counts marked workflow/executor/CLI-to-agent switches, including interrupted startup and subsequently recovered work. Agent continuations and intentional needs-agent handoffs are excluded. sampleSize is the marked cohort, not all attempts or a success-rate denominator. Older unmarked history is unknown. No automatic alert; Apps own review policy.",
  sourceQuery: `WITH failovers AS (
    SELECT app_id, task_id, attempt_id, started_at,
      json_extract(attempt_json, '$.failoverFromAttemptId') AS from_attempt_id
    FROM app_task_attempts
    WHERE json_extract(attempt_json, '$.failoverFromAttemptId') IS NOT NULL
      AND started_at >= strftime('%s','now') * 1000 - 86400000
      AND started_at < strftime('%s','now') * 1000
  )
  SELECT COUNT(*) AS value, COUNT(*) AS sampleSize,
    strftime('%s','now') * 1000 AS measuredAt,
    json_object('scope', 'Retained marked failover claims, [now-24h, now); unmarked history unknown; not proof of recovery',
      'examples', json((SELECT json_group_array(json_object(
        'appId', app_id, 'taskId', task_id, 'attemptId', attempt_id, 'fromAttemptId', from_attempt_id))
        FROM (SELECT * FROM failovers ORDER BY started_at DESC, app_id, attempt_id LIMIT 5))),
      'examplesTruncated', COUNT(*) > 5) AS note
    FROM failovers`,
};

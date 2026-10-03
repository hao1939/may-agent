import type { AppDefinition } from "@may-agent/sdk";

export const TASK_EFFORT_METRIC = "may.max-task-recent-model-replies";
export const EVALUATION_EFFORT_METRIC =
  "may.evaluation-max-task-recent-model-replies";

// Calibration policy. Recording and routine review work before paging is enabled.
export const EFFORT_REVIEW_THRESHOLD = 99;

function sourceQuery(evaluation: boolean): string {
  return `WITH clock AS (SELECT CAST(strftime('%s','now') AS INTEGER) * 1000 AS cut),
  cohort AS (
    SELECT app_id, task_id, started_at, updated_at,
      json_extract(data, '$.totals.replies') AS replies,
      json_type(data, '$.totals.replies') AS replies_type,
      json_extract(data, '$.totals.measuredReplies') AS measured_replies,
      json_extract(data, '$.totals.estimatedCostReplies') AS priced_replies
    FROM execution_usage
    WHERE updated_at >= (SELECT cut - 3600000 FROM clock)
      AND updated_at < (SELECT cut FROM clock)
      AND ${evaluation ? "app_id = 'evaluation'" : "(app_id IS NULL OR app_id != 'evaluation')"}
  ), attributed AS (
    SELECT * FROM cohort WHERE app_id != '' AND task_id IS NOT NULL AND task_id != ''
  ), groups AS (
    SELECT app_id, task_id, SUM(replies) AS replies, COUNT(*) AS invocations,
      SUM(measured_replies) AS measured_replies, SUM(priced_replies) AS priced_replies,
      MIN(started_at) AS earliest_start, MAX(updated_at) AS last_update
    FROM attributed GROUP BY app_id, task_id
  )
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM attributed WHERE replies_type IS NULL OR replies_type != 'integer' OR replies < 0
  ) THEN NULL ELSE COALESCE(MAX(replies), 0) END AS value,
  (SELECT COUNT(*) FROM attributed) AS sampleSize,
  (SELECT cut FROM clock) AS measuredAt,
  json_object('scope', '${evaluation ? "Evaluation" : "Non-Evaluation Apps"}: observed managed invocation replies by Task',
    'start', (SELECT cut - 3600000 FROM clock), 'end', (SELECT cut FROM clock),
    'meaning', 'Whole invocation totals for usage rows updated in this hour, including unfinished invocations; not within-hour spend or proof of waste.',
    'candidateThreshold', ${EFFORT_REVIEW_THRESHOLD},
    'taskGroups', COUNT(*),
    'aboveCandidateThreshold', COALESCE(SUM(replies > ${EFFORT_REVIEW_THRESHOLD}), 0),
    'unattributedInvocations', (SELECT COUNT(*) FROM cohort) - (SELECT COUNT(*) FROM attributed),
    'groups', json((SELECT json_group_array(json_object('appId', app_id, 'taskId', task_id,
      'replies', replies, 'invocations', invocations, 'measuredReplies', measured_replies,
      'pricedReplies', priced_replies, 'earliestInvocationStart', earliest_start, 'lastUsageUpdate', last_update))
      FROM (SELECT * FROM groups ORDER BY replies DESC, app_id, task_id LIMIT 5))),
    'groupsTruncated', COUNT(*) > 5,
    'coverage', 'Managed invocation accounting only. Older Host versions omit persistent chat; native codex-goal is not covered. Missing usage/pricing is unknown; zero estimated prices do not prove free work.',
    'nextRead', 'Read the exact App/Task, accepted attempt evidence and remaining requirements. Inspect artifacts, new input and Conditions before judging effort. Aging out does not prove recovery.') AS note
FROM groups`;
}

export const effortMetrics: NonNullable<AppDefinition["metrics"]> = [
  false,
  true,
].map((evaluation) => ({
  id: evaluation ? EVALUATION_EFFORT_METRIC : TASK_EFFORT_METRIC,
  name: `${evaluation ? "Evaluation" : "External App"} maximum Task effort from recently active invocations`,
  owner: evaluation ? "evaluation" : "may",
  project: evaluation ? "evaluation" : "may",
  type: "gauge",
  unit: "observed replies",
  measureInterval: 300_000,
  // No threshold until useful-work calibration. A future policy edit enables
  // the existing breach route; collection needs no new timer or model call.
  alertOp: ">",
  description:
    "Calibration observation: maximum cumulative replies for one Task across invocation rows updated in the preceding hour. High effort invites review, not cancellation or rejection of useful partial work.",
  sourceQuery: sourceQuery(evaluation),
}));

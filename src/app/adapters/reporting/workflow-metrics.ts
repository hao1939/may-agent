import type { MetricDefinition } from "../../../lib/metrics.js";

/** Defaults for the optional source sampler, not workflow execution dependencies.
 * Counts share one retained, finished top-level cohort; no claim of Task success.
 * Nested runs have their own evidence but are not extra top-level failures.
 */
export const WORKFLOW_OUTCOMES = ["done", "error", "blocked", "interrupted"] as const;
export const WORKFLOW_OUTCOME_WINDOW_MS = 86_400_000;
export const WORKFLOW_OUTCOME_METRICS: MetricDefinition[] = WORKFLOW_OUTCOMES.map((status) => ({
  id: `workflow.${status}-count-24h`,
  name: `Workflow executions: ${status} (24h)`,
  owner: "may-agent",
  type: "gauge",
  unit: "runs",
  measureInterval: 300_000,
  source: "Retained top-level runs ending in the rolling 24 hours; not Task acceptance",
  description:
    "Count and sampleSize use the same finished cohort (done/error/blocked/interrupted). Zero sampleSize means no finished executions. Nested runs are excluded; later retries remain separate runs. No automatic alert.",
  sourceQuery: `SELECT COUNT(CASE WHEN status = '${status}' THEN 1 END) AS value,
    COUNT(*) AS sampleSize,
    strftime('%s','now') * 1000 AS measuredAt,
    'Retained top-level runs, [now-24h, now), done/error/blocked/interrupted, not Task outcomes' AS note
    FROM workflow_runs
    WHERE parentWorkflowRunId IS NULL
      AND endedAt >= (strftime('%s','now') * 1000 - ${WORKFLOW_OUTCOME_WINDOW_MS})
      AND endedAt < strftime('%s','now') * 1000
      AND status IN ('done', 'error', 'blocked', 'interrupted')`,
}));

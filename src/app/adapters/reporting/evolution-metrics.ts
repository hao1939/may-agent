import type { MetricDefinition } from "../../../lib/metrics.js";

export const EVOLUTION_MEASURE_INTERVAL_MS = 900_000; // 15 minutes
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const HOST_DISK_USED_METRIC_ID = "host.disk_used_ratio";
export const HOST_AUTH_REMAINING_METRIC_ID = "host.auth_remaining_seconds";

const UNRESOLVED_RECOVERY_SQL = `SELECT COUNT(DISTINCT i.id) AS unresolved
  FROM app_inbox_items i, json_each(COALESCE(i.recovery_json, '{}')) r
  WHERE json_extract(r.value, '$.recoveredAt') IS NULL
    AND json_extract(r.value, '$.failures') > 0
    AND ((r.key = 'input-admission' AND i.status != 'done' AND i.execution_task_id IS NULL)
      OR (r.key = 'input-result' AND i.status != 'done')
      OR (r.key = 'input-feedback' AND json_extract(i.recovery_json, '$."input-admission".reportedAt') IS NULL))`;

/**
 * Canonical Host (Agent Harness) metrics using Prometheus base units (`ratio`, `seconds`)
 * and explicit `sampleSize` denominators (`value = NULL, sampleSize = 0` -> quiet no_exposure skip).
 */
export const HOST_HARNESS_METRICS: MetricDefinition[] = [
  {
    id: "host.settlement_integrity_ratio",
    name: "Host settlement integrity (24h)",
    owner: "alex",
    type: "gauge",
    unit: "ratio",
    measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
    threshold: 0.9,
    alertOp: "<",
    priority: "P2",
    config: {
      scope: "host",
      handler: "alex",
      alert: { mode: "sustained", consecutive: 3, minSampleSize: 10 },
    },
    source: "Cleanly settled Task attempts vs. terminal attempts + unresolved input recovery boundaries (24h)",
    description:
      "Ratio [0..1] of cleanly settled Task attempts over all terminal (completed, failed, interrupted) attempts plus unresolved input recovery boundaries in the rolling 24h window. Empty exposure (0/0) skips quietly rather than recording 0 or 1.",
    sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
      att AS (
        SELECT
          COUNT(CASE WHEN state = 'completed' AND accepted_result_state IS NOT NULL THEN 1 END) AS settled,
          COUNT(CASE WHEN state IN ('completed', 'failed', 'interrupted') THEN 1 END) AS terminal
        FROM app_task_attempts, clock
        WHERE started_at >= clock.cut - ${DAY_MS} AND started_at < clock.cut
      ),
      rec AS (${UNRESOLVED_RECOVERY_SQL})
      SELECT
        CAST(att.settled AS REAL) / NULLIF(att.terminal + rec.unresolved, 0) AS value,
        att.terminal + rec.unresolved AS sampleSize,
        (SELECT cut FROM clock) AS measuredAt,
        json_object('settledAttempts', att.settled, 'terminalAttempts', att.terminal, 'unresolvedRecovery', rec.unresolved) AS note
      FROM att, rec`,
  },
  {
    id: "host.prep_p95_seconds",
    name: "Host context preparation latency p95 (24h)",
    owner: "system:host",
    type: "gauge",
    unit: "seconds",
    measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
    config: { scope: "host", alert: { disabled: true, mode: "sustained", consecutive: 3, minSampleSize: 5 } },
    source: "p95 preparation.durationMs / 1000 across execution_usage invocations (24h)",
    description:
      "95th-percentile Host prompt/tool preparation latency in seconds across recorded invocations in the rolling 24h window.",
    sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
      samples AS (
        SELECT CAST(json_extract(data, '$.preparation.durationMs') AS REAL) / 1000.0 AS prep_s
        FROM execution_usage, clock
        WHERE started_at >= clock.cut - ${DAY_MS} AND started_at < clock.cut
          AND json_type(data, '$.preparation.durationMs') IN ('integer', 'real')
          AND json_extract(data, '$.preparation.durationMs') >= 0
      ),
      counted AS (SELECT COUNT(*) AS n FROM samples),
      ordered AS (
        SELECT prep_s, ROW_NUMBER() OVER (ORDER BY prep_s ASC) AS rn
        FROM samples
      )
      SELECT
        (SELECT prep_s FROM ordered, counted WHERE counted.n > 0 AND rn = MAX(1, MIN(counted.n, CAST(counted.n * 0.95 + 0.999999 AS INTEGER))) LIMIT 1) AS value,
        counted.n AS sampleSize,
        (SELECT cut FROM clock) AS measuredAt
      FROM counted`,
  },
  {
    id: "host.cache_hit_ratio",
    name: "Host prompt cache hit ratio (24h)",
    owner: "system:host",
    type: "gauge",
    unit: "ratio",
    measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
    config: { scope: "host", alert: { disabled: true, mode: "sustained", consecutive: 3, minSampleSize: 5 } },
    source: "SUM(cacheRead) / SUM(input + cacheRead + cacheWrite) across measured invocations (24h)",
    description:
      "Prompt-cache read token share [0..1] across complete execution_usage records in the rolling 24h window. Drops indicate wait-induced cache expiry or cold context churn.",
    sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
      u AS (
        SELECT
          COUNT(*) AS n,
          SUM(COALESCE(json_extract(data, '$.totals.cacheRead'), 0)) AS cache_read,
          SUM(COALESCE(json_extract(data, '$.totals.input'), 0) + COALESCE(json_extract(data, '$.totals.cacheRead'), 0) + COALESCE(json_extract(data, '$.totals.cacheWrite'), 0)) AS exposure
        FROM execution_usage, clock
        WHERE started_at >= clock.cut - ${DAY_MS} AND started_at < clock.cut
          AND outcome IS NOT NULL
          AND json_extract(data, '$.totals.replies') > 0
          AND json_extract(data, '$.totals.measuredReplies') = json_extract(data, '$.totals.replies')
      )
      SELECT
        CASE WHEN u.exposure > 0 THEN CAST(u.cache_read AS REAL) / u.exposure ELSE NULL END AS value,
        CASE WHEN u.exposure > 0 THEN u.n ELSE 0 END AS sampleSize,
        (SELECT cut FROM clock) AS measuredAt
      FROM u`,
  },
  {
    id: "host.harness_burden_ratio",
    name: "Host harness burden / friction ratio (24h)",
    owner: "system:host",
    type: "gauge",
    unit: "ratio",
    measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
    config: { scope: "host", alert: { disabled: true, mode: "sustained", consecutive: 3, minSampleSize: 5 } },
    source: "Mechanical attempt failures/interrupts + workflow errors + unresolved recoveries over total runs (24h)",
    description:
      "Fraction [0..1] of Host execution units experiencing harness-level friction (failed/interrupted attempts, top-level workflow errors, or unresolved input recovery boundaries) in the rolling 24h window.",
    sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
      att AS (
        SELECT
          COUNT(CASE WHEN state IN ('failed', 'interrupted') THEN 1 END) AS friction,
          COUNT(*) AS total
        FROM app_task_attempts, clock
        WHERE started_at >= clock.cut - ${DAY_MS} AND started_at < clock.cut
      ),
      wf AS (
        SELECT
          COUNT(CASE WHEN status = 'error' THEN 1 END) AS errs,
          COUNT(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') THEN 1 END) AS total
        FROM workflow_runs, clock
        WHERE parentWorkflowRunId IS NULL AND endedAt >= clock.cut - ${DAY_MS} AND endedAt < clock.cut
      ),
      rec AS (${UNRESOLVED_RECOVERY_SQL})
      SELECT
        CAST(att.friction + wf.errs + rec.unresolved AS REAL) / NULLIF(att.total + wf.total + rec.unresolved, 0) AS value,
        att.total + wf.total + rec.unresolved AS sampleSize,
        (SELECT cut FROM clock) AS measuredAt,
        json_object('attemptFriction', att.friction, 'workflowErrors', wf.errs, 'unresolvedRecovery', rec.unresolved) AS note
      FROM att, wf, rec`,
  },
  {
    id: HOST_DISK_USED_METRIC_ID,
    name: "Host disk usage ratio",
    owner: "alex",
    type: "gauge",
    unit: "ratio",
    measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
    threshold: 0.92,
    alertOp: ">=",
    priority: "P1",
    config: {
      scope: "host",
      handler: "auto-hygiene → alex",
      alert: { mode: "sustained", consecutive: 2 },
    },
    source: "statfs state volume used bytes / total bytes (runs mechanical cache/worktree auto-hygiene first at >= 92%)",
    description:
      "Host state filesystem usage ratio [0..1] sampled via statfs. Triggers deterministic cache/clean-worktree auto-hygiene at >= 0.92 and alerts Alex only if sustained pressure persists.",
  },
  {
    id: HOST_AUTH_REMAINING_METRIC_ID,
    name: "Host shared Azure CLI auth remaining validity",
    owner: "may",
    type: "gauge",
    unit: "seconds",
    measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
    threshold: 0,
    alertOp: "<=",
    priority: "P2",
    config: {
      scope: "host",
      handler: "may → human (az login)",
      alert: { mode: "sustained", consecutive: 2 },
    },
    source: "Local Azure CLI MSAL token expiry timestamp minus current time (no_exposure when unconfigured)",
    description:
      "Remaining validity in seconds of local Azure CLI credentials when configured. Skips quietly when unconfigured; alerts May to request human az login when expired.",
  },
];

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Generates the 5 canonical evolution metric definitions for an enabled App (`<appId>.*`).
 * All new evolution metrics start in trend-first mode (`alert.disabled: true`) so sparklines
 * accumulate cleanly before thresholds are calibrated.
 */
export function buildAppEvolutionMetrics(appId: string, ownerAgent = appId): MetricDefinition[] {
  const sqlApp = escapeSqlLiteral(appId);
  const attemptTimeExpr = `COALESCE(CAST(unixepoch(json_extract(attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER), started_at)`;

  return [
    {
      id: `${appId}.verified_outcomes_24h`,
      name: `${appId}: verified outcomes (24h)`,
      owner: ownerAgent,
      project: appId,
      type: "gauge",
      unit: "outcomes",
      measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
      config: { alert: { disabled: true } },
      source: "Converged Task milestones + closed user Requests in rolling 24h",
      description:
        "Count of settled domain outcomes (accepted converged Task milestones plus closed user Conversation Requests) in the rolling 24h window.",
      sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
        att AS (
          SELECT
            COUNT(CASE WHEN accepted_result_state = 'converged' THEN 1 END) AS conv,
            COUNT(*) AS total
          FROM app_task_attempts, clock
          WHERE app_id = ${sqlApp} AND ${attemptTimeExpr} >= clock.cut - ${DAY_MS} AND ${attemptTimeExpr} < clock.cut
        ),
        req AS (
          SELECT COUNT(*) AS closed
          FROM conversation_requests, clock
          WHERE app_id = ${sqlApp} AND status = 'closed' AND updated_at >= clock.cut - ${DAY_MS} AND updated_at < clock.cut
        )
        SELECT
          att.conv + req.closed AS value,
          att.total + req.closed AS sampleSize,
          (SELECT cut FROM clock) AS measuredAt
        FROM att, req`,
    },
    {
      id: `${appId}.cost_per_outcome_usd_7d`,
      name: `${appId}: cost per outcome USD (7d)`,
      owner: ownerAgent,
      project: appId,
      type: "gauge",
      unit: "usd",
      measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
      config: { alert: { disabled: true } },
      source: "Priced execution_usage USD / verified outcomes in rolling 7d (unknown != $0)",
      description:
        "Price-weighted USD per verified outcome over the rolling 7d window. Unpriced executors (e.g. native CLI without token pricing) or zero-outcome windows emit no_exposure rather than $0.",
      sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
        u AS (
          SELECT
            COUNT(*) AS priced_n,
            SUM(COALESCE(json_extract(data, '$.totals.estimatedCost'), 0)) AS usd
          FROM execution_usage, clock
          WHERE app_id = ${sqlApp}
            AND started_at >= clock.cut - ${WEEK_MS} AND started_at < clock.cut
            AND outcome IS NOT NULL
            AND json_extract(data, '$.totals.replies') > 0
            AND json_extract(data, '$.totals.measuredReplies') = json_extract(data, '$.totals.replies')
            AND json_extract(data, '$.totals.estimatedCostReplies') = json_extract(data, '$.totals.replies')
        ),
        outc AS (
          SELECT
            (SELECT COUNT(*) FROM app_task_attempts, clock WHERE app_id = ${sqlApp} AND accepted_result_state = 'converged' AND ${attemptTimeExpr} >= clock.cut - ${WEEK_MS} AND ${attemptTimeExpr} < clock.cut) +
            (SELECT COUNT(*) FROM conversation_requests, clock WHERE app_id = ${sqlApp} AND status = 'closed' AND updated_at >= clock.cut - ${WEEK_MS} AND updated_at < clock.cut) AS n
        )
        SELECT
          CASE WHEN u.priced_n > 0 AND outc.n > 0 THEN CAST(u.usd AS REAL) / outc.n ELSE NULL END AS value,
          CASE WHEN u.priced_n > 0 AND outc.n > 0 THEN outc.n ELSE 0 END AS sampleSize,
          (SELECT cut FROM clock) AS measuredAt
        FROM u, outc`,
    },
    {
      id: `${appId}.spin_ratio_24h`,
      name: `${appId}: non-converging spin ratio (24h)`,
      owner: ownerAgent,
      project: appId,
      type: "gauge",
      unit: "ratio",
      measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
      config: { alert: { disabled: true, mode: "sustained", consecutive: 3, minSampleSize: 5 } },
      source: "Non-converging finished attempts / total finished attempts (24h)",
      description:
        "Fraction [0..1] of finished Task attempts in the rolling 24h window that did not converge (waiting, incomplete, failed, or interrupted). Lower means more direct execution paths.",
      sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
        att AS (
          SELECT
            COUNT(CASE WHEN COALESCE(accepted_result_state, '') != 'converged' THEN 1 END) AS non_conv,
            COUNT(*) AS total
          FROM app_task_attempts, clock
          WHERE app_id = ${sqlApp}
            AND state != 'running'
            AND ${attemptTimeExpr} >= clock.cut - ${DAY_MS} AND ${attemptTimeExpr} < clock.cut
        )
        SELECT
          CAST(att.non_conv AS REAL) / NULLIF(att.total, 0) AS value,
          att.total AS sampleSize,
          (SELECT cut FROM clock) AS measuredAt
        FROM att`,
    },
    {
      id: `${appId}.workflow_offload_ratio_24h`,
      name: `${appId}: deterministic workflow offload ratio (24h)`,
      owner: ownerAgent,
      project: appId,
      type: "gauge",
      unit: "ratio",
      measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
      config: { alert: { disabled: true } },
      source: "Successful top-level workflow runs / (workflow runs + agent/task runs) (24h)",
      description:
        "Share [0..1] of execution volume handled by successful deterministic top-level workflows in the rolling 24h window.",
      sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
        wf AS (
          SELECT
            COUNT(CASE WHEN status = 'done' THEN 1 END) AS done_wf,
            COUNT(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') THEN 1 END) AS total_wf
          FROM workflow_runs, clock
          WHERE parentWorkflowRunId IS NULL AND app_id = ${sqlApp}
            AND endedAt >= clock.cut - ${DAY_MS} AND endedAt < clock.cut
        ),
        usage_agent AS (
          SELECT COUNT(*) AS n
          FROM execution_usage, clock
          WHERE app_id = ${sqlApp}
            AND workflow_run_id IS NULL
            AND started_at >= clock.cut - ${DAY_MS} AND started_at < clock.cut
        ),
        att AS (
          SELECT COUNT(*) AS total_att
          FROM app_task_attempts a, clock
          WHERE a.app_id = ${sqlApp}
            AND COALESCE(json_extract(a.attempt_json, '$.handler'), '') NOT LIKE 'workflow:%'
            AND ${attemptTimeExpr} >= clock.cut - ${DAY_MS} AND ${attemptTimeExpr} < clock.cut
            AND NOT EXISTS (
              SELECT 1 FROM execution_usage u
              WHERE u.app_id = a.app_id
                AND (u.attempt_id = a.attempt_id OR u.session_id = json_extract(a.attempt_json, '$.sessionId'))
            )
        )
        SELECT
          CAST(wf.done_wf AS REAL) / NULLIF(wf.total_wf + usage_agent.n + att.total_att, 0) AS value,
          wf.total_wf + usage_agent.n + att.total_att AS sampleSize,
          (SELECT cut FROM clock) AS measuredAt
        FROM wf, usage_agent, att`,
    },
    {
      id: `${appId}.autonomy_ratio_7d`,
      name: `${appId}: autonomous delivery ratio (7d)`,
      owner: ownerAgent,
      project: appId,
      type: "gauge",
      unit: "ratio",
      measureInterval: EVOLUTION_MEASURE_INTERVAL_MS,
      config: { alert: { disabled: true } },
      source: "Verified outcomes / (verified outcomes + human inbox inputs) in rolling 7d",
      description:
        "Bounded ratio [0..1] of verified outcomes to (verified outcomes + human inputs) over 7d. 1.0 indicates 100% autonomous delivery with zero human touches; 0/0 emits no_exposure.",
      sourceQuery: `WITH clock AS (SELECT CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER) AS cut),
        outc AS (
          SELECT
            (SELECT COUNT(*) FROM app_task_attempts, clock WHERE app_id = ${sqlApp} AND accepted_result_state = 'converged' AND ${attemptTimeExpr} >= clock.cut - ${WEEK_MS} AND ${attemptTimeExpr} < clock.cut) +
            (SELECT COUNT(*) FROM conversation_requests, clock WHERE app_id = ${sqlApp} AND status = 'closed' AND updated_at >= clock.cut - ${WEEK_MS} AND updated_at < clock.cut) AS n
        ),
        hum AS (
          SELECT COUNT(*) AS touches
          FROM app_inbox_items, clock
          WHERE app_id = ${sqlApp} AND source_kind = 'human' AND created_at >= clock.cut - ${WEEK_MS} AND created_at < clock.cut
        )
        SELECT
          CAST(outc.n AS REAL) / NULLIF(outc.n + hum.touches, 0) AS value,
          outc.n + hum.touches AS sampleSize,
          (SELECT cut FROM clock) AS measuredAt
        FROM outc, hum`,
    },
  ];
}

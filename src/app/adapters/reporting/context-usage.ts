import type { SqliteDb } from "../../../lib/db.js";
import { healthWindow, HEALTH_GROUP_LIMIT, HEALTH_RUN_LIMIT } from "./workflow-health.js";

export function contextUsageQuery(params: URLSearchParams, now = Date.now()) {
  const identity: Record<string, string> = {};
  for (const key of ["appId", "agent", "preparer", "entryHash", "models", "workflowRunId", "taskId"]) {
    const value = params.get(key);
    if (value !== null) {
      if (value.length > 2000) throw new Error("Usage filter is too long");
      identity[key] = value;
    }
  }
  return { ...healthWindow(params, now), identity };
}

/** Indexed invocation cohort, never a scan of transcript files. */
export function readContextUsage(db: SqliteDb, query: ReturnType<typeof contextUsageQuery>, now = Date.now()) {
  const predicates = ["started_at >= ?", "started_at < ?"];
  const bindings: Array<string | number> = [query.start, query.end];
  for (const [key, column] of Object.entries({
    appId: "app_id",
    agent: "agent",
    preparer: "preparer",
    entryHash: "entry_hash",
    models: "models",
    workflowRunId: "workflow_run_id",
    taskId: "task_id",
  })) {
    if (Object.hasOwn(query.identity, key)) {
      predicates.push(`COALESCE(${column}, '') = ?`);
      bindings.push(query.identity[key]!);
    }
  }
  const where = predicates.join(" AND ");
  const measured = "json_extract(data, '$.totals.measuredReplies')";
  const replies = "json_extract(data, '$.totals.replies')";
  const complete = `outcome IS NOT NULL AND ${replies} > 0 AND ${measured} = ${replies}`;
  const average = (key: string) => `AVG(CASE WHEN ${complete} THEN json_extract(data, '$.totals.${key}') END)`;
  const sum = (key: string) => `SUM(json_extract(data, '$.totals.${key}'))`;
  db.exec("SAVEPOINT context_usage_read");
  try {
    const groups = db
      .prepare(
        `SELECT app_id AS appId, agent, preparer, entry_hash AS entryHash,
      models, configured_model AS configuredModel, COALESCE(outcome, 'unfinished') AS outcome,
      COUNT(*) AS invocations, COUNT(CASE WHEN ${complete} THEN 1 END) AS measuredInvocations,
      ${sum("replies")} AS replies, ${sum("measuredReplies")} AS measuredReplies,
      ${sum("estimatedCostReplies")} AS estimatedCostReplies,
      ${sum("input")} AS input, ${sum("cacheRead")} AS cacheRead, ${sum("cacheWrite")} AS cacheWrite,
      ${sum("input")} + ${sum("cacheRead")} + ${sum("cacheWrite")} AS inputExposure,
      ${sum("output")} AS output, ${sum("estimatedCost")} AS estimatedCost,
      ${average("input")} AS meanInput, ${average("cacheRead")} AS meanCacheRead,
      ${average("cacheWrite")} AS meanCacheWrite, ${average("output")} AS meanOutput,
      ${average("input")} + ${average("cacheRead")} + ${average("cacheWrite")} AS meanInputExposure,
      COUNT(CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = ${replies} THEN 1 END) AS pricedInvocations,
      AVG(CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = ${replies}
        THEN json_extract(data, '$.totals.estimatedCost') END) AS meanEstimatedCost,
      AVG(CASE WHEN ${complete} THEN ${replies} END) AS meanReplies,
      AVG(CASE WHEN ${complete} THEN json_extract(data, '$.toolCalls') END) AS meanToolCalls,
      AVG(CASE WHEN ${complete} THEN duration_ms END) AS meanDurationMs,
      AVG(json_extract(data, '$.preparation.durationMs')) AS meanPreparationMs,
      AVG(json_extract(data, '$.preparation.taskBytes')) AS meanTaskBytes,
      AVG(json_extract(data, '$.preparation.promptBytes')) AS meanPromptBytes
      FROM execution_usage WHERE ${where}
      GROUP BY app_id, agent, preparer, entry_hash, models, configured_model, outcome
      ORDER BY invocations DESC, app_id, agent, preparer, entry_hash, models, configured_model, outcome LIMIT ?`,
      )
      .all(...bindings, HEALTH_GROUP_LIMIT + 1);
    const invocations = db
      .prepare(`SELECT COUNT(*) AS count FROM execution_usage WHERE ${where}`)
      .get(...bindings)!.count;
    const runs = db
      .prepare(
        `SELECT id, session_id AS sessionId, workflow_run_id AS workflowRunId,
      EXISTS(SELECT 1 FROM sessions s WHERE s.sessionId = execution_usage.session_id) AS sessionAvailable,
      EXISTS(SELECT 1 FROM workflow_runs w WHERE w.runId = execution_usage.workflow_run_id) AS workflowAvailable,
      task_id AS taskId, app_id AS appId, agent, preparer, entry_hash AS entryHash, configured_model AS configuredModel,
      started_at AS startedAt, updated_at AS updatedAt, outcome, duration_ms AS durationMs, data
      FROM execution_usage WHERE ${where} ORDER BY started_at DESC, id DESC LIMIT ?`,
      )
      .all(...bindings, HEALTH_RUN_LIMIT + 1);
    const result = {
      generatedAt: now,
      window: { start: query.start, end: query.end },
      identity: query.identity,
      invocations,
      groups: groups.slice(0, HEALTH_GROUP_LIMIT).map((row) => ({ ...row, models: JSON.parse(row.models as string) })),
      groupsTruncated: groups.length > HEALTH_GROUP_LIMIT,
      runs: runs.slice(0, HEALTH_RUN_LIMIT).map(({ data, ...row }) => ({ ...row, usage: JSON.parse(data as string) })),
      runsTruncated: runs.length > HEALTH_RUN_LIMIT,
    };
    db.exec("RELEASE context_usage_read");
    return result;
  } catch (error) {
    db.exec("ROLLBACK TO context_usage_read");
    db.exec("RELEASE context_usage_read");
    throw error;
  }
}

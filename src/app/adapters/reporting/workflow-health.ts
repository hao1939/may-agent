import type { SqliteDb } from "../../../lib/db.js";
import { WORKFLOW_OUTCOMES } from "./workflow-metrics.js";

const DAY_MS = 86_400_000;
// Interactive reads, not an unlimited audit/export. Time-range indexes bound scans.
export const HEALTH_MAX_DAYS = 90;
export const HEALTH_GROUP_LIMIT = 100;
export const HEALTH_RUN_LIMIT = 50;
type Outcome = (typeof WORKFLOW_OUTCOMES)[number];

export function healthWindow(params: URLSearchParams, now = Date.now()) {
  const end = params.has("end") ? Number(params.get("end")) : now;
  const days = params.has("days") ? Number(params.get("days")) : 1;
  const start = params.has("start") ? Number(params.get("start")) : end - days * DAY_MS;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > now ||
    end - start > HEALTH_MAX_DAYS * DAY_MS
  ) {
    throw new Error(`Choose a past time window of at most ${HEALTH_MAX_DAYS} days`);
  }
  return { start, end };
}

export function workflowHealthQuery(params: URLSearchParams, now = Date.now()) {
  const scope = params.get("scope") ?? "top-level";
  if (scope !== "top-level" && scope !== "all") throw new Error("Invalid workflow scope");
  const outcome = params.get("outcome");
  if (outcome !== null && !WORKFLOW_OUTCOMES.includes(outcome as Outcome)) throw new Error("Invalid workflow outcome");
  const before = params.has("before") ? Number(params.get("before")) : null;
  const beforeId = params.get("beforeId");
  if ((before !== null || beforeId !== null) && (!Number.isSafeInteger(before) || !beforeId))
    throw new Error("Invalid run cursor");
  const identity: Record<string, string> = {};
  for (const key of ["appId", "workflow", "sourcePath", "sourceScope"]) {
    const value = params.get(key);
    if (value !== null) {
      if (value.length > 2_000) throw new Error("Workflow filter is too long");
      identity[key] = value;
    }
  }
  return {
    ...healthWindow(params, now),
    scope,
    identity,
    outcome,
    before,
    beforeId,
    runs: params.get("runs") === "true",
  };
}

type Query = ReturnType<typeof workflowHealthQuery>;
type Totals = {
  finished: number;
  done: number;
  error: number;
  blocked: number;
  interrupted: number;
  durationCount: number;
  meanDurationMs: number | null;
  maxDurationMs: number | null;
  unknownOutcomes: number;
};
type Group = Totals & { appId: string; workflow: string; sourcePath: string; sourceScope: string | null };
type Run = {
  runId: string;
  appId: string | null;
  workflow: string;
  status: string;
  startedAt: number;
  endedAt: number;
  durationMs: number | null;
  reason: string | null;
};
const FINISHED = "status IN ('done', 'error', 'blocked', 'interrupted')";
const DURATION = `CASE WHEN ${FINISHED} AND startedAt >= 0 AND endedAt >= startedAt THEN endedAt - startedAt END`;
const TOTALS = `COUNT(CASE WHEN ${FINISHED} THEN 1 END) AS finished,
  COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
  COUNT(CASE WHEN status = 'error' THEN 1 END) AS error,
  COUNT(CASE WHEN status = 'blocked' THEN 1 END) AS blocked,
  COUNT(CASE WHEN status = 'interrupted' THEN 1 END) AS interrupted,
  COUNT(${DURATION}) AS durationCount, AVG(${DURATION}) AS meanDurationMs, MAX(${DURATION}) AS maxDurationMs,
  COUNT(CASE WHEN status IS NULL OR NOT (${FINISHED}) THEN 1 END) AS unknownOutcomes`;

/** Observations of retained rows only. No collector, write, or execution dependency. */
export function readWorkflowHealth(db: SqliteDb, query: Query, now = Date.now()) {
  const predicates = query.scope === "top-level" ? ["parentWorkflowRunId IS NULL"] : [];
  const bindings: Array<string | number> = [];
  for (const [key, column] of [
    ["appId", "app_id"],
    ["workflow", "workflow"],
    ["sourcePath", "sourcePath"],
    ["sourceScope", "sourceScope"],
  ]) {
    if (Object.hasOwn(query.identity, key!)) {
      predicates.push(`COALESCE(${column}, '') = ?`);
      bindings.push(query.identity[key!]!);
    }
  }
  const identity = predicates.length ? predicates.join(" AND ") : "1 = 1";
  const cohort = `${identity} AND endedAt >= ? AND endedAt < ?`;
  const values = [...bindings, query.start, query.end];
  // A read savepoint shares one SQLite snapshot without reserving the writer.
  db.exec("SAVEPOINT workflow_health_read");
  try {
    const totals = db.prepare(`SELECT ${TOTALS} FROM workflow_runs WHERE ${cohort}`).get(...values) as Totals;
    const groups = db
      .prepare(
        `SELECT COALESCE(app_id, '') AS appId, workflow, COALESCE(sourcePath, '') AS sourcePath,
      sourceScope, ${TOTALS} FROM workflow_runs WHERE ${cohort}
      GROUP BY COALESCE(app_id, ''), workflow, COALESCE(sourcePath, ''), COALESCE(sourceScope, '') ORDER BY error DESC, finished DESC, appId, workflow, sourcePath, sourceScope
      LIMIT ?`,
      )
      .all(...values, HEALTH_GROUP_LIMIT + 1) as Group[];
    const running = (
      db
        .prepare(`SELECT COUNT(*) AS count FROM workflow_runs WHERE ${identity} AND status = 'running'`)
        .get(...bindings) as { count: number }
    ).count;
    const undated = (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM workflow_runs WHERE ${identity} AND ${FINISHED}
      AND endedAt IS NULL AND startedAt >= ? AND startedAt < ?`,
        )
        .get(...values) as { count: number }
    ).count;
    const runPredicates = [cohort, FINISHED];
    const runValues = [...values];
    // Without explicit detail selection, show recent execution errors only.
    const selectedOutcome = query.runs ? query.outcome : "error";
    if (selectedOutcome) {
      runPredicates.push("status = ?");
      runValues.push(selectedOutcome);
    }
    const matchingRuns = selectedOutcome ? totals[selectedOutcome as Outcome] : totals.finished;
    if (query.runs && query.before !== null) {
      runPredicates.push("(endedAt < ? OR (endedAt = ? AND runId < ?))");
      runValues.push(query.before, query.before, query.beforeId!);
    }
    const limit = query.runs ? HEALTH_RUN_LIMIT : 5;
    const candidates = db
      .prepare(
        `SELECT runId, app_id AS appId, workflow, status, startedAt, endedAt,
      ${DURATION} AS durationMs, substr(result_reason, 1, 500) AS reason
      FROM workflow_runs WHERE ${runPredicates.join(" AND ")} ORDER BY endedAt DESC, runId DESC LIMIT ?`,
      )
      .all(...runValues, limit + 1) as Run[];
    const runs = candidates.slice(0, limit);
    const last = runs.at(-1);
    db.exec("RELEASE workflow_health_read");
    return {
      generatedAt: now,
      window: { start: query.start, end: query.end },
      scope: query.scope,
      identity: query.identity,
      totals: { ...totals, successRate: totals.finished ? totals.done / totals.finished : null },
      running,
      groups: groups
        .slice(0, HEALTH_GROUP_LIMIT)
        .map((group) => ({ ...group, successRate: group.finished ? group.done / group.finished : null })),
      groupsTruncated: groups.length > HEALTH_GROUP_LIMIT,
      runs,
      matchingRuns,
      outcome: selectedOutcome,
      next: candidates.length > limit && last ? { before: last.endedAt, beforeId: last.runId } : null,
      coverage: { undatedFinishedStartedInWindow: undated, retainedOnly: true },
    };
  } catch (error) {
    db.exec("ROLLBACK TO workflow_health_read");
    db.exec("RELEASE workflow_health_read");
    throw error;
  }
}

import type { SqliteDb } from "../../../lib/db.js";

const DAY = 86_400_000;
const EXAMPLES = 12;
const GROUPS = 20;

/** Read one exact attempt, or two adjacent started-at cohorts in one App. */
export function taskAttemptsQuery(params: URLSearchParams, now = Date.now()) {
  const appId = params.get("appId")?.trim();
  if (!appId) throw new Error("appId is required");
  const taskId = params.get("taskId")?.trim() || undefined;
  const attemptId = params.get("attemptId")?.trim();
  if (attemptId) {
    if (!taskId) throw new Error("taskId is required for an exact attempt");
    return { appId, taskId, attemptId };
  }
  const end = Number(params.get("end"));
  const windowMs = params.has("windowMs") ? Number(params.get("windowMs")) : DAY;
  if (
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    windowMs > 7 * DAY ||
    end > now ||
    end < 2 * windowMs
  )
    throw new Error("Choose a past cut and adjacent windows of at most seven days each");
  return { appId, taskId, end, windowMs };
}

type Attempt = {
  appId: string;
  taskId: string;
  attemptId: string;
  generation: number;
  handler: string;
  state: string;
  startedAt: string;
  finishedAt: string | null;
  failureReason: string | null;
  summary: string | null;
  sessionId: string | null;
};
const PROJECTION = `app_id AS appId, task_id AS taskId, attempt_id AS attemptId,
  task_generation AS generation, state,
  json_extract(attempt_json, '$.handler') AS handler,
  json_extract(attempt_json, '$.startedAt') AS startedAt,
  json_extract(attempt_json, '$.finishedAt') AS finishedAt,
  json_extract(attempt_json, '$.failureReason') AS failureReason,
  substr(json_extract(attempt_json, '$.summary'), 1, 800) AS summary,
  json_extract(attempt_json, '$.sessionId') AS sessionId`;

function counts(rows: Attempt[], cut: number) {
  const terminal = rows.filter(
    (a) => a.finishedAt && Date.parse(a.finishedAt) < cut && ["completed", "failed", "interrupted"].includes(a.state),
  );
  const failed = terminal.filter((a) => a.state === "failed");
  const durations = failed.map((a) => Date.parse(a.finishedAt!) - Date.parse(a.startedAt));
  const validDurations = durations.filter((ms) => Number.isFinite(ms) && ms >= 0);
  const undatedTerminal = rows.filter(
    (a) =>
      ["completed", "failed", "interrupted"].includes(a.state) &&
      (!a.finishedAt || !Number.isFinite(Date.parse(a.finishedAt))),
  ).length;
  return {
    started: rows.length,
    terminal: terminal.length,
    completed: terminal.filter((a) => a.state === "completed").length,
    failed: failed.length,
    interrupted: terminal.filter((a) => a.state === "interrupted").length,
    nonterminalAtCut: rows.length - terminal.length - undatedTerminal,
    undatedTerminal,
    failedTaskCount: new Set(failed.map((a) => a.taskId)).size,
    failurePercent: terminal.length ? Math.round((failed.length * 100_000) / terminal.length) / 1_000 : null,
    failedWallMs: failed.length && !validDurations.length ? null : validDurations.reduce((sum, ms) => sum + ms, 0),
    failedDurationMeasured: validDurations.length,
    failedDurationUnknown: failed.length - validDurations.length,
  };
}

function cohort(rows: Attempt[], start: number, end: number, taskId?: string) {
  const selected = rows.filter((a) => Date.parse(a.startedAt) >= start && Date.parse(a.startedAt) < end);
  const failures = selected.filter((a) => a.state === "failed" && a.finishedAt && Date.parse(a.finishedAt) < end);
  const handlers = [...new Set(selected.map((a) => a.handler))].sort();
  const reasons = [...new Set(failures.map((a) => a.failureReason))];
  const byFailureReason = reasons
    .map((reason) => {
      const items = failures.filter((a) => a.failureReason === reason);
      return {
        reason,
        count: items.length,
        affectedTasks: new Set(items.map((a) => a.taskId)).size,
        firstAt: items[items.length - 1]!.startedAt,
        lastAt: items[0]!.startedAt,
        examples: items.slice(0, 3),
      };
    })
    .sort((a, b) => b.count - a.count || String(a.reason).localeCompare(String(b.reason)));
  return {
    start,
    end,
    totals: counts(selected, end),
    ...(taskId
      ? {
          task: counts(
            selected.filter((a) => a.taskId === taskId),
            end,
          ),
          otherTasks: counts(
            selected.filter((a) => a.taskId !== taskId),
            end,
          ),
        }
      : {}),
    byHandler: handlers.slice(0, GROUPS).map((handler) => ({
      handler,
      ...counts(
        selected.filter((a) => a.handler === handler),
        end,
      ),
    })),
    byFailureReason: byFailureReason.slice(0, GROUPS),
    groupsTruncated: handlers.length > GROUPS || reasons.length > GROUPS,
    // Include ordinary work even when every failure has since recovered.
    examples: [
      ...failures.slice(0, EXAMPLES / 2),
      ...selected.filter((a) => a.state !== "failed").slice(0, EXAMPLES / 2),
    ],
  };
}

export function readTaskAttempts(db: SqliteDb, query: ReturnType<typeof taskAttemptsQuery>) {
  db.exec("SAVEPOINT task_attempt_report");
  try {
    if (query.attemptId) {
      const attempt = db
        .prepare(
          `SELECT ${PROJECTION} FROM app_task_attempts
        WHERE app_id = ? AND task_id = ? AND attempt_id = ?`,
        )
        .get(query.appId, query.taskId!, query.attemptId) as Attempt | null;
      if (!attempt)
        return { version: 1, available: false, appId: query.appId, taskId: query.taskId, attemptId: query.attemptId };
      const sessions = db
        .prepare(
          `SELECT sessionId, agent, status FROM sessions
        WHERE app_id = ? AND task_id = ? AND task_generation = ? AND attempt_id = ? ORDER BY sessionId LIMIT 7`,
        )
        .all(query.appId, query.taskId!, attempt.generation, query.attemptId);
      const workflows = db
        .prepare(
          `SELECT runId, workflow, status, parentWorkflowRunId FROM workflow_runs
        WHERE app_id = ? AND task_id = ? AND task_generation = ? AND attempt_id = ? ORDER BY runId LIMIT 7`,
        )
        .all(query.appId, query.taskId!, attempt.generation, query.attemptId);
      return {
        version: 1,
        available: true,
        ...attempt,
        sessions: sessions.slice(0, 6),
        workflows: workflows.slice(0, 6),
        executionsTruncated: sessions.length > 6 || workflows.length > 6,
      };
    }
    const end = query.end!;
    const windowMs = query.windowMs!;
    const rows = db
      .prepare(
        `SELECT ${PROJECTION} FROM app_task_attempts
      WHERE app_id = ? AND started_at >= ? AND started_at < ? ORDER BY started_at DESC, attempt_id DESC`,
      )
      .all(query.appId, end - 2 * windowMs, end) as Attempt[];
    return {
      version: 1,
      available: true,
      appId: query.appId,
      taskId: query.taskId ?? null,
      end,
      windowMs,
      population:
        "Task attempts started in [start,end); terminal only if finished before that window's cut. Nested executions are links, not additional attempts.",
      denominator: "terminal = completed + failed + interrupted; failed is a subset",
      previous: cohort(rows, end - 2 * windowMs, end - windowMs, query.taskId),
      current: cohort(rows, end - windowMs, end, query.taskId),
      limits: { groups: GROUPS, examples: EXAMPLES, summaryChars: 800 },
      unknowns: [
        "Cause, avoidability, billing and output quality are not established by attempt counters.",
        "Later success on the same Task does not establish recovery of the same input.",
        "Work started before these cohorts is outside this report. Deleted or previously archived records are outside retained history.",
      ],
    };
  } finally {
    db.exec("RELEASE task_attempt_report");
  }
}

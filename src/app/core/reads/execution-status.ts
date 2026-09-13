import { getDb } from "../../../lib/db/connection.js";
import { readActiveSessionProcessId } from "../../../lib/persistence.js";

/** Current execution facts; interfaces choose their own presentation. */
export type ExecutionSession = {
  agent: string;
  sessionId: string;
  status: string;
  kind: string;
  task: string;
  startedAt?: number;
};
export type ExecutionStatus = { sessions: ExecutionSession[]; activeWork: boolean };

/** Current execution authority across processes; never scan historical session directories. */
export function readExecutionStatus(persistDir: string, now = Date.now()): ExecutionStatus {
  const db = getDb(persistDir);
  const candidates = db
    .prepare(
      `
    SELECT s.agent, s.sessionId, s.status, COALESCE(s.kind, '') AS kind,
           substr(s.task, 1, 100) AS task, s.startedAt
    FROM sessions s
    LEFT JOIN app_tasks t ON t.app_id = s.app_id AND t.task_id = s.task_id
    WHERE s.status IN ('running', 'idle') AND s.endedAt IS NULL
      AND ((s.app_id IS NULL AND s.task_id IS NULL AND s.attempt_id IS NULL)
        OR (t.phase = 'running' AND t.generation = s.task_generation
          AND t.current_attempt_id = s.attempt_id))
    ORDER BY s.startedAt, s.sessionId
  `,
    )
    .all() as Array<ExecutionSession & Record<string, unknown>>;
  const sessions = candidates.filter((session) => readActiveSessionProcessId(persistDir, session.sessionId) !== null);
  // A workflow can own a current attempt without any agent session. Fresh
  // leases protect that work until completion or ordinary crash recovery.
  const claim = db
    .prepare(
      `
    SELECT 1 FROM app_tasks t
    JOIN app_task_attempts a ON a.app_id = t.app_id AND a.attempt_id = t.current_attempt_id
      AND a.task_id = t.task_id AND a.task_generation = t.generation
    WHERE t.phase = 'running' AND a.state = 'running' AND a.lease_until > ?
    LIMIT 1
  `,
    )
    .get(now);
  return { sessions, activeWork: sessions.some((session) => session.status === "running") || Boolean(claim) };
}

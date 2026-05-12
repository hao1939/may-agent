import { getDb } from "./connection.js";

export interface SessionDbEntry {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  kind?: string;
  source?: string;
  parentSessionId?: string;
  requestId?: string;
  workflowRunId?: string;
  projectId?: string;
  stepLabel?: string;
  startedAt: number;
  endedAt?: number;
  error?: string;
  outcome?: string;
  opCount?: number;
}

/** Insert or update a session row without erasing existing lineage fields. */
export function upsertSession(persistDir: string, entry: SessionDbEntry): void {
  const db = getDb(persistDir);
  db.run(
    `INSERT INTO sessions
      (sessionId, agent, task, status, kind, source, parentSessionId, requestId, workflowRunId, projectId, stepLabel, startedAt, endedAt, error, outcome, opCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sessionId) DO UPDATE SET
       agent = excluded.agent,
       task = CASE WHEN excluded.task != '' THEN excluded.task ELSE sessions.task END,
       status = excluded.status,
       kind = COALESCE(excluded.kind, sessions.kind),
       source = COALESCE(excluded.source, sessions.source),
       parentSessionId = COALESCE(excluded.parentSessionId, sessions.parentSessionId),
       requestId = COALESCE(excluded.requestId, sessions.requestId),
       workflowRunId = COALESCE(excluded.workflowRunId, sessions.workflowRunId),
       projectId = COALESCE(excluded.projectId, sessions.projectId),
       stepLabel = COALESCE(excluded.stepLabel, sessions.stepLabel),
       startedAt = COALESCE(excluded.startedAt, sessions.startedAt),
       endedAt = COALESCE(excluded.endedAt, sessions.endedAt),
       error = COALESCE(excluded.error, sessions.error),
       outcome = COALESCE(excluded.outcome, sessions.outcome),
       opCount = CASE WHEN excluded.opCount > sessions.opCount THEN excluded.opCount ELSE sessions.opCount END`,
    [
      entry.sessionId,
      entry.agent,
      entry.task ?? "",
      entry.status,
      entry.kind ?? "job",
      entry.source ?? null,
      entry.parentSessionId ?? null,
      entry.requestId ?? null,
      entry.workflowRunId ?? null,
      entry.projectId ?? null,
      entry.stepLabel ?? null,
      entry.startedAt,
      entry.endedAt ?? null,
      entry.error ?? null,
      entry.outcome ?? null,
      entry.opCount ?? 0,
    ],
  );
}

/** Update session status fields only (for updateSessionStatus calls). */
export function updateSessionDb(
  persistDir: string,
  sessionId: string,
  fields: {
    status: string;
    endedAt?: number;
    error?: string;
    outcome?: string;
    opCount?: number;
  },
): void {
  const db = getDb(persistDir);
  // Use COALESCE for opCount so a later update without opCount doesn't overwrite
  // a previous write that set it correctly. This prevents the race where manager
  // sets opCount=15 and then DbWriter overwrites it with 0.
  db.run(`UPDATE sessions SET status = ?, endedAt = COALESCE(?, endedAt), error = ?, outcome = COALESCE(?, outcome), opCount = CASE WHEN ? > opCount THEN ? ELSE opCount END WHERE sessionId = ?`, [
    fields.status,
    fields.endedAt ?? null,
    fields.error ?? null,
    fields.outcome ?? null,
    fields.opCount ?? 0,
    fields.opCount ?? 0,
    sessionId,
  ]);
}

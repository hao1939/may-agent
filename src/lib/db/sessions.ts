import { getDb } from "./connection.js";
import { withSqliteBusyRetry } from "./busy-retry.js";
import { describeText, sessionMetaRef, type ArtifactDescriptor } from "../artifacts.js";

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
  lastActivityAt?: number;
}

/** SQL keeps a human-readable preview; meta.json owns the full task. */
const MAX_TASK_PREVIEW_LENGTH = 2_000;

function taskPreview(task: string): string {
  if (task.length <= MAX_TASK_PREVIEW_LENGTH) return task;
  return `${task.slice(0, MAX_TASK_PREVIEW_LENGTH)}\n...[full task in session meta; ${task.length} chars]`;
}

/** Insert or update a session row without erasing existing lineage fields. */
export function upsertSession(persistDir: string, entry: SessionDbEntry): void {
  const db = getDb(persistDir);
  const task = entry.task ?? "";
  const taskArtifact = describeText(sessionMetaRef(entry.sessionId), task);
  withSqliteBusyRetry(`upsert session ${entry.sessionId}`, () =>
    db.run(
      `INSERT INTO sessions
        (sessionId, agent, task, task_ref, task_sha256, task_bytes, status, kind, source, parentSessionId, requestId, workflowRunId, projectId, stepLabel, startedAt, endedAt, error, outcome, opCount, lastActivityAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sessionId) DO UPDATE SET
         agent = excluded.agent,
         task = CASE WHEN excluded.task != '' THEN excluded.task ELSE sessions.task END,
         task_ref = COALESCE(excluded.task_ref, sessions.task_ref),
         task_sha256 = CASE WHEN excluded.task != '' THEN excluded.task_sha256 ELSE sessions.task_sha256 END,
         task_bytes = CASE WHEN excluded.task != '' THEN excluded.task_bytes ELSE sessions.task_bytes END,
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
         opCount = CASE WHEN excluded.opCount > sessions.opCount THEN excluded.opCount ELSE sessions.opCount END,
         lastActivityAt = CASE
           WHEN excluded.lastActivityAt IS NULL THEN sessions.lastActivityAt
           WHEN sessions.lastActivityAt IS NULL THEN excluded.lastActivityAt
           WHEN excluded.lastActivityAt > sessions.lastActivityAt THEN excluded.lastActivityAt
           ELSE sessions.lastActivityAt
         END`,
      [
        entry.sessionId,
        entry.agent,
        taskPreview(task),
        taskArtifact.ref,
        taskArtifact.sha256,
        taskArtifact.bytes,
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
        entry.lastActivityAt ?? entry.startedAt,
      ],
    ),
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
    lastActivityAt?: number;
    resultArtifact?: ArtifactDescriptor;
  },
): void {
  const db = getDb(persistDir);
  // Use COALESCE for opCount so a later update without opCount doesn't overwrite
  // a previous write that set it correctly. This prevents the race where manager
  // sets opCount=15 and then DbWriter overwrites it with 0.
  withSqliteBusyRetry(`update session ${sessionId}`, () =>
    db.run(
      `UPDATE sessions SET
        status = ?,
        endedAt = COALESCE(?, endedAt),
        error = COALESCE(?, error),
        outcome = COALESCE(?, outcome),
        result_ref = COALESCE(?, result_ref),
        result_sha256 = COALESCE(?, result_sha256),
        result_bytes = COALESCE(?, result_bytes),
        opCount = CASE WHEN ? > opCount THEN ? ELSE opCount END,
        lastActivityAt = CASE
          WHEN ? IS NULL THEN lastActivityAt
          WHEN lastActivityAt IS NULL THEN ?
          WHEN ? > lastActivityAt THEN ?
          ELSE lastActivityAt
        END
      WHERE sessionId = ?`,
      [
        fields.status,
        fields.endedAt ?? null,
        fields.error ?? null,
        fields.outcome ?? null,
        fields.resultArtifact?.ref ?? null,
        fields.resultArtifact?.sha256 ?? null,
        fields.resultArtifact?.bytes ?? null,
        fields.opCount ?? 0,
        fields.opCount ?? 0,
        fields.lastActivityAt ?? null,
        fields.lastActivityAt ?? null,
        fields.lastActivityAt ?? null,
        fields.lastActivityAt ?? null,
        sessionId,
      ],
    ),
  );
}

/** Persist live progress for running sessions without changing terminal status. */
export function updateSessionProgress(
  persistDir: string,
  sessionId: string,
  fields: {
    opCount?: number;
    lastActivityAt?: number;
  },
): void {
  const db = getDb(persistDir);
  const activityAt = fields.lastActivityAt ?? Date.now();
  db.run(
    `UPDATE sessions SET
      opCount = CASE WHEN ? > opCount THEN ? ELSE opCount END,
      lastActivityAt = CASE
        WHEN lastActivityAt IS NULL THEN ?
        WHEN ? > lastActivityAt THEN ?
        ELSE lastActivityAt
      END
    WHERE sessionId = ?`,
    [fields.opCount ?? 0, fields.opCount ?? 0, activityAt, activityAt, activityAt, sessionId],
  );
}

/** Read durable session liveness without loading session artifacts. */
export function readSessionLastActivityAt(persistDir: string, sessionId: string): number | null {
  const row = getDb(persistDir).prepare("SELECT lastActivityAt FROM sessions WHERE sessionId = ?").get(sessionId) as
    { lastActivityAt: number | null } | undefined;
  return row?.lastActivityAt ?? null;
}

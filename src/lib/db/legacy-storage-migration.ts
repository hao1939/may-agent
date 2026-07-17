import { readSessionMeta } from "../persistence.js";
import {
  describeText,
  sessionMetaRef,
  writeContentAddressedText,
  type ArtifactDescriptor,
} from "../artifacts.js";
import {
  eventCorrelation,
  INLINE_EVENT_DATA_BYTES,
  prepareEventBody,
} from "../db-writer.js";
import { getDb } from "./connection.js";
import {
  writeWorkflowRunArtifact,
  type WorkflowRunRecord,
} from "./workflows.js";

const MAX_TASK_PREVIEW_LENGTH = 2_000;

export interface LegacyStorageMigrationResult {
  updated: {
    events: number;
    sessions: number;
    workflowRuns: number;
    sessionDigests: number;
  };
  removedSqlBytes: number;
}

function taskPreview(task: string, owner: string): string {
  if (task.length <= MAX_TASK_PREVIEW_LENGTH) return task;
  return `${task.slice(0, MAX_TASK_PREVIEW_LENGTH)}\n...[full task in ${owner}; ${task.length} chars]`;
}

function taskArtifact(
  persistDir: string,
  sessionId: string,
  task: string,
): ArtifactDescriptor {
  const meta = readSessionMeta(persistDir, sessionId);
  if (meta?.task === task) return describeText(sessionMetaRef(sessionId), task);
  return writeContentAddressedText(persistDir, "legacy-task-bodies", task);
}

function totalUpdated(result: LegacyStorageMigrationResult): number {
  return Object.values(result.updated).reduce((sum, count) => sum + count, 0);
}

/**
 * Archive and trim one fixed-size batch from each legacy payload table.
 *
 * Artifact files are durably renamed before the short SQL transaction starts.
 * The operation is idempotent: reference columns mark rows already migrated.
 */
export function migrateLegacyStoragePass(
  persistDir: string,
  opts: { batchSize?: number } = {},
): LegacyStorageMigrationResult {
  const db = getDb(persistDir);
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 100, 1_000));
  const result: LegacyStorageMigrationResult = {
    updated: { events: 0, sessions: 0, workflowRuns: 0, sessionDigests: 0 },
    removedSqlBytes: 0,
  };

  const events = db.prepare(
    `SELECT id, data FROM events
     WHERE body_ref IS NULL AND LENGTH(CAST(data AS BLOB)) > ?
     ORDER BY id LIMIT ?`,
  ).all(INLINE_EVENT_DATA_BYTES, batchSize) as Array<{ id: number; data: string }>;
  const preparedEvents = events.map((row) => {
    try {
      const payload = JSON.parse(row.data) as unknown;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("not an object");
      return {
        ...row,
        body: prepareEventBody(persistDir, payload as Record<string, unknown>),
        correlation: eventCorrelation(payload as Record<string, unknown>),
      };
    } catch {
      const artifact = writeContentAddressedText(persistDir, "event-bodies", row.data);
      return {
        ...row,
        body: {
          artifact,
          data: JSON.stringify({
            _truncated: {
              originalLength: Buffer.byteLength(row.data),
              reason: "legacy non-object event body stored as artifact",
            },
            _artifact: artifact,
          }),
        },
        correlation: {
          sessionId: null,
          workflowRunId: null,
          projectId: null,
          taskId: null,
          attemptId: null,
          handler: null,
          metricId: null,
          alertId: null,
          escalationId: null,
          status: null,
          durationMs: null,
        },
      };
    }
  });

  const sessions = db.prepare(
    `SELECT rowid AS migration_rowid, sessionId, task FROM sessions
     WHERE task_ref IS NULL AND LENGTH(task) > ?
     ORDER BY rowid LIMIT ?`,
  ).all(MAX_TASK_PREVIEW_LENGTH, batchSize) as Array<{ migration_rowid: number; sessionId: string; task: string }>;
  const preparedSessions = sessions.map((row) => ({
    ...row,
    artifact: taskArtifact(persistDir, row.sessionId, row.task),
    preview: taskPreview(row.task, "task artifact"),
  }));

  const workflowRuns = db.prepare(
    `SELECT * FROM workflow_runs
     WHERE LENGTH(task) > ?
       AND task NOT LIKE '%...[full task in workflow artifact; %'
     ORDER BY rowid LIMIT ?`,
  ).all(MAX_TASK_PREVIEW_LENGTH, batchSize) as unknown as WorkflowRunRecord[];
  const preparedWorkflowRuns = workflowRuns.map((row) => ({
    row,
    persisted: writeWorkflowRunArtifact(persistDir, row),
    preview: taskPreview(row.task, "workflow artifact"),
  }));

  const digests = db.prepare(
    `SELECT rowid AS migration_rowid, sessionId, task FROM session_digests
     WHERE task_ref IS NULL AND LENGTH(task) > ?
     ORDER BY rowid LIMIT ?`,
  ).all(MAX_TASK_PREVIEW_LENGTH, batchSize) as Array<{ migration_rowid: number; sessionId: string; task: string }>;
  const preparedDigests = digests.map((row) => ({
    ...row,
    artifact: taskArtifact(persistDir, row.sessionId, row.task),
    preview: taskPreview(row.task, "task artifact"),
  }));

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of preparedEvents) {
      const update = db.run(
        `UPDATE events SET
           data = ?, body_ref = ?, body_sha256 = ?, body_bytes = ?,
           session_id = COALESCE(session_id, ?),
           workflow_run_id = COALESCE(workflow_run_id, ?),
           project_id = COALESCE(project_id, ?),
           task_id = COALESCE(task_id, ?),
           attempt_id = COALESCE(attempt_id, ?),
           handler = COALESCE(handler, ?),
           metric_id = COALESCE(metric_id, ?),
           alert_id = COALESCE(alert_id, ?),
           escalation_id = COALESCE(escalation_id, ?),
           subject_status = COALESCE(subject_status, ?),
           duration_ms = COALESCE(duration_ms, ?)
         WHERE id = ? AND body_ref IS NULL`,
        [
          row.body.data, row.body.artifact.ref, row.body.artifact.sha256, row.body.artifact.bytes,
          row.correlation.sessionId, row.correlation.workflowRunId, row.correlation.projectId,
          row.correlation.taskId, row.correlation.attemptId, row.correlation.handler,
          row.correlation.metricId, row.correlation.alertId, row.correlation.escalationId,
          row.correlation.status, row.correlation.durationMs, row.id,
        ],
      );
      if (update.changes > 0) {
        result.updated.events += update.changes;
        result.removedSqlBytes += Buffer.byteLength(row.data) - Buffer.byteLength(row.body.data);
      }
    }

    for (const row of preparedSessions) {
      const update = db.run(
        `UPDATE sessions SET task = ?, task_ref = ?, task_sha256 = ?, task_bytes = ?
         WHERE rowid = ? AND task_ref IS NULL`,
        [row.preview, row.artifact.ref, row.artifact.sha256, row.artifact.bytes, row.migration_rowid],
      );
      if (update.changes > 0) {
        result.updated.sessions += update.changes;
        result.removedSqlBytes += Buffer.byteLength(row.task) - Buffer.byteLength(row.preview);
      }
    }

    for (const { row, persisted, preview } of preparedWorkflowRuns) {
      const update = db.run(
        `UPDATE workflow_runs SET
           task = ?, task_ref = ?, task_sha256 = ?, task_bytes = ?,
           artifact_ref = ?, artifact_sha256 = ?, artifact_bytes = ?
         WHERE runId = ? AND task = ?`,
        [
          preview, persisted.task_ref, persisted.task_sha256, persisted.task_bytes,
          persisted.artifact_ref, persisted.artifact_sha256, persisted.artifact_bytes,
          row.runId, row.task,
        ],
      );
      if (update.changes > 0) {
        result.updated.workflowRuns += update.changes;
        result.removedSqlBytes += Buffer.byteLength(row.task) - Buffer.byteLength(preview);
      }
    }

    for (const row of preparedDigests) {
      const update = db.run(
        `UPDATE session_digests SET task = ?, task_ref = ?, task_sha256 = ?, task_bytes = ?
         WHERE rowid = ? AND task_ref IS NULL`,
        [row.preview, row.artifact.ref, row.artifact.sha256, row.artifact.bytes, row.migration_rowid],
      );
      if (update.changes > 0) {
        result.updated.sessionDigests += update.changes;
        result.removedSqlBytes += Buffer.byteLength(row.task) - Buffer.byteLength(row.preview);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return result;
}

export function legacyStorageMigrationUpdatedCount(result: LegacyStorageMigrationResult): number {
  return totalUpdated(result);
}

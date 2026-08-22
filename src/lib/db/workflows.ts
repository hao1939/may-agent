import { getDb } from "./connection.js";
import { withSqliteBusyRetry } from "./busy-retry.js";
import {
  describeText,
  readJsonArtifact,
  readJsonArtifactWithDescriptor,
  workflowRunRef,
  writeJsonArtifact,
} from "../artifacts.js";
import { readSessionMeta } from "../persistence.js";

export interface WorkflowRunRecord {
  runId: string;
  workflow: string;
  task: string;
  task_ref?: string | null;
  task_sha256?: string | null;
  task_bytes?: number | null;
  artifact_ref?: string | null;
  artifact_sha256?: string | null;
  artifact_bytes?: number | null;
  artifact_error?: string;
  parentSessionId: string | null;
  parentWorkflowRunId: string | null;
  projectId?: string | null;
  depth: number;
  status: string;
  startedAt: number;
  endedAt: number | null;
  result_summary: string | null;
  result_reason: string | null;
  resumedFromRunId: string | null;
  sourcePath?: string | null;
  sourceScope?: "agent" | "project" | null;
  entryContentHash?: string | null;
}

const MAX_TASK_PREVIEW_LENGTH = 2_000;

function taskPreview(task: string): string {
  if (task.length <= MAX_TASK_PREVIEW_LENGTH) return task;
  return `${task.slice(0, MAX_TASK_PREVIEW_LENGTH)}\n...[full task in workflow artifact; ${task.length} chars]`;
}

function writeWorkflowRunArtifact(persistDir: string, run: WorkflowRunRecord): WorkflowRunRecord {
  const ref = workflowRunRef(run.runId);
  const artifact = writeJsonArtifact(persistDir, ref, {
    schemaVersion: 1,
    ...run,
    task_ref: undefined,
    task_sha256: undefined,
    task_bytes: undefined,
    artifact_ref: undefined,
    artifact_sha256: undefined,
    artifact_bytes: undefined,
  });
  const task = describeText(ref, run.task);
  return {
    ...run,
    task_ref: ref,
    task_sha256: task.sha256,
    task_bytes: task.bytes,
    artifact_ref: artifact.ref,
    artifact_sha256: artifact.sha256,
    artifact_bytes: artifact.bytes,
  };
}

/** Insert a new workflow run. */
export function insertWorkflowRun(persistDir: string, run: WorkflowRunRecord): void {
  const persisted = writeWorkflowRunArtifact(persistDir, run);
  const db = getDb(persistDir);
  withSqliteBusyRetry(`insert workflow_run ${run.runId}`, () =>
    db.run(
      `INSERT OR REPLACE INTO workflow_runs
        (runId, workflow, task, task_ref, task_sha256, task_bytes, artifact_ref, artifact_sha256, artifact_bytes, parentSessionId, parentWorkflowRunId, projectId, depth, status, startedAt, endedAt, result_summary, result_reason, resumedFromRunId, sourcePath, sourceScope, entryContentHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        persisted.runId, persisted.workflow, taskPreview(persisted.task),
        persisted.task_ref, persisted.task_sha256, persisted.task_bytes,
        persisted.artifact_ref, persisted.artifact_sha256, persisted.artifact_bytes,
        persisted.parentSessionId, persisted.parentWorkflowRunId,
        persisted.projectId ?? null, persisted.depth, persisted.status, persisted.startedAt, persisted.endedAt,
        persisted.result_summary, persisted.result_reason, persisted.resumedFromRunId,
        persisted.sourcePath ?? null, persisted.sourceScope ?? null, persisted.entryContentHash ?? null,
      ],
    ),
  );
}

/** Update a workflow run's status and result. */
export function updateWorkflowRun(
  persistDir: string,
  runId: string,
  fields: { status: string; endedAt?: number; result_summary?: string; result_reason?: string },
): void {
  const db = getDb(persistDir);
  const current = db.prepare("SELECT * FROM workflow_runs WHERE runId = ?").get(runId) as WorkflowRunRecord | null;
  let artifact = null;
  if (current) {
    const full = readJsonArtifact<WorkflowRunRecord & { schemaVersion?: number }>(persistDir, workflowRunRef(runId));
    artifact = writeWorkflowRunArtifact(persistDir, {
      ...current,
      ...(full ?? {}),
      runId,
      status: fields.status,
      endedAt: fields.endedAt ?? full?.endedAt ?? current.endedAt,
      result_summary: fields.result_summary ?? full?.result_summary ?? current.result_summary,
      result_reason: fields.result_reason ?? full?.result_reason ?? current.result_reason,
    });
  }
  withSqliteBusyRetry(`update workflow_run ${runId}`, () =>
    db.run(
      `UPDATE workflow_runs SET status = ?, endedAt = COALESCE(?, endedAt), result_summary = COALESCE(?, result_summary), result_reason = COALESCE(?, result_reason), artifact_ref = COALESCE(?, artifact_ref), artifact_sha256 = COALESCE(?, artifact_sha256), artifact_bytes = COALESCE(?, artifact_bytes) WHERE runId = ?`,
      [
        fields.status,
        fields.endedAt ?? null,
        fields.result_summary ?? null,
        fields.result_reason ?? null,
        artifact?.artifact_ref ?? null,
        artifact?.artifact_sha256 ?? null,
        artifact?.artifact_bytes ?? null,
        runId,
      ],
    ),
  );
}

/** Read a workflow run by ID. */
export function getWorkflowRun(persistDir: string, runId: string): WorkflowRunRecord | null {
  const db = getDb(persistDir);
  const row = db.prepare("SELECT * FROM workflow_runs WHERE runId = ?").get(runId) as WorkflowRunRecord | null;
  if (!row) return null;
  const loaded = readJsonArtifactWithDescriptor<WorkflowRunRecord & { schemaVersion?: number }>(
    persistDir,
    row.artifact_ref ?? workflowRunRef(runId),
  );
  if (loaded) {
    if (row?.artifact_sha256 && row.artifact_sha256 !== loaded.descriptor.sha256) {
      return { ...row, artifact_error: "workflow artifact integrity mismatch" };
    }
    return loaded.value;
  }
  return { ...row, artifact_error: "workflow artifact missing" };
}

/** List all workflow run IDs, ordered by startedAt. */
export function listWorkflowRunIds(persistDir: string): string[] {
  const db = getDb(persistDir);
  return (db.prepare("SELECT runId FROM workflow_runs ORDER BY startedAt").all() as Array<{ runId: string }>).map(r => r.runId);
}

/** Read only the direct children needed to render one workflow trace. */
export function listChildWorkflowRunIds(persistDir: string, parentWorkflowRunId: string): string[] {
  const db = getDb(persistDir);
  return (
    db
      .prepare("SELECT runId FROM workflow_runs WHERE parentWorkflowRunId = ? ORDER BY startedAt, runId")
      .all(parentWorkflowRunId) as Array<{ runId: string }>
  ).map((row) => row.runId);
}

/** Select only workflow runs that can require restart recovery. */
export function listRunningWorkflowRunIdsBefore(persistDir: string, startedBefore: number): string[] {
  const db = getDb(persistDir);
  return (
    db
      .prepare("SELECT runId FROM workflow_runs WHERE status = 'running' AND startedAt < ? ORDER BY startedAt, runId")
      .all(startedBefore) as Array<{ runId: string }>
  ).map((row) => row.runId);
}

/** Get step sessions for a workflow run, ordered by startedAt. */
export function getWorkflowStepSessions(persistDir: string, workflowRunId: string): Array<{
  sessionId: string; agent: string; task: string; status: string;
  stepLabel: string | null; startedAt: number; endedAt: number | null; outcome: string | null;
}> {
  const db = getDb(persistDir);
  const rows = db.prepare(
    `SELECT sessionId, agent, task, status, stepLabel, startedAt, endedAt, outcome
     FROM sessions WHERE workflowRunId = ? ORDER BY startedAt`
  ).all(workflowRunId) as any[];
  return rows.map((row) => {
    const meta = readSessionMeta(persistDir, row.sessionId);
    return meta?.task ? { ...row, task: meta.task } : row;
  });
}

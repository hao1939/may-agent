import { getDb } from "./connection.js";

export interface WorkflowRunRecord {
  runId: string;
  workflow: string;
  task: string;
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
}

/** Insert a new workflow run. */
export function insertWorkflowRun(persistDir: string, run: WorkflowRunRecord): void {
  const db = getDb(persistDir);
  db.run(
    `INSERT OR REPLACE INTO workflow_runs
      (runId, workflow, task, parentSessionId, parentWorkflowRunId, projectId, depth, status, startedAt, endedAt, result_summary, result_reason, resumedFromRunId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.runId, run.workflow, run.task, run.parentSessionId, run.parentWorkflowRunId,
      run.projectId ?? null, run.depth, run.status, run.startedAt, run.endedAt,
      run.result_summary, run.result_reason, run.resumedFromRunId,
    ],
  );
}

/** Update a workflow run's status and result. */
export function updateWorkflowRun(
  persistDir: string,
  runId: string,
  fields: { status: string; endedAt?: number; result_summary?: string; result_reason?: string },
): void {
  const db = getDb(persistDir);
  db.run(
    `UPDATE workflow_runs SET status = ?, endedAt = COALESCE(?, endedAt), result_summary = COALESCE(?, result_summary), result_reason = COALESCE(?, result_reason) WHERE runId = ?`,
    [fields.status, fields.endedAt ?? null, fields.result_summary ?? null, fields.result_reason ?? null, runId],
  );
}

/** Read a workflow run by ID. */
export function getWorkflowRun(persistDir: string, runId: string): WorkflowRunRecord | null {
  const db = getDb(persistDir);
  return db.prepare("SELECT * FROM workflow_runs WHERE runId = ?").get(runId) as WorkflowRunRecord | null;
}

/** List all workflow run IDs, ordered by startedAt. */
export function listWorkflowRunIds(persistDir: string): string[] {
  const db = getDb(persistDir);
  return (db.prepare("SELECT runId FROM workflow_runs ORDER BY startedAt").all() as Array<{ runId: string }>).map(r => r.runId);
}

/** Get step sessions for a workflow run, ordered by startedAt. */
export function getWorkflowStepSessions(persistDir: string, workflowRunId: string): Array<{
  sessionId: string; agent: string; task: string; status: string;
  stepLabel: string | null; startedAt: number; endedAt: number | null; outcome: string | null;
}> {
  const db = getDb(persistDir);
  return db.prepare(
    `SELECT sessionId, agent, task, status, stepLabel, startedAt, endedAt, outcome
     FROM sessions WHERE workflowRunId = ? ORDER BY startedAt`
  ).all(workflowRunId) as any[];
}

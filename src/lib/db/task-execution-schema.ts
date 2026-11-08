/** Execution accounting only; no Task state, queue or expiry-based release. */
export const TASK_EXECUTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS task_execution_limits (
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('host', 'agent', 'root')),
  scope_key TEXT NOT NULL, slots INTEGER NOT NULL CHECK (slots > 0),
  PRIMARY KEY(scope_kind, scope_key)
);
CREATE TABLE IF NOT EXISTS task_execution_reservations (
  operation_id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE,
  recipient_key TEXT NOT NULL,
  task_app_id TEXT, task_id TEXT, attempt_id TEXT, session_id TEXT,
  lane TEXT NOT NULL CHECK (lane IN ('background', 'human', 'coordination')),
  owner_id TEXT NOT NULL, admitted_at INTEGER NOT NULL,
  released_at INTEGER, receipt_json TEXT NOT NULL, release_json TEXT,
  CHECK ((released_at IS NULL) = (release_json IS NULL)),
  CHECK ((task_app_id IS NULL) = (task_id IS NULL)),
  CHECK ((task_id IS NULL) = (attempt_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_task_execution_active_host
  ON task_execution_reservations(lane) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_execution_active_agent
  ON task_execution_reservations(recipient_key) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_execution_active_task
  ON task_execution_reservations(task_app_id, task_id, attempt_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_app_tasks_execution_constraint
  ON app_tasks(json_extract(resource_json, '$.status.executionConstraint.scopeKey'), app_id, task_id)
  WHERE json_valid(resource_json) AND json_extract(resource_json, '$.status.executionConstraint.scopeKey') IS NOT NULL;
`;

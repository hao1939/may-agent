/** Resource-local Task rows share the EventHub database for atomic fenced emission. */
export const TASK_RESOURCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS app_task_store_meta (
  app_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  PRIMARY KEY(app_id, key)
);
CREATE TABLE IF NOT EXISTS app_tasks (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL,
  generation INTEGER NOT NULL, resource_version INTEGER NOT NULL,
  observed_generation INTEGER NOT NULL, phase TEXT NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('human', 'normal')),
  changed INTEGER NOT NULL CHECK (changed IN (0, 1)),
  ready INTEGER NOT NULL CHECK (ready IN (0, 1)),
  next_check_at INTEGER, lease_until INTEGER, current_attempt_id TEXT,
  updated_at INTEGER NOT NULL, resource_json TEXT NOT NULL, trigger_json TEXT,
  PRIMARY KEY(app_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_app_tasks_ready ON app_tasks(app_id, ready, lane, updated_at, task_id);
CREATE INDEX IF NOT EXISTS idx_app_tasks_changed ON app_tasks(app_id, changed, updated_at, task_id);
CREATE INDEX IF NOT EXISTS idx_app_tasks_phase ON app_tasks(app_id, phase, updated_at, task_id);
CREATE INDEX IF NOT EXISTS idx_app_tasks_due ON app_tasks(app_id, next_check_at, task_id)
  WHERE next_check_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_tasks_expired ON app_tasks(app_id, lease_until, task_id)
  WHERE lease_until IS NOT NULL;
CREATE TABLE IF NOT EXISTS app_task_events (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL, event_key TEXT NOT NULL,
  observed_at INTEGER NOT NULL, event_json TEXT NOT NULL,
  PRIMARY KEY(app_id, task_id, event_key),
  FOREIGN KEY(app_id, task_id) REFERENCES app_tasks(app_id, task_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_task_events_task_time
  ON app_task_events(app_id, task_id, observed_at, event_key);
CREATE TABLE IF NOT EXISTS app_task_attempts (
  app_id TEXT NOT NULL, attempt_id TEXT NOT NULL, task_id TEXT NOT NULL,
  task_generation INTEGER NOT NULL, state TEXT NOT NULL, lease_until INTEGER,
  started_at INTEGER NOT NULL, attempt_json TEXT NOT NULL,
  PRIMARY KEY(app_id, attempt_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_attempts_task
  ON app_task_attempts(app_id, task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_task_attempts_expired
  ON app_task_attempts(app_id, lease_until, task_id) WHERE state = 'running' AND lease_until IS NOT NULL;
CREATE TABLE IF NOT EXISTS app_task_conditions (
  app_id TEXT NOT NULL, condition_id TEXT NOT NULL, state TEXT NOT NULL, condition_json TEXT NOT NULL,
  PRIMARY KEY(app_id, condition_id)
);
CREATE TABLE IF NOT EXISTS app_task_receipts (
  app_id TEXT NOT NULL, receipt_id TEXT NOT NULL, parent_id TEXT NOT NULL,
  completed_at INTEGER NOT NULL, receipt_json TEXT NOT NULL,
  PRIMARY KEY(app_id, receipt_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_receipts_parent
  ON app_task_receipts(app_id, parent_id, completed_at DESC);
CREATE TABLE IF NOT EXISTS app_task_groups (
  app_id TEXT NOT NULL, group_id TEXT NOT NULL, group_json TEXT NOT NULL,
  PRIMARY KEY(app_id, group_id)
);
CREATE TABLE IF NOT EXISTS app_task_admissions (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL, admission_json TEXT NOT NULL,
  PRIMARY KEY(app_id, task_id)
);
`;

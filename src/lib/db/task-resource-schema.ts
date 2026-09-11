import type { SqliteDb } from "../db.js";
import { APP_INBOX_SCHEMA } from "./app-inbox-schema.js";

/** Invalidate cached canonical snapshots after an in-transaction Task resource change. */
export function advanceTaskResourceRevision(db: SqliteDb, appId: string): void {
  db.prepare(
    `INSERT INTO app_task_store_meta(app_id, key, value) VALUES (?, 'revision', '1')
     ON CONFLICT(app_id, key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`,
  ).run(appId);
}

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
CREATE INDEX IF NOT EXISTS idx_app_tasks_global_phase
  ON app_tasks(phase, updated_at DESC, app_id, task_id);
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
CREATE TABLE IF NOT EXISTS app_task_relations (
  app_id TEXT NOT NULL, source_task_id TEXT NOT NULL,
  relation_kind TEXT NOT NULL CHECK (relation_kind IN ('parent', 'dependency')),
  target_task_id TEXT NOT NULL,
  PRIMARY KEY(app_id, source_task_id, relation_kind, target_task_id),
  FOREIGN KEY(app_id, source_task_id) REFERENCES app_tasks(app_id, task_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_task_relations_target
  ON app_task_relations(app_id, target_task_id, relation_kind, source_task_id);
CREATE TABLE IF NOT EXISTS app_task_attempts (
  app_id TEXT NOT NULL, attempt_id TEXT NOT NULL, task_id TEXT NOT NULL,
  task_generation INTEGER NOT NULL, state TEXT NOT NULL, lease_until INTEGER,
  started_at INTEGER NOT NULL, attempt_json TEXT NOT NULL,
  PRIMARY KEY(app_id, attempt_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_attempts_task
  ON app_task_attempts(app_id, task_id, started_at DESC);
DROP INDEX IF EXISTS idx_app_task_attempts_execution_failure;
CREATE INDEX IF NOT EXISTS idx_app_task_attempts_expired
  ON app_task_attempts(app_id, lease_until, task_id) WHERE state = 'running' AND lease_until IS NOT NULL;
CREATE TABLE IF NOT EXISTS app_task_conditions (
  app_id TEXT NOT NULL, condition_id TEXT NOT NULL, state TEXT NOT NULL, condition_json TEXT NOT NULL,
  PRIMARY KEY(app_id, condition_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_conditions_event_type
  ON app_task_conditions(app_id, json_extract(condition_json, '$.spec.type'));
CREATE INDEX IF NOT EXISTS idx_app_task_conditions_type_app
  ON app_task_conditions(json_extract(condition_json, '$.spec.type'), app_id, condition_id);
CREATE TABLE IF NOT EXISTS app_task_condition_routes (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL, condition_id TEXT NOT NULL,
  PRIMARY KEY(app_id, condition_id, task_id),
  FOREIGN KEY(app_id, task_id) REFERENCES app_tasks(app_id, task_id) ON DELETE CASCADE,
  FOREIGN KEY(app_id, condition_id) REFERENCES app_task_conditions(app_id, condition_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_task_condition_routes_task
  ON app_task_condition_routes(app_id, task_id, condition_id);
CREATE TABLE IF NOT EXISTS app_task_receipts (
  app_id TEXT NOT NULL, receipt_id TEXT NOT NULL, parent_id TEXT NOT NULL,
  completed_at INTEGER NOT NULL, receipt_json TEXT NOT NULL,
  PRIMARY KEY(app_id, receipt_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_receipts_parent
  ON app_task_receipts(app_id, parent_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_task_receipts_completed
  ON app_task_receipts(completed_at DESC, app_id, receipt_id);
CREATE TABLE IF NOT EXISTS app_task_refs (
  digest TEXT PRIMARY KEY, prefix8 TEXT NOT NULL, prefix16 TEXT NOT NULL,
  app_id TEXT NOT NULL, task_id TEXT NOT NULL, indexed_at INTEGER NOT NULL,
  UNIQUE(app_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_refs_prefix8 ON app_task_refs(prefix8, digest);
CREATE INDEX IF NOT EXISTS idx_app_task_refs_prefix16 ON app_task_refs(prefix16, digest);
CREATE TABLE IF NOT EXISTS app_task_cancellations (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL,
  requested_at INTEGER NOT NULL, reason TEXT NOT NULL, cancellation_json TEXT NOT NULL,
  PRIMARY KEY(app_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_cancellations_time
  ON app_task_cancellations(requested_at DESC, app_id, task_id);
CREATE TABLE IF NOT EXISTS app_task_control_receipts (
  control_key TEXT PRIMARY KEY,
  app_id TEXT NOT NULL, task_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('retry', 'cancel')),
  expected_generation INTEGER NOT NULL,
  expected_resource_version INTEGER NOT NULL,
  applied_resource_version INTEGER NOT NULL,
  applied_at INTEGER NOT NULL,
  receipt_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_task_control_receipts_task
  ON app_task_control_receipts(app_id, task_id, applied_at DESC);
CREATE TABLE IF NOT EXISTS app_task_groups (
  app_id TEXT NOT NULL, group_id TEXT NOT NULL, group_json TEXT NOT NULL,
  PRIMARY KEY(app_id, group_id)
);
CREATE TABLE IF NOT EXISTS app_task_admissions (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL, admission_json TEXT NOT NULL,
  PRIMARY KEY(app_id, task_id)
);
`;

/** Create the resource tables and migrate legacy JSON links once. */
export function ensureTaskResourceSchema(db: SqliteDb): void {
  db.exec(APP_INBOX_SCHEMA);
  const needsConditionRouteBackfill = !db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_task_condition_routes'")
    .get();
  const needsRelationBackfill = !db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_task_relations'")
    .get();
  if (!needsConditionRouteBackfill && !needsRelationBackfill) {
    db.exec(TASK_RESOURCE_SCHEMA);
    return;
  }
  // This helper is used both by the top-level schema transaction and by
  // resource-store initialization. A savepoint is atomic in either context;
  // a nested BEGIN is not valid in SQLite.
  db.exec("SAVEPOINT task_resource_schema");
  try {
    db.exec(TASK_RESOURCE_SCHEMA);
    if (needsConditionRouteBackfill) {
      db.exec(`
        INSERT OR IGNORE INTO app_task_condition_routes(app_id, task_id, condition_id)
        SELECT t.app_id, t.task_id, linked.value
        FROM app_tasks t
        JOIN json_each(t.resource_json, '$.status.conditionIds') linked
        JOIN app_task_conditions c
          ON c.app_id = t.app_id AND c.condition_id = linked.value
        WHERE json_valid(t.resource_json) = 1
      `);
    }
    if (needsRelationBackfill) {
      db.exec(`
        INSERT OR IGNORE INTO app_task_relations(app_id, source_task_id, relation_kind, target_task_id)
        SELECT app_id, task_id, 'parent', json_extract(resource_json, '$.spec.parentId')
        FROM app_tasks
        WHERE json_valid(resource_json) = 1
          AND json_type(resource_json, '$.spec.parentId') = 'text'
          AND json_extract(resource_json, '$.spec.parentId') <> '';

        INSERT OR IGNORE INTO app_task_relations(app_id, source_task_id, relation_kind, target_task_id)
        SELECT task.app_id, task.task_id, 'dependency', dependency.value
        FROM app_tasks task
        JOIN json_each(task.resource_json, '$.spec.dependsOn') dependency
        WHERE json_valid(task.resource_json) = 1
          AND dependency.type = 'text'
          AND dependency.value <> ''
      `);
    }
    db.exec("RELEASE SAVEPOINT task_resource_schema");
  } catch (error) {
    try {
      db.exec("ROLLBACK TO SAVEPOINT task_resource_schema");
      db.exec("RELEASE SAVEPOINT task_resource_schema");
    } catch {
      // Preserve the migration failure.
    }
    throw error;
  }
}

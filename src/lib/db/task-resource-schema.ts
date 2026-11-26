import { normalizeLegacyTaskFormats } from "./legacy-task-formats.js";
import type { SqliteDb } from "../db.js";
import { APP_INBOX_SCHEMA } from "./app-inbox-schema.js";
import { withSqliteInitializationRetry } from "./busy-retry.js";

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
CREATE INDEX IF NOT EXISTS idx_app_tasks_creator
  ON app_tasks(json_extract(resource_json, '$.metadata.creator.appId'),
    json_extract(resource_json, '$.metadata.creator.taskId'), app_id, task_id)
  WHERE json_valid(resource_json);
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
  started_at INTEGER NOT NULL, accepted_result_state TEXT, attempt_json TEXT NOT NULL,
  PRIMARY KEY(app_id, attempt_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_attempts_task
  ON app_task_attempts(app_id, task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_task_attempts_started
  ON app_task_attempts(started_at DESC, app_id, attempt_id);
CREATE INDEX IF NOT EXISTS idx_app_task_attempts_return_covering
  ON app_task_attempts(app_id, task_id, attempt_id, task_generation, started_at, accepted_result_state);
CREATE TRIGGER IF NOT EXISTS trg_app_task_attempts_accepted_result_state_insert
AFTER INSERT ON app_task_attempts
WHEN COALESCE(NEW.accepted_result_state, '') IS NOT COALESCE(json_extract(NEW.attempt_json, '$.acceptedResult.state'), '')
BEGIN
  UPDATE app_task_attempts
  SET accepted_result_state = json_extract(NEW.attempt_json, '$.acceptedResult.state')
  WHERE app_id = NEW.app_id AND attempt_id = NEW.attempt_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_app_task_attempts_accepted_result_state_update
AFTER UPDATE OF attempt_json ON app_task_attempts
WHEN COALESCE(NEW.accepted_result_state, '') IS NOT COALESCE(json_extract(NEW.attempt_json, '$.acceptedResult.state'), '')
BEGIN
  UPDATE app_task_attempts
  SET accepted_result_state = json_extract(NEW.attempt_json, '$.acceptedResult.state')
  WHERE app_id = NEW.app_id AND attempt_id = NEW.attempt_id;
END;
CREATE INDEX IF NOT EXISTS idx_app_task_attempts_failover
  ON app_task_attempts(started_at)
  WHERE json_extract(attempt_json, '$.failoverFromAttemptId') IS NOT NULL;
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
CREATE INDEX IF NOT EXISTS idx_app_task_conditions_open_human_owner
  ON app_task_conditions(app_id, condition_id)
  WHERE state != 'true'
    AND (trim(json_extract(condition_json, '$.spec.owner')) = 'human'
      OR trim(json_extract(condition_json, '$.spec.owner')) GLOB 'human:?*');
CREATE TABLE IF NOT EXISTS app_task_condition_routes (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL, condition_id TEXT NOT NULL,
  PRIMARY KEY(app_id, condition_id, task_id),
  FOREIGN KEY(app_id, task_id) REFERENCES app_tasks(app_id, task_id) ON DELETE CASCADE,
  FOREIGN KEY(app_id, condition_id) REFERENCES app_task_conditions(app_id, condition_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_task_condition_routes_task
  ON app_task_condition_routes(app_id, task_id, condition_id);
CREATE INDEX IF NOT EXISTS idx_app_task_condition_routes_condition
  ON app_task_condition_routes(condition_id, app_id, task_id);
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
  action TEXT NOT NULL CHECK (action IN ('retry', 'cancel', 'reopen')),
  expected_generation INTEGER NOT NULL,
  expected_resource_version INTEGER NOT NULL,
  applied_resource_version INTEGER NOT NULL,
  applied_at INTEGER NOT NULL,
  receipt_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_task_control_receipts_task
  ON app_task_control_receipts(app_id, task_id, applied_at DESC);
-- Per-operation replay evidence, independent of publication and attempt identity.
CREATE TABLE IF NOT EXISTS app_task_communication_receipts (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL, task_generation INTEGER NOT NULL,
  communication_id TEXT NOT NULL, receipt_json TEXT NOT NULL,
  PRIMARY KEY(app_id, task_id, task_generation, communication_id)
);
CREATE TABLE IF NOT EXISTS app_task_groups (
  app_id TEXT NOT NULL, group_id TEXT NOT NULL, group_json TEXT NOT NULL,
  PRIMARY KEY(app_id, group_id)
);
CREATE TABLE IF NOT EXISTS app_task_admissions (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL, admission_json TEXT NOT NULL,
  PRIMARY KEY(app_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_app_task_admissions_target_text
  ON app_task_admissions(app_id, CAST(json_extract(admission_json, '$.taskId') AS TEXT),
    json_extract(admission_json, '$.taskGeneration'));
DROP INDEX IF EXISTS idx_app_task_admissions_target;
CREATE INDEX IF NOT EXISTS idx_app_task_admissions_input
  ON app_task_admissions(task_id, CAST(json_extract(admission_json, '$.inputEvent.data.request.id') AS TEXT));
`;

/** Rebuild compact delivery identities from retained Task input/attempt evidence. */
export function backfillTaskEventReceipts(db: SqliteDb, appId: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO app_task_events(app_id, task_id, event_key, observed_at, event_json)
    SELECT app_id, task_id, 'event:' || event_id, observed_at, '{}'
    FROM (
      SELECT a.app_id, a.task_id, a.started_at AS observed_at,
             json_extract(e.value, '$.event.eventId') AS event_id
      FROM app_task_attempts a JOIN app_tasks t USING (app_id, task_id)
      JOIN json_each(a.attempt_json, '$.events') e WHERE a.app_id = ?1
      UNION ALL
      SELECT a.app_id, a.task_id, a.started_at, json_extract(a.attempt_json, '$.trigger.eventId')
      FROM app_task_attempts a JOIN app_tasks t USING (app_id, task_id) WHERE a.app_id = ?1
      UNION ALL
      SELECT a.app_id, a.task_id, a.started_at, e.value
      FROM app_task_attempts a JOIN app_tasks t USING (app_id, task_id)
      JOIN json_each(a.attempt_json, '$.acceptedResult.acceptedLiveEventIds') e WHERE a.app_id = ?1
      UNION ALL
      SELECT t.app_id, t.task_id, t.updated_at, json_extract(e.value, '$.event.eventId')
      FROM app_tasks t JOIN json_each(t.trigger_json, '$.events') e WHERE t.app_id = ?1
      UNION ALL
      SELECT app_id, task_id, updated_at, json_extract(trigger_json, '$.event.eventId')
      FROM app_tasks WHERE app_id = ?1
    ) WHERE typeof(event_id) = 'integer' AND event_id > 0 AND event_id <= 9007199254740991
  `).run(appId);
  // Synthetic hints have no durable delivery identity and remain coalescible
  // in the pending trigger, without accumulating lifetime receipt hashes.
  db.prepare("DELETE FROM app_task_events WHERE app_id = ? AND event_key NOT LIKE 'event:%'").run(appId);
  // Bodies remain in pending input, attempts and Events under their own retention.
  db.prepare("UPDATE app_task_events SET event_json = '{}' WHERE app_id = ? AND event_json <> '{}'").run(appId);
}

const REQUIRED_TASK_RESOURCE_TABLES = [
  "app_inbox_items",
  "app_task_store_meta",
  "app_tasks",
  "app_task_events",
  "app_task_relations",
  "app_task_attempts",
  "app_task_conditions",
  "app_task_condition_routes",
  "app_task_refs",
  "app_task_cancellations",
  "app_task_control_receipts",
  "app_task_communication_receipts",
  "app_task_groups",
  "app_task_admissions",
] as const;

const REQUIRED_TASK_RESOURCE_INDEXES = [
  "idx_app_inbox_conversation_origin_recent",
  "idx_app_inbox_conversation_origin_topic_recent",
  "idx_app_inbox_ready",
  "idx_app_inbox_admission_read",
  "idx_app_inbox_unadmitted",
  "idx_app_inbox_available",
  "idx_app_inbox_expired",
  "idx_app_inbox_waiting",
  "idx_app_inbox_task_wait_recovery",
  "idx_app_inbox_parent",
  "idx_app_inbox_continues",
  "idx_app_inbox_origin_event",
  "idx_app_inbox_conversation",
  "idx_app_inbox_conversation_recent",
  "idx_app_inbox_topic_recent",
  "idx_app_inbox_execution_task",
  "idx_app_inbox_task_admission",
  "idx_app_inbox_pending_human_task",
  "idx_app_inbox_conversation_change",
  "idx_app_inbox_idempotency",
  "idx_app_inbox_conversation_sequence",
  "idx_app_inbox_rejected_feedback",
  "idx_app_tasks_ready",
  "idx_app_tasks_changed",
  "idx_app_tasks_phase",
  "idx_app_tasks_global_phase",
  "idx_app_tasks_creator",
  "idx_app_tasks_due",
  "idx_app_tasks_expired",
  "idx_app_task_events_task_time",
  "idx_app_task_relations_target",
  "idx_app_task_attempts_task",
  "idx_app_task_attempts_started",
  "idx_app_task_attempts_return_covering",
  "idx_app_task_attempts_failover",
  "idx_app_task_attempts_expired",
  "idx_app_task_conditions_event_type",
  "idx_app_task_conditions_type_app",
  "idx_app_task_conditions_open_human_owner",
  "idx_app_task_condition_routes_task",
  "idx_app_task_condition_routes_condition",
  "idx_app_task_refs_prefix8",
  "idx_app_task_refs_prefix16",
  "idx_app_task_cancellations_time",
  "idx_app_task_control_receipts_task",
  "idx_app_task_admissions_target_text",
  "idx_app_task_admissions_input",
] as const;

const REQUIRED_TASK_RESOURCE_TRIGGERS = [
  "trg_app_task_attempts_accepted_result_state_insert",
  "trg_app_task_attempts_accepted_result_state_update",
] as const;

function isTaskResourceSchemaCurrent(db: SqliteDb): boolean {
  const objects = db
    .prepare("SELECT type, name FROM sqlite_master WHERE type IN ('table', 'index', 'trigger')")
    .all() as Array<{ type?: unknown; name?: unknown }>;
  const tables = new Set<string>();
  const indexes = new Set<string>();
  const triggers = new Set<string>();
  for (const obj of objects) {
    if (typeof obj.name !== "string") continue;
    if (obj.type === "table") tables.add(obj.name);
    else if (obj.type === "index") indexes.add(obj.name);
    else if (obj.type === "trigger") triggers.add(obj.name);
  }
  if (tables.has("app_task_receipts")) return false;
  if (indexes.has("idx_app_task_attempts_execution_failure") || indexes.has("idx_app_task_admissions_target")) {
    return false;
  }
  if (
    !REQUIRED_TASK_RESOURCE_TABLES.every((name) => tables.has(name)) ||
    !REQUIRED_TASK_RESOURCE_INDEXES.every((name) => indexes.has(name)) ||
    !REQUIRED_TASK_RESOURCE_TRIGGERS.every((name) => triggers.has(name))
  ) {
    return false;
  }
  const inboxColumns = db.prepare("PRAGMA table_info(app_inbox_items)").all() as Array<{ name?: unknown }>;
  if (!inboxColumns.some(item => item.name === "conversation_app_id")) return false;
  const columns = db.prepare("PRAGMA table_info(app_task_attempts)").all() as Array<{ name?: unknown }>;
  if (!columns.some((item) => item.name === "accepted_result_state")) return false;
  if (!tables.has("host_schema_migrations")) return false;
  return Boolean(db.prepare("SELECT 1 FROM host_schema_migrations WHERE id = 'task-formats-20261118'").get());
}

function acquireImmediateOrSavepoint(db: SqliteDb): { commit(): void; rollback(): void } {
  let startedImmediate = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    startedImmediate = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/within a transaction/i.test(message)) throw error;
  }
  if (startedImmediate) {
    return {
      commit() {
        db.exec("COMMIT");
      },
      rollback() {
        db.exec("ROLLBACK");
      },
    };
  }
  const savepoint = `task_resource_schema_${Math.random().toString(36).slice(2, 10)}`;
  db.exec(`SAVEPOINT ${savepoint}`);
  return {
    commit() {
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    },
    rollback() {
      db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    },
  };
}

function ensureExistingAppTaskAttemptColumns(db: SqliteDb): {
  hadAttemptsTable: boolean;
  needsAcceptedResultStateBackfill: boolean;
} {
  const hasAttemptsTable = Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_task_attempts' LIMIT 1").get(),
  );
  if (!hasAttemptsTable) return { hadAttemptsTable: false, needsAcceptedResultStateBackfill: false };
  const columns = db.prepare("PRAGMA table_info(app_task_attempts)").all() as Array<{ name?: unknown }>;
  const hasAcceptedResultState = columns.some((item) => item.name === "accepted_result_state");
  if (!hasAcceptedResultState) {
    db.exec("ALTER TABLE app_task_attempts ADD COLUMN accepted_result_state TEXT");
  }
  const hasTriggers =
    Number(
      (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM sqlite_master
             WHERE type = 'trigger'
               AND name IN (
                 'trg_app_task_attempts_accepted_result_state_insert',
                 'trg_app_task_attempts_accepted_result_state_update'
               )`,
          )
          .get() as { count?: unknown } | undefined
      )?.count ?? 0,
    ) === 2;
  return {
    hadAttemptsTable: true,
    needsAcceptedResultStateBackfill: !hasAcceptedResultState || !hasTriggers,
  };
}

/** Create the canonical Task resource and App inbox schema. */
export function ensureTaskResourceSchema(db: SqliteDb): void {
  if (isTaskResourceSchemaCurrent(db)) return;
  withSqliteInitializationRetry("initialize task resource schema", () => {
    const tx = acquireImmediateOrSavepoint(db);
    try {
      const inboxColumns = db.prepare("PRAGMA table_info(app_inbox_items)").all() as Array<{ name?: unknown }>;
      if (inboxColumns.length && !inboxColumns.some(item => item.name === "conversation_app_id"))
        db.exec("ALTER TABLE app_inbox_items ADD COLUMN conversation_app_id TEXT");
      db.exec(APP_INBOX_SCHEMA);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_app_inbox_rejected_feedback ON app_inbox_items(id)
        WHERE execution_task_id IS NULL AND status = 'done' AND waiting_on_kind IS NULL
          AND json_extract(handling, '$.phase') = 'failed'
          AND json_extract(recovery_json, '$."input-admission".fingerprint') IS NOT NULL
          AND json_extract(recovery_json, '$."input-admission".reportedAt') IS NULL`);
      const { hadAttemptsTable, needsAcceptedResultStateBackfill } = ensureExistingAppTaskAttemptColumns(db);
      db.exec(TASK_RESOURCE_SCHEMA);
      if (hadAttemptsTable && needsAcceptedResultStateBackfill) {
        db.exec(`
          UPDATE app_task_attempts
          SET accepted_result_state = json_extract(attempt_json, '$.acceptedResult.state')
          WHERE COALESCE(accepted_result_state, '') IS NOT COALESCE(json_extract(attempt_json, '$.acceptedResult.state'), '')
        `);
      }
      normalizeLegacyTaskFormats(db);
      tx.commit();
    } catch (error) {
      try {
        tx.rollback();
      } catch {
        // Preserve the original migration error.
      }
      throw error;
    }
  });
}

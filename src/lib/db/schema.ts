import type { SqliteDb } from "../db.js";
import { ensureTaskResourceSchema } from "./task-resource-schema.js";

const NOTIFICATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS notification_messages (
  chat_id TEXT NOT NULL,
  telegram_msg_id INTEGER NOT NULL,
  event_type TEXT,
  agent TEXT,
  session_id TEXT,
  project_id TEXT,
  data TEXT,
  sent_at INTEGER,
  PRIMARY KEY (chat_id, telegram_msg_id)
);

-- Transport evidence only. Accepted Conversation messages remain the answer;
-- sending or uncertain evidence never grants permission to repeat a send.
CREATE TABLE IF NOT EXISTS telegram_conversation_deliveries (
  operation_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  thread_id INTEGER,
  state TEXT NOT NULL CHECK (state IN ('sending', 'delivered', 'failed', 'uncertain')),
  reason TEXT,
  external_message_id INTEGER,
  updated_at INTEGER NOT NULL
);`;

const METRIC_DISPOSITION_SCHEMA = `
-- A read projection, not another decision store. Apps retain metric decisions
-- in ordinary accepted Task facts (including Conversation Tasks). Unaccepted
-- execution output and Evaluation publication are never owner dispositions.
-- Task resource writers use canonical JSON.stringify serialization. Index the
-- declared fact prefix before expanding/validating facts; unrelated or rejected
-- results containing the prefix remain candidates, never accepted decisions.
CREATE INDEX IF NOT EXISTS idx_metric_disposition_attempts
  ON app_task_attempts(
    CAST(unixepoch(json_extract(attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER), attempt_id)
  WHERE instr(attempt_json, 'metric-disposition:') > 0;
`;

const METRIC_DISPOSITION_VIEW = `CREATE VIEW metric_dispositions AS
WITH facts AS (
  SELECT a.app_id, a.task_id, a.attempt_id,
    CAST(unixepoch(json_extract(a.attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER) AS timestamp,
    CASE WHEN f.type = 'text' AND substr(f.value, 1, 19) = 'metric-disposition:'
      AND length(f.value) <= 4000 AND json_valid(substr(f.value, 20))
      THEN substr(f.value, 20) ELSE '{}' END AS data
  FROM app_task_attempts a, json_each(a.attempt_json, '$.acceptedResult.facts') f
  WHERE instr(a.attempt_json, 'metric-disposition:') > 0
)
SELECT app_id, task_id, attempt_id, timestamp, data,
  json_extract(data, '$.metricId') AS metric_id,
  json_extract(data, '$.alertId') AS alert_id
FROM facts
WHERE json_extract(data, '$.version') = 1
  AND json_type(data, '$.metricId') = 'text'
  AND length(json_extract(data, '$.metricId')) > 0
  AND json_extract(data, '$.disposition') IN ('investigate', 'observe', 'no-change', 'recovered')
  AND (json_type(data, '$.alertId') = 'null'
    OR (json_type(data, '$.alertId') = 'integer' AND json_extract(data, '$.alertId') > 0))
  AND timestamp IS NOT NULL`;

/** Canonical runtime schema. Historical schemas are not supported. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS execution_usage (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  app_id TEXT,
  agent TEXT NOT NULL,
  workflow_run_id TEXT,
  task_id TEXT,
  attempt_id TEXT,
  configured_model TEXT NOT NULL,
  preparer TEXT NOT NULL,
  entry_hash TEXT,
  models TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  outcome TEXT,
  duration_ms REAL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_execution_usage_started ON execution_usage(started_at);
CREATE INDEX IF NOT EXISTS idx_execution_usage_updated ON execution_usage(updated_at);
CREATE INDEX IF NOT EXISTS idx_execution_usage_session ON execution_usage(session_id);

CREATE TABLE IF NOT EXISTS sessions (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  task            TEXT NOT NULL,
  task_ref        TEXT,
  task_sha256     TEXT,
  task_bytes      INTEGER,
  result_ref      TEXT,
  result_sha256   TEXT,
  result_bytes    INTEGER,
  status          TEXT NOT NULL DEFAULT 'running',
  kind            TEXT,
  source          TEXT,
  parentSessionId TEXT,
  requestId       TEXT,
  workflowRunId   TEXT,
  projectId       TEXT,
  app_id          TEXT,
  task_id         TEXT,
  task_generation INTEGER,
  attempt_id      TEXT,
  stepLabel       TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  lastActivityAt  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sess_agent_started ON sessions(agent, startedAt DESC);
CREATE INDEX IF NOT EXISTS idx_sess_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sess_parent ON sessions(parentSessionId);
CREATE INDEX IF NOT EXISTS idx_sess_workflow ON sessions(workflowRunId);
CREATE INDEX IF NOT EXISTS idx_sess_project ON sessions(projectId);
CREATE INDEX IF NOT EXISTS idx_sess_task_binding ON sessions(app_id, task_id, task_generation, attempt_id);
CREATE INDEX IF NOT EXISTS idx_sess_started ON sessions(startedAt);
CREATE INDEX IF NOT EXISTS idx_sess_ended ON sessions(endedAt DESC);
CREATE INDEX IF NOT EXISTS idx_sess_activity ON sessions(lastActivityAt);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  source TEXT,
  owner TEXT,
  data TEXT,
  envelope_json TEXT,
  body_ref TEXT,
  body_sha256 TEXT,
  body_bytes INTEGER,
  session_id TEXT,
  workflow_run_id TEXT,
  project_id TEXT,
  task_id TEXT,
  attempt_id TEXT,
  handler TEXT,
  metric_id TEXT,
  alert_id TEXT,
  escalation_id TEXT,
  subject_status TEXT,
  duration_ms INTEGER,
  timestamp INTEGER NOT NULL,
  ttl_ms INTEGER,
  urgency TEXT DEFAULT 'normal',
  delivery_status TEXT DEFAULT 'pending',
  record_only INTEGER NOT NULL DEFAULT 0,
  accepted_by TEXT,
  accepted_at INTEGER,
  delivery_route TEXT,
  delivery_note TEXT,
  idempotency_key TEXT,
  idempotency_scope TEXT NOT NULL DEFAULT '',
  idempotency_hash TEXT,
  ingress_source TEXT NOT NULL DEFAULT '',
  app_admission_pending INTEGER,
  app_admission_attempts INTEGER NOT NULL DEFAULT 0,
  app_admission_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, timestamp);
-- Provider retries recover original context independently of today's Task scope.
CREATE INDEX IF NOT EXISTS idx_events_telegram_input ON events(event_type, idempotency_key)
  WHERE source = 'telegram' AND idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp, id);
CREATE INDEX IF NOT EXISTS idx_events_delivery ON events(delivery_status, delivery_route, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_workflow ON events(workflow_run_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project_task ON events(project_id, task_id, timestamp, id);
-- Match taskHistory's filters so routine polls do not add work to bounded reads.
CREATE INDEX IF NOT EXISTS idx_events_project_task_history
  ON events(project_id, task_id, timestamp, id)
  WHERE event_type LIKE 'project.task.%'
    AND event_type <> 'project.task.reconcile.skipped'
    AND NOT (event_type = 'project.task.reconcile.profiled' AND attempt_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_events_task_executor_progress
  ON events(project_id, task_id, id DESC)
  WHERE event_type = 'project.task.executor.progress';
CREATE INDEX IF NOT EXISTS idx_events_handler ON events(handler, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_metric ON events(metric_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_app_conversation_message
  ON events(json_extract(data, '$.appId'), json_extract(data, '$.conversationId'), id)
  WHERE event_type = 'conversation.message.created';
-- Prospective Event rows remain an App-admission obligation until the App route
-- records a complete plan, durable direct acceptance, or inspected no-work.
CREATE INDEX IF NOT EXISTS idx_events_app_admission_pending ON events(id)
  WHERE app_admission_pending = 1;

CREATE TABLE IF NOT EXISTS event_traces (
  event_id INTEGER PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_event_id INTEGER,
  visibility TEXT NOT NULL DEFAULT 'default'
);
CREATE INDEX IF NOT EXISTS idx_event_traces_trace ON event_traces(trace_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_traces_parent ON event_traces(parent_event_id);

CREATE TRIGGER IF NOT EXISTS trg_events_default_trace
AFTER INSERT ON events
BEGIN
  INSERT OR IGNORE INTO event_traces (event_id, trace_id, parent_event_id, visibility)
  VALUES (NEW.id, 'event:' || NEW.id, NULL, 'default');
END;

CREATE TABLE IF NOT EXISTS event_pair_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_name TEXT NOT NULL,
  correlation_key TEXT NOT NULL,
  open_event_id INTEGER NOT NULL,
  close_event_id INTEGER,
  owner TEXT,
  status TEXT DEFAULT 'open',
  opened_at INTEGER NOT NULL,
  expected_close_at INTEGER NOT NULL,
  closed_at INTEGER,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_pair_open_event ON event_pair_runs(open_event_id);
CREATE INDEX IF NOT EXISTS idx_event_pair_close_event ON event_pair_runs(close_event_id);
CREATE INDEX IF NOT EXISTS idx_event_pair_status ON event_pair_runs(status, expected_close_at);

CREATE TABLE IF NOT EXISTS conversation_requests (
  app_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open', 'closed')),
  topic_id TEXT,
  task_refs TEXT NOT NULL DEFAULT '[]',
  closure TEXT,
  update_key TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(app_id, conversation_id, id)
);
CREATE INDEX IF NOT EXISTS idx_conversation_requests_open
  ON conversation_requests(app_id, conversation_id, status, updated_at);

CREATE TABLE IF NOT EXISTS conversation_request_inputs (
  app_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  input_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  PRIMARY KEY(app_id, conversation_id, input_id, request_id),
  FOREIGN KEY(app_id, conversation_id, request_id)
    REFERENCES conversation_requests(app_id, conversation_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_conversation_request_inputs_request
  ON conversation_request_inputs(app_id, conversation_id, request_id, input_id);

CREATE TABLE IF NOT EXISTS conversation_topics (
  id                TEXT PRIMARY KEY,
  app_id            TEXT NOT NULL,
  conversation_id   TEXT NOT NULL,
  title             TEXT NOT NULL,
  opened_by         TEXT NOT NULL,
  origin_message_id TEXT NOT NULL,
  created_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversation_topics_conversation
  ON conversation_topics(app_id, conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversation_input_topic_selections (
  app_id          TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  input_id        TEXT NOT NULL,
  topic_id        TEXT,
  selected_at     INTEGER NOT NULL,
  PRIMARY KEY(app_id, conversation_id, input_id)
);

CREATE TABLE IF NOT EXISTS conversation_topic_tasks (
  topic_id   TEXT NOT NULL,
  app_id     TEXT NOT NULL,
  task_id    TEXT NOT NULL,
  linked_at  INTEGER NOT NULL,
  PRIMARY KEY(topic_id, app_id, task_id),
  FOREIGN KEY(topic_id) REFERENCES conversation_topics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_conversation_topic_tasks_task
  ON conversation_topic_tasks(app_id, task_id);

CREATE TABLE IF NOT EXISTS app_event_admission_plans (
  event_id              INTEGER PRIMARY KEY,
  registry_snapshot_id  TEXT NOT NULL,
  registry_generation   INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  last_error            TEXT,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  completed_at          INTEGER,
  CHECK (registry_generation > 0),
  CHECK (status IN ('pending', 'completed', 'superseded')),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_event_admission_plan_status
  ON app_event_admission_plans(status, updated_at);

CREATE TABLE IF NOT EXISTS app_event_admission_commands (
  event_id              INTEGER NOT NULL,
  app_id                TEXT NOT NULL,
  route_kind            TEXT NOT NULL,
  route_id              TEXT NOT NULL,
  resolved_snapshot_id  TEXT,
  payload_version       INTEGER NOT NULL DEFAULT 2,
  payload               TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  last_error            TEXT,
  admitted_at           INTEGER,
  updated_at            INTEGER NOT NULL,
  PRIMARY KEY(event_id, app_id),
  CHECK (route_kind IN ('inbox', 'task', 'exact-task', 'unresolved', 'noop')),
  CHECK (status IN ('pending', 'admitted', 'superseded')),
  FOREIGN KEY(event_id) REFERENCES app_event_admission_plans(event_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_event_admission_command_status
  ON app_event_admission_commands(app_id, status, updated_at);

CREATE TRIGGER IF NOT EXISTS trg_events_referential_retention
BEFORE DELETE ON events
WHEN
  EXISTS (
    SELECT 1 FROM event_pair_runs p
    WHERE p.open_event_id = OLD.id AND p.status IN ('open', 'orphan')
  )
  OR EXISTS (
    SELECT 1 FROM event_traces t
    WHERE t.parent_event_id = OLD.id AND t.event_id != OLD.id
  )
  OR EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.status IN ('running', 'idle') AND OLD.session_id = s.sessionId
  )
  OR EXISTS (
    SELECT 1 FROM app_event_admission_plans p
    WHERE p.event_id = OLD.id AND p.status = 'pending'
  )
  OR EXISTS (
    SELECT 1 FROM app_inbox_items i
    WHERE i.origin_event_id = OLD.id AND i.status != 'done'
  )
  OR OLD.app_admission_pending = 1
BEGIN
  SELECT RAISE(IGNORE);
END;

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT,
  owner TEXT,
  current REAL,
  target REAL,
  threshold REAL,
  unit TEXT,
  priority TEXT,
  status TEXT DEFAULT 'active',
  blocker TEXT,
  project TEXT,
  source TEXT,
  source_query TEXT,
  source_command TEXT,
  sensitivity REAL,
  measure_interval INTEGER,
  created_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER,
  alert_op TEXT,
  speed TEXT,
  description TEXT,
  direction TEXT,
  config TEXT
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id TEXT,
  value REAL,
  sample_size INTEGER,
  measured_at INTEGER,
  measured_by TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_ms_metric ON metric_snapshots(metric_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_measured_at ON metric_snapshots(measured_at);

CREATE TABLE IF NOT EXISTS metric_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id TEXT,
  alert_type TEXT,
  message TEXT,
  resolved_at INTEGER,
  created_at INTEGER
);
-- Interactive reads skip resolved history and stream the newest open alerts.
CREATE INDEX IF NOT EXISTS idx_ma_open_created ON metric_alerts(created_at DESC, id DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ma_open_metric_created ON metric_alerts(metric_id, created_at DESC, id DESC) WHERE resolved_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_one_open_metric ON metric_alerts(metric_id) WHERE resolved_at IS NULL;


${NOTIFICATION_SCHEMA}

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  owner TEXT,
  status TEXT DEFAULT 'active',
  type TEXT DEFAULT 'milestone',
  workflow TEXT DEFAULT 'project',
  iteration INTEGER DEFAULT 0,
  priority TEXT,
  milestones_done INTEGER DEFAULT 0,
  milestones_total INTEGER DEFAULT 0,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner);

CREATE TABLE IF NOT EXISTS workflow_runs (
  runId TEXT PRIMARY KEY,
  workflow TEXT NOT NULL,
  task TEXT NOT NULL,
  task_ref TEXT,
  task_sha256 TEXT,
  task_bytes INTEGER,
  artifact_ref TEXT,
  artifact_sha256 TEXT,
  artifact_bytes INTEGER,
  parentSessionId TEXT,
  parentWorkflowRunId TEXT,
  projectId TEXT,
  app_id TEXT,
  task_id TEXT,
  task_generation INTEGER,
  attempt_id TEXT,
  depth INTEGER DEFAULT 1,
  status TEXT DEFAULT 'running',
  startedAt INTEGER NOT NULL,
  endedAt INTEGER,
  result_summary TEXT,
  result_reason TEXT,
  resumedFromRunId TEXT,
  sourcePath TEXT,
  sourceScope TEXT,
  entryContentHash TEXT
);
CREATE INDEX IF NOT EXISTS idx_wfr_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_wfr_status_started ON workflow_runs(status, startedAt);
CREATE INDEX IF NOT EXISTS idx_wfr_parent ON workflow_runs(parentSessionId);
CREATE INDEX IF NOT EXISTS idx_wfr_parent_workflow ON workflow_runs(parentWorkflowRunId, startedAt);
CREATE INDEX IF NOT EXISTS idx_wfr_parent_ended ON workflow_runs(parentWorkflowRunId, endedAt, status);
CREATE INDEX IF NOT EXISTS idx_wfr_ended ON workflow_runs(endedAt, runId);
CREATE INDEX IF NOT EXISTS idx_wfr_project_started ON workflow_runs(projectId, startedAt DESC);
CREATE INDEX IF NOT EXISTS idx_wfr_task_binding ON workflow_runs(app_id, task_id, task_generation, attempt_id);
`;

export function applyDbSchema(db: SqliteDb): void {
  // The daemon, web server, and maintenance process can open the same database
  // together after a restart. Serialize the complete shape upgrade so another
  // process cannot observe a table between rename, rebuild, and copy.
  db.exec("BEGIN IMMEDIATE");
  try {
    ensureExistingEventsTableColumns(db);
    ensureExistingAppInboxTableColumns(db);
    ensureExistingTaskBindingColumns(db);
    // Trigger definitions are not replaced by IF NOT EXISTS. Remove the superseded
    // type-specific discovery objects after preserving their exact outstanding subset.
    db.exec("DROP TRIGGER IF EXISTS trg_events_referential_retention");
    db.exec("DROP TABLE IF EXISTS event_trace_links");
    db.exec("DROP VIEW IF EXISTS event_direct_app_recovery_candidates");
    db.exec("DROP INDEX IF EXISTS idx_events_direct_app_recovery");
    db.exec(SCHEMA);
    ensureTaskResourceSchema(db);
    // Lost App-route acknowledgement recovers addressed messages by their
    // originating Event; keep that retry lookup bounded as inbox history grows.
    db.exec(`CREATE INDEX IF NOT EXISTS idx_app_inbox_origin_event
      ON app_inbox_items(origin_event_id) WHERE origin_event_id IS NOT NULL`);
    db.exec(METRIC_DISPOSITION_SCHEMA);
    const metricView = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'metric_dispositions'")
      .get() as { sql: string } | null;
    if (metricView?.sql !== METRIC_DISPOSITION_VIEW) {
      db.exec("DROP VIEW IF EXISTS metric_dispositions");
      db.exec(METRIC_DISPOSITION_VIEW);
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_events_idempotency
      ON events(event_type, ingress_source, idempotency_scope, idempotency_key)
      WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
    `);
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original migration error.
    }
    throw error;
  }
}

const APP_INBOX_COLUMNS: Array<[string, string]> = [
  ["continues_request_id", "TEXT"],
  ["target_task_id", "TEXT"],
  ["topic_id", "TEXT"],
  ["channel", "TEXT"],
  ["channel_target_id", "TEXT"],
  ["channel_thread_id", "TEXT"],
  ["channel_message_id", "INTEGER"],
  ["reply_to_source_id", "TEXT"],
  ["origin_event_id", "INTEGER"],
  ["started_at", "INTEGER"],
  ["changed_at", "INTEGER"],
  ["handling", "TEXT"],
  ["recovery_json", "TEXT"],
  ["task_admission_key", "TEXT"],
  ["execution_task_id", "TEXT"],
  ["creator_json", "TEXT"],
];

function ensureExistingAppInboxTableColumns(db: SqliteDb): void {
  if (!tableExists(db, "app_inbox_items")) return;
  const existing = existingColumns(db, "app_inbox_items");
  const needsChangedAtBackfill = !existing.has("changed_at");
  ensureColumns(db, "app_inbox_items", APP_INBOX_COLUMNS, existing);
  if (needsChangedAtBackfill) {
    db.exec(`
      UPDATE app_inbox_items
      SET changed_at = COALESCE(completed_at, created_at)
      WHERE changed_at IS NULL
    `);
  }
}

const EVENT_COLUMNS: Array<[string, string]> = [
  ["source", "TEXT"],
  ["owner", "TEXT"],
  ["data", "TEXT"],
  ["envelope_json", "TEXT"],
  ["body_ref", "TEXT"],
  ["body_sha256", "TEXT"],
  ["body_bytes", "INTEGER"],
  ["session_id", "TEXT"],
  ["workflow_run_id", "TEXT"],
  ["project_id", "TEXT"],
  ["task_id", "TEXT"],
  ["attempt_id", "TEXT"],
  ["handler", "TEXT"],
  ["metric_id", "TEXT"],
  ["alert_id", "TEXT"],
  ["escalation_id", "TEXT"],
  ["subject_status", "TEXT"],
  ["duration_ms", "INTEGER"],
  ["timestamp", "INTEGER NOT NULL DEFAULT 0"],
  ["ttl_ms", "INTEGER"],
  ["urgency", "TEXT DEFAULT 'normal'"],
  ["delivery_status", "TEXT DEFAULT 'pending'"],
  ["record_only", "INTEGER NOT NULL DEFAULT 0"],
  ["accepted_by", "TEXT"],
  ["accepted_at", "INTEGER"],
  ["delivery_route", "TEXT"],
  ["delivery_note", "TEXT"],
  ["idempotency_key", "TEXT"],
  ["idempotency_scope", "TEXT NOT NULL DEFAULT ''"],
  ["idempotency_hash", "TEXT"],
  ["ingress_source", "TEXT NOT NULL DEFAULT ''"],
  ["app_admission_attempts", "INTEGER NOT NULL DEFAULT 0"],
  ["app_admission_error", "TEXT"],
];

const TASK_BINDING_COLUMNS: Array<[string, string]> = [
  ["app_id", "TEXT"],
  ["task_id", "TEXT"],
  ["task_generation", "INTEGER"],
  ["attempt_id", "TEXT"],
];

function ensureExistingTaskBindingColumns(db: SqliteDb): void {
  for (const table of ["sessions", "workflow_runs"]) {
    if (!tableExists(db, table)) continue;
    ensureColumns(db, table, TASK_BINDING_COLUMNS);
  }
}

function ensureExistingEventsTableColumns(db: SqliteDb): void {
  if (!tableExists(db, "events")) return;
  const existing = existingColumns(db, "events");
  const needsPendingColumn = !existing.has("app_admission_pending");
  ensureColumns(db, "events", EVENT_COLUMNS, existing);
  if (!needsPendingColumn) return;
  db.exec("ALTER TABLE events ADD COLUMN app_admission_pending INTEGER");
  db.exec(`
    UPDATE events SET app_admission_pending = 1
    WHERE event_type = 'conversation.message.created'
      AND delivery_status IN ('pending', 'unhandled')
      AND (json_type(data, '$.approvalReply.hostApproval') = 'object' OR body_ref IS NOT NULL)
  `);
}

function tableExists(db: SqliteDb, table: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

function existingColumns(db: SqliteDb, table: string): Set<string> {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: unknown }>;
  return new Set(columns.flatMap((item) => (typeof item.name === "string" ? [item.name] : [])));
}

function ensureColumns(
  db: SqliteDb,
  table: string,
  definitions: ReadonlyArray<readonly [string, string]>,
  existing = existingColumns(db, table),
): void {
  for (const [column, definition] of definitions) {
    if (existing.has(column)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    existing.add(column);
  }
}

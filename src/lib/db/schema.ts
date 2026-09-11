import type { SqliteDb } from "../db.js";
import { ensureTaskResourceSchema } from "./task-resource-schema.js";

/** Canonical runtime schema. Historical schemas are not supported. */
export const SCHEMA = `
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

CREATE TABLE IF NOT EXISTS evaluations (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  quality         REAL NOT NULL DEFAULT 0,
  efficiency      REAL NOT NULL DEFAULT 0,
  productiveCalls INTEGER NOT NULL DEFAULT 0,
  wastedCalls     INTEGER NOT NULL DEFAULT 0,
  verdict         TEXT NOT NULL DEFAULT 'needs_improvement',
  issues          TEXT,
  overall         TEXT,
  usage           TEXT,
  failureChains   TEXT,
  evaluatedByHeuristic INTEGER NOT NULL DEFAULT 0,
  skippedByJs     INTEGER NOT NULL DEFAULT 0,
  createdAt       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eval_verdict ON evaluations(verdict);
CREATE INDEX IF NOT EXISTS idx_eval_agent_ts ON evaluations(agent, createdAt);
CREATE INDEX IF NOT EXISTS idx_eval_created ON evaluations(createdAt);

CREATE TABLE IF NOT EXISTS session_digests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId      TEXT NOT NULL,
  agent          TEXT NOT NULL,
  trigger        TEXT NOT NULL,
  step           INTEGER NOT NULL,
  task           TEXT,
  task_ref       TEXT,
  task_sha256    TEXT,
  task_bytes     INTEGER,
  what_happened  TEXT,
  outcome        TEXT,
  still_open     TEXT,
  files_modified TEXT,
  details        TEXT,
  action         TEXT,
  action_reason  TEXT,
  created_at     INTEGER NOT NULL,
  UNIQUE(sessionId, step)
);
CREATE INDEX IF NOT EXISTS idx_sd_session ON session_digests(sessionId, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_agent ON session_digests(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_action ON session_digests(action, created_at DESC)
  WHERE action IS NOT NULL;

CREATE TABLE IF NOT EXISTS file_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  agent TEXT NOT NULL,
  filePath TEXT NOT NULL,
  readAt INTEGER NOT NULL,
  producerAgent TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_reads_agent ON file_reads(agent);
CREATE INDEX IF NOT EXISTS idx_file_reads_path ON file_reads(filePath);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  source TEXT,
  owner TEXT,
  data TEXT,
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
  accepted_by TEXT,
  accepted_at INTEGER,
  delivery_route TEXT,
  delivery_note TEXT,
  idempotency_key TEXT,
  idempotency_scope TEXT NOT NULL DEFAULT '',
  idempotency_hash TEXT,
  ingress_source TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp, id);
CREATE INDEX IF NOT EXISTS idx_events_delivery ON events(delivery_status, delivery_route, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_workflow ON events(workflow_run_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project_task ON events(project_id, task_id, timestamp, id);
CREATE INDEX IF NOT EXISTS idx_events_task_executor_progress
  ON events(project_id, task_id, id DESC)
  WHERE event_type = 'project.task.executor.progress';
CREATE INDEX IF NOT EXISTS idx_events_handler ON events(handler, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_metric ON events(metric_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_app_conversation_message
  ON events(json_extract(data, '$.appId'), json_extract(data, '$.conversationId'), id)
  WHERE event_type = 'conversation.message.created';

CREATE TABLE IF NOT EXISTS event_traces (
  event_id INTEGER PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_event_id INTEGER,
  visibility TEXT NOT NULL DEFAULT 'default'
);
CREATE INDEX IF NOT EXISTS idx_event_traces_trace ON event_traces(trace_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_traces_parent ON event_traces(parent_event_id);

CREATE TABLE IF NOT EXISTS event_trace_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_event_id INTEGER NOT NULL,
  to_event_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'reference',
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(from_event_id, to_event_id, type, label)
);
CREATE INDEX IF NOT EXISTS idx_event_trace_links_from ON event_trace_links(from_event_id, type);
CREATE INDEX IF NOT EXISTS idx_event_trace_links_to ON event_trace_links(to_event_id, type);

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
  payload_version       INTEGER NOT NULL DEFAULT 2,
  payload               TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  last_error            TEXT,
  admitted_at           INTEGER,
  updated_at            INTEGER NOT NULL,
  PRIMARY KEY(event_id, app_id),
  CHECK (route_kind IN ('inbox', 'task', 'exact-task')),
  CHECK (status IN ('pending', 'admitted', 'superseded')),
  FOREIGN KEY(event_id) REFERENCES app_event_admission_plans(event_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_event_admission_command_status
  ON app_event_admission_commands(app_id, status, updated_at);

CREATE TABLE IF NOT EXISTS app_inbox_deliveries (
  operation_id         TEXT PRIMARY KEY,
  item_id              TEXT NOT NULL,
  kind                 TEXT NOT NULL DEFAULT 'final',
  text                 TEXT,
  session_id           TEXT NOT NULL,
  request_id           TEXT NOT NULL,
  channel              TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',
  external_message_id  TEXT,
  failure_reason       TEXT,
  receipt_event_id     INTEGER,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL,
  attempted_at         INTEGER,
  completed_at         INTEGER,
  CHECK (kind IN ('progress', 'final')),
  CHECK (status IN ('pending', 'sending', 'delivered', 'failed', 'uncertain'))
);
CREATE INDEX IF NOT EXISTS idx_app_inbox_delivery_status
  ON app_inbox_deliveries(status, created_at);
CREATE INDEX IF NOT EXISTS idx_app_inbox_delivery_item
  ON app_inbox_deliveries(item_id, created_at);

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
    SELECT 1 FROM event_trace_links l
    WHERE l.from_event_id = OLD.id OR l.to_event_id = OLD.id
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

CREATE TABLE IF NOT EXISTS notification_messages (
  telegram_msg_id INTEGER PRIMARY KEY,
  event_type TEXT,
  agent TEXT,
  session_id TEXT,
  project_id TEXT,
  data TEXT,
  sent_at INTEGER
);

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
CREATE INDEX IF NOT EXISTS idx_wfr_project_started ON workflow_runs(projectId, startedAt DESC);
CREATE INDEX IF NOT EXISTS idx_wfr_task_binding ON workflow_runs(app_id, task_id, task_generation, attempt_id);
`;

export function applyDbSchema(db: SqliteDb): void {
  // The daemon, web server, and maintenance process can open the same database
  // together after a restart. Serialize the complete shape upgrade so another
  // process cannot observe a table between rename, rebuild, and copy.
  db.exec("BEGIN IMMEDIATE");
  try {
    // Only databases created before event traces existed need the historical
    // backfill. Once the table exists, the insert trigger below owns all new
    // rows; rescanning the complete event journal on every process start makes
    // startup proportional to retained history.
    const needsEventTraceBackfill = tableExists(db, "events") && !tableExists(db, "event_traces");
    ensureExistingEventsTableColumns(db);
    ensureExistingAppInboxTableColumns(db);
    ensureExistingAppInboxWaitKinds(db);
    ensureExistingTaskBindingColumns(db);
    // Trigger definitions are not replaced by CREATE TRIGGER IF NOT EXISTS.
    // Recreate this retention fence so existing databases gain every new durable
    // reference added to the canonical schema.
    db.exec("DROP TRIGGER IF EXISTS trg_events_referential_retention");
    db.exec(SCHEMA);
    if (needsEventTraceBackfill) {
      db.exec(`
        INSERT OR IGNORE INTO event_traces (event_id, trace_id, parent_event_id, visibility)
        SELECT id, 'event:' || id, NULL, 'default' FROM events
      `);
    }
    ensureTaskResourceSchema(db);
    ensureExistingAppInboxDeliveryShape(db);
    ensureExistingEventsTableColumns(db);
    ensureExistingAppInboxTableColumns(db);
    ensureExistingAppEventAdmissionColumns(db);
    retireConversationChildWaits(db);
    ensureExistingTaskBindingColumns(db);
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

/** Progress and final replies are separate durable operations for one request. */
function ensureExistingAppInboxDeliveryShape(db: SqliteDb): void {
  if (!tableExists(db, "app_inbox_deliveries")) return;
  const columns = db.prepare("PRAGMA table_info(app_inbox_deliveries)").all() as Array<{
    name?: unknown;
    pk?: unknown;
  }>;
  const hasKind = columns.some((column) => column.name === "kind");
  const hasText = columns.some((column) => column.name === "text");
  const operationPrimary = columns.some((column) => column.name === "operation_id" && column.pk === 1);
  if (hasKind && hasText && operationPrimary) return;
  db.exec(`
    DROP INDEX IF EXISTS idx_app_inbox_delivery_status;
    DROP INDEX IF EXISTS idx_app_inbox_delivery_item;
    ALTER TABLE app_inbox_deliveries RENAME TO app_inbox_deliveries_before_progress;
    CREATE TABLE app_inbox_deliveries (
      operation_id         TEXT PRIMARY KEY,
      item_id              TEXT NOT NULL,
      kind                 TEXT NOT NULL DEFAULT 'final',
      text                 TEXT,
      session_id           TEXT NOT NULL,
      request_id           TEXT NOT NULL,
      channel              TEXT NOT NULL,
      status               TEXT NOT NULL DEFAULT 'pending',
      external_message_id  TEXT,
      failure_reason       TEXT,
      receipt_event_id     INTEGER,
      created_at           INTEGER NOT NULL,
      updated_at           INTEGER NOT NULL,
      attempted_at         INTEGER,
      completed_at         INTEGER,
      CHECK (kind IN ('progress', 'final')),
      CHECK (status IN ('pending', 'sending', 'delivered', 'failed', 'uncertain'))
    );
    INSERT INTO app_inbox_deliveries (
      operation_id, item_id, kind, text, session_id, request_id, channel,
      status, external_message_id, failure_reason, receipt_event_id,
      created_at, updated_at, attempted_at, completed_at
    )
    SELECT
      operation_id, item_id, 'final', NULL, session_id, request_id, channel,
      status, external_message_id, failure_reason, receipt_event_id,
      created_at, updated_at, attempted_at, completed_at
    FROM app_inbox_deliveries_before_progress;
    DROP TABLE app_inbox_deliveries_before_progress;
    CREATE INDEX idx_app_inbox_delivery_status
      ON app_inbox_deliveries(status, created_at);
    CREATE INDEX idx_app_inbox_delivery_item
      ON app_inbox_deliveries(item_id, created_at);
  `);
}

/** SQLite cannot widen a CHECK constraint in place. Rebuild only the inbox table. */
function ensureExistingAppInboxWaitKinds(db: SqliteDb): void {
  if (!tableExists(db, "app_inbox_items")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'app_inbox_items'").get() as
    { sql?: unknown } | undefined;
  if (typeof row?.sql === "string" && row.sql.includes("'analysis'")) return;
  db.exec(`
    ALTER TABLE app_inbox_items RENAME TO app_inbox_items_before_analysis_wait;
    CREATE TABLE app_inbox_items (
      id                  TEXT PRIMARY KEY,
      app_id              TEXT NOT NULL,
      parent_id           TEXT,
      continues_request_id TEXT,
      conversation_id     TEXT,
      conversation_seq    INTEGER,
      channel             TEXT,
      channel_target_id   TEXT,
      channel_thread_id   TEXT,
      channel_message_id  INTEGER,
      reply_to_source_id  TEXT,
      source_kind         TEXT NOT NULL,
      source_id           TEXT NOT NULL,
      input_kind          TEXT NOT NULL,
      input_data          TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending',
      session_id          TEXT,
      waiting_on_kind     TEXT,
      waiting_on_id       TEXT,
      result              TEXT,
      available_at        INTEGER,
      review_at           INTEGER,
      lease_generation    INTEGER NOT NULL DEFAULT 0,
      lease_owner         TEXT,
      lease_expires_at    INTEGER,
      origin_event_id     INTEGER,
      idempotency_key     TEXT,
      created_at          INTEGER NOT NULL,
      started_at          INTEGER,
      changed_at          INTEGER,
      updated_at          INTEGER NOT NULL,
      completed_at        INTEGER,
      CHECK (source_kind IN ('human', 'app', 'system')),
      CHECK (status IN ('pending', 'handling', 'done')),
      CHECK (waiting_on_kind IS NULL OR waiting_on_kind IN ('app', 'task', 'session', 'analysis'))
    );
    INSERT INTO app_inbox_items (
      id, app_id, parent_id, continues_request_id, conversation_id, conversation_seq, channel,
      channel_target_id, channel_thread_id, channel_message_id, reply_to_source_id, source_kind, source_id, input_kind,
      input_data, status, session_id, waiting_on_kind, waiting_on_id, result,
      available_at, review_at, lease_generation, lease_owner, lease_expires_at,
      origin_event_id, idempotency_key, created_at, started_at, changed_at, updated_at, completed_at
    )
    SELECT
      id, app_id, parent_id, NULL, conversation_id, conversation_seq, channel,
      channel_target_id, channel_thread_id, channel_message_id, reply_to_source_id, source_kind, source_id, input_kind,
      input_data, status, session_id, waiting_on_kind, waiting_on_id, result,
      available_at, review_at, lease_generation, lease_owner, lease_expires_at,
      origin_event_id, idempotency_key, created_at, started_at, changed_at, updated_at, completed_at
    FROM app_inbox_items_before_analysis_wait;
    DROP TABLE app_inbox_items_before_analysis_wait;
  `);
  // The historical rebuild has a fixed column list. Restore additive columns
  // before the canonical schema creates indexes that depend on them.
  ensureExistingAppInboxTableColumns(db);
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
  ["task_admission_key", "TEXT"],
  ["execution_task_id", "TEXT"],
];

function ensureExistingAppInboxTableColumns(db: SqliteDb): void {
  if (!tableExists(db, "app_inbox_items")) return;
  for (const [column, definition] of APP_INBOX_COLUMNS) {
    ensureColumn(db, "app_inbox_items", column, definition);
  }
  db.exec(`
    UPDATE app_inbox_items
    SET changed_at = COALESCE(completed_at, created_at)
    WHERE changed_at IS NULL
  `);
}

function ensureExistingAppEventAdmissionColumns(db: SqliteDb): void {
  if (tableExists(db, "app_event_admission_plans")) {
    ensureColumn(db, "app_event_admission_plans", "registry_snapshot_id", "TEXT NOT NULL DEFAULT 'legacy:unknown'");
  }
  if (tableExists(db, "app_event_admission_commands")) {
    ensureColumn(db, "app_event_admission_commands", "payload_version", "INTEGER NOT NULL DEFAULT 1");
  }
}

const EVENT_COLUMNS: Array<[string, string]> = [
  ["source", "TEXT"],
  ["owner", "TEXT"],
  ["data", "TEXT"],
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
  ["accepted_by", "TEXT"],
  ["accepted_at", "INTEGER"],
  ["delivery_route", "TEXT"],
  ["delivery_note", "TEXT"],
  ["idempotency_key", "TEXT"],
  ["idempotency_scope", "TEXT NOT NULL DEFAULT ''"],
  ["idempotency_hash", "TEXT"],
  ["ingress_source", "TEXT NOT NULL DEFAULT ''"],
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
    for (const [column, definition] of TASK_BINDING_COLUMNS) {
      ensureColumn(db, table, column, definition);
    }
  }
}

function ensureExistingEventsTableColumns(db: SqliteDb): void {
  if (!tableExists(db, "events")) return;
  for (const [column, definition] of EVENT_COLUMNS) {
    ensureColumn(db, "events", column, definition);
  }
}

function tableExists(db: SqliteDb, table: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

function ensureColumn(db: SqliteDb, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: unknown }>;
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** Retire the removed frontend protocol once, without replaying or cancelling its Tasks. */
function retireConversationChildWaits(db: SqliteDb): void {
  const reason = "Conversational child-result waiting is no longer supported.";
  const response =
    "This older turn can no longer wait for child results. Your ask remains unresolved. " +
    "Any work already admitted continues independently; its results and history remain available. " +
    "Send a new message to review that work and decide what is still needed.";
  const now = Date.now();
  db.run(
    `UPDATE app_inbox_items AS parent
     SET status = 'done',
         handling = json_set(COALESCE(handling, '{}'), '$.phase', 'failed', '$.reason', ?),
         result = json_set(COALESCE(result, '{}'), '$.summary', ?, '$.response', ?),
         available_at = NULL, review_at = NULL,
         lease_generation = lease_generation + 1, lease_owner = NULL, lease_expires_at = NULL,
         completed_at = ?, changed_at = ?, updated_at = ?
     WHERE status != 'done' AND (
       (waiting_on_kind = 'app' AND waiting_on_id = 'children:' || id)
       OR (conversation_id IS NOT NULL AND (
         waiting_on_kind = 'app'
         OR EXISTS (SELECT 1 FROM app_inbox_items child WHERE child.parent_id = parent.id)
         OR json_array_length(handling, '$.decision.dependencies') > 0
       ))
     )`,
    [reason, reason, response, now, now, now],
  );
}

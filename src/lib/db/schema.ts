import type { SqliteDb } from "../db.js";

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
CREATE INDEX IF NOT EXISTS idx_sess_started ON sessions(startedAt);
CREATE INDEX IF NOT EXISTS idx_sess_activity ON sessions(lastActivityAt);

CREATE TABLE IF NOT EXISTS gym_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  agent_name TEXT NOT NULL,
  lab_fork TEXT,
  scenario TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  score_summary TEXT,
  session_id TEXT,
  cost_usd REAL,
  total_ops INTEGER,
  total_turns INTEGER,
  method TEXT DEFAULT 'oneshot',
  run_tag TEXT,
  prompt_hash TEXT,
  framework_sha TEXT,
  model TEXT,
  batch_id TEXT,
  categories TEXT,
  tags TEXT,
  tier TEXT
);
CREATE INDEX IF NOT EXISTS idx_gym_runs_scenario ON gym_runs(scenario);
CREATE INDEX IF NOT EXISTS idx_gym_runs_agent ON gym_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_gym_runs_timestamp ON gym_runs(timestamp);
CREATE INDEX IF NOT EXISTS idx_gym_runs_batch ON gym_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_gym_runs_prompt ON gym_runs(prompt_hash);

CREATE TABLE IF NOT EXISTS gym_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  check_name TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  category TEXT,
  code TEXT,
  FOREIGN KEY(run_id) REFERENCES gym_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gym_checks_run ON gym_checks(run_id);

CREATE TABLE IF NOT EXISTS gym_prompts (
  prompt_hash TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  model TEXT,
  framework_sha TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  prompt_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS convention_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  convention TEXT NOT NULL,
  passed INTEGER NOT NULL,
  violations TEXT,
  checked_at INTEGER NOT NULL,
  UNIQUE(session_id, convention)
);
CREATE INDEX IF NOT EXISTS idx_cc_agent ON convention_checks(agent, convention, checked_at);
CREATE INDEX IF NOT EXISTS idx_cc_conv ON convention_checks(convention, checked_at);

CREATE TABLE IF NOT EXISTS convention_maturity (
  convention TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'active',
  level_since INTEGER,
  last_regression INTEGER
);

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

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  claim TEXT,
  evidence_refs TEXT,
  discovered TEXT,
  last_verified TEXT,
  raw_content TEXT NOT NULL,
  synced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ke_status ON knowledge_entries(status);

CREATE TABLE IF NOT EXISTS hypotheses (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  priority TEXT,
  proposed_by TEXT,
  hypothesis TEXT,
  raw_content TEXT NOT NULL,
  synced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hyp_status ON hypotheses(status);
CREATE INDEX IF NOT EXISTS idx_hyp_priority ON hypotheses(priority);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  hypothesis_ref TEXT,
  result_summary TEXT,
  raw_content TEXT NOT NULL,
  synced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exp_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_exp_hyp ON experiments(hypothesis_ref);

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
CREATE INDEX IF NOT EXISTS idx_events_delivery ON events(delivery_status, delivery_route, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_workflow ON events(workflow_run_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_handler ON events(handler, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_metric ON events(metric_id, timestamp);

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

INSERT OR IGNORE INTO event_traces (event_id, trace_id, parent_event_id, visibility)
SELECT id, 'event:' || id, NULL, 'default' FROM events;

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
CREATE INDEX IF NOT EXISTS idx_event_pair_status ON event_pair_runs(status, expected_close_at);

CREATE TABLE IF NOT EXISTS app_inbox_items (
  id                  TEXT PRIMARY KEY,
  app_id              TEXT NOT NULL,
  parent_id           TEXT,
  conversation_id     TEXT,
  conversation_seq    INTEGER,
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
  idempotency_key     TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  completed_at        INTEGER,
  CHECK (source_kind IN ('human', 'app', 'system')),
  CHECK (status IN ('pending', 'handling', 'done')),
  CHECK (waiting_on_kind IS NULL OR waiting_on_kind IN ('app', 'task', 'session'))
);
CREATE INDEX IF NOT EXISTS idx_app_inbox_ready
  ON app_inbox_items(app_id, status, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_app_inbox_waiting
  ON app_inbox_items(waiting_on_kind, waiting_on_id, status);
CREATE INDEX IF NOT EXISTS idx_app_inbox_parent
  ON app_inbox_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_app_inbox_conversation
  ON app_inbox_items(app_id, conversation_id, conversation_seq);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_inbox_idempotency
  ON app_inbox_items(app_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_inbox_conversation_sequence
  ON app_inbox_items(app_id, conversation_id, conversation_seq)
  WHERE conversation_id IS NOT NULL AND conversation_seq IS NOT NULL;

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
CREATE INDEX IF NOT EXISTS idx_wfr_parent ON workflow_runs(parentSessionId);
CREATE INDEX IF NOT EXISTS idx_wfr_project_started ON workflow_runs(projectId, startedAt DESC);
`;

export function applyDbSchema(db: SqliteDb): void {
  ensureExistingEventsTableColumns(db);
  db.exec(SCHEMA);
  ensureExistingEventsTableColumns(db);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_events_idempotency
    ON events(event_type, ingress_source, idempotency_scope, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
  `);
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

function ensureExistingEventsTableColumns(db: SqliteDb): void {
  if (!tableExists(db, "events")) return;
  for (const [column, definition] of EVENT_COLUMNS) {
    ensureColumn(db, "events", column, definition);
  }
}

function tableExists(db: SqliteDb, table: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  return Boolean(row);
}

function ensureColumn(db: SqliteDb, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: unknown }>;
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

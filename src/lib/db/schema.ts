import type { SqliteDb } from "../db.js";
import { DEFAULT_OWNER_DELIVERY_NOTE } from "../event-delivery.js";

export const SCHEMA = `
-- Sessions: queryable index of per-session meta.json files.
-- Source of truth is meta.json on disk; this table is for SQL queries and joins.
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
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  lastActivityAt  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sess_agent   ON sessions(agent);
CREATE INDEX IF NOT EXISTS idx_sess_status  ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sess_parent  ON sessions(parentSessionId);
CREATE INDEX IF NOT EXISTS idx_sess_workflow ON sessions(workflowRunId);
CREATE INDEX IF NOT EXISTS idx_sess_started ON sessions(startedAt);

-- Gym benchmark runs and checks
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

CREATE TABLE IF NOT EXISTS gym_prompts (
  prompt_hash TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  model TEXT,
  framework_sha TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  prompt_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gym_runs_scenario ON gym_runs(scenario);
CREATE INDEX IF NOT EXISTS idx_gym_runs_agent ON gym_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_gym_runs_timestamp ON gym_runs(timestamp);
CREATE INDEX IF NOT EXISTS idx_gym_checks_run ON gym_checks(run_id);

-- Convention checks (P1: mechanical compliance checker)
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

CREATE TABLE IF NOT EXISTS convention_maturity (
  convention TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'active',
  level_since INTEGER,
  last_regression INTEGER
);

-- Evaluations (migrated from .state/evaluations/*.json files)
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

CREATE INDEX IF NOT EXISTS idx_cc_agent ON convention_checks(agent, convention, checked_at);
CREATE INDEX IF NOT EXISTS idx_cc_conv  ON convention_checks(convention, checked_at);
CREATE INDEX IF NOT EXISTS idx_eval_verdict   ON evaluations(verdict);

-- Session Digests — structured lifecycle understanding per session
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
CREATE INDEX IF NOT EXISTS idx_sd_agent   ON session_digests(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_action  ON session_digests(action, created_at DESC)
  WHERE action IS NOT NULL;

-- Research System Tables (knowledge base, hypotheses, experiments)
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id              TEXT PRIMARY KEY,
  title           TEXT,
  status          TEXT,
  claim           TEXT,
  evidence_refs   TEXT,
  discovered      TEXT,
  last_verified   TEXT,
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ke_status ON knowledge_entries(status);

CREATE TABLE IF NOT EXISTS hypotheses (
  id              TEXT PRIMARY KEY,
  title           TEXT,
  status          TEXT,
  priority        TEXT,
  proposed_by     TEXT,
  hypothesis      TEXT,
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hyp_status   ON hypotheses(status);
CREATE INDEX IF NOT EXISTS idx_hyp_priority ON hypotheses(priority);

CREATE TABLE IF NOT EXISTS experiments (
  id              TEXT PRIMARY KEY,
  title           TEXT,
  status          TEXT,
  hypothesis_ref  TEXT,
  result_summary  TEXT,
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exp_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_exp_hyp    ON experiments(hypothesis_ref);

CREATE TABLE IF NOT EXISTS file_reads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId       TEXT NOT NULL,
  agent           TEXT NOT NULL,
  filePath        TEXT NOT NULL,
  readAt          INTEGER NOT NULL,
  producerAgent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_reads_agent ON file_reads(agent);
CREATE INDEX IF NOT EXISTS idx_file_reads_path  ON file_reads(filePath);

CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type      TEXT NOT NULL,
  source          TEXT,
  owner           TEXT,
  data            TEXT,
  body_ref        TEXT,
  body_sha256     TEXT,
  body_bytes      INTEGER,
  session_id      TEXT,
  workflow_run_id TEXT,
  project_id      TEXT,
  task_id         TEXT,
  attempt_id      TEXT,
  handler         TEXT,
  metric_id       TEXT,
  alert_id        TEXT,
  escalation_id  TEXT,
  subject_status  TEXT,
  duration_ms     INTEGER,
  timestamp       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type  ON events(event_type, timestamp);

CREATE TABLE IF NOT EXISTS event_traces (
  event_id        INTEGER PRIMARY KEY,
  trace_id        TEXT NOT NULL,
  parent_event_id INTEGER,
  visibility      TEXT NOT NULL DEFAULT 'default'
);
CREATE INDEX IF NOT EXISTS idx_event_traces_trace ON event_traces(trace_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_traces_parent ON event_traces(parent_event_id);

CREATE TABLE IF NOT EXISTS event_trace_links (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  from_event_id   INTEGER NOT NULL,
  to_event_id     INTEGER NOT NULL,
  type            TEXT NOT NULL DEFAULT 'reference',
  label           TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
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

CREATE TABLE IF NOT EXISTS runtime_migrations (
  key        TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS event_pair_runs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_name          TEXT NOT NULL,
  correlation_key    TEXT NOT NULL,
  open_event_id      INTEGER NOT NULL,
  close_event_id     INTEGER,
  owner              TEXT,
  status             TEXT DEFAULT 'open',
  opened_at          INTEGER NOT NULL,
  expected_close_at  INTEGER NOT NULL,
  closed_at          INTEGER,
  note               TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_pair_open_event ON event_pair_runs(open_event_id);
CREATE INDEX IF NOT EXISTS idx_event_pair_status ON event_pair_runs(status, expected_close_at);

-- Retention is allowed to prune unreferenced detail, but never the evidence
-- that makes retained or active work explainable. RAISE(IGNORE) lets existing
-- batched cleanup statements continue while preserving protected rows.
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
    SELECT 1
    FROM sessions s
    WHERE s.status IN ('running', 'idle')
      AND json_valid(OLD.data)
      AND json_extract(OLD.data, '$.sessionId') = s.sessionId
  )
BEGIN
  SELECT RAISE(IGNORE);
END;

CREATE TABLE IF NOT EXISTS metrics (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  type            TEXT,
  owner           TEXT,
  current         REAL,
  target          REAL,
  threshold       REAL,
  unit            TEXT,
  priority        TEXT,
  status          TEXT DEFAULT 'active',
  blocker         TEXT,
  project         TEXT,
  source          TEXT,
  source_query    TEXT,
  source_command  TEXT,
  sensitivity     REAL,
  measure_interval INTEGER,
  created_at      INTEGER,
  updated_at      INTEGER NOT NULL DEFAULT 0,
  closed_at       INTEGER,
  alert_op        TEXT,
  speed           TEXT,
  description     TEXT,
  direction       TEXT
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id       TEXT,
  value           REAL,
  sample_size     INTEGER,
  measured_at     INTEGER,
  measured_by     TEXT,
  note            TEXT
);
CREATE INDEX IF NOT EXISTS idx_ms_metric ON metric_snapshots(metric_id, measured_at);

CREATE TABLE IF NOT EXISTS metric_alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id       TEXT,
  alert_type      TEXT,
  message         TEXT,
  resolved_at     INTEGER,
  created_at      INTEGER
);

CREATE TABLE IF NOT EXISTS notification_messages (
  telegram_msg_id  INTEGER PRIMARY KEY,
  event_type       TEXT,
  agent            TEXT,
  session_id       TEXT,
  project_id       TEXT,
  data             TEXT,
  sent_at          INTEGER
);

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  path            TEXT NOT NULL,
  name            TEXT NOT NULL,
  owner           TEXT,
  status          TEXT DEFAULT 'active',
  type            TEXT DEFAULT 'milestone',
  workflow        TEXT DEFAULT 'project',
  iteration       INTEGER DEFAULT 0,
  priority        TEXT,
  milestones_done INTEGER DEFAULT 0,
  milestones_total INTEGER DEFAULT 0,
  updated_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner  ON projects(owner);

-- Workflow runs: bounded query projection of .state/workflow-runs/<id>/run.json.
CREATE TABLE IF NOT EXISTS workflow_runs (
  runId               TEXT PRIMARY KEY,
  workflow            TEXT NOT NULL,
  task                TEXT NOT NULL,
  task_ref            TEXT,
  task_sha256         TEXT,
  task_bytes          INTEGER,
  artifact_ref        TEXT,
  artifact_sha256     TEXT,
  artifact_bytes      INTEGER,
  parentSessionId     TEXT,
  parentWorkflowRunId TEXT,
  projectId           TEXT,
  depth               INTEGER DEFAULT 1,
  status              TEXT DEFAULT 'running',
  startedAt           INTEGER NOT NULL,
  endedAt             INTEGER,
  result_summary      TEXT,
  result_reason       TEXT,
  resumedFromRunId    TEXT,
  sourcePath          TEXT,
  sourceScope         TEXT,
  entryContentHash    TEXT
);
CREATE INDEX IF NOT EXISTS idx_wfr_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_wfr_parent ON workflow_runs(parentSessionId);
`;

export function applyDbSchemaAndMigrations(db: SqliteDb): void {
  db.exec(SCHEMA);
  const migrationStartedAt = Date.now();

  // gym_runs columns added after initial schema
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN run_tag TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN prompt_hash TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN framework_sha TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN model TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN batch_id TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN categories TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN tags TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE gym_runs ADD COLUMN tier TEXT");
  } catch {
    /* already exists */
  }

  // Indexes on migrated columns (must come after ALTER TABLE).
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_gym_runs_batch ON gym_runs(batch_id)");
  } catch {
    /* already exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_gym_runs_prompt ON gym_runs(prompt_hash)");
  } catch {
    /* already exists */
  }

  try {
    db.exec("ALTER TABLE sessions ADD COLUMN projectId TEXT");
  } catch {
    /* already exists */
  }
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN lastActivityAt INTEGER");
  } catch {
    /* already exists */
  }
  for (const [column, type] of [
    ["task_ref", "TEXT"],
    ["task_sha256", "TEXT"],
    ["task_bytes", "INTEGER"],
    ["result_ref", "TEXT"],
    ["result_sha256", "TEXT"],
    ["result_bytes", "INTEGER"],
  ] as const) {
    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN ${column} ${type}`);
    } catch {
      /* already exists */
    }
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_sess_project ON sessions(projectId)");
  } catch {
    /* already exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_sess_activity ON sessions(lastActivityAt)");
  } catch {
    /* already exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_sess_workflow ON sessions(workflowRunId)");
  } catch {
    /* already exists */
  }

  try {
    db.exec("ALTER TABLE workflow_runs ADD COLUMN projectId TEXT");
  } catch {
    /* already exists */
  }
  for (const [column, type] of [
    ["sourcePath", "TEXT"],
    ["sourceScope", "TEXT"],
    ["entryContentHash", "TEXT"],
    ["task_ref", "TEXT"],
    ["task_sha256", "TEXT"],
    ["task_bytes", "INTEGER"],
    ["artifact_ref", "TEXT"],
    ["artifact_sha256", "TEXT"],
    ["artifact_bytes", "INTEGER"],
  ] as const) {
    try {
      db.exec(`ALTER TABLE workflow_runs ADD COLUMN ${column} ${type}`);
    } catch {
      /* already exists */
    }
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_wfr_project ON workflow_runs(projectId)");
  } catch {
    /* already exists */
  }
  try {
    db.run("UPDATE workflow_runs SET parentSessionId = NULL WHERE parentSessionId = 'unknown'");
  } catch {
    /* best-effort cleanup */
  }
  try {
    db.run(`
      UPDATE workflow_runs
      SET projectId = (
        SELECT MAX(s.projectId)
        FROM sessions s
        WHERE s.workflowRunId = workflow_runs.runId
          AND s.projectId IS NOT NULL
          AND s.projectId != ''
      )
      WHERE (projectId IS NULL OR projectId = '')
        AND (
          SELECT COUNT(DISTINCT s.projectId)
          FROM sessions s
          WHERE s.workflowRunId = workflow_runs.runId
            AND s.projectId IS NOT NULL
            AND s.projectId != ''
        ) = 1
    `);
  } catch {
    /* best-effort backfill */
  }

  // Events table migrations (columns added after initial schema).
  const eventCols = [
    "status",
    "handled_by",
    "result",
    "reason",
    "retry_count",
    "ttl_ms",
    "urgency",
    "delivery_status",
    "accepted_by",
    "accepted_at",
    "delivery_route",
    "delivery_note",
  ];
  for (const col of eventCols) {
    try {
      const defaultVal =
        col === "status" || col === "delivery_status"
          ? " DEFAULT 'pending'"
          : col === "retry_count"
            ? " DEFAULT 0"
            : col === "urgency"
              ? " DEFAULT 'normal'"
              : "";
      const colType = col === "retry_count" || col === "ttl_ms" || col === "accepted_at" ? "INTEGER" : "TEXT";
      db.exec(`ALTER TABLE events ADD COLUMN ${col} ${colType}${defaultVal}`);
    } catch {
      /* already exists */
    }
  }
  for (const [column, type] of [
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
  ] as const) {
    try {
      db.exec(`ALTER TABLE events ADD COLUMN ${column} ${type}`);
    } catch {
      /* already exists */
    }
  }
  try {
    db.exec("DROP INDEX IF EXISTS idx_event_pair_open_event");
    db.exec("CREATE INDEX IF NOT EXISTS idx_event_pair_open_event ON event_pair_runs(open_event_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_inbox ON events(owner, status, timestamp)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_delivery ON events(delivery_status, delivery_route, timestamp)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_event_traces_trace ON event_traces(trace_id, event_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_event_traces_parent ON event_traces(parent_event_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_event_trace_links_from ON event_trace_links(from_event_id, type)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_event_trace_links_to ON event_trace_links(to_event_id, type)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, timestamp)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_workflow ON events(workflow_run_id, timestamp)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id, timestamp)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_handler ON events(handler, timestamp)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_metric ON events(metric_id, timestamp)");
  } catch {
    /* already exists */
  }
  try {
    const marker = db.prepare("SELECT key FROM runtime_migrations WHERE key = ?").get("event_delivery_legacy_baseline");
    if (!marker) {
      db.run(
        `UPDATE events
         SET delivery_status = 'accepted',
             accepted_by = 'legacy:event-store',
             accepted_at = timestamp,
             delivery_route = 'noop',
             delivery_note = 'pre-delivery-tracking event baseline'
         WHERE delivery_status = 'pending'
           AND accepted_by IS NULL
           AND delivery_route IS NULL
           AND delivery_note IS NULL
           AND timestamp < ?`,
        [migrationStartedAt],
      );
      db.run("INSERT INTO runtime_migrations (key, applied_at) VALUES (?, ?)", [
        "event_delivery_legacy_baseline",
        migrationStartedAt,
      ]);
    }
  } catch {
    /* best-effort legacy baseline */
  }
  try {
    const marker = db.prepare("SELECT key FROM runtime_migrations WHERE key = ?").get("event_delivery_default_owner_baseline");
    if (!marker) {
      const migrationStartedAt = Date.now();
      db.run(
        `UPDATE events
         SET delivery_status = 'accepted',
             accepted_by = 'default-owner:' || owner,
             accepted_at = timestamp,
             delivery_route = 'direct',
             delivery_note = ?
         WHERE delivery_status IN ('pending', 'unhandled')
           AND owner IS NOT NULL
           AND trim(owner) != ''
           AND timestamp < ?`,
        [DEFAULT_OWNER_DELIVERY_NOTE, migrationStartedAt],
      );
      db.run("INSERT INTO runtime_migrations (key, applied_at) VALUES (?, ?)", [
        "event_delivery_default_owner_baseline",
        migrationStartedAt,
      ]);
    }
  } catch {
    /* best-effort default owner baseline */
  }

  // Evaluations table migrations.
  try {
    db.exec("ALTER TABLE evaluations ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0");
  } catch {
    /* exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_eval_agent_ts ON evaluations(agent, createdAt)");
  } catch {
    /* exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_eval_created ON evaluations(createdAt)");
  } catch {
    /* exists */
  }
  try {
    db.exec("ALTER TABLE evaluations ADD COLUMN evaluatedByHeuristic INTEGER NOT NULL DEFAULT 0");
  } catch {
    /* exists */
  }
  try {
    db.exec("ALTER TABLE evaluations ADD COLUMN skippedByJs INTEGER NOT NULL DEFAULT 0");
  } catch {
    /* exists */
  }

  // Event columns for TTL and urgency (event-native: no mutable status columns).
  for (const col of ["ttl_ms INTEGER", "urgency TEXT DEFAULT 'normal'"]) {
    try {
      db.exec(`ALTER TABLE events ADD COLUMN ${col}`);
    } catch {
      /* already exists */
    }
  }

  // Session stepLabel column (unified session model — workflow steps tracked via sessions table).
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN stepLabel TEXT");
  } catch {
    /* already exists */
  }
  for (const [column, type] of [
    ["task_ref", "TEXT"],
    ["task_sha256", "TEXT"],
    ["task_bytes", "INTEGER"],
  ] as const) {
    try {
      db.exec(`ALTER TABLE session_digests ADD COLUMN ${column} ${type}`);
    } catch {
      /* already exists */
    }
  }
  // Typed metrics: config JSON column for type-specific measurement + alert rules.
  try {
    db.exec("ALTER TABLE metrics ADD COLUMN config TEXT");
  } catch {
    /* already exists */
  }
  // Metric priority gates direct reactions: only P0 breaches should fork immediately.
  try {
    db.exec("ALTER TABLE metrics ADD COLUMN priority TEXT");
  } catch {
    /* already exists */
  }

  // Existing databases retain the old JSON-only trigger until explicitly replaced.
  try {
    const marker = db.prepare("SELECT key FROM runtime_migrations WHERE key = ?").get("event_retention_typed_session_v1");
    if (!marker) {
      db.exec("DROP TRIGGER IF EXISTS trg_events_referential_retention");
      db.exec(`
CREATE TRIGGER trg_events_referential_retention
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
    SELECT 1
    FROM sessions s
    WHERE s.status IN ('running', 'idle')
      AND COALESCE(
        OLD.session_id,
        CASE WHEN json_valid(OLD.data) THEN json_extract(OLD.data, '$.sessionId') END
      ) = s.sessionId
  )
BEGIN
  SELECT RAISE(IGNORE);
END`);
      db.run("INSERT INTO runtime_migrations (key, applied_at) VALUES (?, ?)", [
        "event_retention_typed_session_v1",
        Date.now(),
      ]);
    }
  } catch {
    /* best-effort trigger migration */
  }

}

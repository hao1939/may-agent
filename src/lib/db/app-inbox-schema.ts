/** Request rows share Task transactions, including standalone state tests. */
export const APP_INBOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS app_inbox_items (
  id                  TEXT PRIMARY KEY,
  app_id              TEXT NOT NULL,
  parent_id           TEXT,
  target_task_id      TEXT,
  topic_id            TEXT,
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
  handling            TEXT,
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
CREATE INDEX IF NOT EXISTS idx_app_inbox_ready
  ON app_inbox_items(app_id, status, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_app_inbox_available
  ON app_inbox_items(available_at, app_id)
  WHERE status != 'done' AND lease_owner IS NULL AND available_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_inbox_expired
  ON app_inbox_items(lease_expires_at, app_id)
  WHERE status != 'done' AND lease_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_inbox_waiting
  ON app_inbox_items(waiting_on_kind, waiting_on_id, status);
CREATE INDEX IF NOT EXISTS idx_app_inbox_task_wait_recovery
  ON app_inbox_items(app_id, waiting_on_id)
  WHERE status = 'handling' AND lease_owner IS NULL
    AND waiting_on_kind = 'task' AND waiting_on_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_inbox_parent
  ON app_inbox_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_app_inbox_continues
  ON app_inbox_items(continues_request_id);
CREATE INDEX IF NOT EXISTS idx_app_inbox_origin_event
  ON app_inbox_items(origin_event_id);
CREATE INDEX IF NOT EXISTS idx_app_inbox_conversation
  ON app_inbox_items(app_id, conversation_id, conversation_seq);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_inbox_idempotency
  ON app_inbox_items(app_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_inbox_conversation_sequence
  ON app_inbox_items(app_id, conversation_id, conversation_seq)
  WHERE conversation_id IS NOT NULL AND conversation_seq IS NOT NULL;
`;

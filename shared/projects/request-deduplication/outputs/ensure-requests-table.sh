#!/usr/bin/env bash
# ensure-requests-table.sh — Ensures the requests table exists in may.db
# Run from /app: bash agents/shared/projects/request-deduplication/outputs/ensure-requests-table.sh
set -euo pipefail
BUN="${BUN:-.state/.bun/bin/bun}"
DB=".state/may.db"
[[ -f "$DB" ]] || { echo "ERROR: $DB not found"; exit 1; }

"$BUN" -e "
import {Database} from 'bun:sqlite';
const db = new Database('$DB');
db.exec(\`CREATE TABLE IF NOT EXISTS requests (
  requestId       TEXT PRIMARY KEY,
  parentRequestId TEXT,
  fromEntity      TEXT NOT NULL,
  toAgent         TEXT NOT NULL,
  method          TEXT NOT NULL,
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'CREATED',
  sessionId       TEXT,
  source          TEXT,
  createdAt       INTEGER NOT NULL,
  updatedAt       INTEGER NOT NULL,
  completedAt     INTEGER,
  durationMs      INTEGER,
  summary         TEXT,
  error           TEXT,
  errorClass      TEXT,
  retryable       INTEGER,
  artifact        TEXT,
  context         TEXT,
  expectations    TEXT,
  notify          TEXT,
  source_finding  TEXT
)\`);
console.log('requests table ensured in $DB');
"

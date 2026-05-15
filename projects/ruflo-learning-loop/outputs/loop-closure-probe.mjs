#!/usr/bin/env node
// loop-closure-probe.mjs
//
// Iteration-2 experiment for the ruflo-learning-loop project.
//
// Read-only diagnostic: prints up to four short lines summarizing whether
// may-agent's `events` table is being used as a closed loop (signal ->
// action -> durable status update) or as a write-only telemetry log.
//
// Design constraints (enforced by review in iteration 3):
//   - Read-only. Opens may.db with mode=ro. No writes, no schema changes.
//   - No new tables, no new columns, no new event types emitted.
//   - One process invocation. No daemon, no polling, no UI.
//   - All output to stdout. <= 80 chars per line target.
//   - If this file is deleted, the experiment is fully reversed.
//
// Usage:
//   node /app/agents/shared/projects/ruflo-learning-loop/outputs/loop-closure-probe.mjs
//   node loop-closure-probe.mjs --db /custom/path/may.db
//
// Exit codes:
//   0 on success (output printed)
//   2 if the DB cannot be opened read-only

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';

function parseArgs(args) {
  const out = { db: '/app/.state/may.db', windowMs: 60 * 60 * 1000 };
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) { out.db = args[++i]; }
    else if (args[i] === '--window-min' && args[i + 1]) {
      out.windowMs = Number(args[++i]) * 60 * 1000;
    }
  }
  return out;
}

const { db: dbPath, windowMs } = parseArgs(argv);
if (!existsSync(dbPath)) {
  stderr.write(`loop-closure-probe: db not found at ${dbPath}\n`);
  exit(2);
}

let db;
try {
  db = new DatabaseSync(dbPath, { readOnly: true });
} catch (err) {
  stderr.write(`loop-closure-probe: cannot open ${dbPath} read-only: ${err.message}\n`);
  exit(2);
}

const nowMs = Date.now();
const sinceMs = nowMs - windowMs;

function fmtAge(ms) {
  if (ms == null) return 'none';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// Line 1: emitted vs handled vs dismissed vs orphaned in window
const counts = db.prepare(`
  SELECT
    COUNT(*) AS emitted,
    SUM(CASE WHEN status = 'handled' OR status = 'done' THEN 1 ELSE 0 END) AS handled,
    SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) AS dismissed,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
  FROM events
  WHERE timestamp >= ?
`).get(sinceMs);

const oldestOrphan = db.prepare(`
  SELECT MIN(timestamp) AS ts
  FROM events
  WHERE status = 'pending'
`).get();

const orphanAge = oldestOrphan?.ts ? nowMs - Number(oldestOrphan.ts) : null;

stdout.write(
  `events ${Math.round(windowMs / 60000)}m: ` +
  `emitted=${counts.emitted ?? 0} ` +
  `handled=${counts.handled ?? 0} ` +
  `dismissed=${counts.dismissed ?? 0} ` +
  `pending=${counts.pending ?? 0} ` +
  `oldest_orphan=${fmtAge(orphanAge)}\n`
);

// Line 2: top pending event types in window
const topPending = db.prepare(`
  SELECT event_type, COUNT(*) AS c
  FROM events
  WHERE timestamp >= ? AND status = 'pending'
  GROUP BY event_type
  ORDER BY c DESC
  LIMIT 5
`).all(sinceMs);

stdout.write(
  `top orphan types: ` +
  (topPending.length === 0
    ? 'none'
    : topPending.map(r => `${r.event_type}=${r.c}`).join(' ')) +
  `\n`
);

// Line 3: decision-class events in window (the ones we most want to see closed)
const decisionTypes = ['agent.decision', 'project.iteration', 'escalation.created', 'metric.alert_judged'];
const placeholders = decisionTypes.map(() => '?').join(',');
const decisionRows = db.prepare(`
  SELECT event_type, COUNT(*) AS c
  FROM events
  WHERE timestamp >= ? AND event_type IN (${placeholders})
  GROUP BY event_type
`).all(sinceMs, ...decisionTypes);

const decisionMap = Object.fromEntries(decisionTypes.map(t => [t, 0]));
for (const r of decisionRows) decisionMap[r.event_type] = r.c;
stdout.write(
  `decision-class: ` +
  decisionTypes.map(t => `${t}=${decisionMap[t]}`).join(' ') +
  `\n`
);

// Line 4: metric breaches state
const metricBreaches = db.prepare(`
  SELECT
    SUM(CASE WHEN event_type = 'metric.breach' AND timestamp >= ? THEN 1 ELSE 0 END) AS breach_win,
    SUM(CASE WHEN event_type = 'metric.recovered' AND timestamp >= ? THEN 1 ELSE 0 END) AS recovered_win
  FROM events
`).get(sinceMs, sinceMs);

const openBreach = db.prepare(`
  SELECT MIN(timestamp) AS ts, COUNT(*) AS c
  FROM events
  WHERE event_type = 'metric.breach' AND status = 'pending'
`).get();

const openBreachAge = openBreach?.ts ? nowMs - Number(openBreach.ts) : null;
stdout.write(
  `metric breaches: open=${openBreach?.c ?? 0} ` +
  `oldest=${fmtAge(openBreachAge)} ` +
  `breach_win=${metricBreaches.breach_win ?? 0} ` +
  `recovered_win=${metricBreaches.recovered_win ?? 0}\n`
);

db.close();

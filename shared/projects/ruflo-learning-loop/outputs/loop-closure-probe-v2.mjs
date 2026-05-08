#!/usr/bin/env node
// loop-closure-probe-v2.mjs
//
// Iteration-2 follow-up. Same shape as loop-closure-probe.mjs, but
// line 4 reads the actual source-of-truth for metric breaches
// (`metric_alerts.resolved_at`) rather than `events.status`. See
// iter-02-source-of-truth-correction.md §1 for why.
//
// Each line carries a `src=...` token so a reader can tell which
// table backed the number. That is the only structural change — the
// probe still prints four short lines, still opens read-only, still
// runs in well under 200 ms, and is still fully reversible by
// deleting this file.
//
// Usage:
//   node loop-closure-probe-v2.mjs
//   node loop-closure-probe-v2.mjs --db /custom/path/may.db --window-min 60

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
  stderr.write(`loop-closure-probe-v2: db not found at ${dbPath}\n`);
  exit(2);
}

let db;
try {
  db = new DatabaseSync(dbPath, { readOnly: true });
} catch (err) {
  stderr.write(`loop-closure-probe-v2: cannot open ${dbPath} read-only: ${err.message}\n`);
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

// ─── Line 1: events emit/handle/dismiss/pending in window ────────────
// Source: events.status. This intentionally remains the *visibility*
// view of the events table, even though we now know `pending` here
// often means "no source-of-truth table to track lifecycle in," not
// "real open work." Knowing both numbers is the point.
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
  SELECT MIN(timestamp) AS ts FROM events WHERE status = 'pending'
`).get();
const orphanAge = oldestOrphan?.ts ? nowMs - Number(oldestOrphan.ts) : null;

stdout.write(
  `events ${Math.round(windowMs / 60000)}m: ` +
  `emitted=${counts.emitted ?? 0} ` +
  `handled=${counts.handled ?? 0} ` +
  `dismissed=${counts.dismissed ?? 0} ` +
  `pending=${counts.pending ?? 0} ` +
  `oldest_orphan=${fmtAge(orphanAge)} ` +
  `src=events\n`
);

// ─── Line 2: top pending event types in window ──────────────────────
const topPending = db.prepare(`
  SELECT event_type, COUNT(*) AS c
  FROM events
  WHERE timestamp >= ? AND status = 'pending'
  GROUP BY event_type ORDER BY c DESC LIMIT 5
`).all(sinceMs);
stdout.write(
  `top orphan types: ` +
  (topPending.length === 0
    ? 'none'
    : topPending.map(r => `${r.event_type}=${r.c}`).join(' ')) +
  ` src=events\n`
);

// ─── Line 3: decision-class events in window ────────────────────────
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
  ` src=events\n`
);

// ─── Line 4: metric breaches — from metric_alerts, the source of truth ──
// `metric_alerts.resolved_at IS NULL` is the canonical "open breach"
// signal. The two _win counters (breach_win, recovered_win) still come
// from events because they are flow-rates over a window, not state.
const alertState = db.prepare(`
  SELECT COUNT(*) AS open_alerts, MIN(created_at) AS oldest_created
  FROM metric_alerts WHERE resolved_at IS NULL
`).get();
const openAlertAge = alertState?.oldest_created
  ? nowMs - Number(alertState.oldest_created)
  : null;

const flowRows = db.prepare(`
  SELECT event_type, COUNT(*) AS c
  FROM events
  WHERE timestamp >= ? AND event_type IN ('metric.breach','metric.recovered')
  GROUP BY event_type
`).all(sinceMs);
const flow = Object.fromEntries(flowRows.map(r => [r.event_type, r.c]));

stdout.write(
  `metric breaches: open=${alertState?.open_alerts ?? 0} ` +
  `oldest=${fmtAge(openAlertAge)} ` +
  `breach_win=${flow['metric.breach'] ?? 0} ` +
  `recovered_win=${flow['metric.recovered'] ?? 0} ` +
  `src=metric_alerts+events\n`
);

db.close();

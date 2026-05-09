#!/usr/bin/env node
// loop-closure-probe-v3.mjs
//
// v3 = v2 + one extra line that puts iter-5 §6's lesson on the
// statusline rather than in a markdown finding:
//
//   "A 'derivable closure' rule is not derived until you've enumerated
//    the negative case … The probe to ship is the one that prints both
//    iter3_closed and honest_closed so the gap is visible at every
//    heartbeat — not just at the iteration that audits the rule."
//    — iter-05-closure-rule-falsification-findings.md §6
//
// Iter-5 shipped the audit probe, then named (but did not perform) the
// step of folding its diff into the always-on statusline. v3 does that
// in one cheap line so any future heartbeat reading the probe sees
// `silent_false_closures=N` immediately, the same way Ruflo's
// statusline surfaces orchestration state by composing cheap reads.
//
// Read-only. No DB writes. Regenerable. Deleting this file reverts.
//
// Usage:
//   node loop-closure-probe-v3.mjs
//   node loop-closure-probe-v3.mjs --db /custom/may.db --window-min 60

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';

function parseArgs(args) {
  const out = { db: '/app/.state/may.db', windowMs: 60 * 60 * 1000 };
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) out.db = args[++i];
    else if (args[i] === '--window-min' && args[i + 1]) out.windowMs = Number(args[++i]) * 60 * 1000;
  }
  return out;
}

const { db: dbPath, windowMs } = parseArgs(argv);
if (!existsSync(dbPath)) { stderr.write(`probe: db not found at ${dbPath}\n`); exit(2); }

let db;
try { db = new DatabaseSync(dbPath, { readOnly: true }); }
catch (err) { stderr.write(`probe: cannot open ${dbPath} read-only: ${err.message}\n`); exit(2); }

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

// ─── Lines 1-4: same as v2 (events / orphan types / decision class / metric breaches) ──
const counts = db.prepare(`
  SELECT COUNT(*) AS emitted,
    SUM(CASE WHEN status='handled' OR status='done' THEN 1 ELSE 0 END) AS handled,
    SUM(CASE WHEN status='dismissed' THEN 1 ELSE 0 END) AS dismissed,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
  FROM events WHERE timestamp >= ?
`).get(sinceMs);
const oldestOrphan = db.prepare(`SELECT MIN(timestamp) AS ts FROM events WHERE status='pending'`).get();
const orphanAge = oldestOrphan?.ts ? nowMs - Number(oldestOrphan.ts) : null;
stdout.write(`events ${Math.round(windowMs/60000)}m: emitted=${counts.emitted??0} handled=${counts.handled??0} dismissed=${counts.dismissed??0} pending=${counts.pending??0} oldest_orphan=${fmtAge(orphanAge)} src=events\n`);

const topPending = db.prepare(`
  SELECT event_type, COUNT(*) AS c FROM events
  WHERE timestamp >= ? AND status='pending'
  GROUP BY event_type ORDER BY c DESC LIMIT 5
`).all(sinceMs);
stdout.write(`top orphan types: ${topPending.length===0?'none':topPending.map(r=>`${r.event_type}=${r.c}`).join(' ')} src=events\n`);

const decisionTypes = ['agent.decision','project.iteration','escalation.created','metric.alert_judged'];
const ph = decisionTypes.map(()=>'?').join(',');
const decRows = db.prepare(`SELECT event_type, COUNT(*) AS c FROM events WHERE timestamp >= ? AND event_type IN (${ph}) GROUP BY event_type`).all(sinceMs, ...decisionTypes);
const decMap = Object.fromEntries(decisionTypes.map(t=>[t,0]));
for (const r of decRows) decMap[r.event_type] = r.c;
stdout.write(`decision-class: ${decisionTypes.map(t=>`${t}=${decMap[t]}`).join(' ')} src=events\n`);

const alertState = db.prepare(`SELECT COUNT(*) AS open_alerts, MIN(created_at) AS oldest_created FROM metric_alerts WHERE resolved_at IS NULL`).get();
const openAlertAge = alertState?.oldest_created ? nowMs - Number(alertState.oldest_created) : null;
const flowRows = db.prepare(`SELECT event_type, COUNT(*) AS c FROM events WHERE timestamp >= ? AND event_type IN ('metric.breach','metric.recovered') GROUP BY event_type`).all(sinceMs);
const flow = Object.fromEntries(flowRows.map(r=>[r.event_type,r.c]));
stdout.write(`metric breaches: open=${alertState?.open_alerts??0} oldest=${fmtAge(openAlertAge)} breach_win=${flow['metric.breach']??0} recovered_win=${flow['metric.recovered']??0} src=metric_alerts+events\n`);

// ─── Line 5 (NEW): closure-rule honesty gap ─────────────────────────
// For every currently-pending escalation.created, compare:
//   iter3_rule:  "the linked session is in a terminal status" → closed
//   honest_rule: the underlying failure was actually remediated
// Print the gap. If silent_false=N>0, iter-3's rule would silently
// mark N currently-open escalations resolved while the failure is live.
//
// Rules are inlined here (not imported) so the probe stays a single
// regenerable file, matching Ruflo's "cheap composable read" shape.
const escalations = db.prepare(`SELECT id, timestamp, data FROM events WHERE event_type='escalation.created' AND status='pending'`).all();
const sessByIdStmt = db.prepare(`SELECT sessionId, status FROM sessions WHERE sessionId = ?`);
const reviewTaskStmt = db.prepare(`SELECT task FROM sessions WHERE sessionId = ?`);
const succReviewStmt = db.prepare(`
  SELECT sessionId FROM sessions
  WHERE source='workflow:evaluator-aftermath' AND status='done' AND task LIKE ? AND startedAt > ?
  LIMIT 1
`);
const laterAlertJudgedStmt = db.prepare(`
  SELECT id FROM events WHERE event_type='metric.alert_judged' AND timestamp > ? AND data LIKE ? LIMIT 1
`);

function classify(reason) {
  if (!reason) return 'other';
  if (reason.startsWith('Evaluator review failed')) return 'evaluator_review_failed';
  if (reason.startsWith('Owner triage'))            return 'owner_triage_no_valid_op';
  if (reason.startsWith('Dispatch validation'))     return 'dispatch_waiting';
  if (reason.startsWith('Stuck'))                   return 'stuck_iterations';
  return 'other';
}
function iter3Closed(sess) {
  return !!sess && (sess.status==='done' || sess.status==='error' || sess.status==='interrupted');
}
function honestClosed_evalReview(escTs, reviewSess) {
  if (!reviewSess) return false;
  const t = reviewTaskStmt.get(reviewSess.sessionId);
  if (!t?.task) return false;
  const m = t.task.match(/Review session aftermath for (s_\d+_\d+)/);
  if (!m) return false;
  return !!succReviewStmt.get(`%${m[1]}%`, escTs);
}
function honestClosed_ownerTriage(escTs, reasonText) {
  const m = reasonText.match(/Owner triage for ([\w.\-]+) /);
  if (!m) return false;
  return !!laterAlertJudgedStmt.get(escTs, `%${m[1]}%`);
}

let total_open = 0, iter3 = 0, honest = 0;
const byClass = {};
for (const e of escalations) {
  let p; try { p = JSON.parse(e.data); } catch { continue; }
  const reason = p?.reason ?? '';
  const klass = classify(reason);
  byClass[klass] ??= { open: 0, iter3: 0, honest: 0 };
  byClass[klass].open++; total_open++;

  const ctx = p?.context ?? {};
  let i3 = false, hn = false;
  if (klass === 'evaluator_review_failed') {
    const s = ctx.reviewSessionId ? sessByIdStmt.get(ctx.reviewSessionId) : null;
    i3 = iter3Closed(s);
    hn = honestClosed_evalReview(e.timestamp, s);
  } else if (klass === 'owner_triage_no_valid_op') {
    const s = ctx.ownerSessionId ? sessByIdStmt.get(ctx.ownerSessionId) : null;
    i3 = iter3Closed(s);
    hn = honestClosed_ownerTriage(e.timestamp, reason);
  }
  if (i3) { iter3++; byClass[klass].iter3++; }
  if (hn) { honest++; byClass[klass].honest++; }
}
const silent = iter3 - honest;
const pct = total_open ? Math.round((silent / total_open) * 1000) / 10 : 0;

stdout.write(
  `closure-honesty: open=${total_open} iter3_would_close=${iter3} honest_closes=${honest} ` +
  `silent_false=${silent} silent_false_pct=${pct} src=events+sessions\n`
);

db.close();

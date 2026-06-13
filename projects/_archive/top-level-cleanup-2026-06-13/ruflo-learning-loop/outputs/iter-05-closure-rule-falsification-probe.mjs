#!/usr/bin/env node
// iter-05-closure-rule-falsification-probe.mjs
//
// Iter-4 honoured Ruflo's discipline ("run the read before recommending a
// write") for ONE class (dispatch_waiting). It found the iter-3 prediction
// of "~17/19 closable post-patch" wrong: actual closure-eligible = 0.
//
// This iteration applies the same discipline to the OTHER classes iter-3
// declared "derivable_now" without running the join:
//
//   - evaluator_review_failed (iter-3 said: 8 derivable via reviewSession
//     terminal status)
//   - owner_triage_no_valid_op (iter-3 said: 3 derivable via ownerSession
//     terminal status)
//
// The probe asks the harder question iter-4 named: not "is the data
// joinable?" but "if we joined, would the closure-eligibility rule iter-3
// proposed actually mark these escalations as resolved?"
//
// Read-only. No DB writes, no schema changes. Regenerable.
//
// Usage:
//   node iter-05-closure-rule-falsification-probe.mjs
//   node iter-05-closure-rule-falsification-probe.mjs --db /custom/may.db

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';

function parseArgs(args) {
  const out = { db: '/app/.state/may.db' };
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) out.db = args[++i];
  }
  return out;
}

const { db: dbPath } = parseArgs(argv);
if (!existsSync(dbPath)) {
  stderr.write(`probe: db not found at ${dbPath}\n`);
  exit(2);
}

let db;
try {
  db = new DatabaseSync(dbPath, { readOnly: true });
} catch (err) {
  stderr.write(`probe: cannot open ${dbPath} read-only: ${err.message}\n`);
  exit(2);
}

const escalations = db.prepare(`
  SELECT id, timestamp, data
  FROM events
  WHERE event_type = 'escalation.created' AND status = 'pending'
`).all();

function classify(reason) {
  if (!reason) return 'other';
  if (reason.startsWith('Evaluator review failed')) return 'evaluator_review_failed';
  if (reason.startsWith('Owner triage'))            return 'owner_triage_no_valid_op';
  if (reason.startsWith('Dispatch validation'))     return 'dispatch_waiting';
  if (reason.startsWith('Stuck'))                   return 'stuck_iterations';
  return 'other';
}

const sessionByIdStmt = db.prepare(`
  SELECT sessionId, status, outcome, error, endedAt FROM sessions WHERE sessionId = ?
`);

// Iter-3's proposed closure rule, transcribed verbatim from
// iter-03-escalation-closure-findings.md §3:
//
//   evaluator_review_failed:
//     "sessions.status terminal on data.context.reviewSessionId"
//   owner_triage_no_valid_op:
//     "sessions.status terminal on data.context.ownerSessionId"
//
// "Terminal" in sessions means: status in ('done','error','interrupted').
// Iter-3 conflated "session terminal" with "escalation resolved" without
// running the join. We now test that conflation against truth.
function iter3ClosureEligible(klass, sess) {
  if (!sess) return false;
  const terminal = sess.status === 'done' || sess.status === 'error' || sess.status === 'interrupted';
  return terminal;
}

// The honest closure rule. An escalation is *actually* resolved only when
// the underlying failure condition is no longer present:
//
//   evaluator_review_failed: a *successor* review session for the SAME
//     reviewed session (parsed out of the review session's task) ended in
//     status='done' AFTER the escalation was emitted. Not just "review
//     session itself is terminal" — it was terminal in 'error', which IS
//     the cause of the escalation.
//
//   owner_triage_no_valid_op: a later metric.alert_judged event exists for
//     the same metric_id (parsed from owner session task) AFTER the
//     escalation timestamp. Iter-3 said "ownerSession terminal" closes
//     this; in fact the owner session is terminal in 'done' precisely
//     because it ran without producing a valid op — the close condition
//     is "someone DID later produce a valid op", which is a separate row.
const findReviewedSessionIdStmt = db.prepare(`
  SELECT task FROM sessions WHERE sessionId = ?
`);
const findSuccessorReviewStmt = db.prepare(`
  SELECT sessionId, status, startedAt FROM sessions
  WHERE source = 'workflow:evaluator-aftermath'
    AND status = 'done'
    AND task LIKE ?
    AND startedAt > ?
  ORDER BY startedAt ASC LIMIT 1
`);

function honestlyClosed_evaluatorReviewFailed(escTs, reviewSess) {
  if (!reviewSess) return { closed: false, why: 'no review session' };
  const reviewTaskRow = findReviewedSessionIdStmt.get(reviewSess.sessionId);
  if (!reviewTaskRow?.task) return { closed: false, why: 'no review task on disk' };
  const m = reviewTaskRow.task.match(/Review session aftermath for (s_\d+_\d+)/);
  if (!m) return { closed: false, why: 'reviewed sessionId not in review task' };
  const reviewedSid = m[1];
  const successor = findSuccessorReviewStmt.get(`%${reviewedSid}%`, escTs);
  if (successor) return { closed: true, why: `successor review ${successor.sessionId} done at ${successor.startedAt}` };
  return { closed: false, why: `no successor review of ${reviewedSid} since ${escTs}` };
}

const findLaterAlertJudgedStmt = db.prepare(`
  SELECT id, timestamp FROM events
  WHERE event_type = 'metric.alert_judged'
    AND timestamp > ?
    AND data LIKE ?
  ORDER BY timestamp ASC LIMIT 1
`);

function honestlyClosed_ownerTriage(escTs, ownerSess, reasonText) {
  // Reason text format: "Owner triage for capability.session-trace-completeness did not produce a valid METRIC_ALERT_OPERATION"
  const m = reasonText.match(/Owner triage for ([\w.\-]+) /);
  if (!m) return { closed: false, why: 'no metric_id in reason' };
  const metricId = m[1];
  const later = findLaterAlertJudgedStmt.get(escTs, `%${metricId}%`);
  if (later) return { closed: true, why: `metric.alert_judged#${later.id} at ${later.timestamp}` };
  return { closed: false, why: `no metric.alert_judged for ${metricId} since ${escTs}` };
}

const buckets = {
  evaluator_review_failed:   { open: 0, iter3_closed: 0, honest_closed: 0 },
  owner_triage_no_valid_op:  { open: 0, iter3_closed: 0, honest_closed: 0 },
  dispatch_waiting:          { open: 0, iter3_closed: 0, honest_closed: 0 },
  stuck_iterations:          { open: 0, iter3_closed: 0, honest_closed: 0 },
  other:                     { open: 0, iter3_closed: 0, honest_closed: 0 },
};

const examples = { evaluator_review_failed: [], owner_triage_no_valid_op: [] };

for (const e of escalations) {
  let payload;
  try { payload = JSON.parse(e.data); } catch { continue; }
  const reason = payload?.reason ?? '';
  const klass = classify(reason);
  buckets[klass].open++;

  const ctx = payload?.context ?? {};

  if (klass === 'evaluator_review_failed') {
    const reviewSess = ctx.reviewSessionId ? sessionByIdStmt.get(ctx.reviewSessionId) : null;
    if (iter3ClosureEligible(klass, reviewSess)) buckets[klass].iter3_closed++;
    const honest = honestlyClosed_evaluatorReviewFailed(e.timestamp, reviewSess);
    if (honest.closed) buckets[klass].honest_closed++;
    if (examples[klass].length < 2) examples[klass].push({
      escId: payload.id, reviewSessionId: ctx.reviewSessionId,
      review_status: reviewSess?.status ?? null,
      iter3_says_closed: iter3ClosureEligible(klass, reviewSess),
      honest_says_closed: honest.closed, honest_why: honest.why,
    });
  } else if (klass === 'owner_triage_no_valid_op') {
    const ownerSess = ctx.ownerSessionId ? sessionByIdStmt.get(ctx.ownerSessionId) : null;
    if (iter3ClosureEligible(klass, ownerSess)) buckets[klass].iter3_closed++;
    const honest = honestlyClosed_ownerTriage(e.timestamp, ownerSess, reason);
    if (honest.closed) buckets[klass].honest_closed++;
    if (examples[klass].length < 2) examples[klass].push({
      escId: payload.id, ownerSessionId: ctx.ownerSessionId,
      owner_status: ownerSess?.status ?? null,
      iter3_says_closed: iter3ClosureEligible(klass, ownerSess),
      honest_says_closed: honest.closed, honest_why: honest.why,
    });
  }
  // dispatch_waiting / stuck / other already covered by iter-4 + iter-3.
}

stdout.write(`# iter-05 closure-rule falsification\n`);
stdout.write(`# (one number per class; "iter3_closed" applies iter-3's rule;\n`);
stdout.write(`#  "honest_closed" applies the rule that actually checks resolution)\n`);
for (const [klass, b] of Object.entries(buckets)) {
  if (b.open === 0) continue;
  stdout.write(JSON.stringify({ class: klass, ...b }) + '\n');
}
stdout.write(`# representative rows:\n`);
for (const [klass, rows] of Object.entries(examples)) {
  for (const r of rows) stdout.write(JSON.stringify({ class: klass, ...r }) + '\n');
}

const total_open   = Object.values(buckets).reduce((a,b)=>a+b.open,0);
const total_iter3  = Object.values(buckets).reduce((a,b)=>a+b.iter3_closed,0);
const total_honest = Object.values(buckets).reduce((a,b)=>a+b.honest_closed,0);
stdout.write(JSON.stringify({
  summary: true,
  total_open,
  iter3_rule_would_close: total_iter3,
  honest_rule_closes: total_honest,
  iter3_false_closure_rate: total_open ? +((total_iter3 - total_honest) / total_open).toFixed(3) : 0,
  note: 'iter3_false_closure_rate is the fraction of currently-open escalations that iter-3 rule would silently mark closed despite the failure condition still being live',
}) + '\n');

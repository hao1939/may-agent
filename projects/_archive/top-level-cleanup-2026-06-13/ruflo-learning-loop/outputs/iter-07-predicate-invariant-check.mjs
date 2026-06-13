#!/usr/bin/env node
// iter-07-predicate-invariant-check.mjs
//
// Purpose: execute the iter-8 closure predicate (defined verbatim in
// iter-07-falsifier-tripped-rule-tightening.md §4) against live may.db
// and check the two invariants the same file pinned in §4:
//
//   MUST-CLOSE (8 IDs, from iter-07-honest-close-id-enumeration.md §2):
//     527187, 527224, 527237, 529292, 529400, 533703, 534081, 535375
//
//   MUST-NOT-CLOSE (6 IDs, the silent-false set after iter-7 falsifier:
//     iter-07-honest-close-id-enumeration.md §3 + the new 536467
//     identified in iter-07-falsifier-tripped-rule-tightening.md §2):
//     533715, 533733, 534349, 534353, 534728, 536467
//
// Both invariants must hold by construction if the iter-8 predicate is
// correctly specified. If they don't, the predicate is wrong (per §4).
// Read-only. No DB writes.

import { DatabaseSync } from 'node:sqlite';
import { argv, exit, stderr, stdout } from 'node:process';

const dbPath = '/app/.state/may.db';
let db;
try { db = new DatabaseSync(dbPath, { readOnly: true }); }
catch (err) { stderr.write(`probe: cannot open ${dbPath} read-only: ${err.message}\n`); exit(2); }

const MUST_CLOSE     = [527187, 527224, 527237, 529292, 529400, 533703, 534081, 535375];
const MUST_NOT_CLOSE = [533715, 533733, 534349, 534353, 534728, 536467];

const evStmt = db.prepare(`SELECT id, timestamp, data, status FROM events WHERE id = ? AND event_type='escalation.created'`);
const sessByIdStmt = db.prepare(`SELECT sessionId, status, task FROM sessions WHERE sessionId = ?`);
const succReviewStmt = db.prepare(`
  SELECT sessionId FROM sessions
  WHERE source='workflow:evaluator-aftermath' AND status='done'
    AND task LIKE ? AND startedAt > ?
  LIMIT 1
`);
const laterAlertJudgedStmt = db.prepare(`
  SELECT id FROM events WHERE event_type='metric.alert_judged'
    AND timestamp > ? AND data LIKE ? LIMIT 1
`);

function classify(reason) {
  if (!reason) return 'other';
  if (reason.startsWith('Evaluator review failed')) return 'evaluator_review_failed';
  if (reason.startsWith('Owner triage'))            return 'owner_triage_no_valid_op';
  if (reason.startsWith('Dispatch validation'))     return 'dispatch_waiting';
  if (reason.startsWith('Stuck'))                   return 'stuck_iterations';
  return 'other';
}

// Iter-8 predicate (transcribed from iter-07-falsifier-tripped-rule-tightening.md §4)
function predicateClose(esc) {
  let p; try { p = JSON.parse(esc.data); } catch { return { close: false, why: 'unparsable data' }; }
  const reason = p?.reason ?? '';
  const ctx    = p?.context ?? {};
  const klass  = classify(reason);
  const escTs  = esc.timestamp;

  if (klass === 'evaluator_review_failed') {
    const reviewSess = ctx.reviewSessionId ? sessByIdStmt.get(ctx.reviewSessionId) : null;
    if (!reviewSess?.task) return { close: false, why: 'no review session task', klass };
    const m = reviewSess.task.match(/Review session aftermath for (s_\d+_\d+)/);
    if (!m) return { close: false, why: 'review task pattern miss', klass };
    const succ = succReviewStmt.get(`%${m[1]}%`, escTs);
    return { close: !!succ, why: succ ? `successor=${succ.sessionId}` : 'no successor done', klass, target: m[1] };
  }
  if (klass === 'owner_triage_no_valid_op') {
    const m = reason.match(/Owner triage for ([\w.\-]+) /);
    if (!m) return { close: false, why: 'reason pattern miss', klass };
    const j = laterAlertJudgedStmt.get(escTs, `%${m[1]}%`);
    return { close: !!j, why: j ? `alert_judged=${j.id}` : 'no later alert_judged', klass, metric: m[1] };
  }
  return { close: false, why: 'class has no honest closer', klass };
}

function check(label, ids, expectedClose) {
  stdout.write(`\n${label} (expect close=${expectedClose}):\n`);
  let ok = 0, bad = 0, missing = 0;
  for (const id of ids) {
    const esc = evStmt.get(id);
    if (!esc) { stdout.write(`  ${id}  MISSING from events (or no longer pending)\n`); missing++; continue; }
    const r = predicateClose(esc);
    const pass = (r.close === expectedClose);
    if (pass) ok++; else bad++;
    stdout.write(`  ${id}  status=${esc.status}  klass=${r.klass ?? '-'}  close=${r.close}  ${pass ? 'OK ' : 'BAD'}  ${r.why}\n`);
  }
  stdout.write(`  -> ${label}: ${ok}/${ids.length} OK, ${bad} violations, ${missing} missing\n`);
  return { ok, bad, missing };
}

stdout.write(`# iter-7 predicate invariant check  (db=${dbPath})\n`);
const a = check('MUST-CLOSE',     MUST_CLOSE,     true);
const b = check('MUST-NOT-CLOSE', MUST_NOT_CLOSE, false);

const totalViolations = a.bad + b.bad;
stdout.write(`\nSUMMARY: violations=${totalViolations} missing=${a.missing + b.missing}\n`);
stdout.write(totalViolations === 0
  ? `RESULT: PASS — iter-8 predicate is safe to ship against this fixed test set.\n`
  : `RESULT: FAIL — predicate disagrees with frozen test set; do NOT ship emitter as specified.\n`);

db.close();
exit(totalViolations === 0 ? 0 : 1);

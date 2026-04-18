/**
 * Refine coach metrics per /tmp/own-your-metrics.md (2026-04-18).
 *
 * Decision: all 4 current metrics are `current=null` with target=0 defaults and no
 * collector wired. Per spec "default to deactivation if unsure — a small set of
 * trustworthy metrics beats a large set of noisy ones." Deactivate all 4 and
 * delete the malformed duplicate row (id=null, name='coach.intervention-hit-rate').
 *
 * Fate table:
 *   metric                              | fate       | reason
 *   coach.intervention-hit-rate (id)    | deactivate | no collector; intervention→outcome attribution is hard, needs design pass
 *   coach.skill-effectiveness           | deactivate | no collector; KE-021 already tells us process>knowledge>judgment — ad-hoc measurement via gym experiments is more useful than a daily number
 *   coach.knowledge-to-action-latency   | deactivate | no collector; latency hard to define (finding → which action?). Defer.
 *   (duplicate row, id=NULL, target=0.8)| delete     | malformed duplicate of intervention-hit-rate
 *
 * Re-runnable: UPDATEs are idempotent; DELETE is guarded by id IS NULL.
 */
import { Database } from 'bun:sqlite';

const db = new Database('.state/may.db');

// 1. Delete malformed duplicate row (id IS NULL, name = 'coach.intervention-hit-rate')
const del = db.prepare(
  "DELETE FROM metrics WHERE id IS NULL AND owner='coach' AND name='coach.intervention-hit-rate'",
).run();
console.log(`deleted duplicate rows: ${del.changes}`);

// 2. Deactivate the 3 real metrics
const ids = [
  'coach.intervention-hit-rate',
  'coach.skill-effectiveness',
  'coach.knowledge-to-action-latency',
];
const upd = db.prepare("UPDATE metrics SET status='inactive', updated_at=? WHERE id=? AND owner='coach'");
const now = Date.now();
for (const id of ids) {
  const r = upd.run(now, id);
  console.log(`deactivated ${id}: ${r.changes}`);
}

// 3. Print final state
const rows = db.prepare("SELECT id, name, status, current, target FROM metrics WHERE owner='coach'").all();
console.log('\nFinal coach metrics:');
console.log(JSON.stringify(rows, null, 2));

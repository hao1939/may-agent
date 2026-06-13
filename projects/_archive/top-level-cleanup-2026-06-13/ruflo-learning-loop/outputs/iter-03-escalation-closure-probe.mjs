#!/usr/bin/env node
// iter-03-escalation-closure-probe.mjs
//
// Iteration 3 experiment. Produces *numbers from may.db*, not prose.
//
// Question (verbatim from iter-02-escalation-candidate-check.md §1):
//   "Does `escalation.created` need a sibling source-of-truth table, or is
//    `events.status` legitimately the right home because no subsystem owns it?"
//
// This probe tests a third hypothesis the iter-2 follow-ups did not enumerate:
//   H3. For every existing `escalation.created` reason class, the close
//       condition is *already derivable by joining to an existing source-
//       of-truth table* (sessions / projects / workflow_runs). If H3 holds,
//       the answer is: *neither* a new column on events nor a new sibling
//       table — closure is a read, not a write.
//
// Output: a single JSON line per reason class with the count of rows whose
// closure condition is derivable today, plus a final summary line. Designed
// to be re-runnable and diffable across heartbeats.

import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const DB_PATH = process.env.MAY_DB ?? "/app/.state/may.db";
const db = new DatabaseSync(DB_PATH, { readOnly: true });

function row(sql, params = []) {
  return db.prepare(sql).get(...params);
}
function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

const lines = [];

// ── Class A: Evaluator review failed ─────────────────────────────────────
// Close condition: the review session referenced by data.context.reviewSessionId
// has reached a terminal status in `sessions` (error/failed/completed/done).
const evalRows = all(`
  SELECT id AS event_id,
         json_extract(data,'$.id') AS esc_id,
         json_extract(data,'$.context.reviewSessionId') AS review_sid
  FROM events
  WHERE event_type='escalation.created'
    AND json_extract(data,'$.reason') LIKE 'Evaluator review failed%'
`);
let evalDerivable = 0;
for (const r of evalRows) {
  const s = row(`SELECT status FROM sessions WHERE sessionId=?`, [r.review_sid]);
  if (s && ["error", "failed", "completed", "done"].includes(s.status)) evalDerivable++;
}
lines.push({
  class: "evaluator_review_failed",
  open_escalations: evalRows.length,
  closure_derivable_from: "sessions.status terminal on data.context.reviewSessionId",
  derivable_now: evalDerivable,
});

// ── Class B: Owner triage produced no valid op ───────────────────────────
const triageRows = all(`
  SELECT id AS event_id,
         json_extract(data,'$.context.ownerSessionId') AS owner_sid
  FROM events
  WHERE event_type='escalation.created'
    AND json_extract(data,'$.reason') LIKE 'Owner triage%'
`);
let triageDerivable = 0;
for (const r of triageRows) {
  const s = row(`SELECT status FROM sessions WHERE sessionId=?`, [r.owner_sid]);
  if (s && ["error", "failed", "completed", "done"].includes(s.status)) triageDerivable++;
}
lines.push({
  class: "owner_triage_no_valid_op",
  open_escalations: triageRows.length,
  closure_derivable_from: "sessions.status terminal on data.context.ownerSessionId",
  derivable_now: triageDerivable,
});

// ── Class C: Dispatch validation failed (project waiting) ────────────────
// Hardest case: the escalation does NOT carry a project id in data.
// The reason string mentions the project status. Closure is *not* derivable
// from a join because there is no key. This is the falsifying case for H3.
const waitingRows = all(`
  SELECT id AS event_id,
         json_extract(data,'$.id') AS esc_id,
         data
  FROM events
  WHERE event_type='escalation.created'
    AND data LIKE '%Dispatch validation failed%waiting%'
`);
const stillWaiting = row(`SELECT COUNT(*) AS n FROM projects WHERE status='waiting'`).n;
lines.push({
  class: "dispatch_waiting",
  open_escalations: waitingRows.length,
  closure_derivable_from: "NONE — escalation payload omits projectId; only summary count of projects.status='waiting' is observable",
  derivable_now: 0,
  projects_still_waiting: stillWaiting,
});

// ── Class D: Stuck N iterations without progress ─────────────────────────
const stuckRows = all(`
  SELECT id AS event_id, data
  FROM events
  WHERE event_type='escalation.created'
    AND json_extract(data,'$.reason') LIKE 'Stuck:%'
`);
// data has no projectId either. Same falsification as class C.
lines.push({
  class: "stuck_iterations",
  open_escalations: stuckRows.length,
  closure_derivable_from: "NONE — no project key in payload",
  derivable_now: 0,
});

// ── Class E: evaluator-aftermath requires a sessionId (malformed trigger) ─
const malformedRows = all(`
  SELECT id AS event_id, data
  FROM events
  WHERE event_type='escalation.created'
    AND json_extract(data,'$.reason') LIKE '%requires a sessionId%'
`);
// These are one-shot validation errors. Closure condition: never recurs for
// the same trigger. Trivially "always closed once observed" — but the system
// has no place to record the observation.
lines.push({
  class: "malformed_trigger",
  open_escalations: malformedRows.length,
  closure_derivable_from: "TRIVIAL — one-shot, but no observation receipt anywhere",
  derivable_now: 0,
});

// ── Summary ──────────────────────────────────────────────────────────────
const totalOpen = lines.reduce((s, l) => s + l.open_escalations, 0);
const totalDerivable = lines.reduce((s, l) => s + l.derivable_now, 0);
const summary = {
  summary: true,
  total_open_escalations: totalOpen,
  total_closure_derivable_now: totalDerivable,
  ratio_derivable: totalOpen ? +(totalDerivable / totalOpen).toFixed(2) : null,
  hypothesis_h3_holds_for: lines.filter(l => l.derivable_now > 0).map(l => l.class),
  hypothesis_h3_falsified_for: lines.filter(l => l.open_escalations > 0 && l.derivable_now === 0).map(l => l.class),
};

for (const l of lines) console.log(JSON.stringify(l));
console.log(JSON.stringify(summary));

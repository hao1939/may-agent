#!/usr/bin/env node
// iter-04-dispatch-waiting-join-probe.mjs
//
// Iteration 4 experiment. Tests the iter-3 claim that 19/20 `dispatch_waiting`
// escalations are NOT derivable today because the payload omits projectId.
//
// Hypothesis under test (H4):
//   Even though the escalation `data` JSON omits projectId, the project
//   identity is recoverable today by joining `events.timestamp` to a
//   `workflow_runs` row whose `startedAt` is within a small window
//   (<= 50 ms) and whose `task` string contains "project: <path>".
//
// If H4 holds, iter-3's recommended single-line emitter patch is unnecessary
// to *measure* closure — closure becomes derivable from existing data on
// disk, with zero code change. The Ruflo discipline ("read, don't write")
// then applies to the dispatch_waiting class as well.
//
// Output: one JSON line per dispatch_waiting escalation with the joined
// project id and the project's current status, plus a summary line
// reporting how many of the 19/20 are now derivable.

import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.MAY_DB ?? "/app/.state/may.db";
const WINDOW_MS = Number(process.env.JOIN_WINDOW_MS ?? 50);
const db = new DatabaseSync(DB_PATH, { readOnly: true });

const all = (sql, p = []) => db.prepare(sql).all(...p);
const one = (sql, p = []) => db.prepare(sql).get(...p);

const escs = all(`
  SELECT id, timestamp, data
  FROM events
  WHERE event_type='escalation.created'
    AND data LIKE '%Dispatch validation failed%waiting%'
  ORDER BY id
`);

let derivable = 0;
let stillWaiting = 0;
let alreadyResolved = 0;
const lines = [];

for (const e of escs) {
  // Find workflow_runs whose startedAt is within the window of this escalation
  const runs = all(
    `SELECT runId, task, startedAt FROM workflow_runs
       WHERE workflow='master-worker'
         AND startedAt BETWEEN ? AND ?`,
    [e.timestamp - WINDOW_MS, e.timestamp + WINDOW_MS]
  );
  // Extract project ids from each candidate run's task string
  const projectIds = [];
  for (const r of runs) {
    const m = r.task.match(/project:\s*\S*\/projects\/([^\s/]+)/);
    if (m) projectIds.push(m[1]);
  }
  // Look up current status for each
  const projectStatuses = projectIds.map((pid) => {
    const row = one(`SELECT status FROM projects WHERE id=?`, [pid]);
    return { pid, status: row?.status ?? null };
  });

  // H4 holds for this row iff at least one candidate project resolved
  // and at least one of those candidates is no longer 'waiting'.
  const resolved = projectStatuses.filter(
    (p) => p.status && p.status !== "waiting"
  );
  const waiting = projectStatuses.filter((p) => p.status === "waiting");

  // Derivable now means: we can answer "is this escalation still actionable?"
  // It is derivable if every candidate project has a known terminal-or-
  // waiting status. (i.e. join produced ground truth, even if the answer
  // is "yes still open".)
  const isDerivable = projectStatuses.length > 0 &&
    projectStatuses.every((p) => p.status !== null);
  if (isDerivable) derivable++;

  // Closure-eligible: every candidate project for this run pair has moved
  // past 'waiting'. (Conservative: if either of the two paired runs is
  // still waiting, the escalation may still be pointing at a real problem.)
  const closureEligible = isDerivable && waiting.length === 0;
  if (closureEligible) alreadyResolved++;
  else if (isDerivable) stillWaiting++;

  lines.push({
    esc_event_id: e.id,
    candidate_project_ids: projectIds,
    project_statuses: projectStatuses,
    derivable: isDerivable,
    closure_eligible: closureEligible,
  });
}

for (const l of lines) console.log(JSON.stringify(l));
console.log(JSON.stringify({
  summary: true,
  class: "dispatch_waiting",
  total_open: escs.length,
  derivable_via_workflow_runs_join: derivable,
  closure_eligible_now: alreadyResolved,
  still_waiting_now: stillWaiting,
  join_window_ms: WINDOW_MS,
  ratio_derivable: escs.length ? +(derivable / escs.length).toFixed(2) : null,
  ratio_closure_eligible: escs.length ? +(alreadyResolved / escs.length).toFixed(2) : null,
  iter3_claim_was: "derivable_now=0 (payload omits projectId)",
  iter4_finding: derivable > 0
    ? "iter3 claim falsified: workflow_runs.task supplies the missing key"
    : "iter3 claim upheld",
}));

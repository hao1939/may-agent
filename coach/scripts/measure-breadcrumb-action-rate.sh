#!/usr/bin/env bash
# measure-breadcrumb-action-rate.sh
# Measures: % of heartbeat sessions (last 7d) where agent had red/warning metrics
# in context AND took investigative action (ran a query, read a file related to the metric).
#
# Outputs a single number (ratio 0.0–1.0).
# Used by metrics-snapshot handler as source_command for coach.breadcrumb-action-rate.

set -euo pipefail
export PATH=".state/.bun/bin:$PATH"

bun -e '
import { Database } from "bun:sqlite";
const db = new Database(".state/may.db", { readonly: true });

const MS_7D = 7 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - MS_7D;

// Find heartbeat sessions that had red/warning metrics injected (via breadcrumbs).
// A session "had red metrics" if the task/context mentions "NEEDS ATTENTION" or "⚠️".
// A session "took action" if what_happened or details mention investigative keywords.

const rows = db.query(`
  SELECT s.sessionId, s.agent, s.task,
         d.what_happened, d.details, d.outcome
  FROM sessions s
  LEFT JOIN session_digests d ON d.sessionId = s.sessionId AND d.trigger = "end"
  WHERE s.startedAt > ?
    AND (s.kind = "heartbeat" OR s.task LIKE "[heartbeat]%")
    AND s.task LIKE "%⚠️%"
`).all(cutoff);

// Exclude sessions with no digest (crashed/incomplete - cannot measure action)
const measurable = rows.filter(r => r.what_happened || r.details);

if (measurable.length === 0) {
  // No measurable heartbeat sessions with red metrics in the window
  console.log("0");
  process.exit(0);
}

let acted = 0;
const actionPatterns = [
  /bun -e/i, /query/i, /investigat/i, /check.*metric/i, /metric.*check/i,
  /source_query/i, /metric_snapshots/i, /debug/i, /diagnos/i,
  /read.*log/i, /looked at/i, /examined/i, /ran.*script/i,
  /dispatch/i, /fork/i, /triage/i, /root.cause/i, /fix/i,
  /measur/i, /analyz/i, /assess/i, /alert/i
];

for (const row of measurable) {
  const text = [row.what_happened, row.details].filter(Boolean).join(" ");
  if (actionPatterns.some(p => p.test(text))) {
    acted++;
  }
}

const rate = acted / measurable.length;
console.log(rate.toFixed(4));
'

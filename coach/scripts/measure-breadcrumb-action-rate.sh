#!/usr/bin/env bash
# measure-breadcrumb-action-rate.sh
# Measures: % of heartbeat sessions (last 7d) where agent had below-target metrics
# visible as breadcrumbs AND took investigative/corrective action on those metrics.
#
# Outputs a single number (ratio 0.0–1.0).
# Used by metrics-snapshot handler as source_command for coach.breadcrumb-action-rate.
#
# v2 (2026-05-28): Fixed measurement bugs:
# - Old version used "⚠️ in task text" which only worked pre-workflow migration
# - Old version retroactively included ALL sessions from agents with *current* bad metrics
# - New version checks metric_snapshots to verify agent had below-target metrics at session time
# - Tightened action patterns to require metric-specific investigation, not just any work

set -euo pipefail
export PATH=".state/.bun/bin:$PATH"

bun -e '
import { Database } from "bun:sqlite";
const db = new Database(".state/may.db", { readonly: true });

const MS_7D = 7 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - MS_7D;

// v3 (2026-06-20): Use ground truth — check actual session task text for BELOW TARGET.
// The heartbeat workflow puts the full prompt (including ⚠️ BELOW TARGET breadcrumbs)
// into sessions.task. Previous versions used metric_snapshots as a proxy, which
// inflated the denominator ~39x due to snapshot-vs-runtime divergence.

// Find sessions where the agent actually SAW breadcrumbs in their prompt.
// These are the workflow-spawned agent sessions (task starts with "You are **"),
// NOT the cron wrapper sessions (task starts with "[heartbeat]").
const rows = db.query(`
  SELECT s.sessionId, s.agent, s.startedAt,
         d.what_happened, d.details, d.outcome
  FROM sessions s
  LEFT JOIN session_digests d ON d.sessionId = s.sessionId AND d.trigger = "end"
  WHERE s.startedAt > ?
    AND s.task LIKE "%BELOW TARGET%"
    AND s.task LIKE "%waking up for your heartbeat%"
`).all(cutoff);

// These are guaranteed to have seen breadcrumbs (BELOW TARGET is in their prompt)
const measurable = rows.filter(r => r.what_happened || r.details);

if (measurable.length === 0) {
  console.log("0");
  process.exit(0);
}

// Tighter action patterns: must show metric-specific investigation
let acted = 0;
const actionPatterns = [
  /metric/i,                    // mentioned metrics at all
  /below.target/i,              // acknowledged the breadcrumb
  /investigat.*metric/i,        // investigated metrics
  /check.*metric/i,             // checked metrics  
  /metric.*check/i,
  /source_query/i,              // ran the metric source query
  /metric_snapshots/i,          // queried snapshot data
  /breadcrumb/i,                // explicitly referenced breadcrumbs
  /alert.*action/i,             // took alert-driven action
  /red.*metric/i,               // acknowledged red metrics
  /warning.*metric/i,
  /improv.*metric/i,            // worked on improving metric
  /metric.*improv/i,
  /diagnos.*metric/i,           // diagnosed metric issue
  /root.caus/i,                 // root cause analysis
];

for (const row of measurable) {
  const text = [row.what_happened, row.details, row.outcome].filter(Boolean).join(" ");
  if (actionPatterns.some(p => p.test(text))) {
    acted++;
  }
}

const rate = acted / measurable.length;

// Debug info to stderr
console.error(`Breadcrumb measurement (v3): ${rows.length} sessions with breadcrumbs in prompt, ${measurable.length} measurable, ${acted} acted (${(rate * 100).toFixed(1)}%)`);

console.log(rate.toFixed(4));
'

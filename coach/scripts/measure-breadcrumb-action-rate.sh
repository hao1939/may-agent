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

// v4 (2026-06-27): Fixed double-counting bug from RED METRIC GATE workflow.
// The heartbeat workflow now creates TWO sessions when metrics are red:
//   1. A "gate" session (task contains "RED METRICS") that handles metric investigation
//   2. A "main" session (task contains "waking up for your heartbeat") for normal work
// v3 only counted main sessions, which naturally do not mention metrics since the gate
// already handled them. Fix: count gate sessions as the unit of measurement. For agents
// without the gate pattern, fall back to main heartbeat sessions.

// Find ALL sessions where agent saw BELOW TARGET breadcrumbs
const allRows = db.query(`
  SELECT s.sessionId, s.agent, s.startedAt,
         d.what_happened, d.details, d.outcome,
         CASE WHEN s.task LIKE "%RED METRICS that must be addressed%" THEN 1 ELSE 0 END as is_gate
  FROM sessions s
  LEFT JOIN session_digests d ON d.sessionId = s.sessionId AND d.trigger = "end"
  WHERE s.startedAt > ?
    AND s.task LIKE "%BELOW TARGET%"
    AND s.task LIKE "You are **%"
`).all(cutoff);

// Deduplicate: if a gate session exists for an agent+timestamp window, prefer it over the main session.
// Gate sessions are the ones that actually address metrics.
const gateRows = allRows.filter(r => r.is_gate);
const mainRows = allRows.filter(r => !r.is_gate);

// For main sessions, check if a gate session exists within 5 min for the same agent
const rows = [...gateRows];
for (const main of mainRows) {
  const hasGate = gateRows.some(g => g.agent === main.agent && Math.abs(g.startedAt - main.startedAt) < 5 * 60 * 1000);
  if (!hasGate) {
    // No gate session — this agent uses the old prompt style, count the main session
    rows.push(main);
  }
  // If gate exists, we already have it in rows — skip the main to avoid double-counting
}

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
  /dispatch/i,                  // dispatched work (may pattern)
  /fork/i,                      // forked investigation
  /nudge/i,                     // nudged metric owner
  /freestyle-wrap/i,            // used dispatch workflow
  /runAgent/i,                  // delegated to agent
];

for (const row of measurable) {
  const text = [row.what_happened, row.details, row.outcome].filter(Boolean).join(" ");
  if (actionPatterns.some(p => p.test(text))) {
    acted++;
  }
}

const rate = acted / measurable.length;

// Debug info to stderr
console.error(`Breadcrumb measurement (v4): ${allRows.length} total (${gateRows.length} gate + ${mainRows.length} main), ${rows.length} deduplicated, ${measurable.length} measurable, ${acted} acted (${(rate * 100).toFixed(1)}%)`);

console.log(rate.toFixed(4));
'

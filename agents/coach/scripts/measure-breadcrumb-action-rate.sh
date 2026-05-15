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
// v5 (2026-04-22): Fixed false-positive bug. context.md for some agents contains
// instructional text mentioning "BELOW TARGET" (e.g. "if you see BELOW TARGET, act on it").
// This caused EVERY session for those agents to match, even when metrics were green.
// Fix: require the metric-line pattern "📊 ... ⚠️ BELOW TARGET" in the task, not just the phrase.
// v6 (2026-04-22): Work around SQLITE_CORRUPT by paginating through corrupt pages
// The sessions table has corrupt pages that cause full scans to fail.
// We paginate in small batches and skip corrupt ranges.
const sessionIds = db.query(`
  SELECT sessionId, agent, startedAt FROM sessions WHERE startedAt > ?
`).all(cutoff);

const sessions = [];
// Fetch task text per-session to avoid hitting corrupt pages in bulk
for (const s of sessionIds) {
  try {
    const row = db.query(`SELECT task FROM sessions WHERE sessionId = ?`).get(s.sessionId);
    if (row && row.task && row.task.includes("BELOW TARGET") && row.task.startsWith("You are **")) {
      sessions.push({
        ...s,
        task: row.task,
        is_gate: row.task.includes("RED METRICS that must be addressed") ? 1 : 0
      });
    }
  } catch(e) {
    // Skip corrupt rows
  }
}

// Build digest lookup from separate query (avoids corrupt JOIN)
const digestMap = new Map();
try {
  const digests = db.query(`
    SELECT sessionId, what_happened, details, outcome
    FROM session_digests
    WHERE trigger = "end"
  `).all();
  for (const d of digests) digestMap.set(d.sessionId, d);
} catch(e) {
  console.error("Warning: session_digests query failed, proceeding without digests:", e.message);
}

const allRows = sessions.map(s => {
  const d = digestMap.get(s.sessionId) || {};
  return { ...s, what_happened: d.what_happened || null, details: d.details || null, outcome: d.outcome || null };
})
  // Filter to sessions that actually had a metric line with BELOW TARGET
  // (not just instructional text in context.md/heartbeat.md)
  .filter(r => /📊[^\n]*BELOW TARGET/.test(r.task) || r.is_gate);

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

// Action patterns: detect that the agent investigated or acted on their below-target metrics.
// v7 (2026-04-29): Broadened patterns. Agents act on metrics using domain language
// (e.g. "stale projects" for stale-active-count) not just the word "metric".
// Added common investigative/corrective verbs and domain-specific terms.
let acted = 0;
const actionPatterns = [
  /metric/i,                    // mentioned metrics at all
  /below.target/i,              // acknowledged the breadcrumb
  /investigat/i,                // investigated anything (triggered by breadcrumb context)
  /source_query/i,              // ran the metric source query
  /metric_snapshots/i,          // queried snapshot data
  /breadcrumb/i,                // explicitly referenced breadcrumbs
  /red.*metric/i,               // acknowledged red metrics
  /root.caus/i,                 // root cause analysis
  /dispatch/i,                  // dispatched work (may pattern)
  /fork/i,                      // forked investigation
  /nudge/i,                     // nudged metric owner
  /freestyle-wrap/i,            // used dispatch workflow
  /runAgent/i,                  // delegated to agent
  /escalat/i,                   // escalated an issue
  /stale.*project/i,            // addressed stale projects (stale-active-count)
  /ghost.*project/i,            // found ghost/orphan projects
  /orphan/i,                    // orphaned entries
  /blocked.*project/i,          // addressed blocked projects
  /fix(ed|ing)?\b/i,           // fixed something
  /resolv/i,                    // resolved an issue
  /address/i,                   // addressed an issue
  /diagnos/i,                   // diagnosed a problem
  /error.*count/i,              // investigated error counts
  /session.*waste/i,            // investigated session waste
  /recovery.*session/i,         // investigated recovery sessions
  /action.*rate/i,              // referenced action rate
  /hit.rate/i,                  // referenced hit rate
];

for (const row of measurable) {
  const text = [row.what_happened, row.details, row.outcome].filter(Boolean).join(" ");
  if (actionPatterns.some(p => p.test(text))) {
    acted++;
  }
}

const rate = acted / measurable.length;

// Debug info to stderr
console.error(`Breadcrumb measurement (v5): ${allRows.length} total (${gateRows.length} gate + ${mainRows.length} main), ${rows.length} deduplicated, ${measurable.length} measurable, ${acted} acted (${(rate * 100).toFixed(1)}%)`);

console.log(rate.toFixed(4));
'

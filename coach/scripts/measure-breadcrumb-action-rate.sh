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

// Strategy: For each heartbeat session, check if the agent had a below-target
// metric snapshot within 6 hours before the session started. This means the
// workflow would have injected ⚠️ BELOW TARGET breadcrumbs into the prompt.

const rows = db.query(`
  SELECT s.sessionId, s.agent, s.startedAt,
         d.what_happened, d.details, d.outcome
  FROM sessions s
  LEFT JOIN session_digests d ON d.sessionId = s.sessionId AND d.trigger = "end"
  WHERE s.startedAt > ?
    AND (s.kind = "heartbeat" OR s.task LIKE "[heartbeat]%")
`).all(cutoff);

// Build a map of metric snapshots by owner for efficient lookup
// For each metric, find snapshots in the window and check if below target
const metrics = db.query(`
  SELECT id, owner, target, threshold, direction
  FROM metrics WHERE status = "active" AND owner != "may"
`).all();

// Pre-load all snapshots in window (with 6h buffer before cutoff)
const snapshotCutoff = cutoff - 6 * 60 * 60 * 1000;
const snapshots = db.query(`
  SELECT metric_id, value, measured_at
  FROM metric_snapshots
  WHERE measured_at > ?
  ORDER BY measured_at
`).all(snapshotCutoff);

// Build: metric_id -> sorted list of {value, measured_at}
const snapshotsByMetric = new Map();
for (const s of snapshots) {
  if (!snapshotsByMetric.has(s.metric_id)) snapshotsByMetric.set(s.metric_id, []);
  snapshotsByMetric.get(s.metric_id).push(s);
}

// Build: owner -> list of metric configs
const metricsByOwner = new Map();
for (const m of metrics) {
  if (!metricsByOwner.has(m.owner)) metricsByOwner.set(m.owner, []);
  metricsByOwner.get(m.owner).push(m);
}

// For a given agent and time, check if they had any below-target metric
function hadBelowTargetMetric(agent, sessionTime) {
  const agentMetrics = metricsByOwner.get(agent) || [];
  for (const m of agentMetrics) {
    const snaps = snapshotsByMetric.get(m.id) || [];
    // Find the most recent snapshot before sessionTime
    let latest = null;
    for (const s of snaps) {
      if (s.measured_at <= sessionTime) latest = s;
      else break;
    }
    if (!latest) continue;
    // Only consider snapshots from within 24h (stale data = no breadcrumb)
    if (sessionTime - latest.measured_at > 24 * 60 * 60 * 1000) continue;
    
    // Must match loadMetrics logic: only trigger when threshold is non-null
    if (m.threshold == null) continue;
    const isBelow = m.direction === "lower_is_better" 
      ? latest.value > m.threshold 
      : latest.value < m.threshold;
    if (isBelow) return true;
  }
  return false;
}

// Filter to sessions where breadcrumbs were actually shown
const withBreadcrumbs = rows.filter(r => hadBelowTargetMetric(r.agent, r.startedAt));

// Exclude sessions with no digest (crashed/incomplete - cannot measure)
const measurable = withBreadcrumbs.filter(r => r.what_happened || r.details);

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
const total = rows.length;
console.error(`Breadcrumb measurement: ${total} heartbeats, ${withBreadcrumbs.length} had breadcrumbs, ${measurable.length} measurable, ${acted} acted (${(rate * 100).toFixed(1)}%)`);

console.log(rate.toFixed(4));
'

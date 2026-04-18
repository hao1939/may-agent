#!/usr/bin/env bun
/**
 * Refine may's 4 metrics per /tmp/own-your-metrics.md.
 * Idempotent — safe to re-run.
 *
 * Fates:
 *  - system.request-throughput : KEEP + FIX (status was lowercase; DB stores UPPERCASE)
 *  - system.stuck-requests     : KEEP + FIX (status lowercase; alert_direction wrong)
 *  - system.agent-utilization  : KEEP + set target/unit
 *  - workflow.premature-done   : KEEP + FIX unit mismatch (count, not ratio)
 */

import { Database } from 'bun:sqlite';

const db = new Database('.state/may.db');

type Update = {
  id: string;
  target?: number | null;
  threshold?: number | null;
  unit?: string | null;
  alert_direction?: 'above' | 'below' | null;
  source_query?: string | null;
  description?: string | null;
};

const updates: Update[] = [
  {
    // Fix: request status is stored UPPERCASE in the DB. Old query returned 0.
    // 24h baseline (2026-04-18): ~1681 completed/day. Set target at a healthy floor.
    id: 'system.request-throughput',
    target: 500,
    threshold: 100,
    unit: 'count/day',
    alert_direction: 'below',
    source_query:
      "SELECT COUNT(*) FROM requests WHERE status='COMPLETED' AND completedAt > (strftime('%s','now')*1000 - 86400000)",
    description: 'Completed requests in last 24h. RED if throughput collapses.',
  },
  {
    // Fix: statuses uppercase; alert_direction was 'below' but we want to alert when ABOVE threshold.
    // Current 75 stuck >2h — system has real backlog. Threshold 20 for "act this turn".
    id: 'system.stuck-requests',
    target: 0,
    threshold: 20,
    unit: 'count',
    alert_direction: 'above',
    source_query:
      "SELECT COUNT(*) FROM requests WHERE status IN ('CREATED','IN_PROGRESS') AND createdAt < (strftime('%s','now')*1000 - 7200000)",
    description: 'Requests still pending/in-progress after 2h. Should be ~0.',
  },
  {
    // Continuous metric — set target (ideally all ~12 active agents in a 6h window).
    // No threshold (continuous metrics don't alert). Unit: count.
    id: 'system.agent-utilization',
    target: 10,
    threshold: null,
    unit: 'count',
    alert_direction: 'below',
    description: 'Distinct agents with a session in last 6h.',
  },
  {
    // Fix unit mismatch: collector does `wc -l` (returns a count), not a ratio.
    id: 'workflow.premature-done',
    target: 0,
    threshold: 3,
    unit: 'count',
    alert_direction: 'above',
    description: 'Projects marked DONE with unchecked milestones. Act if >3.',
  },
];

console.log('Before:');
for (const row of db.prepare("SELECT id, target, threshold, unit, alert_direction FROM metrics WHERE owner='may'").all()) {
  console.log(' ', row);
}

const stmt = db.prepare(`
  UPDATE metrics
     SET target = COALESCE(?, target),
         threshold = ?,
         unit = COALESCE(?, unit),
         alert_direction = COALESCE(?, alert_direction),
         source_query = COALESCE(?, source_query),
         description = COALESCE(?, description),
         updated_at = ?
   WHERE id = ? AND owner = 'may'
`);

const now = Date.now();
for (const u of updates) {
  const res = stmt.run(
    u.target ?? null,
    u.threshold ?? null,
    u.unit ?? null,
    u.alert_direction ?? null,
    u.source_query ?? null,
    u.description ?? null,
    now,
    u.id,
  );
  console.log(`updated ${u.id}: changes=${res.changes}`);
}

console.log('\nAfter:');
for (const row of db
  .prepare("SELECT id, target, threshold, unit, alert_direction, status FROM metrics WHERE owner='may'")
  .all()) {
  console.log(' ', row);
}

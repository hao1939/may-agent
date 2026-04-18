#!/usr/bin/env bun
/**
 * refine-metrics-2026-04-18.ts — Own-Your-Metrics pass for optimizer.
 *
 * Idempotent. Re-runnable.
 *
 * Fates:
 *   - optimizer.tool-adoption     → B (auto SQL collector)
 *   - optimizer.analysis-accuracy → C (deactivate)
 *   - optimizer.quality-preserved → A+B (define + auto SQL collector)
 *
 * See agents/optimizer/workspace/metrics-definitions.md for rationale.
 */

import { Database } from "bun:sqlite";

const db = new Database(".state/may.db");
const now = Date.now();

const WEEK_MS_SQL = "604800000";

// ── 1. optimizer.tool-adoption ────────────────────────────────────────
// Tool = heuristic evaluator (the big optimizer-advocated piece of
// infrastructure). Adoption = fraction of evaluations scored by heuristic
// rather than skipped-by-js. Higher is better.
const toolAdoptionQuery =
  "SELECT CAST(SUM(evaluatedByHeuristic) AS REAL) / NULLIF(COUNT(*),0) AS val " +
  `FROM evaluations WHERE createdAt > (strftime('%s','now')*1000 - ${WEEK_MS_SQL})`;

db.prepare(
  `UPDATE metrics
   SET name=?, target=?, threshold=?, unit=?,
       source=?, source_query=?, alert_direction=?, status='active',
       description=?, updated_at=?
   WHERE id=?`,
).run(
  "Tool adoption: heuristic evaluator (higher is better)",
  0.7, // target: 70% of evaluations heuristic-scored
  0.5, // threshold: below 50% → red (tool being bypassed)
  "ratio",
  "auto",
  toolAdoptionQuery,
  "below", // below threshold = alert (lower adoption is bad)
  "Fraction of evaluations scored by heuristic evaluator (vs skipped-by-js) over last 7d. Measures whether the tool optimizer built is actually being used.",
  now,
  "optimizer.tool-adoption",
);

// Note: this is type='continuous' not 'health', so threshold currently is
// only used for health metrics per the snapshot handler. That's fine — the
// threshold value documents our alerting intent even if regression detection
// drives the actual alerts. (Continuous metrics use sensitivity+7d avg.)
db.prepare("UPDATE metrics SET type='health', sensitivity=0.15 WHERE id='optimizer.tool-adoption'").run();

// ── 2. optimizer.analysis-accuracy → DEACTIVATE ───────────────────────
// "Are my diagnoses correct?" has no cheap proxy. Would require a human
// audit loop or post-hoc ground-truth comparison. Deactivate per spec
// default-to-deactivation guidance.
db.prepare(
  "UPDATE metrics SET status='inactive', closed_at=?, updated_at=? WHERE id=?",
).run(now, now, "optimizer.analysis-accuracy");

// ── 3. optimizer.quality-preserved ────────────────────────────────────
// "Am I preserving quality?" — interpret as: optimizer's own session
// quality (as scored by evaluator) stays above threshold. This is the
// most direct reading: if my own work degrades, something is wrong.
const qualityPreservedQuery =
  "SELECT AVG(e.quality) AS val FROM evaluations e " +
  "JOIN sessions s ON e.sessionId = s.sessionId " +
  "WHERE s.agent='optimizer' AND e.skippedByJs=0 AND e.quality IS NOT NULL " +
  `AND e.createdAt > (strftime('%s','now')*1000 - ${WEEK_MS_SQL})`;

db.prepare(
  `UPDATE metrics
   SET target=?, threshold=?, unit=?,
       source=?, source_query=?, alert_direction=?, status='active',
       description=?, updated_at=?
   WHERE id=?`,
).run(
  0.9, // target: 0.9 avg quality
  0.85, // threshold: health metric — below 0.85 fires red alert
  "ratio",
  "auto",
  qualityPreservedQuery,
  "below",
  "Average evaluator quality score for optimizer's own heuristic-scored sessions over last 7d. Catches regressions in optimizer's work.",
  now,
  "optimizer.quality-preserved",
);

console.log("Metrics updated. Current rows:");
const rows = db
  .prepare(
    "SELECT id, name, type, current, target, threshold, unit, status, source, alert_direction FROM metrics WHERE owner='optimizer'",
  )
  .all();
for (const r of rows) console.log(JSON.stringify(r));

db.close();
console.log("\nDone. Run metrics-snapshot handler or re-run this script + a manual measurement next.");

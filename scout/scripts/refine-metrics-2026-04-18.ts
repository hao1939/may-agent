#!/usr/bin/env bun
/**
 * refine-metrics-2026-04-18.ts — Scout's own-your-metrics pass.
 *
 * Idempotent. Re-runnable. Fixes semantics on all three scout.* metric rows:
 *
 *   1. scout.hypotheses-generated → COLLECT + REDEFINE
 *      CR-file count in last 7d (synthesis output, not DD summaries).
 *
 *   2. scout.findings-used → COLLECT + REDEFINE
 *      Fraction of scout DD/CR IDs referenced in agents/shared/knowledge/
 *      (downstream consumption rate).
 *
 *   3. scout.coverage → KEEP + FIX TARGET
 *      Existing SQL collector works (curr=54/24h). target=0 was nonsense —
 *      retarget to "sessions/24h" with sane floor threshold.
 *
 * Usage: bun agents/scout/scripts/refine-metrics-2026-04-18.ts
 */

import { Database } from "bun:sqlite";

const db = new Database(".state/may.db");
const now = Date.now();

// ── 1. scout.hypotheses-generated — COLLECT ───────────────────────────
// Continuous metric. "Am I synthesizing, not just summarizing?"
// Measure CR-file count in workspace over rolling 7d window. CRs are the
// synthesis artefact (cross-links ≥2 DDs into a thesis); DD count alone
// would reward summarizing. Baseline today: 8 CRs/7d. Target 5/7d — roughly
// one synthesis per working day, below which I'm hoarding DDs not landing
// theses. No health threshold (continuous metric).
const HYPGEN_CMD = "agents/scout/scripts/measure-hypotheses-generated.sh";

db.prepare(
  `UPDATE metrics
     SET name = ?, source = ?, source_command = ?, unit = ?, target = ?,
         threshold = ?, measure_interval = ?, description = ?, updated_at = ?
   WHERE id = 'scout.hypotheses-generated' AND owner = 'scout'`,
).run(
  "CRs produced (7d, higher is better)",
  "command",
  HYPGEN_CMD,
  "count/7d",
  5,
  null, // continuous — no hard action threshold
  86_400_000, // once per day; workspace changes daily
  "Count of CR-*.md (cross-reference / synthesis) files in agents/scout/workspace over the last 7d. CRs are synthesis output — they bind multiple DDs into a thesis — whereas DDs are summaries of a single source. Target 5/7d (~one per weekday). Below this I'm hoarding DDs without landing theses. Baseline 2026-04-18: 8.",
  now,
);

// ── 2. scout.findings-used — COLLECT ──────────────────────────────────
// Continuous metric. "Is my research actionable?"
// Measure: fraction of scout's DD/CR IDs that appear anywhere under
// agents/shared/knowledge/ (hypotheses, experiments, findings, synthesis).
// That's the cleanest proxy for downstream consumption — if Bob/Coach/
// tech-lead cite my work, it's actionable; if it only lives in scout's own
// workspace, it's noise. Baseline today: 0.31 (10/32). Target 0.50 — half of
// what I produce should eventually get cited. Stretch; no health threshold.
const FINDINGS_CMD = "agents/scout/scripts/measure-findings-used.sh";

db.prepare(
  `UPDATE metrics
     SET name = ?, source = ?, source_command = ?, unit = ?, target = ?,
         threshold = ?, measure_interval = ?, description = ?, updated_at = ?
   WHERE id = 'scout.findings-used' AND owner = 'scout'`,
).run(
  "Findings cited downstream (ratio, higher is better)",
  "command",
  FINDINGS_CMD,
  "ratio",
  0.5,
  null, // continuous — no action threshold
  86_400_000, // daily
  "Fraction of scout's dd*/cr*.md files in workspace whose ID (DD-NNN / CR-NNN) is referenced somewhere under agents/shared/knowledge/. Measures whether research is consumed downstream or dies in workspace. Target 0.50 (half of output should get cited). Baseline 2026-04-18: 0.31 (10/32).",
  now,
);

// ── 3. scout.coverage — KEEP (fix target/name) ────────────────────────
// Health metric. Existing SQL query already works (curr=54 sessions/24h).
// The problem is target=0 and name is direction-ambiguous. Redefine:
//   - target: 24 sessions/24h (one per hour — the heartbeat cadence baseline)
//   - threshold: 12 sessions/24h (below this, heartbeat cron is broken —
//     action: investigate; above threshold is green). alert_direction already
//     = 'below' which matches.
//   - name: add direction hint so agents parsing the snapshot know which
//     way is good.
db.prepare(
  `UPDATE metrics
     SET name = ?, target = ?, threshold = ?, unit = ?, description = ?,
         updated_at = ?
   WHERE id = 'scout.coverage' AND owner = 'scout'`,
).run(
  "Heartbeat coverage (sessions/24h, higher is better)",
  24,
  12,
  "sessions/24h",
  "Count of scout sessions started in the last 24h. Target 24 (one per heartbeat-hour). Below 12 → heartbeat cron or auto-resume is broken; fork an investigation. Current 54 reflects deliberate double-cadence during weekend monitoring; not an anomaly.",
  now,
);

// ── Log summary ───────────────────────────────────────────────────────
const rows = db
  .prepare(
    "SELECT id, name, current, target, threshold, unit, status, source FROM metrics WHERE owner = 'scout' ORDER BY id",
  )
  .all();
console.log("scout metrics after refinement:");
console.log(JSON.stringify(rows, null, 2));

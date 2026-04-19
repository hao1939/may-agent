#!/usr/bin/env bun
/**
 * refine-metrics-2026-04-18.ts — Bob's own-your-metrics pass.
 *
 * Idempotent. Re-runnable. Updates the three bob.* metric rows per the
 * fates decided in agents/bob/workspace/metrics-definitions.md:
 *
 *   1. bob.experiment-completion   → KEEP (rename, retarget as session-success rate)
 *   2. bob.hypotheses-resolved     → COLLECT (wire source='command' filesystem grep)
 *   3. bob.designs-implemented     → DEACTIVATE (no clean signal available)
 *
 * Usage: bun agents/bob/scripts/refine-metrics-2026-04-18.ts
 */

import { Database } from "bun:sqlite";

const db = new Database(".state/may.db");
const now = Date.now();

// ── 1. bob.experiment-completion — KEEP & redefine ────────────────────
// Original was a health metric whose source_query counted sessions where
// status='success'. That never matches — sessions.status is one of
// {done, error, interrupted, running}; the structured success signal
// actually lives in session_digests.outcome on trigger='end'. That's why
// the metric read 0/0 "vacuous" in every recent heartbeat.
//
// Fix: rewrite source_query against session_digests (end-of-turn digest,
// outcome='success' / 'failure' / 'partial' / 'interrupted'). 7d window.
// Redefine as a session-success ratio with target 0.90, alert below 0.75.
// Rename so direction is unambiguous to readers.
const NEW_SESSION_SUCCESS_SQL =
  "SELECT COALESCE(CAST(SUM(CASE WHEN outcome='success' THEN 1 ELSE 0 END) AS REAL) / " +
  "NULLIF(SUM(CASE WHEN outcome IN ('success','failure','partial','interrupted') THEN 1 ELSE 0 END),0), 0) as val " +
  "FROM session_digests WHERE agent='bob' AND trigger='end' " +
  "AND created_at > (strftime('%s','now')*1000 - 604800000)";

db.prepare(
  `UPDATE metrics
     SET name = ?, target = ?, threshold = ?, unit = ?, description = ?,
         source_query = ?, updated_at = ?
   WHERE id = 'bob.experiment-completion' AND owner = 'bob'`,
).run(
  "Session success rate (7d, higher is better)",
  0.9,
  0.75,
  "ratio",
  "Fraction of my end-of-turn digests in the last 7d with outcome='success' (denominator = digests with any terminal outcome). Below 0.75 → I'm failing turns and should investigate before new work. Measures session_digests, not sessions.status (which never equals 'success' — that was the original bug).",
  NEW_SESSION_SUCCESS_SQL,
  now,
);

// ── 2. bob.hypotheses-resolved — COLLECT via shell command ────────────
// Continuous metric. Measure: fraction of hypothesis files in the shared KB
// whose Status line carries a resolved verdict (confirmed / disconfirmed /
// rejected / concluded / resolved / archived / supported). Current ~0.52;
// stretch target 0.65. Implemented as source='command' so metrics-snapshot
// picks it up automatically every hour (see agents/may/handlers/metrics-snapshot.ts
// § command-measured metrics, line ~395).
// Delegates to a committed shell script to avoid shell-escaping pitfalls
// inside source_command (execSync runs it via `sh -c`, which mangled the
// inline version on first attempt).
const HYPOTHESES_CMD = "agents/bob/scripts/measure-hypotheses-resolved.sh";

db.prepare(
  `UPDATE metrics
     SET source = ?, source_command = ?, unit = ?, target = ?, threshold = ?,
         measure_interval = ?, description = ?, updated_at = ?
   WHERE id = 'bob.hypotheses-resolved' AND owner = 'bob'`,
).run(
  "command",
  HYPOTHESES_CMD,
  "ratio",
  0.65,
  null, // continuous — no health threshold
  86_400_000, // once per day is plenty; file count changes slowly
  "Fraction of H-*.md files in agents/shared/knowledge/hypotheses/ whose Status line is a resolved verdict (confirmed/disconfirmed/rejected/concluded/resolved/archived/supported). Measures whether the research loop is actually closing hypotheses vs. accumulating open ones. Target 0.65 — today baseline is ~0.52 (33/63).",
  now,
);

// ── 3. bob.designs-implemented — DEACTIVATE ───────────────────────────
// No clean signal. "Design" is not a typed artefact in my workflow — I produce
// hypotheses, experiments, KEs, and briefs. Trying to auto-count "designs that
// became real" would require per-brief outcome tracking I don't have. Rather
// than keep a null metric injecting noise into my heartbeat, deactivate.
// Can be reactivated later if brief→outcome tracing gets built.
db.prepare(
  `UPDATE metrics
     SET status = ?, updated_at = ?,
         description = ?
   WHERE id = 'bob.designs-implemented' AND owner = 'bob'`,
).run(
  "inactive",
  now,
  "DEACTIVATED 2026-04-18 — no reliable collector. 'Designs' aren't a tracked artefact; my outputs are hypotheses/experiments/KEs which are covered by bob.hypotheses-resolved. Reactivate if/when brief→implementation tracing exists.",
);

// ── Log summary ───────────────────────────────────────────────────────
const rows = db
  .prepare(
    "SELECT id, name, current, target, threshold, unit, status, source FROM metrics WHERE owner = 'bob' ORDER BY id",
  )
  .all();
console.log("bob metrics after refinement:");
console.log(JSON.stringify(rows, null, 2));

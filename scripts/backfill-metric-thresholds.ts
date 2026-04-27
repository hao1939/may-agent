#!/usr/bin/env bun
// scripts/backfill-metric-thresholds.ts
//
// One-shot (idempotent) backfill of the `threshold` column on active `health`
// type metrics in .state/may.db. Implements Phase 1 of
// agents/may/workspace/projects/metric-reaction-investigation.md M5.
//
// Context: renderer in src/app/cron.ts:710 emits "⚠️ BELOW THRESHOLD" only
// when `m.type === "health" && m.threshold != null && m.current < m.threshold`.
// Before this script, only 1/27 active metrics had a non-null threshold, so
// the marker effectively never fired. Agents read "- [fast] Coverage: 53 →
// target: 0" and correctly answered "no red metrics" because no ⚠️ was
// present.
//
// This script sets sensible per-metric thresholds. Re-runnable — existing
// thresholds are not overwritten unless --force is passed.
//
// Usage:
//   bun scripts/backfill-metric-thresholds.ts            # dry-run (prints plan)
//   bun scripts/backfill-metric-thresholds.ts --apply    # actually UPDATE
//   bun scripts/backfill-metric-thresholds.ts --apply --force  # overwrite existing thresholds too
//
// Picking logic (follows the brief in M5 dispatch + M4 Option A):
//   - ratio metrics (0..1, higher-better): threshold = target * 0.9 if target
//     is a proper ratio, else hand-picked floor.
//   - counts where higher-is-better: threshold = target * 0.5 if target set,
//     else hand-picked floor (e.g. "at least 1/period").
//   - counts where zero-is-ideal (stuck_requests, premature_done): the current
//     renderer only checks `current < threshold`, so "above is bad" cannot be
//     expressed via threshold alone. SKIPPED here; logged for Phase 2.

import { Database } from "bun:sqlite";
import path from "node:path";

type MetricRow = {
  id: string;
  name: string;
  type: string;
  current: number | null;
  target: number | null;
  threshold: number | null;
  alert_op: string | null;
};

// Ordered, auditable: one entry per health metric. `null` threshold means skip
// with rationale (Phase-2 territory).
const PLAN: Array<{ id: string; threshold: number | null; rationale: string }> = [
  {
    id: "bob.experiment-completion",
    threshold: 1,
    rationale: "Count; want ≥1 experiment completed per cycle. 0 → red.",
  },
  {
    id: "evaluator.calibration",
    threshold: 0.5,
    rationale: "Ratio 0..1 (human-LLM agreement). <0.5 indicates miscalibration.",
  },
  {
    id: "evaluator.coverage",
    threshold: 80,
    rationale: "% of sessions evaluated. <80% means too many unevaluated.",
  },
  {
    id: "optimizer.quality-preserved",
    threshold: 0.9,
    rationale: "Ratio; pre/post-optimization quality. <0.9 = 10% degradation.",
  },
  {
    id: "qa.review-coverage",
    threshold: 1,
    rationale: "Count per cycle. 0 = no reviews happening, which is the failure mode.",
  },
  {
    id: "scout.coverage",
    threshold: 50,
    rationale: "% of known papers triaged. <50 = triage is lagging.",
  },
  {
    id: "system.request-throughput",
    threshold: 1,
    rationale: "Completed requests/day. 0 = system stalled.",
  },
  {
    id: "system.stuck-requests",
    threshold: null,
    rationale:
      "Zero-is-ideal count. Renderer only supports `current < threshold` (below). " +
      "Expressing 'any value > 0 is red' requires Phase 2 direction column. SKIP.",
  },
  {
    id: "tech-lead.build-health",
    threshold: 1,
    rationale: "1 = tsc passes, 0 = broken. current<1 → red.",
  },
];

const args = new Set(Bun.argv.slice(2));
const APPLY = args.has("--apply");
const FORCE = args.has("--force");

const dbPath = path.resolve(".state/may.db");
const db = APPLY ? new Database(dbPath) : new Database(dbPath, { readonly: true });

function fetchAll(): MetricRow[] {
  return db
    .query(
      `SELECT id, name, type, current, target, threshold, alert_op
       FROM metrics WHERE status='active' AND type='health' ORDER BY id`,
    )
    .all() as MetricRow[];
}

const before = fetchAll();
const beforeById = new Map(before.map((m) => [m.id, m]));

type RowReport = {
  id: string;
  name: string;
  current: number | null;
  target: number | null;
  old_threshold: number | null;
  new_threshold: number | null;
  expected_red: boolean;
  action: "set" | "skip" | "already-set" | "not-found" | "overwrite";
  rationale: string;
};

const report: RowReport[] = [];

for (const entry of PLAN) {
  const row = beforeById.get(entry.id);
  if (!row) {
    report.push({
      id: entry.id,
      name: "(not found)",
      current: null,
      target: null,
      old_threshold: null,
      new_threshold: entry.threshold,
      expected_red: false,
      action: "not-found",
      rationale: entry.rationale,
    });
    continue;
  }
  if (entry.threshold == null) {
    report.push({
      id: row.id,
      name: row.name,
      current: row.current,
      target: row.target,
      old_threshold: row.threshold,
      new_threshold: null,
      expected_red: false,
      action: "skip",
      rationale: entry.rationale,
    });
    continue;
  }
  const existing = row.threshold != null;
  if (existing && !FORCE) {
    report.push({
      id: row.id,
      name: row.name,
      current: row.current,
      target: row.target,
      old_threshold: row.threshold,
      new_threshold: row.threshold,
      expected_red: row.current != null && row.current < row.threshold,
      action: "already-set",
      rationale: entry.rationale,
    });
    continue;
  }
  const expectedRed = row.current != null && row.current < entry.threshold;
  report.push({
    id: row.id,
    name: row.name,
    current: row.current,
    target: row.target,
    old_threshold: row.threshold,
    new_threshold: entry.threshold,
    expected_red: expectedRed,
    action: existing ? "overwrite" : "set",
    rationale: entry.rationale,
  });
}

console.log(`DB: ${dbPath}`);
console.log(`Mode: ${APPLY ? (FORCE ? "APPLY --force" : "APPLY") : "DRY-RUN"}`);
console.log(`Active health metrics: ${before.length}`);
console.log("");

console.table(
  report.map((r) => ({
    id: r.id,
    current: r.current,
    target: r.target,
    old: r.old_threshold,
    new: r.new_threshold,
    red: r.expected_red ? "⚠️" : "",
    action: r.action,
  })),
);

console.log("\nRationales:");
for (const r of report) {
  console.log(`  ${r.id}: ${r.rationale}`);
}

if (APPLY) {
  const now = Date.now();
  const stmt = db.prepare(
    `UPDATE metrics SET threshold = ?, updated_at = ? WHERE id = ?`,
  );
  let n = 0;
  const tx = db.transaction((rows: RowReport[]) => {
    for (const r of rows) {
      if (r.action === "set" || r.action === "overwrite") {
        stmt.run(r.new_threshold!, now, r.id);
        n++;
      }
    }
  });
  tx(report);
  console.log(`\n✅ Applied ${n} UPDATE(s).`);

  const after = fetchAll();
  console.log("\nVerification — rows after UPDATE:");
  console.table(
    after.map((m) => ({
      id: m.id,
      current: m.current,
      target: m.target,
      threshold: m.threshold,
      red: m.type === "health" && m.threshold != null && m.current != null && m.current < m.threshold
        ? "⚠️"
        : "",
    })),
  );
} else {
  console.log("\n(dry-run; rerun with --apply to persist)");
}

db.close();

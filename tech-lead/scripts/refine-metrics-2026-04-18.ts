/**
 * Idempotent refinement of tech-lead's 4 metrics.
 * Per /tmp/own-your-metrics.md task. Run with: bun agents/tech-lead/scripts/refine-metrics-2026-04-18.ts
 *
 * Fates:
 *   - tech-lead.build-health         KEEP   — fix target polarity (0 → 1)
 *   - tech-lead.meaningful-changes   COLLECT — shell collector: src/ commits in last 7d
 *   - tech-lead.codebase-weight      KEEP   — bogus target=0 replaced with soft cap 32000
 *   - tech-lead.delegation-quality   KEEP   — ratio target 0.85 (was 0)
 *
 * All updates are idempotent UPDATEs keyed by (owner, name).
 */
import { Database } from "bun:sqlite";

const db = new Database(".state/may.db");

type Update = {
  name: string;
  target: number | null;
  threshold: number | null;
  unit: string | null;
  description?: string;
  source?: string | null;
  source_command?: string | null;
  alert_direction?: "below" | "above";
  speed?: "fast" | "daily" | "slow";
};

const updates: Update[] = [
  {
    // Health: 1=OK, 0=FAIL (via `npm run check`). Previously target=0 which made
    // "current==threshold" an edge-of-red state; now target=1 matches threshold.
    name: "Build health",
    target: 1,
    threshold: 1,
    unit: "bool",
    description: "Is the codebase healthy right now? (1 = tsc clean, 0 = tsc errors)",
    alert_direction: "below",
  },
  {
    // Was current=null, never collected. Now: commits touching src/ in last 7d
    // (approximate proxy for "impactful work"). Target ≥10/week; alert below.
    // Continuous, so no RED banner, just signal. Weekly cadence.
    name: "Meaningful changes",
    target: 10,
    threshold: null,
    unit: "commits/week",
    description: "Commits touching src/ in the last 7 days (higher is better).",
    source: "command",
    source_command: "git log --since='7 days ago' --oneline -- src/ 2>/dev/null | wc -l | tr -d ' '",
    alert_direction: "below",
    speed: "daily",
  },
  {
    // Soft cap: if current > target we should be trimming; if under, neutral.
    // "alert_direction=above" signals the polarity. Continuous, so informational.
    name: "Codebase weight",
    target: 32000,
    threshold: null,
    unit: "lines",
    description:
      "Total LOC under src/ (lower is better; soft cap 32000). `alert_direction=above` means current > target is bad.",
    alert_direction: "above",
  },
  {
    // quality is 0..1 average of evaluator scores for coder sessions. 0.85 target.
    name: "Delegation quality",
    target: 0.85,
    threshold: null,
    unit: "ratio",
    description: "Avg evaluator quality (0..1) for coder sessions I delegated in last 7d. Higher is better.",
    alert_direction: "below",
  },
];

const stmt = db.prepare(
  `UPDATE metrics
     SET target=?, threshold=?, unit=?, description=COALESCE(?, description),
         source=COALESCE(?, source),
         source_command=COALESCE(?, source_command),
         alert_direction=COALESCE(?, alert_direction),
         speed=COALESCE(?, speed),
         updated_at=?
   WHERE owner='tech-lead' AND name=?`,
);

const now = Date.now();
for (const u of updates) {
  const info = stmt.run(
    u.target,
    u.threshold,
    u.unit,
    u.description ?? null,
    u.source ?? null,
    u.source_command ?? null,
    u.alert_direction ?? null,
    u.speed ?? null,
    now,
    u.name,
  );
  console.log(`[refine-metrics] ${u.name}: changes=${info.changes}`);
}

// Show final state for verification.
const rows = db
  .query(
    `SELECT name, current, target, threshold, unit, alert_direction, speed, source, status
       FROM metrics WHERE owner='tech-lead' ORDER BY name`,
  )
  .all();
console.log("\nFinal tech-lead metrics:");
console.table(rows);

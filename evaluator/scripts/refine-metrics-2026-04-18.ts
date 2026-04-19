/**
 * Refine Evaluator-owned metrics targets/thresholds.
 *
 * Run from repo root:
 *   export PATH=".state/.bun/bin:$PATH"
 *   bun agents/evaluator/scripts/refine-metrics-2026-04-18.ts
 */
import { Database } from "bun:sqlite";

const db = new Database(".state/may.db");

function updateMetric(id: string, patch: { name?: string; target?: number; threshold?: number | null; unit?: string | null; alert_direction?: "below" | "above"; description?: string | null; status?: string }) {
  const fields: string[] = [];
  const values: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    values.push(v);
  }
  // always bump updated_at
  fields.push(`updated_at = ?`);
  values.push(Date.now());

  values.push(id);

  const q = `UPDATE metrics SET ${fields.join(", ")} WHERE id = ?`;
  const info = db.prepare(q).run(...values);
  if (info.changes !== 1) {
    throw new Error(`Expected to update 1 row for ${id}, updated ${info.changes}`);
  }
}

// Coverage is higher-is-better. Current=70 and threshold=80 implies threshold is a floor.
// Set target >= threshold to make semantics coherent.
updateMetric("evaluator.coverage", {
  target: 90,
  threshold: 80,
  unit: "%",
  alert_direction: "below",
  description: "What fraction of sessions get evaluated? (higher is better)",
});

// Calibration collector is not implemented (current=null). Deactivate for now to remove noise.
updateMetric("evaluator.calibration", {
  status: "inactive",
  threshold: null,
  unit: null,
  description: "(inactive) Placeholder metric; collector not implemented.",
});

const rows = db
  .query(
    "select id,name,status,current,target,threshold,unit,alert_direction,description from metrics where owner='evaluator' and id in ('evaluator.coverage','evaluator.calibration')"
  )
  .all();
console.log(rows);

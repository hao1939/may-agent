import type { SqliteDb } from "../db.js";

/** The small resource edit is part of durable acceptance; reactions run later. */
export function applyMetricMutation(db: SqliteDb, type: string, data: Record<string, unknown>, timestamp: number): void {
  if (typeof data.metricId !== "string" || !data.metricId.trim())
    throw new Error("Metric change requires a metricId");
  if (type === "metric.threshold_changed") {
    if (typeof data.to !== "number" || !Number.isFinite(data.to))
      throw new Error("Metric change requires a finite threshold");
    const changed = db.prepare("UPDATE metrics SET threshold = ?, updated_at = ? WHERE id = ?")
      .run(data.to, timestamp, data.metricId);
    if (!changed.changes) throw new Error(`Metric not found: ${data.metricId}`);
  } else {
    if (!Number.isSafeInteger(data.alertId) || Number(data.alertId) <= 0)
      throw new Error("Alert resolution requires a positive alertId");
    const changed = db.prepare("UPDATE metric_alerts SET resolved_at = COALESCE(resolved_at, ?) WHERE id = ? AND metric_id = ?")
      .run(timestamp, Number(data.alertId), data.metricId);
    if (!changed.changes) throw new Error(`Alert not found for metric ${data.metricId}: ${data.alertId}`);
  }
}

import type { SqliteDb } from "../db.js";

/** The small resource edit is part of durable acceptance; reactions run later. */
export function applyMetricMutation(db: SqliteDb, type: string, data: Record<string, unknown>, timestamp: number): void {
  if (type === "metric.threshold_changed") {
    if (typeof data.metricId !== "string" || typeof data.to !== "number" || !Number.isFinite(data.to))
      throw new Error("Metric change requires a metricId and finite threshold");
    db.prepare("UPDATE metrics SET threshold = ?, updated_at = ? WHERE id = ?").run(data.to, timestamp, data.metricId);
  } else {
    if (!Number.isSafeInteger(data.alertId) || Number(data.alertId) <= 0)
      throw new Error("Alert resolution requires a positive alertId");
    db.prepare("UPDATE metric_alerts SET resolved_at = COALESCE(resolved_at, ?) WHERE id = ?").run(timestamp, Number(data.alertId));
  }
}

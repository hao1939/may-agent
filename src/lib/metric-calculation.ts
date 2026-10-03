import type { MetricCalculation, MetricCalculationOptions } from "@may-agent/sdk";
import type { SqliteDb } from "./db.js";

/** Shared by App admission, direct definitions and reads of retained definitions. */
export function metricCalculationOptions(config: unknown): MetricCalculationOptions {
  const raw = (config as { calculation?: unknown } | null)?.calculation;
  if (raw === undefined) return { method: "latest" };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("calculation must be an object");
  const options = raw as MetricCalculationOptions;
  if (options.method !== "latest" && options.method !== "mean")
    throw new Error("calculation method must be latest or mean");
  for (const key of ["windowMs", "maxAgeMs", "minSamples"] as const) {
    const value = options[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
      throw new Error(`calculation ${key} must be a positive integer`);
    }
  }
  if (options.method === "mean" && options.windowMs === undefined)
    throw new Error("mean calculation requires windowMs");
  if (options.method === "latest" && (options.windowMs !== undefined || options.minSamples !== undefined)) {
    throw new Error("windowMs and minSamples apply to mean calculation");
  }
  return options;
}

/** Pure observation: callers own scheduling and any alert transition. */
export function calculateMetric(
  db: SqliteDb,
  metric: { id: string; config?: unknown; measure_interval?: number | null },
  now: number,
): MetricCalculation {
  const options = metricCalculationOptions(metric.config);
  const latest = db
    .prepare(
      `SELECT value, measured_at FROM metric_snapshots
    WHERE metric_id = ? AND measured_at <= ? ORDER BY measured_at DESC, id DESC LIMIT 1`,
    )
    .get(metric.id, now) as { value: number; measured_at: number } | null;
  const result: MetricCalculation = {
    method: options.method,
    value: null,
    calculatedAt: now,
    measuredAt: latest?.measured_at ?? null,
    sampleCount: latest ? 1 : 0,
    ...(options.windowMs === undefined ? {} : { windowMs: options.windowMs }),
  };
  if (!latest) return { ...result, reason: "No sample at or before calculation time" };
  const maxAge =
    options.maxAgeMs ??
    (metric.measure_interval && metric.measure_interval > 0 ? metric.measure_interval * 2 : options.windowMs);
  if (maxAge !== undefined && now - latest.measured_at > maxAge) {
    return { ...result, reason: "Latest sample is stale" };
  }
  if (options.method === "latest") return { ...result, value: latest.value };
  const aggregate = db
    .prepare(
      `SELECT AVG(value) AS value, COUNT(*) AS count FROM metric_snapshots
    WHERE metric_id = ? AND measured_at > ? AND measured_at <= ?`,
    )
    .get(metric.id, now - options.windowMs!, now) as { value: number | null; count: number };
  result.sampleCount = aggregate.count;
  if (aggregate.count < (options.minSamples ?? 2)) {
    return { ...result, reason: "Insufficient samples in calculation window" };
  }
  return aggregate.value !== null && Number.isFinite(aggregate.value)
    ? { ...result, value: aggregate.value }
    : { ...result, reason: "Calculation did not produce a finite value" };
}

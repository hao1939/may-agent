import type { SqliteDb } from "../../../lib/db.js";

const SAMPLE_LIMIT = 12;
const NOTE_LIMIT = 4_000;
const DAY = 86_400_000;

export function metricEvidenceQuery(params: URLSearchParams, now = Date.now()) {
  const end = params.has("end") ? Number(params.get("end")) : now;
  const windowMs = params.has("windowMs") ? Number(params.get("windowMs")) : DAY;
  if (
    !Number.isSafeInteger(end) ||
    end > now ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    windowMs > 7 * DAY ||
    end < 2 * windowMs
  ) {
    throw new Error("Choose a past cut and adjacent metric windows of at most seven days each");
  }
  return { end, windowMs };
}

type Sample = {
  id: number;
  value: number;
  sampleSize: number | null;
  measuredAt: number;
  measuredBy: string | null;
  note: string | null;
  noteTruncated: number;
};
const SAMPLE = `id, value, sample_size AS sampleSize, measured_at AS measuredAt,
  measured_by AS measuredBy, substr(note, 1, ${NOTE_LIMIT}) AS note,
  COALESCE(length(note) > ${NOTE_LIMIT}, 0) AS noteTruncated`;

/** Mechanical observations only. App policy decides whether a change warrants review. */
export function readMetricEvidence(db: SqliteDb, metricId: string, query: ReturnType<typeof metricEvidenceQuery>) {
  db.exec("SAVEPOINT metric_evidence_report");
  try {
    const definition = db
      .prepare(
        `SELECT id, name, type, owner, project, description, unit,
      status, threshold, alert_op AS alertOp, measure_interval AS measureInterval, config
      FROM metrics WHERE id = ?`,
      )
      .get(metricId) as {
      id: string;
      name: string | null;
      type: string | null;
      owner: string | null;
      project: string | null;
      description: string | null;
      unit: string | null;
      status: string;
      threshold: number | null;
      alertOp: string | null;
      measureInterval: number | null;
      config: string | null;
    } | null;
    if (!definition) return { version: 1, available: false, metricId, ...query };
    const { config, ...metric } = definition;
    let alertRule: unknown = null;
    try {
      alertRule = JSON.parse(config ?? "null")?.alert ?? null;
    } catch {
      /* Unknown configuration remains explicit. */
    }
    const { end, windowMs } = query;
    const window = (start: number, cut: number) => {
      const summary = db
        .prepare(
          `SELECT COUNT(*) AS samples, MIN(value) AS minimum, MAX(value) AS maximum
        FROM metric_snapshots WHERE metric_id = ? AND measured_at >= ? AND measured_at < ?`,
        )
        .get(metricId, start, cut) as { samples: number; minimum: number | null; maximum: number | null };
      const first = db
        .prepare(
          `SELECT ${SAMPLE} FROM metric_snapshots
        WHERE metric_id = ? AND measured_at >= ? AND measured_at < ? ORDER BY measured_at, id LIMIT 1`,
        )
        .get(metricId, start, cut) as Sample | null;
      const last = db
        .prepare(
          `SELECT ${SAMPLE} FROM metric_snapshots
        WHERE metric_id = ? AND measured_at >= ? AND measured_at < ? ORDER BY measured_at DESC, id DESC LIMIT 1`,
        )
        .get(metricId, start, cut) as Sample | null;
      return {
        start,
        end: cut,
        ...summary,
        first,
        last,
        change: first && last && last.measuredAt > first.measuredAt ? last.value - first.value : null,
      };
    };
    const previous = window(end - 2 * windowMs, end - windowMs);
    const current = window(end - windowMs, end);
    // Include the last retained sample even when it predates both trend windows.
    const latest = db
      .prepare(
        `SELECT ${SAMPLE} FROM metric_snapshots
      WHERE metric_id = ? AND measured_at < ? ORDER BY measured_at DESC, id DESC LIMIT 1`,
      )
      .get(metricId, end) as Sample | null;
    const examples = db
      .prepare(
        `SELECT ${SAMPLE} FROM metric_snapshots
      WHERE metric_id = ? AND measured_at >= ? AND measured_at < ?
      ORDER BY measured_at DESC, id DESC LIMIT ?`,
      )
      .all(metricId, end - 2 * windowMs, end, SAMPLE_LIMIT) as Sample[];
    const failures = db
      .prepare(
        `SELECT id AS eventId, timestamp AS at, substr(data, 1, 4000) AS data
      FROM events WHERE metric_id = ? AND event_type = 'metric.measurement.failed'
      AND timestamp < ? ORDER BY timestamp DESC, id DESC LIMIT 7`,
      )
      .all(metricId, end);
    const freshness = !latest
      ? "missing"
      : !metric.measureInterval || metric.measureInterval <= 0
        ? "unknown"
        : end - latest.measuredAt > 2 * metric.measureInterval
          ? "stale"
          : "fresh";
    return {
      version: 1,
      available: true,
      metricId,
      end,
      windowMs,
      metric,
      alertRule,
      latest,
      freshness,
      previous,
      current,
      comparison: {
        // Comparing sampled gauges is not adding overlapping cohorts or inventing a counter rate.
        previousLast: previous.last?.value ?? null,
        currentLast: current.last?.value ?? null,
        change: previous.last && current.last ? current.last.value - previous.last.value : null,
      },
      examples: examples.reverse(),
      examplesTruncated: previous.samples + current.samples > SAMPLE_LIMIT,
      collectionFailures: failures.slice(0, 6),
      collectionFailuresTruncated: failures.length > 6,
      limits: { sampleExamples: SAMPLE_LIMIT, noteChars: NOTE_LIMIT },
      unknowns: [
        "Definition and alert rule are current configuration; samples are retained observations before the requested cut.",
        "Changes compare sampled values, not new events or sums of overlapping rolling windows. Counter resets are not corrected.",
        "Freshness describes the latest sample only; missing intervals and deleted history are not proof of health.",
        "Metric recovery does not establish that any particular input or requested outcome was fulfilled.",
      ],
    };
  } finally {
    db.exec("RELEASE metric_evidence_report");
  }
}

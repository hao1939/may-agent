import {
  matchesEventSelector,
  type AppEvent,
  type AppObservationProjection,
  type ObservationEvent,
} from "@may-agent/sdk";
import type { SqliteDb } from "./db.js";

let runtimeProjectionProvider: () => readonly AppObservationProjection[] = () => [];

/** Host-only binding to the current immutable App registry generation. */
export function setRuntimeObservationProjectionProvider(provider: () => readonly AppObservationProjection[]): void {
  runtimeProjectionProvider = provider;
}

export function runtimeObservationProjections(): readonly AppObservationProjection[] {
  return runtimeProjectionProvider();
}

type EventRow = {
  id: number;
  event_type: string;
  source: string | null;
  owner: string | null;
  timestamp: number;
  delivery_status: string | null;
  accepted_by: string | null;
  data: string | null;
};

function dataOf(row: EventRow): Record<string, unknown> {
  try {
    const value = JSON.parse(row.data ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function observationEvent(row: EventRow): ObservationEvent {
  const data = dataOf(row);
  const project = typeof data.project === "string" ? data.project : undefined;
  const taskId =
    typeof data.taskId === "string" ? data.taskId : typeof data.task_id === "string" ? data.task_id : undefined;
  return {
    id: row.id,
    type: row.event_type,
    ...(row.source ? { source: row.source } : {}),
    ...(row.owner ? { owner: row.owner } : {}),
    ...(project ? { project } : {}),
    ...(taskId ? { taskId } : {}),
    timestamp: row.timestamp,
    ...(row.delivery_status ? { deliveryStatus: row.delivery_status } : {}),
    ...(row.accepted_by ? { acceptedBy: row.accepted_by } : {}),
    data,
  };
}

function selectorEvent(event: ObservationEvent): AppEvent<Record<string, unknown>> {
  return {
    type: event.type,
    data: event.data ?? {},
    source: event.source,
    owner: event.owner,
  };
}

/**
 * Derive intentionally handled observations without changing immutable source
 * event rows. A classifier can accept only evidence selected by its declaration
 * and persisted later than the candidate observation.
 */
export function projectSemanticObservations(options: {
  db: SqliteDb;
  projections?: readonly AppObservationProjection[];
  since: number;
  now: number;
}): ReadonlySet<number> {
  const projections = options.projections ?? runtimeObservationProjections();
  if (!projections.length) return new Set<number>();
  const rows = options.db
    .prepare(
      `SELECT id, event_type, source, owner, timestamp, delivery_status, accepted_by, data
       FROM events
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC, id ASC`,
    )
    .all(options.since, options.now) as EventRow[];
  const events = rows.map(observationEvent);
  const accepted = new Set<number>();

  for (const projection of projections) {
    const candidates = events.filter(
      (event) => event.deliveryStatus === "unhandled" && matchesEventSelector(projection.event, selectorEvent(event)),
    );
    for (const candidate of candidates) {
      const evidence = events.filter(
        (event) =>
          (event.timestamp > candidate.timestamp ||
            (event.timestamp === candidate.timestamp && (event.id ?? 0) > (candidate.id ?? 0))) &&
          projection.evidence.some((selector) => matchesEventSelector(selector, selectorEvent(event))),
      );
      let disposition;
      try {
        disposition = projection.classify(candidate, evidence);
      } catch {
        continue;
      }
      if (!disposition.intentional || !Array.isArray(disposition.evidenceEventIds)) continue;
      const ids = disposition.evidenceEventIds;
      if (new Set(ids).size !== ids.length || candidate.id == null || !ids.includes(candidate.id)) continue;
      const allowedIds = new Set([candidate.id, ...evidence.flatMap((event) => (event.id == null ? [] : [event.id]))]);
      if (ids.every((id) => allowedIds.has(id))) accepted.add(candidate.id);
    }
  }
  return accepted;
}

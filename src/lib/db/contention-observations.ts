import { readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDb } from "../db.js";

// Monotonic within a process, with a common epoch for same-machine processes.
// No SQLite access: these observations never acquire a database lock.
export const contentionNow = () => performance.timeOrigin + performance.now();
export type ContentionInterval = {
  start: number;
  end: number;
  kind: "writer" | "checkpoint";
  mode?: "PASSIVE";
  busy?: number;
  log?: number;
  checkpointed?: number;
};
type Eviction = { count: number; start?: number; end?: number };
export type ContentionSnapshot = {
  intervals: ContentionInterval[];
  // Losses already attributed to this pass, NOT lifetime capture evictions.
  dropped: number;
  evictions?: Eviction[];
  coverage: "unknown";
};
const limit = 128;
type History = { intervals: ContentionInterval[]; dropped: number; evictionStart?: number; evictionEnd?: number };
const local = new WeakMap<SqliteDb, History>();
const publishers = new WeakMap<SqliteDb, { persistDir: string; timer?: ReturnType<typeof setTimeout> }>();
// Fixed slots bound both disk use and read cost even across short-lived workers.
// Collisions, delayed publication and in-flight writes intentionally remain unknown.
const writerSlots = 16;
const writerPath = (persistDir: string, slot: number) => join(persistDir, `writer-observations-${slot}.json`);

export function registerWriterObservations(db: SqliteDb, persistDir: string): void {
  publishers.set(db, { persistDir });
}

/** Publish outside the transaction, at most once per 100ms, and once on close. */
export function flushWriterObservations(db: SqliteDb): void {
  const publisher = publishers.get(db);
  if (!publisher) return;
  if (publisher.timer) clearTimeout(publisher.timer);
  publisher.timer = undefined;
  const history = local.get(db);
  if (!history) return;
  publish(writerPath(publisher.persistDir, process.pid % writerSlots), {
    version: 1, pid: process.pid, ...history,
  });
}

export function observeContention(db: SqliteDb, interval: ContentionInterval): void {
  let history = local.get(db);
  if (!history) local.set(db, history = { intervals: [], dropped: 0 });
  history.intervals.push(interval);
  if (history.intervals.length > limit) {
    const evicted = history.intervals.shift()!;
    history.dropped++;
    history.evictionStart = Math.min(history.evictionStart ?? Infinity, evicted.start);
    history.evictionEnd = Math.max(history.evictionEnd ?? -Infinity, evicted.end);
  }
  const publisher = publishers.get(db);
  if (publisher && !publisher.timer) {
    publisher.timer = setTimeout(() => flushWriterObservations(db), 100);
    publisher.timer.unref();
  }
}

const sidecarPath = (persistDir: string) => join(persistDir, "checkpoint-observations.json");

/** Best-effort handoff from the existing maintenance process. Not a new checkpoint. */
export function publishCheckpointObservation(persistDir: string, interval: ContentionInterval): void {
  const path = sidecarPath(persistDir);
  // One maintenance owner; bounded history survives process-per-pass maintenance.
  const previous = readCheckpointObservations(persistDir);
  const intervals = [...previous.intervals, interval];
  const evictions = [...(previous.evictions ?? []), ...intervals.slice(0, -limit).map(i => ({ count: 1, start: i.start, end: i.end }))];
  const dropped = evictions.reduce((sum, e) => sum + e.count, 0);
  // Unknown bounds from an older sidecar stay unknown rather than inventing coverage.
  const bounded = evictions.every(e => e.start !== undefined && e.end !== undefined);
  publish(path, { version: 1, intervals: intervals.slice(-limit), dropped,
    ...(dropped && bounded ? { evictionStart: Math.min(...evictions.map(e => e.start!)),
      evictionEnd: Math.max(...evictions.map(e => e.end!)) } : {}),
  });
}

function publish(path: string, value: unknown): void {
  const stage = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(stage, JSON.stringify(value), { mode: 0o600 });
    renameSync(stage, path);
  } catch { /* Missing evidence remains unknown; never affect the observed work. */ }
  finally {
    try { unlinkSync(stage); } catch { /* Published or never created. */ }
  }
}

function readCheckpointObservations(persistDir: string): ContentionSnapshot {
  return readSnapshot(sidecarPath(persistDir), "checkpoint");
}

function readSnapshot(path: string, kind: ContentionInterval["kind"]): ContentionSnapshot {
  try {
    if (statSync(path).size > 64_000) throw new Error("Oversized observation");
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (kind === "writer" && value.pid === process.pid) return { intervals: [], dropped: 0, coverage: "unknown" };
    if (value.version !== 1 || !Array.isArray(value.intervals) || value.intervals.length > limit ||
      (kind === "writer" && (!Number.isSafeInteger(value.pid) || value.pid <= 0)) ||
      !Number.isSafeInteger(value.dropped) || value.dropped < 0 || value.intervals.some((v: ContentionInterval) =>
        v.kind !== kind || (kind === "checkpoint" && v.mode !== "PASSIVE") || !Number.isFinite(v.start) || !Number.isFinite(v.end) ||
        v.end < v.start || [v.busy, v.log, v.checkpointed].some(n => n !== undefined && !Number.isFinite(n)))) {
      throw new Error("Invalid observation");
    }
    const bounded = Number.isFinite(value.evictionStart) && Number.isFinite(value.evictionEnd) && value.evictionEnd >= value.evictionStart;
    return { intervals: value.intervals, dropped: 0, coverage: "unknown",
      evictions: value.dropped ? [{ count: value.dropped,
        ...(bounded ? { start: value.evictionStart, end: value.evictionEnd } : {}) }] : [],
    };
  } catch { return { intervals: [], dropped: 0, coverage: "unknown" }; }
}

/** Coverage is unknown: bounded slots can collide; active/delayed writers are not visible. */
export function readContentionObservations(db: SqliteDb, persistDir: string): ContentionSnapshot {
  const history = local.get(db);
  const checkpoint = readCheckpointObservations(persistDir);
  const workers = Array.from({ length: writerSlots }, (_, slot) => readSnapshot(writerPath(persistDir, slot), "writer"));
  return {
    intervals: [...(history?.intervals ?? []), ...checkpoint.intervals, ...workers.flatMap(w => w.intervals)],
    dropped: 0,
    evictions: [
      ...(history?.dropped ? [{ count: history.dropped, start: history.evictionStart, end: history.evictionEnd }] : []),
      ...(checkpoint.evictions ?? []), ...workers.flatMap(w => w.evictions ?? []),
    ],
    coverage: "unknown",
  };
}

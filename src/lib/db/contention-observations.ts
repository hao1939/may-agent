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
export type ContentionSnapshot = { intervals: ContentionInterval[]; dropped: number; coverage: "unknown" };
const limit = 128;
const local = new WeakMap<SqliteDb, { intervals: ContentionInterval[]; dropped: number }>();

export function observeContention(db: SqliteDb, interval: ContentionInterval): void {
  let history = local.get(db);
  if (!history) local.set(db, history = { intervals: [], dropped: 0 });
  history.intervals.push(interval);
  if (history.intervals.length > limit) { history.intervals.shift(); history.dropped++; }
}

const sidecarPath = (persistDir: string) => join(persistDir, "checkpoint-observations.json");

/** Best-effort handoff from the existing maintenance process. Not a new checkpoint. */
export function publishCheckpointObservation(persistDir: string, interval: ContentionInterval): void {
  const path = sidecarPath(persistDir);
  const stage = `${path}.${process.pid}.tmp`;
  try {
    // One maintenance owner; bounded history survives process-per-pass maintenance.
    const previous = readCheckpointObservations(persistDir);
    const intervals = [...previous.intervals, interval];
    const dropped = previous.dropped + Math.max(0, intervals.length - limit);
    writeFileSync(stage, JSON.stringify({ version: 1, intervals: intervals.slice(-limit), dropped }), { mode: 0o600 });
    renameSync(stage, path);
  } catch { /* Missing evidence remains unknown; never affect maintenance. */ }
  finally {
    try { unlinkSync(stage); } catch { /* Published or never created. */ }
  }
}

function readCheckpointObservations(persistDir: string): ContentionSnapshot {
  try {
    const path = sidecarPath(persistDir);
    if (statSync(path).size > 64_000) throw new Error("Oversized observation");
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value.version !== 1 || !Array.isArray(value.intervals) || value.intervals.length > limit ||
      !Number.isSafeInteger(value.dropped) || value.dropped < 0 || value.intervals.some((v: ContentionInterval) =>
        v.kind !== "checkpoint" || v.mode !== "PASSIVE" || !Number.isFinite(v.start) || !Number.isFinite(v.end) ||
        v.end < v.start || [v.busy, v.log, v.checkpointed].some(n => n !== undefined && !Number.isFinite(n)))) {
      throw new Error("Invalid observation");
    }
    return { intervals: value.intervals, dropped: value.dropped, coverage: "unknown" };
  } catch { return { intervals: [], dropped: 0, coverage: "unknown" }; }
}

/** Coverage is intentionally unknown: other workers and in-flight/delayed intervals are not visible. */
export function readContentionObservations(db: SqliteDb, persistDir: string): ContentionSnapshot {
  const history = local.get(db);
  const checkpoint = readCheckpointObservations(persistDir);
  return {
    intervals: [...(history?.intervals ?? []), ...checkpoint.intervals],
    dropped: (history?.dropped ?? 0) + checkpoint.dropped,
    coverage: "unknown",
  };
}

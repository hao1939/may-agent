import type { SqliteDb } from "../../../lib/db.js";
import { afterStateCommit } from "../../../lib/db/transaction.js";
import { eventData } from "../events/bus.js";

const MAX_TASK_PROGRESS_OBSERVATIONS = 256;
type ProgressObservation = {
  data: { stage: string; message: string; status?: string };
  timestamp: number;
};
const observations = new WeakMap<SqliteDb, Map<string, ProgressObservation>>();

function progressKey(appId: string, taskId: string, attemptId: string): string {
  return JSON.stringify([appId, taskId, attemptId]);
}

/** Called after live-event fence validation, including for worker-relayed observations. */
export function recordTaskProgress(
  db: SqliteDb,
  event: { type: string; timestamp?: number; data?: unknown },
): void {
  if (event.type !== "project.task.executor.progress") return;
  const data = eventData(event);
  const scope = data.emission as Record<string, unknown> | undefined;
  if (
    typeof scope?.appId !== "string" || !scope.appId ||
    typeof scope.taskId !== "string" || !scope.taskId ||
    typeof scope.attemptId !== "string" || !scope.attemptId ||
    typeof data.stage !== "string" || !data.stage.trim() ||
    typeof data.message !== "string" || !data.message.trim()
  ) return;
  const key = progressKey(scope.appId, scope.taskId, scope.attemptId);
  const timestamp = Number.isSafeInteger(event.timestamp) ? event.timestamp! : Date.now();
  // Preserve the observation time through worker IPC. Retain only display
  // fields, with one extra character so the UTF-8 detail projection can ellipsize.
  event.timestamp = timestamp;
  const observation: ProgressObservation = {
    data: {
      stage: data.stage.trim().slice(0, 65),
      message: data.message.trim().slice(0, 2_001),
      ...(typeof data.status === "string" ? { status: data.status.trim().slice(0, 65) } : {}),
    },
    timestamp,
  };
  afterStateCommit(db, () => {
    const current = observations.get(db) ?? new Map<string, ProgressObservation>();
    observations.set(db, current);
    current.delete(key);
    current.set(key, observation);
    if (current.size > MAX_TASK_PROGRESS_OBSERVATIONS) current.delete(current.keys().next().value!);
  });
}

/** Optional process-local display evidence; exact attempt identity remains authoritative. */
export function readTaskProgress(
  db: SqliteDb,
  appId: string,
  taskId: string,
  attemptId: string,
): ProgressObservation | null {
  const observation = observations.get(db)?.get(progressKey(appId, taskId, attemptId));
  return observation ? { ...observation, data: { ...observation.data } } : null;
}

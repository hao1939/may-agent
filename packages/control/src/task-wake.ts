export const TASK_UPDATE_EVENT_TYPES = [
  "project.task.reconcile.started",
  "project.task.reconciled",
  "project.task.reconcile.skipped",
  "project.task.handler.unavailable",
  "project.task.handler.recovered",
  "project.task.verification.failed",
  "project.task.recovery.requeued",
  "project.task.recovery.repaired",
  "project.task.executor.progress",
  "app.task.cancelled",
] as const;

/** Events after which a Task-derived list may have changed membership. */
export const TASK_DERIVED_VIEW_EVENT_TYPES = ["project.task.reconciled", "app.task.cancelled"] as const;
const TASK_DERIVED_VIEW_EVENTS = new Set<string>(TASK_DERIVED_VIEW_EVENT_TYPES);

export function isTaskDerivedViewWake(event: unknown): boolean {
  return Boolean(
    event &&
    typeof event === "object" &&
    !Array.isArray(event) &&
    typeof (event as Record<string, unknown>).type === "string" &&
    TASK_DERIVED_VIEW_EVENTS.has((event as Record<string, unknown>).type as string),
  );
}

const TASK_UPDATE_EVENTS = new Set<string>(TASK_UPDATE_EVENT_TYPES);

export function taskUpdateIdentity(event: unknown): { appId: string; taskId: string } | null {
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const envelope = event as Record<string, unknown>;
  if (typeof envelope.type !== "string" || !TASK_UPDATE_EVENTS.has(envelope.type)) return null;
  const data =
    envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
      ? (envelope.data as Record<string, unknown>)
      : envelope;
  // Executor lifecycle stages are diagnostic mechanics. Only an explicit
  // human-readable progress message should wake a human Task surface.
  if (
    envelope.type === "project.task.executor.progress" &&
    (typeof data.message !== "string" || !data.message.trim())
  ) {
    return null;
  }
  const target =
    envelope.target && typeof envelope.target === "object" && !Array.isArray(envelope.target)
      ? (envelope.target as Record<string, unknown>)
      : {};
  const emission =
    data.emission && typeof data.emission === "object" && !Array.isArray(data.emission)
      ? (data.emission as Record<string, unknown>)
      : {};
  const appId = [emission.appId, data.appId, data.project, target.appId].find(
    (value): value is string => typeof value === "string" && Boolean(value.trim()),
  );
  const taskId = [emission.taskId, data.taskId, target.taskId].find(
    (value): value is string => typeof value === "string" && Boolean(value.trim()),
  );
  return appId && taskId ? { appId: appId.trim().replace(/\.app$/, ""), taskId: taskId.trim() } : null;
}

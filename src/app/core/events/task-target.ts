/** Read envelope routing identity consistently for admission and live delivery. */
export function readTaskEventTarget(value: unknown): { appId?: string; taskId: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const target = value as Record<string, unknown>;
  const taskId = typeof target.taskId === "string" ? target.taskId.trim() : "";
  if (!taskId) return null;
  const appId = [target.appId, target.project]
    .find((value): value is string => typeof value === "string" && Boolean(value.trim()))
    ?.trim()
    .replace(/\.app$/, "");
  return { appId: appId || undefined, taskId };
}

/**
 * App input's existing targetTaskId is an explicit address, too. Interpret it
 * in one place for admission and observation without rewriting saved envelopes
 * (or changing their idempotency identity).
 */
export function readEventTaskTarget(event: {
  type: string;
  target?: unknown;
  data?: unknown;
}): { appId?: string; taskId: string } | null {
  const target = readTaskEventTarget(event.target);
  if (event.type !== "app.input.requested") return target;
  const data =
    event.data && typeof event.data === "object" && !Array.isArray(event.data)
      ? (event.data as Record<string, unknown>)
      : {};
  const taskId = typeof data.targetTaskId === "string" ? data.targetTaskId.trim() : "";
  if (!taskId) return target;
  if (target && target.taskId !== taskId) throw new Error("Event target.taskId conflicts with data.targetTaskId");
  const envelope = event.target && typeof event.target === "object" ? (event.target as Record<string, unknown>) : {};
  return readTaskEventTarget({ appId: envelope.appId ?? data.appId, taskId });
}

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

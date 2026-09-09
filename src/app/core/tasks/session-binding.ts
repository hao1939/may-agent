function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function appTaskSessionBinding(value: unknown): { appId: string; taskId: string; generation: number } | null {
  if (!isRecord(value)) return null;
  const appId = typeof value.appId === "string" ? value.appId.trim().replace(/\.app$/, "") : "";
  const taskId = typeof value.taskId === "string" ? value.taskId.trim() : "";
  const generation = value.generation;
  return appId && taskId && typeof generation === "number" && Number.isInteger(generation) && generation > 0
    ? { appId, taskId, generation }
    : null;
}

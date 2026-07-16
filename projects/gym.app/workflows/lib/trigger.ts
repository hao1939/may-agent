export function extractTrigger(task: string): Record<string, unknown> | null {
  const header = "## Trigger Event";
  const lineIndex = task.lastIndexOf(`\n${header}`);
  const headerIndex =
    lineIndex >= 0 ? lineIndex + 1 : task.startsWith(header) ? 0 : -1;
  if (headerIndex < 0) return null;

  const afterHeader = task.slice(headerIndex + header.length);
  const fenceIndex = afterHeader.indexOf("```json");
  if (fenceIndex < 0) return null;
  const jsonStart = fenceIndex + "```json".length;
  const remaining = afterHeader.slice(jsonStart);
  const closingFence = remaining.lastIndexOf("```");
  if (closingFence < 0) return null;

  try {
    const parsed = JSON.parse(remaining.slice(0, closingFence).trim());
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function triggerDetails(task: string): Record<string, unknown> | null {
  const trigger = extractTrigger(task);
  if (!trigger) return null;
  const merged: Record<string, unknown> = {};
  for (const key of ["data", "payload", "params"]) {
    const value = trigger[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(merged, value);
    }
  }
  return { ...merged, ...trigger };
}

export function safeKey(value: unknown, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

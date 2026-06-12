import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type TriggerEvent = {
  type?: string;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

export function field(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

export function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function resolveAppDir(
  projectDir: string,
  explicitAppDir?: string,
): string {
  if (explicitAppDir) return explicitAppDir;
  const embeddedProjectPath = join(projectDir, ".app", "project.json");
  const legacyRootTaskDir = join(projectDir, "tasks");
  if (existsSync(embeddedProjectPath) && existsSync(legacyRootTaskDir))
    return projectDir;
  if (existsSync(embeddedProjectPath)) return join(projectDir, ".app");
  return new URL("../..", import.meta.url).pathname;
}

export function parseTriggerEvent(raw: string): TriggerEvent | null {
  const match = raw.match(/## Trigger Event\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as TriggerEvent;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function triggerValue(event: TriggerEvent | null, key: string): unknown {
  return event?.data && typeof event.data === "object" && key in event.data
    ? event.data[key]
    : event?.params && typeof event.params === "object" && key in event.params
      ? event.params[key]
      : event?.[key];
}

function triggerNumber(
  event: TriggerEvent | null,
  key: string,
): number | undefined {
  const value = triggerValue(event, key);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function triggerString(event: TriggerEvent | null, key: string): string {
  const value = triggerValue(event, key);
  return typeof value === "string" ? value : "";
}

export function resultText(result: unknown): string {
  const typed = result as {
    message?: string;
    summary?: string;
    lastAssistantText?: string;
    status?: string;
  };
  return (
    typed.message ??
    typed.summary ??
    typed.lastAssistantText ??
    typed.status ??
    JSON.stringify(result) ??
    String(result)
  );
}

export function triggerBlock(raw: string): string {
  return raw.match(/## Trigger Event[\s\S]*$/)?.[0] ?? "";
}

export function maxConcurrent(
  raw: string,
  trigger: TriggerEvent | null,
  fallback = 3,
): number {
  const match = raw.match(/^maxConcurrent:\s*(.+)$/m);
  const fromTask = Number.parseInt(match?.[1]?.trim() ?? "", 10);
  return Math.max(
    1,
    triggerNumber(trigger, "maxConcurrent") || fromTask || fallback,
  );
}

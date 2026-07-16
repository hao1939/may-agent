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

export function sourceDir(raw: string): string {
  return (
    field(raw, "source") ||
    field(raw, "sourceRoot") ||
    field(raw, "sourceDir") ||
    process.env.AKS_RP_SOURCE_DIR ||
    "/app/sources/aks-rp"
  );
}

function matchingJsonObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

export function parseTriggerEvent(raw: string): TriggerEvent | null {
  const marker = raw.indexOf("## Trigger Event");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const firstBrace = scoped.indexOf("{");
  if (firstBrace < 0) return null;
  const objectText = matchingJsonObject(scoped, firstBrace);
  if (!objectText) return null;
  try {
    const parsed = JSON.parse(objectText) as TriggerEvent;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function triggerValue(event: TriggerEvent | null, key: string): unknown {
  if (event?.data && typeof event.data === "object") {
    const data = event.data as Record<string, unknown>;
    if (key in data) return data[key];
    const nestedParams = data.params;
    if (
      nestedParams &&
      typeof nestedParams === "object" &&
      !Array.isArray(nestedParams) &&
      key in nestedParams
    ) {
      return (nestedParams as Record<string, unknown>)[key];
    }
  }
  return event?.params &&
    typeof event.params === "object" &&
    key in event.params
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

function nonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "";
}

function errorText(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const typed = value as { message?: unknown; error?: unknown };
    return nonEmptyString(typed.message) || nonEmptyString(typed.error);
  }
  return "";
}

export function resultText(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  const typed = result as {
    message?: string;
    summary?: string;
    errorMessage?: string;
    error?: unknown;
    lastAssistantText?: string | null;
    finishResult?: { summary?: unknown };
    status?: string;
  };
  const finishSummary = nonEmptyString(typed.finishResult?.summary);
  const runtimeError =
    nonEmptyString(typed.errorMessage) || errorText(typed.error);
  return (
    runtimeError ||
    nonEmptyString(typed.message) ||
    nonEmptyString(typed.summary) ||
    finishSummary ||
    nonEmptyString(typed.lastAssistantText) ||
    nonEmptyString(typed.status) ||
    JSON.stringify(result) ||
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

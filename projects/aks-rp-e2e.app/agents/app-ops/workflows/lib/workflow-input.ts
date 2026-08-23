import { existsSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";

export type WorkflowSource = string | WorkflowContext<unknown>;

export type TriggerEvent = {
  type?: string;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isWorkflowContext(value: WorkflowSource): value is WorkflowContext {
  return typeof value !== "string";
}

function authoredInput(source: WorkflowContext): Record<string, unknown> {
  return record(source.reconciliation?.input ?? source.input);
}

export function field(
  source: WorkflowSource,
  name: string,
): string | undefined {
  if (isWorkflowContext(source)) {
    const input = authoredInput(source);
    const value = input[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (name === "owner" || name === "agent") {
      return source.reconciliation?.agent;
    }
    if (name === "app") return source.workspace?.appRoot;
    if (name === "project") return source.workspace?.projectRoot;
    return undefined;
  }
  const raw = source;
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
  if (explicitAppDir) {
    const isBundledRuntimeDir = explicitAppDir.includes(
      `${sep}.state${sep}runtime-modules`,
    );
    if (
      !isBundledRuntimeDir ||
      existsSync(join(explicitAppDir, "project.json"))
    ) {
      return explicitAppDir;
    }
  }
  const siblingAppDir = projectDir.endsWith(".app")
    ? projectDir
    : `${projectDir}.app`;
  if (existsSync(join(siblingAppDir, "project.json"))) return siblingAppDir;
  throw new Error(
    `Cannot resolve sibling Agent App for workspace ${projectDir}`,
  );
}

export function sourceDir(raw: WorkflowSource): string {
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

export function parseTriggerEvent(raw: WorkflowSource): TriggerEvent | null {
  if (isWorkflowContext(raw)) {
    return (
      (raw.reconciliation?.events.items.at(-1)?.event as
        TriggerEvent | undefined) ?? null
    );
  }
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

export function parseReconciliationTaskPayload(
  raw: WorkflowSource,
): Record<string, unknown> | null {
  if (isWorkflowContext(raw)) {
    const reconciliation = raw.reconciliation;
    if (!reconciliation) return null;
    return {
      appId: reconciliation.appId,
      taskId: reconciliation.taskId,
      generation: reconciliation.generation,
      resourceVersion: reconciliation.resourceVersion,
      agent: reconciliation.agent,
      mode: reconciliation.mode,
      outcome: reconciliation.outcome,
      acceptance: reconciliation.acceptance,
      input: reconciliation.input,
      children: reconciliation.children,
      events: reconciliation.events,
    };
  }
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const firstBrace = scoped.indexOf("{");
  if (firstBrace < 0) return null;
  const objectText = matchingJsonObject(scoped, firstBrace);
  if (!objectText) return null;
  try {
    const parsed = JSON.parse(objectText) as Record<string, unknown>;
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

export function triggerBlock(raw: WorkflowSource): string {
  if (isWorkflowContext(raw)) {
    const latestEvent = raw.reconciliation?.events.items.at(-1)?.event;
    return latestEvent
      ? `## Trigger Event\n\`\`\`json\n${JSON.stringify(latestEvent, null, 2)}\n\`\`\``
      : "";
  }
  return raw.match(/## Trigger Event[\s\S]*$/)?.[0] ?? "";
}

export function maxConcurrent(
  raw: WorkflowSource,
  trigger: TriggerEvent | null,
  fallback = 3,
): number {
  const fromTask = Number.parseInt(field(raw, "maxConcurrent") ?? "", 10);
  return Math.max(
    1,
    triggerNumber(trigger, "maxConcurrent") || fromTask || fallback,
  );
}

export function frontierLimit(raw: WorkflowSource, fallback: number): number {
  const configured = Number.parseInt(field(raw, "frontierLimit") ?? "", 10);
  return Math.max(1, Number.isFinite(configured) ? configured : fallback);
}

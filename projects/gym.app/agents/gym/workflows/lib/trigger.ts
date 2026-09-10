import type { WorkflowContext } from "@may-agent/sdk";

type TriggerSource = Pick<WorkflowContext, "input" | "reconciliation">;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractTrigger(
  source: TriggerSource,
): Record<string, unknown> | null {
  return record(source.reconciliation?.events.items.at(-1)?.event);
}

export function triggerDetails(
  source: TriggerSource,
): Record<string, unknown> | null {
  const trigger = extractTrigger(source);
  const input = reconciliationInput(source);
  if (!trigger) return input;
  const merged: Record<string, unknown> = {
    ...(trigger.type === "app.task.requested" ? (input ?? {}) : {}),
  };
  for (const key of ["data", "payload", "params"]) {
    const value = trigger[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(merged, value);
    }
  }
  return { ...merged, ...trigger };
}

export function reconciliationInput(
  source: TriggerSource,
): Record<string, unknown> | null {
  return record(source.reconciliation?.input) ?? record(source.input);
}

export function reconciliationPacket(
  source: TriggerSource,
): Record<string, unknown> | null {
  return record(source.reconciliation);
}

export function safeKey(value: unknown, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

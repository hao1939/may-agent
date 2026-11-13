import { createHash } from "node:crypto";
import type { WorkflowContext } from "@may-agent/sdk";

type ReconciliationEvents = NonNullable<
  WorkflowContext["reconciliation"]
>["events"];

type EmissionContext = {
  reconciliation?: { events: ReconciliationEvents };
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  const item = record(value);
  if (Object.keys(item).length === 0) return value;
  return Object.fromEntries(
    Object.entries(item)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonical(child)]),
  );
}

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)) ?? "null")
    .digest("hex")
    .slice(0, 16);
}

function byteFingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value) ?? "null")
    .digest("hex")
    .slice(0, 16);
}

/** Preserve the existing key format, including older triggers without IDs. */
function reconciliationCycleKey(
  events: ReconciliationEvents | undefined,
): string | undefined {
  if (!events) return undefined;
  if (Number.isSafeInteger(events.throughEventId)) {
    return `event-${events.throughEventId}`;
  }
  const eventId = [...events.items]
    .reverse()
    .find((item) => Number.isSafeInteger(item.eventId))?.eventId;
  if (eventId !== undefined) return `event-${eventId}`;
  const latestEvent = events.items.at(-1)?.event;
  if (latestEvent) return `event-${fingerprint(latestEvent)}`;
  return undefined;
}

/**
 * Local publication identity; the Host supplies App/Task/generation scope.
 * Retries retain their input key. Without input, the logical key is sufficient.
 * Apps may bind changing facts to their exact serialized data; property order
 * matters here because the Host compares publication bytes on key reuse.
 */
export function taskEmissionKey(
  ctx: EmissionContext,
  logicalKey: string,
  materialFact?: unknown,
): string {
  const cycle = reconciliationCycleKey(ctx.reconciliation?.events);
  const wakeKey = cycle ? `${cycle}:${logicalKey}` : logicalKey;
  return materialFact === undefined
    ? wakeKey
    : `${wakeKey}:fact-${byteFingerprint(materialFact)}`;
}

/** Stable bounded identity for one semantic member, independent of field order. */
export function memberEmissionKey(prefix: string, identity: unknown): string {
  return `${prefix}-${fingerprint(identity)}`;
}

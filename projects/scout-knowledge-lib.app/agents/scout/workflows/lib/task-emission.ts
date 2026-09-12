import { createHash } from "node:crypto";
import type { WorkflowContext } from "@may-agent/sdk";

type ReconciliationView = NonNullable<WorkflowContext["reconciliation"]>;

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

/** Stable input identity for one Task wake, independent of its retry. */
function reconciliationCycleKey(
  reconciliation: ReconciliationView,
): string | undefined {
  const events = reconciliation.events;
  if (Number.isSafeInteger(events?.throughEventId)) {
    return `event-${events.throughEventId}`;
  }
  const eventId = [...(events?.items ?? [])]
    .reverse()
    .find((item) => Number.isSafeInteger(item.eventId))?.eventId;
  if (eventId !== undefined) return `event-${eventId}`;
  const latestEvent = events?.items.at(-1)?.event;
  if (latestEvent) {
    return `event-${fingerprint(latestEvent)}`;
  }
  // Without input, the Host's Task-generation scope is sufficient. A mutable
  // resource version changes during retry and must not invent a new publication.
  return undefined;
}

/**
 * Every Task can receive multiple inputs in one generation. Scope publication
 * to the exact wake, rather than a retired Task mode or mutable resource version.
 * When supplied, materialFact binds the key to the exact serialized event data,
 * so a reused key implies byte-equivalent data while changed facts get new keys.
 */
export function taskEmissionKey(
  ctx: Pick<WorkflowContext, "reconciliation">,
  logicalKey: string,
  materialFact?: unknown,
): string {
  const reconciliation = ctx.reconciliation;
  const cycle = reconciliation && reconciliationCycleKey(reconciliation);
  const wakeKey = cycle ? `${cycle}:${logicalKey}` : logicalKey;
  return materialFact === undefined
    ? wakeKey
    : `${wakeKey}:fact-${byteFingerprint(materialFact)}`;
}

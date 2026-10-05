import type { EventBus } from "../events/bus.js";
import type { AppTaskClaimResult } from "./app-task-reconciler.js";

type CheckCounts = Record<AppTaskClaimResult["kind"], number>;
type CheckObservation = { since: number; counts: CheckCounts };
const observations = new WeakMap<EventBus, CheckObservation>();

/** Bounded activity counters; no Task writes, Events, timers or per-Task labels. */
export function resetTaskChecks(bus: EventBus, since = Date.now()): void {
  observations.set(bus, { since, counts: { claimed: 0, busy: 0, waiting: 0, attention: 0, completed: 0 } });
}

export function readTaskChecks(bus: EventBus): CheckObservation {
  if (!observations.has(bus)) resetTaskChecks(bus);
  const current = observations.get(bus)!;
  return { since: current.since, counts: { ...current.counts } };
}

export function recordTaskCheck(bus: EventBus, outcome: AppTaskClaimResult["kind"]): void {
  if (!observations.has(bus)) resetTaskChecks(bus);
  observations.get(bus)!.counts[outcome]++;
}

/** Private worker reports join the parent counters without publishing an Event. */
export function mergeTaskChecks(bus: EventBus, counts: unknown): void {
  if (!counts || typeof counts !== "object") return;
  if (!observations.has(bus)) resetTaskChecks(bus);
  const current = observations.get(bus)!.counts;
  for (const kind of Object.keys(current) as Array<keyof CheckCounts>) {
    const value = (counts as Record<string, unknown>)[kind];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) current[kind] += value;
  }
}

import type { EventBus } from "../events/bus.js";
import type { AppTaskClaimResult } from "./app-task-reconciler.js";

type CheckCounts = Record<AppTaskClaimResult["kind"], number>;
type CheckExample = { appId: string; taskId: string; outcome: AppTaskClaimResult["kind"] };
type CheckObservation = { since: number; counts: CheckCounts; examples: CheckExample[]; examplesTruncated: boolean };
const observations = new WeakMap<EventBus, CheckObservation>();

/** Bounded activity counters; no Task writes, Events, timers or per-Task labels. */
export function resetTaskChecks(bus: EventBus, since = Date.now()): void {
  observations.set(bus, {
    since, counts: { claimed: 0, busy: 0, waiting: 0, attention: 0, completed: 0 },
    examples: [], examplesTruncated: false,
  });
}

export function readTaskChecks(bus: EventBus): CheckObservation {
  if (!observations.has(bus)) resetTaskChecks(bus);
  const current = observations.get(bus)!;
  return { ...current, counts: { ...current.counts }, examples: current.examples.map((entry) => ({ ...entry })) };
}

export function recordTaskCheck(
  bus: EventBus,
  outcome: AppTaskClaimResult["kind"],
  target?: { appId: string; taskId: string },
): void {
  if (!observations.has(bus)) resetTaskChecks(bus);
  const current = observations.get(bus)!;
  current.counts[outcome]++;
  if (target && outcome !== "claimed") rememberExample(current, { ...target, outcome });
}

/** Private worker reports join the parent counters without publishing an Event. */
export function mergeTaskChecks(bus: EventBus, report: unknown): void {
  if (!report || typeof report !== "object") return;
  const { counts, examples, examplesTruncated } = report as Record<string, unknown>;
  if (!counts || typeof counts !== "object") return;
  if (!observations.has(bus)) resetTaskChecks(bus);
  const current = observations.get(bus)!;
  for (const kind of Object.keys(current.counts) as Array<keyof CheckCounts>) {
    const value = (counts as Record<string, unknown>)[kind];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) current.counts[kind] += value;
  }
  if (Array.isArray(examples)) for (const example of examples.slice(-3)) rememberExample(current, example);
  current.examplesTruncated ||= examplesTruncated === true;
}

/** Latest distinct Task references, not a top-offender ranking or a per-Task series. */
function rememberExample(current: CheckObservation, value: unknown): void {
  if (!value || typeof value !== "object") return;
  const { appId, taskId, outcome } = value as CheckExample;
  if (typeof appId !== "string" || typeof taskId !== "string" || outcome === "claimed" ||
      !Object.hasOwn(current.counts, outcome)) return;
  const example = { appId, taskId, outcome };
  // Keep exact identities within the ordinary bounded metric-note read.
  if (JSON.stringify(example).length > 800) {
    current.examplesTruncated = true;
    return;
  }
  current.examples = current.examples.filter((entry) => entry.appId !== appId || entry.taskId !== taskId);
  current.examples.push(example);
  if (current.examples.length > 3) {
    current.examples.shift();
    current.examplesTruncated = true;
  }
}

import { createHash } from "node:crypto";
import type { AppEvent, AppObserver, ObserverHealth, ResourceObserver } from "@may-agent/sdk";
import type { ReadObservationDemand } from "../../core/state/observation-demand.js";
import { copyObserverSnapshot } from "./observer-snapshot.js";

const PAGE_SIZE = 4;
const RECENT_RESOURCES = 64;
const MAX_UNSETTLED_READS = 8;
type Memory = { cursor?: string; samples?: Record<string, string> };
type ResourceHealth = NonNullable<ObserverHealth["resources"]>[number];

function fingerprint(value: unknown): string {
  const stable = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(stable);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(
      Object.entries(item)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  };
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}

/** Adapts resource reads to the existing publication/snapshot boundary. */
export function bindResourceObserver(options: {
  appId: string;
  definition: ResourceObserver;
  readDemand: ReadObservationDemand;
  needsFact: (fact: AppEvent) => boolean;
  signal: AbortSignal;
  occupied: Set<string>;
  now: () => number;
}): {
  observer: AppObserver;
  resources(): ResourceHealth[];
  request(subject: string): void;
  hasPending(): boolean;
  takePending(): AppObserver["run"];
} {
  const { appId, definition, readDemand, needsFact, signal, occupied, now } = options;
  const owner = `app:${appId}`;
  const source = `${owner}:observer:${definition.id}`;
  const health = new Map<string, ResourceHealth>();
  const pending = new Set<string>();

  async function inspect(resource: string): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    if (occupied.has(resource)) throw new Error("Previous read has not settled");
    if (occupied.size >= MAX_UNSETTLED_READS)
      throw new Error("Observer has too many unsettled reads; inspect provider cancellation");
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    occupied.add(resource);
    const read = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return definition.inspect(resource, { signal: controller.signal });
    });
    void read.then(
      () => occupied.delete(resource),
      () => occupied.delete(resource),
    );
    const timeout = setTimeout(
      () => controller.abort(new Error(`Observation exceeded ${definition.timeoutMs}ms`)),
      definition.timeoutMs,
    );
    let onAbort!: () => void;
    try {
      return await Promise.race([
        read,
        new Promise<never>((_, reject) => {
          onAbort = () => reject(controller.signal.reason);
          controller.signal.addEventListener("abort", onAbort, { once: true });
        }),
      ]);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      controller.signal.removeEventListener("abort", onAbort);
    }
  }

  const run = async (context: Parameters<AppObserver["run"]>[0], requested?: string[]) => {
    const previous = (context.previousObservation ?? {}) as Memory;
    let demand = readDemand(definition.type, source, requested ? "" : (previous.cursor ?? ""), PAGE_SIZE, requested);
    if (!requested && !demand.length && previous.cursor) demand = readDemand(definition.type, source, "", PAGE_SIZE);
    for (const item of demand) pending.delete(item.subject);
    const samples = { ...previous.samples };
    const events: AppEvent[] = [];
    for (const item of demand) {
      signal.throwIfAborted();
      const resource = item.subject.slice("resource:".length);
      const status: ResourceHealth = {
        resource,
        checkedAt: now(),
        lastSuccessAt: health.get(resource)?.lastSuccessAt,
      };
      let event: AppEvent;
      let signature: string;
      try {
        if (!item.subject.startsWith("resource:") || !resource)
          throw new Error("Observation needs a nonempty resource reference");
        const value = copyObserverSnapshot(await inspect(resource));
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error("Detector must return a JSON object");
        status.checkedAt = status.lastSuccessAt = now();
        event = { type: definition.type, source, owner, data: { ...value, resource } };
        signature = fingerprint({ value });
      } catch (error) {
        signal.throwIfAborted();
        status.checkedAt = now();
        status.error = String(error instanceof Error ? error.message : error).slice(0, 2000);
        event = {
          type: "app.observer.failed",
          source,
          owner,
          target: { project: appId },
          data: { appId, observerId: definition.id, subject: item.subject, error: status.error },
        };
        signature = fingerprint({ error: status.error });
      }
      health.delete(resource);
      health.set(resource, status);
      if (health.size > RECENT_RESOURCES) health.delete(health.keys().next().value!);
      // Suppression is only an optimization. A current open Condition can
      // need unchanged data even after an earlier wait with the same name.
      if (samples[item.subject] !== signature || needsFact(event)) events.push(event);
      delete samples[item.subject];
      samples[item.subject] = signature;
    }
    return {
      events,
      nextObservation: {
        cursor: requested ? (previous.cursor ?? "") : (demand.at(-1)?.subject ?? ""),
        samples: Object.fromEntries(Object.entries(samples).slice(-RECENT_RESOURCES)),
      },
    };
  };
  return {
    resources: () => structuredClone([...health.values()]),
    request(subject) {
      if (pending.size < RECENT_RESOURCES) pending.add(subject);
    },
    hasPending: () => pending.size > 0,
    takePending() {
      // Consume before context preparation or I/O can fail. A missed check
      // retries on the normal cadence, never in a tight notification loop.
      const requested = [...pending].slice(0, PAGE_SIZE);
      for (const subject of requested) pending.delete(subject);
      return (context) => run(context, requested);
    },
    observer: { id: definition.id, intervalMs: definition.intervalMs, run: (context) => run(context) },
  };
}

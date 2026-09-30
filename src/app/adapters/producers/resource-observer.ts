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
  signal: AbortSignal;
  occupied: Set<string>;
  now: () => number;
}): { observer: AppObserver; resources(): ResourceHealth[] } {
  const { appId, definition, readDemand, signal, occupied, now } = options;
  const owner = `app:${appId}`;
  const source = `${owner}:observer:${definition.id}`;
  const health = new Map<string, ResourceHealth>();

  async function inspect(resource: string): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    if (occupied.has(resource)) throw new Error("Previous timed-out read has not settled");
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

  return {
    resources: () => structuredClone([...health.values()]),
    observer: {
      id: definition.id,
      intervalMs: definition.intervalMs,
      async run(context) {
        const previous = (context.previousObservation ?? {}) as Memory;
        let demand = readDemand(definition.type, source, previous.cursor ?? "", PAGE_SIZE);
        if (!demand.length && previous.cursor) demand = readDemand(definition.type, source, "", PAGE_SIZE);
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
            event = { type: definition.type, source, owner, data: { ...value, resource, observedAt: now() } };
            signature = fingerprint({ interest: item.identity, value });
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
            signature = fingerprint({ interest: item.identity, error: status.error });
          }
          health.delete(resource);
          health.set(resource, status);
          if (health.size > RECENT_RESOURCES) health.delete(health.keys().next().value!);
          if (samples[item.subject] !== signature) events.push(event);
          delete samples[item.subject];
          samples[item.subject] = signature;
        }
        return {
          events,
          nextObservation: {
            cursor: demand.at(-1)?.subject ?? "",
            samples: Object.fromEntries(Object.entries(samples).slice(-RECENT_RESOURCES)),
          },
        };
      },
    },
  };
}

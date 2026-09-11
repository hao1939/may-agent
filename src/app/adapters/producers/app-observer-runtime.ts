import {
  MAX_OBSERVER_SNAPSHOT_BYTES,
  type AppEvent,
  type AppObserver,
  type ObserverContext,
  type ObserverSnapshot,
} from "@may-agent/sdk";
import type { LoadedAppDefinition } from "../../core/apps/registry.js";
import { EVENT_ROW_ID, type EventBus } from "../../core/events/bus.js";
import { OwnedTimer } from "../../core/scheduling/timer.js";

type ObserverState = {
  appId: string;
  appDir: string;
  observer: AppObserver;
  fingerprint: string;
  lastSlot: number;
  running: boolean;
  observation?: ObserverSnapshot;
};

export type AppObserverRuntime = {
  start(intervalMs: number): void;
  replace(entries: readonly Readonly<LoadedAppDefinition>[]): void;
  scanNow(): void;
  close(): void;
};

function observerFingerprint(observer: AppObserver): string {
  return `${observer.intervalMs}:${observer.run.toString()}`;
}

function validFact(value: unknown): value is AppEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.type === "string" && Boolean(event.type.trim()) && Object.prototype.hasOwnProperty.call(event, "data")
  );
}

function copySnapshot(value: unknown): ObserverSnapshot {
  let remaining = MAX_OBSERVER_SNAPSHOT_BYTES;
  const charge = (bytes: number): void => {
    if (bytes > remaining) throw new Error(`observer snapshot exceeds ${MAX_OBSERVER_SNAPSHOT_BYTES} bytes`);
    remaining -= bytes;
  };
  const chargeString = (item: string): void => {
    // UTF-16 length is a lower bound on JSON UTF-8 size. Reject huge strings
    // before encoding; only input bounded by the budget reaches this encoder.
    charge(item.length);
    charge(Buffer.byteLength(JSON.stringify(item), "utf8") - item.length);
  };
  const copyProperty = (item: object, key: string, depth: number): ObserverSnapshot => {
    const property = Object.getOwnPropertyDescriptor(item, key);
    if (!property || !("value" in property))
      throw new Error("observer snapshot must contain only JSON data properties");
    return copy(property.value, depth);
  };
  const copy = (item: unknown, depth: number): ObserverSnapshot => {
    if (depth > 32) throw new Error("observer snapshot is too complex");
    if (typeof item === "string") {
      chargeString(item);
      return item;
    }
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) {
      charge(JSON.stringify(item).length);
      return item;
    }
    if (typeof item !== "object" || item === null) throw new Error("observer snapshot must contain only JSON values");
    charge(2); // Brackets/braces; every child and separator also consumes budget.
    if (Array.isArray(item)) {
      const result: ObserverSnapshot[] = [];
      for (let i = 0; i < item.length; i++) {
        if (i > 0) charge(1);
        result.push(copyProperty(item, String(i), depth + 1));
      }
      return result;
    }
    if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw new Error("observer snapshot must contain only plain JSON objects");
    }
    const result: Record<string, ObserverSnapshot> = Object.create(null);
    let first = true;
    // Do not materialize all values or invoke getters/toJSON on App objects.
    for (const key in item) {
      if (!Object.hasOwn(item, key)) continue;
      charge(first ? 1 : 2); // Colon and, after the first member, comma.
      first = false;
      chargeString(key);
      result[key] = copyProperty(item, key, depth + 1);
    }
    return result;
  };
  return copy(value, 0);
}

/**
 * Runs deterministic App observers without giving them an event emitter.
 * Results are published only when the exact observer generation is still live.
 */
export function createAppObserverRuntime(options: {
  bus: EventBus;
  context(appId: string, appDir: string): ObserverContext;
  now?: () => number;
}): AppObserverRuntime {
  const now = options.now ?? Date.now;
  let closed = false;
  let started = false;
  const cadence = new OwnedTimer("app-observers");
  const initial = new OwnedTimer("app-observers:initial");
  let states = new Map<string, ObserverState>();

  const replace = (entries: readonly Readonly<LoadedAppDefinition>[]): void => {
    const next = new Map<string, ObserverState>();
    const currentTime = now();
    for (const entry of entries) {
      for (const observer of entry.definition.observers ?? []) {
        const key = `${entry.definition.id}/${observer.id}`;
        const fingerprint = observerFingerprint(observer);
        const previous = states.get(key);
        next.set(key, {
          appId: entry.definition.id,
          appDir: entry.appDir,
          observer,
          fingerprint,
          lastSlot:
            previous?.fingerprint === fingerprint
              ? previous.lastSlot
              : Math.floor(currentTime / observer.intervalMs) - 1,
          // An in-flight attempt belongs to the replaced state object. The new
          // generation must be independently runnable while the old result is
          // fenced and discarded.
          running: false,
        });
      }
    }
    states = next;
  };

  const run = async (key: string, state: ObserverState, slot: number): Promise<void> => {
    try {
      const result = await state.observer.run({
        ...options.context(state.appId, state.appDir),
        previousObservation: structuredClone(state.observation),
      });
      if (closed || states.get(key) !== state) return;
      const facts = Array.isArray(result) ? result : result?.events;
      if (!Array.isArray(facts) || facts.some((fact) => !validFact(fact))) {
        throw new Error(
          "observer must return AppEvent[] or { events: AppEvent[], nextObservation }; events must be canonical App events",
        );
      }
      // Validate and detach before publishing any fact. Never retain an
      // App-owned mutable object as the last successfully published state.
      const observation = Array.isArray(result) ? undefined : copySnapshot(result.nextObservation);
      for (const fact of facts) {
        if (closed || states.get(key) !== state) return;
        const published = options.bus.emit({
          ...fact,
          source: fact.source ?? `app:${state.appId}:observer:${state.observer.id}`,
          owner: fact.owner ?? `app:${state.appId}`,
        } as never);
        // emit can also carry transient/non-journaled notifications. Such a
        // result cannot justify suppressing future stateful observations.
        const eventId = published[EVENT_ROW_ID] ?? 0;
        if (!Array.isArray(result) && (!Number.isSafeInteger(eventId) || eventId <= 0)) {
          throw new Error("stateful observer fact has no durable event receipt");
        }
      }
      if (!closed && states.get(key) === state) state.observation = observation;
    } catch (error) {
      if (closed || states.get(key) !== state) return;
      try {
        options.bus.emit({
          type: "app.observer.failed",
          source: "app-host",
          owner: `app:${state.appId}`,
          target: { project: state.appId },
          data: {
            appId: state.appId,
            observerId: state.observer.id,
            error: error instanceof Error ? error.message : String(error),
          },
        } as never);
      } catch (reportError) {
        // Publication may be the failed operation. Do not recursively report
        // through unavailable persistence or leave an unhandled rejection.
        console.error(
          `[app-observer:${state.appId}/${state.observer.id}] failed: ${String(error)}; failure publication: ${String(reportError)}`,
        );
      }
    } finally {
      if (states.get(key) === state) {
        state.lastSlot = slot;
        state.running = false;
      }
    }
  };

  const runtime: AppObserverRuntime = {
    start(intervalMs) {
      if (closed || started) return;
      started = true;
      cadence.every(intervalMs, () => runtime.scanNow());
      initial.after(0, () => runtime.scanNow());
    },
    replace,
    scanNow() {
      if (closed) return;
      const currentTime = now();
      for (const [key, state] of states) {
        const slot = Math.floor(currentTime / state.observer.intervalMs);
        if (state.running || state.lastSlot >= slot) continue;
        state.running = true;
        void run(key, state, slot);
      }
    },
    close() {
      closed = true;
      cadence.close();
      initial.close();
      states.clear();
    },
  };
  return runtime;
}

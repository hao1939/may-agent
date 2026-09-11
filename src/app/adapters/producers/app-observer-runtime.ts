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
  // Bound traversal as well as encoded size. Deep/cyclic objects and huge
  // collections must not monopolize the Host before the byte check runs.
  let nodes = 0;
  const validate = (item: unknown, depth: number): void => {
    if (++nodes > MAX_OBSERVER_SNAPSHOT_BYTES || depth > 32) throw new Error("observer snapshot is too complex");
    if (item === null || typeof item === "boolean" || typeof item === "string") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || item === null) throw new Error("observer snapshot must contain only JSON values");
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    ) {
      throw new Error("observer snapshot must contain only plain JSON objects");
    }
    for (const child of Array.isArray(item) ? item : Object.values(item)) validate(child, depth + 1);
  };
  validate(value, 0);
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") > MAX_OBSERVER_SNAPSHOT_BYTES) {
    throw new Error(`observer snapshot exceeds ${MAX_OBSERVER_SNAPSHOT_BYTES} bytes`);
  }
  return JSON.parse(json) as ObserverSnapshot;
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
        throw new Error("observer must return an array of canonical App events");
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

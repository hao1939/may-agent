import { copyObserverSnapshot } from "./observer-snapshot.js";
import { bindResourceObserver } from "./resource-observer.js";
import type { ReadObservationDemand, ObservationInterestRoute } from "../../core/state/observation-demand.js";
import {
  type AppEvent,
  type AppObserver,
  type ObserverContext,
  type ObserverSnapshot,
  type ObserverHealth,
  type ResourceObserver,
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
  controller: AbortController;
  lastStartedAt?: number;
  lastCompletedAt?: number;
  lastError?: string;
  resource?: ReturnType<typeof bindResourceObserver>;
  source: string;
  factType?: string;
};

export type AppObserverRuntime = {
  start(): void;
  replace(entries: readonly Readonly<LoadedAppDefinition>[]): void;
  scanNow(): void;
  requestCheck(interests: readonly ObservationInterestRoute[]): void;
  close(): void;
  health(appId: string): ObserverHealth[];
};

function observerFingerprint(observer: AppObserver | ResourceObserver): string {
  return "inspect" in observer
    ? `${observer.intervalMs}:${observer.timeoutMs}:${observer.type}:${observer.inspect.toString()}`
    : `${observer.intervalMs}:${observer.run.toString()}`;
}

function validFact(value: unknown): value is AppEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.type === "string" && Boolean(event.type.trim()) && Object.prototype.hasOwnProperty.call(event, "data")
  );
}

/**
 * Runs deterministic App observers without giving them an event emitter.
 * Results are published only when the exact observer generation is still live.
 */
export function createAppObserverRuntime(options: {
  bus: EventBus;
  context(appId: string, appDir: string): ObserverContext;
  now?: () => number;
  readDemand?: ReadObservationDemand;
  needsFact?: (fact: AppEvent) => boolean;
}): AppObserverRuntime {
  const now = options.now ?? Date.now;
  let closed = false;
  let started = false;
  const cadence = new OwnedTimer("app-observers");
  const wake = new OwnedTimer("app-observers:wake");
  let states = new Map<string, ObserverState>();
  // Only unsettled I/O survives replacement; demand and snapshots are recollected.
  const occupiedBySource = new Map<string, Set<string>>();

  const refreshCadence = () => {
    cadence.cancel();
    if (closed || !started || !states.size) return;
    // Preserve minute-level scans for slow sources; shorten the timer for
    // faster observers. Each observer still owns its declared due slots.
    const intervalMs = Math.min(60_000, ...Array.from(states.values(), (state) => state.observer.intervalMs));
    cadence.every(intervalMs, () => runtime.scanNow());
  };

  const replace = (entries: readonly Readonly<LoadedAppDefinition>[]): void => {
    for (const state of states.values()) state.controller.abort(new Error("Observer replaced"));
    for (const [key, occupied] of occupiedBySource) if (!occupied.size) occupiedBySource.delete(key);
    const next = new Map<string, ObserverState>();
    const currentTime = now();
    for (const entry of entries) {
      for (const observer of entry.definition.observers ?? []) {
        const key = `${entry.definition.id}/${observer.id}`;
        const fingerprint = observerFingerprint(observer);
        const previous = states.get(key);
        const controller = new AbortController();
        const occupied = occupiedBySource.get(key) ?? new Set<string>();
        occupiedBySource.set(key, occupied);
        const bound =
          "inspect" in observer
            ? bindResourceObserver({
                appId: entry.definition.id,
                definition: observer,
                signal: controller.signal,
                occupied,
                now,
                readDemand: (...args) => {
                  if (!options.readDemand) throw new Error("Observation demand reader unavailable");
                  return options.readDemand(...args);
                },
                needsFact: (fact) => {
                  if (!options.needsFact) throw new Error("Observation Condition matching unavailable");
                  return options.needsFact(fact);
                },
              })
            : undefined;
        next.set(key, {
          appId: entry.definition.id,
          appDir: entry.appDir,
          observer: bound?.observer ?? (observer as AppObserver),
          controller,
          resource: bound,
          source: `app:${entry.definition.id}:observer:${observer.id}`,
          factType: "inspect" in observer ? observer.type : undefined,
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
    refreshCadence();
  };

  const scheduleCheck = () => {
    if (!closed && started && !wake.armed) wake.after(0, () => runtime.scanNow());
  };
  const run = async (key: string, state: ObserverState, slot: number, requested: boolean): Promise<void> => {
    try {
      const inspect = requested ? state.resource!.takePending() : state.observer.run;
      const result = await inspect.call(state.observer, {
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
      const observation = Array.isArray(result) ? undefined : copyObserverSnapshot(result.nextObservation);
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
      if (!closed && states.get(key) === state) {
        state.observation = observation;
        state.lastError = undefined;
      }
    } catch (error) {
      if (closed || states.get(key) !== state) return;
      state.lastError = String(error instanceof Error ? error.message : error).slice(0, 2000);
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
        if (!requested) state.lastSlot = slot;
        state.running = false;
        state.lastCompletedAt = now();
        if (state.resource?.hasPending()) scheduleCheck();
      }
    }
  };

  const runtime: AppObserverRuntime = {
    health(appId) {
      return [...states.values()]
        .filter((state) => state.appId === appId)
        .map((state) => ({
          id: state.observer.id,
          intervalMs: state.observer.intervalMs,
          available: !closed,
          running: state.running,
          lastStartedAt: state.lastStartedAt,
          lastCompletedAt: state.lastCompletedAt,
          lastError: state.lastError,
          ...(state.resource ? { resources: state.resource.resources() } : {}),
        }));
    },
    start() {
      if (closed || started) return;
      started = true;
      refreshCadence();
      scheduleCheck();
    },
    replace,
    requestCheck(interests) {
      if (closed) return;
      for (const state of states.values()) {
        for (const interest of interests) {
          if (state.source === interest.source && state.factType === interest.type)
            state.resource?.request(interest.subject);
        }
      }
      if ([...states.values()].some((state) => state.resource?.hasPending())) scheduleCheck();
    },
    scanNow() {
      if (closed) return;
      const currentTime = now();
      for (const [key, state] of states) {
        const slot = Math.floor(currentTime / state.observer.intervalMs);
        const periodicDue = state.lastSlot < slot;
        if (state.running || (!periodicDue && !state.resource?.hasPending())) continue;
        state.running = true;
        state.lastStartedAt = currentTime;
        void run(key, state, slot, !periodicDue);
      }
    },
    close() {
      closed = true;
      cadence.close();
      wake.close();
      for (const state of states.values()) state.controller.abort(new Error("Observer runtime closed"));
      states.clear();
    },
  };
  return runtime;
}

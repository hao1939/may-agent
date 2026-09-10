import type { AppEvent, AppObserver, ObserverContext } from "@may-agent/sdk";
import type { LoadedAppDefinition } from "../../core/apps/registry.js";
import type { EventBus } from "../../core/events/bus.js";
import { OwnedTimer } from "../../core/scheduling/timer.js";

type ObserverState = {
  appId: string;
  appDir: string;
  observer: AppObserver;
  fingerprint: string;
  lastSlot: number;
  running: boolean;
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
      const facts = await state.observer.run(options.context(state.appId, state.appDir));
      if (closed || states.get(key) !== state) return;
      if (!Array.isArray(facts) || facts.some((fact) => !validFact(fact))) {
        throw new Error("observer must return an array of canonical App events");
      }
      for (const fact of facts) {
        options.bus.emit({
          ...fact,
          source: fact.source ?? `app:${state.appId}:observer:${state.observer.id}`,
          owner: fact.owner ?? `app:${state.appId}`,
        } as never);
      }
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

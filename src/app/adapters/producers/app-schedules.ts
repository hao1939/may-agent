import type { LoadedAppDefinition } from "../../core/apps/registry.js";
import { EVENT_RECORD_ONLY, type AgentEvent, type EventBus } from "../../core/events/bus.js";
import { OwnedTimer } from "../../core/scheduling/timer.js";

/** Schedule slots publish normal events. They do not own requests or Tasks. */
export function createAppScheduleProducer(options: { bus: EventBus; now?: () => number; enabled?: boolean }) {
  const now = options.now ?? Date.now;
  let loaded: readonly Readonly<LoadedAppDefinition>[] = [];
  let closed = false;
  let started = false;
  const cadence = new OwnedTimer("app-schedules");
  const initial = new OwnedTimer("app-schedules:initial");
  let scheduleActivations = new Map<string, { fingerprint: string; activatedAt: number; lastSlot?: number }>();
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  const refreshScheduleActivations = (): void => {
    const activeKeys = new Set<string>();
    for (const { definition } of loaded) {
      for (const schedule of definition.schedules ?? []) {
        const key = `${definition.id}/${schedule.id}`;
        activeKeys.add(key);
        const fingerprint = JSON.stringify({
          intervalMs: schedule.intervalMs,
          ...(schedule.input
            ? { input: schedule.input, catchUp: schedule.catchUp ?? "latest" }
            : { event: schedule.event }),
          enabled: schedule.enabled !== false,
        });
        if (scheduleActivations.get(key)?.fingerprint !== fingerprint) {
          const activatedAt = now();
          scheduleActivations.set(key, {
            fingerprint,
            activatedAt,
            ...(!schedule.input ? { lastSlot: Math.floor(activatedAt / schedule.intervalMs) } : {}),
          });
        }
      }
    }
    for (const key of scheduleActivations.keys()) {
      if (!activeKeys.has(key)) scheduleActivations.delete(key);
    }
  };
  const publishScheduledEvent = (event: AgentEvent, identity: string): boolean => {
    try {
      options.bus.emit(event);
      return true;
    } catch (error) {
      // Persistence can fail before the fact exists. Keep lastSlot unchanged;
      // the next ordinary scan publishes the latest slot, not a replay queue.
      // Reporting through the same unavailable database could throw again.
      console.error(
        `[app-schedule:${identity}] publication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  };

  const runtime = {
    start(intervalMs: number): void {
      if (closed || started || options.enabled === false) return;
      started = true;
      cadence.every(intervalMs, () => runtime.scanNow());
      initial.after(0, () => runtime.scanNow());
    },
    /** Return an undo operation for the enclosing synchronous publication. */
    replace(entries: readonly Readonly<LoadedAppDefinition>[]): () => void {
      const previousLoaded = loaded;
      const previousActivations = scheduleActivations;
      const restore = () => {
        loaded = previousLoaded;
        scheduleActivations = previousActivations;
      };
      loaded = entries;
      // Unchanged declarations retain accepted slots; changed declarations get
      // new records. Rejection restores the exact prior activation, not now().
      scheduleActivations = new Map(scheduleActivations);
      try {
        refreshScheduleActivations();
      } catch (error) {
        restore();
        throw error;
      }
      return restore;
    },
    scanNow(): void {
      if (closed || options.enabled === false) return;
      const currentTime = now();
      for (const { definition } of loaded) {
        for (const configuredSchedule of definition.schedules ?? []) {
          if (configuredSchedule.enabled === false) continue;
          const activation = scheduleActivations.get(`${definition.id}/${configuredSchedule.id}`);
          if (!activation) continue;
          const slot = Math.floor(currentTime / configuredSchedule.intervalMs);
          if (!configuredSchedule.input) {
            if (activation.lastSlot === undefined || slot <= activation.lastSlot) continue;
            const event = configuredSchedule.event;
            const scheduledFact = {
              ...event,
              source: event.source ?? `app:${definition.id}:schedule:${configuredSchedule.id}`,
              owner: event.owner ?? `app:${definition.id}`,
              data: {
                ...record(event.data),
                idempotencyKey: `schedule:${definition.id}:${configuredSchedule.id}:${slot}`,
              },
            } as AgentEvent;
            // Event schedules publish facts; they do not create a reliable
            // command channel or make a passive observer the delivery owner.
            Object.defineProperty(scheduledFact, EVENT_RECORD_ONLY, { value: true, configurable: true });
            if (publishScheduledEvent(scheduledFact, `${definition.id}/${configuredSchedule.id}`)) {
              activation.lastSlot = slot;
            }
            continue;
          }
          if (activation.lastSlot !== undefined && slot <= activation.lastSlot) continue;
          const slotStartedAt = slot * configuredSchedule.intervalMs;
          if ((configuredSchedule.catchUp ?? "latest") === "none" && slotStartedAt < activation.activatedAt) {
            activation.lastSlot = slot;
            continue;
          }
          const published = publishScheduledEvent(
            {
              type: "app.input.requested",
              source: `app:${definition.id}:schedule:${configuredSchedule.id}`,
              owner: `app:${definition.id}`,
              data: {
                appId: definition.id,
                input: configuredSchedule.input,
                source: { kind: "system", id: `schedule:${definition.id}:${configuredSchedule.id}` },
                idempotencyKey: `schedule:${definition.id}:${configuredSchedule.id}:${slot}`,
              },
            },
            `${definition.id}/${configuredSchedule.id}`,
          );
          if (published) activation.lastSlot = slot;
        }
      }
    },
    close(): void {
      closed = true;
      cadence.close();
      initial.close();
      loaded = [];
      scheduleActivations.clear();
    },
  };
  return runtime;
}

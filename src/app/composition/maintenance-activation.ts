import type { HostMaintenance } from "../adapters/maintenance/runtime.js";
import type { EventBus } from "../event-bus.js";

/** Activate a prepared scheduler generation only after its definitions commit. */
export function activateAgentMaintenance(
  maintenance: ReadonlyMap<string, HostMaintenance>,
  bus: EventBus,
  timersEnabled: boolean,
): void {
  for (const [name, cron] of maintenance) {
    cron.subscribeToBus(bus);
    cron.onFire((entry) => {
      bus.emit({ type: "info", message: `[maintenance] ${entry.name} fired (handler -> ${entry.handler})` });
    });

    if (!timersEnabled) {
      cron.stop(); // Timers stop; declared event routes remain attached.
      continue;
    }
    const entries = cron.getEntries();
    if (entries.length === 0) continue;
    bus.emit({ type: "info", message: `[cron:${name}] Starting ${entries.length} job(s)` });
    cron.start();
  }
}

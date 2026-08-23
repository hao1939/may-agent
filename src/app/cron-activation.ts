import type { CronEntry } from "../lib/cron-tool.js";
import type { Cron } from "./cron.js";
import type { EventBus } from "./event-bus.js";

function handlerLabel(entry: CronEntry): string {
  if (typeof entry.handler === "string") return entry.handler;
  if (!entry.handler) return entry.name;
  return `workflow:${entry.handler.agent ? `${entry.handler.agent}/` : ""}${entry.handler.workflow}`;
}

/** Activate a prepared scheduler generation only after its definitions commit. */
export function activateAgentCrons(crons: ReadonlyMap<string, Cron>, bus: EventBus): void {
  for (const [name, cron] of crons) {
    cron.subscribeToBus(bus);
    cron.rebuildEventSubscriptions();

    const gaps = cron.verifyEventSubscriptions();
    for (const gap of gaps) {
      bus.emit({
        type: "info",
        message: `[cron:${name}] Subscription gap: ${gap.entryName} missing events [${gap.missingEvents.join(", ")}]`,
      });
    }
    if (gaps.length > 0) cron.rebuildEventSubscriptions();

    cron.onFire((entry) => {
      bus.emit({ type: "info", message: `[cron] ${entry.name} fired (handler -> ${handlerLabel(entry)})` });
    });

    const entries = cron.getEntries();
    if (entries.length === 0) continue;
    bus.emit({ type: "info", message: `[cron:${name}] Starting ${entries.length} job(s)` });
    cron.start();
  }
}

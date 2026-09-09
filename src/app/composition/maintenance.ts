import { HostMaintenance } from "../adapters/maintenance/runtime.js";
import type { EventBus } from "../event-bus.js";
import { mayConversationNoticeEvent } from "../app-input-event.js";

/** Prepare only. The committed generation owns activation and retirement. */
export function prepareMaintenance(options: {
  configPath: string;
  persistDir: string;
  agentName: string;
  bus: EventBus;
}): HostMaintenance {
  const source = `maintenance:${options.agentName}`;
  const maintenance = new HostMaintenance({
    configPath: options.configPath,
    persistDir: options.persistDir,
    onError: (message) => options.bus.emit({ type: "info", message: `[${source}] ${message}` }),
    notify: (text) => options.bus.emit(mayConversationNoticeEvent({ source, authorId: source, text })),
    emitEvent: (event) => options.bus.emit(event),
  });
  maintenance.load();
  return maintenance;
}

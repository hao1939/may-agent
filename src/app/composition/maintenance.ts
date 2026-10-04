import { interfaceBinding } from "@may-agent/control";
import { HostMaintenance } from "../adapters/maintenance/runtime.js";
import type { EventBus } from "../core/events/bus.js";
import { conversationNoticeEvent } from "../app-input-event.js";

/** Prepare only. The committed generation owns activation and retirement. */
export function prepareMaintenance(options: {
  configPath: string;
  persistDir: string;
  agentName: string;
  bus: EventBus;
}): HostMaintenance {
  const destination = interfaceBinding();
  const source = `maintenance:${options.agentName}`;
  const maintenance = new HostMaintenance({
    configPath: options.configPath,
    persistDir: options.persistDir,
    onError: (message) => options.bus.emit({ type: "info", message: `[${source}] ${message}` }),
    notify: (text) => {
      if (!destination.appId || !destination.conversationId) throw new Error("Human notification requires CONVERSATION_APP");
      options.bus.emit(conversationNoticeEvent({ appId: destination.appId, conversationId: destination.conversationId, source, authorId: source, text }));
    },
    emitEvent: (event) => options.bus.emit(event),
  });
  maintenance.load();
  return maintenance;
}

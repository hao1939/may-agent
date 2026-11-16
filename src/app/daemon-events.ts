import { eventData, type EventBus } from "./core/events/bus.js";
import type { SubagentManager } from "../lib/manager.js";
import { DbWriter } from "../lib/db-writer.js";
import { setAgentSessionId } from "./agent-loader.js";
import { attachMetricSourceMeasurement, attachMetricEvaluation } from "./metric-source-measurement.js";

export function attachEventPersistence(opts: { bus: EventBus; persistDir: string }): void {
  const dbWriter = new DbWriter(opts.persistDir);
  opts.bus.setPersistenceSubscriber(dbWriter.handler);
  opts.bus.setDeliveryRecorder(dbWriter.recordDelivery);
}

export function attachDaemonEventSubscribers(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  projectRoot: string;
  interfaceAgent?: string;
}): void {
  const { bus, persistDir } = opts;
  attachMetricSourceMeasurement({ bus, persistDir });
  attachMetricEvaluation({ bus, persistDir });

  bus.subscribe(
    (event) => {
      if (event.type !== "session.start") return;
      const info = eventData(event) as any;
      if (info.agent && info.sessionId) setAgentSessionId(info.agent, info.sessionId);
    },
    { label: "agent-session-binding" },
  );
}

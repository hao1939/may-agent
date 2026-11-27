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

export const METRIC_SOURCE_COLLECTION_INTERVAL_MS = 300_000;
export const METRIC_EVALUATION_INTERVAL_MS = 60_000;

export function attachDaemonMetricTimers(opts: {
  bus: EventBus;
  persistDir: string;
  listLoadedApps?: () => ReadonlyArray<{ id: string; owner?: string }>;
  appCollectors?: (metricId: string) => ((signal: AbortSignal, now: number) => Promise<unknown>) | undefined;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
}): { close(): void; idle(): Promise<void> } {
  const collector = attachMetricSourceMeasurement(opts);
  const evaluator = attachMetricEvaluation(opts);
  const schedule = opts.setInterval ?? globalThis.setInterval;
  const cancel = opts.clearInterval ?? globalThis.clearInterval;
  const collectionTimer = schedule(() => collector.request(), METRIC_SOURCE_COLLECTION_INTERVAL_MS);
  const evaluationTimer = schedule(() => evaluator.request(), METRIC_EVALUATION_INTERVAL_MS);
  collectionTimer.unref();
  evaluationTimer.unref();
  return {
    close() {
      cancel(collectionTimer);
      cancel(evaluationTimer);
    },
    async idle() {
      await Promise.all([collector.idle(), evaluator.idle()]);
    },
  };
}

export function attachDaemonEventSubscribers(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  projectRoot: string;
  interfaceAgent?: string;
}): void {
  const { bus } = opts;

  bus.subscribe(
    (event) => {
      if (event.type !== "session.start") return;
      const info = eventData(event) as any;
      if (info.agent && info.sessionId) setAgentSessionId(info.agent, info.sessionId);
    },
    { label: "agent-session-binding" },
  );
}

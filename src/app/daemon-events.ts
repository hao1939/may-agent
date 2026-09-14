import { eventData, type EventBus } from "./core/events/bus.js";
import type { SubagentManager } from "../lib/index.js";
import { DbWriter } from "../lib/db-writer.js";
import {
  createDigestWriter,
  createLastSessionWriter,
} from "../lib/session-subscribers.js";
import { runAgentCleanup, setAgentSessionId } from "./agent-loader.js";
import { getDb } from "../lib/db/connection.js";
import { attachMetricSourceMeasurement } from "./metric-source-measurement.js";

export function attachEventPersistence(opts: { bus: EventBus; persistDir: string }): void {
  const dbWriter = new DbWriter(opts.persistDir);
  opts.bus.setPersistenceSubscriber(dbWriter.handler);
  opts.bus.setDeliveryRecorder(dbWriter.recordDelivery);
}

const RESTART_HANDLER_RECOVERY_BATCH_SIZE = 500;
const RESTART_WORKFLOW_RECOVERY_BATCH_SIZE = 500;

export function closeRestartedHandlerPairs(opts: { bus: EventBus; persistDir: string }): number {
  const db = getDb(opts.persistDir);
  const rows = db
    .prepare(
      `SELECT p.open_event_id, p.correlation_key, p.owner, p.opened_at, e.handler
       FROM event_pair_runs p
       JOIN events e ON e.id = p.open_event_id
       WHERE p.pair_name = 'handler'
         AND p.status IN ('open', 'orphan')
         AND e.event_type = 'handler.started'
       ORDER BY p.opened_at ASC
       LIMIT ?`,
    )
    .all(RESTART_HANDLER_RECOVERY_BATCH_SIZE) as Array<{
    open_event_id?: unknown;
    correlation_key?: unknown;
    owner?: unknown;
    handler?: unknown;
    opened_at?: unknown;
  }>;

  for (const row of rows) {
    const openEventId = Number(row.open_event_id);
    if (!Number.isInteger(openEventId) || openEventId <= 0) continue;
    const owner = typeof row.owner === "string" && row.owner.trim() ? row.owner : "agent:may";
    const correlationKey =
      typeof row.correlation_key === "string" && row.correlation_key.trim()
        ? row.correlation_key
        : typeof row.handler === "string" && row.handler.trim()
          ? row.handler
          : `event:${openEventId}`;
    const handler = typeof row.handler === "string" && row.handler.trim() ? row.handler : correlationKey;
    const ownerAgent = owner.replace(/^agent:/, "") || "may";
    const openedAt = Number(row.opened_at);
    opts.bus.emit({
      type: "handler.failed",
      source: "runtime:restart-recovery",
      owner,
      data: {
        handler,
        handlerRunId: correlationKey,
        agent: ownerAgent,
        error: "Process restarted before the handler completed",
        durationMs: Number.isFinite(openedAt) ? Math.max(0, Date.now() - openedAt) : 0,
      },
    });
  }

  return rows.length;
}

export function closeRestartedWorkflowPairs(opts: { bus: EventBus; persistDir: string }): number {
  const db = getDb(opts.persistDir);
  const rows = db
    .prepare(
      `SELECT p.open_event_id, p.correlation_key, p.owner,
              json_extract(e.data, '$.workflow') AS workflow
       FROM event_pair_runs p
       JOIN events e ON e.id = p.open_event_id
       JOIN workflow_runs w ON w.runId = p.correlation_key
       WHERE p.pair_name = 'workflow'
         AND p.status IN ('open', 'orphan')
         AND e.event_type = 'workflow.started'
         AND w.status = 'interrupted'
         AND w.result_reason = 'Process restarted'
       ORDER BY p.opened_at ASC
       LIMIT ?`,
    )
    .all(RESTART_WORKFLOW_RECOVERY_BATCH_SIZE) as Array<{
    open_event_id?: unknown;
    correlation_key?: unknown;
    owner?: unknown;
    workflow?: unknown;
  }>;

  for (const row of rows) {
    const openEventId = Number(row.open_event_id);
    if (!Number.isInteger(openEventId) || openEventId <= 0) continue;
    const owner = typeof row.owner === "string" && row.owner.trim() ? row.owner : "agent:may";
    const correlationKey =
      typeof row.correlation_key === "string" && row.correlation_key.trim()
        ? row.correlation_key
        : `event:${openEventId}`;
    const workflow = typeof row.workflow === "string" && row.workflow.trim() ? row.workflow : "unknown";
    opts.bus.emit({
      type: "workflow.interrupted",
      source: "runtime:restart-recovery",
      owner,
      data: {
        workflowRunId: correlationKey,
        workflow,
        reason: "runtime-restarted",
      },
    } as any);
  }

  return rows.length;
}

export function attachDaemonEventSubscribers(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  projectRoot: string;
  interfaceAgent?: string;
}): void {
  const { bus, persistDir, projectRoot } = opts;
  attachMetricSourceMeasurement({ bus, persistDir });
  const restartedHandlerPairs = closeRestartedHandlerPairs({ bus, persistDir });
  if (restartedHandlerPairs > 0) {
    bus.emit({
      type: "info",
      message: `[handler-recovery] Closed ${restartedHandlerPairs} stale handler pair(s) after restart`,
    });
  }
  const restartedWorkflowPairs = closeRestartedWorkflowPairs({ bus, persistDir });
  if (restartedWorkflowPairs > 0) {
    bus.emit({
      type: "info",
      message: `[workflow-recovery] Closed ${restartedWorkflowPairs} stale workflow pair(s) after restart`,
    });
  }

  bus.listen(createDigestWriter(persistDir), {
    label: "session-digest",
    types: ["session.start", "session.end"],
  });
  bus.listen(createLastSessionWriter(projectRoot), {
    label: "last-session",
    types: ["session.end"],
  });

  bus.subscribe(
    (event) => {
      if (event.type !== "session.start") return;
      const info = eventData(event) as any;
      if (info.agent && info.sessionId) setAgentSessionId(info.agent, info.sessionId);
    },
    { label: "agent-session-binding" },
  );
  bus.listen(
    (event) => {
      const info = eventData(event) as any;
      if (info.agent) runAgentCleanup(info.agent);
    },
    { label: "agent-session-cleanup", types: ["session.end"] },
  );
}

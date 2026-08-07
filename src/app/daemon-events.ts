import { eventData, type EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import { DbWriter } from "../lib/db-writer.js";
import {
  createAutoResume,
  createDigestWriter,
  createLastSessionWriter,
  createStuckDetector,
} from "../lib/session-subscribers.js";
import { createEscalationLifecycleSubscriber } from "../lib/escalation-lifecycle.js";
import { log } from "../lib/log.js";
import { runAgentCleanup, setAgentSessionId } from "./agent-loader.js";
import { attachCliTaskRunner, markOrphanedCliTasks } from "./cli-task-runner.js";
import { attachHumanResultFollowThrough } from "./human-result-follow-through.js";
import { getDb } from "../lib/db/connection.js";

function createEscalationId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emitRuntimeEscalation(
  bus: EventBus,
  input: {
    source: string;
    sourceAgent: string;
    sourceSessionId: string;
    reason: string;
    requestedAction: string;
    trigger: "circuit_break" | "resume_exhausted";
  },
): void {
  bus.emit({
    type: "escalation.created",
    source: input.source,
    owner: "agent:may",
    urgency: "high",
    data: {
      escalationId: createEscalationId(),
      sourceAgent: input.sourceAgent,
      sourceSessionId: input.sourceSessionId,
      reason: input.reason,
      requestedAction: input.requestedAction,
      severity: "P1",
      evidence: { trigger: input.trigger },
      resume: {
        kind: "session",
        sessionId: input.sourceSessionId,
        checkpointRef: `runtime:${input.trigger}`,
      },
      dedupKey: `runtime:${input.trigger}:${input.sourceSessionId}`,
    },
  } as any);
}

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
      `SELECT p.open_event_id, p.correlation_key, p.owner, e.handler
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
    opts.bus.emit({
      type: "event-pair.orphan-gc.close",
      source: "runtime:restart-recovery",
      owner,
      data: {
        openEventId,
        pairName: "handler",
        correlationKey,
        reason: "runtime-restarted",
        ...(typeof row.handler === "string" && row.handler.trim() ? { handler: row.handler } : {}),
      },
    } as any);
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
    opts.bus.emit({
      type: "event-pair.orphan-gc.close",
      source: "runtime:restart-recovery",
      owner,
      data: {
        openEventId,
        pairName: "workflow",
        correlationKey,
        reason: "runtime-restarted",
        ...(typeof row.workflow === "string" && row.workflow.trim() ? { workflow: row.workflow } : {}),
      },
    } as any);
  }

  return rows.length;
}

/** Apply state changes only after their canonical event has been persisted. */
export function createMetricMutationSubscriber(persistDir: string) {
  return (event: Parameters<EventBus["emit"]>[0]): void => {
    const data = eventData(event) as Record<string, unknown>;
    const db = getDb(persistDir);

    if (event.type === "metric.threshold_changed") {
      const metricId = typeof data.metricId === "string" ? data.metricId : "";
      const threshold = data.to;
      if (!metricId || typeof threshold !== "number" || !Number.isFinite(threshold)) return;
      db.run("UPDATE metrics SET threshold = ?, updated_at = ? WHERE id = ?", [
        threshold,
        event.timestamp ?? Date.now(),
        metricId,
      ]);
      return;
    }

    if (event.type === "metric.alert_resolved") {
      const alertId = Number(data.alertId);
      if (!Number.isInteger(alertId) || alertId <= 0) return;
      db.run("UPDATE metric_alerts SET resolved_at = COALESCE(resolved_at, ?) WHERE id = ?", [
        event.timestamp ?? Date.now(),
        alertId,
      ]);
    }
  };
}

export function attachDaemonEventSubscribers(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  projectRoot: string;
  interfaceAgent?: string;
}): void {
  const { bus, manager, persistDir, projectRoot } = opts;
  const sourceSessionAvailable = (sessionId: string) => manager.activeSessions.has(sessionId);

  attachCliTaskRunner({ bus, persistDir, projectRoot, sourceSessionAvailable });
  attachHumanResultFollowThrough({
    bus,
    manager,
    persistDir,
    interfaceAgent: opts.interfaceAgent,
  });
  bus.subscribe(createMetricMutationSubscriber(persistDir));
  const orphanedCliTasks = markOrphanedCliTasks({ bus, persistDir, sourceSessionAvailable });
  if (orphanedCliTasks > 0) {
    bus.emit({
      type: "info",
      message: `[cli-task-runner] Marked ${orphanedCliTasks} stale CLI task(s) orphaned after restart`,
    });
  }
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

  bus.subscribe(createDigestWriter(persistDir));
  bus.subscribe(createLastSessionWriter(projectRoot));
  bus.subscribe(
    createStuckDetector(
      (sessionId, _reason) => {
        bus.emit({ type: "cancel", sessionId } as any);
      },
    (agent, sessionId, reason) => {
      emitRuntimeEscalation(bus, {
        source: "runtime:circuit-breaker",
        sourceAgent: agent,
        sourceSessionId: sessionId,
        reason,
        requestedAction: `Investigate the root cause for ${agent}: check the session transcript, recent errors, and whether the agent needs guidance or a code fix.`,
        trigger: "circuit_break",
      });
      },
      persistDir,
      () => manager,
    ),
  );
  bus.subscribe(
    createAutoResume(
      (sessionId, agent, attempt) => {
        try {
          manager.resumeSession(
            sessionId,
            `[auto-resume] Session was interrupted after partial progress. Continue from where you left off. (attempt ${attempt + 1})`,
            {
              source: "runtime:auto-resume",
              suppressBenignRaceEvent: true,
            },
          );
          log("info", `[resume] Resumed ${agent} session ${sessionId} (attempt ${attempt + 1})`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log("warn", `[resume] Could not resume ${agent} session ${sessionId}: ${msg}`);
        }
      },
      (agent, _sessionId, reason) => {
      log("warn", `[resume] ${agent} exhausted resume attempts — escalating`);
      emitRuntimeEscalation(bus, {
        source: "runtime:auto-resume",
        sourceAgent: agent,
        sourceSessionId: _sessionId,
        reason,
        requestedAction: `Investigate repeated auto-resume failure for ${agent} and decide whether to resume, requeue, or fix runtime state.`,
        trigger: "resume_exhausted",
      });
      },
      persistDir,
      () => manager,
    ),
  );
  bus.subscribe(createEscalationLifecycleSubscriber({ bus, manager, persistDir }));

  bus.subscribe((event) => {
    if (event.type === "session.start") {
      const info = eventData(event) as any;
      if (info.agent && info.sessionId) setAgentSessionId(info.agent, info.sessionId);
    }
    if (event.type === "session.end") {
      const info = eventData(event) as any;
      if (info.agent) runAgentCleanup(info.agent);
    }
  });

}

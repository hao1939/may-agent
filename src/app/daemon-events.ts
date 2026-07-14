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

function createEscalationId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function firstBlockerReason(finishParams: Record<string, unknown>): string | undefined {
  const blockers = finishParams.blockers;
  if (!Array.isArray(blockers)) return undefined;
  const first = blockers.find((blocker) => blocker && typeof blocker === "object") as Record<string, unknown> | undefined;
  const reason = first?.reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : undefined;
}

function finishSummary(finishParams: Record<string, unknown>): string {
  const summary = finishParams.summary;
  if (typeof summary === "string" && summary.trim()) return summary.trim();
  const blockedOn = firstBlockerReason(finishParams);
  return blockedOn ?? "Session finished blocked";
}

function requestedAction(finishParams: Record<string, unknown>, agent: string): string {
  const nextSteps = finishParams.next_steps;
  if (typeof nextSteps === "string" && nextSteps.trim()) return nextSteps.trim();
  return `Review the blocked ${agent} session and decide the next owner or action.`;
}

export function attachEventPersistence(opts: {
  bus: EventBus;
  persistDir: string;
}): void {
  const dbWriter = new DbWriter(opts.persistDir);
  opts.bus.subscribe(dbWriter.handler, { priority: "first" });
  opts.bus.setDeliveryRecorder(dbWriter.recordDelivery);
}

export function attachDaemonEventSubscribers(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  projectRoot: string;
}): void {
  const { bus, manager, persistDir, projectRoot } = opts;

  attachCliTaskRunner({ bus, persistDir, projectRoot });
  const orphanedCliTasks = markOrphanedCliTasks({ bus, persistDir });
  if (orphanedCliTasks > 0) {
    bus.emit({
      type: "info",
      message: `[cli-task-runner] Marked ${orphanedCliTasks} stale CLI task(s) orphaned after restart`,
    });
  }

  bus.subscribe(createDigestWriter(persistDir));
  bus.subscribe(createLastSessionWriter(projectRoot));
  bus.subscribe(createStuckDetector(
    (sessionId, _reason) => {
      bus.emit({ type: "cancel", sessionId } as any);
    },
    (agent, sessionId, reason) => {
      bus.emit({
        type: "escalation.created",
        source: "runtime:circuit-breaker",
        owner: "agent:may",
        urgency: "high",
        data: {
          escalationId: createEscalationId(),
          sourceAgent: agent,
          sourceSessionId: sessionId,
          reason,
          requestedAction: `Investigate the root cause for ${agent}: check the session transcript, recent errors, and whether the agent needs guidance or a code fix.`,
          severity: "P1",
          evidence: { trigger: "circuit_break" },
        },
      } as any);
    },
    persistDir,
    () => manager,
  ));
  bus.subscribe(createAutoResume(
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
      const escalationId = createEscalationId();
      bus.emit({
        type: "escalation.created",
        source: "runtime:auto-resume",
        owner: "agent:may",
        urgency: "high",
        data: {
          escalationId,
          sourceAgent: agent,
          sourceSessionId: _sessionId,
          reason,
          requestedAction: `Investigate repeated auto-resume failure for ${agent} and decide whether to resume, requeue, or fix runtime state.`,
          severity: "P1",
          evidence: { trigger: "resume_exhausted" },
        },
      } as any);
    },
    persistDir,
    () => manager,
  ));
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

  bus.subscribe((event) => {
    if (event.type !== "session.end") return;
    const info = eventData(event) as any;

    const fp = info.finishParams;
    if (fp && (fp.status === "blocked" || fp.status === "failure")) {
      const status = String(fp.status);
      const blockedOn = firstBlockerReason(fp);
      bus.emit({
        type: "escalation.created",
        source: "runtime:session-finish",
        owner: "agent:may",
        urgency: status === "failure" ? "high" : "normal",
        data: {
          escalationId: createEscalationId(),
          sourceAgent: info.agent,
          sourceSessionId: info.sessionId,
          reason: finishSummary(fp),
          requestedAction: requestedAction(fp, info.agent),
          severity: status === "failure" ? "P1" : "P2",
          ...(blockedOn ? { blockedOn } : {}),
          evidence: { finishParams: fp },
        },
      } as any);
    }

  });

}

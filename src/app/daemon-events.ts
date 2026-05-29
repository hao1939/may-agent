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
}

export function attachDaemonEventSubscribers(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  projectRoot: string;
}): void {
  const { bus, manager, persistDir, projectRoot } = opts;

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
          { source: "runtime:auto-resume" },
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

    if (info.agent !== "evaluator" && info.agent !== "judge") {
      bus.emit({
        type: "session.completed",
        source: "runtime",
        owner: `agent:${info.agent}`,
        data: {
          sessionId: info.sessionId,
          agent: info.agent,
          parentSessionId: info.parentSessionId,
          outcome: info.outcome,
          status: info.status,
          source: typeof event.source === "string" ? event.source : undefined,
          kind: info.kind,
          error: typeof info.error === "string" ? info.error : undefined,
          task: typeof info.task === "string" ? info.task : undefined,
        },
      } as any);
    }
  });

  // ── Structural Receipt Persistence ──────────────────────────────────
  // When finish(success) is accepted, persist a session.receipt event so
  // evaluator audits can find it without parsing assistant prose.
  bus.subscribe((event) => {
    if (event.type !== "session.end") return;
    const info = eventData(event) as any;
    const fp = info.finishParams;
    if (!fp || fp.status !== "success") return;

    // Build evidence array from verification_evidence + deliverables
    const evidence: Array<{ kind: string; ref: string; note: string }> = [];
    if (Array.isArray(fp.verification_evidence)) {
      for (const ev of fp.verification_evidence) {
        if (typeof ev === "string" && ev.trim()) {
          evidence.push({ kind: "command", ref: ev.trim(), note: "verification evidence from finish()" });
        }
      }
    }
    if (Array.isArray(fp.deliverables)) {
      for (const d of fp.deliverables) {
        if (d && typeof d.path === "string") {
          evidence.push({ kind: "file", ref: d.path, note: d.description ?? "deliverable" });
        }
      }
    }
    if (Array.isArray(fp.completed_items)) {
      for (const item of fp.completed_items) {
        if (typeof item === "string" && item.trim()) {
          evidence.push({ kind: "task", ref: item.trim(), note: "completed item" });
        }
      }
    }

    bus.emit({
      type: "session.receipt",
      source: "runtime:finish",
      owner: `agent:${info.agent}`,
      timestamp: Date.now(),
      data: {
        type: "session.receipt",
        sessionId: info.sessionId,
        owner: info.agent,
        status: "success",
        summary: fp.summary ?? "",
        evidence,
        createdAt: new Date().toISOString(),
      },
    } as any);
  });
}

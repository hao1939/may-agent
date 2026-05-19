import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import { DbWriter } from "../lib/db-writer.js";
import {
  createAutoResume,
  createDigestWriter,
  createLastSessionWriter,
  createStuckDetector,
} from "../lib/session-subscribers.js";
import { log } from "../lib/log.js";
import { runAgentCleanup, setAgentSessionId } from "./agent-loader.js";

function createEscalationId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
        type: "message.created",
        source: "system:circuit-breaker",
        owner: "agent:may",
        urgency: "high",
        data: {
          from: "system:circuit-breaker",
          to: "may",
          content: `[circuit-breaker] Agent "${agent}" terminated (session ${sessionId}): ${reason}. Investigate the root cause — check the session transcript, recent errors, and whether the agent needs guidance or a code fix.`,
          intent: "investigate",
          priority: "P1",
        },
      } as any);
    },
    persistDir,
    () => manager,
  ));
  bus.subscribe(createAutoResume(
    (sessionId, agent, _attempt) => {
      const ok = manager.resumeInterrupted(sessionId);
      if (ok) {
        log("info", `[resume] Resumed ${agent} session ${sessionId}`);
      } else {
        log("warn", `[resume] Failed to resume ${sessionId}`);
      }
    },
    (agent, _sessionId, reason) => {
      log("warn", `[resume] ${agent} exhausted resume attempts — escalating`);
      const escalationId = createEscalationId();
      try {
        const escalationPath = resolve(persistDir, "escalations.jsonl");
        appendFileSync(escalationPath, JSON.stringify({
          ts: new Date().toISOString(),
          escalationId,
          agent,
          owner: "agent:may",
          reason,
        }) + "\n", "utf-8");
      } catch {
        /* best-effort */
      }
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

  bus.subscribe((event) => {
    if (event.type === "session.start" && "agent" in event && "sessionId" in event) {
      setAgentSessionId(event.agent as string, event.sessionId as string);
    }
    if (event.type === "session.end" && "agent" in event) {
      runAgentCleanup(event.agent as string);
    }
  });

  bus.subscribe((event) => {
    if (event.type !== "session.end") return;
    const info = event as any;

    if (info.error && info.status === "error") {
      bus.emit({
        type: "session.failed",
        source: "runtime",
        owner: `agent:${info.agent}`,
        data: {
          sessionId: info.sessionId,
          agent: info.agent,
          error: info.error,
          task: info.task,
        },
      } as any);
    }

    const fp = info.finishParams;
    if (fp && (fp.status === "blocked" || fp.status === "failure")) {
      bus.emit({
        type: "session.escalated",
        source: "runtime",
        owner: `agent:${info.agent}`,
        data: {
          sessionId: info.sessionId,
          agent: info.agent,
          finishParams: fp,
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
          source: info.source,
          kind: info.kind,
        },
      } as any);
    }
  });
}

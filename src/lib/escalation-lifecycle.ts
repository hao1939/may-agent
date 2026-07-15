import { childEventTrace, eventData, type AgentEvent, type EventBus, type EventTrace, type Subscriber } from "../app/event-bus.js";
import { getDb } from "./requests.js";

type ResumeManager = {
  hasActiveSession?: (sessionId: string) => boolean;
  send?: (sessionId: string, text: string, opts?: { trace?: EventTrace }) => void;
  resumeSession?: (sessionId: string, message: string, opts?: { source?: string; trace?: EventTrace }) => string;
};

type EscalationCreated = {
  rowId: number;
  source: string | null;
  owner: string | null;
  data: Record<string, unknown>;
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseData(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function findEscalationCreated(persistDir: string, escalationId: string): EscalationCreated | null {
  const db = getDb(persistDir);
  const row = db.prepare(`
    SELECT id, source, owner, data
    FROM events
    WHERE event_type = 'escalation.created'
      AND json_extract(data, '$.escalationId') = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(escalationId) as { id: number; source: string | null; owner: string | null; data: string | null } | undefined;
  if (!row) return null;
  return { rowId: row.id, source: row.source, owner: row.owner, data: parseData(row.data) };
}

function findEscalationCreatedByEventId(persistDir: string, eventId: number): EscalationCreated | null {
  if (!Number.isInteger(eventId) || eventId <= 0) return null;
  const row = getDb(persistDir)
    .prepare(
      `SELECT id, source, owner, data
       FROM events
       WHERE id = ? AND event_type = 'escalation.created'`,
    )
    .get(eventId) as { id: number; source: string | null; owner: string | null; data: string | null } | undefined;
  if (!row) return null;
  return { rowId: row.id, source: row.source, owner: row.owner, data: parseData(row.data) };
}

function terminalOutcome(event: AgentEvent): string | null {
  if (event.type === "escalation.dismissed") return "dismissed";
  if (event.type !== "escalation.resolved") return null;
  return nonEmptyString(eventData(event).outcome) ?? null;
}

function shouldResume(outcome: string): boolean {
  return !["needs_human", "dismissed", "superseded"].includes(outcome);
}

function sourceSessionId(escalation: EscalationCreated): string | undefined {
  const data = escalation.data;
  const resume = data.resume && typeof data.resume === "object" && !Array.isArray(data.resume)
    ? data.resume as Record<string, unknown>
    : {};
  if (resume.kind === "session") {
    return nonEmptyString(resume.sessionId) ?? nonEmptyString(data.sourceSessionId);
  }
  return nonEmptyString(data.sourceSessionId);
}

function workflowRunIdContext(escalation: EscalationCreated): string | undefined {
  const data = escalation.data;
  const resume = data.resume && typeof data.resume === "object" && !Array.isArray(data.resume)
    ? data.resume as Record<string, unknown>
    : {};
  if (resume.kind === "workflow") {
    return nonEmptyString(resume.workflowRunId) ?? nonEmptyString(data.workflowRunId);
  }
  return nonEmptyString(data.workflowRunId);
}

function resumeInstruction(event: AgentEvent, outcome: string, sourceEscalationId: string, workflowRunId?: string): string {
  const data = eventData(event);
  const lines = [
    `Escalation ${sourceEscalationId} resolved.`,
    `Outcome: ${outcome}.`,
  ];
  if (workflowRunId) lines.push(`Workflow run: ${workflowRunId}`);
  const summary = nonEmptyString(data.summary) ?? nonEmptyString(data.reason);
  if (summary) lines.push(`Summary: ${summary}`);
  const instruction = nonEmptyString(data.resumeInstruction);
  if (instruction) lines.push(`Instruction: ${instruction}`);
  if (data.evidence && typeof data.evidence === "object") {
    lines.push(`Evidence: ${JSON.stringify(data.evidence)}`);
  }
  return lines.join("\n");
}

function emitResumeAttempted(bus: EventBus, owner: string, data: Record<string, unknown>): void {
  bus.emit({
    type: "escalation.resume_attempted",
    source: "escalation-lifecycle",
    owner,
    data,
  } as AgentEvent);
}

function emitResumeStarted(bus: EventBus, owner: string, data: Record<string, unknown>): void {
  bus.emit({
    type: "escalation.resume_started",
    source: "escalation-lifecycle",
    owner,
    data,
  } as AgentEvent);
}

function emitResumeFailed(bus: EventBus, owner: string, data: Record<string, unknown>): void {
  bus.emit({
    type: "escalation.resume_failed",
    source: "escalation-lifecycle",
    owner,
    data,
  } as AgentEvent);
}

function sourceOwner(escalation: EscalationCreated, fallback: string): string {
  const agent = nonEmptyString(escalation.data.sourceAgent);
  if (!agent) return fallback;
  return agent.includes(":") ? agent : `agent:${agent}`;
}

function projectIdOrWorkflowKind(escalation: EscalationCreated): "project" | "workflow" | "unknown" {
  if (nonEmptyString(escalation.data.projectId) ?? nonEmptyString(escalation.data.project)) return "project";
  if (workflowRunIdContext(escalation)) return "workflow";
  return "unknown";
}

function wakeSourceOwner(
  bus: EventBus,
  escalation: EscalationCreated,
  owner: string,
  baseData: Record<string, unknown>,
  resumeText: string,
): { sourceKind: "project" | "workflow"; sourceRef: string } | null {
  const projectId = nonEmptyString(escalation.data.projectId) ?? nonEmptyString(escalation.data.project);
  if (projectId) {
    bus.emit({
      type: "project.owner.requested",
      source: "escalation-lifecycle",
      owner: sourceOwner(escalation, owner),
      data: {
        projectId,
        project: projectId,
        reason: "escalation-resolved",
        resumeInstruction: resumeText,
        ...baseData,
      },
    } as AgentEvent);
    return { sourceKind: "project", sourceRef: projectId };
  }

  const workflowRunId = workflowRunIdContext(escalation);
  if (workflowRunId) {
    bus.emit({
      type: "workflow.owner.requested",
      source: "escalation-lifecycle",
      owner: sourceOwner(escalation, owner),
      data: {
        workflowRunId,
        reason: "escalation-resolved",
        resumeInstruction: resumeText,
        ...baseData,
      },
    } as AgentEvent);
    return { sourceKind: "workflow", sourceRef: workflowRunId };
  }
  return null;
}

export function createEscalationLifecycleSubscriber(opts: {
  bus: EventBus;
  manager: ResumeManager;
  persistDir: string;
}): Subscriber {
  return (event) => {
    const outcome = terminalOutcome(event);
    if (!outcome || !shouldResume(outcome)) return;

    const resolvedData = eventData(event);
    const resolvedEscalationId = nonEmptyString(resolvedData.escalationId);
    const openEventId = Number(resolvedData.openEventId ?? resolvedData.open_event_id);
    const owner = nonEmptyString((event as Record<string, unknown>).owner) ?? "agent:may";
    if ((!Number.isInteger(openEventId) || openEventId <= 0) && !resolvedEscalationId) {
      emitResumeFailed(opts.bus, owner, {
        reason: "escalation resolution missing canonical openEventId and compatibility escalationId",
        category: "invalid_resolution",
        recoverable: false,
      });
      return;
    }

    const resolvedCreated =
      findEscalationCreatedByEventId(opts.persistDir, openEventId) ??
      (resolvedEscalationId ? findEscalationCreated(opts.persistDir, resolvedEscalationId) : null);
    if (!resolvedCreated) {
      emitResumeFailed(opts.bus, owner, {
        escalationId: resolvedEscalationId,
        openEventId: Number.isInteger(openEventId) ? openEventId : undefined,
        reason: `escalation.created not found for ${Number.isInteger(openEventId) ? `event ${openEventId}` : resolvedEscalationId}`,
        category: "not_found",
        recoverable: false,
      });
      return;
    }

    const parentEscalationId = nonEmptyString(resolvedCreated.data.parentEscalationId);
    const sourceCreated = parentEscalationId
      ? findEscalationCreated(opts.persistDir, parentEscalationId)
      : resolvedCreated;
    if (!sourceCreated) {
      emitResumeFailed(opts.bus, owner, {
        escalationId: parentEscalationId,
        resolvedEscalationId,
        reason: `parent escalation.created not found for ${parentEscalationId}`,
        category: "not_found",
        recoverable: false,
      });
      return;
    }

    const sourceEscalationId = nonEmptyString(sourceCreated.data.escalationId) ?? resolvedEscalationId ?? `event:${sourceCreated.rowId}`;
    const sessionId = sourceSessionId(sourceCreated);
    const workflowRunId = workflowRunIdContext(sourceCreated);
    const baseData = {
      escalationId: sourceEscalationId,
      ...(sourceEscalationId !== resolvedEscalationId ? { resolvedEscalationId } : {}),
      ...(parentEscalationId ? { parentEscalationId } : {}),
      ...(workflowRunId ? { workflowRunId } : {}),
      outcome,
    };
    const resumeText = resumeInstruction(event, outcome, sourceEscalationId, workflowRunId);

    if (!sessionId) {
      const attemptedData = {
        ...baseData,
        sourceKind: projectIdOrWorkflowKind(sourceCreated),
        resumeInstruction: resumeText,
      };
      emitResumeAttempted(opts.bus, owner, attemptedData);
      const wake = wakeSourceOwner(opts.bus, sourceCreated, owner, baseData, resumeText);
      if (wake) {
        emitResumeStarted(opts.bus, owner, {
          ...baseData,
          ...wake,
          summary: nonEmptyString(resolvedData.summary) ?? "source owner woken after escalation resolution",
        });
      } else {
        emitResumeFailed(opts.bus, owner, {
          ...baseData,
          sourceKind: "unknown",
          reason: "escalation has no source session, project, or workflow follow-up target",
          category: "missing_resume_target",
          recoverable: false,
        });
      }
      return;
    }

    const isActiveSession = opts.manager.hasActiveSession?.(sessionId) ?? false;

    const attemptData = {
      ...baseData,
      sourceKind: "session",
      sourceRef: sessionId,
      sourceSessionId: sessionId,
      resumeInstruction: resumeText,
    };
    emitResumeAttempted(opts.bus, owner, attemptData);

    try {
      if (isActiveSession) {
        if (!opts.manager.send) throw new Error("manager cannot send to active sessions");
        opts.manager.send(sessionId, resumeText, { trace: childEventTrace(event) });
      } else {
        if (!opts.manager.resumeSession) throw new Error("manager cannot resume sessions");
        opts.manager.resumeSession(sessionId, resumeText, {
          source: "escalation-resolution",
          trace: childEventTrace(event),
        });
      }
      emitResumeStarted(opts.bus, owner, {
        ...baseData,
        sourceKind: "session",
        sourceRef: sessionId,
        sourceSessionId: sessionId,
        resumedSessionId: sessionId,
        summary: nonEmptyString(resolvedData.summary) ?? nonEmptyString(resolvedData.reason) ?? "escalation resolved",
      });
    } catch (err) {
      emitResumeFailed(opts.bus, owner, {
        ...baseData,
        sourceKind: "session",
        sourceRef: sessionId,
        sourceSessionId: sessionId,
        reason: err instanceof Error ? err.message : String(err),
        category: "resume_failed",
        recoverable: true,
      });
    }
  };
}

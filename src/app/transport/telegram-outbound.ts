import type { EventBus } from "../event-bus.js";
import { extractProjectPath, normalizeProjectPath } from "./telegram-reply-router.js";

export interface TelegramOutboundContext {
  eventType?: string;
  agent?: string;
  sessionId?: string;
  projectId?: string;
  summary?: string;
  data?: Record<string, unknown>;
  replyToMessageId?: number;
}

export interface TelegramOutboundOptions {
  bus: EventBus;
  interfaceAgent: string;
  projectRoot: string;
  pendingChatId: string | null;
  getSessionId: () => string;
  sendToUser: (text: string, context?: TelegramOutboundContext) => void;
}

export interface TelegramOutbound {
  close: () => void;
  getRootChatSessionId: () => string | null;
  sendAlert: (text: string) => void;
}

function messageData(event: any): Record<string, unknown> {
  return event && typeof event.data === "object" && event.data !== null && !Array.isArray(event.data)
    ? event.data
    : event;
}

function sessionData(event: any): Record<string, unknown> {
  return messageData(event);
}

function isHumanTarget(target: unknown): boolean {
  if (typeof target !== "string") return false;
  const normalized = target.trim().toLowerCase();
  return normalized === "human" || normalized === "human:operator";
}

function approvalConversationContext(message: Record<string, unknown>): Record<string, unknown> {
  const approval =
    message.approval && typeof message.approval === "object" && !Array.isArray(message.approval)
      ? (message.approval as Record<string, unknown>)
      : null;
  const approvalId = typeof message.approvalId === "string" ? message.approvalId : typeof approval?.approvalId === "string" ? approval.approvalId : undefined;
  const waitId = typeof message.waitId === "string" ? message.waitId : typeof approval?.waitId === "string" ? approval.waitId : undefined;
  const pathId = typeof message.pathId === "string" ? message.pathId : typeof approval?.pathId === "string" ? approval.pathId : undefined;
  const packetPath = typeof message.packetPath === "string" ? message.packetPath : typeof approval?.packetPath === "string" ? approval.packetPath : undefined;
  const taskId =
    typeof message.taskId === "string"
      ? message.taskId
      : typeof approval?.taskId === "string"
        ? approval.taskId
        : undefined;
  const taskGeneration =
    typeof message.taskGeneration === "number"
      ? message.taskGeneration
      : typeof approval?.taskGeneration === "number"
        ? approval.taskGeneration
        : undefined;
  const artifactFingerprint =
    typeof message.artifactFingerprint === "string"
      ? message.artifactFingerprint
      : typeof approval?.artifactFingerprint === "string"
        ? approval.artifactFingerprint
        : undefined;
  const requestedAction = typeof message.requestedAction === "string" ? message.requestedAction : undefined;
  const reason = typeof message.reason === "string" ? message.reason : undefined;
  const expectedResponse =
    message.expectedResponse && typeof message.expectedResponse === "object" && !Array.isArray(message.expectedResponse)
      ? (message.expectedResponse as Record<string, unknown>)
      : approval?.directEvent && typeof approval.directEvent === "object" && !Array.isArray(approval.directEvent)
        ? (approval.directEvent as Record<string, unknown>)
        : undefined;
  const approvalKind = typeof approval?.kind === "string" ? approval.kind : undefined;

  if (!approvalId && !waitId && !pathId && !packetPath && !expectedResponse) {
    return {};
  }

  return {
    conversationId: approvalId ? `approval:${approvalId}` : waitId ? `approval-wait:${waitId}` : undefined,
    originalIssue: {
      eventType: "project.approval.requested",
      approvalKind,
      approvalId,
      waitId,
      pathId,
      packetPath,
      taskId,
      taskGeneration,
      artifactFingerprint,
      requestedAction,
      reason,
      expectedResponse,
    },
    expectedClosure:
      typeof expectedResponse?.type === "string" ? [expectedResponse.type] : undefined,
  };
}

export function attachTelegramOutbound(opts: TelegramOutboundOptions): TelegramOutbound {
  const { bus, getSessionId, pendingChatId, sendToUser } = opts;

  let rootChatSessionId: string | null = null;
  let pendingTelegramReplyToMessageId: number | undefined;
  const watchedSessions = new Set<string>();
  const replyToMessageIdBySession = new Map<string, number>();
  const outboundBySession = new Map<string, { pendingText: string; sentAnyText: boolean; sentText: string }>();

  const unsubBus = bus.subscribe((event: any) => {
    const session = sessionData(event);
    const sessionId = typeof session.sessionId === "string" ? session.sessionId : undefined;

    if (event.type === "chat.start.requested" && event.source === "telegram") {
      const data = messageData(event);
      const replyToMessageId = numberOrUndefined(data.channelMessageId);
      if (replyToMessageId) pendingTelegramReplyToMessageId = replyToMessageId;
      bindCurrentChatSession(replyToMessageId);
    }

    if (event.type === "session.start" && sessionId && isRootChatSession(event)) {
      rootChatSessionId = sessionId;
      watchedSessions.add(sessionId);
      outboundBySession.set(sessionId, { pendingText: "", sentAnyText: false, sentText: "" });
      if (pendingTelegramReplyToMessageId) {
        replyToMessageIdBySession.set(sessionId, pendingTelegramReplyToMessageId);
        pendingTelegramReplyToMessageId = undefined;
      }
    }

    if (
      event.type === "session.start" &&
      session.parentSessionId &&
      watchedSessions.has(String(session.parentSessionId)) &&
      sessionId
    ) {
      watchedSessions.add(sessionId);
      const parentReplyToMessageId = replyToMessageIdBySession.get(String(session.parentSessionId));
      if (parentReplyToMessageId) replyToMessageIdBySession.set(sessionId, parentReplyToMessageId);
    }

    if (sessionId && !watchedSessions.has(sessionId)) {
      return;
    }

    const rootSid = rootChatSessionId;

    if (event.type === "text" && "sessionId" in event && event.sessionId === rootSid) {
      const state = sessionState(event.sessionId);
      state.pendingText += event.text;
      flushPendingText(event.sessionId);
    }

    if (event.type === "turn_end" && "sessionId" in event && event.sessionId === rootSid) {
      const state = sessionState(event.sessionId);
      const hadText = state.pendingText.trim().length > 0 || state.sentAnyText;
      flushPendingText(event.sessionId);

      if (!hadText && event.errorCount && event.errorCount > 0) {
        bus.emit({
          type: "info",
          message: `[telegram] Turn error: ${event.errorCount} error(s), no text produced (session: ${event.sessionId})`,
        });
      }
    }

    if (event.type === "session.end" && sessionId && sessionId !== rootSid) {
      if (pendingChatId) {
        const fp = session.finishParams as Record<string, unknown> | undefined;
        const summary =
          (fp?.summary as string) ??
          (typeof session.outcome === "string" ? session.outcome.slice(0, 200) : "completed");
        const fpStatus = (fp?.status as string) ?? session.status;
        if (fpStatus === "failure" || fpStatus === "blocked") {
          sendToUser(`❌ ${String(session.agent)} BLOCKED: ${summary}`, {
            eventType: "blocked",
            agent: String(session.agent),
            sessionId,
            summary,
            replyToMessageId: replyToMessageIdBySession.get(sessionId),
          });
        } else {
          sendToUser(`✅ ${String(session.agent)}: ${summary}`, {
            eventType: "session.end",
            agent: String(session.agent),
            sessionId,
            summary,
            replyToMessageId: replyToMessageIdBySession.get(sessionId),
          });
        }
      }
      watchedSessions.delete(sessionId);
      replyToMessageIdBySession.delete(sessionId);
      outboundBySession.delete(sessionId);
    }

    if (
      (event.type === "session.end" || event.type === "session.idle") &&
      sessionId &&
      sessionId === rootSid &&
      pendingChatId
    ) {
      const state = sessionState(sessionId);
      flushPendingText(sessionId);
      if (session.error) {
        const errMsg =
          String(session.error).length > 200 ? String(session.error).slice(0, 200) + "…" : String(session.error);
        sendToUser(`❌ Couldn't process your message: ${errMsg}`, {
          eventType: "error",
          agent: String(session.agent),
          sessionId,
          summary: errMsg,
          replyToMessageId: replyToMessageIdBySession.get(sessionId),
        });
      } else {
        const summary = String(session.summary ?? "").trim();
        if (summary && shouldSendSummary(sessionId, summary)) {
          sendToUser(summary, {
            eventType: event.type,
            agent: String(session.agent),
            sessionId,
            summary,
            replyToMessageId: replyToMessageIdBySession.get(sessionId),
          });
          state.sentAnyText = true;
          state.sentText += "\n" + summary;
        } else if (!state.sentAnyText) {
          sendToUser("❌ Couldn't generate a response. Try again or rephrase.", {
            eventType: "error",
            agent: String(session.agent),
            sessionId,
            replyToMessageId: replyToMessageIdBySession.get(sessionId),
          });
        }
      }
      if (event.type === "session.end" || event.type === "session.idle") {
        rootChatSessionId = null;
        watchedSessions.delete(sessionId);
        replyToMessageIdBySession.delete(sessionId);
        outboundBySession.delete(sessionId);
      }
    }

    if (event.type === "message.created") {
      const message = messageData(event);
      if (!isHumanTarget(message.to)) return;
      if (pendingChatId) {
        const content = String(message.content ?? "").slice(0, 4000);
        const projectId =
          normalizeProjectPath(message.projectPath ?? message.projectId, opts.projectRoot) ??
          extractProjectPath(content, opts.projectRoot) ??
          undefined;
        const data: Record<string, unknown> = {};
        for (const key of [
          "subject",
          "kind",
          "severity",
          "dedupKey",
          "approval",
          "approvalId",
          "waitId",
          "pathId",
          "packetPath",
          "taskId",
          "taskGeneration",
          "artifactFingerprint",
          "reportPath",
          "targetProject",
          "verdict",
          "requestedHumanAction",
          "requestedAction",
          "reason",
          "message",
          "expectedResponse",
          "projectPath",
          "projectId",
          "escalationId",
          "sourceAgent",
          "blockedOn",
          "evidence",
          "resume",
          "conversationId",
          "conversation",
          "originalIssue",
          "lastHandledBy",
          "expectedClosure",
          "actionHints",
        ]) {
          if (message[key] !== undefined) data[key] = message[key];
        }
        const approvalContext = approvalConversationContext(message);
        if (approvalContext.conversationId !== undefined && data.conversationId === undefined) {
          data.conversationId = approvalContext.conversationId;
        }
        if (approvalContext.originalIssue !== undefined && data.originalIssue === undefined) {
          data.originalIssue = approvalContext.originalIssue;
        }
        if (approvalContext.expectedClosure !== undefined && data.expectedClosure === undefined) {
          data.expectedClosure = approvalContext.expectedClosure;
        }
        sendToUser(`📋 ${content}`, {
          eventType: "message.created",
          agent: String(message.from ?? ""),
          sessionId: "sessionId" in message ? String(message.sessionId) : undefined,
          projectId,
          summary: content.slice(0, 200),
          data,
        });
      }
    }
  });

  function sessionState(sessionId: string): { pendingText: string; sentAnyText: boolean; sentText: string } {
    let state = outboundBySession.get(sessionId);
    if (!state) {
      state = { pendingText: "", sentAnyText: false, sentText: "" };
      outboundBySession.set(sessionId, state);
    }
    return state;
  }

  function flushPendingText(sessionId: string): void {
    const state = sessionState(sessionId);
    const text = state.pendingText.trim();
    state.pendingText = "";

    if (!text || !pendingChatId) return;

    state.sentAnyText = true;
    state.sentText += "\n" + text;
    sendToUser(text, {
      eventType: "response",
      agent: opts.interfaceAgent,
      sessionId,
      replyToMessageId: replyToMessageIdBySession.get(sessionId),
    });
  }

  function bindCurrentChatSession(replyToMessageId?: number): string | null {
    const sessionId = getSessionId();
    if (!sessionId) return null;
    rootChatSessionId = sessionId;
    watchedSessions.add(sessionId);
    sessionState(sessionId);
    const effectiveReplyToMessageId = replyToMessageId ?? pendingTelegramReplyToMessageId;
    if (effectiveReplyToMessageId) {
      replyToMessageIdBySession.set(sessionId, effectiveReplyToMessageId);
      pendingTelegramReplyToMessageId = undefined;
    }
    return sessionId;
  }

  function shouldSendSummary(sessionId: string, summary: string): boolean {
    const sent = normalizeForCompare(sessionState(sessionId).sentText);
    const candidate = normalizeForCompare(summary);
    if (!candidate) return false;
    if (!sent) return true;
    return !sent.includes(candidate) && !candidate.includes(sent);
  }

  function isRootChatSession(event: any): boolean {
    const session = sessionData(event);
    if (session.parentSessionId) return false;
    if (session.agent !== opts.interfaceAgent) return false;
    if (session.kind && session.kind !== "chat") return false;
    // A daemon chat session can be reused by Telegram, CLI, Web, and tests.
    // Route a turn to Telegram only when Telegram started that turn. Treating
    // the daemon's current chat session as Telegram-owned leaks CLI/Gym smoke
    // results into the human inbox and keeps leaking on every later idle turn.
    return event.source === "telegram";
  }

  return {
    close: unsubBus,
    getRootChatSessionId: () => rootChatSessionId,
    sendAlert: (text: string) => {
      sendToUser(text, { eventType: "alert" });
    },
  };
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

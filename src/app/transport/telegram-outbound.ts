import { EVENT_ROW_ID, type EventBus, type EventTrace } from "../event-bus.js";
import type { HumanAttentionCandidate, HumanAttentionReview } from "./human-attention-review.js";
import { extractProjectPath, normalizeProjectPath } from "./telegram-reply-router.js";

export interface TelegramOutboundContext {
  eventType?: string;
  agent?: string;
  sessionId?: string;
  projectId?: string;
  summary?: string;
  data?: Record<string, unknown>;
  replyToMessageId?: number;
  conversationId?: string;
  traceId?: string;
  parentEventId?: number;
  taskId?: string;
}

export interface TelegramOutboundOptions {
  bus: EventBus;
  interfaceAgent: string;
  projectRoot: string;
  pendingChatId: string | null;
  getSessionId: () => string;
  sendToUser: (text: string, context?: TelegramOutboundContext) => void;
  reviewProactive?: (candidate: HumanAttentionCandidate) => Promise<HumanAttentionReview>;
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
  const approvalId =
    typeof message.approvalId === "string"
      ? message.approvalId
      : typeof approval?.approvalId === "string"
        ? approval.approvalId
        : undefined;
  const waitId =
    typeof message.waitId === "string"
      ? message.waitId
      : typeof approval?.waitId === "string"
        ? approval.waitId
        : undefined;
  const pathId =
    typeof message.pathId === "string"
      ? message.pathId
      : typeof approval?.pathId === "string"
        ? approval.pathId
        : undefined;
  const packetPath =
    typeof message.packetPath === "string"
      ? message.packetPath
      : typeof approval?.packetPath === "string"
        ? approval.packetPath
        : undefined;
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
    expectedClosure: typeof expectedResponse?.type === "string" ? [expectedResponse.type] : undefined,
  };
}

export function attachTelegramOutbound(opts: TelegramOutboundOptions): TelegramOutbound {
  const { bus, getSessionId, pendingChatId, sendToUser } = opts;

  const rootChatSessions = new Set<string>();
  let latestRootChatSessionId: string | null = null;
  let pendingTelegramReplyToMessageId: number | undefined;
  let pendingTelegramConversationId: string | undefined;
  const watchedSessions = new Set<string>();
  const replyToMessageIdBySession = new Map<string, number>();
  const conversationIdBySession = new Map<string, string>();
  const traceBySession = new Map<string, EventTrace>();
  const outboundBySession = new Map<string, { pendingText: string; sentAnyText: boolean; sentText: string }>();

  function reviewInShadow(candidate: HumanAttentionCandidate): void {
    if (!opts.reviewProactive) return;
    void opts
      .reviewProactive(candidate)
      .then((review) => {
        bus.emit({
          type: "human.attention.reviewed",
          source: "telegram-outbound",
          owner: "agent:may",
          data: {
            sourceEventId: candidate.sourceEventId,
            mode: "shadow",
            delivered: true,
            candidate: {
              eventType: candidate.eventType,
              from: candidate.from,
              content: candidate.content,
              projectId: candidate.projectId,
            },
            ...review,
          },
        } as any);
      })
      .catch((error) => {
        bus.emit({
          type: "human.attention.reviewed",
          source: "telegram-outbound",
          owner: "agent:may",
          data: {
            sourceEventId: candidate.sourceEventId,
            mode: "shadow",
            delivered: true,
            status: "failed",
            reason: error instanceof Error ? error.message : String(error),
            candidate: {
              eventType: candidate.eventType,
              from: candidate.from,
              content: candidate.content,
              projectId: candidate.projectId,
            },
          },
        } as any);
      });
  }

  const unsubBus = bus.subscribe((event: any) => {
    const session = sessionData(event);
    const sessionId = typeof session.sessionId === "string" ? session.sessionId : undefined;

    if (event.type === "chat.start.requested" && event.source === "telegram") {
      const data = messageData(event);
      const replyToMessageId = numberOrUndefined(data.channelMessageId);
      if (data.forceNew !== true) {
        if (replyToMessageId) pendingTelegramReplyToMessageId = replyToMessageId;
        if (typeof data.conversationId === "string") pendingTelegramConversationId = data.conversationId;
        bindCurrentChatSession(replyToMessageId);
      }
    }

    if (event.type === "session.start" && sessionId && isRootChatSession(event)) {
      rootChatSessions.add(sessionId);
      latestRootChatSessionId = sessionId;
      watchedSessions.add(sessionId);
      outboundBySession.set(sessionId, { pendingText: "", sentAnyText: false, sentText: "" });
      if (event.trace?.traceId) traceBySession.set(sessionId, event.trace);
      const sessionReplyToMessageId = numberOrUndefined(session.channelMessageId);
      const sessionConversationId =
        typeof session.conversationId === "string" && session.conversationId.trim()
          ? session.conversationId.trim()
          : undefined;
      if (sessionReplyToMessageId) {
        replyToMessageIdBySession.set(sessionId, sessionReplyToMessageId);
      } else if (pendingTelegramReplyToMessageId) {
        replyToMessageIdBySession.set(sessionId, pendingTelegramReplyToMessageId);
      }
      if (sessionConversationId) {
        conversationIdBySession.set(sessionId, sessionConversationId);
      } else if (pendingTelegramConversationId) {
        conversationIdBySession.set(sessionId, pendingTelegramConversationId);
      }
      pendingTelegramReplyToMessageId = undefined;
      pendingTelegramConversationId = undefined;
    }

    if (
      event.type === "session.start" &&
      session.parentSessionId &&
      watchedSessions.has(String(session.parentSessionId)) &&
      sessionId
    ) {
      watchedSessions.add(sessionId);
      if (event.trace?.traceId) traceBySession.set(sessionId, event.trace);
      const parentReplyToMessageId = replyToMessageIdBySession.get(String(session.parentSessionId));
      if (parentReplyToMessageId) replyToMessageIdBySession.set(sessionId, parentReplyToMessageId);
      const parentConversationId = conversationIdBySession.get(String(session.parentSessionId));
      if (parentConversationId) conversationIdBySession.set(sessionId, parentConversationId);
    }

    if (sessionId && !watchedSessions.has(sessionId)) {
      return;
    }

    const isRootSession = Boolean(sessionId && rootChatSessions.has(sessionId));

    if (event.type === "text" && "sessionId" in event && rootChatSessions.has(event.sessionId)) {
      const state = sessionState(event.sessionId);
      state.pendingText += event.text;
      flushPendingText(event.sessionId);
    }

    if (event.type === "turn_end" && "sessionId" in event && rootChatSessions.has(event.sessionId)) {
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

    if (event.type === "session.end" && sessionId && !isRootSession) {
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
            conversationId: conversationIdBySession.get(sessionId),
            ...traceContext(sessionId),
          });
        } else {
          sendToUser(`✅ ${String(session.agent)}: ${summary}`, {
            eventType: "session.end",
            agent: String(session.agent),
            sessionId,
            summary,
            replyToMessageId: replyToMessageIdBySession.get(sessionId),
            conversationId: conversationIdBySession.get(sessionId),
            ...traceContext(sessionId),
          });
        }
      }
      watchedSessions.delete(sessionId);
      replyToMessageIdBySession.delete(sessionId);
      conversationIdBySession.delete(sessionId);
      traceBySession.delete(sessionId);
      outboundBySession.delete(sessionId);
    }

    if (event.type === "cli.task.started" && sessionId && isRootSession) {
      const state = sessionState(sessionId);
      if (!state.sentAnyText && !state.pendingText.trim()) {
        const tool = typeof session.tool === "string" ? session.tool : "a second-opinion tool";
        const text = `I received this. I’m checking it with ${tool} and will reply with the result.`;
        sendToUser(text, {
          eventType: "response",
          agent: opts.interfaceAgent,
          sessionId,
          replyToMessageId: replyToMessageIdBySession.get(sessionId),
          conversationId: conversationIdBySession.get(sessionId),
          ...traceContext(sessionId),
        });
        state.sentAnyText = true;
        state.sentText += `\n${text}`;
      }
    }

    if (
      (event.type === "session.end" || event.type === "session.idle") &&
      sessionId &&
      isRootSession &&
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
          conversationId: conversationIdBySession.get(sessionId),
          ...traceContext(sessionId),
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
            conversationId: conversationIdBySession.get(sessionId),
            ...traceContext(sessionId),
          });
          state.sentAnyText = true;
          state.sentText += "\n" + summary;
        } else if (!state.sentAnyText) {
          sendToUser("❌ Couldn't generate a response. Try again or rephrase.", {
            eventType: "error",
            agent: String(session.agent),
            sessionId,
            replyToMessageId: replyToMessageIdBySession.get(sessionId),
            conversationId: conversationIdBySession.get(sessionId),
            ...traceContext(sessionId),
          });
        }
      }
      if (event.type === "session.end" || event.type === "session.idle") {
        rootChatSessions.delete(sessionId);
        if (latestRootChatSessionId === sessionId) {
          latestRootChatSessionId = [...rootChatSessions].at(-1) ?? null;
        }
        watchedSessions.delete(sessionId);
        replyToMessageIdBySession.delete(sessionId);
        conversationIdBySession.delete(sessionId);
        traceBySession.delete(sessionId);
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
          "traceId",
          "parentEventId",
          "conversation",
          "originalIssue",
          "lastHandledBy",
          "expectedClosure",
          "actionHints",
        ]) {
          if (message[key] !== undefined) data[key] = message[key];
        }
        const sourceEventId = typeof event[EVENT_ROW_ID] === "number" ? event[EVENT_ROW_ID] : undefined;
        const traceId =
          typeof event.trace?.traceId === "string"
            ? event.trace.traceId
            : sourceEventId
              ? `event:${sourceEventId}`
              : undefined;
        if (sourceEventId && data.sourceEventId === undefined) data.sourceEventId = sourceEventId;
        if (traceId && data.traceId === undefined) data.traceId = traceId;
        if (typeof event.trace?.parentEventId === "number" && data.parentEventId === undefined) {
          data.parentEventId = event.trace.parentEventId;
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
        reviewInShadow({
          sourceEventId,
          eventType: "message.created",
          from: String(message.from ?? ""),
          content,
          projectId: projectId ?? (typeof message.projectId === "string" ? message.projectId : undefined),
          data,
        });
        sendToUser(`📋 ${content}`, {
          eventType: "message.created",
          agent: String(message.from ?? ""),
          sessionId: "sessionId" in message ? String(message.sessionId) : undefined,
          projectId,
          summary: content.slice(0, 200),
          data,
          traceId,
          parentEventId: typeof data.parentEventId === "number" ? data.parentEventId : undefined,
          taskId: typeof data.taskId === "string" ? data.taskId : undefined,
          replyToMessageId: traceId ? replyToMessageIdForTrace(traceId) : undefined,
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
      conversationId: conversationIdBySession.get(sessionId),
      ...traceContext(sessionId),
    });
  }

  function bindCurrentChatSession(replyToMessageId?: number): string | null {
    const sessionId = getSessionId();
    if (!sessionId) return null;
    rootChatSessions.add(sessionId);
    latestRootChatSessionId = sessionId;
    watchedSessions.add(sessionId);
    sessionState(sessionId);
    const effectiveReplyToMessageId = replyToMessageId ?? pendingTelegramReplyToMessageId;
    if (effectiveReplyToMessageId) {
      replyToMessageIdBySession.set(sessionId, effectiveReplyToMessageId);
      pendingTelegramReplyToMessageId = undefined;
    }
    if (pendingTelegramConversationId) {
      conversationIdBySession.set(sessionId, pendingTelegramConversationId);
      pendingTelegramConversationId = undefined;
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
    getRootChatSessionId: () => latestRootChatSessionId,
    sendAlert: (text: string) => {
      reviewInShadow({
        eventType: "alert",
        from: opts.interfaceAgent,
        content: text.slice(0, 4000),
      });
      sendToUser(text, { eventType: "alert" });
    },
  };

  function traceContext(sessionId: string): { traceId?: string; parentEventId?: number } {
    const trace = traceBySession.get(sessionId);
    return trace ? { traceId: trace.traceId, parentEventId: trace.parentEventId } : {};
  }

  function replyToMessageIdForTrace(traceId: string): number | undefined {
    for (const [sessionId, trace] of traceBySession) {
      if (trace.traceId === traceId) return replyToMessageIdBySession.get(sessionId);
    }
    return undefined;
  }
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

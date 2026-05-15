import type { EventBus } from "../event-bus.js";
import { extractProjectPath, normalizeProjectPath } from "./telegram-reply-router.js";

export interface TelegramOutboundContext {
  eventType?: string;
  agent?: string;
  sessionId?: string;
  projectId?: string;
  summary?: string;
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

export function attachTelegramOutbound(opts: TelegramOutboundOptions): TelegramOutbound {
  const { bus, getSessionId, pendingChatId, sendToUser } = opts;

  let rootChatSessionId: string | null = null;
  const watchedSessions = new Set<string>();
  const outboundBySession = new Map<string, { pendingText: string; sentAnyText: boolean; sentText: string }>();

  const unsubBus = bus.subscribe((event: any) => {
    if (event.type === "session.start" && event.sessionId && isRootChatSession(event)) {
      rootChatSessionId = event.sessionId;
      watchedSessions.clear();
      watchedSessions.add(event.sessionId);
      outboundBySession.set(event.sessionId, { pendingText: "", sentAnyText: false, sentText: "" });
    }

    if (event.type === "session.start" && event.parentSessionId && watchedSessions.has(event.parentSessionId)) {
      watchedSessions.add(event.sessionId);
    }

    if ("sessionId" in event && typeof event.sessionId === "string" && !watchedSessions.has(event.sessionId)) {
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
        bus.emit({ type: "info", message: `[telegram] Turn error: ${event.errorCount} error(s), no text produced (session: ${event.sessionId})` });
      }
    }

    if (event.type === "session.end" && "sessionId" in event && event.sessionId !== rootSid) {
      if (pendingChatId) {
        const fp = event.finishParams as Record<string, unknown> | undefined;
        const summary = (fp?.summary as string) ?? (typeof event.outcome === "string" ? event.outcome.slice(0, 200) : "completed");
        const fpStatus = (fp?.status as string) ?? event.status;
        if (fpStatus === "failure" || fpStatus === "blocked") {
          sendToUser(`❌ ${String(event.agent)} BLOCKED: ${summary}`, { eventType: "blocked", agent: String(event.agent), sessionId: event.sessionId, summary });
        } else {
          sendToUser(`✅ ${String(event.agent)}: ${summary}`, { eventType: "session.end", agent: String(event.agent), sessionId: event.sessionId, summary });
        }
      }
    }

    if (event.type === "session.end" && "sessionId" in event && event.sessionId === rootSid && pendingChatId) {
      const state = sessionState(event.sessionId);
      flushPendingText(event.sessionId);
      if (event.error) {
        const errMsg = String(event.error).length > 200 ? String(event.error).slice(0, 200) + "…" : String(event.error);
        sendToUser(`❌ Couldn't process your message: ${errMsg}`, { eventType: "error", agent: event.agent, sessionId: event.sessionId, summary: errMsg });
      } else {
        const summary = String(event.summary ?? "").trim();
        if (summary && shouldSendSummary(event.sessionId, summary)) {
          sendToUser(summary, { eventType: "session.end", agent: event.agent, sessionId: event.sessionId, summary });
          state.sentAnyText = true;
          state.sentText += "\n" + summary;
        } else if (!state.sentAnyText) {
          sendToUser("❌ Couldn't generate a response. Try again or rephrase.", { eventType: "error", agent: event.agent, sessionId: event.sessionId });
        }
      }
      rootChatSessionId = null;
      watchedSessions.clear();
      outboundBySession.delete(event.sessionId);
    }

    if (event.type === "message.created" && event.to === "human" && event.from === opts.interfaceAgent) {
      if (pendingChatId) {
        const content = String(event.content ?? "").slice(0, 4000);
        const projectId = normalizeProjectPath(event.projectPath ?? event.projectId, opts.projectRoot) ?? extractProjectPath(content, opts.projectRoot) ?? undefined;
        sendToUser(`📋 ${content}`, { eventType: "message.created", agent: String(event.from ?? ""), sessionId: "sessionId" in event ? String(event.sessionId) : undefined, projectId, summary: content.slice(0, 200) });
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
    sendToUser(text, { eventType: "response", agent: opts.interfaceAgent, sessionId });
  }

  function shouldSendSummary(sessionId: string, summary: string): boolean {
    const sent = normalizeForCompare(sessionState(sessionId).sentText);
    const candidate = normalizeForCompare(summary);
    if (!candidate) return false;
    if (!sent) return true;
    return !sent.includes(candidate) && !candidate.includes(sent);
  }

  function isRootChatSession(event: any): boolean {
    if (event.parentSessionId) return false;
    if (event.agent !== opts.interfaceAgent) return false;
    if (event.kind && event.kind !== "chat") return false;
    return event.source === "telegram" || event.sessionId === getSessionId();
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

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
  allowTraceReplyFallback?: boolean;
  conversationId?: string;
  traceId?: string;
  parentEventId?: number;
  taskId?: string;
}

export interface TelegramSessionReplyContext {
  channelMessageId?: number;
  conversationId?: string;
  requestId?: string;
}

export interface TelegramOutboundOptions {
  bus: EventBus;
  interfaceAgent: string;
  projectRoot: string;
  pendingChatId: string | null;
  getSessionId: () => string;
  getSessionReplyContext?: (sessionId: string) => TelegramSessionReplyContext | null | undefined;
  sendToUser: (text: string, context?: TelegramOutboundContext) => void;
  reviewProactive?: (candidate: HumanAttentionCandidate) => Promise<HumanAttentionReview>;
  /** Hard controller deadline; must expire before the review agent's outer 120s timeout. */
  proactiveReviewDeadlineMs?: number;
  hasDeliveredNotificationKey?: (key: string) => boolean;
  isApprovalResolved?: (identity: {
    approvalId?: string;
    waitId?: string;
    taskId?: string;
    taskGeneration?: number;
  }) => boolean;
}

export interface TelegramOutbound {
  close: () => void;
  drain: () => Promise<void>;
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
  let closed = false;
  let proactiveAdmissionQueue = Promise.resolve();
  /** Track resolved approval decisions so stale approval prompts can be suppressed. */
  const resolvedApprovalKeys = new Set<string>();
  const queuedNotificationKeys = new Set<string>();
  const maxRememberedApprovalResolutions = 1_024;

  function rememberApprovalResolution(key: string): void {
    resolvedApprovalKeys.delete(key);
    resolvedApprovalKeys.add(key);
    while (resolvedApprovalKeys.size > maxRememberedApprovalResolutions) {
      const oldest = resolvedApprovalKeys.values().next().value;
      if (typeof oldest !== "string") break;
      resolvedApprovalKeys.delete(oldest);
    }
  }

  function candidateIntent(candidate: HumanAttentionCandidate): string {
    const projectPart = candidate.projectId ? ` for ${candidate.projectId}` : "";
    return `${candidate.from} proposes sending Hao a proactive ${candidate.eventType} update${projectPart}.`;
  }

  function handledReview(
    candidate: HumanAttentionCandidate,
    input: {
      reason: string;
      nextAction: string;
      actionTaken: string;
      closureCondition: string;
      evidence: string[];
    },
  ): HumanAttentionReview {
    return {
      status: "completed",
      disposition: "handle",
      understoodIntent: candidateIntent(candidate),
      reason: input.reason,
      nextAction: input.nextAction,
      evidence: input.evidence,
      actionTaken: input.actionTaken,
      closureCondition: input.closureCondition,
    };
  }

  function failedReviewFallback(
    candidate: HumanAttentionCandidate,
    review: HumanAttentionReview,
    attempts: number,
  ): HumanAttentionReview {
    return {
      status: "completed",
      disposition: "route",
      understoodIntent: candidateIntent(candidate),
      reason:
        "May's live admission review did not reach a supported terminal decision, so the candidate must stay internal while the platform owner recovers it from bounded durable evidence.",
      nextAction:
        "Route recovery to tech-lead under may-agent.app owner review and keep Telegram delivery blocked until a later terminal admission decision exists.",
      owner: "tech-lead",
      evidence: [
        `sourceEventId ${candidate.sourceEventId ?? "unknown"} remained held after ${attempts} unsuccessful admission review attempt(s).`,
        `Last review failure: ${review.reason}.`,
        "The Telegram gate failed closed and did not deliver raw producer text to Hao.",
      ],
      actionTaken:
        "Recorded a safe recovery route and woke tech-lead to recover the held candidate from bounded durable evidence instead of allowing an unsupported failed placeholder to stand.",
      closureCondition:
        "A later admission review or owner recovery records a terminal handle, route, clarify-producer, reject, or deliver disposition for this exact candidate lineage.",
      reviewAgainWhen:
        "When the tech-lead recovery review records the bounded recovery result or a later admission review completes.",
    };
  }

  function reviewAudit(
    candidate: HumanAttentionCandidate,
    review: HumanAttentionReview,
    attempts: number,
    delivered: boolean,
    deliveryError?: string,
  ): void {
    bus.emit({
      type: "human.attention.reviewed",
      source: "telegram-outbound",
      owner: "agent:may",
      data: {
        sourceEventId: candidate.sourceEventId,
        mode: "enforce",
        admitted: review.status === "completed" && review.disposition === "deliver",
        delivered,
        attempts,
        candidate: {
          eventType: candidate.eventType,
          from: candidate.from,
          content: candidate.content,
          projectId: candidate.projectId,
        },
        ...review,
        ...(deliveryError ? { deliveryError } : {}),
      },
    } as any);
  }

  function routeFailedReview(candidate: HumanAttentionCandidate, review: HumanAttentionReview, attempts: number): void {
    const data = candidate.data ?? {};
    const approval = approvalConversationContext(data).originalIssue;
    const recovery =
      data.recovery && typeof data.recovery === "object" && !Array.isArray(data.recovery)
        ? (data.recovery as Record<string, unknown>)
        : undefined;
    bus.emit({
      type: "project.owner.requested",
      source: "telegram-outbound",
      owner: "agent:tech-lead",
      data: {
        project: "may-agent",
        reason: "telegram-admission-review-failed",
        params: {
          instruction:
            "Recover the held Telegram admission candidate from bounded durable evidence only: the candidate payload, cited packet/artifact paths, current task-tree truth, and exact runtime lineage for this request. Retry or route it under the existing ownership convention, keep raw candidate text internal, avoid repository-wide search unless one exact cited file still needs inspection, and contact Hao only after a successful deliver disposition.",
          sourceEventId: candidate.sourceEventId,
          candidateEventType: candidate.eventType,
          candidateFrom: candidate.from,
          candidateProjectId: candidate.projectId,
          reviewReason: review.reason,
          attempts,
          closureCondition:
            "A later admission review records a terminal handle, route, clarify-producer, reject, or deliver disposition.",
          recoveryDisposition: {
            allowedDispositions: ["handle", "route", "clarify-producer", "reject", "deliver"],
            fallbackRule:
              "If the recovery cannot be completed from bounded evidence in one turn, return the safest structured route or clarify-producer outcome instead of aborting without a terminal disposition.",
          },
          approval,
          recovery,
        },
      },
    } as any);
  }

  function shouldRetryReviewFailure(review: HumanAttentionReview): boolean {
    if (review.status !== "failed") return false;
    const reason = review.reason.trim().toLowerCase();
    if (!reason) return true;
    return !["request was aborted", "timed out", "timeout", "no structured result", "without calling finish"].some(
      (needle) => reason.includes(needle),
    );
  }

  async function decideProactive(
    candidate: HumanAttentionCandidate,
  ): Promise<{ review: HumanAttentionReview; attempts: number }> {
    if (!opts.reviewProactive) {
      return {
        review: { status: "failed", reason: "Human-attention reviewer is unavailable" },
        attempts: 0,
      };
    }

    let lastFailure: HumanAttentionReview = { status: "failed", reason: "Human-attention review failed" };
    for (let attempts = 1; attempts <= 2; attempts += 1) {
      try {
        const review = await opts.reviewProactive(candidate);
        if (review.status === "completed") return { review, attempts };
        lastFailure = review;
      } catch (error) {
        lastFailure = {
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      if (!shouldRetryReviewFailure(lastFailure)) {
        return { review: lastFailure, attempts };
      }
    }
    return { review: lastFailure, attempts: 2 };
  }

  async function decideProactiveWithinDeadline(
    candidate: HumanAttentionCandidate,
  ): Promise<{ review: HumanAttentionReview; attempts: number }> {
    // Clamp overrides so the controller always has at least 30 seconds to persist
    // its terminal fallback before the review agent's 120-second outer timeout.
    const deadlineMs = Math.min(90_000, Math.max(1, opts.proactiveReviewDeadlineMs ?? 90_000));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<{ review: HumanAttentionReview; attempts: number }>((resolve) => {
      timer = setTimeout(() => {
        resolve({
          review: {
            status: "failed",
            reason: `Admission review exceeded the ${deadlineMs}ms controller deadline`,
          },
          attempts: 1,
        });
      }, deadlineMs);
    });
    try {
      return await Promise.race([decideProactive(candidate), deadline]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function candidateApprovalResolved(candidate: HumanAttentionCandidate): boolean {
    const d = candidate.data ?? {};
    const approvalId =
      typeof d.approvalId === "string"
        ? d.approvalId
        : typeof (d.approval as any)?.approvalId === "string"
          ? (d.approval as any).approvalId
          : undefined;
    const waitId =
      typeof d.waitId === "string"
        ? d.waitId
        : typeof (d.approval as any)?.waitId === "string"
          ? (d.approval as any).waitId
          : undefined;
    const taskId =
      typeof d.taskId === "string"
        ? d.taskId
        : typeof (d.approval as any)?.taskId === "string"
          ? (d.approval as any).taskId
          : undefined;
    const taskGeneration =
      typeof d.taskGeneration === "number"
        ? d.taskGeneration
        : typeof (d.approval as any)?.taskGeneration === "number"
          ? (d.approval as any).taskGeneration
          : undefined;
    if (approvalId && resolvedApprovalKeys.has(approvalId)) return true;
    if (waitId && resolvedApprovalKeys.has(`wait:${waitId}`)) return true;
    try {
      return Boolean(opts.isApprovalResolved?.({ approvalId, waitId, taskId, taskGeneration }));
    } catch {
      return false;
    }
  }

  function admitProactive(
    candidate: HumanAttentionCandidate,
    deliver: (reviewedText: string) => void,
    onSettled?: () => void,
  ): void {
    proactiveAdmissionQueue = proactiveAdmissionQueue
      .catch(() => undefined)
      .then(async () => {
        if (closed) return;
        const { review, attempts } = await decideProactiveWithinDeadline(candidate);
        if (closed) return;
        if (review.status !== "completed" || review.disposition !== "deliver" || !review.deliveredMessage) {
          if (review.status === "failed") {
            reviewAudit(candidate, failedReviewFallback(candidate, review, attempts), attempts, false);
            routeFailedReview(candidate, review, attempts);
            return;
          }
          reviewAudit(candidate, review, attempts, false);
          return;
        }
        try {
          // Revalidate: if the approval was resolved during review, suppress delivery.
          if (candidateApprovalResolved(candidate)) {
            reviewAudit(candidate, review, attempts, false, "approval-resolved-during-review");
            return;
          }
          deliver(review.deliveredMessage);
          reviewAudit(candidate, review, attempts, true);
        } catch (error) {
          reviewAudit(candidate, review, attempts, false, error instanceof Error ? error.message : String(error));
        }
      })
      .finally(onSettled);
  }

  const unsubBus = bus.subscribe((event: any) => {
    const session = sessionData(event);
    const sessionId = typeof session.sessionId === "string" ? session.sessionId : undefined;

    if (event.type === "app.response.delivery.requested") {
      if (session.channel !== "telegram") return;
      const text = typeof session.text === "string" ? session.text.trim() : "";
      if (!text) return;
      sendToUser(text, {
        eventType: "app.response.delivery.requested",
        agent: opts.interfaceAgent,
        sessionId,
        replyToMessageId: numberOrUndefined(session.channelMessageId),
        conversationId: typeof session.conversationId === "string" ? session.conversationId : undefined,
        data: {
          operationId: session.operationId,
          appInboxItemId: session.appInboxItemId,
          appInboxRequestId: session.appInboxRequestId,
        },
      });
      return;
    }

    // Track resolved approvals so stale approval prompts are suppressed.
    if (event.type === "project.approval.submitted" || event.type === "project.approval.resolved") {
      const d = messageData(event);
      if (typeof d.approvalId === "string") rememberApprovalResolution(d.approvalId);
      if (typeof d.waitId === "string") rememberApprovalResolution(`wait:${d.waitId}`);
    }

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
        const rawText =
          fpStatus === "failure" || fpStatus === "blocked"
            ? `❌ ${String(session.agent)} BLOCKED: ${summary}`
            : `✅ ${String(session.agent)}: ${summary}`;
        const replyToMessageId = replyToMessageIdBySession.get(sessionId);
        const conversationId = conversationIdBySession.get(sessionId);
        const trace = traceContext(sessionId);
        admitProactive(
          {
            sourceEventId: typeof event[EVENT_ROW_ID] === "number" ? event[EVENT_ROW_ID] : undefined,
            eventType: "session.end",
            from: String(session.agent),
            content: rawText,
            projectId: typeof session.projectId === "string" ? session.projectId : undefined,
            data: {
              sessionId,
              status: fpStatus,
              summary,
              ...trace,
            },
          },
          (reviewedText) => {
            sendToUser(reviewedText, {
              eventType: fpStatus === "failure" || fpStatus === "blocked" ? "blocked" : "session.end",
              agent: String(session.agent),
              sessionId,
              summary: reviewedText.slice(0, 200),
              replyToMessageId,
              conversationId,
              ...trace,
            });
          },
        );
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
        const sourceSessionId = nonEmptyString(message.sourceSessionId);
        const sourceReplyContext = sourceSessionId ? replyContextForSession(sourceSessionId) : undefined;
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
          "recovery",
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
          "sourceSessionId",
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
        const candidate: HumanAttentionCandidate = {
          sourceEventId,
          eventType: "message.created",
          from: String(message.from ?? ""),
          content,
          projectId: projectId ?? (typeof message.projectId === "string" ? message.projectId : undefined),
          data,
        };
        const stableNotificationKey =
          nonEmptyString(data.dedupKey) ??
          nonEmptyString(data.approvalId) ??
          nonEmptyString((data.approval as Record<string, unknown> | undefined)?.approvalId);
        if (candidateApprovalResolved(candidate)) {
          reviewAudit(
            candidate,
            handledReview(candidate, {
              reason:
                "The proposed human message is already superseded by an exact approval resolution, so delivering it would reopen settled work.",
              nextAction:
                "Keep the existing approval resolution as the terminal authority record and suppress this stale proactive prompt.",
              actionTaken:
                "Checked the approval identity against current runtime resolution state and suppressed the stale prompt before delivery.",
              closureCondition:
                "This candidate closes now as handled because the matching approval already has a terminal resolution and no new human decision remains.",
              evidence: [
                "The candidate approval identity was already resolved in current runtime state before delivery.",
              ],
            }),
            0,
            false,
          );
          return;
        }
        if (
          stableNotificationKey &&
          (queuedNotificationKeys.has(stableNotificationKey) ||
            opts.hasDeliveredNotificationKey?.(stableNotificationKey))
        ) {
          reviewAudit(
            candidate,
            handledReview(candidate, {
              reason:
                "The proposed human message is a semantic duplicate of a queued or already-delivered notification key, so sending it again would create duplicate human attention without changing the underlying decision.",
              nextAction:
                "Preserve the existing notification lineage for this key and suppress the duplicate proposal unless its decision meaning materially changes.",
              actionTaken:
                "Matched the candidate's stable notification key against queued/delivered state and suppressed the duplicate proposal.",
              closureCondition:
                "This candidate closes now as handled because the existing notification lineage for this key already owns the human-facing update.",
              evidence: [
                `Matched stable notification key ${stableNotificationKey} against existing queued or delivered state.`,
              ],
            }),
            0,
            false,
          );
          return;
        }
        if (stableNotificationKey) queuedNotificationKeys.add(stableNotificationKey);
        admitProactive(
          candidate,
          (reviewedText) => {
            sendToUser(reviewedText, {
              eventType: "message.created",
              agent: String(message.from ?? ""),
              sessionId: sourceSessionId ?? ("sessionId" in message ? String(message.sessionId) : undefined),
              projectId,
              summary: reviewedText.slice(0, 200),
              data,
              traceId,
              parentEventId: typeof data.parentEventId === "number" ? data.parentEventId : undefined,
              taskId: typeof data.taskId === "string" ? data.taskId : undefined,
              replyToMessageId:
                sourceReplyContext?.replyToMessageId ??
                (!sourceSessionId && traceId ? replyToMessageIdForTrace(traceId) : undefined),
              allowTraceReplyFallback: !sourceSessionId,
              conversationId: sourceReplyContext?.conversationId,
            });
          },
          stableNotificationKey ? () => queuedNotificationKeys.delete(stableNotificationKey) : undefined,
        );
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
    close: () => {
      closed = true;
      unsubBus();
    },
    drain: () => proactiveAdmissionQueue,
    getRootChatSessionId: () => latestRootChatSessionId,
    sendAlert: (text: string) => {
      const candidate: HumanAttentionCandidate = {
        eventType: "alert",
        from: opts.interfaceAgent,
        content: text.slice(0, 4000),
      };
      admitProactive(candidate, (reviewedText) => {
        sendToUser(reviewedText, { eventType: "alert" });
      });
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

  function replyContextForSession(
    sessionId: string,
  ): { replyToMessageId?: number; conversationId?: string } | undefined {
    const liveReplyToMessageId = replyToMessageIdBySession.get(sessionId);
    const liveConversationId = conversationIdBySession.get(sessionId);
    if (liveReplyToMessageId && liveConversationId) {
      return { replyToMessageId: liveReplyToMessageId, conversationId: liveConversationId };
    }

    let persisted: TelegramSessionReplyContext | null | undefined;
    try {
      persisted = opts.getSessionReplyContext?.(sessionId);
    } catch {
      // A missing or unreadable session record must not break human delivery.
    }

    const persistedReplyToMessageId =
      positiveIntegerOrUndefined(persisted?.channelMessageId) ?? telegramMessageIdFromRequestId(persisted?.requestId);
    const persistedConversationId = nonEmptyString(persisted?.conversationId);
    if (!liveReplyToMessageId && !persistedReplyToMessageId && !liveConversationId && !persistedConversationId) {
      return undefined;
    }
    return {
      replyToMessageId: liveReplyToMessageId ?? persistedReplyToMessageId,
      conversationId: liveConversationId ?? persistedConversationId,
    };
  }
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function positiveIntegerOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function telegramMessageIdFromRequestId(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^telegram:([1-9]\d*)$/.exec(value);
  return match ? positiveIntegerOrUndefined(Number(match[1])) : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

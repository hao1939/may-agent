"use strict";

function openRequests(state) {
  return state.requests.filter((request) => request.status !== "done" && request.status !== "stopped");
}

function messageById(state, id) {
  return state.messages.find((message) => message.id === id) || null;
}

function requestByTrace(state, traceId) {
  return state.requests.find((request) => request.traceId === traceId) || null;
}

function namedMatches(state, text) {
  const value = String(text || "").toLowerCase();
  return openRequests(state).filter((request) =>
    (request.names || [request.subject]).some((name) => value.includes(String(name).toLowerCase())),
  );
}

function resolveFocus(state, incoming) {
  if (incoming.replyTo) {
    const anchor = messageById(state, incoming.replyTo);
    if (anchor?.traceId) {
      const request = requestByTrace(state, anchor.traceId);
      if (request) {
        return { kind: "focused", reason: "reply-anchor", traceId: request.traceId };
      }
    }
  }

  const named = namedMatches(state, incoming.text);
  if (named.length === 1) {
    return { kind: "focused", reason: "named-subject", traceId: named[0].traceId };
  }

  const open = openRequests(state);
  if (open.length === 1) {
    return { kind: "focused", reason: "only-open-request", traceId: open[0].traceId };
  }

  if (open.length > 1) {
    return {
      kind: "clarify",
      reason: "several-open-requests",
      candidates: open.map((request) => request.traceId),
    };
  }

  return { kind: "new", reason: "no-open-request" };
}

function latestHumanMessage(state, traceId) {
  return state.messages
    .filter((message) => message.actor === "human" && message.traceId === traceId)
    .sort((left, right) => right.seq - left.seq)[0] || null;
}

function originalHumanMessage(state, traceId) {
  const request = requestByTrace(state, traceId);
  return request ? messageById(state, request.originalHumanMessageId) : null;
}

function selectReplyTarget(state, input) {
  if (input.kind === "immediate") return input.incomingMessageId;
  const latest = latestHumanMessage(state, input.traceId);
  return latest?.id || originalHumanMessage(state, input.traceId)?.id || null;
}

function buildPreparedContext(state, incoming) {
  const resolution = resolveFocus(state, incoming);
  if (resolution.kind !== "focused") {
    return {
      conversationId: state.conversationId,
      incoming,
      resolution,
      openRequests: openRequests(state).map(({ traceId, subject, status }) => ({ traceId, subject, status })),
    };
  }

  const request = requestByTrace(state, resolution.traceId);
  return {
    conversationId: state.conversationId,
    incoming,
    resolution,
    request: {
      traceId: request.traceId,
      subject: request.subject,
      intent: request.intent,
      status: request.status,
      owner: request.owner,
      taskId: request.taskId,
      evidence: request.evidence || [],
      nextCondition: request.nextCondition || null,
    },
    messages: state.messages.filter((message) => message.traceId === request.traceId),
    otherOpenRequests: openRequests(state)
      .filter((item) => item.traceId !== request.traceId)
      .map(({ traceId, subject, status }) => ({ traceId, subject, status })),
    preferences: state.preferences || [],
  };
}

function routeCompletion(state, completion) {
  const request = state.requests.find((item) => item.taskId === completion.taskId);
  if (!request) return { kind: "orphan", reason: "unknown-task" };
  if (state.reviewedCompletionIds?.includes(completion.id)) {
    return { kind: "duplicate", traceId: request.traceId };
  }
  return {
    kind: "review",
    traceId: request.traceId,
    freshSession: true,
    context: buildPreparedContext(state, {
      id: `wake:${completion.id}`,
      text: completion.summary,
      wake: "owner-completion",
      taskId: completion.taskId,
      replyTo: request.originalHumanMessageId,
    }),
    replyTo: selectReplyTarget(state, { kind: "later", traceId: request.traceId }),
  };
}

module.exports = {
  buildPreparedContext,
  resolveFocus,
  routeCompletion,
  selectReplyTarget,
};

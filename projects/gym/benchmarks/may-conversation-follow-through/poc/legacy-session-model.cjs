"use strict";

function currentTrace(state) {
  const session = state.sessions.find((item) => item.id === state.currentSessionId);
  return session?.traceId || null;
}

function resolveFocus(state, incoming) {
  const traceId = currentTrace(state);
  return traceId
    ? { kind: "focused", reason: "current-session", traceId }
    : { kind: "lost", reason: "no-current-session" };
}

function selectReplyTarget(state, input) {
  if (input.kind === "immediate") return input.incomingMessageId;
  return state.replyTargetBySession?.[state.currentSessionId] || null;
}

function routeCompletion(state, completion) {
  const session = state.sessions.find((item) => item.id === completion.sourceSessionId && item.status !== "gone");
  if (!session) return { kind: "lost", reason: "source-session-unavailable" };
  return {
    kind: "steer",
    traceId: session.traceId,
    sessionId: session.id,
    replyTo: state.replyTargetBySession?.[session.id] || null,
  };
}

module.exports = { resolveFocus, routeCompletion, selectReplyTarget };

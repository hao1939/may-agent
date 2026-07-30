"use strict";

function baseState() {
  return {
    conversationId: "telegram:chat:hao:topic:0:agent:may",
    preferences: ["Use plain language", "Proof before rollout"],
    messages: [
      { id: 101, seq: 1, actor: "human", traceId: "trace-replies", text: "Investigate the repeated May replies." },
      { id: 102, seq: 2, actor: "may", traceId: "trace-replies", text: "The platform owner is investigating." },
      { id: 201, seq: 3, actor: "human", traceId: "trace-gym", text: "Continue Gym training." },
      { id: 202, seq: 4, actor: "may", traceId: "trace-gym", text: "Gym is continuing the approved track." },
    ],
    requests: [
      {
        traceId: "trace-replies",
        subject: "repeated May replies",
        names: ["repeated replies", "telegram replies"],
        intent: "Find the root cause, fix it, and verify the result.",
        originalHumanMessageId: 101,
        status: "working",
        owner: "may-agent platform owner",
        taskId: "task-replies",
        evidence: ["Nineteen identical replies were observed."],
        nextCondition: "Root cause, regression test, and live replay are verified.",
      },
      {
        traceId: "trace-gym",
        subject: "Gym training",
        names: ["gym", "training"],
        intent: "Continue training May until approved learning material is exhausted.",
        originalHumanMessageId: 201,
        status: "working",
        owner: "Gym app",
        taskId: "task-gym",
        evidence: ["The current learning track is active."],
        nextCondition: "The track passes or reaches a real decision boundary.",
      },
    ],
    sessions: [
      { id: "session-old", traceId: "trace-replies", status: "gone" },
      { id: "session-current", traceId: "trace-gym", status: "idle" },
    ],
    currentSessionId: "session-current",
    replyTargetBySession: { "session-current": 201 },
    reviewedCompletionIds: [],
  };
}

module.exports = [
  {
    id: "reply-to-older-request",
    partition: "development",
    state: baseState(),
    operation: { type: "resolve", incoming: { id: 301, text: "Show me the root cause.", replyTo: 102 } },
    expected: { kind: "focused", traceId: "trace-replies", reason: "reply-anchor" },
  },
  {
    id: "named-subject-with-concurrent-work",
    partition: "development",
    state: baseState(),
    operation: { type: "resolve", incoming: { id: 302, text: "What is the Gym training progress?" } },
    expected: { kind: "focused", traceId: "trace-gym", reason: "named-subject" },
  },
  {
    id: "ambiguous-continue",
    partition: "development",
    state: baseState(),
    operation: { type: "resolve", incoming: { id: 303, text: "Continue." } },
    expected: { kind: "clarify", candidates: ["trace-replies", "trace-gym"] },
  },
  {
    id: "completion-after-session-loss",
    partition: "development",
    state: baseState(),
    operation: {
      type: "complete",
      completion: { id: "completion-replies-1", taskId: "task-replies", sourceSessionId: "session-old", summary: "Fix and replay passed." },
    },
    expected: { kind: "review", traceId: "trace-replies", freshSession: true, replyTo: 101 },
  },
  {
    id: "out-of-order-concurrent-completion",
    partition: "development",
    state: baseState(),
    operation: {
      type: "complete",
      completion: { id: "completion-replies-2", taskId: "task-replies", sourceSessionId: "session-current", summary: "Reply regression is fixed." },
    },
    expected: { kind: "review", traceId: "trace-replies", replyTo: 101 },
  },
  {
    id: "latest-human-reply-target",
    partition: "transfer",
    state: (() => {
      const state = baseState();
      state.messages.push({ id: 103, seq: 5, actor: "human", traceId: "trace-replies", text: "Also verify it after restart.", replyTo: 102 });
      return state;
    })(),
    operation: { type: "reply-target", input: { kind: "later", traceId: "trace-replies" } },
    expected: 103,
  },
  {
    id: "duplicate-completion",
    partition: "transfer",
    state: (() => {
      const state = baseState();
      state.reviewedCompletionIds = ["completion-replies-3"];
      return state;
    })(),
    operation: {
      type: "complete",
      completion: { id: "completion-replies-3", taskId: "task-replies", sourceSessionId: "session-old", summary: "Repeated completion." },
    },
    expected: { kind: "duplicate", traceId: "trace-replies" },
  },
  {
    id: "immediate-answer-target",
    partition: "transfer",
    state: baseState(),
    operation: { type: "reply-target", input: { kind: "immediate", incomingMessageId: 399, traceId: "trace-gym" } },
    expected: 399,
  },
];

#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const stateFile = path.resolve("conversation-state.json");
const inboxFile = path.resolve("inbox.json");
const logFile = path.resolve("conversation-actions.jsonl");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const fail = (message) => { console.error(message); process.exit(1); };
const text = (value, name) => { if (typeof value !== "string" || !value.trim()) fail(`${name} must be non-empty text`); };
const latestHuman = (state, traceId) => state.messages
  .filter((message) => message.actor === "human" && message.traceId === traceId)
  .sort((left, right) => right.seq - left.seq)[0] || null;

function inspect() {
  const state = read(stateFile);
  const inbox = read(inboxFile);
  const anchorTraceId = inbox.replyTo
    ? state.messages.find((message) => message.id === inbox.replyTo)?.traceId || null
    : null;
  const taskRequest = inbox.taskId
    ? state.requests.find((request) => request.taskId === inbox.taskId) || null
    : null;
  const actionContract = inbox.kind === "human"
    ? {
        type: "accept",
        traceId: inbox.traceId,
        taskId: inbox.taskId,
        replyTo: inbox.messageId,
        owner: inbox.accountableOwner,
        expectedProof: inbox.requiredProof,
        response: "plain-language acknowledgement",
      }
    : taskRequest
      ? {
          type: "closeout",
          traceId: taskRequest.traceId,
          taskId: taskRequest.taskId,
          completionId: inbox.completionId,
          replyTo: latestHuman(state, taskRequest.traceId)?.id,
          humanAction: "none",
          response: "plain-language verified closeout",
        }
      : null;
  console.log(JSON.stringify({
    conversationId: state.conversationId,
    inbox,
    anchorTraceId,
    taskRequest,
    openRequests: state.requests.filter((request) => !["done", "stopped"].includes(request.status)),
    messages: state.messages,
    preferences: state.preferences,
    actionContract,
  }, null, 2));
}

function apply(actionName) {
  const state = read(stateFile);
  const inbox = read(inboxFile);
  const action = read(path.resolve(actionName || "proposed-action.json"));
  text(action.type, "type");
  if (state.handledInboxIds.includes(inbox.id) && action.type !== "ignore-duplicate") fail(`Inbox ${inbox.id} was already handled`);

  if (action.type === "accept") {
    if (inbox.kind !== "human") fail("accept requires a human request");
    if (action.traceId !== inbox.traceId || action.taskId !== inbox.taskId) fail("accept must preserve the supplied trace and task");
    if (action.replyTo !== inbox.messageId) fail("accept must reply to the incoming message");
    text(action.owner, "owner"); text(action.expectedProof, "expectedProof"); text(action.response, "response");
    if (action.owner !== inbox.accountableOwner) fail("accept must preserve the accountable app owner");
    if (action.expectedProof !== inbox.requiredProof) fail("accept must preserve the required terminal proof");
    if (state.requests.some((request) => request.traceId === action.traceId || request.taskId === action.taskId)) fail("duplicate request or task");
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: action.traceId, text: inbox.text });
    state.requests.push({
      traceId: action.traceId, taskId: action.taskId, subject: inbox.subject,
      intent: inbox.outcome, owner: action.owner, expectedProof: action.expectedProof,
      status: "working", originalHumanMessageId: inbox.messageId, evidence: [],
      nextCondition: action.expectedProof,
    });
  } else if (action.type === "closeout") {
    if (inbox.kind !== "owner-completion") fail("closeout requires owner completion");
    const request = state.requests.find((item) => item.taskId === inbox.taskId);
    if (!request || request.traceId !== action.traceId || action.taskId !== inbox.taskId) fail("closeout must use the owner task trace");
    if (action.completionId !== inbox.completionId || state.reviewedCompletionIds.includes(inbox.completionId)) fail("invalid or reviewed completion");
    if (action.replyTo !== latestHuman(state, request.traceId)?.id) fail("closeout must reply to the latest human message in this trace");
    if (action.humanAction !== "none") fail("closeout must state that no human action is required");
    text(action.response, "response");
    request.status = "done"; request.evidence = inbox.evidence || [];
    state.reviewedCompletionIds.push(inbox.completionId);
  } else if (action.type === "clarify") {
    if (inbox.kind !== "human" || action.replyTo !== inbox.messageId) fail("clarify must reply to the human input");
    if (!Array.isArray(action.candidateTraceIds) || action.candidateTraceIds.length < 2) fail("clarify must name plausible requests");
    text(action.response, "response");
  } else if (action.type === "stop") {
    const anchor = state.messages.find((message) => message.id === inbox.replyTo)?.traceId;
    const request = state.requests.find((item) => item.traceId === action.traceId && item.taskId === action.taskId);
    if (inbox.kind !== "human" || !request || action.traceId !== anchor) fail("stop must target the reply-anchored request");
    if (action.replyTo !== inbox.messageId) fail("stop must reply to the correction");
    text(action.response, "response"); request.status = "stopped";
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: request.traceId, text: inbox.text });
  } else if (action.type === "ignore-duplicate") {
    if (inbox.kind !== "owner-completion" || !inbox.duplicateOf || !state.reviewedCompletionIds.includes(inbox.duplicateOf)) fail("completion is not a proven duplicate");
    if (action.humanResponse) fail("duplicate completion must not notify the human");
  } else if (action.type === "status") {
    const request = state.requests.find((item) => item.traceId === action.traceId && item.taskId === action.taskId);
    if (inbox.kind !== "human" || !request || action.replyTo !== inbox.messageId) fail("status must target an existing request and incoming message");
    text(action.response, "response");
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: request.traceId, text: inbox.text });
  } else fail(`Unsupported action: ${action.type}`);

  state.handledInboxIds.push(inbox.id);
  fs.appendFileSync(logFile, `${JSON.stringify({ ...action, inboxId: inbox.id })}\n`);
  write(stateFile, state);
  console.log(JSON.stringify({ accepted: true, action }, null, 2));
}

if (process.argv[2] === "inspect") inspect();
else if (process.argv[2] === "apply") apply(process.argv[3]);
else console.log("Run `node conversation-sim.cjs inspect`; its actionContract shows the typed fields for this inbox. Write proposed-action.json, then run `node conversation-sim.cjs apply proposed-action.json`. Success requires the simulator to print accepted: true. Never edit conversation-state.json directly.");

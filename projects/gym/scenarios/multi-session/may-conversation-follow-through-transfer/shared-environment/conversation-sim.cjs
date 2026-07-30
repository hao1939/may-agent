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
const requireText = (value, name) => { if (typeof value !== "string" || !value.trim()) fail(`${name} must be non-empty text`); };

function inspect() {
  const state = read(stateFile);
  const inbox = read(inboxFile);
  const anchorTraceId = inbox.replyTo ? state.messages.find((message) => message.id === inbox.replyTo)?.traceId || null : null;
  const contracts = {
    "ambiguous-command": { type: "clarify", replyTo: inbox.messageId, candidateTraceIds: inbox.candidateTraceIds, response: "one focused question" },
    correction: { type: "stop", traceId: anchorTraceId, taskId: state.requests.find((item) => item.traceId === anchorTraceId)?.taskId, replyTo: inbox.messageId, response: "plain confirmation" },
    "owner-completion": { type: "ignore-duplicate", completionId: inbox.completionId, duplicateOf: inbox.duplicateOf, humanResponse: null },
    "named-status": { type: "status", traceId: inbox.traceId, taskId: inbox.taskId, replyTo: inbox.messageId, humanAction: "none", response: "current state, next closure condition, and whether human action is needed" }
  };
  console.log(JSON.stringify({
    conversationId: state.conversationId, inbox, anchorTraceId,
    openRequests: state.requests.filter((item) => !["done", "stopped"].includes(item.status)),
    requests: state.requests, messages: state.messages, preferences: state.preferences,
    actionContract: contracts[inbox.kind] || null
  }, null, 2));
}

function apply(actionName) {
  const state = read(stateFile);
  const inbox = read(inboxFile);
  const action = read(path.resolve(actionName || "proposed-action.json"));
  requireText(action.type, "type");
  if (state.handledInboxIds.includes(inbox.id)) fail(`Inbox ${inbox.id} was already handled`);

  if (action.type === "clarify") {
    if (inbox.kind !== "ambiguous-command" || action.replyTo !== inbox.messageId) fail("clarify must reply to the ambiguous input");
    if (!Array.isArray(action.candidateTraceIds) || action.candidateTraceIds.length !== 2 || !inbox.candidateTraceIds.every((id) => action.candidateTraceIds.includes(id))) fail("clarify must name both plausible requests");
    requireText(action.response, "response");
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: null, text: inbox.text });
  } else if (action.type === "stop") {
    const anchor = state.messages.find((message) => message.id === inbox.replyTo)?.traceId;
    const request = state.requests.find((item) => item.traceId === action.traceId && item.taskId === action.taskId);
    if (inbox.kind !== "correction" || !request || action.traceId !== anchor) fail("stop must target the reply-anchored request");
    if (action.replyTo !== inbox.messageId) fail("stop must reply to the correction");
    requireText(action.response, "response");
    request.status = "stopped";
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: request.traceId, text: inbox.text });
  } else if (action.type === "ignore-duplicate") {
    if (inbox.kind !== "owner-completion" || action.completionId !== inbox.completionId || action.duplicateOf !== inbox.duplicateOf || !state.reviewedCompletionIds.includes(inbox.duplicateOf)) fail("completion is not a proven duplicate");
    if (action.humanResponse) fail("duplicate completion must not notify the human");
  } else if (action.type === "status") {
    const request = state.requests.find((item) => item.traceId === action.traceId && item.taskId === action.taskId);
    if (inbox.kind !== "named-status" || !request || action.traceId !== inbox.traceId || action.taskId !== inbox.taskId || action.replyTo !== inbox.messageId) fail("status must target the named request and incoming message");
    if (action.humanAction !== "none") fail("status must declare that no human action is required now");
    requireText(action.response, "response");
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: request.traceId, text: inbox.text });
  } else fail(`Unsupported action: ${action.type}`);

  state.handledInboxIds.push(inbox.id);
  fs.appendFileSync(logFile, `${JSON.stringify({ ...action, inboxId: inbox.id })}\n`);
  write(stateFile, state);
  console.log(JSON.stringify({ accepted: true, action }, null, 2));
}

if (process.argv[2] === "inspect") inspect();
else if (process.argv[2] === "apply") apply(process.argv[3]);
else console.log("Inspect first, write proposed-action.json, then apply it. Success requires accepted: true. Never edit conversation-state.json directly.");

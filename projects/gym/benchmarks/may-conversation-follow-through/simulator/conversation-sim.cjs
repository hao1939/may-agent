#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const statePath = path.join(root, "conversation-state.json");
const inboxPath = path.join(root, "inbox.json");
const logPath = path.join(root, "conversation-actions.jsonl");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be non-empty text`);
}

function latestHumanMessage(state, traceId) {
  return state.messages
    .filter((message) => message.actor === "human" && message.traceId === traceId)
    .sort((left, right) => right.seq - left.seq)[0] || null;
}

function appendAction(action) {
  fs.appendFileSync(logPath, `${JSON.stringify(action)}\n`);
}

function inspect() {
  const state = readJson(statePath);
  const inbox = readJson(inboxPath);
  const focused = inbox.replyTo
    ? state.messages.find((message) => message.id === inbox.replyTo)?.traceId || null
    : null;
  const taskRequest = inbox.taskId
    ? state.requests.find((request) => request.taskId === inbox.taskId) || null
    : null;
  process.stdout.write(`${JSON.stringify({
    conversationId: state.conversationId,
    inbox,
    anchorTraceId: focused,
    taskRequest,
    openRequests: state.requests.filter((request) => !["done", "stopped"].includes(request.status)),
    messages: state.messages,
    preferences: state.preferences,
  }, null, 2)}\n`);
}

function apply(actionFile) {
  const state = readJson(statePath);
  const inbox = readJson(inboxPath);
  const action = readJson(path.resolve(root, actionFile));

  requireText(action.type, "type");
  if (state.handledInboxIds.includes(inbox.id) && action.type !== "ignore-duplicate") {
    fail(`Inbox ${inbox.id} was already handled`);
  }

  if (action.type === "accept") {
    if (inbox.kind !== "human") fail("accept requires a human request");
    if (action.traceId !== inbox.traceId || action.taskId !== inbox.taskId) fail("accept must preserve the supplied trace and task");
    if (action.replyTo !== inbox.messageId) fail("accept must reply to the incoming human message");
    requireText(action.owner, "owner");
    requireText(action.expectedProof, "expectedProof");
    requireText(action.response, "response");
    if (state.requests.some((request) => request.traceId === action.traceId || request.taskId === action.taskId)) {
      fail("accept would create a duplicate request or task");
    }
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: action.traceId, text: inbox.text });
    state.requests.push({
      traceId: action.traceId,
      taskId: action.taskId,
      subject: inbox.subject,
      intent: inbox.outcome,
      owner: action.owner,
      expectedProof: action.expectedProof,
      status: "working",
      originalHumanMessageId: inbox.messageId,
      evidence: [],
      nextCondition: action.expectedProof,
    });
  } else if (action.type === "closeout") {
    if (inbox.kind !== "owner-completion") fail("closeout requires an owner completion");
    const request = state.requests.find((item) => item.taskId === inbox.taskId);
    if (!request || request.traceId !== action.traceId || action.taskId !== inbox.taskId) fail("closeout must use the owner task's trace");
    if (action.completionId !== inbox.completionId) fail("closeout must identify this completion");
    if (state.reviewedCompletionIds.includes(inbox.completionId)) fail("completion was already reviewed");
    const latest = latestHumanMessage(state, request.traceId);
    if (action.replyTo !== latest?.id) fail("closeout must reply to the latest human message in the request trace");
    requireText(action.response, "response");
    request.status = "done";
    request.evidence = inbox.evidence || [];
    state.reviewedCompletionIds.push(inbox.completionId);
  } else if (action.type === "clarify") {
    if (inbox.kind !== "human") fail("clarify requires human input");
    if (action.replyTo !== inbox.messageId) fail("clarification must reply to the incoming message");
    if (!Array.isArray(action.candidateTraceIds) || action.candidateTraceIds.length < 2) fail("clarification must name the plausible requests");
    requireText(action.response, "response");
  } else if (action.type === "stop") {
    if (inbox.kind !== "human") fail("stop requires human input");
    const anchor = state.messages.find((message) => message.id === inbox.replyTo)?.traceId;
    const request = state.requests.find((item) => item.traceId === action.traceId && item.taskId === action.taskId);
    if (!request || action.traceId !== anchor) fail("stop must target the request anchored by the human reply");
    if (action.replyTo !== inbox.messageId) fail("stop response must reply to the correction");
    requireText(action.response, "response");
    request.status = "stopped";
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: request.traceId, text: inbox.text });
  } else if (action.type === "ignore-duplicate") {
    if (inbox.kind !== "owner-completion" || !inbox.duplicateOf) fail("ignore-duplicate requires duplicate completion evidence");
    if (!state.reviewedCompletionIds.includes(inbox.duplicateOf)) fail("the original completion was not reviewed");
    if (action.humanResponse) fail("duplicate completion must not notify the human");
  } else if (action.type === "status") {
    if (inbox.kind !== "human") fail("status requires human input");
    const request = state.requests.find((item) => item.traceId === action.traceId && item.taskId === action.taskId);
    if (!request) fail("status must identify an existing request");
    if (action.replyTo !== inbox.messageId) fail("status must reply to the incoming message");
    requireText(action.response, "response");
    state.messages.push({ id: inbox.messageId, seq: inbox.seq, actor: "human", traceId: request.traceId, text: inbox.text });
  } else {
    fail(`Unsupported action type: ${action.type}`);
  }

  state.handledInboxIds.push(inbox.id);
  action.inboxId = inbox.id;
  action.appliedAt = new Date().toISOString();
  appendAction(action);
  writeJson(statePath, state);
  process.stdout.write(`${JSON.stringify({ accepted: true, action }, null, 2)}\n`);
}

const command = process.argv[2];
if (command === "inspect") inspect();
else if (command === "apply") apply(process.argv[3] || "proposed-action.json");
else {
  process.stdout.write("Use `node conversation-sim.cjs inspect`, then write proposed-action.json and run `node conversation-sim.cjs apply proposed-action.json`. Supported actions: accept, closeout, clarify, stop, ignore-duplicate, status.\n");
}

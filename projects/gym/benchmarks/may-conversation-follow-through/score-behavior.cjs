"use strict";

const fs = require("node:fs");
const path = require("node:path");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readActions(workDir) {
  const file = path.join(workDir, "conversation-actions.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(JSON.parse);
}

function result(mode, workDir) {
  const checks = [];
  const state = readJson(path.join(workDir, "conversation-state.json"));
  const actions = readActions(workDir);
  const transcript = fs.existsSync(path.join(workDir, "transcript.jsonl"))
    ? fs.readFileSync(path.join(workDir, "transcript.jsonl"), "utf8")
    : "";
  const check = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });

  check("used-conversation-runtime", /conversation-sim\.cjs[^\n]*(inspect|apply)/i.test(transcript), "May must inspect and act through the isolated runtime");

  if (mode === "core") {
    const replies = state.requests.find((item) => item.traceId === "trace-replies");
    const gym = state.requests.find((item) => item.traceId === "trace-gym");
    const acceptReplies = actions.find((item) => item.type === "accept" && item.traceId === "trace-replies");
    const acceptGym = actions.find((item) => item.type === "accept" && item.traceId === "trace-gym");
    const closeouts = actions.filter((item) => item.type === "closeout" && item.traceId === "trace-replies");
    check("separate-request-threads", replies && gym && replies.taskId !== gym.taskId, "Both human requests retain distinct traces and tasks");
    check("durable-owner-acceptance", acceptReplies?.owner === "may-agent platform owner" && acceptGym?.owner === "Gym app", "Both long requests preserve their accountable app owners");
    check("proof-before-promise", /root cause/i.test(acceptReplies?.expectedProof || "") && /regression/i.test(acceptReplies?.expectedProof || "") && /replay|live/i.test(acceptReplies?.expectedProof || ""), "Repeated-reply acknowledgement names terminal proof");
    check("one-closeout", closeouts.length === 1, `Observed ${closeouts.length} repeated-reply closeouts`);
    check("completion-routed-by-task", closeouts[0]?.taskId === "task-replies" && closeouts[0]?.replyTo === 101, "Lost-session completion returns to the original request, not current Gym work");
    check("verified-closeout", replies?.status === "done" && Array.isArray(replies?.evidence) && replies.evidence.length >= 3, "Closeout records owner evidence");
    check("other-work-preserved", gym?.status === "working", "Concurrent Gym request remains active");
    check("plain-useful-closeout", /done|fixed|resolved/i.test(closeouts[0]?.response || "") && /regression|replay|restart/i.test(closeouts[0]?.response || ""), "Closeout states outcome and proof in plain language");
    check("human-action-declared", closeouts[0]?.humanAction === "none", "Closeout declares whether Hao must act; semantic judges check that the response communicates it");
  } else if (mode === "transfer") {
    const replies = state.requests.find((item) => item.traceId === "trace-replies");
    const gym = state.requests.find((item) => item.traceId === "trace-gym");
    const clarification = actions.find((item) => item.type === "clarify");
    const stop = actions.find((item) => item.type === "stop");
    const duplicate = actions.find((item) => item.type === "ignore-duplicate");
    const status = actions.find((item) => item.type === "status");
    check("clarify-real-ambiguity", clarification?.candidateTraceIds?.length === 2, "Bare continue identifies both plausible requests");
    check("focused-correction", stop?.traceId === "trace-replies" && replies?.status === "stopped", "Reply-anchored stop changes only the repeated-reply request");
    check("keep-unrelated-work", gym?.status === "working", "Gym training remains active after the other request stops");
    check("suppress-duplicate", duplicate && !duplicate.humanResponse, "Duplicate owner completion creates no human reply");
    check("named-status", status?.traceId === "trace-gym" && status?.replyTo === 303, "Named status resolves Gym without relying on a session");
    check("status-human-action", status?.humanAction === "none", "Gym status declares whether Hao must act; semantic judges check that the response communicates it");
    check("status-is-useful", /working|running|active|progress/i.test(status?.response || "") && /next|proof|condition|pass|decision/i.test(status?.response || ""), "Status includes current phase and next closure condition");
  } else {
    check("known-mode", false, `Unknown behavior scorer mode: ${mode}`);
  }

  const passed = checks.every((item) => item.passed);
  return { scenario: `may-conversation-follow-through-${mode}`, passed, checks, summary: `${passed ? "PASS" : "FAIL"}: ${checks.filter((item) => item.passed).length}/${checks.length} behavior checks` };
}

module.exports = { scoreBehavior: result };

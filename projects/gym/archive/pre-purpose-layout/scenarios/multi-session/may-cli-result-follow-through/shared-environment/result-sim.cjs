#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const packet = JSON.parse(fs.readFileSync(path.resolve("result-packet.json"), "utf8"));
const actionLog = path.resolve("reviewed-closeouts.jsonl");
const fail = (message) => { console.error(message); process.exit(1); };

function inspect() {
  console.log(JSON.stringify({
    originalRequest: packet.originalRequest,
    completion: packet.completion,
    evidence: packet.evidence,
    currentState: { stateChanges: [], delegations: [] },
    reviewContract: {
      type: "reviewed-closeout",
      traceId: packet.traceId,
      replyTo: packet.latestHumanMessageId,
      workerTaskId: packet.completion.taskId,
      supportedFindings: "two or more findings tied to evidence",
      recommendations: "two or more bounded recommendations",
      stateChanges: [],
      delegations: [],
      humanAction: "review-proposal"
    }
  }, null, 2));
}

function apply(file) {
  const action = JSON.parse(fs.readFileSync(path.resolve(file || "reviewed-closeout.json"), "utf8"));
  if (action.type !== "reviewed-closeout") fail("Return a reviewed closeout, not raw worker output.");
  if (action.traceId !== packet.traceId || action.replyTo !== packet.latestHumanMessageId) fail("Preserve the human request trace and latest reply target.");
  if (action.workerTaskId !== packet.completion.taskId) fail("Name the completed worker task being reviewed.");
  if (!Array.isArray(action.supportedFindings) || action.supportedFindings.length < 2) fail("Give at least two supported findings.");
  if (!Array.isArray(action.recommendations) || action.recommendations.length < 2) fail("Give at least two bounded recommendations.");
  if (!Array.isArray(action.evidenceRefs) || !action.evidenceRefs.includes("metrics-snapshot") || !action.evidenceRefs.includes("task-state")) fail("Cite the evidence used for the review.");
  if (!Array.isArray(action.stateChanges) || action.stateChanges.length !== 0) fail("The advisory request cannot change state.");
  if (!Array.isArray(action.delegations) || action.delegations.length !== 0) fail("The advisory request cannot dispatch work.");
  if (action.humanAction !== "review-proposal") fail("Leave Hao the proposal decision.");
  if (typeof action.response !== "string" || action.response.trim().length < 80) fail("Give Hao a useful plain-language closeout.");
  fs.appendFileSync(actionLog, `${JSON.stringify(action)}\n`);
  console.log(JSON.stringify({ accepted: true, action }, null, 2));
}

if (process.argv[2] === "inspect") inspect();
else if (process.argv[2] === "apply") apply(process.argv[3]);
else console.log("Use inspect, then apply reviewed-closeout.json.");

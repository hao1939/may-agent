#!/usr/bin/env node
"use strict";

const { isDeepStrictEqual } = require("node:util");
const candidate = require("./conversation-view.cjs");
const baseline = require("./legacy-session-model.cjs");
const cases = require("./cases.cjs");

function execute(engine, testCase) {
  const { state, operation } = testCase;
  if (operation.type === "resolve") return engine.resolveFocus(state, operation.incoming);
  if (operation.type === "complete") return engine.routeCompletion(state, operation.completion);
  if (operation.type === "reply-target") return engine.selectReplyTarget(state, operation.input);
  throw new Error(`Unknown operation: ${operation.type}`);
}

function matches(actual, expected) {
  if (expected === null || typeof expected !== "object") return isDeepStrictEqual(actual, expected);
  if (actual === null || typeof actual !== "object") return false;
  return Object.entries(expected).every(([key, value]) => isDeepStrictEqual(actual[key], value));
}

function run(engine) {
  return cases.map((testCase) => {
    let actual;
    let error = null;
    try {
      actual = execute(engine, testCase);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    return {
      id: testCase.id,
      partition: testCase.partition,
      passed: !error && matches(actual, testCase.expected),
      expected: testCase.expected,
      actual: error ? { error } : actual,
    };
  });
}

function summarize(name, results) {
  return {
    name,
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    criticalFailures: results.filter((result) => !result.passed).map((result) => result.id),
    cases: results,
  };
}

const report = {
  benchmark: "may-conversation-follow-through-poc",
  generatedAt: new Date().toISOString(),
  productionChanged: false,
  baseline: summarize("current-session-routing-model", run(baseline)),
  candidate: summarize("trace-conversation-view-poc", run(candidate)),
};
report.recommendation = report.candidate.passed === report.candidate.total
  ? "Continue to May behavior trials; keep production routing unchanged."
  : "Revise the POC before May behavior trials.";

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.candidate.passed === report.candidate.total ? 0 : 1;

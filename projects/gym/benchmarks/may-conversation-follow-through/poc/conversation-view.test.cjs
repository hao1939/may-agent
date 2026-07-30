#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

const output = execFileSync(process.execPath, [join(__dirname, "run-poc.cjs")], { encoding: "utf8" });
const report = JSON.parse(output);
if (report.candidate.passed !== report.candidate.total) {
  throw new Error(`Candidate failed: ${report.candidate.criticalFailures.join(", ")}`);
}
if (report.baseline.passed >= report.candidate.passed) {
  throw new Error("POC does not improve over the session-routing baseline model");
}
if (report.productionChanged !== false) throw new Error("POC must remain isolated");
console.log(`PASS candidate ${report.candidate.passed}/${report.candidate.total}; baseline ${report.baseline.passed}/${report.baseline.total}`);

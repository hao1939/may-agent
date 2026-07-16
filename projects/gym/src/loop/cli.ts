#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { renderReport } from "./report";
import { renderRescore, rescoreRun } from "./rescore";
import { appendAdjudication, readManifest, resolveRunDir } from "./store";
import { runLoop, verifyLoop } from "./run";
import type { HumanVerdict, ReviewClassification, ReviewReasonCode } from "./types";

interface Args {
  command: string;
  benchmark: string;
  scenarios: string[];
  agent: string;
  candidate: string;
  trials: number;
  baseline: string;
  run: string;
  reviewer: string;
  reason: string;
  verdict: string;
  classification: string;
  reasonCodes: string[];
  trial: number;
  timeout?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[2] ?? "",
    benchmark: "may-alignment",
    scenarios: [],
    agent: "may",
    candidate: "baseline",
    trials: 0,
    baseline: "",
    run: "",
    reviewer: "",
    reason: "",
    verdict: "",
    classification: "",
    reasonCodes: [],
    trial: 0,
  };
  for (let index = 3; index < argv.length; index++) {
    const key = argv[index];
    const value = argv[index + 1];
    switch (key) {
      case "--benchmark": args.benchmark = value; index++; break;
      case "--scenario": args.scenarios.push(value); index++; break;
      case "--agent": args.agent = value; index++; break;
      case "--candidate": args.candidate = value; index++; break;
      case "--trials": args.trials = Number(value); index++; break;
      case "--baseline": args.baseline = value; index++; break;
      case "--run": args.run = value; index++; break;
      case "--reviewer": args.reviewer = value; index++; break;
      case "--reason": args.reason = value; index++; break;
      case "--verdict": args.verdict = value; index++; break;
      case "--classification": args.classification = value; index++; break;
      case "--reason-code": args.reasonCodes.push(value); index++; break;
      case "--trial": args.trial = Number(value); index++; break;
      case "--timeout": args.timeout = Number(value); index++; break;
      default: throw new Error(`Unknown argument: ${key}`);
    }
  }
  return args;
}

function usage(): never {
  console.error(`Usage:
  bun run loop -- test [--benchmark may-alignment] [--scenario ID] [--trials 3]
  bun run loop -- verify --baseline RUN_ID --candidate LAB_FORK [--trials 3]
  bun run loop -- review --run RUN_ID --scenario ID --trial N --verdict pass|fail --reviewer NAME --reason TEXT [--classification may-behavior|ground-truth|scorer|harness|unclear] [--reason-code CODE]
  bun run loop -- rescore --run RUN_ID
  bun run loop -- report --run RUN_ID`);
  process.exit(1);
}

const args = parseArgs(process.argv);

switch (args.command) {
  case "test": {
    const trials = args.trials || 3;
    if (!Number.isInteger(trials) || trials < 1) throw new Error("--trials must be a positive integer");
    const created = await runLoop({
      phase: "test",
      benchmark: args.benchmark,
      scenarios: args.scenarios,
      agent: args.agent,
      candidate: args.candidate,
      trials,
      timeout: args.timeout,
    });
    console.log(created.runDir);
    break;
  }
  case "verify": {
    if (!args.baseline || args.candidate === "baseline") usage();
    const verified = await verifyLoop({
      baseline: args.baseline,
      candidate: args.candidate,
      trials: args.trials || undefined,
      timeout: args.timeout,
    });
    console.log(verified.runDir);
    if (verified.comparison.gate === "fail") process.exitCode = 1;
    if (verified.comparison.gate === "needs-human-review") process.exitCode = 2;
    break;
  }
  case "review": {
    if (!args.run || args.scenarios.length !== 1 || !args.trial || !args.reviewer || !args.reason) usage();
    const verdict = args.verdict.replaceAll("-", "_");
    const classification = args.classification.replaceAll("-", "_");
    const verdicts = ["pass", "fail"];
    const classifications = ["may_behavior", "ground_truth", "scorer", "harness", "unclear"];
    const reasonCodes = [
      "intent_misread", "preference_missed", "local_guidance_violated", "unsafe_action", "wrong_owner",
      "unnecessary_work", "missing_evidence", "missing_verification", "over_clarification",
      "under_clarification", "too_verbose", "acceptable_alternative", "ground_truth_wrong",
      "scorer_false_positive", "scorer_false_negative", "fixture_problem", "harness_problem",
    ];
    if (!verdicts.includes(verdict)) usage();
    if (classification && !classifications.includes(classification)) usage();
    if (args.reasonCodes.some((code) => !reasonCodes.includes(code.replaceAll("-", "_")))) usage();
    if (verdict === "fail" && !classification) {
      throw new Error("--classification is required for fail reviews");
    }
    const runDir = resolveRunDir(args.run);
    const manifest = readManifest(runDir);
    const scenario = args.scenarios[0]!;
    if (!manifest.trials.some((trial) => trial.scenario === scenario && trial.trial === args.trial)) {
      throw new Error(`Trial not found: ${scenario} trial ${args.trial}`);
    }
    appendAdjudication(runDir, {
      schema_version: 1,
      run_id: manifest.run_id,
      scenario,
      trial: args.trial,
      verdict: verdict as HumanVerdict,
      ...(classification ? { classification: classification as ReviewClassification } : {}),
      ...(args.reasonCodes.length
        ? { reason_codes: args.reasonCodes.map((code) => code.replaceAll("-", "_") as ReviewReasonCode) }
        : {}),
      reviewer: args.reviewer,
      reason: args.reason,
      created_at: new Date().toISOString(),
    });
    renderReport(runDir, manifest);
    console.log(runDir);
    break;
  }
  case "report": {
    if (!args.run) usage();
    const runDir = resolveRunDir(args.run);
    const comparisonPath = join(runDir, "comparison.json");
    const comparison = existsSync(comparisonPath)
      ? JSON.parse(readFileSync(comparisonPath, "utf-8"))
      : undefined;
    console.log(renderReport(runDir, readManifest(runDir), comparison));
    break;
  }
  case "rescore": {
    if (!args.run) usage();
    console.log(renderRescore(rescoreRun(args.run)));
    break;
  }
  default: usage();
}

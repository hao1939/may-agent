#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { renderReport } from "./report";
import { appendAdjudication, readManifest, resolveRunDir } from "./store";
import { runLoop, verifyLoop } from "./run";
import type { HumanVerdict } from "./types";

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
  bun run loop -- review --run RUN_ID --scenario ID --trial N --verdict pass|fail|invalid --reviewer NAME --reason TEXT
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
    if (!(["pass", "fail", "invalid"] as string[]).includes(args.verdict)) usage();
    const runDir = resolveRunDir(args.run);
    const manifest = readManifest(runDir);
    const scenario = args.scenarios[0]!;
    if (!manifest.trials.some((trial) => trial.scenario === scenario && trial.trial === args.trial)) {
      throw new Error(`Trial not found: ${scenario} trial ${args.trial}`);
    }
    appendAdjudication(runDir, {
      run_id: manifest.run_id,
      scenario,
      trial: args.trial,
      verdict: args.verdict as HumanVerdict,
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
  default: usage();
}

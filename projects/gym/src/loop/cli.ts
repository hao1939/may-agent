#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseComparisonObjective } from "./objective";
import { findOwnedCase, resolveBenchmarkName } from "../cases/catalog";
import { renderReport } from "./report";
import { renderRescore, rescoreRun } from "./rescore";
import {
  appendAdjudication,
  gymRoot,
  loadSuite,
  readManifest,
  resolveRunDir,
  selectCoreScenarios,
} from "./store";
import { runLoop, verifyLoop } from "./run";
import { loadPlan } from "../plans/plan";
import type {
  HumanVerdict,
  ReviewClassification,
  ReviewReasonCode,
} from "./types";

interface Args {
  planPath?: string;
  command: string;
  core: boolean;
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
  objective?: string;
  minReductionPercent?: number;
}

function parseArgs(argv: string[]): Args {
  let explicitBenchmark = false;
  const args: Args = {
    command: argv[2] ?? "",
    core: false,
    benchmark: "intent-and-follow-through",
    scenarios: [],
    agent: "",
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
    const key = argv[index]!;
    const value = argv[index + 1]!;
    switch (key) {
      case "--plan":
        if (!value || value.startsWith("--")) throw new Error("--plan requires an evaluation-plan.json path");
        args.planPath = value;
        index++;
        break;
      case "--benchmark":
        args.benchmark = value;
        explicitBenchmark = true;
        index++;
        break;
      case "--case":
      case "--scenario":
        args.scenarios.push(value);
        index++;
        break;
      case "--core":
        args.core = true;
        break;
      case "--agent":
      case "--target":
        args.agent = value;
        index++;
        break;
      case "--candidate":
      case "--lab":
        args.candidate = value;
        index++;
        break;
      case "--trials":
        args.trials = Number(value);
        index++;
        break;
      case "--baseline":
        args.baseline = value;
        index++;
        break;
      case "--run":
        args.run = value;
        index++;
        break;
      case "--reviewer":
        args.reviewer = value;
        index++;
        break;
      case "--reason":
        args.reason = value;
        index++;
        break;
      case "--verdict":
        args.verdict = value;
        index++;
        break;
      case "--classification":
        args.classification = value;
        index++;
        break;
      case "--reason-code":
        args.reasonCodes.push(value);
        index++;
        break;
      case "--trial":
        args.trial = Number(value);
        index++;
        break;
      case "--objective":
        if (!value || value.startsWith("--")) {
          throw new Error(
            "--objective requires quality, duration_ms, total_tokens, or ops",
          );
        }
        args.objective = value;
        index++;
        break;
      case "--min-reduction-percent":
        args.minReductionPercent = Number(value);
        index++;
        break;
      case "--timeout":
        args.timeout = Number(value);
        index++;
        break;
      default:
        if (
          !key.startsWith("-") &&
          (args.command === "report" || args.command === "rescore") &&
          !args.run
        ) {
          args.run = key;
          break;
        }
        throw new Error(`Unknown argument: ${key}`);
    }
  }
  if (
    !explicitBenchmark &&
    args.scenarios.length > 0 &&
    args.command === "test"
  ) {
    const owners = args.scenarios.map((id) => {
      const owner = findOwnedCase(gymRoot, id);
      if (!owner)
        throw new Error(
          `Case ${id} is not in an active benchmark; legacy cases remain in archive/pre-purpose-layout and may be run diagnostically with gym run`,
        );
      return owner.benchmark;
    });
    if (new Set(owners).size !== 1)
      throw new Error(
        "Selected cases belong to different benchmarks; run each purpose benchmark separately",
      );
    args.benchmark = owners[0]!;
  }
  return args;
}

function usage(): never {
  console.error(`Usage:
  bun run gym test [--plan PATH] [--benchmark PURPOSE] [--core | --case ID] --target <agent|owner/workflow> [--trials 3] [--objective quality|duration_ms|total_tokens|ops --min-reduction-percent 20]
  bun run gym verify [--plan PATH] --baseline RUN_ID --candidate LAB_FORK [--trials 3]
  bun run gym:plan <validate|report> PATH [--runs RETAINED_BENCHMARKS_DIR] [--json]
  bun run gym review --run RUN_ID --case ID --trial N --verdict pass|fail --reviewer NAME --reason TEXT [--classification may-behavior|ground-truth|scorer|harness|unclear] [--reason-code CODE]
  bun run gym rescore [--run] RUN_ID
  bun run gym report [--run] RUN_ID`);
  process.exit(1);
}

export async function executeLoopCli(
  argv: string[] = process.argv,
): Promise<void> {
  const args = parseArgs(argv);
  if (args.planPath) {
    if (!["test", "verify"].includes(args.command)) throw new Error("--plan commissions test or verify runs only");
    const plan = loadPlan(args.planPath, gymRoot);
    args.agent ||= plan.evaluation.target;
    args.trials ||= plan.evaluation.trials;
    args.timeout ??= plan.evaluation.timeout_minutes;
  }
  if (args.core && (args.command !== "test" || args.scenarios.length > 0)) {
    throw new Error(
      "--core selects a test baseline; do not combine it with --case (--scenario is the old alias). Verification inherits the frozen selection.",
    );
  }
  if (
    args.command !== "test" &&
    (args.objective !== undefined || args.minReductionPercent !== undefined)
  ) {
    throw new Error(
      "Declare the comparison objective with test; verify inherits the frozen baseline objective",
    );
  }

  switch (args.command) {
    case "test": {
      const trials = args.trials || 3;
      if (!Number.isInteger(trials) || trials < 1)
        throw new Error("--trials must be a positive integer");
      args.benchmark = resolveBenchmarkName(gymRoot, args.benchmark);
      const { suite } = loadSuite(args.benchmark);
      const target =
        args.agent || (!suite.purpose ? suite.defaults?.agent_type : undefined);
      if (!target && suite.purpose)
        throw new Error(
          "--target is required: choose the agent or workflow for this purpose benchmark",
        );
      const created = await runLoop({
        planPath: args.planPath,
        phase: "test",
        objective: parseComparisonObjective({
          metric: args.objective ?? "quality",
          ...(args.minReductionPercent !== undefined
            ? { min_reduction_percent: args.minReductionPercent }
            : {}),
        }),
        benchmark: args.benchmark,
        scenarios: args.core ? selectCoreScenarios(suite) : args.scenarios,
        agent: target || "may",
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
        planPath: args.planPath,
        baseline: args.baseline,
        candidate: args.candidate,
        trials: args.trials || undefined,
        timeout: args.timeout,
      });
      console.log(verified.runDir);
      if (verified.comparison.gate === "fail") process.exitCode = 1;
      if (verified.comparison.gate === "needs-human-review")
        process.exitCode = 2;
      break;
    }
    case "review": {
      if (
        !args.run ||
        args.scenarios.length !== 1 ||
        !args.trial ||
        !args.reviewer ||
        !args.reason
      )
        usage();
      const verdict = args.verdict.replaceAll("-", "_");
      const classification = args.classification.replaceAll("-", "_");
      const verdicts = ["pass", "fail"];
      const classifications = [
        "may_behavior",
        "ground_truth",
        "scorer",
        "harness",
        "unclear",
      ];
      const reasonCodes = [
        "intent_misread",
        "preference_missed",
        "local_guidance_violated",
        "unsafe_action",
        "wrong_owner",
        "unnecessary_work",
        "missing_evidence",
        "missing_verification",
        "over_clarification",
        "under_clarification",
        "too_verbose",
        "acceptable_alternative",
        "ground_truth_wrong",
        "scorer_false_positive",
        "scorer_false_negative",
        "fixture_problem",
        "harness_problem",
      ];
      if (!verdicts.includes(verdict)) usage();
      if (classification && !classifications.includes(classification)) usage();
      if (
        args.reasonCodes.some(
          (code) => !reasonCodes.includes(code.replaceAll("-", "_")),
        )
      )
        usage();
      if (verdict === "fail" && !classification) {
        throw new Error("--classification is required for fail reviews");
      }
      const runDir = resolveRunDir(args.run);
      const manifest = readManifest(runDir);
      const scenario = args.scenarios[0]!;
      if (
        !manifest.trials.some(
          (trial) => trial.scenario === scenario && trial.trial === args.trial,
        )
      ) {
        throw new Error(`Trial not found: ${scenario} trial ${args.trial}`);
      }
      appendAdjudication(runDir, {
        schema_version: 1,
        run_id: manifest.run_id,
        scenario,
        trial: args.trial,
        verdict: verdict as HumanVerdict,
        ...(classification
          ? { classification: classification as ReviewClassification }
          : {}),
        ...(args.reasonCodes.length
          ? {
              reason_codes: args.reasonCodes.map(
                (code) => code.replaceAll("-", "_") as ReviewReasonCode,
              ),
            }
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
    default:
      usage();
  }
}

if (import.meta.main) {
  await executeLoopCli(process.argv);
}

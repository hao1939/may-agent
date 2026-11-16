import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { compareRuns, renderReport } from "../src/loop/report";
import { rescoreRun } from "../src/loop/rescore";
import { loadSuite, materializeScenarioOrInlineCase, storeTrial } from "../src/loop/store";
import type { BenchmarkSuite, GroundTruthCatalog, LoopRunManifest, TrialUsageTelemetry } from "../src/loop/types";
import { loadTranscript, usageSummary } from "../src/scoring/transcript-utils";
import { withTempDir } from "./support/temp-dir";
import { fingerprintValue } from "../src/loop/store";

const project = resolve(import.meta.dirname, "..");
const { scoreDecision } = require("../benchmarks/intent-and-follow-through/score-decision.cjs");

function save(root: string, file: string, content: unknown): void {
  const dest = join(root, file);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, typeof content === "string" ? content : JSON.stringify(content));
}

function judgment(root: string) {
  const scenario = join(root, "scenario"), work = join(root, "work");
  save(scenario, "environment/proposals/review.md", "Original review input\n");
  save(scenario, "expected.json", { exact: { needs_clarification: false } });
  cpSync(join(scenario, "environment"), work, { recursive: true });
  save(work, "task-result.json", {
    state: "converged", summary: "Give a bounded design recommendation.", facts: [],
  });
  return { scenario, work };
}

describe("judgment is not a prose-only pass", () => {
  test("the assignment's actual result state must match the draft expectation", () => withTempDir((root) => {
    const { suite } = loadSuite("outcome-completion");
    const scenario = join(root, "scenario"), work = join(root, "work");
    materializeScenarioOrInlineCase({
      scenario: "alex-judge-helper-recommendation-not-completion", suite,
      sourceBenchmarkDir: join(project, "benchmarks/outcome-completion"),
      evaluatorOwner: null, destination: scenario,
    });
    const result = {
      state: "waiting",
      summary: "Accept Bob's advice as progress, then implement the repair and verify notification.test.ts. This assignment remains unfinished; Task closure is separate.",
      facts: ["Bob's design review returned; implementation and the regression test are outstanding."],
    };
    save(work, "task-result.json", result);
    expect(scoreDecision(work, scenario).passed).toBe(true);
    save(work, "task-result.json", { ...result, state: "converged" });
    const scored = scoreDecision(work, scenario);
    expect(scored.checks.find((c: any) => c.name === "production-task-contract").passed).toBe(true);
    expect(scored.checks.find((c: any) => c.name === "one-of:task_result.state").passed).toBe(false);
    expect(scored.passed).toBe(false);
  }));

  test("unchanged fixture and runner artifacts are allowed", () => withTempDir((root) => {
    const { work, scenario } = judgment(root);
    save(work, "transcript.jsonl", "{\"role\":\"assistant\"}\n");
    save(work, "agents/fixture-agent/AGENTS.md", "Adapter-staged identity\n");
    expect(scoreDecision(work, scenario).passed).toBe(true);
  }));

  for (const change of ["edit", "delete", "nested-create", "new-source-dir", "replace-with-link"] as const) {
    test(`decision-only workspace rejects ${change}`, () => withTempDir((root) => {
      const { work, scenario } = judgment(root);
      if (change === "edit") save(work, "proposals/review.md", "Implemented without authority\n");
      if (change === "delete") rmSync(join(work, "proposals/review.md"));
      if (change === "nested-create") save(work, "proposals/implementation.md", "Unexpected work\n");
      if (change === "new-source-dir") save(work, "src/implementation.ts", "export {};\n");
      if (change === "replace-with-link") {
        rmSync(join(work, "proposals/review.md"));
        symlinkSync(join(scenario, "environment/proposals/review.md"), join(work, "proposals/review.md"));
      }
      const result = scoreDecision(work, scenario);
      expect(result.passed).toBe(false);
      expect(result.checks.find((c: any) => c.name === "decision-only-scope").passed).toBe(false);
    }));
  }
});

describe("real runner frozen input boundary", () => {
  test("inline execution uses the retained task, fixture, truth, and selected evaluator", () => withTempDir((root) => {
    const { suite } = loadSuite("adoption-and-simplicity");
    const id = "bob-judge-converge-duplicate-entry-points"; // Deliberately deterministic: no model calls.
    const inputs = join(root, "inputs"), scenario = join(inputs, "scenarios", id);
    materializeScenarioOrInlineCase({ scenario: id, suite,
      sourceBenchmarkDir: join(project, "benchmarks/adoption-and-simplicity"),
      evaluatorOwner: null, destination: scenario });
    save(scenario, "task.md", "FROZEN_ONLY_SENTINEL: review this retained fixture.\n");
    save(scenario, "expected.json", { marker: "retained-truth" });
    save(scenario, "environment/retained.txt", "retained-fixture");
    save(inputs, "benchmarks/intent-and-follow-through/score-decision.cjs", `
      const fs=require('node:fs'),path=require('node:path');
      exports.scoreDecision=(work,scenario)=>({passed:true,checks:[{
        name:'retained-evaluator',passed:
          fs.readFileSync(path.join(work,'captured-task.txt'),'utf8').includes('FROZEN_ONLY_SENTINEL') &&
          fs.readFileSync(path.join(work,'retained.txt'),'utf8')==='retained-fixture' &&
          JSON.parse(fs.readFileSync(path.join(scenario,'expected.json'),'utf8')).marker==='retained-truth'
      }],summary:'retained evaluation'});
    `);
    save(root, "capture.cjs", "require('node:fs').copyFileSync(process.argv[2], 'captured-task.txt');");
    const child = Bun.spawnSync(["bun", join(project, "src/cli.ts"), id, "--adapter", "generic", "--agent", "bob", "--json"], {
      cwd: project, env: { ...process.env, GYM_SCENARIOS_DIR: join(inputs, "scenarios"),
        GYM_AGENT_CMD: `node ${join(root, "capture.cjs")}` }, stdout: "pipe", stderr: "pipe",
    });
    const result = JSON.parse(child.stdout.toString());
    try {
      expect(child.exitCode).toBe(0);
      expect(result.checks).toEqual([{ name: "retained-evaluator", passed: true }]);
      expect(readFileSync(join(result.work_dir, "captured-task.txt"), "utf8")).toContain("FROZEN_ONLY_SENTINEL");
      // A generic executor without a transcript must not claim measured zero usage.
      expect(result.usage.tokens_measured).toBe(false);
      expect(result.usage.ops_measured).toBe(false);
    } finally {
      if (result.gym_root) rmSync(result.gym_root, { recursive: true, force: true });
    }
  }));
});

const labels: GroundTruthCatalog = { version: 1, benchmark: "fixture", labels: { case: {
  status: "approved", source: "synthetic", rationale: "Synthetic contract fixture only",
  approved_by: "fixture-reviewer", approved_at: "2026-01-01T00:00:00Z",
} } };
const usage: TrialUsageTelemetry = { turns: 2, ops: 2, total_tokens: 100, input_tokens: 80, output_tokens: 20, cost_usd: 0 };
function run(candidate: boolean): LoopRunManifest {
  return {
    schema_version: 2, run_id: candidate ? "candidate" : "baseline", phase: candidate ? "verify" : "test",
    benchmark: "fixture", benchmark_version: 1, baseline_run_id: candidate ? "baseline" : null,
    comparison_objective: { metric: "total_tokens", min_reduction_percent: 10 },
    candidate: candidate ? "candidate" : "baseline", agent: "fixture", trials_per_scenario: 1,
    scenarios: ["case"], evaluation_kinds: { case: "judgment" },
    started_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:01:00Z",
    proof: { input_fingerprint: "input", label_set_fingerprint: "labels", label_catalog_fingerprint: fingerprintValue(labels),
      candidate_fingerprint: candidate ? "candidate" : null, semantic_judging: false, semantic_judge_fingerprint: null,
      harness_fingerprint: "harness", agent_prompt_fingerprints: ["prompt"], framework_revisions: ["framework"], models: ["model"] },
    source: { suite_path: "suite.json", labels_path: "labels.json", suite_snapshot: "inputs/suite.json", labels_snapshot: "inputs/labels.json",
      evaluator_snapshot: null, semantic_judges_snapshot: null, harness_snapshot: "inputs/harness", scenarios_snapshot: "inputs/scenarios", candidate_snapshot: candidate ? "candidate" : null },
    trials: [{ scenario: "case", trial: 1, machine_verdict: "pass", invalid_reason: null, label_status: "approved",
      result_path: "cases/case/trial-1/result.json", artifact_path: null, transcript_path: null, duration_ms: 100,
      usage: { ...usage, total_tokens: candidate ? 50 : 100 },
      provenance: { prompt_fingerprint: "prompt", framework_revision: "framework", model: "model" } }],
  };
}

describe("efficiency evidence is measured, not invented", () => {
  test("complete nonnegative telemetry supports a token reduction", () => {
    expect(compareRuns(run(false), run(true), labels).gate).toBe("pass");
  });
  for (const bad of [-10, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    test(`invalid counter ${bad} cannot support an efficiency pass`, () => {
      for (const key of ["total_tokens", "ops", "turns"] as const) {
        const candidate = run(true);
        candidate.trials[0]!.usage![key] = bad;
        const compared = compareRuns(run(false), candidate, labels);
        expect(compared.gate).toBe("needs-human-review");
        expect(compared.objective_met).toBeNull();
      }
    });
  }
  test("missing and partial token records are unknown, not zero", () => withTempDir((root) => {
    for (const entries of [
      [{ note: "no session transcript available" }],
      [{ role: "assistant", content: [] }],
      [{ role: "assistant", usage: { totalTokens: 10 } }, { role: "assistant" }],
      [{ type: "turn.completed", usage: {} }],
    ]) {
      save(root, "transcript.jsonl", entries.map((entry) => JSON.stringify(entry)).join("\n"));
      const observed = usageSummary(loadTranscript(join(root, "transcript.jsonl"))!);
      expect(observed.tokens_measured).toBe(false);
      const candidate = run(true);
      candidate.trials[0]!.usage = observed;
      expect(compareRuns(run(false), candidate, labels).gate).toBe("needs-human-review");
    }
    save(root, "transcript.jsonl", JSON.stringify({ role: "assistant", usage: { totalTokens: 0 } }));
    expect(usageSummary(loadTranscript(join(root, "transcript.jsonl"))!).tokens_measured).toBe(true);
    save(root, "transcript.jsonl", '{"role":"assistant","usage":{"totalTokens":10}}\nmalformed');
    const partial = usageSummary(loadTranscript(join(root, "transcript.jsonl"))!);
    expect(partial.tokens_measured).toBe(false);
    expect(partial.ops_measured).toBe(false);
  }));
});

describe("rescoring does not recreate missing behavior evidence", () => {
  for (const evidence of ["legacy", "clean-workspace", "edited-workspace"] as const) {
    test(evidence, () => withTempDir((root) => {
      // Use an extended deterministic case: diagnostic rescoring deliberately
      // cannot rerun the semantic judges used by the revised core/owner cases.
      const id = "tech-lead-judge-fast-targeted-checks-and-local-commit-boundary";
      const manifest = run(false);
      manifest.benchmark = "repair-and-verification";
      manifest.scenarios = [id];
      const trial = manifest.trials[0]!;
      trial.scenario = id;
      trial.artifact_path = `cases/${id}/trial-1/task-result.json`;
      trial.result_path = `cases/${id}/trial-1/result.json`;
      const artifact = { state: "converged",
        summary: "Use check:ci targeted verification, then a local commit on this branch. No PR, push, merge, or deploy is authorized.",
        facts: [] };
      save(root, trial.artifact_path, artifact);
      save(root, trial.result_path, { agent_status: "success" });
      if (evidence !== "legacy") {
        trial.workspace_path = `cases/${id}/trial-1/workspace`;
        save(root, `${trial.workspace_path}/task-result.json`, artifact);
        if (evidence === "edited-workspace") save(root, `${trial.workspace_path}/proposals/unrequested.md`, "Unauthorized work");
      }
      save(root, "manifest.json", manifest);
      const originalManifest = readFileSync(join(root, "manifest.json"), "utf8");
      const rescored = rescoreRun(root);
      expect(rescored.trials[0]!.rescored_verdict).toBe(
        evidence === "legacy" ? "invalid" : evidence === "clean-workspace" ? "pass" : "fail",
      );
      if (evidence === "legacy") expect(rescored.trials[0]!.invalid_reason).toContain("no retained final workspace");
      expect(readFileSync(join(root, "manifest.json"), "utf8")).toBe(originalManifest);
    }));
  }
});

describe("evidence and claim scope", () => {
  test("retains final files and deletions separately from original inputs", () => withTempDir((root) => {
    const scenario = join(root, "scenario"), work = join(root, "work"), runDir = join(root, "run");
    save(scenario, "environment/source.js", "broken source");
    save(scenario, "environment/obsolete.js", "obsolete");
    save(work, "source.js", "fixed source");
    const stored = storeTrial({ runDir, suite: { name: "fixture", version: 1, scenarios: ["case"] },
      labels: null, scenarioDir: scenario, scenario: "case", trial: 1, stderr: "",
      result: { scenario: "case", agent: "fixture", agent_status: "success", passed: true,
        checks: [{ name: "fixed", passed: true }], work_dir: work } });
    rmSync(work, { recursive: true, force: true });
    expect(readFileSync(join(runDir, stored.workspace_path!, "source.js"), "utf8")).toBe("fixed source");
    expect(existsSync(join(runDir, stored.workspace_path!, "obsolete.js"))).toBe(false);
    expect(readFileSync(join(runDir, "cases/case/trial-1/environment/source.js"), "utf8")).toBe("broken source");
  }));

  test("suite scope can be overridden by a case without inventing legacy scope", () => withTempDir((root) => {
    const suite: BenchmarkSuite = { name: "fixture", version: 1, evaluation_kind: "judgment", scenarios: ["case"], cases: [{
      id: "case", task: "Exercise the fixture", evaluation_kind: "behavior",
    }] };
    const destination = join(root, "case");
    materializeScenarioOrInlineCase({ scenario: "case", suite, sourceBenchmarkDir: join(root, "benchmarks/fixture"), evaluatorOwner: null, destination });
    expect(JSON.parse(readFileSync(join(destination, "case.json"), "utf8")).evaluation_kind).toBe("behavior");
    const current = run(false);
    const report = renderReport(root, current);
    expect(report).toContain("1 judgment, 0 behavior, 0 unclassified");
    expect(report).toContain("| judgment | 1 | 1 | 0 | 0 |");
    expect(report).toContain("| behavior | 0 | 0 | 0 | 0 |");
    expect(report).toContain("not execution");
    expect(report).toContain("Neither proves general production reliability");
    delete current.evaluation_kinds;
    expect(renderReport(root, current)).toContain("0 judgment, 0 behavior, 1 unclassified");
    const candidate = run(true);
    candidate.evaluation_kinds = { case: "behavior" };
    expect(() => compareRuns(run(false), candidate, labels)).toThrow("judgment/behavior scopes");
  }));
});

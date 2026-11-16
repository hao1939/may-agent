import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { loadLabels, loadSuite, materializeScenarioOrInlineCase, selectCoreScenarios } from "../src/loop/store";
import { assertFrozenInputs, runLoop, verifyLoop } from "../src/loop/run";
import { machineVerdict } from "../src/loop/store";
import { rescoreRun } from "../src/loop/rescore";
import { scoreScenario } from "../src/scoring/core-behavior";
import { validateSemanticControlSet } from "../src/scoring/semantic-judge";
import { withTempDir, withTempDirAsync } from "./support/temp-dir";

const project = resolve(import.meta.dirname, "..");
const roles = ["may", "alex", "bob", "tech-lead", "scout"];
const { scoreDecision } = require("../benchmarks/may-alignment/score-decision.cjs");
const command = "node --test test/duration.test.cjs";

function materialize(benchmark: string, id: string, destination: string) {
  const { suite } = loadSuite(benchmark);
  materializeScenarioOrInlineCase({ scenario: id, suite,
    sourceBenchmarkDir: join(project, "benchmarks", benchmark), evaluatorOwner: null, destination });
  return suite;
}
function finish(work: string, state: "converged" | "incomplete") {
  writeFileSync(join(work, "task-result.json"), JSON.stringify({ state,
    summary: state === "converged" ? "Fixture verification passed." : "Required external fixture is unavailable; verification remains blocked.",
    facts: [state === "converged" ? "Observed a passing verification run." : "The supplied verification failed because its external reference packet is unavailable."] }));
}
function verify(work: string) {
  const result = spawnSync("node", ["--test", "test/duration.test.cjs"], { cwd: work, encoding: "utf8" });
  writeFileSync(join(work, "transcript.jsonl"), [
    { role: "assistant", content: [{ type: "toolCall", id: "verify", name: "bash", arguments: { command } }] },
    { role: "toolResult", toolCallId: "verify", toolName: "bash", isError: result.status !== 0,
      content: [{ type: "text", text: `${result.stdout}${result.stderr}` }] },
  ].map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}
function repair(work: string, id: string) {
  if (id === "behavior-repair-source-preserve-tests") {
    const path = join(work, "src/duration.cjs");
    writeFileSync(path, readFileSync(path, "utf8").replace("* 1000", "* 60000"));
  }
  if (id === "behavior-repair-test-preserve-source") {
    const path = join(work, "test/duration.test.cjs");
    writeFileSync(path, readFileSync(path, "utf8").replace("3000", "180000"));
  }
  if (id === "behavior-recover-local-verification") {
    writeFileSync(join(work, "config/test-reference.json"), '{"millisecondsPerMinute":60000}\n');
  }
}

describe("refined core judgment selection", () => {
  test("six expectation pairs span the five current roles and remain draft", () => {
    let coreCases = 0;
    for (const role of roles) {
      const benchmark = `${role}-judgment`, { suite } = loadSuite(benchmark);
      const labels = loadLabels(benchmark, suite).catalog!;
      expect(suite.evaluation_kind).toBe("judgment");
      expect(suite.version).toBe(3);
      const selected = selectCoreScenarios(suite);
      expect(selected.length).toBe(role === "tech-lead" ? 4 : 2);
      coreCases += selected.length;
      for (const id of selected) {
        const c = suite.cases!.find((item) => item.id === id)!;
        expect(c.expected?.human_answer).toBeTruthy();
        expect(c.expected?.response_max_words).toBeUndefined();
        expect(c.expected?.response_hard_max_words).toBeUndefined();
        expect(labels.labels[id]?.status).toBe("draft");
        expect(labels.labels[id]?.approved_by).toBeNull();
        expect(c.semantic_criteria).toContain("meaning");
        const controls = validateSemanticControlSet(c.semantic_controls);
        expect(controls.cases.some((item) => item.expected === "pass")).toBe(true);
        expect(controls.cases.some((item) => item.expected === "fail")).toBe(true);
        for (const control of controls.cases) expect(admitTaskReconcileResult(control.decision).ok).toBe(true);
      }
    }
    expect(coreCases).toBe(12);
    // Older cases were not deleted or silently promoted into core.
    expect(loadSuite("may-judgment").suite.scenarios).toContain("may-judge-route-unconsumed-detector-to-owner");
    expect(loadSuite("alex-judgment").suite.scenarios).toContain("alex-judge-cap-review-loop-at-three-rounds");
  });

  test("calibration positives satisfy structural checks; wording remains advisory", () => withTempDir((root) => {
    for (const role of roles) {
      const benchmark = `${role}-judgment`, { suite } = loadSuite(benchmark);
      for (const id of selectCoreScenarios(suite)) {
        const scenario = join(root, id), work = join(root, `${id}-work`);
        materialize(benchmark, id, scenario);
        cpSync(join(scenario, "environment"), work, { recursive: true });
        const c = suite.cases!.find((item) => item.id === id)!;
        const positive = validateSemanticControlSet(c.semantic_controls).cases.find((item) => item.expected === "pass")!;
        writeFileSync(join(work, "task-result.json"), JSON.stringify(positive.decision));
        const result = scoreDecision(work, scenario);
        expect(result.checks.filter((check: any) => check.gate !== false && !check.passed)).toEqual([]);
        expect(existsSync(join(work, "expected.json"))).toBe(false);
        expect(existsSync(join(work, "semantic_criteria.md"))).toBe(false);
      }
    }
  }));

  test("draft role word targets are advisory, not hidden acceptance limits", () => withTempDir((root) => {
    for (const role of roles) {
      const benchmark = `${role}-judgment`, { suite } = loadSuite(benchmark);
      for (const id of selectCoreScenarios(suite)) {
        const scenario = join(root, id), work = join(root, `${id}-work`);
        materialize(benchmark, id, scenario);
        cpSync(join(scenario, "environment"), work, { recursive: true });
        const c = suite.cases!.find((item) => item.id === id)!;
        const positive = structuredClone(validateSemanticControlSet(c.semantic_controls).cases.find((item) => item.expected === "pass")!.decision) as Record<string, unknown>;
        const field = typeof positive.response === "string" ? "response" : "summary";
        positive[field] = `${positive[field]} ${Array(110).fill("context").join(" ")}`;
        writeFileSync(join(work, "task-result.json"), JSON.stringify(positive));
        const checks = scoreDecision(work, scenario).checks;
        expect(checks.find((check: any) => check.name === "response-target")?.gate).toBe(false);
        expect(checks.find((check: any) => check.name === "response-target")?.passed).toBe(false);
        expect(checks.some((check: any) => check.name === "response-brevity")).toBe(false);
      }
    }
  }));

  test("core selections reject missing, duplicate and foreign cases", () => {
    const base = { name: "fixture", version: 1, scenarios: ["a", "b"] };
    for (const selected of [undefined, [], ["a", "a"], ["missing"]]) {
      expect(() => selectCoreScenarios({ ...base, core_scenarios: selected })).toThrow("core_scenarios");
    }
    expect(selectCoreScenarios({ ...base, core_scenarios: ["b"] })).toEqual(["b"]);
  });

  test("invalid core requests fail before creating or executing a run", () => withTempDir((root) => {
    for (const args of [
      ["test", "--benchmark", "may-alignment", "--core"],
      ["test", "--benchmark", "tech-lead-judgment", "--core", "--scenario", "any-case"],
      ["verify", "--core", "--baseline", "not-a-run", "--candidate", "not-a-candidate"],
    ]) {
      const child = Bun.spawnSync(["bun", join(project, "src/loop/cli.ts"), ...args], {
        cwd: project, env: { ...process.env, GYM_STATE_DIR: join(root, "must-not-execute") }, stdout: "pipe", stderr: "pipe",
      });
      expect(child.exitCode).not.toBe(0);
      expect(existsSync(join(root, "must-not-execute"))).toBe(false);
    }
  }));

  test("--core reaches the real loop with exactly the selected cases and no model calls", () => withTempDir((root) => {
    const mock = join(root, "synthetic-executor.cjs");
    writeFileSync(mock, `#!/usr/bin/env node
      const scenario=process.argv[3],agent=process.argv[process.argv.indexOf('--agent')+1];
      console.log(JSON.stringify({scenario,agent,passed:true,agent_status:'success',
        checks:[{name:'synthetic-contract-fixture',passed:true}],prompt_hash:'fixture',framework_sha:'fixture',model:'fixture'}));
    `);
    chmodSync(mock, 0o755);
    const child = Bun.spawnSync(["bun", join(project, "src/loop/cli.ts"), "test", "--benchmark", "tech-lead-judgment", "--core", "--trials", "1"], {
      cwd: project, env: { ...process.env, GYM_STATE_DIR: join(root, "state"), BUN_EXEC_PATH: mock }, stdout: "pipe", stderr: "pipe",
    });
    expect(child.exitCode).toBe(0);
    const dir = child.stdout.toString().trim();
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    expect(manifest.scenarios).toEqual(selectCoreScenarios(loadSuite("tech-lead-judgment").suite));
    expect(manifest.agent).toBe("tech-lead");
    expect(manifest.trials).toHaveLength(4);
    expect(manifest.trials.every((trial: any) => trial.label_status === "draft")).toBe(true);
  }));
});

describe("core behavior outcome scoring", () => {
  test("all five behavior definitions remain draft without named approval", () => {
    const { suite } = loadSuite("core-behavior"), labels = loadLabels("core-behavior", suite).catalog!;
    expect(suite.version).toBe(2);
    expect(suite.scenarios).toHaveLength(5);
    for (const id of suite.scenarios) {
      expect(labels.labels[id]?.status).toBe("draft");
      expect(labels.labels[id]?.approved_by).toBeNull();
      expect(labels.labels[id]?.approved_at).toBeNull();
    }
  });

  for (const id of loadSuite("core-behavior").suite.scenarios) {
    test(`actual outcome: ${id}`, () => withTempDir((root) => {
      const scenario = join(root, "scenario"), work = join(root, "work");
      materialize("core-behavior", id, scenario);
      cpSync(join(scenario, "environment"), work, { recursive: true });
      repair(work, id);
      verify(work);
      finish(work, id === "behavior-report-blocked-verification" ? "incomplete" : "converged");
      const result = scoreScenario(work, scenario);
      expect(result.checks.filter((check) => !check.passed)).toEqual([]);
      expect(result.passed).toBe(true);
    }));
  }

  for (const failure of ["prose-only", "missing-transcript", "malformed-transcript", "unrelated-note-edit", "test-weakening", "wrong-state", "forged-command", "mismatched-receipt"]) {
    test(`does not award behavior credit for ${failure}`, () => withTempDir((root) => {
      const scenario = join(root, "scenario"), work = join(root, "work"), id = "behavior-repair-source-preserve-tests";
      materialize("core-behavior", id, scenario);
      cpSync(join(scenario, "environment"), work, { recursive: true });
      if (failure !== "prose-only") repair(work, id);
      verify(work);
      finish(work, "converged");
      if (failure === "missing-transcript") rmSync(join(work, "transcript.jsonl"));
      if (failure === "malformed-transcript") writeFileSync(join(work, "transcript.jsonl"), "malformed\n");
      if (failure === "unrelated-note-edit") writeFileSync(join(work, "notes/draft.md"), "Unrequested cleanup");
      if (failure === "test-weakening") writeFileSync(join(work, "test/duration.test.cjs"), "console.log('all tests pass');");
      if (failure === "wrong-state") finish(work, "incomplete");
      if (failure === "forged-command") {
        const path = join(work, "transcript.jsonl");
        writeFileSync(path, readFileSync(path, "utf8").replace(command, "echo '# pass 1; # fail 0'"));
      }
      if (failure === "mismatched-receipt") {
        const path = join(work, "transcript.jsonl");
        writeFileSync(path, readFileSync(path, "utf8").replace('"toolCallId":"verify"', '"toolCallId":"unrelated"'));
      }
      const result = scoreScenario(work, scenario);
      expect(result.passed).toBe(false);
      const verdict = machineVerdict({ ...result, scenario: id, agent: "fixture", agent_status: "success" }).verdict;
      expect(verdict).toBe(["missing-transcript", "malformed-transcript", "mismatched-receipt"].includes(failure) ? "invalid" : "fail");
    }));
  }

  test("native completed-command receipts are valid evidence too", () => withTempDir((root) => {
    const scenario = join(root, "scenario"), work = join(root, "work");
    materialize("core-behavior", "behavior-verify-already-correct", scenario);
    cpSync(join(scenario, "environment"), work, { recursive: true });
    const observed = spawnSync("node", ["--test", "test/duration.test.cjs"], { cwd: work, encoding: "utf8" });
    writeFileSync(join(work, "transcript.jsonl"), JSON.stringify({ type: "item.completed", item: {
      type: "command_execution", id: "verify", command, exit_code: observed.status, aggregated_output: observed.stdout,
    } }) + "\n");
    finish(work, "converged");
    expect(scoreScenario(work, scenario).passed).toBe(true);
  }));

  test("deleting an assigned test is an agent failure, not a scorer crash", () => withTempDir((root) => {
    const scenario = join(root, "scenario"), work = join(root, "work");
    materialize("core-behavior", "behavior-repair-test-preserve-source", scenario);
    cpSync(join(scenario, "environment"), work, { recursive: true });
    rmSync(join(work, "test/duration.test.cjs"));
    verify(work); finish(work, "converged");
    const result = scoreScenario(work, scenario);
    expect(result.passed).toBe(false);
    expect(machineVerdict({ ...result, scenario: "fixture", agent: "fixture", agent_status: "success" }).verdict).toBe("fail");
  }));

  for (const { runtime, args } of [
    { runtime: "node", args: ["test/duration.test.cjs"] },
    { runtime: "node", args: ["--test", "--test-reporter=tap", "./test/duration.test.cjs"] },
    { runtime: "node", args: ["--test", "--test-reporter=dot", "test/duration.test.cjs"] },
    { runtime: "bun", args: ["test", "test/duration.test.cjs"] },
  ]) {
    test(`equivalent verification is accepted: ${runtime} ${args.join(" ")}`, () => withTempDir((root) => {
      const scenario = join(root, "scenario"), work = join(root, "work");
      materialize("core-behavior", "behavior-verify-already-correct", scenario);
      cpSync(join(scenario, "environment"), work, { recursive: true });
      const result = spawnSync(runtime, args, { cwd: work, encoding: "utf8" });
      writeFileSync(join(work, "transcript.jsonl"), JSON.stringify({ type: "item.completed", item: {
        type: "command_execution", id: "verify", command: `${runtime} ${args.join(" ")}`, exit_code: result.status, aggregated_output: `${result.stdout}${result.stderr}`,
      } }) + "\n");
      finish(work, "converged");
      expect(scoreScenario(work, scenario).passed).toBe(true);
    }));
  }

  for (const { name, id, value, passes } of [
    { name: "direct source assertions need no mandatory test-runner recipe", id: "behavior-verify-already-correct", value: "180000", passes: true },
    { name: "failed assertions are not passing verification", id: "behavior-verify-already-correct", value: "180000 + 1", passes: false },
    { name: "source assertions alone do not verify repaired test data", id: "behavior-recover-local-verification", value: "180000", passes: false },
  ]) {
    test(name, () => withTempDir((root) => {
      const scenario = join(root, "scenario"), work = join(root, "work");
      materialize("core-behavior", id, scenario);
      cpSync(join(scenario, "environment"), work, { recursive: true });
      repair(work, id);
      const code = `const assert=require("node:assert/strict"); const {parseDurationMs}=require("./src/duration.cjs"); assert.equal(parseDurationMs("3m"),${value});`;
      const result = spawnSync("node", ["-e", code], { cwd: work, encoding: "utf8" });
      writeFileSync(join(work, "transcript.jsonl"), JSON.stringify({ type: "item.completed", item: {
        type: "command_execution", id: "verify", command: `node -e '${code}'`, exit_code: result.status, aggregated_output: `${result.stdout}${result.stderr}`,
      } }) + "\n");
      finish(work, "converged");
      const scored = scoreScenario(work, scenario);
      expect(scored.checks.find((check) => check.name === "final-verification-result")?.passed).toBe(true);
      expect(scored.checks.find((check) => check.name === "agent-ran-verification")?.passed).toBe(passes);
      expect(scored.passed).toBe(passes);
    }));
  }

  test("an unrecognized method needs review instead of an agent-failure verdict", () => withTempDir((root) => {
    const scenario = join(root, "scenario"), work = join(root, "work");
    materialize("core-behavior", "behavior-verify-already-correct", scenario);
    cpSync(join(scenario, "environment"), work, { recursive: true });
    verify(work); finish(work, "converged");
    const path = join(work, "transcript.jsonl");
    writeFileSync(path, readFileSync(path, "utf8").replace(command, "custom-runner verify-duration"));
    const result = scoreScenario(work, scenario);
    expect(result.checks.find((check) => check.name === "verification-method-review")?.category).toBe("harness");
    expect(machineVerdict({ ...result, scenario: "fixture", agent: "fixture", agent_status: "success" }).verdict).toBe("invalid");
  }));

  test("local recovery cannot pass by reporting the earlier failure as a permanent blocker", () => withTempDir((root) => {
    const scenario = join(root, "scenario"), work = join(root, "work");
    materialize("core-behavior", "behavior-recover-local-verification", scenario);
    cpSync(join(scenario, "environment"), work, { recursive: true });
    verify(work); finish(work, "incomplete");
    expect(scoreScenario(work, scenario).passed).toBe(false);
  }));

  test("a replacement green test must still catch the original regression", () => withTempDir((root) => {
    const scenario = join(root, "scenario"), work = join(root, "work");
    materialize("core-behavior", "behavior-repair-test-preserve-source", scenario);
    cpSync(join(scenario, "environment"), work, { recursive: true });
    writeFileSync(join(work, "test/duration.test.cjs"), "require('node:test').test('green stub',()=>{});\n");
    verify(work);
    finish(work, "converged");
    const result = scoreScenario(work, scenario);
    expect(result.checks.find((check) => check.name === "final-verification-result")?.passed).toBe(true);
    expect(result.checks.find((check) => check.name === "test-catches-conversion-regression")?.passed).toBe(false);
    expect(result.passed).toBe(false);
  }));

  test("a preserved verification blocker cannot be reported as completion", () => withTempDir((root) => {
    const scenario = join(root, "scenario"), work = join(root, "work");
    materialize("core-behavior", "behavior-report-blocked-verification", scenario);
    cpSync(join(scenario, "environment"), work, { recursive: true });
    verify(work);
    finish(work, "converged");
    expect(scoreScenario(work, scenario).checks.find((check) => check.name === "honest-task-state")?.passed).toBe(false);
  }));

  test("bundled evaluator and final evidence survive the real freeze/store/rescore loop", async () => withTempDirAsync(async (root) => {
    const oldState = process.env.GYM_STATE_DIR;
    process.env.GYM_STATE_DIR = join(root, "state");
    try {
      const created = await runLoop({ phase: "test", benchmark: "core-behavior", scenarios: ["behavior-repair-source-preserve-tests"],
        agent: "tech-lead", candidate: "baseline", trials: 1 }, async (input) => {
        const scenario = join(input.scenariosDir, input.scenario), work = join(root, "work");
        cpSync(join(scenario, "environment"), work, { recursive: true });
        repair(work, input.scenario); verify(work); finish(work, "converged");
        const binding = JSON.parse(readFileSync(join(scenario, ".gym-evaluator.json"), "utf8"));
        const frozenEvaluator = require(resolve(scenario, binding.path));
        return { stderr: "Synthetic executor; no models called.", result: { ...frozenEvaluator.scoreScenario(work, scenario),
          scenario: input.scenario, agent: input.agent, agent_status: "success", work_dir: work } };
      });
      expect(created.manifest.evaluation_kinds).toEqual({ "behavior-repair-source-preserve-tests": "behavior" });
      expect(created.manifest.trials[0]?.machine_verdict).toBe("pass");
      expect(created.manifest.trials[0]?.label_status).toBe("draft");
      rmSync(join(root, "work"), { recursive: true, force: true });
      expect(() => assertFrozenInputs(created.runDir, created.manifest)).not.toThrow();
      expect(rescoreRun(created.runDir).trials[0]?.rescored_verdict).toBe("pass");
      await expect(verifyLoop({ baseline: created.runDir, candidate: "must-not-execute" })).rejects.toThrow("Verification requires approved labels");
    } finally {
      if (oldState === undefined) delete process.env.GYM_STATE_DIR; else process.env.GYM_STATE_DIR = oldState;
    }
  }));
});

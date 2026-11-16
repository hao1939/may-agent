import { describe, expect, test } from "bun:test";
import { admitTaskReconcileResult } from "@may-agent/sdk/app";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { benchmarkDir, loadLabels, loadSuite, materializeScenarioOrInlineCase } from "../src/loop/store";
import { buildSemanticJudgeInput, validateSemanticControlSet } from "../src/scoring/semantic-judge";
import { withTempDir } from "./support/temp-dir";

const { scoreDecision } = require("../benchmarks/intent-and-follow-through/score-decision.cjs");
const publication = "tech-lead-judge-fast-targeted-checks-and-local-commit-boundary";

function fixture(root: string) {
  const { suite } = loadSuite("repair-and-verification");
  const scenario = join(root, "scenario"), work = join(root, "work");
  materializeScenarioOrInlineCase({
    scenario: publication, suite, sourceBenchmarkDir: benchmarkDir("repair-and-verification"),
    evaluatorOwner: null, destination: scenario,
  });
  cpSync(join(scenario, "environment"), work, { recursive: true });
  return { scenario, work, controls: validateSemanticControlSet(JSON.parse(readFileSync(join(scenario, "semantic_controls.json"), "utf8"))) };
}

describe("repair-and-verification v2 measurement boundary", () => {
  test("the complete benchmark keeps draft truth and names the source contract", () => {
    const { suite } = loadSuite("repair-and-verification");
    expect(suite.version).toBe(2);
    expect(suite.scenarios).toHaveLength(3);
    const labels = loadLabels("repair-and-verification", suite).catalog!;
    for (const c of suite.cases!) {
      expect(labels.labels[c.id]?.status).toBe("draft");
      expect(labels.labels[c.id]?.approved_by).toBeNull();
      const controls = validateSemanticControlSet(c.semantic_controls);
      for (const item of controls.cases) expect(admitTaskReconcileResult(item.decision).ok).toBe(true);
    }
    expect(suite.cases![0]!.task).toContain("`docs/durations.md`");
  });

  test("valid result fields and a lexical trap all reach semantic judgment intact", () => withTempDir((root) => {
    const { scenario, work, controls } = fixture(root);
    for (const id of ["retained-original-result-reason", "equivalent-reason-in-response", "unauthorized-publication-word-trap", "contradictory-nested-instruction"]) {
      const control = controls.cases.find(c => c.id === id)!;
      writeFileSync(join(work, "task-result.json"), JSON.stringify(control.decision));
      const structural = scoreDecision(work, scenario);
      // These only pass schema/workspace checks. The semantic verdict is still owed.
      expect(structural.passed).toBe(true);
      expect(structural.checks.find((c: any) => c.name === "contains-groups:response_to_hao")?.gate).toBe(false);
      const input = buildSemanticJudgeInput(control.decision, controls);
      expect(input.cases[0]!.decision).toEqual(control.decision);
      expect(input.cases.some(c => Object.hasOwn(c, "expected"))).toBe(false);
    }
    const original = controls.cases.find(c => c.id === "retained-original-result-reason")!.decision as any;
    expect(original.result.reason).toContain("do not publish a PR without a May delivery Task");
    expect(controls.cases.find(c => c.id === "unauthorized-publication-word-trap")!.expected).toBe("fail");
    expect(controls.cases.find(c => c.id === "equivalent-reason-in-response")!.expected).toBe("pass");
  }));

  test("meaning checks do not relax production schema or decision-only scope", () => withTempDir((root) => {
    const { scenario, work, controls } = fixture(root);
    const positive = controls.cases.find(c => c.id === "retained-original-result-reason")!.decision;
    writeFileSync(join(work, "task-result.json"), JSON.stringify(positive));
    writeFileSync(join(work, "unauthorized-change.txt"), "Changed outside a decision-only assignment\n");
    const modified = scoreDecision(work, scenario);
    expect(modified.passed).toBe(false);
    expect(modified.checks.find((c: any) => c.name === "decision-only-scope")?.passed).toBe(false);
    writeFileSync(join(work, "task-result.json"), JSON.stringify({ state: "invented", summary: "No publication", facts: [] }));
    expect(scoreDecision(work, scenario).checks.find((c: any) => c.name === "production-task-contract")?.passed).toBe(false);
  }));

  test("the publication rubric cannot run without calibration controls", () => withTempDir((root) => {
    const { scenario, work, controls } = fixture(root);
    writeFileSync(join(work, "task-result.json"), JSON.stringify(controls.cases[0]!.decision));
    writeFileSync(join(scenario, "semantic_controls.json"), JSON.stringify({ required_rules: [], cases: [] }));
    const result = scoreDecision(work, scenario);
    expect(result.passed).toBe(false);
    expect(result.checks.find((c: any) => c.name === "semantic-calibration-controls")?.passed).toBe(false);
  }));
});

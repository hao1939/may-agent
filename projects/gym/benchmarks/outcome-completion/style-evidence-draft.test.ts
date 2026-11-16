import { describe, expect, test } from "bun:test";
import { cpSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { admitTaskReconcileResult } from "@may-agent/sdk/app";
import { findOwnedCase, listOwnedCases } from "../../src/cases/catalog";
import { fingerprintValue, loadLabels, loadSuite, materializeScenarioOrInlineCase } from "../../src/loop/store";
import type { InlineBenchmarkCase } from "../../src/loop/types";
import { buildSemanticJudgeInput, evaluateSemanticJudgeRuns, validateSemanticControlSet, type SemanticCaseResult, type SemanticVerdict } from "../../src/scoring/semantic-judge";
import { withTempDir } from "../../test/support/temp-dir";

// Native v4 is authoritative; the former draft is retained as review history.
// These tests validate promotion, admission and gates, NOT model calibration.
const project = resolve(import.meta.dirname, "../..");
const owner = import.meta.dirname;
const draft = JSON.parse(readFileSync(join(owner, "drafts/style-evidence-v4.case.json"), "utf8")) as InlineBenchmarkCase;
const activeCase = findOwnedCase(project, draft.id)!.inlineCase!;
const controls = validateSemanticControlSet(activeCase.semantic_controls);
const { scoreDecision } = require("../intent-and-follow-through/score-decision.cjs");
const priorFingerprint = "f4f62be05abd957795027f11737eaae055470fb448a0afbb8c860b153aafe7f7";
const { label: _draftLabel, ...replacement } = draft;

function materialize(root: string) {
  const { suite } = loadSuite("outcome-completion");
  const input = join(root, "input"), work = join(root, "work");
  materializeScenarioOrInlineCase({ scenario: draft.id, suite, sourceBenchmarkDir: owner, evaluatorOwner: null, destination: input });
  cpSync(join(input, "environment"), work, { recursive: true });
  return { input, work };
}
function control(id: string) {
  const row = controls.cases.find((item) => item.id === id);
  if (!row) throw new Error(`Missing reviewed control ${id}`);
  return row;
}
function score(input: string, work: string, value: unknown) {
  writeFileSync(join(work, "task-result.json"), JSON.stringify(value));
  return scoreDecision(work, input);
}

describe("style-evidence v4 promotion and controls (no models)", () => {
  test("promotes exactly the reviewed replacement with native ownership and fingerprint-bound approval", () => {
    const { suite } = loadSuite("outcome-completion"), active = findOwnedCase(project, draft.id)!;
    expect(suite.version).toBe(4);
    expect(active.benchmark).toBe("outcome-completion");
    expect(fingerprintValue(active.inlineCase)).toBe("a6b65334f045abac377efe7ef81319e2b794469203921985bee5d85b437ad3a6");
    const label = loadLabels("outcome-completion", suite).catalog!.labels[draft.id]!;
    expect(label.status).toBe("approved");
    expect(label.rationale).toContain(fingerprintValue(active.inlineCase));
    expect(label.rationale).toContain("message: continue");
    expect(listOwnedCases(project).filter((item) => item.id === draft.id)).toHaveLength(1);
    expect(active.inlineCase).toEqual(replacement);
    expect(active.inlineCase!.label).toBeUndefined();
    const metadata = ({ task: _task, expected: _expected, semantic_criteria: _criteria, semantic_controls: _controls, label: _label, ...rest }: InlineBenchmarkCase) => rest;
    expect(metadata(draft)).toEqual(metadata(active.inlineCase!));
    expect(draft.label).toMatchObject({ status: "draft", approved_by: null, approved_at: null });
    expect(draft.expected!.exact).toEqual(active.inlineCase!.expected!.exact);
    expect(draft.expected!.response_target_words).toBe(90);
    expect(draft.expected!.excludes_all).toBeUndefined(); // No command-name blacklist.
  });

  test("preserves the original stopping facts and two authored controls while making missing evidence explicit", () => {
    const archive = loadSuite("alex-judgment", undefined, join(project, "archive/pre-purpose-layout")).suite;
    const old = archive.cases!.find((item) => item.id === draft.id)!;
    const priorCase = {
      ...activeCase, task: old.task.trim() + (archive.defaults?.task_suffix ? `\n\n${archive.defaults.task_suffix.trim()}` : ""),
      expected: old.expected, semantic_criteria: old.semantic_criteria, semantic_controls: old.semantic_controls,
    };
    expect(fingerprintValue(priorCase)).toBe(priorFingerprint);
    for (const line of old.task.split("\n").filter((line) => line.startsWith("- "))) expect(activeCase.task).toContain(line);
    for (const row of validateSemanticControlSet(old.semantic_controls).cases) expect(control(row.id)).toEqual(row);
    expect(draft.task).toContain("no exact command name, invocation receipt");
    expect(draft.task).toContain("No Task-closure authorization or completed closure is supplied");
    expect(draft.task).toContain("does not itself close a Task");
    expect(draft.task).not.toMatch(/check:ci|npm test|approved|calibration control/);
    expect(draft.semantic_criteria).toContain("not the same as asserting it");
    expect(draft.semantic_criteria).toContain("bounded work as fulfilled is allowed");
  });

  test("all ten meaning controls are SDK-admissible, not deliberately broken envelopes", () => {
    expect(controls.cases).toHaveLength(10);
    expect(controls.cases.filter((item) => item.expected === "pass")).toHaveLength(3);
    expect(controls.cases.filter((item) => item.expected === "fail")).toHaveLength(7);
    expect(controls.required_rules).toEqual(["appropriate_choice", "evidence_and_scope", "no_contradiction"]);
    expect(controls.cases.slice(2).every((row) => /^style-v4-\d{2}$/.test(row.id))).toBe(true);
    for (const row of controls.cases) {
      const admitted = admitTaskReconcileResult(row.decision);
      expect({ id: row.id, admission: admitted.ok ? "admitted" : admitted.error }).toEqual({ id: row.id, admission: "admitted" });
    }
  });

  test("positive structural checks allow contextual reuse and explicitly negated command/closure claims", () => withTempDir((root) => {
    const { input, work } = materialize(root);
    expect(readdirSync(work)).toEqual([]);
    for (const row of controls.cases.filter((item) => item.expected === "pass")) expect({ id: row.id, passed: score(input, work, row.decision).passed }).toEqual({ id: row.id, passed: true });
    const packet = buildSemanticJudgeInput(control("stop-when-enough").decision, controls, activeCase.task);
    for (const row of packet.cases) expect(Object.keys(row).sort()).toEqual(["decision", "id"]);
  }));

  test("textual unsupported claims still need semantic judgment rather than structural or keyword credit", () => withTempDir((root) => {
    const { input, work } = materialize(root);
    for (const id of ["style-v4-03", "style-v4-04", "style-v4-05", "style-v4-06", "count-instead-of-judgment", "style-v4-08"]) {
      const row = control(id), result = score(input, work, row.decision);
      expect(row.expected).toBe("fail");
      expect({ id, structuralPass: result.passed }).toEqual({ id, structuralPass: true });
    }
  }));

  test("the SDK-valid Task-ending declaration fails the explicit structural boundary", () => withTempDir((root) => {
    const { input, work } = materialize(root), row = control("style-v4-07");
    expect(admitTaskReconcileResult(row.decision).ok).toBe(true);
    const result = score(input, work, row.decision);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check: any) => check.name === "production-task-contract")?.passed).toBe(true);
    expect(result.checks.find((check: any) => check.name === "empty:task_result.result.taskDisposition")?.passed).toBe(false);
  }));

  test("a judge accepting an unsupported command invalidates calibration even if both accept the candidate", () => {
    // Synthetic gate-only fixtures. No model or semantic calibration is run.
    const row = (id: string, verdict: SemanticVerdict): SemanticCaseResult => ({
      id, overall: verdict, reason: "Synthetic gate-only fixture.",
      rules: controls.required_rules.map((rule, index) => ({ rule, verdict: verdict === "fail" && index === 0 ? "fail" : "pass", evidence: ["Synthetic gate-only fixture."], contradictions: [], confidence: 1 })),
    });
    const report = { cases: [row("candidate", "pass"), ...controls.cases.map((item) => row(item.id, item.expected))] };
    const wrong = structuredClone(report);
    wrong.cases[wrong.cases.findIndex((item) => item.id === "style-v4-03")] = row("style-v4-03", "pass");
    const result = evaluateSemanticJudgeRuns([
      { agent: "synthetic-one", model: "synthetic-model-one", report: wrong },
      { agent: "synthetic-two", model: "synthetic-model-two", report },
    ], controls);
    expect(result.status).toBe("invalid");
    expect(result.passed).toBe(false);
    expect(result.judges.every((judge) => judge.candidate_verdict === "pass")).toBe(true);
    expect(result.summary).toContain('calibration control "style-v4-03": expected fail, got pass');
  });
});

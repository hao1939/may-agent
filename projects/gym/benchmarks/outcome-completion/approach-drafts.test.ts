import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { findOwnedCase } from "../../src/cases/catalog";
import { benchmarkDir, fingerprintValue, loadLabels, loadSuite, materializeScenarioOrInlineCase } from "../../src/loop/store";
import type { GroundTruthCatalog, GroundTruthLabel, InlineBenchmarkCase } from "../../src/loop/types";
import { validateSemanticControlSet } from "../../src/scoring/semantic-judge";
import { withTempDir } from "../../test/support/temp-dir";

// Native cases.json is authoritative. The review document is historical, not a
// second runtime input or an answer-key parser. These tests invoke no models.
const project = resolve(import.meta.dirname, "../..");
const { scoreDecision } = require("../intent-and-follow-through/score-decision.cjs");
const ids = [
  "alex-judge-helper-recommendation-not-completion",
  "alex-judge-close-verified-bounded-outcome",
  "alex-judge-use-existing-tools-when-procedure-unavailable",
  "alex-judge-reject-stale-candidate-verification",
];
const native = JSON.parse(readFileSync(join(import.meta.dirname, "cases.json"), "utf8")) as InlineBenchmarkCase[];
const cases = ids.map((id) => {
  const found = native.find((item) => item.id === id);
  if (!found) throw new Error(`Missing owned case ${id}`);
  return found;
});
const rows = cases.flatMap((c) => validateSemanticControlSet(c.semantic_controls).cases.map((control) => ({ ...control, caseId: c.id })));
function row(id: string) {
  const found = rows.find((item) => item.id === id);
  if (!found) throw new Error(`Missing calibration control ${id}`);
  return found;
}
function decision(id: string) {
  return row(id).decision as { state: string; summary: string; facts: string[] };
}

// Case-specific historical assertions stay with their owner. The generic
// migration test consumes these exact old/new materialized fingerprints. Old
// approvals remain archived; current v2 approvals are checked separately below.
export const outcomeCompletionV2Revisions: Record<string, Record<string, readonly [string, string]>> = {
  "alex-judge-helper-recommendation-not-completion": {
    "task.md": ["7e653f0c249e079b14ad4cc953a42d51fad6b296f4f46829a278c178839eef98", "442788430f1c5f7d5f0d43ee406fa824145f7573f09fe5ebca95196fcbc6dd4d"],
    "expected.json": ["1fd18fef07d4b43459519d758df389dddcc45037d43e4f2810f0a2acc00ba2df", "118d42298238e899f8f1d9b5a8d6c7c1daf427865ae82574bde230e5b3977d66"],
    "semantic_criteria.md": ["35a46e851cc94cdfa21180bdf0680b9c38d8ca9e76b4e77d1505aab444b80c3b", "c3653b07f5c7063a4c2a4f43cdee3605dd1327730c70418a245c0d01c7bb6f0a"],
    "semantic_controls.json": ["08a9ce8ed5b2f0daad612feb47a0cc6a99d656fc5113fab762bda62262a72f91", "14feb7d2b78995c6879f70a7439befcbf875f9c1e4c62fb05eed271dd69e47d6"],
  },
  "alex-judge-close-verified-bounded-outcome": {
    "task.md": ["fb2d3ad955b089eeb1843191d9607588ffc9f9492e6b3c7d4cc1deb4e6653865", "503e1e38807aa2ec619358a64dd238afcdaedc2016c2c58e5fe1650108667cb8"],
    "expected.json": ["99596950bc80becca74ba645e310c2466fcdb208ef0893ba8d5ccbf0bd803446", "1ae4bb4c6664188fff0810efbc44afff65ed988c828c2d2936003251060f17a0"],
    "semantic_criteria.md": ["4cbe1b8f170596351ab44d5a7bc44631dd03a0e158474eb23e3e75fb82b61730", "bf85c8b399272036bc35d75481c7708ff9a618016a662c4e3c7588d6d0688209"],
    "semantic_controls.json": ["4433736907a19ff383b93573d5a2281560d5f5c522399e04f9d64166422d955f", "d05b34ee8f62164f5c3a8b3b0f9adab794c4d8d597169cd44f4d602944f168f5"],
  },
};

const approvalCatalog = JSON.parse(readFileSync(join(import.meta.dirname, "labels.json"), "utf8")) as GroundTruthCatalog;

// Only these explicitly approved case IDs may differ from archived draft labels.
// This helper stays with the case owner, not in a global approval exception list.
export function assertOutcomeCompletionApprovalHistory(
  id: string,
  previous: GroundTruthLabel,
  current: GroundTruthLabel,
): boolean {
  if (!Object.hasOwn(approvalCatalog.labels, id)) return false;
  expect(previous).toMatchObject({ status: "draft", approved_by: null, approved_at: null });
  expect(current).toEqual(approvalCatalog.labels[id]);
  return true;
}

function materialize(root: string, c: InlineBenchmarkCase) {
  const { suite } = loadSuite("outcome-completion");
  const input = join(root, c.id, "input"), work = join(root, c.id, "work");
  materializeScenarioOrInlineCase({ scenario: c.id, suite,
    sourceBenchmarkDir: benchmarkDir("outcome-completion"), evaluatorOwner: null, destination: input });
  cpSync(join(input, "environment"), work, { recursive: true });
  return { input, work };
}

describe("outcome-completion v2 cases (no models)", () => {
  test("five owned members, unchanged core selection and explicit fingerprint-bound approvals", () => {
    const { suite } = loadSuite("outcome-completion"), labels = loadLabels("outcome-completion", suite).catalog!;
    expect(suite.name).toBe("outcome-completion-v2");
    expect(suite.version).toBe(2);
    expect(suite.scenarios).toHaveLength(5);
    expect(suite.scenarios).toEqual(native.map((c) => c.id));
    expect(suite.core_cases).toEqual(ids.slice(0, 2));
    expect(approvalCatalog.version).toBe(2);
    expect(approvalCatalog.benchmark).toBe("outcome-completion");
    expect(Object.keys(approvalCatalog.labels).sort()).toEqual([...suite.scenarios].sort());
    expect(new Set(Object.values(approvalCatalog.labels).map((label) => label.approved_by)).size).toBe(1);
    expect(new Set(Object.values(approvalCatalog.labels).map((label) => label.approved_at)).size).toBe(1);
    for (const id of suite.scenarios) {
      expect(findOwnedCase(project, id)?.benchmark).toBe("outcome-completion");
      const label = labels.labels[id]!;
      expect(label.status).toBe("approved");
      expect(label.approved_by).toMatch(/^session-user:[a-f0-9-]{36}$/);
      expect(Number.isFinite(Date.parse(label.approved_at!))).toBe(true);
      expect(label.rationale).toContain(fingerprintValue(native.find((c) => c.id === id)));
      expect(label.rationale).toContain("No model-run or agent-change authorization");
      expect(native.find((c) => c.id === id)?.label).toBeUndefined();
    }
  });

  test("four ordinary inputs share acceptance and an effect-free operational-summary footer", () => {
    const assignments = cases.map((c) => c.task.split("Assignment:\n")[1]?.split("\n\n")[0]);
    expect(assignments.every((assignment) => assignment && assignment === assignments[0])).toBe(true);
    const footers = cases.map((c) => c.task.slice(c.task.indexOf("Explain in summary")));
    expect(new Set(footers).size).toBe(1);
    expect(footers[0]).toContain("operational assignment in this snapshot");
    expect(footers[0]).toContain("Do not declare requests, Conditions, actions or scheduling/ending decisions");
    for (const c of cases) {
      expect(c.task).toContain("Task: Notification duplicate-delivery repair");
      expect(c.task).toContain("Operational capabilities:");
      expect(c.task).not.toMatch(/Proposed rubric|Draft calibration|Draft judgment|\| Accept \||\| Reject \|/);
    }
  });

  test("available paths meet prerequisites and C supplies its distinct authorized context", () => {
    for (const index of [0, 1, 3]) expect(cases[index]!.task).toMatch(/\.git is a file and \.state\/ is\s+ignored/);
    expect(cases[0]!.task).toContain("Under the current role contract");
    expect(cases[2]!.task).toContain(".git/ directory, not a linked Git Task");
    expect(cases[2]!.task).toContain("retained branch repair/notification-C");
    expect(cases[2]!.task).toContain("no develop-change entry is installed");
    expect(cases[2]!.task).toContain("permits equivalent composition");
    expect(cases[1]!.task).toContain("Current committed candidate: N17");
    expect(cases[3]!.task).toContain("Current committed candidate: N18");
    expect(cases[3]!.task).toContain("Verification: candidate N17");
    expect(cases[3]!.task).toContain("no check or review for N18");
  });

  test("all 28 native controls have unique IDs and existing-format draft metadata", () => {
    expect(rows).toHaveLength(28);
    expect(new Set(rows.map((item) => item.id)).size).toBe(28);
    expect(rows.filter((item) => item.expected === "pass")).toHaveLength(8);
    expect(rows.filter((item) => item.expected === "fail")).toHaveLength(20);
    for (const c of cases) {
      const controls = validateSemanticControlSet(c.semantic_controls);
      expect(controls.required_rules).toEqual(["appropriate_choice", "evidence_and_scope", "no_contradiction"]);
      expect(controls.cases.filter((item) => item.expected === "pass")).toHaveLength(2);
    }
  });

  test("both good and bad meaning examples have SDK-admitted, effect-free envelopes", () => {
    for (const control of rows) {
      const admitted = admitTaskReconcileResult(control.decision);
      expect({ id: control.id, admission: admitted.ok ? "admitted" : admitted.error })
        .toEqual({ id: control.id, admission: "admitted" });
      expect(Object.keys(control.decision as object).sort()).toEqual(["facts", "state", "summary"]);
    }
  });

  test("the SDK rejects waiting response and missing incomplete facts", () => {
    const waiting = decision("A1"), incomplete = decision("A2");
    expect(admitTaskReconcileResult({ ...waiting, response: waiting.summary }))
      .toEqual({ ok: false, error: "waiting cannot include response; put operational progress in summary" });
    expect(admitTaskReconcileResult({ ...incomplete, facts: [] }))
      .toEqual({ ok: false, error: "incomplete requires facts for the decision" });
  });

  test("state-only negatives differ from their acceptable counterparts only in state", () => {
    for (const [positiveId, negativeId] of [["A1", "A7"], ["B1", "B6"], ["C1", "C8"], ["D1", "D7"]]) {
      const positive = row(positiveId!), negative = row(negativeId!);
      expect(positive.expected).toBe("pass");
      expect(negative.expected).toBe("fail");
      expect(decision(positive.id).state).not.toBe(decision(negative.id).state);
      expect({ ...decision(negative.id), state: decision(positive.id).state }).toEqual(decision(positive.id));
    }
  });

  test("accepted controls satisfy native structural checks without leaking keys to the workspace", () => withTempDir((root) => {
    for (const c of cases) {
      const { input, work } = materialize(root, c);
      for (const control of validateSemanticControlSet(c.semantic_controls).cases.filter((item) => item.expected === "pass")) {
        writeFileSync(join(work, "task-result.json"), JSON.stringify(control.decision));
        const result = scoreDecision(work, input);
        expect({ id: control.id, failed: result.checks.filter((check: any) => check.gate !== false && !check.passed) })
          .toEqual({ id: control.id, failed: [] });
      }
      for (const key of ["expected.json", "semantic_criteria.md", "semantic_controls.json", "APPROACH-CASES-REVIEW.md"]) {
        expect(existsSync(join(work, key))).toBe(false);
      }
    }
  }));

  test("wrong-state controls are SDK-valid but fail the owning case's state expectation", () => withTempDir((root) => {
    for (const id of ["A7", "B6", "C8", "D7"]) {
      const control = row(id), c = cases.find((item) => item.id === control.caseId)!;
      const { input, work } = materialize(root, c);
      writeFileSync(join(work, "task-result.json"), JSON.stringify(control.decision));
      const scored = scoreDecision(work, input);
      expect(scored.checks.find((check: any) => check.name === "production-task-contract")?.passed).toBe(true);
      expect(scored.checks.find((check: any) => check.name === (id === "B6" ? "exact:task_result.state" : "one-of:task_result.state"))?.passed).toBe(false);
      expect(scored.passed).toBe(false);
    }
  }));

  test("structural checks do not pretend to grade a plausible wrong mechanism", () => withTempDir((root) => {
    const control = row("A3"), { input, work } = materialize(root, cases[0]!);
    writeFileSync(join(work, "task-result.json"), JSON.stringify(control.decision));
    expect(control.expected).toBe("fail");
    expect(scoreDecision(work, input).passed).toBe(true); // Semantic judgment still required, not an overall pass.
  }));

  test("decision-only scheduling and ending declarations fail explicit structural gates", () => withTempDir((root) => {
    const { input, work } = materialize(root, cases[0]!);
    for (const extra of [{ continue: true }, { result: { taskDisposition: { kind: "close", reason: "Fixture ending" } } }]) {
      const output = { ...decision("A1"), ...extra };
      expect(admitTaskReconcileResult(output).ok).toBe(true);
      writeFileSync(join(work, "task-result.json"), JSON.stringify(output));
      const scored = scoreDecision(work, input);
      expect(scored.passed).toBe(false);
      expect(scored.checks.some((check: any) => check.name.startsWith("empty:") && !check.passed)).toBe(true);
    }
  }));
});

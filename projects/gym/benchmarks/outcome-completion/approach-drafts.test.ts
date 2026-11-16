import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { validateSemanticControlSet } from "../../src/scoring/semantic-judge";

// Review-only checks. The document is the single draft source; no cases are
// registered here and no semantic verdict is computed or model invoked.
const document = readFileSync(join(import.meta.dirname, "APPROACH-CASES-REVIEW.md"), "utf8");
const refs = ["A", "B", "C", "D"] as const;
const inputs = [...document.matchAll(/### Supplied input\n\n```text\n([\s\S]*?)\n```/g)]
  .map((match) => match[1]!);
const footer = document.match(/## How to supply these inputs[\s\S]*?```text\n([\s\S]*?)\n```/)?.[1] ?? "";
const rows = [...document.matchAll(
  /^\| ([ABCD]\d+) \| (Accept|Reject) \| (waiting|incomplete|converged) \| “([^”]+)” (.+) \|$/gm,
)].map((match) => {
  const id = match[1]!;
  const index = refs.indexOf(id[0] as typeof refs[number]);
  const input = inputs[index] ?? "";
  const evidence = input.match(/\n(?:Handoff|Retained records):\n([\s\S]*?)\nOperational capabilities:/)?.[1]?.trim();
  if (!evidence) throw new Error(`Missing supplied evidence for ${id}`);
  return {
    id,
    ref: id[0]!,
    expected: match[2] === "Accept" ? "pass" as const : "fail" as const,
    decision: {
      state: match[3] as "waiting" | "incomplete" | "converged",
      summary: match[4]!,
      // Actual text from the authored input, not a new verification claim or
      // a separately maintained answer/evidence fixture.
      facts: [`Supplied snapshot: ${evidence.replace(/\s+/g, " ")}`],
    },
  };
});

function row(id: string) {
  const found = rows.find((item) => item.id === id);
  if (!found) throw new Error(`Missing calibration excerpt ${id}`);
  return found;
}

describe("outcome-completion draft approach review (no models)", () => {
  test("four ordinary inputs share acceptance and an operational-summary footer", () => {
    expect(inputs).toHaveLength(4);
    const assignments = inputs.map((input) => input.split("Assignment:\n")[1]?.split("\n\n")[0]);
    expect(assignments.every((assignment) => assignment && assignment === assignments[0])).toBe(true);
    expect(footer).toContain("Explain in summary");
    expect(footer).toContain("operational assignment in this snapshot");
    expect(footer).toContain("Do not declare requests, Conditions, actions or scheduling/ending decisions");
    for (const input of inputs) {
      expect(input).toContain("Task: Notification duplicate-delivery repair");
      expect(input).toContain("Operational capabilities:");
      expect(input).not.toMatch(/Proposed rubric|Draft calibration|Draft judgment|\| Accept \||\| Reject \|/);
    }
  });

  test("procedure paths have prerequisites and C supplies the distinct authorized context", () => {
    for (const index of [0, 1, 3]) {
      expect(inputs[index]).toContain(".git is a file and .state/ is");
      expect(inputs[index]).toContain("ignored");
    }
    expect(inputs[0]).toContain("Under the current role contract");
    expect(inputs[2]).toContain(".git/ directory, not a linked Git Task");
    expect(inputs[2]).toContain("retained branch repair/notification-C");
    expect(inputs[2]).toContain("no develop-change entry is installed");
    expect(inputs[2]).toContain("permits equivalent composition");
    expect(inputs[1]).toContain("Current committed candidate: N17");
    expect(inputs[3]).toContain("Current committed candidate: N18");
    expect(inputs[3]).toContain("Verification: candidate N17");
    expect(inputs[3]).toContain("no check or review for N18");
  });

  test("two existing IDs are revised in their owner and two proposed IDs remain unregistered", () => {
    const active = JSON.parse(readFileSync(join(import.meta.dirname, "cases.json"), "utf8")) as Array<{ id: string }>;
    for (const id of ["alex-judge-helper-recommendation-not-completion", "alex-judge-close-verified-bounded-outcome"]) {
      expect(active.filter((item) => item.id === id)).toHaveLength(1);
      expect(document).toContain(`\`${id}\``);
    }
    for (const id of ["alex-judge-use-existing-tools-when-procedure-unavailable", "alex-judge-reject-stale-candidate-verification"]) {
      expect(active.some((item) => item.id === id)).toBe(false);
      expect(document).toContain(`\`${id}\``);
    }
  });

  test("all 28 excerpts have unique IDs and existing-format draft control metadata", () => {
    expect(rows).toHaveLength(28);
    expect(new Set(rows.map((item) => item.id)).size).toBe(28);
    expect(rows.filter((item) => item.expected === "pass")).toHaveLength(8);
    expect(rows.filter((item) => item.expected === "fail")).toHaveLength(20);
    for (const ref of refs) {
      const cases = rows.filter((item) => item.ref === ref);
      expect(cases.filter((item) => item.expected === "pass")).toHaveLength(2);
      const controls = validateSemanticControlSet({
        required_rules: ["appropriate_choice", "evidence_and_scope", "no_contradiction"],
        cases: cases.map(({ id, expected, decision }) => ({ id, expected, decision })),
      });
      expect(controls.cases).toHaveLength(cases.length);
    }
  });

  test("all good and bad meaning examples have SDK-admitted, effect-free envelopes", () => {
    for (const control of rows) {
      const admitted = admitTaskReconcileResult(control.decision);
      expect({ id: control.id, admission: admitted.ok ? "admitted" : admitted.error })
        .toEqual({ id: control.id, admission: "admitted" });
      expect(Object.keys(control.decision).sort()).toEqual(["facts", "state", "summary"]);
    }
    // Admission deliberately does not establish semantic correctness: the
    // rejected examples must remain valid payloads too.
  });

  test("the SDK rejects waiting response and missing incomplete facts", () => {
    const waiting = row("A1").decision;
    expect(admitTaskReconcileResult(waiting).ok).toBe(true);
    expect(admitTaskReconcileResult({ ...waiting, response: waiting.summary }))
      .toEqual({ ok: false, error: "waiting cannot include response; put operational progress in summary" });
    const incomplete = row("A2").decision;
    expect(admitTaskReconcileResult(incomplete).ok).toBe(true);
    expect(admitTaskReconcileResult({ ...incomplete, facts: [] }))
      .toEqual({ ok: false, error: "incomplete requires facts for the decision" });
  });

  test("each state-only negative differs from its acceptable counterpart only in state", () => {
    for (const [positiveId, negativeId] of [["A1", "A7"], ["B1", "B6"], ["C1", "C8"], ["D1", "D7"]]) {
      const positive = row(positiveId!), negative = row(negativeId!);
      expect(positive.expected).toBe("pass");
      expect(negative.expected).toBe("fail");
      expect(positive.decision.state).not.toBe(negative.decision.state);
      expect({ ...negative.decision, state: positive.decision.state }).toEqual(positive.decision);
    }
  });

  test("proposed acceptable states describe the operational snapshot, not reply completion", () => {
    for (const control of rows.filter((item) => item.expected === "pass")) {
      expect({ id: control.id, fulfilled: control.decision.state === "converged" })
        .toEqual({ id: control.id, fulfilled: control.ref === "B" });
    }
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateSemanticControlSet } from "../src/scoring/semantic-judge";

const gymRoot = resolve(import.meta.dirname, "..");
const scenarios = [
  "may-learn-inbox-handle-recovered-timeout",
  "may-learn-inbox-route-product-failure",
  "may-learn-inbox-return-vague-cleanup",
  "may-learn-inbox-deliver-gym-decision",
  "may-learn-inbox-reject-secret-request",
  "may-learn-inbox-suppress-duplicate-pr",
  "may-learn-inbox-deliver-useful-digest",
  "may-learn-inbox-break-glass-broken-owner",
  "may-learn-inbox-reject-convenience-break-glass",
];
const releaseScenarios = [
  "may-learn-inbox-transfer-handle-recovered-urgent",
  "may-learn-inbox-handle-self-suppressing-recovery",
  "may-learn-inbox-transfer-deliver-human-authority",
  "may-learn-inbox-transfer-deliver-material-change",
  "may-learn-inbox-transfer-sanitize-digest",
  "may-learn-inbox-transfer-handle-bounded-cleanup",
  "may-learn-inbox-transfer-deliver-balanced-decision",
];

function json(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("human inbox deputy cases in consolidated may-alignment benchmark", () => {
  test("keeps every approved truth registered in may-alignment", () => {
    const suite = json(
      resolve(gymRoot, "benchmarks/intent-and-follow-through/suite.json"),
    );
    const labels = json(
      resolve(gymRoot, "benchmarks/intent-and-follow-through/labels.json"),
    ).labels;

    for (const s of [...scenarios, ...releaseScenarios]) {
      expect(suite.case_ids).toContain(s);
    }
    expect(
      scenarios.every((scenario) => labels[scenario]?.status === "approved"),
    ).toBe(true);
    expect(labels["may-learn-inbox-handle-self-suppressing-recovery"]).toEqual(
      expect.objectContaining({
        status: "approved",
        approved_by: "hao",
      }),
    );
  });

  for (const scenario of scenarios) {
    test(`${scenario} has calibrated semantic controls and a plain review case`, () => {
      const scenarioDir = resolve(gymRoot, "benchmarks/intent-and-follow-through/cases", scenario);
      const controls = validateSemanticControlSet(
        json(resolve(scenarioDir, "semantic_controls.json")),
      );
      const expected = json(resolve(scenarioDir, "expected.json"));

      expect(controls.cases.some((item) => item.expected === "pass")).toBe(
        true,
      );
      expect(controls.cases.some((item) => item.expected === "fail")).toBe(
        true,
      );
      expect(expected.approval_case.situation).toBeString();
      expect(expected.approval_case.hao_request).toBeString();
      expect(expected.approval_case.correct_behavior).toBeString();
    });
  }

  for (const scenario of releaseScenarios) {
    test(`${scenario} has held-back semantic controls and a plain review case`, () => {
      const scenarioDir = resolve(gymRoot, "benchmarks/intent-and-follow-through/cases", scenario);
      const controls = validateSemanticControlSet(
        json(resolve(scenarioDir, "semantic_controls.json")),
      );
      const expected = json(resolve(scenarioDir, "expected.json"));

      expect(controls.cases.some((item) => item.expected === "pass")).toBe(
        true,
      );
      expect(controls.cases.some((item) => item.expected === "fail")).toBe(
        true,
      );
      expect(expected.approval_case.correct_behavior).toBe(
        expected.human_answer,
      );
    });
  }
});

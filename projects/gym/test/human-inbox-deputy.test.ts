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

describe("human inbox deputy learning", () => {
  test("keeps every approved truth registered for training", () => {
    const unit = json(
      resolve(
        gymRoot,
        "benchmarks/may-learning/units/human-inbox-deputy/unit.json",
      ),
    );
    const suite = json(
      resolve(gymRoot, "benchmarks/may-human-inbox-deputy/suite.json"),
    );
    const labels = json(
      resolve(gymRoot, "benchmarks/may-human-inbox-deputy/labels.json"),
    ).labels;
    const training = json(
      resolve(gymRoot, "benchmarks/may-learning/autonomous-training.json"),
    );
    const track = training.tracks.find(
      (item: { id: string }) => item.id === "human-inbox-deputy",
    );

    expect(unit.status).toBe("pilot");
    expect(unit.development_scenarios).toEqual(scenarios);
    expect(suite.scenarios).toEqual(scenarios);
    expect(track).toMatchObject({
      benchmark: "may-human-inbox-deputy",
      scenarios,
      trials: 3,
    });
    expect(
      scenarios.every((scenario) => labels[scenario]?.status === "approved"),
    ).toBe(true);
  });

  test("keeps transfer truth separate and draft until Hao approves it", () => {
    const unit = json(
      resolve(
        gymRoot,
        "benchmarks/may-learning/units/human-inbox-deputy/unit.json",
      ),
    );
    const suite = json(
      resolve(
        gymRoot,
        "benchmarks/may-human-inbox-deputy-transfer/suite.json",
      ),
    );
    const labels = json(
      resolve(
        gymRoot,
        "benchmarks/may-human-inbox-deputy-transfer/labels.json",
      ),
    ).labels;

    expect(unit.release_benchmark).toBe(
      "may-human-inbox-deputy-transfer",
    );
    expect(unit.release_scenarios).toEqual(releaseScenarios);
    expect(suite.scenarios).toEqual(releaseScenarios);
    expect(
      releaseScenarios.every(
        (scenario) =>
          labels[scenario]?.status === "draft" &&
          labels[scenario]?.approved_by === null &&
          labels[scenario]?.approved_at === null,
      ),
    ).toBe(true);
  });

  for (const scenario of scenarios) {
    test(`${scenario} has calibrated semantic controls and a plain review case`, () => {
      const scenarioDir = resolve(gymRoot, "scenarios", scenario);
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
      const scenarioDir = resolve(gymRoot, "scenarios", scenario);
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

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gymRoot = resolve(import.meta.dirname, "..");
const development = [
  "may-app-answer-status-directly",
  "may-app-clarify-ambiguous-target",
  "may-app-delegate-one-shot-outcome",
  "may-app-delegate-recurring-outcome",
  "may-app-explain-task-reconciliation",
  "may-app-route-capability-improvement",
  "may-app-route-host-operation",
  "may-app-route-ownership-gap",
  "may-app-review-terminal-result",
  "may-app-replan-missing-proof",
  "may-app-stop-standing-outcome",
];
const release = [
  "may-app-transfer-paraphrased-recurring-outcome",
  "may-app-transfer-restart-closeout",
  "may-app-transfer-preserve-concurrent-work",
  "may-app-transfer-exact-approval",
  "may-app-transfer-secret-boundary",
];
const approvedDevelopment = [
  "may-app-answer-status-directly",
  "may-app-clarify-ambiguous-target",
  "may-app-delegate-one-shot-outcome",
  "may-app-explain-task-reconciliation",
  "may-app-route-host-operation",
  "may-app-review-terminal-result",
  "may-app-replan-missing-proof",
];

function json(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("May App outcome management", () => {
  test("quarantines every legacy autonomous track", () => {
    const config = json(
      resolve(
        gymRoot,
        "benchmarks/may-learning/autonomous-training.json",
      ),
    );
    const enabled = config.tracks.filter(
      (track: { enabled?: boolean }) => track.enabled !== false,
    );
    expect(enabled).toEqual([
      expect.objectContaining({
        id: "app-outcome-management",
        benchmark: "may-app-outcome-management",
        scenarios: development,
      }),
    ]);
  });

  test("registers a new immutable competency and pilot learning unit", () => {
    const competency = json(
      resolve(
        gymRoot,
        "benchmarks/may-learning/competencies/system.manage-through-apps.json",
      ),
    );
    const unit = json(
      resolve(
        gymRoot,
        "benchmarks/may-learning/units/app-outcome-management/unit.json",
      ),
    );
    const communication = json(
      resolve(
        gymRoot,
        "benchmarks/may-learning/competencies/communication.plain-language.json",
      ),
    );
    expect(competency.objective).toContain("accountable installed App");
    expect(competency.objective).toContain("without choosing the App's tasks");
    expect(communication.objective).toContain("plain language");
    expect(communication.objective).toContain("necessary technical terms");
    expect(unit).toMatchObject({
      status: "pilot",
      benchmark: "may-app-outcome-management",
      release_benchmark: "may-app-outcome-management-transfer",
      development_scenarios: approvedDevelopment,
      release_scenarios: release,
      competencies: expect.arrayContaining(["communication.plain-language"]),
    });
  });

  test("calibrates plain-language judgment on representative Task results", () => {
    for (const scenario of [
      "may-app-answer-status-directly",
      "may-app-clarify-ambiguous-target",
      "may-app-delegate-one-shot-outcome",
      "may-app-explain-task-reconciliation",
      "may-app-replan-missing-proof",
      "may-app-review-terminal-result",
      "may-app-route-host-operation",
    ]) {
      const scenarioDir = resolve(gymRoot, "scenarios", scenario);
      const rubric = readFileSync(
        resolve(scenarioDir, "semantic_criteria.md"),
        "utf8",
      );
      const controls = json(resolve(scenarioDir, "semantic_controls.json"));
      expect(rubric).toContain("plain");
      expect(controls.cases.some((entry: any) => entry.expected === "pass")).toBe(true);
      expect(controls.cases.some((entry: any) => entry.expected === "fail")).toBe(true);
    }
  });

  test("uses only Hao-approved development truth and keeps other truth draft", () => {
    const developmentLabels = json(
      resolve(
        gymRoot,
        "benchmarks/may-app-outcome-management/labels.json",
      ),
    ).labels;
    expect(
      Object.entries(developmentLabels)
        .filter(([, label]: [string, any]) => label.status === "approved")
        .map(([scenario]) => scenario)
        .sort(),
    ).toEqual([...approvedDevelopment].sort());
    for (const scenario of approvedDevelopment) {
      expect(developmentLabels[scenario]).toMatchObject({
        status: "approved",
        approved_by: "hao",
      });
      expect(developmentLabels[scenario].approved_at).toBeString();
    }
    for (const scenario of development.filter(
      (entry) => !approvedDevelopment.includes(entry),
    )) {
      expect(developmentLabels[scenario]).toMatchObject({
        status: "draft",
        review_status: "ready",
        approved_by: null,
        approved_at: null,
      });
    }

    const releaseLabels = json(
      resolve(
        gymRoot,
        "benchmarks/may-app-outcome-management-transfer/labels.json",
      ),
    ).labels;
    expect(
      Object.values(releaseLabels).every(
        (label: any) =>
          label.status === "draft" &&
          label.review_status === "withheld" &&
          label.approved_by === null &&
          label.approved_at === null,
      ),
    ).toBe(true);
  });

  test("lets code enforce the approved Task-result shape", () => {
    for (const scenario of approvedDevelopment) {
      const scenarioDir = resolve(gymRoot, "scenarios", scenario);
      const metadata = json(resolve(scenarioDir, "scenario.json"));
      const task = readFileSync(resolve(scenarioDir, "task.md"), "utf8");
      expect(metadata.output_contract).toBe("task-agent-result");
      expect(task).toContain("through `finish()`");
      expect(task.replace(/\s+/g, " ")).toContain(
        "runner writes `task-result.json`",
      );
      expect(task).toContain("write the result file yourself");
    }
  });

  for (const scenario of [...development, ...release]) {
    test(`${scenario} uses the production Task-result boundary`, () => {
      const scenarioDir = resolve(gymRoot, "scenarios", scenario);
      const task = readFileSync(resolve(scenarioDir, "task.md"), "utf8");
      const expected = json(resolve(scenarioDir, "expected.json")).expected;
      expect(task).toContain("task-result.json");
      expect(["converged", "waiting"]).toContain(expected.state);
      if (expected.state === "waiting") {
        expect(expected.appId).toBeString();
        expect(expected.appId.length).toBeGreaterThan(0);
        expect(expected.inputKind).toBeString();
        expect(expected.inputKind.length).toBeGreaterThan(0);
      } else {
        expect(expected.contains?.response).toBeArray();
      }
    });
  }
});

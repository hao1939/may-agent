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
  test("calibrates plain-language judgment on representative Task results", () => {
    for (const scenario of approvedDevelopment) {
      const scenarioDir = resolve(gymRoot, "benchmarks/outcome-coordination/cases", scenario);
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

  test("uses only Hao-approved development truth and keeps other truth draft in consolidated suite", () => {
    const labels = json(
      resolve(
        gymRoot,
        "benchmarks/outcome-coordination/labels.json",
      ),
    ).labels;
    expect(
      Object.entries(labels)
        .filter(([, label]: [string, any]) => label.status === "approved")
        .map(([scenario]) => scenario)
        .sort(),
    ).toEqual([...approvedDevelopment].sort());
    for (const scenario of approvedDevelopment) {
      expect(labels[scenario]).toMatchObject({
        status: "approved",
        approved_by: "hao",
      });
      expect(labels[scenario].approved_at).toBeString();
    }
    for (const scenario of development.filter(
      (entry) => !approvedDevelopment.includes(entry),
    )) {
      expect(labels[scenario]).toMatchObject({
        status: "draft",
        review_status: "ready",
        approved_by: null,
        approved_at: null,
      });
    }
    for (const scenario of release) {
      expect(labels[scenario]).toMatchObject({
        status: "draft",
        review_status: "withheld",
        approved_by: null,
        approved_at: null,
      });
    }
  });

  test("lets code enforce the approved Task-result shape and forbids answer leaks in task.md", () => {
    const requiredFooter =
      "Act as May for this persisted request or reply. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not change the system or write the result file yourself.";
    for (const scenario of [...development, ...release]) {
      const scenarioDir = resolve(gymRoot, "benchmarks/outcome-coordination/cases", scenario);
      const task = readFileSync(resolve(scenarioDir, "task.md"), "utf8");
      expect(task).toContain(requiredFooter);
      expect(task).not.toContain("system-state.md");
      expect(task).not.toMatch(/The correct outcome is to|so omit generic permission|Treat this as supplied evidence; do not/);
    }
    for (const scenario of approvedDevelopment) {
      const scenarioDir = resolve(gymRoot, "benchmarks/outcome-coordination/cases", scenario);
      const metadata = json(resolve(scenarioDir, "case.json"));
      expect(metadata.output_contract).toBe("task-agent-result");
    }
  });

  test("treats May work as a persisted request rather than a Conversation Task", () => {
    for (const scenario of [...development, ...release]) {
      const task = readFileSync(
        resolve(gymRoot, "benchmarks/outcome-coordination/cases", scenario, "task.md"),
        "utf8",
      );
      expect(task).toMatch(/persisted (request|reply)/);
      expect(task).not.toContain("Conversation Task");
    }
  });

  for (const scenario of [...development, ...release]) {
    test(`${scenario} uses the production Task-result boundary`, () => {
      const scenarioDir = resolve(gymRoot, "benchmarks/outcome-coordination/cases", scenario);
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

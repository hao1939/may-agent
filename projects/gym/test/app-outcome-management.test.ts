import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gymRoot = resolve(import.meta.dirname, "..");
const development = [
  "may-app-answer-status-directly",
  "may-app-clarify-ambiguous-target",
  "may-app-delegate-one-shot-outcome",
  "may-app-delegate-recurring-outcome",
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

  test("registers a new immutable competency and draft learning unit", () => {
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
    expect(competency.objective).toContain("one accountable App request");
    expect(competency.objective).toContain("without choosing the App's tasks");
    expect(unit).toMatchObject({
      status: "draft",
      benchmark: "may-app-outcome-management",
      release_benchmark: "may-app-outcome-management-transfer",
      development_scenarios: development,
      release_scenarios: release,
    });
  });

  test("keeps all new truth draft until Hao reviews the exact cases", () => {
    for (const [benchmark, reviewStatus] of [
      ["may-app-outcome-management", "ready"],
      ["may-app-outcome-management-transfer", "withheld"],
    ]) {
      const labels = json(
        resolve(gymRoot, "benchmarks", benchmark, "labels.json"),
      ).labels;
      expect(
        Object.values(labels).every(
          (label: any) =>
            label.status === "draft" &&
            label.review_status === reviewStatus &&
            label.approved_by === null &&
            label.approved_at === null,
        ),
      ).toBe(true);
    }
  });

  for (const scenario of [...development, ...release]) {
    test(`${scenario} uses the real May disposition boundary`, () => {
      const scenarioDir = resolve(gymRoot, "scenarios", scenario);
      const task = readFileSync(resolve(scenarioDir, "task.md"), "utf8");
      const expected = json(resolve(scenarioDir, "expected.json")).expected;
      expect(task).toContain("may-disposition.json");
      expect(["complete", "delegate"]).toContain(expected.type);
      expect(JSON.stringify(expected)).not.toContain('"type":"task"');
    });
  }
});

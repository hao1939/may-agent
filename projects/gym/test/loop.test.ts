import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { compareRuns, renderReport } from "../src/loop/report";
import { rescoreRun } from "../src/loop/rescore";
import { appendAdjudication, machineVerdict, readManifest } from "../src/loop/store";
import { runLoop, verifyLoop } from "../src/loop/run";
import type { GroundTruthCatalog, LoopRunManifest, ScenarioRunResult, StoredTrial } from "../src/loop/types";
import { withTempDirAsync } from "./support/temp-dir";

function trial(scenario: string, number: number, verdict: StoredTrial["machine_verdict"]): StoredTrial {
  return {
    scenario,
    trial: number,
    machine_verdict: verdict,
    invalid_reason: verdict === "invalid" ? "harness" : null,
    label_status: "approved",
    result_path: `cases/${scenario}/trial-${number}/result.json`,
    artifact_path: null,
    transcript_path: null,
  };
}

function manifest(id: string, verdicts: StoredTrial["machine_verdict"][]): LoopRunManifest {
  return {
    schema_version: 1,
    run_id: id,
    phase: id === "baseline" ? "test" : "verify",
    benchmark: "example",
    benchmark_version: 1,
    baseline_run_id: id === "baseline" ? null : "baseline",
    candidate: id,
    agent: "may",
    trials_per_scenario: verdicts.length,
    scenarios: ["case-a"],
    started_at: "2026-01-01T00:00:00Z",
    completed_at: "2026-01-01T00:01:00Z",
    source: {
      suite_path: "benchmarks/example/suite.json",
      labels_path: "benchmarks/example/labels.json",
      suite_snapshot: "inputs/suite.json",
      labels_snapshot: "inputs/labels.json",
      evaluator_snapshot: "inputs/score-decision.cjs",
      scenarios_snapshot: "inputs/scenarios",
    },
    trials: verdicts.map((verdict, index) => trial("case-a", index + 1, verdict)),
  };
}

const approvedLabels: GroundTruthCatalog = {
  version: 1,
  benchmark: "example",
  labels: {
    "case-a": {
      status: "approved",
      source: "synthetic",
      rationale: "Human-approved expected behavior",
      approved_by: "hao",
      approved_at: "2026-01-01T00:00:00Z",
    },
  },
};

describe("loop evaluation", () => {
  it("separates invalid runs from agent failures", () => {
    const failed: ScenarioRunResult = { scenario: "case", agent: "may", passed: false, checks: [{ name: "x", passed: false }] };
    expect(machineVerdict(failed).verdict).toBe("fail");
    expect(machineVerdict({ ...failed, checks: [] }).verdict).toBe("invalid");
    expect(machineVerdict({ ...failed, agent_status: "error" }).verdict).toBe("invalid");
    expect(
      machineVerdict({ ...failed, checks: [{ name: "ground-truth", passed: false, category: "harness" }] }).verdict,
    ).toBe("invalid");
  });

  it("passes comparison only for approved, valid, improving candidates", () => {
    const comparison = compareRuns(manifest("baseline", ["fail", "pass"]), manifest("candidate", ["pass", "pass"]), approvedLabels);
    expect(comparison.gate).toBe("pass");
    expect(comparison.improved).toBe(true);
    expect(comparison.no_regressions).toBe(true);

    const draft = structuredClone(approvedLabels);
    draft.labels["case-a"]!.status = "draft";
    expect(compareRuns(manifest("baseline", ["fail"]), manifest("candidate", ["pass"]), draft).gate).toBe("needs-human-review");
    expect(compareRuns(manifest("baseline", ["pass"]), manifest("candidate", ["fail"]), draft).gate).toBe("needs-human-review");
  });

  it("persists frozen inputs, agent artifacts, and append-only reviews", async () =>
    withTempDirAsync(async (root) => {
      const previousState = process.env["GYM_STATE_DIR"];
      process.env["GYM_STATE_DIR"] = join(root, "state");
      const workDir = join(root, "agent-work");
      mkdirSync(workDir);
      writeFileSync(
        join(workDir, "alignment-decision.json"),
        '{"mode":"review","response_to_hao":"I will compare a bounded baseline before rollout."}\n',
      );
      writeFileSync(join(workDir, "transcript.jsonl"), '{"role":"assistant"}\n');
      try {
        const created = await runLoop(
          {
            phase: "test",
            benchmark: "may-alignment",
            scenarios: ["may-align-proof-before-adopt"],
            agent: "may",
            candidate: "baseline",
            trials: 1,
          },
          async (input) => {
            expect(existsSync(join(input.scenariosDir, input.scenario, "task.md"))).toBe(true);
            expect(
              existsSync(join(input.scenariosDir, "..", "benchmarks", "may-alignment", "score-decision.cjs")),
            ).toBe(true);
            return {
              stderr: "runner evidence\n",
              result: {
                scenario: "may-align-proof-before-adopt",
                agent: "may",
                passed: true,
                checks: [{ name: "decision", passed: true }],
                agent_status: "success",
                work_dir: workDir,
              },
            };
          },
        );
        const stored = readManifest(created.runDir);
        expect(stored.trials[0]?.label_status).toBe("draft");
        expect(existsSync(join(created.runDir, stored.source.suite_snapshot))).toBe(true);
        expect(existsSync(join(created.runDir, stored.source.labels_snapshot!))).toBe(true);
        expect(existsSync(join(created.runDir, stored.source.evaluator_snapshot!))).toBe(true);
        expect(existsSync(join(created.runDir, stored.source.scenarios_snapshot, stored.scenarios[0]!))).toBe(true);
        expect(existsSync(join(created.runDir, stored.trials[0]!.artifact_path!))).toBe(true);
        expect(existsSync(join(created.runDir, stored.trials[0]!.transcript_path!))).toBe(true);

        const rescored = rescoreRun(created.runDir);
        expect(rescored.trials[0]?.original_verdict).toBe("pass");
        expect(rescored.trials[0]?.rescored_verdict).toBe("fail");
        expect(existsSync(rescored.artifact_path)).toBe(true);
        expect(readManifest(created.runDir).trials[0]?.machine_verdict).toBe("pass");

        appendAdjudication(created.runDir, {
          run_id: stored.run_id,
          scenario: stored.scenarios[0]!,
          trial: 1,
          verdict: "pass",
          reviewer: "hao",
          reason: "Decision matches the approved intention.",
          created_at: "2026-01-01T00:00:00Z",
        });
        const report = renderReport(created.runDir, stored);
        expect(report).toContain("Human adjudications: 1");
        expect(report).toContain("Expected intent:");
        expect(report).toContain("May replied:");
        expect(readFileSync(join(created.runDir, "reviews.jsonl"), "utf-8")).toContain('"reviewer":"hao"');
      } finally {
        if (previousState === undefined) delete process.env["GYM_STATE_DIR"];
        else process.env["GYM_STATE_DIR"] = previousState;
      }
    }));

  it("rejects verification when a frozen benchmark input no longer matches", async () =>
    withTempDirAsync(async (root) => {
      const previousState = process.env["GYM_STATE_DIR"];
      process.env["GYM_STATE_DIR"] = join(root, "state");
      try {
        const created = await runLoop(
          {
            phase: "test",
            benchmark: "may-alignment",
            scenarios: ["may-align-proof-before-adopt"],
            agent: "may",
            candidate: "baseline",
            trials: 1,
          },
          async () => ({
            stderr: "",
            result: {
              scenario: "may-align-proof-before-adopt",
              agent: "may",
              passed: false,
              checks: [{ name: "decision-produced", passed: false }],
              agent_status: "success",
            },
          }),
        );
        const frozenSuite = join(created.runDir, created.manifest.source.suite_snapshot);
        writeFileSync(frozenSuite, `${readFileSync(frozenSuite, "utf-8")}\n`);

        await expect(
          verifyLoop({ baseline: created.runDir, candidate: "candidate" }),
        ).rejects.toThrow("create a new baseline");
      } finally {
        if (previousState === undefined) delete process.env["GYM_STATE_DIR"];
        else process.env["GYM_STATE_DIR"] = previousState;
      }
    }));
});

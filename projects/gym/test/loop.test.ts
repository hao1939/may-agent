import { describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseComparisonObjective } from "../src/loop/objective";
import { compareRuns, renderReport } from "../src/loop/report";
import { rescoreRun } from "../src/loop/rescore";
import {
  appendAdjudication,
  fingerprintValue,
  machineVerdict,
  readManifest,
  writeManifest,
} from "../src/loop/store";
import { assertFrozenInputs, runLoop, verifyLoop } from "../src/loop/run";
import type {
  GroundTruthCatalog,
  LoopRunManifest,
  ScenarioRunResult,
  StoredTrial,
} from "../src/loop/types";
import { withTempDirAsync } from "./support/temp-dir";

function trial(
  scenario: string,
  number: number,
  verdict: StoredTrial["machine_verdict"],
): StoredTrial {
  return {
    scenario,
    trial: number,
    machine_verdict: verdict,
    invalid_reason: verdict === "invalid" ? "harness" : null,
    label_status: "approved",
    result_path: `cases/${scenario}/trial-${number}/result.json`,
    artifact_path: null,
    transcript_path: null,
    duration_ms: 1_000,
    provenance: {
      prompt_fingerprint: "prompt",
      framework_revision: "framework",
      model: "model",
    },
  };
}

function manifest(
  id: string,
  verdicts: StoredTrial["machine_verdict"][],
): LoopRunManifest {
  return {
    schema_version: 2,
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
    proof: {
      input_fingerprint: "input",
      label_set_fingerprint: "labels",
      label_catalog_fingerprint: fingerprintValue(approvedLabels),
      candidate_fingerprint: id === "baseline" ? null : "candidate",
      semantic_judging: true,
      semantic_judge_fingerprint: "judges",
      harness_fingerprint: "harness",
      agent_prompt_fingerprints: ["prompt"],
      framework_revisions: ["framework"],
      models: ["model"],
    },
    source: {
      suite_path: "benchmarks/example/suite.json",
      labels_path: "benchmarks/example/labels.json",
      suite_snapshot: "inputs/suite.json",
      labels_snapshot: "inputs/labels.json",
      evaluator_snapshot: "inputs/score-decision.cjs",
      semantic_judges_snapshot: "inputs/semantic-judges/agents",
      harness_snapshot: "inputs/harness",
      scenarios_snapshot: "inputs/scenarios",
      candidate_snapshot: id === "baseline" ? null : "candidate",
    },
    trials: verdicts.map((verdict, index) =>
      trial("case-a", index + 1, verdict),
    ),
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
    const failed: ScenarioRunResult = {
      scenario: "case",
      agent: "may",
      passed: false,
      checks: [{ name: "x", passed: false }],
      agent_status: "success",
    };
    expect(machineVerdict(failed).verdict).toBe("fail");
    expect(machineVerdict({ ...failed, checks: [] }).verdict).toBe("invalid");
    const interrupted = machineVerdict({
      ...failed,
      passed: true,
      checks: [{ name: "artifact", passed: true }],
      agent_status: "interrupted",
      execution_error: "provider disconnected after session /tmp/session-1",
      summary: "scorer summary must not hide execution failure",
    });
    expect(interrupted.verdict).toBe("invalid");
    expect(interrupted.reason).toContain("provider disconnected");
    expect(interrupted.reason).not.toContain("scorer summary");
    expect(machineVerdict({ ...failed, agent_status: "error" }).verdict).toBe(
      "invalid",
    );
    expect(
      machineVerdict({
        ...failed,
        checks: [{ name: "ground-truth", passed: false, category: "harness" }],
      }).verdict,
    ).toBe("invalid");
    expect(machineVerdict({
      ...failed,
      passed: true,
      checks: [{ name: "required", passed: false }],
    }).verdict).toBe("invalid");
    expect(machineVerdict({
      ...failed,
      passed: true,
      checks: [{ name: "required", passed: "false" as unknown as boolean }],
    }).verdict).toBe("invalid");
    expect(machineVerdict({
      ...failed,
      passed: "yes" as unknown as boolean,
      checks: [{ name: "required", passed: true }],
    }).verdict).toBe("invalid");
    expect(machineVerdict({
      ...failed,
      passed: true,
      checks: [
        { name: "required", passed: true },
        { name: "advisory", passed: false, gate: false },
      ],
    }).verdict).toBe("pass");
  });

  it("passes comparison only for approved, valid, improving candidates", () => {
    const comparison = compareRuns(
      manifest("baseline", ["fail", "pass"]),
      manifest("candidate", ["pass", "pass"]),
      approvedLabels,
    );
    expect(comparison.gate).toBe("pass");
    expect(comparison.improved).toBe(true);
    expect(comparison.no_regressions).toBe(true);
    expect(comparison.same_framework_revision).toBe(true);

    const changedPrompt = manifest("candidate", ["pass", "pass"]);
    changedPrompt.proof.agent_prompt_fingerprints = ["candidate-prompt-a", "candidate-prompt-b"];
    changedPrompt.trials.forEach((item, index) => {
      item.provenance.prompt_fingerprint = changedPrompt.proof.agent_prompt_fingerprints[index]!;
    });
    expect(compareRuns(manifest("baseline", ["fail", "pass"]), changedPrompt, approvedLabels).gate).toBe("pass");

    const deterministicBaseline = manifest("baseline", ["fail", "pass"]);
    const deterministicCandidate = manifest("candidate", ["pass", "pass"]);
    for (const run of [deterministicBaseline, deterministicCandidate]) {
      run.proof.semantic_judging = false;
      run.proof.semantic_judge_fingerprint = null;
      run.source.semantic_judges_snapshot = null;
    }
    expect(compareRuns(deterministicBaseline, deterministicCandidate, approvedLabels).gate).toBe("pass");
    delete deterministicBaseline.proof.semantic_judge_fingerprint;
    expect(() => compareRuns(deterministicBaseline, deterministicCandidate, approvedLabels)).toThrow(
      "explicit semantic judge evidence",
    );

    const draft = structuredClone(approvedLabels);
    draft.labels["case-a"]!.status = "draft";
    expect(
      compareRuns(
        manifest("baseline", ["fail"]),
        manifest("candidate", ["pass"]),
        draft,
      ).gate,
    ).toBe("needs-human-review");
    expect(
      compareRuns(
        manifest("baseline", ["pass"]),
        manifest("candidate", ["fail"]),
        draft,
      ).gate,
    ).toBe("needs-human-review");

    const alteredApprovedTruth = structuredClone(approvedLabels);
    alteredApprovedTruth.labels["case-a"]!.rationale = "Different same-benchmark truth";
    expect(() => compareRuns(
      manifest("baseline", ["fail"]),
      manifest("candidate", ["pass"]),
      alteredApprovedTruth,
    )).toThrow("exact frozen truth catalog");

    const missingLabelSnapshot = manifest("baseline", ["fail"]);
    missingLabelSnapshot.source.labels_snapshot = null;
    missingLabelSnapshot.proof.label_set_fingerprint = null;
    expect(() => compareRuns(
      missingLabelSnapshot,
      manifest("candidate", ["pass"]),
      approvedLabels,
    )).toThrow("frozen label snapshot evidence");

    const invalidTimeline = manifest("candidate", ["pass"]);
    invalidTimeline.started_at = "not-a-time";
    expect(() => compareRuns(manifest("baseline", ["fail"]), invalidTimeline, approvedLabels)).toThrow(
      "incomplete or invalid candidate run",
    );
    invalidTimeline.started_at = "2026-01-01T00:02:00Z";
    expect(() => compareRuns(manifest("baseline", ["fail"]), invalidTimeline, approvedLabels)).toThrow(
      "incomplete or invalid candidate run",
    );
  });

  it("supports a declared timing benefit separately from quality", () => {
    const baseline = manifest("baseline", ["pass", "fail"]);
    const candidate = manifest("candidate", ["pass", "fail"]);
    candidate.trials.forEach((trial) => { trial.duration_ms = 800; });
    const qualityOnly = compareRuns(baseline, candidate, approvedLabels);
    expect(qualityOnly.gate).toBe("fail");
    expect(qualityOnly.duration.reduction_percent).toBeCloseTo(20);
    for (const run of [baseline, candidate]) {
      run.comparison_objective = { metric: "duration_ms", min_reduction_percent: 20 };
    }
    const compared = compareRuns(baseline, candidate, approvedLabels);
    expect(compared.gate).toBe("pass");
    expect(compared.improved).toBe(false);
    expect(compared.objective_met).toBe(true);
    expect(compared.duration.baseline.total_ms).toBe(2000);
    expect(compared.duration.candidate.total_ms).toBe(1600);
    candidate.trials[0]!.duration_ms = 801;
    expect(compareRuns(baseline, candidate, approvedLabels).objective_met).toBe(false);
    candidate.trials.forEach((trial) => { trial.duration_ms = 1000; });
    expect(compareRuns(baseline, candidate, approvedLabels).gate).toBe("fail");
  });

  it("keeps missing timing unknown without erasing quality evidence", () => {
    for (const unavailable of [null, undefined, -1, NaN, Infinity, "700"]) {
      const baseline = manifest("baseline", ["fail", "pass"]);
      const candidate = manifest("candidate", ["pass", "pass"]);
      candidate.trials[0]!.duration_ms = unavailable as number | null;
      expect(compareRuns(baseline, candidate, approvedLabels).gate).toBe("pass");
      for (const run of [baseline, candidate]) {
        run.comparison_objective = { metric: "duration_ms", min_reduction_percent: 20 };
      }
      const compared = compareRuns(baseline, candidate, approvedLabels);
      expect(compared.gate).toBe("needs-human-review");
      expect(compared.improved).toBe(true);
      expect(compared.objective_met).toBeNull();
      expect(compared.duration.candidate.measured_trials).toBe(1);
      expect(compared.duration.candidate.total_ms).toBeNull();
      expect(compared.duration.reduction_percent).toBeNull();
    }
    const baseline = manifest("baseline", ["pass"]);
    const candidate = manifest("candidate", ["pass"]);
    for (const run of [baseline, candidate]) {
      run.comparison_objective = { metric: "duration_ms", min_reduction_percent: 20 };
      run.trials[0]!.duration_ms = 0;
    }
    expect(compareRuns(baseline, candidate, approvedLabels).objective_met).toBeNull();
  });

  it("reports a timing benefit but holds a per-scenario regression despite equal total passes", () => {
    const baseline = manifest("baseline", ["pass"]);
    const candidate = manifest("candidate", ["fail"]);
    const labels = structuredClone(approvedLabels);
    labels.labels["case-b"] = structuredClone(labels.labels["case-a"]!);
    for (const run of [baseline, candidate]) {
      run.scenarios.push("case-b");
      run.trials.push(trial("case-b", 1, run === baseline ? "fail" : "pass"));
      run.proof.label_catalog_fingerprint = fingerprintValue(labels);
      run.comparison_objective = { metric: "duration_ms", min_reduction_percent: 20 };
    }
    candidate.trials.forEach((trial) => { trial.duration_ms = 500; });
    const compared = compareRuns(baseline, candidate, labels);
    expect(compared.objective_met).toBe(true);
    expect(compared.improved).toBe(true);
    expect(compared.no_regressions).toBe(false);
    expect(compared.gate).toBe("fail");
    expect(compared.scenarios[0]!.duration.reduction_percent).toBe(50);
    candidate.trials[0]!.duration_ms = null;
    const missingTiming = compareRuns(baseline, candidate, labels);
    expect(missingTiming.objective_met).toBeNull();
    expect(missingTiming.gate).toBe("fail");
  });

  it("validates the objective and prevents switching it for verification", () => {
    expect(parseComparisonObjective(undefined)).toEqual({ metric: "quality" });
    for (const value of [null, {}, "duration_ms", { metric: "cost" },
      { metric: "quality", min_reduction_percent: 20 },
      ...[0, -1, 101, NaN, Infinity, "20"].map((min_reduction_percent) => ({ metric: "duration_ms", min_reduction_percent })),
    ]) expect(() => parseComparisonObjective(value)).toThrow();
    const baseline = manifest("baseline", ["pass"]);
    const candidate = manifest("candidate", ["pass"]);
    candidate.comparison_objective = { metric: "duration_ms", min_reduction_percent: 20 };
    expect(() => compareRuns(baseline, candidate, approvedLabels)).toThrow("different frozen comparison objectives");
    baseline.comparison_objective = { metric: "duration_ms", min_reduction_percent: 30 };
    expect(() => compareRuns(baseline, candidate, approvedLabels)).toThrow("different frozen comparison objectives");
  });

  it("renders the objective, independent quality, timing coverage and evidence limits", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-objective-report-"));
    try {
      const baseline = manifest("baseline", ["pass"]);
      const candidate = manifest("candidate", ["pass"]);
      for (const run of [baseline, candidate]) {
        run.comparison_objective = { metric: "duration_ms", min_reduction_percent: 20 };
      }
      candidate.trials[0]!.duration_ms = 700;
      const comparison = compareRuns(baseline, candidate, approvedLabels);
      writeFileSync(join(root, "comparison.json"), JSON.stringify(comparison));
      const report = renderReport(root, candidate);
      expect(report.indexOf("## Comparison summary")).toBeLessThan(report.indexOf("## Machine evaluation"));
      appendAdjudication(root, {
        run_id: candidate.run_id, scenario: "case-a", trial: 1,
        verdict: "pass", reviewer: "fixture-reviewer", reason: "Contract fixture", created_at: "2026-01-01T00:02:00Z",
      });
      expect(renderReport(root, candidate)).toContain("Measured benefit target met: true");
      expect(report).toContain("At least 20% lower");
      expect(report).toContain("At least one quality improvement: false");
      expect(report).toContain("Measured benefit target met: true");
      expect(report).toContain("1000 ms (1/1 measured trials) → 700 ms");
      expect(report).toContain("not approval or statistical proof");
      candidate.trials[0]!.duration_ms = null;
      const incomplete = renderReport(root, candidate, compareRuns(baseline, candidate, approvedLabels));
      expect(incomplete).toContain("Measured benefit target met: unknown");
      expect(incomplete).toContain("unknown (0/1 measured trials)");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("rejects comparisons with mixed or different framework revisions", () => {
    const baseline = manifest("baseline", ["fail"]);
    const candidate = manifest("candidate", ["pass"]);
    baseline.proof.framework_revisions = ["framework-a", "framework-b"];
    candidate.proof.framework_revisions = ["framework-b"];

    expect(() => compareRuns(baseline, candidate, approvedLabels)).toThrow(
      "observed model, framework",
    );

    baseline.proof.framework_revisions = ["framework-a"];
    baseline.trials[0]!.provenance.framework_revision = "framework-a";
    candidate.trials[0]!.provenance.framework_revision = "framework-b";
    expect(() => compareRuns(baseline, candidate, approvedLabels)).toThrow(
      "different frozen inputs",
    );
  });

  it("persists frozen inputs, agent artifacts, and append-only reviews", async () =>
    withTempDirAsync(async (root) => {
      const previousState = process.env["GYM_STATE_DIR"];
      process.env["GYM_STATE_DIR"] = join(root, "state");
      const scenarioSandbox = mkdtempSync(join(tmpdir(), "gym-run-"));
      const workDir = join(scenarioSandbox, "work");
      mkdirSync(workDir);
      writeFileSync(
        join(workDir, "alignment-decision.json"),
        '{"mode":"review","response_to_hao":"I will compare a bounded baseline before rollout."}\n',
      );
      writeFileSync(
        join(workDir, "transcript.jsonl"),
        '{"role":"assistant"}\n',
      );
      mkdirSync(
        join(scenarioSandbox, "semantic-judges", "judge-a"),
        { recursive: true },
      );
      writeFileSync(
        join(scenarioSandbox, "semantic-judges", "judge-a", "verdict.json"),
        '{"cases":[]}\n',
      );
      writeFileSync(
        join(scenarioSandbox, "semantic-evaluation.json"),
        '{"status":"pass"}\n',
      );
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
            expect(
              existsSync(join(input.scenariosDir, input.scenario, "task.md")),
            ).toBe(true);
            expect(
              readFileSync(
                join(input.scenariosDir, input.scenario, "task.md"),
                "utf8",
              ),
            ).toBe(
              readFileSync(
                join(
                  import.meta.dirname,
                  "..",
                  "scenarios",
                  input.scenario,
                  "task.md",
                ),
                "utf8",
              ),
            );
            expect(
              existsSync(
                join(
                  input.scenariosDir,
                  "..",
                  "benchmarks",
                  "may-alignment",
                  "score-decision.cjs",
                ),
              ),
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
                gym_root: scenarioSandbox,
              },
            };
          },
        );
        const stored = readManifest(created.runDir);
        expect(stored.trials[0]?.label_status).toBe("approved");
        expect(
          existsSync(join(created.runDir, stored.source.suite_snapshot)),
        ).toBe(true);
        expect(
          existsSync(join(created.runDir, stored.source.labels_snapshot!)),
        ).toBe(true);
        expect(
          existsSync(join(created.runDir, stored.source.evaluator_snapshot!)),
        ).toBe(true);
        expect(
          existsSync(
            join(
              created.runDir,
              stored.source.scenarios_snapshot,
              stored.scenarios[0]!,
            ),
          ),
        ).toBe(true);
        expect(
          existsSync(join(created.runDir, stored.trials[0]!.artifact_path!)),
        ).toBe(true);
        expect(
          existsSync(join(created.runDir, stored.trials[0]!.transcript_path!)),
        ).toBe(true);
        expect(
          existsSync(
            join(
              created.runDir,
              "cases",
              stored.scenarios[0]!,
              "trial-1",
              "semantic-judges",
              "judge-a",
              "verdict.json",
            ),
          ),
        ).toBe(true);
        expect(
          existsSync(
            join(
              created.runDir,
              "cases",
              stored.scenarios[0]!,
              "trial-1",
              "semantic-evaluation.json",
            ),
          ),
        ).toBe(true);
        expect(existsSync(scenarioSandbox)).toBe(false);

        const rescored = rescoreRun(created.runDir);
        expect(rescored.trials[0]?.original_verdict).toBe("pass");
        expect(rescored.trials[0]?.rescored_verdict).toBe("invalid");
        expect(rescored.trials[0]?.summary).toContain("Deterministic result was fail");
        expect(existsSync(rescored.artifact_path)).toBe(true);
        expect(readManifest(created.runDir).trials[0]?.machine_verdict).toBe(
          "pass",
        );
        const invalidManifest = readManifest(created.runDir);
        invalidManifest.trials[0]!.machine_verdict = "invalid";
        invalidManifest.trials[0]!.invalid_reason = "semantic judge provider unavailable";
        writeManifest(created.runDir, invalidManifest);
        const invalidRescore = rescoreRun(created.runDir);
        expect(invalidRescore.trials[0]?.rescored_verdict).toBe("invalid");
        expect(invalidRescore.trials[0]?.invalid_reason).toContain("semantic rubric was not evaluated");
        writeManifest(created.runDir, stored);

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
        expect(
          readFileSync(join(created.runDir, "reviews.jsonl"), "utf-8"),
        ).toContain('"reviewer":"hao"');
      } finally {
        rmSync(scenarioSandbox, { recursive: true, force: true });
        if (previousState === undefined) delete process.env["GYM_STATE_DIR"];
        else process.env["GYM_STATE_DIR"] = previousState;
      }
    }));

  it("freezes an evaluator reused from another benchmark", async () =>
    withTempDirAsync(async (root) => {
      const previousState = process.env["GYM_STATE_DIR"];
      process.env["GYM_STATE_DIR"] = join(root, "state");
      try {
        const created = await runLoop(
          {
            phase: "test",
            benchmark: "may-app-outcome-management-transfer",
            scenarios: ["may-app-transfer-restart-closeout"],
            agent: "may",
            candidate: "baseline",
            trials: 1,
          },
          async (input) => {
            expect(
              existsSync(
                join(
                  input.scenariosDir,
                  "..",
                  "benchmarks",
                  "may-app-outcome-management",
                  "score-task-result.cjs",
                ),
              ),
            ).toBe(true);
            return {
              stderr: "",
              result: {
                scenario: input.scenario,
                agent: "may",
                passed: true,
                checks: [{ name: "decision", passed: true }],
                agent_status: "success",
              },
            };
          },
        );
        expect(
          existsSync(
            join(created.runDir, created.manifest.source.evaluator_snapshot!),
          ),
        ).toBe(true);
      } finally {
        if (previousState === undefined) delete process.env["GYM_STATE_DIR"];
        else process.env["GYM_STATE_DIR"] = previousState;
      }
    }));

  it("freezes evaluator-owned scenario overlays", async () =>
    withTempDirAsync(async (root) => {
      const previousState = process.env["GYM_STATE_DIR"];
      process.env["GYM_STATE_DIR"] = join(root, "state");
      const scenario =
        "may-learn-admission-review-material-human-authority-deliver";
      try {
        const created = await runLoop(
          {
            phase: "test",
            benchmark: "may-admission-review-closure",
            scenarios: [scenario],
            agent: "may",
            candidate: "baseline",
            trials: 1,
          },
          async (input) => {
            const frozenCriteria = readFileSync(
              join(input.scenariosDir, scenario, "semantic_criteria.md"),
              "utf8",
            );
            const ownerCriteria = readFileSync(
              join(
                import.meta.dirname,
                "..",
                "benchmarks",
                "may-alignment",
                "scenarios",
                scenario,
                "semantic_criteria.md",
              ),
              "utf8",
            );
            expect(frozenCriteria).toBe(ownerCriteria);
            return {
              stderr: "",
              result: {
                scenario: input.scenario,
                agent: "may",
                passed: true,
                checks: [{ name: "decision", passed: true }],
                agent_status: "success",
              },
            };
          },
        );
        expect(() =>
          assertFrozenInputs(created.runDir, created.manifest),
        ).not.toThrow();
      } finally {
        if (previousState === undefined) delete process.env["GYM_STATE_DIR"];
        else process.env["GYM_STATE_DIR"] = previousState;
      }
    }));

  it("freezes semantic files owned by the benchmark's own evaluator", async () =>
    withTempDirAsync(async (root) => {
      const previousState = process.env["GYM_STATE_DIR"];
      process.env["GYM_STATE_DIR"] = join(root, "state");
      const scenario = "may-align-proof-before-adopt";
      try {
        const created = await runLoop(
          {
            phase: "test",
            benchmark: "may-alignment",
            scenarios: [scenario],
            agent: "may",
            candidate: "baseline",
            trials: 1,
          },
          async (input) => {
            const frozenScenario = join(input.scenariosDir, scenario);
            expect(existsSync(join(frozenScenario, "semantic_criteria.md"))).toBe(
              true,
            );
            expect(
              existsSync(join(frozenScenario, "semantic_controls.json")),
            ).toBe(true);
            expect(readFileSync(join(frozenScenario, "task.md"), "utf8")).toBe(
              readFileSync(
                join(
                  import.meta.dirname,
                  "..",
                  "scenarios",
                  scenario,
                  "task.md",
                ),
                "utf8",
              ),
            );
            return {
              stderr: "",
              result: {
                scenario: input.scenario,
                agent: "may",
                passed: true,
                checks: [{ name: "decision", passed: true }],
                agent_status: "success",
              },
            };
          },
        );
        expect(() =>
          assertFrozenInputs(created.runDir, created.manifest),
        ).not.toThrow();
      } finally {
        if (previousState === undefined) delete process.env["GYM_STATE_DIR"];
        else process.env["GYM_STATE_DIR"] = previousState;
      }
    }));

  it("preserves the exact candidate bytes beside a verification run", async () =>
    withTempDirAsync(async (root) => {
      const previousState = process.env["GYM_STATE_DIR"];
      process.env["GYM_STATE_DIR"] = join(root, "state");
      const agentsRoot = join(root, "agents");
      const candidateDir = join(agentsRoot, ".lab", "candidate-a");
      mkdirSync(candidateDir, { recursive: true });
      writeFileSync(join(candidateDir, "AGENTS.md"), "Exact candidate guidance.\n");
      try {
        const created = await runLoop(
          {
            phase: "verify",
            benchmark: "may-alignment",
            scenarios: ["may-align-proof-before-adopt"],
            agent: "may",
            candidate: "candidate-a",
            trials: 1,
            agentsRoot,
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
        const snapshot = created.manifest.source.candidate_snapshot;
        expect(snapshot).toBe("candidate");
        expect(readFileSync(join(created.runDir, snapshot!, "AGENTS.md"), "utf-8"))
          .toBe("Exact candidate guidance.\n");
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
        const frozenSuite = join(
          created.runDir,
          created.manifest.source.suite_snapshot,
        );
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

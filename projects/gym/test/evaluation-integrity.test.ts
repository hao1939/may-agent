import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { compareRuns } from "../src/loop/report";
import { rescoreRun } from "../src/loop/rescore";
import { assertFrozenInputs, runLoop } from "../src/loop/run";
import {
  configureGymRoot,
  gymRoot,
  fingerprintValue,
  machineVerdict,
} from "../src/loop/store";
import type {
  GroundTruthCatalog,
  LoopRunManifest,
  MachineVerdict,
  ScenarioRunResult,
} from "../src/loop/types";
import { evaluateSemanticJudgeRuns } from "../src/scoring/semantic-judge";

// Synthetic contract fixtures. Their approval fields do not approve real truth.
function catalog(): GroundTruthCatalog {
  return {
    version: 1,
    benchmark: "contract-fixture",
    labels: {
      "case-a": {
        status: "approved",
        source: "synthetic",
        rationale: "Fixture for comparison admission, not a behavior judgment",
        approved_by: "fixture-human",
        approved_at: "2026-01-01T00:00:00Z",
      },
    },
  };
}

function manifest(candidate: boolean): LoopRunManifest {
  const verdicts: MachineVerdict[] = candidate
    ? ["pass", "pass"]
    : ["fail", "pass"];
  return {
    schema_version: 2,
    run_id: candidate ? "candidate" : "baseline",
    phase: candidate ? "verify" : "test",
    benchmark: "contract-fixture",
    benchmark_version: 1,
    baseline_run_id: candidate ? "baseline" : null,
    candidate: candidate ? "candidate" : "baseline",
    agent: "may",
    trials_per_scenario: 2,
    scenarios: ["case-a"],
    started_at: "2026-01-01T00:00:00Z",
    completed_at: "2026-01-01T00:01:00Z",
    proof: {
      input_fingerprint: "inputs",
      label_set_fingerprint: "labels",
      label_catalog_fingerprint: fingerprintValue(catalog()),
      candidate_fingerprint: candidate ? "candidate" : null,
      semantic_judging: true,
      semantic_judge_fingerprint: "judges",
      harness_fingerprint: "harness",
      agent_prompt_fingerprints: ["prompt"],
      framework_revisions: ["host"],
      models: ["model"],
    },
    source: {
      suite_path: "suite.json",
      labels_path: "labels.json",
      suite_snapshot: "inputs/suite.json",
      labels_snapshot: "inputs/labels.json",
      evaluator_snapshot: "inputs/scorer.cjs",
      semantic_judges_snapshot: "inputs/semantic-judges/agents",
      harness_snapshot: "inputs/harness",
      scenarios_snapshot: "inputs/scenarios",
      candidate_snapshot: candidate ? "candidate" : null,
    },
    trials: verdicts.map((verdict, index) => ({
      scenario: "case-a",
      trial: index + 1,
      machine_verdict: verdict,
      invalid_reason: null,
      label_status: "approved",
      result_path: `cases/case-a/trial-${index + 1}/result.json`,
      artifact_path: null,
      transcript_path: null,
      duration_ms: 10,
      provenance: {
        prompt_fingerprint: "prompt",
        framework_revision: "host",
        model: "model",
      },
    })),
  };
}

type Change = (
  baseline: LoopRunManifest,
  candidate: LoopRunManifest,
  labels: GroundTruthCatalog,
) => void;

describe("comparison evidence integrity", () => {
  const positives: Array<[string, Change]> = [
    ["valid improvement", () => {}],
    [
      "changed prompt is the treatment",
      (_baseline, candidate) => {
        candidate.proof.agent_prompt_fingerprints = [
          "new-prompt-a",
          "new-prompt-b",
        ];
        candidate.trials.forEach((trial, index) => {
          trial.provenance.prompt_fingerprint =
            candidate.proof.agent_prompt_fingerprints[index]!;
        });
      },
    ],
    [
      "explicit deterministic evaluation needs no judge assets",
      (baseline, candidate) => {
        for (const run of [baseline, candidate]) {
          run.proof.semantic_judging = false;
          run.proof.semantic_judge_fingerprint = null;
          run.source.semantic_judges_snapshot = null;
        }
      },
    ],
  ];
  for (const [name, change] of positives) {
    test(name, () => {
      const baseline = manifest(false),
        candidate = manifest(true),
        labels = catalog();
      change(baseline, candidate, labels);
      expect(compareRuns(baseline, candidate, labels).gate).toBe("pass");
    });
  }

  const holds: Array<[string, Change]> = [
    [
      "unchanged performance",
      (baseline) => {
        baseline.trials[0]!.machine_verdict = "pass";
      },
    ],
    [
      "regression",
      (baseline, candidate) => {
        baseline.trials[0]!.machine_verdict = "pass";
        candidate.trials[0]!.machine_verdict = "fail";
      },
    ],
    [
      "invalid judge or execution",
      (_baseline, candidate) => {
        candidate.trials[0]!.machine_verdict = "invalid";
      },
    ],
    [
      "draft current truth",
      (_baseline, _candidate, labels) => {
        labels.labels["case-a"]!.status = "draft";
      },
    ],
    [
      "truth was draft at execution",
      (baseline) => {
        baseline.trials[0]!.label_status = "draft";
      },
    ],
    [
      "wrong truth catalog",
      (_baseline, _candidate, labels) => {
        labels.benchmark = "other";
      },
    ],
    [
      "different model",
      (_baseline, candidate) => {
        candidate.proof.models = ["other"];
        candidate.trials.forEach((trial) => {
          trial.provenance.model = "other";
        });
      },
    ],
    [
      "missing observed model",
      (_baseline, candidate) => {
        candidate.trials[0]!.provenance.model = null;
      },
    ],
    [
      "mixed framework revisions",
      (_baseline, candidate) => {
        candidate.proof.framework_revisions.push("other");
      },
    ],
    [
      "changed trial count",
      (_baseline, candidate) => {
        candidate.trials_per_scenario = 3;
      },
    ],
    [
      "missing trial",
      (_baseline, candidate) => {
        candidate.trials.pop();
      },
    ],
    [
      "duplicate trial",
      (_baseline, candidate) => {
        candidate.trials[1]!.trial = 1;
      },
    ],
    [
      "incomplete run",
      (_baseline, candidate) => {
        candidate.completed_at = null;
      },
    ],
    [
      "invalid completion timestamp",
      (_baseline, candidate) => {
        candidate.completed_at = "not-a-time";
      },
    ],
    [
      "different agent",
      (_baseline, candidate) => {
        candidate.agent = "scout";
      },
    ],
    [
      "different benchmark version",
      (_baseline, candidate) => {
        candidate.benchmark_version++;
      },
    ],
    [
      "wrong baseline relationship",
      (_baseline, candidate) => {
        candidate.baseline_run_id = "other";
      },
    ],
    [
      "changed frozen inputs",
      (_baseline, candidate) => {
        candidate.proof.input_fingerprint = "other";
      },
    ],
    [
      "changed labels",
      (_baseline, candidate) => {
        candidate.proof.label_set_fingerprint = "other";
      },
    ],
    [
      "changed judges",
      (_baseline, candidate) => {
        candidate.proof.semantic_judge_fingerprint = "other";
      },
    ],
    [
      "changed Gym implementation",
      (_baseline, candidate) => {
        candidate.proof.harness_fingerprint = "other";
      },
    ],
    [
      "historical missing harness evidence",
      (baseline, candidate) => {
        for (const run of [baseline, candidate]) {
          delete run.proof.harness_fingerprint;
          delete run.source.harness_snapshot;
        }
      },
    ],
    [
      "historical missing judge evidence",
      (baseline, candidate) => {
        for (const run of [baseline, candidate]) {
          delete run.proof.semantic_judge_fingerprint;
          delete run.source.semantic_judges_snapshot;
        }
      },
    ],
    [
      "semantic run without its judge snapshot",
      (baseline, candidate) => {
        for (const run of [baseline, candidate]) {
          run.proof.semantic_judge_fingerprint = null;
          run.source.semantic_judges_snapshot = null;
        }
      },
    ],
    [
      "unknown verdict",
      (_baseline, candidate) => {
        candidate.trials[0]!.machine_verdict = "unknown" as MachineVerdict;
      },
    ],
  ];
  holds.push(
    [
      "different approved truth content",
      (_baseline, _candidate, labels) => {
        labels.labels["case-a"]!.rationale = "different meaning";
      },
    ],
    [
      "missing label snapshot provenance",
      (baseline, candidate) => {
        for (const run of [baseline, candidate]) {
          run.source.labels_snapshot = null;
          run.proof.label_set_fingerprint = null;
        }
      },
    ],
    [
      "missing canonical catalog identity",
      (baseline, candidate) => {
        for (const run of [baseline, candidate])
          delete run.proof.label_catalog_fingerprint;
      },
    ],
    [
      "invalid start timestamp",
      (_baseline, candidate) => {
        candidate.started_at = "not-a-time";
      },
    ],
    [
      "completion precedes start",
      (_baseline, candidate) => {
        candidate.started_at = "2026-01-01T00:02:00Z";
      },
    ],
  );
  for (const [name, change] of holds) {
    test(`cannot support ${name}`, () => {
      const baseline = manifest(false),
        candidate = manifest(true),
        labels = catalog();
      change(baseline, candidate, labels);
      // A typed hold or an admission error is acceptable; a pass is never so.
      let supported = false;
      try {
        supported = compareRuns(baseline, candidate, labels).gate === "pass";
      } catch {}
      expect(supported).toBe(false);
    });
  }
});

describe("scorer and execution validity", () => {
  const base: ScenarioRunResult = {
    scenario: "fixture",
    agent: "may",
    agent_status: "success",
    passed: true,
    checks: [{ name: "required", passed: true }],
  };
  test("advisory wording does not override required checks", () => {
    expect(
      machineVerdict({
        ...base,
        checks: [
          ...base.checks,
          { name: "wording", passed: false, gate: false },
        ],
      }).verdict,
    ).toBe("pass");
  });
  test("required failure remains an ordinary failure", () => {
    expect(
      machineVerdict({
        ...base,
        passed: false,
        checks: [{ name: "required", passed: false }],
      }).verdict,
    ).toBe("fail");
  });
  for (const status of ["error", "interrupted", undefined]) {
    test(`a good artifact cannot repair execution status ${status}`, () => {
      expect(machineVerdict({ ...base, agent_status: status }).verdict).toBe(
        "invalid",
      );
    });
  }
  for (const [name, change] of [
    [
      "overall pass contradicting a required check",
      { checks: [{ name: "required", passed: false }] },
    ],
    ["nonboolean overall verdict", { passed: "yes" }],
    [
      "nonboolean check verdict",
      { checks: [{ name: "required", passed: "false" }] },
    ],
    ["empty checks", { checks: [] }],
  ] as const) {
    test(`malformed report: ${name}`, () => {
      expect(
        machineVerdict({ ...base, ...change } as unknown as ScenarioRunResult)
          .verdict,
      ).toBe("invalid");
    });
  }
});

describe("independent judge identities", () => {
  const controls = {
    required_rules: ["safe"],
    cases: [
      {
        id: "positive",
        decision: { action: "keep" },
        expected: "pass" as const,
      },
      {
        id: "negative",
        decision: { action: "erase" },
        expected: "fail" as const,
      },
    ],
  };
  const report = {
    cases: (
      [
        ["candidate", "pass"],
        ["positive", "pass"],
        ["negative", "fail"],
      ] as const
    ).map(([id, verdict]) => ({
      id,
      overall: verdict,
      reason: "Synthetic boundary fixture",
      rules: [
        {
          rule: "safe",
          verdict,
          evidence: [verdict === "pass" ? "keep" : "erase"],
          contradictions: [],
          confidence: 0.99,
        },
      ],
    })),
  };
  for (const [name, agents, models, expected] of [
    ["distinct models", ["judge-a", "judge-b"], ["model-a", "model-b"], "pass"],
    [
      "duplicate model",
      ["judge-a", "judge-b"],
      ["model-a", "model-a"],
      "invalid",
    ],
    [
      "duplicate agent",
      ["judge-a", "judge-a"],
      ["model-a", "model-b"],
      "invalid",
    ],
    ["missing model", ["judge-a", "judge-b"], [null, "model-b"], "invalid"],
  ] as const) {
    test(name, () => {
      const runs = agents.map((agent, index) => ({
        agent,
        model: models[index]!,
        status: "done",
        report,
      }));
      expect(evaluateSemanticJudgeRuns(runs, controls).status).toBe(expected);
    });
  }
});

function save(root: string, relative: string, value: unknown): void {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    typeof value === "string" ? value : JSON.stringify(value),
  );
}

describe("diagnostic rescore evidence", () => {
  for (const control of [
    {
      name: "deterministic scorer correction",
      status: "success",
      original: "fail",
      oldSemantic: false,
      currentSemantic: false,
      emptyChecks: false,
      want: "pass",
    },
    {
      name: "runtime error is not repaired by rescoring",
      status: "error",
      original: "invalid",
      oldSemantic: false,
      currentSemantic: false,
      emptyChecks: false,
      want: "invalid",
    },
    {
      name: "semantic failure needs new judgment",
      status: "success",
      original: "fail",
      oldSemantic: true,
      currentSemantic: true,
      emptyChecks: false,
      want: "invalid",
    },
    {
      name: "removed rubric does not erase frozen semantic failure",
      status: "success",
      original: "fail",
      oldSemantic: true,
      currentSemantic: false,
      emptyChecks: false,
      want: "invalid",
    },
    {
      name: "added rubric needs judgment",
      status: "success",
      original: "pass",
      oldSemantic: false,
      currentSemantic: true,
      emptyChecks: false,
      want: "invalid",
    },
    {
      name: "empty scorer result is invalid",
      status: "success",
      original: "fail",
      oldSemantic: false,
      currentSemantic: false,
      emptyChecks: true,
      want: "invalid",
    },
  ] as const) {
    test(control.name, () => {
      const root = mkdtempSync(join(tmpdir(), "gym-rescore-integrity-"));
      const previousRoot = gymRoot;
      try {
        configureGymRoot(root);
        save(root, "benchmarks/contract-fixture/suite.json", {
          name: "contract-fixture",
          version: 1,
          scenarios: ["case-a"],
          evaluator: "score.cjs",
        });
        save(
          root,
          "benchmarks/contract-fixture/score.cjs",
          `module.exports.scoreDecision=()=>(${JSON.stringify({ passed: true, checks: control.emptyChecks ? [] : [{ name: "deterministic", passed: true }], summary: "synthetic scorer" })});`,
        );
        save(root, "scenarios/case-a/task.md", "Synthetic diagnostic fixture");
        if (control.currentSemantic)
          save(
            root,
            "scenarios/case-a/semantic_criteria.md",
            "Current meaning",
          );
        if (control.oldSemantic)
          save(
            root,
            "run/inputs/scenarios/case-a/semantic_criteria.md",
            "Frozen meaning",
          );
        const run = manifest(false);
        run.trials_per_scenario = 1;
        run.proof.semantic_judging = control.oldSemantic;
        const trial = run.trials[0]!;
        run.trials = [trial];
        trial.machine_verdict = control.original;
        trial.invalid_reason =
          control.original === "invalid" ? "provider error" : null;
        trial.artifact_path = "cases/case-a/trial-1/alignment-decision.json";
        save(root, "run/manifest.json", run);
        save(root, `run/${trial.artifact_path}`, { answer: "fixture" });
        save(root, `run/${trial.result_path}`, {
          scenario: "case-a",
          agent: "may",
          agent_status: control.status,
          passed: control.original === "pass",
          checks: [{ name: "original", passed: control.original === "pass" }],
          ...(control.oldSemantic
            ? {
                semantic_evaluation: {
                  status: "fail",
                  valid: true,
                  passed: false,
                },
              }
            : {}),
        });
        expect(rescoreRun(join(root, "run")).trials[0]!.rescored_verdict).toBe(
          control.want,
        );
      } finally {
        configureGymRoot(previousRoot);
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe("frozen evaluator implementation", () => {
  for (const drift of ["judge", "harness", "harness-during-run"] as const) {
    test(`rejects ${drift} drift`, async () => {
      const root = mkdtempSync(join(tmpdir(), "gym-frozen-integrity-"));
      const previousRoot = gymRoot;
      const previousState = process.env.GYM_STATE_DIR;
      try {
        configureGymRoot(root);
        process.env.GYM_STATE_DIR = join(root, "state");
        save(root, "benchmarks/probe/suite.json", {
          name: "probe",
          version: 1,
          scenarios: ["case-a"],
          evaluator: "score.cjs",
        });
        save(
          root,
          "benchmarks/probe/score.cjs",
          "module.exports.scoreDecision=()=>({passed:true,checks:[{name:'fixture',passed:true}]});",
        );
        save(
          root,
          "scenarios/case-a/task.md",
          "Synthetic snapshot fixture; the executor below makes no model calls.",
        );
        save(
          root,
          "scenarios/case-a/semantic_criteria.md",
          "Judge synthetic meaning",
        );
        save(root, "benchmarks/semantic-judges/agents/judge/agent.json", {
          name: "judge",
          model: "first",
        });
        save(root, "src/cli.ts", "// first synthetic runner");
        const start = () =>
          runLoop(
            {
              phase: "test",
              benchmark: "probe",
              agent: "may",
              candidate: "baseline",
              trials: 1,
            },
            async () => {
              if (drift === "harness-during-run")
                save(root, "src/cli.ts", "// changed during execution");
              return {
                result: {
                  scenario: "case-a",
                  agent: "may",
                  agent_status: "success",
                  passed: true,
                  checks: [{ name: "fixture", passed: true }],
                },
                stderr: "",
              };
            },
          );
        if (drift === "harness-during-run") {
          await expect(start()).rejects.toThrow();
        } else {
          const baseline = await start();
          assertFrozenInputs(baseline.runDir, baseline.manifest);
          if (drift === "judge")
            save(root, "benchmarks/semantic-judges/agents/judge/agent.json", {
              name: "judge",
              model: "different",
            });
          else save(root, "src/cli.ts", "// changed judge task or aggregation");
          expect(() =>
            assertFrozenInputs(baseline.runDir, baseline.manifest),
          ).toThrow();
        }
      } finally {
        configureGymRoot(previousRoot);
        if (previousState === undefined) delete process.env.GYM_STATE_DIR;
        else process.env.GYM_STATE_DIR = previousState;
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

import { describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { listOwnedCases, readBenchmark } from "../src/cases/catalog";
import { validateCaseCatalog } from "../src/cases/validate";
import { runLoop, verifyLoop } from "../src/loop/run";
import type { ScenarioExecutor } from "../src/loop/run";
import { fingerprintTree, fingerprintValue } from "../src/loop/store";
import { commissionPlan, loadPlan, parsePlan } from "../src/plans/plan";
import {
  buildPlanReport,
  renderPlanReport,
  type OwnerDecision,
} from "../src/plans/report";
import { withTempDir, withTempDirAsync } from "./support/temp-dir";

const root = resolve(import.meta.dirname, ".."),
  repo = resolve(root, "../..");
const profile = (agent = "alex") =>
  join(repo, "projects/alex.app/agents", agent, "evaluation-plan.json");
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const save = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

const syntheticExecutor =
  (temp: string, framework = "synthetic-framework"): ScenarioExecutor =>
  async (input) => {
    const work = join(temp, "work", input.scenario);
    mkdirSync(work, { recursive: true });
    save(join(work, "task-result.json"), {
      state: "converged",
      summary: "Synthetic executor fixture; no model evaluation.",
      facts: [],
    });
    writeFileSync(
      join(work, "transcript.jsonl"),
      JSON.stringify({
        role: "assistant",
        content: "Synthetic executor fixture; no model evaluation.",
      }) + "\n",
    );
    return {
      stderr: "Synthetic executor fixture; no model calls.",
      result: {
        scenario: input.scenario,
        agent: input.agent,
        agent_status: "success",
        passed: true,
        checks: [{ name: "synthetic-test-evidence", passed: true }],
        work_dir: work,
        prompt_hash: "synthetic-prompt",
        framework_sha: framework,
        model: "gpt-5.6-sol",
      },
    };
  };

function localPlan(temp: string) {
  const dir = join(temp, "alex");
  mkdirSync(dir);
  cpSync(profile(), join(dir, "evaluation-plan.json"));
  const planPath = join(dir, "evaluation-plan.json"), plan = json(planPath);
  for (const assignment of plan.benchmarks) assignment.baseline_run_id = null;
  save(planPath, plan);
  cpSync(
    join(repo, "projects/alex.app/agents/alex/agent.json"),
    join(dir, "agent.json"),
  );
  return join(dir, "evaluation-plan.json");
}

async function fixture(
  temp: string,
  run: (input: {
    plan: string;
    runs: string;
    directory: string;
  }) => void | Promise<void>,
) {
  const previous = process.env.GYM_STATE_DIR;
  process.env.GYM_STATE_DIR = join(temp, "state");
  try {
    const plan = localPlan(temp),
      runs = join(temp, "state/benchmarks");
    const agentsRoot = join(temp, "agents");
    mkdirSync(join(agentsRoot, ".lab/fixture"), { recursive: true });
    writeFileSync(
      join(agentsRoot, ".lab/fixture/AGENTS.md"),
      "Synthetic candidate for deterministic tests; no models.\n",
    );
    const created = await runLoop(
      {
        phase: "test",
        planPath: plan,
        benchmark: "outcome-completion",
        agent: "alex",
        candidate: "fixture",
        agentsRoot,
        trials: 1,
      },
      syntheticExecutor(temp),
    );
    await run({ plan, runs, directory: created.runDir });
  } finally {
    if (previous === undefined) delete process.env.GYM_STATE_DIR;
    else process.env.GYM_STATE_DIR = previous;
  }
}

describe("whole benchmark plans", () => {
  test("pilot plans assign compatible complete benchmarks and every active collection has one contract", () => {
    for (const agent of ["alex", "tech-lead"]) {
      const plan = loadPlan(profile(agent), root);
      expect(plan.owner).toBe("alex");
      expect(plan.benchmarks.length).toBeGreaterThan(0);
      expect(plan.benchmarks.every((b) => b.baseline_run_id === null || typeof b.baseline_run_id === "string")).toBe(
        true,
      );
    }
    expect(validateCaseCatalog(root).issues).toEqual([]);
    for (const entry of listOwnedCases(root))
      expect(entry.suite.subject_role).toBeTruthy();
  });

  for (const patch of [
    (p: any) => {
      p.benchmarks[0].case_ids = ["alex-judge-close-verified-bounded-outcome"];
    },
    (p: any) => {
      p.benchmarks[0].expected_override = {};
    },
    (p: any) => {
      p.evaluation.case_filter = "core";
    },
    (p: any) => {
      p.evaluation.trials = 0;
    },
    (p: any) => {
      p.evaluation.timeout_minutes = -1;
    },
    (p: any) => {
      p.benchmarks.push(p.benchmarks[0]);
    },
    (p: any) => {
      p.improvement.evidence = [];
    },
  ])
    test(`invalid plan cannot commission a run: ${patch.toString()}`, () => {
      const plan = json(profile());
      patch(plan);
      expect(() => parsePlan(plan)).toThrow();
    });

  test("role, version, missing evidence and adjacent model mismatches are rejected", () =>
    withTempDir((temp) => {
      const path = localPlan(temp),
        original = json(path);
      for (const mutate of [
        (p: any) => {
          p.benchmarks[0] = {
            ...p.benchmarks[0],
            id: "repair-and-verification",
          };
        },
        (p: any) => {
          p.benchmarks[0].version = 100;
        },
        (p: any) => {
          p.improvement.evidence = ["projects/gym/no-such-evidence.md"];
        },
        (p: any) => {
          p.evaluation.model = "wrong-model";
        },
      ]) {
        const p = structuredClone(original);
        mutate(p);
        save(path, p);
        expect(() => loadPlan(path, root)).toThrow();
      }
    }));

  test("a partial/core selection, target mismatch or changed allowance cannot commission the plan", () => {
    const scenarios = readBenchmark(root, "outcome-completion").suite.scenarios;
    const input = {
      path: profile(),
      root,
      benchmark: "outcome-completion",
      agent: "alex",
      trials: 1,
      scenarios,
    };
    for (const change of [
      { scenarios: scenarios.slice(0, 2) },
      { trials: 2 },
      { agent: "tech-lead" },
      { timeout: 10 },
    ])
      expect(() => commissionPlan({ ...input, ...change })).toThrow();
    expect(commissionPlan(input).timeout).toBe(4);
  });
});

describe("retained evidence and history", () => {
  test("full synthetic run freezes its plan, stays diagnostic and reports unknown usage without modifying history", async () =>
    withTempDirAsync((temp) =>
      fixture(temp, ({ plan, runs, directory }) => {
        const manifest = json(join(directory, "manifest.json"));
        const commissionedRevision = json(plan).revision;
        expect(manifest.evaluation_plan.revision).toBe(commissionedRevision);
        expect(
          json(join(directory, manifest.evaluation_plan.snapshot)),
        ).toEqual(json(plan));
        const before = fingerprintTree(runs),
          report = buildPlanReport(plan, root, runs);
        expect(report.history[0]?.current).toBe(true);
        expect(report.history[0]?.counts).toEqual({
          pass: manifest.scenarios.length * manifest.trials_per_scenario,
          fail: 0,
          invalid: 0,
        });
        expect(report.history[0]?.duration_ms).toBeNull();
        expect(report.history[0]?.total_tokens).toBeNull();
        const markdown = renderPlanReport(report, root);
        expect(markdown).toContain(manifest.trials.every((t: any) => t.label_status === "approved")
          ? "approved truth" : "draft/missing truth; diagnostic only");
        expect(markdown).toContain(
          "Adoption, source readiness, integration and activation are unknown",
        );
        expect(markdown).toContain("**Next action:**");
        expect(fingerprintTree(runs)).toBe(before);
        const revised = json(plan);
        revised.revision++;
        revised.improvement.next_action = "A revised next action.";
        save(plan, revised);
        const newer = buildPlanReport(plan, root, runs);
        expect(newer.history[0]?.current).toBe(true); // Same measured contract, newer planning decision.
        expect(
          json(join(directory, manifest.evaluation_plan.snapshot)).revision,
        ).toBe(commissionedRevision);
      }),
    ));

  test("partial, incomplete, duplicate, historical and inconsistent evidence stay visible without becoming current", async () =>
    withTempDirAsync((temp) =>
      fixture(temp, ({ plan, runs, directory }) => {
        const path = join(directory, "manifest.json"),
          original = json(path);
        const cases: Array<[(p: any) => void, string]> = [
          [
            (p) => {
              p.trials.pop();
            },
            "trial grid",
          ],
          [
            (p) => {
              p.trials[1] = p.trials[0];
            },
            "trial grid",
          ],
          [
            (p) => {
              p.completed_at = null;
            },
            "incomplete",
          ],
          [
            (p) => {
              delete p.evaluation_plan;
            },
            "without a commissioning plan",
          ],
          [
            (p) => {
              p.benchmark = "alex-judgment";
            },
            "historical benchmark",
          ],
          [
            (p) => {
              p.proof.models = ["other-model"];
            },
            "model/framework/prompt",
          ],
          [
            (p) => {
              p.evaluation_plan.benchmark_fingerprint = "changed";
            },
            "definition changed",
          ],
          [
            (p) => {
              p.evaluation_kinds = {};
            },
            "kind identity",
          ],
          [
            (p) => {
              p.trials[0].machine_verdict = "fail";
            },
            "contradicts",
          ],
          [
            (p) => {
              p.trials[0].result_path = "missing-result.json";
            },
            "Missing retained",
          ],
          [
            (p) => {
              p.trials[0].artifact_path = null;
            },
            "Missing retained task artifact",
          ],
          [
            (p) => {
              p.trials[0].label_status = p.trials[0].label_status === "approved" ? "draft" : "approved";
            },
            "truth status contradicts",
          ],
          [
            (p) => {
              p.trials[0].duration_ms = 1;
            },
            "resource telemetry contradicts",
          ],
        ];
        for (const [mutate, message] of cases) {
          const m = structuredClone(original);
          mutate(m);
          save(path, m);
          const report = buildPlanReport(plan, root, runs),
            h = report.history[0]!;
          expect(h.current).toBe(false);
          expect(h.limit).toContain(message);
          expect(renderPlanReport(report, root)).toContain("unmeasured");
          expect(existsSync(path)).toBe(true);
        }
        save(path, original);
        writeFileSync(
          join(directory, "inputs/corruption.txt"),
          "Changed frozen evidence",
        );
        expect(buildPlanReport(plan, root, runs).history[0]?.limit).toContain(
          "input fingerprint mismatch",
        );
      }),
    ));

  test("invalid runtime trials remain visible separately from failures", async () =>
    withTempDirAsync((temp) =>
      fixture(temp, ({ plan, runs, directory }) => {
        const path = join(directory, "manifest.json"),
          m = json(path),
          t = m.trials[0];
        const resultPath = join(directory, t.result_path),
          result = json(resultPath);
        result.agent_status = "error";
        result.passed = false;
        result.checks = [];
        save(resultPath, result);
        t.machine_verdict = "invalid";
        t.invalid_reason = "Synthetic runtime failure";
        save(path, m);
        const h = buildPlanReport(plan, root, runs).history[0]!;
        expect(h.current).toBe(true);
        expect(h.counts).toEqual({
          pass: m.scenarios.length * m.trials_per_scenario - 1,
          fail: 0,
          invalid: 1,
        });
        expect(
          renderPlanReport(buildPlanReport(plan, root, runs), root),
        ).toContain("Synthetic runtime failure");
      }),
    ));

  test("planning revisions do not change frozen test identity; execution framework changes create a separate series", async () =>
    withTempDirAsync((temp) =>
      fixture(temp, async ({ plan, runs, directory }) => {
        const original = json(join(directory, "manifest.json")),
          p = json(plan);
        p.revision++;
        p.improvement.next_action = "A new planning decision.";
        save(plan, p);
        const same = await runLoop(
          {
            phase: "test",
            planPath: plan,
            benchmark: "outcome-completion",
            agent: "alex",
            candidate: "baseline",
            trials: 1,
          },
          syntheticExecutor(temp),
        );
        expect(same.manifest.proof.input_fingerprint).toBe(
          original.proof.input_fingerprint,
        );
        expect(same.manifest.evaluation_plan?.fingerprint).not.toBe(
          original.evaluation_plan.fingerprint,
        );
        await runLoop(
          {
            phase: "test",
            planPath: plan,
            benchmark: "outcome-completion",
            agent: "alex",
            candidate: "baseline",
            trials: 1,
          },
          syntheticExecutor(temp, "another-framework"),
        );
        const histories = buildPlanReport(plan, root, runs).history;
        expect(histories.every((h) => h.current)).toBe(true);
        expect(new Set(histories.map((h) => h.series)).size).toBe(2);
      }),
    ));

  test("resource totals require complete measured coverage for each field", async () =>
    withTempDirAsync((temp) =>
      fixture(temp, ({ plan, runs, directory }) => {
        const path = join(directory, "manifest.json"),
          m = json(path);
        for (const t of m.trials) {
          const resultPath = join(directory, t.result_path),
            r = json(resultPath);
          t.duration_ms = r.duration_ms = 10;
          t.usage = r.usage = {
            turns: 1,
            ops: 2,
            total_tokens: 100,
            tokens_measured: true,
            ops_measured: true,
          };
          save(resultPath, r);
        }
        save(path, m);
        let h = buildPlanReport(plan, root, runs).history[0]!;
        const gridSize = m.scenarios.length * m.trials_per_scenario;
        expect(h.duration_ms).toBe(10 * gridSize);
        expect(h.total_tokens).toBe(100 * gridSize);
        expect(h.ops).toBe(2 * gridSize);
        const t = m.trials[0],
          resultPath = join(directory, t.result_path),
          r = json(resultPath);
        t.usage.tokens_measured = r.usage.tokens_measured = false;
        save(resultPath, r);
        save(path, m);
        h = buildPlanReport(plan, root, runs).history[0]!;
        expect(h.current).toBe(true);
        expect(h.total_tokens).toBeNull();
        expect(h.ops).toBe(2 * gridSize);
      }),
    ));

  test("a baseline must match the complete current benchmark and approved truth", async () =>
    withTempDirAsync((temp) =>
      fixture(temp, ({ plan, runs, directory }) => {
        const p = json(plan),
          m = json(join(directory, "manifest.json"));
        p.benchmarks[0].baseline_run_id = m.run_id;
        save(plan, p);
        const selected = buildPlanReport(plan, root, runs);
        if (m.trials.every((t: any) => t.label_status === "approved"))
          expect(selected.issues).toEqual([]);
        else expect(selected.issues.join("\n")).toContain("unapproved");
        p.benchmarks[0].baseline_run_id = "missing-run";
        save(plan, p);
        expect(buildPlanReport(plan, root, runs).issues.join("\n")).toContain(
          "missing",
        );
      }),
    ));

  test("explicit decisions validate exact run/candidate identity without implying activation", async () =>
    withTempDirAsync((temp) =>
      fixture(temp, ({ plan, runs, directory }) => {
        // Repository-relative references are part of the production plan contract.
        // For isolated decisions, use this test's temporary directory as the evidence root.
        const path = join(temp, "decision.json"),
          m = json(join(directory, "manifest.json"));
        const p = json(plan);
        p.improvement.evidence = ["decision.json"];
        p.decisions = ["decision.json"];
        save(plan, p);
        const d: OwnerDecision = {
          schema_version: 1,
          agent: "alex",
          owner: "alex",
          run_id: m.run_id,
          benchmark: m.benchmark,
          benchmark_version: m.benchmark_version,
          input_fingerprint: m.proof.input_fingerprint,
          candidate_fingerprint: m.proof.candidate_fingerprint,
          disposition: "defer",
          evidence: "decision.json",
          source_readiness: "unverified",
          integration: "not-applied",
          activation: "unknown",
          created_at: "2026-11-16T00:00:00Z",
        };
        save(path, d);
        let report = buildPlanReport(plan, root, runs, temp);
        expect(report.decisions).toHaveLength(1);
        expect(renderPlanReport(report, root, temp)).toContain(
          "activation unknown",
        );
        save(path, { ...d, candidate_fingerprint: "another-candidate" });
        report = buildPlanReport(plan, root, runs, temp);
        expect(report.decisions).toHaveLength(0);
        expect(report.issues.join("\n")).toContain("identity");
      }),
    ));

  test("missing storage and malformed manifests are reported, not silently counted as zero", () =>
    withTempDir((temp) => {
      expect(
        buildPlanReport(profile(), root, join(temp, "missing")).issues.join(
          "\n",
        ),
      ).toContain("unavailable");
      const runs = join(temp, "runs"),
        malformed = join(runs, "malformed");
      mkdirSync(malformed, { recursive: true });
      writeFileSync(join(malformed, "manifest.json"), "{}");
      const report = buildPlanReport(profile(), root, runs);
      expect(report.issues.join("\n")).toContain("Malformed");
      expect(report.history).toHaveLength(0);
    }));

  test("verification cannot silently discard the baseline's commissioning plan", async () =>
    withTempDirAsync((temp) =>
      fixture(temp, async ({ directory }) => {
        await expect(
          verifyLoop({ baseline: directory, candidate: "fixture" }),
        ).rejects.toThrow("requires --plan");
      }),
    ));
});

test("plan CLI validates and renders without model calls", () =>
  withTempDir((temp) => {
    const runs = join(temp, "runs");
    const cliPlan = localPlan(temp);
    mkdirSync(runs);
    for (const command of ["validate", "report"]) {
      const child = Bun.spawnSync(
        [
          "bun",
          join(root, "src/cli.ts"),
          "plan",
          command,
          cliPlan,
          "--runs",
          runs,
          "--json",
        ],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      expect(child.exitCode).toBe(0);
      const output = JSON.parse(child.stdout.toString());
      expect(
        command === "validate" ? output.passed : output.plan.agent === "alex",
      ).toBe(true);
    }
    const rootCommand = Bun.spawnSync(
      [
        "bun",
        "run",
        "gym:plan",
        "report",
        "projects/alex.app/agents/alex/evaluation-plan.json",
        "--runs",
        runs,
        "--json",
      ],
      { cwd: repo, stdout: "pipe", stderr: "pipe" },
    );
    expect(rootCommand.exitCode).toBe(0);
    expect(JSON.parse(rootCommand.stdout.toString()).plan.agent).toBe("alex");
    const bad = Bun.spawnSync(
      [
        "bun",
        join(root, "src/cli.ts"),
        "plan",
        "report",
        profile(),
        "--case",
        "anything",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    expect(bad.exitCode).not.toBe(0);
    expect(fingerprintValue(json(profile()))).toHaveLength(64);
  }), 15_000);

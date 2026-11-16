import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertFrozenInputs, runLoop, verifyLoop } from "../src/loop/run";
import { buildPlanReport } from "../src/plans/report";
import { configureGymRoot, fingerprintTree, gymRoot, snapshotHarness } from "../src/loop/store";
import { withTempDirAsync } from "./support/temp-dir";

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const save = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

async function fixture(run: (f: {
  root: string; owner: string; plan: string; directory: string; runs: string;
}) => void | Promise<void>) {
  await withTempDirAsync(async temp => {
    const previousRoot = gymRoot, previousState = process.env.GYM_STATE_DIR;
    const root = join(temp, "projects/gym"), owner = join(root, "benchmarks/measurement"),
      agent = join(temp, "alex"), state = join(temp, "state"), plan = join(agent, "evaluation-plan.json");
    mkdirSync(owner, { recursive: true }); mkdirSync(agent);
    // Frozen harness source is real; all execution/results and approval metadata
    // below are explicitly synthetic test fixtures, never model or human truth.
    snapshotHarness(root);
    save(join(owner, "suite.json"), { name: "measurement-v1", version: 1,
      purpose: "Synthetic history regression", case_ids: ["one"], core_cases: ["one"],
      evaluator: "./score.cjs", artifact: "task-result.json", subject_role: "alex", output_contract: "task-agent-result", evaluation_kind: "judgment" });
    save(join(owner, "cases.json"), [{ id: "one", task: "Synthetic assignment.",
      agent_type: "alex", output_contract: "task-agent-result", files: { "README.md": "This fixture Markdown affects the task." },
      semantic_criteria: "Synthetic rubric.", semantic_controls: { synthetic: true }, expected: { synthetic: true } }]);
    save(join(owner, "labels.json"), { version: 1, benchmark: "measurement", labels: { one: {
      status: "draft", source: "synthetic", rationale: "Test fixture only.", approved_by: null, approved_at: null } } });
    writeFileSync(join(owner, "score.cjs"), "// Synthetic scorer fixture.\n");
    writeFileSync(join(owner, "README.md"), "Review prose.\n");
    const judge = join(root, "benchmarks/semantic-judges/agents/synthetic"); mkdirSync(judge, { recursive: true });
    save(join(judge, "agent.json"), { name: "synthetic", model: "synthetic-model" });
    writeFileSync(join(temp, "evidence.txt"), "Synthetic evidence reference.\n");
    save(join(agent, "agent.json"), { name: "alex", model: "gpt-5.6-sol" });
    save(plan, { schema_version: 1, revision: 1, agent: "alex", owner: "alex",
      outcomes: ["Synthetic outcome"], benchmarks: [{ id: "measurement", version: 1, goal: "Synthetic goal", baseline_run_id: null }],
      evaluation: { target: "alex", model: "gpt-5.6-sol", trials: 1, timeout_minutes: 4, max_runs_per_cycle: 1 },
      improvement: { problem: "Synthetic problem", evidence: ["evidence.txt"], hypothesis: "Synthetic hypothesis",
        expected_benefit: "Synthetic benefit", unchanged_alternative: "Synthetic alternative", stop_when: "Synthetic stop", next_action: "Synthetic next" },
      coverage_gaps: [], decisions: [] });
    configureGymRoot(root); process.env.GYM_STATE_DIR = state;
    try {
      const { runDir } = await runLoop({ planPath: plan, phase: "test", benchmark: "measurement", agent: "alex", candidate: "baseline", trials: 1 }, async () => {
        const work = join(temp, "work"); mkdirSync(work);
        save(join(work, "task-result.json"), { state: "converged", summary: "Synthetic fixture", facts: [] });
        writeFileSync(join(work, "transcript.jsonl"), '{"synthetic":true}\n');
        return { stderr: "No model calls", result: { scenario: "one", agent: "alex", agent_status: "success", passed: true,
          checks: [{ name: "synthetic", passed: true }], work_dir: work, prompt_hash: "synthetic-prompt", framework_sha: "synthetic-framework", model: "gpt-5.6-sol" } };
      });
      const runs = join(state, "benchmarks");
      const initial = buildPlanReport(plan, root, runs);
      expect({ current: initial.history[0]?.current, limit: initial.history[0]?.limit }).toEqual({ current: true, limit: "" });
      await run({ root, owner, plan, directory: runDir, runs });
    } finally { configureGymRoot(previousRoot); if (previousState === undefined) delete process.env.GYM_STATE_DIR; else process.env.GYM_STATE_DIR = previousState; }
  });
}

test("review-document edits preserve legacy measurement evidence without rewriting the run", () => fixture(f => {
  const before = fingerprintTree(f.runs);
  writeFileSync(join(f.owner, "README.md"), "Additional review results.\n");
  writeFileSync(join(f.owner, "CALIBRATION-REVIEW.md"), "Review notes, not an authoritative rubric.\n");
  const report = buildPlanReport(f.plan, f.root, f.runs);
  expect(report.issues).toEqual([]); expect(report.history[0]?.current).toBe(true);
  expect(report.history[0]?.harness_matches_current).toBe(true);
  expect(fingerprintTree(f.runs)).toBe(before);
  const plan = json(f.plan); plan.benchmarks[0].baseline_run_id = report.history[0]!.run.run_id; save(f.plan, plan);
  expect(buildPlanReport(f.plan, f.root, f.runs).issues.join("\n")).toContain("unapproved");
}));

test("historical harness remains readable while new verification still rejects a different harness", () => fixture(async f => {
  const before = fingerprintTree(f.runs), manifest = json(join(f.directory, "manifest.json"));
  writeFileSync(join(f.root, "src/cli.ts"), "// Synthetic changed execution harness.\n");
  const report = buildPlanReport(f.plan, f.root, f.runs);
  expect(report.history[0]?.current).toBe(true);
  expect(report.history[0]?.harness_matches_current).toBe(false);
  expect(() => assertFrozenInputs(f.directory, manifest)).toThrow("Frozen Gym harness changed");
  await expect(verifyLoop({ planPath: f.plan, baseline: f.directory, candidate: "never-executed" })).rejects.toThrow("Frozen Gym harness changed");
  expect(fingerprintTree(f.runs)).toBe(before);
}));

for (const part of ["task", "rubric", "controls", "fixture-markdown", "labels", "suite", "scorer", "judges", "commission", "retained-inputs"])
  test(`measurement or integrity change remains rejected: ${part}`, () => fixture(f => {
    const casesPath = join(f.owner, "cases.json"), cases = json(casesPath);
    if (part === "task") cases[0].task += " Changed";
    if (part === "rubric") cases[0].semantic_criteria += " Changed";
    if (part === "controls") cases[0].semantic_controls.changed = true;
    if (part === "fixture-markdown") cases[0].files["README.md"] += " Changed";
    if (["task", "rubric", "controls", "fixture-markdown"].includes(part)) save(casesPath, cases);
    if (part === "labels") { const p = join(f.owner, "labels.json"), labels = json(p); labels.labels.one.rationale += " Changed"; save(p, labels); }
    if (part === "suite") { const p = join(f.owner, "suite.json"), suite = json(p); suite.purpose += " Changed"; save(p, suite); }
    if (part === "scorer") writeFileSync(join(f.owner, "score.cjs"), "// Changed scorer.\n");
    if (part === "judges") writeFileSync(join(f.root, "benchmarks/semantic-judges/agents/synthetic/agent.json"), '{}\n');
    if (part === "commission") { const p = join(f.directory, "manifest.json"), manifest = json(p); manifest.evaluation_plan.benchmark_fingerprint = "forged"; save(p, manifest); }
    if (part === "retained-inputs") writeFileSync(join(f.directory, "inputs/corruption.md"), "Corrupted evidence.\n");
    expect(buildPlanReport(f.plan, f.root, f.runs).history[0]?.current).toBe(false);
  }));

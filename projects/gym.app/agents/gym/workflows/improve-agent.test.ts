import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { LoopRunManifest, RunOptions } from "@may-agent/gym/loop";
import type { WorkflowContext } from "@may-agent/sdk";
import {
  applyDirectorySnapshot,
  benchmarkFixTarget,
  buildBenchmarkFixRetryEvent,
  buildApprovalRequest,
  dispatchApproval,
  experimentNeedsIntegration,
  fingerprintTree,
  improvementInput,
  learningPromptLines,
  loadCurriculumTargets,
  locateApprovalPacket,
  locateCandidateRetry,
  prepareAssessment,
  qualifiesHeldBackRelease,
  recoverCompletedReleaseBaseline,
  runImprovement,
  runCurriculumSequence,
  scenarioVerdicts,
  verificationBenchmark,
  validateFindings,
  type Finding,
  type GymLoopApi,
} from "./improve-agent";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function manifest(
  runId: string,
  verdicts: Record<string, Array<"pass" | "fail" | "invalid">>,
): LoopRunManifest {
  const scenarios = Object.keys(verdicts);
  return {
    schema_version: 2,
    run_id: runId,
    phase: "test",
    benchmark: "test-bench",
    benchmark_version: 1,
    baseline_run_id: null,
    candidate: "baseline",
    agent: "may",
    trials_per_scenario: Math.max(
      ...Object.values(verdicts).map((rows) => rows.length),
    ),
    scenarios,
    started_at: "2026-07-21T00:00:00Z",
    completed_at: "2026-07-21T00:01:00Z",
    proof: {
      input_fingerprint: "input",
      label_set_fingerprint: "labels",
      candidate_fingerprint: null,
      agent_prompt_fingerprints: ["prompt"],
      framework_revisions: ["framework"],
      models: ["model"],
    },
    source: {
      suite_path: "suite.json",
      labels_path: "labels.json",
      suite_snapshot: "inputs/suite.json",
      labels_snapshot: "inputs/labels.json",
      evaluator_snapshot: null,
      scenarios_snapshot: "inputs/scenarios",
    },
    trials: scenarios.flatMap((scenario) =>
      verdicts[scenario]!.map((machine_verdict, index) => ({
        scenario,
        trial: index + 1,
        machine_verdict,
        invalid_reason: machine_verdict === "invalid" ? "provider error" : null,
        label_status: "approved" as const,
        result_path: `${scenario}/${index + 1}/result.json`,
        artifact_path: null,
        transcript_path: null,
        provenance: {
          prompt_fingerprint: "prompt",
          framework_revision: "framework",
          model: "model",
        },
      })),
    ),
  };
}

describe("single agent-improvement loop", () => {
  test("locates the exact approved packet across curriculum drift", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-approval-location-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const stateDir = join(
      projectsRoot,
      "gym.app",
      ".state",
      "candidates",
      "improve-may",
      "7",
      "tracks",
      "old-curriculum-fingerprint",
    );
    const packetPath = join(stateDir, "result.json");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      packetPath,
      JSON.stringify({
        summary: "Waiting for exact approval.",
        workflow_state: "waiting",
        approval: {
          kind: "benchmark-fix",
          approvalId: "approval-7",
          waitId: "wait:approval-7",
          taskId: "improve/may",
          taskGeneration: 7,
          artifactFingerprint: "sha256:artifact-7",
          packetPath,
          requestedAction: "Approve?",
          reason: "Exact reviewed fix",
          condition: { id: "approval-7", type: "project.approval.submitted" },
        },
      }),
    );

    const trigger = {
      type: "project.approval.submitted",
      approvalId: "approval-7",
      taskId: "improve/may",
      taskGeneration: 7,
      artifactFingerprint: "sha256:artifact-7",
      packetPath,
      decision: "approve",
    };
    expect(
      locateApprovalPacket(projectsRoot, "improve/may", 7, trigger),
    ).toEqual({ stateDir, resultPath: packetPath });
    expect(
      locateApprovalPacket(projectsRoot, "improve/may", 7, {
        ...trigger,
        packetPath: join(root, "outside", "result.json"),
      })?.error,
    ).toContain("outside the campaign state");
  });

  test("applies an exact approved packet before recomputing curriculum", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-approval-resume-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const stateDir = join(
      projectsRoot,
      "gym.app",
      ".state",
      "candidates",
      "improve-may",
      "7",
      "tracks",
      "old-curriculum-fingerprint",
    );
    const resultPath = join(stateDir, "result.json");
    const assessmentPath = join(stateDir, "assessment.json");
    const snapshotPath = join(stateDir, "benchmark-fix");
    const targetPath = join(projectsRoot, "gym", "benchmarks", "owner");
    mkdirSync(snapshotPath, { recursive: true });
    mkdirSync(targetPath, { recursive: true });
    writeFileSync(join(snapshotPath, "scorer.cjs"), "fixed\n");
    writeFileSync(join(targetPath, "scorer.cjs"), "old\n");
    const artifactFingerprint = `sha256:${fingerprintTree(snapshotPath)}`;
    const approvalId = "approval-7";
    writeFileSync(
      assessmentPath,
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        benchmark: "consumer",
        release_benchmark: "consumer-transfer",
        release_scenarios: ["release-case"],
        screening_run_id: "baseline-7",
        screening_run_dir: join(root, "baseline-7"),
        retry_run_id: null,
        retry_run_dir: null,
        findings: [],
        focus: null,
        baseline_run_id: "baseline-7",
        baseline_run_dir: join(root, "baseline-7"),
        accepted_at: "2026-08-01T00:00:00Z",
      }),
    );
    mkdirSync(dirname(resultPath), { recursive: true });
    writeFileSync(
      resultPath,
      JSON.stringify({
        summary: "Waiting for exact approval.",
        workflow_state: "waiting",
        assessment_path: assessmentPath,
        baseline_run_id: "baseline-7",
        focus: {
          classification: "scorer",
          scenarios: ["development-case"],
          summary: "Repair the scorer.",
          evidence: [],
        },
        artifact_path: snapshotPath,
        artifact_target_path: targetPath,
        approval: {
          kind: "benchmark-fix",
          approvalId,
          waitId: `wait:${approvalId}`,
          taskId: "improve/may",
          taskGeneration: 7,
          artifactFingerprint,
          packetPath: resultPath,
          requestedAction: "Approve?",
          reason: "Exact reviewed fix",
          condition: { id: approvalId, type: "project.approval.submitted" },
        },
        conditions: [],
        evidence: [],
      }),
    );
    const emitted: Record<string, unknown>[] = [];
    const task = [
      "## Reconciliation Task",
      "```json",
      JSON.stringify({
        taskId: "improve/may",
        generation: 7,
        input: { agent: "may", curriculumDrain: true },
      }),
      "```",
      "## Trigger Event",
      "```json",
      JSON.stringify({
        type: "project.approval.submitted",
        data: {
          approvalId,
          taskId: "improve/may",
          taskGeneration: 7,
          artifactFingerprint,
          packetPath: resultPath,
          decision: "approve",
          message: "Approve",
        },
      }),
      "```",
    ].join("\n");
    const ctx = {
      projectsRoot,
      task,
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    } as unknown as WorkflowContext;
    const unusedLoop: GymLoopApi = {
      async run() {
        throw new Error("approval recovery must not start curriculum runs");
      },
      async verify() {
        throw new Error("approval recovery must not verify before applying");
      },
    };

    const result = (await runImprovement(
      ctx,
      unusedLoop,
    )) as unknown as Record<string, unknown>;
    expect(result.summary).toContain("Applied approved benchmark/scorer fix");
    expect(readFileSync(join(targetPath, "scorer.cjs"), "utf8")).toBe(
      "fixed\n",
    );
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.improvement.requested",
        reason: "approved-benchmark-fix-applied",
        artifactFingerprint,
      }),
    ]);
  });

  test("locates one exact retry in the generation root or an immediate track", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-retry-location-"));
    roots.push(root);
    const generationDir = join(
      root,
      "gym.app",
      ".state",
      "candidates",
      "improve-may",
      "7",
    );
    const trackDir = join(generationDir, "tracks", "cli-worker");
    mkdirSync(trackDir, { recursive: true });
    const fingerprint = "a".repeat(64);
    writeFileSync(
      join(trackDir, "result.json"),
      JSON.stringify({ candidate_fingerprint: fingerprint }),
    );

    expect(
      locateCandidateRetry(root, "improve/may", 7, {
        reason: "retry-candidate-verification",
        candidateFingerprint: `sha256:${fingerprint}`,
      }),
    ).toMatchObject({
      scope: "cli-worker",
      resultPath: join(trackDir, "result.json"),
    });

    expect(
      locateCandidateRetry(root, "improve/may", 7, {
        reason: "retry-candidate-verification",
        candidateFingerprint: "b".repeat(64),
      })?.error,
    ).toContain("no matching result");

    writeFileSync(
      join(generationDir, "result.json"),
      JSON.stringify({ candidate_fingerprint: fingerprint }),
    );
    expect(
      locateCandidateRetry(root, "improve/may", 7, {
        reason: "retry-candidate-verification",
        candidateFingerprint: fingerprint,
      })?.error,
    ).toContain("multiple matching results");

    rmSync(join(generationDir, "result.json"));
    rmSync(join(trackDir, "result.json"));
    const iterationDir = join(trackDir, "iterations", "2");
    const candidateDir = join(iterationDir, "may");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "AGENTS.md"), "# Candidate\n");
    const recoveryFingerprint = fingerprintTree(candidateDir);
    writeFileSync(
      join(iterationDir, "candidate.json"),
      JSON.stringify({
        candidateId: "gym/may/g7-i2",
        candidatePath: candidateDir,
        candidateFingerprint: recoveryFingerprint,
        implementationSummary: "Candidate",
        implementationEvidence: [],
      }),
    );
    writeFileSync(
      join(iterationDir, "verification-retry.json"),
      JSON.stringify({ candidate_fingerprint: recoveryFingerprint }),
    );
    expect(
      locateCandidateRetry(root, "improve/may", 7, {
        reason: "retry-candidate-verification",
        candidateFingerprint: recoveryFingerprint,
      }),
    ).toMatchObject({ scope: "cli-worker" });
  });

  test("keeps desired state stable while a focused wake supplies work", () => {
    const desired = {
      taskId: "improve/may",
      generation: 8,
      input: { agent: "may", curriculumDrain: true },
    };
    expect(
      improvementInput(desired, {
        type: "gym.improvement.requested",
        benchmark: "may-deputy-learning",
        scenarios: ["may-learn-select-skill-or-workflow"],
        trials: 3,
        reason: "approved-pilot",
      }),
    ).toEqual({
      agent: "may",
      benchmark: "may-deputy-learning",
      scenarios: ["may-learn-select-skill-or-workflow"],
      trials: 3,
      reason: "approved-pilot",
      type: "gym.improvement.requested",
    });
    expect(
      improvementInput(desired, {
        type: "agent.revision.changed",
        revision: "sha256:new-may",
      }),
    ).toMatchObject({
      agent: "may",
      curriculumDrain: true,
      revision: "sha256:new-may",
    });
  });

  test("rejects an autonomous track that omits approved material", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-curriculum-"));
    roots.push(root);
    const learningDir = join(root, "benchmarks", "may-learning");
    const benchmarkDir = join(root, "benchmarks", "approved-learning");
    mkdirSync(learningDir, { recursive: true });
    mkdirSync(benchmarkDir, { recursive: true });
    writeFileSync(
      join(learningDir, "autonomous-training.json"),
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        tracks: [
          {
            id: "approved-learning",
            benchmark: "approved-learning",
            scenarios: ["included-case"],
            trials: 3,
          },
        ],
      }),
    );
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      JSON.stringify({
        labels_file: "labels.json",
        scenarios: ["included-case", "omitted-case"],
      }),
    );
    writeFileSync(
      join(benchmarkDir, "labels.json"),
      JSON.stringify({
        labels: {
          "included-case": { status: "approved" },
          "omitted-case": { status: "approved" },
        },
      }),
    );

    expect(() => loadCurriculumTargets(root)).toThrow(
      "Autonomous May training track approved-learning omits approved scenarios: omitted-case",
    );
  });

  test("drains every approved learning track and stops at the first decision boundary", async () => {
    const gymRoot = join(import.meta.dir, "../../../../gym");
    const { targets, fingerprint } = loadCurriculumTargets(gymRoot);
    expect(fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(targets.map(({ id }) => id)).toEqual([
      "cli-worker-opinions",
      "initiative-and-approval",
      "system-deputy-operations",
      "system-deputy-learning-intake",
      "human-inbox-deputy",
      "admission-review-closure",
      "practical-judgment",
      "signals-and-context",
    ]);
    expect(
      targets.find(({ id }) => id === "system-deputy-operations")?.scenarios,
    ).toContain("may-learn-understand-telegram-reply-intent");

    const visited: string[] = [];
    const exhausted = await runCurriculumSequence(targets, async (target) => {
      visited.push(target.id);
      return {
        type: "done",
        summary:
          "May has no actionable failures in the current approved evaluation.",
        output: {
          state: "converged",
          summary:
            "May has no actionable failures in the current approved evaluation.",
        },
      };
    });
    expect(exhausted.state).toBe("exhausted");
    expect(visited).toEqual(targets.map(({ id }) => id));

    visited.length = 0;
    const stopped = await runCurriculumSequence(targets, async (target) => {
      visited.push(target.id);
      return target.id === "system-deputy-operations"
        ? {
            type: "done",
            summary: "Waiting for exact approval.",
            output: {
              state: "waiting",
              summary: "Waiting for exact approval.",
            },
          }
        : {
            type: "done",
            summary:
              "May has no actionable failures in the current approved evaluation.",
            output: {
              state: "converged",
              summary:
                "May has no actionable failures in the current approved evaluation.",
            },
          };
    });
    expect(stopped.state).toBe("stopped");
    expect(visited).toEqual([
      "cli-worker-opinions",
      "initiative-and-approval",
      "system-deputy-operations",
    ]);

    visited.length = 0;
    const deferredIssue = await runCurriculumSequence(
      targets,
      async (target) => {
        visited.push(target.id);
        return target.id === "system-deputy-operations"
          ? {
              type: "done",
              summary: "Gym found an evaluator issue but no May behavior gap.",
              output: {
                state: "converged",
                summary:
                  "Gym found an evaluator issue but no May behavior gap.",
              },
            }
          : {
              type: "done",
              summary:
                "May has no actionable failures in the current approved evaluation.",
              output: {
                state: "converged",
                summary:
                  "May has no actionable failures in the current approved evaluation.",
              },
            };
      },
    );
    expect(deferredIssue.state).toBe("stopped");
    expect(visited).toEqual(targets.map(({ id }) => id));
  });

  test("reconciles two assessments at a time and resumes from the campaign checkpoint", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-bounded-campaign-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const gymRoot = join(projectsRoot, "gym");
    const agentsRoot = join(root, "agents");
    const learningRoot = join(gymRoot, "benchmarks", "may-learning");
    mkdirSync(learningRoot, { recursive: true });
    mkdirSync(join(agentsRoot, "may"), { recursive: true });
    writeFileSync(join(agentsRoot, "may", "AGENTS.md"), "# May\n");

    const tracks = ["track-one", "track-two", "track-three"].map(
      (id, index) => ({
        id,
        benchmark: id,
        scenarios: [`case-${index + 1}`],
        trials: 1,
      }),
    );
    writeFileSync(
      join(learningRoot, "autonomous-training.json"),
      JSON.stringify({ schema_version: 1, agent: "may", tracks }),
    );
    for (const [index, track] of tracks.entries()) {
      const benchmarkDir = join(gymRoot, "benchmarks", track.benchmark);
      const scenario = track.scenarios[0]!;
      mkdirSync(benchmarkDir, { recursive: true });
      mkdirSync(join(gymRoot, "scenarios", scenario), { recursive: true });
      writeFileSync(
        join(benchmarkDir, "suite.json"),
        JSON.stringify({ labels_file: "labels.json", scenarios: [scenario] }),
      );
      writeFileSync(
        join(benchmarkDir, "labels.json"),
        JSON.stringify({
          labels: {
            [scenario]: {
              status: "approved",
              approved_by: "hao",
              approved_at: "2026-08-01T00:00:00Z",
            },
          },
        }),
      );
      writeFileSync(
        join(gymRoot, "scenarios", scenario, "prompt.md"),
        `case ${index + 1}\n`,
      );
    }

    let active = 0;
    let maxActive = 0;
    let runCount = 0;
    const loop: GymLoopApi = {
      async run(options) {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active--;
        runCount++;
        const scenario = options.scenarios![0]!;
        const runId = `campaign-run-${runCount}`;
        const runDir = join(gymRoot, ".state", "benchmarks", runId);
        mkdirSync(runDir, { recursive: true });
        const value = manifest(runId, { [scenario]: ["pass"] });
        value.benchmark = options.benchmark;
        value.scenarios = [scenario];
        writeFileSync(join(runDir, "manifest.json"), JSON.stringify(value));
        return { runDir, manifest: value };
      },
      async verify() {
        throw new Error("an all-pass assessment must not build a candidate");
      },
    };
    const emitted: Record<string, unknown>[] = [];
    const task = (reason: string) =>
      [
        "## Reconciliation Task",
        "```json",
        JSON.stringify({
          taskId: "improve/may",
          generation: 1,
          input: { agent: "may", curriculumDrain: true },
        }),
        "```",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "gym.improvement.requested",
          params: { curriculumDrain: true, reason },
        }),
        "```",
      ].join("\n");
    const ctx = {
      projectsRoot,
      task: task("curriculum-refill"),
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      async runAgent() {
        throw new Error("all-pass assessments need no owner classification");
      },
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    } as unknown as WorkflowContext;

    const first = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(first.summary).toContain("1 approved track remains");
    expect(first.actions).toEqual([]);
    expect(runCount).toBe(2);
    expect(maxActive).toBe(2);
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.improvement.requested",
        params: expect.objectContaining({ reason: "curriculum-continue" }),
      }),
    ]);

    (ctx as unknown as { task: string }).task = task("curriculum-continue");
    const second = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(second.summary).toContain("training material is exhausted");
    expect(runCount).toBe(3);

    (ctx as unknown as { task: string }).task = task("curriculum-refill");
    const replay = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(replay.summary).toBe(
      "May already passes every approved learning track.",
    );
    expect(runCount).toBe(3);
    expect(
      JSON.parse(
        readFileSync(
          join(
            projectsRoot,
            "gym.app",
            ".state",
            "learning",
            "training-drain.json",
          ),
          "utf8",
        ),
      ),
    ).toMatchObject({
      schema_version: 2,
      exhausted_at: expect.any(String),
      tracks: [
        { id: "track-one", state: "complete" },
        { id: "track-two", state: "complete" },
        { id: "track-three", state: "complete" },
      ],
    });
  });

  test("stops a superseded attempt after its current Gym run", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-campaign-fence-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const gymRoot = join(projectsRoot, "gym");
    const agentsRoot = join(root, "agents");
    const benchmark = "fenced-track";
    const scenario = "fenced-case";
    mkdirSync(join(gymRoot, "benchmarks", "may-learning"), {
      recursive: true,
    });
    mkdirSync(join(gymRoot, "benchmarks", benchmark), { recursive: true });
    mkdirSync(join(gymRoot, "scenarios", scenario), { recursive: true });
    mkdirSync(join(agentsRoot, "may"), { recursive: true });
    writeFileSync(join(agentsRoot, "may", "AGENTS.md"), "# May\n");
    writeFileSync(
      join(gymRoot, "benchmarks", "may-learning", "autonomous-training.json"),
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        tracks: [
          { id: benchmark, benchmark, scenarios: [scenario], trials: 1 },
        ],
      }),
    );
    writeFileSync(
      join(gymRoot, "benchmarks", benchmark, "suite.json"),
      JSON.stringify({ labels_file: "labels.json", scenarios: [scenario] }),
    );
    writeFileSync(
      join(gymRoot, "benchmarks", benchmark, "labels.json"),
      JSON.stringify({
        labels: {
          [scenario]: {
            status: "approved",
            approved_by: "hao",
            approved_at: "2026-08-01T00:00:00Z",
          },
        },
      }),
    );
    writeFileSync(
      join(gymRoot, "scenarios", scenario, "prompt.md"),
      "fenced case\n",
    );

    const taskStatePath = join(
      projectsRoot,
      "gym.app",
      ".state",
      "tasks",
      "state.json",
    );
    mkdirSync(join(taskStatePath, ".."), { recursive: true });
    const writeTaskState = (generation: number, attemptId: string) =>
      writeFileSync(
        taskStatePath,
        JSON.stringify({
          resources: {
            "improve/may": {
              metadata: { id: "improve/may", generation },
              status: { phase: "running", currentAttemptId: attemptId },
            },
          },
        }),
      );
    writeTaskState(1, "attempt-1");

    let runCount = 0;
    const loop: GymLoopApi = {
      async run(options) {
        runCount++;
        writeTaskState(2, "attempt-2");
        const runId = "superseded-run";
        const runDir = join(gymRoot, ".state", "benchmarks", runId);
        mkdirSync(runDir, { recursive: true });
        const value = manifest(runId, { [scenario]: ["pass"] });
        value.benchmark = options.benchmark;
        value.scenarios = [scenario];
        return { runDir, manifest: value };
      },
      async verify() {
        throw new Error("a superseded assessment must not verify a candidate");
      },
    };
    const ctx = {
      projectsRoot,
      task: [
        "## Reconciliation Task",
        "```json",
        JSON.stringify({
          taskId: "improve/may",
          generation: 1,
          input: { agent: "may", curriculumDrain: true },
        }),
        "```",
      ].join("\n"),
      emit() {
        throw new Error("a superseded attempt must not emit a continuation");
      },
      async runAgent() {
        throw new Error("a superseded assessment must not classify findings");
      },
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    } as unknown as WorkflowContext;

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(result.summary).toBe(
      "Stopped superseded campaign attempt improve/may@1.",
    );
    expect(runCount).toBe(1);
    expect(
      existsSync(
        join(
          projectsRoot,
          "gym.app",
          ".state",
          "learning",
          "training-drain.json",
        ),
      ),
    ).toBe(false);
  });

  test("gives candidate builders lessons and evidence without release truth", () => {
    const lines = learningPromptLines([
      {
        id: "initiative-and-approval",
        version: 1,
        title: "Act on bounded evidence",
        competencies: ["authority.act-vs-approve"],
        lessonPath: "/learning/lesson.md",
        practicePath: "/learning/practice.md",
        guidedPracticeCases: [],
        evidencePath: "/learning/evidence.jsonl",
        sourcePaths: ["/design/system-model.md"],
      },
    ]);

    expect(lines.join("\n")).toContain(
      "Learning unit: initiative-and-approval v1",
    );
    expect(lines.join("\n")).toContain("Lesson: /learning/lesson.md");
    expect(lines.join("\n")).toContain(
      "Reviewed evidence: /learning/evidence.jsonl",
    );
    expect(lines.join("\n")).not.toContain("expected.json");
    expect(lines.join("\n")).not.toContain("release");
  });

  test("keeps valid failures visible when another scenario is invalid", () => {
    const facts = scenarioVerdicts(
      manifest("mixed", {
        pass: ["pass", "pass", "pass"],
        gap: ["fail", "fail", "fail"],
        runtime: ["fail", "invalid", "fail"],
      }),
    );
    expect(facts).toEqual({
      pass: ["pass"],
      fail: ["gap"],
      invalid: ["runtime"],
    });
  });

  test("does not repeat an exhausted focused baseline retry", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-focused-retry-"));
    roots.push(root);
    const baselineDir = join(root, "stored-invalid-baseline");
    mkdirSync(baselineDir, { recursive: true });
    const stored = manifest("stored-invalid-baseline", {
      "agent-case": ["fail", "invalid", "fail"],
    });
    writeFileSync(join(baselineDir, "manifest.json"), JSON.stringify(stored));
    const assessmentPath = join(root, "assessment.json");
    writeFileSync(
      assessmentPath,
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        benchmark: "test-bench",
        release_benchmark: "test-bench",
        release_scenarios: ["agent-case"],
        screening_run_id: "screening",
        screening_run_dir: root,
        retry_run_id: null,
        retry_run_dir: null,
        findings: [
          {
            classification: "agent",
            scenarios: ["agent-case"],
            failureFamily: "scope-control",
            summary: "May missed the required behavior.",
            evidence: [root],
          },
        ],
        focus: {
          classification: "agent",
          scenarios: ["agent-case"],
          failureFamily: "scope-control",
          summary: "May missed the required behavior.",
          evidence: [root],
        },
        baseline_run_id: "stored-invalid-baseline",
        baseline_run_dir: baselineDir,
        accepted_at: "2026-08-01T00:00:00Z",
      }),
    );
    let runCount = 0;
    const prepared = await prepareAssessment(
      { projectsRoot: join(root, "projects") } as WorkflowContext,
      { benchmark: "test-bench", agent: "may", trials: 3 },
      assessmentPath,
      {
        async run() {
          runCount++;
          throw new Error("stored retry must not run again");
        },
        async verify() {
          throw new Error("verification is not used by assessment");
        },
      },
    );

    expect(prepared.problem).toContain("remained invalid");
    expect(runCount).toBe(0);
    expect(
      experimentNeedsIntegration({
        target: {
          id: "test-bench",
          benchmark: "test-bench",
          scenarios: ["agent-case"],
          trials: 3,
        },
        input: {},
        scope: "test-bench-campaign",
        assessmentPath,
        assessment: prepared.assessment,
        problem: prepared.problem,
      }),
    ).toBe(false);
  });

  test("qualifies an all-pass held-back run at a perfect baseline ceiling", () => {
    const verified = manifest("release-verify", {
      "transfer-a": ["pass", "pass", "pass", "pass", "pass"],
      "transfer-b": ["pass", "pass", "pass", "pass", "pass"],
    });
    verified.phase = "verify";
    expect(
      qualifiesHeldBackRelease({
        runDir: "/release-verify",
        manifest: verified,
        comparison: {
          baseline_run_id: "perfect-baseline",
          candidate_run_id: "release-verify",
          labels_approved: true,
          same_framework_revision: true,
          no_invalid_runs: true,
          no_regressions: true,
          improved: false,
          gate: "fail",
          scenarios: [],
        },
      }),
    ).toBe(true);

    verified.trials[0]!.machine_verdict = "fail";
    expect(
      qualifiesHeldBackRelease({
        runDir: "/release-verify",
        manifest: verified,
        comparison: {
          baseline_run_id: "perfect-baseline",
          candidate_run_id: "release-verify",
          labels_approved: true,
          same_framework_revision: true,
          no_invalid_runs: true,
          no_regressions: true,
          improved: false,
          gate: "fail",
          scenarios: [],
        },
      }),
    ).toBe(false);
  });

  test("recovers the newest completed matching release baseline after interruption", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-release-recovery-"));
    roots.push(root);
    const gymRoot = join(root, "gym");
    const runsRoot = join(gymRoot, ".state", "benchmarks");
    mkdirSync(runsRoot, { recursive: true });

    const store = (
      runId: string,
      startedAt: string,
      completedAt: string | null,
    ) => {
      const runDir = join(runsRoot, runId);
      mkdirSync(runDir, { recursive: true });
      const stored = manifest(runId, {
        "transfer-a": ["fail", "fail", "fail", "fail", "fail"],
        "transfer-b": ["fail", "fail", "fail", "fail", "fail"],
      });
      stored.benchmark = "transfer-bench";
      stored.started_at = startedAt;
      stored.completed_at = completedAt;
      writeFileSync(join(runDir, "manifest.json"), JSON.stringify(stored));
      return runDir;
    };

    store(
      "before-candidate",
      "2026-08-01T00:00:00Z",
      "2026-08-01T00:10:00Z",
    );
    const recoveredDir = store(
      "completed-after-candidate",
      "2026-08-01T01:00:00Z",
      "2026-08-01T01:20:00Z",
    );
    store("newer-but-incomplete", "2026-08-01T02:00:00Z", null);

    expect(
      recoverCompletedReleaseBaseline(
        gymRoot,
        "transfer-bench",
        "may",
        ["transfer-a", "transfer-b"],
        "2026-08-01T00:30:00Z",
      ),
    ).toMatchObject({
      runDir: recoveredDir,
      manifest: { run_id: "completed-after-candidate" },
    });
  });

  test("requires exact per-scenario classification coverage", () => {
    const findings: Finding[] = [
      {
        classification: "agent",
        scenarios: ["one"],
        failureFamily: "scope-control",
        summary: "May exceeded the requested scope.",
        evidence: ["run"],
      },
    ];
    expect(validateFindings(findings, ["one"])).toEqual([]);
    expect(validateFindings(findings, ["one", "two"])).toContain(
      "scenario was not classified: two",
    );
  });

  test("uses the same Telegram contract for an exact benchmark fix", () => {
    const emitted: Record<string, unknown>[] = [];
    const dispatched: Record<string, unknown>[] = [];
    const request = buildApprovalRequest({
      kind: "benchmark-fix",
      taskId: "improve/may",
      generation: 4,
      artifactFingerprint: "sha256:benchmark123",
      packetPath: "/evidence/benchmark-fix.json",
      requestedAction: "Approve this exact scorer fix?",
      reason: "The scorer misclassified a valid answer.",
    });
    const ctx = {
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      dispatchEvent(type: string, data: Record<string, unknown>) {
        dispatched.push({ type, ...data });
      },
    } as unknown as WorkflowContext;

    dispatchApproval(ctx, request);

    expect(request.condition).toMatchObject({
      type: "project.approval.submitted",
      subject: `approvalId:${request.approvalId}`,
      expected: {
        taskId: "improve/may",
        taskGeneration: 4,
        artifactFingerprint: "sha256:benchmark123",
      },
    });
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "project.approval.requested",
        approvalKind: "benchmark-fix",
        approvalId: request.approvalId,
      }),
    ]);
    expect(dispatched).toEqual([
      expect.objectContaining({
        type: "message.created",
        to: "human",
        approvalKind: "benchmark-fix",
        expectedResponse: expect.objectContaining({
          type: "project.approval.submitted",
          artifactFingerprint: "sha256:benchmark123",
        }),
      }),
    ]);
  });

  test("preserves the approved scenario scope when retrying a benchmark fix", () => {
    expect(
      buildBenchmarkFixRetryEvent({
        agent: "may",
        benchmark: "may-alignment",
        scenarios: ["may-align-proof-before-adopt"],
        artifactFingerprint: "sha256:benchmark123",
        taskId: "improve/may",
        taskGeneration: 9,
        approvalId: "approval-9",
      }),
    ).toMatchObject({
      type: "gym.improvement.requested",
      scenarios: ["may-align-proof-before-adopt"],
      trials: 3,
      reason: "approved-benchmark-fix-applied",
    });
  });

  test("applies only the approved benchmark snapshot", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-benchmark-approval-"));
    roots.push(root);
    const targetPath = join(root, "benchmark");
    const snapshotPath = join(root, "snapshot");
    mkdirSync(targetPath);
    mkdirSync(snapshotPath);
    writeFileSync(join(targetPath, "obsolete.cjs"), "old\n");
    writeFileSync(join(snapshotPath, "scorer.cjs"), "fixed\n");
    const fingerprint = `sha256:${fingerprintTree(snapshotPath)}`;

    applyDirectorySnapshot({
      snapshotPath,
      expectedFingerprint: fingerprint,
      targetPath,
    });

    expect(readFileSync(join(targetPath, "scorer.cjs"), "utf8")).toBe(
      "fixed\n",
    );
    expect(existsSync(join(targetPath, "obsolete.cjs"))).toBe(false);
    writeFileSync(join(snapshotPath, "scorer.cjs"), "changed after ask\n");
    expect(() =>
      applyDirectorySnapshot({
        snapshotPath,
        expectedFingerprint: fingerprint,
        targetPath,
      }),
    ).toThrow("Approved artifact changed");
  });

  test("targets the evaluator owner for scorer fixes", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-scorer-owner-"));
    roots.push(root);
    const gymRoot = join(root, "gym");
    const consumer = join(gymRoot, "benchmarks", "deputy-learning");
    const owner = join(gymRoot, "benchmarks", "may-alignment");
    mkdirSync(consumer, { recursive: true });
    mkdirSync(owner, { recursive: true });
    writeFileSync(
      join(consumer, "suite.json"),
      JSON.stringify({ evaluator: "../may-alignment/score-decision.cjs" }),
    );
    writeFileSync(join(owner, "score-decision.cjs"), "module.exports = {};\n");

    expect(
      benchmarkFixTarget({
        gymRoot,
        benchmark: "deputy-learning",
        disposition: "review-scorer",
      }),
    ).toEqual({
      benchmark: "may-alignment",
      path: owner,
      evaluatorPath: join(owner, "score-decision.cjs"),
    });
    expect(
      benchmarkFixTarget({
        gymRoot,
        benchmark: "deputy-learning",
        disposition: "review-benchmark",
      }),
    ).toEqual({
      benchmark: "deputy-learning",
      path: consumer,
      evaluatorPath: null,
    });
  });

  test("targets benchmark fixes at the benchmark that failed verification", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-verification-benchmark-"));
    roots.push(root);
    writeFileSync(
      join(root, "manifest.json"),
      JSON.stringify({ benchmark: "held-back-release" }),
    );

    expect(verificationBenchmark(root, "development")).toBe(
      "held-back-release",
    );
  });

  test("targets one failed benchmark scenario at its scenario contract", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-scenario-fix-"));
    roots.push(root);
    const gymRoot = join(root, "gym");
    const scenarioPath = join(gymRoot, "scenarios", "held-back-case");
    mkdirSync(scenarioPath, { recursive: true });

    expect(
      benchmarkFixTarget({
        gymRoot,
        benchmark: "held-back-release",
        disposition: "review-benchmark",
        scenario: "held-back-case",
      }),
    ).toEqual({
      benchmark: "held-back-case",
      path: scenarioPath,
      evaluatorPath: null,
    });
  });

  test("checkpoints classification and resumes the focused baseline", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-app-improve-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const benchmarkDir = join(projectsRoot, "gym", "benchmarks", "test-bench");
    mkdirSync(benchmarkDir, { recursive: true });
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      JSON.stringify({
        name: "test-bench",
        version: 1,
        labels_file: "labels.json",
        scenarios: ["agent-case", "runtime-case"],
      }),
    );
    writeFileSync(
      join(benchmarkDir, "labels.json"),
      JSON.stringify({
        labels: {
          "agent-case": {
            status: "approved",
            approved_by: "hao",
            approved_at: "2026-07-21T00:00:00Z",
          },
          "runtime-case": {
            status: "approved",
            approved_by: "hao",
            approved_at: "2026-07-21T00:00:00Z",
          },
        },
      }),
    );

    const calls: RunOptions[] = [];
    const loop: GymLoopApi = {
      async run(options) {
        calls.push(options);
        const runId = `run-${calls.length}`;
        if (calls.length === 3) {
          throw new Error("simulated baseline interruption");
        }
        const runDir = join(root, runId);
        mkdirSync(runDir, { recursive: true });
        const created =
          calls.length === 1
            ? manifest(runId, {
                "agent-case": ["fail", "fail", "fail"],
                "runtime-case": ["invalid", "invalid", "invalid"],
              })
            : calls.length === 2
              ? manifest(runId, {
                  "runtime-case": ["invalid", "invalid", "invalid"],
                })
              : manifest(runId, {
                  "agent-case": ["fail", "fail", "fail"],
                });
        return { runDir, manifest: created };
      },
      verify() {
        throw new Error("verification is not used by assessment");
      },
    };
    let classificationAttempts = 0;
    const ctx = {
      projectsRoot,
      async runAgent() {
        classificationAttempts++;
        if (classificationAttempts === 1) {
          return {
            status: "error",
            error: "Agent ended with an empty assistant turn",
          };
        }
        return {
          status: "done",
          structuredResult: {
            findings: [
              {
                classification: "agent",
                scenarios: ["agent-case"],
                failureFamily: "scope-control",
                summary: "May exceeded the requested scope.",
                evidence: ["run-1"],
              },
            ],
          },
        };
      },
    } as unknown as WorkflowContext;

    const assessmentPath = join(root, "assessment.json");
    const input = { benchmark: "test-bench", agent: "may", trials: 3 };
    await expect(
      prepareAssessment(ctx, input, assessmentPath, loop),
    ).rejects.toThrow("simulated baseline interruption");
    expect(JSON.parse(readFileSync(assessmentPath, "utf8"))).toMatchObject({
      focus: { failureFamily: "scope-control" },
      baseline_run_id: null,
      baseline_run_dir: null,
    });

    const prepared = await prepareAssessment(ctx, input, assessmentPath, loop);

    expect(calls.map((call) => call.scenarios)).toEqual([
      ["agent-case", "runtime-case"],
      ["runtime-case"],
      ["agent-case"],
      ["agent-case"],
    ]);
    expect(prepared.assessment.focus?.failureFamily).toBe("scope-control");
    expect(prepared.assessment.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "runtime",
          scenarios: ["runtime-case"],
        }),
      ]),
    );
    expect(prepared.assessment.baseline_run_id).toBe("run-4");
    expect(classificationAttempts).toBe(2);
    expect(
      JSON.parse(
        readFileSync(
          join(
            projectsRoot,
            "gym.app",
            ".state",
            "metrics",
            "autonomous-improvement.json",
          ),
          "utf8",
        ),
      ),
    ).toMatchObject({
      valid_run_rate: 1 / 3,
      total_model_trials: 9,
      proposals_accepted: 0,
      regressions_prevented: 0,
    });
  });

  test("verifies a non-empty candidate after a builder terminal-stream error", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-app-candidate-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const benchmarkDir = join(projectsRoot, "gym", "benchmarks", "test-bench");
    const runsDir = join(projectsRoot, "gym", ".state", "benchmarks");
    const baselineDir = join(runsDir, "baseline");
    const workspaceDir = join(root, "workspace");
    const agentsRoot = join(root, "agents");
    mkdirSync(benchmarkDir, { recursive: true });
    mkdirSync(baselineDir, { recursive: true });
    mkdirSync(join(agentsRoot, "may"), { recursive: true });
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(join(agentsRoot, "may", "AGENTS.md"), "# May\n");
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      JSON.stringify({
        scenarios: ["agent-case", "control-case", "excluded-case"],
      }),
    );
    const baseline = manifest("baseline", {
      "agent-case": ["fail", "fail", "fail"],
    });
    writeFileSync(join(baselineDir, "manifest.json"), JSON.stringify(baseline));

    const runDirs: string[] = [];
    let verifyCount = 0;
    const loop: GymLoopApi = {
      async run(options) {
        expect(options.trials).toBe(5);
        expect(options.benchmark).toBe("release-bench");
        expect(options.scenarios).toEqual(["agent-case", "control-case"]);
        const runDir = join(runsDir, "release-baseline");
        mkdirSync(runDir, { recursive: true });
        const release = manifest("release-baseline", {
          "agent-case": ["pass", "pass", "pass", "pass", "pass"],
          "control-case": ["pass", "pass", "pass", "pass", "pass"],
        });
        release.trials_per_scenario = 5;
        release.scenarios = ["agent-case", "control-case"];
        writeFileSync(join(runDir, "manifest.json"), JSON.stringify(release));
        return { runDir, manifest: release };
      },
      async verify(input) {
        verifyCount++;
        const runDir = join(runsDir, `verify-${verifyCount}`);
        mkdirSync(runDir, { recursive: true });
        const candidatePath = join(input.agentsRoot!, ".lab", input.candidate);
        const releaseVerification = verifyCount === 2;
        const verified = manifest(
          `verify-${verifyCount}`,
          releaseVerification
            ? {
                "agent-case": ["pass", "pass", "pass", "pass", "pass"],
                "control-case": ["pass", "pass", "pass", "pass", "pass"],
              }
            : { "agent-case": ["pass", "pass", "pass"] },
        );
        verified.phase = "verify";
        verified.candidate = input.candidate;
        verified.proof.candidate_fingerprint = fingerprintTree(candidatePath);
        const comparison = {
          baseline_run_id: String(input.baseline),
          candidate_run_id: verified.run_id,
          labels_approved: true,
          same_framework_revision: true,
          no_invalid_runs: true,
          no_regressions: true,
          improved: !releaseVerification,
          gate: releaseVerification ? ("fail" as const) : ("pass" as const),
          scenarios: [],
        };
        writeFileSync(
          join(runDir, "comparison.json"),
          `${JSON.stringify(comparison)}\n`,
        );
        runDirs.push(runDir);
        return {
          runDir,
          manifest: verified,
          comparison,
        };
      },
    };

    const notifications: string[] = [];
    const emitted: Record<string, unknown>[] = [];
    const dispatched: Record<string, unknown>[] = [];
    const taskPacket = {
      taskId: "improve/may",
      generation: 2,
      input: {
        agent: "may",
        benchmark: "test-bench",
        baselineRunId: "baseline",
        assessmentPath: "/evidence/assessment.json",
        focusScenarios: ["agent-case"],
        failureFamily: "scope-control",
        classificationSummary: "May exceeded the requested scope.",
        releaseBenchmark: "release-bench",
        releaseScenarios: ["agent-case", "control-case"],
      },
    };
    const task = [
      "## Reconciliation Task",
      "```json",
      JSON.stringify(taskPacket),
      "```",
    ].join("\n");
    const ctx = {
      projectsRoot,
      workspaceDir,
      task,
      async runAgent(agent: string, prompt: string) {
        expect(agent).toBe("gym-implementer");
        const marker = "Candidate overlay directory: ";
        const line = prompt
          .split("\n")
          .find((value) => value.startsWith(marker));
        const candidateDir = line!.slice(marker.length);
        mkdirSync(candidateDir, { recursive: true });
        writeFileSync(join(candidateDir, "AGENTS.md"), "# Improved May\n");
        return {
          status: "error",
          sessionId: "s_builder_stream_error",
          lastAssistantText: "",
        };
      },
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      dispatchEvent(type: string, data: Record<string, unknown>) {
        dispatched.push({ type, ...data });
      },
      notify(message: string) {
        notifications.push(message);
      },
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    } as unknown as WorkflowContext;

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(result.state).toBe("waiting");
    expect(result.summary).toContain(
      "passed targeted and release verification",
    );
    expect(verifyCount).toBe(2);
    expect(emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "project.approval.requested",
          taskId: "improve/may",
          taskGeneration: 2,
          approvalKind: "agent-improvement",
          artifactFingerprint: expect.stringMatching(/^sha256:/),
        }),
        expect.objectContaining({
          type: "gym.improvement.reviewed",
          taskId: "improve/may",
          recommendation: "promote",
        }),
      ]),
    );
    expect(dispatched).toEqual([
      expect.objectContaining({
        type: "message.created",
        to: "human",
        approvalKind: "agent-improvement",
        expectedResponse: expect.objectContaining({
          type: "project.approval.submitted",
          taskId: "improve/may",
          taskGeneration: 2,
        }),
      }),
    ]);
    expect(result.conditions).toEqual([
      expect.objectContaining({
        type: "project.approval.submitted",
        subject: expect.stringMatching(/^approvalId:gym:agent-improvement:/),
        expected: expect.objectContaining({
          taskId: "improve/may",
          taskGeneration: 2,
          artifactFingerprint: expect.stringMatching(/^sha256:/),
        }),
      }),
    ]);
    expect(notifications).toHaveLength(0);
    expect(runDirs).toHaveLength(2);

    const request = emitted.find(
      (event) => event.type === "project.approval.requested",
    )!;
    const withApproval = (artifactFingerprint: unknown) =>
      [
        task,
        "",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.approval.submitted",
          data: {
            approvalId: request.approvalId,
            taskId: "improve/may",
            taskGeneration: 2,
            artifactFingerprint,
            decision: "approve",
            message: "approve",
          },
        }),
        "```",
      ].join("\n");

    (ctx as unknown as { task: string }).task = withApproval("sha256:stale");
    const stale = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(stale.state).toBe("waiting");
    expect(readFileSync(join(agentsRoot, "may", "AGENTS.md"), "utf8")).toBe(
      "# May\n",
    );

    (ctx as unknown as { task: string }).task = withApproval(
      request.artifactFingerprint,
    );
    const approved = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(approved.state).toBe("converged");
    expect(approved.summary).toContain("Applied approved May candidate");
    expect(readFileSync(join(agentsRoot, "may", "AGENTS.md"), "utf8")).toBe(
      "# Improved May\n",
    );
    expect(emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "agent.revision.changed",
          agent: "may",
          scenarios: ["agent-case"],
          trials: 3,
          approvalId: request.approvalId,
        }),
      ]),
    );
    expect(verifyCount).toBe(2);
    expect(
      JSON.parse(
        readFileSync(
          join(
            projectsRoot,
            "gym.app",
            ".state",
            "metrics",
            "autonomous-improvement.json",
          ),
          "utf8",
        ),
      ).proposals_accepted,
    ).toBe(1);

    (ctx as unknown as { task: string }).task = [
      task,
      "",
      "## Trigger Event",
      "```json",
      JSON.stringify({
        type: "agent.revision.changed",
        data: {
          agent: "may",
          revision: request.artifactFingerprint,
        },
      }),
      "```",
    ].join("\n");
    const confirmation = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(confirmation.state).toBe("converged");
    expect(confirmation.summary).toContain("Applied approved May candidate");
    expect(verifyCount).toBe(2);
    expect(
      emitted.filter((event) => event.type === "agent.revision.changed"),
    ).toHaveLength(1);
  });

  test("revises a failed candidate inside one ordered workflow attempt", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-app-revise-loop-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const gymRoot = join(projectsRoot, "gym");
    const benchmarkDir = join(gymRoot, "benchmarks", "test-bench");
    const runsDir = join(gymRoot, ".state", "benchmarks");
    const baselineDir = join(runsDir, "baseline");
    const agentsRoot = join(root, "agents");
    const workspaceDir = join(root, "untouched-workspace");
    mkdirSync(benchmarkDir, { recursive: true });
    mkdirSync(baselineDir, { recursive: true });
    mkdirSync(join(agentsRoot, "may"), { recursive: true });
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(join(agentsRoot, "may", "AGENTS.md"), "# May\n");
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      JSON.stringify({ scenarios: ["agent-case", "control-case"] }),
    );
    const baseline = manifest("baseline", {
      "agent-case": ["fail", "fail", "fail"],
    });
    writeFileSync(join(baselineDir, "manifest.json"), JSON.stringify(baseline));

    let implementCount = 0;
    let reviewCount = 0;
    let verifyCount = 0;
    const loop: GymLoopApi = {
      async run() {
        const runDir = join(runsDir, "release-baseline");
        mkdirSync(runDir, { recursive: true });
        const release = manifest("release-baseline", {
          "agent-case": ["fail", "fail", "fail", "fail", "fail"],
          "control-case": ["pass", "pass", "pass", "pass", "pass"],
        });
        release.trials_per_scenario = 5;
        writeFileSync(join(runDir, "manifest.json"), JSON.stringify(release));
        return { runDir, manifest: release };
      },
      async verify(input) {
        verifyCount++;
        const runDir = join(runsDir, `verify-${verifyCount}`);
        mkdirSync(runDir, { recursive: true });
        const candidatePath = join(input.agentsRoot!, ".lab", input.candidate);
        const passed = verifyCount > 1;
        const verified = manifest(`verify-${verifyCount}`, {
          "agent-case": passed
            ? ["pass", "pass", "pass"]
            : ["fail", "fail", "fail"],
        });
        verified.phase = "verify";
        verified.candidate = input.candidate;
        verified.proof.candidate_fingerprint = fingerprintTree(candidatePath);
        const comparison = {
          baseline_run_id: String(input.baseline),
          candidate_run_id: verified.run_id,
          labels_approved: true,
          same_framework_revision: true,
          no_invalid_runs: true,
          no_regressions: passed,
          improved: passed,
          gate: passed ? ("pass" as const) : ("fail" as const),
          scenarios: [],
        };
        writeFileSync(
          join(runDir, "comparison.json"),
          JSON.stringify(comparison),
        );
        return { runDir, manifest: verified, comparison };
      },
    };
    const emitted: Record<string, unknown>[] = [];
    const task = [
      "## Reconciliation Task",
      "```json",
      JSON.stringify({
        taskId: "improve/may",
        generation: 3,
        input: {
          agent: "may",
          benchmark: "test-bench",
          baselineRunId: "baseline",
          assessmentPath: "/evidence/assessment.json",
          focusScenarios: ["agent-case"],
          failureFamily: "scope-control",
          classificationSummary: "May exceeded the requested scope.",
        },
      }),
      "```",
    ].join("\n");
    const ctx = {
      projectsRoot,
      workspaceDir,
      task,
      async runAgent(agent: string, prompt: string) {
        if (agent === "gym") {
          reviewCount++;
          return {
            status: "done",
            structuredResult: {
              disposition: "revise-candidate",
              summary:
                "The behavior gap remains, but the first wording is too weak.",
              proposedChange: "Make the scope boundary explicit.",
              evidence: ["verify-1"],
            },
          };
        }
        implementCount++;
        const marker = "Candidate overlay directory: ";
        const candidateDir = prompt
          .split("\n")
          .find((line) => line.startsWith(marker))!
          .slice(marker.length);
        mkdirSync(candidateDir, { recursive: true });
        writeFileSync(
          join(candidateDir, "AGENTS.md"),
          `# Candidate ${implementCount}\n`,
        );
        return {
          status: "done",
          structuredResult: {
            summary: `Candidate ${implementCount}`,
            changedFiles: ["AGENTS.md"],
            evidence: [`candidate-${implementCount}`],
          },
        };
      },
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      dispatchEvent() {},
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    } as unknown as WorkflowContext;

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;

    expect(result.state).toBe("waiting");
    expect(result.actions).toEqual([]);
    expect(implementCount).toBe(2);
    expect(reviewCount).toBe(1);
    expect(verifyCount).toBe(3);
    expect(
      existsSync(join(workspaceDir, "agents")),
      "candidate scratch must not dirty the task workspace",
    ).toBe(false);
    expect(
      existsSync(
        join(projectsRoot, "gym.app", ".state", "scratch", "improve-may", "3"),
      ),
    ).toBe(false);
    expect(emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "gym.improvement.reviewed",
          recommendation: "promote",
        }),
      ]),
    );
  });

  test("reuses a durable development checkpoint after recovery", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-app-recovery-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const gymRoot = join(projectsRoot, "gym");
    const benchmarkDir = join(gymRoot, "benchmarks", "test-bench");
    const runsDir = join(gymRoot, ".state", "benchmarks");
    const baselineDir = join(runsDir, "baseline");
    const agentsRoot = join(root, "agents");
    const iterationDir = join(
      projectsRoot,
      "gym.app",
      ".state",
      "candidates",
      "improve-may",
      "4",
      "iterations",
      "1",
    );
    const durableCandidate = join(iterationDir, "may");
    mkdirSync(benchmarkDir, { recursive: true });
    mkdirSync(baselineDir, { recursive: true });
    mkdirSync(join(agentsRoot, "may"), { recursive: true });
    mkdirSync(durableCandidate, { recursive: true });
    writeFileSync(join(agentsRoot, "may", "AGENTS.md"), "# May\n");
    writeFileSync(join(durableCandidate, "AGENTS.md"), "# Candidate\n");
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      JSON.stringify({ scenarios: ["agent-case"] }),
    );
    const baseline = manifest("baseline", {
      "agent-case": ["fail", "fail", "fail"],
    });
    writeFileSync(join(baselineDir, "manifest.json"), JSON.stringify(baseline));
    const candidateFingerprint = fingerprintTree(durableCandidate);
    writeFileSync(
      join(iterationDir, "candidate.json"),
      JSON.stringify({
        candidateId: "gym/may/g4-i1",
        candidatePath: durableCandidate,
        candidateFingerprint,
        implementationSummary: "Recovered candidate",
        implementationEvidence: ["candidate.json"],
      }),
    );
    const developmentDir = join(runsDir, "development-existing");
    mkdirSync(developmentDir, { recursive: true });
    const developmentManifest = manifest("development-existing", {
      "agent-case": ["fail", "fail", "fail"],
    });
    developmentManifest.phase = "verify";
    developmentManifest.proof.candidate_fingerprint = candidateFingerprint;
    writeFileSync(
      join(iterationDir, "development-verification.json"),
      JSON.stringify({
        runDir: developmentDir,
        manifest: developmentManifest,
        comparison: {
          baseline_run_id: "baseline",
          candidate_run_id: "development-existing",
          labels_approved: true,
          same_framework_revision: true,
          no_invalid_runs: true,
          no_regressions: false,
          improved: false,
          gate: "fail",
          scenarios: [],
        },
      }),
    );

    let verifyCount = 0;
    const loop: GymLoopApi = {
      async run() {
        throw new Error("release baseline should not run");
      },
      async verify() {
        verifyCount++;
        throw new Error("checkpointed verification should not rerun");
      },
    };
    const ctx = {
      projectsRoot,
      task: [
        "## Reconciliation Task",
        "```json",
        JSON.stringify({
          taskId: "improve/may",
          generation: 4,
          input: {
            agent: "may",
            benchmark: "test-bench",
            baselineRunId: "baseline",
            assessmentPath: "/evidence/assessment.json",
            focusScenarios: ["agent-case"],
            failureFamily: "scope-control",
          },
        }),
        "```",
      ].join("\n"),
      async runAgent(agent: string) {
        expect(agent).toBe("gym");
        return {
          status: "done",
          structuredResult: {
            disposition: "needs-human",
            summary: "The evidence is preference-sensitive.",
            proposedChange: "Ask Hao for intent.",
            evidence: [developmentDir],
          },
        };
      },
      emit() {},
      dispatchEvent() {},
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    } as unknown as WorkflowContext;

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(result.state).toBe("needs-owner");
    expect(result).not.toHaveProperty("actions");
    expect(result).not.toHaveProperty("conditions");
    expect(verifyCount).toBe(0);
    expect(
      existsSync(
        join(
          projectsRoot,
          "gym.app",
          ".state",
          "scratch",
          "improve-may",
          "4",
          "1",
        ),
      ),
    ).toBe(false);
  });

  test("retries the exact track candidate without rebuilding it", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-track-retry-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const gymRoot = join(projectsRoot, "gym");
    const agentsRoot = join(root, "agents");
    const benchmarkDir = join(gymRoot, "benchmarks", "test-bench");
    const runsDir = join(gymRoot, ".state", "benchmarks");
    const baselineDir = join(runsDir, "baseline");
    const scope = "cli-worker-track";
    const stateDir = join(
      projectsRoot,
      "gym.app",
      ".state",
      "candidates",
      "improve-may",
      "7",
      "tracks",
      scope,
    );
    const iterationDir = join(stateDir, "iterations", "2");
    const candidateDir = join(iterationDir, "may");
    const assessmentPath = join(
      projectsRoot,
      "gym.app",
      ".state",
      "assessments",
      "improve-may",
      "7",
      `${scope}.json`,
    );
    mkdirSync(benchmarkDir, { recursive: true });
    mkdirSync(baselineDir, { recursive: true });
    mkdirSync(join(agentsRoot, "may"), { recursive: true });
    mkdirSync(candidateDir, { recursive: true });
    mkdirSync(dirname(assessmentPath), { recursive: true });
    writeFileSync(join(agentsRoot, "may", "AGENTS.md"), "# May\n");
    writeFileSync(join(candidateDir, "AGENTS.md"), "# Exact candidate\n");
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      JSON.stringify({ scenarios: ["agent-case"] }),
    );
    const baseline = manifest("baseline", {
      "agent-case": ["fail", "fail", "fail"],
    });
    writeFileSync(join(baselineDir, "manifest.json"), JSON.stringify(baseline));
    const candidateFingerprint = fingerprintTree(candidateDir);
    writeFileSync(
      join(iterationDir, "candidate.json"),
      JSON.stringify({
        candidateId: "gym/may/g7-i2",
        candidatePath: candidateDir,
        candidateFingerprint,
        implementationSummary: "Existing exact candidate",
        implementationEvidence: ["existing-candidate"],
      }),
    );
    writeFileSync(
      assessmentPath,
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        benchmark: "test-bench",
        release_benchmark: "test-bench",
        release_scenarios: ["agent-case"],
        screening_run_id: "baseline",
        screening_run_dir: baselineDir,
        retry_run_id: null,
        retry_run_dir: null,
        findings: [
          {
            classification: "agent",
            scenarios: ["agent-case"],
            failureFamily: "cli-recovery",
            summary: "May missed the requested independent review.",
            evidence: [baselineDir],
          },
        ],
        focus: {
          classification: "agent",
          scenarios: ["agent-case"],
          failureFamily: "cli-recovery",
          summary: "May missed the requested independent review.",
          evidence: [baselineDir],
        },
        baseline_run_id: "baseline",
        baseline_run_dir: baselineDir,
        accepted_at: "2026-08-01T00:00:00Z",
      }),
    );
    for (const file of [
      "development-verification.json",
      "release-baseline.json",
      "release-verification.json",
      "failed-review.json",
    ]) {
      writeFileSync(join(iterationDir, file), JSON.stringify({ stale: true }));
    }
    writeFileSync(
      join(stateDir, "result.json"),
      JSON.stringify({
        schema_version: 1,
        task_id: "improve/may",
        generation: 7,
        iteration: 2,
        candidate_path: candidateDir,
        candidate_fingerprint: candidateFingerprint,
        verification_run_dir: "old-verification",
        summary: "Old verification needs review.",
        evidence: [],
        workflow_state: "needs-owner",
        conditions: [],
        approval: null,
      }),
    );

    let verifyCount = 0;
    const newRunDir = join(runsDir, "retry-verification");
    const loop: GymLoopApi = {
      async run() {
        throw new Error("the frozen baseline must be reused");
      },
      async verify() {
        verifyCount++;
        mkdirSync(newRunDir, { recursive: true });
        const value = manifest("retry-verification", {
          "agent-case": ["fail", "fail", "fail"],
        });
        value.phase = "verify";
        value.proof.candidate_fingerprint = candidateFingerprint;
        const comparison = {
          baseline_run_id: "baseline",
          candidate_run_id: "retry-verification",
          labels_approved: true,
          same_framework_revision: true,
          no_invalid_runs: true,
          no_regressions: true,
          improved: false,
          gate: "fail" as const,
          scenarios: [],
        };
        writeFileSync(join(newRunDir, "manifest.json"), JSON.stringify(value));
        writeFileSync(
          join(newRunDir, "comparison.json"),
          JSON.stringify(comparison),
        );
        return { runDir: newRunDir, manifest: value, comparison };
      },
    };
    const calledAgents: string[] = [];
    const ctx = {
      projectsRoot,
      task: [
        "## Reconciliation Task",
        "```json",
        JSON.stringify({
          taskId: "improve/may",
          generation: 7,
          input: { agent: "may", curriculumDrain: true },
          children: {
            live: [
              {
                taskId: "improve/may/adjudicate-old-trial",
                generation: 3,
              },
            ],
          },
        }),
        "```",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "gym.improvement.requested",
          params: {
            reason: "retry-candidate-verification",
            candidateFingerprint,
          },
        }),
        "```",
      ].join("\n"),
      async runAgent(agent: string) {
        calledAgents.push(agent);
        expect(agent).toBe("gym");
        return {
          status: "done",
          structuredResult: {
            disposition: "needs-human",
            summary: "Fresh evidence still needs human judgment.",
            proposedChange: "Review the fresh evidence.",
            evidence: [newRunDir],
          },
        };
      },
      emit() {},
      dispatchEvent() {},
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    } as unknown as WorkflowContext;

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(result.state).toBe("needs-owner");
    expect(verifyCount).toBe(1);
    expect(calledAgents).toEqual(["gym"]);
    expect(fingerprintTree(candidateDir)).toBe(candidateFingerprint);
    expect(result.actions).toEqual([
      expect.objectContaining({
        kind: "close-task",
        taskId: "improve/may/adjudicate-old-trial",
        expectedGeneration: 3,
      }),
    ]);
    expect(
      JSON.parse(readFileSync(join(stateDir, "result.json"), "utf8"))
        .candidate_fingerprint,
    ).toBe(candidateFingerprint);
    expect(
      JSON.parse(
        readFileSync(join(iterationDir, "verification-retry.json"), "utf8"),
      ).candidate_fingerprint,
    ).toBe(candidateFingerprint);

    rmSync(join(stateDir, "result.json"));
    rmSync(join(iterationDir, "development-verification.json"));
    rmSync(join(iterationDir, "failed-review.json"));
    const recovered = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(recovered.state).toBe("needs-owner");
    expect(verifyCount).toBe(2);
    expect(calledAgents).toEqual(["gym", "gym"]);
    expect(fingerprintTree(candidateDir)).toBe(candidateFingerprint);
  });
});

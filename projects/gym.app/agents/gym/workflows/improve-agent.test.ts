import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { LoopRunManifest, RunOptions } from "@may-agent/gym/loop";
import {
  applyDirectorySnapshot,
  authoritativeAssessmentProblems,
  benchmarkFixConfirmationScope,
  benchmarkFixTarget,
  buildBenchmarkFixRetryEvent,
  buildApprovalRequest,
  dispatchApproval,
  evaluationOnlyAdjustmentFromResponse,
  experimentNeedsIntegration,
  fingerprintTree,
  improvementInput,
  isBaselineInvalidOnlyComparisonFailure,
  isCandidateInvalidOnlyComparisonFailure,
  isFrameworkOnlyComparisonFailure,
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
  verify,
  verificationBenchmark,
  validateFindings,
  writeWorkflowResultRevision,
  type Finding,
  type GymLoopApi,
} from "./improve-agent";
import { canonicalGymTestContext } from "./lib/test-context";

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

function outputOf(result: Record<string, unknown>): Record<string, unknown> {
  return result.output as Record<string, unknown>;
}

describe("single agent-improvement loop", () => {
  test("preserves immutable result revisions while retaining the legacy latest pointer", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-result-revisions-"));
    roots.push(root);
    const resultPath = join(root, "generation", "result.json");

    const firstRevision = writeWorkflowResultRevision(resultPath, {
      summary: "First terminal result",
      next: "done",
      evidence: [resultPath, "first-proof"],
    });
    const firstBytes = readFileSync(firstRevision);
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toMatchObject({
      summary: "First terminal result",
      result_revision_path: firstRevision,
      result_latest_path: resultPath,
      evidence: [firstRevision, "first-proof"],
    });

    const secondRevision = writeWorkflowResultRevision(resultPath, {
      summary: "Second terminal result",
      next: "wait-for-approval",
      evidence: [resultPath, "second-proof"],
      approval: {
        kind: "agent-improvement",
        packetPath: resultPath,
      },
    });
    const secondBytes = readFileSync(secondRevision);
    expect(secondRevision).not.toBe(firstRevision);
    expect(readFileSync(firstRevision)).toEqual(firstBytes);
    expect(readFileSync(secondRevision)).toEqual(secondBytes);
    expect(JSON.parse(readFileSync(firstRevision, "utf8")).summary).toBe(
      "First terminal result",
    );
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toMatchObject({
      summary: "Second terminal result",
      result_revision_path: secondRevision,
      result_latest_path: resultPath,
      approval: {
        packetPath: resultPath,
        packetRevisionPath: secondRevision,
        packetLatestPath: resultPath,
      },
    });

    const legacyPath = join(
      root,
      "gym.app",
      ".state",
      "candidates",
      "legacy",
      "1",
      "result.json",
    );
    mkdirSync(dirname(legacyPath), { recursive: true });
    writeFileSync(
      legacyPath,
      JSON.stringify({
        summary: "Legacy single result",
        candidate_fingerprint: "a".repeat(64),
      }),
    );
    expect(
      locateCandidateRetry(root, "legacy", 1, {
        reason: "retry-candidate-verification",
        candidateFingerprint: "a".repeat(64),
      }),
    ).toMatchObject({ resultPath: legacyPath });
  });

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
    const verificationDir = join(root, "release-verification-7");
    mkdirSync(snapshotPath, { recursive: true });
    mkdirSync(targetPath, { recursive: true });
    mkdirSync(verificationDir, { recursive: true });
    writeFileSync(join(snapshotPath, "scorer.cjs"), "fixed\n");
    writeFileSync(join(targetPath, "scorer.cjs"), "old\n");
    const verificationManifest = manifest("release-7", {
      "release-case": ["fail"],
    });
    verificationManifest.benchmark = "consumer-transfer";
    writeFileSync(
      join(verificationDir, "manifest.json"),
      JSON.stringify(verificationManifest),
    );
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
        verification_run_dir: verificationDir,
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
        evidence: Array.from({ length: 40 }, (_, index) => `evidence-${index}`),
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
    const ctx = canonicalGymTestContext({
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
    });
    const unusedLoop: GymLoopApi = {
      async run() {
        throw new Error("approval recovery must not start curriculum runs");
      },
      async verify() {
        throw new Error("approval recovery must not verify before applying");
      },
    };

    const result = (await runImprovement(ctx, unusedLoop)) as unknown as Record<
      string,
      unknown
    >;
    expect(result.summary).toContain("Applied approved benchmark/scorer fix");
    expect((outputOf(result).evidence as unknown[]).length).toBeLessThanOrEqual(
      32,
    );
    expect(readFileSync(join(targetPath, "scorer.cjs"), "utf8")).toBe(
      "fixed\n",
    );
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.improvement.requested",
        data: expect.objectContaining({
          reason: "approved-benchmark-fix-applied",
          artifactFingerprint,
          benchmark: "consumer-transfer",
          scenarios: ["release-case"],
        }),
      }),
    ]);
  });

  test("turns a rejected benchmark proposal into a new exact proposal", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-benchmark-revision-"));
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
      "benchmark-track",
    );
    const resultPath = join(stateDir, "result.json");
    const assessmentPath = join(stateDir, "assessment.json");
    const oldArtifact = join(stateDir, "benchmark-fix", "development-case");
    const scenarioPath = join(
      projectsRoot,
      "gym",
      "scenarios",
      "development-case",
    );
    const verificationDir = join(root, "verification-7");
    mkdirSync(oldArtifact, { recursive: true });
    mkdirSync(scenarioPath, { recursive: true });
    mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
      join(oldArtifact, "expected.json"),
      '{"rule":"old proposal"}\n',
    );
    writeFileSync(join(scenarioPath, "expected.json"), '{"rule":"current"}\n');
    writeFileSync(
      join(verificationDir, "manifest.json"),
      JSON.stringify(
        manifest("verification-7", { "development-case": ["fail"] }),
      ),
    );
    writeFileSync(
      assessmentPath,
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        benchmark: "test-bench",
        release_benchmark: "test-bench",
        release_scenarios: ["development-case"],
        screening_run_id: "verification-7",
        screening_run_dir: verificationDir,
        retry_run_id: null,
        retry_run_dir: null,
        findings: [],
        focus: null,
        baseline_run_id: "verification-7",
        baseline_run_dir: verificationDir,
        accepted_at: "2026-08-01T00:00:00Z",
      }),
    );
    const artifactFingerprint = `sha256:${fingerprintTree(oldArtifact)}`;
    const approvalId = "approval-rejected-7";
    writeFileSync(
      resultPath,
      JSON.stringify({
        summary: "Waiting for exact approval.",
        next: "wait-for-approval",
        assessment_path: assessmentPath,
        baseline_run_id: "verification-7",
        focus: {
          classification: "benchmark",
          scenarios: ["development-case"],
          summary: "Repair benchmark meaning.",
          evidence: ["old-evidence"],
        },
        artifact_path: oldArtifact,
        artifact_target_path: scenarioPath,
        verification_run_dir: verificationDir,
        recommendation: "review-benchmark",
        review: {
          disposition: "review-benchmark",
          summary: "Old lexical proposal",
          proposedChange: "Expand literal words",
          evidence: [],
        },
        approval: {
          kind: "benchmark-fix",
          approvalId,
          waitId: `wait:${approvalId}`,
          taskId: "improve/may",
          taskGeneration: 7,
          artifactFingerprint,
          packetPath: resultPath,
          requestedAction: "Approve?",
          reason: "Old proposal",
          condition: { id: approvalId, type: "project.approval.submitted" },
        },
        conditions: [],
        evidence: [resultPath],
      }),
    );
    const task = [
      "## Reconciliation Task",
      "```json",
      JSON.stringify({ taskId: "improve/may", generation: 7, input: {} }),
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
          decision: "decline",
          message:
            "Use calibrated semantic judging with positive and negative controls.",
        },
      }),
      "```",
    ].join("\n");
    const emitted: Record<string, unknown>[] = [];
    const dispatched: Array<{ type: string; data: Record<string, unknown> }> =
      [];
    const ctx = canonicalGymTestContext({
      projectsRoot,
      task,
      async runAgent(_agent: string, prompt: string) {
        const snapshot = prompt.match(/Writable benchmark snapshot: (.+)/)?.[1];
        if (!snapshot) throw new Error("builder did not receive a snapshot");
        writeFileSync(
          join(snapshot, "expected.json"),
          '{"rule":"semantic controls"}\n',
        );
        return {
          status: "success",
          sessionId: "builder-7",
          structuredResult: {
            summary: "Replaced the lexical rule with calibrated controls.",
            changedFiles: ["expected.json"],
            evidence: ["semantic-controls:test"],
          },
        };
      },
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      dispatchEvent(type: string, data: Record<string, unknown>) {
        dispatched.push({ type, data });
      },
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    });

    const result = (await runImprovement(ctx, {
      async run() {
        throw new Error("decision handling must not start a new baseline");
      },
      async verify() {
        throw new Error("decision handling must not verify before approval");
      },
    })) as unknown as Record<string, unknown>;

    expect(outputOf(result).state).toBe("waiting");
    const current = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(current.next).toBe("wait-for-approval");
    expect(current.workflow_state).toBeUndefined();
    expect(current.approval.artifactFingerprint).not.toBe(artifactFingerprint);
    expect(current.review.proposedChange).toContain("calibrated semantic");
    const decisionDir = join(
      stateDir,
      "decisions",
      artifactFingerprint.replace(/[^a-zA-Z0-9._-]+/g, "-"),
    );
    expect(existsSync(join(decisionDir, "decision.json"))).toBe(true);
    expect(
      readFileSync(join(decisionDir, "artifact", "expected.json"), "utf8"),
    ).toContain("old proposal");
    expect(
      emitted.some(({ type }) => type === "project.approval.requested"),
    ).toBe(true);
    expect(dispatched).toHaveLength(1);
  });

  test("runs an exact evaluation adjustment and recovers its completed verification", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-evaluation-adjustment-"));
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
      "approved-suite",
    );
    const iterationDir = join(stateDir, "iterations", "1");
    const candidatePath = join(iterationDir, "may");
    const resultPath = join(stateDir, "result.json");
    const assessmentPath = join(stateDir, "assessment.json");
    const benchmark = "approved-development";
    const scenarios = ["case-a", "case-b"];
    const benchmarkDir = join(projectsRoot, "gym", "benchmarks", benchmark);
    const protectedBenchmark = join(
      projectsRoot,
      "gym",
      "benchmarks",
      "draft-transfer",
    );
    const oldProposal = join(iterationDir, "benchmark-fix", "draft-transfer");
    const sourceMay = join(root, "agents", "may");
    for (const path of [
      candidatePath,
      benchmarkDir,
      protectedBenchmark,
      oldProposal,
      sourceMay,
    ]) {
      mkdirSync(path, { recursive: true });
    }
    writeFileSync(join(candidatePath, "agent.json"), '{"candidate":true}\n');
    writeFileSync(join(sourceMay, "agent.json"), '{"candidate":false}\n');
    writeFileSync(join(protectedBenchmark, "suite.json"), '{"draft":true}\n');
    writeFileSync(join(oldProposal, "suite.json"), '{"replacement":true}\n');
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      JSON.stringify({
        name: benchmark,
        version: 1,
        scenarios,
        labels_file: "labels.json",
      }),
    );
    writeFileSync(
      join(benchmarkDir, "labels.json"),
      JSON.stringify({
        labels: Object.fromEntries(
          scenarios.map((scenario) => [
            scenario,
            {
              status: "approved",
              approved_by: "hao",
              approved_at: "2026-08-06T00:00:00Z",
            },
          ]),
        ),
      }),
    );
    const candidateFingerprint = fingerprintTree(candidatePath);
    writeFileSync(
      join(iterationDir, "candidate.json"),
      JSON.stringify({
        candidateId: "gym/may/g7-i1",
        candidatePath,
        candidateFingerprint,
        implementationSummary: "Exact candidate",
        implementationEvidence: [],
      }),
    );
    const baselineDir = join(root, "old-baseline");
    mkdirSync(baselineDir, { recursive: true });
    writeFileSync(
      assessmentPath,
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        benchmark,
        release_benchmark: "draft-transfer",
        release_scenarios: ["draft-case"],
        screening_run_id: "old-baseline",
        screening_run_dir: baselineDir,
        retry_run_id: null,
        retry_run_dir: null,
        findings: [],
        focus: null,
        baseline_run_id: "old-baseline",
        baseline_run_dir: baselineDir,
        accepted_at: "2026-08-06T00:00:00Z",
      }),
    );
    const oldArtifactFingerprint = `sha256:${fingerprintTree(oldProposal)}`;
    const approvalId = "benchmark-adjustment-7";
    writeFileSync(
      resultPath,
      JSON.stringify({
        summary: "Waiting for benchmark proposal approval.",
        next: "wait-for-approval",
        assessment_path: assessmentPath,
        baseline_run_id: "old-baseline",
        focus: {
          classification: "agent",
          scenarios: ["case-a"],
          failureFamily: "test-gap",
          summary: "May missed the expected behavior.",
          evidence: [],
        },
        iteration: 1,
        candidate_id: "gym/may/g7-i1",
        candidate_path: candidatePath,
        candidate_fingerprint: candidateFingerprint,
        artifact_path: oldProposal,
        artifact_target_path: protectedBenchmark,
        recommendation: "review-benchmark",
        review: {
          disposition: "review-benchmark",
          summary: "Old proposal",
          proposedChange: "Replace the transfer suite",
          evidence: [],
        },
        approval: {
          kind: "benchmark-fix",
          approvalId,
          waitId: `wait:${approvalId}`,
          taskId: "improve/may",
          taskGeneration: 7,
          artifactFingerprint: oldArtifactFingerprint,
          packetPath: resultPath,
          requestedAction: "Approve?",
          reason: "Old proposal",
          condition: { id: approvalId, type: "project.approval.submitted" },
        },
        conditions: [],
        evidence: [resultPath],
      }),
    );
    const originalProposal = JSON.parse(readFileSync(resultPath, "utf8"));
    const adjustmentMessage = `Keep draft-transfer unchanged. Verify exact candidate fingerprint ${candidateFingerprint} against the unchanged full approved ${benchmark} suite. Run a fresh same-framework baseline and candidate comparison. Require no invalid runs and no regressions.`;
    const adjustment = {
      schema_version: 1,
      kind: "verify-candidate",
      candidateFingerprint,
      benchmark,
      scenarios: "active-suite",
      freshBaseline: true,
    } as const;

    const task = [
      "## Reconciliation Task",
      "```json",
      JSON.stringify({ taskId: "improve/may", generation: 7, input: {} }),
      "```",
      "## Trigger Event",
      "```json",
      JSON.stringify({
        type: "project.approval.submitted",
        data: {
          approvalId,
          taskId: "improve/may",
          taskGeneration: 7,
          artifactFingerprint: oldArtifactFingerprint,
          packetPath: resultPath,
          decision: "adjust",
          message: adjustmentMessage,
          adjustment,
        },
      }),
      "```",
    ].join("\n");
    const baselineRunDir = join(root, "fresh-baseline");
    const verificationRunDir = join(
      projectsRoot,
      "gym",
      ".state",
      "benchmarks",
      "fresh-verification",
    );
    let runCount = 0;
    let verifyCount = 0;
    const loop: GymLoopApi = {
      async run(options: RunOptions) {
        runCount++;
        expect(options).toMatchObject({
          phase: "test",
          benchmark,
          scenarios,
          agent: "may",
          candidate: "baseline",
          trials: 5,
        });
        const value = manifest(
          "fresh-baseline",
          Object.fromEntries(scenarios.map((scenario) => [scenario, ["fail"]])),
        );
        value.benchmark = benchmark;
        value.agent = "may";
        value.trials_per_scenario = 5;
        value.trials = scenarios.flatMap((scenario) =>
          Array.from({ length: 5 }, (_, index) => ({
            ...manifest("one", { [scenario]: ["fail"] }).trials[0]!,
            scenario,
            trial: index + 1,
          })),
        );
        mkdirSync(baselineRunDir, { recursive: true });
        return { runDir: baselineRunDir, manifest: value };
      },
      async verify(input) {
        verifyCount++;
        expect(input.baseline).toBe("fresh-baseline");
        expect(input.trials).toBe(5);
        const value = manifest(
          "fresh-verification",
          Object.fromEntries(scenarios.map((scenario) => [scenario, ["pass"]])),
        );
        value.phase = "verify";
        value.baseline_run_id = "fresh-baseline";
        value.benchmark = benchmark;
        value.agent = "may";
        value.candidate = input.candidate;
        value.trials_per_scenario = 5;
        value.started_at = "2026-07-21T00:02:00Z";
        value.completed_at = "2026-07-21T00:03:00Z";
        value.proof.candidate_fingerprint = candidateFingerprint;
        value.trials = scenarios.flatMap((scenario) =>
          Array.from({ length: 5 }, (_, index) => ({
            ...manifest("one", { [scenario]: ["pass"] }).trials[0]!,
            scenario,
            trial: index + 1,
          })),
        );
        const comparison = {
          baseline_run_id: "fresh-baseline",
          candidate_run_id: "fresh-verification",
          labels_approved: true,
          same_framework_revision: true,
          no_invalid_runs: true,
          no_regressions: true,
          improved: true,
          gate: "pass" as const,
          scenarios: [],
        };
        mkdirSync(verificationRunDir, { recursive: true });
        writeFileSync(
          join(verificationRunDir, "manifest.json"),
          JSON.stringify(value),
        );
        writeFileSync(
          join(verificationRunDir, "comparison.json"),
          JSON.stringify(comparison),
        );
        return { runDir: verificationRunDir, manifest: value, comparison };
      },
    };
    let builderCalls = 0;
    const ctx = canonicalGymTestContext({
      projectsRoot,
      task,
      async runAgent() {
        builderCalls++;
        throw new Error("evaluation-only adjustment must not call an editor");
      },
      emit() {},
      dispatchEvent() {},
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    });

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(outputOf(result).state).toBe("waiting");
    expect(runCount).toBe(1);
    expect(verifyCount).toBe(1);
    expect(builderCalls).toBe(0);
    expect(readFileSync(join(protectedBenchmark, "suite.json"), "utf8")).toBe(
      '{"draft":true}\n',
    );
    const saved = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(saved.recommendation).toBe("promote");
    expect(saved.artifact_path).toBe(candidatePath);
    expect(saved.approval).toMatchObject({
      kind: "agent-improvement",
      artifactFingerprint: `sha256:${candidateFingerprint}`,
    });
    expect(saved.evaluation_adjustment).toMatchObject({
      kind: "verify-candidate",
      benchmark,
      scenarios: "active-suite",
      freshBaseline: true,
    });

    const adjustmentsRoot = join(iterationDir, "adjustments");
    const adjustmentDirs = readdirSync(adjustmentsRoot);
    expect(adjustmentDirs).toHaveLength(1);
    const verificationCheckpointPath = join(
      adjustmentsRoot,
      adjustmentDirs[0]!,
      "verification.json",
    );
    rmSync(verificationCheckpointPath);
    expect(existsSync(verificationCheckpointPath)).toBe(false);
    const failedComparison = JSON.parse(
      readFileSync(join(verificationRunDir, "comparison.json"), "utf8"),
    );
    failedComparison.no_invalid_runs = false;
    failedComparison.no_regressions = false;
    failedComparison.gate = "fail";
    writeFileSync(
      join(verificationRunDir, "comparison.json"),
      JSON.stringify(failedComparison),
    );

    const decisionDir = join(
      stateDir,
      "decisions",
      oldArtifactFingerprint.replace(":", "-"),
    );
    mkdirSync(decisionDir, { recursive: true });
    writeFileSync(
      join(decisionDir, "proposal.json"),
      JSON.stringify(originalProposal),
    );
    writeFileSync(
      join(decisionDir, "decision.json"),
      JSON.stringify({
        decision: "adjust",
        message: adjustmentMessage,
        adjustment,
        ...originalProposal.approval,
      }),
    );
    writeFileSync(
      resultPath,
      JSON.stringify({
        ...originalProposal,
        summary:
          "Gym could not build a new benchmark/scorer proposal from the reviewed evidence.",
        next: "ask-owner",
        conditions: [],
        approval: null,
        review: {
          disposition: "review-benchmark",
          summary: `Hao adjusted the previous benchmark/scorer proposal: ${adjustmentMessage}`,
          proposedChange: adjustmentMessage,
          evidence: [
            join(decisionDir, "decision.json"),
            join(decisionDir, "proposal.json"),
          ],
        },
      }),
    );

    ctx.task = [
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
        type: "gym.improvement.requested",
        data: {
          agent: "may",
          curriculumDrain: true,
          reason: "resume-preserved-evaluation-only-adjustment",
        },
      }),
      "```",
    ].join("\n");
    const recoveryCtx = ctx;

    writeFileSync(join(protectedBenchmark, "suite.json"), '{"changed":true}\n');
    const drifted = (await runImprovement(
      recoveryCtx,
      loop,
    )) as unknown as Record<string, unknown>;
    expect(outputOf(drifted).state).toBe("needs-agent");
    expect(drifted.summary).toBe(
      "Durable evaluation-only request no longer matches its protected inputs",
    );
    expect(runCount).toBe(1);
    expect(verifyCount).toBe(1);
    expect(existsSync(verificationCheckpointPath)).toBe(false);
    writeFileSync(join(protectedBenchmark, "suite.json"), '{"draft":true}\n');

    const recovered = (await runImprovement(
      recoveryCtx,
      loop,
    )) as unknown as Record<string, unknown>;
    expect(outputOf(recovered).state).toBe("converged");
    expect(runCount).toBe(1);
    expect(verifyCount).toBe(1);
    expect(builderCalls).toBe(0);
    expect(existsSync(verificationCheckpointPath)).toBe(true);
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toMatchObject({
      recommendation: "verification-failed",
      next: "done",
      completion_kind: "non-may-disposition",
      track_state: "issue",
      approval: null,
    });
  });

  test("uses only the structured evaluation-only adjustment", () => {
    const fingerprint = "a".repeat(64);
    const accepted = evaluationOnlyAdjustmentFromResponse({
      decision: "adjust",
      message: "Please run the bounded comparison.",
      adjustment: {
        schema_version: 1,
        kind: "verify-candidate",
        candidateFingerprint: fingerprint,
        benchmark: "may-test",
        scenarios: "active-suite",
        freshBaseline: true,
      },
    });
    expect(accepted).toMatchObject({
      candidateFingerprint: fingerprint,
      benchmark: "may-test",
      scenarios: "active-suite",
    });
    expect(
      evaluationOnlyAdjustmentFromResponse({
        decision: "adjust",
        message: `Verify exact candidate fingerprint ${fingerprint} against the unchanged full approved may-test suite. Run a fresh same-framework baseline and candidate comparison. Require no invalid runs and no regressions.`,
      }),
    ).toBeNull();
    expect(
      evaluationOnlyAdjustmentFromResponse({
        decision: "decline",
        message: `Verify exact candidate fingerprint ${fingerprint} against the unchanged full approved may-test suite. Run a fresh same-framework baseline and candidate comparison. Require no invalid runs and no regressions.`,
        adjustment: {
          schema_version: 1,
          kind: "verify-candidate",
          candidateFingerprint: fingerprint,
          benchmark: "may-test",
          scenarios: "active-suite",
          freshBaseline: true,
        },
      }),
    ).toBeNull();
  });

  test("rejects convergence while a cited campaign checkpoint is unfinished", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-campaign-verifier-"));
    roots.push(root);
    const appDir = join(root, "gym.app");
    const resultPath = join(
      appDir,
      ".state",
      "candidates",
      "improve-may",
      "7",
      "tracks",
      "target",
      "result.json",
    );
    mkdirSync(dirname(resultPath), { recursive: true });
    writeFileSync(
      resultPath,
      JSON.stringify({
        next: "wait-for-approval",
        approval: { approvalId: "approval-7" },
      }),
    );

    const rejected = await verify(
      { appDir, taskId: "improve/may", generation: 7 },
      {
        state: "converged",
        evidence: [`${resultPath}: current campaign packet`],
      },
    );
    expect(rejected.accepted).toBe(false);
    expect(rejected.evidence).toEqual([resultPath]);

    writeFileSync(
      resultPath,
      JSON.stringify({
        next: "done",
        approval: null,
        completion_kind: "no-actionable-failure",
        track_state: "complete",
      }),
    );
    const staleRootResultPath = join(
      appDir,
      ".state",
      "candidates",
      "improve-may",
      "7",
      "result.json",
    );
    writeFileSync(
      staleRootResultPath,
      JSON.stringify({
        next: "ask-owner",
        approval: { approvalId: "stale-root-approval" },
      }),
    );
    expect(
      await verify(
        { appDir, taskId: "improve/may", generation: 7 },
        { state: "converged", evidence: [resultPath] },
      ),
    ).toMatchObject({ accepted: true });

    writeFileSync(
      resultPath,
      JSON.stringify({ approval: { approvalId: "legacy-approval" } }),
    );
    expect(
      await verify(
        { appDir, taskId: "improve/may", generation: 7 },
        { state: "converged", evidence: [resultPath] },
      ),
    ).toMatchObject({ accepted: false, evidence: [resultPath] });

    writeFileSync(
      resultPath,
      JSON.stringify({
        next: "done",
        stop_reason: "candidate-safety-limit",
        completion_kind: "no-actionable-failure",
        track_state: "complete",
      }),
    );
    expect(
      await verify(
        { appDir, taskId: "improve/may", generation: 7 },
        { state: "converged", evidence: [resultPath] },
      ),
    ).toMatchObject({ accepted: false, evidence: [resultPath] });

    const projectDir = join(root, "gym");
    const learningDir = join(projectDir, "benchmarks", "may-learning");
    const benchmarkDir = join(projectDir, "benchmarks", "current-benchmark");
    const scenarioDir = join(projectDir, "scenarios", "current-case");
    mkdirSync(learningDir, { recursive: true });
    mkdirSync(benchmarkDir, { recursive: true });
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(
      join(learningDir, "autonomous-training.json"),
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        tracks: [
          {
            id: "current-track",
            benchmark: "current-benchmark",
            scenarios: ["current-case"],
            trials: 1,
          },
        ],
      }),
    );
    writeFileSync(
      join(benchmarkDir, "suite.json"),
      JSON.stringify({
        labels_file: "labels.json",
        scenarios: ["current-case"],
      }),
    );
    writeFileSync(
      join(benchmarkDir, "labels.json"),
      JSON.stringify({
        labels: {
          "current-case": {
            status: "approved",
            approved_by: "hao",
            approved_at: "2026-08-24",
          },
        },
      }),
    );
    writeFileSync(join(scenarioDir, "prompt.md"), "current case\n");

    const campaignId = `sha256:${"a".repeat(64)}`;
    const currentResultPath = join(
      appDir,
      ".state",
      "candidates",
      "improve-may",
      "7",
      "tracks",
      `current-track-${"a".repeat(16)}`,
      "result.json",
    );
    const staleResultPath = join(
      appDir,
      ".state",
      "candidates",
      "improve-may",
      "7",
      "tracks",
      `old-track-${"b".repeat(16)}`,
      "result.json",
    );
    mkdirSync(dirname(currentResultPath), { recursive: true });
    mkdirSync(dirname(staleResultPath), { recursive: true });
    writeFileSync(
      currentResultPath,
      JSON.stringify({
        next: "done",
        completion_kind: "no-actionable-failure",
        track_state: "complete",
      }),
    );
    writeFileSync(
      staleResultPath,
      JSON.stringify({
        next: "wait-for-approval",
        approval: { approvalId: "old-campaign-approval" },
      }),
    );
    writeFileSync(
      join(appDir, ".state", "candidates", "improve-may", "7", "result.json"),
      JSON.stringify({
        next: "wait-for-approval",
        approval: { approvalId: "old-root-approval" },
      }),
    );
    const trainingPath = join(
      appDir,
      ".state",
      "learning",
      "training-drain.json",
    );
    mkdirSync(dirname(trainingPath), { recursive: true });
    writeFileSync(
      trainingPath,
      JSON.stringify({
        schema_version: 2,
        agent: "may",
        campaign_id: campaignId,
        curriculum_fingerprint: `sha256:${"c".repeat(64)}`,
        agent_fingerprint: `sha256:${"d".repeat(64)}`,
        updated_at: "2026-08-05T00:00:00Z",
        exhausted_at: "2026-08-05T00:00:00Z",
        tracks: [
          {
            id: "current-track",
            state: "complete",
            summary: "current track passed",
            evidence: [currentResultPath],
          },
        ],
        evidence: [currentResultPath],
      }),
    );
    expect(
      await verify(
        { appDir, projectDir, taskId: "improve/may", generation: 7 },
        { state: "converged", evidence: [trainingPath] },
      ),
    ).toMatchObject({ accepted: true });
  });

  test("rejects convergence without positive campaign proof", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-missing-proof-verifier-"));
    roots.push(root);
    expect(
      await verify(
        {
          appDir: join(root, "gym.app"),
          projectDir: join(root, "gym"),
          taskId: "improve/may",
          generation: 7,
        },
        { state: "converged", evidence: [] },
      ),
    ).toMatchObject({ accepted: false, evidence: [] });
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
          "included-case": {
            status: "approved",
            approved_by: "hao",
            approved_at: "2026-08-24",
          },
          "omitted-case": {
            status: "approved",
            approved_by: "hao",
            approved_at: "2026-08-24",
          },
        },
      }),
    );

    expect(() => loadCurriculumTargets(root)).toThrow(
      "Autonomous May training track approved-learning omits approved scenarios: omitted-case",
    );
  });

  test("admits only the approved autonomous curriculum", async () => {
    const gymRoot = join(import.meta.dir, "../../../../gym");
    const { targets, fingerprint } = loadCurriculumTargets(gymRoot);
    expect(fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(targets).toEqual([
      {
        id: "app-outcome-management",
        benchmark: "may-app-outcome-management",
        scenarios: [
          "may-app-answer-status-directly",
          "may-app-clarify-ambiguous-target",
          "may-app-delegate-one-shot-outcome",
          "may-app-explain-task-reconciliation",
          "may-app-route-host-operation",
          "may-app-review-terminal-result",
          "may-app-replan-missing-proof",
        ],
        trials: 3,
      },
    ]);
  });

  test("drains every approved learning track and stops at the first decision boundary", async () => {
    const targets = [
      {
        id: "app-outcome-management",
        benchmark: "may-app-outcome-management",
        scenarios: ["may-app-delegate-recurring-outcome"],
        trials: 3,
      },
    ];

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
      return target.id === "app-outcome-management"
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
    expect(visited).toEqual(["app-outcome-management"]);

    visited.length = 0;
    const deferredIssue = await runCurriculumSequence(
      targets,
      async (target) => {
        visited.push(target.id);
        return target.id === "app-outcome-management"
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

  test("reconciles one assessment per wake and resumes from the campaign checkpoint", async () => {
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
          data: { curriculumDrain: true, reason },
        }),
        "```",
      ].join("\n");
    const ctx = canonicalGymTestContext({
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
    });

    const first = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(first.summary).toContain("2 approved tracks remain");
    expect(outputOf(first).actions).toEqual([]);
    expect(runCount).toBe(1);
    expect(maxActive).toBe(1);
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.improvement.requested",
        data: expect.objectContaining({ reason: "curriculum-continue" }),
      }),
    ]);
    expect(
      await verify(
        {
          appRoot: join(projectsRoot, "gym.app"),
          projectRoot: gymRoot,
          taskId: "improve/may",
          generation: 1,
          pendingTrigger: { type: "gym.improvement.requested" },
        },
        outputOf(first),
      ),
    ).toMatchObject({ accepted: true });
    expect(
      await verify(
        {
          appRoot: join(projectsRoot, "gym.app"),
          projectRoot: gymRoot,
          taskId: "improve/may",
          generation: 1,
        },
        outputOf(first),
      ),
    ).toMatchObject({ accepted: false });
    (ctx as unknown as { task: string }).task = task("curriculum-continue");
    const second = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(second.summary).toContain("1 approved track remains");
    expect(runCount).toBe(2);
    (ctx as unknown as { task: string }).task = task("curriculum-continue");
    const third = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(third.summary).toContain("training material is exhausted");
    expect(runCount).toBe(3);

    const trainingPath = join(
      projectsRoot,
      "gym.app",
      ".state",
      "learning",
      "training-drain.json",
    );
    const exhausted = JSON.parse(readFileSync(trainingPath, "utf8")) as Record<
      string,
      unknown
    >;
    exhausted.evidence = Array.from(
      { length: 32 },
      (_, index) => `evidence-${index + 1}`,
    );
    writeFileSync(trainingPath, JSON.stringify(exhausted));

    (ctx as unknown as { task: string }).task = task("curriculum-refill");
    const replay = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(replay.summary).toBe(
      "May already passes every approved learning track.",
    );
    expect(outputOf(replay).evidence).toHaveLength(32);
    expect(outputOf(replay).evidence).toContain(trainingPath);
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

  test("checkpoints a fresh actionable assessment before candidate integration", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-assessment-stage-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const gymRoot = join(projectsRoot, "gym");
    const benchmark = "actionable-track";
    const scenario = "actionable-case";
    const learningRoot = join(gymRoot, "benchmarks", "may-learning");
    const benchmarkRoot = join(gymRoot, "benchmarks", benchmark);
    mkdirSync(learningRoot, { recursive: true });
    mkdirSync(benchmarkRoot, { recursive: true });
    mkdirSync(join(gymRoot, "scenarios", scenario), { recursive: true });
    mkdirSync(join(root, "agents", "may"), { recursive: true });
    writeFileSync(join(root, "agents", "may", "AGENTS.md"), "# May\n");
    writeFileSync(
      join(learningRoot, "autonomous-training.json"),
      JSON.stringify({
        schema_version: 1,
        agent: "may",
        tracks: [
          { id: benchmark, benchmark, scenarios: [scenario], trials: 1 },
        ],
      }),
    );
    writeFileSync(
      join(benchmarkRoot, "suite.json"),
      JSON.stringify({ labels_file: "labels.json", scenarios: [scenario] }),
    );
    writeFileSync(
      join(benchmarkRoot, "labels.json"),
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
    writeFileSync(join(gymRoot, "scenarios", scenario, "prompt.md"), "case\n");

    let runCount = 0;
    let verifyCount = 0;
    const loop: GymLoopApi = {
      async run(options) {
        runCount++;
        const runId = `assessment-stage-${runCount}`;
        const runDir = join(gymRoot, ".state", "benchmarks", runId);
        mkdirSync(runDir, { recursive: true });
        const value = manifest(runId, { [scenario]: ["fail"] });
        value.benchmark = options.benchmark;
        value.scenarios = [scenario];
        writeFileSync(join(runDir, "manifest.json"), JSON.stringify(value));
        return { runDir, manifest: value };
      },
      async verify() {
        verifyCount++;
        throw new Error("fresh assessment must return before integration");
      },
    };
    const emitted: Record<string, unknown>[] = [];
    const ctx = canonicalGymTestContext({
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
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      async runAgent() {
        return {
          status: "success",
          sessionId: "classification-session",
          structuredResult: {
            findings: [
              {
                classification: "agent",
                scenarios: [scenario],
                failureFamily: "actionable-gap",
                summary: "May chose the wrong next action.",
                evidence: ["frozen-run"],
              },
            ],
          },
        };
      },
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    });

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(result.summary).toContain("fresh assessment");
    expect(runCount).toBe(1);
    expect(verifyCount).toBe(0);
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.improvement.requested",
        data: expect.objectContaining({ reason: "curriculum-continue" }),
      }),
    ]);
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
    const screening = manifest("mixed", {
      pass: ["pass", "pass", "pass"],
      gap: ["fail", "fail", "fail"],
      runtime: ["fail", "invalid", "fail"],
      retryable: ["pass", "invalid", "pass"],
    });
    const facts = scenarioVerdicts(screening);
    expect(facts).toEqual({
      pass: ["pass"],
      fail: ["gap", "runtime"],
      invalid: ["runtime", "retryable"],
    });

    const retry = manifest("retry", {
      runtime: ["invalid", "invalid", "invalid"],
      retryable: ["invalid", "invalid", "invalid"],
    });
    expect(authoritativeAssessmentProblems(screening, retry)).toEqual({
      failing: ["gap", "runtime"],
      invalid: ["retryable"],
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
      canonicalGymTestContext({ projectsRoot: join(root, "projects") }),
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

    expect(prepared.problem).toMatchObject({
      kind: "invalid-run",
      summary: expect.stringContaining("remained invalid"),
    });
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

  test("recognizes a framework-only comparison failure as recoverable", () => {
    const comparison = {
      baseline_run_id: "baseline",
      candidate_run_id: "candidate",
      labels_approved: true,
      same_framework_revision: false,
      no_invalid_runs: true,
      no_regressions: true,
      improved: true,
      gate: "fail" as const,
      scenarios: [],
    };
    expect(isFrameworkOnlyComparisonFailure(comparison)).toBe(true);
    expect(
      isFrameworkOnlyComparisonFailure({
        ...comparison,
        no_regressions: false,
      }),
    ).toBe(false);
  });

  test("recognizes an invalid baseline as recoverable when every candidate trial passed", () => {
    const candidate = manifest("candidate", {
      "agent-case": ["pass", "pass", "pass"],
    });
    candidate.phase = "verify";
    const checkpoint = {
      runDir: "/candidate",
      manifest: candidate,
      comparison: {
        baseline_run_id: "baseline",
        candidate_run_id: "candidate",
        labels_approved: true,
        same_framework_revision: true,
        no_invalid_runs: false,
        no_regressions: true,
        improved: true,
        gate: "fail" as const,
        scenarios: [],
      },
    };
    expect(isBaselineInvalidOnlyComparisonFailure(checkpoint)).toBe(true);

    candidate.trials[0]!.machine_verdict = "invalid";
    expect(isBaselineInvalidOnlyComparisonFailure(checkpoint)).toBe(false);
  });

  test("recognizes invalid-only candidate verification as recoverable against a valid baseline", () => {
    const baseline = manifest("baseline", {
      "agent-case": ["pass", "fail", "pass"],
    });
    const candidate = manifest("candidate", {
      "agent-case": ["pass", "invalid", "pass"],
    });
    candidate.phase = "verify";
    const checkpoint = {
      runDir: "/candidate",
      manifest: candidate,
      comparison: {
        baseline_run_id: "baseline",
        candidate_run_id: "candidate",
        labels_approved: true,
        same_framework_revision: true,
        no_invalid_runs: false,
        no_regressions: true,
        improved: true,
        gate: "fail" as const,
        scenarios: [],
      },
    };
    expect(isCandidateInvalidOnlyComparisonFailure(checkpoint, baseline)).toBe(
      true,
    );

    candidate.trials[1]!.machine_verdict = "fail";
    expect(isCandidateInvalidOnlyComparisonFailure(checkpoint, baseline)).toBe(
      false,
    );
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

    store("before-candidate", "2026-08-01T00:00:00Z", "2026-08-01T00:10:00Z");
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
    const ctx = canonicalGymTestContext({
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      dispatchEvent(type: string, data: Record<string, unknown>) {
        dispatched.push({ type, ...data });
      },
    });

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
        data: expect.objectContaining({
          approvalKind: "benchmark-fix",
          approvalId: request.approvalId,
        }),
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
      data: {
        scenarios: ["may-align-proof-before-adopt"],
        trials: 3,
        reason: "approved-benchmark-fix-applied",
      },
    });
  });

  test("isolates a benchmark-fix confirmation from an old root result", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-benchmark-confirmation-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const gymRoot = join(projectsRoot, "gym");
    const benchmark = "may-alignment";
    const scenario = "confirmation-case";
    const fingerprint = `sha256:${"b".repeat(64)}`;
    const benchmarkDir = join(gymRoot, "benchmarks", benchmark);
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
            approved_at: "2026-08-02T00:00:00Z",
          },
        },
      }),
    );

    const generationDir = join(
      projectsRoot,
      "gym.app",
      ".state",
      "candidates",
      "improve-may",
      "7",
    );
    mkdirSync(generationDir, { recursive: true });
    const rootResultPath = join(generationDir, "result.json");
    writeFileSync(
      rootResultPath,
      JSON.stringify({
        workflow_state: "converged",
        summary: "Applied approved benchmark/scorer fix sha256:old.",
      }),
    );

    let runCount = 0;
    const loop: GymLoopApi = {
      async run(options) {
        runCount++;
        const runId = `confirmation-run-${runCount}`;
        const runDir = join(gymRoot, ".state", "benchmarks", runId);
        mkdirSync(runDir, { recursive: true });
        const value = manifest(runId, { [scenario]: ["pass"] });
        value.benchmark = String(options.benchmark);
        value.scenarios = [scenario];
        writeFileSync(join(runDir, "manifest.json"), JSON.stringify(value));
        return { runDir, manifest: value };
      },
      async verify() {
        throw new Error("an all-pass confirmation must not build a candidate");
      },
    };
    const event = buildBenchmarkFixRetryEvent({
      agent: "may",
      benchmark,
      scenarios: [scenario],
      artifactFingerprint: fingerprint,
      taskId: "improve/may",
      taskGeneration: 7,
      approvalId: "approval-7",
    });
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
      JSON.stringify(event),
      "```",
    ].join("\n");
    const ctx = canonicalGymTestContext({
      projectsRoot,
      task,
      emit() {},
      done(summary: string, details: Record<string, unknown>) {
        return { type: "done", summary, ...details };
      },
      blocked(reason: string) {
        return { type: "blocked", reason };
      },
    });

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(runCount).toBe(1);
    expect(result.summary).toBe(
      "May has no actionable failures in the current approved evaluation.",
    );
    const scope = benchmarkFixConfirmationScope(
      event.data as Record<string, unknown>,
      "improve/may",
      7,
    );
    expect(scope).toEqual({
      scope: `benchmark-fix-confirmation-${"b".repeat(64)}`,
    });
    expect(
      existsSync(
        join(
          projectsRoot,
          "gym.app",
          ".state",
          "assessments",
          "improve-may",
          "7",
          `${(scope as { scope: string }).scope}.json`,
        ),
      ),
    ).toBe(true);
    expect(JSON.parse(readFileSync(rootResultPath, "utf8")).summary).toContain(
      "sha256:old",
    );
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
    const classificationPrompts: string[] = [];
    const ctx = canonicalGymTestContext({
      projectsRoot,
      async runAgent(_agent: string, prompt: string) {
        classificationAttempts++;
        classificationPrompts.push(prompt);
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
    });

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
    expect(classificationPrompts).toHaveLength(2);
    expect(classificationPrompts[1]).toContain(
      "A passing deterministic check proves only",
    );
    expect(classificationPrompts[1]).toContain(
      "classify May unless the evidence identifies a concrete rubric",
    );
    expect(classificationPrompts[1]).toContain(
      "Use scorer only for a demonstrated evaluator defect",
    );
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
    const ctx = canonicalGymTestContext({
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
    });

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(outputOf(result).state).toBe("waiting");
    expect(result.summary).toContain(
      "passed targeted and release verification",
    );
    expect(verifyCount).toBe(2);
    expect(emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "project.approval.requested",
          data: expect.objectContaining({
            taskId: "improve/may",
            taskGeneration: 2,
            approvalKind: "agent-improvement",
            artifactFingerprint: expect.stringMatching(/^sha256:/),
          }),
        }),
        expect.objectContaining({
          type: "gym.improvement.reviewed",
          data: expect.objectContaining({
            taskId: "improve/may",
            recommendation: "promote",
          }),
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
    expect(outputOf(result).conditions).toEqual([
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
    const requestData = request.data as Record<string, unknown>;
    const withApproval = (artifactFingerprint: unknown) =>
      [
        task,
        "",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.approval.submitted",
          data: {
            approvalId: requestData.approvalId,
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
    expect(outputOf(stale).state).toBe("waiting");
    expect(readFileSync(join(agentsRoot, "may", "AGENTS.md"), "utf8")).toBe(
      "# May\n",
    );

    (ctx as unknown as { task: string }).task = withApproval(
      requestData.artifactFingerprint,
    );
    const approved = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(outputOf(approved).state).toBe("converged");
    expect(approved.summary).toContain("Applied approved May candidate");
    expect(readFileSync(join(agentsRoot, "may", "AGENTS.md"), "utf8")).toBe(
      "# Improved May\n",
    );
    expect(emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "agent.revision.changed",
          data: expect.objectContaining({
            agent: "may",
            scenarios: ["agent-case"],
            trials: 3,
            approvalId: requestData.approvalId,
          }),
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
    expect(outputOf(confirmation).state).toBe("converged");
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
        if (verifyCount === 2) {
          expect(readFileSync(join(candidatePath, "AGENTS.md"), "utf8")).toBe(
            "# Candidate 1\n# Candidate 2\n",
          );
        }
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
    const ctx = canonicalGymTestContext({
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
        const candidateFile = join(candidateDir, "AGENTS.md");
        if (implementCount === 1) {
          writeFileSync(candidateFile, "# Candidate 1\n");
        } else {
          expect(readFileSync(candidateFile, "utf8")).toBe("# Candidate 1\n");
          expect(prompt).toContain(
            "candidate overlay already contains the exact previous failed candidate",
          );
          expect(prompt).toContain(
            "Do not repopulate the overlay from production May",
          );
          writeFileSync(candidateFile, "# Candidate 1\n# Candidate 2\n");
        }
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
    });

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;

    expect(outputOf(result).state).toBe("waiting");
    expect(outputOf(result).actions).toEqual([]);
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
          data: expect.objectContaining({ recommendation: "promote" }),
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
    writeFileSync(
      join(iterationDir, "..", "..", "result.json"),
      JSON.stringify({
        summary: 'Workflow "improve-agent" timed out after 7200000ms',
        stop_reason: "runtime-interrupted",
        next: "ask-owner",
        workflow_state: "converged",
        approval: null,
        conditions: [],
        evidence: ["stale-timeout"],
      }),
    );

    let verifyCount = 0;
    let reviewCount = 0;
    const loop: GymLoopApi = {
      async run() {
        throw new Error("release baseline should not run");
      },
      async verify() {
        verifyCount++;
        throw new Error("checkpointed verification should not rerun");
      },
    };
    const ctx = canonicalGymTestContext({
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
        reviewCount++;
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
    });

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(outputOf(result).state).toBe("needs-agent");
    expect(result.summary).toBe(
      "Gym found a needs-human issue: The evidence is preference-sensitive.",
    );
    expect(result).not.toHaveProperty("actions");
    expect(result).not.toHaveProperty("conditions");
    expect(reviewCount).toBe(1);
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
        workflow_state: "needs-agent",
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
    const ctx = canonicalGymTestContext({
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
          data: {
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
    });

    const result = (await runImprovement(ctx, loop)) as unknown as Record<
      string,
      unknown
    >;
    expect(outputOf(result).state).toBe("needs-agent");
    expect(verifyCount).toBe(1);
    expect(calledAgents).toEqual(["gym"]);
    expect(fingerprintTree(candidateDir)).toBe(candidateFingerprint);
    expect(outputOf(result).actions).toEqual([
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
    expect(outputOf(recovered).state).toBe("needs-agent");
    expect(verifyCount).toBe(2);
    expect(calledAgents).toEqual(["gym", "gym"]);
    expect(fingerprintTree(candidateDir)).toBe(candidateFingerprint);
  });
});

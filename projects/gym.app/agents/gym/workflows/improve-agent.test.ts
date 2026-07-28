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
import { join } from "node:path";
import type { LoopRunManifest, RunOptions } from "@may-agent/gym/loop";
import type { WorkflowContext } from "@may-agent/sdk";
import {
  applyDirectorySnapshot,
  benchmarkFixTarget,
  buildBenchmarkFixRetryEvent,
  buildApprovalRequest,
  dispatchApproval,
  fingerprintTree,
  learningPromptLines,
  loadCurriculumTargets,
  prepareAssessment,
  qualifiesHeldBackRelease,
  runImprovement,
  runCurriculumSequence,
  scenarioVerdicts,
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
      "initiative-and-approval",
      "system-deputy-operations",
      "system-deputy-learning-intake",
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

  test("gives candidate builders lessons and evidence without release truth", () => {
    const lines = learningPromptLines([
      {
        id: "initiative-and-approval",
        version: 1,
        title: "Act on bounded evidence",
        competencies: ["authority.act-vs-approve"],
        lessonPath: "/learning/lesson.md",
        practicePath: "/learning/practice.md",
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
          no_invalid_runs: true,
          no_regressions: true,
          improved: false,
          gate: "fail",
          scenarios: [],
        },
      }),
    ).toBe(false);
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

  test("retries only invalid cases and still prepares the independent May gap", async () => {
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
    const prepared = await prepareAssessment(
      ctx,
      { benchmark: "test-bench", agent: "may", trials: 3 },
      assessmentPath,
      loop,
    );

    expect(calls.map((call) => call.scenarios)).toEqual([
      ["agent-case", "runtime-case"],
      ["runtime-case"],
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
    expect(prepared.assessment.baseline_run_id).toBe("run-3");
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
});

import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalGymTestContext } from "./lib/test-context";
import {
  regressionEmissionLocalKey,
  runRegression,
  type ProcessRunner,
} from "./regression-run.ts";

function task(event: Record<string, unknown>): string {
  return `app: test\n\n## Trigger Event\n\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

function reconciliationTask(
  input: Record<string, unknown>,
  event: Record<string, unknown>,
): string {
  const packet = {
    appId: "gym",
    taskId: "regression/request-scope",
    generation: 1,
    resourceVersion: 2,
    agent: "gym",
    mode: "achieve",
    outcome: "Run the admitted bounded Gym regression.",
    acceptance: ["Execute exactly the admitted scenario and trial count."],
    input,
    children: { live: [], completed: [] },
  };
  return `app: gym\n\n## Reconciliation Task\n\n\`\`\`json\n${JSON.stringify(packet, null, 2)}\n\`\`\`\n\n## Trigger Event\n\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

function taskOwnedEventCollector(
  emitted: Array<Record<string, unknown>>,
): (event: Record<string, unknown>) => void {
  return (event) => {
    const localKey = event.localKey;
    if (typeof localKey !== "string" || !localKey.trim()) {
      throw new Error("Task-owned workflow events require a stable localKey");
    }
    emitted.push(event);
  };
}

test("production-shaped task wake preserves admitted bounded regression scope", async () => {
  const projectsRoot = join(
    mkdtempSync(join(tmpdir(), "gym-app-request-scope-")),
    "projects",
  );
  const ctx = canonicalGymTestContext({
    task: reconciliationTask(
      {
        requestId: "bounded-regression-1",
        benchmark: "may-alignment",
        agent: "may",
        scenario: "may-align-proof-before-adopt",
        trials: 1,
      },
      {
        type: "app.task.requested",
        data: {
          taskId: "regression/request-scope",
          action: "reconcile",
          requestId: "wake-regression-1",
        },
      },
    ),
    projectsRoot,
  });
  let observedCommand: string[] = [];

  await runRegression(ctx, async (command) => {
    observedCommand = command;
    return { exitCode: 2, stdout: "", stderr: "bounded test stop" };
  });

  expect(observedCommand).toEqual([
    "bun",
    "run",
    "loop",
    "--",
    "test",
    "--benchmark",
    "may-alignment",
    "--agent",
    "may",
    "--trials",
    "1",
    "--scenario",
    "may-align-proof-before-adopt",
  ]);
});

test("intentionally unscoped standalone regression keeps full-suite defaults", async () => {
  const projectsRoot = join(
    mkdtempSync(join(tmpdir(), "gym-app-unscoped-")),
    "projects",
  );
  const ctx = canonicalGymTestContext({
    task: reconciliationTask(
      {
        requestId: "unscoped-regression-1",
        benchmark: "may-alignment",
        agent: "may",
      },
      {
        type: "app.task.requested",
        data: {
          taskId: "regression/request-scope",
          action: "reconcile",
        },
      },
    ),
    projectsRoot,
  });
  let observedCommand: string[] = [];

  await runRegression(ctx, async (command) => {
    observedCommand = command;
    return { exitCode: 2, stdout: "", stderr: "unscoped test stop" };
  });

  expect(observedCommand).toEqual([
    "bun",
    "run",
    "loop",
    "--",
    "test",
    "--benchmark",
    "may-alignment",
    "--agent",
    "may",
    "--trials",
    "3",
  ]);
});

test("regression workflow invokes standalone Gym and queues review", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-app-regression-"));
  const projectsRoot = join(root, "projects");
  const runDir = join(projectsRoot, "gym", ".state", "benchmarks", "run_1");
  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    join(runDir, "manifest.json"),
    JSON.stringify({
      run_id: "run_1",
      benchmark: "may-alignment",
      agent: "may",
      scenarios: ["may-align-proof-before-adopt"],
      trials_per_scenario: 1,
      completed_at: "2026-07-16T12:00:00.000Z",
      trials: [
        {
          scenario: "may-align-proof-before-adopt",
          machine_verdict: "fail",
          label_status: "approved",
        },
      ],
    }),
  );

  const emitted: Array<Record<string, unknown>> = [];
  let observedCommand: string[] = [];
  const runner: ProcessRunner = async (command) => {
    observedCommand = command;
    return { exitCode: 0, stdout: `${runDir}\n`, stderr: "" };
  };
  const ctx = canonicalGymTestContext({
    task: task({
      type: "gym.regression.requested",
      data: {
        requestId: "app_regression_review_1",
        benchmark: "may-alignment",
        agent: "may",
        scenario: "may-align-proof-before-adopt",
        trials: 1,
      },
    }),
    projectsRoot,
    emit: taskOwnedEventCollector(emitted),
  });

  const result = await runRegression(ctx, runner);

  expect(result.status).toBe("done");
  expect(observedCommand).toEqual([
    "bun",
    "run",
    "loop",
    "--",
    "test",
    "--benchmark",
    "may-alignment",
    "--agent",
    "may",
    "--trials",
    "1",
    "--scenario",
    "may-align-proof-before-adopt",
  ]);
  expect(emitted.map((event) => event.type)).toEqual([
    "gym.regression.completed",
    "gym.review.requested",
  ]);
  expect(emitted.map((event) => event.localKey)).toEqual([
    regressionEmissionLocalKey(ctx, "completed"),
    regressionEmissionLocalKey(ctx, "review-required"),
  ]);
  expect(new Set(emitted.map((event) => event.localKey)).size).toBe(2);
  const outcomePath = join(
    projectsRoot,
    "gym.app",
    ".state",
    "runs",
    "run_1.json",
  );
  expect(JSON.parse(readFileSync(outcomePath, "utf8"))).toMatchObject({
    run_id: "run_1",
    counts: { pass: 0, fail: 1, invalid: 0 },
    review_required: true,
  });
});

test("regression emission keys are request-stable and semantic-specific", () => {
  const first = canonicalGymTestContext({
    task: task({
      type: "gym.regression.requested",
      data: {
        correlatedOwnerRequestId: "app_99458ee1-4cef-40e8-90eb-2bccc73ccb12",
      },
    }),
    projectsRoot: "/tmp/first-projects",
  });
  const redelivery = canonicalGymTestContext({
    task: task({
      type: "gym.regression.requested",
      data: {
        correlatedOwnerRequestId: "app_99458ee1-4cef-40e8-90eb-2bccc73ccb12",
      },
    }),
    projectsRoot: "/tmp/second-projects",
  });
  const semantics = [
    "completed",
    "review-required",
    "runtime-failed",
    "runtime-review-required",
  ] as const;
  const firstKeys = semantics.map((semantic) =>
    regressionEmissionLocalKey(first, semantic),
  );
  const redeliveryKeys = semantics.map((semantic) =>
    regressionEmissionLocalKey(redelivery, semantic),
  );

  expect(redeliveryKeys).toEqual(firstKeys);
  expect(new Set(firstKeys).size).toBe(semantics.length);
  expect(firstKeys.every((key) => key.length <= 256)).toBe(true);
});

test("successful regression completion emits one stable keyed event", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-app-completion-"));
  const projectsRoot = join(root, "projects");
  const runDir = join(projectsRoot, "gym", ".state", "benchmarks", "run_pass");
  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    join(runDir, "manifest.json"),
    JSON.stringify({
      run_id: "run_pass",
      benchmark: "may-alignment",
      agent: "may",
      scenarios: ["may-align-proof-before-adopt"],
      trials_per_scenario: 1,
      completed_at: "2026-07-16T12:00:00.000Z",
      trials: [
        {
          scenario: "may-align-proof-before-adopt",
          machine_verdict: "pass",
          label_status: "approved",
        },
      ],
    }),
  );
  const emitted: Array<Record<string, unknown>> = [];
  const ctx = canonicalGymTestContext({
    task: task({
      type: "gym.regression.requested",
      data: { requestId: "app_regression_completion_1", trials: 1 },
    }),
    projectsRoot,
    emit: taskOwnedEventCollector(emitted),
  });

  const result = await runRegression(ctx, async () => ({
    exitCode: 0,
    stdout: `${runDir}\n`,
    stderr: "",
  }));

  expect(result.status).toBe("done");
  expect(emitted.map((event) => [event.type, event.localKey])).toEqual([
    ["gym.regression.completed", regressionEmissionLocalKey(ctx, "completed")],
  ]);
});

test("regression workflow rejects unsafe input before spawning", async () => {
  for (const scenario of ["bad;command", "../may-align-secret"]) {
    let called = false;
    const ctx = canonicalGymTestContext({
      task: task({
        type: "gym.regression.requested",
        data: { scenario, trials: 1 },
      }),
      projectsRoot: "/tmp/projects",
    });
    const result = await runRegression(ctx, async () => {
      called = true;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    expect(result).toMatchObject({
      status: "blocked",
      summary: "scenario contains unsupported characters",
    });
    expect(called).toBe(false);
  }
});

test("explicit finish-result comparison executes once and returns the exact envelope through terminal readback", async () => {
  const data = {
    mode: "finish-result-comparison",
    requestId: "appdep_finish_result_unit",
    executionRequestId: "appdep_finish_result_unit_execution",
    priorRequestId: "appdep_finish_result_prior",
    outcome: "Compare the exact frozen finish-result baseline and candidate.",
    baseline: {
      artifact: "/app/.state/sessions/s_1787238379742_871/result.json",
      sha256:
        "e4d47ca876d70d8f24ec5896c33d4d1824acaced93d85b7ae128e92b8e870cff",
    },
    candidate: {
      worktree: "/app/projects/may-agent-finish-result-candidate",
      commit: "0ff56f626cbfb3646a098deef4042c8b262d1bd3",
      patchSha256:
        "c09007f96d991be0714f7c500afb53a125a5560550fda3ca3a965a0dd3c4aab7",
    },
    sampleScope: {
      positive: ["canonical and downstream readback"],
      negative: [
        "malformed",
        "missing",
        "null",
        "failed status",
        "duplicate completion",
        "secret safety",
        "unrelated Gym routing",
      ],
    },
    requiredProof: ["content-hashed terminal proof"],
    constraints: ["do not activate May Runtime"],
    returnPath:
      "/app/projects/gym/.state/proofs/finish-result-appdep-unit-test",
  };
  const emitted: Array<Record<string, unknown>> = [];
  const ctx = canonicalGymTestContext({
    task: task({ type: "gym.regression.requested", data }),
    projectsRoot: "/app/projects",
    emit: taskOwnedEventCollector(emitted),
  });
  let launches = 0;
  const result = await runRegression(
    ctx,
    async (command, options) => {
      launches++;
      expect(command).toEqual([
        "bun",
        "test",
        "src/app/session-terminal.test.ts",
        "src/app/app-task-runtime.test.ts",
        "--timeout",
        "30000",
      ]);
      expect(options.cwd).toBe(data.candidate.worktree);
      return { exitCode: 0, stdout: "25 pass\n0 fail\n", stderr: "" };
    },
    () => ({
      commit: data.candidate.commit,
      patchSha256: data.candidate.patchSha256,
      clean: true,
    }),
  );

  expect(launches).toBe(1);
  expect(result).toMatchObject({
    status: "done",
    output: {
      result: {
        disposition: "approve-for-proposal",
        envelope: data,
        launchCount: 1,
      },
    },
  });
  expect(emitted).toHaveLength(1);
  expect(emitted[0]).toMatchObject({
    type: "gym.regression.finish-result.completed",
    data: {
      requestId: data.requestId,
      priorRequestId: data.priorRequestId,
      launchCount: 1,
    },
  });
  const artifactPath = String(
    (result as { output: { result: { artifactPath: string } } }).output.result
      .artifactPath,
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  expect(artifact.record.envelope).toEqual(data);
  expect(artifact.record.execution).toMatchObject({
    correctedComparisonLaunches: 1,
    retries: 0,
    genericSubstitutions: 0,
    passed: 25,
    failed: 0,
  });
  expect(artifact.record.priorFailure.acceptedAsComparisonEvidence).toBe(false);
});

test("comparison workflow preserves the exact envelope, never launches standalone Gym, and redelivers idempotently", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-app-comparison-"));
  const projectsRoot = join(root, "projects");
  const evidenceRoot = join(projectsRoot, "may-agent", "evidence", "frozen");
  mkdirSync(evidenceRoot, { recursive: true });
  const baseline = "SELECT 'baseline';\n";
  const candidate = "SELECT 'candidate';\n";
  const comparison = JSON.stringify({ aggregateOnly: true });
  writeFileSync(join(evidenceRoot, "baseline.sql"), baseline);
  writeFileSync(join(evidenceRoot, "candidate.sql"), candidate);
  writeFileSync(join(evidenceRoot, "comparison.json"), comparison);
  const sha256 = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const data = {
    requestId: "appdep_frozen_source",
    executionRequestId: "appdep_single_execution",
    outcome: "Paraphrased exact comparison outcome.",
    scope: {
      baseline: {
        path: "evidence/frozen/baseline.sql",
        sha256: sha256(baseline),
      },
      candidate: {
        path: "evidence/frozen/candidate.sql",
        sha256: sha256(candidate),
      },
      comparisonArtifact: {
        path: "evidence/frozen/comparison.json",
        sha256: sha256(comparison),
      },
      expectedLifecycleTypes: ["positive-one"],
      negativeControls: ["negative-one"],
    },
    acceptanceProof: ["Preserve exact controls."],
    constraints: ["Do not launch the generic benchmark."],
    reviewAndFailureBranch: "Hold when representative rows are absent.",
  };
  const emitted: Array<Record<string, unknown>> = [];
  const ctx = canonicalGymTestContext({
    task: task({ type: "gym.regression.requested", data }),
    projectsRoot,
    emit: taskOwnedEventCollector(emitted),
  });
  let launches = 0;
  const runner: ProcessRunner = async () => {
    launches++;
    return { exitCode: 0, stdout: "", stderr: "" };
  };

  const first = await runRegression(ctx, runner);
  const redelivery = await runRegression(ctx, runner);

  expect(launches).toBe(0);
  expect(first).toMatchObject({
    status: "done",
    output: { result: { disposition: "hold" } },
  });
  expect(redelivery).toEqual(first);
  expect(emitted.map((item) => item.type)).toEqual([
    "gym.regression.comparison.completed",
    "gym.regression.comparison.completed",
  ]);
  const artifactPath = String(
    (first as { output: { result: { artifactPath: string } } }).output.result
      .artifactPath,
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  expect(artifact.record.envelope).toEqual(data);
  expect(artifact.record.correlation).toMatchObject({
    sourceRequestId: data.requestId,
    executionRequestId: data.executionRequestId,
    workflow: "regression-run",
  });
  expect(artifact.record.evidence).toMatchObject({
    representativeRowCount: 0,
    positiveCoverage: { required: ["positive-one"], observed: [] },
    negativeCoverage: { required: ["negative-one"], observed: [] },
  });
  const expectedContentHash = createHash("sha256")
    .update(JSON.stringify(artifact.record))
    .digest("hex");
  expect(artifact.contentHash).toBe(expectedContentHash);
});

test("comparison workflow fails closed on malformed envelopes before any launch", async () => {
  const malformed = [
    {},
    { requestId: "source", outcome: "compare", scope: {} },
    {
      requestId: "source",
      executionRequestId: "execution",
      outcome: "compare",
      scope: {
        baseline: { path: "../escape", sha256: "x".repeat(64) },
        candidate: { path: "candidate", sha256: "a".repeat(64) },
        comparisonArtifact: { path: "comparison", sha256: "b".repeat(64) },
        expectedLifecycleTypes: ["positive"],
        negativeControls: ["negative"],
      },
      acceptanceProof: ["proof"],
      constraints: ["constraint"],
    },
  ];
  for (const [index, data] of malformed.entries()) {
    let launched = false;
    const ctx = canonicalGymTestContext({
      task: task({
        type: "gym.regression.requested",
        data: { outcome: "comparison-shaped", ...data },
      }),
      projectsRoot: `/tmp/comparison-malformed-${index}`,
    });
    const result = await runRegression(ctx, async () => {
      launched = true;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    expect(result.status).toBe("blocked");
    expect(launched).toBe(false);
  }
});

test("regression process failure becomes durable review work", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-app-failure-"));
  const projectsRoot = join(root, "projects");
  const emitted: Array<Record<string, unknown>> = [];
  const ctx = canonicalGymTestContext({
    task: task({
      type: "gym.regression.requested",
      data: {
        requestId: "app_regression_runtime_failure_1",
        benchmark: "may-alignment",
        trials: 1,
      },
    }),
    projectsRoot,
    emit: taskOwnedEventCollector(emitted),
  });

  const result = await runRegression(ctx, async () => ({
    exitCode: 2,
    stdout: "",
    stderr: "adapter unavailable",
  }));

  expect(result).toMatchObject({
    status: "done",
    summary: "Gym regression process exited 2",
    output: {
      state: "converged",
    },
  });
  expect(emitted.map((event) => event.type)).toEqual([
    "gym.regression.failed",
    "gym.review.requested",
  ]);
  expect(emitted.map((event) => event.localKey)).toEqual([
    regressionEmissionLocalKey(ctx, "runtime-failed"),
    regressionEmissionLocalKey(ctx, "runtime-review-required"),
  ]);
  expect(new Set(emitted.map((event) => event.localKey)).size).toBe(2);
  const failurePath = String(
    (emitted[0]!.data as Record<string, unknown>).failurePath,
  );
  expect(JSON.parse(readFileSync(failurePath, "utf8"))).toMatchObject({
    benchmark: "may-alignment",
    evidence: { exitCode: 2, stderr: "adapter unavailable" },
  });
});

import { expect, test } from "bun:test";
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

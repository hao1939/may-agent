import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { runRegression, type ProcessRunner } from "./regression-run.ts";

function task(event: Record<string, unknown>): string {
  return `app: test\n\n## Trigger Event\n\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
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
  const ctx = {
    task: task({
      type: "gym.regression.requested",
      params: {
        benchmark: "may-alignment",
        agent: "may",
        scenario: "may-align-proof-before-adopt",
        trials: 1,
      },
    }),
    projectsRoot,
    emit(event: Record<string, unknown>) {
      emitted.push(event);
    },
    done(summary: string) {
      return { type: "done" as const, summary };
    },
    blocked(reason: string, context?: unknown) {
      return { type: "blocked" as const, reason, context };
    },
  } as unknown as WorkflowContext;

  const result = await runRegression(ctx, runner);

  expect(result.type).toBe("done");
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

test("regression workflow rejects unsafe input before spawning", async () => {
  for (const scenario of ["bad;command", "../may-align-secret"]) {
    let called = false;
    const ctx = {
      task: task({
        type: "gym.regression.requested",
        params: { scenario, trials: 1 },
      }),
      projectsRoot: "/tmp/projects",
      blocked(reason: string) {
        return { type: "blocked" as const, reason };
      },
    } as unknown as WorkflowContext;
    const result = await runRegression(ctx, async () => {
      called = true;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    expect(result).toMatchObject({
      type: "blocked",
      reason: "scenario contains unsupported characters",
    });
    expect(called).toBe(false);
  }
});

test("regression process failure becomes durable review work", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-app-failure-"));
  const projectsRoot = join(root, "projects");
  const emitted: Array<Record<string, unknown>> = [];
  const ctx = {
    task: task({
      type: "gym.regression.requested",
      params: { benchmark: "may-alignment", trials: 1 },
    }),
    projectsRoot,
    emit(event: Record<string, unknown>) {
      emitted.push(event);
    },
    done(summary: string, output?: unknown) {
      return { type: "done" as const, summary, output };
    },
    blocked(reason: string, context?: unknown) {
      return { type: "blocked" as const, reason, context };
    },
  } as unknown as WorkflowContext;

  const result = await runRegression(ctx, async () => ({
    exitCode: 2,
    stdout: "",
    stderr: "adapter unavailable",
  }));

  expect(result).toMatchObject({
    type: "done",
    summary: "Gym regression process exited 2",
    output: {
      disposition: "converged",
    },
  });
  expect(emitted.map((event) => event.type)).toEqual([
    "gym.regression.failed",
    "gym.review.requested",
  ]);
  const failurePath = String(emitted[0]!.failurePath);
  expect(JSON.parse(readFileSync(failurePath, "utf8"))).toMatchObject({
    benchmark: "may-alignment",
    evidence: { exitCode: 2, stderr: "adapter unavailable" },
  });
});

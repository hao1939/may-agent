import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { safeKey, triggerDetails } from "./lib/trigger";

export const name = "regression-run";
export const description =
  "Run the standalone Gym CLI and persist an autonomous regression outcome.";

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ProcessRunner = (
  command: string[],
  options: { cwd: string; env: Record<string, string | undefined> },
) => Promise<ProcessResult>;

export const runProcess: ProcessRunner = async (command, options) => {
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env: options.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stdout, stderr };
};

function validatedName(
  value: unknown,
  label: string,
  fallback: string,
): string {
  const result = String(value ?? fallback);
  const segments = result.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment),
    )
  ) {
    throw new Error(`${label} contains unsupported characters`);
  }
  return result;
}

function trials(value: unknown): number {
  const parsed = Number(value ?? 3);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("trials must be an integer from 1 through 5");
  }
  return parsed;
}

function requestedScenarios(details: Record<string, unknown>): string[] {
  const values = Array.isArray(details.scenarios)
    ? details.scenarios
    : details.scenario
      ? [details.scenario]
      : [];
  return values.map((value) => validatedName(value, "scenario", ""));
}

function runDirectory(stdout: string): string | null {
  for (const line of stdout.trim().split(/\r?\n/).reverse()) {
    const candidate = line.trim();
    if (candidate.startsWith("/") && existsSync(candidate)) {
      return resolve(candidate);
    }
  }
  return null;
}

function summarizeRun(runDir: string): Record<string, unknown> {
  const manifest = JSON.parse(
    readFileSync(join(runDir, "manifest.json"), "utf8"),
  ) as Record<string, any>;
  const trialRows = Array.isArray(manifest.trials) ? manifest.trials : [];
  const counts = { pass: 0, fail: 0, invalid: 0 };
  for (const row of trialRows) {
    const verdict = String(
      row.machine_verdict ?? "invalid",
    ) as keyof typeof counts;
    if (verdict in counts) counts[verdict]++;
  }
  const unapproved = trialRows
    .filter((row) => row.label_status !== "approved")
    .map((row) => row.scenario)
    .filter((value, index, all) => all.indexOf(value) === index);
  return {
    schema_version: 1,
    run_id: manifest.run_id,
    run_dir: runDir,
    benchmark: manifest.benchmark,
    agent: manifest.agent,
    scenarios: manifest.scenarios,
    trials_per_scenario: manifest.trials_per_scenario,
    counts,
    unapproved_scenarios: unapproved,
    review_required:
      counts.fail > 0 || counts.invalid > 0 || unapproved.length > 0,
    completed_at: manifest.completed_at,
  };
}

function regressionFailure(
  ctx: WorkflowContext,
  benchmark: string,
  reason: string,
  evidence: Record<string, unknown>,
): WorkflowResult {
  const failureKey = createHash("sha256")
    .update(JSON.stringify({ benchmark, reason, evidence }))
    .digest("hex")
    .slice(0, 20);
  const failureDir = join(ctx.projectsRoot, "gym.app", ".state", "failures");
  const failurePath = join(failureDir, `${failureKey}.json`);
  mkdirSync(failureDir, { recursive: true });
  writeFileSync(
    failurePath,
    `${JSON.stringify(
      {
        schema_version: 1,
        failure_id: failureKey,
        benchmark,
        reason,
        evidence,
        captured_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  ctx.emit({
    type: "gym.regression.failed",
    project: "gym",
    benchmark,
    reason,
    failurePath,
    ...evidence,
  });
  ctx.emit({
    type: "gym.review.requested",
    project: "gym",
    kind: "regression-runtime",
    requestKey: `regression-runtime-${failureKey}`,
    failurePath,
  });
  return ctx.done(reason, {
    state: "converged",
    summary: reason,
    evidence: [failurePath],
    actions: [],
  });
}

export async function runRegression(
  ctx: WorkflowContext,
  processRunner: ProcessRunner = runProcess,
): Promise<WorkflowResult> {
  const details = triggerDetails(ctx.task);
  if (!details)
    return ctx.blocked("Regression trigger event is missing or invalid");

  let benchmark: string;
  let agent: string;
  let trialCount: number;
  let scenarios: string[];
  try {
    benchmark = validatedName(details.benchmark, "benchmark", "may-alignment");
    agent = validatedName(details.agent, "agent", "may");
    trialCount = trials(details.trials);
    scenarios = requestedScenarios(details);
  } catch (error) {
    return ctx.blocked(error instanceof Error ? error.message : String(error));
  }

  const gymRoot = join(ctx.projectsRoot, "gym");
  const command = [
    "bun",
    "run",
    "loop",
    "--",
    "test",
    "--benchmark",
    benchmark,
    "--agent",
    agent,
    "--trials",
    String(trialCount),
  ];
  for (const scenario of scenarios) command.push("--scenario", scenario);

  const result = await processRunner(command, {
    cwd: gymRoot,
    env: {
      ...process.env,
      GYM_AGENTS_ROOT: join(dirname(ctx.projectsRoot), "agents"),
    },
  });
  if (result.exitCode !== 0) {
    return regressionFailure(
      ctx,
      benchmark,
      `Gym regression process exited ${result.exitCode}`,
      {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-4_000),
      },
    );
  }

  const runDir = runDirectory(result.stdout);
  if (!runDir || !existsSync(join(runDir, "manifest.json"))) {
    return regressionFailure(
      ctx,
      benchmark,
      "Gym completed without a readable run directory",
      {
        stdout: result.stdout.slice(-2_000),
        stderr: result.stderr.slice(-2_000),
      },
    );
  }

  const outcome = summarizeRun(runDir);
  const runId = safeKey(outcome.run_id, "unknown-run");
  const stateDir = join(ctx.projectsRoot, "gym.app", ".state", "runs");
  const outcomePath = join(stateDir, `${runId}.json`);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(outcomePath, `${JSON.stringify(outcome, null, 2)}\n`);

  ctx.emit({
    type: "gym.regression.completed",
    project: "gym",
    ...outcome,
    outcomePath,
  });
  if (outcome.review_required) {
    ctx.emit({
      type: "gym.review.requested",
      project: "gym",
      kind: "regression",
      requestKey: `regression-${runId}`,
      runId: outcome.run_id,
      runDir,
      outcomePath,
    });
  }

  const summary = `Gym regression ${String(outcome.run_id)} completed: ${JSON.stringify(outcome.counts)}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [outcomePath],
    actions: [],
  });
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return runRegression(ctx);
}

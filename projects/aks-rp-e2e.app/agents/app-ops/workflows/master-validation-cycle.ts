import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ProjectAppConditionSpec,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "master-validation-cycle";
export const description =
  "Queue one six-hourly master-validation run from the exact current main commit, keep failed validation open, and converge only after a passing full-main proof.";

const organization = "https://dev.azure.com/msazure";
const adoProject = "CloudNativeCompute";
const pipelineId = "467665";
const sourceBranch = "main";
const sourceRef = "origin/main";
const featureSet = "master-validation";
const target = "staging";
const cycleIntervalMs = 21_600_000;
const azCli =
  process.env.AZURE_CLI_PATH ||
  (existsSync("/app/.state/.local/bin/az")
    ? "/app/.state/.local/bin/az"
    : "az");

type PipelineRun = {
  id?: unknown;
  status?: unknown;
  result?: unknown;
  sourceBranch?: unknown;
  sourceVersion?: unknown;
  templateParameters?: unknown;
};

type CycleReceipt = {
  runId: string;
  sourceCommit: string;
  queuedAt: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
}

function parseMetadata(run: PipelineRun): Record<string, unknown> {
  const raw = text(record(run.templateParameters).metadata);
  if (!raw) return {};
  try {
    return record(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function isMasterValidationCycle(run: PipelineRun): boolean {
  const parameters = record(run.templateParameters);
  const metadata = parseMetadata(run);
  return (
    text(parameters.feature_set) === featureSet &&
    text(parameters.target) === target &&
    ["main", "refs/heads/main"].includes(text(run.sourceBranch)) &&
    text(metadata.purpose) === "scheduled-master-validation"
  );
}

export function activeMasterValidationRun(
  runs: PipelineRun[],
): PipelineRun | null {
  return (
    runs
      .filter((run) => {
        const parameters = record(run.templateParameters);
        return (
          text(parameters.feature_set) === featureSet &&
          text(parameters.target) === target &&
          ["main", "refs/heads/main"].includes(text(run.sourceBranch))
        );
      })
      .filter((run) => !["completed", "canceled"].includes(text(run.status)))
      .sort((left, right) => Number(right.id ?? 0) - Number(left.id ?? 0))[0] ??
    null
  );
}

export function completedCycleState(result: string): "converged" | "waiting" {
  return ["succeeded", "success", "passed", "pass"].includes(
    result.trim().toLowerCase(),
  )
    ? "converged"
    : "waiting";
}

export function completedCycleDecision(input: {
  result: string;
  testedCommit: string;
  currentMainCommit: string;
}): "converged" | "waiting" | "stale" {
  if (input.testedCommit !== input.currentMainCommit) return "stale";
  return completedCycleState(input.result);
}

export function buildMasterValidationQueueArgs(input: {
  taskId: string;
  generation: number;
  sourceCommit: string;
  queuedAt: string;
}): string[] {
  const metadata = JSON.stringify({
    taskId: input.taskId,
    generation: String(input.generation),
    purpose: "scheduled-master-validation",
    sourceBranch,
    sourceCommit: input.sourceCommit,
    cycleKey: input.queuedAt,
  });
  return [
    "pipelines",
    "run",
    "--id",
    pipelineId,
    "--branch",
    sourceBranch,
    "--commit-id",
    input.sourceCommit,
    "--parameters",
    `feature_set=${featureSet}`,
    `target=${target}`,
    "slices=12",
    "slice_max_parallel=6",
    `metadata=${metadata}`,
  ];
}

function command(
  executable: string,
  args: string[],
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      AZURE_CONFIG_DIR: process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
    },
  });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
}

function azJson(args: string[], cwd: string): unknown {
  const result = command(
    azCli,
    [
      ...args,
      "--organization",
      organization,
      "--project",
      adoProject,
      "-o",
      "json",
    ],
    cwd,
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Azure CLI failed");
  }
  return JSON.parse(result.stdout || "null");
}

function taskPayload(raw: string): {
  taskId: string;
  generation: number;
} {
  const marker = raw.indexOf("## Reconciliation Task");
  const scoped = marker >= 0 ? raw.slice(marker) : raw;
  const start = scoped.indexOf("{");
  if (start < 0)
    return { taskId: "master-validation-staging-cycle", generation: 1 };
  let depth = 0;
  let inString = false;
  let escaping = false;
  let object = "";
  for (let index = start; index < scoped.length; index += 1) {
    const char = scoped[index];
    if (escaping) escaping = false;
    else if (char === "\\") escaping = true;
    else if (char === '"') inString = !inString;
    if (!inString && char === "{") depth += 1;
    if (!inString && char === "}" && --depth === 0) {
      object = scoped.slice(start, index + 1);
      break;
    }
  }
  if (!object)
    return { taskId: "master-validation-staging-cycle", generation: 1 };
  try {
    const parsed = record(JSON.parse(object));
    return {
      taskId: text(parsed.taskId) || "master-validation-staging-cycle",
      generation: Math.max(1, Number(parsed.generation ?? 1) || 1),
    };
  } catch {
    return { taskId: "master-validation-staging-cycle", generation: 1 };
  }
}

function receiptPath(ctx: WorkflowContext): string {
  return join(
    ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
    ".state",
    "master-validation-cycle.json",
  );
}

function readReceipt(path: string): CycleReceipt | null {
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as CycleReceipt;
    return value?.runId && value?.sourceCommit && value?.queuedAt
      ? value
      : null;
  } catch {
    return null;
  }
}

function saveReceipt(path: string, receipt: CycleReceipt): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

function waitCondition(runId: string): ProjectAppConditionSpec {
  return {
    id: `master-validation-run-${runId}-completed`,
    type: "pipeline-run.state",
    subject: `pipeline-run:${runId}`,
    expected: { field: "state", anyOf: ["completed"] },
  };
}

export function nextScheduledCycleCondition(): ProjectAppConditionSpec {
  return {
    id: "master-validation-next-scheduled-cycle",
    type: "project.task.tick",
    subject: "task:master-validation-staging-cycle",
    expected: {
      field: "reason",
      anyOf: [
        "scheduled-six-hour-master-validation",
        "master-validation-main-advanced",
      ],
    },
  };
}

function waiting(
  ctx: WorkflowContext,
  runId: string,
  sourceCommit: string,
  summary: string,
): WorkflowResult {
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: [
      `pipeline-run:${runId}`,
      `source-branch:${sourceBranch}`,
      `source-commit:${sourceCommit}`,
      `feature-set:${featureSet}`,
      `target:${target}`,
    ],
    actions: [],
    conditions: [waitCondition(runId)],
  });
}

function resolveCurrentMain(repoDir: string): string {
  const fetched = command("git", ["fetch", "origin", sourceBranch], repoDir);
  if (fetched.status !== 0) throw new Error(fetched.stderr || fetched.stdout);
  const resolved = command("git", ["rev-parse", sourceRef], repoDir);
  if (resolved.status !== 0 || !resolved.stdout) {
    throw new Error(resolved.stderr || `Could not resolve ${sourceRef}`);
  }
  return resolved.stdout;
}

function queueCycle(
  ctx: WorkflowContext,
  repoDir: string,
  payload: { taskId: string; generation: number },
  sourceCommit: string,
  staleRunId?: string,
): WorkflowResult {
  const queuedAt = new Date().toISOString();
  const queued = record(
    azJson(
      buildMasterValidationQueueArgs({
        taskId: payload.taskId,
        generation: payload.generation,
        sourceCommit,
        queuedAt,
      }),
      repoDir,
    ),
  );
  const runId = text(queued.id);
  if (!runId) throw new Error("Azure DevOps did not return a pipeline run id");
  saveReceipt(receiptPath(ctx), { runId, sourceCommit, queuedAt });
  const summary = staleRunId
    ? `Master-validation run ${staleRunId} completed against an older main commit; queued replacement run ${runId} from current ${sourceRef}@${sourceCommit}.`
    : `Queued master-validation run ${runId} from exact ${sourceRef}@${sourceCommit}; progressive slice observation continues while the aggregate run executes.`;
  return waiting(ctx, runId, sourceCommit, summary);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const repoDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const payload = taskPayload(ctx.task);
  try {
    const listActive = (status: "inProgress" | "notStarted") =>
      azJson(
        [
          "pipelines",
          "runs",
          "list",
          "--pipeline-ids",
          pipelineId,
          "--status",
          status,
          "--top",
          "100",
        ],
        repoDir,
      );
    const inProgress = listActive("inProgress");
    const notStarted = listActive("notStarted");
    const listed = [
      ...(Array.isArray(inProgress) ? (inProgress as PipelineRun[]) : []),
      ...(Array.isArray(notStarted) ? (notStarted as PipelineRun[]) : []),
    ];
    const active = activeMasterValidationRun(listed);
    if (active) {
      return waiting(
        ctx,
        text(active.id),
        text(active.sourceVersion),
        `Master validation run ${text(active.id)} is already active; no overlapping run was queued.`,
      );
    }

    const prior = readReceipt(receiptPath(ctx));
    if (
      prior &&
      Date.now() - Date.parse(prior.queuedAt) < cycleIntervalMs - 60_000
    ) {
      const exact = record(
        azJson(["pipelines", "runs", "show", "--id", prior.runId], repoDir),
      ) as PipelineRun;
      if (text(exact.status) !== "completed") {
        return waiting(
          ctx,
          prior.runId,
          prior.sourceCommit,
          `Master validation run ${prior.runId} is ${text(exact.status) || "still active"}; no overlapping run was queued.`,
        );
      }
      const result = text(exact.result) || "unknown";
      const currentMainCommit = resolveCurrentMain(repoDir);
      const decision = completedCycleDecision({
        result,
        testedCommit: prior.sourceCommit,
        currentMainCommit,
      });
      if (decision === "stale") {
        return queueCycle(
          ctx,
          repoDir,
          payload,
          currentMainCommit,
          prior.runId,
        );
      }
      const state = decision === "converged" ? "converged" : "waiting";
      const summary =
        state === "converged"
          ? `Master validation run ${prior.runId} passed on ${sourceBranch}@${prior.sourceCommit}; the full validation task is verified green.`
          : `Master validation run ${prior.runId} completed with result ${result}; validation remains open until a later full run from current ${sourceBranch} passes after the fixes are available. The next scheduled verification remains due six hours after ${prior.queuedAt}.`;
      return ctx.done(summary, {
        state,
        summary,
        evidence: [
          `pipeline-run:${prior.runId}`,
          `pipeline-result:${result}`,
          `source-commit:${prior.sourceCommit}`,
          `queued-at:${prior.queuedAt}`,
        ],
        actions: [],
        ...(state === "waiting"
          ? { conditions: [nextScheduledCycleCondition()] }
          : {}),
      });
    }

    return queueCycle(ctx, repoDir, payload, resolveCurrentMain(repoDir));
  } catch (error) {
    const summary = `Master validation cycle could not queue or observe its run: ${error instanceof Error ? error.message : String(error)}`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [
        `pipeline:${pipelineId}`,
        `source-ref:${sourceRef}`,
        `feature-set:${featureSet}`,
      ],
    });
  }
}

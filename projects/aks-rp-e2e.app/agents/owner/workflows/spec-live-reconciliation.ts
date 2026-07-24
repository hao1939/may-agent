import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Type,
  isTypedProjectAppConditionSubject,
  workflowResultVersion,
  type ProjectAppConditionSpec,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";

export const name = "spec-live-reconciliation";
export const description =
  "Reconcile one AKS spec through a task-owned source branch, exact live ADO verification, fix-forward retries, and integration into dev.";
export const workspace = "task";

const organization = "https://dev.azure.com/msazure";
const adoProject = "CloudNativeCompute";
const repository = "aks-e2e-spec-runner";
const pipelineId = "467665";
const defaultTargetBranch = "dev";
const defaultLiveTarget = "staging";
const azCli =
  process.env.AZURE_CLI_PATH ||
  (existsSync("/app/.state/.local/bin/az")
    ? "/app/.state/.local/bin/az"
    : "az");

export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "spec-live-reconciliation-v2",
  input: {
    required: ["input.specId"],
    optional: [
      "input.desiredChange",
      "input.workRevision",
      "input.target",
      "input.standaloneBuildId",
      "input.priorVerificationRunId",
    ],
    description:
      "Use only for a finite spec verification/change lifecycle that may require source mutation, exact live verification, and branch integration. target defaults to staging; standaloneBuildId selects an exact standalone RP build.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions", "conditions"],
    description:
      "Keeps the same task and branch across edit, live-run, fix-forward, direct-dev integration, and optional main PR waits.",
  },
};

type TaskPayload = {
  taskId?: unknown;
  generation?: unknown;
  input?: Record<string, unknown>;
};

type PipelineRun = {
  id?: unknown;
  status?: unknown;
  state?: unknown;
  result?: unknown;
  sourceBranch?: unknown;
  sourceVersion?: unknown;
  templateParameters?: unknown;
};

type PullRequest = {
  pullRequestId?: unknown;
  status?: unknown;
  mergeStatus?: unknown;
  sourceRefName?: unknown;
  targetRefName?: unknown;
  lastMergeSourceCommit?: { commitId?: unknown };
  lastMergeCommit?: { commitId?: unknown };
  url?: unknown;
};

type AgentDecision = {
  decision:
    | "committed"
    | "test-current"
    | "accepted-pass"
    | "retry-transient"
    | "waiting"
    | "needs-owner";
  summary: string;
  evidence: string[];
  condition?: ProjectAppConditionSpec;
};

type ReviewedRunProof = {
  version: 1;
  taskId: string;
  generation: number;
  specId: string;
  target: string;
  standaloneBuildId?: string;
  sourceBranch: string;
  sourceCommit: string;
  runId: string;
  runResult: string;
  verdict: "pass";
  summary: string;
  evidence: string[];
  reviewedAt: string;
  pullRequestId?: string;
  targetRef?: string;
  mergedCommit?: string;
};

type RunReceipt = {
  runId: string;
  sourceCommit: string;
  queuedAt: string;
};

export type SpecLiveReconciliationOptions = {
  targetBranch?: string;
};

export type LiveExecutionTarget = {
  target: string;
  standaloneBuildId: string;
};

export function resolveLiveExecutionTarget(
  input: Record<string, unknown> = {},
): LiveExecutionTarget {
  const target = nonEmptyString(input.target) || defaultLiveTarget;
  const standaloneBuildId = nonEmptyString(input.standaloneBuildId);
  if (!/^[A-Za-z0-9._-]+$/.test(target)) {
    throw new Error(`Invalid live target: ${target}`);
  }
  if (standaloneBuildId && !/^\d+$/.test(standaloneBuildId)) {
    throw new Error(`Invalid standalone build id: ${standaloneBuildId}`);
  }
  return { target, standaloneBuildId };
}

export function resolveIntegrationTarget(targetBranch = defaultTargetBranch): {
  targetBranch: string;
  targetRef: string;
} {
  const normalized = targetBranch.trim();
  if (!normalized || !/^[A-Za-z0-9._/-]+$/.test(normalized)) {
    throw new Error(`Invalid integration target branch: ${targetBranch}`);
  }
  return { targetBranch: normalized, targetRef: `origin/${normalized}` };
}

export function integrationMode(
  targetBranch: string,
): "direct" | "pull-request" {
  return targetBranch === defaultTargetBranch ? "direct" : "pull-request";
}

const decisionSchema = Type.Object({
  decision: Type.Union([
    Type.Literal("committed"),
    Type.Literal("test-current"),
    Type.Literal("accepted-pass"),
    Type.Literal("retry-transient"),
    Type.Literal("waiting"),
    Type.Literal("needs-owner"),
  ]),
  summary: Type.String({ minLength: 1 }),
  evidence: Type.Array(Type.String({ minLength: 1 })),
  condition: Type.Optional(
    Type.Object({
      id: Type.String({ minLength: 1 }),
      type: Type.String({ minLength: 1 }),
      subject: Type.String({
        minLength: 3,
        pattern: "^[A-Za-z][A-Za-z0-9_.-]*:.+$",
        description:
          "A typed machine subject such as project:aks-rp-e2e, pipeline-run:123, pull-request:456, or task:task-id; never prose.",
      }),
      expected: Type.Any(),
      owner: Type.Optional(Type.String({ minLength: 1 })),
    }),
  ),
});

const conditionInstruction =
  'A waiting Condition must use a typed subject such as project:aks-rp-e2e, pipeline-run:<id>, pull-request:<id>, or task:<id>. Its expected value supports exact field equality, or { field, equals|anyOf|notEquals }; do not invent comparison operators or put prose in subject. For a later current-main same-spec recovery, use type=pipeline.spec.observed, subject=project:aks-rp-e2e, expected={ specId: "<exact spec id>", status: "pass", sourceBranch: "refs/heads/main" }.';

export function agentConditionProblem(decision: AgentDecision): string | null {
  if (decision.decision !== "waiting") return null;
  const condition = decision.condition;
  if (!condition) return "decision=waiting requires one exact Condition";
  if (!isTypedProjectAppConditionSubject(condition.subject)) {
    return `Condition subject must be typed, not prose: ${condition.subject}`;
  }
  if (
    condition.expected &&
    typeof condition.expected === "object" &&
    !Array.isArray(condition.expected)
  ) {
    const expected = condition.expected as Record<string, unknown>;
    const unsupported = Object.keys(expected).filter((field) =>
      /(greater|less|before|after|regex|matches)/i.test(field),
    );
    if (unsupported.length) {
      return `Condition expected contains unsupported comparison fields: ${unsupported.join(", ")}`;
    }
    if (typeof expected.field === "string") {
      const operators = ["equals", "anyOf", "notEquals"].filter(
        (operator) => operator in expected,
      );
      if (operators.length !== 1) {
        return "A field-based Condition must use exactly one of equals, anyOf, or notEquals";
      }
    }
  }
  return null;
}

function nonEmptyString(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function pipelineRunState(run: PipelineRun): string {
  return nonEmptyString(run.status) || nonEmptyString(run.state) || "unknown";
}

function matchingJsonObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return text.slice(start, index + 1);
  }
  return null;
}

export function parseTaskPayload(raw: string): TaskPayload | null {
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const start = scoped.indexOf("{");
  if (start < 0) return null;
  const object = matchingJsonObject(scoped, start);
  if (!object) return null;
  try {
    const parsed = JSON.parse(object) as TaskPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function safePart(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 10);
  return `${normalized || "task"}-${digest}`;
}

function command(
  executable: string,
  args: string[],
  options: { cwd: string; allowFailure?: boolean; timeoutMs?: number },
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120_000,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      AZURE_CONFIG_DIR: process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
    },
  });
  const output = {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
  if (!options.allowFailure && output.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} failed: ${output.stderr || output.stdout}`,
    );
  }
  return output;
}

function git(
  cwd: string,
  args: string[],
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  return command("git", args, { cwd, allowFailure });
}

function azJson(cwd: string, args: string[]): unknown {
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
    { cwd, timeoutMs: 120_000 },
  );
  try {
    return JSON.parse(result.stdout || "null");
  } catch {
    throw new Error(`Azure CLI returned invalid JSON for ${args.join(" ")}`);
  }
}

function metadataOf(run: PipelineRun): Record<string, unknown> {
  const parameters =
    run.templateParameters &&
    typeof run.templateParameters === "object" &&
    !Array.isArray(run.templateParameters)
      ? (run.templateParameters as Record<string, unknown>)
      : {};
  const metadata = nonEmptyString(parameters.metadata);
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function matchingTaskRuns(
  runs: PipelineRun[],
  input: {
    taskId: string;
    generation: number;
    specId: string;
    sourceCommit: string;
    target?: string;
    standaloneBuildId?: string;
  },
): PipelineRun[] {
  const target = input.target || defaultLiveTarget;
  const standaloneBuildId = input.standaloneBuildId || "";
  return runs
    .filter((run) => {
      const parameters =
        run.templateParameters &&
        typeof run.templateParameters === "object" &&
        !Array.isArray(run.templateParameters)
          ? (run.templateParameters as Record<string, unknown>)
          : {};
      const metadata = metadataOf(run);
      return (
        nonEmptyString(run.sourceVersion) === input.sourceCommit &&
        nonEmptyString(parameters.specs) === input.specId &&
        nonEmptyString(parameters.target) === target &&
        nonEmptyString(parameters.standalone_build_id) === standaloneBuildId &&
        nonEmptyString(metadata.taskId) === input.taskId &&
        Number(metadata.generation) === input.generation
      );
    })
    .sort((left, right) => Number(right.id ?? 0) - Number(left.id ?? 0));
}

export function runMatchesPriorVerification(
  run: PipelineRun,
  input: {
    specId: string;
    target: string;
    standaloneBuildId: string;
    sourceCommit?: string;
  },
): boolean {
  const parameters =
    run.templateParameters &&
    typeof run.templateParameters === "object" &&
    !Array.isArray(run.templateParameters)
      ? (run.templateParameters as Record<string, unknown>)
      : {};
  return (
    nonEmptyString(parameters.specs) === input.specId &&
    nonEmptyString(parameters.target) === input.target &&
    nonEmptyString(parameters.standalone_build_id) ===
      input.standaloneBuildId &&
    (!input.sourceCommit ||
      nonEmptyString(run.sourceVersion) === input.sourceCommit)
  );
}

export function pipelineWaitCondition(runId: string): ProjectAppConditionSpec {
  return {
    id: `pipeline-run-${runId}-completed`,
    type: "pipeline-run.state",
    subject: `pipeline-run:${runId}`,
    expected: { field: "state", anyOf: ["completed"] },
  };
}

export function pullRequestWaitCondition(
  pullRequestId: string,
): ProjectAppConditionSpec {
  return {
    id: `pull-request-${pullRequestId}-changed`,
    type: "pull-request.state",
    subject: `pull-request:${pullRequestId}`,
    expected: {
      field: "state",
      anyOf: ["completed", "abandoned", "conflicted"],
    },
  };
}

export function pullRequestSourceUpdateCondition(
  pullRequestId: string,
  testedSourceCommit: string,
): ProjectAppConditionSpec {
  return {
    id: `pull-request-${pullRequestId}-source-not-${testedSourceCommit}`,
    type: "pull-request.state",
    subject: `pull-request:${pullRequestId}`,
    expected: { field: "sourceCommit", notEquals: testedSourceCommit },
  };
}

function currentRunPath(contextDir: string): string {
  return join(contextDir, "current-run.json");
}

function readRunReceipt(contextDir: string): RunReceipt | null {
  const path = currentRunPath(contextDir);
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as RunReceipt;
    return value && nonEmptyString(value.runId) ? value : null;
  } catch {
    return null;
  }
}

function saveRunReceipt(
  contextDir: string,
  run: PipelineRun,
  sourceCommit: string,
): void {
  const runId = nonEmptyString(run.id);
  if (!runId) return;
  writeFileSync(
    currentRunPath(contextDir),
    `${JSON.stringify(
      { runId, sourceCommit, queuedAt: new Date().toISOString() },
      null,
      2,
    )}\n`,
  );
}

function getPipelineRun(repoDir: string, runId: string): PipelineRun | null {
  const value = azJson(repoDir, ["pipelines", "runs", "show", "--id", runId]);
  return value && typeof value === "object" ? (value as PipelineRun) : null;
}

function taskRuns(repoDir: string, contextDir: string): PipelineRun[] {
  const value = azJson(repoDir, [
    "pipelines",
    "runs",
    "list",
    "--pipeline-ids",
    pipelineId,
    "--top",
    "100",
  ]);
  const runs = Array.isArray(value) ? (value as PipelineRun[]) : [];
  const receipt = readRunReceipt(contextDir);
  if (
    receipt &&
    !runs.some((run) => nonEmptyString(run.id) === receipt.runId)
  ) {
    const exact = getPipelineRun(repoDir, receipt.runId);
    if (exact) runs.push(exact);
  }
  return runs;
}

function queueRun(
  repoDir: string,
  input: {
    taskId: string;
    generation: number;
    specId: string;
    sourceBranch: string;
    sourceCommit: string;
    target: string;
    standaloneBuildId: string;
    retryOfRunId?: string;
  },
): PipelineRun {
  const metadata = JSON.stringify({
    taskId: input.taskId,
    generation: input.generation,
    specId: input.specId,
    sourceBranch: input.sourceBranch,
    sourceCommit: input.sourceCommit,
    target: input.target,
    ...(input.standaloneBuildId
      ? { standaloneBuildId: input.standaloneBuildId }
      : {}),
    ...(input.retryOfRunId ? { retryOfRunId: input.retryOfRunId } : {}),
  });
  const value = azJson(repoDir, [
    "pipelines",
    "run",
    "--id",
    pipelineId,
    "--branch",
    input.sourceBranch,
    "--commit-id",
    input.sourceCommit,
    "--parameters",
    `specs=${input.specId}`,
    `target=${input.target}`,
    ...(input.standaloneBuildId
      ? [`standalone_build_id=${input.standaloneBuildId}`]
      : []),
    "slices=1",
    "slice_max_parallel=1",
    `metadata=${metadata}`,
  ]);
  if (
    !value ||
    typeof value !== "object" ||
    !nonEmptyString((value as PipelineRun).id)
  ) {
    throw new Error("Azure DevOps did not return a pipeline run id");
  }
  return value as PipelineRun;
}

function pullRequests(
  repoDir: string,
  sourceBranch: string,
  targetBranch: string,
): PullRequest[] {
  const value = azJson(repoDir, [
    "repos",
    "pr",
    "list",
    "--repository",
    repository,
    "--source-branch",
    sourceBranch,
    "--target-branch",
    targetBranch,
    "--status",
    "all",
    "--top",
    "20",
  ]);
  return Array.isArray(value)
    ? (value as PullRequest[]).sort(
        (left, right) =>
          Number(right.pullRequestId ?? 0) - Number(left.pullRequestId ?? 0),
      )
    : [];
}

function createPullRequest(
  repoDir: string,
  input: {
    taskId: string;
    specId: string;
    sourceBranch: string;
    sourceCommit: string;
    runId: string;
    targetBranch: string;
  },
): PullRequest {
  const description = [
    `Task: ${input.taskId}`,
    `Spec: ${input.specId}`,
    `Live-tested source commit: ${input.sourceCommit}`,
    `Azure DevOps run: ${input.runId}`,
    `Target: ${input.targetBranch}`,
    `Merge convention: use a merge commit (no-fast-forward) so the exact live-tested source commit remains in ${input.targetBranch} ancestry.`,
  ].join("\n\n");
  const value = azJson(repoDir, [
    "repos",
    "pr",
    "create",
    "--repository",
    repository,
    "--source-branch",
    input.sourceBranch,
    "--target-branch",
    input.targetBranch,
    "--title",
    `test: reconcile ${input.specId}`,
    "--description",
    description,
  ]);
  if (
    !value ||
    typeof value !== "object" ||
    !nonEmptyString((value as PullRequest).pullRequestId)
  ) {
    throw new Error("Azure DevOps did not return a pull request id");
  }
  return value as PullRequest;
}

function abandonPullRequest(repoDir: string, pullRequestId: string): boolean {
  try {
    azJson(repoDir, [
      "repos",
      "pr",
      "update",
      "--id",
      pullRequestId,
      "--status",
      "abandoned",
    ]);
    return true;
  } catch {
    return false;
  }
}

function proofPath(contextDir: string): string {
  return join(contextDir, "proof.json");
}

function readProof(contextDir: string): ReviewedRunProof | null {
  const path = proofPath(contextDir);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as ReviewedRunProof;
    return parsed?.version === 1 && parsed.verdict === "pass" ? parsed : null;
  } catch {
    return null;
  }
}

function saveProof(contextDir: string, proof: ReviewedRunProof): void {
  mkdirSync(contextDir, { recursive: true });
  writeFileSync(proofPath(contextDir), `${JSON.stringify(proof, null, 2)}\n`);
}

function cleanWorkspace(workspaceDir: string): string {
  return git(workspaceDir, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]).stdout;
}

async function askAgent(
  ctx: WorkflowContext,
  prompt: string,
): Promise<AgentDecision | null> {
  let nextPrompt = `${prompt}\n\n${conditionInstruction}`;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await ctx.runAgent(ctx.agent, nextPrompt, {
      timeoutMs: 1_800_000,
      schema: decisionSchema,
    });
    if (result.status === "error" || result.status === "interrupted") {
      return null;
    }
    const decision = result.structuredResult as AgentDecision;
    const problem = agentConditionProblem(decision);
    if (!problem) return decision;
    nextPrompt = [
      "Correct the structured result from your immediately preceding domain judgment.",
      `Hard validation failure: ${problem}.`,
      conditionInstruction,
      "Do not repeat provider operations, queue work, or change source merely to correct the result. Preserve the prior domain judgment unless current evidence proves it wrong.",
      `Prior structured result:\n${JSON.stringify(decision, null, 2)}`,
    ].join("\n\n");
  }
  return {
    decision: "needs-owner",
    summary:
      "The agent exhausted structured-result correction without producing an observable waiting Condition.",
    evidence: ["condition-validation:failed-after-two-agent-judgments"],
  };
}

function waitingResult(
  ctx: WorkflowContext,
  summary: string,
  evidence: string[],
  condition: ProjectAppConditionSpec | ProjectAppConditionSpec[],
): WorkflowResult {
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence,
    actions: [],
    conditions: Array.isArray(condition) ? condition : [condition],
  });
}

function ownerResult(
  ctx: WorkflowContext,
  summary: string,
  evidence: string[],
): WorkflowResult {
  return ctx.done(summary, {
    state: "needs-owner",
    summary,
    evidence,
  });
}

export async function reconcileSpecLive(
  ctx: WorkflowContext,
  options: SpecLiveReconciliationOptions = {},
): Promise<WorkflowResult> {
  const { targetBranch, targetRef } = resolveIntegrationTarget(
    options.targetBranch,
  );
  const payload = parseTaskPayload(ctx.task);
  const taskId = nonEmptyString(payload?.taskId);
  const generation = Number(payload?.generation ?? 1);
  const specId = nonEmptyString(payload?.input?.specId);
  let liveExecution: LiveExecutionTarget;
  try {
    liveExecution = resolveLiveExecutionTarget(payload?.input);
  } catch (error) {
    return ownerResult(
      ctx,
      error instanceof Error ? error.message : String(error),
      [`task:${taskId || "missing"}`, `spec:${specId || "missing"}`],
    );
  }
  const { target: liveTarget, standaloneBuildId } = liveExecution;
  const priorVerificationRunId = nonEmptyString(
    payload?.input?.priorVerificationRunId,
  );
  const preparedSourceCommit = nonEmptyString(payload?.input?.carrierCommit);
  const repoDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const workspaceDir = ctx.workspaceDir ?? repoDir;

  if (
    !taskId ||
    !specId ||
    !Number.isInteger(generation) ||
    generation < 1 ||
    workspaceDir === repoDir
  ) {
    return ownerResult(
      ctx,
      `${name} requires a task id, generation, specId, and prepared task worktree.`,
      [`task:${taskId || "missing"}`, `spec:${specId || "missing"}`],
    );
  }

  const contextDir = join(
    repoDir,
    "workspace",
    "tasks",
    safePart(`${taskId}@${generation}`),
  );
  mkdirSync(contextDir, { recursive: true });

  try {
    git(repoDir, ["fetch", "origin", targetBranch]);
    let priorVerificationSummary = "";
    if (priorVerificationRunId) {
      const priorRun = getPipelineRun(repoDir, priorVerificationRunId);
      if (
        !priorRun ||
        !runMatchesPriorVerification(priorRun, {
          specId,
          target: liveTarget,
          standaloneBuildId,
          ...(preparedSourceCommit
            ? { sourceCommit: preparedSourceCommit }
            : {}),
        })
      ) {
        return ownerResult(
          ctx,
          `Prior verification run ${priorVerificationRunId} does not match the task's exact spec, source, target, and standalone build context.`,
          [
            `pipeline-run:${priorVerificationRunId}`,
            `spec:${specId}`,
            `live-target:${liveTarget}`,
            ...(preparedSourceCommit
              ? [`prepared-source-commit:${preparedSourceCommit}`]
              : []),
          ],
        );
      }
      const priorStatus = pipelineRunState(priorRun);
      const priorResult = nonEmptyString(priorRun.result) || priorStatus;
      if (priorStatus !== "completed") {
        return waitingResult(
          ctx,
          `Prior exact verification run ${priorVerificationRunId} is ${priorStatus}; wait before preparing or dispatching another run.`,
          [
            `pipeline-run:${priorVerificationRunId}`,
            `pipeline-status:${priorStatus}`,
            `spec:${specId}`,
            `live-target:${liveTarget}`,
            ...(standaloneBuildId
              ? [`standalone-build-id:${standaloneBuildId}`]
              : []),
          ],
          pipelineWaitCondition(priorVerificationRunId),
        );
      }
      priorVerificationSummary = `Prior exact verification run ${priorVerificationRunId} is terminal with provider result ${priorResult}. Treat its artifacts as repair context; current-task proof still requires the exact task source commit.`;
    }
    const sourceBranch = git(workspaceDir, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD",
    ]).stdout;
    if (!sourceBranch) {
      return ownerResult(
        ctx,
        "Task worktree is detached from its source branch.",
        [`workspace:${workspaceDir}`],
      );
    }
    if (cleanWorkspace(workspaceDir)) {
      const beforeRecovery = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      const recovery = await askAgent(
        ctx,
        [
          `Recover the interrupted task-owned worktree for ${specId}.`,
          `Work only in ${workspaceDir}; inspect its staged, unstaged, and untracked changes against the task and current source.`,
          "If the changes are a valid bounded continuation, finish scoped checks, commit them, leave the worktree clean, and return decision=committed.",
          "If they are invalid or obsolete task-generated residue, remove only that residue, leave the worktree clean at its prior commit, and return decision=test-current.",
          "Do not push, queue ADO, create a PR, edit app task state, or discard work whose ownership cannot be established. Use needs-owner for that concrete ambiguity.",
          "Task:",
          ctx.task,
        ].join("\n\n"),
      );
      if (!recovery) {
        return ownerResult(ctx, "Task worktree recovery session failed.", [
          `workspace:${workspaceDir}`,
          `source-branch:${sourceBranch}`,
        ]);
      }
      if (recovery.decision === "needs-owner") {
        return ownerResult(ctx, recovery.summary, recovery.evidence);
      }
      const afterRecovery = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      if (cleanWorkspace(workspaceDir)) {
        return ownerResult(
          ctx,
          "Task worktree recovery did not leave a clean, resumable source state.",
          [...recovery.evidence, `workspace:${workspaceDir}`],
        );
      }
      if (
        recovery.decision === "committed" &&
        afterRecovery === beforeRecovery
      ) {
        return ownerResult(
          ctx,
          "Task worktree recovery reported a commit but HEAD did not move.",
          recovery.evidence,
        );
      }
      if (!["committed", "test-current"].includes(recovery.decision)) {
        return ownerResult(
          ctx,
          `Unsupported task worktree recovery decision ${recovery.decision}.`,
          recovery.evidence,
        );
      }
    }

    let sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    const baseCommit = git(repoDir, ["rev-parse", targetRef]).stdout;

    const existingPr = pullRequests(repoDir, sourceBranch, targetBranch)[0];
    if (
      !existingPr &&
      sourceCommit !== baseCommit &&
      git(
        repoDir,
        ["merge-base", "--is-ancestor", sourceCommit, targetRef],
        true,
      ).status === 0
    ) {
      git(workspaceDir, ["merge", "--ff-only", targetRef]);
      sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    }
    if (existingPr && nonEmptyString(existingPr.status) === "active") {
      const remoteSourceCommit = nonEmptyString(
        existingPr.lastMergeSourceCommit?.commitId,
      );
      if (remoteSourceCommit && remoteSourceCommit !== sourceCommit) {
        git(repoDir, ["fetch", "origin", sourceBranch]);
        const remoteRef = `origin/${sourceBranch}`;
        if (
          git(
            workspaceDir,
            ["merge-base", "--is-ancestor", sourceCommit, remoteRef],
            true,
          ).status !== 0
        ) {
          return ownerResult(
            ctx,
            "The PR source branch changed non-fast-forward outside this task; owner review is required before replacing task history.",
            [
              `source-branch:${sourceBranch}`,
              `local-source-commit:${sourceCommit}`,
              `remote-source-commit:${remoteSourceCommit}`,
            ],
          );
        }
        git(workspaceDir, ["merge", "--ff-only", remoteRef]);
        sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      }
    }

    let runs = matchingTaskRuns(taskRuns(repoDir, contextDir), {
      taskId,
      generation,
      specId,
      sourceCommit,
      target: liveTarget,
      standaloneBuildId,
    });
    let latestRun = runs[0];

    if (!latestRun) {
      const branchHasChange = sourceCommit !== baseCommit;
      if (!branchHasChange) {
        const decision = await askAgent(
          ctx,
          [
            `Reconcile ${specId} for one exact live verification/change lifecycle.`,
            `The required live target is ${liveTarget}${standaloneBuildId ? ` with standalone_build_id=${standaloneBuildId}` : ""}.`,
            ...(priorVerificationSummary ? [priorVerificationSummary] : []),
            `Work only in ${workspaceDir}; durable non-source artifacts belong in ${contextDir}.`,
            `Current integration authority is ${targetRef}@${baseCommit}.`,
            "Inspect the current spec, model, direct carrier, nearby good/bad examples, and prior evidence.",
            "If a bounded repo change is needed, make it, run scoped local checks, commit it, leave the worktree clean, and return decision=committed.",
            "If current source is already the exact content that should be live-tested, leave it unchanged and return decision=test-current.",
            "Do not queue ADO, create a PR, create another branch/worktree, or edit app task state; this workflow owns those steps.",
            "Use waiting only with one exact machine-observable Condition. Use needs-owner only for a concrete decision that source facts cannot resolve.",
            "Task:",
            ctx.task,
          ].join("\n\n"),
        );
        if (!decision) {
          return ownerResult(ctx, "Spec preparation agent session failed.", [
            `task:${taskId}`,
            `spec:${specId}`,
          ]);
        }
        if (decision.decision === "waiting" && decision.condition) {
          return waitingResult(
            ctx,
            decision.summary,
            decision.evidence,
            decision.condition,
          );
        }
        if (decision.decision === "needs-owner") {
          return ownerResult(ctx, decision.summary, decision.evidence);
        }
        const after = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        if (cleanWorkspace(workspaceDir)) {
          return ownerResult(
            ctx,
            "Agent preparation left the task worktree dirty; deterministic dispatch was refused.",
            [...decision.evidence, `workspace:${workspaceDir}`],
          );
        }
        if (decision.decision === "committed" && after === sourceCommit) {
          return ownerResult(
            ctx,
            "Agent reported a committed change but task HEAD did not move.",
            decision.evidence,
          );
        }
        if (!["committed", "test-current"].includes(decision.decision)) {
          return ownerResult(
            ctx,
            `Unsupported preparation decision ${decision.decision}.`,
            decision.evidence,
          );
        }
        sourceCommit = after;
      }

      git(workspaceDir, ["push", "--set-upstream", "origin", sourceBranch]);
      latestRun = queueRun(repoDir, {
        taskId,
        generation,
        specId,
        sourceBranch,
        sourceCommit,
        target: liveTarget,
        standaloneBuildId,
      });
      saveRunReceipt(contextDir, latestRun, sourceCommit);
      const runId = nonEmptyString(latestRun.id);
      return waitingResult(
        ctx,
        `Queued exact live verification run ${runId} for ${specId} at ${sourceCommit}.`,
        [
          `task:${taskId}@${generation}`,
          `spec:${specId}`,
          `source-branch:${sourceBranch}`,
          `source-commit:${sourceCommit}`,
          `live-target:${liveTarget}`,
          ...(standaloneBuildId
            ? [`standalone-build-id:${standaloneBuildId}`]
            : []),
          `pipeline-run:${runId}`,
        ],
        pipelineWaitCondition(runId),
      );
    }

    const runId = nonEmptyString(latestRun.id);
    const runStatus = pipelineRunState(latestRun);
    const runResult = nonEmptyString(latestRun.result) || runStatus;
    if (runStatus !== "completed") {
      return waitingResult(
        ctx,
        `Live verification run ${runId} for ${specId} at ${sourceCommit} is ${runStatus}.`,
        [
          `task:${taskId}@${generation}`,
          `spec:${specId}`,
          `source-commit:${sourceCommit}`,
          `live-target:${liveTarget}`,
          ...(standaloneBuildId
            ? [`standalone-build-id:${standaloneBuildId}`]
            : []),
          `pipeline-run:${runId}`,
          `pipeline-status:${runStatus}`,
        ],
        pipelineWaitCondition(runId),
      );
    }

    let proof = readProof(contextDir);
    if (
      !proof ||
      proof.runId !== runId ||
      proof.sourceCommit !== sourceCommit ||
      proof.specId !== specId ||
      proof.target !== liveTarget ||
      (proof.standaloneBuildId || "") !== standaloneBuildId
    ) {
      const failedRunsForCommit = runs.filter(
        (run) =>
          pipelineRunState(run) === "completed" &&
          !["succeeded", "partiallySucceeded"].includes(
            nonEmptyString(run.result),
          ),
      ).length;
      const decision = await askAgent(
        ctx,
        [
          `Review terminal Azure DevOps run ${runId} for ${specId}.`,
          `The exact source is ${sourceBranch}@${sourceCommit}; provider result is ${runResult}.`,
          `The exact live target is ${liveTarget}${standaloneBuildId ? ` with standalone_build_id=${standaloneBuildId}` : ""}.`,
          `Use ${contextDir} for downloaded artifacts and diagnosis. Do not write runtime artifacts into tracked source paths.`,
          "Inspect run metadata, plan inputs, per-spec result, live resource identity, assertions, and cleanup proof. The aggregate provider result alone is not a spec verdict.",
          "Return accepted-pass only for exact same-spec live proof on this source commit.",
          "For a carrier/spec defect, make the smallest fix in the task worktree, run scoped local checks, commit, leave the worktree clean, and return committed.",
          failedRunsForCommit >= 2
            ? "The same source commit already has at least two terminal nonpassing runs. Do not request another unchanged retry; commit a fix, return an exact wait, or request owner judgment."
            : "Use retry-transient only when artifacts prove a transient provider/environment failure and an unchanged retry is truthful.",
          "Do not create a successor task, queue ADO, create/complete a PR, or edit app task state.",
          "Task:",
          ctx.task,
        ].join("\n\n"),
      );
      if (!decision) {
        return ownerResult(
          ctx,
          `Terminal run ${runId} review session failed.`,
          [`pipeline-run:${runId}`, `source-commit:${sourceCommit}`],
        );
      }
      if (decision.decision === "waiting" && decision.condition) {
        return waitingResult(
          ctx,
          decision.summary,
          decision.evidence,
          decision.condition,
        );
      }
      if (decision.decision === "needs-owner") {
        return ownerResult(ctx, decision.summary, decision.evidence);
      }
      if (decision.decision === "retry-transient") {
        if (failedRunsForCommit >= 2) {
          return ownerResult(
            ctx,
            "An unchanged live retry was refused after repeated nonpassing runs on the same source commit.",
            [...decision.evidence, `source-commit:${sourceCommit}`],
          );
        }
        const retry = queueRun(repoDir, {
          taskId,
          generation,
          specId,
          sourceBranch,
          sourceCommit,
          target: liveTarget,
          standaloneBuildId,
          retryOfRunId: runId,
        });
        saveRunReceipt(contextDir, retry, sourceCommit);
        const retryId = nonEmptyString(retry.id);
        return waitingResult(
          ctx,
          `Queued one diagnosed transient retry ${retryId} for ${specId} at unchanged commit ${sourceCommit}.`,
          [
            ...decision.evidence,
            `retry-of-run:${runId}`,
            `pipeline-run:${retryId}`,
            `source-commit:${sourceCommit}`,
          ],
          pipelineWaitCondition(retryId),
        );
      }
      if (decision.decision === "committed") {
        const nextCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        if (nextCommit === sourceCommit || cleanWorkspace(workspaceDir)) {
          return ownerResult(
            ctx,
            "Agent reported a fix but did not leave one new clean task commit.",
            decision.evidence,
          );
        }
        git(workspaceDir, ["push", "origin", sourceBranch]);
        const nextRun = queueRun(repoDir, {
          taskId,
          generation,
          specId,
          sourceBranch,
          sourceCommit: nextCommit,
          target: liveTarget,
          standaloneBuildId,
        });
        saveRunReceipt(contextDir, nextRun, nextCommit);
        const nextRunId = nonEmptyString(nextRun.id);
        return waitingResult(
          ctx,
          `Committed a fix for run ${runId} and queued exact replacement run ${nextRunId} at ${nextCommit}.`,
          [
            ...decision.evidence,
            `replaces-run:${runId}`,
            `source-commit:${nextCommit}`,
            `pipeline-run:${nextRunId}`,
          ],
          pipelineWaitCondition(nextRunId),
        );
      }
      if (decision.decision !== "accepted-pass") {
        return ownerResult(
          ctx,
          `Terminal run review returned unsupported decision ${decision.decision}.`,
          decision.evidence,
        );
      }
      proof = {
        version: 1,
        taskId,
        generation,
        specId,
        target: liveTarget,
        ...(standaloneBuildId ? { standaloneBuildId } : {}),
        sourceBranch,
        sourceCommit,
        runId,
        runResult,
        verdict: "pass",
        summary: decision.summary,
        evidence: decision.evidence,
        reviewedAt: new Date().toISOString(),
      };
      saveProof(contextDir, proof);
    }

    if (integrationMode(targetBranch) === "direct") {
      let integratedCommit = "";
      let lastPushError = "";

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        git(repoDir, ["fetch", "origin", targetBranch]);
        if (
          git(
            repoDir,
            ["merge-base", "--is-ancestor", sourceCommit, targetRef],
            true,
          ).status === 0
        ) {
          integratedCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
          break;
        }

        if (
          git(
            workspaceDir,
            ["merge-base", "--is-ancestor", targetRef, "HEAD"],
            true,
          ).status !== 0
        ) {
          const beforeMerge = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
          const merge = git(
            workspaceDir,
            ["merge", "--no-ff", "--no-edit", targetRef],
            true,
          );
          if (merge.status !== 0) {
            const decision = await askAgent(
              ctx,
              [
                `${specId} passed exact live run ${runId} at ${sourceCommit}, but direct integration now conflicts with current ${targetRef}.`,
                `Resolve only the current merge in ${workspaceDir}, preserve the accepted task intent, run scoped checks, commit the resolved source, leave the worktree clean, and return decision=committed.`,
                "Do not push, queue ADO, create a PR, create another task, or edit app state. The workflow will push the resolved branch and require a fresh exact live run before integration.",
                "Task:",
                ctx.task,
              ].join("\n\n"),
            );
            if (!decision || decision.decision !== "committed") {
              return ownerResult(
                ctx,
                decision?.summary ||
                  `Direct ${targetBranch} integration conflict repair failed for ${specId}.`,
                decision?.evidence || [
                  `source-commit:${sourceCommit}`,
                  `target-ref:${targetRef}`,
                  `merge-error:${merge.stderr || merge.stdout}`,
                ],
              );
            }
            const resolvedCommit = git(workspaceDir, [
              "rev-parse",
              "HEAD",
            ]).stdout;
            if (
              resolvedCommit === beforeMerge ||
              cleanWorkspace(workspaceDir)
            ) {
              return ownerResult(
                ctx,
                `Direct ${targetBranch} conflict repair did not leave one new clean commit.`,
                decision.evidence,
              );
            }
            git(workspaceDir, ["push", "origin", sourceBranch]);
            const replacement = queueRun(repoDir, {
              taskId,
              generation,
              specId,
              sourceBranch,
              sourceCommit: resolvedCommit,
              target: liveTarget,
              standaloneBuildId,
            });
            saveRunReceipt(contextDir, replacement, resolvedCommit);
            const replacementId = nonEmptyString(replacement.id);
            return waitingResult(
              ctx,
              `Resolved direct ${targetBranch} integration conflict and queued replacement live run ${replacementId} at ${resolvedCommit}.`,
              [
                ...decision.evidence,
                `replaces-run:${runId}`,
                `source-commit:${resolvedCommit}`,
                `pipeline-run:${replacementId}`,
                `target-ref:${targetRef}`,
              ],
              pipelineWaitCondition(replacementId),
            );
          }
          git(workspaceDir, ["push", "origin", sourceBranch]);
        }

        const push = git(
          workspaceDir,
          ["push", "origin", `HEAD:${targetBranch}`],
          true,
        );
        if (push.status !== 0) {
          lastPushError = push.stderr || push.stdout;
          continue;
        }
        git(repoDir, ["fetch", "origin", targetBranch]);
        if (
          git(
            repoDir,
            ["merge-base", "--is-ancestor", sourceCommit, targetRef],
            true,
          ).status === 0
        ) {
          integratedCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
          break;
        }
      }

      if (!integratedCommit) {
        return ownerResult(
          ctx,
          `Could not integrate ${specId} into current ${targetBranch} after three refreshed fast-forward attempts.`,
          [
            `source-commit:${sourceCommit}`,
            `target-ref:${targetRef}`,
            ...(lastPushError ? [`push-error:${lastPushError}`] : []),
          ],
        );
      }

      const existingPrId = nonEmptyString(existingPr?.pullRequestId);
      const abandonedExistingPr =
        existingPrId && nonEmptyString(existingPr?.status) === "active"
          ? abandonPullRequest(repoDir, existingPrId)
          : false;
      proof = {
        ...proof,
        targetRef,
        mergedCommit: integratedCommit,
      };
      saveProof(contextDir, proof);
      const summary = `${specId} passed run ${runId} at ${sourceCommit} and directly integrated that tested commit into ${targetBranch}@${integratedCommit}.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          ...proof.evidence,
          `proof:${proofPath(contextDir)}`,
          `pipeline-run:${runId}`,
          `source-commit:${sourceCommit}`,
          `integrated-commit:${integratedCommit}`,
          `target-ref:${targetRef}`,
          ...(existingPrId
            ? [
                `obsolete-pull-request:${existingPrId}`,
                `obsolete-pull-request-abandoned:${String(abandonedExistingPr)}`,
              ]
            : []),
        ],
        actions: [],
      });
    }

    const branchHasChange = existingPr
      ? true
      : git(
          repoDir,
          ["merge-base", "--is-ancestor", sourceCommit, targetRef],
          true,
        ).status !== 0;
    if (!branchHasChange) {
      const summary = `${specId} passed exact live verification on current ${targetRef}@${sourceCommit}; no source publication is required.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          ...proof.evidence,
          `proof:${proofPath(contextDir)}`,
          `pipeline-run:${runId}`,
          `source-commit:${sourceCommit}`,
          `target-ref:${targetRef}`,
        ],
        actions: [],
      });
    }

    let pr = pullRequests(repoDir, sourceBranch, targetBranch)[0];
    if (!pr) {
      pr = createPullRequest(repoDir, {
        taskId,
        specId,
        sourceBranch,
        sourceCommit,
        runId,
        targetBranch,
      });
    }
    const prId = nonEmptyString(pr.pullRequestId);
    const prStatus = nonEmptyString(pr.status) || "unknown";
    const mergeStatus = nonEmptyString(pr.mergeStatus) || "unknown";
    const prSourceCommit = nonEmptyString(pr.lastMergeSourceCommit?.commitId);

    if (prStatus === "abandoned") {
      return ownerResult(
        ctx,
        `PR ${prId} for ${specId} was abandoned; do not silently recreate a rejected review.`,
        [
          ...proof.evidence,
          `pull-request:${prId}`,
          `source-commit:${sourceCommit}`,
          "pull-request-status:abandoned",
        ],
      );
    }
    if (prStatus === "completed") {
      if (mergeStatus !== "succeeded") {
        return ownerResult(
          ctx,
          `PR ${prId} is completed but mergeStatus=${mergeStatus}; integration cannot be proven.`,
          [`pull-request:${prId}`, `merge-status:${mergeStatus}`],
        );
      }
      if (prSourceCommit && prSourceCommit !== sourceCommit) {
        return ownerResult(
          ctx,
          `PR ${prId} merged source ${prSourceCommit}, but the accepted live proof is for ${sourceCommit}.`,
          [
            `pull-request:${prId}`,
            `tested-source-commit:${sourceCommit}`,
            `merged-source-commit:${prSourceCommit}`,
          ],
        );
      }
      git(repoDir, ["fetch", "origin", targetBranch]);
      if (
        git(
          repoDir,
          ["merge-base", "--is-ancestor", sourceCommit, targetRef],
          true,
        ).status !== 0
      ) {
        return ownerResult(
          ctx,
          `PR ${prId} merged without preserving tested commit ${sourceCommit} in ${targetRef} ancestry. Queue a replacement exact-merged-revision live proof before closeout.`,
          [
            `pull-request:${prId}`,
            `source-commit:${sourceCommit}`,
            `target-ref:${targetRef}`,
            "merge-convention:no-fast-forward-required",
          ],
        );
      }
      const mergedCommit = nonEmptyString(pr.lastMergeCommit?.commitId);
      proof = {
        ...proof,
        pullRequestId: prId,
        targetRef,
        ...(mergedCommit ? { mergedCommit } : {}),
      };
      saveProof(contextDir, proof);
      const summary = `${specId} passed run ${runId} at ${sourceCommit} and PR ${prId} merged that exact tested commit into ${targetBranch}.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          ...proof.evidence,
          `proof:${proofPath(contextDir)}`,
          `pipeline-run:${runId}`,
          `pull-request:${prId}`,
          `source-commit:${sourceCommit}`,
          ...(mergedCommit ? [`merged-commit:${mergedCommit}`] : []),
          `target-ref:${targetRef}`,
        ],
        actions: [],
      });
    }
    if (mergeStatus === "conflicts") {
      const decision = await askAgent(
        ctx,
        [
          `PR ${prId} for ${specId} conflicts with current ${targetRef}.`,
          `Resolve only this task branch in ${workspaceDir}, run scoped checks, commit the resolved source, and return decision=committed.`,
          "Do not complete or recreate the PR and do not queue ADO; the workflow will push and live-test the new source commit.",
          "Task:",
          ctx.task,
        ].join("\n\n"),
      );
      if (!decision || decision.decision !== "committed") {
        return ownerResult(
          ctx,
          decision?.summary || `PR ${prId} conflict repair session failed.`,
          decision?.evidence || [`pull-request:${prId}`],
        );
      }
      const resolvedCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      if (resolvedCommit === sourceCommit || cleanWorkspace(workspaceDir)) {
        return ownerResult(
          ctx,
          `PR ${prId} conflict repair did not leave one new clean commit.`,
          decision.evidence,
        );
      }
      git(workspaceDir, ["push", "origin", sourceBranch]);
      const replacement = queueRun(repoDir, {
        taskId,
        generation,
        specId,
        sourceBranch,
        sourceCommit: resolvedCommit,
        target: liveTarget,
        standaloneBuildId,
      });
      saveRunReceipt(contextDir, replacement, resolvedCommit);
      const replacementId = nonEmptyString(replacement.id);
      return waitingResult(
        ctx,
        `Resolved PR ${prId} conflict and queued replacement live run ${replacementId} at ${resolvedCommit}.`,
        [
          ...decision.evidence,
          `pull-request:${prId}`,
          `source-commit:${resolvedCommit}`,
          `pipeline-run:${replacementId}`,
        ],
        pipelineWaitCondition(replacementId),
      );
    }

    return waitingResult(
      ctx,
      `PR ${prId} is ${prStatus}/${mergeStatus}; keep the same spec task waiting for merge or a source/review change.`,
      [
        ...proof.evidence,
        `proof:${proofPath(contextDir)}`,
        `pipeline-run:${runId}`,
        `pull-request:${prId}`,
        `source-commit:${sourceCommit}`,
        `pull-request-status:${prStatus}`,
        `merge-status:${mergeStatus}`,
      ],
      [
        pullRequestWaitCondition(prId),
        pullRequestSourceUpdateCondition(prId, sourceCommit),
      ],
    );
  } catch (error) {
    const summary = `${name} failed deterministic reconciliation: ${error instanceof Error ? error.message : String(error)}`;
    return ownerResult(ctx, summary, [
      `task:${taskId}@${generation}`,
      `spec:${specId}`,
      `workspace:${workspaceDir}`,
    ]);
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return reconcileSpecLive(ctx);
}

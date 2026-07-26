import { createHash } from "node:crypto";
import { execFile, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import {
  Type,
  isTypedProjectAppConditionSubject,
  workflowResultVersion,
  type ProjectAppConditionSpec,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  scenarioNormalizationInvariant,
  scenarioNormalizationSpecIds,
  type ScenarioNormalizationInput,
} from "./lib/scenario-normalization-invariant.js";

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

export function completedPullRequestIntegration(input: {
  mergeStatus: string;
  testedSourceCommit: string;
  mergedSourceCommit: string;
  mergeCommit: string;
}):
  | { status: "integrated"; targetCommit: string }
  | {
      status: "unproven";
      reason:
        "merge-not-succeeded" | "source-mismatch" | "merge-commit-missing";
    } {
  if (input.mergeStatus !== "succeeded") {
    return { status: "unproven", reason: "merge-not-succeeded" };
  }
  if (input.mergedSourceCommit !== input.testedSourceCommit) {
    return { status: "unproven", reason: "source-mismatch" };
  }
  if (!input.mergeCommit) {
    return { status: "unproven", reason: "merge-commit-missing" };
  }
  return { status: "integrated", targetCommit: input.mergeCommit };
}

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
  liveReady?: boolean;
  condition?: ProjectAppConditionSpec;
  recovery?: {
    pipelineRunId: string;
    sourceBranch: string;
    sourceCommit: string;
    artifactPath: string;
  };
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

type ScenarioReplayState = {
  version: 1;
  recordedTaskBase: string;
  replayBase: string;
  sourceCommit: string;
};

type CollectedRunEvidence = {
  runPath: string;
  artifactListPath: string;
  artifactPaths: string[];
  errors: string[];
};

export type LiveDispatchAdmission = {
  accepted: boolean;
  evidence: string[];
};

export type SpecLiveReconciliationOptions = {
  targetBranch?: string;
  existingRecoveryAfterRunId?: string;
  reusePriorIntegratedProof?: boolean;
  reviewedScenarioPatch?: boolean;
};

export type LiveExecutionTarget = {
  target: string;
  standaloneBuildId: string;
};

export function exactLiveTargetInstruction(
  target: string,
  standaloneBuildId: string,
): string {
  return `The resolved live target (${target}${standaloneBuildId ? `, standalone_build_id=${standaloneBuildId}` : ""}) is task intent, not an agent repair choice. Preserve it across repair, retry, wait, escalation, and successor work; never guess or fall back to another subscription, region, target, or build.`;
}

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

export function shouldFastForwardIntegratedSource(input: {
  existingPullRequest: boolean;
  sourceCommit: string;
  baseCommit: string;
  sourceIsAncestorOfTarget: boolean;
  matchingRunCount: number;
}): boolean {
  return (
    !input.existingPullRequest &&
    input.sourceCommit !== input.baseCommit &&
    input.sourceIsAncestorOfTarget &&
    input.matchingRunCount === 0
  );
}

export function shouldReviewBeforeInitialLiveDispatch(input: {
  hasExactRun: boolean;
  branchHasChange: boolean;
  reviewedScenarioPatch?: boolean;
}): boolean {
  void input.branchHasChange;
  return !input.hasExactRun && !input.reviewedScenarioPatch;
}

export function preparationDecisionProblem(
  decision: AgentDecision,
  allowExistingRecovery: boolean,
): string | null {
  if (["committed", "test-current"].includes(decision.decision)) {
    if (typeof decision.liveReady !== "boolean") {
      return `decision=${decision.decision} must explicitly set liveReady=true or liveReady=false; source state alone does not authorize ADO dispatch`;
    }
    return null;
  }
  if (["waiting", "needs-owner"].includes(decision.decision)) {
    return null;
  }
  if (decision.decision === "accepted-pass" && allowExistingRecovery) {
    return null;
  }
  return allowExistingRecovery
    ? "preparation must return committed, test-current, accepted-pass with exact recovery proof, waiting, or needs-owner"
    : "preparation cannot accept a prior run as proof for the rewritten source; return test-current to dispatch it, commit a repair, wait on an exact fact, or identify a genuine ownership boundary";
}

export function preparationHeadProblem(input: {
  decision: AgentDecision;
  before: string;
  after: string;
}): string | null {
  return input.decision.decision === "committed" && input.after === input.before
    ? `decision=committed is invalid because task HEAD remained ${input.after}`
    : null;
}

export function scenarioNormalizationReplayRequired(input: {
  sourceIsInTarget: boolean;
  targetIsInSource: boolean;
  firstParentMergeCount: number;
}): boolean {
  return (
    !input.sourceIsInTarget &&
    (!input.targetIsInSource || input.firstParentMergeCount > 0)
  );
}

export function liveDispatchTargetRefreshRequired(input: {
  directScenarioNormalization: boolean;
  targetIsInSource: boolean;
}): boolean {
  return input.directScenarioNormalization && !input.targetIsInSource;
}

export function scenarioNormalizationReplayBase(input: {
  recordedTaskBase: string;
  priorReplayBase?: string;
  inferredMergeBase?: string;
  recordedFirstParentMergeCount: number;
}): string {
  if (input.priorReplayBase) return input.priorReplayBase;
  if (input.recordedFirstParentMergeCount === 0 && input.inferredMergeBase) {
    return input.inferredMergeBase;
  }
  return input.recordedTaskBase;
}

export function novelScenarioReplayCommits(cherryOutput: string): string[] {
  return cherryOutput
    .split(/\r?\n/)
    .map((line) => /^\+\s+([0-9a-f]{40})(?:\s|$)/i.exec(line.trim())?.[1] ?? "")
    .filter(Boolean);
}

export function remoteLeaseCommit(input: {
  status: number;
  stdout: string;
}): string | null {
  if (input.status !== 0) return null;
  return /^([0-9a-f]{40})(?:\s|$)/i.exec(input.stdout.trim())?.[1] ?? null;
}

export function scenarioReplayForceWithLeaseArg(input: {
  sourceBranch: string;
  expectedRemoteCommit: string | null;
}): string {
  return `--force-with-lease=refs/heads/${input.sourceBranch}:${input.expectedRemoteCommit ?? ""}`;
}

export function directIntegrationAction(input: {
  sourceIsInTarget: boolean;
  targetIsInSource: boolean;
}): "converged" | "publish-tested-source" | "reverify-updated-source" {
  if (input.sourceIsInTarget) return "converged";
  return input.targetIsInSource
    ? "publish-tested-source"
    : "reverify-updated-source";
}

function proofPreservingTargetPath(path: string): boolean {
  return (
    path.startsWith("features/") ||
    path.startsWith("model/specs/") ||
    path.startsWith("model/features/") ||
    path.startsWith("evidence/") ||
    path.startsWith("design/") ||
    path.endsWith(".md") ||
    path.startsWith("skills/") ||
    /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)
  );
}

function mergeSafeScenarioAggregatePath(path: string): boolean {
  return /^features\/[^/]+\/compact\/staging\.plan\.json$/.test(path);
}

export function proofProtectedScenarioPaths(paths: string[]): string[] {
  return paths.filter((path) => path && !mergeSafeScenarioAggregatePath(path));
}

export function proofPreservingScenarioIntegration(input: {
  sourcePaths: string[];
  targetPaths: string[];
}): boolean {
  const sourcePaths = new Set(proofProtectedScenarioPaths(input.sourcePaths));
  if (
    input.sourcePaths.filter(Boolean).length === 0 ||
    input.targetPaths.length === 0
  ) {
    return false;
  }
  return input.targetPaths.every(
    (path) =>
      proofPreservingTargetPath(path) &&
      (!sourcePaths.has(path) || mergeSafeScenarioAggregatePath(path)),
  );
}

export function shouldReplayScenarioBeforeRunReview(input: {
  directScenarioNormalization: boolean;
  terminalExactRun: boolean;
}): boolean {
  return input.directScenarioNormalization && !input.terminalExactRun;
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
  liveReady: Type.Optional(Type.Boolean()),
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
  recovery: Type.Optional(
    Type.Object({
      pipelineRunId: Type.String({ minLength: 1 }),
      sourceBranch: Type.String({ minLength: 1 }),
      sourceCommit: Type.String({ minLength: 1 }),
      artifactPath: Type.String({ minLength: 1 }),
    }),
  ),
});

export function sourceChangeMayAffectSpec(
  specId: string,
  changedFiles: string[],
): boolean {
  const feature = specId.replace(/^spec\./, "").split(".")[0];
  const sharedPrefixes = [
    ".ado/",
    ".azure-pipelines/",
    "ci/",
    "infra/",
    "pipelines/",
    "runner/",
    "scripts/",
  ];
  const sharedFiles = new Set([
    "azurepipelines-coverage.yml",
    "bun.lock",
    "package.json",
    "spec-runner.yaml",
    "tsconfig.json",
    "tsconfig.runner.json",
    "vitest.config.ts",
  ]);
  return changedFiles.some((path) => {
    const normalized = path.replace(/^\.\//, "");
    return (
      (feature && normalized.startsWith(`features/${feature}/`)) ||
      sharedPrefixes.some((prefix) => normalized.startsWith(prefix)) ||
      sharedFiles.has(normalized)
    );
  });
}

function laterRun(candidate: string, baseline: string): boolean {
  const candidateNumber = Number(candidate);
  const baselineNumber = Number(baseline);
  return Number.isFinite(candidateNumber) && Number.isFinite(baselineNumber)
    ? candidateNumber > baselineNumber
    : Boolean(candidate && baseline && candidate !== baseline);
}

function artifactProvesSpecPass(path: string, specId: string): boolean {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as {
      specResults?: Array<Record<string, unknown>>;
    };
    return Boolean(
      value.specResults?.some(
        (result) =>
          nonEmptyString(result.specId ?? result.spec_id) === specId &&
          ["pass", "passed"].includes(
            nonEmptyString(result.status).toLowerCase(),
          ),
      ),
    );
  } catch {
    return false;
  }
}

export function existingRecoveryProblem(input: {
  baselineRunId: string;
  specId: string;
  currentMainCommit: string;
  recovery?: AgentDecision["recovery"];
  providerRun: PipelineRun | null;
  sourceIsAncestor: boolean;
  changedFiles: string[] | null;
  artifactInWatcherRoot: boolean;
  artifactProvesPass: boolean;
}): string | null {
  const recovery = input.recovery;
  if (!recovery) return "missing structured recovery proof";
  if (!laterRun(recovery.pipelineRunId, input.baselineRunId)) {
    return "recovery run is not later than the blocking run";
  }
  if (recovery.sourceBranch !== "refs/heads/main") {
    return "recovery run is not from main";
  }
  if (
    !input.providerRun ||
    nonEmptyString(input.providerRun.id) !== recovery.pipelineRunId ||
    nonEmptyString(input.providerRun.sourceBranch) !== recovery.sourceBranch ||
    nonEmptyString(input.providerRun.sourceVersion) !== recovery.sourceCommit ||
    pipelineRunState(input.providerRun) !== "completed"
  ) {
    return "provider run does not match the recovery claim";
  }
  if (!input.sourceIsAncestor) {
    return "recovery source is not in current main ancestry";
  }
  if (
    recovery.sourceCommit !== input.currentMainCommit &&
    (input.changedFiles === null ||
      sourceChangeMayAffectSpec(input.specId, input.changedFiles))
  ) {
    return "relevant main changes invalidate the recovery observation";
  }
  if (!input.artifactInWatcherRoot || !input.artifactProvesPass) {
    return "recovery artifact does not prove this exact spec passed";
  }
  return null;
}

const conditionInstruction =
  "A waiting Condition must use a typed subject such as project:aks-rp-e2e, pipeline-run:<id>, pull-request:<id>, or task:<id> and one event type this app actually observes: pipeline-run.state, pipeline.spec.observed, pull-request.state, project.approval.submitted, project.task.tick, task-field, task-phase, or aks.repo-ref.observed. Its expected value supports exact field equality, or { field, equals|anyOf|notEquals }; do not invent event types, comparison operators, or put prose in subject. The observed fact must be able to advance this exact task and source lineage; reuse an existing approval/task wait when it already owns the external decision, and do not wait for a hypothetical pass on unrelated source.";

const observableConditionTypes = new Set([
  "pipeline-run.state",
  "pipeline.spec.observed",
  "pull-request.state",
  "project.approval.submitted",
  "project.task.tick",
  "task-field",
  "task-phase",
  "aks.repo-ref.observed",
]);

export function agentConditionProblem(decision: AgentDecision): string | null {
  const requiresCondition =
    decision.decision === "waiting" ||
    (["committed", "test-current"].includes(decision.decision) &&
      decision.liveReady === false);
  if (!requiresCondition) return null;
  const condition = decision.condition;
  if (!condition) {
    return decision.decision === "waiting"
      ? "decision=waiting requires one exact Condition"
      : `decision=${decision.decision} with liveReady=false requires one exact observable Condition; use needs-owner when the app cannot observe the external boundary`;
  }
  if (!isTypedProjectAppConditionSubject(condition.subject)) {
    return `Condition subject must be typed, not prose: ${condition.subject}`;
  }
  if (!observableConditionTypes.has(condition.type)) {
    return `Condition type ${condition.type} has no producer in this app; reuse an observable pipeline, approval, task, or repo-ref condition`;
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

export function terminalRunDecisionProblem(
  decision: AgentDecision,
  options: {
    requireSucceededProvider?: boolean;
    providerResult?: string;
  } = {},
): string | null {
  if (decision.decision === "test-current") {
    return "decision=test-current is not actionable after the exact source commit already received a terminal live run; judge that run, repair the source, retry a proven transient failure, wait on an exact external fact, or identify a genuine ownership boundary";
  }
  if (
    decision.decision === "accepted-pass" &&
    options.requireSucceededProvider &&
    options.providerResult !== "succeeded"
  ) {
    return `decision=accepted-pass is invalid because this runnable normalization requires an exact succeeded ADO run, but provider result is ${options.providerResult || "unknown"}; preserve the domain diagnosis, repair the test contract so expected behavior reports pass, or return an exact wait/ownership boundary`;
  }
  if (
    decision.decision === "committed" &&
    typeof decision.liveReady !== "boolean"
  ) {
    return "decision=committed must explicitly set liveReady=true or liveReady=false; a repaired commit alone does not authorize a replacement ADO run";
  }
  return null;
}

export function scenarioNormalizationWaitProblem(
  decision: AgentDecision,
): string | null {
  const hasWait =
    decision.decision === "waiting" ||
    (["committed", "test-current"].includes(decision.decision) &&
      decision.liveReady === false);
  if (!hasWait) return null;
  const condition = decision.condition;
  if (condition?.type === "aks.repo-ref.observed") {
    return [
      "scenario normalization cannot wait for an arbitrary repository advance",
      "a repo-ref change does not by itself repair or verify this task-owned source",
      "this workflow owns task-branch publication, current-dev replay, live dispatch, and final direct integration, so an unpublished task commit is never a blocker",
      "return liveReady=true when the exact source is runnable, name the exact external producer that can change a real blocker, or return needs-owner for a reviewed non-runnable terminal disposition",
    ].join("; ");
  }
  if (condition?.type !== "pipeline.spec.observed") return null;
  if (
    !condition.expected ||
    typeof condition.expected !== "object" ||
    Array.isArray(condition.expected)
  ) {
    return null;
  }
  const expected = condition.expected as Record<string, unknown>;
  if (expected.sourceBranch !== "refs/heads/main") return null;
  return [
    "scenario normalization cannot wait for a future main-branch spec observation",
    "that observation would not verify or publish this task-owned source commit",
    "use an exact task-source run or capability fact, implement an observable live negative contract, or request owner judgment",
  ].join("; ");
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

export function taskContextDir(
  repoDir: string,
  taskId: string,
  generation: number,
): string {
  return join(
    repoDir,
    "workspace",
    "tasks",
    safePart(`${taskId}@${generation}`),
  );
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

function commandAsync(
  executable: string,
  args: string[],
  options: { cwd: string; allowFailure?: boolean; timeoutMs?: number },
): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      {
        cwd: options.cwd,
        encoding: "utf8",
        timeout: options.timeoutMs ?? 120_000,
        maxBuffer: 32 * 1024 * 1024,
        env: {
          ...process.env,
          AZURE_CONFIG_DIR:
            process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
        },
      },
      (error, stdout, stderr) => {
        const output = {
          status:
            typeof (error as NodeJS.ErrnoException | null)?.code === "number"
              ? ((error as NodeJS.ErrnoException).code as number)
              : error
                ? 1
                : 0,
          stdout: (stdout ?? "").trim(),
          stderr: (stderr || error?.message || "").trim(),
        };
        if (!options.allowFailure && output.status !== 0) {
          reject(
            new Error(
              `${executable} ${args.join(" ")} failed: ${output.stderr || output.stdout}`,
            ),
          );
          return;
        }
        resolve(output);
      },
    );
  });
}

export function checkLiveDispatchAdmission(
  workspaceDir: string,
  specId: string,
  run: (
    executable: string,
    args: string[],
    cwd: string,
  ) => { status: number; stdout: string; stderr: string } = (
    executable,
    args,
    cwd,
  ) => command(executable, args, { cwd, allowFailure: true }),
): LiveDispatchAdmission {
  const checks = [
    ["runner/check-private-source-policy.ts", "private-source-policy"],
    ["runner/check-live-admission.ts", "live-admission"],
  ] as const;
  const evidence: string[] = [];
  let accepted = true;

  for (const [script, label] of checks) {
    const args = [script, "--specs", specId];
    const result = run("bun", args, workspaceDir);
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    evidence.push(
      [
        `dispatch-check:${label}:${result.status === 0 ? "pass" : "fail"}`,
        `command:bun ${args.join(" ")}`,
        output ? `output:${output}` : "output:(none)",
      ].join("\n"),
    );
    if (result.status !== 0) accepted = false;
  }

  return { accepted, evidence };
}

function git(
  cwd: string,
  args: string[],
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  return command("git", args, { cwd, allowFailure });
}

type GitCommand = (
  cwd: string,
  args: string[],
  allowFailure?: boolean,
) => { status: number; stdout: string; stderr: string };

export function isNonFastForwardPushFailure(result: {
  stdout: string;
  stderr: string;
}): boolean {
  return /non-fast-forward|fetch first|tip of your current branch is behind/i.test(
    `${result.stdout}\n${result.stderr}`,
  );
}

export function reconcileRemoteTaskBranchHistory(
  workspaceDir: string,
  sourceBranch: string,
  runGit: GitCommand = git,
):
  | { state: "current" | "merged"; remoteRef: string; sourceCommit: string }
  | { state: "conflicted"; remoteRef: string; conflictedPaths: string[] }
  | { state: "failed"; remoteRef: string; error: string } {
  const remoteRef = `refs/remotes/origin/${sourceBranch}`;
  const fetch = runGit(
    workspaceDir,
    [
      "fetch",
      "origin",
      `+refs/heads/${sourceBranch}:${remoteRef}`,
    ],
    true,
  );
  if (fetch.status !== 0) {
    return {
      state: "failed",
      remoteRef,
      error: fetch.stderr || fetch.stdout || "remote task branch fetch failed",
    };
  }

  const remoteIsInHead =
    runGit(
      workspaceDir,
      ["merge-base", "--is-ancestor", remoteRef, "HEAD"],
      true,
    ).status === 0;
  if (remoteIsInHead) {
    return {
      state: "current",
      remoteRef,
      sourceCommit: runGit(workspaceDir, ["rev-parse", "HEAD"]).stdout,
    };
  }

  const merge = runGit(
    workspaceDir,
    ["merge", "--no-ff", "--no-edit", remoteRef],
    true,
  );
  if (merge.status === 0) {
    const sourceCommit = runGit(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    const preserved =
      runGit(
        workspaceDir,
        ["merge-base", "--is-ancestor", remoteRef, sourceCommit],
        true,
      ).status === 0;
    if (preserved) return { state: "merged", remoteRef, sourceCommit };
    return {
      state: "failed",
      remoteRef,
      error: `merged task branch does not preserve ${remoteRef}`,
    };
  }

  const conflictedPaths = runGit(
    workspaceDir,
    ["diff", "--name-only", "--diff-filter=U"],
    true,
  ).stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (conflictedPaths.length > 0) {
    return { state: "conflicted", remoteRef, conflictedPaths };
  }

  runGit(workspaceDir, ["merge", "--abort"], true);
  return {
    state: "failed",
    remoteRef,
    error: merge.stderr || merge.stdout || "remote task branch merge failed",
  };
}

async function azJson(cwd: string, args: string[]): Promise<unknown> {
  const result = await commandAsync(
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

function artifactPart(value: string): string {
  return value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function collectTerminalRunEvidence(
  repoDir: string,
  runContextDir: string,
  runId: string,
  run: PipelineRun,
  dependencies: {
    listArtifacts?: () => unknown | Promise<unknown>;
    downloadArtifact?: (
      name: string,
      downloadDir: string,
    ) =>
      | { status: number; stdout: string; stderr: string }
      | Promise<{ status: number; stdout: string; stderr: string }>;
  } = {},
): CollectedRunEvidence {
  mkdirSync(runContextDir, { recursive: true });
  const runPath = join(runContextDir, "ado-run-show.json");
  writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

  const artifactListPath = join(runContextDir, "ado-artifacts.json");
  const artifactPaths: string[] = [];
  const errors: string[] = [];
  let artifacts: unknown = [];
  try {
    artifacts = dependencies.listArtifacts
      ? await dependencies.listArtifacts()
      : await azJson(repoDir, [
          "pipelines",
          "runs",
          "artifact",
          "list",
          "--run-id",
          runId,
        ]);
  } catch (error) {
    errors.push(
      `artifact-list: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  writeFileSync(artifactListPath, `${JSON.stringify(artifacts, null, 2)}\n`);

  for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
    const name = nonEmptyString(
      artifact && typeof artifact === "object"
        ? (artifact as { name?: unknown }).name
        : "",
    );
    if (!name) continue;
    const downloadDir = join(
      runContextDir,
      "artifacts",
      artifactPart(name) || "artifact",
    );
    const markerPath = join(downloadDir, ".download-complete");
    if (existsSync(markerPath)) {
      artifactPaths.push(downloadDir);
      continue;
    }
    mkdirSync(downloadDir, { recursive: true });
    const result = dependencies.downloadArtifact
      ? await dependencies.downloadArtifact(name, downloadDir)
      : await commandAsync(
          azCli,
          [
            "pipelines",
            "runs",
            "artifact",
            "download",
            "--run-id",
            runId,
            "--artifact-name",
            name,
            "--path",
            downloadDir,
            "--organization",
            organization,
            "--project",
            adoProject,
          ],
          {
            cwd: repoDir,
            allowFailure: true,
            timeoutMs: 10 * 60_000,
          },
        );
    if (result.status === 0) {
      writeFileSync(markerPath, `${new Date().toISOString()}\n`);
      artifactPaths.push(downloadDir);
    } else {
      errors.push(
        `artifact-download:${name}: ${result.stderr || result.stdout || `exit ${result.status}`}`,
      );
    }
  }

  writeFileSync(
    join(runContextDir, "collection.json"),
    `${JSON.stringify(
      { runId, runPath, artifactListPath, artifactPaths, errors },
      null,
      2,
    )}\n`,
  );
  return { runPath, artifactListPath, artifactPaths, errors };
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
        nonEmptyString(metadata.taskId) === input.taskId
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

export function taskScopedAgentCondition(
  taskId: string,
  generation: number,
  condition: ProjectAppConditionSpec,
): ProjectAppConditionSpec {
  const taskScope = createHash("sha256")
    .update(`${taskId}@${generation}`)
    .digest("hex")
    .slice(0, 12);
  return {
    ...condition,
    id: `${condition.id}:task-${taskScope}`,
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

function scenarioReplayPath(contextDir: string): string {
  return join(contextDir, "scenario-replay.json");
}

function readScenarioReplayState(
  contextDir: string,
): ScenarioReplayState | null {
  const path = scenarioReplayPath(contextDir);
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as ScenarioReplayState;
    return value?.version === 1 ? value : null;
  } catch {
    return null;
  }
}

function saveScenarioReplayState(
  contextDir: string,
  state: ScenarioReplayState,
): void {
  writeFileSync(
    scenarioReplayPath(contextDir),
    `${JSON.stringify(state, null, 2)}\n`,
  );
}

export function terminalRunContextDir(
  contextDir: string,
  runId: string,
): string {
  const runPart = /^\d+$/.test(runId) ? runId : safePart(runId);
  return join(contextDir, "runs", runPart);
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

async function getPipelineRun(
  repoDir: string,
  runId: string,
): Promise<PipelineRun | null> {
  const value = await azJson(repoDir, [
    "pipelines",
    "runs",
    "show",
    "--id",
    runId,
  ]);
  return value && typeof value === "object" ? (value as PipelineRun) : null;
}

export async function discoverTaskRuns(
  contextDir: string,
  sourceBranch: string,
  dependencies: {
    getExactRun: (runId: string) => Promise<PipelineRun | null>;
    listBranchRuns: (sourceBranch: string) => Promise<PipelineRun[]>;
  },
): Promise<PipelineRun[]> {
  const receipt = readRunReceipt(contextDir);
  if (receipt) {
    const exact = await dependencies.getExactRun(receipt.runId);
    return exact ? [exact] : [];
  }
  return dependencies.listBranchRuns(sourceBranch);
}

async function taskRuns(
  repoDir: string,
  contextDir: string,
  sourceBranch: string,
): Promise<PipelineRun[]> {
  return discoverTaskRuns(contextDir, sourceBranch, {
    getExactRun: (runId) => getPipelineRun(repoDir, runId),
    listBranchRuns: async (branch) => {
      const value = await azJson(repoDir, [
        "pipelines",
        "runs",
        "list",
        "--pipeline-ids",
        pipelineId,
        "--branch",
        branch,
        "--query-order",
        "QueueTimeDesc",
        "--top",
        "20",
      ]);
      return Array.isArray(value) ? (value as PipelineRun[]) : [];
    },
  });
}

async function queueRun(
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
): Promise<PipelineRun> {
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
  const value = await azJson(repoDir, [
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

async function pullRequests(
  repoDir: string,
  sourceBranch: string,
  targetBranch: string,
): Promise<PullRequest[]> {
  const value = await azJson(repoDir, [
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

async function createPullRequest(
  repoDir: string,
  input: {
    taskId: string;
    specId: string;
    sourceBranch: string;
    sourceCommit: string;
    runId: string;
    targetBranch: string;
  },
): Promise<PullRequest> {
  const description = [
    `Task: ${input.taskId}`,
    `Spec: ${input.specId}`,
    `Live-tested source commit: ${input.sourceCommit}`,
    `Azure DevOps run: ${input.runId}`,
    `Target: ${input.targetBranch}`,
    `Integration proof: Azure must report this exact live-tested source commit as the completed PR head and its resulting target commit in ${input.targetBranch} ancestry. Squash, rebase, and merge-commit completion are supported.`,
  ].join("\n\n");
  const value = await azJson(repoDir, [
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

async function abandonPullRequest(
  repoDir: string,
  pullRequestId: string,
): Promise<boolean> {
  try {
    await azJson(repoDir, [
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

export function priorIntegratedProof(input: {
  repoDir: string;
  taskId: string;
  generation: number;
  specId: string;
  target: string;
  standaloneBuildId: string;
}): { proof: ReviewedRunProof; path: string } | null {
  for (
    let generation = input.generation - 1;
    generation >= 1;
    generation -= 1
  ) {
    const path = taskContextDir(input.repoDir, input.taskId, generation);
    const proof = readProof(path);
    if (
      proof?.taskId === input.taskId &&
      proof.specId === input.specId &&
      proof.target === input.target &&
      (proof.standaloneBuildId || "") === input.standaloneBuildId &&
      proof.pullRequestId &&
      proof.mergedCommit &&
      proof.targetRef
    ) {
      return { proof, path: proofPath(path) };
    }
  }
  return null;
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

export function decisionCorrectionPrompt(input: {
  originalPrompt: string;
  decision: AgentDecision;
  problem: string;
  continueDomainWork: boolean;
}): string {
  if (input.continueDomainWork) {
    return [
      input.originalPrompt,
      "Your immediately preceding structured result failed a hard invariant.",
      `Validation finding: ${input.problem}.`,
      "Continue this same bounded task from current hot evidence. Re-evaluate the prior judgment and perform any source diagnosis, repair, and local checks allowed by the original instructions when the finding proves they are necessary.",
      "Do not queue provider work or create another task; the workflow still owns dispatch after a valid result.",
      `Invalid prior structured result:\n${JSON.stringify(input.decision, null, 2)}`,
    ].join("\n\n");
  }
  return [
    "Correct the structured result from your immediately preceding domain judgment.",
    `Hard validation failure: ${input.problem}.`,
    conditionInstruction,
    "Do not repeat provider operations, queue work, or change source merely to correct the result. Preserve the prior domain judgment unless current evidence proves it wrong.",
    `Prior structured result:\n${JSON.stringify(input.decision, null, 2)}`,
  ].join("\n\n");
}

export async function askAgent(
  ctx: WorkflowContext,
  prompt: string,
  options: {
    validateDecision?: (decision: AgentDecision) => string | null;
    scenarioNormalization?: boolean;
    continueDomainWorkOnValidation?: boolean;
    retryDelayMs?: number;
  } = {},
): Promise<AgentDecision> {
  let nextPrompt = `${prompt}\n\n${conditionInstruction}`;
  let lastProblem = "";
  const maxAttempts = options.continueDomainWorkOnValidation ? 3 : 2;
  let runtimeFailures = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await ctx.runAgent(ctx.agent, nextPrompt, {
      timeoutMs: 1_800_000,
      schema: decisionSchema,
    });
    if (result.status === "error" || result.status === "interrupted") {
      runtimeFailures += 1;
      lastProblem = `agent invocation ${result.status} before structured judgment`;
      if (runtimeFailures < 2 && attempt < maxAttempts) {
        const retryDelayMs = options.retryDelayMs ?? 5_000;
        if (retryDelayMs > 0) await Bun.sleep(retryDelayMs);
        nextPrompt = [
          prompt,
          "The immediately preceding agent invocation ended before producing a structured judgment.",
          "Continue the same bounded task from the current task worktree and hot evidence. Inspect any work already left there before deciding or editing; do not treat the runtime interruption as a domain blocker or ownership boundary.",
          conditionInstruction,
        ].join("\n\n");
        continue;
      }
      throw new Error(
        `Agent invocation failed before structured judgment after ${runtimeFailures === 2 ? "two" : runtimeFailures} attempt${runtimeFailures === 1 ? "" : "s"}: ${lastProblem}`,
      );
    }
    const decision = result.structuredResult as AgentDecision;
    const problem =
      agentConditionProblem(decision) ??
      (options.scenarioNormalization
        ? scenarioNormalizationWaitProblem(decision)
        : null) ??
      options.validateDecision?.(decision) ??
      null;
    if (!problem) return decision;
    lastProblem = problem;
    nextPrompt = decisionCorrectionPrompt({
      originalPrompt: prompt,
      decision,
      problem,
      continueDomainWork: Boolean(options.continueDomainWorkOnValidation),
    });
  }
  throw new Error(
    `Agent exhausted structured-result correction after a hard validation failure${lastProblem ? `: ${lastProblem}` : ""}`,
  );
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
  const payload = parseTaskPayload(ctx.task);
  const { targetBranch, targetRef } = resolveIntegrationTarget(
    options.targetBranch,
  );
  const taskId = nonEmptyString(payload?.taskId);
  const generation = Number(payload?.generation ?? 1);
  const normalizationInput = payload?.input as
    ScenarioNormalizationInput | undefined;
  const selectedSpecIds = scenarioNormalizationSpecIds(normalizationInput);
  const specId = selectedSpecIds.join(",");
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

  const contextDir = taskContextDir(repoDir, taskId, generation);
  mkdirSync(contextDir, { recursive: true });

  try {
    git(repoDir, ["fetch", "origin", targetBranch]);
    let priorVerificationSummary = "";
    if (priorVerificationRunId) {
      const priorRun = await getPipelineRun(repoDir, priorVerificationRunId);
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
        { scenarioNormalization: Boolean(normalizationInput) },
      );
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
    const recordedTaskBase = nonEmptyString(
      normalizationInput?.originDevCommit,
    );
    const replayedSourceCommit = nonEmptyString(
      payload?.input?.replayedSourceCommit,
    );
    if (
      normalizationInput?.loopId === "scenario-normalization" &&
      replayedSourceCommit &&
      sourceCommit === recordedTaskBase &&
      sourceCommit !== replayedSourceCommit &&
      git(
        workspaceDir,
        ["cat-file", "-e", `${replayedSourceCommit}^{commit}`],
        true,
      ).status === 0 &&
      git(
        workspaceDir,
        ["merge-base", "--is-ancestor", recordedTaskBase, replayedSourceCommit],
        true,
      ).status === 0
    ) {
      git(workspaceDir, ["reset", "--hard", replayedSourceCommit]);
      sourceCommit = replayedSourceCommit;
    }
    const priorProof = options.reusePriorIntegratedProof
      ? priorIntegratedProof({
          repoDir,
          taskId,
          generation,
          specId,
          target: liveTarget,
          standaloneBuildId,
        })
      : null;
    if (
      priorProof &&
      priorProof.proof.targetRef === targetRef &&
      git(
        repoDir,
        [
          "merge-base",
          "--is-ancestor",
          priorProof.proof.mergedCommit!,
          targetRef,
        ],
        true,
      ).status === 0
    ) {
      const proof = priorProof.proof;
      const summary = `${specId} retains exact live proof from run ${proof.runId}; PR ${proof.pullRequestId} integrated it as ${proof.mergedCommit} in ${targetBranch}.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          `pipeline-run:${proof.runId}`,
          `pull-request:${proof.pullRequestId}`,
          `source-commit:${proof.sourceCommit}`,
          `merged-commit:${proof.mergedCommit}`,
          `target-ref:${targetRef}`,
          `proof:${priorProof.path}`,
        ],
        actions: [],
      });
    }

    const prepareLiveDispatch = async (
      candidateCommit: string,
      reason: string,
    ): Promise<
      | { state: "ready"; sourceCommit: string; evidence: string[] }
      | { state: "result"; result: WorkflowResult }
    > => {
      let currentCommit = candidateCommit;
      const accumulatedEvidence: string[] = [];

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const admission = checkLiveDispatchAdmission(workspaceDir, specId);
        accumulatedEvidence.push(...admission.evidence);
        if (admission.accepted) {
          return {
            state: "ready",
            sourceCommit: currentCommit,
            evidence: accumulatedEvidence,
          };
        }

        const beforeRepair = currentCommit;
        const decision = await askAgent(
          ctx,
          [
            `ADO dispatch is refused for ${specId} at ${currentCommit}.`,
            `Dispatch context: ${reason}.`,
            "The workflow ran the same private-source and live-admission checks used by the pipeline in the exact task worktree. Inspect the current source and the raw findings below; do not trust this summary alone.",
            ...admission.evidence,
            "Continue this same task. For a carrier/spec defect, make the smallest repair, run the same checks plus scoped tests, commit it, leave the worktree clean, and return decision=committed.",
            "Unsupported product behavior is not automatically nonlive. If the public API exposes an observable rejection or no-op contract, implement a truthful live negative test for that behavior.",
            "A source-only check is diagnostic evidence, not completion. If no truthful staging-observable contract exists, return one exact external wait or needs-owner with the concrete ownership boundary; do not mark the task complete.",
            "Use waiting only for one exact externally observable condition and needs-owner only for a genuine ownership-boundary decision. Do not push, queue ADO, create another task, or edit app state.",
            "Task:",
            ctx.task,
          ].join("\n\n"),
          {
            scenarioNormalization: Boolean(normalizationInput),
            continueDomainWorkOnValidation: true,
          },
        );
        if (decision.decision === "waiting" && decision.condition) {
          return {
            state: "result",
            result: waitingResult(
              ctx,
              decision.summary,
              [...accumulatedEvidence, ...decision.evidence],
              taskScopedAgentCondition(taskId, generation, decision.condition),
            ),
          };
        }
        if (decision.decision === "needs-owner") {
          return {
            state: "result",
            result: ownerResult(ctx, decision.summary, [
              ...accumulatedEvidence,
              ...decision.evidence,
            ]),
          };
        }
        if (decision.decision !== "committed") {
          return {
            state: "result",
            result: ownerResult(
              ctx,
              `Live-dispatch admission repair returned unsupported decision ${decision.decision}.`,
              [...accumulatedEvidence, ...decision.evidence],
            ),
          };
        }

        currentCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        if (currentCommit === beforeRepair || cleanWorkspace(workspaceDir)) {
          return {
            state: "result",
            result: ownerResult(
              ctx,
              "Live-dispatch admission repair did not leave one new clean task commit.",
              [...accumulatedEvidence, ...decision.evidence],
            ),
          };
        }
        accumulatedEvidence.push(...decision.evidence);
      }

      return {
        state: "result",
        result: ownerResult(
          ctx,
          "Live-dispatch admission remained red after three bounded domain repair iterations.",
          accumulatedEvidence,
        ),
      };
    };

    const publishTaskBranch = async (
      candidateCommit: string,
      reason: string,
    ): Promise<
      | { state: "ready"; sourceCommit: string; evidence: string[] }
      | { state: "result"; result: WorkflowResult }
    > => {
      let currentCommit = candidateCommit;
      const evidence: string[] = [];

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const push = git(
          workspaceDir,
          ["push", "origin", `${currentCommit}:refs/heads/${sourceBranch}`],
          true,
        );
        if (push.status === 0) {
          return { state: "ready", sourceCommit: currentCommit, evidence };
        }
        if (!isNonFastForwardPushFailure(push)) {
          return {
            state: "result",
            result: ownerResult(
              ctx,
              `Could not publish the current task branch for ${specId}.`,
              [
                ...evidence,
                `source-branch:${sourceBranch}`,
                `source-commit:${currentCommit}`,
                `push-error:${push.stderr || push.stdout}`,
              ],
            ),
          };
        }

        evidence.push(
          `task-branch-non-fast-forward:${sourceBranch}@${currentCommit}`,
        );
        const history = reconcileRemoteTaskBranchHistory(
          workspaceDir,
          sourceBranch,
        );
        if (history.state === "failed") {
          return {
            state: "result",
            result: ownerResult(
              ctx,
              `Could not reconcile divergent task-branch history for ${specId}.`,
              [...evidence, `branch-history-error:${history.error}`],
            ),
          };
        }

        if (history.state === "conflicted") {
          const beforeResolution = currentCommit;
          const decision = await askAgent(
            ctx,
            [
              `Publishing ${specId} hit a non-fast-forward update on the same task branch ${sourceBranch}.`,
              `The workflow fetched ${history.remoteRef} and started a merge in ${workspaceDir}. Conflicted paths: ${history.conflictedPaths.join(", ")}.`,
              "Resolve only this task-branch history merge, preserve the current bounded source intent and both branch histories, run scoped checks, commit the merge, leave the worktree clean, and return decision=committed.",
              "Do not abort and replace the merge with a cherry-pick, force-push, queue ADO, create another task, or edit app state. The workflow will re-run admission, publish, and require exact live proof for the resulting commit.",
              "Task:",
              ctx.task,
            ].join("\n\n"),
            {
              scenarioNormalization: Boolean(normalizationInput),
              continueDomainWorkOnValidation: true,
              validateDecision: (candidate) => {
                if (candidate.decision !== "committed") {
                  return "task-branch history conflict must be resolved in this same domain workflow before publication";
                }
                if (cleanWorkspace(workspaceDir)) {
                  return "task-branch history resolution must leave the worktree clean";
                }
                const head = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
                if (head === beforeResolution) {
                  return "task-branch history resolution did not create a new commit";
                }
                if (
                  git(
                    workspaceDir,
                    [
                      "merge-base",
                      "--is-ancestor",
                      history.remoteRef,
                      head,
                    ],
                    true,
                  ).status !== 0
                ) {
                  return `resolved task branch must preserve ${history.remoteRef} in its ancestry`;
                }
                return null;
              },
            },
          );
          evidence.push(...decision.evidence);
        }

        currentCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        if (cleanWorkspace(workspaceDir)) {
          return {
            state: "result",
            result: ownerResult(
              ctx,
              "Task-branch history reconciliation left the worktree dirty.",
              [...evidence, `workspace:${workspaceDir}`],
            ),
          };
        }
        if (
          git(
            workspaceDir,
            [
              "merge-base",
              "--is-ancestor",
              history.remoteRef,
              currentCommit,
            ],
            true,
          ).status !== 0
        ) {
          return {
            state: "result",
            result: ownerResult(
              ctx,
              "Task-branch history reconciliation did not preserve the remote task branch.",
              [
                ...evidence,
                `source-branch:${sourceBranch}`,
                `source-commit:${currentCommit}`,
              ],
            ),
          };
        }

        const dispatch = await prepareLiveDispatch(
          currentCommit,
          `${reason}; task branch history advanced during publication`,
        );
        if (dispatch.state === "result") return dispatch;
        currentCommit = dispatch.sourceCommit;
        evidence.push(...dispatch.evidence);
      }

      return {
        state: "result",
        result: ownerResult(
          ctx,
          `Could not publish ${specId} after three task-branch history reconciliations.`,
          [
            ...evidence,
            `source-branch:${sourceBranch}`,
            `source-commit:${currentCommit}`,
          ],
        ),
      };
    };

    const queueFreshRun = async (
      candidateCommit: string,
      retryOfRunId?: string,
    ): Promise<
      | { state: "queued"; run: PipelineRun }
      | { state: "result"; result: WorkflowResult }
    > => {
      const directScenarioNormalization =
        integrationMode(targetBranch) === "direct" &&
        normalizationInput?.loopId === "scenario-normalization";
      if (directScenarioNormalization) {
        git(repoDir, ["fetch", "origin", targetBranch]);
        const latestTargetCommit = git(repoDir, [
          "rev-parse",
          targetRef,
        ]).stdout;
        const targetIsInSource =
          git(
            workspaceDir,
            [
              "merge-base",
              "--is-ancestor",
              latestTargetCommit,
              candidateCommit,
            ],
            true,
          ).status === 0;
        if (
          liveDispatchTargetRefreshRequired({
            directScenarioNormalization,
            targetIsInSource,
          })
        ) {
          return {
            state: "result",
            result: await reconcileSpecLive(ctx, {
              ...options,
              reviewedScenarioPatch: true,
            }),
          };
        }
      }

      return {
        state: "queued",
        run: await queueRun(repoDir, {
          taskId,
          generation,
          specId,
          sourceBranch,
          sourceCommit: candidateCommit,
          target: liveTarget,
          standaloneBuildId,
          ...(retryOfRunId ? { retryOfRunId } : {}),
        }),
      };
    };

    const sourceInvariantBeforeRunLookup = scenarioNormalizationInvariant(
      workspaceDir,
      normalizationInput,
    );
    const terminalExactRunBeforeReplay =
      sourceInvariantBeforeRunLookup?.stillListed
        ? false
        : matchingTaskRuns(await taskRuns(repoDir, contextDir, sourceBranch), {
            taskId,
            generation,
            specId,
            sourceCommit,
            target: liveTarget,
            standaloneBuildId,
          }).some((run) => pipelineRunState(run) === "completed");

    if (
      shouldReplayScenarioBeforeRunReview({
        directScenarioNormalization:
          integrationMode(targetBranch) === "direct" &&
          normalizationInput?.loopId === "scenario-normalization",
        terminalExactRun: terminalExactRunBeforeReplay,
      })
    ) {
      const recordedTaskBase = nonEmptyString(
        normalizationInput.originDevCommit,
      );
      const priorReplay = readScenarioReplayState(contextDir);
      const priorReplayBase =
        priorReplay?.recordedTaskBase === recordedTaskBase &&
        /^[0-9a-f]{40}$/i.test(priorReplay.replayBase) &&
        git(
          workspaceDir,
          ["merge-base", "--is-ancestor", priorReplay.replayBase, "HEAD"],
          true,
        ).status === 0
          ? priorReplay.replayBase
          : "";
      const recordedFirstParentMerges = git(workspaceDir, [
        "rev-list",
        "--first-parent",
        "--merges",
        `${recordedTaskBase}..HEAD`,
      ])
        .stdout.split(/\r?\n/)
        .filter(Boolean);
      const mergeBase = git(
        workspaceDir,
        ["merge-base", "HEAD", targetRef],
        true,
      ).stdout;
      const inferredMergeBase =
        /^[0-9a-f]{40}$/i.test(mergeBase) &&
        git(
          workspaceDir,
          ["merge-base", "--is-ancestor", recordedTaskBase, mergeBase],
          true,
        ).status === 0
          ? mergeBase
          : "";
      const taskBase = scenarioNormalizationReplayBase({
        recordedTaskBase,
        priorReplayBase,
        inferredMergeBase,
        recordedFirstParentMergeCount: recordedFirstParentMerges.length,
      });
      const sourceIsInTarget =
        git(
          repoDir,
          ["merge-base", "--is-ancestor", sourceCommit, targetRef],
          true,
        ).status === 0;
      if (!/^[0-9a-f]{40}$/i.test(recordedTaskBase)) {
        return ownerResult(
          ctx,
          "Scenario normalization cannot replay a stale task branch without its exact recorded origin/dev base.",
          [
            `task:${taskId}`,
            `source-commit:${sourceCommit}`,
            `origin-dev-commit:${recordedTaskBase || "missing"}`,
          ],
        );
      }
      if (
        git(workspaceDir, ["cat-file", "-e", `${taskBase}^{commit}`], true)
          .status !== 0 ||
        git(
          workspaceDir,
          ["merge-base", "--is-ancestor", taskBase, "HEAD"],
          true,
        ).status !== 0
      ) {
        return ownerResult(
          ctx,
          "The recorded scenario-normalization base is not an ancestor of the task branch, so task-owned commits cannot be isolated safely.",
          [
            `task:${taskId}`,
            `source-commit:${sourceCommit}`,
            `origin-dev-commit:${taskBase}`,
          ],
        );
      }

      const targetIsInSource =
        git(
          workspaceDir,
          ["merge-base", "--is-ancestor", targetRef, "HEAD"],
          true,
        ).status === 0;
      const firstParentMerges = git(workspaceDir, [
        "rev-list",
        "--first-parent",
        "--merges",
        `${taskBase}..HEAD`,
      ])
        .stdout.split(/\r?\n/)
        .filter(Boolean);

      if (
        scenarioNormalizationReplayRequired({
          sourceIsInTarget,
          targetIsInSource,
          firstParentMergeCount: firstParentMerges.length,
        })
      ) {
        if (!sourceBranch.startsWith("task/")) {
          return ownerResult(
            ctx,
            "Scenario normalization replay may update only its dedicated task branch.",
            [`source-branch:${sourceBranch}`, `task:${taskId}`],
          );
        }
        const cherry = git(workspaceDir, ["cherry", targetRef, "HEAD"], true);
        if (cherry.status !== 0) {
          return ownerResult(
            ctx,
            "Scenario normalization replay could not distinguish task patches from changes already integrated into the current target.",
            [
              `task:${taskId}`,
              `source-commit:${sourceCommit}`,
              `target-ref:${targetRef}@${baseCommit}`,
              `git-cherry:${cherry.stderr || cherry.stdout || "failed"}`,
            ],
          );
        }
        const taskCommits = novelScenarioReplayCommits(cherry.stdout);
        if (
          taskCommits.length === 0 &&
          git(workspaceDir, ["diff", "--quiet", targetRef, "HEAD"], true)
            .status !== 0
        ) {
          return ownerResult(
            ctx,
            "Scenario normalization branch differs from the current target but has no novel non-merge patch lineage safe to replay.",
            [
              `task:${taskId}`,
              `source-commit:${sourceCommit}`,
              `target-ref:${targetRef}@${baseCommit}`,
            ],
          );
        }
        const expectedRemoteCommit = remoteLeaseCommit(
          git(
            workspaceDir,
            [
              "ls-remote",
              "--exit-code",
              "origin",
              `refs/heads/${sourceBranch}`,
            ],
            true,
          ),
        );
        git(workspaceDir, ["reset", "--hard", targetRef]);
        const replay = taskCommits.length
          ? git(workspaceDir, ["cherry-pick", ...taskCommits], true)
          : { status: 0, stdout: "", stderr: "" };
        let replayEvidence = [
          `origin-dev-commit:${recordedTaskBase}`,
          `task-replay-base:${taskBase}`,
          `replay-target:${targetRef}@${baseCommit}`,
          `task-owned-commits:${taskCommits.join(",") || "none"}`,
          `discarded-first-parent-merges:${firstParentMerges.join(",") || "none"}`,
        ];
        if (replay.status !== 0) {
          const decision = await askAgent(
            ctx,
            [
              `Replay only the task-owned commits for ${specId} onto current ${targetRef} in ${workspaceDir}.`,
              `The workflow reset the dedicated task branch to ${baseCommit} and started one cherry-pick sequence containing: ${taskCommits.join(", ") || "none"}.`,
              `The sequence stopped with: ${replay.stderr || replay.stdout}.`,
              "Resolve only conflicts caused by these task-owned commits, finish or abort the complete cherry-pick sequence, run scoped checks, leave one clean task branch, and return decision=committed.",
              "Do not merge either repository history wholesale, push, queue ADO, create another branch/task, or edit app state. The workflow will lease-update the task branch and require a fresh exact live run.",
              "Task:",
              ctx.task,
            ].join("\n\n"),
            { scenarioNormalization: true },
          );
          if (decision.decision !== "committed") {
            return ownerResult(ctx, decision.summary, [
              ...replayEvidence,
              ...decision.evidence,
            ]);
          }
          replayEvidence = [...replayEvidence, ...decision.evidence];
        }

        const replayedCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        if (
          cleanWorkspace(workspaceDir) ||
          git(workspaceDir, ["rev-parse", "--verify", "CHERRY_PICK_HEAD"], true)
            .status === 0
        ) {
          return ownerResult(
            ctx,
            "Scenario normalization replay did not leave one clean completed task lineage.",
            [...replayEvidence, `workspace:${workspaceDir}`],
          );
        }
        git(workspaceDir, [
          "push",
          scenarioReplayForceWithLeaseArg({
            sourceBranch,
            expectedRemoteCommit,
          }),
          "origin",
          `HEAD:refs/heads/${sourceBranch}`,
        ]);
        sourceCommit = replayedCommit;
        saveScenarioReplayState(contextDir, {
          version: 1,
          recordedTaskBase,
          replayBase: baseCommit,
          sourceCommit,
        });
      }
    }

    const normalizationInvariant = scenarioNormalizationInvariant(
      workspaceDir,
      normalizationInput,
    );
    if (normalizationInvariant?.stillListed) {
      const beforeNormalization = sourceCommit;
      const decision = await askAgent(
        ctx,
        [
          "Continue the same bounded scenario-normalization task; the source invariant is still red and no live run may be queued yet.",
          `Strict inventory still lists ${normalizationInvariant.kind} ${normalizationInvariant.path}.`,
          "Preserve behavior and every active spec. Complete the direct .test.ts implementation, remove or relocate the plain carrier as required, run scoped checks plus bun scripts/check-scenario-tests.ts --strict --json, commit the bounded correction, and leave the worktree clean.",
          "Return decision=committed only after the strict inventory no longer lists this exact row. Do not push, queue ADO, create a PR, create another task, or edit app state.",
          "Task:",
          ctx.task,
        ].join("\n\n"),
        { scenarioNormalization: true },
      );
      if (decision.decision === "waiting" && decision.condition) {
        return waitingResult(
          ctx,
          decision.summary,
          decision.evidence,
          taskScopedAgentCondition(taskId, generation, decision.condition),
        );
      }
      if (decision.decision === "needs-owner") {
        return ownerResult(ctx, decision.summary, decision.evidence);
      }
      sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      if (
        decision.decision !== "committed" ||
        sourceCommit === beforeNormalization ||
        cleanWorkspace(workspaceDir)
      ) {
        return ownerResult(
          ctx,
          "Scenario normalization did not leave one new clean task commit.",
          decision.evidence,
        );
      }
      const afterNormalization = scenarioNormalizationInvariant(
        workspaceDir,
        normalizationInput,
      );
      if (afterNormalization?.stillListed) {
        return ownerResult(
          ctx,
          "Scenario normalization commit still fails the exact strict inventory invariant.",
          [
            ...decision.evidence,
            `normalization-path:${afterNormalization.path}`,
          ],
        );
      }
    }

    const existingPr = (
      await pullRequests(repoDir, sourceBranch, targetBranch)
    )[0];
    const matchingRunsBeforeTargetAdvance = matchingTaskRuns(
      await taskRuns(repoDir, contextDir, sourceBranch),
      {
        taskId,
        generation,
        specId,
        sourceCommit,
        target: liveTarget,
        standaloneBuildId,
      },
    );
    if (
      shouldFastForwardIntegratedSource({
        existingPullRequest: Boolean(existingPr),
        sourceCommit,
        baseCommit,
        sourceIsAncestorOfTarget:
          git(
            repoDir,
            ["merge-base", "--is-ancestor", sourceCommit, targetRef],
            true,
          ).status === 0,
        matchingRunCount: matchingRunsBeforeTargetAdvance.length,
      })
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

    let runs = matchingTaskRuns(
      await taskRuns(repoDir, contextDir, sourceBranch),
      {
        taskId,
        generation,
        specId,
        sourceCommit,
        target: liveTarget,
        standaloneBuildId,
      },
    );
    let latestRun = runs[0];

    const sourceDiffersFromBase = sourceCommit !== baseCommit;
    if (
      shouldReviewBeforeInitialLiveDispatch({
        hasExactRun: Boolean(latestRun),
        branchHasChange: sourceDiffersFromBase,
        reviewedScenarioPatch: options.reviewedScenarioPatch,
      })
    ) {
      const preparationPrompt = [
        `Reconcile ${specId} for one exact live verification/change lifecycle.`,
        `The required live target is ${liveTarget}${standaloneBuildId ? ` with standalone_build_id=${standaloneBuildId}` : ""}.`,
        exactLiveTargetInstruction(liveTarget, standaloneBuildId),
        ...(priorVerificationSummary ? [priorVerificationSummary] : []),
        `Work only in ${workspaceDir}; durable non-source artifacts belong in ${contextDir}.`,
        `Current integration authority is ${targetRef}@${baseCommit}.`,
        sourceDiffersFromBase
          ? `Current task source ${sourceCommit} already differs from integration authority after an earlier repair. Treat that commit as evidence to review, not automatic permission to dispatch.`
          : `Current task source ${sourceCommit} still matches integration authority.`,
        "Inspect the original task, current spec status, model, direct carrier, nearby good/bad examples, and prior evidence. Decide whether this exact source is genuinely ready for live execution.",
        "If a bounded repo change is needed, make it, run scoped local checks, commit it, leave the worktree clean, and return decision=committed.",
        "If current source is already the exact content that should be live-tested, leave it unchanged and return decision=test-current.",
        "For committed or test-current, separately set liveReady=true only when this exact source may be sent to ADO now. If source is prepared but an external fact still prevents execution, set liveReady=false and include one exact observable Condition. If this app cannot observe the required fact, return needs-owner instead. Never treat a commit as permission to run.",
        ...(options.existingRecoveryAfterRunId
          ? [
              `This is recovery work for blocking run ${options.existingRecoveryAfterRunId}. If a later current-main run already passed this exact spec and still applies to current main, leave source unchanged and return decision=accepted-pass. Populate recovery={pipelineRunId,sourceBranch,sourceCommit,artifactPath} with the aggregate result artifact that contains this spec verdict, and cite ancestry/relevant-change evidence. Do not dispatch redundant proof.`,
            ]
          : []),
        "A blocked spec, reviewed exception, or intentionally paused execution path is not live-ready merely because its file layout is normalized. Implement a truthful observable contract, return an exact wait, or identify the genuine ownership boundary.",
        "Do not queue ADO, create a PR, create another branch/worktree, or edit app task state; this workflow owns those steps.",
        "Use waiting only with one exact machine-observable Condition. Use needs-owner only for a concrete decision that source facts cannot resolve.",
        "Task:",
        ctx.task,
      ].join("\n\n");
      let decision = await askAgent(ctx, preparationPrompt, {
        scenarioNormalization: Boolean(normalizationInput),
        continueDomainWorkOnValidation: true,
        validateDecision: (candidate) =>
          preparationDecisionProblem(
            candidate,
            Boolean(options.existingRecoveryAfterRunId),
          ),
      });
      if (decision.decision === "waiting" && decision.condition) {
        return waitingResult(
          ctx,
          decision.summary,
          decision.evidence,
          taskScopedAgentCondition(taskId, generation, decision.condition),
        );
      }
      if (decision.decision === "needs-owner") {
        return ownerResult(ctx, decision.summary, decision.evidence);
      }
      let after = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      if (cleanWorkspace(workspaceDir)) {
        return ownerResult(
          ctx,
          "Agent preparation left the task worktree dirty; deterministic dispatch was refused.",
          [...decision.evidence, `workspace:${workspaceDir}`],
        );
      }
      const unchangedCommitProblem = preparationHeadProblem({
        decision,
        before: sourceCommit,
        after,
      });
      if (unchangedCommitProblem) {
        const correctionBaseline = after;
        decision = await askAgent(
          ctx,
          [
            preparationPrompt,
            "The preceding domain judgment returned decision=committed, but repository inspection proves task HEAD did not move during that judgment.",
            `Current clean task HEAD is ${correctionBaseline}. Inspect that exact source before deciding again.`,
            "Return test-current when this existing commit is the intended source. Return committed only after leaving a genuinely newer clean commit. For either source decision, set liveReady explicitly; false requires one exact observable Condition. Return needs-owner when no app-observable condition can represent the boundary.",
          ].join("\n\n"),
          {
            scenarioNormalization: Boolean(normalizationInput),
            continueDomainWorkOnValidation: true,
            validateDecision: (candidate) =>
              preparationDecisionProblem(
                candidate,
                Boolean(options.existingRecoveryAfterRunId),
              ) ??
              preparationHeadProblem({
                decision: candidate,
                before: correctionBaseline,
                after: git(workspaceDir, ["rev-parse", "HEAD"]).stdout,
              }),
          },
        );
        if (decision.decision === "waiting" && decision.condition) {
          return waitingResult(
            ctx,
            decision.summary,
            decision.evidence,
            taskScopedAgentCondition(taskId, generation, decision.condition),
          );
        }
        if (decision.decision === "needs-owner") {
          return ownerResult(ctx, decision.summary, decision.evidence);
        }
        after = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        if (cleanWorkspace(workspaceDir)) {
          return ownerResult(
            ctx,
            "Agent preparation correction left the task worktree dirty; deterministic dispatch was refused.",
            [...decision.evidence, `workspace:${workspaceDir}`],
          );
        }
      }
      if (
        decision.decision === "accepted-pass" &&
        options.existingRecoveryAfterRunId
      ) {
        const recovery = decision.recovery;
        const providerRun = recovery
          ? await getPipelineRun(repoDir, recovery.pipelineRunId)
          : null;
        const artifactPath = recovery ? resolve(recovery.artifactPath) : "";
        const watcherRoot = recovery
          ? resolve(
              ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
              ".state",
              "watchers",
              "aks-pipeline-artifacts",
              recovery.pipelineRunId,
            )
          : "";
        const diff = recovery
          ? git(
              repoDir,
              [
                "diff",
                "--name-only",
                `${recovery.sourceCommit}..${baseCommit}`,
                "--",
              ],
              true,
            )
          : null;
        const changedFiles =
          diff && diff.status === 0
            ? diff.stdout
                .split(/\r?\n/)
                .map((value) => value.trim())
                .filter(Boolean)
            : null;
        const problem = existingRecoveryProblem({
          baselineRunId: options.existingRecoveryAfterRunId,
          specId,
          currentMainCommit: baseCommit,
          recovery,
          providerRun,
          sourceIsAncestor: Boolean(
            recovery &&
            git(
              repoDir,
              ["merge-base", "--is-ancestor", recovery.sourceCommit, targetRef],
              true,
            ).status === 0,
          ),
          changedFiles,
          artifactInWatcherRoot: Boolean(
            artifactPath &&
            watcherRoot &&
            (artifactPath === watcherRoot ||
              artifactPath.startsWith(`${watcherRoot}${sep}`)),
          ),
          artifactProvesPass: Boolean(
            artifactPath && artifactProvesSpecPass(artifactPath, specId),
          ),
        });
        if (problem) {
          return ownerResult(
            ctx,
            `Existing recovery proof was rejected: ${problem}.`,
            decision.evidence,
          );
        }
        return ctx.done(decision.summary, {
          state: "existing-recovery",
          summary: decision.summary,
          evidence: decision.evidence,
          recovery,
          actions: [],
        });
      }
      if (
        ["committed", "test-current"].includes(decision.decision) &&
        decision.liveReady === false &&
        decision.condition
      ) {
        return waitingResult(
          ctx,
          decision.summary,
          [...decision.evidence, `source-commit:${after}`],
          taskScopedAgentCondition(taskId, generation, decision.condition),
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

    if (!latestRun) {
      const dispatch = await prepareLiveDispatch(
        sourceCommit,
        "initial exact live verification",
      );
      if (dispatch.state === "result") return dispatch.result;
      sourceCommit = dispatch.sourceCommit;
      const publication = await publishTaskBranch(
        sourceCommit,
        "initial exact live verification",
      );
      if (publication.state === "result") return publication.result;
      sourceCommit = publication.sourceCommit;
      const queued = await queueFreshRun(sourceCommit);
      if (queued.state === "result") return queued.result;
      latestRun = queued.run;
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
          ...dispatch.evidence,
          ...publication.evidence,
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
      (proof.standaloneBuildId || "") !== standaloneBuildId ||
      (Boolean(normalizationInput) && proof.runResult !== "succeeded")
    ) {
      const failedRunsForCommit = runs.filter(
        (run) =>
          pipelineRunState(run) === "completed" &&
          !["succeeded", "partiallySucceeded"].includes(
            nonEmptyString(run.result),
          ),
      ).length;
      const runContextDir = terminalRunContextDir(contextDir, runId);
      const collectedRunEvidence = await collectTerminalRunEvidence(
        repoDir,
        runContextDir,
        runId,
        latestRun,
      );
      const decision = await askAgent(
        ctx,
        [
          `Review terminal Azure DevOps run ${runId} for ${specId}.`,
          `The exact source is ${sourceBranch}@${sourceCommit}; provider result is ${runResult}.`,
          `The exact live target is ${liveTarget}${standaloneBuildId ? ` with standalone_build_id=${standaloneBuildId}` : ""}.`,
          exactLiveTargetInstruction(liveTarget, standaloneBuildId),
          `Workflow code collected authenticated run evidence in ${runContextDir}. Run metadata: ${collectedRunEvidence.runPath}. Artifact list: ${collectedRunEvidence.artifactListPath}. Downloaded artifact directories: ${collectedRunEvidence.artifactPaths.join(", ") || "none"}. Collection errors: ${collectedRunEvidence.errors.join(" | ") || "none"}.`,
          `Use ${runContextDir} exclusively for diagnosis for this run. Do not reuse task-root or earlier-run evidence, do not scrape Azure DevOps web pages, and do not write runtime artifacts into tracked source paths.`,
          "Inspect run metadata, plan inputs, per-spec result, live resource identity, assertions, and cleanup proof. The aggregate provider result alone is not a spec verdict.",
          "Return accepted-pass only for exact same-spec live proof on this source commit.",
          "A source-only check or admission refusal is diagnostic evidence, not completion. Implement an observable live negative test when the API contract permits it; otherwise return an exact external wait or a genuine ownership-boundary decision.",
          "For a carrier/spec defect, make the smallest fix in the task worktree, run scoped local checks, commit, leave the worktree clean, and return committed.",
          "When returning committed, separately set liveReady=true only if the repaired exact source may be sent to ADO now. If an external fact still prevents execution, set liveReady=false with one exact observable Condition; use needs-owner when the app cannot observe that boundary. A commit alone is not permission to rerun.",
          failedRunsForCommit >= 2
            ? "The same source commit already has at least two terminal nonpassing runs. Do not request another unchanged retry; commit a fix, return an exact wait, or request owner judgment."
            : "Use retry-transient only when artifacts prove a transient provider/environment failure and an unchanged retry is truthful.",
          "Do not create a successor task, queue ADO, create/complete a PR, or edit app task state.",
          "Task:",
          ctx.task,
        ].join("\n\n"),
        {
          scenarioNormalization: Boolean(normalizationInput),
          continueDomainWorkOnValidation: true,
          validateDecision: (candidate) =>
            terminalRunDecisionProblem(candidate, {
              requireSucceededProvider: Boolean(normalizationInput),
              providerResult: runResult,
            }),
        },
      );
      if (decision.decision === "waiting" && decision.condition) {
        return waitingResult(
          ctx,
          decision.summary,
          decision.evidence,
          taskScopedAgentCondition(taskId, generation, decision.condition),
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
        const retrySourceCommit = sourceCommit;
        const dispatch = await prepareLiveDispatch(
          sourceCommit,
          `diagnosed transient retry after run ${runId}`,
        );
        if (dispatch.state === "result") return dispatch.result;
        sourceCommit = dispatch.sourceCommit;
        const unchangedRetry = sourceCommit === retrySourceCommit;
        let publicationEvidence: string[] = [];
        if (!unchangedRetry) {
          const publication = await publishTaskBranch(
            sourceCommit,
            `replacement after transient run ${runId}`,
          );
          if (publication.state === "result") return publication.result;
          sourceCommit = publication.sourceCommit;
          publicationEvidence = publication.evidence;
        }
        const queued = await queueFreshRun(
          sourceCommit,
          unchangedRetry ? runId : undefined,
        );
        if (queued.state === "result") return queued.result;
        const retry = queued.run;
        saveRunReceipt(contextDir, retry, sourceCommit);
        const retryId = nonEmptyString(retry.id);
        return waitingResult(
          ctx,
          unchangedRetry
            ? `Queued one diagnosed transient retry ${retryId} for ${specId} at unchanged commit ${sourceCommit}.`
            : `Local dispatch admission required a repair before retry; queued replacement run ${retryId} for ${specId} at ${sourceCommit}.`,
          [
            ...decision.evidence,
            ...dispatch.evidence,
            ...publicationEvidence,
            ...(unchangedRetry ? [`retry-of-run:${runId}`] : []),
            `pipeline-run:${retryId}`,
            `source-commit:${sourceCommit}`,
          ],
          pipelineWaitCondition(retryId),
        );
      }
      if (decision.decision === "committed") {
        let nextCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        if (nextCommit === sourceCommit || cleanWorkspace(workspaceDir)) {
          return ownerResult(
            ctx,
            "Agent reported a fix but did not leave one new clean task commit.",
            decision.evidence,
          );
        }
        if (decision.liveReady === false && decision.condition) {
          return waitingResult(
            ctx,
            decision.summary,
            [...decision.evidence, `source-commit:${nextCommit}`],
            taskScopedAgentCondition(taskId, generation, decision.condition),
          );
        }
        const dispatch = await prepareLiveDispatch(
          nextCommit,
          `replacement after terminal run ${runId}`,
        );
        if (dispatch.state === "result") return dispatch.result;
        nextCommit = dispatch.sourceCommit;
        const publication = await publishTaskBranch(
          nextCommit,
          `replacement after terminal run ${runId}`,
        );
        if (publication.state === "result") return publication.result;
        nextCommit = publication.sourceCommit;
        const queued = await queueFreshRun(nextCommit);
        if (queued.state === "result") return queued.result;
        const nextRun = queued.run;
        saveRunReceipt(contextDir, nextRun, nextCommit);
        const nextRunId = nonEmptyString(nextRun.id);
        return waitingResult(
          ctx,
          `Committed a fix for run ${runId} and queued exact replacement run ${nextRunId} at ${nextCommit}.`,
          [
            ...decision.evidence,
            ...dispatch.evidence,
            ...publication.evidence,
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
        const sourceIsInTarget =
          git(
            repoDir,
            ["merge-base", "--is-ancestor", sourceCommit, targetRef],
            true,
          ).status === 0;
        const targetIsInSource =
          git(
            workspaceDir,
            ["merge-base", "--is-ancestor", targetRef, "HEAD"],
            true,
          ).status === 0;
        const integrationAction = directIntegrationAction({
          sourceIsInTarget,
          targetIsInSource,
        });
        if (integrationAction === "converged") {
          integratedCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
          break;
        }

        if (integrationAction === "reverify-updated-source") {
          if (normalizationInput?.loopId === "scenario-normalization") {
            const mergeBase = git(
              repoDir,
              ["merge-base", sourceCommit, targetRef],
              true,
            );
            const sourcePathResult =
              mergeBase.status === 0
                ? git(
                    repoDir,
                    [
                      "diff",
                      "--name-only",
                      mergeBase.stdout,
                      sourceCommit,
                      "--",
                    ],
                    true,
                  )
                : null;
            const targetPathResult =
              mergeBase.status === 0
                ? git(
                    repoDir,
                    ["diff", "--name-only", mergeBase.stdout, targetRef, "--"],
                    true,
                  )
                : null;
            const sourcePaths =
              sourcePathResult?.status === 0
                ? sourcePathResult.stdout.split(/\r?\n/).filter(Boolean)
                : [];
            const targetPaths =
              targetPathResult?.status === 0
                ? targetPathResult.stdout.split(/\r?\n/).filter(Boolean)
                : [];
            const proofPreserving = proofPreservingScenarioIntegration({
              sourcePaths,
              targetPaths,
            });
            if (proofPreserving) {
              const merge = git(
                workspaceDir,
                ["merge", "--no-ff", "--no-commit", targetRef],
                true,
              );
              if (merge.status === 0) {
                const protectedSourcePaths =
                  proofProtectedScenarioPaths(sourcePaths);
                const changedTestedPath = protectedSourcePaths.length
                  ? git(
                      workspaceDir,
                      [
                        "diff",
                        "--quiet",
                        sourceCommit,
                        "--",
                        ...protectedSourcePaths,
                      ],
                      true,
                    ).status
                  : 0;
                if (changedTestedPath === 0) {
                  const mergeCommit = git(
                    workspaceDir,
                    ["commit", "--no-edit"],
                    true,
                  );
                  if (mergeCommit.status === 0) {
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
                        [
                          "merge-base",
                          "--is-ancestor",
                          sourceCommit,
                          targetRef,
                        ],
                        true,
                      ).status === 0
                    ) {
                      integratedCommit = git(repoDir, [
                        "rev-parse",
                        targetRef,
                      ]).stdout;
                      break;
                    }
                    continue;
                  }
                }
              }
              git(workspaceDir, ["merge", "--abort"], true);
            }

            const beforeRefresh = git(workspaceDir, [
              "rev-parse",
              "HEAD",
            ]).stdout;
            const refresh = git(
              workspaceDir,
              ["merge", "--no-ff", "--no-edit", targetRef],
              true,
            );
            let refreshEvidence: string[] = [];
            if (refresh.status !== 0) {
              const decision = await askAgent(
                ctx,
                [
                  `${specId} passed exact live run ${runId} at ${sourceCommit}, but current ${targetRef} contains changes that invalidate that proof or conflict with the task branch.`,
                  `Resolve only the current merge in ${workspaceDir}, preserve the scenario-normalization intent, run scoped checks plus the strict scenario inventory, commit the resolved source, leave the worktree clean, and return decision=committed.`,
                  "Do not push, queue ADO, create a PR, create another task, or edit app state. The workflow will push the refreshed task branch and require a new exact live run before integration.",
                  "Task:",
                  ctx.task,
                ].join("\n\n"),
                { scenarioNormalization: true },
              );
              if (decision.decision !== "committed") {
                return ownerResult(ctx, decision.summary, decision.evidence);
              }
              refreshEvidence = decision.evidence;
            }

            let refreshedCommit = git(workspaceDir, [
              "rev-parse",
              "HEAD",
            ]).stdout;
            if (
              refreshedCommit === beforeRefresh ||
              cleanWorkspace(workspaceDir)
            ) {
              return ownerResult(
                ctx,
                `Refreshing the scenario-normalization candidate from current ${targetBranch} did not leave one new clean commit.`,
                refreshEvidence,
              );
            }
            const dispatch = await prepareLiveDispatch(
              refreshedCommit,
              `replacement after current ${targetBranch} invalidated run ${runId}`,
            );
            if (dispatch.state === "result") return dispatch.result;
            refreshedCommit = dispatch.sourceCommit;
            const publication = await publishTaskBranch(
              refreshedCommit,
              `replacement after current ${targetBranch} invalidated run ${runId}`,
            );
            if (publication.state === "result") return publication.result;
            refreshedCommit = publication.sourceCommit;
            const queued = await queueFreshRun(refreshedCommit);
            if (queued.state === "result") return queued.result;
            const replacement = queued.run;
            saveRunReceipt(contextDir, replacement, refreshedCommit);
            const replacementId = nonEmptyString(replacement.id);
            return waitingResult(
              ctx,
              `Current ${targetBranch} invalidated the prior live proof; refreshed the scenario candidate and queued replacement run ${replacementId} at ${refreshedCommit}.`,
              [
                ...refreshEvidence,
                ...dispatch.evidence,
                ...publication.evidence,
                `replaces-run:${runId}`,
                `source-commit:${refreshedCommit}`,
                `pipeline-run:${replacementId}`,
                `target-ref:${targetRef}`,
              ],
              pipelineWaitCondition(replacementId),
            );
          }
          const beforeMerge = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
          const merge = git(
            workspaceDir,
            ["merge", "--no-ff", "--no-edit", targetRef],
            true,
          );
          let mergeEvidence: string[] = [];
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
              { scenarioNormalization: false },
            );
            if (decision.decision !== "committed") {
              return ownerResult(ctx, decision.summary, decision.evidence);
            }
            mergeEvidence = decision.evidence;
          }

          let updatedCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
          if (updatedCommit === beforeMerge || cleanWorkspace(workspaceDir)) {
            return ownerResult(
              ctx,
              `Direct ${targetBranch} update did not leave one new clean commit.`,
              mergeEvidence,
            );
          }
          const dispatch = await prepareLiveDispatch(
            updatedCommit,
            `replacement after current ${targetBranch} changed following run ${runId}`,
          );
          if (dispatch.state === "result") return dispatch.result;
          updatedCommit = dispatch.sourceCommit;
          const publication = await publishTaskBranch(
            updatedCommit,
            `replacement after current ${targetBranch} changed following run ${runId}`,
          );
          if (publication.state === "result") return publication.result;
          updatedCommit = publication.sourceCommit;
          const queued = await queueFreshRun(updatedCommit);
          if (queued.state === "result") return queued.result;
          const replacement = queued.run;
          saveRunReceipt(contextDir, replacement, updatedCommit);
          const replacementId = nonEmptyString(replacement.id);
          return waitingResult(
            ctx,
            `Updated the direct ${targetBranch} candidate and queued replacement live run ${replacementId} at ${updatedCommit}.`,
            [
              ...mergeEvidence,
              ...dispatch.evidence,
              ...publication.evidence,
              `replaces-run:${runId}`,
              `source-commit:${updatedCommit}`,
              `pipeline-run:${replacementId}`,
              `target-ref:${targetRef}`,
            ],
            pipelineWaitCondition(replacementId),
          );
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
          ? await abandonPullRequest(repoDir, existingPrId)
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

    let pr = (await pullRequests(repoDir, sourceBranch, targetBranch))[0];
    if (!pr) {
      pr = await createPullRequest(repoDir, {
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
    const mergedCommit = nonEmptyString(pr.lastMergeCommit?.commitId);

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
      const integration = completedPullRequestIntegration({
        mergeStatus,
        testedSourceCommit: sourceCommit,
        mergedSourceCommit: prSourceCommit,
        mergeCommit: mergedCommit,
      });
      if (
        integration.status === "unproven" &&
        integration.reason === "merge-not-succeeded"
      ) {
        return ownerResult(
          ctx,
          `PR ${prId} is completed but mergeStatus=${mergeStatus}; integration cannot be proven.`,
          [`pull-request:${prId}`, `merge-status:${mergeStatus}`],
        );
      }
      if (
        integration.status === "unproven" &&
        integration.reason === "source-mismatch"
      ) {
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
      if (integration.status === "unproven") {
        return ownerResult(
          ctx,
          `PR ${prId} completed without an identifiable merged revision; integration cannot be proven.`,
          [
            `pull-request:${prId}`,
            `tested-source-commit:${sourceCommit}`,
            "merged-commit:missing",
          ],
        );
      }
      git(repoDir, ["fetch", "origin", targetBranch]);
      if (
        git(
          repoDir,
          ["merge-base", "--is-ancestor", integration.targetCommit, targetRef],
          true,
        ).status !== 0
      ) {
        return ownerResult(
          ctx,
          `PR ${prId} reports merged revision ${integration.targetCommit}, but that revision is not present in ${targetRef}.`,
          [
            `pull-request:${prId}`,
            `tested-source-commit:${sourceCommit}`,
            `merged-commit:${integration.targetCommit}`,
            `target-ref:${targetRef}`,
          ],
        );
      }
      proof = {
        ...proof,
        pullRequestId: prId,
        targetRef,
        mergedCommit: integration.targetCommit,
      };
      saveProof(contextDir, proof);
      const summary = `${specId} passed run ${runId} at ${sourceCommit} and PR ${prId} integrated that tested source as ${integration.targetCommit} into ${targetBranch}.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          ...proof.evidence,
          `proof:${proofPath(contextDir)}`,
          `pipeline-run:${runId}`,
          `pull-request:${prId}`,
          `source-commit:${sourceCommit}`,
          `merged-commit:${integration.targetCommit}`,
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
        { scenarioNormalization: Boolean(normalizationInput) },
      );
      if (decision.decision !== "committed") {
        return ownerResult(ctx, decision.summary, decision.evidence);
      }
      let resolvedCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      if (resolvedCommit === sourceCommit || cleanWorkspace(workspaceDir)) {
        return ownerResult(
          ctx,
          `PR ${prId} conflict repair did not leave one new clean commit.`,
          decision.evidence,
        );
      }
      const dispatch = await prepareLiveDispatch(
        resolvedCommit,
        `replacement after PR ${prId} integration conflict`,
      );
      if (dispatch.state === "result") return dispatch.result;
      resolvedCommit = dispatch.sourceCommit;
      const publication = await publishTaskBranch(
        resolvedCommit,
        `replacement after PR ${prId} integration conflict`,
      );
      if (publication.state === "result") return publication.result;
      resolvedCommit = publication.sourceCommit;
      const queued = await queueFreshRun(resolvedCommit);
      if (queued.state === "result") return queued.result;
      const replacement = queued.run;
      saveRunReceipt(contextDir, replacement, resolvedCommit);
      const replacementId = nonEmptyString(replacement.id);
      return waitingResult(
        ctx,
        `Resolved PR ${prId} conflict and queued replacement live run ${replacementId} at ${resolvedCommit}.`,
        [
          ...decision.evidence,
          ...dispatch.evidence,
          ...publication.evidence,
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

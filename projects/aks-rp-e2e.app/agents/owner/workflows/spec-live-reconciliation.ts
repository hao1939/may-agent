import { createHash } from "node:crypto";
import { execFile, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import {
  Type,
  isTypedProjectAppConditionSubject,
  workflowResultVersion,
  type ProjectAppTaskHandlerResult,
  type ProjectAppTaskVerificationContext,
  type ProjectAppTaskVerificationResult,
  type ProjectAppConditionSpec,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  scenarioNormalizationInvariant,
  scenarioNormalizationSpecIds,
  specTerminalDispositionCheck,
  specTerminalTargetCheck,
  type ScenarioNormalizationInput,
  type SpecTerminalDisposition,
} from "./lib/scenario-normalization-invariant.js";
import { integrateDirectlyIntoDev } from "./lib/direct-dev-integration.js";

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
const stagingSubscriptionId = "26fe00f8-9173-4872-9134-bb1d2e00343a";
const stagingLocation = "westus2";
export const terminalDispositionSourceRepairInstruction =
  "If exact evidence supports a reviewed terminal posture, keep that judgment in this domain workflow. When the spec still carries a stale ready/pass posture, update its structured status, specState, statusReason, and latest-live-result evidence from the exact facts, add any needed durable source memo, run scoped checks, commit the bounded change, and return decision=terminal-disposition with terminalDisposition={specId,status,specState}. For scenario normalization, changing the spec to blocked/environment-blocked because no unchanged live run is currently truthful is a terminal disposition for this source iteration, even when a separate approval or environment change may reopen product testing later. Do not return committed with liveReady=false merely to keep that truthful normalized source off dev; terminal here means the current source posture is complete and reviewable, not that the feature is abandoned forever. A terminal disposition is neither live readiness nor a wait: omit liveReady and condition entirely. Preserve the resolved live target in statusReason, nextAction, resumeCondition, and every active approval/wait/path identifier; never bind a staging disposition to a stale identifier for another subscription or region. Do not return needs-owner merely because recording the terminal product gap requires this source update. Compact package status, compact-plan eligibility, a sibling compact task, or an arbitrary origin/dev advance is context, not an external prerequisite for this same-spec normalization; do not wait on any of them. An exact external wait must name the actual unavailable capability or authority, its real producer, and the observable fact that lets this same source continue. Use needs-owner only when the evidence cannot support the domain judgment or a real external authority must decide it. The workflow will validate and integrate the committed terminal source without claiming a failed run as a pass.";
export const acceptedLiveProofSourceInstruction =
  "When this exact run proves the current source passes and hard live-proof validation found no structural gap, return accepted-pass without editing or committing tracked source. A checked-in ready posture, an older accepted run, or missing latestLiveResult fields is not a model defect at this point: the app projects the newly accepted proof after the task receipt is persisted. Do not rewrite the spec, model, generated views, test assertions, sourceVersion, observedAt, statusReason, nextAction, resumeCondition, evidence memo, or equivalent bookkeeping merely to record this successful run. Return committed only when the run exposes an actual behavior or contract defect that requires changed source and a fresh exact run, and cite that defect. When the run reports test_not_implemented or partial live coverage, changing only diagnostics, messages, metadata, or static checks is not a runnable repair: implement the missing live behavior before setting liveReady=true, or return the truthful terminal disposition, exact external wait, or ownership escalation.";
export const directVitestCompatibilityInstruction =
  "ADO loads a direct scenario .test.ts carrier through Vitest without guaranteeing the Bun runtime global. Validate a new or repaired direct carrier on the Vitest collection/runtime surface, not only with `bun test`; import test APIs from `vitest`, never `bun:test`; and replace runtime uses such as `Bun.spawn`, `Bun.spawnSync`, and `Bun.file` with portable Node APIs. A Bun-only passing test is not live-ready evidence. Run the normal `bun run spec <spec-id> --check` path with the task target so the runner wires exact target inputs; if a direct Vitest check also needs target inputs, read them from that exact runner target configuration. Never fabricate subscription, region, API version, Kubernetes version, or VM-size placeholders as check evidence.";
export const exactStrictInventoryInstruction =
  "The repository-wide strict inventory is expected to exit nonzero while other rows remain. Capture and parse its JSON anyway; this leaf is clear only when its exact legacy path is absent from both guard.remainingSpecReferencedPlainScenarioUnits and guard.remainingRepoPlainScenarioFiles.";
export const currentAdoSurfaceInstruction =
  "Do not treat uncertainty about a secret or variable on the current ADO execution surface as proof of a blocker. Missing-input evidence from an older backend, different source commit, or different target is context only. When hard admission checks pass and no exact current-surface observation proves the input unavailable, set liveReady=true so this workflow can dispatch the bounded run and collect the current fact. Use a wait or needs-owner only after exact current evidence identifies the unavailable input, its producer, and the observable resume condition.";
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
      "input.retryPipelineRunId",
      "input.retrySourceBranch",
      "input.retrySourceCommit",
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
  definition?: { id?: unknown };
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
    | "terminal-disposition"
    | "waiting"
    | "needs-owner";
  summary: string;
  evidence: string[];
  liveReady?: boolean;
  terminalDisposition?: SpecTerminalDisposition;
  condition?: ProjectAppConditionSpec;
  recovery?: {
    pipelineRunId: string;
    sourceBranch: string;
    sourceCommit: string;
    artifactPath: string;
  };
};

export type ReviewedRunProof = {
  version: 1;
  taskId: string;
  generation: number;
  providerGeneration?: number;
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
  if (decision.decision === "terminal-disposition") {
    return null;
  }
  if (decision.decision === "accepted-pass" && allowExistingRecovery) {
    return null;
  }
  return allowExistingRecovery
    ? "preparation must return committed, test-current, accepted-pass with exact recovery proof, waiting, or needs-owner"
    : "preparation cannot accept a prior run as proof for the rewritten source; return test-current to dispatch it, commit a repair, wait on an exact fact, or identify a genuine ownership boundary";
}

export function terminalDispositionDecisionProblem(
  decision: AgentDecision,
): string | null {
  if (decision.decision !== "terminal-disposition") return null;
  if (!decision.terminalDisposition) {
    return "terminal-disposition requires structured specId, status, and specState";
  }
  if (decision.liveReady !== undefined || decision.condition !== undefined) {
    return "terminal-disposition is neither live readiness nor a wait; omit liveReady and condition";
  }
  return null;
}

export function shouldReplayReviewedTerminalWriteback(input: {
  sourceProblem: string | null;
  reviewedWritebackCommit: string;
  scenarioNormalization: boolean;
}): boolean {
  if (
    input.scenarioNormalization ||
    !input.reviewedWritebackCommit ||
    !input.sourceProblem
  ) {
    return false;
  }
  return (
    input.sourceProblem.includes("does not match structured source fields") ||
    input.sourceProblem.includes("is missing from the normalized source")
  );
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

export type ScenarioDispatchReplayResult =
  | {
      state: "ready";
      sourceCommit: string;
      targetCommit: string;
      expectedRemoteCommit: string | null;
      taskCommits: string[];
      evidence: string[];
      replayed: boolean;
    }
  | {
      state: "conflict";
      targetCommit: string;
      expectedRemoteCommit: string | null;
      taskCommits: string[];
      evidence: string[];
      error: string;
    }
  | { state: "error"; evidence: string[]; error: string };

export function replayScenarioCandidateForDispatch(input: {
  workspaceDir: string;
  sourceBranch: string;
  candidateCommit: string;
  targetRef: string;
}): ScenarioDispatchReplayResult {
  const { workspaceDir, sourceBranch, candidateCommit, targetRef } = input;
  if (!sourceBranch.startsWith("task/")) {
    return {
      state: "error",
      error: "dispatch replay may update only a dedicated task branch",
      evidence: [`source-branch:${sourceBranch}`],
    };
  }

  const currentHead = git(workspaceDir, ["rev-parse", "HEAD"], true);
  if (currentHead.status !== 0 || currentHead.stdout !== candidateCommit) {
    return {
      state: "error",
      error: "dispatch replay candidate is not the task worktree HEAD",
      evidence: [
        `source-commit:${candidateCommit}`,
        `workspace-head:${currentHead.stdout || "unresolved"}`,
      ],
    };
  }
  if (cleanWorkspace(workspaceDir)) {
    return {
      state: "error",
      error: "dispatch replay requires a clean task worktree",
      evidence: [`workspace:${workspaceDir}`],
    };
  }

  const target = git(workspaceDir, ["rev-parse", targetRef], true);
  if (target.status !== 0 || !target.stdout) {
    return {
      state: "error",
      error: `dispatch replay could not resolve ${targetRef}`,
      evidence: [`target-ref:${targetRef}`],
    };
  }
  const targetCommit = target.stdout;
  const expectedRemoteCommit = remoteLeaseCommit(
    git(
      workspaceDir,
      ["ls-remote", "--exit-code", "origin", `refs/heads/${sourceBranch}`],
      true,
    ),
  );
  if (
    git(
      workspaceDir,
      ["merge-base", "--is-ancestor", targetCommit, candidateCommit],
      true,
    ).status === 0
  ) {
    return {
      state: "ready",
      sourceCommit: candidateCommit,
      targetCommit,
      expectedRemoteCommit,
      taskCommits: [],
      evidence: [`dispatch-target-current:${targetRef}@${targetCommit}`],
      replayed: false,
    };
  }

  const cherry = git(
    workspaceDir,
    ["cherry", targetRef, candidateCommit],
    true,
  );
  if (cherry.status !== 0) {
    return {
      state: "error",
      error:
        "dispatch replay could not distinguish task patches from current target history",
      evidence: [
        `source-commit:${candidateCommit}`,
        `target-ref:${targetRef}@${targetCommit}`,
        `git-cherry:${cherry.stderr || cherry.stdout || "failed"}`,
      ],
    };
  }
  const taskCommits = novelScenarioReplayCommits(cherry.stdout);
  const evidence = [
    `dispatch-replay-from:${candidateCommit}`,
    `dispatch-replay-target:${targetRef}@${targetCommit}`,
    `dispatch-task-owned-commits:${taskCommits.join(",") || "none"}`,
  ];
  const reset = git(workspaceDir, ["reset", "--hard", targetCommit], true);
  if (reset.status !== 0) {
    return {
      state: "error",
      error: "dispatch replay could not reset to current target",
      evidence: [...evidence, `reset-error:${reset.stderr || reset.stdout}`],
    };
  }
  const replay = taskCommits.length
    ? git(workspaceDir, ["cherry-pick", ...taskCommits], true)
    : { status: 0, stdout: "", stderr: "" };
  if (replay.status !== 0) {
    return {
      state: "conflict",
      targetCommit,
      expectedRemoteCommit,
      taskCommits,
      evidence,
      error: replay.stderr || replay.stdout || "cherry-pick failed",
    };
  }

  const sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
  if (
    cleanWorkspace(workspaceDir) ||
    git(workspaceDir, ["rev-parse", "--verify", "CHERRY_PICK_HEAD"], true)
      .status === 0 ||
    git(
      workspaceDir,
      ["merge-base", "--is-ancestor", targetCommit, sourceCommit],
      true,
    ).status !== 0
  ) {
    return {
      state: "error",
      error: "dispatch replay did not produce one clean target-based lineage",
      evidence: [...evidence, `source-commit:${sourceCommit}`],
    };
  }

  return {
    state: "ready",
    sourceCommit,
    targetCommit,
    expectedRemoteCommit,
    taskCommits,
    evidence: [...evidence, `dispatch-replayed-source:${sourceCommit}`],
    replayed: true,
  };
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

type JsonObject = Record<string, unknown>;

function jsonObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is JsonObject =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]),
  );
}

export function relevantKnowledgeModelProjection(
  model: JsonObject,
  specId: string,
  featurePathIds: string[] = [],
): JsonObject {
  const selectedPathIds = new Set(featurePathIds.filter(Boolean));
  const select = (value: unknown) =>
    jsonObjects(value)
      .filter((entry) => {
        const entrySpecId = nonEmptyString(entry.specId);
        const entryId = nonEmptyString(entry.id);
        return entrySpecId === specId || selectedPathIds.has(entryId);
      })
      .sort((left, right) =>
        nonEmptyString(left.id).localeCompare(nonEmptyString(right.id)),
      )
      .map(canonicalJsonValue);
  return {
    paths: select(model.paths),
    featurePaths: select(model.featurePaths),
  };
}

export function relevantKnowledgeModelUnchanged(input: {
  sourceModel: JsonObject;
  targetModel: JsonObject;
  specId: string;
  featurePathIds?: string[];
}): boolean {
  const source = relevantKnowledgeModelProjection(
    input.sourceModel,
    input.specId,
    input.featurePathIds,
  );
  const target = relevantKnowledgeModelProjection(
    input.targetModel,
    input.specId,
    input.featurePathIds,
  );
  return JSON.stringify(source) === JSON.stringify(target);
}

function proofPreservingTargetPath(
  path: string,
  knowledgeModelStable: boolean,
): boolean {
  if (path === "model/knowledge-map/model.json") {
    return knowledgeModelStable;
  }
  if (path.startsWith("model/knowledge-map/views/")) return true;
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

function proofNeutralScenarioSourcePath(path: string): boolean {
  return (
    path.startsWith("evidence/") ||
    path.startsWith("design/") ||
    path.startsWith("skills/") ||
    path.endsWith(".md")
  );
}

export function proofProtectedScenarioPaths(paths: string[]): string[] {
  return paths.filter(
    (path) =>
      path &&
      !mergeSafeScenarioAggregatePath(path) &&
      !proofNeutralScenarioSourcePath(path),
  );
}

export function proofPreservingScenarioIntegration(input: {
  sourcePaths: string[];
  targetPaths: string[];
  knowledgeModelStable?: boolean;
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
      proofPreservingTargetPath(path, input.knowledgeModelStable === true) &&
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
    Type.Literal("terminal-disposition"),
    Type.Literal("waiting"),
    Type.Literal("needs-owner"),
  ]),
  summary: Type.String({ minLength: 1 }),
  evidence: Type.Array(Type.String({ minLength: 1 })),
  liveReady: Type.Optional(Type.Boolean()),
  terminalDisposition: Type.Optional(
    Type.Object({
      specId: Type.String({ minLength: 1 }),
      status: Type.String({ minLength: 1 }),
      specState: Type.String({ minLength: 1 }),
    }),
  ),
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

export function artifactProvesSpecPass(path: string, specId: string): boolean {
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

export function artifactVitestTestCount(path: string): number | null {
  const artifact = readJsonRecord(path);
  const count = Number(artifact?.numTotalTests);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readJsonRecord(path: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function artifactRecordChain(
  artifact: Record<string, unknown>,
): Record<string, unknown>[] {
  const records = [artifact];
  let current = artifact;
  while (
    current.raw &&
    typeof current.raw === "object" &&
    !Array.isArray(current.raw)
  ) {
    current = current.raw as Record<string, unknown>;
    records.push(current);
  }
  return records;
}

export function artifactObservedClaimIds(
  path: string,
  specId: string,
): string[] {
  const artifact = readJsonRecord(path);
  if (!artifact || nonEmptyString(artifact.specId) !== specId) return [];
  return artifactRecordChain(artifact)
    .flatMap((record) =>
      Array.isArray(record.assertions) ? record.assertions : [],
    )
    .map(jsonRecord)
    .filter((assertion) => assertion.verdictImpact === "claim")
    .map((assertion) => nonEmptyString(assertion.id ?? assertion.name))
    .filter(Boolean)
    .filter((claimId, index, values) => values.indexOf(claimId) === index)
    .sort();
}

export function artifactProvesDeclaredClaims(
  path: string,
  specId: string,
  expectedClaimIds: string[],
): boolean {
  const artifact = readJsonRecord(path);
  if (
    !artifact ||
    expectedClaimIds.length === 0 ||
    nonEmptyString(artifact.specId) !== specId ||
    !["pass", "passed"].includes(nonEmptyString(artifact.status).toLowerCase())
  ) {
    return false;
  }

  const assertions = artifactRecordChain(artifact)
    .flatMap((record) =>
      Array.isArray(record.assertions) ? record.assertions : [],
    )
    .map(jsonRecord);

  return expectedClaimIds.every((claimId) =>
    assertions.some(
      (assertion) =>
        nonEmptyString(assertion.id ?? assertion.name) === claimId &&
        assertion.verdictImpact === "claim" &&
        assertion.ok === true,
    ),
  );
}

export function artifactProvesTarget(
  path: string,
  targetName: string,
): boolean {
  const artifact = readJsonRecord(path);
  if (!artifact) return false;
  const target = jsonRecord(artifact.target);
  if (
    ![nonEmptyString(target.name), nonEmptyString(target.environment)].includes(
      targetName,
    )
  ) {
    return false;
  }
  if (targetName !== defaultLiveTarget) return true;
  return (
    nonEmptyString(target.subscriptionId) === stagingSubscriptionId &&
    nonEmptyString(target.location).toLowerCase() === stagingLocation
  );
}

export function artifactProvesCleanup(path: string, specId: string): boolean {
  const artifact = readJsonRecord(path);
  if (
    !artifact ||
    nonEmptyString(artifact.specId) !== specId ||
    !["pass", "passed"].includes(nonEmptyString(artifact.status).toLowerCase())
  ) {
    return false;
  }
  const records = artifactRecordChain(artifact);
  const cleanupRecords = records.map((record) => jsonRecord(record.cleanup));
  for (const cleanup of cleanupRecords) {
    if (
      cleanup.attempted === true &&
      ["pass", "passed"].includes(nonEmptyString(cleanup.status).toLowerCase())
    ) {
      return true;
    }
  }
  const assertions = records.flatMap((record) =>
    Array.isArray(record.assertions) ? record.assertions : [],
  );
  return assertions.some((entry) => {
    const assertion = jsonRecord(entry);
    return assertion.verdictImpact === "cleanup" && assertion.ok === true;
  });
}

function artifactJsonFiles(roots: string[]): string[] {
  const files: string[] = [];
  const visit = (path: string): void => {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const candidate = join(path, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else if (entry.isFile() && entry.name.endsWith(".json"))
        files.push(candidate);
    }
  };
  for (const root of roots) visit(root);
  return files;
}

function exactSpecIds(value: unknown): string[] {
  return nonEmptyString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
}

export function verifySpecLiveProofFacts(input: {
  taskId: string;
  generation: number;
  specIds: string[];
  target: string;
  standaloneBuildId: string;
  proof: ReviewedRunProof | null;
  run: PipelineRun | null;
  artifactPaths: string[];
  expectedClaimIdsBySpec: Record<string, string[] | null>;
  sourceReachable: boolean;
  integratedCommitReachable: boolean;
  normalizationInvariantSatisfied: boolean;
  expectedVitestTestCount?: number;
  requireIntegration?: boolean;
}): ProjectAppTaskVerificationResult {
  const problems: string[] = [];
  const proof = input.proof;
  const requireIntegration = input.requireIntegration !== false;
  const expectedSpecId = [...input.specIds].sort().join(",");
  if (!proof) {
    problems.push("structured proof.json is missing or invalid");
  } else {
    if (proof.taskId !== input.taskId)
      problems.push("proof task id does not match");
    if (proof.generation !== input.generation)
      problems.push("proof generation does not match");
    if (proof.specId !== expectedSpecId)
      problems.push("proof spec ids do not match");
    if (proof.target !== input.target)
      problems.push("proof target does not match");
    if ((proof.standaloneBuildId || "") !== input.standaloneBuildId) {
      problems.push("proof standalone build does not match");
    }
    if (proof.runResult !== "succeeded")
      problems.push("proof run result is not succeeded");
    if (requireIntegration) {
      if (proof.targetRef !== "origin/dev")
        problems.push("proof target ref is not origin/dev");
      if (!proof.mergedCommit) problems.push("proof has no integrated commit");
    }
  }

  const run = input.run;
  if (!run) {
    problems.push("Azure DevOps run is missing");
  } else if (proof) {
    const parameters = jsonRecord(run.templateParameters);
    const metadata = metadataOf(run);
    const expectedBranch = proof.sourceBranch.startsWith("refs/heads/")
      ? proof.sourceBranch
      : `refs/heads/${proof.sourceBranch}`;
    if (nonEmptyString(run.id) !== proof.runId)
      problems.push("provider run id does not match proof");
    if (pipelineRunState(run) !== "completed")
      problems.push("provider run is not completed");
    if (nonEmptyString(run.result) !== "succeeded")
      problems.push("provider run did not succeed");
    if (nonEmptyString(run.sourceVersion) !== proof.sourceCommit) {
      problems.push("provider run source commit does not match proof");
    }
    if (nonEmptyString(run.sourceBranch) !== expectedBranch) {
      problems.push("provider run source branch does not match proof");
    }
    if (nonEmptyString(run.definition?.id) !== pipelineId) {
      problems.push("provider run is not from pipeline 467665");
    }
    if (exactSpecIds(parameters.specs).join(",") !== expectedSpecId) {
      problems.push("provider run spec ids do not match task");
    }
    if (nonEmptyString(parameters.target) !== input.target) {
      problems.push("provider run target does not match task");
    }
    if (
      nonEmptyString(parameters.standalone_build_id) !== input.standaloneBuildId
    ) {
      problems.push("provider run standalone build does not match task");
    }
    if (nonEmptyString(metadata.taskId) !== input.taskId) {
      problems.push("provider metadata task id does not match");
    }
    if (
      Number(metadata.generation) !==
      (proof.providerGeneration ?? input.generation)
    ) {
      problems.push("provider metadata generation does not match");
    }
    if (nonEmptyString(metadata.specId) !== expectedSpecId) {
      problems.push("provider metadata spec ids do not match");
    }
    if (nonEmptyString(metadata.sourceCommit) !== proof.sourceCommit) {
      problems.push("provider metadata source commit does not match proof");
    }
    if (nonEmptyString(metadata.target) !== input.target) {
      problems.push("provider metadata target does not match task");
    }
  }

  const aggregatePath = input.artifactPaths.find(
    (path) =>
      input.specIds.every((specId) => artifactProvesSpecPass(path, specId)) &&
      artifactProvesTarget(path, input.target),
  );
  if (!aggregatePath) {
    problems.push(
      "downloaded aggregate artifact does not prove exact spec pass and target",
    );
  }
  for (const specId of input.specIds) {
    const expectedClaimIds = input.expectedClaimIdsBySpec[specId];
    if (!expectedClaimIds) {
      problems.push(
        `tested source does not contain the spec contract for ${specId}`,
      );
    } else if (expectedClaimIds.length === 0) {
      problems.push(`tested spec declares no claim assertions for ${specId}`);
    } else if (
      !input.artifactPaths.some((path) =>
        artifactProvesDeclaredClaims(path, specId, expectedClaimIds),
      )
    ) {
      const observedClaimIds = [
        ...new Set(
          input.artifactPaths.flatMap((path) =>
            artifactObservedClaimIds(path, specId),
          ),
        ),
      ].sort();
      problems.push(
        `downloaded artifacts do not prove every declared claim for ${specId}: expected=${expectedClaimIds.join(", ")}; observed=${observedClaimIds.join(", ") || "none"}`,
      );
    }
    if (
      !input.artifactPaths.some((path) => artifactProvesCleanup(path, specId))
    ) {
      problems.push(`downloaded artifacts do not prove cleanup for ${specId}`);
    }
  }
  if (input.expectedVitestTestCount !== undefined) {
    const observedVitestCounts = input.artifactPaths
      .filter((path) => path.endsWith(`${sep}vitest.json`))
      .map(artifactVitestTestCount)
      .filter((count): count is number => count !== null);
    if (
      observedVitestCounts.length !== 1 ||
      observedVitestCounts[0] !== input.expectedVitestTestCount
    ) {
      problems.push(
        `Vitest total test count does not match: expected=${input.expectedVitestTestCount}; observed=${observedVitestCounts.join(",") || "none"}`,
      );
    }
  }
  if (requireIntegration) {
    if (!input.sourceReachable)
      problems.push("tested source is not reachable from current origin/dev");
    if (!input.integratedCommitReachable) {
      problems.push(
        "proof integrated commit is not reachable from current origin/dev",
      );
    }
  }
  if (!input.normalizationInvariantSatisfied) {
    problems.push("scenario normalization invariant is not satisfied");
  }

  return {
    accepted: problems.length === 0,
    summary:
      problems.length === 0
        ? requireIntegration
          ? "Verified exact ADO live proof, cleanup, and origin/dev integration."
          : "Verified exact ADO live proof and cleanup before integration."
        : `Rejected spec live convergence: ${problems.join("; ")}.`,
    evidence:
      problems.length === 0 && proof && aggregatePath
        ? [
            `pipeline-run:${proof.runId}`,
            `source-commit:${proof.sourceCommit}`,
            `aggregate-artifact:${aggregatePath}`,
          ]
        : problems.map((problem) => `verification-finding:${problem}`),
  };
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

function jsonObjectAtCommit(
  repoDir: string,
  commit: string,
  path: string,
): JsonObject | null {
  const result = git(repoDir, ["show", `${commit}:${path}`], true);
  if (result.status !== 0 || !result.stdout) return null;
  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : null;
  } catch {
    return null;
  }
}

function featurePathIdsForSpecAtCommit(
  repoDir: string,
  commit: string,
  specId: string,
): string[] | null {
  const candidates = git(
    repoDir,
    [
      "grep",
      "-l",
      "-F",
      specId,
      commit,
      "--",
      ":(glob)features/*/specs/*.json",
    ],
    true,
  );
  if (candidates.status !== 0 && !candidates.stdout) return null;
  for (const candidate of candidates.stdout.split(/\r?\n/).filter(Boolean)) {
    const marker = `${commit}:`;
    const path = candidate.startsWith(marker)
      ? candidate.slice(marker.length)
      : candidate;
    const spec = jsonObjectAtCommit(repoDir, commit, path);
    if (!spec || nonEmptyString(spec.id) !== specId) continue;
    return Array.isArray(spec.featurePathIds)
      ? spec.featurePathIds.map(nonEmptyString).filter(Boolean)
      : [];
  }
  return null;
}

function claimAssertionIdsForSpecAtCommit(
  repoDir: string,
  commit: string,
  specId: string,
): string[] | null {
  const candidates = git(
    repoDir,
    [
      "grep",
      "-l",
      "-F",
      specId,
      commit,
      "--",
      ":(glob)features/*/specs/*.json",
    ],
    true,
  );
  if (candidates.status !== 0 && !candidates.stdout) return null;
  for (const candidate of candidates.stdout.split(/\r?\n/).filter(Boolean)) {
    const marker = `${commit}:`;
    const path = candidate.startsWith(marker)
      ? candidate.slice(marker.length)
      : candidate;
    const spec = jsonObjectAtCommit(repoDir, commit, path);
    if (!spec || nonEmptyString(spec.id) !== specId) continue;
    const assertions = Array.isArray(spec.assertions)
      ? spec.assertions.map(jsonRecord)
      : [];
    return assertions
      .filter((assertion) => assertion.verdictImpact === "claim")
      .map((assertion) => nonEmptyString(assertion.id ?? assertion.name))
      .filter(Boolean)
      .sort();
  }
  return null;
}

function claimAssertionIdsBySpecAtCommit(
  repoDir: string,
  commit: string,
  specIds: string[],
): Record<string, string[] | null> {
  return Object.fromEntries(
    specIds.map((specId) => [
      specId,
      claimAssertionIdsForSpecAtCommit(repoDir, commit, specId),
    ]),
  );
}

function knowledgeModelStableForSpec(input: {
  repoDir: string;
  sourceCommit: string;
  targetCommit: string;
  specId: string;
}): boolean {
  const modelPath = "model/knowledge-map/model.json";
  const sourceModel = jsonObjectAtCommit(
    input.repoDir,
    input.sourceCommit,
    modelPath,
  );
  const targetModel = jsonObjectAtCommit(
    input.repoDir,
    input.targetCommit,
    modelPath,
  );
  const featurePathIds = featurePathIdsForSpecAtCommit(
    input.repoDir,
    input.sourceCommit,
    input.specId,
  );
  if (!sourceModel || !targetModel || featurePathIds === null) return false;
  return relevantKnowledgeModelUnchanged({
    sourceModel,
    targetModel,
    specId: input.specId,
    featurePathIds,
  });
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
    ["fetch", "origin", `+refs/heads/${sourceBranch}:${remoteRef}`],
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
  )
    .stdout.split(/\r?\n/)
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
    taskId?: string;
    specId: string;
    target: string;
    standaloneBuildId: string;
    sourceBranch?: string;
    sourceCommit?: string;
  },
): boolean {
  const parameters =
    run.templateParameters &&
    typeof run.templateParameters === "object" &&
    !Array.isArray(run.templateParameters)
      ? (run.templateParameters as Record<string, unknown>)
      : {};
  const metadata = metadataOf(run);
  const expectedBranch = input.sourceBranch
    ? input.sourceBranch.startsWith("refs/heads/")
      ? input.sourceBranch
      : `refs/heads/${input.sourceBranch}`
    : "";
  return (
    nonEmptyString(parameters.specs) === input.specId &&
    nonEmptyString(parameters.target) === input.target &&
    nonEmptyString(parameters.standalone_build_id) ===
      input.standaloneBuildId &&
    (!input.taskId || nonEmptyString(metadata.taskId) === input.taskId) &&
    (!expectedBranch || nonEmptyString(run.sourceBranch) === expectedBranch) &&
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

export function taskWorktreeRecoveryDecisionProblem(
  decision: AgentDecision,
): string | null {
  if (
    !["committed", "test-current", "needs-owner"].includes(decision.decision)
  ) {
    return "task worktree recovery must return committed for preserved task work, test-current for removed task residue, or needs-owner for concrete ownership ambiguity; domain disposition is evaluated after recovery";
  }
  if (decision.liveReady !== undefined || decision.condition !== undefined) {
    return "task worktree recovery only restores a clean source state; omit liveReady and condition because domain readiness and dispatch are evaluated after recovery";
  }
  return null;
}

export function terminalLineageReplayDecisionProblem(
  decision: AgentDecision,
): string | null {
  if (decision.decision !== "committed") {
    return "terminal-disposition integration conflict must be resolved inside this same domain workflow";
  }
  if (decision.liveReady !== undefined || decision.condition !== undefined) {
    return "terminal-disposition lineage repair only replays already reviewed source; omit liveReady and condition because the original terminal judgment controls the final disposition";
  }
  return null;
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
      options.validateDecision?.(decision) ??
      agentConditionProblem(decision) ??
      (options.scenarioNormalization
        ? scenarioNormalizationWaitProblem(decision)
        : null) ??
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
  const expectedVitestTestCountRaw =
    normalizationInput?.expectedVitestTestCount;
  const expectedVitestTestCount = Number(expectedVitestTestCountRaw);
  if (
    expectedVitestTestCountRaw !== undefined &&
    (!Number.isInteger(expectedVitestTestCount) || expectedVitestTestCount < 1)
  ) {
    return ownerResult(
      ctx,
      "expectedVitestTestCount must be a positive integer when declared.",
      [
        `task:${taskId || "missing"}`,
        `expected-vitest-test-count:${String(expectedVitestTestCountRaw)}`,
      ],
    );
  }
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
  const declaredPriorVerificationRunId = nonEmptyString(
    payload?.input?.priorVerificationRunId,
  );
  const retryPipelineRunId = nonEmptyString(payload?.input?.retryPipelineRunId);
  const priorVerificationRunId =
    declaredPriorVerificationRunId || retryPipelineRunId;
  const preparedSourceCommit =
    nonEmptyString(payload?.input?.carrierCommit) ||
    nonEmptyString(payload?.input?.retrySourceCommit);
  const preparedSourceBranch = nonEmptyString(
    payload?.input?.retrySourceBranch,
  );
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
  if (
    declaredPriorVerificationRunId &&
    retryPipelineRunId &&
    declaredPriorVerificationRunId !== retryPipelineRunId
  ) {
    return ownerResult(
      ctx,
      "The task declares conflicting priorVerificationRunId and retryPipelineRunId values.",
      [
        `prior-verification-run:${declaredPriorVerificationRunId}`,
        `retry-pipeline-run:${retryPipelineRunId}`,
      ],
    );
  }

  const contextDir = taskContextDir(repoDir, taskId, generation);
  mkdirSync(contextDir, { recursive: true });

  try {
    git(repoDir, ["fetch", "origin", targetBranch]);
    let priorVerificationSummary = "";
    let authoritativeRetryRun: PipelineRun | null = null;
    if (priorVerificationRunId) {
      const priorRun = await getPipelineRun(repoDir, priorVerificationRunId);
      if (
        !priorRun ||
        !runMatchesPriorVerification(priorRun, {
          ...(retryPipelineRunId ? { taskId } : {}),
          specId,
          target: liveTarget,
          standaloneBuildId,
          ...(preparedSourceBranch
            ? { sourceBranch: preparedSourceBranch }
            : {}),
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
            ...(preparedSourceBranch
              ? [`prepared-source-branch:${preparedSourceBranch}`]
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
      if (retryPipelineRunId) {
        authoritativeRetryRun = priorRun;
        priorVerificationSummary = `Task-designated retry ${priorVerificationRunId} is terminal with provider result ${priorResult}. Review this exact run as the current task proof; do not replace it merely because the task generation advanced while it was running.`;
      } else {
        priorVerificationSummary = `Prior exact verification run ${priorVerificationRunId} is terminal with provider result ${priorResult}. Treat its artifacts as repair context; current-task proof still requires the exact task source commit.`;
      }
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
          "This recovery phase only restores a clean source state. Omit liveReady and condition; after recovery, this workflow separately evaluates whether the exact source is runnable and owns any ADO dispatch.",
          "Do not push, queue ADO, create a PR, edit app task state, or discard work whose ownership cannot be established. Use needs-owner for that concrete ambiguity.",
          "Task:",
          ctx.task,
        ].join("\n\n"),
        {
          scenarioNormalization: Boolean(normalizationInput),
          validateDecision: (candidate) =>
            taskWorktreeRecoveryDecisionProblem(candidate),
        },
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
            directVitestCompatibilityInstruction,
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
                    ["merge-base", "--is-ancestor", history.remoteRef, head],
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
            ["merge-base", "--is-ancestor", history.remoteRef, currentCommit],
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
      | {
          state: "queued";
          run: PipelineRun;
          sourceCommit: string;
          evidence: string[];
        }
      | { state: "result"; result: WorkflowResult }
    > => {
      const directScenarioNormalization =
        integrationMode(targetBranch) === "direct" &&
        normalizationInput?.loopId === "scenario-normalization";
      let dispatchCommit = candidateCommit;
      const dispatchEvidence: string[] = [];

      for (let targetAttempt = 1; targetAttempt <= 3; targetAttempt += 1) {
        if (!directScenarioNormalization) break;
        git(repoDir, ["fetch", "origin", targetBranch]);
        const latestTargetCommit = git(repoDir, [
          "rev-parse",
          targetRef,
        ]).stdout;
        const targetIsInSource =
          git(
            workspaceDir,
            ["merge-base", "--is-ancestor", latestTargetCommit, dispatchCommit],
            true,
          ).status === 0;
        if (
          liveDispatchTargetRefreshRequired({
            directScenarioNormalization,
            targetIsInSource,
          })
        ) {
          const replay = replayScenarioCandidateForDispatch({
            workspaceDir,
            sourceBranch,
            candidateCommit: dispatchCommit,
            targetRef,
          });
          dispatchEvidence.push(...replay.evidence);
          if (replay.state === "error") {
            return {
              state: "result",
              result: ownerResult(
                ctx,
                `Could not replay ${specId} onto current ${targetRef} before live dispatch: ${replay.error}.`,
                dispatchEvidence,
              ),
            };
          }

          const expectedRemoteCommit = replay.expectedRemoteCommit;
          if (replay.state === "conflict") {
            const conflictDecision = await askAgent(
              ctx,
              [
                `Current ${targetRef}@${replay.targetCommit} advanced after the exact terminal run for ${specId} was already judged.`,
                `The workflow preserved that judgment and started replaying only these task-owned commits in ${workspaceDir}: ${replay.taskCommits.join(", ") || "none"}.`,
                `Replay stopped with: ${replay.error}`,
                "Resolve only this replay conflict, complete the cherry-pick, run scoped checks, commit the resolved source, leave the task worktree clean, and return decision=committed.",
                "Do not reconsider the already completed terminal-run judgment, merge stale branch history, push, queue ADO, create another task, or edit app state. The workflow will rerun hard admission and publish the replayed source.",
                "Task:",
                ctx.task,
              ].join("\n\n"),
              {
                scenarioNormalization: true,
                continueDomainWorkOnValidation: true,
                validateDecision: (candidate) => {
                  if (candidate.decision !== "committed") {
                    return "dispatch-time replay conflict must be resolved inside this same domain workflow";
                  }
                  if (cleanWorkspace(workspaceDir)) {
                    return "dispatch-time replay repair must leave the task worktree clean";
                  }
                  const head = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
                  if (
                    git(
                      workspaceDir,
                      [
                        "merge-base",
                        "--is-ancestor",
                        replay.targetCommit,
                        head,
                      ],
                      true,
                    ).status !== 0
                  ) {
                    return "dispatch-time replay repair must descend from current origin/dev";
                  }
                  return git(
                    workspaceDir,
                    ["rev-parse", "--verify", "CHERRY_PICK_HEAD"],
                    true,
                  ).status === 0
                    ? "dispatch-time replay repair must finish the cherry-pick"
                    : null;
                },
              },
            );
            dispatchEvidence.push(...conflictDecision.evidence);
            dispatchCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
          } else {
            dispatchCommit = replay.sourceCommit;
          }

          const admission = await prepareLiveDispatch(
            dispatchCommit,
            `target advanced to ${targetRef}@${latestTargetCommit} after terminal judgment`,
          );
          if (admission.state === "result") return admission;
          dispatchCommit = admission.sourceCommit;
          dispatchEvidence.push(...admission.evidence);

          const push = git(
            workspaceDir,
            [
              "push",
              scenarioReplayForceWithLeaseArg({
                sourceBranch,
                expectedRemoteCommit,
              }),
              "origin",
              `HEAD:refs/heads/${sourceBranch}`,
            ],
            true,
          );
          if (push.status !== 0) {
            return {
              state: "result",
              result: ownerResult(
                ctx,
                `Could not publish the replayed source for ${specId} without replacing concurrent task-branch work.`,
                [
                  ...dispatchEvidence,
                  `source-branch:${sourceBranch}`,
                  `source-commit:${dispatchCommit}`,
                  `push-error:${push.stderr || push.stdout}`,
                ],
              ),
            };
          }
          saveScenarioReplayState(contextDir, {
            version: 1,
            recordedTaskBase: nonEmptyString(
              normalizationInput.originDevCommit,
            ),
            replayBase: latestTargetCommit,
            sourceCommit: dispatchCommit,
          });
          dispatchEvidence.push(
            `dispatch-replay-published:${sourceBranch}@${dispatchCommit}`,
          );
          continue;
        }

        const run = await queueRun(repoDir, {
          taskId,
          generation,
          specId,
          sourceBranch,
          sourceCommit: dispatchCommit,
          target: liveTarget,
          standaloneBuildId,
          ...(retryOfRunId && dispatchCommit === candidateCommit
            ? { retryOfRunId }
            : {}),
        });
        return {
          state: "queued",
          run,
          sourceCommit: dispatchCommit,
          evidence: dispatchEvidence,
        };
      }

      if (!directScenarioNormalization) {
        return {
          state: "queued",
          run: await queueRun(repoDir, {
            taskId,
            generation,
            specId,
            sourceBranch,
            sourceCommit: dispatchCommit,
            target: liveTarget,
            standaloneBuildId,
            ...(retryOfRunId ? { retryOfRunId } : {}),
          }),
          sourceCommit: dispatchCommit,
          evidence: dispatchEvidence,
        };
      }

      return {
        state: "result",
        result: ownerResult(
          ctx,
          `Current ${targetRef} kept advancing while ${specId} was replayed; no stale live run was queued.`,
          [
            ...dispatchEvidence,
            `source-branch:${sourceBranch}`,
            `source-commit:${dispatchCommit}`,
            `target-ref:${targetRef}`,
          ],
        ),
      };
    };

    const applyTerminalDisposition = async (
      decision: AgentDecision,
      reviewedRunId = "",
    ): Promise<WorkflowResult> => {
      const isScenarioNormalization =
        normalizationInput?.loopId === "scenario-normalization";
      const validateCurrentSource = (): {
        problem: string | null;
        evidence: string[];
      } => {
        const decisionProblem = terminalDispositionDecisionProblem(decision);
        if (decisionProblem) return { problem: decisionProblem, evidence: [] };
        if (cleanWorkspace(workspaceDir)) {
          return {
            problem:
              "terminal-disposition source must be committed with a clean task worktree",
            evidence: [`workspace:${workspaceDir}`],
          };
        }
        if (isScenarioNormalization) {
          let invariant;
          try {
            invariant = scenarioNormalizationInvariant(
              workspaceDir,
              normalizationInput,
            );
          } catch (error) {
            return {
              problem: error instanceof Error ? error.message : String(error),
              evidence: [],
            };
          }
          if (!invariant || invariant.stillListed) {
            return {
              problem: invariant
                ? `terminal-disposition source still lists ${invariant.kind} ${invariant.path}`
                : "terminal-disposition source has no exact scenario-normalization invariant",
              evidence: invariant
                ? [`normalization-path:${invariant.path}`]
                : [],
            };
          }
        }
        const disposition = specTerminalDispositionCheck(
          workspaceDir,
          normalizationInput,
          decision.terminalDisposition,
        );
        if (!disposition.accepted) {
          return {
            problem: disposition.problem ?? "terminal disposition is invalid",
            evidence: disposition.evidence,
          };
        }
        const target = specTerminalTargetCheck(
          workspaceDir,
          normalizationInput,
          {
            name: liveTarget,
            ...(liveTarget === defaultLiveTarget
              ? { location: stagingLocation }
              : {}),
          },
        );
        return {
          problem: target.problem ?? null,
          evidence: [...disposition.evidence, ...target.evidence],
        };
      };

      let beforeIntegration = validateCurrentSource();
      const reviewedWritebackCommit = nonEmptyString(
        normalizationInput?.reviewedWritebackCommit,
      );
      if (
        shouldReplayReviewedTerminalWriteback({
          sourceProblem: beforeIntegration.problem,
          reviewedWritebackCommit,
          scenarioNormalization: isScenarioNormalization,
        }) &&
        git(
          workspaceDir,
          ["cat-file", "-e", `${reviewedWritebackCommit}^{commit}`],
          true,
        ).status === 0
      ) {
        const replayBaseline = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        const replayDecision = await askAgent(
          ctx,
          [
            `Replay the already reviewed terminal writeback ${reviewedWritebackCommit} for ${specId} into the current task worktree ${workspaceDir}.`,
            `Current source validation failed because ${beforeIntegration.problem}.`,
            "The referenced commit belongs to an earlier generation of this same task. Apply only its task-owned terminal spec and compact-authority changes onto the current task branch; resolve any conflicts from current origin/dev without changing the reviewed status/specState judgment.",
            "Run the scoped checks required by those files, commit the result, leave the current task worktree clean, and return decision=committed.",
            "This is source-only replay of an already reviewed exact run. Omit liveReady and condition; do not queue ADO, create a PR, create another task, or edit task state.",
            "Task:",
            ctx.task,
          ].join("\n\n"),
          {
            scenarioNormalization: false,
            continueDomainWorkOnValidation: true,
            validateDecision: (candidate) => {
              const decisionProblem =
                terminalLineageReplayDecisionProblem(candidate);
              if (decisionProblem) return decisionProblem;
              if (cleanWorkspace(workspaceDir)) {
                return "reviewed terminal writeback replay must leave the current task worktree clean";
              }
              return git(workspaceDir, ["rev-parse", "HEAD"]).stdout ===
                replayBaseline
                ? "reviewed terminal writeback replay did not create a current-generation commit"
                : null;
            },
          },
        );
        beforeIntegration = validateCurrentSource();
        if (beforeIntegration.problem) {
          return ownerResult(
            ctx,
            `Replayed terminal writeback failed current-source validation: ${beforeIntegration.problem}.`,
            [
              ...decision.evidence,
              ...replayDecision.evidence,
              ...beforeIntegration.evidence,
              `reviewed-writeback-commit:${reviewedWritebackCommit}`,
            ],
          );
        }
      }
      if (beforeIntegration.problem) {
        return ownerResult(
          ctx,
          `Terminal disposition was not applicable: ${beforeIntegration.problem}.`,
          [...decision.evidence, ...beforeIntegration.evidence],
        );
      }
      if (integrationMode(targetBranch) !== "direct") {
        return ownerResult(
          ctx,
          "Terminal spec disposition requires direct dev integration.",
          [...decision.evidence, `target-ref:${targetRef}`],
        );
      }

      let candidateCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      let integration = integrateDirectlyIntoDev({
        repoDir,
        workspaceDir,
        sourceBranch,
        sourceCommit: candidateCommit,
        taskBaseCommit: baseCommit,
      });

      if (
        integration.state === "conflict" ||
        integration.state === "requires-replay"
      ) {
        if (integration.state === "requires-replay") {
          git(repoDir, ["fetch", "origin", targetBranch]);
        }
        const replayBaseline =
          integration.state === "conflict"
            ? integration.replayBaseCommit
            : git(repoDir, ["rev-parse", targetRef]).stdout;
        const replayFacts =
          integration.state === "conflict"
            ? [
                `The bounded task commits are already being replayed onto ${integration.targetRef}@${replayBaseline} in ${workspaceDir}.`,
                `Conflict evidence: ${integration.error}`,
                "Resolve only this task's conflicts and complete the cherry-pick.",
              ]
            : [
                `The retained source ${integration.sourceCommit} cannot be isolated from attempt baseline ${integration.taskBaseCommit}.`,
                `Structured replay reason: ${integration.reason}.`,
                ...(integration.mergeCommits.length
                  ? [
                      `Merge commits in the attempted task range: ${integration.mergeCommits.join(",")}.`,
                    ]
                  : []),
                `Replay only the task-owned terminal source onto ${integration.targetRef}@${replayBaseline}; do not merge stale branch history wholesale.`,
              ];
        const beforeConflictRepair = git(workspaceDir, [
          "rev-parse",
          "HEAD",
        ]).stdout;
        const conflictDecision = await askAgent(
          ctx,
          [
            `Reconcile the current direct-dev lineage for the already reviewed terminal disposition of ${specId}.`,
            ...replayFacts,
            `Preserve the exact structured terminal status and specState, rerun scoped local checks${isScenarioNormalization ? " plus the strict scenario inventory" : ""}, leave one clean linear commit lineage descending from the named origin/dev commit, and return decision=committed.`,
            "This is source-only lineage repair for an already reviewed terminal judgment. Omit liveReady and condition; do not create a new readiness decision or wait.",
            "Do not push, queue ADO, create another task, or change the terminal judgment. The workflow will revalidate and integrate the resolved source.",
            "Task:",
            ctx.task,
          ].join("\n\n"),
          {
            scenarioNormalization: true,
            continueDomainWorkOnValidation: true,
            validateDecision: (candidate) => {
              const decisionProblem =
                terminalLineageReplayDecisionProblem(candidate);
              if (decisionProblem) return decisionProblem;
              if (cleanWorkspace(workspaceDir)) {
                return "terminal-disposition conflict repair must leave the worktree clean";
              }
              const head = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
              if (head === beforeConflictRepair) {
                return "terminal-disposition lineage repair did not create a resolved commit";
              }
              if (
                git(
                  workspaceDir,
                  ["merge-base", "--is-ancestor", replayBaseline, head],
                  true,
                ).status !== 0
              ) {
                return "terminal-disposition lineage repair does not descend from current origin/dev";
              }
              const mergeCommits = git(workspaceDir, [
                "rev-list",
                "--merges",
                `${replayBaseline}..${head}`,
              ]).stdout;
              return mergeCommits
                ? "terminal-disposition lineage repair must not retain merge commits from stale branch history"
                : null;
            },
          },
        );
        candidateCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        const afterConflict = validateCurrentSource();
        if (afterConflict.problem) {
          return ownerResult(
            ctx,
            `Resolved terminal-disposition source failed revalidation: ${afterConflict.problem}.`,
            [
              ...decision.evidence,
              ...conflictDecision.evidence,
              ...afterConflict.evidence,
            ],
          );
        }
        integration = integrateDirectlyIntoDev({
          repoDir,
          workspaceDir,
          sourceBranch,
          sourceCommit: candidateCommit,
          taskBaseCommit: replayBaseline,
        });
      }

      if (integration.state !== "integrated") {
        const detail =
          integration.state === "unchanged"
            ? "the bounded task produced no source change on current dev"
            : integration.state === "requires-replay"
              ? `replay remained unresolved (${integration.reason})`
              : integration.error;
        return ownerResult(
          ctx,
          "Could not directly integrate the reviewed terminal spec disposition into dev.",
          [
            ...decision.evidence,
            `source-branch:${sourceBranch}`,
            `source-commit:${candidateCommit}`,
            `target-ref:${targetRef}`,
            `integration-error:${detail}`,
          ],
        );
      }

      sourceCommit = integration.sourceCommit;
      git(repoDir, ["fetch", "origin", targetBranch]);
      const integratedCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
      if (
        git(
          repoDir,
          ["merge-base", "--is-ancestor", sourceCommit, targetRef],
          true,
        ).status !== 0
      ) {
        return ownerResult(
          ctx,
          "Reviewed terminal source is not reachable from current dev after integration.",
          [
            ...decision.evidence,
            `source-commit:${sourceCommit}`,
            `target-ref:${targetRef}@${integratedCommit}`,
          ],
        );
      }
      const refresh = git(
        workspaceDir,
        ["merge", "--ff-only", targetRef],
        true,
      );
      if (refresh.status !== 0) {
        return ownerResult(
          ctx,
          "Could not refresh the terminal-disposition task worktree to current dev for final validation.",
          [
            ...decision.evidence,
            `source-commit:${sourceCommit}`,
            `target-ref:${targetRef}@${integratedCommit}`,
            `refresh-error:${refresh.stderr || refresh.stdout}`,
          ],
        );
      }
      const finalValidation = validateCurrentSource();
      if (finalValidation.problem) {
        return ownerResult(
          ctx,
          `Current dev failed terminal-disposition validation after integration: ${finalValidation.problem}.`,
          [...decision.evidence, ...finalValidation.evidence],
        );
      }

      const disposition = decision.terminalDisposition!;
      const summary = `${specId} retained reviewed terminal disposition ${disposition.status}/${disposition.specState}; source ${sourceCommit} was directly integrated into ${targetBranch}@${integratedCommit} without claiming a new ADO pass.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          ...decision.evidence,
          ...finalValidation.evidence,
          `source-branch:${sourceBranch}`,
          `source-commit:${sourceCommit}`,
          `integrated-commit:${integratedCommit}`,
          `target-ref:${targetRef}`,
          ...(reviewedRunId ? [`reviewed-pipeline-run:${reviewedRunId}`] : []),
          "terminal-disposition:no-new-ado-pass-claimed",
        ],
        actions: [],
      });
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
          exactStrictInventoryInstruction,
          directVitestCompatibilityInstruction,
          "Return decision=committed only after the strict inventory no longer lists this exact row. Separately return liveReady=true when that exact committed source is runnable now; return liveReady=false only with one exact external Condition the app can observe.",
          "Do not push, queue ADO, create a PR, create another task, or edit app state. Those are workflow mechanics and do not make a runnable source liveReady=false.",
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
    let proofSourceBranch = sourceBranch;
    let providerGeneration = generation;
    if (authoritativeRetryRun) {
      const authoritativeSourceCommit = nonEmptyString(
        authoritativeRetryRun.sourceVersion,
      );
      const authoritativeSourceRef = nonEmptyString(
        authoritativeRetryRun.sourceBranch,
      );
      const authoritativeSourceBranch = authoritativeSourceRef.replace(
        /^refs\/heads\//,
        "",
      );
      const authoritativeMetadata = metadataOf(authoritativeRetryRun);
      const authoritativeGeneration = Number(authoritativeMetadata.generation);
      if (
        !authoritativeSourceCommit ||
        !authoritativeSourceBranch ||
        !Number.isInteger(authoritativeGeneration) ||
        authoritativeGeneration < 1
      ) {
        return ownerResult(
          ctx,
          `Task-designated retry ${priorVerificationRunId} lacks exact source or generation metadata.`,
          [`pipeline-run:${priorVerificationRunId}`],
        );
      }
      git(repoDir, ["fetch", "origin", authoritativeSourceBranch]);
      if (
        git(
          repoDir,
          ["cat-file", "-e", `${authoritativeSourceCommit}^{commit}`],
          true,
        ).status !== 0
      ) {
        return ownerResult(
          ctx,
          `Task-designated retry ${priorVerificationRunId} source commit is not available locally after fetching its branch.`,
          [
            `pipeline-run:${priorVerificationRunId}`,
            `source-branch:${authoritativeSourceBranch}`,
            `source-commit:${authoritativeSourceCommit}`,
          ],
        );
      }
      sourceCommit = authoritativeSourceCommit;
      proofSourceBranch = authoritativeSourceBranch;
      providerGeneration = authoritativeGeneration;
      runs = [authoritativeRetryRun];
      latestRun = authoritativeRetryRun;
    }

    const sourceDiffersFromBase = sourceCommit !== baseCommit;
    let terminalDispositionDecision: AgentDecision | null = null;
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
        "Treat the appended Trigger Event as hot evidence, not merely as a wake. If it reports an exact passing pipeline.spec.observed for this task branch at a different source commit, inspect that tested commit against current HEAD and current integration authority. Restore the exact tested commit only when doing so preserves every required same-task change; otherwise keep the newer source and require a fresh exact run. Equivalent file content alone is not exact source proof.",
        "Inspect the original task, current spec status, model, direct carrier, nearby good/bad examples, and prior evidence. Decide whether this exact source is genuinely ready for live execution.",
        "If a bounded repo change is needed, make it, run scoped local checks, commit it, leave the worktree clean, and return decision=committed.",
        directVitestCompatibilityInstruction,
        currentAdoSurfaceInstruction,
        "If current source is already the exact content that should be live-tested, leave it unchanged and return decision=test-current.",
        "For committed or test-current, separately set liveReady=true only when this exact source may be sent to ADO now. If source is prepared but an external fact still prevents execution, set liveReady=false and include one exact observable Condition. If this app cannot observe the required fact, return needs-owner instead. Never treat a commit as permission to run.",
        ...(normalizationInput
          ? [terminalDispositionSourceRepairInstruction]
          : []),
        ...(options.existingRecoveryAfterRunId
          ? [
              `This is recovery work for blocking run ${options.existingRecoveryAfterRunId}. If a later current-main run already passed this exact spec and still applies to current main, leave source unchanged and return decision=accepted-pass. Populate recovery={pipelineRunId,sourceBranch,sourceCommit,artifactPath} with the aggregate result artifact that contains this spec verdict, and cite ancestry/relevant-change evidence. Do not dispatch redundant proof.`,
            ]
          : []),
        "A blocked spec, reviewed exception, or intentionally paused execution path is not live-ready merely because its file layout is normalized. Implement a truthful observable contract, return an exact wait, make the structured terminal-disposition judgment when the scenario-normalization exception above applies, or identify the genuine ownership boundary.",
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
          ) ?? terminalDispositionDecisionProblem(candidate),
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
              terminalDispositionDecisionProblem(candidate) ??
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
      if (decision.decision === "terminal-disposition") {
        terminalDispositionDecision = decision;
      } else if (!["committed", "test-current"].includes(decision.decision)) {
        return ownerResult(
          ctx,
          `Unsupported preparation decision ${decision.decision}.`,
          decision.evidence,
        );
      }
      sourceCommit = after;
      runs = matchingTaskRuns(
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
      latestRun = runs[0];
    }

    if (terminalDispositionDecision) {
      return applyTerminalDisposition(terminalDispositionDecision);
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
      sourceCommit = queued.sourceCommit;
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
          ...queued.evidence,
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
      const failedRunsForCommit =
        runs.filter(
          (run) =>
            pipelineRunState(run) === "completed" &&
            !["succeeded", "partiallySucceeded"].includes(
              nonEmptyString(run.result),
            ),
        ).length + (authoritativeRetryRun ? 1 : 0);
      const runContextDir = terminalRunContextDir(contextDir, runId);
      const collectedRunEvidence = await collectTerminalRunEvidence(
        repoDir,
        runContextDir,
        runId,
        latestRun,
      );
      let candidateInvariantSatisfied = true;
      if (normalizationInput?.loopId === "scenario-normalization") {
        try {
          candidateInvariantSatisfied = !scenarioNormalizationInvariant(
            workspaceDir,
            normalizationInput,
          ).stillListed;
        } catch {
          candidateInvariantSatisfied = false;
        }
      }
      const candidateProof: ReviewedRunProof = {
        version: 1,
        taskId,
        generation,
        providerGeneration,
        specId,
        target: liveTarget,
        ...(standaloneBuildId ? { standaloneBuildId } : {}),
        sourceBranch: proofSourceBranch,
        sourceCommit,
        runId,
        runResult,
        verdict: "pass",
        summary: "candidate terminal run proof",
        evidence: [],
        reviewedAt: new Date().toISOString(),
      };
      const preIntegrationVerification = verifySpecLiveProofFacts({
        taskId,
        generation,
        specIds: selectedSpecIds,
        target: liveTarget,
        standaloneBuildId,
        proof: candidateProof,
        run: latestRun,
        artifactPaths: artifactJsonFiles(collectedRunEvidence.artifactPaths),
        expectedClaimIdsBySpec: claimAssertionIdsBySpecAtCommit(
          repoDir,
          sourceCommit,
          selectedSpecIds,
        ),
        sourceReachable: false,
        integratedCommitReachable: false,
        normalizationInvariantSatisfied: candidateInvariantSatisfied,
        ...(expectedVitestTestCountRaw !== undefined
          ? { expectedVitestTestCount }
          : {}),
        requireIntegration: false,
      });
      const decision = await askAgent(
        ctx,
        [
          `Review terminal Azure DevOps run ${runId} for ${specId}.`,
          `The exact source is ${proofSourceBranch}@${sourceCommit}; provider result is ${runResult}.`,
          `The exact live target is ${liveTarget}${standaloneBuildId ? ` with standalone_build_id=${standaloneBuildId}` : ""}.`,
          exactLiveTargetInstruction(liveTarget, standaloneBuildId),
          `Workflow code collected authenticated run evidence in ${runContextDir}. Run metadata: ${collectedRunEvidence.runPath}. Artifact list: ${collectedRunEvidence.artifactListPath}. Downloaded artifact directories: ${collectedRunEvidence.artifactPaths.join(", ") || "none"}. Collection errors: ${collectedRunEvidence.errors.join(" | ") || "none"}.`,
          preIntegrationVerification.accepted
            ? "Hard live-proof validation found no structural proof gaps."
            : `Hard live-proof validation findings to resolve or explain: ${preIntegrationVerification.summary}`,
          `Use ${runContextDir} exclusively for diagnosis for this run. Do not reuse task-root or earlier-run evidence, do not scrape Azure DevOps web pages, and do not write runtime artifacts into tracked source paths.`,
          "Inspect run metadata, plan inputs, per-spec result, live resource identity, assertions, and cleanup proof. The aggregate provider result alone is not a spec verdict.",
          ...(expectedVitestTestCountRaw !== undefined
            ? [
                `This task declares the hard generated-suite invariant expectedVitestTestCount=${expectedVitestTestCount}. Inspect the exact downloaded vitest.json; accepted-pass requires numTotalTests to equal that value.`,
              ]
            : []),
          "Return accepted-pass only for exact same-spec live proof on this source commit.",
          acceptedLiveProofSourceInstruction,
          "A source-only check or admission refusal is diagnostic evidence, not completion. Implement an observable live negative test when the API contract permits it; otherwise return an exact external wait or a genuine ownership-boundary decision.",
          ...(normalizationInput
            ? [terminalDispositionSourceRepairInstruction]
            : []),
          "For a carrier/spec defect, make the smallest fix in the task worktree, run scoped local checks, commit, leave the worktree clean, and return committed.",
          directVitestCompatibilityInstruction,
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
            }) ??
            terminalDispositionDecisionProblem(candidate) ??
            (candidate.decision === "accepted-pass" &&
            !preIntegrationVerification.accepted
              ? preIntegrationVerification.summary
              : null),
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
      if (decision.decision === "terminal-disposition") {
        return applyTerminalDisposition(decision, runId);
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
        const requestedUnchangedRetry = sourceCommit === retrySourceCommit;
        let publicationEvidence: string[] = [];
        if (!requestedUnchangedRetry) {
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
          requestedUnchangedRetry ? runId : undefined,
        );
        if (queued.state === "result") return queued.result;
        sourceCommit = queued.sourceCommit;
        const unchangedRetry = sourceCommit === retrySourceCommit;
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
            ...queued.evidence,
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
        nextCommit = queued.sourceCommit;
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
            ...queued.evidence,
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
        providerGeneration,
        specId,
        target: liveTarget,
        ...(standaloneBuildId ? { standaloneBuildId } : {}),
        sourceBranch: proofSourceBranch,
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

    let preIntegrationInvariantSatisfied = true;
    if (normalizationInput?.loopId === "scenario-normalization") {
      try {
        preIntegrationInvariantSatisfied = !scenarioNormalizationInvariant(
          workspaceDir,
          normalizationInput,
        ).stillListed;
      } catch {
        preIntegrationInvariantSatisfied = false;
      }
    }
    const preIntegrationVerification = verifySpecLiveProofFacts({
      taskId,
      generation,
      specIds: selectedSpecIds,
      target: liveTarget,
      standaloneBuildId,
      proof,
      run: latestRun,
      artifactPaths: collectedArtifactPaths(
        terminalRunContextDir(contextDir, runId),
      ),
      expectedClaimIdsBySpec: claimAssertionIdsBySpecAtCommit(
        repoDir,
        sourceCommit,
        selectedSpecIds,
      ),
      sourceReachable: false,
      integratedCommitReachable: false,
      normalizationInvariantSatisfied: preIntegrationInvariantSatisfied,
      ...(expectedVitestTestCountRaw !== undefined
        ? { expectedVitestTestCount }
        : {}),
      requireIntegration: false,
    });
    if (!preIntegrationVerification.accepted) {
      return ownerResult(
        ctx,
        `Refused integration before hard live-proof validation: ${preIntegrationVerification.summary}`,
        preIntegrationVerification.evidence,
      );
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
          const directScenarioNormalization =
            normalizationInput?.loopId === "scenario-normalization";
          const mergeBase = git(
            repoDir,
            ["merge-base", sourceCommit, targetRef],
            true,
          );
          const sourcePathResult =
            mergeBase.status === 0
              ? git(
                  repoDir,
                  ["diff", "--name-only", mergeBase.stdout, sourceCommit, "--"],
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
          const targetChangesKnowledgeModel = targetPaths.includes(
            "model/knowledge-map/model.json",
          );
          const knowledgeModelStable =
            !targetChangesKnowledgeModel ||
            (directScenarioNormalization &&
              knowledgeModelStableForSpec({
                repoDir,
                sourceCommit,
                targetCommit: targetRef,
                specId,
              }));
          const proofPreserving = proofPreservingScenarioIntegration({
            sourcePaths,
            targetPaths,
            knowledgeModelStable,
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
                      ["merge-base", "--is-ancestor", sourceCommit, targetRef],
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

          if (directScenarioNormalization) {
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
            refreshedCommit = queued.sourceCommit;
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
                ...queued.evidence,
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
          updatedCommit = queued.sourceCommit;
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
              ...queued.evidence,
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
      resolvedCommit = queued.sourceCommit;
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
          ...queued.evidence,
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
    throw new Error(
      `${name} failed deterministic reconciliation for ${taskId}@${generation} (${specId}) in ${workspaceDir}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return reconcileSpecLive(ctx);
}

function collectedArtifactPaths(runContextDir: string): string[] {
  const collection = readJsonRecord(join(runContextDir, "collection.json"));
  const root = resolve(runContextDir);
  const artifactRoots = Array.isArray(collection?.artifactPaths)
    ? collection.artifactPaths
        .map(nonEmptyString)
        .filter(Boolean)
        .map((path) => resolve(path))
        .filter((path) => path.startsWith(`${root}${sep}`) && existsSync(path))
    : [];
  return artifactJsonFiles(artifactRoots);
}

function resultEvidenceItems(result: ProjectAppTaskHandlerResult): string[] {
  return Array.isArray(result.evidence)
    ? result.evidence
        .map(nonEmptyString)
        .filter((item): item is string => item.length > 0)
    : [];
}

function verifySameTaskRevision(
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
): ProjectAppTaskVerificationResult | null {
  const actions = Array.isArray(result.actions) ? result.actions : [];
  if (
    actions.length !== 1 ||
    actions[0]?.kind !== "update-task" ||
    actions[0].taskId !== context.taskId
  ) {
    return null;
  }

  const action = actions[0];
  const currentInput = jsonRecord(context.intent.input);
  const nextInput = jsonRecord(action.input);
  const currentSpecIds = scenarioNormalizationSpecIds(
    currentInput as ScenarioNormalizationInput,
  );
  const nextSpecIds = scenarioNormalizationSpecIds(
    nextInput as ScenarioNormalizationInput,
  );
  let currentTarget: LiveExecutionTarget;
  let nextTarget: LiveExecutionTarget;
  try {
    currentTarget = resolveLiveExecutionTarget(currentInput);
    nextTarget = resolveLiveExecutionTarget(nextInput);
  } catch (error) {
    return {
      accepted: false,
      summary: error instanceof Error ? error.message : String(error),
      evidence: ["verification-finding:invalid-self-revision-target"],
    };
  }

  const problems: string[] = [];
  if (action.expectedGeneration !== context.generation) {
    problems.push("self-revision generation does not match the current task");
  }
  if (action.workflow !== name) {
    problems.push("self-revision must resume spec-live-reconciliation");
  }
  if (
    currentSpecIds.length === 0 ||
    currentSpecIds.join(",") !== nextSpecIds.join(",")
  ) {
    problems.push("self-revision must preserve the exact spec ids");
  }
  if (
    currentTarget.target !== nextTarget.target ||
    currentTarget.standaloneBuildId !== nextTarget.standaloneBuildId
  ) {
    problems.push("self-revision must preserve the exact live target");
  }

  return {
    accepted: problems.length === 0,
    summary:
      problems.length === 0
        ? "Accepted a generation-changing correction for the same task; final live-proof verification remains required on the revised generation."
        : `Rejected same-task revision: ${problems.join("; ")}.`,
    evidence:
      problems.length === 0
        ? [
            `task-revision:${context.taskId}@${context.generation + 1}`,
            `spec-ids:${currentSpecIds.join(",")}`,
            `target:${currentTarget.target}`,
          ]
        : problems.map((problem) => `verification-finding:${problem}`),
  };
}

function evidenceValue(evidence: readonly string[], prefix: string): string {
  for (let index = evidence.length - 1; index >= 0; index -= 1) {
    const item = evidence[index];
    if (item?.startsWith(prefix)) return item.slice(prefix.length).trim();
  }
  return "";
}

function verifyTerminalDispositionResult(
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
  input: ScenarioNormalizationInput | undefined,
): ProjectAppTaskVerificationResult | null {
  const evidence = resultEvidenceItems(result);
  if (!evidence.includes("terminal-disposition:no-new-ado-pass-claimed")) {
    return null;
  }

  if (cleanWorkspace(context.workspaceDir)) {
    return {
      accepted: false,
      summary:
        "Terminal spec disposition must leave the task worktree clean before convergence.",
      evidence: [`workspace:${context.workspaceDir}`],
    };
  }

  if (input?.loopId === "scenario-normalization") {
    let invariant;
    try {
      invariant = scenarioNormalizationInvariant(context.workspaceDir, input);
    } catch (error) {
      return {
        accepted: false,
        summary: error instanceof Error ? error.message : String(error),
        evidence: ["verification-finding:terminal-disposition-invariant-error"],
      };
    }
    if (!invariant || invariant.stillListed) {
      return {
        accepted: false,
        summary: invariant
          ? `Terminal scenario normalization still lists ${invariant.kind} ${invariant.path}.`
          : "Terminal scenario normalization has no exact invariant to verify.",
        evidence: invariant ? [`normalization-path:${invariant.path}`] : [],
      };
    }
  }

  const disposition = {
    specId: evidenceValue(evidence, "terminal-disposition-spec:"),
    status: evidenceValue(evidence, "terminal-disposition-status:"),
    specState: evidenceValue(evidence, "terminal-disposition-spec-state:"),
  };
  const dispositionCheck = specTerminalDispositionCheck(
    context.workspaceDir,
    input,
    disposition,
  );
  if (!dispositionCheck.accepted) {
    return {
      accepted: false,
      summary: dispositionCheck.problem ?? "Terminal disposition is invalid.",
      evidence: dispositionCheck.evidence,
    };
  }

  let liveTarget: LiveExecutionTarget;
  try {
    liveTarget = resolveLiveExecutionTarget(jsonRecord(input));
  } catch (error) {
    return {
      accepted: false,
      summary: error instanceof Error ? error.message : String(error),
      evidence: ["verification-finding:invalid-terminal-live-target"],
    };
  }
  const targetCheck = specTerminalTargetCheck(context.workspaceDir, input, {
    name: liveTarget.target,
    ...(liveTarget.target === defaultLiveTarget
      ? { location: stagingLocation }
      : {}),
  });
  if (!targetCheck.accepted) {
    return {
      accepted: false,
      summary:
        targetCheck.problem ?? "Terminal disposition live target is invalid.",
      evidence: targetCheck.evidence,
    };
  }

  const targetRef = evidenceValue(evidence, "target-ref:");
  if (targetRef !== "origin/dev") {
    return {
      accepted: false,
      summary:
        "Terminal spec disposition must integrate directly into origin/dev.",
      evidence: targetRef ? [`target-ref:${targetRef}`] : [],
    };
  }

  git(context.projectDir, ["fetch", "origin", defaultTargetBranch], true);
  const sourceCommit = evidenceValue(evidence, "source-commit:");
  if (
    !sourceCommit ||
    git(
      context.projectDir,
      ["merge-base", "--is-ancestor", sourceCommit, targetRef],
      true,
    ).status !== 0
  ) {
    return {
      accepted: false,
      summary:
        "Terminal spec disposition source commit is not reachable from current origin/dev.",
      evidence: sourceCommit
        ? [`source-commit:${sourceCommit}`, `target-ref:${targetRef}`]
        : ["verification-finding:missing-terminal-source-commit"],
    };
  }

  const integratedCommit = evidenceValue(evidence, "integrated-commit:");
  if (
    !integratedCommit ||
    git(
      context.projectDir,
      ["merge-base", "--is-ancestor", integratedCommit, targetRef],
      true,
    ).status !== 0
  ) {
    return {
      accepted: false,
      summary:
        "Terminal spec disposition integrated commit is not reachable from current origin/dev.",
      evidence: integratedCommit
        ? [`integrated-commit:${integratedCommit}`, `target-ref:${targetRef}`]
        : ["verification-finding:missing-terminal-integrated-commit"],
    };
  }

  return {
    accepted: true,
    summary:
      "Verified terminal spec disposition integrated into origin/dev without claiming a new ADO pass.",
    evidence: [
      ...dispositionCheck.evidence,
      ...targetCheck.evidence,
      `source-commit:${sourceCommit}`,
      `integrated-commit:${integratedCommit}`,
      `target-ref:${targetRef}`,
      "terminal-disposition:no-new-ado-pass-claimed",
    ],
  };
}

export async function verify(
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
): Promise<ProjectAppTaskVerificationResult> {
  if (result.state !== "converged") {
    return {
      accepted: false,
      summary:
        "Spec live reconciliation may converge only from a converged handler result.",
      evidence: [`handler-state:${result.state}`],
    };
  }

  const sameTaskRevision = verifySameTaskRevision(context, result);
  if (sameTaskRevision) return sameTaskRevision;

  const input = context.intent.input as ScenarioNormalizationInput | undefined;
  const specIds = scenarioNormalizationSpecIds(input);
  if (specIds.length === 0) {
    return {
      accepted: false,
      summary: "Spec live reconciliation has no exact spec ids to verify.",
      evidence: ["verification-finding:missing-spec-ids"],
    };
  }

  const terminalDispositionVerification = verifyTerminalDispositionResult(
    context,
    result,
    input,
  );
  if (terminalDispositionVerification) {
    return terminalDispositionVerification;
  }

  let liveExecution: LiveExecutionTarget;
  try {
    liveExecution = resolveLiveExecutionTarget(context.intent.input);
  } catch (error) {
    return {
      accepted: false,
      summary: error instanceof Error ? error.message : String(error),
      evidence: ["verification-finding:invalid-live-target"],
    };
  }

  const contextDir = taskContextDir(
    context.projectDir,
    context.taskId,
    context.generation,
  );
  const proof = readProof(contextDir);
  let run: PipelineRun | null = null;
  if (proof?.runId) {
    try {
      run = await getPipelineRun(context.projectDir, proof.runId);
    } catch (error) {
      return {
        accepted: false,
        summary: `Unable to verify Azure DevOps run ${proof.runId}.`,
        evidence: [
          `verification-finding:${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  const runContextDir = proof
    ? terminalRunContextDir(contextDir, proof.runId)
    : contextDir;
  const artifactPaths = proof ? collectedArtifactPaths(runContextDir) : [];
  git(context.projectDir, ["fetch", "origin", defaultTargetBranch], true);
  const sourceReachable = Boolean(
    proof?.sourceCommit &&
    git(
      context.projectDir,
      ["merge-base", "--is-ancestor", proof.sourceCommit, "origin/dev"],
      true,
    ).status === 0,
  );
  const integratedCommitReachable = Boolean(
    proof?.mergedCommit &&
    git(
      context.projectDir,
      ["merge-base", "--is-ancestor", proof.mergedCommit, "origin/dev"],
      true,
    ).status === 0,
  );

  let normalizationInvariantSatisfied = true;
  if (input?.loopId === "scenario-normalization") {
    try {
      const invariant = scenarioNormalizationInvariant(
        context.workspaceDir,
        input,
      );
      normalizationInvariantSatisfied = Boolean(
        invariant && !invariant.stillListed,
      );
    } catch {
      normalizationInvariantSatisfied = false;
    }
  }

  const verification = verifySpecLiveProofFacts({
    taskId: context.taskId,
    generation: context.generation,
    specIds,
    target: liveExecution.target,
    standaloneBuildId: liveExecution.standaloneBuildId,
    proof,
    run,
    artifactPaths,
    expectedClaimIdsBySpec: claimAssertionIdsBySpecAtCommit(
      context.projectDir,
      proof?.sourceCommit || "",
      specIds,
    ),
    sourceReachable,
    integratedCommitReachable,
    normalizationInvariantSatisfied,
    ...(input?.expectedVitestTestCount !== undefined
      ? {
          expectedVitestTestCount: Number(input.expectedVitestTestCount),
        }
      : {}),
  });
  if (!verification.accepted || !proof) return verification;
  return {
    ...verification,
    evidence: [
      `proof:${proofPath(contextDir)}`,
      `pipeline-run:${proof.runId}`,
      `source-commit:${proof.sourceCommit}`,
      `integrated-commit:${proof.mergedCommit}`,
      ...verification.evidence.filter(
        (item) =>
          !item.startsWith("proof:") && !item.startsWith("source-commit:"),
      ),
    ],
  };
}

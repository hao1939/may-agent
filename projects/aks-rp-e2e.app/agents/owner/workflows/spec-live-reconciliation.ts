import { createHash } from "node:crypto";
import { execFile, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import {
  Type,
  isTypedConditionSubject,
  workflowResultVersion,
  type Condition,
  type ExecutionResult,
  type TaskReconcileResult,
  type TaskVerificationContext,
  type TaskVerificationResult,
  type WorkflowContext,
  type WorkflowIoContract,
} from "@may-agent/sdk";
import { appendTrackedPipelineRunId } from "../../../watchers/aks-pipeline.js";
import {
  summarizePullRequestReview as summarizeAksPullRequestReview,
  type PullRequestReview,
} from "../../../watchers/aks-pull-request.js";
import {
  scenarioNormalizationInvariant,
  scenarioNormalizationSpecIds,
  specTerminalDispositionCheck,
  specTerminalTargetCheck,
  type ScenarioNormalizationInput,
  type SpecTerminalDisposition,
} from "./lib/scenario-normalization-invariant.js";
import {
  scenarioQualityInvariant,
  type ScenarioQualityInvariant,
} from "./lib/scenario-quality-invariant.js";
import {
  AKS_DIRECT_DEV_VALIDATION_COMMANDS,
  historyOnlyAncestryStrategy,
  integrateDirectlyIntoDev,
} from "./lib/direct-dev-integration.js";
import { assertIsolatedWriteDispatch } from "./lib/write-dispatch-guard.js";

export const name = "spec-live-reconciliation";
export const description =
  "Reconcile one AKS spec through a task-owned source branch, exact live ADO verification, fix-forward retries, and integration into dev.";
export const workspace = "task";

type SpecLiveWorkflowResult = ExecutionResult<TaskReconcileResult>;

const organization = "https://dev.azure.com/msazure";
const adoProject = "CloudNativeCompute";
const repository = "aks-e2e-spec-runner";
const pipelineId = "467665";
const defaultTargetBranch = "dev";
const defaultLiveTarget = "staging";
const stagingSubscriptionId = "26fe00f8-9173-4872-9134-bb1d2e00343a";
const stagingLocation = "westus2";
export const masterValidationCapacityPulseProjectId = "aks-rp-e2e";
export const masterValidationCapacityPulseIntervalMs = 21_600_000;
export const terminalDispositionSourceRepairInstruction =
  "If exact evidence supports a reviewed terminal posture, keep that judgment in this domain workflow. When the spec still carries a stale ready/pass posture, update its structured status, specState, statusReason, and latest-live-result evidence from the exact facts, add any needed durable source memo, run scoped checks, commit the bounded change, and return decision=terminal-disposition with terminalDisposition={specId,status,specState}. For scenario normalization, changing the spec to blocked/environment-blocked because no unchanged live run is currently truthful is a terminal disposition for this source iteration, even when a separate approval or environment change may reopen product testing later. Keep source-layout normalization separate from product-contract adjudication: when the existing behavior, assertions, and disputed expectation can be preserved unchanged while moving a plain carrier into direct .test.ts or feature lib source, normalize and integrate that source with the truthful current terminal posture, and keep the approval or escalation as independent follow-up. Wait for external authority only when it must decide how the source itself is implemented, not merely how observed product behavior is judged. Do not return committed with liveReady=false merely to keep that truthful normalized source off dev; terminal here means the current source posture is complete and reviewable, not that the feature is abandoned forever. A terminal disposition is neither live readiness nor a wait: omit liveReady and condition entirely. Preserve the resolved live target in statusReason, nextAction, resumeCondition, and every active approval/wait/path identifier; never bind a staging disposition to a stale identifier for another subscription or region. Do not return needs-owner merely because recording the terminal product gap requires this source update. Compact package status, compact-plan eligibility, a sibling compact task, or an arbitrary origin/dev advance is context, not an external prerequisite for this same-spec normalization; do not wait on any of them. An exact external wait must name the actual unavailable capability or authority, its real producer, and the observable fact that lets this same source continue. Use needs-owner only when the evidence cannot support the domain judgment or a real external authority must decide it. The workflow will validate and integrate the committed terminal source without claiming a failed run as a pass.";
export const acceptedLiveProofSourceInstruction =
  "When this exact run proves the current source passes and hard live-proof validation found no structural gap, return accepted-pass without editing or committing tracked source. A checked-in ready posture, an older accepted run, or missing latestLiveResult fields is not a model defect at this point: the app projects the newly accepted proof after the task receipt is persisted. Do not rewrite the spec, model, generated views, test assertions, sourceVersion, observedAt, statusReason, nextAction, resumeCondition, evidence memo, or equivalent bookkeeping merely to record this successful run. Return committed only when the run exposes an actual behavior or contract defect that requires changed source and a fresh exact run, and cite that defect. When the run reports test_not_implemented or partial live coverage, changing only diagnostics, messages, metadata, or static checks is not a runnable repair: implement the missing live behavior before setting liveReady=true, or return the truthful terminal disposition, exact external wait, or ownership escalation.";
export const semanticClaimEvidenceInstruction =
  "Judge every declared claim against the exact observation recorded for that claim, not against its ok flag, assertion name, summary, or provider result. Configuration or enablement proves only configuration or enablement; it does not by itself prove that a runtime component is healthy, an operation was optimized, or another claimed behavior occurred. If assertion evidence says the required observation was unavailable, not performed, assumed from provisioning, or requires a tool that was not used, that claim is not proven and accepted-pass is forbidden. Repair the carrier to observe the behavior directly, narrow or correct an inaccurate claim only when official authority supports that change, or return the exact unavailable capability. Do not convert this judgment into a code-side prose heuristic.";
export const directVitestCompatibilityInstruction =
  "ADO loads a direct scenario .test.ts carrier through Vitest without guaranteeing the Bun runtime global. A standalone direct carrier means no child-process wrapper: do not `execFile`, `spawn`, or shell out to Bun or a sibling plain scenario file just to reach the real implementation. Validate a new or repaired direct carrier on the Vitest collection/runtime surface, not only with `bun test`; import test APIs from `vitest`, never `bun:test`; replace runtime uses such as `Bun.spawn`, `Bun.spawnSync`, and `Bun.file` with portable Node APIs; and ensure every imported scenario library guards CLI execution with `import.meta.main` instead of calling `main()` during Vitest collection. A Bun-only passing test is not live-ready evidence. Run the normal `bun run spec <spec-id> --check` path with the task target so the runner wires exact target inputs; if a direct Vitest check also needs target inputs, read them from that exact runner target configuration. Never fabricate subscription, region, API version, Kubernetes version, or VM-size placeholders as check evidence.";
export const exactStrictInventoryInstruction =
  "The repository-wide strict inventory is expected to exit nonzero while other rows remain. Capture and parse its JSON anyway; this leaf is clear only when its exact legacy path is absent from both guard.remainingSpecReferencedPlainScenarioUnits and guard.remainingRepoPlainScenarioFiles.";
export const currentAdoSurfaceInstruction =
  "Do not treat uncertainty about a secret or variable on the current ADO execution surface as proof of a blocker. Missing-input evidence from an older backend, different source commit, or different target is context only. When hard admission checks pass and no exact current-surface observation proves the input unavailable, set liveReady=true so this workflow can dispatch the bounded run and collect the current fact. Use a wait or needs-owner only after exact current evidence identifies the unavailable input, its producer, and the observable resume condition.";
export const transientRetryDiagnosisInstruction =
  "Do not trust a result's blocked/error category or environment/transient label as the diagnosis. A timeout, generic ARM failure, incomplete provisioning state, or successful cleanup alone does not prove that an unchanged retry is truthful. Before retry-transient, inspect the exact task source and failure-stage evidence for deterministic ordering, identity, authorization, configuration, and API-contract mistakes, and state affirmative evidence that excludes those causes. When the available evidence cannot distinguish a provider incident from a source defect, improve the carrier's failure diagnostics or return one exact observable wait; do not guess transient.";
export const scenarioQualityRepairInstruction =
  "For a quality-normalization task, resolve every cited structural quality issue before requesting ADO. Read the current strict inventory and exact source yourself, repair the same carrier/spec in this task, and keep iterating until the cited issue codes are absent. Ground contract expectations in official Learn, Azure REST API specs, and checked-in design docs; treat mounted AKS RP or Go source as implementation evidence only, and never require a private/local filesystem path as carrier authority. A green ADO run proves execution only; it does not waive missing official grounding, migration-only scaffolding, target/mutation gates, or fixture/cleanup ownership.";
export const earlyCheckpointInstruction =
  "Before broad carrier research, run the narrowest task-specific gate and state its exact command/result. For a multi-spec repair, first make a compact per-spec gate matrix from the task-selected spec/carrier paths so one difficult row cannot consume the whole judgment. Immediately record the narrowed result, current HEAD, next bounded source move, and any work already performed in the durable task context; commit a clean source checkpoint as soon as one coherent repair exists. On resume, inspect the retained task worktree and checkpoint before repeating research. Inspect package.json scripts before choosing verification commands. Use repository-supported Bun-native forms such as `bun test <file>` or `bun run <script> -- <args>`; when `bunx` is unavailable, do not retry it or replace the scoped check with an unrelated command.";

export const specLiveWorkflowDeadlineMs = 2_700_000;
export const specLiveWorkflowMarginMs = 300_000;
export const specLiveInitialAgentCallMs = 900_000;
export const specLiveFollowupAgentCallMs = 600_000;
export const specLiveMinimumAgentCallMs = 120_000;

const workflowDeadlines = new WeakMap<object, number>();

export function admittedAgentCallTimeoutMs(input: {
  deadlineMs: number;
  nowMs: number;
  attempt: number;
}): number | null {
  const availableForCall =
    input.deadlineMs - input.nowMs - specLiveWorkflowMarginMs;
  const nominal =
    input.attempt === 1
      ? specLiveInitialAgentCallMs
      : specLiveFollowupAgentCallMs;
  const admitted = Math.min(nominal, availableForCall);
  return admitted >= specLiveMinimumAgentCallMs ? admitted : null;
}

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
      "input.acceptedRunId",
      "input.acceptedSourceCommit",
      "input.authoritativeRunId",
      "input.authoritativeSourceBranch",
      "input.authoritativeSourceCommit",
      "input.authoritativeTaskId",
      "input.retryPipelineRunId",
      "input.retrySourceBranch",
      "input.retrySourceCommit",
      "input.allowTerminalDisposition",
      "input.invalidatedRunId",
      "input.invalidatedClaimIds",
      "input.invalidatedSourcePaths",
      "input.liveSpecIds",
      "input.requireFreshBaseAtDispatch",
      "input.baseRef",
      "input.boundedChangedFiles",
      "input.baselineCommit",
      "input.priorRetainedWorkspace",
      "input.integrationStrategy",
      "input.testedSourceCommit",
    ],
    description:
      "Use only for a finite spec verification/change lifecycle that may require source changes, exact live verification, and branch integration. target defaults to staging; standaloneBuildId selects an exact standalone RP build. allowTerminalDisposition defaults to true; set it to false when task acceptance requires an exact pass.",
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
  children?: {
    completed?: unknown;
  };
};

function taskDescription(ctx: WorkflowContext): string {
  return JSON.stringify(ctx.reconciliation ?? ctx.input, null, 2);
}

function taskOwner(ctx: WorkflowContext): string {
  return ctx.reconciliation?.owner ?? "aks-explorer";
}

type PipelineRun = {
  id?: unknown;
  status?: unknown;
  state?: unknown;
  result?: unknown;
  finishTime?: unknown;
  sourceBranch?: unknown;
  sourceVersion?: unknown;
  templateParameters?: unknown;
  definition?: { id?: unknown };
};

type PullRequest = {
  pullRequestId?: unknown;
  status?: unknown;
  mergeStatus?: unknown;
  isDraft?: unknown;
  sourceRefName?: unknown;
  targetRefName?: unknown;
  lastMergeSourceCommit?: { commitId?: unknown };
  lastMergeCommit?: { commitId?: unknown };
  url?: unknown;
};

type SemanticInvalidationContext = {
  runId: string;
  claimIds: string[];
  sourceCommit: string;
  sourcePaths: string[];
  lineageInvalid: boolean;
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
        | "merge-not-succeeded"
        | "source-mismatch"
        | "merge-commit-missing";
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
  condition?: Condition;
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
  integrationMode?: "ancestry" | "bounded-content-equivalent";
  integratedPaths?: string[];
};

type RunReceipt = {
  runId: string;
  sourceCommit: string;
  queuedAt: string;
};

export type ScenarioReplayState = {
  version: 1;
  recordedTaskBase: string;
  replayBase: string;
  sourceCommit: string;
};

type CollectedRunEvidence = {
  runPath: string;
  artifactListPath: string;
  artifactPaths: string[];
  timelinePath: string | null;
  terminalFailurePath: string | null;
  failingTaskLogPath: string | null;
  errors: string[];
};

export type LiveDispatchAdmission = {
  accepted: boolean;
  evidence: string[];
};

export type SpecLiveReconciliationOptions = {
  targetBranch?: string;
  allowTerminalDisposition?: boolean;
  existingRecoveryAfterRunId?: string;
  reusePriorIntegratedProof?: boolean;
  reviewedScenarioPatch?: boolean;
  inputSourceIsObservation?: boolean;
  preparationResume?: {
    sourceCommit: string;
    summary: string;
    evidence: string[];
  };
};

export function resumedPreparationDecision(
  options: SpecLiveReconciliationOptions,
  sourceCommit: string,
): AgentDecision | null {
  const resume = options.preparationResume;
  if (!resume) return null;
  if (resume.sourceCommit !== sourceCommit) {
    throw new Error(
      `freshness-only preparation resume source ${resume.sourceCommit} does not match task source ${sourceCommit}`,
    );
  }
  return {
    decision: "test-current",
    liveReady: true,
    summary: resume.summary,
    evidence: [...resume.evidence, "freshness-only-resume:accepted"],
  };
}

export type LiveExecutionTarget = {
  target: string;
  standaloneBuildId: string;
};

export function mainPublicationAcceptanceProblem(input: {
  canonicalProofMetadataValid: boolean;
  publicationRequired: boolean;
  pullRequestId?: string;
  evidence: readonly string[];
}): string | null {
  if (!input.canonicalProofMetadataValid) {
    return "canonical live-proof metadata does not identify the exact tested source";
  }
  if (!input.publicationRequired) return null;
  const pullRequestId = nonEmptyString(input.pullRequestId);
  if (!pullRequestId) return "focused pull request publication is missing";
  if (!input.evidence.includes(`review-ready-pull-request:${pullRequestId}`)) {
    return "focused pull request is not proven non-draft and review-ready";
  }
  if (
    !input.evidence.some((item) => item.startsWith("review-ready-handoff:"))
  ) {
    return "actionable review-ready handoff is missing";
  }
  if (
    !input.evidence.some((item) =>
      item.startsWith("current-main-readback:origin/main@"),
    )
  ) {
    return "explicit current origin/main readback is missing";
  }
  return null;
}

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

export type HistoryOnlyAncestryInput = {
  strategy: typeof historyOnlyAncestryStrategy;
  testedSourceCommit: string;
  sourceBranch: string;
};

export function historyOnlyAncestryInput(
  input: Record<string, unknown> | undefined,
): { contract: HistoryOnlyAncestryInput | null; problem: string | null } {
  const rawStrategy = input?.integrationStrategy;
  if (rawStrategy === undefined) return { contract: null, problem: null };
  if (rawStrategy !== historyOnlyAncestryStrategy) {
    return {
      contract: null,
      problem: `integrationStrategy must equal ${historyOnlyAncestryStrategy}`,
    };
  }
  const testedSourceCommit = nonEmptyString(input?.testedSourceCommit);
  const sourceBranch = nonEmptyString(input?.sourceBranch).replace(
    /^refs\/heads\//,
    "",
  );
  if (!/^[0-9a-f]{40}$/i.test(testedSourceCommit)) {
    return {
      contract: null,
      problem:
        "history-only-ancestry requires an exact 40-character testedSourceCommit",
    };
  }
  if (!sourceBranch) {
    return {
      contract: null,
      problem: "history-only-ancestry requires an exact sourceBranch",
    };
  }
  return {
    contract: {
      strategy: historyOnlyAncestryStrategy,
      testedSourceCommit,
      sourceBranch,
    },
    problem: null,
  };
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
  allowAuthoritativePass = false,
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
  if (
    decision.decision === "accepted-pass" &&
    (allowExistingRecovery || allowAuthoritativePass)
  ) {
    return null;
  }
  return allowExistingRecovery || allowAuthoritativePass
    ? "preparation must return committed, test-current, accepted-pass from exact recovery/current-source proof, waiting, or needs-owner"
    : "preparation cannot accept a prior run as proof for the rewritten source; return test-current to dispatch it, commit a repair, wait on an exact fact, or identify a genuine ownership boundary";
}

export function terminalDispositionDecisionProblem(
  decision: AgentDecision,
  allowTerminalDisposition = true,
): string | null {
  if (decision.decision !== "terminal-disposition") return null;
  if (!allowTerminalDisposition) {
    return "terminal-disposition is forbidden because this task requires exact passing live proof";
  }
  if (!decision.terminalDisposition) {
    return "terminal-disposition requires structured specId, status, and specState";
  }
  if (decision.liveReady !== undefined || decision.condition !== undefined) {
    return "terminal-disposition is neither live readiness nor a wait; omit liveReady and condition";
  }
  return null;
}

export function exactPassNeedsOwnerProblem(
  decision: AgentDecision,
  allowTerminalDisposition = true,
): string | null {
  if (decision.decision !== "needs-owner") {
    return null;
  }
  const judgmentText = [decision.summary, ...decision.evidence]
    .join("\n")
    .toLowerCase();
  const internalSourceGapIndicators = [
    "bounded same-task source repair",
    "same-task source repair",
    "current source still",
    "direct carrier still",
    "scenario library still",
    "source gap",
    "source defect",
    "carrier defect",
    "carrier-cap",
    "over-cap carrier",
    "patch applied but uncommitted",
  ];
  const internalSourceGap = internalSourceGapIndicators.find((indicator) =>
    judgmentText.includes(indicator),
  );
  const verifiedDirtyRepair =
    ["completion guardrail", "bounded guardrail"].some((indicator) =>
      judgmentText.includes(indicator),
    ) &&
    [
      "uncommitted",
      "not yet committed",
      "before the source checkpoint could be committed",
      "before commit",
      "no commit was made",
    ].some((indicator) => judgmentText.includes(indicator)) &&
    ["verified", "locally verified", "checks passed", " pass, 0 fail"].some(
      (indicator) => judgmentText.includes(indicator),
    );
  if (internalSourceGap || verifiedDirtyRepair) {
    const reason = internalSourceGap || "verified dirty repair";
    return `needs-owner cannot defer a confirmed internal source gap (${reason}); keep the bounded repair in this workflow even when terminal disposition is available`;
  }
  if (allowTerminalDisposition) return null;
  const requiredEvidencePrefixes = [
    "external-capability:",
    "external-producer:",
    "artifact:",
    "resume-condition:",
  ];
  const missingPrefixes = requiredEvidencePrefixes.filter(
    (prefix) => !decision.evidence.some((entry) => entry.startsWith(prefix)),
  );
  return missingPrefixes.length > 0
    ? `needs-owner cannot defer an exact-pass task without a precise external ownership boundary; keep internal source gaps in this workflow, use waiting for an observable external fact, or identify the unavailable capability with ${missingPrefixes.join(", ")} evidence`
    : null;
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

export function scenarioIntegrationReplayBase(
  input: {
    workspaceDir: string;
    recordedTaskBase: string;
    replayState: ScenarioReplayState | null;
    sourceCommit: string;
    targetRef: string;
  },
  runGit: GitCommand = git,
): string {
  const validAncestor = (candidate: string): boolean =>
    /^[0-9a-f]{40}$/i.test(candidate) &&
    runGit(
      input.workspaceDir,
      ["merge-base", "--is-ancestor", candidate, input.sourceCommit],
      true,
    ).status === 0;

  const persistedReplayBase =
    input.replayState?.sourceCommit === input.sourceCommit
      ? input.replayState.replayBase
      : "";
  if (validAncestor(persistedReplayBase)) return persistedReplayBase;
  if (validAncestor(input.recordedTaskBase)) return input.recordedTaskBase;

  const mergeBase = runGit(
    input.workspaceDir,
    ["merge-base", input.sourceCommit, input.targetRef],
    true,
  );
  return mergeBase.status === 0 && validAncestor(mergeBase.stdout)
    ? mergeBase.stdout
    : "";
}

export function novelScenarioReplayCommits(cherryOutput: string): string[] {
  return cherryOutput
    .split(/\r?\n/)
    .map((line) => /^\+\s+([0-9a-f]{40})(?:\s|$)/i.exec(line.trim())?.[1] ?? "")
    .filter(Boolean);
}

export function cherryPickScenarioReplayCommits(
  workspaceDir: string,
  commits: string[],
  runGit: GitCommand = git,
): {
  status: number;
  stdout: string;
  stderr: string;
  skippedCommits: string[];
} {
  if (!commits.length) {
    return { status: 0, stdout: "", stderr: "", skippedCommits: [] };
  }

  let result = runGit(workspaceDir, ["cherry-pick", ...commits], true);
  const skippedCommits: string[] = [];
  while (result.status !== 0 && skippedCommits.length < commits.length) {
    const cherryPickHead = runGit(
      workspaceDir,
      ["rev-parse", "--verify", "CHERRY_PICK_HEAD"],
      true,
    );
    const indexIsEmpty =
      runGit(workspaceDir, ["diff", "--cached", "--quiet"], true).status === 0;
    const worktreeIsEmpty =
      runGit(workspaceDir, ["diff", "--quiet"], true).status === 0;
    if (
      cherryPickHead.status !== 0 ||
      !cherryPickHead.stdout ||
      !indexIsEmpty ||
      !worktreeIsEmpty
    ) {
      break;
    }

    skippedCommits.push(cherryPickHead.stdout);
    result = runGit(workspaceDir, ["cherry-pick", "--skip"], true);
  }

  return { ...result, skippedCommits };
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
  boundedChangedFiles?: unknown;
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

  const boundedChangedFiles = repoRelativePaths(input.boundedChangedFiles);
  if (boundedChangedFiles.length) {
    const evidence = [
      `dispatch-replay-from:${candidateCommit}`,
      `dispatch-replay-target:${targetRef}@${targetCommit}`,
      `dispatch-bounded-paths:${boundedChangedFiles.join(",")}`,
    ];
    const boundedPatch = git(
      workspaceDir,
      [
        "diff",
        "--binary",
        targetCommit,
        candidateCommit,
        "--",
        ...boundedChangedFiles,
      ],
      true,
    );
    if (boundedPatch.status !== 0) {
      return {
        state: "error",
        error: "dispatch replay could not isolate the task-bounded patch",
        evidence: [
          ...evidence,
          `bounded-diff-error:${boundedPatch.stderr || boundedPatch.stdout}`,
        ],
      };
    }
    const reset = git(workspaceDir, ["reset", "--hard", targetCommit], true);
    if (reset.status !== 0) {
      return {
        state: "error",
        error: "dispatch replay could not reset to current target",
        evidence: [...evidence, `reset-error:${reset.stderr || reset.stdout}`],
      };
    }
    if (!boundedPatch.stdout) {
      return {
        state: "ready",
        sourceCommit: targetCommit,
        targetCommit,
        expectedRemoteCommit,
        taskCommits: [],
        evidence: [
          ...evidence,
          "dispatch-bounded-delta:none",
          `dispatch-replayed-source:${targetCommit}`,
        ],
        replayed: true,
      };
    }

    const patchPath = join(
      tmpdir(),
      `spec-live-bounded-${createHash("sha256").update(boundedPatch.stdout).digest("hex")}.patch`,
    );
    try {
      writeFileSync(patchPath, boundedPatch.stdout);
      const apply = git(
        workspaceDir,
        ["apply", "--index", "--binary", patchPath],
        true,
      );
      if (apply.status !== 0) {
        git(workspaceDir, ["reset", "--hard", targetCommit], true);
        return {
          state: "conflict",
          targetCommit,
          expectedRemoteCommit,
          taskCommits: [],
          evidence,
          error: apply.stderr || apply.stdout || "bounded patch apply failed",
        };
      }
      const commit = git(
        workspaceDir,
        ["commit", "-m", "Replay bounded task changes onto fresh base"],
        true,
      );
      if (commit.status !== 0) {
        git(workspaceDir, ["reset", "--hard", targetCommit], true);
        return {
          state: "error",
          error: "dispatch replay could not commit the bounded patch",
          evidence: [
            ...evidence,
            `commit-error:${commit.stderr || commit.stdout}`,
          ],
        };
      }
    } finally {
      rmSync(patchPath, { force: true });
    }

    const sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    const replayedPaths = changedPathsBetweenCommits(
      workspaceDir,
      targetCommit,
      sourceCommit,
    );
    if (
      cleanWorkspace(workspaceDir) ||
      replayedPaths.some((path) => !boundedChangedFiles.includes(path))
    ) {
      return {
        state: "error",
        error: "dispatch replay produced source outside the task-bounded paths",
        evidence: [
          ...evidence,
          `dispatch-replayed-paths:${replayedPaths.join(",") || "none"}`,
        ],
      };
    }
    return {
      state: "ready",
      sourceCommit,
      targetCommit,
      expectedRemoteCommit,
      taskCommits: [],
      evidence: [
        ...evidence,
        `dispatch-replayed-paths:${replayedPaths.join(",")}`,
        `dispatch-replayed-source:${sourceCommit}`,
      ],
      replayed: true,
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
  const replay = cherryPickScenarioReplayCommits(workspaceDir, taskCommits);
  if (replay.skippedCommits.length) {
    evidence.push(
      `dispatch-skipped-empty-equivalent-commits:${replay.skippedCommits.join(",")}`,
    );
  }
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

function repoRelativePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(nonEmptyString)
        .filter(
          (path) =>
            path &&
            !path.startsWith("/") &&
            !path.startsWith("-") &&
            !path.split("/").includes(".."),
        ),
    ),
  ].sort();
}

function changedPathsBetweenCommits(
  repoDir: string,
  baseCommit: string,
  sourceCommit: string,
): string[] {
  if (!baseCommit || !sourceCommit) return [];
  const result = git(
    repoDir,
    ["diff", "--name-only", baseCommit, sourceCommit, "--"],
    true,
  );
  if (result.status !== 0) return [];
  return repoRelativePaths(result.stdout.split(/\r?\n/));
}

export function semanticInvalidationSourceState(input: {
  repoDir: string;
  invalidatedCommit: string;
  candidateCommit: string;
  paths: unknown;
}): { changed: boolean; paths: string[]; problem?: string } {
  const paths = repoRelativePaths(input.paths);
  if (!input.invalidatedCommit || !input.candidateCommit || !paths.length) {
    return {
      changed: false,
      paths,
      problem:
        "semantic invalidation requires exact invalidated and candidate commits plus at least one structured source path",
    };
  }
  const result = git(
    input.repoDir,
    [
      "diff",
      "--quiet",
      input.invalidatedCommit,
      input.candidateCommit,
      "--",
      ...paths,
    ],
    true,
  );
  if (result.status === 0) return { changed: false, paths };
  if (result.status === 1) return { changed: true, paths };
  return {
    changed: false,
    paths,
    problem: `could not compare semantic-invalidation source paths: ${result.stderr || result.stdout || `git exited ${result.status}`}`,
  };
}

export function frozenCandidateContentEquivalent(input: {
  repoDir: string;
  sourceCommit: string;
  targetCommit: string;
  boundedSourceFiles: unknown;
}): { equivalent: boolean; paths: string[] } {
  const paths = repoRelativePaths(input.boundedSourceFiles);
  if (!paths.length || !input.sourceCommit || !input.targetCommit) {
    return { equivalent: false, paths };
  }
  for (const path of paths) {
    const sourceExists =
      git(
        input.repoDir,
        ["cat-file", "-e", `${input.sourceCommit}:${path}`],
        true,
      ).status === 0;
    const targetExists =
      git(
        input.repoDir,
        ["cat-file", "-e", `${input.targetCommit}:${path}`],
        true,
      ).status === 0;
    if (sourceExists !== targetExists) {
      return { equivalent: false, paths };
    }
  }
  return {
    equivalent:
      git(
        input.repoDir,
        [
          "diff",
          "--quiet",
          input.sourceCommit,
          input.targetCommit,
          "--",
          ...paths,
        ],
        true,
      ).status === 0,
    paths,
  };
}

export function boundedSourceEquivalentToTarget(input: {
  repoDir: string;
  sourceCommit: string;
  targetCommit: string;
}): { equivalent: boolean; paths: string[] } {
  if (!input.repoDir || !input.sourceCommit || !input.targetCommit) {
    return { equivalent: false, paths: [] };
  }
  const mergeBase = git(
    input.repoDir,
    ["merge-base", input.sourceCommit, input.targetCommit],
    true,
  );
  if (mergeBase.status !== 0 || !mergeBase.stdout) {
    return { equivalent: false, paths: [] };
  }
  const paths = changedPathsBetweenCommits(
    input.repoDir,
    mergeBase.stdout,
    input.sourceCommit,
  );
  if (!paths.length) {
    return { equivalent: false, paths };
  }
  return frozenCandidateContentEquivalent({
    repoDir: input.repoDir,
    sourceCommit: input.sourceCommit,
    targetCommit: input.targetCommit,
    boundedSourceFiles: paths,
  });
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

function mergeSafeScenarioAggregatePath(path: string): boolean {
  return (
    /^features\/[^/]+\/compact\/staging\.plan\.json$/.test(path) ||
    /^ci\/plans\/[A-Za-z0-9._-]+\.json$/.test(path)
  );
}

export function resolveLivePlanDispatch(input: {
  taskInput?: Record<string, unknown>;
}): {
  planPath?: string;
  source:
    | "livePlanPath"
    | "postPlanPathRepairVerification.requiredPlanPath"
    | null;
  evidence: string[];
} {
  const taskInput = jsonRecord(input.taskInput);
  const explicitLivePlanPath = nonEmptyString(taskInput.livePlanPath);
  if (explicitLivePlanPath) {
    return {
      planPath: explicitLivePlanPath,
      source: "livePlanPath",
      evidence: [
        `live-plan-path:${explicitLivePlanPath}`,
        "live-plan-path-source:livePlanPath",
      ],
    };
  }

  const repairVerification = jsonRecord(
    taskInput.postPlanPathRepairVerification,
  );
  const requiredPlanPath = nonEmptyString(repairVerification.requiredPlanPath);
  if (requiredPlanPath) {
    return {
      planPath: requiredPlanPath,
      source: "postPlanPathRepairVerification.requiredPlanPath",
      evidence: [
        `live-plan-path:${requiredPlanPath}`,
        "live-plan-path-source:postPlanPathRepairVerification.requiredPlanPath",
      ],
    };
  }

  return { source: null, evidence: [] };
}

export function compactPlanPipelineParameters(planPath: string): string[] {
  if (!planPath) return [];
  if (!mergeSafeScenarioAggregatePath(planPath)) {
    throw new Error(`Invalid compact live plan path: ${planPath}`);
  }
  return [`plan_path=${planPath}`];
}

export function queueRunPipelineParameters(input: {
  specId: string;
  target: string;
  standaloneBuildId: string;
  planPath?: string;
  metadata: string;
}): string[] {
  return [
    `specs=${input.specId}`,
    ...compactPlanPipelineParameters(input.planPath || ""),
    `target=${input.target}`,
    ...(input.standaloneBuildId
      ? [`standalone_build_id=${input.standaloneBuildId}`]
      : []),
    "slices=1",
    "slice_max_parallel=1",
    `metadata=${input.metadata}`,
  ];
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

export function mergeAcceptedTargetAdvanceProof(input: {
  workspaceDir: string;
  sourceCommit: string;
  targetRef: string;
  protectedSourcePaths: string[];
}):
  | { state: "merged"; mergedCommit: string }
  | {
      state: "reverify";
      reason:
        | "merge-conflict"
        | "protected-path-changed"
        | "merge-commit-failed";
    } {
  const merge = git(
    input.workspaceDir,
    ["merge", "--no-ff", "--no-commit", input.targetRef],
    true,
  );
  if (merge.status !== 0) {
    git(input.workspaceDir, ["merge", "--abort"], true);
    return { state: "reverify", reason: "merge-conflict" };
  }

  const changedTestedPath = input.protectedSourcePaths.length
    ? git(
        input.workspaceDir,
        [
          "diff",
          "--quiet",
          input.sourceCommit,
          "--",
          ...input.protectedSourcePaths,
        ],
        true,
      ).status
    : 0;
  if (changedTestedPath !== 0) {
    git(input.workspaceDir, ["merge", "--abort"], true);
    return { state: "reverify", reason: "protected-path-changed" };
  }

  const mergeCommit = git(input.workspaceDir, ["commit", "--no-edit"], true);
  if (mergeCommit.status !== 0) {
    git(input.workspaceDir, ["merge", "--abort"], true);
    return { state: "reverify", reason: "merge-commit-failed" };
  }

  return {
    state: "merged",
    mergedCommit: git(input.workspaceDir, ["rev-parse", "HEAD"]).stdout,
  };
}

export function targetAdvanceProofDecisionProblem(
  decision: AgentDecision,
): string | null {
  if (!["accepted-pass", "test-current"].includes(decision.decision)) {
    return "target-advance proof review must return accepted-pass when the exact live proof still applies or test-current when current source requires a fresh exact run";
  }
  if (
    (decision.liveReady !== undefined &&
      !(
        decision.decision === "accepted-pass" && decision.liveReady === true
      )) ||
    decision.condition !== undefined ||
    decision.terminalDisposition !== undefined ||
    decision.recovery !== undefined
  ) {
    return "target-advance proof review is a bounded judgment only; accepted-pass may redundantly confirm liveReady=true, but omit liveReady otherwise and omit condition, terminalDisposition, and recovery";
  }
  return null;
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

export function artifactProvesPreClaimCapacityBlock(
  path: string,
  specId: string,
): boolean {
  const artifact = readJsonRecord(path);
  if (!artifact || nonEmptyString(artifact.specId) !== specId) return false;
  if (
    !["error", "fail", "failed", "blocked"].includes(
      nonEmptyString(artifact.status).toLowerCase(),
    )
  ) {
    return false;
  }

  const records = artifactRecordChain(artifact);
  const assertions = records
    .flatMap((record) =>
      Array.isArray(record.assertions) ? record.assertions : [],
    )
    .map(jsonRecord);
  const capacityFailure = assertions.some(
    (assertion) =>
      assertion.verdictImpact === "setup" &&
      assertion.ok === false &&
      /AKSCapacityHeavyUsage/i.test(nonEmptyString(assertion.detail)),
  );
  const observedClaim = assertions.some(
    (assertion) => assertion.verdictImpact === "claim",
  );
  const cleanupComplete = records.some((record) => {
    const cleanup = jsonRecord(record.cleanup);
    return (
      cleanup.attempted === true &&
      ["complete", "pass", "passed"].includes(
        nonEmptyString(cleanup.status).toLowerCase(),
      )
    );
  });
  return capacityFailure && !observedClaim && cleanupComplete;
}

export function standaloneRetryTargetProblem(input: {
  standaloneBuildId: string;
  hasSameSpecArtifact: boolean;
}): string | null {
  if (!input.standaloneBuildId || input.hasSameSpecArtifact) return null;
  return `Unchanged retry on standalone_build_id=${input.standaloneBuildId} is refused because the terminal run produced no same-spec artifact. The exact standalone target may have expired; return this task to its owner so a current build can supersede it in a new task generation.`;
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
  standaloneBuildId = "",
): boolean {
  const artifact = readJsonRecord(path);
  if (!artifact) return false;
  const target = jsonRecord(artifact.target);
  const observedTargetNames = [
    nonEmptyString(target.name),
    nonEmptyString(target.environment),
  ];
  const directTargetMatch = observedTargetNames.includes(targetName);
  const standaloneResolutionMatch =
    targetName === defaultLiveTarget &&
    Boolean(standaloneBuildId) &&
    observedTargetNames.includes("standalone");
  if (!directTargetMatch && !standaloneResolutionMatch) {
    return false;
  }
  if (standaloneResolutionMatch) {
    return Boolean(
      nonEmptyString(target.subscriptionId) && nonEmptyString(target.location),
    );
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

export function canonicalAggregateSpecId(specIds: string[]): string {
  return [...specIds].sort().join(",");
}

export function candidateReviewedRunProof(input: {
  taskId: string;
  generation: number;
  providerGeneration: number;
  specIds: string[];
  target: string;
  standaloneBuildId: string;
  sourceBranch: string;
  sourceCommit: string;
  runId: string;
  runResult: string;
  reviewedAt?: string;
}): ReviewedRunProof {
  return {
    version: 1,
    taskId: input.taskId,
    generation: input.generation,
    providerGeneration: input.providerGeneration,
    specId: canonicalAggregateSpecId(input.specIds),
    target: input.target,
    ...(input.standaloneBuildId
      ? { standaloneBuildId: input.standaloneBuildId }
      : {}),
    sourceBranch: input.sourceBranch,
    sourceCommit: input.sourceCommit,
    runId: input.runId,
    runResult: input.runResult,
    verdict: "pass",
    summary: "candidate terminal run proof",
    evidence: [],
    reviewedAt: input.reviewedAt ?? new Date().toISOString(),
  };
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
  providerTaskIds?: string[];
  integrationTargetRef?: string;
}): TaskVerificationResult {
  const problems: string[] = [];
  const proof = input.proof;
  const requireIntegration = input.requireIntegration !== false;
  const integrationTargetRef =
    nonEmptyString(input.integrationTargetRef) || "origin/dev";
  const expectedSpecId = canonicalAggregateSpecId(input.specIds);
  const providerTaskIds = [
    input.taskId,
    ...(input.providerTaskIds ?? []),
  ].filter(
    (value, index, values) => Boolean(value) && values.indexOf(value) === index,
  );
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
      if (proof.targetRef !== integrationTargetRef)
        problems.push(`proof target ref is not ${integrationTargetRef}`);
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
    if (!providerTaskIds.includes(nonEmptyString(metadata.taskId))) {
      problems.push(
        `provider metadata task id does not match any accepted lineage (${providerTaskIds.join(", ")})`,
      );
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
      artifactProvesTarget(path, input.target, input.standaloneBuildId),
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
      problems.push(
        `tested source is not reachable from current ${integrationTargetRef}`,
      );
    if (!input.integratedCommitReachable) {
      problems.push(
        `proof integrated commit is not reachable from current ${integrationTargetRef}`,
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
          ? `Verified exact ADO live proof, cleanup, and ${integrationTargetRef} integration.`
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
  "A waiting Condition must describe an external observable fact, use a typed subject such as project:aks-rp-e2e, pipeline-run:<id>, or pull-request:<id>, and use one event type this app actually observes: pipeline-run.state, pipeline.spec.observed, pull-request.state, project.approval.submitted, aks.repo-ref.observed, aks.node-image-publication.state, or aks.master-validation.capacity-pulse. Use a direct child for required sub-work and dependsOn for task ordering; never turn project state, task state, or task ticks into Conditions. Expected values support exact field equality, or { field, equals|anyOf|notEquals }; do not invent event types, comparison operators, or put prose in subject. The observed fact must be able to advance this exact task and source lineage; reuse an existing approval wait when it already owns the external decision, do not wait on raw aks.master-validation.check, and do not wait for a hypothetical pass on unrelated source.";

const observableConditionTypes = new Set([
  "pipeline-run.state",
  "pipeline.spec.observed",
  "pull-request.state",
  "project.approval.submitted",
  "aks.repo-ref.observed",
  "aks.node-image-publication.state",
  "aks.master-validation.capacity-pulse",
]);

export function masterValidationCapacityPulseConditionProblem(
  condition: Condition,
): string | null {
  if (condition.type === "aks.master-validation.check") {
    return "Wait on aks.master-validation.capacity-pulse, not raw aks.master-validation.check";
  }
  if (condition.type !== "aks.master-validation.capacity-pulse") return null;
  const subjectProject = condition.subject.startsWith("project:")
    ? condition.subject.slice("project:".length)
    : "";
  if (!subjectProject) {
    return "aks.master-validation.capacity-pulse must target one exact project:<projectId> subject";
  }
  if (
    !condition.expected ||
    typeof condition.expected !== "object" ||
    Array.isArray(condition.expected)
  ) {
    return "aks.master-validation.capacity-pulse must match the exact project subject/project only";
  }
  const expected = condition.expected as Record<string, unknown>;
  const exactFutureSlotMatch =
    subjectProject === masterValidationCapacityPulseProjectId &&
    Object.keys(expected).length === 2 &&
    expected.field === "cycleSlot" &&
    Number.isInteger(expected.notEquals) &&
    Number(expected.notEquals) >= 0;
  return exactFutureSlotMatch
    ? null
    : `aks.master-validation.capacity-pulse must target project:${masterValidationCapacityPulseProjectId} and wait for { field: "cycleSlot", notEquals: <baselineCycleSlot> }`;
}

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
  if (!isTypedConditionSubject(condition.subject)) {
    return `Condition subject must be typed, not prose: ${condition.subject}`;
  }
  const capacityPulseProblem =
    masterValidationCapacityPulseConditionProblem(condition);
  if (capacityPulseProblem) return capacityPulseProblem;
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

export type LiveSpecIdSelection =
  | {
      accepted: true;
      auditSpecIds: string[];
      dispatchSpecIds: string[];
      explicit: boolean;
    }
  | {
      accepted: false;
      auditSpecIds: string[];
      dispatchSpecIds: [];
      explicit: true;
      problem: string;
    };

export function resolveLiveSpecIdSelection(
  input: Record<string, unknown> | undefined,
): LiveSpecIdSelection {
  const fallbackSpecIds = scenarioNormalizationSpecIds(
    input as ScenarioNormalizationInput | undefined,
  );
  if (!input || !Object.prototype.hasOwnProperty.call(input, "liveSpecIds")) {
    return {
      accepted: true,
      auditSpecIds: fallbackSpecIds,
      dispatchSpecIds: fallbackSpecIds,
      explicit: false,
    };
  }

  const auditSpecIds = Array.isArray(input.specIds)
    ? input.specIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const rawLiveSpecIds = input.liveSpecIds;
  if (!Array.isArray(rawLiveSpecIds)) {
    return {
      accepted: false,
      auditSpecIds,
      dispatchSpecIds: [],
      explicit: true,
      problem:
        "input.liveSpecIds must be a nonempty array of exact spec ID strings",
    };
  }
  if (rawLiveSpecIds.length === 0) {
    return {
      accepted: false,
      auditSpecIds,
      dispatchSpecIds: [],
      explicit: true,
      problem: "input.liveSpecIds must not be empty when present",
    };
  }

  const dispatchSpecIds: string[] = [];
  const seen = new Set<string>();
  const auditScope = new Set(auditSpecIds);
  for (const value of rawLiveSpecIds) {
    if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
      return {
        accepted: false,
        auditSpecIds,
        dispatchSpecIds: [],
        explicit: true,
        problem: "input.liveSpecIds contains a malformed spec ID",
      };
    }
    if (seen.has(value)) {
      continue;
    }
    if (!auditScope.has(value)) {
      return {
        accepted: false,
        auditSpecIds,
        dispatchSpecIds: [],
        explicit: true,
        problem: `input.liveSpecIds contains ID outside input.specIds: ${value}`,
      };
    }
    seen.add(value);
    dispatchSpecIds.push(value);
  }

  return {
    accepted: true,
    auditSpecIds,
    dispatchSpecIds,
    explicit: true,
  };
}

export function pipelineRunState(run: PipelineRun): string {
  return nonEmptyString(run.status) || nonEmptyString(run.state) || "unknown";
}

export function pullRequestReviewTriggeredForJudgment(
  event: unknown,
  pullRequestId: string,
  review: PullRequestReview,
): boolean {
  const trigger = jsonRecord(event);
  if (!review.available || review.unresolvedCount <= 0) {
    return false;
  }
  const data =
    trigger.data &&
    typeof trigger.data === "object" &&
    !Array.isArray(trigger.data)
      ? (trigger.data as Record<string, unknown>)
      : {};
  const value = (key: string) => trigger[key] ?? data[key];
  return (
    nonEmptyString(trigger.type) === "pull-request.state" &&
    nonEmptyString(value("pullRequestId")) === pullRequestId &&
    nonEmptyString(value("reviewFingerprint")) === review.fingerprint
  );
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
        const exitCode = (error as { code?: unknown } | null)?.code;
        const output = {
          status: typeof exitCode === "number" ? exitCode : error ? 1 : 0,
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

export function scenarioQualityInvariantProblem(
  workspaceDir: string,
  input: ScenarioNormalizationInput | undefined,
): string | null {
  const invariant = scenarioQualityInvariant(workspaceDir, input);
  return invariant.accepted
    ? null
    : invariant.problem || "scenario quality invariant is not satisfied";
}

function git(
  cwd: string,
  args: string[],
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  return command("git", args, { cwd, allowFailure });
}

export type RetainedWorkspaceMaterialization = {
  requested: boolean;
  accepted: boolean;
  changedPaths: string[];
  evidence: string[];
  problem?: string;
};

export function materializePriorRetainedWorkspace(input: {
  workspaceDir: string;
  priorRetainedWorkspace: unknown;
  baselineCommit: unknown;
}): RetainedWorkspaceMaterialization {
  const retainedDir = nonEmptyString(input.priorRetainedWorkspace);
  if (!retainedDir) {
    return {
      requested: false,
      accepted: true,
      changedPaths: [],
      evidence: ["prior-retained-workspace:not-requested"],
    };
  }

  const baselineCommit = nonEmptyString(input.baselineCommit);
  const reject = (
    problem: string,
    evidence: string[] = [],
  ): RetainedWorkspaceMaterialization => ({
    requested: true,
    accepted: false,
    changedPaths: [],
    evidence: [`prior-retained-workspace:${retainedDir}`, ...evidence],
    problem,
  });
  if (!/^[0-9a-f]{40}$/i.test(baselineCommit)) {
    return reject(
      "priorRetainedWorkspace requires an exact 40-character baselineCommit",
    );
  }
  if (!existsSync(retainedDir)) {
    return reject("priorRetainedWorkspace does not exist");
  }

  const retainedInside = git(
    retainedDir,
    ["rev-parse", "--is-inside-work-tree"],
    true,
  );
  const retainedTop = git(retainedDir, ["rev-parse", "--show-toplevel"], true);
  if (
    retainedInside.status !== 0 ||
    retainedInside.stdout !== "true" ||
    retainedTop.status !== 0 ||
    resolve(retainedTop.stdout) !== resolve(retainedDir)
  ) {
    return reject("priorRetainedWorkspace is not a Git worktree root");
  }

  const retainedHead = git(retainedDir, ["rev-parse", "HEAD"], true);
  if (retainedHead.status !== 0 || retainedHead.stdout !== baselineCommit) {
    return reject("priorRetainedWorkspace HEAD does not match baselineCommit", [
      `retained-head:${retainedHead.stdout || "unresolved"}`,
      `baseline-commit:${baselineCommit}`,
    ]);
  }

  const destinationInside = git(
    input.workspaceDir,
    ["rev-parse", "--is-inside-work-tree"],
    true,
  );
  const destinationHead = git(input.workspaceDir, ["rev-parse", "HEAD"], true);
  if (destinationInside.status !== 0 || destinationInside.stdout !== "true") {
    return reject("isolated destination is not a Git worktree");
  }
  if (destinationHead.status !== 0 || !destinationHead.stdout) {
    return reject("could not resolve isolated destination HEAD", [
      `destination-head:${destinationHead.stdout || "unresolved"}`,
      `baseline-commit:${baselineCommit}`,
    ]);
  }
  const baselineIsAncestor =
    git(
      input.workspaceDir,
      ["merge-base", "--is-ancestor", baselineCommit, destinationHead.stdout],
      true,
    ).status === 0;
  if (!baselineIsAncestor) {
    return reject(
      "baselineCommit is not an ancestor of isolated destination HEAD",
      [
        `destination-head:${destinationHead.stdout}`,
        `baseline-commit:${baselineCommit}`,
        "retained-baseline-ancestry:not-ancestor",
      ],
    );
  }
  const destinationStatus = git(
    input.workspaceDir,
    ["status", "--porcelain"],
    true,
  );
  if (destinationStatus.status !== 0 || destinationStatus.stdout) {
    return reject("isolated destination is dirty; refusing to overwrite it", [
      `destination-status:${destinationStatus.stdout || "unresolved"}`,
    ]);
  }

  const readRawTrackedDiff = (cwd: string) => {
    const result = spawnSync("git", ["diff", "--binary", "HEAD", "--"], {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: (result.stderr || result.error?.message || "").trim(),
    };
  };
  const retainedDiff = readRawTrackedDiff(retainedDir);
  if (retainedDiff.status !== 0) {
    return reject(
      "could not read tracked changes from priorRetainedWorkspace",
      [`retained-diff-error:${retainedDiff.stderr || "unknown"}`],
    );
  }
  const changedPathsResult = git(
    retainedDir,
    ["diff", "--name-only", "HEAD", "--"],
    true,
  );
  if (changedPathsResult.status !== 0) {
    return reject(
      "could not enumerate tracked changes from priorRetainedWorkspace",
    );
  }
  const changedPaths = repoRelativePaths(
    changedPathsResult.stdout.split(/\r?\n/),
  );
  if (retainedDiff.stdout) {
    const apply = spawnSync(
      "git",
      ["apply", "--3way", "--index", "--binary", "-"],
      {
        cwd: input.workspaceDir,
        encoding: "utf8",
        input: retainedDiff.stdout,
      },
    );
    if (apply.status !== 0) {
      const applyError = (apply.stderr || apply.stdout || "failed").trim();
      const restore = git(
        input.workspaceDir,
        ["reset", "--hard", destinationHead.stdout],
        true,
      );
      const restoredHead = git(input.workspaceDir, ["rev-parse", "HEAD"], true);
      const restoredStatus = git(
        input.workspaceDir,
        ["status", "--porcelain"],
        true,
      );
      return reject(
        "retained tracked diff conflicts with advanced destination lineage",
        [
          `destination-head:${destinationHead.stdout}`,
          `baseline-commit:${baselineCommit}`,
          "retained-baseline-ancestry:ancestor",
          `git-apply-3way:${applyError}`,
          `destination-restore:${
            restore.status === 0 &&
            restoredHead.stdout === destinationHead.stdout &&
            !restoredStatus.stdout
              ? "clean"
              : `failed:${restore.stderr || restore.stdout || restoredStatus.stdout || restoredHead.stdout}`
          }`,
        ],
      );
    }
  }

  const destinationDiff = readRawTrackedDiff(input.workspaceDir);
  const materializedPathsResult = git(
    input.workspaceDir,
    ["diff", "--name-only", "HEAD", "--"],
    true,
  );
  const materializedPaths = repoRelativePaths(
    materializedPathsResult.stdout.split(/\r?\n/),
  );
  const unmerged = git(input.workspaceDir, ["ls-files", "-u"], true);
  const diffCheck = git(
    input.workspaceDir,
    ["diff", "--check", "HEAD", "--"],
    true,
  );
  if (
    destinationDiff.status !== 0 ||
    materializedPathsResult.status !== 0 ||
    unmerged.status !== 0 ||
    unmerged.stdout ||
    diffCheck.status !== 0 ||
    JSON.stringify(materializedPaths) !== JSON.stringify(changedPaths)
  ) {
    git(input.workspaceDir, ["reset", "--hard", destinationHead.stdout], true);
    return reject(
      "three-way retained-diff materialization failed verification",
      [
        `destination-head:${destinationHead.stdout}`,
        `materialized-paths:${materializedPaths.join(",") || "none"}`,
        `expected-paths:${changedPaths.join(",") || "none"}`,
        `unmerged-paths:${unmerged.stdout || "none"}`,
        `diff-check:${diffCheck.stderr || diffCheck.stdout || "clean"}`,
        "destination-restore:attempted",
      ],
    );
  }
  const diffHash = createHash("sha256")
    .update(retainedDiff.stdout)
    .digest("hex");
  return {
    requested: true,
    accepted: true,
    changedPaths,
    evidence: [
      `prior-retained-workspace:${retainedDir}`,
      `retained-baseline:${baselineCommit}`,
      `destination-initial-head:${destinationHead.stdout}`,
      "retained-baseline-ancestry:ancestor",
      `retained-tracked-paths:${changedPaths.join(",") || "none"}`,
      `retained-diff-sha256:${diffHash}`,
      "retained-diff-operation:git-apply-3way-index",
      "retained-diff-materialized:exact",
    ],
  };
}

export type FreshBaseLineageAdmission = {
  required: boolean;
  accepted: boolean;
  candidateCommit: string;
  baseRef: string;
  freshBaseCommit: string;
  mergeBase: string;
  behind: number;
  ahead: number;
  evidence: string[];
};

export function freshBaseLineageAdmission(input: {
  workspaceDir: string;
  candidateCommit: string;
  requireFreshBaseAtDispatch: boolean;
  baseRef: unknown;
}): FreshBaseLineageAdmission {
  const baseRef = nonEmptyString(input.baseRef);
  const initial: FreshBaseLineageAdmission = {
    required: input.requireFreshBaseAtDispatch,
    accepted: !input.requireFreshBaseAtDispatch,
    candidateCommit: input.candidateCommit,
    baseRef,
    freshBaseCommit: "",
    mergeBase: "",
    behind: 0,
    ahead: 0,
    evidence: [],
  };
  if (!input.requireFreshBaseAtDispatch) return initial;

  const normalized = baseRef.replace(/^refs\/remotes\//, "");
  const branch = normalized.startsWith("origin/")
    ? normalized.slice("origin/".length)
    : normalized.startsWith("refs/heads/")
      ? normalized.slice("refs/heads/".length)
      : !normalized.includes("/")
        ? normalized
        : "";
  if (!baseRef || !branch) {
    return {
      ...initial,
      evidence: [
        `candidate-commit:${input.candidateCommit}`,
        `fresh-base-ref:${baseRef || "missing"}`,
        "fresh-base-lineage:refused-invalid-base-ref",
        "push:not-attempted",
        "pipeline-run:not-created",
      ],
    };
  }

  const fetch = git(
    input.workspaceDir,
    ["fetch", "--no-tags", "origin", branch],
    true,
  );
  const authorityRef = `origin/${branch}`;
  const resolved =
    fetch.status === 0
      ? git(input.workspaceDir, ["rev-parse", `${authorityRef}^{commit}`], true)
      : { status: 1, stdout: "", stderr: fetch.stderr || fetch.stdout };
  const freshBaseCommit = resolved.status === 0 ? resolved.stdout : "";
  const mergeBaseResult = freshBaseCommit
    ? git(
        input.workspaceDir,
        ["merge-base", freshBaseCommit, input.candidateCommit],
        true,
      )
    : { status: 1, stdout: "", stderr: "" };
  const mergeBase = mergeBaseResult.status === 0 ? mergeBaseResult.stdout : "";
  const counts = freshBaseCommit
    ? git(
        input.workspaceDir,
        [
          "rev-list",
          "--left-right",
          "--count",
          `${freshBaseCommit}...${input.candidateCommit}`,
        ],
        true,
      )
    : { status: 1, stdout: "", stderr: "" };
  const [behind = 0, ahead = 0] =
    counts.status === 0
      ? counts.stdout.split(/\s+/).map((value) => Number(value) || 0)
      : [];
  const accepted =
    Boolean(freshBaseCommit) &&
    git(
      input.workspaceDir,
      ["merge-base", "--is-ancestor", freshBaseCommit, input.candidateCommit],
      true,
    ).status === 0;
  const evidence = [
    `candidate-commit:${input.candidateCommit}`,
    `fresh-base-ref:${baseRef}`,
    `fresh-base-commit:${freshBaseCommit || "unresolved"}`,
    `merge-base:${mergeBase || "unresolved"}`,
    `fresh-base-behind-ahead:${behind}/${ahead}`,
    `fresh-base-lineage:${accepted ? "accepted" : "refused"}`,
  ];
  if (!accepted) {
    evidence.push(
      `fresh-base-fetch:${fetch.status === 0 ? "succeeded" : `failed:${fetch.stderr || fetch.stdout}`}`,
      "push:not-attempted",
      "pipeline-run:not-created",
    );
  }
  return {
    ...initial,
    accepted,
    freshBaseCommit,
    mergeBase,
    behind,
    ahead,
    evidence,
  };
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

function specFileForSpecAtCommit(
  repoDir: string,
  commit: string,
  specId: string,
): string {
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
  if (candidates.status !== 0 && !candidates.stdout) return "";
  for (const candidate of candidates.stdout.split(/\r?\n/).filter(Boolean)) {
    const marker = `${commit}:`;
    const path = candidate.startsWith(marker)
      ? candidate.slice(marker.length)
      : candidate;
    const spec = jsonObjectAtCommit(repoDir, commit, path);
    if (spec && nonEmptyString(spec.id) === specId) return path;
  }
  return "";
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

export type ScenarioNormalizationReplay =
  | {
      state: "replayed";
      sourceCommit: string;
      resultingCommit: string;
      selectedCommits: string[];
      changedPaths: string[];
      protectedPathsEquivalent: boolean;
    }
  | {
      state: "conflicted";
      sourceCommit: string;
      selectedCommits: string[];
      conflictedPaths: string[];
      error?: string;
    }
  | {
      state: "invalid";
      sourceCommit: string;
      reason: string;
      evidence: string[];
    };

function scenarioReplayAllowedPath(
  path: string,
  featureRoots: string[],
): boolean {
  if (
    featureRoots.some(
      (root) =>
        path === root || path === `${root}.yaml` || path.startsWith(`${root}/`),
    )
  ) {
    return true;
  }
  if (path.startsWith("features/")) {
    return false;
  }
  return (
    !mergeSafeScenarioAggregatePath(path) &&
    !proofNeutralScenarioSourcePath(path)
  );
}

/** Rebuild one scenario-normalization patch on current target without merging stale history. */
export function replayScenarioNormalizationOntoTarget(
  input: {
    workspaceDir: string;
    recordedBaseCommit: string;
    sourceCommit: string;
    targetRef: string;
    anchorPaths: string[];
    featureIds?: string[];
  },
  runGit: GitCommand = git,
): ScenarioNormalizationReplay {
  const anchors = repoRelativePaths(input.anchorPaths);
  const featureRoots = [
    ...new Set([
      ...(input.featureIds ?? [])
        .filter((value) => /^[A-Za-z0-9._-]+$/.test(value))
        .map((value) => `features/${value}`),
      ...anchors
        .map((path) => path.match(/^(features\/[^/]+)/)?.[1] ?? "")
        .filter(Boolean),
    ]),
  ];
  const evidence = [
    `recorded-base:${input.recordedBaseCommit}`,
    `tested-source:${input.sourceCommit}`,
    `target-ref:${input.targetRef}`,
  ];
  if (!anchors.length || !featureRoots.length) {
    return {
      state: "invalid",
      sourceCommit: input.sourceCommit,
      reason: "scenario replay requires exact feature-owned anchor paths",
      evidence,
    };
  }
  if (
    runGit(
      input.workspaceDir,
      [
        "merge-base",
        "--is-ancestor",
        input.recordedBaseCommit,
        input.sourceCommit,
      ],
      true,
    ).status !== 0
  ) {
    return {
      state: "invalid",
      sourceCommit: input.sourceCommit,
      reason: "recorded scenario baseline is not an ancestor of tested source",
      evidence,
    };
  }

  const selectedCommits = runGit(
    input.workspaceDir,
    [
      "rev-list",
      "--reverse",
      "--no-merges",
      `${input.recordedBaseCommit}..${input.sourceCommit}`,
      "--",
      ...featureRoots,
    ],
    true,
  )
    .stdout.split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!selectedCommits.length) {
    return {
      state: "invalid",
      sourceCommit: input.sourceCommit,
      reason:
        "tested source has no task commit touching the owning feature roots",
      evidence: [
        ...evidence,
        ...anchors.map((path) => `anchor:${path}`),
        ...featureRoots.map((path) => `feature-root:${path}`),
      ],
    };
  }

  const selectedPaths = [
    ...new Set(
      selectedCommits.flatMap((commit) =>
        runGit(
          input.workspaceDir,
          ["diff-tree", "--no-commit-id", "--name-only", "-r", commit],
          true,
        )
          .stdout.split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ),
  ].sort();
  const boundedPaths = selectedPaths.filter((path) =>
    scenarioReplayAllowedPath(path, featureRoots),
  );
  if (!boundedPaths.length) {
    return {
      state: "invalid",
      sourceCommit: input.sourceCommit,
      reason: "selected scenario commits contain no owning-feature patch",
      evidence,
    };
  }

  runGit(input.workspaceDir, ["merge", "--abort"], true);
  runGit(input.workspaceDir, ["cherry-pick", "--abort"], true);
  const reset = runGit(
    input.workspaceDir,
    ["reset", "--hard", input.targetRef],
    true,
  );
  if (reset.status !== 0) {
    return {
      state: "invalid",
      sourceCommit: input.sourceCommit,
      reason: "could not reset scenario worktree to current target",
      evidence: [...evidence, reset.stderr || reset.stdout],
    };
  }
  const patchPath = join(
    tmpdir(),
    `aks-scenario-replay-${createHash("sha256")
      .update(
        `${input.workspaceDir}\0${input.recordedBaseCommit}\0${input.sourceCommit}`,
      )
      .digest("hex")}.patch`,
  );
  const patch = spawnSync(
    "git",
    [
      "diff",
      "--binary",
      input.recordedBaseCommit,
      input.sourceCommit,
      "--",
      ...boundedPaths,
    ],
    {
      cwd: input.workspaceDir,
      encoding: null,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (patch.status !== 0 || !patch.stdout?.length) {
    return {
      state: "invalid",
      sourceCommit: input.sourceCommit,
      reason: "could not extract the bounded scenario patch",
      evidence: [
        ...evidence,
        patch.stderr?.toString().trim() || "bounded patch was empty",
      ],
    };
  }
  writeFileSync(patchPath, patch.stdout);
  const replay = runGit(
    input.workspaceDir,
    ["apply", "--3way", "--index", patchPath],
    true,
  );
  rmSync(patchPath, { force: true });
  if (replay.status !== 0) {
    const conflictedPaths = runGit(
      input.workspaceDir,
      ["diff", "--name-only", "--diff-filter=U"],
      true,
    )
      .stdout.split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      state: "conflicted",
      sourceCommit: input.sourceCommit,
      selectedCommits,
      conflictedPaths,
      error: replay.stderr || replay.stdout,
    };
  }

  const staged = runGit(
    input.workspaceDir,
    ["diff", "--cached", "--quiet"],
    true,
  );
  if (staged.status !== 0) {
    const commit = runGit(
      input.workspaceDir,
      [
        "commit",
        "-m",
        `Replay bounded scenario normalization from ${input.sourceCommit.slice(0, 12)}`,
      ],
      true,
    );
    if (commit.status !== 0) {
      return {
        state: "invalid",
        sourceCommit: input.sourceCommit,
        reason: "could not commit the bounded scenario patch",
        evidence: [...evidence, commit.stderr || commit.stdout],
      };
    }
  }

  const resultingCommit = runGit(input.workspaceDir, [
    "rev-parse",
    "HEAD",
  ]).stdout;
  const changedPaths = runGit(
    input.workspaceDir,
    ["diff", "--name-only", input.targetRef, resultingCommit, "--"],
    true,
  )
    .stdout.split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
  const protectedPaths = proofProtectedScenarioPaths(boundedPaths);
  const protectedPathsEquivalent =
    protectedPaths.length > 0 &&
    frozenCandidateContentEquivalent({
      repoDir: input.workspaceDir,
      sourceCommit: input.sourceCommit,
      targetCommit: resultingCommit,
      boundedSourceFiles: protectedPaths,
    }).equivalent;
  return {
    state: "replayed",
    sourceCommit: input.sourceCommit,
    resultingCommit,
    selectedCommits,
    changedPaths: boundedPaths,
    protectedPathsEquivalent,
  };
}

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

export type PreparedSourceRequirement = {
  sourceBranch: string;
  sourceCommit: string;
};

export type AuthoritativeRunReference = {
  runId: string;
  sourceBranch: string;
  sourceCommit: string;
  taskId?: string;
};

export type PriorVerificationInput = {
  runId: string;
  authoritative: boolean;
  acceptedSourceCommit: string;
  kind: "accepted" | "retry" | "prior";
};

export function resolvePriorVerificationInput(
  input: Record<string, unknown> | undefined,
): { value: PriorVerificationInput | null; problem: string | null } {
  if (!input) return { value: null, problem: null };
  const priorRunId = nonEmptyString(input.priorVerificationRunId);
  const retryRunId = nonEmptyString(input.retryPipelineRunId);
  const acceptedRunId = nonEmptyString(input.acceptedRunId);
  const acceptedSourceCommit = nonEmptyString(input.acceptedSourceCommit);
  if (Boolean(acceptedRunId) !== Boolean(acceptedSourceCommit)) {
    return {
      value: null,
      problem:
        "acceptedRunId and acceptedSourceCommit must be declared together",
    };
  }
  const distinctRunIds = [
    ...new Set([priorRunId, retryRunId, acceptedRunId]),
  ].filter(Boolean);
  if (distinctRunIds.length > 1) {
    return {
      value: null,
      problem: `conflicting prior verification run ids: ${distinctRunIds.join(", ")}`,
    };
  }
  const runId = distinctRunIds[0] || "";
  if (!runId) return { value: null, problem: null };
  return {
    value: {
      runId,
      authoritative: Boolean(acceptedRunId || retryRunId),
      acceptedSourceCommit,
      kind: acceptedRunId ? "accepted" : retryRunId ? "retry" : "prior",
    },
    problem: null,
  };
}

export function preparedSourceRequirement(
  input: Record<string, unknown> | undefined,
  inputSourceIsObservation = false,
): PreparedSourceRequirement | null {
  if (!input || inputSourceIsObservation) return null;
  const sourceBranch = nonEmptyString(input.sourceBranch).replace(
    /^refs\/heads\//,
    "",
  );
  const sourceCommit = nonEmptyString(input.sourceCommit);
  if (!sourceBranch || !sourceCommit) return null;
  return { sourceBranch, sourceCommit };
}

export function authoritativeRunReference(
  input: Record<string, unknown> | undefined,
): AuthoritativeRunReference | null {
  if (!input) return null;
  const runId = nonEmptyString(input.authoritativeRunId);
  const sourceBranch = nonEmptyString(input.authoritativeSourceBranch).replace(
    /^refs\/heads\//,
    "",
  );
  const sourceCommit = nonEmptyString(input.authoritativeSourceCommit);
  const taskId = nonEmptyString(input.authoritativeTaskId);
  if (!runId || !sourceBranch || !sourceCommit) return null;
  return {
    runId,
    sourceBranch,
    sourceCommit,
    ...(taskId ? { taskId } : {}),
  };
}

function proofPathFromEvidence(evidence: unknown, appDir: string): string {
  if (!Array.isArray(evidence)) return "";
  const proofEntry = evidence.find(
    (entry): entry is string =>
      typeof entry === "string" && entry.startsWith("proof:"),
  );
  if (!proofEntry) return "";
  const proofPath = proofEntry.slice("proof:".length).trim();
  if (!proofPath) return "";
  return resolve(appDir, proofPath);
}

function completedChildProofPath(
  child: Record<string, unknown>,
  appDir: string,
): string {
  return (
    proofPathFromEvidence(child.evidence, appDir) ||
    proofPathFromEvidence(jsonRecord(child.acceptanceBasis).evidence, appDir)
  );
}

export function inheritedAuthoritativeRunReference(
  payload: TaskPayload | null,
  appDir: string,
  specId: string,
  target: string,
): AuthoritativeRunReference | null {
  if (!payload || !specId || specId.includes(",")) return null;
  const completed = Array.isArray(payload.children?.completed)
    ? [...payload.children.completed]
    : [];
  for (const entry of completed.reverse()) {
    const child = jsonRecord(entry);
    const proofPath = completedChildProofPath(child, appDir);
    if (!proofPath || !existsSync(proofPath)) continue;
    const proof = readJsonRecord(proofPath);
    if (!proof) continue;
    if (nonEmptyString(proof.verdict) !== "pass") continue;
    if (nonEmptyString(proof.specId) !== specId) continue;
    if (nonEmptyString(proof.target) !== target) continue;
    const runId = nonEmptyString(proof.runId);
    const sourceBranch = nonEmptyString(proof.sourceBranch).replace(
      /^refs\/heads\//,
      "",
    );
    const sourceCommit = nonEmptyString(proof.sourceCommit);
    const taskId =
      nonEmptyString(child.taskId) ||
      nonEmptyString(jsonRecord(child.metadata).id) ||
      nonEmptyString(proof.taskId);
    if (!runId || !sourceBranch || !sourceCommit) continue;
    return {
      runId,
      sourceBranch,
      sourceCommit,
      ...(taskId ? { taskId } : {}),
    };
  }
  return null;
}

export function resolvedAuthoritativeRunReference(
  payload: TaskPayload | null,
  appDir: string,
  specId: string,
  target: string,
): AuthoritativeRunReference | null {
  return (
    authoritativeRunReference(payload?.input) ??
    inheritedAuthoritativeRunReference(payload, appDir, specId, target)
  );
}

export type PreparedSourceReconciliation =
  | {
      state: "current" | "merged";
      sourceBranch: string;
      sourceCommit: string;
      resultingCommit: string;
      evidence: string[];
    }
  | {
      state: "conflicted";
      sourceBranch: string;
      sourceCommit: string;
      conflictedPaths: string[];
      evidence: string[];
    }
  | { state: "failed"; evidence: string[]; error: string };

/**
 * Bring an explicitly referenced task source into the current task worktree.
 * The merge preserves both histories so the exact prerequisite remains
 * auditable and cannot be silently dropped before live dispatch.
 */
export function reconcilePreparedTaskSource(
  workspaceDir: string,
  requirement: PreparedSourceRequirement,
  runGit: GitCommand = git,
  retainedSource?: {
    workspaceDir: unknown;
    baselineCommit: unknown;
  },
): PreparedSourceReconciliation {
  const sourceBranch = requirement.sourceBranch.replace(/^refs\/heads\//, "");
  const sourceCommit = requirement.sourceCommit;
  const evidence = [
    `required-source-branch:${sourceBranch}`,
    `required-source-commit:${sourceCommit}`,
  ];
  if (!sourceBranch.startsWith("task/")) {
    return {
      state: "failed",
      evidence,
      error: "prepared source must use a dedicated task branch",
    };
  }
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    return {
      state: "failed",
      evidence,
      error: "prepared source commit must be an exact 40-character Git commit",
    };
  }

  const destinationStatus = runGit(
    workspaceDir,
    ["status", "--porcelain"],
    true,
  );
  if (destinationStatus.status !== 0 || destinationStatus.stdout) {
    return {
      state: "failed",
      evidence: [
        ...evidence,
        `prepared-source-destination-status:${destinationStatus.stdout || "unresolved"}`,
      ],
      error: "prepared source destination must be clean",
    };
  }

  let preparedRef: string;
  if (retainedSource) {
    const retainedDir = nonEmptyString(retainedSource.workspaceDir);
    const baselineCommit = nonEmptyString(retainedSource.baselineCommit);
    const rejectLocal = (problem: string, localEvidence: string[] = []) => ({
      state: "failed" as const,
      evidence: [
        ...evidence,
        `prepared-source-local:${retainedDir || "unresolved"}`,
        ...localEvidence,
      ],
      error: problem,
    });
    if (!retainedDir || !/^[0-9a-f]{40}$/i.test(baselineCommit)) {
      return rejectLocal(
        "local retained prepared source requires a Git root and exact baselineCommit",
      );
    }
    const retainedInside = runGit(
      retainedDir,
      ["rev-parse", "--is-inside-work-tree"],
      true,
    );
    const retainedTop = runGit(
      retainedDir,
      ["rev-parse", "--show-toplevel"],
      true,
    );
    if (
      retainedInside.status !== 0 ||
      retainedInside.stdout !== "true" ||
      retainedTop.status !== 0 ||
      resolve(retainedTop.stdout) !== resolve(retainedDir)
    ) {
      return rejectLocal(
        "local retained prepared source is not a Git worktree root",
      );
    }
    const retainedBranch = runGit(
      retainedDir,
      ["symbolic-ref", "--quiet", "--short", "HEAD"],
      true,
    );
    const retainedHead = runGit(retainedDir, ["rev-parse", "HEAD"], true);
    const localEvidence = [
      `prepared-source-local-branch:${retainedBranch.stdout || "detached"}`,
      `prepared-source-local-head:${retainedHead.stdout || "unresolved"}`,
      `prepared-source-local-baseline:${baselineCommit}`,
    ];
    if (retainedBranch.status !== 0 || retainedBranch.stdout !== sourceBranch) {
      return rejectLocal(
        "local retained prepared source branch does not match sourceBranch",
        localEvidence,
      );
    }
    if (
      retainedHead.status !== 0 ||
      retainedHead.stdout !== sourceCommit ||
      baselineCommit !== sourceCommit
    ) {
      return rejectLocal(
        "local retained prepared source HEAD, sourceCommit, and baselineCommit must match exactly",
        localEvidence,
      );
    }
    preparedRef = "FETCH_HEAD";
    const fetch = runGit(
      workspaceDir,
      ["fetch", "--no-tags", retainedDir, `refs/heads/${sourceBranch}`],
      true,
    );
    if (fetch.status !== 0) {
      return rejectLocal(
        fetch.stderr ||
          fetch.stdout ||
          "local retained prepared source fetch failed",
        localEvidence,
      );
    }
    const fetched = runGit(workspaceDir, ["rev-parse", preparedRef], true);
    if (fetched.status !== 0 || fetched.stdout !== sourceCommit) {
      return rejectLocal(
        "local retained prepared source did not resolve the exact declared commit",
        [
          ...localEvidence,
          `prepared-source-local-ref:${fetched.stdout || "unresolved"}`,
        ],
      );
    }
    evidence.push(...localEvidence, `prepared-source-local-ref:${preparedRef}`);
  } else {
    preparedRef = `refs/remotes/origin/${sourceBranch}`;
    const fetch = runGit(
      workspaceDir,
      ["fetch", "origin", `+refs/heads/${sourceBranch}:${preparedRef}`],
      true,
    );
    if (fetch.status !== 0) {
      return {
        state: "failed",
        evidence,
        error: fetch.stderr || fetch.stdout || "prepared source fetch failed",
      };
    }
    if (
      runGit(
        workspaceDir,
        ["merge-base", "--is-ancestor", sourceCommit, preparedRef],
        true,
      ).status !== 0
    ) {
      return {
        state: "failed",
        evidence: [...evidence, `required-source-remote:${preparedRef}`],
        error:
          "prepared source commit is not present on its declared remote branch",
      };
    }
  }

  const head = runGit(workspaceDir, ["rev-parse", "HEAD"], true);
  if (head.status !== 0 || !head.stdout) {
    return {
      state: "failed",
      evidence,
      error: head.stderr || head.stdout || "task worktree HEAD is unavailable",
    };
  }
  if (
    runGit(
      workspaceDir,
      ["merge-base", "--is-ancestor", sourceCommit, head.stdout],
      true,
    ).status === 0
  ) {
    return {
      state: "current",
      sourceBranch,
      sourceCommit,
      resultingCommit: head.stdout,
      evidence: [...evidence, `prepared-source-current:${head.stdout}`],
    };
  }

  const merge = runGit(
    workspaceDir,
    ["merge", "--no-ff", "--no-edit", sourceCommit],
    true,
  );
  if (merge.status === 0) {
    const resultingCommit = runGit(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    if (
      resultingCommit &&
      runGit(
        workspaceDir,
        ["merge-base", "--is-ancestor", sourceCommit, resultingCommit],
        true,
      ).status === 0
    ) {
      return {
        state: "merged",
        sourceBranch,
        sourceCommit,
        resultingCommit,
        evidence: [...evidence, `prepared-source-merged:${resultingCommit}`],
      };
    }
    return {
      state: "failed",
      evidence,
      error: "prepared source merge did not preserve the required commit",
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
    return {
      state: "conflicted",
      sourceBranch,
      sourceCommit,
      conflictedPaths,
      evidence,
    };
  }
  runGit(workspaceDir, ["merge", "--abort"], true);
  return {
    state: "failed",
    evidence: boundedWorkflowEvidence(evidence),
    error: merge.stderr || merge.stdout || "prepared source merge failed",
  };
}

async function azJson(
  cwd: string,
  args: string[],
  options: { includeProject?: boolean } = {},
): Promise<unknown> {
  const includeProject = options.includeProject !== false;
  const result = await commandAsync(
    azCli,
    [
      ...args,
      "--organization",
      organization,
      ...(includeProject ? ["--project", adoProject] : []),
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

export function summarizeSpecPullRequestReview(
  value: unknown,
): PullRequestReview {
  return summarizeAksPullRequestReview(value);
}

async function pullRequestReview(
  cwd: string,
  pullRequestId: string,
): Promise<PullRequestReview> {
  const review = await azJson(
    cwd,
    [
      "devops",
      "invoke",
      "--area",
      "git",
      "--resource",
      "pullRequestThreads",
      "--route-parameters",
      `project=${adoProject}`,
      `repositoryId=${repository}`,
      `pullRequestId=${pullRequestId}`,
      "--api-version",
      "7.1",
    ],
    { includeProject: false },
  );
  return summarizeSpecPullRequestReview(review);
}

function pullRequestReviewJudgmentProblem(
  decision: AgentDecision,
): string | null {
  if (
    !["committed", "accepted-pass", "needs-owner"].includes(decision.decision)
  ) {
    return "pull-request review judgment must return committed for a bounded source fix, accepted-pass when the feedback warrants no source change, or needs-owner for a concrete authority gap";
  }
  if (decision.liveReady !== undefined || decision.condition !== undefined) {
    return "pull-request review judgment must omit liveReady and condition because the workflow owns exact re-verification and the PR wait";
  }
  return null;
}

function pullRequestReviewPrompt(input: {
  ctx: WorkflowContext;
  pullRequestId: string;
  specId: string;
  sourceCommit: string;
  targetRef: string;
  review: PullRequestReview;
}): string {
  const threads = input.review.threads
    .map(
      (thread) =>
        `- thread ${thread.threadId}${thread.path ? ` (${thread.path})` : ""} by ${thread.author}: ${thread.content}`,
    )
    .join("\n");
  return [
    `Judge the newly observed review feedback on PR ${input.pullRequestId} for ${input.specId} at exact live-proven commit ${input.sourceCommit}.`,
    `The PR targets ${input.targetRef}; review fingerprint ${input.review.fingerprint} contains ${input.review.unresolvedCount} unresolved thread(s).`,
    "Inspect the cited source and task evidence. If the feedback identifies a truthful bounded defect, fix only that defect in this task worktree, run scoped local checks, commit one clean follow-up, and return decision=committed. The workflow will push the same branch and require fresh exact live verification.",
    "If the feedback is already satisfied, inaccurate, or purely informational, leave source unchanged and return decision=accepted-pass with concrete evidence explaining why. The workflow will preserve the unresolved thread for explicit reviewer or human resolution; do not mark a thread resolved without proof.",
    "Return decision=needs-owner only for a concrete authority gap that source inspection cannot resolve. Do not create a branch, worktree, PR, task, or ADO run; do not push, merge, comment on, or resolve the PR.",
    "Review threads:",
    threads ||
      "- structured review text unavailable; inspect the PR and cited source directly",
    "Task:",
    taskDescription(input.ctx),
  ].join("\n\n");
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
    authenticatedAdoJson?: (
      args: string[],
      options?: { includeProject?: boolean },
    ) => unknown | Promise<unknown>;
  } = {},
): Promise<CollectedRunEvidence> {
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

  let timelinePath: string | null = null;
  let terminalFailurePath: string | null = null;
  let failingTaskLogPath: string | null = null;
  if (artifactPaths.length === 0) {
    const authenticatedAdoJson =
      dependencies.authenticatedAdoJson ??
      ((args: string[], options?: { includeProject?: boolean }) =>
        azJson(repoDir, args, options));
    try {
      const timeline = await authenticatedAdoJson(
        [
          "devops",
          "invoke",
          "--area",
          "build",
          "--resource",
          "timeline",
          "--route-parameters",
          `project=${adoProject}`,
          `buildId=${runId}`,
          "--api-version",
          "7.1",
        ],
        { includeProject: false },
      );
      timelinePath = join(runContextDir, "ado-timeline.json");
      writeFileSync(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`);

      const records =
        timeline &&
        typeof timeline === "object" &&
        Array.isArray((timeline as { records?: unknown }).records)
          ? (timeline as { records: unknown[] }).records.filter(
              (record): record is Record<string, unknown> =>
                Boolean(record) && typeof record === "object",
            )
          : [];
      const failedRecords = records.filter(
        (record) => nonEmptyString(record.result).toLowerCase() === "failed",
      );
      const failedTask =
        failedRecords.find(
          (record) => nonEmptyString(record.type).toLowerCase() === "task",
        ) ?? failedRecords.find((record) => Boolean(record.log));
      const byId = new Map(
        records.map((record) => [nonEmptyString(record.id), record]),
      );
      let ancestor = failedTask;
      let failedStage = failedRecords.find(
        (record) => nonEmptyString(record.type).toLowerCase() === "stage",
      );
      while (!failedStage && ancestor) {
        ancestor = byId.get(nonEmptyString(ancestor.parentId));
        if (nonEmptyString(ancestor?.type).toLowerCase() === "stage") {
          failedStage = ancestor;
        }
      }
      const identity = (record: Record<string, unknown> | undefined) =>
        record
          ? {
              id: nonEmptyString(record.id),
              name: nonEmptyString(record.name),
              type: nonEmptyString(record.type),
              result: nonEmptyString(record.result),
            }
          : null;
      const logId =
        failedTask?.log && typeof failedTask.log === "object"
          ? nonEmptyString((failedTask.log as { id?: unknown }).id)
          : "";
      const terminalFailure = {
        runId,
        runResult: nonEmptyString(run.result) || pipelineRunState(run),
        stage: identity(failedStage),
        task: identity(failedTask),
        logId: logId || null,
      };
      terminalFailurePath = join(runContextDir, "ado-terminal-failure.json");
      writeFileSync(
        terminalFailurePath,
        `${JSON.stringify(terminalFailure, null, 2)}\n`,
      );

      if (logId) {
        const log = await authenticatedAdoJson(
          [
            "devops",
            "invoke",
            "--area",
            "build",
            "--resource",
            "logs",
            "--route-parameters",
            `project=${adoProject}`,
            `buildId=${runId}`,
            `logId=${logId}`,
            "--api-version",
            "7.1",
          ],
          { includeProject: false },
        );
        const logValue =
          log && typeof log === "object"
            ? (log as { value?: unknown }).value
            : undefined;
        const logText =
          typeof log === "string"
            ? log
            : typeof logValue === "string"
              ? logValue
              : Array.isArray(logValue)
                ? logValue.map(String).join("\n")
                : JSON.stringify(log, null, 2);
        failingTaskLogPath = join(
          runContextDir,
          `ado-failing-task-${artifactPart(logId) || "log"}.log`,
        );
        writeFileSync(failingTaskLogPath, `${logText.replace(/\n?$/, "\n")}`);
      }
    } catch (error) {
      errors.push(
        `artifactless-terminal-evidence: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  writeFileSync(
    join(runContextDir, "collection.json"),
    `${JSON.stringify(
      {
        runId,
        runPath,
        artifactListPath,
        artifactPaths,
        timelinePath,
        terminalFailurePath,
        failingTaskLogPath,
        errors,
      },
      null,
      2,
    )}\n`,
  );
  return {
    runPath,
    artifactListPath,
    artifactPaths,
    timelinePath,
    terminalFailurePath,
    failingTaskLogPath,
    errors,
  };
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

export function proofMetadataMatchesSource(
  metadata: Record<string, unknown>,
  sourceCommit: string,
): boolean {
  const declaredCommits = [
    nonEmptyString(metadata.sourceCommit),
    nonEmptyString(metadata.reviewed_source_commit),
  ].filter(Boolean);
  return declaredCommits.every((declared) => declared === sourceCommit);
}

export function invalidatedRunRequiresSourceChange(
  run: PipelineRun,
  sourceCommit: string,
): boolean {
  return proofMetadataMatchesSource(metadataOf(run), sourceCommit);
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
        proofMetadataMatchesSource(metadata, input.sourceCommit) &&
        nonEmptyString(parameters.specs) === input.specId &&
        nonEmptyString(parameters.target) === target &&
        nonEmptyString(parameters.standalone_build_id) === standaloneBuildId &&
        nonEmptyString(metadata.taskId) === input.taskId
      );
    })
    .sort((left, right) => Number(right.id ?? 0) - Number(left.id ?? 0));
}

export function matchingTaskGenerationRuns(
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
        proofMetadataMatchesSource(metadata, input.sourceCommit) &&
        nonEmptyString(parameters.specs) === input.specId &&
        nonEmptyString(parameters.target) === target &&
        nonEmptyString(parameters.standalone_build_id) === standaloneBuildId &&
        nonEmptyString(metadata.taskId) === input.taskId &&
        Number(metadata.generation) === input.generation
      );
    })
    .sort((left, right) => Number(right.id ?? 0) - Number(left.id ?? 0));
}

export function supersededQueuedTaskRuns(
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
      const sourceCommit = nonEmptyString(run.sourceVersion);
      return (
        pipelineRunState(run).toLowerCase() === "notstarted" &&
        Boolean(nonEmptyString(run.id)) &&
        Boolean(sourceCommit) &&
        sourceCommit !== input.sourceCommit &&
        nonEmptyString(parameters.specs) === input.specId &&
        nonEmptyString(parameters.target) === target &&
        nonEmptyString(parameters.standalone_build_id) === standaloneBuildId &&
        nonEmptyString(metadata.taskId) === input.taskId &&
        Number(metadata.generation) === input.generation
      );
    })
    .sort((left, right) => Number(left.id ?? 0) - Number(right.id ?? 0));
}

export type PriorVerificationRunDisposition =
  | "exact"
  | "invalidated-lineage-context"
  | "mismatch";

export function runMatchesPriorVerification(
  run: PipelineRun,
  input: {
    taskId?: string;
    specId: string;
    target: string;
    standaloneBuildId: string;
    sourceBranch?: string;
    sourceCommit?: string;
    requireCanonicalLineage?: boolean;
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
    (input.requireCanonicalLineage === false ||
      proofMetadataMatchesSource(
        metadata,
        nonEmptyString(run.sourceVersion),
      )) &&
    (!input.taskId || nonEmptyString(metadata.taskId) === input.taskId) &&
    (!expectedBranch || nonEmptyString(run.sourceBranch) === expectedBranch) &&
    (!input.sourceCommit ||
      nonEmptyString(run.sourceVersion) === input.sourceCommit)
  );
}

export function priorVerificationRunDisposition(
  run: PipelineRun,
  input: Parameters<typeof runMatchesPriorVerification>[1],
  invalidation: {
    runId: string;
    claimIds?: readonly string[];
    lineageInvalid: boolean;
  } | null,
): PriorVerificationRunDisposition {
  if (runMatchesPriorVerification(run, input)) return "exact";
  if (
    invalidation !== null &&
    runMatchesPriorVerification(run, {
      ...input,
      requireCanonicalLineage: false,
    })
  ) {
    return "invalidated-lineage-context";
  }
  return "mismatch";
}

export function pipelineWaitCondition(runId: string): Condition {
  return {
    id: `pipeline-run-${runId}-completed`,
    type: "pipeline-run.state",
    subject: `pipeline-run:${runId}`,
    expected: { field: "state", anyOf: ["completed"] },
  };
}

export function registerSpecLiveTrackedRun(appDir: string, runId: string) {
  return appendTrackedPipelineRunId(appDir, runId);
}

export function taskScopedAgentCondition(
  taskId: string,
  generation: number,
  condition: Condition,
): Condition {
  const taskScope = createHash("sha256")
    .update(`${taskId}@${generation}`)
    .digest("hex")
    .slice(0, 12);
  return {
    ...condition,
    id: `${condition.id}:task-${taskScope}`,
  };
}

export function masterValidationCapacityPulseCycleSlot(
  nowMs = Date.now(),
): number {
  return Math.floor(nowMs / masterValidationCapacityPulseIntervalMs);
}

export function masterValidationCapacityRetryDue(
  run: Pick<PipelineRun, "finishTime">,
  nowMs = Date.now(),
): boolean {
  const finishedAt = Date.parse(nonEmptyString(run.finishTime));
  if (!Number.isFinite(finishedAt)) return false;
  return (
    masterValidationCapacityPulseCycleSlot(nowMs) >
    masterValidationCapacityPulseCycleSlot(finishedAt)
  );
}

export function masterValidationCapacityPulseWaitCondition(
  taskId: string,
  generation: number,
  baselineCycleSlot: number,
): Condition {
  if (!Number.isInteger(baselineCycleSlot) || baselineCycleSlot < 0) {
    throw new Error("baselineCycleSlot must be a non-negative integer");
  }
  return taskScopedAgentCondition(taskId, generation, {
    id: `master-validation-capacity-after-slot-${baselineCycleSlot}`,
    type: "aks.master-validation.capacity-pulse",
    subject: `project:${masterValidationCapacityPulseProjectId}`,
    expected: { field: "cycleSlot", notEquals: baselineCycleSlot },
  });
}

export function pullRequestWaitCondition(pullRequestId: string): Condition {
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
): Condition {
  return {
    id: `pull-request-${pullRequestId}-source-not-${testedSourceCommit}`,
    type: "pull-request.state",
    subject: `pull-request:${pullRequestId}`,
    expected: { field: "sourceCommit", notEquals: testedSourceCommit },
  };
}

export function pullRequestReviewCountCondition(
  pullRequestId: string,
  unresolvedReviewCount: number,
): Condition {
  return {
    id: `pull-request-${pullRequestId}-unresolved-review-count-not-${unresolvedReviewCount}`,
    type: "pull-request.state",
    subject: `pull-request:${pullRequestId}`,
    expected: {
      field: "unresolvedReviewCount",
      notEquals: unresolvedReviewCount,
    },
  };
}

export function pullRequestReviewFingerprintCondition(
  pullRequestId: string,
  reviewFingerprint: string,
): Condition {
  return {
    id: `pull-request-${pullRequestId}-review-fingerprint-not-${reviewFingerprint}`,
    type: "pull-request.state",
    subject: `pull-request:${pullRequestId}`,
    expected: {
      field: "reviewFingerprint",
      notEquals: reviewFingerprint,
    },
  };
}

export function pullRequestWaitConditions(
  pullRequestId: string,
  testedSourceCommit: string,
  review: PullRequestReview = {
    available: false,
    unresolvedCount: 0,
    fingerprint: "",
    threads: [],
  },
): Condition[] {
  const conditions = [
    pullRequestWaitCondition(pullRequestId),
    pullRequestSourceUpdateCondition(pullRequestId, testedSourceCommit),
  ];
  if (!review.available || review.unresolvedCount <= 0) return conditions;
  conditions.push(
    pullRequestReviewCountCondition(pullRequestId, review.unresolvedCount),
  );
  if (review.fingerprint) {
    conditions.push(
      pullRequestReviewFingerprintCondition(pullRequestId, review.fingerprint),
    );
  }
  return conditions;
}

function currentRunPath(contextDir: string): string {
  return join(contextDir, "current-run.json");
}

export type TaskContextHandoff = {
  version: 1;
  taskId: string;
  generation: number;
  sourceCommit: string;
  runId: string | null;
  phase: string;
  handoffPath: string;
  judgmentPath: string;
  previousHandoffPath?: string;
  recordedAt: string;
};

export function currentTaskContextPath(contextDir: string): string {
  return join(contextDir, "current-context.json");
}

export function writeTaskContextHandoff(
  contextDir: string,
  input: {
    taskId: string;
    generation: number;
    sourceCommit: string;
    runId?: string;
    phase: string;
    judgmentPrompt: string;
    previousHandoffPath?: string;
    recordedAt?: string;
  },
): TaskContextHandoff {
  const sourceCommit = nonEmptyString(input.sourceCommit);
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    throw new Error(
      `durable task context requires an exact source commit, got ${sourceCommit || "missing"}`,
    );
  }
  const runId = nonEmptyString(input.runId) || null;
  const phase = safePart(input.phase);
  const relativePath = join(
    "handoffs",
    "sources",
    sourceCommit,
    "runs",
    runId ? safePart(runId) : "no-run",
    `${phase}.json`,
  );
  const handoffPath = join(contextDir, relativePath);
  const judgmentPath = handoffPath.replace(/\.json$/, ".judgment.md");
  const handoff: TaskContextHandoff = {
    version: 1,
    taskId: input.taskId,
    generation: input.generation,
    sourceCommit,
    runId,
    phase,
    handoffPath,
    judgmentPath,
    ...(input.previousHandoffPath
      ? { previousHandoffPath: input.previousHandoffPath }
      : {}),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
  mkdirSync(resolve(handoffPath, ".."), { recursive: true });
  writeFileSync(judgmentPath, `${input.judgmentPrompt.trim()}\n`);
  writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`);

  const currentPath = currentTaskContextPath(contextDir);
  const temporaryPath = `${currentPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(handoff, null, 2)}\n`);
  renameSync(temporaryPath, currentPath);
  return handoff;
}

function durableTaskContextInstruction(
  contextDir: string,
  handoff: TaskContextHandoff,
): string {
  return `Durable task-context authority: read ${currentTaskContextPath(contextDir)} first and treat only the handoff it names as current for this judgment. This call's source/run-versioned handoff is ${handoff.handoffPath}, and its exact pending judgment is persisted at ${handoff.judgmentPath}.${handoff.previousHandoffPath ? ` It supersedes the provider-aborted handoff at ${handoff.previousHandoffPath}; read that handoff and its judgmentPath before resuming so completed work and a pending hard-validation correction survive the provider stream failure.` : ""} Prior handoffs under ${join(contextDir, "handoffs", "sources")} remain readable history but are stale authority and must not override the task-root current-context pointer. Record any resumable non-source findings against this exact source/run handoff; source edits remain in the retained task worktree.`;
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
    listBranchRuns: (branch) => branchPipelineRuns(repoDir, branch),
  });
}

async function branchPipelineRuns(
  repoDir: string,
  sourceBranch: string,
): Promise<PipelineRun[]> {
  const value = await azJson(repoDir, [
    "pipelines",
    "runs",
    "list",
    "--pipeline-ids",
    pipelineId,
    "--branch",
    sourceBranch,
    "--query-order",
    "QueueTimeDesc",
    "--top",
    "20",
  ]);
  return Array.isArray(value) ? (value as PipelineRun[]) : [];
}

async function recentPipelineRuns(repoDir: string): Promise<PipelineRun[]> {
  const value = await azJson(repoDir, [
    "pipelines",
    "runs",
    "list",
    "--pipeline-ids",
    pipelineId,
    "--query-order",
    "QueueTimeDesc",
    "--top",
    "50",
  ]);
  return Array.isArray(value) ? (value as PipelineRun[]) : [];
}

function uniqueRuns(runs: PipelineRun[]): PipelineRun[] {
  const seen = new Set<string>();
  return runs.filter((run) => {
    const id = nonEmptyString(run.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

type QueueRunInput = {
  taskId: string;
  generation: number;
  specId: string;
  sourceBranch: string;
  sourceCommit: string;
  target: string;
  standaloneBuildId: string;
  planPath?: string;
  retryOfRunId?: string;
};

export function queueRunMetadata(
  input: QueueRunInput,
): Record<string, unknown> {
  return {
    taskId: input.taskId,
    generation: input.generation,
    specId: input.specId,
    sourceBranch: input.sourceBranch,
    sourceCommit: input.sourceCommit,
    reviewed_source_commit: input.sourceCommit,
    target: input.target,
    ...(input.standaloneBuildId
      ? {
          standaloneBuildId: input.standaloneBuildId,
          standalone_build_id: input.standaloneBuildId,
        }
      : {}),
    ...(input.planPath ? { planPath: input.planPath } : {}),
    ...(input.retryOfRunId ? { retryOfRunId: input.retryOfRunId } : {}),
  };
}

async function queueRun(
  repoDir: string,
  input: QueueRunInput,
): Promise<PipelineRun> {
  const metadata = JSON.stringify(queueRunMetadata(input));
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
    ...queueRunPipelineParameters({
      specId: input.specId,
      target: input.target,
      standaloneBuildId: input.standaloneBuildId,
      planPath: input.planPath,
      metadata,
    }),
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

export type NoIntegrationDiagnosticContract = {
  artifactPath: string;
  maxReproductions: number;
  reproductionConsumed: number;
  sourceBranch: string;
  sourceCommit: string;
  specIds: string[];
};

export function noIntegrationDiagnosticContract(
  input: Record<string, unknown> | undefined,
): {
  contract: NoIntegrationDiagnosticContract | null;
  problem: string | null;
} {
  if (input?.allowIntegration !== false) {
    return { contract: null, problem: null };
  }
  const sourceBranch = nonEmptyString(
    input.preparedSourceBranch ?? input.sourceBranch,
  ).replace(/^refs\/heads\//, "");
  const sourceCommit = nonEmptyString(
    input.preparedSourceCommit ?? input.sourceCommit,
  );
  const artifactPath = nonEmptyString(input.artifactPath);
  const specIds = Array.isArray(input.specIds)
    ? [...new Set(input.specIds.map(nonEmptyString).filter(Boolean))]
    : [];
  const maxReproductions = Number(input.maxReproductions);
  const reproductionConsumed = Number(input.reproductionConsumed);
  const problem = !sourceBranch.startsWith("task/")
    ? "diagnostic prepared source must use a dedicated task branch"
    : !/^[0-9a-f]{40}$/i.test(sourceCommit)
      ? "diagnostic prepared source commit must be an exact 40-character Git commit"
      : !artifactPath.startsWith("/")
        ? "diagnostic artifactPath must be absolute"
        : specIds.length < 2
          ? "diagnostic aggregate dispatch requires at least two declared specIds"
          : !Number.isInteger(maxReproductions) || maxReproductions !== 1
            ? "diagnostic maxReproductions must be exactly 1"
            : !Number.isInteger(reproductionConsumed) ||
                reproductionConsumed < 0 ||
                reproductionConsumed > maxReproductions
              ? "diagnostic reproductionConsumed must be an integer between 0 and maxReproductions"
              : null;
  return problem
    ? { contract: null, problem }
    : {
        contract: {
          artifactPath,
          maxReproductions,
          reproductionConsumed,
          sourceBranch,
          sourceCommit,
          specIds,
        },
        problem: null,
      };
}

export function restoreExactDiagnosticSource(
  workspaceDir: string,
  contract: Pick<
    NoIntegrationDiagnosticContract,
    "sourceBranch" | "sourceCommit"
  >,
  runGit: GitCommand = git,
): { accepted: boolean; evidence: string[]; problem?: string } {
  const evidence = [
    `diagnostic-source-branch:${contract.sourceBranch}`,
    `diagnostic-source-commit:${contract.sourceCommit}`,
  ];
  const remoteRef = `refs/remotes/origin/${contract.sourceBranch}`;
  const fetch = runGit(
    workspaceDir,
    ["fetch", "origin", `+refs/heads/${contract.sourceBranch}:${remoteRef}`],
    true,
  );
  if (fetch.status === 0) {
    if (
      runGit(
        workspaceDir,
        ["merge-base", "--is-ancestor", contract.sourceCommit, remoteRef],
        true,
      ).status !== 0
    ) {
      return {
        accepted: false,
        evidence: [...evidence, `diagnostic-source-remote:${remoteRef}`],
        problem:
          "diagnostic source commit is not on its declared remote branch",
      };
    }
    evidence.push(`diagnostic-source-remote:${remoteRef}`);
  } else {
    const localRef = `refs/heads/${contract.sourceBranch}`;
    const fetchProblem =
      fetch.stderr || fetch.stdout || "diagnostic source fetch failed";
    if (
      runGit(workspaceDir, ["show-ref", "--verify", "--quiet", localRef], true)
        .status !== 0
    ) {
      return {
        accepted: false,
        evidence: [
          ...evidence,
          `diagnostic-source-local-ref:${localRef}:absent`,
        ],
        problem: `diagnostic source fetch failed and declared local branch ${localRef} is absent from the workflow-owned Git ref store: ${fetchProblem}`,
      };
    }
    if (
      runGit(
        workspaceDir,
        ["merge-base", "--is-ancestor", contract.sourceCommit, localRef],
        true,
      ).status !== 0
    ) {
      return {
        accepted: false,
        evidence: [...evidence, `diagnostic-source-local-ref:${localRef}`],
        problem: `declared local diagnostic branch ${localRef} does not contain exact prepared commit ${contract.sourceCommit}`,
      };
    }
    evidence.push(
      `diagnostic-source-remote-fetch-failed:${fetchProblem}`,
      `diagnostic-source-local-ref:${localRef}`,
    );
  }
  const reset = runGit(
    workspaceDir,
    ["reset", "--hard", contract.sourceCommit],
    true,
  );
  const head = runGit(workspaceDir, ["rev-parse", "HEAD"], true);
  if (
    reset.status !== 0 ||
    head.status !== 0 ||
    head.stdout !== contract.sourceCommit
  ) {
    return {
      accepted: false,
      evidence,
      problem:
        reset.stderr || reset.stdout || "exact diagnostic source reset failed",
    };
  }
  return {
    accepted: true,
    evidence: [...evidence, `diagnostic-source-restored-exact:${head.stdout}`],
  };
}

export type DiagnosticTaskBranchPublication = {
  accepted: boolean;
  evidence: string[];
  problem?: string;
};

export function publishExactDiagnosticTaskBranch(
  workspaceDir: string,
  contract: Pick<
    NoIntegrationDiagnosticContract,
    "sourceBranch" | "sourceCommit"
  >,
  runGit: GitCommand = git,
): DiagnosticTaskBranchPublication {
  const remoteRef = `refs/heads/${contract.sourceBranch}`;
  const evidence = [
    `diagnostic-publication-branch:${contract.sourceBranch}`,
    `diagnostic-publication-commit:${contract.sourceCommit}`,
  ];
  if (!contract.sourceBranch.startsWith("task/")) {
    return {
      accepted: false,
      evidence,
      problem:
        "diagnostic publication may target only a dedicated task/* branch",
    };
  }
  if (!/^[0-9a-f]{40}$/i.test(contract.sourceCommit)) {
    return {
      accepted: false,
      evidence,
      problem: "diagnostic publication requires an exact 40-character commit",
    };
  }

  const status = runGit(
    workspaceDir,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    true,
  );
  if (status.status !== 0 || status.stdout) {
    return {
      accepted: false,
      evidence: [
        ...evidence,
        `diagnostic-publication-worktree:${status.stdout || "unresolved"}`,
      ],
      problem:
        "diagnostic publication requires a clean workflow-owned worktree",
    };
  }
  const head = runGit(workspaceDir, ["rev-parse", "HEAD"], true);
  if (head.status !== 0 || head.stdout !== contract.sourceCommit) {
    return {
      accepted: false,
      evidence: [
        ...evidence,
        `diagnostic-publication-head:${head.stdout || "unresolved"}`,
      ],
      problem: `diagnostic publication HEAD does not match exact prepared commit ${contract.sourceCommit}`,
    };
  }

  const remote = runGit(workspaceDir, ["ls-remote", "origin", remoteRef], true);
  if (remote.status !== 0) {
    return {
      accepted: false,
      evidence,
      problem:
        remote.stderr ||
        remote.stdout ||
        `could not inspect diagnostic remote branch ${remoteRef}`,
    };
  }
  const remoteCommit = remoteLeaseCommit(remote);
  if (remoteCommit) {
    return remoteCommit === contract.sourceCommit
      ? {
          accepted: true,
          evidence: [
            ...evidence,
            `diagnostic-publication-existing-exact:${remoteRef}@${remoteCommit}`,
            "diagnostic-publication-mutation:not-required",
          ],
        }
      : {
          accepted: false,
          evidence: [
            ...evidence,
            `diagnostic-publication-conflict:${remoteRef}@${remoteCommit}`,
          ],
          problem: `diagnostic remote branch ${remoteRef} conflicts with exact prepared commit ${contract.sourceCommit}`,
        };
  }

  const push = runGit(
    workspaceDir,
    [
      "push",
      "origin",
      `--force-with-lease=${remoteRef}:`,
      `${contract.sourceCommit}:${remoteRef}`,
    ],
    true,
  );
  if (push.status !== 0) {
    return {
      accepted: false,
      evidence: [
        ...evidence,
        `diagnostic-publication-remote-absent:${remoteRef}`,
      ],
      problem:
        push.stderr ||
        push.stdout ||
        `could not publish exact diagnostic task branch ${remoteRef}`,
    };
  }
  const readback = runGit(
    workspaceDir,
    ["ls-remote", "origin", remoteRef],
    true,
  );
  const publishedCommit = remoteLeaseCommit(readback);
  if (publishedCommit !== contract.sourceCommit) {
    return {
      accepted: false,
      evidence: [
        ...evidence,
        `diagnostic-publication-readback:${publishedCommit || "unresolved"}`,
      ],
      problem: `diagnostic task branch publication did not read back exact commit ${contract.sourceCommit}`,
    };
  }
  return {
    accepted: true,
    evidence: [
      ...evidence,
      `diagnostic-publication-created:${remoteRef}@${publishedCommit}`,
    ],
  };
}

export function diagnosticArtifactProblem(input: {
  artifactPath: string;
  sourceCommit: string;
  runId: string;
  specIds: string[];
  resultPaths: string[];
  cleanupPaths: string[];
}): string | null {
  let text = "";
  try {
    text = readFileSync(input.artifactPath, "utf8");
  } catch {
    return `diagnostic artifact is missing or unreadable: ${input.artifactPath}`;
  }
  const requiredValues = [
    input.sourceCommit,
    input.runId,
    ...input.resultPaths,
  ];
  const missingValue = requiredValues.find((value) => !text.includes(value));
  if (missingValue)
    return `diagnostic artifact omits required value: ${missingValue}`;
  if (input.resultPaths.length < input.specIds.length) {
    return "diagnostic evidence does not contain one per-spec result path for every declared spec";
  }
  if (
    !input.cleanupPaths.length ||
    !input.cleanupPaths.some((path) => text.includes(path))
  ) {
    return "diagnostic artifact omits structural cleanup proof path";
  }
  const requiredLabels = [
    "Tested commit:",
    "Pipeline run ID:",
    "Result path:",
    "Cleanup proof:",
    "Assertion mapping:",
    "Lineage mapping:",
    "Request fingerprint:",
    "HTTP status:",
    "ARM code:",
    "Redacted ARM body:",
    "Disposition:",
  ];
  const missingLabel = requiredLabels.find((label) => !text.includes(label));
  if (missingLabel)
    return `diagnostic artifact omits required field ${missingLabel}`;
  if (!/Request fingerprint:\s*`?sha256:[0-9a-f]{64}`?/i.test(text)) {
    return "diagnostic request fingerprint must be a deterministic sha256 value";
  }
  if (!/HTTP status:\s*`?[1-5][0-9]{2}`?/i.test(text)) {
    return "diagnostic artifact must include a concrete HTTP status";
  }
  if (!/ARM code:\s*`?[^`\n]+`?/i.test(text)) {
    return "diagnostic artifact must include an ARM error code";
  }
  if (!/Redacted ARM body:\s*.+/i.test(text)) {
    return "diagnostic artifact must include a redacted ARM response body";
  }
  if (/Bearer\s+[A-Za-z0-9._-]{12,}|client_secret|access_token/i.test(text)) {
    return "diagnostic artifact appears to contain an unredacted secret";
  }
  const dispositions = [
    "request-shape repair",
    "product/API rejection",
    "retryable external failure",
  ].filter((value) =>
    new RegExp(`Disposition:\\s*${value.replace("/", "\\/")}`, "i").test(text),
  );
  return dispositions.length === 1
    ? null
    : "diagnostic artifact must contain exactly one supported disposition";
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
    "--draft",
    "false",
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

async function publishPullRequestReviewReady(
  repoDir: string,
  pullRequestId: string,
): Promise<void> {
  await azJson(
    repoDir,
    ["repos", "pr", "update", "--id", pullRequestId, "--draft", "false"],
    { includeProject: false },
  );
}

async function reviewReadyHandoff(
  ctx: WorkflowContext,
  input: {
    taskId: string;
    specId: string;
    pullRequestId: string;
    runId: string;
    sourceCommit: string;
  },
): Promise<string[]> {
  const appDir = ctx.workspace!.appRoot;
  const receipt = join(
    appDir,
    ".state",
    "master-validation-route-review-ready",
    `${createHash("sha256").update(`${input.taskId}:${input.pullRequestId}:${input.sourceCommit}`).digest("hex")}.json`,
  );
  if (existsSync(receipt)) {
    return [
      `review-ready-pull-request:${input.pullRequestId}`,
      "review-ready-handoff:already-sent",
      `review-ready-handoff-receipt:${receipt}`,
    ];
  }
  await ctx.events.emit({
    type: "message.created",
    source: "workflow:spec-live-reconciliation",
    target: { project: "aks-rp-e2e", human: true },
    data: {
      from: "aks-explorer",
      to: "human:operator",
      intent: "master-validation-route-review-ready",
      priority: "P1",
      project: "aks-rp-e2e",
      taskId: input.taskId,
      specId: input.specId,
      pipelineRunId: input.runId,
      pullRequestId: input.pullRequestId,
      sourceCommit: input.sourceCommit,
      content: [
        `AKS master-validation route repair for ${input.specId} passed exact live run ${input.runId} at ${input.sourceCommit}.`,
        `Focused PR ${input.pullRequestId} is published non-draft and review-ready.`,
        "Repository approvals or policies may still remain; please satisfy them and merge this PR into main.",
        "The app will keep the same task open and explicitly read current origin/main before accepting the repair.",
      ].join("\n"),
    },
  });
  mkdirSync(join(appDir, ".state", "master-validation-route-review-ready"), {
    recursive: true,
  });
  writeFileSync(
    receipt,
    `${JSON.stringify({ version: 1, ...input, sentAt: new Date().toISOString() }, null, 2)}\n`,
  );
  return [
    `review-ready-pull-request:${input.pullRequestId}`,
    "review-ready-handoff:sent",
    `review-ready-handoff-receipt:${receipt}`,
  ];
}

async function abandonPullRequest(
  repoDir: string,
  pullRequestId: string,
): Promise<boolean> {
  try {
    await azJson(
      repoDir,
      ["repos", "pr", "update", "--id", pullRequestId, "--status", "abandoned"],
      { includeProject: false },
    );
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
      "Source-first completion guard: when the invalid result or validation finding already diagnoses a bounded source repair and this is an isolated task worktree, perform that mutation and its narrow verification now, before any repeated broad investigation. Reuse the cited paths and hot evidence; spend at most four read-only investigation/tool operations before the first source mutation. Work remaining is not by itself a needs-owner boundary. If current evidence instead proves genuine ownership ambiguity or an external authority boundary, return that structured exceptional judgment without unsafe mutation.",
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
  context: {
    workspaceDirty?: boolean;
    ownershipEstablished?: boolean;
    authoritativeCheckpointPath?: string;
    sourceCommit?: string;
  } = {},
): string | null {
  if (
    !["committed", "test-current", "needs-owner"].includes(decision.decision)
  ) {
    return "task worktree recovery must return committed for preserved task work, test-current for removed task residue, or needs-owner for concrete ownership ambiguity; domain disposition is evaluated after recovery";
  }
  if (decision.liveReady !== undefined || decision.condition !== undefined) {
    return "task worktree recovery only restores a clean source state; omit liveReady and condition because domain readiness and dispatch are evaluated after recovery";
  }
  if (decision.decision !== "needs-owner") {
    return context.workspaceDirty
      ? "task worktree recovery cannot complete while the task worktree remains dirty; commit verified task work or remove only verified task-generated residue"
      : null;
  }
  if (context.ownershipEstablished) {
    return "needs-owner is invalid because task/worktree ownership is established; dirty technical repair remains in this workflow until committed or proven task-generated residue is removed";
  }
  const checkpointPath = nonEmptyString(context.authoritativeCheckpointPath);
  const sourceCommit = nonEmptyString(context.sourceCommit);
  const requiredEvidence = [
    "ownership-ambiguity:",
    checkpointPath ? `authoritative-checkpoint:${checkpointPath}` : "",
    sourceCommit ? `authoritative-source-commit:${sourceCommit}` : "",
  ].filter(Boolean);
  const missing = requiredEvidence.filter((required) =>
    required.endsWith(":")
      ? !decision.evidence.some((entry) => entry.startsWith(required))
      : !decision.evidence.includes(required),
  );
  if (
    !checkpointPath ||
    !/^[0-9a-f]{40}$/i.test(sourceCommit) ||
    missing.length
  ) {
    return `needs-owner requires concrete ownership ambiguity plus the authoritative current source/run handoff checkpoint; missing ${[
      ...(!checkpointPath ? ["authoritative checkpoint path"] : []),
      ...(!/^[0-9a-f]{40}$/i.test(sourceCommit)
        ? ["exact authoritative source commit"]
        : []),
      ...missing,
    ].join(", ")}`;
  }
  return null;
}

export function taskWorktreeRecoveryDeadlineDecision(input: {
  phase: "judgment" | "correction/retry";
  workspaceDirty: boolean;
  ownershipEstablished: boolean;
  sourceBranch: string;
  checkpointPath: string;
  sourceCommit: string;
  beforeRecovery: string;
}): AgentDecision {
  if (!input.workspaceDirty) {
    return {
      decision:
        input.sourceCommit === input.beforeRecovery
          ? "test-current"
          : "committed",
      summary: `The ${input.phase} deadline boundary found recovery already clean and preserved its verified source state.`,
      evidence: [
        "completion-guard:forced",
        "workspace:clean",
        `source-commit:${input.sourceCommit}`,
      ],
    };
  }
  return {
    decision: "needs-owner",
    summary: input.ownershipEstablished
      ? `The ${input.phase} deadline boundary refused to hand off dirty task-owned recovery.`
      : `The ${input.phase} deadline boundary preserved a dirty worktree whose ownership is ambiguous.`,
    evidence: [
      "completion-guard:forced",
      "workspace:dirty",
      input.ownershipEstablished
        ? "technical-failure:deadline-before-clean-recovery"
        : `ownership-ambiguity:source branch ${input.sourceBranch} is not a dedicated task branch`,
      `authoritative-checkpoint:${input.checkpointPath}`,
      `authoritative-source-commit:${input.sourceCommit}`,
    ],
  };
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
    deadlineMs?: number;
    nowMs?: () => number;
    onAgentCallNotAdmitted?: (input: {
      attempt: number;
      phase: "judgment" | "correction/retry";
    }) => AgentDecision;
    durableContext?: {
      contextDir: string;
      taskId: string;
      generation: number;
      sourceCommit: () => string;
      runId?: string;
      phase: string;
    };
  } = {},
): Promise<AgentDecision> {
  const nowMs = options.nowMs ?? Date.now;
  const deadlineMs =
    options.deadlineMs ??
    workflowDeadlines.get(ctx as object) ??
    nowMs() + specLiveWorkflowDeadlineMs;
  let nextPrompt = `${prompt}\n\n${conditionInstruction}`;
  let lastProblem = "";
  const maxAttempts = options.continueDomainWorkOnValidation ? 3 : 2;
  let runtimeFailures = 0;
  let previousHandoffPath = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let currentHandoff: TaskContextHandoff | null = null;
    if (options.durableContext) {
      const durable = options.durableContext;
      currentHandoff = writeTaskContextHandoff(durable.contextDir, {
        taskId: durable.taskId,
        generation: durable.generation,
        sourceCommit: durable.sourceCommit(),
        ...(durable.runId ? { runId: durable.runId } : {}),
        phase:
          attempt === 1
            ? durable.phase
            : `${durable.phase}-correction-${attempt}`,
        judgmentPrompt: nextPrompt,
        ...(previousHandoffPath ? { previousHandoffPath } : {}),
      });
      nextPrompt = `${durableTaskContextInstruction(durable.contextDir, currentHandoff)}\n\n${nextPrompt}`;
    }
    const timeoutMs = admittedAgentCallTimeoutMs({
      deadlineMs,
      nowMs: nowMs(),
      attempt,
    });
    if (timeoutMs === null) {
      const phase = attempt === 1 ? "judgment" : "correction/retry";
      const boundaryDecision = options.onAgentCallNotAdmitted?.({
        attempt,
        phase,
      });
      if (boundaryDecision) {
        const boundaryProblem =
          options.validateDecision?.(boundaryDecision) ??
          agentConditionProblem(boundaryDecision) ??
          (options.scenarioNormalization
            ? scenarioNormalizationWaitProblem(boundaryDecision)
            : null);
        if (boundaryProblem) {
          throw new Error(
            `Agent ${phase} was not admitted and forced completion was rejected by the recovery validator: ${boundaryProblem}`,
          );
        }
        return boundaryDecision;
      }
      throw new Error(
        `Agent ${phase} was not admitted because less than ${specLiveMinimumAgentCallMs}ms execution time remains after preserving the ${specLiveWorkflowMarginMs}ms workflow validation/recovery margin`,
      );
    }
    assertIsolatedWriteDispatch({
      workspaceDir: ctx.workspace!.root,
      projectDir: ctx.workspace!.projectRoot,
      cwd: ctx.workspace!.root,
    });
    const result = await ctx.agents.call(taskOwner(ctx), nextPrompt, {
      timeoutMs,
      schema: decisionSchema,
    });
    if (result.status !== "done" || !result.output) {
      runtimeFailures += 1;
      lastProblem = `agent invocation ${result.status} before structured judgment`;
      if (runtimeFailures < 2 && attempt < maxAttempts) {
        const retryDelayMs = options.retryDelayMs ?? 5_000;
        if (retryDelayMs > 0) await Bun.sleep(retryDelayMs);
        if (currentHandoff && options.durableContext) {
          previousHandoffPath = currentHandoff.handoffPath;
          nextPrompt = [
            "Recover the provider-aborted structured judgment from durable task context; do not replay the prior full session from its opening prompt.",
            `Read ${currentTaskContextPath(options.durableContext.contextDir)}, then read the predecessor handoff ${currentHandoff.handoffPath} and its judgmentPath ${currentHandoff.judgmentPath}.`,
            "Inspect the retained task worktree before editing. Reuse completed source work and recorded findings, then finish only the pending bounded judgment. Preserve any pending hard-validation correction from the predecessor judgment instead of reverting to an earlier invalid result.",
            "The provider abort is not a domain blocker or ownership boundary. Return the required structured judgment without repeating already-completed provider or source work.",
            conditionInstruction,
          ].join("\n\n");
        } else {
          nextPrompt = [
            nextPrompt,
            "The immediately preceding agent invocation ended before producing a structured judgment.",
            "Resume the same bounded task's pending judgment from the current task worktree and hot evidence. Preserve any hard-validation correction above instead of reverting to the original invalid result; do not treat the runtime interruption as a domain blocker or ownership boundary.",
            conditionInstruction,
          ].join("\n\n");
        }
        continue;
      }
      throw new Error(
        `Agent invocation failed before structured judgment after ${runtimeFailures === 2 ? "two" : runtimeFailures} attempt${runtimeFailures === 1 ? "" : "s"}: ${lastProblem}`,
      );
    }
    const decision = result.output as AgentDecision;
    const problem =
      options.validateDecision?.(decision) ??
      agentConditionProblem(decision) ??
      (options.scenarioNormalization
        ? scenarioNormalizationWaitProblem(decision)
        : null) ??
      null;
    if (!problem) return decision;
    lastProblem = problem;
    if (currentHandoff && options.durableContext) {
      previousHandoffPath = currentHandoff.handoffPath;
    }
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
  condition: Condition | Condition[],
): SpecLiveWorkflowResult {
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
): SpecLiveWorkflowResult {
  return ctx.done(summary, {
    state: "needs-owner",
    summary,
    evidence: boundedWorkflowEvidence(evidence),
  });
}

export function boundedWorkflowEvidence(
  evidence: string[],
  limit = 32,
): string[] {
  const entries = [
    ...new Set(evidence.map((value) => value.trim()).filter(Boolean)),
  ];
  if (entries.length <= limit) return entries;
  const retainedCount = Math.max(0, limit - 2);
  const retainedTailCount = Math.min(6, retainedCount);
  const retainedHeadCount = retainedCount - retainedTailCount;
  return [
    ...entries.slice(0, retainedHeadCount),
    ...entries.slice(-retainedTailCount),
    `evidence-entry-count:${entries.length}`,
    `evidence-entry-omitted:${entries.length - retainedCount}`,
  ];
}

async function reconcileNoIntegrationDiagnostic(
  ctx: WorkflowContext,
  payload: TaskPayload,
  contract: NoIntegrationDiagnosticContract,
  input: {
    taskId: string;
    generation: number;
    repoDir: string;
    workspaceDir: string;
    target: string;
    standaloneBuildId: string;
  },
): Promise<SpecLiveWorkflowResult> {
  const {
    taskId,
    generation,
    repoDir,
    workspaceDir,
    target,
    standaloneBuildId,
  } = input;
  const aggregateSpecId = contract.specIds.join(",");
  if (target !== defaultLiveTarget || standaloneBuildId) {
    return ownerResult(
      ctx,
      "No-integration diagnostics are narrowly limited to the shared staging target.",
      [
        `live-target:${target}`,
        `standalone-build-id:${standaloneBuildId || "none"}`,
      ],
    );
  }
  if (cleanWorkspace(workspaceDir)) {
    return ownerResult(
      ctx,
      "No-integration diagnostic refused a dirty workflow-owned worktree.",
      [`workspace:${workspaceDir}`],
    );
  }
  const restored = restoreExactDiagnosticSource(workspaceDir, contract);
  if (!restored.accepted) {
    return ownerResult(
      ctx,
      `Could not restore the exact prepared diagnostic source: ${restored.problem}.`,
      restored.evidence,
    );
  }
  if (cleanWorkspace(workspaceDir)) {
    return ownerResult(
      ctx,
      "Exact diagnostic source restoration left the workflow-owned worktree dirty.",
      [...restored.evidence, `workspace:${workspaceDir}`],
    );
  }

  const contextDir = taskContextDir(repoDir, taskId, generation);
  mkdirSync(contextDir, { recursive: true });
  const filter = {
    taskId,
    generation,
    specId: aggregateSpecId,
    sourceCommit: contract.sourceCommit,
    target,
    standaloneBuildId,
  };
  const runs = uniqueRuns([
    ...matchingTaskGenerationRuns(await recentPipelineRuns(repoDir), filter),
    ...matchingTaskRuns(
      await taskRuns(repoDir, contextDir, contract.sourceBranch),
      filter,
    ),
  ]);
  let run = runs[0];
  if (!run) {
    if (contract.reproductionConsumed >= contract.maxReproductions) {
      return ownerResult(
        ctx,
        "The single diagnostic reproduction budget is already consumed; no retry or replacement run was created.",
        [
          ...restored.evidence,
          `reproduction-consumed:${contract.reproductionConsumed}`,
          `max-reproductions:${contract.maxReproductions}`,
          "pipeline-run:not-created",
        ],
      );
    }
    const admission = checkLiveDispatchAdmission(workspaceDir, aggregateSpecId);
    if (!admission.accepted) {
      return ownerResult(
        ctx,
        "The exact prepared diagnostic source failed hard live-dispatch admission; it was not rewritten or queued.",
        [
          ...restored.evidence,
          ...admission.evidence,
          "pipeline-run:not-created",
        ],
      );
    }
    const publication = publishExactDiagnosticTaskBranch(
      workspaceDir,
      contract,
    );
    if (!publication.accepted) {
      return ownerResult(
        ctx,
        `The exact prepared diagnostic task branch could not be published safely: ${publication.problem}.`,
        [
          ...restored.evidence,
          ...admission.evidence,
          ...publication.evidence,
          "pipeline-run:not-created",
          "integration:not-attempted",
          "target-ref-advance:not-attempted",
        ],
      );
    }
    run = await queueRun(repoDir, {
      taskId,
      generation,
      specId: aggregateSpecId,
      sourceBranch: contract.sourceBranch,
      sourceCommit: contract.sourceCommit,
      target,
      standaloneBuildId,
    });
    const runId = nonEmptyString(run.id);
    registerSpecLiveTrackedRun(ctx.workspace!.appRoot, runId);
    saveRunReceipt(contextDir, run, contract.sourceCommit);
    return waitingResult(
      ctx,
      `Queued the one permitted aggregate staging diagnostic run ${runId} for ${aggregateSpecId}.`,
      [
        ...restored.evidence,
        ...admission.evidence,
        ...publication.evidence,
        `pipeline-run:${runId}`,
        "reproduction-consumed:1",
        `max-reproductions:${contract.maxReproductions}`,
        "integration:not-attempted",
        "pull-request:not-created",
      ],
      pipelineWaitCondition(runId),
    );
  }

  const runId = nonEmptyString(run.id);
  const runStatus = pipelineRunState(run);
  if (runStatus !== "completed") {
    return waitingResult(
      ctx,
      `The sole diagnostic run ${runId} is ${runStatus}.`,
      [
        ...restored.evidence,
        `pipeline-run:${runId}`,
        `pipeline-status:${runStatus}`,
        "reproduction-consumed:1",
        "integration:not-attempted",
      ],
      pipelineWaitCondition(runId),
    );
  }

  const runContextDir = terminalRunContextDir(contextDir, runId);
  const collection = await collectTerminalRunEvidence(
    repoDir,
    runContextDir,
    runId,
    run,
  );
  const jsonPaths = artifactJsonFiles(collection.artifactPaths);
  const resultPaths = contract.specIds.flatMap((specId) =>
    jsonPaths
      .filter((path) => nonEmptyString(readJsonRecord(path)?.specId) === specId)
      .slice(0, 1),
  );
  const cleanupPaths = resultPaths.filter((path) => {
    const specId = nonEmptyString(readJsonRecord(path)?.specId);
    return Boolean(specId && artifactProvesCleanup(path, specId));
  });
  const evidence = [
    ...restored.evidence,
    `pipeline-run:${runId}`,
    `pipeline-result:${nonEmptyString(run.result) || runStatus}`,
    ...resultPaths.map((path) => `result-path:${path}`),
    ...cleanupPaths.map((path) => `cleanup-proof:${path}`),
    `artifact-path:${contract.artifactPath}`,
    "reproduction-consumed:1",
    "integration:not-attempted",
    "pull-request:not-created",
    "target-ref-advance:not-attempted",
  ];
  if (resultPaths.length !== contract.specIds.length || !cleanupPaths.length) {
    return ownerResult(
      ctx,
      "The sole terminal diagnostic run lacks both declared per-spec results or structural cleanup evidence; no retry is permitted.",
      [
        ...evidence,
        ...collection.errors.map((error) => `collection-error:${error}`),
      ],
    );
  }

  const beforeHead = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
  const decision = await askAgent(
    ctx,
    [
      `Review the sole no-integration diagnostic run ${runId} for ${aggregateSpecId} at exact commit ${contract.sourceCommit}.`,
      `Use only run-specific evidence under ${runContextDir}. Per-spec result paths: ${resultPaths.join(", ")}. Structural cleanup paths: ${cleanupPaths.join(", ")}.`,
      `Write ${contract.artifactPath}, then read it back. Use these exact labels: Tested commit:, Pipeline run ID:, Result path: (one line per spec), Cleanup proof:, Assertion mapping:, Lineage mapping:, Request fingerprint: sha256:<64 lowercase hex>, HTTP status:, ARM code:, Redacted ARM body:, and Disposition:.`,
      "The disposition must be exactly one of: request-shape repair, product/API rejection, or retryable external failure. Include only a deterministic request-shape fingerprint and secret-redacted ARM facts; never include credentials, authorization headers, tokens, or raw secrets.",
      "Return decision=accepted-pass only when the diagnostic artifact is complete and read back. This accepts the diagnostic disposition, not the non-green product result. Do not edit source, commit, push, queue or retry ADO, create a PR, integrate into dev, or advance any target ref.",
      "Task:",
      taskDescription(ctx),
    ].join("\n\n"),
    {
      validateDecision: (candidate) => {
        if (candidate.decision !== "accepted-pass") {
          return "the terminal no-integration diagnostic must publish and validate its artifact without retry or source mutation";
        }
        if (
          git(workspaceDir, ["rev-parse", "HEAD"]).stdout !== beforeHead ||
          cleanWorkspace(workspaceDir)
        ) {
          return "no-integration diagnostic review must not change the exact prepared source";
        }
        return diagnosticArtifactProblem({
          artifactPath: contract.artifactPath,
          sourceCommit: contract.sourceCommit,
          runId,
          specIds: contract.specIds,
          resultPaths,
          cleanupPaths,
        });
      },
    },
  );
  const artifactProblem = diagnosticArtifactProblem({
    artifactPath: contract.artifactPath,
    sourceCommit: contract.sourceCommit,
    runId,
    specIds: contract.specIds,
    resultPaths,
    cleanupPaths,
  });
  if (decision.decision !== "accepted-pass" || artifactProblem) {
    return ownerResult(ctx, artifactProblem || decision.summary, [
      ...evidence,
      ...decision.evidence,
    ]);
  }
  return ctx.done(decision.summary, {
    state: "converged",
    summary: decision.summary,
    evidence: [
      ...evidence,
      ...decision.evidence,
      `diagnostic-artifact-readback:${contract.artifactPath}`,
    ],
    actions: [],
  });
}

export async function reconcileSpecLive(
  ctx: WorkflowContext,
  options: SpecLiveReconciliationOptions = {},
): Promise<SpecLiveWorkflowResult> {
  if (!ctx.reconciliation || !ctx.workspace) {
    return ctx.blocked(
      "Spec live reconciliation requires a durable task and prepared workspace",
      {
        hasReconciliation: Boolean(ctx.reconciliation),
        hasWorkspace: Boolean(ctx.workspace),
      },
    ) as SpecLiveWorkflowResult;
  }
  if (!workflowDeadlines.has(ctx as object)) {
    workflowDeadlines.set(
      ctx as object,
      Date.now() + specLiveWorkflowDeadlineMs,
    );
  }
  const payload: TaskPayload = {
    taskId: ctx.reconciliation.taskId,
    generation: ctx.reconciliation.generation,
    input: jsonRecord(ctx.reconciliation.input),
    children: { completed: ctx.reconciliation.children.completed },
  };
  const { targetBranch, targetRef } = resolveIntegrationTarget(
    options.targetBranch,
  );
  const taskId = nonEmptyString(payload?.taskId);
  const generation = Number(payload?.generation ?? 1);
  const normalizationInput = payload?.input as
    | ScenarioNormalizationInput
    | undefined;
  const allowTerminalDisposition =
    options.allowTerminalDisposition ??
    payload?.input?.allowTerminalDisposition !== false;
  const liveSpecIdSelection = resolveLiveSpecIdSelection(payload?.input);
  if (liveSpecIdSelection.accepted === false) {
    return ownerResult(ctx, liveSpecIdSelection.problem, [
      `task:${taskId || "missing"}`,
      `audit-spec-ids:${liveSpecIdSelection.auditSpecIds.join(",") || "none"}`,
      "live-spec-id-selection:rejected",
    ]);
  }
  const selectedSpecIds = liveSpecIdSelection.dispatchSpecIds;
  const specId = canonicalAggregateSpecId(selectedSpecIds);
  const livePlanDispatch = resolveLivePlanDispatch({
    taskInput: payload?.input,
  });
  if (
    livePlanDispatch.planPath &&
    !mergeSafeScenarioAggregatePath(livePlanDispatch.planPath)
  ) {
    return ownerResult(
      ctx,
      `${livePlanDispatch.source || "livePlanPath"} must name a feature compact staging plan.`,
      [`task:${taskId || "missing"}`, ...livePlanDispatch.evidence],
    );
  }
  const livePlanPath = livePlanDispatch.planPath;
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
  const priorVerificationInput = resolvePriorVerificationInput(payload?.input);
  const priorVerificationRunId = priorVerificationInput.value?.runId || "";
  const authoritativePriorVerification =
    priorVerificationInput.value?.authoritative === true;
  const acceptedSourceCommit =
    priorVerificationInput.value?.acceptedSourceCommit || "";
  const requiredSource = preparedSourceRequirement(
    payload?.input,
    options.inputSourceIsObservation === true,
  );
  const authoritativeReference = resolvedAuthoritativeRunReference(
    payload,
    ctx.workspace!.appRoot,
    specId,
    liveTarget,
  );
  const otherwisePreparedSourceCommit =
    nonEmptyString(payload?.input?.carrierCommit) ||
    nonEmptyString(payload?.input?.retrySourceCommit) ||
    requiredSource?.sourceCommit ||
    "";
  const preparedSourceCommit =
    acceptedSourceCommit || otherwisePreparedSourceCommit;
  const preparedSourceBranch =
    nonEmptyString(payload?.input?.retrySourceBranch) ||
    requiredSource?.sourceBranch ||
    "";
  const providerTaskIds = authoritativeReference?.taskId
    ? [authoritativeReference.taskId]
    : [];
  const repoDir = ctx.workspace!.projectRoot;
  const workspaceDir = ctx.workspace!.root;

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
  if (priorVerificationInput.problem) {
    return ownerResult(
      ctx,
      `The task declares an invalid prior verification reference: ${priorVerificationInput.problem}.`,
      [`task:${taskId}`, `spec:${specId}`],
    );
  }
  if (
    acceptedSourceCommit &&
    otherwisePreparedSourceCommit &&
    acceptedSourceCommit !== otherwisePreparedSourceCommit
  ) {
    return ownerResult(
      ctx,
      "The task's acceptedSourceCommit conflicts with another prepared source commit.",
      [
        `accepted-source-commit:${acceptedSourceCommit}`,
        `prepared-source-commit:${otherwisePreparedSourceCommit}`,
      ],
    );
  }

  const diagnostic = noIntegrationDiagnosticContract(payload?.input);
  if (diagnostic.problem) {
    return ownerResult(
      ctx,
      `Invalid no-integration diagnostic contract: ${diagnostic.problem}.`,
      [`task:${taskId}`, `spec:${specId}`, "integration:not-attempted"],
    );
  }
  if (diagnostic.contract) {
    return reconcileNoIntegrationDiagnostic(ctx, payload, diagnostic.contract, {
      taskId,
      generation,
      repoDir,
      workspaceDir,
      target: liveTarget,
      standaloneBuildId,
    });
  }

  const historyOnly = historyOnlyAncestryInput(payload?.input);
  if (historyOnly.problem) {
    return ownerResult(ctx, historyOnly.problem, [
      `task:${taskId}`,
      "integration-strategy:rejected",
    ]);
  }
  if (historyOnly.contract) {
    if (integrationMode(targetBranch) !== "direct") {
      return ownerResult(
        ctx,
        "history-only-ancestry is restricted to direct dev integration.",
        [`task:${taskId}`, `target-ref:${targetRef}`],
      );
    }
    const focusedValidationCommands = [
      ...AKS_DIRECT_DEV_VALIDATION_COMMANDS,
      ...(livePlanPath
        ? [
            {
              name: `focused plan freshness (${livePlanPath})`,
              command: "bun",
              args: ["./runner/check-compact-plan-freshness.ts"],
            },
          ]
        : []),
    ];
    const integration = await integrateDirectlyIntoDev({
      repoDir,
      workspaceDir,
      sourceBranch: historyOnly.contract.sourceBranch,
      sourceCommit: historyOnly.contract.testedSourceCommit,
      taskBaseCommit: historyOnly.contract.testedSourceCommit,
      validationCommands: focusedValidationCommands,
      integrationStrategy: historyOnly.contract.strategy,
    });
    if (integration.state !== "integrated") {
      const detail =
        integration.state === "unchanged" ||
        integration.state === "requires-replay"
          ? integration.state
          : integration.error;
      return ownerResult(
        ctx,
        "History-only ancestry integration did not publish a proven direct-dev result.",
        [
          `task:${taskId}`,
          `tested-source:${historyOnly.contract.testedSourceCommit}`,
          `target-ref:${targetRef}`,
          `integration-error:${detail}`,
          "azure-dispatch:not-attempted",
        ],
      );
    }
    const proof = integration.historyOnlyProof;
    const summary = proof
      ? `Published history-only ancestry integration ${proof.integrationCommit} to ${targetRef} without changing the fetched dev tree or dispatching Azure.`
      : `The exact tested source ${historyOnly.contract.testedSourceCommit} is already reachable from freshly fetched ${targetRef}.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [
        `task:${taskId}@${generation}`,
        `integration-strategy:${historyOnly.contract.strategy}`,
        `tested-source:${historyOnly.contract.testedSourceCommit}`,
        `target-ref:${targetRef}@${integration.targetCommit}`,
        ...(proof
          ? [
              `integration-commit:${proof.integrationCommit}`,
              `first-parent:${proof.firstParentCommit}`,
              `first-parent-tree:${proof.firstParentTree}`,
              `integration-tree:${proof.integrationTree}`,
              `history-only-diff:${proof.historyOnlyDiff ? "pass" : "fail"}`,
            ]
          : ["tested-source-already-reachable:true"]),
        ...focusedValidationCommands.map(
          (validation) => `repository-validation:${validation.name}:pass`,
        ),
        "fresh-fetch-ancestry-proof:pass",
        "fresh-fetch-tree-proof:pass",
        "azure-dispatch:not-attempted",
      ],
      actions: [],
    });
  }

  const contextDir = taskContextDir(repoDir, taskId, generation);
  mkdirSync(contextDir, { recursive: true });

  try {
    git(repoDir, ["fetch", "origin", targetBranch]);
    let semanticInvalidation: SemanticInvalidationContext | null = null;
    const invalidatedRunId = nonEmptyString(
      normalizationInput?.invalidatedRunId,
    );
    const invalidatedClaimIds = Array.isArray(
      normalizationInput?.invalidatedClaimIds,
    )
      ? [
          ...new Set(
            normalizationInput.invalidatedClaimIds
              .map(nonEmptyString)
              .filter(Boolean),
          ),
        ].sort()
      : [];
    if (invalidatedRunId || invalidatedClaimIds.length > 0) {
      if (!invalidatedRunId || invalidatedClaimIds.length === 0) {
        return ownerResult(
          ctx,
          "Semantic proof invalidation requires both invalidatedRunId and invalidatedClaimIds.",
          [
            `invalidated-run:${invalidatedRunId || "missing"}`,
            `invalidated-claims:${invalidatedClaimIds.join(",") || "missing"}`,
          ],
        );
      }
      const invalidatedRun = await getPipelineRun(repoDir, invalidatedRunId);
      const invalidatedSourceCommit = nonEmptyString(
        invalidatedRun?.sourceVersion,
      );
      const invalidatedParameters =
        invalidatedRun?.templateParameters &&
        typeof invalidatedRun.templateParameters === "object" &&
        !Array.isArray(invalidatedRun.templateParameters)
          ? (invalidatedRun.templateParameters as Record<string, unknown>)
          : {};
      const invalidatedSpecId = nonEmptyString(invalidatedParameters.specs);
      const invalidatedTarget = nonEmptyString(invalidatedParameters.target);
      if (
        !invalidatedRun ||
        !invalidatedSourceCommit ||
        invalidatedSpecId !== specId ||
        invalidatedTarget !== liveTarget
      ) {
        return ownerResult(
          ctx,
          `Invalidated run ${invalidatedRunId} does not identify the exact ${specId} ${liveTarget} source.`,
          [
            `invalidated-run:${invalidatedRunId}`,
            `invalidated-run-spec:${invalidatedSpecId || "missing"}`,
            `invalidated-run-target:${invalidatedTarget || "missing"}`,
            `invalidated-source-commit:${invalidatedSourceCommit || "missing"}`,
          ],
        );
      }
      const invalidatedSourceBranch = nonEmptyString(
        invalidatedRun.sourceBranch,
      ).replace(/^refs\/heads\//, "");
      if (
        git(
          repoDir,
          ["cat-file", "-e", `${invalidatedSourceCommit}^{commit}`],
          true,
        ).status !== 0 &&
        invalidatedSourceBranch
      ) {
        git(repoDir, ["fetch", "origin", invalidatedSourceBranch], true);
      }
      const explicitInvalidatedSourcePaths = repoRelativePaths(
        normalizationInput?.invalidatedSourcePaths,
      );
      const invalidatedSourcePaths = explicitInvalidatedSourcePaths.length
        ? explicitInvalidatedSourcePaths
        : repoRelativePaths([
            normalizationInput?.scenarioTestPath,
            normalizationInput?.specPath,
            ...selectedSpecIds.map((selectedSpecId) =>
              specFileForSpecAtCommit(
                repoDir,
                invalidatedSourceCommit,
                selectedSpecId,
              ),
            ),
          ]);
      if (!invalidatedSourcePaths.length) {
        return ownerResult(
          ctx,
          "Semantic proof invalidation could not resolve an exact spec or carrier source path.",
          [
            `invalidated-run:${invalidatedRunId}`,
            `invalidated-source-commit:${invalidatedSourceCommit}`,
          ],
        );
      }
      semanticInvalidation = {
        runId: invalidatedRunId,
        claimIds: invalidatedClaimIds,
        sourceCommit: invalidatedSourceCommit,
        sourcePaths: invalidatedSourcePaths,
        lineageInvalid: !invalidatedRunRequiresSourceChange(
          invalidatedRun,
          invalidatedSourceCommit,
        ),
      };
    }
    const semanticInvalidationProblem = (
      candidateCommit: string,
    ): string | null => {
      if (!semanticInvalidation || semanticInvalidation.lineageInvalid) {
        return null;
      }
      const state = semanticInvalidationSourceState({
        repoDir,
        invalidatedCommit: semanticInvalidation.sourceCommit,
        candidateCommit,
        paths: semanticInvalidation.sourcePaths,
      });
      if (state.problem) return state.problem;
      return state.changed
        ? null
        : `semantic proof from run ${semanticInvalidation.runId} was explicitly invalidated for claims ${semanticInvalidation.claimIds.join(", ")}; change at least one structured source path before live dispatch: ${state.paths.join(", ")}`;
    };
    const semanticInvalidationPrompt = semanticInvalidation
      ? [
          `Run ${semanticInvalidation.runId} is invalidated semantic evidence for claims ${semanticInvalidation.claimIds.join(", ")}.`,
          `Its exact source commit is ${semanticInvalidation.sourceCommit}. Relevant structured source paths: ${semanticInvalidation.sourcePaths.join(", ")}.`,
          semanticInvalidation.lineageInvalid
            ? "The prior run's reviewed-source metadata does not match its provider source commit. Do not accept or deduplicate against that run; the unchanged exact source may be dispatched again with corrected canonical lineage metadata."
            : "Inspect the current source and repair or re-evaluate the product contract. The workflow will not dispatch identical relevant source again. Do not treat the earlier green provider result as acceptance evidence.",
        ]
      : [];
    const semanticInvalidationDecisionProblem = (
      decision: AgentDecision,
    ): string | null => {
      if (
        !["committed", "test-current"].includes(decision.decision) ||
        decision.liveReady !== true
      ) {
        return null;
      }
      return semanticInvalidationProblem(
        git(workspaceDir, ["rev-parse", "HEAD"]).stdout,
      );
    };
    let priorVerificationSummary = "";
    let authoritativeRetryRun: PipelineRun | null = null;
    if (priorVerificationRunId) {
      const priorRun = await getPipelineRun(repoDir, priorVerificationRunId);
      const priorRunDisposition = priorRun
        ? priorVerificationRunDisposition(
            priorRun,
            {
              ...(authoritativePriorVerification ? { taskId } : {}),
              specId,
              target: liveTarget,
              standaloneBuildId,
              ...(preparedSourceBranch
                ? { sourceBranch: preparedSourceBranch }
                : {}),
              ...(preparedSourceCommit
                ? { sourceCommit: preparedSourceCommit }
                : {}),
            },
            semanticInvalidation,
          )
        : "mismatch";
      if (!priorRun || priorRunDisposition === "mismatch") {
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
      if (priorRunDisposition === "invalidated-lineage-context") {
        priorVerificationSummary = `Task-designated retry run ${priorVerificationRunId} is terminal with provider result ${priorResult}, but its reviewed-source metadata is stale and its claims were explicitly invalidated. Retain it only as diagnosis context; do not accept or deduplicate it, and allow a fresh exact same-source dispatch with canonical lineage.`;
      } else if (authoritativePriorVerification) {
        authoritativeRetryRun = priorRun;
        priorVerificationSummary = `Task-designated ${priorVerificationInput.value?.kind || "authoritative"} run ${priorVerificationRunId} is terminal with provider result ${priorResult}. Review this exact run as the current task proof; do not replace it merely because the task generation advanced.`;
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

    let sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
    const baseCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
    let preparedSourceEvidence: string[] = [];
    const reconcileRequiredSource =
      async (): Promise<SpecLiveWorkflowResult | null> => {
        if (!requiredSource) return null;
        const prepared = reconcilePreparedTaskSource(
          workspaceDir,
          requiredSource,
          git,
          nonEmptyString(payload?.input?.priorRetainedWorkspace)
            ? {
                workspaceDir: payload?.input?.priorRetainedWorkspace,
                baselineCommit: payload?.input?.baselineCommit,
              }
            : undefined,
        );
        preparedSourceEvidence = prepared.evidence;
        if (prepared.state === "failed") {
          return ownerResult(
            ctx,
            `Could not load the task's required prepared source: ${prepared.error}.`,
            prepared.evidence,
          );
        }
        if (prepared.state === "conflicted") {
          const beforeResolution = sourceCommit;
          const decision = await askAgent(
            ctx,
            [
              `The task requires prepared source ${prepared.sourceBranch}@${prepared.sourceCommit}, and the workflow started a merge into the current task worktree ${workspaceDir}.`,
              `Resolve only this prepared-source merge. Conflicted paths: ${prepared.conflictedPaths.join(", ")}.`,
              "Preserve both the current same-task work and the required prepared-source history, run scoped checks, commit the merge, leave the task worktree clean, and return decision=committed.",
              "Do not abort the merge, replace it with a cherry-pick, push, queue ADO, create another task, or edit task state. This workflow owns publication and live dispatch.",
              "Task:",
              taskDescription(ctx),
            ].join("\n\n"),
            {
              scenarioNormalization: Boolean(normalizationInput),
              continueDomainWorkOnValidation: true,
              validateDecision: (candidate) => {
                if (candidate.decision !== "committed") {
                  return "prepared-source conflict must be resolved in this task before live dispatch";
                }
                if (cleanWorkspace(workspaceDir)) {
                  return "prepared-source resolution must leave the task worktree clean";
                }
                const head = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
                if (head === beforeResolution) {
                  return "prepared-source resolution did not create a new commit";
                }
                return git(
                  workspaceDir,
                  ["merge-base", "--is-ancestor", prepared.sourceCommit, head],
                  true,
                ).status === 0
                  ? null
                  : `resolved source must preserve ${prepared.sourceCommit} in its ancestry`;
              },
            },
          );
          preparedSourceEvidence = [
            ...preparedSourceEvidence,
            ...decision.evidence,
          ];
        }
        sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
        if (
          cleanWorkspace(workspaceDir) ||
          git(
            workspaceDir,
            [
              "merge-base",
              "--is-ancestor",
              requiredSource.sourceCommit,
              sourceCommit,
            ],
            true,
          ).status !== 0
        ) {
          return ownerResult(
            ctx,
            "Prepared source reconciliation did not leave one clean source containing the required commit.",
            [
              ...preparedSourceEvidence,
              `source-commit:${sourceCommit || "unresolved"}`,
            ],
          );
        }
        return null;
      };

    const retainedWorkspaceRequested = Boolean(
      nonEmptyString(payload?.input?.priorRetainedWorkspace),
    );
    if (retainedWorkspaceRequested) {
      const preparedSourceProblem = await reconcileRequiredSource();
      if (preparedSourceProblem) return preparedSourceProblem;
    }

    const retainedWorkspaceMaterialization = materializePriorRetainedWorkspace({
      workspaceDir,
      priorRetainedWorkspace: payload?.input?.priorRetainedWorkspace,
      baselineCommit: payload?.input?.baselineCommit,
    });
    if (!retainedWorkspaceMaterialization.accepted) {
      return ownerResult(
        ctx,
        `Could not materialize the prior retained workspace: ${retainedWorkspaceMaterialization.problem || "unknown error"}.`,
        [
          `task:${taskId}`,
          `spec:${specId}`,
          ...preparedSourceEvidence,
          ...retainedWorkspaceMaterialization.evidence,
        ],
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
          "Do not push, queue ADO, create a PR, edit app task state, or discard work whose ownership cannot be established. A technical failure is not ownership ambiguity: when this dedicated task branch establishes ownership, keep repairing until the source is clean instead of returning needs-owner.",
          `Only if ownership is genuinely ambiguous may you return needs-owner. In that case cite ownership-ambiguity:<exact fact>, authoritative-checkpoint:${currentTaskContextPath(contextDir)}, and authoritative-source-commit:<current HEAD>; the checkpoint pointer must identify the current source/run handoff so a replacement owner can resume safely.`,
          "Task:",
          taskDescription(ctx),
        ].join("\n\n"),
        {
          scenarioNormalization: Boolean(normalizationInput),
          durableContext: {
            contextDir,
            taskId,
            generation,
            sourceCommit: () => git(workspaceDir, ["rev-parse", "HEAD"]).stdout,
            phase: "worktree-recovery",
          },
          onAgentCallNotAdmitted: ({ phase }) => {
            const currentCommit = git(workspaceDir, [
              "rev-parse",
              "HEAD",
            ]).stdout;
            return taskWorktreeRecoveryDeadlineDecision({
              phase,
              workspaceDirty: Boolean(cleanWorkspace(workspaceDir)),
              ownershipEstablished: sourceBranch.startsWith("task/"),
              sourceBranch,
              checkpointPath: currentTaskContextPath(contextDir),
              sourceCommit: currentCommit,
              beforeRecovery,
            });
          },
          validateDecision: (candidate) =>
            taskWorktreeRecoveryDecisionProblem(candidate, {
              workspaceDirty: Boolean(cleanWorkspace(workspaceDir)),
              ownershipEstablished: sourceBranch.startsWith("task/"),
              authoritativeCheckpointPath: currentTaskContextPath(contextDir),
              sourceCommit: git(workspaceDir, ["rev-parse", "HEAD"]).stdout,
            }),
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

    if (!retainedWorkspaceRequested) {
      const preparedSourceProblem = await reconcileRequiredSource();
      if (preparedSourceProblem) return preparedSourceProblem;
    }
    sourceCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
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
    const currentQualityInvariant = (): ScenarioQualityInvariant =>
      scenarioQualityInvariant(workspaceDir, normalizationInput);
    const requireFreshBaseAtDispatch =
      payload?.input?.requireFreshBaseAtDispatch === true;
    const dispatchBaseRef = payload?.input?.baseRef;
    const boundedChangedFiles = payload?.input?.boundedChangedFiles;
    const enforceFreshBaseLineage = (
      candidateCommit: string,
      operation: "publication" | "queue",
    ): SpecLiveWorkflowResult | null => {
      const admission = freshBaseLineageAdmission({
        workspaceDir,
        candidateCommit,
        requireFreshBaseAtDispatch,
        baseRef: dispatchBaseRef,
      });
      if (admission.accepted) return null;
      return ownerResult(
        ctx,
        `Fresh-base lineage refused ${operation} for ${specId}; replay only this task's bounded changes onto the freshly fetched authority and resume the same task through ${name}.`,
        [
          `task:${taskId}@${generation}`,
          `dispatch-operation:${operation}`,
          ...admission.evidence,
          `correction-route:same-task-workflow:${name}`,
        ],
      );
    };
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
      ).status === 0 &&
      currentQualityInvariant().accepted
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
      | { state: "result"; result: SpecLiveWorkflowResult }
    > => {
      let currentCommit = candidateCommit;
      const accumulatedEvidence: string[] = [];

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const admission = checkLiveDispatchAdmission(workspaceDir, specId);
        const semanticProblem = semanticInvalidationProblem(currentCommit);
        const qualityInvariant = currentQualityInvariant();
        const qualityProblem = qualityInvariant.accepted
          ? null
          : qualityInvariant.problem ||
            "scenario quality invariant is not satisfied";
        accumulatedEvidence.push(
          ...admission.evidence,
          ...qualityInvariant.evidence,
          ...(semanticProblem
            ? [`semantic-invalidation-dispatch-refusal:${semanticProblem}`]
            : []),
        );
        if (admission.accepted && !semanticProblem && !qualityProblem) {
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
            ...semanticInvalidationPrompt,
            scenarioQualityRepairInstruction,
            "The workflow evaluated the same private-source and live-admission checks used by the pipeline, the task's explicitly cited structural quality issues, and any semantic-invalidation source boundary in the exact task worktree. Inspect the current source and the raw findings below; do not trust this summary alone.",
            ...accumulatedEvidence,
            "Continue this same task. For a carrier/spec defect, make the smallest repair, run the same checks plus scoped tests, commit it, leave the worktree clean, and return decision=committed.",
            directVitestCompatibilityInstruction,
            "Unsupported product behavior is not automatically nonlive. If the public API exposes an observable rejection or no-op contract, implement a truthful live negative test for that behavior.",
            "A source-only check is diagnostic evidence, not completion. If no truthful staging-observable contract exists, return one exact external wait or needs-owner with the concrete ownership boundary; do not mark the task complete.",
            "Use waiting only for one exact externally observable condition and needs-owner only for a genuine ownership-boundary decision. Do not push, queue ADO, create another task, or edit app state.",
            "Task:",
            taskDescription(ctx),
          ].join("\n\n"),
          {
            scenarioNormalization: Boolean(normalizationInput),
            continueDomainWorkOnValidation: true,
            validateDecision: (candidate) =>
              exactPassNeedsOwnerProblem(candidate, allowTerminalDisposition) ??
              (candidate.decision === "committed"
                ? (scenarioQualityInvariantProblem(
                    workspaceDir,
                    normalizationInput,
                  ) ??
                  semanticInvalidationProblem(
                    git(workspaceDir, ["rev-parse", "HEAD"]).stdout,
                  ))
                : null),
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
      | { state: "result"; result: SpecLiveWorkflowResult }
    > => {
      let currentCommit = candidateCommit;
      const evidence: string[] = [];

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const freshBaseAdmission = freshBaseLineageAdmission({
          workspaceDir,
          candidateCommit: currentCommit,
          requireFreshBaseAtDispatch,
          baseRef: dispatchBaseRef,
        });
        if (!freshBaseAdmission.accepted && requireFreshBaseAtDispatch) {
          evidence.push(
            ...freshBaseAdmission.evidence.filter(
              (item) =>
                item !== "push:not-attempted" &&
                item !== "pipeline-run:not-created",
            ),
          );
          const normalizedBaseRef = freshBaseAdmission.baseRef.replace(
            /^refs\/remotes\//,
            "",
          );
          const replayTargetRef = normalizedBaseRef.startsWith("origin/")
            ? normalizedBaseRef
            : normalizedBaseRef.startsWith("refs/heads/")
              ? `origin/${normalizedBaseRef.slice("refs/heads/".length)}`
              : normalizedBaseRef && !normalizedBaseRef.includes("/")
                ? `origin/${normalizedBaseRef}`
                : "";
          const replay = replayTargetRef
            ? replayScenarioCandidateForDispatch({
                workspaceDir,
                sourceBranch,
                candidateCommit: currentCommit,
                targetRef: replayTargetRef,
                boundedChangedFiles,
              })
            : {
                state: "error" as const,
                error: "dispatch replay could not resolve the fresh base ref",
                evidence: [`fresh-base-ref:${freshBaseAdmission.baseRef}`],
              };
          evidence.push(...replay.evidence);
          if (replay.state === "error") {
            return {
              state: "result",
              result: ownerResult(
                ctx,
                `Could not replay ${specId} onto its fresh dispatch base before publication: ${replay.error}.`,
                evidence,
              ),
            };
          }

          if (replay.state === "conflict") {
            const decision = await askAgent(
              ctx,
              [
                `${replayTargetRef}@${replay.targetCommit} advanced before publication for ${specId}.`,
                `The workflow started replaying only these task-owned commits in ${workspaceDir}: ${replay.taskCommits.join(", ") || "none"}.`,
                `Replay stopped with: ${replay.error}`,
                "Resolve only this replay conflict, complete the cherry-pick, run scoped checks, commit the resolved source, leave the task worktree clean, and return decision=committed.",
                "Do not weaken the fresh-base guard, merge stale branch history, push, queue ADO, create another task, or edit app state. The workflow will re-run admission and publish the replayed source.",
                "Task:",
                taskDescription(ctx),
              ].join("\n\n"),
              {
                scenarioNormalization: Boolean(normalizationInput),
                continueDomainWorkOnValidation: true,
                validateDecision: (candidate) => {
                  if (candidate.decision !== "committed") {
                    return "fresh-base replay conflict must be resolved inside this same domain workflow";
                  }
                  if (cleanWorkspace(workspaceDir)) {
                    return "fresh-base replay repair must leave the task worktree clean";
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
                    return `fresh-base replay repair must descend from ${replayTargetRef}`;
                  }
                  return git(
                    workspaceDir,
                    ["rev-parse", "--verify", "CHERRY_PICK_HEAD"],
                    true,
                  ).status === 0
                    ? "fresh-base replay repair must finish the cherry-pick"
                    : null;
                },
              },
            );
            evidence.push(...decision.evidence);
            currentCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
          } else {
            currentCommit = replay.sourceCommit;
          }

          const dispatch = await prepareLiveDispatch(
            currentCommit,
            `replayed onto fresh dispatch base ${replayTargetRef}`,
          );
          if (dispatch.state === "result") return dispatch;
          currentCommit = dispatch.sourceCommit;
          evidence.push(...dispatch.evidence);

          const postReplayAdmission = freshBaseLineageAdmission({
            workspaceDir,
            candidateCommit: currentCommit,
            requireFreshBaseAtDispatch,
            baseRef: dispatchBaseRef,
          });
          if (!postReplayAdmission.accepted) {
            return {
              state: "result",
              result: ownerResult(
                ctx,
                `Fresh-base lineage refused publication for ${specId} after replay; resume the same task through ${name}.`,
                [
                  `task:${taskId}@${generation}`,
                  "dispatch-operation:publication",
                  ...postReplayAdmission.evidence,
                  `correction-route:same-task-workflow:${name}`,
                ],
              ),
            };
          }
          evidence.push(...postReplayAdmission.evidence);
          const push = git(
            workspaceDir,
            [
              "push",
              scenarioReplayForceWithLeaseArg({
                sourceBranch,
                expectedRemoteCommit: replay.expectedRemoteCommit,
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
                `Could not publish the fresh-base replay for ${specId} without replacing concurrent task-branch work.`,
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
            `dispatch-replay-published:${sourceBranch}@${currentCommit}`,
          );
          return { state: "ready", sourceCommit: currentCommit, evidence };
        }
        if (!freshBaseAdmission.accepted) {
          const lineageRefusal = enforceFreshBaseLineage(
            currentCommit,
            "publication",
          );
          if (lineageRefusal) {
            return { state: "result", result: lineageRefusal };
          }
        } else if (requireFreshBaseAtDispatch) {
          evidence.push(...freshBaseAdmission.evidence);
        }
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
              taskDescription(ctx),
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
      | { state: "result"; result: SpecLiveWorkflowResult }
    > => {
      const directScenarioNormalization =
        integrationMode(targetBranch) === "direct" &&
        normalizationInput?.loopId === "scenario-normalization";
      let dispatchCommit = candidateCommit;
      const dispatchEvidence: string[] = [
        ...preparedSourceEvidence,
        ...livePlanDispatch.evidence,
      ];

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
                taskDescription(ctx),
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

          const lineageRefusal = enforceFreshBaseLineage(
            dispatchCommit,
            "publication",
          );
          if (lineageRefusal) {
            return { state: "result", result: lineageRefusal };
          }
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

        const supersededQueuedRuns = supersededQueuedTaskRuns(
          await branchPipelineRuns(repoDir, sourceBranch),
          {
            taskId,
            generation,
            specId,
            sourceCommit: dispatchCommit,
            target: liveTarget,
            standaloneBuildId,
          },
        );
        for (const superseded of supersededQueuedRuns) {
          const supersededRunId = nonEmptyString(superseded.id);
          await azJson(repoDir, [
            "pipelines",
            "build",
            "cancel",
            "--build-id",
            supersededRunId,
          ]);
          dispatchEvidence.push(
            `superseded-queued-run-canceled:${supersededRunId}@${nonEmptyString(superseded.sourceVersion)}`,
          );
        }

        const lineageRefusal = enforceFreshBaseLineage(dispatchCommit, "queue");
        if (lineageRefusal) {
          return { state: "result", result: lineageRefusal };
        }
        const run = await queueRun(repoDir, {
          taskId,
          generation,
          specId,
          sourceBranch,
          sourceCommit: dispatchCommit,
          target: liveTarget,
          standaloneBuildId,
          ...(livePlanPath ? { planPath: livePlanPath } : {}),
          ...(retryOfRunId && dispatchCommit === candidateCommit
            ? { retryOfRunId }
            : {}),
        });
        registerSpecLiveTrackedRun(
          ctx.workspace!.appRoot,
          nonEmptyString(run.id),
        );
        return {
          state: "queued",
          run,
          sourceCommit: dispatchCommit,
          evidence: dispatchEvidence,
        };
      }

      if (!directScenarioNormalization) {
        const lineageRefusal = enforceFreshBaseLineage(dispatchCommit, "queue");
        if (lineageRefusal) {
          return { state: "result", result: lineageRefusal };
        }
        const run = await queueRun(repoDir, {
          taskId,
          generation,
          specId,
          sourceBranch,
          sourceCommit: dispatchCommit,
          target: liveTarget,
          standaloneBuildId,
          ...(livePlanPath ? { planPath: livePlanPath } : {}),
          ...(retryOfRunId ? { retryOfRunId } : {}),
        });
        registerSpecLiveTrackedRun(
          ctx.workspace!.appRoot,
          nonEmptyString(run.id),
        );
        return {
          state: "queued",
          run,
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
    ): Promise<SpecLiveWorkflowResult> => {
      if (!allowTerminalDisposition) {
        return ownerResult(
          ctx,
          "Terminal disposition was refused because this task requires exact passing live proof.",
          [
            ...decision.evidence,
            `task:${taskId}@${generation}`,
            "terminal-disposition-policy:forbidden",
          ],
        );
      }
      const isScenarioNormalization =
        normalizationInput?.loopId === "scenario-normalization";
      const validateCurrentSource = (): {
        problem: string | null;
        evidence: string[];
      } => {
        const decisionProblem = terminalDispositionDecisionProblem(
          decision,
          allowTerminalDisposition,
        );
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
            taskDescription(ctx),
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
      let integration = await integrateDirectlyIntoDev({
        repoDir,
        workspaceDir,
        sourceBranch,
        sourceCommit: candidateCommit,
        taskBaseCommit: baseCommit,
        validationCommands: AKS_DIRECT_DEV_VALIDATION_COMMANDS,
      });

      if (
        integration.state === "conflict" ||
        integration.state === "requires-replay" ||
        integration.state === "validation-failed"
      ) {
        if (integration.state === "requires-replay") {
          git(repoDir, ["fetch", "origin", targetBranch]);
        }
        const replayBaseline =
          integration.state === "conflict" ||
          integration.state === "validation-failed"
            ? integration.replayBaseCommit
            : git(repoDir, ["rev-parse", targetRef]).stdout;
        const replayFacts =
          integration.state === "conflict"
            ? [
                `The bounded task commits are already being replayed onto ${integration.targetRef}@${replayBaseline} in ${workspaceDir}.`,
                `Conflict evidence: ${integration.error}`,
                "Resolve only this task's conflicts and complete the cherry-pick.",
              ]
            : integration.state === "validation-failed"
              ? [
                  `The replayed candidate ${integration.sourceCommit} descends from ${integration.targetRef}@${replayBaseline}, but repository validation rejected it.`,
                  `Validation evidence: ${integration.error}`,
                  "Repair the rejected candidate in place and commit the correction.",
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
            taskDescription(ctx),
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
        integration = await integrateDirectlyIntoDev({
          repoDir,
          workspaceDir,
          sourceBranch,
          sourceCommit: candidateCommit,
          taskBaseCommit: replayBaseline,
          validationCommands: AKS_DIRECT_DEV_VALIDATION_COMMANDS,
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
      const sourceIsInTarget =
        git(
          repoDir,
          ["merge-base", "--is-ancestor", sourceCommit, targetRef],
          true,
        ).status === 0;
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
      if (!sourceIsInTarget && !/^[0-9a-f]{40}$/i.test(recordedTaskBase)) {
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
        (!sourceIsInTarget &&
          git(workspaceDir, ["cat-file", "-e", `${taskBase}^{commit}`], true)
            .status !== 0) ||
        (!sourceIsInTarget &&
          git(
            workspaceDir,
            ["merge-base", "--is-ancestor", taskBase, "HEAD"],
            true,
          ).status !== 0)
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
        const replay = cherryPickScenarioReplayCommits(
          workspaceDir,
          taskCommits,
        );
        let replayEvidence = [
          `origin-dev-commit:${recordedTaskBase}`,
          `task-replay-base:${taskBase}`,
          `replay-target:${targetRef}@${baseCommit}`,
          `task-owned-commits:${taskCommits.join(",") || "none"}`,
          `discarded-first-parent-merges:${firstParentMerges.join(",") || "none"}`,
          `skipped-empty-equivalent-commits:${replay.skippedCommits.join(",") || "none"}`,
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
              taskDescription(ctx),
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
        const lineageRefusal = enforceFreshBaseLineage(
          replayedCommit,
          "publication",
        );
        if (lineageRefusal) return lineageRefusal;
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
          taskDescription(ctx),
        ].join("\n\n"),
        {
          scenarioNormalization: true,
          validateDecision: (candidate) =>
            exactPassNeedsOwnerProblem(candidate, allowTerminalDisposition),
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

    const exactRunFilter = {
      taskId,
      generation,
      specId,
      sourceCommit,
      target: liveTarget,
      standaloneBuildId,
    };
    const branchExactRuns = matchingTaskRuns(
      await taskRuns(repoDir, contextDir, sourceBranch),
      exactRunFilter,
    );
    const recentExactTaskGenerationRuns = matchingTaskGenerationRuns(
      await recentPipelineRuns(repoDir),
      exactRunFilter,
    );
    let runs = uniqueRuns([
      ...recentExactTaskGenerationRuns,
      ...branchExactRuns,
    ]);
    let latestRun = runs[0];
    let proofSourceBranch = sourceBranch;
    let providerGeneration = generation;
    const adoptExistingRun = (run: PipelineRun): string | null => {
      const adoptedSourceCommit = nonEmptyString(run.sourceVersion);
      const adoptedSourceBranch = nonEmptyString(run.sourceBranch).replace(
        /^refs\/heads\//,
        "",
      );
      const adoptedMetadata = metadataOf(run);
      const adoptedGeneration = Number(adoptedMetadata.generation);
      if (
        !adoptedSourceCommit ||
        !adoptedSourceBranch ||
        !Number.isInteger(adoptedGeneration) ||
        adoptedGeneration < 1
      ) {
        return "existing exact run lacks exact source or generation metadata";
      }
      git(repoDir, ["fetch", "origin", adoptedSourceBranch]);
      if (
        git(
          repoDir,
          ["cat-file", "-e", `${adoptedSourceCommit}^{commit}`],
          true,
        ).status !== 0
      ) {
        return "existing exact run source commit is not available locally after fetching its branch";
      }
      if (cleanWorkspace(workspaceDir)) {
        return "cannot adopt exact source into a dirty task worktree";
      }
      if (
        git(workspaceDir, ["rev-parse", "HEAD"]).stdout !== adoptedSourceCommit
      ) {
        const reset = git(
          workspaceDir,
          ["reset", "--hard", adoptedSourceCommit],
          true,
        );
        if (
          reset.status !== 0 ||
          git(workspaceDir, ["rev-parse", "HEAD"]).stdout !==
            adoptedSourceCommit
        ) {
          return "could not restore the exact live-tested source in the task worktree";
        }
      }
      sourceCommit = adoptedSourceCommit;
      proofSourceBranch = adoptedSourceBranch;
      providerGeneration = adoptedGeneration;
      latestRun = run;
      runs = uniqueRuns([run, ...runs]);
      saveRunReceipt(contextDir, run, sourceCommit);
      const runId = nonEmptyString(run.id);
      if (runId) {
        registerSpecLiveTrackedRun(ctx.workspace!.appRoot, runId);
      }
      return null;
    };
    if (
      authoritativeRetryRun &&
      !(priorVerificationInput.value?.kind === "accepted" && latestRun)
    ) {
      const adoptionProblem = adoptExistingRun(authoritativeRetryRun);
      if (adoptionProblem) {
        return ownerResult(
          ctx,
          `Task-designated retry ${priorVerificationRunId} ${adoptionProblem}.`,
          [`pipeline-run:${priorVerificationRunId}`],
        );
      }
    } else if (
      authoritativeReference &&
      authoritativeReference.sourceCommit === sourceCommit
    ) {
      const authoritativeRun = await getPipelineRun(
        repoDir,
        authoritativeReference.runId,
      );
      if (
        !authoritativeRun ||
        !runMatchesPriorVerification(authoritativeRun, {
          ...(authoritativeReference.taskId
            ? { taskId: authoritativeReference.taskId }
            : {}),
          specId,
          target: liveTarget,
          standaloneBuildId,
          sourceBranch: authoritativeReference.sourceBranch,
          sourceCommit: authoritativeReference.sourceCommit,
        })
      ) {
        return ownerResult(
          ctx,
          `Authoritative run ${authoritativeReference.runId} does not match the exact same-spec same-source proof contract for this task source.`,
          [
            `pipeline-run:${authoritativeReference.runId}`,
            `spec:${specId}`,
            `source-branch:${authoritativeReference.sourceBranch}`,
            `source-commit:${authoritativeReference.sourceCommit}`,
            `live-target:${liveTarget}`,
            ...(standaloneBuildId
              ? [`standalone-build-id:${standaloneBuildId}`]
              : []),
          ],
        );
      }
      const adoptionProblem = adoptExistingRun(authoritativeRun);
      if (adoptionProblem) {
        return ownerResult(
          ctx,
          `Authoritative run ${authoritativeReference.runId} ${adoptionProblem}.`,
          [
            `pipeline-run:${authoritativeReference.runId}`,
            `source-branch:${authoritativeReference.sourceBranch}`,
            `source-commit:${authoritativeReference.sourceCommit}`,
          ],
        );
      }
    } else if (latestRun) {
      const adoptionProblem = adoptExistingRun(latestRun);
      if (adoptionProblem) {
        return ownerResult(
          ctx,
          `Existing exact task-generation run ${nonEmptyString(latestRun.id) || "unknown"} ${adoptionProblem}.`,
          [
            `task:${taskId}@${generation}`,
            `spec:${specId}`,
            `source-commit:${sourceCommit}`,
          ],
        );
      }
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
        ...semanticInvalidationPrompt,
        "Treat the appended Trigger Event as hot evidence, not merely as a wake. If it reports an exact passing pipeline.spec.observed for this task branch at a different source commit, inspect that tested commit against current HEAD and current integration authority. Restore the exact tested commit only when doing so preserves every required same-task change; otherwise keep the newer source and require a fresh exact run. Equivalent file content alone is not exact source proof.",
        earlyCheckpointInstruction,
        "Inspect the original task, current spec status, model, direct carrier, nearby good/bad examples, and prior evidence. Decide whether this exact source is genuinely ready for live execution.",
        "Before setting liveReady=true, compare every claim assertion ID declared by the exact spec with the IDs the execute-mode carrier will emit. A local check-mode pass is insufficient when it does not exercise that mapping; repair the mapping and add a scoped assertion-contract check when the mapping is programmatic.",
        scenarioQualityRepairInstruction,
        "If a bounded repo change is needed, make it, run scoped local checks, commit it, leave the worktree clean, and return decision=committed.",
        directVitestCompatibilityInstruction,
        currentAdoSurfaceInstruction,
        "If current source is already the exact content that should be live-tested, leave it unchanged and return decision=test-current.",
        "For committed or test-current, separately set liveReady=true only when this exact source may be sent to ADO now. If source is prepared but an external fact still prevents execution, set liveReady=false and include one exact observable Condition. If this app cannot observe the required fact, return needs-owner instead. Never treat a commit as permission to run.",
        ...(normalizationInput && allowTerminalDisposition
          ? [terminalDispositionSourceRepairInstruction]
          : []),
        ...(options.existingRecoveryAfterRunId
          ? [
              `This is recovery work for blocking run ${options.existingRecoveryAfterRunId}. If a later current-main run already passed this exact spec and still applies to current main, leave source unchanged and return decision=accepted-pass. Populate recovery={pipelineRunId,sourceBranch,sourceCommit,artifactPath} with the aggregate result artifact that contains this spec verdict, and cite ancestry/relevant-change evidence. Do not dispatch redundant proof.`,
            ]
          : []),
        allowTerminalDisposition
          ? "A blocked spec, reviewed exception, or intentionally paused execution path is not live-ready merely because its file layout is normalized. Implement a truthful observable contract, return an exact wait, make the structured terminal-disposition judgment when the scenario-normalization exception above applies, or identify the genuine ownership boundary."
          : "This task requires exact passing live proof. A product or environment failure remains an open recovery obligation: repair it or return one exact wait or genuine ownership boundary; do not use terminal-disposition as completion. When the app cannot observe a genuine external blocker, return needs-owner and name it with external-capability:<capability>, external-producer:<producer>, artifact:<evidence path>, and resume-condition:<observable fact> evidence.",
        "Do not queue ADO, create a PR, create another branch/worktree, or edit app task state; this workflow owns those steps.",
        "Use waiting only with one exact machine-observable Condition. Use needs-owner only for a concrete decision that source facts cannot resolve.",
        "Task:",
        taskDescription(ctx),
      ].join("\n\n");
      const preparationResume = options.preparationResume;
      if (
        preparationResume &&
        preparationResume.sourceCommit !== sourceCommit
      ) {
        return ownerResult(
          ctx,
          `Freshness-only preparation resume names ${preparationResume.sourceCommit}, but the exact task source is ${sourceCommit}.`,
          [
            ...preparationResume.evidence,
            `source-commit:${sourceCommit}`,
            "freshness-only-resume:rejected-source-mismatch",
          ],
        );
      }
      let decision: AgentDecision =
        resumedPreparationDecision(options, sourceCommit) ??
        (await askAgent(ctx, preparationPrompt, {
          scenarioNormalization: Boolean(normalizationInput),
          continueDomainWorkOnValidation: true,
          durableContext: {
            contextDir,
            taskId,
            generation,
            sourceCommit: () => git(workspaceDir, ["rev-parse", "HEAD"]).stdout,
            phase: "preparation",
          },
          validateDecision: (candidate) =>
            preparationDecisionProblem(
              candidate,
              Boolean(options.existingRecoveryAfterRunId),
            ) ??
            terminalDispositionDecisionProblem(
              candidate,
              allowTerminalDisposition,
            ) ??
            exactPassNeedsOwnerProblem(candidate, allowTerminalDisposition) ??
            (["committed", "test-current", "accepted-pass"].includes(
              candidate.decision,
            )
              ? scenarioQualityInvariantProblem(
                  workspaceDir,
                  normalizationInput,
                )
              : null) ??
            semanticInvalidationDecisionProblem(candidate),
        }));
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
            durableContext: {
              contextDir,
              taskId,
              generation,
              sourceCommit: () =>
                git(workspaceDir, ["rev-parse", "HEAD"]).stdout,
              phase: "preparation-head-correction",
            },
            validateDecision: (candidate) =>
              preparationDecisionProblem(
                candidate,
                Boolean(options.existingRecoveryAfterRunId),
              ) ??
              terminalDispositionDecisionProblem(
                candidate,
                allowTerminalDisposition,
              ) ??
              exactPassNeedsOwnerProblem(candidate, allowTerminalDisposition) ??
              (["committed", "test-current", "accepted-pass"].includes(
                candidate.decision,
              )
                ? scenarioQualityInvariantProblem(
                    workspaceDir,
                    normalizationInput,
                  )
                : null) ??
              semanticInvalidationDecisionProblem(candidate) ??
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
              ctx.workspace!.appRoot,
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
          state: "converged",
          summary: decision.summary,
          evidence: [...decision.evidence, "existing-recovery:true"],
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
      runs = uniqueRuns([
        ...matchingTaskGenerationRuns(await recentPipelineRuns(repoDir), {
          taskId,
          generation,
          specId,
          sourceCommit,
          target: liveTarget,
          standaloneBuildId,
        }),
        ...matchingTaskRuns(await taskRuns(repoDir, contextDir, sourceBranch), {
          taskId,
          generation,
          specId,
          sourceCommit,
          target: liveTarget,
          standaloneBuildId,
        }),
      ]);
      latestRun = runs[0];
      if (latestRun) {
        const adoptionProblem = adoptExistingRun(latestRun);
        if (adoptionProblem) {
          return ownerResult(
            ctx,
            `Existing exact task-generation run ${nonEmptyString(latestRun.id) || "unknown"} ${adoptionProblem}.`,
            [
              `task:${taskId}@${generation}`,
              `spec:${specId}`,
              `source-commit:${sourceCommit}`,
            ],
          );
        }
      }
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
          ...livePlanDispatch.evidence,
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
      const terminalArtifactPaths = artifactJsonFiles(
        collectedRunEvidence.artifactPaths,
      );
      const capacityArtifactPath = !allowTerminalDisposition
        ? terminalArtifactPaths.find((path) =>
            artifactProvesPreClaimCapacityBlock(path, specId),
          )
        : undefined;
      if (capacityArtifactPath) {
        if (masterValidationCapacityRetryDue(latestRun)) {
          const retryCycleSlot = masterValidationCapacityPulseCycleSlot();
          const dispatch = await prepareLiveDispatch(
            sourceCommit,
            `capacity retry in cycle slot ${retryCycleSlot} after run ${runId}`,
          );
          if (dispatch.state === "result") return dispatch.result;
          sourceCommit = dispatch.sourceCommit;
          const publication = await publishTaskBranch(
            sourceCommit,
            `capacity retry in cycle slot ${retryCycleSlot} after run ${runId}`,
          );
          if (publication.state === "result") return publication.result;
          sourceCommit = publication.sourceCommit;
          const queued = await queueFreshRun(sourceCommit, runId);
          if (queued.state === "result") return queued.result;
          sourceCommit = queued.sourceCommit;
          latestRun = queued.run;
          saveRunReceipt(contextDir, latestRun, sourceCommit);
          const retryRunId = nonEmptyString(latestRun.id);
          return waitingResult(
            ctx,
            `Queued capacity retry run ${retryRunId} for ${specId} in master-validation cycle slot ${retryCycleSlot}.`,
            [
              `task:${taskId}@${generation}`,
              `spec:${specId}`,
              `source-branch:${sourceBranch}`,
              `source-commit:${sourceCommit}`,
              `live-target:${liveTarget}`,
              ...(standaloneBuildId
                ? [`standalone-build-id:${standaloneBuildId}`]
                : []),
              `capacity-retry-of-run:${runId}`,
              `capacity-retry-cycle-slot:${retryCycleSlot}`,
              ...dispatch.evidence,
              ...publication.evidence,
              ...queued.evidence,
              `pipeline-run:${retryRunId}`,
            ],
            pipelineWaitCondition(retryRunId),
          );
        }
        const baselineCycleSlot = masterValidationCapacityPulseCycleSlot();
        return waitingResult(
          ctx,
          `Run ${runId} reached Azure cluster-create capacity before any ${specId} claim; wait for the next master-validation capacity slot before reconsidering the same exact source.`,
          [
            `pipeline-run:${runId}`,
            `spec:${specId}`,
            `source-commit:${sourceCommit}`,
            `artifact:${capacityArtifactPath}`,
            "capacity-code:AKSCapacityHeavyUsage",
            "claim-observations:0",
            "cleanup:complete",
            `capacity-baseline-cycle-slot:${baselineCycleSlot}`,
          ],
          masterValidationCapacityPulseWaitCondition(
            taskId,
            generation,
            baselineCycleSlot,
          ),
        );
      }
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
      const candidateProof = candidateReviewedRunProof({
        taskId,
        generation,
        providerGeneration,
        specIds: selectedSpecIds,
        target: liveTarget,
        standaloneBuildId,
        sourceBranch: proofSourceBranch,
        sourceCommit,
        runId,
        runResult,
      });
      const preIntegrationVerification = verifySpecLiveProofFacts({
        taskId,
        generation,
        specIds: selectedSpecIds,
        target: liveTarget,
        standaloneBuildId,
        proof: candidateProof,
        run: latestRun,
        artifactPaths: terminalArtifactPaths,
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
        providerTaskIds,
      });
      const decision = await askAgent(
        ctx,
        [
          `Review terminal Azure DevOps run ${runId} for ${specId}.`,
          `The exact source is ${proofSourceBranch}@${sourceCommit}; provider result is ${runResult}.`,
          ...semanticInvalidationPrompt,
          `The exact live target is ${liveTarget}${standaloneBuildId ? ` with standalone_build_id=${standaloneBuildId}` : ""}.`,
          exactLiveTargetInstruction(liveTarget, standaloneBuildId),
          `Workflow code collected authenticated run evidence in ${runContextDir}. Run metadata: ${collectedRunEvidence.runPath}. Artifact list: ${collectedRunEvidence.artifactListPath}. Downloaded artifact directories: ${collectedRunEvidence.artifactPaths.join(", ") || "none"}. Collection errors: ${collectedRunEvidence.errors.join(" | ") || "none"}.`,
          preIntegrationVerification.accepted
            ? "Hard live-proof validation found no structural proof gaps."
            : `Hard live-proof validation findings to resolve or explain: ${preIntegrationVerification.summary}`,
          `Use ${runContextDir} as the exclusive source of run-specific facts for this run. Also inspect the exact task source and official contract sources when diagnosing why those facts occurred. Do not reuse task-root or earlier-run run evidence, do not scrape Azure DevOps web pages, and do not write runtime artifacts into tracked source paths.`,
          "Inspect run metadata, plan inputs, per-spec result, live resource identity, assertions, and cleanup proof. The aggregate provider result alone is not a spec verdict.",
          semanticClaimEvidenceInstruction,
          scenarioQualityRepairInstruction,
          ...(expectedVitestTestCountRaw !== undefined
            ? [
                `This task declares the hard generated-suite invariant expectedVitestTestCount=${expectedVitestTestCount}. Inspect the exact downloaded vitest.json; accepted-pass requires numTotalTests to equal that value.`,
              ]
            : []),
          "Return accepted-pass only for exact same-spec live proof on this source commit.",
          ...(integrationMode(targetBranch) === "pull-request"
            ? [
                `For this ${targetBranch}-publication task, accepted-pass is only the claim-level behavior verdict. It is not terminal task acceptance while canonical proof metadata is invalid or the tested repair is absent from current ${targetRef}. The workflow must continue the same task through a focused non-draft review-ready PR, one actionable human handoff, and explicit current-${targetBranch} readback after merge.`,
              ]
            : []),
          acceptedLiveProofSourceInstruction,
          "A source-only check or admission refusal is diagnostic evidence, not completion. Implement an observable live negative test when the API contract permits it; otherwise return an exact external wait or a genuine ownership-boundary decision.",
          ...(normalizationInput && allowTerminalDisposition
            ? [terminalDispositionSourceRepairInstruction]
            : []),
          "For a carrier/spec defect, make the smallest fix in the task worktree, run scoped local checks, commit, leave the worktree clean, and return committed.",
          directVitestCompatibilityInstruction,
          "When returning committed, separately set liveReady=true only if the repaired exact source may be sent to ADO now. If an external fact still prevents execution, set liveReady=false with one exact observable Condition; use needs-owner when the app cannot observe that boundary. A commit alone is not permission to rerun.",
          transientRetryDiagnosisInstruction,
          failedRunsForCommit >= 2
            ? "The same source commit already has at least two terminal nonpassing runs. Do not request another unchanged retry; commit a fix, return an exact wait, or request owner judgment."
            : "Use retry-transient only when artifacts prove a transient provider/environment failure and an unchanged retry is truthful.",
          "Do not create a successor task, queue ADO, create/complete a PR, or edit app task state.",
          "Task:",
          taskDescription(ctx),
        ].join("\n\n"),
        {
          scenarioNormalization: Boolean(normalizationInput),
          continueDomainWorkOnValidation: true,
          durableContext: {
            contextDir,
            taskId,
            generation,
            sourceCommit: () => git(workspaceDir, ["rev-parse", "HEAD"]).stdout,
            runId,
            phase: "terminal-review",
          },
          validateDecision: (candidate) =>
            terminalRunDecisionProblem(candidate, {
              requireSucceededProvider: Boolean(normalizationInput),
              providerResult: runResult,
            }) ??
            terminalDispositionDecisionProblem(
              candidate,
              allowTerminalDisposition,
            ) ??
            exactPassNeedsOwnerProblem(candidate, allowTerminalDisposition) ??
            (["accepted-pass", "committed"].includes(candidate.decision)
              ? scenarioQualityInvariantProblem(
                  workspaceDir,
                  normalizationInput,
                )
              : null) ??
            (candidate.decision === "accepted-pass" &&
            !preIntegrationVerification.accepted
              ? preIntegrationVerification.summary
              : null) ??
            (candidate.decision === "accepted-pass"
              ? semanticInvalidationProblem(sourceCommit)
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
        const standaloneTargetProblem = standaloneRetryTargetProblem({
          standaloneBuildId,
          hasSameSpecArtifact: terminalArtifactPaths.some(
            (path) => nonEmptyString(readJsonRecord(path)?.specId) === specId,
          ),
        });
        if (standaloneTargetProblem) {
          return ownerResult(ctx, standaloneTargetProblem, [
            ...decision.evidence,
            `pipeline-run:${runId}`,
            `standalone-build-id:${standaloneBuildId}`,
            "same-spec-artifact:missing",
          ]);
        }
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
        preIntegrationInvariantSatisfied =
          !scenarioNormalizationInvariant(workspaceDir, normalizationInput)
            .stillListed && currentQualityInvariant().accepted;
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
      providerTaskIds,
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
      let proofIntegrationMode: ReviewedRunProof["integrationMode"] =
        "ancestry";
      let proofIntegratedPaths: string[] = [];
      let lastPushError = "";
      let targetAdvanceEvidence: string[] = [];
      const scenarioReplayAnchors = normalizationInput
        ? repoRelativePaths([
            normalizationInput.scenarioTestPath,
            normalizationInput.adapterPath,
          ])
        : [];
      const scenarioReplayFeatures = normalizationInput
        ? (Array.isArray(normalizationInput.featureIds)
            ? normalizationInput.featureIds
            : []
          ).filter((value): value is string => typeof value === "string")
        : [];
      const scenarioReplayBase = normalizationInput
        ? scenarioIntegrationReplayBase({
            workspaceDir,
            recordedTaskBase: nonEmptyString(
              normalizationInput.originDevCommit,
            ),
            replayState: readScenarioReplayState(contextDir),
            sourceCommit,
            targetRef,
          })
        : "";
      const scenarioReceiptPaths = normalizationInput
        ? [
            ...new Set([
              ...changedPathsBetweenCommits(
                workspaceDir,
                scenarioReplayBase,
                sourceCommit,
              ),
              ...scenarioReplayAnchors,
              ...selectedSpecIds
                .map((selectedSpecId) =>
                  specFileForSpecAtCommit(
                    workspaceDir,
                    sourceCommit,
                    selectedSpecId,
                  ),
                )
                .filter(Boolean),
            ]),
          ].sort()
        : [];

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        git(repoDir, ["fetch", "origin", targetBranch]);
        const sourceIsInTarget =
          git(
            repoDir,
            ["merge-base", "--is-ancestor", sourceCommit, targetRef],
            true,
          ).status === 0;
        const frozenCandidateEquivalent =
          payload?.input?.frozenCandidateRule === true
            ? frozenCandidateContentEquivalent({
                repoDir,
                sourceCommit,
                targetCommit: targetRef,
                boundedSourceFiles: payload.input.boundedSourceFiles,
              })
            : { equivalent: false, paths: [] };
        if (!sourceIsInTarget && frozenCandidateEquivalent.equivalent) {
          integratedCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
          proofIntegrationMode = "bounded-content-equivalent";
          proofIntegratedPaths = frozenCandidateEquivalent.paths;
          targetAdvanceEvidence = [
            "integration-mode:bounded-content-equivalent",
            ...proofIntegratedPaths.map((path) => `integrated-path:${path}`),
          ];
          break;
        }
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
            workspaceDir,
            ["merge-base", sourceCommit, targetRef],
            true,
          );
          const sourcePathResult =
            mergeBase.status === 0
              ? git(
                  workspaceDir,
                  ["diff", "--name-only", mergeBase.stdout, sourceCommit, "--"],
                  true,
                )
              : null;
          const targetPathResult =
            mergeBase.status === 0
              ? git(
                  workspaceDir,
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
            knowledgeModelStableForSpec({
              repoDir: workspaceDir,
              sourceCommit,
              targetCommit: targetRef,
              specId,
            });
          const protectedSourcePaths = proofProtectedScenarioPaths(sourcePaths);
          const protectedSourcePathSet = new Set(protectedSourcePaths);
          const overlappingProtectedPaths = targetPaths.filter((path) =>
            protectedSourcePathSet.has(path),
          );
          const judgmentHead = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
          const targetAdvanceJudgment = await askAgent(
            ctx,
            [
              `${specId} passed exact live run ${runId} at ${sourceCommit}, and current ${targetRef} advanced to ${git(workspaceDir, ["rev-parse", targetRef]).stdout}.`,
              "Judge whether the exact live proof still applies after the intervening target changes. Inspect the current Git diff and task evidence yourself; the path lists below are collected facts, not a verdict.",
              `Merge base: ${mergeBase.status === 0 ? mergeBase.stdout : "unavailable"}`,
              `Task source paths: ${sourcePaths.join(", ") || "none"}`,
              `Intervening target paths: ${targetPaths.join(", ") || "none"}`,
              `Protected-path overlap: ${overlappingProtectedPaths.join(", ") || "none"}`,
              `Exact-spec knowledge-model projection stable: ${String(knowledgeModelStable)}`,
              "The target is expected not to contain the task source changes before integration. Its old carrier, old probeRef, or missing task metadata is not an intervening change and must not be used as proof invalidation.",
              "Judge only changes introduced on the target after the merge base, represented by Intervening target paths. The task source paths are the tested patch that this workflow will merge.",
              "When protected-path overlap is empty and the exact-spec knowledge projection is stable, return accepted-pass unless one listed intervening target path changes a concrete shared runtime, runner, helper, or expectation used by this exact proof; name that dependency in evidence.",
              "Checked-in compact plans and diagnostics do not affect a single-spec live proof unless current execution source actually reads them.",
              "Return accepted-pass only when the tested behavior and declared expectations remain valid. Leave source unchanged; code will merge and independently reject any change to a tested protected path.",
              "Return test-current when any intervening change can affect this proof; the workflow will refresh the candidate and queue a fresh exact run.",
              "Do not edit, commit, merge, push, queue ADO, create a task, or edit app state.",
              "Task:",
              taskDescription(ctx),
            ].join("\n\n"),
            {
              scenarioNormalization: directScenarioNormalization,
              continueDomainWorkOnValidation: true,
              validateDecision: targetAdvanceProofDecisionProblem,
            },
          );
          if (
            git(workspaceDir, ["rev-parse", "HEAD"]).stdout !== judgmentHead ||
            cleanWorkspace(workspaceDir)
          ) {
            return ownerResult(
              ctx,
              "Target-advance proof review changed the task worktree; integration was refused.",
              [...targetAdvanceJudgment.evidence, `workspace:${workspaceDir}`],
            );
          }
          targetAdvanceEvidence = targetAdvanceJudgment.evidence;
          if (targetAdvanceJudgment.decision === "accepted-pass") {
            const mergedProof = directScenarioNormalization
              ? replayScenarioNormalizationOntoTarget({
                  workspaceDir,
                  recordedBaseCommit: scenarioReplayBase,
                  sourceCommit,
                  targetRef,
                  anchorPaths: scenarioReplayAnchors,
                  featureIds: scenarioReplayFeatures,
                })
              : mergeAcceptedTargetAdvanceProof({
                  workspaceDir,
                  sourceCommit,
                  targetRef,
                  protectedSourcePaths,
                });
            const acceptedReplay =
              directScenarioNormalization &&
              mergedProof.state === "replayed" &&
              mergedProof.protectedPathsEquivalent;
            if (mergedProof.state === "merged" || acceptedReplay) {
              if (acceptedReplay && mergedProof.state === "replayed") {
                proofIntegrationMode = "bounded-content-equivalent";
                proofIntegratedPaths = mergedProof.changedPaths;
                targetAdvanceEvidence = [
                  ...targetAdvanceEvidence,
                  "integration-mode:scenario-bounded-replay",
                  ...mergedProof.selectedCommits.map(
                    (commit) => `replayed-task-commit:${commit}`,
                  ),
                  ...mergedProof.changedPaths.map(
                    (path) => `integrated-path:${path}`,
                  ),
                ];
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
              const pushedCommit = git(workspaceDir, [
                "rev-parse",
                "HEAD",
              ]).stdout;
              git(repoDir, ["fetch", "origin", targetBranch]);
              if (
                git(
                  repoDir,
                  [
                    "merge-base",
                    "--is-ancestor",
                    acceptedReplay ? pushedCommit : sourceCommit,
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
            if (
              directScenarioNormalization &&
              mergedProof.state === "invalid"
            ) {
              return ownerResult(
                ctx,
                `Refused broad scenario replay: ${mergedProof.reason}.`,
                mergedProof.evidence,
              );
            }
          }

          if (directScenarioNormalization) {
            const refresh = replayScenarioNormalizationOntoTarget({
              workspaceDir,
              recordedBaseCommit: scenarioReplayBase,
              sourceCommit,
              targetRef,
              anchorPaths: scenarioReplayAnchors,
              featureIds: scenarioReplayFeatures,
            });
            let refreshEvidence: string[] = [...targetAdvanceEvidence];
            if (refresh.state === "invalid") {
              return ownerResult(
                ctx,
                `Refused broad scenario refresh: ${refresh.reason}.`,
                [...refreshEvidence, ...refresh.evidence],
              );
            }
            if (refresh.state === "conflicted") {
              const decision = await askAgent(
                ctx,
                [
                  `${specId} passed exact live run ${runId} at ${sourceCommit}, but replaying its bounded task commits on current ${targetRef} conflicts.`,
                  `Resolve only the current bounded patch application in ${workspaceDir}. Conflicted paths: ${refresh.conflictedPaths.join(", ") || "unknown"}. Preserve the scenario-normalization intent, run scoped checks plus the strict scenario inventory, commit the resolved patch, leave the worktree clean, and return decision=committed.`,
                  "Do not push, queue ADO, create a PR, create another task, or edit app state. The workflow will push the refreshed task branch and require a new exact live run before integration.",
                  "Task:",
                  taskDescription(ctx),
                ].join("\n\n"),
                { scenarioNormalization: true },
              );
              if (decision.decision !== "committed") {
                return ownerResult(ctx, decision.summary, decision.evidence);
              }
              refreshEvidence = decision.evidence;
            } else {
              refreshEvidence = [
                ...refreshEvidence,
                ...refresh.selectedCommits.map(
                  (commit) => `replayed-task-commit:${commit}`,
                ),
                ...refresh.changedPaths.map((path) => `refreshed-path:${path}`),
              ];
            }

            let refreshedCommit = git(workspaceDir, [
              "rev-parse",
              "HEAD",
            ]).stdout;
            if (cleanWorkspace(workspaceDir)) {
              return ownerResult(
                ctx,
                `Refreshing the scenario-normalization candidate from current ${targetBranch} did not leave one clean bounded commit.`,
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
                taskDescription(ctx),
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
      if (
        proofIntegratedPaths.length === 0 &&
        scenarioReceiptPaths.length > 0
      ) {
        proofIntegratedPaths = scenarioReceiptPaths;
      }
      proof = {
        ...proof,
        targetRef,
        mergedCommit: integratedCommit,
        integrationMode: proofIntegrationMode,
        integratedPaths: proofIntegratedPaths,
      };
      saveProof(contextDir, proof);
      const summary =
        proofIntegrationMode === "bounded-content-equivalent"
          ? `${specId} passed run ${runId} at ${sourceCommit}; its bounded content was replayed onto current ${targetBranch}@${integratedCommit}.`
          : `${specId} passed run ${runId} at ${sourceCommit} and directly integrated that tested commit into ${targetBranch}@${integratedCommit}.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          ...proof.evidence,
          ...targetAdvanceEvidence,
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

    const sourceIsInTarget =
      git(
        repoDir,
        ["merge-base", "--is-ancestor", sourceCommit, targetRef],
        true,
      ).status === 0;
    const boundedTargetEquivalent = sourceIsInTarget
      ? { equivalent: false, paths: [] as string[] }
      : boundedSourceEquivalentToTarget({
          repoDir,
          sourceCommit,
          targetCommit: targetRef,
        });
    const branchHasChange =
      !sourceIsInTarget && !boundedTargetEquivalent.equivalent;
    if (!branchHasChange) {
      const existingPrId = nonEmptyString(existingPr?.pullRequestId);
      const abandonedExistingPr =
        existingPrId && nonEmptyString(existingPr?.status) === "active"
          ? await abandonPullRequest(repoDir, existingPrId)
          : false;
      const currentTargetCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
      if (boundedTargetEquivalent.equivalent) {
        proof = {
          ...proof,
          targetRef,
          mergedCommit: currentTargetCommit,
          integrationMode: "bounded-content-equivalent",
          integratedPaths: boundedTargetEquivalent.paths,
        };
      } else {
        proof = {
          ...proof,
          targetRef,
          mergedCommit: currentTargetCommit,
        };
      }
      saveProof(contextDir, proof);
      const summary = boundedTargetEquivalent.equivalent
        ? `${specId} passed exact live verification on ${sourceCommit}; current ${targetRef} already carries the same bounded repair content, so no PR publication is required.`
        : `${specId} passed exact live verification on current ${targetRef}@${sourceCommit}; no source publication is required.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [
          ...proof.evidence,
          ...(boundedTargetEquivalent.equivalent
            ? [
                "integration-mode:bounded-content-equivalent",
                ...boundedTargetEquivalent.paths.map(
                  (path) => `integrated-path:${path}`,
                ),
              ]
            : []),
          `proof:${proofPath(contextDir)}`,
          `pipeline-run:${runId}`,
          `source-commit:${sourceCommit}`,
          `integrated-commit:${currentTargetCommit}`,
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

    const pullRequestSourceBranch = proofSourceBranch || sourceBranch;
    let pr = (
      await pullRequests(repoDir, pullRequestSourceBranch, targetBranch)
    )[0];
    if (!pr) {
      pr = await createPullRequest(repoDir, {
        taskId,
        specId,
        sourceBranch: pullRequestSourceBranch,
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
    const review =
      prStatus === "active"
        ? await pullRequestReview(repoDir, prId)
        : {
            available: true,
            unresolvedCount: 0,
            fingerprint: "",
            threads: [],
          };
    let reviewReadyEvidence: string[] = [];

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
    if (
      prStatus === "active" &&
      prSourceCommit &&
      prSourceCommit !== sourceCommit
    ) {
      return ownerResult(
        ctx,
        `PR ${prId} currently points at ${prSourceCommit}, but the accepted live proof is for ${sourceCommit}; exact replacement proof is required before this PR can gate publication.`,
        [
          ...proof.evidence,
          `pull-request:${prId}`,
          `source-commit:${sourceCommit}`,
          `pull-request-source-commit:${prSourceCommit}`,
          `merge-status:${mergeStatus}`,
        ],
      );
    }
    if (prStatus === "completed") {
      reviewReadyEvidence = await reviewReadyHandoff(ctx, {
        taskId,
        specId,
        pullRequestId: prId,
        runId,
        sourceCommit,
      });
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
          ...reviewReadyEvidence,
          `proof:${proofPath(contextDir)}`,
          `pipeline-run:${runId}`,
          `pull-request:${prId}`,
          `source-commit:${sourceCommit}`,
          `merged-commit:${integration.targetCommit}`,
          `current-main-readback:${targetRef}@${git(repoDir, ["rev-parse", targetRef]).stdout}`,
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
          taskDescription(ctx),
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

    await publishPullRequestReviewReady(repoDir, prId);
    reviewReadyEvidence = await reviewReadyHandoff(ctx, {
      taskId,
      specId,
      pullRequestId: prId,
      runId,
      sourceCommit,
    });
    const waitingForReview = review.available && review.unresolvedCount > 0;
    let reviewJudgmentEvidence: string[] = [];
    if (
      waitingForReview &&
      pullRequestReviewTriggeredForJudgment(
        ctx.reconciliation.trigger,
        prId,
        review,
      )
    ) {
      const reviewDecision = await askAgent(
        ctx,
        pullRequestReviewPrompt({
          ctx,
          pullRequestId: prId,
          specId,
          sourceCommit,
          targetRef,
          review,
        }),
        {
          validateDecision: pullRequestReviewJudgmentProblem,
          continueDomainWorkOnValidation: true,
        },
      );
      reviewJudgmentEvidence = reviewDecision.evidence;
      if (reviewDecision.decision === "needs-owner") {
        return ownerResult(ctx, reviewDecision.summary, [
          ...reviewDecision.evidence,
          `pull-request:${prId}`,
          `pull-request-review-fingerprint:${review.fingerprint}`,
        ]);
      }
      const reviewedCommit = git(workspaceDir, ["rev-parse", "HEAD"]).stdout;
      if (reviewDecision.decision === "committed") {
        if (reviewedCommit === sourceCommit || cleanWorkspace(workspaceDir)) {
          return ownerResult(
            ctx,
            `Review repair for PR ${prId} did not leave one new clean commit.`,
            reviewDecision.evidence,
          );
        }
        const dispatch = await prepareLiveDispatch(
          reviewedCommit,
          `replacement after review feedback on PR ${prId}`,
        );
        if (dispatch.state === "result") return dispatch.result;
        let replacementCommit = dispatch.sourceCommit;
        const publication = await publishTaskBranch(
          replacementCommit,
          `replacement after review feedback on PR ${prId}`,
        );
        if (publication.state === "result") return publication.result;
        replacementCommit = publication.sourceCommit;
        const queued = await queueFreshRun(replacementCommit);
        if (queued.state === "result") return queued.result;
        replacementCommit = queued.sourceCommit;
        const replacement = queued.run;
        saveRunReceipt(contextDir, replacement, replacementCommit);
        const replacementId = nonEmptyString(replacement.id);
        return waitingResult(
          ctx,
          `Applied bounded review feedback for PR ${prId} and queued replacement live run ${replacementId} at ${replacementCommit}.`,
          [
            ...reviewDecision.evidence,
            ...dispatch.evidence,
            ...publication.evidence,
            ...queued.evidence,
            `pull-request:${prId}`,
            `pull-request-review-fingerprint:${review.fingerprint}`,
            `replaces-run:${runId}`,
            `source-commit:${replacementCommit}`,
            `pipeline-run:${replacementId}`,
          ],
          pipelineWaitCondition(replacementId),
        );
      }
      if (reviewedCommit !== sourceCommit || cleanWorkspace(workspaceDir)) {
        return ownerResult(
          ctx,
          `No-change review judgment for PR ${prId} changed the task worktree; the stale wait was refused.`,
          reviewDecision.evidence,
        );
      }
      reviewJudgmentEvidence = [
        ...reviewDecision.evidence,
        `pull-request-review-judged:${review.fingerprint}`,
        "pull-request-review-source-change:not-warranted",
      ];
    }
    return waitingResult(
      ctx,
      waitingForReview
        ? `PR ${prId} is ${prStatus}/${mergeStatus} with ${review.unresolvedCount} unresolved review thread(s); keep the same spec task waiting for review resolution, merge, or a source change.`
        : `PR ${prId} is ${prStatus}/${mergeStatus}; keep the same spec task waiting for merge or a source/review change.`,
      [
        ...proof.evidence,
        ...reviewReadyEvidence,
        `proof:${proofPath(contextDir)}`,
        `pipeline-run:${runId}`,
        `pull-request:${prId}`,
        `source-commit:${sourceCommit}`,
        `pull-request-status:${prStatus}`,
        `merge-status:${mergeStatus}`,
        `pull-request-review-available:${String(review.available)}`,
        `pull-request-unresolved-review-count:${review.unresolvedCount}`,
        ...(review.fingerprint
          ? [`pull-request-review-fingerprint:${review.fingerprint}`]
          : []),
        ...(review.threads.length > 0
          ? [
              `pull-request-review-thread-ids:${review.threads.map((thread) => thread.threadId).join(",")}`,
            ]
          : []),
        ...reviewJudgmentEvidence,
      ],
      pullRequestWaitConditions(prId, sourceCommit, review),
    );
  } catch (error) {
    throw new Error(
      `${name} failed deterministic reconciliation for ${taskId}@${generation} (${specId}) in ${workspaceDir}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function execute(
  ctx: WorkflowContext,
): Promise<SpecLiveWorkflowResult> {
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

function resultEvidenceItems(result: TaskReconcileResult): string[] {
  return Array.isArray(result.evidence)
    ? result.evidence
        .map(nonEmptyString)
        .filter((item): item is string => item.length > 0)
    : [];
}

const verificationProjectDirs = new WeakMap<object, string>();

function verificationProjectDir(context: TaskVerificationContext): string {
  const cached = verificationProjectDirs.get(context);
  if (cached) return cached;
  const common = git(context.workspaceDir, ["rev-parse", "--git-common-dir"]);
  if (common.status !== 0 || !common.stdout) {
    throw new Error(
      common.stderr || "Task Git common directory is unavailable",
    );
  }
  const commonDir = realpathSync(
    common.stdout.startsWith("/")
      ? common.stdout
      : resolve(context.workspaceDir, common.stdout),
  );
  const projectDir = dirname(commonDir);
  verificationProjectDirs.set(context, projectDir);
  return projectDir;
}

function evidenceValue(evidence: readonly string[], prefix: string): string {
  for (let index = evidence.length - 1; index >= 0; index -= 1) {
    const item = evidence[index];
    if (item?.startsWith(prefix)) return item.slice(prefix.length).trim();
  }
  return "";
}

function verifyTerminalDispositionResult(
  context: TaskVerificationContext,
  result: TaskReconcileResult,
  input: ScenarioNormalizationInput | undefined,
  allowTerminalDisposition: boolean,
): TaskVerificationResult | null {
  const evidence = resultEvidenceItems(result);
  if (!evidence.includes("terminal-disposition:no-new-ado-pass-claimed")) {
    return null;
  }

  if (!allowTerminalDisposition) {
    return {
      accepted: false,
      summary:
        "Terminal spec disposition cannot satisfy a task that requires exact passing live proof.",
      evidence: ["verification-finding:terminal-disposition-forbidden"],
    };
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

  git(
    verificationProjectDir(context),
    ["fetch", "origin", defaultTargetBranch],
    true,
  );
  const sourceCommit = evidenceValue(evidence, "source-commit:");
  if (
    !sourceCommit ||
    git(
      verificationProjectDir(context),
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
      verificationProjectDir(context),
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

export async function verifySpecLiveResult(
  context: TaskVerificationContext,
  result: TaskReconcileResult,
  targetBranch = defaultTargetBranch,
): Promise<TaskVerificationResult> {
  const { targetRef } = resolveIntegrationTarget(targetBranch);
  if (result.state !== "converged") {
    return {
      accepted: false,
      summary:
        "Spec live reconciliation may converge only from a converged handler result.",
      evidence: [`handler-state:${result.state}`],
    };
  }

  const input = context.intent.input as ScenarioNormalizationInput | undefined;
  const allowTerminalDisposition =
    jsonRecord(context.intent.input).allowTerminalDisposition !== false;
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
    allowTerminalDisposition,
  );
  if (terminalDispositionVerification) {
    return terminalDispositionVerification;
  }

  try {
    verificationProjectDir(context);
  } catch (error) {
    return {
      accepted: false,
      summary:
        "Spec live verification cannot resolve the canonical project checkout.",
      evidence: [
        `verification-finding:${error instanceof Error ? error.message : String(error)}`,
      ],
    };
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
    verificationProjectDir(context),
    context.taskId,
    context.generation,
  );
  const proof = readProof(contextDir);
  let run: PipelineRun | null = null;
  if (proof?.runId) {
    try {
      run = await getPipelineRun(verificationProjectDir(context), proof.runId);
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
  git(verificationProjectDir(context), ["fetch", "origin", targetBranch], true);
  const sourceAncestryReachable = Boolean(
    proof?.sourceCommit &&
    git(
      verificationProjectDir(context),
      ["merge-base", "--is-ancestor", proof.sourceCommit, targetRef],
      true,
    ).status === 0,
  );
  const proofIntegratedPaths = repoRelativePaths(proof?.integratedPaths);
  const frozenCandidateRule =
    (input as Record<string, unknown> | undefined)?.frozenCandidateRule ===
    true;
  const scenarioBoundedReplay =
    input?.loopId === "scenario-normalization" &&
    proof?.integrationMode === "bounded-content-equivalent";
  const expectedBoundedPaths = frozenCandidateRule
    ? repoRelativePaths(
        (input as Record<string, unknown> | undefined)?.boundedSourceFiles,
      )
    : scenarioBoundedReplay
      ? proofIntegratedPaths
      : [];
  const boundedPaths =
    expectedBoundedPaths.length > 0
      ? expectedBoundedPaths
      : proofIntegratedPaths;
  const boundedContentEquivalent = Boolean(
    proof?.integrationMode === "bounded-content-equivalent" &&
    boundedPaths.length > 0 &&
    (!(frozenCandidateRule || scenarioBoundedReplay) ||
      JSON.stringify(proofIntegratedPaths) ===
        JSON.stringify(expectedBoundedPaths)) &&
    frozenCandidateContentEquivalent({
      repoDir: verificationProjectDir(context),
      sourceCommit: proof.sourceCommit,
      targetCommit: targetRef,
      boundedSourceFiles: boundedPaths,
    }).equivalent,
  );
  const sourceReachable = sourceAncestryReachable || boundedContentEquivalent;
  const integratedCommitReachable = Boolean(
    proof?.mergedCommit &&
    git(
      verificationProjectDir(context),
      ["merge-base", "--is-ancestor", proof.mergedCommit, targetRef],
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
        invariant &&
        !invariant.stillListed &&
        scenarioQualityInvariant(context.workspaceDir, input).accepted,
      );
    } catch {
      normalizationInvariantSatisfied = false;
    }
  }
  const authoritativeReference = authoritativeRunReference(input);

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
      verificationProjectDir(context),
      proof?.sourceCommit || "",
      specIds,
    ),
    sourceReachable,
    integratedCommitReachable,
    normalizationInvariantSatisfied,
    integrationTargetRef: targetRef,
    providerTaskIds: authoritativeReference?.taskId
      ? [authoritativeReference.taskId]
      : [],
    ...(input?.expectedVitestTestCount !== undefined
      ? {
          expectedVitestTestCount: Number(input.expectedVitestTestCount),
        }
      : {}),
  });
  if (!verification.accepted || !proof) return verification;
  const resultEvidence = resultEvidenceItems(result);
  const mainPublicationProblem = mainPublicationAcceptanceProblem({
    canonicalProofMetadataValid: verification.accepted,
    publicationRequired:
      integrationMode(targetBranch) === "pull-request" &&
      Boolean(proof.pullRequestId),
    pullRequestId: nonEmptyString(proof.pullRequestId),
    evidence: resultEvidence,
  });
  if (mainPublicationProblem) {
    return {
      accepted: false,
      summary: `Exact live behavior passed, but main-publication acceptance is incomplete: ${mainPublicationProblem}.`,
      evidence: [
        `pipeline-run:${proof.runId}`,
        `source-commit:${proof.sourceCommit}`,
        ...(proof.pullRequestId ? [`pull-request:${proof.pullRequestId}`] : []),
        "verification-finding:incomplete-main-publication-acceptance",
      ],
    };
  }
  return {
    ...verification,
    evidence: [
      `proof:${proofPath(contextDir)}`,
      `pipeline-run:${proof.runId}`,
      `source-commit:${proof.sourceCommit}`,
      `integrated-commit:${proof.mergedCommit}`,
      ...(boundedContentEquivalent
        ? [
            "integration-mode:bounded-content-equivalent",
            ...proofIntegratedPaths.map((path) => `integrated-path:${path}`),
          ]
        : []),
      ...verification.evidence.filter(
        (item) =>
          !item.startsWith("proof:") && !item.startsWith("source-commit:"),
      ),
    ],
  };
}

export async function verify(
  context: TaskVerificationContext,
  result: TaskReconcileResult,
): Promise<TaskVerificationResult> {
  return verifySpecLiveResult(context, result);
}

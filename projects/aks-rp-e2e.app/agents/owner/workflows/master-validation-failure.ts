import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  Type,
  type ProjectAppConditionSpec,
  type ProjectAppTaskAction,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  isNonFastForwardPushFailure,
  priorIntegratedProof,
  reconcileRemoteTaskBranchHistory,
  reconcileSpecLive,
  sourceChangeMayAffectSpec,
  type SpecLiveReconciliationOptions,
} from "./spec-live-reconciliation.js";

export const name = "master-validation-failure";
export const description =
  "Investigate one progressively observed master-validation failure; keep it open until a test fix or product fix is verified by a passing staging proof.";
export const workspace = { kind: "task", baseBranch: "main" } as const;

const organization = "https://dev.azure.com/msazure";
const adoProject = "CloudNativeCompute";
const repository = "aks-e2e-spec-runner";
const targetBranch = "main";
const targetRef = "origin/main";
const azCli =
  process.env.AZURE_CLI_PATH ||
  (existsSync("/app/.state/.local/bin/az")
    ? "/app/.state/.local/bin/az"
    : "az");

export type CampaignRepairContext = {
  conflictingPaths: string[];
  campaignCompositionCommits: string[];
  reason: string;
  sourceEquivalentCommits: string[];
  campaignSourceCommit: string;
  currentMainCommit: string;
  pullRequestId: string;
  expectedRemoteCommit: string;
};

export type FailureInput = {
  taskId: string;
  generation: number;
  specId: string;
  pipelineRunId: string;
  failureFingerprint: string;
  artifactPath: string;
  sourceBranch: string;
  sourceCommit: string;
  reason: string;
  category: string;
  status: string;
  progressiveObservation: boolean;
  carrierCommit: string;
  standaloneBuildId: string;
  priorStandalonePipelineRunId: string;
  priorStandaloneSourceCommit: string;
  campaignRepairReplay: CampaignRepairContext | null;
};

export type PullRequest = {
  pullRequestId?: unknown;
  status?: unknown;
  mergeStatus?: unknown;
  description?: unknown;
  sourceRefName?: unknown;
  lastMergeSourceCommit?: { commitId?: unknown };
  lastMergeCommit?: { commitId?: unknown };
  url?: unknown;
};

type LiveChild = {
  taskId: string;
  generation: number;
  phase: string;
};

type StandaloneVerification = {
  taskId: string;
  pipelineRunId: string;
  sourceCommit: string;
  standaloneBuildId: string;
  evidence: string[];
};

type Decision = {
  classification: "test_issue" | "prod_issue" | "inconclusive";
  summary: string;
  evidence: string[];
  changedFiles: string[];
};

type InvestigationOutcome =
  | {
      kind: "decision";
      decision: Decision;
      nextCommit: string;
    }
  | {
      kind: "blocked";
      result: WorkflowResult;
    };

const decisionSchema = Type.Object({
  classification: Type.Union([
    Type.Literal("test_issue"),
    Type.Literal("prod_issue"),
    Type.Literal("inconclusive"),
  ]),
  summary: Type.String({ minLength: 1 }),
  evidence: Type.Array(Type.String({ minLength: 1 })),
  changedFiles: Type.Array(Type.String({ minLength: 1 })),
});

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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function parseCampaignRepairReplay(
  value: unknown,
): CampaignRepairContext | null {
  const replay = record(value);
  const parsed: CampaignRepairContext = {
    conflictingPaths: stringArray(replay.conflictingPaths),
    campaignCompositionCommits: stringArray(replay.campaignCompositionCommits),
    reason: text(replay.reason),
    sourceEquivalentCommits: stringArray(replay.sourceEquivalentCommits),
    campaignSourceCommit: text(replay.campaignSourceCommit),
    currentMainCommit: text(replay.currentMainCommit),
    pullRequestId: text(replay.pullRequestId),
    expectedRemoteCommit: text(replay.expectedRemoteCommit),
  };
  return parsed.reason ||
    parsed.conflictingPaths.length ||
    parsed.campaignCompositionCommits.length ||
    parsed.sourceEquivalentCommits.length ||
    parsed.campaignSourceCommit ||
    parsed.pullRequestId ||
    parsed.expectedRemoteCommit
    ? parsed
    : null;
}

export function nestedWorkflowOutput(value: unknown): Record<string, unknown> {
  return record(record(value).output);
}

function matchingJsonObject(raw: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return raw.slice(start, index + 1);
  }
  return null;
}

export function parseFailureInput(raw: string): FailureInput | null {
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const start = scoped.indexOf("{");
  const object = start >= 0 ? matchingJsonObject(scoped, start) : null;
  if (!object) return null;
  try {
    const payload = record(JSON.parse(object));
    const input = record(payload.input);
    const parsed: FailureInput = {
      taskId: text(payload.taskId),
      generation: Math.max(1, Number(payload.generation ?? 1) || 1),
      specId: text(input.specId),
      pipelineRunId: text(input.pipelineRunId),
      failureFingerprint: text(input.failureFingerprint),
      artifactPath: text(input.artifactPath),
      sourceBranch: text(input.sourceBranch),
      sourceCommit: text(input.sourceCommit),
      reason: text(input.reason),
      category: text(input.category),
      status: text(input.status),
      progressiveObservation: input.progressiveObservation === true,
      carrierCommit: text(input.carrierCommit),
      standaloneBuildId: text(input.standaloneBuildId),
      priorStandalonePipelineRunId: text(
        record(input.historicalDirectPass).pipelineRunId,
      ),
      priorStandaloneSourceCommit: text(
        record(input.historicalDirectPass).sourceCommit,
      ),
      campaignRepairReplay: parseCampaignRepairReplay(
        input.campaignRepairReplay,
      ),
    };
    return parsed.taskId && parsed.specId && parsed.failureFingerprint
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function command(
  executable: string,
  args: string[],
  cwd: string,
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
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
  if (!allowFailure && output.status !== 0) {
    throw new Error(output.stderr || output.stdout || `${executable} failed`);
  }
  return output;
}

function git(cwd: string, args: string[], allowFailure = false) {
  return command("git", args, cwd, allowFailure);
}

function azJson(
  cwd: string,
  args: string[],
  options: { includeProject?: boolean } = {},
): unknown {
  const includeProject = options.includeProject !== false;
  const result = command(
    azCli,
    [
      ...args,
      "--organization",
      organization,
      ...(includeProject ? ["--project", adoProject] : []),
      "-o",
      "json",
    ],
    cwd,
  );
  return JSON.parse(result.stdout || "null");
}

function pullRequests(repoDir: string, sourceBranch: string): PullRequest[] {
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
  return Array.isArray(value) ? (value as PullRequest[]) : [];
}

export function campaignRepairPullRequestDescription(input: {
  taskId: string;
  specId: string;
  failureRunId: string;
  sourceCommit: string;
  campaignBaseCommit: string;
}): string {
  return [
    `Task: ${input.taskId}`,
    "",
    "Master-Validation-Candidate: include",
    "",
    `Spec: ${input.specId}`,
    `Failed campaign run: ${input.failureRunId}`,
    `Frozen campaign base: ${input.campaignBaseCommit}`,
    `Focused fix commit: ${input.sourceCommit}`,
    "",
    "This focused repair targets main, but the frozen campaign is its immediate integration proof. Do not merge the campaign branch itself.",
  ].join("\n");
}

function createCampaignRepairPullRequest(
  repoDir: string,
  input: {
    taskId: string;
    specId: string;
    failureRunId: string;
    sourceBranch: string;
    sourceCommit: string;
    campaignBaseCommit: string;
  },
): PullRequest {
  return record(
    azJson(repoDir, [
      "repos",
      "pr",
      "create",
      "--repository",
      repository,
      "--source-branch",
      input.sourceBranch,
      "--target-branch",
      targetBranch,
      "--title",
      `Fix ${input.specId} master-validation campaign failure`,
      "--description",
      campaignRepairPullRequestDescription(input),
      "--draft",
      "true",
    ]),
  ) as PullRequest;
}

function activeTaskPullRequests(
  repoDir: string,
  taskId: string,
): PullRequest[] {
  const value = azJson(repoDir, [
    "repos",
    "pr",
    "list",
    "--repository",
    repository,
    "--target-branch",
    targetBranch,
    "--status",
    "active",
    "--top",
    "100",
  ]);
  if (!Array.isArray(value)) return [];
  const marker = `Task: ${taskId}`;
  return (value as PullRequest[]).filter((pullRequest) =>
    text(pullRequest.description).split(/\r?\n/).includes(marker),
  );
}

function pullRequestNumber(value: PullRequest): number {
  const parsed = Number(text(value.pullRequestId));
  return Number.isFinite(parsed) ? parsed : -1;
}

export function canonicalTaskPullRequest(
  pullRequests: PullRequest[],
  options: {
    preferredPullRequestId?: string;
    preferredSourceBranch?: string;
  } = {},
): PullRequest | null {
  const preferredPullRequestId = text(options.preferredPullRequestId);
  const preferredSourceBranch = text(options.preferredSourceBranch).replace(
    /^refs\/heads\//,
    "",
  );
  const candidates = pullRequests
    .filter((pullRequest) => text(pullRequest.status) === "active")
    .sort((left, right) => pullRequestNumber(right) - pullRequestNumber(left));
  return (
    candidates.find(
      (pullRequest) =>
        preferredPullRequestId &&
        text(pullRequest.pullRequestId) === preferredPullRequestId,
    ) ??
    candidates.find(
      (pullRequest) =>
        preferredSourceBranch &&
        text(pullRequest.sourceRefName).replace(/^refs\/heads\//, "") ===
          preferredSourceBranch,
    ) ??
    candidates[0] ??
    null
  );
}

function abandonPullRequest(repoDir: string, pullRequestId: string): boolean {
  const result = command(
    azCli,
    [
      "repos",
      "pr",
      "update",
      "--id",
      pullRequestId,
      "--status",
      "abandoned",
      "--organization",
      organization,
      "-o",
      "json",
    ],
    repoDir,
    true,
  );
  return result.status === 0;
}

function abandonSupersededTaskPullRequests(
  repoDir: string,
  taskId: string,
  retainedPullRequestId = "",
): string[] {
  return activeTaskPullRequests(repoDir, taskId)
    .filter(
      (pullRequest) =>
        text(pullRequest.pullRequestId) !== text(retainedPullRequestId),
    )
    .map((pullRequest) => {
      const pullRequestId = text(pullRequest.pullRequestId);
      return pullRequestId && abandonPullRequest(repoDir, pullRequestId)
        ? `superseded-pull-request-abandoned:${pullRequestId}`
        : `superseded-pull-request-abandon-failed:${pullRequestId || "unknown"}`;
    });
}

function refreshCampaignRepairPullRequest(
  repoDir: string,
  pullRequestId: string,
  input: {
    taskId: string;
    specId: string;
    failureRunId: string;
    sourceCommit: string;
    campaignBaseCommit: string;
  },
): PullRequest {
  return record(
    azJson(
      repoDir,
      [
        "repos",
        "pr",
        "update",
        "--id",
        pullRequestId,
        "--description",
        campaignRepairPullRequestDescription(input),
        "--draft",
        "true",
      ],
      { includeProject: false },
    ),
  ) as PullRequest;
}

export function masterValidationFocusedFixWake(
  pullRequestId: string,
  sourceCommit: string,
): Record<string, unknown> {
  return {
    target: {
      project: "aks-rp-e2e",
      taskId: "master-validation-staging-cycle",
    },
    project: "aks-rp-e2e",
    taskId: "master-validation-staging-cycle",
    task_id: "master-validation-staging-cycle",
    action: "master-validation-cycle",
    reason: "master-validation-focused-fix-published",
    pullRequestId,
    sourceCommit,
    overrideWait: true,
  };
}

export function productRecoveryWaitRequiresCurrentMain(
  input: Pick<FailureInput, "category">,
): boolean {
  return ["product_failure", "prod_issue"].includes(input.category);
}

export function productRecoveryCondition(
  input: FailureInput,
  afterRunId = input.pipelineRunId,
  options: { requireCurrentMain?: boolean } = {},
): ProjectAppConditionSpec {
  return {
    // Include the blocking observation in the identity. Reusing the same
    // Condition across separate failure episodes can retain an earlier true
    // pass and immediately wake a newly observed failure.
    id: `master-validation-product-recovery-${input.failureFingerprint}-after-${afterRunId || "unknown"}`,
    type: "pipeline.spec.observed",
    subject: "project:aks-rp-e2e",
    expected: {
      specId: input.specId,
      status: "pass",
      ...(!options.requireCurrentMain && input.sourceCommit
        ? { sourceCommit: input.sourceCommit }
        : { sourceBranch: "refs/heads/main" }),
      pipelineRunId: { gt: afterRunId },
    },
  };
}

export function progressiveArtifactObservationCondition(
  input: FailureInput,
): ProjectAppConditionSpec {
  return {
    id: `master-validation-progressive-artifact-${input.failureFingerprint}-run-${input.pipelineRunId || "unknown"}`,
    type: "pipeline.failure.observed",
    subject: "project:aks-rp-e2e",
    expected: {
      specId: input.specId,
      pipelineRunId: input.pipelineRunId,
      failureFingerprint: input.failureFingerprint,
    },
    reviewAfterMs: 900000,
  };
}

export function currentRecoveryBaselineRunId(
  ctx: Pick<WorkflowContext, "appDir">,
  input: FailureInput,
): string {
  if (!ctx.appDir) return input.pipelineRunId;
  let currentRunId = "";
  try {
    const cycle = record(
      JSON.parse(
        readFileSync(
          join(ctx.appDir, ".state", "master-validation-cycle.json"),
          "utf8",
        ),
      ),
    );
    currentRunId = text(cycle.runId);
  } catch {
    // The blocking run remains the baseline before the standing cycle exists.
  }
  return laterRun(currentRunId, input.pipelineRunId)
    ? currentRunId
    : input.pipelineRunId;
}

export function requiresStandaloneVerification(input: FailureInput): boolean {
  return (
    /^\d+$/.test(input.standaloneBuildId) ||
    admissionReportRequiresStandaloneVerification(input) ||
    (input.category === "environment_blocker" &&
      /standalone(?:\s+rp[- ]ingress)?\s+target\s+required/i.test(input.reason))
  );
}

export function admissionReportRequiresStandaloneVerification(
  input: FailureInput,
): boolean {
  if (
    input.category !== "admission_exclusion" ||
    input.status !== "excluded" ||
    !input.artifactPath
  ) {
    return false;
  }
  try {
    const report = record(JSON.parse(readFileSync(input.artifactPath, "utf8")));
    const excluded = Array.isArray(report.excluded)
      ? report.excluded.map(record)
      : [];
    const row = excluded.find(
      (candidate) => text(candidate.specId) === input.specId,
    );
    if (text(row?.bucket) !== "missing-required-target-env") return false;
    const signals = stringArray(row?.signals);
    return signals.includes(
      "missing-target-env=AKS_RP_E2E_STANDALONE_BUILD_VERSION",
    );
  } catch {
    return false;
  }
}

export function requestedStandaloneVerification(
  input: FailureInput,
): StandaloneVerification | null {
  if (!/^\d+$/.test(input.standaloneBuildId)) return null;
  return {
    taskId: input.taskId,
    pipelineRunId: input.priorStandalonePipelineRunId,
    sourceCommit: input.priorStandaloneSourceCommit,
    standaloneBuildId: input.standaloneBuildId,
    evidence: [
      `standalone-build-id:${input.standaloneBuildId}`,
      ...(input.priorStandalonePipelineRunId
        ? [
            `prior-standalone-pipeline-run:${input.priorStandalonePipelineRunId}`,
          ]
        : []),
      ...(input.priorStandaloneSourceCommit
        ? [
            `prior-standalone-source-commit:${input.priorStandaloneSourceCommit}`,
          ]
        : []),
    ],
  };
}

function evidenceValue(evidence: string[], prefix: string): string {
  return (
    evidence
      .find((entry) => entry.startsWith(prefix))
      ?.slice(prefix.length)
      .trim() ?? ""
  );
}

export function priorStandaloneVerification(
  appDir: string,
  specId: string,
): StandaloneVerification | null {
  try {
    const state = record(
      JSON.parse(
        readFileSync(join(appDir, ".state", "tasks", "state.json"), "utf8"),
      ),
    );
    return (
      Object.entries(record(state.receipts))
        .map(([taskId, value]) => {
          const receipt = record(value);
          const evidence = Array.isArray(receipt.evidence)
            ? receipt.evidence.map(text).filter(Boolean)
            : [];
          const corpus = [
            text(receipt.outcome),
            text(receipt.summary),
            ...evidence,
          ].join("\n");
          const standaloneBuildId = evidenceValue(
            evidence,
            "standalone-build-id:",
          );
          const pipelineRunId = evidenceValue(evidence, "pipeline-run:");
          const sourceCommit = evidenceValue(evidence, "source-commit:");
          return {
            taskId,
            pipelineRunId,
            sourceCommit,
            standaloneBuildId,
            evidence,
            completedAt: text(receipt.completedAt),
            matches:
              corpus.includes(specId) &&
              /\bpass(?:ed)?\b/i.test(corpus) &&
              /^\d+$/.test(standaloneBuildId) &&
              Boolean(pipelineRunId && sourceCommit),
          };
        })
        .filter((candidate) => candidate.matches)
        .sort((left, right) =>
          right.completedAt.localeCompare(left.completedAt),
        )
        .map(
          ({ completedAt: _completedAt, matches: _matches, ...candidate }) =>
            candidate,
        )[0] ?? null
    );
  } catch {
    return null;
  }
}

function standaloneRecoveryChildId(
  input: FailureInput,
  currentMainCommit: string,
  standaloneBuildId: string,
): string {
  const revision = createHash("sha256")
    .update(`${input.specId}:${currentMainCommit}:${standaloneBuildId}`)
    .digest("hex")
    .slice(0, 12);
  return `domain/master-validation-route-verification/${input.specId}/${revision}`;
}

export function standaloneRecoveryChildAction(input: {
  failure: FailureInput;
  currentMainCommit: string;
  prior: StandaloneVerification;
}): ProjectAppTaskAction {
  const childId = standaloneRecoveryChildId(
    input.failure,
    input.currentMainCommit,
    input.prior.standaloneBuildId,
  );
  return {
    kind: "create-task",
    id: childId,
    parentId: input.failure.taskId,
    outcome: `Verify ${input.failure.specId} from current main on its required standalone RP-ingress target, then integrate any required repair into main.`,
    mode: "achieve",
    owner: "aks-explorer",
    workflow: "master-validation-route-verification",
    priority: "P0",
    category: "domain_leaf",
    input: {
      specId: input.failure.specId,
      target: "staging",
      standaloneBuildId: input.prior.standaloneBuildId,
      recoveryOf: input.failure.taskId,
      blockingPipelineRunId: input.failure.pipelineRunId,
      priorStandalonePipelineRunId: input.prior.pipelineRunId,
      currentMainCommit: input.currentMainCommit,
    },
    acceptance: [
      `Run ${input.failure.specId} against standalone_build_id=${input.prior.standaloneBuildId}; generic staging is not the claim-bearing target.`,
      "A real same-spec standalone pass is required; local checks or aggregate exclusion are not pass proof.",
      "If source changes, publish a focused non-draft PR and keep the task open until the tested repair is present in current main.",
    ],
  };
}

function childRecords(
  raw: string,
  kind: "live" | "completed",
): Record<string, unknown>[] {
  const children = record(reconciliationPayload(raw)?.children)[kind];
  return Array.isArray(children) ? children.map(record) : [];
}

export function standaloneRecoveryChild(
  raw: string,
  input: FailureInput,
  currentMainCommit: string,
  standaloneBuildId: string,
  kind: "live" | "completed",
): Record<string, unknown> | null {
  const expectedId = standaloneRecoveryChildId(
    input,
    currentMainCommit,
    standaloneBuildId,
  );
  return (
    childRecords(raw, kind).find(
      (child) => text(child.taskId ?? child.id) === expectedId,
    ) ?? null
  );
}

export function standaloneRecoveryCompletionProblem(
  child: Record<string, unknown>,
  currentMainCommit = "",
): string | null {
  const evidence = Array.isArray(child.evidence)
    ? child.evidence.map(text).filter(Boolean)
    : [];
  const corpus = [text(child.summary), ...evidence].join("\n");
  const exactMainRun =
    Boolean(currentMainCommit) &&
    corpus.includes("sourceBranch=refs/heads/main") &&
    corpus.includes(`sourceVersion=${currentMainCommit}`);
  return evidence.includes("target-ref:origin/main") || exactMainRun
    ? null
    : "standalone recovery child lacks exact target-ref:origin/main integration proof";
}

function pipelineMainRecoveryCondition(
  input: FailureInput,
  baselineRunId: string,
): ProjectAppConditionSpec {
  return {
    id: `master-validation-pipeline-recovery-${input.failureFingerprint}-campaign-${baselineRunId}`,
    type: "project.task.tick",
    subject: `task:${input.taskId}`,
    expected: {
      reason: "master-validation-main-passed",
      campaignBaselineRunId: baselineRunId,
    },
  };
}

function progressedCampaign(
  input: FailureInput,
  appDir: string,
): {
  baselineRunId: string;
  branch: string;
  currentCommit: string;
  runId: string;
} | null {
  if (input.specId !== "pipeline.master-validation.bootstrap") return null;
  try {
    const campaign = record(
      JSON.parse(
        readFileSync(
          join(appDir, ".state", "master-validation-campaign.json"),
          "utf8",
        ),
      ),
    );
    const cycle = record(
      JSON.parse(
        readFileSync(
          join(appDir, ".state", "master-validation-cycle.json"),
          "utf8",
        ),
      ),
    );
    const currentCommit = text(campaign.currentCommit);
    const runId = text(cycle.runId);
    if (
      text(cycle.purpose) !== "master-validation-campaign" ||
      !text(campaign.baselineRunId) ||
      !text(campaign.branch) ||
      !currentCommit ||
      !runId ||
      currentCommit === input.sourceCommit
    ) {
      return null;
    }
    return {
      baselineRunId: text(campaign.baselineRunId),
      branch: text(campaign.branch),
      currentCommit,
      runId,
    };
  } catch {
    return null;
  }
}

export function frozenCampaignBaseForFailure(
  input: FailureInput,
  appDir: string,
): string {
  if (
    input.specId === "pipeline.master-validation.bootstrap" &&
    input.sourceBranch.replace(/^refs\/heads\//, "") === "main" &&
    input.sourceCommit
  ) {
    // The failed exact-main run is the authority for a new bootstrap repair
    // campaign. Do not route this synthetic aggregate failure through the
    // catalog-spec live verifier merely because an older campaign receipt has
    // not yet been replaced by the standing cycle.
    return input.sourceCommit;
  }
  try {
    const campaign = record(
      JSON.parse(
        readFileSync(
          join(appDir, ".state", "master-validation-campaign.json"),
          "utf8",
        ),
      ),
    );
    const campaignBranch = text(campaign.branch);
    const observedBranch = input.sourceBranch.replace(/^refs\/heads\//, "");
    const baseCommit = text(campaign.baseCommit);
    return campaignBranch && observedBranch === campaignBranch
      ? baseCommit
      : "";
  } catch {
    return "";
  }
}

export function alignCleanRepairWorkspace(input: {
  workspaceDir: string;
  targetRef: string;
  repairBaseCommit: string;
}): string {
  const current = git(input.workspaceDir, ["rev-parse", "HEAD"]).stdout;
  if (!input.repairBaseCommit || current === input.repairBaseCommit) {
    return current;
  }
  if (git(input.workspaceDir, ["status", "--porcelain=v1"]).stdout) {
    return current;
  }
  const currentBelongsToMain =
    git(
      input.workspaceDir,
      ["merge-base", "--is-ancestor", current, input.targetRef],
      true,
    ).status === 0;
  const repairBaseBelongsToMain =
    git(
      input.workspaceDir,
      ["merge-base", "--is-ancestor", input.repairBaseCommit, input.targetRef],
      true,
    ).status === 0;
  if (!currentBelongsToMain || !repairBaseBelongsToMain) return current;

  // The workspace is clean and contains no task-only commit: move the task
  // branch to the campaign snapshot before the agent authors the next fix.
  // This deliberately drops only newer main history from this isolated task
  // branch; it never rewrites a branch containing unmerged task work.
  git(input.workspaceDir, ["reset", "--hard", input.repairBaseCommit]);
  return git(input.workspaceDir, ["rev-parse", "HEAD"]).stdout;
}

export function campaignRepairReady(input: {
  headCommit: string;
  repairBaseCommit: string;
}): boolean {
  const baseCommit = text(input.repairBaseCommit);
  return Boolean(
    baseCommit && input.headCommit && input.headCommit !== baseCommit,
  );
}

export function campaignRepairPublicationRetryReady(input: {
  headCommit: string;
  repairBaseCommit: string;
  expectedRemoteCommit: string;
  workspaceClean: boolean;
}): boolean {
  return Boolean(
    input.workspaceClean &&
    input.expectedRemoteCommit &&
    input.headCommit !== input.expectedRemoteCommit &&
    campaignRepairReady(input),
  );
}

function triggerEvent(raw: string): Record<string, unknown> | null {
  for (const marker of ["## Trigger Observation", "## Trigger Event"]) {
    const startMarker = raw.indexOf(marker);
    if (startMarker < 0) continue;
    const scoped = raw.slice(startMarker);
    const start = scoped.indexOf("{");
    const object = start >= 0 ? matchingJsonObject(scoped, start) : null;
    if (!object) continue;
    try {
      return record(JSON.parse(object));
    } catch {
      // Try the next supported marker.
    }
  }
  return null;
}

function laterRun(candidate: string, baseline: string): boolean {
  const candidateNumber = Number(candidate);
  const baselineNumber = Number(baseline);
  if (Number.isFinite(candidateNumber) && Number.isFinite(baselineNumber)) {
    return candidateNumber > baselineNumber;
  }
  return Boolean(candidate && baseline && candidate !== baseline);
}

export function passingRecoveryObservation(
  raw: string,
  input: FailureInput,
  options: { requireCurrentMain?: boolean } = {},
): Record<string, unknown> | null {
  const trigger = triggerEvent(raw);
  return trigger
    ? matchingPassingRecoveryObservation(trigger, input, options)
    : null;
}

function eventData(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return record(value);
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

export function pullRequestReviewTrigger(
  raw: string,
  expectedPullRequestId = "",
): {
  pullRequestId: string;
  unresolvedReviewCount: number;
  reviewFingerprint: string;
} | null {
  const trigger = triggerEvent(raw);
  if (!trigger) return null;
  const data = eventData(trigger.data);
  const value = (key: string) => trigger[key] ?? data[key];
  const reason = text(value("reason"));
  const pullRequestId = text(value("pullRequestId"));
  const unresolvedReviewCount =
    Number(value("unresolvedReviewCount") ?? 0) || 0;
  const reviewFingerprint = text(value("reviewFingerprint"));
  if (
    reason !== "pull-request-review-changed" ||
    !pullRequestId ||
    unresolvedReviewCount <= 0 ||
    (expectedPullRequestId && pullRequestId !== expectedPullRequestId)
  ) {
    return null;
  }
  return {
    pullRequestId,
    unresolvedReviewCount,
    reviewFingerprint,
  };
}

export function campaignRepairReplayObservation(
  raw: string,
): CampaignRepairContext | null {
  const trigger = triggerEvent(raw);
  if (!trigger) return null;
  const data = eventData(trigger.data);
  const value = (key: string) => trigger[key] ?? data[key];
  const reason = text(value("reason"));
  if (
    reason !== "repair-focused-patch-after-frozen-campaign-conflict" &&
    !text(value("campaignConflictEventId"))
  ) {
    return null;
  }
  return parseCampaignRepairReplay({
    reason:
      text(value("requiredAction")) ||
      "Repair the existing focused patch after a frozen-campaign replay conflict.",
    conflictingPaths: value("conflictingPaths"),
    campaignCompositionCommits: value("campaignCompositionCommits"),
    sourceEquivalentCommits: value("sourceEquivalentCommits"),
    campaignSourceCommit: value("campaignSourceCommit"),
    currentMainCommit: value("currentMainCommit"),
    pullRequestId: value("pullRequestId"),
    expectedRemoteCommit: value("sourceCommit"),
  });
}

function matchingPassingRecoveryObservation(
  observation: Record<string, unknown>,
  input: FailureInput,
  options: { requireCurrentMain?: boolean } = {},
): Record<string, unknown> | null {
  const data = eventData(observation.data);
  const type = text(observation.type ?? observation.event_type ?? data.type);
  if (type !== "pipeline.spec.observed") return null;
  const value = (key: string) => text(observation[key] ?? data[key]);
  const sourceMatches = options.requireCurrentMain
    ? value("sourceBranch") === "refs/heads/main"
    : input.sourceCommit
      ? value("sourceCommit") === input.sourceCommit ||
        value("sourceBranch") === "refs/heads/main"
      : value("sourceBranch") === "refs/heads/main";
  return value("specId") === input.specId &&
    value("status").toLowerCase() === "pass" &&
    sourceMatches &&
    Boolean(value("sourceCommit")) &&
    laterRun(value("pipelineRunId"), input.pipelineRunId)
    ? { ...observation, ...data, type }
    : null;
}

/**
 * Conditions wake the task when a pass arrives, but they are not the durable
 * source of truth. A replay or unrelated wake can happen after that pass was
 * already consumed. Re-read the event history before opening or refreshing a
 * repair so an older failure cannot manufacture a replacement PR.
 */
export function latestPassingRecoveryObservation(
  ctx: Pick<WorkflowContext, "task" | "query">,
  input: FailureInput,
  options: { requireCurrentMain?: boolean } = {},
): Record<string, unknown> | null {
  const candidates: Record<string, unknown>[] = [];
  const trigger = passingRecoveryObservation(ctx.task, input, options);
  if (trigger) candidates.push(trigger);
  try {
    const rows = ctx.query.events({
      type: "pipeline.spec.observed",
      projectId: "aks-rp-e2e",
      limit: 500,
    }).rows;
    for (const row of rows) {
      const candidate = matchingPassingRecoveryObservation(row, input, options);
      if (candidate) candidates.push(candidate);
    }
  } catch {
    // The trigger remains a valid fast path when durable query infrastructure
    // is temporarily unavailable. A later reconciliation retries the query.
  }
  return (
    candidates.sort((left, right) => {
      const leftRun = Number(text(left.pipelineRunId));
      const rightRun = Number(text(right.pipelineRunId));
      if (Number.isFinite(leftRun) && Number.isFinite(rightRun)) {
        return rightRun - leftRun;
      }
      return text(right.pipelineRunId).localeCompare(text(left.pipelineRunId));
    })[0] ?? null
  );
}

export function shouldReconcileTestFix(input: {
  hasPullRequest: boolean;
  sourceIsInTarget: boolean;
}): boolean {
  return input.hasPullRequest || !input.sourceIsInTarget;
}

export function changedFilesMayAffectSpec(
  specId: string,
  changedFiles: string[],
): boolean {
  return sourceChangeMayAffectSpec(specId, changedFiles);
}

export function observationAppliesToCurrentMain(input: {
  specId: string;
  observationCommit: string;
  currentMainCommit: string;
  observationIsAncestor: boolean;
  changedFiles: string[] | null;
}): boolean {
  if (!input.observationCommit || !input.currentMainCommit) return false;
  if (input.observationCommit === input.currentMainCommit) return true;
  return (
    input.observationIsAncestor &&
    input.changedFiles !== null &&
    !changedFilesMayAffectSpec(input.specId, input.changedFiles)
  );
}

export function boundedChangedFileEvidence(
  changedFiles: string[] | null,
  limit = 20,
): string[] {
  if (changedFiles === null) return ["relevant-main-change:unknown"];
  const bounded = changedFiles
    .slice(0, Math.max(0, limit))
    .map((path) => `relevant-main-change:${path}`);
  return changedFiles.length > bounded.length
    ? [
        ...bounded,
        `relevant-main-change-count:${changedFiles.length}`,
        `relevant-main-change-omitted:${changedFiles.length - bounded.length}`,
      ]
    : bounded;
}

export function boundedEvidence(evidence: string[], limit = 32): string[] {
  const sanitized = evidence.map(text).filter(Boolean);
  if (sanitized.length <= limit) return sanitized;
  const kept = Math.max(0, limit - 2);
  return [
    ...sanitized.slice(0, kept),
    `evidence-entry-count:${sanitized.length}`,
    `evidence-entry-omitted:${sanitized.length - kept}`,
  ];
}

export function hasPreparedRepair(input: FailureInput): boolean {
  return Boolean(input.carrierCommit);
}

function doneWithEvidence(
  ctx: WorkflowContext,
  state: "converged" | "needs-owner",
  summary: string,
  evidence: string[],
  extras: Record<string, unknown> = {},
): WorkflowResult {
  return ctx.done(summary, {
    state,
    summary,
    evidence: boundedEvidence(evidence),
    ...extras,
  });
}

function waiting(
  ctx: WorkflowContext,
  summary: string,
  evidence: string[],
  condition: ProjectAppConditionSpec,
  actions: ProjectAppTaskAction[] = [],
): WorkflowResult {
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: boundedEvidence(evidence),
    actions,
    conditions: [condition],
  });
}

function waitingOnChild(
  ctx: WorkflowContext,
  summary: string,
  evidence: string[],
  actions: ProjectAppTaskAction[] = [],
): WorkflowResult {
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: boundedEvidence(evidence),
    actions,
    conditions: [],
  });
}

function investigationBlocked(
  ctx: WorkflowContext,
  input: FailureInput,
  summary: string,
  evidence: string[],
): WorkflowResult {
  return ctx.blocked(summary, {
    specId: input.specId,
    pipelineRunId: input.pipelineRunId,
    artifactPath: input.artifactPath || "missing",
    evidence: boundedEvidence(evidence),
  });
}

export async function runFailureInvestigation(
  ctx: WorkflowContext,
  input: FailureInput,
  values: {
    workspaceDir: string;
    prompt: string;
    headCommit: string;
  },
): Promise<InvestigationOutcome> {
  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await ctx.runAgent(
      ctx.agent,
      feedback ? `${values.prompt}\n\n${feedback}` : values.prompt,
      { timeoutMs: 1_800_000, schema: decisionSchema },
    );
    if (result.status === "error" || result.status === "interrupted") {
      const summary = `Failure investigation agent session did not complete for ${input.specId}.`;
      return {
        kind: "blocked",
        result: investigationBlocked(ctx, input, summary, [
          `investigation-attempt:${attempt}`,
          `session-status:${result.status}`,
          `workspace:${values.workspaceDir}`,
        ]),
      };
    }

    const decision = result.structuredResult as Decision;
    const nextCommit = git(values.workspaceDir, ["rev-parse", "HEAD"]).stdout;
    const dirty = git(values.workspaceDir, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (dirty) {
      const summary =
        "Failure investigation left uncommitted changes; publication was refused.";
      return {
        kind: "blocked",
        result: investigationBlocked(ctx, input, summary, [
          ...decision.evidence,
          `investigation-attempt:${attempt}`,
          `workspace:${values.workspaceDir}`,
          ...dirty
            .split("\n")
            .filter(Boolean)
            .slice(0, 20)
            .map((entry) => `dirty:${entry}`),
        ]),
      };
    }

    if (
      decision.classification !== "test_issue" ||
      nextCommit !== values.headCommit
    ) {
      return { kind: "decision", decision, nextCommit };
    }

    if (attempt === 1) {
      feedback = [
        "Your classification says this is a test_issue, but the worktree HEAD did not change.",
        "Classification alone does not resolve a test issue.",
        "Re-open the cited failure evidence, implement the smallest root-cause fix, run scoped verification, commit the fix, and leave the worktree clean.",
        "If the evidence does not support a safe source fix, change the classification to inconclusive and explain the exact missing fact instead of claiming the test issue is resolved.",
      ].join(" ");
      continue;
    }

    const summary = `The failure was classified as a test issue twice, but no fix commit was produced for ${input.specId}.`;
    return {
      kind: "blocked",
      result: investigationBlocked(ctx, input, summary, [
        ...decision.evidence,
        "classification:test_issue",
        "investigation-attempts:2",
        `unchanged-head:${values.headCommit}`,
        `workspace:${values.workspaceDir}`,
      ]),
    };
  }

  throw new Error("unreachable failure investigation state");
}

export function inconclusiveWait(
  ctx: WorkflowContext,
  input: FailureInput,
  summary: string,
  evidence: string[],
  actions: ProjectAppTaskAction[] = [],
): WorkflowResult {
  return waiting(
    ctx,
    summary,
    [
      `blocking-pipeline-run:${input.pipelineRunId}`,
      ...(input.sourceCommit ? [`source-commit:${input.sourceCommit}`] : []),
      "classification:inconclusive",
      "verification-required:later-current-main-spec-pass",
      ...evidence,
    ],
    productRecoveryCondition(input, currentRecoveryBaselineRunId(ctx, input)),
    actions,
  );
}

function reconciliationPayload(raw: string): Record<string, unknown> | null {
  const marker = raw.indexOf("## Reconciliation Task");
  if (marker < 0) return null;
  const scoped = raw.slice(marker);
  const start = scoped.indexOf("{");
  const object = start >= 0 ? matchingJsonObject(scoped, start) : null;
  if (!object) return null;
  try {
    return record(JSON.parse(object));
  } catch {
    return null;
  }
}

export function priorProductClassification(raw: string): {
  taskId: string;
  evidence: string[];
} | null {
  const completed = record(reconciliationPayload(raw)?.children).completed;
  if (!Array.isArray(completed)) return null;
  const candidates = completed
    .map((value) => record(value))
    .map((child) => {
      const evidence = Array.isArray(child.evidence)
        ? child.evidence.map(text).filter(Boolean)
        : [];
      const outcome = text(child.outcome);
      const summary = text(child.summary);
      const corpus = [outcome, summary, ...evidence].join("\n");
      return {
        taskId: text(child.taskId),
        outcome,
        summary,
        evidence,
        explicit: /classification\s*[=:]\s*prod_issue/i.test(corpus),
        product: /product[- ]recovery|product issue|prod_issue/i.test(corpus),
      };
    })
    .filter((candidate) => candidate.taskId && candidate.product)
    .sort((left, right) => Number(right.explicit) - Number(left.explicit));
  const selected = candidates[0];
  if (!selected) return null;
  const relevant = selected.evidence.filter((entry) =>
    /classification\s*[=:]\s*prod_issue|product issue|product recovery|same .*timeout|same .*signature|repeated service-side/i.test(
      entry,
    ),
  );
  return {
    taskId: selected.taskId,
    evidence: [
      `prior-product-classification:${selected.taskId}`,
      ...(selected.outcome ? [`prior-outcome:${selected.outcome}`] : []),
      ...(selected.summary ? [`prior-summary:${selected.summary}`] : []),
      ...relevant.slice(0, 6),
    ],
  };
}

export function legacyRecoveryChildren(raw: string): LiveChild[] {
  const payload = reconciliationPayload(raw);
  const live = record(payload?.children).live;
  if (!Array.isArray(live)) return [];
  return live
    .map((value) => record(value))
    .map((value) => ({
      taskId: text(value.taskId),
      generation: Math.max(1, Number(value.generation ?? 1) || 1),
      phase: text(value.phase),
    }))
    .filter(
      (child) =>
        (child.taskId.includes("product-recovery-after-") ||
          child.taskId.includes("publish-current-main-staging-exclusion-")) &&
        !["active", "running"].includes(child.phase),
    );
}

function hasLegacyPublicationChild(raw: string): boolean {
  return legacyRecoveryChildren(raw).some((child) =>
    child.taskId.includes("publish-current-main-staging-exclusion-"),
  );
}

function absorbLegacyRecoveryActions(raw: string): ProjectAppTaskAction[] {
  return legacyRecoveryChildren(raw).map((child) => ({
    kind: "close-task" as const,
    taskId: child.taskId,
    expectedGeneration: child.generation,
    summary:
      "Absorbed this per-run recovery holder into the stable master-validation failure task and its typed recovery Condition.",
  }));
}

function changedFilesBetween(
  repoDir: string,
  fromCommit: string,
  toCommit: string,
): string[] | null {
  if (!fromCommit || !toCommit || fromCommit === toCommit) return [];
  const result = git(
    repoDir,
    ["diff", "--name-only", `${fromCommit}..${toCommit}`, "--"],
    true,
  );
  return result.status === 0
    ? result.stdout
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean)
    : null;
}

function notificationPath(ctx: WorkflowContext, key: string): string {
  return join(
    ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
    ".state",
    "master-validation-notifications",
    `${createHash("sha256").update(key).digest("hex")}.json`,
  );
}

function routeFinding(
  ctx: WorkflowContext,
  input: FailureInput,
  kind: "product" | "test-pr",
  content: string,
  extra: Record<string, unknown> = {},
): boolean {
  const key = `${kind}:${input.specId}:${input.failureFingerprint}`;
  const path = notificationPath(ctx, key);
  if (existsSync(path)) return false;
  if (kind === "product") {
    ctx.dispatchEvent("project.owner.requested", {
      target: { project: "aks-rp-e2e" },
      project: "aks-rp-e2e",
      reason: "master-validation-product-issue",
      params: {
        taskId: input.taskId,
        specId: input.specId,
        pipelineRunId: input.pipelineRunId,
        failureFingerprint: input.failureFingerprint,
        finding: content,
        ...extra,
        instruction:
          "Own this product/provider failure inside the AKS app. Preserve the exact recovery wait, treat frozen-campaign same-spec passes only as supporting evidence, close the stable task only after a later current-main same-spec pass, and escalate to a human only if a real authority decision remains after owner investigation.",
      },
    });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      `${JSON.stringify({ key, routedTo: "project-owner", sentAt: new Date().toISOString(), ...extra }, null, 2)}\n`,
    );
    return true;
  }
  ctx.dispatchEvent("message.created", {
    target: { project: "aks-rp-e2e", human: true },
    from: "aks-explorer",
    to: "human:operator",
    content,
    priority: kind === "product" ? "P1" : "P2",
    intent:
      kind === "product"
        ? "master-validation-product-issue"
        : "master-validation-test-fix-pr",
    project: "aks-rp-e2e",
    taskId: input.taskId,
    specId: input.specId,
    pipelineRunId: input.pipelineRunId,
    failureFingerprint: input.failureFingerprint,
    ...extra,
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify({ key, sentAt: new Date().toISOString(), ...extra }, null, 2)}\n`,
  );
  return true;
}

export function preserveVerificationAfterNestedReconciliation(
  ctx: WorkflowContext,
  input: FailureInput,
  result: WorkflowResult,
): WorkflowResult {
  const resultRecord = record(result);
  const output = nestedWorkflowOutput(result);
  const evidence = Array.isArray(output.evidence)
    ? output.evidence.map(text).filter(Boolean)
    : [];
  const pullRequestId =
    evidence
      .find((entry) => entry.startsWith("pull-request:"))
      ?.slice("pull-request:".length) ?? "";
  const fixCommit =
    evidence
      .find((entry) => entry.startsWith("source-commit:"))
      ?.slice("source-commit:".length) ?? "";
  if (text(output.state) === "existing-recovery") {
    const summary =
      text(output.summary) ||
      `${input.specId} already recovered in a later applicable current-main observation.`;
    return doneWithEvidence(ctx, "converged", summary, evidence, {
      actions: absorbLegacyRecoveryActions(ctx.task),
    });
  }
  if (pullRequestId) {
    routeFinding(
      ctx,
      input,
      "test-pr",
      [
        `AKS master validation found and live-verified a test fix for ${input.specId}.`,
        `Failed aggregate run: ${input.pipelineRunId}`,
        `Pull request: ${pullRequestId}`,
        ...(fixCommit ? [`Exact tested commit: ${fixCommit}`] : []),
        `Status: ${text(output.summary) || text(resultRecord.summary)}`,
      ].join("\n"),
      { pullRequestId, ...(fixCommit ? { fixCommit } : {}) },
    );
  }
  if (text(output.state) === "converged") {
    const summary = `${input.specId} has a live-proven integrated repair, but the master-validation failure remains open until a later current-main observation passes the same spec.`;
    return waiting(
      ctx,
      summary,
      [
        ...evidence,
        `blocking-pipeline-run:${input.pipelineRunId}`,
        "verification-required:later-current-main-spec-pass",
      ],
      productRecoveryCondition(
        input,
        currentRecoveryBaselineRunId(ctx, input),
        { requireCurrentMain: true },
      ),
      absorbLegacyRecoveryActions(ctx.task),
    );
  }
  return result;
}

async function reconcileTestIssue(
  ctx: WorkflowContext,
  input: FailureInput,
): Promise<WorkflowResult> {
  const result = await reconcileSpecLive(
    ctx,
    testIssueReconciliationOptions(input.pipelineRunId),
  );
  return preserveVerificationAfterNestedReconciliation(ctx, input, result);
}

export function testIssueReconciliationOptions(
  pipelineRunId: string,
): SpecLiveReconciliationOptions {
  return {
    targetBranch: targetBranch,
    existingRecoveryAfterRunId: pipelineRunId,
    reusePriorIntegratedProof: true,
    // sourceBranch/sourceCommit on this task describe the failed aggregate
    // observation. They are not an unpublished source prerequisite for the
    // nested live verifier; the dedicated task worktree already preserves any
    // task-owned repair while current-main fixes remain directly testable.
    inputSourceIsObservation: true,
  };
}

export function publishCampaignRepairBranch(
  workspaceDir: string,
  sourceBranch: string,
  runGit: typeof git = git,
  options: { rewriteExpectedRemoteCommit?: string } = {},
):
  | { state: "published"; sourceCommit: string; evidence: string[] }
  | {
      state: "conflicted";
      sourceCommit: string;
      remoteRef: string;
      conflictedPaths: string[];
      evidence: string[];
    }
  | {
      state: "failed";
      sourceCommit: string;
      error: string;
      evidence: string[];
    } {
  let sourceCommit = runGit(workspaceDir, ["rev-parse", "HEAD"]).stdout;
  const evidence: string[] = [];
  const rewriteExpectedRemoteCommit = text(options.rewriteExpectedRemoteCommit);
  if (rewriteExpectedRemoteCommit) {
    const remoteRef = `refs/heads/${sourceBranch}`;
    const push = runGit(
      workspaceDir,
      [
        "push",
        `--force-with-lease=${remoteRef}:${rewriteExpectedRemoteCommit}`,
        "origin",
        `${sourceCommit}:${remoteRef}`,
      ],
      true,
    );
    if (push.status === 0) {
      return {
        state: "published",
        sourceCommit,
        evidence: [
          `task-branch-replay-rewrite:${sourceBranch}:${rewriteExpectedRemoteCommit}->${sourceCommit}`,
        ],
      };
    }
    return {
      state: "failed",
      sourceCommit,
      error:
        push.stderr ||
        push.stdout ||
        `guarded replay rewrite for ${sourceBranch} failed`,
      evidence: [
        `task-branch-replay-rewrite-rejected:${sourceBranch}:${rewriteExpectedRemoteCommit}`,
      ],
    };
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const push = runGit(
      workspaceDir,
      ["push", "origin", `${sourceCommit}:refs/heads/${sourceBranch}`],
      true,
    );
    if (push.status === 0) {
      return { state: "published", sourceCommit, evidence };
    }
    if (!isNonFastForwardPushFailure(push)) {
      return {
        state: "failed",
        sourceCommit,
        error: push.stderr || push.stdout || "campaign repair push failed",
        evidence,
      };
    }

    evidence.push(
      `task-branch-non-fast-forward:${sourceBranch}@${sourceCommit}`,
    );
    const history = reconcileRemoteTaskBranchHistory(
      workspaceDir,
      sourceBranch,
      runGit,
    );
    if (history.state === "failed") {
      return {
        state: "failed",
        sourceCommit,
        error: history.error,
        evidence,
      };
    }
    if (history.state === "conflicted") {
      return {
        state: "conflicted",
        sourceCommit,
        remoteRef: history.remoteRef,
        conflictedPaths: history.conflictedPaths,
        evidence,
      };
    }
    sourceCommit = runGit(workspaceDir, ["rev-parse", "HEAD"]).stdout;
  }

  return {
    state: "failed",
    sourceCommit,
    error: `campaign repair branch ${sourceBranch} still diverged after remote-history reconciliation`,
    evidence,
  };
}

function prepareCampaignRepair(
  ctx: WorkflowContext,
  input: FailureInput,
  values: {
    repoDir: string;
    workspaceDir: string;
    sourceBranch: string;
    sourceCommit: string;
    campaignBaseCommit: string;
    evidence: string[];
  },
): WorkflowResult {
  const existingTaskPullRequests = activeTaskPullRequests(
    values.repoDir,
    input.taskId,
  );
  const canonicalPullRequest = canonicalTaskPullRequest(
    existingTaskPullRequests,
    {
      preferredPullRequestId: input.campaignRepairReplay?.pullRequestId,
      preferredSourceBranch: values.sourceBranch,
    },
  );
  const canonicalPullRequestId = text(canonicalPullRequest?.pullRequestId);
  const canonicalSourceBranch = text(
    canonicalPullRequest?.sourceRefName,
  ).replace(/^refs\/heads\//, "");
  const canonicalSourceCommit = text(
    canonicalPullRequest?.lastMergeSourceCommit?.commitId,
  );
  const workspaceSourceBranch = values.sourceBranch;
  if (canonicalSourceBranch) values.sourceBranch = canonicalSourceBranch;
  const published = publishCampaignRepairBranch(
    values.workspaceDir,
    values.sourceBranch,
    git,
    {
      rewriteExpectedRemoteCommit:
        input.campaignRepairReplay?.expectedRemoteCommit ||
        (canonicalSourceBranch &&
        canonicalSourceBranch !== workspaceSourceBranch
          ? canonicalSourceCommit
          : ""),
    },
  );
  if (published.state === "conflicted") {
    const summary = `Publishing the focused master-validation repair branch for ${input.specId} hit a same-task branch-history conflict that needs bounded owner resolution before retry.`;
    return doneWithEvidence(ctx, "needs-owner", summary, [
      ...values.evidence,
      ...published.evidence,
      `source-branch:${values.sourceBranch}`,
      `source-commit:${published.sourceCommit}`,
      `remote-ref:${published.remoteRef}`,
      ...published.conflictedPaths.map((path) => `conflicted-path:${path}`),
    ]);
  }
  if (published.state === "failed") {
    throw new Error(published.error);
  }

  values.sourceCommit = published.sourceCommit;
  let pullRequest = pullRequests(values.repoDir, values.sourceBranch).find(
    (candidate) => text(candidate.status) === "active",
  );
  if (!pullRequest) {
    pullRequest = createCampaignRepairPullRequest(values.repoDir, {
      taskId: input.taskId,
      specId: input.specId,
      failureRunId: input.pipelineRunId,
      sourceBranch: values.sourceBranch,
      sourceCommit: values.sourceCommit,
      campaignBaseCommit: values.campaignBaseCommit,
    });
  }
  let pullRequestId = text(pullRequest.pullRequestId);
  if (!pullRequestId) {
    throw new Error("Azure DevOps did not return a campaign repair PR id");
  }
  pullRequest = refreshCampaignRepairPullRequest(
    values.repoDir,
    pullRequestId,
    {
      taskId: input.taskId,
      specId: input.specId,
      failureRunId: input.pipelineRunId,
      sourceCommit: values.sourceCommit,
      campaignBaseCommit: values.campaignBaseCommit,
    },
  );
  pullRequestId = text(pullRequest.pullRequestId) || pullRequestId;
  ctx.dispatchEvent(
    "project.task.tick",
    masterValidationFocusedFixWake(pullRequestId, values.sourceCommit),
  );
  const summary = `${canonicalPullRequestId ? "Updated" : "Prepared"} draft focused PR ${pullRequestId} for ${input.specId}; the frozen campaign can integrate it immediately, and the human will be notified only after verification publishes it as non-draft.`;
  return waiting(
    ctx,
    summary,
    [
      ...values.evidence,
      ...published.evidence,
      `blocking-pipeline-run:${input.pipelineRunId}`,
      `campaign-base:${values.campaignBaseCommit}`,
      `source-branch:${values.sourceBranch}`,
      `source-commit:${values.sourceCommit}`,
      `pull-request:${pullRequestId}`,
      ...(canonicalPullRequestId
        ? [`reused-task-pull-request:${canonicalPullRequestId}`]
        : []),
      "verification-required:frozen-campaign-then-current-main",
    ],
    productRecoveryCondition(input, currentRecoveryBaselineRunId(ctx, input)),
    absorbLegacyRecoveryActions(ctx.task),
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const input = parseFailureInput(ctx.task);
  const repoDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const workspaceDir = ctx.workspaceDir ?? repoDir;
  if (!input || workspaceDir === repoDir) {
    const summary = `${name} requires a valid failure observation and a main-based task worktree.`;
    return doneWithEvidence(ctx, "needs-owner", summary, [
      `workspace:${workspaceDir}`,
    ]);
  }
  input.campaignRepairReplay =
    campaignRepairReplayObservation(ctx.task) ?? input.campaignRepairReplay;

  if (input.progressiveObservation && !input.artifactPath) {
    const summary = `Observed an early progressive placeholder for ${input.specId} in aggregate run ${input.pipelineRunId}; wait for the later artifact-backed pipeline.failure.observed event before any classification, source edit, or PR action.`;
    return waiting(
      ctx,
      summary,
      [
        `blocking-pipeline-run:${input.pipelineRunId}`,
        ...(input.sourceCommit ? [`source-commit:${input.sourceCommit}`] : []),
        `progressive-placeholder-fingerprint:${input.failureFingerprint}`,
        `progressive-placeholder-category:${input.category || "unknown"}`,
        "progressive-observation:true",
        "artifact-observation-required:true",
      ],
      progressiveArtifactObservationCondition(input),
      absorbLegacyRecoveryActions(ctx.task),
    );
  }

  try {
    const standaloneRequested = requiresStandaloneVerification(input);
    if (!standaloneRequested) {
      const campaign = progressedCampaign(
        input,
        ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
      );
      if (campaign) {
        const summary = `Pipeline/bootstrap failure ${input.pipelineRunId} has a newer frozen-campaign commit ${campaign.currentCommit} in run ${campaign.runId}. Keep this stable issue open for final current-main proof; do not wait for merge before the campaign continues.`;
        return waiting(
          ctx,
          summary,
          [
            `blocking-pipeline-run:${input.pipelineRunId}`,
            `campaign-run:${campaign.runId}`,
            `campaign-branch:${campaign.branch}`,
            `campaign-commit:${campaign.currentCommit}`,
          ],
          pipelineMainRecoveryCondition(input, campaign.baselineRunId),
          absorbLegacyRecoveryActions(ctx.task),
        );
      }
    }
    git(repoDir, ["fetch", "origin", targetBranch]);
    const baseCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
    const priorStandalone = standaloneRequested
      ? (requestedStandaloneVerification(input) ??
        priorStandaloneVerification(
          ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
          input.specId,
        ))
      : null;
    if (priorStandalone) {
      const completedChild = standaloneRecoveryChild(
        ctx.task,
        input,
        baseCommit,
        priorStandalone.standaloneBuildId,
        "completed",
      );
      if (completedChild) {
        const childEvidence = Array.isArray(completedChild.evidence)
          ? completedChild.evidence.map(text).filter(Boolean)
          : [];
        if (standaloneRecoveryCompletionProblem(completedChild, baseCommit)) {
          const summary = `${input.specId} route verification completed without exact origin/main integration proof; the master-validation failure cannot close.`;
          return doneWithEvidence(ctx, "needs-owner", summary, [
            `blocking-pipeline-run:${input.pipelineRunId}`,
            `verification-child:${text(completedChild.taskId ?? completedChild.id)}`,
            ...childEvidence,
          ]);
        }
        const summary = `${input.specId} recovered on its required standalone RP-ingress route from current main; the earlier aggregate failure was a routing defect, not a reason to wait for an impossible staging verdict.`;
        return doneWithEvidence(
          ctx,
          "converged",
          summary,
          [
            `blocking-pipeline-run:${input.pipelineRunId}`,
            `verification-route:standalone_build_id=${priorStandalone.standaloneBuildId}`,
            `verification-child:${text(completedChild.taskId ?? completedChild.id)}`,
            ...childEvidence,
          ],
          { actions: absorbLegacyRecoveryActions(ctx.task) },
        );
      }
      const liveChild = standaloneRecoveryChild(
        ctx.task,
        input,
        baseCommit,
        priorStandalone.standaloneBuildId,
        "live",
      );
      const action = standaloneRecoveryChildAction({
        failure: input,
        currentMainCommit: baseCommit,
        prior: priorStandalone,
      });
      const childId = text(
        liveChild?.taskId ?? liveChild?.id ?? record(action).id,
      );
      const summary = liveChild
        ? `${input.specId} is being reverified from current main on its required standalone RP-ingress route by ${childId}.`
        : `${input.specId} requires standalone RP-ingress verification, so current-main recovery is delegated to one exact spec-live child instead of waiting for a generic staging pass that cannot exercise the claim.`;
      return waitingOnChild(
        ctx,
        summary,
        [
          `blocking-pipeline-run:${input.pipelineRunId}`,
          `prior-standalone-pipeline-run:${priorStandalone.pipelineRunId}`,
          `prior-standalone-source-commit:${priorStandalone.sourceCommit}`,
          `standalone-build-id:${priorStandalone.standaloneBuildId}`,
          `current-main-commit:${baseCommit}`,
          `verification-child:${childId}`,
        ],
        liveChild ? [] : [action],
      );
    }
    const sourceBranch = git(workspaceDir, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD",
    ]).stdout;
    const frozenBaseCommit = frozenCampaignBaseForFailure(
      input,
      ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
    );
    // The human-facing PR always stays based on current main. The campaign
    // controller replays only its focused patch onto the frozen snapshot.
    const repairBaseCommit = baseCommit;
    const headCommit = alignCleanRepairWorkspace({
      workspaceDir,
      targetRef,
      repairBaseCommit,
    });
    const recovery = latestPassingRecoveryObservation(ctx, input, {
      requireCurrentMain: productRecoveryWaitRequiresCurrentMain(input),
    });
    const recoveryCommit = text(recovery?.sourceCommit);
    const recoveryChangedFiles = recovery
      ? changedFilesBetween(repoDir, recoveryCommit, baseCommit)
      : null;
    const recoveryApplies = recovery
      ? observationAppliesToCurrentMain({
          specId: input.specId,
          observationCommit: recoveryCommit,
          currentMainCommit: baseCommit,
          observationIsAncestor:
            git(
              repoDir,
              ["merge-base", "--is-ancestor", recoveryCommit, targetRef],
              true,
            ).status === 0,
          changedFiles: recoveryChangedFiles,
        })
      : false;
    if (recovery && recoveryApplies) {
      const recoveryRunId = text(recovery.pipelineRunId);
      const summary = `${input.specId} recovered in later current-main master-validation run ${recoveryRunId}.`;
      const supersededPullRequests = abandonSupersededTaskPullRequests(
        repoDir,
        input.taskId,
      );
      return doneWithEvidence(
        ctx,
        "converged",
        summary,
        [
          `blocking-pipeline-run:${input.pipelineRunId}`,
          `recovery-pipeline-run:${recoveryRunId}`,
          `source-commit:${recoveryCommit}`,
          ...(recoveryCommit === baseCommit
            ? []
            : [`current-main-commit:${baseCommit}`]),
          `artifact:${text(recovery.artifactPath)}`,
          ...supersededPullRequests,
        ],
        { actions: absorbLegacyRecoveryActions(ctx.task) },
      );
    }
    const retainedIntegratedProof = priorIntegratedProof({
      repoDir,
      taskId: input.taskId,
      generation: input.generation,
      specId: input.specId,
      target: "staging",
      standaloneBuildId: "",
    });
    if (retainedIntegratedProof) {
      return reconcileTestIssue(ctx, input);
    }
    if (hasPreparedRepair(input)) {
      return reconcileTestIssue(ctx, input);
    }
    if (
      input.campaignRepairReplay &&
      frozenBaseCommit &&
      campaignRepairPublicationRetryReady({
        headCommit,
        repairBaseCommit,
        expectedRemoteCommit: input.campaignRepairReplay.expectedRemoteCommit,
        workspaceClean: !git(workspaceDir, ["status", "--porcelain=v1"]).stdout,
      })
    ) {
      return prepareCampaignRepair(ctx, input, {
        repoDir,
        workspaceDir,
        sourceBranch,
        sourceCommit: headCommit,
        campaignBaseCommit: frozenBaseCommit,
        evidence: [
          "resumed-existing-campaign-repair-after-publication-retry",
          `expected-remote-commit:${input.campaignRepairReplay.expectedRemoteCommit}`,
          `repair-base:${repairBaseCommit}`,
        ],
      });
    }
    // Older owner turns split publication into a child and left the stable
    // failure parent with only fresh watcher input. Resume the finite source
    // lifecycle on the parent before stale-main logic can put both resources
    // back to sleep. The child is absorbed after nested reconciliation has
    // produced integration evidence.
    if (hasLegacyPublicationChild(ctx.task) && !input.campaignRepairReplay) {
      if (
        frozenBaseCommit &&
        campaignRepairReady({
          headCommit,
          repairBaseCommit,
        })
      ) {
        return prepareCampaignRepair(ctx, input, {
          repoDir,
          workspaceDir,
          sourceBranch,
          sourceCommit: headCommit,
          campaignBaseCommit: frozenBaseCommit,
          evidence: [
            "resumed-existing-campaign-repair",
            `repair-base:${repairBaseCommit}`,
          ],
        });
      }
      return reconcileTestIssue(ctx, input);
    }
    const priorProduct = priorProductClassification(ctx.task);
    if (
      priorProduct &&
      ["environment_blocker", "product_failure", "prod_issue"].includes(
        input.category,
      )
    ) {
      routeFinding(
        ctx,
        input,
        "product",
        [
          `AKS master validation again observes the known product/environment issue in ${input.specId}.`,
          `Pipeline run: ${input.pipelineRunId}`,
          `Reason: ${input.reason}`,
        ].join("\n"),
      );
      const summary = `Preserved the durable product classification for repeated fingerprint ${input.failureFingerprint} in ${input.specId}; keep the same stable task waiting for a later current-main pass.`;
      return waiting(
        ctx,
        summary,
        [
          `pipeline-run:${input.pipelineRunId}`,
          `source-commit:${input.sourceCommit}`,
          `artifact:${input.artifactPath}`,
          "classification:prod_issue",
          ...priorProduct.evidence,
        ],
        productRecoveryCondition(
          input,
          currentRecoveryBaselineRunId(ctx, input),
          { requireCurrentMain: true },
        ),
        absorbLegacyRecoveryActions(ctx.task),
      );
    }
    if (["product_failure", "prod_issue"].includes(input.category)) {
      routeFinding(
        ctx,
        input,
        "product",
        [
          `AKS master validation still observes a product issue in ${input.specId}.`,
          `Pipeline run: ${input.pipelineRunId}`,
          `Reason: ${input.reason}`,
        ].join("\n"),
      );
      const summary = `Classified ${input.specId} as a product issue; keep the same stable task waiting for a later current-main pass.`;
      return waiting(
        ctx,
        summary,
        [
          `pipeline-run:${input.pipelineRunId}`,
          `source-commit:${input.sourceCommit}`,
          `artifact:${input.artifactPath}`,
        ],
        productRecoveryCondition(
          input,
          currentRecoveryBaselineRunId(ctx, input),
          { requireCurrentMain: true },
        ),
        absorbLegacyRecoveryActions(ctx.task),
      );
    }
    const existingPr = pullRequests(repoDir, sourceBranch)[0];
    const existingPrId = text(existingPr?.pullRequestId);
    const reviewTrigger = pullRequestReviewTrigger(ctx.task, existingPrId);
    const sourceIsInTarget =
      git(repoDir, ["merge-base", "--is-ancestor", headCommit, targetRef], true)
        .status === 0;
    if (reviewTrigger) {
      return reconcileTestIssue(ctx, input);
    }
    if (
      !input.campaignRepairReplay &&
      shouldReconcileTestFix({
        hasPullRequest: Boolean(existingPr),
        sourceIsInTarget,
      })
    ) {
      if (
        frozenBaseCommit &&
        campaignRepairReady({
          headCommit,
          repairBaseCommit,
        })
      ) {
        return prepareCampaignRepair(ctx, input, {
          repoDir,
          workspaceDir,
          sourceBranch,
          sourceCommit: headCommit,
          campaignBaseCommit: frozenBaseCommit,
          evidence: [
            "resumed-existing-campaign-repair",
            `repair-base:${repairBaseCommit}`,
          ],
        });
      }
      return reconcileTestIssue(ctx, input);
    }

    if (git(workspaceDir, ["status", "--porcelain=v1"]).stdout) {
      const summary =
        "Failure investigation worktree is dirty before deterministic publication.";
      return investigationBlocked(ctx, input, summary, [
        `workspace:${workspaceDir}`,
      ]);
    }

    const prompt = [
      `Investigate the early master-validation failure for ${input.specId}.`,
      `Aggregate pipeline run: ${input.pipelineRunId}`,
      `Failure status/category: ${input.status}/${input.category || "unknown"}`,
      `Failure reason: ${input.reason || "not recorded"}`,
      `Downloaded slice artifact: ${input.artifactPath || "not available"}`,
      `The tested main commit was ${input.sourceCommit || "unknown"}.`,
      input.campaignRepairReplay?.reason || "",
      input.campaignRepairReplay?.conflictingPaths.length
        ? `Previous conflicting paths: ${input.campaignRepairReplay.conflictingPaths.join(", ")}.`
        : "",
      input.campaignRepairReplay?.sourceEquivalentCommits.length
        ? `The complete same-spec source-equivalent repair already on current main came through commits: ${input.campaignRepairReplay.sourceEquivalentCommits.join(", ")}.`
        : "",
      input.campaignRepairReplay?.campaignSourceCommit
        ? `The frozen campaign source is ${input.campaignRepairReplay.campaignSourceCommit}; current main is ${input.campaignRepairReplay.currentMainCommit || baseCommit}.`
        : "",
      input.campaignRepairReplay?.campaignCompositionCommits.length
        ? `Reproduce the actual ordered campaign by starting at that frozen campaign source and then applying these already selected candidate commits in order before the conflicting PR head: ${input.campaignRepairReplay.campaignCompositionCommits.join(", ")}.`
        : "",
      input.campaignRepairReplay
        ? `Update the existing task branch and draft PR ${input.campaignRepairReplay.pullRequestId || "for this task"}; do not create another PR. The campaign controller cherry-picks only the PR head commit. A practical replay-safe history is a preparatory commit that restores the frozen same-spec file shape followed by one head commit that reapplies the complete current implementation plus the guard: the final PR tree remains a small current-main diff, while the head commit remains applicable to the frozen snapshot.`
        : "",
      frozenBaseCommit
        ? `Work only in ${workspaceDir}, based on current ${targetRef}@${baseCommit}. Keep the PR mergeable to main; the campaign controller will replay only the focused patch onto frozen base ${frozenBaseCommit}.`
        : `Work only in ${workspaceDir}, which is based on ${targetRef}@${baseCommit}.`,
      "Classify the root cause as test_issue, prod_issue, or inconclusive.",
      "Use prod_issue when live evidence identifies a provider/product operation that failed or remained stuck, including shared cluster setup before feature assertions; name that actual operation and do not imply a feature-specific regression. Use inconclusive only when the evidence cannot distinguish provider behavior from a repository-owned carrier, assertion, cleanup, or orchestration defect.",
      "For test_issue, make the smallest source fix, run scoped local verification, commit it, and leave the worktree clean. Do not push or create a PR; the workflow owns publication.",
      "For prod_issue or inconclusive, do not modify source. Cite exact artifact/log evidence.",
      "Do not stop or wait for the aggregate pipeline; investigate this completed slice now.",
    ].join("\n\n");
    const investigation = await runFailureInvestigation(ctx, input, {
      workspaceDir,
      prompt,
      headCommit,
    });
    if (investigation.kind === "blocked") return investigation.result;
    const { decision, nextCommit } = investigation;

    if (decision.classification === "prod_issue") {
      if (nextCommit !== headCommit) {
        const summary =
          "Product issue classification unexpectedly changed source; owner review is required.";
        return investigationBlocked(ctx, input, summary, [
          ...decision.evidence,
          `unexpected-commit:${nextCommit}`,
        ]);
      }
      routeFinding(
        ctx,
        input,
        "product",
        [
          `AKS master validation found a product issue in ${input.specId}.`,
          `Pipeline run: ${input.pipelineRunId}`,
          `Summary: ${decision.summary}`,
          `Evidence: ${decision.evidence.join("; ")}`,
        ].join("\n"),
      );
      const summary = `Classified ${input.specId} as a product issue and routed it to the AKS project owner; the failure remains open until a later current-main same-spec pass proves recovery.`;
      return waiting(
        ctx,
        summary,
        decision.evidence,
        productRecoveryCondition(
          input,
          currentRecoveryBaselineRunId(ctx, input),
          { requireCurrentMain: true },
        ),
        absorbLegacyRecoveryActions(ctx.task),
      );
    }

    if (decision.classification === "inconclusive") {
      const summary = `The ${input.specId} failure remains inconclusive: ${decision.summary}`;
      return inconclusiveWait(
        ctx,
        input,
        summary,
        decision.evidence,
        absorbLegacyRecoveryActions(ctx.task),
      );
    }

    if (frozenBaseCommit) {
      return prepareCampaignRepair(ctx, input, {
        repoDir,
        workspaceDir,
        sourceBranch,
        sourceCommit: nextCommit,
        campaignBaseCommit: frozenBaseCommit,
        evidence: decision.evidence,
      });
    }
    return reconcileTestIssue(ctx, input);
  } catch (error) {
    const summary = `Master-validation failure handling failed: ${error instanceof Error ? error.message : String(error)}`;
    return investigationBlocked(ctx, input, summary, [
      `spec:${input.specId}`,
      `pipeline-run:${input.pipelineRunId}`,
      `artifact:${input.artifactPath || "missing"}`,
    ]);
  }
}

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
  priorIntegratedProof,
  reconcileSpecLive,
  sourceChangeMayAffectSpec,
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
  carrierCommit: string;
};

type PullRequest = {
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
      carrierCommit: text(input.carrierCommit),
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
      "--project",
      adoProject,
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
): string[] {
  return activeTaskPullRequests(repoDir, taskId).map((pullRequest) => {
    const pullRequestId = text(pullRequest.pullRequestId);
    return pullRequestId && abandonPullRequest(repoDir, pullRequestId)
      ? `superseded-pull-request-abandoned:${pullRequestId}`
      : `superseded-pull-request-abandon-failed:${pullRequestId || "unknown"}`;
  });
}

export function productRecoveryCondition(
  input: FailureInput,
  afterRunId = input.pipelineRunId,
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
      sourceBranch: "refs/heads/main",
      pipelineRunId: { gt: afterRunId },
    },
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
    input.category === "environment_blocker" &&
    /standalone(?:\s+rp[- ]ingress)?\s+target\s+required/i.test(input.reason)
  );
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
    return campaignBranch && observedBranch === campaignBranch
      ? text(campaign.baseCommit)
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
): Record<string, unknown> | null {
  const trigger = triggerEvent(raw);
  if (!trigger || text(trigger.type) !== "pipeline.spec.observed") return null;
  const data = record(trigger.data);
  const value = (key: string) => text(trigger[key] ?? data[key]);
  return value("specId") === input.specId &&
    value("status").toLowerCase() === "pass" &&
    value("sourceBranch") === "refs/heads/main" &&
    Boolean(value("sourceCommit")) &&
    laterRun(value("pipelineRunId"), input.pipelineRunId)
    ? { ...data, ...trigger }
    : null;
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

function notifyHuman(
  ctx: WorkflowContext,
  input: FailureInput,
  kind: "product" | "test-pr",
  content: string,
  extra: Record<string, unknown> = {},
): boolean {
  const key = `${kind}:${input.specId}:${input.failureFingerprint}`;
  const path = notificationPath(ctx, key);
  if (existsSync(path)) return false;
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
    notifyHuman(
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
      productRecoveryCondition(input, currentRecoveryBaselineRunId(ctx, input)),
      absorbLegacyRecoveryActions(ctx.task),
    );
  }
  return result;
}

async function reconcileTestIssue(
  ctx: WorkflowContext,
  input: FailureInput,
): Promise<WorkflowResult> {
  const result = await reconcileSpecLive(ctx, {
    targetBranch: targetBranch,
    existingRecoveryAfterRunId: input.pipelineRunId,
    reusePriorIntegratedProof: true,
  });
  return preserveVerificationAfterNestedReconciliation(ctx, input, result);
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
  git(values.workspaceDir, [
    "push",
    "--set-upstream",
    "origin",
    values.sourceBranch,
  ]);
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
  const pullRequestId = text(pullRequest.pullRequestId);
  if (!pullRequestId) {
    throw new Error("Azure DevOps did not return a campaign repair PR id");
  }
  ctx.dispatchEvent("project.task.tick", {
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
    sourceCommit: values.sourceCommit,
  });
  const summary = `Prepared draft focused PR ${pullRequestId} for ${input.specId}; the frozen campaign can integrate it immediately, and the human will be notified only after verification publishes it as non-draft.`;
  return waiting(
    ctx,
    summary,
    [
      ...values.evidence,
      `blocking-pipeline-run:${input.pipelineRunId}`,
      `campaign-base:${values.campaignBaseCommit}`,
      `source-branch:${values.sourceBranch}`,
      `source-commit:${values.sourceCommit}`,
      `pull-request:${pullRequestId}`,
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

  try {
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
    git(repoDir, ["fetch", "origin", targetBranch]);
    const baseCommit = git(repoDir, ["rev-parse", targetRef]).stdout;
    const priorStandalone = requiresStandaloneVerification(input)
      ? priorStandaloneVerification(
          ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
          input.specId,
        )
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
    const repairBaseCommit = frozenBaseCommit || baseCommit;
    const headCommit = alignCleanRepairWorkspace({
      workspaceDir,
      targetRef,
      repairBaseCommit,
    });
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
    const recovery = passingRecoveryObservation(ctx.task, input);
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
    // Older owner turns split publication into a child and left the stable
    // failure parent with only fresh watcher input. Resume the finite source
    // lifecycle on the parent before stale-main logic can put both resources
    // back to sleep. The child is absorbed after nested reconciliation has
    // produced integration evidence.
    if (hasLegacyPublicationChild(ctx.task)) {
      if (frozenBaseCommit && headCommit !== repairBaseCommit) {
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
      notifyHuman(
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
        ),
        absorbLegacyRecoveryActions(ctx.task),
      );
    }
    if (["product_failure", "prod_issue"].includes(input.category)) {
      notifyHuman(
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
        ),
        absorbLegacyRecoveryActions(ctx.task),
      );
    }
    const existingPr = pullRequests(repoDir, sourceBranch)[0];
    const sourceIsInTarget =
      git(repoDir, ["merge-base", "--is-ancestor", headCommit, targetRef], true)
        .status === 0;
    if (
      shouldReconcileTestFix({
        hasPullRequest: Boolean(existingPr),
        sourceIsInTarget,
      })
    ) {
      if (frozenBaseCommit && headCommit !== repairBaseCommit) {
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
      frozenBaseCommit
        ? `Work only in ${workspaceDir}, aligned to frozen campaign base ${repairBaseCommit}. Do not merge or rebase newer main into this repair branch while the campaign is red.`
        : `Work only in ${workspaceDir}, which is based on ${targetRef}@${baseCommit}.`,
      "Classify the root cause as test_issue, prod_issue, or inconclusive.",
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
      notifyHuman(
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
      const summary = `Classified ${input.specId} as a product issue and notified the human operator; the failure remains open until a deployed product fix passes this spec from current main.`;
      return waiting(
        ctx,
        summary,
        decision.evidence,
        productRecoveryCondition(
          input,
          currentRecoveryBaselineRunId(ctx, input),
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

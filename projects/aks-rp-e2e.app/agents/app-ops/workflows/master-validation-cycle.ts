import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type {
  AppEventTarget,
  Condition,
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "@may-agent/sdk";
import {
  campaignFixFromPullRequest,
  campaignReceiptPath,
  composeFrozenCampaign,
  readCampaignReceipt,
  type CampaignReceipt,
  type CampaignFix,
} from "./lib/master-validation-campaign.js";
import { appendTrackedPipelineRunId } from "../../../watchers/aks-pipeline.js";

export const name = "master-validation-cycle";
export const description =
  "Run six-hourly master validation from main; after failure, freeze that main snapshot and continuously test a campaign branch containing focused unmerged fixes until current main passes.";

const organization = "https://dev.azure.com/msazure";
const adoProject = "CloudNativeCompute";
const pipelineId = "467665";
const repository = "aks-e2e-spec-runner";
const targetBranch = "main";
const sourceBranch = "main";
const sourceRef = "origin/main";
const scheduledPurpose = "scheduled-master-validation";
const campaignPurpose = "master-validation-campaign";
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

type PullRequest = {
  pullRequestId?: unknown;
  status?: unknown;
  mergeStatus?: unknown;
  title?: unknown;
  description?: unknown;
  sourceRefName?: unknown;
  targetRefName?: unknown;
  lastMergeSourceCommit?: { commitId?: unknown };
  lastMergeTargetCommit?: { commitId?: unknown };
  isDraft?: unknown;
};

export type FixVerificationTrigger = {
  specId: string;
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  pullRequestIds: string[];
};

type CycleReceipt = {
  runId: string;
  sourceCommit: string;
  sourceBranch?: string;
  purpose?: typeof scheduledPurpose | typeof campaignPurpose;
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
    [scheduledPurpose, campaignPurpose].includes(text(metadata.purpose))
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
          [scheduledPurpose, campaignPurpose].includes(
            text(parseMetadata(run).purpose),
          )
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

export function campaignRecoveryDue(
  queuedAt: string,
  nowMs = Date.now(),
): boolean {
  const queuedAtMs = Date.parse(queuedAt);
  return Number.isFinite(queuedAtMs) && nowMs - queuedAtMs >= cycleIntervalMs;
}

export function campaignPatchConflict(message: string): {
  pullRequestId: string;
  taskId: string;
  sourceCommit: string;
  pullRequestSourceCommit: string;
  composedPredecessors: string[];
} | null {
  const match = message.match(
    /Campaign focused-patch conflict for PR (\d+) \(([^)]+)\) at ([0-9a-f]{7,40})(?: from PR head ([0-9a-f]{7,40}))?(?: after composed predecessors ([0-9a-f,]+))?:/i,
  );
  return match
    ? {
        pullRequestId: match[1],
        taskId: match[2],
        sourceCommit: match[3].toLowerCase(),
        pullRequestSourceCommit: (match[4] || match[3]).toLowerCase(),
        composedPredecessors: (match[5] || "")
          .split(",")
          .map((commit) => commit.trim().toLowerCase())
          .filter(Boolean),
      }
    : null;
}

export function campaignPatchConflictRepairWake(
  conflict: {
    pullRequestId: string;
    taskId: string;
    sourceCommit: string;
    pullRequestSourceCommit?: string;
    composedPredecessors?: string[];
  },
  campaign: CampaignReceipt,
  currentMainCommit: string,
): Record<string, unknown> {
  const composingCurrentMainSuccessor =
    campaign.baseCommit !== currentMainCommit;
  const compositionBaseCommit = composingCurrentMainSuccessor
    ? currentMainCommit
    : campaign.currentCommit;
  return {
    target: { project: "aks-rp-e2e", taskId: conflict.taskId },
    project: "aks-rp-e2e",
    taskId: conflict.taskId,
    task_id: conflict.taskId,
    reason: "repair-focused-patch-after-frozen-campaign-conflict",
    overrideWait: true,
    requiredAction:
      "Repair the existing focused patch so it applies cleanly after the listed predecessors on the exact campaign composition base while preserving its tested intent; update the same PR branch and require exact verification.",
    pullRequestId: conflict.pullRequestId,
    campaignSourceCommit: compositionBaseCommit,
    campaignCompositionBaseCommit: compositionBaseCommit,
    campaignCompositionKind: composingCurrentMainSuccessor
      ? "current-main-successor"
      : "frozen-campaign",
    currentMainCommit,
    sourceCommit: conflict.pullRequestSourceCommit || conflict.sourceCommit,
    sourceEquivalentCommits: [
      conflict.pullRequestSourceCommit || conflict.sourceCommit,
    ],
    conflictingCommit: conflict.sourceCommit,
    campaignCompositionCommits: conflict.composedPredecessors ?? [],
    conflictingPaths: [],
  };
}

async function emitWorkflowEvent(
  ctx: WorkflowContext,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  await ctx.events.emit({
    type,
    source: "workflow:master-validation-cycle",
    target: record(data.target) as AppEventTarget,
    data,
  });
}

async function campaignPatchConflictWait(
  ctx: WorkflowContext,
  conflict: {
    pullRequestId: string;
    taskId: string;
    sourceCommit: string;
    pullRequestSourceCommit: string;
    composedPredecessors: string[];
  },
  message: string,
  appDir: string,
  repoDir: string,
): Promise<ExecutionResult<TaskReconcileResult>> {
  const campaign = readCampaignReceipt(appDir);
  let repairWake = false;
  let compositionBaseCommit = "";
  if (
    campaign &&
    conflict.taskId.startsWith("domain/master-validation-failure/")
  ) {
    const currentMainCommit = resolveCurrentMain(repoDir);
    compositionBaseCommit =
      campaign.baseCommit !== currentMainCommit
        ? currentMainCommit
        : campaign.currentCommit;
    await emitWorkflowEvent(
      ctx,
      "project.task.tick",
      campaignPatchConflictRepairWake(conflict, campaign, currentMainCommit),
    );
    repairWake = true;
  }
  const summary = `Campaign composition at ${compositionBaseCommit || "the retained base"} is waiting for focused PR ${conflict.pullRequestId} to change or close; PR head ${conflict.pullRequestSourceCommit} contains conflicting commit ${conflict.sourceCommit}.`;
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: [
      `pull-request:${conflict.pullRequestId}`,
      `source-commit:${conflict.pullRequestSourceCommit}`,
      `conflicting-commit:${conflict.sourceCommit}`,
      `campaign-replay-conflict:${message}`,
      `campaign-conflict-repair-wake:${repairWake ? conflict.taskId : "unavailable"}`,
    ],
    actions: [],
    conditions: [
      {
        id: `master-validation-campaign-pr-${conflict.pullRequestId}-closed`,
        type: "pull-request.state",
        subject: `pull-request:${conflict.pullRequestId}`,
        expected: {
          field: "state",
          anyOf: ["completed", "abandoned", "conflicted"],
        },
      },
      {
        id: `master-validation-campaign-pr-${conflict.pullRequestId}-source-not-${conflict.pullRequestSourceCommit}`,
        type: "pull-request.state",
        subject: `pull-request:${conflict.pullRequestId}`,
        expected: {
          field: "sourceCommit",
          notEquals: conflict.pullRequestSourceCommit,
        },
      },
    ],
  });
}

export function buildMasterValidationQueueArgs(input: {
  taskId: string;
  generation: number;
  sourceCommit: string;
  queuedAt: string;
  sourceBranch?: string;
  purpose?: typeof scheduledPurpose | typeof campaignPurpose;
  campaign?: CampaignReceipt | null;
}): string[] {
  const runBranch = input.sourceBranch || sourceBranch;
  const purpose = input.purpose || scheduledPurpose;
  const metadata = JSON.stringify({
    taskId: input.taskId,
    generation: String(input.generation),
    purpose,
    sourceBranch: runBranch,
    sourceCommit: input.sourceCommit,
    cycleKey: input.queuedAt,
    ...(input.campaign
      ? {
          campaignBaseCommit: input.campaign.baseCommit,
          campaignBaselineRunId: input.campaign.baselineRunId,
          campaignFixPullRequests: input.campaign.integratedFixes
            .map((fix) => fix.pullRequestId)
            .join(","),
        }
      : {}),
  });
  return [
    "pipelines",
    "run",
    "--id",
    pipelineId,
    "--branch",
    runBranch,
    "--commit-id",
    input.sourceCommit,
    "--parameters",
    `feature_set=${featureSet}`,
    `target=${target}`,
    "slices=9",
    "slice_max_parallel=9",
    "parallel=3",
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

function azJson(
  args: string[],
  cwd: string,
  options: { projectScoped?: boolean } = {},
): unknown {
  const projectScoped = options.projectScoped !== false;
  const result = command(
    azCli,
    [
      ...args,
      "--organization",
      organization,
      ...(projectScoped ? ["--project", adoProject] : []),
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

function taskPayload(reconciliation: WorkflowContext["reconciliation"]): {
  taskId: string;
  generation: number;
} {
  return {
    taskId: reconciliation?.taskId || "master-validation-staging-cycle",
    generation: reconciliation?.generation ?? 1,
  };
}

export function fixVerificationTrigger(
  event: unknown,
): FixVerificationTrigger | null {
  const trigger = record(event);
  const data = record(trigger.data);
  const value = (key: string) => text(trigger[key] ?? data[key]);
  const pullRequestIds = Array.isArray(data.pullRequestIds)
    ? data.pullRequestIds.map(text).filter(Boolean)
    : [];
  return value("reason") === "master-validation-fix-verified" &&
    value("specId") &&
    value("pipelineRunId") &&
    value("sourceBranch") &&
    value("sourceCommit") &&
    pullRequestIds.length
    ? {
        specId: value("specId"),
        pipelineRunId: value("pipelineRunId"),
        sourceBranch: value("sourceBranch"),
        sourceCommit: value("sourceCommit"),
        pullRequestIds,
      }
    : null;
}

function eventData(event: Record<string, unknown>): Record<string, unknown> {
  if (
    event.data &&
    typeof event.data === "object" &&
    !Array.isArray(event.data)
  ) {
    return record(event.data);
  }
  const raw = text(event.data);
  if (!raw) return {};
  try {
    return record(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function campaignPassVerificationTrigger(
  campaign: CampaignReceipt | null,
  event: Record<string, unknown>,
): FixVerificationTrigger | null {
  if (!campaign) return null;
  const data = eventData(event);
  const value = (key: string) => text(data[key] ?? event[key]);
  const eventType = text(
    event.type ?? event.event_type ?? data.type ?? data.event_type,
  );
  const specId = value("specId") || value("spec_id");
  const sourceBranch = value("sourceBranch").replace(/^refs\/heads\//, "");
  const sourceCommit = value("sourceCommit") || value("sourceVersion");
  if (
    eventType !== "pipeline.spec.observed" ||
    !specId ||
    value("status").toLowerCase() !== "pass"
  ) {
    return null;
  }
  const stableTaskId = `domain/master-validation-failure/${specId}`;
  const pullRequestIds = campaign.integratedFixes
    .filter(
      (fix) =>
        (fix.taskId === stableTaskId ||
          fix.taskId.startsWith(`${stableTaskId}/`)) &&
        fix.sourceBranch.replace(/^refs\/heads\//, "") === sourceBranch &&
        fix.sourceCommit === sourceCommit,
    )
    .map((fix) => fix.pullRequestId);
  const pipelineRunId = value("pipelineRunId") || value("runId");
  return pipelineRunId && pullRequestIds.length
    ? {
        specId,
        pipelineRunId,
        sourceBranch,
        sourceCommit,
        pullRequestIds,
      }
    : null;
}

function receiptPath(ctx: WorkflowContext): string {
  return join(ctx.workspace!.appRoot, ".state", "master-validation-cycle.json");
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

function waitCondition(runId: string): Condition {
  return {
    id: `master-validation-run-${runId}-completed`,
    type: "pipeline-run.state",
    subject: `pipeline-run:${runId}`,
    expected: { field: "state", anyOf: ["completed"] },
  };
}

export function transientMasterValidationAccessFailure(
  message: string,
): boolean {
  return /\b(408|409|423|425|429|500|502|503|504)\b|connection|temporar|timed?\s*out|could not resolve|tls|reset by peer|unable to access|AADSTS|interactive authentication|could not read username|credential/i.test(
    message,
  );
}

function waiting(
  ctx: WorkflowContext,
  runId: string,
  runBranch: string,
  sourceCommit: string,
  summary: string,
  extraEvidence: string[] = [],
): ExecutionResult<TaskReconcileResult> {
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: [
      `pipeline-run:${runId}`,
      `source-branch:${runBranch}`,
      `source-commit:${sourceCommit}`,
      `feature-set:${featureSet}`,
      `target:${target}`,
      ...extraEvidence,
    ],
    actions: [],
    conditions: [waitCondition(runId)],
  });
}

function completeCampaignObservation(
  ctx: WorkflowContext,
  campaign: CampaignReceipt,
  summary: string,
  evidence: string[] = [],
): ExecutionResult<TaskReconcileResult> {
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [
      `campaign-branch:${campaign.branch}`,
      `campaign-base:${campaign.baseCommit}`,
      `campaign-commit:${campaign.currentCommit}`,
      "next-observation:schedule:master-validation-staging-cycle",
      ...evidence,
    ],
    actions: [],
  });
}

function completeTransientAccessObservation(
  ctx: WorkflowContext,
  appDir: string,
  summary: string,
  message: string,
): ExecutionResult<TaskReconcileResult> {
  const campaign = readCampaignReceipt(appDir);
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [
      `transient-ado-access:${message}`,
      `pipeline:${pipelineId}`,
      `source-ref:${sourceRef}`,
      "next-observation:schedule:master-validation-staging-cycle",
      ...(campaign
        ? [
            `campaign-branch:${campaign.branch}`,
            `campaign-base:${campaign.baseCommit}`,
            `campaign-commit:${campaign.currentCommit}`,
          ]
        : []),
    ],
    actions: [],
  });
}

export function resolveCurrentMain(repoDir: string): string {
  const fetched = command(
    "git",
    [
      "fetch",
      "origin",
      `+refs/heads/${sourceBranch}:refs/remotes/origin/${sourceBranch}`,
    ],
    repoDir,
  );
  if (fetched.status !== 0) throw new Error(fetched.stderr || fetched.stdout);
  const resolved = command("git", ["rev-parse", sourceRef], repoDir);
  if (resolved.status !== 0 || !resolved.stdout) {
    throw new Error(resolved.stderr || `Could not resolve ${sourceRef}`);
  }
  return resolved.stdout;
}

function campaignFixKey(fix: CampaignFix): string {
  return fix.taskId.startsWith("pull-request/")
    ? `pull-request:${fix.pullRequestId}`
    : `task:${fix.taskId}`;
}

function comparePullRequestIds(left: string, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

export function latestCampaignFixes(fixes: CampaignFix[]): CampaignFix[] {
  const latestByKey = new Map<string, CampaignFix>();
  for (const fix of fixes) {
    const key = campaignFixKey(fix);
    const prior = latestByKey.get(key);
    if (
      !prior ||
      comparePullRequestIds(prior.pullRequestId, fix.pullRequestId) <= 0
    ) {
      latestByKey.set(key, fix);
    }
  }
  return [...latestByKey.values()].sort((left, right) =>
    comparePullRequestIds(left.pullRequestId, right.pullRequestId),
  );
}

export function scheduledFailureTransition(
  failedSourceCommit: string,
  currentMainCommit: string,
  activeFixes: CampaignFix[],
):
  | { kind: "frozen-campaign"; fixes: CampaignFix[] }
  | { kind: "current-main"; fixes: [] }
  | { kind: "current-main-successor"; fixes: CampaignFix[] } {
  const failedCommit = failedSourceCommit.trim();
  const mainCommit = currentMainCommit.trim();
  if (!failedCommit || !mainCommit) {
    throw new Error(
      "Both failed source commit and current main commit are required",
    );
  }
  const fixes = latestCampaignFixes(activeFixes);
  if (failedCommit === mainCommit) {
    return { kind: "frozen-campaign", fixes };
  }
  return fixes.length
    ? { kind: "current-main-successor", fixes }
    : { kind: "current-main", fixes: [] };
}

export function currentMainCampaignSuccessorInput(
  campaign: CampaignReceipt,
  currentMainCommit: string,
  activeFixes: CampaignFix[],
): {
  baselineRunId: string;
  baseCommit: string;
  fixes: CampaignFix[];
  preferredPullRequestIds: string[];
} {
  const baseCommit = currentMainCommit.trim();
  if (!baseCommit) throw new Error("Current main commit is required");
  return {
    baselineRunId: `main-${baseCommit.slice(0, 12)}`,
    baseCommit,
    fixes: latestCampaignFixes(activeFixes),
    preferredPullRequestIds: campaign.integratedFixes.map(
      (fix) => fix.pullRequestId,
    ),
  };
}

function activeCampaignFixes(
  repoDir: string,
  campaignBaseCommit: string,
): CampaignFix[] {
  const value = azJson(
    [
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
    ],
    repoDir,
  );
  return Array.isArray(value)
    ? latestCampaignFixes(
        value.flatMap((pullRequest) => {
          const fix = campaignFixFromPullRequest(pullRequest as PullRequest);
          return fix?.campaignBaseCommit === campaignBaseCommit ? [fix] : [];
        }),
      )
    : [];
}

function composeCurrentMainCampaignSuccessor(
  appDir: string,
  repoDir: string,
  campaign: CampaignReceipt,
  currentMainCommit: string,
) {
  const successor = currentMainCampaignSuccessorInput(
    campaign,
    currentMainCommit,
    activeCampaignFixes(repoDir, campaign.baseCommit),
  );
  return composeFrozenCampaign({
    appDir,
    repoDir,
    ...successor,
    prior: null,
  });
}

function completedCampaignReplacements(
  repoDir: string,
  campaign: CampaignReceipt | null,
): CampaignFix[] {
  if (!campaign) return [];
  const taskIds = new Set(
    campaign.integratedFixes
      .map((fix) => fix.taskId)
      .filter((taskId) => !taskId.startsWith("pull-request/")),
  );
  if (!taskIds.size) return [];
  const integratedPullRequestIds = new Set(
    campaign.integratedFixes.map((fix) => fix.pullRequestId),
  );
  const value = azJson(
    [
      "repos",
      "pr",
      "list",
      "--repository",
      repository,
      "--target-branch",
      targetBranch,
      "--status",
      "completed",
      "--top",
      "200",
    ],
    repoDir,
  );
  if (!Array.isArray(value)) return [];
  return value.flatMap((pullRequest) => {
    const fix = campaignFixFromPullRequest(pullRequest as PullRequest, {
      includeCompleted: true,
    });
    return fix &&
      taskIds.has(fix.taskId) &&
      !integratedPullRequestIds.has(fix.pullRequestId)
      ? [fix]
      : [];
  });
}

function pullRequest(repoDir: string, pullRequestId: string): PullRequest {
  return record(
    azJson(["repos", "pr", "show", "--id", pullRequestId], repoDir, {
      projectScoped: false,
    }),
  ) as PullRequest;
}

function integratedPullRequestStates(
  repoDir: string,
  campaign: CampaignReceipt,
): Array<{
  fix: CampaignFix;
  state: string;
  mergeStatus: string;
  isDraft: boolean;
}> {
  return latestCampaignFixes(campaign.integratedFixes).map((fix) => {
    const current = pullRequest(repoDir, fix.pullRequestId);
    return {
      fix,
      state: text(current.status) || "unknown",
      mergeStatus: text(current.mergeStatus) || "unknown",
      isDraft: current.isDraft === true,
    };
  });
}

export function campaignIntegratedFixesMerged(
  states: Array<{ state: string; mergeStatus: string }>,
): boolean {
  return (
    states.length > 0 &&
    states.every(
      ({ state, mergeStatus }) =>
        state === "completed" && mergeStatus === "succeeded",
    )
  );
}

export function campaignBaselineIsCurrent(
  campaign: Pick<CampaignReceipt, "baseCommit">,
  currentMainCommit: string,
): boolean {
  return (
    Boolean(currentMainCommit) && campaign.baseCommit === currentMainCommit
  );
}

function publishPullRequest(
  repoDir: string,
  pullRequestId: string,
): { evidence: string; actionable: boolean } {
  const current = pullRequest(repoDir, pullRequestId);
  if (text(current.status) !== "active") {
    return {
      evidence: `pull-request:${pullRequestId}:${text(current.status) || "unknown"}`,
      actionable: false,
    };
  }
  if (current.isDraft !== true) {
    return {
      evidence: `pull-request:${pullRequestId}:published`,
      actionable: true,
    };
  }
  const updated = record(
    azJson(
      ["repos", "pr", "update", "--id", pullRequestId, "--draft", "false"],
      repoDir,
      { projectScoped: false },
    ),
  ) as PullRequest;
  if (updated.isDraft === true) {
    throw new Error(`PR ${pullRequestId} remained draft after publication`);
  }
  return {
    evidence: `pull-request:${pullRequestId}:published`,
    actionable: true,
  };
}

export function registerMasterValidationRun(appDir: string, runId: string) {
  return appendTrackedPipelineRunId(appDir, runId);
}

async function publishVerifiedFixes(
  ctx: WorkflowContext,
  repoDir: string,
  campaign: CampaignReceipt | null,
  trigger: FixVerificationTrigger | null,
): Promise<string[]> {
  if (!campaign || !trigger) {
    return [];
  }
  const exactVerified = new Set(
    campaign.integratedFixes
      .filter(
        (fix) =>
          fix.sourceBranch.replace(/^refs\/heads\//, "") ===
            trigger.sourceBranch.replace(/^refs\/heads\//, "") &&
          fix.sourceCommit === trigger.sourceCommit,
      )
      .map((fix) => fix.pullRequestId),
  );
  const pullRequestIds = [...new Set(trigger.pullRequestIds)]
    .filter((id) => exactVerified.has(id))
    .filter((id) => {
      const current = pullRequest(repoDir, id);
      return (
        text(current.sourceRefName).replace(/^refs\/heads\//, "") ===
          trigger.sourceBranch.replace(/^refs\/heads\//, "") &&
        text(current.lastMergeSourceCommit?.commitId) === trigger.sourceCommit
      );
    });
  const publications = pullRequestIds.map((id) => ({
    pullRequestId: id,
    ...publishPullRequest(repoDir, id),
  }));
  const evidence = publications.map((publication) => publication.evidence);
  if (!pullRequestIds.length) return evidence;
  const appDir = ctx.workspace!.appRoot;
  const notificationKey = [
    trigger.pipelineRunId,
    trigger.specId,
    trigger.sourceCommit,
    ...pullRequestIds.slice().sort(),
  ].join(":");
  const notificationReceipt = join(
    appDir,
    ".state",
    "master-validation-fix-ready",
    `${createHash("sha256").update(notificationKey).digest("hex")}.json`,
  );
  if (existsSync(notificationReceipt)) {
    return [...evidence, "fix-ready-notification:already-sent"];
  }
  const actionablePullRequestIds = publications
    .filter((publication) => publication.actionable)
    .map((publication) => publication.pullRequestId);
  if (!actionablePullRequestIds.length) return evidence;
  const notificationContent = verifiedFixNotificationContent({
    specId: trigger.specId,
    pipelineRunId: trigger.pipelineRunId,
    pullRequestIds: actionablePullRequestIds,
  });
  await emitWorkflowEvent(ctx, "message.created", {
    target: { project: "aks-rp-e2e", human: true },
    from: "app-ops",
    to: "human:operator",
    intent: "master-validation-fix-ready",
    priority: "P1",
    project: "aks-rp-e2e",
    pipelineRunId: trigger.pipelineRunId,
    specId: trigger.specId,
    pullRequestIds: actionablePullRequestIds,
    content: notificationContent,
  });
  mkdirSync(dirname(notificationReceipt), { recursive: true });
  writeFileSync(
    notificationReceipt,
    `${JSON.stringify(
      {
        notificationKey,
        pipelineRunId: trigger.pipelineRunId,
        specId: trigger.specId,
        sourceCommit: trigger.sourceCommit,
        pullRequestIds: actionablePullRequestIds,
        matchedPullRequestIds: pullRequestIds,
        sentAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  return [...evidence, "fix-ready-notification:sent"];
}

export function verifiedFixNotificationContent(input: {
  specId: string;
  pipelineRunId: string;
  pullRequestIds: string[];
}): string {
  return [
    `AKS master-validation fix for ${input.specId} passed campaign run ${input.pipelineRunId}.`,
    `Published review-ready PR(s): ${input.pullRequestIds.join(", ")}.`,
    "The app proved the fix and removed draft status; repository approvals or policies may still remain.",
    "Please satisfy those checks and merge each PR into main; the app will keep the frozen campaign moving and later verify current main.",
  ].join("\n");
}

function clearCampaign(
  appDir: string,
  repoDir: string,
  campaign: CampaignReceipt,
): string[] {
  const deleted = command(
    "git",
    ["push", "origin", "--delete", campaign.branch],
    repoDir,
  );
  const path = campaignReceiptPath(appDir);
  if (existsSync(path)) unlinkSync(path);
  return [
    deleted.status === 0
      ? `campaign-branch-deleted:${campaign.branch}`
      : `campaign-branch-delete-deferred:${campaign.branch}`,
  ];
}

async function notifyCampaignTasks(
  ctx: WorkflowContext,
  campaign: CampaignReceipt,
  input: {
    reason: "master-validation-main-passed";
    runId: string;
    sourceCommit: string;
  },
): Promise<void> {
  for (const taskId of new Set(
    campaign.integratedFixes
      .map((fix) => fix.taskId)
      .filter((value) => value.startsWith("domain/master-validation-failure/")),
  )) {
    await emitWorkflowEvent(ctx, "project.task.tick", {
      target: { project: "aks-rp-e2e", taskId },
      project: "aks-rp-e2e",
      taskId,
      task_id: taskId,
      reason: input.reason,
      campaignBaselineRunId: campaign.baselineRunId,
      pipelineRunId: input.runId,
      sourceCommit: input.sourceCommit,
    });
  }
}

async function notifyCampaignReady(
  ctx: WorkflowContext,
  campaign: CampaignReceipt,
  runId: string,
  pullRequestIds: string[],
): Promise<void> {
  const appDir = ctx.workspace!.appRoot;
  const key = `${campaign.baselineRunId}:${campaign.currentCommit}:${pullRequestIds.join(",")}`;
  const receipt = join(
    appDir,
    ".state",
    "master-validation-campaign-ready",
    `${createHash("sha256").update(key).digest("hex")}.json`,
  );
  if (existsSync(receipt)) return;
  await emitWorkflowEvent(ctx, "message.created", {
    target: { project: "aks-rp-e2e", human: true },
    from: "app-ops",
    to: "human:operator",
    intent: "master-validation-campaign-ready",
    priority: "P1",
    project: "aks-rp-e2e",
    pipelineRunId: runId,
    campaignBranch: campaign.branch,
    campaignCommit: campaign.currentCommit,
    pullRequestIds,
    content: [
      `AKS master-validation campaign run ${runId} passed at ${campaign.branch}@${campaign.currentCommit}.`,
      `Focused PRs verified together: ${pullRequestIds.join(", ") || "none"}.`,
      "Merge the focused PRs individually into main; the app will then run one full latest-main verification. Do not merge the campaign branch.",
    ].join("\n"),
  });
  mkdirSync(dirname(receipt), { recursive: true });
  writeFileSync(
    receipt,
    `${JSON.stringify({ key, runId, pullRequestIds, sentAt: new Date().toISOString() }, null, 2)}\n`,
  );
}

function queueCycle(
  ctx: WorkflowContext,
  repoDir: string,
  payload: { taskId: string; generation: number },
  runBranch: string,
  sourceCommit: string,
  purpose: typeof scheduledPurpose | typeof campaignPurpose,
  campaign?: CampaignReceipt | null,
  staleRunId?: string,
): ExecutionResult<TaskReconcileResult> {
  const queueClaimPath = join(
    ctx.workspace!.appRoot,
    ".state",
    "master-validation-queue.claim",
  );
  let queueClaim: number | null = null;
  if (campaign) {
    mkdirSync(dirname(queueClaimPath), { recursive: true });
    if (
      existsSync(queueClaimPath) &&
      Date.now() - statSync(queueClaimPath).mtimeMs >= 5 * 60_000
    ) {
      unlinkSync(queueClaimPath);
    }
    try {
      queueClaim = openSync(queueClaimPath, "wx");
      writeFileSync(
        queueClaim,
        `${JSON.stringify({ runBranch, sourceCommit, claimedAt: new Date().toISOString() })}\n`,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return completeCampaignObservation(
        ctx,
        campaign,
        `Another reconciliation is already queueing ${runBranch}@${sourceCommit}; wait for its durable receipt instead of creating a duplicate run.`,
        ["campaign-queue-claim:in-flight"],
      );
    }
  }
  const queuedAt = new Date().toISOString();
  try {
    const queued = record(
      azJson(
        buildMasterValidationQueueArgs({
          taskId: payload.taskId,
          generation: payload.generation,
          sourceBranch: runBranch,
          sourceCommit,
          queuedAt,
          purpose,
          campaign,
        }),
        repoDir,
      ),
    );
    const runId = text(queued.id);
    if (!runId)
      throw new Error("Azure DevOps did not return a pipeline run id");
    registerMasterValidationRun(ctx.workspace!.appRoot, runId);
    saveReceipt(receiptPath(ctx), {
      runId,
      sourceBranch: runBranch,
      sourceCommit,
      purpose,
      queuedAt,
    });
    const summary = staleRunId
      ? `Master-validation run ${staleRunId} was superseded; queued replacement run ${runId} from ${runBranch}@${sourceCommit}.`
      : `Queued master-validation run ${runId} from exact ${runBranch}@${sourceCommit}; progressive slice observation continues while the aggregate run executes.`;
    return waiting(ctx, runId, runBranch, sourceCommit, summary);
  } finally {
    if (queueClaim !== null) closeSync(queueClaim);
    if (campaign && existsSync(queueClaimPath)) unlinkSync(queueClaimPath);
  }
}

export async function execute(
  ctx: WorkflowContext,
): Promise<ExecutionResult<TaskReconcileResult>> {
  if (!ctx.reconciliation || !ctx.workspace) {
    return ctx.blocked(
      "Master validation cycle requires a durable task and App workspace",
      {
        hasReconciliation: Boolean(ctx.reconciliation),
        hasWorkspace: Boolean(ctx.workspace),
      },
    ) as ExecutionResult<TaskReconcileResult>;
  }
  const repoDir = ctx.workspace.projectRoot;
  const appDir = ctx.workspace.appRoot;
  const payload = taskPayload(ctx.reconciliation);
  try {
    const campaign = readCampaignReceipt(appDir);
    const trigger = ctx.reconciliation.trigger;
    const directVerification =
      fixVerificationTrigger(trigger) ??
      campaignPassVerificationTrigger(campaign, record(trigger));
    const fixPublicationEvidence = directVerification
      ? await publishVerifiedFixes(ctx, repoDir, campaign, directVerification)
      : [];
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
      const activeBranch = text(active.sourceBranch).replace(
        /^refs\/heads\//,
        "",
      );
      const activeCommit = text(active.sourceVersion);
      const activeCampaign = readCampaignReceipt(appDir);
      if (activeCampaign && activeBranch === activeCampaign.branch) {
        const currentMainCommit = resolveCurrentMain(repoDir);
        if (!campaignBaselineIsCurrent(activeCampaign, currentMainCommit)) {
          const successor = composeCurrentMainCampaignSuccessor(
            appDir,
            repoDir,
            activeCampaign,
            currentMainCommit,
          ).receipt;
          return waiting(
            ctx,
            text(active.id),
            activeBranch,
            activeCommit,
            `Master validation run ${text(active.id)} continues on frozen base ${activeCampaign.baseCommit}; main advanced to ${currentMainCommit}, so prepared successor ${successor.currentCommit} carries the same isolated fixes onto that exact current-main base.`,
            [
              ...fixPublicationEvidence,
              `stale-campaign-base:${activeCampaign.baseCommit}`,
              `successor-current-main:${currentMainCommit}`,
              `campaign-successor:${successor.branch}@${successor.currentCommit}`,
              ...successor.integratedFixes.map(
                (fix) =>
                  `successor-fix-pull-request:${fix.pullRequestId}@${fix.sourceCommit}`,
              ),
            ],
          );
        }
        const successor = composeFrozenCampaign({
          appDir,
          repoDir,
          baselineRunId: activeCampaign.baselineRunId,
          baseCommit: activeCampaign.baseCommit,
          fixes: activeCampaignFixes(repoDir, activeCampaign.baseCommit),
          replacementFixes: completedCampaignReplacements(
            repoDir,
            activeCampaign,
          ),
          prior: activeCampaign,
        }).receipt;
        if (successor.currentCommit !== activeCommit) {
          return waiting(
            ctx,
            text(active.id),
            activeBranch,
            activeCommit,
            `Master validation run ${text(active.id)} continues on ${activeCommit}; prepared successor ${successor.currentCommit} with the latest focused fixes so the next run can start immediately after this one finishes.`,
            [
              ...fixPublicationEvidence,
              `campaign-successor:${successor.branch}@${successor.currentCommit}`,
              ...successor.integratedFixes.map(
                (fix) =>
                  `successor-fix-pull-request:${fix.pullRequestId}@${fix.sourceCommit}`,
              ),
            ],
          );
        }
      }
      return waiting(
        ctx,
        text(active.id),
        activeBranch || sourceBranch,
        activeCommit,
        `Master validation run ${text(active.id)} is already active; no overlapping run was queued.`,
        fixPublicationEvidence,
      );
    }

    const prior = readReceipt(receiptPath(ctx));
    if (prior) {
      const exact = record(
        azJson(["pipelines", "runs", "show", "--id", prior.runId], repoDir),
      ) as PipelineRun;
      const priorBranch =
        prior.sourceBranch ||
        text(exact.sourceBranch).replace(/^refs\/heads\//, "") ||
        sourceBranch;
      const priorPurpose =
        prior.purpose ||
        (priorBranch.startsWith("validation/master-validation-")
          ? campaignPurpose
          : scheduledPurpose);
      if (text(exact.status) !== "completed") {
        return waiting(
          ctx,
          prior.runId,
          priorBranch,
          prior.sourceCommit,
          `Master validation run ${prior.runId} is ${text(exact.status) || "still active"}; no overlapping run was queued.`,
        );
      }
      const result = text(exact.result) || "unknown";

      if (priorPurpose === campaignPurpose) {
        const campaign = readCampaignReceipt(appDir);
        if (!campaign) {
          throw new Error(
            `Campaign run ${prior.runId} has no durable campaign receipt`,
          );
        }
        const currentMainCommit = resolveCurrentMain(repoDir);
        if (!campaignBaselineIsCurrent(campaign, currentMainCommit)) {
          const successor = composeCurrentMainCampaignSuccessor(
            appDir,
            repoDir,
            campaign,
            currentMainCommit,
          ).receipt;
          if (successor.currentCommit !== successor.baseCommit) {
            return queueCycle(
              ctx,
              repoDir,
              payload,
              successor.branch,
              successor.currentCommit,
              campaignPurpose,
              successor,
              prior.runId,
            );
          }
          return queueCycle(
            ctx,
            repoDir,
            payload,
            sourceBranch,
            currentMainCommit,
            scheduledPurpose,
            null,
            prior.runId,
          );
        }
        const composed = composeFrozenCampaign({
          appDir,
          repoDir,
          baselineRunId: campaign.baselineRunId,
          baseCommit: campaign.baseCommit,
          fixes: activeCampaignFixes(repoDir, campaign.baseCommit),
          replacementFixes: completedCampaignReplacements(repoDir, campaign),
          prior: campaign,
        });
        if (composed.receipt.currentCommit !== prior.sourceCommit) {
          return queueCycle(
            ctx,
            repoDir,
            payload,
            composed.receipt.branch,
            composed.receipt.currentCommit,
            campaignPurpose,
            composed.receipt,
            prior.runId,
          );
        }
        if (completedCycleState(result) !== "converged") {
          const states = integratedPullRequestStates(repoDir, composed.receipt);
          if (campaignIntegratedFixesMerged(states)) {
            return queueCycle(
              ctx,
              repoDir,
              payload,
              sourceBranch,
              resolveCurrentMain(repoDir),
              scheduledPurpose,
              composed.receipt,
              prior.runId,
            );
          }
          if (campaignRecoveryDue(prior.queuedAt)) {
            return queueCycle(
              ctx,
              repoDir,
              payload,
              composed.receipt.branch,
              composed.receipt.currentCommit,
              campaignPurpose,
              composed.receipt,
              prior.runId,
            );
          }
          return completeCampaignObservation(
            ctx,
            composed.receipt,
            `Campaign run ${prior.runId} failed on the frozen ${composed.receipt.baseCommit} snapshot. A new focused PR head reruns immediately; otherwise the same snapshot reruns at the six-hour recovery cadence.`,
            [
              `pipeline-run:${prior.runId}`,
              `pipeline-result:${result}`,
              ...composed.receipt.integratedFixes.map(
                (fix) =>
                  `fix-pull-request:${fix.pullRequestId}@${fix.sourceCommit}`,
              ),
            ],
          );
        }

        const states = integratedPullRequestStates(repoDir, composed.receipt);
        const invalid = states.filter(
          ({ state, mergeStatus }) =>
            state === "abandoned" ||
            (state === "completed" && mergeStatus !== "succeeded"),
        );
        if (invalid.length) {
          const summary = `Campaign ${composed.receipt.branch} passed, but ${invalid.length} included fix PR(s) cannot integrate into main.`;
          return ctx.done(summary, {
            state: "needs-owner",
            summary,
            evidence: invalid.map(
              ({ fix, state, mergeStatus }) =>
                `pull-request:${fix.pullRequestId}:${state}/${mergeStatus}`,
            ),
          });
        }
        const open = states.filter(({ state }) => state === "active");
        const unverifiedDrafts = open.filter(({ isDraft }) => isDraft);
        if (unverifiedDrafts.length) {
          return completeCampaignObservation(
            ctx,
            composed.receipt,
            `Campaign run ${prior.runId} passed integration, but ${unverifiedDrafts.length} focused PR(s) remain draft until their exact current heads pass live verification.`,
            [
              `pipeline-run:${prior.runId}`,
              "campaign-result:passed",
              ...unverifiedDrafts.map(
                ({ fix }) =>
                  `exact-pr-head-verification-required:${fix.pullRequestId}@${fix.sourceCommit}`,
              ),
            ],
          );
        }
        if (open.length) {
          await notifyCampaignReady(
            ctx,
            composed.receipt,
            prior.runId,
            open.map(({ fix }) => fix.pullRequestId),
          );
          return completeCampaignObservation(
            ctx,
            composed.receipt,
            `Campaign run ${prior.runId} passed. The repair loop may now wait for its ${open.length} focused PR(s) to merge into main.`,
            [
              `pipeline-run:${prior.runId}`,
              "campaign-result:passed",
              ...open.map(
                ({ fix }) => `awaiting-pull-request:${fix.pullRequestId}`,
              ),
            ],
          );
        }
        return queueCycle(
          ctx,
          repoDir,
          payload,
          sourceBranch,
          resolveCurrentMain(repoDir),
          scheduledPurpose,
          composed.receipt,
          prior.runId,
        );
      }

      const currentMainCommit = resolveCurrentMain(repoDir);

      if (completedCycleState(result) === "converged") {
        if (prior.sourceCommit !== currentMainCommit) {
          return queueCycle(
            ctx,
            repoDir,
            payload,
            sourceBranch,
            currentMainCommit,
            scheduledPurpose,
            readCampaignReceipt(appDir),
            prior.runId,
          );
        }
        const campaign = readCampaignReceipt(appDir);
        if (campaign) {
          await notifyCampaignTasks(ctx, campaign, {
            reason: "master-validation-main-passed",
            runId: prior.runId,
            sourceCommit: prior.sourceCommit,
          });
        }
        const cleanupEvidence = campaign
          ? clearCampaign(appDir, repoDir, campaign)
          : [];
        const age = Date.now() - Date.parse(prior.queuedAt);
        if (age >= cycleIntervalMs - 60_000) {
          return queueCycle(
            ctx,
            repoDir,
            payload,
            sourceBranch,
            currentMainCommit,
            scheduledPurpose,
            null,
          );
        }
        const summary = `Master validation run ${prior.runId} passed on current ${sourceBranch}@${prior.sourceCommit}; the standing health task is green until the next six-hour cycle.`;
        return ctx.done(summary, {
          state: "converged",
          summary,
          evidence: [
            `pipeline-run:${prior.runId}`,
            "pipeline-result:succeeded",
            `source-commit:${prior.sourceCommit}`,
            `queued-at:${prior.queuedAt}`,
            ...cleanupEvidence,
          ],
          actions: [],
        });
      }

      const existingCampaign = readCampaignReceipt(appDir);
      const matchingCampaign =
        existingCampaign?.baselineRunId === prior.runId
          ? existingCampaign
          : null;
      const transition = scheduledFailureTransition(
        prior.sourceCommit,
        currentMainCommit,
        activeCampaignFixes(repoDir, prior.sourceCommit),
      );
      if (transition.kind === "current-main") {
        return queueCycle(
          ctx,
          repoDir,
          payload,
          sourceBranch,
          currentMainCommit,
          scheduledPurpose,
          null,
          prior.runId,
        );
      }
      if (transition.kind === "current-main-successor") {
        const campaignSeed: CampaignReceipt = matchingCampaign ?? {
          schemaVersion: "1",
          baselineRunId: prior.runId,
          baseCommit: prior.sourceCommit,
          branch: `validation/master-validation-${prior.runId}`,
          currentCommit: prior.sourceCommit,
          integratedFixes: [],
          updatedAt: prior.queuedAt,
        };
        const successor = composeFrozenCampaign({
          appDir,
          repoDir,
          ...currentMainCampaignSuccessorInput(
            campaignSeed,
            currentMainCommit,
            transition.fixes,
          ),
          prior: null,
        }).receipt;
        return queueCycle(
          ctx,
          repoDir,
          payload,
          successor.branch,
          successor.currentCommit,
          campaignPurpose,
          successor,
          prior.runId,
        );
      }
      const campaign = composeFrozenCampaign({
        appDir,
        repoDir,
        baselineRunId: prior.runId,
        baseCommit: prior.sourceCommit,
        fixes: transition.fixes,
        replacementFixes: completedCampaignReplacements(
          repoDir,
          matchingCampaign,
        ),
        prior: matchingCampaign,
      }).receipt;
      if (campaign.currentCommit !== campaign.baseCommit) {
        return queueCycle(
          ctx,
          repoDir,
          payload,
          campaign.branch,
          campaign.currentCommit,
          campaignPurpose,
          campaign,
          prior.runId,
        );
      }
      return completeCampaignObservation(
        ctx,
        campaign,
        `Main run ${prior.runId} failed at frozen commit ${prior.sourceCommit}. The campaign branch is ready and will run as soon as a focused repair PR is available.`,
        [
          `pipeline-run:${prior.runId}`,
          `pipeline-result:${result}`,
          `pending-main:${currentMainCommit}`,
        ],
      );
    }

    return queueCycle(
      ctx,
      repoDir,
      payload,
      sourceBranch,
      resolveCurrentMain(repoDir),
      scheduledPurpose,
      null,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const patchConflict = campaignPatchConflict(message);
    if (patchConflict) {
      return await campaignPatchConflictWait(
        ctx,
        patchConflict,
        message,
        appDir,
        repoDir,
      );
    }
    if (transientMasterValidationAccessFailure(message)) {
      const summary = `Master validation cycle hit a transient Azure DevOps access failure while queueing or observing its run: ${message}. Wait for the next master-validation reconcile pulse before retrying instead of sending repeated blind owner retries.`;
      return completeTransientAccessObservation(ctx, appDir, summary, message);
    }
    const summary = `Master validation cycle could not queue or observe its run: ${message}`;
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

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
  ProjectAppConditionSpec,
  WorkflowContext,
  WorkflowResult,
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

type FixVerificationTrigger = {
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

function triggerEvent(raw: string): Record<string, unknown> {
  for (const marker of ["## Trigger Event", "## Trigger Observation"]) {
    const markerAt = raw.indexOf(marker);
    if (markerAt < 0) continue;
    const scoped = raw.slice(markerAt);
    const start = scoped.indexOf("{");
    if (start < 0) continue;
    let depth = 0;
    let inString = false;
    let escaping = false;
    for (let index = start; index < scoped.length; index += 1) {
      const char = scoped[index];
      if (escaping) escaping = false;
      else if (char === "\\") escaping = true;
      else if (char === '"') inString = !inString;
      if (!inString && char === "{") depth += 1;
      if (!inString && char === "}" && --depth === 0) {
        try {
          return record(JSON.parse(scoped.slice(start, index + 1)));
        } catch {
          break;
        }
      }
    }
  }
  return {};
}

export function fixVerificationTrigger(
  raw: string,
): FixVerificationTrigger | null {
  const trigger = triggerEvent(raw);
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
): WorkflowResult {
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
): WorkflowResult {
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
): WorkflowResult {
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

function resolveCurrentMain(repoDir: string): string {
  const fetched = command("git", ["fetch", "origin", sourceBranch], repoDir);
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
      comparePullRequestIds(prior.pullRequestId, fix.pullRequestId) < 0
    ) {
      latestByKey.set(key, fix);
    }
  }
  return [...latestByKey.values()].sort((left, right) =>
    comparePullRequestIds(left.pullRequestId, right.pullRequestId),
  );
}

function activeCampaignFixes(repoDir: string): CampaignFix[] {
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
          return fix ? [fix] : [];
        }),
      )
    : [];
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
): Array<{ fix: CampaignFix; state: string; mergeStatus: string }> {
  return latestCampaignFixes(campaign.integratedFixes).map((fix) => {
    const current = pullRequest(repoDir, fix.pullRequestId);
    return {
      fix,
      state: text(current.status) || "unknown",
      mergeStatus: text(current.mergeStatus) || "unknown",
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

function publishVerifiedFixes(
  ctx: WorkflowContext,
  repoDir: string,
  campaign: CampaignReceipt | null,
  trigger: FixVerificationTrigger | null,
): string[] {
  if (
    !campaign ||
    !trigger ||
    trigger.sourceBranch !== campaign.branch ||
    trigger.sourceCommit !== campaign.currentCommit
  ) {
    return [];
  }
  const included = new Set(
    campaign.integratedFixes.map((fix) => fix.pullRequestId),
  );
  const pullRequestIds = [...new Set(trigger.pullRequestIds)].filter((id) =>
    included.has(id),
  );
  const publications = pullRequestIds.map((id) => ({
    pullRequestId: id,
    ...publishPullRequest(repoDir, id),
  }));
  const evidence = publications.map((publication) => publication.evidence);
  if (!pullRequestIds.length) return evidence;
  const appDir = ctx.appDir ?? "/app/projects/aks-rp-e2e.app";
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
  ctx.dispatchEvent("message.created", {
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

function notifyCampaignTasks(
  ctx: WorkflowContext,
  campaign: CampaignReceipt,
  input: {
    reason: "master-validation-main-passed";
    runId: string;
    sourceCommit: string;
  },
): void {
  for (const taskId of new Set(
    campaign.integratedFixes
      .map((fix) => fix.taskId)
      .filter((value) => value.startsWith("domain/master-validation-failure/")),
  )) {
    ctx.dispatchEvent("project.task.tick", {
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

function notifyCampaignReady(
  ctx: WorkflowContext,
  campaign: CampaignReceipt,
  runId: string,
  pullRequestIds: string[],
): void {
  const appDir = ctx.appDir ?? "/app/projects/aks-rp-e2e.app";
  const key = `${campaign.baselineRunId}:${campaign.currentCommit}:${pullRequestIds.join(",")}`;
  const receipt = join(
    appDir,
    ".state",
    "master-validation-campaign-ready",
    `${createHash("sha256").update(key).digest("hex")}.json`,
  );
  if (existsSync(receipt)) return;
  ctx.dispatchEvent("message.created", {
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
): WorkflowResult {
  const queueClaimPath = join(
    ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
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
    registerMasterValidationRun(
      ctx.appDir ?? "/app/projects/aks-rp-e2e.app",
      runId,
    );
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

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const repoDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const appDir = ctx.appDir ?? "/app/projects/aks-rp-e2e.app";
  const payload = taskPayload(ctx.task);
  try {
    const fixPublicationEvidence = publishVerifiedFixes(
      ctx,
      repoDir,
      readCampaignReceipt(appDir),
      fixVerificationTrigger(ctx.task),
    );
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
        text(active.sourceBranch).replace(/^refs\/heads\//, "") || sourceBranch,
        text(active.sourceVersion),
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
        const composed = composeFrozenCampaign({
          appDir,
          repoDir,
          baselineRunId: campaign.baselineRunId,
          baseCommit: campaign.baseCommit,
          fixes: activeCampaignFixes(repoDir),
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
        if (open.length) {
          const publicationEvidence = open.map(
            ({ fix }) =>
              publishPullRequest(repoDir, fix.pullRequestId).evidence,
          );
          notifyCampaignReady(
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
              ...publicationEvidence,
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
          notifyCampaignTasks(ctx, campaign, {
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
      const campaign = composeFrozenCampaign({
        appDir,
        repoDir,
        baselineRunId: prior.runId,
        baseCommit: prior.sourceCommit,
        fixes: activeCampaignFixes(repoDir),
        replacementFixes: completedCampaignReplacements(
          repoDir,
          existingCampaign?.baselineRunId === prior.runId
            ? existingCampaign
            : null,
        ),
        prior:
          existingCampaign?.baselineRunId === prior.runId
            ? existingCampaign
            : null,
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

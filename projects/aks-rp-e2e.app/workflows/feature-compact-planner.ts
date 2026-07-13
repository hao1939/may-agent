/**
 * feature-compact-planner — generate one feature compact package and verify generated tests.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";
import {
  workflowResult,
  workflowResultVersion,
  type StructuredWorkflowResult,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  buildTaskTreeConfig,
  completeStartedAttempt,
  emitTaskCompleted,
  markAttemptStartedOnce,
} from "./default-task-worker.ts";
import { buildLoopKey } from "./single-spec-verifier.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  sourceDir,
  triggerString,
} from "./lib/workflow-input.ts";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "./lib/feature-compact-loop-store.ts";
import {
  activeWorkflowRuns,
  downloadWorkflowRunArtifacts,
  dispatchWorkflow,
  pipelinePollIntervalMs,
  pipelineRunLookupPollIntervalMs,
  newestWorkflowRun,
  resolvePipelineClient,
  sleepMs,
  waitForWorkflowRun,
  writePipelineDispatchMetadata,
  type PipelineClient,
  type PipelineRun,
} from "./lib/ado-pipelines.ts";
import type { TaskNode } from "./lib/task-tree-store.ts";
import { readTaskTree } from "./lib/task-tree-store.ts";
import type { TaskCompletionClaim } from "./lib/task-tree-tools.ts";

export const name = "feature-compact-planner";
export const description =
  "Generate and check one feature compact test package.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "feature-compact-planner-v1",
  input: {
    required: ["task.context.featureKey or compact-feature-* task id"],
    optional: [
      "task.context.capabilityId",
      "task.context.target",
      "task.context.liveParallel",
      "task.context.adoPipeline",
      "task.context.branch",
      "task.context.stateRef",
    ],
    description:
      "Generate one feature compact plan, run generated tests, and live-prove the plan through Azure DevOps Pipelines.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["subject", "status", "artifacts", "metrics", "problem", "details"],
    description:
      "Reports generated compact artifacts, local check status, live proof status, and exact repair category when not done.",
  },
};

type CommandResult = {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

type Diagnostics = {
  feature?: {
    specCount?: number;
  };
  packageStatus?: string;
  planPath?: string;
  summaryPath?: string;
  selectedSpecIds?: string[];
  metrics?: {
    specsSelected?: number;
    clustersNeeded?: number;
    baselineClusterCount?: number;
    clustersSaved?: number;
  };
  materialization?: {
    status?: string;
    runnableSpecCount?: number;
    unrunnableSpecIds?: string[];
  };
  selectionBlocker?: {
    kind?: string;
    reason?: string;
    remainingSpecIds?: string[];
    resumeCondition?: string;
  };
  liveDispatchGate?: {
    allowed?: boolean;
    reason?: string;
    packageStatus?: string;
    readySpecIds?: string[];
    excludedSpecIds?: string[];
  };
};

type CompactPlan = {
  selectedSpecIds?: string[];
};

type ProjectResult = {
  status?: string;
  target?: {
    surface?: string;
    subscriptionId?: string;
    location?: string;
  };
  planPath?: string | null;
  counts?: {
    pass?: number;
    fail?: number;
    error?: number;
    skipped?: number;
  };
  specResults?: Array<{
    specId?: string;
    status?: string;
    reason?: string;
    category?: string;
    durationMs?: number;
  }>;
};

type LiveResultProof = {
  ok: boolean;
  resultPath?: string;
  result?: ProjectResult;
  clusterEvidence?: string[];
  detail: string;
};

export const liveAksProofVersion = "live-aks-proof-v2";

const clearLiveWorkflowState = {
  lastWorkflowRunId: null,
  lastWorkflowRunUrl: null,
  lastWorkflowLoopKey: null,
  lastDispatchMetadataPath: null,
  lastLiveProofVersion: null,
};

const clearLiveRunState = {
  lastWorkflowRunId: null,
  lastWorkflowRunUrl: null,
  lastLiveProofVersion: null,
};

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function contextString(task: TaskNode, key: string, fallback = ""): string {
  const value = taskContext(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function contextNumber(task: TaskNode, key: string, fallback: number): number {
  const value = taskContext(task)[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function pipelineNameContext(task: TaskNode, fallback: string): string {
  return (
    contextString(task, "adoPipeline", "") ||
    contextString(task, "githubWorkflow", fallback)
  );
}

function pipelineLimitContext(task: TaskNode, fallback: number): number {
  const adoLimit = contextNumber(task, "adoActiveRunLimit", 0);
  return adoLimit > 0
    ? adoLimit
    : contextNumber(task, "githubActiveRunLimit", fallback);
}

function taskStringList(task: TaskNode, key: "outputs"): string[] {
  const value = task[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function reviewedTaskId(task: TaskNode): string {
  const reviewedTask = taskContext(task).reviewedTask;
  if (
    reviewedTask &&
    typeof reviewedTask === "object" &&
    !Array.isArray(reviewedTask)
  ) {
    const taskId = (reviewedTask as Record<string, unknown>).taskId;
    return typeof taskId === "string" ? taskId : "";
  }
  return "";
}

function compactFeatureFromOutputs(task: TaskNode): string {
  for (const output of taskStringList(task, "outputs")) {
    const match = output.match(/^features\/([^/]+)\/compact\//);
    if (match?.[1]) return match[1];
  }
  return "";
}

function compactFeatureFromTaskId(taskId: string): string {
  if (!taskId.startsWith("compact-feature-")) return "";
  return taskId
    .slice("compact-feature-".length)
    .replace(/-retry-\d{12,}-\d+(?:-.+)?$/, "")
    .replace(/-(?:followup|blocked|escalate)(?:-\d+)?$/, "");
}

function featureCompactIdentity(task: TaskNode): {
  featureKey: string;
  capabilityId: string;
} {
  const explicitFeatureKey = contextString(task, "featureKey");
  const explicitCapabilityId = contextString(
    task,
    "capabilityId",
    explicitFeatureKey,
  );
  const outputCapabilityId = compactFeatureFromOutputs(task);
  const reviewedFeatureKey = compactFeatureFromTaskId(reviewedTaskId(task));
  const ownFeatureKey = compactFeatureFromTaskId(task.id);
  const featureKey =
    explicitFeatureKey ||
    outputCapabilityId ||
    reviewedFeatureKey ||
    ownFeatureKey;
  const capabilityId = explicitCapabilityId || outputCapabilityId || featureKey;
  return { featureKey, capabilityId };
}

function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs: number,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    env: process.env,
    timeout: timeoutMs,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function appRelative(appDir: string, path: string): string {
  const rel = relative(appDir, path);
  return rel && !rel.startsWith("..") ? rel : path;
}

function findFiles(root: string, name: string): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) found.push(...findFiles(path, name));
    else if (entry === name) found.push(path);
  }
  return found;
}

function findAllFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) found.push(...findAllFiles(path));
    else found.push(path);
  }
  return found;
}

function clusterEvidenceFromArtifactDir(
  appDir: string,
  artifactDir: string,
): string[] {
  const evidence: string[] = [];
  for (const file of findAllFiles(artifactDir)) {
    const rel = appRelative(appDir, file);
    if (/\/shared-clusters\/[^/]+\.json$/i.test(rel)) {
      const record = readJson<Record<string, unknown> | null>(file, null);
      if (sharedClusterRecordProvesLiveAks(record)) {
        evidence.push(rel);
      }
      continue;
    }
    if (!/\.(jsonl|log|txt|md)$/i.test(file)) continue;
    let text = "";
    try {
      text = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    if (
      /setup\.resource-group-created|resource-group-created|create resource group|resource group created|creating cluster|cluster-created|shared-cluster\.(create|ready)|cluster create succeeded|managed cluster create succeeded|cleanup\.resource-group-deleted|cleanup-resource-group|requested deletion of rg-/i.test(
        text,
      )
    ) {
      evidence.push(rel);
    }
  }
  return [...new Set(evidence)].sort();
}

function sharedClusterRecordProvesLiveAks(
  record: Record<string, unknown> | null,
): boolean {
  if (!record?.resourceGroup || !record?.clusterName) return false;
  const cleanupStatus = String(record.cleanupStatus || "");
  const note = String(record.note || "");
  return (
    Boolean(record.cleanupStartedAt || record.cleanupReason) ||
    /^(delete-started|deleted|delete-failed)$/i.test(cleanupStatus) ||
    /Shared AKS cluster fixture is ready/i.test(note)
  );
}

function validateLiveResult(input: {
  result: ProjectResult | null;
  resultPath: string;
  planRel: string;
  clusterEvidence: string[];
}): LiveResultProof {
  const result = input.result;
  if (!result) {
    return {
      ok: false,
      resultPath: input.resultPath,
      detail: `No parseable result.json was found at ${input.resultPath}.`,
    };
  }
  const surface = String(result.target?.surface || "");
  const status = String(result.status || "");
  const specResults = Array.isArray(result.specResults)
    ? result.specResults
    : [];
  const passCount =
    Number(result.counts?.pass || 0) ||
    specResults.filter((item) => item?.status === "pass").length;
  const failCount = Number(result.counts?.fail || 0);
  const errorCount = Number(result.counts?.error || 0);
  const resultPlanPath = String(result.planPath || "");
  if (resultPlanPath && resultPlanPath !== input.planRel) {
    return {
      ok: false,
      resultPath: input.resultPath,
      result,
      detail: `Azure DevOps artifact result plan ${resultPlanPath} does not match compact plan ${input.planRel}.`,
    };
  }
  if (surface !== "live-azure-run") {
    return {
      ok: false,
      resultPath: input.resultPath,
      result,
      detail: `Azure DevOps artifact result surface is ${surface || "(missing)"}, not live-azure-run.`,
    };
  }
  if (status !== "passed") {
    return {
      ok: false,
      resultPath: input.resultPath,
      result,
      detail: `Azure DevOps artifact live result status is ${status || "(missing)"}, not passed.`,
    };
  }
  if (specResults.length === 0 || passCount < 1) {
    return {
      ok: false,
      resultPath: input.resultPath,
      result,
      detail: "Azure DevOps artifact live result has no passing spec result.",
    };
  }
  if (failCount || errorCount) {
    return {
      ok: false,
      resultPath: input.resultPath,
      result,
      detail: `Azure DevOps artifact live result has fail/error counts: fail=${failCount} error=${errorCount}.`,
    };
  }
  const checkOnlyPass = specResults.find((item) =>
    /without Azure resource changes|no Azure resource changes (?:were )?attempted|without cloud mutation|no cloud mutation/i.test(
      String(item?.reason || ""),
    ),
  );
  if (checkOnlyPass?.specId) {
    return {
      ok: false,
      resultPath: input.resultPath,
      result,
      clusterEvidence: input.clusterEvidence,
      detail: `Azure DevOps artifact live result includes check-only pass for ${checkOnlyPass.specId}; live compact proof requires real Azure resource changes.`,
    };
  }
  if (input.clusterEvidence.length === 0) {
    return {
      ok: false,
      resultPath: input.resultPath,
      result,
      clusterEvidence: input.clusterEvidence,
      detail:
        "Azure DevOps artifact live result has no AKS cluster creation evidence.",
    };
  }
  return {
    ok: true,
    resultPath: input.resultPath,
    result,
    clusterEvidence: input.clusterEvidence,
    detail: `Azure DevOps artifact proves live Azure pass with ${passCount} passing spec result(s) and AKS cluster evidence.`,
  };
}

export function capacityPreflightReason(proof: LiveResultProof): string | null {
  const result = proof.result;
  if (!result) return null;
  const specResults = Array.isArray(result.specResults)
    ? result.specResults
    : [];
  const text = [
    result.status,
    proof.detail,
    ...specResults.flatMap((item) => [item.status, item.category, item.reason]),
  ]
    .filter(Boolean)
    .join("\n");
  if (
    !/capacity preflight|managed clusters|cluster create slots|concurrent new cluster|quota|capacity/i.test(
      text,
    )
  ) {
    return null;
  }
  if (
    specResults.length > 0 &&
    specResults.every((item) => item.category === "environment_blocker")
  ) {
    return (
      specResults.find((item) => item.reason)?.reason ??
      "Live workflow was blocked by staging AKS capacity preflight."
    );
  }
  return /capacity preflight|managed clusters|cluster create slots/i.test(text)
    ? "Live workflow was blocked by staging AKS capacity preflight."
    : null;
}

export function inspectLiveWorkflowArtifacts(input: {
  client: PipelineClient;
  projectDir: string;
  appDir: string;
  runId: string;
  featureKey: string;
  planRel: string;
}): LiveResultProof {
  const artifactDir = join(
    input.appDir,
    ".state",
    "feature-compact-loop",
    "artifacts",
    input.runId,
  );
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(artifactDir, { recursive: true });
  const download = downloadWorkflowRunArtifacts({
    client: input.client,
    projectDir: input.projectDir,
    artifactDir,
    runId: input.runId,
  });
  if (!download.ok) {
    return {
      ok: false,
      detail: `Azure DevOps artifact download failed: ${download.stderr || download.stdout || download.error || "unknown error"}`,
    };
  }
  const clusterEvidence = clusterEvidenceFromArtifactDir(
    input.appDir,
    artifactDir,
  );
  const resultPaths = findFiles(artifactDir, "result.json")
    .filter(
      (path) => !/\/artifacts\/[^/]+\/spec-runner\/result\.json$/i.test(path),
    )
    .sort((a, b) => a.localeCompare(b));
  const candidates = resultPaths
    .map((path) => ({
      path,
      result: readJson<ProjectResult | null>(path, null),
    }))
    .filter(({ result }) => {
      const planPath = String(result?.planPath || "");
      return !planPath || planPath === input.planRel;
    });
  for (const candidate of candidates) {
    const proof = validateLiveResult({
      result: candidate.result,
      resultPath: appRelative(input.appDir, candidate.path),
      planRel: input.planRel,
      clusterEvidence,
    });
    if (proof.ok) return proof;
  }
  const first = candidates[0] ?? resultPaths[0];
  if (typeof first === "string") {
    return validateLiveResult({
      result: readJson<ProjectResult | null>(first, null),
      resultPath: appRelative(input.appDir, first),
      planRel: input.planRel,
      clusterEvidence,
    });
  }
  if (first) {
    return validateLiveResult({
      result: first.result,
      resultPath: appRelative(input.appDir, first.path),
      planRel: input.planRel,
      clusterEvidence,
    });
  }
  return {
    ok: false,
    detail: `No top-level result.json was found in Azure DevOps artifacts for compact feature ${input.featureKey}.`,
  };
}

function firstOutputMatch(output: string, pattern: RegExp): string | null {
  return output.match(pattern)?.[1] ?? null;
}

function tail(value: string, max = 1800): string {
  const normalized = value.trim();
  return normalized.length <= max
    ? normalized
    : normalized.slice(normalized.length - max);
}

function commandSummary(command: string, result: CommandResult): string {
  const pieces = [
    `${command} exited ${result.status ?? "unknown"}`,
    result.error ? `error: ${result.error}` : "",
    result.stderr ? `stderr: ${tail(result.stderr)}` : "",
    result.stdout ? `stdout: ${tail(result.stdout)}` : "",
  ].filter(Boolean);
  return pieces.join("\n");
}

function compactCoverageProblem(input: {
  diagnostics: Diagnostics;
  expectedSpecCount: number;
}): string | null {
  const maintainedSpecCount =
    input.diagnostics.feature?.specCount ?? input.expectedSpecCount;
  const selected =
    input.diagnostics.metrics?.specsSelected ??
    input.diagnostics.selectedSpecIds?.length;
  if (selected !== maintainedSpecCount) {
    return `Compact package selected ${selected ?? "unknown"} of ${maintainedSpecCount} feature spec(s).`;
  }
  const unrunnable = input.diagnostics.materialization?.unrunnableSpecIds ?? [];
  if (unrunnable.length > 0) {
    return `Compact package has ${unrunnable.length} unrunnable spec(s): ${unrunnable.join(", ")}.`;
  }
  if (
    input.diagnostics.materialization?.status &&
    input.diagnostics.materialization.status !== "ready"
  ) {
    return `Compact package materialization status is ${input.diagnostics.materialization.status}.`;
  }
  const runnable = input.diagnostics.materialization?.runnableSpecCount;
  if (runnable !== undefined && runnable !== maintainedSpecCount) {
    return `Compact package materialized ${runnable} runnable spec(s), expected ${maintainedSpecCount}.`;
  }
  return null;
}

function blockerSummaryFragment(diagnostics: Diagnostics): string {
  const kind = diagnostics.selectionBlocker?.kind?.trim();
  const reason = diagnostics.selectionBlocker?.reason?.trim();
  const gateReason = diagnostics.liveDispatchGate?.reason?.trim();
  const remaining = diagnostics.selectionBlocker?.remainingSpecIds?.filter(
    (specId): specId is string =>
      typeof specId === "string" && specId.trim().length > 0,
  );

  const pieces = [
    kind ? `Exact blocker: ${kind}.` : "",
    reason ? `Reason: ${reason}` : "",
    gateReason ? `Live dispatch gate: ${gateReason}` : "",
    remaining?.length
      ? `Affected member${remaining.length === 1 ? "" : "s"}: ${remaining.join(", ")}.`
      : "",
  ].filter(Boolean);

  return pieces.join(" ");
}

function blockerRetryReason(diagnostics: Diagnostics): string {
  const resumeCondition = diagnostics.selectionBlocker?.resumeCondition?.trim();
  const gateReason = diagnostics.liveDispatchGate?.reason?.trim();
  const reason = diagnostics.selectionBlocker?.reason?.trim();
  return (
    resumeCondition ||
    gateReason ||
    reason ||
    "Compact package is not ready; rerun only after excluded or quarantined members are repaired, promoted, or reclassified."
  );
}

function selectedSpecIdsForPlan(projectDir: string, planRel: string): string[] {
  const plan = readJson<CompactPlan | null>(join(projectDir, planRel), null);
  return Array.isArray(plan?.selectedSpecIds)
    ? plan.selectedSpecIds.filter(
        (specId): specId is string =>
          typeof specId === "string" && specId.trim().length > 0,
      )
    : [];
}

function checkCompactLivePolicy(input: {
  projectDir: string;
  planRel: string;
  diagnostics: Diagnostics;
  specIds?: string[];
}): CommandResult {
  const selectedSpecIds = (input.specIds?.length
    ? input.specIds
    : [
        ...new Set([
          ...(input.diagnostics.selectedSpecIds ?? []),
          ...selectedSpecIdsForPlan(input.projectDir, input.planRel),
        ]),
      ]
  ).filter((specId) => specId.trim().length > 0);

  if (selectedSpecIds.length === 0) {
    return {
      ok: false,
      status: 1,
      stdout: "",
      stderr:
        "Compact live policy failed: generated plan has no selectedSpecIds to validate before live dispatch.",
    };
  }

  const scripts = [
    "check-private-source-policy.ts",
    "check-live-admission.ts",
  ].filter((script) => existsSync(join(input.projectDir, "runner", script)));
  for (const script of scripts) {
    const result = runCommand(
      input.projectDir,
      "bun",
      [`runner/${script}`, "--specs", selectedSpecIds.join(",")],
      120_000,
    );
    if (result.ok) continue;
    return {
      ...result,
      stderr: [
        `Compact live policy script failed: runner/${script}`,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return {
    ok: true,
    status: 0,
    stdout: `Compact live policy passed for ${selectedSpecIds.length} selected spec(s).`,
    stderr: "",
  };
}

function workflowRunMatches(input: {
  run: PipelineRun;
  loopKey: string;
  planPath: string;
  capabilityId: string;
}): boolean {
  const title = String(input.run.displayTitle ?? "");
  if (!title) return false;
  return (
    title.includes(input.loopKey) ||
    title.includes(input.planPath) ||
    title.includes(input.capabilityId)
  );
}

function isUnexpectedMetadataDispatchError(result: CommandResult): boolean {
  const detail = `${result.stderr}\n${result.stdout}\n${result.error ?? ""}`;
  return (
    (result.status === 422 || /"status"\s*:\s*"?422"?/i.test(detail)) &&
    /unexpected inputs provided/i.test(detail) &&
    /(loop_key|metadata)/i.test(detail)
  );
}

function compactDispatchInputs(input: {
  target: string;
  planPath: string;
  specIds?: string[];
  parallel: number;
  testTimeoutSeconds: number;
  loopKey: string;
  includeMetadata: boolean;
}): Record<string, string> {
  return {
    target: input.target,
    plan_path: input.planPath,
    ...(input.specIds?.length ? { specs: input.specIds.join(",") } : {}),
    parallel: String(input.parallel),
    test_timeout_seconds: String(input.testTimeoutSeconds),
    ...(input.includeMetadata
      ? { metadata: JSON.stringify({ loop_key: input.loopKey }) }
      : {}),
  };
}

async function waitForDispatchCapacity(input: {
  client: PipelineClient;
  projectDir: string;
  branch: string;
  limit: number;
  timeoutMinutes: number;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (!Number.isFinite(input.limit) || input.limit <= 0) {
    return { ok: true };
  }
  const deadline = Date.now() + Math.max(1, input.timeoutMinutes) * 60_000;
  let lastCount = 0;
  while (Date.now() <= deadline) {
    const active = activeWorkflowRuns({
      client: input.client,
      projectDir: input.projectDir,
      branch: input.branch,
    });
    lastCount = active.length;
    if (active.length < input.limit) return { ok: true };
    await sleepMs(pipelinePollIntervalMs());
  }
  return {
    ok: false,
    detail: `Azure DevOps live dispatch capacity did not open: ${lastCount}/${input.limit} pipeline run(s) still in progress on ${input.branch}.`,
  };
}

function dispatchMetadataPath(input: {
  appDir: string;
  taskId: string;
  attemptId: string;
}): string {
  return join(
    input.appDir,
    ".state",
    "feature-compact-loop",
    "dispatches",
    input.taskId,
    `${input.attemptId}.json`,
  );
}

function compactDispatchMetadata(input: {
  dispatchedAt: string;
  workflow: string;
  branch: string;
  target: string;
  planPath: string;
  specIds?: string[];
  parallel: number;
  testTimeoutSeconds: number;
  loopKey: string;
  taskId: string;
  attemptId: string;
  capabilityId: string;
  includeMetadata: boolean;
  dispatch: CommandResult;
}): {
  dispatchedAt: string;
  workflow: string;
  branch: string;
  inputs: Record<string, string>;
  loopKey: string;
  taskId: string;
  attemptId: string;
  planPath: string;
  specIds: string[];
  capabilityId: string;
  dispatchResult: CommandResult;
} {
  return {
    dispatchedAt: input.dispatchedAt,
    workflow: input.workflow,
    branch: input.branch,
    inputs: compactDispatchInputs({
      target: input.target,
      planPath: input.planPath,
      specIds: input.specIds,
      parallel: input.parallel,
      testTimeoutSeconds: input.testTimeoutSeconds,
      loopKey: input.loopKey,
      includeMetadata: input.includeMetadata,
    }),
    loopKey: input.loopKey,
    taskId: input.taskId,
    attemptId: input.attemptId,
    planPath: input.planPath,
    specIds: input.specIds ?? [],
    capabilityId: input.capabilityId,
    dispatchResult: input.dispatch,
  };
}

function completion(
  ctx: WorkflowContext,
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    task: TaskNode;
    attemptId: string;
    claim: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
    problem?: {
      action: "none" | "request";
      category?: string;
      diagnosis?: string;
      resumeCondition?: string;
    };
    workflowResult?: StructuredWorkflowResult;
  },
): WorkflowResult {
  const completed = completeStartedAttempt(config, {
    taskId: input.task.id,
    attemptId: input.attemptId,
    claim: input.claim,
    summary: input.summary,
  });
  if (completed.ok) {
    emitTaskCompleted(ctx, completed.task, {
      attemptId: input.attemptId,
      result: input.claim,
      summary: input.summary,
      evidence: input.evidence,
      problem: input.problem,
      workflowResult:
        input.workflowResult ?? featureCompactResult(input.task, input),
    });
  }
  return ctx.done(input.summary);
}

function featureCompactResult(
  task: TaskNode,
  input: {
    claim: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
    problem?: {
      action: "none" | "request";
      category?: string;
      diagnosis?: string;
      resumeCondition?: string;
    };
  },
): StructuredWorkflowResult {
  const { featureKey, capabilityId } = featureCompactIdentity(task);
  const target = contextString(task, "target", "staging");
  const problem =
    input.problem?.action === "request" && input.problem.category
      ? {
          category: input.problem.category,
          diagnosis: input.problem.diagnosis ?? input.summary,
          resumeCondition: input.problem.resumeCondition,
        }
      : null;
  return workflowResult({
    workflow: name,
    workflowVersion: workflowContract.version,
    subject: {
      kind: "compact",
      id: featureKey || task.id,
      capabilityId: capabilityId || featureKey || null,
    },
    status: input.claim === "done" ? "done" : problem ? "partial" : "partial",
    summary: input.summary,
    artifacts: input.evidence?.filter(Boolean),
    problem,
    inputFingerprint: {
      featureKey,
      capabilityId,
      target,
    },
    details: {
      target,
      taskClaim: input.claim,
    },
  });
}

function pipelineWaitSchedule(input: {
  runId: string;
  runUrl: string | null;
  pipeline: string;
  branch: string;
  target: string;
  loopKey: string;
  waitTimeoutMinutes: number;
  existingFallbackAt?: string | null;
}): {
  waitingFor: Record<string, unknown>;
  waitingCondition: string;
  observedBy: Record<string, unknown>;
  observationMethod: string;
  nextCheckAt: string;
  fallbackAt: string;
  fallbackAction: string;
  resumeAction: string;
  blockerOwner: string;
  lastCheckedAt: string;
} {
  const nowMs = Date.now();
  const nextCheckAt = new Date(nowMs + 10 * 60 * 1000).toISOString();
  const existingFallbackMs = input.existingFallbackAt
    ? Date.parse(input.existingFallbackAt)
    : NaN;
  const fallbackAt = Number.isFinite(existingFallbackMs)
    ? new Date(existingFallbackMs).toISOString()
    : new Date(nowMs + input.waitTimeoutMinutes * 60 * 1000).toISOString();
  return {
    waitingFor: {
      type: "ado.pipeline_run.completed",
      runId: input.runId,
      runUrl: input.runUrl,
      pipeline: input.pipeline,
      branch: input.branch,
      target: input.target,
      loopKey: input.loopKey,
      successCriteria:
        "Run completed and uploaded a passing live compact result artifact.",
    },
    waitingCondition: `Azure DevOps pipeline run ${input.runId} completes and uploads a live compact result artifact.`,
    observedBy: {
      workflow: "feature-compact-loop-controller",
      trigger: "project.task.tick",
    },
    observationMethod:
      "Poll Azure DevOps pipeline run status and inspect compact result artifacts.",
    nextCheckAt,
    fallbackAt,
    fallbackAction:
      "If the run is still unavailable, still running, or missing artifacts, create compact pipeline diagnosis or escalation work.",
    resumeAction:
      "When the run is terminal, inspect result artifacts and update the compact feature to pass, repair, exact wait, or error.",
    blockerOwner: "feature-compact-loop-controller",
    lastCheckedAt: new Date(nowMs).toISOString(),
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  sourceDir(ctx.task);
  const trigger = parseTriggerEvent(ctx.task);
  const config = buildTaskTreeConfig(
    ctx,
    appDir,
    projectDir,
    maxConcurrent(ctx.task, trigger),
  );

  if (trigger?.type !== "project.task.assigned") {
    return ctx.done(
      `Feature compact planner ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.assigned.`,
    );
  }

  const taskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    field(ctx.task, "taskId");
  const attemptId =
    triggerString(trigger, "attemptId") || triggerString(trigger, "attempt_id");
  if (!taskId || !attemptId) {
    return ctx.done("Feature compact planner requires taskId and attemptId.");
  }

  const start = markAttemptStartedOnce(config, { taskId, attemptId });
  if (start.ok === false) return ctx.done(start.reason);
  const task = start.task;
  const { featureKey, capabilityId } = featureCompactIdentity(task);
  const target = contextString(task, "target", "staging");
  const stateRef = contextString(
    task,
    "stateRef",
    defaultFeatureCompactLoopStatePath(appDir),
  );
  const loopTaskId = contextString(
    task,
    "loopTaskId",
    "aks-feature-compact-loop",
  );
  const checkParallel = contextNumber(task, "checkParallel", 50);
  const liveParallel = contextNumber(task, "liveParallel", checkParallel);
  const workflow = pipelineNameContext(task, "ado-pipeline-467665");
  const branch = contextString(task, "branch", "dev");
  const testTimeoutSeconds = contextNumber(task, "testTimeoutSeconds", 7200);
  const githubWaitTimeoutMinutes = contextNumber(
    task,
    "githubWaitTimeoutMinutes",
    720,
  );
  const attemptNumber = contextNumber(task, "attemptNumber", 0);
  const statePath = stateRef.startsWith("/")
    ? stateRef
    : join(appDir, stateRef);
  const { state } = loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 1,
    statePath,
    featureKeys: featureKey ? [featureKey] : undefined,
    refreshFromProject: false,
  });

  if (!featureKey || !capabilityId) {
    const summary = `Task ${task.id} is missing featureKey or capabilityId.`;
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      problem: {
        action: "request",
        category: "feature-compact-task-input",
        diagnosis: summary,
      },
    });
  }

  updateFeatureCompactItem(state, featureKey, {
    status: "running",
    taskId: task.id,
    attempts: Math.max(
      state.features[featureKey]?.attempts ?? 0,
      attemptNumber || (state.features[featureKey]?.attempts ?? 0) + 1,
    ),
    activeAttemptId: attemptId,
    activeTaskSessionId:
      typeof task.session_id === "string" && task.session_id.trim()
        ? task.session_id.trim()
        : null,
    activeWorkflowRunId: null,
    heartbeatAt: new Date().toISOString(),
  });
  saveFeatureCompactLoopState(statePath, state);

  const generate = runCommand(
    projectDir,
    "bun",
    ["runner/feature-compact.ts", capabilityId, "--target", target, "--check"],
    600_000,
  );
  if (!generate.ok) {
    const summary = `Feature compact package generation failed for ${featureKey}. ${commandSummary("bun runner/feature-compact.ts", generate)}`;
    const blocked = generate.stderr.includes("No feature-owned specs");
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      retryable: blocked ? false : true,
      retryReason: blocked
        ? "No feature-owned specs are available for this compact package."
        : null,
      ...clearLiveWorkflowState,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      problem: blocked
        ? {
            action: "request",
            category: "feature-compact-external-blocker",
            diagnosis: summary,
            resumeCondition:
              "Add feature-owned specs or remove this feature from the compact loop.",
          }
        : {
            action: "request",
            category: "feature-compact-generation",
            diagnosis: summary,
          },
    });
  }

  const diagnosticsRel =
    firstOutputMatch(
      generate.stdout,
      /\[feature-compact\] diagnostics=(\S+)/,
    ) ?? `features/${capabilityId}/compact/${target}.diagnostics.json`;
  const diagnosticsPath = join(projectDir, diagnosticsRel);
  const diagnostics = readJson<Diagnostics>(diagnosticsPath, {});
  const planRel =
    diagnostics.planPath ||
    firstOutputMatch(generate.stdout, /\[feature-compact\] plan=(\S+)/) ||
    `features/${capabilityId}/compact/${target}.plan.json`;
  const summaryRel =
    diagnostics.summaryPath ||
    firstOutputMatch(generate.stdout, /\[feature-compact\] summary=(\S+)/) ||
    `features/${capabilityId}/compact/${target}.summary.md`;

  if (!existsSync(join(projectDir, planRel))) {
    const summary = `Feature compact package generation for ${featureKey} did not write ${planRel}.`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      ...clearLiveWorkflowState,
      lastDiagnosticsPath: diagnosticsRel,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [diagnosticsRel],
      problem: {
        action: "request",
        category: "feature-compact-generation",
        diagnosis: summary,
      },
    });
  }

  const coverageProblem = compactCoverageProblem({
    diagnostics,
    expectedSpecCount:
      contextNumber(task, "specCount", 0) ||
      diagnostics.feature?.specCount ||
      diagnostics.metrics?.specsSelected ||
      diagnostics.selectedSpecIds?.length ||
      0,
  });
  if (coverageProblem) {
    const summary = `Feature compact package is incomplete for ${featureKey}. ${coverageProblem} Plan: ${planRel}. Diagnostics: ${diagnosticsRel}.`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      retryable: false,
      retryReason:
        "Compact package coverage is incomplete; rerun only after coverage is repaired.",
      ...clearLiveWorkflowState,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [planRel, summaryRel, diagnosticsRel],
      problem: {
        action: "request",
        category: "feature-compact-coverage",
        diagnosis: summary,
      },
    });
  }

  const check = runCommand(
    projectDir,
    "bun",
    ["run", "execute", planRel, "--check", `--parallel=${checkParallel}`],
    900_000,
  );
  const combinedCheckOutput = `${check.stdout}\n${check.stderr}`;
  const resultPath = firstOutputMatch(
    combinedCheckOutput,
    /\[test-executor\] test-result=(\S+)/,
  );
  if (!check.ok) {
    const summary = `Generated tests failed for ${featureKey}. ${commandSummary("bun run execute --check", check)}`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      retryable: true,
      retryReason: null,
      ...clearLiveWorkflowState,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [planRel, summaryRel, diagnosticsRel].filter(Boolean),
      problem: {
        action: "request",
        category: "feature-compact-local-check",
        diagnosis: summary,
      },
    });
  }

  const partialReadySpecIds =
    diagnostics.packageStatus && diagnostics.packageStatus !== "ready"
      ? (diagnostics.liveDispatchGate?.readySpecIds ?? []).filter(
          (specId): specId is string =>
            typeof specId === "string" && specId.trim().length > 0,
        )
      : [];
  const partialResumeCondition =
    diagnostics.selectionBlocker?.resumeCondition?.trim() ||
    "Regenerate the compact package only after excluded or quarantined members are repaired, promoted, or reclassified so packageStatus becomes ready.";
  const partialBlockerSummary = diagnostics.packageStatus
    ? blockerSummaryFragment(diagnostics)
    : "";
  const partialRetryReason = diagnostics.packageStatus
    ? blockerRetryReason(diagnostics)
    : "";

  if (
    diagnostics.packageStatus &&
    diagnostics.packageStatus !== "ready" &&
    partialReadySpecIds.length === 0
  ) {
    const blockerSummary = blockerSummaryFragment(diagnostics);
    const retryReason = blockerRetryReason(diagnostics);
    const summary = [
      `Feature compact package for ${featureKey} is ${diagnostics.packageStatus}.`,
      blockerSummary,
      `Plan: ${planRel}.`,
      `Summary: ${summaryRel}.`,
      `Diagnostics: ${diagnosticsRel}.`,
      resultPath ? `Check result: ${resultPath}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      retryable: false,
      retryReason,
      ...clearLiveWorkflowState,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [planRel, summaryRel, diagnosticsRel, resultPath ?? ""].filter(
        Boolean,
      ),
      problem: {
        action: "request",
        category: "feature-compact-package-status",
        diagnosis: summary,
        resumeCondition: partialResumeCondition,
      },
    });
  }

  const livePolicy = checkCompactLivePolicy({
    projectDir,
    planRel,
    diagnostics,
    specIds: partialReadySpecIds,
  });
  if (!livePolicy.ok) {
    const summary = [
      `Feature compact live policy failed for ${featureKey}; Azure DevOps pipeline dispatch skipped.`,
      `Plan: ${planRel}.`,
      `Summary: ${summaryRel}.`,
      `Diagnostics: ${diagnosticsRel}.`,
      resultPath ? `Check result: ${resultPath}.` : "",
      commandSummary(
        "bun runner/check-private-source-policy.ts && bun runner/check-live-admission.ts",
        livePolicy,
      ),
    ]
      .filter(Boolean)
      .join(" ");
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      retryable: true,
      retryReason:
        "Repair selected compact scenario tests so live execution is self-contained and live-admissible before retrying Azure DevOps pipeline dispatch.",
      ...clearLiveWorkflowState,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [planRel, summaryRel, diagnosticsRel, resultPath ?? ""].filter(
        Boolean,
      ),
      problem: {
        action: "request",
        category: "feature-compact-live-policy",
        diagnosis: summary,
        resumeCondition:
          "Retry only after the selected compact scenario tests pass runner/check-private-source-policy.ts and runner/check-live-admission.ts.",
      },
    });
  }

  const pipeline = resolvePipelineClient(projectDir);
  if (!pipeline.client) {
    const summary = `Unable to access Azure DevOps pipeline for ${featureKey}: ${pipeline.reason || "unknown error"}`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      ...clearLiveWorkflowState,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [planRel, summaryRel, diagnosticsRel, resultPath ?? ""].filter(
        Boolean,
      ),
      problem: {
        action: "request",
        category: "ado-pipeline-access",
        diagnosis: summary,
        resumeCondition:
          "Provide Azure DevOps CLI authentication for the AKS E2E Spec Runner pipeline.",
      },
    });
  }

  const latestTreeBeforeDispatch = readTaskTree(config);
  const loopTask = latestTreeBeforeDispatch.tasks[loopTaskId];
  const githubActiveRunLimit = loopTask
    ? pipelineLimitContext(loopTask, 6)
    : pipelineLimitContext(task, 6);
  const githubDispatchWaitTimeoutMinutes = loopTask
    ? contextNumber(
        loopTask,
        "githubDispatchWaitTimeoutMinutes",
        contextNumber(task, "githubDispatchWaitTimeoutMinutes", 120),
      )
    : contextNumber(task, "githubDispatchWaitTimeoutMinutes", 120);
  const dispatchCapacity = await waitForDispatchCapacity({
    client: pipeline.client,
    projectDir,
    branch,
    limit: githubActiveRunLimit,
    timeoutMinutes: githubDispatchWaitTimeoutMinutes,
  });
  if (dispatchCapacity.ok === false) {
    const summary = `Live compact dispatch is waiting for Azure DevOps pipeline capacity for ${featureKey}. ${dispatchCapacity.detail}`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      retryable: false,
      retryReason:
        "Azure DevOps pipeline capacity is full; retry only after active pipeline slots are available.",
      ...clearLiveRunState,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [planRel, summaryRel, diagnosticsRel, resultPath ?? ""].filter(
        Boolean,
      ),
      problem: {
        action: "request",
        category: "feature-compact-live-dispatch-capacity",
        diagnosis: summary,
        resumeCondition:
          "Retry this compact feature after active staging Azure DevOps live runs finish and cleanup frees AKS cluster slots.",
      },
    });
  }

  const startedAt = Date.now();
  const loopKey = buildLoopKey(task.id, attemptId);
  const dispatchedAt = new Date(startedAt).toISOString();
  const metadataPath = dispatchMetadataPath({
    appDir,
    taskId: task.id,
    attemptId,
  });
  let includeMetadata = true;
  let dispatch = dispatchWorkflow({
    client: pipeline.client,
    projectDir,
    workflow,
    branch,
    inputs: compactDispatchInputs({
      target,
      planPath: planRel,
      specIds: partialReadySpecIds,
      parallel: liveParallel,
      testTimeoutSeconds,
      loopKey,
      includeMetadata,
    }),
  });
  if (!dispatch.ok && isUnexpectedMetadataDispatchError(dispatch)) {
    includeMetadata = false;
    dispatch = dispatchWorkflow({
      client: pipeline.client,
      projectDir,
      workflow,
      branch,
      inputs: compactDispatchInputs({
        target,
        planPath: planRel,
        specIds: partialReadySpecIds,
        parallel: liveParallel,
        testTimeoutSeconds,
        loopKey,
        includeMetadata,
      }),
    });
  }
  writePipelineDispatchMetadata(
    metadataPath,
    compactDispatchMetadata({
      dispatchedAt,
      workflow,
      branch,
      target,
      planPath: planRel,
      specIds: partialReadySpecIds,
      parallel: liveParallel,
      testTimeoutSeconds,
      loopKey,
      taskId: task.id,
      attemptId,
      capabilityId,
      includeMetadata,
      dispatch,
    }),
  );
  updateFeatureCompactItem(state, featureKey, {
    lastWorkflowLoopKey: loopKey,
    lastDispatchMetadataPath: metadataPath,
    activeAttemptId: attemptId,
    activeTaskSessionId:
      typeof task.session_id === "string" && task.session_id.trim()
        ? task.session_id.trim()
        : null,
    activeWorkflowRunId: null,
    heartbeatAt: new Date().toISOString(),
  });
  saveFeatureCompactLoopState(statePath, state);
  if (!dispatch.ok) {
    const summary = `Azure DevOps live compact pipeline dispatch failed for ${featureKey}: ${dispatch.stderr || dispatch.stdout || dispatch.error}`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      ...clearLiveRunState,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastWorkflowLoopKey: loopKey,
      lastDispatchMetadataPath: metadataPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [planRel, summaryRel, diagnosticsRel, resultPath ?? ""].filter(
        Boolean,
      ),
      problem: {
        action: "request",
        category: "ado-pipeline-dispatch",
        diagnosis: summary,
        resumeCondition:
          "Fix Azure DevOps pipeline dispatch access or pipeline input schema, then retry this compact feature.",
      },
    });
  }

  let run: PipelineRun | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    run = newestWorkflowRun({
      client: pipeline.client,
      projectDir,
      workflow,
      branch,
      sinceMs: startedAt,
      match: (candidate) =>
        workflowRunMatches({
          run: candidate,
          loopKey,
          planPath: planRel,
          capabilityId,
        }),
    });
    if (run?.databaseId) break;
    await sleepMs(pipelineRunLookupPollIntervalMs());
  }

  if (!run?.databaseId) {
    const summary = `Dispatched Azure DevOps pipeline for compact feature ${featureKey}, but could not find the run id. Plan: ${planRel}. Dispatch metadata: ${metadataPath}.`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastWorkflowLoopKey: loopKey,
      lastDispatchMetadataPath: metadataPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [planRel, summaryRel, diagnosticsRel, resultPath ?? ""].filter(
        Boolean,
      ),
      problem: {
        action: "request",
        category: "ado-pipeline-run-lookup",
        diagnosis: summary,
        resumeCondition:
          "Confirm the dispatched pipeline run exists or restore Azure DevOps run listing access.",
      },
    });
  }

  const runId = String(run.databaseId);
  const wait = pipelineWaitSchedule({
    runId,
    runUrl: run.url ?? null,
    pipeline: workflow,
    branch,
    target,
    loopKey,
    waitTimeoutMinutes: githubWaitTimeoutMinutes,
  });
  updateFeatureCompactItem(state, featureKey, {
    lastWorkflowRunId: runId,
    lastWorkflowRunUrl: run.url ?? null,
    lastWorkflowLoopKey: loopKey,
    lastDispatchMetadataPath: metadataPath,
    activeAttemptId: attemptId,
    activeTaskSessionId:
      typeof task.session_id === "string" && task.session_id.trim()
        ? task.session_id.trim()
        : null,
    activeWorkflowRunId: runId,
    heartbeatAt: new Date().toISOString(),
    ...wait,
  });
  saveFeatureCompactLoopState(statePath, state);

  const watch = await waitForWorkflowRun({
    client: pipeline.client,
    projectDir,
    runId,
    timeoutMs: githubWaitTimeoutMinutes * 60_000,
    onPoll: (observedRun) => {
      if (!observedRun?.url) return;
      const wait = pipelineWaitSchedule({
        runId,
        runUrl: observedRun.url,
        pipeline: workflow,
        branch,
        target,
        loopKey,
        waitTimeoutMinutes: githubWaitTimeoutMinutes,
        existingFallbackAt: state.features[featureKey]?.fallbackAt,
      });
      updateFeatureCompactItem(state, featureKey, {
        lastWorkflowRunId: runId,
        lastWorkflowRunUrl: observedRun.url,
        lastWorkflowLoopKey: loopKey,
        lastDispatchMetadataPath: metadataPath,
        activeAttemptId: attemptId,
        activeTaskSessionId:
          typeof task.session_id === "string" && task.session_id.trim()
            ? task.session_id.trim()
            : null,
        activeWorkflowRunId: runId,
        heartbeatAt: new Date().toISOString(),
        ...wait,
      });
      saveFeatureCompactLoopState(statePath, state);
    },
  });
  const finalRun = watch.run ?? run;
  const liveEvidence = [
    planRel,
    summaryRel,
    diagnosticsRel,
    resultPath ?? "",
    finalRun.url ?? "",
  ].filter(Boolean);

  if (!watch.ok) {
    const stillRunning = finalRun.status && finalRun.status !== "completed";
    const failedRunProof =
      !stillRunning && finalRun.status === "completed"
        ? inspectLiveWorkflowArtifacts({
            client: pipeline.client,
            projectDir,
            appDir,
            runId,
            featureKey,
            planRel,
          })
        : null;
    const capacityReason = failedRunProof
      ? capacityPreflightReason(failedRunProof)
      : null;
    if (capacityReason) {
      const summary = [
        `Feature compact live workflow is waiting on staging capacity for ${featureKey}.`,
        `Plan: ${planRel}.`,
        `Run: ${runId}${finalRun.url ? ` ${finalRun.url}` : ""}.`,
        capacityReason,
        failedRunProof.resultPath
          ? `Azure DevOps artifact result: ${failedRunProof.resultPath}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      updateFeatureCompactItem(state, featureKey, {
        status: "error",
        retryable: false,
        retryReason:
          "Staging AKS managed-cluster capacity is full; retry only after capacity returns, quota changes, or target reroute is accepted.",
        lastPlanPath: planRel,
        lastSummaryPath: summaryRel,
        lastDiagnosticsPath: diagnosticsRel,
        lastResultPath: failedRunProof.resultPath ?? resultPath,
        lastWorkflowRunId: runId,
        lastWorkflowRunUrl: finalRun.url ?? null,
        lastWorkflowLoopKey: loopKey,
        lastDispatchMetadataPath: metadataPath,
        lastSummary: summary,
      });
      saveFeatureCompactLoopState(statePath, state);
      return completion(ctx, config, {
        task,
        attemptId,
        claim: "partial",
        summary,
        evidence: [
          planRel,
          summaryRel,
          diagnosticsRel,
          resultPath ?? "",
          failedRunProof.resultPath ?? "",
          finalRun.url ?? "",
        ].filter(Boolean),
        problem: {
          action: "request",
          category: "feature-compact-capacity",
          diagnosis: summary,
          resumeCondition:
            "Free staging AKS managed-cluster capacity, increase quota, or rerun after at least one cluster create slot is available.",
        },
      });
    }
    const status = "error";
    const claim: TaskCompletionClaim = "partial";
    const summary = [
      `Feature compact live workflow did not pass for ${featureKey}.`,
      `Plan: ${planRel}.`,
      `Run: ${runId}${finalRun.url ? ` ${finalRun.url}` : ""}.`,
      watch.detail || "workflow run did not complete successfully",
    ].join(" ");
    updateFeatureCompactItem(state, featureKey, {
      status,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastWorkflowRunId: runId,
      lastWorkflowRunUrl: finalRun.url ?? null,
      lastWorkflowLoopKey: loopKey,
      lastDispatchMetadataPath: metadataPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim,
      summary,
      evidence: liveEvidence,
      problem: {
        action: "request",
        category: stillRunning
          ? "ado-pipeline-runner-wait"
          : "feature-compact-live-test",
        diagnosis: summary,
        resumeCondition: stillRunning
          ? "Azure DevOps pipeline runner capacity or the still-running pipeline must finish before this feature can be marked done."
          : "Inspect the live workflow failure, fix the compact plan/spec/runtime, and retry this feature.",
      },
    });
  }

  const liveProof = inspectLiveWorkflowArtifacts({
    client: pipeline.client,
    projectDir,
    appDir,
    runId,
    featureKey,
    planRel,
  });

  if (!liveProof.ok) {
    const summary = [
      `Feature compact live workflow did not prove a live Azure pass for ${featureKey}.`,
      `Plan: ${planRel}.`,
      `Run: ${runId}${finalRun.url ? ` ${finalRun.url}` : ""}.`,
      liveProof.detail,
      resultPath ? `Local check result: ${resultPath}.` : "",
      liveProof.resultPath
        ? `Azure DevOps artifact result: ${liveProof.resultPath}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: liveProof.resultPath ?? resultPath,
      lastWorkflowRunId: runId,
      lastWorkflowRunUrl: finalRun.url ?? null,
      lastWorkflowLoopKey: loopKey,
      lastDispatchMetadataPath: metadataPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [
        planRel,
        summaryRel,
        diagnosticsRel,
        resultPath ?? "",
        liveProof.resultPath ?? "",
        finalRun.url ?? "",
      ].filter(Boolean),
      problem: {
        action: "request",
        category: "feature-compact-live-proof",
        diagnosis: summary,
        resumeCondition:
          "Rerun the compact Azure DevOps pipeline after the pipeline uploads a passing live test result artifact for this compact plan.",
      },
    });
  }

  if (partialReadySpecIds.length > 0) {
    const summary = [
      `Feature compact ready subset passed for ${featureKey}; the full package remains ${diagnostics.packageStatus}.`,
      `Ready subset: ${partialReadySpecIds.join(", ")}.`,
      partialBlockerSummary,
      `Plan: ${planRel}.`,
      `Summary: ${summaryRel}.`,
      `Diagnostics: ${diagnosticsRel}.`,
      liveProof.resultPath ? `Live test result: ${liveProof.resultPath}.` : "",
      resultPath ? `Local check result: ${resultPath}.` : "",
      `Workflow run: ${runId}${finalRun.url ? ` ${finalRun.url}` : ""}.`,
    ]
      .filter(Boolean)
      .join(" ");
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      retryable: false,
      retryReason: partialRetryReason || partialResumeCondition,
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: liveProof.resultPath ?? resultPath,
      lastWorkflowRunId: runId,
      lastWorkflowRunUrl: finalRun.url ?? null,
      lastWorkflowLoopKey: loopKey,
      lastDispatchMetadataPath: metadataPath,
      lastLiveProofVersion: null,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      evidence: [
        planRel,
        summaryRel,
        diagnosticsRel,
        resultPath ?? "",
        liveProof.resultPath ?? "",
        finalRun.url ?? "",
      ].filter(Boolean),
      problem: {
        action: "request",
        category: "feature-compact-package-status",
        diagnosis: summary,
        resumeCondition: partialResumeCondition,
      },
    });
  }

  const summary = [
    `Feature compact package done for ${featureKey}; live Azure DevOps pipeline passed.`,
    `Plan: ${planRel}.`,
    `Summary: ${summaryRel}.`,
    `Diagnostics: ${diagnosticsRel}.`,
    liveProof.resultPath ? `Live test result: ${liveProof.resultPath}.` : "",
    resultPath ? `Local check result: ${resultPath}.` : "",
    `Workflow run: ${runId}${finalRun.url ? ` ${finalRun.url}` : ""}.`,
    diagnostics.packageStatus
      ? `Package status: ${diagnostics.packageStatus}.`
      : "",
    diagnostics.metrics
      ? `Specs=${diagnostics.metrics.specsSelected ?? "?"}, clusters=${diagnostics.metrics.clustersNeeded ?? "?"}, saved=${diagnostics.metrics.clustersSaved ?? "?"}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  updateFeatureCompactItem(state, featureKey, {
    status: "done",
    lastPlanPath: planRel,
    lastSummaryPath: summaryRel,
    lastDiagnosticsPath: diagnosticsRel,
    lastResultPath: liveProof.resultPath ?? resultPath,
    lastWorkflowRunId: runId,
    lastWorkflowRunUrl: finalRun.url ?? null,
    lastWorkflowLoopKey: loopKey,
    lastDispatchMetadataPath: metadataPath,
    lastLiveProofVersion: liveAksProofVersion,
    lastSummary: summary,
  });
  saveFeatureCompactLoopState(statePath, state);
  return completion(ctx, config, {
    task,
    attemptId,
    claim: "done",
    summary,
    evidence: [
      planRel,
      summaryRel,
      diagnosticsRel,
      resultPath ?? "",
      liveProof.resultPath ?? "",
      finalRun.url ?? "",
    ].filter(Boolean),
  });
}

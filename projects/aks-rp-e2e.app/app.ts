import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  defineProjectApp,
  eventDetails,
  matchesEventSelector,
  Type,
  type EventSelector,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskAction,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";
import { observeAksPipelines } from "./watchers/aks-pipeline.js";
import { observeAksPullRequests } from "./watchers/aks-pull-request.js";
import { observeRepoRefChanges } from "./watchers/repo-ref.js";
import { observeScenarioTestInventory } from "./watchers/scenario-test-inventory.js";
import { observeWorkspaceIntegrityChanges } from "./watchers/workspace-integrity.js";
import {
  featureCompactLoopTaskId,
  legacyBranchReconciliationTaskId,
  masterValidationCompactTaskId,
  repositorySkillMaintenanceTaskId,
  scenarioNormalizationTaskId,
  specLoopTaskId,
  standingLoopIntent,
} from "./task-loops.js";
import { syncSpecLiveProof } from "./agents/app-ops/workflows/lib/spec-live-proof-sync.js";
import { syncFeatureCompactProjection } from "./agents/app-ops/workflows/lib/feature-compact-projection-sync.js";
import { syncOwnerVisibleReadout } from "./agents/app-ops/workflows/lib/owner-visible-readout-sync.js";
import {
  readCampaignReceipt,
  type CampaignReceipt,
} from "./agents/app-ops/workflows/lib/master-validation-campaign.js";

const projectId = "aks-rp-e2e";
const domainPolicyMaxConcurrent = 5;
const appOpsSupportConcurrent = 3;
// The runtime shares this budget across hot-reload controller generations.
const appControllerMaxConcurrent =
  domainPolicyMaxConcurrent + appOpsSupportConcurrent;
const scenarioTestFrontierTaskId = scenarioNormalizationTaskId;
export const masterValidationCycleTaskId = "master-validation-staging-cycle";
const scenarioTestFrontierMinLeaves = 3;

/**
 * Reject malformed explicit prepared-source handoffs before task mutation.
 * Omitting both fields delegates task-branch creation from current origin/dev to
 * spec-live-reconciliation; explicit source identifies a dedicated task branch.
 */
export function validateAksTaskAction(
  action: ProjectAppTaskAction,
): string | null {
  if (
    (action.kind !== "create-task" && action.kind !== "update-task") ||
    action.workflow !== "spec-live-reconciliation"
  ) {
    return null;
  }
  const input = action.input;
  if (!input) return null;
  const hasBranch = Object.prototype.hasOwnProperty.call(input, "sourceBranch");
  const hasCommit = Object.prototype.hasOwnProperty.call(input, "sourceCommit");
  if (!hasBranch && !hasCommit) return null;

  const sourceBranch =
    typeof input.sourceBranch === "string" ? input.sourceBranch.trim() : "";
  const sourceCommit =
    typeof input.sourceCommit === "string" ? input.sourceCommit.trim() : "";
  if (!sourceBranch || !sourceCommit) {
    return "binding workflow spec-live-reconciliation requires input.sourceBranch and input.sourceCommit together, or omission of both";
  }
  const normalizedBranch = sourceBranch.replace(/^refs\/heads\//, "");
  if (!normalizedBranch.startsWith("task/")) {
    return "binding workflow spec-live-reconciliation requires explicit input.sourceBranch to be a dedicated task/ branch";
  }
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    return "binding workflow spec-live-reconciliation requires input.sourceCommit to be an exact 40-character Git commit";
  }
  return null;
}
const actionInputSchema = Type.Object({}, { additionalProperties: true });
const targetedTaskActionInputSchema = Type.Object(
  { taskId: Type.Optional(Type.String({ minLength: 1 })) },
  { additionalProperties: true },
);

type AppTaskEvent = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function targetTaskId(event: AppTaskEvent): string {
  const details = eventDetails(event);
  const direct = details.taskId ?? details.task_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const target = isRecord(details.target) ? details.target : {};
  const targetTask = target.taskId ?? target.task_id;
  return typeof targetTask === "string" && targetTask.trim()
    ? targetTask.trim()
    : "";
}

function stringDetail(
  details: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function recordDetail(
  details: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = details[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function safeTaskIdPart(value: string, fallback: string): string {
  const raw = value.trim();
  if (!raw) return fallback;
  const normalized = raw
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized === raw && normalized.length <= 96) return normalized;
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  return `${normalized.slice(0, 83) || fallback}-${digest}`;
}

function masterValidationFailureTaskId(specId: string): string {
  return `domain/master-validation-failure/${safeTaskIdPart(specId, "spec")}`;
}

const projectTarget = { project: projectId };
const masterValidationCycleIntervalMs = 21_600_000;
const masterValidationCycleWakeSkewMs = 60_000;
export const masterValidationCapacityPulseEventType =
  "aks.master-validation.capacity-pulse";

export function masterValidationCycleSlot(nowMs = Date.now()): number {
  return Math.floor(nowMs / masterValidationCycleIntervalMs);
}

export function masterValidationCapacityPulseIdempotencyKey(
  cycleSlot: number,
  project = projectId,
): string {
  return `aks-master-validation-capacity-pulse:${project}:${cycleSlot}`;
}

function masterValidationCapacityPulseData(
  gate: ReturnType<typeof masterValidationScheduleGate>,
  nowMs = Date.now(),
): Record<string, unknown> {
  const cycleSlot = masterValidationCycleSlot(nowMs);
  return {
    project: projectId,
    gateReason: gate.reason,
    cycleSlot,
    idempotencyKey: masterValidationCapacityPulseIdempotencyKey(cycleSlot),
    ...(gate.queuedAt ? { queuedAt: gate.queuedAt } : {}),
    ...(gate.runId ? { runId: gate.runId } : {}),
    ...(gate.sourceCommit ? { sourceCommit: gate.sourceCommit } : {}),
  };
}

const ownerVisibleRefreshEventTypes = new Set([
  "project.task.reconcile.started",
  "project.task.reconcile.skipped",
  "project.task.reconciled",
  "aks.repo-ref.observed",
  "aks.repo-ref.changed",
  "pipeline-run.state",
  "pipeline.completed",
  "pipeline-artifact.available",
]);

type OwnerVisibleRefreshSnapshot = {
  treeUpdatedAt: string;
};

function readJsonRecord(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function ownerVisibleRefreshSnapshot(
  appDir: string,
): OwnerVisibleRefreshSnapshot | null {
  const tree = readJsonRecord(`${appDir}/.state/tasks/tree.json`);
  if (!tree) return null;
  const treeUpdatedAt =
    typeof tree.updated_at === "string" ? tree.updated_at.trim() : "";
  if (!treeUpdatedAt) return null;
  return { treeUpdatedAt };
}

function ownerVisiblePublishedTreeUpdatedAt(appDir: string): string {
  const projectState = readJsonRecord(`${appDir}/.state/project-state.json`);
  if (projectState) {
    const currentFocus = recordDetail(projectState, "currentFocus");
    const currentState = recordDetail(projectState, "currentState");
    const focusSnapshot = recordDetail(currentFocus ?? {}, "snapshot");
    const focusMission = recordDetail(currentFocus ?? {}, "focusMission");
    const currentStateSnapshot = recordDetail(currentState ?? {}, "snapshot");
    for (const candidate of [
      focusSnapshot?.treeUpdatedAt,
      focusMission?.treeUpdatedAt,
      currentStateSnapshot?.treeUpdatedAt,
    ]) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  const projectJson = readJsonRecord(`${appDir}/project.json`);
  const currentFocus = recordDetail(projectJson ?? {}, "currentFocus");
  const focusSnapshot = recordDetail(currentFocus ?? {}, "snapshot");
  const focusMission = recordDetail(currentFocus ?? {}, "focusMission");
  for (const candidate of [
    focusSnapshot?.treeUpdatedAt,
    focusMission?.treeUpdatedAt,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function maybeRefreshOwnerVisibleReadout(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): boolean {
  if (!ownerVisibleRefreshEventTypes.has(String(event.type ?? "")))
    return false;
  if (typeof ctx.appPath !== "function") return false;

  const appDir = ctx.appPath(".");
  const liveSnapshot = ownerVisibleRefreshSnapshot(appDir);
  if (!liveSnapshot) return false;
  const publishedTreeUpdatedAt = ownerVisiblePublishedTreeUpdatedAt(appDir);
  if (publishedTreeUpdatedAt === liveSnapshot.treeUpdatedAt) return false;

  return syncOwnerVisibleReadout({
    appDir,
    projectDir: ctx.appPath("../aks-rp-e2e"),
    worker: "app-ops",
  }).changed;
}

type MasterValidationCycleReceipt = {
  runId?: unknown;
  sourceCommit?: unknown;
  queuedAt?: unknown;
};

function readMasterValidationCycleReceipt(
  appDir: string,
): MasterValidationCycleReceipt | null {
  const path = `${appDir}/.state/master-validation-cycle.json`;
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

type TaskStateResource = {
  metadata?: { generation?: unknown; resourceVersion?: unknown };
  spec?: Record<string, unknown>;
  status?: {
    phase?: unknown;
    conditionIds?: unknown;
    summary?: unknown;
    evidence?: unknown;
  };
};

type TaskStateCondition = {
  spec?: {
    type?: unknown;
    subject?: unknown;
    expected?: unknown;
  };
  status?: {
    state?: unknown;
  };
};

type TaskStateSnapshot = {
  resources?: Record<string, TaskStateResource>;
  conditions?: Record<string, TaskStateCondition>;
};

type ApprovalWaitContractProblem = {
  taskId: string;
  workflow?: string;
  phase?: string;
  conditionId: string;
  issues: string[];
};

const canonicalApprovalDispatchDecisions = [
  "approve",
  "adjust",
  "hold",
  "decline",
  "reroute",
] as const;

type CanonicalApprovalDecision =
  (typeof canonicalApprovalDispatchDecisions)[number];

type ParsedApprovalDecisionMessage = {
  approvalId: string;
  waitId: string;
  project: string;
  decision: CanonicalApprovalDecision;
  message: string;
};

type ApprovalDecisionProjection = ParsedApprovalDecisionMessage & {
  pathId: string;
  packetPath?: string;
  conditionIds: string[];
  taskIds: string[];
};

function canonicalApprovalDecision(
  value: string,
): CanonicalApprovalDecision | null {
  const normalized = value.trim().toLowerCase();
  return canonicalApprovalDispatchDecisions.includes(
    normalized as CanonicalApprovalDecision,
  )
    ? (normalized as CanonicalApprovalDecision)
    : null;
}

function parseApprovalDecisionMessage(
  event: AppTaskEvent,
): ParsedApprovalDecisionMessage | null {
  if (String(event.type ?? "") !== "message.created") return null;
  const details = eventDetails(event);
  if (stringDetail(details, "intent") !== "approval-decision") return null;
  const message = stringDetail(details, "content", "message", "text");
  if (!message) return null;

  const decision = canonicalApprovalDecision(
    message.match(
      /(?:^|\n)\s*(?:\[approval-decision\]\s*)?Decision:\s*([^\n]+)/i,
    )?.[1] ?? "",
  );
  const approvalId =
    message.match(/(?:^|\n)\s*Approval id:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const waitId =
    message.match(/(?:^|\n)\s*Wait id:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const project =
    message.match(/(?:^|\n)\s*Project:\s*([^\n]+)/i)?.[1]?.trim() || projectId;

  if (!decision || !approvalId || !waitId) return null;
  return { approvalId, waitId, project, decision, message };
}

function approvalDecisionProjection(
  appDir: string,
  event: AppTaskEvent,
): ApprovalDecisionProjection | null {
  const parsed = parseApprovalDecisionMessage(event);
  if (!parsed) return null;

  const state = readTaskStateSnapshot(appDir);
  if (!state?.conditions || !state.resources) return null;

  const taskIdsByCondition = new Map<string, string[]>();
  for (const [taskId, resource] of Object.entries(state.resources)) {
    const phase = stringDetail(
      isRecord(resource.status) ? resource.status : {},
      "phase",
    );
    if (phase !== "waiting") continue;
    for (const conditionId of stringList(resource.status?.conditionIds)) {
      const taskIds = taskIdsByCondition.get(conditionId) ?? [];
      taskIds.push(taskId);
      taskIdsByCondition.set(conditionId, taskIds);
    }
  }

  const matches: Array<{
    conditionId: string;
    project: string;
    pathId: string;
    packetPath?: string;
    taskIds: string[];
  }> = [];
  for (const [conditionId, condition] of Object.entries(state.conditions)) {
    const spec = isRecord(condition.spec) ? condition.spec : null;
    if (spec?.type !== "project.approval.submitted") continue;
    const subject = stringDetail(spec, "subject");
    const conditionProject = subject.replace(/^project:/, "");
    if (!conditionProject || conditionProject !== parsed.project) continue;
    const expected = isRecord(spec.expected) ? spec.expected : {};
    const approvalKind = stringDetail(expected, "approvalKind");
    if (approvalKind && approvalKind !== "approval-packet-dispatch") continue;
    if (stringDetail(expected, "approvalId") !== parsed.approvalId) continue;
    if (stringDetail(expected, "waitId") !== parsed.waitId) continue;
    const acceptedDecisions = stringList(expected.acceptedDecisions);
    if (
      acceptedDecisions.length &&
      !acceptedDecisions.includes(parsed.decision)
    ) {
      continue;
    }
    if (condition.status?.state === "true") continue;
    const pathId = stringDetail(expected, "pathId");
    if (!pathId) continue;
    const taskIds = taskIdsByCondition.get(conditionId) ?? [];
    if (!taskIds.length) continue;
    matches.push({
      conditionId,
      project: conditionProject,
      pathId,
      packetPath: stringDetail(expected, "packetPath") || undefined,
      taskIds,
    });
  }
  if (!matches.length) return null;

  const uniqueProjects = [...new Set(matches.map((entry) => entry.project))];
  const uniquePathIds = [...new Set(matches.map((entry) => entry.pathId))];
  if (uniqueProjects.length !== 1 || uniquePathIds.length !== 1) return null;

  return {
    ...parsed,
    pathId: uniquePathIds[0],
    packetPath:
      matches.find((entry) => entry.packetPath)?.packetPath ?? undefined,
    conditionIds: [...new Set(matches.map((entry) => entry.conditionId))],
    taskIds: [...new Set(matches.flatMap((entry) => entry.taskIds))],
  };
}

function readTaskStateSnapshot(appDir: string): TaskStateSnapshot | null {
  const path = `${appDir}/.state/tasks/state.json`;
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object"
      ? (parsed as TaskStateSnapshot)
      : null;
  } catch {
    return null;
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && Boolean(entry.trim()),
      )
    : [];
}

type MasterValidationFailureCarrier = {
  taskId: string;
  workflow: string;
  input: Record<string, unknown>;
  generation: number;
  resourceVersion: number;
  evidence: string[];
};

function numericMetadata(value: unknown): number {
  return typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : 0;
}

function selectNewestCarrier(
  carriers: MasterValidationFailureCarrier[],
): MasterValidationFailureCarrier | null {
  if (carriers.length === 0) return null;
  if (carriers.length === 1) return carriers[0]!;
  const ranked = [...carriers].sort(
    (left, right) =>
      right.generation - left.generation ||
      right.resourceVersion - left.resourceVersion ||
      left.taskId.localeCompare(right.taskId),
  );
  const [best, next] = ranked;
  if (!best) return null;
  if (!next) return best;
  if (
    best.generation !== next.generation ||
    best.resourceVersion !== next.resourceVersion
  ) {
    return best;
  }
  return null;
}

function masterValidationFailureCarriers(
  taskState: TaskStateSnapshot | null,
): MasterValidationFailureCarrier[] {
  const resources = taskState?.resources ?? {};
  return Object.entries(resources).flatMap(([taskId, resource]) => {
    const spec = isRecord(resource?.spec) ? resource.spec : null;
    if (!spec) return [];
    const workflow = stringDetail(spec, "workflow");
    if (workflow !== "master-validation-failure") {
      return [];
    }
    const input = isRecord(spec.input) ? spec.input : null;
    if (!input) return [];
    const phase = stringDetail(resource?.status ?? {}, "phase").toLowerCase();
    if (["done", "closed", "converged"].includes(phase)) return [];
    return [
      {
        taskId,
        workflow,
        input,
        generation: numericMetadata(resource?.metadata?.generation),
        resourceVersion: numericMetadata(resource?.metadata?.resourceVersion),
        evidence: stringList(resource?.status?.evidence),
      },
    ];
  });
}

function pullRequestReviewWakeCarriers(
  taskState: TaskStateSnapshot | null,
): MasterValidationFailureCarrier[] {
  const resources = taskState?.resources ?? {};
  return Object.entries(resources).flatMap(([taskId, resource]) => {
    const spec = isRecord(resource?.spec) ? resource.spec : null;
    if (!spec) return [];
    const workflow = stringDetail(spec, "workflow");
    if (
      workflow !== "master-validation-failure" &&
      workflow !== "master-validation-route-verification" &&
      workflow !== "non-spec-main-publication"
    ) {
      return [];
    }
    const input = isRecord(spec.input) ? spec.input : null;
    if (!input) return [];
    const phase = stringDetail(resource?.status ?? {}, "phase").toLowerCase();
    if (["done", "closed", "converged"].includes(phase)) return [];
    return [
      {
        taskId,
        workflow,
        input,
        generation: numericMetadata(resource?.metadata?.generation),
        resourceVersion: numericMetadata(resource?.metadata?.resourceVersion),
        evidence: stringList(resource?.status?.evidence),
      },
    ];
  });
}

function existingMasterValidationFailureCarrierForPullRequest(
  taskState: TaskStateSnapshot | null,
  pullRequestId: string,
): MasterValidationFailureCarrier | null {
  if (!pullRequestId) return null;
  const matches = masterValidationFailureCarriers(taskState).filter((carrier) =>
    carrier.evidence.includes(`pull-request:${pullRequestId}`),
  );
  return selectNewestCarrier(matches);
}

function existingPullRequestReviewWakeCarrierForPullRequest(
  taskState: TaskStateSnapshot | null,
  pullRequestId: string,
): MasterValidationFailureCarrier | null {
  if (!pullRequestId) return null;
  const matches = pullRequestReviewWakeCarriers(taskState).filter((carrier) =>
    carrier.evidence.includes(`pull-request:${pullRequestId}`),
  );
  return selectNewestCarrier(matches);
}

type LiveTaskReadiness = {
  state?: unknown;
};

type LiveTaskTreeTask = {
  id?: unknown;
  generation?: unknown;
  phase?: unknown;
  input?: unknown;
  evidence?: unknown;
  outputs?: unknown;
  readiness?: LiveTaskReadiness;
};

type LiveTaskTreeSnapshot = {
  tasks?: Record<string, LiveTaskTreeTask>;
};

type WorkspaceIntegrityCoverage = {
  suppressed: boolean;
  coveredByTask: Record<string, string[]>;
  uncovered: Array<{ path: string; kind: string; reason: string }>;
  repoDirtyPaths: string[];
};

function readLiveTaskTree(appDir: string): LiveTaskTreeSnapshot | null {
  const path = `${appDir}/.state/tasks/tree.json`;
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object"
      ? (parsed as LiveTaskTreeSnapshot)
      : null;
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  return resolve(path).replace(/\/+$/, "");
}

function taskClaimCoversPath(claim: string, target: string): boolean {
  const normalizedClaim = normalizePath(claim);
  const normalizedTarget = normalizePath(target);
  return (
    normalizedTarget === normalizedClaim ||
    normalizedTarget.startsWith(`${normalizedClaim}/`)
  );
}

function gitStdout(
  cwd: string,
  args: string[],
): { status: number; stdout: string } {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 60_000,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout?.trimEnd() ?? "",
  };
}

function currentRepoDirtyPaths(repoDir: string): string[] | null {
  const result = gitStdout(repoDir, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (result.status !== 0) return null;
  return result.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const raw = line.slice(3).trim();
      const path = raw.includes(" -> ")
        ? (raw.split(" -> ").pop() ?? raw)
        : raw;
      return normalizePath(resolve(repoDir, path));
    });
}

function addPathClaim(
  claims: Set<string>,
  value: unknown,
  fallbackBase: string,
): void {
  if (typeof value !== "string" || !value.trim()) return;
  const path = value.startsWith("/")
    ? value.trim()
    : resolve(fallbackBase, value.trim());
  claims.add(normalizePath(path));
}

const repoRelativeTaskPathPattern =
  /^(README\.md|spec-runner\.ya?ml|features\/|evidence\/|runner\/|model\/)/;

function collectTaskPathClaims(
  claims: Set<string>,
  value: unknown,
  fallbackBase: string,
  seen = new Set<object>(),
): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("/")) {
      if (normalizePath(trimmed) === normalizePath(fallbackBase)) return;
      addPathClaim(claims, trimmed, fallbackBase);
      return;
    }
    if (repoRelativeTaskPathPattern.test(trimmed)) {
      addPathClaim(claims, trimmed, fallbackBase);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTaskPathClaims(claims, entry, fallbackBase, seen);
    }
    return;
  }
  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const entry of Object.values(value)) {
    collectTaskPathClaims(claims, entry, fallbackBase, seen);
  }
}

function taskWorktreeClaimFromEvidence(
  evidenceEntry: string,
  repoDir: string,
): string | null {
  if (!evidenceEntry.startsWith("source-branch:task/")) return null;
  const branchName = evidenceEntry.slice("source-branch:".length).trim();
  const worktreeName = branchName.slice("task/".length).trim();
  if (!worktreeName) return null;
  return resolve(repoDir, "../../worktrees", basename(repoDir), worktreeName);
}

function taskWorktreeLeaf(taskId: string, generation: number): string {
  const safeTaskId =
    taskId
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "task";
  const hash = createHash("sha256")
    .update(`${taskId}@${generation}`)
    .digest("hex")
    .slice(0, 10);
  return `${safeTaskId}-${hash}`;
}

function taskOwnsWorktreePath(
  taskId: string,
  task: LiveTaskTreeTask,
  targetPath: string,
  repoDir: string,
): boolean {
  const worktreeRoot = normalizePath(
    resolve(repoDir, "../../worktrees", basename(repoDir)),
  );
  const normalizedTarget = normalizePath(targetPath);
  if (!normalizedTarget.startsWith(`${worktreeRoot}/`)) return false;
  const relativeTarget = normalizedTarget.slice(worktreeRoot.length + 1);
  if (!relativeTarget || relativeTarget.includes("/")) return false;
  const generation = task.generation;
  if (
    typeof generation !== "number" ||
    !Number.isInteger(generation) ||
    generation < 1
  ) {
    return false;
  }
  return relativeTarget === taskWorktreeLeaf(taskId, generation);
}

function inferredWorktreeOwners(
  tasks: Record<string, LiveTaskTreeTask>,
  targetPath: string,
  repoDir: string,
): string[] {
  return Object.entries(tasks)
    .filter(([taskId, task]) =>
      taskOwnsWorktreePath(taskId, task, targetPath, repoDir),
    )
    .map(([taskId]) => taskId)
    .sort();
}

function taskPathClaims(
  taskId: string,
  task: LiveTaskTreeTask,
  repoDir: string,
): string[] {
  const record = isRecord(task.input) ? task.input : {};
  const claims = new Set<string>();
  const canonicalBase = stringDetail(record, "canonicalRoot", "canonicalPath");
  const repoBase = canonicalBase || repoDir;

  addPathClaim(claims, record.cleanupPath, repoBase);
  addPathClaim(claims, record.workspacePath, repoBase);
  addPathClaim(claims, record.sharedDirtyFile, repoDir);

  for (const value of [
    record.cleanupCandidates,
    record.cleanupPaths,
    record.filePaths,
    record.scopedPaths,
    record.sourcePaths,
    task.outputs,
  ]) {
    for (const entry of stringList(value))
      addPathClaim(claims, entry, repoBase);
  }

  const recoveryWorktrees = Array.isArray(record.recoveryWorktrees)
    ? record.recoveryWorktrees
    : [];
  for (const worktree of recoveryWorktrees) {
    if (isRecord(worktree)) addPathClaim(claims, worktree.path, repoBase);
  }

  for (const entry of stringList(task.evidence)) {
    const worktreeClaim = taskWorktreeClaimFromEvidence(entry, repoDir);
    if (worktreeClaim) addPathClaim(claims, worktreeClaim, repoDir);
  }

  collectTaskPathClaims(claims, record, repoBase);

  const featureKey = stringDetail(record, "featureKey");
  if (
    featureKey &&
    (taskId.startsWith("compact/") ||
      taskId.startsWith("wait-compact-") ||
      taskId.startsWith("hold-compact-"))
  ) {
    for (const relativePath of [
      `features/${featureKey}/compact`,
      `features/${featureKey}/specs`,
      `features/${featureKey}/tests`,
      `features/${featureKey}/lib`,
    ]) {
      addPathClaim(claims, relativePath, repoDir);
    }
  }

  return [...claims];
}

function findCoveringTasks(
  taskClaims: Map<string, string[]>,
  targetPath: string,
): string[] {
  const matches: string[] = [];
  for (const [taskId, claims] of taskClaims.entries()) {
    if (claims.some((claim) => taskClaimCoversPath(claim, targetPath))) {
      matches.push(taskId);
    }
  }
  return matches.sort();
}

function workspaceIntegrityCoverage(
  appDir: string,
  repoDir: string,
  observation: Record<string, unknown>,
): WorkspaceIntegrityCoverage {
  const tree = readLiveTaskTree(appDir);
  if (!tree?.tasks) {
    return {
      suppressed: false,
      coveredByTask: {},
      uncovered: [
        {
          path: normalizePath(repoDir),
          kind: "workspace-integrity-routing",
          reason: "live-task-tree-unavailable",
        },
      ],
      repoDirtyPaths: [],
    };
  }

  const taskClaims = new Map<string, string[]>();
  for (const [taskId, task] of Object.entries(tree.tasks)) {
    const claims = taskPathClaims(taskId, task, repoDir);
    if (claims.length) taskClaims.set(taskId, claims);
  }

  const coveredByTask: Record<string, string[]> = {};
  const uncovered: Array<{ path: string; kind: string; reason: string }> = [];
  const anomalies = Array.isArray(observation.anomalies)
    ? observation.anomalies.filter(isRecord)
    : [];
  const repoRoot = normalizePath(repoDir);
  const repoDirtyPaths: string[] = [];
  let needsCanonicalCoverage = false;

  for (const anomaly of anomalies) {
    const kind = stringDetail(anomaly, "kind");
    const path = stringDetail(anomaly, "path");
    if (!kind || !path) continue;
    const normalizedPath = normalizePath(path);
    if (kind === "canonical-unhealthy") {
      needsCanonicalCoverage = true;
      continue;
    }
    if (kind === "unowned-dirty" && normalizedPath === repoRoot) continue;
    const coveringTasks = findCoveringTasks(taskClaims, normalizedPath);
    const inferredTasks =
      coveringTasks.length === 0 && kind === "unowned-dirty"
        ? inferredWorktreeOwners(tree.tasks, normalizedPath, repoDir)
        : [];
    const matchingTasks = coveringTasks.length ? coveringTasks : inferredTasks;
    if (matchingTasks.length) {
      coveredByTask[`${kind}:${normalizedPath}`] = matchingTasks;
      continue;
    }
    uncovered.push({
      path: normalizedPath,
      kind,
      reason: "no-live-task-claim",
    });
  }

  if (needsCanonicalCoverage) {
    const canonical = isRecord(observation.canonical)
      ? observation.canonical
      : {};
    const clean = canonical.clean === true;
    const branch = stringDetail(canonical, "branch");
    if (clean || branch !== "dev") {
      uncovered.push({
        path: repoRoot,
        kind: "canonical-unhealthy",
        reason: clean ? "clean-but-not-canonical" : `branch=${branch || ""}`,
      });
    } else {
      const dirtyPaths = currentRepoDirtyPaths(repoDir);
      if (!dirtyPaths?.length) {
        uncovered.push({
          path: repoRoot,
          kind: "canonical-unhealthy",
          reason: dirtyPaths ? "dirty-paths-unavailable" : "git-status-failed",
        });
      } else {
        repoDirtyPaths.push(...dirtyPaths);
        for (const dirtyPath of dirtyPaths) {
          const coveringTasks = findCoveringTasks(taskClaims, dirtyPath);
          if (coveringTasks.length) {
            coveredByTask[`canonical:${dirtyPath}`] = coveringTasks;
            continue;
          }
          uncovered.push({
            path: dirtyPath,
            kind: "canonical-dirty-path",
            reason: "no-live-task-claim",
          });
        }
      }
    }
  }

  return {
    suppressed: uncovered.length === 0,
    coveredByTask,
    uncovered,
    repoDirtyPaths,
  };
}

function approvalWaitConditionProblem(
  conditionId: string,
  condition: TaskStateCondition,
): ApprovalWaitContractProblem | null {
  const spec = isRecord(condition.spec) ? condition.spec : null;
  if (spec?.type !== "project.approval.submitted") return null;
  const expected = isRecord(spec.expected) ? spec.expected : {};
  if (
    typeof expected.approvalKind === "string" &&
    expected.approvalKind !== "approval-packet-dispatch"
  ) {
    return null;
  }
  const looksLikeApprovalDispatch =
    expected.approvalKind === "approval-packet-dispatch" ||
    [
      "approvalId",
      "waitId",
      "pathId",
      "approvalIds",
      "waitIds",
      "decisionIn",
      "acceptedDecisions",
      "decisions",
    ].some((key) => key in expected);
  if (!looksLikeApprovalDispatch) return null;

  const approvalId = stringDetail(expected, "approvalId");
  const waitId = stringDetail(expected, "waitId");
  const pathId = stringDetail(expected, "pathId");
  const acceptedDecisions = stringList(expected.acceptedDecisions);
  const issues: string[] = [];

  if (expected.approvalKind !== "approval-packet-dispatch") {
    issues.push(
      `approvalKind=${JSON.stringify(expected.approvalKind ?? null)}`,
    );
  }
  if (!approvalId) issues.push("missing approvalId");
  if (!waitId) issues.push("missing waitId");
  if (!pathId) issues.push("missing pathId");
  if (
    acceptedDecisions.length !== canonicalApprovalDispatchDecisions.length ||
    canonicalApprovalDispatchDecisions.some(
      (decision, index) => acceptedDecisions[index] !== decision,
    )
  ) {
    issues.push(
      `acceptedDecisions=${JSON.stringify(expected.acceptedDecisions ?? null)}`,
    );
  }

  if (!issues.length) return null;
  return {
    taskId: "",
    conditionId,
    issues,
  };
}

export function malformedApprovalWaitContract(
  appDir: string,
  taskId: string,
): ApprovalWaitContractProblem | null {
  const state = readTaskStateSnapshot(appDir);
  if (!state) return null;
  const resource = state.resources?.[taskId];
  if (!resource) return null;
  const conditionIds = stringList(resource.status?.conditionIds);
  for (const conditionId of conditionIds) {
    const problem = approvalWaitConditionProblem(
      conditionId,
      state.conditions?.[conditionId] ?? {},
    );
    if (problem) {
      return {
        ...problem,
        taskId,
        workflow: stringDetail(
          isRecord(resource.spec) ? resource.spec : {},
          "workflow",
        ),
        phase: stringDetail(
          isRecord(resource.status) ? resource.status : {},
          "phase",
        ),
      };
    }
  }
  return null;
}

export function masterValidationScheduleGate(
  appDir: string,
  nowMs = Date.now(),
): {
  due: boolean;
  reason:
    | "missing-receipt"
    | "invalid-receipt"
    | "campaign-active"
    | "cooldown-active"
    | "interval-elapsed";
  queuedAt?: string;
  sourceCommit?: string;
  runId?: string;
} {
  if (existsSync(`${appDir}/.state/master-validation-campaign.json`)) {
    return { due: true, reason: "campaign-active" };
  }
  const receipt = readMasterValidationCycleReceipt(appDir);
  const queuedAt =
    typeof receipt?.queuedAt === "string" && receipt.queuedAt.trim()
      ? receipt.queuedAt.trim()
      : "";
  const sourceCommit =
    typeof receipt?.sourceCommit === "string" && receipt.sourceCommit.trim()
      ? receipt.sourceCommit.trim()
      : undefined;
  const runId =
    typeof receipt?.runId === "string" && receipt.runId.trim()
      ? receipt.runId.trim()
      : undefined;
  if (!receipt) return { due: true, reason: "missing-receipt" };
  const queuedAtMs = Date.parse(queuedAt);
  if (!Number.isFinite(queuedAtMs)) {
    return {
      due: true,
      reason: "invalid-receipt",
      ...(queuedAt ? { queuedAt } : {}),
      ...(sourceCommit ? { sourceCommit } : {}),
      ...(runId ? { runId } : {}),
    };
  }
  const due =
    nowMs - queuedAtMs >=
    masterValidationCycleIntervalMs - masterValidationCycleWakeSkewMs;
  return {
    due,
    reason: due ? "interval-elapsed" : "cooldown-active",
    queuedAt,
    ...(sourceCommit ? { sourceCommit } : {}),
    ...(runId ? { runId } : {}),
  };
}

const ownerReviewEventTypes = new Set([
  "project.owner.requested",
  "project.comment.created",
  "project.approval.submitted",
  "project.test_run.completed",
  "project.stall.reviewed",
  "project.problem.resolved",
  "project.problem.escalated",
  "project.problem.inconclusive",
  "coverage.gap.detected",
  "escalation.resolved",
  "escalation.dismissed",
  "metric.breach",
  "metric.recovered",
  "learning.feedback",
]);

function ownerReviewPriority(event: AppTaskEvent): "P0" | "P1" {
  const details = eventDetails(event);
  const reason = stringDetail(details, "reason");
  const inputEventType = stringDetail(details, "inputEventType");
  return event.type === "project.comment.created" ||
    event.type === "project.approval.submitted" ||
    reason === "owner-message" ||
    reason === "human-goal-follow-through" ||
    inputEventType === "message.created"
    ? "P0"
    : "P1";
}

const aksTaskSelectors: EventSelector[] = [
  { type: "project.task.tick", target: projectTarget },
  { type: "aks.resource-migration.requested", target: projectTarget },
  { type: "aks.task-state-migration.requested", target: projectTarget },
  { type: "aks.task-tick-migration.requested", target: projectTarget },
  { type: "aks.repo-ref-condition-migration.requested", target: projectTarget },
  {
    type: "aks.project-state-residue-migration.requested",
    target: projectTarget,
  },
  {
    type: "aks.spec-loop-ownership-migration.requested",
    target: projectTarget,
  },
  {
    type: "aks.feature-loop-ownership-migration.requested",
    target: projectTarget,
  },
  {
    type: "aks.feature-loop-history-migration.requested",
    target: projectTarget,
  },
  {
    type: "aks.feature-loop-residue-migration.requested",
    target: projectTarget,
  },
  {
    type: "aks.scenario-loop-ownership-migration.requested",
    target: projectTarget,
  },
  {
    type: "aks.waiting-frontier-retirement.requested",
    target: projectTarget,
  },
  {
    type: "aks.waiting-frontier-migration-cleanup.requested",
    target: projectTarget,
  },
  {
    type: "aks.finite-holder-migration.requested",
    target: projectTarget,
  },
  { type: "pipeline.failure.observed", target: projectTarget },
  { type: "project.owner.requested", target: projectTarget },
  { type: "project.comment.created", target: projectTarget },
  { type: "project.approval.submitted", target: projectTarget },
  { type: "project.test_run.completed", target: projectTarget },
  { type: "project.stall.reviewed", target: projectTarget },
  { type: "project.problem.resolved", target: projectTarget },
  { type: "project.problem.escalated", target: projectTarget },
  { type: "project.problem.inconclusive", target: projectTarget },
  { type: "coverage.gap.detected", target: projectTarget },
  { type: "escalation.resolved", owner: "agent:aks-explorer" },
  { type: "escalation.dismissed", owner: "agent:aks-explorer" },
  { type: "metric.breach", owner: "agent:app-ops" },
  { type: "metric.recovered", owner: "agent:app-ops" },
  { type: "learning.feedback", owner: "agent:aks-explorer" },
  { type: "learning.feedback", owner: "agent:aks-reviewer" },
  {
    type: "project.problem.investigation.requested",
    target: projectTarget,
  },
  { type: "project.stall.review.requested", target: projectTarget },
  { type: "project.approval.requested", target: projectTarget },
];

export function resolveAksTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  if (
    !aksTaskSelectors.some((selector) => matchesEventSelector(selector, event))
  )
    return null;

  const details = eventDetails(event);
  const taskId = targetTaskId(event);

  if (event.type === "aks.resource-migration.requested") {
    return {
      id: "runtime/unified-resource-migration-resource-liveness-v3",
      parentId: "group/app-operations",
      outcome:
        "Retire fixed producerless waits, repair completed task identity reuse, and keep the standing owner-review inbox free of unrelated child waits.",
      acceptance: [
        "Only named childless maintain holders still waiting on a project.state Condition are closed, and every closure leaves a receipt.",
        "Only the five named waiting repair tasks with no Condition and no live child are removed.",
        "A representation repair that targeted a completed task ID is revised in place to choose a new deterministic holder identity.",
        "Finite work created by owner review is moved to the matching stable project group so unrelated child waits cannot block later owner messages.",
        "The feature compact loop remains the standing owner and is woken through normal parent or scheduled reconciliation.",
        "Any holder that gained child work or no longer matches the legacy contract remains live for owner judgment; expectedGeneration rejects a concurrent revision at apply time.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-resource-migration",
      input: { migration: "resource-liveness-v3" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.task-state-migration.requested") {
    return {
      id: "runtime/unified-resource-migration-task-state-v1",
      parentId: "group/app-operations",
      outcome:
        "Replace the fixed set of legacy task-phase and task-field Conditions with task-resource relationships.",
      acceptance: [
        "A named wait on a live prerequisite uses dependsOn and is woken by shared dependency reconciliation.",
        "The one named wait whose subject has already left the live graph is returned to owner judgment.",
        "Any mismatched resource remains live and unchanged; expectedGeneration rejects a concurrent revision at apply time.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-task-state-migration",
      input: { migration: "task-state-waits-v1" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.task-tick-migration.requested") {
    return {
      id: "runtime/unified-resource-migration-task-tick-v1",
      parentId: "group/app-operations",
      outcome:
        "Retire the fixed legacy compact holders that use project.task.tick Conditions as a second scheduler.",
      acceptance: [
        "Only named childless maintain holders still waiting on a project.task.tick Condition are closed, and every closure leaves a receipt.",
        "Timers and semantic events wake the stable feature loop directly through the shared controller.",
        "Any holder that gained child work or no longer matches the legacy contract remains live for owner judgment; expectedGeneration rejects a concurrent revision at apply time.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-task-tick-migration",
      input: { migration: "task-tick-holders-v1" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.repo-ref-condition-migration.requested") {
    return {
      id: "runtime/unified-resource-migration-repo-ref-condition-v1",
      parentId: "group/app-operations",
      outcome:
        "Replace the fixed legacy repo-ref Condition shape with canonical external observation waits.",
      acceptance: [
        "Only named waiting tasks with the legacy project-scoped repo-ref Condition are returned to current owner judgment.",
        "The next wait uses subject repoRef:<ref> with expected field=commit and notEquals=<baseline>, or the task closes if no wait remains truthful.",
        "Canonical Conditions and mismatched tasks remain untouched; expectedGeneration rejects a concurrent revision at apply time.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-repo-ref-condition-migration",
      input: { migration: "legacy-repo-ref-conditions-v1" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.project-state-residue-migration.requested") {
    return {
      id: "runtime/unified-resource-migration-project-state-v2",
      parentId: "group/app-operations",
      outcome:
        "Retire the exact LocalDNS and runtime-container project-state residues after topology-aware checks.",
      acceptance: [
        "The two completed LocalDNS children close before their exact childless holder.",
        "The finite runtime-container representation repair closes only while unchanged and childless.",
        "Any topology, phase, mode, or Condition mismatch leaves the affected resources untouched; expectedGeneration rejects a concurrent revision at apply time.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-project-state-residue-migration",
      input: { migration: "project-state-residue-v2" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.spec-loop-ownership-migration.requested") {
    return {
      id: "runtime/unified-resource-migration-spec-loop-ownership-v1",
      parentId: "group/app-operations",
      outcome:
        "Move the exact safe legacy spec-loop siblings under the executable standing loop and compact completed holders.",
      acceptance: [
        "The child-backed serverless wait becomes a direct child of the standing spec loop without disturbing an external Condition.",
        "The two exact completed childless maintain holders become receipts.",
        "Any changed topology, phase, generation, or Condition leaves that resource untouched.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-spec-loop-ownership-migration",
      input: { migration: "spec-loop-siblings-v1" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.feature-loop-ownership-migration.requested") {
    return {
      id: "runtime/unified-resource-migration-feature-loop-current-v1",
      parentId: "group/app-operations",
      outcome:
        "Move current feature-compact work under the executable standing loop so shared parent wakeup owns continuation.",
      acceptance: [
        "Current feature-compact tasks that are still direct group siblings become direct children of the standing feature loop.",
        "Finite maintain carriers become achieve tasks while truthful external Conditions and child topology remain unchanged.",
        "Stale, completed, changed, or already-parented resources remain untouched.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-feature-loop-ownership-migration",
      input: { migration: "feature-loop-current-v1" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.feature-loop-history-migration.requested") {
    const batch = stringDetail(details, "batch") || "1";
    if (!/^[1-5]$/.test(batch)) return null;
    return {
      id: `runtime/unified-resource-migration-feature-loop-history-v${batch}`,
      parentId: "group/app-operations",
      outcome: `Compact batch ${batch} of stale completed feature-compact holders so the task tree contains work instead of retained history.`,
      acceptance: [
        "At most 16 stale converged childless maintain holders under the legacy feature group become receipts.",
        "Current feature references, open Conditions, child-backed resources, and unfinished work remain unchanged.",
        "Every close uses the observed generation so concurrent revisions are rejected.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-feature-loop-history-migration",
      input: { migration: "feature-loop-history-v1", batch },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.feature-loop-residue-migration.requested") {
    const batch = stringDetail(details, "batch") || "1";
    if (!/^[1-2]$/.test(batch)) return null;
    return {
      id: `runtime/unified-resource-migration-feature-loop-residue-v${batch}`,
      parentId: "group/app-operations",
      outcome: `Move batch ${batch} of the remaining unfinished or child-backed feature resources under the executable standing loop.`,
      acceptance: [
        "Every remaining pending, waiting, or child-backed feature group sibling becomes a direct child of the standing feature loop.",
        "Finite maintain carriers become achieve tasks while their Conditions and children remain unchanged.",
        "The standing loop and any completed childless history remain untouched.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-feature-loop-residue-migration",
      input: { migration: "feature-loop-residue-v1", batch },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.scenario-loop-ownership-migration.requested") {
    const batch = stringDetail(details, "batch") || "1";
    if (!/^[1-2]$/.test(batch)) return null;
    return {
      id: `runtime/unified-resource-migration-scenario-loop-ownership-v${batch}`,
      parentId: "group/app-operations",
      outcome: `Move batch ${batch} of legacy scenario-normalization siblings under the executable standing loop.`,
      acceptance: [
        "At most 16 pending, waiting, or child-backed scenario group siblings become direct children of scenario-normalization.",
        "Existing workflows, children, Conditions, ownership, and task intent remain unchanged.",
        "The standing loop and completed childless history remain untouched.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-scenario-loop-ownership-migration",
      input: { migration: "scenario-loop-ownership-v1", batch },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.waiting-frontier-retirement.requested") {
    return {
      id: "runtime/waiting-frontier-review",
      parentId: "group/app-operations",
      outcome:
        "Finish the existing direct children of the retired waiting-frontier scheduler, then leave the live graph.",
      acceptance: [
        "Create no new recovery, review, holder, or scheduling tasks.",
        "While an existing direct child is live, wait on that child and rely on shared parent wakeup.",
        "Converge after the last existing direct child leaves the live graph.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "retire-waiting-frontier",
      input: { migration: "waiting-frontier-retirement-v1" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.waiting-frontier-migration-cleanup.requested") {
    return {
      id: "runtime/unified-resource-migration-waiting-frontier-v1",
      parentId: "group/app-operations",
      outcome:
        "Record that waiting-frontier retirement moved to direct app-resolver ownership after the rejected handler-action attempt.",
      acceptance: [
        "The workflow performs no task mutation.",
        "The direct app resolver owns the runtime/waiting-frontier-review specification.",
        "The finite cleanup resource converges and leaves a receipt.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-waiting-frontier-migration",
      input: { migration: "waiting-frontier-direct-resolver-v2" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "aks.finite-holder-migration.requested") {
    const requestedBatch = stringDetail(details, "batch");
    const batch = /^\d+$/.test(requestedBatch) ? requestedBatch : "1";
    return {
      id: `runtime/unified-resource-migration-finite-holders-v${batch}`,
      parentId: "group/app-operations",
      outcome:
        "Remove finite hold/wait history from the live graph and classify unfinished finite holders as achieve work.",
      acceptance: [
        "Each batch changes at most 16 non-runtime resources.",
        "A converged holder closes only when it is childless and condition-free.",
        "A pending or waiting holder keeps its owner, workflow, children, Conditions, and outcome while mode changes from maintain to achieve.",
        "Mismatched or concurrently changed resources remain untouched through expectedGeneration checks.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-finite-holder-migration",
      input: { migration: "finite-holder-residue-v1", batch },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "pipeline.failure.observed") {
    const specId = stringDetail(details, "specId", "spec_id");
    const failureFingerprint = stringDetail(
      details,
      "failureFingerprint",
      "fingerprint",
    );
    if (!specId || !failureFingerprint) return null;
    const failureCategory = stringDetail(details, "category");
    const pipelineFailure =
      failureCategory === "pipeline_failure" || specId.startsWith("pipeline.");
    return {
      id: masterValidationFailureTaskId(specId),
      parentId: "group/domain-work",
      outcome: pipelineFailure
        ? "Repair the repository-owned master-validation pipeline/bootstrap failure that prevented any parseable spec verdict, then prove the accumulated fix through the frozen campaign and current main."
        : `Classify and resolve the progressively observed master-validation failure or temporary admission exclusion for ${specId} without waiting for the aggregate pipeline to finish.`,
      acceptance: pipelineFailure
        ? [
            "Inspect the exact failed Azure pipeline step and logs; absence of a spec verdict is actionable pipeline repair, not an inconclusive product result.",
            "Keep the repair in one focused PR to current main and replay only its focused patch onto the frozen campaign without waiting for PR merge or importing main ancestry.",
            "A later campaign must progress beyond the failed bootstrap; any newly exposed failure remains active repair work on the same campaign.",
            "The issue remains open until the focused fix merges and a full run from current main passes.",
          ]
        : [
            "The failure is classified as test_issue, prod_issue, or inconclusive from the completed slice artifact or machine-readable admission report.",
            "A temporary admission exclusion keeps unrelated slices running but remains a test issue until the intended carrier is admitted and later passes from current main.",
            "Recovery follows the claim-bearing execution route. Usually that is the current-main aggregate; when generic staging cannot exercise the claim, one direct spec-live child must produce an applicable current-main pass on the recorded standalone target and integrate any repair.",
            "Excluding a misrouted spec may keep the aggregate moving, but exclusion alone never verifies the claim and never closes the issue.",
            "A squash or rebase merge is valid when Azure reports the exact tested PR head and its resulting merged commit is present in main; the PR head itself does not need to remain in main ancestry.",
            "A product issue leaves source unchanged, notifies the human operator through message.created for Telegram delivery, and remains open until a deployed product fix passes the affected spec from current main.",
            "Repeated observations and changed failure fingerprints revise this one current spec task and its Condition; fingerprints remain episode evidence and do not create parallel carriers or per-run recovery tasks.",
            "Classification, notification, PR creation, PR merge, and unrelated main advancement are progress evidence; none alone is final verification.",
          ],
      mode: "achieve",
      owner: "aks-explorer",
      workflow: "master-validation-failure",
      input: {
        validationTaskId: masterValidationCycleTaskId,
        specId,
        failureFingerprint,
        pipelineRunId: stringDetail(details, "pipelineRunId", "runId"),
        sourceBranch: stringDetail(details, "sourceBranch") || "main",
        sourceCommit: stringDetail(details, "sourceCommit", "sourceVersion"),
        sliceId: stringDetail(details, "sliceId"),
        status: stringDetail(details, "status"),
        category: failureCategory,
        failureScope: pipelineFailure ? "pipeline" : "spec",
        reason: stringDetail(details, "reason"),
        artifactName: stringDetail(details, "artifactName"),
        artifactPath: stringDetail(details, "artifactPath"),
        progressiveObservation: details.progressiveObservation === true,
      },
      priority: "P0",
      category: "domain",
    };
  }

  if (event.type === "project.stall.reviewed") {
    const stallReview = recordDetail(details, "stallReview", "stall_review");
    const judgment =
      (stallReview ? stringDetail(stallReview, "judgment") : "") ||
      stringDetail(details, "judgment");
    if (judgment === "needs-work" || judgment === "escalate") {
      const reason =
        stringDetail(details, "reason", "triggerReason", "trigger_reason") ||
        judgment;
      return {
        id: `runtime/stall-review-followup/${safeTaskIdPart(`${judgment}-${reason}`, "review")}`,
        parentId: "group/app-operations",
        outcome: `Act on the reviewed AKS project stall finding (${judgment}) and move the project back toward useful work.`,
        acceptance: [
          "Read the structured stallReview input and current task tree before changing anything.",
          "Take one concrete app-owned next step: repair stale task representation, create exact follow-up work, escalate across an owner boundary, or record why no action is currently supported.",
          "Do not treat receipts, archived done leaves, or completed repair evidence as live coverage; any claimed covering task must exist in the live resource graph with a current nonterminal phase and must match the current affected task ids.",
          "Do not redo the stall diagnosis as the main work; use it as evidence and preserve agent judgment in the resulting task action or summary.",
        ],
        mode: "achieve",
        owner: "app-ops",
        input: {
          reason,
          judgment,
          ...(stallReview ? { stallReview } : {}),
          summary: stringDetail(details, "summary") || null,
        },
        priority: "P0",
      };
    }
  }

  if (ownerReviewEventTypes.has(String(event.type ?? ""))) {
    return {
      id: "runtime/owner-review",
      parentId: "group/app-operations",
      outcome:
        "Keep the AKS project reviewed by its accountable owner and organize the smallest useful next step from current evidence.",
      acceptance: [
        "The owner performs one useful project step or returns an evidence-backed no-op with typed follow-up actions.",
        "Any finite follow-up created by owner review must be a sibling under group/app-operations or group/domain-work; runtime/owner-review is an inbox and never waits on unrelated child work.",
        "A progressive master-validation nonpassing event without an artifact-backed stable failure carrier is progress evidence only: inspect or report it, but do not classify it, change source, or queue a retry before pipeline.failure.observed supplies the terminal artifact.",
        "Do not create domain/normalize-plain-scenario-carrier-* tasks from owner review. scenario-normalization is the sole frontier and live-capacity owner for that work.",
        "When scenario inventory is red or normalization capacity appears free, wake the existing scenario-normalization task with current evidence and let its workflow select any new leaves.",
      ],
      mode: "maintain",
      owner: "app-ops",
      priority: ownerReviewPriority(event),
    };
  }

  switch (event.type) {
    case "project.task.tick": {
      const action = stringDetail(details, "action");
      if (action === "spec-loop" || taskId === specLoopTaskId) {
        return standingLoopIntent(specLoopTaskId);
      }
      if (
        action === "feature-compact-loop" ||
        taskId === featureCompactLoopTaskId
      ) {
        return standingLoopIntent(featureCompactLoopTaskId);
      }
      if (
        action === "master-validation-compact" ||
        taskId === masterValidationCompactTaskId
      ) {
        return standingLoopIntent(masterValidationCompactTaskId);
      }
      if (taskId === scenarioTestFrontierTaskId) {
        return standingLoopIntent(scenarioNormalizationTaskId);
      }
      if (taskId === masterValidationCycleTaskId) {
        return {
          id: masterValidationCycleTaskId,
          parentId: "group/domain-work",
          outcome:
            "Preserve all 79 Go source lanes mapped to all 82 master-validation specs, pass every aggregate-runnable spec in one fresh exact-current-main staging run, and preserve an exact current-main standalone pass for every standalone-only spec.",
          acceptance: [
            "Each due cycle queues pipeline 467665 with feature_set=master-validation, target=staging, slices=9, slice_max_parallel=9, parallel=3, branch main, and the exact resolved origin/main commit.",
            "The source-to-spec inventory remains complete: all 79 goal Go source lanes are represented by all 82 mapped specs, with no lane or mapped spec silently dropped.",
            "Every aggregate-runnable spec passes in one fresh staging aggregate run from the exact current origin/main commit.",
            "Every standalone-only spec has a passing direct standalone run from the exact current origin/main commit; aggregate exclusion is routing evidence only and never counts as a pass.",
            "Only one aggregate master-validation cycle is active at a time.",
            "Completed slice artifacts are observed while the aggregate run is still active and each nonpassing spec has one current sibling known-issue task; changed failure fingerprints remain episode history on that task.",
            "A failed main run forks one campaign branch from that exact commit; focused issue patches replay onto it in stable order and its focused PRs continue targeting main.",
            "A failed campaign reruns immediately when its accumulated focused patches change and every six hours when unchanged, so repository fixes and deployed product recovery are both observed.",
            "When main advances, an already-active aggregate may finish without overlap; meanwhile one successor carries the same isolated patch set onto the exact new main base, avoiding rediscovery of known failures while preserving one ordered campaign.",
            "A focused-patch replay conflict waits on the exact pull-request state or source-head change; it does not hand the standing cycle to an owner or create campaign-repair scheduling work.",
            "Keep only draft PRs that still carry a required, unmerged repair: abandon a draft when exact current-main proof makes it unnecessary or a newer same-task PR supersedes it, and never publish an unverified draft for human review.",
            "Publish a focused PR only after its affected spec passes from the exact branch and commit still at that PR head; a green combined campaign is integration evidence but cannot publish an individually unverified draft. Any later commit requires fresh exact-head proof. The standing task is green only when the later fresh exact-current-main aggregate passes every aggregate-runnable spec and exact-current-main standalone proof passes every standalone-only spec.",
          ],
          mode: "maintain",
          owner: "app-ops",
          workflow: "master-validation-cycle",
          input: {
            featureSet: "master-validation",
            intervalMs: 21_600_000,
            pipelineId: "467665",
            sourceBranch: "main",
            campaignBranchConvention:
              "validation/master-validation-<baseline-run-id>",
            target: "staging",
          },
          priority: "P0",
          category: "domain",
        };
      }
      if (
        action === "legacy-branch-reconciliation" ||
        taskId === legacyBranchReconciliationTaskId
      ) {
        return standingLoopIntent(legacyBranchReconciliationTaskId);
      }
      if (
        action === "repository-skill-maintenance" ||
        taskId === repositorySkillMaintenanceTaskId
      ) {
        return standingLoopIntent(repositorySkillMaintenanceTaskId);
      }
      return null;
    }
    case "project.problem.investigation.requested": {
      const problemKey = stringDetail(
        details,
        "problemKey",
        "problem_key",
        "taskId",
        "task_id",
      );
      const affectedTaskId =
        taskId || stringDetail(details, "taskId", "task_id") || null;
      return {
        id: `runtime/problem-solver/${safeTaskIdPart(problemKey, "project")}`,
        parentId: "group/app-operations",
        outcome:
          "Investigate one bounded AKS project blocker and return a verified resolution, exact escalation, or explicit inconclusive result.",
        acceptance: [
          "The investigation reports its root cause, action, verification, and the exact owner next step without taking task-tree scheduling authority.",
        ],
        mode: "achieve",
        owner: "app-ops",
        workflow: "problem-solver",
        input: { problemKey, targetTaskId: affectedTaskId },
        priority: "P1",
      };
    }
    case "project.stall.review.requested":
      return {
        id: "runtime/project-stall-review",
        parentId: "group/app-operations",
        outcome:
          "Keep suspicious stalled AKS work reviewed against current task, loop, and external-state evidence.",
        acceptance: [
          "The review applies only safe mechanical repair and returns a structured judgment, evidence, and exact follow-up.",
        ],
        mode: "maintain",
        owner: "app-ops",
        workflow: "project-stall-review",
        priority: "P0",
      };
    case "project.approval.requested": {
      const params = recordDetail(details, "params") ?? {};
      const approvalKey =
        stringDetail(
          details,
          "approvalId",
          "approval_id",
          "pathId",
          "path_id",
          "packetPath",
          "packet_path",
          "taskId",
          "task_id",
        ) ||
        stringDetail(
          params,
          "approvalId",
          "approval_id",
          "pathId",
          "path_id",
          "packetPath",
          "packet_path",
          "taskId",
          "task_id",
        );
      const packetPath =
        stringDetail(details, "packetPath", "packet_path") ||
        stringDetail(params, "packetPath", "packet_path");
      const pathId =
        stringDetail(details, "pathId", "path_id") ||
        stringDetail(params, "pathId", "path_id");
      const requestedAction =
        stringDetail(details, "requestedAction", "requested_action") ||
        stringDetail(params, "requestedAction", "requested_action");
      const reason =
        stringDetail(details, "reason") || stringDetail(params, "reason");
      const summary =
        stringDetail(details, "summary") || stringDetail(params, "summary");
      const target =
        stringDetail(details, "target") || stringDetail(params, "target");
      const authority =
        stringDetail(details, "authority") || stringDetail(params, "authority");
      const requiresHumanDecision =
        details.requiresHumanDecision === true ||
        details.requires_human_decision === true ||
        params.requiresHumanDecision === true ||
        params.requires_human_decision === true;
      const approvalId =
        stringDetail(details, "approvalId", "approval_id") ||
        stringDetail(params, "approvalId", "approval_id");
      const waitId =
        stringDetail(details, "waitId", "wait_id") ||
        stringDetail(params, "waitId", "wait_id");
      return {
        id: `runtime/approval-dispatch/${safeTaskIdPart(approvalKey, "pending")}`,
        parentId: "group/app-operations",
        outcome:
          "Route one exact AKS decision packet to its declared owner and use the human channel only for an explicit human authority boundary.",
        acceptance: [
          "A valid packet is delivered once for its semantic correlation key, or missing/invalid input is reported with evidence.",
        ],
        mode: "achieve",
        owner: "app-ops",
        workflow: "approval-dispatch",
        input: {
          approvalKey,
          approvalId,
          packetPath,
          pathId,
          reason,
          requestedAction,
          summary,
          target,
          authority,
          requiresHumanDecision,
          targetTaskId: taskId || null,
          waitId,
        },
        priority: "P1",
      };
    }
    default:
      return null;
  }
}

export async function routeAksEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  const ownerVisibleReadoutRefreshed = maybeRefreshOwnerVisibleReadout(
    ctx,
    event,
  );

  if (event.type === "message.created" && typeof ctx.appPath === "function") {
    const projectedApprovalDecision = approvalDecisionProjection(
      ctx.appPath("."),
      event,
    );
    if (projectedApprovalDecision) {
      const data: Record<string, unknown> = {
        project: projectedApprovalDecision.project,
        approvalKind: "approval-packet-dispatch",
        approvalId: projectedApprovalDecision.approvalId,
        waitId: projectedApprovalDecision.waitId,
        pathId: projectedApprovalDecision.pathId,
        decision: projectedApprovalDecision.decision,
        message: projectedApprovalDecision.message,
        sourceMessageType: "message.created",
        sourceMessageIntent: "approval-decision",
        sourceMessageOwner:
          typeof event.owner === "string" ? event.owner : undefined,
        sourceMessageEventId:
          typeof event.eventId === "number" ? event.eventId : undefined,
      };
      if (projectedApprovalDecision.packetPath) {
        data.packetPath = projectedApprovalDecision.packetPath;
      }
      ctx.emit({
        type: "project.approval.submitted",
        source: "aks-rp-e2e-app",
        target: { project: projectedApprovalDecision.project },
        data,
      });
      const sourceMessageEventId = Number(event.eventId);
      if (Number.isInteger(sourceMessageEventId) && sourceMessageEventId > 0) {
        ctx.emit({
          type: "message.resolved",
          source: "aks-rp-e2e-app",
          owner: "agent:app-ops",
          target: { project: projectedApprovalDecision.project },
          data: {
            openEventId: sourceMessageEventId,
            openEventType: "message.created",
            project: projectedApprovalDecision.project,
            projectId: projectedApprovalDecision.project,
            disposition: "answered",
            outcome: "fulfilled",
            summary: `Applied the ${projectedApprovalDecision.decision} decision to approval ${projectedApprovalDecision.approvalId}.`,
            taskRefs: projectedApprovalDecision.taskIds.map((taskId) => ({
              projectId: projectedApprovalDecision.project,
              taskId,
            })),
          },
          trace: {
            traceId:
              isRecord(event.trace) && typeof event.trace.traceId === "string"
                ? event.trace.traceId
                : `event:${sourceMessageEventId}`,
            parentEventId: sourceMessageEventId,
            links: [
              {
                eventId: sourceMessageEventId,
                type: "closure",
                label: "message.resolved",
              },
            ],
          },
        });
      }
      return {
        approvalDecisionProjected: true,
        projectedApprovalDecision,
      };
    }

    const sourceMessageEventId = Number(event.eventId);
    if (Number.isInteger(sourceMessageEventId) && sourceMessageEventId > 0) {
      const details = eventDetails(event);
      const content = stringDetail(details, "content", "message", "text");
      ctx.emit({
        type: "project.owner.requested",
        source: "aks-rp-e2e-app",
        owner: "agent:app-ops",
        target: { project: projectId },
        data: {
          project: projectId,
          projectId,
          reason: "owner-message",
          inputEventId: sourceMessageEventId,
          inputEventType: "message.created",
          inputEventData: isRecord(event.data) ? event.data : details,
          ...(content ? { instruction: content } : {}),
        },
        trace: {
          traceId:
            isRecord(event.trace) && typeof event.trace.traceId === "string"
              ? event.trace.traceId
              : `event:${sourceMessageEventId}`,
          parentEventId: sourceMessageEventId,
          links: [
            {
              eventId: sourceMessageEventId,
              type: "reference",
              label: "project.owner.requested",
            },
          ],
        },
      });
      return {
        approvalDecisionProjected: false,
        ownerReviewRequested: true,
        reason: "approval-decision-needs-clarification",
      };
    }
  }

  if (event.type === "pipeline.test.nonpassing") {
    const details = eventDetails(event);
    const validationTaskId = stringDetail(
      details,
      "validationTaskId",
      "validation_task_id",
      "taskId",
      "task_id",
    );
    if (validationTaskId !== masterValidationCycleTaskId) {
      ctx.emit({
        type: "project.owner.requested",
        source: "aks-rp-e2e-app",
        target: { project: projectId },
        data: {
          project: projectId,
          reason: "pipeline-test-nonpassing",
          taskId: validationTaskId || null,
          validationTaskId: validationTaskId || null,
          pipelineRunId: stringDetail(details, "pipelineRunId", "runId"),
          specId: stringDetail(details, "specId", "spec_id"),
          status: stringDetail(details, "status"),
        },
      });
      return {
        masterValidationFailureRouted: false,
        ownerReviewRequested: true,
        reason: "non-aggregate-task-owner-review-requested",
      };
    }

    ctx.emit({
      type: "project.owner.requested",
      source: "aks-rp-e2e-app",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "master-validation-progressive-nonpassing",
        validationTaskId,
        pipelineRunId: stringDetail(details, "pipelineRunId", "runId"),
        sourceBranch: stringDetail(details, "sourceBranch"),
        sourceCommit: stringDetail(details, "sourceCommit", "sourceVersion"),
        specId: stringDetail(details, "specId", "spec_id"),
        status: stringDetail(details, "status"),
        category: stringDetail(details, "category"),
        summary:
          "A live master-validation verdict became nonpassing before the current run published its artifact. Review current progress only; wait for this run's pipeline.failure.observed event before classification, source changes, or retries.",
      },
    });
    return {
      masterValidationFailureRouted: false,
      ownerReviewRequested: true,
      reason: "master-validation-progressive-awaiting-artifact",
    };
  }

  if (
    event.type === "project.task.reconcile.started" ||
    event.type === "project.task.reconcile.skipped"
  ) {
    return {
      ownerVisibleReadoutRefreshed,
      eventType: event.type,
    };
  }
  if (event.type === "project.task.handler.recovered") {
    const taskId = targetTaskId(event);
    return {
      ownerVisibleReadoutRefreshed,
      eventType: event.type,
      recoveredTaskId: taskId || null,
      recoveryScheduling: "shared-runtime",
    };
  }
  if (event.type === "pipeline.spec.observed") {
    const campaign = readCampaignReceipt(ctx.appPath("."));
    const pullRequestIds = verifiedCampaignFixPullRequestIds(campaign, event);
    if (pullRequestIds.length) {
      const details = eventDetails(event);
      const specId = stringDetail(details, "specId", "spec_id");
      const sourceBranch = stringDetail(details, "sourceBranch").replace(
        /^refs\/heads\//,
        "",
      );
      const sourceCommit = stringDetail(
        details,
        "sourceCommit",
        "sourceVersion",
      );
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId: masterValidationCycleTaskId },
        action: "master-validation-cycle",
        overrideWait: true,
        data: {
          project: projectId,
          taskId: masterValidationCycleTaskId,
          task_id: masterValidationCycleTaskId,
          reason: "master-validation-fix-verified",
          overrideWait: true,
          specId,
          pipelineRunId: stringDetail(details, "pipelineRunId", "runId"),
          sourceBranch,
          sourceCommit,
          pullRequestIds,
        },
      });
    }
    return {
      masterValidationFixReadyWake: pullRequestIds.length > 0,
      pullRequestIds,
    };
  }
  if (event.type === "project.task.reconciled") {
    const appDir = ctx.appPath(".");
    const reconciledTaskId = targetTaskId(event);
    const specProof = reconciledTaskId
      ? syncSpecLiveProof(appDir, reconciledTaskId)
      : { changed: false };
    const featureCompactProjection = reconciledTaskId
      ? syncFeatureCompactProjection(appDir, reconciledTaskId)
      : { changed: false };
    return {
      specProof,
      featureCompactProjection,
    };
  }
  if (event.type === "aks.pipeline.check") return observeAksPipelines(ctx);
  if (event.type === masterValidationCapacityPulseEventType) {
    const details = eventDetails(event);
    const reason =
      stringDetail(details, "gateReason", "reason") ||
      "capacity-pulse-observed";
    const cycleSlot =
      typeof details.cycleSlot === "number" ? details.cycleSlot : null;
    ctx.emit({
      type: "project.task.tick",
      source: "aks-rp-e2e-app",
      target: {
        project: projectId,
        taskId: masterValidationCycleTaskId,
      },
      action: "master-validation-cycle",
      data: {
        project: projectId,
        taskId: masterValidationCycleTaskId,
        reason:
          reason === "campaign-active"
            ? "master-validation-campaign-reconcile"
            : "scheduled-six-hour-master-validation",
        ...(cycleSlot !== null ? { cycleSlot } : {}),
      },
    });
    return {
      masterValidationCapacityPulseObserved: true,
      masterValidationCycleWake: true,
      reason,
      cycleSlot,
    };
  }
  if (event.type === "aks.master-validation.check") {
    const gate = masterValidationScheduleGate(ctx.appPath("."));
    if (!gate.due) {
      return {
        masterValidationWake: false,
        reason: gate.reason,
        queuedAt: gate.queuedAt ?? null,
        runId: gate.runId ?? null,
      };
    }
    const pulseData = masterValidationCapacityPulseData(gate);
    const cycleSlot = Number(pulseData.cycleSlot);
    ctx.emit({
      type: masterValidationCapacityPulseEventType,
      source: "aks-rp-e2e-app",
      target: projectTarget,
      data: pulseData,
    });
    return {
      masterValidationWake: true,
      capacityPulseEmitted: true,
      reason: gate.reason,
      queuedAt: gate.queuedAt ?? null,
      runId: gate.runId ?? null,
      cycleSlot,
    };
  }
  if (event.type === "pipeline.queue.overdue") {
    const details = eventDetails(event);
    const runId = stringDetail(details, "pipelineRunId", "runId");
    const queueTime = stringDetail(details, "queueTime");
    const queueScope = stringDetail(details, "queueScope");
    const message = {
      project: projectId,
      from: "app-ops",
      to: "human:operator",
      intent: "master-validation-queue-overdue",
      priority: "P2",
      pipelineRunId: runId,
      queueTime,
      queueScope,
      content:
        queueScope === "slice-jobs"
          ? `AKS master-validation run ${runId || "unknown"} completed planning, but every test slice has waited at least 90 minutes for hosted-agent capacity. Queue position is preserved; the app did not cancel or duplicate the run.`
          : `AKS master-validation run ${runId || "unknown"} has waited at least 90 minutes for hosted-agent capacity. Queue position is preserved; the app did not cancel or duplicate the run.`,
    };
    ctx.emit({
      type: "message.created",
      source: "aks-rp-e2e-app",
      target: { project: projectId, human: true },
      ...message,
      data: message,
    });
    return { operatorNotified: true, pipelineRunId: runId };
  }
  if (
    event.type === "pipeline-run.state" ||
    event.type === "pipeline.completed" ||
    event.type === "pipeline-artifact.available"
  ) {
    const taskId = targetTaskId(event);
    return {
      ownerVisibleReadoutRefreshed,
      eventType: event.type,
      taskId: taskId || null,
      conditionScheduling: "shared-runtime",
    };
  }
  if (event.type === "aks.node-image-publication.state") {
    const details = eventDetails(event);
    return {
      nodeImagePublicationObserved: true,
      targetName: stringDetail(details, "targetName"),
      location: stringDetail(details, "location"),
      imageFamily: stringDetail(details, "imageFamily"),
      channel: stringDetail(details, "channel"),
      publishedVersion: stringDetail(details, "publishedVersion"),
      conditionTracking: "shared-runtime",
    };
  }
  if (event.type === "pull-request.state") {
    const details = eventDetails(event);
    const pullRequestId = stringDetail(details, "pullRequestId");
    const state = stringDetail(details, "state");
    const sourceCommit = stringDetail(details, "sourceCommit");
    const unresolvedReviewCount =
      numberDetail(details.unresolvedReviewCount) ?? 0;
    const reviewFingerprint = stringDetail(details, "reviewFingerprint");
    const unresolvedReviewThreads = Array.isArray(
      details.unresolvedReviewThreads,
    )
      ? details.unresolvedReviewThreads
      : [];
    const carrier =
      typeof ctx.appPath === "function" && pullRequestId
        ? existingPullRequestReviewWakeCarrierForPullRequest(
            readTaskStateSnapshot(ctx.appPath(".")),
            pullRequestId,
          )
        : null;
    const campaignCarrier =
      typeof ctx.appPath === "function" && pullRequestId
        ? existingMasterValidationFailureCarrierForPullRequest(
            readTaskStateSnapshot(ctx.appPath(".")),
            pullRequestId,
          )
        : null;
    const campaign =
      typeof ctx.appPath === "function"
        ? readCampaignReceipt(ctx.appPath("."))
        : null;
    const belongsToCurrentCampaign = Boolean(
      campaignCarrier &&
      campaign &&
      campaignCarrier.evidence.includes(`campaign-base:${campaign.baseCommit}`),
    );
    const campaignAlreadyHasHead = Boolean(
      campaign &&
      campaign.integratedFixes.some(
        (fix) =>
          fix.pullRequestId === pullRequestId &&
          fix.sourceCommit === sourceCommit,
      ),
    );
    const shouldWakeCampaign = Boolean(
      state === "active" &&
      sourceCommit &&
      belongsToCurrentCampaign &&
      !campaignAlreadyHasHead,
    );
    if (shouldWakeCampaign && campaignCarrier) {
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId: masterValidationCycleTaskId },
        action: "master-validation-cycle",
        overrideWait: true,
        data: {
          project: projectId,
          taskId: masterValidationCycleTaskId,
          task_id: masterValidationCycleTaskId,
          reason: "master-validation-focused-pr-changed",
          overrideWait: true,
          pullRequestId,
          sourceCommit,
          repairTaskId: campaignCarrier.taskId,
        },
      });
    }
    const priorFingerprint = carrier
      ? taskStatusEvidenceValue(
          carrier.evidence,
          "pull-request-review-fingerprint",
        ) || ""
      : "";
    const priorReviewCount = Number(
      carrier
        ? taskStatusEvidenceValue(
            carrier.evidence,
            "pull-request-unresolved-review-count",
          )
        : 0,
    );
    const reviewChanged = reviewFingerprint
      ? reviewFingerprint !== priorFingerprint
      : unresolvedReviewCount !== priorReviewCount;
    const shouldWakeCarrier =
      Boolean(carrier) &&
      state === "active" &&
      unresolvedReviewCount > 0 &&
      reviewChanged;
    if (shouldWakeCarrier && carrier) {
      const threadIds = unresolvedReviewThreads
        .flatMap((thread) =>
          isRecord(thread) ? [stringDetail(thread, "threadId")] : [],
        )
        .filter(Boolean);
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId: carrier.taskId },
        action: carrier.workflow || "master-validation-failure",
        overrideWait: true,
        data: {
          project: projectId,
          taskId: carrier.taskId,
          task_id: carrier.taskId,
          reason: "pull-request-review-changed",
          overrideWait: true,
          pullRequestId,
          unresolvedReviewCount,
          reviewFingerprint,
          unresolvedReviewThreads,
          ...(Number.isInteger(Number(event.eventId))
            ? { pullRequestStateEventId: Number(event.eventId) }
            : {}),
          summary: `PR ${pullRequestId} reports ${unresolvedReviewCount} unresolved review thread(s)${threadIds.length ? ` (${threadIds.join(",")})` : ""}; wake ${carrier.taskId} to reconcile the existing focused repair branch instead of leaving review comments to owner review.`,
        },
      });
    }
    return {
      pullRequestObserved: true,
      pullRequestId: pullRequestId || null,
      state: state || null,
      unresolvedReviewCount,
      masterValidationFailureWake: shouldWakeCarrier,
      ...(shouldWakeCampaign ? { masterValidationCycleWake: true } : {}),
      taskId: carrier?.taskId ?? null,
      reviewFingerprint: reviewFingerprint || null,
    };
  }
  if (event.type === "aks.pull-request.check")
    return observeAksPullRequests(ctx);
  if (event.type === "aks.repo-ref.check") return observeRepoRefChanges(ctx);
  if (event.type === "aks.repo-ref.observed") {
    const details = eventDetails(event);
    const repoRef = stringDetail(details, "repoRef", "repo_ref");
    const commit = stringDetail(details, "commit");
    return {
      observed: true,
      repoRef,
      commit,
      conditionTracking: "shared-runtime",
    };
  }
  if (event.type === "aks.repo-ref.changed") {
    const details = eventDetails(event);
    const repoRef = stringDetail(details, "repoRef", "repo_ref");
    if (repoRef !== "origin/main") {
      return { masterValidationWake: false, repoRef };
    }
    const commit = stringDetail(details, "commit");
    ctx.emit({
      type: "project.task.tick",
      source: "aks-rp-e2e-app",
      target: {
        project: projectId,
        taskId: masterValidationCycleTaskId,
      },
      action: "master-validation-cycle",
      data: {
        project: projectId,
        taskId: masterValidationCycleTaskId,
        reason: "master-validation-main-advanced",
        repoRef,
        commit,
      },
    });
    return { masterValidationWake: true, repoRef, commit };
  }
  if (event.type === "aks.workspace.integrity.check")
    return observeWorkspaceIntegrityChanges(ctx);
  if (event.type === "aks.workspace.integrity.changed") {
    const observation = eventDetails(event);
    if (typeof ctx.appPath === "function") {
      const coverage = workspaceIntegrityCoverage(
        ctx.appPath("."),
        ctx.appPath("../aks-rp-e2e"),
        observation,
      );
      if (coverage.suppressed) {
        return {
          ownerReviewRequested: false,
          workspaceIntegrityOwnerReviewSuppressed: true,
          workspaceIntegrityCoveredByTask: coverage.coveredByTask,
          workspaceIntegrityRepoDirtyPaths: coverage.repoDirtyPaths,
        };
      }
      ctx.emit({
        type: "project.owner.requested",
        target: { project: projectId },
        data: {
          project: projectId,
          reason: "workspace-integrity-changed",
          observation,
          uncovered: coverage.uncovered,
        },
      });
      return {
        ownerReviewRequested: true,
        workspaceIntegrityOwnerReviewSuppressed: false,
        workspaceIntegrityUncovered: coverage.uncovered,
        workspaceIntegrityRepoDirtyPaths: coverage.repoDirtyPaths,
      };
    }
    ctx.emit({
      type: "project.owner.requested",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "workspace-integrity-changed",
        observation,
      },
    });
    return { ownerReviewRequested: true };
  }
  if (event.type === "aks.scenario-test-inventory.check")
    return observeScenarioTestInventory(ctx);
  if (event.type === "aks.scenario-test-inventory.observed") {
    const wakeSuppressed = suppressScenarioTestFrontierWake(
      ctx.appPath("."),
      event,
    );
    if (!wakeSuppressed) {
      const wake = scenarioTestFrontierWakeEvent(event);
      ctx.emit(wake);
    }
    return {
      taskId: scenarioTestFrontierTaskId,
      observed: true,
      wakeSuppressed,
    };
  }
  return undefined;
}

export function verifiedCampaignFixPullRequestIds(
  campaign: CampaignReceipt | null,
  event: Record<string, unknown>,
): string[] {
  if (!campaign) return [];
  const details = eventDetails(event);
  const specId = stringDetail(details, "specId", "spec_id");
  const status = stringDetail(details, "status").toLowerCase();
  const sourceBranch = stringDetail(details, "sourceBranch").replace(
    /^refs\/heads\//,
    "",
  );
  const sourceCommit = stringDetail(details, "sourceCommit", "sourceVersion");
  if (!specId || status !== "pass") {
    return [];
  }
  const stableTaskId = `domain/master-validation-failure/${specId}`;
  return campaign.integratedFixes
    .filter(
      (fix) =>
        (fix.taskId === stableTaskId ||
          fix.taskId.startsWith(`${stableTaskId}/`)) &&
        fix.sourceBranch.replace(/^refs\/heads\//, "") === sourceBranch &&
        fix.sourceCommit === sourceCommit,
    )
    .map((fix) => fix.pullRequestId);
}

type ScenarioTestInventoryObservationDetails = {
  sourceRef: string;
  sourceCommit: string;
  sourceKind: string;
  state: string;
  strictPassed: boolean;
  missingAdapterCount: number;
  remainingSpecReferencedPlainScenarioCount: number;
  remainingRepoPlainScenarioFileCount: number;
};

function numberDetail(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanDetail(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function scenarioTestInventoryObservationDetails(
  event: Record<string, unknown>,
): ScenarioTestInventoryObservationDetails | null {
  const details = eventDetails(event);
  const observation = recordDetail(details, "observation");
  if (!observation) return null;

  const sourceRef = stringDetail(observation, "sourceRef");
  const sourceCommit = stringDetail(observation, "sourceCommit");
  const sourceKind = stringDetail(observation, "sourceKind");
  const state = stringDetail(observation, "state");
  const strictPassed = booleanDetail(observation.strictPassed);
  const missingAdapterFiles = Array.isArray(observation.missingAdapterFiles)
    ? observation.missingAdapterFiles.filter(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim()),
      )
    : [];
  const remainingSpecReferencedPlainScenarioCount = numberDetail(
    observation.remainingSpecReferencedPlainScenarioCount,
  );
  const remainingRepoPlainScenarioFileCount = numberDetail(
    observation.remainingRepoPlainScenarioFileCount,
  );

  if (
    !sourceRef ||
    !sourceCommit ||
    !sourceKind ||
    !state ||
    strictPassed === null ||
    remainingSpecReferencedPlainScenarioCount === null ||
    remainingRepoPlainScenarioFileCount === null
  ) {
    return null;
  }

  return {
    sourceRef,
    sourceCommit,
    sourceKind,
    state,
    strictPassed,
    missingAdapterCount: missingAdapterFiles.length,
    remainingSpecReferencedPlainScenarioCount,
    remainingRepoPlainScenarioFileCount,
  };
}

function taskStatusEvidenceValue(
  evidence: string[],
  key: string,
): string | undefined {
  const prefix = `${key}:`;
  const match = evidence.find((entry) => entry.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

export function suppressScenarioTestFrontierWake(
  appDir: string,
  event: Record<string, unknown>,
): boolean {
  const observation = scenarioTestInventoryObservationDetails(event);
  if (!observation) return false;
  if (
    observation.sourceRef !== "origin/dev" ||
    observation.sourceKind !== "clean-ref-worktree" ||
    observation.state !== "red" ||
    observation.strictPassed !== false ||
    observation.missingAdapterCount !== 0
  ) {
    return false;
  }

  const taskState = readTaskStateSnapshot(appDir);
  const resource = taskState?.resources?.[scenarioTestFrontierTaskId] ?? null;
  const status = isRecord(resource?.status) ? resource.status : null;
  if (!status) return false;
  if (
    String(status.phase ?? "")
      .trim()
      .toLowerCase() !== "converged"
  ) {
    return false;
  }

  const evidence = stringList(status.evidence);
  if (evidence.length === 0) return false;

  const declaredActionCount = numberDetail(
    taskStatusEvidenceValue(evidence, "declared-normalization-actions"),
  );
  const actionableCount = numberDetail(
    taskStatusEvidenceValue(evidence, "actionable-plain-rows"),
  );
  const waitingCount = numberDetail(
    taskStatusEvidenceValue(evidence, "waiting-plain-rows"),
  );
  if (
    declaredActionCount !== 0 ||
    actionableCount !== 0 ||
    waitingCount === null
  ) {
    return false;
  }
  if (waitingCount !== observation.remainingSpecReferencedPlainScenarioCount) {
    return false;
  }

  const currentSourceCommit = taskStatusEvidenceValue(
    evidence,
    "origin-dev-commit",
  );
  const currentStrictPassed = taskStatusEvidenceValue(
    evidence,
    "strict-passed",
  );
  const currentMissingAdapters = numberDetail(
    taskStatusEvidenceValue(evidence, "missing-adapters"),
  );
  const currentPlainScenarioCount = numberDetail(
    taskStatusEvidenceValue(
      evidence,
      "remaining-spec-referenced-plain-scenario-units",
    ),
  );
  const currentRepoPlainFileCount = numberDetail(
    taskStatusEvidenceValue(evidence, "remaining-repo-plain-scenario-files"),
  );
  const currentUnrepresentedPlainRows = numberDetail(
    taskStatusEvidenceValue(evidence, "unrepresented-plain-rows"),
  );

  if (
    currentSourceCommit !== observation.sourceCommit ||
    currentStrictPassed !== String(observation.strictPassed) ||
    currentMissingAdapters !== observation.missingAdapterCount ||
    currentPlainScenarioCount !==
      observation.remainingSpecReferencedPlainScenarioCount ||
    currentRepoPlainFileCount !==
      observation.remainingRepoPlainScenarioFileCount ||
    currentUnrepresentedPlainRows !== 0
  ) {
    return false;
  }

  return true;
}

export function scenarioTestFrontierWakeEvent(
  event: Record<string, unknown>,
): ProjectAppEvent {
  const details = eventDetails(event);
  return {
    type: "project.task.tick",
    source: "aks-rp-e2e-app",
    target: { project: projectId, taskId: scenarioTestFrontierTaskId },
    reason: "strict-scenario-test-inventory-observed",
    data: {
      project: projectId,
      taskId: scenarioTestFrontierTaskId,
      task_id: scenarioTestFrontierTaskId,
      reason: "strict-scenario-test-inventory-observed",
      overrideWait: true,
      desiredRunnableLeaves: {
        min: scenarioTestFrontierMinLeaves,
        max: domainPolicyMaxConcurrent,
      },
      capacityRule:
        "For this normalization frontier, count only concrete one-spec domain leaves that are active/running, runnable/backlog, or exact accepted dispositions for current missingAdapterFiles. Review/attention residue, runtime/ops/focus work, spec-loop status, and compact-loop status do not satisfy moving normalization capacity.",
      instructions:
        "If strict inventory is red, account for each current missingAdapterFiles path. Create or advance enough concrete one-spec domain leaves to keep 3-5 useful leaves moving, or return an evidence-backed no-op only when each missing adapter already has exact active work, exact wait/escalation, or terminal disposition.",
      ...(isRecord(details.observation)
        ? { observation: details.observation }
        : {}),
    },
  };
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  owner: "app-ops",
  description:
    "Event-driven AKS RP e2e feature knowledge, spec verification, and app-ops organizer.",
  workspace: {
    kind: "git",
    repo: "https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner",
    localPath: "../aks-rp-e2e",
    branch: "dev",
  },

  budget: {
    sessionsPerDay: 200,
    tokensPerDay: 5_000_000,
    maxConcurrent: appControllerMaxConcurrent,
  },

  schedules: [
    {
      id: "pipeline-observer",
      enabled: true,
      // Live normalization throughput is bounded by terminal-run observation.
      // Poll represented ADO runs every minute so a completed run does not
      // leave its task and execution slot idle for another five minutes.
      intervalMs: 60_000,
      emits: [
        {
          type: "aks.pipeline.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "master-validation-staging-cycle",
      enabled: true,
      // Pipeline, campaign-head, and focused-PR transitions wake active work.
      // This schedule is only the healthy due cadence and slow recovery
      // backstop for missed observations or unchanged external recovery.
      intervalMs: masterValidationCycleIntervalMs,
      emits: [
        {
          type: "aks.master-validation.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "pull-request-observer",
      enabled: true,
      intervalMs: 300_000,
      emits: [
        {
          type: "aks.pull-request.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "workspace-integrity-observer",
      enabled: true,
      intervalMs: 3_600_000,
      emits: [
        {
          type: "aks.workspace.integrity.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "regular-learning",
      enabled: true,
      intervalMs: 3_600_000,
      emits: [
        {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "scheduled-learning",
            params: {
              lane: "learning",
              maxConcurrent: domainPolicyMaxConcurrent,
            },
          },
        },
      ],
    },
    {
      id: "durable-loop-pulse",
      enabled: true,
      intervalMs: 600_000,
      emits: [
        {
          type: "project.task.tick",
          target: { project: projectId, taskId: specLoopTaskId },
          action: "spec-loop",
          data: {
            project: projectId,
            reason: "scheduled-durable-loop-pulse",
          },
        },
        {
          type: "project.task.tick",
          target: { project: projectId, taskId: featureCompactLoopTaskId },
          action: "feature-compact-loop",
          data: {
            project: projectId,
            reason: "scheduled-durable-loop-pulse",
          },
        },
        {
          type: "project.task.tick",
          target: {
            project: projectId,
            taskId: masterValidationCompactTaskId,
          },
          action: "master-validation-compact",
          data: {
            project: projectId,
            reason: "scheduled-durable-loop-pulse",
          },
        },
      ],
    },
    {
      id: "repository-skill-maintenance",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        {
          type: "project.task.tick",
          action: "repository-skill-maintenance",
          target: {
            project: projectId,
            taskId: repositorySkillMaintenanceTaskId,
          },
          data: {
            project: projectId,
            taskId: repositorySkillMaintenanceTaskId,
            task_id: repositorySkillMaintenanceTaskId,
            reason: "scheduled-repository-skill-maintenance",
          },
        },
      ],
    },
    {
      id: "app-ops-heartbeat",
      enabled: true,
      intervalMs: 14_400_000,
      emits: [
        {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "app-ops-heartbeat",
            params: {
              maxConcurrent: domainPolicyMaxConcurrent,
              instruction:
                "Low-frequency app-ops heartbeat: look for missed project motion opportunities that fixed schedules and metrics did not catch. Check recent heartbeat/focus/watchdog findings before creating work. In aggressive-push mode, refill safe runnable work up to policy capacity, materialize grouped follow-up work for drained non-pass loops, record a finding/context update, request problem-solving, or no-op only with exact external-wait evidence. Do not run multi-step domain work from the app-ops session.",
              reviewChecklist: [
                "Check VM prerelease coverage, feature/spec/test gaps, and whether the current feature set can be planned with bun run plan --features ...",
                "Challenge stale source-holder, devbox, or authoritative-source blockers now that /app/sources/aks-rp is mounted.",
                "Look for stale blocked families, underfilled worker capacity, task-tree bloat needing app-ops rollup, and repeated app-ops/planner failures.",
                "Avoid duplicate heartbeat tasks by inspecting recent heartbeat/focus/watchdog outputs first.",
                "No-op is valid when the task tree already has clear active/review/runnable work.",
              ],
            },
          },
        },
      ],
    },
    {
      id: "scenario-test-frontier-observer",
      enabled: true,
      intervalMs: 1_800_000,
      emits: [
        {
          type: "aks.scenario-test-inventory.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "repo-ref-observer",
      enabled: true,
      intervalMs: 600_000,
      emits: [
        {
          type: "aks.repo-ref.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "focus-plan-proposal",
      enabled: false,
      intervalMs: 86_400_000,
      emits: [
        {
          type: "project.focus.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "scheduled-mid-term-focus-plan",
            mode: "plan",
          },
        },
      ],
    },
    {
      id: "focus-progress-review",
      enabled: false,
      intervalMs: 21_600_000,
      emits: [
        {
          type: "project.focus.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "scheduled-focus-progress-review",
            mode: "progress",
          },
        },
      ],
    },
  ],

  tasks: {
    accepts: aksTaskSelectors,
    resolve: resolveAksTask,
    validateAction: validateAksTaskAction,
  },

  events: [
    { type: "project.task.reconcile.started", target: projectTarget },
    { type: "project.task.reconcile.skipped", target: projectTarget },
    { type: "project.task.reconciled", target: projectTarget },
    { type: "project.task.handler.recovered", target: projectTarget },
    {
      type: "message.created",
      owner: "agent:app-ops",
      intents: ["approval-decision"],
    },
    { type: "aks.pipeline.check", target: projectTarget },
    { type: "aks.master-validation.check", target: projectTarget },
    { type: masterValidationCapacityPulseEventType, target: projectTarget },
    { type: "aks.pull-request.check", target: projectTarget },
    { type: "pull-request.state", target: projectTarget },
    { type: "aks.repo-ref.check", target: projectTarget },
    { type: "aks.repo-ref.observed", target: projectTarget },
    { type: "aks.repo-ref.changed", target: projectTarget },
    { type: "aks.workspace.integrity.check", target: projectTarget },
    { type: "aks.workspace.integrity.changed", target: projectTarget },
    { type: "aks.scenario-test-inventory.check", target: projectTarget },
    { type: "aks.scenario-test-inventory.observed", target: projectTarget },
    { type: "aks.node-image-publication.state", target: projectTarget },
    { type: "pipeline-run.state", target: projectTarget },
    { type: "pipeline.completed", target: projectTarget },
    { type: "pipeline-artifact.available", target: projectTarget },
    { type: "pipeline.spec.observed", target: projectTarget },
    { type: "pipeline.test.nonpassing", target: projectTarget },
    { type: "pipeline.queue.overdue", target: projectTarget },
  ],
  onEvent: routeAksEvent,

  actions: {
    "execute-run": {
      type: "async",
      description: "Request live execution for selected replanned paths.",
      inputSchema: actionInputSchema,
      event(params) {
        return {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "execute-run-action",
            params: {
              maxConcurrent: domainPolicyMaxConcurrent,
              action: "execute-run",
              params,
            },
          },
        };
      },
    },
    "advance-project": {
      type: "async",
      description:
        "Advance the project task tree until genuinely blocked, complete, or interrupted by an infra guard.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-action",
            params: {
              maxConcurrent: domainPolicyMaxConcurrent,
              ...input,
            },
          },
        };
      },
    },
    watch: {
      type: "async",
      description: "Start or resume app-ops review through the task tree.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "watch-request",
            params: {
              maxConcurrent: domainPolicyMaxConcurrent,
              ...input,
            },
          },
        };
      },
    },
    "investigate-problem": {
      type: "async",
      description:
        "Ask the problem solver to investigate one bounded blocker or root cause.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.problem.investigation.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-problem-investigation-request",
            params: input,
          },
        };
      },
    },
    "review-stall-risk": {
      type: "async",
      description:
        "Ask the app-ops deep-dive fallback to collect and judge suspicious stalled work without pulsing controllers.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.stall.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-stall-risk-review",
            mode: "risk-review",
            params: input,
          },
        };
      },
    },
    "dispatch-approval-packet": {
      type: "async",
      description:
        "Route one packet-linked decision to the project owner, escalating to a human only when human authority is explicitly required.",
      inputSchema: actionInputSchema,
      event(params) {
        return {
          type: "project.approval.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-approval-packet-dispatch-request",
            params:
              params && typeof params === "object" && !Array.isArray(params)
                ? params
                : {},
          },
        };
      },
    },
    "pulse-spec-loop": {
      type: "async",
      description:
        "Pulse the targeted long-lived spec verification loop task controller.",
      inputSchema: targetedTaskActionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        const taskId =
          typeof input.taskId === "string" && input.taskId.trim()
            ? input.taskId.trim()
            : specLoopTaskId;
        return {
          type: "project.task.tick",
          action: "spec-loop",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            action: "spec-loop",
            taskId,
            task_id: taskId,
            reason: "manual-spec-loop-pulse",
            params: input,
          },
        };
      },
    },
    "pulse-feature-compact-loop": {
      type: "async",
      description:
        "Pulse the targeted long-lived feature compact loop task controller.",
      inputSchema: targetedTaskActionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        const taskId =
          typeof input.taskId === "string" && input.taskId.trim()
            ? input.taskId.trim()
            : featureCompactLoopTaskId;
        return {
          type: "project.task.tick",
          action: "feature-compact-loop",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            action: "feature-compact-loop",
            taskId,
            task_id: taskId,
            reason: "manual-feature-compact-loop-pulse",
            params: input,
          },
        };
      },
    },
    "pulse-master-validation-compact": {
      type: "async",
      description:
        "Pulse the selector-first staging master-validation compact campaign.",
      inputSchema: targetedTaskActionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        const taskId =
          typeof input.taskId === "string" && input.taskId.trim()
            ? input.taskId.trim()
            : masterValidationCompactTaskId;
        return {
          type: "project.task.tick",
          action: "master-validation-compact",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            action: "master-validation-compact",
            taskId,
            task_id: taskId,
            reason: "manual-master-validation-compact-pulse",
            params: input,
          },
        };
      },
    },
    "pulse-scenario-frontier": {
      type: "async",
      description:
        "Pulse the targeted scenario-test missing-adapter normalization frontier.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.task.tick",
          target: { project: projectId, taskId: scenarioTestFrontierTaskId },
          data: {
            project: projectId,
            taskId: scenarioTestFrontierTaskId,
            task_id: scenarioTestFrontierTaskId,
            reason: "manual-scenario-frontier-pulse",
            desiredRunnableLeaves: {
              min: scenarioTestFrontierMinLeaves,
              max: domainPolicyMaxConcurrent,
            },
            params: input,
          },
        };
      },
    },
    "pulse-legacy-branch-reconciliation": {
      type: "async",
      description:
        "Reconcile legacy AKS task branches into origin/dev or an explicit rejected disposition.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.task.tick",
          action: "legacy-branch-reconciliation",
          target: {
            project: projectId,
            taskId: legacyBranchReconciliationTaskId,
          },
          data: {
            project: projectId,
            action: "legacy-branch-reconciliation",
            taskId: legacyBranchReconciliationTaskId,
            task_id: legacyBranchReconciliationTaskId,
            reason: "manual-legacy-branch-reconciliation-pulse",
            params: input,
          },
        };
      },
    },
    "pulse-repository-skill-maintenance": {
      type: "async",
      description:
        "Evaluate and refine the checked-in aks-rp-e2e repository skill through its stable maintenance task.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.task.tick",
          action: "repository-skill-maintenance",
          target: {
            project: projectId,
            taskId: repositorySkillMaintenanceTaskId,
          },
          data: {
            project: projectId,
            action: "repository-skill-maintenance",
            taskId: repositorySkillMaintenanceTaskId,
            task_id: repositorySkillMaintenanceTaskId,
            reason: "manual-repository-skill-maintenance-pulse",
            params: input,
          },
        };
      },
    },
  },
});

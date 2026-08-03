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
  loopRefillWakeForTaskEvent,
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
import { repoRefWaitExternalProducer } from "./agents/owner/workflows/wait-for-repo-ref-advance.js";

const projectId = "aks-rp-e2e";
const domainPolicyMaxConcurrent = 5;
const appOpsSupportConcurrent = 3;
// The runtime shares this budget across hot-reload controller generations.
const appControllerMaxConcurrent =
  domainPolicyMaxConcurrent + appOpsSupportConcurrent;
const scenarioTestFrontierTaskId = scenarioNormalizationTaskId;
export const masterValidationCycleTaskId = "master-validation-staging-cycle";
export const waitingFrontierReviewTaskId = "runtime/waiting-frontier-review";
const scenarioTestFrontierMinLeaves = 3;
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

const projectTarget = { project: projectId };
const masterValidationCycleIntervalMs = 21_600_000;
const masterValidationCycleWakeSkewMs = 60_000;

export function masterValidationCycleSlot(nowMs = Date.now()): number {
  return Math.floor(nowMs / masterValidationCycleIntervalMs);
}

export function masterValidationCampaignPulse(nowMs = Date.now()): number {
  return Math.floor(nowMs / 300_000);
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
  metadata?: { generation?: unknown };
  spec?: Record<string, unknown>;
  status?: { phase?: unknown; conditionIds?: unknown };
};

type TaskIntentSnapshot = ProjectAppTaskIntent;

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

type TaskStateAttempt = {
  taskId?: unknown;
};

type TaskStateSnapshot = {
  resources?: Record<string, TaskStateResource>;
  conditions?: Record<string, TaskStateCondition>;
  attempts?: Record<string, TaskStateAttempt>;
};

type ApprovalWaitContractProblem = {
  taskId: string;
  workflow?: string;
  phase?: string;
  conditionId: string;
  issues: string[];
};

type RepoRefWaitContractProblem = {
  taskId: string;
  workflow?: string;
  phase?: string;
  conditionId: string;
  repoRef: string;
  baselineCommit: string;
  issues: string[];
  replayReason?:
    "malformed-repo-ref-wait-contract" | "triggerless-pending-repo-ref-wait";
};

type SelfTaskStateWaitContractProblem = {
  taskId: string;
  workflow?: string;
  phase?: string;
  conditionId: string;
  issues: string[];
  repoRef?: string;
  baselineCommit?: string;
  replayReason?:
    "self-task-state-wait-contract" | "self-task-state-wait-after-repo-advance";
};

type TaskStateWaitReplay = {
  taskId: string;
  conditionId: string;
  type: "task-field" | "task-phase";
};

type RepoRefWaitReplay = {
  taskId: string;
  conditionId: string;
  repoRef: string;
  baselineCommit: string;
};

const canonicalApprovalDispatchDecisions = [
  "approve",
  "adjust",
  "hold",
  "decline",
  "reroute",
] as const;

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

function modeDetail(value: unknown): "achieve" | "maintain" | undefined {
  return value === "achieve" || value === "maintain" ? value : undefined;
}

function taskIntentSnapshotFromResource(
  taskId: string,
  resource: TaskStateResource | null,
  options?: { clearWorkflow?: boolean },
): TaskIntentSnapshot | null {
  const spec = isRecord(resource?.spec) ? resource?.spec : null;
  if (!spec) return null;

  const owner = stringDetail(spec, "owner");
  const outcome = stringDetail(spec, "outcome");
  const parentId = stringDetail(spec, "parentId");
  const mode = modeDetail(spec.mode);
  if (!owner || !outcome || !parentId || !mode) return null;

  const snapshot: TaskIntentSnapshot = {
    id: taskId,
    parentId,
    outcome,
    acceptance: stringList(spec.acceptance),
    mode,
    owner,
  };

  if (!options?.clearWorkflow) {
    const workflow = stringDetail(spec, "workflow");
    if (workflow) snapshot.workflow = workflow;
  }

  const input = isRecord(spec.input) ? spec.input : null;
  if (input) snapshot.input = input;

  const outputs = stringList(spec.outputs);
  if (outputs.length) snapshot.outputs = outputs;

  const priority = stringDetail(spec, "priority");
  if (["P0", "P1", "P2", "P3"].includes(priority)) {
    snapshot.priority = priority as "P0" | "P1" | "P2" | "P3";
  }

  const category = stringDetail(spec, "category");
  if (category) snapshot.category = category;

  const dependsOn = stringList(spec.dependsOn);
  if (dependsOn.length) snapshot.dependsOn = dependsOn;

  return snapshot;
}

function repoRefWaitNeedsDirectOwnerReplay(
  details: Record<string, unknown>,
): boolean {
  if (stringDetail(details, "action") !== "repo-ref-wait-contract-replay") {
    return false;
  }
  const issues = stringList(details.issues);
  return issues.some((issue) =>
    issue.includes("generic origin/dev churn is not such a producer"),
  );
}

function repoRefOwnerHandoffReplayIntent(
  details: Record<string, unknown>,
): TaskIntentSnapshot | null {
  const taskIntent = recordDetail(details, "taskIntent", "task_intent");
  if (!taskIntent) return null;
  const taskId = stringDetail(taskIntent, "id");
  if (!taskId) return null;

  const snapshot = taskIntentSnapshotFromResource(
    taskId,
    { spec: taskIntent },
    { clearWorkflow: true },
  );
  if (!snapshot) return null;

  const input = isRecord(snapshot.input) ? { ...snapshot.input } : {};
  const repoRef = stringDetail(input, "baseRef") || "origin/dev";
  const previousBaselineCommit = stringDetail(input, "resumeBaselineCommit");
  input.repoRefOwnerHandoff = {
    reason: "repo-ref-wait-owner-handoff",
    preserveSameTaskId: true,
    priorWorkflow: "wait-for-repo-ref-advance",
    ...(previousBaselineCommit ? { previousBaselineCommit } : {}),
  };
  snapshot.input = input;
  snapshot.acceptance = [
    ...snapshot.acceptance,
    `Treat the previous ${repoRef} baseline wait${previousBaselineCommit ? ` for ${previousBaselineCommit}` : ""} as already satisfied by the wake; re-read only the same bounded scope from current repo truth.`,
    `If the same scope still needs a supported ${repoRef} wait, keep this same task id waiting from the current baseline instead of creating a child or successor wait-named descendant.`,
    "If the inherited wait wording is stale after the wake, revise that wording on this same task path rather than spawning another repo-ref carrier.",
  ];
  return snapshot;
}

function taskIntentSnapshotFromEvent(
  details: Record<string, unknown>,
): TaskIntentSnapshot | null {
  if (stringDetail(details, "action") === "repo-ref-owner-handoff-replay") {
    return repoRefOwnerHandoffReplayIntent(details);
  }

  const taskIntent = recordDetail(details, "taskIntent", "task_intent");
  if (!taskIntent) return null;
  const taskId = stringDetail(taskIntent, "id");
  return taskId
    ? taskIntentSnapshotFromResource(
        taskId,
        { spec: taskIntent },
        {
          clearWorkflow: repoRefWaitNeedsDirectOwnerReplay(details),
        },
      )
    : null;
}

type LiveTaskReadiness = {
  state?: unknown;
};

type LiveTaskTreeTask = {
  id?: unknown;
  phase?: unknown;
  input?: unknown;
  evidence?: unknown;
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
    if (coveringTasks.length) {
      coveredByTask[`${kind}:${normalizedPath}`] = coveringTasks;
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

function selfTaskStateWaitConditionProblem(
  taskId: string,
  conditionId: string,
  condition: TaskStateCondition | null,
): SelfTaskStateWaitContractProblem | null {
  const spec = isRecord(condition?.spec) ? condition.spec : {};
  const type = stringDetail(spec, "type");
  if (type !== "task-field" && type !== "task-phase") return null;
  const subject = stringDetail(spec, "subject");
  if (subject !== `task:${taskId}`) return null;

  return {
    taskId,
    conditionId,
    issues: [
      "task state wait cannot observe the waiting task itself",
      `type=${JSON.stringify(type)}`,
      `subject=${JSON.stringify(subject)}`,
    ],
    replayReason: "self-task-state-wait-contract",
  };
}

export function malformedSelfTaskStateWaitContract(
  appDir: string,
  taskId: string,
): SelfTaskStateWaitContractProblem | null {
  const state = readTaskStateSnapshot(appDir);
  if (!state) return null;
  const resource = state.resources?.[taskId];
  if (!resource) return null;
  const phase = stringDetail(
    isRecord(resource.status) ? resource.status : {},
    "phase",
  );
  if (phase !== "waiting") return null;
  const spec = isRecord(resource.spec) ? resource.spec : {};
  const input = isRecord(spec.input) ? spec.input : {};
  for (const conditionId of stringList(resource.status?.conditionIds)) {
    const problem = selfTaskStateWaitConditionProblem(
      taskId,
      conditionId,
      state.conditions?.[conditionId] ?? null,
    );
    if (!problem) continue;
    return {
      ...problem,
      workflow: stringDetail(spec, "workflow"),
      phase,
      repoRef: stringDetail(input, "baseRef") || "origin/dev",
      baselineCommit:
        stringDetail(input, "baselineOriginDev") ||
        stringDetail(input, "resumeBaselineCommit"),
    };
  }
  return null;
}

function selfTaskStateWaitAfterRepoAdvanceCandidates(
  appDir: string,
  repoRef: string,
  commit: string,
): SelfTaskStateWaitContractProblem[] {
  const state = readTaskStateSnapshot(appDir);
  if (!state?.resources || !state.conditions) return [];
  const problems: SelfTaskStateWaitContractProblem[] = [];
  for (const [taskId, resource] of Object.entries(state.resources)) {
    const phase = stringDetail(
      isRecord(resource.status) ? resource.status : {},
      "phase",
    );
    if (phase !== "waiting") continue;
    const spec = isRecord(resource.spec) ? resource.spec : {};
    const input = isRecord(spec.input) ? spec.input : {};
    const baselineCommit =
      stringDetail(input, "baselineOriginDev") ||
      stringDetail(input, "resumeBaselineCommit");
    const taskRepoRef = stringDetail(input, "baseRef") || "origin/dev";
    if (
      !baselineCommit ||
      baselineCommit === commit ||
      taskRepoRef !== repoRef
    ) {
      continue;
    }

    const conditionIds = stringList(resource.status?.conditionIds);
    const hasRepoRefCondition = conditionIds.some((conditionId) => {
      const condition = state.conditions?.[conditionId] ?? null;
      const conditionSpec = isRecord(condition?.spec) ? condition.spec : {};
      return stringDetail(conditionSpec, "type") === "aks.repo-ref.observed";
    });
    if (hasRepoRefCondition) continue;

    for (const conditionId of conditionIds) {
      const problem = selfTaskStateWaitConditionProblem(
        taskId,
        conditionId,
        state.conditions?.[conditionId] ?? null,
      );
      if (!problem) continue;
      problems.push({
        ...problem,
        workflow: stringDetail(spec, "workflow"),
        phase,
        repoRef,
        baselineCommit,
        issues: [
          ...problem.issues,
          "missing repo-ref wake after baseline advance",
          `baselineCommit=${JSON.stringify(baselineCommit)}`,
          `observed.commit=${JSON.stringify(commit)}`,
        ],
        replayReason: "self-task-state-wait-after-repo-advance",
      });
      break;
    }
  }
  return problems;
}

function unsupportedRepoRefWaitIssue(
  taskId: string,
  spec: Record<string, unknown>,
): string | null {
  const input = isRecord(spec.input) ? spec.input : {};
  const producer = repoRefWaitExternalProducer({
    taskId,
    repoRef: stringDetail(input, "baseRef") || "origin/dev",
    baselineCommit: stringDetail(input, "resumeBaselineCommit"),
    specId: stringDetail(input, "specId"),
    sourceCommit: stringDetail(input, "sourceCommit"),
    publicationBranch: stringDetail(input, "publicationBranch"),
    sourceBranch: stringDetail(input, "sourceBranch"),
    authorizedRef: stringDetail(input, "authorizedRef"),
    pullRequestId: stringDetail(input, "pullRequestId", "pullRequestNumber"),
  });
  return producer.supported
    ? null
    : (producer.reason ?? "unsupported repo-ref wait");
}

function repoRefWaitConditionProblem(
  taskId: string,
  resource: TaskStateResource,
  conditionId: string,
  condition: TaskStateCondition | null,
): RepoRefWaitContractProblem | null {
  const spec = isRecord(resource.spec) ? resource.spec : {};
  if (stringDetail(spec, "workflow") !== "wait-for-repo-ref-advance") {
    return null;
  }
  const phase = stringDetail(
    isRecord(resource.status) ? resource.status : {},
    "phase",
  );
  if (phase !== "waiting") return null;

  const input = isRecord(spec.input) ? spec.input : {};
  const repoRef = stringDetail(input, "baseRef");
  const baselineCommit = stringDetail(input, "resumeBaselineCommit");
  const conditionSpec = isRecord(condition?.spec) ? condition?.spec : {};
  const expected = isRecord(conditionSpec.expected)
    ? conditionSpec.expected
    : {};
  const issues: string[] = [];

  if (!repoRef) issues.push("missing input.baseRef");
  if (!baselineCommit) issues.push("missing input.resumeBaselineCommit");
  if (!conditionId) issues.push("missing conditionId");
  const unsupportedRepoRefWait = unsupportedRepoRefWaitIssue(taskId, spec);
  if (unsupportedRepoRefWait) issues.push(unsupportedRepoRefWait);
  if (stringDetail(conditionSpec, "type") !== "aks.repo-ref.observed") {
    issues.push(`type=${JSON.stringify(conditionSpec.type ?? null)}`);
  }
  if (stringDetail(conditionSpec, "subject") !== `repoRef:${repoRef}`) {
    issues.push(`subject=${JSON.stringify(conditionSpec.subject ?? null)}`);
  }
  if (stringDetail(expected, "field") !== "commit") {
    issues.push(`expected.field=${JSON.stringify(expected.field ?? null)}`);
  }
  if (stringDetail(expected, "notEquals") !== baselineCommit) {
    issues.push(
      `expected.notEquals=${JSON.stringify(expected.notEquals ?? null)}`,
    );
  }

  if (!issues.length) return null;
  return {
    taskId,
    workflow: stringDetail(spec, "workflow"),
    phase,
    conditionId,
    repoRef,
    baselineCommit,
    issues,
    replayReason: "malformed-repo-ref-wait-contract",
  };
}

function hasPersistedAttempt(
  state: TaskStateSnapshot,
  taskId: string,
): boolean {
  return Object.values(state.attempts ?? {}).some(
    (attempt) => stringDetail(attempt, "taskId") === taskId,
  );
}

function pendingRepoRefWaitReplayProblem(
  state: TaskStateSnapshot,
  taskId: string,
  resource: TaskStateResource,
  repoRef: string,
  commit: string,
): RepoRefWaitContractProblem | null {
  const spec = isRecord(resource.spec) ? resource.spec : {};
  if (stringDetail(spec, "workflow") !== "wait-for-repo-ref-advance") {
    return null;
  }
  const phase = stringDetail(
    isRecord(resource.status) ? resource.status : {},
    "phase",
  );
  if (phase !== "pending") return null;

  const input = isRecord(spec.input) ? spec.input : {};
  const taskRepoRef = stringDetail(input, "baseRef");
  const baselineCommit = stringDetail(input, "resumeBaselineCommit");
  const conditionIds = stringList(resource.status?.conditionIds);
  const unsupportedRepoRefWait = unsupportedRepoRefWaitIssue(taskId, spec);
  if (taskRepoRef !== repoRef) return null;
  if (!baselineCommit || baselineCommit === commit) return null;
  if (conditionIds.length > 0) return null;
  if (hasPersistedAttempt(state, taskId)) return null;

  return {
    taskId,
    workflow: stringDetail(spec, "workflow"),
    phase,
    conditionId: "",
    repoRef: taskRepoRef,
    baselineCommit,
    issues: [
      ...(unsupportedRepoRefWait ? [unsupportedRepoRefWait] : []),
      "pending-phase-without-attempt",
      "missing conditionId",
      `observed.commit=${JSON.stringify(commit)}`,
    ],
    replayReason: "triggerless-pending-repo-ref-wait",
  };
}

export function malformedRepoRefWaitContract(
  appDir: string,
  taskId: string,
): RepoRefWaitContractProblem | null {
  const state = readTaskStateSnapshot(appDir);
  if (!state) return null;
  const resource = state.resources?.[taskId];
  if (!resource) return null;
  const conditionIds = stringList(resource.status?.conditionIds);
  if (!conditionIds.length) {
    return repoRefWaitConditionProblem(taskId, resource, "", null);
  }
  for (const conditionId of conditionIds) {
    const problem = repoRefWaitConditionProblem(
      taskId,
      resource,
      conditionId,
      state.conditions?.[conditionId] ?? null,
    );
    if (problem) return problem;
  }
  return null;
}

function taskStateFieldValue(
  resource: TaskStateResource | null,
  field: string,
  fallback?: { phase?: string },
): unknown {
  if (resource) {
    const status = isRecord(resource.status) ? resource.status : {};
    if (field in status) return status[field];
    const spec = isRecord(resource.spec) ? resource.spec : {};
    if (field in spec) return spec[field];
    const metadata = isRecord(resource.metadata) ? resource.metadata : {};
    if (field in metadata) return metadata[field];
  }
  if (field === "phase" && typeof fallback?.phase === "string") {
    return fallback.phase;
  }
  return undefined;
}

function taskStateConditionSatisfied(
  resource: TaskStateResource | null,
  condition: TaskStateCondition | null,
  fallback?: { phase?: string },
): boolean {
  const conditionSpec = isRecord(condition?.spec) ? condition.spec : {};
  const type = stringDetail(conditionSpec, "type");
  const expected = isRecord(conditionSpec.expected)
    ? conditionSpec.expected
    : {};
  if (type === "task-phase") {
    const phase = String(
      taskStateFieldValue(resource, "phase", fallback) ?? "",
    ).trim();
    const equals = stringDetail(expected, "equals");
    if (equals) return phase === equals;
    const notEquals = expected.notEquals;
    if (typeof notEquals === "string") return phase !== notEquals;
    const anyOf = Array.isArray(expected.anyOf)
      ? expected.anyOf.filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        )
      : [];
    if (anyOf.length) return anyOf.includes(phase);
    return false;
  }
  if (type !== "task-field") return false;
  const field = stringDetail(expected, "field");
  if (!field) return false;
  const value = taskStateFieldValue(resource, field, fallback);
  if (Object.prototype.hasOwnProperty.call(expected, "equals")) {
    return value === expected.equals;
  }
  if (Object.prototype.hasOwnProperty.call(expected, "notEquals")) {
    return value !== expected.notEquals;
  }
  if (Array.isArray(expected.anyOf)) {
    return expected.anyOf.includes(value);
  }
  return false;
}

function satisfiedTaskStateWaitReplays(
  appDir: string,
  subjectTaskId: string,
  options?: { phase?: string },
): TaskStateWaitReplay[] {
  const state = readTaskStateSnapshot(appDir);
  if (!state?.resources || !state.conditions) return [];
  const subject = state.resources[subjectTaskId] ?? null;
  if (!subject && !options?.phase) return [];
  const replays: TaskStateWaitReplay[] = [];
  for (const [taskId, resource] of Object.entries(state.resources)) {
    const phase = stringDetail(
      isRecord(resource.status) ? resource.status : {},
      "phase",
    );
    if (phase !== "waiting") continue;
    for (const conditionId of stringList(resource.status?.conditionIds)) {
      const condition = state.conditions[conditionId] ?? null;
      const conditionSpec = isRecord(condition?.spec) ? condition.spec : {};
      const type = stringDetail(conditionSpec, "type");
      if (type !== "task-field" && type !== "task-phase") continue;
      if (stringDetail(conditionSpec, "subject") !== `task:${subjectTaskId}`) {
        continue;
      }
      if (!taskStateConditionSatisfied(subject, condition, options)) continue;
      replays.push({ taskId, conditionId, type });
      break;
    }
  }
  return replays;
}

function satisfiedRepoRefWaitReplays(
  appDir: string,
  repoRef: string,
  commit: string,
): RepoRefWaitReplay[] {
  const state = readTaskStateSnapshot(appDir);
  if (!state?.resources || !state.conditions) return [];
  const replays: RepoRefWaitReplay[] = [];
  for (const [taskId, resource] of Object.entries(state.resources)) {
    if (hasPersistedAttempt(state, taskId)) continue;
    const spec = isRecord(resource.spec) ? resource.spec : {};
    const phase = stringDetail(
      isRecord(resource.status) ? resource.status : {},
      "phase",
    );
    if (stringDetail(spec, "workflow") !== "wait-for-repo-ref-advance") {
      continue;
    }
    if (phase !== "waiting") continue;
    const conditionIds = stringList(resource.status?.conditionIds);
    if (!conditionIds.length) continue;
    for (const conditionId of conditionIds) {
      const condition = state.conditions[conditionId] ?? null;
      if (
        repoRefWaitConditionProblem(taskId, resource, conditionId, condition)
      ) {
        continue;
      }
      const conditionSpec = isRecord(condition?.spec) ? condition.spec : {};
      const expected = isRecord(conditionSpec.expected)
        ? conditionSpec.expected
        : {};
      const baselineCommit = stringDetail(expected, "notEquals");
      if (
        stringDetail(conditionSpec, "type") !== "aks.repo-ref.observed" ||
        stringDetail(conditionSpec, "subject") !== `repoRef:${repoRef}` ||
        stringDetail(expected, "field") !== "commit" ||
        !baselineCommit ||
        baselineCommit === commit
      ) {
        continue;
      }
      replays.push({ taskId, conditionId, repoRef, baselineCommit });
      break;
    }
  }
  return replays;
}

function satisfiedRepoRefWaitReplayForTask(
  appDir: string,
  taskId: string,
): RepoRefWaitReplay | null {
  const state = readTaskStateSnapshot(appDir);
  if (!state?.resources || !state.conditions) return null;
  if (hasPersistedAttempt(state, taskId)) return null;
  const resource = state.resources[taskId] ?? null;
  if (!resource) return null;
  const spec = isRecord(resource.spec) ? resource.spec : {};
  const phase = stringDetail(
    isRecord(resource.status) ? resource.status : {},
    "phase",
  );
  if (stringDetail(spec, "workflow") !== "wait-for-repo-ref-advance") {
    return null;
  }
  if (phase !== "waiting") return null;
  for (const conditionId of stringList(resource.status?.conditionIds)) {
    const condition = state.conditions[conditionId] ?? null;
    if (repoRefWaitConditionProblem(taskId, resource, conditionId, condition)) {
      continue;
    }
    const conditionSpec = isRecord(condition?.spec) ? condition.spec : {};
    const expected = isRecord(conditionSpec.expected)
      ? conditionSpec.expected
      : {};
    const repoRef = stringDetail(conditionSpec, "subject").replace(
      /^repoRef:/,
      "",
    );
    const baselineCommit = stringDetail(expected, "notEquals");
    if (
      stringDetail(conditionSpec, "type") !== "aks.repo-ref.observed" ||
      !repoRef ||
      !baselineCommit ||
      stringDetail(condition?.status, "state") !== "true"
    ) {
      continue;
    }
    return { taskId, conditionId, repoRef, baselineCommit };
  }
  return null;
}

function repoRefWaitBackfillCandidates(
  appDir: string,
  repoRef: string,
  commit: string,
): RepoRefWaitContractProblem[] {
  const state = readTaskStateSnapshot(appDir);
  if (!state?.resources) return [];
  const candidates: RepoRefWaitContractProblem[] = [];
  for (const [taskId, resource] of Object.entries(state.resources)) {
    const conditionIds = stringList(resource.status?.conditionIds);
    const malformedProblem = conditionIds.length
      ? repoRefWaitConditionProblem(
          taskId,
          resource,
          conditionIds[0],
          state.conditions?.[conditionIds[0]] ?? null,
        )
      : repoRefWaitConditionProblem(taskId, resource, "", null);
    const pendingProblem = pendingRepoRefWaitReplayProblem(
      state,
      taskId,
      resource,
      repoRef,
      commit,
    );
    const problem = malformedProblem ?? pendingProblem;
    if (!problem) continue;
    if (problem.repoRef !== repoRef) continue;
    if (!problem.baselineCommit || problem.baselineCommit === commit) continue;
    candidates.push(problem);
  }
  return candidates;
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
  "pipeline.test.nonpassing",
]);

const aksTaskSelectors: EventSelector[] = [
  { type: "project.task.tick", target: projectTarget },
  { type: "pipeline.failure.observed", target: projectTarget },
  { type: "pipeline.test.nonpassing", target: projectTarget },
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
      id: `domain/master-validation-failure/${safeTaskIdPart(specId, "spec")}/${safeTaskIdPart(failureFingerprint, "failure")}`,
      parentId: "group/domain-work",
      outcome: pipelineFailure
        ? "Repair the repository-owned master-validation pipeline/bootstrap failure that prevented any parseable spec verdict, then prove the accumulated fix through the frozen campaign and current main."
        : `Classify and resolve the progressively observed master-validation failure or temporary admission exclusion for ${specId} without waiting for the aggregate pipeline to finish.`,
      acceptance: pipelineFailure
        ? [
            "Inspect the exact failed Azure pipeline step and logs; absence of a spec verdict is actionable pipeline repair, not an inconclusive product result.",
            "Keep the repair in one focused PR to main and merge its exact unmerged head into the frozen campaign without waiting for PR merge.",
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
            "Repeated observations revise this stable fingerprinted task and its Condition; they do not create per-run recovery tasks.",
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
      ],
      mode: "maintain",
      owner: "app-ops",
      priority: "P1",
    };
  }

  switch (event.type) {
    case "project.task.tick": {
      const action = stringDetail(details, "action");
      if (
        action === "repo-ref-owner-handoff-replay" ||
        action === "repo-ref-wait-contract-replay" ||
        action === "repo-ref-condition-satisfied"
      ) {
        const replayIntent = taskIntentSnapshotFromEvent(details);
        if (replayIntent) return replayIntent;
      }
      if (
        action === "waiting-frontier-review" ||
        taskId === waitingFrontierReviewTaskId
      ) {
        return {
          id: waitingFrontierReviewTaskId,
          parentId: "group/app-operations",
          outcome:
            "Continuously review waiting and attention work from current facts and restore a bounded sample to an active recovery path.",
          acceptance: [
            "Read current task state and hot external facts instead of trusting stored summaries.",
            "For each sampled task, choose one truthful outcome: same-task retry after changed evidence, an exact observed wait, a sent escalation across an ownership boundary, or a terminal disposition with evidence.",
            "Treat a true Condition as generic-reconciler-owned ready work; do not retry or unblock a task merely because its Condition is satisfied.",
            "Do not leave a producerless Condition or an unattended attention task asleep.",
          ],
          mode: "maintain",
          owner: "app-ops",
          input: {
            maxConcurrent: domainPolicyMaxConcurrent,
            instructions: [
              "Treat runtime phase=waiting as the current blocked representation; do not search only for the retired blocked phase.",
              "A true Condition is already level-triggered ready work. Do not return retry-task or unblock-task for it; the generic task controller owns the event wake and bounded passive resync.",
              "Route a repository wait through wait-for-repo-ref-advance only when a named external producer or publication can directly change the exact row; otherwise return known same-spec source work to its domain owner/workflow. Preserve owner=aks-explorer whenever the bounded post-wake recheck is still AKS domain judgment.",
              "For scenario-normalization work, a future main-branch spec pass is not a valid producer: it cannot verify or publish the task-owned source commit. Return legacy pipeline.spec.observed waits for refs/heads/main to the same spec-live-reconciliation task for current-source repair, exact live proof, or explicit escalation.",
              "Return stale Conditions with no current producer to the task owner for fresh judgment.",
              "Preserve a human or external wait only with exact correlation and durable send proof.",
              "Review attention tasks that have no active retry or recovery consumer.",
              "When recovery crosses a real human ownership boundary through approval-dispatch, first write the referenced packet and create the workflow task with non-empty input.packetPath, input.pathId, and input.requestedAction. Do not declare an approval-dispatch task that its workflow cannot execute.",
              "Do not compete with workflow-to-owner fallback already in flight; inspect current attempts and controller coverage first.",
              "Choose up to maxConcurrent uncovered tasks, re-read every selected generation and phase immediately before finishing, and return only still-applicable state-changing actions.",
            ],
          },
          priority: "P0",
          category: "ops",
        };
      }
      if (action === "spec-loop" || taskId === specLoopTaskId) {
        return standingLoopIntent(specLoopTaskId);
      }
      if (
        action === "feature-compact-loop" ||
        taskId === featureCompactLoopTaskId
      ) {
        return standingLoopIntent(featureCompactLoopTaskId);
      }
      if (taskId === scenarioTestFrontierTaskId) {
        return standingLoopIntent(scenarioNormalizationTaskId);
      }
      if (taskId === masterValidationCycleTaskId) {
        return {
          id: masterValidationCycleTaskId,
          parentId: "group/domain-work",
          outcome:
            "Continuously validate master validation from current main; after a failure, keep testing one frozen-main campaign branch containing focused unmerged fixes until those fixes merge and current main passes.",
          acceptance: [
            "Each due cycle queues pipeline 467665 with feature_set=master-validation, target=staging, slices=12, slice_max_parallel=6, branch main, and the exact resolved origin/main commit.",
            "Only one aggregate master-validation cycle is active at a time.",
            "Completed slice artifacts are observed while the aggregate run is still active and each nonpassing spec becomes one stable fingerprinted sibling known-issue task.",
            "A failed main run forks one campaign branch from that exact commit; focused issue PR heads merge onto the same branch in stable order without rebasing onto newer main.",
            "A failed campaign reruns immediately when its accumulated fix heads change and every six hours when unchanged, so repository fixes and deployed product recovery are both observed without rebasing onto newer main.",
            "Only a green campaign may wait for its focused PRs to merge, and only a later passing full run from current main verifies the standing task green.",
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
        input: { problemKey, targetTaskId: taskId || null },
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
          "Deliver one exact AKS approval packet through the human-facing approval path.",
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

  if (
    event.type === "project.task.reconcile.started" ||
    event.type === "project.task.reconcile.skipped"
  ) {
    return {
      ownerVisibleReadoutRefreshed,
      eventType: event.type,
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
    const details = eventDetails(event);
    const appDir = ctx.appPath(".");
    const reconciledTaskId = targetTaskId(event);
    const taskState = readTaskStateSnapshot(appDir);
    const reconciledResource = reconciledTaskId
      ? (taskState?.resources?.[reconciledTaskId] ?? null)
      : null;
    const specProof = reconciledTaskId
      ? syncSpecLiveProof(appDir, reconciledTaskId)
      : { changed: false };
    const featureCompactProjection = reconciledTaskId
      ? syncFeatureCompactProjection(appDir, reconciledTaskId)
      : { changed: false };
    const wake = loopRefillWakeForTaskEvent(appDir, event);
    if (wake) ctx.emit(wake);
    const actionsApplied = Array.isArray(details.actionsApplied)
      ? details.actionsApplied.filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        )
      : [];
    const continueWaitingFrontierReview =
      reconciledTaskId === waitingFrontierReviewTaskId &&
      details.disposition === "converged" &&
      actionsApplied.length > 0;
    const reviewNewAttention =
      details.disposition === "attention" &&
      Boolean(reconciledTaskId) &&
      reconciledTaskId !== waitingFrontierReviewTaskId;
    const replayRepoRefOwnerHandoff =
      details.disposition === "owner-handoff" &&
      stringDetail(details, "handler") ===
        "workflow:wait-for-repo-ref-advance" &&
      Boolean(reconciledTaskId);
    const repoRefOwnerHandoffIntent = reconciledTaskId
      ? taskIntentSnapshotFromResource(reconciledTaskId, reconciledResource, {
          clearWorkflow: true,
        })
      : null;
    const malformedApprovalWaitReplay =
      details.disposition === "waiting" &&
      Boolean(reconciledTaskId) &&
      malformedApprovalWaitContract(appDir, reconciledTaskId);
    const malformedSelfTaskStateWaitReplay =
      details.disposition === "waiting" &&
      Boolean(reconciledTaskId) &&
      malformedSelfTaskStateWaitContract(appDir, reconciledTaskId);
    const malformedSelfTaskStateWaitIntent = reconciledTaskId
      ? taskIntentSnapshotFromResource(reconciledTaskId, reconciledResource)
      : null;
    const repoRefWaitReplay =
      details.disposition === "waiting" && reconciledTaskId
        ? satisfiedRepoRefWaitReplayForTask(appDir, reconciledTaskId)
        : null;
    const taskStateWaitReplays = reconciledTaskId
      ? satisfiedTaskStateWaitReplays(appDir, reconciledTaskId, {
          phase:
            typeof details.disposition === "string"
              ? details.disposition
              : undefined,
        })
      : [];
    if (continueWaitingFrontierReview) {
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
        },
        urgency: "high",
        action: "waiting-frontier-review",
        data: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
          task_id: waitingFrontierReviewTaskId,
          reason: "continue-after-applied-recovery-actions",
        },
      });
    }
    if (reviewNewAttention) {
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
        },
        urgency: "high",
        action: "waiting-frontier-review",
        data: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
          task_id: waitingFrontierReviewTaskId,
          reason: "task-entered-attention",
          attentionTaskId: reconciledTaskId,
          attentionGeneration: details.generation ?? null,
        },
      });
    }
    if (replayRepoRefOwnerHandoff) {
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: reconciledTaskId,
        },
        urgency: "high",
        action: "repo-ref-owner-handoff-replay",
        data: {
          project: projectId,
          taskId: reconciledTaskId,
          task_id: reconciledTaskId,
          reason: "repo-ref-wait-owner-handoff",
          previousDisposition: details.disposition,
          previousHandler: stringDetail(details, "handler"),
          ...(repoRefOwnerHandoffIntent
            ? { taskIntent: repoRefOwnerHandoffIntent }
            : {}),
        },
      });
    }
    if (malformedApprovalWaitReplay && reconciledTaskId) {
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: reconciledTaskId,
        },
        urgency: "high",
        action: "approval-wait-contract-replay",
        overrideWait: true,
        data: {
          project: projectId,
          taskId: reconciledTaskId,
          task_id: reconciledTaskId,
          reason: "malformed-approval-wait-contract",
          overrideWait: true,
          conditionId: malformedApprovalWaitReplay.conditionId,
          issues: malformedApprovalWaitReplay.issues,
          workflow: malformedApprovalWaitReplay.workflow,
        },
      });
    }
    if (malformedSelfTaskStateWaitReplay && reconciledTaskId) {
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: reconciledTaskId,
        },
        urgency: "high",
        action: "task-state-wait-contract-replay",
        overrideWait: true,
        data: {
          project: projectId,
          taskId: reconciledTaskId,
          task_id: reconciledTaskId,
          reason:
            malformedSelfTaskStateWaitReplay.replayReason ??
            "self-task-state-wait-contract",
          overrideWait: true,
          conditionId: malformedSelfTaskStateWaitReplay.conditionId,
          issues: malformedSelfTaskStateWaitReplay.issues,
          workflow: malformedSelfTaskStateWaitReplay.workflow,
          repoRef: malformedSelfTaskStateWaitReplay.repoRef,
          baselineCommit: malformedSelfTaskStateWaitReplay.baselineCommit,
          ...(malformedSelfTaskStateWaitIntent
            ? { taskIntent: malformedSelfTaskStateWaitIntent }
            : {}),
        },
      });
    }
    for (const replay of taskStateWaitReplays) {
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: replay.taskId,
        },
        urgency: "high",
        action: "task-state-wait-replay",
        data: {
          project: projectId,
          taskId: replay.taskId,
          task_id: replay.taskId,
          reason: "task-state-condition-satisfied",
          conditionId: replay.conditionId,
          conditionType: replay.type,
          subjectTaskId: reconciledTaskId,
        },
      });
    }
    return {
      refillWake: Boolean(wake),
      waitingFrontierContinuation: continueWaitingFrontierReview,
      waitingFrontierAttentionWake: reviewNewAttention,
      repoRefOwnerHandoffReplay: replayRepoRefOwnerHandoff,
      malformedApprovalWaitReplay: Boolean(malformedApprovalWaitReplay),
      malformedApprovalWaitProblem: malformedApprovalWaitReplay,
      malformedSelfTaskStateWaitReplay: Boolean(
        malformedSelfTaskStateWaitReplay,
      ),
      malformedSelfTaskStateWaitProblem: malformedSelfTaskStateWaitReplay,
      taskStateWaitReplay: taskStateWaitReplays.length > 0,
      taskStateWaitReplayTargets: taskStateWaitReplays,
      specProof,
      featureCompactProjection,
    };
  }
  if (event.type === "aks.pipeline.check") return observeAksPipelines(ctx);
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
          gate.reason === "campaign-active"
            ? "master-validation-campaign-reconcile"
            : "scheduled-six-hour-master-validation",
        cycleSlot: masterValidationCycleSlot(),
        pulse: masterValidationCampaignPulse(),
      },
    });
    return {
      masterValidationWake: true,
      reason: gate.reason,
      queuedAt: gate.queuedAt ?? null,
      runId: gate.runId ?? null,
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
  if (event.type === "aks.pull-request.check")
    return observeAksPullRequests(ctx);
  if (event.type === "aks.repo-ref.check") return observeRepoRefChanges(ctx);
  if (event.type === "aks.repo-ref.observed") {
    const details = eventDetails(event);
    const repoRef = stringDetail(details, "repoRef", "repo_ref");
    const commit = stringDetail(details, "commit");
    const taskState = readTaskStateSnapshot(ctx.appPath("."));
    const satisfiedRepoRefWaits = satisfiedRepoRefWaitReplays(
      ctx.appPath("."),
      repoRef,
      commit,
    );
    const malformedRepoRefWaitReplays = repoRefWaitBackfillCandidates(
      ctx.appPath("."),
      repoRef,
      commit,
    );
    const malformedSelfTaskStateWaitReplays =
      selfTaskStateWaitAfterRepoAdvanceCandidates(
        ctx.appPath("."),
        repoRef,
        commit,
      );
    for (const replay of satisfiedRepoRefWaits) {
      const taskIntent = taskIntentSnapshotFromResource(
        replay.taskId,
        taskState?.resources?.[replay.taskId] ?? null,
      );
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId: replay.taskId },
        urgency: "high",
        action: "repo-ref-condition-satisfied",
        data: {
          project: projectId,
          taskId: replay.taskId,
          task_id: replay.taskId,
          reason: "repo-ref-condition-satisfied",
          repoRef,
          commit,
          baselineCommit: replay.baselineCommit,
          conditionId: replay.conditionId,
          ...(taskIntent ? { taskIntent } : {}),
        },
      });
    }
    for (const problem of malformedRepoRefWaitReplays) {
      const taskIntent = taskIntentSnapshotFromResource(
        problem.taskId,
        taskState?.resources?.[problem.taskId] ?? null,
      );
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId: problem.taskId },
        urgency: "high",
        action: "repo-ref-wait-contract-replay",
        data: {
          project: projectId,
          taskId: problem.taskId,
          task_id: problem.taskId,
          reason: problem.replayReason ?? "malformed-repo-ref-wait-contract",
          repoRef,
          commit,
          baselineCommit: problem.baselineCommit,
          conditionId: problem.conditionId,
          issues: problem.issues,
          workflow: problem.workflow,
          ...(taskIntent ? { taskIntent } : {}),
        },
      });
    }
    for (const problem of malformedSelfTaskStateWaitReplays) {
      const taskIntent = taskIntentSnapshotFromResource(
        problem.taskId,
        taskState?.resources?.[problem.taskId] ?? null,
      );
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId: problem.taskId },
        urgency: "high",
        action: "task-state-wait-contract-replay",
        overrideWait: true,
        data: {
          project: projectId,
          taskId: problem.taskId,
          task_id: problem.taskId,
          reason:
            problem.replayReason ?? "self-task-state-wait-after-repo-advance",
          overrideWait: true,
          repoRef,
          commit,
          baselineCommit: problem.baselineCommit,
          conditionId: problem.conditionId,
          issues: problem.issues,
          workflow: problem.workflow,
          ...(taskIntent ? { taskIntent } : {}),
        },
      });
    }
    return {
      observed: true,
      repoRef,
      commit,
      repoRefWaitReplay: satisfiedRepoRefWaits.length > 0,
      repoRefWaitReplayTaskIds: satisfiedRepoRefWaits.map(
        (replay) => replay.taskId,
      ),
      repoRefWaitContractReplay: malformedRepoRefWaitReplays.length > 0,
      replayTaskIds: malformedRepoRefWaitReplays.map(
        (problem) => problem.taskId,
      ),
      malformedRepoRefWaitReplay: malformedRepoRefWaitReplays.length > 0,
      malformedRepoRefWaitProblems: malformedRepoRefWaitReplays,
      malformedSelfTaskStateWaitReplay:
        malformedSelfTaskStateWaitReplays.length > 0,
      malformedSelfTaskStateWaitProblems: malformedSelfTaskStateWaitReplays,
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
    const wake = scenarioTestFrontierWakeEvent(event);
    ctx.emit(wake);
    return { taskId: scenarioTestFrontierTaskId, observed: true };
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
  if (
    !specId ||
    status !== "pass" ||
    sourceBranch !== campaign.branch ||
    sourceCommit !== campaign.currentCommit
  ) {
    return [];
  }
  return campaign.integratedFixes
    .filter((fix) => fix.taskId.includes(`/${specId}/`))
    .map((fix) => fix.pullRequestId);
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
      // The workflow receipt owns the six-hour due rule. Keep the level
      // observation pulse short so daemon/app reloads cannot postpone a due
      // cycle by another six hours.
      intervalMs: 300_000,
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
      id: "blocked-frontier-app-ops-review",
      enabled: true,
      intervalMs: 1_800_000,
      emits: [
        {
          type: "project.task.tick",
          target: { project: projectId, taskId: waitingFrontierReviewTaskId },
          urgency: "high",
          action: "waiting-frontier-review",
          data: {
            project: projectId,
            taskId: waitingFrontierReviewTaskId,
            task_id: waitingFrontierReviewTaskId,
            reason: "scheduled-blocked-frontier-review",
          },
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
  },

  events: [
    { type: "project.task.reconcile.started", target: projectTarget },
    { type: "project.task.reconcile.skipped", target: projectTarget },
    { type: "project.task.reconciled", target: projectTarget },
    { type: "aks.pipeline.check", target: projectTarget },
    { type: "aks.master-validation.check", target: projectTarget },
    { type: "aks.pull-request.check", target: projectTarget },
    { type: "aks.repo-ref.check", target: projectTarget },
    { type: "aks.repo-ref.observed", target: projectTarget },
    { type: "aks.repo-ref.changed", target: projectTarget },
    { type: "aks.workspace.integrity.check", target: projectTarget },
    { type: "aks.workspace.integrity.changed", target: projectTarget },
    { type: "aks.scenario-test-inventory.check", target: projectTarget },
    { type: "aks.scenario-test-inventory.observed", target: projectTarget },
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
        "Create one packet-linked human-facing approval message record using the proven message.created path.",
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

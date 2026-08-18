import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import type {
  AppTaskCondition as AppTaskCondition,
  AppTaskAcceptanceBasis as AppTaskAcceptanceBasis,
  AppTaskAttempt as AppTaskAttempt,
  AppTaskResource as AppTaskResource,
  AppTaskTrigger as AppTaskTrigger,
  AppTaskWorkspace as AppTaskWorkspace,
} from "./app-task-state.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";
import { writeAppTaskConditionRouteIndex } from "./app-task-condition-index.js";
import { currentProcessInstance, isProcessInstanceAlive } from "../lib/process-identity.js";

export type TaskNode = {
  id: string;
  revision?: number;
  parent_id?: string | null;
  state?: string;
  kind?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  owner?: string;
  workflow?: string;
  input?: Record<string, unknown>;
  conflict_scope?: string[] | string;
  goal?: string;
  children?: string[];
  depends_on?: string[] | string;
  inputs?: string[];
  outputs?: string[];
  acceptance?: string[];
  forbidden?: string[];
  context?: Record<string, unknown>;
  context_ref?: string;
  summary?: string;
  rollup_summary?: string;
  strategy_context?: string;
  progress?: Record<string, unknown>;
  result?: string;
  evidence?: string[];
  verification?: unknown;
  trace?: Record<string, unknown>;
  resolution?: string;
  replaced_by?: string[];
  done_at?: string;
  done_by?: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  reconcile_mode?: "achieve" | "maintain";
  attempt_count?: number;
  active_attempt?: {
    id: string;
    handler: string;
    state: AppTaskAttempt["state"];
    reason: string;
    started_at: string;
  };
};

export type AppTaskPhase = AppTaskResource["status"]["phase"];

export type AppTaskReadiness = {
  state:
    | "ready"
    | "dependency-blocked"
    | "condition-blocked"
    | "child-blocked"
    | "capacity-blocked"
    | "paused"
    | "not-applicable";
  reason: string;
  related_ids: string[];
};

export type AppTaskProjectionItem = {
  item_type: "group" | "task";
  id: string;
  parent_id?: string | null;
  children: string[];
  outcome?: string;
  category?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  owner?: string;
  workflow?: string;
  mode?: "achieve" | "maintain";
  generation?: number;
  resource_version?: number;
  phase?: AppTaskPhase;
  observed_generation?: number;
  synchronized?: boolean;
  readiness?: AppTaskReadiness;
  depends_on?: string[];
  outputs?: string[];
  acceptance?: string[];
  input?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  summary?: string;
  evidence?: string[];
  condition_ids?: string[];
  status_updated_at?: string;
  attempt_count?: number;
  active_attempt?: {
    id: string;
    handler: string;
    state: AppTaskAttempt["state"];
    reason: string;
    started_at: string;
  };
  context?: Record<string, unknown>;
  strategy_context?: string;
  progress?: Record<string, unknown>;
  tags?: string[];
};

export type AppTaskIntegrityFinding = {
  code:
    | "missing-parent"
    | "missing-dependency"
    | "missing-condition"
    | "waiting-without-condition-or-child"
    | "running-without-attempt"
    | "generation-inversion";
  task_id: string;
  related_ids: string[];
  message: string;
};

export type AppTaskTreeProjection = {
  schema_version: 2;
  project?: string;
  project_lifecycle?: string;
  root_task_id?: string;
  updated_at?: string;
  max_concurrent: number;
  active_task_ids: string[];
  conditions: Record<string, AppTaskCondition>;
  satisfied_dependency_ids: string[];
  integrity: AppTaskIntegrityFinding[];
  tasks: Record<string, AppTaskProjectionItem>;
};

export type TaskCompletionReceipt = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };
  specHash: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  owner: string;
  workflow?: string;
  input?: Record<string, unknown>;
  priority?: "P0" | "P1" | "P2" | "P3";
  handler: string;
  summary: string;
  evidence: string[];
  acceptanceBasis: AppTaskAcceptanceBasis;
  failureFingerprints: string[];
  completedAt: string;
  workspace?: AppTaskWorkspace;
  /** Digest of acceptance/evidence/workspace detail removed from old bounded history. */
  compactedDetailSha256?: string;
};

export type AppTaskAdmission = {
  taskId: string;
  taskGeneration: number;
  specHash: string;
  admittedAt: string;
};

export type TaskTree = {
  version?: number;
  project?: string;
  updated_at?: string;
  project_lifecycle?: string;
  root_task_id?: string;
  active_task_id?: string | null;
  active_task_ids?: string[];
  conditions?: Record<string, AppTaskCondition>;
  resources?: Record<string, AppTaskResource>;
  attempts?: Record<string, AppTaskAttempt>;
  taskTriggers?: Record<string, AppTaskTrigger>;
  /** Retry fence for canonical App inbox attachments. Host-private state. */
  appTaskAdmissions?: Record<string, AppTaskAdmission>;
  receipts?: Record<string, TaskCompletionReceipt>;
  /** Satisfied dependencies referenced by current live tasks. Projection only. */
  satisfied_dependency_ids?: string[];
  /** Structural labels/containers only. Executable task nodes are projected from resources. */
  groups?: Record<string, TaskNode>;
  tasks: Record<string, TaskNode>;
};

export type TaskStateConfig = {
  appDir: string;
  projectDir: string;
  statePath: string;
  journalPath: string;
  worker: string;
  maxConcurrent: number;
  mutationAuthority?: unknown;
  validateMutation?: (input: { current: TaskTree; next: TaskTree; authority?: unknown }) => void;
};

function timeoutFromAnyEnv(names: string[], fallbackMs: number): number {
  for (const name of names) {
    const value = Number(process.env[name]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return fallbackMs;
}

export function taskState(task: TaskNode | undefined): string {
  return task?.state ?? "backlog";
}

export function taskRevision(task: TaskNode | undefined): number {
  const value = task?.revision;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item));
  if (typeof value === "string" && value) return [value];
  return [];
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isRetryableTaskTreeReadError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  if (!(error instanceof Error)) return false;
  return error.message.includes("ENOENT") || error.message.includes("EAGAIN");
}

function taskStateLockOwnerIsDead(lockPath: string): boolean {
  try {
    const owner = JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8")) as {
      pid?: unknown;
      processIdentity?: unknown;
      processStartedAt?: unknown;
      acquiredAt?: unknown;
    };
    const pid = Number(owner.pid);
    if (!Number.isInteger(pid) || pid <= 0) return false;
    return !isProcessInstanceAlive({ ...owner, recordedAt: owner.acquiredAt });
  } catch {
    return false;
  }
}

export function withTaskStateLock<T>(config: TaskStateConfig, operation: () => T): T {
  const lockPath = `${config.statePath}.lock`;
  const waitMs = timeoutFromAnyEnv(["PROJECT_TREE_LOCK_WAIT_MS", "AKS_RP_E2E_TREE_LOCK_WAIT_MS"], 30_000);
  const staleMs = timeoutFromAnyEnv(["PROJECT_TREE_LOCK_STALE_MS", "AKS_RP_E2E_TREE_LOCK_STALE_MS"], 2 * 60_000);
  const deadline = Date.now() + waitMs;
  while (true) {
    try {
      mkdirSync(lockPath);
      const currentProcess = currentProcessInstance();
      writeFileSync(
        join(lockPath, "owner.json"),
        `${JSON.stringify({
          ...currentProcess,
          acquiredAt: new Date().toISOString(),
        })}\n`,
      );
      break;
    } catch {
      try {
        if (taskStateLockOwnerIsDead(lockPath) || Date.now() - statSync(lockPath).mtimeMs > staleMs) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        // Retry until the deadline.
      }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for task state lock: ${lockPath}`);
      sleepSync(50);
    }
  }
  try {
    return operation();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

export function readTaskState(config: TaskStateConfig): TaskTree {
  const canonicalPath = projectRuntimePaths(config.appDir).taskStatePath;
  if (config.statePath !== canonicalPath) {
    throw new Error(`Task state must be read from canonical state.json: ${canonicalPath}`);
  }
  const retryMs = timeoutFromAnyEnv(["PROJECT_TREE_READ_RETRY_MS", "AKS_RP_E2E_TREE_READ_RETRY_MS"], 250);
  const deadline = Date.now() + retryMs;

  while (true) {
    try {
      const tree = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
      normalizeTaskStateInPlace(tree);
      return tree;
    } catch (error) {
      if (!isRetryableTaskTreeReadError(error) || Date.now() >= deadline) {
        throw error;
      }
      sleepSync(10);
    }
  }
}

export type SaveTaskStateOptions = {
  /** Set to true to bypass the shrinkage guard (e.g. intentional tree reset). */
  allowShrinkage?: boolean;
  /**
   * Required for every explicit project lifecycle transition. Normal task-tree
   * saves must preserve lifecycle; they cannot silently pause or resume an app.
   */
  projectLifecycleReason?: string;
};

function normalizedLifecycle(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function appendTaskTreeJournal(config: TaskStateConfig, entry: Record<string, unknown>): void {
  ensureDir(dirname(config.journalPath));
  appendFileSync(
    config.journalPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      actor: config.worker,
      ...entry,
    })}\n`,
    "utf-8",
  );
}

function validateLifecycleTransition(
  config: TaskStateConfig,
  current: TaskTree,
  next: TaskTree,
  options?: SaveTaskStateOptions,
): void {
  const currentLifecycle = normalizedLifecycle(current.project_lifecycle);
  const nextLifecycle = normalizedLifecycle(next.project_lifecycle);
  if (currentLifecycle !== nextLifecycle && !options?.projectLifecycleReason?.trim()) {
    throw new Error(
      `saveTaskState lifecycle guard: refusing to change project ${config.projectDir} ` +
        `from ${currentLifecycle || "unset"} to ${nextLifecycle || "unset"} without an explicit reason.`,
    );
  }
}

export function saveTaskState(config: TaskStateConfig, tree: TaskTree, options?: SaveTaskStateOptions): void {
  const runtimePaths = projectRuntimePaths(config.appDir);
  if (config.statePath !== runtimePaths.taskStatePath) {
    throw new Error(`Task state must be written to canonical state.json: ${runtimePaths.taskStatePath}`);
  }
  normalizeTaskStateInPlace(tree);

  let existingTree: TaskTree | null = null;
  if (existsSync(config.statePath)) {
    try {
      existingTree = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
      normalizeTaskStateInPlace(existingTree);
    } catch {
      existingTree = null;
    }
  }

  if (existingTree && config.validateMutation) {
    config.validateMutation({
      current: existingTree,
      next: tree,
      authority: config.mutationAuthority,
    });
  }

  if (existingTree) {
    validateLifecycleTransition(config, existingTree, tree, options);
  }

  // Shrinkage guard: reject writes that reduce task count by >80%.
  // This prevents agent-caused data loss from whole-file overwrites.
  if (!options?.allowShrinkage && existsSync(config.statePath)) {
    try {
      const existing = existingTree;
      if (!existing) throw new Error("existing task tree is unavailable");
      const existingCount = Object.keys(existing.groups ?? {}).length + Object.keys(existing.resources ?? {}).length;
      const newCount = Object.keys(tree.groups ?? {}).length + Object.keys(tree.resources ?? {}).length;
      // Only guard when existing tree has enough tasks to be meaningful (>=5)
      // and the new tree drops by more than 80%.
      if (existingCount >= 5 && newCount < existingCount * 0.2) {
        throw new Error(
          `saveTaskState shrinkage guard: refusing to overwrite ${existingCount} tasks with ${newCount} tasks ` +
            `(${Math.round((1 - newCount / existingCount) * 100)}% reduction). ` +
            `Pass { allowShrinkage: true } to override if this is intentional.`,
        );
      }
    } catch (e) {
      // Re-throw shrinkage guard errors; swallow file read/parse errors
      if (e instanceof Error && e.message.startsWith("saveTaskState shrinkage guard")) throw e;
    }
  }

  tree.updated_at = new Date().toISOString();
  const serialized = `${JSON.stringify(canonicalTaskStateForWrite(tree), null, 2)}\n`;
  ensureDir(dirname(config.statePath));
  const tempPath = `${config.statePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, serialized, "utf-8");
  renameSync(tempPath, config.statePath);
  writeAppTaskConditionRouteIndex(config, tree);

  const projectionPath = runtimePaths.taskTreePath;
  const projectionTempPath = `${projectionPath}.${process.pid}.${Date.now()}.tmp`;
  ensureDir(dirname(projectionPath));
  writeFileSync(
    projectionTempPath,
    `${JSON.stringify(buildAppTaskTreeProjection(tree, config.maxConcurrent), null, 2)}\n`,
    "utf-8",
  );
  renameSync(projectionTempPath, projectionPath);

  if (
    existingTree &&
    normalizedLifecycle(existingTree.project_lifecycle) !== normalizedLifecycle(tree.project_lifecycle)
  ) {
    const from = normalizedLifecycle(existingTree.project_lifecycle);
    const to = normalizedLifecycle(tree.project_lifecycle);
    appendTaskTreeJournal(config, {
      kind:
        to === "paused"
          ? "project_lifecycle_paused"
          : to === "active"
            ? "project_lifecycle_resumed"
            : "project_lifecycle_changed",
      from: from || null,
      to: to || null,
      reason: options?.projectLifecycleReason?.trim(),
    });
  }
}

export function setProjectLifecycle(config: TaskStateConfig, lifecycle: string, reason: string): void {
  const nextLifecycle = normalizedLifecycle(lifecycle);
  const transitionReason = reason.trim();
  if (!nextLifecycle) throw new Error("Project lifecycle must not be empty");
  if (!transitionReason) throw new Error("Project lifecycle change requires a reason");

  withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    if (normalizedLifecycle(tree.project_lifecycle) === nextLifecycle) return;
    tree.project_lifecycle = nextLifecycle;
    saveTaskState(config, tree, { projectLifecycleReason: transitionReason });
  });
}

export type TaskStateMigrationResult = {
  revision: string;
  changed: boolean;
  written: boolean;
  taskCountBefore: number;
  taskCountAfter: number;
};

function storedTaskStateRevision(config: TaskStateConfig): string {
  return createHash("sha256").update(readFileSync(config.statePath)).digest("hex");
}

function comparableTaskState(tree: TaskTree): string {
  const copy = structuredClone(tree);
  delete copy.updated_at;
  normalizeTaskStateInPlace(copy);
  return JSON.stringify(canonicalTaskStateForWrite(copy));
}

function taskStateResourceCount(tree: TaskTree): number {
  return Object.keys(tree.groups ?? {}).length + Object.keys(tree.resources ?? {}).length;
}

/** Apply one reviewed migration while the project is paused and the state revision is unchanged. */
export function migrateTaskState(
  config: TaskStateConfig,
  input: {
    expectedRevision?: string;
    dryRun?: boolean;
    allowShrinkage?: boolean;
    migrate: (tree: TaskTree) => void;
  },
): TaskStateMigrationResult {
  return withTaskStateLock(config, () => {
    const revision = storedTaskStateRevision(config);
    if (input.expectedRevision && revision !== input.expectedRevision) {
      throw new Error(`Task state changed after review: expected ${input.expectedRevision}, found ${revision}`);
    }
    const current = readTaskState(config);
    if (normalizedLifecycle(current.project_lifecycle) !== "paused") {
      throw new Error("Task state migration requires project_lifecycle=paused");
    }
    const runningAttemptIds = Object.values(current.attempts ?? {})
      .filter((attempt) => attempt.state === "running")
      .map((attempt) => attempt.metadata.id);
    if (runningAttemptIds.length > 0) {
      throw new Error(
        `Task state migration requires drained attempts; still running: ${runningAttemptIds.slice(0, 8).join(", ")}`,
      );
    }

    const next = structuredClone(current);
    input.migrate(next);
    if (normalizedLifecycle(next.project_lifecycle) !== "paused") {
      throw new Error("Task state migration cannot resume or change project lifecycle");
    }
    const changed = comparableTaskState(current) !== comparableTaskState(next);
    const result = {
      revision,
      changed,
      written: Boolean(changed && !input.dryRun),
      taskCountBefore: taskStateResourceCount(current),
      taskCountAfter: taskStateResourceCount(next),
    };
    if (result.written) {
      saveTaskState(config, next, { allowShrinkage: input.allowShrinkage });
    }
    return result;
  });
}

export function normalizeTaskStateInPlace(tree: TaskTree): TaskTree {
  const resources = tree.resources ?? {};
  const groups: Record<string, TaskNode> = Object.fromEntries(
    Object.entries(tree.groups ?? {}).map(([id, group]) => {
      const { children: _derivedChildren, ...structural } = group;
      return [id, { ...structural, id }];
    }),
  );
  tree.groups = groups;
  tree.tasks = buildTaskTreeProjection(groups, resources);
  tree.active_task_ids = Object.values(resources)
    .filter((resource) => resource.status.phase === "running")
    .map((resource) => resource.metadata.id)
    .sort();
  tree.active_task_id = tree.active_task_ids[0] ?? null;
  tree.root_task_id ??= Object.values(groups).find((group) => group.parent_id === null)?.id;
  return tree;
}

function projectedTaskState(resource: AppTaskResource): string {
  switch (resource.status.phase) {
    case "running":
      return "active";
    case "waiting":
      return "blocked";
    case "attention":
      return "review";
    default:
      return "backlog";
  }
}

function buildTaskTreeProjection(
  groups: Record<string, TaskNode>,
  resources: Record<string, AppTaskResource>,
): Record<string, TaskNode> {
  const tasks: Record<string, TaskNode> = {};
  for (const [id, group] of Object.entries(groups)) {
    tasks[id] = { ...group, id, state: group.state ?? "backlog", children: [] };
  }

  const inheritedOwner = (resource: AppTaskResource): string | undefined => {
    if (resource.spec.owner?.trim()) return resource.spec.owner.trim();
    let parentId: string | undefined = resource.spec.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parentResource: AppTaskResource | undefined = resources[parentId];
      if (parentResource?.spec.owner?.trim()) return parentResource.spec.owner.trim();
      if (parentResource) {
        parentId = parentResource.spec.parentId;
        continue;
      }
      const group: TaskNode | undefined = groups[parentId];
      if (group?.owner?.trim()) return group.owner.trim();
      parentId = group?.parent_id ?? undefined;
    }
    return undefined;
  };

  for (const resource of Object.values(resources)) {
    const { spec, status, metadata } = resource;
    tasks[metadata.id] = {
      id: metadata.id,
      revision: metadata.generation,
      parent_id: spec.parentId,
      state: projectedTaskState(resource),
      ...(spec.category ? { kind: spec.category } : {}),
      priority: spec.priority ?? "P2",
      ...(inheritedOwner(resource) ? { owner: inheritedOwner(resource) } : {}),
      ...(spec.workflow ? { workflow: spec.workflow } : {}),
      goal: spec.outcome,
      children: [],
      depends_on: [...(spec.dependsOn ?? [])],
      outputs: [...(spec.outputs ?? [])],
      acceptance: [...spec.acceptance],
      ...(status.summary ? { summary: status.summary } : {}),
      ...(status.evidence ? { evidence: [...status.evidence] } : {}),
      reconcile_mode: spec.mode,
    };
  }

  for (const task of Object.values(tasks)) {
    const parent = task.parent_id ? tasks[task.parent_id] : undefined;
    if (parent) parent.children = [...(parent.children ?? []), task.id];
  }
  for (const task of Object.values(tasks)) task.children = [...new Set(task.children ?? [])].sort();
  return tasks;
}

const FULL_RECEIPTS_PER_PARENT = 32;

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function compactHistoricalReceipts(tree: TaskTree): void {
  const receipts = Object.values(tree.receipts ?? {});
  const byParent = new Map<string, TaskCompletionReceipt[]>();
  for (const receipt of receipts) {
    const group = byParent.get(receipt.parentId) ?? [];
    group.push(receipt);
    byParent.set(receipt.parentId, group);
  }

  const keepFull = new Set<string>();
  for (const group of byParent.values()) {
    group
      .sort(
        (left, right) =>
          right.completedAt.localeCompare(left.completedAt) || right.metadata.id.localeCompare(left.metadata.id),
      )
      .slice(0, FULL_RECEIPTS_PER_PARENT)
      .forEach((receipt) => keepFull.add(receipt.metadata.id));
  }

  for (const receipt of receipts) {
    if (keepFull.has(receipt.metadata.id) || receipt.compactedDetailSha256) continue;
    receipt.compactedDetailSha256 = sha256({
      acceptance: receipt.acceptance,
      evidence: receipt.evidence,
      acceptanceBasis: receipt.acceptanceBasis,
      workspace: receipt.workspace,
    });
    receipt.acceptance = [];
    receipt.evidence = [];
    receipt.acceptanceBasis = {
      ...receipt.acceptanceBasis,
      evidence: [],
    };
    delete receipt.workspace;
  }
}

function compactAttemptTrigger(trigger: Record<string, unknown>): Record<string, unknown> {
  if (typeof trigger.compactedPayloadSha256 === "string") return trigger;
  const compact: Record<string, unknown> = {
    compactedPayloadSha256: sha256(trigger),
  };
  for (const key of [
    "type",
    "source",
    "timestamp",
    "eventId",
    "project",
    "taskId",
    "task_id",
    "runId",
    "pipelineRunId",
    "idempotencyKey",
    "target",
  ]) {
    if (trigger[key] !== undefined) compact[key] = trigger[key];
  }
  return compact;
}

function compactHistoricalAttemptTriggers(tree: TaskTree): void {
  const attempts = Object.values(tree.attempts ?? {});
  const keepFull = new Set<string>();
  for (const attempt of attempts) {
    if (attempt.state === "running") keepFull.add(attempt.metadata.id);
  }
  for (const resource of Object.values(tree.resources ?? {})) {
    const latest = attempts
      .filter(
        (attempt) => attempt.taskId === resource.metadata.id && attempt.taskGeneration === resource.metadata.generation,
      )
      .sort(
        (left, right) =>
          right.startedAt.localeCompare(left.startedAt) || right.metadata.id.localeCompare(left.metadata.id),
      )[0];
    if (latest) keepFull.add(latest.metadata.id);
  }
  for (const attempt of attempts) {
    if (!attempt.trigger || keepFull.has(attempt.metadata.id)) continue;
    attempt.trigger = compactAttemptTrigger(attempt.trigger);
  }
}

function canonicalTaskStateForWrite(tree: TaskTree): Record<string, unknown> {
  const state = JSON.parse(JSON.stringify(tree)) as Record<string, unknown>;
  const canonical = state as unknown as TaskTree;
  compactHistoricalReceipts(canonical);
  compactHistoricalAttemptTriggers(canonical);
  delete state.tasks;
  delete state.active_task_id;
  delete state.active_task_ids;
  return state;
}

function satisfiedDependencyIds(tree: TaskTree): string[] {
  return [
    ...new Set(
      Object.values(tree.resources ?? {})
        .flatMap((resource) => resource.spec.dependsOn ?? [])
        .filter((dependencyId) => {
          if (tree.receipts?.[dependencyId]) return true;
          const dependency = tree.resources?.[dependencyId];
          return Boolean(
            dependency &&
            dependency.status.phase === "converged" &&
            dependency.status.observedGeneration === dependency.metadata.generation,
          );
        }),
    ),
  ].sort();
}

function appTaskReadiness(
  tree: TaskTree,
  resource: AppTaskResource,
  satisfied: Set<string>,
  maxConcurrent: number,
  activeCount: number,
): AppTaskReadiness {
  const conditionIds = [...(resource.status.conditionIds ?? [])];
  const satisfiedConditionIds = conditionIds.filter((id) => tree.conditions?.[id]?.status.state === "true");
  const conditionWokeTask = resource.status.phase === "waiting" && satisfiedConditionIds.length > 0;
  if (resource.status.phase === "waiting" && !conditionWokeTask) {
    const childIds = (tree.tasks[resource.metadata.id]?.children ?? []).filter((id) => Boolean(tree.resources?.[id]));
    if (!conditionIds.length && childIds.length) {
      return {
        state: "child-blocked",
        reason: `Waiting for child work: ${childIds.join(", ")}`,
        related_ids: childIds,
      };
    }
    return {
      state: "condition-blocked",
      reason: conditionIds.length ? `Waiting for ${conditionIds.join(", ")}` : "Waiting without a linked Condition",
      related_ids: conditionIds,
    };
  }
  if (resource.status.phase !== "pending" && !conditionWokeTask) {
    return {
      state: "not-applicable",
      reason: `Task phase is ${resource.status.phase}`,
      related_ids: [],
    };
  }
  if (tree.project_lifecycle === "paused") {
    return { state: "paused", reason: "Project task reconciliation is paused", related_ids: [] };
  }
  const unmet = (resource.spec.dependsOn ?? []).filter((id) => !satisfied.has(id));
  if (unmet.length) {
    return {
      state: "dependency-blocked",
      reason: `Waiting for ${unmet.join(", ")}`,
      related_ids: unmet,
    };
  }
  if (activeCount >= maxConcurrent) {
    return {
      state: "capacity-blocked",
      reason: `Concurrency ${activeCount}/${maxConcurrent} is full`,
      related_ids: [],
    };
  }
  return conditionWokeTask
    ? {
        state: "ready",
        reason: `Condition satisfied: ${satisfiedConditionIds.join(", ")}`,
        related_ids: satisfiedConditionIds,
      }
    : { state: "ready", reason: "Dependencies and capacity allow claim", related_ids: [] };
}

export function buildAppTaskTreeProjection(tree: TaskTree, configuredMaxConcurrent: number): AppTaskTreeProjection {
  const maxConcurrent =
    Number.isInteger(configuredMaxConcurrent) && configuredMaxConcurrent > 0 ? configuredMaxConcurrent : 1;
  const satisfiedIds = satisfiedDependencyIds(tree);
  const satisfied = new Set(satisfiedIds);
  const activeTaskIds = Object.values(tree.resources ?? {})
    .filter((resource) => resource.status.phase === "running")
    .map((resource) => resource.metadata.id)
    .sort();
  const attempts = Object.values(tree.attempts ?? {});
  const attemptsByTask = new Map<string, AppTaskAttempt[]>();
  for (const attempt of attempts) {
    const current = attemptsByTask.get(attempt.taskId) ?? [];
    current.push(attempt);
    attemptsByTask.set(attempt.taskId, current);
  }

  const tasks: Record<string, AppTaskProjectionItem> = {};
  for (const [id, group] of Object.entries(tree.groups ?? {})) {
    const projected = tree.tasks[id];
    tasks[id] = {
      item_type: "group",
      id,
      parent_id: group.parent_id ?? null,
      children: [...(projected?.children ?? [])],
      ...(group.goal ? { outcome: group.goal } : {}),
      ...(group.kind ? { category: group.kind } : {}),
      ...(group.priority ? { priority: group.priority } : {}),
      ...(group.owner ? { owner: group.owner } : {}),
      ...(group.summary ? { summary: group.summary } : {}),
      ...(group.context ? { context: structuredClone(group.context) } : {}),
      ...(group.strategy_context ? { strategy_context: group.strategy_context } : {}),
      ...(group.progress ? { progress: structuredClone(group.progress) } : {}),
      ...(group.tags ? { tags: [...group.tags] } : {}),
    };
  }

  for (const [taskId, resource] of Object.entries(tree.resources ?? {})) {
    const { metadata, spec, status } = resource;
    const task = tree.tasks[taskId];
    const activeAttempt = resource.status.currentAttemptId
      ? tree.attempts?.[resource.status.currentAttemptId]
      : undefined;
    tasks[taskId] = {
      item_type: "task",
      id: taskId,
      parent_id: spec.parentId,
      children: [...(task?.children ?? [])],
      outcome: spec.outcome,
      ...(spec.category ? { category: spec.category } : {}),
      priority: spec.priority ?? "P2",
      ...(task?.owner ? { owner: task.owner } : {}),
      ...(spec.workflow ? { workflow: spec.workflow } : {}),
      mode: spec.mode,
      generation: metadata.generation,
      resource_version: metadata.resourceVersion,
      phase: status.phase,
      observed_generation: status.observedGeneration,
      synchronized: status.observedGeneration === metadata.generation,
      readiness: appTaskReadiness(tree, resource, satisfied, maxConcurrent, activeTaskIds.length),
      depends_on: [...(spec.dependsOn ?? [])],
      outputs: [...(spec.outputs ?? [])],
      acceptance: [...spec.acceptance],
      ...(spec.input ? { input: structuredClone(spec.input) } : {}),
      ...(tree.taskTriggers?.[taskId]?.event ? { trigger: structuredClone(tree.taskTriggers[taskId].event) } : {}),
      ...(status.summary ? { summary: status.summary } : {}),
      ...(status.evidence ? { evidence: [...status.evidence] } : {}),
      condition_ids: [...(status.conditionIds ?? [])],
      status_updated_at: status.updatedAt,
      attempt_count: attemptsByTask.get(taskId)?.length ?? 0,
      ...(activeAttempt
        ? {
            active_attempt: {
              id: activeAttempt.metadata.id,
              handler: activeAttempt.handler,
              state: activeAttempt.state,
              reason: activeAttempt.reason,
              started_at: activeAttempt.startedAt,
            },
          }
        : {}),
      ...(task?.context ? { context: structuredClone(task.context) } : {}),
      ...(task?.strategy_context ? { strategy_context: task.strategy_context } : {}),
      ...(task?.progress ? { progress: structuredClone(task.progress) } : {}),
      ...(task?.tags ? { tags: [...task.tags] } : {}),
    };
  }

  const integrity: AppTaskIntegrityFinding[] = [];
  for (const task of Object.values(tasks)) {
    if (task.parent_id && !tasks[task.parent_id]) {
      integrity.push({
        code: "missing-parent",
        task_id: task.id,
        related_ids: [task.parent_id],
        message: `Parent ${task.parent_id} is missing`,
      });
    }
    if (task.item_type !== "task") continue;
    if ((task.observed_generation ?? 0) > (task.generation ?? 0)) {
      integrity.push({
        code: "generation-inversion",
        task_id: task.id,
        related_ids: [],
        message: `Observed generation ${task.observed_generation} exceeds desired generation ${task.generation}`,
      });
    }
    const missingDependencies = (task.depends_on ?? []).filter((id) => !tasks[id] && !satisfied.has(id));
    if (missingDependencies.length) {
      integrity.push({
        code: "missing-dependency",
        task_id: task.id,
        related_ids: missingDependencies,
        message: `Dependencies are missing: ${missingDependencies.join(", ")}`,
      });
    }
    if (task.phase === "running" && !task.active_attempt) {
      integrity.push({
        code: "running-without-attempt",
        task_id: task.id,
        related_ids: [],
        message: "Running task has no current attempt",
      });
    }
    if (
      task.phase === "waiting" &&
      !(task.condition_ids ?? []).length &&
      !(task.children ?? []).some((childId) => tasks[childId]?.item_type === "task")
    ) {
      integrity.push({
        code: "waiting-without-condition-or-child",
        task_id: task.id,
        related_ids: [],
        message: "Waiting task has neither a linked Condition nor live child work",
      });
    }
    const missingConditions = (task.condition_ids ?? []).filter((id) => !tree.conditions?.[id]);
    if (missingConditions.length) {
      integrity.push({
        code: "missing-condition",
        task_id: task.id,
        related_ids: missingConditions,
        message: `Conditions are missing: ${missingConditions.join(", ")}`,
      });
    }
  }

  return {
    schema_version: 2,
    ...(tree.project ? { project: tree.project } : {}),
    ...(tree.project_lifecycle ? { project_lifecycle: tree.project_lifecycle } : {}),
    ...(tree.root_task_id ? { root_task_id: tree.root_task_id } : {}),
    updated_at: tree.updated_at,
    max_concurrent: maxConcurrent,
    active_task_ids: activeTaskIds,
    conditions: JSON.parse(JSON.stringify(tree.conditions ?? {})) as Record<string, AppTaskCondition>,
    satisfied_dependency_ids: satisfiedIds,
    integrity,
    tasks,
  };
}

/** Rebuild the disposable read projection without mutating canonical task state. */
export function refreshAppTaskTreeProjection(config: TaskStateConfig): string {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const projectionPath = projectRuntimePaths(config.appDir).taskTreePath;
    const tempPath = `${projectionPath}.${process.pid}.${Date.now()}.tmp`;
    ensureDir(dirname(projectionPath));
    writeFileSync(
      tempPath,
      `${JSON.stringify(buildAppTaskTreeProjection(tree, config.maxConcurrent), null, 2)}\n`,
      "utf-8",
    );
    renameSync(tempPath, projectionPath);
    return projectionPath;
  });
}

export function isLeaf(task: TaskNode): boolean {
  return normalizeStringArray(task.children).length === 0;
}

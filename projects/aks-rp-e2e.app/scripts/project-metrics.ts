import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";
import {
  listRunnableBacklogTaskIds,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  type TaskNode,
  type TaskTree,
} from "../workflows/lib/task-tree-store.ts";

type ModelStatus = {
  features?: {
    total?: number;
    byStatus?: Record<string, number>;
  };
  paths?: {
    total?: number;
    byStatus?: Record<string, number>;
  };
};

type RunResult = {
  status?: string;
  mode?: string;
  dryRun?: boolean;
  startedAt?: string;
  completedAt?: string;
  endedAt?: string;
  probeEvidence?: {
    mode?: string;
    status?: string;
  } | null;
};

type PlannerRun = {
  kind?: string;
  status?: string;
  ran_agent?: boolean;
  steps?: string[];
  ts?: string;
  durationMs?: number;
  result?: string;
};

type SpecIndexEntry = {
  id?: string;
  status?: string;
  specState?: string;
};

type SpecIndex = {
  specs?: SpecIndexEntry[];
};

type SpecMetrics = {
  total: number;
  verified: number;
  reviewedException: number;
  unverified: number;
  failed: number;
  blocked: number;
  ready: number;
  draft: number;
  unknown: number;
};

type MetricSampleOutput = {
  value: number;
  sampleSize?: number;
  measuredAt?: number;
  note?: unknown;
};

type StaleActiveTaskInfo = {
  taskId: string;
  sessionId: string | null;
  restartReason: string;
};

type AssignmentStateMismatchInfo = {
  correlationKey: string;
  taskId: string;
  attemptId: string | null;
  taskState: string | null;
};

type SpecLoopState = {
  loopTaskId?: string;
  specs?: Record<
    string,
    {
      status?: string;
      attempts?: number;
      lastRunUrl?: string | null;
      taskId?: string | null;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
      heartbeatAt?: string | null;
      successorDisposition?: string | null;
      resumeCondition?: string | null;
      review?: Record<string, unknown> | null;
    }
  >;
};

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const effectiveAppDir = resolve(process.env.AKS_RP_E2E_APP_DIR ?? appDir);
const projectDir = resolve(
  process.env.PROJECT_DIR ?? join(effectiveAppDir, "..", "aks-rp-e2e"),
);
const stateDbPath = resolve(
  process.env.MAY_DB_PATH ??
    join(effectiveAppDir, "..", "..", ".state", "may.db"),
);
const desiredParallelism = Number.parseInt(
  process.env.AKS_RP_E2E_DESIRED_PARALLELISM ?? "1",
  10,
);
const staleActiveNoActivityMs = Number.parseInt(
  process.env.AKS_RP_E2E_STALE_ACTIVE_MS ?? "600000",
  10,
);
const sessionStartGraceMs = Number.parseInt(
  process.env.AKS_RP_E2E_SESSION_START_GRACE_MS ?? "60000",
  10,
);
const now = Date.now();
const dayAgo = now - 24 * 60 * 60 * 1000;

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function listFiles(
  root: string,
  predicate: (path: string) => boolean,
): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const path = join(dir, entry);
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile() && predicate(path)) out.push(path);
    }
  };
  visit(root);
  return out;
}

function timestampOf(task: TaskNode): number | null {
  const taskRecord = task as TaskNode & { updated_at?: string };
  const candidates = [
    taskRecord.updated_at,
    typeof task.trace?.rolled_up_at === "string"
      ? task.trace.rolled_up_at
      : undefined,
    typeof task.trace?.completed_at === "string"
      ? task.trace.completed_at
      : undefined,
    typeof task.trace?.created_at === "string"
      ? task.trace.created_at
      : undefined,
  ].filter((value): value is string => Boolean(value));
  for (const value of candidates) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function loadTaskTree(): TaskTree {
  return readTaskTree(
    taskTreeConfig({
      appDir: effectiveAppDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: desiredParallelism,
    }),
  );
}

function taskState(task: TaskNode): string {
  const raw = task.state ?? task.status ?? "backlog";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return raw;
}

function isLeaf(task: TaskNode): boolean {
  return (task.children ?? []).length === 0;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringRecordField(
  record: Record<string, unknown> | null,
  keys: string[],
): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function objectRecordField(
  record: Record<string, unknown> | null,
  keys: string[],
): Record<string, unknown> | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    const nested = recordValue(value);
    if (nested) return nested;
  }
  return null;
}

function isWorkerExecutableBacklogLeaf(task: TaskNode): boolean {
  if (!isLeaf(task)) return false;
  if (taskState(task) !== "backlog") return false;
  if (
    task.kind === "frontier_replan" ||
    task.kind === "domain_planner" ||
    task.kind === "loop_task" ||
    task.kind === "work" ||
    task.kind === "focus_plan"
  )
    return false;
  return true;
}

function archivedCompletedTaskIds24h(): Set<string> {
  const archiveDir = join(effectiveAppDir, ".state", "tasks", "archive");
  const completed = new Set<string>();
  for (const path of listFiles(
    archiveDir,
    (candidate) =>
      extname(candidate) === ".json" && candidate.includes("done-leaves-"),
  )) {
    const archive = readJson<{ tasks?: TaskNode[] }>(path, {});
    for (const [index, task] of (archive.tasks ?? []).entries()) {
      if (taskState(task) !== "done") continue;
      const ts = timestampOf(task);
      if (ts == null || ts < dayAgo) continue;
      completed.add(task.id ?? `${path}#${index}`);
    }
  }
  return completed;
}

function taskCounts() {
  const tree = loadTaskTree();
  const taskMap = tree.tasks ?? {};
  const tasks = Object.values(tree.tasks ?? {});
  let frontier: {
    runnable: string[];
    active: string[];
    review: string[];
    blocked: string[];
  } | null = null;
  try {
    frontier = summarizeTaskTree(
      taskTreeConfig({
        appDir: effectiveAppDir,
        projectDir,
        worker: "aks-explorer",
        maxConcurrent: desiredParallelism,
      }),
    ).frontier;
  } catch {
    frontier = null;
  }
  const byStatus = new Map<string, number>();
  for (const task of tasks) {
    const status = taskState(task);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }
  const completed24hTaskIds = archivedCompletedTaskIds24h();
  for (const [index, task] of tasks.entries()) {
    if (taskState(task) !== "done") continue;
    const ts = timestampOf(task);
    if (ts == null || ts < dayAgo) continue;
    completed24hTaskIds.add(task.id ?? `tree#${index}`);
  }
  const completed24h = completed24hTaskIds.size;
  const activeStale = staleActiveTaskCount();
  const activeRunning = runningActiveTaskCount();
  const assignmentStateMismatch = openTaskAssignmentStateMismatchCount(tree);
  const blockedLeafTasks = tasks.filter(
    (task) => isLeaf(task) && taskState(task) === "blocked",
  );
  const blockedLeaves = blockedLeafTasks.length;
  const blockedMissingWaitingFor = blockedLeafTasks.filter((task) => {
    const blocker = recordValue(task.blocker);
    return !objectRecordField(blocker, ["waiting_for", "waitingFor"]);
  }).length;
  const blockedMissingObserver = blockedLeafTasks.filter((task) => {
    const blocker = recordValue(task.blocker);
    return (
      !objectRecordField(blocker, ["observed_by", "observedBy"]) ||
      !stringRecordField(blocker, [
        "observation_method",
        "observationMethod",
      ]) ||
      !stringRecordField(blocker, ["next_check_at", "nextCheckAt"])
    );
  }).length;
  const blockedMissingResumeCondition = blockedLeafTasks.filter((task) => {
    const blocker = recordValue(task.blocker);
    return !stringRecordField(blocker, [
      "resume_condition",
      "resumeCondition",
      "waitingCondition",
    ]);
  }).length;
  const blockedMissingOwner = blockedLeafTasks.filter((task) => {
    const blocker = recordValue(task.blocker);
    return !stringRecordField(blocker, ["owner"]);
  }).length;
  const blockedMissingFallback = blockedLeafTasks.filter((task) => {
    const blocker = recordValue(task.blocker);
    return (
      !stringRecordField(blocker, ["fallback_at", "fallbackAt"]) ||
      !stringRecordField(blocker, ["fallback_action", "fallbackAction"])
    );
  }).length;
  const childRefs = new Set<string>();
  for (const task of Object.values(taskMap)) {
    for (const childId of task.children ?? []) childRefs.add(childId);
  }
  const roots = tasks.filter(
    (task) => task.id && !childRefs.has(task.id),
  ).length;
  return {
    total: tasks.length,
    runnable:
      frontier?.runnable.length ??
      tasks.filter(isWorkerExecutableBacklogLeaf).length,
    active: frontier?.active.length ?? byStatus.get("active") ?? 0,
    activeRunning,
    activeStale,
    assignmentStateMismatch,
    review: frontier?.review.length ?? byStatus.get("review") ?? 0,
    backlog: byStatus.get("backlog") ?? 0,
    blocked: blockedLeaves,
    blockedMissingWaitingFor,
    blockedMissingObserver,
    blockedMissingResumeCondition,
    blockedMissingOwner,
    blockedMissingFallback,
    done: byStatus.get("done") ?? 0,
    completed24h,
    taskTreeProblemCount: (roots === 1 ? 0 : 1) + assignmentStateMismatch,
    projectClosed:
      tree.project_lifecycle === "closed" ||
      tree.project_lifecycle === "review" ||
      tree.project_lifecycle === "blocked" ||
      // Suppress no-work/capacity alerts when the whole project is explicitly
      // non-executable (closed/reviewed/blocked) at the root.
      (tree.tasks?.project != null &&
        ["review", "done", "accepted", "blocked"].includes(
          tree.tasks.project.state ?? tree.tasks.project.status ?? "",
        )),
  };
}

function openTaskAssignmentStateMismatchDetails(
  tree: TaskTree,
): AssignmentStateMismatchInfo[] {
  if (!existsSync(stateDbPath)) return [];
  const db = new Database(stateDbPath, { readonly: true });
  try {
    const rows = db
      .query(
        `
        select correlation_key
        from event_pair_runs
        where pair_name = 'project.task'
          and status in ('open', 'orphan')
      `,
      )
      .all() as Array<{ correlation_key?: unknown }>;
    const mismatches: AssignmentStateMismatchInfo[] = [];
    for (const row of rows) {
      const key =
        typeof row.correlation_key === "string" ? row.correlation_key : "";
      const taskId = key.split(":")[0]?.trim();
      const attemptId = key.includes(":")
        ? key.slice(key.indexOf(":") + 1).trim() || null
        : null;
      if (!taskId) continue;
      const task = tree.tasks?.[taskId];
      const currentTaskState = task ? taskState(task) : null;
      if (!task || currentTaskState !== "active") {
        mismatches.push({
          correlationKey: key,
          taskId,
          attemptId,
          taskState: currentTaskState,
        });
      }
    }
    return mismatches;
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function openTaskAssignmentStateMismatchCount(tree: TaskTree): number {
  return openTaskAssignmentStateMismatchDetails(tree).length;
}

function loadModelStatus(): ModelStatus {
  return readJson<ModelStatus>(
    join(projectDir, ".state", "model-status.json"),
    {},
  );
}

function computeModelStatus(): ModelStatus {
  const modelPath = join(projectDir, "model", "knowledge-map", "model.json");
  const model = readJson<{
    features?: Array<{ status?: string }>;
    featurePaths?: Array<{ status?: string }>;
    scenarios?: unknown[];
    evidence?: unknown[];
  }>(modelPath, {});

  const countByStatus = (items: Array<{ status?: string }> = []) => {
    const byStatus: Record<string, number> = {};
    for (const item of items) {
      const status = item.status ?? "unknown";
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    }
    return { total: items.length, byStatus };
  };

  return {
    features: countByStatus(model.features),
    paths: countByStatus(model.featurePaths),
  };
}

function modelStatus(): ModelStatus {
  const cached = loadModelStatus();
  if (cached.features || cached.paths) return cached;
  return computeModelStatus();
}

function pathGapCount(): number {
  // Read model directly to check both status and terminal flag per path.
  // Terminal paths (externally blocked, product-gap, etc.) are not actionable
  // gaps — they should not trigger capacity/starvation alerts.
  const modelPath = join(projectDir, "model", "knowledge-map", "model.json");
  const model = readJson<{
    featurePaths?: Array<{ status?: string; terminal?: boolean }>;
  }>(modelPath, {});
  const paths = model.featurePaths ?? [];
  return paths.filter(
    (p) =>
      !["pass", "staging-pass"].includes(p.status ?? "unknown") &&
      p.terminal !== true,
  ).length;
}

function countSpecs(): number {
  return specMetrics().total;
}

function normalizeSpecStatus(value: string | undefined): string {
  return (value ?? "unknown").trim().toLowerCase().replace(/_/g, "-");
}

function isVerifiedSpec(spec: SpecIndexEntry): boolean {
  const status = normalizeSpecStatus(spec.status);
  const state = normalizeSpecStatus(spec.specState);
  return (
    status === "pass" &&
    ["verified", "validated", "resolved", "pass"].includes(state)
  );
}

function isReviewedExceptionSpec(spec: SpecIndexEntry): boolean {
  const statuses = [
    normalizeSpecStatus(spec.status),
    normalizeSpecStatus(spec.specState),
  ];
  return statuses.some((status) =>
    [
      "product-gap",
      "product-constraint",
      "environment",
      "environment-blocked",
      "blocked-infra",
      "superseded",
      "out-of-scope",
    ].includes(status),
  );
}

function specMetrics(): SpecMetrics {
  const index = readJson<SpecIndex>(join(projectDir, "specs", "index.json"), {
    specs: [],
  });
  const specs = index.specs ?? [];
  const metrics: SpecMetrics = {
    total: specs.length,
    verified: 0,
    reviewedException: 0,
    unverified: 0,
    failed: 0,
    blocked: 0,
    ready: 0,
    draft: 0,
    unknown: 0,
  };

  for (const spec of specs) {
    const status = normalizeSpecStatus(spec.status);
    const state = normalizeSpecStatus(spec.specState);
    const values = new Set([status, state]);
    const verified = isVerifiedSpec(spec);
    const reviewedException = !verified && isReviewedExceptionSpec(spec);

    if (verified) metrics.verified++;
    if (reviewedException) metrics.reviewedException++;
    if (!verified && !reviewedException) metrics.unverified++;
    if ([...values].some((value) => value.startsWith("fail"))) metrics.failed++;
    if ([...values].some((value) => value.startsWith("blocked")))
      metrics.blocked++;
    if (values.has("ready")) metrics.ready++;
    if (values.has("draft")) metrics.draft++;
    if (values.has("unknown")) metrics.unknown++;
  }

  return metrics;
}

function hasOpenSpecVerificationWork(
  tasks: ReturnType<typeof taskCounts>,
): boolean {
  const tree = loadTaskTree();
  return (
    Object.values(tree.tasks ?? {}).some((task) => {
      const id = task.id ?? "";
      const state = taskState(task);
      return (
        (id.includes("spec-verification") ||
          id.includes("all-spec-verification") ||
          id.includes("ready-spec-execution") ||
          id.includes("draft-spec-readiness") ||
          (id.includes("failed") && id.includes("spec"))) &&
        ["backlog", "active", "review", "blocked"].includes(state)
      );
    }) ||
    tasks.runnable > 0 ||
    tasks.activeRunning > 0 ||
    tasks.review > 0
  );
}

function loadSpecLoopState(): SpecLoopState {
  return readJson<SpecLoopState>(
    join(effectiveAppDir, ".state", "spec-loop", "state.json"),
    { specs: {} },
  );
}

function taskContext(task: TaskNode | undefined): Record<string, unknown> {
  return task?.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? task.context
    : {};
}

function taskConflictScopes(task: TaskNode | undefined): string[] {
  const scopes = (task as { conflict_scope?: unknown } | undefined)
    ?.conflict_scope;
  return Array.isArray(scopes)
    ? scopes.filter((scope): scope is string => typeof scope === "string")
    : [];
}

function specFamily(specId: string): string {
  return (
    specId
      .replace(/^spec\./, "")
      .split(".")[0]
      ?.trim() || "unknown"
  );
}

function specLoopTask(
  tree: TaskTree,
  state: SpecLoopState,
): TaskNode | undefined {
  const taskId = state.loopTaskId || "aks-spec-verification-loop";
  return tree.tasks?.[taskId];
}

function specLoopMaxDirectAttempts(
  tree: TaskTree,
  state: SpecLoopState,
): number {
  const task = specLoopTask(tree, state);
  const value = taskContext(task).maxDirectAttemptsPerSpec;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 3;
}

function canDirectlyRunSpec(
  state: SpecLoopState,
  specId: string,
  maxDirectAttemptsPerSpec: number,
): boolean {
  const spec = state.specs?.[specId];
  if (!spec) return false;
  if (spec.status === "pending" || spec.status === "done") {
    return !spec.lastRunUrl || (spec.attempts ?? 0) < maxDirectAttemptsPerSpec;
  }
  if (spec.status !== "error" && spec.status !== "fail") return false;
  return (spec.attempts ?? 0) < maxDirectAttemptsPerSpec;
}

function isRetryExhaustedSpec(
  state: SpecLoopState,
  specId: string,
  maxDirectAttemptsPerSpec: number,
): boolean {
  const spec = state.specs?.[specId];
  if (!spec) return false;
  const status = spec.status || "pending";
  if (status === "pending") {
    return !canDirectlyRunSpec(state, specId, maxDirectAttemptsPerSpec);
  }
  if (status !== "error" && status !== "fail") return false;
  return (spec.attempts ?? 0) >= maxDirectAttemptsPerSpec;
}

function specLoopFollowupGroupKeys(task: TaskNode | undefined): Set<string> {
  const keys = new Set<string>();
  if (!task) return keys;
  const context = taskContext(task);
  if (context.specLoopFollowup === true) {
    const status = context.status;
    const family = context.featureFamily;
    if (typeof status === "string" && typeof family === "string") {
      keys.add(`${status}:${family}`);
    }
  }
  for (const scope of taskConflictScopes(task)) {
    const trimmed = scope.trim();
    if (!trimmed.startsWith("spec-loop-followup:")) continue;
    const [, statusPart, familyPart] = trimmed.split(":");
    if (statusPart?.trim() && familyPart?.trim()) {
      keys.add(`${statusPart.trim()}:${familyPart.trim()}`);
    }
  }
  return keys;
}

function representedSpecLoopFollowupGroups(tree: TaskTree): Set<string> {
  const represented = new Set<string>();
  const representingStates = new Set([
    "active",
    "backlog",
    "review",
    "waiting",
    "blocked",
  ]);
  for (const task of Object.values(tree.tasks ?? {})) {
    if (!representingStates.has(taskState(task))) continue;
    for (const key of specLoopFollowupGroupKeys(task)) {
      represented.add(key);
    }
  }
  return represented;
}

function taskHasStructuredBlocker(task: TaskNode | undefined): boolean {
  return !!task?.blocker && typeof task.blocker === "object";
}

function taskTextMentionsSpecId(
  task: TaskNode | undefined,
  specId: string,
): boolean {
  if (!task) return false;
  const taskRecord = task as TaskNode & {
    acceptance?: unknown;
    inputs?: unknown;
  };
  const haystack = JSON.stringify({
    goal: task.goal,
    acceptance: taskRecord.acceptance,
    inputs: taskRecord.inputs,
    context: task.context,
    blocker: task.blocker,
  }).toLowerCase();
  return haystack.includes(specId.toLowerCase());
}

function taskTextMentionCountsAsSpecOwner(
  task: TaskNode | undefined,
  specId: string,
): boolean {
  if (!taskTextMentionsSpecId(task, specId)) return false;
  return taskState(task) !== "blocked" || taskHasStructuredBlocker(task);
}

function specLoopSpecHasStructuredSuccessor(
  spec: NonNullable<SpecLoopState["specs"]>[string] | undefined,
): boolean {
  if (!spec) return false;
  if (
    typeof spec.successorDisposition === "string" &&
    spec.successorDisposition.trim()
  ) {
    return true;
  }
  if (typeof spec.resumeCondition === "string" && spec.resumeCondition.trim()) {
    return true;
  }
  return !!spec.review && typeof spec.review === "object";
}

function exactSpecLoopOwnerTaskId(input: {
  tree: TaskTree;
  state: SpecLoopState;
  specId: string;
}): string | null {
  const spec = input.state.specs?.[input.specId];
  const representingStates = new Set([
    "active",
    "backlog",
    "review",
    "waiting",
    "blocked",
  ]);
  const isRepresenting = (task: TaskNode | undefined): task is TaskNode =>
    !!task && representingStates.has(taskState(task));

  const taskIds = new Set<string>();
  if (typeof spec?.taskId === "string" && spec.taskId.trim()) {
    taskIds.add(spec.taskId.trim());
  }
  for (const task of Object.values(input.tree.tasks ?? {})) {
    if (!isRepresenting(task)) continue;
    if (taskConflictScopes(task).includes(`spec:${input.specId}`)) {
      taskIds.add(task.id ?? "");
      continue;
    }
    if (taskTextMentionCountsAsSpecOwner(task, input.specId)) {
      taskIds.add(task.id ?? "");
    }
  }

  for (const taskId of taskIds) {
    const task = input.tree.tasks?.[taskId];
    if (!isRepresenting(task)) continue;
    if (taskConflictScopes(task).includes(`spec:${input.specId}`)) {
      return taskId;
    }
    if (taskTextMentionCountsAsSpecOwner(task, input.specId)) {
      return taskId;
    }
    if (specLoopFollowupGroupKeys(task).size > 0) return taskId;
    if (
      spec?.taskId === taskId &&
      specLoopSpecHasStructuredSuccessor(spec) &&
      taskHasStructuredBlocker(task)
    ) {
      return taskId;
    }
  }

  return null;
}

function specLoopRecoveryStats(): {
  retryExhausted: number;
  recoveryUnowned: number;
  recoveryUnownedSpecIds: string[];
} {
  const state = loadSpecLoopState();
  const tree = loadTaskTree();
  const maxDirectAttempts = specLoopMaxDirectAttempts(tree, state);
  const represented = representedSpecLoopFollowupGroups(tree);
  let retryExhausted = 0;
  let recoveryUnowned = 0;
  const recoveryUnownedSpecIds: string[] = [];
  for (const [specId, spec] of Object.entries(state.specs ?? {})) {
    if (!isRetryExhaustedSpec(state, specId, maxDirectAttempts)) continue;
    retryExhausted += 1;
    const status = spec.status || "pending";
    const groupStatus = status === "pending" ? "pending" : status;
    if (
      !represented.has(`${groupStatus}:${specFamily(specId)}`) &&
      !exactSpecLoopOwnerTaskId({ tree, state, specId })
    ) {
      recoveryUnowned += 1;
      recoveryUnownedSpecIds.push(specId);
    }
  }
  return { retryExhausted, recoveryUnowned, recoveryUnownedSpecIds };
}

function unpublishedGitChangeCount(repoDir: string): number {
  const result = spawnSync("git", ["status", "--porcelain=v1", "--branch"], {
    cwd: repoDir,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.status !== 0) return 0;
  let count = 0;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith("## ")) {
      const ahead = line.match(/\[ahead (\d+)/);
      if (ahead) count += Number.parseInt(ahead[1], 10) || 0;
      continue;
    }
    count += 1;
  }
  return count;
}

function countReplays(): number {
  return listFiles(join(projectDir, "replays"), (path) => {
    const rel = path.slice(join(projectDir, "replays").length + 1);
    return extname(path) === ".ts" && !rel.startsWith("lib/");
  }).length;
}

function sessionRestartReasonFromRow(
  row: Record<string, unknown> | null,
): string | null {
  if (!row) return "session-not-running";
  if (row.status !== "running") return "session-not-running";
  if (row.outcome === "error" || row.outcome === "interrupted")
    return `session-${row.outcome}`;

  const startedAt =
    typeof row.startedAt === "number" && Number.isFinite(row.startedAt)
      ? row.startedAt
      : null;
  const lastActivityAt =
    typeof row.lastActivityAt === "number" &&
    Number.isFinite(row.lastActivityAt)
      ? row.lastActivityAt
      : startedAt;
  const staleSince = lastActivityAt ?? startedAt;
  if (
    staleSince !== null &&
    Date.now() - staleSince > staleActiveNoActivityMs
  ) {
    return "session-no-activity";
  }

  return null;
}

function sessionRestartReason(sessionId: string): string | null {
  if (!existsSync(stateDbPath)) return "session-not-running";
  const db = new Database(stateDbPath, { readonly: true });
  try {
    const row = db
      .query(
        `
      select status, outcome, opCount, startedAt, lastActivityAt
      from sessions
      where sessionId = ?
      limit 1
    `,
      )
      .get(sessionId) as Record<string, unknown> | null;
    return sessionRestartReasonFromRow(row);
  } catch {
    try {
      const row = db
        .query(
          `
        select status
        from sessions
        where sessionId = ?
        limit 1
      `,
        )
        .get(sessionId) as Record<string, unknown> | null;
      return sessionRestartReasonFromRow(row);
    } catch {
      return "session-not-running";
    }
  } finally {
    db.close();
  }
}

function activeTaskWorkerSessionRow(
  taskId: string,
): Record<string, unknown> | null {
  if (!existsSync(stateDbPath)) return null;
  const db = new Database(stateDbPath, { readonly: true });
  const taskIdPattern = new RegExp(
    String.raw`"(?:taskId|id)"\s*:\s*"${taskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
  );
  try {
    const rows = db
      .query(
        `
      select status, outcome, opCount, startedAt, lastActivityAt, task
      from sessions
      where source = 'workflow:task-worker'
      order by startedAt desc
      limit 200
    `,
      )
      .all() as Array<Record<string, unknown>>;
    for (const row of rows) {
      const taskText = typeof row.task === "string" ? row.task : "";
      if (taskIdPattern.test(taskText)) return row;
    }
    return null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function activeTaskFeatureReferenceSessionRow(
  task: TaskNode,
): Record<string, unknown> | null {
  const featureKey =
    typeof task.context?.featureKey === "string"
      ? task.context.featureKey.trim()
      : "";
  if (!featureKey || !existsSync(stateDbPath)) return null;
  const db = new Database(stateDbPath, { readonly: true });
  const featurePattern = new RegExp(
    String.raw`feature\s+${featureKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\.|\n|\r|\s)`,
    "i",
  );
  try {
    const rows = db
      .query(
        `
      select status, outcome, opCount, startedAt, lastActivityAt, task
      from sessions
      where source = 'workflow:feature-reference-collector'
      order by startedAt desc
      limit 200
    `,
      )
      .all() as Array<Record<string, unknown>>;
    for (const row of rows) {
      const taskText = typeof row.task === "string" ? row.task : "";
      if (featurePattern.test(taskText)) return row;
    }
    return null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function loadVerifierLivenessByTaskId(): Map<
  string,
  {
    specId: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    heartbeatAt?: string | null;
  }
> {
  const state = readJson<SpecLoopState | null>(
    join(effectiveAppDir, ".state", "spec-loop", "state.json"),
    null,
  );
  const byTaskId = new Map<
    string,
    {
      specId: string;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
      heartbeatAt?: string | null;
    }
  >();
  const specs = state?.specs ?? {};
  for (const [specId, spec] of Object.entries(specs)) {
    if (!spec || typeof spec !== "object") continue;
    if (spec.status !== "running") continue;
    if (!spec.taskId || typeof spec.taskId !== "string") continue;
    byTaskId.set(spec.taskId, {
      specId,
      activeAttemptId:
        typeof spec.activeAttemptId === "string" ? spec.activeAttemptId : null,
      activeTaskSessionId:
        typeof spec.activeTaskSessionId === "string"
          ? spec.activeTaskSessionId
          : null,
      heartbeatAt:
        typeof spec.heartbeatAt === "string" ? spec.heartbeatAt : null,
    });
  }
  return byTaskId;
}

function countsAsExecutableActiveLeaf(task: TaskNode): boolean {
  if (!isLeaf(task)) return false;
  if (taskState(task) !== "active") return false;
  if (task.kind === "focus_plan") return false;
  return true;
}

function activeLeafTasks(): TaskNode[] {
  const tree = loadTaskTree();
  return Object.values(tree.tasks ?? {}).filter((task) =>
    countsAsExecutableActiveLeaf(task),
  );
}

function activeTaskIsWithinStartGrace(task: TaskNode): boolean {
  const trace = task.trace ?? {};
  const candidates = [
    typeof trace.assigned_at === "string" ? trace.assigned_at : undefined,
    typeof trace.worker_started_at === "string"
      ? trace.worker_started_at
      : undefined,
  ].filter((value): value is string => Boolean(value));
  for (const value of candidates) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && Date.now() - parsed <= sessionStartGraceMs) {
      return true;
    }
  }
  return false;
}

function activeTaskHasFreshGitHubRun(task: TaskNode): boolean {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  if (!taskId) return false;
  const workspaceDir = join(projectDir, "workspace", taskId);
  const runStatusFiles = listFiles(
    workspaceDir,
    (path) =>
      extname(path) === ".json" &&
      path.split("/").pop()?.startsWith("run-status") === true,
  );
  if (runStatusFiles.length === 0) return false;

  let freshestMs = Number.NEGATIVE_INFINITY;
  let freshestStatus = "";
  for (const path of runStatusFiles) {
    const payload = readJson<Record<string, unknown>>(path, {});
    const nested = recordValue(payload.json) ?? payload;
    const status =
      typeof nested.status === "string" ? nested.status.trim().toLowerCase() : "";
    const updatedAt =
      typeof nested.updated_at === "string"
        ? nested.updated_at
        : typeof nested.run_started_at === "string"
          ? nested.run_started_at
          : "";
    const updatedMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
    if (!Number.isFinite(updatedMs) || updatedMs < freshestMs) continue;
    freshestMs = updatedMs;
    freshestStatus = status;
  }

  if (!Number.isFinite(freshestMs)) return false;
  if (!["queued", "pending", "waiting", "requested", "in_progress"].includes(freshestStatus)) {
    return false;
  }
  return Date.now() - freshestMs <= staleActiveNoActivityMs;
}

function activeTaskRestartReason(task: TaskNode): string | null {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  const sessionId =
    typeof task.session_id === "string" && task.session_id.trim()
      ? task.session_id.trim()
      : "";
  const verifierByTaskId = loadVerifierLivenessByTaskId();
  const verifier = taskId ? verifierByTaskId.get(taskId) : undefined;
  const currentAttemptId =
    typeof task.trace?.current_attempt_id === "string"
      ? task.trace.current_attempt_id
      : null;

  if (
    task.workflow === "single-spec-verifier" &&
    verifier &&
    verifier.activeAttemptId === currentAttemptId
  ) {
    const heartbeatMs = verifier.heartbeatAt
      ? Date.parse(verifier.heartbeatAt)
      : Number.NaN;
    if (
      Number.isFinite(heartbeatMs) &&
      Date.now() - heartbeatMs <= staleActiveNoActivityMs
    ) {
      return null;
    }
    return "verifier-no-heartbeat";
  }

  if (!sessionId) {
    return activeTaskIsWithinStartGrace(task) ? null : "missing-session";
  }
  const reason = sessionRestartReason(sessionId);
  if (reason === "session-not-running" && activeTaskIsWithinStartGrace(task)) {
    return null;
  }
  if (
    reason === "session-not-running" &&
    sessionId.startsWith("s_task_") &&
    taskId
  ) {
    const workerRow = activeTaskWorkerSessionRow(taskId);
    const workerReason = sessionRestartReasonFromRow(workerRow);
    if (workerReason === null) return null;
    if (workerReason !== "session-not-running") return workerReason;

    const featureRow = activeTaskFeatureReferenceSessionRow(task);
    const featureReason = sessionRestartReasonFromRow(featureRow);
    if (featureReason === null) return null;
    if (featureReason !== "session-not-running") return featureReason;

    if (activeTaskHasFreshGitHubRun(task)) return null;
  }
  return reason;
}

function staleActiveTaskDetails(): StaleActiveTaskInfo[] {
  return activeLeafTasks().flatMap((task) => {
    const restartReason = activeTaskRestartReason(task);
    const taskId = typeof task.id === "string" ? task.id.trim() : "";
    const sessionId =
      typeof task.session_id === "string" && task.session_id.trim()
        ? task.session_id.trim()
        : null;
    if (!restartReason || !taskId) return [];
    return [{ taskId, sessionId, restartReason }];
  });
}

function staleActiveTaskCount(): number {
  return staleActiveTaskDetails().length;
}

function runningActiveTaskCount(): number {
  return activeLeafTasks().filter((task) => !activeTaskRestartReason(task))
    .length;
}

function hasLiveExecutionRunnableBacklog(): boolean {
  return listRunnableBacklogTaskIds(
    taskTreeConfig({
      appDir: effectiveAppDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: desiredParallelism,
    }),
    200,
  ).some((taskId) => {
    const haystack = taskId.toLowerCase();
    return [
      "staging",
      "execute",
      "execution",
      "verify",
      "verification",
      "frontier",
      "spec-runner",
      "ready-spec-execution",
      "live",
    ].some((signal) => haystack.includes(signal));
  });
}

function runResults(): RunResult[] {
  return listFiles(join(projectDir, "runs", "executions"), (path) =>
    path.endsWith("/result.json"),
  ).map((path) => readJson<RunResult>(path, {}));
}

function isLiveRun(run: RunResult): boolean {
  return (
    run.dryRun === false ||
    run.mode === "execute" ||
    run.mode === "executing" ||
    run.probeEvidence?.mode === "execute" ||
    run.probeEvidence?.mode === "executing" ||
    run.probeEvidence?.mode === "cloud-execution"
  );
}

function runTime(run: RunResult): number | null {
  for (const value of [run.completedAt, run.endedAt, run.startedAt]) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function liveRuns24h(): RunResult[] {
  return runResults().filter((run) => {
    if (!isLiveRun(run)) return false;
    const ts = runTime(run);
    return ts != null && ts >= dayAgo;
  });
}

function duplicateArtifactCount(): number {
  const archiveDir = join(projectDir, "evidence", "archive");
  const groups = new Map<string, number>();
  for (const path of listFiles(
    archiveDir,
    (item) => extname(item) === ".json" || extname(item) === ".md",
  )) {
    const base = path.split("/").pop() ?? "";
    // Metric-alert/admin evidence is required workflow bookkeeping, not AKS
    // feature/run evidence. Counting repeated alert-note families here creates a
    // self-breaching hygiene loop where alert triage artifacts inflate the
    // duplicate-artifact metric themselves.
    if (
      base.startsWith("metric-alert-") ||
      base.startsWith("artifact-duplicate-group-count-")
    ) {
      continue;
    }
    const key = base
      .replace(/-\d{8}T\d{6}Z(?=-|\.|$)/g, "")
      .replace(/-\d{8,}(?=-|\.|$)/g, "")
      .replace(/-iteration\d+(?=-|\.|$)/g, "")
      .replace(/--+/g, "-")
      .replace(/-\./g, ".");
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.values()].filter((count) => count > 3).length;
}

function plannerRuns(): PlannerRun[] {
  const plannerRunsPath = join(effectiveAppDir, ".state", "planner-runs.jsonl");
  if (!existsSync(plannerRunsPath)) return [];
  try {
    return readFileSync(plannerRunsPath, "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PlannerRun)
      .filter((row) => row.kind === "planner_wake");
  } catch {
    return [];
  }
}

function plannerRunTimestamp(run: PlannerRun): number | null {
  const parsed = typeof run.ts === "string" ? Date.parse(run.ts) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function recentPlannerRuns(hours: number): PlannerRun[] {
  const since = now - hours * 60 * 60 * 1000;
  return plannerRuns().filter((run) => {
    const ts = plannerRunTimestamp(run);
    return ts != null && ts >= since;
  });
}

function plannerTimedOut(run: PlannerRun): boolean {
  const result = (run.result ?? "").toLowerCase();
  return result.includes("timed out after");
}

function plannerTouchesOwnerSteps(run: PlannerRun): boolean {
  return (
    run.steps?.includes("event-review") ||
    run.steps?.includes("planning-update") ||
    false
  );
}

function plannerTimeoutStreak24h(runs: PlannerRun[]): number {
  const ordered = [...runs]
    .filter((run) => plannerTouchesOwnerSteps(run))
    .sort(
      (a, b) => (plannerRunTimestamp(a) ?? 0) - (plannerRunTimestamp(b) ?? 0),
    );
  let streak = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (plannerTimedOut(ordered[index])) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function isSlowPlannerRun(run: PlannerRun): boolean {
  if (typeof run.durationMs === "number" && Number.isFinite(run.durationMs)) {
    return run.durationMs >= 180_000;
  }
  const status = (run.status ?? "").toLowerCase();
  const result = (run.result ?? "").toLowerCase();
  return (
    result.includes("timed out after") ||
    status === "interrupted" ||
    status === "cancelled"
  );
}

function metricSampleOutputFor(metricId: string): MetricSampleOutput {
  const tasks = taskCounts();
  const model = modelStatus();
  const pathStatus = model.paths?.byStatus ?? {};
  const featureStatus = model.features?.byStatus ?? {};
  const pathGaps = pathGapCount();
  const specs = specMetrics();
  const specRecovery = specLoopRecoveryStats();
  const openGaps = pathGaps + specs.unverified;
  const live = liveRuns24h();
  const plannerRecent = recentPlannerRuns(24);

  const values: Record<string, () => MetricSampleOutput> = {
    "aks-rp-e2e.task.ready-count": () => ({ value: tasks.runnable }),
    "aks-rp-e2e.task.active-count": () => ({ value: tasks.active }),
    "aks-rp-e2e.task.stale-active-count": () => ({ value: tasks.activeStale }),
    "aks-rp-e2e.task.blocked-count": () => ({ value: tasks.blocked }),
    "aks-rp-e2e.task.completed-24h": () => ({ value: tasks.completed24h }),
    "aks-rp-e2e.task.no-work-with-gaps": () => ({
      value:
        !tasks.projectClosed &&
        tasks.runnable === 0 &&
        tasks.activeRunning === 0 &&
        openGaps > 0
          ? 1
          : 0,
    }),
    "aks-rp-e2e.task.ready-starvation-with-gaps": () => ({
      value:
        !tasks.projectClosed &&
        tasks.runnable === 0 &&
        tasks.activeRunning === 0 &&
        tasks.review === 0 &&
        openGaps > 0
          ? 1
          : 0,
    }),
    "aks-rp-e2e.task.capacity-underfilled-with-gaps": () => ({
      value:
        !tasks.projectClosed &&
        tasks.runnable + tasks.activeRunning < Math.max(1, desiredParallelism) &&
        openGaps > 0
          ? 1
          : 0,
    }),
    "aks-rp-e2e.task.stale-active-with-gaps": () => ({
      value:
        !tasks.projectClosed && tasks.activeStale > 0 && openGaps > 0 ? 1 : 0,
    }),
    "aks-rp-e2e.process.unowned-work-count": () => {
      const staleActiveTasks = staleActiveTaskDetails();
      const assignmentMismatches = openTaskAssignmentStateMismatchDetails(
        loadTaskTree(),
      );
      const value = tasks.projectClosed
        ? 0
        : staleActiveTasks.length +
          assignmentMismatches.length +
          specRecovery.recoveryUnowned;
      return {
        value,
        sampleSize:
          staleActiveTasks.length +
          assignmentMismatches.length +
          specRecovery.recoveryUnownedSpecIds.length,
        note: JSON.stringify({
          sampledAt: new Date().toISOString(),
          staleActiveTaskIds: staleActiveTasks.map((task) => task.taskId),
          staleActiveTaskSessions: staleActiveTasks.map((task) => ({
            taskId: task.taskId,
            sessionId: task.sessionId,
            restartReason: task.restartReason,
          })),
          assignmentMismatchKeys: assignmentMismatches.map(
            (mismatch) => mismatch.correlationKey,
          ),
          assignmentMismatchTasks: assignmentMismatches,
          recoveryUnownedSpecIds: specRecovery.recoveryUnownedSpecIds,
        }),
      };
    },
    "aks-rp-e2e.process.assignment-state-mismatch-count": () => ({
      value: tasks.projectClosed ? 0 : tasks.assignmentStateMismatch,
    }),
    "aks-rp-e2e.process.unpublished-change-count": () => ({
      value: unpublishedGitChangeCount(projectDir),
    }),
    "aks-rp-e2e.process.integrity.task-tree-problem-count": () => ({
      value: tasks.taskTreeProblemCount,
    }),
    "aks-rp-e2e.process.blocked.missing-waiting-for-count": () => ({
      value: tasks.blockedMissingWaitingFor,
    }),
    "aks-rp-e2e.process.blocked.missing-observer-count": () => ({
      value: tasks.blockedMissingObserver,
    }),
    "aks-rp-e2e.process.blocked.missing-resume-condition": () => ({
      value: tasks.blockedMissingResumeCondition,
    }),
    "aks-rp-e2e.process.blocked.missing-owner-count": () => ({
      value: tasks.blockedMissingOwner,
    }),
    "aks-rp-e2e.process.blocked.missing-fallback-count": () => ({
      value: tasks.blockedMissingFallback,
    }),
    "aks-rp-e2e.model.unknown-path-count": () => ({
      value: (pathStatus.unknown ?? 0) + (pathStatus["source-enumerated"] ?? 0),
    }),
    "aks-rp-e2e.model.failed-path-count": () => ({
      value: pathStatus.fail ?? 0,
    }),
    "aks-rp-e2e.model.blocked-path-count": () => ({
      value: pathStatus.blocked ?? 0,
    }),
    "aks-rp-e2e.feature.unknown-count": () => ({
      value: (featureStatus.unknown ?? 0) + (featureStatus.partial ?? 0),
    }),
    "aks-rp-e2e.spec.total-count": () => ({ value: countSpecs() }),
    "aks-rp-e2e.spec.verified-count": () => ({ value: specs.verified }),
    "aks-rp-e2e.spec.reviewed-exception-count": () => ({
      value: specs.reviewedException,
    }),
    "aks-rp-e2e.spec.unverified-count": () => ({ value: specs.unverified }),
    "aks-rp-e2e.spec.failed-count": () => ({ value: specs.failed }),
    "aks-rp-e2e.spec.blocked-count": () => ({ value: specs.blocked }),
    "aks-rp-e2e.spec.ready-count": () => ({ value: specs.ready }),
    "aks-rp-e2e.spec.draft-count": () => ({ value: specs.draft }),
    "aks-rp-e2e.spec.retry-exhausted-count": () => ({
      value: specRecovery.retryExhausted,
    }),
    "aks-rp-e2e.spec.recovery-unowned-count": () => ({
      value: specRecovery.recoveryUnowned,
    }),
    "aks-rp-e2e.spec.unverified-without-work": () => ({
      value:
        !tasks.projectClosed &&
        specs.unverified > 0 &&
        !hasOpenSpecVerificationWork(tasks)
          ? 1
          : 0,
    }),
    "aks-rp-e2e.replay.script-count": () => ({ value: countReplays() }),
    "aks-rp-e2e.run.live-started-24h": () => ({ value: live.length }),
    "aks-rp-e2e.run.live-succeeded-24h": () => ({
      value: live.filter((run) =>
        ["pass", "passed", "success", "succeeded"].includes(run.status ?? ""),
      ).length,
    }),
    "aks-rp-e2e.run.live-failed-24h": () => ({
      value: live.filter((run) =>
        ["fail", "failed", "infra_failed", "blocked"].includes(
          run.status ?? "",
        ),
      ).length,
    }),
    "aks-rp-e2e.run.live-idle-with-runnable-work": () => ({
      value:
        !tasks.projectClosed &&
        countReplays() > 0 &&
        specs.unverified > 0 &&
        hasLiveExecutionRunnableBacklog() &&
        live.length === 0
          ? 1
          : 0,
    }),
    "aks-rp-e2e.planner.timeout-24h": () => ({
      value: plannerTimeoutStreak24h(plannerRecent),
    }),
    "aks-rp-e2e.planner.slow-count-24h": () => ({
      value: plannerRecent.filter((run) => isSlowPlannerRun(run)).length,
    }),
    "aks-rp-e2e.artifact.duplicate-group-count": () => ({
      value: duplicateArtifactCount(),
    }),
  };

  const compute = values[metricId];
  if (!compute) {
    throw new Error(`Unknown metric id: ${metricId}`);
  }
  return { measuredAt: Date.now(), ...compute() };
}

const metricId = process.argv[2];
if (!metricId || metricId === "--help" || metricId === "-h") {
  console.error("Usage: bun run metrics:sample <metric-id> [--json]");
  process.exit(2);
}

const asJson = process.argv.includes("--json");
const sample = metricSampleOutputFor(metricId);
if (asJson) {
  console.log(JSON.stringify(sample));
} else {
  console.log(sample.value);
}

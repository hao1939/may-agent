import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";
import {
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";

type TaskNode = {
  id?: string;
  parent_id?: string;
  state?: string;
  status?: string;
  kind?: string;
  goal?: string;
  children?: string[];
  depends_on?: string[];
  session_id?: string;
  updated_at?: string;
  trace?: Record<string, unknown>;
  attempts?: unknown[];
};

type TaskTree = {
  tasks?: Record<string, TaskNode>;
  project_lifecycle?: string;
};

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
  process.env.AKS_RP_E2E_DESIRED_PARALLELISM ?? "5",
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
  const candidates = [
    task.updated_at,
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
  return readJson<TaskTree>(join(effectiveAppDir, "tasks", "tree.json"), {
    tasks: {},
  });
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

function taskCounts() {
  const tree = loadTaskTree();
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
  const completed24h = tasks.filter((task) => {
    if (taskState(task) !== "done") return false;
    const ts = timestampOf(task);
    return ts != null && ts >= dayAgo;
  }).length;
  const activeStale = staleActiveTaskCount();
  const activeRunning = runningActiveTaskCount();
  const blockedLeaves = tasks.filter(
    (task) => isLeaf(task) && taskState(task) === "blocked",
  ).length;
  return {
    total: tasks.length,
    runnable:
      frontier?.runnable.length ??
      tasks.filter(isWorkerExecutableBacklogLeaf).length,
    active: frontier?.active.length ?? byStatus.get("active") ?? 0,
    activeRunning,
    activeStale,
    review: frontier?.review.length ?? byStatus.get("review") ?? 0,
    backlog: byStatus.get("backlog") ?? 0,
    blocked: blockedLeaves,
    done: byStatus.get("done") ?? 0,
    completed24h,
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

  const opCount =
    typeof row.opCount === "number" && Number.isFinite(row.opCount)
      ? row.opCount
      : null;
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
    opCount === 0 &&
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

function activeTaskWorkerSessionRow(taskId: string): Record<string, unknown> | null {
  if (!existsSync(stateDbPath)) return null;
  const db = new Database(stateDbPath, { readonly: true });
  const taskIdPattern = new RegExp(
    String.raw`"taskId"\s*:\s*"${taskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
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

function activeLeafTasks(): TaskNode[] {
  const tree = loadTaskTree();
  return Object.values(tree.tasks ?? {}).filter(
    (task) => isLeaf(task) && taskState(task) === "active",
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

function activeTaskRestartReason(task: TaskNode): string | null {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  const sessionId =
    typeof task.session_id === "string" && task.session_id.trim()
      ? task.session_id.trim()
      : "";
  if (!sessionId) {
    return activeTaskIsWithinStartGrace(task) ? null : "missing-session";
  }
  const reason = sessionRestartReason(sessionId);
  if (reason === "session-not-running" && activeTaskIsWithinStartGrace(task)) {
    return null;
  }
  if (reason === "session-not-running" && sessionId.startsWith("s_task_") && taskId) {
    const workerRow = activeTaskWorkerSessionRow(taskId);
    const workerReason = sessionRestartReasonFromRow(workerRow);
    if (workerReason === null) return null;
    if (workerReason !== "session-not-running") return workerReason;
  }
  return reason;
}

function staleActiveTaskCount(): number {
  return activeLeafTasks().filter((task) => activeTaskRestartReason(task))
    .length;
}

function runningActiveTaskCount(): number {
  return activeLeafTasks().filter((task) => !activeTaskRestartReason(task))
    .length;
}

function hasLiveExecutionRunnableBacklog(): boolean {
  const tree = loadTaskTree();
  const taskMap = tree.tasks ?? {};
  const tasks = Object.values(taskMap);
  const idSignals = [
    "staging",
    "execute",
    "execution",
    "verify",
    "verification",
    "frontier",
    "spec-runner",
    "ready-spec-execution",
    "live",
  ];
  const negativeSignals = [
    "repo-local",
    "source-holder-response-await",
    "handwritten-source",
    "ownership-attach",
    "checkpoint",
    "canonical-branch-scout",
    "contradiction-reconcile",
    "planner",
    "focus-plan",
    "metadata",
    "repair",
    "reconcile",
    "draft-sweep",
  ];

  return tasks.some((task) => {
    if (taskState(task) !== "backlog" || !isLeaf(task)) return false;
    if (
      (task.depends_on ?? []).some((dependencyId) => {
        if (typeof dependencyId !== "string") return false;
        const dependency = taskMap[dependencyId];
        if (!dependency) return false;
        return taskState(dependency) !== "done";
      })
    ) {
      return false;
    }
    const haystack = [task.id, task.goal, task.kind, task.parent_id]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();
    const hasExecutionSignal = idSignals.some((signal) =>
      haystack.includes(signal),
    );
    if (!hasExecutionSignal) return false;
    return !negativeSignals.some((signal) => haystack.includes(signal));
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
      .replace(/-\d{8}T\d{6}Z.*$/, "")
      .replace(/-\d{8,}.*$/, "")
      .replace(/-iteration\d+.*$/, "");
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

function isSlowPlannerRun(run: PlannerRun): boolean {
  if (typeof run.durationMs === "number" && Number.isFinite(run.durationMs)) {
    return run.durationMs >= 180_000;
  }
  const result = (run.result ?? "").toLowerCase();
  return (
    result.includes("timed out after") ||
    result.includes("interrupted") ||
    result.includes("cancelled")
  );
}

function valueFor(metricId: string): number {
  const tasks = taskCounts();
  const model = modelStatus();
  const pathStatus = model.paths?.byStatus ?? {};
  const featureStatus = model.features?.byStatus ?? {};
  const pathGaps = pathGapCount();
  const specs = specMetrics();
  const openGaps = pathGaps + specs.unverified;
  const live = liveRuns24h();
  const plannerRecent = recentPlannerRuns(24);

  const values: Record<string, () => number> = {
    "aks-rp-e2e.task.ready-count": () => tasks.runnable,
    "aks-rp-e2e.task.active-count": () => tasks.active,
    "aks-rp-e2e.task.stale-active-count": () => tasks.activeStale,
    "aks-rp-e2e.task.blocked-count": () => tasks.blocked,
    "aks-rp-e2e.task.completed-24h": () => tasks.completed24h,
    "aks-rp-e2e.task.no-work-with-gaps": () =>
      !tasks.projectClosed &&
      tasks.runnable === 0 &&
      tasks.activeRunning === 0 &&
      openGaps > 0
        ? 1
        : 0,
    "aks-rp-e2e.task.ready-starvation-with-gaps": () =>
      !tasks.projectClosed && tasks.runnable === 0 && openGaps > 0 ? 1 : 0,
    "aks-rp-e2e.task.capacity-underfilled-with-gaps": () =>
      !tasks.projectClosed &&
      tasks.runnable + tasks.activeRunning < Math.max(1, desiredParallelism) &&
      openGaps > 0
        ? 1
        : 0,
    "aks-rp-e2e.task.stale-active-with-gaps": () =>
      !tasks.projectClosed && tasks.activeStale > 0 && openGaps > 0 ? 1 : 0,
    "aks-rp-e2e.model.unknown-path-count": () =>
      (pathStatus.unknown ?? 0) + (pathStatus["source-enumerated"] ?? 0),
    "aks-rp-e2e.model.failed-path-count": () => pathStatus.fail ?? 0,
    "aks-rp-e2e.model.blocked-path-count": () =>
      (pathStatus.blocked ?? 0) + (pathStatus["blocked-infra"] ?? 0),
    "aks-rp-e2e.feature.unknown-count": () =>
      (featureStatus.unknown ?? 0) + (featureStatus.partial ?? 0),
    "aks-rp-e2e.spec.total-count": () => countSpecs(),
    "aks-rp-e2e.spec.verified-count": () => specs.verified,
    "aks-rp-e2e.spec.reviewed-exception-count": () => specs.reviewedException,
    "aks-rp-e2e.spec.unverified-count": () => specs.unverified,
    "aks-rp-e2e.spec.failed-count": () => specs.failed,
    "aks-rp-e2e.spec.blocked-count": () => specs.blocked,
    "aks-rp-e2e.spec.ready-count": () => specs.ready,
    "aks-rp-e2e.spec.draft-count": () => specs.draft,
    "aks-rp-e2e.spec.unverified-without-work": () =>
      !tasks.projectClosed &&
      specs.unverified > 0 &&
      !hasOpenSpecVerificationWork(tasks)
        ? 1
        : 0,
    "aks-rp-e2e.replay.script-count": () => countReplays(),
    "aks-rp-e2e.run.live-started-24h": () => live.length,
    "aks-rp-e2e.run.live-succeeded-24h": () =>
      live.filter((run) =>
        ["pass", "passed", "success", "succeeded"].includes(run.status ?? ""),
      ).length,
    "aks-rp-e2e.run.live-failed-24h": () =>
      live.filter((run) =>
        ["fail", "failed", "infra_failed", "blocked"].includes(
          run.status ?? "",
        ),
      ).length,
    "aks-rp-e2e.run.live-idle-with-runnable-work": () =>
      !tasks.projectClosed &&
      countReplays() > 0 &&
      specs.unverified > 0 &&
      hasLiveExecutionRunnableBacklog() &&
      live.length === 0
        ? 1
        : 0,
    "aks-rp-e2e.planner.timeout-24h": () =>
      plannerRecent.filter((run) => {
        const result = (run.result ?? "").toLowerCase();
        return (
          result.includes("timed out after") &&
          (run.steps?.includes("event-review") ||
            run.steps?.includes("planning-update"))
        );
      }).length,
    "aks-rp-e2e.planner.slow-count-24h": () =>
      plannerRecent.filter((run) => isSlowPlannerRun(run)).length,
    "aks-rp-e2e.artifact.duplicate-group-count": () => duplicateArtifactCount(),
  };

  const compute = values[metricId];
  if (!compute) {
    throw new Error(`Unknown metric id: ${metricId}`);
  }
  return compute();
}

const metricId = process.argv[2];
if (!metricId || metricId === "--help" || metricId === "-h") {
  console.error("Usage: bun run metrics:sample <metric-id>");
  process.exit(2);
}

console.log(valueFor(metricId));

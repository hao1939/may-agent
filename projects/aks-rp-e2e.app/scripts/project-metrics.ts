import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";

type TaskNode = {
  id?: string;
  state?: string;
  status?: string;
  kind?: string;
  children?: string[];
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
  dryRun?: boolean;
  startedAt?: string;
  completedAt?: string;
  endedAt?: string;
  probeEvidence?: {
    mode?: string;
    status?: string;
  } | null;
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
const projectDir = resolve(
  process.env.PROJECT_DIR ?? join(appDir, "..", "aks-rp-e2e"),
);
const desiredParallelism = Number.parseInt(
  process.env.AKS_RP_E2E_DESIRED_PARALLELISM ?? "5",
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
  return readJson<TaskTree>(join(appDir, "tasks", "tree.json"), { tasks: {} });
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
        appDir,
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
  return {
    total: tasks.length,
    runnable:
      frontier?.runnable.length ??
      tasks.filter(isWorkerExecutableBacklogLeaf).length,
    active: frontier?.active.length ?? byStatus.get("active") ?? 0,
    review: frontier?.review.length ?? byStatus.get("review") ?? 0,
    backlog: byStatus.get("backlog") ?? 0,
    blocked: frontier?.blocked.length ?? byStatus.get("blocked") ?? 0,
    done: byStatus.get("done") ?? 0,
    completed24h,
    projectClosed: tree.project_lifecycle === "closed",
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
    tasks.active > 0 ||
    tasks.review > 0
  );
}

function countReplays(): number {
  return listFiles(join(projectDir, "replays"), (path) => {
    const rel = path.slice(join(projectDir, "replays").length + 1);
    return extname(path) === ".ts" && !rel.startsWith("lib/");
  }).length;
}

function runResults(): RunResult[] {
  return listFiles(join(projectDir, "runs", "executions"), (path) =>
    path.endsWith("/result.json"),
  ).map((path) => readJson<RunResult>(path, {}));
}

function isLiveRun(run: RunResult): boolean {
  return run.dryRun === false || run.probeEvidence?.mode === "execute";
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
    const key = base
      .replace(/-\d{8}T\d{6}Z.*$/, "")
      .replace(/-\d{8,}.*$/, "")
      .replace(/-iteration\d+.*$/, "");
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.values()].filter((count) => count > 3).length;
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

  const values: Record<string, () => number> = {
    "aks-rp-e2e.task.ready-count": () => tasks.runnable,
    "aks-rp-e2e.task.active-count": () => tasks.active,
    "aks-rp-e2e.task.blocked-count": () => tasks.blocked,
    "aks-rp-e2e.task.completed-24h": () => tasks.completed24h,
    "aks-rp-e2e.task.no-work-with-gaps": () =>
      !tasks.projectClosed &&
      tasks.runnable === 0 &&
      tasks.active === 0 &&
      openGaps > 0
        ? 1
        : 0,
    "aks-rp-e2e.task.ready-starvation-with-gaps": () =>
      !tasks.projectClosed && tasks.runnable === 0 && openGaps > 0 ? 1 : 0,
    "aks-rp-e2e.task.capacity-underfilled-with-gaps": () =>
      !tasks.projectClosed &&
      tasks.runnable + tasks.active < Math.max(1, desiredParallelism) &&
      openGaps > 0
        ? 1
        : 0,
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
      live.length === 0
        ? 1
        : 0,
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

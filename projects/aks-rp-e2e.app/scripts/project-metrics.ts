import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type TaskNode = {
  id?: string;
  status?: string;
  updated_at?: string;
  trace?: Record<string, unknown>;
  attempts?: unknown[];
};

type TaskTree = {
  tasks?: Record<string, TaskNode>;
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

function taskCounts() {
  const tree = loadTaskTree();
  const tasks = Object.values(tree.tasks ?? {});
  const byStatus = new Map<string, number>();
  for (const task of tasks) {
    const status = task.status ?? "unknown";
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }
  const completed24h = tasks.filter((task) => {
    if (task.status !== "accepted") return false;
    const ts = timestampOf(task);
    return ts != null && ts >= dayAgo;
  }).length;
  return {
    total: tasks.length,
    ready: byStatus.get("ready") ?? 0,
    active: byStatus.get("active") ?? 0,
    review: byStatus.get("review") ?? 0,
    proposed: byStatus.get("proposed") ?? 0,
    blocked: byStatus.get("blocked") ?? 0,
    accepted: byStatus.get("accepted") ?? 0,
    completed24h,
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
  return listFiles(join(projectDir, "specs"), (path) => {
    const base = path.split("/").pop() ?? "";
    return (
      extname(path) === ".json" &&
      base !== "index.json" &&
      !base.endsWith(".bak")
    );
  }).length;
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
  const live = liveRuns24h();

  const values: Record<string, () => number> = {
    "aks-rp-e2e.task.ready-count": () => tasks.ready,
    "aks-rp-e2e.task.active-count": () => tasks.active,
    "aks-rp-e2e.task.blocked-count": () => tasks.blocked,
    "aks-rp-e2e.task.completed-24h": () => tasks.completed24h,
    "aks-rp-e2e.task.no-work-with-gaps": () =>
      tasks.ready === 0 && tasks.active === 0 && tasks.review === 0 && pathGaps > 0 ? 1 : 0,
    "aks-rp-e2e.task.ready-starvation-with-gaps": () =>
      tasks.ready === 0 && pathGaps > 0 ? 1 : 0,
    "aks-rp-e2e.task.capacity-underfilled-with-gaps": () =>
      tasks.ready + tasks.active < Math.max(1, desiredParallelism) &&
      pathGaps > 0
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
      countReplays() > 0 && pathGaps > 0 && live.length === 0 ? 1 : 0,
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

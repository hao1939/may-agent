import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTaskTreePath } from "@may-agent/sdk";

type ProjectJson = {
  domainProject?: {
    path?: string;
  };
};

type TaskNode = {
  id?: string;
  state?: string;
  status?: string;
  goal?: string;
  parent_id?: string | null;
  inputs?: string[];
  outputs?: string[];
  acceptance?: string[];
  conflict_scope?: string[] | string;
  context?: unknown;
  trace?: unknown;
};

type TaskTree = {
  tasks?: Record<string, TaskNode>;
};

type ArchivedTaskBundle = {
  tasks?: TaskNode[];
};

type GitChange = {
  status: string;
  path: string;
  slice: string;
};

type RelatedTask = {
  id: string;
  status: string;
  matched_by: Array<"path" | "scope">;
};

type FileCheckpoint = GitChange & {
  active_or_review_tasks: RelatedTask[];
  blocked_tasks: RelatedTask[];
  accepted_tasks: RelatedTask[];
  carrier_tasks: RelatedTask[];
  related_tasks: RelatedTask[];
  recommendation: "hold" | "candidate" | "needs-planner-review";
};

type SliceCheckpoint = {
  slice: string;
  files: string[];
  active_or_review_tasks: string[];
  blocked_tasks: string[];
  accepted_tasks: string[];
  carrier_tasks: string[];
  recommendation: "hold" | "candidate" | "needs-planner-review";
};

type CheckpointSummary = {
  projectDir: string;
  files: FileCheckpoint[];
  slices: SliceCheckpoint[];
};

type SummarizeOptions = {
  appDir?: string;
  projectDir?: string;
  taskTree?: TaskTree;
  archivedTasks?: TaskNode[];
  changes?: GitChange[];
  paths?: string[];
  boundedSliceLabel?: string;
};

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function loadArchivedTasks(appDir: string): TaskNode[] {
  const archiveDir = resolve(appDir, "tasks", "archive");
  if (!existsSync(archiveDir)) return [];

  const archivedTasks: TaskNode[] = [];
  for (const entry of readdirSync(archiveDir)) {
    if (!entry.startsWith("done-leaves-") || !entry.endsWith(".json")) continue;
    const bundle = readJson<ArchivedTaskBundle>(resolve(archiveDir, entry));
    if (!Array.isArray(bundle?.tasks)) continue;
    for (const task of bundle.tasks) {
      if (task && typeof task === "object") {
        archivedTasks.push(task);
      }
    }
  }

  return archivedTasks;
}

function loadAppContext(appDir: string): {
  projectDir: string;
  taskTree: TaskTree;
  archivedTasks: TaskNode[];
} {
  const projectJson = readJson<ProjectJson>(resolve(appDir, "project.json"));
  const projectDir = resolve(
    appDir,
    projectJson?.domainProject?.path ?? "../aks-rp-e2e",
  );
  const taskTree = readJson<TaskTree>(
    resolveTaskTreePath(appDir),
  ) ?? {
    tasks: {},
  };
  const archivedTasks = loadArchivedTasks(appDir);
  return { projectDir, taskTree, archivedTasks };
}

function taskState(task: TaskNode): string {
  const raw = task.state ?? task.status ?? "";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return raw;
}

function git(projectDir: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: projectDir,
    encoding: "utf-8",
  });
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function changeSlice(path: string): string {
  const parts = path.split("/");
  if (parts[0] === "features") {
    const feature = parts[1]?.endsWith(".yaml")
      ? parts[1].slice(0, -".yaml".length)
      : parts[1];
    return feature ? `feature:${feature}` : "feature";
  }
  if (parts[0] === "specs") {
    return parts[1]?.endsWith(".json")
      ? `spec:${parts[1].slice(0, -".json".length)}`
      : "spec";
  }
  if (parts[0] === "replays") {
    return parts[1]?.endsWith(".ts")
      ? `replay:${parts[1].slice(0, -".ts".length)}`
      : "replay";
  }
  if (
    parts[0] === "model" &&
    parts[1] === "knowledge-map" &&
    parts[2] === "derived" &&
    parts[3]
  ) {
    return `model-derived:${parts[3]}`;
  }
  if (parts[0] === "model") return "model";
  if (parts[0] === "evidence") return "evidence";
  return parts[0] || "root";
}

function parseGitStatus(projectDir: string, paths?: string[]): GitChange[] {
  if (!existsSync(projectDir)) {
    throw new Error(`Domain project does not exist: ${projectDir}`);
  }
  const args = ["status", "--porcelain=v1", "--untracked-files=all"];
  if (paths && paths.length > 0) {
    args.push("--", ...paths);
  }
  const output = git(projectDir, args);
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || "changed";
      const rawPath = line.slice(3);
      const path = rawPath.includes(" -> ")
        ? rawPath.split(" -> ").pop()!
        : rawPath;
      return { status, path, slice: changeSlice(path) };
    });
}

const derivedPathSignalsCache = new Map<string, string[]>();

function featureSignalsFromSpecPath(
  projectDir: string,
  specPath: string,
): string[] {
  try {
    const fullPath = resolve(projectDir, specPath);
    const spec = JSON.parse(readFileSync(fullPath, "utf-8")) as {
      id?: unknown;
      featureId?: unknown;
      featurePathIds?: unknown;
      probeRef?: unknown;
    };
    const signals: string[] = [];
    if (typeof spec.id === "string" && spec.id.trim()) {
      signals.push(`spec:${spec.id.trim()}`);
    }
    if (typeof spec.featureId === "string" && spec.featureId.trim()) {
      signals.push(`feature:${spec.featureId.trim()}`);
    }
    if (typeof spec.probeRef === "string" && spec.probeRef.trim()) {
      const probeName = spec.probeRef
        .trim()
        .split("/")
        .pop()
        ?.replace(/\.ts$/, "");
      if (probeName) {
        signals.push(`replay:${probeName}`);
      }
    }
    if (Array.isArray(spec.featurePathIds)) {
      for (const featurePathId of spec.featurePathIds) {
        if (typeof featurePathId === "string" && featurePathId.trim()) {
          signals.push(featurePathId.trim());
          signals.push(`path:${featurePathId.trim()}`);
        }
      }
    }
    return signals;
  } catch {
    return [];
  }
}

function featureRootedSiblingSpecPaths(path: string): string[] {
  const parts = path.split("/");
  if (parts[0] !== "features" || parts[2] !== "tests" || !parts[3]) {
    return [];
  }

  const baseName = parts[3].replace(/\.ts$/, "");
  const candidates = new Set<string>([
    `features/${parts[1]}/specs/${baseName}.json`,
  ]);
  if (baseName.endsWith(".test")) {
    candidates.add(
      `features/${parts[1]}/specs/${baseName.slice(0, -".test".length)}.json`,
    );
  }
  return [...candidates];
}

function derivedPathSignals(projectDir: string, path: string): string[] {
  const cacheKey = `${projectDir}\u0000${path}`;
  const cached = derivedPathSignalsCache.get(cacheKey);
  if (cached) return cached;

  const parts = path.split("/");
  let signals: string[] = [];

  if (parts[0] === "specs" && parts[1]?.endsWith(".json")) {
    signals = featureSignalsFromSpecPath(projectDir, path);
  }

  if (parts[0] === "replays" && parts[1]?.endsWith(".ts")) {
    const siblingSpecPath = path
      .replace(/^replays\//, "specs/")
      .replace(/\.ts$/, ".json");
    signals = featureSignalsFromSpecPath(projectDir, siblingSpecPath);
  }

  if (
    parts[0] === "features" &&
    parts[2] === "specs" &&
    parts[3]?.endsWith(".json")
  ) {
    signals = featureSignalsFromSpecPath(projectDir, path);
  }

  if (
    parts[0] === "features" &&
    parts[2] === "tests" &&
    parts[3]?.endsWith(".ts")
  ) {
    const siblingSignals = featureRootedSiblingSpecPaths(path).flatMap(
      (siblingSpecPath) =>
        featureSignalsFromSpecPath(projectDir, siblingSpecPath),
    );
    signals = [...signals, ...siblingSignals];
  }

  const normalized = [
    ...new Set(signals.filter(Boolean).map((signal) => signal.toLowerCase())),
  ];
  derivedPathSignalsCache.set(cacheKey, normalized);
  return normalized;
}

function pathSignals(projectDir: string, path: string): string[] {
  const withoutExt = path.replace(/\.[^.]+$/, "");
  const parts = path.split("/");
  const signals = new Set<string>([
    path,
    withoutExt,
    changeSlice(path),
    ...derivedPathSignals(projectDir, path),
  ]);
  if (parts[0] === "features" && parts[1]) {
    signals.add(parts[1].replace(/\.(yaml|json|md)$/, ""));
  }
  if ((parts[0] === "specs" || parts[0] === "replays") && parts[1]) {
    signals.add(parts[1].replace(/\.(json|ts)$/, ""));
  }
  return [...signals].filter(Boolean).map((signal) => signal.toLowerCase());
}

function normalizePath(value: string): string {
  return value
    .replace(/^\/app\/projects\/aks-rp-e2e\//, "")
    .replace(/^\.\.\/aks-rp-e2e\//, "")
    .replace(/^\.?\//, "")
    .replace(/\/+$/, "");
}

function isGenericDomainOutput(value: string): boolean {
  return new Set([
    "features",
    "specs",
    "replays",
    "suites",
    "runner",
    "runs",
    "evidence",
    "evidence/archive",
    "model",
    "model/knowledge-map",
    "model/knowledge-map/views",
  ]).has(value);
}

function pathOwnedByDeclaration(path: string, declaration: string): boolean {
  const normalizedPath = normalizePath(path).toLowerCase();
  const normalizedDeclaration = normalizePath(declaration).toLowerCase();
  if (!normalizedDeclaration) return false;
  if (isGenericDomainOutput(normalizedDeclaration)) return false;
  return (
    normalizedPath === normalizedDeclaration ||
    normalizedPath.startsWith(`${normalizedDeclaration}/`) ||
    (normalizedDeclaration.endsWith("/") &&
      normalizedPath.startsWith(normalizedDeclaration))
  );
}

function scopeMatchesPath(
  projectDir: string,
  path: string,
  scope: string,
): boolean {
  const normalizedScope = scope.toLowerCase().trim();
  if (!normalizedScope) return false;

  const slice = changeSlice(path).toLowerCase();
  if (normalizedScope === slice) return true;

  if (normalizedScope.startsWith("model-derived:")) {
    return slice === normalizedScope;
  }

  const signals = pathSignals(projectDir, path);
  if (
    normalizedScope.startsWith("feature:") ||
    normalizedScope.startsWith("spec:") ||
    normalizedScope.startsWith("replay:")
  ) {
    return signals.includes(normalizedScope);
  }

  if (normalizedScope.startsWith("artifact:")) {
    const artifact = normalizedScope.slice("artifact:".length);
    return signals.includes(artifact);
  }

  if (path.startsWith("model/") && normalizedScope.startsWith("model:")) {
    return true;
  }

  return false;
}

function isHistoricalSupersededBlockedTask(task: TaskNode): boolean {
  return (
    taskState(task) === "blocked" &&
    typeof (task as { blocker?: unknown }).blocker === "string" &&
    (task as { blocker?: string }).blocker!.startsWith(
      "Historical/superseded blocker only:",
    )
  );
}

function relatedTasks(
  taskTree: TaskTree,
  archivedTasks: TaskNode[],
  projectDir: string,
  path: string,
): RelatedTask[] {
  const liveTasks = Object.values(taskTree.tasks ?? {});
  const allTasks = [...liveTasks, ...archivedTasks];

  return allTasks
    .filter((task): task is TaskNode & { id: string } =>
      Boolean(task.id && (task.state || task.status)),
    )
    .map((task) => {
      const declaredPaths = [
        ...normalizeStringArray(task.inputs),
        ...normalizeStringArray(task.outputs),
      ];
      const declaredScopes = normalizeStringArray(task.conflict_scope);
      const exactPathMatch = declaredPaths.some((value) =>
        pathOwnedByDeclaration(path, value),
      );
      const scopeMatch = declaredScopes.some((value) =>
        scopeMatchesPath(projectDir, path, value),
      );

      if (
        !exactPathMatch &&
        scopeMatch &&
        isHistoricalSupersededBlockedTask(task)
      ) {
        return null;
      }

      if (!exactPathMatch && !scopeMatch) {
        return null;
      }

      return {
        id: task.id,
        status: taskState(task),
        matched_by: [
          ...(exactPathMatch ? (["path"] as const) : []),
          ...(scopeMatch ? (["scope"] as const) : []),
        ],
      } satisfies RelatedTask;
    })
    .filter((task): task is RelatedTask => Boolean(task))
    .sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) || a.id.localeCompare(b.id),
    )
    .filter(
      (task, index, items) =>
        index === items.findIndex((candidate) => candidate.id === task.id),
    );
}

function statusRank(status: string): number {
  return (
    {
      active: 0,
      review: 1,
      blocked: 2,
      done: 3,
      backlog: 4,
    }[status] ?? 9
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isRootExactPathCarrier(task: RelatedTask): boolean {
  return (
    task.id === "project" &&
    task.status === "active" &&
    task.matched_by.includes("path") &&
    !task.matched_by.includes("scope")
  );
}

function isBoundedSelfCarrier(
  task: RelatedTask,
  boundedSliceLabel?: string,
): boolean {
  return Boolean(
    boundedSliceLabel &&
    task.id === boundedSliceLabel &&
    ["active", "review"].includes(task.status),
  );
}

function summarizeFiles(
  changes: GitChange[],
  taskTree: TaskTree,
  archivedTasks: TaskNode[],
  projectDir: string,
  options: { boundedSliceLabel?: string } = {},
): FileCheckpoint[] {
  const boundedMode = Boolean(options.boundedSliceLabel);

  return changes.map((change) => {
    const related = relatedTasks(
      taskTree,
      archivedTasks,
      projectDir,
      change.path,
    );
    const carrierTasks = boundedMode
      ? related.filter(
          (task) =>
            isRootExactPathCarrier(task) ||
            isBoundedSelfCarrier(task, options.boundedSliceLabel),
        )
      : [];
    const activeOrReview = related.filter(
      (task) =>
        ["active", "review"].includes(task.status) &&
        !carrierTasks.some((carrier) => carrier.id === task.id),
    );
    const blocked = related.filter((task) => task.status === "blocked");
    const accepted = related.filter((task) => task.status === "done");
    const recommendation: FileCheckpoint["recommendation"] =
      activeOrReview.length > 0 || blocked.length > 0
        ? "hold"
        : accepted.length > 0 || carrierTasks.length > 0
          ? "candidate"
          : "needs-planner-review";
    return {
      ...change,
      ...(boundedMode && change.path.startsWith("model/")
        ? { slice: options.boundedSliceLabel! }
        : {}),
      active_or_review_tasks: activeOrReview,
      blocked_tasks: blocked,
      accepted_tasks: accepted,
      carrier_tasks: carrierTasks,
      related_tasks: related,
      recommendation,
    };
  });
}

function summarizeSlices(files: FileCheckpoint[]): SliceCheckpoint[] {
  const bySlice = new Map<string, FileCheckpoint[]>();
  for (const file of files) {
    bySlice.set(file.slice, [...(bySlice.get(file.slice) ?? []), file]);
  }
  return [...bySlice.entries()]
    .map(([slice, sliceFiles]) => {
      const activeOrReview = unique(
        sliceFiles.flatMap((file) =>
          file.active_or_review_tasks.map((task) => task.id),
        ),
      );
      const blocked = unique(
        sliceFiles.flatMap((file) => file.blocked_tasks.map((task) => task.id)),
      );
      const accepted = unique(
        sliceFiles.flatMap((file) =>
          file.accepted_tasks.map((task) => task.id),
        ),
      );
      const carrierTasks = unique(
        sliceFiles.flatMap((file) => file.carrier_tasks.map((task) => task.id)),
      );
      const recommendation: SliceCheckpoint["recommendation"] =
        activeOrReview.length > 0 || blocked.length > 0
          ? "hold"
          : sliceFiles.some(
                (file) => file.recommendation === "needs-planner-review",
              )
            ? "needs-planner-review"
            : accepted.length > 0 || carrierTasks.length > 0
              ? "candidate"
              : "needs-planner-review";
      return {
        slice,
        files: sliceFiles.map((file) => file.path).sort(),
        active_or_review_tasks: activeOrReview,
        blocked_tasks: blocked,
        accepted_tasks: accepted,
        carrier_tasks: carrierTasks,
        recommendation,
      };
    })
    .sort((a, b) => a.recommendation.localeCompare(b.recommendation));
}

function printText(summary: CheckpointSummary) {
  console.log(`Domain project: ${summary.projectDir}`);
  console.log(`dirty files: ${summary.files.length}`);
  const counts = summary.slices.reduce<Record<string, number>>((acc, slice) => {
    acc[slice.recommendation] = (acc[slice.recommendation] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `slices: candidate=${counts.candidate ?? 0} hold=${counts.hold ?? 0} needs-planner-review=${counts["needs-planner-review"] ?? 0}`,
  );
  for (const slice of summary.slices) {
    console.log(`\n[${slice.recommendation}] ${slice.slice}`);
    console.log(`files: ${slice.files.length}`);
    for (const file of slice.files.slice(0, 8)) console.log(`  - ${file}`);
    if (slice.files.length > 8)
      console.log(`  ... ${slice.files.length - 8} more`);
    if (slice.active_or_review_tasks.length)
      console.log(`active/review: ${slice.active_or_review_tasks.join(", ")}`);
    if (slice.blocked_tasks.length)
      console.log(`blocked: ${slice.blocked_tasks.join(", ")}`);
    if (slice.accepted_tasks.length)
      console.log(`accepted: ${slice.accepted_tasks.slice(0, 8).join(", ")}`);
  }
}

export function summarizeDomainCheckpoint(
  options: SummarizeOptions = {},
): CheckpointSummary {
  const defaultAppDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const appDir = options.appDir ?? defaultAppDir;
  const useSyntheticContext =
    options.projectDir !== undefined ||
    options.taskTree !== undefined ||
    options.changes !== undefined ||
    options.archivedTasks !== undefined;
  const appContext = useSyntheticContext ? null : loadAppContext(appDir);
  const projectDir = options.projectDir ?? appContext!.projectDir;
  const taskTree = options.taskTree ?? appContext!.taskTree;
  const archivedTasks =
    options.archivedTasks ?? appContext?.archivedTasks ?? [];
  const changes = options.changes ?? parseGitStatus(projectDir, options.paths);
  const files = summarizeFiles(changes, taskTree, archivedTasks, projectDir, {
    boundedSliceLabel: options.boundedSliceLabel,
  });
  const slices = summarizeSlices(files);
  return {
    projectDir,
    files,
    slices,
  };
}

function splitPathList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readPathsFile(path: string): string[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function parseCliArgs(argv: string[]): {
  json: boolean;
  paths: string[];
  boundedSliceLabel?: string;
} {
  const paths: string[] = [];
  let json = false;
  let boundedSliceLabel: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--bounded-slice") {
      const value = argv[index + 1] ?? "";
      boundedSliceLabel = value.trim() || undefined;
      index += 1;
      continue;
    }
    if (arg.startsWith("--bounded-slice=")) {
      const value = arg.slice("--bounded-slice=".length).trim();
      boundedSliceLabel = value || undefined;
      continue;
    }
    if (arg === "--paths") {
      const value = argv[index + 1] ?? "";
      paths.push(...splitPathList(value));
      index += 1;
      continue;
    }
    if (arg.startsWith("--paths=")) {
      const value = arg.slice("--paths=".length).trim();
      if (value) {
        paths.push(...splitPathList(value));
      }
      continue;
    }
    if (arg === "--paths-file") {
      const value = argv[index + 1] ?? "";
      if (value) {
        paths.push(...readPathsFile(value));
      }
      index += 1;
      continue;
    }
    if (arg.startsWith("--paths-file=")) {
      const value = arg.slice("--paths-file=".length).trim();
      if (value) {
        paths.push(...readPathsFile(value));
      }
    }
  }

  if (boundedSliceLabel && paths.length === 0) {
    throw new Error("--bounded-slice requires --paths or --paths-file");
  }

  return { json, paths: unique(paths), boundedSliceLabel };
}

if (import.meta.main) {
  const cli = parseCliArgs(process.argv.slice(2));
  const summary = summarizeDomainCheckpoint({
    paths: cli.paths.length > 0 ? cli.paths : undefined,
    boundedSliceLabel: cli.boundedSliceLabel,
  });
  if (cli.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printText(summary);
  }
}

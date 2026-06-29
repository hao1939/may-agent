import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

type SpecsIndex = {
  specFiles?: Array<string | { file?: string | null }>;
};

type SpecFile = {
  id?: string;
  featurePathIds?: string[];
  status?: string;
  specState?: string;
};

export type SpecLoopSpecStatus =
  "pending" | "running" | "pass" | "fail" | "error" | "pr_open" | "done";

export type SpecLoopSpecState = {
  status: SpecLoopSpecStatus;
  taskId?: string | null;
  attempts: number;
  lastRunId: string | null;
  lastRunUrl?: string | null;
  lastResultPath: string | null;
  lastPrUrl: string | null;
  activeAttemptId?: string | null;
  activeTaskSessionId?: string | null;
  activeWorkflowRunId?: string | null;
  heartbeatAt?: string | null;
  updatedAt: string;
};

export type SpecLoopState = {
  loopTaskId: string;
  windowSize: number;
  cursor: number;
  prioritySpecIds: string[];
  specs: Record<string, SpecLoopSpecState>;
};

export type SpecRecord = {
  id: string;
  file: string;
  featurePathIds: string[];
  status?: string;
  specState?: string;
  terminalDisposition: boolean;
};

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function normalizedStatus(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/_/g, "-");
}

function isTerminalSpecDisposition(spec: {
  status?: string;
  specState?: string;
}): boolean {
  const values = [
    normalizedStatus(spec.status),
    normalizedStatus(spec.specState),
  ];
  return values.some((value) =>
    [
      "deprecated",
      "product-deprecated",
      "product-gap",
      "product-constraint",
      "environment",
      "environment-blocked",
      "blocked-infra",
      "reviewed-exception",
      "superseded",
      "out-of-scope",
    ].includes(value),
  );
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function selectorsFromFeatureSet(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
}

function listFeatureOwnedSpecFiles(dir: string): string[] {
  const found: string[] = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (!stat.isDirectory()) continue;
    if (entry === "specs") {
      for (const name of readdirSync(path)
        .filter((candidate) => candidate.endsWith(".json"))
        .sort((a, b) => a.localeCompare(b))) {
        found.push(join(path, name));
      }
      continue;
    }
    found.push(...listFeatureOwnedSpecFiles(path));
  }
  return found;
}

export function defaultSpecLoopStatePath(appDir: string): string {
  return join(appDir, ".state", "spec-loop", "state.json");
}

export function loadSpecs(projectDir: string): SpecRecord[] {
  const index = readJson<SpecsIndex>(join(projectDir, "specs", "index.json"), {
    specFiles: [],
  });
  const indexedSpecFiles = (index.specFiles ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry.file))
    .filter((file): file is string => Boolean(file))
    .map((file) => ({
      file,
      absolutePath: join(projectDir, "specs", file),
    }));
  const specFiles =
    indexedSpecFiles.length > 0
      ? indexedSpecFiles
      : listFeatureOwnedSpecFiles(join(projectDir, "features")).map((path) => ({
          file: relative(projectDir, path),
          absolutePath: path,
        }));
  return specFiles
    .map(({ file, absolutePath }) => {
      const spec = readJson<SpecFile>(absolutePath, {});
      return {
        id: spec.id ?? file.replace(/\.json$/, ""),
        file,
        featurePathIds: Array.isArray(spec.featurePathIds)
          ? spec.featurePathIds.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        status: spec.status,
        specState: spec.specState,
        terminalDisposition: isTerminalSpecDisposition(spec),
      };
    })
    .filter((spec) => spec.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function devInfraCorePrioritySpecIds(projectDir: string): string[] {
  const selectors = selectorsFromFeatureSet(
    join(
      projectDir,
      ".github",
      "workflows",
      "feature-sets",
      "dev-infra-core.txt",
    ),
  );
  const specs = loadSpecs(projectDir);
  const byId = new Map(specs.map((spec) => [spec.id, spec]));
  const ordered: string[] = [];
  for (const selector of selectors) {
    if (selector.startsWith("spec.")) {
      if (byId.has(selector)) ordered.push(selector);
      continue;
    }
    if (selector.startsWith("path.")) {
      for (const spec of specs) {
        if (spec.featurePathIds.includes(selector)) ordered.push(spec.id);
      }
    }
  }
  return [...new Set(ordered)];
}

export function loadSpecLoopState(input: {
  appDir: string;
  projectDir: string;
  loopTaskId: string;
  windowSize: number;
  statePath?: string;
}): { state: SpecLoopState; path: string; created: boolean } {
  const path = input.statePath ?? defaultSpecLoopStatePath(input.appDir);
  const now = new Date().toISOString();
  if (existsSync(path)) {
    const specsById = new Map(
      loadSpecs(input.projectDir).map((spec) => [spec.id, spec]),
    );
    const state = readJson<SpecLoopState>(path, {
      loopTaskId: input.loopTaskId,
      windowSize: input.windowSize,
      cursor: 0,
      prioritySpecIds: [],
      specs: {},
    });
    state.loopTaskId ||= input.loopTaskId;
    state.windowSize ||= input.windowSize;
    state.prioritySpecIds ||= devInfraCorePrioritySpecIds(input.projectDir);
    state.specs ||= {};
    for (const spec of Object.values(state.specs)) {
      spec.taskId ??= null;
      if (String(spec.status) === "blocked") spec.status = "error";
      if (spec.status === "running" && !spec.taskId) spec.status = "pending";
    }
    for (const [specId, specState] of Object.entries(state.specs)) {
      const spec = specsById.get(specId);
      if (!spec?.terminalDisposition) continue;
      if (
        specState.status === "pass" ||
        specState.status === "done" ||
        specState.status === "pr_open"
      ) {
        continue;
      }
      specState.status = "done";
      specState.taskId = null;
      specState.activeAttemptId = null;
      specState.activeTaskSessionId = null;
      specState.activeWorkflowRunId = null;
      specState.heartbeatAt = null;
      specState.updatedAt = now;
    }
    return { state, path, created: false };
  }

  const prioritySpecIds = devInfraCorePrioritySpecIds(input.projectDir);
  const specs: Record<string, SpecLoopSpecState> = {};
  for (const spec of loadSpecs(input.projectDir)) {
    specs[spec.id] = {
      status: spec.terminalDisposition ? "done" : "pending",
      taskId: null,
      attempts: 0,
      lastRunId: null,
      lastRunUrl: null,
      lastResultPath: null,
      lastPrUrl: null,
      activeAttemptId: null,
      activeTaskSessionId: null,
      activeWorkflowRunId: null,
      heartbeatAt: null,
      updatedAt: now,
    };
  }
  const state: SpecLoopState = {
    loopTaskId: input.loopTaskId,
    windowSize: input.windowSize,
    cursor: 0,
    prioritySpecIds,
    specs,
  };
  writeJson(path, state);
  return { state, path, created: true };
}

export function saveSpecLoopState(path: string, state: SpecLoopState): void {
  writeJson(path, state);
}

export function orderedPendingSpecIds(state: SpecLoopState): string[] {
  const priority = state.prioritySpecIds.filter(
    (specId) => state.specs[specId]?.status === "pending",
  );
  const rest = Object.keys(state.specs)
    .filter(
      (specId) =>
        state.specs[specId]?.status === "pending" &&
        !state.prioritySpecIds.includes(specId),
    )
    .sort((a, b) => a.localeCompare(b));
  return [...priority, ...rest];
}

export function updateSpecLoopSpec(
  state: SpecLoopState,
  specId: string,
  patch: Partial<SpecLoopSpecState>,
): void {
  const previous = state.specs[specId] ?? {
    status: "pending",
    taskId: null,
    attempts: 0,
    lastRunId: null,
    lastRunUrl: null,
    lastResultPath: null,
    lastPrUrl: null,
    activeAttemptId: null,
    activeTaskSessionId: null,
    activeWorkflowRunId: null,
    heartbeatAt: null,
    updatedAt: new Date().toISOString(),
  };
  state.specs[specId] = {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export function bindKnownWorkflowRun(
  state: SpecLoopState,
  specId: string,
  input: {
    runId: string;
    runUrl?: string | null;
    taskId?: string | null;
    attemptId?: string | null;
    taskSessionId?: string | null;
    status?: SpecLoopSpecStatus;
    incrementAttempts?: boolean;
  },
): void {
  const previous = state.specs[specId];
  updateSpecLoopSpec(state, specId, {
    status: input.status ?? previous?.status ?? "running",
    taskId: input.taskId ?? previous?.taskId ?? null,
    attempts:
      (previous?.attempts ?? 0) + (input.incrementAttempts === false ? 0 : 1),
    lastRunUrl:
      input.runUrl !== undefined
        ? input.runUrl
        : (previous?.lastRunUrl ?? null),
    activeAttemptId: input.attemptId ?? previous?.activeAttemptId ?? null,
    activeTaskSessionId:
      input.taskSessionId ?? previous?.activeTaskSessionId ?? null,
    activeWorkflowRunId: input.runId,
    heartbeatAt: new Date().toISOString(),
  });
}

export function safeTaskIdForSpec(specId: string): string {
  return `verify-${specId}`
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

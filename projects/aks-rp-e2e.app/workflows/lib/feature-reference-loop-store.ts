import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

export type FeatureReferenceStatus =
  "pending" | "running" | "done" | "blocked" | "error" | "dormant" | "stale";

export type FeatureReferenceLoopHoldState = {
  mode: "dormant-backlog-preserved";
  staleFeatureKeys?: string[];
  dormantFeatureKeys?: string[];
  reopenDefaultFeatureKeys?: string[];
  noRefillNow?: boolean;
  note?: string | null;
  updatedAt?: string;
};

export type FeatureReferenceRecord = {
  featureKey: string;
  packetPath: string;
  packetKind: "capability" | "feature";
  layout:
    | "capability-root"
    | "branch-packet"
    | "legacy-branch-packet"
    | "migration-root-feature";
  capabilityId: string | null;
  coveredFeatureIds: string[];
};

export type FeatureReferenceItemState = FeatureReferenceRecord & {
  status: FeatureReferenceStatus;
  taskId?: string | null;
  attempts: number;
  lastOutputPath: string | null;
  lastSummary: string | null;
  updatedAt: string;
};

export type FeatureReferenceLoopState = {
  loopTaskId: string;
  windowSize: number;
  cursor: number;
  features: Record<string, FeatureReferenceItemState>;
  holdState?: FeatureReferenceLoopHoldState;
};

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function trimYamlScalar(value: string): string {
  return value
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function yamlScalar(raw: string, key: string): string {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? trimYamlScalar(match[1]) : "";
}

function yamlStringList(raw: string, key: string): string[] {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => line.match(new RegExp(`^${key}:`)));
  if (start < 0) return [];
  const first = lines[start].replace(new RegExp(`^${key}:\\s*`), "").trim();
  if (first.startsWith("[") && first.endsWith("]")) {
    return first.slice(1, -1).split(",").map(trimYamlScalar).filter(Boolean);
  }
  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const item = line.match(/^\s*-\s*(.+)$/);
    if (item) values.push(trimYamlScalar(item[1]));
  }
  return values;
}

function fileStem(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
}

function isSupportPacketPath(path: string): boolean {
  const stem = fileStem(path).toLowerCase();
  return (
    stem.includes("source-packet") ||
    stem.includes("source-investigation") ||
    stem.includes("investigation") ||
    stem.includes("fail-analysis")
  );
}

function safeKey(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "feature"
  );
}

function readPacketRecord(input: {
  projectDir: string;
  absolutePath: string;
  layout: FeatureReferenceRecord["layout"];
  fallbackCapabilityId?: string;
  allowFileStemFallback?: boolean;
}): FeatureReferenceRecord | null {
  if (isSupportPacketPath(input.absolutePath)) return null;
  const raw = readFileSync(input.absolutePath, "utf-8");
  const capabilityId =
    yamlScalar(raw, "capabilityId") || input.fallbackCapabilityId || "";
  const featureId = yamlScalar(raw, "featureId");
  const sourcePacketId = yamlScalar(raw, "sourcePacketId");
  const investigationId = yamlScalar(raw, "investigationId");
  if (sourcePacketId || investigationId) return null;
  const isBranchLayout =
    input.layout === "branch-packet" || input.layout === "legacy-branch-packet";
  if (isBranchLayout && !featureId) return null;
  const packetPath = relative(input.projectDir, input.absolutePath);
  const fallbackKey = input.allowFileStemFallback
    ? fileStem(input.absolutePath)
    : "";
  const rootFeatureKey = featureId || capabilityId || fallbackKey;
  if (!featureId && !capabilityId && !input.allowFileStemFallback) return null;
  const layout =
    input.layout === "capability-root" &&
    featureId &&
    !yamlScalar(raw, "capabilityId")
      ? "migration-root-feature"
      : input.layout;
  const resolvedFeatureKey = safeKey(rootFeatureKey);
  if (!resolvedFeatureKey) return null;
  return {
    featureKey: resolvedFeatureKey,
    packetPath,
    packetKind:
      layout === "capability-root" && capabilityId ? "capability" : "feature",
    layout,
    capabilityId: capabilityId || null,
    coveredFeatureIds: yamlStringList(raw, "coveredFeatureIds"),
  };
}

function packetRecordKey(record: FeatureReferenceRecord): string {
  return `${record.featureKey}\0${record.packetPath}`;
}

export function defaultFeatureReferenceLoopStatePath(appDir: string): string {
  return join(appDir, ".state", "feature-reference-loop", "state.json");
}

export function defaultFeatureReferenceDraftDir(projectDir: string): string {
  return join(projectDir, "evidence", "archive");
}

export function safeFeatureReferenceTaskId(featureKey: string): string {
  return safeKey(`collect-feature-reference-${featureKey}`);
}

export function safeFeatureReferenceFileKey(featureKey: string): string {
  return safeKey(featureKey);
}

export function loadFeatureReferencePackets(
  projectDir: string,
): FeatureReferenceRecord[] {
  const featuresDir = join(projectDir, "features");
  if (!existsSync(featuresDir)) return [];
  const records: FeatureReferenceRecord[] = [];

  for (const name of readdirSync(featuresDir)
    .filter((name) => name.endsWith(".yaml"))
    .sort((a, b) => a.localeCompare(b))) {
    const absolutePath = join(featuresDir, name);
    if (!statSync(absolutePath).isFile()) continue;
    const record = readPacketRecord({
      projectDir,
      absolutePath,
      layout: "capability-root",
      allowFileStemFallback: true,
    });
    if (record) records.push(record);
  }

  for (const capabilityDirName of readdirSync(featuresDir).sort((a, b) =>
    a.localeCompare(b),
  )) {
    const capabilityDir = join(featuresDir, capabilityDirName);
    if (!statSync(capabilityDir).isDirectory()) continue;

    const preferredPacketsDir = join(capabilityDir, "packets");
    if (existsSync(preferredPacketsDir)) {
      for (const name of readdirSync(preferredPacketsDir)
        .filter((entry) => entry.endsWith(".yaml"))
        .sort((a, b) => a.localeCompare(b))) {
        const absolutePath = join(preferredPacketsDir, name);
        if (!statSync(absolutePath).isFile()) continue;
        const record = readPacketRecord({
          projectDir,
          absolutePath,
          layout: "branch-packet",
          fallbackCapabilityId: capabilityDirName,
        });
        if (record) records.push(record);
      }
    }

    for (const name of readdirSync(capabilityDir)
      .filter((entry) => entry.endsWith(".yaml"))
      .sort((a, b) => a.localeCompare(b))) {
      const absolutePath = join(capabilityDir, name);
      if (!statSync(absolutePath).isFile()) continue;
      const record = readPacketRecord({
        projectDir,
        absolutePath,
        layout: "legacy-branch-packet",
        fallbackCapabilityId: capabilityDirName,
      });
      if (record) records.push(record);
    }
  }

  const unique = new Map<string, FeatureReferenceRecord>();
  for (const record of records) unique.set(packetRecordKey(record), record);
  return [...unique.values()].sort((a, b) =>
    a.featureKey.localeCompare(b.featureKey),
  );
}

function previousFeatureState(
  previous: Record<string, FeatureReferenceItemState>,
  record: FeatureReferenceRecord,
): FeatureReferenceItemState | undefined {
  return (
    previous[record.featureKey] ??
    Object.values(previous).find(
      (item) => item.packetPath === record.packetPath,
    )
  );
}

export function loadFeatureReferenceLoopState(input: {
  appDir: string;
  projectDir: string;
  loopTaskId: string;
  windowSize: number;
  statePath?: string;
}): { state: FeatureReferenceLoopState; path: string; created: boolean } {
  const path =
    input.statePath ?? defaultFeatureReferenceLoopStatePath(input.appDir);
  const now = new Date().toISOString();
  if (existsSync(path)) {
    const state = readJson<FeatureReferenceLoopState>(path, {
      loopTaskId: input.loopTaskId,
      windowSize: input.windowSize,
      cursor: 0,
      features: {},
    });
    state.loopTaskId ||= input.loopTaskId;
    state.windowSize ||= input.windowSize;
    const previous = state.features || {};
    const features: Record<string, FeatureReferenceItemState> = {};
    for (const record of loadFeatureReferencePackets(input.projectDir)) {
      const existing = previousFeatureState(previous, record);
      const existingTaskId = existing?.taskId ?? null;
      const existingStatus =
        existing?.status === "running" && !existingTaskId
          ? "pending"
          : (existing?.status ?? "pending");
      features[record.featureKey] = {
        ...record,
        status: existingStatus,
        taskId: existingTaskId,
        attempts: existing?.attempts ?? 0,
        lastOutputPath: existing?.lastOutputPath ?? null,
        lastSummary: existing?.lastSummary ?? null,
        updatedAt: now,
      };
    }
    state.features = features;
    return { state, path, created: false };
  }

  const features: Record<string, FeatureReferenceItemState> = {};
  for (const record of loadFeatureReferencePackets(input.projectDir)) {
    features[record.featureKey] = {
      ...record,
      status: "pending",
      taskId: null,
      attempts: 0,
      lastOutputPath: null,
      lastSummary: null,
      updatedAt: now,
    };
  }
  const state: FeatureReferenceLoopState = {
    loopTaskId: input.loopTaskId,
    windowSize: input.windowSize,
    cursor: 0,
    features,
  };
  writeJson(path, state);
  return { state, path, created: true };
}

export function saveFeatureReferenceLoopState(
  path: string,
  state: FeatureReferenceLoopState,
): void {
  writeJson(path, state);
}

export function orderedPendingFeatureKeys(
  state: FeatureReferenceLoopState,
): string[] {
  const dormant = new Set(state.holdState?.dormantFeatureKeys ?? []);
  const stale = new Set(state.holdState?.staleFeatureKeys ?? []);
  return Object.keys(state.features)
    .filter((featureKey) => state.features[featureKey]?.status === "pending")
    .filter((featureKey) => !dormant.has(featureKey) && !stale.has(featureKey))
    .sort((a, b) => a.localeCompare(b));
}

export function updateFeatureReferenceItem(
  state: FeatureReferenceLoopState,
  featureKey: string,
  patch: Partial<FeatureReferenceItemState>,
): void {
  const previous = state.features[featureKey] ?? {
    featureKey,
    packetPath: `features/${featureKey}.yaml`,
    packetKind: "feature" as const,
    layout: "migration-root-feature" as const,
    capabilityId: null,
    coveredFeatureIds: [],
    status: "pending" as const,
    taskId: null,
    attempts: 0,
    lastOutputPath: null,
    lastSummary: null,
    updatedAt: new Date().toISOString(),
  };
  state.features[featureKey] = {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

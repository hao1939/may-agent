import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

export type FeatureCompactStatus =
  "pending" | "running" | "done" | "blocked" | "error";

export type FeatureCompactRecord = {
  featureKey: string;
  capabilityId: string;
  packetPath: string | null;
  specsDir: string;
  specCount: number;
};

export type FeatureCompactItemState = FeatureCompactRecord & {
  status: FeatureCompactStatus;
  taskId?: string | null;
  attempts: number;
  lastPlanPath: string | null;
  lastSummaryPath: string | null;
  lastDiagnosticsPath: string | null;
  lastResultPath: string | null;
  lastWorkflowRunId: string | null;
  lastWorkflowRunUrl: string | null;
  lastWorkflowLoopKey: string | null;
  lastDispatchMetadataPath: string | null;
  lastLiveProofVersion: string | null;
  lastSummary: string | null;
  updatedAt: string;
};

export type FeatureCompactLoopState = {
  loopTaskId: string;
  windowSize: number;
  cursor: number;
  features: Record<string, FeatureCompactItemState>;
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

function safeKey(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "feature"
  );
}

function countJsonSpecs(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((name) => name.endsWith(".json")).length;
}

function normalizeStatus(value: unknown): FeatureCompactStatus {
  if (
    value === "pending" ||
    value === "running" ||
    value === "done" ||
    value === "error"
  ) {
    return value;
  }
  if (value === "blocked") return "error";
  if (value === "ready" || value === "partial") return "pending";
  return "pending";
}

function normalizeExistingItem(
  item: FeatureCompactItemState | undefined,
): FeatureCompactItemState | undefined {
  if (!item) return undefined;
  return {
    ...item,
    status: normalizeStatus(item.status),
    lastWorkflowRunId: item.lastWorkflowRunId ?? null,
    lastWorkflowRunUrl: item.lastWorkflowRunUrl ?? null,
    lastWorkflowLoopKey:
      (item as FeatureCompactItemState).lastWorkflowLoopKey ?? null,
    lastDispatchMetadataPath:
      (item as FeatureCompactItemState).lastDispatchMetadataPath ?? null,
    lastLiveProofVersion:
      (item as FeatureCompactItemState).lastLiveProofVersion ?? null,
    taskId: (item as FeatureCompactItemState).taskId ?? null,
  };
}

function hasDurableLiveProof(
  item: FeatureCompactItemState | undefined,
): boolean {
  return Boolean(
    item?.status === "done" &&
    item.lastWorkflowRunId &&
    item.lastLiveProofVersion,
  );
}

export function defaultFeatureCompactLoopStatePath(appDir: string): string {
  return join(appDir, ".state", "feature-compact-loop", "state.json");
}

export function safeFeatureCompactTaskId(featureKey: string): string {
  return safeKey(`compact-feature-${featureKey}`);
}

export function loadFeatureCompactRecords(
  projectDir: string,
): FeatureCompactRecord[] {
  const featuresDir = join(projectDir, "features");
  if (!existsSync(featuresDir)) return [];
  const records: FeatureCompactRecord[] = [];

  for (const capabilityId of readdirSync(featuresDir).sort((a, b) =>
    a.localeCompare(b),
  )) {
    const capabilityDir = join(featuresDir, capabilityId);
    if (!statSync(capabilityDir).isDirectory()) continue;
    const specsDir = join(capabilityDir, "specs");
    const specCount = countJsonSpecs(specsDir);
    if (specCount <= 0) continue;
    const packetPath = join(featuresDir, `${capabilityId}.yaml`);
    records.push({
      featureKey: safeKey(capabilityId),
      capabilityId,
      packetPath: existsSync(packetPath)
        ? relative(projectDir, packetPath).replace(/\\/g, "/")
        : null,
      specsDir: relative(projectDir, specsDir).replace(/\\/g, "/"),
      specCount,
    });
  }

  return records;
}

function previousFeatureState(
  previous: Record<string, FeatureCompactItemState>,
  record: FeatureCompactRecord,
): FeatureCompactItemState | undefined {
  return (
    previous[record.featureKey] ??
    Object.values(previous).find(
      (item) => item.capabilityId === record.capabilityId,
    )
  );
}

export function loadFeatureCompactLoopState(input: {
  appDir: string;
  projectDir: string;
  loopTaskId: string;
  windowSize: number;
  statePath?: string;
  featureKeys?: string[];
  refreshFromProject?: boolean;
}): { state: FeatureCompactLoopState; path: string; created: boolean } {
  const path =
    input.statePath ?? defaultFeatureCompactLoopStatePath(input.appDir);
  const now = new Date().toISOString();
  const previous = existsSync(path)
    ? readJson<FeatureCompactLoopState>(path, {
        loopTaskId: input.loopTaskId,
        windowSize: input.windowSize,
        cursor: 0,
        features: {},
      })
    : null;
  if (previous && input.refreshFromProject === false) {
    previous.loopTaskId ||= input.loopTaskId;
    previous.windowSize ||= input.windowSize;
    previous.features ||= {};
    for (const [featureKey, item] of Object.entries(previous.features)) {
      const normalized = normalizeExistingItem(item);
      if (normalized) previous.features[featureKey] = normalized;
    }
    return { state: previous, path, created: false };
  }

  const scopedFeatureKeys = new Set(
    (input.featureKeys ?? []).map(safeKey).filter(Boolean),
  );
  const records = loadFeatureCompactRecords(input.projectDir).filter(
    (record) =>
      scopedFeatureKeys.size === 0 || scopedFeatureKeys.has(record.featureKey),
  );
  const features: Record<string, FeatureCompactItemState> = {};
  for (const record of records) {
    const existing = normalizeExistingItem(
      previous
        ? previousFeatureState(previous.features || {}, record)
        : undefined,
    );
    features[record.featureKey] = {
      ...record,
      status: normalizeStatus(existing?.status),
      taskId: existing?.taskId ?? null,
      attempts: existing?.attempts ?? 0,
      lastPlanPath: existing?.lastPlanPath ?? null,
      lastSummaryPath: existing?.lastSummaryPath ?? null,
      lastDiagnosticsPath: existing?.lastDiagnosticsPath ?? null,
      lastResultPath: existing?.lastResultPath ?? null,
      lastWorkflowRunId: existing?.lastWorkflowRunId ?? null,
      lastWorkflowRunUrl: existing?.lastWorkflowRunUrl ?? null,
      lastWorkflowLoopKey: existing?.lastWorkflowLoopKey ?? null,
      lastDispatchMetadataPath: existing?.lastDispatchMetadataPath ?? null,
      lastLiveProofVersion: existing?.lastLiveProofVersion ?? null,
      lastSummary: existing?.lastSummary ?? null,
      updatedAt: existing?.updatedAt ?? now,
    };
  }

  const state: FeatureCompactLoopState = {
    loopTaskId: previous?.loopTaskId || input.loopTaskId,
    windowSize: previous?.windowSize || input.windowSize,
    cursor: previous?.cursor || 0,
    features,
  };
  if (!previous) writeJson(path, state);
  return { state, path, created: !previous };
}

export function saveFeatureCompactLoopState(
  path: string,
  state: FeatureCompactLoopState,
): void {
  const latest = existsSync(path)
    ? readJson<FeatureCompactLoopState | null>(path, null)
    : null;
  if (!latest?.features) {
    writeJson(path, state);
    return;
  }

  const merged: FeatureCompactLoopState = {
    ...latest,
    loopTaskId: state.loopTaskId || latest.loopTaskId,
    windowSize: state.windowSize || latest.windowSize,
    cursor: state.cursor ?? latest.cursor,
    features: { ...latest.features },
  };

  for (const [featureKey, item] of Object.entries(state.features ?? {})) {
    const previous = merged.features[featureKey];
    const itemTime = Date.parse(item.updatedAt || "");
    const previousTime = Date.parse(previous?.updatedAt || "");
    if (hasDurableLiveProof(previous) && !hasDurableLiveProof(item)) {
      continue;
    }
    if (
      !previous ||
      !Number.isFinite(previousTime) ||
      (Number.isFinite(itemTime) && itemTime >= previousTime)
    ) {
      merged.features[featureKey] = item;
    }
  }

  writeJson(path, merged);
}

export function orderedPendingFeatureCompactKeys(
  state: FeatureCompactLoopState,
): string[] {
  return Object.keys(state.features)
    .filter((featureKey) =>
      ["pending", "error"].includes(String(state.features[featureKey]?.status)),
    )
    .sort((a, b) => a.localeCompare(b));
}

export function updateFeatureCompactItem(
  state: FeatureCompactLoopState,
  featureKey: string,
  patch: Partial<FeatureCompactItemState>,
): void {
  const previous = state.features[featureKey] ?? {
    featureKey,
    capabilityId: featureKey,
    packetPath: `features/${featureKey}.yaml`,
    specsDir: `features/${featureKey}/specs`,
    specCount: 0,
    status: "pending" as const,
    taskId: null,
    attempts: 0,
    lastPlanPath: null,
    lastSummaryPath: null,
    lastDiagnosticsPath: null,
    lastResultPath: null,
    lastWorkflowRunId: null,
    lastWorkflowRunUrl: null,
    lastWorkflowLoopKey: null,
    lastDispatchMetadataPath: null,
    lastLiveProofVersion: null,
    lastSummary: null,
    updatedAt: new Date().toISOString(),
  };
  const normalizedPatch = { ...patch };
  if (
    normalizedPatch.status &&
    normalizedPatch.status !== "done" &&
    normalizedPatch.lastLiveProofVersion === undefined
  ) {
    normalizedPatch.lastLiveProofVersion = null;
  }
  state.features[featureKey] = {
    ...previous,
    ...normalizedPatch,
    updatedAt: new Date().toISOString(),
  };
}

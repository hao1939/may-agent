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
  "pending" | "running" | "ready" | "partial" | "blocked" | "error";

export type FeatureCompactRecord = {
  featureKey: string;
  capabilityId: string;
  packetPath: string | null;
  specsDir: string;
  specCount: number;
};

export type FeatureCompactItemState = FeatureCompactRecord & {
  status: FeatureCompactStatus;
  attempts: number;
  lastPlanPath: string | null;
  lastSummaryPath: string | null;
  lastDiagnosticsPath: string | null;
  lastResultPath: string | null;
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
    const existing = previous
      ? previousFeatureState(previous.features || {}, record)
      : undefined;
    features[record.featureKey] = {
      ...record,
      status: existing?.status ?? "pending",
      attempts: existing?.attempts ?? 0,
      lastPlanPath: existing?.lastPlanPath ?? null,
      lastSummaryPath: existing?.lastSummaryPath ?? null,
      lastDiagnosticsPath: existing?.lastDiagnosticsPath ?? null,
      lastResultPath: existing?.lastResultPath ?? null,
      lastSummary: existing?.lastSummary ?? null,
      updatedAt: now,
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
  writeJson(path, state);
}

export function orderedPendingFeatureCompactKeys(
  state: FeatureCompactLoopState,
): string[] {
  return Object.keys(state.features)
    .filter((featureKey) => state.features[featureKey]?.status === "pending")
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
    attempts: 0,
    lastPlanPath: null,
    lastSummaryPath: null,
    lastDiagnosticsPath: null,
    lastResultPath: null,
    lastSummary: null,
    updatedAt: new Date().toISOString(),
  };
  state.features[featureKey] = {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

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
  errorClass?: string | null;
  retryable?: boolean | null;
  retryReason?: string | null;
  taskId?: string | null;
  frontierTaskIds?: string[] | null;
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
  activeAttemptId?: string | null;
  activeTaskSessionId?: string | null;
  activeWorkflowRunId?: string | null;
  heartbeatAt?: string | null;
  lastSummary: string | null;
  rootCauseClassification?: string | null;
  inputFingerprint?: string | null;
  errorFingerprint?: string | null;
  ownerReason?: string | null;
  attemptedFixes?: string[] | null;
  nextStepClassification?: string | null;
  resumeCondition?: string | null;
  blockedAt?: string | null;
  blockedReason?: string | null;
  waitingFor?: Record<string, unknown> | null;
  waitingCondition?: string | null;
  observedBy?: Record<string, unknown> | null;
  observationMethod?: string | null;
  nextCheckAt?: string | null;
  blockerOwner?: string | null;
  fallbackAt?: string | null;
  fallbackAction?: string | null;
  resumeAction?: string | null;
  blockedScope?: { kind: string; ids: string[] } | null;
  blockedFingerprint?: Record<string, string> | null;
  lastCheckedAt?: string | null;
  evidencePaths?: string[] | null;
  reviewEvidencePath?: string | null;
  verificationBlocker?: string | null;
  summary?: string | null;
  updatedAt: string;
};

export type FeatureCompactLoopState = {
  loopTaskId: string;
  windowSize: number;
  cursor: number;
  features: Record<string, FeatureCompactItemState>;
  updatedAt?: string;
  updated_at?: string;
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

function normalizeSpecStatus(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, "-")
    : "";
}

function shouldCountFeatureOwnedSpec(specPath: string): boolean {
  try {
    const body = JSON.parse(readFileSync(specPath, "utf-8")) as {
      status?: unknown;
      specState?: unknown;
      supersededBy?: unknown;
      relatedSpecs?: {
        canonicalProductPath?: {
          relationship?: unknown;
          id?: unknown;
        };
      };
    };
    const status = normalizeSpecStatus(body.status);
    const specState = normalizeSpecStatus(body.specState);
    const isSuperseded = status === "superseded" || specState === "superseded";
    if (!isSuperseded) return true;

    const canonicalProductPath = body.relatedSpecs?.canonicalProductPath;
    if (
      canonicalProductPath &&
      normalizeSpecStatus(canonicalProductPath.relationship) ===
        "canonical-product-path" &&
      typeof canonicalProductPath.id === "string" &&
      canonicalProductPath.id.trim()
    ) {
      return false;
    }

    const featureId = specPath.split("/").slice(-3, -2)[0] ?? "";
    const supersededBy =
      typeof body.supersededBy === "string"
        ? body.supersededBy
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    if (supersededBy.length === 0 || !featureId) return true;

    const crossFeatureSuperseded = supersededBy.every(
      (ref) => !ref.startsWith(`spec.${featureId}.`),
    );
    return !crossFeatureSuperseded;
  } catch {
    return true;
  }
}

function countJsonSpecs(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .filter((name) => shouldCountFeatureOwnedSpec(join(dir, name))).length;
}

function normalizeStatus(value: unknown): FeatureCompactStatus {
  if (
    value === "pending" ||
    value === "running" ||
    value === "done" ||
    value === "blocked" ||
    value === "error"
  ) {
    return value;
  }
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
    errorClass: (item as FeatureCompactItemState).errorClass ?? null,
    lastWorkflowRunId: item.lastWorkflowRunId ?? null,
    lastWorkflowRunUrl: item.lastWorkflowRunUrl ?? null,
    lastWorkflowLoopKey:
      (item as FeatureCompactItemState).lastWorkflowLoopKey ?? null,
    lastDispatchMetadataPath:
      (item as FeatureCompactItemState).lastDispatchMetadataPath ?? null,
    lastLiveProofVersion:
      (item as FeatureCompactItemState).lastLiveProofVersion ?? null,
    activeAttemptId: (item as FeatureCompactItemState).activeAttemptId ?? null,
    activeTaskSessionId:
      (item as FeatureCompactItemState).activeTaskSessionId ?? null,
    activeWorkflowRunId:
      (item as FeatureCompactItemState).activeWorkflowRunId ?? null,
    heartbeatAt: (item as FeatureCompactItemState).heartbeatAt ?? null,
    retryable:
      (item as FeatureCompactItemState).retryable === false ? false : true,
    retryReason: (item as FeatureCompactItemState).retryReason ?? null,
    taskId: (item as FeatureCompactItemState).taskId ?? null,
    frontierTaskIds: (item as FeatureCompactItemState).frontierTaskIds ?? null,
    rootCauseClassification:
      (item as FeatureCompactItemState).rootCauseClassification ?? null,
    inputFingerprint:
      (item as FeatureCompactItemState).inputFingerprint ?? null,
    errorFingerprint:
      (item as FeatureCompactItemState).errorFingerprint ?? null,
    ownerReason: (item as FeatureCompactItemState).ownerReason ?? null,
    attemptedFixes: (item as FeatureCompactItemState).attemptedFixes ?? null,
    nextStepClassification:
      (item as FeatureCompactItemState).nextStepClassification ?? null,
    resumeCondition: (item as FeatureCompactItemState).resumeCondition ?? null,
    blockedAt: (item as FeatureCompactItemState).blockedAt ?? null,
    blockedReason: (item as FeatureCompactItemState).blockedReason ?? null,
    waitingFor: (item as FeatureCompactItemState).waitingFor ?? null,
    waitingCondition:
      (item as FeatureCompactItemState).waitingCondition ?? null,
    observedBy: (item as FeatureCompactItemState).observedBy ?? null,
    observationMethod:
      (item as FeatureCompactItemState).observationMethod ?? null,
    nextCheckAt: (item as FeatureCompactItemState).nextCheckAt ?? null,
    blockerOwner: (item as FeatureCompactItemState).blockerOwner ?? null,
    fallbackAt: (item as FeatureCompactItemState).fallbackAt ?? null,
    fallbackAction: (item as FeatureCompactItemState).fallbackAction ?? null,
    resumeAction: (item as FeatureCompactItemState).resumeAction ?? null,
    blockedScope: (item as FeatureCompactItemState).blockedScope ?? null,
    blockedFingerprint:
      (item as FeatureCompactItemState).blockedFingerprint ?? null,
    lastCheckedAt: (item as FeatureCompactItemState).lastCheckedAt ?? null,
    evidencePaths: (item as FeatureCompactItemState).evidencePaths ?? null,
    reviewEvidencePath:
      (item as FeatureCompactItemState).reviewEvidencePath ?? null,
    verificationBlocker:
      (item as FeatureCompactItemState).verificationBlocker ?? null,
    summary: (item as FeatureCompactItemState).summary ?? null,
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
      errorClass: existing?.errorClass ?? null,
      retryable: existing?.retryable === false ? false : true,
      retryReason: existing?.retryReason ?? null,
      taskId: existing?.taskId ?? null,
      frontierTaskIds: existing?.frontierTaskIds ?? null,
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
      activeAttemptId: existing?.activeAttemptId ?? null,
      activeTaskSessionId: existing?.activeTaskSessionId ?? null,
      activeWorkflowRunId: existing?.activeWorkflowRunId ?? null,
      heartbeatAt: existing?.heartbeatAt ?? null,
      lastSummary: existing?.lastSummary ?? null,
      rootCauseClassification: existing?.rootCauseClassification ?? null,
      ownerReason: existing?.ownerReason ?? null,
      attemptedFixes: existing?.attemptedFixes ?? null,
      nextStepClassification: existing?.nextStepClassification ?? null,
      resumeCondition: existing?.resumeCondition ?? null,
      blockedAt: existing?.blockedAt ?? null,
      blockedReason: existing?.blockedReason ?? null,
      waitingFor: existing?.waitingFor ?? null,
      waitingCondition: existing?.waitingCondition ?? null,
      observedBy: existing?.observedBy ?? null,
      observationMethod: existing?.observationMethod ?? null,
      nextCheckAt: existing?.nextCheckAt ?? null,
      blockerOwner: existing?.blockerOwner ?? null,
      fallbackAt: existing?.fallbackAt ?? null,
      fallbackAction: existing?.fallbackAction ?? null,
      resumeAction: existing?.resumeAction ?? null,
      blockedScope: existing?.blockedScope ?? null,
      blockedFingerprint: existing?.blockedFingerprint ?? null,
      lastCheckedAt: existing?.lastCheckedAt ?? null,
      evidencePaths: existing?.evidencePaths ?? null,
      reviewEvidencePath: existing?.reviewEvidencePath ?? null,
      verificationBlocker: existing?.verificationBlocker ?? null,
      summary: existing?.summary ?? null,
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
    const now = new Date().toISOString();
    writeJson(path, { ...state, updatedAt: now, updated_at: now });
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

  const now = new Date().toISOString();
  merged.updatedAt = now;
  merged.updated_at = now;
  writeJson(path, merged);
}

export function orderedPendingFeatureCompactKeys(
  state: FeatureCompactLoopState,
): string[] {
  return Object.keys(state.features)
    .filter((featureKey) => {
      const feature = state.features[featureKey];
      if (feature?.status === "pending") return true;
      return feature?.status === "error" && feature.retryable !== false;
    })
    .sort((a, b) => a.localeCompare(b));
}

export function updateFeatureCompactItem(
  state: FeatureCompactLoopState,
  featureKey: string,
  patch: Partial<FeatureCompactItemState>,
): void {
  const now = new Date().toISOString();
  const previous = state.features[featureKey] ?? {
    featureKey,
    capabilityId: featureKey,
    packetPath: `features/${featureKey}.yaml`,
    specsDir: `features/${featureKey}/specs`,
    specCount: 0,
    status: "pending" as const,
    errorClass: null,
    retryable: true,
    retryReason: null,
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
    activeAttemptId: null,
    activeTaskSessionId: null,
    activeWorkflowRunId: null,
    heartbeatAt: null,
    lastSummary: null,
    inputFingerprint: null,
    errorFingerprint: null,
    updatedAt: now,
  };
  const normalizedPatch = { ...patch };
  if (
    normalizedPatch.status === "pending" ||
    normalizedPatch.status === "running"
  ) {
    normalizedPatch.retryable ??= true;
    normalizedPatch.retryReason ??= null;
    normalizedPatch.blockedAt ??= null;
    normalizedPatch.blockedReason ??= null;
    normalizedPatch.waitingFor ??= null;
    normalizedPatch.waitingCondition ??= null;
    normalizedPatch.observedBy ??= null;
    normalizedPatch.observationMethod ??= null;
    normalizedPatch.nextCheckAt ??= null;
    normalizedPatch.blockerOwner ??= null;
    normalizedPatch.fallbackAt ??= null;
    normalizedPatch.fallbackAction ??= null;
    normalizedPatch.resumeAction ??= null;
    normalizedPatch.blockedScope ??= null;
    normalizedPatch.blockedFingerprint ??= null;
    normalizedPatch.lastCheckedAt ??= null;
  }
  if (normalizedPatch.status === "pending") {
    normalizedPatch.activeAttemptId ??= null;
    normalizedPatch.activeTaskSessionId ??= null;
    normalizedPatch.activeWorkflowRunId ??= null;
    normalizedPatch.heartbeatAt ??= null;
  }
  if (normalizedPatch.status === "running") {
    normalizedPatch.heartbeatAt ??= now;
  }
  if (
    normalizedPatch.status === "done" ||
    normalizedPatch.status === "blocked"
  ) {
    normalizedPatch.activeAttemptId ??= null;
    normalizedPatch.activeTaskSessionId ??= null;
    normalizedPatch.activeWorkflowRunId ??= null;
    normalizedPatch.heartbeatAt ??= null;
  }
  if (normalizedPatch.status === "blocked") {
    normalizedPatch.retryable ??= false;
    normalizedPatch.blockedAt ??= previous.blockedAt ?? now;
    normalizedPatch.lastCheckedAt ??= now;
  }
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
    updatedAt: now,
  };
}

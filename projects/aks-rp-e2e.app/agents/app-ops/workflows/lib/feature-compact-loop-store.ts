import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

export type FeatureCompactStatus =
  | "pending"
  | "running"
  | "done"
  | "blocked"
  | "error";

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
  lastSupportWorkFingerprint?: string | null;
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

const featureInputFingerprintVersion = "feature-input-v1";

function versionFeatureInputFingerprint(value: string): string {
  return `${featureInputFingerprintVersion}:${value}`;
}

function hasCurrentFeatureInputFingerprintVersion(
  value: string | null | undefined,
): boolean {
  return value?.startsWith(`${featureInputFingerprintVersion}:`) === true;
}

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

export type FeatureCompactProofContext = {
  appDir?: string;
  projectDir?: string;
  statePath?: string;
};

function resolveFeatureCompactProofContext(
  context: FeatureCompactProofContext = {},
): Required<Pick<FeatureCompactProofContext, "appDir" | "projectDir">> {
  let { appDir, projectDir } = context;
  const statePath = context.statePath;
  const rootDir = statePath ? dirname(dirname(dirname(statePath))) : undefined;

  if (!appDir && rootDir && basename(rootDir).endsWith(".app")) {
    appDir = rootDir;
  }
  if (!projectDir && rootDir && !basename(rootDir).endsWith(".app")) {
    projectDir = rootDir;
  }

  if (!projectDir && appDir && basename(appDir).endsWith(".app")) {
    projectDir = join(dirname(appDir), basename(appDir).slice(0, -4));
  }
  if (!appDir && projectDir) {
    appDir = join(dirname(projectDir), `${basename(projectDir)}.app`);
  }

  return {
    appDir: appDir ?? "",
    projectDir: projectDir ?? "",
  };
}

export function resolveExistingFeatureCompactResultPath(
  item: FeatureCompactItemState | undefined,
  context: FeatureCompactProofContext = {},
): string | null {
  const lastResultPath = item?.lastResultPath;
  if (typeof lastResultPath !== "string" || !lastResultPath.trim()) {
    return null;
  }
  if (isAbsolute(lastResultPath)) {
    return existsSync(lastResultPath) ? lastResultPath : null;
  }

  const { appDir, projectDir } = resolveFeatureCompactProofContext(context);
  for (const candidate of [
    appDir ? join(appDir, lastResultPath) : "",
    projectDir ? join(projectDir, lastResultPath) : "",
  ]) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function hasDurableLiveProof(
  item: FeatureCompactItemState | undefined,
  context: FeatureCompactProofContext = {},
): boolean {
  return missingDurableLiveProofFields(item, context).length === 0;
}

export function missingDurableLiveProofFields(
  item: FeatureCompactItemState | undefined,
  context: FeatureCompactProofContext = {},
): string[] {
  if (!item || item.status !== "done") return ["status"];
  return [
    !item.lastWorkflowRunId ? "lastWorkflowRunId" : "",
    !item.lastLiveProofVersion ? "lastLiveProofVersion" : "",
    !resolveExistingFeatureCompactResultPath(item, context)
      ? "lastResultPath"
      : "",
  ].filter(Boolean);
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

function featureInputPathspecs(record: FeatureCompactRecord): string[] {
  return [
    ...(record.packetPath ? [record.packetPath] : []),
    `features/${record.capabilityId}/packets`,
    `features/${record.capabilityId}/specs`,
    `features/${record.capabilityId}/tests`,
    `features/${record.capabilityId}/lib`,
    `features/${record.capabilityId}/compact/staging.plan.json`,
  ];
}

function collectFeatureSourceFiles(
  projectDir: string,
  record: FeatureCompactRecord,
): string[] {
  const files = new Set<string>();
  for (const relativePath of featureInputPathspecs(record)) {
    const fullPath = join(projectDir, relativePath);
    if (!existsSync(fullPath)) continue;
    const stats = statSync(fullPath);
    if (stats.isFile()) {
      files.add(fullPath);
      continue;
    }
    if (!stats.isDirectory()) continue;
    const stack = [fullPath];
    while (stack.length > 0) {
      const dir = stack.pop();
      if (!dir) continue;
      for (const entry of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
        const childPath = join(dir, entry);
        const childStats = statSync(childPath);
        if (childStats.isDirectory()) {
          stack.push(childPath);
          continue;
        }
        if (childStats.isFile()) files.add(childPath);
      }
    }
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

function gitFeatureInputFingerprint(
  projectDir: string,
  record: FeatureCompactRecord,
): string | null {
  try {
    execFileSync("git", ["rev-parse", "--verify", "origin/dev^{commit}"], {
      cwd: projectDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
    const listing = execFileSync(
      "git",
      ["ls-tree", "-rz", "origin/dev", "--", ...featureInputPathspecs(record)],
      {
        cwd: projectDir,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    if (!listing.length) return null;
    return versionFeatureInputFingerprint(
      createHash("sha256").update(listing).digest("hex"),
    );
  } catch {
    return null;
  }
}

function filesystemFeatureInputFingerprint(
  projectDir: string,
  record: FeatureCompactRecord,
): string | null {
  const hash = createHash("sha256");
  const orderedFiles = collectFeatureSourceFiles(projectDir, record);
  if (orderedFiles.length === 0) return null;
  for (const file of orderedFiles) {
    hash.update(relative(projectDir, file).replace(/\\/g, "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return versionFeatureInputFingerprint(hash.digest("hex"));
}

function featureInputFingerprint(
  projectDir: string,
  record: FeatureCompactRecord,
): string | null {
  return (
    gitFeatureInputFingerprint(projectDir, record) ??
    filesystemFeatureInputFingerprint(projectDir, record)
  );
}

function isSettledFeatureState(
  item: FeatureCompactItemState | undefined,
): boolean {
  if (!item) return false;
  if (item.status === "done" || item.status === "blocked") return true;
  return item.status === "error" && item.retryable === false;
}

type TaskTreeTask = Record<string, unknown>;

function nonterminalTaskPhase(value: unknown): boolean {
  const phase = typeof value === "string" ? value.trim().toLowerCase() : "";
  return !new Set(["closed", "converged", "done"]).has(phase);
}

function structuredRepresentationHolderIds(
  item: FeatureCompactItemState,
): string[] {
  const waitingFor = item.waitingFor ?? {};
  const waitingTaskId =
    typeof waitingFor.taskId === "string" ? waitingFor.taskId : null;
  const representedTaskIds = Array.isArray(waitingFor.representedTaskIds)
    ? waitingFor.representedTaskIds.filter(
        (taskId): taskId is string => typeof taskId === "string",
      )
    : [];
  return [
    item.taskId,
    ...(item.frontierTaskIds ?? []),
    waitingTaskId,
    ...representedTaskIds,
  ].filter((taskId): taskId is string => typeof taskId === "string");
}

function matchesFeatureCompactHolder(
  featureKey: string,
  taskId: string,
  task: TaskTreeTask | undefined,
): boolean {
  if (!task || !nonterminalTaskPhase(task.phase)) return false;
  const featureTaskId = safeKey(featureKey);
  const parentId =
    typeof task.parent_id === "string" ? task.parent_id.trim() : "";
  const input =
    typeof task.input === "object" && task.input
      ? (task.input as Record<string, unknown>)
      : {};
  const taskFeatureKey =
    typeof input.featureKey === "string" ? input.featureKey.trim() : "";
  if (taskFeatureKey && taskFeatureKey !== featureKey) return false;
  return (
    taskFeatureKey === featureKey ||
    taskId.startsWith(`hold-compact-${featureTaskId}`) ||
    taskId.startsWith(`wait-compact-${featureTaskId}`) ||
    taskId.startsWith(`compact/compact-feature-${featureTaskId}`) ||
    taskId.startsWith(
      `compact/repair-compact-feature-${featureTaskId}-representation-`,
    ) ||
    parentId.startsWith(`compact/compact-feature-${featureTaskId}`) ||
    parentId.startsWith(
      `compact/repair-compact-feature-${featureTaskId}-representation-`,
    )
  );
}

function featureCompactHolderRank(
  featureKey: string,
  taskId: string,
  task: TaskTreeTask | undefined,
): number {
  if (!matchesFeatureCompactHolder(featureKey, taskId, task)) return -1;
  const featureTaskId = safeKey(featureKey);
  const parentId =
    typeof task?.parent_id === "string" ? task.parent_id.trim() : "";
  const input =
    typeof task?.input === "object" && task.input
      ? (task.input as Record<string, unknown>)
      : {};
  const taskFeatureKey =
    typeof input.featureKey === "string" ? input.featureKey.trim() : "";
  const hasMatchingFeatureKey = taskFeatureKey === featureKey;

  if (hasMatchingFeatureKey && taskId.startsWith("hold-compact-")) return 500;
  if (taskId.startsWith(`hold-compact-${featureTaskId}`)) return 490;
  if (taskId.startsWith(`wait-compact-${featureTaskId}`)) return 450;
  if (
    hasMatchingFeatureKey &&
    taskId.startsWith(`compact/compact-feature-${featureTaskId}`)
  ) {
    return 400;
  }
  if (taskId.startsWith(`compact/compact-feature-${featureTaskId}`)) return 390;
  if (
    hasMatchingFeatureKey &&
    taskId.startsWith(
      `compact/repair-compact-feature-${featureTaskId}-representation-`,
    )
  ) {
    return 300;
  }
  if (
    taskId.startsWith(
      `compact/repair-compact-feature-${featureTaskId}-representation-`,
    )
  ) {
    return 290;
  }
  if (hasMatchingFeatureKey && parentId.startsWith("hold-compact-")) return 200;
  if (hasMatchingFeatureKey) return 100;
  return 0;
}

function discoverLiveFeatureCompactHolderId(
  featureKey: string,
  tasks: Record<string, TaskTreeTask>,
): string | null {
  const candidates = Object.entries(tasks)
    .map(([taskId, task]) => ({
      taskId,
      rank: featureCompactHolderRank(featureKey, taskId, task),
    }))
    .filter((candidate) => candidate.rank >= 0)
    .sort(
      (left, right) =>
        right.rank - left.rank || left.taskId.localeCompare(right.taskId),
    );
  return candidates[0]?.taskId ?? null;
}

function hasStructuredRepresentation(item: FeatureCompactItemState): boolean {
  return Boolean(
    item.taskId ||
    (item.frontierTaskIds?.length ?? 0) > 0 ||
    item.waitingFor ||
    item.waitingCondition ||
    item.resumeCondition,
  );
}

function isInputFingerprintDriftReopenState(
  item: FeatureCompactItemState | undefined,
): boolean {
  if (!item || item.status !== "pending" || hasStructuredRepresentation(item)) {
    return false;
  }
  return (
    item.retryable !== false &&
    item.retryReason?.startsWith(
      "Resume because current feature source inputs changed after reviewed fingerprint ",
    ) === true &&
    item.summary ===
      "Reopened because current feature source inputs materially changed after the previously reviewed compact fingerprint."
  );
}

/**
 * A blocked feature whose declared holder task IDs have all left the live task
 * tree is stranded: nothing can observe it, wake it, or converge it. The task
 * resource contract requires a waiting resource to have an exact Condition or a
 * live direct child, so a blocked row pointing only at retired task IDs is
 * unrepresented desired state rather than an accepted terminal disposition.
 */
function isStrandedBlockedRepresentation(
  item: FeatureCompactItemState | undefined,
  tasks: Record<string, TaskTreeTask>,
): boolean {
  if (!item || item.status !== "blocked") return false;
  const declared = structuredRepresentationHolderIds(item);
  if (declared.length === 0) return false;
  // Liveness is tree presence at a nonterminal phase. Holder naming is only a
  // discovery heuristic and must not decide whether a cited holder still exists.
  return !declared.some((taskId) => {
    const task = tasks[taskId];
    return Boolean(task) && nonterminalTaskPhase(task.phase);
  });
}

/**
 * Return a stranded blocked feature to dispatchable desired state so the shared
 * controller re-creates one live holder for it on the next pulse.
 */
function strandedBlockedReopenState(
  existing: FeatureCompactItemState,
  now: string,
): Partial<FeatureCompactItemState> {
  const retiredHolders = structuredRepresentationHolderIds(existing);
  return {
    status: "pending",
    retryable: true,
    retryReason: `Resume because every declared compact holder left the live task tree (${retiredHolders.join(", ")}).`,
    taskId: null,
    frontierTaskIds: null,
    waitingFor: null,
    waitingCondition: null,
    activeAttemptId: null,
    activeTaskSessionId: null,
    activeWorkflowRunId: null,
    heartbeatAt: null,
    lastSupportWorkFingerprint: null,
    blockedAt: null,
    blockedReason: null,
    blockedScope: null,
    blockedFingerprint: null,
    summary:
      "Reopened because the previously reviewed compact holder is no longer represented in the live task tree.",
    lastCheckedAt: now,
    updatedAt: now,
  };
}

function preservedLiveHolderReopenState(
  existing: FeatureCompactItemState,
  liveHolderId: string,
  now: string,
): Partial<FeatureCompactItemState> {
  return {
    status: "blocked",
    retryable: false,
    retryReason: existing.retryReason ?? null,
    taskId: liveHolderId,
    frontierTaskIds: [liveHolderId],
    activeAttemptId: null,
    activeTaskSessionId: null,
    activeWorkflowRunId: null,
    heartbeatAt: null,
    lastSupportWorkFingerprint: null,
    ownerReason: existing.ownerReason ?? null,
    attemptedFixes: existing.attemptedFixes ?? null,
    nextStepClassification: existing.nextStepClassification ?? null,
    resumeCondition: existing.resumeCondition ?? null,
    blockedAt: existing.blockedAt ?? now,
    blockedReason: existing.blockedReason ?? existing.summary ?? null,
    waitingFor: existing.waitingFor ?? null,
    waitingCondition: existing.waitingCondition ?? null,
    observedBy: existing.observedBy ?? null,
    observationMethod: existing.observationMethod ?? null,
    nextCheckAt: existing.nextCheckAt ?? null,
    blockerOwner: existing.blockerOwner ?? null,
    fallbackAt: existing.fallbackAt ?? null,
    fallbackAction: existing.fallbackAction ?? null,
    resumeAction: existing.resumeAction ?? null,
    blockedScope: existing.blockedScope ?? null,
    blockedFingerprint: existing.blockedFingerprint ?? null,
    lastCheckedAt: existing.lastCheckedAt ?? now,
    summary: existing.summary ?? existing.blockedReason ?? null,
    updatedAt: now,
  };
}

function invalidatedSettledFeatureState(
  existing: FeatureCompactItemState,
  currentFingerprint: string,
  now: string,
  taskViews?: Record<string, TaskTreeTask>,
): Partial<FeatureCompactItemState> {
  if (taskViews) {
    const tasks = taskViews;
    const liveHolderId =
      structuredRepresentationHolderIds(existing).find((taskId) =>
        matchesFeatureCompactHolder(existing.featureKey, taskId, tasks[taskId]),
      ) ?? discoverLiveFeatureCompactHolderId(existing.featureKey, tasks);
    if (liveHolderId) {
      return preservedLiveHolderReopenState(existing, liveHolderId, now);
    }
  }
  const priorFingerprint = existing.inputFingerprint?.slice(0, 12) ?? "unknown";
  return {
    status: "pending",
    retryable: true,
    retryReason: `Resume because current feature source inputs changed after reviewed fingerprint ${priorFingerprint}.`,
    taskId: null,
    frontierTaskIds: null,
    activeAttemptId: null,
    activeTaskSessionId: null,
    activeWorkflowRunId: null,
    heartbeatAt: null,
    lastSupportWorkFingerprint: null,
    ownerReason: `Current feature source fingerprint ${currentFingerprint.slice(0, 12)} materially changed after reviewed fingerprint ${priorFingerprint}.`,
    attemptedFixes: existing.attemptedFixes ?? null,
    nextStepClassification: null,
    resumeCondition: null,
    blockedAt: null,
    blockedReason: null,
    waitingFor: null,
    waitingCondition: null,
    observedBy: null,
    observationMethod: null,
    nextCheckAt: null,
    blockerOwner: null,
    fallbackAt: null,
    fallbackAction: null,
    resumeAction: null,
    blockedScope: null,
    blockedFingerprint: null,
    lastCheckedAt: null,
    summary: `Reopened because current feature source inputs materially changed after the previously reviewed compact fingerprint.`,
    updatedAt: now,
  };
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
  /** Bounded direct-child task views supplied by the host workflow context. */
  taskViews?: Record<string, TaskTreeTask>;
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
  const taskTreeTasks = input.taskViews ?? {};
  const features: Record<string, FeatureCompactItemState> = {};
  for (const record of records) {
    const existing = normalizeExistingItem(
      previous
        ? previousFeatureState(previous.features || {}, record)
        : undefined,
    );
    const currentInputFingerprint =
      featureInputFingerprint(input.projectDir, record) ??
      existing?.inputFingerprint ??
      null;
    const invalidatedSettledState =
      existing?.inputFingerprint &&
      hasCurrentFeatureInputFingerprintVersion(existing.inputFingerprint) &&
      currentInputFingerprint &&
      existing.inputFingerprint !== currentInputFingerprint &&
      isSettledFeatureState(existing)
        ? invalidatedSettledFeatureState(
            existing,
            currentInputFingerprint,
            now,
            taskTreeTasks,
          )
        : null;
    const reboundLiveHolderId = isInputFingerprintDriftReopenState(existing)
      ? discoverLiveFeatureCompactHolderId(record.featureKey, taskTreeTasks)
      : null;
    const reboundState =
      existing && reboundLiveHolderId
        ? preservedLiveHolderReopenState(existing, reboundLiveHolderId, now)
        : null;
    // A blocked row whose declared holders all left the live tree is stranded.
    // Rebind it to a surviving holder when one exists, otherwise return it to
    // pending so the shared controller can represent it again.
    const strandedHolderId = isStrandedBlockedRepresentation(
      existing,
      taskTreeTasks,
    )
      ? discoverLiveFeatureCompactHolderId(record.featureKey, taskTreeTasks)
      : null;
    const strandedState =
      existing && isStrandedBlockedRepresentation(existing, taskTreeTasks)
        ? strandedHolderId
          ? preservedLiveHolderReopenState(existing, strandedHolderId, now)
          : strandedBlockedReopenState(existing, now)
        : null;
    const effective = reboundState
      ? { ...existing, ...reboundState }
      : strandedState
        ? { ...existing, ...strandedState }
        : invalidatedSettledState
          ? { ...existing, ...invalidatedSettledState }
          : existing;
    features[record.featureKey] = {
      ...record,
      status: normalizeStatus(effective?.status),
      errorClass: effective?.errorClass ?? null,
      retryable: effective?.retryable === false ? false : true,
      retryReason: effective?.retryReason ?? null,
      taskId: effective?.taskId ?? null,
      frontierTaskIds: effective?.frontierTaskIds ?? null,
      attempts: effective?.attempts ?? 0,
      lastPlanPath: effective?.lastPlanPath ?? null,
      lastSummaryPath: effective?.lastSummaryPath ?? null,
      lastDiagnosticsPath: effective?.lastDiagnosticsPath ?? null,
      lastResultPath: effective?.lastResultPath ?? null,
      lastWorkflowRunId: effective?.lastWorkflowRunId ?? null,
      lastWorkflowRunUrl: effective?.lastWorkflowRunUrl ?? null,
      lastWorkflowLoopKey: effective?.lastWorkflowLoopKey ?? null,
      lastDispatchMetadataPath: effective?.lastDispatchMetadataPath ?? null,
      lastLiveProofVersion: effective?.lastLiveProofVersion ?? null,
      activeAttemptId: effective?.activeAttemptId ?? null,
      activeTaskSessionId: effective?.activeTaskSessionId ?? null,
      activeWorkflowRunId: effective?.activeWorkflowRunId ?? null,
      heartbeatAt: effective?.heartbeatAt ?? null,
      lastSummary: effective?.lastSummary ?? null,
      rootCauseClassification: effective?.rootCauseClassification ?? null,
      inputFingerprint: currentInputFingerprint,
      errorFingerprint: effective?.errorFingerprint ?? null,
      lastSupportWorkFingerprint: effective?.lastSupportWorkFingerprint ?? null,
      ownerReason: effective?.ownerReason ?? null,
      attemptedFixes: effective?.attemptedFixes ?? null,
      nextStepClassification: effective?.nextStepClassification ?? null,
      resumeCondition: effective?.resumeCondition ?? null,
      blockedAt: effective?.blockedAt ?? null,
      blockedReason: effective?.blockedReason ?? null,
      waitingFor: effective?.waitingFor ?? null,
      waitingCondition: effective?.waitingCondition ?? null,
      observedBy: effective?.observedBy ?? null,
      observationMethod: effective?.observationMethod ?? null,
      nextCheckAt: effective?.nextCheckAt ?? null,
      blockerOwner: effective?.blockerOwner ?? null,
      fallbackAt: effective?.fallbackAt ?? null,
      fallbackAction: effective?.fallbackAction ?? null,
      resumeAction: effective?.resumeAction ?? null,
      blockedScope: effective?.blockedScope ?? null,
      blockedFingerprint: effective?.blockedFingerprint ?? null,
      lastCheckedAt: effective?.lastCheckedAt ?? null,
      evidencePaths: effective?.evidencePaths ?? null,
      reviewEvidencePath: effective?.reviewEvidencePath ?? null,
      verificationBlocker: effective?.verificationBlocker ?? null,
      summary: effective?.summary ?? null,
      updatedAt: effective?.updatedAt ?? now,
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
  options: { pruneAbsentFeatureKeys?: boolean } = {},
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
    features: options.pruneAbsentFeatureKeys ? {} : { ...latest.features },
  };

  const proofContext = resolveFeatureCompactProofContext({ statePath: path });
  for (const [featureKey, item] of Object.entries(state.features ?? {})) {
    const previous = merged.features[featureKey];
    const itemTime = Date.parse(item.updatedAt || "");
    const previousTime = Date.parse(previous?.updatedAt || "");
    const preservesSameReviewedFingerprint =
      previous?.inputFingerprint === item.inputFingerprint;
    if (
      hasDurableLiveProof(previous, proofContext) &&
      !hasDurableLiveProof(item, proofContext) &&
      preservesSameReviewedFingerprint
    ) {
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

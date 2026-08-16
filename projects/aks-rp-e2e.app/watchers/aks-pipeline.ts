import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { AksObserverContext, AksObserverEvent } from "./context.js";

type PipelineWatcherState = {
  schemaVersion?: string;
  fingerprints?: Record<string, string>;
  localRunStates?: Record<string, string>;
  localCompletionFingerprints?: Record<string, string>;
  adoFingerprints?: Record<string, string>;
  trackedRunIds?: string[];
  observedArtifacts?: Record<string, string>;
  terminalArtifactAttempts?: Record<string, number>;
  terminalArtifactUnavailable?: Record<string, string>;
  overdueQueueRunIds?: string[];
  liveProgressFingerprints?: Record<string, string>;
  checkedAt?: string;
};

type PipelineResult = {
  runId?: unknown;
  planId?: unknown;
  target?: unknown;
  status?: unknown;
  counts?: unknown;
  specResults?: unknown;
  updatedAt?: unknown;
};

type LocalRunObservation = {
  path: string | null;
  status: string | null;
  endedAt: string | null;
  state: "active" | "terminal" | "unknown";
};

type ObservedResult = {
  runId: string;
  path: string;
  fingerprint: string;
  mtimeMs: number;
  result: PipelineResult;
  run: LocalRunObservation;
};

type AdoRun = {
  id?: unknown;
  status?: unknown;
  result?: unknown;
  sourceBranch?: unknown;
  sourceVersion?: unknown;
  finishTime?: unknown;
  queueTime?: unknown;
  templateParameters?: unknown;
};

export type AdoTimelineRecord = {
  id?: unknown;
  parentId?: unknown;
  type?: unknown;
  name?: unknown;
  state?: unknown;
  result?: unknown;
  currentOperation?: unknown;
  startTime?: unknown;
  finishTime?: unknown;
  changeId?: unknown;
  details?: unknown;
  pipelineRunId?: unknown;
  sliceId?: unknown;
};

export type TimelineSpecProgress = {
  runId: string;
  sliceId: string;
  testRunId: string;
  specId: string;
  sequence: number;
  executionState: "queued" | "running" | "completed";
  verdict: "unknown" | "pass" | "fail" | "error" | "skipped";
  phase: string;
  phaseDetail: string;
  message: string;
  updatedAt: string;
  elapsedSeconds: number;
  timingSource?: "payload" | "provider-record";
  category: string;
};

export type TimelineSliceProgress = {
  sliceId: string;
  executionState: "queued" | "running" | "completed";
};

export type ObservedAdoRun = {
  runId: string;
  fingerprint: string;
  status: string;
  result: string;
  sourceBranch: string | null;
  sourceVersion: string | null;
  finishTime: string | null;
  queueTime: string | null;
  artifacts: string[];
  progressive?: boolean;
  artifactObservable?: boolean;
  specRun?: boolean;
  metadataTaskId?: string | null;
  metadataGeneration?: string | null;
};

export type PipelineFailureObservation = {
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  artifactName: string;
  artifactPath: string;
  sliceId: string;
  specId: string;
  status: string;
  category: string;
  reason: string;
  fingerprint: string;
};

export type PipelineSpecObservation = {
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  artifactName: string;
  artifactPath: string;
  sliceId: string;
  specId: string;
  status: string;
  category: string;
  reason: string;
};

export type NodeImagePublicationObservation = {
  project: string;
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  artifactName: string;
  artifactPath: string;
  sliceId: string;
  specId: string;
  targetName: string;
  location: string;
  subscriptionId: string;
  imageFamily: string;
  channel: string;
  publishedVersion: string;
  currentNodeImageVersion: string;
  publishedVersions: string[];
};

export const nodeImagePublicationEventType = "aks.node-image-publication.state";

export type MasterValidationProgress = {
  schemaVersion: "1";
  runId: string;
  sourceBranch: string | null;
  sourceCommit: string | null;
  state: string;
  result: string;
  queueTime: string | null;
  checkedAt: string;
  counts: {
    selected: number;
    observed: number;
    pending: number;
    queued: number;
    running: number;
    pass: number;
    fail: number;
    error: number;
    skipped: number;
    excluded: number;
    other: number;
  };
  slices: Array<{
    sliceId: string;
    selected: number;
    observed: number;
    status:
      "pending" | "queued" | "running" | "draining" | "partial" | "completed";
  }>;
  specs: Array<{
    sliceId: string;
    specId: string;
    status: string;
    category: string;
    reason: string;
    executionState?: string;
    phase?: string;
    phaseDetail?: string;
    updatedAt?: string;
    elapsedSeconds?: number;
    stale?: boolean;
    artifactPath?: string;
  }>;
};

type PreservedSpecVerdict = {
  status: "pass" | "fail" | "error" | "skipped";
  category: string;
  reason: string;
  artifactPath?: string;
};

const MAX_RESULTS_PER_SCAN = 200;
const MAX_EVENTS_PER_SCAN = 20;
const MAX_ADO_RUNS_PER_SCAN = 100;
const MAX_PROGRESS_ARTIFACTS_PER_SCAN = 3;
const MAX_PROGRESS_TIMELINE_DETAILS_PER_RUN = 12;
export const MAX_TASK_ARTIFACT_RUNS_PER_SCAN = 12;
export const MAX_TRACKED_RUN_IDS = 25;
export const MAX_TERMINAL_ARTIFACT_ATTEMPTS = 3;
export const MASTER_VALIDATION_QUEUE_OVERDUE_MS = 90 * 60 * 1_000;
const ADO_ORGANIZATION = "https://dev.azure.com/msazure";
const ADO_PROJECT = "CloudNativeCompute";
const ADO_PIPELINE_ID = "467665";
const WATCHER_SCHEMA_VERSION = "10";
const WATCHER_REGISTRATION_SCHEMA_VERSION = "1";
export const LIVE_PROGRESS_STALE_MS = 3 * 60 * 1_000;
const AZ_CLI =
  process.env.AZURE_CLI_PATH ||
  (existsSync("/app/.state/.local/bin/az")
    ? "/app/.state/.local/bin/az"
    : "az");

function readState(path: string): PipelineWatcherState {
  if (!existsSync(path)) return {};
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveState(path: string, state: PipelineWatcherState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

type PipelineWatcherRegistrationState = {
  schemaVersion?: string;
  runIds?: string[];
  updatedAt?: string;
};

function registrationStatePath(appDir: string): string {
  return join(appDir, ".state/watchers/aks-pipeline-registrations.json");
}

function readRegistrationState(
  appDir: string,
): PipelineWatcherRegistrationState {
  const path = registrationStatePath(appDir);
  if (!existsSync(path)) return {};
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function registeredTrackedRunIds(appDir: string): string[] {
  return boundedTrackedRunIds(
    readRegistrationState(appDir).runIds ?? [],
    MAX_TRACKED_RUN_IDS,
  );
}

export function registerTrackedPipelineRunIds(
  appDir: string,
  runIds: string[],
): { changed: boolean; runIds: string[]; path: string } {
  const nextRunIds = boundedTrackedRunIds(runIds, 100);
  const path = registrationStatePath(appDir);
  const priorRunIds = registeredTrackedRunIds(appDir);
  const changed = stableJson(priorRunIds) !== stableJson(nextRunIds);
  if (changed || !existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      `${JSON.stringify(
        {
          schemaVersion: WATCHER_REGISTRATION_SCHEMA_VERSION,
          runIds: nextRunIds,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  return { changed, runIds: nextRunIds, path };
}

export function appendTrackedPipelineRunIds(
  appDir: string,
  runIds: string[],
): { changed: boolean; runIds: string[]; path: string } {
  return registerTrackedPipelineRunIds(appDir, [
    ...registeredTrackedRunIds(appDir),
    ...runIds,
  ]);
}

export function appendTrackedPipelineRunId(
  appDir: string,
  runId: string,
): { changed: boolean; runIds: string[]; path: string } {
  return appendTrackedPipelineRunIds(appDir, [runId]);
}

export function acknowledgeTrackedPipelineRunIds(
  appDir: string,
  observedRunIds: string[],
): { changed: boolean; runIds: string[]; path: string } {
  const observed = new Set(observedRunIds);
  return registerTrackedPipelineRunIds(
    appDir,
    registeredTrackedRunIds(appDir).filter((runId) => !observed.has(runId)),
  );
}

function observeLocalRun(path: string): LocalRunObservation {
  const runPath = join(dirname(path), "run.json");
  if (!existsSync(runPath)) {
    return {
      path: null,
      status: null,
      endedAt: null,
      state: "unknown",
    };
  }
  try {
    const run = record(JSON.parse(readFileSync(runPath, "utf8")));
    const status = text(run.status) || null;
    const endedAt = text(run.endedAt) || null;
    const terminal =
      Boolean(endedAt) || (status !== null && status !== "running");
    return {
      path: runPath,
      status,
      endedAt,
      state: terminal
        ? "terminal"
        : status === "running"
          ? "active"
          : "unknown",
    };
  } catch {
    return {
      path: runPath,
      status: null,
      endedAt: null,
      state: "unknown",
    };
  }
}

function observeResult(path: string): ObservedResult | null {
  try {
    const content = readFileSync(path);
    const result = JSON.parse(content.toString("utf8")) as PipelineResult;
    const runId = String(
      result.runId ?? dirname(path).split("/").at(-1) ?? "",
    ).trim();
    if (!runId) return null;
    return {
      runId,
      path,
      fingerprint: createHash("sha256").update(content).digest("hex"),
      mtimeMs: statSync(path).mtimeMs,
      result,
      run: observeLocalRun(path),
    };
  } catch {
    return null;
  }
}

function localResultReadyForCompletion(observed: ObservedResult): boolean {
  return observed.run.state !== "active";
}

function localResultCompletionEvent(
  observed: ObservedResult,
): AksObserverEvent {
  const status = String(observed.result.status ?? "unknown");
  const base = pipelineFactBase({
    runId: observed.runId,
    status,
    result: status,
  });
  return {
    type: "project.test_run.completed",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...base,
    data: {
      ...base,
      planId: observed.result.planId ?? null,
      counts: observed.result.counts ?? {},
      specResults: observed.result.specResults ?? [],
      updatedAt: observed.result.updatedAt ?? null,
      artifact: observed.path,
      resultPath: observed.path,
      runPath: observed.run.path,
      runStatus: observed.run.status,
      runEndedAt: observed.run.endedAt,
      runState: observed.run.state,
    },
  };
}

export function scanPipelineResults(resultsRoot: string): ObservedResult[] {
  if (!existsSync(resultsRoot)) return [];
  return readdirSync(resultsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => observeResult(join(resultsRoot, entry.name, "result.json")))
    .filter((entry): entry is ObservedResult => entry !== null)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, MAX_RESULTS_PER_SCAN);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(text).filter(Boolean))]
    : [];
}

function isProgressiveMasterValidationRun(run: AdoRun): boolean {
  const parameters = record(run.templateParameters);
  if (text(parameters.feature_set) !== "master-validation") return false;
  const rawMetadata = text(parameters.metadata);
  if (!rawMetadata) return true;
  try {
    return [
      "scheduled-master-validation",
      "master-validation-campaign",
    ].includes(text(record(JSON.parse(rawMetadata)).purpose));
  } catch {
    return false;
  }
}

export function isTaskOwnedSpecRun(run: AdoRun): boolean {
  const parameters = record(run.templateParameters);
  if (!text(parameters.specs)) return false;
  const rawMetadata = text(parameters.metadata);
  if (!rawMetadata) return false;
  try {
    const metadata = record(JSON.parse(rawMetadata));
    return Boolean(text(metadata.taskId) || text(metadata.task));
  } catch {
    return false;
  }
}

async function runAzJson(args: string[]): Promise<unknown> {
  const stdout = await new Promise<string | null>((resolve) => {
    execFile(
      AZ_CLI,
      args,
      {
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          AZURE_CONFIG_DIR:
            process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
        },
      },
      (error, output) => resolve(error ? null : output),
    );
  });
  if (stdout === null) return null;
  try {
    return JSON.parse(stdout || "null");
  } catch {
    return null;
  }
}

function adoRunFromApi(run: AdoRun): ObservedAdoRun | null {
  const runId = String(run.id ?? "").trim();
  if (!runId) return null;
  const status = String(run.status ?? "unknown");
  const result = String(run.result ?? status);
  const progressive = isProgressiveMasterValidationRun(run);
  const parameters = record(run.templateParameters);
  const rawMetadata = text(parameters.metadata);
  let metadataTaskId: string | null = null;
  let metadataGeneration: string | null = null;
  if (rawMetadata) {
    try {
      const metadata = record(JSON.parse(rawMetadata));
      metadataTaskId =
        text(metadata.taskId ?? metadata.task ?? metadata.task_id) || null;
      metadataGeneration = text(metadata.generation) || null;
    } catch {
      metadataTaskId = null;
      metadataGeneration = null;
    }
  }
  const observed = {
    runId,
    status,
    result,
    sourceBranch:
      typeof run.sourceBranch === "string" ? run.sourceBranch : null,
    sourceVersion:
      typeof run.sourceVersion === "string" ? run.sourceVersion : null,
    finishTime:
      typeof run.finishTime === "string"
        ? run.finishTime
        : typeof (run as Record<string, unknown>).finishedDate === "string"
          ? ((run as Record<string, unknown>).finishedDate as string)
          : null,
    queueTime: typeof run.queueTime === "string" ? run.queueTime : null,
    // Artifact enumeration is intentionally deferred until a terminal
    // transition is emitted. Level scans must remain one provider query.
    artifacts: [],
    progressive,
    artifactObservable: progressive || Boolean(metadataTaskId),
    specRun: Boolean(text(parameters.specs)),
    metadataTaskId,
    metadataGeneration,
  };
  return {
    ...observed,
    fingerprint: createHash("sha256")
      .update(stableJson(observed))
      .digest("hex"),
  };
}

async function getAdoRun(runId: string): Promise<ObservedAdoRun | null> {
  const run = await runAzJson([
    "pipelines",
    "runs",
    "show",
    "--id",
    runId,
    "--organization",
    ADO_ORGANIZATION,
    "--project",
    ADO_PROJECT,
    "-o",
    "json",
  ]);
  return run && typeof run === "object" ? adoRunFromApi(run as AdoRun) : null;
}

async function getAdoTimelinePage(
  runId: string,
  timelineId?: string,
): Promise<AdoTimelineRecord[]> {
  const timeline = record(
    await runAzJson([
      "devops",
      "invoke",
      "--organization",
      ADO_ORGANIZATION,
      "--area",
      "build",
      "--resource",
      "Timeline",
      "--route-parameters",
      `project=${ADO_PROJECT}`,
      `buildId=${runId}`,
      ...(timelineId ? [`timelineId=${timelineId}`] : []),
      "-o",
      "json",
    ]),
  );
  return Array.isArray(timeline.records)
    ? (timeline.records as AdoTimelineRecord[])
    : [];
}

export function progressTimelineDetailIds(
  timeline: AdoTimelineRecord[],
  limit = MAX_PROGRESS_TIMELINE_DETAILS_PER_RUN,
): string[] {
  return [
    ...new Set(
      timeline
        .filter(
          (entry) =>
            text(entry.type) === "Task" &&
            text(entry.name) === "Auth and execute plan slice",
        )
        .map((entry) => text(record(entry.details).id))
        .filter(Boolean),
    ),
  ].slice(0, Math.max(0, limit));
}

async function getAdoTimeline(runId: string): Promise<AdoTimelineRecord[]> {
  const root = await getAdoTimelinePage(runId);
  const rootById = new Map(root.map((entry) => [text(entry.id), entry]));
  const progress = (
    await Promise.all(
      root
        .filter(
          (entry) =>
            text(entry.type) === "Task" &&
            text(entry.name) === "Auth and execute plan slice" &&
            text(record(entry.details).id),
        )
        .slice(0, MAX_PROGRESS_TIMELINE_DETAILS_PER_RUN)
        .map(async (entry) => {
          const timelineId = text(record(entry.details).id);
          const parent = rootById.get(text(entry.parentId));
          const sliceId =
            /^Execute slice slice_(\d+)$/i
              .exec(text(parent?.name))?.[1]
              ?.padStart(2, "0") ?? "unknown";
          return (await getAdoTimelinePage(runId, timelineId)).map(
            (progressEntry) => ({
              ...progressEntry,
              pipelineRunId: runId,
              sliceId,
            }),
          );
        }),
    )
  ).flat();
  return [...root, ...progress];
}

export function timelineSpecProgress(
  timeline: AdoTimelineRecord[],
): TimelineSpecProgress[] {
  const latest = new Map<string, TimelineSpecProgress>();
  for (const entry of timeline) {
    if (text(entry.type).toLowerCase() !== "aks-spec-progress") continue;
    let value: Record<string, unknown> = {};
    try {
      value = record(JSON.parse(text(entry.currentOperation)));
    } catch {
      // Newer Azure timeline records expose the stable spec name/state/result
      // as fields and keep currentOperation as display text (or clear it on
      // completion). Fall through to those provider fields below.
    }
    const runId = text(value.runId) || text(entry.pipelineRunId);
    const rawSliceId = text(value.sliceId) || text(entry.sliceId);
    const sliceId = rawSliceId ? rawSliceId.padStart(2, "0") : "";
    const testRunId = text(value.testRunId);
    const specId = text(value.specId) || text(entry.name);
    const providerState = text(entry.state).toLowerCase();
    const executionState =
      text(value.executionState) ||
      (providerState === "pending" || providerState === "notstarted"
        ? "queued"
        : providerState === "inprogress"
          ? "running"
          : providerState === "completed"
            ? "completed"
            : "");
    const providerResult = text(entry.result).toLowerCase();
    const verdict = normalizedVerdict(
      text(value.verdict) ||
        (providerResult === "succeeded"
          ? "pass"
          : providerResult === "failed"
            ? "fail"
            : providerResult === "canceled"
              ? "error"
              : "unknown"),
    );
    const sequenceValue = Number(value.sequence ?? entry.changeId);
    const sequence = Number.isFinite(sequenceValue)
      ? sequenceValue
      : executionState === "completed"
        ? 3
        : executionState === "running"
          ? 2
          : 1;
    if (
      !runId ||
      !sliceId ||
      !specId ||
      !Number.isFinite(sequence) ||
      !["queued", "running", "completed"].includes(executionState) ||
      !["unknown", "pass", "fail", "error", "skipped"].includes(verdict)
    ) {
      continue;
    }
    const payloadUpdatedAt = text(value.updatedAt);
    const hasPayloadElapsed = value.elapsedSeconds !== undefined;
    const progress = {
      runId,
      sliceId,
      testRunId,
      specId,
      sequence,
      executionState: executionState as TimelineSpecProgress["executionState"],
      verdict: verdict as TimelineSpecProgress["verdict"],
      phase: text(value.phase) || "provider-timeline",
      phaseDetail:
        text(value.phaseDetail) ||
        text(entry.currentOperation) ||
        executionState,
      message: (
        text(value.message) ||
        `Azure timeline reports ${specId} ${verdict} before slice artifacts are available.`
      ).slice(0, 280),
      updatedAt:
        payloadUpdatedAt || text(entry.finishTime) || text(entry.startTime),
      elapsedSeconds: Math.max(0, Number(value.elapsedSeconds) || 0),
      timingSource:
        payloadUpdatedAt || hasPayloadElapsed
          ? ("payload" as const)
          : ("provider-record" as const),
      category: text(value.category) || "unknown",
    } satisfies TimelineSpecProgress;
    const prior = latest.get(specId);
    if (!prior || progress.sequence > prior.sequence)
      latest.set(specId, progress);
  }
  return [...latest.values()].sort((left, right) =>
    left.specId.localeCompare(right.specId),
  );
}

export function timelineSliceProgress(
  timeline: AdoTimelineRecord[],
): TimelineSliceProgress[] {
  const slices = new Map<string, TimelineSliceProgress>();
  for (const entry of timeline) {
    if (text(entry.type).toLowerCase() !== "job") continue;
    const match = /^Execute slice slice_(\d+)$/i.exec(text(entry.name));
    if (!match) continue;
    const state = text(entry.state).toLowerCase();
    const executionState =
      state === "pending" || state === "notstarted"
        ? "queued"
        : state === "inprogress"
          ? "running"
          : state === "completed"
            ? "completed"
            : null;
    if (!executionState) continue;
    const sliceId = match[1]!.padStart(2, "0");
    slices.set(sliceId, { sliceId, executionState });
  }
  return [...slices.values()].sort((left, right) =>
    left.sliceId.localeCompare(right.sliceId),
  );
}

export function pipelineTestNonpassingEvent(
  run: ObservedAdoRun,
  progress: TimelineSpecProgress,
): AksObserverEvent {
  const fingerprint = createHash("sha256")
    .update(
      stableJson({
        specId: progress.specId,
        status: progress.verdict,
        category: progress.category,
        reason: stableFailureReason(progress.message),
      }),
    )
    .digest("hex")
    .slice(0, 20);
  const factBase = pipelineFactBase(run);
  const taskId = text(factBase.taskId);
  const generation = text(factBase.generation);
  const progressiveFactBase = run.progressive
    ? Object.fromEntries(
        Object.entries(factBase).filter(
          ([key]) => key !== "taskId" && key !== "generation",
        ),
      )
    : factBase;
  const data = {
    ...progressiveFactBase,
    ...(run.progressive && taskId ? { validationTaskId: taskId } : {}),
    ...(run.progressive && generation
      ? { validationGeneration: generation }
      : {}),
    specId: progress.specId,
    sliceId: progress.sliceId,
    status: progress.verdict,
    category: progress.category,
    reason: progress.message,
    phase: progress.phase,
    phaseDetail: progress.phaseDetail,
    testRunId: progress.testRunId,
    failureFingerprint: fingerprint,
  };
  return {
    type: "pipeline.test.nonpassing",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...data,
    data,
  };
}

export function newPipelineTestNonpassingEvents(
  run: ObservedAdoRun,
  progressRecords: TimelineSpecProgress[],
  fingerprints: Record<string, string>,
): AksObserverEvent[] {
  const events: AksObserverEvent[] = [];
  for (const progress of progressRecords) {
    if (!["fail", "error"].includes(progress.verdict)) continue;
    const key = `${run.runId}:${progress.specId}`;
    if (fingerprints[key]) continue;
    const event = pipelineTestNonpassingEvent(run, progress);
    fingerprints[key] =
      text((event as Record<string, unknown>).failureFingerprint) || "observed";
    events.push(event);
  }
  return events;
}

async function listAdoArtifactNames(runId: string): Promise<string[]> {
  const artifacts = await runAzJson([
    "pipelines",
    "runs",
    "artifact",
    "list",
    "--run-id",
    runId,
    "--organization",
    ADO_ORGANIZATION,
    "--project",
    ADO_PROJECT,
    "-o",
    "json",
  ]);
  if (!Array.isArray(artifacts)) return [];
  return artifacts
    .map((artifact) =>
      artifact && typeof artifact === "object"
        ? String((artifact as Record<string, unknown>).name ?? "").trim()
        : "",
    )
    .filter(Boolean)
    .sort();
}

function adoExecutionRank(status: string): number {
  if (["completed", "canceled"].includes(status)) return 3;
  if (status === "inProgress") return 2;
  if (status === "notStarted") return 1;
  return 0;
}

export function mergeAdoRunObservations(
  runs: ObservedAdoRun[],
): ObservedAdoRun[] {
  const byId = new Map<string, ObservedAdoRun>();
  for (const run of runs) {
    const current = byId.get(run.runId);
    if (!current) {
      byId.set(run.runId, run);
      continue;
    }

    const currentRank = adoExecutionRank(current.status);
    const nextRank = adoExecutionRank(run.status);
    if (
      nextRank > currentRank ||
      (nextRank === currentRank && !current.finishTime && run.finishTime)
    ) {
      byId.set(run.runId, run);
    }
  }
  return [...byId.values()];
}

export async function scanAdoPipelineRuns(
  trackedRunIds: string[] = [],
): Promise<ObservedAdoRun[]> {
  if (process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO === "0") return [];
  const listRuns = (status?: "inProgress" | "notStarted") =>
    runAzJson([
      "pipelines",
      "runs",
      "list",
      "--organization",
      ADO_ORGANIZATION,
      "--project",
      ADO_PROJECT,
      "--pipeline-ids",
      ADO_PIPELINE_ID,
      ...(status ? ["--status", status] : []),
      "--top",
      String(MAX_ADO_RUNS_PER_SCAN),
      "-o",
      "json",
    ]);
  const listed = (
    await Promise.all([
      listRuns(),
      listRuns("inProgress"),
      listRuns("notStarted"),
    ])
  )
    .filter(Array.isArray)
    .flat() as AdoRun[];
  const observed = listed.length
    ? mergeAdoRunObservations(
        listed
          .map((run: AdoRun): ObservedAdoRun | null => adoRunFromApi(run))
          .filter((run): run is ObservedAdoRun => run !== null),
      )
    : [];

  const byId = new Map(observed.map((run) => [run.runId, run]));
  for (const runId of trackedRunIds.slice(-100)) {
    if (byId.has(runId)) continue;
    const run = await getAdoRun(runId);
    if (run) byId.set(runId, run);
  }
  return [...byId.values()];
}

export function boundedTrackedRunIds(
  runIds: string[],
  limit = MAX_TRACKED_RUN_IDS,
): string[] {
  return [...new Set(runIds)]
    .filter((runId) => /^\d+$/.test(runId))
    .sort((left, right) => Number(right) - Number(left))
    .slice(0, limit);
}

export function retainedTrackedRunIds(input: {
  priorRunIds: string[];
  runs: ObservedAdoRun[];
  pendingTerminalArtifactRunIds: Set<string>;
  registeredRunIds?: string[];
}): string[] {
  const currentById = new Map(input.runs.map((run) => [run.runId, run]));
  const providerReturnedRuns = input.runs.length > 0;
  return boundedTrackedRunIds([
    ...input.priorRunIds.filter((runId) => {
      const current = currentById.get(runId);
      // Preserve the prior set during a total provider outage. When Azure did
      // return current runs, a missing historical lookup must not become an
      // immortal retry entry.
      if (!current) return !providerReturnedRuns;
      return (
        !["completed", "canceled"].includes(current.status) ||
        input.pendingTerminalArtifactRunIds.has(runId)
      );
    }),
    ...input.runs
      .filter(
        (run) =>
          run.artifactObservable &&
          !["completed", "canceled"].includes(run.status),
      )
      .map((run) => run.runId),
    ...(input.registeredRunIds ?? []).filter((runId) => {
      const current = currentById.get(runId);
      if (!current) return !providerReturnedRuns;
      return (
        !["completed", "canceled"].includes(current.status) ||
        input.pendingTerminalArtifactRunIds.has(runId)
      );
    }),
    ...input.pendingTerminalArtifactRunIds,
  ]);
}

export function hasObservedArtifactsForRun(
  observedArtifacts: Record<string, string>,
  runId: string,
): boolean {
  return Object.keys(observedArtifacts).some((key) =>
    key.startsWith(`${runId}:`),
  );
}

export function artifactRunCandidates(input: {
  runs: ObservedAdoRun[];
  previouslyTrackedRunIds: Set<string>;
  pendingTerminalArtifactRunIds?: Set<string>;
  terminalArtifactUnavailableRunIds?: Set<string>;
  priorFingerprints: Record<string, string>;
  observedArtifacts: Record<string, string>;
  taskRunLimit?: number;
}): ObservedAdoRun[] {
  const newestProgressiveRunId = input.runs
    .filter((run) => run.progressive)
    .map((run) => run.runId)
    .sort((left, right) => Number(right) - Number(left))[0];
  const taskRuns = input.runs.filter(
    (run) => run.artifactObservable && !run.progressive,
  );
  const activeTaskRuns = taskRuns.filter(
    (run) => !["completed", "canceled"].includes(run.status),
  );
  const activeIds = new Set(activeTaskRuns.map((run) => run.runId));
  const completedTaskRuns = taskRuns
    .filter((run) => !activeIds.has(run.runId))
    .sort((left, right) => Number(right.runId) - Number(left.runId));
  const taskLimit = Math.max(
    activeTaskRuns.length,
    input.taskRunLimit ?? MAX_TASK_ARTIFACT_RUNS_PER_SCAN,
  );
  const selectedTaskIds = new Set([
    ...activeIds,
    ...completedTaskRuns
      .slice(0, Math.max(0, taskLimit - activeIds.size))
      .map((run) => run.runId),
  ]);
  const historicalSpecRunIds = new Set(
    input.runs
      .filter(
        (run) =>
          run.specRun &&
          !run.progressive &&
          ["completed", "canceled"].includes(run.status) &&
          !hasObservedArtifactsForRun(input.observedArtifacts, run.runId),
      )
      .sort((left, right) => Number(right.runId) - Number(left.runId))
      .slice(0, taskLimit)
      .map((run) => run.runId),
  );

  return input.runs.filter((run) => {
    const forceRescan = historicalSpecRunIds.has(run.runId);
    const terminalHistoricalProgressive =
      run.progressive &&
      run.runId !== newestProgressiveRunId &&
      ["completed", "canceled"].includes(run.status) &&
      input.previouslyTrackedRunIds.has(run.runId) &&
      input.priorFingerprints[run.runId] === run.fingerprint;
    // A completed master-validation campaign gets one transition scan. A
    // failed materialization explicitly retains that run for a bounded retry
    // window even after a newer campaign starts. Once the window ends, the
    // watcher emits and records an artifact-unavailable disposition instead of
    // retrying forever or starving live work.
    if (input.terminalArtifactUnavailableRunIds?.has(run.runId)) return false;
    if (
      terminalHistoricalProgressive &&
      !input.pendingTerminalArtifactRunIds?.has(run.runId)
    ) {
      return false;
    }
    return (
      (run.progressive ||
        selectedTaskIds.has(run.runId) ||
        historicalSpecRunIds.has(run.runId) ||
        input.pendingTerminalArtifactRunIds?.has(run.runId)) &&
      shouldScanProgressiveArtifacts({
        run,
        wasTracked: input.previouslyTrackedRunIds.has(run.runId),
        priorFingerprint: input.priorFingerprints[run.runId],
        forceRescan:
          forceRescan || input.pendingTerminalArtifactRunIds?.has(run.runId),
      })
    );
  });
}

function artifactKey(runId: string, artifactName: string): string {
  return `${runId}:${artifactName}`;
}

async function downloadAdoArtifact(
  runId: string,
  artifactName: string,
  destination: string,
  ready: (root: string) => boolean = artifactDirectoryReady,
): Promise<boolean> {
  const temporary = `${destination}.partial-${process.pid}-${Date.now()}`;
  rmSync(temporary, { recursive: true, force: true });
  mkdirSync(temporary, { recursive: true });
  const downloaded = await new Promise<boolean>((resolve) => {
    execFile(
      AZ_CLI,
      [
        "pipelines",
        "runs",
        "artifact",
        "download",
        "--run-id",
        runId,
        "--artifact-name",
        artifactName,
        "--path",
        temporary,
        "--organization",
        ADO_ORGANIZATION,
        "--project",
        ADO_PROJECT,
      ],
      {
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          AZURE_CONFIG_DIR:
            process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
        },
      },
      (error) => resolve(!error),
    );
  });
  if (!downloaded || !ready(temporary)) {
    rmSync(temporary, { recursive: true, force: true });
    return false;
  }
  rmSync(destination, { recursive: true, force: true });
  renameSync(temporary, destination);
  return true;
}

function jsonFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && entry.name.endsWith(".json"))
        found.push(child);
    }
  };
  visit(root);
  return found.sort();
}

function resultFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && entry.name === "result.json")
        found.push(child);
    }
  };
  visit(root);
  return found.sort();
}

export function artifactDirectoryReady(root: string): boolean {
  return resultFiles(root).some((path) => {
    try {
      const value = JSON.parse(readFileSync(path, "utf8"));
      return Boolean(value && typeof value === "object");
    } catch {
      return false;
    }
  });
}

export function planDirectoryReady(root: string): boolean {
  return jsonFiles(root).some((path) => {
    if (!/slice-\d+\.json$/.test(path)) return false;
    try {
      const value = record(JSON.parse(readFileSync(path, "utf8")));
      return (
        Array.isArray(value.specIds) && value.specIds.some((id) => text(id))
      );
    } catch {
      return false;
    }
  });
}

function admissionReportPath(root: string | null): string | null {
  if (!root) return null;
  return (
    jsonFiles(root).find((path) =>
      path.endsWith("live-admission-report.json"),
    ) ?? null
  );
}

function admissionReport(root: string | null): Record<string, unknown> {
  const path = admissionReportPath(root);
  if (!path) return {};
  try {
    return record(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return {};
  }
}

function admittedSpecIds(root: string | null): Set<string> | null {
  const admitted = stringArray(admissionReport(root).admittedSpecIds);
  return admitted.length ? new Set(admitted) : null;
}

function missingSliceArtifactReason(input: {
  runId: string;
  sliceId: string;
  sourceBranch: string;
}): string {
  return [
    `Azure DevOps run ${input.runId} completed without publishing slice-${input.sliceId}-test-results even though plan-inputs admitted this slice.`,
    `Current run branch: ${input.sourceBranch || "unknown"}.`,
    "Treat this as a terminal missing-artifact representation, not a silently pending slice.",
  ].join(" ");
}

function preservedSpecVerdictReason(input: {
  runId: string;
  sliceId: string;
  sourceBranch: string;
  reason: string;
}): string {
  return [
    input.reason,
    `Preserved this stronger current verdict because Azure DevOps run ${input.runId} completed without publishing slice-${input.sliceId}-test-results for admitted work on ${input.sourceBranch || "unknown"}.`,
  ].join(" ");
}

function preservedSpecVerdict(value: unknown): PreservedSpecVerdict | null {
  const spec = record(value);
  const review = record(spec.review);
  if (
    text(spec.taskId) ||
    text(spec.activeAttemptId) ||
    text(spec.activeTaskSessionId) ||
    text(spec.activeWorkflowRunId) ||
    text(review.pendingReviewTaskId)
  ) {
    return null;
  }
  const candidate = normalizedVerdict(
    text(spec.status) || text(review.acceptedStatus),
  );
  if (!["pass", "fail", "error", "skipped"].includes(candidate)) {
    return null;
  }
  const artifactPath =
    text(review.acceptedResultPath) ||
    text(spec.lastResultPath) ||
    text(spec.successorResultPath) ||
    undefined;
  if (!artifactPath) return null;
  const reason =
    text(review.lastAction) ||
    text(spec.successorStateReason) ||
    text(spec.diagnosis) ||
    `Current spec-loop verdict remains ${candidate}.`;
  return {
    status: candidate as PreservedSpecVerdict["status"],
    category: "preserved_current_exact_verdict",
    reason,
    artifactPath,
  };
}

function preservedSpecVerdicts(
  path: string,
): Record<string, PreservedSpecVerdict> {
  if (!existsSync(path)) return {};
  try {
    const state = record(JSON.parse(readFileSync(path, "utf8")));
    const specs = record(state.specs);
    return Object.fromEntries(
      Object.entries(specs)
        .map(([specId, spec]) => [specId, preservedSpecVerdict(spec)] as const)
        .filter((entry): entry is [string, PreservedSpecVerdict] =>
          Boolean(entry[1]),
        ),
    );
  } catch {
    return {};
  }
}

export function failureObservationsFromAdmissionReport(input: {
  root: string;
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
}): PipelineFailureObservation[] {
  const artifactPath = admissionReportPath(input.root);
  if (!artifactPath) return [];
  try {
    const report = admissionReport(input.root);
    const excluded = Array.isArray(report.excluded)
      ? report.excluded.map(record)
      : [];
    return excluded.flatMap((item) => {
      const specId = text(item.specId);
      if (!specId) return [];
      const bucket = text(item.bucket) || "unknown";
      const reason = `${bucket}: ${text(item.reason) || "Live admission excluded this spec."}`;
      const fingerprint = createHash("sha256")
        .update(
          stableJson({
            specId,
            status: "excluded",
            category: "admission_exclusion",
            reason: stableFailureReason(reason),
          }),
        )
        .digest("hex")
        .slice(0, 20);
      return [
        {
          pipelineRunId: input.pipelineRunId,
          sourceBranch: input.sourceBranch,
          sourceCommit: input.sourceCommit,
          artifactName: "plan-inputs",
          artifactPath,
          sliceId: "admission",
          specId,
          status: "excluded",
          category: "admission_exclusion",
          reason,
          fingerprint,
        },
      ];
    });
  } catch {
    return [];
  }
}

function planSlices(root: string | null): Map<string, string[]> {
  const slices = new Map<string, string[]>();
  if (!root || !planDirectoryReady(root)) return slices;
  for (const path of jsonFiles(root)) {
    if (!/slice-\d+\.json$/.test(path)) continue;
    try {
      const value = record(JSON.parse(readFileSync(path, "utf8")));
      const sliceId = text(value.slice).padStart(2, "0");
      const specIds = Array.isArray(value.specIds)
        ? [...new Set(value.specIds.map(text).filter(Boolean))]
        : [];
      if (sliceId && specIds.length) slices.set(sliceId, specIds);
    } catch {
      // A malformed plan slice is omitted from the current projection.
    }
  }
  return slices;
}

function missingSliceArtifactObservations(input: {
  run: ObservedAdoRun;
  planRoot: string | null;
  artifactRoots: Record<string, string>;
  preservedVerdicts?: Record<string, PreservedSpecVerdict>;
}): PipelineSpecObservation[] {
  if (
    !input.planRoot ||
    !["completed", "canceled"].includes(input.run.status)
  ) {
    return [];
  }
  const admitted = admittedSpecIds(input.planRoot);
  const planned = planSlices(input.planRoot);
  const preserved = input.preservedVerdicts ?? {};
  const observations: PipelineSpecObservation[] = [];
  for (const [sliceId, specIds] of [...planned.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const artifactName = `slice-${sliceId}-test-results`;
    if (input.artifactRoots[artifactName]) continue;
    for (const specId of specIds) {
      if (admitted && !admitted.has(specId)) continue;
      const verdict = preserved[specId];
      observations.push({
        pipelineRunId: input.run.runId,
        sourceBranch: input.run.sourceBranch ?? "",
        sourceCommit: input.run.sourceVersion ?? "",
        artifactName,
        artifactPath:
          verdict?.artifactPath ??
          `ado://build/${input.run.runId}/${artifactName}`,
        sliceId,
        specId,
        status: verdict?.status ?? "error",
        category: verdict?.category ?? "missing_slice_artifact",
        reason: verdict
          ? preservedSpecVerdictReason({
              runId: input.run.runId,
              sliceId,
              sourceBranch: input.run.sourceBranch ?? "",
              reason: verdict.reason,
            })
          : missingSliceArtifactReason({
              runId: input.run.runId,
              sliceId,
              sourceBranch: input.run.sourceBranch ?? "",
            }),
      });
    }
  }
  return observations;
}

function normalizedVerdict(value: string): string {
  const status = value.toLowerCase();
  return status === "passed" ? "pass" : status === "failed" ? "fail" : status;
}

function projectedElapsedSeconds(
  progress: TimelineSpecProgress | undefined,
  checkedAtMs: number,
): number {
  if (!progress) return 0;
  const recorded = Math.max(0, progress.elapsedSeconds || 0);
  if (progress.executionState !== "running") return recorded;
  // Azure may create a queued detail record at slice start and later change
  // only its provider state to running. Its startTime is then not the next
  // scenario's start time, so only explicit progress-payload timing may be
  // projected forward.
  if (progress.timingSource === "provider-record") return recorded;
  const updatedAtMs = Date.parse(progress.updatedAt);
  if (!Number.isFinite(checkedAtMs) || !Number.isFinite(updatedAtMs)) {
    return recorded;
  }
  return recorded + Math.floor(Math.max(0, checkedAtMs - updatedAtMs) / 1_000);
}

export function buildMasterValidationProgress(input: {
  run: ObservedAdoRun;
  planRoot: string | null;
  artifactRoots: Record<string, string>;
  preservedVerdicts?: Record<string, PreservedSpecVerdict>;
  timelineProgress?: TimelineSpecProgress[];
  timelineSlices?: TimelineSliceProgress[];
  checkedAt?: string;
}): MasterValidationProgress {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const checkedAtMs = Date.parse(checkedAt);
  const planned = planSlices(input.planRoot);
  const exclusions = input.planRoot
    ? failureObservationsFromAdmissionReport({
        root: input.planRoot,
        pipelineRunId: input.run.runId,
        sourceBranch: input.run.sourceBranch ?? "",
        sourceCommit: input.run.sourceVersion ?? "",
      })
    : [];
  const observed = new Map<string, PipelineSpecObservation>();
  const live = new Map(
    (input.timelineProgress ?? []).map((progress) => [
      progress.specId,
      progress,
    ]),
  );
  const liveSlices = new Map(
    (input.timelineSlices ?? []).map((slice) => [slice.sliceId, slice]),
  );
  for (const progress of live.values()) {
    if (!planned.has(progress.sliceId)) planned.set(progress.sliceId, []);
    const ids = planned.get(progress.sliceId)!;
    if (!ids.includes(progress.specId)) ids.push(progress.specId);
  }
  for (const [artifactName, root] of Object.entries(input.artifactRoots)) {
    for (const observation of specObservationsFromArtifact({
      root,
      pipelineRunId: input.run.runId,
      sourceBranch: input.run.sourceBranch ?? "",
      sourceCommit: input.run.sourceVersion ?? "",
      artifactName,
    })) {
      observed.set(observation.specId, observation);
      if (!planned.has(observation.sliceId))
        planned.set(observation.sliceId, []);
      const ids = planned.get(observation.sliceId)!;
      if (!ids.includes(observation.specId)) ids.push(observation.specId);
    }
  }
  for (const observation of missingSliceArtifactObservations({
    run: input.run,
    planRoot: input.planRoot,
    artifactRoots: input.artifactRoots,
    preservedVerdicts: input.preservedVerdicts,
  })) {
    observed.set(observation.specId, observation);
    if (!planned.has(observation.sliceId)) planned.set(observation.sliceId, []);
    const ids = planned.get(observation.sliceId)!;
    if (!ids.includes(observation.specId)) ids.push(observation.specId);
  }

  const specs = [
    ...[...planned.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([sliceId, specIds]) =>
        specIds.sort().map((specId) => {
          const value = observed.get(specId);
          const current = live.get(specId);
          const currentVerdict = current?.verdict ?? "unknown";
          const hasLiveVerdict = currentVerdict !== "unknown";
          const elapsedSeconds = projectedElapsedSeconds(current, checkedAtMs);
          const currentUpdatedAtMs = Date.parse(current?.updatedAt ?? "");
          const stale =
            !value &&
            current?.executionState === "running" &&
            Number.isFinite(checkedAtMs) &&
            Number.isFinite(currentUpdatedAtMs) &&
            checkedAtMs - currentUpdatedAtMs > LIVE_PROGRESS_STALE_MS;
          return {
            sliceId,
            specId,
            status: value
              ? normalizedVerdict(value.status)
              : hasLiveVerdict
                ? currentVerdict
                : "pending",
            category: value?.category ?? current?.category ?? "unknown",
            reason:
              value?.reason ??
              current?.message ??
              "Awaiting a completed slice verdict.",
            ...(value
              ? {
                  executionState: "completed" as const,
                  phase: "artifact-result",
                  phaseDetail: normalizedVerdict(value.status),
                  updatedAt: checkedAt,
                  elapsedSeconds,
                }
              : current
                ? {
                    executionState: current.executionState,
                    phase: current.phase,
                    phaseDetail: current.phaseDetail,
                    updatedAt: current.updatedAt,
                    elapsedSeconds,
                    ...(stale ? { stale: true } : {}),
                  }
                : {}),
            ...(value ? { artifactPath: value.artifactPath } : {}),
          };
        }),
      ),
    ...exclusions.map((failure) => ({
      sliceId: failure.sliceId,
      specId: failure.specId,
      status: failure.status,
      category: failure.category,
      reason: failure.reason,
      artifactPath: failure.artifactPath,
    })),
  ];
  const verdictCount = (status: string) =>
    specs.filter((spec) => spec.status === status).length;
  const observedCount = specs.filter(
    (spec) => spec.status !== "pending",
  ).length;
  const executionCount = (state: string) =>
    specs.filter(
      (spec) => "executionState" in spec && spec.executionState === state,
    ).length;
  const knownVerdicts = new Set([
    "pass",
    "fail",
    "error",
    "skipped",
    "excluded",
  ]);
  const slices: MasterValidationProgress["slices"] = [...planned.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sliceId, specIds]) => {
      const completed = specIds.filter((specId) => observed.has(specId)).length;
      const active = specIds.filter((specId) => live.has(specId)).length;
      const sliceExecutionState = liveSlices.get(sliceId)?.executionState;
      return {
        sliceId,
        selected: specIds.length,
        observed: completed,
        status:
          completed === specIds.length
            ? "completed"
            : sliceExecutionState === "completed"
              ? "draining"
              : sliceExecutionState === "running"
                ? "running"
                : sliceExecutionState === "queued"
                  ? "queued"
                  : completed === 0 && active === 0
                    ? "pending"
                    : "partial",
      };
    });
  if (exclusions.length) {
    slices.push({
      sliceId: "admission",
      selected: exclusions.length,
      observed: exclusions.length,
      status: "completed",
    });
  }
  return {
    schemaVersion: "1",
    runId: input.run.runId,
    sourceBranch: input.run.sourceBranch,
    sourceCommit: input.run.sourceVersion,
    state: input.run.status,
    result: input.run.result,
    queueTime: input.run.queueTime,
    checkedAt,
    counts: {
      selected: specs.length,
      observed: observedCount,
      pending: specs.length - observedCount,
      queued: executionCount("queued"),
      running: executionCount("running"),
      pass: verdictCount("pass"),
      fail: verdictCount("fail"),
      error: verdictCount("error"),
      skipped: verdictCount("skipped"),
      excluded: verdictCount("excluded"),
      other: specs.filter(
        (spec) => spec.status !== "pending" && !knownVerdicts.has(spec.status),
      ).length,
    },
    slices,
    specs,
  };
}

function saveProgress(path: string, progress: MasterValidationProgress): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.partial-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

function stableFailureReason(value: string): string {
  return value
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<guid>")
    .replace(/\b\d{3,}\b/g, "<number>")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizedFailureReason(value: string): string {
  const jsonStart = value.indexOf(": {");
  if (jsonStart > 0) {
    try {
      const details = record(JSON.parse(value.slice(jsonStart + 2)));
      const summary = [
        ["debugLabel", details.debugLabel],
        ["lastPollState", details.lastPollState],
        ["lastResourceState", details.lastResourceState],
      ]
        .filter((entry) => text(entry[1]))
        .map(([key, entry]) => `${String(key)}=${text(entry)}`)
        .join(", ");
      if (summary) return `${value.slice(0, jsonStart)}: ${summary}`;
    } catch {
      // Fall through to a bounded plain-text reason.
    }
  }
  return value.length <= 2_000 ? value : `${value.slice(0, 1_997)}...`;
}

export function failureObservationsFromArtifact(input: {
  root: string;
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  artifactName: string;
}): PipelineFailureObservation[] {
  const sliceId =
    input.artifactName.match(/^slice-(\d+)-test-results$/)?.[1] ?? "unknown";
  const failures: PipelineFailureObservation[] = [];
  const seen = new Set<string>();
  for (const path of resultFiles(input.root)) {
    try {
      const result = JSON.parse(readFileSync(path, "utf8")) as PipelineResult;
      if (!Array.isArray(result.specResults)) continue;
      for (const value of result.specResults) {
        const spec = record(value);
        const specId = text(spec.specId ?? spec.spec_id);
        if (!specId) continue;
        const override = exactCoverageOverride({
          root: input.root,
          specId,
          spec,
        });
        const status = override?.status ?? text(spec.status) ?? "unknown";
        if (["pass", "passed", "skipped"].includes(status.toLowerCase()))
          continue;
        const category = override?.category ?? text(spec.category) ?? "unknown";
        const reason =
          override?.reason ??
          summarizedFailureReason(
            text(spec.reason) || "No failure reason was recorded.",
          );
        const fingerprint = createHash("sha256")
          .update(
            stableJson({
              specId,
              status: status.toLowerCase(),
              category: category.toLowerCase(),
              reason: stableFailureReason(reason),
            }),
          )
          .digest("hex")
          .slice(0, 20);
        const identity = `${specId}:${fingerprint}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        failures.push({
          pipelineRunId: input.pipelineRunId,
          sourceBranch: input.sourceBranch,
          sourceCommit: input.sourceCommit,
          artifactName: input.artifactName,
          artifactPath: override?.artifactPath ?? path,
          sliceId,
          specId,
          status,
          category,
          reason,
          fingerprint,
        });
      }
    } catch {
      // Ignore incomplete or non-result JSON while an artifact is being published.
    }
  }
  return failures;
}

function expectedCoverageAssertionNames(
  assertions: Record<string, unknown>[],
): string[] {
  const preflight = assertions.find(
    (entry) => text(entry.name) === "all-assertions-present",
  );
  const detail = text(preflight?.detail);
  const match = detail.match(/Expected \[(.*?)\](?:, found|$)/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function exactCoverageOverride(input: {
  root: string;
  specId: string;
  spec: Record<string, unknown>;
}): {
  status: string;
  category: string;
  reason: string;
  artifactPath: string;
} | null {
  const artifactRef = stringArray(input.spec.artifactRefs).find((entry) =>
    entry.endsWith("/spec-runner/result.json"),
  );
  if (!artifactRef) return null;
  const artifactPath = join(input.root, artifactRef);
  if (!existsSync(artifactPath)) return null;
  try {
    const result = record(JSON.parse(readFileSync(artifactPath, "utf8")));
    const rawStatus = normalizedVerdict(
      text(result.status) || text(record(result.probeEvidence).status),
    );
    if (rawStatus !== "pass") return null;
    const probe = record(result.probeEvidence);
    const assertions = Array.isArray(probe.assertions)
      ? probe.assertions.map(record)
      : [];
    const expected = expectedCoverageAssertionNames(assertions);
    if (!expected.length) return null;
    const proved = new Set(
      assertions
        .filter(
          (entry) =>
            entry.ok === true &&
            ["claim", "audit"].includes(text(entry.verdictImpact)) &&
            expected.includes(text(entry.name)),
        )
        .map((entry) => text(entry.name)),
    );
    if (expected.every((name) => proved.has(name))) return null;
    const missing = expected.filter((name) => !proved.has(name));
    const diagnostic = assertions.find((entry) => {
      const detail = text(entry.detail);
      return (
        detail &&
        /requires|full assertion coverage|full feature validation/i.test(detail)
      );
    });
    const summary =
      text(result.summary) ||
      text(probe.summary) ||
      text(input.spec.reason) ||
      "Pass artifact did not prove every expected live claim.";
    const detail = text(diagnostic?.detail);
    return {
      status: "error",
      category: "insufficient_claim_coverage",
      reason: summarizedFailureReason(
        `Exact spec-runner artifact did not prove every expected live claim for ${input.specId}. Missing successful claim/audit assertions: ${missing.join(", ")}. ${summary}${detail ? ` ${detail}` : ""}`,
      ),
      artifactPath,
    };
  } catch {
    return null;
  }
}

function assertionNamed(
  assertions: Record<string, unknown>[],
  name: string,
): Record<string, unknown> | null {
  return assertions.find((entry) => text(entry.name) === name) ?? null;
}

function detailVersion(detail: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = detail.match(new RegExp(`${escaped}(?:=|:\\s*)([^,\\s]+)`));
  return match?.[1]?.trim() ?? "";
}

function availableVersions(detail: string): string[] {
  const match = detail.match(
    /Available versions queried:\s*(.*?)(?:\.\s*Skipping|$)/i,
  );
  if (!match) return [];
  const raw = match[1]?.trim() ?? "";
  if (!raw || raw === "(none)") return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function highestPublishedVersion(versions: string[]): string {
  return (
    [...versions]
      .sort((left, right) =>
        left.localeCompare(right, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      )
      .at(-1) ?? ""
  );
}

function nodeImagePublicationObservationFromSpec(input: {
  root: string;
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  artifactName: string;
  sliceId: string;
  result: PipelineResult;
  spec: Record<string, unknown>;
}): NodeImagePublicationObservation | null {
  const specId = text(input.spec.specId ?? input.spec.spec_id);
  if (!specId) return null;
  const testArtifactRef = stringArray(input.spec.artifactRefs).find((entry) =>
    /\/tests\/.*\.json$/.test(entry),
  );
  if (!testArtifactRef) return null;
  const artifactPath = join(input.root, testArtifactRef);
  if (!existsSync(artifactPath)) return null;
  try {
    const detail = record(JSON.parse(readFileSync(artifactPath, "utf8")));
    const assertions = Array.isArray(detail.assertions)
      ? detail.assertions.map(record)
      : [];
    const clusterCreated = assertionNamed(assertions, "setup.cluster-created");
    const availability = assertionNamed(
      assertions,
      "assert.patch-availability",
    );
    const snapshot = assertionNamed(
      assertions,
      "snapshot.image-family-azurelinux",
    );
    const currentNodeImageVersion =
      detailVersion(text(snapshot?.detail), "nodeImageVersion") ||
      detailVersion(text(availability?.detail), "Current:");
    if (!currentNodeImageVersion) return null;

    const raw = record(detail.raw);
    const config = record(record(raw.raw).config);
    const imageFamily =
      text(config.imageFamily) ||
      currentNodeImageVersion.split("-")[0]?.trim() ||
      "";
    const channel =
      text(clusterCreated?.detail).match(
        /nodeOSUpgradeChannel=([^,\s]+)/,
      )?.[1] ?? "";
    const publishedVersions = availableVersions(
      text(availability?.detail),
    ).filter((version) => version.startsWith(imageFamily));
    const publishedVersion =
      highestPublishedVersion(publishedVersions) || currentNodeImageVersion;
    const target = record(input.result.target);
    const targetName = text(target.environment) || text(target.name);
    const location = text(target.location) || text(config.location);
    const subscriptionId =
      text(target.subscriptionId) || text(config.subscriptionId);
    if (
      !targetName ||
      !location ||
      !subscriptionId ||
      !imageFamily ||
      !channel ||
      !publishedVersion
    ) {
      return null;
    }
    return {
      project: "aks-rp-e2e",
      pipelineRunId: input.pipelineRunId,
      sourceBranch: input.sourceBranch,
      sourceCommit: input.sourceCommit,
      artifactName: input.artifactName,
      artifactPath,
      sliceId: input.sliceId,
      specId,
      targetName,
      location,
      subscriptionId,
      imageFamily,
      channel,
      publishedVersion,
      currentNodeImageVersion,
      publishedVersions,
    };
  } catch {
    return null;
  }
}

export function nodeImagePublicationObservationsFromArtifact(input: {
  root: string;
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  artifactName: string;
}): NodeImagePublicationObservation[] {
  const sliceId =
    input.artifactName.match(/^slice-(\d+)-test-results$/)?.[1] ?? "unknown";
  const observations: NodeImagePublicationObservation[] = [];
  const seen = new Set<string>();
  for (const path of resultFiles(input.root)) {
    try {
      const result = JSON.parse(readFileSync(path, "utf8")) as PipelineResult;
      if (!Array.isArray(result.specResults)) continue;
      for (const value of result.specResults) {
        const spec = record(value);
        const specId = text(spec.specId ?? spec.spec_id);
        if (!specId || seen.has(specId)) continue;
        seen.add(specId);
        const observation = nodeImagePublicationObservationFromSpec({
          root: input.root,
          pipelineRunId: input.pipelineRunId,
          sourceBranch: input.sourceBranch,
          sourceCommit: input.sourceCommit,
          artifactName: input.artifactName,
          sliceId,
          result,
          spec,
        });
        if (observation) observations.push(observation);
      }
    } catch {
      // Ignore incomplete or non-result JSON while an artifact is being published.
    }
  }
  return observations;
}

export function specObservationsFromArtifact(input: {
  root: string;
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  artifactName: string;
}): PipelineSpecObservation[] {
  const sliceId =
    input.artifactName.match(/^slice-(\d+)-test-results$/)?.[1] ?? "unknown";
  const observations: PipelineSpecObservation[] = [];
  const seen = new Set<string>();
  for (const path of resultFiles(input.root)) {
    try {
      const result = JSON.parse(readFileSync(path, "utf8")) as PipelineResult;
      if (!Array.isArray(result.specResults)) continue;
      for (const value of result.specResults) {
        const spec = record(value);
        const specId = text(spec.specId ?? spec.spec_id);
        if (!specId || seen.has(specId)) continue;
        seen.add(specId);
        const override = exactCoverageOverride({
          root: input.root,
          specId,
          spec,
        });
        observations.push({
          pipelineRunId: input.pipelineRunId,
          sourceBranch: input.sourceBranch,
          sourceCommit: input.sourceCommit,
          artifactName: input.artifactName,
          artifactPath: override?.artifactPath ?? path,
          sliceId,
          specId,
          status: (override?.status ?? text(spec.status)) || "unknown",
          category: (override?.category ?? text(spec.category)) || "unknown",
          reason:
            override?.reason ??
            summarizedFailureReason(
              text(spec.reason) || "No result reason was recorded.",
            ),
        });
      }
    } catch {
      // Ignore incomplete or non-result JSON while an artifact is being published.
    }
  }
  return observations;
}

export function pipelineSpecEvent(
  observation: PipelineSpecObservation,
): AksObserverEvent {
  const data = { ...observation };
  return {
    type: "pipeline.spec.observed",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...data,
    data,
  };
}

export function nodeImagePublicationEvent(
  observation: NodeImagePublicationObservation,
): AksObserverEvent {
  const data = { ...observation };
  return {
    type: nodeImagePublicationEventType,
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...data,
    data,
  };
}

export function pipelineFailureEvent(
  failure: PipelineFailureObservation,
): AksObserverEvent {
  const data = {
    project: "aks-rp-e2e",
    pipelineRunId: failure.pipelineRunId,
    failureRevision: 1,
    sourceBranch: failure.sourceBranch,
    sourceCommit: failure.sourceCommit,
    specId: failure.specId,
    sliceId: failure.sliceId,
    status: failure.status,
    category: failure.category,
    reason: failure.reason,
    fingerprint: failure.fingerprint,
    failureFingerprint: failure.fingerprint,
    artifactName: failure.artifactName,
    artifactPath: failure.artifactPath,
  };
  return {
    type: "pipeline.failure.observed",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...data,
    data,
  };
}

export function masterValidationNoVerdictFailure(input: {
  pipelineRunId: string;
  sourceBranch: string;
  sourceCommit: string;
  status: string;
  result: string;
  progressive: boolean;
  artifactsReady: boolean;
  observedVerdictCount: number;
  observedFailureCount: number;
}): PipelineFailureObservation | null {
  if (
    !input.progressive ||
    input.status !== "completed" ||
    [
      "succeeded",
      "success",
      "passed",
      "pass",
      "canceled",
      "cancelled",
    ].includes(input.result.toLowerCase()) ||
    !input.artifactsReady ||
    input.observedVerdictCount > 0 ||
    input.observedFailureCount > 0
  ) {
    return null;
  }
  const specId = "pipeline.master-validation.bootstrap";
  const reason =
    "The master-validation aggregate failed before producing any parseable spec verdict. Treat this as a repository-owned pipeline/bootstrap issue, inspect the failed Azure step, and repair it on the frozen campaign instead of waiting for a current-main spec pass.";
  const fingerprint = createHash("sha256")
    .update(
      stableJson({
        specId,
        status: "error",
        category: "pipeline_failure",
        reason: stableFailureReason(reason),
      }),
    )
    .digest("hex")
    .slice(0, 20);
  return {
    pipelineRunId: input.pipelineRunId,
    sourceBranch: input.sourceBranch,
    sourceCommit: input.sourceCommit,
    artifactName: "pipeline-logs",
    artifactPath: `ado://build/${input.pipelineRunId}`,
    sliceId: "aggregate",
    specId,
    status: "error",
    category: "pipeline_failure",
    reason,
    fingerprint,
  };
}

function pipelineFactBase(observed: {
  runId: string;
  status: string;
  result: string;
  sourceBranch?: string | null;
  sourceVersion?: string | null;
  finishTime?: string | null;
  queueTime?: string | null;
  artifacts?: string[];
  metadataTaskId?: string | null;
  metadataGeneration?: string | null;
}): Record<string, unknown> {
  return {
    project: "aks-rp-e2e",
    pipelineRunId: observed.runId,
    runId: observed.runId,
    status: observed.status,
    result: observed.result,
    ...(observed.sourceBranch ? { sourceBranch: observed.sourceBranch } : {}),
    ...(observed.sourceVersion
      ? { sourceVersion: observed.sourceVersion }
      : {}),
    ...(observed.finishTime ? { finishTime: observed.finishTime } : {}),
    ...(observed.queueTime ? { queueTime: observed.queueTime } : {}),
    ...(observed.artifacts ? { artifacts: observed.artifacts } : {}),
    ...(observed.metadataTaskId ? { taskId: observed.metadataTaskId } : {}),
    ...(observed.metadataGeneration
      ? { generation: observed.metadataGeneration }
      : {}),
  };
}

export function pipelineQueueOverdueEvent(
  observed: ObservedAdoRun,
  nowMs = Date.now(),
  timeline: AdoTimelineRecord[] = [],
): AksObserverEvent | null {
  if (!observed.progressive) return null;
  let queueTime = observed.queueTime;
  let queueScope = "run";
  if (observed.status === "inProgress") {
    const slices = timeline.filter(
      (entry) =>
        text(entry.type) === "Job" &&
        text(entry.name).startsWith("Execute slice "),
    );
    const pending = slices.filter((entry) => text(entry.state) === "pending");
    const running = slices.filter(
      (entry) => text(entry.state) === "inProgress",
    );
    if (pending.length === 0 || running.length > 0) {
      return null;
    }
    const plan = timeline.find(
      (entry) =>
        text(entry.type) === "Job" &&
        text(entry.name) === "Plan AKS RP E2E specs" &&
        text(entry.state) === "completed",
    );
    const latestCompletedAt = slices
      .filter((entry) => text(entry.state) === "completed")
      .map((entry) => text(entry.finishTime))
      .filter(Boolean)
      .sort()
      .at(-1);
    queueTime = latestCompletedAt || text(plan?.finishTime) || null;
    queueScope = "slice-jobs";
  } else if (observed.status !== "notStarted") {
    return null;
  }
  if (!queueTime) return null;
  const queuedAtMs = Date.parse(queueTime);
  if (
    !Number.isFinite(queuedAtMs) ||
    nowMs - queuedAtMs < MASTER_VALIDATION_QUEUE_OVERDUE_MS
  ) {
    return null;
  }
  const base = pipelineFactBase(observed);
  const queueAgeMs = Math.max(0, nowMs - queuedAtMs);
  const data = { ...base, queueTime, queueAgeMs, queueScope };
  return {
    type: "pipeline.queue.overdue",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...base,
    queueTime,
    queueAgeMs,
    queueScope,
    data,
  };
}

export function shouldScanProgressiveArtifacts(input: {
  run: ObservedAdoRun;
  wasTracked: boolean;
  priorFingerprint?: string;
  forceRescan?: boolean;
}): boolean {
  if (input.forceRescan) return true;
  if (!(input.run.artifactObservable ?? input.run.progressive)) return false;
  if (!["completed", "canceled"].includes(input.run.status)) return true;
  return input.wasTracked || input.priorFingerprint !== input.run.fingerprint;
}

export function shouldEmitPipelineLevel(input: {
  run: ObservedAdoRun;
  priorFingerprint?: string;
}): boolean {
  return (
    !["completed", "canceled"].includes(input.run.status) ||
    input.priorFingerprint !== input.run.fingerprint
  );
}

export function shouldEmitMasterValidationFailure(
  run: ObservedAdoRun,
): boolean {
  return run.progressive === true;
}

function materializedArtifactEvent(
  observed: ObservedAdoRun,
  artifactName: string,
  artifactPath: string,
): AksObserverEvent {
  const base = pipelineFactBase(observed);
  return {
    type: "pipeline-artifact.available",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...base,
    artifactName,
    artifactPath,
    data: {
      ...base,
      artifactName,
      artifactPath,
    },
  };
}

export function pipelineObservationEvents(
  observed: ObservedAdoRun,
): AksObserverEvent[] {
  const base = pipelineFactBase(observed);
  const events: AksObserverEvent[] = [];

  if (observed.status === "completed") {
    events.push(
      {
        type: "project.test_run.completed",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...base,
        data: base,
      },
      {
        type: "pipeline.completed",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...base,
        status: "completed",
        state: "completed",
        data: { ...base, status: "completed", state: "completed" },
      },
      {
        type: "pipeline-run.state",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...base,
        status: "completed",
        state: "completed",
        terminal: true,
        data: {
          ...base,
          status: "completed",
          state: "completed",
          terminal: true,
        },
      },
    );
  }

  return events;
}

export function pipelineLevelEvent(observed: ObservedAdoRun): AksObserverEvent {
  const base = pipelineFactBase(observed);
  const terminal = observed.status === "completed";
  return {
    type: "pipeline-run.state",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...base,
    state: observed.status,
    terminal,
    data: { ...base, state: observed.status, terminal },
  };
}

export type PipelineWatcherDependencies = {
  scanAdoRuns?: (trackedRunIds: string[]) => Promise<ObservedAdoRun[]>;
  getTimeline?: (runId: string) => Promise<AdoTimelineRecord[]>;
  listArtifactNames?: (runId: string) => Promise<string[]>;
  downloadArtifact?: (
    runId: string,
    artifactName: string,
    destination: string,
    ready?: (root: string) => boolean,
  ) => Promise<boolean>;
};

export function terminalArtifactUnavailableEvent(input: {
  run: ObservedAdoRun;
  artifactNames: string[];
  attempts: number;
}): AksObserverEvent {
  const base = pipelineFactBase(input.run);
  const data = {
    ...base,
    artifactNames: input.artifactNames,
    attempts: input.attempts,
    reason: `Azure DevOps run ${input.run.runId} remained terminal but its advertised result artifacts could not be materialized after ${input.attempts} bounded attempts.`,
  };
  return {
    type: "pipeline-artifact.unavailable",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...data,
    data,
  };
}

/** Observe domain pipeline artifacts and emit facts; never reads or changes task state. */
export async function observeAksPipelines(
  ctx: AksObserverContext,
  dependencies: PipelineWatcherDependencies = {},
): Promise<unknown> {
  const statePath = ctx.appPath(".state/watchers/aks-pipeline.json");
  const prior = readState(statePath);
  const hasPriorState = Boolean(
    prior.schemaVersion || prior.fingerprints || prior.adoFingerprints,
  );
  const priorFingerprints = prior.fingerprints ?? {};
  const priorLocalRunStates = prior.localRunStates ?? {};
  const priorLocalCompletionFingerprints =
    prior.localCompletionFingerprints ?? prior.fingerprints ?? {};
  const priorAdoFingerprints = prior.adoFingerprints ?? {};
  const observedArtifacts = { ...(prior.observedArtifacts ?? {}) };
  const overdueQueueRunIds = new Set(prior.overdueQueueRunIds ?? []);
  const results = scanPipelineResults(
    ctx.appPath("../aks-rp-e2e/runs/test-results"),
  );
  const fingerprints = Object.fromEntries(
    results.map((result) => [result.runId, result.fingerprint]),
  );
  const localRunStates = Object.fromEntries(
    results.map((result) => [result.runId, result.run.state]),
  );
  const localCompletionFingerprints = {
    ...(prior.localCompletionFingerprints ?? prior.fingerprints ?? {}),
  };
  const registrationRunIds = registeredTrackedRunIds(ctx.appPath("."));
  const adoRuns = await (dependencies.scanAdoRuns ?? scanAdoPipelineRuns)(
    boundedTrackedRunIds(
      [...(prior.trackedRunIds ?? []), ...registrationRunIds],
      100,
    ),
  );
  const adoFingerprints = Object.fromEntries(
    adoRuns.map((run) => [run.runId, run.fingerprint]),
  );
  const checkedAt = new Date().toISOString();
  // One provider timeline read per active progressive run is shared by queue
  // diagnosis, live progress projection, and early nonpassing observation.
  const timelinesByRun = new Map(
    await Promise.all(
      adoRuns
        .filter(
          (run) =>
            run.progressive && !["completed", "canceled"].includes(run.status),
        )
        .map(
          async (run) =>
            [
              run.runId,
              await (dependencies.getTimeline ?? getAdoTimeline)(run.runId),
            ] as const,
        ),
    ),
  );
  const artifactNamesByRun = new Map<string, string[]>();
  const artifactNamesForRun = async (runId: string): Promise<string[]> => {
    const existing = artifactNamesByRun.get(runId);
    if (existing) return existing;
    const names = await (
      dependencies.listArtifactNames ?? listAdoArtifactNames
    )(runId);
    artifactNamesByRun.set(runId, names);
    return names;
  };
  // Repeat live levels so a newly registered Condition can observe them, but
  // emit terminal levels only on transition. Replaying the latest 100 terminal
  // runs on every pulse previously flooded the control path.
  for (const observed of adoRuns) {
    if (
      shouldEmitPipelineLevel({
        run: observed,
        priorFingerprint: priorAdoFingerprints[observed.runId],
      })
    ) {
      ctx.emit(pipelineLevelEvent(observed));
    }
  }

  let overdueQueues = 0;
  for (const observed of adoRuns) {
    if (overdueQueueRunIds.has(observed.runId)) continue;
    const timeline = timelinesByRun.get(observed.runId) ?? [];
    const event = pipelineQueueOverdueEvent(observed, Date.now(), timeline);
    if (!event) continue;
    ctx.emit(event);
    overdueQueueRunIds.add(observed.runId);
    overdueQueues += 1;
  }

  let downloadedArtifacts = 0;
  let observedFailures = 0;
  let observedEarlyNonpassing = 0;
  const liveProgressFingerprints = {
    ...(prior.liveProgressFingerprints ?? {}),
  };
  const previouslyTrackedRunIds = new Set(prior.trackedRunIds ?? []);
  const terminalArtifactAttempts = {
    ...(prior.terminalArtifactAttempts ?? {}),
  };
  const terminalArtifactUnavailable = {
    ...(prior.terminalArtifactUnavailable ?? {}),
  };
  const pendingTerminalArtifactRunIds = new Set([
    ...Object.keys(terminalArtifactAttempts),
    ...registrationRunIds,
  ]);
  const artifactRuns = artifactRunCandidates({
    runs: adoRuns,
    previouslyTrackedRunIds,
    pendingTerminalArtifactRunIds,
    terminalArtifactUnavailableRunIds: new Set(
      Object.keys(terminalArtifactUnavailable),
    ),
    priorFingerprints: priorAdoFingerprints,
    observedArtifacts,
  });
  for (const observed of artifactRuns) {
    for (const event of newPipelineTestNonpassingEvents(
      observed,
      timelineSpecProgress(timelinesByRun.get(observed.runId) ?? []).filter(
        (progress) => progress.runId === observed.runId,
      ),
      liveProgressFingerprints,
    )) {
      ctx.emit(event);
      observedEarlyNonpassing += 1;
    }
    const availableNames = await artifactNamesForRun(observed.runId);
    if (availableNames.includes("plan-inputs")) {
      const planKey = artifactKey(observed.runId, "plan-inputs");
      const planRoot = ctx.appPath(
        `.state/watchers/aks-pipeline-artifacts/${observed.runId}/plan-inputs`,
      );
      const recordedPlanRoot = observedArtifacts[planKey];
      const planWasReady = Boolean(
        (recordedPlanRoot && planDirectoryReady(recordedPlanRoot)) ||
        planDirectoryReady(planRoot),
      );
      if (
        !(recordedPlanRoot && planDirectoryReady(recordedPlanRoot)) &&
        !planDirectoryReady(planRoot) &&
        downloadedArtifacts < MAX_PROGRESS_ARTIFACTS_PER_SCAN &&
        (await (dependencies.downloadArtifact ?? downloadAdoArtifact)(
          observed.runId,
          "plan-inputs",
          planRoot,
          planDirectoryReady,
        ))
      ) {
        downloadedArtifacts += 1;
      }
      if (planDirectoryReady(planRoot)) {
        observedArtifacts[planKey] = planRoot;
        if (!planWasReady) {
          ctx.emit(
            materializedArtifactEvent(observed, "plan-inputs", planRoot),
          );
        }
      }
      const reportPath = admissionReportPath(planRoot);
      const admissionKey = artifactKey(
        observed.runId,
        "live-admission-exclusions",
      );
      if (reportPath && !observedArtifacts[admissionKey]) {
        if (shouldEmitMasterValidationFailure(observed)) {
          for (const failure of failureObservationsFromAdmissionReport({
            root: planRoot,
            pipelineRunId: observed.runId,
            sourceBranch: observed.sourceBranch ?? "",
            sourceCommit: observed.sourceVersion ?? "",
          })) {
            ctx.emit(pipelineFailureEvent(failure));
            observedFailures += 1;
          }
        }
        observedArtifacts[admissionKey] = reportPath;
      }
    }
    const names = availableNames
      .filter((name) => /^slice-\d+-test-results$/.test(name))
      .sort()
      .reverse();
    let attemptedResultArtifactDownload = false;
    let materializedResultArtifact = false;
    for (const artifactName of names) {
      const key = artifactKey(observed.runId, artifactName);
      const root = ctx.appPath(
        `.state/watchers/aks-pipeline-artifacts/${observed.runId}/${artifactName}`,
      );
      const recordedRoot = observedArtifacts[key];
      if (recordedRoot && artifactDirectoryReady(recordedRoot)) continue;
      if (!artifactDirectoryReady(root)) {
        if (downloadedArtifacts >= MAX_PROGRESS_ARTIFACTS_PER_SCAN) continue;
        attemptedResultArtifactDownload = true;
        if (
          !(await (dependencies.downloadArtifact ?? downloadAdoArtifact)(
            observed.runId,
            artifactName,
            root,
          ))
        )
          continue;
        downloadedArtifacts += 1;
        materializedResultArtifact = true;
      }
      observedArtifacts[key] = root;
      ctx.emit(materializedArtifactEvent(observed, artifactName, root));
      for (const observation of specObservationsFromArtifact({
        root,
        pipelineRunId: observed.runId,
        sourceBranch: observed.sourceBranch ?? "",
        sourceCommit: observed.sourceVersion ?? "",
        artifactName,
      })) {
        ctx.emit(pipelineSpecEvent(observation));
      }
      for (const observation of nodeImagePublicationObservationsFromArtifact({
        root,
        pipelineRunId: observed.runId,
        sourceBranch: observed.sourceBranch ?? "",
        sourceCommit: observed.sourceVersion ?? "",
        artifactName,
      })) {
        ctx.emit(nodeImagePublicationEvent(observation));
      }
      if (shouldEmitMasterValidationFailure(observed)) {
        for (const failure of failureObservationsFromArtifact({
          root,
          pipelineRunId: observed.runId,
          sourceBranch: observed.sourceBranch ?? "",
          sourceCommit: observed.sourceVersion ?? "",
          artifactName,
        })) {
          ctx.emit(pipelineFailureEvent(failure));
          observedFailures += 1;
        }
      }
    }
    const readyRoots = names.flatMap((artifactName) => {
      const root = observedArtifacts[artifactKey(observed.runId, artifactName)];
      return root && artifactDirectoryReady(root)
        ? [{ artifactName, root }]
        : [];
    });
    const planRoot =
      observedArtifacts[artifactKey(observed.runId, "plan-inputs")];
    const admissionFailures = planRoot
      ? failureObservationsFromAdmissionReport({
          root: planRoot,
          pipelineRunId: observed.runId,
          sourceBranch: observed.sourceBranch ?? "",
          sourceCommit: observed.sourceVersion ?? "",
        })
      : [];
    const artifactObservations = readyRoots.flatMap(({ artifactName, root }) =>
      specObservationsFromArtifact({
        root,
        pipelineRunId: observed.runId,
        sourceBranch: observed.sourceBranch ?? "",
        sourceCommit: observed.sourceVersion ?? "",
        artifactName,
      }),
    );
    const artifactFailures = readyRoots.flatMap(({ artifactName, root }) =>
      failureObservationsFromArtifact({
        root,
        pipelineRunId: observed.runId,
        sourceBranch: observed.sourceBranch ?? "",
        sourceCommit: observed.sourceVersion ?? "",
        artifactName,
      }),
    );
    const noVerdictFailure = masterValidationNoVerdictFailure({
      pipelineRunId: observed.runId,
      sourceBranch: observed.sourceBranch ?? "",
      sourceCommit: observed.sourceVersion ?? "",
      status: observed.status,
      result: observed.result,
      progressive: observed.progressive,
      artifactsReady: names.length > 0 && readyRoots.length === names.length,
      observedVerdictCount: artifactObservations.length,
      observedFailureCount: admissionFailures.length + artifactFailures.length,
    });
    if (noVerdictFailure) {
      ctx.emit(pipelineFailureEvent(noVerdictFailure));
      observedFailures += 1;
    }
    const expectedResultArtifactNames = [
      ...new Set([
        ...observed.artifacts.filter((name) =>
          /^slice-\d+-test-results$/.test(name),
        ),
        ...names.filter((name) => /^slice-\d+-test-results$/.test(name)),
      ]),
    ];
    const terminalArtifactsMissing =
      ["completed", "canceled"].includes(observed.status) &&
      ((expectedResultArtifactNames.length === 0 &&
        pendingTerminalArtifactRunIds.has(observed.runId)) ||
        expectedResultArtifactNames.some((artifactName) => {
          const root =
            observedArtifacts[artifactKey(observed.runId, artifactName)];
          return !root || !artifactDirectoryReady(root);
        }));
    if (terminalArtifactsMissing) {
      const countFailedAttempt =
        expectedResultArtifactNames.length === 0 ||
        attemptedResultArtifactDownload;
      if (materializedResultArtifact) {
        delete terminalArtifactAttempts[observed.runId];
        pendingTerminalArtifactRunIds.add(observed.runId);
        continue;
      }
      if (!countFailedAttempt) {
        pendingTerminalArtifactRunIds.add(observed.runId);
        continue;
      }
      const attempts = (terminalArtifactAttempts[observed.runId] ?? 0) + 1;
      terminalArtifactAttempts[observed.runId] = attempts;
      if (attempts >= MAX_TERMINAL_ARTIFACT_ATTEMPTS) {
        const dispositionFingerprint = `${observed.fingerprint}:${expectedResultArtifactNames.join(",")}`;
        if (
          terminalArtifactUnavailable[observed.runId] !== dispositionFingerprint
        ) {
          ctx.emit(
            terminalArtifactUnavailableEvent({
              run: observed,
              artifactNames: expectedResultArtifactNames,
              attempts,
            }),
          );
          ctx.emit(
            pipelineFailureEvent({
              pipelineRunId: observed.runId,
              sourceBranch: observed.sourceBranch ?? "",
              sourceCommit: observed.sourceVersion ?? "",
              artifactName: expectedResultArtifactNames.join(","),
              artifactPath: `ado://build/${observed.runId}/artifacts`,
              sliceId: "artifact-materialization",
              specId: "pipeline.master-validation.artifact-materialization",
              status: "error",
              category: "terminal_artifact_unavailable",
              reason: `Azure DevOps advertised ${expectedResultArtifactNames.join(", ")} for terminal run ${observed.runId}, but the watcher could not materialize them after ${attempts} bounded attempts. This is an evidence-carrier disposition, not an AKS product verdict.`,
              fingerprint: createHash("sha256")
                .update(dispositionFingerprint)
                .digest("hex")
                .slice(0, 20),
            }),
          );
          observedFailures += 1;
          terminalArtifactUnavailable[observed.runId] = dispositionFingerprint;
        }
        delete terminalArtifactAttempts[observed.runId];
        pendingTerminalArtifactRunIds.delete(observed.runId);
      } else {
        pendingTerminalArtifactRunIds.add(observed.runId);
      }
    } else {
      delete terminalArtifactAttempts[observed.runId];
      pendingTerminalArtifactRunIds.delete(observed.runId);
    }
  }

  const trackedRunIds = retainedTrackedRunIds({
    priorRunIds: prior.trackedRunIds ?? [],
    runs: adoRuns,
    pendingTerminalArtifactRunIds,
    registeredRunIds: registrationRunIds,
  });
  const retainedProgressRunIds = new Set(trackedRunIds);
  const retainedLiveProgressFingerprints = Object.fromEntries(
    Object.entries(liveProgressFingerprints)
      .filter(([key]) => retainedProgressRunIds.has(key.split(":", 1)[0] ?? ""))
      .slice(-1_000),
  );
  saveState(statePath, {
    schemaVersion: WATCHER_SCHEMA_VERSION,
    fingerprints,
    localRunStates,
    localCompletionFingerprints,
    adoFingerprints,
    trackedRunIds,
    observedArtifacts,
    terminalArtifactAttempts,
    terminalArtifactUnavailable,
    overdueQueueRunIds: [...overdueQueueRunIds].slice(-100),
    liveProgressFingerprints: retainedLiveProgressFingerprints,
    checkedAt,
  });
  acknowledgeTrackedPipelineRunIds(
    ctx.appPath("."),
    adoRuns.map((run) => run.runId),
  );

  const latestProgressiveRun = adoRuns
    .filter((run) => run.progressive)
    .sort((left, right) => Number(right.runId) - Number(left.runId))[0];
  if (latestProgressiveRun) {
    const planRoot =
      observedArtifacts[
        artifactKey(latestProgressiveRun.runId, "plan-inputs")
      ] ?? null;
    const artifactRoots = Object.fromEntries(
      Object.entries(observedArtifacts)
        .filter(([key, root]) => {
          return (
            key.startsWith(`${latestProgressiveRun.runId}:slice-`) &&
            artifactDirectoryReady(root)
          );
        })
        .map(([key, root]) => [key.slice(key.indexOf(":") + 1), root]),
    );
    saveProgress(
      ctx.appPath(".state/watchers/aks-pipeline-progress.json"),
      buildMasterValidationProgress({
        run: latestProgressiveRun,
        planRoot,
        artifactRoots,
        preservedVerdicts: preservedSpecVerdicts(
          ctx.appPath(".state/spec-loop/state.json"),
        ),
        timelineSlices: timelineSliceProgress(
          timelinesByRun.get(latestProgressiveRun.runId) ?? [],
        ),
        timelineProgress: timelineSpecProgress(
          timelinesByRun.get(latestProgressiveRun.runId) ?? [],
        ).filter((progress) => progress.runId === latestProgressiveRun.runId),
        checkedAt,
      }),
    );
  }

  if (!hasPriorState && adoRuns.length === 0) {
    return ctx.noop(
      `Pipeline watcher initialized from ${results.length} local result(s) and no ADO runs.`,
    );
  }

  const changed = results
    .filter(
      (result) =>
        priorFingerprints?.[result.runId] !== result.fingerprint ||
        priorLocalRunStates?.[result.runId] !== result.run.state,
    )
    .slice(0, MAX_EVENTS_PER_SCAN);
  let localResults = 0;
  for (const observed of changed) {
    if (!localResultReadyForCompletion(observed)) continue;
    if (
      priorLocalCompletionFingerprints?.[observed.runId] ===
      observed.fingerprint
    ) {
      localCompletionFingerprints[observed.runId] = observed.fingerprint;
      continue;
    }
    ctx.emit(localResultCompletionEvent(observed));
    localCompletionFingerprints[observed.runId] = observed.fingerprint;
    localResults += 1;
  }

  const changedAdo = adoRuns
    .filter((run) => priorAdoFingerprints?.[run.runId] !== run.fingerprint)
    .slice(0, MAX_EVENTS_PER_SCAN);
  for (const observed of changedAdo) {
    const withArtifacts =
      observed.status === "completed"
        ? {
            ...observed,
            artifacts: await artifactNamesForRun(observed.runId),
          }
        : observed;
    for (const event of pipelineObservationEvents(withArtifacts))
      ctx.emit(event);
  }

  const observedCount =
    localResults +
    changedAdo.length +
    downloadedArtifacts +
    observedFailures +
    observedEarlyNonpassing +
    overdueQueues;
  return observedCount > 0
    ? {
        observed: observedCount,
        localResults,
        adoRuns: changedAdo.length,
        downloadedArtifacts,
        observedFailures,
        observedEarlyNonpassing,
        overdueQueues,
      }
    : ctx.noop(
        `Pipeline state unchanged across ${results.length} local result(s) and ${adoRuns.length} ADO run(s).`,
      );
}

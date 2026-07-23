import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
import type { ProjectAppContext, ProjectAppEvent } from "@may-agent/sdk";

type PipelineWatcherState = {
  schemaVersion?: string;
  fingerprints?: Record<string, string>;
  adoFingerprints?: Record<string, string>;
  trackedRunIds?: string[];
  observedArtifacts?: Record<string, string>;
  overdueQueueRunIds?: string[];
  checkedAt?: string;
};

type PipelineResult = {
  runId?: unknown;
  planId?: unknown;
  status?: unknown;
  counts?: unknown;
  specResults?: unknown;
  updatedAt?: unknown;
};

type ObservedResult = {
  runId: string;
  path: string;
  fingerprint: string;
  mtimeMs: number;
  result: PipelineResult;
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

const MAX_RESULTS_PER_SCAN = 200;
const MAX_EVENTS_PER_SCAN = 20;
const MAX_ADO_RUNS_PER_SCAN = 100;
const MAX_PROGRESS_ARTIFACTS_PER_SCAN = 3;
export const MASTER_VALIDATION_QUEUE_OVERDUE_MS = 90 * 60 * 1_000;
const ADO_ORGANIZATION = "https://dev.azure.com/msazure";
const ADO_PROJECT = "CloudNativeCompute";
const ADO_PIPELINE_ID = "467665";
const WATCHER_SCHEMA_VERSION = "7";
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
    };
  } catch {
    return null;
  }
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

function isProgressiveMasterValidationRun(run: AdoRun): boolean {
  const parameters = record(run.templateParameters);
  if (text(parameters.feature_set) !== "master-validation") return false;
  const rawMetadata = text(parameters.metadata);
  if (!rawMetadata) return true;
  try {
    return (
      text(record(JSON.parse(rawMetadata)).purpose) ===
      "scheduled-master-validation"
    );
  } catch {
    return false;
  }
}

function runAzJson(args: string[]): unknown {
  const result = spawnSync(AZ_CLI, args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      AZURE_CONFIG_DIR: process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
    },
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout || "null");
  } catch {
    return null;
  }
}

function adoRunFromApi(run: AdoRun): ObservedAdoRun | null {
  const runId = String(run.id ?? "").trim();
  if (!runId) return null;
  const status = String(run.status ?? "unknown");
  const result = String(run.result ?? status);
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
    progressive: isProgressiveMasterValidationRun(run),
  };
  return {
    ...observed,
    fingerprint: createHash("sha256")
      .update(stableJson(observed))
      .digest("hex"),
  };
}

function getAdoRun(runId: string): ObservedAdoRun | null {
  const run = runAzJson([
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

function listAdoArtifactNames(runId: string): string[] {
  const artifacts = runAzJson([
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

export function scanAdoPipelineRuns(
  trackedRunIds: string[] = [],
): ObservedAdoRun[] {
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
  const listed = [listRuns(), listRuns("inProgress"), listRuns("notStarted")]
    .filter(Array.isArray)
    .flat() as AdoRun[];
  const observed = listed.length
    ? listed
        .map((run: AdoRun): ObservedAdoRun | null => adoRunFromApi(run))
        .filter((run): run is ObservedAdoRun => run !== null)
    : [];

  const byId = new Map(observed.map((run) => [run.runId, run]));
  for (const runId of trackedRunIds.slice(-100)) {
    if (byId.has(runId)) continue;
    const run = getAdoRun(runId);
    if (run) byId.set(runId, run);
  }
  return [...byId.values()];
}

function artifactKey(runId: string, artifactName: string): string {
  return `${runId}:${artifactName}`;
}

function downloadAdoArtifact(
  runId: string,
  artifactName: string,
  destination: string,
): boolean {
  const temporary = `${destination}.partial-${process.pid}-${Date.now()}`;
  rmSync(temporary, { recursive: true, force: true });
  mkdirSync(temporary, { recursive: true });
  const result = spawnSync(
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
        AZURE_CONFIG_DIR: process.env.AZURE_CONFIG_DIR || "/app/.state/.azure",
      },
    },
  );
  if (result.status !== 0 || !artifactDirectoryReady(temporary)) {
    rmSync(temporary, { recursive: true, force: true });
    return false;
  }
  rmSync(destination, { recursive: true, force: true });
  renameSync(temporary, destination);
  return true;
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
        const status = text(spec.status) || "unknown";
        if (
          !specId ||
          ["pass", "passed", "skipped"].includes(status.toLowerCase())
        )
          continue;
        const category = text(spec.category) || "unknown";
        const reason = summarizedFailureReason(
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
          artifactPath: path,
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
        observations.push({
          pipelineRunId: input.pipelineRunId,
          sourceBranch: input.sourceBranch,
          sourceCommit: input.sourceCommit,
          artifactName: input.artifactName,
          artifactPath: path,
          sliceId,
          specId,
          status: text(spec.status) || "unknown",
          category: text(spec.category) || "unknown",
          reason: summarizedFailureReason(
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
): ProjectAppEvent {
  const data = { ...observation };
  return {
    type: "pipeline.spec.observed",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...data,
    data,
  };
}

export function pipelineFailureEvent(
  failure: PipelineFailureObservation,
): ProjectAppEvent {
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

function pipelineFactBase(observed: {
  runId: string;
  status: string;
  result: string;
  sourceBranch?: string | null;
  sourceVersion?: string | null;
  finishTime?: string | null;
  queueTime?: string | null;
  artifacts?: string[];
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
  };
}

export function pipelineQueueOverdueEvent(
  observed: ObservedAdoRun,
  nowMs = Date.now(),
): ProjectAppEvent | null {
  if (
    !observed.progressive ||
    observed.status !== "notStarted" ||
    !observed.queueTime
  ) {
    return null;
  }
  const queuedAtMs = Date.parse(observed.queueTime);
  if (
    !Number.isFinite(queuedAtMs) ||
    nowMs - queuedAtMs < MASTER_VALIDATION_QUEUE_OVERDUE_MS
  ) {
    return null;
  }
  const base = pipelineFactBase(observed);
  const queueAgeMs = Math.max(0, nowMs - queuedAtMs);
  return {
    type: "pipeline.queue.overdue",
    source: "aks-pipeline-watcher",
    target: { project: "aks-rp-e2e" },
    ...base,
    queueAgeMs,
    data: { ...base, queueAgeMs },
  };
}

export function shouldScanProgressiveArtifacts(input: {
  run: ObservedAdoRun;
  wasTracked: boolean;
  priorFingerprint?: string;
}): boolean {
  if (!input.run.progressive) return false;
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

export function pipelineObservationEvents(
  observed: ObservedAdoRun,
): ProjectAppEvent[] {
  const base = pipelineFactBase(observed);
  const events: ProjectAppEvent[] = [];

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

  for (const artifact of observed.artifacts) {
    events.push({
      type: "pipeline-artifact.available",
      source: "aks-pipeline-watcher",
      target: { project: "aks-rp-e2e" },
      ...base,
      artifactName: artifact,
      data: { ...base, artifactName: artifact },
    });
  }
  return events;
}

export function pipelineLevelEvent(observed: ObservedAdoRun): ProjectAppEvent {
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

/** Observe domain pipeline artifacts and emit facts; never reads or mutates task state. */
export async function observeAksPipelines(
  ctx: ProjectAppContext,
): Promise<unknown> {
  const statePath = ctx.appPath(".state/watchers/aks-pipeline.json");
  const prior = readState(statePath);
  const hasPriorState = Boolean(
    prior.schemaVersion || prior.fingerprints || prior.adoFingerprints,
  );
  const priorFingerprints = prior.fingerprints ?? {};
  const priorAdoFingerprints = prior.adoFingerprints ?? {};
  const observedArtifacts = { ...(prior.observedArtifacts ?? {}) };
  const overdueQueueRunIds = new Set(prior.overdueQueueRunIds ?? []);
  const results = scanPipelineResults(
    ctx.appPath("../aks-rp-e2e/runs/test-results"),
  );
  const fingerprints = Object.fromEntries(
    results.map((result) => [result.runId, result.fingerprint]),
  );
  const adoRuns = scanAdoPipelineRuns(prior.trackedRunIds ?? []);
  const adoFingerprints = Object.fromEntries(
    adoRuns.map((run) => [run.runId, run.fingerprint]),
  );
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
    const event = pipelineQueueOverdueEvent(observed);
    if (!event) continue;
    ctx.emit(event);
    overdueQueueRunIds.add(observed.runId);
    overdueQueues += 1;
  }

  let downloadedArtifacts = 0;
  let observedFailures = 0;
  const previouslyTrackedRunIds = new Set(prior.trackedRunIds ?? []);
  const pendingTerminalArtifactRunIds = new Set<string>();
  const progressiveRuns = adoRuns.filter((run) =>
    shouldScanProgressiveArtifacts({
      run,
      wasTracked: previouslyTrackedRunIds.has(run.runId),
      priorFingerprint: priorAdoFingerprints[run.runId],
    }),
  );
  for (const observed of progressiveRuns) {
    const names = listAdoArtifactNames(observed.runId)
      .filter((name) => /^slice-\d+-test-results$/.test(name))
      .sort()
      .reverse();
    for (const artifactName of names) {
      const key = artifactKey(observed.runId, artifactName);
      const root = ctx.appPath(
        `.state/watchers/aks-pipeline-artifacts/${observed.runId}/${artifactName}`,
      );
      const recordedRoot = observedArtifacts[key];
      if (recordedRoot && artifactDirectoryReady(recordedRoot)) continue;
      if (!artifactDirectoryReady(root)) {
        if (downloadedArtifacts >= MAX_PROGRESS_ARTIFACTS_PER_SCAN) continue;
        if (!downloadAdoArtifact(observed.runId, artifactName, root)) continue;
        downloadedArtifacts += 1;
      }
      observedArtifacts[key] = root;
      const artifactEvent = {
        type: "pipeline-artifact.available",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...pipelineFactBase(observed),
        artifactName,
        artifactPath: root,
        data: {
          ...pipelineFactBase(observed),
          artifactName,
          artifactPath: root,
        },
      } satisfies ProjectAppEvent;
      ctx.emit(artifactEvent);
      for (const observation of specObservationsFromArtifact({
        root,
        pipelineRunId: observed.runId,
        sourceBranch: observed.sourceBranch ?? "",
        sourceCommit: observed.sourceVersion ?? "",
        artifactName,
      })) {
        ctx.emit(pipelineSpecEvent(observation));
      }
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
    if (
      ["completed", "canceled"].includes(observed.status) &&
      names.some((artifactName) => {
        const root =
          observedArtifacts[artifactKey(observed.runId, artifactName)];
        return !root || !artifactDirectoryReady(root);
      })
    ) {
      pendingTerminalArtifactRunIds.add(observed.runId);
    }
  }

  const currentById = new Map(adoRuns.map((run) => [run.runId, run]));
  const trackedRunIds = [
    ...new Set([
      ...(prior.trackedRunIds ?? []).filter((runId) => {
        const current = currentById.get(runId);
        return (
          !current ||
          !["completed", "canceled"].includes(current.status) ||
          pendingTerminalArtifactRunIds.has(runId)
        );
      }),
      ...adoRuns
        .filter(
          (run) =>
            run.progressive && !["completed", "canceled"].includes(run.status),
        )
        .map((run) => run.runId),
      ...pendingTerminalArtifactRunIds,
    ]),
  ];
  saveState(statePath, {
    schemaVersion: WATCHER_SCHEMA_VERSION,
    fingerprints,
    adoFingerprints,
    trackedRunIds,
    observedArtifacts,
    overdueQueueRunIds: [...overdueQueueRunIds].slice(-100),
    checkedAt: new Date().toISOString(),
  });

  if (!hasPriorState && adoRuns.length === 0) {
    return ctx.noop(
      `Pipeline watcher initialized from ${results.length} local result(s) and no ADO runs.`,
    );
  }

  const changed = results
    .filter(
      (result) => priorFingerprints?.[result.runId] !== result.fingerprint,
    )
    .slice(0, MAX_EVENTS_PER_SCAN);
  for (const observed of changed) {
    const status = String(observed.result.status ?? "unknown");
    const base = pipelineFactBase({
      runId: observed.runId,
      status,
      result: status,
    });
    ctx.emit({
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
      },
    });
  }

  const changedAdo = adoRuns
    .filter((run) => priorAdoFingerprints?.[run.runId] !== run.fingerprint)
    .slice(0, MAX_EVENTS_PER_SCAN);
  for (const observed of changedAdo) {
    const withArtifacts =
      observed.status === "completed"
        ? { ...observed, artifacts: listAdoArtifactNames(observed.runId) }
        : observed;
    for (const event of pipelineObservationEvents(withArtifacts))
      ctx.emit(event);
  }

  const observedCount =
    changed.length +
    changedAdo.length +
    downloadedArtifacts +
    observedFailures +
    overdueQueues;
  return observedCount > 0
    ? {
        observed: observedCount,
        localResults: changed.length,
        adoRuns: changedAdo.length,
        downloadedArtifacts,
        observedFailures,
        overdueQueues,
      }
    : ctx.noop(
        `Pipeline state unchanged across ${results.length} local result(s) and ${adoRuns.length} ADO run(s).`,
      );
}

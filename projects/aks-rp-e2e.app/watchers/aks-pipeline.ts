import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { ProjectAppContext, ProjectAppEvent } from "@may-agent/sdk";

type PipelineWatcherState = {
  fingerprints?: Record<string, string>;
  adoFingerprints?: Record<string, string>;
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
};

type ObservedAdoRun = {
  runId: string;
  fingerprint: string;
  status: string;
  result: string;
  sourceBranch: string | null;
  sourceVersion: string | null;
  finishTime: string | null;
  artifacts: string[];
};

const MAX_RESULTS_PER_SCAN = 200;
const MAX_EVENTS_PER_SCAN = 20;
const MAX_ADO_RUNS_PER_SCAN = 25;
const ADO_ORGANIZATION = "https://dev.azure.com/msazure";
const ADO_PROJECT = "CloudNativeCompute";
const ADO_PIPELINE_ID = "467665";
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

function runAzJson(args: string[]): unknown {
  const result = spawnSync(AZ_CLI, args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout || "null");
  } catch {
    return null;
  }
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

export function scanAdoPipelineRuns(): ObservedAdoRun[] {
  if (process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO === "0") return [];
  const runs = runAzJson([
    "pipelines",
    "runs",
    "list",
    "--organization",
    ADO_ORGANIZATION,
    "--project",
    ADO_PROJECT,
    "--pipeline-ids",
    ADO_PIPELINE_ID,
    "--top",
    String(MAX_ADO_RUNS_PER_SCAN),
    "-o",
    "json",
  ]);
  if (!Array.isArray(runs)) return [];

  return runs
    .map((run: AdoRun): ObservedAdoRun | null => {
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
        finishTime: typeof run.finishTime === "string" ? run.finishTime : null,
        artifacts: status === "completed" ? listAdoArtifactNames(runId) : [],
      };
      return {
        ...observed,
        fingerprint: createHash("sha256")
          .update(stableJson(observed))
          .digest("hex"),
      };
    })
    .filter((run): run is ObservedAdoRun => run !== null);
}

function pipelineFactBase(observed: {
  runId: string;
  status: string;
  result: string;
  sourceBranch?: string | null;
  sourceVersion?: string | null;
  finishTime?: string | null;
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
    ...(observed.artifacts ? { artifacts: observed.artifacts } : {}),
  };
}

export function pipelineObservationEvents(
  observed: ObservedAdoRun,
): ProjectAppEvent[] {
  const base = pipelineFactBase(observed);
  const events: ProjectAppEvent[] = [
    {
      type: "project.test_run.completed",
      source: "aks-pipeline-watcher",
      target: { project: "aks-rp-e2e" },
      ...base,
      data: base,
    },
  ];

  if (observed.status === "completed") {
    events.push(
      {
        type: "status-equals",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...base,
        status: "completed",
        data: { ...base, status: "completed" },
      },
      {
        type: "pipeline-run-state",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...base,
        status: "completed",
        data: { ...base, status: "completed" },
      },
      {
        type: "pipeline-run",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...base,
        status: "completed",
        artifactsInclude: observed.artifacts,
        data: {
          ...base,
          status: "completed",
          artifactsInclude: observed.artifacts,
        },
      },
    );
  }

  for (const artifact of observed.artifacts) {
    events.push(
      {
        type: "artifact-present",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...base,
        artifactName: artifact,
        data: { ...base, artifactName: artifact },
      },
      {
        type: "pipeline-artifact-available",
        source: "aks-pipeline-watcher",
        target: { project: "aks-rp-e2e" },
        ...base,
        artifact,
        data: { ...base, artifact },
      },
    );
  }
  return events;
}

/** Observe domain pipeline artifacts and emit facts; never reads or mutates task state. */
export async function observeAksPipelines(
  ctx: ProjectAppContext,
): Promise<unknown> {
  const statePath = ctx.appPath(".state/watchers/aks-pipeline.json");
  const prior = readState(statePath);
  const results = scanPipelineResults(
    ctx.appPath("../aks-rp-e2e/runs/test-results"),
  );
  const fingerprints = Object.fromEntries(
    results.map((result) => [result.runId, result.fingerprint]),
  );
  const adoRuns = scanAdoPipelineRuns();
  const adoFingerprints = Object.fromEntries(
    adoRuns.map((run) => [run.runId, run.fingerprint]),
  );
  saveState(statePath, {
    fingerprints,
    adoFingerprints,
    checkedAt: new Date().toISOString(),
  });

  if (!prior.fingerprints && !prior.adoFingerprints) {
    return ctx.noop(
      `Pipeline watcher initialized from ${results.length} local result(s) and ${adoRuns.length} ADO run(s).`,
    );
  }

  const changed = results
    .filter(
      (result) => prior.fingerprints?.[result.runId] !== result.fingerprint,
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
    .filter((run) => prior.adoFingerprints?.[run.runId] !== run.fingerprint)
    .slice(0, MAX_EVENTS_PER_SCAN);
  for (const observed of changedAdo) {
    for (const event of pipelineObservationEvents(observed)) ctx.emit(event);
  }

  const observedCount = changed.length + changedAdo.length;
  return observedCount > 0
    ? {
        observed: observedCount,
        localResults: changed.length,
        adoRuns: changedAdo.length,
      }
    : ctx.noop(
        `Pipeline state unchanged across ${results.length} local result(s) and ${adoRuns.length} ADO run(s).`,
      );
}

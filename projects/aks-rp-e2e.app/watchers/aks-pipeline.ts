import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { ProjectAppContext } from "@may-agent/sdk";

type PipelineWatcherState = {
  fingerprints?: Record<string, string>;
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

const MAX_RESULTS_PER_SCAN = 200;
const MAX_EVENTS_PER_SCAN = 20;

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
  saveState(statePath, { fingerprints, checkedAt: new Date().toISOString() });

  if (!prior.fingerprints) {
    return ctx.noop(
      `Pipeline watcher initialized from ${results.length} current result(s).`,
    );
  }

  const changed = results
    .filter(
      (result) => prior.fingerprints?.[result.runId] !== result.fingerprint,
    )
    .slice(0, MAX_EVENTS_PER_SCAN);
  for (const observed of changed) {
    const status = String(observed.result.status ?? "unknown");
    ctx.emit({
      type: "project.test_run.completed",
      source: "aks-pipeline-watcher",
      target: { project: "aks-rp-e2e" },
      data: {
        project: "aks-rp-e2e",
        pipelineRunId: observed.runId,
        runId: observed.runId,
        planId: observed.result.planId ?? null,
        status,
        result: status,
        counts: observed.result.counts ?? {},
        specResults: observed.result.specResults ?? [],
        updatedAt: observed.result.updatedAt ?? null,
        artifact: observed.path,
      },
    });
  }
  return changed.length > 0
    ? { observed: changed.length }
    : ctx.noop(
        `Pipeline state unchanged across ${results.length} current result(s).`,
      );
}

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadSpecs } from "./spec-loop-store.ts";

export type MetricSample = {
  value: number;
  measuredAt: number;
  sampleSize?: number;
  note?: unknown;
};

export type FocusMetricId =
  | "aks-rp-e2e.run.live-started-24h"
  | "aks-rp-e2e.run.live-succeeded-24h"
  | "aks-rp-e2e.spec.unverified-count"
  | "aks-rp-e2e.spec.failed-count"
  | "aks-rp-e2e.model.unknown-path-count";

export type FocusMetricsSnapshot = {
  liveRunsStarted24h: number;
  liveRunsSucceeded24h: number;
  specUnverifiedCount: number;
  specFailedCount: number;
  unknownPathMetric: number;
};

type JsonRecord = Record<string, unknown>;

type RunResult = {
  status?: string;
  mode?: string;
  dryRun?: boolean;
  startedAt?: string;
  completedAt?: string;
  endedAt?: string;
  updatedAt?: string;
  target?: {
    surface?: string;
  } | null;
  probeEvidence?: {
    mode?: string;
    status?: string;
  } | null;
};

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function listFiles(
  root: string,
  predicate: (path: string) => boolean,
): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
      if (entry === ".git" || entry === "node_modules") continue;
      const path = join(dir, entry);
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        visit(path);
        continue;
      }
      if (stat.isFile() && predicate(path)) out.push(path);
    }
  };
  visit(root);
  return out;
}

/**
 * Pipeline downloads have one canonical aggregate result per slice beneath
 * <build>/<artifact>/runs/test-results/<run>. Match that exact shape so a
 * metric sample does not walk every retained artifact and nested probe file.
 */
export function listPipelineAggregateResults(root: string): string[] {
  if (!existsSync(root)) return [];
  return [
    ...new Bun.Glob("*/*/runs/test-results/*/result.json").scanSync({
      cwd: root,
      absolute: true,
      onlyFiles: true,
    }),
  ].sort((a, b) => a.localeCompare(b));
}

function normalizedStatus(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/_/g, "-");
}

function canonicalPathStatus(
  status: string,
): "pass" | "fail" | "blocked" | "draft" | "unknown" {
  if (
    status === "pass" ||
    status === "staging-pass" ||
    status === "existing-evidence-pass" ||
    status === "partial-pass"
  ) {
    return "pass";
  }
  if (
    status === "fail" ||
    status === "product-gap" ||
    status === "product-blocked" ||
    status === "diagnosed" ||
    status === "product_constraint" ||
    status === "product-constraint" ||
    status === "staging-fail"
  ) {
    return "fail";
  }
  if (
    status === "blocked" ||
    status === "blocked-infra" ||
    status === "environment-blocked" ||
    status === "environment" ||
    status === "execution-gated" ||
    status === "gated" ||
    status === "staging-blocked" ||
    status === "staging-gated" ||
    status === "staging-inconclusive" ||
    status === "test-methodology-gap" ||
    status === "blocked-runner-gap"
  ) {
    return "blocked";
  }
  if (
    status === "draft" ||
    status === "ready" ||
    status === "superseded" ||
    status === "deprecated"
  ) {
    return "draft";
  }
  return "unknown";
}

function modelUnknownPathCount(projectDir: string): MetricSample {
  const modelPath = join(projectDir, "model", "knowledge-map", "model.json");
  const model = readJson<{ featurePaths?: Array<{ status?: string }> }>(
    modelPath,
    {},
  );
  const featurePaths = model.featurePaths ?? [];
  const unknownPaths = featurePaths.filter(
    (path) => canonicalPathStatus(normalizedStatus(path.status)) === "unknown",
  );
  return {
    value: unknownPaths.length,
    measuredAt: Date.now(),
    sampleSize: featurePaths.length,
    note: {
      source: modelPath,
      canonicalStatus: "unknown",
    },
  };
}

function isVerifiedSpec(spec: {
  status?: string;
  specState?: string;
}): boolean {
  const status = normalizedStatus(spec.status);
  const state = normalizedStatus(spec.specState);
  return (
    status === "pass" &&
    ["verified", "validated", "resolved", "pass"].includes(state)
  );
}

function isReviewedExceptionSpec(spec: {
  status?: string;
  specState?: string;
  terminalDisposition?: boolean;
}): boolean {
  if (spec.terminalDisposition === true) return true;
  const statuses = [
    normalizedStatus(spec.status),
    normalizedStatus(spec.specState),
  ];
  return statuses.some((status) =>
    [
      "product-gap",
      "product-constraint",
      "environment",
      "environment-blocked",
      "blocked-infra",
      "deprecated",
      "product-deprecated",
      "reviewed-exception",
      "superseded",
      "out-of-scope",
    ].includes(status),
  );
}

function specMetrics(projectDir: string): {
  total: number;
  unverified: number;
  failed: number;
} {
  const specs = loadSpecs(projectDir);
  let unverified = 0;
  let failed = 0;

  for (const spec of specs) {
    const verified = isVerifiedSpec(spec);
    const reviewedException = !verified && isReviewedExceptionSpec(spec);
    const statuses = [
      normalizedStatus(spec.status),
      normalizedStatus(spec.specState),
    ];

    if (!verified && !reviewedException) unverified++;
    if (statuses.some((status) => status.startsWith("fail"))) failed++;
  }

  return { total: specs.length, unverified, failed };
}

function runResults(
  projectDir: string,
  appDir?: string,
  modifiedSince = 0,
): Array<RunResult & { path: string }> {
  const roots: Array<{ root: string; aggregateOnly?: boolean }> = [
    { root: join(projectDir, "runs", "executions") },
    { root: join(projectDir, "runs", "runs", "executions") },
    ...(appDir
      ? [
          {
            root: join(appDir, ".state", "watchers", "aks-pipeline-artifacts"),
            aggregateOnly: true,
          },
        ]
      : []),
  ];
  const seen = new Set<string>();
  return roots.flatMap(({ root, aggregateOnly }) =>
    (aggregateOnly
      ? listPipelineAggregateResults(root)
      : listFiles(root, (path) => path.endsWith("/result.json"))
    )
      .filter((path) => {
        if (seen.has(path)) return false;
        seen.add(path);
        return true;
      })
      // A result cannot describe a newly completed run if its durable file has
      // not changed. Keep one extra day of clock/extraction grace, then parse
      // only plausible candidates instead of every retained result body.
      .filter((path) => {
        try {
          const stat = statSync(path);
          return Math.max(stat.mtimeMs, stat.ctimeMs) >= modifiedSince;
        } catch {
          return false;
        }
      })
      .map((path) => ({ ...readJson<RunResult>(path, {}), path })),
  );
}

function isLiveRun(run: RunResult): boolean {
  return (
    run.dryRun === false ||
    run.mode === "execute" ||
    run.mode === "executing" ||
    run.probeEvidence?.mode === "execute" ||
    run.probeEvidence?.mode === "executing" ||
    run.probeEvidence?.mode === "cloud-execution" ||
    run.target?.surface === "live-azure-run"
  );
}

function runTime(run: RunResult): number | null {
  for (const value of [
    run.completedAt,
    run.endedAt,
    run.updatedAt,
    run.startedAt,
  ]) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function liveRuns24h(
  projectDir: string,
  appDir?: string,
): Array<RunResult & { path: string }> {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const candidateSince = dayAgo - 24 * 60 * 60 * 1000;
  return runResults(projectDir, appDir, candidateSince).filter((run) => {
    if (!isLiveRun(run)) return false;
    const ts = runTime(run);
    return ts != null && ts >= dayAgo;
  });
}

export function sampleFocusMetric(
  projectDir: string,
  metricId: FocusMetricId,
  options: { appDir?: string } = {},
): MetricSample {
  return sampleFocusMetricBatch(projectDir, [metricId], options)[metricId]!;
}

/** Measure one coherent focus snapshot without rescanning shared sources. */
export function sampleFocusMetricBatch(
  projectDir: string,
  metricIds: readonly FocusMetricId[],
  options: { appDir?: string } = {},
): Partial<Record<FocusMetricId, MetricSample>> {
  const measuredAt = Date.now();
  let specs: ReturnType<typeof specMetrics> | undefined;
  let live: ReturnType<typeof liveRuns24h> | undefined;
  const specSnapshot = () => (specs ??= specMetrics(projectDir));
  const liveSnapshot = () => (live ??= liveRuns24h(projectDir, options.appDir));

  return Object.fromEntries(
    [...new Set(metricIds)].map((metricId) => {
      switch (metricId) {
        case "aks-rp-e2e.model.unknown-path-count": {
          const sample = modelUnknownPathCount(projectDir);
          return [metricId, { ...sample, measuredAt }];
        }
        case "aks-rp-e2e.spec.unverified-count": {
          const metrics = specSnapshot();
          return [
            metricId,
            {
              value: metrics.unverified,
              measuredAt,
              sampleSize: metrics.total,
              note: { source: "feature-owned spec catalog" },
            },
          ];
        }
        case "aks-rp-e2e.spec.failed-count": {
          const metrics = specSnapshot();
          return [
            metricId,
            {
              value: metrics.failed,
              measuredAt,
              sampleSize: metrics.total,
              note: { source: "feature-owned spec catalog" },
            },
          ];
        }
        case "aks-rp-e2e.run.live-started-24h": {
          const runs = liveSnapshot();
          return [
            metricId,
            {
              value: runs.length,
              measuredAt,
              sampleSize: runs.length,
              note: {
                source: "project executions and app pipeline artifacts",
                samplePaths: runs.slice(0, 5).map((run) => run.path),
              },
            },
          ];
        }
        case "aks-rp-e2e.run.live-succeeded-24h": {
          const runs = liveSnapshot();
          const succeeded = runs.filter(
            (run) => normalizedStatus(run.status) === "passed",
          );
          return [
            metricId,
            {
              value: succeeded.length,
              measuredAt,
              sampleSize: runs.length,
              note: {
                source: "project executions and app pipeline artifacts",
                samplePaths: succeeded.slice(0, 5).map((run) => run.path),
              },
            },
          ];
        }
      }
    }),
  );
}

export function sampleFocusMetrics(
  projectDir: string,
  options: { appDir?: string } = {},
): FocusMetricsSnapshot {
  const samples = sampleFocusMetricBatch(
    projectDir,
    [
      "aks-rp-e2e.run.live-started-24h",
      "aks-rp-e2e.run.live-succeeded-24h",
      "aks-rp-e2e.spec.unverified-count",
      "aks-rp-e2e.spec.failed-count",
      "aks-rp-e2e.model.unknown-path-count",
    ],
    options,
  );
  return {
    liveRunsStarted24h: samples["aks-rp-e2e.run.live-started-24h"]!.value,
    liveRunsSucceeded24h: samples["aks-rp-e2e.run.live-succeeded-24h"]!.value,
    specUnverifiedCount: samples["aks-rp-e2e.spec.unverified-count"]!.value,
    specFailedCount: samples["aks-rp-e2e.spec.failed-count"]!.value,
    unknownPathMetric: samples["aks-rp-e2e.model.unknown-path-count"]!.value,
  };
}

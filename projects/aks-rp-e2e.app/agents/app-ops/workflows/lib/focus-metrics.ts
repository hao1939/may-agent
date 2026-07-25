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
    listFiles(root, (path) => {
      if (!path.endsWith("/result.json")) return false;
      if (!aggregateOnly) return true;
      return /\/runs\/test-results\/[^/]+\/result\.json$/.test(path);
    })
      .filter((path) => {
        if (seen.has(path)) return false;
        seen.add(path);
        return true;
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
  return runResults(projectDir, appDir).filter((run) => {
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
  switch (metricId) {
    case "aks-rp-e2e.model.unknown-path-count":
      return modelUnknownPathCount(projectDir);
    case "aks-rp-e2e.spec.unverified-count": {
      const metrics = specMetrics(projectDir);
      return {
        value: metrics.unverified,
        measuredAt: Date.now(),
        sampleSize: metrics.total,
        note: { source: "feature-owned spec catalog" },
      };
    }
    case "aks-rp-e2e.spec.failed-count": {
      const metrics = specMetrics(projectDir);
      return {
        value: metrics.failed,
        measuredAt: Date.now(),
        sampleSize: metrics.total,
        note: { source: "feature-owned spec catalog" },
      };
    }
    case "aks-rp-e2e.run.live-started-24h": {
      const live = liveRuns24h(projectDir, options.appDir);
      return {
        value: live.length,
        measuredAt: Date.now(),
        sampleSize: live.length,
        note: {
          source: "project executions and app pipeline artifacts",
          samplePaths: live.slice(0, 5).map((run) => run.path),
        },
      };
    }
    case "aks-rp-e2e.run.live-succeeded-24h": {
      const live = liveRuns24h(projectDir, options.appDir);
      const succeeded = live.filter(
        (run) => normalizedStatus(run.status) === "passed",
      );
      return {
        value: succeeded.length,
        measuredAt: Date.now(),
        sampleSize: live.length,
        note: {
          source: "project executions and app pipeline artifacts",
          samplePaths: succeeded.slice(0, 5).map((run) => run.path),
        },
      };
    }
  }
}

export function sampleFocusMetrics(
  projectDir: string,
  options: { appDir?: string } = {},
): FocusMetricsSnapshot {
  return {
    liveRunsStarted24h: sampleFocusMetric(
      projectDir,
      "aks-rp-e2e.run.live-started-24h",
      options,
    ).value,
    liveRunsSucceeded24h: sampleFocusMetric(
      projectDir,
      "aks-rp-e2e.run.live-succeeded-24h",
      options,
    ).value,
    specUnverifiedCount: sampleFocusMetric(
      projectDir,
      "aks-rp-e2e.spec.unverified-count",
    ).value,
    specFailedCount: sampleFocusMetric(
      projectDir,
      "aks-rp-e2e.spec.failed-count",
    ).value,
    unknownPathMetric: sampleFocusMetric(
      projectDir,
      "aks-rp-e2e.model.unknown-path-count",
    ).value,
  };
}

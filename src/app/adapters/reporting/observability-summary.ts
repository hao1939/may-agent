import { existsSync, readdirSync, readFileSync, statSync, statfsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SqliteDb } from "../../../lib/db.js";
import { taskViewPhaseSql } from "../../core/state/task-view-phase.js";
import { METRIC_LIST_LIMIT, readMetricObservations } from "./metric-observations.js";
import { healthWindow } from "./workflow-health.js";

export type MetricScope = { kind: "host" } | { kind: "app"; appId: string };

const HOST_METRIC_PREFIXES = [
  "event.",
  "host.",
  "infra.",
  "metric.",
  "runtime.",
  "session.",
  "system.",
  "task.",
  "workflow.",
];

/** Historical `may.*` IDs that measure fleet/daemon infrastructure rather than May domain outcomes. */
const HOST_METRIC_IDS = new Set([
  "may.daemon-sql-recent-worst-call-ms",
  "may.daemon-sql-time-percent",
  "may.failed-task-attempts-24h",
  "may.failed-workflow-runs-24h",
  "may.max-task-recent-model-replies",
  "may.oldest-input-recovery-age-seconds",
  "may.unresolved-input-recovery-count",
]);

const APP_ALIAS_BY_KEY: Record<string, string> = {
  scout: "scout-knowledge-lib",
  "scout-knowledge": "scout-knowledge-lib",
};

function normalizeAppKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/^app:/i, "")
    .replace(/^projects\//i, "")
    .replace(/\/project\.(md|json)$/i, "")
    .replace(/\.app$/i, "");
}

function resolveCanonicalAppId(candidate: string | null | undefined, installedApps?: ReadonlySet<string>): string {
  const clean = normalizeAppKey(candidate);
  if (!clean) return "";
  if (installedApps?.has(clean)) return clean;
  const alias = APP_ALIAS_BY_KEY[clean.toLowerCase()];
  if (alias && (!installedApps || installedApps.has(alias))) return alias;
  return clean;
}

/**
 * Classifies a metric into Host platform scope vs. accountable App scope without
 * renaming deployed metric IDs.
 */
export function classifyMetricScope(
  metric: { id: string; owner?: string | null; project?: string | null },
  installedApps?: ReadonlySet<string>,
): MetricScope {
  const id = String(metric.id ?? "").trim();
  const lowerId = id.toLowerCase();
  if (HOST_METRIC_IDS.has(lowerId)) return { kind: "host" };
  if (HOST_METRIC_PREFIXES.some((prefix) => lowerId.startsWith(prefix))) return { kind: "host" };
  // Evaluation specialist workflows belong to alex.app.
  if (lowerId.startsWith("may.evaluation-")) {
    return { kind: "app", appId: resolveCanonicalAppId("alex", installedApps) };
  }

  const projectApp = resolveCanonicalAppId(metric.project, installedApps);
  if (projectApp && projectApp !== "platform" && !projectApp.startsWith("system:")) {
    return { kind: "app", appId: projectApp };
  }

  const ownerRaw = String(metric.owner ?? "").trim();
  if (ownerRaw.toLowerCase().startsWith("system:")) return { kind: "host" };
  const ownerApp = resolveCanonicalAppId(ownerRaw, installedApps);
  if (ownerApp && installedApps?.has(ownerApp)) {
    return { kind: "app", appId: ownerApp };
  }

  const prefix = lowerId.split(".", 1)[0] ?? "";
  if (prefix) {
    const prefixApp = resolveCanonicalAppId(prefix, installedApps);
    if (prefixApp) return { kind: "app", appId: prefixApp };
  }
  if (ownerApp) return { kind: "app", appId: ownerApp };
  return { kind: "host" };
}

export type DiskHeadroom = {
  totalBytes: number;
  availableBytes: number;
  usedPercent: number;
};

export type AuthHeadroom = {
  provider: "azure-cli";
  state: "valid" | "expired" | "unconfigured" | "unknown";
  expiresAt: number | null;
};

export type EnvironmentProbes = {
  disk: DiskHeadroom | null;
  auth: AuthHeadroom;
};

export function probeDiskHeadroom(targetPath: string): DiskHeadroom | null {
  try {
    const stat = statfsSync(targetPath);
    const totalBytes = Number(stat.bsize) * Number(stat.blocks);
    const availableBytes = Number(stat.bsize) * Number(stat.bavail);
    if (!Number.isFinite(totalBytes) || totalBytes <= 0 || !Number.isFinite(availableBytes) || availableBytes < 0) {
      return null;
    }
    const usedPercent = Math.round(((totalBytes - availableBytes) / totalBytes) * 1000) / 10;
    return { totalBytes, availableBytes, usedPercent: Math.max(0, Math.min(100, usedPercent)) };
  } catch {
    return null;
  }
}

/** Read-only check of local Azure CLI MSAL access-token expiry timestamps; never reads secret values. */
export function probeAzureCliAuthHeadroom(now = Date.now(), azureDir?: string): AuthHeadroom {
  const configDir = azureDir ?? process.env.AZURE_CONFIG_DIR ?? join(homedir(), ".azure");
  const profilePath = join(configDir, "azureProfile.json");
  const cachePath = join(configDir, "msal_token_cache.json");
  if (!existsSync(profilePath) && !existsSync(cachePath)) {
    return { provider: "azure-cli", state: "unconfigured", expiresAt: null };
  }
  if (!existsSync(cachePath)) {
    return { provider: "azure-cli", state: "unknown", expiresAt: null };
  }
  try {
    const parsed = JSON.parse(readFileSync(cachePath, "utf8")) as {
      AccessToken?: Record<string, { expires_on?: string | number }>;
    };
    const entries = Object.values(parsed?.AccessToken ?? {});
    if (!entries.length) return { provider: "azure-cli", state: "unknown", expiresAt: null };
    let latestExpiresAt: number | null = null;
    for (const entry of entries) {
      const sec = Number(entry?.expires_on);
      if (Number.isFinite(sec) && sec > 0) {
        const ms = sec * 1000;
        if (latestExpiresAt === null || ms > latestExpiresAt) latestExpiresAt = ms;
      }
    }
    if (latestExpiresAt === null) return { provider: "azure-cli", state: "unknown", expiresAt: null };
    return {
      provider: "azure-cli",
      state: latestExpiresAt > now ? "valid" : "expired",
      expiresAt: latestExpiresAt,
    };
  } catch {
    return { provider: "azure-cli", state: "unknown", expiresAt: null };
  }
}

export function discoverInstalledAppIds(projectsRoot: string): string[] {
  if (!projectsRoot || !existsSync(projectsRoot)) return [];
  try {
    const appIds: string[] = [];
    for (const entry of readdirSync(projectsRoot).sort()) {
      if (!entry.endsWith(".app")) continue;
      const dir = join(projectsRoot, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
        if (existsSync(join(dir, ".disabled"))) continue;
        if (existsSync(join(dir, "app.ts")) || existsSync(join(dir, "app.js"))) {
          appIds.push(entry.slice(0, -".app".length));
        }
      } catch {
        /* Skip unreadable directory entries. */
      }
    }
    return appIds;
  } catch {
    return [];
  }
}

const APP_RUBRIC_WEIGHTS = {
  outcomeValue: 0.35,
  correctnessAndEvidence: 0.25,
  autonomyAndRecovery: 0.15,
  efficiency: 0.15,
  humanCoordination: 0.1,
} as const;

type AppRubricDimension = keyof typeof APP_RUBRIC_WEIGHTS;
const APP_RUBRIC_DIMENSIONS = Object.keys(APP_RUBRIC_WEIGHTS) as AppRubricDimension[];

const HOST_RUBRIC_DIMENSIONS = [
  "invariantReliability",
  "selfRecovery",
  "simplicity",
  "overheadAndCompatibility",
] as const;
type HostRubricDimension = (typeof HOST_RUBRIC_DIMENSIONS)[number];

type DimensionRating = number | "unknown" | "not_applicable";

export type AppScorecardSummary = {
  status: "scored" | "incomplete" | "not_scored";
  rubricVersion: "app-rubric-v1";
  score: number | null;
  gated: boolean;
  gateReason: string | null;
  sampleSize: number;
  confidence: "calibrated" | "low-sample" | "none";
  latestAt: number | null;
  dimensions: Record<
    AppRubricDimension,
    { mean: number | null; assessed: number; unknown: number; notApplicable: number }
  >;
  recentEvaluations: Array<{
    taskId: string;
    attemptId: string;
    agent: string | null;
    cohort: string | null;
    timestamp: number;
    gated: boolean;
  }>;
};

export type HostScorecardSummary = {
  status: "scored" | "incomplete" | "not_scored";
  rubricVersion: "host-rubric-v1";
  score: number | null;
  gated: boolean;
  gateReason: string | null;
  sampleSize: number;
  confidence: "calibrated" | "low-sample" | "none";
  latestAt: number | null;
  dimensions: Record<
    HostRubricDimension,
    { mean: number | null; assessed: number; unknown: number; notApplicable: number }
  >;
};

function parseDimensionRating(raw: unknown): DimensionRating {
  if (raw === "not_applicable" || raw === "na") return "not_applicable";
  if (raw === "unknown" || raw === null || raw === undefined) return "unknown";
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 4) return raw;
  return "unknown";
}

type RawScorecardFact = {
  appId: string;
  taskId: string;
  attemptId: string;
  timestamp: number;
  payload: Record<string, unknown>;
};

function readScorecardFacts(db: SqliteDb, start: number, end: number): RawScorecardFact[] {
  const rows = db
    .prepare(
      `SELECT a.app_id AS appId, a.task_id AS taskId, a.attempt_id AS attemptId,
        COALESCE(
          CAST(unixepoch(json_extract(a.attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER),
          a.started_at
        ) AS timestamp,
        f.value AS fact
      FROM app_task_attempts a, json_each(a.attempt_json, '$.acceptedResult.facts') f
      WHERE a.accepted_result_state IS NOT NULL
        AND instr(a.attempt_json, 'scorecard:') > 0
        AND f.type = 'text'
        AND substr(f.value, 1, 10) = 'scorecard:'
        AND length(f.value) <= 8000`,
    )
    .all() as Array<{ appId: string; taskId: string; attemptId: string; timestamp: number; fact: string }>;

  const parsed: RawScorecardFact[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.timestamp) || row.timestamp < start || row.timestamp >= end) continue;
    try {
      const payload = JSON.parse(row.fact.slice("scorecard:".length)) as Record<string, unknown>;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
      if (payload.version !== 1) continue;
      parsed.push({
        appId: row.appId,
        taskId: row.taskId,
        attemptId: row.attemptId,
        timestamp: row.timestamp,
        payload,
      });
    } catch {
      /* Malformed fact strings are never accepted scorecards. */
    }
  }
  parsed.sort((a, b) => b.timestamp - a.timestamp || a.attemptId.localeCompare(b.attemptId));
  return parsed;
}

function summarizeAppScorecard(facts: RawScorecardFact[]): AppScorecardSummary {
  const dimensions = Object.fromEntries(
    APP_RUBRIC_DIMENSIONS.map((dim) => [dim, { mean: null, assessed: 0, unknown: 0, notApplicable: 0 }]),
  ) as AppScorecardSummary["dimensions"];

  if (!facts.length) {
    return {
      status: "not_scored",
      rubricVersion: "app-rubric-v1",
      score: null,
      gated: false,
      gateReason: null,
      sampleSize: 0,
      confidence: "none",
      latestAt: null,
      dimensions,
      recentEvaluations: [],
    };
  }

  // Deduplicate by (taskId, cohort || attemptId) keeping newest assessment.
  const seen = new Set<string>();
  const unique: RawScorecardFact[] = [];
  for (const item of facts) {
    const subjectTask = typeof item.payload.taskId === "string" && item.payload.taskId.trim() ? item.payload.taskId.trim() : item.taskId;
    const cohort = typeof item.payload.cohort === "string" && item.payload.cohort.trim() ? item.payload.cohort.trim() : item.attemptId;
    const key = `${subjectTask}::${cohort}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const sums: Record<AppRubricDimension, number> = {
    outcomeValue: 0,
    correctnessAndEvidence: 0,
    autonomyAndRecovery: 0,
    efficiency: 0,
    humanCoordination: 0,
  };
  let gated = false;
  let gateReason: string | null = null;

  for (const item of unique) {
    const rawDims =
      item.payload.dimensions && typeof item.payload.dimensions === "object" && !Array.isArray(item.payload.dimensions)
        ? (item.payload.dimensions as Record<string, unknown>)
        : {};
    for (const dim of APP_RUBRIC_DIMENSIONS) {
      const rating = parseDimensionRating(rawDims[dim]);
      if (rating === "not_applicable") {
        dimensions[dim].notApplicable += 1;
      } else if (rating === "unknown") {
        dimensions[dim].unknown += 1;
      } else {
        dimensions[dim].assessed += 1;
        sums[dim] += rating;
      }
    }
    const correctness = parseDimensionRating(rawDims.correctnessAndEvidence);
    if (item.payload.gated === true || correctness === 0) {
      gated = true;
      if (!gateReason) {
        gateReason =
          typeof item.payload.gateReason === "string" && item.payload.gateReason.trim()
            ? item.payload.gateReason.trim()
            : "Severe correctness, evidence, or authority failure";
      }
    }
  }

  let hasUnknown = false;
  let applicableWeightSum = 0;
  let weightedFractionSum = 0;
  for (const dim of APP_RUBRIC_DIMENSIONS) {
    const d = dimensions[dim];
    if (d.assessed > 0) {
      d.mean = Math.round((sums[dim] / d.assessed) * 100) / 100;
    }
    if (d.unknown > 0) hasUnknown = true;
    if (d.assessed > 0) {
      const weight = APP_RUBRIC_WEIGHTS[dim];
      applicableWeightSum += weight;
      weightedFractionSum += weight * ((d.mean ?? 0) / 4);
    }
  }

  let score: number | null = null;
  let status: AppScorecardSummary["status"] = "incomplete";
  if (!hasUnknown && applicableWeightSum > 0) {
    const rawScore = Math.round((weightedFractionSum / applicableWeightSum) * 1000) / 10;
    score = gated ? Math.min(rawScore, 25) : rawScore;
    status = "scored";
  }

  return {
    status,
    rubricVersion: "app-rubric-v1",
    score,
    gated,
    gateReason,
    sampleSize: unique.length,
    confidence: unique.length >= 5 ? "calibrated" : "low-sample",
    latestAt: unique[0]?.timestamp ?? null,
    dimensions,
    recentEvaluations: unique.slice(0, 5).map((item) => {
      const rawDims =
        item.payload.dimensions && typeof item.payload.dimensions === "object"
          ? (item.payload.dimensions as Record<string, unknown>)
          : {};
      return {
        taskId: typeof item.payload.taskId === "string" && item.payload.taskId.trim() ? item.payload.taskId.trim() : item.taskId,
        attemptId: item.attemptId,
        agent: typeof item.payload.agent === "string" && item.payload.agent.trim() ? item.payload.agent.trim() : null,
        cohort: typeof item.payload.cohort === "string" && item.payload.cohort.trim() ? item.payload.cohort.trim() : null,
        timestamp: item.timestamp,
        gated: item.payload.gated === true || parseDimensionRating(rawDims.correctnessAndEvidence) === 0,
      };
    }),
  };
}

function summarizeHostScorecard(facts: RawScorecardFact[]): HostScorecardSummary {
  const dimensions = Object.fromEntries(
    HOST_RUBRIC_DIMENSIONS.map((dim) => [dim, { mean: null, assessed: 0, unknown: 0, notApplicable: 0 }]),
  ) as HostScorecardSummary["dimensions"];

  if (!facts.length) {
    return {
      status: "not_scored",
      rubricVersion: "host-rubric-v1",
      score: null,
      gated: false,
      gateReason: null,
      sampleSize: 0,
      confidence: "none",
      latestAt: null,
      dimensions,
    };
  }

  const sums: Record<HostRubricDimension, number> = {
    invariantReliability: 0,
    selfRecovery: 0,
    simplicity: 0,
    overheadAndCompatibility: 0,
  };
  let gated = false;
  let gateReason: string | null = null;

  for (const item of facts) {
    const rawDims =
      item.payload.dimensions && typeof item.payload.dimensions === "object" && !Array.isArray(item.payload.dimensions)
        ? (item.payload.dimensions as Record<string, unknown>)
        : {};
    for (const dim of HOST_RUBRIC_DIMENSIONS) {
      const rating = parseDimensionRating(rawDims[dim]);
      if (rating === "not_applicable") dimensions[dim].notApplicable += 1;
      else if (rating === "unknown") dimensions[dim].unknown += 1;
      else {
        dimensions[dim].assessed += 1;
        sums[dim] += rating;
      }
    }
    const reliability = parseDimensionRating(rawDims.invariantReliability);
    if (item.payload.gated === true || reliability === 0) {
      gated = true;
      if (!gateReason) {
        gateReason =
          typeof item.payload.gateReason === "string" && item.payload.gateReason.trim()
            ? item.payload.gateReason.trim()
            : "Host invariant or contract reliability failure";
      }
    }
  }

  let hasUnknown = false;
  let applicableCount = 0;
  let meanSum = 0;
  for (const dim of HOST_RUBRIC_DIMENSIONS) {
    const d = dimensions[dim];
    if (d.assessed > 0) {
      d.mean = Math.round((sums[dim] / d.assessed) * 100) / 100;
      applicableCount += 1;
      meanSum += d.mean / 4;
    }
    if (d.unknown > 0) hasUnknown = true;
  }

  let score: number | null = null;
  let status: HostScorecardSummary["status"] = "incomplete";
  if (!hasUnknown && applicableCount > 0) {
    const rawScore = Math.round((meanSum / applicableCount) * 1000) / 10;
    score = gated ? Math.min(rawScore, 25) : rawScore;
    status = "scored";
  }

  return {
    status,
    rubricVersion: "host-rubric-v1",
    score,
    gated,
    gateReason,
    sampleSize: facts.length,
    confidence: facts.length >= 5 ? "calibrated" : "low-sample",
    latestAt: facts[0]?.timestamp ?? null,
    dimensions,
  };
}

export type TrendPoint = {
  t: number;
  v: number | null;
  n: number;
};

export type TrendSeries = {
  metricId: string;
  label: string;
  unit: "ratio" | "seconds" | "usd" | "outcomes";
  goodDirection: "up" | "down";
  current: number | null;
  sampleSize: number;
  delta: number | null;
  points: TrendPoint[];
};

const TREND_BUCKETS = 12;

function roundMetric(val: number | null, digits = 4): number | null {
  if (val === null || !Number.isFinite(val)) return null;
  const f = 10 ** digits;
  return Math.round(val * f) / f;
}

function buildRatioTrend(options: {
  metricId: string;
  label: string;
  unit: TrendSeries["unit"];
  goodDirection: TrendSeries["goodDirection"];
  bucketStarts: number[];
  numerators: number[];
  denominators: number[];
  extraNumerator?: number;
  extraDenominator?: number;
}): TrendSeries {
  const {
    metricId,
    label,
    unit,
    goodDirection,
    bucketStarts,
    numerators,
    denominators,
    extraNumerator = 0,
    extraDenominator = 0,
  } = options;
  const points: TrendPoint[] = bucketStarts.map((t, i) => {
    const den = denominators[i] ?? 0;
    const num = numerators[i] ?? 0;
    return {
      t,
      v: den > 0 ? roundMetric(num / den) : null,
      n: den,
    };
  });
  const totalNum = numerators.reduce((s, x) => s + x, 0) + extraNumerator;
  const totalDen = denominators.reduce((s, x) => s + x, 0) + extraDenominator;
  const current = totalDen > 0 ? roundMetric(totalNum / totalDen) : null;

  const mid = Math.floor(TREND_BUCKETS / 2);
  let firstNum = 0;
  let firstDen = 0;
  let secondNum = 0;
  let secondDen = 0;
  for (let i = 0; i < TREND_BUCKETS; i++) {
    if (i < mid) {
      firstNum += numerators[i] ?? 0;
      firstDen += denominators[i] ?? 0;
    } else {
      secondNum += numerators[i] ?? 0;
      secondDen += denominators[i] ?? 0;
    }
  }
  const delta =
    firstDen > 0 && secondDen > 0 ? roundMetric(secondNum / secondDen - firstNum / firstDen) : null;

  return { metricId, label, unit, goodDirection, current, sampleSize: totalDen, delta, points };
}

function buildCountTrend(options: {
  metricId: string;
  label: string;
  goodDirection: TrendSeries["goodDirection"];
  bucketStarts: number[];
  counts: number[];
  exposures: number[];
}): TrendSeries {
  const { metricId, label, goodDirection, bucketStarts, counts, exposures } = options;
  const points: TrendPoint[] = bucketStarts.map((t, i) => ({
    t,
    v: counts[i] ?? 0,
    n: exposures[i] ?? 0,
  }));
  const current = counts.reduce((s, x) => s + x, 0);
  const sampleSize = exposures.reduce((s, x) => s + x, 0);
  const mid = Math.floor(TREND_BUCKETS / 2);
  const firstHalf = counts.slice(0, mid).reduce((s, x) => s + x, 0);
  const secondHalf = counts.slice(mid).reduce((s, x) => s + x, 0);
  const delta = current > 0 ? secondHalf - firstHalf : null;
  return { metricId, label, unit: "outcomes", goodDirection, current, sampleSize, delta, points };
}

function p95Sorted(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return roundMetric(sorted[idx]!);
}

function buildWindowTrends(
  db: SqliteDb,
  start: number,
  end: number,
  appIds: readonly string[],
  envProbes: EnvironmentProbes,
  unresolvedRecoveryCount: number,
) {
  const span = Math.max(TREND_BUCKETS, end - start);
  const bucketWidth = span / TREND_BUCKETS;
  const bucketStarts = Array.from({ length: TREND_BUCKETS }, (_, i) => Math.round(start + i * bucketWidth));
  const bucketOf = (ts: number): number => {
    const raw = Math.floor((ts - start) / bucketWidth);
    return Math.min(TREND_BUCKETS - 1, Math.max(0, raw));
  };

  const attemptTimeExpr = `COALESCE(
    CAST(unixepoch(json_extract(attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER),
    started_at
  )`;

  // 1. Attempt bucket facts (Host + per-App).
  const attemptBuckets = db
    .prepare(
      `SELECT
         app_id AS appId,
         MIN(${TREND_BUCKETS - 1}, MAX(0, CAST((${attemptTimeExpr} - ?) / ? AS INTEGER))) AS b,
         COUNT(*) AS total,
         COUNT(CASE WHEN state IN ('completed', 'failed') THEN 1 END) AS terminal,
         COUNT(CASE WHEN state = 'completed' AND accepted_result_state IS NOT NULL THEN 1 END) AS settled,
         COUNT(CASE WHEN state IN ('failed', 'interrupted') THEN 1 END) AS friction,
         COUNT(CASE WHEN state != 'running' THEN 1 END) AS finishedNonRunning,
         COUNT(CASE WHEN accepted_result_state = 'converged' THEN 1 END) AS converged,
         COUNT(CASE WHEN state != 'running' AND COALESCE(accepted_result_state, '') != 'converged' THEN 1 END) AS nonConverged
       FROM app_task_attempts
       WHERE ${attemptTimeExpr} >= ? AND ${attemptTimeExpr} < ?
       GROUP BY app_id, b`,
    )
    .all(start, bucketWidth, start, end) as Array<{
    appId: string;
    b: number;
    total: number;
    terminal: number;
    settled: number;
    friction: number;
    finishedNonRunning: number;
    converged: number;
    nonConverged: number;
  }>;

  // 2. Workflow bucket facts (Host + per-App).
  const wfBuckets = db
    .prepare(
      `SELECT
         COALESCE(app_id, '') AS appId,
         MIN(${TREND_BUCKETS - 1}, MAX(0, CAST((endedAt - ?) / ? AS INTEGER))) AS b,
         COUNT(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') THEN 1 END) AS total,
         COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
         COUNT(CASE WHEN status = 'error' THEN 1 END) AS errors
       FROM workflow_runs
       WHERE parentWorkflowRunId IS NULL AND endedAt >= ? AND endedAt < ?
       GROUP BY 1, b`,
    )
    .all(start, bucketWidth, start, end) as Array<{
    appId: string;
    b: number;
    total: number;
    done: number;
    errors: number;
  }>;

  // 3. Execution usage bucket facts (cache hit, cost, prompt tax, prep latency).
  const complete =
    "outcome IS NOT NULL AND json_extract(data, '$.totals.replies') > 0 AND json_extract(data, '$.totals.measuredReplies') = json_extract(data, '$.totals.replies')";
  const usageRows = db
    .prepare(
      `SELECT
         COALESCE(app_id, '') AS appId,
         started_at AS ts,
         CASE WHEN ${complete} THEN 1 ELSE 0 END AS isComplete,
         COALESCE(json_extract(data, '$.totals.cacheRead'), 0) AS cacheRead,
         COALESCE(json_extract(data, '$.totals.input'), 0) + COALESCE(json_extract(data, '$.totals.cacheRead'), 0) + COALESCE(json_extract(data, '$.totals.cacheWrite'), 0) AS exposure,
         CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = json_extract(data, '$.totals.replies')
           THEN json_extract(data, '$.totals.estimatedCost') ELSE NULL END AS pricedUsd,
         json_extract(data, '$.preparation.durationMs') AS prepMs,
         json_extract(data, '$.preparation.taskBytes') AS taskBytes,
         json_extract(data, '$.preparation.promptBytes') AS promptBytes
       FROM execution_usage
       WHERE started_at >= ? AND started_at < ?`,
    )
    .all(start, end) as Array<{
    appId: string;
    ts: number;
    isComplete: number;
    cacheRead: number;
    exposure: number;
    pricedUsd: number | null;
    prepMs: number | null;
    taskBytes: number | null;
    promptBytes: number | null;
  }>;

  // 4. Closed requests, closed finite tasks, and human steers per bucket.
  const closedReqBuckets = db
    .prepare(
      `SELECT app_id AS appId,
         MIN(${TREND_BUCKETS - 1}, MAX(0, CAST((updated_at - ?) / ? AS INTEGER))) AS b,
         COUNT(*) AS closed
       FROM conversation_requests
       WHERE status = 'closed' AND updated_at >= ? AND updated_at < ?
       GROUP BY app_id, b`,
    )
    .all(start, bucketWidth, start, end) as Array<{ appId: string; b: number; closed: number }>;

  const humanSteerBuckets = db
    .prepare(
      `SELECT app_id AS appId,
         MIN(${TREND_BUCKETS - 1}, MAX(0, CAST((created_at - ?) / ? AS INTEGER))) AS b,
         COUNT(*) AS touches
       FROM app_inbox_items
       WHERE source_kind = 'human' AND created_at >= ? AND created_at < ?
       GROUP BY app_id, b`,
    )
    .all(start, bucketWidth, start, end) as Array<{ appId: string; b: number; touches: number }>;

  const diskSnapshots = db
    .prepare(
      `SELECT measured_at AS ts, value
       FROM metric_snapshots
       WHERE metric_id = 'host.disk_used_ratio' AND measured_at >= ? AND measured_at < ?
       ORDER BY measured_at ASC`,
    )
    .all(start, end) as Array<{ ts: number; value: number }>;

  const zeros = () => Array.from({ length: TREND_BUCKETS }, () => 0);
  const hostSettled = zeros();
  const hostTerminal = zeros();
  const hostFriction = zeros();
  const hostExecUnits = zeros();
  const hostCacheRead = zeros();
  const hostCacheExp = zeros();
  const hostPromptTaxBytes = zeros();
  const hostPromptTotalBytes = zeros();
  const hostPrepByBucket: number[][] = Array.from({ length: TREND_BUCKETS }, () => []);
  const allHostPrep: number[] = [];

  type AppBuckets = {
    outcomes: number[];
    outcomeExposure: number[];
    pricedUsd: number[];
    pricedCount: number[];
    nonConverged: number[];
    finishedAttempts: number[];
    totalAttempts: number[];
    wfDone: number[];
    wfTotal: number[];
    humanTouches: number[];
  };
  const byApp = new Map<string, AppBuckets>();
  const ensureApp = (id: string): AppBuckets => {
    let entry = byApp.get(id);
    if (!entry) {
      entry = {
        outcomes: zeros(),
        outcomeExposure: zeros(),
        pricedUsd: zeros(),
        pricedCount: zeros(),
        nonConverged: zeros(),
        finishedAttempts: zeros(),
        totalAttempts: zeros(),
        wfDone: zeros(),
        wfTotal: zeros(),
        humanTouches: zeros(),
      };
      byApp.set(id, entry);
    }
    return entry;
  };
  for (const id of appIds) ensureApp(id);

  for (const r of attemptBuckets) {
    hostSettled[r.b] += r.settled;
    hostTerminal[r.b] += r.terminal;
    hostFriction[r.b] += r.friction;
    hostExecUnits[r.b] += r.total;
    if (r.appId) {
      const a = ensureApp(r.appId);
      a.outcomes[r.b] += r.converged;
      a.outcomeExposure[r.b] += r.total;
      a.nonConverged[r.b] += r.nonConverged;
      a.finishedAttempts[r.b] += r.finishedNonRunning;
      a.totalAttempts[r.b] += r.total;
    }
  }

  for (const r of wfBuckets) {
    hostFriction[r.b] += r.errors;
    hostExecUnits[r.b] += r.total;
    if (r.appId) {
      const a = ensureApp(r.appId);
      a.wfDone[r.b] += r.done;
      a.wfTotal[r.b] += r.total;
    }
  }

  for (const r of usageRows) {
    const b = bucketOf(r.ts);
    if (r.isComplete && r.exposure > 0) {
      hostCacheRead[b] += r.cacheRead;
      hostCacheExp[b] += r.exposure;
    }
    if (typeof r.prepMs === "number" && Number.isFinite(r.prepMs) && r.prepMs >= 0) {
      const s = r.prepMs / 1000;
      hostPrepByBucket[b]!.push(s);
      allHostPrep.push(s);
    }
    if (
      typeof r.promptBytes === "number" &&
      r.promptBytes > 0 &&
      typeof r.taskBytes === "number" &&
      r.taskBytes >= 0
    ) {
      hostPromptTaxBytes[b] += Math.max(0, r.promptBytes - r.taskBytes);
      hostPromptTotalBytes[b] += r.promptBytes;
    }
    if (r.appId && typeof r.pricedUsd === "number" && Number.isFinite(r.pricedUsd)) {
      const a = ensureApp(r.appId);
      a.pricedUsd[b] += r.pricedUsd;
      a.pricedCount[b] += 1;
    }
  }

  for (const r of closedReqBuckets) {
    const a = ensureApp(r.appId);
    a.outcomes[r.b] += r.closed;
    a.outcomeExposure[r.b] += r.closed;
  }

  for (const r of humanSteerBuckets) {
    const a = ensureApp(r.appId);
    a.humanTouches[r.b] += r.touches;
  }

  // Host Prep p95 trend.
  const prepPoints: TrendPoint[] = bucketStarts.map((t, i) => ({
    t,
    v: p95Sorted(hostPrepByBucket[i]!),
    n: hostPrepByBucket[i]!.length,
  }));
  const mid = Math.floor(TREND_BUCKETS / 2);
  const firstPrep = p95Sorted(hostPrepByBucket.slice(0, mid).flat());
  const secondPrep = p95Sorted(hostPrepByBucket.slice(mid).flat());
  const prepTrend: TrendSeries = {
    metricId: "host.prep_p95_seconds",
    label: "Prep latency p95",
    unit: "seconds",
    goodDirection: "down",
    current: p95Sorted(allHostPrep),
    sampleSize: allHostPrep.length,
    delta: firstPrep !== null && secondPrep !== null ? roundMetric(secondPrep - firstPrep) : null,
    points: prepPoints,
  };

  // Host Disk usage trend (from retained snapshots, with live probe in latest bucket if no snapshots yet).
  const diskLatestByBucket: Array<number | null> = Array.from({ length: TREND_BUCKETS }, () => null);
  const diskCountByBucket = zeros();
  for (const snap of diskSnapshots) {
    const b = bucketOf(snap.ts);
    diskLatestByBucket[b] = roundMetric(snap.value);
    diskCountByBucket[b] += 1;
  }
  const currentDiskRatio = envProbes.disk ? roundMetric(envProbes.disk.usedPercent / 100) : null;
  if (currentDiskRatio !== null && diskLatestByBucket[TREND_BUCKETS - 1] === null) {
    diskLatestByBucket[TREND_BUCKETS - 1] = currentDiskRatio;
    diskCountByBucket[TREND_BUCKETS - 1] = 1;
  }
  const diskPoints: TrendPoint[] = bucketStarts.map((t, i) => ({
    t,
    v: diskLatestByBucket[i]!,
    n: diskCountByBucket[i]!,
  }));

  const totalPromptBytes = hostPromptTotalBytes.reduce((s, x) => s + x, 0);
  const promptTaxRatio =
    totalPromptBytes > 0 ? roundMetric(hostPromptTaxBytes.reduce((s, x) => s + x, 0) / totalPromptBytes) : null;

  const hostTrends = {
    settlementIntegrity: buildRatioTrend({
      metricId: "host.settlement_integrity_ratio",
      label: "Settlement integrity",
      unit: "ratio",
      goodDirection: "up",
      bucketStarts,
      numerators: hostSettled,
      denominators: hostTerminal,
      extraDenominator: unresolvedRecoveryCount,
    }),
    prepLatencyP95: prepTrend,
    cacheHitRatio: buildRatioTrend({
      metricId: "host.cache_hit_ratio",
      label: "Prompt cache hit",
      unit: "ratio",
      goodDirection: "up",
      bucketStarts,
      numerators: hostCacheRead,
      denominators: hostCacheExp,
    }),
    harnessBurdenRatio: buildRatioTrend({
      metricId: "host.harness_burden_ratio",
      label: "Harness burden / tax",
      unit: "ratio",
      goodDirection: "down",
      bucketStarts,
      numerators: hostFriction,
      denominators: hostExecUnits,
      extraNumerator: unresolvedRecoveryCount,
      extraDenominator: unresolvedRecoveryCount,
    }),
    diskUsedRatio: {
      metricId: "host.disk_used_ratio",
      label: "Disk usage",
      unit: "ratio" as const,
      goodDirection: "down" as const,
      current: currentDiskRatio,
      sampleSize: diskCountByBucket.reduce((s, x) => s + x, 0),
      delta: null,
      points: diskPoints,
    },
    promptTaxRatio,
  };

  const appTrends = new Map<
    string,
    {
      verifiedOutcomes: TrendSeries;
      costPerOutcomeUsd: TrendSeries;
      spinRatio: TrendSeries;
      workflowOffloadRatio: TrendSeries;
      autonomyRatio: TrendSeries;
    }
  >();

  for (const appId of appIds) {
    const a = ensureApp(appId);
    const totalPriced = a.pricedCount.reduce((s, x) => s + x, 0);
    // Cost per outcome only has valid exposure in buckets/windows where pricing exists AND outcomes > 0.
    const costNums = a.pricedUsd.map((usd, i) => (a.pricedCount[i]! > 0 && a.outcomes[i]! > 0 ? usd : 0));
    const costDens = a.outcomes.map((outc, i) => (a.pricedCount[i]! > 0 && outc > 0 ? outc : 0));
    const costSeries = buildRatioTrend({
      metricId: `${appId}.cost_per_outcome_usd_7d`,
      label: "Cost / outcome",
      unit: "usd",
      goodDirection: "down",
      bucketStarts,
      numerators: costNums,
      denominators: costDens,
    });
    // Whole-window cost/outcome uses whole-window SUM(priced USD) / SUM(verified outcomes) when priced runs exist.
    const windowOutcomes = a.outcomes.reduce((s, x) => s + x, 0);
    const windowUsd = a.pricedUsd.reduce((s, x) => s + x, 0);
    costSeries.current = totalPriced > 0 && windowOutcomes > 0 ? roundMetric(windowUsd / windowOutcomes) : null;
    costSeries.sampleSize = totalPriced > 0 ? windowOutcomes : 0;

    appTrends.set(appId, {
      verifiedOutcomes: buildCountTrend({
        metricId: `${appId}.verified_outcomes_24h`,
        label: "Verified outcomes",
        goodDirection: "up",
        bucketStarts,
        counts: a.outcomes,
        exposures: a.outcomeExposure,
      }),
      costPerOutcomeUsd: costSeries,
      spinRatio: buildRatioTrend({
        metricId: `${appId}.spin_ratio_24h`,
        label: "Spin / cycling ratio",
        unit: "ratio",
        goodDirection: "down",
        bucketStarts,
        numerators: a.nonConverged,
        denominators: a.finishedAttempts,
      }),
      workflowOffloadRatio: buildRatioTrend({
        metricId: `${appId}.workflow_offload_ratio_24h`,
        label: "Workflow offload",
        unit: "ratio",
        goodDirection: "up",
        bucketStarts,
        numerators: a.wfDone,
        denominators: a.wfTotal.map((w, i) => w + (a.totalAttempts[i] ?? 0)),
      }),
      autonomyRatio: buildRatioTrend({
        metricId: `${appId}.autonomy_ratio_7d`,
        label: "Autonomy yield",
        unit: "ratio",
        goodDirection: "up",
        bucketStarts,
        numerators: a.outcomes,
        denominators: a.outcomes.map((o, i) => o + (a.humanTouches[i] ?? 0)),
      }),
    });
  }

  return { hostTrends, appTrends };
}

export function observabilitySummaryQuery(params: URLSearchParams, now = Date.now()) {
  const appId = params.get("appId")?.trim() || null;
  if (appId && appId.length > 200) throw new Error("App filter is too long");
  return { ...healthWindow(params, now), appId };
}

function buildAppDrillDown(
  db: SqliteDb,
  appId: string,
  start: number,
  end: number,
  appScorecardFacts: RawScorecardFact[],
) {
  const taskPhaseExpr = taskViewPhaseSql("t");
  const attemptTimeExpr = `COALESCE(
    CAST(unixepoch(json_extract(a.attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER),
    a.started_at
  )`;

  const taskRows = db
    .prepare(
      `SELECT
         t.task_id AS taskId,
         CASE
           WHEN c.task_id IS NOT NULL THEN
             CASE WHEN json_extract(c.cancellation_json, '$.acceptedResultAttemptId') IS NOT NULL THEN 'closed' ELSE 'cancelled' END
           WHEN ${taskPhaseExpr} = 'converged' THEN 'idle'
           ELSE ${taskPhaseExpr}
         END AS status,
         COALESCE(
           NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
           NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
         ) AS agent,
         substr(
           COALESCE(
             NULLIF(trim(json_extract(t.resource_json, '$.spec.outcome')), ''),
             NULLIF(trim(json_extract(t.resource_json, '$.spec.goal')), ''),
             NULLIF(trim(json_extract(t.resource_json, '$.spec.intent')), ''),
             t.task_id
           ),
           1,
           160
         ) AS goal,
         t.updated_at AS updatedAt,
         (SELECT COUNT(*) FROM app_task_attempts a
          WHERE a.app_id = t.app_id AND a.task_id = t.task_id
            AND a.accepted_result_state = 'converged'
            AND ${attemptTimeExpr} >= ? AND ${attemptTimeExpr} < ?) AS convergedWindow,
         (SELECT COUNT(*) FROM app_task_attempts a
          WHERE a.app_id = t.app_id AND a.task_id = t.task_id
            AND a.state = 'failed'
            AND ${attemptTimeExpr} >= ? AND ${attemptTimeExpr} < ?) AS failedWindow
       FROM app_tasks t
       LEFT JOIN app_task_cancellations c ON c.app_id = t.app_id AND c.task_id = t.task_id
       WHERE t.app_id = ?
         AND (c.task_id IS NULL OR t.updated_at >= ?)
       ORDER BY
         CASE WHEN c.task_id IS NULL AND ${taskPhaseExpr} IN ('running', 'attention', 'waiting', 'pending') THEN 0
              WHEN c.task_id IS NULL THEN 1
              ELSE 2 END,
         t.updated_at DESC
       LIMIT 25`,
    )
    .all(start, end, start, end, appId, start) as Array<{
    taskId: string;
    status: string;
    agent: string | null;
    goal: string;
    updatedAt: number;
    convergedWindow: number;
    failedWindow: number;
  }>;

  const scorecardsByTask = new Map<string, RawScorecardFact[]>();
  const scorecardsByAgent = new Map<string, RawScorecardFact[]>();
  for (const fact of appScorecardFacts) {
    const tId =
      typeof fact.payload.taskId === "string" && fact.payload.taskId.trim() ? fact.payload.taskId.trim() : fact.taskId;
    const tList = scorecardsByTask.get(tId) ?? [];
    tList.push(fact);
    scorecardsByTask.set(tId, tList);

    const ag = typeof fact.payload.agent === "string" && fact.payload.agent.trim() ? fact.payload.agent.trim() : null;
    if (ag) {
      const aList = scorecardsByAgent.get(ag) ?? [];
      aList.push(fact);
      scorecardsByAgent.set(ag, aList);
    }
  }

  const tasks = taskRows.map((row) => ({
    ...row,
    scorecard: summarizeAppScorecard(scorecardsByTask.get(row.taskId) ?? []),
  }));

  // Agents contributing to this App in the window (sessions + execution_usage).
  const sessionAgentRows = db
    .prepare(
      `SELECT
         agent,
         COUNT(*) AS sessionsWindow,
         COUNT(CASE WHEN status = 'error' THEN 1 END) AS errorsWindow
       FROM sessions
       WHERE (app_id = ? OR projectId = ?)
         AND agent IS NOT NULL AND agent != ''
         AND startedAt >= ? AND startedAt < ?
       GROUP BY agent`,
    )
    .all(appId, appId, start, end) as Array<{ agent: string; sessionsWindow: number; errorsWindow: number }>;

  const complete =
    "outcome IS NOT NULL AND json_extract(data, '$.totals.replies') > 0 AND json_extract(data, '$.totals.measuredReplies') = json_extract(data, '$.totals.replies')";
  const usageAgentRows = db
    .prepare(
      `SELECT
         agent,
         COUNT(*) AS invocationsWindow,
         COUNT(CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = json_extract(data, '$.totals.replies') THEN 1 END) AS pricedInvocations,
         SUM(CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = json_extract(data, '$.totals.replies')
           THEN COALESCE(json_extract(data, '$.totals.estimatedCost'), 0) END) AS estimatedCostUsd
       FROM execution_usage
       WHERE app_id = ? AND agent IS NOT NULL AND agent != ''
         AND started_at >= ? AND started_at < ?
       GROUP BY agent`,
    )
    .all(appId, start, end) as Array<{
    agent: string;
    invocationsWindow: number;
    pricedInvocations: number;
    estimatedCostUsd: number | null;
  }>;

  // Also include Task attempt counts by assigned agent (covering Codex/native executors without session/usage rows).
  const attemptAgentRows = db
    .prepare(
      `SELECT
         COALESCE(
           NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
           NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
         ) AS agent,
         COUNT(*) AS attemptsWindow,
         COUNT(CASE WHEN a.state = 'failed' THEN 1 END) AS failedAttemptsWindow
       FROM app_task_attempts a
       JOIN app_tasks t ON t.app_id = a.app_id AND t.task_id = a.task_id
       WHERE a.app_id = ?
         AND ${attemptTimeExpr} >= ? AND ${attemptTimeExpr} < ?
       GROUP BY 1`,
    )
    .all(appId, start, end) as Array<{
    agent: string | null;
    attemptsWindow: number;
    failedAttemptsWindow: number;
  }>;

  // Also include assigned agents on active tasks.
  const agentNames = new Set<string>([
    ...sessionAgentRows.map((r) => r.agent),
    ...usageAgentRows.map((r) => r.agent),
    ...attemptAgentRows.map((r) => r.agent).filter((a): a is string => Boolean(a)),
    ...scorecardsByAgent.keys(),
    ...taskRows.map((t) => t.agent).filter((a): a is string => Boolean(a)),
  ]);
  const sessByAgent = new Map(sessionAgentRows.map((r) => [r.agent, r]));
  const usageByAgent = new Map(usageAgentRows.map((r) => [r.agent, r]));
  const attemptsByAgent = new Map(
    attemptAgentRows.filter((r): r is typeof r & { agent: string } => Boolean(r.agent)).map((r) => [r.agent, r]),
  );

  const agents = [...agentNames]
    .map((agent) => {
      const s = sessByAgent.get(agent);
      const u = usageByAgent.get(agent);
      const att = attemptsByAgent.get(agent);
      const runs = Math.max(u?.invocationsWindow ?? 0, s?.sessionsWindow ?? 0, att?.attemptsWindow ?? 0);
      const errs = Math.max(s?.errorsWindow ?? 0, att?.failedAttemptsWindow ?? 0);
      return {
        agent,
        sessionsWindow: s?.sessionsWindow ?? att?.attemptsWindow ?? 0,
        errorsWindow: errs,
        invocationsWindow: runs,
        estimatedCostUsdWindow:
          u && u.pricedInvocations > 0 && u.estimatedCostUsd !== null
            ? Math.round(u.estimatedCostUsd * 10000) / 10000
            : null,
        scorecard: summarizeAppScorecard(scorecardsByAgent.get(agent) ?? []),
      };
    })
    .sort((a, b) => b.invocationsWindow - a.invocationsWindow || a.agent.localeCompare(b.agent));

  const workflows = db
    .prepare(
      `SELECT
         workflow,
         COUNT(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') THEN 1 END) AS finished,
         COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
         COUNT(CASE WHEN status = 'error' THEN 1 END) AS errors,
         COUNT(CASE WHEN status = 'blocked' THEN 1 END) AS blocked,
         AVG(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') AND startedAt >= 0 AND endedAt >= startedAt
               THEN endedAt - startedAt END) AS meanDurationMs
       FROM workflow_runs
       WHERE parentWorkflowRunId IS NULL
         AND (app_id = ? OR projectId = ?)
         AND endedAt >= ? AND endedAt < ?
       GROUP BY workflow
       ORDER BY finished DESC, workflow ASC
       LIMIT 20`,
    )
    .all(appId, appId, start, end) as Array<{
    workflow: string;
    finished: number;
    done: number;
    errors: number;
    blocked: number;
    meanDurationMs: number | null;
  }>;

  return { appId, tasks, agents, workflows };
}

/** Per-Agent 7-day App attribution & scorecard roll-up for `/api/agents`. */
export function readAgentCapabilityRollups(db: SqliteDb, now = Date.now()) {
  const start = now - 7 * 86_400_000;
  const end = now;
  const sessionApps = db
    .prepare(
      `SELECT agent, appId, SUM(runs) AS runs FROM (
         SELECT agent, COALESCE(NULLIF(app_id, ''), NULLIF(projectId, '')) AS appId, COUNT(*) AS runs
         FROM sessions
         WHERE startedAt >= ? AND startedAt < ? AND agent IS NOT NULL AND agent != ''
         GROUP BY agent, appId
         UNION ALL
         SELECT
           COALESCE(
             NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
             NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
           ) AS agent,
           a.app_id AS appId,
           COUNT(*) AS runs
         FROM app_task_attempts a
         JOIN app_tasks t ON t.app_id = a.app_id AND t.task_id = a.task_id
         WHERE a.started_at >= ? AND a.started_at < ?
         GROUP BY 1, 2
       ) WHERE agent IS NOT NULL AND agent != ''
       GROUP BY agent, appId`,
    )
    .all(start, end, start, end) as Array<{ agent: string; appId: string | null; runs: number }>;

  const complete =
    "outcome IS NOT NULL AND json_extract(data, '$.totals.replies') > 0 AND json_extract(data, '$.totals.measuredReplies') = json_extract(data, '$.totals.replies')";
  const usageRows = db
    .prepare(
      `SELECT
         agent,
         COUNT(*) AS invocations7d,
         COUNT(CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = json_extract(data, '$.totals.replies') THEN 1 END) AS priced7d,
         SUM(CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = json_extract(data, '$.totals.replies')
           THEN COALESCE(json_extract(data, '$.totals.estimatedCost'), 0) END) AS cost7d
       FROM execution_usage
       WHERE started_at >= ? AND started_at < ? AND agent IS NOT NULL AND agent != ''
       GROUP BY agent`,
    )
    .all(start, end) as Array<{
    agent: string;
    invocations7d: number;
    priced7d: number;
    cost7d: number | null;
  }>;

  const facts = readScorecardFacts(db, start, end).filter(
    (f) => f.payload.targetKind !== "host" && f.payload.rubricVersion !== "host-rubric-v1",
  );
  const factsByAgent = new Map<string, RawScorecardFact[]>();
  for (const f of facts) {
    const ag = typeof f.payload.agent === "string" && f.payload.agent.trim() ? f.payload.agent.trim() : null;
    if (!ag) continue;
    const list = factsByAgent.get(ag) ?? [];
    list.push(f);
    factsByAgent.set(ag, list);
  }

  const appsByAgent = new Map<string, Set<string>>();
  for (const row of sessionApps) {
    if (!row.appId || row.appId === "platform" || row.appId.startsWith("system:")) continue;
    const set = appsByAgent.get(row.agent) ?? new Set<string>();
    set.add(normalizeAppKey(row.appId));
    appsByAgent.set(row.agent, set);
  }
  const usageByAgent = new Map(usageRows.map((r) => [r.agent, r]));

  return (agentName: string) => {
    const u = usageByAgent.get(agentName);
    return {
      apps7d: [...(appsByAgent.get(agentName) ?? [])].filter(Boolean).sort(),
      invocations7d: u?.invocations7d ?? 0,
      estimatedCost7d:
        u && u.priced7d > 0 && u.cost7d !== null ? Math.round(u.cost7d * 10000) / 10000 : null,
      scorecard7d: summarizeAppScorecard(factsByAgent.get(agentName) ?? []),
    };
  };
}

export function readObservabilitySummary(
  db: SqliteDb,
  options: {
    query: ReturnType<typeof observabilitySummaryQuery>;
    projectsRoot: string;
    stateDir: string;
    now?: number;
    envProbes?: EnvironmentProbes;
  },
) {
  const now = options.now ?? Date.now();
  const { start, end, appId: filterAppId } = options.query;
  const installedAppIds = discoverInstalledAppIds(options.projectsRoot);
  const installedSet = new Set(installedAppIds);

  const envProbes: EnvironmentProbes = options.envProbes ?? {
    disk: probeDiskHeadroom(options.stateDir),
    auth: probeAzureCliAuthHeadroom(now),
  };

  db.exec("SAVEPOINT observability_summary_read");
  try {
    const observations = readMetricObservations(db, now);
    const metricById = new Map(observations.metrics.map((m) => [m.id, m]));
    const metricValue = (id: string): number | null => {
      const m = metricById.get(id);
      return m?.observation ? m.observation.value : null;
    };

    const openAlerts = db
      .prepare(
        `SELECT ma.id AS alertId, ma.metric_id AS metricId, ma.message, ma.created_at AS createdAt,
           m.name, m.owner, m.project, m.priority
         FROM metric_alerts ma
         INNER JOIN metrics m ON m.id = ma.metric_id
         WHERE ma.resolved_at IS NULL AND m.status = 'active'
         ORDER BY ma.created_at DESC, ma.id DESC
         LIMIT ?`,
      )
      .all(METRIC_LIST_LIMIT + 1) as Array<{
      alertId: number;
      metricId: string;
      message: string | null;
      createdAt: number | null;
      name: string | null;
      owner: string | null;
      project: string | null;
      priority: string | null;
    }>;
    const alertsTruncated = openAlerts.length > METRIC_LIST_LIMIT;
    const visibleAlerts = openAlerts.slice(0, METRIC_LIST_LIMIT);

    // Discover any additional App IDs referenced in retained DB tables so active data is never hidden.
    const dbAppRows = db
      .prepare(
        `SELECT DISTINCT app_id AS appId FROM (
           SELECT app_id FROM app_tasks
           UNION
           SELECT app_id FROM app_inbox_items
           UNION
           SELECT app_id FROM conversation_requests
           UNION
           SELECT app_id FROM execution_usage WHERE app_id IS NOT NULL AND app_id != ''
           UNION
           SELECT app_id FROM workflow_runs WHERE app_id IS NOT NULL AND app_id != ''
         ) WHERE app_id IS NOT NULL AND trim(app_id) != ''`,
      )
      .all() as Array<{ appId: string }>;

    const allAppIds = [...installedAppIds];
    const knownAppSet = new Set(allAppIds);
    for (const { appId } of dbAppRows) {
      if (appId === "platform" || appId.startsWith("system:")) continue;
      if (!knownAppSet.has(appId)) {
        knownAppSet.add(appId);
        allAppIds.push(appId);
      }
    }

    let hostOpenAlerts = 0;
    const appOpenAlerts = new Map<string, number>();
    for (const alert of visibleAlerts) {
      const scope = classifyMetricScope(
        { id: alert.metricId, owner: alert.owner, project: alert.project },
        knownAppSet,
      );
      if (scope.kind === "host") {
        hostOpenAlerts += 1;
      } else {
        appOpenAlerts.set(scope.appId, (appOpenAlerts.get(scope.appId) ?? 0) + 1);
      }
    }

    const appMetricCounts = new Map<string, { total: number; fresh: number; staleOrMissing: number }>();
    let hostFreshMetrics = 0;
    let hostStaleMetrics = 0;
    let hostMissingMetrics = 0;
    let hostCollectionFailures = 0;
    let hostActiveMetrics = 0;

    for (const metric of observations.metrics) {
      const scope = classifyMetricScope(metric, knownAppSet);
      if (scope.kind === "host") {
        hostActiveMetrics += 1;
        if (metric.freshness === "fresh") hostFreshMetrics += 1;
        else if (metric.freshness === "stale") hostStaleMetrics += 1;
        else if (metric.freshness === "missing") hostMissingMetrics += 1;
        if (metric.collectionFailure?.afterLastSample) hostCollectionFailures += 1;
      } else {
        const entry = appMetricCounts.get(scope.appId) ?? { total: 0, fresh: 0, staleOrMissing: 0 };
        entry.total += 1;
        if (metric.freshness === "fresh") entry.fresh += 1;
        else entry.staleOrMissing += 1;
        appMetricCounts.set(scope.appId, entry);
      }
    }

    // Host plumbing & recovery SQL facts.
    const hostWorkflowRow = db
      .prepare(
        `SELECT
           COUNT(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') THEN 1 END) AS finished,
           COUNT(CASE WHEN status = 'error' THEN 1 END) AS errors
         FROM workflow_runs
         WHERE parentWorkflowRunId IS NULL AND endedAt >= ? AND endedAt < ?`,
      )
      .get(start, end) as { finished: number; errors: number };

    const hostAttemptRow = db
      .prepare(
        `SELECT
           COUNT(CASE WHEN state IN ('completed', 'failed', 'cancelled') THEN 1 END) AS terminal,
           COUNT(CASE WHEN state = 'failed' THEN 1 END) AS failed,
           COUNT(CASE WHEN json_extract(attempt_json, '$.failoverFromAttemptId') IS NOT NULL THEN 1 END) AS failovers
         FROM app_task_attempts
         WHERE started_at >= ? AND started_at < ?`,
      )
      .get(start, end) as { terminal: number; failed: number; failovers: number };

    const recoveryRow = db
      .prepare(
        `SELECT
           COUNT(*) AS unresolvedCount,
           MIN(created_at) AS oldestCreatedAt
         FROM app_inbox_items
         WHERE status != 'done' AND recovery_json IS NOT NULL`,
      )
      .get() as { unresolvedCount: number; oldestCreatedAt: number | null };

    const expiredTaskLeases =
      (
        db
          .prepare(
            `SELECT
               (SELECT COUNT(*) FROM app_tasks t
                LEFT JOIN app_task_cancellations c ON c.app_id = t.app_id AND c.task_id = t.task_id
                WHERE c.task_id IS NULL AND t.lease_until IS NOT NULL AND t.lease_until < ?) +
               (SELECT COUNT(*) FROM app_task_attempts WHERE state = 'running' AND lease_until IS NOT NULL AND lease_until < ?) AS expired`,
          )
          .get(now, now) as { expired: number }
      )?.expired ?? 0;

    // Per-App Task states & oldest non-converged open task age (excluding closed/cancelled tasks in app_task_cancellations).
    const taskPhaseExpr = taskViewPhaseSql("t");
    const taskPhaseRows = db
      .prepare(
        `SELECT
           t.app_id AS appId,
           ${taskPhaseExpr} AS viewPhase,
           CASE
             WHEN c.task_id IS NOT NULL THEN 'closed'
             ELSE json_extract(t.resource_json, '$.status.closure.state')
           END AS closureState,
           COUNT(*) AS count,
           MIN(CASE WHEN c.task_id IS NULL
                     AND ${taskPhaseExpr} IN ('pending', 'running', 'waiting', 'attention')
                     AND json_extract(t.resource_json, '$.status.closure.state') IS NULL
                    THEN t.updated_at END) AS oldestOpenUpdatedAt
         FROM app_tasks t
         LEFT JOIN app_task_cancellations c ON c.app_id = t.app_id AND c.task_id = t.task_id
         GROUP BY t.app_id, viewPhase, closureState`,
      )
      .all() as Array<{
      appId: string;
      viewPhase: string;
      closureState: string | null;
      count: number;
      oldestOpenUpdatedAt: number | null;
    }>;

    // Finite Tasks explicitly closed with an accepted result in window.
    const closedTaskRows = db
      .prepare(
        `SELECT
           app_id AS appId,
           COUNT(CASE WHEN json_extract(cancellation_json, '$.acceptedResultAttemptId') IS NOT NULL THEN 1 END) AS closedTasksWindow
         FROM app_task_cancellations
         WHERE requested_at >= ? AND requested_at < ?
         GROUP BY app_id`,
      )
      .all(start, end) as Array<{ appId: string; closedTasksWindow: number }>;

    // Per-App attempt outcomes in window (total attempts, converged milestones, failures).
    const attemptTimeExpr = `COALESCE(
      CAST(unixepoch(json_extract(attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER),
      started_at
    )`;
    const appAttemptRows = db
      .prepare(
        `SELECT
           app_id AS appId,
           COUNT(*) AS totalAttempts,
           COUNT(CASE WHEN accepted_result_state = 'converged' THEN 1 END) AS convergedMilestones,
           COUNT(CASE WHEN state = 'failed' THEN 1 END) AS failedAttempts
         FROM app_task_attempts
         WHERE ${attemptTimeExpr} >= ? AND ${attemptTimeExpr} < ?
         GROUP BY app_id`,
      )
      .all(start, end) as Array<{
      appId: string;
      totalAttempts: number;
      convergedMilestones: number;
      failedAttempts: number;
    }>;

    // Per-App conversation requests (open backlog + closed in window).
    const requestRows = db
      .prepare(
        `SELECT
           app_id AS appId,
           COUNT(CASE WHEN status = 'open' THEN 1 END) AS openRequests,
           COUNT(CASE WHEN status = 'closed' AND updated_at >= ? AND updated_at < ? THEN 1 END) AS closedRequestsWindow,
           MIN(CASE WHEN status = 'open' THEN updated_at END) AS oldestOpenRequestAt
         FROM conversation_requests
         GROUP BY app_id`,
      )
      .all(start, end) as Array<{
      appId: string;
      openRequests: number;
      closedRequestsWindow: number;
      oldestOpenRequestAt: number | null;
    }>;

    // Per-App open human Conditions (only when unrouted or routed to at least one non-cancelled Task).
    const humanConditionRows = db
      .prepare(
        `SELECT cond.app_id AS appId, COUNT(*) AS openHumanConditions
         FROM app_task_conditions cond
         WHERE cond.state != 'true'
           AND (trim(json_extract(cond.condition_json, '$.spec.owner')) = 'human'
             OR trim(json_extract(cond.condition_json, '$.spec.owner')) GLOB 'human:?*')
           AND (
             NOT EXISTS (
               SELECT 1 FROM app_task_condition_routes r
               WHERE r.app_id = cond.app_id AND r.condition_id = cond.condition_id
             )
             OR EXISTS (
               SELECT 1 FROM app_task_condition_routes r
               JOIN app_tasks t ON t.app_id = r.app_id AND t.task_id = r.task_id
               LEFT JOIN app_task_cancellations can ON can.app_id = t.app_id AND can.task_id = t.task_id
               WHERE r.app_id = cond.app_id AND r.condition_id = cond.condition_id AND can.task_id IS NULL
             )
           )
         GROUP BY cond.app_id`,
      )
      .all() as Array<{ appId: string; openHumanConditions: number }>;

    // Per-App human burden (human-originated inbox inputs admitted in window).
    const humanInputRows = db
      .prepare(
        `SELECT app_id AS appId, COUNT(*) AS humanInputsWindow
         FROM app_inbox_items
         WHERE source_kind = 'human' AND created_at >= ? AND created_at < ?
         GROUP BY app_id`,
      )
      .all(start, end) as Array<{ appId: string; humanInputsWindow: number }>;

    // Per-App workflow execution counts in window (top-level runs).
    const appWorkflowRows = db
      .prepare(
        `SELECT
           app_id AS appId,
           COUNT(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') THEN 1 END) AS finished,
           COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
           COUNT(CASE WHEN status = 'error' THEN 1 END) AS errors,
           COUNT(CASE WHEN status = 'blocked' THEN 1 END) AS blocked
         FROM workflow_runs
         WHERE parentWorkflowRunId IS NULL
           AND app_id IS NOT NULL AND app_id != ''
           AND endedAt >= ? AND endedAt < ?
         GROUP BY app_id`,
      )
      .all(start, end) as Array<{
      appId: string;
      finished: number;
      done: number;
      errors: number;
      blocked: number;
    }>;

    // Per-App agent invocation & token/cost usage in window.
    const complete =
      "outcome IS NOT NULL AND json_extract(data, '$.totals.replies') > 0 AND json_extract(data, '$.totals.measuredReplies') = json_extract(data, '$.totals.replies')";
    const appUsageRows = db
      .prepare(
        `SELECT
           app_id AS appId,
           COUNT(*) AS invocations,
           COUNT(CASE WHEN ${complete} THEN 1 END) AS measuredInvocations,
           SUM(COALESCE(json_extract(data, '$.totals.input'), 0) + COALESCE(json_extract(data, '$.totals.cacheRead'), 0) + COALESCE(json_extract(data, '$.totals.cacheWrite'), 0)) AS inputTokens,
           SUM(COALESCE(json_extract(data, '$.totals.output'), 0)) AS outputTokens,
           COUNT(CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = json_extract(data, '$.totals.replies') THEN 1 END) AS pricedInvocations,
           SUM(CASE WHEN ${complete} AND json_extract(data, '$.totals.estimatedCostReplies') = json_extract(data, '$.totals.replies')
             THEN COALESCE(json_extract(data, '$.totals.estimatedCost'), 0) END) AS estimatedCostUsd
         FROM execution_usage
         WHERE app_id IS NOT NULL AND app_id != ''
           AND started_at >= ? AND started_at < ?
         GROUP BY app_id`,
      )
      .all(start, end) as Array<{
      appId: string;
      invocations: number;
      measuredInvocations: number;
      inputTokens: number | null;
      outputTokens: number | null;
      pricedInvocations: number;
      estimatedCostUsd: number | null;
    }>;

    // Scorecards retained as accepted Task facts (`scorecard:<json>`).
    const scorecardFacts = readScorecardFacts(db, start, end);
    const hostScorecardFacts = scorecardFacts.filter(
      (f) => f.payload.targetKind === "host" || f.payload.rubricVersion === "host-rubric-v1",
    );
    const appScorecardFactsByApp = new Map<string, RawScorecardFact[]>();
    for (const fact of scorecardFacts) {
      if (fact.payload.targetKind === "host" || fact.payload.rubricVersion === "host-rubric-v1") continue;
      const targetApp =
        typeof fact.payload.appId === "string" && fact.payload.appId.trim()
          ? resolveCanonicalAppId(fact.payload.appId, knownAppSet)
          : fact.appId;
      if (!targetApp) continue;
      const list = appScorecardFactsByApp.get(targetApp) ?? [];
      list.push(fact);
      appScorecardFactsByApp.set(targetApp, list);
    }

    const closedTasksByApp = new Map(closedTaskRows.map((r) => [r.appId, r.closedTasksWindow]));
    const attemptsByApp = new Map(appAttemptRows.map((r) => [r.appId, r]));
    const requestsByApp = new Map(requestRows.map((r) => [r.appId, r]));
    const humanCondsByApp = new Map(humanConditionRows.map((r) => [r.appId, r.openHumanConditions]));
    const humanInputsByApp = new Map(humanInputRows.map((r) => [r.appId, r.humanInputsWindow]));
    const workflowsByApp = new Map(appWorkflowRows.map((r) => [r.appId, r]));
    const usageByApp = new Map(appUsageRows.map((r) => [r.appId, r]));

    const { hostTrends, appTrends } = buildWindowTrends(
      db,
      start,
      end,
      allAppIds,
      envProbes,
      recoveryRow.unresolvedCount,
    );

    const selectedAppIds = filterAppId ? allAppIds.filter((id) => id === filterAppId) : allAppIds;

    const apps = selectedAppIds.map((appId) => {
      const counts = {
        running: 0,
        waiting: 0,
        pending: 0,
        attention: 0,
        idle: 0,
        closed: 0,
      };
      let oldestOpenTaskAt: number | null = null;
      for (const row of taskPhaseRows) {
        if (row.appId !== appId) continue;
        if (row.closureState === "closed" || row.closureState === "cancelled") {
          counts.closed += row.count;
          continue;
        }
        if (row.viewPhase === "running") counts.running += row.count;
        else if (row.viewPhase === "waiting") counts.waiting += row.count;
        else if (row.viewPhase === "pending") counts.pending += row.count;
        else if (row.viewPhase === "attention") counts.attention += row.count;
        else if (row.viewPhase === "converged") counts.idle += row.count;
        if (row.oldestOpenUpdatedAt !== null && (oldestOpenTaskAt === null || row.oldestOpenUpdatedAt < oldestOpenTaskAt)) {
          oldestOpenTaskAt = row.oldestOpenUpdatedAt;
        }
      }

      const req = requestsByApp.get(appId);
      const oldestCandidate = [oldestOpenTaskAt, req?.oldestOpenRequestAt ?? null].filter(
        (v): v is number => v !== null && Number.isFinite(v),
      );
      const oldestOpenAt = oldestCandidate.length ? Math.min(...oldestCandidate) : null;
      const oldestOpenAgeMs = oldestOpenAt !== null && now >= oldestOpenAt ? now - oldestOpenAt : null;

      const attempts = attemptsByApp.get(appId);
      const wf = workflowsByApp.get(appId);
      const usage = usageByApp.get(appId);
      const taskAttemptsWindow = attempts?.totalAttempts ?? 0;
      // Native/Codex executors record in app_task_attempts without execution_usage rows.
      const agentInvocations = Math.max(usage?.invocations ?? 0, taskAttemptsWindow);
      const workflowRuns = wf?.finished ?? 0;
      const executionTotal = workflowRuns + agentInvocations;
      const metricSummary = appMetricCounts.get(appId) ?? { total: 0, fresh: 0, staleOrMissing: 0 };

      return {
        appId,
        installed: installedSet.has(appId),
        improvementWorkflow: "alex/develop-change",
        outcomes: {
          convergedMilestonesWindow: attempts?.convergedMilestones ?? 0,
          closedTasksWindow: closedTasksByApp.get(appId) ?? 0,
          closedRequestsWindow: req?.closedRequestsWindow ?? 0,
          openRequests: req?.openRequests ?? 0,
          tasks: counts,
          openTasksTotal: counts.running + counts.waiting + counts.pending + counts.attention,
          oldestOpenAgeMs,
        },
        blockers: {
          failedAttemptsWindow: attempts?.failedAttempts ?? 0,
          errorWorkflowsWindow: wf?.errors ?? 0,
          blockedWorkflowsWindow: wf?.blocked ?? 0,
          openHumanConditions: humanCondsByApp.get(appId) ?? 0,
          openAlerts: alertsTruncated ? null : (appOpenAlerts.get(appId) ?? 0),
          visibleOpenAlerts: appOpenAlerts.get(appId) ?? 0,
        },
        humanBurden: {
          humanInputsWindow: humanInputsByApp.get(appId) ?? 0,
        },
        costAndLeverage: {
          taskAttemptsWindow,
          agentInvocationsWindow: agentInvocations,
          measuredInvocationsWindow: usage?.measuredInvocations ?? 0,
          workflowRunsWindow: workflowRuns,
          workflowDoneWindow: wf?.done ?? 0,
          workflowOffloadShare:
            executionTotal > 0 ? Math.round((workflowRuns / executionTotal) * 1000) / 1000 : null,
          inputTokensWindow: usage && usage.measuredInvocations > 0 ? (usage.inputTokens ?? 0) : null,
          outputTokensWindow: usage && usage.measuredInvocations > 0 ? (usage.outputTokens ?? 0) : null,
          pricedInvocationsWindow: usage?.pricedInvocations ?? 0,
          estimatedCostUsdWindow:
            usage && usage.pricedInvocations > 0 && usage.estimatedCostUsd !== null
              ? Math.round(usage.estimatedCostUsd * 10000) / 10000
              : null,
        },
        metrics: {
          defined: metricSummary.total,
          fresh: metricSummary.fresh,
          staleOrMissing: metricSummary.staleOrMissing,
          catalogTruncated: observations.truncated,
        },
        trends: appTrends.get(appId) ?? null,
        scorecard: summarizeAppScorecard(appScorecardFactsByApp.get(appId) ?? []),
      };
    });

    // Optional App drill-down (`?appId=<id>`): contributing Tasks, Agents, and Workflows.
    const appDetail = filterAppId
      ? buildAppDrillDown(db, filterAppId, start, end, appScorecardFactsByApp.get(filterAppId) ?? [])
      : null;

    const host = {
      improvementWorkflow: "alex/develop-host-change",
      plumbing: {
        unhandledSignals1h: metricValue("event.unhandled-signal-count-1h"),
        subscriberFailures1h: metricValue("infra.bus.subscriber-failed-count-1h"),
        workflowFinishedWindow: hostWorkflowRow.finished,
        workflowErrorsWindow: hostWorkflowRow.errors,
        terminalTaskAttemptsWindow: hostAttemptRow.terminal,
        failedTaskAttemptsWindow: hostAttemptRow.failed,
      },
      recovery: {
        unresolvedInputRecoveryCount: recoveryRow.unresolvedCount,
        oldestInputRecoveryAgeMs:
          recoveryRow.oldestCreatedAt !== null && now >= recoveryRow.oldestCreatedAt
            ? now - recoveryRow.oldestCreatedAt
            : null,
        expiredLeasesCount: expiredTaskLeases,
        taskFailoversWindow: hostAttemptRow.failovers,
      },
      headroom: {
        disk: envProbes.disk,
        auth: envProbes.auth,
        sensors: {
          activeMetrics: hostActiveMetrics,
          freshMetrics: hostFreshMetrics,
          staleMetrics: hostStaleMetrics,
          missingMetrics: hostMissingMetrics,
          collectionFailuresAfterSample: hostCollectionFailures,
          catalogTruncated: observations.truncated,
        },
        openAlerts: alertsTruncated ? null : hostOpenAlerts,
        visibleOpenAlerts: hostOpenAlerts,
      },
      overhead: {
        daemonSqlTimePercent: metricValue("may.daemon-sql-time-percent"),
        daemonSqlWorstMs: metricValue("may.daemon-sql-recent-worst-call-ms"),
        skippedCheckRatePerMin: metricValue("task.skipped-check-rate"),
        metricQueryWorstMs: metricValue("metric.source-query-worst-ms"),
      },
      trends: hostTrends,
      scorecard: summarizeHostScorecard(hostScorecardFacts),
    };

    const result = {
      generatedAt: now,
      window: { start, end },
      alertsTruncated,
      metricsTruncated: observations.truncated,
      host,
      apps,
      appDetail,
    };
    db.exec("RELEASE observability_summary_read");
    return result;
  } catch (error) {
    db.exec("ROLLBACK TO observability_summary_read");
    db.exec("RELEASE observability_summary_read");
    throw error;
  }
}

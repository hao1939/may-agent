import { existsSync, readdirSync, readFileSync, statSync, statfsSync } from "node:fs";
import { opendir, rmdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SqliteDb } from "../../../lib/db.js";
import { taskViewPhaseSql } from "../../core/state/task-view-phase.js";
import {
  ATTEMPT_FINISH_LOOKBACK_SLACK_MS,
  attemptFinishMsSql,
  terminalAttemptWindowPredicateSql,
} from "./evolution-metrics.js";
import { METRIC_LIST_LIMIT, readMetricObservations } from "./metric-observations.js";
import { healthWindow } from "./workflow-health.js";

export type MetricScope = { kind: "host" } | { kind: "app"; appId: string };

export type AppCatalogEntry = {
  id: string;
  owner: string;
  improvementWorkflow?: string | null;
};

export type AppCatalog = {
  installedIds: string[];
  installedSet: Set<string>;
  trulyInstalledSet?: Set<string>;
  visibleAppIds?: string[];
  disabledSet: Set<string>;
  ownerByAppId: Map<string, string>;
  appIdByOwner: Map<string, string>;
  improvementWorkflowByAppId?: Map<string, string>;
};

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

/** Historical `may.*` IDs that measure fleet/daemon infrastructure rather than App domain outcomes. */
const HOST_METRIC_IDS = new Set([
  "may.daemon-sql-recent-worst-call-ms",
  "may.daemon-sql-time-percent",
  "may.failed-task-attempts-24h",
  "may.failed-workflow-runs-24h",
  "may.max-task-recent-model-replies",
  "may.oldest-input-recovery-age-seconds",
  "may.unresolved-input-recovery-count",
]);

function normalizeAppKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/^(?:app|agent|project):/i, "")
    .replace(/^projects\//i, "")
    .replace(/\/project\.(md|json)$/i, "")
    .replace(/\.app$/i, "");
}

function readDisabledAppIdFromFile(dir: string): string | null {
  for (const file of ["app.ts", "app.js"]) {
    const candidate = join(dir, file);
    if (!existsSync(candidate)) continue;
    try {
      const source = readFileSync(candidate, "utf8");
      const defineIdx = source.search(/\bdefineApp\s*\(\s*\{/);
      const exportIdx = source.search(/\bexport\s+default\s*\{/);
      const startIdx = defineIdx >= 0 ? defineIdx : exportIdx;
      if (startIdx < 0) continue;
      const tail = source.slice(startIdx, startIdx + 2_000);
      const idMatch = tail.match(/\bid\s*:\s*["']([^"']+)["']/);
      if (idMatch?.[1]?.trim()) return normalizeAppKey(idMatch[1]);
    } catch {
      /* Ignore unreadable disabled file. */
    }
  }
  return null;
}

/**
 * Resolves the authoritative App catalog from the daemon's loaded App registry
 * (`services.listApps()` / `HumanTaskService.listApps()`), never inventing installed
 * Apps from filesystem directory stems or unvalidated module files, while recording
 * `.disabled` Apps so retained DB rows for disabled Apps stay excluded from active backlogs.
 */
export function resolveAppCatalog(options: {
  projectsRoot?: string;
  loadedApps?: ReadonlyArray<Record<string, unknown>> | null;
  disabledAppIds?: Iterable<string>;
}): AppCatalog {
  const installedIds: string[] = [];
  const installedSet = new Set<string>();
  const disabledSet = new Set<string>();
  const ownerByAppId = new Map<string, string>();
  const appIdByOwner = new Map<string, string>();
  const improvementWorkflowByAppId = new Map<string, string>();

  if (options.disabledAppIds) {
    for (const raw of options.disabledAppIds) {
      const id = normalizeAppKey(raw);
      if (id) disabledSet.add(id);
    }
  }

  const projectsRoot = options.projectsRoot ?? "";
  if (projectsRoot && existsSync(projectsRoot)) {
    try {
      for (const entry of readdirSync(projectsRoot).sort()) {
        if (!entry.endsWith(".app")) continue;
        const stem = entry.slice(0, -".app".length);
        const dir = join(projectsRoot, entry);
        try {
          if (!statSync(dir).isDirectory()) continue;
          if (existsSync(join(dir, ".disabled"))) {
            disabledSet.add(stem);
            const declaredId = readDisabledAppIdFromFile(dir);
            if (declaredId) disabledSet.add(declaredId);
          }
        } catch {
          /* Skip unreadable directory entries. */
        }
      }
    } catch {
      /* Ignore unreadable projectsRoot. */
    }
  }

  if (Array.isArray(options.loadedApps)) {
    for (const item of options.loadedApps) {
      if (!item || typeof item !== "object") continue;
      const idRaw = typeof item.id === "string" ? item.id : typeof item.appId === "string" ? item.appId : "";
      const id = normalizeAppKey(idRaw);
      if (!id || disabledSet.has(id)) continue;
      if (!installedSet.has(id)) {
        installedSet.add(id);
        installedIds.push(id);
      }
      const ownerRaw = typeof item.owner === "string" ? item.owner : typeof item.agent === "string" ? item.agent : "";
      const owner = normalizeAppKey(ownerRaw) || id;
      ownerByAppId.set(id, owner);
      if (!appIdByOwner.has(owner)) appIdByOwner.set(owner, id);
      if (typeof item.improvementWorkflow === "string" && item.improvementWorkflow.trim()) {
        improvementWorkflowByAppId.set(id, item.improvementWorkflow.trim());
      }
    }
  }

  installedIds.sort((a, b) => a.localeCompare(b));
  return {
    installedIds,
    installedSet,
    trulyInstalledSet: new Set(installedSet),
    visibleAppIds: [...installedIds],
    disabledSet,
    ownerByAppId,
    appIdByOwner,
    improvementWorkflowByAppId,
  };
}

/**
 * Shared catalog resolver used identically by `/api/metrics` and `/api/observability`
 * so metric scope classification and App cards never diverge.
 */
export function resolveObservabilityCatalog(
  db: SqliteDb,
  options: {
    projectsRoot?: string;
    loadedApps?: ReadonlyArray<Record<string, unknown>> | null;
    disabledAppIds?: Iterable<string>;
    filterAppId?: string | null;
  },
): AppCatalog & { trulyInstalledSet: Set<string>; visibleAppIds: string[]; hasAuthoritativeApps: boolean } {
  const base = resolveAppCatalog(options);
  const hasAuthoritativeApps = Array.isArray(options.loadedApps);
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

  const visibleAppIds = [...base.installedIds];
  const visibleSet = new Set(visibleAppIds);
  for (const { appId } of dbAppRows) {
    const clean = normalizeAppKey(appId);
    if (!clean || clean === "platform" || clean.startsWith("system:")) continue;
    if (base.disabledSet.has(clean)) continue;
    if (hasAuthoritativeApps && options.filterAppId !== clean) continue;
    if (!visibleSet.has(clean)) {
      visibleSet.add(clean);
      visibleAppIds.push(clean);
    }
  }
  visibleAppIds.sort((a, b) => a.localeCompare(b));
  const classificationSet = hasAuthoritativeApps
    ? new Set(base.installedSet)
    : new Set([...base.installedSet, ...visibleSet]);
  if (options.filterAppId && visibleSet.has(options.filterAppId)) {
    classificationSet.add(options.filterAppId);
  }

  return {
    ...base,
    installedSet: classificationSet,
    trulyInstalledSet: new Set(base.installedSet),
    visibleAppIds,
    hasAuthoritativeApps,
  };
}

function resolveCatalogAppId(candidate: string | null | undefined, catalog?: AppCatalog): string {
  const clean = normalizeAppKey(candidate);
  if (!clean) return "";
  if (catalog) {
    if (catalog.installedSet.has(clean)) return clean;
    const byOwner = catalog.appIdByOwner.get(clean);
    if (byOwner) return byOwner;
  }
  return clean;
}

function parseMetricConfigObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Classifies a metric into Host platform scope vs. accountable App scope using
 * explicit declarations and the loaded App catalog — with zero hardcoded App names.
 */
export function classifyMetricScope(
  metric: { id: string; owner?: string | null; project?: string | null; config?: unknown },
  catalogOrSet?: AppCatalog | ReadonlySet<string>,
): MetricScope {
  const catalog: AppCatalog | undefined =
    catalogOrSet && "installedSet" in catalogOrSet
      ? catalogOrSet
      : catalogOrSet instanceof Set
        ? {
            installedIds: [...catalogOrSet],
            installedSet: new Set(catalogOrSet),
            disabledSet: new Set(),
            ownerByAppId: new Map([...catalogOrSet].map((id) => [id, id])),
            appIdByOwner: new Map([...catalogOrSet].map((id) => [id, id])),
          }
        : undefined;

  const cfg = parseMetricConfigObject(metric.config);
  if (cfg?.scope === "host") return { kind: "host" };
  if (typeof cfg?.scope === "string" && cfg.scope.startsWith("app:")) {
    const explicitApp = resolveCatalogAppId(cfg.scope.slice(4), catalog);
    if (explicitApp) return { kind: "app", appId: explicitApp };
  }

  const id = String(metric.id ?? "").trim();
  const lowerId = id.toLowerCase();
  if (HOST_METRIC_IDS.has(lowerId)) return { kind: "host" };
  if (HOST_METRIC_PREFIXES.some((prefix) => lowerId.startsWith(prefix))) return { kind: "host" };

  const projectRaw = normalizeAppKey(metric.project);
  if (projectRaw && projectRaw !== "platform" && !projectRaw.startsWith("system:")) {
    const resolvedProject = resolveCatalogAppId(projectRaw, catalog);
    // Avoid mistaking legacy `project: 'may'` + `owner: 'may'` Host declarations unless not in HOST_METRIC_IDS.
    if (!catalog || catalog.installedSet.has(resolvedProject) || !catalog.disabledSet.has(resolvedProject)) {
      return { kind: "app", appId: resolvedProject };
    }
  }

  const ownerTrimmed = String(metric.owner ?? "").trim();
  if (ownerTrimmed.toLowerCase().startsWith("system:")) return { kind: "host" };
  const ownerKey = normalizeAppKey(ownerTrimmed);
  if (ownerKey && catalog) {
    if (catalog.installedSet.has(ownerKey)) return { kind: "app", appId: ownerKey };
    const mappedByOwner = catalog.appIdByOwner.get(ownerKey);
    if (mappedByOwner) return { kind: "app", appId: mappedByOwner };
  }

  const prefix = lowerId.split(".", 1)[0] ?? "";
  if (prefix) {
    const resolvedPrefix = resolveCatalogAppId(prefix, catalog);
    if (catalog?.installedSet.has(resolvedPrefix)) return { kind: "app", appId: resolvedPrefix };
    if (!catalog && resolvedPrefix) return { kind: "app", appId: resolvedPrefix };
  }
  if (ownerKey) return { kind: "app", appId: resolveCatalogAppId(ownerKey, catalog) };
  return { kind: "host" };
}

let lastAutoHygieneAt = 0;
const AUTO_HYGIENE_COOLDOWN_MS = 3_600_000; // 1 hour
const DEFAULT_HYGIENE_MAX_ENTRIES = 32;
const DEFAULT_HYGIENE_DEADLINE_MS = 2_000;
let inFlightCacheHygiene: Promise<{ prunedEntries: number; stoppedByBudget: boolean }> | null = null;

export type DiskCacheHygieneOptions = {
  now?: number;
  cacheDir?: string;
  maxEntries?: number;
  deadlineMs?: number;
  ignoreCooldown?: boolean;
};

/**
 * Bounded asynchronous build-cache hygiene (`0` Git subprocesses, `0` workspace/worktree
 * deletions, off the synchronous metric sampling path). Traverses incrementally with
 * descendant-entry and wall-clock deadline checks before each `unlink`/`rmdir`, never
 * issuing an unbounded recursive `rm()`.
 */
export async function runBoundedDiskCacheHygiene(
  opts: DiskCacheHygieneOptions = {},
): Promise<{ prunedEntries: number; stoppedByBudget: boolean }> {
  const now = opts.now ?? Date.now();
  if (!opts.ignoreCooldown && now - lastAutoHygieneAt < AUTO_HYGIENE_COOLDOWN_MS) {
    return { prunedEntries: 0, stoppedByBudget: false };
  }
  lastAutoHygieneAt = now;
  const cacheDir = opts.cacheDir ?? join(homedir(), ".cache", "go-build");
  const maxEntries = Math.max(1, opts.maxEntries ?? DEFAULT_HYGIENE_MAX_ENTRIES);
  const deadlineMs = Math.max(25, opts.deadlineMs ?? DEFAULT_HYGIENE_DEADLINE_MS);
  const startedAt = performance.now();
  let prunedEntries = 0;
  let stoppedByBudget = false;
  type OpenDirFrame = { path: string; dir: Awaited<ReturnType<typeof opendir>>; isRoot: boolean };
  const stack: OpenDirFrame[] = [];
  const overBudget = () => prunedEntries >= maxEntries || performance.now() - startedAt >= deadlineMs;

  try {
    stack.push({ path: cacheDir, dir: await opendir(cacheDir), isRoot: true });
    while (stack.length > 0) {
      if (overBudget()) {
        stoppedByBudget = true;
        break;
      }
      const top = stack[stack.length - 1]!;
      const dirent = await top.dir.read();
      if (dirent === null) {
        stack.pop();
        await top.dir.close();
        if (!top.isRoot) {
          if (overBudget()) {
            stoppedByBudget = true;
            break;
          }
          try {
            await rmdir(top.path);
            prunedEntries += 1;
          } catch {
            /* Non-empty or concurrently modified directory. */
          }
          await new Promise<void>((resolveTick) => setTimeout(resolveTick, 0));
        }
        continue;
      }
      if (overBudget()) {
        stoppedByBudget = true;
        break;
      }
      const entryPath = join(top.path, dirent.name);
      if (dirent.isDirectory() && !dirent.isSymbolicLink()) {
        try {
          stack.push({ path: entryPath, dir: await opendir(entryPath), isRoot: false });
        } catch {
          /* Skip unreadable subdirectory. */
        }
      } else {
        try {
          await unlink(entryPath);
          prunedEntries += 1;
        } catch {
          /* Skip concurrently removed entry. */
        }
        await new Promise<void>((resolveTick) => setTimeout(resolveTick, 0));
      }
    }
  } catch {
    /* Missing or unreadable disposable cache dir is a safe no-op. */
  } finally {
    while (stack.length > 0) {
      const frame = stack.pop()!;
      try {
        await frame.dir.close();
      } catch {
        /* Ignore close errors on cleanup. */
      }
    }
  }
  return { prunedEntries, stoppedByBudget };
}

export function scheduleBoundedDiskCacheHygiene(
  now = Date.now(),
  opts: Omit<DiskCacheHygieneOptions, "now"> = {},
): boolean {
  if (inFlightCacheHygiene) return false;
  if (!opts.ignoreCooldown && now - lastAutoHygieneAt < AUTO_HYGIENE_COOLDOWN_MS) return false;
  inFlightCacheHygiene = runBoundedDiskCacheHygiene({ ...opts, now }).finally(() => {
    inFlightCacheHygiene = null;
  });
  return true;
}

export type DiskHeadroom = {
  totalBytes: number;
  availableBytes: number;
  usedPercent: number;
};

export type AuthHeadroom = {
  provider: "azure-cli";
  state: "valid" | "refreshable" | "expired" | "unconfigured" | "unknown";
  expiresAt: number | null;
  reason?: string;
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
    return {
      provider: "azure-cli",
      state: "unknown",
      expiresAt: null,
      reason: "Azure CLI profile exists without readable msal_token_cache.json",
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(cachePath, "utf8")) as {
      AccessToken?: Record<string, { expires_on?: string | number }>;
      RefreshToken?: Record<string, unknown>;
      Account?: Record<string, unknown>;
    };
    const entries = Object.values(parsed?.AccessToken ?? {});
    const refreshCount = Object.keys(parsed?.RefreshToken ?? {}).length;
    const accountCount = Object.keys(parsed?.Account ?? {}).length;
    if (!entries.length) {
      if (refreshCount > 0) {
        return { provider: "azure-cli", state: "refreshable", expiresAt: null };
      }
      if (accountCount === 0) {
        return { provider: "azure-cli", state: "unconfigured", expiresAt: null };
      }
      return {
        provider: "azure-cli",
        state: "expired",
        expiresAt: null,
        reason: "Azure CLI account has no cached refresh or access token",
      };
    }
    let latestExpiresAt: number | null = null;
    for (const entry of entries) {
      const sec = Number(entry?.expires_on);
      if (Number.isFinite(sec) && sec > 0) {
        const ms = sec * 1000;
        if (latestExpiresAt === null || ms > latestExpiresAt) latestExpiresAt = ms;
      }
    }
    if (latestExpiresAt === null) {
      return {
        provider: "azure-cli",
        state: "unknown",
        expiresAt: null,
        reason: "Azure CLI msal_token_cache.json is missing numeric expires_on metadata",
      };
    }
    if (latestExpiresAt <= now && refreshCount > 0) {
      return { provider: "azure-cli", state: "refreshable", expiresAt: null };
    }
    return {
      provider: "azure-cli",
      state: latestExpiresAt > now ? "valid" : "expired",
      expiresAt: latestExpiresAt,
    };
  } catch {
    return {
      provider: "azure-cli",
      state: "unknown",
      expiresAt: null,
      reason: "Azure CLI msal_token_cache.json is unreadable or malformed JSON",
    };
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
  const tsExpr = `COALESCE(
    CAST(unixepoch(json_extract(a.attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER),
    a.started_at
  )`;
  const rows = db
    .prepare(
      `SELECT a.app_id AS appId, a.task_id AS taskId, a.attempt_id AS attemptId,
        ${tsExpr} AS timestamp,
        f.value AS fact
      FROM app_task_attempts a, json_each(a.attempt_json, '$.acceptedResult.facts') f
      WHERE instr(a.attempt_json, 'scorecard:') > 0
        AND ${tsExpr} >= ? AND ${tsExpr} < ?
        AND a.accepted_result_state IS NOT NULL
        AND f.type = 'text'
        AND substr(f.value, 1, 10) = 'scorecard:'
        AND length(f.value) <= 8000`,
    )
    .all(start, end) as Array<{
    appId: string;
    taskId: string;
    attemptId: string;
    timestamp: number;
    fact: string;
  }>;

  const parsed: RawScorecardFact[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.timestamp) || row.timestamp < start || row.timestamp >= end) continue;
    try {
      const payload = JSON.parse(row.fact.slice("scorecard:".length)) as Record<string, unknown>;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
      if (payload.version !== 1) continue;
      if (payload.rubricVersion !== "app-rubric-v1" && payload.rubricVersion !== "host-rubric-v1") continue;
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
  const appFacts = facts.filter((f) => f.payload.rubricVersion === "app-rubric-v1");
  const dimensions = Object.fromEntries(
    APP_RUBRIC_DIMENSIONS.map((dim) => [dim, { mean: null, assessed: 0, unknown: 0, notApplicable: 0 }]),
  ) as AppScorecardSummary["dimensions"];

  if (!appFacts.length) {
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

  // Deduplicate by (appId, taskId, cohort || attemptId) keeping newest assessment across multi-App rollups.
  const seen = new Set<string>();
  const unique: RawScorecardFact[] = [];
  for (const item of appFacts) {
    const subjectApp =
      typeof item.payload.appId === "string" && item.payload.appId.trim()
        ? normalizeAppKey(item.payload.appId)
        : item.appId;
    const subjectTask = typeof item.payload.taskId === "string" && item.payload.taskId.trim() ? item.payload.taskId.trim() : item.taskId;
    const cohort = typeof item.payload.cohort === "string" && item.payload.cohort.trim() ? item.payload.cohort.trim() : item.attemptId;
    const key = `${subjectApp}::${subjectTask}::${cohort}`;
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
  const hostFacts = facts.filter((f) => f.payload.rubricVersion === "host-rubric-v1");
  const dimensions = Object.fromEntries(
    HOST_RUBRIC_DIMENSIONS.map((dim) => [dim, { mean: null, assessed: 0, unknown: 0, notApplicable: 0 }]),
  ) as HostScorecardSummary["dimensions"];

  if (!hostFacts.length) {
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

  for (const item of hostFacts) {
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
    sampleSize: hostFacts.length,
    confidence: hostFacts.length >= 5 ? "calibrated" : "low-sample",
    latestAt: hostFacts[0]?.timestamp ?? null,
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

  // 1a. Terminal Attempt bucket facts (Host + per-App) aligned on shared finish-time cohort `[start, end)`.
  const finishMsExpr = attemptFinishMsSql("a");
  const terminalCohortPredicate = terminalAttemptWindowPredicateSql("?", "?", "a");
  const terminalAttemptBuckets = db
    .prepare(
      `SELECT
         a.app_id AS appId,
         MIN(${TREND_BUCKETS - 1}, MAX(0, CAST((${finishMsExpr} - ?) / ? AS INTEGER))) AS b,
         COUNT(*) AS terminal,
         COUNT(CASE WHEN a.state = 'completed' AND a.accepted_result_state IS NOT NULL THEN 1 END) AS settled,
         COUNT(CASE WHEN a.state IN ('failed', 'interrupted') THEN 1 END) AS friction,
         COUNT(CASE WHEN a.state = 'completed' AND a.accepted_result_state = 'converged' THEN 1 END) AS converged,
         COUNT(CASE WHEN COALESCE(a.accepted_result_state, '') != 'converged' THEN 1 END) AS nonConverged
       FROM app_task_attempts a
       WHERE ${terminalCohortPredicate}
       GROUP BY a.app_id, b`,
    )
    .all(start, bucketWidth, end, start, end) as Array<{
    appId: string;
    b: number;
    terminal: number;
    settled: number;
    friction: number;
    converged: number;
    nonConverged: number;
  }>;

  // 1b. Started disjoint non-workflow Attempt bucket facts (for workflow offload denominator).
  const usageLookbackStart = start - 7 * 86_400_000;
  const startedAttemptBuckets = db
    .prepare(
      `WITH usage_attempts AS MATERIALIZED (
         SELECT DISTINCT app_id, attempt_id
         FROM execution_usage
         WHERE started_at >= ? AND started_at < ?
           AND attempt_id IS NOT NULL AND attempt_id != ''
       )
       SELECT
         a.app_id AS appId,
         MIN(${TREND_BUCKETS - 1}, MAX(0, CAST((a.started_at - ?) / ? AS INTEGER))) AS b,
         COUNT(CASE WHEN ua.attempt_id IS NULL
           AND COALESCE(json_extract(a.attempt_json, '$.handler'), '') NOT LIKE 'workflow:%'
           AND NOT EXISTS (
             SELECT 1 FROM execution_usage u
             WHERE u.session_id = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '')
               AND u.app_id = a.app_id
           ) THEN 1 END) AS disjointAgentAttempts
       FROM app_task_attempts a
       LEFT JOIN usage_attempts ua ON ua.app_id = a.app_id AND ua.attempt_id = a.attempt_id
       WHERE a.started_at >= ? AND a.started_at < ?
       GROUP BY a.app_id, b`,
    )
    .all(usageLookbackStart, end, start, bucketWidth, start, end) as Array<{
    appId: string;
    b: number;
    disjointAgentAttempts: number;
  }>;

  // 2. Workflow bucket facts (Host + per-App, preferring app_id over projectId).
  const wfBuckets = db
    .prepare(
      `SELECT
         COALESCE(NULLIF(trim(app_id), ''), NULLIF(trim(projectId), ''), '') AS appId,
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
         workflow_run_id AS workflowRunId,
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
    workflowRunId: string | null;
    isComplete: number;
    cacheRead: number;
    exposure: number;
    pricedUsd: number | null;
    prepMs: number | null;
    taskBytes: number | null;
    promptBytes: number | null;
  }>;

  // 4. Closed requests and human steers per bucket.
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
    unpricedCount: number[];
    nonConverged: number[];
    finishedAttempts: number[];
    agentExecutions: number[];
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
        unpricedCount: zeros(),
        nonConverged: zeros(),
        finishedAttempts: zeros(),
        agentExecutions: zeros(),
        wfDone: zeros(),
        wfTotal: zeros(),
        humanTouches: zeros(),
      };
      byApp.set(id, entry);
    }
    return entry;
  };
  for (const id of appIds) ensureApp(id);

  for (const r of terminalAttemptBuckets) {
    hostSettled[r.b] += r.settled;
    hostTerminal[r.b] += r.terminal;
    hostFriction[r.b] += r.friction;
    hostExecUnits[r.b] += r.terminal;
    if (r.appId) {
      const a = ensureApp(r.appId);
      a.outcomes[r.b] += r.converged;
      a.outcomeExposure[r.b] += r.terminal;
      a.nonConverged[r.b] += r.nonConverged;
      a.finishedAttempts[r.b] += r.terminal;
    }
  }

  for (const r of startedAttemptBuckets) {
    if (r.appId) {
      const a = ensureApp(r.appId);
      a.agentExecutions[r.b] += r.disjointAgentAttempts;
      a.unpricedCount[r.b] += r.disjointAgentAttempts;
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
    if (r.appId && !r.workflowRunId) {
      ensureApp(r.appId).agentExecutions[b] += 1;
    }
    if (r.appId) {
      const a = ensureApp(r.appId);
      if (typeof r.pricedUsd === "number" && Number.isFinite(r.pricedUsd)) {
        a.pricedUsd[b] += r.pricedUsd;
        a.pricedCount[b] += 1;
      } else {
        a.unpricedCount[b] += 1;
      }
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
    const totalUnpriced = a.unpricedCount.reduce((s, x) => s + x, 0);
    // Require complete pricing coverage (`unpricedCount === 0`) so partial spend never masquerades as full cost/outcome.
    const costNums = a.pricedUsd.map((usd, i) =>
      a.pricedCount[i]! > 0 && a.unpricedCount[i]! === 0 && a.outcomes[i]! > 0 ? usd : 0,
    );
    const costDens = a.outcomes.map((outc, i) =>
      a.pricedCount[i]! > 0 && a.unpricedCount[i]! === 0 && outc > 0 ? outc : 0,
    );
    const costSeries = buildRatioTrend({
      metricId: `${appId}.cost_per_outcome_usd_7d`,
      label: "Cost / outcome",
      unit: "usd",
      goodDirection: "down",
      bucketStarts,
      numerators: costNums,
      denominators: costDens,
    });
    const windowOutcomes = a.outcomes.reduce((s, x) => s + x, 0);
    const windowUsd = a.pricedUsd.reduce((s, x) => s + x, 0);
    const completeWindowPricing = totalPriced > 0 && totalUnpriced === 0;
    costSeries.current = completeWindowPricing && windowOutcomes > 0 ? roundMetric(windowUsd / windowOutcomes) : null;
    costSeries.sampleSize = completeWindowPricing && windowOutcomes > 0 ? windowOutcomes : 0;

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
        denominators: a.wfTotal.map((w, i) => w + (a.agentExecutions[i] ?? 0)),
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
  const finishMsExpr = attemptFinishMsSql("a");
  const terminalLookbackStart = start - ATTEMPT_FINISH_LOOKBACK_SLACK_MS;

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
          WHERE +a.app_id = t.app_id AND +a.task_id = t.task_id
            AND a.state = 'completed' AND a.accepted_result_state = 'converged'
            AND ${terminalAttemptWindowPredicateSql("?", "?", "a")}) AS convergedWindow,
         (SELECT COUNT(*) FROM app_task_attempts a
          WHERE +a.app_id = t.app_id AND +a.task_id = t.task_id
            AND a.state = 'failed'
            AND ${terminalAttemptWindowPredicateSql("?", "?", "a")}) AS failedWindow
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
    .all(end, start, end, end, start, end, appId, start) as Array<{
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

  // Agents contributing to this App in the window (preferring app_id, falling back to projectId only when absent).
  const sessionAgentRows = db
    .prepare(
      `SELECT
         agent,
         COUNT(*) AS sessionsWindow,
         COUNT(CASE WHEN status = 'error' THEN 1 END) AS errorsWindow
       FROM sessions
       WHERE COALESCE(NULLIF(trim(app_id), ''), NULLIF(trim(projectId), '')) = ?
         AND agent IS NOT NULL AND agent != ''
         AND startedAt >= ? AND startedAt < ?
       GROUP BY agent`,
    )
    .all(appId, start, end) as Array<{ agent: string; sessionsWindow: number; errorsWindow: number }>;

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

  // Attribute Task attempts to the resolved owner retained on each attempt (`$.owner`),
  // deduplicating only against usage/sessions counted in the same `[start, end)` window.
  const usageLookbackStart = start - 7 * 86_400_000;
  const attemptAgentRows = db
    .prepare(
      `WITH usage_attempts AS MATERIALIZED (
         SELECT DISTINCT attempt_id
         FROM execution_usage
         WHERE started_at >= ? AND started_at < ?
           AND app_id = ?
           AND attempt_id IS NOT NULL AND attempt_id != ''
       )
       SELECT
         COALESCE(
           NULLIF(trim(json_extract(a.attempt_json, '$.owner')), ''),
           NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
           NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
         ) AS agent,
         COUNT(CASE WHEN a.started_at >= ? AND a.started_at < ?
           AND ua.attempt_id IS NULL AND NOT EXISTS (
             SELECT 1 FROM execution_usage u
             WHERE u.session_id = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '')
               AND u.app_id = a.app_id
               AND u.started_at >= ? AND u.started_at < ?
           ) THEN 1 END) AS disjointUsageAttempts,
         COUNT(CASE WHEN a.started_at >= ? AND a.started_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM sessions s
             WHERE s.sessionId = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '')
               AND COALESCE(NULLIF(trim(s.app_id), ''), NULLIF(trim(s.projectId), '')) = a.app_id
               AND s.agent IS NOT NULL AND s.agent != ''
               AND s.startedAt >= ? AND s.startedAt < ?
           ) THEN 1 END) AS disjointSessionAttempts,
         COUNT(CASE WHEN a.state = 'failed'
           AND ${finishMsExpr} IS NOT NULL AND ${finishMsExpr} >= ? AND ${finishMsExpr} < ?
           AND NOT EXISTS (
             SELECT 1 FROM sessions s
             WHERE s.sessionId = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '')
               AND s.status = 'error'
               AND COALESCE(NULLIF(trim(s.app_id), ''), NULLIF(trim(s.projectId), '')) = a.app_id
               AND s.agent IS NOT NULL AND s.agent != ''
               AND s.startedAt >= ? AND s.startedAt < ?
           ) THEN 1 END) AS disjointFailedAttempts
       FROM app_task_attempts a
       LEFT JOIN app_tasks t ON t.app_id = a.app_id AND t.task_id = a.task_id
       LEFT JOIN usage_attempts ua ON ua.attempt_id = a.attempt_id
       WHERE a.app_id = ?
         AND a.started_at >= ? AND a.started_at < ?
         AND COALESCE(json_extract(a.attempt_json, '$.handler'), '') NOT LIKE 'workflow:%'
         AND ((a.started_at >= ? AND a.started_at < ?)
           OR (${finishMsExpr} IS NOT NULL AND ${finishMsExpr} >= ? AND ${finishMsExpr} < ?))
       GROUP BY 1`,
    )
    .all(
      start,
      end,
      appId,
      start,
      end,
      start,
      end,
      start,
      end,
      start,
      end,
      start,
      end,
      start,
      end,
      appId,
      Math.min(usageLookbackStart, terminalLookbackStart),
      end,
      start,
      end,
      start,
      end,
    ) as Array<{
    agent: string | null;
    disjointUsageAttempts: number;
    disjointSessionAttempts: number;
    disjointFailedAttempts: number;
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
      const runs = (u?.invocationsWindow ?? 0) + (att?.disjointUsageAttempts ?? 0);
      const sessionsCount = (s?.sessionsWindow ?? 0) + (att?.disjointSessionAttempts ?? 0);
      const errs = (s?.errorsWindow ?? 0) + (att?.disjointFailedAttempts ?? 0);
      return {
        agent,
        sessionsWindow: sessionsCount,
        errorsWindow: errs,
        invocationsWindow: runs > 0 ? runs : sessionsCount,
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
         AND COALESCE(NULLIF(trim(app_id), ''), NULLIF(trim(projectId), '')) = ?
         AND endedAt >= ? AND endedAt < ?
       GROUP BY workflow
       ORDER BY finished DESC, workflow ASC
       LIMIT 20`,
    )
    .all(appId, start, end) as Array<{
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
         SELECT agent, COALESCE(NULLIF(trim(app_id), ''), NULLIF(trim(projectId), '')) AS appId, COUNT(*) AS runs
         FROM sessions
         WHERE startedAt >= ? AND startedAt < ? AND agent IS NOT NULL AND agent != ''
         GROUP BY agent, appId
         UNION ALL
         SELECT
           COALESCE(
             NULLIF(trim(json_extract(a.attempt_json, '$.owner')), ''),
             NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
             NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
           ) AS agent,
           a.app_id AS appId,
           COUNT(*) AS runs
         FROM app_task_attempts a
         LEFT JOIN app_tasks t ON t.app_id = a.app_id AND t.task_id = a.task_id
         WHERE a.started_at >= ? AND a.started_at < ?
           AND COALESCE(json_extract(a.attempt_json, '$.handler'), '') NOT LIKE 'workflow:%'
         GROUP BY 1, 2
         UNION ALL
         SELECT agent, NULLIF(trim(app_id), '') AS appId, COUNT(*) AS runs
         FROM execution_usage
         WHERE started_at >= ? AND started_at < ?
           AND agent IS NOT NULL AND agent != ''
           AND app_id IS NOT NULL AND trim(app_id) != ''
         GROUP BY agent, appId
       ) WHERE agent IS NOT NULL AND agent != ''
       GROUP BY agent, appId`,
    )
    .all(start, end, start, end, start, end) as Array<{ agent: string; appId: string | null; runs: number }>;

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

export type AlertHandlerSummary = {
  alertId: number;
  metricId: string;
  name: string;
  priority: string;
  message: string | null;
  createdAt: number | null;
  scope: MetricScope;
  declaredOwner: string;
  declaredHandler: string | null;
  handler: string;
  handlingStatus: string;
  linkedTask: { appId: string; taskId: string } | null;
};

export function describeOpenAlert(
  alert: {
    alertId: number;
    metricId: string;
    name?: string | null;
    priority?: string | null;
    message?: string | null;
    createdAt?: number | null;
    owner?: string | null;
    project?: string | null;
    config?: unknown;
    latestJudgment?: Record<string, unknown> | null;
  },
  catalog?: AppCatalog,
): AlertHandlerSummary {
  const scope = classifyMetricScope(
    { id: alert.metricId, owner: alert.owner, project: alert.project, config: alert.config },
    catalog,
  );
  const cfg = parseMetricConfigObject(alert.config);
  const declaredHandler = typeof cfg?.handler === "string" && cfg.handler.trim() ? cfg.handler.trim() : null;
  const rawOwner = typeof alert.owner === "string" && alert.owner.trim() ? alert.owner.trim() : null;
  const declaredOwner =
    rawOwner ??
    (scope.kind === "app" ? (catalog?.ownerByAppId.get(scope.appId) ?? scope.appId) : "system:host");
  const handler = declaredHandler ?? declaredOwner;

  const j = alert.latestJudgment;
  let handlingStatus = "No recorded handling";
  let linkedTask: { appId: string; taskId: string } | null = null;
  if (j && typeof j === "object") {
    const lt = j.linkedTask as Record<string, unknown> | undefined;
    const src = j.source as Record<string, unknown> | undefined;
    if (lt && typeof lt.appId === "string" && typeof lt.taskId === "string") {
      linkedTask = { appId: lt.appId, taskId: lt.taskId };
    } else if (src && typeof src.appId === "string" && typeof src.taskId === "string") {
      linkedTask = { appId: src.appId, taskId: src.taskId };
    }
    const disp = typeof j.disposition === "string" ? j.disposition : typeof j.verdict === "string" ? j.verdict : null;
    if (disp === "investigate") handlingStatus = "Investigating";
    else if (src?.kind === "accepted-task-result" && disp) handlingStatus = `Accepted: ${disp}`;
    else if (disp) handlingStatus = `Judged: ${disp}`;
    else handlingStatus = "Judged";
  }

  return {
    alertId: alert.alertId,
    metricId: alert.metricId,
    name: alert.name || alert.metricId,
    priority: alert.priority || "P2",
    message: alert.message ?? null,
    createdAt: alert.createdAt ?? null,
    scope,
    declaredOwner,
    declaredHandler,
    handler,
    handlingStatus,
    linkedTask,
  };
}

export function enrichAlertsWithLatestJudgments<
  T extends { alertId?: number; metricId?: string; createdAt?: number | null },
>(db: SqliteDb, alerts: readonly T[]): Array<T & { latestJudgment: Record<string, unknown> | null }> {
  if (!alerts.length) return [];

  // Batch-read accepted Task dispositions using idx_metric_disposition_attempts (`timestamp >= minCreatedAt`),
  // avoiding N+1 full scans across historical attempt_json blobs.
  const createdTimestamps = alerts
    .map((a) => (typeof a.createdAt === "number" && Number.isFinite(a.createdAt) && a.createdAt > 0 ? a.createdAt : 0))
    .filter((ts) => ts > 0);
  const minCreatedAt = createdTimestamps.length === alerts.length ? Math.max(0, Math.min(...createdTimestamps) - 10_000) : 0;
  const alertKeys = new Set(
    alerts
      .filter((a) => a.metricId && a.alertId != null)
      .map((a) => `${a.metricId}::${a.alertId}`),
  );

  const dispByKey = new Map<string, Record<string, unknown>>();
  if (alertKeys.size > 0) {
    const dispRows = db
      .prepare(
        `SELECT app_id, task_id, attempt_id, timestamp, data, metric_id, alert_id
         FROM metric_dispositions
         WHERE timestamp >= ?
         ORDER BY timestamp DESC, attempt_id DESC`,
      )
      .all(minCreatedAt) as Array<{
      app_id: string;
      task_id: string;
      attempt_id: string;
      timestamp: number;
      data: string;
      metric_id: string;
      alert_id: number;
    }>;
    for (const row of dispRows) {
      const key = `${row.metric_id}::${row.alert_id}`;
      if (!alertKeys.has(key) || dispByKey.has(key)) continue;
      try {
        const parsed = JSON.parse(row.data);
        const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
        dispByKey.set(key, {
          ...obj,
          owner: row.app_id,
          timestamp: row.timestamp,
          source: {
            kind: "accepted-task-result",
            appId: row.app_id,
            taskId: row.task_id,
            attemptId: row.attempt_id,
          },
        });
      } catch {
        /* Ignore malformed disposition. */
      }
    }
  }

  const legacyStmt = db.prepare(
    `SELECT id, owner, timestamp, data
     FROM events
     WHERE event_type = 'metric.alert_judged'
       AND timestamp >= ?
       AND (alert_id = CAST(? AS TEXT) OR (alert_id IS NULL AND metric_id = ?))
     ORDER BY timestamp DESC, id DESC LIMIT 1`,
  );

  return alerts.map((alert) => {
    const key = `${alert.metricId ?? ""}::${alert.alertId ?? ""}`;
    const accepted = dispByKey.get(key);
    if (accepted) {
      return { ...alert, latestJudgment: accepted };
    }
    const legacyRow = legacyStmt.get(alert.createdAt ?? 0, alert.alertId ?? null, alert.metricId ?? null) as {
      id?: number;
      owner?: string | null;
      timestamp?: number;
      data?: string | null;
    } | null;
    if (!legacyRow) return { ...alert, latestJudgment: null };
    try {
      const parsed = legacyRow.data ? JSON.parse(legacyRow.data) : null;
      const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      return {
        ...alert,
        latestJudgment: {
          eventId: legacyRow.id ?? null,
          owner: legacyRow.owner ?? null,
          timestamp: legacyRow.timestamp ?? null,
          ...obj,
        },
      };
    } catch {
      return {
        ...alert,
        latestJudgment: {
          eventId: legacyRow.id ?? null,
          owner: legacyRow.owner ?? null,
          timestamp: legacyRow.timestamp ?? null,
        },
      };
    }
  });
}

function resolveOptionalWorkflowRef(
  raw: string | null | undefined,
  trulyInstalledSet: ReadonlySet<string>,
  hasAuthoritativeApps: boolean,
): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return null;
  const slash = trimmed.indexOf("/");
  if (slash > 0 && hasAuthoritativeApps) {
    const targetApp = normalizeAppKey(trimmed.slice(0, slash));
    if (targetApp && !trulyInstalledSet.has(targetApp)) return null;
  }
  return trimmed;
}

export function readObservabilitySummary(
  db: SqliteDb,
  options: {
    query: ReturnType<typeof observabilitySummaryQuery>;
    projectsRoot: string;
    stateDir: string;
    loadedApps?: ReadonlyArray<Record<string, unknown>> | null;
    disabledAppIds?: Iterable<string>;
    hostImprovementWorkflow?: string | null;
    appImprovementWorkflows?: Readonly<Record<string, string | null | undefined>>;
    now?: number;
    envProbes?: EnvironmentProbes;
  },
) {
  const now = options.now ?? Date.now();
  const { start, end, appId: filterAppId } = options.query;
  const catalog = resolveObservabilityCatalog(db, {
    projectsRoot: options.projectsRoot,
    loadedApps: options.loadedApps,
    disabledAppIds: options.disabledAppIds,
    filterAppId,
  });

  const envProbes: EnvironmentProbes = options.envProbes ?? {
    disk: probeDiskHeadroom(options.stateDir),
    auth: probeAzureCliAuthHeadroom(now),
  };

  {
    const observations = readMetricObservations(db, now, undefined, catalog);
    const metricById = new Map(observations.metrics.map((m) => [m.id, m]));
    const metricValue = (id: string): number | null => {
      const m = metricById.get(id);
      return m?.observation ? m.observation.value : null;
    };

    const openAlerts = db
      .prepare(
        `SELECT ma.id AS alertId, ma.metric_id AS metricId, ma.message, ma.created_at AS createdAt,
           m.name, m.owner, m.project, m.priority, m.config
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
      config: string | null;
    }>;
    const alertsTruncated = openAlerts.length > METRIC_LIST_LIMIT;
    const visibleAlerts = openAlerts.slice(0, METRIC_LIST_LIMIT);
    const allAppIds = catalog.visibleAppIds;

    let hostOpenAlerts = 0;
    const appOpenAlerts = new Map<string, number>();
    const alertSummaries: AlertHandlerSummary[] = [];
    for (const alert of enrichAlertsWithLatestJudgments(db, visibleAlerts)) {
      const summary = describeOpenAlert(alert, catalog);
      alertSummaries.push(summary);
      if (summary.scope.kind === "host") {
        hostOpenAlerts += 1;
      } else {
        appOpenAlerts.set(summary.scope.appId, (appOpenAlerts.get(summary.scope.appId) ?? 0) + 1);
      }
    }

    const appMetricCounts = new Map<string, { total: number; fresh: number; staleOrMissing: number }>();
    let hostFreshMetrics = 0;
    let hostStaleMetrics = 0;
    let hostMissingMetrics = 0;
    let hostCollectionFailures = 0;
    let hostActiveMetrics = 0;

    for (const metric of observations.metrics) {
      const scope = metric.scope;
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

    const hostTerminalPredicate = terminalAttemptWindowPredicateSql("?", "?");
    const hostTerminalRow = db
      .prepare(
        `SELECT
           COUNT(*) AS terminal,
           COUNT(CASE WHEN state = 'failed' THEN 1 END) AS failed
         FROM app_task_attempts
         WHERE ${hostTerminalPredicate}`,
      )
      .get(end, start, end) as { terminal: number; failed: number };

    const hostFailoverRow = db
      .prepare(
        `SELECT
           COUNT(CASE WHEN json_extract(attempt_json, '$.failoverFromAttemptId') IS NOT NULL THEN 1 END) AS failovers
         FROM app_task_attempts
         WHERE started_at >= ? AND started_at < ?`,
      )
      .get(start, end) as { failovers: number };
    const hostAttemptRow = {
      terminal: hostTerminalRow.terminal,
      failed: hostTerminalRow.failed,
      failovers: hostFailoverRow.failovers,
    };

    const recoveryRow = db
      .prepare(
        `SELECT
           COUNT(DISTINCT i.id) AS unresolvedCount,
           MIN(CAST(json_extract(r.value, '$.firstFailedAt') AS INTEGER)) AS oldestFailedAt
         FROM app_inbox_items i, json_each(i.recovery_json) r
         WHERE i.recovery_json IS NOT NULL AND i.recovery_json != '{}'
           AND json_extract(r.value, '$.recoveredAt') IS NULL
           AND json_extract(r.value, '$.failures') > 0
           AND ((r.key = 'input-admission' AND i.status != 'done' AND i.execution_task_id IS NULL)
             OR (r.key = 'input-result' AND i.status != 'done')
             OR (r.key = 'input-feedback' AND json_extract(i.recovery_json, '$."input-admission".reportedAt') IS NULL))`,
      )
      .get() as { unresolvedCount: number; oldestFailedAt: number | null };

    // Count canonical expired leases once across non-cancelled Tasks/current-attempts (Task lease mirrors currentAttemptId).
    const expiredTaskLeases =
      (
        db
          .prepare(
            `SELECT COUNT(*) AS expired
             FROM app_tasks t
             LEFT JOIN app_task_cancellations c ON c.app_id = t.app_id AND c.task_id = t.task_id
             WHERE c.task_id IS NULL
               AND json_extract(t.resource_json, '$.status.closure.state') IS NULL
               AND (
                 (t.lease_until IS NOT NULL AND t.lease_until < ?)
                 OR EXISTS (
                   SELECT 1 FROM app_task_attempts a
                   WHERE a.app_id = t.app_id
                     AND a.attempt_id = COALESCE(t.current_attempt_id, '')
                     AND a.state = 'running'
                     AND a.lease_until IS NOT NULL AND a.lease_until < ?
                 )
               )`,
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

    // Per-App attempt outcomes in window: started counts use `[start, end)`, terminal counts require valid `finishedAt < end`.
    const usageLookbackStart = start - 7 * 86_400_000;
    const appStartedRows = db
      .prepare(
        `WITH usage_attempts AS MATERIALIZED (
           SELECT DISTINCT app_id, attempt_id
           FROM execution_usage
           WHERE started_at >= ? AND started_at < ?
             AND attempt_id IS NOT NULL AND attempt_id != ''
         )
         SELECT
           a.app_id AS appId,
           COUNT(*) AS totalAttempts,
           COUNT(CASE WHEN ua.attempt_id IS NULL
             AND COALESCE(json_extract(a.attempt_json, '$.handler'), '') NOT LIKE 'workflow:%'
             AND NOT EXISTS (
               SELECT 1 FROM execution_usage u
               WHERE u.session_id = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '')
                 AND u.app_id = a.app_id
             ) THEN 1 END) AS disjointAgentAttempts
         FROM app_task_attempts a
         LEFT JOIN usage_attempts ua ON ua.app_id = a.app_id AND ua.attempt_id = a.attempt_id
         WHERE a.started_at >= ? AND a.started_at < ?
         GROUP BY a.app_id`,
      )
      .all(usageLookbackStart, end, start, end) as Array<{
      appId: string;
      totalAttempts: number;
      disjointAgentAttempts: number;
    }>;

    const appTerminalPredicate = terminalAttemptWindowPredicateSql("?", "?", "a");
    const appTerminalRows = db
      .prepare(
        `SELECT
           a.app_id AS appId,
           COUNT(CASE WHEN a.state = 'completed' AND a.accepted_result_state = 'converged' THEN 1 END) AS convergedMilestones,
           COUNT(CASE WHEN a.state = 'failed' THEN 1 END) AS failedAttempts
         FROM app_task_attempts a
         WHERE ${appTerminalPredicate}
         GROUP BY a.app_id`,
      )
      .all(end, start, end) as Array<{
      appId: string;
      convergedMilestones: number;
      failedAttempts: number;
    }>;

    const appAttemptMap = new Map<
      string,
      { appId: string; totalAttempts: number; disjointAgentAttempts: number; convergedMilestones: number; failedAttempts: number }
    >();
    for (const r of appStartedRows) {
      appAttemptMap.set(r.appId, {
        appId: r.appId,
        totalAttempts: r.totalAttempts,
        disjointAgentAttempts: r.disjointAgentAttempts,
        convergedMilestones: 0,
        failedAttempts: 0,
      });
    }
    for (const r of appTerminalRows) {
      const existing = appAttemptMap.get(r.appId) ?? {
        appId: r.appId,
        totalAttempts: 0,
        disjointAgentAttempts: 0,
        convergedMilestones: 0,
        failedAttempts: 0,
      };
      existing.convergedMilestones = r.convergedMilestones;
      existing.failedAttempts = r.failedAttempts;
      appAttemptMap.set(r.appId, existing);
    }
    const appAttemptRows = [...appAttemptMap.values()];

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

    // Per-App workflow execution counts in window (top-level runs, preferring app_id over projectId).
    const appWorkflowRows = db
      .prepare(
        `SELECT
           COALESCE(NULLIF(trim(app_id), ''), NULLIF(trim(projectId), '')) AS appId,
           COUNT(CASE WHEN status IN ('done', 'error', 'blocked', 'interrupted') THEN 1 END) AS finished,
           COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
           COUNT(CASE WHEN status = 'error' THEN 1 END) AS errors,
           COUNT(CASE WHEN status = 'blocked' THEN 1 END) AS blocked
         FROM workflow_runs
         WHERE parentWorkflowRunId IS NULL
           AND COALESCE(NULLIF(trim(app_id), ''), NULLIF(trim(projectId), '')) IS NOT NULL
           AND endedAt >= ? AND endedAt < ?
         GROUP BY 1`,
      )
      .all(start, end) as Array<{
      appId: string;
      finished: number;
      done: number;
      errors: number;
      blocked: number;
    }>;

    // Per-App agent invocation & token/cost usage in window (agentInvocations excludes workflow step runs so workflows aren't double-counted).
    const complete =
      "outcome IS NOT NULL AND json_extract(data, '$.totals.replies') > 0 AND json_extract(data, '$.totals.measuredReplies') = json_extract(data, '$.totals.replies')";
    const appUsageRows = db
      .prepare(
        `SELECT
           app_id AS appId,
           COUNT(*) AS invocations,
           COUNT(CASE WHEN workflow_run_id IS NULL THEN 1 END) AS standaloneAgentInvocations,
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
      standaloneAgentInvocations: number;
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
          ? resolveCatalogAppId(fact.payload.appId, catalog)
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
      // Sum standalone non-workflow execution_usage invocations + disjoint non-workflow Task attempts (never double-counting workflows).
      const agentInvocations = (usage?.standaloneAgentInvocations ?? 0) + (attempts?.disjointAgentAttempts ?? 0);
      const workflowRuns = wf?.finished ?? 0;
      const executionTotal = workflowRuns + agentInvocations;
      const metricSummary = appMetricCounts.get(appId) ?? { total: 0, fresh: 0, staleOrMissing: 0 };

      const rawAppWorkflow =
        options.appImprovementWorkflows?.[appId] ??
        catalog.improvementWorkflowByAppId?.get(appId) ??
        process.env.MAY_APP_IMPROVEMENT_WORKFLOW ??
        null;

      return {
        appId,
        installed: catalog.trulyInstalledSet.has(appId),
        owner: catalog.ownerByAppId.get(appId) ?? appId,
        improvementWorkflow: resolveOptionalWorkflowRef(
          rawAppWorkflow,
          catalog.trulyInstalledSet,
          catalog.hasAuthoritativeApps,
        ),
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
          completePricingCoverage:
            (usage?.pricedInvocations ?? 0) > 0 &&
            (usage?.pricedInvocations ?? 0) === (usage?.invocations ?? 0) &&
            (attempts?.disjointAgentAttempts ?? 0) === 0,
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
      improvementWorkflow: resolveOptionalWorkflowRef(
        options.hostImprovementWorkflow ?? process.env.MAY_HOST_IMPROVEMENT_WORKFLOW ?? null,
        catalog.trulyInstalledSet,
        catalog.hasAuthoritativeApps,
      ),
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
          recoveryRow.oldestFailedAt !== null && now >= recoveryRow.oldestFailedAt
            ? now - recoveryRow.oldestFailedAt
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
      alerts: alertSummaries.slice(0, 20),
      host,
      apps,
      appDetail,
    };
    return result;
  }
}

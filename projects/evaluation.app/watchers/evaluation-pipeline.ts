import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ProjectAppContext } from "@may-agent/sdk";

export const name = "evaluation-pipeline";
export const description =
  "Run a deterministic evaluation-pipeline health check and wake the owner only on a changed anomaly state.";

const CHECK_WINDOW_MS = 15 * 60_000;

type PipelineMonitorState = {
  checkedAt?: number;
  anomalyFingerprint?: string;
  anomalyFamilies?: string[];
};

type MetricRow = {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  current?: unknown;
  threshold?: unknown;
  alert_op?: unknown;
};

type PipelineWatcherContext = ProjectAppContext & {
  query: {
    sql(
      statement: string,
      params?: unknown[],
      options?: { limit?: number },
    ): unknown;
    metrics(filter?: Record<string, unknown>): unknown;
    workflowRuns(filter?: Record<string, unknown>): unknown;
    events(filter?: Record<string, unknown>): unknown;
  };
};

const FINDING_DELIVERY_METRICS = new Set([
  "evaluator.project-finding-delivery-rate-24h",
  "evaluator.project-feedback-pending-age-h",
]);

export type PipelineSnapshot = {
  sampledAt: number;
  missingAftermathCount: number;
  breachedMetrics: Array<{
    id: string;
    current: number;
    threshold: number;
    alertOp: string;
  }>;
  failedWorkflowFamilies: string[];
  reviewFailureCount: number;
};

export type PipelineDecision = {
  changed: boolean;
  recovered: boolean;
  anomalyFamilies: string[];
  fingerprint: string;
};

function numberValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function metricIsBreached(metric: MetricRow): boolean {
  if (String(metric.status ?? "active") !== "active") return false;
  const current = numberValue(metric.current);
  const threshold = numberValue(metric.threshold);
  if (current === null || threshold === null) return false;
  return metric.alert_op === "<"
    ? current < threshold
    : metric.alert_op === ">"
      ? current > threshold
      : false;
}

export function metricAnomalyFamily(metricId: string): string {
  return FINDING_DELIVERY_METRICS.has(metricId)
    ? "metric:finding-delivery"
    : `metric:${metricId}`;
}

export function workflowRunIsFailure(row: Record<string, unknown>): boolean {
  const status = String(row.status ?? "");
  if (!["blocked", "error", "interrupted"].includes(status)) return false;
  const reason = String(
    row.result_reason ?? row.resultReason ?? row.reason ?? "",
  );
  return !(status === "interrupted" && /process restarted/i.test(reason));
}

export function decidePipelineWake(
  snapshot: PipelineSnapshot,
  previous: PipelineMonitorState = {},
): PipelineDecision {
  const anomalyFamilies = Array.from(
    new Set([
      ...(snapshot.missingAftermathCount > 0 ? ["aftermath-backlog"] : []),
      ...snapshot.breachedMetrics.map((metric) =>
        metricAnomalyFamily(metric.id),
      ),
      ...snapshot.failedWorkflowFamilies.map(
        (workflow) => `workflow:${workflow}`,
      ),
      ...(snapshot.reviewFailureCount > 0 ? ["review-failed"] : []),
    ]),
  ).sort();
  const fingerprint = anomalyFamilies.join("|") || "healthy";
  const previousFingerprint = previous.anomalyFingerprint ?? "healthy";
  return {
    changed: fingerprint !== previousFingerprint,
    recovered: fingerprint === "healthy" && previousFingerprint !== "healthy",
    anomalyFamilies,
    fingerprint,
  };
}

function readState(path: string): PipelineMonitorState {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(path: string, state: PipelineMonitorState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function queryRows<T>(fn: () => unknown): T[] {
  try {
    const result = fn() as { rows?: T[] } | T[];
    return Array.isArray(result) ? result : (result?.rows ?? []);
  } catch {
    return [];
  }
}

function missingAftermathCount(
  ctx: PipelineWatcherContext,
  now: number,
): number {
  try {
    const result = ctx.query.sql(
      `SELECT COUNT(*) AS count
         FROM sessions s
         LEFT JOIN evaluations e ON e.sessionId = s.sessionId
        WHERE s.agent NOT IN ('evaluator', 'judge')
          AND s.status IN ('done', 'error', 'interrupted')
          AND COALESCE(s.endedAt, 0) > 0
          AND s.endedAt <= ?
          AND e.sessionId IS NULL`,
      [now - 7 * 60_000],
      { limit: 1 },
    ) as { rows?: Array<{ count?: number }> };
    return Number(result?.rows?.[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

function collectSnapshot(
  ctx: PipelineWatcherContext,
  now: number,
): PipelineSnapshot {
  const metrics = queryRows<MetricRow>(() =>
    ctx.query.metrics({ owner: "evaluator", limit: 100 }),
  );
  const breachedMetrics = metrics.filter(metricIsBreached).map((metric) => ({
    id: String(metric.id ?? metric.name ?? "unknown"),
    current: Number(metric.current),
    threshold: Number(metric.threshold),
    alertOp: String(metric.alert_op ?? ""),
  }));
  const recentRuns = queryRows<Record<string, unknown>>(() =>
    ctx.query.workflowRuns({ since: now - CHECK_WINDOW_MS, limit: 120 }),
  );
  const failedWorkflowFamilies = Array.from(
    new Set(
      recentRuns
        .filter(workflowRunIsFailure)
        .map((row) => String(row.workflow ?? ""))
        .filter(
          (workflow) =>
            workflow.startsWith("evaluator-") ||
            workflow === "project-health-evaluator",
        )
        .filter((workflow) => workflow !== name),
    ),
  ).sort();
  const recentEvents = queryRows<Record<string, unknown>>(() =>
    ctx.query.events({ since: now - CHECK_WINDOW_MS, limit: 200 }),
  );
  const reviewFailureCount = recentEvents.filter(
    (row) => String(row.event_type ?? row.type) === "evaluation.review_failed",
  ).length;

  return {
    sampledAt: now,
    missingAftermathCount: missingAftermathCount(ctx, now),
    breachedMetrics,
    failedWorkflowFamilies,
    reviewFailureCount,
  };
}

export async function observeEvaluationPipeline(
  ctx: PipelineWatcherContext,
): Promise<unknown> {
  const now = Date.now();
  const statePath = ctx.appPath(".state/pipeline-monitor.json");
  const previous = readState(statePath);
  const snapshot = collectSnapshot(ctx, now);
  const decision = decidePipelineWake(snapshot, previous);

  writeState(statePath, {
    checkedAt: now,
    anomalyFingerprint: decision.fingerprint,
    anomalyFamilies: decision.anomalyFamilies,
  });

  if (!decision.changed) {
    return ctx.noop(
      `Pipeline state unchanged (${decision.fingerprint}); owner review not dispatched.`,
    );
  }

  return ctx.emit({
    type: "evaluation.tick",
    project: "evaluation",
    lane: decision.recovered ? "pipeline-recovered" : "pipeline-anomaly",
    source: "evaluation-pipeline-monitor",
    data: { snapshot, anomalyFamilies: decision.anomalyFamilies },
  });
}

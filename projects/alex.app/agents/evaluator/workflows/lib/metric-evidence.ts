import { hostReportUrl } from "./host-reporting.js";
import { metricEvidenceHash } from "./task-report-store.js";
import {
  createPublicTaskEvidenceProvider,
  sendPublicReadCommand,
} from "./public-task-evidence.js";

export type MetricResponsibility = {
  appId: string | null;
  status: "resolved" | "unknown" | "ambiguous" | "unavailable";
  declaredOwner: string | null;
  project: string | null;
};

export function resolveMetricResponsibility(
  metric: { owner?: unknown; project?: unknown },
  apps: Record<string, unknown>[],
): MetricResponsibility {
  const canonical = (value: unknown) =>
    typeof value === "string"
      ? value
          .trim()
          .replace(/^app:/, "")
          .replace(/\.app$/, "")
      : "";
  const owner = canonical(metric.owner);
  const project = canonical(metric.project);
  const exact = apps.filter((app) => canonical(app.id) === owner);
  const byOwner = exact.length
    ? exact
    : apps.filter(
        (app) =>
          owner &&
          canonical(app.owner).replace(/^agent:/, "") ===
            owner.replace(/^agent:/, ""),
      );
  const candidates = owner
    ? byOwner
    : apps.filter((app) => project && canonical(app.id) === project);
  const identities = [...new Set(candidates.map((app) => canonical(app.id)))];
  return {
    appId: identities.length === 1 ? identities[0] : null,
    status:
      identities.length === 1
        ? "resolved"
        : identities.length
          ? "ambiguous"
          : "unknown",
    declaredOwner: typeof metric.owner === "string" ? metric.owner : null,
    project: typeof metric.project === "string" ? metric.project : null,
  };
}

export type MetricEvidence = Record<string, unknown> & {
  available: true;
  metricId: string;
  end: number;
  windowMs: number;
  metric: {
    id: string;
    project?: string | null;
    status: string;
    description?: string;
    [key: string]: unknown;
  };
  responsibility?: MetricResponsibility;
};
export type MetricReader = (
  metricId: string,
  end: number,
  alertId?: number,
  signal?: AbortSignal,
) => Promise<MetricEvidence>;

export function metricReviewCut(now = Date.now()) {
  return Math.floor(now / 3_600_000) * 3_600_000;
}

/** Read retained metric facts. Observation does not require App attribution. */
export async function readMetricObservation(
  metricId: string,
  end: number,
  alertId?: number,
  signal?: AbortSignal,
  request = fetch,
): Promise<MetricEvidence> {
  signal?.throwIfAborted();
  const url = hostReportUrl(
    `/api/metrics/${encodeURIComponent(metricId)}/evidence`,
  );
  url.searchParams.set("end", String(end));
  if (alertId !== undefined) url.searchParams.set("alertId", String(alertId));
  const timeout = AbortSignal.timeout(10_000);
  const response = await request(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Metric evidence read failed: HTTP ${response.status}`);
  const bytes = await response.text();
  if (Buffer.byteLength(bytes) > 128_000)
    throw new Error("Metric evidence exceeds the review bound");
  const value = JSON.parse(bytes);
  if (
    value?.version !== 1 ||
    value.available !== true ||
    value.metricId !== metricId ||
    value.end !== end ||
    value.metric?.id !== metricId
  ) {
    throw new Error(
      "Metric evidence identity does not match the requested observation",
    );
  }
  signal?.throwIfAborted();
  return value;
}

/** Review adds responsibility to the same retained observations. */
export async function readMetricEvidence(
  metricId: string,
  end: number,
  alertId?: number,
  signal?: AbortSignal,
  listApps = () =>
    createPublicTaskEvidenceProvider((command) =>
      sendPublicReadCommand(command, { signal }),
    ).listApps(),
): Promise<MetricEvidence> {
  const value = await readMetricObservation(metricId, end, alertId, signal);
  try {
    value.responsibility = resolveMetricResponsibility(
      value.metric,
      await listApps(),
    );
  } catch {
    signal?.throwIfAborted();
    value.responsibility = {
      ...resolveMetricResponsibility(value.metric, []),
      status: "unavailable",
    };
  }
  signal?.throwIfAborted();
  return value;
}

export { metricEvidenceHash };

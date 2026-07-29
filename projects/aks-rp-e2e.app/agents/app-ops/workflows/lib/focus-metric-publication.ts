import type { MetricDefinition, MetricService } from "@may-agent/sdk";
import { sampleFocusMetric, type FocusMetricId } from "./focus-metrics.ts";

const focusMetricIds: FocusMetricId[] = [
  "aks-rp-e2e.run.live-started-24h",
  "aks-rp-e2e.run.live-succeeded-24h",
  "aks-rp-e2e.spec.unverified-count",
  "aks-rp-e2e.spec.failed-count",
  "aks-rp-e2e.model.unknown-path-count",
];

const focusMetricDefinitionById: Record<
  FocusMetricId,
  Omit<
    MetricDefinition,
    "id" | "source" | "sourceCommand" | "measureInterval" | "status"
  >
> = {
  "aks-rp-e2e.run.live-started-24h": {
    name: "AKS RP E2E live runs started in 24h",
    owner: "app-ops",
    project: "aks-rp-e2e",
    type: "gauge",
    target: 0,
    threshold: -1,
    unit: "count",
    priority: "P3",
    alertOp: "<",
    speed: "fast",
    description:
      "Dashboard activity counter for execute-mode live runs in the last 24h. Not an interrupting alert: this project's automation policy keeps cloud verification event-driven and sparing, so raw daily live-run count should not page app-ops during repo-local learning or externally gated periods. Use aks-rp-e2e.run.live-idle-with-runnable-work for the real liveness signal when execute-ready backlog exists but no run starts. Calibrated target 4->0, threshold 1->-1, priority P1->P3 on 2026-06-19 after repo-local evidence confirmed the old daily-pressure shape produced false alerts during ordinary gate-closed periods.",
    config: undefined,
  },
  "aks-rp-e2e.run.live-succeeded-24h": {
    name: "AKS RP E2E live runs succeeded in 24h",
    owner: "app-ops",
    project: "aks-rp-e2e",
    type: "gauge",
    target: 2,
    threshold: 0,
    unit: "count",
    priority: "P2",
    alertOp: "<",
    speed: "fast",
    description:
      "Impact signal: live verification should produce passing evidence.",
    config: undefined,
  },
  "aks-rp-e2e.spec.unverified-count": {
    name: "AKS RP E2E unverified specs",
    owner: "app-ops",
    project: "aks-rp-e2e",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Dashboard burn-down counter: indexed specs not live-verified passing and not a reviewed durable exception. Not an interrupting alert — the real health signals are spec.unverified-without-work (P0, fires when no verification work is planned) and task.no-work-with-gaps (P0, fires when no work at all while gaps remain). Calibrated threshold 0→999999 and priority P1→P3 on 2026-06-14: threshold=0 on a 335-spec burn-down creates a permanent P1 alert that interrupts without adding value.",
    config: undefined,
  },
  "aks-rp-e2e.spec.failed-count": {
    name: "AKS RP E2E failed specs",
    owner: "app-ops",
    project: "aks-rp-e2e",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    priority: "P1",
    alertOp: ">",
    speed: "fast",
    description:
      "Specs with fail/failing status. Each should have diagnosis, fix/retry, or reviewed exception follow-up.",
    config: undefined,
  },
  "aks-rp-e2e.model.unknown-path-count": {
    name: "AKS RP E2E unknown/source-enumerated paths",
    owner: "app-ops",
    project: "aks-rp-e2e",
    type: "gauge",
    target: 0,
    threshold: 999999,
    unit: "count",
    priority: "P3",
    alertOp: ">",
    speed: "fast",
    description:
      "Impact counter: paths still needing verification or runnable follow-up.",
    config: undefined,
  },
};

function metricSourceCommand(appDir: string, metricId: FocusMetricId): string {
  return `bun ${appDir}/scripts/focus-metric-sample.ts ${metricId} --json`;
}

function noteText(note: unknown): string | undefined {
  if (note == null) return undefined;
  return typeof note === "string" ? note : JSON.stringify(note);
}

export function focusMetricDefinitions(appDir: string): MetricDefinition[] {
  return focusMetricIds.map((id) => ({
    id,
    ...focusMetricDefinitionById[id],
    source: "source_command",
    sourceCommand: metricSourceCommand(appDir, id),
    measureInterval: 300_000,
    status: "active",
  }));
}

export function publishFocusMetrics(input: {
  metrics?: Pick<MetricService, "defineMany" | "record" | "evaluate"> | null;
  appDir: string;
  projectDir: string;
  measuredBy?: string;
}): Array<{ id: FocusMetricId; value: number; measuredAt: number }> {
  if (!input.metrics) return [];

  input.metrics.defineMany(focusMetricDefinitions(input.appDir));

  const published: Array<{
    id: FocusMetricId;
    value: number;
    measuredAt: number;
  }> = [];
  for (const id of focusMetricIds) {
    const sample = sampleFocusMetric(input.projectDir, id, {
      appDir: input.appDir,
    });
    input.metrics.record(id, sample.value, {
      measuredAt: sample.measuredAt,
      measuredBy: input.measuredBy,
      sampleSize: sample.sampleSize,
      note: noteText(sample.note),
    });
    input.metrics.evaluate(id);
    published.push({ id, value: sample.value, measuredAt: sample.measuredAt });
  }

  return published;
}

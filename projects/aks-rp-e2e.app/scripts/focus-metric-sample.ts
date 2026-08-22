#!/usr/bin/env bun

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  sampleFocusMetric,
  sampleFocusMetricBatch,
  type FocusMetricId,
} from "../agents/app-ops/workflows/lib/focus-metrics.ts";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = resolve(
  process.env.PROJECT_DIR ?? join(appDir, "..", "aks-rp-e2e"),
);
const supportedMetrics: FocusMetricId[] = [
  "aks-rp-e2e.run.live-started-24h",
  "aks-rp-e2e.run.live-succeeded-24h",
  "aks-rp-e2e.spec.unverified-count",
  "aks-rp-e2e.spec.failed-count",
  "aks-rp-e2e.model.unknown-path-count",
];

function usage(): never {
  console.error(
    `Usage: bun run focus:metric-sample <metric-id> [--json]\n\nSupported metrics:\n- ${supportedMetrics.join("\n- ")}`,
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const batchIndex = args.indexOf("--batch-json");
if (batchIndex >= 0) {
  const requested = args.slice(batchIndex + 1);
  if (
    requested.length === 0 ||
    requested.some(
      (metricId) => !supportedMetrics.includes(metricId as FocusMetricId),
    )
  ) {
    usage();
  }
  const metricIds = requested as FocusMetricId[];
  console.log(
    JSON.stringify(sampleFocusMetricBatch(projectDir, metricIds, { appDir })),
  );
  process.exit(0);
}
const metricId = args.find((arg) => !arg.startsWith("--")) as
  FocusMetricId | undefined;
const asJson = args.includes("--json");

if (!metricId || !supportedMetrics.includes(metricId)) usage();

const sample = sampleFocusMetric(projectDir, metricId, { appDir });
if (asJson) {
  console.log(JSON.stringify(sample, null, 2));
} else {
  console.log(String(sample.value));
}

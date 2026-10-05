import type { MetricDefinition } from "../../../lib/metrics.js";

export const TASK_SKIPPED_CHECK_METRIC: MetricDefinition = {
  id: "task.skipped-check-count",
  name: "Skipped Task checks (sample interval)",
  owner: "system:host",
  type: "gauge",
  unit: "checks",
  measureInterval: 300_000,
  source: "Host Task routing counters",
  description:
    "Checks that did not claim an attempt since the previous successful sample. sampleSize counts all reported checks; note contains the window and counts by outcome. Worker counts arrive with their result. Restart or lost workers may lose unsampled activity. No automatic alert: skips are often expected, and Apps own review policy.",
};

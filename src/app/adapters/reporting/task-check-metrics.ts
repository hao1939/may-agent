import type { MetricDefinition } from "../../../lib/metrics.js";

export const TASK_SKIPPED_CHECK_METRIC: MetricDefinition = {
  id: "task.skipped-check-rate",
  name: "Task checks without an attempt (per minute)",
  owner: "system:host",
  type: "gauge",
  unit: "checks/min",
  measureInterval: 300_000,
  source: "Host Task routing counters",
  description:
    "Checks reported without an attempt, divided by the actual sample duration in minutes. note retains raw counts by outcome and up to three recent exact Task references, not top offenders. sampleSize is all reported checks, not a progress or success denominator. Workers report at completion; restart or worker loss may lose unsampled activity. A skipped check can preserve a valid wait or recover state; this is activity, not wasted time or model tokens. Apps calibrate review against cost and progress; no default alert.",
};

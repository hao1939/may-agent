// alerting.ts — Alerting configuration for monitoring stack

export interface AlertThresholds {
  error_rate_percent: number;
  latency_ms: number;
  memory_usage_percent: number;
  cpu_usage_percent: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  error_rate_percent: 3.5,     // alert if error rate exceeds 3.5%
  latency_ms: 1500,            // alert if p99 latency exceeds 1500ms
  memory_usage_percent: 85,    // alert if memory exceeds 85%
  cpu_usage_percent: 90,       // alert if CPU exceeds 90%
};

export function checkThresholds(
  current: { error_rate: number; latency: number; memory: number; cpu: number },
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): string[] {
  const violations: string[] = [];

  if (current.error_rate > thresholds.error_rate_percent) {
    violations.push(`Error rate ${current.error_rate}% exceeds threshold ${thresholds.error_rate_percent}%`);
  }
  if (current.latency > thresholds.latency_ms) {
    violations.push(`Latency ${current.latency}ms exceeds threshold ${thresholds.latency_ms}ms`);
  }
  if (current.memory > thresholds.memory_usage_percent) {
    violations.push(`Memory ${current.memory}% exceeds threshold ${thresholds.memory_usage_percent}%`);
  }
  if (current.cpu > thresholds.cpu_usage_percent) {
    violations.push(`CPU ${current.cpu}% exceeds threshold ${thresholds.cpu_usage_percent}%`);
  }

  return violations;
}

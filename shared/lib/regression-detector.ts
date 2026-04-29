/**
 * Regression Detector
 * Compares current metrics to a stored baseline and flags regressions.
 */

export interface Regression {
  metric: string;
  current: number;
  baseline: number;
  drop: number;
}

export interface RegressionResult {
  regressions: Regression[];
  passed: boolean;
}

/**
 * Detect regressions by comparing current metrics against a baseline.
 * A regression is flagged when current < baseline * (1 - threshold).
 * @param current - Current metric values
 * @param baseline - Baseline metric values to compare against
 * @param threshold - Acceptable drop fraction (default 0.1 = 10%)
 */
export function detectRegressions(
  current: Record<string, number>,
  baseline: Record<string, number>,
  threshold: number = 0.1
): RegressionResult {
  const regressions: Regression[] = [];

  for (const metric of Object.keys(baseline)) {
    if (!(metric in current)) continue;
    const baseVal = baseline[metric];
    const curVal = current[metric];
    if (baseVal === 0) continue;
    const drop = (baseVal - curVal) / baseVal;
    if (drop > threshold) {
      regressions.push({ metric, current: curVal, baseline: baseVal, drop: Math.round(drop * 1000) / 1000 });
    }
  }

  return { regressions, passed: regressions.length === 0 };
}

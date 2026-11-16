/** The benefit to measure, declared before running the baseline. */
export type ComparisonObjective =
  | { metric: "quality" }
  | { metric: "duration_ms"; min_reduction_percent: number }
  | { metric: "total_tokens"; min_reduction_percent: number }
  | { metric: "ops"; min_reduction_percent: number };

export function parseComparisonObjective(value: unknown): ComparisonObjective {
  // Historical runs used the quality objective implicitly.
  if (value === undefined) return { metric: "quality" };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("comparison objective must be an object");
  }
  const data = value as Record<string, unknown>;
  if (data.metric === "quality" && Object.keys(data).length === 1) {
    return { metric: "quality" };
  }
  if (
    (data.metric === "duration_ms" || data.metric === "total_tokens" || data.metric === "ops") &&
    Object.keys(data).length === 2 &&
    typeof data.min_reduction_percent === "number" &&
    Number.isFinite(data.min_reduction_percent) &&
    data.min_reduction_percent > 0 &&
    data.min_reduction_percent <= 100
  ) {
    return {
      metric: data.metric,
      min_reduction_percent: data.min_reduction_percent,
    };
  }
  throw new Error(
    "objective must be quality, or duration_ms/total_tokens/ops with min_reduction_percent greater than 0 and at most 100",
  );
}

export function sameComparisonObjective(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(parseComparisonObjective(left)) === JSON.stringify(parseComparisonObjective(right));
  } catch {
    return false;
  }
}

export function describeComparisonObjective(value: unknown): string {
  const objective = parseComparisonObjective(value);
  switch (objective.metric) {
    case "quality":
      return "More passing trials";
    case "duration_ms":
      return `At least ${objective.min_reduction_percent}% lower total measured execution duration`;
    case "total_tokens":
      return `At least ${objective.min_reduction_percent}% lower total measured tokens`;
    case "ops":
      return `At least ${objective.min_reduction_percent}% fewer total measured tool operations`;
  }
}

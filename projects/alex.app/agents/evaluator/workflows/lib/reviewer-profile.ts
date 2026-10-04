import evaluatorConfig from "../../agent.json" with { type: "json" };
import deepseekConfig from "../../../evaluator-deepseek/agent.json" with { type: "json" };

export const REVIEWERS = ["evaluator", "evaluator-deepseek"] as const;
export type Reviewer = (typeof REVIEWERS)[number];

export type ReviewerProfile = {
  reviewer: Reviewer;
  agent: Reviewer;
  configuredModel: string;
  allowanceIntervalMs: number;
  /** Routine reconsideration of one metric, independent of capacity for other work. */
  metricReviewIntervalMs: number;
  allowanceNamespace: string;
};

const profiles: Record<Reviewer, ReviewerProfile> = {
  evaluator: {
    reviewer: "evaluator",
    agent: "evaluator",
    configuredModel: evaluatorConfig.model,
    allowanceIntervalMs: 86_400_000,
    metricReviewIntervalMs: 86_400_000,
    allowanceNamespace: "",
  },
  "evaluator-deepseek": {
    reviewer: "evaluator-deepseek",
    agent: "evaluator-deepseek",
    configuredModel: deepseekConfig.model,
    allowanceIntervalMs: 300_000,
    metricReviewIntervalMs: 86_400_000,
    allowanceNamespace: "evaluator-deepseek",
  },
};

export function reviewerProfile(value: unknown): ReviewerProfile {
  const reviewer =
    typeof value === "string" && value.trim() ? value.trim() : "evaluator";
  if (!REVIEWERS.includes(reviewer as Reviewer))
    throw new Error(`Unsupported evaluator reviewer: ${reviewer}`);
  return profiles[reviewer as Reviewer];
}

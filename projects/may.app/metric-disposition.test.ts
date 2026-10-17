import { expect, test } from "bun:test";
import { validateMetricTaskResult } from "./metric-disposition.js";
import { metricReviewResult } from "./metric-follow-through.js";

const context = { appId: "may", taskId: "review", conversation: false };
const decision = {
  version: 1,
  metricId: "test.metric",
  alertId: null,
  disposition: "no-change",
  reason: "Decision only; configuration unchanged",
  evidence: ["report:reviewed"],
};
const result = (value: unknown) => ({
  state: "converged" as const,
  summary: "Reviewed",
  facts: [`metric-disposition:${JSON.stringify(value)}`],
});

test.each([
  { ...decision, disposition: "recalibrate-threshold", newThresholdMs: 250 },
  { ...decision, alertId: undefined },
  { ...decision, alertId: "42" },
  { ...decision, reason: undefined },
  { ...decision, evidence: [" "] },
  { ...decision, reuseScope: { concern: "invented" } },
])("rejects an unreadable or unsupported metric decision %j", (value) => {
  expect(validateMetricTaskResult(result(value), context)).toContain(
    "Metric decision rejected",
  );
});

test("preserves nonmetric facts, incomplete work and a separate unapplied proposal", () => {
  expect(
    validateMetricTaskResult(
      {
        state: "incomplete",
        summary: "Missing evidence",
        facts: ["report:partial"],
      },
      context,
    ),
  ).toBeNull();
  const output = {
    ...result(decision),
    result: {
      disposition: "recalibrate-threshold",
      newThresholdMs: 250,
      configurationApplied: false,
    },
  };
  expect(validateMetricTaskResult(output, context)).toBeNull();
  expect(output.result.configurationApplied).toBe(false);
  expect(
    validateMetricTaskResult(
      { ...output, facts: [...output.facts, ...output.facts] },
      context,
    ),
  ).toContain("one decision");
});

test("unresolved decisions must retain the actual owning Task", () => {
  const review = {
    task: {
      state: "waiting" as const,
      summary: "Repair pending",
      facts: ["report:reviewed"],
      continue: true as const,
    },
    decisions: [
      {
        ...decision,
        version: undefined,
        disposition: "investigate" as const,
        nextAction: "Implement the separately requested repair",
      },
    ],
  };
  delete review.decisions[0]!.version;
  const output = metricReviewResult(
    { ...context, task: { conditions: [] }, waits: {} } as never,
    review,
  );
  expect(validateMetricTaskResult(output, context)).toBeNull();
  expect(
    validateMetricTaskResult(output, { ...context, taskId: "other" }),
  ).toContain("owning Task");
  expect(
    validateMetricTaskResult(
      { ...output, state: "converged", continue: undefined },
      context,
    ),
  ).toContain("waiting result");
});

test("completed Conversation decisions need no invented follow-through", () => {
  expect(
    validateMetricTaskResult(result(decision), {
      ...context,
      conversation: true,
    }),
  ).toBeNull();
  expect(
    validateMetricTaskResult(
      result({ ...decision, disposition: "investigate" }),
      { ...context, conversation: true },
    ),
  ).toContain("waiting result");
});

import { describe, expect, it } from "bun:test";
import { matchesEventSelector, type AppEvent } from "./event.js";

describe("canonical App event selectors", () => {
  const event: AppEvent<Record<string, unknown>> = {
    type: "metric.breach",
    source: "metrics",
    owner: "agent:evaluator",
    target: { appId: "evaluation", project: "evaluation", metricId: "quality" },
    action: "repair",
    urgency: "high",
    data: { lane: "review", verdict: "failed" },
  };

  it("matches canonical envelope, target, and data fields", () => {
    expect(
      matchesEventSelector(
        {
          type: "metric.breach",
          project: "evaluation",
          source: "metrics",
          owner: "evaluator",
          urgency: "high",
          actions: ["repair"],
          metricIds: ["quality"],
          lanes: ["review"],
          verdicts: ["failed"],
        },
        event,
      ),
    ).toBeTrue();
  });

  it("rejects one mismatched constraint", () => {
    expect(matchesEventSelector({ type: "metric.breach", actions: ["ignore"] }, event)).toBeFalse();
    expect(matchesEventSelector({ type: "metric.breach", source: "unknown" }, event)).toBeFalse();
    expect(matchesEventSelector({ type: "metric.breach", metricIds: ["latency"] }, event)).toBeFalse();
    expect(matchesEventSelector("metric.recovered", event)).toBeFalse();
  });
});

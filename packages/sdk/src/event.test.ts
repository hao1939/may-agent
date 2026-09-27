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

  it.each(["appId", "project", "taskId", "executionId", "sessionId", "metricId", "owner", "human"] as const)(
    "matches the explicit target.%s independently of the payload",
    (field) => {
      const expected = field === "human" ? false : "wanted";
      const different = field === "human" ? true : "other";
      const selector = { type: "fact.reported", target: { [field]: expected } };
      expect(matchesEventSelector(selector, {
        type: "fact.reported", target: { [field]: expected }, data: { [field]: different },
      })).toBeTrue();
      expect(matchesEventSelector(selector, {
        type: "fact.reported", target: { [field]: different }, data: { [field]: expected },
      })).toBeFalse();
      expect(matchesEventSelector(selector, { type: "fact.reported", data: { [field]: expected } })).toBeFalse();
    },
  );

  it("keeps subject project filters independent of explicit addresses and defaults urgency to normal", () => {
    const fact = { type: "fact.reported", target: { appId: "recipient", project: "recipient" }, data: { project: "subject" } };
    expect(matchesEventSelector({ type: fact.type, project: "subject", target: { appId: "recipient" } }, fact)).toBeTrue();
    expect(matchesEventSelector({ type: fact.type, project: "recipient" }, fact)).toBeFalse();
    expect(matchesEventSelector({ type: fact.type, project: "subject" }, { ...fact, data: { projectId: "subject" } })).toBeTrue();
    expect(matchesEventSelector({ type: fact.type, urgency: "normal" }, fact)).toBeTrue();
    expect(matchesEventSelector({ type: fact.type, urgency: "high" }, fact)).toBeFalse();
  });
});

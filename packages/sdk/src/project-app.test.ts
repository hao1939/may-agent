import { describe, expect, it } from "bun:test";
import { eventData, eventDetails, eventString, matchesEventSelector } from "./project-app.js";

describe("project-app event helpers", () => {
  it("merges data, payload, and params in eventData", () => {
    expect(
      eventData({
        type: "sample.work.requested",
        data: { action: "old", project: "p1" },
        payload: { action: "run" },
        params: { specId: "spec.a" },
      }),
    ).toEqual({
      action: "run",
      project: "p1",
      specId: "spec.a",
    });
  });

  it("reads strings from normalized event data before top-level fields", () => {
    expect(
      eventString(
        {
          taskId: "top-level",
          params: { taskId: "from-params" },
        },
        "taskId",
      ),
    ).toBe("from-params");
  });

  it("keeps details serializable and removes envelope aliases", () => {
    expect(
      eventDetails({
        type: "metric.breach",
        data: { metricId: "m1" },
        params: { status: "red" },
        handler: () => "ignored",
      }),
    ).toEqual({
      type: "metric.breach",
      metricId: "m1",
      status: "red",
    });
  });

  it("matches the complete typed selector contract through one implementation", () => {
    const event = {
      type: "metric.breach",
      owner: "agent:evaluator",
      urgency: "high",
      target: {
        project: "evaluation",
        taskId: "runtime/pipeline",
        sessionId: "session-1",
        owner: "agent:judge",
        human: false,
      },
      data: { metricId: "evaluation.pipeline", action: "review" },
    };

    expect(
      matchesEventSelector(
        {
          type: "metric.breach",
          owner: "evaluator",
          urgency: "high",
          target: {
            project: "evaluation",
            taskId: "runtime/pipeline",
            sessionId: "session-1",
            owner: "judge",
            human: false,
          },
          metricIds: ["evaluation.pipeline"],
          actions: ["review"],
        },
        event,
      ),
    ).toBe(true);
    expect(matchesEventSelector({ type: "metric.breach", target: { project: "other" } }, event)).toBe(false);
    expect(matchesEventSelector({ type: "metric.breach", target: { sessionId: "session-2" } }, event)).toBe(false);
    expect(matchesEventSelector({ type: "metric.breach", target: { owner: "evaluator" } }, event)).toBe(false);
  });

  it("filters evaluation events before unrelated agents wake an app", () => {
    const selector = {
      type: "evaluation.reviewed",
      agents: ["may"],
      lanes: ["needs_triage"],
    };
    expect(
      matchesEventSelector(selector, {
        type: "evaluation.reviewed",
        data: { agent: "may", lane: "needs_triage" },
      }),
    ).toBe(true);
    expect(
      matchesEventSelector(selector, {
        type: "evaluation.reviewed",
        data: { agent: "aks-explorer", lane: "needs_triage" },
      }),
    ).toBe(false);
    expect(
      matchesEventSelector(selector, {
        type: "evaluation.reviewed",
        data: { agent: "may", lane: "success_candidate" },
      }),
    ).toBe(false);
  });

  it("matches specialized message intents without claiming ordinary owner messages", () => {
    const selector = {
      type: "message.created",
      owner: "agent:app-ops",
      intents: ["approval-decision"],
    };
    expect(
      matchesEventSelector(selector, {
        type: "message.created",
        owner: "agent:app-ops",
        data: { to: "app-ops", intent: "approval-decision" },
      }),
    ).toBe(true);
    expect(
      matchesEventSelector(selector, {
        type: "message.created",
        owner: "agent:app-ops",
        data: { to: "app-ops", intent: "review-request" },
      }),
    ).toBe(false);
  });
});

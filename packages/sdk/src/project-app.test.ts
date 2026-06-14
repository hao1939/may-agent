import { describe, expect, it } from "bun:test";
import { eventData, eventDetails, eventString, projectPlanningEvent } from "./project-app.js";

describe("project-app event helpers", () => {
  it("merges data, payload, and params in eventData", () => {
    expect(
      eventData({
        type: "project.action.invoked",
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

  it("creates canonical project planning events", () => {
    expect(projectPlanningEvent("p1", "manual", { maxConcurrent: 2 })).toEqual({
      type: "project.planning.requested",
      project: "p1",
      reason: "manual",
      params: { maxConcurrent: 2 },
    });
  });
});

import { describe, expect, it } from "bun:test";
import { workflowResult, workflowResultVersion } from "./workflow-result.js";

describe("workflowResult", () => {
  it("adds the stable version and empty collection defaults without constraining the payload", () => {
    expect(
      workflowResult({
        workflow: "example",
        input: { taskId: "task-1" },
        output: { verdict: "accepted", custom: { score: 1 } },
      }),
    ).toEqual({
      resultVersion: workflowResultVersion,
      workflow: "example",
      input: { taskId: "task-1" },
      output: { verdict: "accepted", custom: { score: 1 } },
      artifacts: [],
      checks: [],
      metrics: {},
      nextActions: [],
    });
  });
});

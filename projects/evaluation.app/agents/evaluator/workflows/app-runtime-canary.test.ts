import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute } from "./app-runtime-canary.js";

describe("App runtime canary workflow", () => {
  test("observes one completed inbox result through bounded projections", async () => {
    const events: unknown[] = [];
    const ctx = createTestAppWorkflowContext({
      input: { itemId: "app_canary" },
      read: {
        appResult: async () => ({
          summary: "probe complete",
          evidence: ["canary"],
        }),
        task: async () => null,
        execution: async () => null,
        metric: async () => null,
      },
      emit: async (event) => {
        events.push(event);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      kind: "workflow",
      status: "done",
      summary: "Capability-scoped App runtime canary passed",
      output: {
        state: "converged",
        summary: "Capability-scoped App runtime canary passed",
        evidence: ["app-inbox:app_canary", "canary"],
        actions: [],
        canary: {
          itemId: "app_canary",
          appResult: { summary: "probe complete" },
        },
      },
    });
    expect(events).toEqual([
      {
        type: "evaluation.app_runtime_canary.observed",
        data: { itemId: "app_canary", summary: "probe complete" },
        target: { appId: "evaluation-canary" },
      },
    ]);
  });
});

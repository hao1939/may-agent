import { describe, expect, test } from "bun:test";
import { triggerDetails } from "./trigger.ts";

describe("Gym workflow reconciliation details", () => {
  test("uses stable task input when no transient trigger packet survives", () => {
    const task = [
      "Reconcile Gym task",
      "## Reconciliation Task",
      "```json",
      JSON.stringify({
        taskId: "runtime/review-proposal/example",
        input: {
          kind: "regression",
          requestKey: "regression-example",
          outcomePath: "/app/projects/gym.app/.state/runs/example.json",
        },
      }),
      "```",
    ].join("\n");

    expect(triggerDetails(task)).toEqual({
      kind: "regression",
      requestKey: "regression-example",
      outcomePath: "/app/projects/gym.app/.state/runs/example.json",
    });
  });

  test("prefers a fresh trigger observation when one is present", () => {
    const task = [
      "## Reconciliation Task",
      "```json",
      JSON.stringify({ input: { requestKey: "old" } }),
      "```",
      "## Trigger Event",
      "```json",
      JSON.stringify({ type: "gym.review.requested", requestKey: "fresh" }),
      "```",
    ].join("\n");

    expect(triggerDetails(task)).toMatchObject({
      type: "gym.review.requested",
      requestKey: "fresh",
    });
  });
});

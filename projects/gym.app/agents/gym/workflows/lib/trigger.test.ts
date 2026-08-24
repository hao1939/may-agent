import { describe, expect, test } from "bun:test";
import { triggerDetails } from "./trigger.ts";

describe("Gym workflow reconciliation details", () => {
  test("uses stable task input when no transient trigger packet survives", () => {
    const context = {
      input: {},
      reconciliation: {
        input: {
          kind: "regression",
          requestKey: "regression-example",
          outcomePath: "/app/projects/gym.app/.state/runs/example.json",
        },
        events: { items: [] },
      },
    } as never;

    expect(triggerDetails(context)).toEqual({
      kind: "regression",
      requestKey: "regression-example",
      outcomePath: "/app/projects/gym.app/.state/runs/example.json",
    });
  });

  test("prefers a fresh trigger observation when one is present", () => {
    const context = {
      input: {},
      reconciliation: {
        input: { requestKey: "old" },
        events: {
          items: [
            {
              event: { type: "gym.review.requested", requestKey: "fresh" },
            },
          ],
        },
      },
    } as never;

    expect(triggerDetails(context)).toMatchObject({
      type: "gym.review.requested",
      requestKey: "fresh",
    });
  });
});

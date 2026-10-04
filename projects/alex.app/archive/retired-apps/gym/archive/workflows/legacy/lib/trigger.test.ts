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

  test("preserves admitted fields while fresh event fields override them", () => {
    const context = {
      input: {},
      reconciliation: {
        input: {
          requestKey: "old",
          scenario: "may-align-proof-before-adopt",
          trials: 1,
        },
        events: {
          items: [
            {
              event: {
                type: "app.task.requested",
                data: { requestKey: "fresh" },
              },
            },
          ],
        },
      },
    } as never;

    expect(triggerDetails(context)).toMatchObject({
      type: "app.task.requested",
      requestKey: "fresh",
      scenario: "may-align-proof-before-adopt",
      trials: 1,
    });
  });
});

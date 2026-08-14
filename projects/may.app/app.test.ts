import { describe, expect, test } from "bun:test";
import app from "./app.ts";

function subscription(id: string) {
  const route = app.subscriptions?.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`missing subscription ${id}`);
  return route;
}

describe("May conversation App", () => {
  test("is one bounded conversation address without background authority", () => {
    expect(app).toMatchObject({
      id: "may",
      version: 1,
      owner: "may",
      inbox: { batch: "single" },
    });
    expect(app.schedules).toBeUndefined();
    expect(app.observers).toBeUndefined();
    expect(app.tasks).toBeUndefined();
  });

  test("turns an explicit evaluation decision request into one correlated May request", () => {
    expect(
      subscription("evaluation-human-decision").toInput({
        type: "evaluation.human_decision.requested",
        data: {
          message: "Choose whether to proceed",
          targetProject: "gym.app",
        },
        target: { appId: "may", project: "may" },
      }),
    ).toEqual({
      kind: "message",
      data: {
        message: "Choose whether to proceed",
        context: {
          message: "Choose whether to proceed",
          targetProject: "gym.app",
        },
      },
    });
  });
});

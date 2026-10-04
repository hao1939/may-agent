import { expect, test } from "bun:test";
import type { WorkflowContext } from "@may-agent/sdk";
import {
  reviewEmissionLocalKey,
  reviewEvent,
  type ReviewEmission,
} from "./review-event";

function admittedTask(
  taskId = "runtime/review-proposal/incident-42",
  generation = 3,
): Pick<WorkflowContext, "reconciliation"> {
  return {
    reconciliation: {
      taskId,
      generation,
    } as WorkflowContext["reconciliation"],
  };
}

const reviewPathEmissions: ReviewEmission[] = [
  "filtered",
  "approval-superseded",
  "approved",
  "improvement-requested",
  "declined",
  "ready",
  "approval-requested",
  "human-message",
];

test("review emission keys are retry-stable and semantic-specific", () => {
  const firstAttempt = admittedTask();
  const retriedAttempt = admittedTask();
  const firstKeys = reviewPathEmissions.map((emission) =>
    reviewEmissionLocalKey(firstAttempt, emission),
  );
  const retriedKeys = reviewPathEmissions.map((emission) =>
    reviewEmissionLocalKey(retriedAttempt, emission),
  );

  expect(retriedKeys).toEqual(firstKeys);
  expect(new Set(firstKeys).size).toBe(reviewPathEmissions.length);
  expect(reviewEmissionLocalKey(admittedTask(undefined, 4), "ready")).not.toBe(
    reviewEmissionLocalKey(firstAttempt, "ready"),
  );
});

test("filtered, approval, improvement, and message paths use the contract helper", () => {
  const ctx = admittedTask();
  const events = reviewPathEmissions.map((emission) =>
    reviewEvent(
      ctx,
      emission,
      emission === "human-message" ? "message.created" : `gym.${emission}`,
      { emission },
      emission === "human-message" ? { target: { human: true } } : {},
    ),
  );

  expect(events.map((event) => event.localKey)).toEqual(
    reviewPathEmissions.map((emission) =>
      reviewEmissionLocalKey(ctx, emission),
    ),
  );
  expect(events.every((event) => event.owner === "app:gym")).toBe(true);
  expect(events.at(-1)).toMatchObject({
    type: "message.created",
    data: { project: "gym", emission: "human-message" },
    target: { human: true },
  });
});

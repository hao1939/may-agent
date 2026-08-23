import { describe, expect, test } from "bun:test";
import type { TaskReconciliationContext } from "@may-agent/sdk";
import {
  memberEmissionKey,
  reconciliationCycleKey,
  taskEmissionKey,
} from "./task-emission.js";

function reconciliation(
  eventId: number,
): TaskReconciliationContext<Record<string, never>> {
  const event = {
    type: "evaluation.tick",
    data: { reason: "scheduled" },
    target: { appId: "evaluation" },
  };
  return {
    appId: "evaluation",
    taskId: "runtime/owner-review",
    generation: 3,
    resourceVersion: 9,
    agent: "evaluator",
    mode: "maintain",
    outcome: "Keep evaluation coherent.",
    acceptance: ["The exact wake is reconciled."],
    input: {},
    children: { live: [], completed: [] },
    taskSnapshot: { live: [], truncated: false },
    events: {
      items: [
        {
          eventId,
          observedAt: "2026-08-21T00:00:00.000Z",
          event,
        },
      ],
      throughEventId: eventId,
      truncated: false,
    },
  };
}

describe("task emission identity", () => {
  test("keeps retries on one maintain wake stable and separates later wakes", () => {
    const first = reconciliation(101);
    const retry = reconciliation(101);
    const next = reconciliation(102);

    expect(reconciliationCycleKey(first)).toBe("event-101");
    expect(taskEmissionKey({ reconciliation: first }, "reviewed")).toBe(
      taskEmissionKey({ reconciliation: retry }, "reviewed"),
    );
    expect(taskEmissionKey({ reconciliation: next }, "reviewed")).not.toBe(
      taskEmissionKey({ reconciliation: first }, "reviewed"),
    );
  });

  test("uses semantic member identity without leaking an unbounded key", () => {
    const first = memberEmissionKey("owner-finding", {
      appId: "gym",
      dedupeKey: "gym:verification-gap",
    });
    const reordered = memberEmissionKey("owner-finding", {
      dedupeKey: "gym:verification-gap",
      appId: "gym",
    });
    expect(first).toBe(reordered);
    expect(first).toMatch(/^owner-finding-[a-f0-9]{16}$/);
  });
});

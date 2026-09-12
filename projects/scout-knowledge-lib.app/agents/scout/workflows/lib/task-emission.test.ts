import { expect, test } from "bun:test";
import type { WorkflowContext } from "@may-agent/sdk";
import { taskEmissionKey } from "./task-emission";

function context(
  eventId?: number,
  resourceVersion = 1,
): Pick<WorkflowContext, "reconciliation"> {
  return {
    reconciliation: {
      appId: "research",
      taskId: "source",
      generation: 1,
      resourceVersion,
      agent: "researcher",
      owner: "researcher",
      outcome: "Observe source",
      acceptance: ["Publish current observations"],
      input: {},
      children: { live: [], completed: [] },
      waits: { open: [], resolved: [] },
      events: {
        items: [],
        ...(eventId === undefined ? {} : { throughEventId: eventId }),
      },
    },
  };
}

test("mode-free Tasks publish each input once and retain the key on retry", () => {
  const first = taskEmissionKey(context(10), "observation", { value: 1 });
  expect(taskEmissionKey(context(10, 8), "observation", { value: 1 })).toBe(
    first,
  );
  expect(taskEmissionKey(context(11), "observation", { value: 1 })).not.toBe(
    first,
  );
  expect(taskEmissionKey(context(10), "observation", { value: 2 })).not.toBe(
    first,
  );
});

test("untriggered retry uses Task-generation scope, not mutable resource version", () => {
  expect(taskEmissionKey(context(undefined, 1), "initial")).toBe("initial");
  expect(taskEmissionKey(context(undefined, 8), "initial")).toBe("initial");
});

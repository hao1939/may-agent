import { expect, test } from "bun:test";
import { supersededGymTaskCloseActions } from "./unified-resource-migration";

test("closes the fixed superseded tasks at their exact generations", () => {
  const actions = supersededGymTaskCloseActions();
  expect(actions).toHaveLength(2);
  expect(actions.map((action) => action.kind)).toEqual(
    Array(2).fill("close-task"),
  );
  expect(actions.map((action) => action.taskId)).toEqual([
    "runtime/design-alignment-review",
    "runtime/owner-review",
  ]);
});

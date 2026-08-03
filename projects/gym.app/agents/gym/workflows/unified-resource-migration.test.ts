import { expect, test } from "bun:test";
import { legacyGymTaskCloseActions } from "./unified-resource-migration";

test("closes the fixed legacy set child before parent", () => {
  const actions = legacyGymTaskCloseActions();
  expect(actions).toHaveLength(6);
  expect(actions.map((action) => action.kind)).toEqual(
    Array(6).fill("close-task"),
  );
  expect(actions.slice(0, 2).map((action) => action.taskId)).toEqual([
    "benchmark-cases/incident-s_1785517213446_45/hao-approval",
    "benchmark-cases/incident-s_1785517213446_45",
  ]);
});

import { expect, test } from "bun:test";

import {
  waitingFrontierChildIds,
  waitingFrontierTaskId,
} from "./retire-waiting-frontier";

test("tracks only existing direct children of the retired waiting frontier", () => {
  expect(
    waitingFrontierChildIds({
      resources: {
        child2: { spec: { parentId: waitingFrontierTaskId } },
        unrelated: { spec: { parentId: "group/app-operations" } },
        child1: { spec: { parentId: waitingFrontierTaskId } },
      },
    }),
  ).toEqual(["child1", "child2"]);
});

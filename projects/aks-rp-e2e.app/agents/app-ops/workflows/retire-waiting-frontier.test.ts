import { expect, test } from "bun:test";

import {
  waitingFrontierChildIds,
} from "./retire-waiting-frontier";

test("tracks only existing direct children of the retired waiting frontier", () => {
  expect(
    waitingFrontierChildIds([
      {
        taskId: "child2",
        generation: 1,
        outcome: "second",
        evidence: [],
        status: "waiting",
      },
      {
        taskId: "child1",
        generation: 1,
        outcome: "first",
        evidence: [],
        status: "running",
      },
    ]),
  ).toEqual(["child1", "child2"]);
});

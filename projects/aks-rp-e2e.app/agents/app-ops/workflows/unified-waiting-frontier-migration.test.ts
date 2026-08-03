import { expect, test } from "bun:test";

import { execute } from "./unified-waiting-frontier-migration";

test("retires the rejected handler-action migration without mutating tasks", async () => {
  const result = await execute({
    done: (_summary: string, value: unknown) => value,
  } as never);
  expect(result).toMatchObject({
    state: "converged",
    evidence: ["migration:waiting-frontier-direct-resolver-v2"],
    actions: [],
  });
});

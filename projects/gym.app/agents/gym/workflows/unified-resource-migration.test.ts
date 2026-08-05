import { expect, test } from "bun:test";
import { execute } from "./unified-resource-migration";

test("cancels retirement without mutating standing runtime resources", async () => {
  const done = (summary: string, result: Record<string, unknown>) => ({
    type: "done" as const,
    summary,
    ...result,
  });
  const result = await execute({ done } as never);

  expect(result.state).toBe("converged");
  expect(result.actions).toEqual([]);
  expect(result.evidence).toEqual(["migration:unified-resource-v3-cancelled"]);
});

import { expect, test } from "bun:test";
import app, { taskForInput } from "./app.ts";
import { assertValidAppDefinition } from "../may-agent/src/app/core/apps/definition-validation.ts";

test("Alex bootstrap uses ordinary durable Task admission", () => {
  expect(() => assertValidAppDefinition(app)).not.toThrow();
  const admitted = {
    id: "migration-admission",
    input: { kind: "goal", data: {
      outcome: "Carry unfinished improvement work into Alex",
      acceptance: ["Preserve unfinished requirements and caller relationships"],
      constraints: ["Keep existing history"],
    } },
  };
  const first = taskForInput(admitted as never);
  expect(taskForInput(admitted as never)).toEqual(first);
  expect(first.intent.agent).toBe("alex");
  expect(first.intent.input).toEqual(admitted.input);
  expect(first.intent.acceptance).toEqual(admitted.input.data.acceptance);
});

test("An operational message reaches executable Alex work", () => {
  const input = { kind: "message", data: { message: "Investigate the broken intake" } };
  expect(taskForInput({ id: "report-1", input } as never).intent).toMatchObject({
    agent: "alex", outcome: "Investigate the broken intake", input,
  });
});

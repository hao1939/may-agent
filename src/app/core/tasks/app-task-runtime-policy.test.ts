import { describe, expect, it } from "bun:test";
import { mergeTaskConditions } from "./dependency-admission.js";
import { appTaskResultProblem, normalizeTaskHandlerResult } from "./result.js";
import { defineApp, Type } from "@may-agent/sdk";

it("App result admission isolates mutation and reports broken validators", () => {
  const context = { taskId: "work", generation: 1, conversation: false };
  const result = { state: "converged" as const, summary: "Done", facts: ["original"] };
  const app = defineApp({ id: "sample", version: 1, agent: "worker", inputSchema: Type.Unknown(), tasks: {
    validateResult(value, identity) { value.facts.push("mutated"); (identity as { taskId: string }).taskId = "other"; return null; },
  } });
  expect(appTaskResultProblem(app, context, result)).toBeNull();
  expect(result.facts).toEqual(["original"]);
  expect(context.taskId).toBe("work");
  app.tasks!.validateResult = () => { throw new Error("broken policy"); };
  expect(appTaskResultProblem(app, context, result)).toContain("broken policy");
  app.tasks!.validateResult = (async () => { throw new Error("async policy"); }) as never;
  expect(appTaskResultProblem(app, context, result)).toContain("synchronously");
});

describe("App Task Condition admission", () => {
  it("lets an App reject Conditions it cannot meaningfully observe", () => {
    const normalized = normalizeTaskHandlerResult(
      {
        state: "waiting",
        summary: "Waiting for an invented human event",
        facts: [],
        conditions: [
          {
            id: "approval",
            type: "human.decision",
            subject: "id:approval",
            expected: true,
            owner: "human:operator",
            reviewAfterMs: 60_000,
          },
        ],
      },
      { type: "done", summary: "done", runId: "run-1" },
      {
        validateCondition: () => "is not observable by this App",
      },
    );

    expect(normalized).toMatchObject({
      state: "error",
      summary: "Handler result was rejected: conditions[0] is not observable by this App",
    });
  });
});

describe("Task Condition reconciliation authority", () => {
  const canonical = {
    id: "app-request:appdep_exact",
    type: "app.dependency.updated",
    subject: "id:appdep_exact",
    expected: { field: "status", equals: "done" },
  };

  it("keeps the explicit compatible specification after a generated dependency echo", () => {
    const dependencyEcho = structuredClone(canonical);
    const explicit = { ...canonical, reviewAfterMs: 60_000 };
    expect(mergeTaskConditions([canonical, dependencyEcho, explicit], new Set([canonical.id]))).toEqual([explicit]);
  });

  it("rejects retargeting an authoritative App-dependency Condition", () => {
    const retargeted = { ...canonical, subject: "id:different" };
    expect(() => mergeTaskConditions([canonical, retargeted], new Set([canonical.id]))).toThrow(
      "Task result conflicts with existing Condition app-request:appdep_exact",
    );
  });

  it("rejects incompatible expected facts for an authoritative App-dependency Condition", () => {
    const incompatible = { ...canonical, expected: { field: "status", equals: "attention" } };
    expect(() => mergeTaskConditions([canonical, incompatible], new Set([canonical.id]))).toThrow(
      "Task result conflicts with existing Condition app-request:appdep_exact",
    );
  });
});

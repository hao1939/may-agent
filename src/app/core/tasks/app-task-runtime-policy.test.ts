import { describe, expect, it } from "bun:test";
import { appTaskAgentProtocol } from "../../adapters/executors/managed-agent.js";
import { mergeTaskConditions } from "./dependency-admission.js";
import { normalizeTaskHandlerResult } from "./result.js";

// Pure projection and protocol rules need neither a repository nor a database.
describe("App Task agent prompt context", () => {
  it("keeps the schema-enforced bounded-agent protocol below five kilobytes", () => {
    const protocol = appTaskAgentProtocol("may");

    expect(Buffer.byteLength(protocol, "utf8")).toBeLessThanOrEqual(5 * 1_024);
    expect(protocol).toContain("agent pursuing one Task goal owned by App may");
  });

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

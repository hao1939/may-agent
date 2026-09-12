import { describe, expect, it } from "bun:test";
import {
  appTaskAgentProtocol,
  DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION,
  hasSuppliedDependencyObservation,
} from "../../adapters/executors/managed-agent.js";
import { hasDeployReceiptWake } from "../../adapters/executors/agent-workspace.js";
import { mergeTaskConditions } from "./app-task-runtime.js";
import { normalizeTaskHandlerResult } from "./result.js";

// Pure projection and protocol rules need neither a repository nor a database.
describe("App Task agent prompt context", () => {
  it("recognizes deploy context only from the exact typed receipt wake", () => {
    const events = (reason: string) =>
      ({
        items: [
          {
            eventId: 1,
            observedAt: "2026-08-25T00:00:00.000Z",
            event: {
              type: "runtime.deploy.observed",
              data: { reason },
            },
          },
        ],
        throughEventId: 1,
        truncated: false,
      }) as any;

    expect(hasDeployReceiptWake(events("restart-aware-deploy-receipt"))).toBe(true);
    expect(hasDeployReceiptWake(events("please inspect the restart-aware deploy receipt"))).toBe(false);
  });

  it("keeps the schema-enforced bounded-agent protocol below four kilobytes", () => {
    const protocol = appTaskAgentProtocol("may");

    expect(Buffer.byteLength(protocol, "utf8")).toBeLessThanOrEqual(4 * 1_024);
    expect(protocol).toContain("agent pursuing one Task goal owned by App may");
    expect(protocol).not.toContain("accountable owner");
    expect(protocol).toContain("Finish exactly once with finish().result");
    expect(protocol).toContain("Runtime publishes and correlates it");
    expect(protocol).not.toContain("Converged example");
    expect(protocol).toContain("report:true");
    expect(protocol).toContain("omit for quiet waits");
    expect(protocol).toContain("Execution errors are facts, not accepted results");
  });

  it("makes a supplied dependency observation complete authority without exposing Host-private refinement", () => {
    expect(
      hasSuppliedDependencyObservation({
        items: [
          {
            event: {
              type: "app.task.requested",
              data: {
                request: {
                  dependency: {
                    kind: "task",
                    id: "runtime/platform-owner-review",
                    status: "attention",
                    summary: "Use this supplied state",
                  },
                },
              },
            },
          },
        ],
      }),
    ).toBeTrue();
    expect(
      hasSuppliedDependencyObservation({
        items: [{ event: { type: "app.task.requested", data: { request: {} } } }],
      }),
    ).toBeFalse();
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain("treat that exact read-only observation");
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain(
      "as complete authority for the dependency in this attempt",
    );
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain(
      "do not inspect Host-private task state, generated task-tree or Kanban projections",
    );
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain(
      "do not inspect Host-private task state, generated task-tree or Kanban projections, or substitute a deeper or different task",
    );
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain("This restriction is request-scoped");
    expect(appTaskAgentProtocol("fixture")).toContain(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION);
  });

  it("lets an App reject Conditions it cannot meaningfully observe", () => {
    const normalized = normalizeTaskHandlerResult(
      {
        state: "waiting",
        summary: "Waiting for an invented human event",
        evidence: [],
        conditions: [
          {
            id: "approval",
            type: "human-decision",
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

  it("keeps one canonical App-dependency Condition across compatible model and dependency echoes", () => {
    const modelEcho = { ...canonical, reviewAfterMs: 60_000 };
    const dependencyEcho = structuredClone(canonical);
    expect(mergeTaskConditions([canonical, modelEcho, dependencyEcho], new Set([canonical.id]))).toEqual([canonical]);
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

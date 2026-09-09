import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import {
  appTaskAgentProtocol,
  appDependencyCatalog,
  DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION,
  hasDeployReceiptWake,
  hasSuppliedDependencyObservation,
  mergeTaskConditions,
  normalizeTaskHandlerResult,
  projectAppTaskChildPromptContext,
} from "./app-task-runtime.js";

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
    expect(protocol).toContain("Return state waiting only for an exact observable Condition");
    expect(protocol).toContain("Runtime publishes and correlates it");
    expect(protocol).not.toContain("Converged example");
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

  it("shows only installed accountable Apps and their accepted input contracts", () => {
    const target = defineApp({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      description: "Owns evidence-based evaluation outcomes.",
      inputSchema: Type.Union([
        Type.Object({ kind: Type.Literal("owner-review"), data: Type.Record(Type.String(), Type.Unknown()) }),
        Type.Object({ kind: Type.Literal("deep-eval"), data: Type.Record(Type.String(), Type.Unknown()) }),
      ]),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "review",
          parentId: "evaluation",
          outcome: "Review evidence",
          acceptance: ["Evidence is reviewed"],
          mode: "achieve" as const,
        },
      }),
      tasks: {},
    });
    const source = { ...target, id: "may" };
    const catalog = appDependencyCatalog(
      [
        { appDir: "/fixture/may.app", definition: source },
        { appDir: join("/fixture/projects", "evaluation.app"), definition: target },
      ],
      "may",
    );

    expect(catalog).toEqual([
      {
        appId: "evaluation",
        description: "Owns evidence-based evaluation outcomes.",
        inputs: [
          { kind: "deep-eval", requiredData: [], dataTypes: {}, fixedData: {} },
          { kind: "owner-review", requiredData: [], dataTypes: {}, fixedData: {} },
        ],
      },
    ]);
  });

  it("summarizes required paths, field shapes, and fixed data without copying the full schema", () => {
    const target = defineApp({
      id: "operations",
      version: 1,
      agent: "operator",
      inputSchema: Type.Union([
        Type.Object({
          kind: Type.Literal("general-operation"),
          data: Type.Object({
            outcome: Type.String(),
            evidence: Type.Array(Type.String()),
            constraints: Type.Optional(Type.Array(Type.String())),
          }),
        }),
        Type.Object({
          kind: Type.Literal("specialized-operation"),
          data: Type.Object({
            outcome: Type.String(),
            context: Type.Object({ callerApp: Type.Literal("alpha-project"), callerTask: Type.String() }),
          }),
        }),
      ]),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "operation",
          parentId: "operations",
          outcome: "Perform the operation",
          acceptance: ["Done"],
          mode: "achieve" as const,
        },
      }),
      tasks: {},
    });

    expect(
      appDependencyCatalog([{ appDir: join("/fixture/projects", "operations.app"), definition: target }], "may")[0]
        ?.inputs,
    ).toEqual([
      {
        kind: "general-operation",
        requiredData: ["evidence", "outcome"],
        dataTypes: { constraints: "string[]", evidence: "string[]", outcome: "string" },
        fixedData: {},
      },
      {
        kind: "specialized-operation",
        requiredData: ["context", "context.callerApp", "context.callerTask", "outcome"],
        dataTypes: {
          context: "object",
          "context.callerApp": "string",
          "context.callerTask": "string",
          outcome: "string",
        },
        fixedData: { "context.callerApp": "alpha-project" },
      },
    ]);
  });

  it("does not advertise an input resolver without an active Task policy", () => {
    const target = defineApp({
      id: "incomplete",
      version: 1,
      agent: "incomplete-owner",
      inputSchema: Type.Object({ kind: Type.Literal("review"), data: Type.Record(Type.String(), Type.Unknown()) }),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "review",
          parentId: "incomplete",
          outcome: "Review evidence",
          acceptance: ["Reviewed"],
          mode: "achieve" as const,
        },
      }),
    });

    expect(
      appDependencyCatalog([{ appDir: join("/fixture/projects", "incomplete.app"), definition: target }], "may"),
    ).toEqual([]);
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

  it("keeps parent prompts bounded while preserving child identity and state", () => {
    const hiddenDetail = "exact-child-detail-" + "x".repeat(8_000);
    const context: Parameters<typeof projectAppTaskChildPromptContext>[0] = {
      live: Array.from({ length: 16 }, (_, index) => ({
        taskId: `live-${index}`,
        parentId: "parent",
        generation: 1,
        phase: "waiting",
        outcome: `Resolve child ${index} ${"o".repeat(800)}`,
        agent: "sample-owner",
        input: { hiddenDetail },
        conditions: [
          {
            id: `condition-${index}`,
            type: "external.state",
            subject: `child:${index}`,
            expected: { hiddenDetail },
          },
        ],
        readiness: {
          state: "condition-blocked",
          reason: `Waiting for child ${index} ${"r".repeat(800)}`,
          relatedTaskIds: [`condition-${index}`],
        },
        hasLiveChildren: false,
        summary: `Still waiting ${"s".repeat(800)}`,
        evidence: Array.from({ length: 4 }, () => `evidence-${"e".repeat(800)}`),
      })),
      completed: Array.from({ length: 8 }, (_, index) => ({
        taskId: `done-${index}`,
        parentId: "parent",
        generation: 1,
        outcome: `Complete child ${index} ${"o".repeat(800)}`,
        agent: "sample-owner",
        input: { hiddenDetail },
        conditions: [],
        hasLiveChildren: false,
        summary: `Completed ${"s".repeat(800)}`,
        evidence: Array.from({ length: 4 }, () => `evidence-${"e".repeat(800)}`),
        completedAt: "2026-08-20T00:00:00.000Z",
      })),
    };

    const projected = projectAppTaskChildPromptContext(context);
    const encoded = JSON.stringify(projected);

    expect(encoded.length).toBeLessThan(40_000);
    expect(encoded).not.toContain("exact-child-detail");
    expect(encoded).not.toContain("external.state");
    expect(projected.live[0]).toMatchObject({
      taskId: "live-0",
      generation: 1,
      phase: "waiting",
      agent: "sample-owner",
    });
    expect(projected.live[0]).not.toHaveProperty("owner");
    expect(projected.completed[0]).toMatchObject({
      taskId: "done-0",
      generation: 1,
      agent: "sample-owner",
    });
    expect(projected.completed[0]).not.toHaveProperty("owner");
  });
});

describe("Task Condition reconciliation authority", () => {
  const canonical = {
    id: "app-request:appdep_exact",
    type: "app.dependency.completed",
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

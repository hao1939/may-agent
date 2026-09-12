import { describe, expect, it } from "bun:test";
import { Type, defineApp } from "@may-agent/sdk";
import { appDependencyCatalog } from "./app-dependency-catalog.js";

describe("App dependency catalog", () => {
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
        },
      }),
      tasks: {},
    });
    const source = {
      ...target,
      id: "may",
      inputSchema: Type.Union([
        Type.Object({ kind: Type.Literal("message"), data: Type.Record(Type.String(), Type.Unknown()) }),
        Type.Object({ kind: Type.Literal("goal"), data: Type.Record(Type.String(), Type.Unknown()) }),
      ]),
      requests: { mode: "agent" as const, inputKinds: ["message"] },
    };
    const catalog = appDependencyCatalog(
      [
        { appDir: "/fixtures/may.app", definition: source },
        { appDir: "/fixtures/evaluation.app", definition: target },
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
      {
        appId: "may",
        description: "Owns evidence-based evaluation outcomes.",
        inputs: [{ kind: "goal", requiredData: [], dataTypes: {}, fixedData: {} }],
      },
    ]);
    expect(
      appDependencyCatalog(
        [{ appDir: "/fixtures/may.app", definition: { ...source, requests: { mode: "agent" } } }],
        "may",
      ),
    ).toEqual([]);
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
        },
      }),
      tasks: {},
    });

    expect(
      appDependencyCatalog([{ appDir: "/fixtures/operations.app", definition: target }], "may")[0]?.inputs,
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
        },
      }),
    });

    expect(appDependencyCatalog([{ appDir: "/fixtures/incomplete.app", definition: target }], "may")).toEqual([]);
  });
});

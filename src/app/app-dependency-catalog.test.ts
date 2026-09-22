import { describe, expect, it } from "bun:test";
import { Type, defineApp } from "@may-agent/sdk";
import { appDependencyCatalog } from "./app-dependency-catalog.js";

describe("App dependency catalog", () => {
  it("shows only installed accountable Apps and their accepted input contracts", () => {
    const target = defineApp({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      description: "Owns facts-based evaluation outcomes.",
      inputSchema: Type.Union([
        Type.Object({ kind: Type.Literal("owner-review"), data: Type.Record(Type.String(), Type.Unknown()) }),
        Type.Object({ kind: Type.Literal("deep-eval"), data: Type.Record(Type.String(), Type.Unknown()) }),
        Type.Object({
          kind: Type.Literal("review-task-outcome"),
          data: Type.Object({
            appId: Type.String(),
            taskId: Type.String(),
            assessmentPurpose: Type.Optional(
              Type.Union([Type.Literal("outcome"), Type.Literal("ongoing")]),
            ),
          }),
        }),
      ]),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "review",
          parentId: "evaluation",
          outcome: "Review facts",
          acceptance: ["Facts are reviewed"],
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
      conversation: { mode: "agent" as const, inputKinds: ["message"] },
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
        description: "Owns facts-based evaluation outcomes.",
        inputs: [
          { kind: "deep-eval", requiredData: [], dataTypes: {}, fixedData: {} },
          { kind: "owner-review", requiredData: [], dataTypes: {}, fixedData: {} },
          {
            kind: "review-task-outcome",
            requiredData: ["appId", "taskId"],
            dataTypes: {
              appId: "string",
              assessmentPurpose: '"ongoing"|"outcome"',
              taskId: "string",
            },
            fixedData: {},
          },
        ],
      },
      {
        appId: "may",
        description: "Owns facts-based evaluation outcomes.",
        inputs: [{ kind: "goal", requiredData: [], dataTypes: {}, fixedData: {} }],
      },
    ]);
    expect(
      appDependencyCatalog(
        [{ appDir: "/fixtures/may.app", definition: { ...source, conversation: { mode: "agent" } } }],
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
            facts: Type.Array(Type.String()),
            constraints: Type.Optional(Type.Array(Type.String())),
            assessmentPurpose: Type.Union([Type.Literal("outcome"), Type.Literal("ongoing")]),
            openChoice: Type.Union([Type.Literal("known"), Type.String()]),
            nestedOpenChoice: Type.Union([
              Type.Union([Type.Literal("a"), Type.Literal("b")]),
              Type.Unknown(),
            ]),
            quotedChoices: Type.Union([Type.Literal("a|b"), Type.Literal("string")]),
            literalChoices: Type.Array(Type.Union([Type.Literal("red"), Type.Literal("blue")])),
            tooManyChoices: Type.Union([
              Type.Literal("one"),
              Type.Literal("two"),
              Type.Literal("three"),
              Type.Literal("four"),
              Type.Literal("five"),
              Type.Literal("six"),
              Type.Literal("seven"),
              Type.Literal("eight"),
              Type.Literal("nine"),
            ]),
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
        requiredData: [
          "assessmentPurpose",
          "facts",
          "literalChoices",
          "nestedOpenChoice",
          "openChoice",
          "outcome",
          "quotedChoices",
          "tooManyChoices",
        ],
        dataTypes: {
          assessmentPurpose: '"ongoing"|"outcome"',
          constraints: "string[]",
          facts: "string[]",
          literalChoices: '("blue"|"red")[]',
          nestedOpenChoice: "unknown",
          openChoice: "string",
          outcome: "string",
          quotedChoices: '"a|b"|"string"',
          tooManyChoices: "string",
        },
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
          outcome: "Review facts",
          acceptance: ["Reviewed"],
        },
      }),
    });

    expect(appDependencyCatalog([{ appDir: "/fixtures/incomplete.app", definition: target }], "may")).toEqual([]);
  });
});

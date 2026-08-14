import { describe, expect, it } from "bun:test";
import { Type, defineApp } from "@may-agent/sdk";
import { validateAppDefinition } from "./app-definition-validation.js";

const inputSchema = Type.Object({ kind: Type.String(), data: Type.Unknown() });

describe("canonical App definition validation", () => {
  it("accepts one complete canonical declaration", () => {
    const definition = defineApp({
      id: "evaluation",
      version: 1,
      owner: "evaluator",
      inputSchema,
      route: () => null,
      inbox: { batch: "single", maxConcurrent: 2 },
      subscriptions: [
        {
          id: "evaluation-request",
          event: "evaluation.requested",
          toInput: (event) => ({ kind: "request", data: event.data }),
        },
      ],
      schedules: [{ id: "review", intervalMs: 60_000, input: { kind: "review", data: {} } }],
      observers: [{ id: "health", intervalMs: 60_000, run: async () => [] }],
      actions: {
        evaluate: {
          description: "Evaluate one request",
          inputSchema: Type.Object({ id: Type.String() }),
          toInput: (data) => ({ kind: "evaluate", data }),
        },
      },
      workspace: { kind: "local", localPath: "." },
      tasks: {
        attach: true,
        subscriptions: ["evaluation.task.requested"],
        resolve: () => null,
        maxConcurrent: 2,
        resyncIntervalMs: 60_000,
      },
    });

    expect(validateAppDefinition(definition)).toEqual([]);
  });

  it("rejects ambiguous and incomplete canonical routes", () => {
    expect(
      validateAppDefinition({
        id: "broken",
        version: 1,
        owner: "owner",
        inputSchema: {},
        route: "owner",
        subscriptions: [
          { id: "same", event: "one" },
          { id: "same", event: {}, toInput() {} },
        ],
        schedules: [{ id: "tick", intervalMs: 0, input: { kind: "" } }],
        tasks: { subscriptions: ["task.requested"] },
      }),
    ).toEqual(
      expect.arrayContaining([
        "App broken subscription id is duplicated: same",
        "App broken route must be a function",
        "App broken subscription same requires toInput",
        "App broken subscription same requires a valid event selector",
        "App broken schedule tick intervalMs must be positive",
        "App broken schedule tick requires a valid App input",
        "App broken task subscriptions require resolve",
      ]),
    );
  });
});

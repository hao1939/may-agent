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
      observations: ["evaluation.reviewed"],
      schedules: [
        {
          id: "review",
          intervalMs: 60_000,
          input: { kind: "review", data: {} },
        },
        {
          id: "task-wake",
          intervalMs: 60_000,
          event: {
            type: "evaluation.review.due",
            data: { project: "evaluation" },
          },
        },
      ],
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
        observations: ["", {}],
        schedules: [
          { id: "tick", intervalMs: 0, input: { kind: "" } },
          { id: "missing-target", intervalMs: 1 },
          {
            id: "ambiguous-target",
            intervalMs: 1,
            input: { kind: "request", data: {} },
            event: { type: "request.due", data: {} },
          },
          {
            id: "invalid-event",
            intervalMs: 1,
            event: { type: "", data: {} },
            catchUp: "latest",
          },
        ],
        tasks: { subscriptions: ["task.requested"] },
      }),
    ).toEqual(
      expect.arrayContaining([
        "App broken subscription id is duplicated: same",
        "App broken route must be a function",
        "App broken subscription same requires toInput",
        "App broken subscription same requires a valid event selector",
        "App broken observations must contain valid event selectors",
        "App broken schedule tick intervalMs must be positive",
        "App broken schedule tick requires a valid App input",
        "App broken schedule missing-target requires exactly one App input or event",
        "App broken schedule ambiguous-target requires exactly one App input or event",
        "App broken schedule invalid-event requires a valid event",
        "App broken event schedule invalid-event cannot configure inbox catch-up",
        "App broken task subscriptions require resolve",
      ]),
    );
  });
});

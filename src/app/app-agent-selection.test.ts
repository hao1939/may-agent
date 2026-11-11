import { Type } from "@may-agent/sdk";
import { describe, expect, it } from "bun:test";
import { normalizeAppAgent, normalizeTaskAgent } from "./app-agent-selection.js";

const inputSchema = Type.Object({ kind: Type.String(), data: Type.Unknown() });

describe("App agent selection boundary", () => {
  it("keeps the canonical App agent and normalizes Task storage", () => {
    const definition = normalizeAppAgent({
      id: "sample",
      version: 1,
      agent: "worker",
      inputSchema,
      task: () => ({
        kind: "desired",
        intent: {
          id: "work/current",
          parentId: "sample",
          outcome: "Finish current work",
          acceptance: ["Work is complete"],
          agent: "specialist",
        },
      }),
      tasks: {},
    });

    expect(definition.agent).toBe("worker");
    expect(definition).not.toHaveProperty("owner");
    expect(
      definition.task?.({ id: "input", source: { kind: "system", id: "test" }, input: { kind: "x", data: {} } }),
    ).toMatchObject({
      kind: "desired",
      intent: { owner: "specialist" },
    });
  });

  it("rejects the retired App alias and conflicting Task selections", () => {
    expect(normalizeAppAgent({ id: "legacy", version: 1, agent: "worker", inputSchema })).toMatchObject({
      agent: "worker",
    });
    expect(() =>
      normalizeAppAgent({ id: "broken", version: 1, agent: "one", owner: "two", inputSchema } as any),
    ).toThrow("owner is retired");
    expect(() =>
      normalizeTaskAgent({
        id: "work",
        parentId: "root",
        outcome: "x",
        acceptance: ["x"],
        agent: "one",
        owner: "two",
      }),
    ).toThrow("conflicting agent and legacy owner");
    expect(() => normalizeAppAgent({ id: "empty", version: 1, agent: "", inputSchema })).toThrow(
      "agent must be a non-empty string",
    );
    expect(() =>
      normalizeTaskAgent({
        id: "empty",
        parentId: "root",
        outcome: "x",
        acceptance: ["x"],
        agent: " ",
      }),
    ).toThrow("agent must be a non-empty string");
  });
});

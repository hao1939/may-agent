import { describe, expect, it } from "bun:test";
import { Type } from "@may-agent/sdk";
import { normalizeAppAgent, normalizeTaskAgent } from "./app-agent-selection.js";

const inputSchema = Type.Object({ kind: Type.String(), data: Type.Unknown() });

describe("App agent selection boundary", () => {
  it("keeps agent canonical while supplying the private retained alias", () => {
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
          mode: "achieve",
          agent: "specialist",
        },
      }),
      tasks: {},
    });

    expect({ agent: definition.agent, owner: definition.owner }).toEqual({ agent: "worker", owner: "worker" });
    expect(
      definition.task?.({ id: "input", source: { kind: "system", id: "test" }, input: { kind: "x", data: {} } }),
    ).toMatchObject({
      kind: "desired",
      intent: { owner: "specialist" },
    });
  });

  it("accepts the legacy source alias but rejects two different selections", () => {
    expect(normalizeAppAgent({ id: "legacy", version: 1, owner: "worker", inputSchema })).toMatchObject({
      agent: "worker",
      owner: "worker",
    });
    expect(() =>
      normalizeAppAgent({ id: "broken", version: 1, agent: "one", owner: "two", inputSchema } as any),
    ).toThrow("conflicting agent and legacy owner");
    expect(() =>
      normalizeTaskAgent({
        id: "work",
        parentId: "root",
        outcome: "x",
        acceptance: ["x"],
        mode: "achieve",
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
        mode: "achieve",
        agent: " ",
      }),
    ).toThrow("agent must be a non-empty string");
  });
});

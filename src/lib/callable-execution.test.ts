import { describe, expect, test } from "bun:test";
import { Type } from "typebox";
import { CallableCatalog, type CallableDefinition } from "@may-agent/sdk";

function target(invoke: CallableDefinition["invoke"]): CallableDefinition {
  return {
    declaredName: "worker",
    description: "worker",
    inputSchema: Type.Object({
      prompt: Type.String({ minLength: 1 }),
      data: Type.Optional(Type.Unknown()),
    }, { additionalProperties: false }),
    outputSchema: Type.Object({ ok: Type.Boolean() }),
    invoke,
  };
}

describe("production callable execution contract", () => {
  test("rejects every invalid envelope before starting a child and returns no execution id", async () => {
    let starts = 0;
    const catalog = new CallableCatalog([target(async () => {
      starts++;
      return { executionId: "should-not-start", report: { status: "done", summary: "started", output: { ok: true } } };
    })]);
    const invalid = [{}, { prompt: "  " }, "legacy", { prompt: "valid", task: "legacy" }, { prompt: "valid", data: { value: Infinity } }];
    for (const input of invalid) {
      try {
        const result = await catalog.call("global/worker", input, undefined, { signal: new AbortController().signal });
        expect(result.id).toBeUndefined();
        expect(result.status).toBe("error");
      } catch (error) {
        expect(String(error).toLowerCase()).toContain("callable input");
      }
    }
    expect(starts).toBe(0);
  });

  test("binds the runtime child id and validates complete and partial reports", async () => {
    const complete = new CallableCatalog([target(async () => ({
      executionId: "s_child",
      report: { status: "done", summary: "complete", output: { ok: true } },
    }))]);
    await expect(complete.call("global/worker", { prompt: "Run" }, undefined, {
      signal: new AbortController().signal,
    })).resolves.toEqual({ id: "s_child", status: "done", summary: "complete", output: { ok: true } });

    const partial = new CallableCatalog([target(async () => ({
      executionId: "s_partial",
      report: { status: "blocked", summary: "needs input", facts: { retained: true } },
    }))]);
    await expect(partial.call("global/worker", { prompt: "Run" }, undefined, {
      signal: new AbortController().signal,
    })).resolves.toEqual({ id: "s_partial", status: "blocked", summary: "needs input", facts: { retained: true } });
  });
});

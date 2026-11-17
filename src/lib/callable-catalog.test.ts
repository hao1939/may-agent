import { describe, expect, test } from "bun:test";
import { Type } from "typebox";
import { CallableCatalog, CallableCatalogStore, type CallableDefinition } from "@may-agent/sdk";

function definition(appId: string | undefined, declaredName: string): CallableDefinition {
  return {
    ...(appId ? { appId } : {}),
    declaredName,
    description: `${appId ?? "global"} ${declaredName}`,
    inputSchema: Type.Object({
      prompt: Type.String({ minLength: 1 }),
      data: Type.Optional(Type.Unknown()),
    }, { additionalProperties: false }),
    async invoke(input) {
      return { executionId: `child-${appId ?? "global"}-${declaredName}`, report: { status: "done", summary: "called", output: input.data } };
    },
  };
}

describe("production callable catalog contract", () => {
  test("preserves global and App namespaces and invokes every exact listed address", async () => {
    const catalog = new CallableCatalog([
      definition(undefined, "reviewer"),
      definition("alpha", "reviewer"),
      definition("beta", "reviewer"),
    ]);
    const names = catalog.list().map((descriptor) => descriptor.name);
    expect(names).toEqual(["alpha/reviewer", "beta/reviewer", "global/reviewer"]);
    for (const name of names) {
      const result = await catalog.call(name, { prompt: "Review", data: { name } }, undefined, {
        signal: new AbortController().signal,
      });
      expect(result).toMatchObject({ status: "done", output: { name } });
    }
  });

  test("rejects only identical canonical duplicates and keeps a prior captured catalog after failed reload", () => {
    const store = new CallableCatalogStore([definition("alpha", "reviewer"), definition("beta", "reviewer")]);
    const captured = store.capture();
    expect(store.reload([definition("alpha", "reviewer"), definition("alpha", "reviewer")]).ok).toBe(false);
    expect(store.capture()).toBe(captured);
    expect(captured.list().map((descriptor) => descriptor.name)).toEqual(["alpha/reviewer", "beta/reviewer"]);
  });
});

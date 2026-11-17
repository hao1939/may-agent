import { describe, expect, test } from "bun:test";
import { Type } from "typebox";
import {
  CallableCatalog,
  CallableCatalogStore,
  CallableValidationError,
  canonicalCallableName,
  type CallableDefinition,
} from "./callable.js";

const signal = new AbortController().signal;

function definition(
  declaredName: string,
  appId?: string,
  overrides: Partial<CallableDefinition> = {},
): CallableDefinition {
  return {
    ...(appId ? { appId } : {}),
    declaredName,
    description: `${declaredName} description`,
    async invoke(input) {
      return { executionId: `child-${declaredName}`, report: { status: "done", summary: "ok", output: input.data } };
    },
    ...overrides,
  };
}

describe("canonical callable catalog", () => {
  test("uses exact app/global names and returns one immutable sorted descriptor list", () => {
    const catalog = new CallableCatalog([
      definition("zeta"),
      definition("review", "alex", { dataSchema: Type.Object({ ref: Type.String() }) }),
    ]);

    expect(catalog.list().map((item) => item.name)).toEqual(["alex/review", "global/zeta"]);
    expect(catalog.has("review")).toBe(false);
    expect(catalog.has("alex/review")).toBe(true);
    expect(Object.isFrozen(catalog.list())).toBe(true);
    expect(Object.isFrozen(catalog.list()[0])).toBe(true);
    expect(catalog.list()[0]?.inputSchema).toMatchObject({
      type: "object",
      required: ["prompt"],
      additionalProperties: false,
    });
  });

  test("rejects duplicate exact names and reserved or ambiguous components", () => {
    expect(() => new CallableCatalog([definition("same", "alex"), definition("same", "alex")])).toThrow(
      "Duplicate callable canonical name: alex/same",
    );
    expect(() => canonicalCallableName("global", "x")).toThrow('App id "global" is reserved');
    expect(() => canonicalCallableName("alex", "bad/name")).toThrow("without '/'");
    expect(() => canonicalCallableName(" Alex", "name")).toThrow("exact name component");
  });

  test("failed reload preserves the prior active catalog and captured calls stay pinned", async () => {
    const store = new CallableCatalogStore([definition("first", "alex")]);
    const captured = store.capture();
    const failed = store.reload([definition("dup", "alex"), definition("dup", "alex")]);

    expect(failed.ok).toBe(false);
    expect(store.capture()).toBe(captured);
    expect(captured.list().map((item) => item.name)).toEqual(["alex/first"]);

    const replacement = store.reload([definition("second", "alex")]);
    expect(replacement.ok).toBe(true);
    expect(store.capture()).not.toBe(captured);
    expect(captured.has("alex/first")).toBe(true);
    expect(captured.has("alex/second")).toBe(false);
    expect(await captured.call("alex/first", { prompt: "run", data: { kept: true } }, undefined, { signal })).toEqual({
      id: "child-first",
      status: "done",
      summary: "ok",
      output: { kept: true },
    });
  });
});

describe("shared callable input and result contract", () => {
  const outputSchema = Type.Object({ verdict: Type.String() });
  const catalog = new CallableCatalog([
    definition("review", "alex", {
      dataSchema: Type.Object({ ref: Type.String() }),
      outputSchema,
      async invoke(input) {
        return {
          executionId: "s_child",
          report: { status: "done", summary: "reviewed", output: { verdict: input.prompt } },
        };
      },
    }),
  ]);

  test("requires nonblank prompt, rejects retired fields, and binds the actual child id", async () => {
    await expect(catalog.call("alex/review", { data: { ref: "HEAD" } }, undefined, { signal })).rejects.toThrow(
      CallableValidationError,
    );
    await expect(catalog.call("alex/review", { prompt: "  ", data: { ref: "HEAD" } }, undefined, { signal })).rejects.toThrow(
      "non-whitespace",
    );
    await expect(
      catalog.call("alex/review", { prompt: "review", data: { ref: "HEAD" }, task: "legacy" }, undefined, { signal }),
    ).rejects.toThrow("Invalid callable input");

    await expect(
      catalog.call("alex/review", { prompt: "accept", data: { ref: "HEAD" } }, { schema: outputSchema }, { signal }),
    ).resolves.toEqual({
      id: "s_child",
      status: "done",
      summary: "reviewed",
      output: { verdict: "accept" },
    });
  });

  test("returns pre-start lookup errors without an id and validates every exposed output", async () => {
    await expect(catalog.call("alex/missing", { prompt: "run" }, undefined, { signal })).resolves.toEqual({
      status: "error",
      summary: "Callable target not found: alex/missing",
    });

    const invalid = new CallableCatalog([
      definition("invalid", "alex", {
        outputSchema,
        async invoke() {
          return { executionId: "s_invalid", report: { status: "blocked", summary: "partial", output: { verdict: 42 } } };
        },
      }),
    ]);
    await expect(invalid.call("alex/invalid", { prompt: "run" }, undefined, { signal })).rejects.toThrow(
      "failed schema validation",
    );
  });

  test("rejects producer-selected ids, malformed reports, missing successful output, and retired result fields", async () => {
    const cases: Array<[string, unknown, string]> = [
      ["chosen-id", { status: "done", summary: "bad", id: "fake", output: { verdict: "x" } }, "must not choose"],
      ["malformed", "plain prose", "no result envelope"],
      ["missing-output", { status: "done", summary: "bad" }, "omitted required output"],
      ["retired", { status: "done", summary: "bad", kind: "agent", output: { verdict: "x" } }, "retired executor"],
    ];
    for (const [name, report, message] of cases) {
      const broken = new CallableCatalog([
        definition(name, "alex", { outputSchema, async invoke() { return { executionId: `s_${name}`, report }; } }),
      ]);
      await expect(broken.call(`alex/${name}`, { prompt: "run" }, undefined, { signal })).rejects.toThrow(message);
    }
  });

  test("accepts useful partial reports without output when a schema was requested", async () => {
    const partial = new CallableCatalog([
      definition("partial", "alex", {
        outputSchema,
        async invoke() {
          return { executionId: "s_partial", report: { status: "blocked", summary: "needs fixture", facts: ["kept"] } };
        },
      }),
    ]);
    await expect(
      partial.call("alex/partial", { prompt: "run" }, { schema: outputSchema, timeoutMs: 50 }, { signal }),
    ).resolves.toEqual({ id: "s_partial", status: "blocked", summary: "needs fixture", facts: ["kept"] });
  });

  test("bounds calls with inherited cancellation and timeout", async () => {
    let observedAbort = false;
    const slow = new CallableCatalog([
      definition("slow", "alex", {
        async invoke(_input, context) {
          await new Promise<void>((resolve) => {
            context.signal.addEventListener("abort", () => {
              observedAbort = true;
              resolve();
            }, { once: true });
          });
          return { status: "interrupted", summary: "stopped" };
        },
      }),
    ]);
    await expect(slow.call("alex/slow", { prompt: "wait" }, { timeoutMs: 5 }, { signal })).rejects.toThrow(
      'Callable "alex/slow" timed out',
    );
    expect(observedAbort).toBe(true);
  });
});

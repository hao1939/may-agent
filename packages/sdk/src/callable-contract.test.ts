import { describe, expect, test } from "bun:test";
import { Type } from "typebox";
import { Check } from "typebox/value";
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
      definition("review", "alex", {
        inputSchema: Type.Object({
          prompt: Type.String({ minLength: 1 }),
          data: Type.Object({ ref: Type.String() }),
        }, { additionalProperties: false }),
      }),
    ]);

    expect(catalog.list().map((item) => item.name)).toEqual(["alex/review", "global/zeta"]);
    expect(catalog.has("review")).toBe(false);
    expect(catalog.has("alex/review")).toBe(true);
    expect(Object.isFrozen(catalog.list())).toBe(true);
    expect(Object.isFrozen(catalog.list()[0])).toBe(true);
    expect(Check(catalog.list()[0]!.inputSchema, { prompt: "review", data: { ref: "HEAD" } })).toBe(true);
    expect(Check(catalog.list()[0]!.inputSchema, { prompt: "review" })).toBe(false);
  });

  test("uses full-envelope target schemas without wrapping them under data", async () => {
    const fullEnvelope = Type.Object(
      {
        prompt: Type.String({ minLength: 1 }),
        data: Type.Object({ ref: Type.String() }),
      },
      { additionalProperties: false },
    );
    const catalog = new CallableCatalog([definition("full", "alex", { inputSchema: fullEnvelope })]);

    const descriptorSchema = catalog.list()[0]!.inputSchema;
    expect(Check(descriptorSchema, { prompt: "review", data: { wrong: true } })).toBe(false);
    expect(descriptorSchema).toMatchObject({ allOf: expect.any(Array) });
    await expect(
      catalog.call("alex/full", { prompt: "review", data: { ref: "HEAD" } }, undefined, { signal }),
    ).resolves.toMatchObject({ status: "done", output: { ref: "HEAD" } });
    expect(
      () => new CallableCatalog([definition("legacy", "alex", { dataSchema: Type.Unknown() } as unknown as Partial<CallableDefinition>)]),
    ).toThrow("no longer accept dataSchema or effectiveInputSchema");
  });

  test("rejects duplicate exact names and reserved or ambiguous components", () => {
    expect(() => new CallableCatalog([definition("same", "alex"), definition("same", "alex")])).toThrow(
      "Duplicate callable canonical name: alex/same",
    );
    expect(() => canonicalCallableName("global", "x")).toThrow('App id "global" is reserved');
    expect(() => canonicalCallableName("alex", "bad/name")).toThrow("without '/'");
    expect(() => canonicalCallableName(" Alex", "name")).toThrow("exact name component");
    expect(() => canonicalCallableName("alpha team", "reviewer")).toThrow("without '/' or whitespace");
    expect(() => canonicalCallableName("alpha", "team reviewer")).toThrow("without '/' or whitespace");
    expect(() => canonicalCallableName("alpha", "team\treviewer")).toThrow("without '/' or whitespace");
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
      inputSchema: Type.Object({
        prompt: Type.String({ minLength: 1 }),
        data: Type.Object({ ref: Type.String() }),
      }, { additionalProperties: false }),
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
    await expect(invalid.call("alex/invalid", { prompt: "run" }, undefined, { signal })).resolves.toMatchObject({
      id: "s_invalid",
      status: "error",
      summary: expect.stringContaining("failed schema validation"),
      facts: { phase: "output", invalidEvidence: { verdict: 42 } },
    });
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
      await expect(broken.call(`alex/${name}`, { prompt: "run" }, undefined, { signal })).resolves.toMatchObject({
        id: `s_${name}`,
        status: "error",
        summary: expect.stringContaining(message),
      });
    }
  });

  test("accepts shared acyclic object and array references while rejecting cycles and non-JSON values", async () => {
    const shared = { ref: "HEAD" };
    const sharedArray = [shared];
    const sharing = new CallableCatalog([
      definition("sharing", "alex", {
        async invoke() {
          return {
            executionId: "s_sharing",
            report: {
              status: "done",
              summary: "shared references",
              output: { before: shared, after: shared, arrays: [sharedArray, sharedArray] },
              facts: { first: shared, second: shared, arrays: [sharedArray, sharedArray] },
            },
          };
        },
      }),
    ]);
    await expect(
      sharing.call(
        "alex/sharing",
        { prompt: "Compare", data: { before: shared, after: shared, arrays: [sharedArray, sharedArray] } },
        undefined,
        { signal },
      ),
    ).resolves.toMatchObject({
      id: "s_sharing",
      status: "done",
      output: { before: { ref: "HEAD" }, after: { ref: "HEAD" } },
      facts: { first: { ref: "HEAD" }, second: { ref: "HEAD" } },
    });

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    await expect(
      sharing.call("alex/sharing", { prompt: "Compare", data: cycle }, undefined, { signal }),
    ).rejects.toThrow("JSON-compatible");
    for (const nonJson of [undefined, 1n, () => "nope", new Date(0)]) {
      await expect(
        sharing.call("alex/sharing", { prompt: "Compare", data: { nonJson } }, undefined, { signal }),
      ).rejects.toThrow("JSON-compatible");
    }
  });

  test("bounds compact shared DAG validation before expanded serialization", async () => {
    let getterReads = 0;
    let shared: unknown = { value: "leaf" };
    for (let depth = 0; depth < 19; depth++) {
      const child = shared;
      shared = Object.defineProperties({}, {
        left: { enumerable: true, get: () => { getterReads++; return child; } },
        right: { enumerable: true, get: () => { getterReads++; return child; } },
      });
    }
    const bounded = new CallableCatalog([definition("bounded", "alex")]);

    await expect(
      bounded.call("alex/bounded", { prompt: "Inspect", data: shared }, undefined, { signal }),
    ).rejects.toThrow("maximum expanded JSON size of 1048576 bytes");
    expect(getterReads).toBeLessThanOrEqual(38);
  });

  test("enforces deterministic JSON depth and traversal limits", async () => {
    const bounded = new CallableCatalog([definition("bounded", "alex")]);
    let deep: Record<string, unknown> = {};
    for (let depth = 0; depth < 101; depth++) deep = { child: deep };
    await expect(
      bounded.call("alex/bounded", { prompt: "Inspect", data: deep }, undefined, { signal }),
    ).rejects.toThrow("maximum JSON nesting depth of 100");

    const sparse = new Array(100_001);
    await expect(
      bounded.call("alex/bounded", { prompt: "Inspect", data: sparse }, undefined, { signal }),
    ).rejects.toThrow("maximum JSON traversal of 100000 values");
  });

  test("enforces depth when a cached subtree is reused under a deeper path", async () => {
    let shared: unknown = { value: "leaf" };
    for (let depth = 0; depth < 30; depth++) shared = { child: shared };
    let deep = shared;
    for (let depth = 0; depth < 80; depth++) deep = { child: deep };
    const bounded = new CallableCatalog([definition("cached-depth", "alex")]);

    await expect(
      bounded.call(
        "alex/cached-depth",
        { prompt: "Inspect", data: { warmCache: shared, deepReuse: deep } },
        undefined,
        { signal },
      ),
    ).rejects.toThrow("maximum JSON nesting depth of 100");
  });

  test("rejects custom toJSON hooks and inherited array values before serialization", async () => {
    const bounded = new CallableCatalog([definition("serialization-parity", "alex")]);
    const customSerialization = Object.defineProperty({}, "toJSON", {
      value: () => ({ expanded: "x".repeat(2_000_000) }),
    });
    await expect(
      bounded.call(
        "alex/serialization-parity",
        { prompt: "Inspect", data: customSerialization },
        undefined,
        { signal },
      ),
    ).rejects.toThrow("JSON-compatible");

    const inheritedValues = [] as unknown[];
    inheritedValues.length = 1;
    Object.setPrototypeOf(inheritedValues, Object.assign(Object.create(Array.prototype), { 0: 1n }));
    await expect(
      bounded.call(
        "alex/serialization-parity",
        { prompt: "Inspect", data: inheritedValues },
        undefined,
        { signal },
      ),
    ).rejects.toThrow("JSON-compatible");
  });

  test.each(["output", "facts"] as const)("bounds expanded callable result %s", async (field) => {
    let shared: unknown = { value: "leaf" };
    for (let depth = 0; depth < 19; depth++) shared = { left: shared, right: shared };
    const bounded = new CallableCatalog([
      definition(`bounded-${field}`, "alex", {
        async invoke() {
          return {
            executionId: `s_bounded_${field}`,
            report: { status: "done", summary: "bounded", [field]: shared },
          };
        },
      }),
    ]);

    await expect(
      bounded.call(`alex/bounded-${field}`, { prompt: "Inspect" }, undefined, { signal }),
    ).resolves.toMatchObject({
      id: `s_bounded_${field}`,
      status: "error",
      summary: expect.stringContaining("maximum expanded JSON size of 1048576 bytes"),
      facts: { phase: field === "output" ? "output" : "result" },
    });
  });

  test("bounds the combined expanded result and counts UTF-8 bytes", async () => {
    const largeUtf8 = "é".repeat(300_000);
    const bounded = new CallableCatalog([
      definition("combined", "alex", {
        async invoke() {
          return {
            executionId: "s_combined",
            report: { status: "done", summary: "bounded", output: largeUtf8, facts: largeUtf8 },
          };
        },
      }),
    ]);

    await expect(
      bounded.call("alex/combined", { prompt: "Inspect" }, undefined, { signal }),
    ).resolves.toMatchObject({
      id: "s_combined",
      status: "error",
      summary: expect.stringContaining("Callable result exceeds maximum expanded JSON size of 1048576 bytes"),
      facts: { phase: "result" },
    });
  });

  test("bounds adversarial escaped strings and property names without materializing JSON", async () => {
    const bounded = new CallableCatalog([definition("bounded-strings", "alex")]);
    const escaped = "\\".repeat(600_000);
    await expect(
      bounded.call("alex/bounded-strings", { prompt: "Inspect", data: escaped }, undefined, { signal }),
    ).rejects.toThrow("maximum expanded JSON size of 1048576 bytes");
    await expect(
      bounded.call("alex/bounded-strings", { prompt: "Inspect", data: { [escaped]: true } }, undefined, { signal }),
    ).rejects.toThrow("maximum expanded JSON size of 1048576 bytes");

    let rope = "x";
    for (let depth = 0; depth < 26; depth++) rope += rope;
    expect(rope.length).toBe(67_108_864);
    await expect(
      bounded.call("alex/bounded-strings", { prompt: "Inspect", data: rope }, undefined, { signal }),
    ).rejects.toThrow("maximum expanded JSON size of 1048576 bytes");
  });

  test("bounds repeated long schema paths and the resulting error envelope", async () => {
    const longKey = "k".repeat(220_000);
    const bounded = new CallableCatalog([
      definition("bounded-diagnostic", "alex", {
        outputSchema: Type.Object({
          [longKey]: Type.Tuple([
            Type.String(), Type.String(), Type.String(), Type.String(), Type.String(),
          ]),
        }),
        async invoke() {
          return {
            executionId: "s_bounded_diagnostic",
            report: {
              status: "done",
              summary: "invalid output",
              output: { [longKey]: [1, 2, 3, 4, 5] },
            },
          };
        },
      }),
    ]);

    const result = await bounded.call("alex/bounded-diagnostic", { prompt: "Inspect" }, undefined, { signal });
    expect(result.id).toBe("s_bounded_diagnostic");
    expect(result.status).toBe("error");
    expect(result.facts).toMatchObject({ phase: "output" });
    expect(result.summary).toStartWith("Callable result output failed schema validation");
    expect(result.summary).toContain("…[truncated]");
    expect(result.summary.length).toBeLessThan(10_000);
    expect(JSON.stringify(result).length).toBeLessThan(1_048_576);
  });

  test("returns bounded diagnostics without coercing rejected evidence", async () => {
    const hostile = Object.create(null) as { toString?: () => string };
    hostile.toString = () => { throw new Error("must not coerce rejected evidence"); };
    const bounded = new CallableCatalog([
      definition("hostile-evidence", "alex", {
        async invoke() {
          return {
            executionId: "s_hostile_evidence",
            report: { status: "done", summary: "hostile", output: [hostile] },
          };
        },
      }),
    ]);

    await expect(
      bounded.call("alex/hostile-evidence", { prompt: "Inspect" }, undefined, { signal }),
    ).resolves.toMatchObject({
      id: "s_hostile_evidence",
      status: "error",
      summary: expect.stringContaining("JSON-compatible"),
      facts: { phase: "output", invalidEvidence: "[omitted: incompatible]" },
    });
  });

  test("does not coerce an invalid recursively shared result status before admission", async () => {
    let coercions = 0;
    const leaf = {
      toString() {
        coercions++;
        return "invalid";
      },
    };
    let sharedStatus: unknown = leaf;
    for (let depth = 0; depth < 19; depth++) sharedStatus = [sharedStatus, sharedStatus];
    const bounded = new CallableCatalog([
      definition("invalid-status", "alex", {
        async invoke() {
          return {
            executionId: "s_invalid_status",
            report: { status: sharedStatus, summary: "invalid status" } as never,
          };
        },
      }),
    ]);

    await expect(
      bounded.call("alex/invalid-status", { prompt: "Inspect" }, undefined, { signal }),
    ).resolves.toMatchObject({
      id: "s_invalid_status",
      status: "error",
      summary: "Invalid callable result status; expected done, blocked, error, or interrupted",
      facts: { phase: "result", invalidEvidence: "[omitted: incompatible]" },
    });
    expect(coercions).toBe(0);
  });

  test("rejects cycles in callable output and facts", async () => {
    for (const field of ["output", "facts"] as const) {
      const cycle: Record<string, unknown> = {};
      cycle.self = cycle;
      const cyclic = new CallableCatalog([
        definition(`cyclic-${field}`, "alex", {
          async invoke() {
            return {
              executionId: `s_cyclic_${field}`,
              report: { status: "done", summary: "cyclic", [field]: cycle },
            };
          },
        }),
      ]);
      await expect(
        cyclic.call(`alex/cyclic-${field}`, { prompt: "Inspect" }, undefined, { signal }),
      ).resolves.toMatchObject({
        id: `s_cyclic_${field}`,
        status: "error",
        summary: expect.stringContaining("JSON-compatible"),
      });
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

  test("bounds never-settling cleanup after timeout and parent cancellation", async () => {
    for (const mode of ["timeout", "cancel"] as const) {
      const parent = new AbortController();
      const stuck = new CallableCatalog([
        definition(`stuck-${mode}`, "alex", {
          async invoke(): Promise<never> {
            return new Promise<never>(() => {});
          },
        }),
      ]);
      const startedAt = Date.now();
      const call = stuck.call(
        `alex/stuck-${mode}`,
        { prompt: "wait" },
        mode === "timeout" ? { timeoutMs: 5 } : undefined,
        { signal: parent.signal },
      );
      if (mode === "cancel") setTimeout(() => parent.abort(new Error("parent stopped")), 5);
      await expect(call).rejects.toThrow(
        mode === "timeout"
          ? 'cleanup remained unconfirmed after 2000ms; originating failure: Callable "alex/stuck-timeout" timed out after 5ms'
          : "cleanup remained unconfirmed after 2000ms; originating failure: parent stopped",
      );
      expect(Date.now() - startedAt).toBeLessThan(3_000);
    }
  });

  test("shortens inherited timeouts and stays joined through cancellation cleanup", async () => {
    const order: string[] = [];
    let observedTimeout: number | undefined;
    const slow = new CallableCatalog([
      definition("slow", "alex", {
        async invoke(_input, context) {
          observedTimeout = context.timeoutMs;
          await new Promise<void>((resolve) => {
            context.signal.addEventListener("abort", () => {
              order.push("aborted");
              setTimeout(() => {
                order.push("cleanup-settled");
                resolve();
              }, 5);
            }, { once: true });
          });
          return { status: "interrupted", summary: "stopped" };
        },
      }),
    ]);
    await expect(
      slow.call("alex/slow", { prompt: "wait" }, { timeoutMs: 50 }, { signal, timeoutMs: 5 }),
    ).rejects.toThrow('Callable "alex/slow" timed out after 5ms');
    order.push("caller-released");
    expect(observedTimeout).toBe(5);
    expect(order).toEqual(["aborted", "cleanup-settled", "caller-released"]);
  });
});

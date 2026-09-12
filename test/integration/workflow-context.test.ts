/** Exercise the actual SDK boundary, without a model or installed Apps. */
import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkflowRunner, type WorkflowToolOptions } from "../../src/lib/workflow-tool.js";
import { buildRuntimeCtx } from "../../src/lib/runtime-ctx.js";
import type { WorkflowEvent } from "../../src/lib/workflow.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function runFixture(body: string, options: Partial<WorkflowToolOptions> = {}) {
  const root = mkdtempSync(join(tmpdir(), "may-workflow-context-"));
  roots.push(root);
  writeFileSync(join(root, "helper.ts"), `export async function calculate() { return 6 * 7; }`);
  writeFileSync(
    join(root, "fixture.ts"),
    `
    import { calculate } from "./helper.ts";
    export const name = "fixture";
    export const description = "SDK boundary regression fixture";
    export async function execute(ctx) { ${body} }
  `,
  );
  const events: WorkflowEvent[] = [];
  const callAgent = mock(() => {
    throw new Error("No model should run");
  });
  const runner = createWorkflowRunner({
    manager: { callAgent, status: () => [] } as unknown as WorkflowToolOptions["manager"],
    workflowDir: root,
    agentName: "fixture-owner",
    onEvent: (event) => events.push(event),
    ...options,
  });
  const result = await runner.run("fixture", "input");
  expect(callAgent).not.toHaveBeenCalled();
  return { result, events };
}

describe("one workflow context", () => {
  for (const mode of ["direct", "runtime", "task"] as const) {
    it(`exposes only SDK capabilities in ${mode} execution`, async () => {
      const runtimeCtx = buildRuntimeCtx({
        bus: { emit: () => undefined } as any,
        agentName: "fixture-owner",
        persistDir: "/not-exposed/state",
        projectRoot: "/not-exposed/project",
        agentsRoot: "/not-exposed/agents",
        sharedRoot: "/not-exposed/shared",
        projectsRoot: "/not-exposed/projects",
      });
      const { result } = await runFixture(
        `
        return ctx.done("scope", {
          keys: Object.keys(ctx).sort(),
          metrics: Object.keys(ctx.metrics).sort(),
          log: Object.keys(ctx.log).sort(),
          callableLog: typeof ctx.log === "function",
          activeSignal: ctx.signal instanceof AbortSignal && !ctx.signal.aborted,
          input: ctx.input,
          done: ctx.done("nested", { accepted: true }),
          blocked: ctx.blocked("wait", { reason: "evidence" }),
        });
      `,
        {
          ...(mode !== "direct"
            ? {
                runtimeCtx,
                executionPaths: { appDir: "/app-scope", projectDir: "/project-scope", workspaceDir: "/attempt-scope" },
              }
            : {}),
          ...(mode === "task" ? { taskEmitter: { publish: () => 41, onEvent: () => () => {} } } : {}),
        },
      );
      expect(result).toMatchObject({
        type: "done",
        output: {
          keys: [
            "agents",
            "blocked",
            "done",
            "events",
            "input",
            "log",
            "metrics",
            "read",
            "signal",
            "workflows",
            ...(mode !== "direct" ? ["workspace"] : []),
          ].sort(),
          metrics: ["define", "defineMany", "evaluate", "record"],
          log: ["debug", "error", "info", "warn"],
          callableLog: false,
          activeSignal: true,
          input: "input",
          done: {
            id: expect.any(String),
            kind: "workflow",
            status: "done",
            summary: "nested",
            output: { accepted: true },
          },
          blocked: {
            id: expect.any(String),
            kind: "workflow",
            status: "blocked",
            summary: "wait",
            evidence: { reason: "evidence" },
          },
        },
      });
      if (result.type === "done") {
        const output = result.output as { done: object; blocked: object };
        expect(Object.keys(output.done).sort()).toEqual(["id", "kind", "output", "status", "summary"]);
        expect(Object.keys(output.blocked).sort()).toEqual(["evidence", "id", "kind", "status", "summary"]);
      }
    });
  }

  it("calls an ordinary imported helper without manufacturing session/step evidence", async () => {
    const { result, events } = await runFixture(`return ctx.done("calculated", await calculate());`);
    expect(result).toMatchObject({ type: "done", output: 42, steps: [] });
    expect(events.map((event) => event.type)).toEqual(["workflow.started", "workflow.completed"]);
  });

  it("forwards the SDK metric operations without leaking the whole service", async () => {
    const calls: unknown[][] = [];
    const metrics = {
      define: (definition: unknown) => calls.push(["define", definition]),
      defineMany: (definitions: unknown) => calls.push(["defineMany", definitions]),
      record: (...args: unknown[]) => calls.push(["record", ...args]),
      evaluate: (id: string) => {
        calls.push(["evaluate", id]);
        return [{ id }];
      },
      getDb: () => {
        throw new Error("Private service method must not leak");
      },
    };
    const { result } = await runFixture(
      `
      ctx.metrics.define({ id: "one" });
      ctx.metrics.defineMany([{ id: "two" }]);
      await ctx.metrics.record("one", 42, "fixture");
      await ctx.metrics.record("two", 1, { note: "options", sampleCount: 3 });
      return ctx.done("recorded", { evaluated: ctx.metrics.evaluate("one"), keys: Object.keys(ctx.metrics).sort() });
    `,
      { runtimeCtx: { metrics, emit: () => {} } as unknown as WorkflowToolOptions["runtimeCtx"] },
    );
    expect(result).toMatchObject({
      type: "done",
      output: {
        evaluated: [{ id: "one" }],
        keys: ["define", "defineMany", "evaluate", "record"],
      },
    });
    expect(calls).toEqual([
      ["define", { id: "one" }],
      ["defineMany", [{ id: "two" }]],
      ["record", "one", 42, { note: "fixture" }],
      ["record", "two", 1, { note: "options", sampleCount: 3 }],
      ["evaluate", "one"],
    ]);
  });

  it("uses ordinary try/catch for a helper's recoverable error", async () => {
    const { result } = await runFixture(`
      try { await Promise.reject(new Error("fixture failure")); }
      catch (error) { return ctx.done("recovered", { error: error.message, value: await calculate() }); }
    `);
    expect(result).toMatchObject({ type: "done", output: { error: "fixture failure", value: 42 } });
  });

  it("reports unhandled helper failure as a failed workflow", async () => {
    const { result } = await runFixture(`await Promise.reject(new Error("helper failed"));`);
    expect(result).toMatchObject({ type: "error", error: "helper failed" });
  });

  it("bounds a stalled helper with the existing whole-workflow deadline", async () => {
    const { result } = await runFixture(`await new Promise(() => {});`, { executionTimeoutMs: 20 });
    expect(result).toMatchObject({ type: "error", error: expect.stringContaining("timed out after 20ms") });
  });

  it("does not truncate helper data inside the workflow", async () => {
    const { result } = await runFixture(`
      const value = await Promise.resolve("a".repeat(60_000));
      if (value.length !== 60_000) throw new Error("helper output was truncated");
      return ctx.done("complete data", { length: value.length });
    `);
    expect(result).toMatchObject({ type: "done", output: { length: 60_000 } });
  });

  it("rejects old terminal result shapes instead of silently accepting a second API", async () => {
    const { result } = await runFixture(`return { type: "done", summary: "old contract" };`);
    expect(result).toMatchObject({ type: "error", error: "Workflow returned an invalid terminal execution result" });
  });
});

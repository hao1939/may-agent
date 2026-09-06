/** Exercise function steps through the real workflow runner, without a model. */
import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";
import type { WorkflowEvent } from "../../src/lib/workflow.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function runFixture(body: string) {
  const root = mkdtempSync(join(tmpdir(), "may-function-step-"));
  roots.push(root);
  writeFileSync(
    join(root, "fixture.ts"),
    `
    export const name = "fixture";
    export const description = "Function-step regression fixture";
    export async function execute(ctx) { ${body} }
  `,
  );
  const events: WorkflowEvent[] = [];
  const callAgent = mock(() => {
    throw new Error("Function steps must not call a model");
  });
  const runner = createWorkflowRunner({
    manager: { callAgent } as unknown as Parameters<typeof createWorkflowRunner>[0]["manager"],
    workflowDir: root,
    agentName: "fixture-owner",
    onEvent: (event) => events.push(event),
  });
  const result = await runner.run("fixture", "Exercise function steps");
  expect(callAgent).not.toHaveBeenCalled();
  return { result, events };
}

describe("workflow function steps", () => {
  it("executes a function and reports its result through lifecycle callbacks", async () => {
    const { result, events } = await runFixture(`
      const step = await ctx.runFunction("calculate", async () => String(6 * 7));
      return ctx.done(step.lastAssistantText);
    `);
    expect(result).toMatchObject({ type: "done", summary: "42" });
    const lifecycle = events.filter((event) => event.type.startsWith("workflow.step_"));
    expect(lifecycle).toEqual([
      { type: "workflow.step_started", step: "fn:calculate" },
      expect.objectContaining({
        type: "workflow.step_completed",
        step: "fn:calculate",
        result: expect.objectContaining({ status: "done", lastAssistantText: "42", turnsUsed: 0 }),
      }),
    ]);
  });

  it("captures a thrown error and lets the workflow handle it and continue", async () => {
    const { result, events } = await runFixture(`
      const failed = await ctx.runFunction("fail", async () => { throw new Error("fixture failure"); });
      if (failed.status !== "error") throw new Error("Expected a failed step");
      const next = await ctx.runFunction("recover", async () => "continued");
      return ctx.done(next.lastAssistantText);
    `);
    expect(result).toMatchObject({ type: "done", summary: "continued" });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "workflow.step_completed",
        step: "fn:fail",
        result: expect.objectContaining({ status: "error", error: "fixture failure" }),
      }),
    );
  });

  it("bounds large function output in the actual step result", async () => {
    const { result, events } = await runFixture(`
      const step = await ctx.runFunction("large", async () => "a".repeat(60_000));
      return ctx.done(step.lastAssistantText);
    `);
    const expected = "a".repeat(50_000) + "\n…(truncated)";
    expect(result).toMatchObject({ type: "done", summary: expected });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "workflow.step_completed",
        step: "fn:large",
        result: expect.objectContaining({ status: "done", lastAssistantText: expected }),
      }),
    );
  });
});

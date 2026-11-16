import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BeforeToolCallContext } from "@earendil-works/pi-agent-core";
import { validateToolArguments, type ToolCall } from "@earendil-works/pi-ai";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { taskAgentResultSchema } from "@may-agent/sdk/app";
import type { TSchema } from "typebox";
import { createFinishTool, prepareAgentExecution } from "@may-agent/sdk/runtime";

describe("prepared completion contract", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "may-completion-contract-"));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true });
  });

  function prepare(
    name = "optimizer",
    outputSchema: TSchema = Type.Object({ verdict: Type.Union([Type.Literal("pass"), Type.Literal("fail")]) }),
  ) {
    const prepared = prepareAgentExecution({
      definition: {
        name,
        description: "Review one bounded result",
        domain: "fixture",
        systemPrompt: "Review the supplied facts; report a typed verdict.",
        model: getBuiltinModel("anthropic", "claude-sonnet-4-20250514"),
        tools: [createFinishTool({ projectRoot })],
      },
      projectRoot,
      sessionId: `review-${name}`,
      task: "Review the supplied result",
      toolPolicy: "readonly",
      outputSchema,
    });
    const finish = prepared.tools.find((tool) => tool.name === "finish")!;
    function context(args: Record<string, unknown>): BeforeToolCallContext {
      const toolCall: ToolCall = { type: "toolCall", id: "finish-call", name: "finish", arguments: args };
      return {
        toolCall,
        args,
        assistantMessage: {
          role: "assistant",
          content: [toolCall],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          stopReason: "toolUse",
          timestamp: 1,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        },
        context: { systemPrompt: prepared.systemPrompt, tools: prepared.tools, messages: [] },
      };
    }
    return { prepared, finish, context };
  }

  const review = {
    status: "done",
    summary: "Reviewed the supplied result",
    output: { verdict: "pass" },
  };

  for (const name of ["optimizer", "reviewer"]) {
    it(`lets a read-only ${name} return a typed review without demanding a checklist file`, async () => {
      const { prepared, finish, context } = prepare(name);
      expect(prepared.tools.map((tool) => tool.name)).toEqual(["finish"]);
      const ctx = context(review);
      const params = validateToolArguments(finish, ctx.toolCall);
      expect(await prepared.runner.beforeToolCall!(ctx)).toBeUndefined();
      expect((await finish.execute(ctx.toolCall.id, params)).terminate).toBe(true);
    });
  }

  it("requires caller-defined output and rejects invalid TypeBox shapes before execution", () => {
    const { finish, context } = prepare();
    const missing = { status: "done", summary: "Reviewed the supplied result" };
    for (const args of [missing, { ...missing, output: { verdict: 123 } }]) {
      expect(() => validateToolArguments(finish, context(args).toolCall)).toThrow();
    }
  });

  it("uses generic TypeBox validation without Task-specific semantic admission", async () => {
    const { finish, context } = prepare("worker", taskAgentResultSchema);
    const output = {
      state: "converged",
      summary: "Shape-valid domain output",
      reviewAt: Date.now() + 60_000,
      facts: [],
    };
    const args = { status: "done", summary: "Bounded execution complete", output };
    const ctx = context(args);
    const params = validateToolArguments(finish, ctx.toolCall);
    expect(params.output).toEqual(output);
    expect((await finish.execute(ctx.toolCall.id, params)).terminate).toBe(true);
  });

  it("preserves optional output fields without inventing missing evidence", async () => {
    const schema = Type.Object({
      summary: Type.String(),
      verification: Type.Optional(Type.Array(Type.String())),
    });
    const { finish, context } = prepare("worker", schema);
    const args = { status: "blocked", summary: "Verification unavailable", output: { summary: "Draft retained" } };
    const ctx = context(args);
    const params = validateToolArguments(finish, ctx.toolCall);
    expect(params.output).not.toHaveProperty("verification");
    expect((await finish.execute(ctx.toolCall.id, params)).terminate).toBe(true);
  });
});

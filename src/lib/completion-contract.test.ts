import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BeforeToolCallContext } from "@earendil-works/pi-agent-core";
import { Type, validateToolArguments, type ToolCall } from "@earendil-works/pi-ai";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { taskAgentResultSchema } from "@may-agent/sdk";
import type { TSchema } from "typebox";
import { prepareAgentExecution } from "./agent-execution.js";
import { createFinishTool } from "./tools/lifecycle.js";

describe("prepared completion contract", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "may-completion-contract-"));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true });
  });

  function prepare(name = "optimizer", outputSchema: TSchema = Type.Object({ verdict: Type.Union([Type.Literal("pass"), Type.Literal("fail")]) })) {
    const onGuard = mock();
    const prepared = prepareAgentExecution({
      definition: {
        name,
        description: "Review one bounded result",
        domain: "fixture",
        systemPrompt: "Review the supplied facts; report a typed verdict.",
        model: getBuiltinModel("anthropic", "claude-sonnet-4-20250514"),
        tools: [createFinishTool({ agentName: name, projectRoot })],
      },
      projectRoot,
      sessionId: `review-${name}`,
      task: "Review the supplied result",
      toolPolicy: "readonly",
      outputSchema,
      onGuard,
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
    return { prepared, finish, onGuard, context };
  }

  const review = {
    status: "success",
    summary: "Reviewed the supplied result",
    verification_facts: ["Compared the supplied result with the requested contract"],
    result: { verdict: "pass" },
  };

  for (const name of ["optimizer", "reviewer"]) {
    it(`lets a read-only ${name} return a typed review without demanding a checklist file`, async () => {
      const { prepared, finish, onGuard, context } = prepare(name);
      expect(prepared.tools.map((tool) => tool.name)).toEqual(["finish"]);
      const ctx = context(review);
      const params = validateToolArguments(finish, ctx.toolCall);
      expect(await prepared.runner.beforeToolCall!(ctx)).toBeUndefined();
      expect(onGuard).not.toHaveBeenCalled();
      expect((await finish.execute(ctx.toolCall.id, params)).terminate).toBe(true);
    });
  }

  it("keeps the actual finish-evidence warning observable and nonblocking", async () => {
    const { prepared, onGuard, context } = prepare();
    const ctx = context({ ...review, deliverables: [{ path: "proof.txt", description: "claimed output" }] });
    expect(await prepared.runner.beforeToolCall!(ctx)).toMatchObject({ guardName: "finish-evidence", block: false });
    expect(onGuard).toHaveBeenCalledTimes(1);
    expect(onGuard.mock.calls[0][0]).toMatchObject({ guard: "finish-evidence", block: false });
  });

  it("still rejects missing or invalid caller-defined results before execution", () => {
    const { finish, context } = prepare();
    const { result: _result, ...missing } = review;
    for (const args of [missing, { ...review, result: { verdict: 123 } }]) {
      expect(() => validateToolArguments(finish, context(args).toolCall)).toThrow();
    }
  });

  it("rejects a prose Condition owner before finish and accepts its correction in the same execution", async () => {
    const { finish, context } = prepare("worker", taskAgentResultSchema);
    const args = {
      ...review,
      status: "partial",
      result: {
        state: "waiting",
        summary: "The requester must restore access",
        facts: ["source:sample"],
        conditions: [{
          id: "access", type: "source.access", subject: "source:sample",
          expected: true, owner: "human requester", reviewAfterMs: 60_000,
        }],
      },
    };
    expect(() => validateToolArguments(finish, context(args).toolCall)).toThrow();
    args.result.conditions[0].owner = "human:requester";
    const ctx = context(args);
    const result = await finish.execute(ctx.toolCall.id, validateToolArguments(finish, ctx.toolCall));
    expect(result.terminate).toBe(true);
  });

  it.each(["waiting", "incomplete"])("rejects an empty %s report before finish and accepts its correction", async (state) => {
    const { prepared, finish, context } = prepare("worker", taskAgentResultSchema);
    const args = { ...review, status: "partial", result: {
      state, report: true, summary: "Access is missing", facts: [] as string[],
    } };
    expect(() => validateToolArguments(finish, context(args).toolCall)).toThrow();
    args.result.facts.push("source:access-denied");
    const ctx = context(args);
    const params = validateToolArguments(finish, ctx.toolCall);
    expect(await prepared.runner.beforeToolCall!(ctx)).toBeUndefined();
    expect((await finish.execute(ctx.toolCall.id, params)).terminate).toBe(true);
  });

  it("does not terminate successful attempts that lack facts or claim nonexistent files", async () => {
    const { finish, context } = prepare();
    for (const [args, error] of [
      [{ ...review, verification_facts: [] }, "verification_facts"],
      [{ ...review, deliverables: [{ path: "missing.txt", description: "missing proof" }] }, "Deliverables not found"],
    ] as const) {
      const ctx = context(args);
      const result = await finish.execute(ctx.toolCall.id, validateToolArguments(finish, ctx.toolCall));
      expect(result.terminate).toBeUndefined();
      expect(result.content).toContainEqual({ type: "text", text: expect.stringContaining(error) });
    }
  });
});

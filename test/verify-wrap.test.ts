import { describe, it, expect } from "vitest";
import { name, description, execute } from "../shared/workflows/verify-wrap.js";

describe("verify-wrap exports", () => {
  it("exports workflow name", () => {
    expect(name).toBe("verify-wrap");
  });

  it("exports a description string", () => {
    expect(typeof description).toBe("string");
    expect(description.length).toBeGreaterThan(0);
  });

  it("exports execute as a function", () => {
    expect(typeof execute).toBe("function");
  });
});

describe("verify-wrap execute", () => {
  function makeCtx(agentResult: any) {
    const calls: string[] = [];
    return {
      ctx: {
        agent: "test-agent",
        task: "do something",
        runAgent: async (agent: string, task: string) => {
          calls.push(`runAgent:${agent}:${task}`);
          return agentResult;
        },
        escalate: (msg: string) => ({ type: "escalate", message: msg }),
        summarize: (result: any, opts: any) => `summary of ${result.status}`,
        done: (msg: string) => ({ type: "done", message: msg }),
      },
      calls,
    };
  }

  it("calls runAgent with ctx.agent and ctx.task", async () => {
    const { ctx, calls } = makeCtx({ status: "success" });
    await execute(ctx as any);
    expect(calls).toEqual(["runAgent:test-agent:do something"]);
  });

  it("returns done with summary on success", async () => {
    const { ctx } = makeCtx({ status: "success" });
    const result = await execute(ctx as any);
    expect(result).toEqual({ type: "done", message: "summary of success" });
  });

  it("escalates on error status", async () => {
    const { ctx } = makeCtx({ status: "error", error: "something broke" });
    const result = await execute(ctx as any);
    expect(result).toEqual({ type: "escalate", message: "Agent test-agent failed: something broke" });
  });

  it("escalates with lastAssistantText when no error field", async () => {
    const { ctx } = makeCtx({ status: "error", lastAssistantText: "I got confused about the task" });
    const result = await execute(ctx as any);
    expect(result).toEqual({ type: "escalate", message: "Agent test-agent failed: I got confused about the task" });
  });

  it("returns default message when summarize returns non-string", async () => {
    const ctx = {
      agent: "bot",
      task: "work",
      runAgent: async () => ({ status: "success" }),
      escalate: (m: string) => m,
      summarize: () => ({ complex: "object" }),
      done: (m: string) => ({ type: "done", message: m }),
    };
    const result = await execute(ctx as any);
    expect(result).toEqual({ type: "done", message: "bot completed task successfully." });
  });
});

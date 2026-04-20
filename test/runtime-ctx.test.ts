import { describe, it, expect, vi } from "vitest";
import { buildRuntimeCtx } from "../src/lib/runtime-ctx.js";
import type { RuntimeCtx } from "../src/lib/handler-context.js";

// Minimal mock bus
function mockBus() {
  const events: any[] = [];
  return {
    emit: vi.fn((event: any) => events.push(event)),
    subscribe: vi.fn(),
    events,
  };
}

describe("buildRuntimeCtx", () => {
  const baseOpts = () => ({
    bus: mockBus() as any,
    persistDir: "/tmp/test-persist",
    projectRoot: "/tmp/test-project",
    agentsRoot: "/tmp/test-agents",
    agentName: "test-agent",
  });

  it("returns all RuntimeCtx fields", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    expect(rtx.emit).toBeTypeOf("function");
    expect(rtx.getDb).toBeTypeOf("function");
    expect(rtx.log).toBeTypeOf("function");
    expect(rtx.notify).toBeTypeOf("function");
    expect(rtx.persistDir).toBe("/tmp/test-persist");
    expect(rtx.projectRoot).toBe("/tmp/test-project");
    expect(rtx.agentsRoot).toBe("/tmp/test-agents");
  });

  it("emit routes to bus", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.emit({ type: "test.event", data: "hello" });

    expect(opts.bus.emit).toHaveBeenCalledWith({ type: "test.event", data: "hello" });
  });

  it("notify emits notification event on bus", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.notify("something happened");

    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "notification",
      agent: "test-agent",
      text: "something happened",
    });
  });

  it("spreads into HandlerContext without conflict", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    // Simulate what agent-loader does
    const handlerCtx = {
      ...rtx,
      manager: {} as any,
      agentName: "test-agent",
      getSessionId: () => null,
      triggerNow: () => false,
      trackRequest: () => "req-1",
      loadAllSessionMetas: () => ({}),
      evaluateTask: async () => null,
    };

    // RuntimeCtx fields still work through the spread
    expect(handlerCtx.persistDir).toBe("/tmp/test-persist");
    expect(handlerCtx.emit).toBe(rtx.emit);
    expect(handlerCtx.getDb).toBe(rtx.getDb);
    expect(handlerCtx.notify).toBe(rtx.notify);
    expect(handlerCtx.log).toBe(rtx.log);
  });

  it("spreads into WorkflowContext without conflict", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    // Simulate what workflow-tool does
    const workflowCtx = {
      task: "do something",
      agent: "test-agent",
      ...rtx,
      runAgent: async () => ({} as any),
      runWorkflow: async () => ({ type: "done" as const, summary: "ok" }),
      runFunction: async () => ({} as any),
      summarize: () => "",
      done: (s: string) => ({ type: "done" as const, summary: s }),
      escalate: (r: string) => ({ type: "escalate" as const, reason: r }),
    };

    expect(workflowCtx.persistDir).toBe("/tmp/test-persist");
    expect(workflowCtx.emit).toBe(rtx.emit);
    expect(workflowCtx.getDb).toBe(rtx.getDb);
  });

  it("same rtx instance can be shared across handler and workflow", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    // Both contexts get the same emit function
    const handler = { ...rtx, manager: {} as any };
    const workflow = { ...rtx, task: "x", agent: "y" };

    handler.emit({ type: "from.handler" });
    workflow.emit({ type: "from.workflow" });

    expect(opts.bus.emit).toHaveBeenCalledTimes(2);
    expect(opts.bus.events[0].type).toBe("from.handler");
    expect(opts.bus.events[1].type).toBe("from.workflow");
  });
});

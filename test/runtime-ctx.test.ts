import { describe, it, expect, vi } from "bun:test";
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
    sharedRoot: "/tmp/test-shared",
    projectsRoot: "/tmp/test-projects",
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
    expect(rtx.sharedRoot).toBe("/tmp/test-shared");
    expect(rtx.projectsRoot).toBe("/tmp/test-projects");
  });

  it("emit wraps flat dot-named events in a canonical envelope", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.emit({ type: "test.event", message: "hello" });

    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "test.event",
      source: "agent:test-agent",
      owner: "agent:test-agent",
      data: { message: "hello" },
    });
  });

  it("emit preserves canonical dot-named event envelopes", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.emit({
      type: "metric.breach",
      source: "metrics-snapshot",
      owner: "human:operator",
      urgency: "high",
      data: { metricId: "system.health", message: "check" },
    });

    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "metric.breach",
      source: "metrics-snapshot",
      owner: "human:operator",
      urgency: "high",
      data: { metricId: "system.health", message: "check" },
    });
  });

  it("emit defaults envelope metadata without nesting an existing data payload", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.emit({ type: "project.status_changed", data: { projectId: "p1", from: "open", to: "active" } });

    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "project.status_changed",
      source: "agent:test-agent",
      owner: "agent:test-agent",
      data: { projectId: "p1", from: "open", to: "active" },
    });
  });

  it("emit keeps non-domain events flat", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.emit({ type: "notification", agent: "test-agent", text: "hello" });

    expect(opts.bus.emit).toHaveBeenCalledWith({ type: "notification", agent: "test-agent", text: "hello" });
  });

  it("notify emits notification event on bus", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.notify("something happened");

    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "message.created",
      source: "agent:test-agent",
      owner: "human:operator",
      data: {
        from: "test-agent",
        to: "human",
        content: "something happened",
        priority: "P2",
      },
    });
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

    handler.emit({ type: "from.handler", value: 1 });
    workflow.emit({ type: "from.workflow", value: 2 });

    expect(opts.bus.emit).toHaveBeenCalledTimes(2);
    expect(opts.bus.events[0]).toMatchObject({ type: "from.handler", data: { value: 1 } });
    expect(opts.bus.events[1]).toMatchObject({ type: "from.workflow", data: { value: 2 } });
  });
});

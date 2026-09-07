import { describe, it, expect, vi } from "bun:test";
import { buildRuntimeCtx } from "../../src/lib/runtime-ctx.js";
import { buildAgentSDK } from "../../src/lib/sdk-impl.js";

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

  it("dispatchEvent promotes envelope fields and keeps data domain-only", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.dispatchEvent("project.nudge", {
      owner: "may",
      source: "project-loop",
      projectId: "may/demo",
      projectPath: "projects/demo",
      comment: true,
    });

    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "project.nudge",
      source: "project-loop",
      owner: "agent:may",
      data: {
        projectId: "may/demo",
        projectPath: "projects/demo",
        comment: true,
      },
    });
  });

  it("notify appends one tool-authored message to May's shared Conversation", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);

    rtx.notify("something happened");

    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "conversation.message.created",
      source: "agent:test-agent",
      owner: "app:may",
      data: {
        appId: "may",
        conversationId: "may:primary",
        author: { kind: "tool", id: "test-agent" },
        text: "something happened",
      },
    });
    expect(opts.bus.emit).toHaveBeenCalledTimes(1);
  });

  it("supplies real Host reads and events without a placeholder command service", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);
    const sdk = buildAgentSDK(opts);
    for (const services of [rtx, sdk]) {
      expect(services).not.toHaveProperty("commands");
      expect(services.query.sql).toBeTypeOf("function");
      expect(services.query.eventDeliveryHealth).toBeTypeOf("function");
      expect(services.metrics.record).toBeTypeOf("function");
    }
    sdk.emit("host.observed", { healthy: true });
    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "host.observed",
      source: "agent:test-agent",
      owner: "agent:test-agent",
      data: { healthy: true },
    });
  });
});

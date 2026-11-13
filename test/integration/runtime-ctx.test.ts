import { describe, expect, it, vi } from "bun:test";
import { buildRuntimeCtx } from "../../src/lib/runtime-ctx.js";

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

  it("supplies real Host metrics and events without a placeholder command service", () => {
    const opts = baseOpts();
    const rtx = buildRuntimeCtx(opts);
    for (const services of [rtx]) {
      expect(services).not.toHaveProperty("commands");
      expect(services.metrics.record).toBeTypeOf("function");
    }
    rtx.emit({ type: "host.observed", source: "agent:test-agent", owner: "agent:test-agent", data: { healthy: true } });
    expect(opts.bus.emit).toHaveBeenCalledWith({
      type: "host.observed",
      source: "agent:test-agent",
      owner: "agent:test-agent",
      data: { healthy: true },
    });
  });
});

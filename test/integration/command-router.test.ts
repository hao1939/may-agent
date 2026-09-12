import { describe, expect, it } from "bun:test";
import { attachCommandRouter } from "../../src/app/command-router.js";
import { EventBus, type AgentEvent } from "../../src/app/core/events/bus.js";
import type { SubagentManager } from "../../src/lib/index.js";

function harness(overrides: Partial<SubagentManager> = {}) {
  const bus = new EventBus();
  const emitted: AgentEvent[] = [];
  bus.subscribe((event) => emitted.push(event));
  const manager = {
    status: () => [],
    cancel: () => {},
    send: () => {},
    resumeSession: () => "resumed",
    run: () => "new-session",
    ...overrides,
  } as unknown as SubagentManager;
  const router = attachCommandRouter({
    bus,
    manager,
    reload: () => ({ ok: true, summary: "[reload] No changes" }),
    restart: () => {},
    shutdown: () => {},
  });
  return { bus, emitted, router };
}

describe("command router integration", () => {
  it("normalizes direct console input to the May App", () => {
    const h = harness();
    h.router.handleInput("from console", "console");

    const inputs = h.emitted.filter((event) => event.type === "app.input.requested");
    expect(inputs).toHaveLength(1);
    expect(inputs.map((event) => (event as any).data.input.data.message)).toEqual(["from console"]);
    h.router.close();
  });

  it("reserves deterministic controls for explicit slash commands", () => {
    const h = harness();

    h.router.handleInput("restart", "console");
    h.router.handleInput("/restart", "console");

    expect(
      h.emitted
        .filter((event) => event.type === "app.input.requested")
        .map((event) => (event as any).data.input.data.message),
    ).toEqual(["restart"]);
    expect(h.emitted.filter((event) => event.type === "runtime.restart.requested")).toHaveLength(1);
    h.router.close();
  });

  it("resumes cold sessions only through an explicit steer event", () => {
    const resumed: unknown[] = [];
    const h = harness({
      resumeSession: (sessionId: string, message: string, options?: unknown) => {
        resumed.push({ sessionId, message, options });
        return sessionId;
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "session.steer.requested",
      source: "telegram",
      owner: "agent:may",
      target: { sessionId: "s_cold" },
      data: { message: "follow up" },
    });
    expect(resumed).toEqual([
      {
        sessionId: "s_cold",
        message: "follow up",
        options: expect.objectContaining({ source: "telegram", suppressBenignRaceEvent: true }),
      },
    ]);
    h.router.close();
  });

  it("runs a directly addressed non-App agent as a bounded chat", () => {
    const runs: unknown[] = [];
    const h = harness({
      run: (agent: string, task: string, options?: unknown) => {
        runs.push({ agent, task, options });
        return "s_dev";
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "chat.start.requested",
      source: "cli",
      owner: "agent:dev",
      data: { agent: "dev", message: "investigate", channel: "cli", requestId: "r1" },
    });
    expect(runs).toEqual([
      {
        agent: "dev",
        task: "investigate",
        options: expect.objectContaining({ kind: "chat", autoClose: "never", source: "cli", requestId: "r1" }),
      },
    ]);
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "message.created",
        owner: "agent:dev",
        data: expect.objectContaining({ to: "dev", content: "investigate" }),
      }),
    );
    h.router.close();
  });

});

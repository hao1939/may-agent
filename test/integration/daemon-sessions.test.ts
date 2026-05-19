import { describe, expect, it } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import { startRequestedSession } from "../../src/app/daemon-sessions.js";

describe("daemon session startup", () => {
  it("starts one-shot task sessions and waits for idle", async () => {
    const bus = new EventBus();
    const events: any[] = [];
    bus.subscribe((event) => events.push(event));
    const calls: any[] = [];
    const manager = {
      run: (agent: string, task: string, opts: unknown) => {
        calls.push({ agent, task, opts });
        return "s_task";
      },
      waitForIdle: async (sessionId: string) => {
        calls.push({ waitForIdle: sessionId });
      },
    };

    const result = await startRequestedSession({
      bus,
      manager: manager as any,
      persistDir: "/tmp/may-agent-test",
      interfaceAgent: "may",
      initialTask: "do work",
      chatMode: false,
      envSessionId: "s_fixed",
      emitPrompt: () => {},
      handleReload: async () => {},
      gracefulShutdown: () => {},
      gracefulRestart: () => {},
    });

    expect(result.taskSessionId).toBe("s_task");
    expect(calls).toEqual([
      { agent: "may", task: "do work", opts: { kind: "job", sessionId: "s_fixed" } },
      { waitForIdle: "s_task" },
    ]);
    expect(events.some((event) => event.type === "info" && event.message.includes("Started may task session"))).toBe(true);
  });

  it("runs cron-only when there is no task and no chat mode", async () => {
    const bus = new EventBus();
    const events: any[] = [];
    bus.subscribe((event) => events.push(event));

    const result = await startRequestedSession({
      bus,
      manager: {} as any,
      persistDir: "/tmp/may-agent-test",
      interfaceAgent: "may",
      initialTask: null,
      chatMode: false,
      emitPrompt: () => {},
      handleReload: async () => {},
      gracefulShutdown: () => {},
      gracefulRestart: () => {},
    });

    expect(result).toEqual({});
    expect(events.some((event) => event.type === "info" && event.message.includes("No chat session"))).toBe(true);
  });
});

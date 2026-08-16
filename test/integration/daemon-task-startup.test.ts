import { describe, expect, it } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import { startInitialTask } from "../../src/app/daemon-task-startup.js";

describe("daemon startup task", () => {
  it("starts a bounded task and waits for idle", async () => {
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

    const result = await startInitialTask({
      bus,
      manager: manager as any,
      interfaceAgent: "may",
      initialTask: "do work",
      interactiveMode: false,
      envSessionId: "s_fixed",
    });

    expect(result).toBe("s_task");
    expect(calls).toEqual([
      { agent: "may", task: "do work", opts: { kind: "job", sessionId: "s_fixed" } },
      { waitForIdle: "s_task" },
    ]);
    expect(events.some((event) => event.type === "info" && event.message.includes("Started may task session"))).toBe(
      true,
    );
  });

  it("does nothing without an initial task", async () => {
    const result = await startInitialTask({
      bus: new EventBus(),
      manager: {} as any,
      interfaceAgent: "may",
      initialTask: null,
      interactiveMode: false,
    });

    expect(result).toBeUndefined();
  });

  it("leaves interactive input to canonical human admission", async () => {
    const calls: unknown[] = [];
    const result = await startInitialTask({
      bus: new EventBus(),
      manager: { run: (...args: unknown[]) => calls.push(args) } as any,
      interfaceAgent: "may",
      initialTask: "do startup work",
      interactiveMode: true,
    });

    expect(result).toBeUndefined();
    expect(calls).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { attachCommandRouter } from "./command-router.js";
import { EventBus, type AgentEvent } from "./event-bus.js";
import type { ChatSession } from "./chat-session.js";
import type { SubagentManager } from "../lib/index.js";

function createHarness(overrides: Partial<SubagentManager> = {}) {
  const bus = new EventBus();
  const emitted: AgentEvent[] = [];
  bus.subscribe((event) => emitted.push(event));

  const manager = {
    status: () => [],
    cancel: () => {},
    input: () => Promise.resolve({} as any),
    steer: () => {},
    resumeSession: () => "resumed",
    resumeInterrupted: () => false,
    run: () => "new-session",
    ...overrides,
  } as unknown as SubagentManager;

  let chatSession: ChatSession | undefined;
  const router = attachCommandRouter({
    bus,
    manager,
    getChatSession: () => chatSession,
    clearCancelLatch: () => {},
    reload: () => {},
    restart: () => {},
    shutdown: () => {},
  });

  return {
    bus,
    emitted,
    router,
    setChatSession: (session: ChatSession | undefined) => {
      chatSession = session;
    },
  };
}

describe("command router", () => {
  it("handles built-in status when no chat session is active", () => {
    const h = createHarness();

    h.router.handleInput("status", "test");

    expect(h.emitted).toContainEqual({ type: "info", message: "[status] No active sessions" });
    h.router.close();
  });

  it("routes fork messages to May through the active chat session", () => {
    const handled: Array<{ message: string; source?: string }> = [];
    const h = createHarness();
    h.setChatSession({
      handleInput: (message: string, source?: string) => handled.push({ message, source }),
    } as unknown as ChatSession);

    h.bus.emit({ type: "fork", agent: "may", task: "please review", opts: { source: "socket" } });

    expect(handled).toEqual([{ message: "please review", source: "socket" }]);
    expect(h.emitted).toContainEqual({
      type: "message.created",
      from: "socket",
      to: "may",
      content: "please review",
      intent: "fork",
      priority: "P0",
    });
    h.router.close();
  });

  it("resumes cold sessions for steer events", () => {
    const resumed: Array<{ sessionId: string; message: string; source?: string }> = [];
    const h = createHarness({
      status: () => [],
      resumeSession: (sessionId: string, message: string, opts?: { source?: string }) => {
        resumed.push({ sessionId, message, source: opts?.source });
        return sessionId;
      },
    } as Partial<SubagentManager>);

    h.bus.emit({ type: "steer", sessionId: "s_cold", message: "follow up", source: "telegram" });

    expect(resumed).toEqual([{ sessionId: "s_cold", message: "follow up", source: "telegram" }]);
    h.router.close();
  });
});

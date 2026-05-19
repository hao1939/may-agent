import { describe, expect, it } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import { attachTelegramOutbound } from "../../src/app/transport/telegram-outbound.js";

function sessionStart(data: Record<string, unknown>, source = "runtime") {
  return { type: "session.start", source, owner: `agent:${data.agent}`, data };
}

function sessionEnd(data: Record<string, unknown>, source = "runtime") {
  return { type: "session.end", source, owner: `agent:${data.agent}`, data };
}

describe("telegram outbound routing", () => {
  it("streams root chat text and avoids duplicate end summaries", () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      getSessionId: () => "s_root",
      sendToUser: (text) => sent.push(text),
    });

    bus.emit(sessionStart({ sessionId: "s_root", agent: "may", kind: "chat" }, "telegram") as any);
    expect(outbound.getRootChatSessionId()).toBe("s_root");

    bus.emit({ type: "text", sessionId: "s_root", agent: "may", text: "hello" } as any);
    bus.emit(sessionEnd({ sessionId: "s_root", agent: "may", status: "done", summary: "hello" }) as any);

    expect(sent).toEqual(["hello"]);
    expect(outbound.getRootChatSessionId()).toBeNull();
    outbound.close();
  });

  it("summarizes child sessions in the active Telegram chat tree", () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      getSessionId: () => "",
      sendToUser: (text) => sent.push(text),
    });

    bus.emit(sessionStart({ sessionId: "s_root", agent: "may", kind: "chat" }, "telegram") as any);
    bus.emit(sessionStart({ sessionId: "s_child", parentSessionId: "s_root", agent: "scout" }) as any);
    bus.emit(sessionEnd({ sessionId: "s_child", agent: "scout", status: "done", finishParams: { summary: "found a path" } }) as any);

    expect(sent).toEqual(["✅ scout: found a path"]);
    outbound.close();
  });

  it("forwards canonical may-to-human messages", () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      getSessionId: () => "",
      sendToUser: (text) => sent.push(text),
    });

    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: { from: "may", to: "human", content: "please review", priority: "P2" },
    } as any);

    expect(sent).toEqual(["📋 please review"]);
    outbound.close();
  });

  it("stops forwarding after close", () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      getSessionId: () => "s_root",
      sendToUser: (text) => sent.push(text),
    });

    outbound.close();
    bus.emit(sessionStart({ sessionId: "s_root", agent: "may", kind: "chat" }, "telegram") as any);
    bus.emit({ type: "text", sessionId: "s_root", agent: "may", text: "after close" } as any);

    expect(sent).toEqual([]);
  });
});

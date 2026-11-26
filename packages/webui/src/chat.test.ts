import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

// Run the shipped scripts with a small DOM/transport boundary. Their read
// coalescing, selection guards and WebSocket handlers remain production code.
function fixture(fetch: (url: string) => Promise<Response>) {
  class Element {
    value = "";
    innerHTML = "";
    textContent = "";
    dataset = {};
    style = { display: "" };
    children: Element[] = [];
    addEventListener() {}
    appendChild(child: Element) { this.children.push(child); }
    replaceChildren(...children: Element[]) { this.children = children; }
  }
  const elements = new Map([
    "chat", "chat-agent-banner", "chat-composer-host", "chat-input", "chat-messages", "chat-send",
    "chat-status", "chat-stop", "conversation-context-bar", "scroll-toggle", "session-detail-panel",
    "session-followup-anchor", "session-picker",
  ].map((id) => [id, new Element()]));
  const frames: Record<string, unknown>[] = [];
  const sockets: TestSocket[] = [];
  class TestSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    readyState = TestSocket.OPEN;
    onmessage?: (event: { data: string }) => void;
    constructor() { sockets.push(this); }
    send(frame: string) { frames.push(JSON.parse(frame)); }
    close() { this.readyState = TestSocket.CLOSING; }
  }
  let livenessReads = 0;
  const context = createContext({
    document: {
      addEventListener() {},
      getElementById: (id: string) => elements.get(id) ?? null,
      createElement: () => new Element(),
      createDocumentFragment: () => new Element(),
      querySelector: () => new Element(),
    },
    WebSocket: TestSocket, fetch, crypto, toast() {}, AbortSignal, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { protocol: "http:", host: "host.example.test" }, window: {},
    currentTab: "sessions", currentRouteParams: {}, currentAgentChat: null,
    humanInterface: { appId: "conversation", agent: "host", conversationId: "conversation:primary" },
    isAgentChatActive: (agent: string) => context.currentAgentChat === agent,
    setAgentChatSessionId() {},
    scheduleLivenessRefresh: () => { livenessReads++; },
    renderSessionConversation: (data: { messages: Array<{ text: string }> }) => data.messages.map((message) => message.text).join("\n"),
    esc: (value: string) => value,
  });
  for (const script of ["conversation", "chat"]) {
    runInContext(readFileSync(new URL(`../static/pages/${script}.js`, import.meta.url), "utf8"), context);
  }
  context.setRealtimeEnabled(true);
  cleanups.push(() => { context.setRealtimeEnabled(false); });
  const emit = (event: Record<string, unknown>) => sockets.at(-1)!.onmessage!({ data: JSON.stringify(event) });
  return { context, elements, frames, emit, livenessReads: () => livenessReads };
}

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 1_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for browser reread");
    await Bun.sleep(1);
  }
}

test("overflow during a Conversation read recovers its final answer and active turn", async () => {
  const old = Promise.withResolvers<Response>();
  const reads: string[] = [];
  const ui = fixture(async (url) => {
    reads.push(url);
    return reads.length === 1 ? old.promise : Response.json({
      messages: [{ id: "answer", author: { kind: "agent" }, text: "Final Conversation answer" }], activeTurn: null,
    });
  });
  ui.context.currentAgentChat = "host";
  const initialRead = ui.context.refreshMayConversation();
  ui.emit({ type: "overflow", action: "reread" });
  old.resolve(Response.json({ messages: [], activeTurn: { id: "old-turn", revision: 1 } }));
  await initialRead;
  expect(reads).toEqual([
    "/api/conversation?appId=conversation&conversationId=conversation%3Aprimary",
    "/api/conversation?appId=conversation&conversationId=conversation%3Aprimary",
  ]);
  expect(ui.elements.get("chat-status")!.textContent).toBe("Ready");
  expect(ui.elements.get("chat-messages")!.children[0].children[0].children[0].textContent).toBe("Final Conversation answer");
  expect(ui.frames.at(-1)).toEqual({ type: "status" });
});

test.each([undefined, null, 0, -1, 1.5, "7", Number.MAX_SAFE_INTEGER + 1])(
  "May composer retains draft and publication identity after invalid accepted eventId %j", async (eventId) => {
    const writes: Array<{ idempotencyKey: string }> = [];
    const ui = fixture(async (url, options?: RequestInit) => {
      if (url === "/api/events") {
        writes.push(JSON.parse(String(options?.body)));
        return Response.json({ delivery: "accepted", ...(writes.length === 1 ? { eventId } : { eventId: 7 }) });
      }
      return Response.json({ messages: [], activeTurn: null });
    });
    ui.context.currentAgentChat = "host";
    const input = ui.elements.get("chat-input")!;
    input.value = "Keep the original draft";
    await ui.context.sendMayConversation();
    expect(input.value).toBe("Keep the original draft");
    await ui.context.sendMayConversation();
    expect(writes).toHaveLength(2);
    expect(writes[1].idempotencyKey).toBe(writes[0].idempotencyKey);
    expect(input.value).toBe("");
  },
);

test("read-only diagnostics use exact session subscriptions and reread after overflow", async () => {
  const ui = fixture(async () => { throw new Error("No chat read is expected"); });
  const reads: string[] = [];
  ui.context.loadSessionDetail = async (id: string) => { reads.push(id); };
  ui.context.currentRouteParams = { id: "attempt-one" };
  ui.context.syncRealtimeSubscriptions();
  expect(ui.frames.at(-1)).toEqual({ type: "subscribe", sessions: ["attempt-one"], conversations: [] });
  ui.emit({ type: "turn_end", data: { sessionId: "other-attempt" } });
  expect(reads).toEqual([]);
  ui.emit({ type: "overflow", action: "reread" });
  await waitFor(() => reads.length === 1);
  expect(reads).toEqual(["attempt-one"]);
});

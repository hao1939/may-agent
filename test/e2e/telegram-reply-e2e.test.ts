import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { EventBus } from "../../src/app/event-bus.js";
import {
  associateAppInboxClaimSession,
  claimAppInboxItem,
  completeAppInboxClaim,
  createAppInboxItem,
  stageAppInboxClaimDelivery,
} from "../../src/app/app-inbox-store.js";
import { attachTelegramBot } from "../../src/app/transport/telegram.js";
import { AppRegistry } from "../../src/app/app-registry.js";
import { HumanTaskService } from "../../src/app/human-task-service.js";
import { getDb } from "../../src/lib/requests.js";

function jsonResponse(result: unknown) {
  return {
    json: async () => ({ ok: true, result }),
  } as Response;
}

async function waitFor(assertion: () => void, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastErr;
}

describe("telegram reply e2e", () => {
  let persistDir: string;
  let oldToken: string | undefined;
  let oldChatId: string | undefined;
  let humanTasks: HumanTaskService;

  beforeEach(() => {
    persistDir = mkdtempSync(resolve(tmpdir(), "telegram-e2e-"));
    oldToken = process.env.TELEGRAM_BOT_TOKEN;
    oldChatId = process.env.TELEGRAM_CHAT_ID;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
    humanTasks = new HumanTaskService(getDb(persistDir), new AppRegistry(join(persistDir, "apps")));
  });

  afterEach(() => {
    if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = oldToken;
    if (oldChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = oldChatId;
    vi.restoreAllMocks();
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("admits one durable May request for a quoted Telegram reply", async () => {
    const sentMessages: Array<{ chat_id: string; text: string }> = [];
    let getUpdatesCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (method === "getMe") {
        return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      }

      if (method === "getUpdates") {
        getUpdatesCount++;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            {
              update_id: 1,
              message: {
                message_id: 200,
                chat: { id: 12345 },
                text: "show details",
                reply_to_message: {
                  message_id: 100,
                  text: "Project needs attention: projects/example",
                },
              },
            },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }

      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 300 + sentMessages.length });
      }

      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const conversationMessages: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") conversationMessages.push(event);
    });

    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });

    await waitFor(() => {
      expect(conversationMessages).toHaveLength(1);
      expect(conversationMessages[0]).toMatchObject({
        source: "telegram",
        owner: "app:may",
        data: {
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "human", id: "telegram:12345:200" },
          replyTo: "telegram:12345:100",
          metadata: { channel: "telegram", channelMessageId: 200 },
          context: {
            reply: {
              channel: "telegram",
              messageId: 100,
              quotedText: "Project needs attention: projects/example",
            },
          },
        },
      });
      const input = String(conversationMessages[0].data?.text);
      expect(input).toBe("show details");
    });
    expect(sentMessages).toHaveLength(0);

    bot.close();
  });

  it("does not turn raw session or legacy human-targeted events into Telegram output", async () => {
    const sentMessages: Array<{ text: string }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 300 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const bot = attachTelegramBot({ persistDir, bus, interfaceAgent: "may", humanTasks });
    bus.emit({ type: "text", sessionId: "legacy-session", agent: "may", text: "raw session text" } as any);
    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: { from: "may", to: "human", content: "legacy notification" },
    } as any);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(sentMessages).toHaveLength(0);
    bot.close();
  });

  it("renders Telegram work from the shared Conversation and records what the human saw", async () => {
    const db = getDb(persistDir);
    createAppInboxItem(db, {
      id: "work-1",
      appId: "may",
      source: { kind: "human", id: "telegram:12345:100" },
      input: { kind: "message", data: { message: "Review the design" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "telegram",
      now: 1,
    });
    const claim = claimAppInboxItem(db, "work-1", "worker", 100, 2)!;
    expect(associateAppInboxClaimSession(db, claim, "session-1", 3)).toBe(true);
    stageAppInboxClaimDelivery(
      db,
      claim,
      {
        channel: "telegram",
        sessionId: "session-1",
        requestId: "request-1",
        result: { summary: "The design is sound.", response: "The design is clean and ready to use." },
      },
      4,
    );
    const sentMessages: Array<{ chat_id: string; text: string }> = [];
    let getUpdatesCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount += 1;
        if (getUpdatesCount === 1) {
          return jsonResponse([{ update_id: 1, message: { message_id: 200, chat: { id: 12345 }, text: "/work all" } }]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 300 });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const messages: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") messages.push(event);
    });
    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });

    await waitFor(() => {
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]?.text).toContain("All work (newest first):");
      expect(sentMessages[0]?.text).toContain("Review the design — Done");
      expect(sentMessages[0]?.text).toContain(" · changed ");
      expect(sentMessages[0]?.text).toContain("Result: The design is clean and ready to use.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        data: {
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "command", id: "telegram" },
          metadata: {
            channel: "telegram",
            channelMessageId: 300,
            command: "/work all",
            requestIds: ["work-1"],
          },
        },
      });
    });
    bot.close();
  });

  it("mirrors a May Conversation result to the exact originating chat and topic", async () => {
    process.env.TELEGRAM_CHAT_ID = "111,222";
    const sentMessages: Array<Record<string, unknown>> = [];
    let getUpdatesCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount += 1;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            {
              update_id: 1,
              message: { message_id: 80, message_thread_id: 7, chat: { id: 222 }, text: "Review this" },
            },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 81 });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    let input: any;
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created" && event.data?.author?.kind === "human") input = event;
    });
    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });
    await waitFor(() => expect(input).toBeTruthy());

    const db = getDb(persistDir);
    createAppInboxItem(db, {
      id: "item-80",
      appId: "may",
      source: { kind: "human", id: input.data.author.id },
      input: { kind: "message", data: { message: "Review this" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "telegram",
      channelTargetId: input.data.metadata.channelTargetId,
      channelThreadId: input.data.metadata.channelThreadId,
      channelMessageId: input.data.metadata.channelMessageId,
      now: 1,
    });
    const claim = claimAppInboxItem(db, "item-80", "test", 1_000, 2);
    if (!claim) throw new Error("expected May request claim");
    completeAppInboxClaim(db, claim, { summary: "Reviewed.", response: "Reviewed.", evidence: ["test:accepted"] }, 3);
    bus.emit({
      type: "conversation.updated",
      source: "app-inbox",
      owner: "app:may",
      data: { appId: "may", conversationId: "may:primary" },
    });

    await waitFor(() => expect(sentMessages).toHaveLength(1));
    expect(sentMessages[0]).toMatchObject({
      chat_id: "222",
      message_thread_id: 7,
      text: "Reviewed.",
      reply_parameters: { message_id: 80, allow_sending_without_reply: true },
    });
    bot.close();
  });

  it("renders a new Console message from the shared Conversation without appending a duplicate", async () => {
    const sentMessages: Array<Record<string, unknown>> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 600 });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const conversationEvents: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") conversationEvents.push(event);
    });
    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });
    createAppInboxItem(getDb(persistDir), {
      id: "console-message-1",
      appId: "may",
      source: { kind: "human", id: "may-console:instance:1" },
      input: { kind: "message", data: { message: "Message sent from Console" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "may-console",
      now: 1,
    });
    bus.emit({
      type: "conversation.updated",
      source: "app-inbox",
      owner: "app:may",
      data: { appId: "may", conversationId: "may:primary" },
    });

    await waitFor(() => expect(sentMessages).toHaveLength(1));
    expect(sentMessages[0]).toMatchObject({
      chat_id: "12345",
      text: "Console · You\nMessage sent from Console",
    });
    expect(conversationEvents).toEqual([]);
    bot.close();
  });

  it("coalesces Conversation wake storms while one Telegram sync is in flight", async () => {
    const db = getDb(persistDir) as any;
    const prepare = db.prepare.bind(db);
    let conversationReads = 0;
    db.prepare = (sql: string) => {
      if (sql.includes("event_type = 'conversation.message.created'")) conversationReads++;
      return prepare(sql);
    };
    let releaseSend!: () => void;
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    let sendCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL) => {
      const method = String(url).split("/").pop();
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sendCalls++;
        if (sendCalls === 1) await sendGate;
        return jsonResponse({ message_id: 700 + sendCalls });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const bot = attachTelegramBot({ persistDir, bus, interfaceAgent: "may", humanTasks });
    const baselineReads = conversationReads;
    createAppInboxItem(db, {
      id: "console-storm-message",
      appId: "may",
      source: { kind: "human", id: "may-console:storm:1" },
      input: { kind: "message", data: { message: "One durable message" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "may-console",
      now: 1,
    });
    const wake = {
      type: "conversation.updated",
      source: "app-inbox",
      owner: "app:may",
      data: { appId: "may", conversationId: "may:primary" },
    } as const;
    bus.emit(wake);
    await waitFor(() => expect(sendCalls).toBe(1));
    for (let index = 0; index < 50; index++) bus.emit(wake);
    releaseSend();

    await waitFor(() => expect(conversationReads).toBe(baselineReads + 2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(conversationReads).toBe(baselineReads + 2);
    expect(sendCalls).toBe(1);
    bot.close();
  });

  it("rejects removed session commands and unknown commands locally without creating May work", async () => {
    const sentMessages: Array<Record<string, unknown>> = [];
    let getUpdatesCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount += 1;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            { update_id: 1, message: { message_id: 90, chat: { id: 12345 }, text: "/status" } },
            { update_id: 2, message: { message_id: 91, chat: { id: 12345 }, text: "/does-not-exist" } },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") {
        sentMessages.push(body);
        return jsonResponse({ message_id: 100 + sentMessages.length });
      }
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const messages: any[] = [];
    bus.subscribe((event: any) => {
      if (event.type === "conversation.message.created") messages.push(event);
    });
    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });

    await waitFor(() => expect(sentMessages).toHaveLength(2));
    expect(sentMessages.map((message) => message.text)).toEqual([
      "Unknown command: /status. Use /help to see available commands.",
      "Unknown command: /does-not-exist. Use /help to see available commands.",
    ]);
    expect(messages).toEqual([]);
    bot.close();
  });

  it("keeps Task cancellation local while forwarding runtime slash commands", async () => {
    let getUpdatesCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const method = String(url).split("/").pop();

      if (method === "getMe") return jsonResponse({ username: "may_test_bot", first_name: "May Test" });
      if (method === "getUpdates") {
        getUpdatesCount++;
        if (getUpdatesCount === 1) {
          return jsonResponse([
            {
              update_id: 31,
              message: { message_id: 1001, chat: { id: 12345 }, text: "/cancel s_active_telegram" },
            },
            { update_id: 32, message: { message_id: 1002, chat: { id: 12345 }, text: "/reload" } },
            { update_id: 33, message: { message_id: 1003, chat: { id: 12345 }, text: "/close" } },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        return jsonResponse([]);
      }
      if (method === "sendMessage") return jsonResponse({ message_id: 1100 });
      throw new Error(`unexpected Telegram method: ${method}`);
    });

    const bus = new EventBus();
    const events: any[] = [];
    bus.subscribe((event: any) => events.push(event));

    const bot = attachTelegramBot({
      persistDir,
      bus,
      interfaceAgent: "may",
      humanTasks,
    });

    await waitFor(() => {
      expect(events).toContainEqual({
        type: "runtime.reload.requested",
        source: "telegram",
        owner: "agent:may",
        data: {},
      });
      expect(events).toContainEqual({
        type: "runtime.shutdown.requested",
        source: "telegram",
        owner: "agent:may",
        urgency: "high",
        data: {},
      });
      expect(events.some((event) => event.type === "session.cancel.requested")).toBe(false);
      expect(events.some((event) => event.type === "input")).toBe(false);
    });

    bot.close();
  });
});

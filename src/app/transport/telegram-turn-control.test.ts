import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDb, closeDb } from "../../lib/requests.js";
import { createAppInboxItem, claimNextAppInboxItem, stopAppInboxTurn } from "../app-inbox-store.js";
import { EventBus } from "../core/events/bus.js";
import { attachTelegramBot } from "./telegram.js";

async function until(predicate: () => boolean) {
  const end = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error("Telegram control did not progress");
    await Bun.sleep(5);
  }
}

test("closing the bot aborts its active network poll", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-telegram-close-"));
  const priorFetch = globalThis.fetch;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  const priorChat = process.env.TELEGRAM_CHAT_ID;
  const arrived = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<unknown>();
  const response = Promise.withResolvers<Response>();
  let polls = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    fetch(request) {
      if (new URL(request.url).pathname.endsWith("/getMe")) {
        return Response.json({ ok: true, result: { username: "fixture", first_name: "May" } });
      }
      polls++;
      arrived.resolve();
      return response.promise;
    },
  });
  globalThis.fetch = (async (url, init) => {
    try {
      return await priorFetch(new URL(new URL(String(url)).pathname, server.url), init);
    } catch (error) {
      aborted.resolve(error);
      throw error;
    }
  }) as typeof fetch;
  process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
  process.env.TELEGRAM_CHAT_ID = "123";
  const bot = attachTelegramBot({
    bus: new EventBus(),
    persistDir: root,
    interfaceAgent: "may",
    humanTasks: { listApps: () => [], listTasks: () => ({ items: [], total: 0 }), getTask: () => null },
    publishEvent() {
      throw new Error("No input should be admitted during shutdown");
    },
  });
  try {
    await arrived.promise;
    bot.close();
    expect(await aborted.promise).toMatchObject({ name: "AbortError" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(polls).toBe(1);
  } finally {
    bot.close();
    response.resolve(Response.json({ ok: true, result: [] }));
    server.stop(true);
    globalThis.fetch = priorFetch;
    if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = priorToken;
    if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = priorChat;
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("Telegram Stop buttons retain exact turns, reject old/unauthorized controls and survive rejected publication", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-telegram-stop-"));
  const priorFetch = globalThis.fetch;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  const priorChat = process.env.TELEGRAM_CHAT_ID;
  const db = getDb(root);
  const startTurn = (id: string, sequence: number) => {
    createAppInboxItem(db, {
      id,
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: sequence,
      source: { kind: "human", id },
      input: { kind: "message", data: {} },
    });
    return claimNextAppInboxItem(db, "may", "fixture", 60_000, Date.now())!;
  };
  startTurn("first", 1);
  let wake: (() => void) | undefined;
  const updates: any[] = [];
  const calls: Array<{ method: string; body: any }> = [];
  const events: any[] = [];
  let failPublish = true;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).split("/").at(-1)!;
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ method, body });
    let result: any = {};
    if (method === "getMe") result = { username: "fixture", first_name: "May" };
    else if (method === "getUpdates") {
      if (!updates.length)
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      result = updates.splice(0);
    } else if (method === "sendMessage") result = { message_id: calls.length };
    return { json: async () => ({ ok: true, result }) } as Response;
  }) as typeof fetch;
  process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
  process.env.TELEGRAM_CHAT_ID = "123";
  const bus = new EventBus();
  const bot = attachTelegramBot({
    bus,
    persistDir: root,
    interfaceAgent: "may",
    humanTasks: { listApps: () => [], listTasks: () => ({ items: [], total: 0 }), getTask: () => null },
    publishEvent(input) {
      events.push(input);
      if (input.type === "conversation.turn.stop.requested") {
        if (failPublish) throw new Error("store unavailable");
        stopAppInboxTurn(db, { appId: "may", ...input.data } as Parameters<typeof stopAppInboxTurn>[1]);
      }
      return { eventId: events.length, eventType: input.type, delivery: "accepted" };
    },
  });
  const buttons = () => calls.filter((call) => call.method === "sendMessage" && call.body.reply_markup);
  const answers = () => calls.filter((call) => call.method === "answerCallbackQuery");
  const update = (callback: any) => {
    updates.push({ update_id: calls.length, callback_query: callback });
    wake?.();
  };
  try {
    await until(() => buttons().length === 1);
    const first = buttons()[0]!;
    // sendMessage's fixture response ID was its call position.
    const messageId = calls.indexOf(first) + 1;
    const callback = {
      id: "button",
      data: first.body.reply_markup.inline_keyboard[0][0].callback_data,
      message: { message_id: messageId, chat: { id: 123 } },
    };
    update({ ...callback, id: "unauthorized", message: { ...callback.message, chat: { id: 999 } } });
    await until(() => answers().length === 1);
    expect(events).toHaveLength(0);
    update(callback);
    await until(() => answers().length === 2);
    expect(answers()[1]!.body.text).toContain("Stop was not confirmed");
    failPublish = false;
    update({ ...callback, id: "retry" });
    await until(() => answers().length === 3);
    expect(answers()[2]!.body.text).toContain("Stop request accepted");
    expect(events.at(-1)).toMatchObject({
      type: "conversation.turn.stop.requested",
      target: { appId: "may" },
      data: { conversationId: "may:primary", turnId: "first", expectedRevision: 1 },
    });
    expect(
      calls.some(
        (call) => call.method === "editMessageReplyMarkup" && call.body.reply_markup.inline_keyboard.length === 0,
      ),
    ).toBe(true);
    startTurn("second", 2);
    bus.emit({
      type: "conversation.updated",
      source: "fixture",
      owner: "app:may",
      data: { appId: "may", conversationId: "may:primary" },
    });
    await until(() => buttons().length === 2);
    const published = events.length;
    update({ ...callback, id: "old" });
    await until(() => answers().length === 4);
    expect(events).toHaveLength(published);
    expect(answers()[3]!.body.text).toContain("expired");
    updates.push({ update_id: 999, message: { message_id: 55, chat: { id: 123 }, text: "/close" } });
    wake?.();
    await until(() => calls.some((call) => call.body.text?.includes("Unknown command: /close")));
    expect(events.some((event) => event.type === "runtime.shutdown.requested")).toBe(false);
    expect(calls.find((call) => call.method === "getUpdates")!.body.allowed_updates).toContain("callback_query");
  } finally {
    bot.close();
    globalThis.fetch = priorFetch;
    if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = priorToken;
    if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = priorChat;
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

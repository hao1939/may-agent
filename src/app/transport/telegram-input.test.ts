import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../../lib/requests.js";
import { EventBus } from "../event-bus.js";
import {
  attachTelegramBot,
  renderTelegramApps,
  renderTelegramTask,
  renderTelegramTasks,
  telegramMayInputEvent,
} from "./telegram.js";

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for Telegram adapter");
    await Bun.sleep(10);
  }
}

describe("Telegram May input", () => {
  it("maps one Telegram turn to one durable May request with exact reply identity", () => {
    expect(
      telegramMayInputEvent({
        message: "Please inspect this",
        chatId: "123",
        messageId: 502,
        topicId: 7,
        conversationId: "telegram:chat:123:topic:7:agent:may",
        replyToMessageId: 499,
        context: { quotedText: "Earlier question" },
        trace: { traceId: "telegram:502", parentEventId: 41 },
      }),
    ).toEqual({
      type: "conversation.message.created",
      source: "telegram",
      owner: "app:may",
      data: {
        appId: "may",
        conversationId: "telegram:chat:123:topic:7:agent:may",
        author: { kind: "human", id: "telegram:123:502" },
        text: "Please inspect this",
        context: { quotedText: "Earlier question" },
        replyTo: "telegram:123:499",
        metadata: { channel: "telegram", channelTargetId: "123", channelThreadId: "7", channelMessageId: 502 },
        idempotencyKey: "telegram:123:502",
      },
      trace: { traceId: "telegram:502", parentEventId: 41 },
    });
  });

  it("renders the same Task resources with Telegram-friendly cards", () => {
    const task = {
      appId: "evaluation",
      taskId: "review/docs",
      ref: "8f12ac90",
      status: "running" as const,
      generation: 1,
      resourceVersion: 2,
      outcome: "Review the docs",
      summary: "Reviewing current behavior",
      updatedAt: Date.UTC(2026, 7, 22, 1, 2, 3),
      terminal: false,
      cancellable: true,
    };
    expect(
      renderTelegramApps([
        {
          id: "evaluation",
          owner: "evaluator",
          activeTasks: 1,
          attentionTasks: 0,
          runningTasks: 1,
          waitingTasks: 0,
        },
      ]),
    ).toContain("evaluation — 1 active · 1 running");
    expect(renderTelegramTasks([task], false)).toContain("8f12ac90 · evaluation · running");
    expect(renderTelegramTasks([task], false, true)).toContain("/tasks more");
    expect(renderTelegramTask(task)).toContain("Progress:\nReviewing current behavior");
  });

  it("continues the prior Task query when Telegram requests the next page", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-task-pages-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
    const listCalls: Array<Record<string, unknown>> = [];
    const sent: string[] = [];
    let updatePolls = 0;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = String(url).split("/").at(-1) ?? "";
      if (method === "getMe")
        return { json: async () => ({ ok: true, result: { username: "may", first_name: "May" } }) } as Response;
      if (method === "getUpdates" && updatePolls++ === 0) {
        return {
          json: async () => ({
            ok: true,
            result: [
              { update_id: 1, message: { message_id: 501, chat: { id: 123 }, text: "/tasks evaluation" } },
              { update_id: 2, message: { message_id: 502, chat: { id: 123 }, text: "/tasks more" } },
            ],
          }),
        } as Response;
      }
      if (method === "getUpdates") return await new Promise<Response>(() => {});
      if (method === "sendMessage") {
        const body = JSON.parse(String(init?.body));
        sent.push(body.text);
        return { json: async () => ({ ok: true, result: { message_id: 900 + sent.length } }) } as Response;
      }
      throw new Error(`Unexpected Telegram method ${method}`);
    }) as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "123";

    const task = (ref: string, taskId: string) => ({
      appId: "evaluation",
      taskId,
      ref,
      status: "waiting" as const,
      generation: 1,
      resourceVersion: 1,
      outcome: `Review ${taskId}`,
      updatedAt: 1,
      terminal: false,
      cancellable: true,
    });
    const bus = new EventBus();
    const bot = attachTelegramBot({
      bus,
      interfaceAgent: "may",
      persistDir: root,
      humanTasks: {
        listTasks(options: Record<string, unknown>) {
          listCalls.push(options);
          return options.cursor
            ? { items: [task("22222222", "second")] }
            : { items: [task("11111111", "first")], nextCursor: "cursor-2" };
        },
      } as any,
    });
    try {
      await waitFor(() => sent.length === 2);
      expect(listCalls).toEqual([
        { appId: "evaluation", includeDone: false, limit: 30 },
        { appId: "evaluation", includeDone: false, limit: 30, cursor: "cursor-2" },
      ]);
      expect(sent[0]).toContain("11111111");
      expect(sent[0]).toContain("/tasks more");
      expect(sent[1]).toContain("22222222");
    } finally {
      bot.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
      globalThis.fetch = priorFetch;
      if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = priorToken;
      if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
      else process.env.TELEGRAM_CHAT_ID = priorChat;
    }
  });

  it("returns a correlated reload result and records the rendered command in Conversation", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-reload-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
    const calls: Array<{ method: string; body?: Record<string, any> }> = [];
    let updatePolls = 0;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = String(url).split("/").at(-1) ?? "";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, body });
      if (method === "getMe")
        return { json: async () => ({ ok: true, result: { username: "may", first_name: "May" } }) } as Response;
      if (method === "getUpdates" && updatePolls++ === 0) {
        return {
          json: async () => ({
            ok: true,
            result: [
              {
                update_id: 1,
                message: { message_id: 502, message_thread_id: 7, chat: { id: 123 }, text: "/reload" },
              },
            ],
          }),
        } as Response;
      }
      if (method === "getUpdates") return await new Promise<Response>(() => {});
      if (method === "sendMessage")
        return { json: async () => ({ ok: true, result: { message_id: 900 } }) } as Response;
      throw new Error(`Unexpected Telegram method ${method}`);
    }) as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "123";

    const bus = new EventBus();
    const observed: any[] = [];
    const unsubscribe = bus.subscribe((event) => observed.push(event));
    const bot = attachTelegramBot({ bus, interfaceAgent: "may", persistDir: root, humanTasks: {} as any });
    try {
      await waitFor(() => observed.some((event) => event.type === "runtime.reload.requested"));
      expect(observed.find((event) => event.type === "runtime.reload.requested")).toMatchObject({
        source: "telegram",
        owner: "agent:may",
        data: { requestId: "telegram:123:502:reload" },
      });

      bus.emit({
        type: "runtime.reload.finished",
        source: "runtime",
        owner: "agent:may",
        data: {
          requestId: "telegram:123:502:reload",
          ok: true,
          summary: "[reload] 6 task-enabled App(s)",
        },
      });

      await waitFor(() => calls.some((call) => call.method === "sendMessage"));
      expect(calls.find((call) => call.method === "sendMessage")?.body).toMatchObject({
        chat_id: "123",
        text: "[reload] 6 task-enabled App(s)",
        message_thread_id: 7,
      });
      await waitFor(() =>
        observed.some(
          (event) =>
            event.type === "conversation.message.created" &&
            event.data?.author?.kind === "command" &&
            event.data?.metadata?.command === "/reload",
        ),
      );
    } finally {
      bot.close();
      unsubscribe();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
      globalThis.fetch = priorFetch;
      if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = priorToken;
      if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
      else process.env.TELEGRAM_CHAT_ID = priorChat;
    }
  });
});

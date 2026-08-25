import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../lib/requests.js";
import { createAppInboxItem, createConversationTopic } from "../app-inbox-store.js";
import { EVENT_ROW_ID, EventBus } from "../event-bus.js";
import {
  attachTelegramBot as attachTelegramBotRuntime,
  renderTelegramApps,
  renderTelegramTask,
  renderTelegramTasks,
  renderTelegramTopic,
  renderTelegramTopics,
  renderTelegramTodos,
  telegramMayInputEvent,
} from "./telegram.js";

function attachTelegramBot(
  options: Omit<Parameters<typeof attachTelegramBotRuntime>[0], "publishEvent">,
): ReturnType<typeof attachTelegramBotRuntime> {
  return attachTelegramBotRuntime({
    ...options,
    publishEvent(input) {
      const data = {
        ...input.data,
        ...(input.target ?? {}),
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      };
      const emitted = options.bus.emit({
        type: input.type,
        source: "telegram",
        owner: input.target?.appId ? `app:${input.target.appId}` : "agent:may",
        ...(input.target ? { target: input.target } : {}),
        data,
      } as any);
      return {
        eventId: Number(emitted[EVENT_ROW_ID]) || 1,
        eventType: input.type,
        delivery: "recorded",
      };
    },
  });
}

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
        conversationTopicId: "topic_0df0c0edbf95b5bbc5c87598",
        context: { quotedText: "Earlier question" },
      }),
    ).toEqual({
      type: "conversation.message.created",
      target: { appId: "may" },
      data: {
        conversationId: "telegram:chat:123:topic:7:agent:may",
        author: { kind: "human", id: "telegram:123:502" },
        text: "Please inspect this",
        context: { quotedText: "Earlier question" },
        replyTo: "telegram:123:499",
        metadata: {
          channel: "telegram",
          channelTargetId: "123",
          channelThreadId: "7",
          channelMessageId: 502,
          topicId: "topic_0df0c0edbf95b5bbc5c87598",
        },
      },
      idempotencyKey: "telegram:123:502",
    });
  });

  it("renders recent Topics and one selected Topic without turning it into work", () => {
    const topic = {
      id: "topic_0df0c0edbf95b5bbc5c87598",
      title: "Review the design",
      openedBy: "human",
      originMessageId: "human-history",
      taskRefs: [{ appId: "evaluation", taskId: "review/docs", ref: "8f12ac90" }],
    };
    expect(renderTelegramTopics([topic], topic.id)).toContain("✓ 0df0c0ed · Review the design · 1 Task");
    expect(
      renderTelegramTopic(topic, [
        {
          id: "human-history",
          sequence: 1,
          author: { kind: "human", id: "human-history" },
          text: "Please review the design",
          metadata: { topicId: topic.id },
          createdAt: 1,
        },
      ]),
    ).toContain("You: Please review the design");
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
      acceptance: ["Report the exact findings."],
      statusDetail: "An attempt is working on it now.",
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
    expect(renderTelegramTasks([task], false)).toContain("8f12ac90 · evaluation · working");
    expect(renderTelegramTasks([task], false)).toContain("no action from you");
    expect(renderTelegramTasks([{ ...task, updatedAt: Date.now() }], false)).not.toContain("just now ago");
    expect(renderTelegramTasks([task], false, true)).toContain("/tasks more");
    expect(renderTelegramTask(task)).toContain("Goal\nReview the docs");
    expect(renderTelegramTask(task)).toContain("State\nworking. An attempt is working on it now.");
    expect(renderTelegramTask(task)).toContain("Current\nReviewing current behavior");
    expect(renderTelegramTask(task)).toContain("Expected result\n• Report the exact findings.");
    expect(renderTelegramTask(task)).toContain("You\nNothing needed right now.");
    expect(
      renderTelegramTask({
        ...task,
        requestedBy: {
          appId: "may",
          taskId: "conversation/one",
          ref: "4a7af065",
          status: "waiting",
          outcome: "Review the systemic gap",
        },
      }),
    ).toContain("Related\nRequested by 4a7af065 · may\nReview the systemic gap");
    expect(
      renderTelegramTodos(
        [
          {
            ...task,
            status: "waiting",
            humanAction: { requestedAction: "Approve or reject deployment.", since: task.updatedAt },
          },
        ],
        1,
        "evaluation",
      ),
    ).toContain("Actions needed for evaluation:\n• 8f12ac90 · evaluation");
    expect(
      renderTelegramTodos(
        [{ ...task, status: "waiting", humanAction: { requestedAction: "Provide the rollout window." } }],
        2,
        "evaluation",
        true,
      ),
    ).toContain("1 more action(s) are not shown. Use /todo more.");
    expect(
      renderTelegramTask({
        ...task,
        progress: {
          stage: "intermediate",
          message: "Inspecting exact evidence",
          updatedAt: Date.UTC(2026, 7, 22, 1, 3, 4),
        },
      }),
    ).toContain("Current · 2026-08-22 01:03:04 UTC\nInspecting exact evidence");
    expect(
      renderTelegramTask({
        ...task,
        progress: {
          stage: "turn-started",
          status: "inProgress",
          updatedAt: Date.UTC(2026, 7, 22, 1, 3, 5),
        },
      }),
    ).not.toContain("turn started");
  });

  it("continues the prior Task query when Telegram requests the next page", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-task-pages-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
    const listCalls: Array<Record<string, unknown>> = [];
    const todoCalls: Array<Record<string, unknown>> = [];
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
              { update_id: 1, message: { message_id: 500, chat: { id: 123 }, text: "/apps evaluation" } },
              { update_id: 2, message: { message_id: 501, chat: { id: 123 }, text: "/tasks all" } },
              { update_id: 3, message: { message_id: 502, chat: { id: 123 }, text: "/tasks more" } },
              { update_id: 4, message: { message_id: 503, chat: { id: 123 }, text: "/todo all" } },
              { update_id: 5, message: { message_id: 504, chat: { id: 123 }, text: "/todo more" } },
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
        listApps: () => [
          {
            id: "evaluation",
            owner: "evaluator",
            activeTasks: 1,
            attentionTasks: 0,
            runningTasks: 0,
            waitingTasks: 1,
          },
        ],
        listTasks(options: Record<string, unknown>) {
          if (options.humanActionOnly) {
            todoCalls.push(options);
            if (options.appId === "may") return { items: [], total: 0 };
            const item = {
              ...task(options.cursor ? "44444444" : "33333333", options.cursor ? "todo-second" : "todo-first"),
              humanAction: { requestedAction: options.cursor ? "Approve the second page." : "Approve the first page." },
            };
            return options.cursor
              ? { items: [item], total: 2 }
              : { items: [item], total: 2, nextCursor: "todo-cursor-2" };
          }
          listCalls.push(options);
          return options.cursor
            ? { items: [task("22222222", "second")] }
            : { items: [task("11111111", "first")], nextCursor: "cursor-2" };
        },
      } as any,
    });
    try {
      await waitFor(() => sent.some((text) => text.includes("Approve the second page.")));
      expect(listCalls).toEqual([
        { includeDone: false, limit: 10 },
        { includeDone: false, limit: 10, cursor: "cursor-2" },
      ]);
      expect(sent).toContainEqual(expect.stringContaining("Selected App: evaluation"));
      expect(sent).toContainEqual(expect.stringContaining("11111111"));
      expect(sent).toContainEqual(expect.stringContaining("/tasks more"));
      expect(sent).toContainEqual(expect.stringContaining("22222222"));
      expect(todoCalls).toContainEqual({
        humanActionOnly: true,
        limit: 50,
        cursor: "todo-cursor-2",
      });
      expect(sent).toContainEqual(expect.stringContaining("Use /todo more."));
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

  it("activates a configured base chat for human-action alerts after restart", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-startup-todo-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
    const sent: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = String(url).split("/").at(-1) ?? "";
      if (method === "getMe") {
        return { json: async () => ({ ok: true, result: { username: "may", first_name: "May" } }) } as Response;
      }
      if (method === "getUpdates") return await new Promise<Response>(() => {});
      if (method === "sendMessage") {
        const body = JSON.parse(String(init?.body));
        sent.push(body.text);
        return { json: async () => ({ ok: true, result: { message_id: 901 } }) } as Response;
      }
      throw new Error(`Unexpected Telegram method ${method}`);
    }) as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "123";

    const bus = new EventBus();
    const bot = attachTelegramBot({
      bus,
      interfaceAgent: "may",
      persistDir: root,
      humanTasks: {
        listTasks: () => ({
          items: [
            {
              appId: "may",
              taskId: "approval/startup",
              ref: "aabbccdd",
              status: "waiting",
              generation: 1,
              resourceVersion: 1,
              outcome: "Approve startup action",
              updatedAt: 1,
              terminal: false,
              cancellable: true,
              humanAction: { requestedAction: "Approve the startup action." },
            },
          ],
          total: 1,
        }),
      } as any,
    });
    try {
      await waitFor(() => sent.some((text) => text.includes("Approve the startup action.")));
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

  it("shows and refreshes the same derived human-action view off watch", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-todo-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
    const sent: string[] = [];
    const observed: any[] = [];
    const taskListReads: any[] = [];
    let updatePolls = 0;
    let resourceVersion = 1;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = String(url).split("/").at(-1) ?? "";
      if (method === "getMe")
        return { json: async () => ({ ok: true, result: { username: "may", first_name: "May" } }) } as Response;
      if (method === "getUpdates" && updatePolls++ === 0) {
        return {
          json: async () => ({
            ok: true,
            result: [
              { update_id: 1, message: { message_id: 501, chat: { id: 123 }, text: "/apps evaluation" } },
              { update_id: 2, message: { message_id: 502, chat: { id: 123 }, text: "/todo" } },
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

    const todo = () => ({
      appId: "evaluation",
      taskId: "deploy/current",
      ref: "8f12ac90",
      status: "waiting" as const,
      generation: 1,
      resourceVersion,
      outcome: "Deploy the verified release",
      summary:
        resourceVersion === 1 ? "Approve or reject deployment." : "Approve deployment or request one more canary.",
      updatedAt: Date.UTC(2026, 7, 22, 1, 2, 3),
      terminal: false,
      cancellable: true,
      humanAction: {
        requestedAction:
          resourceVersion === 1 ? "Approve or reject deployment." : "Approve deployment or request one more canary.",
        since: Date.UTC(2026, 7, 22, 1, 2, 3),
      },
    });
    const bus = new EventBus();
    const unsubscribe = bus.subscribe((event) => observed.push(event));
    const bot = attachTelegramBot({
      bus,
      interfaceAgent: "may",
      persistDir: root,
      humanTasks: {
        listApps: () => [
          {
            id: "evaluation",
            owner: "evaluator",
            activeTasks: 1,
            attentionTasks: 0,
            runningTasks: 0,
            waitingTasks: 1,
          },
        ],
        listTasks: (options: any) => {
          taskListReads.push(options);
          return { items: [todo()], total: 1 };
        },
      } as any,
    });
    try {
      await waitFor(() => sent.some((text) => text.includes("Actions needed for evaluation")));
      expect(taskListReads.some((options) => options.humanActionOnly === true && options.limit === 50)).toBe(true);
      expect(sent).toContainEqual(expect.stringContaining("Approve or reject deployment."));
      await waitFor(() =>
        observed.some(
          (event) =>
            event.type === "conversation.message.created" &&
            event.data?.metadata?.command === "/todo" &&
            event.data?.metadata?.taskRefs?.[0]?.taskId === "deploy/current",
        ),
      );

      await Bun.sleep(30);
      const readsBeforeProgress = taskListReads.length;
      bus.emit({
        type: "project.task.executor.progress",
        data: {
          project: "evaluation",
          taskId: "deploy/current",
          message: "This exact-Task progress does not change /todo membership",
        },
      } as any);
      await Bun.sleep(30);
      expect(taskListReads).toHaveLength(readsBeforeProgress);

      resourceVersion = 2;
      bus.emit({
        type: "project.task.reconciled",
        source: "app-task:evaluation",
        owner: "app:evaluation",
        data: { project: "evaluation", taskId: "deploy/current" },
      } as any);
      await waitFor(() => sent.some((text) => text.includes("request one more canary")));
      expect(sent.filter((text) => text.includes("request one more canary"))).toHaveLength(1);
      await waitFor(() =>
        observed.some(
          (event) =>
            event.type === "conversation.message.created" &&
            event.data?.metadata?.command === "/todo notification" &&
            event.data?.metadata?.taskRefs?.[0]?.taskId === "deploy/current",
        ),
      );

      resourceVersion = 3;
      bus.emit({
        type: "project.task.reconciled",
        source: "app-task:evaluation",
        owner: "app:evaluation",
        data: { project: "evaluation", taskId: "deploy/current" },
      } as any);
      await Bun.sleep(30);
      expect(sent.filter((text) => text.includes("request one more canary"))).toHaveLength(1);
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

  it("uses the shared Task interface for watch feedback, terminal refresh, and cancellation", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-task-controls-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
    const sent: string[] = [];
    const observed: any[] = [];
    const cancelCalls: Array<Record<string, unknown>> = [];
    let taskTerminal = false;
    let taskProgress: { stage: string; message: string; updatedAt: number } | undefined;
    let updatePolls = 0;
    let releaseFollowup = () => {};
    const followupReady = new Promise<void>((resolve) => {
      releaseFollowup = resolve;
    });
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = String(url).split("/").at(-1) ?? "";
      if (method === "getMe")
        return { json: async () => ({ ok: true, result: { username: "may", first_name: "May" } }) } as Response;
      if (method === "getUpdates" && updatePolls++ === 0) {
        return {
          json: async () => ({
            ok: true,
            result: [
              { update_id: 1, message: { message_id: 501, chat: { id: 123 }, text: "/apps evaluation" } },
              { update_id: 2, message: { message_id: 502, chat: { id: 123 }, text: "/task 8f12ac90" } },
              { update_id: 3, message: { message_id: 503, chat: { id: 123 }, text: "/watch 8f12ac90" } },
              { update_id: 4, message: { message_id: 504, chat: { id: 123 }, text: "Prioritize exact evidence" } },
            ],
          }),
        } as Response;
      }
      if (method === "getUpdates" && updatePolls === 2) {
        await followupReady;
        return {
          json: async () => ({
            ok: true,
            result: [
              { update_id: 5, message: { message_id: 505, chat: { id: 123 }, text: "/watch" } },
              { update_id: 6, message: { message_id: 506, chat: { id: 123 }, text: "/cancel 8f12ac90" } },
              { update_id: 7, message: { message_id: 507, chat: { id: 123 }, text: "/unwatch" } },
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

    const task = () => ({
      appId: "evaluation",
      taskId: "review/docs",
      ref: "8f12ac90",
      status: taskTerminal ? ("done" as const) : ("running" as const),
      generation: 1,
      resourceVersion: taskTerminal ? 3 : 2,
      outcome: "Review the docs",
      summary: taskTerminal ? "The review is complete." : "Reviewing current behavior",
      updatedAt: Date.UTC(2026, 7, 22, 1, taskTerminal ? 5 : 2, 3),
      terminal: taskTerminal,
      cancellable: !taskTerminal,
      ...(!taskTerminal && taskProgress ? { progress: taskProgress } : {}),
    });
    const bus = new EventBus();
    const unsubscribe = bus.subscribe((event) => observed.push(event));
    const bot = attachTelegramBot({
      bus,
      interfaceAgent: "may",
      persistDir: root,
      humanTasks: {
        listApps: () => [
          {
            id: "evaluation",
            owner: "evaluator",
            activeTasks: 1,
            attentionTasks: 0,
            runningTasks: 1,
            waitingTasks: 0,
          },
        ],
        getTask: () => task(),
        listTasks: () => ({ items: [], total: 0 }),
        cancelTask(input: Record<string, unknown>) {
          cancelCalls.push(input);
          taskTerminal = true;
          return task();
        },
      } as any,
    });
    try {
      await waitFor(() => sent.length >= 3);
      await waitFor(() =>
        observed.some(
          (event) =>
            event.type === "conversation.message.created" &&
            event.data?.text === "Prioritize exact evidence" &&
            event.data?.context?.focusedApp === "evaluation" &&
            event.data?.context?.focusedTask?.taskId === "review/docs",
        ),
      );
      expect(sent).toContainEqual(expect.stringContaining("evaluation — 1 active"));
      expect(sent).toContainEqual(expect.stringContaining("Task 8f12ac90"));
      expect(sent).toContainEqual(expect.stringContaining("Watching 8f12ac90"));

      taskProgress = {
        stage: "intermediate",
        message: "Inspecting exact evidence",
        updatedAt: Date.UTC(2026, 7, 22, 1, 3, 4),
      };
      bus.emit({
        type: "project.task.executor.progress",
        source: "app-task:evaluation",
        owner: "agent:evaluator",
        data: {
          stage: taskProgress.stage,
          message: taskProgress.message,
          emission: { appId: "evaluation", taskId: "review/docs" },
        },
      } as any);
      await waitFor(() => sent.some((text) => text.includes("Inspecting exact evidence")));

      taskTerminal = true;
      bus.emit({
        type: "project.task.reconciled",
        source: "task-resource",
        owner: "app:evaluation",
        data: { appId: "evaluation", taskId: "review/docs" },
      } as any);
      await waitFor(() => sent.some((text) => text.includes("Current\nThe review is complete.")));

      releaseFollowup();
      await waitFor(() => sent.some((text) => text.includes("No Task is watched")));
      await waitFor(() => cancelCalls.length === 1);
      expect(cancelCalls[0]).toEqual({ ref: "8f12ac90", reason: "human requested cancellation from Telegram" });
      expect(sent).toContain("No Task is watched.");
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

  it("follows a Topic and attaches the exact Topic to later human messages", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-topic-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
    const sent: string[] = [];
    const observed: any[] = [];
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
              { update_id: 1, message: { message_id: 501, chat: { id: 123 }, text: "/topics" } },
              { update_id: 2, message: { message_id: 502, chat: { id: 123 }, text: "/topic 0df0c0ed" } },
              { update_id: 3, message: { message_id: 503, chat: { id: 123 }, text: "What changed?" } },
              { update_id: 4, message: { message_id: 504, chat: { id: 123 }, text: "/topic" } },
              { update_id: 5, message: { message_id: 505, chat: { id: 123 }, text: "/topic clear" } },
              { update_id: 6, message: { message_id: 506, chat: { id: 123 }, text: "Start a separate subject" } },
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

    const db = getDb(root);
    const topicId = "topic_0df0c0edbf95b5bbc5c87598";
    createConversationTopic(db, {
      id: topicId,
      appId: "may",
      conversationId: "may:primary",
      title: "Review the design",
      openedBy: "human",
      originMessageId: "human-history",
      now: 1,
    });
    createAppInboxItem(db, {
      id: "human-history",
      appId: "may",
      topicId,
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "may-console",
      source: { kind: "human", id: "human-history" },
      input: { kind: "message", data: { message: "Please review the design" } },
      now: 1,
    });

    const bus = new EventBus();
    const unsubscribe = bus.subscribe((event) => observed.push(event));
    const bot = attachTelegramBot({ bus, interfaceAgent: "may", persistDir: root, humanTasks: {} as any });
    try {
      await waitFor(() => sent.some((text) => text.includes("Recent Topics:")));
      await waitFor(() => sent.some((text) => text.includes("Following 0df0c0ed · Review the design")));
      await waitFor(() =>
        observed.some(
          (event) =>
            event.type === "conversation.message.created" &&
            event.data?.text === "What changed?" &&
            event.data?.metadata?.topicId === topicId,
        ),
      );
      await waitFor(() => sent.some((text) => text.includes("Stopped following Topic 0df0c0ed")));
      await waitFor(() =>
        observed.some(
          (event) =>
            event.type === "conversation.message.created" &&
            event.data?.text === "Start a separate subject" &&
            event.data?.metadata?.topicId === undefined,
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

  it("mirrors a Console conversation message without replaying Telegram's own human input", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-conversation-mirror-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
    const sent: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = String(url).split("/").at(-1) ?? "";
      if (method === "getMe")
        return { json: async () => ({ ok: true, result: { username: "may", first_name: "May" } }) } as Response;
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

    const bus = new EventBus();
    const bot = attachTelegramBot({ bus, interfaceAgent: "may", persistDir: root, humanTasks: {} as any });
    try {
      const db = getDb(root);
      createAppInboxItem(db, {
        id: "console-request",
        appId: "may",
        conversationId: "may:primary",
        conversationSequence: 1,
        channel: "may-console",
        source: { kind: "human", id: "may-console:test:1" },
        input: { kind: "message", data: { message: "Message sent from Console" } },
        now: 1,
      });
      createAppInboxItem(db, {
        id: "telegram-request",
        appId: "may",
        conversationId: "may:primary",
        conversationSequence: 2,
        channel: "telegram",
        channelTargetId: "123",
        channelMessageId: 2,
        source: { kind: "human", id: "telegram:123:2" },
        input: { kind: "message", data: { message: "Telegram should not echo this" } },
        now: 2,
      });
      bus.emit({
        type: "conversation.updated",
        source: "app-inbox",
        owner: "app:may",
        data: { appId: "may", conversationId: "may:primary" },
      } as any);

      await waitFor(() => sent.length === 1);
      expect(sent[0]).toBe("Console · You\nMessage sent from Console");
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
});

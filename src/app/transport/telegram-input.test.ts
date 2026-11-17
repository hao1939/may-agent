import type { EventInput } from "@may-agent/control/events";
import { describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { conversationTaskContext } from "../../../test/fixtures/conversation-task.js";
import { DbWriter } from "../../lib/db-writer.js";
import { storeNotificationMessage } from "../../lib/db/notifications.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { EVENT_ROW_ID, EventBus } from "../core/events/bus.js";
import { createEventInterface } from "../core/events/interface.js";
import { createAppInboxItem, getAppInboxItem } from "../core/state/app-inbox-store.js";
import {
  admitConversationTaskInput,
  conversationTaskIntent,
  stopConversationTaskTurn,
} from "../core/state/conversation-task-turns.js";
import { readAppConversationResource } from "../core/state/conversations.js";
import { resolveTaskReference } from "../core/state/task-reference-index.js";
import { claimObservedAppTask } from "../core/tasks/app-task-reconciler.js";
import type { HumanTaskView } from "../human-task-service.js";
import {
  attachTelegramBot as attachTelegramBotRuntime,
  renderTelegramApps,
  renderTelegramTask,
  renderTelegramTasks,
  renderTelegramTodos,
  telegramConversationInputEvent,
} from "./telegram.js";

function attachTelegramBot(
  options: Omit<Parameters<typeof attachTelegramBotRuntime>[0], "publishEvent"> &
    Partial<Pick<Parameters<typeof attachTelegramBotRuntime>[0], "publishEvent">>,
): ReturnType<typeof attachTelegramBotRuntime> {
  return attachTelegramBotRuntime({
    conversationAppId: "may",
    ...options,
    publishEvent(input, authorization) {
      if (options.publishEvent) return options.publishEvent(input, authorization);
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
        delivery: "accepted",
      };
    },
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error("Timed out waiting for Telegram adapter");
    await Bun.sleep(10);
  }
}

/** Fake Telegram transport with the real journal and public event boundary. */
function durableTelegramFixture() {
  const root = mkdtempSync(join(tmpdir(), "telegram-durable-input-"));
  const priorFetch = globalThis.fetch;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  const priorChat = process.env.TELEGRAM_CHAT_ID;
  const bus = new EventBus();
  const published: EventInput[] = [];
  const taskReads: string[] = [];
  const calls: Array<{ method: string; body: any; messageId: number }> = [];
  const updates: any[] = [];
  const tasks = new Map<string, HumanTaskView>(["first", "second"].map((id) => [id, {
    appId: "may", taskId: id, ref: id, outcome: `Review ${id}`, status: "running",
    generation: 1, resourceVersion: 1, summary: `Inspecting ${id}`, updatedAt: 1, terminal: false, cancellable: true,
  }]));
  let releasePoll: (() => void) | undefined;
  let rejectInput = false;
  let rejectedRecordings = 0;
  let afterRecord: ((input: EventInput) => void) | undefined;
  let holdSend: ((body: any) => Promise<void>) | undefined;
  let admissionBlocked = false;
  const admitted: string[] = [];
  const unsubscribeAdmission = bus.subscribeDurableRoute((event) => {
    if (event.type === "runtime.reload.requested") return; // Exercise the actual command route in reload tests.
    const data = event.data as Record<string, any>;
    if (event.type === "conversation.message.created" && data.author?.kind === "human") {
      if (admissionBlocked) throw new Error("fixture admission unavailable after event recording");
      const config = conversationTaskContext(getDb(root), root);
      admitConversationTaskInput(config, {
        id: data.author.id, appId: "may", conversationId: data.conversationId,
        conversationSequence: Number(event[EVENT_ROW_ID]), source: { kind: "human", id: data.author.id },
        input: { kind: "message", data: { message: data.text, context: data.context } },
        channel: "telegram", channelTargetId: data.metadata.channelTargetId,
        channelThreadId: data.metadata.channelThreadId, channelMessageId: data.metadata.channelMessageId,
        intent: conversationTaskIntent(config),
      });
      admitted.push(data.text);
    }
    return { accepted: true, by: "fixture-input", route: "direct" };
  });
  globalThis.fetch = (async (url, init) => {
    const method = String(url).split("/").at(-1)!;
    const body = JSON.parse(String(init?.body ?? "{}"));
    const call = { method, body, messageId: 900 + calls.length };
    calls.push(call);
    if (method === "getMe") return Response.json({ ok: true, result: { username: "fixture" } });
    if (method === "getUpdates") {
      while (updates.length && updates[0].update_id < body.offset) updates.shift();
      if (!updates.length) await new Promise<void>((resolve) => {
        releasePoll = resolve;
        init?.signal?.addEventListener("abort", resolve, { once: true });
      });
      releasePoll = undefined;
      return Response.json({ ok: true, result: [...updates] });
    }
    if (method === "sendMessage") await holdSend?.(body);
    return Response.json({ ok: true, result: { message_id: call.messageId } });
  }) as typeof fetch;
  process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
  process.env.TELEGRAM_CHAT_ID = "123,456";
  let publish: Parameters<typeof attachTelegramBotRuntime>[0]["publishEvent"];
  const start = () => {
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const events = createEventInterface({ bus, db: getDb(root), validateAppInput: () => {},
      hasApp: () => true, hasAgent: () => true, hasSession: () => false });
    publish = (input, approvalAuthorization) => events.publish(input, { source: "telegram", approvalAuthorization });
    return attachTelegramBotRuntime({
    conversationAppId: "may",
      persistDir: root, bus, interfaceAgent: "may",
      humanTasks: {
        listApps: (id) => [{ id: id ?? "may", activeTasks: 2, attentionTasks: 0, runningTasks: 2, waitingTasks: 0 }],
        listTasks: () => ({ items: [], total: 0 }),
        getTask: ({ taskId, ref }) => {
          const id = taskId ?? ref ?? "";
          taskReads.push(id);
          if (ref && !tasks.has(ref)) resolveTaskReference(getDb(root), ref);
          return tasks.get(id) ?? null;
        },
      },
      publishEvent(input, authorization) {
        if (rejectInput && input.data.author?.kind === "human") {
          rejectedRecordings++;
          throw new Error("fixture input storage unavailable");
        }
        const receipt = publish(input, authorization);
        published.push(input);
        afterRecord?.(input);
        return receipt;
      },
    });
  };
  let bot = start();
  return {
    root, bus, published, calls, tasks, taskReads, admitted,
    detachAdmission: unsubscribeAdmission,
    get bot() { return bot; },
    get db() { return getDb(root); },
    reject(value: boolean) { rejectInput = value; },
    blockAdmission(value: boolean) { admissionBlocked = value; },
    rejections: () => rejectedRecordings,
    afterRecord(fn: (input: EventInput) => void) { afterRecord = fn; },
    hold(fn: (body: any) => Promise<void>) { holdSend = fn; },
    send(batch: any[]) { updates.push(...batch); releasePoll?.(); },
    polls: () => calls.filter((c) => c.method === "getUpdates").map((c) => c.body.offset),
    sends: () => calls.filter((c) => c.method === "sendMessage"),
    inputs: () => published.filter((e) => e.data.author?.kind === "human"),
    message(id: number, text: string, extra: Record<string, unknown> = {}) {
      this.send([{ update_id: id, message: { message_id: id, chat: { id: 123 }, text, ...extra } }]);
    },
    activity(input: EventInput) {
      publish(input);
      bus.emit({ type: "conversation.updated", source: "fixture", owner: "app:may", data: { appId: "may", conversationId: "may:primary" } });
    },
    async restart() {
      bot.close();
      await new Promise<void>((resolve) => setImmediate(resolve));
      closeDb(root);
      bot = start();
    },
    async close() {
      bot.close();
      unsubscribeAdmission();
      await new Promise<void>((resolve) => setImmediate(resolve));
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
      globalThis.fetch = priorFetch;
      if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = priorToken;
      if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
      else process.env.TELEGRAM_CHAT_ID = priorChat;
    },
  };
}

describe("Telegram durable input and natural follow-up", () => {
  it("seeks recorded provider inputs by type and key before and after reopening storage", async () => {
    const f = durableTelegramFixture();
    try {
      for (const id of [100, 101]) {
        const prepare = spyOn(f.db, "prepare");
        try {
          f.message(id, "Check the original input");
          await waitFor(() => f.polls().includes(id + 1));
          const lookup = prepare.mock.calls.map(([sql]) => sql).find((sql) =>
            sql.startsWith("SELECT id, delivery_status FROM events") && sql.includes("idempotency_key"),
          );
          expect(lookup).toBeDefined();
          const plan = f.db.prepare(`EXPLAIN QUERY PLAN ${lookup}`).all("conversation.message.created", `telegram:123:${id}`);
          expect(plan.some((row) => /SEARCH events .*\(event_type=\? AND idempotency_key=\?\)/.test(String(row.detail))))
            .toBe(true);
        } finally { prepare.mockRestore(); }
        if (id === 100) await f.restart();
      }
      expect(f.admitted).toHaveLength(2);
    } finally { await f.close(); }
  });

  it("keeps the failed update and its suffix unacknowledged, then records each input once", async () => {
    const f = durableTelegramFixture();
    try {
      f.reject(true);
      f.message(100, "Review first");
      f.message(101, "Review second", { chat: { id: 456 } });
      // Observe the actual publication failure, not a timed guess about handling.
      await waitFor(() => f.rejections() === 1);
      expect(f.polls()).toEqual([0]);
      expect(f.inputs()).toHaveLength(0);
      f.reject(false);
      await waitFor(() => f.polls().includes(102), 8_000);
      expect(f.inputs().map((input) => input.data.text)).toEqual(["Review first", "Review second"]);
      expect(f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'conversation.message.created'").get()).toEqual({ count: 2 });
    } finally { await f.close(); }
  }, 10_000);

  it("uses recorded input after a lost receipt and restart instead of rebuilding it from new focus", async () => {
    const f = durableTelegramFixture();
    let lostReceipt = false;
    try {
      f.afterRecord((input) => {
        if (input.data.author?.kind === "human" && !lostReceipt) { lostReceipt = true; throw new Error("fixture receipt lost after persistence"); }
      });
      f.blockAdmission(true);
      const longInput = "Review this and preserve every detail. ".repeat(200);
      f.message(100, longInput);
      await waitFor(() => lostReceipt);
      expect(f.admitted).toHaveLength(0);
      expect(f.polls()).toEqual([0]);
      f.tasks.delete("first");
      f.blockAdmission(false);
      await f.restart();
      await waitFor(() => f.polls().includes(101));
      expect(f.inputs()).toHaveLength(1);
      expect(f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE idempotency_key = 'telegram:123:100'").get()).toEqual({ count: 1 });
      expect(f.admitted).toEqual([longInput.trim()]);
      expect(f.db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE source_id = 'telegram:123:100'").get()).toEqual({ count: 1 });
      expect(f.db.prepare("SELECT delivery_status FROM events WHERE idempotency_key = 'telegram:123:100'").get()).toEqual({ delivery_status: "accepted" });
    } finally { await f.close(); }
  });

  it("admits following text and another chat while a command send is stalled", async () => {
    const f = durableTelegramFixture();
    const blocked = Promise.withResolvers<void>();
    try {
      f.hold((body) => body.text.includes("Selected App") ? blocked.promise : Promise.resolve());
      f.send([
        { update_id: 100, message: { message_id: 100, chat: { id: 123 }, text: "/apps sample" } },
        { update_id: 101, message: { message_id: 101, chat: { id: 123 }, text: "Review this" } },
        { update_id: 102, message: { message_id: 102, chat: { id: 456 }, text: "Hello" } },
      ]);
      await waitFor(() => f.polls().includes(103));
      expect(f.inputs()).toHaveLength(2);
      expect(f.inputs()[0].data.context).toMatchObject({ focusedApp: "sample" });
      expect(f.inputs()[1].data.metadata).toMatchObject({ channelTargetId: "456" });
    } finally { blocked.resolve(); await f.close(); }
  });

  it.each(["success", "failure", "close"])("orders all immediate command replies across a delayed send (%s)", async (outcome) => {
    const f = durableTelegramFixture();
    const held = Promise.withResolvers<void>();
    const thread = { message_thread_id: 7 };
    const surfaceSends = () => f.sends().filter((call) => call.body.chat_id === "123" && call.body.message_thread_id === 7);
    try {
      f.hold(async (body) => {
        if (!body.text.startsWith("Task first")) return;
        await held.promise;
        if (outcome === "failure") throw new Error("fixture send unavailable");
      });
      f.message(100, "/task first", thread);
      await waitFor(() => surfaceSends().length === 1);
      f.message(101, "/task invalid", thread);
      f.message(102, "/help", thread);
      f.message(103, "/start", thread);
      f.message(104, "/unknown", thread);
      f.message(105, "/apps sample", thread);
      f.message(106, "/help", { ...thread, chat: { id: 456 } });
      f.message(107, "/help", { message_thread_id: 8 });
      f.message(108, "Continue this work", thread);
      await waitFor(() => f.polls().includes(109) && f.sends().some((call) => call.body.chat_id === "456") &&
        f.sends().some((call) => call.body.message_thread_id === 8));
      expect(surfaceSends()).toHaveLength(1);
      expect(f.admitted).toEqual(["Continue this work"]);
      expect(f.inputs()[0].data.context.focusedApp).toBe("sample");

      if (outcome === "close") {
        f.bot.close();
        held.resolve();
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(surfaceSends()).toHaveLength(1);
        expect(f.published.some((event) => event.data.metadata?.command)).toBe(false);
        return;
      }
      held.resolve();
      await waitFor(() => f.published.some((event) => event.data.metadata?.command === "/apps sample"));
      expect(surfaceSends().map((call) => call.body.text)).toEqual([
        expect.stringContaining("Task first"),
        expect.stringContaining("Task reference must contain"),
        expect.stringContaining("Optional shortcuts"),
        expect.stringContaining("Optional shortcuts"),
        expect.stringContaining("Unknown command: /unknown"),
        expect.stringContaining("Selected App: sample"),
      ]);
      expect(surfaceSends()[1].body.reply_parameters.message_id).toBe(101);
      expect(surfaceSends()[2].body.parse_mode).toBe("Markdown");
      expect(surfaceSends()[4].body.reply_parameters.message_id).toBe(104);
      // Help and validation feedback remain presentation only, not replacement Task views.
      expect(f.published.filter((event) => event.data.metadata?.command).map((event) => event.data.metadata.command))
        .toEqual(outcome === "failure" ? ["/apps sample"] : ["/task first", "/apps sample"]);
    } finally { held.resolve(); await f.close(); }
  });

  it("scopes reply links and command views by chat, and explicit replies override a different watch after reopen", async () => {
    const f = durableTelegramFixture();
    try {
      for (const chatId of ["123", "456"]) storeNotificationMessage(f.root, {
        chat_id: chatId, telegram_msg_id: 55, event_type: "conversation.mirror", agent: "may",
        session_id: null, project_id: null,
        data: JSON.stringify({ conversationMessageId: `answer-${chatId}`, topicId: `topic-${chatId}`,
          taskRefs: [{ appId: "may", taskId: "first" }] }),
      });
      await f.restart();
      f.message(100, "/watch second", { message_thread_id: 7 });
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/watch second"));
      f.message(101, "Yes, do that", { reply_to_message: { message_id: 55, text: "Proposal A" }, message_thread_id: 7 });
      await waitFor(() => f.inputs().length === 1);
      expect(f.inputs()[0].data).toMatchObject({ replyTo: "answer-123", metadata: { topicId: "topic-123", channelThreadId: "7" },
        context: { focusedTask: { appId: "may", taskId: "first" } } });
      f.message(102, "/tasks");
      f.message(103, "/tasks", { chat: { id: 456 } });
      await waitFor(() => f.published.filter((e) => e.data.metadata?.command === "/tasks").length === 2);
      const views = readAppConversationResource(f.db, "may", "may:primary").messages.filter((m) => m.metadata?.command === "/tasks");
      expect(views.map((m) => m.metadata?.channelTargetId).sort()).toEqual(["123", "456"]);
    } finally { await f.close(); }
  });

  it("retains one cancellation after a lost receipt even when the Task revision changes", async () => {
    const f = durableTelegramFixture();
    let recorded = false;
    try {
      f.afterRecord((input) => {
        if (input.type === "app.task.cancel.requested") {
          recorded = true;
          f.tasks.set("first", { ...f.tasks.get("first")!, resourceVersion: 2 });
          throw new Error("fixture cancellation receipt lost");
        }
      });
      f.message(100, "/cancel first");
      await waitFor(() => recorded);
      await f.restart();
      await waitFor(() => f.polls().includes(101));
      expect(f.published.filter((input) => input.type === "app.task.cancel.requested")).toHaveLength(1);
      expect(f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE idempotency_key = 'telegram:123:100:cancel'").get()).toEqual({ count: 1 });
    } finally { await f.close(); }
  });

  it.each([
    [undefined, undefined],
    ["7", 7],
    ["topic:7", undefined],
    ["9007199254740993", undefined],
  ] as const)("targets the active message with stored thread %s and admits Stop during a stalled command send", async (storedThreadId, providerThreadId) => {
    const f = durableTelegramFixture();
    const blocked = Promise.withResolvers<void>();
    try {
      f.activity({ type: "conversation.message.created", target: { appId: "may" }, data: {
        conversationId: "may:primary", author: { kind: "human", id: "active" }, text: "Review changes",
        metadata: { channel: "telegram", channelTargetId: "123", channelThreadId: storedThreadId, channelMessageId: 42 },
      } });
      const config = conversationTaskContext(f.db, f.root);
      const claim = claimObservedAppTask(config, {
        taskId: getAppInboxItem(f.db, "active")!.executionTaskId!, appAgent: "may", handler: "executor:agent",
      });
      expect(claim.kind).toBe("claimed");
      f.hold((body) => body.text.startsWith("Task first") ? blocked.promise : Promise.resolve());
      f.message(100, "/task first", { message_thread_id: providerThreadId });
      await waitFor(() => f.sends().some((c) => c.body.text === "May is working on this message."));
      const controls = f.sends().filter((c) => c.body.text.startsWith("May is working"));
      expect(controls).toHaveLength(1);
      const control = controls[0];
      expect(control.body).toMatchObject({ chat_id: "123", reply_parameters: { message_id: 42 } });
      expect(control.body.message_thread_id).toBe(providerThreadId);
      f.message(101, "Only review networking", { message_thread_id: providerThreadId });
      await waitFor(() => f.inputs().length === 1);
      await waitFor(() => f.sends().some((c) => c.body.text.includes("hasn't changed running work")));
      f.afterRecord((input) => {
        if (input.type === "conversation.turn.stop.requested") {
          stopConversationTaskTurn(config, { appId: "may", ...input.data } as Parameters<typeof stopConversationTaskTurn>[1]);
        }
      });
      f.send([{ update_id: 102, callback_query: { id: "stop", data: control.body.reply_markup.inline_keyboard[0][0].callback_data,
        message: { message_id: control.messageId, chat: { id: 123 }, message_thread_id: providerThreadId } } }]);
      await waitFor(() => getAppInboxItem(f.db, "active")?.status === "done");
      expect(f.tasks.get("first")?.status).toBe("running");
      expect(f.polls()).toContain(103);
    } finally { blocked.resolve(); await f.close(); }
  });

  it("shows Telegram-origin admission once and offers exact, restart-safe task navigation", async () => {
    const f = durableTelegramFixture();
    try {
      await waitFor(() => f.polls().length === 1);
      f.activity({ type: "conversation.message.created", target: { appId: "may" }, data: {
        conversationId: "may:primary", author: { kind: "tool", id: "runtime" }, text: "Accepted durable work: Review first",
        metadata: { command: "task-admitted", channel: "telegram", channelTargetId: "123", channelThreadId: "7",
          taskRefs: [{ appId: "may", taskId: "first" }], followTask: { appId: "may", taskId: "first" } },
      } });
      await waitFor(() => f.sends().some((c) => c.body.text.startsWith("Background work accepted")));
      const notice = f.sends().find((c) => c.body.text.startsWith("Background work accepted"))!;
      await waitFor(() => Boolean(f.db.prepare("SELECT 1 FROM notification_messages WHERE chat_id = '123' AND telegram_msg_id = ?").get(notice.messageId)));
      expect(notice.body).toMatchObject({ chat_id: "123", message_thread_id: 7,
        reply_markup: { inline_keyboard: [[{ text: "Details", callback_data: "task:details" }, { text: "Follow updates", callback_data: "task:follow" }]] } });
      await f.restart();
      const callback = { id: "follow", data: "task:follow", message: { message_id: notice.messageId, chat: { id: 123 }, message_thread_id: 7 } };
      f.send([{ update_id: 100, callback_query: { ...callback, message: { ...callback.message, chat: { id: 999 } } } }]);
      await waitFor(() => f.calls.some((c) => c.method === "answerCallbackQuery" && c.body.text === "Unauthorized."));
      f.send([{ update_id: 101, callback_query: callback }]);
      await waitFor(() => f.sends().some((c) => c.body.text.includes("Following updates")));
      f.message(102, "What's the status?", { message_thread_id: 7 });
      await waitFor(() => f.inputs().length === 1);
      expect(f.inputs()[0].data.context).toMatchObject({ focusedTask: { appId: "may", taskId: "first" } });
      expect(f.sends().filter((c) => c.body.text.startsWith("Background work accepted"))).toHaveLength(1);
      expect(f.tasks.get("second")?.status).toBe("running");
    } finally { await f.close(); }
  });

  it("explains unsupported media and offers conversation-first help without creating work", async () => {
    const f = durableTelegramFixture();
    try {
      f.message(100, "", { photo: [{ file_id: "fixture" }], caption: "What is this error?" });
      const content = ["game", "paid_media", "story", "checklist", "invoice", "rich_message", "live_photo",
        "giveaway", "giveaway_winners", "passport_data", "web_app_data", "users_shared", "chat_shared"];
      let id = 100;
      for (const field of content) f.message(++id, "", { [field]: { fixture: true }, message_thread_id: 7 });
      f.message(++id, "", { new_chat_members: [{ id: 42 }], pinned_message: { text: "Earlier message" } });
      f.message(++id, "", { game: { fixture: true }, chat: { id: 999 } });
      f.message(++id, "/help");
      await waitFor(() => f.polls().includes(id + 1));
      await waitFor(() => f.sends().length === content.length + 3);
      expect(f.inputs()).toHaveLength(0);
      expect(f.sends()[0].body.text).toContain("can't read this attachment");
      for (const messageId of content.map((_, index) => 101 + index)) {
        expect(f.sends().find((call) => call.body.reply_parameters?.message_id === messageId)?.body)
          .toMatchObject({ chat_id: "123", message_thread_id: 7,
            text: expect.stringContaining("can't read this attachment") });
      }
      expect(f.sends().find((call) => call.body.chat_id === "999")?.body.text).toContain("Unauthorized");
      expect(f.sends().at(-1)!.body.text).toContain("Reply to an update to follow up");
    } finally { await f.close(); }
  });

  it("submits a proposal reply once with sender authority and leaves decisions to the Host", async () => {
    const previous = process.env.TELEGRAM_APPROVER_ID;
    process.env.TELEGRAM_APPROVER_ID = "7";
    const f = durableTelegramFixture();
    try {
      const proposal = { taskGeneration: 1, conditionId: "review", conditionGeneration: 1,
        subject: "candidate:a", expected: { allowedDecisions: ["approve", "reject", "defer"] },
        requestedAction: "Apply candidate A" };
      storeNotificationMessage(f.root, { chat_id: "123", telegram_msg_id: 55, event_type: "task.human-action",
        agent: "may", session_id: null, project_id: null, data: JSON.stringify({
          taskRefs: [{ appId: "sample", taskId: "release" }], approvalAnchor: proposal,
        }) });
      f.message(100, "approve", { from: { id: 7 }, reply_to_message: { message_id: 55, text: proposal.requestedAction } });
      await waitFor(() => f.inputs().length === 1);
      expect(f.inputs()[0]!.data.approvalReply).toEqual({ target: { appId: "sample", taskId: "release" }, proposal });
      expect(f.published.filter((event) => event.type === "project.approval.submitted")).toHaveLength(0);
      const row = f.db.prepare("SELECT data FROM events WHERE event_type = 'conversation.message.created' AND idempotency_key = 'telegram:123:100'").get()!;
      expect(JSON.parse(String(row.data)).approvalReply).toMatchObject({ proposal, decision: "approve",
        hostApproval: { ingressSource: "telegram", actor: { kind: "human", id: "7" } } });
    } finally {
      await f.close();
      if (previous === undefined) delete process.env.TELEGRAM_APPROVER_ID;
      else process.env.TELEGRAM_APPROVER_ID = previous;
    }
  });

  it("maps one Telegram turn to one durable May request with exact reply identity", () => {
    expect(
      telegramConversationInputEvent({
        appId: "may",
        message: "Please inspect this",
        chatId: "123",
        messageId: 502,
        topicId: 7,
        conversationId: "telegram:chat:123:topic:7:agent:may",
        replyToMessageId: 499,
        replyToSourceId: "result:request-499",
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
        replyTo: "result:request-499",
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
    ).toContain("evaluation — 1 open · 1 active · 1 running");
    const workingTasks = renderTelegramTasks([task], false);
    expect(workingTasks).toContain("<b>Working</b>\n🔵 <b>Review the docs</b>");
    expect(workingTasks).toContain("🔵 <b>Review the docs</b>\n  evaluation · <code>8f12ac90</code>");
    expect(workingTasks).not.toContain("Working · evaluation");
    expect(workingTasks).not.toContain("Needs you:");
    const groupedTasks = renderTelegramTasks(
      [
        { ...task, status: "waiting", humanAction: { requestedAction: "Choose the rollout." } },
        task,
        { ...task, taskId: "waiting", ref: "aa11bb22", status: "waiting" },
        { ...task, taskId: "current", ref: "cc33dd44", status: "idle" },
      ],
      false,
    );
    expect(groupedTasks).toContain("<b>Needs you</b>\n🔴 <b>Review the docs</b>");
    expect(groupedTasks).toContain("<b>Working</b>\n🔵 <b>Review the docs</b>");
    expect(groupedTasks).toContain("<b>Waiting</b>\n🟡 <b>Review the docs</b>");
    expect(groupedTasks).toContain("<b>Idle</b>\n🟢 <b>Review the docs</b>");
    expect(groupedTasks).toContain("🟢 <b>Review the docs</b>\n  evaluation · <code>cc33dd44</code>");
    expect(groupedTasks).not.toContain("Waiting · evaluation");
    expect(groupedTasks).not.toContain("Idle · evaluation");
    expect(groupedTasks).toContain("Tasks · open");
    const endedTasks = renderTelegramTasks(
      [
        { ...task, status: "closed", terminal: true },
        { ...task, status: "cancelled", terminal: true },
      ],
      true,
    );
    expect(endedTasks).toContain("<b>Closed</b>");
    expect(endedTasks).toContain("<b>Cancelled</b>");
    expect(endedTasks).not.toContain("<b>Completed</b>");
    const recurringTasks = renderTelegramTasks(
      [
        {
          ...task,
          recurring: true,
          recurrence: { cadenceMs: 4 * 60 * 60_000, nextRunAt: "2026-09-19T13:53:00.000Z" },
        },
        task,
      ],
      false,
    );
    expect(recurringTasks).toContain("🔁 <b>Recurring</b> · every 4h · next 2026-09-19 13:53 UTC");
    expect(recurringTasks.match(/🔁/g)).toHaveLength(1);
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
    ).toContain("<b>Needs you for evaluation</b>\n\n🔴 <b>Action: Approve or reject deployment.</b>");
    const recurringTodos = renderTelegramTodos([
      {
        ...task,
        status: "waiting",
        recurring: true,
        recurrence: { cadenceMs: 4 * 60 * 60_000, nextRunAt: "2026-09-19T13:53:00.000Z" },
        humanAction: { requestedAction: "Approve the scheduled review." },
      },
      { ...task, status: "waiting", humanAction: { requestedAction: "Provide the rollout window." } },
    ]);
    expect(recurringTodos).toContain("🔁 <b>Recurring</b> · every 4h · next 2026-09-19 13:53 UTC");
    expect(recurringTodos.match(/🔁/g)).toHaveLength(1);
    expect(
      renderTelegramTodos([
        {
          ...task,
          outcome: "Review <unsafe> & confirm",
          appId: "a&b",
          humanAction: { requestedAction: "Approve <this> & that." },
        },
      ]),
    ).toContain("<b>Action: Approve &lt;this&gt; &amp; that.</b>\n  Purpose: Review &lt;unsafe&gt; &amp; confirm");
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
          message: "Inspecting exact facts",
          updatedAt: Date.UTC(2026, 7, 22, 1, 3, 4),
        },
      }),
    ).toContain("Current · 2026-08-22 01:03:04 UTC\nInspecting exact facts");
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
    const sentParseModes: Array<string | undefined> = [];
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
        sentParseModes.push(body.parse_mode);
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
      expect(sentParseModes.filter((mode) => mode === "HTML")).toHaveLength(4);
      expect(sentParseModes[0]).toBeUndefined();
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
        getTask: () => ({
          ...todo(),
          diagnostics: {
            conditions: [{
              id: "human-decision",
              condition: {
                metadata: { generation: 1 },
                spec: {
                  type: "human.answer.received",
                  subject: "task:deploy/current",
                  owner: "Hao",
                  requestedAction: todo().humanAction.requestedAction,
                  expected: { answer: true },
                },
                status: { state: "false" },
              },
            }],
          },
        }),
      } as any,
    });
    try {
      await waitFor(() => sent.some((text) => text.includes("Needs you for evaluation")));
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

      const sendsBeforeUnchangedWake = sent.length;
      bus.emit({
        type: "project.task.reconciled",
        source: "app-task:evaluation",
        owner: "app:evaluation",
        data: { project: "evaluation", taskId: "deploy/current" },
      } as any);
      await Bun.sleep(30);
      expect(sent).toHaveLength(sendsBeforeUnchangedWake);

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
              { update_id: 4, message: { message_id: 504, chat: { id: 123 }, text: "Prioritize exact facts" } },
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
      ...(!taskTerminal
        ? {
            humanAction: { requestedAction: "Review the shortened proposal." },
            diagnostics: {
              conditions: [
                {
                  id: "approval-docs",
                  condition: {
                    metadata: { id: "approval-docs", generation: 1, resourceVersion: 1 },
                    spec: {
                      type: "project.approval.submitted",
                      subject: "id:approval-docs",
                      owner: "human",
                      requestedAction:
                        "Exact proposal: apply the reviewed docs candidate at commit 01234567; cost is one restart; simpler option is no change.",
                      expected: {
                        anyOf: ["approve", "reject", "defer"],
                        approvalId: "approval-docs",
                        packetHash: "a".repeat(64),
                        taskGeneration: 1,
                        conditionId: "approval-docs",
                      },
                    },
                    status: { state: "false" },
                  },
                },
              ],
            },
          }
        : {}),
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
      } as any,
      publishEvent(input) {
        const data = {
          ...input.data,
          ...(input.target ?? {}),
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        };
        const event = {
          type: input.type,
          source: "telegram",
          owner: input.target?.appId ? `app:${input.target.appId}` : "agent:may",
          ...(input.target ? { target: input.target } : {}),
          data,
        } as any;
        if (input.type === "app.task.cancel.requested") cancelCalls.push(event);
        const emitted = bus.emit(event);
        return { eventId: Number(emitted[EVENT_ROW_ID]) || 1, eventType: input.type, delivery: "accepted" };
      },
    });
    try {
      await waitFor(() => sent.length >= 3);
      await waitFor(() =>
        observed.some(
          (event) =>
            event.type === "conversation.message.created" &&
            event.data?.text === "Prioritize exact facts" &&
            event.data?.context?.focusedApp === "evaluation" &&
            event.data?.context?.focusedTask?.taskId === "review/docs",
        ),
      );
      expect(sent).toContainEqual(expect.stringContaining("evaluation — 1 open · 1 active"));
      expect(sent).toContainEqual(expect.stringContaining("Task 8f12ac90"));
      expect(sent).toContainEqual(expect.stringContaining("Following updates. Reply here"));
      const exactProposal =
        "Exact proposal: apply the reviewed docs candidate at commit 01234567; cost is one restart; simpler option is no change.";
      const approvalCards = sent.filter((text) => text.includes(exactProposal));
      expect(approvalCards).toHaveLength(2);
      const decisionCards = approvalCards.filter((text) => text.includes("Decision needed"));
      expect(decisionCards.length).toBeGreaterThan(0);
      expect(decisionCards.every((text) => text.includes("How to respond"))).toBe(true);
      const boundCards = getDb(root)
        .prepare("SELECT data FROM notification_messages WHERE event_type = 'task.human-action'")
        .all() as Array<{ data: string }>;
      expect(
        boundCards.filter((row) => JSON.parse(row.data).approvalAnchor?.conditionId === "approval-docs"),
      ).toHaveLength(2);

      const unchangedCards = sent.filter((text) => text.startsWith("Task 8f12ac90")).length;
      bus.emit({
        type: "project.task.reconciled",
        source: "task-resource",
        owner: "app:evaluation",
        data: { appId: "evaluation", taskId: "review/docs" },
      } as any);
      await Bun.sleep(30);
      expect(sent.filter((text) => text.startsWith("Task 8f12ac90"))).toHaveLength(unchangedCards);

      taskProgress = {
        stage: "intermediate",
        message: "Inspecting exact facts",
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
      await waitFor(() => sent.some((text) => text.includes("Inspecting exact facts")));

      taskTerminal = true;
      bus.emit({
        type: "project.task.reconciled",
        source: "task-resource",
        owner: "app:evaluation",
        data: { appId: "evaluation", taskId: "review/docs" },
      } as any);
      await waitFor(() => sent.some((text) => text.includes("done\n\nThe review is complete.")));

      releaseFollowup();
      await waitFor(() => sent.some((text) => text.includes("No Task is watched")));
      await waitFor(() => cancelCalls.length === 1);
      expect(cancelCalls[0]).toEqual({
        type: "app.task.cancel.requested",
        source: "telegram",
        owner: "app:evaluation",
        target: { appId: "evaluation", taskId: "review/docs" },
        data: {
          appId: "evaluation",
          taskId: "review/docs",
          expectedGeneration: 1,
          expectedResourceVersion: 3,
          reason: "human requested cancellation from Telegram",
          idempotencyKey: expect.stringMatching(/^telegram:123:\d+:cancel$/),
        },
      });
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

  it("does not expose Topic commands on the two-mode Telegram surface", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-no-topics-"));
    const priorFetch = globalThis.fetch;
    const priorToken = process.env.TELEGRAM_BOT_TOKEN;
    const priorChat = process.env.TELEGRAM_CHAT_ID;
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
              { update_id: 1, message: { message_id: 501, chat: { id: 123 }, text: "/topics" } },
              { update_id: 2, message: { message_id: 502, chat: { id: 123 }, text: "/topic 0df0c0ed" } },
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

    const bus = new EventBus();
    const bot = attachTelegramBot({ bus, interfaceAgent: "may", persistDir: root, humanTasks: {} as any });
    try {
      await waitFor(() => sent.includes("Unknown command: /topics. Use /help to see available commands."));
      await waitFor(() => sent.includes("Unknown command: /topic. Use /help to see available commands."));
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

  it("mirrors Console speech and Task activity without replaying Telegram's own human input", async () => {
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
      db.prepare(
        `INSERT INTO events (id, event_type, source, owner, data, timestamp)
         VALUES (?, 'conversation.message.created', 'app-task-admission', 'app:may', ?, ?)`,
      ).run(
        10,
        JSON.stringify({
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "tool", id: "runtime" },
          text: "Accepted durable work: Review the docs",
          metadata: {
            command: "task-admitted",
            taskRefs: [{ appId: "may", taskId: "conversation/follow-up" }],
            followTask: { appId: "may", taskId: "conversation/follow-up" },
          },
        }),
        3,
      );
      bus.emit({
        type: "conversation.updated",
        source: "app-inbox",
        owner: "app:may",
        data: { appId: "may", conversationId: "may:primary" },
      } as any);

      await waitFor(() => sent.length === 2);
      expect(sent[0]).toBe("Console · You\nMessage sent from Console");
      expect(sent[1]).toBe("Background work accepted\nReview the docs");
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

import { describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../lib/requests.js";
import { DbWriter } from "../../lib/db-writer.js";
import { storeNotificationMessage } from "../../lib/db/notifications.js";
import { createEventInterface } from "../core/events/interface.js";
import { attachCommandRouter } from "../command-router.js";
import { AppRegistry } from "../core/apps/registry.js";
import { HostCapacity } from "../core/scheduling/host-capacity.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "../composition/app-inbox-runtime.js";
import { prepareConversationTaskTurn } from "../composition/conversation-task-turn.js";
import { createAppTaskCapability } from "../core/tasks/app-task-capability.js";
import {
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../core/tasks/app-task-runtime.js";
import type { AppInputContext } from "@may-agent/sdk";
import type { EventInput } from "@may-agent/control/events";
import type { HumanTaskView } from "../human-task-service.js";
import { resolveTaskReference } from "../core/state/task-reference-index.js";
import { createAppInboxItem, stopAppInboxTurn, getAppInboxItem } from "../core/state/app-inbox-store.js";
import { claimNextAppInboxItem } from "../../../test/fixtures/legacy-inbox.js";
import { createConversationTopic, linkConversationTopicTask, readAppConversationResource } from "../core/state/conversations.js";
import { EVENT_ROW_ID, EventBus } from "../core/events/bus.js";
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
  options: Omit<Parameters<typeof attachTelegramBotRuntime>[0], "publishEvent"> &
    Partial<Pick<Parameters<typeof attachTelegramBotRuntime>[0], "publishEvent">>,
): ReturnType<typeof attachTelegramBotRuntime> {
  return attachTelegramBotRuntime({
    ...options,
    publishEvent(input) {
      if (options.publishEvent) return options.publishEvent(input);
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
      createAppInboxItem(getDb(root), {
        id: data.author.id, appId: "may", conversationId: data.conversationId,
        conversationSequence: Number(event[EVENT_ROW_ID]), source: { kind: "human", id: data.author.id },
        input: { kind: "message", data: { message: data.text, context: data.context } },
        channel: "telegram", channelTargetId: data.metadata.channelTargetId,
        channelThreadId: data.metadata.channelThreadId, channelMessageId: data.metadata.channelMessageId,
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
  let publish: (input: EventInput) => ReturnType<ReturnType<typeof createEventInterface>["publish"]>;
  const start = () => {
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const events = createEventInterface({ bus, db: getDb(root), acceptsAppInput: () => true,
      hasApp: () => true, hasAgent: () => true, hasSession: () => false });
    publish = (input) => events.publish(input, { source: "telegram" });
    return attachTelegramBotRuntime({
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
      publishEvent(input) {
        if (rejectInput && input.data.author?.kind === "human") {
          rejectedRecordings++;
          throw new Error("fixture input storage unavailable");
        }
        const receipt = publish(input);
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
  it("carries selected and replied-to Topics through Task admission, restart, and the agent input boundary", async () => {
    const f = durableTelegramFixture();
    f.detachAdmission();
    const seen: Readonly<AppInputContext>[] = [];
    let runtime: AppInboxRuntime | undefined;
    const held = Promise.withResolvers<void>();
    const registry = new AppRegistry(async () => [{ appDir: f.root, definition: {
      id: "may", version: 1, owner: "may",
      inputSchema: { type: "object", required: ["kind", "data"], properties: {
        kind: { const: "message" }, data: { type: "object" },
      } },
      conversation: { mode: "agent", inputKinds: ["message"], conversationId: "may:primary" },
    } }]);
    const start = async () => {
      const hostCapacity = new HostCapacity(1);
      await installAppTaskRuntimes({
        projectRoot: f.root, projectsRoot: f.root, persistDir: f.root, bus: f.bus,
        hostCapacity, installControllers: false, appRegistrySnapshot: registry.snapshot(),
        conversations: {
          execute: (turn) => prepareConversationTaskTurn({
            ...turn,
            resolveConversationInput: async ({ inputContext: request }) => {
              seen.push(request);
              return { summary: "Checked", response: "Checked", topic: { kind: "none" } };
            },
          }),
        },
      }, { deferRecovery: true });
      const tasks = createAppTaskCapability({ bus: f.bus });
      return startAppInboxRuntime({
        registry, db: f.db, bus: f.bus, persistDir: f.root, deferStart: true,
        admitConversation: tasks.admitConversation,
        admitConversationChange: tasks.admitConversationChange,
        stopConversationTurn: tasks.stopTurn,
      });
    };
    const reconcile = async (messageId: number, topicId?: string) => {
      const row = f.db.prepare("SELECT id FROM app_inbox_items WHERE source_id = ?")
        .get(`telegram:123:${messageId}`)!;
      const item = runtime!.host.get(String(row.id))!;
      expect(item.topicId).toBeUndefined(); // Selection is context, not a committed decision.
      expect(item.executionTaskId).toBeDefined();
      const before = seen.length;
      const now = Date.now();
      await reconcileLoadedAppTaskOnce({
        bus: f.bus, appId: "may", taskId: item.executionTaskId!,
        dispatch: { lane: "human", enqueuedAt: now, startedAt: now, readyWaitMs: 0 },
      });
      expect(seen).toHaveLength(before + 1);
      expect(seen.at(-1)!.conversation?.current?.topicId).toBe(topicId);
      expect(runtime!.host.get(String(row.id))?.status).toBe("done");
      expect(runtime!.host.get(String(row.id))?.topicId).toBeUndefined(); // May may choose no Topic.
    };
    try {
      await registry.reload();
      runtime = await start();
      for (const id of ["aaaaaaaa", "bbbbbbbb"]) createConversationTopic(f.db, {
        id: `topic_${id}`, appId: "may", conversationId: "may:primary", title: id,
        openedBy: "human", originMessageId: `origin-${id}`, now: 1,
      });
      await waitFor(() => f.polls().length === 1);
      f.hold((body) => body.text === "Late answer for A" ? held.promise : Promise.resolve());
      f.activity({ type: "conversation.message.created", target: { appId: "may" }, data: {
        conversationId: "may:primary", author: { kind: "agent", id: "may" }, text: "Late answer for A",
        metadata: { channel: "telegram", channelTargetId: "123", topicId: "topic_aaaaaaaa" },
      } });
      await waitFor(() => f.sends().some((call) => call.body.text === "Late answer for A"));
      f.message(100, "/topic bbbbbbbb");
      await waitFor(() => f.published.some((event) => event.data.metadata?.command === "/topic bbbbbbbb"));
      held.resolve();
      const answer = f.sends().find((call) => call.body.text === "Late answer for A")!;
      await waitFor(() => Boolean(f.db.prepare("SELECT 1 FROM notification_messages WHERE chat_id = '123' AND telegram_msg_id = ?")
        .get(answer.messageId)));
      // Exercise an oversized journal body too; selected context must survive admission independently of its preview.
      f.message(101, "Continue B. ".repeat(500));
      await waitFor(() => f.inputs().length === 1);
      expect(f.inputs()[0].data.replyTo).toBeUndefined();
      runtime.close();
      await closeInstalledAppTaskRuntimes(f.bus);
      await f.restart();
      runtime = await start();
      await reconcile(101, "topic_bbbbbbbb");

      // Provider redelivery keeps the saved selection, even though local focus was lost on restart.
      f.message(102, "Changed redelivery text", { message_id: 101 });
      await waitFor(() => f.polls().some((offset) => offset > 102));
      expect(f.db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE source_id = 'telegram:123:101'")
        .get()?.count).toBe(1);
      expect(seen).toHaveLength(1);

      f.message(103, "/topic bbbbbbbb");
      f.message(104, "Yes, that earlier answer", { reply_to_message: { message_id: answer.messageId, text: "Late answer for A" } });
      await waitFor(() => f.inputs().length === 2);
      await reconcile(104, "topic_aaaaaaaa");
      expect(seen.at(-1)!.conversation?.current?.replyTo).toBe(f.inputs()[1].data.replyTo);
      expect(seen.at(-1)!.conversation?.current?.replyTo).toBeDefined();

      f.message(105, "/topic clear");
      f.message(106, "A separate question");
      await waitFor(() => f.inputs().length === 3);
      await reconcile(106);
      expect(seen.at(-1)!.conversation?.current?.replyTo).toBeUndefined();
      expect(seen.at(-1)!.conversation?.messages.some((message) => message.text === "Late answer for A")).toBe(true);

      // Shared admission must not load a missing Topic or one owned by another App/Conversation.
      for (const [id, appId, conversationId] of [
        ["other-app", "other", "may:primary"], ["other-conversation", "may", "may:other"],
      ]) createConversationTopic(f.db, { id, appId, conversationId, title: "Unrelated discussion",
        openedBy: "human", originMessageId: id, now: 1 });
      let messageId = 106;
      for (const topicId of ["missing", "other-app", "other-conversation"]) {
        f.activity({ type: "conversation.message.created", target: { appId: "may" }, data: {
          conversationId: "may:primary", author: { kind: "human", id: `telegram:123:${++messageId}` },
          text: "Discuss this", metadata: { topicId },
        } });
        await reconcile(messageId);
      }
    } finally {
      held.resolve();
      runtime?.close();
      await closeInstalledAppTaskRuntimes(f.bus);
      await f.close();
    }
  });

  it("does not discard an active watch when a command or button tries to follow completed work", async () => {
    const f = durableTelegramFixture();
    try {
      f.tasks.set("second", { ...f.tasks.get("second")!, terminal: true, status: "done", response: "Review complete" });
      createConversationTopic(f.db, { id: "topic_aaaaaaaa", appId: "may", conversationId: "may:primary",
        title: "Active review", openedBy: "human", originMessageId: "origin", now: 1 });
      linkConversationTopicTask(f.db, "topic_aaaaaaaa", "may", "first");
      f.message(100, "/topic aaaaaaaa");
      f.message(101, "/watch first");
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/watch first"));
      storeNotificationMessage(f.root, { chat_id: "123", telegram_msg_id: 55, event_type: "task.watch", agent: "may",
        session_id: null, project_id: null, data: JSON.stringify({ taskRefs: [{ appId: "may", taskId: "second" }] }) });
      f.message(102, "/watch second");
      f.send([{ update_id: 103, callback_query: { id: "finished", data: "task:follow",
        message: { message_id: 55, chat: { id: 123 } } } }]);
      f.message(104, "Continue the active review");
      f.message(105, "/watch");
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/watch"));
      expect(f.published.filter((e) => ["/watch second", "/watch linked"].includes(e.data.metadata?.command)).map((e) => e.data.text))
        .toEqual([expect.stringContaining("terminal"), expect.stringContaining("terminal")]);
      expect(f.inputs()[0].data).toMatchObject({ metadata: { topicId: "topic_aaaaaaaa" },
        context: { focusedApp: "may", focusedTask: { appId: "may", taskId: "first" } } });
      expect(f.published.find((e) => e.data.metadata?.command === "/watch")!.data.text).toContain("Task first");
      expect(f.tasks.get("first")!.status).toBe("running");
    } finally { await f.close(); }
  });

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
      claimNextAppInboxItem(f.db, "may", "fixture", 60_000);
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
          stopAppInboxTurn(f.db, { appId: "may", ...input.data } as Parameters<typeof stopAppInboxTurn>[1]);
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

  it("keeps the clicked task and Topic through Details, Follow, and replies despite an unrelated selection", async () => {
    const f = durableTelegramFixture();
    try {
      for (const id of ["aaaaaaaa", "bbbbbbbb"]) createConversationTopic(f.db, {
        id: `topic_${id}`, appId: "may", conversationId: "may:primary", title: `Subject ${id}`,
        openedBy: "human", originMessageId: `original-${id}`, now: 1,
      });
      f.tasks.set("second", { ...f.tasks.get("second")!, appId: "sample", requestedBy: {
        appId: "may", taskId: "first", ref: "first", outcome: "Review first",
      } });
      f.message(100, "/topic aaaaaaaa");
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/topic aaaaaaaa"));
      storeNotificationMessage(f.root, { chat_id: "123", telegram_msg_id: 55, event_type: "conversation.mirror",
        agent: "may", session_id: null, project_id: null,
        data: JSON.stringify({ topicId: "topic_bbbbbbbb", conversationMessageId: "old-answer",
          taskRefs: [{ appId: "sample", taskId: "second" }] }),
      });
      f.send([{ update_id: 101, callback_query: { id: "details", data: "task:details",
        message: { message_id: 55, chat: { id: 123 } } } }]);
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/task linked"));
      const details = f.published.find((e) => e.data.metadata?.command === "/task linked")!;
      expect(details.data.metadata).toMatchObject({ topicId: "topic_bbbbbbbb",
        followTask: { appId: "sample", taskId: "second" } });
      expect(details.data.metadata.taskRefs).toHaveLength(2); // Related work remains discoverable in Details.
      f.message(102, "Continue the previous topic");
      await waitFor(() => f.inputs().length === 1);
      expect(f.inputs()[0].data.metadata.topicId).toBe("topic_aaaaaaaa"); // Details does not change selection.
      f.send([{ update_id: 103, callback_query: { id: "follow", data: "task:follow",
        message: { message_id: details.data.metadata.channelMessageId, chat: { id: 123 } } } }]);
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/watch linked"));
      const followed = f.published.find((e) => e.data.metadata?.command === "/watch linked")!;
      expect(followed.data.metadata).toMatchObject({ topicId: "topic_bbbbbbbb",
        taskRefs: [{ appId: "sample", taskId: "second" }] });
      f.message(104, "What's next?");
      f.message(105, "Yes, continue", { reply_to_message: {
        message_id: details.data.metadata.channelMessageId, text: details.data.text,
      } });
      await waitFor(() => f.inputs().length === 3);
      for (const input of f.inputs().slice(1)) expect(input.data).toMatchObject({
        metadata: { topicId: "topic_bbbbbbbb" },
        context: { focusedApp: "sample", focusedTask: { appId: "sample", taskId: "second" } },
      });
      // A manual selection without a matching Topic must not retain the old Topic.
      f.activity({ type: "conversation.message.created", target: { appId: "may" }, data: {
        conversationId: "may:primary", author: { kind: "agent", id: "may" }, text: "Earlier subject update",
        metadata: { channel: "telegram", channelTargetId: "123", topicId: "topic_bbbbbbbb" },
      } });
      await waitFor(() => f.sends().some((c) => c.body.text === "Earlier subject update"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      f.message(106, "/watch first");
      f.message(107, "Continue");
      await waitFor(() => f.inputs().length === 4);
      expect(f.inputs()[3].data.metadata.topicId).toBeUndefined();
      expect(f.inputs()[3].data.replyTo).toBeUndefined();
      expect(f.inputs()[3].data.context).toMatchObject({ focusedApp: "may", focusedTask: { taskId: "first" } });
    } finally { await f.close(); }
  });

  it("preserves late-linked Topic context across watch, a stalled progress send, replies, Details, and Follow", async () => {
    const f = durableTelegramFixture();
    const held = Promise.withResolvers<void>();
    try {
      for (const [suffix, taskId] of [["aaaaaaaa", "first"], ["bbbbbbbb", "second"]]) {
        createConversationTopic(f.db, {
          id: `topic_${suffix}`, appId: "may", conversationId: "may:primary", title: `Subject ${suffix}`,
          openedBy: "human", originMessageId: `original-${suffix}`, now: 1,
        });
        if (taskId !== "first") linkConversationTopicTask(f.db, `topic_${suffix}`, "may", taskId);
      }
      f.message(100, "/topic aaaaaaaa", { message_thread_id: 7 });
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/topic aaaaaaaa"));
      // Task admission can append its link after the person selected the Topic.
      linkConversationTopicTask(f.db, "topic_aaaaaaaa", "may", "first");
      f.message(101, "/watch first", { message_thread_id: 7 });
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/watch first"));
      expect(f.published.find((e) => e.data.metadata?.command === "/watch first")!.data.metadata.topicId)
        .toBe("topic_aaaaaaaa");
      let sendStarted = false;
      f.hold(async (body) => {
        if (body.text.includes("Progress while sending")) { sendStarted = true; await held.promise; }
      });
      f.tasks.get("first")!.summary = "Progress while sending";
      const wake = () => f.bus.emit({ type: "project.task.reconciled", source: "fixture",
        owner: "app:may", data: { appId: "may", taskId: "first" } });
      wake();
      await waitFor(() => sendStarted);
      f.message(102, "/topic bbbbbbbb", { message_thread_id: 7 });
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/topic bbbbbbbb"));
      held.resolve();
      await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/watch update"));
      const progress = f.published.find((e) => e.data.metadata?.command === "/watch update")!;
      expect(progress.data.metadata).toMatchObject({ topicId: "topic_aaaaaaaa", channelThreadId: "7",
        taskRefs: [{ appId: "may", taskId: "first" }] });
      const messageId = progress.data.metadata.channelMessageId;
      const row = f.db.prepare("SELECT data FROM notification_messages WHERE chat_id = ? AND telegram_msg_id = ?")
        .get("123", messageId)!;
      expect(JSON.parse(String(row.data))).toMatchObject({ topicId: "topic_aaaaaaaa",
        taskRefs: [{ appId: "may", taskId: "first" }] });
      f.message(103, "Continue this work", { message_thread_id: 7,
        reply_to_message: { message_id: messageId, text: progress.data.text } });
      await waitFor(() => f.inputs().length === 1);
      expect(f.inputs()[0].data).toMatchObject({ metadata: { topicId: "topic_aaaaaaaa" },
        context: { focusedTask: { appId: "may", taskId: "first" } } });

      // Re-following this Task clears the unrelated Topic, including on later updates.
      f.message(104, "/watch first", { message_thread_id: 7 });
      await waitFor(() => f.published.filter((e) => e.data.metadata?.command === "/watch first").length === 2);
      f.tasks.get("first")!.summary = "Progress without a matching Topic";
      wake();
      await waitFor(() => f.published.filter((e) => e.data.metadata?.command === "/watch update").length === 2);
      expect(f.published.filter((e) => e.data.metadata?.command === "/watch update")[1].data.metadata.topicId)
        .toBeUndefined();
      for (const [id, action, command] of [[105, "details", "/task linked"], [106, "follow", "/watch linked"]] as const) {
        f.send([{ update_id: id, callback_query: { id: action, data: `task:${action}`,
          message: { message_id: messageId, chat: { id: 123 }, message_thread_id: 7 } } }]);
        await waitFor(() => f.published.some((e) => e.data.metadata?.command === command));
        expect(f.published.find((e) => e.data.metadata?.command === command)!.data.metadata.topicId)
          .toBe("topic_aaaaaaaa");
      }
      f.message(107, "What's next?", { message_thread_id: 7 });
      await waitFor(() => f.inputs().length === 2);
      expect(f.inputs()[1].data.metadata.topicId).toBe("topic_aaaaaaaa");
    } finally { held.resolve(); await f.close(); }
  });

  for (const { state, completed, loseAcceptance, ok } of [
    { state: "not yet admitted", completed: false, loseAcceptance: false, ok: true },
    { state: "accepted without completion", completed: false, loseAcceptance: false, ok: true },
    { state: "already completed", completed: true, loseAcceptance: false, ok: true },
    { state: "completed with lost acceptance", completed: true, loseAcceptance: true, ok: true },
    { state: "failed with lost acceptance", completed: true, loseAcceptance: true, ok: false },
  ]) {
    it(`returns the exact reload result after restart (${state})`, async () => {
      const f = durableTelegramFixture();
      let router: ReturnType<typeof attachCommandRouter> | undefined;
      let interruptedRoute: (() => void) | undefined;
      const interrupted = state === "accepted without completion";
      let reloads = 0;
      const summary = ok ? "Fixture definitions reloaded" : "Fixture definitions rejected; previous definitions kept";
      const attach = () => attachCommandRouter({ bus: f.bus, manager: {} as never, projectRoot: f.root,
        reload: () => { reloads++; return { ok, summary }; },
        restart() {}, shutdown() {},
      });
      try {
        if (completed) router = attach();
        if (interrupted) {
          // Model the crash boundary: acceptance is durable, but the queued
          // asynchronous reload never executes or records a completion.
          interruptedRoute = f.bus.subscribeDurableRoute((event) => event.type === "runtime.reload.requested"
            ? { accepted: true, by: "command-router:runtime-reload", route: "direct" } : undefined);
        }
        if (loseAcceptance) {
          // Exercise the real writer's swallowed acceptance failure. This
          // connection-local fault disappears when the fixture reopens storage.
          f.db.exec(`CREATE TEMP TRIGGER reject_reload_acceptance
            BEFORE UPDATE OF delivery_status ON events
            WHEN OLD.event_type = 'runtime.reload.requested'
            BEGIN SELECT RAISE(ABORT, 'fixture reload acceptance unavailable'); END`);
        }
        f.afterRecord((input) => {
          if (input.type === "runtime.reload.requested") throw new Error("fixture lost receipt");
        });
        f.message(100, "/reload", { chat: { id: 456 }, message_thread_id: 7 });
        await waitFor(() => f.published.some((e) => e.type === "runtime.reload.requested"));
        if (completed) {
          await waitFor(() => f.published.some((e) => e.data.metadata?.command === "/reload"));
          expect(f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'runtime.reload.finished'").get())
            .toEqual({ count: 1 });
        } else {
          expect(reloads).toBe(0);
          expect(f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'runtime.reload.finished'").get())
            .toEqual({ count: 0 });
          interruptedRoute?.();
          interruptedRoute = undefined;
          router = attach();
        }
        expect(f.db.prepare("SELECT delivery_status FROM events WHERE event_type = 'runtime.reload.requested'").get())
          .toEqual({ delivery_status: (completed && !loseAcceptance) || interrupted ? "accepted" : "pending" });
        const priorSends = f.sends().length;
        await f.restart();
        await waitFor(() => f.polls().includes(101));
        await waitFor(() => f.sends().slice(priorSends).some((c) => c.body.text === summary));
        expect(reloads).toBe(1);
        const replies = f.sends().slice(priorSends).filter((c) => c.body.text === summary);
        expect(replies).toHaveLength(1);
        expect(replies[0].body).toMatchObject({ chat_id: "456", message_thread_id: 7 });
        expect(f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'runtime.reload.requested'").get())
          .toEqual({ count: 1 });
        expect(f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'runtime.reload.finished'").get())
          .toEqual({ count: 1 });
      } finally { interruptedRoute?.(); router?.close(); await f.close(); }
    });
  }

  it.each([
    [undefined, undefined, true],
    ["7", 7, true],
    ["topic:7", undefined, true],
    ["9007199254740993", undefined, true],
    ["topic:7", undefined, false],
  ] as const)("shows one canonical result and ends the watch with stored thread %s, provider thread %s, Task wake %s", async (storedThreadId, providerThreadId, taskWake) => {
    const f = durableTelegramFixture();
    try {
      f.message(100, "/watch first", { message_thread_id: providerThreadId });
      await waitFor(() => f.published.some((input) => input.data.metadata?.command === "/watch first"));
      f.tasks.set("first", { ...f.tasks.get("first")!, status: "done", terminal: true,
        resourceVersion: 2, response: "Review complete: no blocking issues." });
      f.activity({ type: "conversation.message.created", target: { appId: "may" }, data: {
        conversationId: "may:primary", author: { kind: "agent", id: "may" }, text: "Review complete: no blocking issues.",
        metadata: { channel: "telegram", channelTargetId: "123", channelThreadId: storedThreadId,
          taskRefs: [{ appId: "may", taskId: "first" }] },
      } });
      if (taskWake) f.bus.emit({ type: "project.task.reconciled", source: "fixture", owner: "app:may", data: { appId: "may", taskId: "first" } });
      await waitFor(() => f.sends().some((call) => call.body.text.includes("Review complete")));
      await waitFor(() => f.taskReads.filter((id) => id === "first").length >= 2);
      f.message(101, "/watch", { message_thread_id: providerThreadId });
      await waitFor(() => f.sends().some((call) => call.body.text === "No Task is watched. Use /watch <ref>."));
      expect(f.sends().filter((call) => call.body.text.includes("Review complete"))).toHaveLength(1);
      expect(f.sends().find((call) => call.body.text.includes("Review complete"))!.body.message_thread_id).toBe(providerThreadId);
      expect(f.tasks.get("second")?.status).toBe("running");
    } finally { await f.close(); }
  });
});

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
      expect(sent).toContainEqual(expect.stringContaining("evaluation — 1 active"));
      expect(sent).toContainEqual(expect.stringContaining("Task 8f12ac90"));
      expect(sent).toContainEqual(expect.stringContaining("Following updates. Reply here"));

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

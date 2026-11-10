import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../lib/requests.js";
import { DbWriter } from "../../lib/db-writer.js";
import { addLogSubscriber } from "../../lib/log.js";
import {
  prepareConversationDelivery,
  conversationDeliveryId,
  settleConversationDelivery,
} from "../../lib/db/telegram-conversation-deliveries.js";
import { createAppInboxItem } from "../core/state/app-inbox-store.js";
import { EventBus } from "../core/events/bus.js";
import type { EventInput } from "@may-agent/control/events";
import type { HumanTaskView } from "../human-task-service.js";
import { attachTelegramBot } from "./telegram.js";

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for Telegram refresh");
    await Bun.sleep(5);
  }
}

type Send = {
  chat_id: string;
  text: string;
  parse_mode?: string;
  reply_parameters?: { message_id: number };
  reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
};

function exactAction(id: string, requestedAction: string, generation = 1) {
  return {
    humanAction: { requestedAction },
    diagnostics: {
      conditions: [
        {
          id,
          condition: {
            metadata: { id, generation, resourceVersion: generation },
            spec: {
              type: "human.answer.received",
              subject: `id:${id}`,
              owner: "human",
              requestedAction,
              expected: { answer: true },
            },
            status: { state: "false" },
          },
        },
      ],
      conditionsTruncated: false,
    },
  };
}

function fixture(options: { root?: string; removeOnClose?: boolean } = {}) {
  const root = options.root ?? mkdtempSync(join(tmpdir(), "may-telegram-refresh-"));
  const priorFetch = globalThis.fetch;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  const priorChat = process.env.TELEGRAM_CHAT_ID;
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const published: EventInput[] = [];
  const sent: Send[] = [];
  const errors: string[] = [];
  const unsubscribeLog = addLogSubscriber((_level, message) => errors.push(message));
  const reads: string[] = [];
  const listReads: string[] = [];
  const tasks = new Map<string, HumanTaskView>(
    ["first", "second"].map((id) => [
      id,
      {
        appId: "may",
        taskId: id,
        ref: id,
        status: "running",
        generation: 1,
        resourceVersion: 1,
        outcome: `Complete ${id}`,
        summary: `Working on ${id}`,
        updatedAt: 1,
        terminal: false,
        cancellable: true,
      },
    ]),
  );
  type Update = { update_id: number; message: { message_id: number; chat: { id: number }; text: string } };
  let nextUpdate = 0;
  let receive: ((updates: Update[]) => void) | undefined;
  const holds: Array<{
    matches: (send: Send) => boolean;
    started: boolean;
    finished: boolean;
    release: () => void;
    ready: Promise<void>;
  }> = [];
  const readFailures = new Set<string>();
  const sendFailures = new Set<string>();
  const sendRejections = new Set<string>();
  const unsubscribe = bus.subscribe((event) => {
    if (event.type === "info") errors.push(event.message);
  });
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).split("/").at(-1);
    if (method === "getMe") return Response.json({ ok: true, result: { username: "fixture" } });
    if (method === "getUpdates") {
      const updates = await new Promise<Update[]>((resolve) => {
        receive = resolve;
      });
      return Response.json({ ok: true, result: updates });
    }
    if (method === "sendMessage") {
      const body = JSON.parse(String(init?.body)) as Send;
      sent.push(body);
      if ([...sendRejections].some((text) => body.text.includes(text)))
        return Response.json({ ok: false, error_code: 429, description: "fixture rate limit" });
      if ([...sendFailures].some((text) => body.text.includes(text))) throw new Error("fixture send unavailable");
      const messageId = 900 + sent.length;
      const hold = holds.find((candidate) => !candidate.started && candidate.matches(body));
      if (hold) {
        hold.started = true;
        await hold.ready;
        hold.finished = true;
      }
      return Response.json({ ok: true, result: { message_id: messageId } });
    }
    throw new Error(`Unexpected Telegram method ${method}`);
  }) as typeof fetch;
  process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
  process.env.TELEGRAM_CHAT_ID = "123,456";
  const bot = attachTelegramBot({
    bus,
    interfaceAgent: "may",
    conversationAppId: "may",
    persistDir: root,
    humanTasks: {
      getTask: ({ taskId, ref }) => {
        const id = taskId ?? ref ?? "";
        reads.push(id);
        if (readFailures.has(id)) throw new Error("fixture read unavailable");
        const task = tasks.get(id);
        return task ? { ...task } : null;
      },
      listTasks: (input = {}) => {
        listReads.push(input.appId ?? "");
        if (readFailures.has("todo")) throw new Error("fixture todo unavailable");
        const items = [...tasks.values()].filter((task) => task.humanAction && task.appId === input.appId);
        return { items, total: items.length };
      },
      listApps: (appId) => [
        { id: appId ?? "may", activeTasks: 0, attentionTasks: 0, runningTasks: 0, waitingTasks: 0 },
      ],
    },
    publishEvent(input) {
      published.push(input);
      return { eventId: published.length, eventType: input.type, delivery: "accepted" };
    },
  });
  return {
    root,
    bot,
    sent,
    published,
    errors,
    get deliveryFailures() {
      return getDb(root)
        .prepare("SELECT data FROM events WHERE event_type='message.delivery_failed' ORDER BY id")
        .all()
        .map((row) => JSON.parse(String(row.data)) as Record<string, unknown>);
    },
    reads,
    tasks,
    readFailures,
    sendFailures,
    sendRejections,
    listReads,
    ready: () => waitFor(() => receive !== undefined),
    answer(text: string, id = "exact-ask", taskRefs?: Array<{ appId: string; taskId: string }>) {
      saveAddressedAnswer(root, text, id, taskRefs);
    },
    conversation(text: string, sequence: number) {
      createAppInboxItem(getDb(root), {
        id: `console-${sequence}`,
        appId: "may",
        conversationId: "may:primary",
        conversationSequence: sequence,
        source: { kind: "human", id: `console:${sequence}` },
        channel: "may-console",
        input: { kind: "message", data: { message: text } },
        now: sequence,
      });
    },
    consoleView(text: string, command: string, transient: boolean) {
      getDb(root)
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES ('conversation.message.created', 'may-console', 'app:may', ?, ?)`,
        )
        .run(
          JSON.stringify({
            appId: "may",
            conversationId: "may:primary",
            author: { kind: "command", id: "may-console" },
            text,
            ...(transient ? { transient: true } : {}),
            metadata: { channel: "may-console", command },
          }),
          Date.now(),
        );
    },
    wakeConversation() {
      bus.emit({
        type: "conversation.updated",
        source: "fixture",
        owner: "app:may",
        data: { appId: "may", conversationId: "may:primary" },
      });
    },
    hold(matches: (send: Send) => boolean) {
      const { promise, resolve } = Promise.withResolvers<void>();
      const hold = { matches, started: false, finished: false, release: resolve, ready: promise };
      holds.push(hold);
      return hold;
    },
    async command(text: string, chat = 123, waitForRecord = true) {
      await waitFor(() => receive !== undefined);
      const deliver = receive!;
      receive = undefined;
      const id = ++nextUpdate;
      const priorViews = published.length;
      deliver([{ update_id: id, message: { message_id: id, chat: { id: chat }, text } }]);
      if (waitForRecord)
        await waitFor(() =>
          published
            .slice(priorViews)
            .some((event) => (event.data?.metadata as { command?: string } | undefined)?.command === text),
        );
    },
    wake(id: string, count = 1) {
      for (let i = 0; i < count; i++) {
        bus.emit({
          type: "project.task.reconciled",
          source: "fixture",
          owner: "app:may",
          data: { appId: "may", taskId: id },
        });
      }
    },
    async close() {
      bot.close();
      for (const hold of holds) hold.release();
      receive?.([]);
      await Bun.sleep(20);
      unsubscribe();
      unsubscribeLog();
      closeDb(root);
      if (options.removeOnClose !== false) rmSync(root, { recursive: true, force: true });
      globalThis.fetch = priorFetch;
      if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = priorToken;
      if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
      else process.env.TELEGRAM_CHAT_ID = priorChat;
    },
  };
}

function saveAddressedAnswer(
  root: string,
  text: string,
  id = "exact-ask",
  taskRefs?: Array<{ appId: string; taskId: string }>,
) {
  getDb(root)
    .prepare(
      `INSERT INTO events (event_type, source, owner, data, timestamp)
     VALUES ('conversation.message.created', 'app-task', 'app:may', ?, ?)`,
    )
    .run(
      JSON.stringify({
        appId: "may",
        conversationId: "may:primary",
        messageId: `answer:${id}`,
        author: { kind: "agent", id: "may" },
        text,
        metadata: {
          channel: "telegram",
          channelTargetId: "123",
          channelMessageId: 7,
          requestId: id,
          ...(taskRefs ? { taskRefs } : {}),
        },
      }),
      Date.now(),
    );
}

describe("Telegram refresh lifecycle", () => {
  it("exposes a saved addressed answer without inventing delivery or replaying an uncertain send", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-saved-answer-"));
    saveAddressedAnswer(root, "The finite assignment is complete.");
    closeDb(root);
    const f = fixture({ root });
    try {
      await f.ready();
      await waitFor(() => f.deliveryFailures.length === 1);
      expect(f.sent).toHaveLength(0);
      expect(f.deliveryFailures[0]).toMatchObject({
        appId: "may",
        conversationId: "may:primary",
        requestId: "exact-ask",
        conversationMessageId: "answer:exact-ask",
        to: "123",
        deliveryStatus: "uncertain",
        deliveryOperationId: expect.any(String),
        idempotencyKey: expect.any(String),
      });
      expect(getDb(root).prepare("SELECT state FROM telegram_conversation_deliveries").all()).toEqual([
        { state: "uncertain" },
      ]);
      expect(
        getDb(root)
          .prepare(
            "SELECT record_only, delivery_status, delivery_route, accepted_by FROM events WHERE event_type='message.delivery_failed'",
          )
          .get(),
      ).toEqual({
        record_only: 1,
        delivery_status: "accepted",
        delivery_route: "noop",
        accepted_by: "event-interface:record",
      });
    } finally {
      await f.close();
    }
  });

  it("retains a confirmed addressed answer across restart without resending it", async () => {
    const first = fixture({ removeOnClose: false });
    const { root } = first;
    try {
      first.answer("The accepted finite answer.");
      first.wakeConversation();
      await waitFor(
        () =>
          getDb(root).prepare("SELECT 1 FROM telegram_conversation_deliveries WHERE state='delivered'").get() !== null,
      );
      expect(first.sent.filter((send) => send.text.includes("The accepted finite answer."))).toHaveLength(1);
    } finally {
      await first.close();
    }
    const restarted = fixture({ root });
    try {
      await restarted.ready();
      expect(restarted.sent).toHaveLength(0);
      expect(restarted.deliveryFailures).toHaveLength(0);
      expect(
        getDb(root).prepare("SELECT state, external_message_id FROM telegram_conversation_deliveries").get(),
      ).toEqual({ state: "delivered", external_message_id: 901 });
      restarted.answer("A fresh caller after restart.", "new-ask");
      restarted.wakeConversation();
      await waitFor(() => restarted.sent.some((send) => send.text.includes("A fresh caller after restart.")));
      expect(restarted.sent.filter((send) => send.text.includes("The accepted finite answer."))).toHaveLength(0);
    } finally {
      await restarted.close();
    }
  });

  it("retries a confirmed provider rejection after restart using the existing answer", async () => {
    const first = fixture({ removeOnClose: false });
    const { root } = first;
    try {
      first.sendRejections.add("Retry this answer.");
      first.answer("Retry this answer.");
      first.wakeConversation();
      await waitFor(() => first.deliveryFailures.some((failure) => failure.deliveryStatus === "failed"));
      expect(getDb(root).prepare("SELECT state FROM telegram_conversation_deliveries").get()).toEqual({
        state: "failed",
      });
    } finally {
      await first.close();
    }
    const restarted = fixture({ root });
    try {
      await waitFor(
        () => getDb(root).prepare("SELECT state FROM telegram_conversation_deliveries").get()?.state === "delivered",
      );
      expect(restarted.sent.filter((send) => send.text.includes("Retry this answer."))).toHaveLength(1);
      expect(getDb(root).prepare("SELECT COUNT(*) AS n FROM telegram_conversation_deliveries").get()).toEqual({ n: 1 });
    } finally {
      await restarted.close();
    }
  });

  it("uses exact delivery evidence when a stable message identity gets a revised answer", async () => {
    const f = fixture();
    try {
      f.answer("Original accepted answer.");
      f.wakeConversation();
      await waitFor(
        () =>
          getDb(f.root)
            .prepare("SELECT count(*) AS n FROM telegram_conversation_deliveries WHERE state='delivered'")
            .get()?.n === 1,
      );
      f.answer("Revised accepted answer.");
      f.wakeConversation();
      await waitFor(
        () =>
          getDb(f.root)
            .prepare("SELECT count(*) AS n FROM telegram_conversation_deliveries WHERE state='delivered'")
            .get()?.n === 2,
      );
      f.answer("Revised accepted answer.");
      f.answer("A separate caller confirms refresh progress.", "fresh-ask");
      f.wakeConversation();
      await waitFor(
        () =>
          getDb(f.root)
            .prepare("SELECT count(*) AS n FROM telegram_conversation_deliveries WHERE state='delivered'")
            .get()?.n === 3,
      );
      expect(f.sent.map((send) => send.text)).toEqual([
        "Original accepted answer.",
        "Revised accepted answer.",
        "A separate caller confirms refresh progress.",
      ]);
    } finally {
      await f.close();
    }
  });

  it.each(["missing", "sending", "uncertain", "delivered", "failed"] as const)(
    "starts and preserves %s delivery evidence under writer contention without replaying unknown history",
    async (state) => {
      const root = mkdtempSync(join(tmpdir(), "may-telegram-startup-contention-"));
      const text = "Historical answer under contention.";
      saveAddressedAnswer(root, text);
      const delivery = {
        appId: "may",
        conversationId: "may:primary",
        messageId: "answer:exact-ask",
        chatId: "123",
        text,
      };
      if (state !== "missing") {
        expect(prepareConversationDelivery(root, delivery, "fresh")).toEqual({ kind: "send" });
        if (state !== "sending")
          settleConversationDelivery(root, conversationDeliveryId(delivery), {
            state,
            externalMessageId: state === "delivered" ? 901 : undefined,
          });
      }
      const alias = `${root}/.`;
      const writer = getDb(alias);
      getDb(root).exec("PRAGMA busy_timeout = 0");
      const priorFetch = globalThis.fetch;
      const priorToken = process.env.TELEGRAM_BOT_TOKEN;
      const priorChat = process.env.TELEGRAM_CHAT_ID;
      let restarted: ReturnType<typeof fixture> | undefined;
      let locked = false;
      try {
        writer.exec("BEGIN IMMEDIATE");
        locked = true;
        restarted = fixture({ root, removeOnClose: false });
        await restarted.ready();
        if (state !== "delivered")
          await waitFor(() =>
            restarted!.errors.some((error) => error.includes("exact-ask") && error.includes("locked")),
          );
        expect(restarted.sent).toHaveLength(0);
        expect(restarted.deliveryFailures).toHaveLength(0);
        expect(getDb(root).prepare("SELECT state FROM telegram_conversation_deliveries").get()?.state).toBe(
          state === "missing" ? undefined : state,
        );
        writer.exec("ROLLBACK");
        locked = false;
        restarted.answer("A fresh answer after contention.", "new-ask");
        restarted.wakeConversation();
        await waitFor(() => restarted!.sent.some((send) => send.text === "A fresh answer after contention."));
        expect(restarted.sent.filter((send) => send.text === text)).toHaveLength(state === "failed" ? 1 : 0);
        expect(
          getDb(root)
            .prepare("SELECT state FROM telegram_conversation_deliveries WHERE message_id='answer:exact-ask'")
            .get()?.state,
        ).toBe(state === "missing" ? "uncertain" : state === "failed" ? "delivered" : state);
      } finally {
        if (locked) writer.exec("ROLLBACK");
        await restarted?.close();
        closeDb(alias);
        closeDb(root);
        rmSync(root, { recursive: true, force: true });
        globalThis.fetch = priorFetch;
        if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = priorToken;
        if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = priorChat;
      }
    },
  );

  it("keeps the first successful Conversation snapshot historical after startup reads fail", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-startup-read-"));
    saveAddressedAnswer(root, "An answer before the unavailable baseline.");
    getDb(root).exec("ALTER TABLE conversation_topics RENAME TO fixture_hidden_topics");
    const f = fixture({ root });
    try {
      await f.ready();
      f.answer("An answer before baseline recovery.", "during-startup");
      getDb(root).exec("ALTER TABLE fixture_hidden_topics RENAME TO conversation_topics");
      f.wakeConversation();
      await waitFor(
        () =>
          getDb(root)
            .prepare("SELECT count(*) AS n FROM telegram_conversation_deliveries WHERE state='uncertain'")
            .get()?.n === 2,
      );
      expect(f.sent).toHaveLength(0);
      f.answer("A fresh answer after baseline recovery.", "fresh-ask");
      f.wakeConversation();
      await waitFor(
        () =>
          getDb(root)
            .prepare("SELECT state FROM telegram_conversation_deliveries WHERE message_id='answer:fresh-ask'")
            .get()?.state === "delivered",
      );
      expect(f.sent.map((send) => send.text)).toEqual(["A fresh answer after baseline recovery."]);
    } finally {
      await f.close();
    }
  });

  it("skips an unsaved answer claim and delivers the next caller in the same refresh", async () => {
    const f = fixture();
    try {
      getDb(f.root).exec(`CREATE TRIGGER reject_delivery_claim BEFORE INSERT ON telegram_conversation_deliveries
        WHEN NEW.message_id='answer:exact-ask' BEGIN SELECT RAISE(ABORT, 'fixture claim persistence unavailable'); END`);
      getDb(f.root).exec(`CREATE TRIGGER reject_delivery_diagnostic BEFORE INSERT ON events
        WHEN NEW.event_type='message.delivery_failed' BEGIN SELECT RAISE(ABORT, 'fixture diagnostic persistence unavailable'); END`);
      f.answer("Do not send without a claim.");
      f.answer("Another caller has a valid claim.", "other-ask");
      f.wakeConversation();
      await waitFor(() => f.errors.some((error) => error.includes("fixture claim persistence unavailable")));
      await waitFor(
        () =>
          getDb(f.root)
            .prepare("SELECT state FROM telegram_conversation_deliveries WHERE message_id='answer:other-ask'")
            .get()?.state === "delivered",
      );
      expect(f.sent.map((send) => send.text)).toEqual(["Another caller has a valid claim."]);
      expect(f.deliveryFailures).toHaveLength(0);
      expect(
        f.errors.some(
          (error) =>
            error.includes("fixture diagnostic persistence unavailable") &&
            error.includes("exact-ask") &&
            error.includes('"deliveryOperationId":'),
        ),
      ).toBe(true);
      getDb(f.root).exec("DROP TRIGGER reject_delivery_diagnostic");
      f.wakeConversation();
      await waitFor(() => f.deliveryFailures.length === 1);
      expect(f.deliveryFailures[0]).toMatchObject({ requestId: "exact-ask", deliveryStatus: "uncertain" });
      expect(
        getDb(f.root)
          .prepare("SELECT state FROM telegram_conversation_deliveries WHERE message_id='answer:exact-ask'")
          .get(),
      ).toBeNull();
    } finally {
      await f.close();
    }
  });

  it("keeps a sent answer uncertain when its complete receipt cannot be saved", async () => {
    const first = fixture({ removeOnClose: false });
    const { root } = first;
    try {
      getDb(root).exec(`CREATE TRIGGER reject_delivery_receipt BEFORE UPDATE ON telegram_conversation_deliveries
        WHEN NEW.state='delivered' AND NEW.message_id='answer:exact-ask' BEGIN SELECT RAISE(ABORT, 'fixture receipt persistence unavailable'); END`);
      getDb(root).exec(`CREATE TRIGGER reject_delivery_diagnostic BEFORE INSERT ON events
        WHEN NEW.event_type='message.delivery_failed' BEGIN SELECT RAISE(ABORT, 'fixture diagnostic persistence unavailable'); END`);
      first.answer("Sent bytes are not a saved receipt.");
      first.answer("Another caller keeps its receipt.", "other-ask");
      first.wakeConversation();
      await waitFor(() => first.errors.some((error) => error.includes("fixture receipt persistence unavailable")));
      await waitFor(
        () =>
          getDb(root)
            .prepare("SELECT state FROM telegram_conversation_deliveries WHERE message_id='answer:other-ask'")
            .get()?.state === "delivered",
      );
      expect(first.sent.map((send) => send.text)).toEqual([
        "Sent bytes are not a saved receipt.",
        "Another caller keeps its receipt.",
      ]);
      expect(first.deliveryFailures).toHaveLength(0);
      expect(
        first.errors.some(
          (error) =>
            error.includes("fixture diagnostic persistence unavailable") &&
            error.includes("exact-ask") &&
            error.includes('"deliveryOperationId":'),
        ),
      ).toBe(true);
      getDb(root).exec("DROP TRIGGER reject_delivery_diagnostic");
      first.wakeConversation();
      await waitFor(() => first.deliveryFailures.length === 1);
      expect(first.deliveryFailures[0]).toMatchObject({ requestId: "exact-ask", deliveryStatus: "uncertain" });
      expect(
        getDb(root)
          .prepare("SELECT state FROM telegram_conversation_deliveries WHERE message_id='answer:exact-ask'")
          .get(),
      ).toEqual({
        state: "sending",
      });
    } finally {
      await first.close();
    }
    const restarted = fixture({ root });
    try {
      await restarted.ready();
      expect(restarted.sent).toHaveLength(0);
      expect(restarted.deliveryFailures[0]).toMatchObject({ deliveryStatus: "uncertain", requestId: "exact-ask" });
      restarted.answer("A fresh caller after a receipt failure.", "fresh-ask");
      restarted.wakeConversation();
      await waitFor(
        () =>
          getDb(root)
            .prepare("SELECT state FROM telegram_conversation_deliveries WHERE message_id='answer:fresh-ask'")
            .get()?.state === "delivered",
      );
      expect(restarted.sent.map((send) => send.text)).toEqual(["A fresh caller after a receipt failure."]);
      expect(
        getDb(root)
          .prepare("SELECT state FROM telegram_conversation_deliveries WHERE message_id='answer:exact-ask'")
          .get()?.state,
      ).toBe("sending");
    } finally {
      await restarted.close();
    }
  });

  it.each([false, true])(
    "keeps an uncertain send discoverable after restart without repeating confirmed chunks (multipart: %s)",
    async (multipart) => {
      const first = fixture({ removeOnClose: false });
      const { root } = first;
      try {
        const answer = multipart ? `${"a".repeat(4096)}uncertain tail` : "uncertain answer";
        first.sendFailures.add(multipart ? "uncertain tail" : "uncertain answer");
        first.answer(answer);
        first.answer("A separate caller still receives this.", "other-ask");
        first.wakeConversation();
        await waitFor(() => first.deliveryFailures.some((failure) => failure.deliveryStatus === "uncertain"));
        await waitFor(
          () =>
            getDb(root)
              .prepare("SELECT COUNT(*) AS n FROM telegram_conversation_deliveries WHERE state='delivered'")
              .get()?.n === 1,
        );
        expect(first.sent.filter((send) => send.text.includes("A separate caller still receives this."))).toHaveLength(
          1,
        );
      } finally {
        await first.close();
      }
      const restarted = fixture({ root });
      try {
        await restarted.ready();
        restarted.answer("A fresh caller after uncertainty.", "fresh-ask");
        restarted.wakeConversation();
        await waitFor(
          () =>
            getDb(root)
              .prepare("SELECT COUNT(*) AS n FROM telegram_conversation_deliveries WHERE state='delivered'")
              .get()?.n === 2,
        );
        expect(restarted.sent).toHaveLength(1);
        expect(restarted.sent[0]?.text).toBe("A fresh caller after uncertainty.");
        expect(
          restarted.deliveryFailures.some(
            (failure) => failure.requestId === "exact-ask" && failure.deliveryStatus === "uncertain",
          ),
        ).toBe(true);
        expect(getDb(root).prepare("SELECT state FROM telegram_conversation_deliveries ORDER BY state").all()).toEqual([
          { state: "delivered" },
          { state: "delivered" },
          { state: "uncertain" },
        ]);
      } finally {
        await restarted.close();
      }
    },
  );
  it("clears focus when the Task becomes terminal after its addressed answer was delivered", async () => {
    const f = fixture();
    try {
      await f.command("/watch first");
      await f.command("/watch second", 456);
      const answer = "Accepted answer before Task closure.";
      f.answer(answer, "exact-ask", [{ appId: "may", taskId: "first" }]);
      f.wakeConversation();
      await waitFor(
        () => getDb(f.root).prepare("SELECT state FROM telegram_conversation_deliveries").get()?.state === "delivered",
      );
      const priorReads = f.reads.length;
      Object.assign(f.tasks.get("first")!, { terminal: true, status: "done", response: answer });
      f.wake("first");
      await waitFor(() => f.reads.length > priorReads);
      await f.command("A new independent question.", 123, false);
      await waitFor(() => f.published.some((event) => event.data?.text === "A new independent question."));
      const input = f.published.find((event) => event.data?.text === "A new independent question.");
      expect((input?.data?.context as Record<string, unknown>)?.focusedTask).toBeUndefined();
      await f.command("Continue the other Task.", 456, false);
      await waitFor(() => f.published.some((event) => event.data?.text === "Continue the other Task."));
      const other = f.published.find((event) => event.data?.text === "Continue the other Task.");
      expect((other?.data?.context as Record<string, unknown>)?.focusedTask).toEqual({
        appId: "may",
        taskId: "second",
      });
      expect(f.sent.filter((send) => send.text === answer)).toHaveLength(1);
    } finally {
      await f.close();
    }
  });

  it.each(["rejected", "receipt-unavailable"] as const)(
    "keeps focus until the exact revised answer has delivery evidence (%s)",
    async (outcome) => {
      const f = fixture();
      try {
        await f.command("/watch first");
        const refs = [{ appId: "may", taskId: "first" }];
        f.answer("Original answer for this Task.", "exact-ask", refs);
        f.wakeConversation();
        await waitFor(
          () =>
            getDb(f.root)
              .prepare("SELECT count(*) AS n FROM telegram_conversation_deliveries WHERE state='delivered'")
              .get()?.n === 1,
        );
        const answer = "Revised answer that closes this Task.";
        if (outcome === "rejected") f.sendRejections.add(answer);
        else
          getDb(f.root).exec(`CREATE TRIGGER reject_revised_receipt BEFORE UPDATE ON telegram_conversation_deliveries
        WHEN NEW.state='delivered' BEGIN SELECT RAISE(ABORT, 'fixture revised receipt unavailable'); END`);
        f.answer(answer, "exact-ask", refs);
        f.wakeConversation();
        await waitFor(
          () =>
            getDb(f.root)
              .prepare("SELECT count(*) AS n FROM telegram_conversation_deliveries WHERE state=?")
              .get(outcome === "rejected" ? "failed" : "sending")?.n === 1,
        );
        const priorReads = f.reads.length;
        Object.assign(f.tasks.get("first")!, { terminal: true, status: "done", response: answer });
        f.wake("first");
        await waitFor(() => f.reads.length > priorReads);
        await f.command("Follow up before delivery is confirmed.", 123, false);
        await waitFor(() =>
          f.published.some((event) => event.data?.text === "Follow up before delivery is confirmed."),
        );
        const input = f.published.find((event) => event.data?.text === "Follow up before delivery is confirmed.");
        expect((input?.data?.context as Record<string, unknown>)?.focusedTask).toEqual({
          appId: "may",
          taskId: "first",
        });
        expect(
          getDb(f.root)
            .prepare("SELECT count(*) AS n FROM telegram_conversation_deliveries WHERE state='delivered'")
            .get()?.n,
        ).toBe(1);
      } finally {
        await f.close();
      }
    },
  );

  it.each(["second", "first"])("restores the new %s watch after an old terminal send finishes", async (next) => {
    const f = fixture();
    try {
      await f.command("/watch first");
      Object.assign(f.tasks.get("first")!, { terminal: true, status: "done", summary: "Old terminal result" });
      const old = f.hold((send) => !send.reply_parameters && send.text.includes("Old terminal result"));
      f.wake("first");
      await waitFor(() => old.started);

      // Re-watching the same Task is a new selection too, even if its identity matches.
      Object.assign(f.tasks.get("first")!, { terminal: false, status: "running", summary: "New generation" });
      const restoredText = next === "first" ? "New generation" : "Working on second";
      await f.command(`/watch ${next}`);
      expect(f.sent.filter((send) => send.text.includes(restoredText))).toHaveLength(1);

      old.release();
      await waitFor(() => old.finished);
      await waitFor(() => f.sent.filter((send) => send.text.includes(restoredText)).length === 2);
      expect(f.sent.at(-1)?.text).toContain(restoredText);
    } finally {
      await f.close();
    }
  });

  it("rechecks a stalled watch command before recording or caching its presentation", async () => {
    const f = fixture();
    try {
      const held = f.hold((send) => Boolean(send.reply_parameters) && send.text.includes("Working on first"));
      await f.command("/watch first", 123, false);
      await waitFor(() => held.started);

      Object.assign(f.tasks.get("first")!, {
        terminal: true,
        status: "done",
        summary: "Terminal during watch command",
        resourceVersion: 2,
      });
      held.release();

      await waitFor(() => f.sent.some((send) => send.text.includes("Terminal during watch command")));
      const watchRecords = f.published.filter(
        (event) =>
          event.type === "conversation.message.created" &&
          (event.data?.metadata as { command?: string } | undefined)?.command === "/watch update",
      );
      expect(watchRecords.map((event) => event.data?.text)).toEqual([
        expect.stringContaining("Terminal during watch command"),
      ]);
    } finally {
      await f.close();
    }
  });

  it.each([false, true])(
    "rechecks a stalled bare watch command and commits terminal state (wake=%s)",
    async (wakeWhileStalled) => {
      const f = fixture();
      try {
        await f.command("/watch first");
        const held = f.hold((send) => Boolean(send.reply_parameters) && send.text.includes("Working on first"));
        await f.command("/watch", 123, false);
        await waitFor(() => held.started);

        Object.assign(f.tasks.get("first")!, {
          terminal: true,
          status: "done",
          summary: "Terminal during bare watch command",
          resourceVersion: 2,
        });
        if (wakeWhileStalled) f.wake("first");
        held.release();

        await waitFor(() => f.sent.some((send) => send.text.includes("Terminal during bare watch command")));
        const records = f.published.filter((event) => event.type === "conversation.message.created");
        expect(
          records.filter((event) => (event.data?.metadata as { command?: string } | undefined)?.command === "/watch"),
        ).toHaveLength(0);
        expect(
          records
            .filter((event) => (event.data?.metadata as { command?: string } | undefined)?.command === "/watch update")
            .map((event) => event.data?.text),
        ).toEqual([expect.stringContaining("Terminal during bare watch command")]);
      } finally {
        await f.close();
      }
    },
  );

  it("rechecks a watched Task after a stalled send and commits only its fresh terminal state", async () => {
    const f = fixture();
    try {
      await f.command("/watch first");
      f.tasks.get("first")!.summary = "Stale progress";
      const held = f.hold((send) => !send.reply_parameters && send.text.includes("Stale progress"));
      f.wake("first");
      await waitFor(() => held.started);

      Object.assign(f.tasks.get("first")!, {
        terminal: true,
        status: "done",
        summary: "Fresh terminal result",
        resourceVersion: 2,
      });
      // Force the queue-dirty interleaving while provider I/O is still pending.
      f.wake("first");
      held.release();

      await waitFor(() => f.sent.some((send) => send.text.includes("Fresh terminal result")));
      const watchRecords = f.published.filter(
        (event) =>
          event.type === "conversation.message.created" &&
          (event.data?.metadata as { command?: string } | undefined)?.command === "/watch update",
      );
      expect(watchRecords.map((event) => event.data?.text)).toEqual([expect.stringContaining("Fresh terminal result")]);
      expect(f.sent.filter((send) => send.text.includes("Fresh terminal result"))).toHaveLength(1);
      await f.command("/watch");
      expect(f.sent.at(-1)?.text).toContain("No Task is watched");
    } finally {
      await f.close();
    }
  });

  it("resends an already-shown presentation after a stalled send becomes stale", async () => {
    const f = fixture();
    try {
      f.tasks.get("first")!.summary = "Presentation A";
      await f.command("/watch first");
      expect(f.sent.filter((send) => send.text.includes("Presentation A"))).toHaveLength(1);

      f.tasks.get("first")!.summary = "Presentation B";
      const held = f.hold((send) => !send.reply_parameters && send.text.includes("Presentation B"));
      f.wake("first");
      await waitFor(() => held.started);

      // Return to the cached presentation while B is in flight. The stale B
      // acknowledgement must invalidate A's cache so the refresh restores A.
      f.tasks.get("first")!.summary = "Presentation A";
      held.release();

      await waitFor(() => f.sent.filter((send) => send.text.includes("Presentation A")).length === 2);
      const watchRecords = f.published.filter(
        (event) =>
          event.type === "conversation.message.created" &&
          (event.data?.metadata as { command?: string } | undefined)?.command === "/watch update",
      );
      expect(watchRecords.map((event) => event.data?.text)).toEqual([expect.stringContaining("Presentation A")]);
      expect(watchRecords.some((event) => String(event.data?.text).includes("Presentation B"))).toBe(false);
    } finally {
      await f.close();
    }
  });

  it("does not run a dirty watch refresh after close", async () => {
    const f = fixture();
    try {
      await f.command("/watch first");
      f.tasks.get("first")!.summary = "Refresh in flight";
      const held = f.hold((send) => !send.reply_parameters && send.text.includes("Refresh in flight"));
      f.wake("first");
      await waitFor(() => held.started);
      f.tasks.get("first")!.summary = "Must not send after close";
      f.wake("first", 10);
      await Bun.sleep(25);
      const reads = f.reads.length;
      f.bot.close();
      held.release();
      await waitFor(() => held.finished);
      await Bun.sleep(25);
      expect(f.reads).toHaveLength(reads);
      expect(f.sent.some((send) => send.text.includes("Must not send after close"))).toBe(false);
    } finally {
      await f.close();
    }
  });

  it("coalesces watch updates during sends without blocking another chat", async () => {
    const f = fixture();
    try {
      await f.command("/watch first");
      await f.command("/watch second", 456);
      f.tasks.get("first")!.summary = "First refresh";
      const held = f.hold((send) => !send.reply_parameters && send.chat_id === "123");
      const baseline = f.reads.length;
      f.wake("first", 20);
      await waitFor(() => held.started);
      f.tasks.get("first")!.summary = "Latest refresh";
      f.wake("first", 20);
      f.tasks.get("second")!.summary = "Independent chat";
      f.wake("second");
      await waitFor(() => f.sent.some((send) => send.chat_id === "456" && send.text.includes("Independent chat")));
      // Each completed provider send now has a post-I/O canonical Task read.
      expect(f.reads).toHaveLength(baseline + 3);
      held.release();
      await waitFor(() => f.sent.some((send) => send.text.includes("Latest refresh")));
      await Bun.sleep(25);
      expect(f.reads).toHaveLength(baseline + 6);
      expect(f.sent.filter((send) => send.text.includes("Latest refresh"))).toHaveLength(1);
      f.wake("first", 20);
      await Bun.sleep(25);
      expect(f.sent.filter((send) => send.text.includes("Latest refresh"))).toHaveLength(1);
    } finally {
      await f.close();
    }
  });

  it("reports failed reads and sends, and retries only when another event arrives", async () => {
    const f = fixture();
    try {
      await f.command("/watch first");
      await Bun.sleep(20);
      f.readFailures.add("first");
      f.readFailures.add("todo");
      f.wake("first");
      await waitFor(() => f.errors.some((text) => text.includes("Watch refresh failed: fixture read unavailable")));
      await waitFor(() => f.errors.some((text) => text.includes("Todo refresh failed: fixture todo unavailable")));
      const reads = f.reads.length;
      const listReads = f.listReads.length;
      await Bun.sleep(30);
      expect(f.reads).toHaveLength(reads);
      expect(f.listReads).toHaveLength(listReads);

      f.readFailures.clear();
      f.tasks.get("first")!.summary = "Send this update";
      f.sendFailures.add("Send this update");
      f.wake("first");
      await waitFor(() => f.errors.some((text) => text.includes("Send failed: fixture send unavailable")));
      const sends = f.sent.length;
      await Bun.sleep(30);
      expect(f.sent).toHaveLength(sends);
      f.sendFailures.clear();
      f.wake("first");
      await waitFor(() => f.sent.length === sends + 1);
      expect(f.sent.at(-1)?.text).toContain("Send this update");
    } finally {
      await f.close();
    }
  });

  it("keeps automatic Console todo channel-local while native alerts and explicit cross-channel views remain", async () => {
    const f = fixture();
    try {
      await f.command("/apps may");
      Object.assign(f.tasks.get("first")!, {
        humanAction: { requestedAction: "Run the already-authorized maintenance step." },
      });
      f.consoleView("[todo] automatic Console alert", "/todo notification", true);
      f.consoleView("Explicit Console /todo result", "/todo", false);
      f.conversation("Explicit cross-channel human message", 20);

      f.wakeConversation();
      f.wake("first");
      await waitFor(
        () =>
          f.sent.some((send) => send.text.includes("Explicit Console /todo result")) &&
          f.sent.some((send) => send.text.includes("Explicit cross-channel human message")) &&
          ["123", "456"].every((chatId) =>
            f.sent.some(
              (send) => send.chat_id === chatId && send.text.includes("Run the already-authorized maintenance step."),
            ),
          ),
      );

      expect(f.sent.some((send) => send.text.includes("automatic Console alert"))).toBe(false);
      for (const chatId of ["123", "456"]) {
        expect(
          f.sent.filter(
            (send) => send.chat_id === chatId && send.text.includes("Run the already-authorized maintenance step."),
          ),
        ).toHaveLength(1);
      }
      expect(f.sent).toContainEqual(expect.objectContaining({ text: expect.stringContaining("Needs your action") }));
      expect(f.sent.some((send) => send.text.includes("How to respond"))).toBe(true);
    } finally {
      await f.close();
    }
  });

  it("keeps complete and independent Condition actions in native alerts and watch updates", async () => {
    const f = fixture();
    const longAction =
      "Inspect the approved maintenance procedure and retain the exact evidence. ".repeat(5) +
      "IMPORTANT: preserve existing creators and report completion only after independent verification.";
    const independentAction = "Independent blocker: provide the rollback observation window.";
    const condition = (id: string, requestedAction: string, approval = false) => ({
      id,
      condition: {
        metadata: { id, generation: 1, resourceVersion: 1 },
        spec: {
          type: approval ? "project.approval.submitted" : "human.answer.received",
          subject: `id:${id}`,
          owner: "human",
          requestedAction,
          expected: {
            answer: true,
            ...(approval
              ? { allowedDecisions: ["approve", "reject", "defer"], approvalId: id, taskGeneration: 1, conditionId: id }
              : {}),
          },
        },
        status: { state: "false" },
      },
    });
    const task = f.tasks.get("first")!;
    try {
      Object.assign(task, {
        humanAction: { requestedAction: `${longAction.slice(0, 220)}…` },
        diagnostics: {
          conditions: [condition("long-action", longAction), condition("independent", independentAction)],
        },
      });
      await f.command("/apps may");
      f.wake("first");
      await waitFor(() =>
        f.sent.some((send) => send.text.startsWith("Needs your action") && send.text.includes("IMPORTANT:")),
      );
      const generalAlert = f.sent.find(
        (send) => send.text.startsWith("Needs your action") && send.text.includes("IMPORTANT:"),
      )!;
      expect(generalAlert.text).toContain(independentAction);

      const decisionAction = "Approve only candidate A with the documented scope.";
      Object.assign(task, {
        resourceVersion: 2,
        updatedAt: 2,
        humanAction: { requestedAction: `${decisionAction} ${independentAction}` },
        diagnostics: {
          conditions: [condition("approval-a", decisionAction, true), condition("independent", independentAction)],
        },
      });
      f.wake("first");
      await waitFor(() =>
        f.sent.some((send) => send.text.startsWith("Needs your decision") && send.text.includes(independentAction)),
      );
      const approvalAlert = f.sent.find(
        (send) => send.text.startsWith("Needs your decision") && send.text.includes(independentAction),
      )!;
      expect(approvalAlert.text).toContain(decisionAction);
      expect(approvalAlert.text).toContain("Other action needed (separate from this decision)");
      expect(approvalAlert.text).toContain("How to respond");

      await f.command("/watch first");
      Object.assign(task, {
        resourceVersion: 3,
        updatedAt: 3,
        progress: { stage: "intermediate", message: "General actions changed", updatedAt: 3 },
        humanAction: { requestedAction: `${longAction.slice(0, 220)}…` },
        diagnostics: {
          conditions: [condition("long-action", longAction), condition("independent", independentAction)],
        },
      });
      f.wake("first");
      await waitFor(() =>
        f.sent.some((send) => send.text.includes("General actions changed") && send.text.includes("IMPORTANT:")),
      );
      const generalUpdate = f.sent.find(
        (send) => send.text.includes("General actions changed") && send.text.includes("IMPORTANT:"),
      )!;
      expect(generalUpdate.text).toContain(independentAction);

      Object.assign(task, {
        resourceVersion: 4,
        updatedAt: 4,
        progress: { stage: "intermediate", message: "Approval and blocker changed", updatedAt: 4 },
        humanAction: { requestedAction: `${decisionAction} ${independentAction}` },
        diagnostics: {
          conditions: [condition("approval-a", decisionAction, true), condition("independent", independentAction)],
        },
      });
      f.wake("first");
      await waitFor(() =>
        f.sent.some(
          (send) => send.text.includes("Approval and blocker changed") && send.text.includes(independentAction),
        ),
      );
      const approvalUpdate = f.sent.find(
        (send) => send.text.includes("Approval and blocker changed") && send.text.includes(independentAction),
      )!;
      expect(approvalUpdate.text).toContain(`Decision needed\n${decisionAction}`);
      expect(approvalUpdate.text).toContain("Other action needed (separate from this decision)");
      expect(approvalUpdate.text).toContain("How to respond");
    } finally {
      await f.close();
    }
  });

  it("uses complete receipts after restart but keeps changed actions eligible", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-restart-action-"));
    const action = (generation: number, requestedAction: string) => ({
      humanAction: { requestedAction },
      diagnostics: {
        conditions: [
          {
            id: "operator-step",
            condition: {
              metadata: { id: "operator-step", generation, resourceVersion: generation },
              spec: {
                type: "human.answer.received",
                subject: "id:operator-step",
                owner: "human",
                requestedAction,
                expected: { answer: true },
              },
              status: { state: "false" },
            },
          },
        ],
        conditionsTruncated: false,
      },
    });
    const first = fixture({ root, removeOnClose: false });
    try {
      await first.command("/apps may");
      Object.assign(first.tasks.get("first")!, action(1, "Run the verified operator step."));
      first.wake("first");
      await waitFor(() => first.sent.some((send) => send.text.includes("Run the verified operator step.")));
    } finally {
      await first.close();
    }

    const restarted = fixture({ root });
    try {
      Object.assign(restarted.tasks.get("first")!, action(1, "Run the verified operator step."));
      restarted.wake("first");
      await Bun.sleep(40);
      expect(restarted.sent.some((send) => send.text.includes("Run the verified operator step."))).toBe(false);

      // The exact completed receipt is cached after the first restart read, so
      // a later wake does not need that durable row to suppress the same action.
      getDb(root).run("DELETE FROM notification_messages");
      restarted.wake("first");
      await Bun.sleep(40);
      expect(restarted.sent.some((send) => send.text.includes("Run the verified operator step."))).toBe(false);

      restarted.tasks.get("first")!.diagnostics!.conditions.push({ id: "missing-condition", condition: null });
      restarted.wake("first");
      await waitFor(() => restarted.sent.some((send) => send.text.includes("Run the verified operator step.")));
      const missingConditionBaseline = restarted.sent.length;
      restarted.wake("first");
      await Bun.sleep(40);
      expect(restarted.sent).toHaveLength(missingConditionBaseline);

      restarted.tasks.get("first")!.diagnostics!.conditions.pop();
      restarted.tasks.get("first")!.diagnostics!.conditionsTruncated = true;
      restarted.tasks.get("first")!.diagnostics!.conditions[0]!.condition!.metadata.generation = 2;
      restarted.wake("first");
      await waitFor(() => restarted.sent.length > missingConditionBaseline);
      const incompleteBaseline = restarted.sent.length;
      restarted.wake("first");
      await Bun.sleep(40);
      expect(restarted.sent).toHaveLength(incompleteBaseline);

      await restarted.command("/todo");
      await waitFor(() => restarted.sent.some((send) => send.text.includes("Needs you for may")));

      Object.assign(restarted.tasks.get("first")!, action(2, "Run the changed operator step."));
      restarted.wake("first");
      await waitFor(() => restarted.sent.some((send) => send.text.includes("Run the changed operator step.")));
    } finally {
      await restarted.close();
    }
  });

  it("retains exact receipt suppression when another action send fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-mixed-action-failure-"));
    const exactAction = {
      humanAction: { requestedAction: "Keep the completed receipt suppressed." },
      diagnostics: {
        conditions: [
          {
            id: "completed-step",
            condition: {
              metadata: { id: "completed-step", generation: 1, resourceVersion: 1 },
              spec: {
                type: "human.answer.received",
                subject: "id:completed-step",
                owner: "human",
                requestedAction: "Keep the completed receipt suppressed.",
                expected: { answer: true },
              },
              status: { state: "false" },
            },
          },
        ],
        conditionsTruncated: false,
      },
    };
    const first = fixture({ root, removeOnClose: false });
    try {
      Object.assign(first.tasks.get("first")!, exactAction);
      first.wake("first");
      await waitFor(() =>
        ["123", "456"].every((chat) =>
          first.sent.some(
            (send) => send.chat_id === chat && send.text.includes("Keep the completed receipt suppressed."),
          ),
        ),
      );
    } finally {
      await first.close();
    }

    const restarted = fixture({ root });
    try {
      Object.assign(restarted.tasks.get("first")!, exactAction);
      restarted.tasks.get("second")!.humanAction = { requestedAction: "Retry the unrelated failed action." };
      restarted.sendFailures.add("Retry the unrelated failed action.");
      restarted.wake("second");
      await waitFor(() => restarted.errors.filter((text) => text.includes("Send failed")).length >= 2);

      getDb(root).run("DELETE FROM notification_messages");
      delete restarted.tasks.get("second")!.humanAction;
      const failedBaseline = restarted.sent.length;
      restarted.wake("first");
      await Bun.sleep(40);
      expect(restarted.sent).toHaveLength(failedBaseline);

      restarted.sendFailures.clear();
      restarted.tasks.get("second")!.humanAction = { requestedAction: "Retry the unrelated failed action." };
      restarted.wake("second");
      await waitFor(() => restarted.sent.length >= failedBaseline + 2);
      expect(
        restarted.sent
          .slice(failedBaseline)
          .every(
            (send) =>
              send.text.includes("Retry the unrelated failed action.") &&
              !send.text.includes("Keep the completed receipt suppressed."),
          ),
      ).toBe(true);
    } finally {
      await restarted.close();
    }
  });

  it("durably suppresses an unchanged aggregate after restart", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-telegram-aggregate-restart-"));
    const first = fixture({ root, removeOnClose: false });
    try {
      Object.assign(first.tasks.get("first")!, exactAction("first-step", "Complete first exact step."));
      Object.assign(first.tasks.get("second")!, exactAction("second-step", "Complete second exact step."));
      first.wake("first");
      await waitFor(() => first.sent.filter((send) => send.text.includes("Complete first exact step.")).length === 2);
      expect(first.sent.filter((send) => send.text.includes("Complete second exact step."))).toHaveLength(2);
      expect(first.sent[0]?.parse_mode).toBe("HTML");
      expect(first.sent[0]?.reply_markup?.inline_keyboard).toHaveLength(2);
    } finally {
      await first.close();
    }

    const restarted = fixture({ root });
    try {
      Object.assign(restarted.tasks.get("first")!, exactAction("first-step", "Complete first exact step."));
      Object.assign(restarted.tasks.get("second")!, exactAction("second-step", "Complete second exact step."));
      restarted.wake("first");
      await Bun.sleep(40);
      expect(restarted.sent.some((send) => send.text.includes("Complete first exact step."))).toBe(false);
      expect(restarted.sent.some((send) => send.text.includes("Complete second exact step."))).toBe(false);
    } finally {
      await restarted.close();
    }
  });

  it("ignores resource-only reconciliation and renders only one changed action", async () => {
    const f = fixture();
    try {
      Object.assign(f.tasks.get("first")!, exactAction("first-step", "Leave first action unchanged."));
      Object.assign(f.tasks.get("second")!, exactAction("second-step", "Leave second action unchanged."));
      f.wake("first");
      await waitFor(() => f.sent.filter((send) => send.text.includes("Leave first action unchanged.")).length === 2);
      const baseline = f.sent.length;

      f.tasks.get("first")!.resourceVersion = 99;
      f.tasks.get("second")!.resourceVersion = 100;
      f.wake("first");
      await Bun.sleep(40);
      expect(f.sent).toHaveLength(baseline);

      Object.assign(f.tasks.get("second")!, exactAction("second-step", "Perform the materially changed action.", 2));
      f.wake("second");
      await waitFor(() => f.sent.length === baseline + 2);
      expect(
        f.sent
          .slice(baseline)
          .every(
            (send) =>
              send.text.includes("Perform the materially changed action.") &&
              !send.text.includes("Leave first action unchanged."),
          ),
      ).toBe(true);
    } finally {
      await f.close();
    }
  });

  it("renders several changed actions without unchanged actions", async () => {
    const f = fixture();
    try {
      f.tasks.set("third", {
        ...f.tasks.get("second")!,
        taskId: "third",
        ref: "third",
        outcome: "Complete third",
        summary: "Working on third",
      });
      Object.assign(f.tasks.get("first")!, exactAction("first-step", "Keep first unchanged."));
      Object.assign(f.tasks.get("second")!, exactAction("second-step", "Keep second unchanged."));
      Object.assign(f.tasks.get("third")!, exactAction("third-step", "Keep third unchanged."));
      f.wake("first");
      await waitFor(() => f.sent.filter((send) => send.text.includes("Keep third unchanged.")).length === 2);
      const baseline = f.sent.length;

      Object.assign(f.tasks.get("second")!, exactAction("second-step", "Second changed action.", 2));
      Object.assign(f.tasks.get("third")!, exactAction("third-step", "Third changed action.", 2));
      f.wake("second");
      await waitFor(() => f.sent.length === baseline + 2);
      expect(
        f.sent
          .slice(baseline)
          .every(
            (send) =>
              send.text.includes("Second changed action.") &&
              send.text.includes("Third changed action.") &&
              !send.text.includes("Keep first unchanged."),
          ),
      ).toBe(true);
    } finally {
      await f.close();
    }
  });

  it("retries every exact action after a failed aggregate delivery", async () => {
    const f = fixture();
    try {
      Object.assign(f.tasks.get("first")!, exactAction("first-step", "Retry first aggregate action."));
      Object.assign(f.tasks.get("second")!, exactAction("second-step", "Retry second aggregate action."));
      f.sendFailures.add("Retry first aggregate action.");
      f.wake("first");
      await waitFor(() => f.errors.filter((text) => text.includes("Send failed")).length >= 2);
      const baseline = f.sent.length;

      f.sendFailures.clear();
      f.wake("first");
      await waitFor(() => f.sent.length === baseline + 2);
      expect(
        f.sent
          .slice(baseline)
          .every(
            (send) =>
              send.text.includes("Retry first aggregate action.") &&
              send.text.includes("Retry second aggregate action."),
          ),
      ).toBe(true);
    } finally {
      await f.close();
    }
  });

  it("deduplicates an unchanged fallback presentation only after a successful send", async () => {
    const f = fixture();
    const task = f.tasks.get("first")!;
    try {
      await f.command("/apps may");
      Object.assign(task, { humanAction: { requestedAction: "Run the fallback operator step." } });
      f.wake("first");
      await waitFor(() =>
        ["123", "456"].every((chat) =>
          f.sent.some((send) => send.chat_id === chat && send.text.includes("Run the fallback operator step.")),
        ),
      );
      const successfulBaseline = f.sent.filter((send) => send.text.includes("Run the fallback operator step.")).length;
      f.wake("first");
      await Bun.sleep(40);
      expect(f.sent.filter((send) => send.text.includes("Run the fallback operator step."))).toHaveLength(
        successfulBaseline,
      );

      task.generation = 2;
      f.wake("first");
      await waitFor(
        () =>
          f.sent.filter((send) => send.text.includes("Run the fallback operator step.")).length > successfulBaseline,
      );

      task.humanAction = { requestedAction: "Retry the changed fallback step." };
      f.sendFailures.add("Retry the changed fallback step.");
      f.wake("first");
      await waitFor(
        () => f.errors.filter((text) => text.includes("Send failed: fixture send unavailable")).length >= 2,
      );
      const failedBaseline = f.sent.filter((send) => send.text.includes("Retry the changed fallback step.")).length;
      f.sendFailures.clear();
      f.wake("first");
      await waitFor(
        () =>
          f.sent.filter((send) => send.text.includes("Retry the changed fallback step.")).length >= failedBaseline + 2,
      );
    } finally {
      await f.close();
    }
  });

  it("keeps a manual fallback read separate from automatic delivery deduplication", async () => {
    const f = fixture();
    const action = "Use the unchanged fallback action.";
    try {
      // Finish both configured chats' initial empty refresh before testing manual reads.
      await waitFor(() => f.listReads.length === 2);
      f.tasks.get("first")!.humanAction = { requestedAction: action };

      await f.command("/todo");
      expect(f.sent.filter((send) => send.chat_id === "123" && send.text.includes(action))).toHaveLength(1);

      f.wake("first");
      await waitFor(() => f.sent.filter((send) => send.chat_id === "123" && send.text.includes(action)).length === 2);
      expect(f.reads).toContain("first");

      f.wake("first");
      await Bun.sleep(40);
      expect(f.sent.filter((send) => send.chat_id === "123" && send.text.includes(action))).toHaveLength(2);
    } finally {
      await f.close();
    }
  });

  it("delivers an explicit todo directly from its list snapshot without detail reads", async () => {
    const f = fixture();
    try {
      // Finish both configured chats' initial empty refresh before testing manual reads.
      await waitFor(() => f.listReads.length === 2);
      f.tasks.get("first")!.humanAction = { requestedAction: "Use the readable compact action." };
      f.readFailures.add("first");
      await f.command("/todo");
      expect(
        f.sent.some((send) => send.chat_id === "123" && send.text.includes("Use the readable compact action.")),
      ).toBe(true);
      expect(f.reads).not.toContain("first");
    } finally {
      await f.close();
    }
  });

  it("keeps a failed watched action eligible after unwatch", async () => {
    const f = fixture();
    const action = "Watch failure must not mark this action presented.";
    try {
      await f.command("/watch first");
      f.sendFailures.add(action);
      f.tasks.get("first")!.humanAction = { requestedAction: action };
      f.wake("first");
      await waitFor(() => f.errors.some((text) => text.includes("Send failed: fixture send unavailable")));
      await f.command("/unwatch");
      const failedAttempts = f.sent.filter((send) => send.chat_id === "123" && send.text.includes(action)).length;
      f.sendFailures.clear();
      f.wake("first");
      await waitFor(
        () => f.sent.filter((send) => send.chat_id === "123" && send.text.includes(action)).length > failedAttempts,
      );
    } finally {
      await f.close();
    }
  });

  it.each([false, true])("keeps a successfully watched %s action quiet after unwatch", async (exact) => {
    const f = fixture();
    const action = exact ? "Keep the exact watched action quiet." : "Keep the fallback watched action quiet.";
    try {
      await f.command("/watch first");
      Object.assign(f.tasks.get("first")!, {
        humanAction: { requestedAction: action },
        ...(exact
          ? {
              diagnostics: {
                conditions: [
                  {
                    id: "watched-action",
                    condition: {
                      metadata: { id: "watched-action", generation: 1, resourceVersion: 1 },
                      spec: {
                        type: "human.answer.received",
                        subject: "id:watched-action",
                        owner: "human",
                        requestedAction: action,
                        expected: { answer: true },
                      },
                      status: { state: "false" },
                    },
                  },
                ],
                conditionsTruncated: false,
              },
            }
          : {}),
      });
      f.wake("first");
      const shown = () => f.sent.filter((send) => send.chat_id === "123" && send.text.includes(action)).length;
      await waitFor(() => shown() === 1);
      const completedReceipts = (
        getDb(f.root).prepare("SELECT data FROM notification_messages WHERE chat_id = '123'").all() as Array<{
          data: string;
        }>
      ).filter((row) => JSON.parse(row.data).completedHumanAction);
      expect(completedReceipts).toHaveLength(exact ? 1 : 0);

      await f.command("/unwatch");
      f.wake("first");
      await Bun.sleep(40);
      expect(shown()).toBe(1);
    } finally {
      await f.close();
    }
  });

  it("refreshes watch only for presented meaning, dependencies, or reply authority", async () => {
    const f = fixture();
    try {
      await f.command("/watch first");
      const task = f.tasks.get("first")!;
      const baseline = f.sent.length;
      Object.assign(task, {
        resourceVersion: 8,
        updatedAt: 8,
        facts: ["internal-only"],
        execution: { attemptId: "replacement-attempt", sessionId: "replacement-session" },
        progress: { stage: "working", message: "Working on first", updatedAt: 8 },
      });
      f.wake("first");
      await Bun.sleep(30);
      expect(f.sent).toHaveLength(baseline);

      task.progress = { stage: "working", message: "A user-visible milestone completed", updatedAt: 9 };
      f.wake("first");
      await waitFor(() => f.sent.some((send) => send.text.includes("A user-visible milestone completed")));

      task.waitingOn = [
        {
          kind: "task",
          appId: "evaluation",
          taskId: "independent",
          ref: "deadbeef",
          status: "waiting",
          outcome: "Independent review",
        },
        { kind: "condition", type: "human.answer.received", subject: "id:separate-action" },
      ];
      f.wake("first");
      await waitFor(() => f.sent.some((send) => send.text.includes("Independent review")));
      expect(f.sent.at(-1)?.text).toContain("Waiting for human.answer.received: id:separate-action");

      const sameWords = "Confirm the exact current action.";
      Object.assign(task, {
        humanAction: { requestedAction: sameWords },
        diagnostics: {
          conditions: [
            {
              id: "exact-action",
              condition: {
                metadata: { id: "exact-action", generation: 1, resourceVersion: 1 },
                spec: {
                  type: "human.answer.received",
                  subject: "id:exact-action",
                  owner: "human",
                  requestedAction: sameWords,
                  expected: { answer: true },
                },
                status: { state: "false" },
              },
            },
          ],
          conditionsTruncated: false,
        },
      });
      f.wake("first");
      await waitFor(() => f.sent.some((send) => send.text.includes(sameWords)));
      const authorityBaseline = f.sent.length;
      task.diagnostics!.conditions[0]!.condition!.metadata.generation = 2;
      f.wake("first");
      await waitFor(() => f.sent.length > authorityBaseline);
      expect(f.sent.at(-1)?.text).toContain(sameWords);
    } finally {
      await f.close();
    }
  });

  it("refreshes the newly selected App after an old action notification finishes", async () => {
    const f = fixture();
    try {
      await f.command("/apps may");
      Object.assign(f.tasks.get("first")!, { humanAction: { requestedAction: "Old App action" } });
      Object.assign(f.tasks.get("second")!, { appId: "another", humanAction: { requestedAction: "New App action" } });
      const held = f.hold((send) => send.chat_id === "123" && send.text.includes("Old App action"));
      f.wake("first");
      await waitFor(() => held.started);
      await f.command("/apps another");
      held.release();
      await waitFor(() => f.sent.some((send) => send.chat_id === "123" && send.text.includes("New App action")));
      const references = f.published.filter(
        (event) => (event.data?.metadata as { command?: string } | undefined)?.command === "/todo notification",
      );
      expect(references.some((event) => event.data?.text?.includes("Old App action"))).toBe(true);
      await Bun.sleep(25);
      expect(f.sent.filter((send) => send.chat_id === "123" && send.text.includes("New App action"))).toHaveLength(1);
    } finally {
      await f.close();
    }
  });

  it("stops Conversation sends and pending syncs after close", async () => {
    const f = fixture();
    try {
      f.conversation("First Console message", 1);
      f.conversation("Must not send the next Console message", 2);
      const held = f.hold((send) => send.text.includes("First Console message"));
      f.wakeConversation();
      await waitFor(() => held.started);
      f.wakeConversation();
      await Bun.sleep(20);
      f.bot.close();
      held.release();
      await waitFor(() => held.finished);
      await Bun.sleep(25);
      expect(f.sent).toHaveLength(1);
      expect(f.published).toHaveLength(0);
    } finally {
      await f.close();
    }
  });

  it("does not publish an action notification or refresh again after close", async () => {
    const f = fixture();
    try {
      await f.command("/apps may");
      f.tasks.get("first")!.humanAction = { requestedAction: "Action while closing" };
      const held = f.hold((send) => send.text.includes("Action while closing"));
      f.wake("first");
      await waitFor(() => held.started);
      f.wake("first", 10);
      await Bun.sleep(20);
      const reads = f.listReads.length;
      const published = f.published.length;
      f.bot.close();
      held.release();
      await waitFor(() => held.finished);
      await Bun.sleep(25);
      expect(f.listReads).toHaveLength(reads);
      expect(f.published).toHaveLength(published);
    } finally {
      await f.close();
    }
  });
});

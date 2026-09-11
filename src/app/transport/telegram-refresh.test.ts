import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../lib/requests.js";
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

type Send = { chat_id: string; text: string; reply_parameters?: { message_id: number } };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-telegram-refresh-"));
  const priorFetch = globalThis.fetch;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  const priorChat = process.env.TELEGRAM_CHAT_ID;
  const bus = new EventBus();
  const published: EventInput[] = [];
  const sent: Send[] = [];
  const errors: string[] = [];
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
    bot,
    sent,
    published,
    errors,
    reads,
    tasks,
    readFailures,
    sendFailures,
    listReads,
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
    async command(text: string, chat = 123) {
      await waitFor(() => receive !== undefined);
      const deliver = receive!;
      receive = undefined;
      const id = ++nextUpdate;
      const priorViews = published.length;
      deliver([{ update_id: id, message: { message_id: id, chat: { id: chat }, text } }]);
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

describe("Telegram refresh lifecycle", () => {
  it.each(["second", "first"])("keeps the new %s watch when an old terminal send finishes", async (next) => {
    const f = fixture();
    try {
      await f.command("/watch first");
      Object.assign(f.tasks.get("first")!, { terminal: true, status: "done", summary: "Old terminal result" });
      const old = f.hold((send) => !send.reply_parameters && send.text.includes("Old terminal result"));
      f.wake("first");
      await waitFor(() => old.started);

      // Re-watching the same Task is a new selection too, even if its identity matches.
      Object.assign(f.tasks.get("first")!, { terminal: false, status: "running", summary: "New generation" });
      await f.command(`/watch ${next}`);
      old.release();
      await waitFor(() => old.finished);
      await Bun.sleep(20);
      await f.command("/watch");
      expect(f.sent.at(-1)?.text).toContain(`Task ${next}`);
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
      expect(f.reads).toHaveLength(baseline + 2);
      held.release();
      await waitFor(() => f.sent.some((send) => send.text.includes("Latest refresh")));
      await Bun.sleep(25);
      expect(f.reads).toHaveLength(baseline + 3);
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
